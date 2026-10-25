import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  state: string;
  createdAt: string;
  status: string;
  planKey: string;
  planName: string;
  trialEndsAt: string | null;
  members: number;
  storageMb: number;
  openInvoicesPaise: number;
  lastActivity: string | null;
};

/** Console aggregate across all organisations (service role: platform staff only, guarded by the page). */
export async function listTenants(filters: { status?: string[]; q?: string }): Promise<TenantRow[]> {
  const db = supabaseAdmin();
  let orgs = db
    .from('organizations')
    .select('id, name, slug, state, created_at, subscriptions(status, plan_key, trial_ends_at, plan:plans(name))')
    .order('created_at', { ascending: false })
    .limit(500);
  if (filters.q)
    orgs = orgs.or(`name.ilike.%${filters.q.replace(/[%,()]/g, '')}%,slug.ilike.%${filters.q.replace(/[%,()]/g, '')}%`);
  const [{ data }, { data: members }, { data: files }, { data: invoices }, { data: activity }] = await Promise.all([
    orgs,
    db.from('organization_members').select('organization_id').eq('status', 'active').limit(100_000),
    db.from('storage_files').select('organization_id, size_bytes').eq('status', 'ready').limit(100_000),
    db.from('invoices').select('organization_id, total_paise, paid_paise').eq('status', 'issued'),
    db.from('audit_events').select('organization_id, created_at').order('created_at', { ascending: false }).limit(2000),
  ]);
  const count = new Map<string, number>();
  for (const m of members ?? []) count.set(m.organization_id, (count.get(m.organization_id) ?? 0) + 1);
  const bytes = new Map<string, number>();
  for (const f of files ?? []) bytes.set(f.organization_id, (bytes.get(f.organization_id) ?? 0) + Number(f.size_bytes));
  const owed = new Map<string, number>();
  for (const i of invoices ?? [])
    owed.set(i.organization_id, (owed.get(i.organization_id) ?? 0) + i.total_paise - i.paid_paise);
  const last = new Map<string, string>();
  for (const a of activity ?? [])
    if (a.organization_id && !last.has(a.organization_id)) last.set(a.organization_id, a.created_at);
  const rows = (data ?? []).map((o) => {
    const s = Array.isArray(o.subscriptions) ? o.subscriptions[0] : o.subscriptions;
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      state: o.state,
      createdAt: o.created_at,
      status: s?.status ?? 'none',
      planKey: s?.plan_key ?? '',
      planName: s?.plan?.name ?? '—',
      trialEndsAt: s?.trial_ends_at ?? null,
      members: count.get(o.id) ?? 0,
      storageMb: Math.round((bytes.get(o.id) ?? 0) / 1024 / 1024),
      openInvoicesPaise: owed.get(o.id) ?? 0,
      lastActivity: last.get(o.id) ?? null,
    };
  });
  return filters.status?.length ? rows.filter((r) => filters.status!.includes(r.status)) : rows;
}

/** One tenant for the console. Organisation DATA (members, activity) is only included while a support grant is active. */
export async function tenantDetail(orgId: string) {
  const db = supabaseAdmin();
  const [
    { data: org },
    { data: sub },
    { data: plans },
    { data: invoices },
    { data: tickets },
    { data: grants },
    { count: members },
    { data: seats },
  ] = await Promise.all([
    db.from('organizations').select('*').eq('id', orgId).maybeSingle(),
    db.from('subscriptions').select('*').eq('organization_id', orgId).maybeSingle(),
    db.from('plans').select('key, name').eq('active', true).order('sort_order'),
    db
      .from('invoices')
      .select('id, number, status, period_start, total_paise, paid_paise, due_at')
      .eq('organization_id', orgId)
      .neq('status', 'draft')
      .order('period_start', { ascending: false })
      .limit(12),
    db
      .from('support_tickets')
      .select('id, subject, status, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10),
    db
      .from('support_grants')
      .select('*')
      .eq('organization_id', orgId)
      .order('granted_at', { ascending: false })
      .limit(5),
    db
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active'),
    db.rpc('staff_seats_used', { org: orgId }),
  ]);
  if (!org) return null;
  const now = Date.now();
  const activeGrant = (grants ?? []).find((g) => !g.revoked_at && new Date(g.expires_at).getTime() > now) ?? null;
  return {
    org,
    sub,
    plans: plans ?? [],
    invoices: invoices ?? [],
    tickets: tickets ?? [],
    grants: grants ?? [],
    activeGrant,
    members: members ?? 0,
    seats: seats ?? 0,
  };
}

/** Organisation data under a grant: read with the STAFF user's own session (RLS support policies + 2FA), never the service role. */
export async function supportView(orgId: string) {
  const { supabaseServer } = await import('@/lib/supabase/server');
  const supabase = await supabaseServer();
  const [{ data: members }, { data: events }] = await Promise.all([
    supabase
      .from('organization_members')
      .select(
        'id, kind, status, base_role, joined_at, profile:profiles!organization_members_profile_fkey(full_name, email)',
      )
      .eq('organization_id', orgId)
      .limit(200),
    supabase
      .from('audit_events')
      .select('id, action, table_name, created_at, note')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);
  return { members: members ?? [], events: events ?? [] };
}
