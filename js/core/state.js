/**
 * =================================================================================
 * FILE         : /js/core/state.js
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

import { getDefaultValues } from '../helpers/output.js';

// =============================================================================
// 1. EVENT EMITTER SEDERHANA
// =============================================================================

class EventEmitter {
    constructor() {
        this._events = new Map();
    }

    on(event, callback) {
        if (!this._events.has(event)) {
            this._events.set(event, new Set());
        }
        this._events.get(event).add(callback);
    }

    off(event, callback) {
        if (this._events.has(event)) {
            this._events.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this._events.has(event)) {
            const callbacks = this._events.get(event);
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    window.log.error('[State ' + F_V + '] (1) Error listener event "' + event + '":', error);
                }
            });
        }
    }

    clear(event) {
        if (this._events.has(event)) {
            this._events.get(event).clear();
        }
    }

    clearAll() {
        this._events.clear();
    }
}

// =============================================================================
// 2. HELPER: DEFAULT INPUT (diambil dari Output)
// =============================================================================

function getDefaultInput() {
    try {
        const def = getDefaultValues();   // Output.getDefaultValues()
        return {
          // TODO: kesalahan pada engine tentang default value: default value dan validated value adalah berbeda
          // TODO: default value semua input numeric adalah null
          // TODO: default value jika terdapat dependesi maka periksa dulu default value sebelumnya
          // TODO: beberapa bagian seperti E40 ketika render harus validated value karena dependensi berantai
            E10: def.E10 || 'Mobil',
            E12: def.E12 || 'Driver',
            E20: def.E20 || 'Jabodetabek',
            E22: def.E22 || '1000cc',
            E24: def.E24 || 'Pertalite',
            E26: def.E26 || 'manual',
            E28: def.E28 || 'individu',
            E36: def.E36 || 'online',
            E38: def.E38 || 'wajar',
            E40: null,   // disamakan dengan input numerik lain; halaman akan mengisi default via Engine
            E46: def.E46 || 'Standar',
            E54: null,
            E56: null,
            E58: null,
            E60: null,
            E68: null,
            E70: null,
            E78: null,
            E80: null,
            E82: null,
            E84: null,
            E92: null,
            E100: null,
            E102: null,
            E104: null
        };
    } catch (e) {
        window.log.warn('[State ' + F_V + '] (2) Output.getDefaultValues() gagal, gunakan fallback');
        return {
            E10: 'Mobil', E12: 'Driver', E20: 'Jabodetabek', E22: '1000cc',
            E24: 'Pertalite', E26: 'manual', E28: 'individu',
            E36: 'online', E38: 'wajar', E40: 0.4, E46: 'Standar',
            E54: null, E56: null, E58: null, E60: null,
            E68: null, E70: null, E78: null, E80: null,
            E82: null, E84: null, E92: null, E100: null,
            E102: null, E104: null
        };
    }
}

// =============================================================================
// 3. APP STATE - OBJEK STATE GLOBAL
// =============================================================================

const AppState = {
    currentPage: 'home',
    previousPage: 'KT',
    pageParams: {},

    // Input pengguna (SSOT)
    input: getDefaultInput(),

    // Hasil kalkulasi
    estimateResult: null,
    realityResult: null,
    extraResult: null,

    // Mode kalkulasi dan data tracking terkait
    calcMode: null,
    trackingData: null,
    
    // Mode ceck tarif offline
    isCheckOffline: false,

    // Preferensi pengguna (nilai awal, akan ditimpa oleh PreferencesManager)
    preferences: {
        quickOrder: false,
        alwaysGPS: false,
        offlineOrder: false,
        alwaysOperational: false,
        largeText: false,
        hideSafetyReminder: false,          // v2.0.1-rev0
        cacheMaksimal: false,               // v2.0.1-rev0
        defaultVehicle: {
            mode: 'Mobil', role: 'Driver', area: 'Jabodetabek',
            cc: '1000cc', fuel: 'Pertalite', transmission: 'manual',
            contract: 'individu'
        },
        driverInfo: { name: '', plate: '', phone: '' },
        customCopy: { enabled: false, template: '' }
    },

    theme: 'light',
    isLoading: false,
    isAppReady: false,

    toastQueue: [],
    activeToasts: [],

    navigation: {
        popup: 0,
        drawer: 0
    },

    _appInitialized: false,
    
    updateAvailable: null,   // { version, url, notes }

    // Anti‑duplikasi result
    lastSavedFingerprint: null,
    lastRefId: null,
    lastTimestamp: null,
    lastInput: null
};

// =============================================================================
// 4. STATE MANAGER
// =============================================================================

function _safeClone(value) {
    if (typeof value !== 'object' || value === null) return value;
    try {
        return structuredClone(value);
    } catch (e) {
        // DOM element, function, Symbol, etc.
    }
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (e) {
        // circular reference, BigInt, etc.
    }
    return value;
}

const StateManager = {
    set(key, value) {
        const keys = key.split('.');
        let obj = AppState;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }

        const lastKey = keys[keys.length - 1];
        const oldValue = _safeClone(obj[lastKey]);

        if (JSON.stringify(oldValue) === JSON.stringify(value)) {
            return;
        }

        const valueToStore = _safeClone(value);
        obj[lastKey] = valueToStore;

        StateEvents.emit('state:change', { key, value: valueToStore, oldValue });

        if (key === 'currentPage') {
            StateEvents.emit('page:change', { page: valueToStore, previous: oldValue });
        } else if (key.startsWith('input')) {
            StateEvents.emit('input:update', { key, value: valueToStore, oldValue });
        } else if (key === 'calcMode') {
            StateEvents.emit('calcMode:change', { key, value: valueToStore, oldValue });
        } else if (key === 'theme') {
            StateEvents.emit('theme:change', valueToStore);
        }
    },

    get(key) {
        const keys = key.split('.');
        let value = AppState;

        for (let i = 0; i < keys.length; i++) {
            if (value === null || value === undefined) return undefined;
            value = value[keys[i]];
        }

        return _safeClone(value);
    },

    updateInput(cell, value) {
        if (AppState.input.hasOwnProperty(cell)) {
            this.set(`input.${cell}`, value);
        } else {
            window.log.warn('[State ' + F_V + '] (3) Cell ' + cell + ' tidak dikenal dalam input');
        }
    },

    batchUpdateInput(updates) {
        const changedCells = [];

        for (const cell in updates) {
            if (updates.hasOwnProperty(cell) && AppState.input.hasOwnProperty(cell)) {
                const oldValue = AppState.input[cell];
                const newValue = updates[cell];

                if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                    AppState.input[cell] = newValue;
                    changedCells.push({ cell, value: newValue, oldValue });
                }
            }
        }

        if (changedCells.length > 0) {
            StateEvents.emit('input:update', { batch: true, cells: changedCells });
            StateEvents.emit('state:change', { key: 'input', batch: true });
        }
    },

    resetInput() {
        this.set('input', getDefaultInput());
    },

    resetAppState() {
        window.log.info('[State ' + F_V + '] (4) resetAppState dipanggil');
        this.set('currentPage', 'home');
        this.set('previousPage', 'KT');
        this.set('pageParams', {});
        this.resetInput();
        this.set('estimateResult', null);
        this.set('realityResult', null);
        this.set('extraResult', null);
        this.set('calcMode', null);
        this.set('trackingData', null);
        this.set('toastQueue', []);
        this.set('activeToasts', []);
        // Reset flag cek mode offline
        this.set('isCheckOffline', false);
        // Reset flag internal navigasi
        AppState.navigation.popup = 0;
        AppState.navigation.drawer = 0;
        // Reset session anti‑duplikasi
        AppState.lastSavedFingerprint = null;
        AppState.lastRefId = null;
        AppState.lastTimestamp = null;
        AppState.lastInput = null;
    },

    addToast(toast) {
        const queue = [...AppState.toastQueue, toast];
        this.set('toastQueue', queue);
        StateEvents.emit('toast:show', toast);
    }
};

// =============================================================================
// 5. INSTANCE EVENT EMITTER
// =============================================================================

const StateEvents = new EventEmitter();

export { AppState, StateManager, StateEvents };

window.log.info('[State ' + F_V + '] (5) StateManager dimuat (via Output)');

// ================================ End Of File ================================