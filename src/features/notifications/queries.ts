import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

/** The signed-in user's recent notifications and unread count (RLS: own rows only). */
export async function recentNotifications(limit = 15): Promise<{ items: NotificationItem[]; unread: number }> {
  const supabase = await supabaseServer();
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, title, body, link, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).is('read_at', null),
  ]);
  return {
    items: (data ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      link: n.link,
      read: !!n.read_at,
      createdAt: n.created_at,
    })),
    unread: count ?? 0,
  };
}
