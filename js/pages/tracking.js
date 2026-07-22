/**
 * =================================================================================
 * FILE         : /js/pages/tracking.js
 * FILE VERSION : 2.0.1-rev8
 * APP VERSION  : 2.0.1
 * DATE         : 22 Juli 2026
 * @author      : gk
 *
 * CHANGELOG  :
 *
 * =================================================================================
 */

'use strict';

// ==================== VERSI FILE ====================
const F_V = '2.0.1-rev8';

import { StateManager } from '../core/state.js';
import { Router } from '../core/router.js';
import { PreferencesManager } from '../core/preferences.js';
import { StorageManager } from '../core/storage.js';
import { HeaderManager } from '../components/header.js';
import { FooterManager } from '../components/footer.js';
import { ThemeManager } from '../components/theme.js';
import { PopupManager } from '../components/popup.js';
import { MapManager } from '../maps/map.js';
import { Calculate } from '../maps/calculate.js';
import { GPS } from '../maps/gps.js';
import { LocationPicker } from '../maps/picker.js';
import {
    formatRupiah, formatKm, formatMenit,
    parseNumber
} from '../helpers/format.js';
import { getDriverColorAndBlink, validateCell } from '../helpers/output.js';

// =============================================================================
// 0. IKON LOKAL
// =============================================================================

const ICON = {
    FUEL: '⛽',
    MAINTENANCE: '🔧',
    MONEY: '💰',
    APP: '📱',
    DRIVER: '👤',
    PENUMPANG: '🧑',
    MAP_START: '🚩',
    MAP_FINISH: '🏁',
    CANCEL: '✖',
    SAVE: '💾',
    CLOSE: '❌',
    PAUSE: '⏸',
    PLAY: '▶️',
    STOP: '🟥',
    LOCATION: '📍',
    MAP: '🗺',
    GEAR: '⚙️',
    SOUND_ON: '🔊',
    SOUND_OFF: '🔈',
    EXPAND: '▷',
    COLLAPSE: '▽'
};

// =============================================================================
// 1. STATE INTERNAL
// =============================================================================

let isDestroyed = false;
let calculate = null;
let role = 'Driver';
let calcMode = 'standard';
let vehicleData = {};
let estimateResult = null;

let mapReady = false;
let currentPosition = null;
let currentAccuracy = 0;

let currentHeader = null;

let liveIncome = {
    driver: 0, app: 0, passengerPayment: 0, passengerBill: 0,
    bbm: 0, maintenance: 0, total: 0
};
let updateTimer = null;
let updateScheduled = false;
let lastUpdateDistance = 0;
let lastUpdateTime = 0;
let clockTimer = null;

let gpsReady = false;
const DISTANCE_THRESHOLD = 0.01;
const TIME_THRESHOLD = 60;
const UPDATE_DEBOUNCE_MS = 1000;

let maxJemput = { distance: 2, time: 15 };

let snapshotEngineData = null;
let snapshotCompactData = null;

let currentStage = 'idle';
let previousStage = null;

let _trackingModule = null;

let driverExpanded = false;
let appExpanded = false;

let shareCount = 1;
let setLimit = 0;

let isOfflineMode = false;

let offlineAdditionalData = {};

// State suara
let soundEnabled = true;
let beepAudioCtx = null;
let soundTimer = null;
let currentSoundInterval = null;

// Follow mode (rev7)
let followMode = false;
let followModeTimer = null;

// =============================================================================
// 2. HELPER: DEBOUNCE
// =============================================================================

function debounce(fn, delay) {
    var timer;
    return function() {
        var args = arguments;
        var self = this;
        clearTimeout(timer);
        timer = setTimeout(function() {
            fn.apply(self, args);
        }, delay);
    };
}

// =============================================================================
// 3. STAGE MANAGEMENT
// =============================================================================

function goToStage(newStage) {
    if (isDestroyed) return;

    var allowed = getAllowedStages();
    if (allowed.indexOf(newStage) === -1) {
        window.log.error('[Tracking ' + F_V + '] (1) Transisi stage tidak diizinkan: ' + currentStage + ' -> ' + newStage);
        return;
    }

    window.log.info('[Tracking ' + F_V + '] (2) goToStage: ' + currentStage + ' -> ' + newStage);

    if (newStage === 'paused') {
        previousStage = currentStage;
    }

    currentStage = newStage;
    StateManager.set('tracking.currentStage', newStage);

    // Manajemen suara berdasarkan stage baru
    if (newStage === 'idle' || newStage === 'paused') {
        stopSound();
    } else if (soundEnabled && calcMode !== 'operational' && (newStage === 'pickup' || newStage === 'dropoff')) {
        startSoundIfNeeded(currentSoundInterval);
    }

    // Follow mode aktif saat masuk stage aktif
    if (newStage === 'pickup' || newStage === 'dropoff' || newStage === 'operational') {
        followMode = true;
    } else if (newStage === 'paused') {
        // Saat pause, follow mode mati sementara
        followMode = false;
    }

    updateFooter();
    updateDistanceTimeDisplay();
    updateStatusText();

    if (newStage === 'idle') {
        resetToIdle();
    }
}

function getAllowedStages() {
    var isOperational = calcMode === 'operational';
    if (isOperational) {
        return ['idle', 'operational', 'paused'];
    }
    if (role === 'Penumpang') {
        return ['idle', 'dropoff', 'paused'];
    }
    return ['idle', 'pickup', 'dropoff', 'paused'];
}

function resetToIdle() {
    window.log.info('[Tracking ' + F_V + '] (3) resetToIdle()');

    if (calculate) {
        calculate.stop();
        calculate = null;
    }
    // GPS.stop() sekarang async, tapi kita tidak perlu await di sini
    // karena resetToIdle dipanggil dari berbagai tempat, dan beberapa tidak async.
    // Kita akan panggil GPS.stop() tanpa await, tapi pastikan fungsi pemanggil
    // yang membutuhkan kebersihan total menggunakan await.
    // Untuk konsistensi, kita tetap panggil tanpa await di sini, 
    // tapi fungsi yang memerlukan kepastian (seperti emergencyStop) akan await.
    GPS.stop();
    stopClockTimer();
    stopSound();
    followMode = false;
    if (followModeTimer) { clearTimeout(followModeTimer); followModeTimer = null; }

    if (mapReady && MapManager) {
        MapManager.clearPolylines();
        if (isOfflineMode) drawPlannedRoute();
        MapManager.clearMarkers();
    }

    liveIncome = { driver: 0, app: 0, passengerPayment: 0, passengerBill: 0, bbm: 0, maintenance: 0, total: 0 };
    lastUpdateDistance = 0;
    lastUpdateTime = 0;
    snapshotEngineData = null;
    snapshotCompactData = null;
    currentStage = 'idle';
    StateManager.set('tracking.currentStage', 'idle');
    driverExpanded = false;
    appExpanded = false;
    shareCount = 1;
    setLimit = 0;
    StateManager.set('tracking.offlineAdditionalData', null);

    updateFooter();
    updateDistanceTimeDisplay();
    updateStatusText();
    renderLiveIncome();
    renderTripSummaryCard();
}

// =============================================================================
// 4. HANDLER GPS
// =============================================================================

function handleGPSPosition(pos) {
    if (!calculate) return;
    currentPosition = { lat: pos.lat, lng: pos.lng };
    currentAccuracy = pos.accuracy || 0;
    calculate.addPosition(pos.lat, pos.lng, pos.accuracy, pos.timestamp);
    
    if (currentStage === 'pickup' && !MapManager.getMarker('start')) {
        MapManager.addMarker(pos.lat, pos.lng, 'start', { replace: false });
    }
    
    if (mapReady) updateMap();
    updateDistanceTimeDisplay();
    scheduleLiveIncomeUpdate();
    MapManager.setGPSStatusOverlay(true);
}

function handleGPSError(error) {
    window.log.error('[Tracking ' + F_V + '] (4) GPS error:', error.code, error.message);
    MapManager.setGPSStatusOverlay(false);
    if (ThemeManager) {
        ThemeManager.showToast(
            error.message || 'GPS tidak tersedia. Tracking tetap berjalan manual.',
            'warning'
        );
    }
}

// =============================================================================
// 5. PETA & GPS AWAL
// =============================================================================

/**
 * Retry GPS Once hingga 5 kali, jeda 3 detik.
 * Digunakan di idle untuk memastikan GPS siap sebelum tombol MULAI aktif.
 */
