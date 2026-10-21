// ==UserScript==
// @name         AGWL2 Auto Reset Password Member
// @namespace    tampermonkey-agwl2-reset-password-member
// @version      1.7.0
// @description  Panel reset password merah hitam; geser judul dengan mouse atau sentuhan, posisi tidak kembali otomatis. Fungsi reset dan salin tetap tersedia.
// @match        *://agwl2.admitoto.com/*
// @match        *://agwl2.suksesbogil.com/*
// @match        *://agwl2.idnpaito.com/*
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'agwl2_reset_password_last_message_v3';
  const LAST_PASSWORD_KEY = 'agwl2_reset_password_last_generated_v1';
  const BOOT_INTERVAL_MS = 300;
  const BOOT_MAX_TRIES = 120;
  const PANEL_WIDTH = 350;
  const GAP = 12;
  // Posisi fallback panel saat profil dibuka lewat popup.
  // Dibuat lebih dekat ke sisi kiri popup Edit Player List.
  const OPENER_PANEL_LEFT = 320;
  const OPENER_PANEL_TOP = 24;
  const POPUP_SIDE_GAP = 8;
  const PANEL_WIN_WIDTH = 392;
  const PANEL_WIN_HEIGHT = 800;
  const PANEL_WIN_NAME_PREFIX = 'agwl2_reset_password_panel_';

  let panelCreated = false;
  let panelRef = null;
  let panelDocRef = null;
  let panelHostType = 'self'; // self | opener | mini
  let panelWindowRef = null;
  let panelWindowCloseWatch = null;
  let mainIsUnloading = false;

  const CHARS = {
    upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    lower: 'abcdefghijkmnopqrstuvwxyz',
    digit: '23456789'
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function norm(text) {
    return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function rawBodyText() {
    return document.body ? String(document.body.innerText || '') : '';
  }

  function bodyText() {
    return norm(rawBodyText());
  }

  function safeWindowNamePart() {
    return String(getUserId() || location.pathname || 'member')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40) || 'member';
  }

  function getPanelWindowPosition() {
    let left = 20;
    let top = 80;

    try {
      left = Math.round(window.screenX - PANEL_WIN_WIDTH - POPUP_SIDE_GAP);
      top = Math.round(window.screenY + 2);
    } catch (e) {}

    left = Math.max(0, left);
    top = Math.max(0, top);
    return { left, top };
  }

  function writePanelWindowShell(win) {
    try {
      const d = win.document;
      if (!d || !d.documentElement) return null;

      const title = 'Reset Password Panel';
      if (!d.body || d.body.dataset.agwl2Shell !== '1') {
        d.open();
        d.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  html, body { margin:0; padding:0; width:100%; min-height:100%; background:#0c090a; overflow:hidden; }
</style>
</head>
<body data-agwl2-shell="1"></body>
</html>`);
        d.close();
      }
      d.title = title;
      return d;
    } catch (e) {
      return null;
    }
  }

  function openDetachedPanelWindow() {
    // Mode maksimal: panel dibuat sebagai mini-window sendiri, bukan ditempel di halaman belakang.
    // Tujuannya agar saat panel diklik, halaman induk tidak naik ke depan dan popup Edit Player List tidak terlihat hilang.
    try {
      if (!window.opener || window.opener.closed) return null;
    } catch (e) {
      return null;
    }

    try {
      if (panelWindowRef && !panelWindowRef.closed) {
        const doc = writePanelWindowShell(panelWindowRef);
        if (doc) return doc;
      }
    } catch (e) {}

    try {
      const pos = getPanelWindowPosition();
      const name = PANEL_WIN_NAME_PREFIX + safeWindowNamePart();
      const features = [
        'popup=yes',
        `width=${PANEL_WIN_WIDTH}`,
        `height=${PANEL_WIN_HEIGHT}`,
        `left=${pos.left}`,
        `top=${pos.top}`,
        'resizable=yes',
        'scrollbars=no',
        'menubar=no',
        'toolbar=no',
        'location=no',
        'status=no'
      ].join(',');

      const win = window.open('about:blank', name, features);
      if (!win || win.closed) return null;

      panelWindowRef = win;
      try { win.resizeTo(PANEL_WIN_WIDTH, PANEL_WIN_HEIGHT); } catch (e) {}
      try { win.moveTo(pos.left, pos.top); } catch (e) {}

      return writePanelWindowShell(win);
    } catch (e) {
      return null;
    }
  }

  function closeThisProfileWindow() {
    try { window.close(); } catch (e) {}
    setTimeout(() => {
      try {
        if (!window.closed) window.location.replace('about:blank');
      } catch (e) {}
    }, 250);
  }

  function getPanelHostDoc() {
    // Prioritas 1: mini-window panel terpisah. Ini yang paling mendekati satu kesatuan
    // tetapi tetap seperti awal: panel berada di samping popup, bukan masuk ke dalam tabel.
    const miniDoc = openDetachedPanelWindow();
    if (miniDoc && miniDoc.body) {
      panelHostType = 'mini';
      return miniDoc;
    }

    // Fallback: kalau browser memblokir mini-window, gunakan mode awal di halaman induk.
    try {
      if (window.opener && !window.opener.closed && window.opener.document && window.opener.document.body) {
        panelHostType = 'opener';
        return window.opener.document;
      }
    } catch (e) {}

    panelHostType = 'self';
    return document;
  }

  function isPanelInOpener() {
    return panelDocRef && panelDocRef !== document;
  }

  function isProfileMemberPage() {
    const text = bodyText();
    const pathOk = /editplayerlist\.php/i.test(location.pathname);
    const contentOk =
      text.includes('edit player list') &&
      text.includes('reset password') &&
      text.includes('userid');

    return pathOk || contentOk;
  }

  function getRows(root = document) {
    return Array.from(root.querySelectorAll('tr'));
  }

  function findRowByFirstCell(labelText) {
    const label = norm(labelText);
    for (const tr of getRows()) {
      const cells = Array.from(tr.cells || []);
      if (!cells.length) continue;
      if (norm(cells[0].innerText || cells[0].textContent).includes(label)) {
        return tr;
      }
    }
    return null;
  }

  function findProfileTable() {
    const tables = Array.from(document.querySelectorAll('table'));
    let best = null;
    let bestScore = -1;

    for (const table of tables) {
      const text = norm(table.innerText || table.textContent);
      let score = 0;
      if (text.includes('edit player list')) score += 10;
      if (text.includes('userid')) score += 5;
      if (text.includes('nama lengkap')) score += 3;
      if (text.includes('nama bank')) score += 3;
      if (text.includes('reset password')) score += 8;
      if (text.includes('new password')) score += 5;
      if (text.includes('confirm new password')) score += 5;

      const rect = table.getBoundingClientRect();
      if (rect.width > 250) score += 1;
      if (score > bestScore) {
        best = table;
        bestScore = score;
      }
    }

    return bestScore >= 8 ? best : null;
  }

  function addLeftRoomForPanelIfNeeded() {
    if (!isProfileMemberPage()) return;

    const profileTable = findProfileTable();
    if (!profileTable) return;

    const rect = profileTable.getBoundingClientRect();
    const neededLeft = PANEL_WIDTH + GAP + 8;

    // Kalau area kiri tabel terlalu sempit, beri ruang kiri agar panel tidak menabrak tabel profil.
    if (rect.left < neededLeft) {
      const minWidth = Math.ceil(PANEL_WIDTH + GAP + rect.width + 50);
      document.documentElement.style.minWidth = `${minWidth}px`;
      document.body.style.minWidth = `${minWidth}px`;
      document.body.style.paddingLeft = `${PANEL_WIDTH + GAP}px`;
      document.body.style.boxSizing = 'border-box';
    }
  }

  function getUserId() {
    const row = findRowByFirstCell('UserId');
    if (row) {
      const cells = Array.from(row.cells || []);
      const target = cells[1] || row;
      const input = target.querySelector('input, textarea, select');
      const value = input ? input.value : target.innerText;
      const clean = String(value || '').replace(/\s+/g, ' ').trim();
      if (clean) return clean;
    }

    const rawText = rawBodyText();
    const statusMatch = rawText.match(/Status\s+([a-zA-Z0-9_\-.]+)/i);
    if (statusMatch) return statusMatch[1].trim();

    const pokerMatch = rawText.match(/Poker Username:\s*([a-zA-Z0-9_\-.]+)/i);
    if (pokerMatch) return pokerMatch[1].trim();

    return '';
  }

  function getInputByLabel(labelText) {
    const row = findRowByFirstCell(labelText);
    if (!row) return null;
    const cells = Array.from(row.cells || []);
    const target = cells[1] || row;
    return target.querySelector('input[type="password"], input[type="text"], input:not([type]), textarea');
  }

  function findResetButton() {
    const controls = Array.from(document.querySelectorAll('input, button'));
    return controls.find(el => norm(el.value || el.innerText || el.textContent).includes('reset password')) || null;
  }

  function hasResetForm() {
    return !!(getInputByLabel('New Password') && getInputByLabel('Confirm New Password') && findResetButton());
  }

  function setValue(el, value) {
    if (!el) return;
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  }

  function randomPassword(length, options) {
    let pool = '';
    const guaranteed = [];

    if (options.upper) {
      pool += CHARS.upper;
      guaranteed.push(CHARS.upper[Math.floor(Math.random() * CHARS.upper.length)]);
    }
    if (options.lower) {
      pool += CHARS.lower;
      guaranteed.push(CHARS.lower[Math.floor(Math.random() * CHARS.lower.length)]);
    }
    if (options.digit) {
      pool += CHARS.digit;
      guaranteed.push(CHARS.digit[Math.floor(Math.random() * CHARS.digit.length)]);
    }

    if (!pool) {
      pool = CHARS.upper + CHARS.lower + CHARS.digit;
      guaranteed.push(CHARS.upper[Math.floor(Math.random() * CHARS.upper.length)]);
      guaranteed.push(CHARS.lower[Math.floor(Math.random() * CHARS.lower.length)]);
      guaranteed.push(CHARS.digit[Math.floor(Math.random() * CHARS.digit.length)]);
    }

    const generateOnce = () => {
      const pass = [...guaranteed];
      while (pass.length < length) {
        pass.push(pool[Math.floor(Math.random() * pool.length)]);
      }

      for (let i = pass.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pass[i], pass[j]] = [pass[j], pass[i]];
      }

      return pass.join('').slice(0, length);
    };

    const last = sessionStorage.getItem(LAST_PASSWORD_KEY) || '';
    let next = generateOnce();
    let tries = 0;

    while (next === last && tries < 20) {
      next = generateOnce();
      tries++;
    }

    sessionStorage.setItem(LAST_PASSWORD_KEY, next);
    return next;
  }

  function buildMessage(userId, password) {
    return `User Id : ${userId}\nPassword : ${password}\nsilakan di cek login ya bosku.\nNote : Saran kami di simpan di memo anda.`;
  }

  async function copyText(text) {
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text);
        return true;
      }
    } catch (e) {}

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveLastMessage(userId, password) {
    const payload = {
      userId,
      password,
      message: buildMessage(userId, password),
      ts: Date.now()
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return payload;
  }

  function readLastMessage() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.message || Date.now() - data.ts > 10 * 60 * 1000) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function placePanelLeftOfProfileTable(panel, force = false) {
    if (!panel || panel.dataset.dragged === '1') return;

    const hostDoc = panel.ownerDocument || document;

    if (panelHostType === 'mini') {
      panel.style.right = 'auto';
      panel.style.left = '10px';
      panel.style.top = '10px';
      return;
    }

    // Jika panel ditempel di halaman Nama Pemain / window induk,
    // posisikan otomatis dekat di sisi kiri popup Edit Player List.
    // Jadi jarak panel ke popup tidak terlalu jauh, namun tetap tidak menutupi form.
    if (hostDoc !== document) {
      if (force || !panel.style.left) {
        const hostWin = hostDoc.defaultView || window.opener || window;
        const panelWidth = panel.offsetWidth || PANEL_WIDTH;
        let left = OPENER_PANEL_LEFT;
        let top = OPENER_PANEL_TOP;

        try {
          const popupLeftFromOpener = Math.round(window.screenX - hostWin.screenX);
          const popupTopFromOpener = Math.round(window.screenY - hostWin.screenY);

          if (Number.isFinite(popupLeftFromOpener) && popupLeftFromOpener > 0) {
            left = popupLeftFromOpener - panelWidth - POPUP_SIDE_GAP;
          }
          if (Number.isFinite(popupTopFromOpener) && popupTopFromOpener > 0) {
            top = Math.max(8, popupTopFromOpener);
          }
        } catch (e) {}

        const maxLeft = Math.max(8, hostWin.innerWidth - panelWidth - 8);
        const maxTop = Math.max(8, hostWin.innerHeight - 35);
        left = Math.min(maxLeft, Math.max(8, left));
        top = Math.min(maxTop, Math.max(8, top));

        panel.style.right = 'auto';
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
      }
      return;
    }

    const table = findProfileTable();
    const panelRect = panel.getBoundingClientRect();
    const panelWidth = panelRect.width || PANEL_WIDTH;

    if (!table) {
      if (force || !panel.style.left) {
        panel.style.left = '10px';
        panel.style.top = '70px';
        panel.style.right = 'auto';
      }
      return;
    }

    const rect = table.getBoundingClientRect();
    let left = Math.floor(rect.left - panelWidth - GAP);
    let top = Math.floor(Math.max(8, rect.top));

    if (left < 8) left = 8;

    panel.style.right = 'auto';
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function createPanel() {
    if (!isProfileMemberPage()) return;

    const hostDoc = getPanelHostDoc();
    panelDocRef = hostDoc;

    if (panelCreated && panelRef && hostDoc.body && hostDoc.body.contains(panelRef)) return;

    // Kalau script refresh/reload di popup, panel lama di halaman induk dibuat ulang
    // supaya tombol tetap aktif dan terhubung ke profil member yang sedang dibuka.
    const oldPanel = hostDoc.getElementById('agwl2-rp-panel');
    if (oldPanel) oldPanel.remove();
    const oldStyle = hostDoc.getElementById('agwl2-rp-style');
    if (oldStyle) oldStyle.remove();

    if (hostDoc === document) {
      addLeftRoomForPanelIfNeeded();
    }

    const css = hostDoc.createElement('style');
    css.id = 'agwl2-rp-style';
    css.textContent = `
      #agwl2-rp-panel, #agwl2-rp-panel * { box-sizing: border-box; }
      #agwl2-rp-panel {
        position:fixed; left:10px; top:70px; width:${PANEL_WIDTH}px;
        max-width:calc(100vw - 20px); max-height:calc(100vh - 20px);
        display:flex; flex-direction:column; z-index:999999;
        color:#f5f5f7; background:#141419; border:1px solid #34343e; border-radius:20px;
        box-shadow:0 24px 70px #0008, 0 4px 16px #0005;
        font:12px/1.5 'Segoe UI',Arial,sans-serif; overflow:hidden; user-select:none; color-scheme:dark;
      }
      #agwl2-rp-head { display:flex; align-items:center; gap:11px; padding:18px 16px;
        background:radial-gradient(ellipse at top left,#572032 0,transparent 75%),#1d171e;
        border-bottom:1px solid #ffffff0d; cursor:grab; touch-action:none; flex-shrink:0; }
      #agwl2-rp-panel[data-dragging="1"] #agwl2-rp-head { cursor:grabbing; }
      #agwl2-rp-panel .agwl2-rp-emblem { display:grid; place-items:center; width:38px; height:40px;
        flex-shrink:0; border-radius:12px; color:#ff9bab; background:#f34b6a18; border:1px solid #f34b6a40; }
      #agwl2-rp-panel .agwl2-rp-heading { flex:1; min-width:0; }
      #agwl2-rp-panel .agwl2-rp-heading strong { display:block; font-size:13px; font-weight:700; letter-spacing:.1px; }
      #agwl2-rp-panel .agwl2-rp-heading small { display:block; font-size:10px; color:#b6a0ab; margin-top:3px; }
      #agwl2-rp-close { display:grid; place-items:center; width:28px; height:28px; padding:0; flex-shrink:0;
        border-radius:8px; border:1px solid #ffffff12; background:#ffffff05; color:#c9bbc3; cursor:pointer; font-size:20px; }
      #agwl2-rp-body { padding:16px; overflow-y:auto; min-height:0; scrollbar-width:thin; scrollbar-color:#4f3440 #141419; }
      #agwl2-rp-mode { display:flex; align-items:center; gap:7px; padding:8px 10px; margin-bottom:16px;
        border:1px solid #68d3ad20; border-radius:8px; background:#68d3ad08; color:#9be0c5; font-size:10px; }
      #agwl2-rp-mode::before { content:''; width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0; }
      #agwl2-rp-mode[data-ready="false"] { color:#ebc57c; background:#ebc57c08; border-color:#ebc57c25; }
      #agwl2-rp-panel .agwl2-rp-small { display:block; font-size:11px; color:#a7a5b3; margin-bottom:8px; font-weight:500; }
      #agwl2-rp-panel .agwl2-rp-account { display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:10px; }
      #agwl2-rp-user { color:#f3eff3; font-weight:600; overflow-wrap:anywhere; text-align:right; user-select:text; }
      #agwl2-rp-passbox { padding:13px 12px 15px; border:1px solid #f56b8545; border-radius:12px;
        background:linear-gradient(120deg,#341d29,#211920); box-shadow:inset 0 1px #ffffff08; }
      #agwl2-rp-panel .agwl2-rp-caption { text-align:center; color:#c59ba8; font-size:9px; font-weight:600; letter-spacing:1.6px; margin-bottom:6px; }
      #agwl2-rp-pass { text-align:center; font:600 20px/1.5 Consolas,monospace; color:#ffe6ec; letter-spacing:1px; overflow-wrap:anywhere; user-select:text; }
      #agwl2-rp-panel .agwl2-rp-row { margin-top:17px; }
      #agwl2-rp-lenval { float:right; min-width:27px; text-align:center; padding:0 6px; border-radius:6px; color:#ffa8b8; background:#f34b6a18; font-weight:700; }
      #agwl2-rp-range { display:block; width:100%; margin:0; height:20px; accent-color:#f05b78; cursor:pointer; }
      #agwl2-rp-panel .agwl2-rp-checks { display:flex; gap:7px; }
      #agwl2-rp-panel .agwl2-rp-checks label { flex:1; display:flex; justify-content:center; align-items:center; gap:6px;
        padding:9px 3px; border:1px solid #38343f; border-radius:8px; background:#1c1b22; color:#b8b4c0; font-size:11px; cursor:pointer; }
      #agwl2-rp-panel .agwl2-rp-checks label:has(input:checked) { border-color:#f05b7850; color:#ffd5de; background:#f05b7810; }
      #agwl2-rp-panel input[type="checkbox"] { margin:0; width:13px; height:13px; accent-color:#e75271; }
      #agwl2-rp-panel .agwl2-rp-actions { display:grid; gap:8px; margin-top:18px; }
      #agwl2-rp-panel .agwl2-rp-btn { display:flex; justify-content:center; align-items:center; gap:8px; width:100%; min-height:40px; padding:10px 9px;
        border:1px solid #44343f; border-radius:9px; color:#ecd9e1; background:#282029;
        font:600 12px/1.4 'Segoe UI',Arial,sans-serif; cursor:pointer; transition:background .15s, transform .15s, filter .15s; }
      #agwl2-rp-panel .agwl2-rp-btn.danger { border-color:#f76e88; background:linear-gradient(110deg,#eb4c6c,#cb3559); color:#fff; box-shadow:0 4px 16px #ed466c20; }
      #agwl2-rp-panel .agwl2-rp-btn.secondary { border-color:#34323c; background:#1c1c23; color:#c5c1cd; }
      #agwl2-rp-panel button:hover:not(:disabled) { filter:brightness(1.15); }
      #agwl2-rp-panel button:active:not(:disabled) { transform:translateY(1px); }
      #agwl2-rp-panel button:disabled { opacity:.45; cursor:not-allowed; }
      #agwl2-rp-panel :is(button,input,textarea):focus-visible { outline:2px solid #ff9db4; outline-offset:3px; }
      #agwl2-rp-panel .agwl2-rp-output-label { display:block; margin:19px 0 8px; color:#9692a3; font-size:9px; font-weight:600; letter-spacing:1.4px; }
      #agwl2-rp-output { display:block; width:100%; min-height:94px; margin:0; resize:vertical; padding:11px;
        color:#ded9e4; background:#101014; border:1px solid #302d38; border-radius:9px;
        font:11px/1.7 'Segoe UI',Arial,sans-serif; user-select:text; }
      #agwl2-rp-output::placeholder { color:#85808f; }
      #agwl2-rp-status { min-height:24px; margin-top:13px; padding-top:11px; border-top:1px solid #ffffff0a; color:#b9b0c0; font-size:10px; line-height:1.5; }


      /* Crimson Atelier: clear contrast, layered cards, vivid red accents. */
      #agwl2-rp-panel { border-radius:22px; border:1px solid #6c454a;
        background:#111216; color:#fff; font-family:'Segoe UI',Arial,sans-serif;
        box-shadow:0 32px 90px #000a,0 8px 24px #0006,inset 0 1px #ffffff15; }
      #agwl2-rp-head { position:relative; gap:12px; padding:22px 18px;
        background:radial-gradient(ellipse at 100% 0,#ff9b7c38,transparent 65%),linear-gradient(120deg,#a5142c,#e33045);
        border-bottom:1px solid #ff9f9b55; }
      #agwl2-rp-head::after { content:''; position:absolute; left:18px; right:18px; bottom:0;
        height:1px; background:linear-gradient(90deg,transparent,#ffddc7aa,transparent); }
      #agwl2-rp-panel .agwl2-rp-emblem { width:43px; height:46px; border-radius:14px;
        color:white; background:#ffffff18; border:1px solid #ffffff40; box-shadow:inset 0 1px #ffffff25,0 4px 12px #540a1722; }
      #agwl2-rp-panel .agwl2-rp-heading strong { color:#fff; font-size:18px; font-weight:700; letter-spacing:-.5px; }
      #agwl2-rp-panel .agwl2-rp-heading small { color:#ffe2e0; font-size:10px; }
      #agwl2-rp-panel .agwl2-rp-eyebrow { display:block; color:#ffded8; font-size:8px; font-weight:700; letter-spacing:2px; margin-bottom:4px; }
      #agwl2-rp-close { color:white; width:28px; height:28px; border-radius:50%; background:#6c102733; border-color:#ffffff35; }
      #agwl2-rp-body { padding:16px; scrollbar-width:thin; scrollbar-color:#95434c #111216; }
      #agwl2-rp-mode { color:#a8edca; background:#153029; border-color:#335c4c; border-radius:8px; padding:8px 10px; margin-bottom:13px; font-size:10px; }
      #agwl2-rp-mode::before { box-shadow:0 0 0 3px #9be0c512; }
      #agwl2-rp-mode[data-ready="false"] { color:#ffdc96; background:#302819; border-color:#695331; }
      #agwl2-rp-panel .agwl2-rp-account { align-items:center; border:1px solid #37383f; background:#1b1c22;
        border-radius:11px; padding:11px 12px; margin-bottom:11px; color:#c1c2cb; }
      #agwl2-rp-user { font-size:13px; color:#fff; font-weight:700; }
      #agwl2-rp-passbox { position:relative; overflow:hidden; padding:21px 12px 18px;
        background:radial-gradient(ellipse at 100% 0,#f4435b28,transparent 70%),linear-gradient(115deg,#302026,#211b21);
        border:1px solid #b94c5c; border-radius:14px; box-shadow:inset 0 1px #ffc7cb20,0 5px 20px #0002; }
      #agwl2-rp-passbox::before { content:''; position:absolute; left:0; top:19px; bottom:19px; width:3px; background:#ff5269; border-radius:0 3px 3px 0; }
      #agwl2-rp-panel .agwl2-rp-caption { color:#ffb8c1; font-size:9px; letter-spacing:2px; margin-bottom:10px; }
      #agwl2-rp-pass { color:#fff; font-size:25px; letter-spacing:1.5px; line-height:1.4; text-shadow:0 2px 14px #fa4d6240; }
      #agwl2-rp-panel .agwl2-rp-pass-note { text-align:center; font-size:9px; color:#c6a6b0; margin-top:8px; }
      #agwl2-rp-panel .agwl2-rp-settings { background:#1a1b21; border:1px solid #36373f; border-radius:14px; padding:13px; margin-top:12px; }
      #agwl2-rp-panel .agwl2-rp-section { color:#f2f0f5; font-size:10px; font-weight:700; display:flex; align-items:center; gap:8px; letter-spacing:.4px; }
      #agwl2-rp-panel .agwl2-rp-section::before { content:''; width:5px; height:5px; border-radius:2px; background:#ff6476; }
      #agwl2-rp-panel .agwl2-rp-row { margin-top:13px; }
      #agwl2-rp-panel .agwl2-rp-small { font-size:11px; color:#c5c5cf; }
      #agwl2-rp-lenval { background:#6d2936; color:#fff; border:1px solid #b44c60; border-radius:6px; padding:0 7px; }
      #agwl2-rp-range { accent-color:#ff5369; height:18px; }
      #agwl2-rp-panel .agwl2-rp-checks { gap:7px; }
      #agwl2-rp-panel .agwl2-rp-checks label { padding:9px 3px; background:#121317; border-color:#46464f; border-radius:8px; font-weight:600; }
      #agwl2-rp-panel .agwl2-rp-checks label:has(input:checked) { color:#fff; background:#54232e; border-color:#b54c60; }
      #agwl2-rp-panel input[type="checkbox"] { accent-color:#f64d65; }
      #agwl2-rp-panel .agwl2-rp-actions { margin-top:13px; gap:8px; }
      #agwl2-rp-panel .agwl2-rp-btn { min-height:41px; border-radius:10px; background:#24252c; color:#f0edf3; border-color:#4b4b57; }
      #agwl2-rp-panel .agwl2-rp-btn.danger { min-height:46px; background:linear-gradient(110deg,#f33d55,#d51e39); border:1px solid #ff7b8b; color:white;
        box-shadow:0 5px 17px #eb304034,inset 0 1px #ffffff2a; font-size:13px; }
      #agwl2-rp-panel .agwl2-rp-btn.secondary { background:#e9e7ed; border-color:#fff; color:#26212c; min-height:39px; }
      #agwl2-rp-panel .agwl2-rp-btn svg { width:16px; height:16px; flex-shrink:0; }
      #agwl2-rp-panel button:hover:not(:disabled) { filter:brightness(1.12); }
      #agwl2-rp-panel .agwl2-rp-output-label { display:flex; align-items:center; gap:9px; margin:17px 0 9px; color:#d8d3df; font-size:9px; letter-spacing:1.5px; }
      #agwl2-rp-panel .agwl2-rp-output-label::after { content:''; flex:1; height:1px; background:#3b3742; }
      #agwl2-rp-output { background:#0c0d11; border-color:#41414d; border-radius:11px; color:#eeeaf3; padding:11px 12px; min-height:98px; font-size:11px; line-height:1.75; }
      #agwl2-rp-output::placeholder { color:#aaa6b5; }
      #agwl2-rp-status { font-size:10px; line-height:1.6; border-color:#35313c; }
      #agwl2-rp-panel :is(button,input,textarea):focus-visible { outline:2px solid #ffb7bd; outline-offset:3px; }
      @media(prefers-reduced-motion:reduce) { #agwl2-rp-panel button { transition:none!important; } }
    `;
    (hostDoc.head || hostDoc.documentElement).appendChild(css);

    const panel = hostDoc.createElement('div');
    panel.id = 'agwl2-rp-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Panel Reset Password');
    panel.innerHTML = `
      <div id="agwl2-rp-head" title="Tahan judul ini lalu geser panel">
        <span class="agwl2-rp-emblem" aria-hidden="true"><svg width="18" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span>
        <span class="agwl2-rp-heading"><span class="agwl2-rp-eyebrow">MEMBER ACCESS</span><strong>Reset Password</strong><small>AGWL2 · Geser untuk memindahkan</small></span>
        <button id="agwl2-rp-close" title="Tutup panel dan popup" aria-label="Tutup panel dan popup">&times;</button>
      </div>
      <div id="agwl2-rp-body">
        <div id="agwl2-rp-mode">Panel aktif di profil member.</div>
        <div class="agwl2-rp-small agwl2-rp-account">User ID: <span id="agwl2-rp-user">-</span></div>
        <div id="agwl2-rp-passbox">
          <div class="agwl2-rp-caption">PASSWORD BARU</div>
          <div id="agwl2-rp-pass">-</div><div class="agwl2-rp-pass-note">Dibuat otomatis sesuai pilihan karakter</div>
        </div>
        <div class="agwl2-rp-settings"><div class="agwl2-rp-section">Pengaturan password</div>
        <div class="agwl2-rp-row">
          <label for="agwl2-rp-range" class="agwl2-rp-small">Panjang password <span id="agwl2-rp-lenval">10</span></label>
          <input id="agwl2-rp-range" type="range" min="6" max="20" value="10">
        </div>
        <div class="agwl2-rp-row">
          <div class="agwl2-rp-small">Karakter yang digunakan</div>
          <div class="agwl2-rp-checks">
            <label><input id="agwl2-rp-upper" type="checkbox" checked> A-Z</label>
            <label><input id="agwl2-rp-lower" type="checkbox" checked> a-z</label>
            <label><input id="agwl2-rp-digit" type="checkbox" checked> 0-9</label>
          </div>
        </div>
        </div>
        <div class="agwl2-rp-actions">
          <button class="agwl2-rp-btn" id="agwl2-rp-fill"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 9-9 9-9-9 9-9Z"/><path d="M12 8v8M8 12h8"/></svg>Isi Password Saja</button>
          <button class="agwl2-rp-btn danger" id="agwl2-rp-reset"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/><path d="M12 8v5l3 2"/></svg>Reset &amp; buat pesan</button>
        </div>
        <label class="agwl2-rp-output-label" for="agwl2-rp-output">PESAN UNTUK MEMBER</label>
        <textarea id="agwl2-rp-output" placeholder="Pesan untuk member akan muncul setelah reset..."></textarea>
        <button class="agwl2-rp-btn secondary" id="agwl2-rp-copy-msg" style="width:100%;margin-top:7px;"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></svg>Salin pesan</button>
        <div id="agwl2-rp-status" role="status" aria-live="polite"></div>
      </div>
    `;
    hostDoc.body.appendChild(panel);
    panelCreated = true;
    panelRef = panel;

    const $ = (id) => hostDoc.getElementById(id);
    const passEl = $('agwl2-rp-pass');
    const userEl = $('agwl2-rp-user');
    const outputEl = $('agwl2-rp-output');
    const statusEl = $('agwl2-rp-status');
    const lenRange = $('agwl2-rp-range');
    const lenVal = $('agwl2-rp-lenval');
    const modeEl = $('agwl2-rp-mode');
    const fillBtn = $('agwl2-rp-fill');
    const resetBtnPanel = $('agwl2-rp-reset');

    function status(text, bad) {
      statusEl.style.color = bad ? '#ffb3b3' : '#efc5cb';
      statusEl.textContent = text || '';
    }

    function refreshMode() {
      const ready = hasResetForm();
      modeEl.dataset.ready = String(ready);
      if (ready) {
        modeEl.textContent = 'Form terhubung · Siap digunakan';
        fillBtn.disabled = false;
        resetBtnPanel.disabled = false;
      } else {
        modeEl.textContent = 'Menunggu form Reset Password di profil.';
        fillBtn.disabled = true;
        resetBtnPanel.disabled = true;
      }
      return ready;
    }

    function refreshUser() {
      const uid = getUserId();
      userEl.textContent = uid || 'Tidak terbaca';
      return uid;
    }

    function makePassword() {
      const length = Number(lenRange.value || 10);
      const pw = randomPassword(length, {
        upper: $('agwl2-rp-upper').checked,
        lower: $('agwl2-rp-lower').checked,
        digit: $('agwl2-rp-digit').checked
      });
      passEl.textContent = pw;
      status('Password otomatis dibuat berbeda.');
      return pw;
    }

    function fillPasswordFields() {
      const newPass = getInputByLabel('New Password');
      const confirmPass = getInputByLabel('Confirm New Password');
      const pw = makePassword();

      if (!newPass || !confirmPass) {
        status('Form New Password / Confirm New Password tidak ditemukan.', true);
        return null;
      }

      setValue(newPass, pw);
      setValue(confirmPass, pw);
      status('Password otomatis baru sudah diisi ke form.');
      return pw;
    }

    function showMessage(data, autoCopy) {
      outputEl.value = data.message;
      if (autoCopy) {
        copyText(data.message).then(ok => {
          status(ok ? 'Reset diproses. Kata-kata sudah otomatis dicopy.' : 'Reset diproses. Copy manual dari kotak kata-kata.', !ok);
        });
      }
    }

    function focusLinkedPopup(delay = 35) {
      if (hostDoc === document) return;

      // Mode mini-window tidak ditempel di halaman belakang, jadi tidak perlu memaksa focus
      // setiap klik. Memaksa focus justru bisa membuat panel terasa mental.
      if (panelHostType === 'mini') return;

      // Fallback opener: panggil popup beberapa kali karena Chrome/Windows kadang
      // menaruh popup di belakang setelah user klik panel di halaman induk.
      const delays = [0, delay, 120, 260, 520];
      delays.forEach((d) => {
        setTimeout(() => {
          try { if (!window.closed) window.focus(); } catch (e) {}
        }, d);
      });
    }

    function keepPanelAndPopupTogether() {
      if (hostDoc === document) return;

      if (panelHostType === 'mini') {
        // Mini-window: jika user menutup window panel dari tombol X browser,
        // popup Edit Player List ikut ditutup agar benar-benar satu kesatuan.
        if (panelWindowCloseWatch) clearInterval(panelWindowCloseWatch);
        panelWindowCloseWatch = setInterval(() => {
          try {
            if (mainIsUnloading) return;
            if (panelWindowRef && panelWindowRef.closed) {
              clearInterval(panelWindowCloseWatch);
              panelWindowCloseWatch = null;
              closeThisProfileWindow();
            }
          } catch (e) {}
        }, 650);
        return;
      }

      // Fallback opener: klik panel tetap mencoba mengembalikan popup ke depan.
      ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((evt) => {
        panel.addEventListener(evt, (e) => {
          const target = e.target;
          if (target && target.closest('#agwl2-rp-head')) return;
          focusLinkedPopup(evt === 'pointerdown' || evt === 'mousedown' ? 0 : 45);
        }, true);
      });
    }

    keepPanelAndPopupTogether();

    lenRange.addEventListener('input', () => {
      lenVal.textContent = lenRange.value;
      refreshUser();
      makePassword();
    });

    ['agwl2-rp-upper', 'agwl2-rp-lower', 'agwl2-rp-digit'].forEach((id) => {
      const box = $(id);
      if (!box) return;
      box.addEventListener('change', () => {
        refreshUser();
        makePassword();
      });
    });

    $('agwl2-rp-fill').addEventListener('click', () => {
      refreshUser();
      refreshMode();
      fillPasswordFields();
      focusLinkedPopup(70);
    });

    $('agwl2-rp-reset').addEventListener('click', async () => {
      const userId = refreshUser();
      refreshMode();

      if (!userId) {
        status('User ID tidak terbaca dari profil member.', true);
        return;
      }

      const pw = fillPasswordFields();
      if (!pw) return;

      const resetButton = findResetButton();
      if (!resetButton) {
        status('Tombol Reset Password tidak ditemukan.', true);
        return;
      }

      const data = saveLastMessage(userId, pw);
      showMessage(data, true);
      focusLinkedPopup(70);
      await sleep(250);
      resetButton.click();
    });


    $('agwl2-rp-copy-msg').addEventListener('click', async () => {
      const text = outputEl.value.trim();
      if (!text) {
        status('Belum ada kata-kata untuk dicopy.', true);
        return;
      }
      const ok = await copyText(text);
      status(ok ? 'Kata-kata dicopy.' : 'Gagal copy kata-kata.', !ok);
      focusLinkedPopup(70);
    });

    function closePanelAndLinkedWindow() {
      try {
        panel.remove();
        const st = hostDoc.getElementById('agwl2-rp-style');
        if (st) st.remove();
      } catch (e) {
        try { panel.style.display = 'none'; } catch (err) {}
      }

      if (panelWindowCloseWatch) {
        clearInterval(panelWindowCloseWatch);
        panelWindowCloseWatch = null;
      }

      if (panelHostType === 'mini') {
        try { if (panelWindowRef && !panelWindowRef.closed) panelWindowRef.close(); } catch (e) {}
        closeThisProfileWindow();
        return;
      }

      if (hostDoc !== document) {
        closeThisProfileWindow();
        return;
      }

      try { panel.style.display = 'none'; } catch (e) {}
    }

    $('agwl2-rp-close').addEventListener('click', closePanelAndLinkedWindow);

    (function enableDrag() {
      const head = $('agwl2-rp-head');
      const view = hostDoc.defaultView || window;
      let drag = null;

      function place(left, top) {
        const maxLeft = Math.max(0, view.innerWidth - panel.offsetWidth - 4);
        const maxTop = Math.max(0, view.innerHeight - panel.offsetHeight - 4);
        panel.style.right = 'auto';
        panel.style.left = `${Math.max(0, Math.min(maxLeft, left))}px`;
        panel.style.top = `${Math.max(0, Math.min(maxTop, top))}px`;
      }

      head.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || !e.isPrimary || e.button !== 0) return;
        const rect = panel.getBoundingClientRect();
        drag = {
          id: e.pointerId, x: e.clientX, y: e.clientY,
          screenX: e.screenX, screenY: e.screenY,
          windowX: view.screenX, windowY: view.screenY,
          left: rect.left, top: rect.top
        };
        panel.dataset.dragged = '1';
        panel.dataset.dragging = '1';
        try { head.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });

      head.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        if (panelHostType === 'mini') {
          // Geser jendela panel, bukan isinya di dalam jendela yang sempit.
          const screen = view.screen;
          const minX = Number.isFinite(screen.availLeft) ? screen.availLeft : 0;
          const minY = Number.isFinite(screen.availTop) ? screen.availTop : 0;
          const maxX = minX + Math.max(0, screen.availWidth - view.outerWidth);
          const maxY = minY + Math.max(0, screen.availHeight - view.outerHeight);
          const left = drag.windowX + e.screenX - drag.screenX;
          const top = drag.windowY + e.screenY - drag.screenY;
          try {
            view.moveTo(Math.max(minX, Math.min(maxX, left)), Math.max(minY, Math.min(maxY, top)));
          } catch (err) {}
        } else {
          place(drag.left + e.clientX - drag.x, drag.top + e.clientY - drag.y);
        }
        e.preventDefault();
      });

      function stop(e) {
        if (!drag || (e && e.pointerId !== undefined && e.pointerId !== drag.id)) return;
        const id = drag.id;
        drag = null;
        delete panel.dataset.dragging;
        try { if (head.hasPointerCapture(id)) head.releasePointerCapture(id); } catch (err) {}
      }
      head.addEventListener('pointerup', stop);
      head.addEventListener('pointercancel', stop);
      head.addEventListener('lostpointercapture', stop);
      view.addEventListener('blur', () => stop());
      view.addEventListener('resize', () => {
        if (!panel.isConnected || panelHostType === 'mini') return;
        const rect = panel.getBoundingClientRect();
        place(rect.left, rect.top);
      });
    })();

    refreshUser();
    refreshMode();
    makePassword();
    placePanelLeftOfProfileTable(panel, true);

    const last = readLastMessage();
    if (last) {
      showMessage(last, true);
    } else {
      status(hasResetForm() ? 'Form Reset Password siap digunakan.' : 'Form Reset Password belum terlihat.');
    }

    setInterval(() => {
      if (!hostDoc.body || !hostDoc.body.contains(panel)) return;
      refreshUser();
      refreshMode();
      placePanelLeftOfProfileTable(panel, false);
      // Jangan kembalikan posisi jendela yang sudah digeser pengguna.
    }, 1000);
  }

  window.addEventListener('beforeunload', () => {
    mainIsUnloading = true;
    try {
      if (panelWindowCloseWatch) {
        clearInterval(panelWindowCloseWatch);
        panelWindowCloseWatch = null;
      }
    } catch (e) {}

    try {
      if (panelDocRef && panelDocRef !== document) {
        const p = panelDocRef.getElementById('agwl2-rp-panel');
        if (p) p.remove();
        const st = panelDocRef.getElementById('agwl2-rp-style');
        if (st) st.remove();
      }
    } catch (e) {}

    try {
      if (panelHostType === 'mini' && panelWindowRef && !panelWindowRef.closed) {
        panelWindowRef.close();
      }
    } catch (e) {}
  });

  function boot() {
    if (!document.body) return false;
    if (!isProfileMemberPage()) return false;

    const hostDoc = getPanelHostDoc();
    if (panelCreated && panelRef && hostDoc.body && hostDoc.body.contains(panelRef)) return true;

    createPanel();
    return true;
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (boot() || tries >= BOOT_MAX_TRIES) clearInterval(timer);
  }, BOOT_INTERVAL_MS);

  const observer = new MutationObserver(() => {
    boot();
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
