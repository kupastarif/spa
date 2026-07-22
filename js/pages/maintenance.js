/**
 * =================================================================================
 * FILE         : /js/pages/maintenance.js
 * FILE VERSION : 2.0.1-rev5
 * APP VERSION  : 2.0.1
 * DATE         : 17 Juli 2026
 * @author      : gk
 *
 * CHANGELOG  :
 *
 * =================================================================================
 */

'use strict';

// ==================== VERSI FILE ====================
const F_V = '2.0.1-rev5';

import { Router } from '../core/router.js';
import { StateManager } from '../core/state.js';
import { PreferencesManager } from '../core/preferences.js';
import { StorageManager } from '../core/storage.js';
import { HeaderManager } from '../components/header.js';
import { FooterManager } from '../components/footer.js';
import { ThemeManager } from '../components/theme.js';
import { DrawerManager } from '../components/drawer.js';
import {
    formatRupiah, formatKm, formatMenitPanjang, formatNumber
} from '../helpers/format.js';
import {
    getMaintenanceItems, getTaxItems, getAttributeItems,
    calculateMaintenanceProgress, calculateDepreciationSummary,
    getConstant
} from '../helpers/output.js';

// =============================================================================
// 0. IKON LOKAL
// =============================================================================

const ICON = {
    MOBIL: '🚗',
    MOTOR: '🏍️',
    INFO: 'ⓘ',
    MAINTENANCE: '🔧',
    FUEL: '⛽',
    TAX: '📄',
    DOCUMENT: '📄',
    MENU: '☰',
    HOME: '🏠'
};

// =============================================================================
// 1. STATE INTERNAL
// =============================================================================

let isDestroyed = false;
let currentFilter = 'Mobil';   // 'Mobil' atau 'Motor'
let currentHeader = null;

// Akumulasi data terpisah
let accumulatedMobil = { totalDistance: 0, totalTime: 0, totalDepreciation: 0, totalWelfare: 0, totalFuelRupiah: 0 };
let accumulatedMotor = { totalDistance: 0, totalTime: 0, totalDepreciation: 0, totalWelfare: 0, totalFuelRupiah: 0 };

let maintenanceItems = [];
let taxItems = [];
let attributeItems = [];
let depreciationSummary = null;
let cycleData = {};          // data siklus untuk mode saat ini (tanpa prefix)
let debounceTimers = {};

let tripCountMobil = 0;
let tripCountMotor = 0;

let extraKmGemukCost = 0;

// =============================================================================
// 2. HELPER
// =============================================================================

/**
 * Mengembalikan cc default sesuai mode kendaraan yang sedang difilter.
 * Tidak bergantung pada input halaman lain agar data pajak/perawatan
 * selalu menampilkan item yang valid untuk mode tersebut.
 */
function getCurrentCC() {
    return currentFilter === 'Mobil' ? '1000cc' : '125cc';
}

function getFuelPrice() {
    const cc = getCurrentCC();
    if (currentFilter === 'Mobil' && cc === '2000cc') {
        return getConstant('E303') || 6500;
    }
    return getConstant('E302') || 10000;
}

function _makeCycleKey(label) {
    return currentFilter + '_' + label;
}

function getAccumulatedData() {
    return currentFilter === 'Mobil' ? accumulatedMobil : accumulatedMotor;
}

// =============================================================================
// 3. LOAD DATA
// =============================================================================

function loadAccumulatedData() {
    accumulatedMobil = { totalDistance: 0, totalTime: 0, totalDepreciation: 0, totalWelfare: 0, totalFuelRupiah: 0 };
    accumulatedMotor = { totalDistance: 0, totalTime: 0, totalDepreciation: 0, totalWelfare: 0, totalFuelRupiah: 0 };
    let countMobil = 0, countMotor = 0;

    if (StorageManager) {
        const history = StorageManager.getHistory();
        history.forEach(item => {
            const r = item.result || {};
            const input = item.input || {};
            const mode = input.E10 || 'Mobil';
            const dist = r.E752 || 0;
            const time = r.E753 || 0;   // menit
            const dep = r.E825 || 0;
            const welfare = r.E701 || 0;
            const fuel = r.E911 || 0;

            if (mode === 'Mobil') {
                accumulatedMobil.totalDistance += dist;
                accumulatedMobil.totalTime += time;
                accumulatedMobil.totalDepreciation += dep;
                accumulatedMobil.totalWelfare += welfare;
                accumulatedMobil.totalFuelRupiah += fuel;
                countMobil++;
            } else {
                accumulatedMotor.totalDistance += dist;
                accumulatedMotor.totalTime += time;
                accumulatedMotor.totalDepreciation += dep;
                accumulatedMotor.totalWelfare += welfare;
                accumulatedMotor.totalFuelRupiah += fuel;
                countMotor++;
            }
        });
    }

    tripCountMobil = countMobil;
    tripCountMotor = countMotor;
}

