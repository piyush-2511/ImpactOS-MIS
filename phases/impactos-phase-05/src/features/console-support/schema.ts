import { z } from 'zod';

export const replySchema = z.object({
  ticketId: z.string().uuid(),
  reply: z.string().trim().max(4000).optional().or(z.literal('')),
  status: z.enum(['open', 'waiting', 'closed']),
  priority: z.enum(['low', 'normal', 'high']),
});
