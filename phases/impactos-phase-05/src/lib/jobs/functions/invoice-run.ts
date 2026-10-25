import 'server-only';
import { dueOrganisations, issueDueInvoice } from '@/lib/billing/invoice-run';
import { inngest } from '../client';
import { withJobLog } from './log';

/**
 * 06:00 IST every day: issue invoices for every organisation whose billing period or trial has ended. Regular periods
 * end on the last day of the month, so most invoices go out on the 1st. One step per organisation (retries are isolated).
 */
export const invoiceRun = inngest.createFunction(
  {
    id: 'invoice-run',
    retries: 3,
    triggers: [{ cron: 'TZ=Asia/Kolkata 0 6 * * *' }, { event: 'billing/invoice-run.requested' }],
  },
  async ({ step, runId, attempt }) => {
    const orgs = await step.run('find-due', () =>
      withJobLog('invoice-run', null, runId, attempt, () => dueOrganisations()),
    );
    let issued = 0;
    for (const orgId of orgs) {
      const id = await step.run(`issue-${orgId}`, () =>
        withJobLog('invoice-issue', orgId, runId, attempt, () => issueDueInvoice(orgId)),
      );
      if (id) issued++;
    }
    return { due: orgs.length, issued };
  },
);
