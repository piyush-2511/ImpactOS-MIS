import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requirePlatformStaff } from '@/lib/platform/staff';
import { listPlans } from '@/features/console-plans/queries';
import { PlansTable } from '@/features/console-plans/components/PlansTable';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('console.plans'))('title') };
}

export default async function PlansPage() {
  const staff = await requirePlatformStaff('/console/plans');
  const [plans, t] = await Promise.all([listPlans(), getTranslations('console.plans')]);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      <PlansTable plans={plans} canEdit={staff.role === 'super_admin'} />
    </>
  );
}
