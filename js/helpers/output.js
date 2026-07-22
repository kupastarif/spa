/**
 * =================================================================================
 * FILE         : /js/helpers/output.js
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

import {
    formatRupiah, formatKm, formatMenit, formatPersen,
    getAreaLabel, escapeXml
} from './format.js';

// =============================================================================
// 0. IKON LOKAL (tidak lagi bergantung pada texts.js)
// =============================================================================

const ICON = {
    UP_ARROW: '🔺',
    DOWN_ARROW: '🔻',
    SKULL: '☠️',
    WARNING: '⚠'
};

// =============================================================================
// 1. WRAPPER ENGINE STATIS (Valid, Fare, Cost, DATA)
// =============================================================================

/**
 * Mendapatkan nilai default seluruh input dari Engine.Valid.
 * @returns {Object} objek dengan properti E10..E104
 */
export function getDefaultValues() {
    if (window.Engine?.Valid?.getDefaultValues) {
        return window.Engine.Valid.getDefaultValues();
    }
    // Fallback aman
    return {
        E10: 'Mobil', E12: 'Driver', E20: 'Jabodetabek', E22: '1000cc',
        E24: 'Pertalite', E26: 'manual', E28: 'individu',
        E36: 'online', E38: 'wajar', E40: 0.4, E46: 'Standar',
        E54: null, E56: null, E58: null, E60: null,
        E68: null, E70: null, E78: null, E80: null,
        E82: null, E84: null, E92: null, E100: null, E102: null, E104: null
    };
}

/**
 * Mendapatkan opsi dropdown untuk cell tertentu.
 */
export function getDropdownOptions(cell, context) {
    if (window.Engine?.Valid?.getDropdownOptions) {
        return window.Engine.Valid.getDropdownOptions(cell, context);
    }
    return [];
}

/**
 * Mendapatkan opsi layanan (E46) berdasarkan mode dan cc.
 */
export function getServiceOptions(mode, cc) {
    if (window.Engine?.Valid?.getServiceOptions) {
        return window.Engine.Valid.getServiceOptions(mode, cc);
    }
    // Fallback
    if (mode === 'Motor') return ['Hemat', 'Standar', 'Prioritas'];
    return ['Hemat', 'Standar', 'XL', 'Prioritas', 'Premium', 'Premium XL'];
}

/**
 * Mendapatkan range validasi untuk cell tertentu.
 */
export function getValidationRange(cell, context) {
    if (window.Engine?.Valid?.getValidationRange) {
        return window.Engine.Valid.getValidationRange(cell, context);
    }
    return { min: 0, max: Number.MAX_SAFE_INTEGER, default: 0 };
}

/**
 * Memvalidasi satu cell. Menggunakan Engine.Valid.validateCell.
 */
export function validateCell(cell, value, context) {
    if (window.Engine?.Valid?.validateCell) {
        return window.Engine.Valid.validateCell(cell, value, context);
    }
    return value;
}

/**
 * Mendapatkan konstanta dari DATA.
 * @param {string} cell - nama sel, contoh 'E116'
 * @returns {*}
 */
export function getConstant(cell) {
    if (window.DATA?.getConst) {
        return window.DATA.getConst(cell);
    }
    return undefined;
}

/**
 * Mendapatkan nilai kesejahteraan aplikasi (E189).
 */
export function getWelfareCommission() {
    return (window.DATA?.E189) ?? 0.05;
}

/**
 * Mendapatkan potongan aplikasi (E190).
 */
export function getAppCut() {
    return (window.DATA?.E190) ?? 0.15;
}

/**
 * Mendapatkan target pendapatan driver minimum (E663).
 * Memerlukan objek valid untuk menghitung, atau fallback berdasarkan mode.
 * @param {Object|string} validOrMode - objek valid atau string mode ('Mobil'/'Motor')
 * @returns {number}
 */
