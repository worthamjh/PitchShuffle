const CACHE_NAME      = 'pitchshuffle-v4';
const DATA_CACHE_NAME = 'pitchshuffle-data-v4';

const PRECACHE = [
    '/stylesheets/style.css',
    '/offline.html',
    '/game-offline.html',   // offline game shell — served when game pages can't load
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
];

const GAME_URL_PATTERN = /\/teams\/[^/]+\/pitchers\/game\/[^/]+/;

// ── Install: cache static assets ──────────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

// ── Activate: remove old caches ───────────────────────────────────────────────
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

// ── Message: pre-cache game URLs sent from boilerplate.ejs ───────────────────
self.addEventListener('message', event => {
    if (event.data?.type !== 'PRECACHE_GAME_URLS') return;
    const urls = event.data.urls || [];
    caches.open(DATA_CACHE_NAME).then(cache => {
        urls.forEach(url => {
            fetch(url, { credentials: 'include' })
                .then(res => { if (res.ok) cache.put(url, res.clone()); })
                .catch(() => {}); // silently skip if already offline
        });
    });
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

    // Static assets — cache-first
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

    // Game pages — network-first, fall back to game-offline.html
    // (game-offline.html reads pitcher data from localStorage so it always works)
    if (request.mode === 'navigate' && GAME_URL_PATTERN.test(url.pathname)) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(DATA_CACHE_NAME).then(cache => cache.put(request, clone));
                    }
                    return response;
                })
                .catch(() =>
                    // Try the pre-cached version of this specific page first,
                    // then fall back to the universal offline game shell.
                    caches.match(request).then(cached => cached || caches.match('/game-offline.html'))
                )
        );
        return;
    }

    // All other navigation — network-first, fall back to generic offline page
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match(request).then(cached => cached || caches.match('/offline.html'))
            )
        );
        return;
    }
});