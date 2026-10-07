// 서버 전용: 비밀번호 해시(scrypt) 및 검증
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

const PREFIX = 'scrypt';
const KEYLEN = 32;
const PARAMS = { N: 16384, r: 8, p: 1 };

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain.normalize('NFC'), salt, KEYLEN, PARAMS);
  return `${PREFIX}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function isHashed(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(`${PREFIX}$`);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// 예전 버전 앱이 참가자 수정 비밀번호에 쓰던 방식(글자 뒤집기 + base64). 이전 데이터 호환용.
function legacyReversedBase64(plain: string): string {
  const reversed = plain.split('').reverse().join('');
  return Buffer.from(reversed, 'utf8').toString('base64');
}

export type LegacyKind = 'plain' | 'reversed-b64';

/**
 * 비밀번호 검증.
 * - 새 형식(scrypt)이면 해시 비교
 * - 예전 형식(평문 또는 뒤집기+base64)이면 비교 후 needsRehash=true 반환 → 호출부에서 새 해시로 교체 저장
 */
export function verifyPassword(plain: string, stored: unknown, legacy: LegacyKind): { ok: boolean; needsRehash: boolean } {
  if (typeof stored !== 'string' || stored.length === 0 || typeof plain !== 'string' || plain.length === 0) {
    return { ok: false, needsRehash: false };
  }
  if (isHashed(stored)) {
    const parts = stored.split('$');
    if (parts.length !== 3) return { ok: false, needsRehash: false };
    const salt = Buffer.from(parts[1], 'base64');
    const expected = Buffer.from(parts[2], 'base64');
    const actual = scryptSync(plain.normalize('NFC'), salt, expected.length, PARAMS);
    return { ok: actual.length === expected.length && timingSafeEqual(actual, expected), needsRehash: false };
  }
  const candidate = legacy === 'plain' ? plain : legacyReversedBase64(plain);
  const ok = safeEqual(candidate, stored);
  return { ok, needsRehash: ok };
}

// 계정이 없을 때도 비밀번호 확인과 같은 시간이 걸리게 해서, 응답 속도로 "이 아이디/이 아이가 있다"는 것을 알아낼 수 없게 함
let dummyHash: string | null = null;
export function burnPasswordCheck(plain: string) {
  if (!dummyHash) dummyHash = hashPassword('dummy-password-for-timing');
  verifyPassword(plain || 'x', dummyHash, 'plain');
}

/** 관리자·담당자·최고 관리자 비밀번호 최소 길이 (학부모 수정 비밀번호는 4자 유지) */
export const STAFF_MIN_PASSWORD = 8;
export const STAFF_PASSWORD_MESSAGE = `비밀번호는 ${STAFF_MIN_PASSWORD}자 이상이어야 합니다.`;
