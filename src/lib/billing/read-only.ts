import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

export const DUE_DAYS = 10; // invoice due 10 days after issue (issued on the 1st → due on the 11th)
export const GRACE_DAYS = 15; // read-only 15 days after the due date
export const REMINDERS = [-7, 0, 7, 14] as const; // days relative to the due date

const DAY = 86_400_000;
const daysFromDue = (dueAt: string, now: Date) => Math.floor((now.getTime() - new Date(dueAt).getTime()) / DAY);

/** Which reminder (if any) is due now and not yet sent: "d-7", "d0", "d+7", "d+14". */
export function reminderToSend(
  inv: { due_at: string | null; reminders_sent: string[] },
  now = new Date(),
): string | null {
  if (!inv.due_at) return null;
  const diff = daysFromDue(inv.due_at, now);
  const due = REMINDERS.filter((r) => diff >= r).map((r) => (r === 0 ? 'd0' : r < 0 ? `d${r}` : `d+${r}`));
  const next = due.at(-1);
  return next && !inv.reminders_sent.includes(next) ? next : null;
}

/**
 * Subscription status from the oldest unpaid issued invoice. Never moves a cancelled or trialing subscription; paid
 * up → active. Data is never deleted for non-payment; read-only allows viewing, exporting and paying.
 */
export function statusFromInvoices(current: string, oldestUnpaidDueAt: string | null, now = new Date()): string {
  if (current === 'cancelled' || current === 'trialing') return current;
  if (!oldestUnpaidDueAt) return 'active';
  const diff = daysFromDue(oldestUnpaidDueAt, now);
  if (diff > GRACE_DAYS) return 'read_only';
  if (diff > 0) return 'past_due';
  return 'active';
}

/** True when the organisation may only view, export and pay. */
export async function isOrgReadOnly(orgId: string): Promise<boolean> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('is_read_only', { org: orgId });
  return data === true;
}
