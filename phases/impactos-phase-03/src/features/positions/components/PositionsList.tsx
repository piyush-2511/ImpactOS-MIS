'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { appointHolderAction, deletePositionAction, endHoldingAction } from '../actions';
import type { PositionRow } from '../queries';
import { PositionForm } from './PositionForm';

export function PositionsList({
  positions,
  roles,
  members,
  canManage,
  today,
}: {
  positions: PositionRow[];
  roles: { id: string; name: string }[];
  members: { id: string; name: string }[];
  canManage: boolean;
  today: string;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(okMsg);
        router.refresh();
      } else toast.error(t(`errors.${res.error}`));
    });

  if (!positions.length)
    return <p className="rounded-xl bg-card p-6 text-center text-muted-foreground">{t('positions.empty')}</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {positions.map((p) => (
        <Card key={p.id} className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-[17px] font-semibold">{p.name}</h2>
              {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
            </div>
            <div className="flex flex-wrap gap-1">
              {p.isSecretary && <Badge tone="info">{t('positions.secretaryBadge')}</Badge>}
              {p.isCommittee && <Badge tone="idea">{t('positions.committee')}</Badge>}
            </div>
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">{t('positions.defaultRole')}: </span>
            {p.defaultRole ?? '—'}
          </p>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t('positions.heldBy')}</span>
            {p.holders.length === 0 && <span className="text-sm text-muted-foreground">{t('positions.vacant')}</span>}
            {p.holders.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-semibold">{h.name}</span>{' '}
                  <span className="text-muted-foreground">· {t('positions.since', { date: h.fromDate })}</span>
                </span>
                {canManage && !p.isSecretary && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => endHoldingAction({ holderId: h.id }), t('positions.ended'))}
                  >
                    {t('positions.end')}
                  </Button>
                )}
              </div>
            ))}
          </div>
          {p.isSecretary && <p className="text-xs text-muted-foreground">{t('positions.secretaryNote')}</p>}
          {canManage && !p.isSecretary && (
            <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-3">
              <form
                className="flex flex-1 flex-wrap items-end gap-2"
                action={(fd) =>
                  run(
                    () =>
                      appointHolderAction({
                        positionId: p.id,
                        memberId: fd.get('memberId'),
                        fromDate: fd.get('fromDate'),
                      }),
                    t('positions.appointed'),
                  )
                }
              >
                <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm font-semibold">
                  {t('positions.appoint')}
                  <select
                    name="memberId"
                    required
                    defaultValue=""
                    className="min-h-10 rounded-lg border border-input bg-card px-2 font-normal"
                  >
                    <option value="" disabled>
                      {t('positions.choosePerson')}
                    </option>
                    {members
                      .filter((m) => !p.holders.some((h) => h.memberId === m.id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  {t('positions.from')}
                  <input
                    type="date"
                    name="fromDate"
                    defaultValue={today}
                    required
                    className="min-h-10 rounded-lg border border-input bg-card px-2 font-normal"
                  />
                </label>
                <Button type="submit" size="sm" disabled={pending}>
                  {t('positions.appointButton')}
                </Button>
              </form>
              <PositionForm
                position={p}
                roles={roles}
                trigger={
                  <Button type="button" size="sm" variant="outline">
                    {t('positions.edit')}
                  </Button>
                }
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => run(() => deletePositionAction({ positionId: p.id }), t('positions.deleted'))}
              >
                {t('positions.delete')}
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
