// 서버 전용: 비밀번호 무차별 대입 방지를 위한 간단한 실패 횟수 제한 (인스턴스 메모리 기준)
import type { NextRequest } from 'next/server';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const buckets = new Map<string, { fails: number; resetAt: number }>();

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : '').trim() || 'unknown';
}

export function isBlocked(key: string): boolean {
  const b = buckets.get(key);
  if (!b) return false;
  if (Date.now() > b.resetAt) {
    buckets.delete(key);
    return false;
  }
  return b.fails >= MAX_FAILS;
}

export function recordFail(key: string) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { fails: 1, resetAt: now + WINDOW_MS });
  } else {
    b.fails += 1;
  }
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  }
}

export function clearFails(key: string) {
  buckets.delete(key);
}

export const BLOCKED_MESSAGE = '시도 횟수가 너무 많습니다. 15분 후에 다시 시도해 주세요.';
