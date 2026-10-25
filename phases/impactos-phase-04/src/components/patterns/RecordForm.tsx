'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ResolvedField } from '@/lib/fields/types';
import type { ActionResult } from '@/lib/actions/result';
import { cn } from '@/lib/utils';
import { FileField } from './FileField';

type Values = Record<string, unknown>;
const REQUIRED_MARK = ' *';

/** One input for a resolved field (every type ImpactOS supports). Shared by RecordForm and CustomFieldsSection. */
export function FieldInput({
  field,
  value,
  onChange,
  error,
  disabled,
  locale,
}: {
  field: ResolvedField;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  disabled?: boolean;
  locale: 'en' | 'hi';
}) {
  const t = useTranslations('engine.form');
  const id = `rf-${field.key}`;
  const label = (o: { label_en: string; label_hi?: string | null }) =>
    locale === 'hi' ? o.label_hi || o.label_en : o.label_en;
  const describedBy =
    [field.help ? `${id}-help` : null, error ? `${id}-err` : null].filter(Boolean).join(' ') || undefined;
  let input: React.ReactNode;
  switch (field.type) {
    case 'boolean':
      input = (
        <div className="flex min-h-11 items-center gap-2">
          <Checkbox
            id={id}
            checked={value === true}
            onCheckedChange={(v) => onChange(v === true)}
            disabled={disabled}
            aria-describedby={describedBy}
          />
          <Label htmlFor={id} className="font-normal">
            {t('yes')}
          </Label>
        </div>
      );
      break;
    case 'select':
      input = (
        <select
          id={id}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className="min-h-11 rounded-lg border border-input bg-card px-3"
        >
          <option value="">{t('choose')}</option>
          {field.options.map((o) => (
            <option key={o.key} value={o.key}>
              {label(o)}
            </option>
          ))}
        </select>
      );
      break;
    case 'multiselect': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      input = (
        <fieldset className="flex flex-wrap gap-3" aria-describedby={describedBy}>
          {field.options.map((o) => (
            <span key={o.key} className="flex items-center gap-2">
              <Checkbox
                id={`${id}-${o.key}`}
                checked={arr.includes(o.key)}
                disabled={disabled}
                onCheckedChange={(v) => onChange(v === true ? [...arr, o.key] : arr.filter((x) => x !== o.key))}
              />
              <Label htmlFor={`${id}-${o.key}`} className="font-normal">
                {label(o)}
              </Label>
            </span>
          ))}
        </fieldset>
      );
      break;
    }
    case 'file':
      input = (
        <FileField
          id={id}
          purpose="attachment"
          value={typeof value === 'string' ? { id: value, name: t('attached') } : null}
          onChange={(f) => onChange(f?.id ?? null)}
          disabled={disabled}
        />
      );
      break;
    case 'number':
      input = (
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy}
        />
      );
      break;
    default:
      input =
        field.type === 'text' && field.key.endsWith('notes') ? (
          <Textarea
            id={id}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
        ) : (
          <Input
            id={id}
            type={
              field.type === 'date'
                ? 'date'
                : field.type === 'email'
                  ? 'email'
                  : field.type === 'phone'
                    ? 'tel'
                    : 'text'
            }
            inputMode={field.type === 'phone' ? 'tel' : undefined}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
        );
  }
  return (
    <div className={cn('flex flex-col gap-1.5', field.type === 'multiselect' && 'sm:col-span-2')}>
      {field.type !== 'boolean' ? (
        <Label htmlFor={id}>
          {field.label}
          {field.required && (
            <span aria-hidden className="text-destructive">
              {REQUIRED_MARK}
            </span>
          )}
        </Label>
      ) : (
        <span className="text-sm font-semibold">{field.label}</span>
      )}
      {input}
      {field.help && (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {field.help}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="text-sm font-medium text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}

/**
 * Generic record form built from resolved fields, grouped by section, with a sticky save bar and (optionally) a
 * draft kept in this browser until saved. The server action validates again with the same rules.
 */
export function RecordForm({
  fields,
  initial,
  onSubmit,
  draftKey,
  submitLabel,
  sectionLabels,
  locale,
}: {
  fields: ResolvedField[];
  initial: Values;
  onSubmit: (v: Values) => Promise<ActionResult<unknown>>;
  draftKey?: string;
  submitLabel: string;
  sectionLabels: Record<string, string>;
  locale: 'en' | 'hi';
}) {
  const t = useTranslations('engine.form');
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, start] = useTransition();
  const sections = useMemo(() => [...new Set(fields.map((f) => f.section))], [fields]);

  useEffect(() => {
    if (!draftKey) return;
    try {
      const d = window.localStorage.getItem(`ios:draft:${draftKey}`);
      // Restoring an unsaved draft after mount (browser storage is unavailable during server render).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (d) setValues((v) => ({ ...v, ...JSON.parse(d) }));
    } catch {
      /* ignore */
    }
  }, [draftKey]);
  const set = (k: string, v: unknown) =>
    setValues((prev) => {
      const next = { ...prev, [k]: v };
      if (draftKey)
        try {
          window.localStorage.setItem(`ios:draft:${draftKey}`, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      return next;
    });

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setFormError(undefined);
        start(async () => {
          const r = await onSubmit(values);
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            if (r.error !== 'invalid') setFormError(r.error);
            return;
          }
          setErrors({});
          if (draftKey)
            try {
              window.localStorage.removeItem(`ios:draft:${draftKey}`);
            } catch {
              /* ignore */
            }
        });
      }}
    >
      {formError && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad-fg">
          {t(`errors.${formError}`)}
        </p>
      )}
      {sections.map((s) => (
        <section key={s} className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-sm">
          <h2 className="text-[17px] font-semibold">{sectionLabels[s] ?? s}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields
              .filter((f) => f.section === s)
              .map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={values[f.key]}
                  onChange={(v) => set(f.key, v)}
                  error={errors[f.key]}
                  locale={locale}
                />
              ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-0 flex justify-end gap-2 bg-gradient-to-t from-background from-60% to-transparent py-3">
        <Button type="submit" disabled={pending}>
          {pending ? t('saving') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
