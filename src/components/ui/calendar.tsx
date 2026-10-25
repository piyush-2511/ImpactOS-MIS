'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { enIN, hi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

/** Date picker grid. Weeks start on Monday; pass language="hi" for Hindi month and day names. */
function Calendar({ className, classNames, language = 'en', ...props }: React.ComponentProps<typeof DayPicker> & { language?: 'en' | 'hi' }) {
  return (
    <DayPicker
      locale={language === 'hi' ? hi : enIN}
      weekStartsOn={1}
      showOutsideDays
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month: 'flex flex-col gap-3',
        month_caption: 'flex h-9 items-center justify-center text-sm font-semibold',
        nav: 'absolute inset-x-3 top-3 flex justify-between',
        button_previous: cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'size-9 p-0'),
        button_next: cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'size-9 p-0'),
        weekdays: 'flex',
        weekday: 'w-10 text-center text-xs font-medium text-muted-foreground',
        week: 'mt-1 flex',
        day: 'size-10 p-0 text-center text-sm',
        day_button: 'size-10 rounded-lg hover:bg-secondary aria-selected:bg-primary aria-selected:text-primary-foreground',
        today: 'font-bold text-link',
        outside: 'text-muted-foreground opacity-60',
        disabled: 'opacity-40',
        ...classNames,
      }}
      {...props}
    />
  );
}

export { Calendar };