export function getTargetDriver(validOrMode) {
    if (window.Engine?.Fare?.E663) {
        // Jika objek valid diberikan
        if (typeof validOrMode === 'object') {
            return window.Engine.Fare.E663(validOrMode);
        }
        // Fallback: buat objek minimal
        const mode = validOrMode || 'Mobil';
        return window.Engine.Fare.E663({ E10: mode });
    }
    // Fallback keras
    const mode = typeof validOrMode === 'object' ? validOrMode.E10 : validOrMode;
    return mode === 'Motor' ? 15000 : 20000;
}

/**
 * Mendapatkan jarak penjemputan maksimal gratis.
 */
export function getMaxPickupDistance() {
    return (window.Engine?.getMaxPickupDistance) ? window.Engine.getMaxPickupDistance() : 2;
}

/**
 * Mendapatkan waktu penjemputan maksimal gratis (menit).
 */
export function getMaxPickupTime() {
    return (window.Engine?.getMaxPickupTime) ? window.Engine.getMaxPickupTime() : 15;
}

// =============================================================================
// 1b. WRAPPER DATA UNTUK MAINTENANCE
// =============================================================================

/**
 * Mendapatkan item perawatan dari DATA.
 * @param {string} mode - 'Mobil' atau 'Motor'
 * @param {string} cc
 * @returns {Array<{dcell: number, ecell: number, label: string}>}
 */
export function getMaintenanceItems(mode, cc) {
    if (window.DATA?.getMaintenanceItems) {
        return window.DATA.getMaintenanceItems(mode, cc);
    }
    return [];
}

/**
 * Mendapatkan item pajak dari DATA.
 * @param {string} mode - 'Mobil' atau 'Motor'
 * @param {string} cc
 * @returns {Array<{dcell: number, ecell: number, label: string}>}
 */
export function getTaxItems(mode, cc) {
    if (window.DATA?.getTaxItems) {
        return window.DATA.getTaxItems(mode, cc);
    }
    return [];
}

/**
 * Mendapatkan item atribut dari DATA.
 * @param {string} mode - 'Mobil' atau 'Motor'
 * @returns {Array<{dcell: number, ecell: number, label: string}>}
 */
export function getAttributeItems(mode) {
    if (window.DATA?.getAttributeItems) {
        return window.DATA.getAttributeItems(mode);
    }
    return [];
}

// =============================================================================
// 2. BADGE & WARNA
// =============================================================================

export function getTariffBadge(est) {
    if (!est || est.E713 === null || est.E713 === undefined) return null;

    const E713 = est.E713;
    const mode = est.E10 || 'Mobil';
    let E660 = est.E660;
    if (E660 === null || E660 === undefined || E660 === 0) {
        E660 = mode === 'Mobil' ? 3500 : 2600;
    }
    const percentage = E660 > 0 ? ((E713 - E660) / E660) * 100 : 0;
    const icon = percentage > 0 ? ICON.UP_ARROW : ICON.DOWN_ARROW;

    if (percentage > 0) {
        return {
            text: icon + ' ' + Math.round(Math.abs(percentage)) + '%',
            class: 'badge-success',
            blink: ''
        };
    }
    return {
        text: icon + ' ' + Math.round(Math.abs(percentage)) + '%',
        class: 'badge-danger',
        blink: 'blink-medium'
    };
}

export function getAppBadge(est) {
    if (!est || est.E971 === null || est.E971 === undefined) return null;

    const E971 = est.E971;
    let E657 = est.E657;
    if (E657 === null || E657 === undefined) {
        E657 = getWelfareCommission() + getAppCut();
    }

    const percentage = E971 * 100;
    const category = E971 < E657 ? 'down' : 'up';
    const icon = category === 'down' ? ICON.DOWN_ARROW : ICON.UP_ARROW;
    const blink = (category === 'up') ? 'blink-slow' : '';

    if (category === 'down') {
        return { text: icon + ' ' + Math.round(percentage) + '%', class: 'badge-success', blink };
    }
    return { text: icon + ' ' + Math.round(percentage) + '%', class: 'badge-danger', blink };
}

