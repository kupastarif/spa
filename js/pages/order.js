/**
 * =================================================================================
 * FILE         : /js/pages/order.js
 * FILE VERSION : 2.0.1-rev4
 * APP VERSION  : 2.0.1
 * DATE         : 18 Juli 2026
 *
 * @author      : gk
 *
 * CHANGELOG  :
 *
 * =================================================================================
 */

'use strict';

// ==================== VERSI FILE ====================
const F_V = '2.0.1-rev4';

import { StateManager } from '../core/state.js';
import { Router } from '../core/router.js';
import { PreferencesManager } from '../core/preferences.js';
import { StorageManager } from '../core/storage.js';
import { HeaderManager } from '../components/header.js';
import { FooterManager } from '../components/footer.js';
import { ThemeManager } from '../components/theme.js';
import { PopupManager } from '../components/popup.js';
import {
    formatRupiah, formatKm, formatMenit, formatPersen,
    parseNumber, escapeHtml
} from '../helpers/format.js';
import {
    getTariffBadge, getAppBadge, getDriverOrderBadge,
    formatCopyEstimate, prepareCopyTemplateData, parseCopyTemplate,
    getServiceOptions, getMaxPickupDistance, getMaxPickupTime,
    validateCell, getValidationRange
} from '../helpers/output.js';
import { LocationPicker } from '../maps/picker.js';

// =============================================================================
// 0. IKON LOKAL
// =============================================================================

const ICON = {
    MOTOR: '🏍️',
    MOBIL: '🚗',
    DRIVER: '👤',
    PENUMPANG: '🧑',
    INFO: 'ⓘ',
    OFFLINE: '📴',
    APP: '📱',
    RESET: '🔁',
    TARGET: '🎯',
    COPY: '📋',
    SPINNER: '⏳',
    UP_ARROW: '🔺',
    DOWN_ARROW: '🔻',
    BACK: '◀',
    SELESAI: '✅',
    HOME: '🏠',
    LOCATION: '📍'
};

// =============================================================================
// 1. STATE INTERNAL & PREFERENSI
// =============================================================================

let isDestroyed = false;
let isSubmitting = false;
let mode = 'online';
let role = 'Driver';
let vehicleMode = 'Motor';
let estimateResult = null;
let pickupEstimate = null;
let isLoading = false;
let isValid = false;
let alwaysGPS = false;
let offlineOrderEnabled = false;
let hideSafetyReminder = false;
let isCheckOffline = false;

let currentHeader = null;

let formData = {
    E56: null,
    E54: null,
    E58: null,
    E68: null,
    E70: null,
    E46: 'Standar',
    E38: 'wajar',
    E40: 0.4                       // divalidasi ulang via Engine di loadInitialData
};

let estimateTimer = null;

// html2canvas state
let html2canvasLoaded = false;
let html2canvasLoading = false;
let html2canvasPromise = null;

LocationPicker.onComplete = (result) => {
    if (isDestroyed) return;
    formData.E68 = result.distanceKm;
    formData.E70 = result.durationMin;
    StateManager.updateInput('E68', result.distanceKm);
    StateManager.updateInput('E70', result.durationMin);
    const e68 = document.getElementById('input-E68');
    const e70 = document.getElementById('input-E70');
    if (e68) e68.value = result.distanceKm.toFixed(1);
    if (e70) e70.value = Math.round(result.durationMin);
    validateForm();
    updateSubmitButton();
    if (estimateTimer) clearTimeout(estimateTimer);
    estimateTimer = setTimeout(() => callPickupEstimate(), 300);
};

// =============================================================================
// 2. LOAD DATA AWAL
// =============================================================================

function loadInitialData(direction) {
    const prefs = StateManager.get('preferences') || PreferencesManager.load();
    offlineOrderEnabled = prefs.offlineOrder === true;
    hideSafetyReminder = prefs.hideSafetyReminder === true;
    alwaysGPS = prefs.alwaysGPS === true;

    isCheckOffline = StateManager.get('isCheckOffline') || false;

    const input = StateManager.get('input') || {};
    mode = input.E36 || 'online';
    // izinkan offline saat isCheckOffline meskipun offlineOrderEnabled false
    if (mode === 'offline' && !isCheckOffline && !offlineOrderEnabled) {
        mode = 'online';
    }
    role = input.E12 || 'Driver';
    vehicleMode = input.E10 || 'Motor';

    formData.E56 = input.E56 !== null && input.E56 !== undefined ? input.E56 : null;
    formData.E54 = input.E54 !== null && input.E54 !== undefined ? input.E54 : null;
    formData.E58 = input.E58 !== null && input.E58 !== undefined ? input.E58 : null;
    formData.E68 = input.E68 !== null && input.E68 !== undefined ? input.E68 : null;
    formData.E70 = input.E70 !== null && input.E70 !== undefined ? input.E70 : null;
    formData.E46 = input.E46 || 'Standar';
    formData.E38 = input.E38 || 'wajar';
    formData.E40 = validateCell('E40', input.E40, { E10: vehicleMode });
    StateManager.updateInput('E40', formData.E40);

    const isBack = direction === 'back';

    if (!isBack) {
        estimateResult = null;
        pickupEstimate = null;
        StateManager && StateManager.set('estimateResult', null);
        if (window.Cache) window.Cache.invalidate('order');

        if (mode === 'online') {
            formData.E56 = null;
            formData.E54 = null;
            formData.E58 = null;
            formData.E38 = 'wajar';
            StateManager.updateInput('E38', 'wajar');
            StateManager.set('estimateState', null);
        } else {
            const storedEstimateState = StateManager && StateManager.get('estimateState');
            if (storedEstimateState) {
                formData.E38 = 'app';
                formData.E68 = storedEstimateState.E707 || null;
                formData.E70 = storedEstimateState.E715 || null;
                StateManager.updateInput('E38', 'app');
                StateManager.updateInput('E68', formData.E68);
                StateManager.updateInput('E70', formData.E70);
            } else {
                formData.E38 = 'wajar';
                formData.E68 = null;
                formData.E70 = null;
                StateManager.updateInput('E38', 'wajar');
                StateManager.updateInput('E68', null);
                StateManager.updateInput('E70', null);
            }
        }
    } else {
        estimateResult = StateManager && StateManager.get('estimateResult') || null;
        pickupEstimate = null;
    }

    validateForm();
    window.log.info('[Order ' + F_V + '] (1) Data awal dimuat | mode=' + mode +
        ' | offlineOrder=' + offlineOrderEnabled + ' | hideSafety=' + hideSafetyReminder +
        ' | isCheckOffline=' + isCheckOffline);
}

