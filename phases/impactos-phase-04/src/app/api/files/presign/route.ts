import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/user';
import { getActiveOrg } from '@/lib/org/active-org';
import { supabaseServer } from '@/lib/supabase/server';
import { defaultStorage, objectKey, UPLOAD_RULES } from '@/lib/storage';

const schema = z.object({
  name: z.string().trim().min(1).max(255),
  mime: z.string().max(120),
  size: z.number().int().positive(),
  purpose: z.enum(['attachment', 'photo', 'document']),
  entity: z
    .string()
    .regex(/^[a-z][a-z_]{1,40}$/)
    .optional(),
  entityId: z.string().max(80).optional(),
});

/**
 * Step 1 of an upload: checks type and size for the purpose, records a pending storage_files row (RLS: members of the
 * active organisation) and returns where to PUT the bytes: a presigned R2 URL, or this app for providers that cannot
 * presign (local development, Google Drive).
 */
export async function POST(request: NextRequest) {
  const [user, active] = await Promise.all([getCurrentUser(), getActiveOrg()]);
  if (!user || !active) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const p = parsed.data;
  const rule = UPLOAD_RULES[p.purpose]!;
  if (!rule.mime.test(p.mime)) return NextResponse.json({ error: 'typeNotAllowed' }, { status: 415 });
  if (p.size > rule.maxBytes) return NextResponse.json({ error: 'tooLarge' }, { status: 413 });

  const supabase = await supabaseServer();
  const orgId = active.organization.id;
  let provider: 'r2' | 'drive' | 'local' = defaultStorage().kind;
  if (p.purpose === 'document') {
    const { data: drive } = await supabase
      .from('drive_connections')
      .select('status')
      .eq('organization_id', orgId)
      .maybeSingle();
    if (drive?.status === 'connected') provider = 'drive';
  }
  const fileId = crypto.randomUUID();
  const key = objectKey(orgId, p.purpose, fileId, p.name);
  const { data: row, error } = await supabase
    .from('storage_files')
    .insert({
      organization_id: orgId,
      provider,
      object_key: provider === 'drive' ? null : key,
      name: p.name,
      mime: p.mime,
      size_bytes: p.size,
      entity: p.entity ?? null,
      entity_id: p.entityId ?? null,
      purpose: p.purpose,
      uploaded_by: user.id,
    })
    .select('id')
    .single();
  if (error || !row) return NextResponse.json({ error: 'failed' }, { status: 500 });

  const presigned = provider === 'r2' ? await defaultStorage().presignUpload(key, p.mime, p.size) : null;
  return NextResponse.json({
    fileId: row.id,
    url: presigned?.url ?? `/api/files/${row.id}`,
    headers: presigned?.headers ?? { 'Content-Type': p.mime },
  });
}