function determineDefaultFilter() {
    if (accumulatedMobil.totalDistance >= accumulatedMotor.totalDistance) return 'Mobil';
    return 'Motor';
}

function loadCycleData() {
    const allData = StorageManager?.getCycleData() || {};
    const prefix = currentFilter + '_';
    cycleData = {};
    for (const key in allData) {
        if (key.startsWith(prefix)) {
            const label = key.substring(prefix.length);
            cycleData[label] = allData[key];
        }
    }
}

function loadMaintenanceData() {
    const acc = getAccumulatedData();
    const cc = getCurrentCC();

    maintenanceItems = getMaintenanceItems(currentFilter, cc) || [];
    taxItems = getTaxItems(currentFilter, cc) || [];
    attributeItems = getAttributeItems(currentFilter) || [];

    // Filter item khusus
    maintenanceItems = maintenanceItems.filter(item => item.label !== 'Penyusutan Extra Km Gemuk (bekas ojol)');

    extraKmGemukCost = acc.totalDistance * 10;

    // Paksa interval: perawatan => km, pajak & atribut => hari
    maintenanceItems = calculateMaintenanceProgress(
        maintenanceItems, acc.totalDistance, acc.totalTime, cycleData, 'km'
    );
    taxItems = calculateMaintenanceProgress(
        taxItems, acc.totalDistance, acc.totalTime, cycleData, 'day'
    );
    attributeItems = calculateMaintenanceProgress(
        attributeItems, acc.totalDistance, acc.totalTime, cycleData, 'day'
    );

    // Buang item tanpa biaya
    maintenanceItems = maintenanceItems.filter(item => item.dcell > 0);
    taxItems = taxItems.filter(item => item.dcell > 0);
    attributeItems = attributeItems.filter(item => item.dcell > 0);

    // Urutkan berdasarkan progress menurun
    maintenanceItems.sort((a, b) => (b.progressPercent || 0) - (a.progressPercent || 0));
    taxItems.sort((a, b) => (b.progressPercent || 0) - (a.progressPercent || 0));
    attributeItems.sort((a, b) => (b.progressPercent || 0) - (a.progressPercent || 0));

    depreciationSummary = calculateDepreciationSummary(
        { E10: currentFilter, E22: cc },
        acc.totalDepreciation
    );
}

// =============================================================================
// 4. RESET CYCLE
// =============================================================================

function handleReset(itemLabel, intervalKm, cost) {
    if (debounceTimers[itemLabel]) {
        clearTimeout(debounceTimers[itemLabel]);
    }

    debounceTimers[itemLabel] = setTimeout(() => {
        const allData = StorageManager?.getCycleData() || {};
        const key = _makeCycleKey(itemLabel);
        const currentCycle = allData[key] || { cycleCount: 0 };
        const newCycleCount = (currentCycle.cycleCount || 0) + 1;

        allData[key] = {
            cycleCount: newCycleCount,
            lastReset: Date.now()
        };

        StorageManager?.saveCycleData(allData);
        loadCycleData();
        loadMaintenanceData();
        refreshUI();

        ThemeManager?.showToast('Servis berhasil dicatat', 'success');
        debounceTimers[itemLabel] = null;
    }, 500);
}

// =============================================================================
// 5. RENDER
// =============================================================================

function renderFilter() {
    const active = (f) => currentFilter === f ? 'active' : '';
    return `<div class="maint-filter-bar">
        <button class="maint-filter-btn ${active('Mobil')}" data-filter="Mobil">${ICON.MOBIL} MOBIL (${tripCountMobil})</button>
        <button class="maint-filter-btn ${active('Motor')}" data-filter="Motor">${ICON.MOTOR} MOTOR (${tripCountMotor})</button>
    </div>`;
}

function renderSummaryCards() {
    const acc = getAccumulatedData();
    const totalLiter = acc.totalFuelRupiah / getFuelPrice();

    return `<div class="maint-summary-grid" style="grid-template-columns: 1fr 1fr;">
        <div class="maint-summary-item">
            <div class="maint-summary-label">Total Jarak <span class="input-info" data-help="maintenance-jarak">${ICON.INFO}</span></div>
            <div class="maint-summary-value">${formatKm(acc.totalDistance)}</div>
        </div>
        <div class="maint-summary-item">
            <div class="maint-summary-label">Total Waktu <span class="input-info" data-help="maintenance-waktu">${ICON.INFO}</span></div>
            <div class="maint-summary-value">${formatMenitPanjang(acc.totalTime)}</div>
        </div>
        <div class="maint-summary-item">
            <div class="maint-summary-label">Kesejahteraan Driver</div>
            <div class="maint-summary-value">${formatRupiah(acc.totalWelfare)}</div>
            <div class="maint-summary-footer">tapi aplikasi? <span class="input-info input-info-danger" data-help="maintenance-kesejahteraan">${ICON.INFO}</span></div>
        </div>
        <div class="maint-summary-item">
            <div class="maint-summary-label">BBM (Total Liter) <span class="input-info" data-help="maintenance-bbm">${ICON.INFO}</span></div>
            <div class="maint-summary-value">${formatNumber(totalLiter, { decimals: 1, suffix: ' L' })}</div>
        </div>
    </div>`;
}

