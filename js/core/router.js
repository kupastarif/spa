/**
 * =================================================================================
 * FILE         : /js/core/router.js
 * FILE VERSION : 2.0.1-rev1
 * APP VERSION  : 2.0.1
 * DATE         : 2 Juli 2026
 * @author      : gk
 *
 * CHANGELOG  :
 *
 * =================================================================================
 */

'use strict';

// ==================== VERSI FILE ====================
const F_V = '2.0.1-rev1';

import { StateManager } from './state.js';
import { PopupManager } from '../components/popup.js';
import { DrawerManager } from '../components/drawer.js';

// =============================================================================
// 1. KONFIGURASI HALAMAN & MENU
// =============================================================================

const PAGE_CONFIG = {
    home:            { file: '../pages/home.js',        url: 'home' },
    order:           { file: '../pages/order.js',       url: 'order' },
    reality:         { file: '../pages/reality.js',     url: 'reality' },
    trackingidle:    { file: '../pages/tracking.js',    url: 'trackingidle' },
    trackingactive:  { file: '../pages/tracking.js',    url: 'trackingactive' },
    result:          { file: '../pages/result.js',      url: 'result' },
    report:          { file: '../pages/report.js',      url: 'report' },
    history:         { file: '../pages/history.js',     url: 'history' },
    settings:        { file: '../pages/settings.js',    url: 'settings' },
    maintenance:     { file: '../pages/maintenance.js', url: 'maintenance' },
    showmappaste:    { file: '../pages/showmap.js',     url: 'showmap' },
    showmapdetail:   { file: '../pages/showmap.js',     url: 'showmapdetail' },
    article:         { file: '../pages/articles.js',    url: 'article' },
    articledetail:   { file: '../pages/articles.js',    url: 'articledetail' },
    about:           { file: '../pages/about.js',       url: 'about' },
    abouttldr:       { file: '../pages/about.js',       url: 'abouttldr' },
    privacy:         { file: '../pages/privacy.js',     url: 'privacy' },
    privacytldr:     { file: '../pages/privacy.js',     url: 'privacytldr' },
    catatan:         { file: '../pages/note.js',        url: 'catatan' },
    catatantldr:     { file: '../pages/note.js',        url: 'catatantldr' }
};

const MENU_PAGES = ['history', 'settings', 'maintenance', 'showmappaste',
                    'article', 'about', 'privacy', 'catatan'];

// =============================================================================
// 2. TABEL NAVIGASI (SSOT)
// =============================================================================

const STACK_TEMPLATES = {
    standard: {
        order:            ['KT','home','order'],
        reality:          ['KT','home','order','reality'],
        trackingidle:     ['KT','home','order','reality','trackingidle'],
        trackingguard:    ['KT','home','order','reality','trackingidle','trackingguard'],
        trackingactive:   ['KT','home','order','reality','trackingidle','trackingguard','trackingactive'],
        result:           ['KT','home','order','reality','result'],
        report:           ['KT','home','order','reality','result','report'],
        showmapdetail:    ['KT','home','order','reality','result','report','showmapdetail']
    },
    operational: {
        trackingidle:     ['KT','home','trackingidle'],
        trackingguard:    ['KT','home','trackingidle','trackingguard'],
        trackingactive:   ['KT','home','trackingidle','trackingguard','trackingactive'],
        result:           ['KT','home','result'],
        report:           ['KT','home','result','report'],
        showmapdetail:    ['KT','home','result','report','showmapdetail']
    },
    null: {
        home:             ['KT','home'],
        history:          ['KT','home','history'],
        report:           ['KT','home','history','report'],
        settings:         ['KT','home','settings'],
        maintenance:      ['KT','home','maintenance'],
        showmappaste:     ['KT','home','showmappaste'],
        article:          ['KT','home','article'],
        articledetail:    ['KT','home','article','articledetail'],
        about:            ['KT','home','about'],
        abouttldr:        ['KT','home','about','abouttldr'],
        privacy:          ['KT','home','privacy'],
        privacytldr:      ['KT','home','privacy','privacytldr'],
        catatan:          ['KT','home','catatan'],
        catatantldr:      ['KT','home','catatan','catatantldr']
    }
};

