// 서버 전용: "문지기" — 누가 어떤 데이터를 보고/쓸 수 있는지 판단하고 실제 DB 작업을 수행합니다.
import type { DocumentData } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin';
import { hashPassword, verifyPassword, STAFF_MIN_PASSWORD, STAFF_PASSWORD_MESSAGE } from './password';
import type { Session } from './session';

type Doc = Record<string, any>;

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const forbidden = (msg = '이 작업을 할 권한이 없습니다.') => new HttpError(403, msg);
const bad = (msg: string) => new HttpError(400, msg);

export const COLLECTIONS = [
  'districts',
  'events',
  'churches',
  'church_managers',
  'participants',
  'same_group_requests',
  'grouping_groups',
  'groups',
  'payment_settings',
  'church_fee_overrides',
  'church_payment_statuses',
  'platform_config',
] as const;
export type Collection = (typeof COLLECTIONS)[number];

const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,49}$/;
const RESERVED_LOGIN_IDS = new Set(['admin', 'super', 'root']);

export const todayKST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// 민감정보 제거 (비밀번호 해시는 절대 브라우저로 보내지 않음)
// ---------------------------------------------------------------------------
export function sanitize(col: string, doc: Doc, opts: { publicView?: boolean } = {}): Doc {
  const d = { ...doc };
  if (col === 'church_managers') delete d.password_hash;
  if (col === 'participants') {
    delete d.edit_password_hash;
    for (const k of Object.keys(d)) if (k.startsWith('face_')) delete d[k]; // 예전 사진 기능의 남은 값
  }
  if (col === 'events') delete d.photo_match; // 예전 사진 기능의 남은 값
  if (col === 'platform_config') {
    delete d.super_admin_password;
    delete d.super_session_version;
  }
  if (col === 'church_managers') delete d.session_version;
  if (col === 'districts' && opts.publicView) {
    delete d.phone;
    delete d.manager_name;
  }
  return d;
}

const toDocs = (snap: FirebaseFirestore.QuerySnapshot<DocumentData>): Doc[] =>
  snap.docs.map(s => ({ ...s.data(), id: s.id }));

// ---------------------------------------------------------------------------
// 읽기: 로그인 상태(역할)에 맞는 데이터만 내려줌
// ---------------------------------------------------------------------------
export async function loadScopedData(session: Session | null): Promise<Record<string, Doc[]>> {
  const db = adminDb();
  const all = async (col: Collection) => toDocs(await db.collection(col).get());
  const byField = async (col: Collection, field: string, value: string) =>
    toDocs(await db.collection(col).where(field, '==', value).get());

  const out: Record<string, Doc[]> = {};
  const clean = (col: Collection, docs: Doc[], publicView = false) => docs.map(d => sanitize(col, d, { publicView }));

  if (session?.role === 'super') {
    for (const col of COLLECTIONS) out[col] = clean(col, await all(col));
    return out;
  }

  // 모두에게 공개되는 정보: 승인된 지방회 목록, 행사 안내, 교회 목록, 입금 계좌, 참가비
  const districts = await all('districts');
  const approved = districts.filter(d => d.status === 'approved');
  const approvedIds = new Set(approved.map(d => d.id));
  const inApproved = (d: Doc) => approvedIds.has(d.district_id);

  // 내부 메모·신청자 이름 등은 그 지방회 관리자에게만
  const ownAdminD = session?.role === 'admin' ? session.districtId : undefined;
  const hideInternal = (d: Doc): Doc => {
    if (d.district_id === ownAdminD) return d;
    const { memo: _memo, ...rest } = d;
    return rest;
  };
  out.districts = clean('districts', approved, true);
  out.events = clean('events', (await all('events')).filter(inApproved)).map(hideInternal);
  out.churches = (await all('churches')).filter(inApproved).map(hideInternal);
  out.payment_settings = (await all('payment_settings')).filter(inApproved).map(hideInternal);
  out.church_fee_overrides = (await all('church_fee_overrides')).filter(inApproved);
  out.platform_config = clean('platform_config', await all('platform_config'));
  out.church_managers = [];
  out.participants = [];
  out.same_group_requests = [];
  out.grouping_groups = [];
  out.groups = [];
  out.church_payment_statuses = [];

  if (!session || !session.districtId) return out;
  const D = session.districtId;

  // 로그인한 지방회는 전체 정보(연락처 포함) 제공
  const own = districts.find(d => d.id === D);
  if (own) out.districts = [...out.districts.filter(d => d.id !== D), sanitize('districts', own)];

  if (session.role === 'admin') {
    out.church_managers = clean('church_managers', await byField('church_managers', 'district_id', D));
    out.participants = clean('participants', await byField('participants', 'district_id', D));
    out.same_group_requests = await byField('same_group_requests', 'district_id', D);
    out.grouping_groups = await byField('grouping_groups', 'district_id', D);
    out.groups = await byField('groups', 'district_id', D);
    out.church_payment_statuses = await byField('church_payment_statuses', 'district_id', D);
    return out;
  }

  // 교회 담당자: 자기 교회 정보만
  const C = session.churchId || '';
  if (!C) return out;
  out.church_managers = clean(
    'church_managers',
    (await byField('church_managers', 'church_id', C)).filter(m => m.district_id === D)
  );
  out.participants = clean(
    'participants',
    (await byField('participants', 'church_id', C)).filter(p => p.district_id === D)
  );
  out.same_group_requests = (await byField('same_group_requests', 'church_id', C)).filter(r => r.district_id === D);
  out.grouping_groups = await byField('grouping_groups', 'district_id', D);
  out.groups = await byField('groups', 'district_id', D);
  out.church_payment_statuses = (await byField('church_payment_statuses', 'church_id', C)).filter(
    s => s.district_id === D
  );
  return out;
}

