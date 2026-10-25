import { z } from 'zod';

export const announcementSchema = z
  .object({
    id: z.string().uuid().optional(),
    titleEn: z.string().trim().min(3).max(150),
    titleHi: z.string().trim().max(150).optional().or(z.literal('')),
    bodyEn: z.string().trim().max(600).optional().or(z.literal('')),
    bodyHi: z.string().trim().max(600).optional().or(z.literal('')),
    tone: z.enum(['info', 'warn']),
    planKey: z
      .string()
      .regex(/^[a-z][a-z0-9_]{1,30}$/)
      .optional()
      .or(z.literal('')),
    startsAt: z.string().min(10),
    endsAt: z.string().min(10),
  })
  .refine((a) => new Date(a.endsAt) > new Date(a.startsAt), { message: 'endBeforeStart', path: ['endsAt'] });
export const announcementIdSchema = z.object({ id: z.string().uuid() });
