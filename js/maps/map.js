/**
 * =================================================================================
 * FILE         : /js/maps/map.js
 * FILE VERSION : 2.0.1-rev6
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
const F_V = '2.0.1-rev6';

import { GPS } from './gps.js';

// =============================================================================
// 0. IKON LOKAL (tidak lagi bergantung pada texts.js)
// =============================================================================

const ICON = {
    MOBIL: '🚗',
    MOTOR: '🏍️',
    PENUMPANG: '🧑',
    MAP_START: '🚩',
    MAP_PICKUP: '🎌',
    MAP_FINISH: '🏁',
    WARNING_BOLD: '⚠️',
    SHOW_MAP: '🗺️',
    MAP_DEFAULT: '📍'
};

const DEFAULT_CENTER = [-6.200000, 106.816666];
const DEFAULT_ZOOM = 13;

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const TILE_URL    = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const PICKUP_COLOR  = '#10b981';
const DROPOFF_COLOR = '#3b82f6';

// Styling untuk polyline 'planned' (rute rencana offline)
const PLANNED_COLOR   = '#9CA3AF';
const PLANNED_WEIGHT  = 2;
const PLANNED_OPACITY = 0.6;

const Z_TILE = 1;

const POLYLINE_WEIGHT_HIGH   = 6;
const POLYLINE_WEIGHT_MEDIUM = 4;
const POLYLINE_WEIGHT_LOW    = 2;
const POLYLINE_WEIGHT_DEFAULT = 4;

const AREA_CENTERS = {
    Jabodetabek: [-6.200000, 106.816666],
    SumatraJawa: [-7.257472, 112.752090],
    TimurIndonesia: [-5.147665, 119.432732]
};

let map = null;
let isInitialized = false;
let isLoading = false;
let loadPromise = null;
let leafletLoaded = false;

const markers = {};
const polylines = {};

let tileLayer = null;
let currentContainerId = null;
let currentRole = 'Driver';
let currentVehicleMode = 'Mobil';
let currentIsOperational = false;

let centerButton = null;
let warningButton = null;

// Callback untuk interaksi pengguna (drag/zoom) – di-set oleh tracking.js
let _onUserInteractionCallback = null;

// =============================================================================
// LAZY LOADING LEAFLET
// =============================================================================

function loadLeafletCSS() {
    return new Promise(resolve => {
        if (document.querySelector('link[href*="leaflet"]')) { resolve(); return; }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = window.cacheBust ? window.cacheBust(LEAFLET_CSS) : LEAFLET_CSS;
        link.onload = resolve;
        link.onerror = resolve;
        document.head.appendChild(link);
    });
}

function loadLeafletJS() {
    return new Promise((resolve, reject) => {
        if (window.L) { resolve(window.L); return; }
        const script = document.createElement('script');
        script.src = window.cacheBust ? window.cacheBust(LEAFLET_JS) : LEAFLET_JS;
        script.onload = () => {
            if (window.L) resolve(window.L);
            else reject(new Error('Leaflet tidak tersedia setelah load'));
        };
        script.onerror = () => reject(new Error('Gagal memuat Leaflet'));
        document.head.appendChild(script);
    });
}

async function loadLeaflet() {
    if (leafletLoaded) return window.L;
    if (loadPromise) return loadPromise;

    isLoading = true;
    loadPromise = (async () => {
        try {
            await loadLeafletCSS();
            const L = await loadLeafletJS();
            leafletLoaded = true;
            isLoading = false;
            return L;
        } catch (error) {
            isLoading = false;
            loadPromise = null;
            throw error;
        }
    })();
    return loadPromise;
}

// =============================================================================
// DEFAULT CENTER BERDASARKAN AREA
// =============================================================================

function getDefaultCenter(area) {
    return AREA_CENTERS[area] || DEFAULT_CENTER;
}

// =============================================================================
// OVERLAY API (murni CSS, tanpa inline style)
// =============================================================================

function _initOverlays(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('.map-overlay').forEach(el => el.remove());

    const statusEl = document.createElement('div');
    statusEl.className = 'tracking-status-overlay map-overlay';
    statusEl.id = 'map-status-overlay';
    container.appendChild(statusEl);

    const accuracyEl = document.createElement('div');
    accuracyEl.className = 'tracking-accuracy-display map-overlay';
    accuracyEl.id = 'map-accuracy-overlay';
    container.appendChild(accuracyEl);

    const gpsEl = document.createElement('div');
    gpsEl.className = 'tracking-gps-status map-overlay';
    gpsEl.id = 'map-gps-overlay';
    container.appendChild(gpsEl);

    window.log.info('[Map ' + F_V + '] (1) Overlay diinisialisasi di ' + containerId);
}

function setStatusOverlay(text) {
    const el = document.getElementById('map-status-overlay');
    if (el) el.textContent = text;
}

function setAccuracyOverlay(meters) {
    const el = document.getElementById('map-accuracy-overlay');
    if (el) {
        el.textContent = meters;
        let cls = 'tracking-accuracy-display map-overlay ';
        const m = parseFloat(meters);
        if (!isNaN(m)) {
            if (m <= 20) cls += 'accuracy-high';
            else if (m <= 50) cls += 'accuracy-medium';
            else cls += 'accuracy-low';
        }
        el.className = cls;
    }
}

function setGPSStatusOverlay(active) {
    const el = document.getElementById('map-gps-overlay');
    if (el) {
        el.textContent = active ? 'GPS AKTIF' : 'GPS MATI';
        el.style.color = active ? 'var(--success)' : 'var(--danger)';
    }
}

// =============================================================================
// INISIALISASI PETA
// =============================================================================

async function init(containerId, options = {}) {
    if (options.force && isInitialized) destroy();
    if (isInitialized && currentContainerId === containerId) return map;

    const container = document.getElementById(containerId);
    if (!container) {
        console.error('[Map] Container "' + containerId + '" tidak ditemukan');
        return null;
    }

    currentRole = options.role || 'Driver';
    currentVehicleMode = options.vehicleMode || 'Mobil';
    currentIsOperational = options.isOperational || false;

    try {
        const L = await loadLeaflet();
        if (map) destroy();
        container.innerHTML = '';

        const center = options.center || DEFAULT_CENTER;
        const zoom = options.zoom || DEFAULT_ZOOM;

        map = L.map(containerId, {
            center,
            zoom,
            zoomControl: false,
            attributionControl: true
        });

        tileLayer = L.tileLayer(TILE_URL, {
            attribution: ATTRIBUTION,
            maxZoom: 19
        }).addTo(map);
        tileLayer.setZIndex(Z_TILE);

        tileLayer.on('tileerror', () => {
            showPlaceholder(containerId, 'Peta gagal dimuat', 'Periksa koneksi internet Anda');
        });

        map.attributionControl.setPosition('bottomleft');

        L.control.zoom({ position: 'topleft' }).addTo(map);

        _initOverlays(containerId);

        // Event interaksi pengguna (untuk follow mode di tracking.js)
        map.on('movestart', function() {
            if (_onUserInteractionCallback) _onUserInteractionCallback();
        });
        map.on('zoomstart', function() {
            if (_onUserInteractionCallback) _onUserInteractionCallback();
        });

        // Tombol center akan ditambahkan secara terpisah oleh pemanggil
        // karena perlu cek izin dan callback. 
        // Namun untuk kompatibilitas dengan showmap dan lainnya,
        // kita bisa sediakan fungsi addCenterButton yang dipanggil nanti.
        // Di sini kita tidak otomatis panggil addCenterButton lagi.
        if (warningButton && map && map._container) {
            map._container.appendChild(warningButton);
        }

        isInitialized = true;
        currentContainerId = containerId;

        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 300);

        window.log.info('[Map ' + F_V + '] (2) Peta berhasil diinisialisasi di ' + containerId);
        return map;

    } catch (error) {
        showPlaceholder(containerId, 'Peta gagal dimuat', 'Periksa koneksi internet Anda');
        window.log.error('[Map ' + F_V + '] (3) Gagal inisialisasi peta:', error);
        return null;
    }
}

async function destroy() {
    if (map) { map.remove(); map = null; }
    for (const key in markers) delete markers[key];
    for (const key in polylines) _clearPolylineSegments(key);
    tileLayer = null;
    isInitialized = false;
    currentContainerId = null;

    if (centerButton) {
        centerButton.remove();
        centerButton = null;
    }
    if (warningButton) {
        warningButton.remove();
    }
    
    // 🔥 PAKSA HENTIKAN GPS + NOTIFIKASI
    if (typeof GPS !== 'undefined') {
        await GPS.forceCleanup();  // <-- GANTI dari GPS.stop()
    }
    
    _onUserInteractionCallback = null;
    window.log.info('[Map ' + F_V + '] (4) Peta dihancurkan');
}

function isReady() {
    return isInitialized && map !== null;
}

// =============================================================================
// FUNGSI CEK IZIN LOKASI (untuk menampilkan tombol center)
// =============================================================================

function checkLocationPermission() {
    // Native: asumsikan izin diberikan karena Capacitor mengelola
    if (window.__platform && window.__platform.isNative) {
        return Promise.resolve(true);
    }
    // Web: gunakan Permissions API jika tersedia
    if (navigator.permissions) {
        return navigator.permissions.query({name:'geolocation'}).then(function(result) {
            return result.state === 'granted';
        }).catch(function() {
            return false;
        });
    }
    // Fallback: tidak bisa cek, tampilkan saja tombol (jangan sembunyikan)
    return Promise.resolve(true);
}

// =============================================================================
// TOMBOL CENTER (DENGAN CEK IZIN, DEBOUNCE, DAN CALLBACK)
// =============================================================================

/**
 * Menambahkan tombol center ke peta. Sekarang async: cek izin lokasi dulu.
 * @param {Function} [onClick] - Callback opsional saat tombol diklik.
 *        Jika tidak diberikan, akan memanggil centerToUser() default.
 */
