/**
 * =================================================================================
 * FILE         : /js/pages/privacy.js
 * FILE VERSION : 2.0.1-rev2
 * APP VERSION  : 2.0.1
 * DATE         : 14 Juli 2026
 * @author      : gk
 *
 * CHANGELOG  :
 *
 * =================================================================================
 */

'use strict';

// ==================== VERSI FILE ====================
const F_V = '2.0.1-rev2';

import { Router } from '../core/router.js';
import { StateManager } from '../core/state.js';
import { HeaderManager } from '../components/header.js';
import { FooterManager } from '../components/footer.js';
import { DrawerManager } from '../components/drawer.js';

// =============================================================================
// 0. IKON LOKAL (tidak lagi bergantung pada getIcon dari texts.js)
// =============================================================================

const ICON = {
    LOCK: '🔒',
    BACK: '◀',
    MENU: '☰',
    HOME: '🏠'
};

// =============================================================================
// 1. STATE INTERNAL
// =============================================================================

let isDestroyed = false;
let currentHeader = null;

const OVERVIEW_HTML = `<div class="privacy-overview">
    <div class="text-center mb-lg"><span style="font-size: 3rem;">${ICON.LOCK}</span><h2 class="text-xl font-bold mt-sm">Privasi Anda Penting</h2></div>
    <div class="divider"></div>
    <p class="mb-md"><strong>KupasTarif</strong> dirancang dengan mengutamakan privasi pengguna. Semua data Anda tetap berada di perangkat Anda.</p>
    <p class="mb-md">Aplikasi ini:</p>
    <ul class="mb-lg" style="padding-left: 1.5rem;"><li>✅ <strong>Menyimpan semua data di HP Anda</strong> (LocalStorage)</li><li>✅ <strong>Mengkripsi data sensitif</strong> (nama, plat, telepon)</li><li>✅ <strong>Tidak mengirim data ke server</strong> - 100% offline-first</li><li>✅ <strong>Tidak menggunakan akun atau login</strong></li><li>✅ <strong>Tidak menampilkan iklan</strong></li><li>✅ <strong>Tidak melacak aktivitas Anda</strong> (tidak ada Google Analytics)</li></ul>
    <div class="bg-muted p-md rounded-lg"><p class="text-sm text-center"><span class="text-secondary">${ICON.LOCK} Data driver (nama, plat, telepon) dienkripsi sebelum disimpan. Diem aja di hape situ.</span></p></div>
</div>`;

