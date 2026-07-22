/**
 * =================================================================================
 * FILE         : /js/components/theme.js
 * FILE VERSION : 2.0.1-rev1
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
const F_V = '2.0.1-rev1';

import { StateManager, StateEvents } from '../core/state.js';
import { StorageManager } from '../core/storage.js';

// =============================================================================
// 0. IKON LOKAL (tidak lagi bergantung pada texts.js)
// =============================================================================

const ICON = {
    THEME_LIGHT: '☀️',
    THEME_DARK: '🌙',
    CHECK: '✓',
    CANCEL: '✖',
    WARNING: '⚠',
    INFO: 'ⓘ'
};

// =============================================================================
// 1. KONSTANTA
// =============================================================================

const THEME_ATTR = 'data-theme';
const TOAST_CONTAINER_ID = 'toast-container';

const MAX_TOASTS = window.APP_CONFIG?.maxToasts || 3;
const MAX_TOAST_QUEUE = window.APP_CONFIG?.maxToastQueue || 10;
const DEFAULT_TOAST_DURATION = 3000;

// =============================================================================
// 2. STATE INTERNAL
// =============================================================================

let currentTheme = 'light';
const toastQueue = [];
const activeToasts = [];
let toastIdCounter = 0;
let toastContainer = null;

// =============================================================================
// 3. THEME MANAGER
// =============================================================================

function applyTheme(theme) {
    const resolved = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute(THEME_ATTR, resolved);
    currentTheme = resolved;
    updateThemeIcons(resolved);
    window.log.info('[Theme ' + F_V + '] (1) Tema diterapkan: ' + resolved);
}

function updateThemeIcons(theme) {
    const icons = document.querySelectorAll('[data-theme-icon]');
    const iconChar = theme === 'dark' ? ICON.THEME_LIGHT : ICON.THEME_DARK;
    const labelText = theme === 'dark' ? 'Mode Terang' : 'Mode Gelap';

    icons.forEach(icon => {
        if (icon) {
            icon.textContent = iconChar;
            icon.setAttribute('title', labelText);
        }
    });
}

function initTheme() {
    let stored = StorageManager.getTheme();
    if (!stored) {
        stored = window.APP_CONFIG?.defaultTheme || 'light';
    }
    applyTheme(stored);
    StateManager.set('theme', stored);
    window.log.info('[Theme ' + F_V + '] (2) Tema diinisialisasi: ' + stored);
}

function setTheme(theme) {
    const resolved = theme === 'dark' ? 'dark' : 'light';
    StorageManager.saveTheme(resolved);
    applyTheme(resolved);
    StateManager.set('theme', resolved);
    window.log.info('[Theme ' + F_V + '] (3) Tema diubah ke: ' + resolved);
}

function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    window.log.info('[Theme ' + F_V + '] (4) Tema di-toggle ke: ' + newTheme);
    setTheme(newTheme);
}

function getCurrentTheme() {
    return currentTheme;
}

// =============================================================================
// 4. TOAST SYSTEM
// =============================================================================

function ensureToastContainer() {
    if (toastContainer) return toastContainer;

    toastContainer = document.getElementById(TOAST_CONTAINER_ID);
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = TOAST_CONTAINER_ID;
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

function getToastIcon(type) {
    const icons = {
        success: ICON.CHECK,
        error: ICON.CANCEL,
        warning: ICON.WARNING,
        info: ICON.INFO
    };
    return icons[type] || ICON.INFO;
}

function getToastClass(type) {
    const classes = {
        success: 'toast-success',
        error: 'toast-error',
        warning: 'toast-warning',
        info: 'toast-info'
    };
    return classes[type] || 'toast-info';
}

function createToastElement(toast) {
    const div = document.createElement('div');
    div.className = 'toast ' + getToastClass(toast.type);
    div.setAttribute('data-toast-id', toast.id);

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = getToastIcon(toast.type);

    const content = document.createElement('span');
    content.className = 'toast-content';
    content.textContent = toast.message;

    div.appendChild(icon);
    div.appendChild(content);

    div.addEventListener('click', () => hideToast(toast.id));

    return div;
}

function processQueue() {
    window.log.info('[Theme ' + F_V + '] (5) Memproses toast queue');
    const container = ensureToastContainer();

    if (activeToasts.length >= MAX_TOASTS) return;

    let processed = 0;
    while (toastQueue.length > 0 && activeToasts.length < MAX_TOASTS) {
        const toast = toastQueue.shift();
        const element = createToastElement(toast);

        container.appendChild(element);
        activeToasts.push({
            id: toast.id,
            type: toast.type,
            message: toast.message,
            element
        });

        if (toast.duration > 0) {
            setTimeout(() => hideToast(toast.id), toast.duration);
        }
        processed++;
    }

    if (processed > 0) {
        window.log.info('[Theme ' + F_V + '] (6) ' + processed + ' toast ditampilkan dari queue');
    }

    syncToastState();
}

function showToast(message, type = 'info', duration = DEFAULT_TOAST_DURATION) {
    if (toastQueue.length >= MAX_TOAST_QUEUE) {
        window.log.warn('[Theme ' + F_V + '] (7) Toast queue penuh, toast diabaikan');
        return -1;
    }

    const id = ++toastIdCounter;
    const toast = { id, message, type, duration };

    toastQueue.push(toast);

    if (toastQueue.length > MAX_TOAST_QUEUE) {
        toastQueue.splice(0, toastQueue.length - MAX_TOAST_QUEUE);
    }

    processQueue();
    syncToastState();

    return id;
}

function hideToast(id) {
    window.log.info('[Theme ' + F_V + '] (8) Menyembunyikan toast: id=' + id);
    const index = activeToasts.findIndex(t => t.id === id);
    if (index === -1) return;

    const toast = activeToasts[index];
    if (toast.element) {
        toast.element.classList.add('hide');
        setTimeout(() => {
            if (toast.element?.parentNode) {
                toast.element.parentNode.removeChild(toast.element);
            }
        }, 200);
    }

    activeToasts.splice(index, 1);
    processQueue();
    syncToastState();
}

function clearAllToasts() {
    window.log.info('[Theme ' + F_V + '] (9) Membersihkan semua toast');
    activeToasts.forEach(toast => {
        if (toast.element?.parentNode) {
            toast.element.parentNode.removeChild(toast.element);
        }
    });

    activeToasts.length = 0;
    toastQueue.length = 0;
    syncToastState();
}

function syncToastState() {
    StateManager.set('toastQueue', toastQueue);
    StateManager.set('activeToasts', activeToasts);
}

function initToast() {
    ensureToastContainer();

    if (StateEvents) {
        StateEvents.on('toast:show', toast => {
            showToast(toast.message, toast.type, toast.duration);
        });
    }

    window.log.info('[Theme ' + F_V + '] (10) Toast system diinisialisasi');
}

// =============================================================================
// 5. INISIALISASI
// =============================================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}

initToast();

if (StateEvents) {
    StateEvents.on('theme:change', applyTheme);
    window.log.info('[Theme ' + F_V + '] (11) Listener theme:change terpasang');
}

// =============================================================================
// 6. EKSPOR
// =============================================================================

export const ThemeManager = {
    init: initTheme,
    set: setTheme,
    get: getCurrentTheme,
    toggle: toggleTheme,
    apply: applyTheme,
    showToast,
    hideToast,
    clearAllToasts
};

window.ThemeManager = ThemeManager;

window.log.info('[Theme ' + F_V + '] (12) ThemeManager dimuat');

// ================================ End Of File ================================