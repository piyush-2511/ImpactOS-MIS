import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getProfile, requireUser } from '@/lib/auth/user';
import { roleNeedsMfa } from '@/lib/auth/aal';
import { getActiveOrg } from '@/lib/org/active-org';
import { ProfileForm } from '@/features/account/components/ProfileForm';
import { SecurityPanel } from '@/features/account/components/SecurityPanel';
import { SessionsList } from '@/features/account/components/SessionsList';
import { mfaFactors, recentSignIns } from '@/features/account/queries';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('account'))('title') };
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  // Layouts and pages render in parallel: guard here too.
  const user = await requireUser('/account');
  const [profile, active, factors, signIns, t, rawLocale] = await Promise.all([getProfile(), getActiveOrg(), mfaFactors(), recentSignIns(), getTranslations('account'), getLocale()]);
  const locale = rawLocale === 'hi' ? 'hi' : 'en';
  const tab = ['profile', 'security', 'sessions'].includes((await searchParams).tab ?? '') ? (await searchParams).tab! : 'profile';
  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="profile">{t('tabs.profile')}</TabsTrigger>
          <TabsTrigger value="security">{t('tabs.security')}</TabsTrigger>
          <TabsTrigger value="sessions">{t('tabs.sessions')}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileForm fullName={profile?.full_name ?? ''} email={user.email ?? ''} locale={profile?.locale ?? 'en'} isUsernameAccount={active?.kind === 'username'} />
        </TabsContent>
        <TabsContent value="security">
          <SecurityPanel factors={factors} mfaRequired={roleNeedsMfa(active?.role)} locale={locale} />
        </TabsContent>
        <TabsContent value="sessions">
          <SessionsList rows={signIns} locale={locale} />
        </TabsContent>
      </Tabs>
    </>
  );
}
