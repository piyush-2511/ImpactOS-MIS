import { serve } from 'inngest/next';
import { inngest } from '@/lib/jobs/client';
import { functions } from '@/lib/jobs/functions';

/** Inngest calls this endpoint to run background functions. Requests are signed with INNGEST_SIGNING_KEY. */
export const { GET, POST, PUT } = serve({ client: inngest, functions });

// PDF rendering and imports can take a while.
export const maxDuration = 300;
