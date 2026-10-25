'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/** Light, dark or system theme. Writes data-theme on <html>, which globals.css reads. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
