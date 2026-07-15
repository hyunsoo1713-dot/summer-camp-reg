'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/services/db';
import { District, ChurchManager } from '@/types';
import { 
  ShieldAlert, CheckCircle2, XCircle, Clock, Search, 
  Settings, LogOut, ArrowRight, RefreshCw, AlertCircle, Save, Lock
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // 최고 관리자 비밀번호 수정 상태
  const [currentPw, setCurrentPw] = useState<string>('');
  const [newPw, setNewPw] = useState<string>('');
  const [newPwConfirm, setNewPwConfirm] = useState<string>('');

  const [districts, setDistricts] = useState<District[]>([]);
  const [managers, setManagers] = useState<ChurchManager[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // 플랫폼 기본 설정 및 대문 관리 탭
  const [activeTab, setActiveTab] = useState<'districts' | 'platform'>('districts');
  const [supportBankName, setSupportBankName] = useState('');
  const [supportAccountNumber, setSupportAccountNumber] = useState('');
  const [supportAccountHolder, setSupportAccountHolder] = useState('');
  const [supportIntroDescription, setSupportIntroDescription] = useState('');
  const [platformIntroTitle, setPlatformIntroTitle] = useState('');
  const [platformIntroDescription, setPlatformIntroDescription] = useState('');

  // 커스텀 모달 상태
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: 'approve' | 'reject' | 'purge' | 'delete_district' | 'approve_manager' | 'reject_manager' | null;
    targetId: string;
    targetName: string;
  }>({ show: false, type: null, targetId: '', targetName: '' });

  // 알림 토스트 상태
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  useEffect(() => {
    // URL에 reset=true가 있으면 로컬 스토리지 삭제 및 리셋
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('reset') === 'true') {
        localStorage.clear();
        sessionStorage.clear();
        // 쿼리 파라미터를 뺀 URL로 새로고침하여 깨끗한 상태 유지
        window.location.href = window.location.pathname;
        return;
      }
    }

    const initAndLoad = async () => {
      if (db.initForce) {
        await db.initForce();
      }

      // 세션 확인
      const superSess = localStorage.getItem('super_session');
      if (superSess === 'active') {
        setIsAuthenticated(true);
        loadDistricts();
      }
    };

    initAndLoad();
  }, []);

  const loadDistricts = () => {
    setDistricts(db.getDistricts());
    setManagers(db.getManagers());
    // db.getEvents() 로 플랫폼의 모든 등록된 이벤트를 긁어옵니다
    setEvents(db.getEvents());

    const config = db.getPlatformConfig();
    if (config) {
      setSupportBankName(config.support_bank_name || '');
      setSupportAccountNumber(config.support_account_number || '');
      setSupportAccountHolder(config.support_account_holder || '');
      setSupportIntroDescription(config.support_intro_description || '');
      setPlatformIntroTitle(config.platform_intro_title || '');
      setPlatformIntroDescription(config.platform_intro_description || '');
    }
  };

  const handleSavePlatformConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.updatePlatformConfig({
        support_bank_name: supportBankName,
        support_account_number: supportAccountNumber,
        support_account_holder: supportAccountHolder,
        support_intro_description: supportIntroDescription,
        platform_intro_title: platformIntroTitle,
        platform_intro_description: platformIntroDescription
      });
      triggerToast('플랫폼 설정이 성공적으로 저장되었습니다.', 'success');
      loadDistricts();
    } catch (err: any) {
      triggerToast(err.message || '저장 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const config = db.getPlatformConfig();
    const expectedPassword = config.super_admin_password || process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD || 'super123';
    if (password === expectedPassword) { // 최고관리자 비밀번호 설정
      localStorage.setItem('super_session', 'active');
      setIsAuthenticated(true);
      setLoginError('');
      loadDistricts();
    } else {
      setLoginError('비밀번호가 잘못되었습니다.');
    }
  };

  const handleChangeSuperPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPw) {
      triggerToast('현재 비밀번호를 입력해 주세요.', 'error');
      return;
    }
    if (!newPw || newPw.length < 4) {
      triggerToast('새 비밀번호는 최소 4글자 이상이어야 합니다.', 'error');
      return;
    }
    if (newPw !== newPwConfirm) {
      triggerToast('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.', 'error');
      return;
    }

    try {
      const config = db.getPlatformConfig();
      const expectedPw = config.super_admin_password || process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD || 'super123';
      if (currentPw !== expectedPw) {
        triggerToast('현재 비밀번호가 일치하지 않습니다.', 'error');
        return;
      }

      await db.updatePlatformConfig({
        super_admin_password: newPw
      });
      triggerToast('최고 관리자 비밀번호가 성공적으로 변경되었습니다.', 'success');
      setCurrentPw('');
      setNewPw('');
      setNewPwConfirm('');
    } catch (err: any) {
      triggerToast(err.message || '비밀번호 변경 중 오류가 발생했습니다.', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('super_session');
    setIsAuthenticated(false);
    setPassword('');
  };

  const openConfirmModal = (type: 'approve' | 'reject' | 'purge' | 'delete_district' | 'approve_manager' | 'reject_manager', id: string, name: string) => {
    setConfirmModal({
      show: true,
      type,
      targetId: id,
      targetName: name
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({ show: false, type: null, targetId: '', targetName: '' });
  };

  const triggerToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const getPurgeStatus = (districtId: string) => {
    const districtEvents = events.filter(e => e.district_id === districtId);
    if (districtEvents.length === 0) return { showPurge: false, isPurged: false, daysPast: 0, endDateStr: '' };
    
    // 가장 최근 행사를 기준
    const sorted = [...districtEvents].sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
    const latestEvent = sorted[0];
    if (!latestEvent.end_date) return { showPurge: false, isPurged: false, daysPast: 0, endDateStr: '' };

    const endDate = new Date(latestEvent.end_date);
    const now = new Date();
    
    const diffTime = now.getTime() - endDate.getTime();
    let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 테스트 검증 목적: URL에 test_force_purge=true가 있는 경우 날짜 차이를 강제로 41일로 설정
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('test_force_purge') === 'true') {
        diffDays = 41;
      }
    }
    
    const isPurged = !latestEvent.is_active;
    
    return {
      showPurge: diffDays >= 30 && !isPurged, // 종료 후 30일 경과했고 정리되지 않았을 시 버튼 활성화
      isPurged,
      daysPast: diffDays,
      endDateStr: latestEvent.end_date
    };
  };

  const handleConfirmAction = async () => {
    const { type, targetId, targetName } = confirmModal;
    if (!type || !targetId) return;

    try {
      if (type === 'approve') {
        db.approveDistrict(targetId);
        triggerToast(`[${targetName}] 지방회 개설 신청이 승인되었습니다.`, 'success');
      } else if (type === 'reject') {
        db.rejectDistrict(targetId);
        triggerToast(`[${targetName}] 지방회 개설 신청이 반려되었습니다.`, 'success');
      } else if (type === 'purge') {
        await db.purgeDistrictData(targetId);
        triggerToast(`[${targetName}] 지방회의 민감 개인정보 및 참가자 데이터가 영구 정리되었습니다.`, 'success');
      } else if (type === 'delete_district') {
        await db.deleteDistrictComplete(targetId);
        triggerToast(`[${targetName}] 지방회 계정 및 모든 연동 데이터가 영구 삭제되었습니다.`, 'success');
      } else if (type === 'approve_manager') {
        db.updateManager(targetId, { status: 'approved' });
        triggerToast(`[${targetName}] 지방 관리자 가입이 승인되었습니다.`, 'success');
      } else if (type === 'reject_manager') {
        db.deleteManager(targetId);
        triggerToast(`[${targetName}] 지방 관리자 가입이 반려(삭제)되었습니다.`, 'success');
      }
      loadDistricts();
    } catch (err: any) {
      triggerToast(err.message || '처리 중 오류가 발생했습니다.', 'error');
    } finally {
      closeConfirmModal();
    }
  };

  // 필터링 적용
  const filteredDistricts = districts.filter(d => {
    const matchesSearch = d.name.includes(searchTerm) || d.manager_name.includes(searchTerm);
    const matchesStatus = filterStatus ? d.status === filterStatus : true;
    return matchesSearch && matchesStatus;
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-900 justify-center items-center py-12 px-4">
        <div className="w-full max-w-md bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-700 flex flex-col gap-6 text-center">
          <div className="mx-auto bg-indigo-500/10 w-16 h-16 rounded-full flex items-center justify-center text-indigo-400 mb-2 border border-indigo-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold text-white">최고 관리자 인증</h1>
            <p className="text-sm text-slate-400">플랫폼 총괄 관리용 패널 진입을 위해 인증이 필요합니다.</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4 text-left">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-300">관리자 비밀번호</label>
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {loginError && (
              <p className="text-xs text-rose-400 font-semibold">{loginError}</p>
            )}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all-custom text-center text-sm shadow-lg shadow-indigo-900/30"
            >
              대시보드 로그인
            </button>
          </form>

          <Link href="/" className="text-xs text-slate-400 hover:text-white transition-all-custom">
            메인 홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 relative">
      {/* GNB */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-900/30">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">SaaS 플랫폼 최고 관리자 포털</h1>
            <p className="text-[10px] text-slate-400 font-medium">전체 지방회 연합 가입 건 및 격리 데이터 총괄 제어</p>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-between md:justify-end">
          <button
            onClick={loadDistricts}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-all-custom border border-slate-700"
            id="refresh-btn"
            title="새로고침"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white font-semibold transition-all-custom"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 flex gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('districts')}
          className={`py-4 px-2 font-bold text-xs border-b-2 transition-all-custom whitespace-nowrap ${
            activeTab === 'districts'
              ? 'border-indigo-500 text-white font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          지방회 가입 승인 관리
        </button>
        <button
          onClick={() => setActiveTab('platform')}
          className={`py-4 px-2 font-bold text-xs border-b-2 transition-all-custom whitespace-nowrap ${
            activeTab === 'platform'
              ? 'border-indigo-500 text-white font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          플랫폼 대문 설정 관리
        </button>
      </div>

      {/* Main Body */}
      <main className="flex-1 p-6 max-w-6xl w-full mx-auto flex flex-col gap-6">
        
        {activeTab === 'districts' && (
          <>
        {/* 통계 요약 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col gap-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase">전체 신청 지방회</span>
            <span className="text-2xl font-black text-white">{districts.length}개</span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col gap-1">
            <span className="text-[10px] text-yellow-400 font-bold uppercase">승인 대기 건</span>
            <span className="text-2xl font-black text-yellow-400">
              {districts.filter(d => d.status === 'pending').length}개
            </span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col gap-1">
            <span className="text-[10px] text-emerald-400 font-bold uppercase">승인 완료 건</span>
            <span className="text-2xl font-black text-emerald-400">
              {districts.filter(d => d.status === 'approved').length}개
            </span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex flex-col gap-1">
            <span className="text-[10px] text-rose-400 font-bold uppercase">반려 건</span>
            <span className="text-2xl font-black text-rose-400">
              {districts.filter(d => d.status === 'rejected').length}개
            </span>
          </div>
        </div>

        {/* 필터 바 */}
        <div className="flex flex-col sm:flex-row gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="지방회명 또는 담당자 이름 검색"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-850 border border-slate-850 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-850 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">상태 전체</option>
            <option value="pending">승인 대기</option>
            <option value="approved">승인 완료</option>
            <option value="rejected">반려 건</option>
          </select>
        </div>

        {/* 지방회 리스트 테이블 */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-850 border-b border-slate-800 text-slate-400 font-bold">
                  <th className="p-4">지방회 연합회명</th>
                  <th className="p-4">전용 URL 슬러그</th>
                  <th className="p-4">담당자 목사님</th>
                  <th className="p-4">연락처</th>
                  <th className="p-4">상태</th>
                  <th className="p-4">신청일자</th>
                  <th className="p-4 text-center">승인 제어</th>
                  <th className="p-4 text-center">전용 채널</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredDistricts.length > 0 ? (
                  filteredDistricts.map(d => (
                    <tr key={d.id} className="hover:bg-slate-850/30">
                      <td className="p-4 font-bold text-white">{d.name}</td>
                      <td className="p-4">
                        <span className="font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                          {d.slug}
                        </span>
                      </td>
                      <td className="p-4 font-semibold">{d.manager_name}</td>
                      <td className="p-4 font-mono">{d.phone}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${
                          d.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          d.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        }`}>
                          {d.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                          {d.status === 'rejected' && <XCircle className="w-3 h-3" />}
                          {d.status === 'pending' && <Clock className="w-3 h-3" />}
                          {d.status === 'approved' ? '승인완료' : d.status === 'rejected' ? '반려됨' : '대기중'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 text-[10px]">
                        {d.created_at ? new Date(d.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center items-center gap-2">
                          {d.status === 'pending' ? (
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => openConfirmModal('approve', d.id, d.name)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] shadow-sm transition-all-custom approve-btn"
                                >
                                  가입 승인
                                </button>
                                <button
                                  onClick={() => openConfirmModal('reject', d.id, d.name)}
                                  className="bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 font-semibold py-1.5 px-3 rounded-lg text-[10px] border border-rose-800/30 transition-all-custom reject-btn"
                                >
                                  반려
                                </button>
                              </div>
                              <button
                                onClick={() => openConfirmModal('delete_district', d.id, d.name)}
                                className="text-[9px] text-slate-500 hover:text-rose-400 transition-all-custom font-semibold delete-district-btn"
                              >
                                신청 삭제
                              </button>
                            </div>
                          ) : d.status === 'approved' ? (
                            (() => {
                              const purgeStatus = getPurgeStatus(d.id);
                              return (
                                <div className="flex flex-col items-center gap-1.5">
                                  {purgeStatus.isPurged ? (
                                    <span className="text-[10px] text-slate-400 font-semibold bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 block">
                                      정리 완료 (개인정보 파기)
                                    </span>
                                  ) : purgeStatus.showPurge ? (
                                    <>
                                      <span className="text-[9px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 block animate-pulse">
                                        종료 {purgeStatus.daysPast}일 경과 (정리 권장)
                                      </span>
                                      <button
                                        onClick={() => openConfirmModal('purge', d.id, d.name)}
                                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1 px-2.5 rounded text-[9px] shadow-sm transition-all-custom purge-btn"
                                      >
                                        개인정보 영구 정리
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-emerald-400 font-medium">정상 운영 중</span>
                                  )}
                                  <button
                                    onClick={() => openConfirmModal('delete_district', d.id, d.name)}
                                    className="text-[9px] text-slate-500 hover:text-rose-400 transition-all-custom font-semibold delete-district-btn"
                                  >
                                    계정 삭제
                                  </button>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="flex flex-col items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 font-medium">반려됨</span>
                              <button
                                onClick={() => openConfirmModal('delete_district', d.id, d.name)}
                                className="text-[9px] text-slate-500 hover:text-rose-400 transition-all-custom font-semibold delete-district-btn"
                              >
                                기록 삭제
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {d.status === 'approved' ? (
                          <Link
                            href={`/district/${d.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition-all-custom"
                          >
                            바로가기
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-slate-600 text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      신청 내역이 존재하지 않습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    )}

        {activeTab === 'platform' && (
          <>
            <form onSubmit={handleSavePlatformConfig} className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col gap-6 w-full max-w-2xl mx-auto shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Settings className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">플랫폼 대문 및 후원 설정</h2>
            </div>

            {/* 소개 설정 */}
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">1. 플랫폼 대문 소개글 설정</h3>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-300 uppercase">메인 타이틀 제목</label>
                <input
                  type="text"
                  value={platformIntroTitle}
                  onChange={e => setPlatformIntroTitle(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  placeholder="예: 전국 지방회 연합 성경학교를 하나의 플랫폼으로 편리하게."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-300 uppercase">소개 상세 설명글</label>
                <textarea
                  value={platformIntroDescription}
                  onChange={e => setPlatformIntroDescription(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none leading-relaxed"
                  placeholder="플랫폼에 대한 상세 소개글을 입력하세요."
                />
              </div>
            </div>

            <div className="border-t border-slate-800 my-1"></div>

            {/* 후원 계좌 설정 */}
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">2. 자율 후원금 수납 계좌 설정</h3>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-300 uppercase">자율 후원 안내 설명글</label>
                <textarea
                  value={supportIntroDescription}
                  onChange={e => setSupportIntroDescription(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none leading-relaxed"
                  placeholder="후원 카드 영역에 표시될 안내 설명글입니다."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-300 uppercase">은행명</label>
                  <input
                    type="text"
                    value={supportBankName}
                    onChange={e => setSupportBankName(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="예: 신한은행"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-300 uppercase">계좌번호</label>
                  <input
                    type="text"
                    value={supportAccountNumber}
                    onChange={e => setSupportAccountNumber(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    placeholder="예: 110-111-222222"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-300 uppercase">예금주</label>
                  <input
                    type="text"
                    value={supportAccountHolder}
                    onChange={e => setSupportAccountHolder(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="예: 홍길동"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all-custom text-xs shadow-md flex items-center justify-center gap-1.5 mt-2"
            >
              <Save className="w-4 h-4" />
              모든 플랫폼 설정 저장하기
            </button>
          </form>

          {/* 최고 관리자 비밀번호 변경 카드 */}
          <form onSubmit={handleChangeSuperPassword} className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col gap-6 w-full max-w-2xl mx-auto shadow-xl mt-6">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Lock className="w-5 h-5 text-rose-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">최고 관리자 비밀번호 변경</h2>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-300 uppercase">현재 비밀번호</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  placeholder="현재 비밀번호를 입력해 주세요."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-300 uppercase">새 비밀번호</label>
                  <input
                    type="password"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    placeholder="새 비밀번호 입력 (4자 이상)"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-300 uppercase">새 비밀번호 확인</label>
                  <input
                    type="password"
                    value={newPwConfirm}
                    onChange={e => setNewPwConfirm(e.target.value)}
                    className="w-full bg-slate-850 border border-slate-850 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    placeholder="새 비밀번호 다시 입력"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-xl transition-all-custom text-xs shadow-md flex items-center justify-center gap-1.5 mt-2"
            >
              <Save className="w-4 h-4" />
              비밀번호 변경 저장하기
            </button>
          </form>
        </>
      )}

      </main>

      {/* 커스텀 승인/반려 모달 */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-3xl w-full max-w-md p-6 border border-slate-800 shadow-2xl flex flex-col gap-5 text-center">
            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center border ${
              confirmModal.type === 'delete_district'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
            }`}>
              <AlertCircle className="w-6 h-6" />
            </div>
            
            <div className="flex flex-col gap-2">
              <h3 className="font-bold text-white text-base">
                {confirmModal.type === 'approve' && '지방회 개설 신청 승인'}
                {confirmModal.type === 'reject' && '지방회 개설 신청 반려'}
                {confirmModal.type === 'purge' && '오래된 지방회 참가자 데이터 영구 삭제'}
                {confirmModal.type === 'delete_district' && '지방회 연합회 계정 영구 완전 삭제'}
                {confirmModal.type === 'approve_manager' && '지방 관리자 가입 승인'}
                {confirmModal.type === 'reject_manager' && '지방 관리자 가입 반려'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line text-center">
                {confirmModal.type === 'approve' && `정말로 [${confirmModal.targetName}] 지방회 개설 신청을 승인하시겠습니까?\n승인 시 해당 지방회 전용 사이트 및 행사 세팅이 즉시 자동 생성됩니다.`}
                {confirmModal.type === 'reject' && `정말로 [${confirmModal.targetName}] 지방회 개설 신청을 반려하시겠습니까?`}
                {confirmModal.type === 'purge' && `⚠️ [${confirmModal.targetName}]의 개인정보 보호 및 DB 용량 최적화를 위해 참가자 명단, 조편성, 교회 및 결제 상태 데이터를 영구 삭제하시겠습니까?\n이 작업은 데이터베이스에서 물리적으로 데이터를 모두 제거하며 절대 복구할 수 없습니다.`}
                {confirmModal.type === 'delete_district' && `⚠️ [${confirmModal.targetName}]의 연합회 계정 자체와 행사 설정을 포함한 모든 하위 참가 데이터(교회, 참가자 등)를 완전히 삭제하시겠습니까?\n이 작업은 모든 데이터를 데이터베이스에서 즉시 물리적으로 제거하며 절대 복구할 수 없습니다.`}
                {confirmModal.type === 'approve_manager' && `정말로 [${confirmModal.targetName}] 지방 관리자의 가입 신청을 승인하시겠습니까?`}
                {confirmModal.type === 'reject_manager' && `정말로 [${confirmModal.targetName}] 지방 관리자의 가입 신청을 반려하시겠습니까?`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={closeConfirmModal}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-all-custom cancel-confirm-btn"
              >
                취소
              </button>
              <button
                onClick={handleConfirmAction}
                className={`text-white font-bold py-2.5 rounded-xl text-xs transition-all-custom submit-confirm-btn ${
                  confirmModal.type === 'approve' || confirmModal.type === 'approve_manager' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {confirmModal.type === 'approve' && '확인 (승인)'}
                {confirmModal.type === 'reject' && '확인 (반려)'}
                {confirmModal.type === 'purge' && '확인 (영구 삭제)'}
                {confirmModal.type === 'delete_district' && '확인 (완전 삭제)'}
                {confirmModal.type === 'approve_manager' && '확인 (승인)'}
                {confirmModal.type === 'reject_manager' && '확인 (반려)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 알림 토스트 */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-4 py-3.5 rounded-2xl shadow-xl flex items-center gap-2 border text-xs font-bold ${
            toast.type === 'success' 
              ? 'bg-emerald-950/90 text-emerald-400 border-emerald-800' 
              : 'bg-rose-950/90 text-rose-400 border-rose-800'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
