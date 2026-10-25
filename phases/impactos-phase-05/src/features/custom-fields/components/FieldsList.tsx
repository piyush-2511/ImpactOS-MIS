'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { mergeFields } from '@/lib/fields/merge';
import type { EntityDef } from '@/lib/fields/types';
import type { Database } from '@/lib/supabase/database.types';
import { valueKeyFrom } from '@/features/option-lists/schema';
import { saveFieldsAction } from '../actions';
import { customKeyFrom } from '../schema';
import type { CustomRow, SettingRow } from '../queries';
import { AddFieldForm } from './AddFieldForm';
import { FieldsTable, type EditableField } from './FieldsTable';
import { LivePreview } from './LivePreview';

/**
 * Admin → Fields and columns editor (approved design: prototype #/admin/custom-fields). Edits are local until Save;
 * the live preview uses the same merge rules as the server.
 */
export function FieldsList({
  entity,
  settings,
  customs,
  sampleRows,
  locale,
  canEdit,
  maxCustom,
}: {
  /** Custom field limit from the organisation's plan (null = unlimited). */
  maxCustom: number | null;
  entity: EntityDef;
  settings: SettingRow[];
  customs: CustomRow[];
  sampleRows: Record<string, unknown>[];
  locale: 'en' | 'hi';
  canEdit: boolean;
}) {
  const t = useTranslations('engine.fields');
  const router = useRouter();
  const [pending, start] = useTransition();
  const initial = useMemo<EditableField[]>(
    () =>
      mergeFields(entity, settings, customs, locale).map((f) => {
        const def = entity.fields.find((b) => b.key === f.key);
        const c = customs.find((x) => x.key === f.key);
        return {
          key: f.key,
          builtin: f.builtin,
          locked: f.locked,
          canFilter: f.builtin ? !!def?.column && f.type !== 'file' : f.type !== 'file',
          type: f.type,
          id: f.customId,
          labelEn: f.labels.en,
          labelHi: f.labels.hi,
          showInTable: f.showInTable,
          filterable: f.filterable,
          required: f.required,
          section: f.section,
          sortOrder: f.sortOrder,
          options: f.options,
          helpEn: c?.help_en ?? '',
          helpHi: c?.help_hi ?? '',
          archived: false,
        };
      }),
    [entity, settings, customs, locale],
  );
  const [rows, setRows] = useState<EditableField[]>(initial);
  const live = rows.filter((r) => !r.archived);
  const customCount = live.filter((r) => !r.builtin).length;
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);

  const change = (key: string, patch: Partial<EditableField>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (key: string, dir: -1 | 1) =>
    setRows((rs) => {
      const vis = rs.filter((r) => !r.archived);
      const i = vis.findIndex((r) => r.key === key);
      const j = i + dir;
      if (j < 0 || j >= vis.length) return rs;
      [vis[i], vis[j]] = [vis[j]!, vis[i]!];
      const order = new Map(vis.map((r, k) => [r.key, (k + 1) * 10]));
      return rs
        .map((r) => (order.has(r.key) ? { ...r, sortOrder: order.get(r.key)! } : r))
        .sort((a, b) => a.sortOrder - b.sortOrder);
    });
  const remove = (key: string) =>
    setRows((rs) => rs.flatMap((r) => (r.key !== key ? [r] : r.isNew ? [] : [{ ...r, archived: true }])));

  const preview = useMemo(
    () =>
      mergeFields(
        { ...entity, fields: entity.fields.map((b) => ({ ...b, type: b.type })) },
        rows
          .filter((r) => r.builtin)
          .map((r) => ({
            organization_id: '',
            entity: entity.key,
            field_key: r.key,
            label_en: r.labelEn,
            label_hi: r.labelHi,
            show_in_table: r.showInTable,
            filterable: r.filterable,
            required: r.required,
            section: r.section,
            sort_order: r.sortOrder,
            updated_at: '',
            updated_by: null,
          })),
        rows
          .filter((r) => !r.builtin && !r.archived)
          .map((r) => ({
            id: r.id ?? r.key,
            organization_id: '',
            entity: entity.key,
            key: r.key,
            label_en: r.labelEn,
            label_hi: r.labelHi || null,
            type: r.type,
            options: r.options as unknown as Database['public']['Tables']['custom_field_definitions']['Row']['options'],
            help_en: null,
            help_hi: null,
            required: r.required,
            show_in_table: r.showInTable,
            filterable: r.filterable,
            section: r.section,
            sort_order: r.sortOrder,
            archived_at: null,
            created_at: '',
            updated_at: '',
            updated_by: null,
            created_by: null,
          })),
        locale,
      ),
    [rows, entity, locale],
  );

  function save() {
    start(async () => {
      const res = await saveFieldsAction({
        entity: entity.key,
        builtins: rows
          .filter((r) => r.builtin)
          .map((r) => ({
            key: r.key,
            labelEn: r.labelEn,
            labelHi: r.labelHi,
            showInTable: r.showInTable,
            filterable: r.filterable,
            required: r.required,
            section: r.section,
            sortOrder: r.sortOrder,
          })),
        customs: rows
          .filter((r) => !r.builtin)
          .map((r) => ({
            id: r.id,
            key: r.isNew ? undefined : r.key,
            labelEn: r.labelEn,
            labelHi: r.labelHi,
            type: r.type,
            options: r.options.map((o) => ({ ...o, label_hi: o.label_hi || null })),
            helpEn: r.helpEn,
            helpHi: r.helpHi,
            required: r.required,
            showInTable: r.showInTable,
            filterable: r.filterable,
            section: r.section,
            sortOrder: r.sortOrder,
            archived: r.archived,
          })),
      });
      if (!res.ok) {
        const first = res.fieldErrors ? Object.values(res.fieldErrors)[0] : undefined;
        return void toast.error(t(`errors.${first ?? res.error}`));
      }
      toast.success(t('saved'));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg bg-info-bg px-3 py-2 text-sm text-info-fg">{t('builtinNote')}</p>
      <FieldsTable rows={live} sections={entity.sections} onChange={change} onMove={move} onRemove={remove} />
      {canEdit && (
        <AddFieldForm
          disabled={customCount >= (maxCustom ?? 999)}
          onAdd={(f) =>
            setRows((rs) => [
              ...rs,
              {
                key: `${customKeyFrom(f.labelEn)}_${rs.length}`,
                builtin: false,
                locked: false,
                canFilter: f.type !== 'file',
                type: f.type,
                labelEn: f.labelEn,
                labelHi: f.labelHi,
                showInTable: f.showInTable,
                filterable: f.filterable,
                required: false,
                section: entity.sections.at(-1) ?? 'other',
                sortOrder: (rs.at(-1)?.sortOrder ?? 0) + 10,
                options: f.options.map((o) => ({ key: valueKeyFrom(o) || o, label_en: o, label_hi: '' })),
                helpEn: '',
                helpHi: '',
                archived: false,
                isNew: true,
              },
            ])
          }
        />
      )}
      <LivePreview
        fields={preview}
        rows={sampleRows}
        title={locale === 'hi' ? entity.label.hi : entity.label.en}
        locale={locale}
      />
      {canEdit && (
        <div className="sticky bottom-0 flex items-center justify-end gap-3 bg-gradient-to-t from-background from-60% to-transparent py-3">
          <span className="text-sm text-muted-foreground">
            {t('customUsed', { n: customCount, max: maxCustom ?? 999 })}
          </span>
          <Button variant="outline" disabled={!dirty || pending} onClick={() => setRows(initial)}>
            {t('discard')}
          </Button>
          <Button disabled={!dirty || pending} onClick={save}>
            {pending ? t('saving') : t('save')}
          </Button>
        </div>
      )}
    </div>
  );
}
