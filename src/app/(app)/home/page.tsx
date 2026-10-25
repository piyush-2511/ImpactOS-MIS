import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CheckCircle2Icon, CircleIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { redirect } from 'next/navigation';
import { getProfile, requireUser } from '@/lib/auth/user';
import { getActiveOrg } from '@/lib/org/active-org';
import { formatDate } from '@/lib/i18n/format';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('account.home'))('title') };
}

/**
 * Home (served at "/" on the app host). Phase 2 shows the onboarding checklist; the full role-based dashboard
 * replaces this page in phase 11.
 */
export default async function HomePage() {
  const t = await getTranslations('account.home');
  const ta = await getTranslations('account');
  const locale = (await getLocale()) === 'hi' ? 'hi' : 'en';
  // Layouts and pages render in parallel in the App Router: never rely on the layout's guard alone.
  await requireUser('/');
  const profile = await getProfile();
  const active = await getActiveOrg();
  if (!active) redirect('/setup-org');
  const firstName = (profile?.full_name ?? '').split(/\s+/)[0] || '';
  const steps = [
    { key: 'createOrg', done: true },
    { key: 'secureAccount', done: false },
    { key: 'inviteTeam', done: false },
    { key: 'governance', done: false },
    { key: 'firstProgram', done: false },
  ] as const;
  return (
    <>
      <header>
        <h1 className="text-2xl font-bold md:text-[28px]">{firstName ? t('greeting', { name: firstName }) : t('greetingNoName')}</h1>
        <p className="text-muted-foreground">
          {ta(`roles.${active.role}`)} · {formatDate(new Date(), locale)}
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="flex flex-col gap-3">
          <CardTitle>{t('checklistTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('checklistIntro')}</p>
          <ol className="flex flex-col">
            {steps.map((s) => (
              <li key={s.key} className="flex items-start gap-3 border-t border-border/60 py-3 first:border-t-0">
                {s.done ? <CheckCircle2Icon className="mt-0.5 size-5 text-ok-fg" aria-hidden /> : <CircleIcon className="mt-0.5 size-5 text-muted-foreground" aria-hidden />}
                <div className="flex-1">
                  <div className="font-semibold">{t(`steps.${s.key}.title`)}</div>
                  <div className="text-sm text-muted-foreground">{t(`steps.${s.key}.body`)}</div>
                </div>
                <Badge tone={s.done ? 'ok' : 'neutral'}>{s.done ? t('done') : t('comingUp')}</Badge>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="flex flex-col gap-2">
          <CardTitle>{active.organization.name}</CardTitle>
          <p className="font-mono text-sm text-muted-foreground">{active.organization.slug}</p>
          <p className="text-sm">{t('orgNote')}</p>
          {active.organization.fcra_registered && <Badge tone="info" className="self-start">{t('fcra')}</Badge>}
        </Card>
      </div>
    </>
  );
}
