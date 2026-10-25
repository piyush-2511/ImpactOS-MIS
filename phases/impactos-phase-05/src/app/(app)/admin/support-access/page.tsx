import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/authz/can';
import { requireUser } from '@/lib/auth/user';
import { supportAccess } from '@/features/support-access/queries';
import { SupportAccessCard } from '@/features/support-access/components/SupportAccessCard';
import { AccessLog } from '@/features/support-access/components/AccessLog';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('billing.support'))('title') };
}

const fmt = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

/** Admin → Support access: grant / end ImpactOS access and see everything they viewed. */
export default async function SupportAccessPage() {
  await requireUser('/admin/support-access');
  const active = await requirePermission('admin.support.manage');
  const locale = await getLocale();
  const [{ grants, log }, t] = await Promise.all([
    supportAccess(active.organization.id),
    getTranslations('billing.support'),
  ]);
  return (
    <>
      <div>
        <p className="text-[13px] text-muted-foreground">{t('crumb')}</p>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>
      <SupportAccessCard
        grants={grants}
        when={Object.fromEntries(grants.map((g) => [g.id, fmt(g.expiresAt, locale)]))}
        canManage
      />
      <AccessLog rows={log} when={Object.fromEntries(log.map((l) => [l.id, fmt(l.at, locale)]))} />
    </>
  );
}
