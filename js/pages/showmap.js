/**
 * =================================================================================
 * FILE         : /js/pages/showmap.js
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

import { Router } from '../core/router.js';
import { StateManager } from '../core/state.js';
import { StorageManager } from '../core/storage.js';
import { MapManager } from '../maps/map.js';
import { HeaderManager } from '../components/header.js';
import { FooterManager } from '../components/footer.js';
import { ThemeManager } from '../components/theme.js';
import { DrawerManager } from '../components/drawer.js';
import { formatKm, formatRupiah } from '../helpers/format.js';
import {
    decodeRouteData, encodeRouteData, generateKML, parseKML
} from '../helpers/output.js';

// =============================================================================
// 0. IKON LOKAL (tidak lagi bergantung pada getIcon dari texts.js)
// =============================================================================

const ICON = {
    CHART: '📈',
    SHOW_MAP: '🗺️',
    COPY: '📋',
    CHECK: '✓',
    SPINNER: '⏳',
    PASTE: '📋',
    BACK: '◀',
    HOME: '🏠',
    MENU: '☰',
    EXPORT: '📤'
};

// =============================================================================
// 1. STATE INTERNAL
// =============================================================================

let isDestroyed = false;
let mode = 'menu';          // 'menu' | 'report' (untuk showmapdetail)
let refId = null;
let trackingData = null;
let hasRendered = false;
let role = 'Driver';
let driverInfo = { name: '', plate: '', phone: '' };
let rawPastedText = '';

let currentHeader = null;

// =============================================================================
// 2. LOAD DATA
// =============================================================================

function loadTrackingData(refIdParam) {
    if (!StorageManager) return null;
    const item = StorageManager.getHistoryByRefId(refIdParam);
    if (item && item.trackingData) {
        role = item.input?.E12 || 'Driver';
        driverInfo = item.driverInfo || StorageManager.getDriverInfo();
        window.log.info('[Showmap ' + F_V + '] (1) Data tracking dimuat dari history');
        return item.trackingData;
    }
    window.log.warn('[Showmap ' + F_V + '] (2) Data tracking tidak ditemukan untuk refId:', refIdParam);
    return null;
}

// =============================================================================
// 3. PETA
// =============================================================================

async function renderMap(containerId, data) {
    if (!MapManager) {
        window.log.error('[Showmap ' + F_V + '] (3) MapManager tidak tersedia');
        return;
    }
    await MapManager.initForShowMap(containerId, data, { role });
}

// =============================================================================
// 4. INFO PANEL (TAMPILKAN ZONA WAKTU JIKA ADA)
// =============================================================================

function renderInfoPanel(data) {
    const formatWaktu = (menit) => {
        if (!menit || menit <= 0) return '0 menit';
        const jam = Math.floor(menit / 60);
        const sisaMenit = menit % 60;
        if (jam > 0) return `${jam} jam ${sisaMenit} menit`;
        return `${sisaMenit} menit`;
    };
    const formatPauseTime = (detik) => formatWaktu(Math.ceil(detik / 60));

    const driverInfoText = data.driverInfo?.name
        ? `${data.driverInfo.name} · ${data.driverInfo.plate} · ${data.driverInfo.phone}`
        : '';

    let paymentValue = 0;
    if (data.payment) {
        const parts = data.payment.split('|');
        paymentValue = parseInt(parts[0]) || 0;
    }

    let waktuSelesai = data.dropoffTimeStr || '';
    if (waktuSelesai.indexOf('|') !== -1) waktuSelesai = waktuSelesai.split('|')[0];

    const timezoneName = data.timezoneName || '';
    const startWithZone = timezoneName 
        ? `${data.startTime || '--:--:--'} ${timezoneName}`
        : data.startTime || '--:--:--';
    const selesaiWithZone = timezoneName 
        ? `${waktuSelesai || '--:--:--'} ${timezoneName}`
        : waktuSelesai || '--:--:--';

    return `<div class="card showmap-info-card">
        <div class="card-header"><span class="card-title">${ICON.CHART} INFO PERJALANAN</span></div>
        <div class="showmap-info-content">
            ${driverInfoText ? `<div class="info-row"><span class="info-label">Driver</span><span class="info-value">${driverInfoText}</span></div>` : ''}
            <div class="info-row"><span class="info-label">Waktu Mulai</span><span class="info-value">${startWithZone}</span></div>
            <div class="info-row"><span class="info-label">Waktu Selesai</span><span class="info-value">${selesaiWithZone}</span></div>
            <div class="info-row"><span class="info-label">Penjemputan</span><span class="info-value">${formatKm(data.pickupDistance || 0)}, ${formatWaktu(data.pickupTime || 0)}</span></div>
            <div class="info-row"><span class="info-label">Pengantaran</span><span class="info-value">${formatKm(data.dropoffDistance || 0)}, ${formatWaktu(data.dropoffTime || 0)}</span></div>
            <div class="info-divider"></div>
            <div class="info-row"><span class="info-label">Pause</span><span class="info-value">${data.pauseCount || 0} kali, ${formatPauseTime(data.pauseTime || 0)}</span></div>
            <div class="info-row"><span class="info-label">Lonjatan</span><span class="info-value">${data.jumpCount || 0} kali, ${formatKm(data.jumpTotal || 0)}</span></div>
            <div class="info-row"><span class="info-label">Pembayaran</span><span class="info-value">${formatRupiah(paymentValue)}</span></div>
        </div>
    </div>`;
}

// =============================================================================
// 5. BUILD HTML
// =============================================================================

function buildReportHTML() {
    return `<div class="page-container">
        <div id="showmap-map-container" class="map-container">
            <div class="map-placeholder"><div class="spinner"></div><p>Memuat peta...</p></div>
        </div>
        <div id="showmap-info-container">${trackingData ? renderInfoPanel(trackingData) : ''}</div>
    </div>`;
}

function buildMenuHTML() {
    return `<div class="page-container">
        <div class="card">
            <div class="card-header"><span class="card-title">${ICON.SHOW_MAP} SHOW MAP</span></div>
            <div class="showmap-paste-container">
                <div class="paste-header">
                    <span>Paste data rute perjalanan di bawah ini:</span>
                    <button class="btn btn-sm btn-outline" id="paste-btn">${ICON.COPY} PASTE</button>
                </div>
                <textarea id="paste-textarea" class="showmap-textarea" placeholder="Klik PASTE untuk menempelkan data rute..." readonly></textarea>
                <button class="btn btn-primary btn-block mt-md" id="tampilkan-btn">${ICON.CHECK} TAMPILKAN</button>
            </div>
        </div>
    </div>`;
}

// =============================================================================
// 6. COPY & EXPORT
// =============================================================================

function handleCopyRute() {
    let text = '';
    if (mode === 'menu' && rawPastedText) {
        text = rawPastedText;
    } else if (trackingData && refId) {
        const payment = trackingData.payment ? parseInt(trackingData.payment.split('|')[0]) : 0;
        const bill = trackingData.payment ? parseInt(trackingData.payment.split('|')[1]) || 0 : 0;
        text = encodeRouteData(trackingData, refId, payment, bill, driverInfo);
    }

    if (!text) {
        ThemeManager?.showToast('Tidak ada data untuk disalin', 'warning');
        return;
    }

    navigator.clipboard.writeText(text)
        .then(() => ThemeManager?.showToast('Rute berhasil disalin', 'success'))
        .catch(() => ThemeManager?.showToast('Gagal menyalin rute', 'error'));
}

function handleExportKML() {
    if (!trackingData) {
        ThemeManager?.showToast('Tidak ada data untuk diekspor', 'warning');
        return;
    }

    const kml = generateKML(trackingData, refId || 'track', driverInfo);
    const fileName = refId ? `kupastarif_${refId}.kml` : 'kupastarif_track.kml';
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    ThemeManager?.showToast('KML berhasil diekspor', 'success');
}

// =============================================================================
// 7. EVENT HANDLERS
// =============================================================================

function bindMenuEvents() {
    const pasteBtn = document.getElementById('paste-btn');
    const tampilkanBtn = document.getElementById('tampilkan-btn');
    const textarea = document.getElementById('paste-textarea');
    let isPasting = false, isRendering = false;

    if (textarea) {
        textarea.readOnly = true;
        textarea.addEventListener('keydown', e => e.preventDefault());
        textarea.addEventListener('input', () => { if (!isPasting) textarea.value = ''; });
    }

    if (pasteBtn) {
        pasteBtn.addEventListener('click', async () => {
            if (isDestroyed || isPasting) return;
            isPasting = true;
            pasteBtn.disabled = true;
            pasteBtn.textContent = ICON.SPINNER + ' ...';
            try {
                const text = await navigator.clipboard.readText();
                if (textarea) textarea.value = text;
                ThemeManager?.showToast('Data ditempel dari clipboard', 'success');
            } catch (error) {
                ThemeManager?.showToast('Gagal membaca clipboard', 'error');
            } finally {
                isPasting = false;
                pasteBtn.disabled = false;
                pasteBtn.textContent = `${ICON.PASTE} PASTE`;
            }
        });
    }

    if (tampilkanBtn) {
        tampilkanBtn.addEventListener('click', async () => {
            if (isDestroyed || isRendering) return;
            const text = textarea ? textarea.value.trim() : '';
            if (!text) {
                ThemeManager?.showToast('Masukkan data rute terlebih dahulu', 'warning');
                return;
            }
            isRendering = true;
            tampilkanBtn.disabled = true;
            tampilkanBtn.textContent = ICON.SPINNER + ' MEMUAT...';
            try {
                rawPastedText = text;

                try {
                    trackingData = decodeRouteData(text);
                } catch (ktError) {
                    window.log.info('[Showmap ' + F_V + '] (4) Gagal decode KT, mencoba import KML...');
                    trackingData = parseKML(text);
                }

                mode = 'menu';
                hasRendered = true;

                if (trackingData.driverInfo) {
                    driverInfo = trackingData.driverInfo;
                }

                StateManager.set('showmap.pastedData', trackingData);
                Router.navigateTo({ target: 'showmapdetail', refid: 'paste' });

            } catch (error) {
                ThemeManager?.showToast(error.message || 'Format data tidak dikenal', 'error');
            } finally {
                isRendering = false;
                tampilkanBtn.disabled = false;
                tampilkanBtn.textContent = `${ICON.CHECK} TAMPILKAN`;
            }
        });
    }
}

// =============================================================================
// 8. HEADER & FOOTER
// =============================================================================

function updateHeaderFooter(forMap) {
    const headerContainer = document.getElementById('app-header');
    const footerContainer = document.getElementById('app-footer');

    if (currentHeader) {
        HeaderManager.destroy(currentHeader);
        currentHeader = null;
    }

    if (headerContainer && HeaderManager) {
        const header = forMap
            ? HeaderManager.create('landing', { landingText: window.APP_CONFIG?.landingLink || 'linktr.ee/KUPASTARIF' })
            : HeaderManager.create('default', { title: window.APP_CONFIG?.siteTitle });
        headerContainer.innerHTML = '';
        if (header) {
            headerContainer.appendChild(header);
            currentHeader = header;
        }
    }

    if (footerContainer && FooterManager) {
        if (forMap) {
            const backTarget = Router.getBackPath() || 'report';
            const footer = FooterManager.create('layoutB', {
                frame1: { type: 'icon', content: FooterManager.createIconButton(ICON.BACK, () => {
                    Router.navigateTo({ target: backTarget });
                }, 'Kembali') },
                frame2: { type: 'flex', content: FooterManager.createFlexContent('COPY RUTE', ICON.COPY, handleCopyRute) },
                frame3: { type: 'flex', content: FooterManager.createFlexContent('DOWNLOAD KML', ICON.EXPORT, handleExportKML) }
            });
            footerContainer.innerHTML = '';
            if (footer) footerContainer.appendChild(footer);
        } else {
            const footer = FooterManager.create('layoutA', {
                frame1: { type: 'icon', content: FooterManager.createIconButton(ICON.MENU, () => {
                    Router.navigateTo({ target: 'drawer1' });
                }, 'Menu') },
                frame2: { type: 'flex', content: FooterManager.createFlexContent('HOME', ICON.HOME, () => {
                    Router.navigateTo({ target: 'home' });
                }) }
            });
            footerContainer.innerHTML = '';
            if (footer) footerContainer.appendChild(footer);
        }
    }
}

// =============================================================================
// 9. REGISTRASI DRAWER
// =============================================================================

DrawerManager.register('showmappaste', () => ({
    menuItems: null,
    onItemClick: (page) => {
        Router.navigateTo({ target: page, closeDrawer: true });
    }
}));

// =============================================================================
// 10. RENDER & DESTROY
// =============================================================================

async function render(params, context = {}) {
    const content = document.getElementById('app-content');
    if (!content) return;

    isDestroyed = false;
    hasRendered = false;
    trackingData = null;
    rawPastedText = '';

    const direction = context.direction || 'forward';

    if (params?.refid) {
        mode = 'report';
        refId = params.refid;

        if (direction === 'forward') {
            trackingData = loadTrackingData(refId);
        }

        if (!trackingData) {
            content.innerHTML = `<div class="page-container text-center p-lg">
                <div class="card"><p class="text-danger">Data tracking tidak ditemukan</p>
                <button class="btn btn-primary mt-md" id="back-btn">Kembali</button></div>
            </div>`;
            document.getElementById('back-btn')?.addEventListener('click', () => {
                Router.navigateTo({ target: Router.getBackPath() || 'report' });
            });
            updateHeaderFooter(false);
            return;
        }

        content.innerHTML = buildReportHTML();
        await renderMap('showmap-map-container', trackingData);
        hasRendered = true;
        updateHeaderFooter(true);

    } else {
        mode = 'menu';
        content.innerHTML = buildMenuHTML();
        bindMenuEvents();
        updateHeaderFooter(false);
    }

    window.log.info('[Showmap ' + F_V + '] (5) Showmap dirender | mode=' + mode);
}

function destroy() {
    isDestroyed = true;
    if (MapManager) MapManager.destroy();
    mode = 'menu';
    refId = null;
    trackingData = null;
    hasRendered = false;
    rawPastedText = '';
    StateManager.set('showmap.pastedData', null);

    if (currentHeader) {
        HeaderManager.destroy(currentHeader);
        currentHeader = null;
    }
}

// =============================================================================
// 11. EKSPOR
// =============================================================================

export const PageShowmappaste = {
    render,
    destroy
};

export const PageShowmapdetail = {
    render: (params, context) => {
        const pastedData = StateManager.get('showmap.pastedData');
        if (pastedData) {
            return render({ ...params, refid: 'paste', trackingData: pastedData }, context);
        }
        return render(params, context);
    },
    destroy
};

window.log.info('[Showmap ' + F_V + '] (6) PageShowmappaste & PageShowmapdetail dimuat');


// ================================ End Of File ================================