import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import type { ListQuery } from '@/lib/views/filters';

export type ListSummary = { key: string; module: string; label: string; count: number };
export type ValueRow = {
  id: string;
  value_key: string;
  label_en: string;
  label_hi: string | null;
  color: string | null;
  sort_order: number;
  active: boolean;
  is_default: boolean;
  overridden: boolean;
};

export async function listLists(orgId: string, locale: 'en' | 'hi'): Promise<ListSummary[]> {
  const supabase = await supabaseServer();
  const { data: lists } = await supabase.from('lookup_lists').select('*').order('sort_order');
  const counts = await Promise.all(
    (lists ?? []).map((l) => supabase.rpc('lookup_list', { p_org: orgId, p_list: l.key })),
  );
  return (lists ?? []).map((l, i) => ({
    key: l.key,
    module: l.module,
    label: locale === 'hi' ? l.label_hi : l.label_en,
    count: counts[i]?.data?.length ?? 0,
  }));
}

/** Effective values (defaults merged with the organisation's own) filtered, sorted and paged in memory (lists are small). */
export async function listValues(
  orgId: string,
  listKey: string,
  q: ListQuery,
): Promise<{ rows: ValueRow[]; total: number; activeFacets: { value: string; n: number }[] }> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('lookup_list', { p_org: orgId, p_list: listKey, p_include_inactive: true });
  let rows = (data ?? []) as ValueRow[];
  const facets = [true, false]
    .map((a) => ({ value: String(a), n: rows.filter((r) => r.active === a).length }))
    .filter((f) => f.n > 0);
  if (q.q) {
    const s = q.q.toLowerCase();
    rows = rows.filter((r) => [r.value_key, r.label_en, r.label_hi ?? ''].some((v) => v.toLowerCase().includes(s)));
  }
  if (q.filters.active?.length) rows = rows.filter((r) => q.filters.active!.includes(String(r.active)));
  if (q.sort) {
    const k = q.sort.key as keyof ValueRow;
    rows = [...rows].sort(
      (a, b) =>
        String(a[k] ?? '').localeCompare(String(b[k] ?? ''), 'en', { numeric: true }) *
        (q.sort!.dir === 'asc' ? 1 : -1),
    );
  }
  const total = rows.length;
  return { rows: rows.slice((q.page - 1) * q.size, q.page * q.size), total, activeFacets: facets };
}
