import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/authz/can';
import { requireUser } from '@/lib/auth/user';
import { configurableEntities, getEntity } from '@/lib/fields/registry';
import { EntityPicker } from '@/features/custom-fields/components/EntityPicker';
import { FieldsList } from '@/features/custom-fields/components/FieldsList';
import { fieldConfig, previewRows } from '@/features/custom-fields/queries';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('engine.fields'))('title') };
}

/** Admin → Fields and columns: rename fields, choose columns and filters, add custom fields, per page. */
export default async function FieldsPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  await requireUser('/admin/custom-fields');
  const active = await requirePermission('admin.fields.manage');
  const orgId = active.organization.id;
  const locale = (await getLocale()) === 'hi' ? 'hi' : 'en';
  const entities = configurableEntities();
  const requested = (await searchParams).e;
  const entity = (requested && getEntity(requested)?.customFields ? getEntity(requested) : entities[0])!;
  const [{ settings, customs }, rows, t] = await Promise.all([
    fieldConfig(orgId, entity.key),
    previewRows(orgId, entity.key),
    getTranslations('engine.fields'),
  ]);
  return (
    <>
      <div>
        <p className="text-[13px] text-muted-foreground">{t('crumb')}</p>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      <EntityPicker
        entities={entities.map((e) => ({ key: e.key, label: locale === 'hi' ? e.label.hi : e.label.en }))}
        current={entity.key}
      />
      <FieldsList
        key={entity.key}
        entity={entity}
        settings={settings}
        customs={customs}
        sampleRows={rows}
        locale={locale}
        canEdit
      />
    </>
  );
}
