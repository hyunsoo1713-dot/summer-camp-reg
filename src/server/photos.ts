// 서버 전용: 「참가자 사진 찾기」 — 행사 사진을 얼굴로 자동 분류하고, 누가 어떤 사진을 볼 수 있는지 판단합니다.
//
// 사진 종류 (올린 뒤 자동으로 정해짐)
//  - 풍경 사진     : 사람이 전혀 없음                 → 모든 참가자·담당자가 봄
//  - 찾은 사진     : 참가자 얼굴을 찾음                → 그 참가자(학부모)와 그 교회 담당자가 봄
//      · 확실함(유사도 99% 이상)  → 바로 공개
//      · 애매함(90~99%)          → 그 교회 담당자가 "맞아요/아니에요" 확인 후 공개
//  - 못 찾은 사진  : 사람은 있는데 아무도 못 찾음      → 지방회 관리자만 봄
//
// 지방회 관리자·최고 관리자는 모든 사진을 봅니다.
import type { NextRequest, NextResponse } from 'next/server';
import { adminBucket, adminDb } from './firebaseAdmin';
import { getSession, signToken, verifyToken, type Session } from './session';
import { collectionIdFor, getFaceProvider, type BBox } from './faceProvider';

export const VIEWER_COOKIE = 'evt_view';
const VIEWER_TTL_SEC = 60 * 60 * 2; // 2시간
export const PHOTOS_PER_PERSON = 50; // 1인당 100원 기준, 참가자 1명당 올릴 수 있는 사진 수
export const MAX_PHOTOS_PER_EVENT = 20000;
export const AUTO_SIMILARITY = 99; // 이 이상이면 바로 공개
export const REVIEW_SIMILARITY = 90; // 이 이상이면 담당자 확인 후 공개
export const FEE_PER_PERSON = 100;
export const KEEP_DAYS_AFTER_END = 30; // 행사 마지막 날 이후 이 기간이 지나면 사진·얼굴 정보 자동 삭제
const DAY_MS = 24 * 60 * 60 * 1000;

export type FaceState = 'auto' | 'pending' | 'confirmed' | 'rejected';
export interface PhotoFace {
  faceId: string;
  bbox: BBox;
  pid?: string;
  church_id?: string;
  sim?: number;
  state?: FaceState;
}

export interface PhotoDoc {
  id: string;
  district_id: string;
  event_id: string;
  full_path: string;
  thumb_path: string;
  width?: number;
  height?: number;
  uploaded_by: string;
  uploader_name: string;
  created_at: string;
  faces: PhotoFace[];
  has_person: boolean;
}

export interface PhotoMatchSetting {
  status: 'off' | 'requested' | 'on';
  expected_count?: number;
  paid_count?: number;
  requested_at?: string;
  requested_by?: string;
  enabled_at?: string;
  purged_at?: string; // 자동 삭제가 끝난 시각
}

export const photoMatchOf = (ev: Record<string, any> | undefined | null): PhotoMatchSetting =>
  (ev?.photo_match as PhotoMatchSetting) || { status: 'off' };

export const photoLimitOf = (pm: PhotoMatchSetting) =>
  Math.min(MAX_PHOTOS_PER_EVENT, Math.max(0, Number(pm.paid_count || 0)) * PHOTOS_PER_PERSON);

/**
 * 자동 영구 삭제 시각 (한국 시간 기준) — 사진·얼굴 정보와 참가자 명단 모두 같은 날
 * 예) 마지막 날 8월 15일 → 8월 16일~9월 14일(30일) 동안 남아 있고, 9월 15일 0시에 삭제
 * 안전장치: 신청 마감일이 행사 마지막 날보다 늦게 잘못 적혀 있으면 더 늦은 날을 기준으로 함
 */
export function photoDeleteAt(ev: Record<string, any> | undefined | null): Date | null {
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
export const dataDeleteAt = photoDeleteAt;

export const isPhotoExpired = (ev: Record<string, any> | undefined | null, now = Date.now()) => {
  const at = photoDeleteAt(ev);
  return !!at && now >= at.getTime();
};

export type Viewer =
  | { kind: 'staff'; session: Session }
  | { kind: 'participant'; participant: Record<string, any> };

// ---------------------------------------------------------------------------
// 학부모·참가자 임시 출입증
// ---------------------------------------------------------------------------
export function setViewerCookie(res: NextResponse, participantId: string, districtId: string) {
  res.cookies.set(VIEWER_COOKIE, signToken({ pid: participantId, did: districtId }, VIEWER_TTL_SEC), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: VIEWER_TTL_SEC,
  });
}