export function getDriverOrderBadge(est) {
    if (!est || est.E969 === null || est.E969 === undefined) return null;

    const E969 = est.E969;
    const E970 = est.E970 || 0;
    const mode = est.E10 || 'Mobil';
    const E663 = est.E663 || getTargetDriver(mode);

    let category;
    if (E969 < 0) {
        category = 'wkwkwk';
    } else if (E970 >= E969 || E969 < E663) {
        category = 'warning';
    } else {
        return null;
    }

    const UI_MAP = {
        'wkwkwk': { icon: ICON.SKULL, class: 'badge-icon-danger', blink: 'blink-fast' },
        'warning': { icon: ICON.WARNING, class: 'badge-icon-warning', blink: 'blink-slow' }
    };
    return UI_MAP[category] || null;
}

export function getDriverColorAndBlink(E981, vehicleMode = 'Mobil') {
    const E663 = getTargetDriver(vehicleMode);

    if (E981 < 0) {
        return { color: 'driver-minus', blink: 'blink-500ms', soundInterval: 500, category: 'minus' };
    }
    if (E981 < E663 * 0.5) {
        return { color: 'driver-kritis', blink: 'blink-1000ms', soundInterval: 1000, category: 'kritis' };
    }
    if (E981 < E663 * 0.75) {
        return { color: 'driver-rendah', blink: 'blink-2000ms', soundInterval: 6000, category: 'rendah' };
    }
    if (E981 < E663) {
        return { color: 'driver-cukup', blink: 'blink-4000ms', soundInterval: null, category: 'cukup' };
    }
    if (E981 < E663 * 2) {
        return { color: 'driver-normal', blink: '', soundInterval: null, category: 'normal' };
    }
    return { color: 'driver-bagus', blink: '', soundInterval: null, category: 'bagus' };
}

// =============================================================================
// 3. COPY & TEMPLATE
// =============================================================================

export function formatCopyEstimate(est, mode, role) {
    if (!est) return '';

    const maxJemputKm = getMaxPickupDistance();
    const maxJemputMnt = getMaxPickupTime();
    const maxAntarKm = est.E707 || 0;
    const maxAntarMnt = est.E715 || 0;
    const tarifKm = est.E713 || 0;
    const tarifMnt = est.E714 || 0;
    const pendapatanAplikasi = est.E970 || 0;
    const omsetDriver = est.E700 || 0;
    const pembayaranPenumpang = est.E697 || 0;
    const pendapatanDriver = est.E969 || 0;
    const bbm = est.E903 || 0;
    const kendaraan = est.E949 || 0;

    let result = '';
    if (mode === 'online') {
        result += 'ORDER APLIKASI:\n';
        result += `Max Jemput: ${formatKm(maxJemputKm, false)} km, ${formatMenit(maxJemputMnt, false)} mnt\n`;
        result += `Max Antar: ${formatKm(maxAntarKm, false)} km, ${formatMenit(maxAntarMnt, false)} mnt\n`;
        result += `Tarif: ${formatRupiah(tarifKm, false)}/km, ${formatRupiah(tarifMnt, false)}/mnt\n\n`;
        result += `Pendapatan Aplikasi: ${formatRupiah(pendapatanAplikasi)}\n`;
        if (role === 'Penumpang') {
            result += `Omset Driver: ${formatRupiah(omsetDriver)}\n`;
        } else {
            result += `Pembayaran Penumpang: ${formatRupiah(pembayaranPenumpang)}\n`;
        }
        result += `Pendapatan Driver: ${formatRupiah(pendapatanDriver)}\n\n`;
        result += `BBM: ${formatRupiah(bbm)}\n`;
        result += `Kendaraan: ${formatRupiah(kendaraan)}\n\n`;
        result += 'Selisih jarak dan waktu perjalanan pada Order Aplikasi akan dijumlahkan di akhir perjalanan.';
    } else {
        result += 'ORDER:\n';
        result += `Max Jemput: ${formatKm(maxJemputKm, false)} km, ${formatMenit(maxJemputMnt, false)} mnt\n`;
        result += `Max Antar: ${formatKm(maxAntarKm, false)} km, ${formatMenit(maxAntarMnt, false)} mnt\n`;
        result += `Tarif: ${formatRupiah(tarifKm, false)}/km, ${formatRupiah(tarifMnt, false)}/mnt\n\n`;
        result += `Omset Driver: ${formatRupiah(omsetDriver)}\n`;
        result += `Pembayaran Penumpang: ${formatRupiah(pembayaranPenumpang)}\n`;
        result += `Pendapatan Driver: ${formatRupiah(pendapatanDriver)}\n\n`;
        result += `BBM: ${formatRupiah(bbm)}\n`;
        result += `Kendaraan: ${formatRupiah(kendaraan)}\n\n`;
        result += 'Selisih jarak dan waktu perjalanan akan dijumlahkan di akhir perjalanan.';
    }
    return result;
}

