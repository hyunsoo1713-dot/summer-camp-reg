// 「지금 분류하기」 버튼 (1시간에 한 번). 평소에는 매일 밤 9시 이후 자동으로 분류됩니다.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { HttpError } from '@/server/access';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { canUpload, getMatchState, getViewer, isPhotoExpired, nextManualMatchAt, photoMatchOf, runMatchingAndRecord } from '@/server/photos';

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
    const wait = nextManualMatchAt(await getMatchState(eventId));
    if (wait) {
      const min = Math.max(1, Math.ceil((wait - Date.now()) / 60000));
      throw new HttpError(429, `분류는 1시간에 한 번만 할 수 있어요. ${min}분 뒤에 다시 눌러 주세요. (밤 9시 이후에는 자동으로 분류됩니다)`);
    }
    const result = await runMatchingAndRecord(eventId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
