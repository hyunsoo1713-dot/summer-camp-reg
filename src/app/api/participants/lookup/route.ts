// 학부모/개인이 이름·연락처·수정 비밀번호로 본인 등록 정보를 찾는 API
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { burnPasswordCheck, hashPassword, verifyPassword } from '@/server/password';
import { HttpError, sanitize } from '@/server/access';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { assertNotBlocked, clearFailures, limitKeys, recordFailure } from '@/server/rateLimit';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = await readJson(req);
    const districtId = String(body?.districtId || '');
    const name = String(body?.name || '').trim();
    const phone = String(body?.phone || '').trim();
    const password = String(body?.password || '');
    if (!districtId || !name || !phone || !password) throw new HttpError(400, '모든 값을 입력해 주세요.');

    // 같은 아이(이름+연락처)에 대한 시도는 어느 곳에서 하든 함께 셈
    const rl = limitKeys(req, 'participant-pin', `${districtId}:${name}:${phone.replace(/[^0-9]/g, '')}`, 'lookup');
    await assertNotBlocked(rl);

    const snap = await adminDb().collection('participants').where('name', '==', name).get();
    let checked = false;
    for (const d of snap.docs) {
      const p = d.data();
      if (p.district_id !== districtId) continue;
      const pPhone = String((p.participant_type === '학생' ? p.guardian_phone : p.personal_phone) || '').trim();
      if (pPhone !== phone) continue;
      checked = true;
      const v = verifyPassword(password, p.edit_password_hash, 'reversed-b64');
      if (!v.ok) continue;
      if (v.needsRehash) await d.ref.update({ edit_password_hash: hashPassword(password) });
      await clearFailures(rl);
      return NextResponse.json({ ok: true, participant: sanitize('participants', { ...p, id: d.id }) });
    }
    if (!checked) burnPasswordCheck(password); // 없는 경우도 같은 시간이 걸리게
    await recordFailure(rl);
    return NextResponse.json({ ok: true, participant: null });
  } catch (err) {
    return errorResponse(err);
  }
}
