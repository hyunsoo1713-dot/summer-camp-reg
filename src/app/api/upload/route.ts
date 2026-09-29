// 행사 안내 이미지 업로드 (관리자만). 브라우저는 저장소에 직접 쓰지 못합니다.
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getDownloadURL } from 'firebase-admin/storage';
import { adminBucket, adminDb } from '@/server/firebaseAdmin';
import { getSession } from '@/server/session';
import { HttpError } from '@/server/access';
import { assertSameOrigin, errorResponse } from '@/server/http';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const session = await getSession(req);
    if (!session || (session.role !== 'admin' && session.role !== 'super')) {
      throw new HttpError(403, '이미지 업로드 권한이 없습니다.');
    }
    const form = await req.formData();
    const file = form.get('file');
    const eventId = String(form.get('eventId') || '');
    if (!(file instanceof Blob)) throw new HttpError(400, '파일이 없습니다.');
    const ext = TYPES[file.type];
    if (!ext) throw new HttpError(400, 'JPG, PNG, WEBP 이미지만 올릴 수 있습니다.');
    if (file.size > MAX_BYTES) throw new HttpError(400, '이미지 용량이 너무 큽니다. (최대 5MB)');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(eventId)) throw new HttpError(400, '행사 정보가 올바르지 않습니다.');

    const ev = await adminDb().collection('events').doc(eventId).get();
    if (!ev.exists) throw new HttpError(400, '행사를 찾을 수 없습니다.');
    if (session.role === 'admin' && ev.data()?.district_id !== session.districtId) {
      throw new HttpError(403, '이미지 업로드 권한이 없습니다.');
    }

    const path = `events/${eventId}/images/${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
    const ref = adminBucket().file(path);
    await ref.save(Buffer.from(await file.arrayBuffer()), { contentType: file.type, resumable: false });
    const url = await getDownloadURL(ref);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return errorResponse(err);
  }
}
