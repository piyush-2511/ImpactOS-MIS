import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { publicEnv } from '@/config/env';
import { requireUser } from '@/lib/auth/user';
import { listMyOrgs } from '@/lib/org/active-org';
import { SetupOrgForm } from '@/features/auth/components/SetupOrgForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.setupOrg'))('title') };
}

export default async function SetupOrgPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  await requireUser('/setup-org');
  const sp = await searchParams;
  if ((await listMyOrgs()).length && sp.new !== '1') redirect('/');
  const t = await getTranslations('auth');
  return (
    <>
      <div>
        <p className="text-sm text-muted-foreground">{t('setupOrg.step')}</p>
        <h1 className="text-2xl font-bold">{t('setupOrg.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('setupOrg.intro')}</p>
      </div>
      <SetupOrgForm rootDomain={publicEnv.NEXT_PUBLIC_ROOT_DOMAIN} />
    </>
  );
}
