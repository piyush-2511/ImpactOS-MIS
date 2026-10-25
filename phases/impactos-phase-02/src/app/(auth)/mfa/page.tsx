import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { requireUser, safeNext } from '@/lib/auth/user';
import { getAal } from '@/lib/auth/aal';
import { MfaChallenge } from '@/features/auth/components/MfaChallenge';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.mfa'))('title') };
}

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next, '/');
  await requireUser(`/mfa?next=${encodeURIComponent(next)}`);
  const { current, next: possible } = await getAal();
  if (current === 'aal2') redirect(next);
  if (possible !== 'aal2') redirect(`/mfa/setup?next=${encodeURIComponent(next)}`);
  const t = await getTranslations('auth');
  return (
    <>
      <h1 className="text-2xl font-bold">{t('mfa.title')}</h1>
      <MfaChallenge next={next} />
    </>
  );
}
