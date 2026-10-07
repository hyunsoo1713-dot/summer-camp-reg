// 최고 관리자 로그인
import { NextRequest, NextResponse } from 'next/server';
import { setSessionCookie, superSessionVersion } from '@/server/session';
import { HttpError } from '@/server/access';
import { verifySuperPassword } from '@/server/superAuth';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { assertNotBlocked, clearFailures, limitKeys, recordFailure } from '@/server/rateLimit';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = await readJson(req);
    const password = String(body?.password || '');
    const rl = limitKeys(req, 'super', 'super');
    await assertNotBlocked(rl);
    if (!password) throw new HttpError(400, '비밀번호를 입력해 주세요.');

    const result = await verifySuperPassword(password);
    if (result === 'unset') {
      console.error('[super-login] SUPER_ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.');
      throw new HttpError(401, '비밀번호가 잘못되었습니다.'); // 설정 상태를 밖에 알리지 않음
    }
    if (result === 'fail') {
      await recordFailure(rl);
      throw new HttpError(401, '비밀번호가 잘못되었습니다.');
    }
    await clearFailures(rl);
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, { role: 'super', loginId: 'super', name: '시스템 최고 관리자', sv: await superSessionVersion() });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