// ---------------------------------------------------------------------------
// 쓰기
// ---------------------------------------------------------------------------
export type WriteOp =
  | { kind: 'set' | 'update'; col: string; id: string; data: Doc }
  | { kind: 'delete'; col: string; id: string }
  | { kind: 'recalc'; churchId: string };

export interface EditAuth {
  phone: string;
  password: string;
}

interface Ctx {
  session: Session | null;
  editAuth?: EditAuth;
  createdDistricts: Set<string>;
  newLoginIds: Set<string>;
  affectedChurches: Set<string>;
  affectedDistrictsForRecalc: Set<string>;
  pending: Map<string, Doc | null>; // 같은 요청 안에서 먼저 만든 문서 (예: 새 행사 + 그 행사의 교회)
}

const PARTICIPANT_FIELDS = new Set([
  'id', 'district_id', 'event_id', 'church_id', 'participant_type', 'name', 'gender', 'department',
  'birth_year', 'guardian_name', 'guardian_phone', 'personal_phone', 'role', 'shirt_size', 'health_note',
  'photo_consent', 'custom_consent_agreed', 'attendance_schedule', 'memo', 'assigned_group_id',
  'created_at', 'updated_at',
]);
const PUBLIC_DISTRICT_FIELDS = new Set(['id', 'name', 'slug', 'manager_name', 'phone', 'admin_church_name', 'created_at']);
const PUBLIC_MANAGER_FIELDS = new Set([
  'id', 'district_id', 'church_id', 'name', 'gender', 'phone', 'login_id', 'memo', 'is_admin', 'is_manager',
  'requested_church_name', 'shirt_size', 'created_at',
]);
const MANAGER_SELF_FIELDS = new Set(['name', 'gender', 'phone', 'shirt_size', 'memo']);

const pick = (d: Doc, allowed: Set<string>): Doc => {
  const out: Doc = {};
  for (const k of Object.keys(d)) if (allowed.has(k)) out[k] = d[k];
  return out;
};

function checkSize(d: Doc, maxBytes: number) {
  if (JSON.stringify(d).length > maxBytes) throw bad('입력한 내용이 너무 깁니다.');
}

function requireText(v: unknown, label: string, max = 100) {
  if (typeof v !== 'string' || !v.trim()) throw bad(`${label}을(를) 입력해 주세요.`);
  if (v.length > max) throw bad(`${label}이(가) 너무 깁니다.`);
}

async function getDoc(col: string, id: string): Promise<Doc | null> {
  const s = await adminDb().collection(col).doc(id).get();
  return s.exists ? ({ ...s.data(), id: s.id } as Doc) : null;
}

async function loginIdTaken(loginId: string, exceptId?: string): Promise<boolean> {
  if (RESERVED_LOGIN_IDS.has(loginId.toLowerCase())) return true;
  const superId = process.env.SUPER_ADMIN_LOGIN_ID;
  if (superId && superId === loginId) return true;
  const snap = await adminDb().collection('church_managers').where('login_id', '==', loginId).limit(2).get();
  return snap.docs.some(d => d.id !== exceptId);
}

