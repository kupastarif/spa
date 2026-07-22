/**
 * =================================================================================
 * FILE         : /js/helpers/format.js
 * FILE VERSION : 2.0.1-rev0
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
const F_V = '2.0.1-rev0';

// =============================================================================
// 1. KONSTANTA
// =============================================================================

const THOUSAND_SEP = '.';
const DECIMAL_SEP = ',';

// =============================================================================
// 2. BASE FORMATTER (TANPA SATUAN)
// =============================================================================

/**
 * Parse berbagai format string menjadi number.
 * Menangani format Indonesia (1.000,00) dan internasional (1,000.00).
 *
 * @param {string|number} value - Nilai yang akan di-parse
 * @returns {number} Nilai numerik, 0 jika gagal
 */
export function parseNumber(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;

    let str = String(value).trim();
    if (str === '') return 0;

    // Hapus prefix mata uang dan suffix satuan
    str = str.replace(/^Rp\s*/i, '');
    str = str.replace(/^IDR\s*/i, '');
    str = str.replace(/^\$\s*/i, '');
    str = str.replace(/\s*(km|mnt|menit|jam|hari|minggu|bulan|tahun|%|km\/jam|L)\s*$/i, '');

    const hasComma = str.indexOf(',') !== -1;
    const hasDot = str.indexOf('.') !== -1;

    if (hasComma && hasDot) {
        str = str.replace(/\./g, '').replace(',', '.');
    } else if (hasComma && !hasDot) {
        const parts = str.split(',');
        if (parts.length === 2 && parts[1].length === 3 && parts[0].indexOf(' ') === -1) {
            str = str.replace(',', '');
        } else if (parts.length === 2 && parts[1].length <= 2) {
            str = str.replace(',', '.');
        } else {
            str = str.replace(/,/g, '');
        }
    }

    str = str.replace(/[^\d.-]/g, '');

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

/**
 * Format number dengan berbagai opsi.
 * Guard Infinity/NaN, mengembalikan '0'.
 *
 * @param {*} value - Nilai yang akan diformat
 * @param {Object} options - Opsi format
 * @param {number} [options.decimals=0] - Jumlah desimal
 * @param {string} [options.thousandsSeparator='.'] - Separator ribuan
 * @param {string} [options.decimalSeparator=','] - Separator desimal
 * @param {string} [options.prefix=''] - Prefix
 * @param {string} [options.suffix=''] - Suffix
 * @returns {string} String terformat
 */
export function formatNumber(value, options = {}) {
    const {
        decimals = 0,
        thousandsSeparator = THOUSAND_SEP,
        decimalSeparator = DECIMAL_SEP,
        prefix = '',
        suffix = ''
    } = options;

    const num = parseNumber(value);

    if (!isFinite(num)) return prefix + '0' + suffix;

    const fixed = num.toFixed(decimals);
    const parts = fixed.split('.');

    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

    return prefix + parts.join(decimalSeparator) + suffix;
}

// =============================================================================
// 3. FORMATTER DENGAN SATUAN
// =============================================================================

/**
 * Format nilai ke Rupiah.
 *
 * @param {*} value - Nilai
 * @param {boolean} [withSymbol=true] - Tambahkan 'Rp '
 * @returns {string}
 */
export function formatRupiah(value, withSymbol = true) {
    const num = parseNumber(value);
    const isNegative = num < 0;
    const absNum = Math.abs(num);

    const formatted = formatNumber(absNum, {
        decimals: 0,
        prefix: withSymbol ? 'Rp ' : '',
        thousandsSeparator: THOUSAND_SEP,
        decimalSeparator: DECIMAL_SEP
    });

    return isNegative ? '-' + formatted : formatted;
}

/**
 * Format nilai ke Kilometer.
 *
 * @param {*} value - Nilai
 * @param {boolean} [withUnit=true] - Tambahkan ' km'
 * @param {number} [decimals=1] - Jumlah desimal
 * @returns {string}
 */
export function formatKm(value, withUnit = true, decimals = 1) {
    return formatNumber(value, {
        decimals,
        suffix: withUnit ? ' km' : '',
        thousandsSeparator: THOUSAND_SEP,
        decimalSeparator: DECIMAL_SEP
    });
}

/**
 * Format nilai ke Menit.
 *
 * @param {*} value - Nilai
 * @param {boolean} [withUnit=true] - Tambahkan ' mnt'
 * @returns {string}
 */
export function formatMenit(value, withUnit = true) {
    return formatNumber(value, {
        decimals: 0,
        suffix: withUnit ? ' mnt' : '',
        thousandsSeparator: THOUSAND_SEP,
        decimalSeparator: DECIMAL_SEP
    });
}

/**
 * Format menit ke jam:menit.
 *
 * @param {number} menit - Total menit
 * @returns {string}
 */
export function formatJamMenit(menit) {
    const m = parseNumber(menit);
    if (m < 60) return m + ' mnt';

    const jam = Math.floor(m / 60);
    const sisaMenit = m % 60;

    if (sisaMenit === 0) return jam + ' jam';
    return jam + ' jam ' + sisaMenit + ' mnt';
}

/**
 * Format menit ke format panjang (jam + menit).
 *
 * @param {*} value - Nilai dalam menit
 * @returns {string}
 */
export function formatMenitPanjang(value) {
    const menit = parseNumber(value);
    if (menit < 60) return menit + ' mnt';

    const jam = Math.floor(menit / 60);
    const sisaMenit = menit % 60;

    if (sisaMenit === 0) return jam + ' jam';
    return jam + ' jam ' + sisaMenit + ' mnt';
}

/**
 * Format nilai ke Persen.
 * Jika nilai dalam desimal (0-1), konversi ke persen.
 *
 * @param {*} value - Nilai
 * @param {boolean} [withSymbol=true] - Tambahkan '%'
 * @param {number} [decimals=0] - Jumlah desimal
 * @returns {string}
 */
export function formatPersen(value, withSymbol = true, decimals = 0) {
    let num = parseNumber(value);

    if (num <= 1 && num > 0 && String(value).indexOf('%') === -1) {
        num = num * 100;
    }

    return formatNumber(num, {
        decimals,
        suffix: withSymbol ? '%' : '',
        thousandsSeparator: THOUSAND_SEP,
        decimalSeparator: DECIMAL_SEP
    });
}

/**
 * Format nilai ke Km per Jam.
 *
 * @param {*} value - Nilai
 * @returns {string}
 */
export function formatKmPerJam(value) {
    return formatNumber(value, {
        decimals: 1,
        suffix: ' km/jam',
        thousandsSeparator: THOUSAND_SEP,
        decimalSeparator: DECIMAL_SEP
    });
}

/**
 * Format detik ke HH:MM:SS.
 *
 * @param {number} detik - Total detik
 * @returns {string}
 */
export function formatDurasi(detik) {
    const d = parseNumber(detik);
    const hours = Math.floor(d / 3600);
    const minutes = Math.floor((d % 3600) / 60);
    const seconds = d % 60;
    return padNumber(hours, 2) + ':' + padNumber(minutes, 2) + ':' + padNumber(seconds, 2);
}

/**
 * Format timestamp ke DD/MM/YYYY.
 *
 * @param {Date|number} timestamp
 * @returns {string}
 */
export function formatTanggal(timestamp) {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return padNumber(date.getDate(), 2) + '/' + padNumber(date.getMonth() + 1, 2) + '/' + date.getFullYear();
}

/**
 * Format timestamp ke HH:MM.
 *
 * @param {Date|number} timestamp
 * @returns {string}
 */
export function formatJam(timestamp) {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return padNumber(date.getHours(), 2) + ':' + padNumber(date.getMinutes(), 2);
}

/**
 * Format timestamp ke DD/MM/YYYY HH:MM.
 *
 * @param {Date|number} timestamp
 * @returns {string}
 */
export function formatTanggalJam(timestamp) {
    return formatTanggal(timestamp) + ' ' + formatJam(timestamp);
}

/**
 * Format timestamp ke waktu relatif (baru saja, 5 mnt lalu, ...).
 *
 * @param {Date|number} timestamp
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'baru saja';
    if (diffHour < 1) return diffMin + ' mnt lalu';
    if (diffDay < 1) return diffHour + ' jam lalu';
    if (diffDay === 1) return 'kemarin';
    if (diffDay < 7) return diffDay + ' hr lalu';
    if (diffDay < 30) return Math.floor(diffDay / 7) + ' mgg lalu';
    if (diffDay < 365) return Math.floor(diffDay / 30) + ' bln lalu';
    return Math.floor(diffDay / 365) + ' thn lalu';
}

// =============================================================================
// 4. KONVERSI WAKTU TRACKING
// =============================================================================

/**
 * Konversi detik ke menit dengan pembulatan ke atas (ceil).
 *
 * @param {number} detik - Total detik
 * @returns {number} Menit (dibulatkan ke atas)
 */
export function detikToMenitCeil(detik) {
    if (detik <= 0) return 0;
    return Math.ceil(detik / 60);
}

// =============================================================================
// 5. STATISTIK
// =============================================================================

/**
 * Menghitung statistik battle (Driver vs Aplikasi) dari history items.
 *
 * @param {Object[]} historyItems - Array history items
 * @returns {Object} { driver: {value, percent}, app: {value, percent}, totalMatch }
 */
export function calculateBattleStats(historyItems) {
    let driver = 0, app = 0;
    for (let i = 0; i < historyItems.length; i++) {
        const r = historyItems[i].result || {};
        driver += r.E981 || 0;
        app += r.E982 || 0;
    }
    const total = driver + app;
    return {
        driver: { value: driver, percent: total > 0 ? (driver / total) * 100 : 0 },
        app: { value: app, percent: total > 0 ? (app / total) * 100 : 0 },
        totalMatch: historyItems.length
    };
}

/**
 * Menghitung statistik history terperinci.
 *
 * @param {Object[]} filteredItems - Array history items yang sudah difilter
 * @returns {Object} Statistik dengan driver, app, bbm, kendaraan, passenger
 */
export function calculateHistoryStats(filteredItems) {
    let driver = 0, app = 0, bbm = 0, kendaraan = 0, passenger = 0;
    for (let i = 0; i < filteredItems.length; i++) {
        const r = filteredItems[i].result || {};
        driver += r.E981 || 0;
        app += r.E982 || 0;
        bbm += r.E911 || 0;
        kendaraan += r.E963 || 0;
        passenger += r.E697 || 0;
    }
    const total = driver + app + bbm + kendaraan;
    return {
        driver: { value: driver, percent: total > 0 ? (driver / total) * 100 : 0 },
        app: { value: app, percent: total > 0 ? (app / total) * 100 : 0 },
        bbm: { value: bbm, percent: total > 0 ? (bbm / total) * 100 : 0 },
        kendaraan: { value: kendaraan, percent: total > 0 ? (kendaraan / total) * 100 : 0 },
        passenger: { value: passenger, percent: 100 }
    };
}

/**
 * Menentukan pemenang trophy: 'driver', 'app', atau null.
 *
 * @param {Object} data - { driver: {value}, app: {value} }
 * @returns {string|null}
 */
export function getTrophyWinner(data) {
    const driver = data.driver?.value || 0;
    const app = data.app?.value || 0;

    if (driver > app) return 'driver';
    if (app > driver) return 'app';
    return null;
}

// =============================================================================
// 6. HELPER DASAR
// =============================================================================

/**
 * Escape HTML untuk mencegah XSS.
 *
 * @param {string} text - Teks yang akan di-escape
 * @returns {string}
 */
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Escape XML untuk mencegah invalid KML.
 *
 * @param {string} str - String yang akan di-escape
 * @returns {string}
 */
export function escapeXml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Pad number dengan leading zero.
 *
 * @param {number} num - Angka
 * @param {number} size - Panjang total
 * @returns {string}
 */
export function padNumber(num, size) {
    let s = String(num);
    while (s.length < size) s = '0' + s;
    return s;
}

/**
 * Kapitalisasi huruf pertama.
 *
 * @param {string} str - String
 * @returns {string}
 */
export function capitalize(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Potong string jika melebihi panjang maksimum.
 *
 * @param {string} str - String
 * @param {number} maxLength - Panjang maksimum
 * @returns {string}
 */
export function truncate(str, maxLength) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

// =============================================================================
// 7. LABEL AREA
// =============================================================================

/**
 * Mendapatkan label tampilan untuk area.
 *
 * @param {string} area - Kode area
 * @returns {string}
 */
export function getAreaLabel(area) {
    const labels = {
        'Jabodetabek': 'Jabodetabek',
        'SumatraJawa': 'Sumatra & Jawa',
        'TimurIndonesia': 'Timur Indonesia'
    };
    return labels[area] || area;
}

// ================================ End Of File ================================