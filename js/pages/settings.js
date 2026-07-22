/**
 * =================================================================================
 * FILE         : /js/pages/settings.js
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
import { PreferencesManager } from '../core/preferences.js';
import { StorageManager } from '../core/storage.js';
import { Router } from '../core/router.js';
import { HeaderManager } from '../components/header.js';
import { FooterManager } from '../components/footer.js';
import { ThemeManager } from '../components/theme.js';
import { PopupManager } from '../components/popup.js';
import { DrawerManager } from '../components/drawer.js';
import { escapeHtml } from '../helpers/format.js';
import { getDropdownOptions } from '../helpers/output.js';

// =============================================================================
// 0. IKON LOKAL (tidak lagi bergantung pada getIcon dari texts.js)
// =============================================================================

const ICON = {
    GEAR: '⚙️',
    FUEL: '⛽',
    INFO: 'ⓘ',
    QUICK_ORDER: '⚡',
    OFFLINE: '📴',
    GPS: '📍',
    TEXT_SIZE: '🔤',
    WARNING: '⚠',
    SETTINGS: '⚡',        // fallback, tidak ada di registry asli
    MOBIL: '🚗',
    DRIVER: '👤',
    WARNING_BOLD: '⚠️',
    COPY: '📋',
    SAVE: '💾',
    RESET: '🔁',
    MENU: '☰',
    HOME: '🏠'
};

// =============================================================================
// 1. STATE INTERNAL
// =============================================================================

let isDestroyed = false;
let isSubmitting = false;
let saveDebounceTimer = null;
let preferences = null;
let emergencyContacts = {
    kerabat: '',
    darurat: '112',
    ambulance: '118',
    polisi: '110'
};
let currentHeader = null;

let validationOptions = null;

const COPY_PLACEHOLDERS = {
    pesanan: [
        { key: '{jarakOrder}', label: 'Jarak order (km)' },
        { key: '{waktuOrder}', label: 'Waktu order (menit)' },
        { key: '{layanan}', label: 'Tipe layanan' },
        { key: '{kendaraan}', label: 'Mode kendaraan (Mobil/Motor)' },
        { key: '{cc}', label: 'Kapasitas mesin' },
        { key: '{area}', label: 'Area' }
    ],
    tarif: [
        { key: '{tarifPerKm}', label: 'Tarif per km (Rp)' },
        { key: '{tarifPerMenit}', label: 'Tarif per menit (Rp)' }
    ],
    pendapatan: [
        { key: '{omsetDriver}', label: 'Omset driver (Rp)' },
        { key: '{pendapatanAplikasi}', label: 'Pendapatan aplikasi (Rp)' },
        { key: '{persenAplikasi}', label: 'Persentase aplikasi (%)' },
        { key: '{pembayaranPenumpang}', label: 'Pembayaran penumpang (Rp)' }
    ],
    penjemputan: [
        { key: '{maxJarakJemput}', label: 'Max jarak jemput gratis (km)' },
        { key: '{maxWaktuJemput}', label: 'Max waktu jemput gratis (menit)' }
    ],
    situs: [
        { key: '{namaSitus}', label: 'Nama situs' },
        { key: '{linkSitus}', label: 'Link situs' }
    ]
};

const DEFAULT_COPY_TEMPLATE = '⚡ {namaSitus} - Transparansi Tarif\n\n' +
    'Pesanan sesuai aplikasi:\n\n' +
    'Max Jemput Gratis: {maxJarakJemput} km, {maxWaktuJemput} mnt\n\n' +
    'Max Antar: {jarakOrder} km, {waktuOrder} mnt\n\n' +
    'Estimasi:\n\n' +
    'Omset Driver: Rp {omsetDriver}\n' +
    'Pendapatan Aplikasi: Rp {pendapatanAplikasi}\n\n' +
    'Kelebihan perjalanan dikenakan biaya sesuai tarif:\n' +
    'Rp {tarifPerKm}/km · Rp {tarifPerMenit}/mnt\n\n' +
    'Hitung sendiri: {linkSitus}';

// =============================================================================
// 2. LOAD DATA (via Output)
// =============================================================================

function loadPreferences() {
    preferences = PreferencesManager?.load() || {
        quickOrder: false, alwaysGPS: false, offlineOrder: false,
        alwaysOperational: false, largeText: false, hideSafetyReminder: false,
        cacheMaksimal: false,
        defaultVehicle: {
            mode: 'Mobil', role: 'Driver', area: 'Jabodetabek',
            cc: '1000cc', fuel: 'Pertalite'
        },
        driverInfo: { name: '', plate: '', phone: '' },
        customCopy: { enabled: false, template: '' }
    };
}

function loadValidationOptions() {
    // Gunakan Output, bukan Engine
    const modeOpts = getDropdownOptions('E10');
    const areaOpts = getDropdownOptions('E20');
    const getCcOptions = (mode) => getDropdownOptions('E22', { E10: mode });
    const getFuelOptions = (cc) => getDropdownOptions('E24', { E22: cc });

    validationOptions = {
        mode: modeOpts,
        area: areaOpts,
        cc: getCcOptions,
        fuel: getFuelOptions
    };
}

function loadEmergencyContacts() {
    if (StorageManager) {
        emergencyContacts = StorageManager.getEmergencyContacts();
    }
}

// =============================================================================
// 3. RENDER
// =============================================================================

function renderToggle(id, checked) {
    return `<span class="toggle" role="switch" aria-checked="${checked ? 'true' : 'false'}" tabindex="0" id="${id}">
        <span class="toggle-track"><span class="toggle-thumb"></span></span>
    </span>`;
}

function buildHTML() {
    const v = preferences.defaultVehicle;
    const qo = preferences.quickOrder;
    const ag = preferences.alwaysGPS;
    const oo = preferences.offlineOrder;
    const ao = preferences.alwaysOperational;
    const lt = preferences.largeText;
    const hs = preferences.hideSafetyReminder;
    const cm = preferences.cacheMaksimal;                // v2.0.1-rev0
    const ccEnabled = preferences.customCopy?.enabled || false;
    const ccTemplate = preferences.customCopy?.template || DEFAULT_COPY_TEMPLATE;

    const modeOptions = (validationOptions?.mode || ['Mobil', 'Motor'])
        .map(o => `<option value="${o}" ${v.mode === o ? 'selected' : ''}>${o}</option>`).join('');
    const areaOptions = (validationOptions?.area || ['Jabodetabek', 'SumatraJawa', 'TimurIndonesia'])
        .map(o => `<option value="${o}" ${v.area === o ? 'selected' : ''}>${o}</option>`).join('');

    const ccFallback = v.mode === 'Mobil' ? ['1000cc','1500cc','2000cc'] : ['125cc','160cc','200cc'];
    const ccList = validationOptions?.cc ? validationOptions.cc(v.mode) : ccFallback;
    const ccOptions = ccList.map(o => `<option value="${o}" ${v.cc === o ? 'selected' : ''}>${o}</option>`).join('');

    const fuelFallback = ['Pertalite'];
    const fuelList = validationOptions?.fuel ? validationOptions.fuel(v.cc) : fuelFallback;
    const fuelOptions = fuelList.map(o => `<option value="${o}" ${v.fuel === o ? 'selected' : ''}>${o}</option>`).join('');

    const vehicleEnabled = ao || qo;
    const roleAreaEnabled = qo && !ao;
    const driverInfoEnabled = qo && !ao && v.role === 'Driver';

    // Kontak darurat
    const ec = emergencyContacts;

    // Cache maksimal hanya bisa diubah di production
    const isDev = window.APP_CONFIG?.isDevMode;
    const cacheToggleDisabled = isDev;

    return `<div class="page-container">
        <div class="page-title">${ICON.GEAR} PENGATURAN</div>

        <div class="card">
            <div class="settings-section">
                <div class="settings-switch-row">
                    <span>${ICON.FUEL} Always Operational <span class="input-info" data-help="settings-operational">${ICON.INFO}</span></span>
                    ${renderToggle('always-operational-toggle', ao)}
                </div>
                <div class="settings-switch-row">
                    <span>${ICON.QUICK_ORDER} Quick Order <span class="input-info" data-help="settings-quick-order">${ICON.INFO}</span></span>
                    ${renderToggle('quick-order-toggle', qo)}
                </div>
                <div class="settings-switch-row">
                    <span>${ICON.OFFLINE} Mode Offline <span class="input-info" data-help="settings-offline">${ICON.INFO}</span></span>
                    ${renderToggle('offline-order-toggle', oo)}
                </div>
                <div class="settings-switch-row">
                    <span>${ICON.GPS} Selalu Gunakan GPS <span class="input-info" data-help="settings-always-gps">${ICON.INFO}</span></span>
                    ${renderToggle('always-gps-toggle', ag)}
                </div>
                <div class="settings-switch-row">
                    <span>${ICON.TEXT_SIZE} Teks Lebih Besar <span class="input-info" data-help="settings-large-text">${ICON.INFO}</span></span>
                    ${renderToggle('large-text-toggle', lt)}
                </div>
                <div class="settings-switch-row">
                    <span>${ICON.WARNING_BOLD} Sembunyikan Pengingat Keselamatan <span class="input-info" data-help="safety-reminder">${ICON.INFO}</span></span>
                    ${renderToggle('hide-safety-toggle', hs)}
                </div>
                <div class="settings-switch-row">
                    <span>${ICON.SETTINGS} Maksimalkan Cache <span class="input-info" data-help="settings-cache">${ICON.INFO}</span></span>
                    ${renderToggle('cache-maksimal-toggle', cm)}
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">${ICON.MOBIL} DEFAULT VEHICLE <span class="input-info" data-help="settings-default-vehicle">${ICON.INFO}</span></span>
            </div>
            <div class="settings-section">
                <div class="input-wrapper"><span class="input-label">Mode</span><div class="input-field-container ${vehicleEnabled ? '' : 'disabled'}"><select class="input-select" id="vehicle-mode" ${vehicleEnabled ? '' : 'disabled'}>${modeOptions}</select></div></div>
                <div class="input-wrapper"><span class="input-label">CC</span><div class="input-field-container ${vehicleEnabled ? '' : 'disabled'}"><select class="input-select" id="vehicle-cc" ${vehicleEnabled ? '' : 'disabled'}>${ccOptions}</select></div></div>
                <div class="input-wrapper"><span class="input-label">BBM</span><div class="input-field-container ${vehicleEnabled ? '' : 'disabled'}"><select class="input-select" id="vehicle-fuel" ${vehicleEnabled ? '' : 'disabled'}>${fuelOptions}</select></div></div>
                <div class="input-wrapper"><span class="input-label">Role</span><div class="input-field-container ${roleAreaEnabled ? '' : 'disabled'}"><select class="input-select" id="vehicle-role" ${roleAreaEnabled ? '' : 'disabled'}>
                    <option value="Driver" ${v.role === 'Driver' ? 'selected' : ''}>Driver</option>
                    <option value="Penumpang" ${v.role === 'Penumpang' ? 'selected' : ''}>Penumpang</option>
                </select></div></div>
                <div class="input-wrapper"><span class="input-label">Area</span><div class="input-field-container ${roleAreaEnabled ? '' : 'disabled'}"><select class="input-select" id="vehicle-area" ${roleAreaEnabled ? '' : 'disabled'}>${areaOptions}</select></div></div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">${ICON.DRIVER} DRIVER INFO <span class="input-info" data-help="settings-driver-info">${ICON.INFO}</span></span>
            </div>
            <div class="settings-section">
                <div class="input-wrapper"><span class="input-label">Nama</span><div class="input-field-container ${driverInfoEnabled ? '' : 'disabled'}"><input type="text" class="input-field" id="driver-name" value="${escapeHtml(preferences.driverInfo.name)}" placeholder="John Doe" maxlength="50" ${driverInfoEnabled ? '' : 'disabled'}></div></div>
                <div class="input-wrapper"><span class="input-label">Plat</span><div class="input-field-container ${driverInfoEnabled ? '' : 'disabled'}"><input type="text" class="input-field" id="driver-plate" value="${escapeHtml(preferences.driverInfo.plate)}" placeholder="B 1234 CD" maxlength="15" ${driverInfoEnabled ? '' : 'disabled'}></div></div>
                <div class="input-wrapper"><span class="input-label">Telepon</span><div class="input-field-container ${driverInfoEnabled ? '' : 'disabled'}"><input type="tel" class="input-field" id="driver-phone" value="${escapeHtml(preferences.driverInfo.phone)}" placeholder="08123456789" maxlength="20" ${driverInfoEnabled ? '' : 'disabled'}></div></div>
                <p class="text-muted text-sm mt-sm driver-info-note">* Data dienkripsi, hanya tersimpan di HP Anda.</p>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">${ICON.WARNING_BOLD} KONTAK DARURAT <span class="input-info" data-help="settings-emergency">${ICON.INFO}</span></span>
            </div>
            <div class="settings-section">
                <div class="input-wrapper"><span class="input-label">WA Kerabat</span><div class="input-field-container"><input type="tel" class="input-field" id="emergency-kerabat" value="${escapeHtml(ec.kerabat)}" placeholder="0812xxxx" maxlength="20"></div></div>
                <div class="input-wrapper"><span class="input-label">Darurat</span><div class="input-field-container"><input type="tel" class="input-field" id="emergency-darurat" value="${escapeHtml(ec.darurat)}" placeholder="112" maxlength="10"></div></div>
                <div class="input-wrapper"><span class="input-label">Ambulance</span><div class="input-field-container"><input type="tel" class="input-field" id="emergency-ambulance" value="${escapeHtml(ec.ambulance)}" placeholder="118" maxlength="10"></div></div>
                <div class="input-wrapper"><span class="input-label">Polisi</span><div class="input-field-container"><input type="tel" class="input-field" id="emergency-polisi" value="${escapeHtml(ec.polisi)}" placeholder="110" maxlength="10"></div></div>
                <p class="text-muted text-sm mt-sm">* Data dienkripsi. Digunakan untuk tombol kontak darurat di halaman Tracking.</p>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><span class="card-title">${ICON.COPY} CUSTOM COPY TEMPLATE <span class="input-info" data-help="settings-template">${ICON.INFO}</span></span></div>
            <div class="settings-section">
                <div class="settings-switch-row"><span>Aktifkan Template Kustom</span>${renderToggle('custom-copy-toggle', ccEnabled)}</div>
                <div class="input-wrapper input-wrapper-full"><textarea id="custom-copy-template" class="settings-textarea" placeholder="Masukkan template copy..." maxlength="2000" ${ccEnabled ? '' : 'disabled'}>${escapeHtml(ccTemplate)}</textarea></div>
                <div class="settings-placeholder-info ${ccEnabled ? '' : 'hidden'}" id="placeholder-info"><p class="text-xs text-secondary mb-xs">Placeholder yang tersedia (klik untuk menyisipkan):</p>${renderPlaceholderInfo()}</div>
                <button class="btn btn-primary btn-block mt-md ${ccEnabled ? '' : 'hidden'}" id="save-template-btn">${ICON.SAVE} SIMPAN TEMPLATE</button>
                <p class="text-muted text-xs mt-sm template-note">* Template minimal 100 karakter, maksimal 2000 karakter</p>
            </div>
        </div>

        <div class="text-center mt-lg mb-lg">
            <button class="btn btn-outline" id="reset-default">${ICON.RESET} RESET KE DEFAULT</button>
        </div>
    </div>`;
}

function renderPlaceholderInfo() {
    let html = '';
    for (const [group, items] of Object.entries(COPY_PLACEHOLDERS)) {
        html += `<p class="text-xs text-secondary mb-xs"><strong>${group.charAt(0).toUpperCase() + group.slice(1)}:</strong></p>`;
        html += '<p class="text-xs mb-sm placeholder-group">';
        items.forEach(item => html += `<code class="placeholder-key" data-placeholder="${item.key}">${item.key}</code> `);
        html += '</p>';
    }
    return html;
}

// =============================================================================
// 4. EVENT BINDING
// =============================================================================

function bindEvents() {
    document.querySelectorAll('.toggle').forEach(toggle => {
        toggle.addEventListener('click', handleToggleClick);
        toggle.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleToggleClick(e); }
        });
    });

    document.getElementById('vehicle-mode')?.addEventListener('change', function() {
        updateCCOptions();
        debouncedSave();
    });
    document.getElementById('vehicle-role')?.addEventListener('change', function() {
        updateDisabledState();
        debouncedSave();
    });
    document.getElementById('vehicle-cc')?.addEventListener('change', function() {
        updateFuelOptions();
        debouncedSave();
    });
    document.getElementById('vehicle-area')?.addEventListener('change', debouncedSave);
    document.getElementById('vehicle-fuel')?.addEventListener('change', debouncedSave);

    document.getElementById('driver-name')?.addEventListener('blur', saveDriverInfo);
    document.getElementById('driver-plate')?.addEventListener('blur', saveDriverInfo);
    document.getElementById('driver-phone')?.addEventListener('blur', saveDriverInfo);

    document.getElementById('emergency-kerabat')?.addEventListener('blur', saveEmergencyContactsData);
    document.getElementById('emergency-darurat')?.addEventListener('blur', saveEmergencyContactsData);
    document.getElementById('emergency-ambulance')?.addEventListener('blur', saveEmergencyContactsData);
    document.getElementById('emergency-polisi')?.addEventListener('blur', saveEmergencyContactsData);

    document.getElementById('save-template-btn')?.addEventListener('click', saveTemplate);

    document.getElementById('reset-default')?.addEventListener('click', () => {
        Router.navigateTo({ target: 'popup7' });
    });

    document.querySelectorAll('.placeholder-key').forEach(el => {
        el.addEventListener('click', function() {
            const placeholder = this.dataset.placeholder;
            const textarea = document.getElementById('custom-copy-template');
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const text = textarea.value;
                textarea.value = text.substring(0, start) + placeholder + text.substring(end);
                textarea.focus();
                textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
            }
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

function handleToggleClick(e) {
    const toggle = e.currentTarget;
    const isChecked = toggle.getAttribute('aria-checked') === 'true';
    const newValue = !isChecked;

    // Cache maksimal hanya bisa diubah di production
    if (toggle.id === 'cache-maksimal-toggle' && window.APP_CONFIG?.isDevMode) {
        return; // tidak bisa diubah
    }

    toggle.setAttribute('aria-checked', newValue ? 'true' : 'false');

    if (toggle.id === 'always-operational-toggle' && newValue) {
        window._pendingSettingsMessage = 'Default kendaraan disimpan untuk Always Operational';
        const qoToggle = document.getElementById('quick-order-toggle');
        const ooToggle = document.getElementById('offline-order-toggle');
        const agToggle = document.getElementById('always-gps-toggle');
        if (qoToggle) qoToggle.setAttribute('aria-checked', 'false');
        if (ooToggle) ooToggle.setAttribute('aria-checked', 'false');
        if (agToggle) agToggle.setAttribute('aria-checked', 'false');
    }

    if (toggle.id === 'quick-order-toggle' && newValue) {
        window._pendingSettingsMessage = 'Default kendaraan disimpan untuk Quick Order';
        const aoToggle = document.getElementById('always-operational-toggle');
        if (aoToggle) aoToggle.setAttribute('aria-checked', 'false');
    }

    if ((toggle.id === 'quick-order-toggle' || toggle.id === 'offline-order-toggle') && newValue) {
        const aoToggle = document.getElementById('always-operational-toggle');
        if (aoToggle) aoToggle.setAttribute('aria-checked', 'false');
    }

    if (toggle.id === 'always-gps-toggle' && newValue) {
        const aoToggle = document.getElementById('always-operational-toggle');
        if (aoToggle?.getAttribute('aria-checked') === 'true') {
            toggle.setAttribute('aria-checked', 'false');
            return;
        }
    }

    if (toggle.id === 'custom-copy-toggle') {
        const placeholderInfo = document.getElementById('placeholder-info');
        const saveBtn = document.getElementById('save-template-btn');
        const textarea = document.getElementById('custom-copy-template');
        if (placeholderInfo) {
            if (newValue) placeholderInfo.classList.remove('hidden');
            else placeholderInfo.classList.add('hidden');
        }
        if (saveBtn) {
            if (newValue) saveBtn.classList.remove('hidden');
            else saveBtn.classList.add('hidden');
        }
        if (textarea) {
            textarea.disabled = !newValue;
        }
    }

    // Tangani toggle cache maksimal
    if (toggle.id === 'cache-maksimal-toggle') {
        if (window.Cache) {
            window.Cache.setMode(newValue ? 'maksimal' : 'minimal');
        }
    }

    updateDisabledState();
    debouncedSave();
}

function updateDisabledState() {
    const ao = document.getElementById('always-operational-toggle')?.getAttribute('aria-checked') === 'true';
    const qo = document.getElementById('quick-order-toggle')?.getAttribute('aria-checked') === 'true';
    const vehicleEnabled = ao || qo;
    const roleAreaEnabled = qo && !ao;

    ['vehicle-mode', 'vehicle-cc', 'vehicle-fuel'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !vehicleEnabled;
        const container = el.closest('.input-field-container');
        if (container) {
            if (!vehicleEnabled) container.classList.add('disabled');
            else container.classList.remove('disabled');
        }
    });

    ['vehicle-role', 'vehicle-area'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !roleAreaEnabled;
        const container = el.closest('.input-field-container');
        if (container) {
            if (!roleAreaEnabled) container.classList.add('disabled');
            else container.classList.remove('disabled');
        }
    });

    const roleSelect = document.getElementById('vehicle-role');
    const isDriver = roleSelect?.value === 'Driver';
    const driverInfoEnabled = qo && !ao && isDriver;

    ['driver-name', 'driver-plate', 'driver-phone'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !driverInfoEnabled;
        const container = el.closest('.input-field-container');
        if (container) {
            if (!driverInfoEnabled) container.classList.add('disabled');
            else container.classList.remove('disabled');
        }
    });
}

function updateCCOptions() {
    const mode = document.getElementById('vehicle-mode')?.value || 'Mobil';
    const ccSelect = document.getElementById('vehicle-cc');
    if (!ccSelect) return;

    const ccList = validationOptions?.cc ? validationOptions.cc(mode) : 
        (mode === 'Mobil' ? ['1000cc','1500cc','2000cc'] : ['125cc','160cc','200cc']);
    const cur = ccSelect.value;
    ccSelect.innerHTML = ccList.map(o => `<option value="${o}" ${cur === o ? 'selected' : ''}>${o}</option>`).join('');
    updateFuelOptions();
}

function updateFuelOptions() {
    const cc = document.getElementById('vehicle-cc')?.value || '1000cc';
    const fuelSelect = document.getElementById('vehicle-fuel');
    if (!fuelSelect) return;

    const fuelList = validationOptions?.fuel ? validationOptions.fuel(cc) : ['Pertalite'];
    const cur = fuelSelect.value;
    fuelSelect.innerHTML = fuelList.map(o => `<option value="${o}" ${cur === o ? 'selected' : ''}>${o}</option>`).join('');
}

// =============================================================================
// 5. SAVE FUNCTIONS
// =============================================================================

function collectPreferences() {
    return {
        quickOrder: document.getElementById('quick-order-toggle')?.getAttribute('aria-checked') === 'true',
        alwaysGPS: document.getElementById('always-gps-toggle')?.getAttribute('aria-checked') === 'true',
        offlineOrder: document.getElementById('offline-order-toggle')?.getAttribute('aria-checked') === 'true',
        alwaysOperational: document.getElementById('always-operational-toggle')?.getAttribute('aria-checked') === 'true',
        largeText: document.getElementById('large-text-toggle')?.getAttribute('aria-checked') === 'true',
        hideSafetyReminder: document.getElementById('hide-safety-toggle')?.getAttribute('aria-checked') === 'true',
        cacheMaksimal: document.getElementById('cache-maksimal-toggle')?.getAttribute('aria-checked') === 'true',
        defaultVehicle: {
            mode: document.getElementById('vehicle-mode')?.value || 'Mobil',
            role: document.getElementById('vehicle-role')?.value || 'Driver',
            area: document.getElementById('vehicle-area')?.value || 'Jabodetabek',
            cc: document.getElementById('vehicle-cc')?.value || '1000cc',
            fuel: document.getElementById('vehicle-fuel')?.value || 'Pertalite'
        },
        driverInfo: {
            name: document.getElementById('driver-name')?.value.trim() || '',
            plate: document.getElementById('driver-plate')?.value.trim() || '',
            phone: document.getElementById('driver-phone')?.value.trim() || ''
        },
        customCopy: {
            enabled: document.getElementById('custom-copy-toggle')?.getAttribute('aria-checked') === 'true',
            template: document.getElementById('custom-copy-template')?.value || ''
        }
    };
}

function debouncedSave() {
    if (isDestroyed) return;
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
        const prefs = collectPreferences();
        PreferencesManager?.save(prefs);

        const msg = window._pendingSettingsMessage || 'Pengaturan tersimpan';
        ThemeManager?.showToast(msg, 'success', 1500);
        window._pendingSettingsMessage = null;

        saveDebounceTimer = null;
    }, 500);
}

function saveDriverInfo() {
    if (isDestroyed) return;
    const prefs = collectPreferences();
    const success = StorageManager?.saveDriverInfo(prefs.driverInfo);
    if (success) {
        ThemeManager?.showToast('Driver info tersimpan', 'success', 1500);
    }
}

function saveTemplate() {
    if (isSubmitting) return;
    isSubmitting = true;

    const textarea = document.getElementById('custom-copy-template');
    if (!textarea) { isSubmitting = false; return; }

    const val = textarea.value;
    const min = window.APP_CONFIG?.copyTemplateMinLength || 100;
    const max = window.APP_CONFIG?.copyTemplateMaxLength || 2000;

    if (val.length < min) {
        ThemeManager?.showToast(`Template minimal ${min} karakter`, 'warning');
        isSubmitting = false;
        return;
    }
    if (val.length > max) {
        ThemeManager?.showToast(`Template maksimal ${max} karakter`, 'warning');
        isSubmitting = false;
        return;
    }

    const prefs = collectPreferences();
    PreferencesManager?.save(prefs);
    ThemeManager?.showToast('Template disimpan', 'success');
    isSubmitting = false;
}

function saveEmergencyContactsData() {
    if (isDestroyed) return;
    const contacts = {
        kerabat: document.getElementById('emergency-kerabat')?.value.trim() || '',
        darurat: document.getElementById('emergency-darurat')?.value.trim() || '112',
        ambulance: document.getElementById('emergency-ambulance')?.value.trim() || '118',
        polisi: document.getElementById('emergency-polisi')?.value.trim() || '110'
    };
    const success = StorageManager?.saveEmergencyContacts(contacts);
    emergencyContacts = contacts;
    if (success) {
        ThemeManager?.showToast('Kontak darurat tersimpan', 'success', 1500);
    }
}

// =============================================================================
// 6. EXECUTE RESET
// =============================================================================

function executeReset() {
    if (isDestroyed) return;
    isSubmitting = true;

    PreferencesManager?.reset();
    StorageManager?.saveDriverInfo({ name: '', plate: '', phone: '' });
    StorageManager?.saveEmergencyContacts({
        kerabat: '',
        darurat: '112',
        ambulance: '118',
        polisi: '110'
    });

    if (!isDestroyed) {
        const content = document.getElementById('app-content');
        if (content) {
            loadPreferences();
            loadValidationOptions();
            loadEmergencyContacts();
            content.innerHTML = buildHTML();
            bindEvents();
            updateDisabledState();
        }
    }

    ThemeManager?.showToast('Pengaturan dikembalikan ke default', 'success');
    isSubmitting = false;
}

// =============================================================================
// 7. REGISTRASI POPUP & DRAWER
// =============================================================================

PopupManager.register(7, () => ({
    defaultOnly: true,
    onConfirm: () => executeReset()
}));

DrawerManager.register('settings', () => ({
    menuItems: null,
    onItemClick: (page) => {
        Router.navigateTo({ target: page, closeDrawer: true });
    }
}));

// =============================================================================
// 8. UPDATE HEADER & FOOTER
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
// 9. RENDER & DESTROY
// =============================================================================

async function render(params, context = {}) {
    const content = document.getElementById('app-content');
    if (!content) return;

    isDestroyed = false;
    isSubmitting = false;

    const direction = context.direction || 'forward';

    if (direction === 'forward') {
        loadValidationOptions();
        loadPreferences();
        loadEmergencyContacts();
    }

    content.innerHTML = buildHTML();
    bindEvents();
    updateDisabledState();
    updateHeader();
    updateFooter();

    window.log.info('[Settings ' + F_V + '] (1) Settings dirender');
}

function destroy() {
    isDestroyed = true;
    isSubmitting = false;
    if (saveDebounceTimer) { clearTimeout(saveDebounceTimer); saveDebounceTimer = null; }
    if (currentHeader) { HeaderManager.destroy(currentHeader); currentHeader = null; }
}

// =============================================================================
// 10. EKSPOR
// =============================================================================

export const PageSettings = {
    render,
    destroy
};

window.log.info('[Settings ' + F_V + '] (2) PageSettings dimuat (Cache Maksimal, Output API)');


// ================================ End Of File ================================