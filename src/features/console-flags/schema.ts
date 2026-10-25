import { z } from 'zod';

export const flagSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/, 'keyInvalid'),
  orgSlug: z.string().trim().toLowerCase().max(63).optional().or(z.literal('')),
  enabled: z.boolean(),
  note: z.string().max(200).optional().or(z.literal('')),
});
export const flagIdSchema = z.object({ id: z.string().uuid() });
