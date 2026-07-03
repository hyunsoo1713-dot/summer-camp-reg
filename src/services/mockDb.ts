import { 
  District, Event, Church, ChurchManager, Participant, SameGroupRequest, 
  GroupingGroup, Group, GroupMember, PaymentSettings, 
  ChurchFeeOverride, ChurchPaymentStatus, PlatformConfig 
} from '../types';

// Helper to generate UUID-like string
const uuid = () => Math.random().toString(36).substring(2, 11);

const INITIAL_PLATFORM_CONFIG: PlatformConfig = {
  id: 'config',
  support_bank_name: '신한은행',
  support_account_number: '110-111-222222',
  support_account_holder: '홍길동',
  support_intro_description: '성경학교를 성공적으로 돕기 위해 본 연합 등록 플랫폼은 모두 무상으로 이용하실 수 있도록 개방되어 있습니다. 다만 서버 유지와 서비스 품질 향상을 위하여 자율적으로 후원을 기부받고 있으니 협조와 기도를 부탁드립니다.',
  platform_intro_title: '전국 지방회 연합 성경학교를 하나의 플랫폼으로 편리하게.',
  platform_intro_description: '개별 웹사이트를 따로 제작할 필요 없이, 가입 신청 한 번으로 우리 지방회 연합 성경학교만의 독자적인 참가자 수집 및 조편성 관리 화면을 즉시 생성해 드립니다.',
  updated_at: new Date().toISOString()
};

const INITIAL_DISTRICTS: District[] = [
  {
    id: 'dist-1',
    name: '일산서지방 연합회',
    slug: 'ilsanseo',
    manager_name: '김일산 목사',
    phone: '010-1111-2222',
    status: 'approved',
    created_at: new Date().toISOString()
  },
  {
    id: 'dist-2',
    name: '화성동지방 연합회',
    slug: 'hwaseong',
    manager_name: '박화성 목사',
    phone: '010-2222-3333',
    status: 'approved',
    created_at: new Date().toISOString()
  }
];