// Konten detail (sebelumnya dari docs/privacy.html)
const DETAIL_HTML = `
<style>
    .privacy-container {
        font-family: var(--font-family, 'Inter', sans-serif);
        line-height: 1.7;
        color: var(--text-primary, #0f172a);
        max-width: 100%;
        margin: 0 auto;
        padding: var(--space-md, 12px) 0;
    }
    .privacy-container h1 {
        font-size: var(--text-xl, 1.0625rem);
        font-weight: var(--font-bold, 700);
        color: var(--text-primary);
        border-bottom: 1px solid var(--border, #e2e8f0);
        padding-bottom: var(--space-sm, 8px);
        margin-bottom: var(--space-md, 12px);
    }
    .privacy-container h2 {
        font-size: var(--text-base, 0.8125rem);
        font-weight: var(--font-semibold, 600);
        color: var(--text-primary);
        margin-top: var(--space-lg, 16px);
        margin-bottom: var(--space-xs, 4px);
    }
    .privacy-container h3 {
        font-size: var(--text-sm, 0.75rem);
        font-weight: var(--font-semibold, 600);
        color: var(--text-primary);
        margin-top: var(--space-md, 12px);
        margin-bottom: var(--space-xs, 4px);
    }
    .privacy-container p {
        font-size: var(--text-sm, 0.75rem);
        color: var(--text-secondary, #475569);
        margin-bottom: var(--space-sm, 8px);
    }
    .privacy-container ul {
        list-style: none;
        padding-left: 0;
        margin: var(--space-sm, 8px) 0 var(--space-md, 12px);
    }
    .privacy-container li {
        position: relative;
        padding-left: 24px;
        margin-bottom: var(--space-sm, 8px);
        font-size: var(--text-sm, 0.75rem);
        color: var(--text-secondary);
    }
    .privacy-container li::before {
        content: '🔒';
        position: absolute;
        left: 0;
        top: 0;
        font-size: var(--text-sm, 0.75rem);
    }
    .privacy-highlight {
        background-color: var(--bg-muted, #f1f5f9);
        border-left: 3px solid var(--primary, #0d7c4a);
        padding: var(--space-sm, 8px) var(--space-md, 12px);
        border-radius: 0 var(--radius-sm, 6px) var(--radius-sm, 6px) 0;
        margin: var(--space-md, 12px) 0;
    }
    .privacy-highlight p {
        margin: 0;
        font-weight: var(--font-medium, 500);
        color: var(--text-primary);
        font-size: var(--text-sm, 0.75rem);
    }
    .privacy-warning {
        background-color: rgba(220, 38, 38, 0.08);
        border-left: 3px solid var(--danger, #dc2626);
        padding: var(--space-sm, 8px) var(--space-md, 12px);
        border-radius: 0 var(--radius-sm, 6px) var(--radius-sm, 6px) 0;
        margin: var(--space-md, 12px) 0;
    }
    .privacy-version {
        font-size: var(--text-xs, 0.625rem);
        color: var(--text-muted, #94a3b8);
        margin-top: var(--space-xl, 20px);
        padding-top: var(--space-sm, 8px);
        border-top: 1px solid var(--border, #e2e8f0);
        text-align: center;
        font-style: italic;
    }
</style>
<div class="privacy-container">
    <h1>🔒 Kebijakan Privasi</h1>
    <p><strong>KupasTarif</strong> - Privasi Anda adalah prioritas kami.</p>
    
    <div class="privacy-highlight">
        <p>KupasTarif dirancang dengan prinsip <strong>Privacy by Design</strong>. Semua data Anda tetap berada di perangkat Anda sendiri.</p>
    </div>
    
    <h2>📱 Data yang Disimpan</h2>
    <ul>
        <li><strong>Riwayat Perjalanan:</strong> Data estimasi dan hasil kalkulasi.</li>
        <li><strong>Preferensi Pengguna:</strong> Pengaturan aplikasi (mode, kendaraan default).</li>
        <li><strong>Data Driver:</strong> Nama, plat nomor, telepon (opsional, terenkripsi).</li>
        <li><strong>Data Tracking:</strong> Koordinat GPS perjalanan (jika menggunakan fitur tracking).</li>
    </ul>
    
    <h2>🔐 Enkripsi Data</h2>
    <ul>
        <li>Data driver (nama, plat, telepon) dienkripsi sebelum disimpan.</li>
        <li>Menggunakan metode obfuscation dengan salt dan base64 berlapis.</li>
        <li>Hanya dapat dibaca oleh aplikasi KupasTarif.</li>
    </ul>
    
    <h2>🚫 Data yang TIDAK Dikumpulkan</h2>
    <ul>
        <li>Tidak mengirim data ke server manapun.</li>
        <li>Tidak menggunakan Google Analytics atau tracking pihak ketiga.</li>
        <li>Tidak mengumpulkan data lokasi secara background.</li>
        <li>Tidak menyimpan informasi kartu kredit atau pembayaran.</li>
        <li>Tidak menggunakan akun atau login.</li>
    </ul>
    
    <h2>💾 Penyimpanan Lokal</h2>
    <ul>
        <li>Semua data disimpan di <strong>LocalStorage</strong> browser Anda.</li>
        <li>Maksimal 50 riwayat perjalanan.</li>
        <li>Riwayat tertua akan otomatis terhapus jika melebihi batas.</li>
        <li>Anda dapat menghapus semua data kapan saja melalui menu Pengaturan.</li>
    </ul>
    
    <h2>📍 Izin Aplikasi</h2>
    <ul>
        <li><strong>GPS/Lokasi:</strong> Hanya digunakan saat fitur Tracking aktif. Tidak merekam di background.</li>
        <li><strong>Penyimpanan:</strong> Untuk menyimpan data aplikasi dan screenshot struk.</li>
        <li><strong>Clipboard:</strong> Untuk fitur Copy Hasil dan Copy Rute.</li>
    </ul>
    
    <div class="privacy-warning">
        <h3>⚠️ Penting!</h3>
        <p>Karena data disimpan secara lokal di perangkat Anda:</p>
        <ul>
            <li>Menghapus data browser akan menghapus semua riwayat.</li>
            <li>Ganti perangkat = data tidak ikut pindah.</li>
            <li>Uninstall browser = data hilang.</li>
        </ul>
        <p><strong>Backup data secara berkala</strong> jika Anda ingin menyimpan riwayat jangka panjang.</p>
    </div>
    
    <h2>🔄 Perubahan Kebijakan</h2>
    <p>Kebijakan privasi ini dapat diperbarui sewaktu-waktu. Perubahan akan diumumkan melalui update aplikasi.</p>
    
    <h2>📞 Kontak</h2>
    <p>Jika ada pertanyaan tentang privasi, hubungi kami di: <strong>privacy@kupastarif.example.com</strong></p>
    
    <div class="privacy-version">
        Kebijakan Privasi v1.0<br>
        Berlaku sejak: April 2026
    </div>
</div>`;