// =============================================================================
// 3. ENGINE CALLS (melalui Cache)
// =============================================================================

function buildEstimateInput() {
    return StateManager.get('input');
}

async function callPickupEstimate() {
    if (!window.Cache) return;
    try {
        const valid = buildEstimateInput();
        let uiStateE71;

        if (mode === 'offline' && formData.E38 === 'app') {
            const estState = StateManager && StateManager.get('estimateState');
            if (estState && typeof estState.E713 === 'number') {
                uiStateE71 = estState.E713;
            }
        }

        pickupEstimate = window.Cache.estimatePickup(valid, uiStateE71);

        if (isValid) {
            callDropoffEstimate();
        } else {
            estimateResult = null;
            updatePreviewContent();
        }
    } catch (e) {
        window.log.error('[Order ' + F_V + '] (2) Pickup estimate error:', e);
        pickupEstimate = null;
    }
}

async function callDropoffEstimate() {
    if (!window.Cache || !pickupEstimate) return;
    isLoading = true;
    updatePreviewContent();
    try {
        const valid = buildEstimateInput();
        estimateResult = window.Cache.estimateDropoff(valid, pickupEstimate);

        if (estimateResult && mode === 'online') {
            StateManager.set('estimateState', {
                E713: estimateResult.E713,
                E707: estimateResult.E707,
                E715: estimateResult.E715,
                E46: formData.E46
            });
        }
    } catch (e) {
        window.log.error('[Order ' + F_V + '] (3) Dropoff estimate error:', e);
        estimateResult = null;
    }
    isLoading = false;
    updatePreviewContent();
}

// =============================================================================
// 4. VALIDASI FORM
// =============================================================================

function validateForm() {
    if (mode === 'online') {
        if (role === 'Driver') {
            isValid = formData.E56 !== null && formData.E56 > 0;
        } else {
            isValid = formData.E54 !== null && formData.E54 > 0;
        }
    } else {
        isValid = formData.E68 !== null && formData.E68 > 0 &&
                  formData.E70 !== null && formData.E70 > 0;
    }
    return isValid;
}

// =============================================================================
// 5. RENDER FORM
// =============================================================================

function renderFormCard() {
    const modeIcon = vehicleMode === 'Motor' ? ICON.MOTOR : ICON.MOBIL;
    const roleIcon = role === 'Driver' ? ICON.DRIVER : ICON.PENUMPANG;
    const cc = StateManager.get('input') && StateManager.get('input').E22 || '125cc';

    const headerRoleIcon = isCheckOffline ? ICON.OFFLINE : roleIcon;
    const headerRoleLabel = isCheckOffline ? 'CEK TARIF' : role.toUpperCase();

    let h = `<div class="card order-form" id="card-form">
        <div class="order-form-header">
            <span>${modeIcon} ${cc}</span>
            <span>${headerRoleIcon} ${headerRoleLabel}</span>
        </div>`;

    if (mode === 'online') {
        if (role === 'Driver') {
            h += `<div class="input-wrapper"><span class="input-label">Omset Driver <span class="input-info" data-help="order-omset">${ICON.INFO}</span></span><div class="input-field-container"><input type="number" class="input-field" id="input-E56" value="${formData.E56 !== null ? formData.E56 : ''}" placeholder="tanpa insentif" data-cell="E56" inputmode="numeric"><span class="input-unit">Rp</span></div></div>`;
        } else {
            h += `<div class="input-wrapper"><span class="input-label">Harga Bayar <span class="input-info" data-help="order-harga">${ICON.INFO}</span></span><div class="input-field-container"><input type="number" class="input-field" id="input-E54" value="${formData.E54 !== null ? formData.E54 : ''}" placeholder="tanpa diskon" data-cell="E54" inputmode="numeric"><span class="input-unit">Rp</span></div></div>`;
        }
        h += `<div class="input-wrapper"><span class="input-label">Jarak Antar <span class="input-info" data-help="order-jarak">${ICON.INFO}</span></span><div class="input-field-container"><input type="number" class="input-field" id="input-E58" value="${formData.E58 !== null ? formData.E58 : ''}" placeholder="kosong jika tidak tau" data-cell="E58" inputmode="decimal" step="0.1"><span class="input-unit">km</span></div></div>`;
    } else {
        const e68Val = formData.E68 !== null ? formData.E68.toFixed(1) : '';
        const e70Val = formData.E70 !== null ? Math.round(formData.E70) : '';
        h += `<div class="input-wrapper"><span class="input-label">Estimasi Jarak <span class="input-info" data-help="order-estimasi-jarak">${ICON.INFO}</span></span><div class="input-field-container"><input type="number" class="input-field" id="input-E68" value="${e68Val}" placeholder="jarak antar" data-cell="E68" inputmode="decimal" step="0.1"><span class="input-unit">km</span></div></div>`;
        h += `<div class="input-wrapper"><span class="input-label">Estimasi Waktu <span class="input-info" data-help="order-estimasi-waktu">${ICON.INFO}</span></span><div class="input-field-container"><input type="number" class="input-field" id="input-E70" value="${e70Val}" placeholder="waktu antar" data-cell="E70" inputmode="numeric"><span class="input-unit">mnt</span></div></div>`;
    }

    const svc = getServiceOptions(vehicleMode, cc);
    let opts = '';
    svc.forEach(o => opts += `<option value="${o}" ${formData.E46 === o ? 'selected' : ''}>${o}</option>`);
    h += `<div class="input-wrapper"><span class="input-label">Layanan <span class="input-info" data-help="order-layanan">${ICON.INFO}</span></span><div class="input-field-container"><select class="input-select" id="input-E46" data-cell="E46">${opts}</select></div></div>`;

    let switchButtonHtml = '';
    if (!isCheckOffline) {
        const switchLabel = mode === 'online'
            ? (offlineOrderEnabled ? ICON.OFFLINE + ' OFFLINE' : ICON.OFFLINE + ' CEK TARIF')
            : ICON.APP + ' ONLINE';
        switchButtonHtml = `<button class="btn btn-outline btn-sm" id="switch-mode-btn">${switchLabel}</button>`;
    }

    h += `<div class="flex items-center mt-sm">
        ${switchButtonHtml}
        <div style="flex: 1;"></div>
        <div class="flex gap-sm">
            ${mode === 'offline' ?
                `<button class="btn btn-outline btn-sm" id="open-locpicker-btn">${ICON.LOCATION} Cari Lokasi</button>`
            : ''}
            <button class="btn btn-outline btn-sm" id="reset-form-btn">${ICON.RESET} RESET</button>
        </div>
    </div>`;

    h += `</div>`;
    return h;
}

