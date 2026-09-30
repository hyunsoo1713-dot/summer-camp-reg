'use client';

// 학부모·참가자용 "우리 아이 사진 보기 / 내 사진 보기"
// 앱 설치 없이, 신청할 때 쓴 이름·연락처·비밀번호로 들어옵니다.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Images, LogOut } from 'lucide-react';
import { db } from '@/services/db';
import { formatPhone } from '@/utils/format';
import { District } from '@/types';
import PhotoAlbum from '@/components/PhotoAlbum';

export default function ParticipantPhotosPage() {
  const params = useParams();
  const router = useRouter();
  const districtSlug = params.districtSlug as string;

  const [district, setDistrict] = useState<District | null>(null);
  const [checking, setChecking] = useState(true);
  const [viewer, setViewer] = useState<{ name: string; type: string } | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dist = db.getDistrictBySlug(districtSlug);
    if (!dist || dist.status !== 'approved') {
      alert('유효하지 않은 지방회입니다.');
      router.push('/');
      return;
    }
    setDistrict(dist);
    // 이미 들어와 있는지(2시간 출입증) 확인
    fetch('/api/photos', { credentials: 'same-origin', cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (j?.ok && j.viewer?.kind === 'participant') setViewer({ name: j.viewer.name, type: j.viewer.type });
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [districtSlug, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!district) return;
    if (!name.trim() || !phone.trim() || !password) {
      setError('모든 칸을 입력해 주세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/photos/viewer', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ districtId: district.id, name: name.trim(), phone: phone.trim(), password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || '확인하지 못했습니다.');
      setViewer({ name: json.name, type: json.type });
      setPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/photos/viewer', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logout: true }),
    }).catch(() => {});
    setViewer(null);
  };

  if (checking || !district) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  const title = viewer ? (viewer.type === '학생' ? `${viewer.name} 어린이 사진` : `${viewer.name}님 사진`) : '참가자 사진 보기';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link href={`/district/${districtSlug}`} className="flex items-center gap-1 text-sm text-slate-600 font-semibold">
          <ArrowLeft className="w-4 h-4" /> 처음으로
        </Link>
        <h1 className="font-bold text-slate-900 text-base">{title}</h1>
        {viewer ? (
          <button type="button" onClick={handleLogout} className="flex items-center gap-1 text-sm text-slate-500 font-semibold">
            <LogOut className="w-4 h-4" /> 나가기
          </button>
        ) : <span className="w-16" />}
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-4">
        {viewer ? (
          <PhotoAlbum mode="participant" />
        ) : (
          <form onSubmit={handleLogin} className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex flex-col gap-5 max-w-md mx-auto mt-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Images className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-black text-slate-900">행사 사진 보기</h2>
              <p className="text-sm text-slate-500">
                신청할 때 입력한 정보로 들어오시면<br />우리 아이(또는 내)가 속한 조·교회의 사진과 전체 사진을 볼 수 있습니다.
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-slate-700">참가자 이름</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 김하준" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-slate-700">연락처</span>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(formatPhone(e.target.value))}
                placeholder="학생은 보호자 번호, 교사·봉사자는 본인 번호"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-slate-700">신청 비밀번호</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="신청 시 입력한 비밀번호" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50" />
            </label>

            {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</p>}

            <button type="submit" disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl text-base">
              {busy ? '확인 중…' : '사진 보기'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
