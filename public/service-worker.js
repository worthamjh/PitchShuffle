const CACHE_NAME = 'pitchshuffle-v1';

// Core assets to cache on install — app shell
const PRECACHE = [
    '/',
    '/stylesheets/style.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
];

// ── Install — cache the app shell ────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

// ── Activate — clean up old caches ───────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch — network first, fall back to cache ─────────────────
// Navigation requests (HTML pages): network first so data is fresh.
// Static assets (CSS/JS/fonts): cache first for speed.
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET and cross-origin API/auth requests
    if (request.method !== 'GET') return;

    // Static assets — cache first
    if (
        url.pathname.startsWith('/stylesheets/') ||
        url.pathname.startsWith('/images/') ||
        url.pathname.startsWith('/javascripts/') ||
        url.hostname.includes('jsdelivr.net') ||
        url.hostname.includes('cloudinary.com')
    ) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Navigation — network first, fall back to cached home page
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match('/'))
        );
        return;
    }
});
