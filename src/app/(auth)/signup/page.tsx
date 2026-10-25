import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { publicEnv } from '@/config/env';
import { getCurrentUser } from '@/lib/auth/user';
import { SignupForm } from '@/features/auth/components/SignupForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.signup'))('title') };
}

export default async function SignupPage() {
  if (await getCurrentUser()) redirect('/setup-org');
  const t = await getTranslations('auth');
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t('signup.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('signup.intro')}</p>
      </div>
      <SignupForm turnstileSiteKey={publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      <p className="text-center text-sm">
        {t('signup.haveAccount')} <Link href="/login">{t('actions.signIn')}</Link>
      </p>
    </>
  );
}
