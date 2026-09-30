// 학부모·참가자 "사진 보기" 입장: 이름·연락처·신청 비밀번호로 확인 후 2시간짜리 임시 출입증 발급
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { hashPassword, verifyPassword } from '@/server/password';
import { HttpError } from '@/server/access';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { clientIp, isBlocked, recordFail, clearFails, BLOCKED_MESSAGE } from '@/server/rateLimit';
import { clearViewerCookie, setViewerCookie } from '@/server/photos';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = await readJson(req);
    if (body?.logout) {
      const res = NextResponse.json({ ok: true });
      clearViewerCookie(res);
      return res;
    }
    const districtId = String(body?.districtId || '');
    const name = String(body?.name || '').trim();
    const phone = String(body?.phone || '').trim();
    const password = String(body?.password || '');
    if (!districtId || !name || !phone || !password) throw new HttpError(400, '모든 값을 입력해 주세요.');

    const rlKey = `photoview:${clientIp(req)}`;
    if (isBlocked(rlKey)) throw new HttpError(429, BLOCKED_MESSAGE);

    const snap = await adminDb().collection('participants').where('name', '==', name).get();
    for (const d of snap.docs) {
      const p = d.data();
      if (p.district_id !== districtId) continue;
      const pPhone = String((p.participant_type === '학생' ? p.guardian_phone : p.personal_phone) || '').trim();
      if (pPhone !== phone) continue;
      const vr = verifyPassword(password, p.edit_password_hash, 'reversed-b64');
      if (!vr.ok) continue;
      if (vr.needsRehash) await d.ref.update({ edit_password_hash: hashPassword(password) });
      clearFails(rlKey);
      const res = NextResponse.json({ ok: true, name: p.name, type: p.participant_type });
      setViewerCookie(res, d.id, districtId);
      return res;
    }
    recordFail(rlKey);
    throw new HttpError(401, '일치하는 신청 정보를 찾을 수 없습니다. 이름, 연락처, 비밀번호를 확인해 주세요.');
  } catch (err) {
    return errorResponse(err);
  }
}
