/**
 * =================================================================================
 * FILE         : /js/pages/note.js
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
    DOCUMENT: '📄',
    BACK: '◀',
    MENU: '☰',
    HOME: '🏠'
};

// =============================================================================
// 1. STATE INTERNAL
// =============================================================================

let isDestroyed = false;
let currentHeader = null;

const OVERVIEW_HTML = `<div class="notes-overview">
    <div class="text-center mb-lg">
        <div class="logo" style="font-size: 2.5rem;">${ICON.DOCUMENT}</div>
        <h2 class="text-xl font-bold mt-sm">Catatan</h2>
        <p class="text-secondary">Latar belakang dan tujuan kalkulator ride hailing</p>
    </div>
    <div class="divider"></div>
    <p class="mb-md">
        <strong>KupasTarif</strong> lahir dari kebutuhan akan transparansi tarif 
        di industri ride hailing. Halaman ini menjelaskan mengapa aplikasi ini dibuat 
        dan apa yang ingin dicapai.
    </p>
    <p class="mb-md">Ketuk tombol di bawah untuk membaca selengkapnya.</p>
    <div class="bg-muted p-md rounded-lg mb-lg">
        <p class="text-sm text-center text-secondary">
            ${ICON.DOCUMENT} Semua data dan kalkulasi bersifat terbuka. 
            Tidak ada yang disembunyikan.
        </p>
    </div>
    <p class="text-muted text-sm text-center">Dibuat dengan transparansi oleh tim KupasTarif</p>
</div>`;

// Konten detail (sebelumnya dari docs/notes.html)
const DETAIL_HTML = `
<style>
  /* ========== Scoped styling khusus halaman Catatan ========== */
  .notes-content {
    font-family: var(--font-family, 'Inter', sans-serif);
    color: var(--text-primary, #0f172a);
    line-height: 1.7;
    padding: var(--space-md, 12px) 0;
  }

  .notes-content h2 {
    font-size: var(--text-xl, 1.0625rem);
    font-weight: var(--font-bold, 700);
    margin-bottom: var(--space-sm, 8px);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: var(--space-xs, 4px);
  }

  .notes-content h3 {
    font-size: var(--text-base, 0.8125rem);
    font-weight: var(--font-semibold, 600);
    margin-top: var(--space-lg, 16px);
    margin-bottom: var(--space-xs, 4px);
    color: var(--text-primary);
  }

  .notes-content p {
    margin-bottom: var(--space-sm, 8px);
    color: var(--text-secondary, #475569);
    font-size: var(--text-sm, 0.75rem);
  }

  .notes-content ul {
    list-style: none;
    padding-left: 0;
    margin: var(--space-sm, 8px) 0 var(--space-md, 12px);
  }

  .notes-content li {
    position: relative;
    padding-left: 24px;
    margin-bottom: var(--space-sm, 8px);
    font-size: var(--text-sm, 0.75rem);
    color: var(--text-secondary);
  }

  .notes-content li::before {
    content: '⚡';
    position: absolute;
    left: 0;
    top: 0;
    font-size: var(--text-sm, 0.75rem);
    color: var(--primary, #0d7c4a);
  }

  .notes-highlight {
    background-color: var(--bg-muted, #f1f5f9);
    border-left: 3px solid var(--primary, #0d7c4a);
    padding: var(--space-sm, 8px) var(--space-md, 12px);
    border-radius: 0 var(--radius-sm, 6px) var(--radius-sm, 6px) 0;
    margin: var(--space-md, 12px) 0;
  }

  .notes-highlight p {
    margin: 0;
    font-weight: var(--font-medium, 500);
    color: var(--text-primary);
    font-size: var(--text-sm, 0.75rem);
  }

  .notes-footer-note {
    margin-top: var(--space-xl, 20px);
    padding-top: var(--space-sm, 8px);
    border-top: 1px solid var(--border, #e2e8f0);
    font-size: var(--text-xs, 0.625rem);
    color: var(--text-muted, #94a3b8);
    font-style: italic;
    text-align: center;
  }
</style>

<div class="notes-content">
  <h2>⚡ Latar Belakang</h2>
  <p>
    Layanan <em>ride hailing</em> di Indonesia telah menjadi tulang punggung transportasi perkotaan. 
    Jutaan orang bergantung pada aplikasi untuk bepergian, sementara jutaan driver menggantungkan 
    penghidupan dari setiap order yang mereka ambil. Namun di balik kemudahan itu, ada satu hal yang 
    sengaja dijaga tetap gelap: <strong>struktur tarif yang sebenarnya</strong>.
  </p>
  
  <p>
    Baik driver maupun penumpang hampir tidak pernah diberi tahu secara transparan berapa potongan 
    aplikasi, berapa biaya operasional riil kendaraan, dan berapa sebenarnya pendapatan bersih 
    driver setelah semua beban diperhitungkan. Informasi ini tersebar, tersembunyi, atau bahkan 
    sengaja tidak ditampilkan.
  </p>

  <div class="notes-highlight">
    <p>
      "Sistem boleh canggih, tapi driver dan penumpang berhak tahu ke mana uang mereka pergi."
    </p>
  </div>

  <h2>🎯 Tujuan KupasTarif</h2>
  <p>
    <strong>KupasTarif</strong> lahir dari kebutuhan mendasar akan transparansi. Aplikasi ini adalah 
    kalkulator tarif <em>open-source</em> yang dirancang untuk:
  </p>
  <ul>
    <li>
      <strong>Membongkar komponen tarif</strong> – dari biaya aplikasi, komisi driver, 
      kesejahteraan (yang sebenarnya dibebankan ke driver), hingga biaya operasional per kilometer 
      dan per menit.
    </li>
    <li>
      <strong>Membantu driver menghitung pendapatan bersih</strong> – sebelum menerima order, 
      driver bisa memperkirakan berapa yang sebenarnya akan mereka bawa pulang setelah BBM, 
      perawatan, penyusutan, pajak, dan atribut.
    </li>
    <li>
      <strong>Memberi penumpang gambaran utuh</strong> – ke mana uang pembayaran mereka 
      dialokasikan, berapa yang diterima driver, dan berapa yang diambil aplikasi.
    </li>
    <li>
      <strong>Mendorong diskusi publik</strong> – tentang keseimbangan ekonomi platform, 
      regulasi tarif, dan kesejahteraan driver yang selama ini sering terabaikan.
    </li>
  </ul>

  <h2>🧮 Fitur Utama</h2>
  <p>
    KupasTarif bukan sekadar kalkulator biasa. Aplikasi ini dibangun dengan pendekatan berbasis 
    data nyata:
  </p>
  <ul>
    <li><strong>Estimasi Order</strong> – simulasi pendapatan dan biaya sebelum perjalanan.</li>
    <li><strong>Tracking GPS & Realitas</strong> – mencatat perjalanan aktual, menghitung selisih, 
      dan menampilkan pendapatan <em>live</em>.</li>
    <li><strong>Laporan Mendalam</strong> – analisis lengkap setelah perjalanan: pembagian 
      keuangan, proyeksi bulanan, perbandingan tarif angkot & Transjakarta.</li>
    <li><strong>Perawatan Kendaraan</strong> – pelacakan biaya perawatan, pajak, dan penyusutan 
      berdasarkan akumulasi jarak tempuh riwayat.</li>
  </ul>

  <h2>📦 Sumber Data & Keterbatasan</h2>
  <p>
    Semua data biaya (BBM, perawatan, pajak, depresiasi) diambil dari referensi harga pasar 
    Indonesia dan studi biaya operasional kendaraan. Tarif aplikasi didasarkan pada pengamatan 
    pola tarif aktual. Namun demikian:
  </p>
  <ul>
    <li>Nilai ini adalah <strong>estimasi terbaik</strong>, bukan angka resmi dari platform 
      manapun.</li>
    <li>Ketidakpastian seperti harga BBM yang berubah, kebijakan aplikasi, dan kondisi kendaraan 
      individu tidak dapat sepenuhnya tercakup.</li>
    <li>Gunakan hasil kalkulasi sebagai <strong>referensi dan alat bantu negosiasi</strong>, 
      bukan sebagai dasar tuntutan hukum.</li>
  </ul>

  <div class="notes-footer-note">
    KupasTarif v6.7a – Dibangun dengan semangat transparansi. Semua data ada di tangan Anda.
  </div>
</div>`;

// =============================================================================
// 2. BUILD HTML
// =============================================================================

function buildHTML(isTldr) {
    if (isTldr) {
        return `<div class="page-container">
            <div class="card">
                <div id="notes-content" class="notes-content">${DETAIL_HTML}</div>
            </div>
        </div>`;
    }
    return `<div class="page-container">
        <div class="card">
            <div id="notes-content" class="notes-content">${OVERVIEW_HTML}</div>
            <div class="notes-footer mt-lg text-center">
                <button id="more-btn" class="btn btn-outline">Lihat Lebih Lanjut</button>
            </div>
        </div>
    </div>`;
}

// =============================================================================
// 3. BIND EVENTS
// =============================================================================

function bindEvents(isTldr) {
    const moreBtn = document.getElementById('more-btn');
    if (moreBtn && !isTldr) {
        moreBtn.addEventListener('click', () => {
            if (isDestroyed) return;
            Router.navigateTo({ target: 'catatantldr' });
        });
    }
}

// =============================================================================
// 4. REGISTRASI DRAWER
// =============================================================================

DrawerManager.register('catatan', () => ({
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
                Router.navigateTo({ target: 'catatan' });
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

    window.log.info('[Note ' + F_V + '] (2) Notes dirender | tldr=' + isTldr);
}

function destroy() {
    isDestroyed = true;
    if (currentHeader) { HeaderManager.destroy(currentHeader); currentHeader = null; }
}

// =============================================================================
// 7. EKSPOR
// =============================================================================

export const PageCatatan = {
    render,
    destroy
};

export const PageCatatantldr = {
    render: (params, context) => render({ ...params, tldr: true }, context),
    destroy
};

window.log.info('[Note ' + F_V + '] (3) PageCatatan & PageCatatantldr dimuat');


// ================================ End Of File ================================