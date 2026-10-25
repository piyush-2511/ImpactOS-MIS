'use client';

import { useTranslations } from 'next-intl';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useRightPanel } from './RightPanelContext';

/** Escape closes it, focus is trapped while open and returned on close (Radix Dialog). */
export function RightPanel() {
  const { content, close } = useRightPanel();
  const t = useTranslations('common.shell');
  return (
    <Sheet open={!!content} onOpenChange={(o) => !o && close()}>
      <SheetContent side="right" closeLabel={t('closePanel')}>
        {content && (
          <>
            <SheetHeader>
              <SheetTitle>{content.title}</SheetTitle>
              {content.subtitle ? <SheetDescription className="font-mono">{content.subtitle}</SheetDescription> : <SheetDescription className="sr-only">{content.title}</SheetDescription>}
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{content.body}</div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
