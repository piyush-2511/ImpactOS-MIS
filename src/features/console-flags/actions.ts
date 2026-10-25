'use server';

import { revalidatePath } from 'next/cache';
import { consoleAction } from '@/lib/platform/support';
import { ActionError } from '@/lib/actions/errors';
import { flagIdSchema, flagSchema } from './schema';

export const setFlagAction = consoleAction(
  {
    roles: [],
    schema: flagSchema,
    audit: (i) => ({ action: 'flag.set', target: `${i.key}${i.orgSlug ? `@${i.orgSlug}` : ''}=${i.enabled}` }),
  },
  async (input, ctx) => {
    let orgId: string | null = null;
    if (input.orgSlug) {
      const { data } = await ctx.admin.from('organizations').select('id').eq('slug', input.orgSlug).maybeSingle();
      if (!data) throw new ActionError('orgNotFound', undefined, { orgSlug: 'orgNotFound' });
      orgId = data.id;
    }
    const { data: existing } = await ctx.supabase
      .from('feature_flags')
      .select('id')
      .eq('key', input.key)
      .filter('organization_id', orgId ? 'eq' : 'is', orgId ?? null)
      .maybeSingle();
    const { error } = existing
      ? await ctx.supabase
          .from('feature_flags')
          .update({ enabled: input.enabled, note: input.note || null })
          .eq('id', existing.id)
      : await ctx.supabase
          .from('feature_flags')
          .insert({ key: input.key, organization_id: orgId, enabled: input.enabled, note: input.note || null });
    if (error) throw error;
    revalidatePath('/console/flags');
    return null;
  },
);

export const deleteFlagAction = consoleAction(
  { roles: [], schema: flagIdSchema, audit: (i) => ({ action: 'flag.deleted', target: i.id }) },
  async (input, ctx) => {
    const { error } = await ctx.supabase.from('feature_flags').delete().eq('id', input.id);
    if (error) throw error;
    revalidatePath('/console/flags');
    return null;
  },
);
