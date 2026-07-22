/**
 * =================================================================================
 * FILE         : /js/core/init.js
 * FILE VERSION : 2.0.1-rev0
 * APP VERSION  : 2.0.1
 * DATE         : 1 Juli 2026
 * @author      : gk
 *
 * CHANGELOG  :
 *
 * =================================================================================
 */

(function() {
    'use strict';

    // ==================== VERSI FILE ====================
    const F_V = '2.0.1-rev0';

    // Guard: cegah eksekusi ganda
    if (window.__INIT_EXECUTED__) return;
    window.__INIT_EXECUTED__ = true;

    // =========================================================================
    // 1. BACA KONFIGURASI DARI HTML (dengan fallback)
    // =========================================================================
    var isDevMode = (typeof window.isDevMode === 'boolean') ? window.isDevMode : false;
    var cacheBustTimestamp = isDevMode ? (window.CACHE_BUST || Date.now()) : null;

    // =========================================================================
    // 2. LOGGING (hanya info/warn saat dev mode)
    // =========================================================================
    window.log = {
        info:  isDevMode ? function() { console.log.apply(console, arguments); }  : function() {},
        warn:  isDevMode ? function() { console.warn.apply(console, arguments); } : function() {},
        error: function() { console.error.apply(console, arguments); }
    };
    window.log.info('[Init ' + F_V + '] (1) Dev mode = ' + isDevMode);
    if (isDevMode) window.log.info('[Init ' + F_V + '] (2) Cache bust timestamp = ' + cacheBustTimestamp);

    // =========================================================================
    // 3. DETEKSI BASE PATH
    // =========================================================================
    function detectBasePath() {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].src;
            if (src && src.indexOf('init.js') !== -1) {
                return new URL(src).pathname.replace(/\/js\/core\/init\.js$/, '/');
            }
        }
        return '/';
    }
    var BASE_PATH = detectBasePath();
    window.APP_BASE_PATH = BASE_PATH;
    window.APP_FULL_BASE = window.location.origin + BASE_PATH;
    window.log.info('[Init ' + F_V + '] (3) Base path terdeteksi: ' + BASE_PATH);

    // =========================================================================
    // 4. APP_CONFIG (SSOT – membaca dari variabel global HTML, fallback aman)
    // =========================================================================
    window.APP_CONFIG = {
        version:                 window.APP_VERSION              || '2.0.1',
        isDevMode:               isDevMode,
        enableDevTools:          isDevMode,
        timeout:                 window.APP_TIMEOUT              || 10000,
        minLoadingTime:          window.APP_MIN_LOADING_TIME     || 3000,
        maxHistoryItems:         window.APP_MAX_HISTORY          || 50,
        historyWarningThreshold: window.APP_HISTORY_WARNING      || 45,
        storageQuotaWarningMB:   window.APP_STORAGE_QUOTA_WARN   || 4,
        maxToasts:               window.APP_MAX_TOASTS           || 3,
        maxToastQueue:           window.APP_MAX_TOAST_QUEUE      || 10,
        defaultTheme:            window.DEFAULT_THEME            || 'light',
        siteTitle:               window.SITE_TITLE               || 'KupasTarif',
        siteDisplay:             window.SITE_DISPLAY             || 'Kupas⚡Tarif',
        siteIcon:                window.SITE_ICON                || '⚡',
        landingLink:             window.LANDING_LINK             || 'linktr.ee/KUPASTARIF',
        copyTemplateMinLength:   window.APP_COPY_MIN_LENGTH      || 100,
        copyTemplateMaxLength:   window.APP_COPY_MAX_LENGTH      || 2000
    };
    window.log.info('[Init ' + F_V + '] (4) APP_CONFIG berhasil dibuat (v' + window.APP_CONFIG.version + ')');

    // =========================================================================
    // DETEKSI PLATFORM (SSOT)
    // =========================================================================
    window.__platform = {
        isNative: !!(window.Capacitor && 
                     typeof window.Capacitor.isNativePlatform === 'function' && 
                     window.Capacitor.isNativePlatform())
    };
    window.log.info('[Init] Platform isNative:', window.__platform.isNative);


    // =========================================================================
    // 5. FUNGSI CACHE BUST
    // =========================================================================
    window.cacheBust = function(url) {
        if (!isDevMode || !cacheBustTimestamp) return url;
        var sep = url.indexOf('?') === -1 ? '?' : '&';
        return url + sep + 't=' + cacheBustTimestamp;
    };

    // =========================================================================
    // 6. LOADER LEGACY UNTUK ENGINE
    // =========================================================================
    function loadScriptLegacy(filePath) {
        return new Promise(function(resolve, reject) {
            var script = document.createElement('script');
            script.src = window.cacheBust(window.APP_FULL_BASE + filePath);
            script.onload = resolve;
            script.onerror = function() { reject(new Error('Gagal memuat: ' + filePath)); };
            document.head.appendChild(script);
        });
    }

    // =========================================================================
    // 7. DAFTAR FILE ENGINE (v1.0.0‑beta)
    // =========================================================================
    var engineFiles = [
        'engine/01data.js',
        'engine/02valid.js',
        'engine/03fare.js',
        'engine/04cost.js',
        'engine/05extra.js',
        'engine/06api.js',
        'engine/07cache.js'
    ];

    // =========================================================================
    // 8. TAMPILAN ERROR (hanya UI, tanpa log)
    // =========================================================================
    function showErrorScreen(message) {
        var textEl = document.getElementById('loading-text');
        var barEl  = document.getElementById('loading-progress-bar');
        var btnEl  = document.getElementById('loading-reload-button');
        if (textEl) { textEl.textContent = message; textEl.style.color = '#ef4444'; }
        if (barEl)  { barEl.style.width = '0%'; barEl.style.backgroundColor = '#ef4444'; }
        if (btnEl)  { btnEl.style.display = 'block'; }
    }

    // =========================================================================
    // 9. PROSES LOADING UTAMA
    // =========================================================================
    async function start() {
        window.log.info('[Init ' + F_V + '] (5) Memulai pemuatan aplikasi...');
        try {
            window.log.info('[Init ' + F_V + '] (6) Memuat Engine v1.0.0‑beta...');

            // Muat setiap file engine secara berurutan
            for (const file of engineFiles) {
                await loadScriptLegacy(file);
            }

            window.log.info('[Init ' + F_V + '] (14) Engine v1.0.0‑beta dimuat');

            // Inisialisasi mode Cache
            if (window.Cache) {
                if (isDevMode) {
                    window.Cache.setMode('off');
                    window.log.info('[Init ' + F_V + '] (15) Cache mode: off (dev)');
                } else {
                    window.Cache.setMode('minimal');
                    window.log.info('[Init ' + F_V + '] (16) Cache mode: minimal (production)');
                }
            } else {
                window.log.warn('[Init ' + F_V + '] (17) Cache tidak tersedia');
            }

            // Import map (cache bust hanya saat dev mode)
            var tParam = (isDevMode && cacheBustTimestamp) ? '?t=' + cacheBustTimestamp : '';
            var importMap = {
                imports: {
                    "../helpers/texts.js": "../helpers/texts.js" + tParam,
                    "../helpers/format.js": "../helpers/format.js" + tParam,
                    "../helpers/output.js": "../helpers/output.js" + tParam,

                    "../core/state.js": "../core/state.js" + tParam,
                    "../core/storage.js": "../core/storage.js" + tParam,
                    "../core/preferences.js": "../core/preferences.js" + tParam,
                    "./router.js": "./router.js" + tParam,
                    "./state.js": "./state.js" + tParam,
                    "./storage.js": "./storage.js" + tParam,
                    "./preferences.js": "./preferences.js" + tParam,

                    "../components/drawer.js": "../components/drawer.js" + tParam,
                    "../components/footer.js": "../components/footer.js" + tParam,
                    "../components/header.js": "../components/header.js" + tParam,
                    "../components/popup.js": "../components/popup.js" + tParam,
                    "../components/theme.js": "../components/theme.js" + tParam,

                    "../pages/about.js": "../pages/about.js" + tParam,
                    "../pages/articles.js": "../pages/articles.js" + tParam,
                    "../pages/history.js": "../pages/history.js" + tParam,
                    "../pages/home.js": "../pages/home.js" + tParam,
                    "../pages/maintenance.js": "../pages/maintenance.js" + tParam,
                    "../pages/note.js": "../pages/note.js" + tParam,
                    "../pages/order.js": "../pages/order.js" + tParam,
                    "../pages/privacy.js": "../pages/privacy.js" + tParam,
                    "../pages/reality.js": "../pages/reality.js" + tParam,
                    "../pages/report.js": "../pages/report.js" + tParam,
                    "../pages/result.js": "../pages/result.js" + tParam,
                    "../pages/settings.js": "../pages/settings.js" + tParam,
                    "../pages/showmap.js": "../pages/showmap.js" + tParam,
                    "../pages/tracking.js": "../pages/tracking.js" + tParam,

                    "../maps/calculate.js": "../maps/calculate.js" + tParam,
                    "../maps/tracker.js": "../maps/tracker.js" + tParam,
                    "../maps/gps.js": "../maps/gps.js" + tParam,
                    "../maps/map.js": "../maps/map.js" + tParam,
                    "../maps/picker.js": "../maps/picker.js" + tParam
                }
            };
            var importMapScript = document.createElement('script');
            importMapScript.type = 'importmap';
            importMapScript.textContent = JSON.stringify(importMap);
            document.head.appendChild(importMapScript);
            
            // ============================================================
            // LOAD DEBUG MODULE (hanya saat dev mode)
            // ============================================================
            if (window.isDevMode) {
                const debugScript = document.createElement('script');
                debugScript.src = window.cacheBust(window.APP_FULL_BASE + 'js/core/debug.js');
                debugScript.onerror = function() {
                    // Tidak mempengaruhi aplikasi, hanya peringatan
                    console.warn('[Init] Gagal memuat debug.js');
                };
                document.head.appendChild(debugScript);
            }
            
            window.log.info('[Init ' + F_V + '] (18) Import map selesai' + (tParam ? ' (dengan cache bust)' : ''));

            // Muat app.js sebagai modul ES
            var appScript = document.createElement('script');
            appScript.type = 'module';
            appScript.src = window.cacheBust(window.APP_FULL_BASE + 'js/core/app.js');
            appScript.onload = function() {
                window.log.info('[Init ' + F_V + '] (19) Aplikasi dimulai');
            };
            appScript.onerror = function() {
                window.log.error('[Init ' + F_V + '] (20) Gagal memuat app.js');
                showErrorScreen('Gagal memuat aplikasi.');
            };
            document.head.appendChild(appScript);

        } catch (error) {
            window.log.error('[Init ' + F_V + '] (21) Gagal memuat:', error);
            showErrorScreen('Gagal memuat aplikasi. Periksa koneksi Anda.');
        }
    }

    // =========================================================================
    // 10. EKSEKUSI
    // =========================================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

})();


// ================================ End Of File ================================