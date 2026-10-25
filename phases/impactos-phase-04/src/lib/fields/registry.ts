import type { EntityDef } from './types';

/**
 * Entities the shared engine knows (list pages, Fields and columns, filters, import/export, reports).
 * Each phase adds its entities here AND in private.entity_sources (its migration). Labels are bilingual because
 * admins see them in Admin → Fields and columns before any override.
 */
export const ENTITIES: Record<string, EntityDef> = {
  members: {
    key: 'members',
    table: 'organization_members',
    label: { en: 'People', hi: 'लोग' },
    customFields: true,
    importable: false, // people join by invitation or HR-created username accounts, never by spreadsheet
    sections: ['basic', 'work', 'other'],
    fields: [
      {
        key: 'name',
        label: { en: 'Name', hi: 'नाम' },
        type: 'text',
        locked: true,
        showInTable: true,
        section: 'basic',
      },
      { key: 'email', label: { en: 'Email', hi: 'ईमेल' }, type: 'email', showInTable: false, section: 'basic' },
      {
        key: 'username',
        label: { en: 'Username', hi: 'यूज़रनेम' },
        type: 'text',
        showInTable: false,
        section: 'basic',
      },
      {
        key: 'kind',
        label: { en: 'Sign-in', hi: 'साइन-इन' },
        type: 'select',
        column: 'kind',
        showInTable: true,
        filterable: true,
        section: 'basic',
        options: [
          { key: 'email', label_en: 'Email', label_hi: 'ईमेल' },
          { key: 'username', label_en: 'Username', label_hi: 'यूज़रनेम' },
        ],
      },
      { key: 'roles', label: { en: 'Roles', hi: 'भूमिकाएँ' }, type: 'text', showInTable: true, section: 'work' },
      { key: 'positions', label: { en: 'Positions', hi: 'पद' }, type: 'text', showInTable: true, section: 'work' },
      {
        key: 'status',
        label: { en: 'Status', hi: 'स्थिति' },
        type: 'select',
        column: 'status',
        showInTable: false,
        filterable: true,
        section: 'work',
        options: [
          { key: 'active', label_en: 'Active', label_hi: 'सक्रिय' },
          { key: 'deactivated', label_en: 'Deactivated', label_hi: 'निष्क्रिय' },
        ],
      },
      {
        key: 'joined_at',
        label: { en: 'Joined', hi: 'जुड़े' },
        type: 'date',
        column: 'joined_at',
        showInTable: true,
        section: 'work',
      },
    ],
  },
  lookup_values: {
    key: 'lookup_values',
    table: 'lookup_values',
    label: { en: 'Option list values', hi: 'विकल्प सूची के मान' },
    customFields: false,
    importable: true,
    sections: ['basic'],
    fields: [
      {
        key: 'value_key',
        label: { en: 'Key', hi: 'कुंजी' },
        type: 'text',
        column: 'value_key',
        locked: true,
        showInTable: true,
        importable: true,
        unique: true,
        section: 'basic',
      },
      {
        key: 'label_en',
        label: { en: 'Label (English)', hi: 'नाम (अंग्रेज़ी)' },
        type: 'text',
        column: 'label_en',
        required: true,
        showInTable: true,
        importable: true,
        section: 'basic',
      },
      {
        key: 'label_hi',
        label: { en: 'Label (Hindi)', hi: 'नाम (हिंदी)' },
        type: 'text',
        column: 'label_hi',
        showInTable: true,
        importable: true,
        section: 'basic',
      },
      {
        key: 'sort_order',
        label: { en: 'Order', hi: 'क्रम' },
        type: 'number',
        column: 'sort_order',
        showInTable: true,
        importable: true,
        section: 'basic',
      },
      {
        key: 'active',
        label: { en: 'In use', hi: 'उपयोग में' },
        type: 'boolean',
        column: 'active',
        showInTable: true,
        filterable: true,
        importable: true,
        section: 'basic',
      },
    ],
  },
};

export type EntityKey = keyof typeof ENTITIES;
export const entityKeys = () => Object.keys(ENTITIES);
export function getEntity(key: string): EntityDef | null {
  return ENTITIES[key] ?? null;
}
/** Entities whose fields admins can configure in Admin → Fields and columns. */
export const configurableEntities = () => Object.values(ENTITIES).filter((e) => e.customFields);
