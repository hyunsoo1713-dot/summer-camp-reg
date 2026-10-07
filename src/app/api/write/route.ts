// 모든 저장·수정·삭제 요청이 거치는 API. 서버가 권한을 확인한 뒤에만 DB에 반영합니다.
import { NextRequest, NextResponse } from 'next/server';
import { getSession, setSessionCookie, type Session } from '@/server/session';
import { applyWrites, HttpError, type EditAuth, type WriteOp, type WriteResult } from '@/server/access';
import { assertSameOrigin, errorResponse, readJson } from '@/server/http';
import { assertNotBlocked, clearFailures, limitKeys, recordFailure, type LimitKey } from '@/server/rateLimit';
import { adminDb } from '@/server/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const body = await readJson(req);
    const ops = body?.ops as WriteOp[];
    const editAuth = body?.editAuth as EditAuth | undefined;
    const session = await getSession(req);

    // 학부모 본인 수정: 요청에 들어 있는 모든 참가자에 대해 시도 횟수를 셈 (비밀번호 확인 전에 먼저 기록)
    const guarded = !session && !!editAuth;
    let rl: LimitKey[] = [];
    if (guarded) {
      const ids = Array.from(
        new Set(
          (Array.isArray(ops) ? ops : [])
            .filter(o => o && (o as { col?: string }).col === 'participants')
            .map(o => String((o as { id?: string }).id || ''))
        )
      ).slice(0, 5);
      if (ids.length === 0) ids.push('none');
      rl = ids.flatMap((id, i) => {
        const k = limitKeys(req, 'participant-edit', id);
        return i === 0 ? k : k.filter(x => x.kind === 'account'); // IP는 요청당 한 번만 셈
      });
      await assertNotBlocked(rl);
    }
    try {
      const result = await applyWrites(session, ops, editAuth);
      if (guarded) await clearFailures(rl);
      const res = NextResponse.json({ ok: true, ...result });
      await refreshOwnSession(req, session, result, res);
      return res;
    } catch (err) {
      if (guarded && err instanceof HttpError && err.status === 403) await recordFailure(rl);
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}

/** 관리자가 자기 계정 비밀번호를 이 화면에서 바꾼 경우, 지금 기기의 로그인은 유지 (다른 기기는 끊김) */
async function refreshOwnSession(req: NextRequest, session: Session | null, result: WriteResult, res: NextResponse) {
  if (!session?.managerId) return;
  if (!result.changed.some(c => c.col === 'church_managers' && c.id === session.managerId)) return;
  const snap = await adminDb().collection('church_managers').doc(session.managerId).get();
  const sv = Number(snap.data()?.session_version || 0);
  if (sv !== Number(session.sv || 0)) {
    const { exp: _exp, ...rest } = session;
    setSessionCookie(res, { ...rest, sv });
  }
}
