// 「참가자 사진 찾기」 켜고 끄기
//  - 지방회 관리자: 사용 신청(예상 인원 입력) / 신청 취소
//  - 최고 관리자  : 입금 확인 후 켜기(인원 입력) / 끄기
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { getSession } from '@/server/session';
import { HttpError } from '@/server/access';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { collectionIdFor, getFaceProvider } from '@/server/faceProvider';
import { isPhotoExpired, photoMatchOf, type PhotoMatchSetting } from '@/server/photos';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const s = await getSession(req);
    if (!s || (s.role !== 'admin' && s.role !== 'super')) throw new HttpError(403, '권한이 없습니다.');
    const body = await readJson(req);
    const eventId = String(body?.eventId || '');
    const action = String(body?.action || '');
    const count = Math.floor(Number(body?.count) || 0);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(eventId)) throw new HttpError(400, '행사 정보가 올바르지 않습니다.');
    const ref = adminDb().collection('events').doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, '행사를 찾을 수 없습니다.');
    const ev = snap.data()!;
    if (s.role === 'admin' && ev.district_id !== s.districtId) throw new HttpError(403, '권한이 없습니다.');
    const { purged_at: _old, ...cur } = photoMatchOf(ev); // 예전 행사 날짜의 삭제 기록은 새로 켤 때 무시
    const now = new Date().toISOString();
    let next: PhotoMatchSetting;

    if ((action === 'request' || action === 'enable') && isPhotoExpired(ev)) {
      throw new HttpError(400, '행사가 끝나고 30일이 지나 사진 서비스를 켤 수 없습니다.');
    }
    if (action === 'request') {
      if (cur.status === 'on') throw new HttpError(400, '이미 사용 중입니다.');
      if (count < 1 || count > 5000) throw new HttpError(400, '예상 참가 인원을 입력해 주세요.');
      next = { ...cur, status: 'requested', expected_count: count, requested_at: now, requested_by: s.name };
    } else if (action === 'cancel') {
      if (cur.status !== 'requested') throw new HttpError(400, '취소할 신청이 없습니다.');
      next = { ...cur, status: 'off' };
    } else if (action === 'enable' && s.role === 'super') {
      if (count < 1 || count > 5000) throw new HttpError(400, '입금 확인된 인원을 입력해 주세요.');
      await getFaceProvider().ensureCollection(collectionIdFor(eventId));
      next = { ...cur, status: 'on', paid_count: count, enabled_at: now };
    } else if (action === 'disable' && s.role === 'super') {
      next = { ...cur, status: 'off' };
    } else {
      throw new HttpError(400, '잘못된 요청입니다.');
    }
    await ref.update({ photo_match: next });
    return NextResponse.json({ ok: true, photo_match: next });
  } catch (err) {
    return errorResponse(err);
  }
}