function renderTariffTypeCard() {
    const opts = ['wajar', 'minimal', 'abnormal', 'app'];
    const labels = { wajar: 'Wajar', minimal: 'Minimal', abnormal: 'Abnormal', app: 'App' };
    const hasEstimate = StateManager && StateManager.get('estimateState') !== null;
    const appDisabled = !hasEstimate;

    let h = `<div class="card" id="tariff-card">`;
    h += '<div class="tariff-type-selector">';
    opts.forEach(opt => {
        const isActive = (formData.E38 === opt);
        let btnClass = 'btn btn-sm ';
        if (opt === 'app' && appDisabled) {
            btnClass += 'btn-muted';
        } else if (isActive) {
            btnClass += 'btn-primary';
        } else {
            btnClass += 'btn-outline';
        }
        const disabledAttr = (opt === 'app' && appDisabled) ? 'disabled' : '';
        h += `<button class="${btnClass} tariff-type-btn" data-type="${opt}" ${disabledAttr}>${labels[opt]}</button>`;
    });
    h += '</div>';

    const range = getValidationRange('E40', { E10: vehicleMode });
    const showSlider = formData.E38 === 'wajar';
    h += `<div id="e40-slider-container" style="margin-top:12px; ${showSlider ? '' : 'display:none;'}">
        <div class="input-wrapper">
            <span class="input-label">Kenaikan Tarif Wajar <span class="input-info" data-help="order-kenaikan">${ICON.INFO}</span></span>
            <div class="input-field-container" style="padding:0;">
                <input type="range" id="input-E40" min="${range.min}" max="${range.max}" step="0.1" value="${formData.E40}" style="width:100%;">
                <div class="text-muted text-xs text-center" id="e40-value">${formData.E40}x</div>
            </div>
        </div>
    </div>`;

    h += `</div>`;
    return h;
}

function renderPreviewCard() {
    return `<div class="card" id="preview-card">
        <div class="card-header">
            <span class="card-title">${ICON.TARGET} ESTIMASI <span class="input-info input-info-danger" data-help="order-estimasi">${ICON.INFO}</span></span>
            <button class="btn btn-outline btn-sm" id="copy-preview-btn" disabled>${ICON.COPY} COPY</button>
        </div>
        <div id="preview-body"></div>
    </div>`;
}

// =============================================================================
// 6. UPDATE PREVIEW CONTENT
// =============================================================================

