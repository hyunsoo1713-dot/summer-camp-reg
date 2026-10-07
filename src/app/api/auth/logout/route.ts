import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/server/session';
import { assertSameOrigin, errorResponse } from '@/server/http';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
