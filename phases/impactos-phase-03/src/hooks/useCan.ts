'use client';

import { createContext, createElement, useContext, type ReactNode } from 'react';
import { hasPermission } from '@/lib/authz/permissions';

/**
 * Client-side permission checks for SHOWING or hiding UI only. Every action re-checks on the server and RLS
 * re-checks in the database; never rely on this for security.
 */
const PermissionsContext = createContext<readonly string[]>([]);

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: readonly string[];
  children: ReactNode;
}) {
  return createElement(PermissionsContext.Provider, { value: permissions }, children);
}

export function usePermissions(): readonly string[] {
  return useContext(PermissionsContext);
}

export function useCan(perm: string | undefined): boolean {
  const set = useContext(PermissionsContext);
  return !perm || hasPermission(set, perm);
}
