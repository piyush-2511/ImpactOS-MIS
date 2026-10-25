import type { Metadata } from 'next';
import { CheckIcon } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { publicEnv } from '@/config/env';
import { cn } from '@/lib/utils';

const PLANS = ['starter', 'growth', 'enterprise'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('site.pricing');
  return { title: t('title') };
}

export default async function PricingPage() {
  const t = await getTranslations('site.pricing');
  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14">
      <header className="flex max-w-3xl flex-col gap-3">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const featured = p === 'growth';
          return (
            <Card key={p} className={cn('flex flex-col gap-4', featured && 'ring-2 ring-green')}>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{t(`plans.${p}.name`)}</CardTitle>
                {featured && <Badge tone="ok">{t('popular')}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{t(`plans.${p}.for`)}</p>
              <p className="flex items-baseline gap-2">
                {p === 'enterprise' && <span className="text-sm text-muted-foreground">{t('from')}</span>}
                <span className="font-mono text-3xl font-bold">{t(`plans.${p}.price`)}</span>
                <span className="text-sm text-muted-foreground">{t('perMonth')}</span>
              </p>
              <ul className="flex flex-col gap-2 text-sm">
                {(['f1', 'f2', 'f3', 'f4'] as const).map((f) => (
                  <li key={f} className="flex gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-ok-fg" aria-hidden />
                    {t(`plans.${p}.${f}`)}
                  </li>
                ))}
              </ul>
              <Button asChild variant={featured ? 'default' : 'outline'} className="mt-auto">
                <a href={p === 'enterprise' ? 'mailto:hello@theimpactos.in' : `${appUrl}/signup?plan=${p}`}>{p === 'enterprise' ? t('contact') : t('choose')}</a>
              </Button>
            </Card>
          );
        })}
      </div>
      <section aria-labelledby="faq" className="flex max-w-3xl flex-col gap-4">
        <h2 id="faq" className="text-xl font-bold">
          {t('faqTitle')}
        </h2>
        {(['1', '2'] as const).map((n) => (
          <div key={n}>
            <h3 className="font-semibold">{t(`faq.q${n}`)}</h3>
            <p className="text-muted-foreground">{t(`faq.a${n}`)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
