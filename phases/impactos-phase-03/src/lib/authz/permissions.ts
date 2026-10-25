/**
 * Permission catalogue (mirror of public.permissions). Each phase adds its keys here AND in its migration.
 * Strings are `module.entity.verb`; sensitive ones (pii.*) are logged on every use.
 */
export const PERMISSIONS = {
  'admin.users.view': { module: 'admin', sensitive: false },
  'admin.users.manage': { module: 'admin', sensitive: false },
  'admin.roles.view': { module: 'admin', sensitive: false },
  'admin.roles.manage': { module: 'admin', sensitive: false },
  'admin.positions.view': { module: 'admin', sensitive: false },
  'admin.positions.manage': { module: 'admin', sensitive: false },
  'admin.audit.view': { module: 'admin', sensitive: false },
  'org.profile.edit': { module: 'organisation', sensitive: false },
  'pii.aadhaar.reveal': { module: 'privacy', sensitive: true },
  'pii.bank.reveal': { module: 'privacy', sensitive: true },
  'pii.salary.view': { module: 'privacy', sensitive: true },
  'pii.medical.view': { module: 'privacy', sensitive: true },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL = '*';

/** True when a permission set (from my_permissions) includes `perm`; '*' means every permission. */
export function hasPermission(set: readonly string[] | null | undefined, perm: string): boolean {
  if (!set) return false;
  return set.includes(ALL) || set.includes(perm);
}

/** Group permission keys by module for the role editor, in catalogue order. */
export function groupByModule(keys: readonly string[]): { module: string; keys: string[] }[] {
  const order = new Map<string, number>();
  Object.values(PERMISSIONS).forEach((p, i) => {
    if (!order.has(p.module)) order.set(p.module, i);
  });
  const groups = new Map<string, string[]>();
  for (const k of keys) {
    const mod = k in PERMISSIONS ? PERMISSIONS[k as Permission].module : k.split('.')[0]!;
    groups.set(mod, [...(groups.get(mod) ?? []), k]);
  }
  return [...groups.entries()]
    .sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99) || a[0].localeCompare(b[0]))
    .map(([module, ks]) => ({ module, keys: ks }));
}
