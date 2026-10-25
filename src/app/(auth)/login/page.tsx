import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCurrentUser, safeNext } from '@/lib/auth/user';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { UsernameLoginForm } from '@/features/auth/components/UsernameLoginForm';
import { FormError } from '@/features/auth/components/Field';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.login'))('title') };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; org?: string; error?: string; tab?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, '/');
  if (await getCurrentUser()) redirect(next);
  const t = await getTranslations('auth');
  const org = sp.org && /^[a-z0-9-]{1,63}$/.test(sp.org) ? sp.org : undefined;
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t('login.title')}</h1>
        {org && <p className="text-sm text-muted-foreground">{t('login.forOrg', { org })}</p>}
      </div>
      <FormError code={sp.error === 'oauth' ? 'oauthFailed' : undefined} />
      <Tabs defaultValue={sp.tab === 'username' || org ? 'username' : 'email'}>
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="email">{t('login.tabEmail')}</TabsTrigger>
          <TabsTrigger value="username">{t('login.tabUsername')}</TabsTrigger>
        </TabsList>
        <TabsContent value="email">
          <LoginForm next={next} />
        </TabsContent>
        <TabsContent value="username">
          <UsernameLoginForm orgCode={org} next={next} />
        </TabsContent>
      </Tabs>
      <p className="text-center text-sm">
        {t('login.newOrg')} <Link href="/signup">{t('actions.createAccount')}</Link>
      </p>
    </>
  );
}