function getStatusClass(item) {
    if (item.isDue) return 'due';
    if (item.progressPercent >= 80) return 'warning';
    return 'ok';
}

function getStatusLabel(item) {
    if (item.isDue) {
        const missing = item.missingRounds || 0;
        return missing > 0 ? `TERTINGGAL ${missing}x` : 'WAKTUNYA';
    }
    if (item.progressPercent >= 80) return 'SEGERA';
    return 'AMAN';
}

function formatDaysAndHours(totalDays) {
    const days = Math.floor(totalDays);
    const hours = Math.round((totalDays - days) * 24);
    return `${days} hari ${hours} jam`;
}

function renderProgressList(title, icon, helpKey, items) {
    if (!items || items.length === 0) return '';

    const acc = getAccumulatedData();
    const totalDays = acc.totalTime / 1440;

    let itemsHTML = '';
    items.forEach(item => {
        const statusClass = getStatusClass(item);
        const statusLabel = getStatusLabel(item);
        const fillClass = item.progressPercent >= 100 ? 'complete' :
            (item.progressPercent >= 80 ? 'warning' : (item.isDue ? 'due' : ''));

        const cycleCount = item.cycleCount || 0;
        const interval = item.ecell || 0;

        let detailText = '';
        if (interval > 0) {
            if (item.intervalType === 'day') {
                const effectiveDays = item.effectiveDays != null
                    ? item.effectiveDays
                    : Math.max(0, totalDays - (cycleCount * interval));
                detailText = `${formatDaysAndHours(effectiveDays)} / ${interval} hari`;
            } else {
                // default km – tampilkan dengan satuan km
                const effectiveDistance = item.effectiveDistance != null
                    ? item.effectiveDistance
                    : Math.max(0, acc.totalDistance - (cycleCount * interval));
                detailText = `${formatKm(effectiveDistance, true)} / ${formatKm(interval, true)}`;
            }
            if (cycleCount > 0) detailText += ` · Servis ke-${cycleCount + 1}`;
        } else {
            detailText = '-';
        }

        const canReset = item.progressPercent >= 100;

        itemsHTML += `<div class="maint-progress-item">
            <div class="maint-progress-header">
                <span class="maint-progress-name">${item.label || 'Item'}</span>
                <span class="maint-progress-status ${statusClass}">${statusLabel}</span>
                ${canReset ? `<button class="btn btn-sm btn-outline maint-reset-btn" data-item="${item.label || 'item'}" data-interval="${interval}" data-cost="${item.dcell || 0}">+1 Servis</button>` : ''}
            </div>
            <div class="maint-progress-bar">
                <div class="maint-progress-fill ${fillClass}" style="width: ${Math.min(item.progressPercent, 100)}%;"></div>
            </div>
            <div class="maint-progress-detail">
                <span>${detailText}</span>
                <span class="maint-progress-cost">Rp ${formatRupiah(item.accumulatedCost || 0, false)} / Rp ${formatRupiah(item.dcell || 0, false)}</span>
            </div>
        </div>`;
    });

    const displayIcon = icon || ICON.MAINTENANCE;

    return `<div class="card">
        <div class="card-header">
            <span class="card-title">${displayIcon} ${title} <span class="input-info" data-help="${helpKey}">${ICON.INFO}</span></span>
        </div>
        <div class="maint-progress-list">${itemsHTML}</div>
    </div>`;
}

