// 행사 사진 올리기 (지방회 관리자·교회 담당자). 올리는 즉시 사진 속 얼굴을 등록해 둡니다.
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { adminBucket, adminDb } from '@/server/firebaseAdmin';
import { HttpError } from '@/server/access';
import { assertSameOrigin, errorResponse } from '@/server/http';
import { collectionIdFor, getFaceProvider } from '@/server/faceProvider';
import { canUpload, getViewer, isPhotoExpired, photoLimitOf, photoMatchOf, type PhotoDoc, type PhotoFace } from '@/server/photos';

const MAX_FULL = 5_000_000; // 얼굴 인식(AWS)에 바로 보낼 수 있는 최대 크기 5MB
const MAX_THUMB = 600 * 1024;
const isJpeg = (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const v = await getViewer(req);
    if (!v || v.kind !== 'staff') throw new HttpError(403, '사진을 올릴 권한이 없습니다.');
    const form = await req.formData();
    const full = form.get('full');
    const thumb = form.get('thumb');
    const eventId = String(form.get('eventId') || '');
    const width = Number(form.get('width')) || undefined;
    const height = Number(form.get('height')) || undefined;
    if (!(full instanceof Blob) || !(thumb instanceof Blob)) throw new HttpError(400, '사진 파일이 없습니다.');
    if (full.size > MAX_FULL || thumb.size > MAX_THUMB) throw new HttpError(400, '사진 용량이 너무 큽니다.');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(eventId)) throw new HttpError(400, '행사 정보가 올바르지 않습니다.');

    const db = adminDb();
    const evSnap = await db.collection('events').doc(eventId).get();
    if (!evSnap.exists) throw new HttpError(404, '행사를 찾을 수 없습니다.');
    const ev = evSnap.data()!;
    const D = String(ev.district_id || '');
    if (!canUpload(v, D)) throw new HttpError(403, '사진을 올릴 권한이 없습니다.');
    const setting = photoMatchOf(ev);
    if (setting.status !== 'on') throw new HttpError(400, '이 행사는 「참가자 사진 찾기」를 사용하지 않습니다.');
    if (isPhotoExpired(ev)) throw new HttpError(400, '사진 보관 기간(행사 후 30일)이 끝난 행사입니다.');
    const limit = photoLimitOf(setting);
    const countSnap = await db.collection('photos').where('event_id', '==', eventId).count().get();
    if (countSnap.data().count >= limit) {
      throw new HttpError(400, `이 행사에 올릴 수 있는 사진(${limit.toLocaleString()}장)을 모두 채웠습니다. 더 필요하면 최고 관리자에게 문의해 주세요.`);
    }

    const fullBuf = Buffer.from(await full.arrayBuffer());
    const thumbBuf = Buffer.from(await thumb.arrayBuffer());
    if (!isJpeg(fullBuf) || !isJpeg(thumbBuf)) throw new HttpError(400, '사진 형식이 올바르지 않습니다.');

    const id = randomUUID().replace(/-/g, '');
    const base = `photos/${D}/${eventId}/${id}`;
    const bucket = adminBucket();
    await Promise.all([
      bucket.file(`${base}.jpg`).save(fullBuf, { contentType: 'image/jpeg', resumable: false }),
      bucket.file(`${base}_t.jpg`).save(thumbBuf, { contentType: 'image/jpeg', resumable: false }),
    ]);

    // 얼굴 등록 (실패하면 "사람 있음"으로 두어 관리자만 보이게 = 안전한 쪽)
    let faces: PhotoFace[] = [];
    let hasPerson = true;
    let indexError = false;
    try {
      const provider = getFaceProvider();
      const indexed = await provider.indexPhoto(collectionIdFor(eventId), fullBuf, `ph_${id}`);
      faces = indexed.map(f => ({ faceId: f.faceId, bbox: f.bbox }));
      hasPerson = faces.length > 0 ? true : await provider.hasPerson(fullBuf);
    } catch (err) {
      console.error('[face] 사진 얼굴 등록 실패', err);
      indexError = true;
    }

    const s = v.session;
    const doc: PhotoDoc & { index_error?: boolean } = {
      id,
      district_id: D,
      event_id: eventId,
      full_path: `${base}.jpg`,
      thumb_path: `${base}_t.jpg`,
      width,
      height,
      uploaded_by: s.role === 'super' ? 'super' : String(s.managerId || ''),
      uploader_name: s.name,
      created_at: new Date().toISOString(),
      faces,
      has_person: hasPerson,
      ...(indexError ? { index_error: true } : {}),
    };
    await db.collection('photos').doc(id).set(doc);
    return NextResponse.json({ ok: true, id, faces: faces.length });
  } catch (err) {
    return errorResponse(err);
  }
}
