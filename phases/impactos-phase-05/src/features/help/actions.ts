'use server';

import { z } from 'zod';
import { getActiveOrg } from '@/lib/org/active-org';
import { getCurrentUser } from '@/lib/auth/user';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/notify';
import { fail, ok, type ActionResult } from '@/lib/actions/result';

const schema = z.object({
  subject: z.string().trim().min(3, 'subjectShort').max(150, 'tooLong'),
  body: z.string().trim().min(3, 'bodyShort').max(4000, 'tooLong'),
  page: z
    .string()
    .regex(/^\/[^/]?[\w\-/?=&.%]*$/)
    .max(300)
    .optional(),
});

/** Help button: open a ticket with ImpactOS support (works in read-only mode too). */
export async function createTicketAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail('unauthenticated');
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    return fail('invalid', Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
  const active = await getActiveOrg();
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      organization_id: active?.organization.id ?? null,
      subject: parsed.data.subject,
      body: parsed.data.body,
      page: parsed.data.page ?? null,
    })
    .select('id')
    .single();
  if (error || !data) return fail('generic');
  const { data: staff } = await supabaseAdmin()
    .from('platform_staff')
    .select('user_id')
    .eq('active', true)
    .in('role', ['super_admin', 'support']);
  await notify({
    orgId: null,
    userIds: (staff ?? []).map((s) => s.user_id),
    kind: 'support.ticket',
    title: `Ticket from ${active?.organization.name ?? 'a user'}: ${parsed.data.subject}`,
    link: '/console/support',
  });
  return ok({ id: data.id });
}
