'use client';

// 「참가자 사진 찾기」 사진 화면 (지방회 관리자·교회 담당자·학부모 공용)
// - 사진은 고르지 않고 한꺼번에 올리기만 하면, 컴퓨터가 얼굴로 자동 분류합니다.
// - 볼 수 있는 사진은 서버가 권한에 맞게 골라서 보내 줍니다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Download, ImagePlus, Loader2, Trash2, X, ChevronLeft, ChevronRight, Sparkles, UserCheck } from 'lucide-react';
import { db } from '@/services/db';
import { koreanMonthDay, lastViewDay } from '@/utils/photoDate';

// 올리는 사진 크기: 긴 쪽 2048픽셀 → 4×6인치(10×15cm) 인화에 필요한 약 1800×1200(300dpi)보다 조금 크게
const FULL_MAX_SIDE = 2048;
const FULL_QUALITY = 0.85;
const FULL_MAX_BYTES = 4_800_000; // 서버 제한 5MB보다 조금 작게

type Kind = 'scenery' | 'matched' | 'unmatched';
interface Photo {
  id: string; kind: Kind; created_at: string; width?: number; height?: number;
  uploader_name?: string; canDelete?: boolean; people?: string[]; faceCount?: number;
}
interface ReviewItem { photoId: string; faceId: string; bbox: { left: number; top: number; width: number; height: number }; name: string; sim?: number }
interface Setting { status: 'off' | 'requested' | 'on'; expected_count: number; paid_count: number; fee_per_person: number; photos_per_person: number; delete_at?: string | null; purged_at?: string | null; expired?: boolean }
interface ListResponse {
  ok: boolean; error?: string; setting: Setting;
  viewer: { kind: 'staff'; role: string; canUpload: boolean; canManage: boolean } | { kind: 'participant'; name: string; type: string };
  photos: Photo[]; review: ReviewItem[]; total: number; limit: number;
  faceStats?: { consented: number; enrolled: number };
}

async function resizeToJpeg(file: File, maxSide: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('사진을 읽을 수 없습니다. (지원하지 않는 형식일 수 있어요)'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('사진 처리 중 오류가 발생했습니다.');
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('사진 변환 실패'))), 'image/jpeg', quality)
    );
    return { blob, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const postJson = async (url: string, body: unknown) => {
  const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || '처리하지 못했습니다.');
  return json;
};

