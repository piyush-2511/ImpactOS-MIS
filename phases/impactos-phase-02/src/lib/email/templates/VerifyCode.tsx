import { EmailButton, EmailLayout, type EmailLocale } from '../layout';

export type CodePurpose = 'signup' | 'email_change' | 'reauthentication' | 'recovery' | 'magiclink';

const COPY = {
  en: {
    subject: { signup: 'Your ImpactOS verification code', email_change: 'Confirm your new email', reauthentication: 'Your ImpactOS security code', recovery: 'Reset your ImpactOS password', magiclink: 'Your ImpactOS sign-in code' },
    intro: { signup: 'Use this code to verify your email and finish creating your account.', email_change: 'Use this code to confirm your new email address.', reauthentication: 'Use this code to confirm it is you.', recovery: 'Someone asked to reset the password for this account. Use the button below to choose a new password.', magiclink: 'Use this code to sign in.' },
    expires: 'The code expires in 1 hour.', button: 'Choose a new password',
    ignore: 'If you did not ask for this, ignore this email; nothing will change.', footer: 'ImpactOS · theimpactos.in · You received this because of an action on your ImpactOS account.',
  },
  hi: {
    subject: { signup: 'आपका ImpactOS सत्यापन कोड', email_change: 'अपना नया ईमेल पक्का करें', reauthentication: 'आपका ImpactOS सुरक्षा कोड', recovery: 'अपना ImpactOS पासवर्ड बदलें', magiclink: 'आपका ImpactOS साइन-इन कोड' },
    intro: { signup: 'अपना ईमेल सत्यापित करने और खाता बनाना पूरा करने के लिए यह कोड डालें।', email_change: 'अपना नया ईमेल पता पक्का करने के लिए यह कोड डालें।', reauthentication: 'यह आप ही हैं, यह पक्का करने के लिए यह कोड डालें।', recovery: 'इस खाते का पासवर्ड बदलने का अनुरोध किया गया है। नया पासवर्ड चुनने के लिए नीचे का बटन दबाएँ।', magiclink: 'साइन इन करने के लिए यह कोड डालें।' },
    expires: 'यह कोड 1 घंटे में समाप्त हो जाएगा।', button: 'नया पासवर्ड चुनें',
    ignore: 'अगर आपने यह अनुरोध नहीं किया, तो इस ईमेल को अनदेखा करें; कुछ नहीं बदलेगा।', footer: 'ImpactOS · theimpactos.in · यह ईमेल आपके ImpactOS खाते पर हुई कार्रवाई के कारण भेजा गया है।',
  },
} as const;

export function verifyCodeSubject(locale: EmailLocale, purpose: CodePurpose) {
  return COPY[locale].subject[purpose];
}

/** One template for auth codes and the password-reset link (sent through the Supabase email hook). */
export function VerifyCodeEmail({ locale, purpose, code, link }: { locale: EmailLocale; purpose: CodePurpose; code?: string; link?: string }) {
  const c = COPY[locale];
  return (
    <EmailLayout locale={locale} preview={c.intro[purpose]} footer={c.footer}>
      <p style={{ margin: '0 0 16px' }}>{c.intro[purpose]}</p>
      {code && (
        <p style={{ margin: '0 0 16px', fontFamily: "'IBM Plex Mono', Consolas, monospace", fontSize: 30, fontWeight: 700, letterSpacing: 6 }}>{code}</p>
      )}
      {link && (
        <p style={{ margin: '0 0 16px' }}>
          <EmailButton href={link}>{c.button}</EmailButton>
        </p>
      )}
      <p style={{ margin: '0 0 8px', color: '#44566A' }}>{c.expires}</p>
      <p style={{ margin: 0, color: '#44566A' }}>{c.ignore}</p>
    </EmailLayout>
  );
}
