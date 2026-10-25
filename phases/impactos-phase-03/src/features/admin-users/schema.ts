import { z } from 'zod';
import { USERNAME_RE } from '@/lib/auth/username';

/** Messages are i18n keys under `admin.errors`. */
const uuid = z.string().uuid('invalid');

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('emailInvalid'),
  roleId: uuid,
  locale: z.enum(['en', 'hi']).default('en'),
});

export const usernameAccountSchema = z.object({
  fullName: z.string().trim().min(2, 'nameShort').max(120, 'nameLong'),
  username: z.string().trim().toLowerCase().regex(USERNAME_RE, 'usernameInvalid'),
  roleId: uuid,
  locale: z.enum(['en', 'hi']).default('hi'),
});

export const memberRolesSchema = z.object({ memberId: uuid, roleIds: z.array(uuid).min(1, 'roleRequired').max(10) });
export const memberScopesSchema = z.object({
  memberId: uuid,
  programs: z.array(uuid).max(200).default([]),
  branches: z.array(uuid).max(200).default([]),
});
export const memberStatusSchema = z.object({ memberId: uuid, status: z.enum(['active', 'deactivated']) });
export const memberIdSchema = z.object({ memberId: uuid });
export const invitationIdSchema = z.object({ invitationId: uuid });

export type InviteInput = z.infer<typeof inviteSchema>;
export type UsernameAccountInput = z.infer<typeof usernameAccountSchema>;
