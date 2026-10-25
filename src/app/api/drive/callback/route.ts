import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/user';
import { can } from '@/lib/authz/can';
import { audit } from '@/lib/actions/audit';
import { encryptSecret } from '@/lib/crypto/encrypt';
import { getActiveOrg } from '@/lib/org/active-org';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createFolder, exchangeCode } from '@/lib/storage/google-drive';

/**
 * Google returns here after consent. Verifies the one-time state (same org, same browser), encrypts the refresh
 * token (AES-256-GCM) before storing it (provisioning: service role), and creates the "ImpactOS" folder.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const done = (result: string) => NextResponse.redirect(new URL(`/?drive=${result}`, url.origin));
  const store = await cookies();
  const expected = store.get('ios_drive_state')?.value;
  store.delete('ios_drive_state');
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!expected || !state || state !== expected || !code) return done('failed');

  const [user, active] = await Promise.all([getCurrentUser(), getActiveOrg()]);
  if (!user || !active || state.split('.')[0] !== active.organization.id || !(await can('admin.integrations.manage')))
    return done('failed');

  try {
    const tokens = await exchangeCode(code, `${url.origin}/api/drive/callback`);
    if (!tokens.refresh_token) return done('noRefresh');
    // id_token comes straight from Google's token endpoint over TLS, so reading its claims is safe here.
    const claims = tokens.id_token
      ? (JSON.parse(Buffer.from(tokens.id_token.split('.')[1]!, 'base64url').toString()) as { email?: string })
      : {};
    const folderId = await createFolder(tokens.access_token);
    await supabaseAdmin()
      .from('drive_connections')
      .upsert({
        organization_id: active.organization.id,
        google_email: claims.email ?? 'unknown',
        refresh_token_enc: await encryptSecret(tokens.refresh_token),
        folder_id: folderId,
        status: 'connected',
        connected_by: user.id,
        connected_at: new Date().toISOString(),
      });
    await audit(active.organization.id, 'integration.drive_connected', { note: claims.email });
    return done('connected');
  } catch {
    return done('failed');
  }
}
