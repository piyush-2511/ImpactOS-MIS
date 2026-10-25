'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Labelled input with an accessible, translated error message. Shared by the auth forms. */
export function Field({ name, label, error, hint, ...props }: React.ComponentProps<typeof Input> & { name: string; label: string; error?: string; hint?: string }) {
  const t = useTranslations('auth.errors');
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...props} />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="text-sm font-medium text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  );
}

export function FormError({ code }: { code?: string }) {
  const t = useTranslations('auth.errors');
  if (!code) return null;
  return (
    <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad-fg">
      {t(code)}
    </p>
  );
}
