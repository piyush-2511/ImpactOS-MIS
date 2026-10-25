'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { LOCALE_COOKIE } from '@/lib/i18n/config';
import { supabaseServer } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/user';
import { logAuthEvent } from '@/lib/auth/events';
import { setActiveOrg } from '@/lib/org/active-org';
import type { ActionState } from '@/features/auth/schema';

const profileSchema = z.object({ fullName: z.string().trim().min(2, 'nameShort').max(120, 'nameLong'), locale: z.enum(['en', 'hi']) });

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser('/account');
  const parsed = profileSchema.safeParse({ fullName: fd.get('fullName'), locale: fd.get('locale') });
  if (!parsed.success) return { fieldErrors: { fullName: parsed.error.issues[0]?.message ?? 'generic' } };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('profiles').update({ full_name: parsed.data.fullName, locale: parsed.data.locale }).eq('id', user.id);
  if (error) return { error: 'generic' };
  await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName, locale: parsed.data.locale } });
  (await cookies()).set(LOCALE_COOKIE, parsed.data.locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  revalidatePath('/', 'layout');
  return { ok: true, info: 'saved' };
}

export async function switchOrgAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const orgId = String(fd.get('orgId') ?? '');
  if (await setActiveOrg(orgId)) await logAuthEvent('org_switched', { userId: user.id, orgId });
  redirect('/');
}

/** scope "others": every other device; "global": everywhere including this one. */
export async function signOutDevicesAction(fd: FormData): Promise<void> {
  const user = await requireUser('/account');
  const scope = fd.get('scope') === 'global' ? 'global' : 'others';
  const supabase = await supabaseServer();
  await supabase.auth.signOut({ scope });
  await logAuthEvent('sign_out', { userId: user.id });
  redirect(scope === 'global' ? '/login' : '/account?tab=sessions');
}

export async function removeMfaFactorAction(fd: FormData): Promise<void> {
  await requireUser('/account');
  const supabase = await supabaseServer();
  // Removing a factor requires an AAL2 session (Supabase enforces this).
  await supabase.auth.mfa.unenroll({ factorId: String(fd.get('factorId') ?? '') });
  redirect('/account?tab=security');
}
