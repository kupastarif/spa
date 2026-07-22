/**
 * =================================================================================
 * FILE         : /js/core/storage.js
 * FILE VERSION : 2.0.1-rev0
 * APP VERSION  : 2.0.1
 * DATE         : 1 Juli 2026
 * @author      : gk
 *
 * CHANGELOG  :

 * =================================================================================
 */

'use strict';

// ==================== VERSI FILE ====================
const F_V = '2.0.1-rev0';

// =============================================================================
// 1. KONSTANTA STORAGE KEYS
// =============================================================================

const STORAGE_KEYS = {
    HISTORY: 'kt_history',
    PREFERENCES: 'kt_prefs',
    THEME: 'kt_theme',
    DRIVER_INFO: 'kt_driver',
    MAINT_CYCLES: 'kt_maint_cycles',
    EMERGENCY_CONTACTS: 'kt_emergency'
};

const CONFIG = window.APP_CONFIG || {
    maxHistoryItems: 50,
    historyWarningThreshold: 45,
    storageQuotaWarningMB: 4,
    defaultTheme: 'light'
};

// =============================================================================
// 2. FUNGSI ENKRIPSI / DEKRIPSI DRIVER INFO
// =============================================================================

function generateSalt(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let salt = '';
    for (let i = 0; i < length; i++) {
        salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
}

function splitString(str) {
    if (!str) return ['', ''];
    const mid = Math.floor(str.length / 2);
    return [str.substring(0, mid), str.substring(mid)];
}

function encryptDriverInfo(info) {
    if (!info || (!info.name && !info.plate && !info.phone)) return '';

    const [n1, n2] = splitString(info.name || '');
    const [p1, p2] = splitString(info.plate || '');
    const [h1, h2] = splitString(info.phone || '');

    const parts = [
        'XK1', p2, h1, generateSalt(5), n2,
        'ZK2', n1, p1, 'ZK1', generateSalt(5), h2, 'XK2'
    ];

    let encoded = parts.join('|');
    for (let i = 0; i < 3; i++) {
        encoded = btoa(encoded);
    }
    return encoded;
}

function decryptDriverInfo(encrypted) {
    if (!encrypted || typeof encrypted !== 'string' || encrypted.trim() === '') {
        return { name: '', plate: '', phone: '' };
    }

    try {
        let decoded = encrypted;
        for (let i = 0; i < 3; i++) {
            decoded = atob(decoded);
        }

        const parts = decoded.split('|');

        return {
            name: ((parts[6] || '') + (parts[4] || '')).trim(),
            plate: ((parts[7] || '') + (parts[1] || '')).trim(),
            phone: ((parts[2] || '') + (parts[10] || '')).trim()
        };
    } catch (error) {
        window.log.error('[Storage ' + F_V + '] (1) Gagal mendekripsi driver info:', error);
        return { name: '', plate: '', phone: '' };
    }
}

// =============================================================================
// 3. FUNGSI ENKRIPSI / DEKRIPSI STRING (untuk kontak darurat)
// =============================================================================

function encryptString(plainText) {
    if (!plainText) return '';
    let encoded = plainText;
    for (let i = 0; i < 3; i++) {
        encoded = btoa(encoded);
    }
    return encoded;
}

function decryptString(encrypted) {
    if (!encrypted || typeof encrypted !== 'string' || encrypted.trim() === '') {
        return '';
    }
    try {
        let decoded = encrypted;
        for (let i = 0; i < 3; i++) {
            decoded = atob(decoded);
        }
        return decoded;
    } catch (error) {
        window.log.error('[Storage ' + F_V + '] (2) Gagal mendekripsi string:', error);
        return '';
    }
}

// =============================================================================
// 4. FUNGSI STORAGE DASAR
// =============================================================================

function getItem(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return defaultValue;
        return JSON.parse(value);
    } catch (error) {
        window.log.error('[Storage ' + F_V + '] (3) Gagal membaca "' + key + '":', error);
        return defaultValue;
    }
}

function setItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            window.log.error('[Storage ' + F_V + '] (4) Kuota localStorage penuh!');
            const cleaned = autoCleanup();
            StorageManager._lastCleanupCount = (typeof cleaned === 'number') ? cleaned : 0;
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                window.log.error('[Storage ' + F_V + '] (5) Gagal menyimpan setelah cleanup:', e);
            }
        } else {
            window.log.error('[Storage ' + F_V + '] (6) Gagal menyimpan "' + key + '":', error);
        }
        return false;
    }
}

function removeItem(key) {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        window.log.error('[Storage ' + F_V + '] (7) Gagal menghapus "' + key + '":', error);
    }
}

function clearAll() {
    try {
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        window.log.info('[Storage ' + F_V + '] (8) Semua data aplikasi dihapus');
        return true;
    } catch (error) {
        window.log.error('[Storage ' + F_V + '] (9) Gagal menghapus semua data:', error);
        return false;
    }
}

