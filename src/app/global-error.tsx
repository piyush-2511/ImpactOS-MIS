'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/** Last-resort error page when the root layout itself fails, so messages may be unavailable: bilingual static text. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32, color: '#062746', background: '#E1E7ED' }}>
        {/* eslint-disable react/jsx-no-literals */}
        <h1>Something went wrong / कुछ गड़बड़ हो गई</h1>
        <p>Please reload the page. The ImpactOS team has been notified.</p>
        <p>कृपया पेज फिर से लोड करें। ImpactOS टीम को सूचना भेज दी गई है।</p>
        {/* eslint-enable react/jsx-no-literals */}
        {error.digest && <code>{error.digest}</code>}
      </body>
    </html>
  );
}
