// 학부모/개인이 이름·연락처·수정 비밀번호로 본인 등록 정보를 찾는 API
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { hashPassword, verifyPassword } from '@/server/password';
import { HttpError, sanitize } from '@/server/access';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { clientIp, isBlocked, recordFail, clearFails, BLOCKED_MESSAGE } from '@/server/rateLimit';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = await readJson(req);
    const districtId = String(body?.districtId || '');
    const name = String(body?.name || '').trim();
    const phone = String(body?.phone || '').trim();
    const password = String(body?.password || '');
    if (!districtId || !name || !phone || !password) throw new HttpError(400, '모든 값을 입력해 주세요.');

    const rlKey = `lookup:${clientIp(req)}`;
    if (isBlocked(rlKey)) throw new HttpError(429, BLOCKED_MESSAGE);

    const snap = await adminDb().collection('participants').where('name', '==', name).get();
    for (const d of snap.docs) {
      const p = d.data();
      if (p.district_id !== districtId) continue;
      const pPhone = String((p.participant_type === '학생' ? p.guardian_phone : p.personal_phone) || '').trim();
      if (pPhone !== phone) continue;
      const v = verifyPassword(password, p.edit_password_hash, 'reversed-b64');
      if (!v.ok) continue;
      if (v.needsRehash) await d.ref.update({ edit_password_hash: hashPassword(password) });
      clearFails(rlKey);
      return NextResponse.json({ ok: true, participant: sanitize('participants', { ...p, id: d.id }) });
    }
    recordFail(rlKey);
    return NextResponse.json({ ok: true, participant: null });
  } catch (err) {
    return errorResponse(err);
  }
}
