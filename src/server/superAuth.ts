// 서버 전용: 최고 관리자 비밀번호 확인/변경
import { adminDb } from './firebaseAdmin';
import { hashPassword, verifyPassword } from './password';

const CONFIG_ID = 'config';

/** 저장된 비밀번호(해시)가 있으면 그것으로, 없으면 서버 환경변수 SUPER_ADMIN_PASSWORD로 확인합니다. 기본값은 없습니다. */
export async function verifySuperPassword(password: string): Promise<'ok' | 'fail' | 'unset'> {
  const ref = adminDb().collection('platform_config').doc(CONFIG_ID);
  const snap = await ref.get();
  const stored = snap.exists ? snap.data()?.super_admin_password : undefined;
  if (typeof stored === 'string' && stored.length > 0) {
    const v = verifyPassword(password, stored, 'plain');
    if (v.ok && v.needsRehash) await ref.set({ super_admin_password: hashPassword(password) }, { merge: true });
    return v.ok ? 'ok' : 'fail';
  }
  const envPw = process.env.SUPER_ADMIN_PASSWORD;
  if (!envPw) return 'unset';
  return verifyPassword(password, envPw, 'plain').ok ? 'ok' : 'fail';
}

export async function setSuperPassword(newPassword: string) {
  await adminDb()
    .collection('platform_config')
    .doc(CONFIG_ID)
    .set({ id: CONFIG_ID, super_admin_password: hashPassword(newPassword), updated_at: new Date().toISOString() }, { merge: true });
}