const BACKWARD_PATH = {
    standard: {
        order:            'home',
        reality:          'order',
        trackingidle:     'reality',
        trackingguard:    'trackingidle',
        trackingactive:   'trackingguard',
        result:           'reality',
        report:           'result',
        showmapdetail:    'report'
    },
    operational: {
        trackingidle:     'home',
        trackingguard:    'trackingidle',
        trackingactive:   'trackingguard',
        result:           'home',
        report:           'result',
        showmapdetail:    'report'
    },
    null: {
        home:             'KT',
        history:          'home',
        report:           'history',
        settings:         'home',
        maintenance:      'home',
        showmappaste:     'home',
        article:          'home',
        about:            'home',
        privacy:          'home',
        articledetail:    'article',
        abouttldr:        'about',
        privacytldr:      'privacy',
        catatan:          'home',
        catatantldr:      'catatan'
    }
};

const NAVIGATION_GUARD = {
    home: (target, mode) => {
        if (MENU_PAGES.includes(target)) return true;
        if (target === 'order' && mode === 'standard') return true;
        if (target === 'trackingidle' && mode === 'operational') return true;
        if (target === 'result' && mode === 'operational') return true;
        if (target === 'KT') return true;
        return false;
    },
    order: (target, mode) => {
        if (mode !== 'standard') return false;
        if (target === 'reality') return true;
        if (target === 'trackingidle') return true;
        if (target === 'home') return true;
        return false;
    },
    reality: (target, mode) => target === 'result' || target === 'trackingidle' || target === 'order',
    trackingidle: (target, mode) => {
        if (target === 'trackingactive') return true;
        if (target === 'trackingguard') return true;
        if (mode === 'standard' && target === 'reality') return true;
        if (mode === 'operational' && target === 'home') return true;
        return false;
    },
    trackingguard: (target, mode) => {
        if (target === 'trackingactive') return true;
        return false;
    },
    trackingactive: (target, mode) => {
        if (target === 'result') return true;
        if (target === 'trackingidle') return true;
        if (mode === 'standard' && target === 'reality') return true;
        if (mode === 'operational' && target === 'home') return true;
        if (target === 'trackingguard') return true;
        return false;
    },
    result: (target, mode) => {
        if (target === 'report') return true;
        if (mode === 'standard' && target === 'reality') return true;
        if (mode === 'operational' && target === 'home') return true;
        return false;
    },
    report: (target, mode) => {
        return target === 'showmapdetail' || target === 'home'
               || target === 'result' || target === 'history';
    },
    history: (target, mode) => {
        return target === 'home' || target === 'report'
               || target === 'showmapdetail' || MENU_PAGES.includes(target);
    },
    settings: (target, mode) => target === 'home' || MENU_PAGES.includes(target),
    maintenance: (target, mode) => target === 'home' || MENU_PAGES.includes(target),
    showmappaste: (target, mode) => target === 'home' || target === 'showmapdetail' || MENU_PAGES.includes(target),
    article: (target, mode) => target === 'home' || target === 'articledetail' || MENU_PAGES.includes(target),
    about: (target, mode) => target === 'home' || target === 'abouttldr' || MENU_PAGES.includes(target),
    privacy: (target, mode) => target === 'home' || target === 'privacytldr' || MENU_PAGES.includes(target),
    articledetail: (target, mode) => target === 'home' || target === 'article',
    abouttldr: (target, mode) => target === 'home' || target === 'about',
    privacytldr: (target, mode) => target === 'home' || target === 'privacy',
    catatan: (target, mode) => target === 'home' || target === 'catatantldr' || MENU_PAGES.includes(target),
    catatantldr: (target, mode) => target === 'home' || target === 'catatan',
    showmapdetail: (target, mode) => target === 'report' || target === 'history' || target === 'showmappaste'
};

