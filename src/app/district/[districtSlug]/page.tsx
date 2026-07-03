'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/services/db';
import { Event, District } from '@/types';
import { Calendar, Info, ShieldAlert, Settings, ArrowRight, MapPin } from 'lucide-react';

interface PageProps {
  params: Promise<{ districtSlug: string }>;
}

export default function DistrictHomePage({ params }: PageProps) {
  const router = useRouter();
  const { districtSlug } = use(params);

  const [district, setDistrict] = useState<District | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [options, setOptions] = useState<any>({ attendanceDates: [] });
  const [statusText, setStatusText] = useState<string>('');
  const [canRegister, setCanRegister] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);

  useEffect(() => {
    // 지방회 정보 찾기
    const dist = db.getDistrictBySlug(districtSlug);
    if (!dist || dist.status !== 'approved') {
      alert('유효하지 않거나 승인 대기 중인 지방회 주소입니다.');
      router.push('/');
      return;
    }
    setDistrict(dist);

    // 해당 지방회의 활성화된 행사 가져오기
    const active = db.getActiveEvent(dist.id);
    if (active) {
      setEvent(active);
      const opts = db.getEventOptions(active.id);
      setOptions(opts);
      
      const now = new Date();
      const regStart = new Date(active.registration_start_date);
      const regEnd = new Date(active.registration_end_date);
      
      if (now < regStart) {
        setStatusText('등록 대기 중');
        setCanRegister(false);
      } else if (now > regEnd) {
        setStatusText('등록 마감');
        setCanRegister(false);
      } else {
        setStatusText('등록 가능');
        setCanRegister(true);
      }
    } else {
      setStatusText('진행 중인 행사가 없습니다.');
    }
    setLoading(false);
  }, [districtSlug, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!district) return null;

  const getEventDatesString = () => {
    if (!event) return '';
    if (options && options.attendanceDates && options.attendanceDates.length > 0) {
      return options.attendanceDates.map((ad: any) => {
        const parts = ad.date.split('-');
        const monthDay = parts.length === 3 ? `${parseInt(parts[1])}/${parseInt(parts[2])}` : ad.date;
        let dayOfWeek = '';
        const match = ad.label.match(/\((.*?)\)/);
        if (match && match[1]) {
          dayOfWeek = ` (${match[1]})`;
        }
        return `${monthDay}${dayOfWeek}`;
      }).join(', ');
    }
    return `${event.start_date} ~ ${event.end_date}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* GNB / Navigation */}
      <header className="w-full max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            {district.name.substring(0, 1)}
          </div>
          <span className="font-bold text-slate-800 text-lg">{district.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/district/${districtSlug}/login`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all-custom"
          >
            <Settings className="w-4 h-4" />
            지방회/교회 관리자
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-8 flex flex-col justify-center">
        {event ?
          <div className="flex flex-col gap-6">
            {/* 가정통신문 안내문 최상단 노출 */}
            {event.notice_image_url &&
              <div className="bg-white rounded-3xl p-5 shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden hover:scale-[1.01] transition-all duration-300">
                <div 
                  onClick={() => setShowImageModal(true)}
                  className="rounded-2xl overflow-hidden border border-slate-100/60 max-h-[450px] flex items-center justify-center bg-slate-50/50 cursor-zoom-in"
                  title="클릭하면 크게 확대하여 볼 수 있습니다"
                >
                  <img
                    src={event.notice_image_url}
                    alt="가정통신문 안내장"
                    className="w-full object-contain mx-auto max-h-[450px]"
                  />
                </div>
              </div>
            }

            <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-100 border border-slate-100 flex flex-col gap-6">
            {/* Tag / Status Badge */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                {district.name} 연합 행사
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                canRegister 
                  ? 'text-emerald-700 bg-emerald-50' 
                  : 'text-rose-700 bg-rose-50'
              }`}>
                {statusText}
              </span>
            </div>

            {/* Event Title & Description */}
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                {event.name}
              </h1>
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                {event.description}
              </p>
            </div>

            {/* Info Cards */}
            <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-medium">행사 일정</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {getEventDatesString()}
                  </span>
                </div>
              </div>
              
              <div className="flex items-start gap-3 pt-2 border-t border-slate-200">
                <Info className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-medium">등록 기간</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {event.registration_start_date} ~ {event.registration_end_date}
                  </span>
                </div>
              </div>
              
              {event.location && (
                <div className="flex items-start gap-3 pt-2 border-t border-slate-200">
                  <MapPin className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 font-medium">행사 장소</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {event.location}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Warning Message if Deadline passed */}
            {!canRegister &&
              <div className="flex items-start gap-2.5 bg-rose-50 p-3.5 rounded-xl border border-rose-100">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <p className="text-xs text-rose-800 font-semibold leading-relaxed">
                    지금은 등록 신청 기간이 아닙니다.
                  </p>
                  <p className="text-xs text-rose-600 leading-relaxed mt-0.5">
                    등록 정보 수정 또는 신규 등록 문의는 각 소속 교회의 담당자에게 연락 바랍니다.
                  </p>
                </div>
              </div>
            }

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 mt-2">
              {canRegister ?
                <Link
                  href={`/district/${districtSlug}/register`}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl transition-all-custom shadow-lg shadow-indigo-100 text-center"
                >
                  참가 신청 시작하기
                  <ArrowRight className="w-5 h-5" />
                </Link>
              :
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 bg-slate-200 text-slate-400 font-bold py-4 px-6 rounded-2xl cursor-not-allowed text-center"
                >
                  신청이 마감되었습니다
                </button>
              }

              <Link
                href={`/district/${districtSlug}/edit`}
                className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 px-6 rounded-2xl transition-all-custom text-center"
              >
                내 신청 내역 조회 / 수정
              </Link>
            </div>
          </div>
        </div>
      :
          <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 text-center flex flex-col gap-4">
            <Info className="w-12 h-12 text-slate-400 mx-auto" />
            <div>
              <p className="text-slate-600 font-semibold">아직 예정된 여름행사가 없습니다.</p>
              <p className="text-slate-400 text-xs mt-1">지방회 관리자 계정으로 로그인해 행사를 생성해 주세요.</p>
            </div>
            <div className="mt-2 flex justify-center">
              <Link
                href={`/district/${districtSlug}/login`}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all-custom"
              >
                행사 만들기 (관리자 로그인)
              </Link>
            </div>
          </div>
        }
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-slate-400 mt-auto">
        &copy; {new Date().getFullYear()} {district.name}. All rights reserved.
      </footer>

      {/* 이미지 크게 보기 모달 */}
      {showImageModal && event && event.notice_image_url && (
        <div 
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex items-center justify-center bg-white rounded-2xl p-2 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <img
              src={event.notice_image_url}
              alt="가정통신문 크게보기"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 bg-slate-800/80 hover:bg-slate-900 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs border border-slate-700/50 shadow-md transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
