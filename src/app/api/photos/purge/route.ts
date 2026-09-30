// 지방회 사진 전부 삭제 (최고 관리자 또는 해당 지방회 관리자). 명단 정리·지방회 삭제 때 함께 호출됩니다.
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/server/session';
import { HttpError } from '@/server/access';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { purgeDistrictPhotos } from '@/server/photos';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const s = await getSession(req);
    const body = await readJson(req);
    const districtId = String(body?.districtId || '');
    if (!s || !(s.role === 'super' || (s.role === 'admin' && s.districtId === districtId))) {
      throw new HttpError(403, '권한이 없습니다.');
    }
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(districtId)) throw new HttpError(400, '잘못된 요청입니다.');
    const deleted = await purgeDistrictPhotos(districtId);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    return errorResponse(err);
  }
}