// =============================================================================
// 3. UTILITAS STACK & URL
// =============================================================================

function _getPageStack(stack) {
    return stack.filter(s => !s.startsWith('popup') && s !== 'drawer1');
}

function _parseUrl(url = location.href) {
    const u = new URL(url);
    const pageParam = u.searchParams.get('page') || '';
    const stack = pageParam ? pageParam.split('~') : [];
    return {
        stack,
        params: {
            refid: u.searchParams.get('refid') || undefined,
            articleid: u.searchParams.get('articleid') || undefined
        }
    };
}

function _buildUrl(stack, params = {}) {
    const u = new URL(location.origin + location.pathname);
    u.searchParams.set('page', stack.join('~'));
    if (params.refid) u.searchParams.set('refid', params.refid);
    if (params.articleid) u.searchParams.set('articleid', params.articleid);
    return u.toString();
}

// =============================================================================
// 4. STATE INTERNAL ROUTER
// =============================================================================

let _isNavigating = false;
let _lastKnownURL = '';
let _currentPageModule = null;
let _loadingStartTime = 0;
let _currentParams = {};

// rev1: flag untuk menandai penutupan overlay yang dipicu dari UI (tombol close, konfirmasi, dll.)
let _isClosingOverlayUI = false;

// =============================================================================
// 5. LOCK & HELPER
// =============================================================================

function _acquireLock() {
    if (_isNavigating) {
        window.log.warn('[Router ' + F_V + '] (1) Lock tidak bisa diakuisisi, sedang navigasi');
        return false;
    }
    _isNavigating = true;
    window.log.info('[Router ' + F_V + '] (2) Lock diakuisisi');
    return true;
}

function _releaseLock() {
    _isNavigating = false;
    _lastKnownURL = location.href;
    window.log.info('[Router ' + F_V + '] (3) Lock dilepas');
}

// =============================================================================
// 6. LAZY LOAD & RENDER
// =============================================================================

const pageCache = new Map();
const MAX_CACHE_SIZE = 10;

async function _loadPageModule(page) {
    if (pageCache.has(page)) {
        window.log.info('[Router ' + F_V + '] (4) Cache page:', page);
        return pageCache.get(page);
    }
    const config = PAGE_CONFIG[page];
    if (!config) {
        window.log.error('[Router ' + F_V + '] (5) Konfigurasi halaman tidak ditemukan:', page);
        return { render: () => {}, destroy: () => {} };
    }
    window.log.info('[Router ' + F_V + '] (6) Memuat modul halaman:', page, 'dari:', config.file);
    try {
        const module = await import(config.file);
        const exportName = 'Page' + page.charAt(0).toUpperCase() + page.slice(1);
        const pageModule = module[exportName];
        if (!pageModule) {
            window.log.error('[Router ' + F_V + '] (7) Ekspor', exportName, 'tidak ditemukan di', config.file);
            return { render: () => {}, destroy: () => {} };
        }
        if (pageCache.size >= MAX_CACHE_SIZE) {
            const firstKey = pageCache.keys().next().value;
            window.log.info('[Router ' + F_V + '] (8) Cache penuh, menghapus:', firstKey);
            pageCache.delete(firstKey);
        }
        pageCache.set(page, pageModule);
        return pageModule;
    } catch (error) {
        window.log.error('[Router ' + F_V + '] (9) Gagal memuat modul halaman:', page, error);
        window.ThemeManager?.showToast('Gagal memuat halaman ' + page, 'error');
        return { render: () => {}, destroy: () => {} };
    }
}

