import { Inngest } from 'inngest';
import type { Json } from '@/lib/supabase/database.types';

/**
 * Background jobs (Inngest). Event names are `<area>/<thing>.<verb>`. Data payloads carry ids, never personal data,
 * so the job service never stores beneficiary or donor details.
 */
export const inngest = new Inngest({ id: 'impactos' });

export type JobEvents = {
  'import/commit.requested': { jobId: string; orgId: string; userId: string };
  'pdf/render.requested': {
    orgId: string;
    userId: string;
    template: 'table';
    title: string;
    payload: Json;
    fileName: string;
  };
  'email/send.requested': { to: string; template: 'digest'; locale: 'en' | 'hi'; props: Json };
};

/** Send a typed event. In development without INNGEST_EVENT_KEY, Inngest's dev server receives it. */
export async function sendJob<K extends keyof JobEvents>(name: K, data: JobEvents[K]) {
  await inngest.send({ name, data: data as Record<string, unknown> });
}