function acquireInitialPosition(callback) {
    var maxRetries = 5;
    var retryDelay = 3000;
    var attempt = 0;

    function tryGetPosition() {
        attempt++;
        GPS.getCurrentPosition(
            function(pos) {
                currentPosition = { lat: pos.lat, lng: pos.lng };
                currentAccuracy = pos.accuracy || 0;
                if (mapReady && MapManager) {
                    MapManager.updateUserMarker(pos.lat, pos.lng, role, vehicleData.E10);
                    MapManager.setView(pos.lat, pos.lng, 15);
                }
                updateDistanceTimeDisplay();
                MapManager.setGPSStatusOverlay(true);
                window.log.info('[Tracking] GPS ready setelah ' + attempt + ' percobaan');
                gpsReady = true;
                updateFooterForIdle();
                if (typeof callback === 'function') callback(true);
            },
            function(error) {
                if (error && (error.code === GPS.ERROR_CODES.PERMISSION_DENIED || error.code === 1)) {
                    window.log.warn('[Tracking] Izin lokasi ditolak, hentikan retry');
                    gpsReady = false;
                    updateFooterForIdle();
                    MapManager.setGPSStatusOverlay(false);
                    if (typeof callback === 'function') callback(false);
                    return;
                }
                if (attempt < maxRetries) {
                    window.log.info('[Tracking] Retry GPS ' + attempt + '/' + maxRetries + '...');
                    setTimeout(tryGetPosition, retryDelay);
                } else {
                    window.log.warn('[Tracking] GPS gagal setelah ' + maxRetries + ' percobaan');
                    gpsReady = false;
                    updateFooterForIdle();
                    MapManager.setGPSStatusOverlay(false);
                    if (typeof callback === 'function') callback(false);
                }
            }
        );
    }

    tryGetPosition();
}

async function initMap() {
    if (!MapManager) {
        var el = document.getElementById('tracking-map');
        if (el) el.innerHTML = '<div class="map-placeholder"><p>Peta tidak tersedia</p></div>';
        return;
    }
    try {
        var center = currentPosition
            ? [currentPosition.lat, currentPosition.lng]
            : MapManager.getDefaultCenter(vehicleData.E20);

        await MapManager.initForTracking('tracking-map', {
            center: center,
            zoom: 15,
            role: role,
            vehicleMode: vehicleData.E10,
            isOperational: calcMode === 'operational'
        });
        mapReady = true;
        window.log.info('[Tracking ' + F_V + '] (7) Peta berhasil diinisialisasi');

        MapManager.setStatusOverlay('Siap memulai!');
        MapManager.setAccuracyOverlay('--m');
        MapManager.setGPSStatusOverlay(false);

        MapManager.addWarningButton(function() {
            Router.navigateTo({ target: 'popup18' });
        });

        // Daftarkan callback interaksi pengguna untuk follow mode
        MapManager.onUserInteraction(function() {
            onMapUserInteraction();
        });

        // Tambahkan tombol center dengan callback khusus tracking
        MapManager.addCenterButton(function() {
            // Callback saat tombol center diklik
            GPS.getCurrentPosition(function(pos) {
                if (pos) {
                    currentPosition = { lat: pos.lat, lng: pos.lng };
                    currentAccuracy = pos.accuracy || 0;
                    MapManager.updateUserMarker(pos.lat, pos.lng, role, vehicleData.E10);
                    MapManager.setView(pos.lat, pos.lng, 15);
                }
                // Aktifkan follow mode
                followMode = true;
                // Reset timer interaksi
                if (followModeTimer) clearTimeout(followModeTimer);
            }, function(err) {
                // Gagal mendapatkan posisi, tetap aktifkan follow mode (menggunakan posisi terakhir)
                followMode = true;
                if (followModeTimer) clearTimeout(followModeTimer);
            });
        });

        if (currentPosition) {
            MapManager.updateUserMarker(currentPosition.lat, currentPosition.lng, role, vehicleData.E10);
        }
        if (calculate) updateMap();
        setTimeout(function() { if (MapManager) MapManager.invalidateSize(); }, 300);

        if (isOfflineMode) drawPlannedRoute();
    } catch (error) {
        window.log.error('[Tracking ' + F_V + '] (8) Gagal inisialisasi peta:', error);
        var el = document.getElementById('tracking-map');
        if (el) el.innerHTML = '<div class="map-placeholder"><p>Peta gagal dimuat</p></div>';
    }
}

// =============================================================================
// 6. FOLLOW MODE (rev7)
// =============================================================================

function onMapUserInteraction() {
    if (followMode) {
        followMode = false;
    }
    // Reset timer 10 detik
    if (followModeTimer) clearTimeout(followModeTimer);
    followModeTimer = setTimeout(function() {
        // Setelah 10 detik diam, tampilkan semua rute
        if (mapReady && MapManager && calculate) {
            var poly = calculate.getPolylineData();
            var allPos = poly.pickup.concat(poly.dropoff);
            if (currentPosition) allPos.push([currentPosition.lat, currentPosition.lng]);
            if (allPos.length > 0) MapManager.fitBounds(allPos);
        }
    }, 10000);
}

// =============================================================================
// 7. UI UPDATE (PLACEHOLDER & OVERLAY MAP)
// =============================================================================

function updateStatusText() {
    var texts = {
        idle: 'Siap memulai!',
        pickup: 'PICKUP',
        dropoff: 'DROPOFF',
        operational: 'OPERASIONAL',
        paused: 'PAUSED'
    };
    MapManager.setStatusOverlay(texts[currentStage] || '');
}

function updateDistanceTimeDisplay() {
    var indicator = calculate ? calculate.getLiveIndicatorData() : null;
    var phase = indicator ? indicator.phase : null;
    var isActivePhase = phase && phase.phase !== 'idle';

    var distEl = document.getElementById('tracking-distance');
    if (distEl) {
        if (isActivePhase) {
            distEl.textContent = formatKm(phase.distance, true, 2);
        } else {
            distEl.textContent = '-- km';
        }
    }

    var timeEl = document.getElementById('tracking-time');
    if (timeEl) {
        if (isActivePhase) {
            var sec = phase.elapsedSeconds;
            var h = Math.floor(sec / 3600);
            var m = Math.floor((sec % 3600) / 60);
            var s = Math.floor(sec % 60);
            timeEl.textContent = h > 0
                ? String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
                : String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        } else {
            timeEl.textContent = '--:--';
        }
    }

    if (currentStage !== 'idle' && currentAccuracy > 0) {
        MapManager.setAccuracyOverlay(currentAccuracy.toFixed(0) + 'm');
    } else {
        MapManager.setAccuracyOverlay('--m');
    }
}

function startClockTimer() {
    stopClockTimer();
    clockTimer = setInterval(function() {
        if (!isDestroyed) updateDistanceTimeDisplay();
    }, 1000);
}

function stopClockTimer() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
}

function updateMap() {
    if (!mapReady || !MapManager || !calculate) return;

    var poly = calculate.getPolylineData();
    if (poly.pickup.length > 0) MapManager.updatePolylineWithAccuracy(poly.pickup, 'pickup');
    if (poly.dropoff.length > 0) MapManager.updatePolylineWithAccuracy(poly.dropoff, 'dropoff');

    if (currentPosition) {
        MapManager.updateUserMarker(currentPosition.lat, currentPosition.lng, role, vehicleData.E10);
    }

    // Follow mode: auto-center ke posisi user
    if (followMode && currentPosition) {
        MapManager.setView(currentPosition.lat, currentPosition.lng, MapManager.getZoom());
    }
    // Tidak ada lagi fitBounds otomatis di sini
}

function scheduleLiveIncomeUpdate() {
    if (!calculate || currentStage === 'idle' || currentStage === 'paused') return;
    var summary = calculate.getSummary();
    if (!summary) return;
    var distDiff = Math.abs(summary.totalDistance - lastUpdateDistance);
    var timeDiff = Math.abs(summary.totalTime - lastUpdateTime);
    if ((distDiff >= DISTANCE_THRESHOLD || timeDiff >= TIME_THRESHOLD) && !updateScheduled) {
        updateScheduled = true;
        if (updateTimer) clearTimeout(updateTimer);
        updateTimer = setTimeout(function() {
            updateLiveIncome();
            updateScheduled = false;
            updateTimer = null;
        }, UPDATE_DEBOUNCE_MS);
    }
}

// =============================================================================
// 8. LIVE INCOME & SHARE/LIMIT
// =============================================================================

function updateLiveIncome(options) {
    if (!calculate) return;

    var opts = options || {};
    var share = opts.shareCount !== undefined ? opts.shareCount : shareCount;
    var limit = opts.setLimit !== undefined ? opts.setLimit : setLimit;

    var li = calculate.getLiveIncome(vehicleData, estimateResult, { shareCount: share, setLimit: limit });
    if (li) {
        liveIncome = li;
        var summary = calculate.getSummary();
        if (summary) {
            lastUpdateDistance = summary.totalDistance;
            lastUpdateTime = summary.totalTime;
        }
    }
    renderLiveIncome();
    renderTripSummaryCard();
    renderShareLimitResult();

    var driverInfo = getDriverColorAndBlink(liveIncome.driver, vehicleData.E10);
    currentSoundInterval = driverInfo.soundInterval;
    if (soundEnabled && (currentStage === 'pickup' || currentStage === 'dropoff') && calcMode !== 'operational') {
        startSoundIfNeeded(currentSoundInterval);
    } else {
        stopSound();
    }
}