export function formatCopyHasil(result, mode, role) {
    const r = result || {};
    if (mode === 'online' || mode === 'offline') {
        let text = '';
        text += `Penjemputan: ${formatKm(r.E78 || 0, false)} km, ${formatMenit(r.E80 || 0, false)} mnt\n`;
        text += `Pengantaran: ${formatKm(r.E82 || 0, false)} km, ${formatMenit(r.E84 || 0, false)} mnt\n\n`;
        //if (r.E746 > 0) text += `Tagihan: ${formatRupiah(r.E746)}\n`;
        if (mode === 'offline' && (r.E744 > 0)) text += `Biaya Tambahan: ${formatRupiah(r.E744)}\n`;
        text += '\n';
        text += `BBM: ${formatRupiah(r.E911 || 0)}\n`;
        text += `Kendaraan: ${formatRupiah((r.E963 || 0) - (r.E807 || 0))}\n\n`;
        text += `Dibayarkan Penumpang: ${formatRupiah(r.E697 || 0)}\n`;
        text += `Pendapatan Driver: ${formatRupiah(r.E981 || 0)}\n`;
        if (mode === 'online') text += `Pendapatan Aplikasi: ${formatRupiah(r.E982 || 0)}\n`;
        text += '\n';
        if (r.E746 > 0) text += `Selisih Order Ditagihkan: ${formatRupiah(r.E746)}\n`;
        return text;
    } else if (mode === 'operational') {
        let text = 'JARAK & WAKTU: ' + formatKm(r.E752 || 0, false) + ' km, ' + formatMenit(r.E753 || 0, false) + ' mnt\n';
        text += 'BIAYA OPERASIONAL:\n';
        text += '  BBM: ' + formatRupiah(r.E911 || 0) + '\n';
        text += '  Perawatan: ' + formatRupiah(r.E935 || 0) + '\n';
        text += '  Penyusutan: ' + formatRupiah(r.E825 || 0) + '\n';
        text += '  Pajak: ' + formatRupiah(r.E841 || 0) + '\n';
        text += 'TOTAL: ' + formatRupiah((r.E960 || 0) - (r.E807 || 0));
        if (r.shareCount > 1) {
            text += '\nShare Cost (' + r.shareCount + ' orang): ' + formatRupiah(r.shareResult || (r.E960 - (r.E807 || 0)) / r.shareCount);
        }
        if (r.setLimit >= 1000) {
            const limitVal = r.limitResult || (r.setLimit - (r.E960 - (r.E807 || 0)));
            text += '\nSet Limit (' + formatRupiah(r.setLimit) + '): Sisa ' + formatRupiah(limitVal);
        }
        return text;
    }
    return '';
}

