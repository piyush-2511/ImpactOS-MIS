'use server';

import { revalidatePath } from 'next/cache';
import { action, check } from '@/lib/actions/action';
import { ActionError } from '@/lib/actions/errors';
import { getEntity } from '@/lib/fields/registry';
import type { Json } from '@/lib/supabase/database.types';
import { customKeyFrom, MAX_CUSTOM_FIELDS, saveFieldsSchema } from './schema';

/**
 * Save Admin → Fields and columns for one entity in one go: built-in overrides (labels, column, filter, required,
 * section, order; never type), edits to custom fields, new custom fields and archived ones. Locked built-ins stay
 * shown and required whatever is sent.
 */
export const saveFieldsAction = action(
  { permission: 'admin.fields.manage', schema: saveFieldsSchema },
  async (input, ctx) => {
    const entity = getEntity(input.entity);
    if (!entity?.customFields) throw new ActionError('notConfigurable');
    const builtinByKey = new Map(entity.fields.map((f) => [f.key, f]));

    for (const b of input.builtins) {
      const def = builtinByKey.get(b.key);
      if (!def) throw new ActionError('invalid');
      const filterable = def.column && def.type !== 'file' ? b.filterable : false;
      check(
        await ctx.supabase.from('field_settings').upsert({
          organization_id: ctx.orgId,
          entity: entity.key,
          field_key: b.key,
          label_en: b.labelEn === def.label.en ? null : b.labelEn,
          label_hi: b.labelHi && b.labelHi !== def.label.hi ? b.labelHi : null,
          show_in_table: def.locked ? true : b.showInTable,
          filterable,
          required: def.locked ? true : b.required,
          section: b.section,
          sort_order: b.sortOrder,
        }),
      );
    }

    const { data: existing } = await ctx.supabase
      .from('custom_field_definitions')
      .select('id, key')
      .eq('organization_id', ctx.orgId)
      .eq('entity', entity.key);
    const keys = new Set((existing ?? []).map((e) => e.key));
    const liveAfter = input.customs.filter((c) => !c.archived).length;
    if (liveAfter > MAX_CUSTOM_FIELDS) throw new ActionError('tooManyFields');

    for (const c of input.customs) {
      const values = {
        label_en: c.labelEn,
        label_hi: c.labelHi || null,
        type: c.type,
        options: c.options as unknown as Json,
        help_en: c.helpEn || null,
        help_hi: c.helpHi || null,
        required: c.required,
        show_in_table: c.showInTable,
        filterable: c.type === 'file' ? false : c.filterable,
        section: c.section,
        sort_order: c.sortOrder,
      };
      if (c.id) {
        if (!(existing ?? []).some((e) => e.id === c.id)) throw new ActionError('notFound');
        check(
          await ctx.supabase
            .from('custom_field_definitions')
            .update({ ...values, archived_at: c.archived ? new Date().toISOString() : null })
            .eq('id', c.id),
        );
      } else if (!c.archived) {
        let key = c.key ?? customKeyFrom(c.labelEn);
        for (let i = 2; keys.has(key); i++) key = `${customKeyFrom(c.labelEn).slice(0, 38)}_${i}`;
        keys.add(key);
        check(
          await ctx.supabase
            .from('custom_field_definitions')
            .insert({ organization_id: ctx.orgId, entity: entity.key, key, ...values }),
        );
      }
    }
    revalidatePath('/admin/custom-fields');
    revalidatePath('/admin/users');
    return null;
  },
);
