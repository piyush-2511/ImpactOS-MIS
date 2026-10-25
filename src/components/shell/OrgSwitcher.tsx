'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronDownIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { switchOrgAction } from '@/features/account/actions';

export type OrgOption = { id: string; name: string; slug: string };

/** Shows the active organisation; people in several NGOs switch here. Username accounts belong to one org only. */
export function OrgSwitcher({ active, orgs, canCreate }: { active: OrgOption; orgs: OrgOption[]; canCreate: boolean }) {
  const t = useTranslations('account.org');
  if (orgs.length <= 1 && !canCreate) {
    return <span className="hidden min-h-10 items-center rounded-lg border border-border px-3 font-semibold sm:flex">{active.name}</span>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="max-w-[16rem] font-semibold" aria-label={t('switchLabel', { org: active.name })}>
          <span className="truncate">{active.name}</span>
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t('yourOrgs')}</DropdownMenuLabel>
        {orgs.map((o) => (
          <form key={o.id} action={switchOrgAction}>
            <input type="hidden" name="orgId" value={o.id} />
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full" aria-current={o.id === active.id ? 'true' : undefined}>
                <span className="flex flex-col items-start">
                  <span className={o.id === active.id ? 'font-semibold' : ''}>{o.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{o.slug}</span>
                </span>
              </button>
            </DropdownMenuItem>
          </form>
        ))}
        {canCreate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/setup-org?new=1" className="no-underline">
                <PlusIcon aria-hidden /> {t('create')}
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
