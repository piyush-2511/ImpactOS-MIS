'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { BreakGlassDialog } from '@/features/console-support/components/BreakGlassDialog';
import { changePlanAction, extendTrialAction, requestAccessAction, saveNotesAction, setStatusAction } from '../actions';

type Props = {
  orgId: string;
  status: string;
  planKey: string;
  period: 'monthly' | 'annual';
  plans: { key: string; name: string }[];
  notes: string;
  trialing: boolean;
  hasGrant: boolean;
};

/** Staff controls for one tenant: plan, trial, status, notes, support access. Every change is in the staff audit log. */
export function TenantDetail({ orgId, status, planKey, period, plans, notes, trialing, hasGrant }: Props) {
  const t = useTranslations('console.tenant');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draftNotes, setDraftNotes] = useState(notes);
  const done = (r: { ok: boolean; error?: string }, msg: string) => {
    if (r.ok) {
      toast.success(msg);
      router.refresh();
    } else toast.error(t(`errors.${r.error}`));
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="flex flex-col gap-3">
        <CardTitle>{t('subscription')}</CardTitle>
        <form
          className="flex flex-wrap items-end gap-2"
          action={(fd) =>
            start(async () =>
              done(
                await changePlanAction({ orgId, planKey: fd.get('plan'), period: fd.get('period') }),
                t('planChanged'),
              ),
            )
          }
        >
          <Label className="flex flex-col items-start gap-1">
            {t('plan')}
            <select
              name="plan"
              defaultValue={planKey}
              className="min-h-10 rounded-lg border border-input bg-card px-2 font-normal"
            >
              {plans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('period')}
            <select
              name="period"
              defaultValue={period}
              className="min-h-10 rounded-lg border border-input bg-card px-2 font-normal"
            >
              <option value="monthly">{t('monthly')}</option>
              <option value="annual">{t('annual')}</option>
            </select>
          </Label>
          <Button type="submit" size="sm" disabled={pending}>
            {t('applyPlan')}
          </Button>
        </form>
        {trialing && (
          <form
            className="flex flex-wrap items-end gap-2"
            action={(fd) =>
              start(async () => done(await extendTrialAction({ orgId, days: fd.get('days') }), t('trialExtended')))
            }
          >
            <Label className="flex flex-col items-start gap-1">
              {t('extendTrial')}
              <Input name="days" type="number" min={1} max={60} defaultValue={14} className="w-24" />
            </Label>
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {t('extend')}
            </Button>
          </form>
        )}
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
          {status !== 'active' && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => done(await setStatusAction({ orgId, status: 'active' }), t('statusChanged')))
              }
            >
              {t('setActive')}
            </Button>
          )}
          {status !== 'read_only' && (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant="outline" disabled={pending}>
                  {t('setReadOnly')}
                </Button>
              }
              title={t('readOnlyTitle')}
              description={t('readOnlyBody')}
              confirmLabel={t('setReadOnly')}
              cancelLabel={t('cancel')}
              onConfirm={async () => done(await setStatusAction({ orgId, status: 'read_only' }), t('statusChanged'))}
            />
          )}
          {status !== 'cancelled' && (
            <ConfirmDialog
              destructive
              trigger={
                <Button size="sm" variant="ghost" disabled={pending}>
                  {t('cancelSub')}
                </Button>
              }
              title={t('cancelTitle')}
              description={t('cancelBody')}
              confirmLabel={t('cancelSub')}
              cancelLabel={t('cancel')}
              onConfirm={async () => done(await setStatusAction({ orgId, status: 'cancelled' }), t('statusChanged'))}
            />
          )}
        </div>
      </Card>
      <Card className="flex flex-col gap-3">
        <CardTitle>{t('support')}</CardTitle>
        {hasGrant ? (
          <Badge tone="info" className="self-start">
            {t('grantActive')}
          </Badge>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noGrant')}</p>
        )}
        {!hasGrant && (
          <form
            className="flex flex-col gap-2"
            action={(fd) =>
              start(async () => done(await requestAccessAction({ orgId, reason: fd.get('reason') }), t('requested')))
            }
          >
            <Label className="flex flex-col items-start gap-1">
              {t('requestReason')}
              <Input name="reason" required minLength={10} maxLength={500} />
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {t('requestAccess')}
              </Button>
              <BreakGlassDialog orgId={orgId} />
            </div>
          </form>
        )}
        <Label className="flex flex-col items-start gap-1 border-t border-border/60 pt-3">
          {t('notes')}
          <Textarea
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            maxLength={4000}
            className="font-normal"
          />
        </Label>
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={pending || draftNotes === notes}
          onClick={() => start(async () => done(await saveNotesAction({ orgId, notes: draftNotes }), t('notesSaved')))}
        >
          {t('saveNotes')}
        </Button>
      </Card>
    </div>
  );
}
