'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/services/db';
import { excelUtils } from '@/utils/excel';
import { runAutoGrouping } from '@/utils/grouping';
import { storageFirebase } from '@/utils/firebaseClient';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Event, Church, ChurchManager, Participant, SameGroupRequest,
  GroupingGroup, Group, GroupMember, PaymentSettings, ChurchFeeOverride, ChurchPaymentStatus, District 
} from '@/types';
import { 
  Settings, Users, ShieldCheck, UserCheck, Download, Grid, Plus, Trash2, 
  Save, AlertTriangle, CheckCircle, ClipboardList, Info, FileSpreadsheet,
  ArrowRight, ShieldAlert, Edit, LogOut, Copy,
  ArrowUpDown, ChevronUp, ChevronDown, RefreshCw
} from 'lucide-react';

const ALL_DEPARTMENTS = [
  '유아부', '유치부',
  '초등 1학년', '초등 2학년', '초등 3학년', '초등 4학년', '초등 5학년', '초등 6학년',
  '중등 1학년', '중등 2학년', '중등 3학년',
  '고등 1학년', '고등 2학년', '고등 3학년'
];

const compressImage = async (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.7): Promise<string> => {
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  const runCompress = (w: number, h: number, q: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > w) {
              height = Math.round((height * w) / width);
              width = w;
            }
          } else {
            if (height > h) {
              width = Math.round((width * h) / height);
              height = h;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(event.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', q);
          resolve(compressedBase64);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  let currentMaxWidth = maxWidth;
  let currentMaxHeight = maxHeight;
  let currentQuality = quality;
  let attempts = 0;

  while (attempts < 5) {
    const base64 = await runCompress(currentMaxWidth, currentMaxHeight, currentQuality);
    const approxByteSize = (base64.length * 3) / 4;

    if (approxByteSize <= MAX_SIZE_BYTES) {
      return base64;
    }

    currentMaxWidth = Math.round(currentMaxWidth * 0.8);
    currentMaxHeight = Math.round(currentMaxHeight * 0.8);
    currentQuality = Math.max(0.2, currentQuality - 0.15);
    attempts++;
  }

  return runCompress(600, 600, 0.2);
};

interface PageProps {
  params: Promise<{ districtSlug: string }>;
}

export default function DistrictAdminDashboard({ params }: PageProps) {
  const router = useRouter();
  const { districtSlug } = use(params);

  const [district, setDistrict] = useState<District | null>(null);
  const [event, setEvent] = useState<Event | null>(null);

  // 전체 데이터 상태
  const [churches, setChurches] = useState<Church[]>([]);
  const [managers, setManagers] = useState<ChurchManager[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [requests, setRequests] = useState<SameGroupRequest[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [paymentStatuses, setPaymentStatuses] = useState<ChurchPaymentStatus[]>([]);
  const [feeOverrides, setFeeOverrides] = useState<ChurchFeeOverride[]>([]);
  
  // 조편성 상태
  const [groupingGroups, setGroupingGroups] = useState<GroupingGroup[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  // 행사별 기본 설정 옵션
  const [options, setOptions] = useState<{
    departments: string[];
    birthYears: string[];
    shirtSizes: string[];
    attendanceDates: { date: string; label: string }[];
    fees: Record<string, number>;
  }>({ departments: [], birthYears: [], shirtSizes: [], attendanceDates: [], fees: {} });

  // 새로고침 상태 및 핸들러
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (db.initForce) {
        await db.initForce();
      }
      if (district) {
        loadAllData(district.id, event?.id || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 탭 제어
  const [activeTab, setActiveTab] = useState<'settings' | 'churches' | 'participants' | 'grouping'>('settings');
  const [tempPaidAmounts, setTempPaidAmounts] = useState<Record<string, string>>({});

  // 커스텀 모달 상태 정의
  const [customModal, setCustomModal] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'prompt' | 'select';
    title: string;
    message: string;
    placeholder?: string;
    defaultValue?: string;
    options?: { value: string; label: string }[];
    onConfirm: (inputVal?: string) => void;
    onCancel: () => void;
  } | null>(null);

  // 커스텀 모달 헬퍼 함수들
  const showConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setCustomModal({
        isOpen: true,
        type: 'confirm',
        title,
        message,
        onConfirm: () => {
          setCustomModal(null);
          resolve(true);
        },
        onCancel: () => {
          setCustomModal(null);
          resolve(false);
        }
      });
    });
  };

  const showPrompt = (title: string, message: string, defaultValue = '', placeholder = ''): Promise<string | null> => {
    return new Promise((resolve) => {
      setCustomModal({
        isOpen: true,
        type: 'prompt',
        title,
        message,
        defaultValue,
        placeholder,
        onConfirm: (inputVal) => {
          setCustomModal(null);
          resolve(inputVal || '');
        },
        onCancel: () => {
          setCustomModal(null);
          resolve(null);
        }
      });
    });
  };

  const showSelect = (title: string, message: string, options: { value: string; label: string }[], defaultValue = ''): Promise<string | null> => {
    return new Promise((resolve) => {
      setCustomModal({
        isOpen: true,
        type: 'select',
        title,
        message,
        options,
        defaultValue,
        onConfirm: (selectedVal) => {
          setCustomModal(null);
          resolve(selectedVal || null);
        },
        onCancel: () => {
          setCustomModal(null);
          resolve(null);
        }
      });
    });
  };

  // 인증 및 로딩
  useEffect(() => {
    const initAndLoad = async () => {
      if (db.initForce) {
        await db.initForce();
      }

      // 1. 지방회 검증
      const dist = db.getDistrictBySlug(districtSlug);
      if (!dist || dist.status !== 'approved') {
        alert('유효하지 않거나 승인 대기 중인 지방회 주소입니다.');
        router.push('/');
        return;
      }
      setDistrict(dist);

      // 2. 세션 검증
      const sessStr = localStorage.getItem('evt_session');
      if (!sessStr) {
        router.push(`/district/${districtSlug}/login`);
        return;
      }
      try {
        const session = JSON.parse(sessStr);
        const sessionDistId = session.district_id || session.districtId;
        if (!session.is_admin || sessionDistId !== dist.id) {
          router.push(`/district/${districtSlug}/login`);
          return;
        }
      } catch (e) {
        router.push(`/district/${districtSlug}/login`);
        return;
      }

      const active = db.getActiveEvent(dist.id);
      if (active) {
        setEvent(active);
        loadAllData(dist.id, active.id);
      } else {
        // 만약 액티브 이벤트가 없으면 강제로 빈 리스트 형태로 바인딩
        loadAllData(dist.id, '');
      }
    };

    initAndLoad();
  }, [districtSlug, router]);

  const loadAllData = (districtId: string, eventId: string) => {
    setChurches(db.getChurches(districtId));
    setManagers(db.getManagers(districtId));
    setParticipants(db.getParticipants(districtId));
    setRequests(db.getSameGroupRequests(districtId));
    setPaymentSettings(db.getPaymentSettings(districtId) || null);
    setPaymentStatuses(db.getChurchPaymentStatuses(districtId));
    setFeeOverrides(db.getFeeOverrides(districtId));
    setGroupingGroups(db.getGroupingGroups(districtId));
    setGroups(db.getGroups(districtId));
    if (eventId) {
      setOptions(db.getEventOptions(eventId));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('evt_session');
    router.push(`/district/${districtSlug}/login`);
  };

  // ==========================================
  // TAB 1: 행사 및 설정 관리 로직
  // ==========================================
  const [eventName, setEventName] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [regStart, setRegStart] = useState('');
  const [regEnd, setRegEnd] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [bankName, setBankName] = useState('');
  const [accNum, setAccNum] = useState('');
  const [accHolder, setAccHolder] = useState('');
  const [bankMemo, setBankMemo] = useState('');
  const [feeStudent, setFeeStudent] = useState(20000);
  const [feeTeacher, setFeeTeacher] = useState(0);
  const [feeVolunteer, setFeeVolunteer] = useState(0);
  const [noticeImageUrl, setNoticeImageUrl] = useState('');
  const [noticeImageUrls, setNoticeImageUrls] = useState<string[]>([]);
  const [noticeImageCaption, setNoticeImageCaption] = useState('');
  const [attendanceDates, setAttendanceDates] = useState<{ date: string; label: string }[]>([]);
  const [newAttDate, setNewAttDate] = useState('');
  const [newAttLabel, setNewAttLabel] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [birthYearsInput, setBirthYearsInput] = useState('');
  const [activeDepartments, setActiveDepartments] = useState<string[]>(ALL_DEPARTMENTS);
  const [customConsentEnabled, setCustomConsentEnabled] = useState<boolean>(false);
  const [customConsentTitle, setCustomConsentTitle] = useState<string>('');
  const [customConsentContent, setCustomConsentContent] = useState<string>('');
  const [customConsentRequired, setCustomConsentRequired] = useState<boolean>(false);

  // 본부 관리자 비밀번호 변경 상태
  const [adminCurrentPw, setAdminCurrentPw] = useState('');
  const [adminNewPw, setAdminNewPw] = useState('');
  const [adminNewPwConfirm, setAdminNewPwConfirm] = useState('');

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!district) return;
    
    // 현재 세션 가져오기
    const sessStr = localStorage.getItem('evt_session');
    if (!sessStr) {
      alert('세션이 만료되었습니다. 다시 로그인해 주세요.');
      router.push(`/district/${districtSlug}/login`);
      return;
    }
    const sess = JSON.parse(sessStr);
    
    // DB의 본부 관리자 찾기
    const curAdmin = managers.find(m => m.login_id === sess.loginId && m.district_id === district.id);
    if (!curAdmin) {
      alert('관리자 계정 정보를 찾을 수 없습니다.');
      return;
    }

    if (!adminCurrentPw) {
      alert('현재 비밀번호를 입력해 주세요.');
      return;
    }
    if (!adminNewPw || adminNewPw.length < 4) {
      alert('새 비밀번호는 최소 4글자 이상이어야 합니다.');
      return;
    }
    if (adminNewPw !== adminNewPwConfirm) {
      alert('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    // 비밀번호 체크
    if (adminCurrentPw !== curAdmin.password_hash) {
      alert('현재 비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      db.updateManager(curAdmin.id, {
        password_hash: adminNewPw
      });
      alert('본부 관리자 비밀번호가 성공적으로 변경되었습니다.');
      setAdminCurrentPw('');
      setAdminNewPw('');
      setAdminNewPwConfirm('');
      loadAllData(district.id, event ? event.id : '');
    } catch (err: any) {
      alert(err.message || '비밀번호 변경 중 오류가 발생했습니다.');
    }
  };

  const handleFeeStudentChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setFeeStudent(clean === '' ? 0 : parseInt(clean, 10));
  };
  const handleFeeTeacherChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setFeeTeacher(clean === '' ? 0 : parseInt(clean, 10));
  };
  const handleFeeVolunteerChange = (val: string) => {
    const clean = val.replace(/[^0-9]/g, '');
    setFeeVolunteer(clean === '' ? 0 : parseInt(clean, 10));
  };

  const handleDateChange = (val: string) => {
    setNewAttDate(val);
    if (!val) {
      setNewAttLabel('');
      return;
    }
    try {
      const d = new Date(val);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = days[d.getDay()];
      const nextIndex = attendanceDates.length + 1;
      setNewAttLabel(`${nextIndex}일차 (${dayName})`);
    } catch (e) {
      // 무시
    }
  };

  // 로딩 시 설정 채우기 (event ID가 처음 세팅될 때, 또는 paymentSettings/options 최초 로딩 시 1회만 실행)
  useEffect(() => {
    if (event) {
      setEventName(event.name);
      setEventDesc(event.description);
      setRegStart(event.registration_start_date);
      setRegEnd(event.registration_end_date);
      setEditEnd(event.edit_deadline);
      setNoticeImageUrl(event.notice_image_url || '');
      setNoticeImageUrls(event.notice_image_urls || (event.notice_image_url ? [event.notice_image_url] : []));
      setNoticeImageCaption(event.notice_image_caption || '');
      setEventLocation(event.location || '');
      setCustomConsentEnabled(event.custom_consent_enabled || false);
      setCustomConsentTitle(event.custom_consent_title || '');
      setCustomConsentContent(event.custom_consent_content || '');
      setCustomConsentRequired(event.custom_consent_required || false);
    }
    if (paymentSettings) {
      setBankName(paymentSettings.bank_name);
      setAccNum(paymentSettings.account_number);
      setAccHolder(paymentSettings.account_holder);
      setBankMemo(paymentSettings.memo || '');
    }
    if (options.fees) {
      setFeeStudent(options.fees['학생'] || 0);
      setFeeTeacher(options.fees['교사'] || 0);
      setFeeVolunteer(options.fees['봉사자'] || 0);
    }
    if (options.attendanceDates) {
      setAttendanceDates(options.attendanceDates);
    }
    if (options.birthYears) {
      setBirthYearsInput(options.birthYears.join(', '));
    }
    if (options.departments && options.departments.length > 0) {
      setActiveDepartments(options.departments);
    } else {
      setActiveDepartments(ALL_DEPARTMENTS);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]); // event.id가 처음 로딩될 때만 1회 실행 (저장 후 event 객체 참조 변경 시 리셋 방지)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      // 1. 이미지 압축 (최대 800KB → 용량 절약, Firebase Storage 업로드)
      const MAX_SIZE = 800 * 1024; // 800KB

      const compressToBlob = (w: number, h: number, q: number): Promise<Blob> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (ev) => {
            const img = new Image();
            img.src = ev.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              if (width > height) {
                if (width > w) { height = Math.round((height * w) / width); width = w; }
              } else {
                if (height > h) { width = Math.round((width * h) / height); height = h; }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) { reject(new Error('Canvas 오류')); return; }
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Blob 변환 실패'));
              }, 'image/jpeg', q);
            };
            img.onerror = reject;
          };
          reader.onerror = reject;
        });
      };

      // 단계적으로 압축해 800KB 이하 달성
      let w = 1920, h = 1920, q = 0.85;
      let blob = await compressToBlob(w, h, q);
      for (let i = 0; i < 5 && blob.size > MAX_SIZE; i++) {
        w = Math.round(w * 0.8);
        h = Math.round(h * 0.8);
        q = Math.max(0.3, q - 0.1);
        blob = await compressToBlob(w, h, q);
      }

      // 2. Firebase Storage 업로드 → URL만 Firestore에 저장
      const eventId = event?.id || 'common';
      const fileName = `events/${eventId}/images/${Date.now()}.jpg`;
      const sRef = storageRef(storageFirebase, fileName);
      const snapshot = await uploadBytes(sRef, blob);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      setNoticeImageUrls(prev => [...prev, downloadUrl]);
    } catch (err) {
      console.error(err);
      alert('이미지 업로드 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!district) return;

    try {
      // 안전한 날짜 정렬 처리 (date 프로퍼티 누락 예방)
      const sortedDates = [...(attendanceDates || [])]
        .filter(d => d && typeof d.date === 'string')
        .sort((a, b) => a.date.localeCompare(b.date));
        
      const calculatedStart = sortedDates.length > 0 ? sortedDates[0].date : new Date().toISOString().substring(0, 10);
      const calculatedEnd = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1].date : new Date().toISOString().substring(0, 10);

      let targetEventId = '';
      // 안전한 출생년도 배열 변환
      const cleanBirthYears = (birthYearsInput || '')
        .split(',')
        .map(y => y.trim())
        .filter(y => y !== '');

      const eventOptions = {
        fees: {
          '학생': feeStudent || 0,
          '교사': feeTeacher || 0,
          '봉사자': feeVolunteer || 0
        },
        attendanceDates: attendanceDates || [],
        birthYears: cleanBirthYears,
        departments: activeDepartments || []
      };

      const representativeImage = noticeImageUrls.length > 0 ? noticeImageUrls[0] : '';
      if (event) {
        // 1. 기존 행사 업데이트
        db.updateEvent(event.id, {
          name: eventName || '',
          description: eventDesc || '',
          start_date: calculatedStart,
          end_date: calculatedEnd,
          registration_start_date: regStart || '',
          registration_end_date: regEnd || '',
          edit_deadline: editEnd || '',
          notice_image_url: representativeImage,
          notice_image_urls: noticeImageUrls || [],
          notice_image_caption: noticeImageCaption || '',
          location: eventLocation || '',
          options: eventOptions, // 단일 쓰기로 병합
          custom_consent_enabled: !!customConsentEnabled,
          custom_consent_title: customConsentTitle || '',
          custom_consent_content: customConsentContent || '',
          custom_consent_required: !!customConsentRequired
        });
        targetEventId = event.id;
      } else {
        // 행사가 아예 없던 경우 신규 개설
        const newEvt = db.createEvent({
          district_id: district.id,
          name: eventName || '',
          description: eventDesc || '',
          start_date: calculatedStart,
          end_date: calculatedEnd,
          registration_start_date: regStart || new Date().toISOString().substring(0, 10),
          registration_end_date: regEnd || new Date().toISOString().substring(0, 10),
          edit_deadline: editEnd || new Date().toISOString().substring(0, 10),
          is_active: true,
          notice_image_url: representativeImage,
          notice_image_urls: noticeImageUrls || [],
          notice_image_caption: noticeImageCaption || '',
          location: eventLocation || '',
          custom_consent_enabled: !!customConsentEnabled,
          custom_consent_title: customConsentTitle || '',
          custom_consent_content: customConsentContent || '',
          custom_consent_required: !!customConsentRequired
        });
        targetEventId = newEvt.id;
        setEvent(newEvt);
        // 신규 개설인 경우 options를 함께 생성
        db.updateEventOptions(targetEventId, eventOptions);
      }

      // 2. 본부 계좌 업데이트 (빈 값 및 null 예방)
      db.updatePaymentSettings({
        district_id: district.id,
        bank_name: bankName || '',
        account_number: accNum || '',
        account_holder: accHolder || '',
        memo: bankMemo || ''
      });

      alert('행사 설정이 성공적으로 저장되었습니다.');
      loadAllData(district.id, targetEventId);
    } catch (err: any) {
      console.error("Save settings failed with error:", err);
      alert(err.message || '저장 중 오류 발생');
    }
  };

  // ==========================================
  // TAB 2: 교회 및 담당자 가입 승인 로직
  // ==========================================
  const [newChurchName, setNewChurchName] = useState('');

  const handleAddChurch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChurchName.trim() || !district) return;
    try {
      db.createChurch(newChurchName.trim(), district.id);
      setNewChurchName('');
      loadAllData(district.id, event?.id || '');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApproveManager = async (manager: ChurchManager) => {
    if (!district) return;
    try {
      let finalChurchId = manager.church_id;
      
      // 신규 교회를 작성하여 신청한 건인 경우 (temp_new_church)
      if (manager.church_id === 'temp_new_church') {
        const churchName = manager.requested_church_name || '신청 교회';
        const newCh = db.createChurch(churchName.trim(), district.id);
        finalChurchId = newCh.id;
      }

      db.updateManager(manager.id, { 
        status: 'approved',
        church_id: finalChurchId,
        is_admin: manager.is_admin ?? false,
        is_manager: manager.is_manager ?? true
      });
      alert('승인 처리되었습니다.');
      loadAllData(district.id, event?.id || '');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectManager = async (id: string) => {
    if (!district) return;
    const ok = await showConfirm('담당자 반려', '이 담당자 신청을 반려(삭제)하시겠습니까?');
    if (ok) {
      db.deleteManager(id);
      loadAllData(district.id, event?.id || '');
    }
  };

  const handleToggleAdmin = (managerId: string, currentIsAdmin: boolean) => {
    if (!district) return;
    try {
      db.updateManager(managerId, { is_admin: !currentIsAdmin });
      alert('지방 관리자 권한이 변경되었습니다.');
      loadAllData(district.id, event?.id || '');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleManager = (managerId: string, currentIsManager: boolean) => {
    if (!district) return;
    try {
      const nextIsManager = !currentIsManager;
      db.updateManager(managerId, { 
        is_manager: nextIsManager,
        church_id: nextIsManager ? (churches.length > 0 ? churches[0].id : '') : ''
      });
      alert('교회 담당자 권한이 변경되었습니다.');
      loadAllData(district.id, event?.id || '');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateManagerChurch = (managerId: string, targetChurchId: string) => {
    if (!district) return;
    try {
      db.updateManager(managerId, { church_id: targetChurchId });
      alert('소속 교회가 변경되었습니다.');
      loadAllData(district.id, event?.id || '');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateManagerShirtSize = (managerId: string, size: string) => {
    if (!district) return;
    try {
      db.updateManager(managerId, { shirt_size: size });
      loadAllData(district.id, event?.id || '');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteManager = async (id: string, name: string) => {
    if (!district) return;
    const ok = await showConfirm('담당자 계정 삭제', `정말로 [${name}] 담당자 계정을 영구 삭제/탈퇴 처리하시겠습니까?`);
    if (ok) {
      db.deleteManager(id);
      alert('계정이 삭제되었습니다.');
      loadAllData(district.id, event?.id || '');
    }
  };

  const handleUpdatePaymentStatus = (churchId: string, status: '미납' | '확인 필요' | '납부완료', memo: string, paidAmount?: number) => {
    if (!district) return;
    db.updateChurchPaymentStatus(churchId, status, memo, district.id, paidAmount);
    loadAllData(district.id, event?.id || '');
    if (paidAmount === undefined) {
      alert('납부 상태가 변경되었습니다.');
    }
  };

  // 전체 교회 정산 일괄 재계산
  const handleRecalculateAll = async () => {
    if (!district || isRecalculating) return;
    const confirmed = await showConfirm(
      '전체 재정산',
      '모든 교회의 정산 금액을 참가자 수 기준으로 다시 계산합니다.\n계속하시겠습니까?'
    );
    if (!confirmed) return;

    setIsRecalculating(true);
    try {
      for (const church of churches) {
        db.recalculatePayment(church.id);
      }
      if (db.initForce) {
        await db.initForce();
      }
      loadAllData(district.id, event?.id || '');
      alert('전체 교회 정산 금액이 재계산되었습니다.');
    } catch (err) {
      console.error('전체 재정산 오류:', err);
      alert('재정산 중 오류가 발생했습니다.');
    } finally {
      setIsRecalculating(false);
    }
  };

  // 교회별 참가비 예외
  const [overrideChurchId, setOverrideChurchId] = useState('');
  const [overrideType, setOverrideType] = useState<'학생' | '교사' | '봉사자'>('학생');
  const [overrideFee, setOverrideFee] = useState(0);

  const handleAddOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideChurchId || !district) return;
    db.updateFeeOverride(overrideChurchId, overrideType, overrideFee, district.id);
    loadAllData(district.id, event?.id || '');
    setOverrideChurchId('');
    alert('참가비 예외 설정이 반영되었습니다.');
  };

  // ==========================================
  // TAB 3: 전체 등록자 관리 및 엑셀 다운로드
  // ==========================================
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilterChurch, setAdminFilterChurch] = useState('');
  const [adminFilterType, setAdminFilterType] = useState('');

  // 다중 정렬 상태 및 핸들러 (클릭 순서대로 정렬 우선순위 누적)
  type SortFieldType = 'name' | 'church' | 'type' | 'gender' | 'shirt_size';
  type SortKey = { field: SortFieldType; order: 'asc' | 'desc' };
  const [sortKeys, setSortKeys] = useState<SortKey[]>([]);

  const handleSort = (field: SortFieldType) => {
    setSortKeys(prev => {
      const existing = prev.find(k => k.field === field);
      const rest = prev.filter(k => k.field !== field);
      if (existing) {
        // 같은 필드 재클릭: 방향 토글 후 맨 앞으로
        return [{ field, order: existing.order === 'asc' ? 'desc' : 'asc' }, ...rest];
      } else {
        // 새 필드 클릭: 맨 앞에 추가 (기존 정렬 유지)
        return [{ field, order: 'asc' }, ...prev];
      }
    });
  };

  const renderSortIcon = (field: SortFieldType) => {
    const keyIndex = sortKeys.findIndex(k => k.field === field);
    if (keyIndex === -1) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40" />;
    }
    const key = sortKeys[keyIndex];
    return (
      <span className="inline-flex items-center gap-0.5">
        {key.order === 'asc'
          ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600 font-bold" />
          : <ChevronDown className="w-3.5 h-3.5 text-indigo-600 font-bold" />}
        {sortKeys.length > 1 && (
          <span className="text-[9px] font-bold text-indigo-500 leading-none">{keyIndex + 1}</span>
        )}
      </span>
    );
  };
  
  // 엑셀 열 선택 체크박스
  const [selectedExcelCols, setSelectedExcelCols] = useState<string[]>([
    '이름', '참가 유형', '성별', '부서/학년', '출생년도', '소속 교회', '보호자 이름', '보호자 연락처', '티셔츠 사이즈', '알레르기/건강상 주의사항', '참석 일정', '추가 동의 여부'
  ]);

  const toggleExcelCol = (colName: string) => {
    if (selectedExcelCols.includes(colName)) {
      setSelectedExcelCols(selectedExcelCols.filter(c => c !== colName));
    } else {
      setSelectedExcelCols([...selectedExcelCols, colName]);
    }
  };

  // 필터링된 전체 참가자 리스트
  const approvedChurchManagers = managers.filter(m => m.status === 'approved' && m.church_id && !m.is_admin);

  const mappedManagers: Participant[] = approvedChurchManagers.map(m => ({
    id: m.id,
    district_id: m.district_id,
    event_id: event?.id || '',
    church_id: m.church_id,
    participant_type: '교사',
    name: m.name,
    gender: '남',
    department: '교회담당자',
    birth_year: '',
    guardian_name: '',
    guardian_phone: '',
    personal_phone: m.phone,
    shirt_size: m.shirt_size || '미선택',
    photo_consent: true,
    attendance_schedule: [],
    edit_password_hash: '',
    memo: m.memo || '교회 담당자 가입 계정',
    created_at: m.created_at,
    updated_at: m.created_at
  }));

  const allParticipants = [...participants, ...mappedManagers];

  const filteredParticipants = allParticipants.filter(p => {
    const churchMap = new Map(churches.map(c => [c.id, c.name]));
    const churchName = churchMap.get(p.church_id) || '';

    const matchesSearch = p.name.includes(adminSearch) || churchName.includes(adminSearch);
    const matchesChurch = adminFilterChurch ? p.church_id === adminFilterChurch : true;
    const matchesType = adminFilterType ? p.participant_type === adminFilterType : true;

    return matchesSearch && matchesChurch && matchesType;
  });

  const getFieldValue = (p: Participant, field: SortFieldType): string => {
    if (field === 'name') return p.name || '';
    if (field === 'church') return churches.find(c => c.id === p.church_id)?.name || '';
    if (field === 'type') return `${p.participant_type || ''}_${p.department || ''}`;
    if (field === 'gender') return p.gender || '';
    if (field === 'shirt_size') return p.shirt_size || '';
    return '';
  };

  const sortedParticipants = [...filteredParticipants].sort((a, b) => {
    if (sortKeys.length === 0) return 0;

    for (const key of sortKeys) {
      const valA = getFieldValue(a, key.field);
      const valB = getFieldValue(b, key.field);

      if (valA < valB) return key.order === 'asc' ? -1 : 1;
      if (valA > valB) return key.order === 'asc' ? 1 : -1;
      // 같으면 다음 정렬 키로 넘어감
    }
    return 0;
  });

  // 엑셀 프리셋 다운로드 실행기
  const handleDownloadPreset = (presetName: string) => {
    if (presetName === 'all') {
      excelUtils.exportAllParticipants(filteredParticipants, churches, selectedExcelCols, `${district?.name}_전체_등록자_명단`);
    } else if (presetName === 'tshirt_summary') {
      excelUtils.exportTshirtSummary(allParticipants, churches, options.shirtSizes, `${district?.name}_교회별_티셔츠_사이즈_요약`);
    } else if (presetName === 'tshirt_detail') {
      excelUtils.exportTshirtDetails(allParticipants, churches, `${district?.name}_교회별_티셔츠_사이즈_상세`);
    } else if (presetName === 'payment') {
      excelUtils.exportPaymentStatus(churches, paymentStatuses, allParticipants, `${district?.name}_교회별_참가비_납부현황`);
    } else if (presetName === 'groups') {
      excelUtils.exportGroupMembers(allParticipants, churches, groups, groupingGroups, `${district?.name}_조별_명단`);
    } else if (presetName === 'health') {
      const healthList = allParticipants.filter(p => p.health_note && p.health_note.trim());
      const formatted = healthList.map(p => {
        const ch = churches.find(c => c.id === p.church_id);
        return {
          '이름': p.name,
          '소속 교회': ch?.name || '-',
          '참가 구분': p.participant_type,
          '부서/학년': p.department || '-',
          '주의사항': p.health_note
        };
      });
      excelUtils.exportRawData(formatted, `${district?.name}_알레르기_건강주의자_명단`);
    } else if (presetName === 'photo') {
      const photoList = participants.filter(p => !p.photo_consent);
      const formatted = photoList.map(p => {
        const ch = churches.find(c => c.id === p.church_id);
        return {
          '이름': p.name,
          '소속 교회': ch?.name || '-',
          '참가 구분': p.participant_type,
          '보호자 연락처': p.guardian_phone || p.personal_phone || '-'
        };
      });
      excelUtils.exportRawData(formatted, `${district?.name}_사진촬영_미동의자_명단`);
    }
  };

  // ==========================================
  // TAB 4: 조편성 관리 및 자동 조편성
  // ==========================================
  const [newGgName, setNewGgName] = useState('');
  const [selectedGgDeps, setSelectedGgDeps] = useState<string[]>([]);
  const [ggGroupCount, setGgGroupCount] = useState<number>(3);
  const [ggTargetSize, setGgTargetSize] = useState<number>(5);

  const [activeGgId, setActiveGgId] = useState<string | null>(null);

  // 자동 조편성 옵션들
  const [optGender, setOptGender] = useState(true);
  const [optChurch, setOptChurch] = useState(true);
  const [optRequest, setOptRequest] = useState(true);
  const [optAttendance, setOptAttendance] = useState(true);
  const [optTeacher, setOptTeacher] = useState(true);

  // 수동 이동 조 제어
  const [selectedMoveParticipantId, setSelectedMoveParticipantId] = useState<string>('');
  const [targetMoveGroupId, setTargetMoveGroupId] = useState<string>('');

  const handleCreateGroupingGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!district || !event) return;
    if (!newGgName.trim() || selectedGgDeps.length === 0) {
      alert('그룹 이름과 포함할 부서/학년을 선택해 주세요.');
      return;
    }

    try {
      db.createGroupingGroup({
        district_id: district.id,
        event_id: event.id,
        name: newGgName.trim(),
        included_departments: selectedGgDeps,
        group_count: ggGroupCount,
        target_group_size: ggTargetSize,
        balance_gender: optGender,
        distribute_church: optChurch,
        consider_same_group_request: optRequest,
        consider_attendance: optAttendance,
        assign_teachers: optTeacher
      });

      setNewGgName('');
      setSelectedGgDeps([]);
      loadAllData(district.id, event.id);
      alert('조편성 그룹이 생성되었습니다.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 자동 조편성 엔진 기동
  const handleRunAutoGrouping = (gg: GroupingGroup) => {
    if (!district || !event) return;
    // 1. 해당 그룹 산하에 실제 조(Group)들이 없으면 먼저 생성
    let currentGroups = groups.filter(g => g.grouping_group_id === gg.id);
    
    if (currentGroups.length === 0) {
      const list: Group[] = [];
      for (let i = 1; i <= gg.group_count; i++) {
        const newG = db.createGroup({
          district_id: district.id,
          event_id: event.id,
          grouping_group_id: gg.id,
          name: `${gg.name} ${i}조`,
          sort_order: i
        });
        list.push(newG);
      }
      currentGroups = list;
    }

    // 2. 알고리즘 가동
    const result = runAutoGrouping(gg, participants, requests, currentGroups);

    // 3. DB 적재
    Object.entries(result.assignments).forEach(([groupId, participantIds]) => {
      participantIds.forEach(pid => {
        db.assignParticipantToGroup(pid, groupId);
      });
    });

    loadAllData(district.id, event.id);
    alert('자동 조편성 초안 생성이 완료되었습니다!');
  };

  const handleManualMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!district || !event || !selectedMoveParticipantId) return;
    
    const gid = targetMoveGroupId === 'unassigned' ? null : targetMoveGroupId;
    db.assignParticipantToGroup(selectedMoveParticipantId, gid);
    
    // 초기화 및 로드
    setSelectedMoveParticipantId('');
    setTargetMoveGroupId('');
    loadAllData(district.id, event.id);
    alert('참가자 조배정이 수동 변경되었습니다.');
  };

  const handleDeleteGg = async (id: string) => {
    if (!district || !event) return;
    const ok = await showConfirm('조편성 그룹 삭제', '이 조편성 그룹과 소속 조원 배정을 모두 삭제하고 초기화하시겠습니까?');
    if (ok) {
      db.deleteGroupingGroup(id);
      loadAllData(district.id, event.id);
    }
  };

  if (!district) {
    return <div className="p-8 text-center text-slate-500 text-sm">인증 및 정보를 불러오는 중...</div>;
  }

  // 총계 요약 연산
  const totalApprovedManagersCount = managers.filter(m => m.status === 'approved' && m.church_id).length;
  const totalRegs = participants.length + totalApprovedManagersCount;
  const approvedManagers = managers.filter(m => m.status === 'approved');
  const approvedManagersCount = approvedManagers.length;
  const pendingManagers = managers.filter(m => m.status === 'pending');
  const totalExpectedAmount = paymentStatuses.reduce((acc, curr) => acc + curr.total_amount, 0);
  const paidChurchesCount = paymentStatuses.filter(s => s.status === '납부완료').length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* GNB */}
      <header className="bg-indigo-950 text-white px-6 py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4 shadow-md border-b border-indigo-900">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{district.name} 연합 본부 관리</h1>
            <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3 mt-0.5">
              <p className="text-[10px] text-indigo-300 font-medium">
                {event ? `활성 행사: ${event.name}` : '진행 중인 행사가 없습니다. 첫 행사를 등록해 주세요.'}
              </p>
              <div 
                onClick={() => {
                  const shareUrl = `${window.location.origin}/district/${districtSlug}`;
                  navigator.clipboard.writeText(shareUrl);
                  alert('참가 신청 주소가 클립보드에 복사되었습니다!\n학부모 및 개별 교회 담당자들에게 공유하세요.');
                }}
                className="flex items-center gap-1 bg-indigo-900/50 hover:bg-indigo-900 border border-indigo-800/80 px-2 py-0.5 rounded text-[9px] text-indigo-200 cursor-pointer transition-colors w-fit font-mono"
                title="클릭하면 참가 신청 주소가 복사됩니다"
              >
                <Copy className="w-2.5 h-2.5 text-indigo-400" />
                신청 주소 복사
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-between md:justify-end">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1 bg-indigo-900/50 hover:bg-indigo-900 border border-indigo-800 px-3 py-1.5 rounded-lg text-xs text-indigo-200 hover:text-white font-semibold transition-colors disabled:opacity-50"
            title="최신 데이터를 다시 불러옵니다"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? '불러오는 중...' : '새로고침'}
          </button>
          <span className="text-xs text-indigo-200 font-semibold bg-indigo-900/60 px-3 py-1.5 rounded-lg border border-indigo-800">
            총 {totalRegs}명 등록 접수됨
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-indigo-300 hover:text-white font-semibold transition-all-custom"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-4 overflow-x-auto">
        {(['settings', 'churches', 'participants', 'grouping'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-4 px-2 font-bold text-sm border-b-2 transition-all-custom whitespace-nowrap ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab === 'settings' && '행사 기본 설정'}
            {tab === 'churches' && '교회 & 납부 관리'}
            {tab === 'participants' && '전체 등록자 & 엑셀'}
            {tab === 'grouping' && '자동 조편성'}
          </button>
        ))}
      </div>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-6xl w-full mx-auto">

        {/* TAB 1: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 lg:col-span-2 flex flex-col gap-5">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-indigo-600" />
                행사 세부 설정 정보
              </h3>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600">행사명</label>
                <input
                  type="text"
                  value={eventName}
                  onChange={e => setEventName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring font-bold"
                  placeholder="예: 2026 연합 여름성경학교"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600">행사 상세 설명</label>
                <textarea
                  value={eventDesc}
                  onChange={e => setEventDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring h-20 resize-none"
                  placeholder="참가 등록화면에 노출될 행사 설명글입니다."
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600">행사 장소</label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={e => setEventLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring font-bold"
                  placeholder="예: 예수인교회 대예배실 (또는 외부 장소)"
                />
              </div>

              {/* 일차별 상세 참석 날짜 관리 */}
              <div className="flex flex-col gap-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold text-slate-800">세부 일차별 참석 날짜 구성</span>
                  <span className="text-[10px] text-slate-400">학부모가 신청할 때 선택할 수 있는 개별 참석 일자 목록입니다. 비연속적인 날짜도 자유롭게 추가할 수 있습니다.</span>
                </div>
                
                {/* 기존 목록 */}
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                  {attendanceDates.length > 0 ? (
                    attendanceDates.map((ad, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white border border-slate-150 rounded-lg px-3 py-2 text-xs">
                        <div className="flex gap-2">
                          <span className="font-extrabold text-indigo-600 shrink-0">{ad.label}</span>
                          <span className="text-slate-500 font-mono">{ad.date}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAttendanceDates(attendanceDates.filter((_, i) => i !== idx));
                          }}
                          className="text-[10px] text-rose-500 hover:text-rose-700 font-bold hover:underline"
                        >
                          삭제
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-400 italic py-2 text-center">등록된 세부 참석 날짜가 없습니다. 날짜를 추가해 주세요.</span>
                  )}
                </div>

                {/* 추가 폼 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500">날짜 선택</label>
                    <input
                      type="date"
                      value={newAttDate}
                      onChange={e => handleDateChange(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500">라벨 (예: 1일차, 8/8 토)</label>
                    <input
                      type="text"
                      value={newAttLabel}
                      placeholder="예: 3일차 (8/8 토)"
                      onChange={e => setNewAttLabel(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!newAttDate || !newAttLabel.trim()) {
                          alert('날짜와 라벨을 모두 입력해 주세요.');
                          return;
                        }
                        // 중복 검사
                        if (attendanceDates.some(ad => ad.date === newAttDate)) {
                          alert('이미 등록된 날짜입니다.');
                          return;
                        }
                        setAttendanceDates([...attendanceDates, { date: newAttDate, label: newAttLabel.trim() }]);
                        setNewAttDate('');
                        setNewAttLabel('');
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-1.5 rounded-lg text-xs"
                    >
                      일정 추가
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600">등록 시작일</label>
                  <input
                    type="date"
                    value={regStart}
                    onChange={e => setRegStart(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600">등록 마감일</label>
                  <input
                    type="date"
                    value={regEnd}
                    onChange={e => setRegEnd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600">등록 수정 마감일</label>
                  <input
                    type="date"
                    value={editEnd}
                    onChange={e => setEditEnd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 my-2"></div>

              {/* 가정통신문 안내 이미지 설정 */}
              <div className="flex flex-col gap-1">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <span>가정통신문(행사 안내) 다중 이미지 설정</span>
                </h4>
                <p className="text-[10px] text-slate-400">학부모 접수 화면에서 메인 포스터와 함께 옆으로 넘겨볼 수 있는 가정통신문, 시간표 등의 이미지를 여러 장 등록할 수 있습니다.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-600">안내 이미지 파일 업로드 (Base64 변환)</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 bg-slate-50 hover:bg-slate-100/50 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer relative group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <span className="text-xs text-slate-500 font-semibold group-hover:text-indigo-600 transition-colors">
                      클릭하거나 이미지 파일을 여기에 드래그앤드롭
                    </span>
                    <span className="text-[10px] text-slate-400">
                      최대 용량 5MB 이하 (5MB 초과 시 자동으로 압축되어 업로드됩니다)
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-600">외부 이미지 웹 주소 (URL) 직접 추가</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="custom_img_url_input"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring font-mono"
                      placeholder="https://example.com/image.jpg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('custom_img_url_input') as HTMLInputElement;
                        if (input && input.value.trim()) {
                          setNoticeImageUrls(prev => [...prev, input.value.trim()]);
                          input.value = '';
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 rounded-xl text-xs cursor-pointer"
                    >
                      추가
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-relaxed">
                    웹에 업로드된 외부 이미지 주소가 있는 경우, 주소를 입력한 후 [추가] 버튼을 눌러 등록해주세요.
                  </span>
                </div>
              </div>

              {/* 안내 이미지 하단 설명글 설정 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">안내 이미지 하단 설명글 (선택)</label>
                <input
                  type="text"
                  value={noticeImageCaption}
                  onChange={e => setNoticeImageCaption(e.target.value)}
                  placeholder="예: 클릭하면 가정통신문과 시간표도 볼 수 있습니다."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring font-bold"
                />
                <p className="text-[10px] text-slate-400">이미지 하단에 노출될 설명 문구입니다. (비워둘 시 기본값으로 노출됩니다)</p>
              </div>

              {noticeImageUrls.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                  <span className="text-xs font-bold text-slate-600">등록된 안내 이미지 목록 ({noticeImageUrls.length}장)</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {noticeImageUrls.map((url, index) => (
                      <div key={index} className="relative rounded-lg overflow-hidden border border-slate-200 bg-white p-1 flex flex-col gap-1.5 shadow-sm group">
                        <div className="h-28 flex items-center justify-center overflow-hidden bg-slate-50 rounded-md">
                          <img
                            src={url}
                            alt={`안내 이미지 ${index + 1}`}
                            className="max-h-full object-contain"
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] px-1 font-bold text-slate-500">
                          <span>{index === 0 ? '대표(포스터)' : `${index + 1}번 이미지`}</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => {
                                const newUrls = [...noticeImageUrls];
                                const temp = newUrls[index];
                                newUrls[index] = newUrls[index - 1];
                                newUrls[index - 1] = temp;
                                setNoticeImageUrls(newUrls);
                              }}
                              className="text-indigo-600 hover:text-indigo-850 disabled:opacity-30 cursor-pointer"
                              title="앞으로 이동"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={index === noticeImageUrls.length - 1}
                              onClick={() => {
                                const newUrls = [...noticeImageUrls];
                                const temp = newUrls[index];
                                newUrls[index] = newUrls[index + 1];
                                newUrls[index + 1] = temp;
                                setNoticeImageUrls(newUrls);
                              }}
                              className="text-indigo-600 hover:text-indigo-850 disabled:opacity-30 cursor-pointer"
                              title="뒤로 이동"
                            >
                              ▼
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNoticeImageUrls(noticeImageUrls.filter((_, idx) => idx !== index));
                              }}
                              className="text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 my-2"></div>

              {/* 본부 입금 계좌 */}
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">지방 연합회 수납 계좌 설정</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600">은행명</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring"
                    placeholder="예: 신한은행"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600">계좌번호</label>
                  <input
                    type="text"
                    value={accNum}
                    onChange={e => setAccNum(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring"
                    placeholder="예: 110-123-456789"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600">예금주</label>
                  <input
                    type="text"
                    value={accHolder}
                    onChange={e => setAccHolder(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring"
                    placeholder="예: 연합회본부"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600">안내 사항 (메모)</label>
                <input
                  type="text"
                  value={bankMemo}
                  onChange={e => setBankMemo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring"
                  placeholder="송금 안내 메모를 입력하세요 (예: 교회 이름으로 송금해 주세요)."
                />
              </div>

              <div className="border-t border-slate-200 my-2"></div>

              {/* 기본 참가비 */}
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">구분별 기본 참가비 금액 설정</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600">학생 참가비</label>
                  <input
                    type="text"
                    value={feeStudent.toString()}
                    onChange={e => handleFeeStudentChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring font-bold"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600">교사 참가비</label>
                  <input
                    type="text"
                    value={feeTeacher.toString()}
                    onChange={e => handleFeeTeacherChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring font-bold"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600">봉사자 참가비</label>
                  <input
                    type="text"
                    value={feeVolunteer.toString()}
                    onChange={e => handleFeeVolunteerChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">접수 부서 활성화 설정</h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveDepartments(ALL_DEPARTMENTS)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      전체 활성화
                    </button>
                    <span className="text-slate-300 text-[10px]">|</span>
                    <button
                      type="button"
                      onClick={() => setActiveDepartments([])}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                    >
                      전체 비활성화
                    </button>
                  </div>
                </div>
                
                {/* 영유아/유치부 */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">영유아·유치부</span>
                  <div className="flex flex-wrap gap-2">
                    {['유아부', '유치부'].map(d => {
                      const isActive = activeDepartments.includes(d);
                      return (
                        <label key={d} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all-custom ${
                          isActive 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100/50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setActiveDepartments(prev => [...prev, d]);
                              } else {
                                setActiveDepartments(prev => prev.filter(item => item !== d));
                              }
                            }}
                            className="hidden"
                          />
                          {d}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 초등부 */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-500">초등부</span>
                    <button
                      type="button"
                      onClick={() => {
                        const depts = ['초등 1학년', '초등 2학년', '초등 3학년', '초등 4학년', '초등 5학년', '초등 6학년'];
                        const hasAll = depts.every(item => activeDepartments.includes(item));
                        if (hasAll) {
                          setActiveDepartments(prev => prev.filter(item => !depts.includes(item)));
                        } else {
                          setActiveDepartments(prev => Array.from(new Set([...prev, ...depts])));
                        }
                      }}
                      className="text-[9px] font-bold text-indigo-500 hover:underline"
                    >
                      초등부 ON/OFF
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {['초등 1학년', '초등 2학년', '초등 3학년', '초등 4학년', '초등 5학년', '초등 6학년'].map(d => {
                      const isActive = activeDepartments.includes(d);
                      return (
                        <label key={d} className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all-custom ${
                          isActive 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100/50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setActiveDepartments(prev => [...prev, d]);
                              } else {
                                setActiveDepartments(prev => prev.filter(item => item !== d));
                              }
                            }}
                            className="hidden"
                          />
                          {d.replace('초등 ', '')}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 중등부 */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-500">중등부</span>
                    <button
                      type="button"
                      onClick={() => {
                        const depts = ['중등 1학년', '중등 2학년', '중등 3학년'];
                        const hasAll = depts.every(item => activeDepartments.includes(item));
                        if (hasAll) {
                          setActiveDepartments(prev => prev.filter(item => !depts.includes(item)));
                        } else {
                          setActiveDepartments(prev => Array.from(new Set([...prev, ...depts])));
                        }
                      }}
                      className="text-[9px] font-bold text-indigo-500 hover:underline"
                    >
                      중등부 ON/OFF
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {['중등 1학년', '중등 2학년', '중등 3학년'].map(d => {
                      const isActive = activeDepartments.includes(d);
                      return (
                        <label key={d} className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all-custom ${
                          isActive 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100/50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setActiveDepartments(prev => [...prev, d]);
                              } else {
                                setActiveDepartments(prev => prev.filter(item => item !== d));
                              }
                            }}
                            className="hidden"
                          />
                          {d}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 고등부 */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-500">고등부</span>
                    <button
                      type="button"
                      onClick={() => {
                        const depts = ['고등 1학년', '고등 2학년', '고등 3학년'];
                        const hasAll = depts.every(item => activeDepartments.includes(item));
                        if (hasAll) {
                          setActiveDepartments(prev => prev.filter(item => !depts.includes(item)));
                        } else {
                          setActiveDepartments(prev => Array.from(new Set([...prev, ...depts])));
                        }
                      }}
                      className="text-[9px] font-bold text-indigo-500 hover:underline"
                    >
                      고등부 ON/OFF
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {['고등 1학년', '고등 2학년', '고등 3학년'].map(d => {
                      const isActive = activeDepartments.includes(d);
                      return (
                        <label key={d} className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all-custom ${
                          isActive 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100/50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setActiveDepartments(prev => [...prev, d]);
                              } else {
                                setActiveDepartments(prev => prev.filter(item => item !== d));
                              }
                            }}
                            className="hidden"
                          />
                          {d}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-xs font-bold text-slate-600">유아, 유치부 출생년도 옵션 관리 (쉼표로 구분)</label>
                <input
                  type="text"
                  value={birthYearsInput}
                  onChange={e => setBirthYearsInput(e.target.value)}
                  placeholder="예: 2020년, 2021년, 2022년, 2023년, 2024년"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring font-bold"
                />
                <p className="text-[10px] text-slate-400">신청서와 수정 신청서의 유아부/유치부 출생년도 항목에 노출될 옵션 목록입니다. 쉼표(,)로 구분하여 연도 순서대로 입력해주세요.</p>
              </div>

              <div className="border-t border-slate-200 my-2"></div>

              {/* 커스텀 추가 동의서 설정 */}
              <div className="flex flex-col gap-3 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>행사 추가 동의서 설정 (선택 사항)</span>
                  </h4>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={customConsentEnabled}
                      onChange={e => setCustomConsentEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="ml-2 text-xs font-bold text-slate-600">사용함</span>
                  </label>
                </div>
                
                {customConsentEnabled && (
                  <div className="flex flex-col gap-3.5 pt-1">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-600">동의서 제목</label>
                      <input
                        type="text"
                        value={customConsentTitle}
                        onChange={e => setCustomConsentTitle(e.target.value)}
                        placeholder="예: 물품 기증 및 참가 동의서"
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring font-bold"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-600">동의서 상세 약관 내용</label>
                      <textarea
                        rows={3}
                        value={customConsentContent}
                        onChange={e => setCustomConsentContent(e.target.value)}
                        placeholder="동의서 내용을 상세하게 입력해 주세요."
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring resize-y font-medium"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="customConsentRequired"
                        checked={customConsentRequired}
                        onChange={e => setCustomConsentRequired(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <label htmlFor="customConsentRequired" className="text-xs text-slate-600 leading-normal cursor-pointer select-none font-bold">
                        필수 동의 항목으로 설정 (체크하지 않으면 신청 불가)
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all-custom text-xs shadow-md flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                모든 설정 저장하기
              </button>
            </form>

            {/* 통계 사이드바 */}
            <div className="flex flex-col gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col gap-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1">
                  <ClipboardList className="w-4 h-4 text-indigo-600" />
                  전체 현황 요약
                </h3>
                <div className="grid grid-cols-2 gap-3 text-center text-xs">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">전체 등록 인원</span>
                    <span className="text-lg font-black text-slate-800 mt-0.5 block">{totalRegs}명</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">참여 교회 수</span>
                    <span className="text-lg font-black text-slate-800 mt-0.5 block">{churches.length}개</span>
                  </div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-center">
                  <span className="text-[10px] text-indigo-700 block font-semibold">총 예상 수납액</span>
                  <span className="text-xl font-black text-indigo-950 mt-1 block">
                    {totalExpectedAmount.toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>

            {/* 본부 관리자 비밀번호 변경 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col gap-4 mt-6">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <ShieldCheck className="w-4 h-4 text-rose-500" />
                지방회 본부 관리자 비밀번호 변경
              </h3>
              
              <form onSubmit={handleChangeAdminPassword} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-semibold">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600">현재 비밀번호</label>
                    <input
                      type="password"
                      value={adminCurrentPw}
                      onChange={e => setAdminCurrentPw(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring font-bold"
                      placeholder="현재 비밀번호 입력"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600">새 비밀번호</label>
                    <input
                      type="password"
                      value={adminNewPw}
                      onChange={e => setAdminNewPw(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring font-bold"
                      placeholder="새 비밀번호 (4자 이상)"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600">새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={adminNewPwConfirm}
                      onChange={e => setAdminNewPwConfirm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring font-bold"
                      placeholder="새 비밀번호 확인 입력"
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition-all-custom text-xs shadow-md flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  본부 관리자 비밀번호 변경하기
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: CHURCHES & PAYMENTS */}
        {activeTab === 'churches' && (
          <div className="flex flex-col gap-6">
            
            {/* 1. 교회 담당자 가입 대기 신청 목록 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col gap-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                {district.name} 교회 담당자 가입 승인 대기 목록
                {pendingManagers.length > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {pendingManagers.length}건
                  </span>
                )}
              </h3>
              
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="p-3 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[90px]">신청자명</th>
                      <th className="p-3">신청 교회</th>
                      <th className="p-3">연락처</th>
                      <th className="p-3">티셔츠</th>
                      <th className="p-3">비고 / 신청 메모</th>
                      <th className="p-3 text-center">동작</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {pendingManagers.length > 0 ? (
                      pendingManagers.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/50 group">
                          <td className="p-3 font-semibold text-slate-900 sticky left-0 bg-white group-hover:bg-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[90px]">{m.name}</td>
                          <td className="p-3 font-semibold text-indigo-600">
                            {m.church_id === 'temp_new_church' ? '신규등록요청' : (churches.find(c => c.id === m.church_id)?.name || '-')}
                          </td>
                          <td className="p-3">{m.phone}</td>
                          <td className="p-3">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[10px]">
                              {m.shirt_size || '-'}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">{m.memo || '-'}</td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleApproveManager(m)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px]"
                              >
                                승인
                              </button>
                              <button
                                onClick={() => handleRejectManager(m.id)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold py-1.5 px-3 rounded-lg text-[10px] border border-rose-200"
                              >
                                반려
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400">승인 대기 중인 신청이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 1-2. 가입 완료된 담당자 및 관리자 목록 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col gap-4 mt-6">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                지방회/교회 담당자 회원 목록
                {approvedManagers.length > 0 && (
                  <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {approvedManagers.length}명
                  </span>
                )}
              </h3>
              
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="p-3 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[90px]">이름</th>
                      <th className="p-3">연락처</th>
                      <th className="p-3">티셔츠 사이즈</th>
                      <th className="p-3 text-center">권한 및 가입 제어</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {approvedManagers.length > 0 ? (
                      approvedManagers.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/50 group">
                          <td className="p-3 font-semibold text-slate-900 sticky left-0 bg-white group-hover:bg-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[90px]">
                            {(m.is_admin ?? (m.church_id === '')) ? '지방회 관리자' : m.name}
                          </td>
                          <td className="p-3">
                            {(m.is_admin ?? (m.church_id === '')) ? '-' : m.phone}
                          </td>
                          <td className="p-3">
                            {(m.is_admin ?? (m.church_id === '')) ? (
                              <span className="text-slate-400 text-[10px]">-</span>
                            ) : (
                              <select
                                value={m.shirt_size || ''}
                                onChange={(e) => handleUpdateManagerShirtSize(m.id, e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                              >
                                <option value="">-미선택-</option>
                                {options.shirtSizes.map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center items-center gap-2 flex-wrap">

                              {/* 소속 교회 변경 Dropdown */}
                              {(m.is_manager ?? (m.church_id !== '')) && (
                                <select
                                  value={m.church_id}
                                  onChange={(e) => handleUpdateManagerChurch(m.id, e.target.value)}
                                  className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                                >
                                  <option value="">-- 소속 교회 선택 --</option>
                                  {churches.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              )}

                              {!(m.is_admin ?? (m.church_id === '')) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteManager(m.id, m.name)}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold py-1 px-2.5 rounded border border-rose-200 text-[10px] transition-all-custom ml-2"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400">등록된 회원 담당자가 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. 교회 목록 & 납부 현황 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* 교회 목록 추가 / 편집 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col gap-4">
                <h3 className="font-bold text-slate-800 text-sm">참여 교회 생성</h3>
                <form onSubmit={handleAddChurch} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="신규 교회명 입력"
                    value={newChurchName}
                    onChange={e => setNewChurchName(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    추가
                  </button>
                </form>

                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mt-2">
                  {churches.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <span className="font-semibold text-slate-800">{c.name}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={async () => {
                            const newName = await showPrompt('교회명 수정', '새로운 교회명을 입력하세요', c.name);
                            if (newName && newName.trim() && newName.trim() !== c.name) {
                              try {
                                db.updateChurch(c.id, { name: newName.trim() });
                                loadAllData(district.id, event?.id || '');
                                alert('교회명이 수정되었습니다.');
                              } catch (err: any) {
                                alert(err.message);
                              }
                            }
                          }}
                          className="text-indigo-600 hover:text-indigo-800 p-1 transition-all-custom"
                          title="교회명 수정"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('이 교회를 삭제하시겠습니까? 등록된 해당 교회 참가자 및 조원 정보가 모두 삭제될 수 있습니다.')) {
                              db.deleteChurch(c.id);
                              loadAllData(district.id, event?.id || '');
                            }
                          }}
                          className="text-rose-500 hover:text-rose-700 p-1 transition-all-custom"
                          title="교회 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 교회별 참가비 정산 및 납부 상태 변경 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 lg:col-span-2 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm">교회별 정산 및 납부 관리</h3>
                  <button
                    onClick={handleRecalculateAll}
                    disabled={isRecalculating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all-custom disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                    {isRecalculating ? '재계산 중...' : '전체 재정산'}
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="p-3 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">교회명</th>
                        <th className="p-3">인원수</th>
                        <th className="p-3">정산 금액</th>
                        <th className="p-3">납부 상태</th>
                        <th className="p-3">상태 변경</th>
                        <th className="p-3">실 납부 금액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {churches.map(church => {
                        const statusRecord = paymentStatuses.find(s => s.church_id === church.id);
                        const approvedManagersCount = managers.filter(m => m.church_id === church.id && m.status === 'approved').length;
                        const churchRegsCount = participants.filter(p => p.church_id === church.id).length + approvedManagersCount;
                        return (
                          <tr key={church.id} className="hover:bg-slate-50/50 group">
                            <td className="p-3 font-semibold text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{church.name}</td>
                            <td className="p-3 font-bold">{churchRegsCount}명</td>
                            <td className="p-3 font-semibold text-indigo-600">
                              {(statusRecord?.total_amount || 0).toLocaleString()}원
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                statusRecord?.status === '납부완료' ? 'bg-emerald-50 text-emerald-700' :
                                statusRecord?.status === '확인 필요' ? 'bg-yellow-50 text-yellow-700' :
                                'bg-slate-100 text-slate-500'
                              }`}>
                                {statusRecord?.status || '미납'}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                {(['미납', '확인 필요', '납부완료'] as const).map(st => (
                                  <button
                                    key={st}
                                    onClick={() => handleUpdatePaymentStatus(church.id, st, statusRecord?.memo || '')}
                                    className={`px-1.5 py-1 text-[9px] font-bold rounded transition-all-custom ${
                                      statusRecord?.status === st 
                                        ? 'bg-slate-800 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="p-3 flex items-center">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={
                                  tempPaidAmounts[church.id] !== undefined
                                    ? tempPaidAmounts[church.id]
                                    : (statusRecord?.paid_amount ?? 0).toString()
                                }
                                onChange={(e) => {
                                  const val = e.target.value.replace(/[^0-9]/g, '');
                                  setTempPaidAmounts(prev => ({ ...prev, [church.id]: val }));
                                }}
                                onBlur={() => {
                                  const rawVal = tempPaidAmounts[church.id];
                                  if (rawVal !== undefined) {
                                    const val = parseInt(rawVal, 10) || 0;
                                    handleUpdatePaymentStatus(church.id, statusRecord?.status || '미납', statusRecord?.memo || '', val);
                                    setTempPaidAmounts(prev => {
                                      const copy = { ...prev };
                                      delete copy[church.id];
                                      return copy;
                                    });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-24 px-2 py-1 text-xs border border-slate-200 rounded text-right focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                              />
                              <span className="ml-1 text-slate-500 font-semibold">원</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* 3. 교회별 참가비 예외 설정 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col gap-4">
              <h3 className="font-bold text-slate-800 text-sm">교회별 참가비 예외 설정</h3>
              <form onSubmit={handleAddOverride} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={overrideChurchId}
                  onChange={e => setOverrideChurchId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                >
                  <option value="">교회 선택</option>
                  {churches.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={overrideType}
                  onChange={e => setOverrideType(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                >
                  <option value="학생">학생</option>
                  <option value="교사">교사</option>
                  <option value="봉사자">봉사자</option>
                </select>
                <input
                  type="number"
                  placeholder="예외 참가비 (원)"
                  value={overrideFee}
                  onChange={e => setOverrideFee(parseInt(e.target.value) || 0)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition-all-custom flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  예외 추가/변경
                </button>
              </form>

              {/* 예외 목록 */}
              <div className="flex flex-wrap gap-2 mt-2">
                {feeOverrides.map(fo => {
                  const ch = churches.find(c => c.id === fo.church_id);
                  return (
                    <div key={fo.id} className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-700 flex items-center gap-2">
                      <span>{ch?.name || '-'}: {fo.participant_type} → {fo.fee.toLocaleString()}원</span>
                      <button
                        onClick={() => {
                          db.updateFeeOverride(fo.church_id, fo.participant_type, options.fees[fo.participant_type], district.id);
                          loadAllData(district.id, event?.id || '');
                        }}
                        className="text-rose-500 hover:text-rose-700 font-bold"
                      >
                        x
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: ALL PARTICIPANTS & EXCEL */}
        {activeTab === 'participants' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
            
            {/* Header */}
            <div>
              <h3 className="font-bold text-slate-800 text-sm">전체 등록자 조회 및 엑셀 추출</h3>
              <p className="text-xs text-slate-500 mt-0.5">전체 참여자의 상세 정보를 보고, 선택된 필드로 커스텀 엑셀 또는 프리셋을 출력할 수 있습니다.</p>
            </div>

            {/* Excel Columns Selector */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2.5">
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">엑셀 출력 컬럼 커스텀 선택</h4>
              <div className="flex flex-wrap gap-2">
                {[
                  '이름', '참가 유형', '성별', '부서/학년', '출생년도', '소속 교회', '보호자 이름', '보호자 연락처', '티셔츠 사이즈', '알레르기/건강상 주의사항', '참석 일정', '추가 동의 여부', '비고'
                ].map(col => {
                  const isChecked = selectedExcelCols.includes(col);
                  return (
                    <label key={col} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all-custom ${
                      isChecked ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'
                    }`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleExcelCol(col)}
                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      {col}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => handleDownloadPreset('all')}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all-custom shadow-md shadow-slate-100"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                커스텀 필터 다운로드
              </button>
              <button
                onClick={() => handleDownloadPreset('tshirt_summary')}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all-custom"
              >
                티셔츠 요약 다운로드
              </button>
              <button
                onClick={() => handleDownloadPreset('tshirt_detail')}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all-custom"
              >
                티셔츠 상세 다운로드
              </button>
              <button
                onClick={() => handleDownloadPreset('payment')}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all-custom"
              >
                납부 현황 다운로드
              </button>
              <button
                onClick={() => handleDownloadPreset('groups')}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all-custom"
              >
                조별 명단 다운로드
              </button>
              <button
                onClick={() => handleDownloadPreset('health')}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all-custom"
              >
                건강 특이사항 명단
              </button>
              <button
                onClick={() => handleDownloadPreset('photo')}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-3.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all-custom"
              >
                사진 촬영 미동의자 명단
              </button>
            </div>

            {/* Filter Area */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <input
                  type="text"
                  placeholder="이름 또는 교회명 검색"
                  value={adminSearch}
                  onChange={e => setAdminSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                />
              </div>
              <select
                value={adminFilterChurch}
                onChange={e => setAdminFilterChurch(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
              >
                <option value="">교회 전체</option>
                {churches.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={adminFilterType}
                onChange={e => setAdminFilterType(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
              >
                <option value="">참가 구분 전체</option>
                <option value="학생">학생</option>
                <option value="교사">교사</option>
                <option value="봉사자">봉사자</option>
              </select>
            </div>

            {/* Participants Count */}
            <p className="text-xs text-slate-500 font-semibold">
              조회 필터 결과: <span className="text-indigo-600 font-bold">{filteredParticipants.length}명</span>
            </p>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th 
                      onClick={() => handleSort('name')} 
                      className="p-3 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        참가자명
                        {renderSortIcon('name')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('church')} 
                      className="p-3 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        소속 교회
                        {renderSortIcon('church')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('type')} 
                      className="p-3 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        구분 / 부서
                        {renderSortIcon('type')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('gender')} 
                      className="p-3 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        성별
                        {renderSortIcon('gender')}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('shirt_size')} 
                      className="p-3 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        셔츠
                        {renderSortIcon('shirt_size')}
                      </div>
                    </th>
                    <th className="p-3">연락처 / 보호자</th>
                    <th className="p-3">동작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sortedParticipants.length > 0 ? (
                    sortedParticipants.map(p => {
                      const ch = churches.find(c => c.id === p.church_id);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 group">
                          <td className="p-3 font-semibold text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{p.name}</td>
                          <td className="p-3 font-semibold text-indigo-600">{ch?.name || '-'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold mr-1 ${
                              p.participant_type === '학생' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {p.participant_type}
                            </span>
                            {p.department || '-'}
                          </td>
                          <td className="p-3">{p.gender}</td>
                          <td className="p-3">{p.shirt_size}</td>
                          <td className="p-3">
                            {p.participant_type === '학생' ? `${p.guardian_name} (${p.guardian_phone})` : p.personal_phone}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => {
                                if (p.department === '교회담당자') {
                                  handleDeleteManager(p.id, p.name);
                                } else {
                                  if (confirm('이 참가자를 삭제하시겠습니까?')) {
                                    db.deleteParticipant(p.id);
                                    loadAllData(district.id, event?.id || '');
                                  }
                                }
                              }}
                              className="text-rose-600 hover:underline cursor-pointer"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-slate-400">데이터가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* TAB 4: GROUPING */}
        {activeTab === 'grouping' && (
          <div className="flex flex-col gap-6">
            
            {/* 1. 조편성 그룹 생성 폼 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col gap-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Grid className="w-4 h-4 text-indigo-600" />
                새 조편성 그룹 생성
              </h3>
              
              <form onSubmit={handleCreateGroupingGroup} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">그룹명 (예: 유치부)</label>
                  <input
                    type="text"
                    value={newGgName}
                    onChange={e => setNewGgName(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                    placeholder="예: 초등 저학년"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">조 개수</label>
                  <input
                    type="number"
                    value={ggGroupCount}
                    onChange={e => setGgGroupCount(parseInt(e.target.value) || 3)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">조당 인원 수</label>
                  <input
                    type="number"
                    value={ggTargetSize}
                    onChange={e => setGgTargetSize(parseInt(e.target.value) || 5)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring font-bold"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all-custom flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    그룹 추가
                  </button>
                </div>

                {/* 포함할 부서 학년 선택 */}
                <div className="md:col-span-4 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">포함할 부서 / 학년 선택</label>
                  <div className="flex flex-wrap gap-1.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    {options.departments.map(d => {
                      const isChecked = selectedGgDeps.includes(d);
                      return (
                        <button
                          type="button"
                          key={d}
                          onClick={() => {
                            if (isChecked) {
                              setSelectedGgDeps(selectedGgDeps.filter(x => x !== d));
                            } else {
                              setSelectedGgDeps([...selectedGgDeps, d]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all-custom border ${
                            isChecked 
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 조편성 제약 조건 */}
                <div className="md:col-span-4 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">알고리즘 배정 제약 사항</label>
                  <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-600">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={optGender} onChange={e => setOptGender(e.target.checked)} className="rounded" />
                      성별 균형 적용
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={optChurch} onChange={e => setOptChurch(e.target.checked)} className="rounded" />
                      교회 분산 적용
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={optRequest} onChange={e => setOptRequest(e.target.checked)} className="rounded" />
                      같은 조 요청 반영
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={optAttendance} onChange={e => setOptAttendance(e.target.checked)} className="rounded" />
                      참석 일정 반영
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={optTeacher} onChange={e => setOptTeacher(e.target.checked)} className="rounded" />
                      교사/봉사자 각 조 배정
                    </label>
                  </div>
                </div>
              </form>
            </div>

            {/* 2. 조편성 그룹 리스트 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* 왼쪽: 그룹 목록 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col gap-4">
                <h3 className="font-bold text-slate-800 text-sm">조편성 그룹 목록</h3>
                <div className="flex flex-col gap-3">
                  {groupingGroups.length > 0 ? (
                    groupingGroups.map(gg => (
                      <div
                        key={gg.id}
                        onClick={() => setActiveGgId(gg.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all-custom flex flex-col gap-2 ${
                          activeGgId === gg.id
                            ? 'bg-indigo-50/50 border-indigo-500'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900">{gg.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGg(gg.id);
                              if (activeGgId === gg.id) setActiveGgId(null);
                            }}
                            className="text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          부서: {gg.included_departments.join(', ')}
                        </p>
                        <div className="flex justify-between items-center mt-1.5">
                          <span className="text-[10px] text-slate-400">설정 조 개수: {gg.group_count}개</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRunAutoGrouping(gg);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded-lg text-[9px] transition-all-custom"
                          >
                            자동 조편성 기동
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-xs text-slate-400 py-6">생성된 조편성 그룹이 없습니다.</p>
                  )}
                </div>
              </div>

              {/* 오른쪽: 활성 그룹의 조편성 결과 조회 & 수동 변경 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 lg:col-span-2 flex flex-col gap-4">
                <h3 className="font-bold text-slate-800 text-sm">
                  {activeGgId 
                    ? `[${groupingGroups.find(x=>x.id===activeGgId)?.name}] 조편성 명단 & 수동 조정` 
                    : '왼쪽에서 조편성 그룹을 선택해 주세요.'
                  }
                </h3>

                {activeGgId && (
                  <>
                    {/* 수동 이동 도구 */}
                    <form onSubmit={handleManualMove} className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <select
                        value={selectedMoveParticipantId}
                        onChange={e => setSelectedMoveParticipantId(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs input-focus-ring"
                      >
                        <option value="">이동할 참가자 선택</option>
                        {participants
                          .filter(p => {
                            const gg = groupingGroups.find(x => x.id === activeGgId);
                            if (!gg) return false;
                            
                            const isStudentMatch = p.participant_type === '학생' && p.department && gg.included_departments.includes(p.department);
                            const isTeacherMatch = gg.assign_teachers && (p.participant_type === '교사' || p.participant_type === '봉사자') && (!p.department || gg.included_departments.includes(p.department));
                            
                            return isStudentMatch || isTeacherMatch;
                          })
                          .map(p => {
                            const currentGid = p.assigned_group_id;
                            const currentGName = groups.find(g => g.id === currentGid)?.name || '미배정';
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.participant_type} - {currentGName})
                              </option>
                            );
                          })
                        }
                      </select>

                      <select
                        value={targetMoveGroupId}
                        onChange={e => setTargetMoveGroupId(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs input-focus-ring"
                      >
                        <option value="">배정할 조 선택</option>
                        <option value="unassigned">미배정 상태로 변경</option>
                        {groups.filter(g => g.grouping_group_id === activeGgId).map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>

                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-all-custom"
                      >
                        배정 변경 실행
                      </button>
                    </form>

                    {/* 조별 구성원 표시 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      {groups
                        .filter(g => g.grouping_group_id === activeGgId)
                        .map(group => {
                          const members = participants.filter(p => p.assigned_group_id === group.id);
                          const churchMap = new Map(churches.map(c => [c.id, c.name]));
                          return (
                            <div key={group.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col gap-2">
                              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                <span className="font-black text-slate-800 text-xs">{group.name}</span>
                                <span className="text-[10px] text-slate-400 font-bold">{members.length}명 배정됨</span>
                              </div>
                              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto mt-1">
                                {members.map(m => (
                                  <div key={m.id} className="flex justify-between items-center text-[10px] bg-white border border-slate-100 p-2 rounded-lg">
                                    <span className="font-bold text-slate-900">
                                      {m.name} ({m.gender})
                                      <span className="text-[8px] text-slate-400 ml-1">
                                        {m.participant_type === '학생' ? m.department : m.participant_type}
                                      </span>
                                    </span>
                                    <span className="text-indigo-600 font-semibold">{churchMap.get(m.church_id) || '-'}</span>
                                  </div>
                                ))}
                                {members.length === 0 && (
                                  <span className="text-[10px] text-slate-400 italic text-center py-4">조원이 없습니다.</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>

                    {/* 미배정 인원들 */}
                    <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 mt-2">
                      <h4 className="font-bold text-xs text-rose-800 flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        미배정 참가자 명단
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {participants
                          .filter(p => {
                            const gg = groupingGroups.find(x => x.id === activeGgId);
                            if (!gg) return false;
                            
                            const isStudentMatch = p.participant_type === '학생' && p.department && gg.included_departments.includes(p.department);
                            const isTeacherMatch = gg.assign_teachers && (p.participant_type === '교사' || p.participant_type === '봉사자') && (!p.department || gg.included_departments.includes(p.department));
                            
                            return (isStudentMatch || isTeacherMatch) && !p.assigned_group_id;
                          })
                          .map(p => (
                            <span
                              key={p.id}
                              onClick={() => {
                                setSelectedMoveParticipantId(p.id);
                                alert(`${p.name} 아동이 선택되었습니다. 위의 '배정할 조 선택' 박스를 통해 조를 배정해 주세요.`);
                              }}
                              className="bg-white hover:bg-rose-50 cursor-pointer border border-rose-200 text-rose-700 font-semibold px-2.5 py-1.5 rounded-lg text-[10px] transition-all-custom flex items-center gap-1 shadow-sm"
                            >
                              {p.name} ({p.gender === '남' ? '남' : '여'})
                            </span>
                          ))
                        }
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
          </div>
        )}
      </main>

      {/* 커스텀 확인/입력 모달 */}
      {customModal && customModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-100 flex flex-col gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">{customModal.title}</h3>
              <p className="text-xs text-slate-500 mt-2 whitespace-pre-line leading-relaxed">{customModal.message}</p>
            </div>
            
            {customModal.type === 'prompt' && (
              <input
                id="custom-modal-input"
                type="text"
                defaultValue={customModal.defaultValue}
                placeholder={customModal.placeholder}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-600 focus:bg-white input-focus-ring"
              />
            )}
            
            {customModal.type === 'select' && (
              <select
                id="custom-modal-select"
                defaultValue={customModal.defaultValue}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-600 focus:bg-white input-focus-ring"
              >
                {customModal.options?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
            
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={customModal.onCancel}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200 transition-all-custom"
              >
                취소
              </button>
              <button
                onClick={() => {
                  let val = undefined;
                  if (customModal.type === 'prompt') {
                    val = (document.getElementById('custom-modal-input') as HTMLInputElement)?.value;
                  } else if (customModal.type === 'select') {
                    val = (document.getElementById('custom-modal-select') as HTMLSelectElement)?.value;
                  }
                  customModal.onConfirm(val);
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all-custom"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