async function _renderPage(page, params = {}, direction = 'forward') {
    window.log.info('[Router ' + F_V + '] (10) Merender halaman:', page, '| direction:', direction);
    if (_currentPageModule?.destroy) {
        await _currentPageModule.destroy();
    }
    const mod = await _loadPageModule(page);
    if (mod.render) {
        await mod.render(params, { direction });
        _currentPageModule = mod;
    } else {
        window.log.error('[Router ' + F_V + '] (11) Modul tidak memiliki render:', page);
    }
}

// =============================================================================
// 7. LOADING OVERLAY
// =============================================================================

function _showLoading(minDuration = 0) {
    _loadingStartTime = Date.now();
    StateManager.set('isLoading', true);
    window.log.info('[Router ' + F_V + '] (12) Loading overlay ditampilkan (minDuration=' + minDuration + ')');
}

async function _hideLoading(minDuration = 200) {
    const elapsed = Date.now() - _loadingStartTime;
    if (elapsed < minDuration) {
        await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
    }
    StateManager.set('isLoading', false);
    window.log.info('[Router ' + F_V + '] (13) Loading overlay disembunyikan');
}

// =============================================================================
// 8. PEMBANGUN STACK TARGET
// =============================================================================

function _buildTargetStack(target, mode, originPage) {
    window.log.info('[Router ' + F_V + '] (14) Membangun stack untuk target:', target, 'mode:', mode, 'origin:', originPage);
    if (target === 'showmapdetail') {
        if (STACK_TEMPLATES[mode]?.[target]) {
            return [...STACK_TEMPLATES[mode][target]];
        }
        if (mode === null) {
            const prev = StateManager.get('previousPage') || 'home';
            switch (prev) {
                case 'history':       return ['KT', 'home', 'history', 'showmapdetail'];
                case 'report':        return ['KT', 'home', 'history', 'report', 'showmapdetail'];
                case 'showmappaste':  return ['KT', 'home', 'showmappaste', 'showmapdetail'];
                default:              return ['KT', 'home', 'history', 'showmapdetail'];
            }
        }
    }
    if (STACK_TEMPLATES[mode]?.[target]) {
        return [...STACK_TEMPLATES[mode][target]];
    }
    if (STACK_TEMPLATES.null[target]) {
        return [...STACK_TEMPLATES.null[target]];
    }
    window.log.error('[Router ' + F_V + '] (15) Tidak dapat membangun stack untuk target:', target, 'mode:', mode);
    window.ThemeManager?.showToast('Kesalahan navigasi', 'error');
    emergencyReset('Gagal membangun stack untuk ' + target);
    return [];
}

// =============================================================================
// 9. FUNGSI PENGAMBIL TARGET MUNDUR
// =============================================================================

function _getBackTarget() {
    const currentPage = StateManager.get('currentPage') || 'home';
    const mode = StateManager.get('calcMode') || null;
    if (currentPage === 'showmapdetail') {
        if (mode === 'standard' || mode === 'operational') {
            return 'report';
        }
        const origin = StateManager.get('previousPage') || 'KT';
        const validOrigins = ['history', 'showmappaste', 'report', 'result'];
        return validOrigins.includes(origin) ? origin : 'home';
    }
    return (BACKWARD_PATH[mode]?.[currentPage]) 
        || (BACKWARD_PATH.null?.[currentPage]) 
        || 'home';
}

// =============================================================================
// 10. LOG STACK SETELAH NAVIGASI
// =============================================================================

function _logStackInfo(action) {
    const { stack } = _parseUrl();
    window.log.info('[Router ' + F_V + '] (16) Stack setelah ' + action + ': ' + stack.join('~') +
        ' | currentPage=' + (StateManager.get('currentPage') || 'undefined') +
        ' | backTarget=' + _getBackTarget() +
        ' | mode=' + (StateManager.get('calcMode') || 'null') +
        ' | params=' + JSON.stringify(_currentParams) +
        ' | popup=' + (StateManager.get('navigation.popup') || 0) +
        ' | drawer=' + (StateManager.get('navigation.drawer') || 0));
}

// =============================================================================
// 11. OVERLAY HANDLERS
// =============================================================================

