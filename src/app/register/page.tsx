'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/services/db';
import { Event, Church, Participant } from '@/types';
import { ArrowLeft, CheckCircle, Info, Calendar } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  
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

  useEffect(() => {
    const active = db.getActiveEvent();
    if (!active) {
      router.push('/');
      return;
    }

    // 마감 기한 검증
    const now = new Date();
    const regEnd = new Date(active.registration_end_date);
    if (now > regEnd) {
      alert('신청 기간이 마감되었습니다.');
      router.push('/');
      return;
    }

    setEvent(active);
    setChurches(db.getChurches());
    
    const opts = db.getEventOptions(active.id);
    setOptions(opts);
    
    // 기본 선택값 설정
    if (opts.departments.length > 0) setDepartment(opts.departments[0]);
    if (opts.shirtSizes.length > 0) setShirtSize(opts.shirtSizes[0]);
    if (opts.birthYears.length > 0) setBirthYear(opts.birthYears[0]);
    
    // 기본 참석일정 (전체 선택)
    setAttendance(opts.attendanceDates.map((d: { date: string; label: string }) => d.date));
  }, [router]);

  // 비밀번호 간단 해싱 함수
  const hashPassword = (pw: string) => {
    // 문자열을 뒤집고 btoa 인코딩하여 저장 (안전성 시늉)
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
              href="/"
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
        <Link href="/" className="flex items-center gap-1 text-slate-600 hover:text-slate-900 transition-all-custom">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">홈으로</span>
        </Link>
        <span className="font-bold text-slate-800">참가자 등록</span>
        <div className="w-12"></div>
      </header>

      {/* Form Area */}
      <main className="w-full max-w-md mx-auto px-4 mt-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 flex flex-col gap-5">
          {/* Header */}
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-slate-900">행사 신청 양식</h2>
            <p className="text-xs text-slate-500">참가자 본인의 인적 사항 및 참석 정보를 입력해 주세요.</p>
          </div>

          {/* 1. 참가 구분 버튼 UI */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">참가 구분</label>
            <div className="grid grid-cols-3 gap-2">
              {(['학생', '교사', '봉사자'] as const).map(type => (
                <button
                  type="button"
                  key={type}
                  onClick={() => {
                    setPType(type);
                    setErrorMsg('');
                  }}
                  className={`py-3.5 px-4 rounded-xl font-bold text-sm transition-all-custom text-center border ${
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
            >
              <option value="">-- 소속 교회를 선택해 주세요 --</option>
              {churches.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
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
              <select
                value={birthYear}
                onChange={e => setBirthYear(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
              >
                {options.birthYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          )}

          {/* 7. 학생일 때: 보호자 정보 */}
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
                  placeholder="예: 010-0000-0000"
                  value={guardianPhone}
                  onChange={e => setGuardianPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
                />
              </div>
            </>
          ) : (
            // 교사/봉사자일 때: 본인 연락처 & 역할
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">본인 연락처</label>
                <input
                  type="tel"
                  placeholder="예: 010-0000-0000"
                  value={personalPhone}
                  onChange={e => setPersonalPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">역할 / 직분</label>
                <input
                  type="text"
                  placeholder="예: 교사, 반주자, 차량 봉사 등"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
                />
              </div>
            </>
          )}

          {/* 8. 티셔츠 사이즈 선택 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">티셔츠 사이즈</label>
            <div className="flex flex-wrap gap-2">
              {options.shirtSizes.map(size => (
                <button
                  type="button"
                  key={size}
                  onClick={() => setShirtSize(size)}
                  className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all-custom border ${
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

          {/* 9. 참석 일정 선택 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">참석 일정</label>
            <div className="flex flex-col gap-2">
              {options.attendanceDates.map(d => (
                <label
                  key={d.date}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all-custom ${
                    attendance.includes(d.date)
                      ? 'bg-indigo-50/50 border-indigo-200 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={attendance.includes(d.date)}
                    onChange={() => handleAttendanceChange(d.date)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {d.label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 10. 알레르기 및 주의사항 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">알레르기 및 건강상 주의사항 (선택)</label>
            <textarea
              placeholder="예: 땅콩 알레르기 있음, 복용 중인 약 등"
              value={healthNote}
              onChange={e => setHealthNote(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring h-20 resize-none"
            />
          </div>

          {/* 11. 사진 촬영 동의 */}
          <div className="flex items-start gap-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            <input
              type="checkbox"
              id="photoConsent"
              checked={photoConsent}
              onChange={e => setPhotoConsent(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mt-0.5"
            />
            <label htmlFor="photoConsent" className="text-xs text-slate-600 leading-relaxed cursor-pointer select-none">
              <span className="font-bold text-slate-800">[사진 촬영 및 활용 동의]</span> 행사진행 중 촬영된 단체사진 및 활동사진은 교회연합행사 보고자료 및 보관용으로 사용될 수 있습니다. 동의하십니까? (미동의 시 얼굴이 노출되지 않도록 조치함)
            </label>
          </div>

          {/* 12. 수정용 비밀번호 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">수정용 비밀번호</label>
            <input
              type="password"
              placeholder="숫자 또는 문자 4글자 이상"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
            />
            <span className="text-[10px] text-slate-400">
              * 추후 개별적으로 신청 정보를 변경하고 싶을 때 필요합니다. 분실하지 않도록 유의해 주세요.
            </span>
          </div>

          {/* 12-2. 비밀번호 확인 */}
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

          {/* 13. 비고 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">기타 비고 (선택)</label>
            <input
              type="text"
              placeholder="추가 요청 사항 기재"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100 font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all-custom mt-2 text-center text-sm shadow-lg shadow-indigo-50"
          >
            참가 신청 완료하기
          </button>
        </form>
      </main>
    </div>
  );
}
