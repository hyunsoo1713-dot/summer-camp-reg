self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through (네트워크로 직접 패스하여 로컬 데이터 갱신 시 오프라인 캐시 오작동을 차단합니다)
  event.respondWith(fetch(event.request));
});
