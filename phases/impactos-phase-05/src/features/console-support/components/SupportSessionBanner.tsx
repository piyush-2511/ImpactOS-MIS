import { getTranslations } from 'next-intl/server';

/** Shown above organisation data in the console: what grant is in use, until when, and that views are logged. */
export async function SupportSessionBanner({
  org,
  until,
  breakGlass,
}: {
  org: string;
  until: string;
  breakGlass: boolean;
}) {
  const t = await getTranslations('console.session');
  return (
    <p
      role="status"
      className={`rounded-lg px-3 py-2 text-sm ${breakGlass ? 'bg-bad-bg text-bad-fg' : 'bg-warn-bg text-warn-fg'}`}
    >
      {t(breakGlass ? 'breakGlass' : 'grant', { org, until })} {t('logged')}
    </p>
  );
}
