import { z } from 'zod';

const rupees = z.coerce.number().min(0).max(10_000_000);
const limit = z
  .union([z.coerce.number().int().min(0).max(10_000_000), z.literal('')])
  .transform((v) => (v === '' ? null : v));
export const savePlanSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(200).optional().or(z.literal('')),
  monthlyRupees: rupees,
  annualRupees: rupees,
  extraSeatRupees: rupees,
  donationFeePercent: z.coerce.number().min(0).max(10),
  donationFeeCapRupees: rupees,
  isPublic: z.boolean(),
  active: z.boolean(),
  limits: z.object({
    staff_seats: limit,
    beneficiaries: limit,
    storage_gb: limit,
    ai_units: limit,
    custom_fields: limit,
  }),
  modules: z.array(z.string().regex(/^[a-z][a-z_]{1,30}$/)).max(30),
});
