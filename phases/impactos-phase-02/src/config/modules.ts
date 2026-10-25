/**
 * THE registry for navigation and routes (hard rule 2): a page is marked `built: true` in the same
 * phase that creates its route. The Sidebar shows only built pages, so the nav never links to a missing page.
 * Replaced in every phase (see references/phase-delivery.md).
 */
export type Release = 'mvp' | 'v1' | 'v2';
export type PageDef = {
  id: string;
  /** Path under the module, '' for the module root. */
  href: string;
  labelKey: string;
  permission?: string;
  release: Release;
  built: boolean;
  children?: PageDef[];
};
export type ModuleDef = {
  id: string;
  icon: string;
  labelKey: string;
  planFeature: string;
  /** A module with `href` and no pages is a single page (Home, Finance). */
  href?: string;
  built?: boolean;
  soon?: boolean;
  pages?: PageDef[];
};

const page = (id: string, href: string, release: Release, built = false, children?: PageDef[]): PageDef => ({
  id, href, labelKey: `nav.${id}`, release, built, children,
});

export const MODULES: ModuleDef[] = [
  { id: 'home', icon: 'house', labelKey: 'nav.home.title', planFeature: 'module.home', href: '/', built: true },
  { id: 'program', icon: 'users', labelKey: 'nav.program.title', planFeature: 'module.program', pages: [
    page('program.overview', '/program/overview', 'mvp'), page('program.programs', '/program/programs', 'mvp'),
    page('program.beneficiaries', '/program/beneficiaries', 'mvp'), page('program.services', '/program/services', 'mvp'),
    page('program.activities', '/program/activities', 'mvp'), page('program.batches', '/program/batches', 'v1'),
    page('program.assessments', '/program/assessments', 'v1'), page('program.externalPrograms', '/program/external-programs', 'v1'),
    page('program.indicators', '/program/indicators', 'v1'), page('program.milestones', '/program/milestones', 'v2'),
    page('program.reports', '/program/reports', 'mvp')] },
  { id: 'media', icon: 'image', labelKey: 'nav.media.title', planFeature: 'module.media', pages: [
    page('media.upload', '/media/upload', 'mvp'), page('media.gallery', '/media/gallery', 'mvp'), page('media.storage', '/media/storage', 'v1')] },
  { id: 'marketing', icon: 'megaphone', labelKey: 'nav.marketing.title', planFeature: 'module.marketing', pages: [
    page('marketing.dashboard', '/marketing/dashboard', 'mvp'), page('marketing.calendar', '/marketing/calendar', 'mvp'),
    page('marketing.campaigns', '/marketing/campaigns', 'mvp'), page('marketing.awarenessDays', '/marketing/awareness-days', 'mvp'),
    page('marketing.stories', '/marketing/stories', 'v1'), page('marketing.brandKit', '/marketing/brand-kit', 'v1')] },
  { id: 'fundraising', icon: 'heart-handshake', labelKey: 'nav.fundraising.title', planFeature: 'module.fundraising', pages: [
    page('fundraising.overview', '/fundraising/overview', 'mvp'), page('fundraising.donations', '/fundraising/donations', 'mvp'),
    page('fundraising.donors', '/fundraising/donors', 'mvp'), page('fundraising.receipts', '/fundraising/receipts', 'mvp'),
    page('fundraising.onlineDonations', '/fundraising/online-donations', 'mvp'), page('fundraising.communication', '/fundraising/communication', 'mvp'),
    page('fundraising.reports', '/fundraising/reports', 'mvp')] },
  { id: 'hr', icon: 'id-card', labelKey: 'nav.hr.title', planFeature: 'module.hr', pages: [
    page('hr.overview', '/hr/overview', 'mvp'), page('hr.employees', '/hr/employees', 'mvp'), page('hr.attendance', '/hr/attendance', 'mvp'),
    page('hr.leave', '/hr/leave', 'mvp'), page('hr.claims', '/hr/claims', 'mvp')] },
  { id: 'organisation', icon: 'building', labelKey: 'nav.organisation.title', planFeature: 'module.organisation', pages: [
    page('organisation.overview', '/organisation/overview', 'mvp'), page('organisation.profile', '/organisation/profile', 'mvp'),
    page('organisation.requests', '/organisation/requests', 'mvp')] },
  { id: 'governance', icon: 'shield-check', labelKey: 'nav.governance.title', planFeature: 'module.governance', pages: [
    page('governance.overview', '/governance', 'mvp'), page('governance.setup', '/governance/setup', 'mvp')] },
  { id: 'compliance', icon: 'calendar-check', labelKey: 'nav.compliance.title', planFeature: 'module.compliance', pages: [
    page('compliance.overview', '/compliance/overview', 'mvp'), page('compliance.calendar', '/compliance/calendar', 'mvp')] },
  { id: 'workplace', icon: 'square-check', labelKey: 'nav.workplace.title', planFeature: 'module.workplace', pages: [
    page('workplace.announcements', '/workplace/announcements', 'mvp'), page('workplace.tasks', '/workplace/tasks', 'mvp')] },
  { id: 'admin', icon: 'sliders-horizontal', labelKey: 'nav.admin.title', planFeature: 'module.admin', pages: [
    page('admin.users', '/admin/users', 'mvp'), page('admin.fields', '/admin/custom-fields', 'mvp')] },
  { id: 'finance', icon: 'wallet', labelKey: 'nav.finance.title', planFeature: 'module.finance', href: '/finance', built: false, soon: true },
];

/** Modules and pages that are built, in nav order. */
export function builtNav(): ModuleDef[] {
  return MODULES.flatMap((m) => {
    if (!m.pages) return m.built ? [m] : [];
    const pages = m.pages.filter((p) => p.built).map((p) => ({ ...p, children: p.children?.filter((c) => c.built) }));
    return pages.length ? [{ ...m, pages }] : [];
  });
}