function renderShareLimitResult() {
    var container = document.getElementById('share-limit-result');
    if (!container) return;

    var html = '';
    if (shareCount > 1 && liveIncome.shareCost > 0) {
        html += '<div class="live-income-row"><span>Share per orang</span><span class="live-income-value">' + formatRupiah(liveIncome.shareCost) + '</span></div>';
    }
    if (setLimit >= 1000) {
        var limitVal = liveIncome.limitResult || 0;
        var cls = limitVal >= 0 ? 'text-success' : 'text-danger';
        html += '<div class="live-income-row"><span>Sisa Limit</span><span class="live-income-value ' + cls + '">' + formatRupiah(limitVal) + '</span></div>';
    }
    container.innerHTML = html;
}

// =============================================================================
// 9. RENDER LIVE INCOME
// =============================================================================

function renderLiveIncome() {
    var container = document.getElementById('live-income-container');
    if (!container) return;

    if (calcMode === 'operational') {
        container.innerHTML = 
            '<div class="live-income-section">' +
                '<div class="live-income-row"><span>' + ICON.FUEL + ' BBM</span><span class="live-income-value">' + formatRupiah(liveIncome.bbm) + '</span></div>' +
                '<div class="live-income-row"><span>' + ICON.MAINTENANCE + ' Maintenance</span><span class="live-income-value">' + formatRupiah(liveIncome.maintenance) + '</span></div>' +
            '</div>' +
            '<div class="live-income-section" style="margin-top: var(--space-md);">' +
                '<div class="live-income-row"><span>' + ICON.MONEY + ' Total Biaya</span><span class="live-income-value text-xl">' + formatRupiah(liveIncome.total) + '</span></div>' +
            '</div>';
        return;
    }

    var isIdle = currentStage === 'idle';
    var driverInfo = isIdle
        ? { color: '', blink: '', soundInterval: null }
        : getDriverColorAndBlink(liveIncome.driver, vehicleData.E10);
    var billClass = liveIncome.passengerBill > 0 ? 'text-danger' : '';

    var driverIcon = driverExpanded ? ICON.COLLAPSE : ICON.EXPAND;
    var appIcon = appExpanded ? ICON.COLLAPSE : ICON.EXPAND;
    var driverChildrenClass = driverExpanded ? 'expanded' : '';
    var appChildrenClass = appExpanded ? 'expanded' : '';

    var loadGoogleMap = (liveIncome._engineResult && typeof liveIncome._engineResult.E807 !== 'undefined')
        ? liveIncome._engineResult.E807
        : 0;

    var appSection = isOfflineMode ? '' : 
        '<div class="live-income-section">' +
            '<div class="live-income-row live-income-toggle" id="toggle-app">' +
                '<span class="live-income-toggle-icon ' + appChildrenClass + '">' + appIcon + '</span>' +
                '<span>' + ICON.APP + ' APLIKASI</span>' +
                '<span class="live-income-value" style="margin-left: auto;">' + formatRupiah(liveIncome.app) + '</span>' +
            '</div>' +
            '<div class="live-income-children ' + appChildrenClass + '" id="children-app">' +
                '<div class="live-income-row live-income-sub">' +
                    '<span>' + ICON.MAP + ' Load Google Map</span>' +
                    '<span class="live-income-value">' + formatRupiah(loadGoogleMap) + '</span>' +
                '</div>' +
            '</div>' +
        '</div>';

    var showSpeaker = calcMode !== 'operational' && currentStage !== 'idle';
    var speakerHtml = showSpeaker
        ? '<span class="sound-toggle-btn" id="sound-toggle-btn" style="cursor:pointer; margin-right:4px;">' + (soundEnabled ? ICON.SOUND_ON : ICON.SOUND_OFF) + '</span>'
        : '';

    container.innerHTML = 
        '<div class="live-income-section">' +
            '<div class="live-income-row live-income-toggle" id="toggle-driver-app">' +
                '<span class="live-income-toggle-icon ' + driverChildrenClass + '">' + driverIcon + '</span>' +
                '<span>' + ICON.DRIVER + ' DRIVER</span>' +
                '<span class="live-income-value driver-value-large ' + driverInfo.color + ' ' + driverInfo.blink + '" style="margin-left: auto;">' +
                    speakerHtml + formatRupiah(liveIncome.driver) +
                '</span>' +
            '</div>' +
            '<div class="live-income-children ' + driverChildrenClass + '" id="children-driver">' +
                '<div class="live-income-row live-income-sub">' +
                    '<span>' + ICON.FUEL + ' BBM</span>' +
                    '<span class="live-income-value">' + formatRupiah(liveIncome.bbm) + '</span>' +
                '</div>' +
                '<div class="live-income-row live-income-sub">' +
                    '<span>' + ICON.MAINTENANCE + ' Kendaraan</span>' +
                    '<span class="live-income-value">' + formatRupiah(liveIncome.maintenance) + '</span>' +
                '</div>' +
            '</div>' +
        '</div>' +
        appSection +
        '<div class="live-income-section" style="margin-top: var(--space-md);">' +
            '<div class="live-income-row">' +
                '<span>' + ICON.PENUMPANG + ' PENUMPANG</span>' +
            '</div>' +
            '<div class="live-income-row live-income-sub">' +
                '<span>Pembayaran</span>' +
                '<span class="live-income-value">' + formatRupiah(liveIncome.passengerPayment) + '</span>' +
            '</div>' +
            '<div class="live-income-row live-income-sub">' +
                '<span>Tagihan</span>' +
                '<span class="live-income-value ' + billClass + '">' + formatRupiah(liveIncome.passengerBill) + '</span>' +
            '</div>' +
        '</div>';

    bindToggleEvents();
    bindSpeakerEvent();
}

function bindSpeakerEvent() {
    var btn = document.getElementById('sound-toggle-btn');
    if (!btn) return;
    btn.removeEventListener('click', handleSpeakerClick);
    btn.addEventListener('click', handleSpeakerClick);
}

function handleSpeakerClick(e) {
    e.stopPropagation();
    soundEnabled = !soundEnabled;
    var btn = document.getElementById('sound-toggle-btn');
    if (btn) {
        btn.textContent = soundEnabled ? ICON.SOUND_ON : ICON.SOUND_OFF;
    }
    if (soundEnabled) {
        startSoundIfNeeded(currentSoundInterval);
    } else {
        stopSound();
    }
}

function bindToggleEvents() {
    var toggleDriver = document.getElementById('toggle-driver-app');
    var toggleApp = document.getElementById('toggle-app');

    if (toggleDriver) {
        toggleDriver.removeEventListener('click', handleDriverToggle);
        toggleDriver.addEventListener('click', handleDriverToggle);
    }
    if (toggleApp) {
        toggleApp.removeEventListener('click', handleAppToggle);
        toggleApp.addEventListener('click', handleAppToggle);
    }
}

function handleDriverToggle() {
    driverExpanded = !driverExpanded;
    renderLiveIncome();
}

function handleAppToggle() {
    appExpanded = !appExpanded;
    renderLiveIncome();
}

// =============================================================================
// 10. CARD RINGKASAN PERJALANAN
// =============================================================================