async function addCenterButton(onClick) {
    if (!map || !map._container) return;
    if (map._container.querySelector('.map-center-btn')) return;

    // Cek izin lokasi, jika tidak granted jangan tampilkan tombol
    const hasPermission = await checkLocationPermission();
    if (!hasPermission) {
        window.log.info('[Map ' + F_V + '] Izin lokasi tidak diberikan, tombol center tidak ditampilkan');
        return;
    }

    let iconChar;
    if (currentIsOperational || currentRole === 'Driver') {
        iconChar = currentVehicleMode === 'Mobil' ? ICON.MOBIL : ICON.MOTOR;
    } else {
        iconChar = ICON.PENUMPANG;
    }

    const button = document.createElement('button');
    button.className = 'map-center-btn';
    button.innerHTML = iconChar;
    button.title = 'Center ke posisi saya';
    button.setAttribute('aria-label', 'Center ke posisi saya');

    let debounceTimer = null;
    button.addEventListener('click', (e) => {
        e.preventDefault();
        if (debounceTimer) return;                // debounce 500ms
        debounceTimer = setTimeout(function() {
            debounceTimer = null;
        }, 500);

        if (typeof onClick === 'function') {
            onClick();
        } else {
            centerToUser();
        }
    });

    map._container.appendChild(button);
    centerButton = button;
}

