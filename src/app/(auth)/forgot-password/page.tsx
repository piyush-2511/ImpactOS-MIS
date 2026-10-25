import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.forgot'))('title') };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth');
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t('forgot.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('forgot.intro')}</p>
      </div>
      <ForgotPasswordForm />
      <p className="rounded-lg bg-secondary px-3 py-2 text-sm">{t('username.forgot')}</p>
      <Link href="/login" className="self-center text-sm">{t('actions.backToSignIn')}</Link>
    </>
  );
}
