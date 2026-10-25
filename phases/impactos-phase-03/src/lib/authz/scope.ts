import 'server-only';
import { cache } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/user';

export type Scope = { all: boolean; programs: string[]; branches: string[] };

/** Programs and branches the current user may see. Mirrors public.in_scope(); lists filter with it, RLS enforces it. */
export const getMyScope = cache(async (orgId: string): Promise<Scope> => {
  const user = await getCurrentUser();
  if (!user) return { all: false, programs: [], branches: [] };
  const supabase = await supabaseServer();
  const { data: member } = await supabase
    .from('organization_members')
    .select('id, member_roles(role:roles(default_scope)), member_scopes(scope_type, ref_id)')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (!member) return { all: false, programs: [], branches: [] };
  const all = member.member_roles.some((mr) => mr.role?.default_scope === 'all');
  return {
    all,
    programs: member.member_scopes.filter((s) => s.scope_type === 'program').map((s) => s.ref_id),
    branches: member.member_scopes.filter((s) => s.scope_type === 'branch').map((s) => s.ref_id),
  };
});

/** Pure check used by lists and tests: a row tagged with a program and/or branch. */
export function inScope(scope: Scope, row: { programId?: string | null; branchId?: string | null }): boolean {
  if (scope.all) return true;
  return (
    (!!row.programId && scope.programs.includes(row.programId)) ||
    (!!row.branchId && scope.branches.includes(row.branchId))
  );
}
