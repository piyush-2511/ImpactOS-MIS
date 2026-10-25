import type { ReportResult } from '@/lib/reports/engine';
import { ChartCard } from './ChartCard';

/** A report result as chart + table (module Reports pages and the Report Builder preview). */
export function ReportView({
  title,
  result,
  chart,
  labels,
  format,
}: {
  title: string;
  result: ReportResult;
  chart: 'bar' | 'line' | 'table';
  labels: { table: string; empty: string; total: string; other: string };
  format?: (n: number) => string;
}) {
  const fmt = format ?? ((n: number) => new Intl.NumberFormat('en-IN').format(n));
  const points = result.rows.map((r) => ({ label: r.key === '__other' ? labels.other : r.label, value: r.value }));
  return (
    <div className="flex flex-col gap-2">
      {chart === 'table' ? (
        <div className="overflow-x-auto rounded-xl bg-card p-5">
          <h2 className="mb-3 text-[17px] font-semibold">{title}</h2>
          <table className="w-full text-sm">
            <tbody>
              {points.map((p, i) => (
                <tr key={p.label + i} className="border-t border-border/60">
                  <td className="py-1.5">{p.label}</td>
                  <td className="py-1.5 text-right font-mono">{fmt(p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ChartCard
          title={title}
          points={points}
          type={chart}
          format={fmt}
          tableLabel={labels.table}
          emptyLabel={labels.empty}
        />
      )}
      <p className="text-right text-sm text-muted-foreground">
        {labels.total}: <span className="font-mono">{fmt(result.total)}</span>
      </p>
    </div>
  );
}