function renderDepreciation() {
    if (!depreciationSummary) return '';

    const d = depreciationSummary;

    return `<div class="card maint-depreciation-card">
        <div class="maint-depreciation-title">${ICON.DOCUMENT} PENYUSUTAN KENDARAAN <span class="input-info" data-help="maintenance-penyusutan">${ICON.INFO}</span></div>
        <div class="maint-progress-bar">
            <div class="maint-progress-fill" style="width: ${Math.min(d.progressPercent || 0, 100)}%;"></div>
        </div>
        <div class="maint-progress-detail mb-sm">
            <span>Progress: ${(d.progressPercent || 0).toFixed(1)}%</span>
            <span class="maint-progress-cost">Rp ${formatRupiah(d.accumulatedDepreciation || 0, false)} / Rp ${formatRupiah(d.totalDepreciationCost || 0, false)}</span>
        </div>
        <div class="maint-depreciation-row">
            <span class="maint-depreciation-label">Harga Beli</span>
            <span class="maint-depreciation-value">${formatRupiah(d.hargaBeli || 0)}</span>
        </div>
        <div class="maint-depreciation-row">
            <span class="maint-depreciation-label">Harga Jual Saat Ini</span>
            <span class="maint-depreciation-value">${formatRupiah(d.hargaJual || 0)}</span>
        </div>
        <div class="maint-depreciation-row">
            <span class="maint-depreciation-label">Nilai Saat Ini</span>
            <span class="maint-depreciation-value">${formatRupiah(d.remainingValue || 0)}</span>
        </div>
        <div class="maint-depreciation-row">
            <span class="maint-depreciation-label">Umur Penyusutan</span>
            <span class="maint-depreciation-value">${d.umurTahun || 0} tahun</span>
        </div>
        <div class="maint-depreciation-row" style="margin-top: var(--space-sm); border-top: 1px solid var(--border); padding-top: var(--space-xs);">
            <span class="maint-depreciation-label">Extra km gemuk (bekas ojol)</span>
            <span class="maint-depreciation-value">${formatRupiah(extraKmGemukCost)}</span>
        </div>
    </div>`;
}

function buildHTML() {
    return `<div class="page-container">
        <div class="page-title">${ICON.MAINTENANCE} PERAWATAN</div>
        <div id="maint-summary-container">${renderSummaryCards()}</div>
        <div id="maint-filter-container">${renderFilter()}</div>
        <div id="maint-perawatan-container">${renderProgressList('PERAWATAN', ICON.MAINTENANCE, 'maintenance-perawatan', maintenanceItems)}</div>
        <div id="maint-atribut-container">${renderProgressList(currentFilter === 'Mobil' ? 'KESP' : 'ATRIBUT', ICON.FUEL, 'maintenance-atribut', attributeItems)}</div>
        <div id="maint-pajak-container">${renderProgressList('PAJAK', ICON.TAX, 'maintenance-pajak', taxItems)}</div>
        <div id="maint-depreciation-container">${renderDepreciation()}</div>
    </div>`;
}

function refreshUI() {
    const content = document.getElementById('app-content');
    if (!content) return;
    content.innerHTML = buildHTML();
    bindEvents();
}

// =============================================================================
// 6. BIND EVENTS
// =============================================================================

function bindEvents() {
    document.querySelectorAll('.maint-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isDestroyed) return;
            currentFilter = btn.dataset.filter;
            loadCycleData();
            loadMaintenanceData();
            refreshUI();
        });
    });

    document.querySelectorAll('.maint-reset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isDestroyed) return;
            const itemName = btn.dataset.item;
            const intervalKm = parseFloat(btn.dataset.interval) || 0;
            const cost = parseFloat(btn.dataset.cost) || 0;
            handleReset(itemName, intervalKm, cost);
        });
    });

    document.querySelectorAll('[data-help]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = el.dataset.help;
            Router.navigateTo({ target: 'popup2', helpKey: key });
        });
    });
}

// =============================================================================
// 7. UPDATE HEADER & FOOTER
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
// 8. REGISTRASI DRAWER
// =============================================================================

DrawerManager.register('maintenance', () => ({
    menuItems: null,
    onItemClick: (page) => {
        Router.navigateTo({ target: page, closeDrawer: true });
    }
}));

// =============================================================================
// 9. RENDER & DESTROY
// =============================================================================

async function render(params, context = {}) {
    const content = document.getElementById('app-content');
    if (!content) return;

    isDestroyed = false;

    const direction = context.direction || 'forward';

    if (direction === 'forward') {
        loadAccumulatedData();          // hitung akumulasi untuk kedua mode
        currentFilter = determineDefaultFilter();
        loadCycleData();
        loadMaintenanceData();
    }

    content.innerHTML = buildHTML();
    bindEvents();
    updateHeader();
    updateFooter();

    window.log.info('[Maintenance ' + F_V + '] (1) Perawatan dirender');
}

function destroy() {
    isDestroyed = true;
    maintenanceItems = [];
    taxItems = [];
    attributeItems = [];
    depreciationSummary = null;
    extraKmGemukCost = 0;

    for (const key in debounceTimers) {
        if (debounceTimers[key]) {
            clearTimeout(debounceTimers[key]);
            delete debounceTimers[key];
        }
    }

    if (currentHeader) { HeaderManager.destroy(currentHeader); currentHeader = null; }
}

// =============================================================================
// 10. EKSPOR
// =============================================================================

export const PageMaintenance = {
    render,
    destroy
};

window.log.info('[Maintenance ' + F_V + '] (2) PageMaintenance dimuat (via Output)');


// ================================ End Of File ================================