// 브라우저용 데이터 계층.
// 예전에는 브라우저가 Firestore에 직접 읽고 썼지만, 이제는 모든 읽기/쓰기가 서버 API(/api/...)를 거칩니다.
// 서버가 로그인 쿠키로 권한을 확인한 뒤, 볼 수 있는 데이터만 내려주고 허용된 변경만 저장합니다.
// 화면 코드는 예전과 같은 함수(db.getX / db.createX ...)를 그대로 쓰도록 모양을 유지했습니다.
import {
  Event, Church, ChurchManager, Participant, SameGroupRequest,
  GroupingGroup, Group, PaymentSettings,
  ChurchFeeOverride, ChurchPaymentStatus, District, PlatformConfig
} from '../types';

const cleanData = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  const result = { ...obj } as any;
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) {
      delete result[key];
    } else if (result[key] !== null && typeof result[key] === 'object') {
      if (!Array.isArray(result[key])) {
        result[key] = cleanData(result[key]);
      }
    }
  });
  return result;
};

// 추측하기 어려운 ID 생성 (예전: Math.random 9자리)
const uuid = () => {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID().replace(/-/g, '');
  const bytes = new Uint8Array(16);
  c?.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};

// ---------------------------------------------------------------------------
// 서버 쓰기 큐: 같은 순간에 일어난 변경들을 한 번의 요청으로 묶어 순서대로 보냅니다.
// ---------------------------------------------------------------------------
type WriteOp =
  | { kind: 'set' | 'update'; col: string; id: string; data: any }
  | { kind: 'delete'; col: string; id: string }
  | { kind: 'recalc'; churchId: string };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let pendingOps: WriteOp[] = [];
let flushScheduled = false;
let sendChain: Promise<void> = Promise.resolve();
let inflight: Promise<void>[] = [];
const awaited = new WeakSet<Promise<void>>();
let editAuth: { phone: string; password: string } | null = null;

async function postJson(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* 빈 응답 */ }
  if (!res.ok || (json && json.ok === false)) {
    throw new ApiError(res.status, json?.error || '서버와 통신 중 오류가 발생했습니다.');
  }
  return json;
}

function notifyUnhandledWriteError(err: unknown) {
  if (typeof window === 'undefined') return;
  const msg = err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.';
  window.alert(`저장하지 못했습니다: ${msg}\n\n화면을 새로 불러옵니다.`);
  window.location.reload();
}

function dispatch(ops: WriteOp[]) {
  const auth = editAuth;
  const p = sendChain.then(async () => {
    const json = await postJson('/api/write', { ops, editAuth: auth || undefined });
    applyChanges(json?.changed || []);
  });
  sendChain = p.catch(() => {});
  inflight.push(p);
  p.catch(err => {
    if (!awaited.has(p)) notifyUnhandledWriteError(err);
  }).finally(() => {
    inflight = inflight.filter(x => x !== p);
  });
}

function enqueue(op: WriteOp) {
  pendingOps.push(op);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(() => {
      flushScheduled = false;
      const ops = pendingOps;
      pendingOps = [];
      if (ops.length > 0) dispatch(ops);
    });
  }
}

const qSet = (col: string, id: string, data: any) => enqueue({ kind: 'set', col, id, data: cleanData(data) });
const qUpdate = (col: string, id: string, data: any) => enqueue({ kind: 'update', col, id, data: cleanData(data) });
const qDelete = (col: string, id: string) => enqueue({ kind: 'delete', col, id });

const COLLECTION_KEYS: Record<string, keyof typeof memoryDb> = {
  districts: 'districts',
  events: 'events',
  churches: 'churches',
  church_managers: 'managers',
  participants: 'participants',
  same_group_requests: 'sameGroupRequests',
  grouping_groups: 'groupingGroups',
  groups: 'groups',
  payment_settings: 'paymentSettings',
  church_fee_overrides: 'feeOverrides',
  church_payment_statuses: 'paymentStatuses'
};

// 서버가 확정한 값(예: 서버에서 다시 계산한 정산 금액)을 메모리에 반영
function applyChanges(changed: { col: string; id: string; data: any | null }[]) {
  for (const ch of changed) {
    if (ch.col === 'events' || ch.col === 'platform_config') continue;
    const key = COLLECTION_KEYS[ch.col];
    if (!key) continue;
    const list = (memoryDb as any)[key] as any[];
    const idx = list.findIndex(x => x.id === ch.id);
    if (ch.data === null) {
      if (idx !== -1) list.splice(idx, 1);
    } else if (idx !== -1) {
      list[idx] = { ...list[idx], ...ch.data };
    } else {
      list.push(ch.data);
    }
  }
}

// 서버가 확인한 로그인 정보를 화면들이 읽는 localStorage에 맞춰 둡니다(표시용).
// 누군가 localStorage를 위조해도 서버가 데이터를 주지 않으므로 효과가 없고, 여기서 곧바로 덮어써집니다.
function mirrorSession(session: any) {
  if (typeof window === 'undefined') return;
  try {
    if (!session) {
      localStorage.removeItem('evt_session');
      localStorage.removeItem('super_session');
      return;
    }
    if (session.role === 'super') {
      localStorage.setItem('super_session', 'active');
      localStorage.removeItem('evt_session');
      return;
    }
    localStorage.removeItem('super_session');
    localStorage.setItem('evt_session', JSON.stringify({
      loginId: session.loginId,
      role: session.role,
      churchId: session.churchId,
      name: session.name,
      is_admin: session.role === 'admin',
      districtId: session.districtId,
      district_id: session.districtId,
      districtSlug: session.districtSlug,
      district_slug: session.districtSlug
    }));
  } catch {
    /* 저장소 사용 불가 환경 무시 */
  }
}

