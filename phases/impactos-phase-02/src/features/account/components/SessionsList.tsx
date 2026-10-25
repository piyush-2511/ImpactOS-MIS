import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/i18n/format';
import { signOutDevicesAction } from '../actions';

type Row = { id: number; event: string; ip: string | null; user_agent: string | null; created_at: string };

function device(ua: string | null): string {
  if (!ua) return '—';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

/** Supabase does not expose a list of live sessions, so this shows recent sign-in activity plus sign-out controls. */
export async function SessionsList({ rows, locale }: { rows: Row[]; locale: 'en' | 'hi' }) {
  const t = await getTranslations('account.sessions');
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <CardTitle>{t('signOutTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('signOutIntro')}</p>
        <div className="flex flex-wrap gap-2">
          <form action={signOutDevicesAction}>
            <input type="hidden" name="scope" value="others" />
            <Button type="submit" variant="outline">{t('signOutOthers')}</Button>
          </form>
          <form action={signOutDevicesAction}>
            <input type="hidden" name="scope" value="global" />
            <Button type="submit" variant="destructive">{t('signOutAll')}</Button>
          </form>
        </div>
      </Card>
      <Card className="flex flex-col gap-3 p-0">
        <CardTitle className="px-5 pt-5">{t('activityTitle')}</CardTitle>
        {rows.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('when')}</TableHead>
                <TableHead>{t('what')}</TableHead>
                <TableHead>{t('device')}</TableHead>
                <TableHead>{t('ip')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(r.created_at, locale)} {new Date(r.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    <Badge tone={r.event === 'sign_in_failed' ? 'bad' : 'neutral'}>{t(`events.${r.event}`)}</Badge>
                  </TableCell>
                  <TableCell>{device(r.user_agent)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ip ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
