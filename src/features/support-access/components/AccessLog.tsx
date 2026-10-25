import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import type { AccessRow } from '../queries';

/** Every page ImpactOS staff opened under a grant (newest first). */
export async function AccessLog({ rows, when }: { rows: AccessRow[]; when: Record<number, string> }) {
  const t = await getTranslations('billing.support');
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{t('logTitle')}</CardTitle>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('logEmpty')}</p>
      ) : (
        <ol className="flex flex-col">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 border-t border-border/60 py-2 text-sm first:border-t-0"
            >
              <span className="w-36 font-mono text-xs text-muted-foreground">{when[r.id]}</span>
              <span className="flex-1">{r.view}</span>
              {r.breakGlass && <Badge tone="warn">{t('breakGlass')}</Badge>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
