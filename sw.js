const CACHE_NAME = 'maxmovies-v1';
const ASSETS = [
    './',
    './index.html',
    './css/main.css',
    './css/variables.css',
    './css/utilities.css',
    './css/components.css',
    './js/app.js',
    './js/router.js',
    './js/api.js',
    './js/ui.js',
    './js/state.js',
    './js/player.js',
    './js/downloads.js',
    './js/storage.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
    // Strategy: Cache First, fallback to Network
    e.respondWith(
        caches.match(e.request).then(response => {
            return response || fetch(e.request);
        })
    );
});
