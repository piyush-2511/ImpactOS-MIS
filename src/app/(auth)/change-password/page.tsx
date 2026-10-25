import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireUser, safeNext } from '@/lib/auth/user';
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.change'))('title') };
}

/** Forced on first sign-in for username accounts (HR set the first password) and after an HR reset. */
export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await requireUser('/change-password');
  const next = safeNext((await searchParams).next, '/');
  const t = await getTranslations('auth');
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t('change.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('change.intro')}</p>
      </div>
      <ChangePasswordForm next={next} />
    </>
  );
}
