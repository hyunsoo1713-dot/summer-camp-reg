self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // 안드로이드 웹뷰(카카오톡, 인스타그램 등) 및 모바일 브라우저에서 
  // event.respondWith(fetch(event.request)) 사용 시 네비게이션 요청이 실패하여
  // 'This page couldn't load (페이지를 읽을 수 없음)' 오류가 발생하는 현상을 원천 차단합니다.
  // PWA 설치 요건을 충족하기 위해 fetch 이벤트 리스너만 유지하고 네이티브 네트워크에 위임합니다.
  return;
});
