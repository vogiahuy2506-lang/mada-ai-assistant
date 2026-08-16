// MADA AI Assistant - Service Worker
// Provides offline support, caching, and background sync

const CURRENT_CACHE_VERSION = 'v2';
const STATIC_CACHE = `mada-static-${CURRENT_CACHE_VERSION}`;
const API_CACHE = `mada-api-${CURRENT_CACHE_VERSION}`;
const RUNTIME_CACHE = `mada-runtime-${CURRENT_CACHE_VERSION}`;

// Known cache names (any cache not matching is deleted on activate)
const KNOWN_CACHES = [STATIC_CACHE, API_CACHE, RUNTIME_CACHE];

// Static assets to cache on install (CRITICAL - chỉ những file luôn offline được)
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-512.svg',
  '/favicon.svg',
  '/offline.html',
];

// Install event - cache critical static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v2...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching critical static assets');
        // addAll() fail nếu 1 file 404 - dùng add() từng cái để robust hơn
        return Promise.all(
          STATIC_ASSETS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
              console.warn(`[SW] Failed to cache ${url}:`, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up ALL old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => !KNOWN_CACHES.includes(name))
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - smart routing per endpoint type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST/PUT/DELETE go to network only)
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // 1) Chat API + auth + user-scoped: NEVER cache (always fresh)
  if (
    url.pathname.startsWith('/api/chat') ||
    url.pathname.startsWith('/api/auth') ||
    url.pathname.startsWith('/api/user') ||
    url.pathname.startsWith('/api/admin') ||
    url.pathname.startsWith('/api/payments')
  ) {
    event.respondWith(networkOnly(request));
    return;
  }

  // 2) Public/GET APIs: network-first with cache fallback (5s)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithTimeout(request, API_CACHE, 5000));
    return;
  }

  // 3) Static assets (JS/CSS/images): cache-first
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'manifest'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 4) Navigation requests: network-first, fallback offline.html
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // 5) Default: network-first with cache
  event.respondWith(networkFirstWithTimeout(request, RUNTIME_CACHE, 3000));
});

// Network-only: không cache gì cả
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Network unavailable',
      offline: true,
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Cache-first: dùng cache nếu có, fallback network
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // Update cache in background (stale-while-revalidate)
    fetch(request)
      .then((response) => {
        if (response.ok && response.status === 200) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Cache-first network failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network-first with timeout
async function networkFirstWithTimeout(request, cacheName, timeoutMs = 5000) {
  const cache = await caches.open(cacheName);

  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);

    if (response.ok && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed/timed out, trying cache:', request.url);
    const cached = await cache.match(request);
    if (cached) return cached;

    return new Response(JSON.stringify({
      success: false,
      error: 'Offline and not cached',
      offline: true,
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Navigation handler: trả về offline.html nếu không có network
async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cache = await caches.open(STATIC_CACHE);
    const offlinePage = await cache.match('/offline.html');
    if (offlinePage) return offlinePage;

    // Fallback: trả về trang root từ cache
    const cachedRoot = await cache.match('/');
    if (cachedRoot) return cachedRoot;

    return new Response('Offline', { status: 503 });
  }
}

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

// Sync queued messages when back online
async function syncMessages() {
  // Get queued messages from IndexedDB
  const db = await openDB();
  const tx = db.transaction('pendingMessages', 'readonly');
  const store = tx.objectStore('pendingMessages');
  const messages = await getAllFromStore(store);

  for (const message of messages) {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.data),
      });

      if (response.ok) {
        // Remove from queue
        const deleteTx = db.transaction('pendingMessages', 'readwrite');
        deleteTx.objectStore('pendingMessages').delete(message.id);
      }
    } catch (error) {
      console.log('[SW] Failed to sync message:', error);
    }
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body || 'Bạn có tin nhắn mới từ MADA AI',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: [
      { action: 'open', title: 'Mở' },
      { action: 'close', title: 'Đóng' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'MADA AI', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data?.url || '/');
        }
      })
  );
});

// Helper: Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MADAOfflineDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingMessages')) {
        db.createObjectStore('pendingMessages', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Helper: Get all items from ObjectStore
function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
