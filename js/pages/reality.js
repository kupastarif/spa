/**
 * =================================================================================
 * FILE         : /js/pages/reality.js
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

import { StateManager } from '../core/state.js';
import { Router } from '../core/router.js';
import { HeaderManager } from '../components/header.js';
import { FooterManager } from '../components/footer.js';
import { ThemeManager } from '../components/theme.js';
import { PopupManager } from '../components/popup.js';
import {
    formatRupiah, formatKm, formatMenit, parseNumber
} from '../helpers/format.js';
import {
    getMaxPickupDistance, getMaxPickupTime, validateCell, getValidationRange
} from '../helpers/output.js';

// =============================================================================
// 0. IKON LOKAL (tidak lagi bergantung pada getIcon dari texts.js)
// =============================================================================

const ICON = {
    GPS: '📍',
    INFO: 'ⓘ',
    CANCEL: '✖',
    SAVE: '💾',
    BACK: '◀',
    SELESAI: '✅'
};

// =============================================================================
// 1. STATE INTERNAL
// =============================================================================

let isDestroyed = false;
let isSubmitting = false;
let mode = 'online';
let role = 'Driver';
let vehicleMode = 'Motor';
let estimateResult = null;
let isValid = false;

let currentHeader = null;

let formData = {
    E78: null,
    E80: null,
    E82: null,
    E84: null,
    E92: null,
    E100: null,
    E102: null,
    E104: null
};

let maxJemput = { distance: 2, time: 15 };
let maxAntar = { distance: 0, time: 0 };

// =============================================================================
// 2. LOAD DATA AWAL
// =============================================================================

function loadInitialData(direction) {
    window.log.info('[Reality ' + F_V + '] (1) loadInitialData dipanggil, direction=' + direction);

    const input = StateManager.get('input') || {};
    mode = input.E36 || 'online';
    role = input.E12 || 'Driver';
    vehicleMode = input.E10 || 'Motor';

    formData.E78 = input.E78 ?? null;
    formData.E80 = input.E80 ?? null;
    formData.E82 = input.E82 ?? null;
    formData.E84 = input.E84 ?? null;
    formData.E92 = input.E92 ?? null;
    formData.E100 = input.E100 ?? null;
    formData.E102 = input.E102 ?? null;
    formData.E104 = input.E104 ?? null;

    estimateResult = StateManager.get('estimateResult');

    // Gunakan Output untuk konstanta
    maxJemput.distance = getMaxPickupDistance();
    maxJemput.time = getMaxPickupTime();

    if (estimateResult) {
        maxAntar.distance = estimateResult.E707 || 0;
        maxAntar.time = estimateResult.E715 || 0;
    }

    const isBack = direction === 'back';

    if (!isBack) {
        const fromTracking = StateManager.get('reality.fromTracking');
        if (fromTracking) {
            StateManager.set('reality.fromTracking', null);
            window.log.info('[Reality ' + F_V + '] (2) Data dari tracking dipertahankan');
        } else {
            // Reset form utama, tapi pertahankan biaya tambahan untuk offline
            formData.E78 = null;
            formData.E80 = null;
            formData.E82 = null;
            formData.E84 = null;
            formData.E92 = null;

            // Untuk mode offline, jangan reset biaya tambahan jika sudah ada di input
            if (mode !== 'offline') {
                formData.E100 = null;
                formData.E102 = null;
                formData.E104 = null;
            } else {
                // Pulihkan dari state (jika ada), agar tidak hilang
                if (input.E100) formData.E100 = input.E100;
                if (input.E102) formData.E102 = input.E102;
                if (input.E104) formData.E104 = input.E104;
                StateManager.updateInput('E100', formData.E100);
                StateManager.updateInput('E102', formData.E102);
                StateManager.updateInput('E104', formData.E104);
            }

            if (role === 'Penumpang') {
                formData.E78 = maxJemput.distance;
                formData.E80 = maxJemput.time;
                StateManager.updateInput('E78', formData.E78);
                StateManager.updateInput('E80', formData.E80);
            }
            window.log.info('[Reality ' + F_V + '] (3) Form direset | role=' + role);
        }
    }

    validateForm();
    window.log.info('[Reality ' + F_V + '] (4) loadInitialData selesai');
}

// =============================================================================
// 3. VALIDASI (via Output)
// =============================================================================

function validateField(cell, value) {
    if (value === null || value === undefined || value === '') return false;
    try {
        const validated = validateCell(cell, value);
        const range = getValidationRange(cell);
        return validated >= range.min && validated <= range.max;
    } catch (e) { return false; }
}

function validateForm() {
    if (!validateField('E78', formData.E78)) { isValid = false; return false; }
    if (!validateField('E80', formData.E80)) { isValid = false; return false; }
    if (!validateField('E82', formData.E82)) { isValid = false; return false; }
    if (!validateField('E84', formData.E84)) { isValid = false; return false; }
    isValid = true;
    window.log.info('[Reality ' + F_V + '] (5) validateForm: isValid=' + isValid);
    return true;
}

// =============================================================================
// 4. RENDER
// =============================================================================

function renderInfoCard() {
    return `<div class="card">
        <div class="info-row"><span>Max Jemput</span><span>${formatKm(maxJemput.distance)}, ${formatMenit(maxJemput.time)}</span></div>
        <div class="info-row"><span>Max Antar</span><span>${formatKm(maxAntar.distance)}, ${formatMenit(maxAntar.time)}</span></div>
    </div>`;
}

function renderForm() {
    let formHTML = `<div class="card reality-form">`;

    formHTML += `<button class="btn btn-primary btn-block mb-md" id="gps-tracker-btn">${ICON.GPS} GPS TRACKER</button>`;

    if (mode === 'online') {
        formHTML += `<div class="input-wrapper">
            <span class="input-label">BIAYA APLIKASI <span class="input-info input-info-danger" data-help="reality-biaya-rahasia">${ICON.INFO}</span></span>
            <div class="input-field-container">
                <input type="number" class="input-field" id="input-E92" value="${formData.E92 !== null ? formData.E92 : ''}"
                    placeholder="namanya aja rahasia..." inputmode="numeric" data-cell="E92" autocomplete="off">
                <span class="input-unit">Rp</span>
            </div></div>
        <div class="divider"></div>`;
    }

    const pickupNote = role === 'Penumpang' ? '<div class="input-note">* penjemputan otomatis terisi, bisa diubah</div>' : '';

    formHTML += `<div class="input-section">
        <div class="input-section-label">PENJEMPUTAN <span class="input-info" data-help="reality-jemput">${ICON.INFO}</span></div>
        ${pickupNote}
        <div class="input-dual">
            <div class="input-field-container">
                <input type="number" class="input-field" id="input-E78" value="${formData.E78 !== null ? formData.E78 : ''}"
                    placeholder="jarak" inputmode="decimal" step="0.1" data-cell="E78" autocomplete="off">
                <span class="input-unit">km</span>
            </div>
            <div class="input-field-container">
                <input type="number" class="input-field" id="input-E80" value="${formData.E80 !== null ? formData.E80 : ''}"
                    placeholder="waktu" inputmode="numeric" data-cell="E80" autocomplete="off">
                <span class="input-unit">mnt</span>
            </div>
        </div></div>`;

    formHTML += `<div class="input-section">
        <div class="input-section-label">PENGANTARAN <span class="input-info" data-help="reality-antar">${ICON.INFO}</span></div>
        <div class="input-dual">
            <div class="input-field-container">
                <input type="number" class="input-field" id="input-E82" value="${formData.E82 !== null ? formData.E82 : ''}"
                    placeholder="jarak" inputmode="decimal" step="0.1" data-cell="E82" autocomplete="off">
                <span class="input-unit">km</span>
            </div>
            <div class="input-field-container">
                <input type="number" class="input-field" id="input-E84" value="${formData.E84 !== null ? formData.E84 : ''}"
                    placeholder="waktu" inputmode="numeric" data-cell="E84" autocomplete="off">
                <span class="input-unit">mnt</span>
            </div>
        </div></div>
    </div>`;

    return formHTML;
}

function renderBiayaTambahanButton() {
    if (mode !== 'offline') return '';
    return `<div class="reality-additional-container"><button class="btn btn-outline" id="biaya-tambahan-btn">+ BIAYA PERJALANAN</button></div>`;
}

function renderBiayaTambahanSummary() {
    if (mode !== 'offline') return '';
    const hasValues = (formData.E100 || 0) > 0 || (formData.E102 || 0) > 0 || (formData.E104 || 0) > 0;
    if (!hasValues) return '';

    const parts = [];
    if (formData.E100) parts.push(`Parkir: ${formatRupiah(formData.E100)}`);
    if (formData.E102) parts.push(`Toll: ${formatRupiah(formData.E102)}`);
    if (formData.E104) parts.push(`Lainnya: ${formatRupiah(formData.E104)}`);

    return `<div class="reality-additional-summary"><span class="summary-label">Biaya Tambahan:</span> <span class="summary-value">${parts.join(' · ')}</span></div>`;
}

// =============================================================================
// 5. KONTEN POPUP (DIPANGGIL OLEH POPUPMANAGER)
// =============================================================================

function createBiayaTambahanContent() {
    const input = StateManager.get('input') || {};
    const isMotor = input.E10 === 'Motor';

    const container = document.createElement('div');
    container.className = 'popup-biaya-tambahan';

    let tollHTML = '';
    if (!isMotor) {
        tollHTML = `<div class="input-wrapper">
            <span class="input-label">TOLL</span>
            <div class="input-field-container">
                <input type="number" class="input-field" id="popup-E102" value="${formData.E102 !== null ? formData.E102 : ''}"
                    placeholder="" inputmode="numeric" autocomplete="off">
                <span class="input-unit">Rp</span>
            </div></div>`;
    }

    container.innerHTML = `
        <div class="input-wrapper">
            <span class="input-label">PARKIR</span>
            <div class="input-field-container">
                <input type="number" class="input-field" id="popup-E100" value="${formData.E100 !== null ? formData.E100 : ''}"
                    placeholder="" inputmode="numeric" autocomplete="off">
                <span class="input-unit">Rp</span>
            </div></div>
        ${tollHTML}
        <div class="input-wrapper">
            <span class="input-label">LAINNYA</span>
            <div class="input-field-container">
                <input type="number" class="input-field" id="popup-E104" value="${formData.E104 !== null ? formData.E104 : ''}"
                    placeholder="" inputmode="numeric" autocomplete="off">
                <span class="input-unit">Rp</span>
            </div></div>
    `;

    container._popupOptions = {
        title: 'BIAYA TAMBAHAN',
        showCloseButton: true,
        closeOnOverlay: true,
        showActions: true,
        buttons: [
            {
                text: `${ICON.CANCEL} BATAL`,
                type: 'outline',
                onClick: () => {
                    Router.navigateTo({ popup: 0 });
                }
            },
            {
                text: `${ICON.SAVE} SIMPAN`,
                type: 'primary',
                onClick: () => {
                    const e100Input = document.getElementById('popup-E100');
                    const e104Input = document.getElementById('popup-E104');

                    if (e100Input) updateFormField('E100', e100Input.value.trim());
                    if (e104Input) updateFormField('E104', e104Input.value.trim());

                    if (!isMotor) {
                        const e102Input = document.getElementById('popup-E102');
                        if (e102Input) updateFormField('E102', e102Input.value.trim());
                    } else {
                        formData.E102 = null;
                        StateManager.updateInput('E102', null);
                    }

                    refreshUI();
                    Router.navigateTo({ popup: 0 });
                }
            }
        ]
    };

    return container;
}

function updateFormField(cell, value) {
    console.log(`[updateFormField] cell=${cell}, value='${value}'`);
    if (value === '') {
        console.log('  -> empty, set null');
        formData[cell] = null;
        StateManager.updateInput(cell, null);
        return;
    }

    const num = parseNumber(value);
    console.log(`  -> parsed: ${num}, isNaN: ${isNaN(num)}`);
    if (!isNaN(num)) {
        const validated = validateCell(cell, num);
        console.log(`  -> validated: ${validated}`);
        formData[cell] = validated;
        StateManager.updateInput(cell, validated);
    } else {
        console.log('  -> parseNumber returned NaN, abort');
    }
}

// =============================================================================
// 6. ENGINE CALL (melalui Cache)
// =============================================================================

function buildEngineInput() {
    const input = StateManager.get('input') || {};
    input.E78 = formData.E78;
    input.E80 = formData.E80;
    input.E82 = formData.E82;
    input.E84 = formData.E84;
    if (mode === 'online') {
        input.E92 = formData.E92 ?? null;
    } else {
        input.E100 = formData.E100 ?? null;
        input.E102 = formData.E102 ?? null;
        input.E104 = formData.E104 ?? null;
    }
    return input;
}

async function callReality() {
    window.log.info('[Reality ' + F_V + '] (6) callReality dipanggil');
    try {
        if (window.Cache) {
            const valid = buildEngineInput();
            const result = window.Cache.reality(valid, estimateResult);
            window.log.info('[Reality ' + F_V + '] (7) callReality berhasil');
            return result;
        }
        throw new Error('Cache tidak tersedia');
    } catch (error) {
        window.log.error('[Reality ' + F_V + '] (8) Reality error:', error);
        ThemeManager?.showToast('Gagal menghitung realitas', 'error');
        return null;
    }
}

// =============================================================================
// 7. BUILD HTML & REFRESH
// =============================================================================

function buildHTML() {
    return `<div class="page-container">
        <div id="info-container">${renderInfoCard()}</div>
        <div id="form-container">${renderForm()}</div>
        <div id="additional-container">${renderBiayaTambahanButton()}${renderBiayaTambahanSummary()}</div>
    </div>`;
}

function refreshUI() {
    const infoContainer = document.getElementById('info-container');
    const formContainer = document.getElementById('form-container');
    const additionalContainer = document.getElementById('additional-container');

    if (infoContainer) infoContainer.innerHTML = renderInfoCard();
    if (formContainer) formContainer.innerHTML = renderForm();
    if (additionalContainer) additionalContainer.innerHTML = renderBiayaTambahanButton() + renderBiayaTambahanSummary();

    bindEvents();
}

// =============================================================================
// 8. EVENT HANDLERS
// =============================================================================

function handleInputChange(e) {
    const input = e.target;
    const cell = input.dataset.cell;
    const val = input.value.trim();

    if (val === '') {
        formData[cell] = null;
        StateManager.updateInput(cell, null);
    } else {
        const num = parseNumber(val);
        if (!isNaN(num)) {
            const validated = validateCell(cell, num);
            formData[cell] = validated;
            StateManager.updateInput(cell, validated);
        }
    }
    validateForm();
    updateSubmitButton();
}

function handleInputBlur(e) {
    const input = e.target;
    if (formData[input.dataset.cell] !== null && formData[input.dataset.cell] !== undefined) {
        input.value = formData[input.dataset.cell];
    }
}

async function handleSubmit() {
    window.log.info('[Reality ' + F_V + '] (9) handleSubmit dipanggil');
    if (isSubmitting) return;
    if (!isValid) {
        ThemeManager?.showToast('Lengkapi semua field dengan benar', 'warning');
        return;
    }

    isSubmitting = true;
    const realityResult = await callReality();

    if (realityResult) {
        StateManager.set('input', buildEngineInput());
        StateManager.set('realityResult', realityResult);
        Router.navigateTo({ target: 'result' });
    }

    isSubmitting = false;
}

// =============================================================================
// 9. BIND EVENTS
// =============================================================================

function bindEvents() {
    document.querySelectorAll('#form-container .input-field').forEach(input => {
        input.addEventListener('input', handleInputChange);
        input.addEventListener('blur', handleInputBlur);
    });

    const gpsBtn = document.getElementById('gps-tracker-btn');
    if (gpsBtn) {
        gpsBtn.addEventListener('click', () => {
            Router.navigateTo({ target: 'trackingidle' });
        });
    }

    const biayaBtn = document.getElementById('biaya-tambahan-btn');
    if (biayaBtn) {
        biayaBtn.addEventListener('click', () => {
            Router.navigateTo({ target: 'popup13' });
        });
    }

    document.querySelectorAll('[data-help]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = el.dataset.help;
            Router.navigateTo({ target: 'popup2', helpKey: key });
        });
    });
}

// =============================================================================
// 10. UPDATE HEADER & FOOTER
// =============================================================================

function updateHeader() {
    const headerContainer = document.getElementById('app-header');
    if (!headerContainer || !HeaderManager) return;
    if (currentHeader) { HeaderManager.destroy(currentHeader); }
    const header = HeaderManager.create('step2');
    headerContainer.innerHTML = '';
    if (header) { headerContainer.appendChild(header); currentHeader = header; }
    else { currentHeader = null; }
}

function updateFooter() {
    const footerContainer = document.getElementById('app-footer');
    if (!footerContainer || !FooterManager) return;

    const footer = FooterManager.create('layoutA', {
        frame1: { type: 'icon', content: FooterManager.createIconButton(ICON.BACK, () => {
            Router.navigateTo({ target: 'order' });
        }, 'Kembali') },
        frame2: { type: 'flex', content: FooterManager.createFlexContent('HITUNG', ICON.SELESAI, handleSubmit) }
    });

    footerContainer.innerHTML = '';
    if (footer) footerContainer.appendChild(footer);

    setTimeout(updateSubmitButton, 50);
}

function updateSubmitButton() {
    const footerContainer = document.getElementById('app-footer');
    if (!footerContainer) return;
    const hitungBtn = footerContainer.querySelector('.footer-flex-content');
    if (!hitungBtn) return;
    if (isValid) {
        hitungBtn.classList.remove('disabled');
        hitungBtn.style.pointerEvents = 'auto';
        hitungBtn.style.opacity = '1';
    } else {
        hitungBtn.classList.add('disabled');
        hitungBtn.style.pointerEvents = 'none';
        hitungBtn.style.opacity = '0.5';
    }
}

// =============================================================================
// 11. REGISTRASI POPUP CUSTOM
// =============================================================================

PopupManager.register(13, () => createBiayaTambahanContent());

// =============================================================================
// 12. RENDER & DESTROY
// =============================================================================

async function render(params, context = {}) {
    const content = document.getElementById('app-content');
    if (!content) return;

    isDestroyed = false;
    isSubmitting = false;

    if (typeof window.forceStopTracking === 'function') {
        window.forceStopTracking();
    }

    const direction = context.direction || 'forward';
    loadInitialData(direction);

    content.innerHTML = buildHTML();
    bindEvents();
    updateHeader();
    updateFooter();

    window.log.info('[Reality ' + F_V + '] (12) Reality dirender');
}

function destroy() {
    isDestroyed = true;
    isSubmitting = false;
    if (currentHeader) { HeaderManager.destroy(currentHeader); currentHeader = null; }
    window.log.info('[Reality ' + F_V + '] (13) Reality dihancurkan');
}

// =============================================================================
// 13. EKSPOR
// =============================================================================

export const PageReality = {
    render,
    destroy
};

window.log.info('[Reality ' + F_V + '] (14) PageReality dimuat (Cache API, Output validasi)');


// ================================ End Of File ================================