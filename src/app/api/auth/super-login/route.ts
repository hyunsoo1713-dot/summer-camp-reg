// 최고 관리자 로그인
import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookie } from '@/server/session';
import { HttpError } from '@/server/access';
import { verifySuperPassword } from '@/server/superAuth';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { clientIp, isBlocked, recordFail, clearFails, BLOCKED_MESSAGE } from '@/server/rateLimit';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = await readJson(req);
    const password = String(body?.password || '');
    const rlKey = `super:${clientIp(req)}`;
    if (isBlocked(rlKey)) throw new HttpError(429, BLOCKED_MESSAGE);
    if (!password) throw new HttpError(400, '비밀번호를 입력해 주세요.');

    const result = await verifySuperPassword(password);
    if (result === 'unset') {
      throw new HttpError(503, '최고 관리자 비밀번호가 서버에 설정되지 않았습니다. (SUPER_ADMIN_PASSWORD 환경변수)');
    }
    if (result === 'fail') {
      recordFail(rlKey);
      throw new HttpError(401, '비밀번호가 잘못되었습니다.');
    }
    clearFails(rlKey);
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, { role: 'super', loginId: 'super', name: '시스템 최고 관리자' });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
