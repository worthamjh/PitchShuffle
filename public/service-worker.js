const CACHE_NAME = 'pitchshuffle-v4';
const DATA_CACHE_NAME = 'pitchshuffle-data-v4';

// Core assets to cache on install — app shell
const PRECACHE = [
    '/',
    '/stylesheets/style.css',
    '/offline.html',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
];

// Routes to cache at runtime when visited (network first, cache as fallback)
const RUNTIME_CACHE_PATTERNS = [
    /\/teams\/[^/]+\/pitchers\/game\/[^/]+/,
    /\/teams\/[^/]+\/pitchers\/game-select/,
    /\/game\//,
];

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME && key !== DATA_CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ── Message — proactive pre-cache ─────────────────────────────
// Receives { type: 'PRECACHE_GAME_URLS', urls: [...] } from the page
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'PRECACHE_GAME_URLS') {
        const urls = event.data.urls || [];
        caches.open(DATA_CACHE_NAME).then(cache => {
            urls.forEach(url => {
                fetch(url, { credentials: 'include' })
                    .then(response => {
                        if (response.ok) cache.put(url, response);
                    })
                    .catch(() => {}); // silently skip if offline
            });
        });
    }
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

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

    // Game pages — network first, cache as fallback
    if (request.mode === 'navigate' && RUNTIME_CACHE_PATTERNS.some(p => p.test(url.pathname))) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(DATA_CACHE_NAME).then(cache => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then(cached => {
                        return cached || caches.match('/offline.html');
                    });
                })
        );
        return;
    }

    // All other navigation — network first, fall back to offline page
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match(request).then(cached => cached || caches.match('/offline.html'))
            )
        );
        return;
    }
});