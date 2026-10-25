/**
 * CI check (hard rule 7): every namespace in src/lib/i18n/namespaces.ts must exist in every locale,
 * and every key in one locale must exist in the other, with non-empty values.
 * Run: npm run i18n:check
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES } from '../src/lib/i18n/config';
import { NAMESPACES } from '../src/lib/i18n/namespaces';

type Json = { [k: string]: string | Json };
const root = join(process.cwd(), 'src', 'messages');

function flatten(obj: Json, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}

const problems: string[] = [];
for (const ns of NAMESPACES) {
  const maps = new Map<string, Map<string, string>>();
  for (const locale of LOCALES) {
    const file = join(root, locale, `${ns}.json`);
    if (!existsSync(file)) {
      problems.push(`missing file: src/messages/${locale}/${ns}.json`);
      continue;
    }
    maps.set(locale, flatten(JSON.parse(readFileSync(file, 'utf8')) as Json));
  }
  const all = new Set([...maps.values()].flatMap((m) => [...m.keys()]));
  for (const key of all) {
    for (const [locale, m] of maps) {
      if (!m.has(key)) problems.push(`${locale}/${ns}.json is missing "${key}"`);
      else if (!m.get(key)?.trim()) problems.push(`${locale}/${ns}.json has an empty value for "${key}"`);
    }
  }
}

if (problems.length) {
  console.error(`i18n check failed (${problems.length}):\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`i18n check passed: ${NAMESPACES.length} namespaces × ${LOCALES.length} locales`);
