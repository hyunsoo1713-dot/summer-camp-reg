import { mockDb } from './mockDb';
import { firebaseDb } from './firebaseDb';

// 이 파일은 Firebase DB 레이어와 Mock DB 레이어를 스위칭하기 위한 통합 브릿지입니다.
// NEXT_PUBLIC_USE_MOCK_DB가 'false'인 경우 실제 Firebase Firestore를 활성화합니다.

const useMock = () => {
  if (typeof window === 'undefined') return true;
  return process.env.NEXT_PUBLIC_USE_MOCK_DB !== 'false';
};

export const db = (useMock() ? mockDb : firebaseDb) as typeof mockDb;