function updatePreviewContent() {
    const body = document.getElementById('preview-body');
    const copyBtn = document.getElementById('copy-preview-btn');
    if (!body) return;

    if (isLoading) {
        body.innerHTML = `<div class="preview-placeholder"><div class="spinner"></div><p class="placeholder-text">Menghitung...</p></div>`;
        if (copyBtn) copyBtn.disabled = true;
        return;
    }
    if (!estimateResult) {
        body.innerHTML = `<div class="preview-placeholder"><div class="placeholder-icon">${ICON.SPINNER}</div><p class="placeholder-text">Menunggu input...</p></div>`;
        if (copyBtn) copyBtn.disabled = true;
        return;
    }

    if (copyBtn) copyBtn.disabled = false;
    const r = estimateResult;

    const maxJemputKm = getMaxPickupDistance();
    const maxJemputMnt = getMaxPickupTime();

    if (mode === 'online') {
        const driverBadge = getDriverOrderBadge(r);
        const driverBadgeHtml = driverBadge
            ? `<span class="${driverBadge.class} ${driverBadge.blink}">${driverBadge.icon}</span>`
            : '';

        const appBadge = getAppBadge(r);
        const appBadgeHtml = appBadge
            ? `<span class="badge ${appBadge.class} ${appBadge.blink}" style="font-size: var(--text-base); font-weight: var(--font-bold);">${appBadge.text}</span>`
            : '';

        let card1Label, card1Value, card1Unit;
        if (role === 'Driver') {
            card1Label = 'Pembayaran';
            card1Value = formatRupiah(r.E697 || 0).replace('Rp ', '');
            card1Unit = '';
        } else {
            card1Label = 'Omset Driver';
            card1Value = formatRupiah(r.E700 || 0).replace('Rp ', '');
            card1Unit = '/order';
        }

        const driverValue = formatRupiah(r.E969 || 0).replace('Rp ', '');
        const appValue = formatRupiah(r.E970 || 0).replace('Rp ', '');

        const biayaAplikasi = r.E692 || 0;
        const isBiayaTidakWajar = biayaAplikasi > 2000;
        const biayaLabel = isBiayaTidakWajar ? 'Biaya Aplikasi Serakah > Rp 2.000' : 'Biaya Aplikasi Wajar';
        const biayaClass = isBiayaTidakWajar ? 'text-danger font-bold' : '';

        const persentaseAplikasi = r.E971 != null ? formatPersen(r.E971) : '-';
        const jaminanPendapatan = r.E692 != null ? formatRupiah(r.E692) : '-';
        const komisiPerjalanan = r.E699 != null ? formatRupiah(r.E699) : '-';
        const umrPerMenit = r.E1001 != null ? formatRupiah(r.E1001) : '-';
        const pendapatanAppPerMenit = r.E1030 != null ? formatRupiah(r.E1030) : '-';
        const pendapatanDriverPerMenit = r.E1029 != null ? formatRupiah(r.E1029) : '-';

        let angkotIcon = '', angkotText = '-';
        if (r.E1010 != null) {
            const val = r.E1010 * 100;
            angkotIcon = val >= 0 ? ICON.UP_ARROW : ICON.DOWN_ARROW;
            angkotText = formatPersen(Math.abs(val));
        }
        let tjIcon = '', tjText = '-';
        if (r.E1015 != null) {
            const val = r.E1015 * 100;
            tjIcon = val >= 0 ? ICON.UP_ARROW : ICON.DOWN_ARROW;
            tjText = formatPersen(Math.abs(val));
        }

        const biayaBBMPerMenit = r.E1021 != null ? formatRupiah(r.E1021) : '-';
        const biayaPerawatanPerMenit = r.E1022 != null ? formatRupiah(r.E1022) : '-';

        const subCardBawah = `
            <div class="preview-estimasi">
                <div class="flex justify-between"><span>Persentase Aplikasi</span><span>${persentaseAplikasi} (total)</span></div>
                <div class="flex justify-between"><span class="text-muted italic">Jaminan Pendapatan Minimum</span><span class="text-muted italic">${jaminanPendapatan}</span></div>
                <div class="flex justify-between"><span class="text-muted italic">Komisi Perjalanan</span><span class="text-muted italic">${komisiPerjalanan}</span></div>
                <div class="divider" style="margin: 4px 0;"></div>
                <div class="flex justify-between"><span>UMR per menit</span><span>${umrPerMenit}</span></div>
                <div class="flex justify-between"><span>Pendapatan Aplikasi per menit</span><span>${pendapatanAppPerMenit}</span></div>
                <div class="flex justify-between"><span>Pendapatan Driver per menit</span><span>${pendapatanDriverPerMenit}</span></div>
                <div class="flex justify-between"><span>Perbandingan Tarif Angkot</span><span>${angkotIcon} ${angkotText}</span></div>
                <div class="flex justify-between"><span>Perbandingan Tarif TransJakarta</span><span>${tjIcon} ${tjText}</span></div>
                <div class="divider" style="margin: 4px 0;"></div>
                <div class="flex justify-between"><span>Biaya BBM per menit</span><span>${biayaBBMPerMenit}</span></div>
                <div class="flex justify-between"><span>Biaya Perawatan per menit</span><span>${biayaPerawatanPerMenit}</span></div>
            </div>`;

        body.innerHTML = `
            <div class="preview-estimasi">
                <div>ORDER APLIKASI</div>
                <div>Max Jemput: ${formatKm(maxJemputKm, false)} km, ${formatMenit(maxJemputMnt, false)} mnt</div>
                <div>Max Antar: ${formatKm(r.E707 || 0, false)} km, ${formatMenit(r.E715 || 0, false)} mnt</div>
                <div><strong>Tarif: ${formatRupiah(r.E713 || 0, false)}/km, ${formatRupiah(r.E714 || 0, false)}/mnt</strong></div>
            </div>
            <div class="preview-grid">
                <div class="preview-item">
                    <div class="preview-label">${card1Label}</div>
                    <div class="preview-value"><span class="preview-unit">Rp</span> <strong>${card1Value}</strong>${card1Unit ? ` <span class="preview-unit">${card1Unit}</span>` : ''}</div>
                </div>
                <div class="preview-item">
                    <div class="preview-label">$ DRIVER ${driverBadgeHtml}</div>
                    <div class="preview-value"><span class="preview-unit">Rp</span> <strong>${driverValue}</strong> <span class="preview-unit">/order</span></div>
                </div>
                <div class="preview-item">
                    <div class="preview-label">$ APLIKASI</div>
                    <div class="preview-value"><span class="preview-unit">Rp</span> <strong>${appValue}</strong> <span class="preview-unit">/driver</span></div>
                </div>
                <div class="preview-item">
                    <div class="preview-label">% APLIKASI</div>
                    <div class="preview-value">${appBadgeHtml}</div>
                </div>
            </div>
            ${subCardBawah}`;
    } else {
        const ongkosJemput = r.E684 || 0;
        const tarifKm = r.E679 || 0;
        const tarifMnt = r.E680 || 0;
        const tarifDiterapkan = (r.E682 > r.E683) ? 'jarak' : 'waktu';

        body.innerHTML = `
            <div class="preview-estimasi">
                <div>Order</div>
                <div>Max Jemput: ${formatKm(maxJemputKm, false)} km, ${formatMenit(maxJemputMnt, false)} mnt</div>
                <div>Max Antar: ${formatKm(r.E707 || 0, false)} km, ${formatMenit(r.E715 || 0, false)} mnt</div>
                <div>Ongkos Jemput: ${formatRupiah(ongkosJemput)}</div>
                <div>Tarif: ${formatRupiah(tarifKm, false)}/km, ${formatRupiah(tarifMnt, false)}/mnt</div>
                <div><strong>Tarif diterapkan: ${tarifDiterapkan}</strong></div>
            </div>
            <div class="preview-grid">
                <div class="preview-item">
                    <div class="preview-label">$ PENUMPANG</div>
                    <div class="preview-value"><strong>${formatRupiah(r.E697 || 0)}</strong></div>
                </div>
                <div class="preview-item">
                    <div class="preview-label">$ DRIVER</div>
                    <div class="preview-value"><strong>${formatRupiah(r.E969 || 0)}</strong></div>
                </div>
            </div>`;
    }
}

// =============================================================================
// 7. POPUP KESELAMATAN (INDEX 17)
// =============================================================================

