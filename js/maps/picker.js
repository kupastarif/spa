/**
 * =================================================================================
 * FILE         : /js/maps/picker.js
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
import { PopupManager } from '../components/popup.js';
import { ThemeManager } from '../components/theme.js';
import { MapManager } from '../maps/map.js';
import { GPS } from '../maps/gps.js';

// =============================================================================
//                 IKON LOKAL (tidak lagi bergantung pada texts.js)
// =============================================================================

const ICON = {
    SAVE: '💾',
    GPS: '📍',
    SHOW_MAP: '🗺️',
    BACK: '◀',
    DETAIL: '🔍',
    SPINNER: '⏳',
    CHECK: '✓'
};

// =============================================================================
//                 KONSTANTA & DATA HARDCODED (Sunting di sini)            
// =============================================================================

// --------------- KOREKSI JARAK & WAKTU BERDASARKAN E10 -----------------------
const CORRECTION = {
    Motor: {
        distFactor: 1.00,   // faktor pengali jarak
        distAdd: 0.2,        // tambahan jarak (km)
        timeFactor: 1.10,    // faktor pengali waktu (dari durasi OSRM bike)
        timeAdd: 5,          // tambahan waktu (menit)
        peakMult: 1.025       // pengali tambahan saat jam sibuk
    },
    Mobil: {
        distFactor: 1.00,
        distAdd: 0.5,
        timeFactor: 1.05,
        timeAdd: 5,
        peakMult: 1.10
    }
};

// --------------- JAM SIBUK ---------------------------------------------------
const PEAK_HOURS = {
    pagi: {
        days: [1, 2, 3, 4, 5],   // Senin–Jumat
        start: 6,
        end: 8                    // 06:00–08:59
    },
    sore: {
        days: [1, 2, 3, 4, 5, 6], // Senin–Sabtu
        start: 16,
        end: 18                    // 16:00–18:59
    }
};

// --------------- COOLDOWN (detik) --------------------------------------------
const COOLDOWN_SEC = 120;

// --------------- CACHE SESSION STORAGE (milidetik) ---------------------------
const CACHE_MAX_AGE_MS = 3600000;    // 1 jam
const COOLDOWN_CLEANUP_MS = 600000;  // 10 menit

// --------------- DEBOUNCE PENCARIAN (milidetik) ------------------------------
const SEARCH_DEBOUNCE_MS = 2000;

// --------------- ENDPOINT API ------------------------------------------------
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OSRM_BASE = 'https://router.project-osrm.org/route/v1';

// --------------- PENGATURAN LAINNYA ------------------------------------------
const MIN_SEARCH_CHARS = 3;
const MAX_RECENT_SAVED = 3;
const COORD_DECIMALS = 5;           // jumlah desimal untuk pembulatan koordinat

// sessionStorage keys (khusus picker, tidak bentrok dengan kt_*)
const RECENT_SAVED_KEY = 'lp_recent_saved';
const ROUTE_POLYLINE_KEY = 'lp_route_polyline';

// =============================================================================
//                        STATE INTERNAL MODUL                               
// =============================================================================

let state = {
    page: 1,                  // 1-7
    pickup: null,             // { label, lat, lng, savedLabel? }
    destination: null,        // { label, lat, lng, savedLabel? }
    vehicle: 'Motor',         // dari E10
    role: 'Driver',           // dari E12
    area: 'Jabodetabek',      // dari E20
    cooldownActive: false,
    cooldownRemaining: 0,     // detik
    timer: null,              // interval countdown
    abortController: null,    // batalkan request pencarian
    mapActive: false,         // true jika peta sedang tampil
    _mapCoords: null,         // koordinat sementara dari klik peta
    _debounceTimer: null,     // timer debounce pencarian
    routeResult: null,        // { distanceKm, durationMin, geometry }
    cooldownBtnTimer: null    // interval untuk tombol hitung
};

// =============================================================================
//               FUNGSI PEMBULATAN & STORAGE SEDERHANA                     
// =============================================================================

function roundCoord(val) {
    return Number(val.toFixed(COORD_DECIMALS));
}

function getCache(key) {
    const raw = sessionStorage.getItem(key);
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (e) { return {}; }
}

function setCache(key, obj) {
    sessionStorage.setItem(key, JSON.stringify(obj));
}

function cleanExpiredCache() {
    const now = Date.now();
    const geoCache = getCache('lp_geocoding');
    for (const q in geoCache) {
        if (now - geoCache[q].timestamp > CACHE_MAX_AGE_MS) delete geoCache[q];
    }
    setCache('lp_geocoding', geoCache);

    // Route cache
    const routeCache = getCache('lp_route');
    for (const k in routeCache) {
        if (now - routeCache[k].timestamp > CACHE_MAX_AGE_MS) delete routeCache[k];
    }
    setCache('lp_route', routeCache);

    // Cooldown (jika >10 menit, hapus)
    const lastCalc = sessionStorage.getItem('picker_last_calc_utc');
    if (lastCalc && now - parseInt(lastCalc) > COOLDOWN_CLEANUP_MS) {
        sessionStorage.removeItem('picker_last_calc_utc');
    }
}

// =============================================================================
//                 RECENT SAVED LOCATIONS (FIFO, maks 3)                    
// =============================================================================

function getRecentSaved() {
    const raw = sessionStorage.getItem(RECENT_SAVED_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
}

function saveRecentLocation(loc) {
    const items = getRecentSaved();
    // Cegah duplikat berdasarkan koordinat (presisi 5 desimal)
    const existingIdx = items.findIndex(item =>
        roundCoord(item.lat) === roundCoord(loc.lat) &&
        roundCoord(item.lng) === roundCoord(loc.lng)
    );
    if (existingIdx !== -1) {
        // Pindahkan ke paling baru (akhir array)
        items.splice(existingIdx, 1);
    }
    items.push({ label: loc.label, lat: roundCoord(loc.lat), lng: roundCoord(loc.lng) });
    // Batasi maks 3
    while (items.length > MAX_RECENT_SAVED) {
        items.shift();
    }
    sessionStorage.setItem(RECENT_SAVED_KEY, JSON.stringify(items));
}

// =============================================================================
//                   PENYIMPANAN POLYLINE (untuk tracking)                  
// =============================================================================

function getSavedPolyline() {
    const raw = sessionStorage.getItem(ROUTE_POLYLINE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

function savePolyline(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length === 0) return;
    sessionStorage.setItem(ROUTE_POLYLINE_KEY, JSON.stringify({
        coordinates,
        timestamp: Date.now()
    }));
}

function clearSavedPolyline() {
    sessionStorage.removeItem(ROUTE_POLYLINE_KEY);
}

// =============================================================================
//                         FUNGSI PEMBERSIHAN                               
// =============================================================================

/**
 * cleanup() membersihkan seluruh state internal, timer, dan map,
 * TETAPI TIDAK menyentuh recent saved locations maupun saved polyline.
 */