const COPY_PLACEHOLDERS = [
    '{jarakOrder}', '{waktuOrder}', '{tarifPerKm}', '{tarifPerMenit}',
    '{omsetDriver}', '{pendapatanAplikasi}', '{persenAplikasi}',
    '{pembayaranPenumpang}', '{layanan}', '{kendaraan}', '{cc}', '{area}',
    '{maxJarakJemput}', '{maxWaktuJemput}', '{namaSitus}', '{linkSitus}'
];

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

export function getDefaultCopyTemplate() { return DEFAULT_COPY_TEMPLATE; }
export function getCopyPlaceholders() { return [...COPY_PLACEHOLDERS]; }

export function validateCopyTemplate(template) {
    if (!template || typeof template !== 'string') return { valid: false, error: 'Template tidak valid' };
    const min = window.APP_CONFIG?.copyTemplateMinLength || 100;
    const max = window.APP_CONFIG?.copyTemplateMaxLength || 2000;
    if (template.length < min) return { valid: false, error: `Template minimal ${min} karakter` };
    if (template.length > max) return { valid: false, error: `Template maksimal ${max} karakter` };
    return { valid: true, error: null };
}

export function parseCopyTemplate(template, data) {
    if (!template) template = DEFAULT_COPY_TEMPLATE;
    let result = template;
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            const placeholder = '{' + key + '}';
            const value = data[key] !== undefined && data[key] !== null ? data[key] : '';
            result = result.replace(new RegExp(placeholder, 'g'), value);
        }
    }
    return result;
}

export function prepareCopyTemplateData(estimateResult, vehicleData) {
    const r = estimateResult || {};
    const v = vehicleData || {};
    const maxPickupDistance = getMaxPickupDistance();
    const maxPickupTime = getMaxPickupTime();
    const namaSitus = window.APP_CONFIG?.siteDisplay || 'Kupas⚡Tarif';
    const linkSitus = window.APP_CONFIG?.landingLink || 'linktr.ee/KUPASTARIF';
    return {
        jarakOrder: formatKm(r.E707, false),
        waktuOrder: formatMenit(r.E715, false),
        tarifPerKm: formatRupiah(r.E713, false),
        tarifPerMenit: formatRupiah(r.E714, false),
        omsetDriver: formatRupiah(r.E700, false),
        pendapatanAplikasi: formatRupiah(r.E970, false),
        persenAplikasi: formatPersen(r.E971, false),
        pembayaranPenumpang: formatRupiah(r.E697, false),
        layanan: v.E46 || 'Standar',
        kendaraan: v.E10 || 'Mobil',
        cc: v.E22 || '1000cc',
        area: getAreaLabel(v.E20 || 'Jabodetabek'),
        maxJarakJemput: formatKm(maxPickupDistance, false),
        maxWaktuJemput: formatMenit(maxPickupTime, false),
        namaSitus: namaSitus,
        linkSitus: linkSitus
    };
}

// =============================================================================
// 4. RUTE & KML (encode/decode, generate/parse)
// =============================================================================

export function encodeRouteData(compactData, refId, payment = 0, bill = 0, driverInfo = {}) {
    // Ambil versi dari SSOT (index.html), fallback ke '2.0.1' jika tidak ada
    const version = window.APP_CONFIG?.version || '2.0.1';
    
    const metadata = {
        v: version,   // ✅ Mengikuti SSOT
        u: refId,
        d: { nm: driverInfo.name || '', pl: driverInfo.plate || '', ph: driverInfo.phone || '' },
        S: compactData.startTime || '',
        P: compactData.pickupTimeStr || '',
        D: compactData.dropoffTimeStr || '',
        p: compactData.pickupDistance || 0,
        pt: compactData.pickupTime || 0,
        dd: compactData.dropoffDistance || 0,
        dt: compactData.dropoffTime || 0,
        c: compactData.pauseCount || 0,
        ct: Math.floor(compactData.pauseTime || 0),
        j: compactData.jumpCount || 0,
        jt: compactData.jumpTotal || 0,
        m: payment + '|' + bill,
        tzOffset: compactData.timezoneOffset || 7,
        tzName: compactData.timezoneName || 'WIB',
        sc: compactData.shareCount || 1,
        sl: compactData.setLimit || 0,
        sr: compactData.shareResult || 0,
        lr: compactData.limitResult || 0
    };
    const base64 = btoa(JSON.stringify(metadata));
    const positionsRaw = '0|' + (compactData.positionsPickup || '') + '|1|' + (compactData.positionsDropoff || '');
    const landingLink = window.APP_CONFIG?.landingLink || 'linktr.ee/KUPASTARIF';
    return '⚡KT ' + landingLink + '|' + base64 + '|P|' + positionsRaw;
}

