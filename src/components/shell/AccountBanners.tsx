import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { trialDaysLeft, type PlanInfo } from '@/lib/billing/plans';

export type Announcement = { id: string; title: string; body: string | null; tone: 'info' | 'warn' };

/**
 * Strip under the top bar: read-only / overdue / trial ending, an active ImpactOS support session, and platform
 * announcements. Rendered by the workspace layout into AppShell's `topNotice` slot.
 */
export async function AccountBanners({
  plan,
  supportUntil,
  announcements,
  canBill,
}: {
  plan: PlanInfo | null;
  supportUntil: string | null;
  announcements: Announcement[];
  canBill: boolean;
}) {
  const t = await getTranslations('billing.banners');
  const items: { key: string; tone: 'info' | 'warn' | 'bad'; text: string; link?: { href: string; label: string } }[] =
    [];
  if (plan?.status === 'read_only')
    items.push({
      key: 'ro',
      tone: 'bad',
      text: t('readOnly'),
      link: canBill ? { href: '/admin/billing', label: t('payNow') } : undefined,
    });
  else if (plan?.status === 'past_due')
    items.push({
      key: 'pd',
      tone: 'warn',
      text: t('pastDue'),
      link: canBill ? { href: '/admin/billing', label: t('payNow') } : undefined,
    });
  else if (plan?.status === 'trialing' && trialDaysLeft(plan.trialEndsAt) <= 7)
    items.push({
      key: 'tr',
      tone: 'info',
      text: t('trial', { days: trialDaysLeft(plan.trialEndsAt) }),
      link: canBill ? { href: '/admin/billing', label: t('choosePlan') } : undefined,
    });
  if (supportUntil)
    items.push({
      key: 'sp',
      tone: 'info',
      text: t('support', { until: supportUntil }),
      link: { href: '/admin/support-access', label: t('manage') },
    });
  for (const a of announcements)
    items.push({ key: a.id, tone: a.tone, text: a.body ? `${a.title}: ${a.body}` : a.title });
  if (!items.length) return null;
  const tone = { info: 'bg-info-bg text-info-fg', warn: 'bg-warn-bg text-warn-fg', bad: 'bg-bad-bg text-bad-fg' };
  return (
    <div className="flex flex-col">
      {items.map((i) => (
        <p key={i.key} className={`flex flex-wrap items-center gap-2 px-4 py-2 text-sm md:px-6 ${tone[i.tone]}`}>
          <span>{i.text}</span>
          {i.link && (
            <Link href={i.link.href} className="font-semibold text-inherit underline">
              {i.link.label}
            </Link>
          )}
        </p>
      ))}
    </div>
  );
}
