'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/services/db';
import { Participant, Church, SameGroupRequest, ChurchPaymentStatus, PaymentSettings, Event } from '@/types';
import { 
  Users, CreditCard, Copy, Info, CheckCircle, Search, 
  UserPlus, Edit, Trash2, HelpCircle, LogOut, Check, Grid, Shirt
} from 'lucide-react';

export default function ManagerDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<{ loginId: string; role: string; churchId: string; name: string } | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [church, setChurch] = useState<Church | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<ChurchPaymentStatus | null>(null);
  
  // 데이터 목록
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [requests, setRequests] = useState<SameGroupRequest[]>([]);
  const [approvedManagersCount, setApprovedManagersCount] = useState(0);
  
  // UI 탭
  const [activeTab, setActiveTab] = useState<'dashboard' | 'participants' | 'requests'>('dashboard');

  // 복사 피드백
  const [copied, setCopied] = useState(false);

  // 검색 및 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDept, setFilterDept] = useState('');

  // 행사 옵션
  const [options, setOptions] = useState<{
    departments: string[];
    birthYears: string[];
    shirtSizes: string[];
    attendanceDates: { date: string; label: string }[];
    fees: Record<string, number>;
  }>({ departments: [], birthYears: [], shirtSizes: [], attendanceDates: [], fees: {} });

  // 추가/수정 폼 관련 모달/뷰 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  
  // 폼 입력 상태
  const [pType, setPType] = useState<'학생' | '교사' | '봉사자'>('학생');
  const [pName, setPName] = useState('');
  const [pGender, setPGender] = useState<'남' | '여'>('남');
  const [pDept, setPDept] = useState('');
  const [pBirthYear, setPBirthYear] = useState('');
  const [pGuardianName, setPGuardianName] = useState('');
  const [pGuardianPhone, setPGuardianPhone] = useState('');
  const [pPersonalPhone, setPPersonalPhone] = useState('');
  const [pRole, setPRole] = useState('');
  const [pShirtSize, setPShirtSize] = useState('');
  const [pHealthNote, setPHealthNote] = useState('');
  const [pPhotoConsent, setPPhotoConsent] = useState(true);
  const [pAttendance, setPAttendance] = useState<string[]>([]);
  const [pMemo, setPMemo] = useState('');
  const [pFormError, setPFormError] = useState('');

  // 같은 조 요청 추가 관련
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqParticipantId, setReqParticipantId] = useState('');
  const [reqTargetName, setReqTargetName] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqError, setReqError] = useState('');

  useEffect(() => {
    // 1. 인증 검증
    const sessStr = sessionStorage.getItem('evt_session');
    if (!sessStr) {
      router.push('/login');
      return;
    }
    const sess = JSON.parse(sessStr);
    if (sess.role !== 'manager' || !sess.churchId) {
      router.push('/login');
      return;
    }
    setSession(sess);

    // 2. 행사 정보
    const active = db.getActiveEvent();
    if (!active) {
      alert('활성화된 행사가 없습니다.');
      router.push('/');
      return;
    }
    setEvent(active);

    const ch = db.getChurches().find((c: Church) => c.id === sess.churchId) || null;
    setChurch(ch);

    const opts = db.getEventOptions(active.id);
    setOptions(opts);

    // 3. 데이터 로딩
    loadData(sess.churchId, active.id);
  }, [router]);

  const loadData = (churchId: string, eventId: string) => {
    const list = db.getParticipants().filter(p => p.church_id === churchId && p.event_id === eventId);
    setParticipants(list);

    const reqs = db.getSameGroupRequests().filter(r => r.church_id === churchId && r.event_id === eventId);
    setRequests(reqs);

    const pSettings = db.getPaymentSettings() || null;
    setPaymentSettings(pSettings);

    const pStatus = db.getChurchPaymentStatuses().find(s => s.church_id === churchId && s.event_id === eventId) || null;
    setPaymentStatus(pStatus);

    const mgrs = db.getManagers ? db.getManagers() : [];
    const count = mgrs.filter((m: any) => m.church_id === churchId && m.status === 'approved').length;
    setApprovedManagersCount(count);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('evt_session');
    router.push('/login');
  };

  // 계좌 복사
  const handleCopyAccount = () => {
    if (!paymentSettings) return;
    const text = `${paymentSettings.bank_name} ${paymentSettings.account_number} (예금주: ${paymentSettings.account_holder})`;
    navigator.clipboard.writeText(paymentSettings.account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 참가자 추가/수정 제출
  const handleSaveParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    setPFormError('');

    if (!pName.trim()) {
      setPFormError('이름을 입력해 주세요.');
      return;
    }

    if (pType === '학생') {
      if (!pGuardianName.trim() || !pGuardianPhone.trim()) {
        setPFormError('보호자 성함 및 연락처를 입력해 주세요.');
        return;
      }
    } else {
      if (!pPersonalPhone.trim()) {
        setPFormError('본인 연락처를 입력해 주세요.');
        return;
      }
    }

    if (pAttendance.length === 0) {
      setPFormError('참석 일정을 최소 하루 이상 선택해 주세요.');
      return;
    }

    const payload = {
      event_id: event!.id,
      church_id: session!.churchId,
      participant_type: pType,
      name: pName.trim(),
      gender: pGender,
      department: pType === '학생' ? pDept : undefined,
      birth_year: pType === '학생' && (pDept === '유아부' || pDept === '유치부') ? pBirthYear : undefined,
      guardian_name: pType === '학생' ? pGuardianName.trim() : undefined,
      guardian_phone: pType === '학생' ? pGuardianPhone.trim() : undefined,
      personal_phone: pType !== '학생' ? pPersonalPhone.trim() : undefined,
      role: pType !== '학생' ? pRole.trim() : undefined,
      shirt_size: pShirtSize,
      health_note: pHealthNote.trim(),
      photo_consent: pPhotoConsent,
      attendance_schedule: pAttendance,
      edit_password_hash: editingParticipant ? editingParticipant.edit_password_hash : '1234_hashed', // 담당자가 추가하면 기본 비번 부여
      memo: pMemo.trim()
    };

    try {
      if (editingParticipant) {
        db.updateParticipant(editingParticipant.id, payload);
      } else {
        db.createParticipant(payload);
      }
      
      // 상태 초기화 및 닫기
      closeForm();
      loadData(session!.churchId, event!.id);
    } catch (err: any) {
      setPFormError(err.message || '저장 중 오류가 발생했습니다.');
    }
  };

  const openAddForm = () => {
    setPType('학생');
    setPName('');
    setPGender('남');
    setPDept(options.departments[0] || '');
    setPBirthYear(options.birthYears[0] || '');
    setPGuardianName('');
    setPGuardianPhone('');
    setPPersonalPhone('');
    setPRole('');
    setPShirtSize(options.shirtSizes[0] || 'M');
    setPHealthNote('');
    setPPhotoConsent(true);
    setPAttendance(options.attendanceDates.map(d => d.date));
    setPMemo('');
    setEditingParticipant(null);
    setShowAddForm(true);
  };

  const openEditForm = (p: Participant) => {
    setEditingParticipant(p);
    setPType(p.participant_type);
    setPName(p.name);
    setPGender(p.gender);
    setPDept(p.department || '');
    setPBirthYear(p.birth_year || '');
    setPGuardianName(p.guardian_name || '');
    setPGuardianPhone(p.guardian_phone || '');
    setPPersonalPhone(p.personal_phone || '');
    setPRole(p.role || '');
    setPShirtSize(p.shirt_size);
    setPHealthNote(p.health_note || '');
    setPPhotoConsent(p.photo_consent);
    setPAttendance(p.attendance_schedule);
    setPMemo(p.memo || '');
    setShowAddForm(true);
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingParticipant(null);
    setPFormError('');
  };

  const handleDeleteParticipant = (id: string, name: string) => {
    if (confirm(`정말로 ${name} 참가자의 등록 신청을 취소/삭제하시겠습니까?`)) {
      db.deleteParticipant(id);
      loadData(session!.churchId, event!.id);
    }
  };

  // 같은 조 요청 제출
  const handleSaveRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setReqError('');

    if (!reqParticipantId) {
      setReqError('등록자를 선택해 주세요.');
      return;
    }
    if (!reqTargetName.trim()) {
      setReqError('같은 조 요청 대상자 이름을 입력해 주세요.');
      return;
    }

    const requester = participants.find(p => p.id === reqParticipantId);
    if (!requester) return;

    try {
      db.createSameGroupRequest({
        event_id: event!.id,
        church_id: session!.churchId,
        participant_id: reqParticipantId,
        participant_name: requester.name,
        requested_participant_name: reqTargetName.trim(),
        reason: reqReason.trim(),
        requested_by: session!.name
      });

      // 초기화
      setReqParticipantId('');
      setReqTargetName('');
      setReqReason('');
      setShowRequestForm(false);
      loadData(session!.churchId, event!.id);
    } catch (err: any) {
      setReqError(err.message || '요청 저장 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteRequest = (id: string) => {
    if (confirm('이 조편성 요청을 삭제하시겠습니까?')) {
      db.deleteSameGroupRequest(id);
      loadData(session!.churchId, event!.id);
    }
  };

  // 필터링 적용 리스트
  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.includes(searchTerm) || 
      (p.guardian_name && p.guardian_name.includes(searchTerm));
    const matchesType = filterType ? p.participant_type === filterType : true;
    const matchesDept = filterDept ? p.department === filterDept : true;
    
    return matchesSearch && matchesType && matchesDept;
  });

  if (!session || !event || !church) {
    return <div className="p-8 text-center text-slate-500 text-sm">인증 및 정보를 불러오는 중...</div>;
  }

  // 통계 계산
  const studentCount = participants.filter(p => p.participant_type === '학생').length;
  const teacherCount = participants.filter(p => p.participant_type === '교사').length + approvedManagersCount;
  const volunteerCount = participants.filter(p => p.participant_type === '봉사자').length;
  const totalCount = participants.length + approvedManagersCount;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* GNB */}
      <header className="bg-slate-900 text-white px-6 py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white">
            <Grid className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{church.name} 관리 대시보드</h1>
            <p className="text-[10px] text-slate-400 font-medium">행사명: {event.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-between md:justify-end">
          <span className="text-xs text-slate-300 font-medium bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
            접속자: {session.name}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white font-semibold transition-all-custom"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-4">
        {(['dashboard', 'participants', 'requests'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-4 px-2 font-bold text-sm border-b-2 transition-all-custom ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab === 'dashboard' && '교회 현황 요약'}
            {tab === 'participants' && '등록자 명단 관리'}
            {tab === 'requests' && '같은 조 요청 관리'}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <main className="flex-1 p-6 max-w-6xl w-full mx-auto">
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. 인원 현황 요약 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                등록 인원 현황
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                  <span className="text-[10px] text-slate-500 block font-semibold">총 등록 인원</span>
                  <span className="text-2xl font-black text-slate-950 mt-1 block">{totalCount}명</span>
                </div>
                <div className="bg-indigo-50/50 p-4 rounded-xl text-center border border-indigo-100">
                  <span className="text-[10px] text-indigo-700 block font-semibold">학생</span>
                  <span className="text-2xl font-black text-indigo-950 mt-1 block">{studentCount}명</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600 bg-slate-50 p-3.5 rounded-xl">
                <div className="flex justify-between">
                  <span>교사:</span>
                  <span className="text-slate-950 font-bold">{teacherCount}명</span>
                </div>
                <div className="flex justify-between">
                  <span>봉사자:</span>
                  <span className="text-slate-950 font-bold">{volunteerCount}명</span>
                </div>
              </div>
            </div>

            {/* 2. 참가비 및 계좌 정보 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                참가비 및 송금 계좌
              </h3>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500 font-semibold">총 납부할 참가비 총액</span>
                <span className="text-2xl font-black text-indigo-600">
                  {paymentStatus ? paymentStatus.total_amount.toLocaleString() : 0}원
                </span>
              </div>
              
              {/* 본부 입금 계좌 */}
              {paymentSettings ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-2 relative">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">본부 입금 계좌</span>
                  <p className="text-xs font-bold text-slate-800">{paymentSettings.bank_name}</p>
                  <p className="text-sm font-black text-slate-900 tracking-wide">{paymentSettings.account_number}</p>
                  <p className="text-xs text-slate-500 font-medium">예금주: {paymentSettings.account_holder}</p>
                  
                  <button
                    onClick={handleCopyAccount}
                    className="absolute right-3 top-3 bg-white hover:bg-slate-100 text-slate-600 p-1.5 rounded-lg border border-slate-200 transition-all-custom flex items-center gap-1 text-[10px] font-bold"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400">설정된 계좌 정보가 없습니다.</span>
              )}
            </div>

            {/* 3. 납부 확인 상태 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-600" />
                본부 납부 승인 상태
              </h3>
              <div className="flex items-center gap-2.5">
                <span className="text-xs text-slate-500 font-semibold">현재 상태:</span>
                <span className={`text-sm font-black px-3 py-1 rounded-full ${
                  paymentStatus?.status === '납부완료' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  paymentStatus?.status === '확인 필요' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                  'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {paymentStatus?.status || '미납'}
                </span>
              </div>

              {paymentStatus?.memo && (
                <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600 border border-slate-100">
                  <span className="font-bold text-slate-700">본부 메모:</span> {paymentStatus.memo}
                </div>
              )}

              {/* 납부 주의 문구 */}
              <div className="flex items-start gap-2 bg-blue-50 p-4 rounded-xl border border-blue-100 text-[11px] text-blue-800 leading-relaxed mt-auto">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  입금 확인은 본부/지방/연합 관리자가 직접 처리합니다. 확인이 조금 늦어질 수 있습니다.
                </p>
              </div>
            </div>

            {/* 4. 부서 분포 요약 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 md:col-span-2">
              <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
                <Grid className="w-4 h-4 text-indigo-600" />
                부서 / 학년별 등록 분포
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {options.departments.map(dep => {
                  const count = participants.filter(p => p.department === dep).length;
                  if (count === 0) return null;
                  return (
                    <div key={dep} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                      <span className="text-[11px] text-slate-500 font-semibold block">{dep}</span>
                      <span className="text-lg font-black text-slate-800 block mt-1">{count}명</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. 티셔츠 사이즈 요약 */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
                <Shirt className="w-4 h-4 text-indigo-600" />
                티셔츠 요약
              </h3>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {options.shirtSizes.map(size => {
                  const count = participants.filter(p => p.shirt_size === size).length;
                  if (count === 0) return null;
                  return (
                    <div key={size} className="flex justify-between text-xs font-semibold text-slate-600 border-b border-slate-100 pb-1.5">
                      <span>{size} 사이즈</span>
                      <span className="text-slate-900 font-bold">{count}장</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PARTICIPANTS LIST */}
        {activeTab === 'participants' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col gap-4 p-6">
            
            {/* Header + Add button */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <h3 className="font-bold text-slate-800 text-sm">등록자 명단 관리</h3>
              <button
                onClick={openAddForm}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1 transition-all-custom self-start sm:self-auto"
              >
                <UserPlus className="w-4 h-4" />
                참가자 직접 추가
              </button>
            </div>

            {/* Filter Area */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  placeholder="이름 또는 보호자명 검색"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs input-focus-ring"
                />
              </div>

              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
              >
                <option value="">참가 구분 전체</option>
                <option value="학생">학생</option>
                <option value="교사">교사</option>
                <option value="봉사자">봉사자</option>
              </select>

              <select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
              >
                <option value="">부서 전체</option>
                {options.departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="p-3">참가자명</th>
                    <th className="p-3">구분 / 부서</th>
                    <th className="p-3">성별 / 셔츠</th>
                    <th className="p-3">연락처 / 보호자</th>
                    <th className="p-3">참석일정</th>
                    <th className="p-3 text-center">조배정</th>
                    <th className="p-3 text-center">동작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredParticipants.length > 0 ? (
                    filteredParticipants.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-900">{p.name}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold mr-1 ${
                            p.participant_type === '학생' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {p.participant_type}
                          </span>
                          {p.department || '-'}
                        </td>
                        <td className="p-3">
                          {p.gender} / <span className="font-bold text-slate-900">{p.shirt_size}</span>
                        </td>
                        <td className="p-3">
                          {p.participant_type === '학생' ? (
                            <div>
                              <p className="font-semibold text-[10px] text-slate-500">부: {p.guardian_name}</p>
                              <p className="text-[11px] font-medium">{p.guardian_phone}</p>
                            </div>
                          ) : (
                            <p className="text-[11px] font-medium">{p.personal_phone}</p>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-0.5">
                            {p.attendance_schedule.map(d => (
                              <span key={d} className="bg-slate-100 text-slate-700 text-[9px] font-bold px-1 rounded">
                                {d.substring(5)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {p.assigned_group_id ? (
                            <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              배정됨
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-400 text-[10px] px-2 py-0.5 rounded-full">
                              미배정
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => openEditForm(p)}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-all-custom"
                              title="수정"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteParticipant(p.id, p.name)}
                              className="p-1.5 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 border border-slate-200 rounded-lg text-rose-600 transition-all-custom"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                        등록된 참가자가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* TAB 3: REQUESTS */}
        {activeTab === 'requests' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
            
            {/* Header + Add button */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">같은 조 편성 요청</h3>
                <p className="text-xs text-slate-500 mt-0.5">같은 조에 배정되어야 하는 아동들의 매칭 요청 목록입니다.</p>
              </div>
              <button
                onClick={() => setShowRequestForm(!showRequestForm)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1 transition-all-custom self-start sm:self-auto"
              >
                <UserPlus className="w-4 h-4" />
                같은 조 요청 추가
              </button>
            </div>

            {/* Request Insert Form */}
            {showRequestForm && (
              <form onSubmit={handleSaveRequest} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col gap-4 max-w-md">
                <h4 className="font-bold text-xs text-slate-700 uppercase">새 조편성 요청 등록</h4>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">요청자 (학생 선택)</label>
                  <select
                    value={reqParticipantId}
                    onChange={e => setReqParticipantId(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                  >
                    <option value="">-- 아동을 선택하세요 --</option>
                    {participants.filter(p => p.participant_type === '학생').map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.department})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">함께 편성되기를 희망하는 대상자 이름</label>
                  <input
                    type="text"
                    placeholder="대상 아동 이름 입력"
                    value={reqTargetName}
                    onChange={e => setReqTargetName(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">요청 사유</label>
                  <input
                    type="text"
                    placeholder="낯을 가림, 친한 친구 등"
                    value={reqReason}
                    onChange={e => setReqReason(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                  />
                </div>

                {reqError && (
                  <p className="text-rose-600 text-xs font-semibold">{reqError}</p>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowRequestForm(false)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-xl text-xs transition-all-custom"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all-custom"
                  >
                    요청 저장
                  </button>
                </div>
              </form>
            )}

            {/* Requests Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="p-3">아동명 (요청자)</th>
                    <th className="p-3">희망 대상자</th>
                    <th className="p-3">요청 사유</th>
                    <th className="p-3 text-center">반영 여부</th>
                    <th className="p-3 text-center">동작</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {requests.length > 0 ? (
                    requests.map(req => (
                      <tr key={req.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-semibold text-slate-900">{req.participant_name}</td>
                        <td className="p-3 font-semibold text-slate-900">{req.requested_participant_name}</td>
                        <td className="p-3 text-slate-500">{req.reason || '-'}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === '반영됨' ? 'bg-emerald-50 text-emerald-700' :
                            req.status === '미반영' ? 'bg-rose-50 text-rose-700' :
                            'bg-yellow-50 text-yellow-700'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeleteRequest(req.id)}
                            className="p-1 bg-slate-50 hover:bg-rose-50 text-rose-600 rounded border border-slate-200 transition-all-custom text-[10px] font-bold"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">
                        등록된 같은 조 요청 사항이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </main>

      {/* PARTICIPANT ADD/EDIT MODAL FORM */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto flex flex-col gap-4 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base">
              {editingParticipant ? '참가자 등록 정보 수정' : '신규 참가자 직접 등록'}
            </h3>
            
            <form onSubmit={handleSaveParticipant} className="flex flex-col gap-4">
              
              {/* 구분 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">구분</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['학생', '교사', '봉사자'] as const).map(t => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setPType(t)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition-all-custom border ${
                        pType === t 
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 이름 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600">이름</label>
                <input
                  type="text"
                  value={pName}
                  onChange={e => setPName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                />
              </div>

              {/* 성별 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">성별</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['남', '여'] as const).map(g => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => setPGender(g)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                        pGender === g 
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 학생 전용: 부서/학년 */}
              {pType === '학생' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-600">부서 / 학년</label>
                    <select
                      value={pDept}
                      onChange={e => setPDept(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                    >
                      <option value="">부서 선택</option>
                      {options.departments.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* 유아부/유치부 전용: 출생년도 */}
                  {(pDept === '유아부' || pDept === '유치부') && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600">출생년도</label>
                      <select
                        value={pBirthYear}
                        onChange={e => setPBirthYear(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                      >
                        {options.birthYears.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* 보호자명 */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600">보호자 이름</label>
                    <input
                      type="text"
                      value={pGuardianName}
                      onChange={e => setPGuardianName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                    />
                  </div>

                  {/* 보호자 연락처 */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600">보호자 연락처</label>
                    <input
                      type="tel"
                      value={pGuardianPhone}
                      onChange={e => setPGuardianPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                    />
                  </div>
                </>
              )}

              {/* 교사/봉사자 전용: 본인폰 & 역할 */}
              {pType !== '학생' && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600">본인 연락처</label>
                    <input
                      type="tel"
                      value={pPersonalPhone}
                      onChange={e => setPPersonalPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600">역할 / 직분</label>
                    <input
                      type="text"
                      value={pRole}
                      onChange={e => setPRole(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                    />
                  </div>
                </>
              )}

              {/* 셔츠 사이즈 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">티셔츠 사이즈</label>
                <select
                  value={pShirtSize}
                  onChange={e => setPShirtSize(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                >
                  {options.shirtSizes.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* 참석 일정 */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600">참석 일정</label>
                <div className="flex flex-wrap gap-2">
                  {options.attendanceDates.map(d => {
                    const isChecked = pAttendance.includes(d.date);
                    return (
                      <button
                        type="button"
                        key={d.date}
                        onClick={() => {
                          if (isChecked) {
                            setPAttendance(pAttendance.filter(x => x !== d.date));
                          } else {
                            setPAttendance([...pAttendance, d.date]);
                          }
                        }}
                        className={`py-1.5 px-3 rounded-lg text-[10px] font-bold border transition-all-custom ${
                          isChecked 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-white text-slate-500 border-slate-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 건강상 주의사항 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600">건강 주의사항</label>
                <input
                  type="text"
                  value={pHealthNote}
                  onChange={e => setPHealthNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                />
              </div>

              {/* 비고 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600">비고 (메모)</label>
                <input
                  type="text"
                  value={pMemo}
                  onChange={e => setPMemo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs input-focus-ring"
                />
              </div>

              {pFormError && (
                <p className="text-rose-600 text-xs font-semibold">{pFormError}</p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl text-xs transition-all-custom"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all-custom"
                >
                  저장
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
