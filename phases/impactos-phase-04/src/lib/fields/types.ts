import type { CustomFieldType } from '@/lib/supabase/database.types';

export type FieldType = CustomFieldType;
export type FieldOption = { key: string; label_en: string; label_hi?: string | null };
export type Localized = { en: string; hi: string };

/** A built-in field of an entity, declared in code (src/lib/fields/registry.ts). Its TYPE never changes. */
export type BuiltinField = {
  key: string;
  label: Localized;
  type: FieldType;
  /** Database column; omit for computed fields (e.g. roles), which cannot be filtered, grouped or imported. */
  column?: string;
  locked?: boolean; // always shown, always required (record IDs, names)
  showInTable?: boolean;
  filterable?: boolean;
  required?: boolean;
  section?: string;
  options?: FieldOption[];
  /** Options come from an option list (lookup_lists key). */
  optionsFromList?: string;
  importable?: boolean;
  /** Unique within the organisation (import skips duplicates). */
  unique?: boolean;
};

export type EntityDef = {
  key: string;
  table: string;
  label: Localized;
  customFields: boolean;
  importable: boolean;
  sections: string[];
  fields: BuiltinField[];
};

/** What list pages, forms, filters and importers use: built-in + org settings + custom fields, merged and ordered. */
export type ResolvedField = {
  key: string;
  label: string;
  labels: Localized;
  defaultLabel: string;
  type: FieldType;
  builtin: boolean;
  locked: boolean;
  column: string | null;
  showInTable: boolean;
  filterable: boolean;
  required: boolean;
  section: string;
  sortOrder: number;
  options: FieldOption[];
  optionsFromList?: string;
  importable: boolean;
  unique: boolean;
  help?: string | null;
  customId?: string;
};

export const SECTION_RE = /^[a-z_]{1,40}$/;
export const CUSTOM_KEY_RE = /^cf_[a-z0-9_]{1,40}$/;
