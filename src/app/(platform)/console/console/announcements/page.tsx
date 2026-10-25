import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requirePlatformStaff } from '@/lib/platform/staff';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { listAnnouncements } from '@/features/console-announcements/queries';
import { AnnouncementEditor } from '@/features/console-announcements/components/AnnouncementEditor';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('console.announcements'))('title') };
}

/** Default form window: from now to one week ahead (IST, datetime-local format). */
function defaultWindow() {
  const now = new Date();
  return { start: local(now), end: local(new Date(now.getTime() + 7 * 86_400_000)) };
}

const local = (d: Date) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })
    .format(d)
    .replace(' ', 'T');

export default async function AnnouncementsPage() {
  await requirePlatformStaff('/console/announcements');
  const [rows, { data: plans }, t] = await Promise.all([
    listAnnouncements(),
    supabaseAdmin().from('plans').select('key, name').order('sort_order'),
    getTranslations('console.announcements'),
  ]);
  const win = defaultWindow();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <AnnouncementEditor
        rows={rows}
        plans={plans ?? []}
        nowLocal={win.start}
        weekLocal={win.end}
        when={Object.fromEntries(rows.map((a) => [a.id, `${fmt(a.starts_at)} – ${fmt(a.ends_at)}`]))}
      />
    </>
  );
}