function cleanup() {
    window.log.info('[picker ' + F_V + '] (1) cleanup() dipanggil');

    if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
    }
    if (state.cooldownBtnTimer) {
        clearInterval(state.cooldownBtnTimer);
        state.cooldownBtnTimer = null;
    }
    if (state._debounceTimer) {
        clearTimeout(state._debounceTimer);
        state._debounceTimer = null;
    }
    if (state.mapActive) {
        MapManager.destroy();
        state.mapActive = false;
    }
    if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
    }

    // Reset state kecuali onComplete
    state.page = 1;
    state.pickup = null;
    state.destination = null;
    state.cooldownActive = false;
    state.cooldownRemaining = 0;
    state.vehicle = 'Motor';
    state.role = 'Driver';
    state.area = 'Jabodetabek';
    state._mapCoords = null;
    state.routeResult = null;

    cleanExpiredCache();
}

// =============================================================================
//                 NAVIGASI INTERNAL POPUP (multipage)                      
// =============================================================================

function goToPage(page) {
    // Bersihkan timer debounce jika ada
    if (state._debounceTimer) {
        clearTimeout(state._debounceTimer);
        state._debounceTimer = null;
    }
    if (state.cooldownBtnTimer) {
        clearInterval(state.cooldownBtnTimer);
        state.cooldownBtnTimer = null;
    }
    if (state.mapActive) {
        MapManager.destroy();
        state.mapActive = false;
    }
    state._mapCoords = null;
    state.page = page;
    renderPage();
}

function renderPage() {
    const body = document.getElementById('lp-body');
    if (!body) return;

    const titleEl = document.getElementById('lp-title');
    const backBtn = document.getElementById('lp-back');
    if (titleEl) titleEl.textContent = getPageTitle(state.page);
    if (backBtn) backBtn.style.visibility = state.page > 1 ? 'visible' : 'hidden';

    switch (state.page) {
        case 1: body.innerHTML = renderPage1(); bindPage1(); break;
        case 2: body.innerHTML = renderPage2(); bindPage2(); break;
        case 3: body.innerHTML = renderPage3(); bindPage3(); break;
        case 4: body.innerHTML = renderPage4(); initMapPage('pickup'); break;
        case 5: body.innerHTML = renderPage5(); bindPage5(); break;
        case 6: body.innerHTML = renderPage6(); initMapPage('destination'); break;
        case 7: body.innerHTML = renderPage7(); initResultPage(); break;
    }
}

function getPageTitle(page) {
    const titles = {
        1: 'Izin & Cooldown',
        2: 'Info Fitur',
        3: 'Titik Jemput',
        4: 'Peta Jemput',
        5: 'Titik Antar',
        6: 'Peta Antar',
        7: 'Hasil Rute'
    };
    return titles[page] || '';
}

// =============================================================================
//                       POPUP FACTORY (INDEX 21)                           
// =============================================================================

