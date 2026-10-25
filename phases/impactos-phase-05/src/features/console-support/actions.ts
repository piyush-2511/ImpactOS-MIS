'use server';

import { revalidatePath } from 'next/cache';
import { consoleAction } from '@/lib/platform/support';
import { notify } from '@/lib/notifications/notify';
import { replySchema } from './schema';

/** Reply to a ticket and/or change its status. The person who opened it gets a notification with the reply. */
export const replyTicketAction = consoleAction(
  { roles: ['support'], schema: replySchema, audit: (i) => ({ action: 'support.ticket_updated', target: i.ticketId }) },
  async (input, ctx) => {
    const { data, error } = await ctx.supabase
      .from('support_tickets')
      .update({
        status: input.status,
        priority: input.priority,
        assigned_to: ctx.userId,
        ...(input.reply ? { staff_reply: input.reply, replied_at: new Date().toISOString() } : {}),
      })
      .eq('id', input.ticketId)
      .select('organization_id, created_by, subject')
      .single();
    if (error || !data) throw error;
    if (input.reply && data.created_by)
      await notify({
        orgId: data.organization_id,
        userIds: [data.created_by],
        kind: 'support.reply',
        title: `ImpactOS support replied: ${data.subject}`,
        body: input.reply.slice(0, 600),
      });
    revalidatePath('/console/support');
    return null;
  },
);