function participantPhone(p: Doc): string {
  return String((p.participant_type === '학생' ? p.guardian_phone : p.personal_phone) || '').trim();
}

/** 학부모/개인이 이름·연락처·비밀번호로 본인 등록 정보를 수정·삭제할 때 검증 */
export function checkEditAuth(p: Doc, auth: EditAuth | undefined): boolean {
  if (!auth || !auth.phone || !auth.password) return false;
  if (participantPhone(p) !== String(auth.phone).trim()) return false;
  return verifyPassword(auth.password, p.edit_password_hash, 'reversed-b64').ok;
}

// 역할별 권한 검사 + 저장할 최종 문서 계산. 반환값 null = 삭제
async function authorizeAndBuild(op: Exclude<WriteOp, { kind: 'recalc' }>, ctx: Ctx): Promise<Doc | null | 'skip'> {
  const { session } = ctx;
  const col = op.col as Collection;
  if (!COLLECTIONS.includes(col)) throw bad('알 수 없는 데이터 종류입니다.');
  if (!ID_RE.test(op.id)) throw bad('잘못된 문서 ID입니다.');

  const existing = await getDoc(col, op.id);
  if (op.kind === 'update' && !existing) return 'skip';
  if (op.kind === 'delete' && !existing) return 'skip';

  const incoming: Doc = op.kind === 'delete' ? {} : { ...(op.data || {}) };
  delete incoming.id;

  // 비밀번호 관련 필드는 "새 비밀번호(평문)"로만 받아 서버에서 해시합니다.
  const newManagerPw: string | undefined =
    col === 'church_managers' && typeof incoming.password_hash === 'string' && incoming.password_hash.length > 0
      ? incoming.password_hash
      : undefined;
  delete incoming.password_hash;
  const newEditPw: string | undefined =
    col === 'participants' && typeof incoming.edit_password === 'string' && incoming.edit_password.length > 0
      ? incoming.edit_password
      : undefined;
  delete incoming.edit_password;
  delete incoming.edit_password_hash;
  delete incoming.super_admin_password;
  delete incoming.session_version;
  delete incoming.super_session_version;
  delete incoming.data_purged_at;

  let next: Doc | null =
    op.kind === 'delete' ? null : op.kind === 'update' ? { ...(existing || {}), ...incoming } : { ...incoming };

  // 보호 필드는 기존 값 유지
  if (next && existing) {
    if (col === 'church_managers') {
      next.password_hash = existing.password_hash;
      next.session_version = existing.session_version ?? 0;
    }
    if (col === 'participants') next.edit_password_hash = existing.edit_password_hash;
    if (col === 'platform_config') {
      // 비밀번호·세션 버전은 저장 내용에서 빼고 '덮어쓰지 않는 저장(merge)'으로 처리 → 동시에 바뀐 값이 사라지지 않음
      delete next.super_admin_password;
      delete next.super_session_version;
    }
    if (col === 'church_payment_statuses') next.total_amount = existing.total_amount ?? 0;
    if (existing.created_at && !next.created_at) next.created_at = existing.created_at;
  } else if (next && col === 'church_payment_statuses') {
    next.total_amount = 0;
  }
  if (next) next.id = op.id;

  // ----- 역할별 권한 -----
  const role = session?.role;

  if (role === 'super') {
    // 최고 관리자는 모든 데이터 관리 가능
  } else if (role === 'admin') {
    const D = session!.districtId!;
    if (col === 'platform_config') throw forbidden();
    if (col === 'districts') {
      if (op.id !== D || !existing || !next) throw forbidden();
      next.status = existing.status;
      next.slug = existing.slug;
    } else {
      if (existing && existing.district_id !== D) throw forbidden();
      if (next && next.district_id !== D) throw forbidden();
    }
  } else if (role === 'manager') {
    const D = session!.districtId!;
    const C = session!.churchId!;
    const inScope = (d: Doc | null) => !d || (d.district_id === D && d.church_id === C);
    if (col === 'participants') {
      if (!C || !inScope(existing) || !inScope(next)) throw forbidden();
      if (next) next.assigned_group_id = existing ? existing.assigned_group_id ?? null : null;
    } else if (col === 'same_group_requests') {
      if (!C || !inScope(existing) || !inScope(next)) throw forbidden();
    } else if (col === 'church_managers') {
      if (op.id !== session!.managerId || !existing || !next || newManagerPw) throw forbidden();
      next = { ...existing, ...pick(incoming, MANAGER_SELF_FIELDS), id: op.id };
    } else {
      throw forbidden();
    }
  } else {
    // ----- 로그인하지 않은 방문자(학부모·신청자) -----
    if (col === 'districts') {
      if (existing || !next) throw forbidden();
      next = pick(next, PUBLIC_DISTRICT_FIELDS);
      next.id = op.id;
      requireText(next.name, '지방회 이름');
      requireText(next.manager_name, '담당자 이름', 50);
      requireText(next.phone, '연락처', 30);
      if (typeof next.slug !== 'string' || !SLUG_RE.test(next.slug)) {
        throw bad('영문 주소는 영문 소문자, 숫자, 하이픈(-)만 2~50자로 입력해 주세요.');
      }
      const dup = await adminDb().collection('districts').where('slug', '==', next.slug).limit(1).get();
      if (!dup.empty) throw bad('이미 사용 중인 영문 주소(slug)입니다.');
      next.status = 'pending';
      next.created_at = new Date().toISOString();
      ctx.createdDistricts.add(op.id);
    } else if (col === 'church_managers') {
      if (existing || !next) throw forbidden();
      next = pick(next, PUBLIC_MANAGER_FIELDS);
      next.id = op.id;
      next.status = 'pending';
      if (next.is_admin) {
        if (!ctx.createdDistricts.has(next.district_id)) throw forbidden();
        next.church_id = '';
        next.is_manager = false;
      } else {
        const dist = await getDoc('districts', String(next.district_id || ''));
        if (!dist || dist.status !== 'approved') throw bad('유효하지 않은 지방회입니다.');
        next.is_admin = false;
        next.is_manager = true;
        if (next.church_id !== 'temp_new_church') {
          const ch = await getDoc('churches', String(next.church_id || ''));
          if (!ch || ch.district_id !== next.district_id) throw bad('소속 교회를 다시 선택해 주세요.');
        }
      }
      requireText(next.name, '이름', 50);
      requireText(next.login_id, '아이디', 50);
      if (!newManagerPw || newManagerPw.length < STAFF_MIN_PASSWORD) throw bad(STAFF_PASSWORD_MESSAGE);
      checkSize(next, 20000);
    } else if (col === 'participants') {
      if (!existing) {
        // 신규 참가 신청
        if (!next) throw forbidden();
        next = pick(next, PARTICIPANT_FIELDS);
        next.id = op.id;
        const dist = await getDoc('districts', String(next.district_id || ''));
        if (!dist || dist.status !== 'approved') throw bad('유효하지 않은 지방회입니다.');
        const ev = await getDoc('events', String(next.event_id || ''));
        if (!ev || ev.district_id !== next.district_id || !ev.is_active) throw bad('진행 중인 행사가 아닙니다.');
        const today = todayKST();
        if (ev.registration_start_date && today < ev.registration_start_date) throw bad('아직 등록 기간이 아닙니다.');
        if (ev.registration_end_date && today > ev.registration_end_date) throw bad('등록 기간이 종료되었습니다.');
        const ch = await getDoc('churches', String(next.church_id || ''));
        if (!ch || ch.district_id !== next.district_id) throw bad('소속 교회를 다시 선택해 주세요.');
        requireText(next.name, '이름', 50);
        if (!newEditPw || newEditPw.length < 4) throw bad('수정용 비밀번호는 최소 4글자 이상이어야 합니다.');
        next.assigned_group_id = null;
        checkSize(next, 20000);
      } else {
        // 본인 수정/삭제: 연락처 + 비밀번호 확인 필수
        if (!checkEditAuth(existing, ctx.editAuth)) throw forbidden('본인 확인에 실패했습니다. 다시 조회해 주세요.');
        const ev = await getDoc('events', String(existing.event_id || ''));
        if (ev?.edit_deadline && todayKST() > ev.edit_deadline) throw bad('수정 기한이 지나 수정할 수 없습니다.');
        if (next) {
          next = { ...pick(next, PARTICIPANT_FIELDS), id: op.id };
          next.district_id = existing.district_id;
          next.event_id = existing.event_id;
          next.assigned_group_id = existing.assigned_group_id ?? null;
          next.edit_password_hash = existing.edit_password_hash;
          next.created_at = existing.created_at;
          if (next.church_id !== existing.church_id) {
            const ch = await getDoc('churches', String(next.church_id || ''));
            if (!ch || ch.district_id !== existing.district_id) throw bad('소속 교회를 다시 선택해 주세요.');
          }
          requireText(next.name, '이름', 50);
          checkSize(next, 20000);
        }
      }
    } else {
      throw new HttpError(401, '로그인이 필요합니다. 다시 로그인해 주세요.');
    }
  }

  // ----- 행사·교회가 같은 지방회 것인지 확인 (다른 지방회 행사로 옮겨 넣기 차단) -----
  if (next && session && session.role !== 'super') {
    const D = session.districtId;
    const lookup = async (c: string, id: string) =>
      ctx.pending.has(`${c}/${id}`) ? ctx.pending.get(`${c}/${id}`) : await getDoc(c, id);
    // 사람 정보가 들어 있는 문서만 행사 확인 (교회·참가비 설정 등은 지방회 확인으로 충분)
    const EVENT_SCOPED = ['participants', 'same_group_requests', 'groups', 'grouping_groups'];
    if (EVENT_SCOPED.includes(col) && next.event_id !== undefined && next.event_id !== null && next.event_id !== '' && (!existing || existing.event_id !== next.event_id)) {
      const ev = await lookup('events', String(next.event_id));
      if (!ev || ev.district_id !== D) throw forbidden();
    }
    if (
      col !== 'churches' &&
      next.church_id && next.church_id !== 'temp_new_church' &&
      (!existing || existing.church_id !== next.church_id)
    ) {
      const ch = await lookup('churches', String(next.church_id));
      if (!ch || ch.district_id !== D) throw forbidden();
    }
  }

  // ----- 공통 후처리 -----
  if (next && col === 'events') {
    delete next.photo_match;
    // 자동 파기 기록은 서버만 씀
    if (existing?.data_purged_at) next.data_purged_at = existing.data_purged_at;
    else delete next.data_purged_at;
  }
  if (next && col === 'participants') {
    for (const k of Object.keys(next)) if (k.startsWith('face_')) delete next[k]; // 예전 사진 기능 값은 받지 않음
  }
  if (next && col === 'church_managers') {
    const loginId = String(next.login_id || '').trim();
    if (!existing || existing.login_id !== loginId) {
      if (!loginId) throw bad('아이디를 입력해 주세요.');
      if (ctx.newLoginIds.has(loginId) || (await loginIdTaken(loginId, op.id))) {
        throw bad('이미 사용 중인 로그인 아이디입니다.');
      }
      ctx.newLoginIds.add(loginId);
    }
    if (newManagerPw) {
      if (newManagerPw.length < STAFF_MIN_PASSWORD) throw bad(STAFF_PASSWORD_MESSAGE);
      next.password_hash = hashPassword(newManagerPw);
      // 관리자가 비밀번호를 새로 정해 주면, 그 계정의 예전 로그인은 모두 끊김
      if (existing) next.session_version = Number(existing.session_version || 0) + 1;
    }
    if (!next.password_hash) throw bad('비밀번호를 입력해 주세요.');
  }
  if (next && col === 'participants' && newEditPw) {
    if (newEditPw.length < 4) throw bad('수정용 비밀번호는 최소 4글자 이상이어야 합니다.');
    next.edit_password_hash = hashPassword(newEditPw);
  }
  if (next) checkSize(next, 900000);

  // 정산 재계산 대상 기록
  for (const d of [existing, next]) {
    if (!d) continue;
    if (['participants', 'church_managers', 'church_fee_overrides', 'church_payment_statuses'].includes(col) && d.church_id) {
      ctx.affectedChurches.add(String(d.church_id));
    }
    if (col === 'churches' && next) ctx.affectedChurches.add(op.id);
    if (col === 'events' && d.district_id) ctx.affectedDistrictsForRecalc.add(String(d.district_id));
  }
  return next;
}

