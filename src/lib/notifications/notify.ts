import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * In-app notification for one or more users (bell + daily digest email). Written with the service role because the
 * sender usually cannot write rows for other people. `link` must be an app path like "/organisation/requests/123".
 */
export async function notify(n: {
  orgId: string | null;
  userIds: string[];
  kind: string;
  title: string;
  body?: string;
  link?: string;
}) {
  const ids = [...new Set(n.userIds)].filter(Boolean);
  if (!ids.length) return;
  if (n.link && !/^\/[^/]/.test(n.link)) throw new Error('notification link must be an app path');
  const { error } = await supabaseAdmin()
    .from('notifications')
    .insert(
      ids.map((user_id) => ({
        organization_id: n.orgId,
        user_id,
        kind: n.kind,
        title: n.title.slice(0, 200),
        body: n.body?.slice(0, 1000) ?? null,
        link: n.link ?? null,
      })),
    );
  if (error) console.error('[notify] insert failed', error.code);
}
