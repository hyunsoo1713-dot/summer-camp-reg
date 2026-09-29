import type { Metadata } from 'next';
import { buildDistrictMetadata, getDistrictMeta } from '@/server/publicMeta';

// 지방회 페이지의 탭 제목·카카오톡 미리보기: "행사 이름 · 지방회 이름"
export async function generateMetadata({ params }: { params: Promise<{ districtSlug: string }> }): Promise<Metadata> {
  const { districtSlug } = await params;
  return buildDistrictMetadata(await getDistrictMeta(districtSlug));
}

export default function DistrictLayout({ children }: { children: React.ReactNode }) {
  return children;
}