// =============================================================================
// FUNGSI UNTUK MENDAFTARKAN CALLBACK INTERAKSI PENGGUNA
// =============================================================================

function onUserInteraction(callback) {
    _onUserInteractionCallback = callback;
}

// =============================================================================
// TOMBOL WARNING (tanpa inline style – style dari CSS)
// =============================================================================

function addWarningButton(onClick) {
    if (warningButton) return;

    const button = document.createElement('button');
    button.className = 'map-warning-btn';
    button.innerHTML = ICON.WARNING_BOLD;
    button.title = 'Peringatan';
    button.setAttribute('aria-label', 'Peringatan');

    button.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof onClick === 'function') {
            onClick();
        }
    });

    warningButton = button;

    if (map && map._container) {
        map._container.appendChild(button);
    }

    window.log.info('[Map ' + F_V + '] (5) Tombol warning ditambahkan');
}

// =============================================================================
// MARKER (ATURAN IKON BARU)
// =============================================================================

function _createMarkerIcon(type, role, vehicleMode) {
    if (!window.L) return null;

    let iconChar;
    if (type === 'user') {
        if (currentIsOperational || currentRole === 'Driver') {
            iconChar = currentVehicleMode === 'Motor' ? ICON.MOTOR : ICON.MOBIL;
        } else {
            iconChar = ICON.PENUMPANG;
        }

        return window.L.divIcon({
            html: `<div style="font-size: 12px; line-height: 1; filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.3));">${iconChar}</div>`,
            className: 'marker-user',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15]
        });
    }

    const mapIcons = {
        start: ICON.MAP_START,
        pickup: ICON.MAP_PICKUP,
        finish: ICON.MAP_FINISH
    };
    iconChar = mapIcons[type] || ICON.MAP_DEFAULT;

    return window.L.divIcon({
        html: `<div style="font-size: 30px; line-height: 1; filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.2));">${iconChar}</div>`,
        className: `marker-${type}`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}

function addMarker(lat, lng, type, options = {}) {
    if (!isReady()) return null;
    const L = window.L;

    const shouldReplace = options.replace !== false;
    if (shouldReplace && markers[type]) {
        map.removeLayer(markers[type]);
        delete markers[type];
    }
    if (!shouldReplace && markers[type]) {
        markers[type].setLatLng([lat, lng]);
        return markers[type];
    }

    const role = options.role || currentRole;
    const vehicleMode = options.vehicleMode || currentVehicleMode;
    const icon = _createMarkerIcon(type, role, vehicleMode);

    const marker = L.marker([lat, lng], {
        icon,
        draggable: false,
        zIndexOffset: type === 'user' ? 800 : 500
    }).addTo(map);

    markers[type] = marker;
    return marker;
}

function removeMarker(type) {
    if (markers[type] && map) {
        map.removeLayer(markers[type]);
        delete markers[type];
    }
}

function clearMarkers() {
    for (const type in markers) {
        if (markers[type] && map) map.removeLayer(markers[type]);
        delete markers[type];
    }
}

function updateUserMarker(lat, lng, role, vehicleMode) {
    if (role) currentRole = role;
    if (vehicleMode) currentVehicleMode = vehicleMode;
    addMarker(lat, lng, 'user', {
        role: currentRole,
        vehicleMode: currentVehicleMode,
        replace: true
    });
}

function getMarker(type) {
    return markers[type] || null;
}

// =============================================================================
// POLYLINE (dengan dukungan warna kustom & planned route styling)
// =============================================================================

function _getWeightByAccuracy(accuracy) {
    if (!accuracy || accuracy <= 10) return POLYLINE_WEIGHT_HIGH;
    if (accuracy <= 30) return POLYLINE_WEIGHT_MEDIUM;
    return POLYLINE_WEIGHT_LOW;
}

function _getPolylineDefaultOptions(type) {
    switch (type) {
        case 'pickup':
            return { color: PICKUP_COLOR, weight: POLYLINE_WEIGHT_DEFAULT, opacity: 0.8 };
        case 'dropoff':
            return { color: DROPOFF_COLOR, weight: POLYLINE_WEIGHT_DEFAULT, opacity: 0.8 };
        case 'planned':
            return { color: PLANNED_COLOR, weight: PLANNED_WEIGHT, opacity: PLANNED_OPACITY };
        default:
            return { color: '#9CA3AF', weight: POLYLINE_WEIGHT_DEFAULT, opacity: 0.8 };
    }
}

function addPolyline(positions, type, options = {}) {
    if (!isReady() || !positions || positions.length < 2) return null;
    const L = window.L;
    const latLngs = positions.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng]);

    _clearPolylineSegments(type);

    // Gunakan default styling berdasarkan type, timpa dengan options jika diberikan
    const defaults = _getPolylineDefaultOptions(type);
    const color = options.color || defaults.color;
    const weight = options.weight || defaults.weight;
    const opacity = options.opacity !== undefined ? options.opacity : defaults.opacity;

    const polyline = L.polyline(latLngs, {
        color,
        weight,
        opacity,
        smoothFactor: 1
    }).addTo(map);
    polyline.bringToBack();

    polylines[type] = polyline;
    return polyline;
}

