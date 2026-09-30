'use client';

// 신청서·신청 내역 수정 화면의 「참가자 사진 찾기」 동의 + 얼굴 사진 올리기
import { useEffect, useState } from 'react';
import { Camera, ImagePlus, CheckCircle2, AlertTriangle } from 'lucide-react';

export async function resizeImageToJpeg(file: Blob, maxSide: number, quality: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('사진을 읽을 수 없습니다. 다른 사진으로 다시 시도해 주세요.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('사진 처리 중 오류가 발생했습니다.');
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('사진 변환 실패'))), 'image/jpeg', quality)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 얼굴 사진을 서버에 등록. 실패하면 이유를 담은 오류를 던집니다. */
export async function uploadFacePhoto(participantId: string, phone: string, password: string, photo: Blob) {
  const form = new FormData();
  form.append('participantId', participantId);
  form.append('phone', phone);
  form.append('password', password);
  form.append('photo', photo, 'face.jpg');
  const res = await fetch('/api/face/enroll', { method: 'POST', body: form, credentials: 'same-origin' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || '얼굴 사진을 등록하지 못했습니다.');
}

export default function FacePhotoField({
  isStudent,
  consent,
  onConsentChange,
  photo,
  onPhotoChange,
  alreadyEnrolled,
}: {
  isStudent: boolean;
  consent: boolean;
  onConsentChange: (v: boolean) => void;
  photo: Blob | null;
  onPhotoChange: (b: Blob | null) => void;
  alreadyEnrolled?: boolean;
}) {
  const [preview, setPreview] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!photo) {
      setPreview('');
      return;
    }
    const u = URL.createObjectURL(photo);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  const handleFile = async (f: File | undefined) => {
    setError('');
    if (!f) return;
    try {
      onPhotoChange(await resizeImageToJpeg(f, 1200, 0.9));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const who = isStudent ? '우리 아이' : '본인';

  return (
    <div className="flex flex-col gap-3 bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={consent} onChange={e => onConsentChange(e.target.checked)} className="mt-1 w-5 h-5 shrink-0" />
        <div className="flex flex-col gap-1.5">
          <span className="font-bold text-slate-900 text-sm">[선택] 「참가자 사진 찾기」에 동의합니다.</span>
          <span className="text-xs text-slate-600 leading-relaxed">
            스마트폰 사진 앱의 &lsquo;인물별 모아보기&rsquo;와 비슷한 방식으로, 올려 주신 얼굴 사진과 행사 사진을 비교해 {who}가 나온 사진을 찾아 드립니다.
          </span>
          <ul className="text-xs text-slate-500 leading-relaxed list-disc pl-4">
            <li>수집 항목: 얼굴 사진, 사진에서 만든 얼굴 특징 정보</li>
            <li>처리 위탁: Amazon Web Services (얼굴 비교)</li>
            <li>보관 기간: 행사 마지막 날로부터 30일이 지나면 행사 사진과 함께 자동으로 모두 삭제</li>
            <li>정확도: 컴퓨터 판단이라 틀릴 수 있어, 애매한 사진은 교회 담당자가 확인한 뒤 공개됩니다.</li>
            <li>동의하지 않아도 행사 참가에는 아무 불이익이 없습니다. (자동 사진 전달만 받을 수 없습니다)</li>
          </ul>
        </div>
      </label>

      {consent && (
        <div className="flex flex-col gap-3 bg-white rounded-2xl p-4 border border-indigo-100">
          <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-indigo-600" />
            {isStudent ? '아이의 얼굴 사진을 올려 주세요' : '본인의 얼굴 사진(셀카)을 올려 주세요'}
          </p>
          <div className="text-xs text-slate-600 leading-relaxed flex flex-col gap-1">
            <p>✅ <b>정면</b>을 보고, <b>얼굴 전체</b>가 크게 나오게</p>
            <p>✅ <b>밝은 곳</b>에서 (창가나 불 켜진 실내)</p>
            <p>✅ <b>혼자</b> 나온 사진 (다른 사람이 같이 나오면 안 돼요)</p>
            <p>✅ <b>최근 3개월 이내</b> 사진</p>
            <p>❌ 모자, 마스크, 선글라스는 벗고 찍어 주세요</p>
            <p>❌ 얼굴을 바꾸는 필터나 보정 앱은 쓰지 마세요</p>
          </div>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            컴퓨터가 찾는 것이라 틀릴 수 있어요. 옆모습이나 멀리서 찍힌 사진은 못 찾을 수 있습니다.
          </p>

          {alreadyEnrolled && !photo && (
            <p className="text-sm text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> 얼굴 사진이 등록되어 있습니다. 바꾸려면 새 사진을 올려 주세요.
            </p>
          )}

          {preview ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="얼굴 사진 미리보기" className="w-24 h-24 object-cover rounded-2xl border border-slate-200" />
              <button type="button" onClick={() => onPhotoChange(null)} className="text-sm font-semibold text-slate-500 underline">
                다시 고르기
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm cursor-pointer">
                <Camera className="w-4 h-4" /> 바로 찍기
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <label className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm cursor-pointer">
                <ImagePlus className="w-4 h-4" /> 앨범에서 고르기
                <input type="file" accept="image/*" className="hidden" onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
