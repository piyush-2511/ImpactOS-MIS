'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDownIcon, SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { withParams } from '@/lib/views/filters';
import { cn } from '@/lib/utils';

export type FilterOption = { value: string; label: string; count?: number };
export type FilterDef = { key: string; label: string; type: 'multi' | 'date'; options?: FilterOption[] };

/**
 * Filters above every list. Options come from the data (filter_facets) with counts; state lives in the URL so views
 * can be bookmarked, shared and saved. Active filters are outlined in navy, as in the prototype.
 */
export function FilterBar({
  filters,
  searchPlaceholder,
  total,
  extra,
}: {
  filters: FilterDef[];
  searchPlaceholder?: string;
  total?: string;
  extra?: React.ReactNode;
}) {
  const t = useTranslations('engine.filters');
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const go = (changes: Record<string, string | undefined>) =>
    router.push(`${path}${withParams(sp.toString(), changes)}`, { scroll: false });

  useEffect(() => {
    if ((sp.get('q') ?? '') === q) return;
    const id = setTimeout(() => go({ q: q.trim() || undefined }), 350);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount =
    filters.filter((f) => sp.get(`f_${f.key}`) || sp.get(`f_${f.key}_from`) || sp.get(`f_${f.key}_to`)).length +
    (sp.get('q') ? 1 : 0);
  const clearAll = () => {
    setQ('');
    go(
      Object.fromEntries([
        ['q', undefined],
        ...filters.flatMap((f) => [
          [`f_${f.key}`, undefined],
          [`f_${f.key}_from`, undefined],
          [`f_${f.key}_to`, undefined],
        ]),
      ]),
    );
  };

  return (
    <div role="search" className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-3 shadow-sm">
      {searchPlaceholder !== undefined && (
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">{searchPlaceholder}</span>
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-h-9 pl-9"
          />
        </label>
      )}
      {filters.map((f) => {
        if (f.type === 'date') {
          const from = sp.get(`f_${f.key}_from`) ?? '';
          const to = sp.get(`f_${f.key}_to`) ?? '';
          const on = !!(from || to);
          return (
            <Popover key={f.key}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-pressed={on}
                  className={cn(
                    'inline-flex min-h-9 items-center gap-1 rounded-full border border-border px-3 text-sm',
                    on && 'border-foreground bg-accent font-semibold',
                  )}
                >
                  {f.label}
                  {on ? `: ${from || '…'} – ${to || '…'}` : ''} <ChevronDownIcon className="size-3.5" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent className="flex flex-col gap-3">
                <Label className="flex flex-col items-start gap-1">
                  {t('from')}
                  <Input
                    type="date"
                    defaultValue={from}
                    onChange={(e) => go({ [`f_${f.key}_from`]: e.target.value || undefined })}
                  />
                </Label>
                <Label className="flex flex-col items-start gap-1">
                  {t('to')}
                  <Input
                    type="date"
                    defaultValue={to}
                    onChange={(e) => go({ [`f_${f.key}_to`]: e.target.value || undefined })}
                  />
                </Label>
              </PopoverContent>
            </Popover>
          );
        }
        const chosen = (sp.get(`f_${f.key}`) ?? '').split(',').filter(Boolean);
        const on = chosen.length > 0;
        const summary = on
          ? chosen.length === 1
            ? (f.options?.find((o) => o.value === chosen[0])?.label ?? chosen[0])
            : t('nSelected', { n: chosen.length })
          : t('any');
        return (
          <Popover key={f.key}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-pressed={on}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1 rounded-full border border-border px-3 text-sm',
                  on && 'border-foreground bg-accent font-semibold',
                )}
              >
                {f.label}: {summary} <ChevronDownIcon className="size-3.5" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {(f.options ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t('noOptions')}</p>}
              {(f.options ?? []).map((o) => (
                <div key={o.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`fl-${f.key}-${o.value}`}
                    checked={chosen.includes(o.value)}
                    onCheckedChange={(v) => {
                      const next = v === true ? [...chosen, o.value] : chosen.filter((c) => c !== o.value);
                      go({ [`f_${f.key}`]: next.join(',') || undefined });
                    }}
                  />
                  <Label htmlFor={`fl-${f.key}-${o.value}`} className="flex flex-1 justify-between gap-3 font-normal">
                    <span>{o.label}</span>
                    {o.count !== undefined && (
                      <span className="font-mono text-xs text-muted-foreground">{o.count}</span>
                    )}
                  </Label>
                </div>
              ))}
            </PopoverContent>
          </Popover>
        );
      })}
      {extra}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          {t('clear')}
        </Button>
      )}
      {total && <span className="ml-auto text-sm text-muted-foreground">{total}</span>}
    </div>
  );
}
