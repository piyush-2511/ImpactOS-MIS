'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { endAnnouncementAction, saveAnnouncementAction } from '../actions';

type Row = {
  id: string;
  title_en: string;
  title_hi: string | null;
  tone: 'info' | 'warn';
  plan_key: string | null;
  starts_at: string;
  ends_at: string;
  live: boolean;
};

export function AnnouncementEditor({
  rows,
  plans,
  when,
  nowLocal,
  weekLocal,
}: {
  rows: Row[];
  plans: { key: string; name: string }[];
  when: Record<string, string>;
  nowLocal: string;
  weekLocal: string;
}) {
  const t = useTranslations('console.announcements');
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <CardTitle>{t('new')}</CardTitle>
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            start(async () => {
              const r = await saveAnnouncementAction({
                titleEn: fd.get('titleEn'),
                titleHi: fd.get('titleHi'),
                bodyEn: fd.get('bodyEn'),
                bodyHi: fd.get('bodyHi'),
                tone: fd.get('tone'),
                planKey: fd.get('plan'),
                startsAt: fd.get('starts'),
                endsAt: fd.get('ends'),
              });
              if (!r.ok) return void toast.error(t('failed'));
              toast.success(t('saved'));
              router.refresh();
            })
          }
        >
          <Label className="flex flex-col items-start gap-1">
            {t('titleEn')}
            <Input name="titleEn" required maxLength={150} />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('titleHi')}
            <Input name="titleHi" lang="hi" maxLength={150} />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('bodyEn')}
            <Input name="bodyEn" maxLength={600} />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('bodyHi')}
            <Input name="bodyHi" lang="hi" maxLength={600} />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('tone')}
            <select name="tone" className="min-h-11 w-full rounded-lg border border-input bg-card px-2 font-normal">
              <option value="info">{t('info')}</option>
              <option value="warn">{t('warn')}</option>
            </select>
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('audience')}
            <select name="plan" className="min-h-11 w-full rounded-lg border border-input bg-card px-2 font-normal">
              <option value="">{t('all')}</option>
              {plans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('starts')}
            <Input name="starts" type="datetime-local" defaultValue={nowLocal} required />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('ends')}
            <Input name="ends" type="datetime-local" defaultValue={weekLocal} required />
          </Label>
          <Button type="submit" className="sm:col-span-2 sm:justify-self-start" disabled={pending}>
            {t('publish')}
          </Button>
        </form>
      </Card>
      <ul className="flex flex-col gap-2">
        {rows.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-4 shadow-sm">
            <Badge tone={a.live ? 'ok' : 'neutral'}>{a.live ? t('live') : t('notLive')}</Badge>
            <Badge tone={a.tone === 'warn' ? 'warn' : 'info'}>{t(a.tone)}</Badge>
            <span className="flex-1 font-semibold">
              {a.title_en}
              {a.title_hi && (
                <span lang="hi" className="font-normal text-muted-foreground">
                  {' '}
                  · {a.title_hi}
                </span>
              )}
            </span>
            <span className="text-sm text-muted-foreground">{when[a.id]}</span>
            {a.live && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await endAnnouncementAction({ id: a.id });
                    if (r.ok) router.refresh();
                  })
                }
              >
                {t('end')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
