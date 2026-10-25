import { EmailLayout, type EmailLocale } from '../layout';

const COPY = {
  en: {
    subject: (bg: boolean) =>
      bg ? 'ImpactOS used emergency access to your organisation' : 'You gave ImpactOS support access',
    body: (bg: boolean, until: string) =>
      bg
        ? `For an urgent issue, the ImpactOS team opened read-only access to your organisation until ${until}.`
        : `ImpactOS support can view (not change) your organisation’s records until ${until}.`,
    reason: 'Reason',
    log: 'Every page they view is listed in Admin → Support access, where you can also end access at any time.',
    footer: 'ImpactOS · Security notice',
  },
  hi: {
    subject: (bg: boolean) =>
      bg ? 'ImpactOS ने आपके संगठन तक आपातकालीन पहुँच ली' : 'आपने ImpactOS सपोर्ट को पहुँच दी',
    body: (bg: boolean, until: string) =>
      bg
        ? `एक ज़रूरी समस्या के लिए ImpactOS टीम ने ${until} तक आपके संगठन की केवल-पढ़ने वाली पहुँच खोली।`
        : `ImpactOS सपोर्ट ${until} तक आपके संगठन के रिकॉर्ड देख (बदल नहीं) सकता है।`,
    reason: 'कारण',
    log: 'उनके देखे हर पेज की सूची एडमिन → सपोर्ट एक्सेस में है, जहाँ आप कभी भी पहुँच बंद कर सकते हैं।',
    footer: 'ImpactOS · सुरक्षा सूचना',
  },
} as const;

export const supportAccessSubject = (l: EmailLocale, breakGlass: boolean) => COPY[l].subject(breakGlass);

export function SupportAccessGranted({
  locale,
  breakGlass,
  reason,
  until,
}: {
  locale: EmailLocale;
  breakGlass: boolean;
  reason: string;
  until: string;
}) {
  const c = COPY[locale];
  const when = new Date(until).toLocaleString(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <EmailLayout locale={locale} preview={c.subject(breakGlass)} footer={c.footer}>
      <p style={{ margin: '0 0 12px' }}>{c.body(breakGlass, when)}</p>
      <p style={{ margin: '0 0 12px' }}>
        <strong>{c.reason}:</strong> {reason}
      </p>
      <p style={{ margin: 0, color: '#44566A' }}>{c.log}</p>
    </EmailLayout>
  );
}
