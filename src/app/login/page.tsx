'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/services/db';
import { Shield, UserPlus, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // 자동 로그인 처리
  useEffect(() => {
    const sessStr = localStorage.getItem('evt_session');
    if (sessStr) {
      try {
        const session = JSON.parse(sessStr);
        if (session.role === 'admin') {
          router.push('/admin');
        } else if (session.role === 'manager') {
          router.push('/manager');
        }
      } catch (e) {
        localStorage.removeItem('evt_session');
      }
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!loginId.trim() || !password.trim()) {
      setErrorMsg('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      try {
        const result = db.login(loginId.trim(), password.trim());
        
        if (result.success && result.role) {
          // 세션 저장 (Mock 인증)
          localStorage.setItem('evt_session', JSON.stringify({
            loginId: loginId.trim(),
            role: result.role,
            churchId: result.churchId,
            name: result.name
          }));

          if (result.role === 'admin') {
            router.push('/admin');
          } else {
            router.push('/manager');
          }
        } else {
          setErrorMsg(result.error || '로그인에 실패했습니다.');
        }
      } catch (err: any) {
        setErrorMsg(err.message || '로그인 처리 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }, 400); // 로딩 스피너 작동용 인위적 딜레이
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-100 flex flex-col gap-6">
        
        {/* Header */}
        <div className="text-center flex flex-col items-center gap-2">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-1">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">관리자 영역 로그인</h1>
          <p className="text-xs text-slate-400">교회 담당자 및 본부 관리자용 로그인입니다.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase">로그인 아이디</label>
            <input
              type="text"
              placeholder="아이디를 입력하세요"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm input-focus-ring"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase">비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={e => setPassword(e.target.value)}
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
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all-custom mt-2 text-sm text-center shadow-lg shadow-indigo-100 flex justify-center items-center gap-2 disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-slate-400 text-xs font-medium">또는</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Signup Request Link */}
        <div className="flex flex-col gap-2.5">
          <Link
            href="/signup-request"
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-all-custom text-xs text-center flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            교회 담당자 가입 신청하기
          </Link>
          <Link
            href="/"
            className="text-center text-xs text-slate-400 hover:underline"
          >
            일반 사용자 홈으로 이동
          </Link>
        </div>

      </div>
    </div>
  );
}
