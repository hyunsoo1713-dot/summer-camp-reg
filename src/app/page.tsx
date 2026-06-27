'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { formatPhone } from '@/utils/format';
import { District } from '@/types';
import { 
  PlusCircle, CheckCircle2, ShieldAlert, ArrowRight, Info, 
  MapPin, Phone, User, Landmark, MessageSquare, ShieldCheck, Lock
} from 'lucide-react';

export default function PlatformHomePage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [config, setConfig] = useState<any>(null);
  
  // 폼 입력 상태
  const [districtName, setDistrictName] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [managerName, setManagerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [adminLoginId, setAdminLoginId] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState<string>('');
  const [adminChurchName, setAdminChurchName] = useState<string>('');
  
  // 상태 제어
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedDistrict, setSubmittedDistrict] = useState<District | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    // 승인 완료된 지방회 목록 로드
    const list = db.getDistricts().filter(d => d.status === 'approved');
    setDistricts(list);

    // 플랫폼 설정 로드
    const cfg = db.getPlatformConfig();
    setConfig(cfg);
  }, [isSubmitted]);

  const handleCopyAccount = (bankName: string, accountNo: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`${bankName} ${accountNo}`);
      alert('계좌번호가 복사되었습니다!');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!districtName.trim()) {
      setErrorMsg('지방회 연합회명을 입력해 주세요.');
      return;
    }
    if (!slug.trim()) {
      setErrorMsg('전용 URL 주소(slug)를 입력해 주세요.');
      return;
    }
    // 영문 소문자와 하이픈만 허용
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug.trim())) {
      setErrorMsg('URL 주소는 영문 소문자, 숫자, 하이픈(-)만 가능합니다.');
      return;
    }
    if (!managerName.trim()) {
      setErrorMsg('신청 목사님 성함을 입력해 주세요.');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('연락처를 입력해 주세요.');
      return;
    }
    if (!adminChurchName.trim()) {
      setErrorMsg('목사님 소속 교회명을 입력해 주세요.');
      return;
    }
    if (!adminLoginId.trim()) {
      setErrorMsg('본부 관리자로 로그인할 희망 아이디를 입력해 주세요.');
      return;
    }
    if (!adminPassword.trim()) {
      setErrorMsg('본부 관리자로 로그인할 비밀번호를 입력해 주세요.');
      return;
    }
    if (adminPassword !== adminPasswordConfirm) {
      setErrorMsg('비밀번호가 서로 일치하지 않습니다. 비밀번호를 다시 확인해 주세요.');
      return;
    }

    try {
      const newDist = db.createDistrict({
        name: districtName.trim(),
        slug: slug.trim().toLowerCase(),
        manager_name: managerName.trim(),
        phone: phone.trim(),
        admin_church_name: adminChurchName.trim()
      }, adminLoginId.trim(), adminPassword.trim(), adminChurchName.trim());

      setSubmittedDistrict(newDist);
      setIsSubmitted(true);
      
      // 입력 폼 초기화
      setDistrictName('');
      setSlug('');
      setManagerName('');
      setPhone('');
      setAdminLoginId('');
      setAdminPassword('');
      setAdminPasswordConfirm('');
      setAdminChurchName('');
      window.scrollTo(0, 0);
    } catch (err: any) {
      setErrorMsg(err.message || '신청 처리 중 오류가 발생했습니다.');
    }
  };

  // 최고 관리자 수신용 SMS 텍스트 빌더
  const getSmsHref = () => {
    if (!submittedDistrict) return '#';
    const superAdminPhone = '010-7244-7951'; // 최고 관리자(목사님) 연락처
    const message = `[여름행사플랫폼] 지방회 개설 신청 완료되었습니다. 승인 부탁드립니다. (지방회명: ${submittedDistrict.name}, 신청자: ${submittedDistrict.manager_name})`;
    // 모바일 브라우저 표준 SMS 스키마 대응
    return `sms:${superAdminPhone}?body=${encodeURIComponent(message)}`;
  };

  if (isSubmitted && submittedDistrict) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-blue-50 to-white justify-center items-center py-12 px-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl shadow-indigo-100 border border-slate-100 flex flex-col gap-6 text-center">
          <div className="mx-auto bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center text-indigo-600 mb-2">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-black text-slate-900 leading-tight">
              지방회 개설 신청 완료! 🎉
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              신청하신 정보가 접수되어 승인 대기 중입니다.
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col gap-3 text-left text-xs leading-relaxed text-slate-600">
            <p className="font-bold text-slate-800 text-sm">신청 승인 및 대기 안내</p>
            <p className="mt-1">
              - 최고 관리자의 확인 및 승인 후 서비스 이용이 가능합니다. 
            </p>
            <p className="text-rose-600 font-semibold bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100/50">
              ⚠️ 가입 승인 처리에 최대 1~2일이 소요되거나 상황에 따라 약간 지연될 수 있으니 조금만 기다려 주시기 바랍니다.
            </p>
            <p className="text-slate-500 font-medium pt-2 border-t border-slate-200 text-[10px]">
              🔒 개인정보 보호 방침: 연합 성경학교 행사가 정상 종료된 후, 아동 보호자 개인정보 보호 및 DB 비용 최적화를 위해 참가자 명단 및 조편성 데이터는 행사 마감 후 30일 이내에 영구 파기(Purge)됩니다.
            </p>
          </div>

          {/* 자율 후원 구좌 안내 */}
          <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 flex flex-col gap-2.5 text-left">
            <p className="font-bold text-indigo-900 text-xs flex items-center gap-1">
              <Landmark className="w-4 h-4 text-indigo-600" />
              자율 기부/후원 안내
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {config ? config.support_intro_description : '본 플랫폼은 여름 연합 성경학교를 지원하기 위해 무료 및 자율 후원 구좌로 운영됩니다. 플랫폼 발전과 계속된 운영을 지원해주실 교회 및 개인께서는 후원에 동참해주시면 감사하겠습니다.'}
            </p>
            <div 
              onClick={() => handleCopyAccount(config?.support_bank_name || '신한은행', config?.support_account_number || '110-111-222222')}
              className="bg-white px-3 py-2 rounded-xl border border-indigo-100 flex justify-between items-center text-xs cursor-pointer hover:bg-indigo-50 transition-colors"
              title="클릭하여 계좌번호 복사"
            >
              <span className="font-bold text-indigo-950">
                {config ? `${config.support_bank_name} ${config.support_account_number}` : '신한은행 110-111-222222'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                예금주: {config ? config.support_account_holder : '홍길동'} (클릭시 복사)
              </span>
            </div>
          </div>

          {/* 최고 관리자 문자 알림 발송 장치 (옵션 1) */}
          <div className="flex flex-col gap-2.5">
            <a
              href={getSmsHref()}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl transition-all-custom shadow-lg shadow-indigo-100 text-center text-sm"
            >
              <MessageSquare className="w-4 h-4" />
              총 관리자에게 승인 요청 문자 보내기
            </a>
            <p className="text-[10px] text-slate-400">
              (스마트폰에서 클릭 시 번호와 메시지가 자동 입력된 채 문자 앱으로 이동합니다)
            </p>
          </div>

          <button
            onClick={() => setIsSubmitted(false)}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 px-6 rounded-2xl transition-all-custom text-center text-xs"
          >
            대문 홈 화면으로 가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="w-full max-w-4xl mx-auto px-6 py-5 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            연
          </div>
          <span className="font-bold text-slate-800 text-lg">교회 연합 여름 성경학교 플랫폼</span>
        </div>
        <div>
          <Link
            href="/super-admin"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 font-semibold transition-all-custom"
          >
            <ShieldCheck className="w-4 h-4" />
            최고 관리자 포털
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* 왼쪽 섹션: 플랫폼 소개 & 개설된 지방회 리스트 */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full w-fit">
              SaaS Multi-tenancy Platform
            </span>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              {config ? config.platform_intro_title : '전국 지방회 연합 성경학교를 하나의 플랫폼으로 편리하게.'}
            </h1>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
              {config ? config.platform_intro_description : '개별 웹사이트를 따로 제작할 필요 없이, 가입 신청 한 번으로 우리 지방회 연합 성경학교만의 독자적인 참가자 수집 및 조편성 관리 화면을 즉시 생성해 드립니다.'}
            </p>
          </div>

          {/* 승인 완료된 지방회 바로가기 목록 */}
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-100 border border-slate-100 flex flex-col gap-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <MapPin className="w-4 h-4 text-indigo-600" />
              참가 등록 진행 중인 지방회 목록
            </h3>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {districts.length > 0 ? (
                districts.map(d => (
                  <Link
                    key={d.id}
                    href={`/district/${d.slug}`}
                    className="flex justify-between items-center p-3.5 bg-slate-50 hover:bg-indigo-50/50 rounded-2xl border border-slate-150 transition-all-custom text-xs font-semibold text-slate-800 hover:text-indigo-950 group"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span>{d.name}</span>
                      <span className="text-[9px] text-slate-400 font-mono">/district/{d.slug}</span>
                    </div>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full flex items-center gap-0.5 group-hover:bg-indigo-100 transition-all-custom font-bold">
                      접속
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic py-6 text-center">
                  아직 활성화된 지방회가 없습니다.<br />우측의 개설 신청을 통해 시작해 보세요!
                </span>
              )}
            </div>
          </div>
          
          {/* 자율 기부 계좌 안내 */}
          <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 flex flex-col gap-3">
            <h3 className="font-bold text-indigo-950 text-xs flex items-center gap-1">
              <Landmark className="w-4 h-4 text-indigo-600" />
              자율 기부 헌금(자율 후원) 안내
            </h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {config ? config.support_intro_description : '성경학교를 성공적으로 돕기 위해 본 연합 등록 플랫폼은 모두 무상으로 이용하실 수 있도록 개방되어 있습니다. 다만 서버 유지와 서비스 품질 향상을 위하여 자율적으로 후원을 기부받고 있으니 협조와 기도를 부탁드립니다.'}
            </p>
            <div 
              onClick={() => handleCopyAccount(config?.support_bank_name || '신한은행', config?.support_account_number || '110-111-222222')}
              className="bg-white px-4 py-3 rounded-2xl border border-indigo-150 flex justify-between items-center text-xs cursor-pointer hover:bg-indigo-50 transition-colors"
              title="클릭하여 계좌번호 복사"
            >
              <div className="flex flex-col gap-0.5 text-left">
                <span className="text-[9px] text-slate-400 font-bold uppercase">자율 후원 계좌 (클릭시 복사)</span>
                <span className="font-extrabold text-indigo-950 text-sm tracking-wide">
                  {config ? `${config.support_bank_name} ${config.support_account_number}` : '신한은행 110-111-222222'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-bold">
                예금주: {config ? config.support_account_holder : '홍길동'}
              </span>
            </div>
          </div>
        </div>

        {/* 오른쪽 섹션: 지방회 연합 가입 신청서 */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex flex-col gap-5">
          <div className="flex flex-col gap-1 border-b border-slate-100 pb-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              우리 지방회 전용 채널 개설 신청
            </h2>
            <p className="text-xs text-slate-500 font-medium">연합회 관리자 페이지와 학부모 접수 전용 링크를 제공합니다.</p>
          </div>

          {/* 지방회 명칭 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              지방회 / 연합회 명칭
            </label>
            <input
              type="text"
              placeholder="예: 일산서지방 연합회"
              value={districtName}
              onChange={e => setDistrictName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs input-focus-ring font-bold"
            />
          </div>

          {/* 영문 슬러그 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1">
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              희망 전용 URL 주소(영문 슬러그)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="예: ilsanseo"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-24 py-3 text-xs input-focus-ring font-mono text-indigo-600"
              />
              <span className="absolute right-3.5 top-3.5 text-[10px] text-slate-400 font-bold font-sans">
                .event-reg.site
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">
              영문 소문자, 숫자, 하이픈(-)만 가능하며 입력 시 <b>/district/ilsanseo</b> 주소로 연결됩니다.
            </p>
          </div>

          {/* 목사님 성함 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              신청 목사님(총괄 담당자) 성함
            </label>
            <input
              type="text"
              placeholder="예: 김일산 목사"
              value={managerName}
              onChange={e => setManagerName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs input-focus-ring font-bold"
            />
          </div>

          {/* 연락처 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              목사님 연락처
            </label>
            <input
              type="tel"
              placeholder="예: 010-1111-2222"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs input-focus-ring font-bold"
            />
          </div>

          {/* 소속 교회명 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1">
              <Landmark className="w-3.5 h-3.5 text-slate-400" />
              목사님 소속 교회명
            </label>
            <input
              type="text"
              placeholder="예: 예수인교회"
              value={adminChurchName}
              onChange={e => setAdminChurchName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs input-focus-ring font-bold"
            />
          </div>

          {/* 본부 관리자 희망 아이디 */}
          <div className="flex flex-col gap-1.5 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-50/50">
            <span className="text-xs font-bold text-indigo-900 mb-2 block">본부 관리자 계정 생성 설정</span>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  로그인 아이디
                </label>
                <input
                  type="text"
                  placeholder="예: ilsan_admin"
                  value={adminLoginId}
                  onChange={e => setAdminLoginId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs input-focus-ring font-bold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  로그인 비밀번호
                </label>
                <input
                  type="password"
                  placeholder="비밀번호 입력"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs input-focus-ring font-bold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  placeholder="비밀번호 확인 입력"
                  value={adminPasswordConfirm}
                  onChange={e => setAdminPasswordConfirm(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs input-focus-ring font-bold"
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="text-xs text-rose-600 bg-rose-50 p-3.5 rounded-xl border border-rose-100 font-semibold leading-relaxed">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-xl transition-all-custom mt-2 text-xs text-center shadow-lg shadow-slate-100 flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            연합 성경학교 전용 사이트 개설 신청
          </button>

          <div className="flex items-start gap-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100 mt-2 text-[10px] text-slate-500 leading-normal">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p>
              성경학교 등록 플랫폼은 무료 및 자율 후원금으로 운영되며, <b>개인정보 보호법 준수 및 서버 디스크 용량 관리</b>를 위해 행사 종료일로부터 30일 경과 시 참가 아동 및 보호자 개인정보는 시스템상에서 <b>영구 완전 파기(Purge)</b>됩니다.
            </p>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 text-center text-xs text-slate-400 mt-auto border-t border-slate-150">
        &copy; {new Date().getFullYear()} 교회 연합 여름 성경학교 지원 플랫폼. All rights reserved.
      </footer>
    </div>
  );
}
