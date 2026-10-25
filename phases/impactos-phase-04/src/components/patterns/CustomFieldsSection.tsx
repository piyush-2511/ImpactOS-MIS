'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { ResolvedField } from '@/lib/fields/types';
import { optionLabel } from '@/lib/fields/merge';
import type { ActionResult } from '@/lib/actions/result';
import { FieldInput } from './RecordForm';

/** The organisation's own fields on a record (right panel or detail page): read view, or edit when allowed. */
export function CustomFieldsSection({
  fields,
  values,
  editable,
  onSave,
  locale,
}: {
  fields: ResolvedField[];
  values: Record<string, unknown>;
  editable: boolean;
  onSave: (v: Record<string, unknown>) => Promise<ActionResult<unknown>>;
  locale: 'en' | 'hi';
}) {
  const t = useTranslations('engine.form');
  const custom = fields.filter((f) => !f.builtin);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  if (!custom.length) return null;

  const show = (f: ResolvedField, v: unknown) => {
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.map((x) => optionLabel(f, String(x), locale)).join(', ');
    if (f.type === 'boolean') return v ? t('yes') : t('no');
    if (f.type === 'select') return optionLabel(f, String(v), locale);
    if (f.type === 'file') return t('attached');
    return String(v);
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('moreDetails')}</h3>
        {editable && !edit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(values);
              setEdit(true);
            }}
          >
            {t('edit')}
          </Button>
        )}
      </div>
      {edit ? (
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await onSave(draft);
              if (!r.ok) {
                setErrors(r.fieldErrors ?? {});
                if (r.error !== 'invalid') toast.error(t(`errors.${r.error}`));
                return;
              }
              toast.success(t('saved'));
              setEdit(false);
            });
          }}
        >
          {custom.map((f) => (
            <FieldInput
              key={f.key}
              field={f}
              value={draft[f.key]}
              onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
              error={errors[f.key]}
              locale={locale}
            />
          ))}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {t('save')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEdit(false)} disabled={pending}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {custom.map((f) => (
            <div key={f.key}>
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="font-semibold break-words">{show(f, values[f.key])}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
