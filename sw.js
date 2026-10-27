// Service worker: keeps the app files available offline.
// Bump the version in CACHE whenever you change any file listed below,
// so installed copies pick up the new files.
const CACHE = 'djlvorne-v2';
const FILES = [
  './', './index.html', './auth.js', './firebase-config.js',
  './prompts.js', './manifest.webmanifest', './icon.svg'
];

self.addEventListener('install', e => {
  // add files one by one so a single missing file does not break installing
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(FILES.map(f => c.add(f)))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so edits show up right away), cache as the offline fallback.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
