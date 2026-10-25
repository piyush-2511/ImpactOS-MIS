import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { safeNext } from '@/lib/auth/user';
import { ConsoleLoginForm } from '@/features/auth/components/ConsoleLoginForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth.console'))('title'), robots: { index: false, follow: false } };
}

export default async function ConsoleLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const sp = await searchParams;
  const t = await getTranslations('auth.console');
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-sm">
        <div className="bg-console-sidebar px-6 py-4 text-white">
          <div className="text-lg font-bold">ImpactOS</div>
          <div className="text-xs tracking-wide text-sidebar-muted">{t('badge')}</div>
        </div>
        <main id="main" className="flex flex-col gap-4 p-6">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('intro')}</p>
          {sp.expired && <p role="status" className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-fg">{t('expired')}</p>}
          <ConsoleLoginForm next={safeNext(sp.next, '/console')} />
        </main>
      </div>
    </div>
  );
}
