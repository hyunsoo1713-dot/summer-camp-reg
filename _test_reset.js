// 테스트: Student A를 Church X로 되돌린 뒤, Firestore 정산 상태도 원복
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
  const partSnap = await getDocs(collection(db, 'participants'));
  const studentA = partSnap.docs.find(d => d.data().name === 'Student A');
  if (!studentA) { console.log('Student A not found'); process.exit(1); }

  const pData = studentA.data();
  console.log('BEFORE: Student A church_id:', pData.church_id);

  const churchXId = 'ch-kja2mv4k0';
  const churchYId = 'ch-z4bo011bl';
  
  // Church X로 원복
  pData.church_id = churchXId;
  pData.updated_at = new Date().toISOString();
  await setDoc(doc(db, 'participants', studentA.id), pData);
  console.log('Student A → Church X 원복 완료');

  // 정산 세팅
  const paySnap = await getDocs(collection(db, 'church_payment_statuses'));
  const cpsX = paySnap.docs.find(d => d.data().church_id === churchXId);
  const cpsY = paySnap.docs.find(d => d.data().church_id === churchYId);

  if (cpsX) {
    const xData = cpsX.data();
    xData.total_amount = 20000;
    xData.updated_at = new Date().toISOString();
    await setDoc(doc(db, 'church_payment_statuses', cpsX.id), xData);
    console.log('Church X 정산: 20000');
  }
  if (cpsY) {
    const yData = cpsY.data();
    yData.total_amount = 0;
    yData.updated_at = new Date().toISOString();
    await setDoc(doc(db, 'church_payment_statuses', cpsY.id), yData);
    console.log('Church Y 정산: 0');
  }

  console.log('원복 완료!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