function createSafetyPopupContent() {
    const container = document.createElement('div');
    container.innerHTML = `
        <div class="popup-safety-content">
            <h3 style="margin-bottom: 12px; font-size: var(--text-base);">Tips aman perjalanan ala aplikasi</h3>
            <ol style="padding-left: 1.5em; margin-bottom: 16px; line-height: 1.6;">
                <li>Simpan identitas dan kontak darurat di tempat aman tapi mudah ditemukan, seperti profile aplikasi.</li>
                <li>Beli asuransi, seperti yg ditawarkan oleh aplikasi.</li>
                <li>Simpan kontak darurat seperti polisi dan lainnya, seperti tombol darurat pada aplikasi.</li>
                <li>Share live lokasi (WA) anda kepada kerabat terpercaya, seperti aplikasi yg selalu memantau pergerakan kita.</li>
            </ol>
            <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 16px;">
                Ini adalah cara yg sama dan dilakukan oleh aplikasi untuk melindungi driver/penumpang.<br>
                Aplikasi apapun, tidak mempunyai wewenang untuk menindak pelaku kriminal.
            </p>
            <div style="text-align: center;">
                <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; min-height: 44px; font-size: var(--text-xs);">
                    <input type="checkbox" id="safety-checkbox" style="width: 18px; height: 18px;">
                    Jangan tampilkan lagi
                </label>
            </div>
        </div>`;

    const btnContainer = document.createElement('div');
    btnContainer.className = 'popup-footer';
    btnContainer.style.cssText = 'display:flex; gap:8px; padding:12px; border-top:1px solid var(--border);';

    const btnOk = document.createElement('button');
    btnOk.className = 'btn btn-primary';
    btnOk.style.flex = '1';
    btnOk.textContent = 'MENGERTI';
    btnOk.addEventListener('click', () => {
        const checked = document.getElementById('safety-checkbox')?.checked || false;
        if (checked) {
            const prefs = StateManager.get('preferences') || {};
            prefs.hideSafetyReminder = true;
            PreferencesManager.save(prefs);
            hideSafetyReminder = true;
        }
        Router.navigateTo({ popup: 0 });
    });

    btnContainer.appendChild(btnOk);
    container.appendChild(btnContainer);

    container._popupOptions = {
        title: 'Pengingat Keselamatan',
        showActions: false,
        showCloseButton: true,
        closeOnOverlay: true
    };

    return container;
}

PopupManager.register(17, () => createSafetyPopupContent());

// =============================================================================
// 8. POPUP BON (INDEX 23) – hanya untuk Cek Tarif Offline
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

async function captureBonPopup() {
    const el = document.getElementById('bon-receipt-card');
    if (!el) throw new Error('Elemen tidak ditemukan');
    if (!html2canvasLoaded) {
        if (!html2canvasPromise) preloadHtml2Canvas();
        await html2canvasPromise;
    }
    const canvas = await window.html2canvas(el, { 
        scale: 2, 
        backgroundColor: getComputedStyle(el).backgroundColor, 
        logging: false 
    });
    const now = new Date();
    const dd = String(now.getDate()).padStart(2,'0');
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const yy = String(now.getFullYear()).slice(-2);
    const hh = String(now.getHours()).padStart(2,'0');
    const min = String(now.getMinutes()).padStart(2,'0');
    const filename = `KT_${dd}${mm}${yy}${hh}${min}_nota-pesanan.png`;
    const a = document.createElement('a');
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    a.click();
}

function renderBonReceipt() {
    if (!estimateResult) return '<p class="text-muted text-center p-lg">Estimasi belum tersedia</p>';
    const r = estimateResult;
    const maxJemputKm = getMaxPickupDistance();
    const maxJemputMnt = getMaxPickupTime();
    const vehicleMode2 = (StateManager.get('input') && StateManager.get('input').E10) || 'Motor';
    const modeIcon = vehicleMode2 === 'Motor' ? ICON.MOTOR : ICON.MOBIL;
    const cc = (StateManager.get('input') && StateManager.get('input').E22) || (vehicleMode2 === 'Motor' ? '125cc' : '1000cc');
    const area = (StateManager.get('input') && StateManager.get('input').E20) || 'Jabodetabek';
    const service = formData.E46 || 'Standar';
    const driverInfo = StorageManager ? StorageManager.getDriverInfo() : {};
    const driverText = (role === 'Driver' && driverInfo.name)
        ? `<div class="receipt-driver">${escapeHtml(driverInfo.name)} · ${escapeHtml(driverInfo.plate)} · ${escapeHtml(driverInfo.phone)}</div>`
        : '';

    return `<div class="receipt-card" id="bon-receipt-card">
        <div class="receipt-header">
            <div class="receipt-title">NOTA PESANAN</div>
            <div class="receipt-date">Estimasi</div>
            ${driverText}
            <div class="receipt-vehicle"><span>${modeIcon} ${cc}</span><span>·</span><span>${area}</span><span>·</span><span>${service}</span></div>
        </div>
        <div class="receipt-section">
            <div class="receipt-row receipt-total">
                <span class="receipt-label">TOTAL PEMBAYARAN</span>
                <span class="receipt-value-large">${formatRupiah(r.E697 || 0)}</span>
            </div>
        </div>
        <div class="receipt-section">
            <div class="receipt-section-title"><span>📋</span> PESANAN</div>
            <div class="receipt-row"><span class="receipt-label">Jarak</span><span class="receipt-value">${formatKm(r.E707 || 0)}</span></div>
            <div class="receipt-row"><span class="receipt-label">Waktu</span><span class="receipt-value">${formatMenit(r.E715 || 0)}</span></div>
            <div class="receipt-row"><span class="receipt-label">Tarif</span><span class="receipt-value">${formatRupiah(r.E713 || 0)}/km, ${formatRupiah(r.E714 || 0)}/mnt</span></div>
        </div>
        <div class="receipt-section">
            <div class="receipt-section-title"><span>🛣️</span> PERJALANAN</div>
            <div class="receipt-row"><span class="receipt-label">penjemputan</span><span class="receipt-value">${formatKm(maxJemputKm)}, ${formatMenit(maxJemputMnt)}</span></div>
            <div class="receipt-row"><span class="receipt-label">pengantaran</span><span class="receipt-value">${formatKm(r.E707 || 0)}, ${formatMenit(r.E715 || 0)}</span></div>
            <div class="receipt-row"><span class="receipt-label">BBM</span><span class="receipt-value">${formatRupiah(r.E903 || 0)}</span></div>
            <div class="receipt-row"><span class="receipt-label">Kendaraan</span><span class="receipt-value">${formatRupiah(r.E949 || 0)}</span></div>
            <div class="receipt-row"><span class="receipt-label">Driver</span><span class="receipt-value ${(r.E969 || 0) < 0 ? 'text-danger' : ''}">${formatRupiah(r.E969 || 0)}</span></div>
        </div>
    </div>`;
}

