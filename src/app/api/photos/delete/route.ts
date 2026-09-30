// 사진 지우기: 지방회 관리자는 모든 사진, 교회 담당자는 자기가 올린 사진만
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { HttpError } from '@/server/access';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { collectionIdFor, getFaceProvider } from '@/server/faceProvider';
import { canDelete, deletePhotoFiles, getViewer, type PhotoDoc } from '@/server/photos';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const v = await getViewer(req);
    if (!v || v.kind !== 'staff') throw new HttpError(403, '권한이 없습니다.');
    const body = await readJson(req);
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String).slice(0, 500) : [];
    const db = adminDb();
    let deleted = 0;
    for (const id of ids) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) continue;
      const snap = await db.collection('photos').doc(id).get();
      if (!snap.exists) continue;
      const p = { ...(snap.data() as PhotoDoc), id };
      if (!canDelete(p, v)) throw new HttpError(403, '지울 수 없는 사진이 포함되어 있습니다.');
      await deletePhotoFiles(p);
      const faceIds = (p.faces || []).map(f => f.faceId).filter(Boolean);
      if (faceIds.length) await getFaceProvider().deleteFaces(collectionIdFor(p.event_id), faceIds).catch(() => {});
      await snap.ref.delete();
      deleted++;
    }
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    return errorResponse(err);
  }
}