const INITIAL_PLATFORM_CONFIG: PlatformConfig = {
  id: 'config',
  support_bank_name: '신한은행',
  support_account_number: '110-111-222222',
  support_account_holder: '홍길동',
  support_intro_description: '모임터를 통해 여러 교회가 함께하는 행사를 편리하게 준비하실 수 있도록 무상으로 개방하고 있습니다. 다만 서버 유지와 서비스 품질 향상을 위하여 자율적으로 후원을 받고 있으니 협조와 기도를 부탁드립니다.',
  platform_intro_title: '교회 연합 행사를 하나의 플랫폼으로 편리하게.',
  platform_intro_description: '여름성경학교, 겨울 수련회, 세미나 등 어떤 행사든 개별 웹사이트를 따로 만들 필요 없이, 가입 신청 한 번으로 우리 지방회만의 참가 신청 및 조편성 관리 화면을 바로 만들어 드립니다.',
  updated_at: new Date().toISOString()
};

let memoryDb = {
  districts: [] as District[],
  events: [] as Event[],
  churches: [] as Church[],
  managers: [] as ChurchManager[],
  participants: [] as Participant[],
  sameGroupRequests: [] as SameGroupRequest[],
  groupingGroups: [] as GroupingGroup[],
  groups: [] as Group[],
  paymentSettings: [] as PaymentSettings[],
  feeOverrides: [] as ChurchFeeOverride[],
  paymentStatuses: [] as ChurchPaymentStatus[],
  eventOptions: {} as Record<string, any>,
  platformConfig: null as PlatformConfig | null
};

let isInitialized = false;
let currentSession: any = null;

