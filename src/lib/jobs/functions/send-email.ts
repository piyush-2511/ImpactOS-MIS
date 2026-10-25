import 'server-only';
import { createElement } from 'react';
import { sendEmail } from '@/lib/email/send';
import { DigestEmail, digestSubject } from '@/lib/email/templates/Digest';
import { inngest } from '../client';

/** Sends one templated email with retries (provider outages must not lose receipts or digests). */
export const sendEmailJob = inngest.createFunction(
  { id: 'send-email', retries: 5, throttle: { limit: 8, period: '1s' }, triggers: [{ event: 'email/send.requested' }] },
  async ({ event, step }) => {
    const d = event.data as {
      to: string;
      template: 'digest';
      locale: 'en' | 'hi';
      props: { items: { title: string; body?: string | null; link?: string | null }[]; appUrl: string; more: number };
    };
    return step.run('send', async () => {
      const res = await sendEmail({
        to: d.to,
        subject: digestSubject(d.locale, d.props.items.length + d.props.more),
        react: createElement(DigestEmail, { locale: d.locale, ...d.props }),
        tags: { kind: d.template },
      });
      if (!res.sent && res.reason === 'error') throw new Error('email provider error');
      return res;
    });
  },
);