// =============================================================================
// 2. BUILD HTML
// =============================================================================

function buildHTML(isTldr) {
    if (isTldr) {
        // Langsung tampilkan konten detail, tanpa spinner
        return `<div class="page-container"><div class="card"><div id="privacy-content" class="privacy-content">${DETAIL_HTML}</div></div></div>`;
    }
    return `<div class="page-container"><div class="card"><div id="privacy-content" class="privacy-content">${OVERVIEW_HTML}</div><div class="privacy-footer mt-lg text-center"><button id="tldr-btn" class="btn btn-outline">TLDR yes or no?</button></div></div></div>`;
}

// =============================================================================
// 3. BIND EVENTS
// =============================================================================

function bindEvents(isTldr) {
    const tldrBtn = document.getElementById('tldr-btn');
    if (tldrBtn && !isTldr) {
        tldrBtn.addEventListener('click', () => {
            if (isDestroyed) return;
            Router.navigateTo({ target: 'privacytldr' });
        });
    }
}

// =============================================================================
// 4. REGISTRASI DRAWER
// =============================================================================

DrawerManager.register('privacy', () => ({
    menuItems: null,
    onItemClick: (page) => {
        Router.navigateTo({ target: page, closeDrawer: true });
    }
}));

// =============================================================================
// 5. HEADER & FOOTER
// =============================================================================

function updateHeader() {
    const container = document.getElementById('app-header');
    if (!container || !HeaderManager) return;
    if (currentHeader) HeaderManager.destroy(currentHeader);
    const header = HeaderManager.create('default', { title: window.APP_CONFIG?.siteTitle });
    container.innerHTML = '';
    if (header) { container.appendChild(header); currentHeader = header; }
    else currentHeader = null;
}

function updateFooter(isTldr) {
    const container = document.getElementById('app-footer');
    if (!container || !FooterManager) return;
    
    if (isTldr) {
        const footer = FooterManager.create('layoutA', {
            frame1: { type: 'icon', content: FooterManager.createIconButton(ICON.BACK, () => {
                Router.navigateTo({ target: 'privacy' });
            }, 'Kembali') },
            frame2: { type: 'flex', content: FooterManager.createFlexContent('HOME', ICON.HOME, () => {
                Router.navigateTo({ target: 'home' });
            }) }
        });
        container.innerHTML = '';
        if (footer) container.appendChild(footer);
    } else {
        const footer = FooterManager.create('layoutA', {
            frame1: {
                type: 'icon',
                content: FooterManager.createIconButton(ICON.MENU, () => {
                    Router.navigateTo({ target: 'drawer1' });
                }, 'Menu')
            },
            frame2: {
                type: 'flex',
                content: FooterManager.createFlexContent('HOME', ICON.HOME, () => {
                    Router.navigateTo({ target: 'home' });
                })
            }
        });
        container.innerHTML = '';
        if (footer) container.appendChild(footer);
    }
}

// =============================================================================
// 6. RENDER & DESTROY
// =============================================================================

function render(params, context = {}) {
    const content = document.getElementById('app-content');
    if (!content) return;
    isDestroyed = false;

    const isTldr = params?.tldr === true;

    content.innerHTML = buildHTML(isTldr);
    bindEvents(isTldr);
    updateHeader();
    updateFooter(isTldr);

    window.log.info('[Privacy ' + F_V + '] (2) Privacy dirender | tldr=' + isTldr);
}

function destroy() {
    isDestroyed = true;
    if (currentHeader) { HeaderManager.destroy(currentHeader); currentHeader = null; }
}

// =============================================================================
// 7. EKSPOR
// =============================================================================

export const PagePrivacy = {
    render,
    destroy
};

export const PagePrivacytldr = {
    render: (params, context) => render({ ...params, tldr: true }, context),
    destroy
};

window.log.info('[Privacy ' + F_V + '] (3) PagePrivacy & PagePrivacytldr dimuat');


// ================================ End Of File ================================