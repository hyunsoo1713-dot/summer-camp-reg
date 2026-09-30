// 정기 작업 주소 (Cloud Scheduler가 매일 밤 9시 5분쯤 부르면 좋음)
//  1) 기한이 지난 행사의 사진·명단 자동 삭제
//  2) 새 사진이 있는 행사의 밤 자동 분류
// - 누가 불러도 "삭제할 때가 된 것"만 지우므로 안전합니다. (1시간에 한 번만 실제로 확인)
// - 이 주소를 부르지 않아도, 누군가 앱을 쓸 때마다 같은 확인이 자동으로 이루어집니다.
import { NextResponse } from 'next/server';
import { maybeRunNightlyMatching, maybeRunPhotoCleanup } from '@/server/photos';

export const dynamic = 'force-dynamic';

export async function GET() {
  const r = await maybeRunPhotoCleanup();
  const matched = await maybeRunNightlyMatching();
  return NextResponse.json({ ok: true, checked: r.ran, purged: r.purged?.length || 0, matched: matched.length }, { headers: { 'Cache-Control': 'no-store' } });
}
