// 서버 전용: 개인정보 자동 파기
// 행사 마지막 날로부터 30일이 지나면 참가자 명단·조편성·참가비 기록을 영구 삭제합니다.
// (행사 정보, 교회 목록, 담당자 계정, 입금 계좌 설정은 남겨 다음 행사에 다시 씁니다)
import { adminDb } from './firebaseAdmin';
import { purgeOldRateLimits } from './rateLimit';

export const KEEP_DAYS_AFTER_END = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 자동 영구 삭제 시각 (한국 시간 기준)
 * 예) 마지막 날 8월 15일 → 8월 16일~9월 14일(30일) 동안 남아 있고, 9월 15일 0시에 삭제
 * 안전장치: 신청 마감일이 행사 마지막 날보다 늦게 잘못 적혀 있으면 더 늦은 날을 기준으로 함
 */
export function dataDeleteAt(ev: Record<string, any> | undefined | null): Date | null {
  const day = (v: unknown) => {
    const d = String(v || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return NaN;
    return Date.parse(`${d}T00:00:00+09:00`);
  };
  const end = day(ev?.end_date);
  if (Number.isNaN(end)) return null;
  const reg = day(ev?.registration_end_date);
  const base = Number.isNaN(reg) ? end : Math.max(end, reg);
  return new Date(base + (KEEP_DAYS_AFTER_END + 1) * DAY_MS);
}

export const isDataExpired = (ev: Record<string, any> | undefined | null, now = Date.now()) => {
  const at = dataDeleteAt(ev);
  return !!at && now >= at.getTime();
};

/** 행사에 딸린 참가자 명단·조편성·참가비 기록 */
export const EVENT_DATA_COLLECTIONS = [
  'participants',
  'same_group_requests',
  'grouping_groups',
  'groups',
  'church_fee_overrides',
  'church_payment_statuses',
] as const;

export async function purgeEventData(eventId: string): Promise<number> {
  const db = adminDb();
  let count = 0;
  for (const col of EVENT_DATA_COLLECTIONS) {
    const snap = await db.collection(col).where('event_id', '==', eventId).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    count += snap.size;
  }
  return count;
}

/** 삭제할 때가 된 행사의 명단을 모두 영구 삭제 */
export async function runRetentionCleanup(now = Date.now()): Promise<{ purged: string[] }> {
  const db = adminDb();
  const evSnap = await db.collection('events').get();
  const purged: string[] = [];
  const at = new Date(now).toISOString();
  for (const d of evSnap.docs) {
    const ev = d.data();
    if (!isDataExpired(ev, now)) continue;
    // 이미 지웠으면 건너뜀 (단, 같은 행사를 날짜만 바꿔 다시 쓴 경우엔 새 기한이 지나면 다시 지움)
    const due = dataDeleteAt(ev)!.getTime();
    if (ev.data_purged_at && Date.parse(String(ev.data_purged_at)) >= due) continue;
    const n = await purgeEventData(d.id);
    await d.ref.update({ data_purged_at: at, is_active: false });
    purged.push(d.id);
    console.log(`[auto-purge] 행사 ${d.id}: 명단 등 ${n}건 영구 삭제`);
  }
  return { purged };
}

// 서버가 따로 알람 없이도 돌도록: 누군가 앱을 쓸 때 1시간에 한 번만 확인
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastLocalCheck = 0;
export async function maybeRunRetentionCleanup(): Promise<{ ran: boolean; purged?: string[] }> {
  const now = Date.now();
  if (now - lastLocalCheck < 10 * 60 * 1000) return { ran: false };
  lastLocalCheck = now;
  try {
    const ref = adminDb().collection('system').doc('retention_cleanup');
    const snap = await ref.get();
    const last = snap.exists ? Date.parse(String(snap.data()?.last_run || '')) : NaN;
    if (!Number.isNaN(last) && now - last < CLEANUP_INTERVAL_MS) return { ran: false };
    await ref.set({ last_run: new Date(now).toISOString() });
    const r = await runRetentionCleanup(now);
    await purgeOldRateLimits(now).catch(err => console.error('[rate-limit] 정리 실패', err));
    return { ran: true, purged: r.purged };
  } catch (err) {
    console.error('[auto-purge] 실패', err);
    return { ran: false };
  }
}
