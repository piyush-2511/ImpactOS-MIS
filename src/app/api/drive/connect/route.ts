import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/user';
import { can } from '@/lib/authz/can';
import { getActiveOrg } from '@/lib/org/active-org';
import { DRIVE_SCOPE, driveOAuthConfig } from '@/lib/storage/google-drive';

const STATE_COOKIE = 'ios_drive_state';

/** Start connecting the organisation's Google Drive (admins with admin.integrations.manage). */
export async function GET(request: NextRequest) {
  const [user, active] = await Promise.all([getCurrentUser(), getActiveOrg()]);
  if (!user || !active || !(await can('admin.integrations.manage')))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  let clientId: string;
  try {
    clientId = driveOAuthConfig().clientId;
  } catch {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }
  const state = `${active.organization.id}.${Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url')}`;
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/drive',
    maxAge: 600,
  });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${request.nextUrl.origin}/api/drive/callback`,
    response_type: 'code',
    scope: `openid email ${DRIVE_SCOPE}`,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString();
  return NextResponse.redirect(url);
}
