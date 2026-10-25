'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { SearchIcon } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { searchAction, type SearchHit } from '@/lib/search/search';

/** Top bar search (press "/" anywhere). Searches only what the user is allowed to see. */
export function GlobalSearch() {
  const t = useTranslations('engine.search');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    const id = setTimeout(() => {
      if (term.length < 2) return setHits([]);
      const mine = ++seq.current;
      start(async () => {
        const r = await searchAction(term);
        if (mine === seq.current) setHits(r);
      });
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const groups = [...new Set(hits.map((h) => h.kind))];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-10 w-full max-w-xl items-center gap-2 rounded-lg bg-secondary px-3 text-left text-sm text-muted-foreground"
      >
        <SearchIcon className="size-4" aria-hidden />
        <span className="flex-1 truncate">{t('placeholder')}</span>
        <kbd className="hidden rounded border border-border px-1.5 font-mono text-xs sm:inline">/</kbd>
      </button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setQ('');
            setHits([]);
          }
        }}
      >
        <DialogContent className="top-[15%] translate-y-0 gap-0 p-0" closeLabel={t('close')}>
          <DialogTitle className="sr-only">{t('title')}</DialogTitle>
          <Command shouldFilter={false} label={t('title')}>
            <CommandInput value={q} onValueChange={setQ} placeholder={t('placeholder')} autoFocus />
            <CommandList>
              {q.trim().length >= 2 && !pending && <CommandEmpty>{t('none')}</CommandEmpty>}
              {q.trim().length < 2 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('hint')}</p>
              )}
              {groups.map((g) => (
                <CommandGroup key={g} heading={t(`kinds.${g}`)}>
                  {hits
                    .filter((h) => h.kind === g)
                    .map((h) => (
                      <CommandItem
                        key={`${h.kind}-${h.id}`}
                        value={`${h.kind}-${h.id}`}
                        onSelect={() => {
                          setOpen(false);
                          router.push(h.href);
                        }}
                      >
                        <span className="flex flex-col">
                          <span>{h.title}</span>
                          {h.subtitle && <span className="text-xs text-muted-foreground">{h.subtitle}</span>}
                        </span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
