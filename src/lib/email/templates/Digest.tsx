import { EmailButton, EmailLayout, type EmailLocale } from '../layout';

const COPY = {
  en: {
    subject: (n: number) => `${n} update${n === 1 ? '' : 's'} waiting in ImpactOS`,
    intro: 'Here is what happened since yesterday.',
    open: 'Open ImpactOS',
    footer: 'ImpactOS · Daily summary. Turn it off in My account → Notifications.',
  },
  hi: {
    subject: (n: number) => `ImpactOS में ${n} अपडेट आपका इंतज़ार कर रहे हैं`,
    intro: 'कल से अब तक यह हुआ।',
    open: 'ImpactOS खोलें',
    footer: 'ImpactOS · दैनिक सारांश। इसे मेरा खाता → सूचनाएँ से बंद करें।',
  },
} as const;

const moreLabel = (n: number) => `+${n}`;

export const digestSubject = (locale: EmailLocale, n: number) => COPY[locale].subject(n);

/** Daily digest of unread notifications (sent by the daily-digest job, 8:00 IST). */
export function DigestEmail({
  locale,
  items,
  appUrl,
  more,
}: {
  locale: EmailLocale;
  items: { title: string; body?: string | null; link?: string | null }[];
  appUrl: string;
  more: number;
}) {
  const c = COPY[locale];
  return (
    <EmailLayout locale={locale} preview={c.intro} footer={c.footer}>
      <p style={{ margin: '0 0 16px' }}>{c.intro}</p>
      {items.map((it, i) => (
        <div key={i} style={{ borderTop: '1px solid #E6ECF1', padding: '10px 0' }}>
          <a
            href={it.link ? `${appUrl}${it.link}` : appUrl}
            style={{ color: '#062746', fontWeight: 600, textDecoration: 'none' }}
          >
            {it.title}
          </a>
          {it.body ? <div style={{ color: '#44566A', fontSize: 14 }}>{it.body}</div> : null}
        </div>
      ))}
      {more > 0 ? <p style={{ color: '#44566A' }}>{moreLabel(more)}</p> : null}
      <p style={{ margin: '16px 0 0' }}>
        <EmailButton href={appUrl}>{c.open}</EmailButton>
      </p>
    </EmailLayout>
  );
}
