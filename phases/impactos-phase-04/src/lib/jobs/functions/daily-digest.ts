import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isSyntheticEmail } from '@/lib/auth/username';
import { inngest } from '../client';
import { withJobLog } from './log';

const MAX_ITEMS = 10;

/** 08:00 IST every day: email each user a summary of unread notifications they have not been emailed about. */
export const dailyDigest = inngest.createFunction(
  { id: 'daily-digest', retries: 2, triggers: [{ cron: 'TZ=Asia/Kolkata 0 8 * * *' }] },
  async ({ step, runId, attempt }) => {
    const users = await step.run('collect', () =>
      withJobLog('daily-digest', null, runId, attempt, async () => {
        const db = supabaseAdmin();
        const since = new Date(Date.now() - 7 * 86400_000).toISOString();
        const { data } = await db
          .from('notifications')
          .select('id, user_id, title, body, link')
          .is('read_at', null)
          .is('emailed_at', null)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(5000);
        const byUser = new Map<string, { id: string; title: string; body: string | null; link: string | null }[]>();
        for (const n of data ?? []) byUser.set(n.user_id, [...(byUser.get(n.user_id) ?? []), n]);
        return [...byUser.entries()].map(([userId, items]) => ({ userId, items }));
      }),
    );
    let sent = 0;
    for (const u of users) {
      sent += await step.run(`digest-${u.userId}`, async () => {
        const db = supabaseAdmin();
        const [{ data: prefs }, { data: profile }] = await Promise.all([
          db.from('notification_prefs').select('digest_enabled, email_enabled').eq('user_id', u.userId).maybeSingle(),
          db.from('profiles').select('email, locale').eq('id', u.userId).maybeSingle(),
        ]);
        if (prefs && (!prefs.digest_enabled || !prefs.email_enabled)) return 0;
        if (!profile?.email || isSyntheticEmail(profile.email)) return 0;
        await inngest.send({
          name: 'email/send.requested',
          data: {
            to: profile.email,
            template: 'digest',
            locale: profile.locale,
            props: {
              items: u.items.slice(0, MAX_ITEMS).map(({ title, body, link }) => ({ title, body, link })),
              appUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
              more: Math.max(0, u.items.length - MAX_ITEMS),
            },
          },
        });
        await db
          .from('notifications')
          .update({ emailed_at: new Date().toISOString() })
          .in(
            'id',
            u.items.map((i) => i.id),
          );
        return 1;
      });
    }
    return { users: users.length, sent };
  },
);
