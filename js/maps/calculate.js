/**
 * =================================================================================
 * FILE         : /js/maps/calculate.js
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

import { TrackingCollector } from './tracker.js';

export class Calculate {
    constructor({ role, trackingMode, vehicleData, estimateResult }) {
        this.role = role;
        this.trackingMode = trackingMode || 'standard';
        this.vehicleData = vehicleData || {};
        this.estimateResult = estimateResult || null;
        this.tracker = null;
        this.callbacks = {};

        this._snapshotEngineData = null;
        this._snapshotCompactData = null;

        this._cachedPickupCost = null;
        this._cachedPickupResult = null;
    }

    setCallbacks(cb) {
        this.callbacks = cb || {};
    }

    start() {
        this.tracker = new TrackingCollector(this.role);
        this.tracker.setOnJump((data) => {
            if (this.callbacks.onJump) this.callbacks.onJump(data);
        });
        this.tracker.setOnStatusChange((data) => {
            if (this.callbacks.onStatusChange) this.callbacks.onStatusChange(data);
        });
        this.tracker.start();
    }

    pause() { if (this.tracker) this.tracker.pause(); }

    resume() { if (this.tracker) this.tracker.resume(); }

    switchToDropoff() {
        if (!this.tracker || this.tracker.session !== 'pickup') return;

        if (this.trackingMode !== 'operational' && window.Cache && this.estimateResult) {
            const rawData = this.tracker.getRawSessionData();
            const rounded = this._roundSessionData(rawData);
            const pickupInput = {
                ...this.vehicleData,
                E78: rounded.pickupDistance,
                E80: this._roundMinutes(rawData.pickupTime)
            };
            this._cachedPickupResult = window.Cache.realityPickup(pickupInput, this.estimateResult);
        }

        this.tracker.startPhase('dropoff');
    }

    stop() { if (this.tracker) this.tracker.stop(); }

    addPosition(lat, lng, accuracy, timestamp) {
        if (this.tracker) this.tracker.addPosition(lat, lng, accuracy, timestamp);
    }

    getStatus() { return this.tracker ? this.tracker.getStatus() : null; }

 //   getSummary() { return this.tracker ? this.tracker.getSummary() : null; }
getSummary() {
    if (!this.tracker) return null;
    const raw = this.tracker.getSummary();
    if (!raw) return null;
    // Konversi waktu dari detik ke menit (pembulatan ke atas)
    const toMinutes = (seconds) => Math.ceil((seconds || 0) / 60);
    return {
        ...raw,
        pickupTime: toMinutes(raw.pickupTime),
        dropoffTime: toMinutes(raw.dropoffTime),
        totalTime: toMinutes(raw.totalTime),
        pauseTime: Math.ceil((raw.pauseTime || 0) / 60)  // pauseTime juga dalam detik
    };
}


    getPolylineData() {
        return this.tracker ? this.tracker.getPolylineDataWithAccuracy() : { pickup: [], dropoff: [] };
    }

    getLiveIndicatorData() {
        if (!this.tracker) return { phase: null, summary: null };

        const phase = this.tracker.getPhaseData();
        const summary = this.tracker.getSummary();

        if (phase) {
            phase.distance = this._roundKm(phase.distance);
        }

        return { phase, summary };
    }

    getCurrentSessionElapsedSeconds() {
        return this.tracker ? this.tracker.getElapsedSeconds() : 0;
    }

    // =========================================================================
    // KONFIGURASI (via Cache)
    // =========================================================================

    /**
     * Mendapatkan batas maksimal jarak penjemputan gratis.
     * @returns {number} km
     */
    getMaxPickupDistance() {
        return window.Cache?.getMaxPickupDistance() || 2;
    }

    /**
     * Mendapatkan batas maksimal waktu penjemputan gratis.
     * @returns {number} menit
     */
    getMaxPickupTime() {
        return window.Cache?.getMaxPickupTime() || 15;
    }

    // =========================================================================
    // LIVE INCOME (dengan share/limit untuk operasional)
    // =========================================================================

    /**
     * Menghitung pendapatan live berdasarkan data tracking terkini.
     * @param {Object} vehicleData - Data kendaraan
     * @param {Object} estimateResult - Hasil estimasi (null untuk operasional)
     * @param {Object} [options={}] - Opsi tambahan
     * @param {number} [options.shareCount=1] - Jumlah pembagi share cost (1–6)
     * @param {number} [options.setLimit=0] - Nilai limit (min 1000)
     * @returns {Object|null} Data live income
     */
    getLiveIncome(vehicleData, estimateResult, options = {}) {
        if (!this.tracker || !window.Cache) return null;

        const status = this.tracker.getStatus();
        if (!status || status.status === 'idle' || status.status === 'paused') {
            return null;
        }

        const rawData = this.tracker.getRawSessionData();
        const elapsedMinutes = this.tracker.getElapsedSeconds() / 60;
        const input = this._buildEngineInput(vehicleData, rawData, elapsedMinutes, status);

        const { shareCount = 1, setLimit = 0 } = options;

        try {
            if (this.trackingMode === 'operational') {
                const totalDistance = (rawData.pickupDistance + rawData.dropoffDistance);
                const totalTime = elapsedMinutes > 0 ? elapsedMinutes : (rawData.pickupTime + rawData.dropoffTime) / 60;
                const opCost = window.Cache.getOperationalCost(vehicleData, totalDistance, totalTime);

                const income = {
                    driver: 0,
                    app: 0,
                    passengerPayment: 0,
                    passengerBill: 0,
                    bbm: opCost.bbm || 0,
                    maintenance: opCost.maintenance || 0,
                    total: opCost.total || 0,
                    _engineResult: null
                };

                if (shareCount > 1) {
                    income.shareCost = income.total / shareCount;
                } else {
                    income.shareCost = 0;
                }
                if (setLimit >= 1000) {
                    income.limitResult = setLimit - income.total;
                } else {
                    income.limitResult = 0;
                }

                return income;
            }

            if (!estimateResult) return null;

            if (status.session === 'pickup') {
                const pickup = window.Cache.realityPickup(input, estimateResult);

                const tagihanJemput = pickup.E742 || 0;
                const biayaPickup = pickup.E958 || 0;

                const baseDriver = estimateResult.E700 || 0;
                const onlineCost = (input.E36 === 'online')
                    ? (estimateResult.E807 || 0)
                    : (estimateResult.E684 || 0);
                const driver = (baseDriver - biayaPickup) + onlineCost;

                const app = estimateResult.E970 || 0;

                return {
                    driver,
                    app,
                    passengerPayment: estimateResult.E697 || 0,
                    passengerBill: tagihanJemput,
                    bbm: pickup.E909 || 0,
                    maintenance: pickup.E933 || 0,
                    total: biayaPickup,
                    _engineResult: pickup
                };
            } else if (status.session === 'dropoff') {
                const dropoff = window.Cache.realityDropoff(
                    input, estimateResult, this._cachedPickupResult || undefined
                );

                return {
                    driver: dropoff.E981 || 0,
                    app: dropoff.E982 || 0,
                    passengerPayment: dropoff.E697 || 0,
                    passengerBill: dropoff.E746 || 0,
                    bbm: dropoff.E911 || 0,
                    maintenance: dropoff.E935 || 0,
                    total: dropoff.E960 || 0,
                    _engineResult: dropoff
                };
            }

            return null;
        } catch (e) {
            window.log.error('[Calculate ' + F_V + '] (1) Live income error:', e);
            return null;
        }
    }

    takeSnapshot() {
        if (!this.tracker) return null;

        const rawData = this.tracker.getRawSessionData();
        const compactData = this.tracker.getCompactData();

        const engineData = this._roundSessionData(rawData);
        engineData.pickupTime = this._roundMinutes(rawData.pickupTime);
        engineData.dropoffTime = this._roundMinutes(rawData.dropoffTime);

        this._snapshotEngineData = engineData;
        this._snapshotCompactData = compactData;

        window.log.info('[Calculate ' + F_V + '] (2) Snapshot diambil');
        return { engineData, compactData };
    }

    clearSnapshot() {
        this._snapshotEngineData = null;
        this._snapshotCompactData = null;
    }

    /**
     * Finalisasi perhitungan dengan data tambahan (termasuk share/limit).
     * @param {Object} vehicleData - Data kendaraan
     * @param {Object} [additionalData={}] - Data tambahan (E92, E100, shareCount, dll.)
     * @returns {Object} Hasil final + properti share/limit
     */
    finalize(vehicleData, additionalData = {}) {
        if (!window.Cache) throw new Error('Cache tidak tersedia');

        if (!this._snapshotEngineData) {
            throw new Error('Snapshot tidak tersedia. Panggil takeSnapshot() terlebih dahulu.');
        }

        const snapshot = this._snapshotEngineData;

        const input = {
            ...vehicleData,
            E78: snapshot.pickupDistance,
            E80: snapshot.pickupTime,
            E82: snapshot.dropoffDistance,
            E84: snapshot.dropoffTime,
            ...additionalData
        };

        let engineResult;
        if (this.trackingMode === 'operational') {
            // Gunakan Cache.getOperationalCost karena tidak ada getOperationalReality
            const totalDistance = snapshot.pickupDistance + snapshot.dropoffDistance;
            const totalTime = snapshot.pickupTime + snapshot.dropoffTime;
            const opCost = window.Cache.getOperationalCost(vehicleData, totalDistance, totalTime);
            engineResult = {
                E960: opCost.total,
                E911: opCost.bbm,
                E935: opCost.maintenance,
                E825: opCost.depreciation,
                E841: opCost.tax,
                E807: 0,           // tidak ada map load di operasional
                E752: totalDistance,
                E753: totalTime
            };
        } else {
            // Gunakan Cache.reality dengan estimateResult yang sudah ada
            engineResult = window.Cache.reality(input, this.estimateResult);
        }

        const shareCount = additionalData.shareCount || 1;
        const setLimit = additionalData.setLimit || 0;
        const totalCost = engineResult.E960 || engineResult.total || 0;

        const finalResult = {
            ...engineResult,
            shareCount,
            setLimit,
            shareResult: shareCount > 1 ? totalCost / shareCount : 0,
            limitResult: setLimit >= 1000 ? setLimit - totalCost : 0
        };

        window.log.info('[Calculate ' + F_V + '] (3) Finalisasi selesai, share=' + shareCount + ' limit=' + setLimit);
        return finalResult;
    }

    getSnapshotCompactData() {
        return this._snapshotCompactData;
    }

    getSnapshotEngineData() {
        return this._snapshotEngineData;
    }
    
