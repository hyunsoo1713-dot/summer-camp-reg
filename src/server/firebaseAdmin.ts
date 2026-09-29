// 서버 전용: Firebase Admin SDK 초기화
// 브라우저는 더 이상 Firestore/Storage에 직접 접근하지 않고, 이 서버 계층만 데이터베이스에 접근합니다.
import { initializeApp, getApps, applicationDefault, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

let app: App | null = null;

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  // 1) 로컬 개발: FIREBASE_SERVICE_ACCOUNT_JSON 환경변수(서비스 계정 JSON 문자열)
  // 2) 로컬 개발: GOOGLE_APPLICATION_CREDENTIALS (서비스 계정 파일 경로)
  // 3) Cloud Run: 서비스에 연결된 서비스 계정(기본 자격 증명) 자동 사용
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credential = saJson ? cert(JSON.parse(saJson)) : applicationDefault();

  app = initializeApp({ credential, projectId, storageBucket });
  return app;
}

let firestore: Firestore | null = null;

export function adminDb(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getAdminApp());
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
}

export function adminBucket() {
  return getStorage(getAdminApp()).bucket();
}
