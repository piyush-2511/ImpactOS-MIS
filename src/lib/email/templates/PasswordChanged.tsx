import { EmailLayout, type EmailLocale } from '../layout';

const COPY = {
  en: { subject: 'Your ImpactOS password was changed', body: 'The password for your ImpactOS account was changed. You have been signed out on your other devices.', warn: 'If this was not you, reset your password now from the sign-in page and tell your organisation’s Secretary.', footer: 'ImpactOS · theimpactos.in · Security notice' },
  hi: { subject: 'आपका ImpactOS पासवर्ड बदला गया', body: 'आपके ImpactOS खाते का पासवर्ड बदल दिया गया है। आपके दूसरे डिवाइस से साइन आउट कर दिया गया है।', warn: 'अगर यह आपने नहीं किया, तो साइन-इन पेज से तुरंत पासवर्ड बदलें और अपने संगठन के सचिव को बताएँ।', footer: 'ImpactOS · theimpactos.in · सुरक्षा सूचना' },
} as const;

export const passwordChangedSubject = (locale: EmailLocale) => COPY[locale].subject;

export function PasswordChangedEmail({ locale }: { locale: EmailLocale }) {
  const c = COPY[locale];
  return (
    <EmailLayout locale={locale} preview={c.subject} footer={c.footer}>
      <p style={{ margin: '0 0 16px' }}>{c.body}</p>
      <p style={{ margin: 0, color: '#7A4A00' }}>{c.warn}</p>
    </EmailLayout>
  );
}