function renderTripSummaryCard() {
    var card = document.getElementById('trip-summary-card');
    if (!card) return;

    var summary = calculate ? calculate.getSummary() : null;
    var isPenumpang = role === 'Penumpang';
    var isOperational = calcMode === 'operational';
    var isIdle = !summary || summary.status === 'idle' || currentStage === 'idle';

    var defaultPickupDist = (isPenumpang && isIdle) ? maxJemput.distance : 0;
    var defaultPickupTime = (isPenumpang && isIdle) ? maxJemput.time : 0;

    var pickupDist = isIdle ? defaultPickupDist : (summary ? summary.pickupDistance || 0 : 0);
    var pickupTime = isIdle ? defaultPickupTime : (summary ? summary.pickupTime || 0 : 0);
    var dropoffDist = isIdle ? 0 : (summary ? summary.dropoffDistance || 0 : 0);
    var dropoffTime = isIdle ? 0 : (summary ? summary.dropoffTime || 0 : 0);
    var pauseCount = summary ? summary.pauseCount || 0 : 0;
    var pauseTimeMin = summary ? Math.ceil((summary.pauseTime || 0) / 60) : 0;
    var jumpCount = summary ? summary.jumpCount || 0 : 0;
    var jumpTotal = summary ? summary.jumpTotal || 0 : 0;

    if (isOperational) {
        card.innerHTML = 
            '<div class="trip-summary-row">' +
                '<span>' + ICON.PAUSE + ' Pause</span>' +
                '<span>' + pauseCount + ' kali, ' + formatMenit(pauseTimeMin) + '</span>' +
            '</div>' +
            '<div class="trip-summary-row">' +
                '<span>' + ICON.LOCATION + ' Lompatan Jarak</span>' +
                '<span>' + jumpCount + ' kali, ' + formatKm(jumpTotal) + '</span>' +
            '</div>';
    } else if (role === 'Driver') {
        card.innerHTML = 
            '<div class="trip-summary-row">' +
                '<span>' + ICON.MAP_START + ' Penjemputan</span>' +
                '<span>' + formatKm(pickupDist) + ', ' + formatMenit(pickupTime) + '</span>' +
            '</div>' +
            '<div class="trip-summary-row">' +
                '<span>' + ICON.MAP_FINISH + ' Pengantaran</span>' +
                '<span>' + formatKm(dropoffDist) + ', ' + formatMenit(dropoffTime) + '</span>' +
            '</div>' +
            '<div class="trip-summary-divider"></div>' +
            '<div class="trip-summary-row">' +
                '<span>' + ICON.PAUSE + ' Pause</span>' +
                '<span>' + pauseCount + ' kali, ' + formatMenit(pauseTimeMin) + '</span>' +
            '</div>' +
            '<div class="trip-summary-row">' +
                '<span>' + ICON.LOCATION + ' Lompatan Jarak</span>' +
                '<span>' + jumpCount + ' kali, ' + formatKm(jumpTotal) + '</span>' +
            '</div>';
    } else {
        card.innerHTML = 
            '<div class="trip-summary-row">' +
                '<span>' + ICON.MAP_START + ' Penjemputan</span>' +
                '<span>' + formatKm(pickupDist) + ', ' + formatMenit(pickupTime) + '</span>' +
            '</div>' +
            '<div class="trip-summary-row">' +
                '<span>' + ICON.MAP_FINISH + ' Pengantaran</span>' +
                '<span>' + formatKm(dropoffDist) + ', ' + formatMenit(dropoffTime) + '</span>' +
            '</div>' +
            '<div class="trip-summary-divider"></div>' +
            '<div class="trip-summary-row">' +
                '<span>' + ICON.PAUSE + ' Pause</span>' +
                '<span>' + pauseCount + ' kali, ' + formatMenit(pauseTimeMin) + '</span>' +
            '</div>' +
            '<div class="trip-summary-row">' +
                '<span>' + ICON.LOCATION + ' Lompatan Jarak</span>' +
                '<span>' + jumpCount + ' kali, ' + formatKm(jumpTotal) + '</span>' +
            '</div>';
    }

    var existingBtn = document.getElementById('offline-biaya-btn');
    if (existingBtn) existingBtn.remove();

    if (isOfflineMode && !isOperational) {
        var btn = document.createElement('button');
        btn.id = 'offline-biaya-btn';
        btn.className = 'btn btn-outline btn-sm mt-sm';
        btn.style.width = '100%';
        btn.textContent = '+ BIAYA PERJALANAN';
        btn.addEventListener('click', function() {
            Router.navigateTo({ target: 'popup19' });
        });
        card.appendChild(btn);
    }
}

// =============================================================================
// 11. FUNGSI SUARA
// =============================================================================

