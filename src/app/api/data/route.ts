// 로그인 상태(역할)에 맞는 데이터만 내려주는 API
import { NextRequest, NextResponse } from 'next/server';
import { getSession, clearSessionCookie, SESSION_COOKIE } from '@/server/session';
import { loadScopedData } from '@/server/access';
import { errorResponse, publicSession } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    const data = await loadScopedData(session);
    const res = NextResponse.json({ ok: true, session: publicSession(session), data });
    res.headers.set('Cache-Control', 'no-store');
    // 쿠키는 있었지만 더 이상 유효하지 않으면(계정 삭제·만료) 지워 줌
    if (!session && req.cookies.get(SESSION_COOKIE)) clearSessionCookie(res);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
