/**
 * Service Worker for StudySphere
 * Provides offline functionality and caching
 */

const CACHE_NAME = 'studysphere-v1';
const STATIC_CACHE_NAME = 'studysphere-static-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/partials/home.html',
  '/partials/subjects.html',
  '/partials/dashboard.html',
  '/partials/admin.html',
  '/partials/quiz.html',
  '/assets/css/styles.css',
  '/assets/js/router.js',
  '/assets/js/auth.js',
  '/assets/js/firebase.js',
  '/assets/js/ui.js',
  '/assets/js/subjects.js',
  '/assets/img/favicon.svg'
];

// Network-first resources (always try network first)
const NETWORK_FIRST = [
  '/partials/',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com'
];

// Cache-first resources (serve from cache if available)
const CACHE_FIRST = [
  '/assets/',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - handle requests with appropriate caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Determine caching strategy
  if (shouldUseNetworkFirst(url)) {
    event.respondWith(networkFirst(request));
  } else if (shouldUseCacheFirst(url)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

/**
 * Check if URL should use network-first strategy
 * @param {URL} url - Request URL
 * @returns {boolean} - Whether to use network-first
 */
function shouldUseNetworkFirst(url) {
  return NETWORK_FIRST.some(pattern => 
    url.pathname.includes(pattern) || url.hostname.includes(pattern)
  );
}

/**
 * Check if URL should use cache-first strategy
 * @param {URL} url - Request URL
 * @returns {boolean} - Whether to use cache-first
 */
function shouldUseCacheFirst(url) {
  return CACHE_FIRST.some(pattern => 
    url.pathname.includes(pattern) || url.hostname.includes(pattern)
  );
}

/**
 * Network-first caching strategy
 * Try network first, fall back to cache
 * @param {Request} request - Fetch request
 * @returns {Promise<Response>} - Response
 */
async function networkFirst(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // If successful, cache the response
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache', request.url);
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If it's an HTML request and we have no cache, return offline page
    if (request.headers.get('accept')?.includes('text/html')) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Offline - StudySphere</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0; 
              background: #f8fafc;
              color: #64748b;
            }
            .offline-message { 
              text-align: center; 
              max-width: 400px; 
              padding: 2rem;
            }
            .offline-icon { 
              font-size: 4rem; 
              margin-bottom: 1rem; 
            }
            h1 { 
              color: #1e293b; 
              margin-bottom: 1rem; 
            }
            button {
              background: #3b82f6;
              color: white;
              border: none;
              padding: 0.75rem 1.5rem;
              border-radius: 8px;
              cursor: pointer;
              font-size: 1rem;
              margin-top: 1rem;
            }
            button:hover {
              background: #2563eb;
            }
          </style>
        </head>
        <body>
          <div class="offline-message">
            <div class="offline-icon">📡</div>
            <h1>You're Offline</h1>
            <p>Please check your internet connection and try again.</p>
            <button onclick="window.location.reload()">Retry</button>
          </div>
        </body>
        </html>
        `,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }
    
    // For other requests, return a generic error
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Cache-first caching strategy
 * Try cache first, fall back to network
 * @param {Request} request - Fetch request
 * @returns {Promise<Response>} - Response
 */
async function cacheFirst(request) {
  // Try cache first
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Cache miss, try network
    const networkResponse = await fetch(request);
    
    // Cache the response for next time
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Both cache and network failed', error);
    return new Response('Resource not available', { status: 503 });
  }
}

/**
 * Handle background sync for offline actions
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'quiz-attempt') {
    event.waitUntil(syncQuizAttempts());
  }
});

/**
 * Sync quiz attempts when back online
 */
async function syncQuizAttempts() {
  try {
    // Get pending attempts from IndexedDB or localStorage
    const pendingAttempts = JSON.parse(localStorage.getItem('pendingQuizAttempts') || '[]');
    
    for (const attempt of pendingAttempts) {
      try {
        // Try to sync the attempt
        await fetch('/api/sync-attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attempt)
        });
        
        console.log('Service Worker: Synced quiz attempt', attempt.id);
      } catch (error) {
        console.error('Service Worker: Failed to sync attempt', error);
      }
    }
    
    // Clear synced attempts
    localStorage.removeItem('pendingQuizAttempts');
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
  }
}

/**
 * Handle push notifications (future feature)
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/assets/img/favicon.svg',
    badge: '/assets/img/favicon.svg',
    data: data.url,
    actions: [
      {
        action: 'open',
        title: 'Open StudySphere'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data || '/')
    );
  }
});