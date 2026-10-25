import Link from 'next/link';
import { cn } from '@/lib/utils';

export type Kpi = { label: string; value: string; note?: string; tone?: 'ok' | 'warn' | 'bad'; href?: string };

/** Row of headline numbers (dashboards, module overviews). Values are pre-formatted (Indian grouping, ₹ L/Cr). */
export function KpiCards({ items }: { items: Kpi[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((k) => {
        const body = (
          <>
            <span className="text-[13px] text-muted-foreground">{k.label}</span>
            <span className="font-mono text-[28px] font-bold tracking-tight">{k.value}</span>
            {k.note && (
              <span
                className={cn(
                  'text-[13px] text-muted-foreground',
                  k.tone === 'warn' && 'text-warn-fg',
                  k.tone === 'ok' && 'text-ok-fg',
                  k.tone === 'bad' && 'text-bad-fg',
                )}
              >
                {k.note}
              </span>
            )}
          </>
        );
        return k.href ? (
          <Link
            key={k.label}
            href={k.href}
            className="flex flex-col gap-1 rounded-xl bg-card p-5 text-foreground no-underline shadow-sm hover:ring-2 hover:ring-border"
          >
            {body}
          </Link>
        ) : (
          <div key={k.label} className="flex flex-col gap-1 rounded-xl bg-card p-5 shadow-sm">
            {body}
          </div>
        );
      })}
    </div>
  );
}
