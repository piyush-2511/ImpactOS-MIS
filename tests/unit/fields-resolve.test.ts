import { describe, expect, it } from 'vitest';
import { customFieldsSchema, mergeFields, optionLabel } from '@/lib/fields/merge';
import { ENTITIES } from '@/lib/fields/registry';
import { aggregate, reportConfigSchema } from '@/lib/reports/engine';

const members = ENTITIES.members!;
const base = { organization_id: 'o', entity: 'members', updated_at: '', updated_by: null };
const custom = (over: Record<string, unknown>) =>
  ({
    id: 'c1',
    organization_id: 'o',
    entity: 'members',
    key: 'cf_branch',
    label_en: 'Branch',
    label_hi: 'शाखा',
    type: 'select',
    options: [{ key: 'gaya', label_en: 'Gaya', label_hi: 'गया' }],
    help_en: null,
    help_hi: null,
    required: false,
    show_in_table: true,
    filterable: true,
    section: 'work',
    sort_order: 1000,
    archived_at: null,
    created_at: '',
    updated_at: '',
    updated_by: null,
    created_by: null,
    ...over,
  }) as never;

describe('mergeFields', () => {
  it('returns built-in fields with their defaults when nothing is configured', () => {
    const f = mergeFields(members, [], [], 'en');
    expect(f.map((x) => x.key)).toEqual(members.fields.map((x) => x.key));
    expect(f.find((x) => x.key === 'kind')!.filterable).toBe(true);
  });
  it('applies label, column and filter overrides but never changes a built-in type', () => {
    const f = mergeFields(
      members,
      [
        {
          ...base,
          field_key: 'joined_at',
          label_en: 'Date joined',
          label_hi: null,
          show_in_table: false,
          filterable: true,
          required: null,
          section: null,
          sort_order: null,
        },
      ],
      [],
      'en',
    );
    const j = f.find((x) => x.key === 'joined_at')!;
    expect(j.label).toBe('Date joined');
    expect(j.showInTable).toBe(false);
    expect(j.type).toBe('date');
    expect(j.filterable).toBe(true);
  });
  it('keeps locked fields shown and required whatever the settings say', () => {
    const f = mergeFields(
      members,
      [
        {
          ...base,
          field_key: 'name',
          label_en: null,
          label_hi: null,
          show_in_table: false,
          filterable: null,
          required: false,
          section: null,
          sort_order: null,
        },
      ],
      [],
      'en',
    );
    const n = f.find((x) => x.key === 'name')!;
    expect(n.showInTable).toBe(true);
    expect(n.required).toBe(true);
  });
  it('never lets computed fields (no column) be filters', () => {
    const f = mergeFields(
      members,
      [
        {
          ...base,
          field_key: 'roles',
          label_en: null,
          label_hi: null,
          show_in_table: null,
          filterable: true,
          required: null,
          section: null,
          sort_order: null,
        },
      ],
      [],
      'en',
    );
    expect(f.find((x) => x.key === 'roles')!.filterable).toBe(false);
  });
  it('adds custom fields in order, drops archived ones, and blocks file filters', () => {
    const f = mergeFields(
      members,
      [],
      [
        custom({}),
        custom({ id: 'c2', key: 'cf_old', archived_at: '2026-10-01' }),
        custom({ id: 'c3', key: 'cf_photo', type: 'file', filterable: true }),
      ],
      'hi',
    );
    expect(f.some((x) => x.key === 'cf_old')).toBe(false);
    expect(f.find((x) => x.key === 'cf_branch')!.label).toBe('शाखा');
    expect(f.find((x) => x.key === 'cf_photo')!.filterable).toBe(false);
  });
  it('shows option labels in the chosen language', () => {
    const f = mergeFields(members, [], [custom({})], 'hi').find((x) => x.key === 'cf_branch')!;
    expect(optionLabel(f, 'gaya', 'hi')).toBe('गया');
    expect(optionLabel(f, 'unknown', 'en')).toBe('unknown');
  });
});

describe('customFieldsSchema', () => {
  const fields = mergeFields(
    members,
    [],
    [custom({ required: true }), custom({ id: 'c4', key: 'cf_children', type: 'number' })],
    'en',
  );
  it('accepts valid values and rejects unknown keys', () => {
    expect(customFieldsSchema(fields).safeParse({ cf_branch: 'gaya', cf_children: 2 }).success).toBe(true);
    expect(customFieldsSchema(fields).safeParse({ cf_branch: 'gaya', cf_hack: 'x' }).success).toBe(false);
  });
  it('enforces options and required', () => {
    expect(customFieldsSchema(fields).safeParse({ cf_branch: 'patna' }).success).toBe(false);
    expect(customFieldsSchema(fields).safeParse({ cf_children: 1 }).success).toBe(false);
  });
});

describe('report aggregation', () => {
  const fields = mergeFields(members, [], [custom({})], 'en');
  it('counts by a field and labels options', () => {
    const cfg = reportConfigSchema.parse({ entity: 'members', groupBy: 'cf_branch', metric: { type: 'count' } });
    const res = aggregate(
      [{ custom_fields: { cf_branch: 'gaya' } }, { custom_fields: { cf_branch: 'gaya' } }, { custom_fields: {} }],
      cfg,
      fields,
      (f, v) => optionLabel(f, v, 'en'),
    );
    expect(res.rows[0]).toEqual({ key: 'gaya', label: 'Gaya', value: 2 });
    expect(res.total).toBe(3);
  });
});
