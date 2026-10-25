/**
 * Message namespaces loaded for every request. Each phase adds its namespaces here
 * (files live at src/messages/<locale>/<namespace>.json). Replaced in every phase.
 */
export const NAMESPACES = ['common', 'site', 'auth', 'account', 'admin'] as const;
export type Namespace = (typeof NAMESPACES)[number];
