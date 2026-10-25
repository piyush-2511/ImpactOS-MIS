import { z } from 'zod';

export const MAX_CUSTOM_FIELDS = 20; // Growth plan; phase 5 reads the limit from the organisation's plan
const TYPES = ['text', 'number', 'date', 'select', 'multiselect', 'boolean', 'phone', 'email', 'file'] as const;
const section = z.string().regex(/^[a-z_]{1,40}$/, 'invalid');
const label = z.string().trim().min(1, 'labelRequired').max(80, 'tooLong');
const labelHi = z.string().trim().max(80, 'tooLong').optional().or(z.literal(''));
const option = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9_]{0,59}$/, 'optionKey'),
  label_en: z.string().trim().min(1).max(80),
  label_hi: z.string().trim().max(80).optional().nullable(),
});

export const builtinSettingSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,60}$/),
  labelEn: label,
  labelHi,
  showInTable: z.boolean(),
  filterable: z.boolean(),
  required: z.boolean(),
  section,
  sortOrder: z.number().int().min(0).max(100000),
});
export const customFieldSchema = z
  .object({
    id: z.string().uuid().optional(),
    key: z
      .string()
      .regex(/^cf_[a-z0-9_]{1,40}$/)
      .optional(),
    labelEn: label,
    labelHi,
    type: z.enum(TYPES),
    options: z.array(option).max(200).default([]),
    helpEn: z.string().trim().max(200).optional().or(z.literal('')),
    helpHi: z.string().trim().max(200).optional().or(z.literal('')),
    required: z.boolean(),
    showInTable: z.boolean(),
    filterable: z.boolean(),
    section,
    sortOrder: z.number().int().min(0).max(100000),
    archived: z.boolean().default(false),
  })
  .refine((f) => !['select', 'multiselect'].includes(f.type) || f.options.length > 0 || f.archived, {
    message: 'optionsRequired',
    path: ['options'],
  })
  .refine((f) => !(f.type === 'file' && f.filterable), { message: 'fileNoFilter', path: ['filterable'] });

export const saveFieldsSchema = z.object({
  entity: z.string().regex(/^[a-z][a-z_]{1,40}$/),
  builtins: z.array(builtinSettingSchema).max(100),
  customs: z.array(customFieldSchema).max(MAX_CUSTOM_FIELDS + 50),
});
export type SaveFieldsInput = z.infer<typeof saveFieldsSchema>;
export type CustomFieldInput = z.infer<typeof customFieldSchema>;

/** "Ration card type" → "cf_ration_card_type" (unique suffix added by the action when needed). */
export function customKeyFrom(label: string) {
  const base = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);
  return `cf_${base || 'field'}`;
}
