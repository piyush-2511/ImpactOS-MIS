'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '../queries';

export function NotificationList({
  items,
  when,
  onOpen,
}: {
  items: NotificationItem[];
  when: Record<string, string>;
  onOpen: (n: NotificationItem) => void;
}) {
  const t = useTranslations('engine.notifications');
  if (!items.length) return <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>;
  return (
    <ul className="flex flex-col">
      {items.map((n) => {
        const body = (
          <>
            <span className={cn('text-sm', !n.read && 'font-semibold')}>{n.title}</span>
            {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
            <span className="text-xs text-muted-foreground">{when[n.id]}</span>
          </>
        );
        return (
          <li key={n.id} className="border-t border-border/60 first:border-t-0">
            {n.link ? (
              <Link
                href={n.link}
                onClick={() => onOpen(n)}
                className="flex flex-col gap-0.5 rounded-md px-2 py-2.5 text-foreground no-underline hover:bg-secondary"
              >
                {!n.read && <span className="sr-only">{t('unread')}</span>}
                {body}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onOpen(n)}
                className="flex w-full flex-col gap-0.5 rounded-md px-2 py-2.5 text-left hover:bg-secondary"
              >
                {!n.read && <span className="sr-only">{t('unread')}</span>}
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
