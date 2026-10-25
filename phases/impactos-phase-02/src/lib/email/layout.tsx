import type { ReactNode } from 'react';

export type EmailLocale = 'en' | 'hi';

/** Table-based, inline-styled layout that renders in Gmail, Outlook and phone mail apps. */
export function EmailLayout({ locale, preview, children, footer }: { locale: EmailLocale; preview: string; children: ReactNode; footer: string }) {
  const font = locale === 'hi' ? "'Noto Sans Devanagari', 'Mangal', Arial, sans-serif" : "'IBM Plex Sans', Arial, sans-serif";
  return (
    <html lang={locale}>
      {/* Email document head, not a Next.js page. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#E1E7ED', fontFamily: font, color: '#062746' }}>
        <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden' }}>{preview}</div>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ background: '#E1E7ED', padding: '24px 12px' }}>
          <tbody>
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 560, background: '#FFFFFF', borderRadius: 12, overflow: 'hidden' }}>
                  <tbody>
                    <tr>
                      <td style={{ background: '#062746', padding: '18px 24px', color: '#FFFFFF', fontSize: 18, fontWeight: 700 }}>ImpactOS</td>
                    </tr>
                    <tr>
                      <td style={{ padding: 24, fontSize: 15, lineHeight: '24px' }}>{children}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '16px 24px', background: '#F1F4F7', fontSize: 12, lineHeight: '18px', color: '#44566A' }}>{footer}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} style={{ display: 'inline-block', background: '#062746', color: '#FFFFFF', padding: '12px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
      {children}
    </a>
  );
}