/**
 * Tutup overlay secara programatik (internal). Gunakan replaceState.
 * Tidak untuk penutupan yang dipicu langsung oleh aksi pengguna di UI.
 */
function _closeOverlay(type) {
    window.log.info('[Router ' + F_V + '] (17) Menutup overlay:', type);
    const { stack, params } = _parseUrl();
    const last = stack[stack.length - 1];
    if ((type === 'popup' && last && last.startsWith('popup')) ||
        (type === 'drawer' && last === 'drawer1')) {
        stack.pop();
        const newUrl = _buildUrl(stack, params);
        history.replaceState(null, '', newUrl);
        _lastKnownURL = newUrl;
        if (type === 'popup') {
            PopupManager.forceClose();
            StateManager.set('navigation.popup', 0);
        } else {
            DrawerManager.forceClose();
            StateManager.set('navigation.drawer', 0);
        }
        window.log.info('[Router ' + F_V + '] (18) Overlay ' + type + ' berhasil ditutup');
        _logStackInfo('(101) tutup ' + type);
    } else {
        window.log.warn('[Router ' + F_V + '] (19) Tidak ada ' + type + ' yang aktif untuk ditutup');
    }
}

/**
 * Buka overlay (popup/drawer). Menambah entri history dengan pushState.
 */
function _openOverlay(target, helpKey) {
    window.log.info('[Router ' + F_V + '] (20) Membuka overlay:', target);
    const { stack, params } = _parseUrl();
    if (stack[stack.length - 1]?.startsWith('popup') || stack[stack.length - 1] === 'drawer1') {
        window.log.warn('[Router ' + F_V + '] (21) Overlay sudah aktif, tidak bisa buka baru');
        window.ThemeManager?.showToast('Tutup overlay terlebih dahulu', 'warning');
        return;
    }
    stack.push(target);
    const newUrl = _buildUrl(stack, params);
    history.pushState(null, '', newUrl);
    _lastKnownURL = newUrl;

    if (target.startsWith('popup')) {
        const idx = parseInt(target.substring(5));
        StateManager.set('navigation.popup', idx);
        // rev1: gunakan closeOverlayUI agar penutupan dari UI memakai history.back()
        PopupManager.open(idx, { helpKey }, { onClose: () => Router.closeOverlayUI('popup') });
        window.log.info('[Router ' + F_V + '] (22) Popup dibuka:', idx);
    } else if (target === 'drawer1') {
        StateManager.set('navigation.drawer', 1);
        const currentPage = StateManager.get('currentPage');
        const config = DrawerManager.getConfig(currentPage);
        const onItemClick = config?.onItemClick || ((page) => navigateTo({ target: page, closeDrawer: true }));
        // rev1: gunakan closeOverlayUI
        DrawerManager.open({ onClose: () => Router.closeOverlayUI('drawer'), onItemClick });
        window.log.info('[Router ' + F_V + '] (23) Drawer dibuka');
    }
    _logStackInfo('(102) buka ' + target);
}

// =============================================================================
// 12. FUNGSI PEMBANTU
// =============================================================================

function _cleanParams(target, params) {
    window.log.info('[Router ' + F_V + '] (24) Membersihkan parameter untuk target:', target);
    const clean = { ...params };
    if (target !== 'report' && target !== 'showmapdetail') {
        delete clean.refid;
    }
    if (target !== 'articledetail') {
        delete clean.articleid;
    }
    return clean;
}

/**
 * Tangani penutupan overlay melalui tombol back fisik.
 * Mengembalikan true jika berhasil menutup overlay.
 */
