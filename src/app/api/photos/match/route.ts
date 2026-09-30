// 자동 분류 실행 (사진을 다 올린 뒤 화면이 자동으로 부릅니다)
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { HttpError } from '@/server/access';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { canUpload, getViewer, isPhotoExpired, photoMatchOf, runMatching } from '@/server/photos';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const v = await getViewer(req);
    if (!v || v.kind !== 'staff') throw new HttpError(403, '권한이 없습니다.');
    const body = await readJson(req);
    const eventId = String(body?.eventId || '');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(eventId)) throw new HttpError(400, '행사 정보가 올바르지 않습니다.');
    const ev = await adminDb().collection('events').doc(eventId).get();
    if (!ev.exists) throw new HttpError(404, '행사를 찾을 수 없습니다.');
    if (!canUpload(v, String(ev.data()!.district_id || ''))) throw new HttpError(403, '권한이 없습니다.');
    if (photoMatchOf(ev.data()).status !== 'on') throw new HttpError(400, '「참가자 사진 찾기」를 사용하지 않는 행사입니다.');
    if (isPhotoExpired(ev.data())) throw new HttpError(400, '사진 보관 기간이 끝난 행사입니다.');
    const result = await runMatching(eventId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
