import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/user';
import { hashInviteToken } from '@/lib/auth/invites';
import { InviteAccept } from '@/features/auth/components/InviteAccept';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.invite'))('title'), robots: { index: false } };
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations('auth');
  let invite: { organization_name: string; email: string; state: string } | undefined;
  if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
    const supabase = await supabaseServer();
    const { data } = await supabase.rpc('get_invitation', { p_token_hash: await hashInviteToken(token) });
    invite = data?.[0];
  }
  if (!invite || invite.state !== 'open') {
    const reason = !invite ? 'inviteInvalid' : invite.state === 'expired' ? 'inviteExpired' : invite.state === 'accepted' ? 'inviteUsed' : 'inviteInvalid';
    return (
      <>
        <h1 className="text-2xl font-bold">{t('invite.title')}</h1>
        <p role="alert" className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-fg">{t(`errors.${reason}`)}</p>
        <Link href="/login" className="text-sm">{t('actions.backToSignIn')}</Link>
      </>
    );
  }
  const user = await getCurrentUser();
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t('invite.heading', { org: invite.organization_name })}</h1>
        <p className="text-sm text-muted-foreground">{t('invite.intro', { email: invite.email })}</p>
      </div>
      <InviteAccept token={token} org={invite.organization_name} email={invite.email} signedInAs={user?.email ?? null} />
    </>
  );
}