export function decodeRouteData(text) {
    if (!text || typeof text !== 'string') throw new Error('Data kosong');
    const trimmed = text.trim();
    if (!trimmed.startsWith('⚡KT')) throw new Error('Format data tidak dikenal. Gunakan data dari Copy Rute.');
    const content = trimmed.substring(4).trim();
    const pipeIdx = content.indexOf('|');
    if (pipeIdx === -1) throw new Error('Format tidak valid');
    const remaining = content.substring(pipeIdx + 1);
    const pIdx = remaining.indexOf('|P|');
    if (pIdx === -1) throw new Error('Format tidak valid');
    const base64 = remaining.substring(0, pIdx);
    const positionsRaw = remaining.substring(pIdx + 3);
    let metadata;
    try { metadata = JSON.parse(atob(base64)); } catch (e) { throw new Error('Gagal mendekode metadata'); }
    const posParts = positionsRaw.split('|');
    let positionsPickup = '', positionsDropoff = '';
    for (let i = 0; i < posParts.length; i += 2) {
        if (posParts[i] === '0') positionsPickup = posParts[i + 1] || '';
        else if (posParts[i] === '1') positionsDropoff = posParts[i + 1] || '';
    }
    let payment = 0, bill = 0;
    if (metadata.m) {
        const parts = metadata.m.split('|');
        payment = parseInt(parts[0]) || 0;
        bill = parseInt(parts[1]) || 0;
    }
    return {
        pickupDistance: metadata.p || 0,
        pickupTime: metadata.pt || 0,
        dropoffDistance: metadata.dd || 0,
        dropoffTime: metadata.dt || 0,
        pauseCount: metadata.c || 0,
        pauseTime: metadata.ct || 0,
        jumpCount: metadata.j || 0,
        jumpTotal: metadata.jt || 0,
        positionsPickup, positionsDropoff,
        startTime: metadata.S || '',
        pickupTimeStr: metadata.P || '',
        dropoffTimeStr: metadata.D || '',
        payment: payment + '|' + bill,
        refId: metadata.u || '',
        driverInfo: { name: metadata.d?.nm || '', plate: metadata.d?.pl || '', phone: metadata.d?.ph || '' },
        timezoneOffset: metadata.tzOffset || 7,
        timezoneName: metadata.tzName || 'WIB',
        shareCount: metadata.sc || 1,
        setLimit: metadata.sl || 0,
        shareResult: metadata.sr || 0,
        limitResult: metadata.lr || 0
    };
}