function updatePolylineWithAccuracy(positions, type) {
    if (!isReady()) return;
    if (!positions || positions.length < 2) {
        _clearPolylineSegments(type);
        return;
    }

    const L = window.L;
    const color = type === 'pickup' ? PICKUP_COLOR : DROPOFF_COLOR;

    _clearPolylineSegments(type);

    const segments = [];
    for (let i = 1; i < positions.length; i++) {
        const prev = positions[i - 1];
        const curr = positions[i];
        const accuracy = curr[2] || 0;
        const weight = _getWeightByAccuracy(accuracy);

        const segment = L.polyline(
            [[prev[0], prev[1]], [curr[0], curr[1]]],
            { color, weight, opacity: 0.8, smoothFactor: 1 }
        ).addTo(map);
        segment.bringToBack();
        segments.push(segment);
    }

    polylines[type] = segments;
}

function _clearPolylineSegments(type) {
    if (polylines[type]) {
        const existing = polylines[type];
        if (Array.isArray(existing)) {
            existing.forEach(seg => { if (seg && map) map.removeLayer(seg); });
        } else if (existing && map) {
            map.removeLayer(existing);
        }
        delete polylines[type];
    }
}

function clearPolylines() {
    for (const type in polylines) _clearPolylineSegments(type);
}