export const apiDb = {
  async init() {
    if (isInitialized) return;

    try {
      const res = await fetch('/api/data', { credentials: 'same-origin', cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || '데이터를 불러오지 못했습니다.');
      const data = json.data || {};

      memoryDb.districts = (data.districts || []) as District[];
      memoryDb.churches = (data.churches || []) as Church[];
      memoryDb.managers = (data.church_managers || []) as ChurchManager[];
      memoryDb.participants = (data.participants || []) as Participant[];
      memoryDb.sameGroupRequests = (data.same_group_requests || []) as SameGroupRequest[];
      memoryDb.groupingGroups = (data.grouping_groups || []) as GroupingGroup[];
      memoryDb.groups = (data.groups || []) as Group[];
      memoryDb.paymentSettings = (data.payment_settings || []) as PaymentSettings[];
      memoryDb.feeOverrides = (data.church_fee_overrides || []) as ChurchFeeOverride[];
      memoryDb.paymentStatuses = (data.church_payment_statuses || []) as ChurchPaymentStatus[];

      memoryDb.eventOptions = {};
      memoryDb.events = ((data.events || []) as any[]).map(ev => {
        if (ev.options) {
          memoryDb.eventOptions[ev.id] = ev.options;
        }
        return ev as Event;
      });

      const configs = (data.platform_config || []) as PlatformConfig[];
      memoryDb.platformConfig = configs[0] ? { ...INITIAL_PLATFORM_CONFIG, ...configs[0] } : INITIAL_PLATFORM_CONFIG;

      mirrorSession(json.session);
      currentSession = json.session || null;
      isInitialized = true;
    } catch (err) {
      console.error('데이터 초기화 오류:', err);
    }
  },

  async initForce() {
    // 아직 전송 중인 저장 작업이 끝난 뒤 최신 데이터를 다시 받아옵니다.
    await this.flush().catch(() => {});
    isInitialized = false;
    await this.init();
  },

  /** 지금까지 요청한 저장 작업이 서버에 반영될 때까지 기다립니다. 실패하면 오류를 던집니다. */
  async flush(): Promise<void> {
    await new Promise<void>(resolve => queueMicrotask(resolve));
    await new Promise<void>(resolve => queueMicrotask(resolve));
    const list = [...inflight];
    list.forEach(p => awaited.add(p));
    await Promise.all(list);
  },

  getSession() {
    return currentSession;
  },

  // --- 인증 ---
  async logout(): Promise<void> {
    try { await postJson('/api/auth/logout', {}); } catch { /* 무시 */ }
    mirrorSession(null);
    currentSession = null;
    editAuth = null;
  },

  async superLogin(password: string): Promise<{ success: boolean; error?: string }> {
    try {
      await postJson('/api/auth/super-login', { password });
      await this.initForce();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || '로그인에 실패했습니다.' };
    }
  },

  /** 로그인한 본인의 비밀번호 변경 (현재 비밀번호는 서버에서 확인) */
  async changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
    await postJson('/api/account/password', { currentPassword, newPassword });
  },

  /** 학부모/개인: 이름·연락처·비밀번호로 본인 등록 정보 조회. 성공하면 이후 수정 요청에 본인 확인 정보가 함께 전송됩니다. */
  async lookupParticipant(districtId: string, name: string, phone: string, password: string): Promise<Participant | null> {
    const json = await postJson('/api/participants/lookup', { districtId, name, phone, password });
    const p = json?.participant as Participant | null;
    if (!p) return null;
    const idx = memoryDb.participants.findIndex(x => x.id === p.id);
    if (idx === -1) memoryDb.participants.push(p);
    else memoryDb.participants[idx] = p;
    editAuth = { phone, password };
    return p;
  },

  /** 행사 안내 이미지 업로드 (관리자 전용, 서버 경유) */
  async uploadEventImage(blob: Blob, eventId: string): Promise<string> {
    const form = new FormData();
    form.append('file', blob, 'image.jpg');
    form.append('eventId', eventId);
    const res = await fetch('/api/upload', { method: 'POST', credentials: 'same-origin', body: form });
    let json: any = null;
    try { json = await res.json(); } catch { /* 빈 응답 */ }
    if (!res.ok || !json?.ok) throw new ApiError(res.status, json?.error || '이미지 업로드에 실패했습니다.');
    return json.url as string;
  },

  // --- Districts ---
  getDistricts(): District[] {
    return memoryDb.districts;
  },
  getDistrictBySlug(slug: string): District | undefined {
    return memoryDb.districts.find(d => d.slug === slug);
  },
  createDistrict(d: Omit<District, 'id' | 'status' | 'created_at'>, adminId?: string, adminPw?: string, adminChurchName?: string): District {
    if (memoryDb.districts.some(item => item.slug === d.slug)) {
      throw new Error('이미 사용 중인 영문 주소(slug)입니다.');
    }

    if (adminId) {
      if (memoryDb.managers.some(m => m.login_id === adminId) || adminId === 'admin') {
        throw new Error('이미 사용 중인 로그인 아이디입니다.');
      }
    }

    const id = `dist-${uuid()}`;
    const newDist: District = {
      ...d,
      id,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    memoryDb.districts.push(newDist);
    qSet('districts', id, newDist);

    if (adminId && adminPw) {
      const managerId = `m-${uuid()}`;
      const newManager: ChurchManager = {
        id: managerId,
        district_id: newDist.id,
        church_id: '',
        name: `${d.manager_name}`,
        phone: d.phone,
        login_id: adminId,
        password_hash: adminPw,
        status: 'pending',
        is_admin: true,
        is_manager: false,
        requested_church_name: '',
        created_at: new Date().toISOString()
      };
      qSet('church_managers', managerId, newManager);
      memoryDb.managers.push({ ...newManager, password_hash: '' });
    }

    return newDist;
  },
  approveDistrict(id: string): District {
    const idx = memoryDb.districts.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('지방회를 찾을 수 없습니다.');
    memoryDb.districts[idx].status = 'approved';
    qSet('districts', id, memoryDb.districts[idx]);

    const dist = memoryDb.districts[idx];

    // 지방회 승인 시, 해당 지방회의 기본 이벤트(evt_events)도 같이 자동 생성해 준다
    this.createEventForDistrict(dist);

    // 해당 지방회 어드민 계정도 승인 완료 처리 (교회 매칭 없음)
    memoryDb.managers = memoryDb.managers.map(m => {
      if (m.district_id === id && m.church_id === '') {
        const updated = { 
          ...m, 
          status: 'approved' as const,
          church_id: '',
          is_admin: true,
          is_manager: false
        };
        qSet('church_managers', m.id, updated);
        return updated;
      }
      return m;
    });

    return dist;
  },
  rejectDistrict(id: string): District {
    const idx = memoryDb.districts.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('지방회를 찾을 수 없습니다.');
    memoryDb.districts[idx].status = 'rejected';
    qSet('districts', id, memoryDb.districts[idx]);

    // 지방회 반려 시, 해당 지방회 소속의 모든 매니저 계정도 함께 삭제 처리합니다.
    memoryDb.managers = memoryDb.managers.filter(m => {
      if (m.district_id === id) {
        qDelete('church_managers', m.id);
        return false;
      }
      return true;
    });

    return memoryDb.districts[idx];
  },

  createEventForDistrict(dist: District) {
    const eventId = `evt-${uuid()}`;
    const newEvent: Event = {
      id: eventId,
      district_id: dist.id,
      name: `${dist.name} 연합 행사`,
      description: `${dist.name} 연합 행사 참가 신청 페이지입니다.`,
      start_date: '2026-08-01',
      end_date: '2026-08-03',
      registration_start_date: '2026-06-01',
      registration_end_date: '2026-07-20',
      edit_deadline: '2026-07-25',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryDb.events.push(newEvent);

    const currentYear = new Date().getFullYear();
    const defaultBirthYears = [
      `${currentYear - 6}년`,
      `${currentYear - 5}년`,
      `${currentYear - 4}년`,
      `${currentYear - 3}년`,
      `${currentYear - 2}년`
    ];
    const defaultOptions = {
      departments: ['유아부', '유치부', '초등 1학년', '초등 2학년', '초등 3학년', '초등 4학년', '초등 5학년', '초등 6학년', '중등 1학년', '중등 2학년', '중등 3학년', '고등 1학년', '고등 2학년', '고등 3학년'],
      birthYears: defaultBirthYears,
      shirtSizes: ['110', '120', '130', '140', '150', 'XS', 'S', 'M', 'L', 'XL(LL)', '2XL(3L)', '3XL(4L)', '4XL(5L)'],
      attendanceDates: [
        { date: '2026-08-01', label: '1일차 (토)' },
        { date: '2026-08-02', label: '2일차 (일)' },
        { date: '2026-08-03', label: '3일차 (월)' }
      ],
      fees: { '학생': 20000, '교사': 0, '봉사자': 0 }
    };
    memoryDb.eventOptions[eventId] = defaultOptions;

    qSet('events', eventId, {
      ...newEvent,
      options: defaultOptions
    });
  },

  // --- Events ---
  getEvents(districtId?: string): Event[] {
    return districtId ? memoryDb.events.filter(e => e.district_id === districtId) : memoryDb.events;
  },
  getActiveEvent(districtId?: string): Event | undefined {
    return this.getEvents(districtId).find(e => e.is_active);
  },
  createEvent(event: Omit<Event, 'id' | 'created_at' | 'updated_at'> & { district_id?: string }): Event {
    const id = `evt-${uuid()}`;
    const newEvent: Event = {
      ...event,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    memoryDb.events.push(newEvent);

    const defaultOptions = {
      departments: ['유아부', '유치부', '초등 1학년', '초등 2학년', '초등 3학년', '초등 4학년', '초등 5학년', '초등 6학년', '중등 1학년', '중등 2학년', '중등 3학년', '고등 1학년', '고등 2학년', '고등 3학년'],
      birthYears: ['2018년', '2019년', '2020년', '2021년', '2022년'],
      shirtSizes: ['110', '120', '130', '140', '150', 'XS', 'S', 'M', 'L', 'XL(LL)', '2XL(3L)', '3XL(4L)', '4XL(5L)'],
      attendanceDates: [
        { date: '2026-08-01', label: '1일차 (토)' },
        { date: '2026-08-02', label: '2일차 (일)' },
        { date: '2026-08-03', label: '3일차 (월)' }
      ],
      fees: { '학생': 20000, '교사': 0, '봉사자': 0 }
    };
    memoryDb.eventOptions[id] = defaultOptions;

    qSet('events', id, {
      ...newEvent,
      options: defaultOptions
    });

    return newEvent;
  },
  updateEvent(id: string, updates: Partial<Event> & { options?: any }): Event {
    const idx = memoryDb.events.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('행사를 찾을 수 없습니다.');
    
    const { options: optionsUpdates, ...eventUpdates } = updates;
    
    const updated = { 
      ...memoryDb.events[idx], 
      ...eventUpdates, 
      updated_at: new Date().toISOString() 
    };
    memoryDb.events[idx] = updated;

    if (optionsUpdates) {
      memoryDb.eventOptions[id] = {
        ...(memoryDb.eventOptions[id] || {}),
        ...optionsUpdates
      };
    }

    const options = memoryDb.eventOptions[id] || {};
    qSet('events', id, {
      ...updated,
      options
    });

    return updated;
  },
  deleteEvent(id: string): void {
    memoryDb.events = memoryDb.events.filter(e => e.id !== id);
    delete memoryDb.eventOptions[id];
    qDelete('events', id);
  },

  getEventOptions(eventId: string) {
    const opts = memoryDb.eventOptions[eventId] || { 
      departments: [], 
      birthYears: [], 
      shirtSizes: [], 
      attendanceDates: [], 
      fees: { '학생': 20000, '교사': 0, '봉사자': 0 } 
    };

    // 기존의 예전 셔츠 사이즈(또는 비어있는 경우)가 감지되면 신규 셔츠 사이즈로 자동 교체
    const newSizes = ['110', '120', '130', '140', '150', 'XS', 'S', 'M', 'L', 'XL(LL)', '2XL(3L)', '3XL(4L)', '4XL(5L)'];
    const hasOldSizes = opts.shirtSizes.includes('XL') || opts.shirtSizes.length === 0 || !opts.shirtSizes.includes('XL(LL)');
    if (hasOldSizes) {
      opts.shirtSizes = newSizes;
    }
    return opts;
  },
  updateEventOptions(eventId: string, options: { 
    departments?: string[]; 
    birthYears?: string[]; 
    shirtSizes?: string[]; 
    attendanceDates?: { date: string; label: string }[];
    fees?: Record<string, number>;
  }) {
    const current = this.getEventOptions(eventId);
    const updated = { ...current, ...options };
    memoryDb.eventOptions[eventId] = updated;

    qUpdate('events', eventId, {
      options: updated
    });
  },

  // --- Churches ---
  getChurches(districtId?: string): Church[] {
    return districtId ? memoryDb.churches.filter(c => c.district_id === districtId) : memoryDb.churches;
  },
  createChurch(name: string, districtId?: string, memo?: string): Church {
    const id = `ch-${uuid()}`;
    const newChurch: Church = {
      id,
      district_id: districtId,
      event_id: 'evt-2026',
      name,
      memo: memo || '',
      created_at: new Date().toISOString()
    };
    memoryDb.churches.push(newChurch);
    qSet('churches', id, newChurch);

    const cpsId = `cps-${id}`;
    const newStatus: ChurchPaymentStatus = {
      id: cpsId,
      district_id: districtId,
      event_id: 'evt-2026',
      church_id: id,
      total_amount: 0,
      status: '미납',
      updated_at: new Date().toISOString()
    };
    memoryDb.paymentStatuses.push(newStatus);
    qSet('church_payment_statuses', cpsId, newStatus);

    return newChurch;
  },
  updateChurch(id: string, updates: Partial<Church>): Church {
    const idx = memoryDb.churches.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('교회를 찾을 수 없습니다.');
    const updated = { ...memoryDb.churches[idx], ...updates };
    memoryDb.churches[idx] = updated;
    qSet('churches', id, updated);
    return updated;
  },
  deleteChurch(id: string): void {
    memoryDb.churches = memoryDb.churches.filter(c => c.id !== id);
    qDelete('churches', id);
  },

  // --- Managers ---
  getManagers(districtId?: string): ChurchManager[] {
    return districtId ? memoryDb.managers.filter(m => m.district_id === districtId) : memoryDb.managers;
  },
  createManager(manager: Omit<ChurchManager, 'id' | 'status' | 'created_at'> & { district_id?: string }, autoApprove = false): ChurchManager {
    const managers = memoryDb.managers;
    if (managers.some(m => m.login_id === manager.login_id) || manager.login_id === 'admin') {
      throw new Error('이미 사용 중인 로그인 아이디입니다.');
    }

    const id = `m-${uuid()}`;
    const newManager: ChurchManager = {
      ...manager,
      id,
      status: autoApprove ? 'approved' : 'pending',
      created_at: new Date().toISOString()
    };
    qSet('church_managers', id, newManager);
    // 비밀번호는 서버로만 보내고(서버가 해시 저장) 화면 메모리에는 남기지 않습니다.
    const stored = { ...newManager, password_hash: '' };
    memoryDb.managers.push(stored);
    return stored;
  },
  updateManager(id: string, updates: Partial<ChurchManager>): ChurchManager {
    const idx = memoryDb.managers.findIndex(m => m.id === id);
    if (idx === -1) throw new Error('담당자를 찾을 수 없습니다.');
    const merged = { ...memoryDb.managers[idx], ...updates };
    // password_hash 값이 있으면 '새 비밀번호'로 간주되어 서버가 해시해 저장합니다. 비어 있으면 기존 비밀번호 유지.
    qSet('church_managers', id, merged);
    const updated = { ...merged, password_hash: '' };
    memoryDb.managers[idx] = updated;
    return updated;
  },
  deleteManager(id: string): void {
    memoryDb.managers = memoryDb.managers.filter(m => m.id !== id);
    qDelete('church_managers', id);
  },

  // --- Participants ---
  getParticipants(districtId?: string): Participant[] {
    const approvedMgrs = memoryDb.managers.filter(m => m.status === 'approved');
    for (const p of memoryDb.participants) {
      const matchedM = approvedMgrs.find(m => 
        (m.name === p.name && m.phone && p.personal_phone && m.phone === p.personal_phone) || 
        (m.name === p.name && m.church_id === p.church_id && (p.participant_type === '교사' || p.participant_type === '봉사자' || p.role === '교회담당자'))
      );
      if (matchedM) {
        const mgrGender = matchedM.gender || '여';
        if (p.gender !== mgrGender) {
          p.gender = mgrGender;
          p.updated_at = new Date().toISOString();
          if (currentSession) qSet('participants', p.id, p);
        }
      }
    }
    return districtId ? memoryDb.participants.filter(p => p.district_id === districtId) : memoryDb.participants;
  },
  getParticipantById(id: string): Participant | undefined {
    return memoryDb.participants.find(p => p.id === id);
  },
  createParticipant(participant: Omit<Participant, 'id' | 'created_at' | 'updated_at'> & { district_id?: string }): Participant {
    const id = `p-${uuid()}`;
    const newParticipant: Participant = {
      ...participant,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    qSet('participants', id, newParticipant);
    // 비밀번호 원문은 서버로만 보내고 화면 메모리에는 남기지 않습니다.
    const { edit_password: _pw, ...stored } = newParticipant;
    void _pw;
    memoryDb.participants.push(stored as Participant);
    this._recalcLocal(participant.church_id);
    return stored as Participant;
  },
  updateParticipant(id: string, updates: Partial<Participant>): Participant {
    const idx = memoryDb.participants.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('참가자를 찾을 수 없습니다.');
    const oldChurchId = memoryDb.participants[idx].church_id;
    const merged = { ...memoryDb.participants[idx], ...updates, updated_at: new Date().toISOString() };
    qSet('participants', id, merged);
    const { edit_password: _pw, ...updated } = merged;
    void _pw;
    memoryDb.participants[idx] = updated as Participant;

    this._recalcLocal(updated.church_id);
    if (oldChurchId && oldChurchId !== updated.church_id) {
      this._recalcLocal(oldChurchId);
    }
    return updated;
  },
  deleteParticipant(id: string): void {
    const participant = memoryDb.participants.find(p => p.id === id);
    if (!participant) return;

    memoryDb.participants = memoryDb.participants.filter(p => p.id !== id);
    qDelete('participants', id);
    this._recalcLocal(participant.church_id);
  },

  // --- Same Group Requests ---
  getSameGroupRequests(districtId?: string): SameGroupRequest[] {
    return districtId ? memoryDb.sameGroupRequests.filter(r => r.district_id === districtId) : memoryDb.sameGroupRequests;
  },
  createSameGroupRequest(request: Omit<SameGroupRequest, 'id' | 'status' | 'created_at'> & { district_id?: string }): SameGroupRequest {
    const id = `sgr-${uuid()}`;
    const newReq: SameGroupRequest = {
      ...request,
      id,
      status: '확인 필요',
      created_at: new Date().toISOString()
    };
    memoryDb.sameGroupRequests.push(newReq);
    qSet('same_group_requests', id, newReq);
    return newReq;
  },
  updateSameGroupRequest(id: string, updates: Partial<SameGroupRequest>): SameGroupRequest {
    const idx = memoryDb.sameGroupRequests.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('요청을 찾을 수 없습니다.');
    const updated = { ...memoryDb.sameGroupRequests[idx], ...updates };
    memoryDb.sameGroupRequests[idx] = updated;
    qSet('same_group_requests', id, updated);
    return updated;
  },
  deleteSameGroupRequest(id: string): void {
    memoryDb.sameGroupRequests = memoryDb.sameGroupRequests.filter(r => r.id !== id);
    qDelete('same_group_requests', id);
  },

  // --- Payment Settings ---
  getPaymentSettings(districtId?: string): PaymentSettings | undefined {
    return districtId ? memoryDb.paymentSettings.find(s => s.district_id === districtId) : memoryDb.paymentSettings[0];
  },
  updatePaymentSettings(updates: Partial<PaymentSettings> & { district_id?: string }): PaymentSettings {
    const districtId = updates.district_id || 'dist-1';
    let current = memoryDb.paymentSettings.find(s => s.district_id === districtId);
    if (!current) {
      current = {
        id: `pay-${uuid()}`,
        district_id: districtId,
        event_id: 'evt-2026',
        bank_name: '',
        account_number: '',
        account_holder: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      memoryDb.paymentSettings.push(current);
    }
    const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
    const idx = memoryDb.paymentSettings.findIndex(s => s.id === updated.id);
    memoryDb.paymentSettings[idx] = updated;
    qSet('payment_settings', updated.id, updated);
    return updated;
  },

  // --- Fee Overrides ---
  getFeeOverrides(districtId?: string): ChurchFeeOverride[] {
    return districtId ? memoryDb.feeOverrides.filter(o => o.district_id === districtId) : memoryDb.feeOverrides;
  },
  updateFeeOverride(churchId: string, type: '학생' | '교사' | '봉사자', fee: number, districtId?: string) {
    const overrides = memoryDb.feeOverrides;
    const idx = overrides.findIndex(o => o.church_id === churchId && o.participant_type === type);
    
    let target: ChurchFeeOverride;
    if (idx !== -1) {
      overrides[idx].fee = fee;
      target = overrides[idx];
    } else {
      target = {
        id: `fo-${uuid()}`,
        district_id: districtId || 'dist-1',
        event_id: 'evt-2026',
        church_id: churchId,
        participant_type: type,
        fee,
        created_at: new Date().toISOString()
      };
      overrides.push(target);
    }
    qSet('church_fee_overrides', target.id, target);
    this._recalcLocal(churchId);
  },

  // --- Church Payment Statuses ---
  getChurchPaymentStatuses(districtId?: string): ChurchPaymentStatus[] {
    return districtId ? memoryDb.paymentStatuses.filter(s => s.district_id === districtId) : memoryDb.paymentStatuses;
  },
  updateChurchPaymentStatus(churchId: string, status: '미납' | '확인 필요' | '납부완료', memo?: string, districtId?: string, paidAmount?: number) {
    const idx = memoryDb.paymentStatuses.findIndex(s => s.church_id === churchId);
    const now = new Date().toISOString();
    
    let target: ChurchPaymentStatus;
    if (idx !== -1) {
      memoryDb.paymentStatuses[idx].status = status;
      if (memo !== undefined) memoryDb.paymentStatuses[idx].memo = memo;
      if (paidAmount !== undefined) {
        memoryDb.paymentStatuses[idx].paid_amount = paidAmount;
      } else if (status === '납부완료') {
        memoryDb.paymentStatuses[idx].paid_amount = memoryDb.paymentStatuses[idx].total_amount;
      }
      if (status === '납부완료') {
        memoryDb.paymentStatuses[idx].confirmed_at = now;
      }
      memoryDb.paymentStatuses[idx].updated_at = now;
      target = memoryDb.paymentStatuses[idx];
    } else {
      const initPaidAmount = paidAmount !== undefined ? paidAmount : 0;
      target = {
        id: `cps-${churchId}`,
        district_id: districtId || 'dist-1',
        event_id: 'evt-2026',
        church_id: churchId,
        total_amount: 0,
        paid_amount: status === '납부완료' ? 0 : initPaidAmount,
        status,
        memo,
        confirmed_at: status === '납부완료' ? now : undefined,
        updated_at: now
      };
      memoryDb.paymentStatuses.push(target);
    }
    qSet('church_payment_statuses', target.id, target);
    this._recalcLocal(churchId);
  },

  // --- Recalculate Total Payment ---
  /** 관리자: 서버에 해당 교회 정산 재계산을 요청 */
  recalculatePayment(churchId: string) {
    this._recalcLocal(churchId);
    enqueue({ kind: 'recalc', churchId });
  },

  // 화면 즉시 반영용 로컬 계산 (실제 금액은 서버가 저장 후 다시 계산해 돌려줍니다)
  _recalcLocal(churchId: string) {
    const participants = memoryDb.participants.filter(p => p.church_id === churchId);
    const overrides = memoryDb.feeOverrides.filter(o => o.church_id === churchId);
    
    // 교회의 소속 지방회 ID를 통해 올바른 지방회 행사의 요금표를 가져옴
    const church = memoryDb.churches.find(c => c.id === churchId);
    const activeEvent = this.getActiveEvent(church?.district_id);
    const eventId = activeEvent?.id || 'evt-2026';
    const baseFees = this.getEventOptions(eventId).fees;

    let total = 0;
    participants.forEach(p => {
      const override = overrides.find(o => o.participant_type === p.participant_type);
      if (override) {
        total += override.fee;
      } else {
        total += baseFees[p.participant_type] || 0;
      }
    });

    // 해당 교회의 승인된 담당자(들)의 수만큼 교사 요금으로 가산합니다.
    const approvedManagersCount = memoryDb.managers.filter(m => m.church_id === churchId && m.status === 'approved').length;
    const teacherFeeOverride = overrides.find(o => o.participant_type === '교사');
    const teacherFee = teacherFeeOverride ? teacherFeeOverride.fee : (baseFees['교사'] || 0);
    total += approvedManagersCount * teacherFee;

    let idx = memoryDb.paymentStatuses.findIndex(s => s.church_id === churchId);
    if (idx !== -1) {
      const oldStatus = memoryDb.paymentStatuses[idx].status;
      const oldPaidAmount = memoryDb.paymentStatuses[idx].paid_amount || 0;
      
      memoryDb.paymentStatuses[idx].total_amount = total;
      
      // 납부완료 상태에서 추가 등록자가 생겨 총액이 실 납부액보다 커진 경우
      if (oldStatus === '납부완료' && total > oldPaidAmount) {
        memoryDb.paymentStatuses[idx].status = '확인 필요';
      }
      
      memoryDb.paymentStatuses[idx].updated_at = new Date().toISOString();
    } else {
      // 정산 레코드가 없으면 화면용으로 만들어 둔다 (서버도 같은 ID로 생성)
      const newCpsId = `cps-${churchId}`;
      const newCps: ChurchPaymentStatus = {
        id: newCpsId,
        district_id: church?.district_id || 'dist-1',
        event_id: eventId,
        church_id: churchId,
        total_amount: total,
        status: '미납',
        updated_at: new Date().toISOString()
      };
      memoryDb.paymentStatuses.push(newCps);
    }
  },

  // --- Grouping ---
  getGroupingGroups(districtId?: string): GroupingGroup[] {
    return districtId ? memoryDb.groupingGroups.filter(g => g.district_id === districtId) : memoryDb.groupingGroups;
  },
  createGroupingGroup(g: Omit<GroupingGroup, 'id' | 'created_at'> & { district_id?: string }): GroupingGroup {
    const id = `gg-${uuid()}`;
    const newGroup: GroupingGroup = {
      ...g,
      id,
      created_at: new Date().toISOString()
    };
    memoryDb.groupingGroups.push(newGroup);
    qSet('grouping_groups', id, newGroup);
    return newGroup;
  },
  async deleteGroupingGroup(id: string): Promise<void> {
    // 1. 메모리에서 삭제할 대상 수집 및 즉시 반영 (Optimistic UI / Local-first)
    const groups = memoryDb.groups.filter(g => g.grouping_group_id === id);
    const groupIds = groups.map(g => g.id);
    const affectedParticipants = memoryDb.participants.filter(
      p => p.assigned_group_id && groupIds.includes(p.assigned_group_id)
    );

    memoryDb.groupingGroups = memoryDb.groupingGroups.filter(g => g.id !== id);
    memoryDb.groups = memoryDb.groups.filter(g => g.grouping_group_id !== id);
    affectedParticipants.forEach(p => {
      p.assigned_group_id = null;
    });

    // 2. 서버에 한 번에 반영
    qDelete('grouping_groups', id);
    groupIds.forEach(gid => qDelete('groups', gid));
    affectedParticipants.forEach(p => qUpdate('participants', p.id, { assigned_group_id: null }));
    await this.flush();
  },

  getGroups(districtId?: string): Group[] {
    const list = districtId ? memoryDb.groups.filter(g => g.district_id === districtId) : memoryDb.groups;
    return [...list].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, 'ko', { numeric: true }));
  },
  getGroupsByGroupingId(ggId: string): Group[] {
    return memoryDb.groups.filter(g => g.grouping_group_id === ggId).sort((a,b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name, 'ko', { numeric: true }));
  },
  createGroup(g: Omit<Group, 'id' | 'created_at'> & { district_id?: string }): Group {
    const id = `g-${uuid()}`;
    const newGroup: Group = {
      ...g,
      id,
      created_at: new Date().toISOString()
    };
    memoryDb.groups.push(newGroup);
    qSet('groups', id, newGroup);
    return newGroup;
  },
  updateGroup(id: string, updates: Partial<Group>): Group {
    const idx = memoryDb.groups.findIndex(g => g.id === id);
    if (idx === -1) throw new Error('조를 찾을 수 없습니다.');
    const updated = { ...memoryDb.groups[idx], ...updates };
    memoryDb.groups[idx] = updated;
    qSet('groups', id, updated);
    return updated;
  },
  deleteGroup(id: string): void {
    memoryDb.groups = memoryDb.groups.filter(g => g.id !== id);
    qDelete('groups', id);

    memoryDb.participants.forEach(p => {
      if (p.assigned_group_id === id) {
        p.assigned_group_id = null;
        qUpdate('participants', p.id, { assigned_group_id: null });
      }
    });
  },

  assignParticipantToGroup(participantId: string, groupId: string | null) {
    const pIdx = memoryDb.participants.findIndex(p => p.id === participantId);
    if (pIdx === -1) return;

    memoryDb.participants[pIdx].assigned_group_id = groupId;
    qUpdate('participants', participantId, { assigned_group_id: groupId });
  },

  /** 지방회 관리자 / 교회 담당자 로그인 (비밀번호 확인은 서버에서) */
  async login(loginId: string, password: string, districtSlug: string): Promise<{ success: boolean; role?: string; churchId?: string; name?: string; error?: string }> {
    try {
      const json = await postJson('/api/auth/login', { loginId, password, districtSlug });
      await this.initForce();
      return { success: true, role: json.role, churchId: json.churchId, name: json.name };
    } catch (err: any) {
      return { success: false, error: err?.message || '로그인에 실패했습니다.' };
    }
  },

  async purgeDistrictData(districtId: string): Promise<void> {
    // 1. 메모리 DB 즉시 갱신 (반응성 향상)
    const participantsToDelete = memoryDb.participants.filter(p => p.district_id === districtId);
    memoryDb.participants = memoryDb.participants.filter(p => p.district_id !== districtId);

    const requestsToDelete = memoryDb.sameGroupRequests.filter(r => r.district_id === districtId);
    memoryDb.sameGroupRequests = memoryDb.sameGroupRequests.filter(r => r.district_id !== districtId);

    const groupingToDelete = memoryDb.groupingGroups.filter(gg => gg.district_id === districtId);
    memoryDb.groupingGroups = memoryDb.groupingGroups.filter(gg => gg.district_id !== districtId);

    const groupsToDelete = memoryDb.groups.filter(g => g.district_id === districtId);
    memoryDb.groups = memoryDb.groups.filter(g => g.district_id !== districtId);

    const paymentsToDelete = memoryDb.paymentStatuses.filter(s => s.district_id === districtId);
    memoryDb.paymentStatuses = memoryDb.paymentStatuses.filter(s => s.district_id !== districtId);

    const overridesToDelete = memoryDb.feeOverrides.filter(o => o.district_id === districtId);
    memoryDb.feeOverrides = memoryDb.feeOverrides.filter(o => o.district_id !== districtId);

    const churchesToDelete = memoryDb.churches.filter(c => c.district_id === districtId);
    memoryDb.churches = memoryDb.churches.filter(c => c.district_id !== districtId);

    const managersToDelete = memoryDb.managers.filter(m => m.district_id === districtId);
    memoryDb.managers = memoryDb.managers.filter(m => m.district_id !== districtId);

    // 이벤트 비활성화
    memoryDb.events = memoryDb.events.map(e => {
      if (e.district_id === districtId) {
        return { ...e, is_active: false };
      }
      return e;
    });

    // 2. 서버에 일괄 삭제 요청
    participantsToDelete.forEach(p => qDelete('participants', p.id));
    requestsToDelete.forEach(r => qDelete('same_group_requests', r.id));
    groupingToDelete.forEach(gg => qDelete('grouping_groups', gg.id));
    groupsToDelete.forEach(g => qDelete('groups', g.id));
    paymentsToDelete.forEach(ps => qDelete('church_payment_statuses', ps.id));
    overridesToDelete.forEach(o => qDelete('church_fee_overrides', o.id));
    churchesToDelete.forEach(c => qDelete('churches', c.id));
    managersToDelete.forEach(m => qDelete('church_managers', m.id));
    memoryDb.events.filter(e => e.district_id === districtId).forEach(e => qUpdate('events', e.id, { is_active: false }));
    await this.flush();
  },

  async deleteDistrictComplete(districtId: string): Promise<void> {
    // 1. 먼저 하위 데이터 퍼지 수행 (참가자, 조편성, 교회, 매니저 일괄 삭제)
    await this.purgeDistrictData(districtId);

    // 2. 메모리 DB 갱신
    const eventsToDelete = memoryDb.events.filter(e => e.district_id === districtId);
    memoryDb.events = memoryDb.events.filter(e => e.district_id !== districtId);
    memoryDb.districts = memoryDb.districts.filter(d => d.id !== districtId);

    // 3. 서버에서 완전 제거
    eventsToDelete.forEach(e => qDelete('events', e.id));
    qDelete('districts', districtId);
    await this.flush();
  },

  getPlatformConfig(): PlatformConfig {
    if (!memoryDb.platformConfig) {
      memoryDb.platformConfig = INITIAL_PLATFORM_CONFIG;
    }
    return memoryDb.platformConfig;
  },
  async updatePlatformConfig(updates: Partial<PlatformConfig>): Promise<PlatformConfig> {
    const { super_admin_password: _ignored, ...rest } = updates;
    void _ignored;
    const current = this.getPlatformConfig();
    const updated = {
      ...current,
      ...rest,
      updated_at: new Date().toISOString()
    };
    memoryDb.platformConfig = updated;
    qSet('platform_config', updated.id, updated);
    await this.flush();
    return updated;
  }
};
