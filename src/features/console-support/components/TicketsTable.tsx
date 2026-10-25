'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { replyTicketAction } from '../actions';
import type { TicketRow } from '../queries';

export function TicketsTable({ tickets, when }: { tickets: TicketRow[]; when: Record<string, string> }) {
  const t = useTranslations('console.support');
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!tickets.length) return <p className="rounded-xl bg-card p-6 text-center text-muted-foreground">{t('none')}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {tickets.map((k) => (
        <li key={k.id} className="rounded-xl bg-card p-4 shadow-sm">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <Badge tone={k.status === 'closed' ? 'neutral' : k.status === 'waiting' ? 'info' : 'warn'}>
                {t(`statuses.${k.status}`)}
              </Badge>
              {k.priority === 'high' && <Badge tone="bad">{t('high')}</Badge>}
              <span className="font-semibold">{k.subject}</span>
              <span className="text-sm text-muted-foreground">
                {k.orgName} · {k.from} · {when[k.id]}
              </span>
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <p className="whitespace-pre-wrap text-sm">{k.body}</p>
              {k.page && (
                <p className="font-mono text-xs text-muted-foreground">
                  {t('page')}: {k.page}
                </p>
              )}
              {k.orgId && (
                <Link href={`/console/tenants/${k.orgId}`} className="text-sm">
                  {t('openTenant')}
                </Link>
              )}
              {k.reply && (
                <p className="rounded-lg bg-secondary px-3 py-2 text-sm">
                  <span className="font-semibold">{t('lastReply')}: </span>
                  {k.reply}
                </p>
              )}
              <form
                className="flex flex-col gap-2"
                action={(fd) =>
                  start(async () => {
                    const r = await replyTicketAction({
                      ticketId: k.id,
                      reply: fd.get('reply'),
                      status: fd.get('status'),
                      priority: fd.get('priority'),
                    });
                    if (r.ok) {
                      toast.success(t('saved'));
                      router.refresh();
                    } else toast.error(t('failed'));
                  })
                }
              >
                <Textarea name="reply" placeholder={t('replyPlaceholder')} maxLength={4000} />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    name="status"
                    defaultValue={k.status === 'open' ? 'waiting' : k.status}
                    aria-label={t('status')}
                    className="min-h-10 rounded-lg border border-input bg-card px-2"
                  >
                    {(['open', 'waiting', 'closed'] as const).map((s) => (
                      <option key={s} value={s}>
                        {t(`statuses.${s}`)}
                      </option>
                    ))}
                  </select>
                  <select
                    name="priority"
                    defaultValue={k.priority}
                    aria-label={t('priority')}
                    className="min-h-10 rounded-lg border border-input bg-card px-2"
                  >
                    {(['low', 'normal', 'high'] as const).map((s) => (
                      <option key={s} value={s}>
                        {t(`priorities.${s}`)}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" disabled={pending}>
                    {t('send')}
                  </Button>
                </div>
              </form>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
