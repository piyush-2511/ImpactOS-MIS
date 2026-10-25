import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/authz/can';
import { requireUser } from '@/lib/auth/user';
import { resolveFields } from '@/lib/fields/resolve';
import { supabaseServer } from '@/lib/supabase/server';
import { parseListQuery } from '@/lib/views/filters';
import { listLists, listValues } from '@/features/option-lists/queries';
import { OptionListsPage } from '@/features/option-lists/components/OptionListsPage';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('engine.lists'))('title') };
}

export default async function OptionListsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser('/admin/option-lists');
  const active = await requirePermission('admin.lists.manage');
  const orgId = active.organization.id;
  const sp = await searchParams;
  const locale = (await getLocale()) === 'hi' ? 'hi' : 'en';
  const lists = await listLists(orgId, locale);
  const listKey = lists.some((l) => l.key === sp.list) ? sp.list! : (lists[0]?.key ?? 'departments');
  const q = parseListQuery(
    sp,
    { filters: ['active'], sorts: ['label_en', 'value_key', 'sort_order'] },
    { sort: { key: 'sort_order', dir: 'asc' } },
  );
  const supabase = await supabaseServer();
  const [{ rows, total, activeFacets }, fields, { data: views }, t] = await Promise.all([
    listValues(orgId, listKey, q),
    resolveFields(orgId, 'lookup_values', locale),
    supabase
      .from('saved_views')
      .select('id, name, state, shared, user_id')
      .eq('organization_id', orgId)
      .eq('entity', 'lookup_values')
      .order('name'),
    getTranslations('engine.lists'),
  ]);
  const query = new URLSearchParams(
    Object.entries(sp).filter(([, v]) => v !== undefined) as [string, string][],
  ).toString();
  return (
    <>
      <div>
        <p className="text-[13px] text-muted-foreground">{t('crumb')}</p>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      <OptionListsPage
        lists={lists}
        listKey={listKey}
        rows={rows}
        total={total}
        page={q.page}
        size={q.size}
        sort={q.sort}
        fields={fields}
        activeFacets={activeFacets}
        query={query}
        views={(views ?? []).map((v) => ({
          id: v.id,
          name: v.name,
          shared: v.shared,
          mine: v.user_id === user.id,
          query: String((v.state as { query?: string })?.query ?? ''),
        }))}
      />
    </>
  );
}
