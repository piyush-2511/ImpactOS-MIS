import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function listAnnouncements() {
  const { data } = await supabaseAdmin()
    .from('announcements')
    .select('*')
    .order('starts_at', { ascending: false })
    .limit(50);
  const now = Date.now();
  return (data ?? []).map((a) => ({
    ...a,
    live: new Date(a.starts_at).getTime() <= now && new Date(a.ends_at).getTime() > now,
  }));
}
