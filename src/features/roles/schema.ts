import { z } from 'zod';

export const cloneRoleSchema = z.object({
  sourceId: z.string().uuid('invalid'),
  name: z.string().trim().min(2, 'nameShort').max(60, 'nameLong'),
});
export const updateRoleSchema = z.object({
  roleId: z.string().uuid('invalid'),
  name: z.string().trim().min(2, 'nameShort').max(60, 'nameLong'),
  description: z.string().trim().max(300).optional().or(z.literal('')),
  defaultScope: z.enum(['all', 'assigned', 'own']),
  requiresMfa: z.boolean(),
  permissions: z.array(z.string().regex(/^[a-z]+(\.[a-z_]+)+$/)).max(500),
});
export const roleIdSchema = z.object({ roleId: z.string().uuid('invalid') });