// =============================================================================
// 5. FUNGSI HISTORY
// =============================================================================

function getHistory() {
    return getItem(STORAGE_KEYS.HISTORY, []);
}

function saveHistoryItem(item) {
    const history = getHistory();

    if (!item.type) {
        item.type = item.trackingData ? 'operational' : 'standard';
    }

    const existingIndex = history.findIndex(h => h.refId === item.refId);
    if (existingIndex !== -1) {
        history[existingIndex] = item;
    } else {
        history.push(item);
    }

    const maxItems = CONFIG.maxHistoryItems || 50;
    if (history.length > maxItems) {
        const removed = history.splice(0, history.length - maxItems);
        window.log.info('[Storage ' + F_V + '] (10) ' + removed.length + ' history tertua dihapus otomatis');
    }

    const success = setItem(STORAGE_KEYS.HISTORY, history);

    if (StorageManager._lastCleanupCount > 0 && window.ThemeManager) {
        window.ThemeManager.showToast(
            'Riwayat tertua dihapus untuk memberi ruang penyimpanan.',
            'warning', 4000
        );
        StorageManager._lastCleanupCount = 0;
    }

    if (!success && window.ThemeManager) {
        window.ThemeManager.showToast(
            'Gagal menyimpan riwayat. Penyimpanan mungkin penuh.',
            'warning', 5000
        );
    }

    return success;
}

function deleteHistoryItem(refId) {
    const history = getHistory();
    const filtered = history.filter(item => item.refId !== refId);
    if (filtered.length === history.length) return false;
    return setItem(STORAGE_KEYS.HISTORY, filtered);
}

function clearHistory() {
    return setItem(STORAGE_KEYS.HISTORY, []);
}

function getHistoryByRefId(refId) {
    const history = getHistory();
    return history.find(item => item.refId === refId) || null;
}

function getHistoryCount() {
    return getHistory().length;
}

// =============================================================================
// 6. FUNGSI PREFERENCES
// =============================================================================

const DEFAULT_PREFERENCES = {
    quickOrder: false,
    alwaysGPS: false,
    offlineOrder: false,
    alwaysOperational: false,
    largeText: false,
    hideSafetyReminder: false,          // v2.0.1-rev0
    cacheMaksimal: false,               // v2.0.1-rev0
    defaultVehicle: {
        mode: 'Mobil',
        role: 'Driver',
        area: 'Jabodetabek',
        cc: '1000cc',
        fuel: 'Pertalite',
        transmission: 'manual',
        contract: 'individu'
    }
};

function getPreferences() {
    const stored = getItem(STORAGE_KEYS.PREFERENCES, {});
    return {
        quickOrder: stored.quickOrder === true,
        alwaysGPS: stored.alwaysGPS === true,
        offlineOrder: stored.offlineOrder === true,
        alwaysOperational: stored.alwaysOperational === true,
        largeText: stored.largeText === true,
        hideSafetyReminder: stored.hideSafetyReminder === true,
        cacheMaksimal: stored.cacheMaksimal === true,      // v2.0.1-rev0
        defaultVehicle: stored.defaultVehicle || DEFAULT_PREFERENCES.defaultVehicle,
        driverInfo: stored.driverInfo || { name: '', plate: '', phone: '' },
        customCopy: stored.customCopy || { enabled: false, template: '' }
    };
}

function savePreferences(prefs) {
    return setItem(STORAGE_KEYS.PREFERENCES, prefs);
}

// =============================================================================
// 7. FUNGSI DRIVER INFO
// =============================================================================

function getDriverInfo() {
    try {
        const encrypted = localStorage.getItem(STORAGE_KEYS.DRIVER_INFO);
        return decryptDriverInfo(encrypted);
    } catch (error) {
        window.log.error('[Storage ' + F_V + '] (11) Gagal membaca driver info:', error);
        return { name: '', plate: '', phone: '' };
    }
}

function saveDriverInfo(info) {
    try {
        const encrypted = encryptDriverInfo(info);
        if (encrypted) {
            localStorage.setItem(STORAGE_KEYS.DRIVER_INFO, encrypted);
            return true;
        }
        return false;
    } catch (error) {
        window.log.error('[Storage ' + F_V + '] (12) Gagal menyimpan driver info:', error);
        return false;
    }
}

// =============================================================================
// 8. FUNGSI KONTAK DARURAT
// =============================================================================

const DEFAULT_EMERGENCY_CONTACTS = {
    kerabat: '',
    darurat: '112',
    ambulance: '118',
    polisi: '110'
};