function getBonEstimateText() {
    if (!estimateResult) return '';
    const r = estimateResult;
    const maxJemputKm = getMaxPickupDistance();
    const maxJemputMnt = getMaxPickupTime();
    return `NOTA PESANAN\n\n` +
        `TOTAL PEMBAYARAN: ${formatRupiah(r.E697 || 0)}\n\n` +
        `PESANAN\n  Jarak: ${formatKm(r.E707 || 0)}\n  Waktu: ${formatMenit(r.E715 || 0)}\n  Tarif: ${formatRupiah(r.E713 || 0)}/km, ${formatRupiah(r.E714 || 0)}/mnt\n\n` +
        `PERJALANAN\n  penjemputan: ${formatKm(maxJemputKm)}, ${formatMenit(maxJemputMnt)}\n  pengantaran: ${formatKm(r.E707 || 0)}, ${formatMenit(r.E715 || 0)}\n  BBM: ${formatRupiah(r.E903 || 0)}\n  Kendaraan: ${formatRupiah(r.E949 || 0)}\n  Driver: ${formatRupiah(r.E969 || 0)}`;
}

function createBonPopupContent() {
    const container = document.createElement('div');
    container.innerHTML = renderBonReceipt() + `
        <div class="result-actions" style="margin-top: var(--space-md); display: flex; gap: 8px;">
            <button class="btn btn-outline" id="bon-copy-btn">📋 COPY HASIL</button>
            <button class="btn btn-outline" id="bon-capture-btn">📸 CAPTURE</button>
        </div>`;

    container.querySelector('#bon-copy-btn')?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(getBonEstimateText());
            ThemeManager?.showToast('Hasil disalin', 'success');
        } catch (e) {
            ThemeManager?.showToast('Gagal menyalin', 'error');
        }
        Router.navigateTo({ popup: 0 }); // tutup popup
    });

    container.querySelector('#bon-capture-btn')?.addEventListener('click', async () => {
        try {
            await captureBonPopup();
            ThemeManager?.showToast('Nota berhasil didownload', 'success');
        } catch (e) {
            ThemeManager?.showToast('Gagal capture', 'error');
        }
        Router.navigateTo({ popup: 0 });
    });

    container._popupOptions = {
        title: 'Nota Pesanan',
        showActions: false,
        showCloseButton: true,
        closeOnOverlay: true
    };
    return container;
}

PopupManager.register(23, createBonPopupContent);

// =============================================================================
// 9. EVENT HANDLERS
// =============================================================================

function handleInputChange(e) {
    const cell = e.target.dataset.cell;
    const v = e.target.value.trim();

    if (v === '') {
        formData[cell] = null;
        StateManager.updateInput(cell, null);
    } else {
        const num = parseNumber(v);
        if (!isNaN(num)) {
            const validated = validateCell(cell, num);
            formData[cell] = validated;
            StateManager.updateInput(cell, validated);
        } else {
            e.target.value = formData[cell] !== null ? formData[cell] : '';
        }
    }

    validateForm();
    if (!isValid) {
        pickupEstimate = null;
        estimateResult = null;
        if (estimateTimer) { clearTimeout(estimateTimer); estimateTimer = null; }
        updatePreviewContent();
        updateSubmitButton();
        return;
    }

    if (estimateTimer) clearTimeout(estimateTimer);
    estimateTimer = setTimeout(() => pickupEstimate ? callDropoffEstimate() : callPickupEstimate(), 300);
    updateSubmitButton();
}

function handleSelectChange(e) {
    const cell = e.target.dataset.cell;
    formData[cell] = e.target.value;
    StateManager.updateInput(cell, e.target.value);
    validateForm();
    updateSubmitButton();
    if (cell === 'E46') {
        if (window.Cache) window.Cache.invalidate('order');
    }
    if (estimateTimer) clearTimeout(estimateTimer);
    estimateTimer = setTimeout(() => { pickupEstimate = null; callPickupEstimate(); }, 300);
}

function handleTariffTypeClick(e) {
    const type = e.currentTarget.dataset.type;
    if (!type) return;
    if (e.currentTarget.disabled) return;

    formData.E38 = type;
    StateManager.updateInput('E38', type);

    const sliderContainer = document.getElementById('e40-slider-container');
    if (sliderContainer) {
        sliderContainer.style.display = type === 'wajar' ? '' : 'none';
    }

    document.querySelectorAll('.tariff-type-btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
    });
    e.currentTarget.classList.remove('btn-outline');
    e.currentTarget.classList.add('btn-primary');

    validateForm();
    updateSubmitButton();
    if (estimateTimer) clearTimeout(estimateTimer);
    estimateTimer = setTimeout(() => { pickupEstimate = null; callPickupEstimate(); }, 300);
}

function handleE40Change(e) {
    const val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    formData.E40 = val;
    StateManager.updateInput('E40', val);
    document.getElementById('e40-value').textContent = val + 'x';

    if (estimateTimer) clearTimeout(estimateTimer);
    estimateTimer = setTimeout(() => { pickupEstimate = null; callPickupEstimate(); }, 300);
}

async function handleSwitchMode() {
    if (isSubmitting) return;
    const newMode = mode === 'online' ? 'offline' : 'online';
    performSwitch(newMode);
}

