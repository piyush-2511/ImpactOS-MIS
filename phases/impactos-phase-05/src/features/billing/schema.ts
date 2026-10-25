import { z } from 'zod';

export const choosePlanSchema = z.object({
  planKey: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
  period: z.enum(['monthly', 'annual']),
});
export const submitPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amountRupees: z.coerce
    .number({ message: 'amountInvalid' })
    .positive('amountInvalid')
    .max(10_000_000, 'amountInvalid'),
  method: z.enum(['upi', 'bank', 'cheque', 'other']),
  utr: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9/-]{6,40}$/, 'utrInvalid'),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateInvalid'),
});
