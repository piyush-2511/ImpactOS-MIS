import { z } from 'zod';
import type { Database } from '@/lib/supabase/database.types';
import type { EntityDef, FieldOption, ResolvedField } from './types';

/** Pure field logic, safe in the browser (Fields and columns live preview) and on the server. */
type Setting = Database['public']['Tables']['field_settings']['Row'];
type CustomDef = Database['public']['Tables']['custom_field_definitions']['Row'];

const asOptions = (v: unknown): FieldOption[] =>
  Array.isArray(v)
    ? v.filter(
        (o): o is FieldOption =>
          !!o &&
          typeof o === 'object' &&
          typeof (o as FieldOption).key === 'string' &&
          typeof (o as FieldOption).label_en === 'string',
      )
    : [];

/**
 * Merge built-in fields, the organisation's field settings and its custom fields into one ordered list (pure).
 * Rules: built-in types never change; locked fields are always shown and required; file fields are never filters;
 * archived custom fields are dropped.
 */
export function mergeFields(
  entity: EntityDef,
  settings: Setting[],
  customs: CustomDef[],
  locale: 'en' | 'hi',
): ResolvedField[] {
  const byKey = new Map(settings.map((s) => [s.field_key, s]));
  const builtin: ResolvedField[] = entity.fields.map((f, i) => {
    const s = byKey.get(f.key);
    const labels = { en: s?.label_en || f.label.en, hi: s?.label_hi || f.label.hi };
    return {
      key: f.key,
      labels,
      label: locale === 'hi' ? labels.hi || labels.en : labels.en,
      defaultLabel: locale === 'hi' ? f.label.hi : f.label.en,
      type: f.type,
      builtin: true,
      locked: !!f.locked,
      column: f.column ?? null,
      showInTable: f.locked ? true : (s?.show_in_table ?? !!f.showInTable),
      filterable: f.column && f.type !== 'file' ? (s?.filterable ?? !!f.filterable) : false,
      required: f.locked ? true : (s?.required ?? !!f.required),
      section: s?.section ?? f.section ?? entity.sections[0] ?? 'basic',
      sortOrder: s?.sort_order ?? (i + 1) * 10,
      options: f.options ?? [],
      optionsFromList: f.optionsFromList,
      importable: !!f.importable && !!f.column,
      unique: !!f.unique,
    };
  });
  const custom: ResolvedField[] = customs
    .filter((c) => !c.archived_at && c.entity === entity.key)
    .map((c) => {
      const labels = { en: c.label_en, hi: c.label_hi || c.label_en };
      return {
        key: c.key,
        labels,
        label: locale === 'hi' ? labels.hi : labels.en,
        defaultLabel: c.label_en,
        type: c.type,
        builtin: false,
        locked: false,
        column: null,
        showInTable: c.show_in_table,
        filterable: c.type !== 'file' && c.filterable,
        required: c.required,
        section: c.section,
        sortOrder: c.sort_order,
        options: asOptions(c.options),
        importable: entity.importable && c.type !== 'file',
        unique: false,
        help: locale === 'hi' ? c.help_hi || c.help_en : c.help_en,
        customId: c.id,
      };
    });
  return [...builtin, ...custom].sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}

export const tableColumns = (fields: ResolvedField[]) => fields.filter((f) => f.showInTable);
export const filterFields = (fields: ResolvedField[]) => fields.filter((f) => f.filterable);

/** Label of an option value in the current language (falls back to English, then the key). */
export function optionLabel(field: ResolvedField, value: string | null | undefined, locale: 'en' | 'hi'): string {
  if (value === null || value === undefined || value === '') return '';
  const o = field.options.find((x) => x.key === value);
  return o ? (locale === 'hi' ? o.label_hi || o.label_en : o.label_en) : value;
}

/** Zod schema for one custom/built-in value, from its resolved definition. Messages are i18n keys (engine.errors). */
export function valueSchema(f: ResolvedField): z.ZodType {
  const keys = f.options.map((o) => o.key);
  let s: z.ZodType;
  switch (f.type) {
    case 'number':
      s = z.number({ message: 'number' }).finite();
      break;
    case 'date':
      s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date');
      break;
    case 'boolean':
      s = z.boolean({ message: 'boolean' });
      break;
    case 'email':
      s = z.string().trim().toLowerCase().email('email');
      break;
    case 'phone':
      s = z
        .string()
        .trim()
        .regex(/^(\+91)?[6-9]\d{9}$/, 'phone');
      break;
    case 'select':
      s = keys.length ? z.enum(keys as [string, ...string[]], { message: 'option' }) : z.string();
      break;
    case 'multiselect':
      s = z.array(keys.length ? z.enum(keys as [string, ...string[]], { message: 'option' }) : z.string()).max(50);
      break;
    case 'file':
      s = z.string().uuid('file');
      break;
    default:
      s = z.string().trim().max(1000, 'tooLong');
  }
  return f.required ? s : s.optional().nullable();
}

/** Schema for a record's `custom_fields` object: only known, non-archived custom keys are accepted. */
export function customFieldsSchema(fields: ResolvedField[]) {
  const shape = Object.fromEntries(fields.filter((f) => !f.builtin).map((f) => [f.key, valueSchema(f)]));
  return z.object(shape).strict();
}
