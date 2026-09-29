// 서버 전용: API 공통 처리 (오류 응답, 같은 사이트 요청 확인)
import { NextRequest, NextResponse } from 'next/server';
import { HttpError } from './access';
import type { Session } from './session';

export function publicSession(s: Session | null) {
  if (!s) return null;
  return {
    role: s.role,
    loginId: s.loginId,
    name: s.name,
    districtId: s.districtId || '',
    churchId: s.churchId || '',
    districtSlug: s.districtSlug || '',
  };
}

/** 다른 사이트에서 몰래 보내는 요청(CSRF) 차단 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return; // 같은 출처의 일부 요청은 Origin 헤더가 없을 수 있음 (SameSite 쿠키로 보호)
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, '허용되지 않은 요청입니다.');
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, '허용되지 않은 요청입니다.');
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  }
  if (err instanceof Error && err.message.startsWith('서버 설정 오류')) {
    console.error('[api]', err.message);
    return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
  }
  console.error('[api] unexpected error', err);
  return NextResponse.json({ ok: false, error: '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
}

export async function readJson(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, '잘못된 요청입니다.');
  }
}
