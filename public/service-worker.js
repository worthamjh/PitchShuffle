const CACHE_NAME = 'pitchshuffle-v3';
const DATA_CACHE_NAME = 'pitchshuffle-data-v3';

const PRECACHE = [
    '/',
    '/stylesheets/style.css',
    '/offline.html',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.css',
];

const RUNTIME_CACHE_PATTERNS = [
    /\/teams\/[^/]+\/pitchers\/game\/[^/]+/,
    /\/teams\/[^/]+\/pitchers\/game-select/,
    /\/game\//,
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

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

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method !== 'GET') return;

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

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match(request).then(cached => cached || caches.match('/offline.html'))
            )
        );
        return;
    }
});