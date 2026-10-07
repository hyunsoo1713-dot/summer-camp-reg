// 서버 전용: 비밀번호 무차별 대입(계속 바꿔 넣어 보기) 방지
//
// 두 가지를 함께 셉니다.
//  1) 계정별: 같은 계정(아이디, 참가자 등)에 대한 실패 — IP를 바꿔도 소용없음 (핵심 방어)
//  2) IP별  : 한 곳에서 여러 계정을 두드리는 경우
// 서버가 여러 대로 늘어나도 같은 기록을 보도록 DB(rate_limits)에 저장합니다.
// 기록 문서 이름은 해시값이라 이름·연락처가 그대로 저장되지 않습니다.
import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { adminDb } from './firebaseAdmin';
import { HttpError } from './access';

const SHORT_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LIMITS = {
  account: { short: 10, day: 30 }, // 계정 하나: 15분에 10번, 하루 30번까지 틀릴 수 있음
  ip: { short: 30, day: 200 }, // 한 곳(같은 와이파이 등): 15분에 30번, 하루 200번
} as const;

export const BLOCKED_MESSAGE = '틀린 횟수가 너무 많아 잠시 막혔습니다. 15분 뒤(많이 틀린 경우 다음 날) 다시 시도해 주세요.';

/**
 * 요청한 사람의 IP. Cloud Run은 실제 접속 IP를 X-Forwarded-For의 "맨 끝"에 붙입니다.
 * 앞쪽 값은 요청자가 마음대로 써 넣을 수 있으므로 쓰지 않습니다.
 */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for') || '';
  const parts = fwd.split(',').map(s => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || 'unknown';
}

export interface LimitKey {
  kind: keyof typeof LIMITS;
  key: string;
}

/** 표준 키 묶음: IP 하나 + 계정 하나 */
export function limitKeys(req: NextRequest, scope: string, account: string, ipScope = scope): LimitKey[] {
  return [
    { kind: 'ip', key: `ip:${ipScope}:${clientIp(req)}` },
    { kind: 'account', key: `acct:${scope}:${account.trim().toLowerCase()}` },
  ];
}

interface Rec { s_count: number; s_reset: number; d_count: number; d_reset: number }

const docId = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 40);
const ref = (key: string) => adminDb().collection('rate_limits').doc(docId(key));

function norm(r: Partial<Rec>, now: number): Rec {
  return {
    s_count: now < Number(r.s_reset || 0) ? Number(r.s_count || 0) : 0,
    s_reset: now < Number(r.s_reset || 0) ? Number(r.s_reset) : now + SHORT_MS,
    d_count: now < Number(r.d_reset || 0) ? Number(r.d_count || 0) : 0,
    d_reset: now < Number(r.d_reset || 0) ? Number(r.d_reset) : now + DAY_MS,
  };
}

/**
 * 비밀번호를 확인하기 "전에" 시도 1번을 먼저 기록합니다. (동시에 수백 번 보내도 한 번에 하나씩 셈)
 * 이미 한도를 넘었으면 429 오류를 던집니다.
 */
export async function assertNotBlocked(keys: LimitKey[]) {
  const db = adminDb();
  const now = Date.now();
  for (const k of keys) {
    const lim = LIMITS[k.kind];
    await db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
      const snap = await tx.get(ref(k.key));
      const r = norm((snap.exists ? snap.data() : {}) as Partial<Rec>, now);
      if (r.s_count >= lim.short || r.d_count >= lim.day) throw new HttpError(429, BLOCKED_MESSAGE);
      tx.set(ref(k.key), { ...r, s_count: r.s_count + 1, d_count: r.d_count + 1 });
    });
  }
}

/** 실패: 미리 기록한 시도가 그대로 실패로 남음 (따로 할 일 없음) */
export async function recordFailure(_keys: LimitKey[]) {}

/** 성공: 계정 기록은 지우고, IP 기록은 미리 센 1번을 되돌림 */
export async function clearFailures(keys: LimitKey[]) {
  const db = adminDb();
  const now = Date.now();
  for (const k of keys) {
    try {
      if (k.kind === 'account') {
        await ref(k.key).set({ s_count: 0, s_reset: 0, d_count: 0, d_reset: 0 });
      } else {
        await db.runTransaction(async (tx: FirebaseFirestore.Transaction) => {
          const snap = await tx.get(ref(k.key));
          const r = norm((snap.exists ? snap.data() : {}) as Partial<Rec>, now);
          tx.set(ref(k.key), { ...r, s_count: Math.max(0, r.s_count - 1), d_count: Math.max(0, r.d_count - 1) });
        });
      }
    } catch (err) {
      console.error('[rate-limit] 정리 실패', err);
    }
  }
}

/** 오래된 기록 정리 (정기 작업에서 호출) */
export async function purgeOldRateLimits(now = Date.now()) {
  const db = adminDb();
  const snap = await db.collection('rate_limits').where('d_reset', '<', now).limit(400).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}
