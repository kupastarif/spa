/**
 * =================================================================================
 * FILE         : /sw.js
 * FILE VERSION : 2.0.1-rev0
 * APP VERSION  : 2.0.1
 * DATE         : 1 Juli 2026
 * @author      : gk
 *
 * CHANGELOG  :
 *
 * =================================================================================
 */

'use strict';

// ---------- KONFIGURASI ----------
const CACHE_VERSION = '1.0.0';
const STATIC_CACHE = 'kupastarif-static-' + CACHE_VERSION;
const RUNTIME_CACHE = 'kupastarif-runtime-' + CACHE_VERSION;

// Daftar seluruh file statis yang akan di-precache
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/main.css',
  '/assets/css/components.css',
  '/assets/css/pages.css',
  '/assets/img/favicon.ico',
  '/assets/img/icon192.png',
  '/assets/img/icon512.png',
  '/assets/img/og.jpg',
  '/js/core/init.js',
  '/js/core/app.js',
  '/js/core/state.js',
  '/js/core/storage.js',
  '/js/core/preferences.js',
  '/js/core/router.js',
  '/js/pages/about.js',
  '/js/pages/articles.js',
  '/js/pages/history.js',
  '/js/pages/home.js',
  '/js/pages/maintenance.js',
  '/js/pages/note.js',
  '/js/pages/order.js',
  '/js/pages/privacy.js',
  '/js/pages/reality.js',
  '/js/pages/report.js',
  '/js/pages/result.js',
  '/js/pages/settings.js',
  '/js/pages/showmap.js',
  '/js/pages/tracking.js',
  '/js/helpers/format.js',
  '/js/helpers/output.js',
  '/js/helpers/texts.js',
  '/js/components/drawer.js',
  '/js/components/footer.js',
  '/js/components/header.js',
  '/js/components/popup.js',
  '/js/components/theme.js',
  '/js/maps/calculate.js',
  '/js/maps/tracker.js',
  '/js/maps/picker.js',
  '/js/maps/gps.js',
  '/js/maps/map.js',
  '/engine/01data.js',
  '/engine/02valid.js',
  '/engine/03fare.js',
  '/engine/04cost.js',
  '/engine/05extra.js',
  '/engine/06api.js',
  '/engine/07cache.js'
];

// =============================================================================
// INSTALL EVENT: Precache semua file statis
// =============================================================================
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(function(cache) {
        console.log('[SW] Precaching ' + PRECACHE_URLS.length + ' files...');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(function() {
        console.log('[SW] Precache selesai, skip waiting');
        return self.skipWaiting();
      })
      .catch(function(err) {
        console.error('[SW] Precache gagal:', err);
      })
  );
});

// =============================================================================
// ACTIVATE EVENT: Hapus cache versi lama
// =============================================================================
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== STATIC_CACHE && key !== RUNTIME_CACHE;
        }).map(function(key) {
          console.log('[SW] Menghapus cache lama:', key);
          return caches.delete(key);
        })
      );
    }).then(function() {
      console.log('[SW] Activate selesai, claim clients');
      return self.clients.claim();
    })
  );
});

// =============================================================================
// FETCH EVENT: Strategi cache campuran
// =============================================================================
self.addEventListener('fetch', function(event) {
  var request = event.request;

  // Abaikan skema non-http/https
  if (!request.url.startsWith('http')) return;

  // --- Navigasi: network first, fallback ke index.html (offline) ---
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(function() {
        return caches.match('/index.html').then(function(response) {
          return response || new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  // --- CDN Google Fonts & Leaflet: network first + runtime cache ---
  var CDN_PATTERNS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'unpkg.com/leaflet',
    'cdn.jsdelivr.net/npm/leaflet'
  ];
  var isCDN = CDN_PATTERNS.some(function(pattern) {
    return request.url.indexOf(pattern) !== -1;
  });

  if (isCDN) {
    event.respondWith(
      fetch(request).then(function(response) {
        var responseClone = response.clone();
        caches.open(RUNTIME_CACHE).then(function(cache) {
          cache.put(request, responseClone);
        });
        return response;
      }).catch(function() {
        return caches.match(request);
      })
    );
    return;
  }

  // --- Aset lokal: cache first, fallback network ---
  event.respondWith(
    caches.match(request).then(function(cachedResponse) {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(function(response) {
        // Hanya cache response OK dan basic (same-origin)
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        var responseClone = response.clone();
        caches.open(RUNTIME_CACHE).then(function(cache) {
          cache.put(request, responseClone);
        });
        return response;
      }).catch(function(err) {
        // Jika gagal (offline) dan bukan navigasi, biarkan error
        throw err;
      });
    })
  );
});

// ================================ End Of File ================================