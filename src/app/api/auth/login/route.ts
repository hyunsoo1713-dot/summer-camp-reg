// 지방회 관리자 / 교회 담당자 로그인
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { burnPasswordCheck, hashPassword, verifyPassword } from '@/server/password';
import { setSessionCookie, type Session } from '@/server/session';
import { HttpError } from '@/server/access';
import { assertSameOrigin, errorResponse, publicSession, readJson } from '@/server/http';
import { assertNotBlocked, clearFailures, limitKeys, recordFailure } from '@/server/rateLimit';

const FAIL = '아이디 또는 비밀번호가 잘못되었습니다.';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = await readJson(req);
    const loginId = String(body?.loginId || '').trim();
    const password = String(body?.password || '');
    const districtSlug = String(body?.districtSlug || '').trim();
    if (!loginId || !password || !districtSlug) throw new HttpError(400, '아이디와 비밀번호를 입력해주세요.');

    const rl = limitKeys(req, 'login', `${districtSlug}:${loginId}`);
    await assertNotBlocked(rl);

    const db = adminDb();
    const distSnap = await db.collection('districts').where('slug', '==', districtSlug).limit(1).get();
    const dist = distSnap.empty ? null : { ...distSnap.docs[0].data(), id: distSnap.docs[0].id } as Record<string, any>;
    if (!dist || dist.status !== 'approved') throw new HttpError(400, '유효하지 않은 지방회입니다.');

    const mSnap = await db.collection('church_managers').where('login_id', '==', loginId).get();
    const candidates = mSnap.docs.filter(d => d.data().district_id === dist.id);

    let matched: { id: string; data: Record<string, any> } | null = null;
    for (const d of candidates) {
      const data = d.data();
      const v = verifyPassword(password, data.password_hash, 'plain');
      if (v.ok) {
        matched = { id: d.id, data };
        if (v.needsRehash) await d.ref.update({ password_hash: hashPassword(password) });
        break;
      }
    }
    if (candidates.length === 0) burnPasswordCheck(password); // 없는 아이디도 같은 시간이 걸리게
    if (!matched) {
      await recordFailure(rl);
      throw new HttpError(401, FAIL);
    }
    await clearFailures(rl);

    const m = matched.data;
    if (m.status !== 'approved') {
      throw new HttpError(403, '아직 승인되지 않은 계정입니다. 본부 관리자의 승인을 기다려 주세요.');
    }

    const isAdmin = (m.is_admin as boolean | undefined) ?? (m.church_id === '');
    let session: Omit<Session, 'exp'>;
    if (isAdmin) {
      session = {
        role: 'admin',
        loginId,
        managerId: matched.id,
        districtId: dist.id,
        districtSlug,
        sv: Number(m.session_version || 0),
        churchId: '',
        name: dist.name ? `${dist.name} 관리자` : `${m.name} (본부 관리자)`,
      };
    } else {
      const churchSnap = m.church_id ? await db.collection('churches').doc(String(m.church_id)).get() : null;
      const churchName = churchSnap?.exists ? String(churchSnap.data()?.name || '') : '';
      session = {
        role: 'manager',
        loginId,
        managerId: matched.id,
        districtId: dist.id,
        districtSlug,
        sv: Number(m.session_version || 0),
        churchId: String(m.church_id || ''),
        name: churchName ? `${churchName} 담당자 (${m.name})` : `담당자 (${m.name})`,
      };
    }

    const res = NextResponse.json({
      ok: true,
      success: true,
      role: session.role,
      churchId: session.churchId,
      name: session.name,
      session: publicSession({ ...session, exp: 0 }),
    });
    setSessionCookie(res, session);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
