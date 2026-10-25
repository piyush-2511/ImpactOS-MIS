import type { LimitKey } from '@/lib/supabase/database.types';

/** Money is stored in paise (integers) everywhere; format only for display. */
export function formatPaise(paise: number, locale: 'en' | 'hi' = 'en'): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat(locale === 'hi' ? 'hi-IN-u-nu-latn' : 'en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export const LIMIT_KEYS: LimitKey[] = ['staff_seats', 'beneficiaries', 'storage_gb', 'ai_units', 'custom_fields'];
/** Modules a plan can include (keys match src/config/modules.ts planFeature suffixes). */
export const PLAN_MODULES = [
  'home',
  'program',
  'media',
  'marketing',
  'fundraising',
  'hr',
  'organisation',
  'governance',
  'compliance',
  'workplace',
  'admin',
  'assistant',
  'finance',
] as const;

export type PlanInfo = {
  planKey: string;
  planName: string;
  status: 'trialing' | 'active' | 'past_due' | 'read_only' | 'cancelled';
  period: 'monthly' | 'annual';
  trialEndsAt: string | null;
  pendingPlanKey: string | null;
  monthlyPaise: number;
  annualPaise: number;
  extraSeatPaise: number;
  modules: string[];
  limits: Partial<Record<LimitKey, number | null>>;
};

export const priceFor = (p: { monthlyPaise: number; annualPaise: number }, period: 'monthly' | 'annual') =>
  period === 'annual' ? p.annualPaise : p.monthlyPaise;

/** Days left in a trial (0 when ended), in IST calendar days. */
export function trialDaysLeft(trialEndsAt: string | null, now = new Date()): number {
  if (!trialEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / 86_400_000));
}
