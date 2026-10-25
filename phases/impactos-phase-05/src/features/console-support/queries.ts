import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type TicketRow = {
  id: string;
  orgId: string | null;
  orgName: string;
  subject: string;
  body: string;
  page: string | null;
  status: 'open' | 'waiting' | 'closed';
  priority: 'low' | 'normal' | 'high';
  reply: string | null;
  createdAt: string;
  from: string;
};

export async function listTickets(status?: string): Promise<TicketRow[]> {
  const db = supabaseAdmin();
  let q = db
    .from('support_tickets')
    .select('*, org:organizations(name)')
    .order('created_at', { ascending: false })
    .limit(300);
  if (status && ['open', 'waiting', 'closed'].includes(status)) q = q.eq('status', status as 'open');
  const { data } = await q;
  const ids = [...new Set((data ?? []).map((t) => t.created_by).filter((x): x is string => !!x))];
  const { data: profiles } = ids.length
    ? await db.from('profiles').select('id, full_name, email').in('id', ids)
    : { data: [] };
  const who = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || '—']));
  return (data ?? []).map((t) => ({
    id: t.id,
    orgId: t.organization_id,
    orgName: t.org?.name ?? '—',
    subject: t.subject,
    body: t.body,
    page: t.page,
    status: t.status,
    priority: t.priority,
    reply: t.staff_reply,
    createdAt: t.created_at,
    from: t.created_by ? (who.get(t.created_by) ?? '—') : '—',
  }));
}
