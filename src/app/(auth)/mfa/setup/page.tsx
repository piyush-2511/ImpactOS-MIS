import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { requireUser, safeNext } from '@/lib/auth/user';
import { getAal } from '@/lib/auth/aal';
import { MfaEnroll } from '@/features/auth/components/MfaEnroll';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.mfa'))('setupTitle') };
}

export default async function MfaSetupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, '/');
  await requireUser(`/mfa/setup?next=${encodeURIComponent(next)}`);
  const { current, next: possible } = await getAal();
  // Already has a verified factor: challenge it instead of enrolling another one here.
  if (possible === 'aal2' && current !== 'aal2') redirect(`/mfa?next=${encodeURIComponent(next)}`);
  const t = await getTranslations('auth');
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t('mfa.setupTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('mfa.setupIntro')}</p>
      </div>
      <MfaEnroll next={next} />
    </>
  );
}
