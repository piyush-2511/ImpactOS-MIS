import { getTranslations } from 'next-intl/server';
import type { Json } from '@/lib/supabase/database.types';

const HIDDEN = new Set(['token_hash', 'created_at', 'updated_at', 'updated_by']);
const show = (v: Json | undefined) =>
  v === undefined || v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);

/** Before/after of the fields that changed. Secrets (token hashes) are never shown. */
export async function DiffView({
  before,
  after,
  changed,
}: {
  before: Json | null;
  after: Json | null;
  changed: string[] | null;
}) {
  const t = await getTranslations('admin.audit');
  const b = (before ?? {}) as Record<string, Json>;
  const a = (after ?? {}) as Record<string, Json>;
  const keys = (changed ?? Object.keys({ ...b, ...a })).filter((k) => !HIDDEN.has(k));
  if (!keys.length) return <p className="text-sm text-muted-foreground">{t('noFields')}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 pr-3 font-semibold">{t('field')}</th>
            <th className="py-1 pr-3 font-semibold">{t('before')}</th>
            <th className="py-1 font-semibold">{t('after')}</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k} className="border-t border-border/60 align-top">
              <td className="py-1.5 pr-3 font-mono text-xs">{k}</td>
              <td className="py-1.5 pr-3 font-mono text-xs break-all text-bad-fg">{show(b[k])}</td>
              <td className="py-1.5 font-mono text-xs break-all text-ok-fg">{show(a[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
