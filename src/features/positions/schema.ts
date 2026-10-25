import { z } from 'zod';

const uuid = z.string().uuid('invalid');
export const positionSchema = z.object({
  positionId: uuid.optional(),
  name: z.string().trim().min(2, 'nameShort').max(80, 'nameLong'),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  defaultRoleId: uuid.optional().or(z.literal('')),
  isCommittee: z.boolean().default(false),
});
export const appointSchema = z.object({
  positionId: uuid,
  memberId: uuid,
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateInvalid'),
});
export const holderIdSchema = z.object({ holderId: uuid });
export const positionIdSchema = z.object({ positionId: uuid });
