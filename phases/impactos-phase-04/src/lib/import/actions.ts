'use server';

import { z } from 'zod';
import { getLocale } from 'next-intl/server';
import { action, must } from '@/lib/actions/action';
import { ActionError } from '@/lib/actions/errors';
import { getEntity } from '@/lib/fields/registry';
import { resolveFields } from '@/lib/fields/resolve';
import type { Json } from '@/lib/supabase/database.types';
import { sendJob } from '@/lib/jobs/client';
import { toCsv } from '@/lib/export/csv';
import { canImport, commitJob, INLINE_COMMIT_LIMIT, undoJob, type ImportPayload } from './commit';
import { parseFile, ParseError, suggestMapping } from './parse';
import { buildTemplate } from './template';
import { validateRows, type RowError } from './validate';

/** Extra permission per entity on top of data.import, and the context keys each import needs. */
const ENTITY_RULES: Record<string, { permission: string; context: z.ZodType<Record<string, string>> }> = {
  lookup_values: {
    permission: 'admin.lists.manage',
    context: z.object({ list_key: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/) }),
  },
};

function rules(entity: string, ctxPerms: (p: string) => boolean) {
  const r = ENTITY_RULES[entity];
  if (!r || !canImport(entity) || !getEntity(entity)?.importable) throw new ActionError('notImportable');
  if (!ctxPerms(r.permission)) throw new ActionError('forbidden');
  return r;
}

const locale = async () => ((await getLocale()) === 'hi' ? 'hi' : 'en') as 'en' | 'hi';
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

/** "Download sample" for an entity, built from its current fields (custom fields included). */
export const importTemplateAction = action(
  { permission: 'data.import', schema: z.object({ entity: z.string(), format: z.enum(['xlsx', 'csv']) }) },
  async (input, ctx) => {
    rules(input.entity, ctx.can);
    const loc = await locale();
    const fields = await resolveFields(ctx.orgId, input.entity, loc);
    const out = await buildTemplate(fields, loc, input.format);
    return { fileName: `${input.entity}-template.${out.ext}`, mime: out.mime, base64: b64(out.bytes) };
  },
);

/** Step 1: upload and parse. Stores the parsed rows on an import job and suggests a column mapping. */
export async function startImportAction(fd: FormData) {
  const run = action(
    { permission: 'data.import', schema: z.object({ entity: z.string(), context: z.string().max(500) }) },
    async (input, ctx) => {
      const r = rules(input.entity, ctx.can);
      const context = r.context.safeParse(JSON.parse(input.context || '{}'));
      if (!context.success) throw new ActionError('invalid');
      const file = fd.get('file');
      if (!(file instanceof File) || file.size === 0) throw new ActionError('noFile');
      let parsed;
      try {
        parsed = await parseFile(file.name, new Uint8Array(await file.arrayBuffer()));
      } catch (e) {
        throw new ActionError(e instanceof ParseError ? e.code : 'unreadable');
      }
      const fields = (await resolveFields(ctx.orgId, input.entity, await locale())).filter((f) => f.importable);
      const payload: ImportPayload = { raw: parsed.rows, context: context.data };
      const job = must(
        await ctx.supabase
          .from('import_jobs')
          .insert({
            organization_id: ctx.orgId,
            entity: input.entity,
            file_name: file.name.slice(0, 255),
            headers: parsed.headers,
            rows: payload as unknown as Json,
            total_rows: parsed.rows.length,
          })
          .select('id')
          .single(),
      );
      return {
        jobId: job.id,
        headers: parsed.headers,
        total: parsed.rows.length,
        sample: parsed.rows.slice(0, 5),
        mapping: suggestMapping(parsed.headers, fields),
        fields: fields.map((f) => ({ key: f.key, label: f.label, required: f.required, type: f.type })),
      };
    },
  );
  return run({ entity: fd.get('entity'), context: fd.get('context') ?? '{}' });
}

