/**
 * =================================================================================
 * FILE         : /js/components/footer.js
 * FILE VERSION : 2.0.1-rev2
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
const F_V = '2.0.1-rev2';

// =============================================================================
// 0. IKON LOKAL (hanya untuk penggunaan internal footer)
// =============================================================================

const ICON = {
    SLIDE_THUMB: '▶'       // Karakter panah kanan untuk thumb slider
};

// =============================================================================
// 1. FACTORY FRAME & KOMPONEN
// =============================================================================

function createFrame(type) {
    const frame = document.createElement('div');
    frame.className = 'footer-frame';
    if (type === 'icon') frame.classList.add('footer-frame-icon');
    else if (type === 'flex') frame.classList.add('footer-frame-flex');
    return frame;
}

/**
 * Membuat tombol ikon footer.
 * @param {string} iconChar - Karakter ikon langsung (misal '☰')
 * @param {Function} onClick
 * @param {string} ariaLabel
 * @returns {HTMLButtonElement}
 */
function createIconButton(iconChar, onClick, ariaLabel) {
    const btn = document.createElement('button');
    btn.className = 'footer-icon';
    btn.textContent = iconChar;
    btn.setAttribute('aria-label', ariaLabel || 'ikon');
    if (onClick) btn.addEventListener('click', onClick);
    else btn.disabled = true;
    return btn;
}

/**
 * Membuat konten teks dengan ikon opsional.
 * @param {string} text - Teks tombol
 * @param {string} iconChar - Karakter ikon langsung (string kosong jika tidak ada)
 * @param {Function} onClick
 * @returns {HTMLDivElement}
 */
function createFlexContent(text, iconChar, onClick) {
    const container = document.createElement('div');
    container.className = 'footer-flex-content';
    if (!onClick) container.classList.add('disabled');
    if (iconChar) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'footer-flex-icon';
        iconSpan.textContent = iconChar;
        container.appendChild(iconSpan);
    }
    if (text) {
        const textSpan = document.createElement('span');
        textSpan.className = 'footer-flex-text';
        textSpan.textContent = text;
        container.appendChild(textSpan);
    }
    if (onClick) container.addEventListener('click', onClick);
    return container;
}

/**
 * Membuat elemen slider (slide-to-action).
 * @param {string} label - Teks yang tampil di track (contoh: 'MULAI')
 * @param {string} iconChar - Karakter ikon langsung (string kosong jika tidak ada)
 * @param {Function} onActivate - Callback saat slide berhasil
 * @param {string} variant - 'primary' | 'warning' | 'danger' (default 'primary')
 * @returns {HTMLElement}
 */
function createSlideContent(label, iconChar, onActivate, variant = 'primary') {
    const container = document.createElement('div');
    container.className = 'slide-action';
    container.setAttribute('role', 'button');
    container.setAttribute('aria-label', `Geser untuk ${label}`);

    const track = document.createElement('div');
    track.className = 'slide-track';

    if (iconChar) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'slide-track-icon';
        iconSpan.textContent = iconChar;
        track.appendChild(iconSpan);
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'slide-track-label';
    labelSpan.textContent = `SLIDE UNTUK ${label}`;
    track.appendChild(labelSpan);

    const thumb = document.createElement('div');
    thumb.className = `slide-thumb slide-thumb--${variant}`;
    thumb.textContent = ICON.SLIDE_THUMB;
    thumb.setAttribute('aria-hidden', 'true');

    container.appendChild(track);
    container.appendChild(thumb);

    let startX = 0;
    let startLeft = 0;
    let isDragging = false;
    let activated = false;
    const minLeft = 3;
    let maxLeft = 0;

    function computeMaxLeft() {
        const containerWidth = container.getBoundingClientRect().width;
        const thumbWidth = thumb.offsetWidth;
        maxLeft = containerWidth - thumbWidth - minLeft;
    }

    function clamp(value) {
        return Math.max(minLeft, Math.min(maxLeft, value));
    }

    function removeListeners() {
        thumb.removeEventListener('pointermove', onPointerMove);
        thumb.removeEventListener('pointerup', onPointerUp);
    }

    function onPointerDown(e) {
        if (activated) return;
        computeMaxLeft();
        startX = e.clientX;
        startLeft = thumb.offsetLeft;
        isDragging = true;
        thumb.classList.add('slide-thumb--dragging');
        thumb.setPointerCapture(e.pointerId);
        thumb.style.transition = 'none';
        removeListeners();
        thumb.addEventListener('pointermove', onPointerMove);
        thumb.addEventListener('pointerup', onPointerUp);
        e.preventDefault();
    }

    function onPointerMove(e) {
        if (!isDragging || activated) return;
        const dx = e.clientX - startX;
        let newLeft = startLeft + dx;
        newLeft = clamp(newLeft);
        thumb.style.left = newLeft + 'px';
    }

    function onPointerUp(e) {
        if (!isDragging || activated) return;
        isDragging = false;
        thumb.classList.remove('slide-thumb--dragging');
        thumb.releasePointerCapture(e.pointerId);
        removeListeners();

        const currentLeft = thumb.offsetLeft;
        const threshold = maxLeft * 0.85;

        if (currentLeft >= threshold && !activated) {
            activated = true;
            container.classList.add('slide-action--disabled');
            thumb.style.transition = 'left 0.2s ease';
            thumb.style.left = maxLeft + 'px';

            const computedLeft = parseFloat(getComputedStyle(thumb).left);
            const alreadyAtMax = Math.abs(computedLeft - maxLeft) <= 1;

            const invokeCallback = () => {
                if (typeof onActivate === 'function') {
                    try {
                        onActivate();
                    } catch (err) {
                        window.log.error('[Footer ' + F_V + '] onActivate error: ' + err.message);
                    }
                }
            };

            if (alreadyAtMax) {
                invokeCallback();
            } else {
                thumb.addEventListener('transitionend', function onEnd(e) {
                    if (e.propertyName === 'left') {
                        thumb.removeEventListener('transitionend', onEnd);
                        invokeCallback();
                    }
                });
            }
        } else if (!activated) {
            thumb.style.transition = 'left 0.3s ease';
            thumb.style.left = minLeft + 'px';
        }
    }

    thumb.addEventListener('pointerdown', onPointerDown);
    thumb.addEventListener('pointercancel', onPointerUp);

    return container;
}

