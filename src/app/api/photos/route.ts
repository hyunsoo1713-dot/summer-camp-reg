// 사진 목록: 보는 사람의 권한에 맞는 사진만 돌려줍니다.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { HttpError } from '@/server/access';
import { errorResponse } from '@/server/http';
import {
  canDelete, canUpload, canView, getViewer, isStaffAll, isPhotoExpired, maybeRunPhotoCleanup, photoDeleteAt, photoKind, photoLimitOf, photoMatchOf, reviewableFaces,
  FEE_PER_PERSON, PHOTOS_PER_PERSON, type PhotoDoc,
} from '@/server/photos';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await maybeRunPhotoCleanup();
    const v = await getViewer(req);
    if (!v) throw new HttpError(401, '로그인이 필요합니다.');
    const db = adminDb();

    const eventId =
      v.kind === 'participant' ? String(v.participant.event_id || '') : String(req.nextUrl.searchParams.get('eventId') || '');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(eventId)) throw new HttpError(400, '행사 정보가 올바르지 않습니다.');
    const evSnap = await db.collection('events').doc(eventId).get();
    if (!evSnap.exists) throw new HttpError(404, '행사를 찾을 수 없습니다.');
    const ev = evSnap.data()!;
    const D = String(ev.district_id || '');
    if (v.kind === 'staff' && v.session.role !== 'super' && v.session.districtId !== D) throw new HttpError(403, '권한이 없습니다.');
    if (v.kind === 'participant' && v.participant.district_id !== D) throw new HttpError(403, '권한이 없습니다.');

    const setting = photoMatchOf(ev);
    const limit = photoLimitOf(setting);
    const deleteAt = photoDeleteAt(ev);
    const expired = isPhotoExpired(ev);

    const photoSnap = await db.collection('photos').where('event_id', '==', eventId).get();
    const all = expired ? [] : photoSnap.docs.map(d => ({ ...(d.data() as PhotoDoc), id: d.id })).filter(p => p.district_id === D);
    const visible = all
      .filter(p => canView(p, v))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    // 담당자·관리자: 이름 표시용 참가자 정보 (자기 권한 범위만)
    const names = new Map<string, string>();
    if (v.kind === 'staff') {
      const pq = isStaffAll(v)
        ? db.collection('participants').where('district_id', '==', D)
        : db.collection('participants').where('church_id', '==', v.session.churchId || '-');
      (await pq.get()).docs.forEach(d => names.set(d.id, String(d.data().name || '')));
    }

    let faceStats: { consented: number; enrolled: number } | undefined;
    if (v.kind === 'staff') {
      const ps = await db.collection('participants').where('event_id', '==', eventId).get();
      const mine = ps.docs.map(d => d.data()).filter(p => isStaffAll(v) || p.church_id === v.session.churchId);
      faceStats = { consented: mine.filter(p => p.face_consent === true).length, enrolled: mine.filter(p => p.face_consent === true && p.face_id).length };
    }

    const review =
      v.kind === 'staff'
        ? visible.flatMap(p =>
            reviewableFaces(p, v).map(f => ({ photoId: p.id, faceId: f.faceId, bbox: f.bbox, name: names.get(f.pid!) || '참가자', sim: f.sim }))
          )
        : [];

    const res = NextResponse.json({
      ok: true,
      setting: {
        status: setting.status,
        expected_count: setting.expected_count || 0,
        paid_count: setting.paid_count || 0,
        fee_per_person: FEE_PER_PERSON,
        photos_per_person: PHOTOS_PER_PERSON,
        delete_at: deleteAt ? deleteAt.toISOString() : null,
        purged_at: expired ? setting.purged_at || null : null,
        expired,
      },
      viewer:
        v.kind === 'participant'
          ? { kind: 'participant', name: v.participant.name, type: v.participant.participant_type }
          : { kind: 'staff', role: v.session.role, canUpload: canUpload(v, D) && setting.status === 'on' && !expired, canManage: isStaffAll(v) },
      photos: visible.map(p => {
        const kind = photoKind(p);
        const base = { id: p.id, kind, created_at: p.created_at, width: p.width, height: p.height };
        if (v.kind === 'participant') return base;
        const people = Array.from(
          new Set((p.faces || []).filter(f => f.pid && (f.state === 'auto' || f.state === 'confirmed')).map(f => names.get(f.pid!) || ''))
        ).filter(Boolean);
        return { ...base, uploader_name: p.uploader_name, canDelete: canDelete(p, v), people, faceCount: (p.faces || []).length };
      }),
      review,
      total: all.length,
      limit,
      faceStats,
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
