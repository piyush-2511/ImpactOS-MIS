'use client';

import { useTranslations } from 'next-intl';
import { PrinterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SlipData = { fullName: string; orgCode: string; username: string; password: string; loginUrl: string };

/** The slip is always printed in both languages, whatever the screen language is. */
const HI = {
  title: 'साइन-इन पर्ची',
  name: 'नाम',
  orgCode: 'संगठन कोड',
  username: 'यूज़रनेम',
  password: 'पासवर्ड',
  where: 'कहाँ',
  note: 'पहली बार साइन इन करते समय नया पासवर्ड चुनें। यह पर्ची किसी को न दिखाएँ।',
} as const;
const PRINT_CSS =
  '@media print { body * { visibility: hidden !important; } .ios-slip, .ios-slip * { visibility: visible !important; } .ios-slip { position: absolute; inset: 0 auto auto 0; width: 100%; } }';

/**
 * One-time login slip for username accounts, in English and Hindi. The password is shown only here; ImpactOS never
 * stores or emails it. Printing hides everything except the slip.
 */
export function PrintableSlip({ data }: { data: SlipData }) {
  const t = useTranslations('admin.slip');
  const rows: [string, string, string][] = [
    [t('name'), HI.name, data.fullName],
    [t('orgCode'), HI.orgCode, data.orgCode],
    [t('username'), HI.username, data.username],
    [t('password'), HI.password, data.password],
    [t('where'), HI.where, data.loginUrl],
  ];
  return (
    <div className="flex flex-col gap-3">
      <style>{PRINT_CSS}</style>
      <div className="ios-slip rounded-xl border-2 border-dashed border-border p-4">
        <div className="mb-2 font-bold">
          {t('title')} / <span lang="hi">{HI.title}</span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([en, hi, v]) => (
            <div key={en} className="contents">
              <dt className="text-muted-foreground">
                {en} / <span lang="hi">{hi}</span>
              </dt>
              <dd className="font-mono font-semibold break-all">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          {t('note')} / <span lang="hi">{HI.note}</span>
        </p>
      </div>
      <p className="text-sm text-warn-fg">{t('onlyOnce')}</p>
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <PrinterIcon aria-hidden /> {t('print')}
      </Button>
    </div>
  );
}