function _handleOverlayClose(urlStack) {
    const activePopup = StateManager.get('navigation.popup');
    const activeDrawer = StateManager.get('navigation.drawer');
    const lastUrl = urlStack[urlStack.length - 1];
    if (activePopup > 0 && !lastUrl?.startsWith('popup')) {
        PopupManager.forceClose();
        StateManager.set('navigation.popup', 0);
        _lastKnownURL = location.href;
        window.log.info('[Router ' + F_V + '] (28) Popup ditutup oleh back fisik');
        _logStackInfo('(103) tutup popup (back fisik)');
        return true;
    }
    if (activeDrawer === 1 && lastUrl !== 'drawer1') {
        DrawerManager.forceClose();
        StateManager.set('navigation.drawer', 0);
        _lastKnownURL = location.href;
        window.log.info('[Router ' + F_V + '] (29) Drawer ditutup oleh back fisik');
        _logStackInfo('(104) tutup drawer (back fisik)');
        return true;
    }
    return false;
}

function _triggerAutoguard(type) {
    window.log.info('[Router ' + F_V + '] (30) Memicu autoguard:', type);
    if (type === 'homeguard') {
        const newStack = ['KT', 'home', 'popup16'];
        history.pushState(null, '', _buildUrl(newStack, _currentParams));
        _lastKnownURL = location.href;
        StateManager.set('navigation.popup', 16);
        // rev1: gunakan closeOverlayUI
        PopupManager.open(16, {}, { onClose: () => Router.closeOverlayUI('popup') });
    } else if (type === 'trackingguard') {
        const mode = StateManager.get('calcMode') || null;
        const newStack = _buildTargetStack('trackingactive', mode, 'trackingguard');
        newStack.push('popup14');
        history.pushState(null, '', _buildUrl(newStack, _currentParams));
        _lastKnownURL = location.href;
        StateManager.set('navigation.popup', 14);
        // rev1: gunakan closeOverlayUI
        PopupManager.open(14, {}, { onClose: () => Router.closeOverlayUI('popup') });
    }
    _logStackInfo('(105) autoguard ' + type);
}

// =============================================================================
// 13. NAVIGASI HALAMAN (UI)
// =============================================================================

async function _navigateToPage(target, params) {
    window.log.info('[Router ' + F_V + '] (33) Memulai navigasi halaman ke:', target);
    const mode = StateManager.get('calcMode') || null;
    const currentPage = StateManager.get('currentPage') || 'home';
    StateManager.set('previousPage', currentPage);

    const newStack = _buildTargetStack(target, mode, currentPage);
    if (newStack.length === 0) return;

    const newPageStack = _getPageStack(newStack);
    const oldPageStack = _getPageStack(_parseUrl().stack);
    const isBackward = newPageStack.length <= oldPageStack.length &&
                       newPageStack.every((p, i) => p === oldPageStack[i]);

    const guardFn = NAVIGATION_GUARD[currentPage];
    if (typeof guardFn !== 'function' || !guardFn(target, mode)) {
        window.log.error('[Router ' + F_V + '] (36) Navigation guard gagal:', currentPage, '->', target);
        window.ThemeManager?.showToast('Navigasi tidak diizinkan', 'error');
        emergencyReset('Navigation guard gagal');
        return;
    }

    const cleanParams = _cleanParams(target, params);
    const url = _buildUrl(newStack, cleanParams);

    if (isBackward) {
        history.replaceState(null, '', url);
    } else {
        history.pushState(null, '', url);
    }

    _lastKnownURL = url;
    _currentParams = cleanParams;
    StateManager.set('currentPage', target);
    StateManager.set('pageParams', cleanParams);
    await _renderPage(target, cleanParams, isBackward ? 'back' : 'forward');
    _logStackInfo(isBackward ? '(106) mundur UI' : '(107) maju UI');
}

// =============================================================================
// 14. NAVIGATE TO – SINGLE ENTRY POINT
// =============================================================================