/** 지방회 관리자: 사용 신청 / 대기 / 사용 중 안내 */
function FeatureCard({ eventId, setting, defaultCount, onChanged, isAdmin }: {
  eventId: string; setting: Setting; defaultCount: number; onChanged: () => void; isAdmin: boolean;
}) {
  const [count, setCount] = useState<string>(String(setting.expected_count || defaultCount || ''));
  const [busy, setBusy] = useState(false);
  const cfg = db.getPlatformConfig();
  const n = Math.max(0, parseInt(count || '0', 10) || 0);
  const fee = n * setting.fee_per_person;

  const act = async (action: 'request' | 'cancel') => {
    setBusy(true);
    try {
      await postJson('/api/photo-feature', { eventId, action, count: n });
      onChanged();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (setting.status === 'on') return null;

  return (
    <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        <h3 className="font-bold text-slate-900 text-base">참가자 사진 찾기</h3>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">
        행사 사진을 <b>고르지 않고 한꺼번에 올리기만</b> 하면, 컴퓨터가 얼굴을 보고 자동으로 나눠 줍니다.
        학부모는 <b>우리 아이가 나온 사진만</b>, 교회 담당자는 <b>우리 교회 참가자가 나온 사진만</b> 보게 됩니다.
        (스마트폰 사진 앱의 &lsquo;인물별 모아보기&rsquo;와 비슷한 방식)
      </p>
      <ul className="text-sm text-slate-500 list-disc pl-5 leading-relaxed">
        <li>이용료: 참가자 1명당 <b>{setting.fee_per_person}원</b> · 사진은 1명당 {setting.photos_per_person}장까지</li>
        <li>신청을 받기 <b>전에</b> 켜야 신청서에서 얼굴 사진을 받을 수 있습니다. (이미 신청한 분은 &lsquo;신청 내역 수정&rsquo;에서 올릴 수 있어요)</li>
        <li>컴퓨터 판단이라 틀릴 수 있어, 애매한 사진은 교회 담당자가 확인한 뒤 공개됩니다.</li>
      </ul>

      {!isAdmin ? (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3">이 행사는 아직 「참가자 사진 찾기」를 사용하지 않습니다. 지방회 관리자에게 문의해 주세요.</p>
      ) : setting.status === 'requested' ? (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex flex-col gap-2 text-sm text-amber-900">
          <b>사용 신청됨 · 입금 확인을 기다리는 중입니다.</b>
          <span>예상 인원 {setting.expected_count}명 × {setting.fee_per_person}원 = <b>{(setting.expected_count * setting.fee_per_person).toLocaleString()}원</b></span>
          {cfg?.support_account_number && (
            <span>입금 계좌: <b>{cfg.support_bank_name} {cfg.support_account_number}</b> (예금주 {cfg.support_account_holder})</span>
          )}
          <span className="text-xs">입금이 확인되면 최고 관리자가 켜 드립니다.</span>
          <button type="button" disabled={busy} onClick={() => act('cancel')} className="self-start mt-1 text-sm underline text-amber-800">
            신청 취소
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-700">예상 참가 인원</span>
            <input
              inputMode="numeric"
              value={count}
              onChange={e => setCount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="예: 150"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50"
            />
          </label>
          <p className="text-sm text-slate-600">
            이용료: {n.toLocaleString()}명 × {setting.fee_per_person}원 = <b className="text-indigo-700">{fee.toLocaleString()}원</b>
          </p>
          <button
            type="button"
            disabled={busy || n < 1}
            onClick={() => act('request')}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-base"
          >
            사용 신청하기
          </button>
        </div>
      )}
    </div>
  );
}

export default function PhotoAlbum({ eventId, mode, defaultCount = 0 }: { eventId?: string; mode: 'staff' | 'participant'; defaultCount?: number }) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | Kind>('all');
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const load = useCallback(async () => {
    setError('');
    try {
      const q = mode === 'staff' && eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
      const res = await fetch(`/api/photos${q}`, { credentials: 'same-origin', cache: 'no-store' });
      const json = (await res.json()) as ListResponse;
      if (!res.ok || !json.ok) throw new Error(json.error || '사진을 불러오지 못했습니다.');
      setData(json);
    } catch (e: any) {
      setError(e.message || '사진을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [eventId, mode]);

  useEffect(() => { load(); }, [load]);

  const isStaff = data?.viewer.kind === 'staff';
  const staff = isStaff ? (data!.viewer as Extract<ListResponse['viewer'], { kind: 'staff' }>) : null;

  const shown = useMemo(() => {
    const list = data?.photos || [];
    return filter === 'all' ? list : list.filter(p => p.kind === filter);
  }, [data, filter]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !eventId) return;
    const list = Array.from(files).filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name));
    setUploading(true);
    setProgress({ done: 0, total: list.length });
    let failed = 0;
    let firstError = '';
    for (let i = 0; i < list.length; i++) {
      try {
        let full = await resizeToJpeg(list[i], FULL_MAX_SIDE, FULL_QUALITY);
        // 아주 복잡한 사진이라 용량이 크면 화질을 조금만 낮춰 다시 (크기는 그대로)
        if (full.blob.size > FULL_MAX_BYTES) full = await resizeToJpeg(list[i], FULL_MAX_SIDE, 0.75);
        if (full.blob.size > FULL_MAX_BYTES) full = await resizeToJpeg(list[i], 1800, 0.7);
        const thumb = await resizeToJpeg(list[i], 480, 0.72);
        const form = new FormData();
        form.append('full', full.blob, 'full.jpg');
        form.append('thumb', thumb.blob, 'thumb.jpg');
        form.append('eventId', eventId);
        form.append('width', String(full.width));
        form.append('height', String(full.height));
        const res = await fetch('/api/photos/upload', { method: 'POST', body: form, credentials: 'same-origin' });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error || '올리기 실패');
      } catch (e: any) {
        failed++;
        if (!firstError) firstError = e.message || '올리기 실패';
      }
      setProgress({ done: i + 1, total: list.length });
    }
    setUploading(false);
    // 다 올린 뒤 자동 분류
    setMatching(true);
    try {
      await postJson('/api/photos/match', { eventId });
    } catch (e: any) {
      if (!firstError) firstError = e.message;
    } finally {
      setMatching(false);
    }
    if (failed > 0) alert(`${list.length}장 중 ${failed}장을 올리지 못했습니다.\n이유: ${firstError}`);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 사진을 지울까요? 지우면 되돌릴 수 없습니다.')) return;
    try {
      await postJson('/api/photos/delete', { ids: [id] });
      setViewIndex(null);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleReview = async (r: ReviewItem, decision: 'yes' | 'no') => {
    try {
      await postJson('/api/photos/review', { photoId: r.photoId, faceId: r.faceId, decision });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading && !data) return <div className="flex justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (error) return <div className="bg-rose-50 text-rose-700 border border-rose-100 rounded-2xl p-5 text-sm">{error}</div>;
  if (!data) return null;

  // 보관 기간이 끝나 자동 삭제된 행사
  if (data.setting.purged_at || data.setting.expired) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center text-slate-500 text-sm leading-relaxed">
        행사가 끝나고 30일이 지나 사진과 얼굴 정보를 모두 지웠습니다.
        {data.setting.purged_at && <><br />(삭제한 날: {koreanMonthDay(data.setting.purged_at)})</>}
      </div>
    );
  }

  // 사용하지 않는 행사
  if (data.setting.status !== 'on') {
    if (mode === 'staff' && eventId) {
      return <FeatureCard eventId={eventId} setting={data.setting} defaultCount={defaultCount} onChanged={load} isAdmin={!!staff?.canManage && staff.role === 'admin'} />;
    }
    return <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center text-slate-500 text-sm">이 행사는 사진 서비스를 사용하지 않습니다.</div>;
  }

  const current = viewIndex !== null ? shown[viewIndex] : null;
  const filters: { key: 'all' | Kind; label: string }[] = mode === 'participant'
    ? [
        { key: 'all', label: '모든 사진' },
        { key: 'matched', label: (data.viewer as any).type === '학생' ? '우리 아이 사진' : '내 사진' },
        { key: 'scenery', label: '풍경 사진' },
      ]
    : staff?.canManage
      ? [
          { key: 'all', label: '모든 사진' },
          { key: 'matched', label: '찾은 사진' },
          { key: 'scenery', label: '풍경 사진' },
          { key: 'unmatched', label: '못 찾은 사진' },
        ]
      : [
          { key: 'all', label: '모든 사진' },
          { key: 'matched', label: '우리 교회 사진' },
          { key: 'scenery', label: '풍경 사진' },
        ];
  const countOf = (k: 'all' | Kind) => (k === 'all' ? data.photos.length : data.photos.filter(p => p.kind === k).length);

  return (
    <div className="flex flex-col gap-5">
      {data.setting.delete_at && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 leading-relaxed">
          📅 사진은 <b>{lastViewDay(data.setting.delete_at)}까지</b> 볼 수 있어요. 그 다음 날 모두 자동으로 지워집니다.
          {mode === 'participant' ? ' 마음에 드는 사진은 미리 저장해 두세요.' : ' (행사 마지막 날 + 30일, 개인정보 보호)'}
        </p>
      )}
      {/* 올리기 */}
      {staff?.canUpload && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Camera className="w-5 h-5 text-indigo-600" /> 행사 사진 올리기
            </h3>
            <span className="text-xs text-slate-400">
              사진 {data.total.toLocaleString()}장 / 최대 {data.limit.toLocaleString()}장
            </span>
          </div>
          {data.faceStats && (
            <p className="text-sm text-slate-600">
              얼굴 사진 등록: <b>{data.faceStats.enrolled}명</b> (동의 {data.faceStats.consented}명)
              {data.faceStats.consented > data.faceStats.enrolled && (
                <span className="text-amber-700"> · {data.faceStats.consented - data.faceStats.enrolled}명은 아직 얼굴 사진이 없어 찾을 수 없어요</span>
              )}
            </p>
          )}
          <label
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base cursor-pointer transition-all-custom ${
              uploading || matching ? 'bg-slate-200 text-slate-500 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100'
            }`}
          >
            {uploading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> 올리는 중… {progress.done}/{progress.total}</>
            ) : matching ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> 얼굴로 분류하는 중…</>
            ) : (
              <><ImagePlus className="w-5 h-5" /> 사진 고르기 (여러 장 한꺼번에)</>
            )}
            <input type="file" accept="image/*" multiple disabled={uploading || matching} className="hidden" onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
          </label>
          <p className="text-xs text-slate-400">
            고르기만 하면 됩니다. 올린 뒤 컴퓨터가 얼굴로 자동 분류해 학부모와 교회 담당자에게 보여 줍니다.
            사진에 촬영 비동의 참가자가 나오지 않도록 주의해 주세요.
          </p>
        </div>
      )}

      {/* 확인이 필요한 사진 */}
      {isStaff && data.review.length > 0 && (
        <div className="bg-amber-50 rounded-3xl border border-amber-100 p-5 flex flex-col gap-4">
          <h3 className="font-bold text-amber-900 text-base flex items-center gap-2">
            <UserCheck className="w-5 h-5" /> 확인이 필요한 사진 {data.review.length}장
          </h3>
          <p className="text-sm text-amber-800">컴퓨터가 확신하지 못한 사진입니다. 맞으면 &lsquo;맞아요&rsquo;를 눌러야 학부모에게 보입니다.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.review.map(r => (
              <div key={r.photoId + r.faceId} className="bg-white rounded-2xl overflow-hidden border border-amber-100 flex flex-col">
                <div
                  className="relative bg-slate-100 overflow-hidden"
                  style={{ aspectRatio: (() => { const ph = data.photos.find(x => x.id === r.photoId); return ph?.width && ph?.height ? `${ph.width} / ${ph.height}` : '4 / 3'; })() }}
                >
                  {/* 사진 전체를 잘리지 않게 보여 줘야 얼굴 표시 위치가 맞습니다 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/photos/file/${r.photoId}?s=t`} alt="" className="w-full h-full object-fill" />
                  <div
                    className="absolute border-[3px] border-amber-400 rounded-md shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]"
                    style={{ left: `${r.bbox.left * 100}%`, top: `${r.bbox.top * 100}%`, width: `${r.bbox.width * 100}%`, height: `${r.bbox.height * 100}%` }}
                  />
                </div>
                <div className="p-3 flex flex-col gap-2">
                  <p className="text-sm text-slate-800">표시된 얼굴이 <b>{r.name}</b>인가요?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => handleReview(r, 'yes')} className="py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm">맞아요</button>
                    <button type="button" onClick={() => handleReview(r, 'no')} className="py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm">아니에요</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 분류 고르기 */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {filters.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold border transition-all-custom ${
              filter === f.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
            }`}
          >
            {f.label} <span className={filter === f.key ? 'text-indigo-100' : 'text-slate-400'}>{countOf(f.key)}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center text-slate-400 text-sm">
          {mode === 'participant' ? '아직 찾은 사진이 없습니다. 행사 사진이 올라오면 이곳에 보입니다.' : '아직 사진이 없습니다.'}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">
          {shown.map((p, i) => (
            <button key={p.id} type="button" onClick={() => setViewIndex(i)} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/file/${p.id}?s=t`} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            </button>
          ))}
        </div>
      )}

      {mode === 'participant' && (
        <p className="text-xs text-slate-400 text-center">
          컴퓨터가 찾은 사진이라 빠진 사진이 있을 수 있어요. 사진은 행사 종료 후 30일 이내 삭제되니 마음에 드는 사진은 미리 저장해 두세요.
        </p>
      )}

      {/* 크게 보기 */}
      {current && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={() => setViewIndex(null)}>
          <div className="flex items-center justify-between p-3 text-white" onClick={e => e.stopPropagation()}>
            <span className="text-sm text-white/70">
              {(viewIndex ?? 0) + 1} / {shown.length}
              {current.people && current.people.length > 0 && ` · ${current.people.join(', ')}`}
            </span>
            <button type="button" onClick={() => setViewIndex(null)} className="p-2" aria-label="닫기"><X className="w-6 h-6" /></button>
          </div>
          <div className="flex-1 flex items-center justify-center relative px-2 min-h-0" onClick={e => e.stopPropagation()}>
            {viewIndex! > 0 && (
              <button type="button" onClick={() => setViewIndex(viewIndex! - 1)} className="absolute left-1 p-2 text-white/80 bg-black/30 rounded-full" aria-label="이전">
                <ChevronLeft className="w-7 h-7" />
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/file/${current.id}?s=f`} alt="" className="max-h-full max-w-full object-contain" />
            {viewIndex! < shown.length - 1 && (
              <button type="button" onClick={() => setViewIndex(viewIndex! + 1)} className="absolute right-1 p-2 text-white/80 bg-black/30 rounded-full" aria-label="다음">
                <ChevronRight className="w-7 h-7" />
              </button>
            )}
          </div>
          <div className="p-4 flex gap-3 justify-center" onClick={e => e.stopPropagation()}>
            <a href={`/api/photos/file/${current.id}?s=f&dl=1`} className="flex items-center gap-2 bg-white text-slate-900 font-bold px-6 py-3 rounded-2xl text-base">
              <Download className="w-5 h-5" /> 휴대폰에 저장
            </a>
            {current.canDelete && (
              <button type="button" onClick={() => handleDelete(current.id)} className="flex items-center gap-2 bg-rose-600 text-white font-bold px-5 py-3 rounded-2xl text-base">
                <Trash2 className="w-5 h-5" /> 지우기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