function performSwitch(newMode) {
    window.log.info('[Order ' + F_V + '] (4) performSwitch: ' + mode + ' -> ' + newMode);

    if (mode === 'online' && newMode === 'offline') {
        if (estimateResult) {
            StateManager.set('estimateState', {
                E713: estimateResult.E713,
                E707: estimateResult.E707,
                E715: estimateResult.E715,
                E46: formData.E46
            });
        } else {
            StateManager.set('estimateState', null);
        }

        formData.E56 = null;
        formData.E54 = null;
        formData.E58 = null;
        StateManager.batchUpdateInput({ E56: null, E54: null, E58: null });

        mode = 'offline';
        StateManager.updateInput('E36', 'offline');

        formData.E40 = validateCell('E40', formData.E40, { E10: vehicleMode });
        StateManager.updateInput('E40', formData.E40);

        if (!StateManager.get('estimateState')) {
            formData.E38 = 'wajar';
            StateManager.updateInput('E38', 'wajar');
            formData.E68 = null;
            formData.E70 = null;
        } else {
            formData.E38 = 'app';
            StateManager.updateInput('E38', 'app');
            const es = StateManager.get('estimateState');
            formData.E68 = es.E707 || null;
            formData.E70 = es.E715 || null;
            StateManager.updateInput('E68', formData.E68);
            StateManager.updateInput('E70', formData.E70);
        }

        estimateResult = null;
        pickupEstimate = null;
        StateManager.set('estimateResult', null);
    } else if (mode === 'offline' && newMode === 'online') {
        StateManager.set('estimateState', null);
        formData.E68 = null;
        formData.E70 = null;
        formData.E38 = 'wajar';
        StateManager.batchUpdateInput({ E68: null, E70: null, E38: 'wajar' });

        mode = 'online';
        StateManager.updateInput('E36', 'online');

        estimateResult = null;
        pickupEstimate = null;
        StateManager.set('estimateResult', null);
    }

    validateForm();
    refreshForm();
    updatePreviewContent();
    updateFooter();

    if (mode === 'offline' && !hideSafetyReminder) {
        setTimeout(() => {
            Router.navigateTo({ target: 'popup17' });
        }, 300);
    }

    if (estimateTimer) clearTimeout(estimateTimer);
    estimateTimer = setTimeout(() => {
        pickupEstimate = null;
        callPickupEstimate();
    }, 300);
}

function handleReset() {
    if (isSubmitting) return;
    isSubmitting = true;

    formData.E56 = null;
    formData.E54 = null;
    formData.E58 = null;
    formData.E46 = 'Standar';

    if (mode === 'online') {
        StateManager.set('estimateState', null);
        formData.E38 = 'wajar';
        formData.E68 = null;
        formData.E70 = null;
        StateManager.updateInput('E38', 'wajar');
    } else {
        const storedEstimateState = StateManager && StateManager.get('estimateState');
        if (storedEstimateState) {
            formData.E38 = 'app';
            formData.E68 = storedEstimateState.E707 || null;
            formData.E70 = storedEstimateState.E715 || null;
            StateManager.updateInput('E38', 'app');
        } else {
            formData.E38 = 'wajar';
            formData.E68 = null;
            formData.E70 = null;
            StateManager.updateInput('E38', 'wajar');
        }
    }

    formData.E40 = validateCell('E40', null, { E10: vehicleMode });
    StateManager.updateInput('E40', formData.E40);

    estimateResult = null;
    pickupEstimate = null;
    StateManager && StateManager.set('estimateResult', null);

    StateManager && StateManager.batchUpdateInput({
        E54: null, E56: null, E58: null,
        E68: formData.E68, E70: formData.E70,
        E38: formData.E38,
        E40: formData.E40
    });

    refreshForm();
    validateForm();
    updatePreviewContent();
    updateSubmitButton();

    if (isValid) {
        if (estimateTimer) clearTimeout(estimateTimer);
        estimateTimer = setTimeout(() => callPickupEstimate(), 300);
    }

    isSubmitting = false;
}

function handleCopy() {
    if (!estimateResult) return;
    const prefs = StateManager && StateManager.get('preferences') || {};
    const cc = prefs.customCopy;
    let txt = '';
    if (cc && cc.enabled && cc.template) {
        txt = parseCopyTemplate(cc.template, prepareCopyTemplateData(estimateResult, StateManager.get('input')));
    } else {
        txt = formatCopyEstimate(estimateResult, mode, role);
    }
    navigator.clipboard.writeText(txt)
        .then(() => ThemeManager && ThemeManager.showToast('Preview disalin', 'success'))
        .catch(() => ThemeManager && ThemeManager.showToast('Gagal menyalin', 'error'));
}

function handleSubmit() {
    if (isSubmitting || !isValid) {
        if (!isValid) {
            if (mode === 'online') {
                ThemeManager && ThemeManager.showToast(role === 'Driver' ? 'Isi OMSET DRIVER' : 'Isi HARGA PENUMPANG', 'warning');
            } else {
                ThemeManager && ThemeManager.showToast('Isi Estimasi Jarak dan Waktu', 'warning');
            }
        }
        return;
    }
    isSubmitting = true;

    StateManager && StateManager.set('estimateResult', estimateResult);
    if (window.Cache) window.Cache.invalidate('order');

    if (alwaysGPS) {
        Router.navigateTo({ target: 'trackingidle' });
    } else {
        Router.navigateTo({ target: 'reality' });
    }
}

// =============================================================================
// 10. REFRESH UI & BINDING
// =============================================================================

function refreshForm() {
    const fc = document.getElementById('form-container');
    if (fc) {
        fc.innerHTML = renderFormCard();
        if (mode === 'offline') {
            fc.innerHTML += renderTariffTypeCard();
        }
        bindEvents();
        if (mode === 'offline') {
            document.querySelectorAll('.tariff-type-btn').forEach(btn => {
                if (btn.dataset.type === formData.E38) {
                    btn.classList.remove('btn-outline');
                    btn.classList.add('btn-primary');
                } else {
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-outline');
                }
            });
            const sliderContainer = document.getElementById('e40-slider-container');
            if (sliderContainer) {
                sliderContainer.style.display = formData.E38 === 'wajar' ? '' : 'none';
            }
        }
    }
}

function bindEvents() {
    document.querySelectorAll('#card-form .input-field').forEach(i => {
        i.addEventListener('input', handleInputChange);
    });
    document.querySelectorAll('#card-form .input-select').forEach(s => {
        s.addEventListener('change', handleSelectChange);
    });
    document.querySelectorAll('.tariff-type-btn').forEach(btn => {
        btn.addEventListener('click', handleTariffTypeClick);
    });
    const e40Slider = document.getElementById('input-E40');
    if (e40Slider) {
        e40Slider.addEventListener('input', handleE40Change);
    }
    document.getElementById('reset-form-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        handleReset();
    });
    document.getElementById('open-locpicker-btn')?.addEventListener('click', () => {
        LocationPicker.open();
    });
    document.getElementById('switch-mode-btn')?.addEventListener('click', handleSwitchMode);
    document.getElementById('copy-preview-btn')?.addEventListener('click', handleCopy);
    document.querySelectorAll('[data-help]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            Router.navigateTo({ target: 'popup2', helpKey: el.dataset.help });
        });
    });
}