function getPolyline(type) {
    return polylines[type] || null;
}

// =============================================================================
// FUNGSI KHUSUS UNTUK PLANNED ROUTE (untuk kemudahan penggunaan)
// =============================================================================

/**
 * Menambahkan polyline rute rencana (planned) dengan styling default.
 * Ini adalah convenience wrapper di atas addPolyline.
 * @param {Array} positions - Array koordinat [lat, lng] atau {lat, lng}
 * @param {Object} [options={}] - Opsi tambahan (dapat menimpa default planned)
 * @returns {Object|null} Polyline Leaflet atau null jika gagal
 */
function addPlannedRoute(positions, options = {}) {
    return addPolyline(positions, 'planned', options);
}

// =============================================================================
// KONTROL & VIEW
// =============================================================================

function fitBounds(positions, options = {}) {
    if (!isReady() || !positions || positions.length === 0) return;
    const L = window.L;
    const latLngs = positions.map(p => Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lng]);
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, {
        padding: options.padding || [50, 50],
        maxZoom: options.maxZoom || 16
    });
}

function setView(lat, lng, zoom) {
    if (isReady()) map.setView([lat, lng], zoom || map.getZoom());
}

function centerToUser() {
    if (markers.user) {
        map.setView(markers.user.getLatLng(), map.getZoom());
    } else {
      // tidak ada marker user, tidak melakukan apa-apa
      // Minta GPS, tambahkan marker user, lalu center
      GPS.getCurrentPosition(function(pos, error) {
        if (pos) {
          addMarker(pos.lat, pos.lng, 'user', {
            role: currentRole,
            vehicleMode: currentVehicleMode,
            replace: true
          });
          map.setView([pos.lat, pos.lng], map.getZoom());
        } else {
          // fallback: center ke default jika GPS gagal
          centerToDefault();
          if (window.ThemeManager) {
            window.ThemeManager.showToast('Gagal mendapatkan lokasi', 'warning');
          }
        }
      });
    }
}

function centerToDefault() {
    if (isReady()) map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
}

function invalidateSize() {
    if (isReady()) map.invalidateSize();
}

function getBounds() {
    return isReady() ? map.getBounds() : null;
}

function getZoom() {
    return isReady() ? map.getZoom() : DEFAULT_ZOOM;
}

function panTo(lat, lng, options = {}) {
    if (isReady()) map.panTo([lat, lng], options);
}

// =============================================================================
// PLACEHOLDER
// =============================================================================