// =============================================================================
// 2. LAYOUT FOOTER
// =============================================================================

function createLayoutA(frame1, frame2) {
    if (!frame1 || !frame2) {
        window.log.warn('[Footer ' + F_V + '] (1) createLayoutA: frame1 atau frame2 tidak tersedia');
        return null;
    }
    const footer = document.createElement('div');
    footer.className = 'footer footer-layout-a';
    const f1 = createFrame(frame1.type);
    if (frame1.content) f1.appendChild(frame1.content);
    footer.appendChild(f1);
    const f2 = createFrame(frame2.type);
    if (frame2.content) f2.appendChild(frame2.content);
    footer.appendChild(f2);
    return footer;
}

function createLayoutB(frame1, frame2, frame3) {
    if (!frame1 || !frame2 || !frame3) {
        window.log.warn('[Footer ' + F_V + '] (2) createLayoutB: frame1, frame2, atau frame3 tidak tersedia');
        return null;
    }
    const footer = document.createElement('div');
    footer.className = 'footer footer-layout-b';
    const f1 = createFrame(frame1.type);
    if (frame1.content) f1.appendChild(frame1.content);
    footer.appendChild(f1);
    const f2 = createFrame(frame2.type);
    if (frame2.content) f2.appendChild(frame2.content);
    footer.appendChild(f2);
    const f3 = createFrame(frame3.type);
    if (frame3.content) f3.appendChild(frame3.content);
    footer.appendChild(f3);
    return footer;
}

function createLayoutC(frame1, frame2, frame3) {
    if (!frame1 || !frame2 || !frame3) {
        window.log.warn('[Footer ' + F_V + '] (3) createLayoutC: frame1, frame2, atau frame3 tidak tersedia');
        return null;
    }
    const footer = document.createElement('div');
    footer.className = 'footer footer-layout-c';
    const f1 = createFrame(frame1.type);
    if (frame1.content) f1.appendChild(frame1.content);
    footer.appendChild(f1);
    const f2 = createFrame(frame2.type);
    if (frame2.content) f2.appendChild(frame2.content);
    footer.appendChild(f2);
    const f3 = createFrame(frame3.type);
    if (frame3.content) f3.appendChild(frame3.content);
    footer.appendChild(f3);
    return footer;
}

function create(layout, frames = {}) {
    switch (layout) {
        case 'layoutA': return createLayoutA(frames.frame1, frames.frame2);
        case 'layoutB': return createLayoutB(frames.frame1, frames.frame2, frames.frame3);
        case 'layoutC': return createLayoutC(frames.frame1, frames.frame2, frames.frame3);
        case 'hide': return null;
        default:
            window.log.warn('[Footer ' + F_V + '] (4) Layout tidak dikenal: "' + layout + '", footer tidak dibuat');
            return null;
    }
}

export const FooterManager = { create, createIconButton, createFlexContent, createSlideContent };

window.log.info('[Footer ' + F_V + '] (5) FooterManager dimuat');

// ================================ End Of File ================================