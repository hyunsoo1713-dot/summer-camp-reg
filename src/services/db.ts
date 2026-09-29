import { apiDb } from './apiDb';

// 모든 화면이 사용하는 데이터 접근 지점입니다.
// 브라우저는 Firestore에 직접 접근하지 않고, apiDb가 서버 API(/api/...)를 통해 읽고 씁니다.
// (예전의 mockDb/firebaseDb 직접 접근 방식은 보안상 사용하지 않습니다.)
export const db = apiDb;