function createPickerContainer() {
    const container = document.createElement('div');
    container.innerHTML = `
        <div class="lp-header" style="display:none;">
            <h3 id="lp-title" class="lp-page-title"></h3>
        </div>
        <div id="lp-body" class="lp-body"></div>
    `;

    container._popupOptions = {
        title: 'Cari Lokasi',
        showCloseButton: true,
        closeOnOverlay: true,
        showActions: false
    };

    return container;
}

// =============================================================================
//             HALAMAN 1 – IZIN LOKASI & COOLDOWN (tidak berubah)          
// =============================================================================

function renderPage1() {
    return `<div class="lp-page">
        <h4>Izin & Cooldown</h4>
        <div id="lp-status-text"></div>
        <div id="lp-countdown" style="display:none; text-align:center; font-size:2rem; margin:1rem 0;"></div>
        <button id="lp-skip-btn" class="btn btn-outline btn-block mt-md" style="display:none;">LEWATI</button>
    </div>`;
}

function bindPage1() {
    const statusEl = document.getElementById('lp-status-text');
    const countdownEl = document.getElementById('lp-countdown');
    const skipBtn = document.getElementById('lp-skip-btn');

    // 1. Cek cooldown terlebih dahulu
    const lastCalcUtc = sessionStorage.getItem('picker_last_calc_utc');
    const nowUtc = GPS.getCurrentUTCTime().utc;

    if (lastCalcUtc) {
        const elapsed = (nowUtc - parseInt(lastCalcUtc)) / 1000;
        if (elapsed < COOLDOWN_SEC) {
            // Cooldown aktif
            state.cooldownActive = true;
            state.cooldownRemaining = Math.ceil(COOLDOWN_SEC - elapsed);
            statusEl.textContent = 'Nunggu antrian limit gratisan.';
            countdownEl.style.display = 'block';
            countdownEl.textContent = formatCountdown(state.cooldownRemaining);
            skipBtn.style.display = 'none'; // tidak bisa dilewati

            state.timer = setInterval(() => {
                state.cooldownRemaining--;
                countdownEl.textContent = formatCountdown(state.cooldownRemaining);
                if (state.cooldownRemaining <= 0) {
                    clearInterval(state.timer);
                    state.timer = null;
                    state.cooldownActive = false;
                    goToPage(2); // otomatis lanjut setelah cooldown habis
                }
            }, 1000);
            return;
        }
    }

    // 2. Tidak ada cooldown → minta izin GPS dengan opsi lewati
    statusEl.textContent = 'Meminta izin lokasi...';
    skipBtn.style.display = 'block';

    GPS.getCurrentPosition(
        (pos) => {
            // Izin diberikan → simpan posisi awal (opsional, bisa digunakan nanti)
            window.log.info('[picker ' + F_V + '] Izin lokasi granted');
            statusEl.textContent = 'Lokasi ditemukan. Anda dapat melanjutkan.';
            // Tidak perlu auto-pindah, biarkan pengguna memilih
        },
        (err) => {
            window.log.warn('[picker ' + F_V + '] GPS error:', err.code);
            if (err.code === GPS.ERROR_CODES.PERMISSION_DENIED) {
                statusEl.textContent = 'Izin lokasi ditolak. Anda tetap dapat melanjutkan tanpa lokasi.';
            } else {
                statusEl.textContent = 'Gagal mengakses lokasi. Lanjutkan tanpa lokasi?';
            }
        }
    );

    skipBtn.addEventListener('click', () => {
        // Bersihkan timer jika ada
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
        goToPage(2);
    });

    function formatCountdown(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
}

// =============================================================================
//                  HALAMAN 2 – INFO UJI COBA (tidak berubah)              
// =============================================================================

function renderPage2() {
    return `<div class="lp-page">
        <h4>Info Fitur</h4>
        <p>Aplikasi ini menggunakan fasilitas gratisan, jangan banyak ngarep.</p>
        <p>• Motor gak bisa diatur rutenya, mungkin lewat tol.</p>
        <p>• Mobil tidak memiliki opsi tol/non-tol.</p>
        <p>• Waktu tempuh setara dengan aplikasi ijo.</p>
        <p>Gunakan Google Maps untuk data lebih akurat, meskipun gak dipake juga ama aplikasi ijo.</p>
        <button id="lp-next2" class="btn btn-primary btn-block mt-md">LANJUT</button>
    </div>`;
}

function bindPage2() {
    document.getElementById('lp-next2').addEventListener('click', () => goToPage(3));
}

// =============================================================================
//            HALAMAN 3 – TITIK JEMPUT (recent saved, info, simpan)        
// =============================================================================

function renderPage3() {
    return `<div class="lp-page">
        <h4>Titik Jemput</h4>
        <div id="lp-pickup-saved-btns" class="lp-saved-btns"></div>
        <div class="lp-input-box">
            <input type="text" id="lp-search-pickup" placeholder="Cari lokasi penjemputan...">
        </div>
        <div id="lp-pickup-results" class="lp-results"></div>
        <div id="lp-pickup-selected" class="lp-selected-info" style="display:none;">
            <div class="lp-info-label"></div>
            <div class="lp-info-coords"></div>
            <button class="btn btn-outline btn-sm btn-block lp-save-btn">${ICON.SAVE} Simpan Lokasi</button>
        </div>
        <div class="flex justify-between gap-sm mt-sm">
            <button class="btn btn-outline flex-1" id="lp-gps-btn">${ICON.GPS} Lokasi Saat Ini</button>
            <button class="btn btn-outline flex-1" id="lp-map-btn">${ICON.SHOW_MAP} Cari di Peta</button>
        </div>
        <button class="btn btn-primary btn-block mt-sm" id="lp-next3" disabled>LANJUT</button>
    </div>`;
}

function bindPage3() {
    const searchInput = document.getElementById('lp-search-pickup');
    const resultsDiv = document.getElementById('lp-pickup-results');
    const nextBtn = document.getElementById('lp-next3');
    const savedBtnsDiv = document.getElementById('lp-pickup-saved-btns');

    // Render recent saved buttons
    renderRecentSavedButtons('pickup', savedBtnsDiv, searchInput, nextBtn);

    // Jika state.pickup sudah ada (kembali dari peta), perbarui tampilan
    if (state.pickup) {
        setLocationAndUpdateUI('pickup', state.pickup);
        nextBtn.disabled = false;
        searchInput.value = state.pickup.label || '';
    }

    // Debounce search
    searchInput.addEventListener('input', () => {
        clearTimeout(state._debounceTimer);
        const query = searchInput.value.trim();
        if (query.length < MIN_SEARCH_CHARS) {
            resultsDiv.innerHTML = '';
            return;
        }
        state._debounceTimer = setTimeout(() => searchLocation(query, resultsDiv, (item) => {
            state.pickup = item;
            setLocationAndUpdateUI('pickup', item);
            searchInput.value = item.label;
            resultsDiv.innerHTML = '';
            nextBtn.disabled = false;
        }), SEARCH_DEBOUNCE_MS);
    });

    document.getElementById('lp-gps-btn').addEventListener('click', () => {
        GPS.getCurrentPosition((pos) => {
            const loc = {
                label: `GPS (${roundCoord(pos.lat)}, ${roundCoord(pos.lng)})`,
                lat: roundCoord(pos.lat),
                lng: roundCoord(pos.lng)
            };
            state.pickup = loc;
            setLocationAndUpdateUI('pickup', loc);
            searchInput.value = loc.label;
            nextBtn.disabled = false;
            ThemeManager.showToast('Lokasi GPS digunakan', 'success');
        }, (err) => {
            ThemeManager.showToast('Gagal mendapatkan lokasi GPS', 'error');
        });
    });

    document.getElementById('lp-map-btn').addEventListener('click', () => goToPage(4));
    nextBtn.addEventListener('click', () => goToPage(5));
}

// =============================================================================
//                     HALAMAN 4 – PETA JEMPUT (perbaikan)                  
// =============================================================================

function renderPage4() {
    return `<div class="lp-page">
        <h4>Peta Jemput</h4>
        <div id="lp-map" style="height:300px;"></div>
        <button class="btn btn-primary btn-block mt-md" id="lp-use-map-pickup" disabled>Gunakan Lokasi Ini</button>
        <button class="btn btn-outline btn-block" id="lp-cancel-map">KEMBALI</button>
    </div>`;
}

function renderPage6() {
    return `<div class="lp-page">
        <h4>Peta Antar</h4>
        <div id="lp-map" style="height:300px;"></div>
        <button class="btn btn-primary btn-block mt-md" id="lp-use-map-destination" disabled>Gunakan Lokasi Ini</button>
        <button class="btn btn-outline btn-block" id="lp-cancel-map">KEMBALI</button>
    </div>`;
}

function initMapPage(type) {
    const mapDiv = document.getElementById('lp-map');
    if (!mapDiv) return;

    // Dapatkan posisi pengguna terlebih dahulu
    GPS.getCurrentPosition(
        (pos) => {
            const userCenter = [roundCoord(pos.lat), roundCoord(pos.lng)];
            initMapWithCenter(type, userCenter);
        },
        () => {
            // Fallback jika GPS gagal
            const fallbackCenter = (type === 'pickup' && state.pickup)
                ? [state.pickup.lat, state.pickup.lng]
                : (state.destination ? [state.destination.lat, state.destination.lng] : MapManager.DEFAULT_CENTER);
            initMapWithCenter(type, fallbackCenter);
        }
    );
}

function initMapWithCenter(type, center) {
    state._mapCoords = null;
    MapManager.init('lp-map', {
        center,
        zoom: 15,
        role: state.role,
        vehicleMode: state.vehicle   // mengirim E10 agar tombol center sesuai
    }).then(() => {
        state.mapActive = true;
        const map = MapManager.getMap();
        if (!map) return;

        const currentCoord = type === 'pickup' ? state.pickup : state.destination;
        const markerType = type === 'pickup' ? 'pickup' : 'finish';
        if (currentCoord) {
            MapManager.addMarker(currentCoord.lat, currentCoord.lng, markerType, { replace: true });
        }

        map.on('click', (e) => {
            const lat = roundCoord(e.latlng.lat);
            const lng = roundCoord(e.latlng.lng);
            MapManager.addMarker(lat, lng, markerType, { replace: true });
            state._mapCoords = { lat, lng };
            const useBtnId = type === 'pickup' ? 'lp-use-map-pickup' : 'lp-use-map-destination';
            const useBtn = document.getElementById(useBtnId);
            if (useBtn) useBtn.disabled = false;
        });
    });

    const useBtnId = type === 'pickup' ? 'lp-use-map-pickup' : 'lp-use-map-destination';
    document.getElementById(useBtnId).addEventListener('click', () => {
        if (!state._mapCoords) {
            ThemeManager.showToast('Ketuk peta untuk memilih lokasi', 'warning');
            return;
        }
        const label = `Peta (${state._mapCoords.lat.toFixed(COORD_DECIMALS)}, ${state._mapCoords.lng.toFixed(COORD_DECIMALS)})`;
        const obj = { label, lat: state._mapCoords.lat, lng: state._mapCoords.lng };
        if (type === 'pickup') state.pickup = obj;
        else state.destination = obj;
        MapManager.destroy();
        state.mapActive = false;
        goToPage(type === 'pickup' ? 3 : 5);
    });

    document.getElementById('lp-cancel-map').addEventListener('click', () => {
        MapManager.destroy();
        state.mapActive = false;
        goToPage(type === 'pickup' ? 3 : 5);
    });
}

// =============================================================================
//     HALAMAN 5 – TITIK ANTAR (recent saved, info, simpan, tombol HITUNG) 
// =============================================================================

function renderPage5() {
    return `<div class="lp-page">
        <h4>Titik Antar</h4>
        <div id="lp-dest-saved-btns" class="lp-saved-btns"></div>
        <div class="lp-input-box">
            <input type="text" id="lp-search-dest" placeholder="Cari lokasi pengantaran...">
        </div>
        <div id="lp-dest-results" class="lp-results"></div>
        <div id="lp-dest-selected" class="lp-selected-info" style="display:none;">
            <div class="lp-info-label"></div>
            <div class="lp-info-coords"></div>
            <button class="btn btn-outline btn-sm btn-block lp-save-btn">${ICON.SAVE} Simpan Lokasi</button>
        </div>
        <div class="flex justify-between gap-sm mt-sm">
            <button class="btn btn-outline flex-1" id="lp-back5">${ICON.BACK} Kembali</button>
            <button class="btn btn-outline flex-1" id="lp-map-dest-btn">${ICON.SHOW_MAP} Cari di Peta</button>
        </div>
        <button class="btn btn-primary btn-block mt-sm" id="lp-calc-btn" disabled>Hitung Jarak & Waktu</button>
    </div>`;
}

function bindPage5() {
    const searchInput = document.getElementById('lp-search-dest');
    const resultsDiv = document.getElementById('lp-dest-results');
    const calcBtn = document.getElementById('lp-calc-btn');
    const savedBtnsDiv = document.getElementById('lp-dest-saved-btns');

    // Render recent saved buttons
    renderRecentSavedButtons('destination', savedBtnsDiv, searchInput, calcBtn);

    // Jika destination sudah ada (kembali dari peta), perbarui UI
    if (state.destination) {
        setLocationAndUpdateUI('destination', state.destination);
        calcBtn.disabled = false;
        searchInput.value = state.destination.label || '';
    }

    // Debounce search
    searchInput.addEventListener('input', () => {
        clearTimeout(state._debounceTimer);
        const query = searchInput.value.trim();
        if (query.length < MIN_SEARCH_CHARS) {
            resultsDiv.innerHTML = '';
            return;
        }
        state._debounceTimer = setTimeout(() => searchLocation(query, resultsDiv, (item) => {
            state.destination = item;
            setLocationAndUpdateUI('destination', item);
            searchInput.value = item.label;
            resultsDiv.innerHTML = '';
            calcBtn.disabled = false;
        }), SEARCH_DEBOUNCE_MS);
    });

    document.getElementById('lp-map-dest-btn').addEventListener('click', () => goToPage(6));

    document.getElementById('lp-back5').addEventListener('click', () => goToPage(3));

    // Tombol Hitung dengan cooldown
    calcBtn.addEventListener('click', () => handleCalculateClick(calcBtn));

    // Cek cooldown awal (jika ada)
    checkCooldownForButton(calcBtn);
}

// =============================================================================
//                 HALAMAN 7 – HASIL RUTE (PETA + DUA TOMBOL)              
// =============================================================================

function renderPage7() {
    const r = state.routeResult;
    const dist = r ? r.distanceKm.toFixed(1) : '?';
    const dur = r ? Math.round(r.durationMin) : '?';
    return `<div class="lp-page">
        <h4>Hasil Rute</h4>
        <div class="lp-result-map" id="lp-result-map"></div>
        <div class="lp-result-stats">
            <span>${ICON.DETAIL} ${dist} km</span>
            <span>${ICON.SPINNER} ${dur} mnt</span>
        </div>
        <div id="lp-route-error" style="display:none; color:var(--danger); margin-bottom: var(--space-sm);"></div>
        <div class="lp-result-actions">
            <button class="btn btn-outline" id="lp-result-back">${ICON.BACK} Kembali</button>
            <button class="btn btn-primary" id="lp-result-use">${ICON.CHECK} Gunakan</button>
        </div>
    </div>`;
}

function initResultPage() {
    const result = state.routeResult;
    if (!result) {
        // Tidak ada hasil, kembali ke halaman 5
        ThemeManager.showToast('Hasil rute tidak tersedia', 'error');
        goToPage(5);
        return;
    }

    // Inisialisasi peta dengan rute
    const mapDiv = document.getElementById('lp-result-map');
    if (!mapDiv) return;

    const pickup = state.pickup;
    const destination = state.destination;
    if (!pickup || !destination) return;

    MapManager.init('lp-result-map', {
        center: [pickup.lat, pickup.lng],
        zoom: 13,
        role: state.role,
        vehicleMode: state.vehicle
    }).then(() => {
        state.mapActive = true;

        // Tambahkan marker jemput dan antar
        MapManager.addMarker(pickup.lat, pickup.lng, 'pickup', { replace: false });
        MapManager.addMarker(destination.lat, destination.lng, 'finish', { replace: false });

        // Tambahkan polyline rute
        if (result.geometry && Array.isArray(result.geometry) && result.geometry.length >= 2) {
            MapManager.addPolyline(result.geometry, 'pickup');
            MapManager.fitBounds(result.geometry, { padding: [30, 30], maxZoom: 16 });
        }
    });

    // Tombol Kembali
    document.getElementById('lp-result-back').addEventListener('click', () => {
        // Bersihkan peta dan kembali ke halaman 5
        MapManager.destroy();
        state.mapActive = false;
        goToPage(5);
    });

    // Tombol Gunakan
    document.getElementById('lp-result-use').addEventListener('click', () => {
        // Simpan polyline
        if (result.geometry && Array.isArray(result.geometry)) {
            savePolyline(result.geometry);
        }
        // Panggil callback
        if (typeof LocationPicker.onComplete === 'function') {
            LocationPicker.onComplete({
                distanceKm: result.distanceKm,
                durationMin: result.durationMin
            });
        }
        // Tutup popup (polyline tetap tersimpan)
        MapManager.destroy();
        state.mapActive = false;
        cleanup();
        Router.navigateTo({ popup: 0 });
    });
}

// =============================================================================
//                FUNGSI BANTU UNTUK HALAMAN 3 & 5                         
// =============================================================================

function renderRecentSavedButtons(type, container, searchInput, nextOrCalcBtn) {
    const items = getRecentSaved();
    container.innerHTML = '';
    for (let i = 0; i < MAX_RECENT_SAVED; i++) {
        const btn = document.createElement('button');
        btn.className = 'lp-saved-btn';
        btn.textContent = `Lokasi ${i + 1}`;
        if (i < items.length) {
            const loc = items[i];
            btn.disabled = false;
            btn.addEventListener('click', () => {
                const obj = {
                    label: loc.label,
                    lat: loc.lat,
                    lng: loc.lng,
                    savedLabel: `Lokasi ${i + 1}`
                };
                if (type === 'pickup') {
                    state.pickup = obj;
                } else {
                    state.destination = obj;
                }
                setLocationAndUpdateUI(type, obj);
                searchInput.value = obj.label;
                nextOrCalcBtn.disabled = false;
            });
        } else {
            btn.disabled = true;
        }
        container.appendChild(btn);
    }
}

function setLocationAndUpdateUI(type, loc) {
    const prefix = type === 'pickup' ? 'lp-pickup-selected' : 'lp-dest-selected';
    const div = document.getElementById(prefix);
    if (!div) return;

    div.style.display = 'block';
    const labelEl = div.querySelector('.lp-info-label');
    const coordsEl = div.querySelector('.lp-info-coords');
    const saveBtn = div.querySelector('.lp-save-btn');

    // Tampilkan label
    if (loc.savedLabel) {
        labelEl.textContent = `${loc.savedLabel} - ${loc.label}`;
    } else {
        labelEl.textContent = loc.label;
    }

    // Tampilkan koordinat
    coordsEl.textContent = `${roundCoord(loc.lat).toFixed(COORD_DECIMALS)}, ${roundCoord(loc.lng).toFixed(COORD_DECIMALS)}`;

    // Tombol simpan
    saveBtn.onclick = () => {
        saveRecentLocation({ label: loc.label, lat: loc.lat, lng: loc.lng });
        // Perbarui tombol saved
        const savedBtnsDiv = document.getElementById(
            type === 'pickup' ? 'lp-pickup-saved-btns' : 'lp-dest-saved-btns'
        );
        const searchInput = document.getElementById(
            type === 'pickup' ? 'lp-search-pickup' : 'lp-search-dest'
        );
        const nextOrCalcBtn = document.getElementById(
            type === 'pickup' ? 'lp-next3' : 'lp-calc-btn'
        );
        renderRecentSavedButtons(type, savedBtnsDiv, searchInput, nextOrCalcBtn);
        ThemeManager.showToast('Lokasi disimpan', 'success');
    };
}

// =============================================================================
//                 FUNGSI COOLDOWN UNTUK TOMBOL HITUNG                     
// =============================================================================

function checkCooldownForButton(btn) {
    const lastCalcUtc = sessionStorage.getItem('picker_last_calc_utc');
    const nowUtc = GPS.getCurrentUTCTime().utc;
    if (lastCalcUtc) {
        const elapsed = (nowUtc - parseInt(lastCalcUtc)) / 1000;
        if (elapsed < COOLDOWN_SEC) {
            state.cooldownRemaining = Math.ceil(COOLDOWN_SEC - elapsed);
            startButtonCooldown(btn);
        }
    }
}

function startButtonCooldown(btn) {
    btn.disabled = true;
    const originalText = 'Hitung Jarak & Waktu';
    const updateDisplay = () => {
        const m = Math.floor(state.cooldownRemaining / 60);
        const s = state.cooldownRemaining % 60;
        btn.textContent = `Tunggu ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    updateDisplay();
    state.cooldownBtnTimer = setInterval(() => {
        state.cooldownRemaining--;
        if (state.cooldownRemaining <= 0) {
            clearInterval(state.cooldownBtnTimer);
            state.cooldownBtnTimer = null;
            btn.disabled = false;
            btn.textContent = originalText;
            state.cooldownActive = false;
        } else {
            updateDisplay();
        }
    }, 1000);
}

async function handleCalculateClick(btn) {
    // Periksa cooldown lagi (jika habis saat idle)
    const lastCalcUtc = sessionStorage.getItem('picker_last_calc_utc');
    const nowUtc = GPS.getCurrentUTCTime().utc;
    if (lastCalcUtc) {
        const elapsed = (nowUtc - parseInt(lastCalcUtc)) / 1000;
        if (elapsed < COOLDOWN_SEC) {
            state.cooldownRemaining = Math.ceil(COOLDOWN_SEC - elapsed);
            startButtonCooldown(btn);
            return;
        }
    }

    // Mulai perhitungan
    btn.disabled = true;
    btn.textContent = 'Menghitung...';
    const errorDiv = document.getElementById('lp-route-error');
    if (errorDiv) errorDiv.style.display = 'none';

    try {
        window.log.info('[picker ' + F_V + '] Menghitung rute dengan vehicle = ' + state.vehicle);
        const { distance, duration, geometry } = await fetchOSRMRouteWithGeometry();
        const correction = CORRECTION[state.vehicle] || CORRECTION.Mobil;

        let distKm = (distance / 1000) * correction.distFactor + correction.distAdd;
        distKm = Math.round(distKm * 10) / 10;

        let durMenit = (duration / 60) * correction.timeFactor + correction.timeAdd;
        if (isPeakHour(state.pickup?.lng || 106.8)) durMenit *= correction.peakMult;
        durMenit = Math.ceil(durMenit);

        // Simpan cooldown
        sessionStorage.setItem('picker_last_calc_utc', String(GPS.getCurrentUTCTime().utc));

        // Simpan hasil rute di state
        state.routeResult = {
            distanceKm: distKm,
            durationMin: durMenit,
            geometry
        };

        // Pindah ke halaman hasil
        goToPage(7);
    } catch (err) {
        window.log.error('[picker ' + F_V + '] Gagal hitung rute:', err);
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = `Gagal menghitung rute: ${err.message || 'Periksa koneksi atau coba lagi.'}`;
        }
        btn.disabled = false;
        btn.textContent = 'Hitung Jarak & Waktu';
    }
}

// =============================================================================
//                    FUNGSI API EKSTERNAL (Nominatim, OSRM)               
// =============================================================================

async function searchLocation(query, resultsDiv, onSelect) {
    const cache = getCache('lp_geocoding');
    if (cache[query] && (Date.now() - cache[query].timestamp < CACHE_MAX_AGE_MS)) {
        displayResults(cache[query].results, resultsDiv, onSelect);
        return;
    }

    if (state.abortController) state.abortController.abort();
    state.abortController = new AbortController();

    try {
        const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=id&countrycodes=id`;
        const res = await fetch(url, { signal: state.abortController.signal });
        const data = await res.json();
        const results = data.map(item => ({
            label: item.display_name,
            lat: roundCoord(parseFloat(item.lat)),
            lng: roundCoord(parseFloat(item.lon))
        }));

        cache[query] = { results, timestamp: Date.now() };
        setCache('lp_geocoding', cache);
        displayResults(results, resultsDiv, onSelect);
    } catch (err) {
        if (err.name !== 'AbortError') {
            resultsDiv.innerHTML = '<div class="text-danger">Gagal mencari. Coba lagi nanti.</div>';
        }
    }
}

function displayResults(results, container, onSelect) {
    // Hapus konten lama
    container.innerHTML = '';

    results.forEach(r => {
        const div = document.createElement('div');
        div.className = 'lp-result-item';
        div.dataset.lat = r.lat;
        div.dataset.lng = r.lng;
        // Gunakan textContent untuk mencegah XSS
        div.textContent = r.label;

        div.addEventListener('click', () => {
            onSelect({
                label: r.label,
                lat: roundCoord(parseFloat(r.lat)),
                lng: roundCoord(parseFloat(r.lng))
            });
        });

        container.appendChild(div);
    });
}

/**
 * Mengambil rute OSRM dengan geometry penuh.
 * @returns {Promise<{distance: number, duration: number, geometry: Array<[number, number]>}>}
 */
async function fetchOSRMRouteWithGeometry() {
    const profile = state.vehicle === 'Motor' ? 'bike' : 'car';
    window.log.info('[picker ' + F_V + '] OSRM profile = ' + profile);
    const { pickup, destination } = state;
    if (!pickup || !destination) throw new Error('Lokasi jemput atau antar belum dipilih');
    if (!pickup.lat || !pickup.lng || !destination.lat || !destination.lng) {
        throw new Error('Koordinat tidak valid');
    }

    // Gunakan overview=full dan geometries=geojson
    const url = `${OSRM_BASE}/${profile}/${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
    window.log.info('[picker ' + F_V + '] OSRM request: ' + url);
  
    const cacheKey = `${profile}_${pickup.lat}_${pickup.lng}_${destination.lat}_${destination.lng}`;
    const routeCache = getCache('lp_route');
    if (routeCache[cacheKey] && (Date.now() - routeCache[cacheKey].timestamp < CACHE_MAX_AGE_MS)) {
        window.log.info('[picker ' + F_V + '] OSRM menggunakan cache');
        return routeCache[cacheKey].data;
    }

    const res = await fetch(url);
    const json = await res.json();

    if (json.code !== 'Ok') {
        throw new Error('OSRM error: ' + (json.message || 'Rute tidak ditemukan'));
    }
    const route = json.routes[0];
    const leg = route.legs[0];
    // Ekstrak koordinat dari GeoJSON geometry
    const geometryCoords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]); // [lng, lat] -> [lat, lng]
    const data = {
        distance: leg.distance,
        duration: leg.duration,
        geometry: geometryCoords
    };

    routeCache[cacheKey] = { data, timestamp: Date.now() };
    setCache('lp_route', routeCache);
    return data;
}

function isPeakHour(lng) {
    const timeObj = GPS.getCurrentUTCTime(lng);
    const local = new Date(timeObj.utc + timeObj.offset * 3600 * 1000);
    const day = local.getUTCDay();   // 1=Senin, 6=Sabtu
    const hour = local.getUTCHours();

    if (PEAK_HOURS.pagi.days.includes(day) && hour >= PEAK_HOURS.pagi.start && hour <= PEAK_HOURS.pagi.end) {
        return true;
    }
    if (PEAK_HOURS.sore.days.includes(day) && hour >= PEAK_HOURS.sore.start && hour <= PEAK_HOURS.sore.end) {
        return true;
    }
    return false;
}

// =============================================================================
//                        OPEN & EKSPOS MODUL                               
// =============================================================================

function open() {
    window.log.info('[picker ' + F_V + '] (2) open() dipanggil');

    // Pembersihan polyline lama (kalau ada) – hanya di awal buka
    clearSavedPolyline();

    const input = StateManager.get('input') || {};
    state.vehicle = input.E10 || 'Motor';
    state.role = input.E12 || 'Driver';
    state.area = input.E20 || 'Jabodetabek';
    state.page = 1;
    state.pickup = null;
    state.destination = null;
    state.cooldownActive = false;
    state.cooldownRemaining = 0;
    state.mapActive = false;
    state.routeResult = null;
    if (state.abortController) { state.abortController.abort(); state.abortController = null; }
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.cooldownBtnTimer) { clearInterval(state.cooldownBtnTimer); state.cooldownBtnTimer = null; }
    if (state._debounceTimer) { clearTimeout(state._debounceTimer); state._debounceTimer = null; }
    
    window.log.info('[picker ' + F_V + '] (2a) input.E10 = ' + input.E10 + ', state.vehicle = ' + state.vehicle);

    cleanExpiredCache();

    Router.navigateTo({ target: 'popup21' });

    // DOM sudah siap setelah navigateTo sinkron
    renderPage();
}

// Registrasi popup
PopupManager.register(21, () => createPickerContainer());

export const LocationPicker = {
    open,
    cleanup,
    onComplete: null,
    getSavedPolyline,
    clearSavedPolyline
};

window.log.info('[picker ' + F_V + '] (3) LocationPicker dimuat');


// ================================ End Of File ================================