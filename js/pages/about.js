/**
 * =================================================================================
 * FILE         : /js/pages/about.js
 * FILE VERSION : 2.0.1-rev3
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
const F_V = '2.0.1-rev3';

import { Router } from '../core/router.js';
import { StateManager } from '../core/state.js';
import { HeaderManager } from '../components/header.js';
import { FooterManager } from '../components/footer.js';
import { DrawerManager } from '../components/drawer.js';

// =============================================================================
// 0. IKON LOKAL (tidak lagi bergantung pada getIcon dari texts.js)
// =============================================================================

const ICON = {
    BACK: '◀',
    MENU: '☰',
    HOME: '🏠',
    ELECTRIC: '⚡'       // Baru: ikon petir untuk brand/logo
};

// =============================================================================
// 1. STATE INTERNAL
// =============================================================================

let isDestroyed = false;
let currentHeader = null;

const OVERVIEW_HTML = `<div class="about-overview">
    <div class="text-center mb-lg"><div class="logo" style="font-size: 2.5rem;">${window.APP_CONFIG?.siteIcon || ICON.ELECTRIC}</div><h2 class="text-xl font-bold mt-sm">KupasTarif</h2><p class="text-secondary">Kalkulator tarif ojek online yang transparan</p></div>
    <div class="divider"></div>
    <p class="mb-md"><strong>KupasTarif</strong> adalah aplikasi kalkulator tarif ojek online yang membantu driver dan penumpang memahami rincian biaya perjalanan secara transparan.</p>
    <p class="mb-md">Aplikasi ini membantu:</p>
    <ul class="mb-lg" style="padding-left: 1.5rem;"><li><strong>Driver:</strong> Mengetahui pendapatan bersih setelah dipotong komisi dan biaya operasional.</li><li><strong>Penumpang:</strong> Melihat rincian tarif yang dibayarkan.</li></ul>
    <div class="bg-muted p-md rounded-lg mb-lg"><div class="flex justify-between"><span class="text-secondary">Versi App</span><span class="font-medium">${window.APP_CONFIG?.version || '2.0.1'}</span></div><div class="flex justify-between mt-sm"><span class="text-secondary">Versi Engine</span><span class="font-medium">v${window.Engine?.ENGINE_VERSION || '1.0.0-beta'}</span></div></div>
    <p class="text-muted text-sm text-center">Dibuat dengan ${ICON.ELECTRIC} oleh tim KupasTarif</p>
</div>`;

// Konten detail (sebelumnya dari docs/about.html)
const DETAIL_HTML = `
<style>
    .about-container {
        font-family: var(--font-family, 'Inter', sans-serif);
        line-height: 1.7;
        color: var(--text-primary, #0f172a);
        max-width: 100%;
        margin: 0 auto;
        padding: var(--space-md, 12px) 0;
    }
    .about-container h1 {
        font-size: var(--text-xl, 1.0625rem);
        font-weight: var(--font-bold, 700);
        color: var(--text-primary);
        border-bottom: 1px solid var(--border, #e2e8f0);
        padding-bottom: var(--space-sm, 8px);
        margin-bottom: var(--space-md, 12px);
    }
    .about-container h2 {
        font-size: var(--text-base, 0.8125rem);
        font-weight: var(--font-semibold, 600);
        color: var(--text-primary);
        margin-top: var(--space-lg, 16px);
        margin-bottom: var(--space-xs, 4px);
    }
    .about-container p {
        font-size: var(--text-sm, 0.75rem);
        color: var(--text-secondary, #475569);
        margin-bottom: var(--space-sm, 8px);
    }
    .about-container ul {
        list-style: none;
        padding-left: 0;
        margin: var(--space-sm, 8px) 0 var(--space-md, 12px);
    }
    .about-container li {
        position: relative;
        padding-left: 24px;
        margin-bottom: var(--space-sm, 8px);
        font-size: var(--text-sm, 0.75rem);
        color: var(--text-secondary);
    }
    .about-container li::before {
        content: '⚡';
        position: absolute;
        left: 0;
        top: 0;
        font-size: var(--text-sm, 0.75rem);
        color: var(--primary, #0d7c4a);
    }
    .about-highlight {
        background-color: var(--bg-muted, #f1f5f9);
        border-left: 3px solid var(--primary, #0d7c4a);
        padding: var(--space-sm, 8px) var(--space-md, 12px);
        border-radius: 0 var(--radius-sm, 6px) var(--radius-sm, 6px) 0;
        margin: var(--space-md, 12px) 0;
    }
    .about-highlight p {
        margin: 0;
        font-weight: var(--font-medium, 500);
        color: var(--text-primary);
        font-size: var(--text-sm, 0.75rem);
    }
    .about-version {
        font-size: var(--text-xs, 0.625rem);
        color: var(--text-muted, #94a3b8);
        margin-top: var(--space-xl, 20px);
        padding-top: var(--space-sm, 8px);
        border-top: 1px solid var(--border, #e2e8f0);
        text-align: center;
        font-style: italic;
    }
    .about-container a {
        color: var(--primary, #0d7c4a);
    }
</style>
<div class="about-container">
    <h1>⚡ KupasTarif</h1>
    <p><strong>Kalkulator tarif ojek online yang transparan</strong></p>
    
    <div class="about-highlight">
        <p>KupasTarif adalah aplikasi yang membantu driver dan penumpang memahami rincian biaya perjalanan secara transparan. Semua perhitungan menggunakan rumus yang akurat berdasarkan data resmi.</p>
    </div>
    
    <h2>🎯 Misi Kami</h2>
    <p>Memberikan transparansi penuh dalam perhitungan tarif ojek online, sehingga:</p>
    <ul>
        <li><strong>Driver</strong> dapat mengetahui pendapatan bersih setelah dipotong komisi dan biaya operasional.</li>
        <li><strong>Penumpang</strong> dapat melihat rincian tarif yang dibayarkan.</li>
    </ul>
    
    <h2>🔧 Fitur Utama</h2>
    <ul>
        <li><strong>Kalkulator Estimasi:</strong> Hitung perkiraan tarif sebelum order.</li>
        <li><strong>GPS Tracking:</strong> Rekam perjalanan real-time dengan akurasi tinggi.</li>
        <li><strong>Struk Digital:</strong> Simpan dan bagikan rincian perjalanan.</li>
        <li><strong>Laporan Analitik:</strong> 7 kartu informasi lengkap.</li>
        <li><strong>Riwayat Perjalanan:</strong> Simpan hingga 50 riwayat.</li>
        <li><strong>Mode Offline:</strong> Transaksi langsung tanpa potongan aplikasi.</li>
    </ul>
    
    <h2>📊 Sumber Data</h2>
    <p>Semua perhitungan berdasarkan:</p>
    <ul>
        <li>Tarif resmi dari aplikasi ojek online</li>
        <li>Data BBM (Pertalite/Bio Solar)</li>
        <li>Biaya perawatan kendaraan standar</li>
        <li>Pajak dan atribut kendaraan</li>
        <li>UMR regional (Jabodetabek, Sumatra-Jawa, Timur)</li>
    </ul>
    
    <h2>🔒 Privasi & Keamanan</h2>
    <ul>
        <li>Semua data disimpan di perangkat Anda (LocalStorage).</li>
        <li>Data sensitif (nama, plat, telepon) dienkripsi.</li>
        <li>Tidak mengirim data ke server manapun.</li>
        <li>Tidak menggunakan akun atau login.</li>
        <li>Tidak ada iklan.</li>
    </ul>
    
    <h2>👨‍💻 Tim Pengembang</h2>
    <p>KupasTarif dikembangkan secara independen oleh tim yang peduli dengan transparansi dan kesejahteraan driver ojek online.</p>
    
    <h2>📱 Kontak & Informasi</h2>
    <ul>
        <li>Website: <a href="#">kupastarif.example.com</a></li>
        <li>Linktree: <a href="#">linktr.ee/kupastarif</a></li>
    </ul>
    
    <div class="about-version">
        Versi App: ${window.APP_CONFIG?.version || '2.0.1'} | Engine: v${window.Engine?.ENGINE_VERSION || '1.0.0-beta'}<br>
        © 2026 KupasTarif
    </div>
</div>`;

// =============================================================================
// 2. BUILD HTML
// =============================================================================

function buildHTML(isTldr) {
    if (isTldr) {
        // Langsung tampilkan konten detail, tanpa spinner
        return `<div class="page-container"><div class="card"><div id="about-content" class="about-content">${DETAIL_HTML}</div></div></div>`;
    }
    return `<div class="page-container"><div class="card"><div id="about-content" class="about-content">${OVERVIEW_HTML}</div><div class="about-footer mt-lg text-center"><button id="tldr-btn" class="btn btn-outline">TLDR yes or no?</button></div></div></div>`;
}

// =============================================================================
// 3. BIND EVENTS
// =============================================================================

function bindEvents(isTldr) {
    const tldrBtn = document.getElementById('tldr-btn');
    if (tldrBtn && !isTldr) {
        tldrBtn.addEventListener('click', () => {
            if (isDestroyed) return;
            Router.navigateTo({ target: 'abouttldr' });
        });
    }
}

// =============================================================================
// 4. REGISTRASI DRAWER
// =============================================================================

DrawerManager.register('about', () => ({
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
                Router.navigateTo({ target: 'about' });
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

    window.log.info('[About ' + F_V + '] (2) About dirender | tldr=' + isTldr);
}

function destroy() {
    isDestroyed = true;
    if (currentHeader) { HeaderManager.destroy(currentHeader); currentHeader = null; }
}

// =============================================================================
// 7. EKSPOR
// =============================================================================

export const PageAbout = {
    render,
    destroy
};

export const PageAbouttldr = {
    render: (params, context) => render({ ...params, tldr: true }, context),
    destroy
};

window.log.info('[About ' + F_V + '] (3) PageAbout & PageAbouttldr dimuat');


// ================================ End Of File ================================