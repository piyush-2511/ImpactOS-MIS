import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth/user';
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.reset'))('title') };
}

/** Reached from the reset email (the callback exchanged the link for a short recovery session). */
export default async function ResetPasswordPage() {
  await requireUser('/forgot-password');
  const t = await getTranslations('auth');
  return (
    <>
      <h1 className="text-2xl font-bold">{t('reset.title')}</h1>
      <ChangePasswordForm mode="reset" />
    </>
  );
}
