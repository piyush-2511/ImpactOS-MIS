import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitch } from '@/components/shell/LanguageSwitch';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Button } from '@/components/ui/button';
import { publicEnv } from '@/config/env';

/** theimpactos.in marketing site. Sign-in links go to the workspace host (app.theimpactos.in). */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('site');
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" aria-label={t('header.home')} className="flex items-center gap-2.5 text-foreground no-underline">
            <span className="grid size-8 place-items-center rounded-lg bg-green font-bold text-navy" aria-hidden>
              i
            </span>
            <span className="text-lg font-bold">ImpactOS</span>
          </Link>
          <nav className="ml-auto flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/pricing">{t('header.pricing')}</Link>
            </Button>
            <Button asChild variant="outline">
              <a href={`${appUrl}/login`}>{t('header.signIn')}</a>
            </Button>
            <Button asChild>
              <a href={`${appUrl}/signup`}>{t('header.startTrial')}</a>
            </Button>
            <LanguageSwitch />
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-6 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">ImpactOS</span>
          <span>{t('footer.tagline')}</span>
          <span className="ml-auto flex gap-4">
            <Link href="/pricing">{t('footer.pricing')}</Link>
          </span>
          <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>
        </div>
      </footer>
    </div>
  );
}
