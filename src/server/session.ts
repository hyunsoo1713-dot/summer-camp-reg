// 서버 전용: 서명된(위조 불가) 로그인 쿠키 관리
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { adminDb } from './firebaseAdmin';

export const SESSION_COOKIE = 'evt_sess';
const SESSION_TTL_SEC = 60 * 60 * 12; // 12시간

export type Role = 'super' | 'admin' | 'manager';

export interface Session {
  role: Role;
  loginId: string;
  name: string;
  managerId?: string;
  districtId?: string;
  churchId?: string;
  districtSlug?: string;
  sv?: number; // 세션 버전: 비밀번호를 바꾸면 올라가서 예전 로그인(다른 기기 포함)이 모두 끊김
  exp: number; // epoch seconds
}

let devSecret: string | null = null;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('서버 설정 오류: SESSION_SECRET 환경변수(32자 이상)가 설정되지 않았습니다.');
  }
  // 개발 환경에서만: 프로세스마다 임의 비밀키 사용
  if (!devSecret) devSecret = randomBytes(32).toString('hex');
  return devSecret;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function encodeSession(s: Omit<Session, 'exp'>): string {
  const full: Session = { ...s, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC };
  const payload = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Session;
    if (!s.exp || s.exp < Math.floor(Date.now() / 1000)) return null;
    if (s.role !== 'super' && s.role !== 'admin' && s.role !== 'manager') return null;
    return s;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: NextResponse, s: Omit<Session, 'exp'>) {
  res.cookies.set(SESSION_COOKIE, encodeSession(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SEC,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/**
 * 요청의 쿠키를 검증하고, 관리자/담당자의 경우 계정이 아직 유효(승인 상태, 같은 지방회)한지 DB에서 다시 확인합니다.
 * 계정이 삭제·반려되면 즉시 권한이 사라집니다.
 */
export async function getSession(req: NextRequest): Promise<Session | null> {
  const s = decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  if (s.role === 'super') {
    // 최고 관리자 비밀번호를 바꾸면 예전 로그인은 모두 무효
    return Number(s.sv || 0) === (await superSessionVersion()) ? s : null;
  }
  if (!s.managerId) return null;
  const snap = await adminDb().collection('church_managers').doc(s.managerId).get();
  if (!snap.exists) return null;
  const m = snap.data() as Record<string, unknown>;
  if (m.status !== 'approved' || m.district_id !== s.districtId) return null;
  if (Number(m.session_version || 0) !== Number(s.sv || 0)) return null; // 비밀번호가 바뀌었음
  const isAdmin = (m.is_admin as boolean | undefined) ?? (m.church_id === '');
  if (s.role === 'admin' && !isAdmin) return null;
  if (s.role === 'manager') {
    // 담당자의 소속 교회가 바뀌었을 수 있으므로 최신 값 사용. 교회 배정 전(신규 교회 요청)이면 어떤 교회 정보도 못 봄
    const church = String(m.church_id || '');
    return { ...s, churchId: church === 'temp_new_church' ? '' : church };
  }
  return s;
}

export async function superSessionVersion(): Promise<number> {
  const snap = await adminDb().collection('platform_config').doc('config').get();
  return Number((snap.exists && snap.data()?.super_session_version) || 0);
}

export async function bumpSuperSessionVersion(): Promise<number> {
  const v = (await superSessionVersion()) + 1;
  await adminDb().collection('platform_config').doc('config').set({ super_session_version: v }, { merge: true });
  return v;
}
