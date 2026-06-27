'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/services/db';
import { Event, Church, Participant } from '@/types';
import { ArrowLeft, Search, Save, Info, ShieldAlert, CheckCircle2, Calendar } from 'lucide-react';

export default function EditPage() {
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
  const [attendance, setAttendance] = useState<string[]>([]);
  const [memo, setMemo] = useState<string>('');

  // 마감 상태
  const [isEditDeadlinePassed, setIsEditDeadlinePassed] = useState<boolean>(false);
  
  // 상태 알림
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  useEffect(() => {
    const active = db.getActiveEvent();
    if (!active) {
      router.push('/');
      return;
    }
    setEvent(active);
    setChurches(db.getChurches());
    setOptions(db.getEventOptions(active.id));

    // 수정 마감일 확인
    const now = new Date();
    const deadline = new Date(active.edit_deadline);
    if (now > deadline) {
      setIsEditDeadlinePassed(true);
    }
  }, [router]);

  // 비밀번호 해시 매칭
  const hashPassword = (pw: string) => {
    try {
      const reversed = pw.split('').reverse().join('');
      return btoa(unescape(encodeURIComponent(reversed)));
    } catch {
      return pw;
    }
  };

  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!searchName.trim() || !searchPhone.trim() || !searchPassword.trim()) {
      setErrorMsg('모든 값을 입력해 주세요.');
      return;
    }

    const participants = db.getParticipants();
    const targetHash = hashPassword(searchPassword);

    // 이름, 연락처(학생은 보호자폰, 교사는 본인폰), 비밀번호 해시 매칭
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

    // 인증 완료 및 편집 데이터 적재
    setCurrentParticipant(found);
    setIsAuthenticated(true);
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
    setAttendance(found.attendance_schedule);
    setMemo(found.memo || '');
  };

  const handleAttendanceChange = (date: string) => {
    if (isEditDeadlinePassed) return; // 수정 마감이면 차단
    if (attendance.includes(date)) {
      setAttendance(attendance.filter(d => d !== date));
    } else {
      setAttendance([...attendance, date]);
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (isEditDeadlinePassed) {
      setErrorMsg('수정 가능 기간이 마감되었습니다.');
      return;
    }

    if (!name.trim()) {
      setErrorMsg('이름을 입력해 주세요.');
      return;
    }

    if (pType === '학생') {
      if (!guardianName.trim() || !guardianPhone.trim()) {
        setErrorMsg('보호자 이름 및 연락처를 입력해 주세요.');
        return;
      }
    } else {
      if (!personalPhone.trim()) {
        setErrorMsg('본인 연락처를 입력해 주세요.');
        return;
      }
    }

    if (attendance.length === 0) {
      setErrorMsg('참석 일정을 최소 하루 이상 선택해 주세요.');
      return;
    }

    try {
      db.updateParticipant(currentParticipant!.id, {
        participant_type: pType,
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
        attendance_schedule: attendance,
        memo: memo.trim()
      });

      setSuccessMsg('등록 정보가 성공적으로 수정되었습니다.');
      window.scrollTo(0, 0);
    } catch (err: any) {
      setErrorMsg(err.message || '수정 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-12">
      {/* GNB */}
      <header className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-1 text-slate-600 hover:text-slate-900 transition-all-custom">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">홈으로</span>
        </Link>
        <span className="font-bold text-slate-800">신청 내역 조회 / 수정</span>
        <div className="w-12"></div>
      </header>

      <main className="w-full max-w-md mx-auto px-4 mt-6">
        {/* 1단계: 인증 화면 */}
        {!isAuthenticated ? (
          <form onSubmit={handleAuthenticate} className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-slate-900">본인 확인 인증</h2>
              <p className="text-xs text-slate-500">참가 신청 시 작성한 세 가지 정보를 입력해 주세요.</p>
            </div>

            {/* 이름 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">참가자 이름</label>
              <input
                type="text"
                placeholder="참가 신청한 학생/교사 이름"
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
              />
            </div>

            {/* 연락처 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">연락처</label>
              <input
                type="tel"
                placeholder="학생은 보호자폰, 교사는 본인폰"
                value={searchPhone}
                onChange={e => setSearchPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
              />
            </div>

            {/* 비밀번호 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">수정용 비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호 4자리 이상"
                value={searchPassword}
                onChange={e => setSearchPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
              />
            </div>

            {errorMsg && (
              <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100 font-semibold">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all-custom mt-2 text-sm shadow-md"
            >
              <Search className="w-4 h-4" />
              신청 정보 불러오기
            </button>
          </form>
        ) : (
          // 2단계: 편집 정보 폼
          <form onSubmit={handleUpdate} className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">등록 신청서 수정</h2>
                <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full">인증 완료</span>
              </div>
              <p className="text-xs text-slate-500">인적 사항 및 참석 일정을 수정할 수 있습니다.</p>
            </div>

            {/* 수정 가능 마감 마킹 */}
            {isEditDeadlinePassed && (
              <div className="flex items-start gap-2.5 bg-rose-50 p-4 rounded-xl border border-rose-100 text-xs text-rose-800 leading-relaxed">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">수정 가능 기간이 종료되었습니다.</p>
                  <p className="mt-0.5">수정이 필요한 경우 소속 교회 담당자에게 직접 문의하여 주시기 바랍니다.</p>
                </div>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {successMsg}
              </div>
            )}

            {errorMsg && (
              <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100 font-semibold">
                {errorMsg}
              </div>
            )}

            {/* 1. 참가 구분 버튼 UI */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">참가 구분</label>
              <div className="grid grid-cols-3 gap-2">
                {(['학생', '교사', '봉사자'] as const).map(type => (
                  <button
                    disabled={isEditDeadlinePassed}
                    type="button"
                    key={type}
                    onClick={() => setPType(type)}
                    className={`py-3 px-4 rounded-xl font-bold text-sm transition-all-custom text-center border ${
                      pType === type
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    } ${isEditDeadlinePassed ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. 소속 교회 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">소속 교회</label>
              <select
                disabled={isEditDeadlinePassed}
                value={churchId}
                onChange={e => setChurchId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
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
                <select
                  disabled={isEditDeadlinePassed}
                  value={birthYear}
                  onChange={e => setBirthYear(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {options.birthYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 7. 학생 정보 vs 교사 정보 */}
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
                    onChange={e => setGuardianPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">본인 연락처</label>
                  <input
                    disabled={isEditDeadlinePassed}
                    type="tel"
                    value={personalPhone}
                    onChange={e => setPersonalPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">역할 / 직분</label>
                  <input
                    disabled={isEditDeadlinePassed}
                    type="text"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </>
            )}

            {/* 8. 티셔츠 사이즈 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-slate-700">티셔츠 사이즈</label>
              <div className="flex flex-wrap gap-2">
                {options.shirtSizes.map(size => (
                  <button
                    disabled={isEditDeadlinePassed}
                    type="button"
                    key={size}
                    onClick={() => setShirtSize(size)}
                    className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all-custom border ${
                      shirtSize === size
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-50'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    } ${isEditDeadlinePassed ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* 9. 참석 일정 */}
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
                    } ${isEditDeadlinePassed ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <input
                      disabled={isEditDeadlinePassed}
                      type="checkbox"
                      checked={attendance.includes(d.date)}
                      onChange={() => handleAttendanceChange(d.date)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 disabled:opacity-60"
                    />
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      {d.label}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 10. 알레르기/주의사항 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">알레르기 및 건강상 주의사항 (선택)</label>
              <textarea
                disabled={isEditDeadlinePassed}
                value={healthNote}
                onChange={e => setHealthNote(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring h-20 resize-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* 11. 사진 촬영 동의 */}
            <div className="flex items-start gap-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
              <input
                disabled={isEditDeadlinePassed}
                type="checkbox"
                id="photoConsent"
                checked={photoConsent}
                onChange={e => setPhotoConsent(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 mt-0.5 disabled:opacity-60"
              />
              <label htmlFor="photoConsent" className="text-xs text-slate-600 leading-relaxed cursor-pointer select-none">
                <span className="font-bold text-slate-800">[사진 촬영 및 활용 동의]</span> 동의 여부 수정
              </label>
            </div>

            {/* 12. 비고 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">기타 비고 (선택)</label>
              <input
                disabled={isEditDeadlinePassed}
                type="text"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* Submit Button */}
            {!isEditDeadlinePassed ? (
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all-custom mt-2 text-sm shadow-md"
              >
                <Save className="w-4 h-4" />
                수정 사항 저장하기
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="w-full bg-slate-200 text-slate-400 font-bold py-4 rounded-2xl cursor-not-allowed text-sm text-center"
              >
                수정할 수 없습니다 (기간 종료)
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsAuthenticated(false);
                setCurrentParticipant(null);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-2xl transition-all-custom text-sm text-center"
            >
              다른 사람 내역 찾기
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