function showPlaceholder(containerId, message, subMessage) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="map-placeholder">
            <div class="map-placeholder-icon">${ICON.SHOW_MAP}</div>
            <div class="map-placeholder-message">${message || 'Peta tidak dapat dimuat'}</div>
            ${subMessage ? `<div class="map-placeholder-submessage">${subMessage}</div>` : ''}
        </div>`;
}

// =============================================================================
// MODE KHUSUS
// =============================================================================

async function initForTracking(containerId, options = {}) {
    currentRole = options.role || 'Driver';
    currentVehicleMode = options.vehicleMode || 'Mobil';
    currentIsOperational = options.isOperational || false;

    const center = options.center || getDefaultCenter(options.area);

    return await init(containerId, {
        center,
        zoom: options.zoom || 15,
        role: currentRole,
        vehicleMode: currentVehicleMode,
        isOperational: currentIsOperational,
        force: options.force || false
    });
}

async function initForShowMap(containerId, data, options = {}) {
    currentRole = options.role || 'Driver';
    currentVehicleMode = options.vehicleMode || 'Mobil';
    currentIsOperational = false;

    const mapInstance = await init(containerId, {
        center: options.center || DEFAULT_CENTER,
        zoom: options.zoom || 13,
        role: currentRole,
        vehicleMode: currentVehicleMode,
        isOperational: false,
        force: options.force || false
    });

    if (mapInstance && data) {
        try {
            renderFromCompactData(data, currentRole);
        } catch (error) {
            showPlaceholder(containerId, 'Data rute tidak valid', 'Periksa format data');
        }
    } else if (mapInstance && !data) {
        showPlaceholder(containerId, 'Tidak ada data rute', '');
    }

    return mapInstance;
}

function renderFromCompactData(data, role) {
    if (!isReady()) return;

    role = role || 'Driver';
    currentRole = role;

    clearMarkers();
    clearPolylines();

    const allPositions = [];

    if (data.positionsPickup) {
        const pickupPositions = data.positionsPickup
            .split(';')
            .filter(p => p.trim())
            .map(p => {
                const parts = p.split(',').map(Number);
                return [parts[0], parts[1]];
            });

        if (pickupPositions.length > 0) {
            addPolyline(pickupPositions, 'pickup');
            addMarker(pickupPositions[0][0], pickupPositions[0][1], 'start', { replace: false });
            const lastPickup = pickupPositions[pickupPositions.length - 1];
            addMarker(lastPickup[0], lastPickup[1], 'pickup', { replace: false });
            allPositions.push(...pickupPositions);
        }
    }

    if (data.positionsDropoff) {
        const dropoffPositions = data.positionsDropoff
            .split(';')
            .filter(p => p.trim())
            .map(p => {
                const parts = p.split(',').map(Number);
                return [parts[0], parts[1]];
            });

        if (dropoffPositions.length > 0) {
            addPolyline(dropoffPositions, 'dropoff');
            if (!data.positionsPickup) {
                addMarker(dropoffPositions[0][0], dropoffPositions[0][1], 'start', { replace: false });
            }
            const lastDropoff = dropoffPositions[dropoffPositions.length - 1];
            addMarker(lastDropoff[0], lastDropoff[1], 'finish', { replace: false });
            allPositions.push(...dropoffPositions);
        }
    }

    if (allPositions.length > 0) {
        fitBounds(allPositions);
    } else {
        centerToDefault();
    }
}

// =============================================================================
// GETTER
// =============================================================================

function getLeaflet() { return window.L || null; }
function getMap() { return map; }
function setRole(role) { currentRole = role; }
function getRole() { return currentRole; }
function setVehicleMode(mode) { currentVehicleMode = mode; }
function getVehicleMode() { return currentVehicleMode; }
function isLeafletLoaded() { return leafletLoaded; }

// =============================================================================
// EKSPOR
// =============================================================================

export const MapManager = {
    init,
    destroy,
    isReady,

    getDefaultCenter,

    setStatusOverlay,
    setAccuracyOverlay,
    setGPSStatusOverlay,

    initForTracking,
    initForShowMap,
    renderFromCompactData,

    addMarker,
    removeMarker,
    clearMarkers,
    updateUserMarker,
    getMarker,

    addPolyline,
    updatePolylineWithAccuracy,
    clearPolylines,
    getPolyline,
    addPlannedRoute,

    fitBounds,
    setView,
    centerToUser,
    centerToDefault,
    invalidateSize,
    getBounds,
    getZoom,
    panTo,

    showPlaceholder,

    addCenterButton,       // versi baru: async, cek izin, debounce, callback
    addWarningButton,

    onUserInteraction,     // untuk mendaftarkan callback interaksi pengguna

    getLeaflet,
    getMap,
    setRole,
    getRole,
    setVehicleMode,
    getVehicleMode,
    isLeafletLoaded,

    DEFAULT_CENTER
};

window.log.info('[Map ' + F_V + '] (6) MapManager dimuat');


// ================================ End Of File ================================