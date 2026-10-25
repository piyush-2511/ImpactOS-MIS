import { z } from 'zod';

const org = z.string().uuid();
export const changePlanSchema = z.object({
  orgId: org,
  planKey: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
  period: z.enum(['monthly', 'annual']),
});
export const extendTrialSchema = z.object({ orgId: org, days: z.coerce.number().int().min(1).max(60) });
export const setStatusSchema = z.object({ orgId: org, status: z.enum(['active', 'read_only', 'cancelled']) });
export const notesSchema = z.object({ orgId: org, notes: z.string().max(4000) });
export const accessSchema = z.object({ orgId: org, reason: z.string().trim().min(10, 'reasonShort').max(500) });
export const breakGlassSchema = z.object({
  orgId: org,
  reason: z.string().trim().min(20, 'reasonShortBreakGlass').max(500),
  confirm: z.literal(true, { message: 'confirmRequired' }),
});
export const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, 'slugInvalid'),
  legalForm: z.enum(['trust', 'society', 'section8', 'other']),
  state: z.string().trim().min(2).max(60),
  secretaryEmail: z.string().trim().toLowerCase().email('emailInvalid'),
  planKey: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
  locale: z.enum(['en', 'hi']).default('en'),
});
