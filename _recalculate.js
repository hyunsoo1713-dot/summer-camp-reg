// 일산서지방(ilsanseochild) 전체 교회 정산 금액 일괄 재계산 스크립트
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');

const app = initializeApp({
  apiKey: "AIzaSyBGLUVQXqCYO7VXBa35Pq8lpHEBQwLEx6M",
  authDomain: "summer-event-reg.firebaseapp.com",
  projectId: "summer-event-reg",
  storageBucket: "summer-event-reg.firebasestorage.app",
  messagingSenderId: "287255226672",
  appId: "1:287255226672:web:29e6f172450cfd48a440f5"
});
const db = getFirestore(app);

async function main() {
  const TARGET_SLUG = 'ilsanseochild';

  // 1. 지방회 조회
  const distSnap = await getDocs(collection(db, 'districts'));
  const targetDist = distSnap.docs.find(d => d.data().slug === TARGET_SLUG);
  if (!targetDist) {
    console.log(`지방회 '${TARGET_SLUG}'를 찾을 수 없습니다.`);
    process.exit(1);
  }
  const distId = targetDist.id;
  console.log(`=== 지방회: ${targetDist.data().name} (${distId}) ===\n`);

  // 2. 해당 지방회의 교회 목록
  const churchSnap = await getDocs(collection(db, 'churches'));
  const churches = churchSnap.docs.filter(c => c.data().district_id === distId);
  console.log(`교회 수: ${churches.length}`);
  churches.forEach(c => console.log(`  - ${c.data().name} (${c.id})`));

  // 3. 해당 지방회의 참가자 목록
  const partSnap = await getDocs(collection(db, 'participants'));
  const participants = partSnap.docs.filter(p => p.data().district_id === distId).map(p => p.data());
  console.log(`\n참가자 수: ${participants.length}`);

  // 4. 이벤트 및 요금표 가져오기
  const eventSnap = await getDocs(collection(db, 'events'));
  const activeEvent = eventSnap.docs.find(e => {
    const d = e.data();
    return d.district_id === distId && d.is_active === true;
  });
  
  let baseFees = { '학생': 20000, '교사': 0, '봉사자': 0 };
  if (activeEvent) {
    const eventData = activeEvent.data();
    if (eventData.options && eventData.options.fees) {
      baseFees = eventData.options.fees;
    }
    console.log(`\n활성 이벤트: ${eventData.name} (${activeEvent.id})`);
  }
  console.log(`기본 요금: 학생=${baseFees['학생']}, 교사=${baseFees['교사']}, 봉사자=${baseFees['봉사자']}`);

  // 5. Fee Override 목록
  const overrideSnap = await getDocs(collection(db, 'church_fee_overrides'));
  const overrides = overrideSnap.docs.filter(o => o.data().district_id === distId).map(o => o.data());

  // 6. 매니저 목록 (승인된 교회 담당자)
  const managerSnap = await getDocs(collection(db, 'church_managers'));
  const managers = managerSnap.docs.filter(m => m.data().district_id === distId).map(m => m.data());

  // 7. 기존 정산 상태 조회
  const paySnap = await getDocs(collection(db, 'church_payment_statuses'));
  const payStatuses = paySnap.docs.filter(p => p.data().district_id === distId);

  console.log(`\n=== 교회별 정산 재계산 시작 ===\n`);

  for (const church of churches) {
    const churchId = church.id;
    const churchName = church.data().name;
    const churchParticipants = participants.filter(p => p.church_id === churchId);
    const churchOverrides = overrides.filter(o => o.church_id === churchId);

    // 참가비 계산
    let total = 0;
    churchParticipants.forEach(p => {
      const override = churchOverrides.find(o => o.participant_type === p.participant_type);
      if (override) {
        total += override.fee;
      } else {
        total += baseFees[p.participant_type] || 0;
      }
    });

    // 승인된 매니저 수 × 교사 요금 가산
    const approvedManagersCount = managers.filter(m => m.church_id === churchId && m.status === 'approved').length;
    const teacherOverride = churchOverrides.find(o => o.participant_type === '교사');
    const teacherFee = teacherOverride ? teacherOverride.fee : (baseFees['교사'] || 0);
    total += approvedManagersCount * teacherFee;

    // 기존 정산 레코드 찾기
    const existingCps = payStatuses.find(p => p.data().church_id === churchId);
    
    if (existingCps) {
      const oldData = existingCps.data();
      const oldTotal = oldData.total_amount;
      
      if (oldTotal !== total) {
        // 금액이 다르면 업데이트
        const updatedData = { ...oldData, total_amount: total, updated_at: new Date().toISOString() };
        
        // 납부완료 상태인데 총액이 실납부액보다 커진 경우
        if (oldData.status === '납부완료' && total > (oldData.paid_amount || 0)) {
          updatedData.status = '확인 필요';
        }
        
        await setDoc(doc(db, 'church_payment_statuses', existingCps.id), updatedData);
        console.log(`  ⚠️  ${churchName}: ${oldTotal.toLocaleString()}원 → ${total.toLocaleString()}원 (수정됨!)`);
      } else {
        console.log(`  ✅ ${churchName}: ${total.toLocaleString()}원 (변경 없음)`);
      }
    } else {
      console.log(`  ❌ ${churchName}: 정산 레코드 없음 (참가자 ${churchParticipants.length}명, 계산액 ${total.toLocaleString()}원)`);
    }
  }

  console.log(`\n=== 재계산 완료! ===`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
