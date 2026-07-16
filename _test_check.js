const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const app = initializeApp({apiKey:"AIzaSyBGLUVQXqCYO7VXBa35Pq8lpHEBQwLEx6M",authDomain:"summer-event-reg.firebaseapp.com",projectId:"summer-event-reg",storageBucket:"summer-event-reg.firebasestorage.app",messagingSenderId:"287255226672",appId:"1:287255226672:web:29e6f172450cfd48a440f5"});
const db = getFirestore(app);
(async()=>{
  const ds=await getDocs(collection(db,'districts'));
  const td=ds.docs.find(d=>d.data().slug==='test');
  const tid=td.id;
  const cs=await getDocs(collection(db,'churches'));
  const tc=cs.docs.filter(c=>c.data().district_id===tid);
  
  const ps=await getDocs(collection(db,'church_payment_statuses'));
  const tp=ps.docs.filter(p=>p.data().district_id===tid);
  console.log('=== 정산 상태 (수정 후) ===');
  tp.forEach(p=>{
    const d=p.data();
    const cn=tc.find(c=>c.id===d.church_id)?.data().name||'?';
    console.log(`  ${cn}(${d.church_id}): total_amount=${d.total_amount}, status=${d.status}`);
  });
  
  const pp=await getDocs(collection(db,'participants'));
  const tpp=pp.docs.filter(p=>p.data().district_id===tid);
  console.log('\n=== 참가자 현황 ===');
  tpp.forEach(p=>{
    const d=p.data();
    const cn=tc.find(c=>c.id===d.church_id)?.data().name||'?';
    console.log(`  ${d.name}: ${cn}(${d.church_id})`);
  });
  
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
