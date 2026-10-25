'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { savePositionAction } from '../actions';
import type { PositionRow } from '../queries';

export function PositionForm({
  position,
  roles,
  trigger,
}: {
  position?: PositionRow;
  roles: { id: string; name: string }[];
  trigger: React.ReactNode;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [committee, setCommittee] = useState(position?.isCommittee ?? false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{position ? t('positions.editTitle') : t('positions.newTitle')}</DialogTitle>
          <DialogDescription>{t('positions.formIntro')}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          action={(fd) =>
            start(async () => {
              const res = await savePositionAction({
                positionId: position?.id,
                name: fd.get('name'),
                description: fd.get('description'),
                defaultRoleId: fd.get('defaultRoleId'),
                isCommittee: committee,
              });
              if (!res.ok) return void setError(res.fieldErrors?.name ?? res.error);
              toast.success(t('positions.saved'));
              setOpen(false);
              router.refresh();
            })
          }
        >
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {t(`errors.${error}`)}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-name">{t('positions.name')}</Label>
            <Input
              id="pos-name"
              name="name"
              defaultValue={position?.name}
              placeholder={t('positions.namePlaceholder')}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-role">{t('positions.defaultRole')}</Label>
            <select
              id="pos-role"
              name="defaultRoleId"
              defaultValue={position?.defaultRoleId ?? ''}
              className="min-h-11 rounded-lg border border-input bg-card px-3"
            >
              <option value="">{t('positions.noDefaultRole')}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-desc">{t('positions.description')}</Label>
            <Textarea
              id="pos-desc"
              name="description"
              defaultValue={position?.description ?? ''}
              className="min-h-16"
            />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="pos-committee" checked={committee} onCheckedChange={(v) => setCommittee(v === true)} />
            <Label htmlFor="pos-committee" className="font-normal">
              {t('positions.isCommittee')}
            </Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {t('positions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
