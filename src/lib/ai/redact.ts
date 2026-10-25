/**
 * Removes personal identifiers before text is sent to an AI provider (hard rule: AI never receives raw PII).
 * Order matters: longer, more specific patterns first. Returns the redacted text and what was removed (counts only).
 */
const RULES: [name: string, re: RegExp, token: string][] = [
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL]'],
  ['aadhaar', /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[AADHAAR]'],
  ['pan', /\b[A-Z]{5}\d{4}[A-Z]\b/g, '[PAN]'],
  ['ifsc', /\b[A-Z]{4}0[A-Z0-9]{6}\b/g, '[IFSC]'],
  ['phone', /(?<!\d)(?:\+91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g, '[PHONE]'],
  ['account', /\b\d{9,18}\b/g, '[ACCOUNT]'],
  ['upi', /\b[\w.-]{2,}@(?:ok\w+|ybl|ibl|axl|upi|paytm|apl|sbi|icici|hdfcbank|axisbank|kotak)\b/gi, '[UPI]'],
];

export type Redaction = { text: string; removed: Record<string, number> };

export function redactPII(input: string, extraNames: string[] = []): Redaction {
  let text = input;
  const removed: Record<string, number> = {};
  for (const [name, re, token] of RULES) {
    text = text.replace(re, () => {
      removed[name] = (removed[name] ?? 0) + 1;
      return token;
    });
  }
  for (const n of extraNames.filter((x) => x.trim().length >= 3)) {
    const re = new RegExp(n.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    text = text.replace(re, () => {
      removed.name = (removed.name ?? 0) + 1;
      return '[NAME]';
    });
  }
  return { text, removed };
}
