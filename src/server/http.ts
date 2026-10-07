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

const MAX_JSON_BYTES = 8 * 1024 * 1024; // 일반 저장 요청 최대 크기

export async function readJson(req: NextRequest): Promise<any> {
  const declared = Number(req.headers.get('content-length') || NaN);
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) throw new HttpError(413, '요청이 너무 큽니다.');
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, '잘못된 요청입니다.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_JSON_BYTES) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, '요청이 너무 큽니다.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, '잘못된 요청입니다.');
  }
}

/**
 * 파일 올리기 요청을 정해진 크기까지만 읽음 (아주 큰 요청으로 서버 메모리를 채우는 공격 방지)
 * 크기를 밝힌 요청은 읽기 전에, 밝히지 않은 요청은 읽는 도중에 넘치면 바로 멈춥니다.
 */
export async function readFormDataCapped(req: NextRequest, maxBytes: number): Promise<FormData> {
  const declared = Number(req.headers.get('content-length') || NaN);
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413, '파일 용량이 너무 큽니다.');
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, '잘못된 요청입니다.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new HttpError(413, '파일 용량이 너무 큽니다.');
    }
    chunks.push(value);
  }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { 'content-type': req.headers.get('content-type') || '' } }).formData();
  } catch {
    throw new HttpError(400, '잘못된 요청입니다.');
  }
}

/** 실제 이미지 파일인지 앞부분(파일 서명)으로 확인 */
export function sniffImage(b: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}
