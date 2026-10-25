/**
 * List-page state lives in the URL (shareable, bookmarkable, saved views store the query string).
 * q = search, page, size, sort = "field" or "-field", f_<key> = comma-separated values, f_<key>_from / _to for dates.
 */
export type ListQuery = {
  q: string;
  page: number;
  size: number;
  sort: { key: string; dir: 'asc' | 'desc' } | null;
  filters: Record<string, string[]>;
  ranges: Record<string, { from?: string; to?: string }>;
};
export const PAGE_SIZES = [25, 50, 100] as const;

type SP = Record<string, string | string[] | undefined> | URLSearchParams;
const get = (sp: SP, k: string): string | undefined =>
  sp instanceof URLSearchParams
    ? (sp.get(k) ?? undefined)
    : Array.isArray(sp[k])
      ? (sp[k] as string[])[0]
      : (sp[k] as string | undefined);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[a-z][a-z0-9_]{0,60}$/;

/** Parse and sanitise list state for the server. Unknown keys are ignored; only `allowed` filter/sort keys pass. */
export function parseListQuery(
  sp: SP,
  allowed: { filters: string[]; sorts: string[] },
  defaults: Partial<ListQuery> = {},
): ListQuery {
  const size = Number(get(sp, 'size'));
  const page = Number(get(sp, 'page'));
  const rawSort = get(sp, 'sort') ?? '';
  const sortKey = rawSort.replace(/^-/, '');
  const filters: Record<string, string[]> = {};
  const ranges: Record<string, { from?: string; to?: string }> = {};
  for (const k of allowed.filters) {
    const v = get(sp, `f_${k}`);
    if (v)
      filters[k] = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 50)
        .map((s) => s.slice(0, 100));
    const from = get(sp, `f_${k}_from`);
    const to = get(sp, `f_${k}_to`);
    if ((from && DATE.test(from)) || (to && DATE.test(to)))
      ranges[k] = { from: from && DATE.test(from) ? from : undefined, to: to && DATE.test(to) ? to : undefined };
  }
  return {
    q: (get(sp, 'q') ?? '').trim().slice(0, 100),
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 10_000) : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : (defaults.size ?? 25),
    sort:
      KEY.test(sortKey) && allowed.sorts.includes(sortKey)
        ? { key: sortKey, dir: rawSort.startsWith('-') ? 'desc' : 'asc' }
        : (defaults.sort ?? null),
    filters,
    ranges,
  };
}

/** Return a new query string with `changes` applied (undefined/empty removes a key). Resets page unless page changes. */
export function withParams(current: string, changes: Record<string, string | undefined | null>): string {
  const sp = new URLSearchParams(current);
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined || v === null || v === '') sp.delete(k);
    else sp.set(k, v);
  }
  if (!('page' in changes)) sp.delete('page');
  const s = sp.toString();
  return s ? `?${s}` : '';
}
