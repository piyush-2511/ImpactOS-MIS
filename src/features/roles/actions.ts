'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { action, check, must } from '@/lib/actions/action';
import { ActionError } from '@/lib/actions/errors';
import { cloneRoleSchema, roleIdSchema, updateRoleSchema } from './schema';

/** Clone a system or custom role into a new editable custom role (never the all-powerful Secretary set). */
export const cloneRoleAction = action(
  { permission: 'admin.roles.manage', schema: cloneRoleSchema },
  async (input, ctx) => {
    const src = must(
      await ctx.supabase
        .from('roles')
        .select('id, description, default_scope, requires_mfa, grants_all, role_permissions(permission_key)')
        .eq('id', input.sourceId)
        .single(),
    );
    if (src.grants_all) throw new ActionError('cannotCloneSecretary');
    const role = must(
      await ctx.supabase
        .from('roles')
        .insert({
          organization_id: ctx.orgId,
          name: input.name,
          description: src.description,
          default_scope: src.default_scope,
          requires_mfa: src.requires_mfa,
          cloned_from: src.id,
        })
        .select('id')
        .single(),
    );
    if (src.role_permissions.length) {
      check(
        await ctx.supabase
          .from('role_permissions')
          .insert(src.role_permissions.map((p) => ({ role_id: role.id, permission_key: p.permission_key }))),
      );
    }
    revalidatePath('/admin/roles');
    return { id: role.id };
  },
);

export const updateRoleAction = action(
  { permission: 'admin.roles.manage', schema: updateRoleSchema },
  async (input, ctx) => {
    const role = must(
      await ctx.supabase
        .from('roles')
        .select('id, is_system, organization_id, role_permissions(permission_key)')
        .eq('id', input.roleId)
        .single(),
    );
    if (role.is_system || role.organization_id !== ctx.orgId) throw new ActionError('systemRoleLocked');
    check(
      await ctx.supabase
        .from('roles')
        .update({
          name: input.name,
          description: input.description || null,
          default_scope: input.defaultScope,
          requires_mfa: input.requiresMfa,
        })
        .eq('id', role.id),
    );
    const have = new Set(role.role_permissions.map((p) => p.permission_key));
    const want = new Set(input.permissions);
    const add = [...want].filter((k) => !have.has(k));
    const remove = [...have].filter((k) => !want.has(k));
    if (add.length)
      check(
        await ctx.supabase.from('role_permissions').insert(add.map((k) => ({ role_id: role.id, permission_key: k }))),
      );
    if (remove.length)
      check(await ctx.supabase.from('role_permissions').delete().eq('role_id', role.id).in('permission_key', remove));
    revalidatePath('/admin/roles');
    revalidatePath(`/admin/roles/${role.id}`);
    return null;
  },
);

/** Delete a custom role that nobody holds (the database refuses roles still assigned). */
export async function deleteRoleAction(fd: FormData): Promise<void> {
  const run = action({ permission: 'admin.roles.manage', schema: roleIdSchema }, async (input, ctx) => {
    const { count } = await ctx.supabase
      .from('member_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', input.roleId);
    if (count) throw new ActionError('roleInUse');
    check(await ctx.supabase.from('roles').delete().eq('id', input.roleId).eq('organization_id', ctx.orgId));
    return null;
  });
  const res = await run({ roleId: fd.get('roleId') });
  if (res.ok) redirect('/admin/roles');
  redirect(`/admin/roles/${String(fd.get('roleId'))}?error=${res.error}`);
}
