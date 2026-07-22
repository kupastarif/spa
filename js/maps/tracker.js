/**
 * =================================================================================
 * FILE         : /js/maps/tracker.js
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

import { GPS } from './gps.js';

const EARTH_RADIUS_KM = 6371;
const ACCURACY_THRESHOLD = 100;       // meter: posisi dengan akurasi >100m diabaikan untuk jarak
const MAX_NORMAL_SPEED_KM_PER_MIN = 2; // km/menit (120 km/jam)
const DOUGLAS_EPSILON = 0.0001;       // untuk penyederhanaan rute

class TrackingCollector {
    constructor(role) {
        this.role = role || 'Driver';
        this.reset();
    }

    // =========================================================================
    // RESET & STATE
    // =========================================================================

    reset() {
        this.status = 'idle';          // 'idle', 'pickup', 'dropoff', 'paused'
        this.session = null;           // 'pickup' atau 'dropoff' (fase aktif)
        this.sessionActive = false;    // true jika sudah ada posisi pertama pasca start
        this.startTimeUTC = null;      // timestamp UTC (ms) saat fase aktif dimulai
        this.accumulatedTime = 0;      // detik yang sudah berjalan hingga saat ini (atau beku saat pause)
        this.isPaused = false;
        this.pauseStartTimeUTC = null; // timestamp UTC saat pause dimulai
        this.pauseCount = 0;
        this.pauseTime = 0;            // total detik dalam pause
        this.jumpCount = 0;
        this.jumpTotal = 0;            // km

        this.pickupDistance = 0;       // km presisi penuh
        this.dropoffDistance = 0;      // km presisi penuh

        this.pickupPositions = [];     // array {lat, lng, accuracy, timestamp}
        this.dropoffPositions = [];
        this.lastPosition = null;      // posisi sebelumnya (untuk Haversine)
        this.currentAccuracy = null;
        this.lastUpdateTimeUTC = null; // timestamp UTC posisi terakhir (untuk deteksi loncatan)

        // Informasi zona waktu dari sesi awal
        this.startOffset = 7;          // default WIB
        this.startZone = 'WIB';

        // Waktu mulai fase spesifik (UTC ms)
        this.pickupStartTimeUTC = null;
        this.dropoffStartTimeUTC = null;

        // Untuk indikator sesi aktif (tidak berubah saat pause)
        this.lastActivePhase = null;

        this.onJump = null;
        this.onStatusChange = null;
    }

    // =========================================================================
    // STATE MACHINE (dengan GPS.getCurrentUTCTime)
    // =========================================================================

    start() {
        if (this.status !== 'idle') return;

        const timeObj = GPS.getCurrentUTCTime(this.lastPosition?.lng);
        this.status = (this.role === 'Driver') ? 'pickup' : 'dropoff';
        this.session = this.status;
        this.sessionActive = false;      // menunggu posisi pertama
        this.startTimeUTC = timeObj.utc;
        this.startOffset = timeObj.offset;
        this.startZone = timeObj.zone;
        this.accumulatedTime = 0;
        this.isPaused = false;
        this.lastActivePhase = null;

        if (this.status === 'pickup') {
            this.pickupStartTimeUTC = timeObj.utc;
        } else {
            this.dropoffStartTimeUTC = timeObj.utc;
        }

        this._notifyStatusChange();
        window.log.info('[Tracker ' + F_V + '] (1) Sesi dimulai: ' + this.status + ', zona=' + this.startZone);
    }

    pause() {
        if (this.status === 'idle' || this.status === 'paused') return;

        if (this.sessionActive && !this.isPaused) {
            this.accumulatedTime = this._getElapsedSeconds();
        }
        this.isPaused = true;
        const timeObj = GPS.getCurrentUTCTime(this.lastPosition?.lng);
        this.pauseStartTimeUTC = timeObj.utc;
        this.pauseCount++;
        this.status = 'paused';

        this._updateLastActivePhase();
        this._notifyStatusChange();
        window.log.info('[Tracker ' + F_V + '] (2) Tracking dijeda');
    }

    resume() {
        if (this.status !== 'paused') return;

        const timeObj = GPS.getCurrentUTCTime(this.lastPosition?.lng);
        if (this.pauseStartTimeUTC) {
            const duration = Math.floor((timeObj.utc - this.pauseStartTimeUTC) / 1000);
            this.pauseTime += duration;
            this.pauseStartTimeUTC = null;
        }
        this.startTimeUTC = timeObj.utc;
        this.isPaused = false;
        this.status = this.session;

        this._notifyStatusChange();
        window.log.info('[Tracker ' + F_V + '] (3) Tracking dilanjutkan');
    }

    stop() {
        if (this.status === 'paused' && this.pauseStartTimeUTC) {
            const timeObj = GPS.getCurrentUTCTime(this.lastPosition?.lng);
            const duration = Math.floor((timeObj.utc - this.pauseStartTimeUTC) / 1000);
            this.pauseTime += duration;
            this.pauseStartTimeUTC = null;
        }
        this.status = 'idle';
        this.session = null;
        this.sessionActive = false;
        this.isPaused = false;
        this._notifyStatusChange();
        window.log.info('[Tracker ' + F_V + '] (4) Sesi dihentikan');
    }

    startPhase(phase) {
        const timeObj = GPS.getCurrentUTCTime(this.lastPosition?.lng);
        if (phase === 'pickup') {
            this.session = 'pickup';
            this.status = 'pickup';
            this.startTimeUTC = timeObj.utc;
            this.accumulatedTime = 0;
            this.isPaused = false;
            this.sessionActive = false;
            this.lastPosition = null;
            this.lastActivePhase = null;
            this.pickupStartTimeUTC = timeObj.utc;
        } else if (phase === 'dropoff') {
            this.pickupTime = this._getElapsedSeconds();
            this.session = 'dropoff';
            this.status = 'dropoff';
            this.startTimeUTC = timeObj.utc;
            this.accumulatedTime = 0;
            this.isPaused = false;
            this.sessionActive = false;
            this.lastPosition = null;
            this.lastActivePhase = null;
            this.dropoffStartTimeUTC = timeObj.utc;
        }
        this.lastUpdateTimeUTC = timeObj.utc;
        this._notifyStatusChange();
        window.log.info('[Tracker ' + F_V + '] (5) Fase berubah ke: ' + phase);
    }

    // =========================================================================
    // POSITION & DISTANCE
    // =========================================================================

    addPosition(lat, lng, accuracy, timestamp = Date.now()) {
        if (this.status === 'idle' || this.status === 'paused') return;

        this.currentAccuracy = accuracy;

        if (!this.sessionActive) {
            this.startTimeUTC = timestamp;
            this.accumulatedTime = 0;
            this.sessionActive = true;
            this.lastUpdateTimeUTC = timestamp;
            this.lastPosition = { lat, lng, timestamp };
        }

        const timeDiffMin = (timestamp - this.lastUpdateTimeUTC) / 60000;
        this.lastUpdateTimeUTC = timestamp;

        const position = { lat, lng, accuracy, timestamp };
        if (this.session === 'pickup') {
            this.pickupPositions.push(position);
        } else {
            this.dropoffPositions.push(position);
        }

        if (accuracy > ACCURACY_THRESHOLD) {
            this.lastPosition = { lat, lng, timestamp };
            this._updateLastActivePhase();
            return;
        }

        let distance = 0;
        if (this.lastPosition) {
            distance = this._haversine(
                this.lastPosition.lat, this.lastPosition.lng,
                lat, lng
            );

            if (timeDiffMin > 0 && distance > MAX_NORMAL_SPEED_KM_PER_MIN * timeDiffMin) {
                const maxNormal = MAX_NORMAL_SPEED_KM_PER_MIN * timeDiffMin;
                const excess = distance - maxNormal;
                this.jumpTotal += excess;
                this.jumpCount++;
                this._notifyJump(distance, timeDiffMin, excess);
                distance = maxNormal;
            }
        }

        if (distance > 0) {
            if (this.session === 'pickup') {
                this.pickupDistance += distance;
            } else if (this.session === 'dropoff') {
                this.dropoffDistance += distance;
            }
        }

        this.lastPosition = { lat, lng, timestamp };
        this._updateLastActivePhase();
    }

    // =========================================================================
    // WAKTU (SSOT)
    // =========================================================================

    _getElapsedSeconds() {
        if (!this.sessionActive) return 0;
        if (this.isPaused) return this.accumulatedTime;
        const nowUTC = GPS.getCurrentUTCTime(this.lastPosition?.lng).utc;
        return this.accumulatedTime + Math.floor((nowUTC - this.startTimeUTC) / 1000);
    }

    getElapsedSeconds() {
        return this._getElapsedSeconds();
    }

    // =========================================================================
    // DATA FASE AKTIF
    // =========================================================================

    _updateLastActivePhase() {
        if (this.status === 'idle' || this.status === 'paused' || !this.session) {
            return;
        }
        this.lastActivePhase = {
            phase: this.session,
            distance: this.session === 'pickup' ? this.pickupDistance : this.dropoffDistance,
            elapsedSeconds: this._getElapsedSeconds()
        };
    }

    getPhaseData() {
        if (this.status === 'idle') return null;
        if (this.status === 'paused') return this.lastActivePhase;
        if (this.status === 'pickup' || this.status === 'dropoff') {
            return {
                phase: this.status,
                distance: this.status === 'pickup' ? this.pickupDistance : this.dropoffDistance,
                elapsedSeconds: this._getElapsedSeconds()
            };
        }
        return null;
    }

    // =========================================================================
    // DATA TOTAL
    // =========================================================================

    getTotalDistance() {
        return this.pickupDistance + this.dropoffDistance;
    }

    getTotalTime() {
        if (this.status === 'idle' || this.status === 'paused') {
            return this.pickupTime || this._getElapsedSeconds();
        }
        return this._getElapsedSeconds();
    }

    getSummary() {
        const totalDistance = this.getTotalDistance();
        const totalTime = this.getTotalTime();
        return {
            status: this.status,
            session: this.session,
            totalDistance,
            totalTime,
            pickupDistance: this.pickupDistance,
            pickupTime: this.pickupTime || 0,
            dropoffDistance: this.dropoffDistance,
            dropoffTime: this.status === 'dropoff' ? this._getElapsedSeconds() : (this.pickupTime || 0),
            pauseCount: this.pauseCount,
            pauseTime: Math.floor(this.pauseTime),
            jumpCount: this.jumpCount,
            jumpTotal: this.jumpTotal,
            currentAccuracy: this.currentAccuracy,
            hasPositions: this.pickupPositions.length > 0 || this.dropoffPositions.length > 0
        };
    }

    getPolylineDataWithAccuracy() {
        return {
            pickup: this.pickupPositions.map(p => [p.lat, p.lng, p.accuracy || 0]),
            dropoff: this.dropoffPositions.map(p => [p.lat, p.lng, p.accuracy || 0])
        };
    }

    getStatus() {
        return {
            status: this.status,
            session: this.session,
            isActive: this.status !== 'idle' && this.status !== 'paused'
        };
    }

    getRawSessionData() {
        return {
            pickupDistance: this.pickupDistance,
            pickupTime: this.pickupTime || this._getElapsedSeconds(),
            dropoffDistance: this.dropoffDistance,
            dropoffTime: this.status === 'dropoff' ? this._getElapsedSeconds() : 0
        };
    }

    // =========================================================================
    // DATA COMPACT (dengan zona)
    // =========================================================================

    _formatLocalTime(utc, offset) {
        if (!utc) return '';
        const local = new Date(utc + offset * 3600 * 1000);
        return this._pad(local.getUTCHours()) + ':' +
               this._pad(local.getUTCMinutes()) + ':' +
               this._pad(local.getUTCSeconds());
    }

    _formatLocalTimeWithDate(utc, offset, referenceUTC) {
        if (!utc) return '';
        const d = new Date(utc + offset * 3600 * 1000);
        const time = this._pad(d.getUTCHours()) + ':' +
                     this._pad(d.getUTCMinutes()) + ':' +
                     this._pad(d.getUTCSeconds());
        if (referenceUTC) {
            const refDate = new Date(referenceUTC + offset * 3600 * 1000);
            if (d.getUTCDate() !== refDate.getUTCDate() ||
                d.getUTCMonth() !== refDate.getUTCMonth() ||
                d.getUTCFullYear() !== refDate.getUTCFullYear()) {
                const yy = String(d.getUTCFullYear()).slice(-2);
                const mm = this._pad(d.getUTCMonth() + 1);
                const dd = this._pad(d.getUTCDate());
                return `${time}|${yy}${mm}${dd}`;
            }
        }
        return time;
    }

    getCompactData() {
        const self = this;
        const filteredPickup = this.pickupPositions.filter(p => (p.accuracy || 0) <= ACCURACY_THRESHOLD);
        const filteredDropoff = this.dropoffPositions.filter(p => (p.accuracy || 0) <= ACCURACY_THRESHOLD);
        const simplifiedPickup = this._simplifyPath(filteredPickup, DOUGLAS_EPSILON);
        const simplifiedDropoff = this._simplifyPath(filteredDropoff, DOUGLAS_EPSILON);

        return {
            pickupDistance: this.pickupDistance,
            pickupTime: this.pickupTime || this._getElapsedSeconds(),
            dropoffDistance: this.dropoffDistance,
            dropoffTime: this.status === 'dropoff' ? this._getElapsedSeconds() : 0,
            pauseCount: this.pauseCount,
            pauseTime: Math.floor(this.pauseTime),
            jumpCount: this.jumpCount,
            jumpTotal: this.jumpTotal,
            positionsPickup: simplifiedPickup.map(p => `${p.lat},${p.lng}`).join(';'),
            positionsDropoff: simplifiedDropoff.map(p => `${p.lat},${p.lng}`).join(';'),
            startTime: this._formatLocalTime(this.startTimeUTC, this.startOffset),
            pickupTimeStr: this.pickupStartTimeUTC 
                ? this._formatLocalTimeWithDate(this.pickupStartTimeUTC, this.startOffset, this.startTimeUTC) 
                : '',
            dropoffTimeStr: this.dropoffStartTimeUTC 
                ? this._formatLocalTimeWithDate(this.dropoffStartTimeUTC, this.startOffset, this.startTimeUTC) 
                : '',
            timezoneOffset: this.startOffset,
            timezoneName: this.startZone
        };
    }

    // =========================================================================
    // CALLBACKS
    // =========================================================================

    setOnJump(callback) { this.onJump = callback; }
    setOnStatusChange(callback) { this.onStatusChange = callback; }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    _notifyJump(distance, timeDiff, excess) {
        if (this.onJump) {
            this.onJump({
                distance,
                timeDiff,
                excess,
                jumpCount: this.jumpCount,
                jumpTotal: this.jumpTotal
            });
        }
    }

    _notifyStatusChange() {
        if (this.onStatusChange) {
            this.onStatusChange({ status: this.status, session: this.session });
        }
    }

    _haversine(lat1, lng1, lat2, lng2) {
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    _pad(num) { return String(num).padStart(2, '0'); }

    _simplifyPath(points, epsilon) {
        if (!points || points.length <= 2) return points;
        let maxDistance = 0, maxIndex = 0;
        const first = points[0], last = points[points.length - 1];
        for (let i = 1; i < points.length - 1; i++) {
            const d = this._perpendicularDistance(points[i], first, last);
            if (d > maxDistance) { maxDistance = d; maxIndex = i; }
        }
        if (maxDistance > epsilon) {
            const left = this._simplifyPath(points.slice(0, maxIndex + 1), epsilon);
            const right = this._simplifyPath(points.slice(maxIndex), epsilon);
            return left.slice(0, -1).concat(right);
        }
        return [first, last];
    }

    _perpendicularDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.lat - lineStart.lat;
        const dy = lineEnd.lng - lineStart.lng;
        const mag = Math.sqrt(dx * dx + dy * dy);
        if (mag === 0) {
            return Math.sqrt(
                Math.pow(point.lat - lineStart.lat, 2) +
                Math.pow(point.lng - lineStart.lng, 2)
            );
        }
        let u = ((point.lat - lineStart.lat) * dx + (point.lng - lineStart.lng) * dy) / (mag * mag);
        u = Math.max(0, Math.min(1, u));
        const closestLat = lineStart.lat + u * dx;
        const closestLng = lineStart.lng + u * dy;
        return Math.sqrt(
            Math.pow(point.lat - closestLat, 2) +
            Math.pow(point.lng - closestLng, 2)
        );
    }
}

export { TrackingCollector };

window.log.info('[Tracker ' + F_V + '] (6) TrackingCollector dimuat');


// ================================ End Of File ================================