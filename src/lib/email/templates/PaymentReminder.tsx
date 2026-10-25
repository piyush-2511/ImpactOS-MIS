import { EmailButton, EmailLayout, type EmailLocale } from '../layout';

type Stage = 'd-7' | 'd0' | 'd+7' | 'd+14';
const COPY = {
  en: {
    subject: {
      'd-7': 'Invoice due in 7 days',
      d0: 'Invoice due today',
      'd+7': 'Invoice overdue',
      'd+14': 'Last reminder: workspace becomes read-only tomorrow',
    },
    body: (n: string, amount: string, stage: Stage) =>
      stage === 'd+14'
        ? `Invoice ${n} (${amount}) is still unpaid. From tomorrow your workspace will be read-only: you can view and export everything and pay, but not add or change records.`
        : stage === 'd+7'
          ? `Invoice ${n} (${amount}) is overdue. Please pay soon to avoid read-only mode.`
          : `Invoice ${n} (${amount}) is due ${stage === 'd0' ? 'today' : 'in 7 days'}.`,
    paid: 'Already paid? Enter the UTR in Admin → Billing so we can confirm it.',
    open: 'Pay now',
    footer: 'ImpactOS · Billing. Your data is never deleted for late payment.',
  },
  hi: {
    subject: {
      'd-7': 'चालान 7 दिन में देय',
      d0: 'चालान आज देय',
      'd+7': 'चालान की तारीख निकल गई',
      'd+14': 'अंतिम याद: कल से वर्कस्पेस केवल-पढ़ने योग्य होगा',
    },
    body: (n: string, amount: string, stage: Stage) =>
      stage === 'd+14'
        ? `चालान ${n} (${amount}) अभी भी बकाया है। कल से आपका वर्कस्पेस केवल-पढ़ने योग्य होगा: आप सब देख, निर्यात और भुगतान कर सकेंगे, पर नए रिकॉर्ड जोड़ या बदल नहीं सकेंगे।`
        : stage === 'd+7'
          ? `चालान ${n} (${amount}) की तारीख निकल गई है। केवल-पढ़ने वाले मोड से बचने के लिए जल्दी भुगतान करें।`
          : `चालान ${n} (${amount}) ${stage === 'd0' ? 'आज' : '7 दिन में'} देय है।`,
    paid: 'भुगतान कर दिया? एडमिन → बिलिंग में UTR डालें ताकि हम पुष्टि कर सकें।',
    open: 'अभी भुगतान करें',
    footer: 'ImpactOS · बिलिंग। देर से भुगतान पर आपका डेटा कभी नहीं हटाया जाता।',
  },
} as const;

export const reminderSubject = (l: EmailLocale, stage: Stage) => COPY[l].subject[stage];

export function PaymentReminder({
  locale,
  number,
  amount,
  stage,
  url,
}: {
  locale: EmailLocale;
  number: string;
  amount: string;
  stage: Stage;
  url: string;
}) {
  const c = COPY[locale];
  return (
    <EmailLayout locale={locale} preview={c.subject[stage]} footer={c.footer}>
      <p style={{ margin: '0 0 12px' }}>{c.body(number, amount, stage)}</p>
      <p style={{ margin: '0 0 20px', color: '#44566A' }}>{c.paid}</p>
      <EmailButton href={url}>{c.open}</EmailButton>
    </EmailLayout>
  );
}
