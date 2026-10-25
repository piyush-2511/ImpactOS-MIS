import 'server-only';
import { commitJob } from '@/lib/import/commit';
import { notify } from '@/lib/notifications/notify';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { inngest } from '../client';
import { withJobLog } from './log';

/** Commits large imports (over the inline limit). Re-checks that the requester still may import before writing. */
export const importCommit = inngest.createFunction(
  {
    id: 'import-commit',
    retries: 3,
    concurrency: { limit: 1, key: 'event.data.orgId' },
    triggers: [{ event: 'import/commit.requested' }],
  },
  async ({ event, step, runId, attempt }) => {
    const { jobId, orgId, userId } = event.data as { jobId: string; orgId: string; userId: string };
    const result = await step.run('commit', () =>
      withJobLog('import-commit', orgId, runId, attempt, async () => {
        const db = supabaseAdmin();
        const { data: member } = await db
          .from('organization_members')
          .select('id, status, member_roles(role:roles(grants_all, role_permissions(permission_key)))')
          .eq('organization_id', orgId)
          .eq('user_id', userId)
          .maybeSingle();
        const allowed =
          member?.status === 'active' &&
          member.member_roles.some(
            (mr) => mr.role?.grants_all || mr.role?.role_permissions.some((p) => p.permission_key === 'data.import'),
          );
        if (!allowed) throw new Error('requester may no longer import');
        return commitJob(db, jobId);
      }),
    );
    await step.run('notify', () =>
      notify({
        orgId,
        userIds: [userId],
        kind: 'import.done',
        title: `Import finished: ${result.inserted} added`,
        link: '/admin/option-lists',
      }),
    );
    return result;
  },
);
