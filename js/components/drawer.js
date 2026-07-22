/**
 * =================================================================================
 * FILE         : /js/components/drawer.js
 * FILE VERSION : 2.0.1-rev2
 * APP VERSION  : 2.0.1
 * DATE         : 1 Juli 2026
 * @author      : gk
 *
 * CHANGELOG  :
 *
 * =================================================================================
 */

'use strict';

// ==================== VERSI FILE ====================
const F_V = '2.0.1-rev2';

import { StateEvents } from '../core/state.js';

// =============================================================================
// 0. IKON LOKAL (tidak lagi bergantung pada texts.js)
// =============================================================================

const ICON = {
    CLOSE: '❌',
    DOT: '•',
    CHART: '📈',
    GEAR: '⚙️',
    MAINTENANCE: '🔧',
    SHOW_MAP: '🗺️',
    ARTICLES: '📚',
    ABOUT: '📜',
    LOCK: '🔒',
    DOCUMENT: '📄',
    THEME_LIGHT: '☀️',
    THEME_DARK: '🌙',
    ELECTRIC: '⚡'           // Baru: untuk fallback siteDisplay
};

// =============================================================================
// 1. KONSTANTA & REGISTRI
// =============================================================================

const DRAWER_CONTAINER_ID = 'drawer-container';
const OVERLAY_CLASS = 'drawer-overlay';
const DRAWER_CLASS = 'drawer-container';
const CLOSE_ICON = ICON.CLOSE;

/** Registri drawer custom: Map(page, factoryFn -> { menuItems, onItemClick }) */
const registry = new Map();

let isDrawerOpen = false;
let overlayElement = null;
let drawerElement = null;
let themeChangeListener = null;

let _onClose = null;   // Callback penutupan dari Router

const DEFAULT_MENU_ITEMS = [
    { icon: ICON.CHART,        label: 'Riwayat',      page: 'history' },
    { icon: ICON.GEAR,         label: 'Pengaturan',   page: 'settings' },
    { icon: ICON.MAINTENANCE,  label: 'Perawatan',    page: 'maintenance' },
    { icon: ICON.SHOW_MAP,     label: 'Rute',         page: 'showmappaste' },
  //  { icon: ICON.ARTICLES,     label: 'Artikel',      page: 'article' },
    { icon: ICON.ABOUT,        label: 'Tentang',      page: 'about' },
    { icon: ICON.LOCK,         label: 'Privasi',      page: 'privacy' }
  //  { icon: ICON.DOCUMENT,     label: 'Catatan',      page: 'catatan' }
];

// =============================================================================
// 2. FUNGSI PEMBANGUN DOM
// =============================================================================

function ensureContainer() {
    let container = document.getElementById(DRAWER_CONTAINER_ID);
    if (!container) {
        container = document.createElement('div');
        container.id = DRAWER_CONTAINER_ID;
        document.body.appendChild(container);
    }
    return container;
}

function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && typeof _onClose === 'function') {
            _onClose();
        }
    });
    return overlay;
}

function createDrawerHeader() {
    const header = document.createElement('div');
    header.className = 'drawer-header';

    const leftSide = document.createElement('div');
    const siteTitle = document.createElement('div');
    siteTitle.className = 'drawer-logo-title';
    // Fallback menggunakan ikon dari ICON, bukan inline
    siteTitle.textContent = window.APP_CONFIG?.siteDisplay || `Kupas${ICON.ELECTRIC}Tarif`;

    const version = document.createElement('div');
    version.className = 'drawer-version';
    const appVersion = window.APP_CONFIG?.version || '2.0.1';
    const engineVersion = window.Engine?.ENGINE_VERSION || '1.0.0-beta';
    version.textContent = 'v' + appVersion + ' | Engine v' + engineVersion;

    leftSide.appendChild(siteTitle);
    leftSide.appendChild(version);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'drawer-close';
    closeBtn.textContent = CLOSE_ICON;
    closeBtn.setAttribute('aria-label', 'Tutup');
    closeBtn.addEventListener('click', () => {
        if (typeof _onClose === 'function') {
            _onClose();
        }
    });

    header.appendChild(leftSide);
    header.appendChild(closeBtn);
    return header;
}

function createDrawerContent(menuItems, onItemClick) {
    const content = document.createElement('div');
    content.className = 'drawer-content';

    for (const item of menuItems) {
        const menuItem = document.createElement('div');
        menuItem.className = 'drawer-menu-item';

        const icon = document.createElement('span');
        icon.className = 'drawer-menu-icon';
        icon.textContent = item.icon;

        const label = document.createElement('span');
        label.className = 'drawer-menu-text';
        label.textContent = item.label;

        menuItem.appendChild(icon);
        menuItem.appendChild(label);

        if (typeof onItemClick === 'function') {
            menuItem.addEventListener('click', () => {
                onItemClick(item.page);
            });
        }

        content.appendChild(menuItem);
    }

    return content;
}

