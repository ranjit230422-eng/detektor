// ==UserScript==
// @name         AGWL2 Auto Reset Password Member
// @namespace    tampermonkey-agwl2-reset-password-member
// @version      2.3.0
// @description  Bubble compact; klik Reset & Salin langsung menyalin sebelum form diproses, verifikasi log tetap di background.
// @match        *://agwl2.admitoto.com/*
// @match        *://agwl2.suksesbogil.com/*
// @match        *://agwl2.idnpaito.com/*
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @connect      agwl2.admitoto.com
// @noframes
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'agwl2_reset_password_last_message_v3';
  const LAST_PASSWORD_KEY = 'agwl2_reset_password_last_generated_v1';
  const BOOT_INTERVAL_MS = 300;
  const BOOT_MAX_TRIES = 120;
  const PANEL_WIDTH = 316;
  const GAP = 12;
  // Posisi fallback panel saat profil dibuka lewat popup.
  // Dibuat lebih dekat ke sisi kiri popup Edit Player List.
  const OPENER_PANEL_LEFT = 320;
  const OPENER_PANEL_TOP = 24;
  const POPUP_SIDE_GAP = 8;
  const PANEL_WIN_WIDTH = 354;
  const PANEL_WIN_HEIGHT = 615;
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


  // === VERIFIKASI RESET DI BELAKANG LAYAR v2.0 ===
  // Pekerjaan disimpan di Tampermonkey dan dijalankan oleh tab admin UTAMA,
  // bukan oleh popup profil yang dapat ditutup setelah reset.
  const LOG_URL = 'https://agwl2.admitoto.com/log.php';
  const JOB_PREFIX = 'agwl2_rp20_job_';
  const EVENT_KEY = 'agwl2_rp20_event';
  const LATEST_KEY = 'agwl2_rp20_latest';
  const DISMISS_PREFIX = 'agwl2_rp20_dismiss_';
  const WORKER_ID = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const LOG_ACTION_RE = /\b(?:reset\s*[-_ ]?\s*(?:password|passwd|pwd|pass)|(?:password|passwd|pwd)\s*[-_ ]?\s*reset|(?:ubah|ganti|change|changed|update|updated)\s+(?:password|passwd|pwd))\b/i;
  const activeJobs = new Set();
  const isProfilePage = /\/editplayerlist\.php$/i.test(location.pathname);
  const isLogPage = /\/log\.php$/i.test(location.pathname);
  const isBackgroundWorker = !isProfilePage && !isLogPage && /^agwl2\./i.test(location.hostname);

  function dateTodayWib() {
    const obj = {};
    for (const p of new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: 'numeric'
    }).formatToParts(new Date())) obj[p.type] = p.value;
    return { yyyy: obj.year, mm: obj.month, dd: obj.day, iso: `${obj.year}-${obj.month}-${obj.day}` };
  }

  function allLogJobs() {
    // GM_listValues diperlukan supaya pekerjaan tidak hilang jika popup ditutup
    // ketika event antar-tab sedang dikirim.
    let keys = [];
    try { if (typeof GM_listValues === 'function') keys = GM_listValues(); } catch (_) {}
    const result = [];
    for (const key of keys) {
      if (!key.startsWith(JOB_PREFIX)) continue;
      const job = GM_getValue(key, null);
      if (job && job.id && job.userId && Number.isFinite(job.startedAt)) result.push(job);
    }
    return result.sort((a, b) => b.startedAt - a.startedAt);
  }

  function getJob(id) { return GM_getValue(JOB_PREFIX + id, null); }
  function saveJob(job) { GM_setValue(JOB_PREFIX + job.id, job); return job; }

  function newLogJob(userId) {
    // Jangan simpan password di penyimpanan lintas-tab.
    const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID().replace(/-/g, '') : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const job = saveJob({ id, userId: String(userId).trim(), startedAt: Date.now(), state: 'queued', attempt: 0 });
    GM_setValue(LATEST_KEY, { id, userId: job.userId, state: 'queued', ts: Date.now() });
    GM_setValue(EVENT_KEY, { id, ts: Date.now(), type: 'queue' });
    return job;
  }

  function dispatchLogCheck(job) {
    GM_setValue(EVENT_KEY, { id: job.id, ts: Date.now(), type: 'dispatch' });
    try {
      if (window.opener && !window.opener.closed && window.opener.location.origin === location.origin) {
        window.opener.postMessage({ rp20: 'dispatch', jobId: job.id }, location.origin);
      }
    } catch (_) {}
  }

  function gmRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: options.method || 'GET', url,
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache', ...(options.headers || {}) },
        data: options.data, timeout: 12000, responseType: 'text', withCredentials: true,
        onload: response => {
          if (response.status < 200 || response.status >= 400) {
            reject(new Error(`HTTP ${response.status} dari log.php`)); return;
          }
          const finalUrl = response.finalUrl || url;
          if (new URL(finalUrl).origin !== new URL(LOG_URL).origin) {
            reject(new Error('Log mengalihkan ke domain lain; periksa sesi login admin.')); return;
          }
          resolve({ html: String(response.responseText || ''), url: finalUrl });
        },
        onerror: () => reject(new Error('Tidak dapat mengakses log.php. Periksa login atau koneksi.')),
        ontimeout: () => reject(new Error('Pemeriksaan log.php habis waktu (12 detik).'))
      });
    });
  }

  function parseLogPage(response) {
    const doc = new DOMParser().parseFromString(response.html, 'text/html');
    const path = new URL(response.url).pathname;
    if (/\b(?:login|signin|sign-in)\b/i.test(path) ||
        (doc.querySelector('input[type="password"]') && !/\buserid\b/i.test(doc.body?.textContent || ''))) {
      throw new Error('Sesi login log.php tidak aktif. Login ke agwl2.admitoto.com dahulu.');
    }
    return doc;
  }

  function fieldHint(el, doc) {
    const id = el.id || '';
    let label = '';
    if (id) label = Array.from(doc.querySelectorAll('label')).filter(x => x.htmlFor === id)
      .map(x => x.textContent || '').join(' ');
    const cell = el.closest('td,th');
    const row = el.closest('tr');
    return [el.name, id, el.placeholder, el.getAttribute('aria-label'), label,
      cell?.previousElementSibling?.textContent, row?.cells?.[0]?.textContent]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function editableFields(doc) {
    return Array.from(doc.querySelectorAll('input,select,textarea')).filter(el =>
      !el.disabled && !['hidden','submit','button','reset','checkbox','radio','file','password','image'].includes(el.type));
  }

  function findUserIdField(doc) {
    const ranked = editableFields(doc).filter(el => el.tagName !== 'SELECT').map(el => {
      const hint = fieldHint(el, doc);
      let score = 0;
      if (/\buser[\s_-]*id\b|userid/.test(hint)) score += 30;
      if (/\busername\b|user[\s_-]*name/.test(hint)) score += 10;
      if (/\bmember\b/.test(hint)) score += 3;
      if (/\bfrom\b|\boperator\b|\badmin\b/.test(hint)) score -= 35;
      if (/date|tanggal|tgl|time|periode/.test(hint)) score -= 35;
      if (/^(?:userid|useridfilter|useridsearch|user_id)$/.test((el.name || el.id || '').toLowerCase())) score += 45;
      return { el, score };
    }).sort((a, b) => b.score - a.score);
    return ranked[0]?.score >= 20 ? ranked[0].el : null;
  }

  function formatDateForField(el, d) {
    if (el.type === 'date') return d.iso;
    const hint = `${el.getAttribute('placeholder') || ''} ${el.value || ''}`.toLowerCase();
    if (/mm[/-]dd[/-]yyyy/.test(hint)) return `${d.mm}/${d.dd}/${d.yyyy}`;
    if (/dd[/-]mm[/-]yyyy|\d{1,2}\/\d{1,2}\/\d{4}/.test(hint)) return `${d.dd}/${d.mm}/${d.yyyy}`;
    if (/dd-mm-yyyy|\d{1,2}-\d{1,2}-\d{4}/.test(hint)) return `${d.dd}-${d.mm}-${d.yyyy}`;
    if (/yyyy\/mm\/dd|\d{4}\/\d{1,2}\/\d{1,2}/.test(hint)) return `${d.yyyy}/${d.mm}/${d.dd}`;
    return d.iso;
  }

  function fillLogDates(doc, today, form) {
    let count = 0;
    for (const el of editableFields(doc)) {
      if (form && el.form && el.form !== form) continue;
      const name = (el.name || el.id || '').toLowerCase();
      // Jangan pernah mengisi kolom From, UserId atau operator sebagai tanggal,
      // meskipun seluruh kolom berada di baris tabel yang sama.
      if (/^(?:userid|user_id|username|user_name|from|user_from|operator|admin)$/.test(name)) continue;
      const hint = fieldHint(el, doc);
      if (!(el.type === 'date' || /(?:^|[^a-z])(?:date|tanggal|tgl|periode|period|datepicker)(?:$|[^a-z])/.test(hint)
          || /startdate|enddate|datefrom|dateto|fromdate|todate/.test(name))) continue;
      if (el.tagName === 'SELECT') {
        const option = Array.from(el.options).find(o => [o.value, o.textContent.trim()].includes(today.iso));
        if (!option) continue;
        el.value = option.value;
      } else el.value = formatDateForField(el, today);
      count++;
    }
    return count;
  }

  function findSubmit(form) {
    const buttons = Array.from(form.querySelectorAll('button,input[type="submit"],input[type="button"]'));
    const ranked = buttons.filter(el => !el.disabled).map(el => {
      const label = (el.value || el.textContent || '').trim().toLowerCase();
      let score = /submit|search|cari|filter|tampil|proses|\bgo\b|lihat/.test(label) ? 20 : 0;
      if (el.type === 'submit') score += 5;
      if (/hapus|clear|reset|logout|keluar|delete|back|kembali/.test(label)) score -= 35;
      return { el, score };
    }).sort((a, b) => b.score-a.score);
    return ranked[0]?.score >= 5 ? ranked[0].el : null;
  }

  function serializeForm(form, clicked) {
    const params = new URLSearchParams();
    for (const el of Array.from(form.elements)) {
      if (!el.name || el.disabled) continue;
      const type = (el.type || '').toLowerCase();
      if (['file','reset','button','image'].includes(type) || (type === 'submit' && el !== clicked)) continue;
      if ((type === 'checkbox' || type === 'radio') && !el.checked) continue;
      if (el.tagName === 'SELECT' && el.multiple) {
        for (const option of Array.from(el.selectedOptions)) params.append(el.name, option.value);
      } else params.append(el.name, el.value);
    }
    if (clicked?.name && !params.has(clicked.name)) params.append(clicked.name, clicked.value || '');
    return params;
  }

  function buildLogSubmit(doc, pageUrl, userId) {
    const uid = findUserIdField(doc);
    if (!uid) throw new Error('Field UserId tidak ditemukan di form log. Tidak memakai field From.');
    const form = uid.form || uid.closest('form');
    if (!form) throw new Error('Form UserId di log.php tidak ditemukan.');
    const count = fillLogDates(doc, dateTodayWib(), form);
    if (!count) throw new Error('Kolom tanggal log belum dikenali; perlu menyesuaikan HTML log.php.');
    uid.value = userId;
    const button = findSubmit(form);
    if (!button) throw new Error('Tombol Submit log.php tidak ditemukan.');
    const method = (button.getAttribute('formmethod') || form.getAttribute('method') || 'GET').toUpperCase();
    const action = new URL(button.getAttribute('formaction') || form.getAttribute('action') || pageUrl, pageUrl);
    if (action.origin !== new URL(LOG_URL).origin) throw new Error('Submit log mengarah ke luar domain admin.');
    if (method !== 'GET' && method !== 'POST') throw new Error(`Metode submit ${method} belum didukung.`);
    if (button.type === 'button' && button.hasAttribute('onclick')) {
      throw new Error('Submit memakai JavaScript khusus; perlu contoh HTML form log.php.');
    }
    const params = serializeForm(form, button);
    if (!uid.name || !params.has(uid.name)) throw new Error('Field UserId tidak memiliki atribut name.');
    if (method === 'GET') {
      for (const [k,v] of params) action.searchParams.append(k,v);
      return { method: 'GET', url: action.href };
    }
    if (/multipart\/form-data/.test(form.enctype || '')) throw new Error('Form log tidak menggunakan submit form standar.');
    return { method: 'POST', url: action.href,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, data: params.toString() };
  }

  function exactUserId(text, userId) {
    const escaped = String(userId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-zA-Z0-9_.-])${escaped}(?=$|[^a-zA-Z0-9_.-])`, 'i').test(text);
  }

  function timeFromRow(text) {
    const today = dateTodayWib();
    const time = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
    if (!time) return null;
    const ymd = text.match(/\b(20\d{2})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
    const dmy = text.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](20\d{2})\b/);
    let day = today.iso;
    if (ymd) day = `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`;
    else if (dmy) day = `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    const ms = Date.parse(`${day}T${time[1].padStart(2,'0')}:${time[2]}:${time[3] || '00'}+07:00`);
    return Number.isFinite(ms) ? { ms, minutePrecision: !time[3] } : null;
  }

  function findConfirmingLog(doc, job) {
    let noTime = false;
    for (const tr of Array.from(doc.querySelectorAll('tr'))) {
      const tds = Array.from(tr.querySelectorAll('td'));
      if (!tds.length) continue;
      const line = tds.map(td => td.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
      if (!LOG_ACTION_RE.test(line) || !exactUserId(line, job.userId)) continue;
      if (/\b(?:failed|failure|error|unsuccessful|rejected|denied|gagal|ditolak)\b/i.test(line)) continue;
      const stamp = timeFromRow(line);
      if (!stamp) { noTime = true; continue; }
      const slack = stamp.minutePrecision ? 65000 : 15000;
      if (stamp.ms >= job.startedAt - slack && stamp.ms <= Date.now() + 60000) {
        return { match: line.slice(0,400), noTime: false };
      }
    }
    return { match: null, noTime };
  }

  function postLogResult(job, state, reason) {
    const current = getJob(job.id) || job;
    if (current.state === 'success' || current.state === 'error') return;
    saveJob({ ...current, state, reason: String(reason || ''), finishedAt: Date.now(), leaseUntil: 0 });
    GM_setValue(LATEST_KEY, { id: job.id, userId: job.userId, state, reason: String(reason || ''), ts: Date.now() });
    GM_setValue(EVENT_KEY, { id: job.id, ts: Date.now(), type: 'result' });
    // Sengaja TIDAK ada GM_notification atau Notification: hanya UI internal script.
  }

  function createResultBanner() {
    if (!document.body || isProfilePage || isLogPage) return null;
    let banner = document.getElementById('agwl2-rp20-notification');
    if (banner) return banner;
    const style = document.createElement('style');
    style.id = 'agwl2-rp20-notification-style';
    style.textContent = `
      #agwl2-rp20-notification{position:fixed;top:16px;right:16px;z-index:2147483647;width:min(370px,calc(100vw - 24px));
        font:13px/1.5 'Segoe UI',Arial,sans-serif;color:#f9eff1;background:linear-gradient(145deg,#1e1720,#101116);
        border:1px solid #763747;border-radius:16px;box-shadow:0 18px 55px #000b, inset 0 1px #ffffff16;
        padding:13px 15px;max-height:min(60vh,510px);overflow-y:auto;box-sizing:border-box}
      #agwl2-rp20-notification *{box-sizing:border-box}
      #agwl2-rp20-notification .rp20-title{display:flex;justify-content:space-between;align-items:center;gap:10px;
        font-size:10px;font-weight:800;letter-spacing:1.5px;color:#ffb4c0;padding-bottom:9px;border-bottom:1px solid #ffffff18}
      #agwl2-rp20-notification button{border:1px solid #ffffff30;background:#ffffff0d;color:white;border-radius:8px;
        cursor:pointer;padding:2px 7px;font-size:14px;line-height:1.5}
      #agwl2-rp20-notification button:hover{background:#ffffff20}
      #agwl2-rp20-notification .rp20-item{padding:10px 0;border-bottom:1px solid #ffffff12}
      #agwl2-rp20-notification .rp20-item:last-child{border-bottom:none;padding-bottom:1px}
      #agwl2-rp20-notification .rp20-line{display:flex;align-items:center;justify-content:space-between;gap:7px}
      #agwl2-rp20-notification .rp20-success{color:#86f6bb;font-weight:800;font-size:14px}
      #agwl2-rp20-notification .rp20-pending{color:#f8c781;font-weight:800;font-size:13px}
      #agwl2-rp20-notification .rp20-error{color:#ff9fa8;font-weight:800;font-size:13px}
      #agwl2-rp20-notification .rp20-detail{font-size:11px;color:#d4c6cc;white-space:normal;overflow-wrap:anywhere;margin-top:4px}
      #agwl2-rp20-notification .rp20-close{font-size:12px;padding:1px 7px;flex:none}
    `;
    (document.head || document.documentElement).appendChild(style);
    banner = document.createElement('section');
    banner.id = 'agwl2-rp20-notification';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    document.body.appendChild(banner);
    return banner;
  }

  // Hanya notif sukses GAS KIRIM KE MEMBER yang ditutup otomatis setelah 5 detik.
  // Timer ditetapkan SEKALI per User ID / pekerjaan agar tidak diulang tiap render.
  const SUCCESS_NOTICE_DURATION_MS = 5000;
  const successNoticeTimers = new Map();
  function autoCloseSuccessfulNotice(job) {
    if (!job || job.state !== 'success' || successNoticeTimers.has(job.id)) return;
    const timer = setTimeout(() => {
      successNoticeTimers.delete(job.id);
      if (getJob(job.id)?.state !== 'success') return;
      GM_setValue(DISMISS_PREFIX + job.id, true);
      lastBannerSnapshot = '';
      renderLogToast();
    }, SUCCESS_NOTICE_DURATION_MS);
    successNoticeTimers.set(job.id, timer);
  }

  let lastBannerSnapshot = '';
  function renderLogToast() {
    if (!document.body || isProfilePage || isLogPage) return;
    const cutoff = Date.now() - 24*60*60*1000;
    const jobs = allLogJobs().filter(job => job.startedAt > cutoff && !GM_getValue(DISMISS_PREFIX + job.id, false));
    const chosen = jobs.slice(0, 4);
    const snapshot = JSON.stringify(chosen.map(j => [j.id,j.state,j.reason]));
    if (lastBannerSnapshot === snapshot && document.getElementById('agwl2-rp20-notification')) return;
    lastBannerSnapshot = snapshot;
    if (!chosen.length) {
      document.getElementById('agwl2-rp20-notification')?.remove(); return;
    }
    const banner = createResultBanner();
    if (!banner) return;
    banner.replaceChildren();
    const head = document.createElement('div'); head.className = 'rp20-title';
    head.textContent = 'VERIFIKASI RESET PASSWORD';
    const dismissAll = document.createElement('button'); dismissAll.textContent = 'Tutup';
    dismissAll.title = 'Tutup seluruh notifikasi yang ditampilkan';
    dismissAll.addEventListener('click', () => {
      for (const job of chosen) GM_setValue(DISMISS_PREFIX + job.id, true);
      lastBannerSnapshot = ''; renderLogToast();
    });
    head.appendChild(dismissAll); banner.appendChild(head);
    for (const job of chosen) {
      const item = document.createElement('div'); item.className = 'rp20-item';
      const top = document.createElement('div'); top.className = 'rp20-line';
      const title = document.createElement('span');
      const complete = job.state === 'success';
      const failed = job.state === 'error';
      title.className = complete ? 'rp20-success' : failed ? 'rp20-error' : 'rp20-pending';
      title.textContent = complete ? 'GAS KIRIM KE MEMBER' : failed ? 'VERIFIKASI LOG BELUM BERHASIL' : 'SEDANG MEMERIKSA LOG...';
      const close = document.createElement('button'); close.className = 'rp20-close'; close.textContent = '×';
      close.title = 'Tutup notifikasi ini';
      close.addEventListener('click', () => {
        GM_setValue(DISMISS_PREFIX + job.id, true); lastBannerSnapshot = ''; renderLogToast();
      });
      top.append(title,close);
      const detail = document.createElement('div'); detail.className = 'rp20-detail';
      detail.textContent = `User ID: ${job.userId}. ${complete ? 'Reset Password berhasil tercatat di log.php.' : failed ?
        (job.reason || 'Perlu periksa log secara manual.') : 'Pemeriksaan tetap berjalan walaupun popup profil ditutup.'}`;
      item.append(top,detail); banner.appendChild(item);
      if (complete) autoCloseSuccessfulNotice(job);
    }
  }

  async function verifyLogViaHttp(job) {
    // Satu GET log terbaru + satu kali submit filter UserId.
    const html = await gmRequest(`${LOG_URL}?_rp20=${Date.now()}`);
    const doc = parseLogPage(html);
    const request = buildLogSubmit(doc, html.url, job.userId);
    const latest = getJob(job.id) || job;
    // Tandai submit sudah dimulai, agar pemulihan tidak mengirim submit ke-2.
    if (latest.submitIssuedAt) throw new Error('Submit log sudah pernah dilakukan; tidak mengirim ulang. Periksa hasil secara manual.');
    saveJob({ ...latest, submitIssuedAt: Date.now(), readUrl: request.method === 'GET' ? request.url : html.url });
    let reply = await gmRequest(request.url, request);
    let found = findConfirmingLog(parseLogPage(reply), job);
    if (found.match) return found.match;
    let noTime = found.noTime;
    // Jika sistem log menulis terlambat, ulangi hanya pembacaan GET.
    // Jangan ulangi POST/submit untuk pekerjaan yang sama.
    const readUrl = request.method === 'GET' ? request.url : (reply.url || LOG_URL);
    for (const pause of [1300, 2200, 3300, 4200]) {
      await sleep(pause);
      reply = await gmRequest(readUrl, { method: 'GET' });
      found = findConfirmingLog(parseLogPage(reply), job);
      if (found.match) return found.match;
      if (found.noTime) noTime = true;
    }
    throw new Error(noTime ?
      'Ada baris reset yang cocok, tetapi waktu reset tidak dapat dipastikan. Periksa log manual.' :
      `Belum ditemukan reset password terbaru untuk ${job.userId} pada tanggal ${dateTodayWib().iso}.`);
  }

  async function runQueuedLogJob(jobId) {
    if (!isBackgroundWorker || !jobId || activeJobs.has(jobId)) return;
    let job = getJob(jobId);
    if (!job || !['queued','running'].includes(job.state) || Date.now() - job.startedAt > 180000) return;
    if (job.state === 'running' && job.leaseUntil > Date.now()) return;
    const execute = async () => {
      job = getJob(jobId);
      if (!job || !['queued','running'].includes(job.state)) return;
      if (job.state === 'running' && job.leaseUntil > Date.now()) return;
      activeJobs.add(jobId);
      try {
        // Bila tab worker mati setelah submit, jangan submit untuk kedua kalinya.
        if (job.submitIssuedAt) {
          postLogResult(job, 'error', 'Worker sebelumnya terhenti setelah Submit. Tidak mengirim Submit kedua kalinya; periksa log secara manual.');
          return;
        }
        const claimed = saveJob({ ...job, state: 'running', owner: WORKER_ID, leaseUntil: Date.now() + 75000 });
        GM_setValue(EVENT_KEY, { id: job.id, ts: Date.now(), type: 'running' });
        await sleep(Math.max(0, 900 - (Date.now() - job.startedAt)));
        const latest = getJob(jobId);
        if (!latest || latest.owner !== WORKER_ID) return;
        try {
          const match = await verifyLogViaHttp(claimed);
          postLogResult(claimed, 'success', match);
        } catch (e) {
          postLogResult(claimed, 'error', String(e?.message || e));
        }
      } finally { activeJobs.delete(jobId); }
    };
    // Kunci lintas-tab (Chrome) untuk mencegah dua tab admin mengirim submit bersamaan.
    if (navigator.locks?.request) {
      try { await navigator.locks.request(`agwl2-rp20-${jobId}`, { ifAvailable: true }, lock => lock ? execute() : undefined); }
      catch (e) { postLogResult(job, 'error', `Tidak bisa menjalankan worker: ${e.message}`); }
    } else {
      // Fallback untuk browser tanpa Web Locks.
      const claimed = saveJob({ ...job, state: 'running', owner: WORKER_ID, leaseUntil: Date.now() + 75000 });
      await sleep(100);
      if (getJob(jobId)?.owner !== WORKER_ID) return;
      // Masukkan ulang queued agar execute() dapat memproses pemegang kunci ini.
      saveJob({ ...claimed, state: 'queued', leaseUntil: 0 });
      await execute();
    }
  }

  function refreshBackgroundController() {
    if (!isBackgroundWorker) return;
    const jobs = allLogJobs();
    const now = Date.now();
    for (const job of jobs) {
      if (job.startedAt < now - 180000) continue;
      if (job.state === 'queued' || (job.state === 'running' && job.leaseUntil < now)) {
        runQueuedLogJob(job.id);
      }
    }
  }

  // Main page tetap hidup ketika popup Edit Player List / bubble mini ditutup.
  if (isBackgroundWorker) {
    window.addEventListener('message', ev => {
      if (ev.origin === location.origin && ev.data?.rp20 === 'dispatch') refreshBackgroundController();
    });
    if (typeof GM_addValueChangeListener === 'function') {
      GM_addValueChangeListener(EVENT_KEY, () => {
        refreshBackgroundController(); renderLogToast();
      });
      GM_addValueChangeListener(LATEST_KEY, () => renderLogToast());
    }
    const init = () => { refreshBackgroundController(); renderLogToast(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
    setInterval(init, 1200); // Backup bila listener Tampermonkey terlambat/terlewat.
  }
  // === AKHIR VERIFIKASI RESET DI BELAKANG LAYAR ===

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
      /* Reset Password v2.2 / Obsidian Rose - compact premium UI */
      #agwl2-rp-panel, #agwl2-rp-panel * { box-sizing:border-box; }
      #agwl2-rp-panel {
        position:fixed;left:10px;top:65px;width:${PANEL_WIDTH}px;
        max-width:calc(100vw - 20px);max-height:calc(100vh - 20px);
        display:flex;flex-direction:column;z-index:999999;overflow:hidden;
        border-radius:17px;border:1px solid #70505c;
        background:linear-gradient(155deg,#1c1a22 0%,#12131a 45%,#17151c 100%);
        color:#fff4f5;font:11.5px/1.5 'Segoe UI',Arial,sans-serif;
        box-shadow:0 22px 60px #000b,0 5px 18px #0008,inset 0 1px #ffffff19;
        user-select:none;color-scheme:dark;
      }
      #agwl2-rp-panel::after {content:'';position:absolute;inset:0 0 auto;pointer-events:none;height:2px;
        background:linear-gradient(90deg,#63303e,#f99ca0 44%,#ad638e 73%,#3b2d40);}
      #agwl2-rp-head {
        display:flex;align-items:center;gap:10px;flex-shrink:0;position:relative;
        padding:12px 13px 11px;cursor:grab;touch-action:none;
        background:radial-gradient(ellipse at 92% 0%,#92385050,transparent 68%),linear-gradient(120deg,#2d1c29,#201c29);
        border-bottom:1px solid #ffffff16;
      }
      #agwl2-rp-panel[data-dragging="1"] #agwl2-rp-head {cursor:grabbing;}
      #agwl2-rp-panel .agwl2-rp-emblem {width:34px;height:34px;flex-shrink:0;display:grid;place-items:center;
        background:linear-gradient(140deg,#b34359,#722c50);border:1px solid #ec829374;border-radius:11px;
        color:#fff4f6;box-shadow:0 4px 12px #a83f593b,inset 0 1px #ffffff35;}
      #agwl2-rp-panel .agwl2-rp-emblem svg {width:17px;height:18px;}
      #agwl2-rp-panel .agwl2-rp-heading {flex:1;min-width:0;}
      #agwl2-rp-panel .agwl2-rp-eyebrow {display:block;color:#f5bbc6;font-size:8px;letter-spacing:1.8px;font-weight:750;line-height:1.2;}
      #agwl2-rp-panel .agwl2-rp-heading strong {display:block;color:#fff8fa;font-size:15px;letter-spacing:-.35px;line-height:1.35;font-weight:740;margin-top:2px;}
      #agwl2-rp-panel .agwl2-rp-heading small {display:block;color:#bcaebf;font-size:9px;margin-top:2px;}
      #agwl2-rp-close {width:25px;height:25px;flex-shrink:0;display:grid;place-items:center;
        border:1px solid #ffffff21;border-radius:8px;background:#ffffff0b;color:#f0d8df;
        font:19px/1 'Segoe UI',Arial,sans-serif;cursor:pointer;}
      #agwl2-rp-body {padding:11px 12px 12px;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#794359 #191820;}
      #agwl2-rp-mode {display:flex;align-items:center;gap:7px;margin-bottom:9px;padding:6px 9px;
        border-radius:8px;background:#18322b;border:1px solid #38786455;color:#b4f4d2;font-size:10px;font-weight:580;}
      #agwl2-rp-mode::before {content:'';flex-shrink:0;width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px #95eec018;}
      #agwl2-rp-mode[data-ready="false"] {background:#372c21;border-color:#9e76544d;color:#ffd3a4;}
      #agwl2-rp-panel .agwl2-rp-small {font-size:10.5px;color:#d1c7d1;font-weight:550;}
      #agwl2-rp-panel .agwl2-rp-account {display:flex;justify-content:space-between;align-items:center;
        margin:0 0 9px;padding:8px 10px;border:1px solid #ffffff12;border-radius:9px;background:#25212b;gap:8px;}
      #agwl2-rp-user {font-size:12px;color:#fff7f8;font-weight:750;overflow-wrap:anywhere;text-align:right;user-select:text;}
      #agwl2-rp-passbox {position:relative;overflow:hidden;padding:11px 11px 10px;
        background:linear-gradient(125deg,#35232f,#211c27 60%,#251d2c);border:1px solid #a4587180;
        border-radius:12px;box-shadow:inset 0 1px #ffffff11,0 4px 15px #0003;}
      #agwl2-rp-passbox::before {content:'';position:absolute;left:0;top:13px;bottom:13px;width:3px;
        border-radius:0 3px 3px 0;background:linear-gradient(#ff9fa3,#cf5c85);}
      #agwl2-rp-panel .agwl2-rp-caption {text-align:center;color:#e9a4b8;font-size:8px;font-weight:750;letter-spacing:1.55px;margin-bottom:3px;}
      #agwl2-rp-pass {color:#fff8fb;font:750 22px/1.25 Consolas,'Courier New',monospace;
        letter-spacing:1px;text-align:center;overflow-wrap:anywhere;user-select:text;text-shadow:0 2px 13px #e7566f38;}
      #agwl2-rp-panel .agwl2-rp-pass-note {text-align:center;color:#a99aa8;font-size:9px;margin-top:4px;}
      #agwl2-rp-panel .agwl2-rp-settings {margin-top:9px;border:1px solid #463645;border-radius:10px;background:#201d26;overflow:hidden;}
      #agwl2-rp-panel .agwl2-rp-settings summary {display:flex;align-items:center;justify-content:space-between;gap:8px;
        padding:9px 10px;cursor:pointer;color:#eddee6;font-size:10.5px;font-weight:650;list-style:none;}
      #agwl2-rp-panel .agwl2-rp-settings summary::-webkit-details-marker {display:none;}
      #agwl2-rp-panel .agwl2-rp-settings summary::after {content:'⌄';font-size:17px;color:#e3a5b7;line-height:1;transform:translateY(-2px);transition:transform .15s;}
      #agwl2-rp-panel .agwl2-rp-settings[open] summary::after {transform:rotate(180deg) translateY(0);}
      #agwl2-rp-panel .agwl2-rp-settings summary::before {content:'✦';color:#f39bad;font-size:11px;}
      #agwl2-rp-panel .agwl2-rp-settings .agwl2-rp-config {padding:0 10px 11px;border-top:1px solid #ffffff12;}
      #agwl2-rp-panel .agwl2-rp-row {margin-top:10px;}
      #agwl2-rp-panel .agwl2-rp-row .agwl2-rp-small {display:block;margin-bottom:7px;}
      #agwl2-rp-lenval {float:right;min-width:27px;text-align:center;padding:1px 6px;
        border-radius:6px;background:#5b2c43;border:1px solid #b66882;color:#fff;font-weight:750;}
      #agwl2-rp-range {display:block;width:100%;height:17px;margin:0;accent-color:#e87391;cursor:pointer;}
      #agwl2-rp-panel .agwl2-rp-checks {display:flex;gap:6px;}
      #agwl2-rp-panel .agwl2-rp-checks label {display:flex;align-items:center;justify-content:center;gap:5px;flex:1;
        border:1px solid #514354;border-radius:7px;background:#19171f;color:#d2c6d2;font-size:10px;
        padding:7px 4px;cursor:pointer;}
      #agwl2-rp-panel .agwl2-rp-checks label:has(input:checked) {background:#48263a;border-color:#b5687b;color:#fff5f7;}
      #agwl2-rp-panel input[type="checkbox"] {width:12px;height:12px;margin:0;accent-color:#e87894;}
      #agwl2-rp-panel .agwl2-rp-actions {display:grid;grid-template-columns:1fr;gap:7px;margin-top:10px;}
      #agwl2-rp-panel .agwl2-rp-btn {display:flex;align-items:center;justify-content:center;gap:7px;
        width:100%;min-height:35px;padding:7px 10px;border-radius:9px;border:1px solid #624a5b;
        background:linear-gradient(135deg,#322834,#28222e);color:#eadddf;
        font:650 11px/1.35 'Segoe UI',Arial,sans-serif;cursor:pointer;
        transition:filter .15s,transform .15s,box-shadow .15s;}
      #agwl2-rp-panel .agwl2-rp-btn.danger {min-height:39px;color:#fff;
        background:linear-gradient(105deg,#de5670,#b6385c 67%,#942e55);border:1px solid #f49caf;
        box-shadow:inset 0 1px #ffffff36,0 5px 18px #c841673d;font-size:12px;font-weight:750;}
      #agwl2-rp-panel .agwl2-rp-btn.secondary {background:#2c2632;border-color:#675064;color:#f5dfe7;min-height:33px;}
      #agwl2-rp-panel .agwl2-rp-btn svg {width:14px;height:14px;flex-shrink:0;}
      #agwl2-rp-panel button:hover:not(:disabled) {filter:brightness(1.17);}
      #agwl2-rp-panel button:active:not(:disabled) {transform:translateY(1px);}
      #agwl2-rp-panel button:disabled {opacity:.47;cursor:not-allowed;}
      #agwl2-rp-panel :is(button,input,textarea,summary):focus-visible {outline:2px solid #f7a3be;outline-offset:2px;}
      #agwl2-rp-panel .agwl2-rp-output-label {display:flex;align-items:center;gap:9px;
        margin:11px 0 7px;color:#c4b5c4;font-size:8px;font-weight:750;letter-spacing:1.25px;}
      #agwl2-rp-panel .agwl2-rp-output-label::after {content:'';flex:1;height:1px;background:#463440;}
      #agwl2-rp-output {display:block;width:100%;min-height:73px;max-height:120px;padding:9px 10px;
        resize:vertical;border-radius:9px;border:1px solid #463849;background:#111016;color:#efe7ef;
        font:10.5px/1.5 'Segoe UI',Arial,sans-serif;user-select:text;scrollbar-width:thin;scrollbar-color:#744458 #111016;}
      #agwl2-rp-output::placeholder {color:#89818e;}
      #agwl2-rp-status {margin-top:9px;padding-top:8px;min-height:20px;border-top:1px solid #ffffff13;
        color:#d9afbb;font-size:10px;line-height:1.55;user-select:text;}
      #agwl2-rp-panel .agwl2-rp-footer {margin-top:7px;color:#948695;text-align:center;font-size:8.5px;}
      @media(prefers-reduced-motion:reduce) {
        #agwl2-rp-panel .agwl2-rp-btn,#agwl2-rp-panel .agwl2-rp-settings summary::after {transition:none!important;}
      }
    `;
    (hostDoc.head || hostDoc.documentElement).appendChild(css);

    const panel = hostDoc.createElement('div');
    panel.id = 'agwl2-rp-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Panel Reset Password');
    panel.innerHTML = `
      <div id="agwl2-rp-head" title="Tahan judul ini lalu geser panel">
        <span class="agwl2-rp-emblem" aria-hidden="true"><svg width="18" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span>
        <span class="agwl2-rp-heading"><span class="agwl2-rp-eyebrow">AGWL2 · MEMBER ACCESS</span><strong>Reset Password</strong><small>Compact panel · bisa digeser</small></span>
        <button id="agwl2-rp-close" type="button" title="Tutup panel dan popup" aria-label="Tutup panel dan popup">&times;</button>
      </div>
      <div id="agwl2-rp-body">
        <div id="agwl2-rp-mode">Panel aktif di profil member.</div>
        <div class="agwl2-rp-small agwl2-rp-account">User ID <span id="agwl2-rp-user">-</span></div>
        <div id="agwl2-rp-passbox">
          <div class="agwl2-rp-caption">PASSWORD BARU</div>
          <div id="agwl2-rp-pass">-</div>
          <div class="agwl2-rp-pass-note">Dibuat otomatis · 10 karakter default</div>
        </div>
        <details class="agwl2-rp-settings" id="agwl2-rp-settings">
          <summary title="Klik untuk mengatur password">Pengaturan password</summary>
          <div class="agwl2-rp-config">
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
        </details>
        <div class="agwl2-rp-actions">
          <button type="button" class="agwl2-rp-btn" id="agwl2-rp-fill"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 9-9 9-9-9 9-9Z"/><path d="M12 8v8M8 12h8"/></svg>Isi Password Saja</button>
          <button type="button" class="agwl2-rp-btn danger" id="agwl2-rp-reset"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/><path d="M12 8v5l3 2"/></svg>Reset &amp; Salin Pesan</button>
        </div>
        <label class="agwl2-rp-output-label" for="agwl2-rp-output">PESAN UNTUK MEMBER</label>
        <textarea id="agwl2-rp-output" rows="3" placeholder="Pesan otomatis muncul setelah reset..."></textarea>
        <button type="button" class="agwl2-rp-btn secondary" id="agwl2-rp-copy-msg" style="width:100%;margin-top:7px;"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></svg>Salin Pesan Lagi</button>
        <div id="agwl2-rp-status" role="status" aria-live="polite"></div>
        <div class="agwl2-rp-footer">Verifikasi log otomatis · Notifikasi di halaman admin</div>
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
    let submittingReset = false;

    // Cara menyalin yang paling stabil untuk panel terpisah about:blank:
    // Lakukan COPY di dokumen tempat tombol benar-benar diklik (mini-window),
    // sebelum fokus berpindah ke form reset di popup profil.
    async function copyFromPanel(text) {
      const value = String(text || '');
      if (!value) return false;
      const ownerDoc = outputEl.ownerDocument;
      const view = ownerDoc.defaultView;
      outputEl.value = value;

      // A: copy sinkron saat user-gesture masih aktif.
      try {
        outputEl.focus({ preventScroll: true });
        outputEl.select();
        if (ownerDoc.execCommand('copy')) {
          outputEl.setSelectionRange(0, 0);
          return true;
        }
      } catch (_) {}

      // B: Tampermonkey clipboard, tetap dalam gesture klik.
      try {
        if (typeof GM_setClipboard === 'function') {
          GM_setClipboard(value, 'text');
          return true;
        }
      } catch (_) {}

      // C: Clipboard API dari window yang memuat tombol (bukan popup profil).
      try {
        const api = view && view.navigator && view.navigator.clipboard;
        if (api && typeof api.writeText === 'function') {
          await api.writeText(value);
          return true;
        }
      } catch (_) {}
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(value);
          return true;
        }
      } catch (_) {}
      return false;
    }

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
        resetBtnPanel.disabled = submittingReset;
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
        copyFromPanel(data.message).then(ok => {
          status(ok ? 'Pesan disalin. Tunggu notifikasi GAS KIRIM KE MEMBER.' : 'Clipboard diblokir, gunakan Salin Pesan Lagi.', !ok);
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
      if (submittingReset) return;
      const userId = refreshUser();
      refreshMode();
      if (!userId) {
        status('User ID tidak terbaca dari profil member.', true);
        return;
      }
      const newPass = getInputByLabel('New Password');
      const confirmPass = getInputByLabel('Confirm New Password');
      const resetButton = findResetButton();
      if (!newPass || !confirmPass || !resetButton) {
        status('Form atau tombol Reset Password tidak ditemukan.', true);
        return;
      }

      submittingReset = true;
      resetBtnPanel.disabled = true;
      // Buat PASSWORD dan SALIN pesan SEBELUM input form difokuskan.
      // Dengan begitu mini-window about:blank tetap memiliki fokus/izin clipboard.
      const pw = makePassword();
      const data = saveLastMessage(userId, pw);
      showMessage(data, false);
      const copied = await copyFromPanel(data.message);
      if (!copied) {
        status('Gagal menyalin otomatis. Reset belum dikirim. Klik Salin Pesan Lagi, lalu ulangi reset.', true);
        submittingReset = false;
        resetBtnPanel.disabled = false;
        return;
      }
      status('Pesan berhasil disalin. Tunggu notifikasi GAS KIRIM KE MEMBER sebelum dikirim.');

      // Baru fokus dan isi field reset setelah pesan aman disalin.
      try {
        setValue(newPass, pw);
        setValue(confirmPass, pw);
        if (newPass.value !== pw || confirmPass.value !== pw) {
          throw new Error('Pengisian password tidak sesuai');
        }
        // Verifikasi dibuat sebelum submit agar tetap dilacak setelah popup ditutup.
        const job = newLogJob(userId);
        dispatchLogCheck(job);
        focusLinkedPopup(70);
        resetButton.click();
      } catch (err) {
        status('Reset tidak dapat dijalankan: ' + err.message, true);
        submittingReset = false;
        resetBtnPanel.disabled = false;
      }
    });

    $('agwl2-rp-copy-msg').addEventListener('click', async () => {
      const value = outputEl.value.trim();
      if (!value) {
        status('Belum ada pesan untuk disalin.', true);
        return;
      }
      const ok = await copyFromPanel(value);
      status(ok ? 'Pesan berhasil disalin ke clipboard.' : 'Clipboard tidak dapat diakses. Pilih teks lalu tekan Ctrl+C.', !ok);
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
      showMessage(last, false);
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

  // Controller log tetap aktif di semua halaman admin, UI hanya di halaman profil.
  // Hindari MutationObserver mahal pada daftar pemain yang berisi ribuan elemen.
  if (!/editplayerlist\.php$/i.test(location.pathname)) return;

  function boot() {
    if (!document.body) return false;
    if (panelCreated && panelRef && panelRef.isConnected) return true;
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
