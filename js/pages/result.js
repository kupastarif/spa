/**
 * =================================================================================
 * FILE         : /js/pages/result.js
 * FILE VERSION : 2.0.1-rev9
 * APP VERSION  : 2.0.1
 * DATE         : 16 Juli 2026
 * @author      : gk
 *
 * CHANGELOG  :
 *
 * =================================================================================
 */

'use strict';

// ==================== VERSI FILE ====================
const F_V = '2.0.1-rev9';

import { StateManager } from '../core/state.js';
import { Router } from '../core/router.js';
import { StorageManager } from '../core/storage.js';
import { HeaderManager } from '../components/header.js';
import { FooterManager } from '../components/footer.js';
import { ThemeManager } from '../components/theme.js';
import {
    formatRupiah, formatKm, formatMenit, formatTanggal, formatJam,
    escapeHtml
} from '../helpers/format.js';
import {
    encodeRouteData, formatCopyHasil,
    getConstant
} from '../helpers/output.js';

// =============================================================================
// 0. IKON LOKAL
// =============================================================================

const ICON = {
    MOTOR: '🏍️',
    MOBIL: '🚗',
    COPY: '📋',
    GEAR: '⚙️',
    MONEY: '💰',
    RECEIPT_TRIP: '🛣️',
    BACK: '◀',
    CAPTURE: '📸',
    REPORT: '📊'
};

// =============================================================================
// 1. STATE INTERNAL
// =============================================================================

let isDestroyed = false;
let isSubmitting = false;
let realityResult = null;
let vehicleData = {};
let driverInfo = { name: '', plate: '', phone: '' };
let role = 'Driver';
let mode = 'online';
let operationalMode = false;
let refId = '';
let hasTracking = false;
let trackingData = null;
let timestamp = Date.now();
let hasSaved = false;

let currentHeader = null;

let html2canvasLoaded = false;
let html2canvasLoading = false;
let html2canvasPromise = null;

// =============================================================================
// 2. HELPER
// =============================================================================

function normalizeInput(input) {
    const sorted = Object.keys(input).sort();
    const norm = {};
    for (const k of sorted) norm[k] = input[k];
    return norm;
}

// =============================================================================
// 3. LOAD DATA
// =============================================================================

function loadData() {
    window.log.info('[Result ' + F_V + '] (1) loadData');
    if (StateManager) {
        realityResult = StateManager.get('realityResult');
        const input = StateManager.get('input') || {};
        vehicleData = {
            E10: input.E10 || 'Mobil',
            E12: input.E12 || 'Driver',
            E20: input.E20 || 'Jabodetabek',
            E22: input.E22 || '125cc',
            E24: input.E24 || 'Pertalite',
            E26: input.E26 || 'manual',
            E28: input.E28 || 'individu',
            E36: input.E36 || 'online',
            E38: input.E38 || 'wajar',
            E46: input.E46 || 'Standar'
        };
        role = vehicleData.E12;
        mode = vehicleData.E36;
        operationalMode = (mode === 'operational') || (StateManager.get('calcMode') === 'operational');
        trackingData = StateManager.get('trackingData');
        hasTracking = !!trackingData;
    }
    if (StorageManager) driverInfo = StorageManager.getDriverInfo();
    timestamp = Date.now();
}

// =============================================================================
// 4. SAVE TO HISTORY (SSOT) – hanya forward
// =============================================================================

