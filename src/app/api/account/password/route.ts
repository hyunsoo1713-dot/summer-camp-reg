// 로그인한 사람이 자기 비밀번호를 바꾸는 API (현재 비밀번호 확인은 서버에서)
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { getSession } from '@/server/session';
import { hashPassword, verifyPassword } from '@/server/password';
import { HttpError } from '@/server/access';
import { setSuperPassword, verifySuperPassword } from '@/server/superAuth';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { clientIp, isBlocked, recordFail, clearFails, BLOCKED_MESSAGE } from '@/server/rateLimit';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const session = await getSession(req);
    if (!session) throw new HttpError(401, '로그인이 필요합니다. 다시 로그인해 주세요.');
    const body = await readJson(req);
    const current = String(body?.currentPassword || '');
    const next = String(body?.newPassword || '');
    if (!current) throw new HttpError(400, '현재 비밀번호를 입력해 주세요.');
    if (next.length < 4) throw new HttpError(400, '새 비밀번호는 4자 이상이어야 합니다.');

    const rlKey = `pwchange:${clientIp(req)}:${session.managerId || 'super'}`;
    if (isBlocked(rlKey)) throw new HttpError(429, BLOCKED_MESSAGE);

    if (session.role === 'super') {
      const r = await verifySuperPassword(current);
      if (r !== 'ok') {
        recordFail(rlKey);
        throw new HttpError(400, '현재 비밀번호가 일치하지 않습니다.');
      }
      await setSuperPassword(next);
    } else {
      const ref = adminDb().collection('church_managers').doc(session.managerId!);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpError(401, '계정 정보를 찾을 수 없습니다.');
      if (!verifyPassword(current, snap.data()?.password_hash, 'plain').ok) {
        recordFail(rlKey);
        throw new HttpError(400, '현재 비밀번호가 일치하지 않습니다.');
      }
      await ref.update({ password_hash: hashPassword(next) });
    }
    clearFails(rlKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
