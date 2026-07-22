/**
 * =================================================================================
 * FILE         : /js/pages/articles.js
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
import { HeaderManager } from '../components/header.js';
import { FooterManager } from '../components/footer.js';
import { DrawerManager } from '../components/drawer.js';
import { escapeHtml } from '../helpers/format.js';

// =============================================================================
// 0. IKON LOKAL (tidak lagi bergantung pada getIcon dari texts.js)
// =============================================================================

const ICON = {
    ARTICLES: '📚',
    DOCUMENT: '📄',
    EMPTY_HISTORY: '📭',
    BACK: '◀',
    HOME: '🏠',
    MENU: '☰'
};

// =============================================================================
// 1. STATE INTERNAL
// =============================================================================

let isDestroyed = false;
let articles = [];
let currentHeader = null;

// =============================================================================
// 2. LOAD DATA
// =============================================================================

async function loadArticleList() {
    try {
        const base = window.APP_FULL_BASE || '';
        const url = window.cacheBust ? window.cacheBust(base + 'articles/list.json') : (base + 'articles/list.json');
        const response = await fetch(url);
        if (!response.ok) throw new Error('Gagal memuat daftar artikel');
        articles = await response.json();
        window.log.info('[Articles ' + F_V + '] (1) Daftar artikel dimuat: ' + articles.length + ' artikel');
        return articles;
    } catch (error) {
        window.log.error('[Articles ' + F_V + '] (2) Gagal load list:', error);
        articles = [];
        return [];
    }
}

async function loadArticleDetail(id) {
    try {
        const base = window.APP_FULL_BASE || '';
        const url = window.cacheBust ? window.cacheBust(base + 'articles/' + id + '.html') : (base + 'articles/' + id + '.html');
        const response = await fetch(url);
        if (!response.ok) throw new Error('Gagal memuat artikel');
        return await response.text();
    } catch (error) {
        window.log.error('[Articles ' + F_V + '] (3) Gagal load detail:', error);
        return null;
    }
}

function isValidArticleId(id) {
    if (!id || typeof id !== 'string') return false;
    return /^[a-zA-Z0-9_-]{1,32}$/.test(id);
}

function findArticleById(id) {
    return articles.find(a => a.id === id);
}

// =============================================================================
// 3. RENDER
// =============================================================================

function renderList() {
    if (articles.length === 0) {
        return `<div class="page-container"><div class="page-title">${ICON.ARTICLES} ARTIKEL</div><div class="card text-center p-lg"><p class="text-muted">Belum ada artikel.</p></div></div>`;
    }

    let articlesHTML = '';
    articles.forEach(article => {
        articlesHTML += `<div class="card article-item" data-id="${escapeHtml(article.id)}">
            <div class="flex items-start gap-md">
                <span class="article-icon">${ICON.DOCUMENT}</span>
                <div class="flex-1">
                    <div class="flex items-center gap-sm mb-xs"><span class="badge badge-info">${escapeHtml(article.category || 'ARTIKEL')}</span></div>
                    <h3 class="text-lg font-semibold mb-xs">${escapeHtml(article.title)}</h3>
                    <p class="text-secondary text-sm">${escapeHtml(article.summary || '')}</p>
                </div>
            </div>
        </div>`;
    });

    return `<div class="page-container"><div class="page-title">${ICON.ARTICLES} ARTIKEL</div><div class="articles-list">${articlesHTML}</div></div>`;
}

function renderArticleNotFound() {
    return `<div class="page-container text-center p-lg">
        <div class="card">
            <div style="font-size: 3rem; margin-bottom: 1rem;">${ICON.EMPTY_HISTORY}</div>
            <h2 class="text-xl font-bold mb-sm">Artikel Tidak Ditemukan</h2>
            <p class="text-secondary mb-lg">Artikel yang Anda cari tidak tersedia atau telah dihapus.</p>
            <div class="flex justify-center gap-md">
                <button class="btn btn-outline" id="back-to-articles-btn">${ICON.BACK} KEMBALI</button>
                <button class="btn btn-primary" id="back-home-btn">${ICON.HOME} HOME</button>
            </div>
        </div>
    </div>`;
}

// =============================================================================
// 4. NAVIGASI INTERNAL
// =============================================================================

function goToDetail(articleId) {
    if (isDestroyed) return;
    Router.navigateTo({ target: 'articledetail', articleid: articleId });
}

function goBackToArticles() {
    if (isDestroyed) return;
    Router.navigateTo({ target: 'article' });
}

// =============================================================================
// 5. BIND EVENTS
// =============================================================================

function bindEvents(isDetail) {
    if (!isDetail) {
        document.querySelectorAll('.article-item').forEach(item => {
            item.addEventListener('click', () => goToDetail(item.dataset.id));
        });
    }
}

function bindNotFoundEvents() {
    document.getElementById('back-to-articles-btn')?.addEventListener('click', () => {
        goBackToArticles();
    });
    document.getElementById('back-home-btn')?.addEventListener('click', () => {
        Router.navigateTo({ target: 'home' });
    });
}

// =============================================================================
// 6. REGISTRASI DRAWER
// =============================================================================

DrawerManager.register('article', () => ({
    menuItems: null,
    onItemClick: (page) => {
        Router.navigateTo({ target: page, closeDrawer: true });
    }
}));

// =============================================================================
// 7. HEADER & FOOTER
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

function updateFooter(isDetail) {
    const container = document.getElementById('app-footer');
    if (!container || !FooterManager) return;
    
    if (isDetail) {
        const footer = FooterManager.create('layoutA', {
            frame1: { type: 'icon', content: FooterManager.createIconButton(ICON.BACK, () => {
                Router.navigateTo({ target: 'article' });
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
// 8. RENDER & DESTROY
// =============================================================================

async function render(params, context = {}) {
    const content = document.getElementById('app-content');
    if (!content) return;
    isDestroyed = false;

    const articleId = params?.articleid;

    if (articleId) {
        if (!isValidArticleId(articleId)) {
            window.log.warn('[Articles ' + F_V + '] (4) ArticleId tidak valid: ' + articleId);
            content.innerHTML = renderArticleNotFound();
            updateHeader();
            updateFooter(true);
            bindNotFoundEvents();
            return;
        }

        if (articles.length === 0) {
            await loadArticleList();
        }

        const article = findArticleById(articleId);
        if (!article) {
            window.log.warn('[Articles ' + F_V + '] (5) Artikel tidak ditemukan dalam daftar: ' + articleId);
            content.innerHTML = renderArticleNotFound();
            updateHeader();
            updateFooter(true);
            bindNotFoundEvents();
            return;
        }

        content.innerHTML = `<div class="page-container">
            <div class="card"><div class="article-content" id="article-detail-content"><div class="text-center p-lg"><div class="spinner"></div><p class="text-muted mt-md">Memuat artikel...</p></div></div></div>
        </div>`;
        bindEvents(true);
        updateHeader();
        updateFooter(true);

        const detail = await loadArticleDetail(articleId);
        if (!isDestroyed) {
            const el = document.getElementById('article-detail-content');
            if (el) {
                if (detail) {
                    el.innerHTML = detail;
                } else {
                    el.innerHTML = renderArticleNotFound();
                    bindNotFoundEvents();
                }
            }
        }
    } else {
        // selalu muat ulang daftar artikel tanpa memandang arah
        articles = await loadArticleList();

        content.innerHTML = renderList();
        bindEvents(false);
        updateHeader();
        updateFooter(false);
    }

    window.log.info('[Articles ' + F_V + '] (6) Articles dirender | mode=' + (articleId ? 'detail' : 'list'));
}

function destroy() {
    isDestroyed = true;
    articles = [];
    if (currentHeader) { HeaderManager.destroy(currentHeader); currentHeader = null; }
}

// =============================================================================
// 9. EKSPOR
// =============================================================================

export const PageArticle = {
    render,
    destroy
};

export const PageArticledetail = {
    render: (params, context) => render({ articleid: params?.articleid, ...params }, context),
    destroy
};

window.log.info('[Articles ' + F_V + '] (7) PageArticle & PageArticledetail dimuat');


// ================================ End Of File ================================