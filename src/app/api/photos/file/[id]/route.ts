// 사진 파일 보기: 볼 권한이 있는 사람에게만 서버가 직접 사진을 보내 줍니다. (주소를 알아도 남은 못 봄)
import { NextRequest } from 'next/server';
import { adminBucket, adminDb } from '@/server/firebaseAdmin';
import { HttpError } from '@/server/access';
import { errorResponse } from '@/server/http';
import { canView, getViewer, reviewableFaces, type PhotoDoc } from '@/server/photos';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new HttpError(400, '잘못된 요청입니다.');
    const v = await getViewer(req);
    if (!v) throw new HttpError(401, '로그인이 필요합니다.');
    const snap = await adminDb().collection('photos').doc(id).get();
    if (!snap.exists) throw new HttpError(404, '사진을 찾을 수 없습니다.');
    const photo = { ...(snap.data() as PhotoDoc), id: snap.id };
    if (!canView(photo, v) && reviewableFaces(photo, v).length === 0) throw new HttpError(403, '볼 수 없는 사진입니다.');

    const size = req.nextUrl.searchParams.get('s') === 'f' ? 'full' : 'thumb';
    const [buf] = await adminBucket().file(size === 'full' ? photo.full_path : photo.thumb_path).download();
    const headers: Record<string, string> = {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    };
    if (req.nextUrl.searchParams.get('dl') === '1') {
      headers['Content-Disposition'] = `attachment; filename="moimteo_${id.slice(0, 8)}.jpg"`;
    }
    return new Response(new Uint8Array(buf), { status: 200, headers });
  } catch (err) {
    return errorResponse(err);
  }
}
