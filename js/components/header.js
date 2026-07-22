/**
 * =================================================================================
 * FILE         : /js/components/header.js
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

import { Router } from '../core/router.js';
import { StateEvents } from '../core/state.js';

// =============================================================================
// 0. IKON LOKAL & RANDOM ICON (dipindahkan dari texts.js)
// =============================================================================

const ICON = {
    MENU: '☰',
    THEME_LIGHT: '☀️',
    THEME_DARK: '🌙',
    RANDOM_FALLBACK: '🎲',
    CHECK_MARK: '✓'          // Baru: untuk step indicator selesai
};

const RANDOM_ICONS = [
    '⚡', '🧭', '🛠️', '🎯', '🤖', '🔥', '🚨', '🚦', '🎰', '💸',
    '⛑️', '📵', '⚠️', '🏳️'
];

function getRandomIcon() {
    return RANDOM_ICONS[Math.floor(Math.random() * RANDOM_ICONS.length)];
}

// =============================================================================
// 1. HELPER FUNCTIONS
// =============================================================================

function createMenuButton() {
    const btn = document.createElement('button');
    btn.className = 'header-icon';
    btn.textContent = ICON.MENU;
    btn.setAttribute('aria-label', 'Menu');

    btn.addEventListener('click', () => {
        Router.navigateTo({ target: 'drawer1' });
    });

    return btn;
}

function createThemeIcon() {
    const btn = document.createElement('button');
    btn.className = 'header-icon';
    btn.setAttribute('aria-label', 'Ganti tema');
    btn.setAttribute('data-theme-icon', 'true');

    function updateIcon() {
        const theme = window.ThemeManager ? window.ThemeManager.get() : 'light';
        btn.textContent = theme === 'dark' ? ICON.THEME_LIGHT : ICON.THEME_DARK;
        btn.setAttribute('title', theme === 'dark' ? 'Mode Terang' : 'Mode Gelap');
    }

    updateIcon();

    btn._themeCleanup = updateIcon;
    StateEvents.on('theme:change', updateIcon);

    btn.addEventListener('click', () => {
        if (window.ThemeManager) {
            window.ThemeManager.toggle();
            updateIcon();
        }
    });

    return btn;
}

function cleanupThemeListener(themeButton) {
    if (themeButton && typeof themeButton._themeCleanup === 'function') {
        StateEvents.off('theme:change', themeButton._themeCleanup);
        delete themeButton._themeCleanup;
    }
}

function createRandomIcon() {
    const span = document.createElement('span');
    span.className = 'header-random-icon';
    span.setAttribute('aria-label', 'Ikon acak');

    function updateIcon() {
        span.textContent = getRandomIcon();
    }

    updateIcon();

    span.addEventListener('click', (e) => {
        e.stopPropagation();
        updateIcon();
    });

    return span;
}

// =============================================================================
// 2. HEADER FACTORY
// =============================================================================

function createDefaultHeader(options = {}) {
    window.log.info('[Header ' + F_V + '] (1) createDefaultHeader() dipanggil');
    const header = document.createElement('div');
    header.className = 'header-default';

    const leftDiv = document.createElement('div');
    leftDiv.className = 'header-left';
    leftDiv.appendChild(createMenuButton());

    const centerDiv = document.createElement('div');
    centerDiv.className = 'header-center';

    const siteTitle = options.title || window.APP_CONFIG?.siteTitle || 'KupasTarif';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = siteTitle;
    titleSpan.className = 'text-lg font-semibold';

    centerDiv.appendChild(titleSpan);
    centerDiv.appendChild(createRandomIcon());

    const rightDiv = document.createElement('div');
    rightDiv.className = 'header-right';
    const themeBtn = createThemeIcon();
    rightDiv.appendChild(themeBtn);

    header.appendChild(leftDiv);
    header.appendChild(centerDiv);
    header.appendChild(rightDiv);

    header._themeButton = themeBtn;

    return header;
}

function createStep1Header() {
    window.log.info('[Header ' + F_V + '] (2) createStep1Header() dipanggil');
    return createStepHeader({ step1: 'active', step2: 'idle', step3: 'idle' });
}

function createStep2Header() {
    window.log.info('[Header ' + F_V + '] (3) createStep2Header() dipanggil');
    return createStepHeader({ step1: 'done', step2: 'active', step3: 'idle' });
}

function createStep3Header() {
    window.log.info('[Header ' + F_V + '] (4) createStep3Header() dipanggil');
    return createStepHeader({ step1: 'done', step2: 'done', step3: 'active' });
}

function createStepHeader({ step1, step2, step3 }) {
    const header = document.createElement('div');
    header.className = 'header-step';

    const leftSpacer = document.createElement('div');
    leftSpacer.style.width = '48px';

    const stepContainer = document.createElement('div');
    stepContainer.className = 'step-indicator';

    const s1 = document.createElement('div');
    s1.className = `step-item step-${step1}`;
    s1.textContent = step1 === 'done' ? ICON.CHECK_MARK : '1';
    stepContainer.appendChild(s1);

    const line1 = document.createElement('div');
    line1.className = `step-line ${step1}-${step2}`;
    stepContainer.appendChild(line1);

    const s2 = document.createElement('div');
    s2.className = `step-item step-${step2}`;
    s2.textContent = step2 === 'done' ? ICON.CHECK_MARK : '2';
    stepContainer.appendChild(s2);

    const line2 = document.createElement('div');
    line2.className = `step-line ${step2}-${step3}`;
    stepContainer.appendChild(line2);

    const s3 = document.createElement('div');
    s3.className = `step-item step-${step3}`;
    s3.textContent = step3 === 'done' ? ICON.CHECK_MARK : '3';
    stepContainer.appendChild(s3);

    const rightDiv = document.createElement('div');
    rightDiv.className = 'header-right';
    const themeBtn = createThemeIcon();
    rightDiv.appendChild(themeBtn);

    header.appendChild(leftSpacer);
    header.appendChild(stepContainer);
    header.appendChild(rightDiv);

    header._themeButton = themeBtn;

    return header;
}

function createLandingHeader(options = {}) {
    window.log.info('[Header ' + F_V + '] (5) createLandingHeader() dipanggil');
    const header = document.createElement('div');
    header.className = 'header-landing';

    const leftDiv = document.createElement('div');
    leftDiv.className = 'header-left';

    const landingText = document.createElement('span');
    landingText.className = 'header-landing-text text-lg';
    landingText.textContent = options.landingText || window.APP_CONFIG?.landingLink || 'linktr.ee/KUPASTARIF';
    landingText.style.cursor = 'pointer';
    landingText.setAttribute('title', 'Klik untuk menyalin link');
    landingText.setAttribute('role', 'button');
    landingText.setAttribute('tabindex', '0');

    landingText.addEventListener('click', () => {
        const link = landingText.textContent || '';
        navigator.clipboard.writeText(link).then(() => {
            if (window.ThemeManager) {
                window.ThemeManager.showToast('Link landing disalin', 'success', 2000);
            }
        }).catch(() => {
            if (window.ThemeManager) {
                window.ThemeManager.showToast('Gagal menyalin link', 'error');
            }
        });
    });

    leftDiv.appendChild(landingText);

    const rightDiv = document.createElement('div');
    rightDiv.className = 'header-right';
    const themeBtn = createThemeIcon();
    rightDiv.appendChild(themeBtn);

    header.appendChild(leftDiv);
    header.appendChild(rightDiv);

    header._themeButton = themeBtn;

    return header;
}

// =============================================================================
// 3. FACTORY UTAMA
// =============================================================================

function create(type, options = {}) {
    window.log.info('[Header ' + F_V + '] (6) create() dipanggil: type=' + type);
    let header = null;
    switch (type) {
        case 'default':
            header = createDefaultHeader(options);
            break;
        case 'step1':
            header = createStep1Header();
            break;
        case 'step2':
            header = createStep2Header();
            break;
        case 'step3':
            header = createStep3Header();
            break;
        case 'landing':
            header = createLandingHeader(options);
            break;
        case 'custom':
            return null;
        case 'hide':
            return null;
        default:
            window.log.warn('[Header ' + F_V + '] (7) Tipe "' + type + '" tidak dikenal, menggunakan default');
            header = createDefaultHeader(options);
    }
    return header;
}

function destroyHeader(headerElement) {
    if (!headerElement) return;
    window.log.info('[Header ' + F_V + '] (8) destroyHeader() dipanggil');
    if (headerElement._themeButton) {
        cleanupThemeListener(headerElement._themeButton);
        delete headerElement._themeButton;
    }
}

// =============================================================================
// 4. EKSPOR
// =============================================================================

export const HeaderManager = {
    create,
    destroy: destroyHeader,
    createDefaultHeader,
    createStep1Header,
    createStep2Header,
    createStep3Header,
    createLandingHeader
};

window.log.info('[Header ' + F_V + '] (9) HeaderManager dimuat');

// ================================ End Of File ================================