import { Card, CardTitle } from '@/components/ui/card';

export type ChartPoint = { label: string; value: number };

/**
 * Simple, dependency-free bar or line chart (SVG) with an accessible data table. Colours come from theme tokens, so
 * it works in light and dark mode. `format` turns numbers into display text (₹, lakh/crore, %).
 */
export function ChartCard({
  title,
  points,
  type = 'bar',
  format = (n) => String(n),
  tableLabel,
  emptyLabel,
}: {
  title: string;
  points: ChartPoint[];
  type?: 'bar' | 'line';
  format?: (n: number) => string;
  tableLabel: string;
  emptyLabel: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const W = 600;
  const H = 220;
  const pad = { l: 8, r: 8, t: 16, b: 48 };
  const step = points.length ? (W - pad.l - pad.r) / points.length : 0;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{title}</CardTitle>
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
            <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--border)" />
            {type === 'bar' &&
              points.map((p, i) => (
                <g key={p.label + i}>
                  <rect
                    x={pad.l + i * step + step * 0.15}
                    width={step * 0.7}
                    y={y(p.value)}
                    height={H - pad.b - y(p.value)}
                    rx={4}
                    fill="var(--primary)"
                  />
                  <text
                    x={pad.l + i * step + step / 2}
                    y={y(p.value) - 4}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--muted-foreground)"
                  >
                    {format(p.value)}
                  </text>
                </g>
              ))}
            {type === 'line' && (
              <polyline
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2.5}
                points={points.map((p, i) => `${pad.l + i * step + step / 2},${y(p.value)}`).join(' ')}
              />
            )}
            {type === 'line' &&
              points.map((p, i) => (
                <circle
                  key={p.label + i}
                  cx={pad.l + i * step + step / 2}
                  cy={y(p.value)}
                  r={3.5}
                  fill="var(--green)"
                />
              ))}
            {points.map((p, i) => (
              <text
                key={`l${i}`}
                x={pad.l + i * step + step / 2}
                y={H - pad.b + 16}
                textAnchor="middle"
                fontSize="11"
                fill="var(--muted-foreground)"
              >
                {p.label.length > 12 ? `${p.label.slice(0, 11)}…` : p.label}
              </text>
            ))}
          </svg>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">{tableLabel}</summary>
            <table className="mt-2 w-full">
              <tbody>
                {points.map((p, i) => (
                  <tr key={p.label + i} className="border-t border-border/60">
                    <td className="py-1">{p.label}</td>
                    <td className="py-1 text-right font-mono">{format(p.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </Card>
  );
}
