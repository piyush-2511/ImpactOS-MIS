import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm';
import { formatDate } from '@/lib/i18n/format';
import { removeMfaFactorAction } from '../actions';

export async function SecurityPanel({ factors, mfaRequired, locale }: { factors: { id: string; name: string; createdAt: string }[]; mfaRequired: boolean; locale: 'en' | 'hi' }) {
  const t = await getTranslations('account.security');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-4">
        <CardTitle>{t('passwordTitle')}</CardTitle>
        <ChangePasswordForm next="/account?tab=security" />
      </Card>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t('mfaTitle')}</CardTitle>
          <Badge tone={factors.length ? 'ok' : mfaRequired ? 'warn' : 'neutral'}>{factors.length ? t('mfaOn') : t('mfaOff')}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{mfaRequired ? t('mfaRequired') : t('mfaOptional')}</p>
        {factors.map((f) => (
          <div key={f.id} className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
            <div className="flex-1">
              <div className="font-semibold">{f.name}</div>
              <div className="text-sm text-muted-foreground">{t('added', { date: formatDate(f.createdAt, locale) })}</div>
            </div>
            {(!mfaRequired || factors.length > 1) && (
              <form action={removeMfaFactorAction}>
                <input type="hidden" name="factorId" value={f.id} />
                <Button type="submit" variant="outline" size="sm">{t('remove')}</Button>
              </form>
            )}
          </div>
        ))}
        <Button asChild variant={factors.length ? 'outline' : 'default'}>
          <Link href="/mfa/setup?next=/account?tab=security">{factors.length ? t('addBackup') : t('enable')}</Link>
        </Button>
      </Card>
    </div>
  );
}
