import { z } from 'zod';

export const paymentIdSchema = z.object({ paymentId: z.string().uuid(), note: z.string().max(500).optional() });
export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amountRupees: z.coerce.number().positive().max(10_000_000),
  method: z.enum(['upi', 'bank', 'cheque', 'other']),
  utr: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9/-]{6,40}$/, 'utrInvalid'),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const creditNoteSchema = z.object({
  orgId: z.string().uuid(),
  invoiceId: z.string().uuid().optional().or(z.literal('')),
  amountRupees: z.coerce.number().positive().max(10_000_000),
  reason: z.string().trim().min(5).max(500),
});
export const runSchema = z.object({ confirm: z.literal(true) });
