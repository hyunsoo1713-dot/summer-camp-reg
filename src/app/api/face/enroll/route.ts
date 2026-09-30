// 참가자 얼굴 사진 등록 (신청할 때 / 신청 내역 수정할 때)
// 본인 확인: 신청서의 연락처 + 수정 비밀번호
import { NextRequest, NextResponse } from 'next/server';
import { adminBucket, adminDb } from '@/server/firebaseAdmin';
import { HttpError, checkEditAuth } from '@/server/access';
import { assertSameOrigin, errorResponse } from '@/server/http';
import { clientIp, isBlocked, recordFail, clearFails, BLOCKED_MESSAGE } from '@/server/rateLimit';
import { collectionIdFor, getFaceProvider } from '@/server/faceProvider';
import { isPhotoExpired, markNeedsMatch, photoMatchOf, removeParticipantFace } from '@/server/photos';

const MAX = 3 * 1024 * 1024;
const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const form = await req.formData();
    const participantId = String(form.get('participantId') || '');
    const phone = String(form.get('phone') || '');
    const password = String(form.get('password') || '');
    const photo = form.get('photo');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(participantId)) throw new HttpError(400, '잘못된 요청입니다.');
    if (!(photo instanceof Blob) || photo.size > MAX) throw new HttpError(400, '사진 파일이 올바르지 않습니다.');

    const rlKey = `enroll:${clientIp(req)}`;
    if (isBlocked(rlKey)) throw new HttpError(429, BLOCKED_MESSAGE);

    const db = adminDb();
    const ref = db.collection('participants').doc(participantId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, '신청 정보를 찾을 수 없습니다.');
    const p = { ...snap.data(), id: snap.id } as Record<string, any>;
    if (!checkEditAuth(p, { phone, password })) {
      recordFail(rlKey);
      throw new HttpError(403, '본인 확인에 실패했습니다.');
    }
    clearFails(rlKey);
    if (p.face_consent !== true) throw new HttpError(400, '「참가자 사진 찾기」에 동의해야 얼굴 사진을 올릴 수 있습니다.');
    const ev = await db.collection('events').doc(String(p.event_id)).get();
    if (!ev.exists || photoMatchOf(ev.data()).status !== 'on') throw new HttpError(400, '이 행사는 「참가자 사진 찾기」를 사용하지 않습니다.');
    if (isPhotoExpired(ev.data())) throw new HttpError(400, '사진 보관 기간(행사 후 30일)이 끝난 행사입니다.');

    const buf = Buffer.from(await photo.arrayBuffer());
    if (!isJpeg(buf)) throw new HttpError(400, '사진 형식이 올바르지 않습니다.');

    const provider = getFaceProvider();
    const result = await provider.enrollFace(collectionIdFor(String(p.event_id)), buf, `p_${participantId}`);
    if (result.status === 'no_face') {
      return NextResponse.json({ ok: false, error: '사진에서 얼굴을 찾지 못했어요. 얼굴이 크게, 정면으로 나온 사진으로 다시 올려 주세요.' }, { status: 400 });
    }
    if (result.status !== 'ok') {
      return NextResponse.json({ ok: false, error: '사진에 두 사람 이상이 나왔어요. 혼자 나온 사진으로 다시 올려 주세요.' }, { status: 400 });
    }

    // 예전 얼굴 정보는 지우고 새로 저장
    if (p.face_id) await removeParticipantFace({ ...p, face_photo_path: undefined });
    const path = `faces/${p.district_id}/${p.event_id}/${participantId}.jpg`;
    await adminBucket().file(path).save(buf, { contentType: 'image/jpeg', resumable: false });
    await ref.update({ face_id: result.faceId, face_photo_path: path, face_enrolled_at: new Date().toISOString() });
    await markNeedsMatch(String(p.event_id)); // 오늘 밤 분류 때 이 참가자 사진도 찾음
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
