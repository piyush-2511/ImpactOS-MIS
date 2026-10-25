'use client';

import { useActionState, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { setupOrgAction } from '../actions';
import { slugify, type ActionState } from '../schema';
import { Field, FormError } from './Field';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'];
type SlugState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function SetupOrgForm({ rootDomain }: { rootDomain: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [state, action, pending] = useActionState<ActionState, FormData>(setupOrgAction, {});
  const [name, setName] = useState(state.values?.name ?? '');
  const [slug, setSlug] = useState(state.values?.slug ?? '');
  const [touched, setTouched] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>('idle');

  const effectiveSlug = touched ? slug : slugify(name);
  useEffect(() => {
    if (!effectiveSlug) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      setSlugState('checking');
      try {
        const res = await fetch(`/api/auth/slug-check?slug=${encodeURIComponent(effectiveSlug)}`, { signal: ctrl.signal });
        const json = (await res.json()) as { available?: boolean; valid?: boolean };
        setSlugState(!json.valid ? 'invalid' : json.available ? 'available' : 'taken');
      } catch {
        /* aborted */
      }
    }, 400);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [effectiveSlug]);

  const slugMsg = { idle: '', checking: t('setupOrg.slugChecking'), available: t('setupOrg.slugAvailable', { url: `${effectiveSlug}.${rootDomain}` }), taken: t('errors.slugTaken'), invalid: t('errors.slugInvalid') }[slugState];

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormError code={state.error} />
      <Field name="name" label={t('fields.orgName')} value={name} onChange={(e) => setName(e.target.value)} error={state.fieldErrors?.name} required />
      <div className="flex flex-col gap-1.5">
        <Field name="slug" label={t('fields.slug')} value={effectiveSlug} onChange={(e) => { setTouched(true); setSlug(e.target.value.toLowerCase()); }} autoCapitalize="none" error={state.fieldErrors?.slug} required aria-describedby="slug-status" />
        <p id="slug-status" role="status" className={slugState === 'available' ? 'text-sm text-ok-fg' : slugState === 'taken' || slugState === 'invalid' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
          {slugMsg || t('setupOrg.slugHint')}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-legalForm">{t('fields.legalForm')}</Label>
        <select id="f-legalForm" name="legalForm" defaultValue={state.values?.legalForm ?? ''} required className="min-h-11 rounded-lg border border-input bg-card px-3">
          <option value="" disabled>{t('fields.choose')}</option>
          <option value="trust">{t('legalForms.trust')}</option>
          <option value="society">{t('legalForms.society')}</option>
          <option value="section8">{t('legalForms.section8')}</option>
          <option value="other">{t('legalForms.other')}</option>
        </select>
        {state.fieldErrors?.legalForm && <p role="alert" className="text-sm text-destructive">{t(`errors.${state.fieldErrors.legalForm}`)}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-state">{t('fields.state')}</Label>
          <select id="f-state" name="state" defaultValue={state.values?.state ?? ''} required className="min-h-11 rounded-lg border border-input bg-card px-3">
            <option value="" disabled>{t('fields.choose')}</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Field name="district" label={t('fields.district')} defaultValue={state.values?.district} error={state.fieldErrors?.district} />
      </div>
      <Field name="pan" label={t('fields.pan')} hint={t('fields.panHint')} autoCapitalize="characters" maxLength={10} defaultValue={state.values?.pan} error={state.fieldErrors?.pan} />
      <div className="flex items-center gap-3">
        <Checkbox id="f-fcra" name="fcra" defaultChecked={state.values?.fcra === 'true'} />
        <Label htmlFor="f-fcra" className="font-normal">{t('fields.fcra')}</Label>
      </div>
      <input type="hidden" name="locale" value={locale} />
      <Button type="submit" disabled={pending || slugState === 'taken' || slugState === 'invalid'}>
        {pending ? t('actions.creating') : t('actions.startTrial')}
      </Button>
    </form>
  );
}
