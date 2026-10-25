import 'server-only';
import { createElement } from 'react';
import { renderPdf, TableDocument } from '@/lib/pdf/render';
import { defaultStorage, objectKey } from '@/lib/storage';
import { notify } from '@/lib/notifications/notify';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { inngest } from '../client';
import { withJobLog } from './log';

/** Renders large PDFs (big table exports, later receipts in bulk) and stores them; the requester gets a notification. */
export const renderPdfJob = inngest.createFunction(
  { id: 'render-pdf', retries: 2, triggers: [{ event: 'pdf/render.requested' }] },
  async ({ event, step, runId, attempt }) => {
    const d = event.data as {
      orgId: string;
      userId: string;
      template: 'table';
      title: string;
      payload: { headers: string[]; rows: string[][]; locale: 'en' | 'hi' };
      fileName: string;
    };
    const fileId = await step.run('render-and-store', () =>
      withJobLog('render-pdf', d.orgId, runId, attempt, async () => {
        const db = supabaseAdmin();
        const { data: org } = await db.from('organizations').select('name, state, pan').eq('id', d.orgId).single();
        const bytes = await renderPdf(
          createElement(TableDocument, {
            title: d.title,
            headers: d.payload.headers,
            rows: d.payload.rows,
            locale: d.payload.locale,
            letterhead: {
              orgName: org?.name ?? '',
              lines: [org?.state ?? '', org?.pan ? `PAN ${org.pan}` : ''].filter(Boolean),
            },
            generatedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          }),
        );
        const storage = defaultStorage();
        const id = crypto.randomUUID();
        const key = objectKey(d.orgId, 'generated', id, d.fileName);
        await storage.put(key, bytes, 'application/pdf');
        await db.from('storage_files').insert({
          organization_id: d.orgId,
          provider: storage.kind,
          object_key: key,
          name: d.fileName,
          mime: 'application/pdf',
          size_bytes: bytes.byteLength,
          purpose: 'generated',
          uploaded_by: d.userId,
        });
        const { data: row } = await db.from('storage_files').select('id').eq('object_key', key).single();
        await db.from('storage_files').update({ status: 'ready' }).eq('object_key', key);
        return row?.id ?? id;
      }),
    );
    await step.run('notify', () =>
      notify({
        orgId: d.orgId,
        userIds: [d.userId],
        kind: 'export.ready',
        title: `${d.title}: PDF is ready`,
        link: `/api/files/${fileId}`,
      }),
    );
    return { fileId };
  },
);
