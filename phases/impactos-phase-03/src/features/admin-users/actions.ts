'use server';

import { revalidatePath } from 'next/cache';
import { publicEnv, serverEnv } from '@/config/env';
import { action, check, must } from '@/lib/actions/action';
import { ActionError } from '@/lib/actions/errors';
import { audit } from '@/lib/actions/audit';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateInviteToken, hashInviteToken, inviteUrl } from '@/lib/auth/invites';
import { generatePassword, syntheticEmail } from '@/lib/auth/username';
import { sendEmail } from '@/lib/email/send';
import { InviteEmail, inviteSubject } from '@/lib/email/templates/Invite';
import {
  invitationIdSchema,
  inviteSchema,
  memberIdSchema,
  memberRolesSchema,
  memberScopesSchema,
  memberStatusSchema,
  usernameAccountSchema,
} from './schema';

const ROLE_KEY_FOR_INVITE: Record<string, 'admin' | 'finance' | 'member' | 'self_service'> = {
  admin: 'admin',
  finance: 'finance',
  self_service: 'self_service',
};
const done = () => revalidatePath('/admin/users');

/** Email invitation: 7-day single-use link; only the token's SHA-256 is stored. */
export const inviteMemberAction = action(
  { permission: 'admin.users.manage', schema: inviteSchema },
  async (input, ctx) => {
    const { data: role } = await ctx.supabase
      .from('roles')
      .select('id, key, name, grants_all')
      .eq('id', input.roleId)
      .maybeSingle();
    if (!role || role.grants_all || role.key === 'secretary') throw new ActionError('roleNotAllowed');
    const token = generateInviteToken();
    const { data: inv, error } = await ctx.supabase
      .from('invitations')
      .insert({
        organization_id: ctx.orgId,
        email: input.email,
        role_id: role.id,
        role_key: ROLE_KEY_FOR_INVITE[role.key ?? ''] ?? 'member',
        token_hash: await hashInviteToken(token),
        locale: input.locale,
      })
      .select('id')
      .single();
    if (error) throw error;
    const { data: me } = await ctx.supabase.from('profiles').select('full_name').eq('id', ctx.user.id).maybeSingle();
    const sent = await sendEmail({
      to: input.email,
      subject: inviteSubject(input.locale, ctx.org.organization.name),
      react: InviteEmail({
        locale: input.locale,
        inviter: me?.full_name || ctx.user.email || 'ImpactOS',
        org: ctx.org.organization.name,
        url: inviteUrl(publicEnv.NEXT_PUBLIC_APP_URL, token),
      }),
      tags: { kind: 'invite' },
    });
    await audit(ctx.orgId, 'member.invited', {
      table: 'invitations',
      rowId: inv.id,
      note: `${input.email} as ${role.name}`,
    });
    done();
    // In local development without an email provider the link is returned so it can be opened directly.
    return {
      email: input.email,
      devLink: sent.reason === 'no-provider' ? inviteUrl(publicEnv.NEXT_PUBLIC_APP_URL, token) : null,
    };
  },
);

/**
 * Username account for someone without email (provisioning: service role). Creates the auth user with a synthetic,
 * non-routable email and a one-time password, then the membership and role. Returns the password ONCE for the slip.
 */
export const createUsernameAccountAction = action(
  { permission: 'admin.users.manage', schema: usernameAccountSchema },
  async (input, ctx) => {
    const admin = supabaseAdmin();
    const { data: role } = await ctx.supabase
      .from('roles')
      .select('id, key, grants_all')
      .eq('id', input.roleId)
      .maybeSingle();
    if (!role || role.grants_all || role.key === 'secretary') throw new ActionError('roleNotAllowed');
    const { data: taken } = await admin
      .from('username_accounts')
      .select('user_id')
      .eq('organization_id', ctx.orgId)
      .eq('username', input.username)
      .maybeSingle();
    if (taken) throw new ActionError('usernameTaken');

    const password = generatePassword();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: syntheticEmail(input.username, serverEnv().SYNTHETIC_EMAIL_DOMAIN),
      password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName, locale: input.locale },
    });
    if (createErr || !created.user) throw new ActionError('generic');
    const userId = created.user.id;
    try {
      check(
        await admin
          .from('username_accounts')
          .insert({ organization_id: ctx.orgId, username: input.username, user_id: userId, created_by: ctx.user.id }),
      );
      const member = must(
        await admin
          .from('organization_members')
          .insert({
            organization_id: ctx.orgId,
            user_id: userId,
            kind: 'username',
            base_role: 'member',
            created_by: ctx.user.id,
          })
          .select('id')
          .single(),
      );
      // Role assignment through the RPC as the acting admin, so the permission and escalation guards run.
      check(await ctx.supabase.rpc('set_member_roles', { p_member: member.id, p_roles: [role.id] }));
      check(
        await admin
          .from('profiles')
          .update({ must_change_password: true, full_name: input.fullName, locale: input.locale })
          .eq('id', userId),
      );
    } catch (e) {
      await admin.auth.admin.deleteUser(userId); // roll back the half-created account
      throw e;
    }
    await audit(ctx.orgId, 'member.username_created', {
      table: 'username_accounts',
      rowId: userId,
      note: input.username,
    });
    done();
    return { username: input.username, password, orgCode: ctx.org.organization.slug, fullName: input.fullName };
  },
);

