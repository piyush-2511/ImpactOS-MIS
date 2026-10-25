import { EmailLayout, type EmailLocale } from '../layout';

const COPY = {
  en: { subject: 'New sign-in to your ImpactOS account', body: 'Your account was just used to sign in from a device we have not seen before.', when: 'When', device: 'Device', warn: 'If this was you, no action is needed. If not, change your password and sign out of all devices from Account → Security.', footer: 'ImpactOS · theimpactos.in · Security notice' },
  hi: { subject: 'आपके ImpactOS खाते में नया साइन-इन', body: 'आपके खाते से अभी एक ऐसे डिवाइस से साइन इन किया गया जो पहले नहीं देखा गया।', when: 'समय', device: 'डिवाइस', warn: 'अगर यह आप थे, तो कुछ करने की ज़रूरत नहीं। अगर नहीं, तो खाता → सुरक्षा से पासवर्ड बदलें और सभी डिवाइस से साइन आउट करें।', footer: 'ImpactOS · theimpactos.in · सुरक्षा सूचना' },
} as const;

export const newDeviceSubject = (locale: EmailLocale) => COPY[locale].subject;

export function NewDeviceEmail({ locale, when, device }: { locale: EmailLocale; when: string; device: string }) {
  const c = COPY[locale];
  return (
    <EmailLayout locale={locale} preview={c.subject} footer={c.footer}>
      <p style={{ margin: '0 0 16px' }}>{c.body}</p>
      <p style={{ margin: '0 0 4px' }}>
        <strong>{c.when}:</strong> {when}
      </p>
      <p style={{ margin: '0 0 16px' }}>
        <strong>{c.device}:</strong> {device}
      </p>
      <p style={{ margin: 0, color: '#7A4A00' }}>{c.warn}</p>
    </EmailLayout>
  );
}
