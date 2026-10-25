import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requirePlatformStaff } from '@/lib/platform/staff';
import { listFlags } from '@/features/console-flags/queries';
import { FlagsTable } from '@/features/console-flags/components/FlagsTable';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('console.flags'))('title') };
}

export default async function FlagsPage() {
  const staff = await requirePlatformStaff('/console/flags');
  const [flags, t] = await Promise.all([listFlags(), getTranslations('console.flags')]);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      <FlagsTable flags={flags} canEdit={staff.role === 'super_admin'} />
    </>
  );
}
