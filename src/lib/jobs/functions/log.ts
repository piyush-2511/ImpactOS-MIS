import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Wraps a job body with jobs_log rows (started → succeeded/failed) so admins can see background work. */
export async function withJobLog<T>(
  job: string,
  orgId: string | null,
  runId: string,
  attempt: number,
  body: () => Promise<T>,
): Promise<T> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('jobs_log')
    .insert({ organization_id: orgId, job_name: job, run_id: runId, status: 'started', attempt: attempt + 1 })
    .select('id')
    .single();
  try {
    const out = await body();
    if (data)
      await db
        .from('jobs_log')
        .update({ status: 'succeeded', finished_at: new Date().toISOString() })
        .eq('id', data.id);
    return out;
  } catch (e) {
    if (data)
      await db
        .from('jobs_log')
        .update({ status: 'failed', error: (e as Error).message.slice(0, 500), finished_at: new Date().toISOString() })
        .eq('id', data.id);
    throw e;
  }
}