export interface WriteResult {
  changed: { col: string; id: string; data: Doc | null }[];
}

export async function applyWrites(session: Session | null, ops: WriteOp[], editAuth?: EditAuth): Promise<WriteResult> {
  if (!Array.isArray(ops) || ops.length === 0) return { changed: [] };
  if (ops.length > 2000) throw bad('한 번에 처리할 수 있는 작업 수를 초과했습니다.');
  if (!session && ops.length > 5) throw forbidden();

  const ctx: Ctx = {
    session,
    editAuth,
    createdDistricts: new Set(),
    newLoginIds: new Set(),
    affectedChurches: new Set(),
    affectedDistrictsForRecalc: new Set(),
    pending: new Map(),
  };
  const db = adminDb();
  const writes: { col: string; id: string; data: Doc | null }[] = [];

  for (const op of ops) {
    if (op.kind === 'recalc') {
      if (!session || (session.role !== 'admin' && session.role !== 'super')) throw forbidden();
      const ch = await getDoc('churches', String(op.churchId || ''));
      if (!ch) continue;
      if (session.role === 'admin' && ch.district_id !== session.districtId) throw forbidden();
      ctx.affectedChurches.add(ch.id);
      continue;
    }
    const next = await authorizeAndBuild(op, ctx);
    if (next === 'skip') continue;
    writes.push({ col: op.col, id: op.id, data: next });
    ctx.pending.set(`${op.col}/${op.id}`, next);
  }

  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) {
      const ref = db.collection(w.col).doc(w.id);
      if (w.data === null) batch.delete(ref);
      else if (w.col === 'platform_config') batch.set(ref, w.data, { merge: true });
      else batch.set(ref, w.data);
    }
    await batch.commit();
  }

  // 행사 참가비 설정이 바뀐 지방회는 모든 교회 재계산
  for (const D of ctx.affectedDistrictsForRecalc) {
    const chs = await db.collection('churches').where('district_id', '==', D).get();
    chs.docs.forEach(c => ctx.affectedChurches.add(c.id));
  }

  const changed: WriteResult['changed'] = writes.map(w => ({
    col: w.col,
    id: w.id,
    data: w.data ? sanitize(w.col, w.data) : null,
  }));
  for (const churchId of ctx.affectedChurches) {
    if (churchId === 'temp_new_church') continue;
    const status = await recalcChurch(churchId);
    if (status) {
      const visible =
        session?.role === 'super' ||
        (session?.role === 'admin' && status.district_id === session.districtId) ||
        (session?.role === 'manager' && status.church_id === session.churchId);
      if (visible) changed.push({ col: 'church_payment_statuses', id: status.id, data: status });
    }
  }
  return { changed };
}

