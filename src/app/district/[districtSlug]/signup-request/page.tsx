'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/services/db';
import { formatPhone } from '@/utils/format';
import { Church, District } from '@/types';
import { ArrowLeft, UserPlus, Info, CheckCircle2, Shirt } from 'lucide-react';

interface PageProps {
  params: Promise<{ districtSlug: string }>;
}

export default function DistrictSignupRequestPage({ params }: PageProps) {
  const router = useRouter();
  const { districtSlug } = use(params);
  
  const [district, setDistrict] = useState<District | null>(null);
  const [churches, setChurches] = useState<Church[]>([]);
  
  // 폼 필드
  const [useExistingChurch, setUseExistingChurch] = useState<boolean>(true);
  const [selectedChurchId, setSelectedChurchId] = useState<string>('');
  const [newChurchName, setNewChurchName] = useState<string>('');
  const [managerName, setManagerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [loginId, setLoginId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordConfirm, setPasswordConfirm] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [shirtSize, setShirtSize] = useState<string>('');
  const [shirtSizes, setShirtSizes] = useState<string[]>(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']);

  // UI 상태
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const dist = db.getDistrictBySlug(districtSlug);
    if (!dist || dist.status !== 'approved') {
      alert('유효하지 않거나 승인 대기 중인 지방회 주소입니다.');
      router.push('/');
      return;
    }
    setDistrict(dist);
    setChurches(db.getChurches(dist.id));
    // 행사 옵션에서 티셔츠 사이즈 목록 로드
    const activeEvent = db.getActiveEvent(dist.id);
    if (activeEvent) {
      const opts = db.getEventOptions(activeEvent.id);
      if (opts.shirtSizes && opts.shirtSizes.length > 0) {
        setShirtSizes(opts.shirtSizes);
        setShirtSize(opts.shirtSizes[0]);
      }
    }
    setLoading(false);
  }, [districtSlug, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!district) return;

    const finalChurchName = useExistingChurch 
      ? churches.find(c => c.id === selectedChurchId)?.name 
      : newChurchName.trim();

    if (useExistingChurch && !selectedChurchId) {
      setErrorMsg('소속 교회를 선택해 주세요.');
      return;
    }
    if (!useExistingChurch && !newChurchName.trim()) {
      setErrorMsg('신규 교회명을 입력해 주세요.');
      return;
    }
    if (!managerName.trim()) {
      setErrorMsg('담당자 이름을 입력해 주세요.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('담당자 연락처를 입력해 주세요.');
      return;
    }
    if (!loginId.trim()) {
      setErrorMsg('아이디를 입력해 주세요.');
      return;
    }
    if (!password || password.length < 4) {
      setErrorMsg('비밀번호는 최소 4글자 이상이어야 합니다.');
      return;
    }
    if (password !== passwordConfirm) {
      setErrorMsg('비밀번호가 서로 일치하지 않습니다. 다시 확인해 주세요.');
      return;
    }

    try {
      // 1. 기존 교회 선택인 경우, 교회 ID 세팅. 신규 교회 입력인 경우 임시 church_id 처리
      let targetChurchId = selectedChurchId;
      let finalMemo = memo.trim();
      
      if (!useExistingChurch) {
        targetChurchId = 'temp_new_church'; // 승인 단계에서 본부 관리자가 실제 교회를 생성해 매칭함
        finalMemo = `[신규교회 신청: ${newChurchName.trim()}] ` + finalMemo;
      }

      db.createManager({
        district_id: district.id,
        church_id: targetChurchId,
        name: managerName.trim(),
        phone: phone.trim(),
        login_id: loginId.trim(),
        password_hash: password,
        memo: finalMemo,
        is_admin: false,
        is_manager: true,
        shirt_size: shirtSize || undefined,
        requested_church_name: !useExistingChurch ? newChurchName.trim() : undefined
      }, false); // autoApprove = false (승인 대기)

      setIsSubmitted(true);
      window.scrollTo(0, 0);
    } catch (err: any) {
      setErrorMsg(err.message || '가입 신청 중 오류가 발생했습니다.');
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

  if (isSubmitted) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 justify-center items-center py-12 px-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-100 flex flex-col gap-6 text-center">
          <div className="mx-auto bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center text-indigo-600 mb-2">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold text-slate-900">가입 신청 완료!</h1>
            <p className="text-sm text-slate-500">담당자 계정 승인 신청이 정상 접수되었습니다.</p>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-3 text-left text-xs leading-relaxed text-slate-600">
            <p className="font-bold text-slate-800 text-sm">신청 승인 절차 안내</p>
            <p className="mt-1">
              - 신청하신 계정은 **{district.name} 연합본부 관리자**의 검토 및 승인을 거쳐 최종 활성화됩니다.
            </p>
            <p>
              - 가입 신청이 승인되면 입력하신 아이디와 비밀번호로 로그인하여 대시보드 및 소속 교회 등록자 관리가 가능합니다.
            </p>
            <p>
              - 승인 처리는 보통 1~2일 내에 완료됩니다. 확인이 급하신 경우 연합본부 담당자에게 문의 바랍니다.
            </p>
          </div>

          <Link
            href={`/district/${districtSlug}/login`}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 px-6 rounded-2xl transition-all-custom text-center text-sm"
          >
            로그인 화면으로 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-12">
      {/* GNB */}
      <header className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10">
        <Link href={`/district/${districtSlug}/login`} className="flex items-center gap-1 text-slate-600 hover:text-slate-900 transition-all-custom">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-semibold">로그인으로</span>
        </Link>
        <span className="font-bold text-slate-800">{district.name} 교회 담당자 가입 신청</span>
        <div className="w-12"></div>
      </header>

      <main className="w-full max-w-md mx-auto px-4 mt-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-md border border-slate-100 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-slate-900">가입 신청서 작성</h2>
            <p className="text-xs text-slate-500">교회 대표자/담당자 계정 생성을 위한 정보입니다.</p>
          </div>

          {/* 교회 선택 방식 분기 */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-slate-700">소속 교회 구분</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUseExistingChurch(true)}
                className={`py-2.5 px-4 rounded-xl font-bold text-xs transition-all-custom text-center border ${
                  useExistingChurch
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                목록에서 소속교회 선택
              </button>
              <button
                type="button"
                onClick={() => setUseExistingChurch(false)}
                className={`py-2.5 px-4 rounded-xl font-bold text-xs transition-all-custom text-center border ${
                  !useExistingChurch
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                신규 교회명 직접 입력
              </button>
            </div>
          </div>

          {/* 소속 교회 선택/입력 */}
          {useExistingChurch ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">소속 교회 선택</label>
              <select
                value={selectedChurchId}
                onChange={e => setSelectedChurchId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
              >
                <option value="">-- 교회를 선택하세요 --</option>
                {churches.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">신규 교회명 입력</label>
              <input
                type="text"
                placeholder="예: 영광교회"
                value={newChurchName}
                onChange={e => setNewChurchName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
              />
            </div>
          )}

          {/* 담당자 이름 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">담당자 이름</label>
            <input
              type="text"
              placeholder="예: 홍길동"
              value={managerName}
              onChange={e => setManagerName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
            />
          </div>

          {/* 연락처 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">담당자 연락처</label>
            <input
              type="tel"
              placeholder="예: 010-0000-0000"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
            />
          </div>

          {/* 로그인 아이디 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">희망 로그인 아이디</label>
            <input
              type="text"
              placeholder="영문, 숫자 4자 이상"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
            />
          </div>

          {/* 비밀번호 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">로그인 비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호 4자 이상"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
            />
          </div>

          {/* 비밀번호 확인 */}
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

          {/* 티셔츠 사이즈 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <Shirt className="w-4 h-4 text-slate-500" />
              티셔츠 사이즈
            </label>
            <div className="grid grid-cols-4 gap-2">
              {shirtSizes.map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setShirtSize(size)}
                  className={`py-2.5 rounded-xl font-bold text-sm transition-all-custom border ${
                    shirtSize === size
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* 비고 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">기타 비고 (신청 사유 등)</label>
            <textarea
              placeholder="본부 관리자에게 전달할 메모"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring h-20 resize-none"
            />
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100 font-semibold">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all-custom mt-2 text-sm text-center shadow-lg shadow-indigo-100 flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-5 h-5" />
            가입 신청 제출하기
          </button>
        </form>
      </main>
    </div>
  );
}
