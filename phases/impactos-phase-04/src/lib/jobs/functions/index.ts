import { dailyDigest } from './daily-digest';
import { importCommit } from './import-commit';
import { renderPdfJob } from './render-pdf';
import { sendEmailJob } from './send-email';

/** Every background function, registered with Inngest at /api/inngest. Later phases add theirs here. */
export const functions = [importCommit, renderPdfJob, sendEmailJob, dailyDigest];
