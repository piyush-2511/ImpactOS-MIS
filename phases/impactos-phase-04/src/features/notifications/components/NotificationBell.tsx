'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { BellIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { markNotificationsReadAction } from '../actions';
import type { NotificationItem } from '../queries';
import { NotificationList } from './NotificationList';

/** Top bar bell: unread count, latest items, mark all read. A daily email digest covers anything left unread. */
export function NotificationBell({
  items,
  unread,
  when,
}: {
  items: NotificationItem[];
  unread: number;
  when: Record<string, string>;
}) {
  const t = useTranslations('engine.notifications');
  const router = useRouter();
  const [count, setCount] = useState(unread);
  const [pending, start] = useTransition();
  const mark = (ids?: string[]) =>
    start(async () => {
      const r = await markNotificationsReadAction({ ids });
      if (r.ok) {
        setCount(ids ? Math.max(0, count - ids.length) : 0);
        router.refresh();
      }
    });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={count ? t('labelUnread', { n: count }) : t('label')}
        >
          <BellIcon className="size-5" aria-hidden />
          {count > 0 && (
            <span
              className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-[#C2410C] px-1 font-mono text-[10px] leading-4 text-white"
              aria-hidden
            >
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="font-semibold">{t('title')}</span>
          {count > 0 && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => mark()}>
              {t('markAll')}
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          <NotificationList
            items={items}
            when={when}
            onOpen={(n) => {
              if (!n.read) mark([n.id]);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
