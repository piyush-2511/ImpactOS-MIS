import 'server-only';
import { cache } from 'react';
import type { LimitKey } from '@/lib/supabase/database.types';
import { supabaseServer } from '@/lib/supabase/server';
import type { PlanInfo } from './plans';

/** The organisation's plan, status, modules and limits (cached per request). */
export const getPlanInfo = cache(async (orgId: string): Promise<PlanInfo | null> => {
  const supabase = await supabaseServer();
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_key, status, billing_period, trial_ends_at, pending_plan_key')
    .eq('organization_id', orgId)
    .maybeSingle();
  if (!sub) return null;
  const [{ data: plan }, { data: limits }, { data: modules }] = await Promise.all([
    supabase
      .from('plans')
      .select('name, monthly_paise, annual_paise, extra_seat_paise')
      .eq('key', sub.plan_key)
      .single(),
    supabase.from('plan_limits').select('limit_key, value').eq('plan_key', sub.plan_key),
    supabase.from('plan_modules').select('module').eq('plan_key', sub.plan_key),
  ]);
  return {
    planKey: sub.plan_key,
    planName: plan?.name ?? sub.plan_key,
    status: sub.status,
    period: sub.billing_period,
    trialEndsAt: sub.trial_ends_at,
    pendingPlanKey: sub.pending_plan_key,
    monthlyPaise: plan?.monthly_paise ?? 0,
    annualPaise: plan?.annual_paise ?? 0,
    extraSeatPaise: plan?.extra_seat_paise ?? 0,
    modules: (modules ?? []).map((m) => m.module),
    limits: Object.fromEntries((limits ?? []).map((l) => [l.limit_key, l.value])),
  };
});

/** Current usage against each limit. Beneficiaries arrive with Programs (phase 7). */
export const getUsage = cache(async (orgId: string): Promise<Record<LimitKey, number>> => {
  const supabase = await supabaseServer();
  const month = new Date().toISOString().slice(0, 7) + '-01';
  const [{ data: seats }, { data: files }, { count: fields }, { data: ai }] = await Promise.all([
    supabase.rpc('staff_seats_used', { org: orgId }),
    supabase
      .from('storage_files')
      .select('size_bytes')
      .eq('organization_id', orgId)
      .eq('status', 'ready')
      .limit(100_000),
    supabase
      .from('custom_field_definitions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('archived_at', null),
    supabase.from('ai_usage').select('units').eq('organization_id', orgId).eq('month', month).maybeSingle(),
  ]);
  const bytes = (files ?? []).reduce((s, f) => s + Number(f.size_bytes), 0);
  return {
    staff_seats: seats ?? 0,
    storage_gb: Math.round((bytes / 1024 ** 3) * 100) / 100,
    custom_fields: fields ?? 0,
    ai_units: ai?.units ?? 0,
    beneficiaries: 0,
  };
});

export type LimitCheck = { ok: boolean; used: number; limit: number | null };

/** Would adding `adding` more exceed the plan limit? null limit = unlimited. */
export async function checkLimit(orgId: string, key: LimitKey, adding = 1): Promise<LimitCheck> {
  const [plan, usage] = await Promise.all([getPlanInfo(orgId), getUsage(orgId)]);
  const limit = plan?.limits[key] ?? null;
  const used = usage[key];
  return { ok: limit === null || used + adding <= limit, used, limit };
}

export async function planAllows(orgId: string, module: string): Promise<boolean> {
  const plan = await getPlanInfo(orgId);
  return !!plan && plan.status !== 'cancelled' && plan.modules.includes(module);
}