function saveToHistory() {
    if (!realityResult || hasSaved) return;
    const input = StateManager.get('input');
    if (!input) return;

    const normalized = normalizeInput(input);
    const now = new Date();
    const timeKey = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}`;
    const fp = JSON.stringify(normalized) + '|' + timeKey;

    if (StateManager.get('lastSavedFingerprint') === fp) {
        refId = StateManager.get('lastRefId') || StorageManager.generateRefId();
        timestamp = StateManager.get('lastTimestamp') || Date.now();
        hasSaved = true;
        return;
    }

    refId = StorageManager.generateRefId();
    timestamp = Date.now();
    const item = {
        refId, timestamp,
        input: input,
        result: realityResult,
        hasTracking,
        type: operationalMode ? 'operational' : 'standard',
        driverInfo: StorageManager?.getDriverInfo() || {}
    };
    if (hasTracking && trackingData) item.trackingData = trackingData;

    if (StorageManager.saveHistoryItem(item)) {
        hasSaved = true;
        StateManager.set('lastSavedFingerprint', fp);
        StateManager.set('lastRefId', refId);
        StateManager.set('lastTimestamp', timestamp);
        StateManager.set('lastInput', normalized);
    }
}

// =============================================================================
// 5. html2canvas & actions
// =============================================================================

function preloadHtml2Canvas() {
    if (html2canvasLoaded || html2canvasLoading) return;
    html2canvasLoading = true;
    html2canvasPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => { html2canvasLoaded = true; html2canvasLoading = false; resolve(); };
        script.onerror = () => { html2canvasLoading = false; html2canvasPromise = null; reject(new Error('html2canvas')); };
        document.head.appendChild(script);
    });
}

async function doCapture() {
    const el = document.getElementById('receipt-card');
    if (!el) return;
    if (!html2canvasLoaded) {
        ThemeManager?.showToast('Menyiapkan capture...', 'info');
        if (!html2canvasPromise) preloadHtml2Canvas();
        try { await html2canvasPromise; } catch { return; }
    }
    try {
        const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: getComputedStyle(el).backgroundColor, logging: false });
        const a = document.createElement('a');
        a.download = 'KupasTarif_' + refId + '.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
        ThemeManager?.showToast('Struk berhasil didownload', 'success');
    } catch (e) { /* ignore */ }
}

function handleCopyRute() {
    if (!hasTracking || !trackingData) { ThemeManager?.showToast('Tidak ada data rute', 'warning'); return; }
    const text = encodeRouteData(trackingData, refId, realityResult?.E697 || 0, realityResult?.E746 || 0, driverInfo);
    navigator.clipboard.writeText(text).then(() => ThemeManager?.showToast('Rute disalin', 'success'));
}

function handleCopyHasil() {
    if (!realityResult) return;
    navigator.clipboard.writeText(formatCopyHasil(realityResult, mode, role)).then(() => ThemeManager?.showToast('Hasil disalin', 'success'));
}

function handleReport() {
    if (isSubmitting || !refId) return;
    isSubmitting = true;
    Router.navigateTo({ target: 'report', refid: refId });
}

// =============================================================================
// 6. RENDER HEADER
// =============================================================================

function renderReceiptHeader() {
    const icon = vehicleData.E10 === 'Motor' ? ICON.MOTOR : ICON.MOBIL;
    const cc = vehicleData.E22 || (vehicleData.E10 === 'Motor' ? '125cc' : '1000cc');
    const area = vehicleData.E20 || 'Jabodetabek';
    const service = vehicleData.E46 || 'Standar';
    const driverText = (role === 'Driver' && driverInfo.name)
        ? `<div class="receipt-driver">${escapeHtml(driverInfo.name)} · ${escapeHtml(driverInfo.plate)} · ${escapeHtml(driverInfo.phone)}</div>`
        : '';
    return `<div class="receipt-header">
        <div class="receipt-title">NOTA PERJALANAN</div>
        <div class="receipt-date">${formatTanggal(timestamp)} ${formatJam(timestamp)}</div>
        ${driverText}
        <div class="receipt-vehicle"><span>${icon} ${cc}</span><span>·</span><span>${area}</span><span>·</span><span>${service}</span></div>
        <div class="receipt-ref">ref: ${refId}</div>
    </div>`;
}

// =============================================================================
// 7. RENDER PER MODE (TANPA ??)
// =============================================================================

function renderOfflineReceipt(r) {
    const input = StateManager.get('input') || {};
    const argo = r.E697 || 0;
    const selisih = r.E745 || 0;
    const bill = r.E746 + selisih;

    // Selisih dari engine
    const sJemputKm = r.E725 || 0;
    const sJemputMnt = r.E726 || 0;
    const sAntarKm = r.E727 || 0;
    const sAntarMnt = r.E728 || 0;

    // Biaya tambahan dari input state
    const parkir = input.E100 || 0;
    const tol = input.E102 || 0;
    const lain = input.E104 || 0;

    // Data perjalanan dari input state (validated), fallback ke result
    const pickupDist = (input.E78 !== null && input.E78 !== undefined) ? input.E78 : (r.E78 || 0);
    const pickupTime = (input.E80 !== null && input.E80 !== undefined) ? input.E80 : (r.E80 || 0);
    const dropoffDist = (input.E82 !== null && input.E82 !== undefined) ? input.E82 : (r.E82 || 0);
    const dropoffTime = (input.E84 !== null && input.E84 !== undefined) ? input.E84 : (r.E84 || 0);

    const showJemput = (sJemputKm < 0 || sJemputMnt < 0);
    const showAntar = (sAntarKm < 0 || sAntarMnt < 0);
    const showParkir = parkir > 0;
    const showTol = tol > 0;
    const showLain = lain > 0;
    const hasDetail = showJemput || showAntar || showParkir || showTol || showLain;

    let html = `<div class="receipt-section">
        <div class="receipt-row receipt-total">
            <span class="receipt-label">TOTAL PEMBAYARAN & TAGIHAN</span>
            <span class="receipt-value-large">${formatRupiah(bill)}</span>
        </div>
        <div class="receipt-row"><span class="receipt-label">Argo Pesanan</span><span class="receipt-value">${formatRupiah(argo)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Selisih Tagihan</span><span class="receipt-value ${selisih > 0 ? 'text-danger' : ''}">${formatRupiah(selisih)}</span></div>`;

    if (hasDetail) {
        html += `<div class="bill-box">`;
        if (showJemput) html += `<div class="bill-box-detail text-muted italic">selisih jemput: ${formatKm(sJemputKm)}, ${formatMenit(sJemputMnt)}</div>`;
        if (showAntar) html += `<div class="bill-box-detail text-muted italic">selisih antar: ${formatKm(sAntarKm)}, ${formatMenit(sAntarMnt)}</div>`;
        if (showParkir) html += `<div class="bill-box-detail text-muted italic">parkir: ${formatRupiah(parkir)}</div>`;
        if (showTol) html += `<div class="bill-box-detail text-muted italic">tol: ${formatRupiah(tol)}</div>`;
        if (showLain) html += `<div class="bill-box-detail text-muted italic">lainnya: ${formatRupiah(lain)}</div>`;
        html += `</div>`;
    }

    html += `</div>`;

    // PESANAN
    html += `<div class="receipt-section">
        <div class="receipt-section-title"><span>${ICON.COPY}</span> PESANAN</div>
        <div class="receipt-row"><span class="receipt-label">Jarak</span><span class="receipt-value">${formatKm(r.E707 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Waktu</span><span class="receipt-value">${formatMenit(r.E715 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Tarif</span><span class="receipt-value">${formatRupiah(r.E713 || 0)}/km, ${formatRupiah(r.E714 || 0)}/mnt</span></div>
    </div>`;

    // PERJALANAN
    html += `<div class="receipt-section">
        <div class="receipt-section-title"><span>${ICON.RECEIPT_TRIP}</span> PERJALANAN</div>
        <div class="receipt-row"><span class="receipt-label">penjemputan</span><span class="receipt-value">${formatKm(pickupDist)}, ${formatMenit(pickupTime)}</span></div>
        <div class="receipt-row"><span class="receipt-label">pengantaran</span><span class="receipt-value">${formatKm(dropoffDist)}, ${formatMenit(dropoffTime)}</span></div>
        <div class="receipt-row"><span class="receipt-label">BBM</span><span class="receipt-value">${formatRupiah(r.E911 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Kendaraan</span><span class="receipt-value">${formatRupiah(r.E963 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Driver</span><span class="receipt-value ${(r.E981 || 0) < 0 ? 'text-danger' : ''}">${formatRupiah(r.E981 || 0)}</span></div>
    </div>`;

    return html;
}

function renderOnlineReceipt(r) {
    const bill = r.E746 || 0;
    const passenger = r.E697 || 0;
    const total = passenger + bill;

    const maxJemputKm = getConstant('E266') !== undefined ? getConstant('E266') : 2;
    const maxJemputMnt = getConstant('E267') !== undefined ? getConstant('E267') : 15;
    const sJemputKm = r.E725 || 0;
    const sJemputMnt = r.E726 || 0;
    const sAntarKm = r.E727 || 0;
    const sAntarMnt = r.E728 || 0;

    const showJemput = (sJemputKm < 0 || sJemputMnt < 0);
    const showAntar = (sAntarKm < 0 || sAntarMnt < 0);
    const hasDetail = showJemput || showAntar;

    let html = `<div class="receipt-section">
        <div class="receipt-row receipt-total"><span class="receipt-label">TAGIHAN</span><span class="receipt-value-large">${formatRupiah(bill)}</span></div>`;

    if (hasDetail) {
        html += `<div class="bill-box">`;
        if (showJemput) html += `<div class="bill-box-detail text-muted italic">selisih jemput: ${formatKm(sJemputKm)}, ${formatMenit(sJemputMnt)}</div>`;
        if (showAntar) html += `<div class="bill-box-detail text-muted italic">selisih antar: ${formatKm(sAntarKm)}, ${formatMenit(sAntarMnt)}</div>`;
        html += `</div>`;
    }

    html += `</div>`;

    // PESANAN APLIKASI
    html += `<div class="receipt-section">
        <div class="receipt-section-title"><span>${ICON.COPY}</span> PESANAN APLIKASI</div>
        <div class="receipt-row"><span class="receipt-label">Max Jemput</span><span class="receipt-value">${formatKm(maxJemputKm)}, ${formatMenit(maxJemputMnt)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Max Antar</span><span class="receipt-value">${formatKm(r.E707 || 0)}, ${formatMenit(r.E715 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Tarif</span><span class="receipt-value">${formatRupiah(r.E713 || 0)}/km, ${formatRupiah(r.E714 || 0)}/mnt</span></div>
    </div>`;

    // OPERASIONAL
    html += `<div class="receipt-section">
        <div class="receipt-section-title"><span>${ICON.GEAR}</span> OPERASIONAL</div>
        <div class="receipt-row"><span class="receipt-label">BBM</span><span class="receipt-value">${formatRupiah(r.E911 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Kendaraan</span><span class="receipt-value">${formatRupiah(r.E963 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Load Google Map</span><span class="receipt-value">${formatRupiah(r.E807 || 0)}</span></div>
    </div>`;

    // PENDAPATAN
    html += `<div class="receipt-section">
        <div class="receipt-section-title"><span>${ICON.MONEY}</span> PENDAPATAN</div>
        <div class="receipt-row"><span class="receipt-label">Driver</span><span class="receipt-value ${(r.E981 || 0) < 0 ? 'text-danger' : ''}">${formatRupiah(r.E981 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Aplikasi</span><span class="receipt-value">${formatRupiah(r.E982 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Harga Penumpang</span><span class="receipt-value">${formatRupiah(passenger)}</span></div>
    </div>`;

    // TOTAL PEMBAYARAN & TAGIHAN
    html += `<div class="receipt-section">
        <div class="receipt-row receipt-total">
            <span class="receipt-label">TOTAL PEMBAYARAN & TAGIHAN</span>
            <span class="receipt-value-large">${formatRupiah(total)}</span>
        </div>
    </div>`;

    return html;
}

function renderOperationalReceipt(r) {
    const total = (r.E960 || 0) - (r.E807 || 0);
    const share = r.shareCount || 1;
    const limit = r.setLimit || 0;
    const shareRes = r.shareResult || 0;
    const limitRes = r.limitResult || 0;

    let html = `<div class="receipt-section">
        <div class="receipt-section-title"><span>${ICON.RECEIPT_TRIP}</span> PERJALANAN</div>
        <div class="receipt-row"><span class="receipt-label">Jarak</span><span class="receipt-value">${formatKm(r.E752 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Waktu</span><span class="receipt-value">${formatMenit(r.E753 || 0)}</span></div>
    </div>
    <div class="receipt-section">
        <div class="receipt-section-title"><span>${ICON.GEAR}</span> BIAYA OPERASIONAL</div>
        <div class="receipt-row"><span class="receipt-label">BBM</span><span class="receipt-value">${formatRupiah(r.E911 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Perawatan</span><span class="receipt-value">${formatRupiah(r.E935 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Penyusutan</span><span class="receipt-value">${formatRupiah(r.E825 || 0)}</span></div>
        <div class="receipt-row"><span class="receipt-label">Pajak</span><span class="receipt-value">${formatRupiah(r.E841 || 0)}</span></div>
        <div class="receipt-row receipt-total"><span class="receipt-label">TOTAL</span><span class="receipt-value-large">${formatRupiah(total)}</span></div>
    </div>`;

    html += `<div class="receipt-section"><div class="receipt-section-title"><span>${ICON.GEAR} SHARE & LIMIT</span></div>`;
    html += `<div class="receipt-row"><span class="receipt-label">Share per orang (${share} orang)</span><span class="receipt-value">${formatRupiah(shareRes)}</span></div>`;
    const limitClass = limitRes >= 0 ? '' : 'text-danger';
    html += `<div class="receipt-row"><span class="receipt-label">Sisa Limit (limit: ${formatRupiah(limit)})</span><span class="receipt-value ${limitClass}">${limitRes >= 0 ? formatRupiah(limitRes) : '-' + formatRupiah(Math.abs(limitRes))}</span></div>`;
    html += `</div>`;

    return html;
}

// =============================================================================
// 8. BUILD HTML UTAMA
// =============================================================================

function renderReceipt() {
    if (!realityResult) return '<div class="card text-center p-lg"><p>Data tidak tersedia</p></div>';
    const r = realityResult;
    let body = '';
    if (operationalMode) body = renderOperationalReceipt(r);
    else if (mode === 'online') body = renderOnlineReceipt(r);
    else body = renderOfflineReceipt(r);

    return `<div class="card receipt-card" id="receipt-card">${renderReceiptHeader()}${body}</div>`;
}

function buildHTML() {
    return `<div class="page-container">
        <div id="receipt-container">${renderReceipt()}</div>
        <div class="result-actions">
            <button class="btn btn-outline" id="copy-rute-btn" ${hasTracking ? '' : 'disabled'}>${ICON.COPY} COPY RUTE</button>
            <button class="btn btn-outline" id="copy-hasil-btn">${ICON.COPY} COPY HASIL</button>
        </div>
    </div>`;
}

// =============================================================================
// 9. BIND EVENTS, HEADER, FOOTER
// =============================================================================

function bindEvents() {
    document.getElementById('copy-rute-btn')?.addEventListener('click', handleCopyRute);
    document.getElementById('copy-hasil-btn')?.addEventListener('click', handleCopyHasil);
}

function updateHeader() {
    const hc = document.getElementById('app-header');
    if (!hc || !HeaderManager) return;
    if (currentHeader) HeaderManager.destroy(currentHeader);
    const h = HeaderManager.create('step3');
    hc.innerHTML = '';
    if (h) { hc.appendChild(h); currentHeader = h; }
    else currentHeader = null;
}

function updateFooter() {
    const fc = document.getElementById('app-footer');
    if (!fc || !FooterManager) return;
    const back = operationalMode ? 'home' : 'reality';
    const footer = FooterManager.create('layoutB', {
        frame1: { type: 'icon', content: FooterManager.createIconButton(ICON.BACK, () => Router.navigateTo({ target: back }), 'Kembali') },
        frame2: { type: 'flex', content: FooterManager.createFlexContent('CAPTURE', ICON.CAPTURE, doCapture) },
        frame3: { type: 'flex', content: FooterManager.createFlexContent('REPORT', ICON.REPORT, handleReport) }
    });
    fc.innerHTML = '';
    if (footer) fc.appendChild(footer);
}

// =============================================================================
// 10. RENDER & DESTROY
// =============================================================================

async function render(params, context = {}) {
    const content = document.getElementById('app-content');
    if (!content) return;
    isDestroyed = false;
    isSubmitting = false;
    const dir = context.direction || 'forward';

    loadData();
    if (typeof window.forceStopTracking === 'function') window.forceStopTracking();
    if (dir === 'forward') saveToHistory();
    preloadHtml2Canvas();

    content.innerHTML = buildHTML();
    bindEvents();
    updateHeader();
    updateFooter();

    if (window.Cache) window.Cache.invalidate('tracking');
}

function destroy() {
    isDestroyed = true;
    isSubmitting = false;
    html2canvasPromise = null;
    if (currentHeader) { HeaderManager.destroy(currentHeader); currentHeader = null; }
}

export const PageResult = { render, destroy };

window.log.info('[Result ' + F_V + '] dimuat (no nullish coalescing)');


// ================================ End Of File ================================