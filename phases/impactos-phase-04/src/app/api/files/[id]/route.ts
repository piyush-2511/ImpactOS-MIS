import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/user';
import { supabaseServer } from '@/lib/supabase/server';
import { defaultStorage, storageFor, UPLOAD_RULES } from '@/lib/storage';

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await supabaseServer();
  // RLS: only members of the file's organisation see the row.
  const { data } = await supabase.from('storage_files').select('*').eq('id', id).maybeSingle();
  return data ? { supabase, file: data } : null;
}

/** Download: short-lived signed URL (R2) or streamed bytes (local, Drive). Always as an attachment, never inline HTML. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const found = await load((await params).id);
  if (!found || found.file.status !== 'ready') return NextResponse.json({ error: 'notFound' }, { status: 404 });
  const { file } = found;
  const storage = await storageFor(file);
  const key = file.provider === 'drive' ? file.drive_file_id! : file.object_key!;
  const url = await storage.signedUrl(key, file.name, 300);
  if (url) return NextResponse.redirect(url, { status: 302 });
  const bytes = await storage.get(key);
  if (!bytes) return NextResponse.json({ error: 'notFound' }, { status: 404 });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}

/** Server-side upload for providers that cannot presign (local development, Google Drive). Uploader only, once. */
export async function PUT(request: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const found = await load((await params).id);
  if (!found || found.file.status !== 'pending' || found.file.uploaded_by !== user.id || found.file.provider === 'r2') {
    return NextResponse.json({ error: 'notFound' }, { status: 404 });
  }
  const { file, supabase } = found;
  const max = UPLOAD_RULES[file.purpose]?.maxBytes ?? 20 * 1024 * 1024;
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > max) return NextResponse.json({ error: 'tooLarge' }, { status: 413 });
  const storage = await storageFor(file);
  const stored = await storage.put(
    file.object_key ?? `${file.organization_id}/${file.purpose}/${file.id}/${file.name}`,
    body,
    file.mime,
  );
  const digest = Buffer.from(await crypto.subtle.digest('SHA-256', body)).toString('hex');
  await supabase
    .from('storage_files')
    .update({
      size_bytes: body.byteLength,
      sha256: digest,
      ...(file.provider === 'drive' ? { drive_file_id: stored.id } : {}),
    })
    .eq('id', file.id);
  return NextResponse.json({ ok: true });
}

/** Confirm an upload: checks the object exists and matches the declared size, then marks the file ready. */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const found = await load((await params).id);
  if (!found || found.file.uploaded_by !== user.id) return NextResponse.json({ error: 'notFound' }, { status: 404 });
  const { file, supabase } = found;
  if (file.status === 'ready') return NextResponse.json({ ok: true });
  if (file.provider === 'r2') {
    const head = await defaultStorage().head(file.object_key!);
    if (!head || head.size !== file.size_bytes)
      return NextResponse.json({ error: 'uploadIncomplete' }, { status: 409 });
  } else if (!file.sha256) {
    return NextResponse.json({ error: 'uploadIncomplete' }, { status: 409 });
  }
  await supabase.from('storage_files').update({ status: 'ready' }).eq('id', file.id);
  return NextResponse.json({ ok: true });
}

/** Remove from the record (soft delete; a cleanup job deletes bytes after the retention rules allow). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const found = await load((await params).id);
  if (!found) return NextResponse.json({ error: 'notFound' }, { status: 404 });
  const { error } = await found.supabase
    .from('storage_files')
    .update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('id', found.file.id)
    .select('id')
    .single();
  return error ? NextResponse.json({ error: 'forbidden' }, { status: 403 }) : NextResponse.json({ ok: true });
}