export function generateKML(trackingData, refId, driverInfo = {}) {
    const payment = trackingData.payment ? parseInt(trackingData.payment.split('|')[0]) : 0;
    const bill = trackingData.payment ? parseInt(trackingData.payment.split('|')[1]) || 0 : 0;
    const metadataString = encodeRouteData(trackingData, refId, payment, bill, driverInfo);
    const parseCoords = (str) => {
        if (!str) return '';
        return str.split(';').filter(p => p.trim()).map(p => {
            const parts = p.split(',');
            return `${parts[1]},${parts[0]},0`;
        }).join(' ');
    };
    const dn = escapeXml(driverInfo.name || '');
    const dp = escapeXml(driverInfo.plate || '');
    const dh = escapeXml(driverInfo.phone || '');
    const ds = escapeXml(trackingData.startTime || '');
    const de = escapeXml(trackingData.dropoffTimeStr || '');
    const dr = escapeXml(refId || '');
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>KupasTarif - ${dr}</name>
    <description>
Driver: ${dn}
Plat: ${dp}
Telepon: ${dh}
Mulai: ${ds}
Selesai: ${de}
Penjemputan: ${trackingData.pickupDistance || 0} km, ${trackingData.pickupTime || 0} mnt
Pengantaran: ${trackingData.dropoffDistance || 0} km, ${trackingData.dropoffTime || 0} mnt

${metadataString}
    </description>
    <Style id="ps"><LineStyle><color>ff10b981</color><width>4</width></LineStyle></Style>
    <Style id="ds"><LineStyle><color>ff3b82f6</color><width>4</width></LineStyle></Style>
    ${parseCoords(trackingData.positionsPickup) ? `<Placemark><name>Penjemputan</name><styleUrl>#ps</styleUrl><LineString><coordinates>${parseCoords(trackingData.positionsPickup)}</coordinates></LineString></Placemark>` : ''}
    ${parseCoords(trackingData.positionsDropoff) ? `<Placemark><name>Pengantaran</name><styleUrl>#ds</styleUrl><LineString><coordinates>${parseCoords(trackingData.positionsDropoff)}</coordinates></LineString></Placemark>` : ''}
  </Document>
</kml>`;
}

export function parseKML(kmlText) {
    if (!kmlText || typeof kmlText !== 'string') throw new Error('Data KML kosong');
    const descMatch = kmlText.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
    if (descMatch) {
        const description = descMatch[1].trim();
        const ktMatch = description.match(/⚡KT\s+\S+\|[A-Za-z0-9+/=]+\|P\|[^\n]*/);
        if (ktMatch) {
            try { return decodeRouteData(ktMatch[0]); } catch (e) {}
        }
    }
    // Fallback: parse koordinat
    const coordMatches = kmlText.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi);
    if (!coordMatches || coordMatches.length === 0) throw new Error('Format KML tidak valid');
    let positionsPickup = '', positionsDropoff = '';
    const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
    let placemarkMatch;
    while ((placemarkMatch = placemarkRegex.exec(kmlText)) !== null) {
        const placemark = placemarkMatch[1];
        const nameMatch = placemark.match(/<name[^>]*>([\s\S]*?)<\/name>/i);
        const coordMatch = placemark.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
        if (coordMatch) {
            const coords = coordMatch[1].trim().split(/\s+/).filter(c => c.trim()).map(c => {
                const parts = c.split(',');
                return `${parts[1]},${parts[0]}`;
            }).join(';');
            const name = nameMatch ? nameMatch[1].trim().toLowerCase() : '';
            if (name.includes('penjemputan') || name.includes('pickup')) positionsPickup = coords;
            else if (name.includes('pengantaran') || name.includes('dropoff')) positionsDropoff = coords;
            else if (positionsDropoff) positionsDropoff += ';' + coords;
            else positionsDropoff = coords;
        }
    }
    if (!positionsPickup && !positionsDropoff) {
        const allCoords = [];
        const coordRegex = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi;
        let coordMatch;
        while ((coordMatch = coordRegex.exec(kmlText)) !== null) {
            const coords = coordMatch[1].trim().split(/\s+/).filter(c => c.trim()).map(c => {
                const parts = c.split(',');
                return `${parts[1]},${parts[0]}`;
            }).join(';');
            allCoords.push(coords);
        }
        positionsDropoff = allCoords.join(';');
    }
    return {
        pickupDistance: 0, pickupTime: 0, dropoffDistance: 0, dropoffTime: 0,
        pauseCount: 0, pauseTime: 0, jumpCount: 0, jumpTotal: 0,
        positionsPickup, positionsDropoff,
        startTime: '', pickupTimeStr: '', dropoffTimeStr: '',
        payment: '0|0', refId: '', driverInfo: { name: '', plate: '', phone: '' }
    };
}

// =============================================================================
// 5. PERHITUNGAN MAINTENANCE (dari DATA)
// =============================================================================

/**
 * Menghitung progress maintenance untuk sekumpulan item.
 * @param {Array<{dcell:number, ecell:number, label:string}>} items
 * @param {number} totalDistance - total jarak (km)
 * @param {number} totalTime - total waktu (menit)
 * @param {Object} [cycleData={}] - data siklus servis
 * @param {string|null} [forceIntervalType=null] - paksa tipe interval: 'km' atau 'day'
 * @returns {Array} item dengan properti progress
 */
export function calculateMaintenanceProgress(items, totalDistance, totalTime, cycleData = {}, forceIntervalType = null) {
    if (!Array.isArray(items)) return [];
    const totalDays = totalTime / 1440;
    return items.map(item => {
        const dcell = item.dcell || 0;
        const ecell = item.ecell || 1;
        const itemName = item.label || 'item';
        const cycle = cycleData[itemName] || { cycleCount: 0 };
        const cycleCount = cycle.cycleCount || 0;

        let intervalIsKm;
        if (forceIntervalType === 'km') {
            intervalIsKm = true;
        } else if (forceIntervalType === 'day') {
            intervalIsKm = false;
        } else {
            // logika fallback (diperbaiki)
            if (ecell >= 2) {
                intervalIsKm = ecell < 100;
            } else {
                intervalIsKm = true;
            }
        }

        let effective;
        if (intervalIsKm) {
            effective = Math.max(0, totalDistance - (cycleCount * ecell));
        } else {
            effective = Math.max(0, totalDays - (cycleCount * ecell));
        }
        const progress = effective / ecell;
        const progressPercent = Math.min(progress * 100, 100);
        const accumulatedCost = progress * dcell;
        const remaining = Math.max(dcell - accumulatedCost, 0);
        const isDue = progress >= 1;
        const missingRounds = Math.max(0, Math.floor(progress) - 1);

        return {
            ...item,
            cycleCount,
            progress: Math.min(progress, 1),
            progressPercent,
            accumulatedCost,
            remaining,
            isDue,
            missingRounds,
            effectiveDistance: intervalIsKm ? effective : undefined,
            effectiveDays: !intervalIsKm ? effective : undefined,
            intervalType: intervalIsKm ? 'km' : 'day'
        };
    });
}

/**
 * Menghitung ringkasan depresiasi kendaraan.
 * @param {Object} vehicleData - { E10, E22 }
 * @param {number} accumulatedDepreciation - total depresiasi yang sudah terakumulasi (dari history)
 * @returns {Object} ringkasan
 */
export function calculateDepreciationSummary(vehicleData, accumulatedDepreciation) {
    const mode = vehicleData.E10 || 'Mobil';
    const cc = vehicleData.E22 || '1000cc';
    const dep = window.DATA?.getDepreciation ? window.DATA.getDepreciation(mode, cc) : null;
    if (!dep) {
        return { hargaBeli: 0, hargaJual: 0, totalDepreciationCost: 0, umurTahun: 0, accumulatedDepreciation: 0, progressPercent: 0, remainingValue: 0 };
    }
    const totalCost = dep.beli - dep.jual;
    const progress = totalCost > 0 ? accumulatedDepreciation / totalCost : 0;
    return {
        hargaBeli: dep.beli,
        hargaJual: dep.jual,
        totalDepreciationCost: totalCost,
        umurTahun: dep.umur,
        accumulatedDepreciation,
        progressPercent: Math.min(progress * 100, 100),
        remainingValue: Math.max(dep.jual + (totalCost - accumulatedDepreciation), dep.jual)
    };
}

window.log.info('[Output ' + F_V + '] dimuat (Engine wrapper, badge, copy, route, maintenance)');


// ================================ End Of File ================================