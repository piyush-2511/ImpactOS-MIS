import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** Status chips. Always show text; colour is never the only signal. */
const badgeVariants = cva('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    tone: {
      neutral: 'bg-neutral-bg text-neutral-fg',
      ok: 'bg-ok-bg text-ok-fg',
      info: 'bg-info-bg text-info-fg',
      warn: 'bg-warn-bg text-warn-fg',
      bad: 'bg-bad-bg text-bad-fg',
      idea: 'bg-idea-bg text-idea-fg',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

function Badge({ className, tone, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
