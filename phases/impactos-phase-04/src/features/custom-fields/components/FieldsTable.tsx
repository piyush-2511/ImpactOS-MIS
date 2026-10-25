'use client';

import { useTranslations } from 'next-intl';
import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FieldOption, FieldType } from '@/lib/fields/types';
import { FieldEditor } from './FieldEditor';

export type EditableField = {
  key: string;
  builtin: boolean;
  locked: boolean;
  canFilter: boolean;
  type: FieldType;
  id?: string;
  labelEn: string;
  labelHi: string;
  showInTable: boolean;
  filterable: boolean;
  required: boolean;
  section: string;
  sortOrder: number;
  options: FieldOption[];
  helpEn: string;
  helpHi: string;
  archived: boolean;
  isNew?: boolean;
};

const TYPES: FieldType[] = ['text', 'number', 'date', 'select', 'multiselect', 'boolean', 'phone', 'email', 'file'];

/** One row per field: labels, type (custom only), options, section, required / column / filter, order, delete. */
export function FieldsTable({
  rows,
  sections,
  onChange,
  onMove,
  onRemove,
}: {
  rows: EditableField[];
  sections: string[];
  onChange: (key: string, patch: Partial<EditableField>) => void;
  onMove: (key: string, dir: -1 | 1) => void;
  onRemove: (key: string) => void;
}) {
  const t = useTranslations('engine.fields');
  return (
    <div className="overflow-x-auto rounded-xl bg-card shadow-sm">
      <table className="w-full min-w-[1080px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[12.5px] text-muted-foreground">
            <th className="px-3 py-3 font-semibold">{t('colLabel')}</th>
            <th className="px-3 py-3 font-semibold">{t('colLabelHi')}</th>
            <th className="px-3 py-3 font-semibold">{t('colType')}</th>
            <th className="px-3 py-3 font-semibold">{t('colOptions')}</th>
            <th className="px-3 py-3 font-semibold">{t('colSection')}</th>
            <th className="px-3 py-3 text-center font-semibold">{t('colRequired')}</th>
            <th className="px-3 py-3 text-center font-semibold">{t('colColumn')}</th>
            <th className="px-3 py-3 text-center font-semibold">{t('colFilter')}</th>
            <th className="px-3 py-3 font-semibold">
              <span className="sr-only">{t('colActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f, i) => (
            <tr key={f.key} className="border-t border-border/60 align-middle">
              <td className="px-3 py-2">
                <Input
                  aria-label={t('labelFor', { field: f.labelEn || f.key })}
                  value={f.labelEn}
                  onChange={(e) => onChange(f.key, { labelEn: e.target.value })}
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  lang="hi"
                  aria-label={t('labelHiFor', { field: f.labelEn || f.key })}
                  value={f.labelHi}
                  onChange={(e) => onChange(f.key, { labelHi: e.target.value })}
                />
              </td>
              <td className="px-3 py-2">
                {f.builtin ? (
                  <span className="flex min-h-11 items-center gap-2" title={t('builtinTypeFixed')}>
                    {t(`types.${f.type}`)} <Badge>{t('builtIn')}</Badge>
                  </span>
                ) : (
                  <select
                    aria-label={t('typeFor', { field: f.labelEn })}
                    value={f.type}
                    onChange={(e) =>
                      onChange(f.key, {
                        type: e.target.value as FieldType,
                        filterable: e.target.value === 'file' ? false : f.filterable,
                      })
                    }
                    className="min-h-11 w-full rounded-lg border border-input bg-card px-2"
                  >
                    {TYPES.map((ty) => (
                      <option key={ty} value={ty}>
                        {t(`types.${ty}`)}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td className="px-3 py-2">
                {!f.builtin && (f.type === 'select' || f.type === 'multiselect') ? (
                  <FieldEditor
                    label={f.labelEn}
                    options={f.options}
                    helpEn={f.helpEn}
                    helpHi={f.helpHi}
                    onSave={(v) => onChange(f.key, v)}
                  />
                ) : (
                  <span className="text-muted-foreground">
                    {f.options.length ? t('optionsN', { n: f.options.length }) : '—'}
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <select
                  aria-label={t('sectionFor', { field: f.labelEn })}
                  value={f.section}
                  onChange={(e) => onChange(f.key, { section: e.target.value })}
                  className="min-h-11 rounded-lg border border-input bg-card px-2"
                >
                  {sections.map((s) => (
                    <option key={s} value={s}>
                      {t(`sections.${s}`)}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  className="size-5"
                  aria-label={t('requiredFor', { field: f.labelEn })}
                  checked={f.required}
                  disabled={f.locked}
                  onChange={(e) => onChange(f.key, { required: e.target.checked })}
                />
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  className="size-5"
                  aria-label={t('columnFor', { field: f.labelEn })}
                  checked={f.showInTable}
                  disabled={f.locked}
                  onChange={(e) => onChange(f.key, { showInTable: e.target.checked })}
                />
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  className="size-5"
                  aria-label={t('filterFor', { field: f.labelEn })}
                  checked={f.filterable}
                  disabled={!f.canFilter || f.type === 'file'}
                  onChange={(e) => onChange(f.key, { filterable: e.target.checked })}
                />
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    aria-label={t('moveUp', { field: f.labelEn })}
                    disabled={i === 0}
                    onClick={() => onMove(f.key, -1)}
                  >
                    <ArrowUpIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    aria-label={t('moveDown', { field: f.labelEn })}
                    disabled={i === rows.length - 1}
                    onClick={() => onMove(f.key, 1)}
                  >
                    <ArrowDownIcon aria-hidden />
                  </Button>
                  {!f.builtin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      aria-label={t('deleteField', { field: f.labelEn })}
                      onClick={() => onRemove(f.key)}
                    >
                      <Trash2Icon aria-hidden />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
