'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/services/db';
import { excelUtils } from '@/utils/excel';
import { runAutoGrouping } from '@/utils/grouping';
import { 
  Event, Church, ChurchManager, Participant, SameGroupRequest,
  GroupingGroup, Group, GroupMember, PaymentSettings, ChurchFeeOverride, ChurchPaymentStatus 
} from '@/types';
import { 
  Settings, Users, ShieldCheck, UserCheck, Download, Grid, Plus, Trash2, 
  Save, AlertTriangle, CheckCircle, ClipboardList, Info, FileSpreadsheet,
  ArrowRight, ShieldAlert, Edit, LogOut
} from 'lucide-react';

const ALL_DEPARTMENTS = [
  '유아부', '유치부',
  '초등 1학년', '초등 2학년', '초등 3학년', '초등 4학년', '초등 5학년', '초등 6학년',
  '중등 1학년', '중등 2학년', '중등 3학년',
  '고등 1학년', '고등 2학년', '고등 3학년'
];

export default function AdminDashboard() {
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);

  // 인증
  useEffect(() => {
    const sessStr = localStorage.getItem('evt_session');
    if (!sessStr) {
      router.push('/login');
      return;
    }
    const sess = JSON.parse(sessStr);
    if (sess.role !== 'admin') {
      router.push('/login');
      return;
    }

    const active = db.getActiveEvent();
    if (active) {
      setEvent(active);
      loadAllData(active.id);
    }
  }, [router]);

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

  // 탭 제어
  const [activeTab, setActiveTab] = useState<'settings' | 'churches' | 'participants' | 'grouping'>('settings');

  const loadAllData = (eventId: string) => {
    setChurches(db.getChurches());
    setManagers(db.getManagers());
    setParticipants(db.getParticipants());
    setRequests(db.getSameGroupRequests());
    setPaymentSettings(db.getPaymentSettings() || null);
    setPaymentStatuses(db.getChurchPaymentStatuses());
    setFeeOverrides(db.getFeeOverrides());
    setGroupingGroups(db.getGroupingGroups());
    setGroups(db.getGroups());
    setOptions(db.getEventOptions(eventId));
  };

  const handleLogout = () => {
    localStorage.removeItem('evt_session');
    router.push('/login');
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
  const [birthYearsInput, setBirthYearsInput] = useState('');
  const [activeDepartments, setActiveDepartments] = useState<string[]>(ALL_DEPARTMENTS);

  // 로딩 시 설정 채우기
  useEffect(() => {
    if (event) {
      setEventName(event.name);
      setEventDesc(event.description);
      setRegStart(event.registration_start_date);
      setRegEnd(event.registration_end_date);
      setEditEnd(event.edit_deadline);
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
    if (options.birthYears) {
      setBirthYearsInput(options.birthYears.join(', '));
    }
    if (options.departments && options.departments.length > 0) {
      setActiveDepartments(options.departments);
    } else {
      setActiveDepartments(ALL_DEPARTMENTS);
    }
  }, [event, paymentSettings, options]);

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

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    try {
      // 1. 기본 행사 업데이트
      db.updateEvent(event.id, {
        name: eventName,
        description: eventDesc,
        registration_start_date: regStart,
        registration_end_date: regEnd,
        edit_deadline: editEnd
      });

      // 2. 본부 계좌 업데이트
      db.updatePaymentSettings({
        bank_name: bankName,
        account_number: accNum,
        account_holder: accHolder,
        memo: bankMemo
      });

      // 3. 참가비 및 옵션 업데이트
      const cleanBirthYears = birthYearsInput
        .split(',')
        .map(y => y.trim())
        .filter(y => y !== '');

      db.updateEventOptions(event.id, {
        fees: {
          '학생': feeStudent,
          '교사': feeTeacher,
          '봉사자': feeVolunteer
        },
        birthYears: cleanBirthYears,
        departments: activeDepartments
      });

      alert('행사 설정이 성공적으로 저장되었습니다.');
      loadAllData(event.id);
    } catch (err: any) {
      alert(err.message || '저장 중 오류 발생');
    }
  };

  // ==========================================
  // TAB 2: 교회 및 담당자 가입 승인 로직
  // ==========================================
  const [newChurchName, setNewChurchName] = useState('');
  const [editingChurchId, setEditingChurchId] = useState<string | null>(null);
  const [editChurchName, setEditChurchName] = useState('');

  const handleAddChurch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChurchName.trim()) return;
    try {
      db.createChurch(newChurchName.trim());
      setNewChurchName('');
      loadAllData(event!.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApproveManager = (manager: ChurchManager) => {
    try {
      let finalChurchId = manager.church_id;
      
      // 만약 신규 교회를 직접 작성하여 신청한 건인 경우 (temp_new_church)
      if (manager.church_id === 'temp_new_church') {
        // 메모 파싱해서 새 교회 생성
        const match = manager.phone; // 연락처와 기타 매치
        // 교회 직접 이름 파싱
        const rawTitle = manager.name; // 혹은 가입 신청 폼 비고의 [신규교회 신청: XX] 파싱
        const chNameMatch = manager.phone; // 임시방편으로 교회명을 입력자 정보에서 뽑거나 팝업으로 물을 수 있음
        const userConfirmName = prompt('가입 승인과 함께 새로 생성할 교회명을 입력해 주세요:', '신청 교회');
        
        if (!userConfirmName) {
          alert('승인이 취소되었습니다.');
          return;
        }

        const newCh = db.createChurch(userConfirmName.trim());
        finalChurchId = newCh.id;
      }

      db.updateManager(manager.id, { 
        status: 'approved',
        church_id: finalChurchId
      });
      alert('승인 처리되었습니다.');
      loadAllData(event!.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectManager = (id: string) => {
    if (confirm('이 담당자 신청을 반려(삭제)하시겠습니까?')) {
      db.deleteManager(id);
      loadAllData(event!.id);
    }
  };

  const handleUpdatePaymentStatus = (churchId: string, status: '미납' | '확인 필요' | '납부완료', memo: string) => {
    db.updateChurchPaymentStatus(churchId, status, memo);
    loadAllData(event!.id);
    alert('납부 상태가 변경되었습니다.');
  };

  // 교회별 참가비 예외
  const [overrideChurchId, setOverrideChurchId] = useState('');
  const [overrideType, setOverrideType] = useState<'학생' | '교사' | '봉사자'>('학생');
  const [overrideFee, setOverrideFee] = useState(0);

  const handleAddOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideChurchId) return;
    db.updateFeeOverride(overrideChurchId, overrideType, overrideFee);
    loadAllData(event!.id);
    setOverrideChurchId('');
    alert('참가비 예외 설정이 반영되었습니다.');
  };

  // ==========================================
  // TAB 3: 전체 등록자 관리 및 엑셀 다운로드
  // ==========================================
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilterChurch, setAdminFilterChurch] = useState('');
  const [adminFilterType, setAdminFilterType] = useState('');
  
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
  const filteredParticipants = participants.filter(p => {
    const churchMap = new Map(churches.map(c => [c.id, c.name]));
    const churchName = churchMap.get(p.church_id) || '';

    const matchesSearch = p.name.includes(adminSearch) || churchName.includes(adminSearch);
    const matchesChurch = adminFilterChurch ? p.church_id === adminFilterChurch : true;
    const matchesType = adminFilterType ? p.participant_type === adminFilterType : true;

    return matchesSearch && matchesChurch && matchesType;
  });

  // 엑셀 프리셋 다운로드 실행기
  const handleDownloadPreset = (presetName: string) => {
    if (presetName === 'all') {
      excelUtils.exportAllParticipants(filteredParticipants, churches, selectedExcelCols, '전체_등록자_명단');
    } else if (presetName === 'tshirt_summary') {
      excelUtils.exportTshirtSummary(participants, churches, options.shirtSizes, '교회별_티셔츠_사이즈_요약');
    } else if (presetName === 'tshirt_detail') {
      excelUtils.exportTshirtDetails(participants, churches, '교회별_티셔츠_사이즈_상세');
    } else if (presetName === 'payment') {
      excelUtils.exportPaymentStatus(churches, paymentStatuses, participants, '교회별_참가비_납부현황');
    } else if (presetName === 'groups') {
      excelUtils.exportGroupMembers(participants, churches, groups, groupingGroups, '조별_명단');
    } else if (presetName === 'health') {
      const healthList = participants.filter(p => p.health_note && p.health_note.trim());
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
      excelUtils.exportRawData(formatted, '알레르기_건강주의자_명단');
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
      excelUtils.exportRawData(formatted, '사진촬영_미동의자_명단');
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
    if (!newGgName.trim() || selectedGgDeps.length === 0) {
      alert('그룹 이름과 포함할 부서/학년을 선택해 주세요.');
      return;
    }

    try {
      db.createGroupingGroup({
        event_id: event!.id,
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
      loadAllData(event!.id);
      alert('조편성 그룹이 생성되었습니다.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 자동 조편성 엔진 기동
  const handleRunAutoGrouping = (gg: GroupingGroup) => {
    // 1. 해당 그룹 산하에 실제 조(Group)들이 없으면 먼저 생성
    let currentGroups = groups.filter(g => g.grouping_group_id === gg.id);
    
    if (currentGroups.length === 0) {
      // 조 신규 생성 (예: "초등1조", "초등2조" 등)
      const list: Group[] = [];
      for (let i = 1; i <= gg.group_count; i++) {
        const newG = db.createGroup({
          event_id: event!.id,
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

    loadAllData(event!.id);
    alert('자동 조편성 초안 생성이 완료되었습니다!');
  };

  const handleManualMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMoveParticipantId) return;
    
    const gid = targetMoveGroupId === 'unassigned' ? null : targetMoveGroupId;
    db.assignParticipantToGroup(selectedMoveParticipantId, gid);
    
    // 초기화 및 로드
    setSelectedMoveParticipantId('');
    setTargetMoveGroupId('');
    loadAllData(event!.id);
    alert('참가자 조배정이 수동 변경되었습니다.');
  };

  const handleDeleteGg = (id: string) => {
    if (confirm('이 조편성 그룹과 소속 조원 배정을 모두 삭제하고 초기화하시겠습니까?')) {
      db.deleteGroupingGroup(id);
      loadAllData(event!.id);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
  if (!event) {
    return <div className="p-8 text-center text-slate-500 text-sm">인증 및 행사를 불러오는 중...</div>;
  }

  // 총계 요약 연산
  const approvedManagersCount = managers.filter(m => m.status === 'approved').length;
  const totalRegs = participants.length + approvedManagersCount;
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
            <h1 className="text-lg font-bold tracking-tight">연합 본부 관리자 페이지</h1>
            <p className="text-[10px] text-indigo-300 font-medium">활성 행사: {event.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-between md:justify-end">
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
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600">행사 상세 설명</label>
                <textarea
                  value={eventDesc}
                  onChange={e => setEventDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring h-20 resize-none"
                />
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

              {/* 본부 입금 계좌 */}
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">본부 수납 계좌 설정</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600">은행명</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600">계좌번호</label>
                  <input
                    type="text"
                    value={accNum}
                    onChange={e => setAccNum(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600">예금주</label>
                  <input
                    type="text"
                    value={accHolder}
                    onChange={e => setAccHolder(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs input-focus-ring"
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
          </div>
        )}

        {/* TAB 2: CHURCHES & PAYMENTS */}
        {activeTab === 'churches' && (
          <div className="flex flex-col gap-6">
            
            {/* 1. 교회 담당자 가입 대기 신청 목록 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col gap-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                교회 담당자 가입 승인 대기 목록
                {pendingManagers.length > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {pendingManagers.length}건
                  </span>
                )}
              </h3>
              
              {/* 1-1. 모바일 화면 (카드 레이아웃) */}
              <div className="block sm:hidden flex flex-col gap-3">
                {pendingManagers.length > 0 ? (
                  pendingManagers.map(m => (
                    <div key={m.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{m.name}</h4>
                          <span className="text-[10px] font-bold text-indigo-600">
                            {m.church_id === 'temp_new_church' ? '신규등록요청' : (churches.find(c => c.id === m.church_id)?.name || '-')}
                          </span>
                        </div>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[10px]">
                          아이디: {m.login_id}
                        </span>
                      </div>
                      
                      <div className="text-[11px] text-slate-500 flex flex-col gap-1 mt-1 border-t border-slate-200/60 pt-2">
                        <div><span className="font-semibold text-slate-700">연락처:</span> {m.phone}</div>
                        {m.password_hash && <div><span className="font-semibold text-slate-700">비고 (임시 비밀번호):</span> {m.password_hash}</div>}
                      </div>
                      
                      <div className="flex gap-2 mt-2 pt-2 border-t border-slate-200/60">
                        <button
                          onClick={() => handleApproveManager(m)}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs transition-all-custom"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => handleRejectManager(m.id)}
                          className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold py-2 rounded-lg text-xs border border-rose-200 transition-all-custom"
                        >
                          반려
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-slate-50 rounded-xl p-6 text-center text-xs text-slate-400 border border-slate-200">
                    승인 대기 중인 신청이 없습니다.
                  </div>
                )}
              </div>

              {/* 1-2. 데스크톱 화면 (테이블 레이아웃) */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <th className="p-3">신청자명</th>
                      <th className="p-3">신청 교회</th>
                      <th className="p-3">연락처</th>
                      <th className="p-3">희망 아이디</th>
                      <th className="p-3">비고 (메모)</th>
                      <th className="p-3 text-center">동작</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {pendingManagers.length > 0 ? (
                      pendingManagers.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-900">{m.name}</td>
                          <td className="p-3 font-semibold text-indigo-600">
                            {m.church_id === 'temp_new_church' ? '신규등록요청' : (churches.find(c => c.id === m.church_id)?.name || '-')}
                          </td>
                          <td className="p-3">{m.phone}</td>
                          <td className="p-3 font-mono">{m.login_id}</td>
                          <td className="p-3 text-slate-500">{m.password_hash} {/* mock이라 암호 노출함 */}</td>
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
                      <button
                        onClick={() => {
                          if (confirm('이 교회를 삭제하시겠습니까? 등록된 해당 교회 참가자 및 조원 정보가 모두 삭제될 수 있습니다.')) {
                            db.deleteChurch(c.id);
                            loadAllData(event!.id);
                          }
                        }}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 교회별 참가비 정산 및 납부 상태 변경 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 lg:col-span-2 flex flex-col gap-4">
                <h3 className="font-bold text-slate-800 text-sm">교회별 정산 및 납부 관리</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="p-3 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">교회명</th>
                        <th className="p-3">인원수</th>
                        <th className="p-3">정산 금액</th>
                        <th className="p-3">납부 상태</th>
                        <th className="p-3">상태 변경</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {churches.map(church => {
                        const statusRecord = paymentStatuses.find(s => s.church_id === church.id);
                        const churchApprovedManagersCount = managers.filter(m => m.church_id === church.id && m.status === 'approved').length;
                        const churchRegsCount = participants.filter(p => p.church_id === church.id).length + churchApprovedManagersCount;
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
                          db.updateFeeOverride(fo.church_id, fo.participant_type, options.fees[fo.participant_type]);
                          loadAllData(event!.id);
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
                    <th className="p-3 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">참가자명</th>
                    <th className="p-3">소속 교회</th>
                    <th className="p-3">구분 / 부서</th>
                    <th className="p-3">성별 / 셔츠</th>
                    <th className="p-3">연락처 / 보호자</th>
                    <th className="p-3">동작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredParticipants.length > 0 ? (
                    filteredParticipants.map(p => {
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
                          <td className="p-3">{p.gender} / {p.shirt_size}</td>
                          <td className="p-3">
                            {p.participant_type === '학생' ? `${p.guardian_name} (${p.guardian_phone})` : p.personal_phone}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => {
                                if (confirm('이 참가자를 삭제하시겠습니까?')) {
                                  db.deleteParticipant(p.id);
                                  loadAllData(event.id);
                                }
                              }}
                              className="text-rose-600 hover:underline"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">데이터가 없습니다.</td>
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
                        {/* 해당 그룹의 부서에 속한 학생 + 교사 리스트 */}
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
    </div>
  );
}