const INITIAL_EVENTS: Event[] = [
  {
    id: 'evt-2026',
    district_id: 'dist-1',
    name: '2026 연합 여름성경학교',
    description: '어린이들을 위한 연합 여름성경학교에 초대합니다! 말씀과 찬양, 그리고 다양한 신체 활동이 준비되어 있습니다.',
    start_date: '2026-08-01',
    end_date: '2026-08-03',
    registration_start_date: '2026-06-01',
    registration_end_date: '2026-07-20',
    edit_deadline: '2026-07-25',
    is_active: true,
    notice_image_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
    location: '연합회 대강당',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const INITIAL_CHURCHES: Church[] = [
  { id: 'ch-1', district_id: 'dist-1', event_id: 'evt-2026', name: '예수인교회', memo: '서울 마포구', created_at: new Date().toISOString() },
  { id: 'ch-2', district_id: 'dist-1', event_id: 'evt-2026', name: '사랑교회', memo: '경기 성남시', created_at: new Date().toISOString() },
  { id: 'ch-3', district_id: 'dist-1', event_id: 'evt-2026', name: '은혜교회', memo: '인천 부평구', created_at: new Date().toISOString() }
];

const INITIAL_MANAGERS: ChurchManager[] = [
  {
    id: 'm-1',
    district_id: 'dist-1',
    church_id: 'ch-1',
    name: '김예수',
    phone: '010-1111-2222',
    login_id: 'jesus',
    password_hash: 'jesus123', // 단순 텍스트 비교 (Mock)
    status: 'approved',
    is_admin: false,
    is_manager: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'm-2',
    district_id: 'dist-1',
    church_id: 'ch-2',
    name: '박사랑',
    phone: '010-2222-3333',
    login_id: 'love',
    password_hash: 'love123',
    status: 'approved',
    is_admin: false,
    is_manager: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'm-3',
    district_id: 'dist-1',
    church_id: 'ch-3',
    name: '최은혜',
    phone: '010-3333-4444',
    login_id: 'grace',
    password_hash: 'grace123',
    status: 'approved',
    is_admin: false,
    is_manager: true,
    created_at: new Date().toISOString()
  }
];

// 조편성 테스트를 위해 15명 이상의 더미 참가자를 생성합니다.
const INITIAL_PARTICIPANTS: Participant[] = [
  // ch-1: 예수인교회 학생들
  {
    id: 'p-1', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-1', participant_type: '학생',
    name: '김하준', gender: '남', department: '초등 3학년', shirt_size: 'M',
    guardian_name: '김철수', guardian_phone: '010-5555-5555',
    photo_consent: true, attendance_schedule: ['2026-08-01', '2026-08-02', '2026-08-03'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'p-2', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-1', participant_type: '학생',
    name: '이서윤', gender: '여', department: '초등 3학년', shirt_size: 'S',
    guardian_name: '이영희', guardian_phone: '010-6666-6666',
    photo_consent: true, attendance_schedule: ['2026-08-01', '2026-08-02', '2026-08-03'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'p-3', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-1', participant_type: '학생',
    name: '박도윤', gender: '남', department: '초등 4학년', shirt_size: 'L',
    guardian_name: '박영수', guardian_phone: '010-7777-7777',
    photo_consent: true, attendance_schedule: ['2026-08-01', '2026-08-02'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'p-4', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-1', participant_type: '교사',
    name: '정교사', gender: '여', role: '초등부 담임', shirt_size: 'XL',
    personal_phone: '010-8888-8888',
    photo_consent: true, attendance_schedule: ['2026-08-01', '2026-08-02', '2026-08-03'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },

  // ch-2: 사랑교회 학생들
  {
    id: 'p-5', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-2', participant_type: '학생',
    name: '최민준', gender: '남', department: '초등 3학년', shirt_size: 'M',
    guardian_name: '최민수', guardian_phone: '010-9999-9999',
    photo_consent: true, attendance_schedule: ['2026-08-01', '2026-08-02', '2026-08-03'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'p-6', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-2', participant_type: '학생',
    name: '정지우', gender: '여', department: '초등 4학년', shirt_size: 'M',
    guardian_name: '정미선', guardian_phone: '010-1010-1010',
    photo_consent: false, attendance_schedule: ['2026-08-01', '2026-08-02', '2026-08-03'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'p-7', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-2', participant_type: '학생',
    name: '한우진', gender: '남', department: '초등 3학년', shirt_size: 'S',
    guardian_name: '한정훈', guardian_phone: '010-2020-2020',
    photo_consent: true, attendance_schedule: ['2026-08-02', '2026-08-03'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'p-8', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-2', participant_type: '교사',
    name: '이사랑', gender: '남', role: '부장교사', shirt_size: '2XL',
    personal_phone: '010-3030-3030',
    photo_consent: true, attendance_schedule: ['2026-08-01', '2026-08-02', '2026-08-03'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },

  // ch-3: 은혜교회 학생들
  {
    id: 'p-9', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-3', participant_type: '학생',
    name: '강윤아', gender: '여', department: '초등 3학년', shirt_size: 'S',
    guardian_name: '강지석', guardian_phone: '010-4040-4040',
    photo_consent: true, attendance_schedule: ['2026-08-01', '2026-08-02', '2026-08-03'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'p-10', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-3', participant_type: '학생',
    name: '윤준서', gender: '남', department: '초등 4학년', shirt_size: 'M',
    guardian_name: '윤태수', guardian_phone: '010-5050-5050',
    photo_consent: true, attendance_schedule: ['2026-08-01', '2026-08-03'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'p-11', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-3', participant_type: '학생',
    name: '조은서', gender: '여', department: '초등 4학년', shirt_size: 'M',
    guardian_name: '조영호', guardian_phone: '010-6060-6060',
    photo_consent: true, attendance_schedule: ['2026-08-01', '2026-08-02', '2026-08-03'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'p-12', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-3', participant_type: '교사',
    name: '김은혜', gender: '여', role: '음악교사', shirt_size: 'L',
    personal_phone: '010-7070-7070',
    photo_consent: true, attendance_schedule: ['2026-08-01', '2026-08-02', '2026-08-03'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },

  // 유치부 학생들 (출생년도 선택지 테스트용)
  {
    id: 'p-13', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-1', participant_type: '학생',
    name: '김아기', gender: '남', department: '유아부', birth_year: '2022년', shirt_size: 'XS',
    guardian_name: '김철수', guardian_phone: '010-5555-5555',
    photo_consent: true, attendance_schedule: ['2026-08-01', '2026-08-02'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  },
  {
    id: 'p-14', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-2', participant_type: '학생',
    name: '이유치', gender: '여', department: '유치부', birth_year: '2020년', shirt_size: 'S',
    guardian_name: '이영희', guardian_phone: '010-6666-6666',
    photo_consent: true, attendance_schedule: ['2026-08-01', '2026-08-02', '2026-08-03'],
    edit_password_hash: '1234', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }
];

const INITIAL_PAYMENT_SETTINGS: PaymentSettings[] = [
  {
    id: 'pay-1',
    district_id: 'dist-1',
    event_id: 'evt-2026',
    bank_name: '신한은행',
    account_number: '110-123-456789',
    account_holder: '초등부연합본부',
    memo: '반드시 교회 이름으로 입금해 주세요. (예: 예수인교회)',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const INITIAL_CHURCH_PAYMENT_STATUSES: ChurchPaymentStatus[] = [
  { id: 'cps-1', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-1', total_amount: 60000, status: '미납', updated_at: new Date().toISOString() },
  { id: 'cps-2', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-2', total_amount: 60000, status: '확인 필요', memo: '7/10 입금 완료했다고 연락 옴', updated_at: new Date().toISOString() },
  { id: 'cps-3', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-3', total_amount: 60000, status: '납부완료', confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }
];

const INITIAL_FEE_OVERRIDES: ChurchFeeOverride[] = [
  // 은혜교회(ch-3)는 특별 할인을 적용하여 학생 참가비를 15,000원으로 설정 (원래 20,000원)
  { id: 'fo-1', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-3', participant_type: '학생', fee: 15000, created_at: new Date().toISOString() }
];

const INITIAL_SAME_GROUP_REQUESTS: SameGroupRequest[] = [
  {
    id: 'sgr-1',
    district_id: 'dist-1',
    event_id: 'evt-2026',
    church_id: 'ch-1',
    participant_id: 'p-1', // 김하준
    participant_name: '김하준',
    requested_participant_name: '이서윤', // 이서윤과 같은 조 요청
    reason: '두 아동이 같은 교회 친구이며 낯을 많이 가립니다.',
    requested_by: '김예수',
    status: '확인 필요',
    created_at: new Date().toISOString()
  }
];

// Helper to check browser environment
const getStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

export const mockDb = {
  init() {
    const storage = getStorage();
    if (!storage) return;

    if (!storage.getItem('evt_districts')) {
      storage.setItem('evt_districts', JSON.stringify(INITIAL_DISTRICTS));
    }

    if (!storage.getItem('evt_events')) {
      storage.setItem('evt_events', JSON.stringify(INITIAL_EVENTS));
      storage.setItem('evt_churches', JSON.stringify(INITIAL_CHURCHES));
      storage.setItem('evt_managers', JSON.stringify(INITIAL_MANAGERS));
      storage.setItem('evt_participants', JSON.stringify(INITIAL_PARTICIPANTS));
      storage.setItem('evt_payment_settings', JSON.stringify(INITIAL_PAYMENT_SETTINGS));
      storage.setItem('evt_payment_statuses', JSON.stringify(INITIAL_CHURCH_PAYMENT_STATUSES));
      storage.setItem('evt_fee_overrides', JSON.stringify(INITIAL_FEE_OVERRIDES));
      storage.setItem('evt_same_group_requests', JSON.stringify(INITIAL_SAME_GROUP_REQUESTS));
      storage.setItem('evt_grouping_groups', JSON.stringify([]));
      storage.setItem('evt_groups', JSON.stringify([]));
      storage.setItem('evt_group_members', JSON.stringify([]));

      // 추가 메타 정보 설정 (행사별 옵션 기본값)
      storage.setItem('evt_opt_departments_evt-2026', JSON.stringify(['유아부', '유치부', '초등 1학년', '초등 2학년', '초등 3학년', '초등 4학년', '초등 5학년', '초등 6학년', '중등 1학년', '중등 2학년', '중등 3학년', '고등 1학년', '고등 2학년', '고등 3학년']));
      storage.setItem('evt_opt_birth_years_evt-2026', JSON.stringify(['2018년', '2019년', '2020년', '2021년', '2022년']));
      storage.setItem('evt_opt_shirt_sizes_evt-2026', JSON.stringify(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']));
      storage.setItem('evt_opt_attendance_dates_evt-2026', JSON.stringify([
        { date: '2026-08-01', label: '1일차 (토)' },
        { date: '2026-08-02', label: '2일차 (일)' },
        { date: '2026-08-03', label: '3일차 (월)' }
      ]));
      storage.setItem('evt_opt_fees_evt-2026', JSON.stringify({
        '학생': 20000,
        '교사': 0,
        '봉사자': 0
      }));
    }
  },
  async initForce() {
    return Promise.resolve();
  },

  getData<T>(key: string): T[] {
    this.init();
    const storage = getStorage();
    if (!storage) return [];
    const data = storage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  setData<T>(key: string, data: T[]): void {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(key, JSON.stringify(data));
  },

  // --- Districts ---
  getDistricts(): District[] {
    return this.getData<District>('evt_districts');
  },
  getDistrictBySlug(slug: string): District | undefined {
    return this.getDistricts().find(d => d.slug === slug);
  },
  createDistrict(d: Omit<District, 'id' | 'status' | 'created_at'>, adminId?: string, adminPw?: string, adminChurchName?: string): District {
    const list = this.getDistricts();
    if (list.some(item => item.slug === d.slug)) {
      throw new Error('이미 사용 중인 영문 주소(slug)입니다.');
    }

    if (adminId) {
      const managers = this.getManagers();
      if (managers.some(m => m.login_id === adminId) || adminId === 'admin') {
        throw new Error('이미 사용 중인 로그인 아이디입니다.');
      }
    }

    const newDist: District = {
      ...d,
      id: `dist-${uuid()}`,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    list.push(newDist);
    this.setData('evt_districts', list);

    if (adminId && adminPw) {
      const managers = this.getData<ChurchManager>('evt_managers');
      const newManager: ChurchManager = {
        id: `m-${uuid()}`,
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
      managers.push(newManager);
      this.setData('evt_managers', managers);
    }

    return newDist;
  },
  approveDistrict(id: string): District {
    const list = this.getDistricts();
    const idx = list.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('지방회를 찾을 수 없습니다.');
    list[idx].status = 'approved';
    this.setData('evt_districts', list);

    const dist = list[idx];

    // 지방회 승인 시, 해당 지방회의 기본 이벤트(evt_events)도 같이 자동 생성해 준다
    const event = this.createEventForDistrict(dist);

    // 해당 지방회 어드민 계정도 승인 완료 처리 (교회 매칭 없음)
    const managers = this.getData<ChurchManager>('evt_managers');
    let updatedManagers = false;
    const updatedList = managers.map(m => {
      if (m.district_id === id && m.church_id === '') {
        updatedManagers = true;
        return { 
          ...m, 
          status: 'approved' as const,
          church_id: '',
          is_admin: true,
          is_manager: false
        };
      }
      return m;
    });
    if (updatedManagers) {
      this.setData('evt_managers', updatedList);
    }

    return dist;
  },
  rejectDistrict(id: string): District {
    const list = this.getDistricts();
    const idx = list.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('지방회를 찾을 수 없습니다.');
    list[idx].status = 'rejected';
    this.setData('evt_districts', list);
    return list[idx];
  },

  // 지방회용 기본 이벤트 자동 생성 헬퍼
  createEventForDistrict(dist: District) {
    const events = this.getData<Event>('evt_events');
    const eventId = `evt-${uuid()}`;
    const newEvent: Event = {
      id: eventId,
      district_id: dist.id,
      name: `${dist.name} 여름성경학교`,
      description: `${dist.name} 어린이들을 위한 연합 성경학교 페이지입니다.`,
      start_date: '2026-08-01',
      end_date: '2026-08-03',
      registration_start_date: '2026-06-01',
      registration_end_date: '2026-07-20',
      edit_deadline: '2026-07-25',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    events.push(newEvent);
    this.setData('evt_events', events);

    // 기본 옵션 로컬스토리지 세팅
    const storage = getStorage();
    if (storage) {
      storage.setItem(`evt_opt_departments_${eventId}`, JSON.stringify(['유아부', '유치부', '초등 1학년', '초등 2학년', '초등 3학년', '초등 4학년', '초등 5학년', '초등 6학년', '중등부', '고등부']));
      const currentYear = new Date().getFullYear();
      const defaultBirthYears = [
        `${currentYear - 6}년`,
        `${currentYear - 5}년`,
        `${currentYear - 4}년`,
        `${currentYear - 3}년`,
        `${currentYear - 2}년`
      ];
      storage.setItem(`evt_opt_birth_years_${eventId}`, JSON.stringify(defaultBirthYears));
      storage.setItem(`evt_opt_shirt_sizes_${eventId}`, JSON.stringify(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']));
      storage.setItem(`evt_opt_attendance_dates_${eventId}`, JSON.stringify([
        { date: '2026-08-01', label: '1일차 (토)' },
        { date: '2026-08-02', label: '2일차 (일)' },
        { date: '2026-08-03', label: '3일차 (월)' }
      ]));
      storage.setItem(`evt_opt_fees_${eventId}`, JSON.stringify({
        '학생': 20000,
        '교사': 0,
        '봉사자': 0
      }));
    }
  },

  // --- Events ---
  getEvents(districtId?: string): Event[] {
    const list = this.getData<Event>('evt_events');
    return districtId ? list.filter(e => e.district_id === districtId) : list;
  },
  getActiveEvent(districtId?: string): Event | undefined {
    return this.getEvents(districtId).find(e => e.is_active);
  },
  createEvent(event: Omit<Event, 'id' | 'created_at' | 'updated_at'> & { district_id?: string }): Event {
    const events = this.getData<Event>('evt_events');
    const newEvent: Event = {
      ...event,
      id: `evt-${uuid()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    events.push(newEvent);
    this.setData('evt_events', events);
    return newEvent;
  },
  updateEvent(id: string, updates: Partial<Event> & { options?: any }): Event {
    const { options, ...eventUpdates } = updates;
    const events = this.getData<Event>('evt_events');
    const index = events.findIndex(e => e.id === id);
    if (index === -1) throw new Error('행사를 찾을 수 없습니다.');
    const updated = { ...events[index], ...eventUpdates, updated_at: new Date().toISOString() };
    events[index] = updated;
    this.setData('evt_events', events);

    if (options) {
      this.updateEventOptions(id, options);
    }

    return updated;
  },
  deleteEvent(id: string): void {
    const events = this.getData<Event>('evt_events').filter(e => e.id !== id);
    this.setData('evt_events', events);
  },

  // --- Event Options Configs ---
  getEventOptions(eventId: string) {
    const storage = getStorage();
    if (!storage) return { departments: [], birthYears: [], shirtSizes: [], attendanceDates: [], fees: {} };
    
    const deps = storage.getItem(`evt_opt_departments_${eventId}`);
    const years = storage.getItem(`evt_opt_birth_years_${eventId}`);
    const sizes = storage.getItem(`evt_opt_shirt_sizes_${eventId}`);
    const dates = storage.getItem(`evt_opt_attendance_dates_${eventId}`);
    const fees = storage.getItem(`evt_opt_fees_${eventId}`);

    const parsedSizes = sizes ? JSON.parse(sizes) : [];
    const newSizes = ['110', '120', '130', '140', '150', 'XS', 'S', 'M', 'L', 'XL(LL)', '2XL(3L)', '3XL(4L)', '4XL(5L)'];
    const hasOldSizes = parsedSizes.includes('XL') || parsedSizes.length === 0 || !parsedSizes.includes('XL(LL)');
    const finalSizes = hasOldSizes ? newSizes : parsedSizes;

    // 만약 예전 사이즈 규격이었으면 로컬 스토리지 데이터도 함께 갱신해줍니다.
    if (hasOldSizes) {
      storage.setItem(`evt_opt_shirt_sizes_${eventId}`, JSON.stringify(newSizes));
    }

    return {
      departments: deps ? JSON.parse(deps) : [],
      birthYears: years ? JSON.parse(years) : [],
      shirtSizes: finalSizes,
      attendanceDates: dates ? JSON.parse(dates) : [],
      fees: fees ? JSON.parse(fees) : { '학생': 20000, '교사': 0, '봉사자': 0 }
    };
  },
  updateEventOptions(eventId: string, options: { 
    departments?: string[]; 
    birthYears?: string[]; 
    shirtSizes?: string[]; 
    attendanceDates?: { date: string; label: string }[];
    fees?: Record<string, number>;
  }) {
    const storage = getStorage();
    if (!storage) return;

    if (options.departments) storage.setItem(`evt_opt_departments_${eventId}`, JSON.stringify(options.departments));
    if (options.birthYears) storage.setItem(`evt_opt_birth_years_${eventId}`, JSON.stringify(options.birthYears));
    if (options.shirtSizes) storage.setItem(`evt_opt_shirt_sizes_${eventId}`, JSON.stringify(options.shirtSizes));
    if (options.attendanceDates) storage.setItem(`evt_opt_attendance_dates_${eventId}`, JSON.stringify(options.attendanceDates));
    if (options.fees) storage.setItem(`evt_opt_fees_${eventId}`, JSON.stringify(options.fees));
  },

  // --- Churches ---
  getChurches(districtId?: string): Church[] {
    const list = this.getData<Church>('evt_churches');
    return districtId ? list.filter(c => c.district_id === districtId) : list;
  },
  createChurch(name: string, districtId?: string, memo?: string): Church {
    const churches = this.getData<Church>('evt_churches');
    const newChurch: Church = {
      id: `ch-${uuid()}`,
      district_id: districtId,
      event_id: 'evt-2026',
      name,
      memo: memo || '',
      created_at: new Date().toISOString()
    };
    churches.push(newChurch);
    this.setData('evt_churches', churches);

    const statuses = this.getChurchPaymentStatuses();
    statuses.push({
      id: `cps-${uuid()}`,
      district_id: districtId,
      event_id: 'evt-2026',
      church_id: newChurch.id,
      total_amount: 0,
      status: '미납',
      updated_at: new Date().toISOString()
    });
    this.setData('evt_payment_statuses', statuses);

    return newChurch;
  },
  updateChurch(id: string, updates: Partial<Church>): Church {
    const churches = this.getData<Church>('evt_churches');
    const index = churches.findIndex(c => c.id === id);
    if (index === -1) throw new Error('교회를 찾을 수 없습니다.');
    const updated = { ...churches[index], ...updates };
    churches[index] = updated;
    this.setData('evt_churches', churches);
    return updated;
  },
  deleteChurch(id: string): void {
    const churches = this.getData<Church>('evt_churches').filter(c => c.id !== id);
    this.setData('evt_churches', churches);
  },

  // --- Managers ---
  getManagers(districtId?: string): ChurchManager[] {
    const list = this.getData<ChurchManager>('evt_managers');
    return districtId ? list.filter(m => m.district_id === districtId) : list;
  },
  createManager(manager: Omit<ChurchManager, 'id' | 'status' | 'created_at'> & { district_id?: string }, autoApprove = false): ChurchManager {
    const managers = this.getData<ChurchManager>('evt_managers');
    
    if (managers.some(m => m.login_id === manager.login_id) || manager.login_id === 'admin') {
      throw new Error('이미 사용 중인 로그인 아이디입니다.');
    }

    const newManager: ChurchManager = {
      ...manager,
      id: `m-${uuid()}`,
      status: autoApprove ? 'approved' : 'pending',
      created_at: new Date().toISOString()
    };
    managers.push(newManager);
    this.setData('evt_managers', managers);
    return newManager;
  },
  updateManager(id: string, updates: Partial<ChurchManager>): ChurchManager {
    const managers = this.getData<ChurchManager>('evt_managers');
    const index = managers.findIndex(m => m.id === id);
    if (index === -1) throw new Error('담당자를 찾을 수 없습니다.');
    const updated = { ...managers[index], ...updates };
    managers[index] = updated;
    this.setData('evt_managers', managers);
    return updated;
  },
  deleteManager(id: string): void {
    const managers = this.getData<ChurchManager>('evt_managers').filter(m => m.id !== id);
    this.setData('evt_managers', managers);
  },

  // --- Participants ---
  getParticipants(districtId?: string): Participant[] {
    const list = this.getData<Participant>('evt_participants');
    return districtId ? list.filter(p => p.district_id === districtId) : list;
  },
  getParticipantById(id: string): Participant | undefined {
    return this.getParticipants().find(p => p.id === id);
  },
  createParticipant(participant: Omit<Participant, 'id' | 'created_at' | 'updated_at'> & { district_id?: string }): Participant {
    const participants = this.getData<Participant>('evt_participants');
    const newParticipant: Participant = {
      ...participant,
      id: `p-${uuid()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    participants.push(newParticipant);
    this.setData('evt_participants', participants);
    this.recalculatePayment(participant.church_id);
    return newParticipant;
  },
  updateParticipant(id: string, updates: Partial<Participant>): Participant {
    const participants = this.getData<Participant>('evt_participants');
    const index = participants.findIndex(p => p.id === id);
    if (index === -1) throw new Error('참가자를 찾을 수 없습니다.');
    const updated = { ...participants[index], ...updates, updated_at: new Date().toISOString() };
    participants[index] = updated;
    this.setData('evt_participants', participants);
    this.recalculatePayment(updated.church_id);
    return updated;
  },
  deleteParticipant(id: string): void {
    const participants = this.getData<Participant>('evt_participants');
    const participant = participants.find(p => p.id === id);
    if (!participant) return;
    
    const filtered = participants.filter(p => p.id !== id);
    this.setData('evt_participants', filtered);
    this.recalculatePayment(participant.church_id);

    const members = this.getGroupMembers().filter(m => m.participant_id !== id);
    this.setData('evt_group_members', members);
  },

  // --- Same Group Requests ---
  getSameGroupRequests(districtId?: string): SameGroupRequest[] {
    const list = this.getData<SameGroupRequest>('evt_same_group_requests');
    return districtId ? list.filter(r => r.district_id === districtId) : list;
  },
  createSameGroupRequest(request: Omit<SameGroupRequest, 'id' | 'status' | 'created_at'> & { district_id?: string }): SameGroupRequest {
    const requests = this.getData<SameGroupRequest>('evt_same_group_requests');
    const newReq: SameGroupRequest = {
      ...request,
      id: `sgr-${uuid()}`,
      status: '확인 필요',
      created_at: new Date().toISOString()
    };
    requests.push(newReq);
    this.setData('evt_same_group_requests', requests);
    return newReq;
  },
  updateSameGroupRequest(id: string, updates: Partial<SameGroupRequest>): SameGroupRequest {
    const requests = this.getData<SameGroupRequest>('evt_same_group_requests');
    const index = requests.findIndex(r => r.id === id);
    if (index === -1) throw new Error('요청을 찾을 수 없습니다.');
    const updated = { ...requests[index], ...updates };
    requests[index] = updated;
    this.setData('evt_same_group_requests', requests);
    return updated;
  },
  deleteSameGroupRequest(id: string): void {
    const requests = this.getSameGroupRequests().filter(r => r.id !== id);
    this.setData('evt_same_group_requests', requests);
  },

  // --- Payment Settings ---
  getPaymentSettings(districtId?: string): PaymentSettings | undefined {
    const list = this.getData<PaymentSettings>('evt_payment_settings');
    return districtId ? list.find(s => s.district_id === districtId) : list[0];
  },
  updatePaymentSettings(updates: Partial<PaymentSettings> & { district_id?: string }): PaymentSettings {
    const settings = this.getData<PaymentSettings>('evt_payment_settings');
    
    // districtId 기반으로 특정 세팅을 찾음
    const districtId = updates.district_id || 'dist-1';
    let current = settings.find(s => s.district_id === districtId);
    
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
      settings.push(current);
    }
    
    const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
    const idx = settings.findIndex(s => s.id === updated.id);
    settings[idx] = updated;
    this.setData('evt_payment_settings', settings);
    return updated;
  },

  // --- Fee Overrides ---
  getFeeOverrides(districtId?: string): ChurchFeeOverride[] {
    const list = this.getData<ChurchFeeOverride>('evt_fee_overrides');
    return districtId ? list.filter(o => o.district_id === districtId) : list;
  },
  updateFeeOverride(churchId: string, type: '학생' | '교사' | '봉사자', fee: number, districtId?: string) {
    const overrides = this.getData<ChurchFeeOverride>('evt_fee_overrides');
    const index = overrides.findIndex(o => o.church_id === churchId && o.participant_type === type);
    
    if (index !== -1) {
      overrides[index].fee = fee;
    } else {
      overrides.push({
        id: `fo-${uuid()}`,
        district_id: districtId || 'dist-1',
        event_id: 'evt-2026',
        church_id: churchId,
        participant_type: type,
        fee,
        created_at: new Date().toISOString()
      });
    }
    this.setData('evt_fee_overrides', overrides);
    this.recalculatePayment(churchId);
  },

  // --- Church Payment Statuses ---
  getChurchPaymentStatuses(districtId?: string): ChurchPaymentStatus[] {
    const list = this.getData<ChurchPaymentStatus>('evt_payment_statuses');
    return districtId ? list.filter(s => s.district_id === districtId) : list;
  },
  updateChurchPaymentStatus(churchId: string, status: '미납' | '확인 필요' | '납부완료', memo?: string, districtId?: string) {
    const statuses = this.getData<ChurchPaymentStatus>('evt_payment_statuses');
    const index = statuses.findIndex(s => s.church_id === churchId);
    const now = new Date().toISOString();
    
    if (index !== -1) {
      statuses[index].status = status;
      if (memo !== undefined) statuses[index].memo = memo;
      if (status === '납부완료') {
        statuses[index].confirmed_at = now;
      }
      statuses[index].updated_at = now;
    } else {
      statuses.push({
        id: `cps-${uuid()}`,
        district_id: districtId || 'dist-1',
        event_id: 'evt-2026',
        church_id: churchId,
        total_amount: 0,
        status,
        memo,
        confirmed_at: status === '납부완료' ? now : undefined,
        updated_at: now
      });
    }
    this.setData('evt_payment_statuses', statuses);
  },

  // --- Recalculate Total Payment ---
  recalculatePayment(churchId: string) {
    // participants와 overrides는 소속 교회 ID 기반으로 쿼리하므로 district_id 격리가 자연히 이루어짐
    const participants = this.getParticipants().filter(p => p.church_id === churchId);
    const overrides = this.getFeeOverrides().filter(o => o.church_id === churchId);
    
    const activeEvent = this.getActiveEvent();
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
    const approvedManagersCount = this.getManagers().filter(m => m.church_id === churchId && m.status === 'approved').length;
    const teacherFeeOverride = overrides.find(o => o.participant_type === '교사');
    const teacherFee = teacherFeeOverride ? teacherFeeOverride.fee : (baseFees['교사'] || 0);
    total += approvedManagersCount * teacherFee;

    const statuses = this.getData<ChurchPaymentStatus>('evt_payment_statuses');
    const index = statuses.findIndex(s => s.church_id === churchId);
    if (index !== -1) {
      statuses[index].total_amount = total;
      statuses[index].updated_at = new Date().toISOString();
      this.setData('evt_payment_statuses', statuses);
    }
  },

  // --- Grouping ---
  getGroupingGroups(districtId?: string): GroupingGroup[] {
    const list = this.getData<GroupingGroup>('evt_grouping_groups');
    return districtId ? list.filter(g => g.district_id === districtId) : list;
  },
  createGroupingGroup(g: Omit<GroupingGroup, 'id' | 'created_at'> & { district_id?: string }): GroupingGroup {
    const list = this.getData<GroupingGroup>('evt_grouping_groups');
    const newGroup: GroupingGroup = {
      ...g,
      id: `gg-${uuid()}`,
      created_at: new Date().toISOString()
    };
    list.push(newGroup);
    this.setData('evt_grouping_groups', list);
    return newGroup;
  },
  deleteGroupingGroup(id: string): void {
    const list = this.getData<GroupingGroup>('evt_grouping_groups').filter(g => g.id !== id);
    this.setData('evt_grouping_groups', list);

    const groups = this.getGroups().filter(g => g.grouping_group_id === id);
    const groupIds = groups.map(g => g.id);

    const remainingGroups = this.getGroups().filter(g => g.grouping_group_id !== id);
    this.setData('evt_groups', remainingGroups);

    const remainingMembers = this.getGroupMembers().filter(m => !groupIds.includes(m.group_id));
    this.setData('evt_group_members', remainingMembers);

    const participants = this.getParticipants();
    participants.forEach(p => {
      if (p.assigned_group_id && groupIds.includes(p.assigned_group_id)) {
        p.assigned_group_id = null;
      }
    });
    this.setData('evt_participants', participants);
  },

  getGroups(districtId?: string): Group[] {
    const list = this.getData<Group>('evt_groups');
    return districtId ? list.filter(g => g.district_id === districtId) : list;
  },
  getGroupsByGroupingId(ggId: string): Group[] {
    return this.getGroups().filter(g => g.grouping_group_id === ggId).sort((a,b) => a.sort_order - b.sort_order);
  },
  createGroup(g: Omit<Group, 'id' | 'created_at'> & { district_id?: string }): Group {
    const list = this.getData<Group>('evt_groups');
    const newGroup: Group = {
      ...g,
      id: `g-${uuid()}`,
      created_at: new Date().toISOString()
    };
    list.push(newGroup);
    this.setData('evt_groups', list);
    return newGroup;
  },
  updateGroup(id: string, updates: Partial<Group>): Group {
    const list = this.getData<Group>('evt_groups');
    const idx = list.findIndex(g => g.id === id);
    if (idx === -1) throw new Error('조를 찾을 수 없습니다.');
    const updated = { ...list[idx], ...updates };
    list[idx] = updated;
    this.setData('evt_groups', list);
    return updated;
  },
  deleteGroup(id: string): void {
    const list = this.getGroups().filter(g => g.id !== id);
    this.setData('evt_groups', list);

    // 해당 조의 멤버 제거
    const members = this.getGroupMembers().filter(m => m.group_id !== id);
    this.setData('evt_group_members', members);

    // 참가자 조 해제
    const participants = this.getParticipants();
    participants.forEach(p => {
      if (p.assigned_group_id === id) {
        p.assigned_group_id = null;
      }
    });
    this.setData('evt_participants', participants);
  },

  getGroupMembers(): GroupMember[] {
    return this.getData<GroupMember>('evt_group_members');
  },
  assignParticipantToGroup(participantId: string, groupId: string | null) {
    const participants = this.getParticipants();
    const pIdx = participants.findIndex(p => p.id === participantId);
    if (pIdx === -1) return;

    const oldGroupId = participants[pIdx].assigned_group_id;
    participants[pIdx].assigned_group_id = groupId;
    this.setData('evt_participants', participants);

    // group_members 테이블 동기화
    let members = this.getGroupMembers();
    if (oldGroupId) {
      members = members.filter(m => m.participant_id !== participantId);
    }
    if (groupId) {
      members.push({
        id: `gm-${uuid()}`,
        event_id: 'evt-2026',
        group_id: groupId,
        participant_id: participantId,
        role_in_group: participants[pIdx].participant_type === '학생' ? '학생' : (participants[pIdx].participant_type === '교사' ? '교사' : '봉사자'),
        created_at: new Date().toISOString()
      });
    }
    this.setData('evt_group_members', members);
  },

  // --- Auth & Session ---
  login(loginId: string, passwordHash: string, districtId?: string) {
    const config = this.getPlatformConfig();
    const expectedId = process.env.NEXT_PUBLIC_SUPER_LOGIN_ID || 'admin';
    const expectedPw = config.super_admin_password || process.env.NEXT_PUBLIC_SUPER_LOGIN_PASSWORD || 'admin123';
    if (!districtId && loginId === expectedId && passwordHash === expectedPw) {
      return { success: true, role: 'super', churchId: '', name: '시스템 최고 관리자' };
    }

    const managers = this.getManagers();
    const manager = managers.find(m => 
      m.login_id === loginId && 
      m.password_hash === passwordHash &&
      (!districtId || m.district_id === districtId)
    );
    
    if (manager) {
      if (manager.status !== 'approved') {
        return { success: false, error: '아직 승인되지 않은 계정입니다. 본부 관리자의 승인을 기다려 주세요.' };
      }
      
      const isAdmin = manager.is_admin ?? (manager.church_id === '');
      const isManager = manager.is_manager ?? (manager.church_id !== '');
      
      if (isAdmin) {
        const districts = this.getDistricts();
        const dist = districts.find(d => d.id === manager.district_id);
        return { 
          success: true, 
          role: 'admin', 
          churchId: '', 
          name: dist ? `${dist.name} 관리자` : `${manager.name} (본부 관리자)` 
        };
      }
      
      if (isManager) {
        const churches = this.getChurches();
        const church = churches.find(c => c.id === manager.church_id);
        return { 
          success: true, 
          role: 'manager', 
          churchId: manager.church_id, 
          name: `${church?.name || ''} 담당자 (${manager.name})` 
        };
      }

      return {
        success: true,
        role: 'manager',
        churchId: manager.church_id,
        name: `담당자 (${manager.name})`
      };
    }

    return { success: false, error: '아이디 또는 비밀번호가 잘못되었습니다.' };
  },

  purgeDistrictData(districtId: string): void {
    // 1. participants 삭제
    const participants = this.getParticipants().filter(p => p.district_id !== districtId);
    this.setData('evt_participants', participants);

    // 2. same_group_requests 삭제
    const requests = this.getSameGroupRequests().filter(r => r.district_id !== districtId);
    this.setData('evt_same_group_requests', requests);

    // 3. grouping_groups 삭제
    const grouping = this.getGroupingGroups().filter(gg => gg.district_id !== districtId);
    this.setData('evt_grouping_groups', grouping);

    // 4. groups 삭제
    const groups = this.getGroups().filter(g => g.district_id !== districtId);
    this.setData('evt_groups', groups);

    // 5. group_members 삭제
    const members = this.getGroupMembers().filter(m => m.district_id !== districtId);
    this.setData('evt_group_members', members);

    // 6. payment_statuses 삭제
    const payments = this.getChurchPaymentStatuses().filter(s => s.district_id !== districtId);
    this.setData('evt_payment_statuses', payments);
    
    // 7. fee_overrides 삭제
    const overrides = this.getFeeOverrides().filter(o => o.district_id !== districtId);
    this.setData('evt_fee_overrides', overrides);

    // 8. churches 삭제
    const churches = this.getChurches().filter(c => c.district_id !== districtId);
    this.setData('evt_churches', churches);

    // 9. managers 삭제 (교회 매니저 신청 및 계정 일괄 삭제)
    const managers = this.getManagers().filter(m => m.district_id !== districtId);
    this.setData('evt_managers', managers);

    // 10. events 비활성화 처리 (히스토리 보존을 위해 이벤트 데이터 자체는 남겨두되 비활성화)
    const events = this.getEvents().map(e => {
      if (e.district_id === districtId) {
        return { ...e, is_active: false };
      }
      return e;
    });
    this.setData('evt_events', events);
  },

  deleteDistrictComplete(districtId: string): void {
    // 1. 하위 데이터 일괄 퍼지 실행 (참가자, 조편성, 교회, 매니저 등 삭제)
    this.purgeDistrictData(districtId);

    // 2. events 테이블에서 이 지방회와 연계된 이벤트 완전히 삭제
    const events = this.getEvents().filter(e => e.district_id !== districtId);
    this.setData('evt_events', events);

    // 3. districts 테이블에서 이 지방회 문서 자체를 삭제
    const districts = this.getDistricts().filter(d => d.id !== districtId);
    this.setData('evt_districts', districts);
  },

  getPlatformConfig(): PlatformConfig {
    const list = this.getData<PlatformConfig>('evt_platform_config');
    if (list.length === 0) {
      this.setData('evt_platform_config', [INITIAL_PLATFORM_CONFIG]);
      return INITIAL_PLATFORM_CONFIG;
    }
    return list[0];
  },
  updatePlatformConfig(updates: Partial<PlatformConfig>): PlatformConfig {
    const current = this.getPlatformConfig();
    const updated = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.setData('evt_platform_config', [updated]);
    return updated;
  }
};