getLastPosition() {
    return this.tracker?.lastPosition || null;
}

    // =========================================================================
    // PRIVATE HELPERS (pembulatan)
    // =========================================================================

    _roundSessionData(rawData) {
        return {
            pickupDistance: this._roundKm(rawData.pickupDistance),
            pickupTime: rawData.pickupTime,
            dropoffDistance: this._roundKm(rawData.dropoffDistance),
            dropoffTime: rawData.dropoffTime
        };
    }

    _roundKm(value) {
        if (!value || value <= 0) return 0;
        const rounded = Math.round(value * 100) / 100;
        return rounded < 0.01 ? 0.01 : rounded;
    }

    _roundMinutes(detik) {
        if (!detik || detik <= 0) return 0;
        const minutes = Math.ceil(detik / 60);
        return Math.max(minutes, 1);
    }

    /**
     * Membangun input untuk Cache/Engine dari data mentah tracker.
     */
    _buildEngineInput(vehicleData, rawData, elapsedMinutes, status) {
        const input = { ...vehicleData };

        if (status.session === 'pickup') {
            input.E78 = this._roundKm(rawData.pickupDistance);
            input.E80 = Math.max(1, Math.ceil(elapsedMinutes));
        } else if (status.session === 'dropoff') {
            input.E78 = this._roundKm(rawData.pickupDistance);
            input.E80 = this._roundMinutes(rawData.pickupTime);
            input.E82 = this._roundKm(rawData.dropoffDistance);
            input.E84 = Math.max(1, Math.ceil(elapsedMinutes));
        }

        return input;
    }
}

window.log.info('[Calculate ' + F_V + '] (4) Calculate dimuat');


// ================================ End Of File ================================