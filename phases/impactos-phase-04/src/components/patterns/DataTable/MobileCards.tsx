'use client';

import { Checkbox } from '@/components/ui/checkbox';

/** Phone layout for a list: one card per row with a title, a subtitle and up to four fields. */
export function MobileCards<T>({
  rows,
  rowKey,
  title,
  subtitle,
  fields,
  onOpen,
  rowLabel,
  selectable,
  selected,
  onToggle,
}: {
  rows: T[];
  rowKey: (r: T) => string;
  title: (r: T) => React.ReactNode;
  subtitle?: (r: T) => React.ReactNode;
  fields: { key: string; label: string; cell: (r: T) => React.ReactNode }[];
  onOpen?: (r: T) => void;
  rowLabel?: (r: T) => string;
  selectable?: boolean;
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
}) {
  return (
    <ul className="flex flex-col gap-2 md:hidden">
      {rows.map((r) => {
        const id = rowKey(r);
        return (
          <li key={id} className="flex gap-3 rounded-xl bg-card p-4 shadow-sm">
            {selectable && (
              <Checkbox
                checked={selected.has(id)}
                onCheckedChange={(v) => onToggle(id, v === true)}
                aria-label={rowLabel?.(r)}
                className="mt-1"
              />
            )}
            <button
              type="button"
              className="flex flex-1 flex-col gap-1 text-left"
              onClick={() => onOpen?.(r)}
              disabled={!onOpen}
              aria-label={rowLabel?.(r)}
            >
              <span className="font-semibold">{title(r)}</span>
              {subtitle && <span className="text-sm text-muted-foreground">{subtitle(r)}</span>}
              <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                {fields.slice(0, 4).map((f) => (
                  <div key={f.key} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{f.label}</dt>
                    <dd className="truncate">{f.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