// ---------------------------------------------------------------------------
// 교회별 참가비 합계 재계산 (항상 DB의 최신 값을 읽어서 계산 → 동시 사용 시에도 결과가 맞춰짐)
// ---------------------------------------------------------------------------
const DEFAULT_FEES: Record<string, number> = { 학생: 20000, 교사: 0, 봉사자: 0 };

export async function recalcChurch(churchId: string): Promise<Doc | null> {
  const db = adminDb();
  const church = await getDoc('churches', churchId);
  if (!church) return null;
  const D = church.district_id;

  const [partsSnap, overridesSnap, managersSnap, eventsSnap] = await Promise.all([
    db.collection('participants').where('church_id', '==', churchId).get(),
    db.collection('church_fee_overrides').where('church_id', '==', churchId).get(),
    db.collection('church_managers').where('church_id', '==', churchId).get(),
    db.collection('events').where('district_id', '==', D).get(),
  ]);
  const activeEvent = toDocs(eventsSnap).find(e => e.is_active);
  const baseFees: Record<string, number> = activeEvent?.options?.fees || DEFAULT_FEES;
  const overrides = toDocs(overridesSnap);
  const feeFor = (type: string) => {
    const o = overrides.find(x => x.participant_type === type);
    return o ? Number(o.fee) || 0 : Number(baseFees[type]) || 0;
  };

  let total = 0;
  for (const p of toDocs(partsSnap)) total += feeFor(p.participant_type);
  const approvedManagers = toDocs(managersSnap).filter(m => m.status === 'approved').length;
  total += approvedManagers * feeFor('교사');

  return db.runTransaction(async tx => {
    const q = await tx.get(db.collection('church_payment_statuses').where('church_id', '==', churchId).limit(1));
    const now = new Date().toISOString();
    if (!q.empty) {
      const ref = q.docs[0].ref;
      const cur = { ...q.docs[0].data(), id: q.docs[0].id } as Doc;
      const upd: Doc = { total_amount: total, updated_at: now };
      if (cur.status === '납부완료' && total > (Number(cur.paid_amount) || 0)) upd.status = '확인 필요';
      tx.update(ref, upd);
      return { ...cur, ...upd };
    }
    const id = `cps-${churchId}`;
    const created: Doc = {
      id,
      district_id: D,
      event_id: activeEvent?.id || '',
      church_id: churchId,
      total_amount: total,
      status: '미납',
      updated_at: now,
    };
    tx.set(db.collection('church_payment_statuses').doc(id), created);
    return created;
  });
}

