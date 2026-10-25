import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { publicEnv } from '@/config/env';

const FEATURES = ['program', 'media', 'receipts', 'compliance', 'governance', 'hindi'] as const;

export default async function HomePage() {
  const t = await getTranslations('site');
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
  return (
    <>
      <section className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 md:py-24">
          <h1 className="max-w-3xl text-3xl font-bold leading-tight md:text-5xl">{t('hero.title')}</h1>
          <p className="max-w-2xl text-lg text-[#C9D6E3]">{t('hero.body')}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-green text-navy hover:brightness-105">
              <a href={`${appUrl}/signup`}>{t('hero.primary')}</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-[#3B5875] bg-transparent text-white hover:bg-white/10">
              <Link href="/pricing">{t('hero.secondary')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="features-title">
        <h2 id="features-title" className="mb-6 text-2xl font-bold">
          {t('features.title')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((k) => (
            <Card key={k} className="flex flex-col gap-2">
              <CardTitle>{t(`features.items.${k}.title`)}</CardTitle>
              <p className="text-muted-foreground">{t(`features.items.${k}.body`)}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <Card className="flex flex-col gap-2 bg-accent">
          <CardTitle>{t('trust.title')}</CardTitle>
          <p className="max-w-3xl">{t('trust.body')}</p>
        </Card>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 pb-20">
        <h2 className="text-2xl font-bold">{t('cta.title')}</h2>
        <p className="text-muted-foreground">{t('cta.body')}</p>
        <Button asChild size="lg">
          <a href={`${appUrl}/signup`}>{t('cta.button')}</a>
        </Button>
      </section>
    </>
  );
}
