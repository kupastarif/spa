/**
 * =================================================================================
 * FILE         : /js/core/debug.js
 * FILE VERSION : 2.0.1-rev0
 * APP VERSION  : 2.0.1
 * DATE         : 20 Juli 2026
 * @author      : gk
 *
 * CHANGELOG  :
 * 
 * =================================================================================
 */

(function() {
    'use strict';

    // Hanya aktif jika devMode true
    if (!window.isDevMode) return;

    // ========== KONSTANTA ==========
    const MAX_LOG = 500;
    const Z_INDEX = 999999;

    // ========== BUFFER LOG ==========
    if (!window._logBuffer) {
        window._logBuffer = [];
    }

    // Tangkap semua log melalui window.log jika ada, atau console
    function captureLog(level, args) {
        try {
            const msg = args.map(a =>
                typeof a === 'object' ? JSON.stringify(a) : String(a)
            ).join(' ');
            window._logBuffer.push({ level, msg, timestamp: Date.now() });
            if (window._logBuffer.length > MAX_LOG) window._logBuffer.shift();
            if (window._logPanelOpen) updatePanelContent();
        } catch (e) { /* ignore */ }
    }

    // Override window.log (jika ada) atau console
    if (window.log) {
        const orig = window.log;
        ['info', 'warn', 'error'].forEach(level => {
            const fn = orig[level] || function() {};
            orig[level] = function(...args) {
                fn.apply(console, args);
                captureLog(level, args);
            };
        });
    } else {
        // Fallback ke console
        ['log', 'warn', 'error'].forEach(level => {
            const orig = console[level] || function() {};
            console[level] = function(...args) {
                orig.apply(console, args);
                captureLog(level, args);
            };
        });
    }

    // ========== BUILD DOM ==========
    function createDebugUI() {
        // --- Tombol floating ---
        const btn = document.createElement('div');
        btn.id = 'debug-toggle-btn';
        btn.textContent = '🐞';
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '80px',
            right: '16px',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--primary, #0d7c4a)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            cursor: 'pointer',
            zIndex: Z_INDEX,
            transition: 'transform 0.2s'
        });
        btn.addEventListener('click', togglePanel);
        document.body.appendChild(btn);

        // --- Panel log ---
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        Object.assign(panel.style, {
            position: 'fixed',
            bottom: '140px',
            right: '16px',
            width: '340px',
            maxHeight: '420px',
            background: 'var(--bg-card, #1e293b)',
            color: 'var(--text-primary, #e2e8f0)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            padding: '8px',
            display: 'none',
            flexDirection: 'column',
            zIndex: Z_INDEX,
            fontSize: '11px',
            fontFamily: 'monospace',
            border: '1px solid var(--border, #334155)',
            overflow: 'hidden'
        });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '4px',
            borderBottom: '1px solid var(--border, #334155)',
            flexShrink: 0
        });
        const title = document.createElement('span');
        title.textContent = '📋 Log';
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '6px';

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋';
        copyBtn.title = 'Copy all logs';
        Object.assign(copyBtn.style, { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' });
        copyBtn.addEventListener('click', copyLogs);

        const clearBtn = document.createElement('button');
        clearBtn.textContent = '🗑️';
        clearBtn.title = 'Clear logs';
        Object.assign(clearBtn.style, { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' });
        clearBtn.addEventListener('click', clearLogs);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✖';
        closeBtn.title = 'Close panel';
        Object.assign(closeBtn.style, { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' });
        closeBtn.addEventListener('click', closePanel);

        actions.appendChild(copyBtn);
        actions.appendChild(clearBtn);
        actions.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(actions);
        panel.appendChild(header);

        // Content area
        const content = document.createElement('div');
        content.id = 'debug-log-content';
        Object.assign(content.style, {
            flex: 1,
            overflowY: 'auto',
            padding: '4px 0',
            maxHeight: '300px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            fontSize: '10px',
            lineHeight: '1.4'
        });
        panel.appendChild(content);

        // Inject style tambahan (opsional)
        const styleTag = document.createElement('style');
        styleTag.textContent = `
            #debug-log-content::-webkit-scrollbar { width: 4px; }
            #debug-log-content::-webkit-scrollbar-track { background: var(--bg-muted, #2d3748); }
            #debug-log-content::-webkit-scrollbar-thumb { background: var(--primary, #0d7c4a); border-radius: 2px; }
        `;
        document.head.appendChild(styleTag);

        document.body.appendChild(panel);

        // Simpan referensi global
        window._debugBtn = btn;
        window._debugPanel = panel;
        window._debugContent = content;
        window._logPanelOpen = false;
    }

    // ========== PANEL CONTROL ==========
    function togglePanel() {
        const panel = window._debugPanel;
        if (!panel) return;
        const isOpen = panel.style.display !== 'none';
        isOpen ? closePanel() : openPanel();
    }

    function openPanel() {
        const panel = window._debugPanel;
        if (!panel) return;
        panel.style.display = 'flex';
        window._logPanelOpen = true;
        updatePanelContent();
    }

    function closePanel() {
        const panel = window._debugPanel;
        if (!panel) return;
        panel.style.display = 'none';
        window._logPanelOpen = false;
    }

    function updatePanelContent() {
        const content = window._debugContent;
        if (!content) return;
        const logs = window._logBuffer || [];
        let html = logs.map(log => {
            const time = new Date(log.timestamp).toLocaleTimeString();
            const cls = log.level === 'error' ? 'color:#ef4444;' :
                        log.level === 'warn'  ? 'color:#f59e0b;' :
                        'color:#94a3b8;';
            return `<div style="${cls}"><span style="color:#64748b;">${time}</span> [${log.level.toUpperCase()}] ${escapeHtml(log.msg)}</div>`;
        }).join('');
        content.innerHTML = html || '<span style="color:#64748b;">(empty)</span>';
        content.scrollTop = content.scrollHeight;
    }

    function copyLogs() {
        const logs = window._logBuffer || [];
        const text = logs.map(l => `[${l.level.toUpperCase()}] ${l.msg}`).join('\n');
        navigator.clipboard.writeText(text).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        });
    }

    function clearLogs() {
        window._logBuffer = [];
        updatePanelContent();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== INISIALISASI ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createDebugUI);
    } else {
        createDebugUI();
    }
})();

// ================================ End Of File ================================