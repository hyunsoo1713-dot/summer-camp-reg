'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/services/db';
import { formatPhone } from '@/utils/format';
import { Event, Church, Participant, District } from '@/types';
import { ArrowLeft, CheckCircle, Info, Calendar } from 'lucide-react';

interface PageProps {
  params: Promise<{ districtSlug: string }>;
}

export default function RegisterPage({ params }: PageProps) {
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

  // 폼 입력 상태
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
  const [attendance, setAttendance] = useState<string[]>([]);
  const [password, setPassword] = useState<string>('');
  const [passwordConfirm, setPasswordConfirm] = useState<string>('');
  const [memo, setMemo] = useState<string>('');

  // UI 흐름 상태
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [registeredData, setRegisteredData] = useState<Participant | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 지방회 정보 조회
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

    // 마감 기한 검증
    const now = new Date();
    const regEnd = new Date(active.registration_end_date);
    if (now > regEnd) {
      alert('신청 기간이 마감되었습니다.');
      router.push(`/district/${districtSlug}`);
      return;
    }

    setEvent(active);
    
    // 해당 지방회 전용 교회들만 로드
    const distChurches = db.getChurches(dist.id);
    setChurches(distChurches);
    if (distChurches.length > 0) {
      setChurchId(distChurches[0].id);
    }
    
    const opts = db.getEventOptions(active.id);
    setOptions(opts);
    
    // 기본 선택값 설정
    if (opts.departments.length > 0) setDepartment(opts.departments[0]);
    if (opts.shirtSizes.length > 0) setShirtSize(opts.shirtSizes[0]);
    if (opts.birthYears.length > 0) setBirthYear(opts.birthYears[0]);
    
    // 기본 참석일정 (전체 선택)
    setAttendance(opts.attendanceDates.map((d: { date: string; label: string }) => d.date));
    setLoading(false);
  }, [districtSlug, router]);

  // 비밀번호 간단 해싱 함수
  const hashPassword = (pw: string) => {
    try {
      const reversed = pw.split('').reverse().join('');
      return btoa(unescape(encodeURIComponent(reversed)));
    } catch {
      return pw;
    }
  };

  const handleAttendanceChange = (date: string) => {
    if (attendance.includes(date)) {
      setAttendance(attendance.filter(d => d !== date));
    } else {
      setAttendance([...attendance, date]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!district) return;

    // 필수 유효성 검사
    if (!churchId) {
      setErrorMsg('소속 교회를 선택해주세요.');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('이름을 입력해주세요.');
      return;
    }
    if (pType === '학생') {
      if (!guardianName.trim()) {
        setErrorMsg('보호자 이름을 입력해주세요.');
        return;
      }
      if (!guardianPhone.trim()) {
        setErrorMsg('보호자 연락처를 입력해주세요.');
        return;
      }
    } else {
      if (!personalPhone.trim()) {
        setErrorMsg('본인 연락처를 입력해주세요.');
        return;
      }
    }
    if (!shirtSize) {
      setErrorMsg('티셔츠 사이즈를 선택해주세요.');
      return;
    }
    if (attendance.length === 0) {
      setErrorMsg('참석 일정을 최소 하루 이상 선택해주세요.');
      return;
    }
    if (!password || password.length < 4) {
      setErrorMsg('수정용 비밀번호는 최소 4글자 이상이어야 합니다.');
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMsg('비밀번호가 서로 일치하지 않습니다. 다시 확인해 주세요.');
      return;
    }

    try {
      const newParticipant = db.createParticipant({
        district_id: district.id, // 지방회 매핑 필수
        event_id: event!.id,
        church_id: churchId,
        participant_type: pType,
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
        attendance_schedule: attendance,
        edit_password_hash: hashPassword(password),
        memo: memo.trim()
      });

      setRegisteredData(newParticipant);
      setIsCompleted(true);
      window.scrollTo(0, 0);
    } catch (err: any) {
      setErrorMsg(err.message || '등록 중 오류가 발생했습니다.');
    }
  };

  const handleRegisterAnother = () => {
    setName('');
    setGender('남');
    if (options.departments.length > 0) setDepartment(options.departments[0]);
    if (options.birthYears.length > 0) setBirthYear(options.birthYears[0]);
    if (options.shirtSizes.length > 0) setShirtSize(options.shirtSizes[0]);
    setHealthNote('');
    setPhotoConsent(true);
    setAttendance(options.attendanceDates.map((d: { date: string; label: string }) => d.date));
    setMemo('');
    setErrorMsg('');
    setRegisteredData(null);
    setIsCompleted(false);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!district) return null;

  if (isCompleted && registeredData) {
    const selectedChurch = churches.find(c => c.id === registeredData.church_id);
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 justify-center items-center py-12 px-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-100 flex flex-col gap-6 text-center">
          <div className="mx-auto bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center text-indigo-600 mb-2">
            <CheckCircle className="w-8 h-8" />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold text-slate-900">참가 등록 완료!</h1>
            <p className="text-sm text-slate-500">행사 등록이 정상적으로 완료되었습니다.</p>
          </div>

          {/* 등록 정보 요약 카드 */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-3.5 text-left text-sm">
            <div className="flex justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500">참가자명</span>
              <span className="font-bold text-slate-800">{registeredData.name} ({registeredData.gender})</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500">소속 교회</span>
              <span className="font-semibold text-slate-800">{selectedChurch?.name || '-'}</span>
            </div>
            <div className="flex justify-between pb-2 border-b border-slate-200">
              <span className="text-slate-500">참가 구분</span>
              <span className="font-semibold text-slate-800">{registeredData.participant_type} {registeredData.department ? `/ ${registeredData.department}` : ''}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-slate-500">참석 일정</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {registeredData.attendance_schedule.map(d => {
                  const dateLabel = options.attendanceDates.find(ad => ad.date === d)?.label || d;
                  return (
                    <span key={d} className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-md">
                      {dateLabel}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 안내 및 주의사항 */}
          <div className="text-left bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex items-start gap-2.5 text-xs text-yellow-800 leading-relaxed">
            <Info className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">안내해 드립니다</p>
              <p className="mt-1">
                - 참가비 납부는 소속 교회 담당자분께서 교회를 대표해 한꺼번에 납부합니다. 참가비 금액 및 송금 관련 내용은 소속 교회 담당자분께 확인해 주세요.
              </p>
              <p className="mt-1">
                - 입력 내용을 수정하고 싶으신 경우, 홈 화면의 **&apos;내 신청 내역 조회 / 수정&apos;**에서 신청 시 설정한 비밀번호와 전화번호를 입력하여 수정하실 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleRegisterAnother}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all-custom text-center text-sm shadow-md shadow-indigo-100"
            >
              추가 자녀(참가자) 등록하기
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
        <span className="font-bold text-slate-800">참가자 등록 ({district.name})</span>
        <div className="w-12"></div>
      </header>

      {/* Form Area */}
      <main className="w-full max-w-md mx-auto px-4 mt-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 flex flex-col gap-5">
          {/* Header */}
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-slate-900">신청서 작성</h2>
            <p className="text-xs text-slate-400">행사 참가를 위한 정보를 정확하게 기입해 주세요.</p>
          </div>

          {/* 1. 참가 구분 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">참가 구분</label>
            <div className="grid grid-cols-3 gap-2">
              {(['학생', '교사', '봉사자'] as const).map(type => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setPType(type)}
                  className={`py-3 rounded-xl font-bold text-sm transition-all-custom border ${
                    pType === type
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* 2. 소속 교회 선택 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">소속 교회</label>
            <select
              value={churchId}
              onChange={e => setChurchId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              {churches.length === 0 ? (
                <option value="">등록된 교회가 없습니다</option>
              ) : (
                churches.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              )}
            </select>
          </div>

          {/* 3. 이름 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">이름</label>
            <input
              type="text"
              placeholder="예: 김하준"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
            />
          </div>

          {/* 4. 성별 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">성별</label>
            <div className="grid grid-cols-2 gap-2">
              {(['남', '여'] as const).map(g => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setGender(g)}
                  className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all-custom border ${
                    gender === g
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 5. 학생일 때: 부서/학년 버튼형 UI */}
          {pType === '학생' && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">부서 / 학년</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-100 rounded-xl">
                {options.departments.map(dep => (
                  <button
                    type="button"
                    key={dep}
                    onClick={() => setDepartment(dep)}
                    className={`py-2 px-3 rounded-lg font-semibold text-xs transition-all-custom text-center border ${
                      department === dep
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {dep}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 6. 유아부/유치부일 때: 출생년도 */}
          {pType === '학생' && (department === '유아부' || department === '유치부') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">출생년도</label>
              <div className="grid grid-cols-3 gap-2">
                {options.birthYears.map(year => (
                  <button
                    type="button"
                    key={year}
                    onClick={() => setBirthYear(year)}
                    className={`py-2.5 rounded-lg text-xs font-semibold border transition-all-custom ${
                      birthYear === year
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 7. 역할 (교사/봉사자 전용) */}
          {pType !== '학생' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">역할 및 직분</label>
              <input
                type="text"
                placeholder="예: 초등부 교사, 반주자, 안전도우미 등"
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
              />
            </div>
          )}

          {/* 8. 연락처 정보 */}
          {pType === '학생' ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">보호자 이름</label>
                <input
                  type="text"
                  placeholder="예: 김철수"
                  value={guardianName}
                  onChange={e => setGuardianName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">보호자 연락처</label>
                <input
                  type="tel"
                  placeholder="예: 010-1234-5678"
                  value={guardianPhone}
                  onChange={e => setGuardianPhone(formatPhone(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">본인 연락처</label>
              <input
                type="tel"
                placeholder="예: 010-1234-5678"
                value={personalPhone}
                onChange={e => setPersonalPhone(formatPhone(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
              />
            </div>
          )}

          {/* 9. 티셔츠 사이즈 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">티셔츠 사이즈</label>
            <div className="flex flex-wrap gap-2">
              {options.shirtSizes.map(size => (
                <button
                  type="button"
                  key={size}
                  onClick={() => setShirtSize(size)}
                  className={`py-2 px-3.5 rounded-lg text-xs font-bold border transition-all-custom ${
                    shirtSize === size
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-50'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* 10. 참석 일정 선택 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-slate-700">참석 일정</label>
              <span className="text-2xs text-slate-400">참석할 수 있는 모든 날을 선택해 주세요.</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {options.attendanceDates.map(dateObj => {
                const isSelected = attendance.includes(dateObj.date);
                return (
                  <button
                    type="button"
                    key={dateObj.date}
                    onClick={() => handleAttendanceChange(dateObj.date)}
                    className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all-custom ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Calendar className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="text-2xs font-semibold">{dateObj.label}</span>
                    <span className="text-[9px] text-slate-400 font-medium font-mono">{dateObj.date.substring(5)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 11. 미디어 노출 동의 */}
          <div className="flex items-center gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <input
              type="checkbox"
              id="photoConsent"
              checked={photoConsent}
              onChange={e => setPhotoConsent(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <label htmlFor="photoConsent" className="text-xs text-slate-600 leading-normal cursor-pointer select-none">
              행사 중 사진 및 영상 촬영, 연합 단체앨범 내의 인물 노출(얼굴 포함)에 동의합니다.
            </label>
          </div>

          {/* 개인정보 영구 파기 정책 고지 */}
          <div className="flex items-start gap-2 bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 text-[10px] text-slate-500 leading-normal">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-indigo-950 block mb-0.5">개인정보 파기 정책 안내</span>
              <p>
                수집된 참가 아동 및 보호자 개인정보(이름, 연락처, 건강 기록 등)는 성경학교 행사 관리 목적으로만 사용되며, <b>행사 종료 후 30일 이내에 시스템에서 복구 불가능하도록 완전히 영구 파기(Purge)</b> 처리됩니다.
              </p>
            </div>
          </div>

          {/* 12. 알레르기 및 건강 특이사항 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">알레르기 / 건강 특이사항</label>
            <input
              type="text"
              placeholder="예: 땅콩 알레르기 있음, 복용 중인 약 있음 등 (없으면 빈칸)"
              value={healthNote}
              onChange={e => setHealthNote(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
            />
          </div>

          {/* 13. 수정용 비밀번호 (인증용) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">신청 수정용 비밀번호 (4자리 이상)</label>
            <input
              type="password"
              placeholder="추후 신청 내역을 수정할 때 쓰입니다."
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
            />
          </div>

          {/* 13-2. 비밀번호 확인 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">비밀번호 확인</label>
            <input
              type="password"
              placeholder="비밀번호 확인 입력"
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
            />
          </div>

          {/* 14. 기타 메모 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">기타 전달 메모</label>
            <textarea
              rows={2}
              placeholder="본부 및 소속 교회 교사에게 전달하고 싶은 특이 사항을 입력해 주세요."
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring focus:outline-none"
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
            <p className="text-rose-600 text-xs font-semibold text-center bg-rose-50 py-2.5 rounded-xl border border-rose-100">
              {errorMsg}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all-custom shadow-lg shadow-indigo-100 mt-2 text-sm"
          >
            참가 신청서 제출하기
          </button>
        </form>
      </main>
    </div>
  );
}
