import { EmailButton, EmailLayout, type EmailLocale } from '../layout';

const COPY = {
  en: { subject: (org: string) => `You are invited to ${org} on ImpactOS`, body: (who: string, org: string) => `${who} invited you to join ${org} on ImpactOS, where the team manages programs, donations and reports.`, button: 'Accept invitation', expires: 'This invitation expires in 7 days and works once.', footer: 'ImpactOS · theimpactos.in · If you were not expecting this, you can ignore it.' },
  hi: { subject: (org: string) => `ImpactOS पर ${org} से जुड़ने का निमंत्रण`, body: (who: string, org: string) => `${who} ने आपको ImpactOS पर ${org} से जुड़ने के लिए आमंत्रित किया है, जहाँ टीम कार्यक्रम, दान और रिपोर्ट संभालती है।`, button: 'निमंत्रण स्वीकार करें', expires: 'यह निमंत्रण 7 दिन में समाप्त हो जाएगा और एक ही बार काम करेगा।', footer: 'ImpactOS · theimpactos.in · अगर आप इसकी उम्मीद नहीं कर रहे थे, तो इसे अनदेखा करें।' },
} as const;

export const inviteSubject = (locale: EmailLocale, org: string) => COPY[locale].subject(org);

export function InviteEmail({ locale, inviter, org, url }: { locale: EmailLocale; inviter: string; org: string; url: string }) {
  const c = COPY[locale];
  return (
    <EmailLayout locale={locale} preview={c.subject(org)} footer={c.footer}>
      <p style={{ margin: '0 0 20px' }}>{c.body(inviter, org)}</p>
      <p style={{ margin: '0 0 20px' }}>
        <EmailButton href={url}>{c.button}</EmailButton>
      </p>
      <p style={{ margin: 0, color: '#44566A' }}>{c.expires}</p>
    </EmailLayout>
  );
}
