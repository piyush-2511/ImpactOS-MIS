import { z } from 'zod';

export const grantSchema = z.object({
  hours: z.coerce.number().refine((h) => [4, 24, 72].includes(h), 'hoursInvalid'),
  reason: z.string().trim().min(3, 'reasonShort').max(500, 'tooLong'),
});
export const revokeSchema = z.object({ grantId: z.string().uuid() });