async function navigateTo(params) {
    window.log.info('[Router ' + F_V + '] (40) navigateTo dipanggil dengan params:', JSON.stringify(params));
    if (!_acquireLock()) return;
    const isForward = !!params.target && !params.popup && !params.drawer;
    _showLoading(isForward ? 200 : 0);
    try {
        if (params.popup === 0) { _closeOverlay('popup'); return; }
        if (params.drawer === 0) { _closeOverlay('drawer'); return; }

        if (params.target && (params.target.startsWith('popup') || params.target === 'drawer1')) {
            _openOverlay(params.target, params.helpKey);
            return;
        }

        if (params.target && params.closeDrawer) {
            _closeOverlay('drawer');
        }

        if (StateManager.get('navigation.popup') > 0) _closeOverlay('popup');
        if (StateManager.get('navigation.drawer') === 1) _closeOverlay('drawer');

        if (params.target) {
            await _navigateToPage(params.target, params);
            return;
        }
    } catch (error) {
        window.log.error('[Router ' + F_V + '] (47) Gagal navigasi:', error);
        window.ThemeManager?.showToast('Kesalahan navigasi', 'error');
        emergencyReset(error.message);
    } finally {
        await _hideLoading(isForward ? 200 : 0);
        _releaseLock();
    }
}

// =============================================================================
// 15. PENUTUPAN OVERLAY DARI UI (rev1)
// =============================================================================

/**
 * Tutup overlay yang sedang aktif karena aksi pengguna (tombol close/konfirmasi).
 * Menggunakan history.back() untuk menghapus entri overlay dari history,
 * sehingga tidak terjadi duplikasi dan tombol back fisik bekerja normal.
 *
 * @param {'popup'|'drawer'} type - Jenis overlay yang akan ditutup.
 */
function closeOverlayUI(type) {
    window.log.info('[Router ' + F_V + '] (60) closeOverlayUI:', type);
    if (_isClosingOverlayUI) {
        window.log.warn('[Router ' + F_V + '] (61) closeOverlayUI sudah berjalan, abaikan');
        return;
    }
    _isClosingOverlayUI = true;

    // Tutup komponen overlay secara paksa
    if (type === 'popup') {
        PopupManager.forceClose();
        StateManager.set('navigation.popup', 0);
    } else if (type === 'drawer') {
        DrawerManager.forceClose();
        StateManager.set('navigation.drawer', 0);
    }

    // Kembalikan history ke sebelum overlay dibuka (+1/-1)
    history.back();
}

// =============================================================================
// 16. POPSTATE HANDLER (rev1)
// =============================================================================

