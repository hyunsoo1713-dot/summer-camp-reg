// 서버 전용: 카카오톡 링크 미리보기·브라우저 탭 제목에 쓸 "지방회 이름 + 행사 이름"을 가져옵니다.
// 공개해도 되는 정보(승인된 지방회 이름, 진행 중인 행사 이름·설명·안내 이미지)만 사용합니다.
import type { Metadata } from 'next';
import { adminDb } from './firebaseAdmin';

export interface DistrictMeta {
  districtName: string;
  eventName: string;
  eventDescription: string;
  image?: string;
}

export async function getDistrictMeta(slug: string): Promise<DistrictMeta | null> {
  try {
    const db = adminDb();
    const dSnap = await db.collection('districts').where('slug', '==', slug).limit(1).get();
    if (dSnap.empty) return null;
    const d = dSnap.docs[0];
    const dist = d.data();
    if (dist.status !== 'approved') return null;
    const eSnap = await db.collection('events').where('district_id', '==', d.id).get();
    const ev = eSnap.docs.map(x => x.data()).find(e => e.is_active);
    const images: string[] = Array.isArray(ev?.notice_image_urls) ? ev!.notice_image_urls : [];
    const image = images[0] || (typeof ev?.notice_image_url === 'string' ? ev.notice_image_url : undefined);
    return {
      districtName: String(dist.name || ''),
      eventName: String(ev?.name || ''),
      eventDescription: String(ev?.description || ''),
      image: image && /^https:\/\//.test(image) ? image : undefined,
    };
  } catch (err) {
    console.error('[meta] 지방회 정보 조회 실패', err);
    return null;
  }
}

/** suffix 예: '참가 신청' → "2027 겨울 수련회 참가 신청 · 일산서지방" */
export function buildDistrictMetadata(meta: DistrictMeta | null, suffix?: string): Metadata {
  if (!meta) return {};
  const head = meta.eventName ? `${meta.eventName}${suffix ? ` ${suffix}` : ''}` : suffix || '';
  const title = head ? `${head} · ${meta.districtName}` : `${meta.districtName} · 모임터`;
  const description =
    meta.eventDescription.slice(0, 120) || `${meta.districtName} 연합 행사 참가 신청 페이지입니다.`;
  return {
    title,
    description,
    openGraph: {
      siteName: '모임터',
      title,
      description,
      type: 'website',
      locale: 'ko_KR',
      ...(meta.image ? { images: [meta.image] } : {}),
    },
  };
}
