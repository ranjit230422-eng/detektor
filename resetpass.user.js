// ==UserScript==
// @name         AGWL2 Auto Reset Password Member
// @namespace    tampermonkey-agwl2-reset-password-member
// @version      1.4.2
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
  const PANEL_WIDTH = 252;
  const GAP = 12;
  // Posisi fallback panel saat profil dibuka lewat popup.
  // Dibuat lebih dekat ke sisi kiri popup Edit Player List.
  const OPENER_PANEL_LEFT = 320;
  const OPENER_PANEL_TOP = 24;
  const POPUP_SIDE_GAP = 8;
  const PANEL_WIN_WIDTH = 294;
  const PANEL_WIN_HEIGHT = 575;
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
    // Prioritas 1: mini-window panel terpisah. Ini yang paling mendekati â€œsenyawaâ€
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
        position: fixed; left: 10px; top: 70px; width: ${PANEL_WIDTH}px;
        max-width: calc(100vw - 16px); max-height: calc(100vh - 16px);
        display: flex; flex-direction: column; z-index: 999999;
        color: #f7eeee; background: linear-gradient(155deg, #221317, #100e10 48%, #161012);
        border: 1px solid #66313c; border-radius: 17px;
        box-shadow: 0 20px 50px #0009, 0 4px 12px #0008, inset 0 1px 0 #ffffff16;
        font: 12px/1.45 'Segoe UI', Arial, sans-serif;
        overflow: hidden; user-select: none; color-scheme: dark;
      }
      #agwl2-rp-head {
        display: flex; align-items: center; gap: 9px; padding: 14px 12px;
        background: linear-gradient(120deg, #641a29, #35141d 65%, #201015);
        border-bottom: 1px solid #a13d504d; cursor: grab; touch-action: none; flex-shrink: 0;
      }
      #agwl2-rp-panel[data-dragging="1"] #agwl2-rp-head { cursor: grabbing; }
      #agwl2-rp-panel .agwl2-rp-emblem {
        display: grid; place-items: center; width: 32px; height: 36px; flex-shrink: 0;
        border-radius: 10px; background: linear-gradient(145deg, #b43750, #631b2a);
        border: 1px solid #d6657955; box-shadow: 0 4px 8px #0005, inset 0 1px 0 #ffffff25;
      }
      #agwl2-rp-panel .agwl2-rp-heading { flex: 1; min-width: 0; }
      #agwl2-rp-panel .agwl2-rp-heading strong { display: block; font-size: 11px; letter-spacing: 1px; color: #fff0f2; }
      #agwl2-rp-panel .agwl2-rp-heading small { display: block; font-size: 10px; color: #d5a5af; margin-top: 2px; }
      #agwl2-rp-close {
        width: 28px; height: 28px; padding: 0; flex-shrink: 0; border-radius: 9px;
        border: 1px solid #ffffff18; background: #0b080b55; color: #e7c4cc; cursor: pointer; font-size: 19px;
      }
      #agwl2-rp-body { padding: 13px; overflow-y: auto; min-height: 0; scrollbar-width: thin; scrollbar-color: #70313e #120e11; }
      #agwl2-rp-mode {
        padding: 7px 9px; margin-bottom: 12px; border: 1px solid #63313c;
        border-radius: 8px; background: #3a19234d; color: #e1a9b5; font-size: 10px; line-height: 1.5;
      }
      #agwl2-rp-panel .agwl2-rp-small { font-size: 10px; color: #c6aab1; margin-bottom: 7px; font-weight: 600; }
      #agwl2-rp-user { color: #fff0f3; font-weight: 700; overflow-wrap: anywhere; }
      #agwl2-rp-passbox {
        padding: 14px 9px; border: 1px solid #82404e; border-radius: 11px;
        background: linear-gradient(145deg, #29151c, #100c10);
        box-shadow: inset 0 2px 7px #0008, 0 1px 0 #ffffff08;
      }
      #agwl2-rp-pass { text-align: center; font: 700 16px/1.45 Consolas, monospace; color: #ffe5eb; letter-spacing: 1px; overflow-wrap: anywhere; }
      #agwl2-rp-panel .agwl2-rp-row { margin-top: 13px; }
      #agwl2-rp-lenval { float: right; min-width: 24px; text-align: center; padding: 0 5px; border-radius: 5px; color: #ffe4ea; background: #642437; }
      #agwl2-rp-range { display: block; width: 100%; margin: 0; height: 20px; accent-color: #b93e57; cursor: pointer; }
      #agwl2-rp-panel .agwl2-rp-checks { display: flex; gap: 5px; }
      #agwl2-rp-panel .agwl2-rp-checks label {
        flex: 1; display: flex; justify-content: center; align-items: center; gap: 4px;
        padding: 7px 3px; border: 1px solid #51313a; border-radius: 8px;
        background: linear-gradient(#2b1b21, #1d1519); color: #e8ced6; font-size: 11px; cursor: pointer;
      }
      #agwl2-rp-panel input[type="checkbox"] { margin: 0; width: 13px; height: 13px; accent-color: #aa304b; }
      #agwl2-rp-panel .agwl2-rp-actions { display: grid; gap: 8px; margin-top: 15px; }
      #agwl2-rp-panel .agwl2-rp-btn {
        width: 100%; min-height: 37px; padding: 9px 8px; border: 1px solid #754050;
        border-radius: 9px; color: #f7e9ed; background: linear-gradient(#41232e, #2a171f);
        font: 600 11px/1.4 'Segoe UI', Arial, sans-serif; cursor: pointer;
        box-shadow: inset 0 1px 0 #ffffff12, 0 3px 6px #0004;
        transition: filter .15s, transform .15s;
      }
      #agwl2-rp-panel .agwl2-rp-btn.danger { border-color: #cc546d; background: linear-gradient(135deg, #b53251, #791e36); color: #fff; }
      #agwl2-rp-panel .agwl2-rp-btn.secondary { border-color: #4c343d; background: linear-gradient(#2b2027, #1b151a); color: #dbc3cc; }
      #agwl2-rp-panel button:hover:not(:disabled) { filter: brightness(1.15); }
      #agwl2-rp-panel button:active:not(:disabled) { transform: translateY(1px); }
      #agwl2-rp-panel button:disabled { opacity: .45; cursor: not-allowed; }
      #agwl2-rp-panel :is(button, input, textarea):focus-visible { outline: 2px solid #ed91a7; outline-offset: 2px; }
      #agwl2-rp-panel .agwl2-rp-output-label { display: block; margin: 15px 0 6px; color: #b89aa5; font-size: 9px; font-weight: 700; letter-spacing: 1.4px; }
      #agwl2-rp-output {
        display: block; width: 100%; min-height: 87px; margin: 0; resize: vertical;
        padding: 10px; color: #ecd9df; background: #0c0a0d; border: 1px solid #443039;
        border-radius: 9px; font: 11px/1.65 'Segoe UI', Arial, sans-serif; user-select: text;
        box-shadow: inset 0 2px 6px #0005;
      }
      #agwl2-rp-output::placeholder { color: #9b818b; }
      #agwl2-rp-status { min-height: 16px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #ffffff0c; color: #cfb0ba; font-size: 10px; line-height: 1.5; }
      @media (prefers-reduced-motion: reduce) { #agwl2-rp-panel button { transition: none !important; } }
    `;
    (hostDoc.head || hostDoc.documentElement).appendChild(css);

    const panel = hostDoc.createElement('div');
    panel.id = 'agwl2-rp-panel';
    panel.innerHTML = `
      <div id="agwl2-rp-head" title="Tahan judul ini lalu geser panel">
        <span class="agwl2-rp-emblem" aria-hidden="true"><svg width="18" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span>
        <span class="agwl2-rp-heading"><strong>RESET PASSWORD</strong><small>â ¿ Tahan judul untuk geser</small></span>
        <button id="agwl2-rp-close" title="Tutup panel dan popup" aria-label="Tutup panel dan popup">Ã—</button>
      </div>
      <div id="agwl2-rp-body">
        <div id="agwl2-rp-mode">Panel aktif di profil member.</div>
        <div class="agwl2-rp-small">User ID: <span id="agwl2-rp-user">-</span></div>
        <div id="agwl2-rp-passbox">
          <div id="agwl2-rp-pass">-</div>
        </div>
        <div class="agwl2-rp-row">
          <div class="agwl2-rp-small">Panjang Password: <span id="agwl2-rp-lenval">10</span></div>
          <input id="agwl2-rp-range" type="range" min="6" max="20" value="10">
        </div>
        <div class="agwl2-rp-row">
          <div class="agwl2-rp-small">Jenis Karakter:</div>
          <div class="agwl2-rp-checks">
            <label><input id="agwl2-rp-upper" type="checkbox" checked> A-Z</label>
            <label><input id="agwl2-rp-lower" type="checkbox" checked> a-z</label>
            <label><input id="agwl2-rp-digit" type="checkbox" checked> 0-9</label>
          </div>
        </div>
        <div class="agwl2-rp-actions">
          <button class="agwl2-rp-btn" id="agwl2-rp-fill">Isi Password Saja</button>
          <button class="agwl2-rp-btn danger" id="agwl2-rp-reset">Reset + Buat Kata-kata</button>
        </div>
        <label class="agwl2-rp-output-label" for="agwl2-rp-output">PESAN UNTUK MEMBER</label>
        <textarea id="agwl2-rp-output" placeholder="Kata-kata hasil reset akan muncul di sini..."></textarea>
        <button class="agwl2-rp-btn secondary" id="agwl2-rp-copy-msg" style="width:100%;margin-top:7px;">Salin Kata-kata</button>
        <div id="agwl2-rp-status"></div>
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
      if (ready) {
        modeEl.textContent = 'Form reset terdeteksi â€¢ Siap digunakan';
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
        // popup Edit Player List ikut ditutup agar benar-benar â€œ1 nyawaâ€.
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
