'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/services/db';
import { formatPhone } from '@/utils/format';
import { Event, Church, Participant, District } from '@/types';
import { ArrowLeft, Search, Save, Info, ShieldAlert, CheckCircle2, Calendar } from 'lucide-react';

interface PageProps {
  params: Promise<{ districtSlug: string }>;
}

export default function EditPage({ params }: PageProps) {
  const router = useRouter();
  const { districtSlug } = use(params);

  // 지방회 정보
  const [district, setDistrict] = useState<District | null>(null);

  // 행사 및 설정 데이터
  const [event, setEvent] = useState<Event | null>(null);
  const [churches, setChurches] = useState<Church[]>([]);
  const [options, setOptions] = useState<{
    departments: string[];
    birthYears: string[];
    shirtSizes: string[];
    attendanceDates: { date: string; label: string }[];
  }>({ departments: [], birthYears: [], shirtSizes: [], attendanceDates: [] });

  // 1단계: 인증 입력
  const [searchName, setSearchName] = useState<string>('');
  const [searchPhone, setSearchPhone] = useState<string>('');
  const [searchPassword, setSearchPassword] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);

  // 2단계: 편집 정보
  const [pType, setPType] = useState<'학생' | '교사' | '봉사자'>('학생');
  const [churchId, setChurchId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [gender, setGender] = useState<'남' | '여'>('남');
  const [department, setDepartment] = useState<string>('');
  const [birthYear, setBirthYear] = useState<string>('');
  const [guardianName, setGuardianName] = useState<string>('');
  const [guardianPhone, setGuardianPhone] = useState<string>('');
  const [personalPhone, setPersonalPhone] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [shirtSize, setShirtSize] = useState<string>('');
  const [healthNote, setHealthNote] = useState<string>('');
  const [photoConsent, setPhotoConsent] = useState<boolean>(true);
  const [customConsentAgreed, setCustomConsentAgreed] = useState<boolean>(false);
  const [attendance, setAttendance] = useState<string[]>([]);
  const [memo, setMemo] = useState<string>('');

  // UI 흐름 상태
  const [loading, setLoading] = useState<boolean>(true);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isEditDeadlinePassed, setIsEditDeadlinePassed] = useState<boolean>(false);

  useEffect(() => {
    const dist = db.getDistrictBySlug(districtSlug);
    if (!dist || dist.status !== 'approved') {
      alert('유효하지 않은 지방회입니다.');
      router.push('/');
      return;
    }
    setDistrict(dist);

    const active = db.getActiveEvent(dist.id);
    if (!active) {
      alert('진행 중인 성경학교 행사가 없습니다.');
      router.push(`/district/${districtSlug}`);
      return;
    }
    setEvent(active);
    
    // 해당 지방회 전용 교회 및 옵션 로드
    setChurches(db.getChurches(dist.id));
    setOptions(db.getEventOptions(active.id));

    // 수정 마감일 확인
    const now = new Date();
    const deadline = new Date(active.edit_deadline);
    if (now > deadline) {
      setIsEditDeadlinePassed(true);
    }
    setLoading(false);
  }, [districtSlug, router]);

  // 비밀번호 인증을 위한 간단 해시 비교 함수
  const hashPassword = (pw: string) => {
    try {
      const reversed = pw.split('').reverse().join('');
      return btoa(unescape(encodeURIComponent(reversed)));
    } catch {
      return pw;
    }
  };

  const handleAttendanceChange = (date: string) => {
    if (isEditDeadlinePassed) return;
    if (attendance.includes(date)) {
      setAttendance(attendance.filter(d => d !== date));
    } else {
      setAttendance([...attendance, date]);
    }
  };

  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!district) return;
    if (!searchName.trim() || !searchPhone.trim() || !searchPassword.trim()) {
      setErrorMsg('모든 값을 입력해 주세요.');
      return;
    }

    // 해당 지방회의 참가자 데이터만 쿼리
    const participants = db.getParticipants(district.id);
    const targetHash = hashPassword(searchPassword);

    const found = participants.find((p: Participant) => {
      const isNameMatch = p.name === searchName.trim();
      const isPhoneMatch = p.participant_type === '학생' 
        ? p.guardian_phone === searchPhone.trim() 
        : p.personal_phone === searchPhone.trim();
      const isPasswordMatch = p.edit_password_hash === targetHash;
      
      return isNameMatch && isPhoneMatch && isPasswordMatch;
    });

    if (!found) {
      setErrorMsg('일치하는 등록 정보를 찾을 수 없습니다. 이름, 연락처 또는 비밀번호를 다시 확인해 주세요.');
      return;
    }

    // 로그인 정보 적재 및 2단계 전환
    setCurrentParticipant(found);
    setPType(found.participant_type);
    setChurchId(found.church_id);
    setName(found.name);
    setGender(found.gender);
    setDepartment(found.department || '');
    setBirthYear(found.birth_year || '');
    setGuardianName(found.guardian_name || '');
    setGuardianPhone(found.guardian_phone || '');
    setPersonalPhone(found.personal_phone || '');
    setRole(found.role || '');
    setShirtSize(found.shirt_size);
    setHealthNote(found.health_note || '');
    setPhotoConsent(found.photo_consent);
    setCustomConsentAgreed(found.custom_consent_agreed || false);
    setAttendance(found.attendance_schedule);
    setMemo(found.memo || '');

    setIsAuthenticated(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!district) return;
    if (isEditDeadlinePassed) {
      setErrorMsg('수정 기한이 지나 수정할 수 없습니다.');
      return;
    }

    // 필수 검증
    if (!churchId) {
      setErrorMsg('소속 교회를 선택해 주세요.');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('이름을 입력해 주세요.');
      return;
    }
    if (pType === '학생') {
      if (!guardianName.trim()) {
        setErrorMsg('보호자 이름을 입력해 주세요.');
        return;
      }
      if (!guardianPhone.trim()) {
        setErrorMsg('보호자 연락처를 입력해 주세요.');
        return;
      }
    } else {
      if (!personalPhone.trim()) {
        setErrorMsg('본인 연락처를 입력해 주세요.');
        return;
      }
    }
    if (!shirtSize) {
      setErrorMsg('티셔츠 사이즈를 선택해 주세요.');
      return;
    }
    if (attendance.length === 0) {
      setErrorMsg('참석 일정을 최소 하루 이상 선택해 주세요.');
      return;
    }
    if (event?.custom_consent_enabled && event.custom_consent_required && !customConsentAgreed) {
      setErrorMsg(`'${event.custom_consent_title || '추가 동의서'}'에 동의해야 수정이 가능합니다.`);
      return;
    }

    try {
      db.updateParticipant(currentParticipant!.id, {
        church_id: churchId,
        name: name.trim(),
        gender,
        department: pType === '학생' ? department : undefined,
        birth_year: pType === '학생' && (department === '유아부' || department === '유치부') ? birthYear : undefined,
        guardian_name: pType === '학생' ? guardianName.trim() : undefined,
        guardian_phone: pType === '학생' ? guardianPhone.trim() : undefined,
        personal_phone: pType !== '학생' ? personalPhone.trim() : undefined,
        role: pType !== '학생' ? role.trim() : undefined,
        shirt_size: shirtSize,
        health_note: healthNote.trim(),
        photo_consent: photoConsent,
        custom_consent_agreed: event?.custom_consent_enabled ? customConsentAgreed : false,
        attendance_schedule: attendance,
        memo: memo.trim()
      });

      setIsCompleted(true);
      window.scrollTo(0, 0);
    } catch (err: any) {
      setErrorMsg(err.message || '정보 수정 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!district) return null;

  if (isCompleted) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 justify-center items-center py-12 px-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-100 flex flex-col gap-6 text-center">
          <div className="mx-auto bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center text-emerald-600 mb-2">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold text-slate-900">신청 정보 수정 완료!</h1>
            <p className="text-sm text-slate-500">참가자의 신청 내용이 성공적으로 업데이트되었습니다.</p>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={() => {
                setIsCompleted(false);
                setIsAuthenticated(false);
                setSearchName('');
                setSearchPhone('');
                setSearchPassword('');
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all-custom text-center text-sm shadow-md shadow-indigo-100"
            >
              다른 내역 수정하기
            </button>
            <Link
              href={`/district/${districtSlug}`}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 px-6 rounded-2xl transition-all-custom text-center text-sm"
            >
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-12">
      {/* GNB */}
      <header className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10">
        <Link href={`/district/${districtSlug}`} className="flex items-center gap-1 text-slate-600 hover:text-slate-900 transition-all-custom">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">홈으로</span>
        </Link>
        <span className="font-bold text-slate-800">신청 정보 수정 ({district.name})</span>
        <div className="w-12"></div>
      </header>

      <main className="w-full max-w-md mx-auto px-4 mt-6">
        {/* 1단계: 인증 정보 입력 */}
        {!isAuthenticated ? (
          <form onSubmit={handleAuthenticate} className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-slate-900">본인 신청 내역 조회</h2>
              <p className="text-xs text-slate-400">등록 시 입력한 이름, 연락처, 비밀번호를 정확하게 기입해 주세요.</p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">참가자 이름</label>
                <input
                  type="text"
                  placeholder="등록한 참가자 이름"
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">연락처 (숫자 및 하이픈만)</label>
                <input
                  type="tel"
                  placeholder="학생은 보호자 번호, 교사/봉사자는 본인 번호"
                  value={searchPhone}
                  onChange={e => setSearchPhone(formatPhone(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">수정용 비밀번호</label>
                <input
                  type="password"
                  placeholder="신청 시 입력한 비밀번호"
                  value={searchPassword}
                  onChange={e => setSearchPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-rose-600 text-xs font-semibold text-center bg-rose-50 py-2.5 rounded-xl border border-rose-100">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all-custom shadow-lg shadow-indigo-100 text-sm"
            >
              <Search className="w-4 h-4" />
              조회 및 인증하기
            </button>
          </form>
        ) : (
          /* 2단계: 편집 정보 입력 */
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 flex flex-col gap-5">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900">신청서 수정</h2>
                <p className="text-xs text-slate-400">변경을 원하시는 정보를 수정한 뒤 저장해 주세요.</p>
              </div>
              {isEditDeadlinePassed && (
                <span className="text-rose-600 bg-rose-50 text-2xs font-bold px-2 py-1 rounded-md">수정불가</span>
              )}
            </div>

            {/* 마감 안내 경고문 */}
            {isEditDeadlinePassed && (
              <div className="flex items-start gap-2.5 bg-rose-50 p-4 rounded-xl border border-rose-100 text-xs text-rose-800 leading-normal">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">수정 기한이 경과되었습니다</p>
                  <p className="mt-1">행사 준비 및 물품(티셔츠) 발주 완료로 인해, 직접적인 정보 수정이 불가능합니다. 긴급 변경 사안은 소속 교회 담당자분께 직접 연락해 주세요.</p>
                </div>
              </div>
            )}

            {/* 1. 참가 구분 */}
            <div className="flex flex-col gap-1.5 opacity-60">
              <label className="text-sm font-bold text-slate-700">참가 구분 (변경 불가)</label>
              <input
                disabled
                type="text"
                value={pType}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 cursor-not-allowed"
              />
            </div>

            {/* 2. 소속 교회 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">소속 교회</label>
              <select
                disabled={isEditDeadlinePassed}
                value={churchId}
                onChange={e => setChurchId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {churches.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* 3. 이름 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">이름</label>
              <input
                disabled={isEditDeadlinePassed}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* 4. 성별 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">성별</label>
              <div className="grid grid-cols-2 gap-2">
                {(['남', '여'] as const).map(g => (
                  <button
                    disabled={isEditDeadlinePassed}
                    type="button"
                    key={g}
                    onClick={() => setGender(g)}
                    className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all-custom border ${
                      gender === g
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    } ${isEditDeadlinePassed ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. 부서/학년 */}
            {pType === '학생' && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-700">부서 / 학년</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-100 rounded-xl">
                  {options.departments.map(dep => (
                    <button
                      disabled={isEditDeadlinePassed}
                      type="button"
                      key={dep}
                      onClick={() => setDepartment(dep)}
                      className={`py-2 px-3 rounded-lg font-semibold text-xs transition-all-custom text-center border ${
                        department === dep
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      } ${isEditDeadlinePassed ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {dep}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 6. 유아/유치 출생년도 */}
            {pType === '학생' && (department === '유아부' || department === '유치부') && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">출생년도</label>
                <div className="grid grid-cols-3 gap-2">
                  {options.birthYears.map(year => (
                    <button
                      disabled={isEditDeadlinePassed}
                      type="button"
                      key={year}
                      onClick={() => setBirthYear(year)}
                      className={`py-2.5 rounded-lg text-xs font-semibold border transition-all-custom ${
                        birthYear === year
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      } ${isEditDeadlinePassed ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 7. 역할 (교사/봉사자) */}
            {pType !== '학생' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">역할 및 직분</label>
                <input
                  disabled={isEditDeadlinePassed}
                  type="text"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            )}

            {/* 8. 연락처 */}
            {pType === '학생' ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">보호자 이름</label>
                  <input
                    disabled={isEditDeadlinePassed}
                    type="text"
                    value={guardianName}
                    onChange={e => setGuardianName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">보호자 연락처</label>
                  <input
                    disabled={isEditDeadlinePassed}
                    type="tel"
                    value={guardianPhone}
                    onChange={e => setGuardianPhone(formatPhone(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">본인 연락처</label>
                <input
                  disabled={isEditDeadlinePassed}
                  type="tel"
                  value={personalPhone}
                  onChange={e => setPersonalPhone(formatPhone(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            )}

            {/* 9. 티셔츠 사이즈 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">티셔츠 사이즈</label>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const isChildDeptActive = options.departments.some(d => 
                    d.includes('유아') || d.includes('유치') || d.includes('초등')
                  );
                  const displaySizes = isChildDeptActive 
                    ? options.shirtSizes 
                    : options.shirtSizes.filter(size => !['110', '120', '130', '140', '150'].includes(size));
                  
                  return displaySizes.map(size => (
                    <button
                      disabled={isEditDeadlinePassed}
                      type="button"
                      key={size}
                      onClick={() => setShirtSize(size)}
                      className={`py-2 px-3.5 rounded-lg text-xs font-bold border transition-all-custom ${
                        shirtSize === size
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      } ${isEditDeadlinePassed ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {size}
                    </button>
                  ));
                })()}
              </div>
            </div>

            {/* 10. 참석 일정 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">참석 일정</label>
              <div className="grid grid-cols-3 gap-2">
                {options.attendanceDates.map(dateObj => {
                  const isSelected = attendance.includes(dateObj.date);
                  return (
                    <button
                      disabled={isEditDeadlinePassed}
                      type="button"
                      key={dateObj.date}
                      onClick={() => handleAttendanceChange(dateObj.date)}
                      className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all-custom ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white font-bold shadow-md shadow-indigo-100'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      } ${isEditDeadlinePassed ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <Calendar className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span className="text-2xs font-semibold">{dateObj.label}</span>
                      <span className={`text-[9px] font-medium font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>{dateObj.date.substring(5)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 11. 미디어 노출 동의 */}
            <div className="flex items-center gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <input
                disabled={isEditDeadlinePassed}
                type="checkbox"
                id="photoConsent"
                checked={photoConsent}
                onChange={e => setPhotoConsent(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <label htmlFor="photoConsent" className="text-xs text-slate-600 leading-normal cursor-pointer select-none">
                행사 중 사진 및 영상 촬영, 연합 단체앨범 내의 인물 노출(얼굴 포함)에 동의합니다.
              </label>
            </div>

            {/* 11-2. 추가 동의서 (지방회 관리자 설정에 따름) */}
            {event?.custom_consent_enabled && (
              <div className="flex items-start gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <input
                  disabled={isEditDeadlinePassed}
                  type="checkbox"
                  id="customConsentAgreed"
                  checked={customConsentAgreed}
                  onChange={e => setCustomConsentAgreed(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mt-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <label htmlFor="customConsentAgreed" className="text-xs text-slate-600 leading-normal cursor-pointer select-none">
                  <span className="font-bold text-slate-800">
                    [{event.custom_consent_required ? '필수' : '선택'}] {event.custom_consent_title || '추가 동의서'}
                  </span>
                  {event.custom_consent_content && (
                    <p className="text-[10px] text-slate-400 mt-1 whitespace-pre-wrap leading-normal font-medium">{event.custom_consent_content}</p>
                  )}
                </label>
              </div>
            )}

            {/* 12. 건강 특이사항 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">알레르기 / 건강 특이사항</label>
              <input
                disabled={isEditDeadlinePassed}
                type="text"
                value={healthNote}
                onChange={e => setHealthNote(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* 13. 기타 메모 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">기타 전달 메모</label>
              <textarea
                disabled={isEditDeadlinePassed}
                rows={2}
                value={memo}
                onChange={e => setMemo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none"
              />
            </div>

            {errorMsg && (
              <p className="text-rose-600 text-xs font-semibold text-center bg-rose-50 py-2.5 rounded-xl border border-rose-100">
                {errorMsg}
              </p>
            )}

            {!isEditDeadlinePassed ? (
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all-custom shadow-lg shadow-indigo-100 text-sm mt-2"
              >
                <Save className="w-4 h-4" />
                수정 정보 저장하기
              </button>
            ) : (
              <button
                disabled
                className="w-full bg-slate-200 text-slate-400 font-bold py-4 rounded-2xl cursor-not-allowed text-sm mt-2"
              >
                수정할 수 없습니다 (기한 경과)
              </button>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
