// 모든 저장·수정·삭제 요청이 거치는 API. 서버가 권한을 확인한 뒤에만 DB에 반영합니다.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/server/session';
import { applyWrites, HttpError, type EditAuth, type WriteOp } from '@/server/access';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { clientIp, isBlocked, recordFail, BLOCKED_MESSAGE } from '@/server/rateLimit';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = await readJson(req);
    const ops = body?.ops as WriteOp[];
    const editAuth = body?.editAuth as EditAuth | undefined;
    const session = await getSession(req);

    const rlKey = `edit:${clientIp(req)}`;
    if (!session && editAuth && isBlocked(rlKey)) throw new HttpError(429, BLOCKED_MESSAGE);
    try {
      const result = await applyWrites(session, ops, editAuth);
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      if (!session && editAuth && err instanceof HttpError && err.status === 403) recordFail(rlKey);
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
