import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type PlanRow = {
  key: string;
  name: string;
  description: string | null;
  monthlyPaise: number;
  annualPaise: number;
  extraSeatPaise: number;
  donationFeeBps: number;
  donationFeeCapPaise: number;
  isPublic: boolean;
  active: boolean;
  limits: Record<string, number | null>;
  modules: string[];
  subscribers: number;
};

export async function listPlans(): Promise<PlanRow[]> {
  const db = supabaseAdmin();
  const [{ data: plans }, { data: limits }, { data: modules }, { data: subs }] = await Promise.all([
    db.from('plans').select('*').order('sort_order'),
    db.from('plan_limits').select('*'),
    db.from('plan_modules').select('*'),
    db.from('subscriptions').select('plan_key').neq('status', 'cancelled'),
  ]);
  return (plans ?? []).map((p) => ({
    key: p.key,
    name: p.name,
    description: p.description,
    monthlyPaise: p.monthly_paise,
    annualPaise: p.annual_paise,
    extraSeatPaise: p.extra_seat_paise,
    donationFeeBps: p.donation_fee_bps,
    donationFeeCapPaise: p.donation_fee_cap_paise,
    isPublic: p.is_public,
    active: p.active,
    limits: Object.fromEntries((limits ?? []).filter((l) => l.plan_key === p.key).map((l) => [l.limit_key, l.value])),
    modules: (modules ?? []).filter((m) => m.plan_key === p.key).map((m) => m.module),
    subscribers: (subs ?? []).filter((s) => s.plan_key === p.key).length,
  }));
}
