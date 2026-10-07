// 정기 작업 주소 (Cloud Scheduler가 하루 한 번 부르면 좋음)
// - 행사 마지막 날로부터 30일이 지난 행사의 명단을 자동 영구 삭제
// - 누가 불러도 "삭제할 때가 된 것"만 지우므로 안전합니다. (1시간에 한 번만 실제로 확인)
// - 이 주소를 부르지 않아도, 누군가 앱을 쓸 때마다 같은 확인이 자동으로 이루어집니다.
import { NextResponse } from 'next/server';
import { maybeRunRetentionCleanup } from '@/server/retention';

export const dynamic = 'force-dynamic';

export async function GET() {
  const r = await maybeRunRetentionCleanup();
  return NextResponse.json({ ok: true, checked: r.ran, purged: r.purged?.length || 0 }, { headers: { 'Cache-Control': 'no-store' } });
}
