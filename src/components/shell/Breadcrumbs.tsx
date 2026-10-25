import Link from 'next/link';

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, label }: { items: Crumb[]; label: string }) {
  if (!items.length) return null;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
      {items.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>/</span>}
          {c.href ? (
            <Link href={c.href} className="text-muted-foreground no-underline hover:underline">
              {c.label}
            </Link>
          ) : (
            <span aria-current={i === items.length - 1 ? 'page' : undefined}>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