function getEmergencyContacts() {
    try {
        const encrypted = localStorage.getItem(STORAGE_KEYS.EMERGENCY_CONTACTS);
        if (!encrypted) return { ...DEFAULT_EMERGENCY_CONTACTS };

        const jsonString = decryptString(encrypted);
        if (!jsonString) return { ...DEFAULT_EMERGENCY_CONTACTS };

        const parsed = JSON.parse(jsonString);
        return {
            kerabat: parsed.kerabat || '',
            darurat: parsed.darurat || DEFAULT_EMERGENCY_CONTACTS.darurat,
            ambulance: parsed.ambulance || DEFAULT_EMERGENCY_CONTACTS.ambulance,
            polisi: parsed.polisi || DEFAULT_EMERGENCY_CONTACTS.polisi
        };
    } catch (error) {
        window.log.error('[Storage ' + F_V + '] (13) Gagal membaca kontak darurat:', error);
        return { ...DEFAULT_EMERGENCY_CONTACTS };
    }
}

function saveEmergencyContacts(contacts) {
    try {
        const data = {
            kerabat: contacts.kerabat || '',
            darurat: contacts.darurat || DEFAULT_EMERGENCY_CONTACTS.darurat,
            ambulance: contacts.ambulance || DEFAULT_EMERGENCY_CONTACTS.ambulance,
            polisi: contacts.polisi || DEFAULT_EMERGENCY_CONTACTS.polisi
        };

        const jsonString = JSON.stringify(data);
        const encrypted = encryptString(jsonString);
        if (encrypted) {
            localStorage.setItem(STORAGE_KEYS.EMERGENCY_CONTACTS, encrypted);
            window.log.info('[Storage ' + F_V + '] (14) Kontak darurat disimpan');
            return true;
        }
        return false;
    } catch (error) {
        window.log.error('[Storage ' + F_V + '] (15) Gagal menyimpan kontak darurat:', error);
        return false;
    }
}

// =============================================================================
// 9. FUNGSI THEME
// =============================================================================

function getTheme() {
    return getItem(STORAGE_KEYS.THEME, CONFIG.defaultTheme || 'light');
}

function saveTheme(theme) {
    return setItem(STORAGE_KEYS.THEME, theme);
}

// =============================================================================
// 10. FUNGSI MAINTENANCE CYCLES
// =============================================================================

function getCycleData() {
    return getItem(STORAGE_KEYS.MAINT_CYCLES, {});
}

function saveCycleData(data) {
    return setItem(STORAGE_KEYS.MAINT_CYCLES, data);
}

function updateCycleCount(itemName, newCycleCount) {
    const data = getCycleData();
    data[itemName] = {
        cycleCount: newCycleCount,
        lastReset: Date.now()
    };
    return saveCycleData(data);
}

// =============================================================================
// 11. FUNGSI UTILITAS
// =============================================================================

function getStorageUsageMB() {
    try {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            total += (key.length + value.length) * 2;
        }
        return total / (1024 * 1024);
    } catch (error) {
        window.log.error('[Storage ' + F_V + '] (16) Gagal menghitung usage:', error);
        return 0;
    }
}

function checkStorageQuota() {
    const usageMB = getStorageUsageMB();
    const thresholdMB = CONFIG.storageQuotaWarningMB || 4;
    const isWarning = usageMB > thresholdMB;

    if (isWarning) {
        window.log.warn('[Storage ' + F_V + '] (17) Penggunaan storage tinggi: ' + usageMB.toFixed(1) + ' MB');
    }

    return { usageMB, isWarning, thresholdMB };
}

function autoCleanup() {
    const history = getHistory();
    if (history.length === 0) {
        window.log.info('[Storage ' + F_V + '] (18) Auto-cleanup: tidak ada history yang bisa dihapus');
        return 0;
    }
    const removeCount = Math.max(1, Math.ceil(history.length * 0.2));
    const newHistory = history.slice(0, history.length - removeCount);
    setItem(STORAGE_KEYS.HISTORY, newHistory);
    window.log.info('[Storage ' + F_V + '] (19) Auto-cleanup: menghapus ' + removeCount + ' history tertua');
    return removeCount;
}

function generateRefId() {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let random = '';
    for (let i = 0; i < 4; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return yy + mm + dd + hh + min + random;
}

// =============================================================================
// 12. EKSPOR
// =============================================================================

export const StorageManager = {
    KEYS: STORAGE_KEYS,

    getItem,
    setItem,
    removeItem,
    clearAll,

    getHistory,
    saveHistoryItem,
    deleteHistoryItem,
    clearHistory,
    getHistoryByRefId,
    getHistoryCount,

    getPreferences,
    savePreferences,

    getDriverInfo,
    saveDriverInfo,

    getEmergencyContacts,
    saveEmergencyContacts,

    getTheme,
    saveTheme,

    getCycleData,
    saveCycleData,
    updateCycleCount,

    getStorageUsageMB,
    checkStorageQuota,
    autoCleanup,
    generateRefId,

    _lastCleanupCount: 0
};

window.log.info('[Storage ' + F_V + '] (20) StorageManager dimuat');


// ================================ End Of File ================================