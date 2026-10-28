// Offline shell: network first, cached copy when the network is gone. API calls are never cached.
const C = 'th-v1';
self.addEventListener('install', e => { self.skipWaiting();
  e.waitUntil(caches.open(C).then(c => c.addAll(['/', '/app.js', '/fresh.js', '/favicon.svg'])).catch(() => {})); });
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(r).then(x => { if (x.ok) { const cp = x.clone(); caches.open(C).then(c => c.put(r, cp)); } return x; })
    .catch(() => caches.match(r)));
});
