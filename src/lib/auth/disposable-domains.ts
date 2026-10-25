/** Common throwaway email providers blocked at NGO sign-up. Extend from the console (phase 5) without a deploy. */
const DISPOSABLE = new Set([
  '10minutemail.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', 'mailinator.com', 'maildrop.cc',
  'tempmail.com', 'temp-mail.org', 'tempmail.net', 'throwawaymail.com', 'yopmail.com', 'yopmail.net', 'getnada.com',
  'dispostable.com', 'trashmail.com', 'fakeinbox.com', 'mintemail.com', 'mohmal.com', 'emailondeck.com', 'mailnesia.com',
  'moakt.com', 'tempail.com', 'burnermail.io', 'spamgourmet.com', 'mytemp.email', 'tempinbox.com', 'inboxkitten.com',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain) return false;
  return DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith(`.${d}`));
}