async function _handlePopState() {
    window.log.info('[Router ' + F_V + '] (48) popstate terpicu');
    if (!_acquireLock()) return;
    _showLoading(0);
    try {
        // --- TANGANI PENUTUPAN OVERLAY DARI UI (flag _isClosingOverlayUI) ---
        if (_isClosingOverlayUI) {
            window.log.info('[Router ' + F_V + '] (49) Popstate dari closeOverlayUI, membersihkan');
            _isClosingOverlayUI = false;
            _lastKnownURL = location.href;
            _releaseLock();
            return;
        }

        const { stack: urlStack } = _parseUrl();
        const oldStack = _parseUrl(_lastKnownURL).stack;

        // --- FORWARD DIBLOKIR TANPA EMERGENCY RESET ---
        if (urlStack.length > oldStack.length) {
            window.log.warn('[Router ' + F_V + '] (50) Forward browser diblokir, kembali ke halaman sebelumnya');
            history.back();
            _lastKnownURL = location.href;
            _releaseLock();
            return;
        }

        // --- STACK IDENTIK (DUPLIKAT HISTORY) DITOLERANSI ---
        if (urlStack.length === oldStack.length &&
            urlStack.every((s, i) => s === oldStack[i])) {
            window.log.warn('[Router ' + F_V + '] (51) Duplikat history terdeteksi, diabaikan');
            _lastKnownURL = location.href;
            _releaseLock();
            return;
        }

        // --- PENUTUPAN OVERLAY OLEH BACK FISIK ---
        if (_handleOverlayClose(urlStack)) {
            _releaseLock();
            return;
        }

        // --- MUNDUR HALAMAN ---
        const currentPage = StateManager.get('currentPage') || 'home';
        const target = _getBackTarget();

        // Autoguard khusus
        if (currentPage === 'home' && target === 'KT') {
            _triggerAutoguard('homeguard');
            _releaseLock();
            return;
        }
        if (currentPage === 'trackingactive' && target === 'trackingguard') {
            _triggerAutoguard('trackingguard');
            _releaseLock();
            return;
        }

        const mode = StateManager.get('calcMode') || null;
        const expectedStack = _buildTargetStack(target, mode, target);
        if (expectedStack.length === 0) {
            _releaseLock();
            return;
        }
        const expectedPageStack = _getPageStack(expectedStack);

        // Verifikasi kecocokan stack
        if (urlStack.length !== expectedPageStack.length ||
            !urlStack.every((p, i) => p === expectedPageStack[i])) {
            window.log.error('[Router ' + F_V + '] (50b) Stack tidak sesuai target mundur');
            // Alih-alih emergency reset, kita paksa mundur ke halaman yang benar
            // dengan history.back() tambahan, atau fallback ke home.
            // Untuk keamanan, fallback ke home.
            emergencyReset('Stack mundur tidak valid');
            return;
        }

        const cleanParams = _cleanParams(target, _currentParams);
        _currentParams = cleanParams;
        const newUrl = _buildUrl(expectedStack, cleanParams);
        history.replaceState(null, '', newUrl);
        _lastKnownURL = newUrl;
        StateManager.set('previousPage', currentPage);
        StateManager.set('currentPage', target);
        await _renderPage(target, cleanParams, 'back');
    } finally {
        await _hideLoading(0);
        _releaseLock();
    }
}

// =============================================================================
// 17. INISIALISASI & EMERGENCY RESET
// =============================================================================

async function init() {
    window.log.info('[Router ' + F_V + '] (57) init()');
    const { stack, params } = _parseUrl();
    if (stack.length === 0) {
        const homeStack = ['KT', 'home'];
        history.replaceState(null, '', _buildUrl(homeStack));
        _lastKnownURL = location.href;
        StateManager.set('currentPage', 'home');
        _currentParams = {};
        await _renderPage('home', {}, 'forward');
        window.addEventListener('popstate', _handlePopState);
        return;
    }
    const lastPage = _getPageStack(stack).pop() || 'home';
    if (lastPage === 'articledetail' && params.articleid) {
        const idealStack = ['KT', 'home', 'article', 'articledetail'];
        history.replaceState(null, '', _buildUrl(idealStack, params));
        _lastKnownURL = location.href;
        StateManager.set('currentPage', 'articledetail');
        _currentParams = params;
        await _renderPage('articledetail', params, 'forward');
        window.addEventListener('popstate', _handlePopState);
        return;
    }
    emergencyReset('URL tidak valid saat inisialisasi');
}

function emergencyReset(reason = '') {
    window.log.error('[Router ' + F_V + '] (62) EMERGENCY RESET:', reason);
    pageCache.clear();
    _currentPageModule = null;
    _lastKnownURL = '';
    _currentParams = {};
    _isClosingOverlayUI = false;
    if (typeof window.forceStopTracking === 'function') {
        window.forceStopTracking();
    }
    PopupManager.forceClose();
    DrawerManager.forceClose();
    StateManager.resetAppState();
    window.location.replace(window.APP_FULL_BASE || '/');
}

// =============================================================================
// 18. EKSPOR
// =============================================================================

export const Router = {
    navigateTo,
    closeOverlayUI,         // rev1: fungsi penutupan overlay dari UI
    init,
    getCurrentPage: () => StateManager.get('currentPage') || 'home',
    getCurrentParams: () => _currentParams,
    getBackPath: () => _getBackTarget(),
    PAGE_CONFIG
};

window.Router = Router;
window.log.info('[Router ' + F_V + '] (63) Router dimuat');


// ================================ End Of File ================================