'use server';

import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/user';

/** Mark one or all of the user's notifications read. Not organisation-scoped: notifications belong to a person. */
export async function markNotificationsReadAction(input: { ids?: string[] }): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const parsed = z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false };
  const supabase = await supabaseServer();
  let q = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
  if (parsed.data.ids?.length) q = q.in('id', parsed.data.ids);
  const { error } = await q;
  return { ok: !error };
}
