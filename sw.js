/**
 * Service Worker for SYU Campus PWA
 * Handles caching, offline support, and background sync
 */

const CACHE_NAME = 'syu-campus-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/css/responsive.css',
    '/js/main.js',
    '/manifest.json'
];

const DYNAMIC_CACHE = 'syu-campus-dynamic-v1';
const STALE_CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Installation event
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS)
                    .catch((error) => {
                        console.warn('Failed to cache some assets:', error);
                        // Continue even if some assets fail to cache
                        return Promise.resolve();
                    });
            })
            .then(() => self.skipWaiting())
    );
});

/**
 * Activation event
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((cacheName) => {
                        return cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE;
                    })
                    .map((cacheName) => {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

/**
 * Fetch event - Network first, fall back to cache
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip external resources
    if (url.origin !== location.origin) {
        return;
    }

    // Network first for API calls and dynamic content
    if (url.pathname.includes('/api/')) {
        event.respondWith(networkFirstStrategy(request));
    } else {
        // Cache first for static assets
        event.respondWith(cacheFirstStrategy(request));
    }
});

/**
 * Cache first strategy (for static assets)
 */
async function cacheFirstStrategy(request) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);

        if (cached) {
            return cached;
        }

        // Not in cache, try network
        const response = await fetch(request);

        if (response && response.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        console.error('Cache first strategy error:', error);
        return caches.match('/index.html');
    }
}

/**
 * Network first strategy (for API calls)
 */
async function networkFirstStrategy(request) {
    try {
        const response = await fetch(request);

        if (response && response.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }

        return response;
    } catch (error) {
        console.error('Network first strategy error:', error);
        const cached = await caches.match(request);

        if (cached) {
            return cached;
        }

        // Return offline page if available
        return caches.match('/index.html');
    }
}

/**
 * Push notification event (optional)
 */
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'New notification',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/badge-72x72.png',
        tag: data.tag || 'default',
        requireInteraction: false
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'SYU Campus', options)
    );
});

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Check if window already exists
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window if doesn't exist
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

/**
 * Background sync (optional)
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    try {
        // Implementation for background sync
        console.log('Background sync triggered');
    } catch (error) {
        console.error('Background sync error:', error);
    }
}
