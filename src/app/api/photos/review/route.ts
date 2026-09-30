// 애매한 사진 확인: "이 사진에 ○○(이)가 있나요?" → 맞아요 / 아니에요
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { HttpError } from '@/server/access';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { getViewer, reviewableFaces, type PhotoDoc } from '@/server/photos';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const v = await getViewer(req);
    if (!v || v.kind !== 'staff') throw new HttpError(403, '권한이 없습니다.');
    const body = await readJson(req);
    const photoId = String(body?.photoId || '');
    const faceId = String(body?.faceId || '');
    const decision = body?.decision === 'yes' ? 'confirmed' : body?.decision === 'no' ? 'rejected' : null;
    if (!decision || !/^[A-Za-z0-9_-]{1,100}$/.test(photoId)) throw new HttpError(400, '잘못된 요청입니다.');
    const ref = adminDb().collection('photos').doc(photoId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, '사진을 찾을 수 없습니다.');
    const photo = { ...(snap.data() as PhotoDoc), id: photoId };
    if (!reviewableFaces(photo, v).some(f => f.faceId === faceId)) throw new HttpError(403, '확인할 수 없는 사진입니다.');
    const faces = (photo.faces || []).map(f => (f.faceId === faceId ? { ...f, state: decision as 'confirmed' | 'rejected' } : f));
    await ref.update({ faces });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
