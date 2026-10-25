import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requirePlatformStaff } from '@/lib/platform/staff';
import { formatDate } from '@/lib/i18n/format';
import { listTickets } from '@/features/console-support/queries';
import { TicketsTable } from '@/features/console-support/components/TicketsTable';
import { cn } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('console.support'))('title') };
}

export default async function ConsoleSupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePlatformStaff('/console/support');
  const status = (await searchParams).status ?? 'open';
  const [tickets, t] = await Promise.all([
    listTickets(status === 'all' ? undefined : status),
    getTranslations('console.support'),
  ]);
  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <nav className="flex flex-wrap gap-2" aria-label={t('filter')}>
        {['open', 'waiting', 'closed', 'all'].map((s) => (
          <Link
            key={s}
            href={`/console/support?status=${s}`}
            aria-current={status === s ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-9 items-center rounded-full border border-border px-4 text-sm text-foreground no-underline',
              status === s && 'border-foreground bg-accent font-semibold',
            )}
          >
            {s === 'all' ? t('all') : t(`statuses.${s}`)}
          </Link>
        ))}
      </nav>
      <TicketsTable tickets={tickets} when={Object.fromEntries(tickets.map((k) => [k.id, formatDate(k.createdAt)]))} />
    </>
  );
}
