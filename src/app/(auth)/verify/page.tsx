import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { safeNext } from '@/lib/auth/user';
import { VerifyCodeForm } from '@/features/auth/components/VerifyCodeForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.verify'))('title') };
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string; next?: string }> }) {
  const sp = await searchParams;
  const email = (sp.email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect('/signup');
  const t = await getTranslations('auth');
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t('verify.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('verify.intro', { email })}</p>
      </div>
      <VerifyCodeForm email={email} next={safeNext(sp.next, '/setup-org')} />
    </>
  );
}
