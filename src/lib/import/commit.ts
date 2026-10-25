import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { ValidRow } from './validate';

type Db = SupabaseClient<Database>;
export const UNDO_HOURS = 24;
export const INLINE_COMMIT_LIMIT = 2000;

export type ImportContext = { orgId: string; jobId: string; context: Record<string, string> };
/** Shape of import_jobs.rows: raw parsed rows until validation, validated rows until commit, then context only. */
export type ImportPayload = { raw?: Record<string, string>[]; valid?: ValidRow[]; context: Record<string, string> };
export type CommitResult = { inserted: number; skipped: number };

/**
 * Per-entity importers. Imports only ADD records: rows whose unique key already exists are skipped (idempotent,
 * so re-running a file is safe), and every inserted row carries import_batch_id = job id for undo within 24 hours.
 */
type Importer = {
  commit(db: Db, rows: ValidRow[], ctx: ImportContext): Promise<CommitResult>;
  undo(db: Db, ctx: ImportContext): Promise<number>;
};

const IMPORTERS: Record<string, Importer> = {
  lookup_values: {
    async commit(db, rows, ctx) {
      const list = ctx.context.list_key;
      if (!list) throw new Error('list_key missing');
      const { data: existing } = await db
        .from('lookup_values')
        .select('value_key')
        .eq('organization_id', ctx.orgId)
        .eq('list_key', list);
      const have = new Set((existing ?? []).map((r) => r.value_key));
      const fresh = rows.filter((r) => !have.has(String(r.values.value_key)));
      for (let i = 0; i < fresh.length; i += 500) {
        const chunk = fresh.slice(i, i + 500).map((r) => ({
          organization_id: ctx.orgId,
          list_key: list,
          value_key: String(r.values.value_key),
          label_en: String(r.values.label_en),
          label_hi: (r.values.label_hi as string | undefined) ?? null,
          sort_order: (r.values.sort_order as number | undefined) ?? 0,
          active: (r.values.active as boolean | undefined) ?? true,
          import_batch_id: ctx.jobId,
        }));
        const { error } = await db.from('lookup_values').insert(chunk);
        if (error) throw error;
      }
      return { inserted: fresh.length, skipped: rows.length - fresh.length };
    },
    async undo(db, ctx) {
      const { data, error } = await db
        .from('lookup_values')
        .delete()
        .eq('organization_id', ctx.orgId)
        .eq('import_batch_id', ctx.jobId)
        .select('id');
      if (error) throw error;
      return data?.length ?? 0;
    },
  },
};

export const canImport = (entity: string) => entity in IMPORTERS;

/** Commit a validated job. `db` is the user's client inline (RLS applies) or the service client inside the job. */
export async function commitJob(db: Db, jobId: string): Promise<CommitResult> {
  const { data: job, error } = await db.from('import_jobs').select('*').eq('id', jobId).single();
  if (error || !job) throw error ?? new Error('job not found');
  if (job.status !== 'validated' && job.status !== 'committing') throw new Error(`job is ${job.status}`);
  const importer = IMPORTERS[job.entity];
  if (!importer) throw new Error(`no importer for ${job.entity}`);
  const payload = job.rows as unknown as ImportPayload | null;
  if (!payload?.valid) throw new Error('job has no validated rows');
  await db.from('import_jobs').update({ status: 'committing' }).eq('id', jobId);
  try {
    const res = await importer.commit(db, payload.valid, {
      orgId: job.organization_id,
      jobId,
      context: payload.context ?? {},
    });
    const now = new Date();
    await db
      .from('import_jobs')
      .update({
        // Parsed rows are dropped after commit (privacy); only the context needed for undo is kept.
        rows: { context: payload.context ?? {} } as Json,
        status: 'committed',
        committed_rows: res.inserted,
        committed_at: now.toISOString(),
        undo_until: new Date(now.getTime() + UNDO_HOURS * 3600_000).toISOString(),
        errors: [
          ...((job.errors as unknown[]) ?? []),
          ...(res.skipped ? [{ row: 0, field: '', code: 'skippedExisting', value: String(res.skipped) }] : []),
        ] as Json,
      })
      .eq('id', jobId);
    return res;
  } catch (e) {
    await db.from('import_jobs').update({ status: 'failed' }).eq('id', jobId);
    throw e;
  }
}

export async function undoJob(db: Db, jobId: string): Promise<number> {
  const { data: job } = await db.from('import_jobs').select('*').eq('id', jobId).single();
  if (!job || job.status !== 'committed' || !job.undo_until || new Date(job.undo_until) < new Date())
    throw new Error('undoExpired');
  const importer = IMPORTERS[job.entity];
  if (!importer) throw new Error(`no importer for ${job.entity}`);
  const payload = job.rows as unknown as { context: Record<string, string> } | null;
  const removed = await importer.undo(db, { orgId: job.organization_id, jobId, context: payload?.context ?? {} });
  await db
    .from('import_jobs')
    .update({ status: 'undone', undone_at: new Date().toISOString(), rows: null })
    .eq('id', jobId);
  return removed;
}
