// ==UserScript==
// @name         LiveChat Duplicate Blocker - JANGAN ASAL SPAM PK
// @namespace    https://www.tampermonkey.net/
// @version      2026.10.20.3
// @description  Popup duplikat, blokir Enter dan tombol kirim pada pesan duplikat.
// @match        https://my.livechatinc.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';
    // GANTI skrip lama, jangan jalankan keduanya bersamaan.
    // Hanya pesan agen setelah penanda Started - Today TERAKHIR yang dihitung.
    // Selector di bawah berasal dari skrip pengguna; sesuaikan bila UI berubah.
    const EDITOR = '[contenteditable="true"], [contenteditable="plaintext-only"], textarea';
    const LIST = '[data-testid="messages-list"]';
    const SEND = '[data-testid="send-button"], [data-testid="send-message-button"], [data-testid="send-message"], button[type="submit"], input[type="submit"]';
    const ROOT = 'lc-duplicate-warning';
    let badge, popup, currentEditor, currentList, lastDuplicate = '', dismissed = '';
    let queued = false;
    const visible = el => !!el && (el.getClientRects().length > 0 || [...el.children].some(child => child.getClientRects().length > 0));
    const normalize = text => (text || '').normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[\s\u00a0.,!?;:\-]/g, '').toLowerCase();
    const read = el => el instanceof HTMLTextAreaElement ? el.value : (el.innerText || el.textContent || '');
    const editors = () => [...document.querySelectorAll(EDITOR)]
        .filter(el => visible(el) && !el.closest('#' + ROOT) && !el.closest(LIST))
        .filter((el, index, all) => !all.some(other => other !== el && other.contains(el)));

    function context(editor) {
        // Gunakan panel terdekat yang mempunyai tepat satu daftar pesan.
        for (let parent = editor.parentElement; parent; parent = parent.parentElement) {
            const lists = [...parent.querySelectorAll(LIST)].filter(visible);
            if (lists.length === 1) return { editor, list: lists[0], panel: parent };
            if (lists.length > 1) return null;
        }
        return null;
    }
    function activeContext(target) {
        const all = editors();
        const chosen = all.find(el => el === target || el.contains(target)) ||
            all.find(el => el === document.activeElement || el.contains(document.activeElement)) ||
            all.find(el => el === currentEditor && el.isConnected) ||
            all.find(el => el.matches('[contenteditable]') && context(el)) ||
            all.find(el => context(el));
        return chosen ? context(chosen) : null;
    }
    function bubbles(list) {
        return [...list.querySelectorAll('[data-testid="agent-message"]')]
            // Pertahankan fallback CSS dari skrip asli pengguna.
            .map(block => block.querySelector('[data-testid="message-text"]') ||
                block.querySelector('.message__text') ||
                block.querySelector('div[class^="css-"]'))
            .filter(Boolean);
    }
    function latestStart(list) {
        // Jangan mengira isi pesan pelanggan/agen sebagai penanda sistem.
        const messageSelector = '[data-testid="agent-message"], [data-testid="customer-message"], [data-testid="visitor-message"], [data-testid="message-text"], .message__text';
        let latest = null;
        for (const el of list.querySelectorAll('*')) {
            if (el.closest(messageSelector) || el.querySelector(messageSelector)) continue;
            const text = (el.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
            // Mendukung label terpisah dalam beberapa span dan waktu di belakang Today.
            if (!/^(?:started\s*[-–—·•:]?\s*today|dimulai\s*[-–—·•:]?\s*hari ini)(?:$|[\s,·•:–—-])/i.test(text) || text.length > 160) continue;
            if (!latest || latest.contains(el) ||
                (latest.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) latest = el;
        }
        return latest;
    }
    function inspect(ctx) {
        if (!ctx) return { duplicate: false, key: '', count: 0, marker: null };
        const marker = latestStart(ctx.list);
        const all = bubbles(ctx.list);
        // Tidak ada fallback ke pesan lama / lima pesan terakhir.
        // Bila penanda belum termuat, riwayat tidak dihitung.
        const messages = marker ? all.filter(message => !marker.contains(message) &&
            !!(marker.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING)) : [];
        const counts = new Map();
        for (const message of messages) {
            const key = normalize(read(message));
            if (key) counts.set(key, (counts.get(key) || 0) + 1);
        }
        const active = new Set(messages);
        for (const message of all) {
            message.classList.toggle('lc-duplicate-sent', active.has(message) &&
                (counts.get(normalize(read(message))) || 0) > 1);
        }
        const key = normalize(read(ctx.editor));
        return { duplicate: !!key && counts.has(key), key, marker, count: messages.length };
    }
    function initUI() {
        if (!document.body || popup) return;
        const style = document.createElement('style');
        style.textContent = `
          .lc-duplicate-draft { outline:3px solid #ff2929!important; outline-offset:2px; background:rgba(255,0,0,.07)!important; }
          .lc-duplicate-sent { border-left:6px solid #f22!important; background:rgba(220,0,0,.18)!important; }
          #${ROOT} { position:fixed; transform:translate(-50%,-50%); width:390px; max-width:calc(100vw - 32px); box-sizing:border-box; z-index:2147483647; padding:24px; border:3px solid #ff3030; border-radius:16px; background:#240606; color:white; font:14px/1.6 Arial,sans-serif; box-shadow:0 18px 60px #0009; text-align:center; }
          #${ROOT}[hidden] { display:none!important; }
          #${ROOT} strong { display:block; color:#ff6565; font-size:21px; line-height:1.3; margin-bottom:12px; }
          #${ROOT} button { margin-top:16px; border:0; border-radius:8px; padding:10px 20px; background:#d51919; color:white; font-weight:bold; cursor:pointer; }
        `;
        document.head.appendChild(style);
        popup = document.createElement('div');
        popup.id = ROOT;
        popup.hidden = true;
        popup.setAttribute('role', 'alertdialog');
        popup.setAttribute('aria-modal', 'false');
        popup.setAttribute('aria-labelledby', ROOT + '-title');
        popup.setAttribute('aria-describedby', ROOT + '-text');
        popup.innerHTML = `<strong id="${ROOT}-title">⛔ JANGAN ASAL SPAM PK!</strong><div id="${ROOT}-text">Pesan ini sama dengan pesan agen setelah Started - Today pada percakapan baru ini.<br><b>ENTER DAN KIRIM DIBLOKIR.</b><br>Edit atau hapus pesan duplikat terlebih dahulu.</div><button type="button">Mengerti, edit pesan</button>`;
        popup.querySelector('button').addEventListener('click', () => {
            dismissed = lastDuplicate;
            popup.hidden = true;
            if (currentEditor?.isConnected) currentEditor.focus();
        });
        document.body.appendChild(popup);
        badge = document.createElement('div');
        badge.id = 'lc-duplicate-status';
        badge.style.cssText = 'position:fixed;bottom:10px;right:14px;z-index:2147483646;background:#18212b;color:white;padding:7px 12px;border-radius:8px;font:12px Arial;pointer-events:none;max-width:360px';
        document.body.appendChild(badge);
    }
    function show(ctx) {
        initUI();
        if (!popup) return;
        const rect = ctx.list.getBoundingClientRect();
        const x = Math.max(0, rect.left) + (Math.min(innerWidth, rect.right) - Math.max(0, rect.left)) / 2;
        const y = Math.max(0, rect.top) + (Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top)) / 2;
        const half = Math.min(390, innerWidth - 32) / 2;
        popup.style.left = Math.max(half + 16, Math.min(innerWidth - half - 16, x)) + 'px';
        popup.style.top = Math.max(150, Math.min(innerHeight - 150, y)) + 'px';
        popup.hidden = false;
    }
    function refresh(target, force = false) {
        const ctx = activeContext(target);
        if (currentEditor !== ctx?.editor || currentList !== ctx?.list) {
            currentEditor?.classList.remove('lc-duplicate-draft');
            currentEditor = ctx?.editor;
            currentList = ctx?.list;
            lastDuplicate = dismissed = '';
            if (popup) popup.hidden = true;
        }
        const status = inspect(ctx);
        if (badge) {
            const count = status.count;
            const label = !ctx ? 'ANTI DUPLIKAT: kolom chat belum terbaca' :
                !status.marker ? 'ANTI DUPLIKAT: Started - Today belum terbaca; riwayat diabaikan' :
                !count ? 'ANTI DUPLIKAT: percakapan baru, belum ada pesan agen' :
                status.duplicate ? '⛔ DUPLIKAT — ENTER / KIRIM DIBLOKIR' :
                '✓ ANTI DUPLIKAT AKTIF · ' + count + ' pesan percakapan baru';
            if (badge.textContent !== label) badge.textContent = label;
        }
        ctx?.editor.classList.toggle('lc-duplicate-draft', status.duplicate);
        if (status.duplicate) {
            lastDuplicate = status.key;
            if (force || dismissed !== status.key) show(ctx);
        } else {
            lastDuplicate = dismissed = '';
            if (popup) popup.hidden = true;
        }
        return status.duplicate;
    }
    function cancel(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
    }
    function sendButton(target) {
        const button = target instanceof Element ? target.closest('button, [role="button"], input[type="submit"]') : null;
        if (!button || button.closest('#' + ROOT)) return null;
        const labels = [button.getAttribute('aria-label'), button.getAttribute('title'), button.getAttribute('data-testid'), button.textContent].filter(Boolean);
        const isSend = labels.some(label => /^(send|kirim)(?:[\s_-]*(?:message|pesan|button))?(?:[\s(]|$)/i.test(label.trim()));
        return button.matches(SEND) || isSend ? button : null;
    }
    // Capture di window, sebelum handler aplikasi pada elemen/document.
    for (const type of ['keydown', 'keypress', 'keyup']) {
        window.addEventListener(type, event => {
            if (event.key !== 'Enter' && !(event.key === ' ' && sendButton(event.target))) return;
            const ctx = activeContext(event.target);
            if (!ctx) return;
            const inEditor = ctx.editor === event.target || ctx.editor.contains(event.target);
            const button = sendButton(event.target);
            if ((inEditor || (button && ctx.panel.contains(button))) && refresh(ctx.editor, true)) cancel(event);
        }, true);
    }
    window.addEventListener('beforeinput', event => {
        if (['insertParagraph', 'insertLineBreak'].includes(event.inputType) && refresh(event.target, true)) cancel(event);
    }, true);
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'dblclick']) {
        window.addEventListener(type, event => {
            const button = sendButton(event.target);
            if (!button) return;
            const ctx = activeContext();
            if (ctx?.panel.contains(button) && refresh(ctx.editor, true)) cancel(event);
        }, { capture: true, passive: false });
    }
    window.addEventListener('submit', event => {
        const ctx = activeContext();
        if (ctx && (event.target.contains(ctx.editor) || (event.submitter && ctx.panel.contains(event.submitter))) && refresh(ctx.editor, true)) cancel(event);
    }, true);
    window.addEventListener('input', event => refresh(event.target), true);
    window.addEventListener('focusin', event => {
        if (!event.target.closest?.('#' + ROOT)) refresh(event.target);
    }, true);
    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; refresh(); });
    }
    function boot() {
        initUI();
        // Tidak mengamati class/style agar perubahan highlight tidak memicu loop.
        new MutationObserver(records => {
            if (records.some(record => !popup.contains(record.target) && !badge.contains(record.target))) schedule();
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
        refresh();
        setInterval(() => { if (!document.hidden) refresh(); }, 700);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
})();