export function clearViewerCookie(res: NextResponse) {
  res.cookies.set(VIEWER_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function getViewer(req: NextRequest): Promise<Viewer | null> {
  const session = await getSession(req);
  if (session) return { kind: 'staff', session };
  const t = verifyToken<{ pid?: string; did?: string }>(req.cookies.get(VIEWER_COOKIE)?.value);
  if (!t?.pid || !t?.did) return null;
  const snap = await adminDb().collection('participants').doc(String(t.pid)).get();
  if (!snap.exists) return null;
  const p = { ...snap.data(), id: snap.id } as Record<string, any>;
  if (p.district_id !== t.did) return null;
  return { kind: 'participant', participant: p };
}

// ---------------------------------------------------------------------------
// 사진 분류와 공개 범위
// ---------------------------------------------------------------------------
const visibleState = (s?: FaceState) => s === 'auto' || s === 'confirmed';

export type PhotoKind = 'scenery' | 'matched' | 'unmatched';
export function photoKind(p: PhotoDoc): PhotoKind {
  if (!p.has_person && (p.faces || []).length === 0) return 'scenery';
  if ((p.faces || []).some(f => f.pid && f.state !== 'rejected')) return 'matched';
  return 'unmatched';
}

export function isStaffAll(v: Viewer): boolean {
  return v.kind === 'staff' && (v.session.role === 'super' || v.session.role === 'admin');
}

export function inDistrict(p: PhotoDoc, v: Viewer): boolean {
  if (v.kind === 'participant') return p.district_id === v.participant.district_id && p.event_id === v.participant.event_id;
  if (v.session.role === 'super') return true;
  return p.district_id === v.session.districtId;
}

export function canView(p: PhotoDoc, v: Viewer): boolean {
  if (!inDistrict(p, v)) return false;
  if (isStaffAll(v)) return true;
  if (photoKind(p) === 'scenery') return true;
  const faces = p.faces || [];
  if (v.kind === 'participant') return faces.some(f => f.pid === v.participant.id && visibleState(f.state));
  const s = v.session;
  if (s.managerId && p.uploaded_by === s.managerId) return true; // 내가 올린 사진
  return faces.some(f => f.church_id === s.churchId && (visibleState(f.state) || f.state === 'pending'));
}

/** 교회 담당자(또는 관리자)가 확인해야 할 얼굴 */
export function reviewableFaces(p: PhotoDoc, v: Viewer): PhotoFace[] {
  if (v.kind !== 'staff' || !inDistrict(p, v)) return [];
  const faces = (p.faces || []).filter(f => f.pid && f.state === 'pending');
  if (isStaffAll(v)) return faces;
  return faces.filter(f => f.church_id === v.session.churchId);
}

export function canUpload(v: Viewer, districtId: string): boolean {
  if (v.kind !== 'staff') return false;
  if (v.session.role === 'super') return true;
  return v.session.districtId === districtId; // 지방회 관리자·교회 담당자 모두 올릴 수 있음
}

export function canDelete(p: PhotoDoc, v: Viewer): boolean {
  if (v.kind !== 'staff' || !inDistrict(p, v)) return false;
  if (isStaffAll(v)) return true;
  return p.uploaded_by === v.session.managerId;
}

// ---------------------------------------------------------------------------
// 자동 분류 실행: 참가자 1명당 한 번씩 "닮은 얼굴 찾기"
// ---------------------------------------------------------------------------
export async function runMatching(eventId: string): Promise<{ matched: number; pending: number; photos: number }> {
  const db = adminDb();
  const provider = getFaceProvider();
  const coll = collectionIdFor(eventId);

  const [partSnap, photoSnap] = await Promise.all([
    db.collection('participants').where('event_id', '==', eventId).get(),
    db.collection('photos').where('event_id', '==', eventId).get(),
  ]);
  const people = partSnap.docs
    .map(d => ({ ...d.data(), id: d.id }) as Record<string, any>)
    .filter(p => p.face_consent === true && p.face_id);

  // 사진 속 얼굴 id → 가장 닮은 참가자
  const best = new Map<string, { pid: string; church_id: string; sim: number }>();
  for (const p of people) {
    const matches = await provider.searchFace(coll, String(p.face_id), REVIEW_SIMILARITY);
    for (const m of matches) {
      if (!m.externalId.startsWith('ph_')) continue; // 다른 참가자 얼굴은 무시
      const cur = best.get(m.faceId);
      if (!cur || m.similarity > cur.sim) best.set(m.faceId, { pid: p.id, church_id: String(p.church_id || ''), sim: m.similarity });
    }
  }

  let matched = 0;
  let pending = 0;
  const updates: { ref: FirebaseFirestore.DocumentReference; faces: PhotoFace[] }[] = [];
  for (const d of photoSnap.docs) {
    const photo = d.data() as PhotoDoc;
    let changed = false;
    const faces = (photo.faces || []).map(f => {
      const b = best.get(f.faceId);
      // 담당자가 이미 판단한 얼굴은 그대로 둠
      if (f.pid && (f.state === 'confirmed' || f.state === 'rejected') && (!b || b.pid === f.pid)) return f;
      if (!b) {
        if (f.pid) changed = true;
        return { faceId: f.faceId, bbox: f.bbox };
      }
      const state: FaceState = b.sim >= AUTO_SIMILARITY ? 'auto' : 'pending';
      const next: PhotoFace = { faceId: f.faceId, bbox: f.bbox, pid: b.pid, church_id: b.church_id, sim: Math.round(b.sim * 10) / 10, state };
      if (f.pid !== next.pid || f.state !== next.state || f.sim !== next.sim) changed = true;
      return next;
    });
    faces.forEach(f => {
      if (f.pid && visibleState(f.state)) matched++;
      if (f.pid && f.state === 'pending') pending++;
    });
    if (changed) updates.push({ ref: d.ref, faces });
  }
  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch();
    updates.slice(i, i + 400).forEach(u => batch.update(u.ref, { faces: u.faces }));
    await batch.commit();
  }
  return { matched, pending, photos: photoSnap.size };
}

// ---------------------------------------------------------------------------
// 삭제
// ---------------------------------------------------------------------------
export async function deletePhotoFiles(p: { full_path?: string; thumb_path?: string }) {
  const bucket = adminBucket();
  await Promise.all(
    [p.full_path, p.thumb_path]
      .filter((x): x is string => !!x)
      .map(path => bucket.file(path).delete({ ignoreNotFound: true }).catch(() => {}))
  );
}

/** 참가자 얼굴 정보 삭제 (동의 철회·참가자 삭제 시) */
export async function removeParticipantFace(p: Record<string, any>) {
  try {
    if (p.face_id && p.event_id) await getFaceProvider().deleteFaces(collectionIdFor(String(p.event_id)), [String(p.face_id)]);
  } catch (err) {
    console.error('[face] 얼굴 삭제 실패', err);
  }
  if (p.face_photo_path) await adminBucket().file(String(p.face_photo_path)).delete({ ignoreNotFound: true }).catch(() => {});
}

/** 한 행사의 사진·얼굴 정보 전부 삭제 (참가자 신청 정보는 그대로 둠) */
export async function purgeEventPhotos(eventId: string): Promise<number> {
  const db = adminDb();
  const bucket = adminBucket();
  const [snap, partSnap] = await Promise.all([
    db.collection('photos').where('event_id', '==', eventId).get(),
    db.collection('participants').where('event_id', '==', eventId).get(),
  ]);
  for (const d of snap.docs) await deletePhotoFiles(d.data());
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  const withFace = partSnap.docs.filter(d => d.data().face_id || d.data().face_photo_path);
  for (const d of withFace) {
    const fp = d.data().face_photo_path;
    if (fp) await bucket.file(String(fp)).delete({ ignoreNotFound: true }).catch(() => {});
  }
  for (let i = 0; i < withFace.length; i += 400) {
    const batch = db.batch();
    withFace.slice(i, i + 400).forEach(d => batch.update(d.ref, { face_id: null, face_photo_path: null, face_enrolled_at: null }));
    await batch.commit();
  }
  try {
    await getFaceProvider().deleteCollection(collectionIdFor(eventId));
  } catch (err) {
    console.error('[face] 얼굴 모음 삭제 실패', err);
  }
  return snap.size;
}

/** 행사에 딸린 참가자 명단·조편성·참가비 기록 영구 삭제 (행사 정보, 교회 목록, 담당자 계정은 남김) */
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

/** 삭제할 때가 된 행사: 사진·얼굴 정보와 참가자 명단을 모두 영구 삭제 */
export async function runPhotoCleanup(now = Date.now()): Promise<{ purged: string[] }> {
  const db = adminDb();
  const evSnap = await db.collection('events').get();
  const purged: string[] = [];
  const at = new Date(now).toISOString();
  for (const d of evSnap.docs) {
    const ev = d.data();
    if (!isPhotoExpired(ev, now)) continue;
    // 이미 지웠으면 건너뜀 (단, 같은 행사를 날짜만 바꿔 다시 쓴 경우엔 새 기한이 지나면 다시 지움)
    const due = photoDeleteAt(ev)!.getTime();
    if (ev.data_purged_at && Date.parse(String(ev.data_purged_at)) >= due) continue;
    const update: Record<string, unknown> = { data_purged_at: at, is_active: false };
    // 1) 사진·얼굴 정보 (얼굴 정보가 참가자 문서를 참고하므로 명단보다 먼저)
    const pm = ev.photo_match as PhotoMatchSetting | undefined;
    await purgeEventPhotos(d.id);
    if (pm) update.photo_match = { ...pm, status: 'off', purged_at: at };
    // 2) 참가자 명단·조편성·참가비 기록
    const n = await purgeEventData(d.id);
    await d.ref.update(update);
    purged.push(d.id);
    console.log(`[auto-purge] 행사 ${d.id}: 사진·얼굴 정보와 명단 등 ${n}건 영구 삭제`);
  }
  return { purged };
}

// 서버가 따로 알람 없이도 돌도록: 누군가 앱을 쓸 때 1시간에 한 번만 확인
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastLocalCheck = 0;
export async function maybeRunPhotoCleanup(): Promise<{ ran: boolean; purged?: string[] }> {
  const now = Date.now();
  if (now - lastLocalCheck < 10 * 60 * 1000) return { ran: false };
  lastLocalCheck = now;
  try {
    const ref = adminDb().collection('system').doc('photo_cleanup');
    const snap = await ref.get();
    const last = snap.exists ? Date.parse(String(snap.data()?.last_run || '')) : NaN;
    if (!Number.isNaN(last) && now - last < CLEANUP_INTERVAL_MS) return { ran: false };
    await ref.set({ last_run: new Date(now).toISOString() });
    const r = await runPhotoCleanup(now);
    return { ran: true, purged: r.purged };
  } catch (err) {
    console.error('[photo-cleanup] 실패', err);
    return { ran: false };
  }
}

/** 지방회의 사진·얼굴 정보 전부 삭제 (명단 정리·지방회 삭제 시) */
export async function purgeDistrictPhotos(districtId: string): Promise<number> {
  const db = adminDb();
  const [snap, evSnap, partSnap] = await Promise.all([
    db.collection('photos').where('district_id', '==', districtId).get(),
    db.collection('events').where('district_id', '==', districtId).get(),
    db.collection('participants').where('district_id', '==', districtId).get(),
  ]);
  for (const d of snap.docs) await deletePhotoFiles(d.data());
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  // 참가자 얼굴 사진 파일
  const bucket = adminBucket();
  for (const d of partSnap.docs) {
    const fp = d.data().face_photo_path;
    if (fp) await bucket.file(String(fp)).delete({ ignoreNotFound: true }).catch(() => {});
  }
  // 행사별 얼굴 모음 삭제
  for (const e of evSnap.docs) {
    try {
      await getFaceProvider().deleteCollection(collectionIdFor(e.id));
    } catch (err) {
      console.error('[face] 얼굴 모음 삭제 실패', err);
    }
  }
  return snap.size;
}
