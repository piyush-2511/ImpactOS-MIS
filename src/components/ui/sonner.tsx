'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster(props: ToasterProps) {
  const { theme = 'system' } = useTheme();
  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      position="bottom-center"
      toastOptions={{ classNames: { toast: 'bg-primary text-primary-foreground border-0 font-semibold' } }}
      {...props}
    />
  );
}

export { Toaster };