/** Replace a member's roles. Losing a role signs the person out everywhere so the change applies at once. */
export const setMemberRolesAction = action(
  { permission: 'admin.users.manage', schema: memberRolesSchema },
  async (input, ctx) => {
    const { data: before } = await ctx.supabase.from('member_roles').select('role_id').eq('member_id', input.memberId);
    check(await ctx.supabase.rpc('set_member_roles', { p_member: input.memberId, p_roles: input.roleIds }));
    const removed = (before ?? []).some((r) => !input.roleIds.includes(r.role_id));
    if (removed) {
      const { data: m } = await ctx.supabase
        .from('organization_members')
        .select('user_id')
        .eq('id', input.memberId)
        .single();
      if (m && m.user_id !== ctx.user.id) await supabaseAdmin().rpc('revoke_user_sessions', { uid: m.user_id });
    }
    done();
    return null;
  },
);

export const setMemberScopesAction = action(
  { permission: 'admin.users.manage', schema: memberScopesSchema },
  async (input, ctx) => {
    check(
      await ctx.supabase.rpc('set_member_scopes', {
        p_member: input.memberId,
        p_programs: input.programs,
        p_branches: input.branches,
      }),
    );
    done();
    return null;
  },
);

/** Deactivate (never delete: their records keep an author) or reactivate. Deactivation revokes sessions in the database. */
export const setMemberStatusAction = action(
  { permission: 'admin.users.manage', schema: memberStatusSchema },
  async (input, ctx) => {
    check(await ctx.supabase.rpc('set_member_status', { p_member: input.memberId, p_status: input.status }));
    done();
    return null;
  },
);

/** HR reset for username accounts: new one-time password (shown once), forced change at next sign-in, all sessions ended. */
export const resetUsernamePasswordAction = action(
  { permission: 'admin.users.manage', schema: memberIdSchema },
  async (input, ctx) => {
    const member = must(
      await ctx.supabase
        .from('organization_members')
        .select('user_id, kind, status')
        .eq('id', input.memberId)
        .eq('organization_id', ctx.orgId)
        .single(),
    );
    if (member.kind !== 'username') throw new ActionError('onlyUsernameAccounts');
    if (member.status !== 'active') throw new ActionError('memberInactive');
    const admin = supabaseAdmin();
    const password = generatePassword();
    const { error } = await admin.auth.admin.updateUserById(member.user_id, { password });
    if (error) throw new ActionError('generic');
    await admin.from('profiles').update({ must_change_password: true }).eq('id', member.user_id);
    await admin.rpc('revoke_user_sessions', { uid: member.user_id });
    const { data: acct } = await ctx.supabase
      .from('username_accounts')
      .select('username')
      .eq('user_id', member.user_id)
      .single();
    const { data: profile } = await ctx.supabase.from('profiles').select('full_name').eq('id', member.user_id).single();
    await audit(ctx.orgId, 'member.password_reset', { table: 'organization_members', rowId: input.memberId });
    return {
      username: acct?.username ?? '',
      password,
      orgCode: ctx.org.organization.slug,
      fullName: profile?.full_name ?? '',
    };
  },
);

export const revokeInvitationAction = action(
  { permission: 'admin.users.manage', schema: invitationIdSchema },
  async (input, ctx) => {
    check(
      await ctx.supabase
        .from('invitations')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', input.invitationId)
        .eq('organization_id', ctx.orgId),
    );
    done();
    return null;
  },
);