function getBeepCtx() {
    if (!beepAudioCtx) {
        beepAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (beepAudioCtx.state === 'suspended') {
        beepAudioCtx.resume().catch(function() {});
    }
    return beepAudioCtx;
}

function playNotificationBeep() {
    try {
        var ctx = getBeepCtx();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 2800;
        osc.type = 'sine';
        gain.gain.value = 0.25;
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
        // Abaikan error audio
    }
}

function stopSound() {
    if (soundTimer) {
        clearInterval(soundTimer);
        soundTimer = null;
    }
    currentSoundInterval = null;
}

function startSoundIfNeeded(intervalMs) {
    stopSound();
    if (!intervalMs || !soundEnabled) return;
    if (calcMode === 'operational') return;
    if (currentStage !== 'pickup' && currentStage !== 'dropoff') return;
    soundTimer = setInterval(playNotificationBeep, intervalMs);
    currentSoundInterval = intervalMs;
}

// =============================================================================
// 12. KONTEN POPUP
// =============================================================================

function createCancelPopupContent() {
    var container = document.createElement('div');
    container.innerHTML = '<p>Data tracking akan dihentikan. Lanjutkan?</p>';

    var btnContainer = document.createElement('div');
    btnContainer.className = 'popup-footer';
    btnContainer.style.cssText = 'display:flex;gap:8px;padding:12px;border-top:1px solid var(--border);';

    var btnTidak = document.createElement('button');
    btnTidak.className = 'btn btn-outline';
    btnTidak.textContent = 'TIDAK';
    btnTidak.addEventListener('click', function() {
        Router.navigateTo({ popup: 0 });
    });

    var btnYa = document.createElement('button');
    btnYa.className = 'btn btn-danger';
    btnYa.textContent = 'YA';
    btnYa.addEventListener('click', async function() {
        window.log.info('[Tracking ' + F_V + '] (9) Batal tracking dikonfirmasi');
        await emergencyStop();
        await Router.navigateTo({ popup: 0 });
        Router.navigateTo({ target: 'trackingidle' });
    });

    btnContainer.appendChild(btnTidak);
    btnContainer.appendChild(btnYa);
    container.appendChild(btnContainer);

    container._popupOptions = {
        title: 'BATALKAN TRACKING?',
        showActions: false,
        showCloseButton: true,
        closeOnOverlay: false
    };

    return container;
}

function createSelesaiPopupContent() {
    if (!calculate) {
        var container = document.createElement('div');
        container.innerHTML = '<p>Data tracking tidak tersedia.</p>';
        container._popupOptions = { title: 'SELESAI TRACKING', showActions: false, showCloseButton: true, closeOnOverlay: false };
        return container;
    }

    var snapshot = calculate.takeSnapshot();
    snapshotEngineData = snapshot.engineData;
    snapshotCompactData = snapshot.compactData;
    window.log.info('[Tracking ' + F_V + '] (10) Snapshot tracking diambil');

    var summary = calculate.getSummary();
    var isOnline = calcMode !== 'operational' && !isOfflineMode;
    var isPenumpang = role === 'Penumpang';

    var container = document.createElement('div');
    container.className = 'popup-selesai-container';

    var resumeHtml = '<div class="card card-compact mb-md">';
    if (role === 'Driver') {
        resumeHtml += '<div class="detail-row"><span class="detail-label">' + ICON.MAP_START + ' Penjemputan</span><span class="detail-value">' + formatKm(summary.pickupDistance) + ', ' + formatMenit(summary.pickupTime) + '</span></div>';
    }
    resumeHtml += '<div class="detail-row"><span class="detail-label">' + ICON.MAP_FINISH + ' Pengantaran</span><span class="detail-value">' + formatKm(summary.dropoffDistance) + ', ' + formatMenit(summary.dropoffTime) + '</span></div>';
    resumeHtml += '<div class="detail-row"><span class="detail-label">' + ICON.PAUSE + ' Pause</span><span class="detail-value">' + summary.pauseCount + ' kali, total ' + formatMenit(Math.ceil(summary.pauseTime / 60)) + '</span></div>';
    resumeHtml += '</div>';

    var formHtml = '';
    if (isOnline) {
        formHtml += '<div class="input-wrapper"><span class="input-label">BIAYA APLIKASI</span><div class="input-field-container"><input type="number" class="input-field" id="popup-E92" placeholder="namanya aja rahasia.." inputmode="numeric"><span class="input-unit">Rp</span></div></div>';
        if (isPenumpang) {
            formHtml += '<div class="popup-divider"></div><div class="input-section-label">PENJEMPUTAN</div><div class="input-note">* otomatis terisi max jemput, bisa diubah</div>' +
                '<div class="input-dual">' +
                    '<div class="input-field-container"><input type="number" class="input-field" id="popup-E78" value="' + (maxJemput.distance || 2) + '" placeholder="jarak" inputmode="decimal" step="0.1"><span class="input-unit">km</span></div>' +
                    '<div class="input-field-container"><input type="number" class="input-field" id="popup-E80" value="' + (maxJemput.time || 15) + '" placeholder="waktu" inputmode="numeric"><span class="input-unit">mnt</span></div>' +
                '</div>';
        }
    } else if (isOfflineMode) {
        var hasAdditional = offlineAdditionalData.E100 > 0 || offlineAdditionalData.E102 > 0 || offlineAdditionalData.E104 > 0;
        if (hasAdditional) {
            formHtml += '<div class="popup-divider"></div><div class="input-section-label">BIAYA TAMBAHAN</div>';
            if (offlineAdditionalData.E100 > 0) formHtml += '<div class="detail-row"><span>Parkir</span><span>' + formatRupiah(offlineAdditionalData.E100) + '</span></div>';
            if (offlineAdditionalData.E102 > 0) formHtml += '<div class="detail-row"><span>Tol</span><span>' + formatRupiah(offlineAdditionalData.E102) + '</span></div>';
            if (offlineAdditionalData.E104 > 0) formHtml += '<div class="detail-row"><span>Lainnya</span><span>' + formatRupiah(offlineAdditionalData.E104) + '</span></div>';
        }
    }

    container.innerHTML = resumeHtml + formHtml;

    var btnContainer = document.createElement('div');
    btnContainer.className = 'popup-footer';
    btnContainer.style.cssText = 'display:flex;gap:8px;padding:12px;border-top:1px solid var(--border);';

    var btnManual = document.createElement('button');
    btnManual.className = 'btn btn-outline';
    btnManual.textContent = 'UBAH MANUAL';
    btnManual.addEventListener('click', function() {
        goToRealityManual(isPenumpang, isOnline);
    });

    var btnHitung = document.createElement('button');
    btnHitung.className = 'btn btn-primary';
    btnHitung.textContent = 'HITUNG';
    btnHitung.addEventListener('click', function() {
        finalizeTracking(isOnline, isPenumpang);
    });

    btnContainer.appendChild(btnManual);
    btnContainer.appendChild(btnHitung);
    container.appendChild(btnContainer);

    container._popupOptions = {
        title: 'SELESAI TRACKING',
        showActions: false,
        showCloseButton: true,
        closeOnOverlay: false,
        onClose: function() {
            if (typeof updateFooter === 'function') {
                updateFooter();
            }
            if (window.__trackingResetSlide) {
                delete window.__trackingResetSlide;
            }
        }
    };

    return container;
}

function createOfflineBiayaTambahanContent() {
    var isMotor = vehicleData.E10 === 'Motor';

    var container = document.createElement('div');
    container.className = 'popup-biaya-tambahan';

    var tollHTML = '';
    if (!isMotor) {
        tollHTML = '<div class="input-wrapper">' +
            '<span class="input-label">TOLL</span>' +
            '<div class="input-field-container">' +
                '<input type="number" class="input-field" id="popup-offline-E102" value="' + (offlineAdditionalData.E102 || '') + '" placeholder="" inputmode="numeric" autocomplete="off">' +
                '<span class="input-unit">Rp</span>' +
            '</div></div>';
    }

    container.innerHTML = 
        '<div class="input-wrapper">' +
            '<span class="input-label">PARKIR</span>' +
            '<div class="input-field-container">' +
                '<input type="number" class="input-field" id="popup-offline-E100" value="' + (offlineAdditionalData.E100 || '') + '" placeholder="" inputmode="numeric" autocomplete="off">' +
                '<span class="input-unit">Rp</span>' +
            '</div></div>' +
        tollHTML +
        '<div class="input-wrapper">' +
            '<span class="input-label">LAINNYA</span>' +
            '<div class="input-field-container">' +
                '<input type="number" class="input-field" id="popup-offline-E104" value="' + (offlineAdditionalData.E104 || '') + '" placeholder="" inputmode="numeric" autocomplete="off">' +
                '<span class="input-unit">Rp</span>' +
            '</div></div>';

    container._popupOptions = {
        title: 'BIAYA TAMBAHAN',
        showCloseButton: true,
        closeOnOverlay: true,
        showActions: true,
        buttons: [
            {
                text: ICON.CANCEL + ' BATAL',
                type: 'outline',
                onClick: function() {
                    Router.navigateTo({ popup: 0 });
                }
            },
            {
                text: ICON.SAVE + ' SIMPAN',
                type: 'primary',
                onClick: function() {
                    var e100 = parseNumber(document.getElementById('popup-offline-E100') ? document.getElementById('popup-offline-E100').value : '');
                    var e104 = parseNumber(document.getElementById('popup-offline-E104') ? document.getElementById('popup-offline-E104').value : '');
                    offlineAdditionalData.E100 = e100 || null;
                    offlineAdditionalData.E104 = e104 || null;
                    StateManager.updateInput('E100', offlineAdditionalData.E100);
                    StateManager.updateInput('E104', offlineAdditionalData.E104);

                    if (!isMotor) {
                        var e102 = parseNumber(document.getElementById('popup-offline-E102') ? document.getElementById('popup-offline-E102').value : '');
                        offlineAdditionalData.E102 = e102 || null;
                        StateManager.updateInput('E102', offlineAdditionalData.E102);
                    } else {
                        offlineAdditionalData.E102 = null;
                        StateManager.updateInput('E102', null);
                    }

                    StateManager.set('tracking.offlineAdditionalData', offlineAdditionalData);
                    renderTripSummaryCard();
                    Router.navigateTo({ popup: 0 });
                }
            }
        ]
    };

    return container;
}

function createWarningPopupContent() {
    function cleanTel(num) {
        if (!num) return '';
        var match = num.match(/^(\+?)\D*(\d[\d\s\-\(\)]*)$/);
        if (!match) {
            return num.replace(/\D/g, '');
        }
        return match[1] + match[2].replace(/\D/g, '');
    }

    function cleanWA(num) {
        if (!num) return '';
        var cleaned = num.replace(/\D/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }
        if (cleaned.startsWith('+')) {
            cleaned = cleaned.substring(1);
        }
        return cleaned;
    }

    var emergencyContacts = StorageManager.getEmergencyContacts();
    var kerabat = emergencyContacts.kerabat || '';
    var darurat = emergencyContacts.darurat || '112';
    var ambulance = emergencyContacts.ambulance || '118';
    var polisi = emergencyContacts.polisi || '110';

    var kerabatClean = cleanWA(kerabat);
    var daruratClean = cleanTel(darurat);
    var ambulanceClean = cleanTel(ambulance);
    var polisiClean = cleanTel(polisi);

    var container = document.createElement('div');
    container.className = 'popup-warning-content';

    container.innerHTML = 
        '<p style="font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: 16px; line-height: 1.6;">' +
            'Ini adalah cara yg sama dan dilakukan oleh aplikasi untuk melindungi driver/penumpang:' +
        '</p>' +
        '<ol style="padding-left: 1.5em; margin-bottom: 16px; line-height: 1.6; font-size: var(--text-xs); color: var(--text-secondary);">' +
            '<li>Simpan identitas dan kontak darurat di tempat aman tapi mudah ditemukan.</li>' +
            '<li>Beli asuransi.</li>' +
            '<li>Simpan kontak darurat.</li>' +
            '<li>Share live lokasi (WA) anda kepada kerabat terpercaya.</li>' +
        '</ol>' +
        '<div style="display: flex; flex-direction: column; gap: 8px;">' +
            '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                '<span style="font-size: var(--text-xs);">WA KERABAT</span>' +
                (kerabatClean ? 
                    '<a href="https://wa.me/' + kerabatClean + '" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-success" style="width: 90px; text-align: center; text-decoration: none; font-size: var(--text-xs);">HUBUNGI</a>' :
                    '<button class="btn btn-sm btn-outline" style="width: 90px; font-size: var(--text-xs);" disabled>SIMPAN</button>'
                ) +
            '</div>' +
            '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                '<span style="font-size: var(--text-xs);">KONTAK DARURAT</span>' +
                '<a href="tel:' + daruratClean + '" class="btn btn-sm btn-danger" style="width: 90px; text-align: center; text-decoration: none; font-size: var(--text-xs);">' + darurat + '</a>' +
            '</div>' +
            '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                '<span style="font-size: var(--text-xs);">AMBULANCE</span>' +
                '<a href="tel:' + ambulanceClean + '" class="btn btn-sm btn-info" style="width: 90px; text-align: center; text-decoration: none; font-size: var(--text-xs);">' + ambulance + '</a>' +
            '</div>' +
            '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                '<span style="font-size: var(--text-xs);">POLISI</span>' +
                '<a href="tel:' + polisiClean + '" class="btn btn-sm" style="width: 90px; text-align: center; text-decoration: none; font-size: var(--text-xs); background-color: #8B7355; color: white; border-color: #8B7355;">' + polisi + '</a>' +
            '</div>' +
        '</div>';

    if (!kerabat) {
        var simpanBtn = container.querySelector('.btn-outline[disabled]');
        if (simpanBtn) {
            simpanBtn.addEventListener('click', function() {
                if (ThemeManager) ThemeManager.showToast('Simpan kontak di Pengaturan', 'info');
            });
        }
    }

    container._popupOptions = {
        title: 'Peringatan',
        showActions: false,
        showCloseButton: true,
        closeOnOverlay: true,
        buttons: [
            { text: 'MENGERTI', type: 'primary', action: 'confirm' }
        ]
    };

    return container;
}

// =============================================================================
// 13. FINALISASI & PEMBATALAN (sekarang async)
// =============================================================================

async function emergencyStop() {
    if (calculate) { calculate.stop(); calculate = null; }
    await GPS.stop();                         // await agar notifikasi hilang total
    
    // Panggil forceCleanup untuk memastikan GPS & notifikasi mati total
    await GPS.forceCleanup(); 
    
    stopClockTimer();
    stopSound();
    if (beepAudioCtx) {
        beepAudioCtx.close();
        beepAudioCtx = null;
    }
    followMode = false;
    if (followModeTimer) { clearTimeout(followModeTimer); followModeTimer = null; }
}

async function finalizeTracking(isOnline, isPenumpang) {
    window.log.info('[Tracking ' + F_V + '] (11) finalizeTracking()');

    if (!snapshotEngineData || !calculate) return;

    var additionalData = {};
    if (isOnline) {
        var e92 = parsePopupInput('popup-E92', 'E92');
        if (e92 !== null) additionalData.E92 = e92;
        if (isPenumpang) {
            var e78 = parsePopupInput('popup-E78', 'E78');
            var e80 = parsePopupInput('popup-E80', 'E80');
            if (e78 !== null) additionalData.E78 = e78;
            if (e80 !== null) additionalData.E80 = e80;
        }
    } else if (isOfflineMode) {
        if (offlineAdditionalData.E100) additionalData.E100 = offlineAdditionalData.E100;
        if (offlineAdditionalData.E102) additionalData.E102 = offlineAdditionalData.E102;
        if (offlineAdditionalData.E104) additionalData.E104 = offlineAdditionalData.E104;
    }

    if (calcMode === 'operational') {
        additionalData.shareCount = shareCount;
        additionalData.setLimit = setLimit;
    }

    var realityResult;
    try {
        realityResult = calculate.finalize(vehicleData, additionalData);
    } catch (e) {
        if (ThemeManager) ThemeManager.showToast('Gagal menghitung hasil', 'error');
        return;
    }

    if (StateManager) {
        var finalInput = Object.assign({}, vehicleData, snapshotEngineData, additionalData);
        StateManager.set('input', finalInput);
        StateManager.set('realityResult', realityResult);
        StateManager.set('trackingData', snapshotCompactData);
        window.log.info('[Tracking ' + F_V + '] (12) finalizeTracking: hasil disimpan ke state');
    }

    LocationPicker.clearSavedPolyline();

    await emergencyStop(); // sekarang async
    _trackingModule = null;
    window.trackingModule = null;

    if (window.Cache) {
        window.Cache.invalidate('tracking');
    }

    await Router.navigateTo({ popup: 0 });
    Router.navigateTo({ target: 'result' });
}

async function goToRealityManual(isPenumpang, isOnline) {
    window.log.info('[Tracking ' + F_V + '] (13) goToRealityManual()');

    if (!snapshotEngineData || !calculate) return;

    var data = Object.assign({}, snapshotEngineData);
    if (isPenumpang && isOnline) {
        var e78 = parsePopupInput('popup-E78', 'E78');
        var e80 = parsePopupInput('popup-E80', 'E80');
        if (e78 !== null) data.E78 = e78;
        if (e80 !== null) data.E80 = e80;
    }

    if (StateManager) {
        StateManager.batchUpdateInput({
            E78: data.E78 !== undefined ? data.E78 : data.pickupDistance,
            E80: data.E80 !== undefined ? data.E80 : data.pickupTime,
            E82: data.E82 !== undefined ? data.E82 : data.dropoffDistance,
            E84: data.E84 !== undefined ? data.E84 : data.dropoffTime
        });
        
        if (isOfflineMode) {
            StateManager.updateInput('E100', offlineAdditionalData.E100 !== undefined ? offlineAdditionalData.E100 : null);
            StateManager.updateInput('E102', offlineAdditionalData.E102 !== undefined ? offlineAdditionalData.E102 : null);
            StateManager.updateInput('E104', offlineAdditionalData.E104 !== undefined ? offlineAdditionalData.E104 : null);
        }
        
        StateManager.set('trackingData', null);
        StateManager.set('realityResult', null);
        window.log.info('[Tracking ' + F_V + '] (14) goToRealityManual: data realitas diset ulang');
    }

    await emergencyStop(); // sekarang async
    _trackingModule = null;
    window.trackingModule = null;

    if (window.Cache) {
        window.Cache.invalidate('tracking');
    }

    var target = calcMode === 'operational' ? 'home' : 'reality';
    await Router.navigateTo({ popup: 0 });
    Router.navigateTo({ target: target });
}

function parsePopupInput(id, cell) {
    var el = document.getElementById(id);
    if (!el) return null;
    var val = el.value.trim();
    if (!val) return null;
    var num = parseNumber(val);
    if (isNaN(num)) return null;
    var validated = validateCell(cell, num);
    return validated !== undefined ? validated : num;
}

// =============================================================================
// 14. FOOTER & HEADER
// =============================================================================

function updateFooterForIdle() {
    var footerContainer = document.getElementById('app-footer');
    if (!footerContainer || !FooterManager) return;

    var targetBack = calcMode === 'operational' ? 'home' : 'reality';

    var callbacks = {
        onClose: function() { Router.navigateTo({ target: targetBack }); },
        onStart: function() { Router.navigateTo({ target: 'trackingactive' }); }
    };

    var footer = FooterManager.create('layoutC', {
        frame1: { type: 'icon', content: FooterManager.createIconButton(ICON.CLOSE, callbacks.onClose, 'Tutup') },
        frame2: { type: 'icon', content: FooterManager.createIconButton(ICON.PAUSE, null, 'Pause') },
        frame3: { type: 'flex', content: FooterManager.createSlideContent('MULAI', '', callbacks.onStart, 'primary') }
    });

    if (footer) {
        var pauseBtn = footer.querySelectorAll('.footer-icon')[1];
        if (pauseBtn) pauseBtn.disabled = true;
        
        // Nonaktifkan slide MULAI jika GPS tidak siap
        var slide = footer.querySelector('.slide-action');
        if (slide) {
            if (!gpsReady) {
                slide.classList.add('slide-action--disabled');
                slide.style.pointerEvents = 'none';
                slide.style.opacity = '0.5';
                slide.setAttribute('aria-disabled', 'true');
                slide.title = 'Tunggu izin lokasi';
            } else {
                slide.classList.remove('slide-action--disabled');
                slide.style.pointerEvents = '';
                slide.style.opacity = '';
                slide.removeAttribute('aria-disabled');
                slide.title = '';
            }
        }
    }

    footerContainer.innerHTML = '';
    if (footer) footerContainer.appendChild(footer);
}

function updateFooterForActive() {
    var footerContainer = document.getElementById('app-footer');
    if (!footerContainer || !FooterManager) return;

    var stage = currentStage;

    var callbacks = {
        onStop: function() { Router.navigateTo({ target: 'popup14' }); },
        onPause: function() {
            if (calculate) {
                calculate.pause();  // JANGAN hentikan GPS
                stopClockTimer();
                goToStage('paused');
            }
        },
        onResume: function() {
            var resumeStage = previousStage || 'pickup';
            // GPS Once untuk titik sambung akurat, lalu resume calculate (tanpa restart GPS)
            GPS.getCurrentPosition(function(pos) {
                if (pos) {
                    currentPosition = { lat: pos.lat, lng: pos.lng };
                    currentAccuracy = pos.accuracy || 0;
                    if (calculate) calculate.addPosition(pos.lat, pos.lng, pos.accuracy, pos.timestamp);
                }
                if (calculate) calculate.resume();
                startClockTimer();
                goToStage(resumeStage);
            }, function(err) {
                // Gagal, tetap resume
                if (calculate) calculate.resume();
                startClockTimer();
                goToStage(resumeStage);
            });
        },
        onAngkut: function() {
            if (calculate) {
                calculate.switchToDropoff();
                var pos = currentPosition || (calculate.getLastPosition ? calculate.getLastPosition() : null);
                if (pos) {
                    if (MapManager) MapManager.addMarker(pos.lat, pos.lng, 'pickup', { replace: false });
                } else {
                    GPS.getCurrentPosition(function(p) {
                        if (p && MapManager) {
                            MapManager.addMarker(p.lat, p.lng, 'pickup', { replace: false });
                        }
                    });
                }
            }
            goToStage('dropoff');
        },
        onSelesai: function() {
            // GPS Once untuk posisi akhir akurat
            GPS.getCurrentPosition(function(pos) {
                if (pos) {
                    currentPosition = { lat: pos.lat, lng: pos.lng };
                    currentAccuracy = pos.accuracy || 0;
                    if (calculate) {
                        calculate.addPosition(pos.lat, pos.lng, pos.accuracy, pos.timestamp);
                    }
                    if (MapManager) {
                        MapManager.addMarker(pos.lat, pos.lng, 'finish', { replace: false });
                    }
                } else {
                    if (currentPosition && MapManager) {
                        MapManager.addMarker(currentPosition.lat, currentPosition.lng, 'finish', { replace: false });
                    }
                }
                window.__trackingResetSlide = function() {
                    if (typeof updateFooter === 'function') updateFooter();
                };
                Router.navigateTo({ target: 'popup15' });
            }, function(err) {
                if (currentPosition && MapManager) {
                    MapManager.addMarker(currentPosition.lat, currentPosition.lng, 'finish', { replace: false });
                }
                window.__trackingResetSlide = function() {
                    if (typeof updateFooter === 'function') updateFooter();
                };
                Router.navigateTo({ target: 'popup15' });
            });
        }
    };

    var f1, f2, f3;

    switch (stage) {
        case 'paused':
            f1 = { type: 'icon', content: FooterManager.createIconButton(ICON.STOP, callbacks.onStop, 'Stop') };
            f2 = { type: 'icon', content: FooterManager.createIconButton(ICON.PLAY, callbacks.onResume, 'Lanjutkan') };
            f3 = { type: 'flex', content: FooterManager.createSlideContent('LANJUT', '', callbacks.onResume, 'warning') };
            break;
        case 'pickup':
            f1 = { type: 'icon', content: FooterManager.createIconButton(ICON.STOP, callbacks.onStop, 'Stop') };
            f2 = { type: 'icon', content: FooterManager.createIconButton(ICON.PAUSE, callbacks.onPause, 'Pause') };
            f3 = { type: 'flex', content: FooterManager.createSlideContent('ANGKUT', '', callbacks.onAngkut, 'warning') };
            break;
        case 'dropoff':
        case 'operational':
            f1 = { type: 'icon', content: FooterManager.createIconButton(ICON.STOP, callbacks.onStop, 'Stop') };
            f2 = { type: 'icon', content: FooterManager.createIconButton(ICON.PAUSE, callbacks.onPause, 'Pause') };
            f3 = { type: 'flex', content: FooterManager.createSlideContent('SELESAI', '', callbacks.onSelesai, 'danger') };
            break;
        default:
            f1 = { type: 'icon', content: FooterManager.createIconButton(ICON.STOP, callbacks.onStop, 'Stop') };
            f2 = { type: 'icon', content: FooterManager.createIconButton(ICON.PAUSE, callbacks.onPause, 'Pause') };
            f3 = { type: 'flex', content: FooterManager.createSlideContent('SELESAI', '', callbacks.onSelesai, 'danger') };
    }

    var footer = FooterManager.create('layoutC', { frame1: f1, frame2: f2, frame3: f3 });
    footerContainer.innerHTML = '';
    if (footer) footerContainer.appendChild(footer);
}

function updateFooter() {
    updateFooterForActive();
}

function updateHeader() {
    var headerContainer = document.getElementById('app-header');
    if (!headerContainer || !HeaderManager) return;
    if (currentHeader) { HeaderManager.destroy(currentHeader); }
    var landingText = window.APP_CONFIG ? window.APP_CONFIG.landingLink || 'linktr.ee/KUPASTARIF' : 'linktr.ee/KUPASTARIF';
    var header = HeaderManager.create('landing', { landingText: landingText });
    headerContainer.innerHTML = '';
    if (header) { headerContainer.appendChild(header); currentHeader = header; }
    else { currentHeader = null; }
}

// =============================================================================
// 15. BUILD HTML
// =============================================================================

function buildHTML() {
    return (
        '<div class="page-container tracking-page">' +
            '<div class="tracking-map-section">' +
                '<div class="tracking-map-wrapper">' +
                    '<div id="tracking-map" class="tracking-map" style="height: 100%;"></div>' +
                '</div>' +
                '<div class="tracking-stats">' +
                    '<div class="tracking-stat-item"><span id="tracking-distance">-- km</span><span class="stat-label">JARAK</span></div>' +
                    '<div class="tracking-stat-item"><span id="tracking-time">--:--</span><span class="stat-label">WAKTU</span></div>' +
                '</div>' +
            '</div>' +
            '<div class="tracking-live-income card">' +
                '<div id="live-income-container" class="live-income-content"></div>' +
            '</div>' +
            '<div id="operational-extra-card" class="card" style="display: none;">' +
                '<div class="card-header"><span class="card-title">' + ICON.GEAR + ' SHARE & LIMIT</span></div>' +
                '<div class="card-content">' +
                    '<div class="input-wrapper">' +
                        '<span class="input-label">Share Cost</span>' +
                        '<div class="input-field-container" style="padding: 0;">' +
                            '<div style="width: 100%; max-width: 200px; margin: 0 auto; padding: var(--space-sm);">' +
                                '<input type="range" id="share-slider" min="1" max="6" value="1" step="1" style="width: 100%;">' +
                                '<div class="text-muted text-xs text-center" id="share-value">1 orang</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="input-wrapper">' +
                        '<span class="input-label">Set Limit</span>' +
                        '<div class="input-field-container">' +
                            '<input type="number" class="input-field" id="limit-input" min="0" placeholder="0" value="0" inputmode="numeric">' +
                            '<span class="input-unit">Rp</span>' +
                        '</div>' +
                    '</div>' +
                    '<div id="share-limit-result" class="mt-sm"></div>' +
                '</div>' +
            '</div>' +
            '<div class="card trip-summary-card" id="trip-summary-card"></div>' +
        '</div>'
    );
}

// =============================================================================
// 16. RENDER IDLE
// =============================================================================

async function renderIdle(params, context) {
    var content = document.getElementById('app-content');
    if (!content) return;

    isDestroyed = false;
    snapshotEngineData = null;
    driverExpanded = false;
    appExpanded = false;
    shareCount = 1;
    setLimit = 0;
    offlineAdditionalData = {};
    soundEnabled = true;
    stopSound();
    followMode = false;
    if (followModeTimer) { clearTimeout(followModeTimer); followModeTimer = null; }
    
    StateManager.updateInput('E100', null);
    StateManager.updateInput('E102', null);
    StateManager.updateInput('E104', null);
    StateManager.set('tracking.offlineAdditionalData', null);
    offlineAdditionalData = { E100: null, E102: null, E104: null };

    liveIncome = { driver: 0, app: 0, passengerPayment: 0, passengerBill: 0, bbm: 0, maintenance: 0, total: 0 };
    lastUpdateDistance = 0;
    lastUpdateTime = 0;
    updateScheduled = false;
    if (updateTimer) { clearTimeout(updateTimer); updateTimer = null; }

    var input = StateManager.get('input') || {};
    vehicleData = Object.assign({}, input);
    role = vehicleData.E12 || 'Driver';
    calcMode = StateManager.get('calcMode') || 'standard';
    estimateResult = StateManager.get('estimateResult');

    isOfflineMode = calcMode === 'standard' && vehicleData.E36 === 'offline';

    var savedOfflineData = StateManager.get('tracking.offlineAdditionalData');
    if (savedOfflineData) {
        offlineAdditionalData = Object.assign({}, savedOfflineData);
    }

    if (calculate) {
        maxJemput.distance = calculate.getMaxPickupDistance();
        maxJemput.time = calculate.getMaxPickupTime();
    } else {
        maxJemput.distance = 2;
        maxJemput.time = 15;
    }

    currentStage = 'idle';
    previousStage = null;

    window.log.info('[Tracking ' + F_V + '] (15) renderIdle() - mode: ' + calcMode + ', role: ' + role + ', offline: ' + isOfflineMode);

    if (calculate) {
        calculate.stop();
        calculate = null;
    }
    // Bersihkan GPS secara total dengan await
    await GPS.stop();
    stopClockTimer();
    stopSound();

    content.innerHTML = buildHTML();
    updateHeader();
    updateFooterForIdle();
    renderLiveIncome();
    renderTripSummaryCard();

    var extraCard = document.getElementById('operational-extra-card');
    if (extraCard) {
        extraCard.style.display = calcMode === 'operational' ? '' : 'none';
    }

    if (!mapReady) {
        calculate = new Calculate({ role: role, trackingMode: calcMode, vehicleData: vehicleData, estimateResult: estimateResult });
        window.__trackingCalculate = calculate;
        calculate.setCallbacks({
            onStatusChange: function() {},
            onJump: function(data) {
                if (ThemeManager) ThemeManager.showToast('Loncatan jarak terdeteksi', 'warning', 5000);
            }
        });
        setTimeout(function() {
            // Retry GPS hingga 5 kali, reaktif footer jika berhasil
            acquireInitialPosition(function(granted) {
                if (!granted && ThemeManager) {
                    ThemeManager.showToast('GPS tidak tersedia. Anda dapat mencoba lagi.', 'warning');
                }
            });
            initMap();
        }, 100);
    } else {
        acquireInitialPosition(function(granted) {
            if (!granted && ThemeManager) {
                ThemeManager.showToast('GPS tidak tersedia. Anda dapat mencoba lagi.', 'warning');
            }
        });
        if (isOfflineMode) drawPlannedRoute();
    }

    if (calcMode === 'operational') {
        initShareLimitUI();
    }

    _trackingModule = { emergencyStop: emergencyStop };
    window.trackingModule = _trackingModule;

    window.log.info('[Tracking ' + F_V + '] (16) renderIdle() selesai');
}

// =============================================================================
// 17. RENDER ACTIVE
// =============================================================================

async function renderActive(params, context) {
    var content = document.getElementById('app-content');
    if (!content) return;

    isDestroyed = false;
    snapshotEngineData = null;
    driverExpanded = false;
    appExpanded = false;
    shareCount = 1;
    setLimit = 0;
    offlineAdditionalData = {};
    soundEnabled = true;
    stopSound();
    followMode = false;
    if (followModeTimer) { clearTimeout(followModeTimer); followModeTimer = null; }

    liveIncome = { driver: 0, app: 0, passengerPayment: 0, passengerBill: 0, bbm: 0, maintenance: 0, total: 0 };
    lastUpdateDistance = 0;
    lastUpdateTime = 0;
    updateScheduled = false;
    if (updateTimer) { clearTimeout(updateTimer); updateTimer = null; }

    var input = StateManager.get('input') || {};
    vehicleData = Object.assign({}, input);
    role = vehicleData.E12 || 'Driver';
    calcMode = StateManager.get('calcMode') || 'standard';
    estimateResult = StateManager.get('estimateResult');

    isOfflineMode = calcMode === 'standard' && vehicleData.E36 === 'offline';

    var savedOfflineData = StateManager.get('tracking.offlineAdditionalData');
    if (savedOfflineData) {
        offlineAdditionalData = Object.assign({}, savedOfflineData);
    }

    if (calculate) {
        maxJemput.distance = calculate.getMaxPickupDistance();
        maxJemput.time = calculate.getMaxPickupTime();
    } else {
        maxJemput.distance = 2;
        maxJemput.time = 15;
    }

    var targetStage;
    if (calcMode === 'operational') targetStage = 'operational';
    else if (role === 'Penumpang') targetStage = 'dropoff';
    else targetStage = 'pickup';

    currentStage = targetStage;
    previousStage = null;

    window.log.info('[Tracking ' + F_V + '] (17) renderActive() - mode: ' + calcMode + ', role: ' + role + ', stage: ' + targetStage + ', offline: ' + isOfflineMode);

    if (calculate) {
        calculate.stop();
        calculate = null;
    }
    // Bersihkan GPS secara total sebelum memulai ulang
    await GPS.stop();
    stopClockTimer();
    stopSound();

    calculate = new Calculate({ role: role, trackingMode: calcMode, vehicleData: vehicleData, estimateResult: estimateResult });
    window.__trackingCalculate = calculate;
    calculate.setCallbacks({
        onStatusChange: function() {
            updateFooterForActive();
            updateDistanceTimeDisplay();
            updateStatusText();
        },
        onJump: function(data) {
            if (ThemeManager) ThemeManager.showToast('Loncatan jarak terdeteksi', 'warning', 5000);
        }
    });

    calculate.start();
    // Mulai GPS baru (start async, tapi kita tidak perlu await di sini karena callback)
    GPS.start(handleGPSPosition, handleGPSError);
    startClockTimer();
    followMode = true; // aktifkan follow mode

    content.innerHTML = buildHTML();
    updateHeader();
    updateFooterForActive();
    renderLiveIncome();
    renderTripSummaryCard();

    var extraCard = document.getElementById('operational-extra-card');
    if (extraCard) {
        extraCard.style.display = calcMode === 'operational' ? '' : 'none';
    }

    setTimeout(function() {
        initMap();
    }, 100);

    StateManager.set('tracking.currentStage', currentStage);

    updateLiveIncome();

    if (calcMode === 'operational') {
        initShareLimitUI();
    }

    _trackingModule = { emergencyStop: emergencyStop };
    window.trackingModule = _trackingModule;

    window.log.info('[Tracking ' + F_V + '] (18) renderActive() selesai');
}

// =============================================================================
// 18. POLYLINE RENCANA (PICKER)
// =============================================================================

function drawPlannedRoute() {
    if (!isOfflineMode) {
        window.log.info('[Tracking ' + F_V + '] (19) drawPlannedRoute: bukan mode offline, lewati');
        return;
    }

    var polylineData = LocationPicker.getSavedPolyline();
    if (!polylineData || !Array.isArray(polylineData.coordinates) || polylineData.coordinates.length < 2) {
        window.log.info('[Tracking ' + F_V + '] (20) drawPlannedRoute: tidak ada polyline valid');
        return;
    }

    MapManager.addPlannedRoute(polylineData.coordinates);

    window.log.info('[Tracking ' + F_V + '] (21) drawPlannedRoute: polyline rencana ditambahkan ke peta');
}

// =============================================================================
// 19. INISIALISASI SHARE COST & SET LIMIT UI
// =============================================================================

function initShareLimitUI() {
    var slider = document.getElementById('share-slider');
    var limitInput = document.getElementById('limit-input');
    if (!slider || !limitInput) return;

    slider.max = vehicleData.E10 === 'Mobil' ? 6 : 2;
    slider.value = shareCount;
    limitInput.value = setLimit;

    document.getElementById('share-value').textContent = shareCount + ' orang';

    var debouncedUpdate = debounce(function() {
        shareCount = parseInt(slider.value) || 1;
        setLimit = parseInt(limitInput.value) || 0;
        document.getElementById('share-value').textContent = shareCount + ' orang';
        updateLiveIncome({ shareCount: shareCount, setLimit: setLimit });
    }, 500);

    slider.addEventListener('input', function() {
        document.getElementById('share-value').textContent = slider.value + ' orang';
        debouncedUpdate();
    });

    limitInput.addEventListener('input', debouncedUpdate);

    renderShareLimitResult();
}

// =============================================================================
// 20. DESTROY (sekarang async)
// =============================================================================

async function destroy() {
    window.log.info('[Tracking ' + F_V + '] (22) destroy()');
    isDestroyed = true;
    _trackingModule = null;
    window.trackingModule = null;
    if (updateTimer) { clearTimeout(updateTimer); updateTimer = null; }
    updateScheduled = false;
    stopClockTimer();
    await GPS.stop(); // await agar notifikasi hilang
    await GPS.forceCleanup(); // double paksa berhenti agar masalah notifikasi hilang
    
    if (calculate) { calculate.stop(); calculate = null; }
    stopSound();
    if (beepAudioCtx) {
        beepAudioCtx.close();
        beepAudioCtx = null;
    }
    followMode = false;
    if (followModeTimer) { clearTimeout(followModeTimer); followModeTimer = null; }
    if (MapManager) MapManager.destroy();
    mapReady = false;
    if (window.Cache) {
        window.Cache.invalidate('tracking');
    }

    currentPosition = null;
    isOfflineMode = false;
    offlineAdditionalData = {};
    StateManager.set('tracking.offlineAdditionalData', null);

    if (currentHeader) { HeaderManager.destroy(currentHeader); currentHeader = null; }
}

// =============================================================================
// 21. FORCE STOP TRACKING (sekarang async)
// =============================================================================

window.forceStopTracking = async function() {
    window.log.info('[Tracking ' + F_V + '] (23) forceStopTracking() dipanggil');
    if (typeof GPS !== 'undefined') {
        await GPS.stop(); // await agar notifikasi hilang
        await GPS.forceCleanup(); // double paksa berhenti agar masalah notifikasi hilang
    }

    var tm = window.trackingModule || _trackingModule;
    if (tm && typeof tm.emergencyStop === 'function') {
        await tm.emergencyStop();
    }

    if (typeof MapManager !== 'undefined' && MapManager.isReady()) {
        MapManager.destroy();
    }

    _trackingModule = null;
    window.trackingModule = null;
};

// =============================================================================
// 22. REGISTRASI POPUP CUSTOM
// =============================================================================

PopupManager.register(14, createCancelPopupContent);
PopupManager.register(15, createSelesaiPopupContent);
PopupManager.register(18, createWarningPopupContent);
PopupManager.register(19, createOfflineBiayaTambahanContent);

// =============================================================================
// 23. EKSPOR
// =============================================================================

export var PageTrackingidle = {
    render: renderIdle,
    destroy: destroy
};

export var PageTrackingactive = {
    render: renderActive,
    destroy: destroy
};

window.log.info('[Tracking ' + F_V + '] (24) PageTrackingidle & PageTrackingactive dimuat (rev8: semua GPS.stop() di-await)');


// ================================ End Of File ================================