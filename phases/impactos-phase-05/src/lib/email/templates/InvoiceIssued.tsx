import { EmailButton, EmailLayout, type EmailLocale } from '../layout';

const COPY = {
  en: {
    subject: (n: string) => `ImpactOS invoice ${n}`,
    intro: (org: string, amount: string, due: string) => `The invoice for ${org} is ready: ${amount}, due on ${due}.`,
    how: 'Pay by UPI (scan the QR on the invoice) or bank transfer, then enter the UTR in ImpactOS → Admin → Billing.',
    fc: 'Please pay from domestic (non-FC) funds.',
    open: 'View and pay',
    footer: 'ImpactOS · Billing',
  },
  hi: {
    subject: (n: string) => `ImpactOS चालान ${n}`,
    intro: (org: string, amount: string, due: string) =>
      `${org} का चालान तैयार है: ${amount}, भुगतान की अंतिम तारीख ${due}।`,
    how: 'UPI से (चालान पर QR स्कैन करें) या बैंक ट्रांसफ़र से भुगतान करें, फिर ImpactOS → एडमिन → बिलिंग में UTR डालें।',
    fc: 'कृपया घरेलू (गैर-FC) निधि से भुगतान करें।',
    open: 'देखें और भुगतान करें',
    footer: 'ImpactOS · बिलिंग',
  },
} as const;

export const invoiceIssuedSubject = (l: EmailLocale, number: string) => COPY[l].subject(number);

export function InvoiceIssued({
  locale,
  org,
  amount,
  due,
  url,
}: {
  locale: EmailLocale;
  org: string;
  amount: string;
  due: string;
  url: string;
}) {
  const c = COPY[locale];
  return (
    <EmailLayout locale={locale} preview={c.intro(org, amount, due)} footer={c.footer}>
      <p style={{ margin: '0 0 12px' }}>{c.intro(org, amount, due)}</p>
      <p style={{ margin: '0 0 12px' }}>{c.how}</p>
      <p style={{ margin: '0 0 20px', color: '#7A4A00' }}>{c.fc}</p>
      <EmailButton href={url}>{c.open}</EmailButton>
    </EmailLayout>
  );
}
