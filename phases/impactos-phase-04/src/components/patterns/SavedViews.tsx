'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BookmarkIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { deleteViewAction, saveViewAction } from '@/lib/views/actions';

export type SavedView = { id: string; name: string; query: string; shared: boolean; mine: boolean };

/** Named filters + sort for a list page ("Gaya field team"); own views or shared with the organisation. */
export function SavedViews({ entity, views }: { entity: string; views: SavedView[] }) {
  const t = useTranslations('engine.views');
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const [pending, start] = useTransition();
  const current = sp.toString();
  const active = views.find((v) => v.query === current);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <BookmarkIcon aria-hidden /> {active ? active.name : t('views')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3">
        {views.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('none')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {views.map((v) => (
              <li key={v.id} className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 justify-start"
                  onClick={() => router.push(`${path}${v.query ? `?${v.query}` : ''}`)}
                >
                  {v.name}
                  {v.shared && <span className="ml-1 text-xs text-muted-foreground">{t('sharedTag')}</span>}
                </Button>
                {v.mine && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    aria-label={t('delete', { name: v.name })}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await deleteViewAction({ id: v.id, path });
                        if (r.ok) router.refresh();
                      })
                    }
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-col gap-2 border-t border-border/60 pt-3"
          action={() =>
            start(async () => {
              const r = await saveViewAction({ entity, name, state: { query: current }, shared, path });
              if (!r.ok) return void toast.error(t('saveFailed'));
              toast.success(t('saved'));
              setName('');
              router.refresh();
            })
          }
        >
          <Label htmlFor="sv-name">{t('saveCurrent')}</Label>
          <Input
            id="sv-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            maxLength={60}
            required
          />
          <div className="flex items-center gap-2">
            <Checkbox id="sv-shared" checked={shared} onCheckedChange={(v) => setShared(v === true)} />
            <Label htmlFor="sv-shared" className="font-normal">
              {t('share')}
            </Label>
          </div>
          <Button type="submit" size="sm" disabled={pending || !name.trim()}>
            {t('save')}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
