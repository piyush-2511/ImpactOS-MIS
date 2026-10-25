import 'server-only';
import { createElement } from 'react';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { PaymentReminder, reminderSubject } from '@/lib/email/templates/PaymentReminder';
import { notify } from '@/lib/notifications/notify';
import { formatPaise, trialDaysLeft } from '@/lib/billing/plans';
import { reminderToSend, statusFromInvoices } from '@/lib/billing/read-only';
import { inngest } from '../client';
import { withJobLog } from './log';

/**
 * 09:00 IST daily: payment reminders (-7, 0, +7, +14 days from due), subscription status (active → past due →
 * read-only after 15 days' grace; back to active when paid), and trial-ending notices (7 and 1 days left).
 */
export const billingReminders = inngest.createFunction(
  { id: 'billing-reminders', retries: 2, triggers: [{ cron: 'TZ=Asia/Kolkata 0 9 * * *' }] },
  async ({ step, runId, attempt }) =>
    step.run('remind-and-update', () =>
      withJobLog('billing-reminders', null, runId, attempt, async () => {
        const db = supabaseAdmin();
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
        const { data: open } = await db
          .from('invoices')
          .select('id, organization_id, number, total_paise, due_at, reminders_sent')
          .eq('status', 'issued')
          .order('due_at');
        const { data: subs } = await db.from('subscriptions').select('organization_id, status, trial_ends_at');
        const secretaries = async (orgId: string) =>
          (
            await db
              .from('organization_members')
              .select('user_id, profile:profiles!organization_members_profile_fkey(email, locale)')
              .eq('organization_id', orgId)
              .eq('status', 'active')
              .eq('base_role', 'secretary')
          ).data ?? [];
        let reminders = 0;
        for (const inv of open ?? []) {
          const stage = reminderToSend(inv);
          if (!stage) continue;
          for (const s of await secretaries(inv.organization_id)) {
            const l = (s.profile?.locale ?? 'en') as 'en' | 'hi';
            if (s.profile?.email)
              await sendEmail({
                to: s.profile.email,
                subject: reminderSubject(l, stage as 'd-7'),
                react: createElement(PaymentReminder, {
                  locale: l,
                  number: inv.number ?? '',
                  amount: formatPaise(inv.total_paise, l),
                  stage: stage as 'd-7',
                  url: `${appUrl}/admin/billing`,
                }),
                tags: { kind: 'reminder' },
              });
          }
          await db
            .from('invoices')
            .update({ reminders_sent: [...inv.reminders_sent, stage] })
            .eq('id', inv.id);
          reminders++;
        }
        let changed = 0;
        for (const sub of subs ?? []) {
          const oldest = (open ?? []).find((i) => i.organization_id === sub.organization_id)?.due_at ?? null;
          const next = statusFromInvoices(sub.status, oldest);
          if (next !== sub.status) {
            await db
              .from('subscriptions')
              .update({
                status: next as 'active',
                read_only_since: next === 'read_only' ? new Date().toISOString() : null,
              })
              .eq('organization_id', sub.organization_id);
            if (next === 'read_only') {
              const secs = await secretaries(sub.organization_id);
              await notify({
                orgId: sub.organization_id,
                userIds: secs.map((s) => s.user_id),
                kind: 'billing.read_only',
                title: 'Workspace is read-only until the invoice is paid',
                link: '/admin/billing',
              });
            }
            changed++;
          }
          if (sub.status === 'trialing' && [7, 1].includes(trialDaysLeft(sub.trial_ends_at))) {
            const secs = await secretaries(sub.organization_id);
            await notify({
              orgId: sub.organization_id,
              userIds: secs.map((s) => s.user_id),
              kind: 'billing.trial_ending',
              title: `Your free trial ends in ${trialDaysLeft(sub.trial_ends_at)} day(s): choose a plan`,
              link: '/admin/billing',
            });
          }
        }
        return { reminders, changed };
      }),
    ),
);