function createDrawerFooter() {
    const footer = document.createElement('div');
    footer.className = 'drawer-footer';

    const themeContainer = document.createElement('div');
    themeContainer.className = 'drawer-theme-container';

    const label = document.createElement('span');
    label.className = 'drawer-theme-label';
    label.id = 'drawer-theme-label';

    const icon = document.createElement('span');
    icon.className = 'drawer-theme-icon';
    icon.id = 'drawer-theme-icon';

    themeContainer.appendChild(label);
    themeContainer.appendChild(icon);

    function updateThemeDisplay() {
        const currentTheme = window.ThemeManager?.get() || 'light';
        const isDark = currentTheme === 'dark';
        label.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';
        icon.textContent = isDark ? ICON.THEME_LIGHT : ICON.THEME_DARK;
    }

    updateThemeDisplay();

    themeChangeListener = updateThemeDisplay;
    if (StateEvents) {
        StateEvents.on('theme:change', themeChangeListener);
    }

    themeContainer.addEventListener('click', () => {
        if (window.ThemeManager) {
            window.ThemeManager.toggle();
            updateThemeDisplay();
        }
    });

    footer.appendChild(themeContainer);
    return footer;
}

function cleanupThemeListener() {
    if (themeChangeListener && StateEvents) {
        StateEvents.off('theme:change', themeChangeListener);
        themeChangeListener = null;
    }
}

function renderDrawer(menuItems, onItemClick) {
    const container = ensureContainer();
    overlayElement = createOverlay();
    drawerElement = document.createElement('div');
    drawerElement.className = DRAWER_CLASS;
    drawerElement.appendChild(createDrawerHeader());
    drawerElement.appendChild(createDrawerContent(menuItems, onItemClick));
    drawerElement.appendChild(createDrawerFooter());
    container.appendChild(overlayElement);
    container.appendChild(drawerElement);
}

// =============================================================================
// 3. API PUBLIK
// =============================================================================

function register(page, factoryFn) {
    if (typeof factoryFn !== 'function') {
        window.log.error('[Drawer ' + F_V + '] (1) register() memerlukan factory function.');
        return;
    }
    registry.set(page, factoryFn);
    window.log.info('[Drawer ' + F_V + '] (2) Drawer custom terdaftar: page=' + page);
}

function getConfig(page) {
    const factoryFn = registry.get(page);
    if (typeof factoryFn === 'function') {
        try {
            const config = factoryFn();
            if (config) {
                window.log.info('[Drawer ' + F_V + '] (3) Konfigurasi drawer diambil dari registri: page=' + page);
                return {
                    menuItems: config.menuItems || null,
                    onItemClick: config.onItemClick || null
                };
            }
        } catch (err) {
            window.log.error('[Drawer ' + F_V + '] (4) Gagal mengambil konfigurasi drawer:', err);
        }
    } else {
        window.log.info('[Drawer ' + F_V + '] (5) Tidak ada drawer custom untuk page=' + page + ', gunakan default');
    }
    return null;
}

function open(callbacks = {}, menuItems = null) {
    if (isDrawerOpen) {
        window.log.warn('[Drawer ' + F_V + '] (6) Drawer sudah terbuka, tidak bisa membuka lagi');
        return;
    }

    if (typeof window.PopupManager?.forceClose === 'function') {
        window.PopupManager.forceClose();
        window.log.info('[Drawer ' + F_V + '] (7) Popup ditutup sebelum membuka drawer');
    }

    _onClose = typeof callbacks.onClose === 'function' ? callbacks.onClose : null;

    const items = menuItems && Array.isArray(menuItems) && menuItems.length > 0
        ? menuItems.map(item => ({
            icon: item.icon || ICON.DOT,
            label: item.label || 'Menu',
            page: item.page || 'home'
        }))
        : DEFAULT_MENU_ITEMS;

    renderDrawer(items, callbacks.onItemClick);
    isDrawerOpen = true;

    window.log.info('[Drawer ' + F_V + '] (8) Drawer dibuka');
}

function forceClose() {
    if (!isDrawerOpen) return;

    const container = document.getElementById(DRAWER_CONTAINER_ID);
    if (container) {
        container.innerHTML = '';
    }

    overlayElement = null;
    drawerElement = null;
    isDrawerOpen = false;
    _onClose = null;

    cleanupThemeListener();

    window.log.info('[Drawer ' + F_V + '] (9) Drawer ditutup (force)');
}

function isOpen() {
    return isDrawerOpen;
}

// =============================================================================
// 4. EKSPOR
// =============================================================================

export const DrawerManager = {
    register,
    getConfig,
    open,
    forceClose,
    isOpen
};

window.DrawerManager = DrawerManager;

window.log.info('[Drawer ' + F_V + '] (10) DrawerManager dimuat');

// ================================ End Of File ================================