// =============================================================================
// 11. FOOTER DAN HEADER
// =============================================================================

function updateSubmitButton() {
    const footerContainer = document.getElementById('app-footer');
    if (!footerContainer) return;
    const flexBtn = footerContainer.querySelector('.footer-flex-content');
    if (!flexBtn) return;
    if (isValid) {
        flexBtn.classList.remove('disabled');
        flexBtn.style.pointerEvents = 'auto';
        flexBtn.style.opacity = '1';
    } else {
        flexBtn.classList.add('disabled');
        flexBtn.style.pointerEvents = 'none';
        flexBtn.style.opacity = '0.5';
    }
}

function updateHeader() {
    const hc = document.getElementById('app-header');
    if (!hc || !HeaderManager) return;
    if (currentHeader) { HeaderManager.destroy(currentHeader); }
    const h = HeaderManager.create('step1');
    hc.innerHTML = '';
    if (h) { hc.appendChild(h); currentHeader = h; }
    else { currentHeader = null; }
}

function updateFooter() {
    const fc = document.getElementById('app-footer');
    if (!fc || !FooterManager) return;

    if (mode === 'offline') {
        const backTarget = 'home';
        if (offlineOrderEnabled && !isCheckOffline) {
            // Footer LANJUT (order offline normal)
            const f = FooterManager.create('layoutA', {
                frame1: { type: 'icon', content: FooterManager.createIconButton(ICON.BACK, () => {
                    Router.navigateTo({ target: backTarget });
                }, 'Kembali') },
                frame2: { type: 'flex', content: FooterManager.createFlexContent('LANJUT', ICON.SELESAI, handleSubmit) }
            });
            fc.innerHTML = '';
            if (f) fc.appendChild(f);
            setTimeout(updateSubmitButton, 50);
        } else if (isCheckOffline) {
            // Footer BUAT BON (cek tarif offline)
            const f = FooterManager.create('layoutA', {
                frame1: { type: 'icon', content: FooterManager.createIconButton(ICON.BACK, () => {
                    Router.navigateTo({ target: backTarget });
                }, 'Kembali') },
                frame2: { type: 'flex', content: FooterManager.createFlexContent('BUAT BON', ICON.SELESAI, () => {
                    if (!estimateResult) {
                        ThemeManager && ThemeManager.showToast('Estimasi belum tersedia', 'warning');
                        return;
                    }
                    preloadHtml2Canvas();
                    Router.navigateTo({ target: 'popup23' });
                }) }
            });
            fc.innerHTML = '';
            if (f) fc.appendChild(f);
        } else {
            // Fallback HOME (tidak seharusnya terjadi)
            const f = FooterManager.create('layoutA', {
                frame1: { type: 'icon', content: FooterManager.createIconButton(ICON.BACK, () => {
                    Router.navigateTo({ target: backTarget });
                }, 'Kembali') },
                frame2: { type: 'flex', content: FooterManager.createFlexContent('HOME', ICON.HOME, () => {
                    Router.navigateTo({ target: 'home' });
                }) }
            });
            fc.innerHTML = '';
            if (f) fc.appendChild(f);
        }
    } else {
        const at = alwaysGPS ? 'TRACKING' : 'LANJUT';
        const ai = alwaysGPS ? ICON.TARGET : ICON.SELESAI;
        const f = FooterManager.create('layoutA', {
            frame1: { type: 'icon', content: FooterManager.createIconButton(ICON.BACK, () => {
                Router.navigateTo({ target: 'home' });
            }, 'Kembali') },
            frame2: { type: 'flex', content: FooterManager.createFlexContent(at, ai, handleSubmit) }
        });
        fc.innerHTML = '';
        if (f) fc.appendChild(f);
        setTimeout(updateSubmitButton, 50);
    }
}

// =============================================================================
// 12. BUILD HTML
// =============================================================================

function buildHTML() {
    const landingLink = window.APP_CONFIG?.landingLink || 'linktr.ee/KUPASTARIF';
    return `<div class="page-container">
        <div id="form-container">${renderFormCard()}${mode === 'offline' ? renderTariffTypeCard() : ''}</div>
        <div id="preview-container">${renderPreviewCard()}</div>
        <div class="text-muted text-xs text-center mt-sm" style="opacity: 0.7;">
            Transparansi rumus dan perhitungan: <a href="https://${landingLink}" target="_blank" rel="noopener noreferrer" style="color: var(--primary);">${landingLink}</a><br>
        </div>
    </div>`;
}

// =============================================================================
// 13. RENDER & DESTROY
// =============================================================================

async function render(params, context = {}) {
    const content = document.getElementById('app-content');
    if (!content) return;

    isDestroyed = false;
    isSubmitting = false;

    const direction = context.direction || 'forward';
    loadInitialData(direction);

    content.innerHTML = buildHTML();
    bindEvents();
    updatePreviewContent();
    updateHeader();
    updateFooter();

    callPickupEstimate();

    if (mode === 'offline' && !hideSafetyReminder) {
        setTimeout(() => {
            Router.navigateTo({ target: 'popup17' });
        }, 500);
    }

    window.log.info('[Order ' + F_V + '] (5) Order dirender | mode=' + mode);
}

function destroy() {
    isDestroyed = true;
    isSubmitting = false;
    if (estimateTimer) { clearTimeout(estimateTimer); estimateTimer = null; }
    if (currentHeader) { HeaderManager.destroy(currentHeader); currentHeader = null; }
    html2canvasPromise = null;
    window.log.info('[Order ' + F_V + '] (6) Order dihancurkan');
}

// =============================================================================
// 14. EKSPOR
// =============================================================================

export const PageOrder = {
    render,
    destroy
};

window.log.info('[Order ' + F_V + '] (7) PageOrder dimuat (Cache API, slider E40, Cek Tarif Offline, Popup Bon)');


// ================================ End Of File ================================