/** Step 2: validate every row with the chosen mapping. Errors are returned (first 200) and stored (first 1000). */
export const validateImportAction = action(
  {
    permission: 'data.import',
    schema: z.object({ jobId: z.string().uuid(), mapping: z.record(z.string().max(200), z.string().max(60)) }),
  },
  async (input, ctx) => {
    const job = must(await ctx.supabase.from('import_jobs').select('*').eq('id', input.jobId).single());
    rules(job.entity, ctx.can);
    if (!['uploaded', 'validated'].includes(job.status)) throw new ActionError('jobClosed');
    const payload = job.rows as unknown as ImportPayload;
    if (!payload?.raw) throw new ActionError('jobClosed');
    const fields = await resolveFields(ctx.orgId, job.entity, await locale());
    const mapping = Object.fromEntries(Object.entries(input.mapping).filter(([h, k]) => job.headers.includes(h) && k));
    const res = validateRows(payload.raw, mapping, fields);
    const next: ImportPayload = { raw: payload.raw, valid: res.valid, context: payload.context };
    must(
      await ctx.supabase
        .from('import_jobs')
        .update({
          status: 'validated',
          mapping: mapping as Json,
          rows: next as unknown as Json,
          valid_rows: res.valid.length,
          error_rows: new Set(res.errors.map((e) => e.row)).size,
          errors: res.errors.slice(0, 1000) as unknown as Json,
        })
        .eq('id', job.id)
        .select('id')
        .single(),
    );
    return {
      valid: res.valid.length,
      errorRows: new Set(res.errors.map((e) => e.row)).size,
      errors: res.errors.slice(0, 200),
      total: payload.raw.length,
    };
  },
);

/** Step 3: commit. Small imports run now (RLS applies); large ones go to a background job and notify when done. */
export const commitImportAction = action(
  { permission: 'data.import', schema: z.object({ jobId: z.string().uuid() }) },
  async (input, ctx) => {
    const job = must(
      await ctx.supabase.from('import_jobs').select('id, entity, status, valid_rows').eq('id', input.jobId).single(),
    );
    rules(job.entity, ctx.can);
    if (job.status !== 'validated') throw new ActionError('jobClosed');
    if (job.valid_rows === 0) throw new ActionError('nothingToImport');
    if (job.valid_rows > INLINE_COMMIT_LIMIT) {
      await ctx.supabase.from('import_jobs').update({ status: 'committing' }).eq('id', job.id);
      await sendJob('import/commit.requested', { jobId: job.id, orgId: ctx.orgId, userId: ctx.user.id });
      return { queued: true, inserted: 0, skipped: 0 };
    }
    try {
      const res = await commitJob(ctx.supabase, job.id);
      return { queued: false, ...res };
    } catch {
      throw new ActionError('commitFailed');
    }
  },
);

export const undoImportAction = action(
  { permission: 'data.import', schema: z.object({ jobId: z.string().uuid() }) },
  async (input, ctx) => {
    const job = must(await ctx.supabase.from('import_jobs').select('entity').eq('id', input.jobId).single());
    rules(job.entity, ctx.can);
    try {
      return { removed: await undoJob(ctx.supabase, input.jobId) };
    } catch {
      throw new ActionError('undoExpired');
    }
  },
);

/** Error report as CSV (row, column, problem, value) for fixing the file in Excel. */
export const importErrorsAction = action(
  {
    permission: 'data.import',
    schema: z.object({ jobId: z.string().uuid(), labels: z.record(z.string(), z.string()) }),
  },
  async (input, ctx) => {
    const job = must(await ctx.supabase.from('import_jobs').select('errors, file_name').eq('id', input.jobId).single());
    const errs = (job.errors as unknown as RowError[]) ?? [];
    const csv = toCsv(
      ['Row', 'Column', 'Problem', 'Value'],
      errs.map((e) => [e.row, e.field, input.labels[e.code] ?? e.code, e.value]),
    );
    return {
      fileName: `errors-${job.file_name.replace(/\.[^.]+$/, '')}.csv`,
      mime: 'text/csv; charset=utf-8',
      base64: Buffer.from(csv, 'utf-8').toString('base64'),
    };
  },
);
