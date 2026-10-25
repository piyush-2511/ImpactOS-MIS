import type { LucideIcon } from 'lucide-react';

/** Shown when a list has no rows: what this page is for, and the one action that fills it. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-12 text-center">
      {Icon && (
        <span className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <h2 className="text-lg font-semibold">{title}</h2>
      {body && <p className="max-w-md text-sm text-muted-foreground">{body}</p>}
      {action}
    </div>
  );
}
