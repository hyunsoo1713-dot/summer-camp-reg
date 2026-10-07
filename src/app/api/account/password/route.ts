// 로그인한 사람이 자기 비밀번호를 바꾸는 API (현재 비밀번호 확인은 서버에서)
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { bumpSuperSessionVersion, getSession, setSessionCookie } from '@/server/session';
import { hashPassword, verifyPassword, STAFF_MIN_PASSWORD, STAFF_PASSWORD_MESSAGE } from '@/server/password';
import { HttpError } from '@/server/access';
import { setSuperPassword, verifySuperPassword } from '@/server/superAuth';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { assertNotBlocked, clearFailures, limitKeys, recordFailure } from '@/server/rateLimit';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const session = await getSession(req);
    if (!session) throw new HttpError(401, '로그인이 필요합니다. 다시 로그인해 주세요.');
    const body = await readJson(req);
    const current = String(body?.currentPassword || '');
    const next = String(body?.newPassword || '');
    if (!current) throw new HttpError(400, '현재 비밀번호를 입력해 주세요.');
    if (next.length < STAFF_MIN_PASSWORD) throw new HttpError(400, '새 ' + STAFF_PASSWORD_MESSAGE);

    const rl = limitKeys(req, 'pwchange', session.managerId || 'super');
    await assertNotBlocked(rl);

    let sv = 0;
    if (session.role === 'super') {
      const r = await verifySuperPassword(current);
      if (r !== 'ok') {
        await recordFailure(rl);
        throw new HttpError(400, '현재 비밀번호가 일치하지 않습니다.');
      }
      await setSuperPassword(next);
      sv = await bumpSuperSessionVersion(); // 다른 기기의 최고 관리자 로그인은 모두 끊김
    } else {
      const ref = adminDb().collection('church_managers').doc(session.managerId!);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpError(401, '계정 정보를 찾을 수 없습니다.');
      if (!verifyPassword(current, snap.data()?.password_hash, 'plain').ok) {
        await recordFailure(rl);
        throw new HttpError(400, '현재 비밀번호가 일치하지 않습니다.');
      }
      sv = Number(snap.data()?.session_version || 0) + 1;
      await ref.update({ password_hash: hashPassword(next), session_version: sv }); // 다른 기기 로그인은 모두 끊김
    }
    await clearFailures(rl);
    const res = NextResponse.json({ ok: true });
    const { exp: _exp, ...rest } = session;
    setSessionCookie(res, { ...rest, sv }); // 지금 이 기기는 계속 로그인 유지
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
