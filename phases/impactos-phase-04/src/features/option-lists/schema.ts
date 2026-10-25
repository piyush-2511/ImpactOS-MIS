import { z } from 'zod';

const listKey = z.string().regex(/^[a-z][a-z0-9_]{1,40}$/, 'invalid');
export const saveValueSchema = z.object({
  listKey,
  valueKey: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9_]{0,59}$/, 'keyInvalid'),
  labelEn: z.string().trim().min(1, 'labelRequired').max(120, 'tooLong'),
  labelHi: z.string().trim().max(120, 'tooLong').optional().or(z.literal('')),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'colorInvalid')
    .optional()
    .or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(100000).default(0),
  active: z.boolean().default(true),
});
export const valueRefSchema = z.object({ listKey, valueKey: z.string().regex(/^[a-z0-9][a-z0-9_]{0,59}$/) });
export const exportSchema = z.object({ listKey, format: z.enum(['csv', 'xlsx', 'pdf']), query: z.string().max(2000) });

/** "Women's empowerment" → "womens_empowerment" */
export function valueKeyFrom(label: string) {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}
