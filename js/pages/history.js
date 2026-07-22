/**
 * =================================================================================
 * FILE         : /js/pages/history.js
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

import { Router } from '../core/router.js';
import { StateManager } from '../core/state.js';
import { StorageManager } from '../core/storage.js';
import { HeaderManager } from '../components/header.js';
import { FooterManager } from '../components/footer.js';
import { ThemeManager } from '../components/theme.js';
import { PopupManager } from '../components/popup.js';
import { DrawerManager } from '../components/drawer.js';
import {
    formatRupiah, formatKm, formatMenit, formatPersen, formatRelativeTime,
    calculateHistoryStats, escapeHtml
} from '../helpers/format.js';

// =============================================================================
// 0. IKON LOKAL (tidak lagi bergantung pada getIcon dari texts.js)
// =============================================================================

const ICON = {
    DRIVER: '👤',
    APP: '📱',
    FUEL: '⛽',
    MAINTENANCE: '🔧',
    PENUMPANG: '🧑',
    MOTOR: '🏍️',
    MOBIL: '🚗',
    SHOW_MAP: '🗺️',
    DELETE: '🗑️',
    EMPTY_HISTORY: '📭',
    BACK: '◀',
    CHEVRON_RIGHT: '▶',
    CHART: '📈',
    MENU: '☰',
    HOME: '🏠'
};

// =============================================================================
// 1. STATE INTERNAL
// =============================================================================

let isDestroyed = false;
let historyItems = [];
let filteredItems = [];
let currentFilter = 'all';
let operationalToggle = false;
let currentPage = 1;
const itemsPerPage = 10;

let currentHeader = null;

let stats = {
    driver: { value: 0, percent: 0 },
    app: { value: 0, percent: 0 },
    bbm: { value: 0, percent: 0 },
    kendaraan: { value: 0, percent: 0 },
    passenger: { value: 0, percent: 100 }
};

// =============================================================================
// 2. LOAD DATA
// =============================================================================

function loadHistoryData() {
    if (StorageManager) {
        historyItems = StorageManager.getHistory();
    } else {
        historyItems = [];
    }

    historyItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    applyFilter();
    window.log.info('[History ' + F_V + '] (1) Data history dimuat | total=' + historyItems.length);
}

function applyFilter() {
    switch (currentFilter) {
        case 'all':
            filteredItems = [...historyItems];
            break;
        case 'motor':
            filteredItems = historyItems.filter(item => {
                const input = item.input || {};
                return input.E10 === 'Motor';
            });
            break;
        case 'mobil':
            filteredItems = historyItems.filter(item => {
                const input = item.input || {};
                return input.E10 === 'Mobil';
            });
            break;
        default:
            filteredItems = [...historyItems];
    }

    if (operationalToggle) {
        filteredItems = filteredItems.filter(item => item.type === 'operational');
    } else {
        filteredItems = filteredItems.filter(item => item.type !== 'operational');
    }

    stats = calculateHistoryStats(filteredItems);
    currentPage = 1;
}

// =============================================================================
// 3. RENDER
// =============================================================================

function renderStats() {
    return `<div class="card">
        <div class="history-stats">
            <div class="history-stats-grid">
                <div class="stat-card stat-driver">
                    <div class="stat-label">${ICON.DRIVER} DRIVER</div>
                    <div class="stat-value">${formatRupiah(stats.driver.value)}</div>
                    <div class="stat-percent">${stats.driver.percent.toFixed(1)}%</div>
                </div>
                <div class="stat-card stat-app">
                    <div class="stat-label">${ICON.APP} APLIKASI</div>
                    <div class="stat-value">${formatRupiah(stats.app.value)}</div>
                    <div class="stat-percent">${stats.app.percent.toFixed(1)}%</div>
                </div>
            </div>
            <div class="history-stat-row">
                <span class="stat-row-label">${ICON.FUEL} BBM</span>
                <span class="stat-row-value">(${stats.bbm.percent.toFixed(1)}%) ${formatRupiah(stats.bbm.value)}</span>
            </div>
            <div class="history-stat-row">
                <span class="stat-row-label">${ICON.MAINTENANCE} KENDARAAN</span>
                <span class="stat-row-value">(${stats.kendaraan.percent.toFixed(1)}%) ${formatRupiah(stats.kendaraan.value)}</span>
            </div>
            <div class="history-stat-row">
                <span class="stat-row-label">${ICON.PENUMPANG} PENUMPANG</span>
                <span class="stat-row-value">(100%) ${formatRupiah(stats.passenger.value)}</span>
            </div>
        </div>
    </div>`;
}

function renderFilter() {
    const allCount = historyItems.filter(i => i.type !== 'operational').length;
    const motorCount = historyItems.filter(i => {
        const input = i.input || {};
        return input.E10 === 'Motor' && i.type !== 'operational';
    }).length;
    const mobilCount = historyItems.filter(i => {
        const input = i.input || {};
        return input.E10 === 'Mobil' && i.type !== 'operational';
    }).length;

    const active = (f) => currentFilter === f ? 'active' : '';

    return `<div class="card">
        <div class="settings-switch-row py-sm">
            <span>${ICON.FUEL} OPERASIONAL</span>
            <span class="toggle" role="switch" aria-checked="${operationalToggle ? 'true' : 'false'}" tabindex="0" id="operational-toggle">
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </span>
        </div>
        <div class="history-filters">
            <button class="filter-btn ${active('all')}" data-filter="all">SEMUA (${allCount})</button>
            <button class="filter-btn ${active('motor')}" data-filter="motor">${ICON.MOTOR} MOTOR (${motorCount})</button>
            <button class="filter-btn ${active('mobil')}" data-filter="mobil">${ICON.MOBIL} MOBIL (${mobilCount})</button>
        </div>
    </div>`;
}

function renderList() {
    if (filteredItems.length === 0) {
        return `<div class="card text-center p-lg"><p class="text-muted">${ICON.EMPTY_HISTORY} Belum ada riwayat perjalanan</p></div>`;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, filteredItems.length);
    const pageItems = filteredItems.slice(start, end);

    let itemsHTML = '';
    pageItems.forEach(item => {
        const input = item.input || {};
        const result = item.result || {};
        const mode = input.E10 || 'Mobil';
        const role = input.E12 || 'Driver';
        const service = input.E46 || 'Standar';
        const isOp = item.type === 'operational';
        const driverIncome = isOp ? (result.E960 || 0) : (result.E981 || 0);
        const distance = result.E752 || 0;
        const time = result.E753 || 0;
        const timestamp = item.timestamp || Date.now();
        const itemRefId = item.refId || '';
        const hasTracking = item.hasTracking || false;

        const modeIcon = mode === 'Motor' ? ICON.MOTOR : ICON.MOBIL;
        const roleIcon = role === 'Driver' ? ICON.DRIVER : ICON.PENUMPANG;
        const typeLabel = isOp ? '<span class="badge badge-info ml-xs">OPERASIONAL</span>' : `<span class="ml-xs">${service || 'Standar'}</span>`;
        const relativeTime = formatRelativeTime(timestamp);

        itemsHTML += `<div class="history-item" data-ref-id="${itemRefId}">
            <div class="history-item-main">
                <div class="history-item-info">
                    <span class="history-item-icon">${modeIcon}</span>
                    <span class="history-item-icon">${roleIcon}</span>
                    <span class="history-item-mode">${mode}</span>
                    ${typeLabel}
                    <span class="history-item-sep">·</span>
                    <span class="history-item-income">${formatRupiah(driverIncome)}</span>
                    ${hasTracking ? `<span class="history-item-icon ml-xs" data-action="showmap" data-ref-id="${itemRefId}" data-mode="${isOp ? 'operational' : mode}" title="Lihat Rute">${ICON.SHOW_MAP}</span>` : ''}
                </div>
                <button class="history-item-delete" data-ref-id="${itemRefId}" title="Hapus">${ICON.DELETE}</button>
            </div>
            <div class="history-item-meta">${formatKm(distance)} · ${formatMenit(time)} · ${relativeTime}</div>
        </div>`;
    });

    return `<div class="card history-list-card"><div class="history-list">${itemsHTML}</div></div>`;
}

function renderPagination() {
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
    if (totalPages <= 1) return '';

    const prevDisabled = currentPage === 1 ? 'disabled' : '';
    const nextDisabled = currentPage === totalPages ? 'disabled' : '';

    let pageNumbers = '';
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        pageNumbers += `<button class="page-btn" data-page="1">1</button>`;
        if (startPage > 2) pageNumbers += '<span class="page-ellipsis">...</span>';
    }

    for (let i = startPage; i <= endPage; i++) {
        const active = i === currentPage ? 'active' : '';
        pageNumbers += `<button class="page-btn ${active}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageNumbers += '<span class="page-ellipsis">...</span>';
        pageNumbers += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    return `<div class="history-pagination">
        <button class="page-nav ${prevDisabled}" data-page="prev" ${prevDisabled ? 'disabled' : ''}>${ICON.BACK}</button>
        ${pageNumbers}
        <button class="page-nav ${nextDisabled}" data-page="next" ${nextDisabled ? 'disabled' : ''}>${ICON.CHEVRON_RIGHT}</button>
    </div>`;
}

function renderClearAllButton() {
    if (historyItems.length === 0) return '';
    return `<div class="history-clear-all">
        <button class="btn btn-outline-danger" id="clear-all-btn">${ICON.DELETE} HAPUS SEMUA</button>
    </div>`;
}

function buildHTML() {
    return `<div class="page-container">
        <div class="page-title">${ICON.CHART} RIWAYAT PERJALANAN</div>
        <div id="history-stats-container">${renderStats()}</div>
        <div id="history-filter-container">${renderFilter()}</div>
        <div id="history-list-container">${renderList()}</div>
        <div id="history-pagination-container">${renderPagination()}</div>
        <div id="history-clear-container">${renderClearAllButton()}</div>
    </div>`;
}

function refreshUI() {
    const statsC = document.getElementById('history-stats-container');
    const filterC = document.getElementById('history-filter-container');
    const listC = document.getElementById('history-list-container');
    const pagC = document.getElementById('history-pagination-container');
    const clearC = document.getElementById('history-clear-container');

    if (statsC) statsC.innerHTML = renderStats();
    if (filterC) filterC.innerHTML = renderFilter();
    if (listC) listC.innerHTML = renderList();
    if (pagC) pagC.innerHTML = renderPagination();
    if (clearC) clearC.innerHTML = renderClearAllButton();

    bindEvents();
}

function bindEvents() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isDestroyed) return;
            currentFilter = btn.dataset.filter;
            applyFilter();
            refreshUI();
        });
    });

    const toggle = document.getElementById('operational-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            if (isDestroyed) return;
            operationalToggle = !operationalToggle;
            toggle.setAttribute('aria-checked', operationalToggle ? 'true' : 'false');
            applyFilter();
            refreshUI();
        });
    }

    document.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isDestroyed) return;
            const page = parseInt(btn.dataset.page);
            if (!isNaN(page) && page >= 1 && page <= Math.ceil(filteredItems.length / itemsPerPage)) {
                currentPage = page;
                refreshUI();
            }
        });
    });

    document.querySelectorAll('.page-nav').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isDestroyed) return;
            const total = Math.ceil(filteredItems.length / itemsPerPage);
            if (btn.dataset.page === 'prev' && currentPage > 1) { currentPage--; refreshUI(); }
            else if (btn.dataset.page === 'next' && currentPage < total) { currentPage++; refreshUI(); }
        });
    });

    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('history-item-delete')) return;
            if (e.target.dataset.action === 'showmap') return;
            if (isDestroyed) return;
            const refId = item.dataset.refId;
            if (refId) {
                Router.navigateTo({ target: 'report', refid: refId });
            }
        });
    });

    document.querySelectorAll('[data-action="showmap"]').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isDestroyed) return;
            const refId = icon.dataset.refId;
            if (refId) {
                Router.navigateTo({ target: 'showmapdetail', refid: refId });
            }
        });
    });

    document.querySelectorAll('.history-item-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isDestroyed) return;
            window._pendingDeleteRefId = btn.dataset.refId;
            Router.navigateTo({ target: 'popup6' });
        });
    });

    const clearAll = document.getElementById('clear-all-btn');
    if (clearAll) {
        clearAll.addEventListener('click', () => {
            Router.navigateTo({ target: 'popup8' });
        });
    }
}

// =============================================================================
// 4. EKSEKUSI DELETE
// =============================================================================

function executeDelete(refId) {
    if (StorageManager) StorageManager.deleteHistoryItem(refId);
    loadHistoryData();
    refreshUI();
    ThemeManager?.showToast('Riwayat dihapus', 'success');
    window.log.info('[History ' + F_V + '] (2) Item dihapus: refId=' + refId);
}

function executeClearAll() {
    if (StorageManager) StorageManager.clearHistory();
    loadHistoryData();
    refreshUI();
    ThemeManager?.showToast('Semua riwayat dihapus', 'success');
    window.log.info('[History ' + F_V + '] (3) Semua history dihapus');
}

// =============================================================================
// 5. REGISTRASI POPUP & DRAWER
// =============================================================================

PopupManager.register(6, () => ({
    defaultOnly: true,
    onConfirm: () => {
        const refId = window._pendingDeleteRefId;
        if (refId) executeDelete(refId);
        window._pendingDeleteRefId = null;
    }
}));

PopupManager.register(8, () => ({
    defaultOnly: true,
    onConfirm: () => executeClearAll()
}));

DrawerManager.register('history', () => ({
    menuItems: null,
    onItemClick: (page) => {
        Router.navigateTo({ target: page, closeDrawer: true });
    }
}));

// =============================================================================
// 6. UPDATE HEADER & FOOTER
// =============================================================================

function updateHeader() {
    const container = document.getElementById('app-header');
    if (!container || !HeaderManager) return;
    if (currentHeader) { HeaderManager.destroy(currentHeader); }
    const header = HeaderManager.create('default', { title: window.APP_CONFIG?.siteTitle });
    container.innerHTML = '';
    if (header) { container.appendChild(header); currentHeader = header; }
    else { currentHeader = null; }
}

function updateFooter() {
    const container = document.getElementById('app-footer');
    if (!container || !FooterManager) return;

    const footer = FooterManager.create('layoutA', {
        frame1: {
            type: 'icon',
            content: FooterManager.createIconButton(ICON.MENU, () => {
                Router.navigateTo({ target: 'drawer1' });
            }, 'Menu')
        },
        frame2: {
            type: 'flex',
            content: FooterManager.createFlexContent('HOME', ICON.HOME, () => {
                Router.navigateTo({ target: 'home' });
            })
        }
    });

    container.innerHTML = '';
    if (footer) container.appendChild(footer);
}

// =============================================================================
// 7. RENDER & DESTROY
// =============================================================================

async function render(params, context = {}) {
    const content = document.getElementById('app-content');
    if (!content) return;

    isDestroyed = false;

    // selalu muat ulang data tanpa peduli arah navigasi
    currentFilter = params?.filter || 'all';
    operationalToggle = false;
    currentPage = 1;
    loadHistoryData();

    content.innerHTML = buildHTML();
    bindEvents();
    updateHeader();
    updateFooter();

    window.log.info('[History ' + F_V + '] (4) History dirender');
}

function destroy() {
    isDestroyed = true;
    historyItems = [];
    filteredItems = [];
    if (currentHeader) { HeaderManager.destroy(currentHeader); currentHeader = null; }
}

// =============================================================================
// 8. EKSPOR
// =============================================================================

export const PageHistory = {
    render,
    destroy
};

window.log.info('[History ' + F_V + '] (5) PageHistory dimuat');


// ================================ End Of File ================================