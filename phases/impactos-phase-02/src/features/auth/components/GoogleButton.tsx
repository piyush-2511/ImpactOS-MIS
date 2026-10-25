'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function GoogleButton({ next, invite }: { next?: string; invite?: string }) {
  const t = useTranslations('auth');
  const [pending, setPending] = useState(false);
  async function go() {
    setPending(true);
    const params = new URLSearchParams();
    if (next) params.set('next', next);
    if (invite) params.set('invite', invite);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback?${params}`, queryParams: { prompt: 'select_account' } },
    });
    if (error) setPending(false);
  }
  return (
    <Button type="button" variant="outline" onClick={go} disabled={pending}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-4">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
      </svg>
      {t('actions.google')}
    </Button>
  );
}
