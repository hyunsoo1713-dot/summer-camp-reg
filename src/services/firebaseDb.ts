import { 
  Event, Church, ChurchManager, Participant, SameGroupRequest, 
  GroupingGroup, Group, GroupMember, PaymentSettings, 
  ChurchFeeOverride, ChurchPaymentStatus, District, PlatformConfig
} from '../types';
import { dbFirestore } from '../utils/firebaseClient';
import { collection, getDocs, doc, setDoc as fsSetDoc, updateDoc as fsUpdateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

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

const setDoc = (ref: any, data: any) => fsSetDoc(ref, cleanData(data));
const updateDoc = (ref: any, data: any) => fsUpdateDoc(ref, cleanData(data));

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
    password_hash: 'jesus123',
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

const INITIAL_PARTICIPANTS: Participant[] = [
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
  { id: 'fo-1', district_id: 'dist-1', event_id: 'evt-2026', church_id: 'ch-3', participant_type: '학생', fee: 15000, created_at: new Date().toISOString() }
];

const INITIAL_SAME_GROUP_REQUESTS: SameGroupRequest[] = [
  {
    id: 'sgr-1',
    district_id: 'dist-1',
    event_id: 'evt-2026',
    church_id: 'ch-1',
    participant_id: 'p-1',
    participant_name: '김하준',
    requested_participant_name: '이서윤',
    reason: '두 아동이 같은 교회 친구이며 낯을 많이 가립니다.',
    requested_by: '김예수',
    status: '확인 필요',
    created_at: new Date().toISOString()
  }
];

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

export const firebaseDb = {
  async init() {
    if (isInitialized) return;

    try {
      const districtsSnap = await getDocs(collection(dbFirestore, 'districts'));
      const eventsSnap = await getDocs(collection(dbFirestore, 'events'));
      const churchesSnap = await getDocs(collection(dbFirestore, 'churches'));
      const managersSnap = await getDocs(collection(dbFirestore, 'church_managers'));
      const participantsSnap = await getDocs(collection(dbFirestore, 'participants'));
      const sameGroupRequestsSnap = await getDocs(collection(dbFirestore, 'same_group_requests'));
      const groupingGroupsSnap = await getDocs(collection(dbFirestore, 'grouping_groups'));
      const groupsSnap = await getDocs(collection(dbFirestore, 'groups'));
      const paymentSettingsSnap = await getDocs(collection(dbFirestore, 'payment_settings'));
      const feeOverridesSnap = await getDocs(collection(dbFirestore, 'church_fee_overrides'));
      const paymentStatusesSnap = await getDocs(collection(dbFirestore, 'church_payment_statuses'));
      const platformConfigSnap = await getDocs(collection(dbFirestore, 'platform_config'));

      // 지방회 목록이 비어있다면, 초기 데모 데이터를 강제로 Firestore에 커밋하지 않고 빈 채로 유지합니다.
      if (districtsSnap.empty) {
        console.log('Firestore is empty.');
        isInitialized = true;
        return;
      }

      // 메모리에 로드
      memoryDb.districts = districtsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as District);
      memoryDb.churches = churchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Church);
      memoryDb.managers = managersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ChurchManager);
      memoryDb.participants = participantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Participant);
      memoryDb.sameGroupRequests = sameGroupRequestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as SameGroupRequest);
      memoryDb.groupingGroups = groupingGroupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as GroupingGroup);
      memoryDb.groups = groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Group);
      memoryDb.paymentSettings = paymentSettingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PaymentSettings);
      memoryDb.feeOverrides = feeOverridesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ChurchFeeOverride);
      memoryDb.paymentStatuses = paymentStatusesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ChurchPaymentStatus);

      memoryDb.events = eventsSnap.docs.map(doc => {
        const data = doc.data();
        if (data.options) {
          memoryDb.eventOptions[doc.id] = data.options;
        }
        return { id: doc.id, ...data } as Event;
      });

      memoryDb.platformConfig = platformConfigSnap.empty 
        ? INITIAL_PLATFORM_CONFIG 
        : (platformConfigSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PlatformConfig)[0] || INITIAL_PLATFORM_CONFIG);

      isInitialized = true;
      console.log('Firestore SaaS initialization completed.');
    } catch (err) {
      console.error('Error SaaS Firestore:', err);
    }
  },

  async initForce() {
    isInitialized = false;
    await this.init();
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
    setDoc(doc(dbFirestore, 'districts', id), newDist).catch(err => console.error(err));

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
      memoryDb.managers.push(newManager);
      setDoc(doc(dbFirestore, 'church_managers', managerId), newManager).catch(err => console.error(err));
    }

    return newDist;
  },
  approveDistrict(id: string): District {
    const idx = memoryDb.districts.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('지방회를 찾을 수 없습니다.');
    memoryDb.districts[idx].status = 'approved';
    setDoc(doc(dbFirestore, 'districts', id), memoryDb.districts[idx]).catch(err => console.error(err));

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
        setDoc(doc(dbFirestore, 'church_managers', m.id), updated).catch(err => console.error(err));
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
    setDoc(doc(dbFirestore, 'districts', id), memoryDb.districts[idx]).catch(err => console.error(err));

    // 지방회 반려 시, 해당 지방회 소속의 승인 대기 중이었던 매니저 계정도 함께 삭제 처리합니다.
    memoryDb.managers = memoryDb.managers.filter(m => {
      if (m.district_id === id && m.status === 'pending') {
        deleteDoc(doc(dbFirestore, 'church_managers', m.id)).catch(err => console.error(err));
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
      shirtSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
      attendanceDates: [
        { date: '2026-08-01', label: '1일차 (토)' },
        { date: '2026-08-02', label: '2일차 (일)' },
        { date: '2026-08-03', label: '3일차 (월)' }
      ],
      fees: { '학생': 20000, '교사': 0, '봉사자': 0 }
    };
    memoryDb.eventOptions[eventId] = defaultOptions;

    setDoc(doc(dbFirestore, 'events', eventId), {
      ...newEvent,
      options: defaultOptions
    }).catch(err => console.error(err));
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
      shirtSizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
      attendanceDates: [
        { date: '2026-08-01', label: '1일차 (토)' },
        { date: '2026-08-02', label: '2일차 (일)' },
        { date: '2026-08-03', label: '3일차 (월)' }
      ],
      fees: { '학생': 20000, '교사': 0, '봉사자': 0 }
    };
    memoryDb.eventOptions[id] = defaultOptions;

    setDoc(doc(dbFirestore, 'events', id), {
      ...newEvent,
      options: defaultOptions
    }).catch(err => console.error(err));

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
    setDoc(doc(dbFirestore, 'events', id), {
      ...updated,
      options
    }).catch(err => console.error(err));

    return updated;
  },
  deleteEvent(id: string): void {
    memoryDb.events = memoryDb.events.filter(e => e.id !== id);
    delete memoryDb.eventOptions[id];
    deleteDoc(doc(dbFirestore, 'events', id)).catch(err => console.error(err));
  },

  getEventOptions(eventId: string) {
    return memoryDb.eventOptions[eventId] || { 
      departments: [], 
      birthYears: [], 
      shirtSizes: [], 
      attendanceDates: [], 
      fees: { '학생': 20000, '교사': 0, '봉사자': 0 } 
    };
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

    updateDoc(doc(dbFirestore, 'events', eventId), {
      options: updated
    }).catch(err => console.error(err));
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
    setDoc(doc(dbFirestore, 'churches', id), newChurch).catch(err => console.error(err));

    const cpsId = `cps-${uuid()}`;
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
    setDoc(doc(dbFirestore, 'church_payment_statuses', cpsId), newStatus).catch(err => console.error(err));

    return newChurch;
  },
  updateChurch(id: string, updates: Partial<Church>): Church {
    const idx = memoryDb.churches.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('교회를 찾을 수 없습니다.');
    const updated = { ...memoryDb.churches[idx], ...updates };
    memoryDb.churches[idx] = updated;
    setDoc(doc(dbFirestore, 'churches', id), updated).catch(err => console.error(err));
    return updated;
  },
  deleteChurch(id: string): void {
    memoryDb.churches = memoryDb.churches.filter(c => c.id !== id);
    deleteDoc(doc(dbFirestore, 'churches', id)).catch(err => console.error(err));
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
    memoryDb.managers.push(newManager);
    setDoc(doc(dbFirestore, 'church_managers', id), newManager).catch(err => console.error(err));
    return newManager;
  },
  updateManager(id: string, updates: Partial<ChurchManager>): ChurchManager {
    const idx = memoryDb.managers.findIndex(m => m.id === id);
    if (idx === -1) throw new Error('담당자를 찾을 수 없습니다.');
    const updated = { ...memoryDb.managers[idx], ...updates };
    memoryDb.managers[idx] = updated;
    setDoc(doc(dbFirestore, 'church_managers', id), updated).catch(err => console.error(err));
    return updated;
  },
  deleteManager(id: string): void {
    memoryDb.managers = memoryDb.managers.filter(m => m.id !== id);
    deleteDoc(doc(dbFirestore, 'church_managers', id)).catch(err => console.error(err));
  },

  // --- Participants ---
  getParticipants(districtId?: string): Participant[] {
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
    memoryDb.participants.push(newParticipant);
    setDoc(doc(dbFirestore, 'participants', id), newParticipant).catch(err => console.error(err));
    this.recalculatePayment(participant.church_id);
    return newParticipant;
  },
  updateParticipant(id: string, updates: Partial<Participant>): Participant {
    const idx = memoryDb.participants.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('참가자를 찾을 수 없습니다.');
    const updated = { ...memoryDb.participants[idx], ...updates, updated_at: new Date().toISOString() };
    memoryDb.participants[idx] = updated;
    setDoc(doc(dbFirestore, 'participants', id), updated).catch(err => console.error(err));
    this.recalculatePayment(updated.church_id);
    return updated;
  },
  deleteParticipant(id: string): void {
    const participant = memoryDb.participants.find(p => p.id === id);
    if (!participant) return;

    memoryDb.participants = memoryDb.participants.filter(p => p.id !== id);
    deleteDoc(doc(dbFirestore, 'participants', id)).catch(err => console.error(err));
    this.recalculatePayment(participant.church_id);
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
    setDoc(doc(dbFirestore, 'same_group_requests', id), newReq).catch(err => console.error(err));
    return newReq;
  },
  updateSameGroupRequest(id: string, updates: Partial<SameGroupRequest>): SameGroupRequest {
    const idx = memoryDb.sameGroupRequests.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('요청을 찾을 수 없습니다.');
    const updated = { ...memoryDb.sameGroupRequests[idx], ...updates };
    memoryDb.sameGroupRequests[idx] = updated;
    setDoc(doc(dbFirestore, 'same_group_requests', id), updated).catch(err => console.error(err));
    return updated;
  },
  deleteSameGroupRequest(id: string): void {
    memoryDb.sameGroupRequests = memoryDb.sameGroupRequests.filter(r => r.id !== id);
    deleteDoc(doc(dbFirestore, 'same_group_requests', id)).catch(err => console.error(err));
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
    setDoc(doc(dbFirestore, 'payment_settings', updated.id), updated).catch(err => console.error(err));
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
    setDoc(doc(dbFirestore, 'church_fee_overrides', target.id), target).catch(err => console.error(err));
    this.recalculatePayment(churchId);
  },

  // --- Church Payment Statuses ---
  getChurchPaymentStatuses(districtId?: string): ChurchPaymentStatus[] {
    return districtId ? memoryDb.paymentStatuses.filter(s => s.district_id === districtId) : memoryDb.paymentStatuses;
  },
  updateChurchPaymentStatus(churchId: string, status: '미납' | '확인 필요' | '납부완료', memo?: string, districtId?: string) {
    const idx = memoryDb.paymentStatuses.findIndex(s => s.church_id === churchId);
    const now = new Date().toISOString();
    
    let target: ChurchPaymentStatus;
    if (idx !== -1) {
      memoryDb.paymentStatuses[idx].status = status;
      if (memo !== undefined) memoryDb.paymentStatuses[idx].memo = memo;
      if (status === '납부완료') {
        memoryDb.paymentStatuses[idx].confirmed_at = now;
      }
      memoryDb.paymentStatuses[idx].updated_at = now;
      target = memoryDb.paymentStatuses[idx];
    } else {
      target = {
        id: `cps-${uuid()}`,
        district_id: districtId || 'dist-1',
        event_id: 'evt-2026',
        church_id: churchId,
        total_amount: 0,
        status,
        memo,
        confirmed_at: status === '납부완료' ? now : undefined,
        updated_at: now
      };
      memoryDb.paymentStatuses.push(target);
    }
    setDoc(doc(dbFirestore, 'church_payment_statuses', target.id), target).catch(err => console.error(err));
  },

  // --- Recalculate Total Payment ---
  recalculatePayment(churchId: string) {
    const participants = memoryDb.participants.filter(p => p.church_id === churchId);
    const overrides = memoryDb.feeOverrides.filter(o => o.church_id === churchId);
    
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
    const approvedManagersCount = memoryDb.managers.filter(m => m.church_id === churchId && m.status === 'approved').length;
    const teacherFeeOverride = overrides.find(o => o.participant_type === '교사');
    const teacherFee = teacherFeeOverride ? teacherFeeOverride.fee : (baseFees['교사'] || 0);
    total += approvedManagersCount * teacherFee;

    const idx = memoryDb.paymentStatuses.findIndex(s => s.church_id === churchId);
    if (idx !== -1) {
      memoryDb.paymentStatuses[idx].total_amount = total;
      memoryDb.paymentStatuses[idx].updated_at = new Date().toISOString();
      setDoc(doc(dbFirestore, 'church_payment_statuses', memoryDb.paymentStatuses[idx].id), memoryDb.paymentStatuses[idx]).catch(err => console.error(err));
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
    setDoc(doc(dbFirestore, 'grouping_groups', id), newGroup).catch(err => console.error(err));
    return newGroup;
  },
  deleteGroupingGroup(id: string): void {
    memoryDb.groupingGroups = memoryDb.groupingGroups.filter(g => g.id !== id);
    deleteDoc(doc(dbFirestore, 'grouping_groups', id)).catch(err => console.error(err));

    const groups = memoryDb.groups.filter(g => g.grouping_group_id === id);
    const groupIds = groups.map(g => g.id);

    memoryDb.groups = memoryDb.groups.filter(g => g.grouping_group_id !== id);
    groupIds.forEach(gid => {
      deleteDoc(doc(dbFirestore, 'groups', gid)).catch(err => console.error(err));
    });

    memoryDb.participants.forEach(p => {
      if (p.assigned_group_id && groupIds.includes(p.assigned_group_id)) {
        p.assigned_group_id = null;
        updateDoc(doc(dbFirestore, 'participants', p.id), { assigned_group_id: null }).catch(err => console.error(err));
      }
    });
  },

  getGroups(districtId?: string): Group[] {
    return districtId ? memoryDb.groups.filter(g => g.district_id === districtId) : memoryDb.groups;
  },
  getGroupsByGroupingId(ggId: string): Group[] {
    return memoryDb.groups.filter(g => g.grouping_group_id === ggId).sort((a,b) => a.sort_order - b.sort_order);
  },
  createGroup(g: Omit<Group, 'id' | 'created_at'> & { district_id?: string }): Group {
    const id = `g-${uuid()}`;
    const newGroup: Group = {
      ...g,
      id,
      created_at: new Date().toISOString()
    };
    memoryDb.groups.push(newGroup);
    setDoc(doc(dbFirestore, 'groups', id), newGroup).catch(err => console.error(err));
    return newGroup;
  },
  updateGroup(id: string, updates: Partial<Group>): Group {
    const idx = memoryDb.groups.findIndex(g => g.id === id);
    if (idx === -1) throw new Error('조를 찾을 수 없습니다.');
    const updated = { ...memoryDb.groups[idx], ...updates };
    memoryDb.groups[idx] = updated;
    setDoc(doc(dbFirestore, 'groups', id), updated).catch(err => console.error(err));
    return updated;
  },
  deleteGroup(id: string): void {
    memoryDb.groups = memoryDb.groups.filter(g => g.id !== id);
    deleteDoc(doc(dbFirestore, 'groups', id)).catch(err => console.error(err));

    memoryDb.participants.forEach(p => {
      if (p.assigned_group_id === id) {
        p.assigned_group_id = null;
        updateDoc(doc(dbFirestore, 'participants', p.id), { assigned_group_id: null }).catch(err => console.error(err));
      }
    });
  },

  assignParticipantToGroup(participantId: string, groupId: string | null) {
    const pIdx = memoryDb.participants.findIndex(p => p.id === participantId);
    if (pIdx === -1) return;

    memoryDb.participants[pIdx].assigned_group_id = groupId;
    updateDoc(doc(dbFirestore, 'participants', participantId), { assigned_group_id: groupId }).catch(err => console.error(err));
  },

  login(loginId: string, passwordHash: string, districtId?: string) {
    const config = this.getPlatformConfig();
    const expectedId = process.env.NEXT_PUBLIC_SUPER_LOGIN_ID || 'admin';
    const expectedPw = config.super_admin_password || process.env.NEXT_PUBLIC_SUPER_LOGIN_PASSWORD || 'admin123';
    if (!districtId && loginId === expectedId && passwordHash === expectedPw) {
      return { success: true, role: 'super', churchId: '', name: '시스템 최고 관리자' };
    }

    const manager = memoryDb.managers.find(m => 
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
        const dist = memoryDb.districts.find(d => d.id === manager.district_id);
        return { 
          success: true, 
          role: 'admin', 
          churchId: '', 
          name: dist ? `${dist.name} 관리자` : `${manager.name} (본부 관리자)` 
        };
      }
      
      if (isManager) {
        const church = memoryDb.churches.find(c => c.id === manager.church_id);
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

    // 2. Firestore Batch Delete 작업 수행
    try {
      const batch = writeBatch(dbFirestore);

      // 참가자 삭제 예약
      participantsToDelete.forEach(p => {
        batch.delete(doc(dbFirestore, 'participants', p.id));
      });

      // 동일조 요청 삭제 예약
      requestsToDelete.forEach(r => {
        batch.delete(doc(dbFirestore, 'same_group_requests', r.id));
      });

      // 조편성 그룹 삭제 예약
      groupingToDelete.forEach(gg => {
        batch.delete(doc(dbFirestore, 'grouping_groups', gg.id));
      });

      // 조 삭제 예약
      groupsToDelete.forEach(g => {
        batch.delete(doc(dbFirestore, 'groups', g.id));
      });

      // 수납 상태 삭제 예약
      paymentsToDelete.forEach(s => {
        batch.delete(doc(dbFirestore, 'church_payment_statuses', s.id));
      });

      // 참가비 예외 삭제 예약
      overridesToDelete.forEach(o => {
        batch.delete(doc(dbFirestore, 'church_fee_overrides', o.id));
      });

      // 교회 삭제 예약
      churchesToDelete.forEach(c => {
        batch.delete(doc(dbFirestore, 'churches', c.id));
      });

      // 매니저 삭제 예약
      managersToDelete.forEach(m => {
        batch.delete(doc(dbFirestore, 'church_managers', m.id));
      });

      // 이벤트 비활성화 업데이트 예약
      const districtEvents = memoryDb.events.filter(e => e.district_id === districtId);
      districtEvents.forEach(e => {
        batch.update(doc(dbFirestore, 'events', e.id), { is_active: false });
      });

      // Commit
      await batch.commit();
      console.log(`Firestore data purge completed for district: ${districtId}`);
    } catch (err) {
      console.error('Error purging district data from Firestore:', err);
    }
  },

  async deleteDistrictComplete(districtId: string): Promise<void> {
    // 1. 먼저 하위 데이터 퍼지 수행 (참가자, 조편성, 교회, 매니저 일괄 삭제)
    await this.purgeDistrictData(districtId);

    // 2. 메모리 DB 갱신
    const eventsToDelete = memoryDb.events.filter(e => e.district_id === districtId);
    memoryDb.events = memoryDb.events.filter(e => e.district_id !== districtId);
    memoryDb.districts = memoryDb.districts.filter(d => d.id !== districtId);

    // 3. Firestore 데이터 완전 제거
    try {
      const batch = writeBatch(dbFirestore);

      // 연동 이벤트 삭제 예약
      eventsToDelete.forEach(e => {
        batch.delete(doc(dbFirestore, 'events', e.id));
      });

      // 지방회 문서 자체 삭제 예약
      batch.delete(doc(dbFirestore, 'districts', districtId));

      await batch.commit();
      console.log(`Firestore complete district deletion completed for: ${districtId}`);
    } catch (err) {
      console.error('Error deleting district from Firestore:', err);
    }
  },

  getPlatformConfig(): PlatformConfig {
    if (!memoryDb.platformConfig) {
      memoryDb.platformConfig = INITIAL_PLATFORM_CONFIG;
    }
    return memoryDb.platformConfig;
  },
  async updatePlatformConfig(updates: Partial<PlatformConfig>): Promise<PlatformConfig> {
    const current = this.getPlatformConfig();
    const updated = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString()
    };
    memoryDb.platformConfig = updated;
    await setDoc(doc(dbFirestore, 'platform_config', updated.id), updated).catch(err => console.error(err));
    return updated;
  }
};
