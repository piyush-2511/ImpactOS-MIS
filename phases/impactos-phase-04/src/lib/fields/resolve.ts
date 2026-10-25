import 'server-only';
import type { Database } from '@/lib/supabase/database.types';
import { supabaseServer } from '@/lib/supabase/server';
import { mergeFields } from './merge';
import { getEntity } from './registry';
import type { ResolvedField } from './types';

export * from './merge';

type CustomDef = Database['public']['Tables']['custom_field_definitions']['Row'];

/** Server: resolve an entity's fields (built-in + field settings + custom fields) for an organisation. */
export async function resolveFields(orgId: string, entityKey: string, locale: 'en' | 'hi'): Promise<ResolvedField[]> {
  const entity = getEntity(entityKey);
  if (!entity) throw new Error(`Unknown entity ${entityKey}`);
  const supabase = await supabaseServer();
  const [{ data: settings }, { data: customs }] = await Promise.all([
    supabase.from('field_settings').select('*').eq('organization_id', orgId).eq('entity', entityKey),
    entity.customFields
      ? supabase
          .from('custom_field_definitions')
          .select('*')
          .eq('organization_id', orgId)
          .eq('entity', entityKey)
          .is('archived_at', null)
      : Promise.resolve({ data: [] as CustomDef[] }),
  ]);
  return mergeFields(entity, settings ?? [], customs ?? [], locale);
}
