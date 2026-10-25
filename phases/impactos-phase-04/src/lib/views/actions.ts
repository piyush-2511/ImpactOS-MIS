'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { action, check, must } from '@/lib/actions/action';
import type { Json } from '@/lib/supabase/database.types';

/** Saved views: a named set of filters, sort and visible columns on a list page (own, or shared with the organisation). */
const saveSchema = z.object({
  entity: z.string().regex(/^[a-z][a-z_]{1,40}$/),
  name: z.string().trim().min(1, 'nameShort').max(60, 'nameLong'),
  state: z.object({ query: z.string().max(2000), columns: z.array(z.string().max(60)).max(80).optional() }),
  shared: z.boolean().default(false),
  path: z.string().regex(/^\/[a-z0-9/_-]*$/),
});

export const saveViewAction = action({ schema: saveSchema }, async (input, ctx) => {
  const row = must(
    await ctx.supabase
      .from('saved_views')
      .insert({
        organization_id: ctx.orgId,
        entity: input.entity,
        name: input.name,
        state: input.state as Json,
        shared: input.shared,
      })
      .select('id')
      .single(),
  );
  revalidatePath(input.path);
  return { id: row.id };
});

export const deleteViewAction = action(
  { schema: z.object({ id: z.string().uuid(), path: z.string().regex(/^\/[a-z0-9/_-]*$/) }) },
  async (input, ctx) => {
    check(await ctx.supabase.from('saved_views').delete().eq('id', input.id));
    revalidatePath(input.path);
    return null;
  },
);
