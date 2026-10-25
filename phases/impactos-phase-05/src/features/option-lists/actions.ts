'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { action, check } from '@/lib/actions/action';
import { buildExport, INLINE_PDF_ROWS } from '@/lib/export/build';
import { resolveFields } from '@/lib/fields/resolve';
import { sendJob } from '@/lib/jobs/client';
import { parseListQuery } from '@/lib/views/filters';
import { listValues } from './queries';
import { exportSchema, saveValueSchema, valueRefSchema } from './schema';

const done = () => revalidatePath('/admin/option-lists');

/**
 * Create or edit a value. Editing a platform default stores an organisation row with the same key (the default itself
 * never changes), so "Reset to default" can bring the original back.
 */
export const saveValueAction = action(
  { permission: 'admin.lists.manage', schema: saveValueSchema },
  async (input, ctx) => {
    const values = {
      label_en: input.labelEn,
      label_hi: input.labelHi || null,
      color: input.color || null,
      sort_order: input.sortOrder,
      active: input.active,
    };
    const { data: existing } = await ctx.supabase
      .from('lookup_values')
      .select('id')
      .eq('organization_id', ctx.orgId)
      .eq('list_key', input.listKey)
      .eq('value_key', input.valueKey)
      .maybeSingle();
    if (existing) check(await ctx.supabase.from('lookup_values').update(values).eq('id', existing.id));
    else
      check(
        await ctx.supabase
          .from('lookup_values')
          .insert({ organization_id: ctx.orgId, list_key: input.listKey, value_key: input.valueKey, ...values }),
      );
    done();
    return null;
  },
);

/** Remove the organisation's override so the platform default applies again (or delete an own value). */
export const resetValueAction = action(
  { permission: 'admin.lists.manage', schema: valueRefSchema },
  async (input, ctx) => {
    check(
      await ctx.supabase
        .from('lookup_values')
        .delete()
        .eq('organization_id', ctx.orgId)
        .eq('list_key', input.listKey)
        .eq('value_key', input.valueKey),
    );
    done();
    return null;
  },
);

/** Export the filtered list (same filters as the screen). */
export const exportValuesAction = action(
  { permission: 'data.export', schema: exportSchema, allowReadOnly: true },
  async (input, ctx) => {
    const locale = (await getLocale()) === 'hi' ? 'hi' : 'en';
    const q = parseListQuery(new URLSearchParams(input.query), {
      filters: ['active'],
      sorts: ['label_en', 'value_key', 'sort_order'],
    });
    const { rows } = await listValues(ctx.orgId, input.listKey, { ...q, page: 1, size: 100_000 });
    const fields = (await resolveFields(ctx.orgId, 'lookup_values', locale)).filter((f) => f.showInTable);
    const title = `${input.listKey}`;
    if (input.format === 'pdf' && rows.length > INLINE_PDF_ROWS) {
      await sendJob('pdf/render.requested', {
        orgId: ctx.orgId,
        userId: ctx.user.id,
        template: 'table',
        title,
        fileName: `${title}.pdf`,
        payload: {
          headers: fields.map((f) => f.label),
          rows: rows.map((r) => fields.map((f) => String((r as Record<string, unknown>)[f.key] ?? ''))),
          locale,
        },
      });
      return { queued: true as const };
    }
    return buildExport({
      title,
      baseName: input.listKey,
      fields,
      rows: rows as unknown as Record<string, unknown>[],
      locale,
      format: input.format,
      orgName: ctx.org.organization.name,
    });
  },
);
