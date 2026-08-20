// ==UserScript==
// @name         LiveChat + REGC AUTO FULL — Scan -> Sheet D:J -> Debit K -> N Done
// @namespace    linetogel-livechat-regc-auto-full
// @version      6.5.7
// @description  V6.5.7 logo LINE TOGEL pada background dibuat tajam, penuh, tidak pudar, dan tidak buram; tema ungu tetap dipertahankan.
// @author       OpenAI
// @match        https://my.livechatinc.com/*
// @match        https://regc.idnlive.live/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @connect      *
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  /********************************************************************
   * KONFIGURASI BERSAMA LIVECHAT + REGC
   * ---------------------------------------------------------------
   * URL Web App /exec cukup disimpan SATU KALI melalui menu Tampermonkey:
   * "LINETOGEL: Set Google Apps Script /exec"
   * Nilainya disimpan dengan GM_setValue sehingga sama untuk kedua domain.
   ********************************************************************/
  const LT_COMBINED_WEBAPP_KEY = 'lt_combined_webapp_exec_v1';
  const LT_COMBINED_DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbw9xsfQz9GrMDUjGklnd1pTr_CQbGxmwGdda6uH9T9kam5cLyziDcB-MeWVh5Pv4uQP/exec';
  const LT_COMBINED_SECRET = 'LCST_FfQHZMVN7MLW44yiqfh5beuCiWPDhiIW';
  const LT_REGC_WAKE_KEY = 'lt_regc_background_wake_v3';

  function ltCombinedValidExecUrl(value) {
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/i.test(String(value || '').trim());
  }

  function ltCombinedGetWebAppUrl() {
    try {
      const saved = GM_getValue(LT_COMBINED_WEBAPP_KEY, '');
      return saved && String(saved).trim() ? String(saved).trim() : LT_COMBINED_DEFAULT_URL;
    } catch (e) {
      return LT_COMBINED_DEFAULT_URL;
    }
  }

  function ltCombinedSetWebAppUrl() {
    const current = ltCombinedGetWebAppUrl();
    const initial = ltCombinedValidExecUrl(current) ? current : '';
    const entered = window.prompt(
      'Tempel URL Google Apps Script Web App yang berakhir /exec.\n\nURL ini dipakai bersama oleh LiveChat dan REGC:',
      initial
    );
    if (entered == null) return;
    const value = String(entered).trim();
    if (!ltCombinedValidExecUrl(value)) {
      window.alert('URL belum valid. Harus berupa https://script.google.com/macros/s/.../exec');
      return;
    }
    GM_setValue(LT_COMBINED_WEBAPP_KEY, value);
    window.alert('URL /exec tersimpan. Reload tab LiveChat dan REGC agar konfigurasi aktif.');
  }

  try {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('LINETOGEL: Set Google Apps Script /exec', ltCombinedSetWebAppUrl);
      GM_registerMenuCommand('LINETOGEL: Lihat URL /exec aktif', function () {
        const current = ltCombinedGetWebAppUrl();
        window.alert(ltCombinedValidExecUrl(current) ? current : 'URL /exec belum dipasang.');
      });
    }
  } catch (e) {}

  const LT_COMBINED_WEBAPP_URL = ltCombinedGetWebAppUrl();

  // Sekali per tab: bila URL belum dipasang, beri petunjuk tanpa menghentikan UI utama.
  if (!ltCombinedValidExecUrl(LT_COMBINED_WEBAPP_URL)) {
    setTimeout(function () {
      try {
        const id = 'lt-combined-config-warning';
        if (document.getElementById(id) || !document.body) return;
        const box = document.createElement('div');
        box.id = id;
        box.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;background:#151515;color:#fff;border:1px solid #f0b429;border-radius:12px;padding:12px 14px;font:600 12px/1.45 Arial;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:340px';
        box.innerHTML = '<b style="color:#ffd166">AUTO SHEET/REGC BELUM TERHUBUNG</b><br>Pasang URL Apps Script <b>/exec</b> sekali lewat menu Tampermonkey:<br><b>LINETOGEL: Set Google Apps Script /exec</b>';
        document.body.appendChild(box);
        setTimeout(function(){ try { box.remove(); } catch(e){} }, 15000);
      } catch (e) {}
    }, 1500);
  }


  /**************** LIVECHAT MODULE ****************/
(function () {
    'use strict';

    if (location.hostname !== 'my.livechatinc.com') return;

    // Versi terbaru mengambil alih UI lama bila lebih dari satu versi tidak sengaja aktif.
    // Ini mencegah script lama memblokir perbaikan melalui guard boolean yang sama.
    const LCST_BUILD_VERSION = '5.9.5';
    const lcstExistingInstance = window.__LC_BUBBLE_SCREENSHOT_ACTIVE_ONLY__;
    if (lcstExistingInstance && typeof lcstExistingInstance === 'object' && lcstExistingInstance.version === LCST_BUILD_VERSION) return;
    try {
        const oldPanel = document.getElementById('lcst-panel-fixed');
        const oldBubble = document.getElementById('lcst-bubble-fixed');
        if (oldPanel) oldPanel.remove();
        if (oldBubble) oldBubble.remove();
    } catch (e) {}
    window.__LC_BUBBLE_SCREENSHOT_ACTIVE_ONLY__ = { version: LCST_BUILD_VERSION, startedAt: Date.now() };

    const POS_KEY = 'lc_bubble_screenshot_tool_position_active_only_v46_clean_final';
    const DB_KEY  = 'screenshot_tool_db_v1';
    const Z_TOP   = 2147483647;
    const LCST_DASHBOARD_LOGO_URL = 'https://line32170.com/assets/img/ei/logo.png';
    let lcstDashboardLogoDataUrl = '';
    let lcstDashboardLogoPromise = null;

    /******************************************************************
     * GOOGLE SHEET AUTO APPEND V1
     * Target spreadsheet: 1TxjwKCt1l3rsjDZqg7l4C7f3-naFXUDqYqe2ejjvN1s
     * Kolom tujuan: D:J (7 kolom)
     *
     * WAJIB: setelah Apps Script di-deploy sebagai Web App, ganti URL
     * LCST_SHEET_WEBAPP_URL di bawah dengan URL yang berakhir /exec.
     ******************************************************************/
    const LCST_SHEET_WEBAPP_URL = LT_COMBINED_WEBAPP_URL;
    const LCST_SHEET_SECRET = LT_COMBINED_SECRET;
    const LCST_SHEET_LAST_BATCH_KEY = 'lcst_sheet_last_success_batch_v581';
    const LCST_SHEET_TIMEOUT = 30000;

    let lastScan = { userId: 'user', marker: null, markerText: 'Tidak terdeteksi', images: [], allIds: [] };

    function ready(fn) {
        if (document.body) fn();
        else setTimeout(() => ready(fn), 150);
    }

    function cssEscapeText(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function safeJSONParse(v, fallback) {
        try { return JSON.parse(v); } catch (e) { return fallback; }
    }

    function injectStyle() {
        if (document.getElementById('lcst-style-active-only')) return;
        const style = document.createElement('style');
        style.id = 'lcst-style-active-only';
        style.textContent = `
            :root{
                --lcst-bg:#050816;
                --lcst-surface:rgba(13,19,38,.88);
                --lcst-surface-2:rgba(18,27,51,.82);
                --lcst-line:rgba(148,163,184,.16);
                --lcst-text:#eef6ff;
                --lcst-muted:#8fa3bf;
                --lcst-cyan:#22d3ee;
                --lcst-blue:#3b82f6;
                --lcst-violet:#8b5cf6;
                --lcst-green:#22c55e;
                --lcst-red:#fb4f68;
                --lcst-orange:#f5a524;
                --lcst-radius:18px;
            }
            #lcst-bubble-fixed{
                position:fixed;
                top:84px;
                right:24px;
                width:74px;
                height:74px;
                border-radius:24px;
                border:1px solid rgba(255,255,255,.18);
                background:linear-gradient(145deg,#13213d 0%,#090d1b 55%,#05070e 100%);
                color:#fff;
                z-index:${Z_TOP};
                cursor:grab;
                user-select:none;
                touch-action:none;
                display:flex;
                align-items:center;
                justify-content:center;
                flex-direction:column;
                gap:5px;
                padding:0;
                font-family:Inter,Segoe UI,Arial,sans-serif;
                box-shadow:0 20px 55px rgba(0,0,0,.58),0 0 0 1px rgba(34,211,238,.10),inset 0 1px 0 rgba(255,255,255,.18);
                overflow:hidden;
                transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;
            }
            #lcst-bubble-fixed:before{
                content:"";
                position:absolute;
                width:54px;
                height:54px;
                border-radius:50%;
                border:1px solid rgba(34,211,238,.28);
                box-shadow:0 0 25px rgba(34,211,238,.12),inset 0 0 20px rgba(59,130,246,.10);
                animation:lcstPulse 2.2s ease-in-out infinite;
            }
            #lcst-bubble-fixed:after{
                content:"";
                position:absolute;
                inset:-45%;
                background:conic-gradient(from 90deg,transparent 0 26%,rgba(34,211,238,.50) 34%,transparent 42% 65%,rgba(139,92,246,.45) 74%,transparent 83%);
                animation:lcstSpin 5.5s linear infinite;
                opacity:.62;
            }
            #lcst-bubble-fixed .lcst-icon{
                position:relative;
                z-index:2;
                width:23px;
                height:23px;
                border:2px solid #7eeeff;
                border-radius:8px;
                box-shadow:0 0 18px rgba(34,211,238,.42);
            }
            #lcst-bubble-fixed .lcst-icon:before{
                content:"";
                position:absolute;
                left:4px;
                top:4px;
                width:4px;
                height:4px;
                border-radius:50%;
                border:2px solid #ffbd59;
                box-shadow:9px 0 0 -2px #ffbd59;
            }
            #lcst-bubble-fixed .lcst-icon:after{
                content:"";
                position:absolute;
                left:4px;
                right:4px;
                bottom:4px;
                height:2px;
                border-radius:4px;
                background:linear-gradient(90deg,#22d3ee,#8b5cf6);
            }
            #lcst-bubble-fixed .lcst-text{
                position:relative;
                z-index:2;
                font-size:10px;
                line-height:1;
                font-weight:900;
                letter-spacing:1.5px;
                color:#dffbff;
            }
            #lcst-bubble-fixed:hover{
                transform:translateY(-3px) scale(1.035);
                border-color:rgba(34,211,238,.55);
                box-shadow:0 26px 65px rgba(0,0,0,.65),0 0 30px rgba(34,211,238,.20),inset 0 1px 0 rgba(255,255,255,.22);
            }
            #lcst-bubble-fixed.lcst-dragging{cursor:grabbing;transform:scale(1.04);opacity:.94}
            @keyframes lcstSpin{to{transform:rotate(360deg)}}
            @keyframes lcstPulse{0%,100%{transform:scale(.92);opacity:.55}50%{transform:scale(1.08);opacity:1}}
            @keyframes lcstBlink{0%,100%{opacity:.45}50%{opacity:1}}

            #lcst-panel-fixed{
                position:fixed;
                inset:0;
                z-index:${Z_TOP - 1};
                color:var(--lcst-text);
                font:13px/1.45 Inter,Segoe UI,Arial,sans-serif;
                overflow:auto;
                padding:20px;
                box-sizing:border-box;
                background:
                    radial-gradient(circle at 7% 5%,rgba(59,130,246,.20),transparent 28%),
                    radial-gradient(circle at 92% 8%,rgba(139,92,246,.18),transparent 24%),
                    radial-gradient(circle at 50% 100%,rgba(34,211,238,.10),transparent 35%),
                    linear-gradient(180deg,#060918 0%,#03050d 100%);
                backdrop-filter:blur(12px);
            }
            #lcst-panel-fixed:before{
                content:"";
                position:fixed;
                inset:0;
                pointer-events:none;
                opacity:.22;
                background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);
                background-size:32px 32px;
            }
            #lcst-panel-fixed *{box-sizing:border-box}
            #lcst-panel-fixed button,#lcst-panel-fixed input,#lcst-panel-fixed textarea{font-family:inherit}
            /* Paksa teks dashboard tetap dapat diseleksi/copy, termasuk saat OCR berjalan. */
            #lcst-panel-fixed,#lcst-panel-fixed .lcst-wrap,#lcst-panel-fixed section,#lcst-panel-fixed div,#lcst-panel-fixed span,#lcst-panel-fixed b,#lcst-panel-fixed textarea,#lcst-panel-fixed input{
                -webkit-user-select:text!important;user-select:text!important
            }
            #lcst-panel-fixed button,#lcst-panel-fixed img,#lcst-panel-fixed .lcst-img-card,#lcst-panel-fixed .lcst-brand-logo,#lcst-panel-fixed .lcst-status-icon,#lcst-panel-fixed .lcst-progress{
                -webkit-user-select:none!important;user-select:none!important
            }
            .lcst-wrap{position:relative;max-width:1480px;margin:0 auto}
            .lcst-topbar{
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:18px;
                margin-bottom:16px;
                padding:16px 18px;
                border:1px solid var(--lcst-line);
                border-radius:22px;
                background:linear-gradient(135deg,rgba(20,30,56,.90),rgba(8,12,27,.84));
                box-shadow:0 20px 55px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.05);
            }
            .lcst-brand{display:flex;align-items:center;gap:13px;min-width:0}
            .lcst-brand-logo{
                width:46px;height:46px;border-radius:15px;display:grid;place-items:center;flex:0 0 auto;
                background:linear-gradient(145deg,rgba(34,211,238,.24),rgba(139,92,246,.22));
                border:1px solid rgba(126,238,255,.26);box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 12px 24px rgba(0,0,0,.25)
            }
            .lcst-brand-logo span{font-size:20px;filter:drop-shadow(0 0 10px rgba(34,211,238,.65))}
            .lcst-title{margin:0;font-size:18px;font-weight:900;letter-spacing:.2px;color:#f7fbff}
            .lcst-subtitle{margin-top:3px;color:var(--lcst-muted);font-size:11px;letter-spacing:.35px}
            .lcst-version{display:inline-flex;margin-left:8px;padding:3px 7px;border-radius:999px;background:rgba(34,211,238,.12);color:#8ff3ff;border:1px solid rgba(34,211,238,.18);font-size:9px;vertical-align:middle}
            .lcst-actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}
            .lcst-btn{
                border:1px solid rgba(255,255,255,.10);
                border-radius:12px;
                padding:10px 14px;
                cursor:pointer;
                color:#fff;
                background:linear-gradient(180deg,#263552,#18223a);
                font-size:11px;
                font-weight:900;
                letter-spacing:.25px;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 8px 18px rgba(0,0,0,.18);
                transition:transform .15s ease,filter .15s ease,border-color .15s ease;
            }
            .lcst-btn:hover{filter:brightness(1.12);transform:translateY(-1px);border-color:rgba(255,255,255,.22)}
            .lcst-btn:active{transform:translateY(0)}
            .lcst-btn:disabled{opacity:.48;cursor:not-allowed;filter:grayscale(.35);transform:none}
            .lcst-btn.green{background:linear-gradient(135deg,#14a65a,#08763c);border-color:rgba(74,222,128,.28)}
            .lcst-btn.blue{background:linear-gradient(135deg,#2585f4,#3154d8);border-color:rgba(96,165,250,.30)}
            .lcst-btn.red{background:linear-gradient(135deg,#ed4662,#b91c42);border-color:rgba(251,113,133,.30)}
            .lcst-btn.orange{background:linear-gradient(135deg,#f59e0b,#b45309);border-color:rgba(251,191,36,.32)}
            .lcst-btn.primary{padding:12px 18px;background:linear-gradient(135deg,#06b6d4,#2563eb 55%,#7c3aed);border-color:rgba(125,211,252,.35);box-shadow:0 14px 28px rgba(37,99,235,.22),inset 0 1px 0 rgba(255,255,255,.18)}

            .lcst-status-card{
                position:relative;overflow:hidden;display:flex;align-items:flex-start;gap:12px;padding:13px 15px;margin-bottom:13px;
                border-radius:17px;border:1px solid rgba(34,211,238,.18);background:linear-gradient(135deg,rgba(7,26,42,.90),rgba(12,16,34,.86));
                box-shadow:0 14px 32px rgba(0,0,0,.20)
            }
            .lcst-status-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex:0 0 auto;background:rgba(34,211,238,.10);border:1px solid rgba(34,211,238,.18)}
            .lcst-status-dot{width:9px;height:9px;border-radius:50%;background:#22d3ee;box-shadow:0 0 14px rgba(34,211,238,.9);animation:lcstBlink 1.4s ease-in-out infinite}
            .lcst-status-content{min-width:0;flex:1}
            .lcst-status-title{font-size:10px;font-weight:900;letter-spacing:1px;color:#7eeeff;text-transform:uppercase;margin-bottom:3px}
            .lcst-ocr-box{font-size:12px;line-height:1.5;color:#d8ebff}
            .lcst-scan-state{
                min-width:190px;min-height:54px;display:flex;align-items:center;gap:11px;flex:0 0 auto;
                padding:10px 13px;border-radius:14px;border:1px solid rgba(148,163,184,.18);
                background:linear-gradient(145deg,rgba(15,23,42,.90),rgba(5,10,24,.88));
                box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 10px 24px rgba(0,0,0,.16);
                transition:border-color .18s ease,background .18s ease,box-shadow .18s ease
            }
            .lcst-scan-state-dot{
                width:12px;height:12px;border-radius:50%;flex:0 0 auto;background:#64748b;
                box-shadow:0 0 0 5px rgba(100,116,139,.10),0 0 15px rgba(100,116,139,.28)
            }
            .lcst-scan-state-copy{min-width:0}
            .lcst-scan-state-label{
                display:block;margin-bottom:3px;color:#7f91ad;font-size:9px;font-weight:900;
                letter-spacing:1px;text-transform:uppercase
            }
            .lcst-scan-state-text{
                display:block;color:#c9d4e5;font-size:12px;font-weight:1000;letter-spacing:.25px;white-space:nowrap
            }
            .lcst-scan-state-detail{
                display:block;margin-top:2px;color:#7387a6;font-size:9px;font-weight:700;white-space:nowrap
            }
            .lcst-scan-state.waiting{border-color:rgba(96,165,250,.20)}
            .lcst-scan-state.waiting .lcst-scan-state-dot{
                background:#60a5fa;box-shadow:0 0 0 5px rgba(96,165,250,.10),0 0 15px rgba(96,165,250,.42)
            }
            .lcst-scan-state.waiting .lcst-scan-state-text{color:#bfdbfe}
            .lcst-scan-state.scanning{
                border-color:rgba(34,211,238,.35);
                background:linear-gradient(145deg,rgba(5,47,64,.72),rgba(6,18,38,.90));
                box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 25px rgba(34,211,238,.10)
            }
            .lcst-scan-state.scanning .lcst-scan-state-dot{
                background:#22d3ee;box-shadow:0 0 0 5px rgba(34,211,238,.11),0 0 18px rgba(34,211,238,.80);
                animation:lcstBlink 1s ease-in-out infinite
            }
            .lcst-scan-state.scanning .lcst-scan-state-text{color:#7eeeff}
            .lcst-scan-state.success{
                border-color:rgba(34,197,94,.34);
                background:linear-gradient(145deg,rgba(7,67,38,.68),rgba(5,24,27,.90));
                box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 25px rgba(34,197,94,.10)
            }
            .lcst-scan-state.success .lcst-scan-state-dot{
                background:#22c55e;box-shadow:0 0 0 5px rgba(34,197,94,.11),0 0 18px rgba(34,197,94,.68)
            }
            .lcst-scan-state.success .lcst-scan-state-text{color:#91f5b7}
            .lcst-scan-state.partial{
                border-color:rgba(245,158,11,.34);
                background:linear-gradient(145deg,rgba(92,51,8,.60),rgba(28,20,16,.90))
            }
            .lcst-scan-state.partial .lcst-scan-state-dot{
                background:#f59e0b;box-shadow:0 0 0 5px rgba(245,158,11,.11),0 0 18px rgba(245,158,11,.55)
            }
            .lcst-scan-state.partial .lcst-scan-state-text{color:#ffd58e}
            .lcst-scan-state.failed{
                border-color:rgba(251,79,104,.34);
                background:linear-gradient(145deg,rgba(76,15,35,.65),rgba(28,12,25,.90))
            }
            .lcst-scan-state.failed .lcst-scan-state-dot{
                background:#fb4f68;box-shadow:0 0 0 5px rgba(251,79,104,.11),0 0 18px rgba(251,79,104,.55)
            }
            .lcst-scan-state.failed .lcst-scan-state-text{color:#ffb7c5}
            .lcst-account-scan-state{
                width:100%;
                min-width:0;
                min-height:58px;
                margin-top:10px;
                justify-content:flex-start;
            }
            .lcst-progress{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.04)}
            .lcst-progress span{display:block;height:100%;width:0;background:linear-gradient(90deg,#22d3ee,#3b82f6,#8b5cf6);box-shadow:0 0 14px rgba(34,211,238,.65);transition:width .25s ease}

            .lcst-card{
                background:linear-gradient(155deg,rgba(17,25,47,.88),rgba(7,11,24,.88));
                border:1px solid var(--lcst-line);
                border-radius:var(--lcst-radius);
                padding:15px;
                margin-bottom:13px;
                box-shadow:0 15px 38px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.035)
            }
            .lcst-grid2{display:grid;grid-template-columns:1fr 1fr;gap:13px}
            .lcst-info-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
            .lcst-info-group{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
            .lcst-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:900;border:1px solid rgba(255,255,255,.10);background:rgba(15,23,42,.72);color:#d8e6f8}
            .lcst-pill.blue{background:rgba(8,47,73,.62);color:#86efff;border-color:rgba(34,211,238,.20)}
            .lcst-pill.red{background:rgba(76,15,35,.62);color:#ffb7c5;border-color:rgba(251,79,104,.25)}
            .lcst-pill.green{background:rgba(7,67,38,.58);color:#91f5b7;border-color:rgba(34,197,94,.24)}
            .lcst-inline-copy{
                width:24px;height:24px;display:inline-grid;place-items:center;flex:0 0 auto;margin:-3px -4px -3px 1px;
                padding:0;border-radius:8px;border:1px solid rgba(126,238,255,.18);
                color:#9af4ff;background:rgba(3,18,31,.46);cursor:pointer;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
                transition:background .14s ease,border-color .14s ease,transform .14s ease,color .14s ease
            }
            .lcst-inline-copy:hover{background:rgba(34,211,238,.14);border-color:rgba(34,211,238,.42);transform:translateY(-1px)}
            .lcst-inline-copy:active{transform:translateY(0)}
            .lcst-inline-copy svg{width:13px;height:13px;display:block;pointer-events:none}
            .lcst-inline-copy.copied{color:#91f5b7;background:rgba(7,67,38,.58);border-color:rgba(34,197,94,.34)}
            .lcst-field-title{display:flex;align-items:center;gap:8px;font-weight:900;margin-bottom:9px;color:#b9f7ff;font-size:10px;letter-spacing:.8px;text-transform:uppercase}
            .lcst-field-title:before{content:"";width:7px;height:7px;border-radius:3px;background:linear-gradient(135deg,#22d3ee,#3b82f6)}
            .lcst-field-title.orange{color:#ffd58e}
            .lcst-field-title.orange:before{background:linear-gradient(135deg,#fbbf24,#f97316)}
            .lcst-input{
                width:100%;padding:11px 12px;border-radius:12px;border:1px solid rgba(126,238,255,.18);
                background:rgba(3,7,18,.78);color:#f4f9ff;outline:none;margin-bottom:9px;font-size:12px;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.025);transition:border-color .15s ease,box-shadow .15s ease,background .15s ease
            }
            .lcst-input:focus{border-color:rgba(34,211,238,.62);box-shadow:0 0 0 3px rgba(34,211,238,.08);background:rgba(5,10,24,.92)}
            .lcst-note{display:flex;gap:14px;align-items:center;justify-content:space-between}
            .lcst-hints{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
            .lcst-hint{padding:6px 9px;border-radius:9px;background:rgba(15,23,42,.68);border:1px solid rgba(148,163,184,.12);color:#9eb0c7;font-size:10px}
            .lcst-hint.strong{color:#8ff3ff;border-color:rgba(34,211,238,.20);background:rgba(8,47,73,.40);font-weight:900}
            .lcst-hint.copy-ready{color:#9ff7bd;border-color:rgba(34,197,94,.22);background:rgba(7,67,38,.38);font-weight:900}
            .lcst-copy-btn{min-width:112px}
            .lcst-copy-btn.copied{background:linear-gradient(135deg,#16a34a,#047857);box-shadow:0 0 0 3px rgba(34,197,94,.10),0 10px 22px rgba(0,0,0,.20)}

            #lcst-image-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-bottom:14px}
            .lcst-img-card{position:relative;background:linear-gradient(160deg,rgba(15,23,42,.94),rgba(4,7,16,.96));border:1px solid rgba(148,163,184,.15);border-radius:17px;overflow:hidden;cursor:grab;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
            .lcst-img-card:hover{border-color:rgba(34,211,238,.45);transform:translateY(-2px);box-shadow:0 18px 36px rgba(0,0,0,.28),0 0 0 1px rgba(34,211,238,.05)}
            .lcst-img-card.target{border-color:rgba(245,165,36,.30)}
            .lcst-img-card.dragging{opacity:.42;border:1px dashed #fb4f68;transform:scale(.98)}
            .lcst-img-card.over{border-color:#22c55e;background:#0b2117}
            .lcst-img-media{position:relative;background:#02040a;overflow:hidden}
            .lcst-img-card img{display:block;width:100%;height:250px;object-fit:contain;background:#02040a;cursor:zoom-in;transition:transform .2s ease}
            .lcst-img-card:hover img{transform:scale(1.012)}
            .lcst-img-index{position:absolute;top:9px;left:9px;z-index:2;display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:9px;background:rgba(3,7,18,.82);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.12);font-size:9px;font-weight:900;color:#eef7ff}
            .lcst-target-tag{color:#ffd58e}
            .lcst-del{position:absolute;top:9px;right:9px;width:30px;height:30px;border:1px solid rgba(251,113,133,.28);border-radius:10px;background:rgba(190,24,60,.88);color:#fff;font-weight:900;cursor:pointer;display:none;z-index:4;box-shadow:0 8px 20px rgba(0,0,0,.30)}
            .lcst-img-card:hover .lcst-del{display:block}
            .lcst-img-label{padding:9px 10px 7px;color:#7f93af;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-top:1px solid rgba(255,255,255,.04)}
            .lcst-ocr-badge{margin:0 9px 9px;padding:8px 9px;border-radius:10px;background:rgba(6,45,65,.66);color:#8ff3ff;border:1px solid rgba(34,211,238,.16);font-size:10px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .lcst-ocr-badge.success{background:rgba(7,68,39,.58);color:#91f5b7;border-color:rgba(34,197,94,.22)}
            .lcst-ocr-badge.error{background:rgba(83,17,35,.56);color:#ffb2c0;border-color:rgba(251,79,104,.24)}
            .lcst-ocr-badge.empty{background:rgba(31,41,55,.66);color:#8fa3bf;border-color:rgba(148,163,184,.12)}
            .lcst-empty{padding:26px;border:1px dashed rgba(251,113,133,.30);border-radius:17px;color:#ffbec9;background:rgba(61,10,27,.38);text-align:center;margin-bottom:14px}

            .lcst-output-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap}
            #lcst-output{width:100%;height:132px;background:rgba(2,6,15,.86);color:#7ef6a4;border:1px solid rgba(74,222,128,.16);border-radius:13px;padding:12px;font:11px/1.5 Consolas,Monaco,monospace;margin-bottom:10px;resize:vertical;outline:none}
            #lcst-output:focus{border-color:rgba(74,222,128,.38);box-shadow:0 0 0 3px rgba(34,197,94,.06)}
            #lcst-zoom{position:fixed;inset:0;z-index:${Z_TOP};background:rgba(1,3,8,.97);display:flex;align-items:center;justify-content:center;flex-direction:column;backdrop-filter:blur(10px)}
            #lcst-zoom img{max-width:92%;max-height:84%;object-fit:contain;cursor:move;transition:transform .05s;border-radius:12px;box-shadow:0 25px 80px rgba(0,0,0,.68)}
            .lcst-zoom-help{position:absolute;bottom:20px;padding:8px 11px;border-radius:10px;background:rgba(15,23,42,.72);border:1px solid rgba(255,255,255,.10);color:#9aacc3;font-size:10px}

            /* =========================================================
               PATEN TURBO UI — hanya tampilan, tidak menyentuh workflow
               ========================================================= */
            #lcst-panel-fixed{
                background:
                    radial-gradient(circle at 9% 3%,rgba(14,165,233,.22),transparent 30%),
                    radial-gradient(circle at 91% 5%,rgba(124,58,237,.20),transparent 27%),
                    radial-gradient(circle at 50% 105%,rgba(245,158,11,.10),transparent 34%),
                    linear-gradient(145deg,#020617 0%,#071123 48%,#030712 100%);
            }
            #lcst-panel-fixed:after{
                content:"";position:fixed;inset:0;pointer-events:none;opacity:.20;
                background:
                    linear-gradient(115deg,transparent 0 44%,rgba(255,255,255,.025) 50%,transparent 56%),
                    radial-gradient(circle at 50% 0,rgba(255,255,255,.035),transparent 45%);
            }
            .lcst-wrap{max-width:1540px}
            .lcst-topbar{
                position:sticky;top:0;z-index:20;
                border-radius:20px;
                border-color:rgba(125,211,252,.18);
                background:linear-gradient(135deg,rgba(13,28,55,.96),rgba(5,10,25,.94));
                box-shadow:0 22px 60px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.09);
                backdrop-filter:blur(18px) saturate(145%);
            }
            .lcst-brand-logo{
                position:relative;overflow:hidden;width:50px;height:50px;border-radius:16px;
                background:linear-gradient(145deg,rgba(14,165,233,.30),rgba(79,70,229,.25) 55%,rgba(245,158,11,.16));
                border-color:rgba(125,211,252,.35);
                box-shadow:0 13px 30px rgba(2,132,199,.18),inset 0 1px 0 rgba(255,255,255,.18);
            }
            .lcst-brand-logo:after{
                content:"";position:absolute;inset:-60%;
                background:conic-gradient(from 0deg,transparent,rgba(125,211,252,.55),transparent 28%);
                animation:lcstSpin 5s linear infinite;
            }
            .lcst-brand-logo span{position:relative;z-index:2;font-size:23px;color:#c6f7ff}
            .lcst-title{font-size:19px;letter-spacing:.35px;text-shadow:0 0 22px rgba(56,189,248,.16)}
            .lcst-version{
                margin-left:10px;padding:4px 9px;
                background:linear-gradient(135deg,rgba(6,182,212,.18),rgba(79,70,229,.22));
                border-color:rgba(103,232,249,.27);color:#a5f3fc;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.07);
            }
            .lcst-status-card{
                min-height:78px;border-radius:20px;
                border-color:rgba(56,189,248,.22);
                background:linear-gradient(125deg,rgba(4,35,58,.92),rgba(13,18,42,.94) 58%,rgba(34,18,54,.88));
                box-shadow:0 18px 44px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.06);
            }
            .lcst-status-card:after{
                content:"";position:absolute;top:0;bottom:0;width:110px;left:-140px;
                background:linear-gradient(90deg,transparent,rgba(125,211,252,.08),transparent);
                transform:skewX(-18deg);animation:lcstStatusSweep 4.8s ease-in-out infinite;
            }
            @keyframes lcstStatusSweep{0%,55%{left:-140px}100%{left:calc(100% + 140px)}}
            .lcst-status-icon{
                width:40px;height:40px;border-radius:13px;
                background:linear-gradient(145deg,rgba(6,182,212,.17),rgba(37,99,235,.12));
                border-color:rgba(103,232,249,.28);
                box-shadow:0 10px 22px rgba(2,132,199,.12),inset 0 1px 0 rgba(255,255,255,.08);
            }
            .lcst-card{
                border-radius:20px;padding:17px;
                border-color:rgba(148,163,184,.14);
                background:linear-gradient(145deg,rgba(14,24,48,.91),rgba(5,10,24,.92));
                box-shadow:0 17px 42px rgba(0,0,0,.27),inset 0 1px 0 rgba(255,255,255,.045);
            }
            .lcst-card:hover{border-color:rgba(125,211,252,.20)}
            .lcst-pill{
                padding:7px 11px;border-radius:11px;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.045);
            }
            .lcst-input{
                min-height:43px;border-radius:13px;
                background:linear-gradient(180deg,rgba(2,6,23,.90),rgba(5,12,29,.88));
                border-color:rgba(125,211,252,.18);
                box-shadow:inset 0 2px 9px rgba(0,0,0,.24),0 1px 0 rgba(255,255,255,.025);
            }
            .lcst-input:focus{
                border-color:rgba(34,211,238,.68);
                box-shadow:0 0 0 3px rgba(34,211,238,.09),0 12px 30px rgba(0,0,0,.18);
            }
            .lcst-scan-state{
                border-radius:16px;
                box-shadow:0 13px 28px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.05);
            }
            .lcst-btn{
                border-radius:13px;padding:11px 15px;
                box-shadow:0 11px 24px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.14);
            }
            .lcst-btn.primary{
                position:relative;overflow:hidden;min-width:180px;
                background:linear-gradient(125deg,#0891b2 0%,#2563eb 47%,#6d28d9 100%);
                box-shadow:0 16px 36px rgba(37,99,235,.29),inset 0 1px 0 rgba(255,255,255,.22);
            }
            .lcst-btn.primary:before{
                content:"";position:absolute;inset:0;transform:translateX(-115%);
                background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.22),transparent 70%);
                transition:transform .42s ease;
            }
            .lcst-btn.primary:hover:before{transform:translateX(115%)}
            #lcst-image-grid{gap:15px}
            .lcst-img-card{
                border-radius:20px;
                background:linear-gradient(155deg,rgba(13,24,48,.96),rgba(2,6,17,.98));
                box-shadow:0 16px 36px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.035);
            }
            .lcst-img-card.target{
                border-color:rgba(245,158,11,.48);
                box-shadow:0 17px 40px rgba(0,0,0,.31),0 0 0 1px rgba(245,158,11,.08),inset 0 1px 0 rgba(255,255,255,.04);
            }
            .lcst-img-card.target .lcst-img-index{
                background:linear-gradient(135deg,rgba(120,53,15,.90),rgba(69,26,3,.88));
                border-color:rgba(251,191,36,.30);color:#fff7d6;
            }
            .lcst-img-card img{height:270px}
            .lcst-ocr-badge{border-radius:11px;padding:9px 10px}
            #lcst-output{
                min-height:145px;border-radius:15px;
                background:linear-gradient(180deg,rgba(1,7,16,.94),rgba(2,13,18,.92));
                box-shadow:inset 0 2px 12px rgba(0,0,0,.30);
            }


            /* =========================================================
               PATEN LUXE UI V5.5.3
               Hanya visual dashboard + bubble. Workflow tidak disentuh.
               ========================================================= */
            :root{
                --lcst-bg:#020611;
                --lcst-surface:rgba(8,16,34,.90);
                --lcst-surface-2:rgba(13,24,49,.86);
                --lcst-line:rgba(125,211,252,.15);
                --lcst-text:#f3f8ff;
                --lcst-muted:#91a7c5;
                --lcst-cyan:#37e6ff;
                --lcst-blue:#4f8cff;
                --lcst-violet:#9b6cff;
                --lcst-green:#36e79a;
                --lcst-red:#ff5578;
                --lcst-orange:#ffbd59;
                --lcst-radius:22px;
            }

            /* Bubble scanner baru */
            #lcst-bubble-fixed{
                width:82px;
                height:82px;
                border-radius:27px;
                gap:2px;
                border:1px solid rgba(130,230,255,.38);
                background:
                    radial-gradient(circle at 30% 18%,rgba(85,224,255,.25),transparent 34%),
                    linear-gradient(145deg,#12294c 0%,#071326 48%,#040914 100%);
                box-shadow:
                    0 23px 55px rgba(0,0,0,.58),
                    0 0 0 1px rgba(62,217,255,.08),
                    0 0 30px rgba(43,194,255,.15),
                    inset 0 1px 0 rgba(255,255,255,.22),
                    inset 0 -12px 28px rgba(0,0,0,.24);
                isolation:isolate;
            }
            #lcst-bubble-fixed:before{
                content:"";
                position:absolute;
                inset:5px;
                width:auto;
                height:auto;
                border-radius:22px;
                border:1px solid rgba(255,255,255,.11);
                background:linear-gradient(150deg,rgba(255,255,255,.07),transparent 42%);
                box-shadow:inset 0 0 24px rgba(45,212,255,.06);
                animation:lcstBubbleBreathe 2.8s ease-in-out infinite;
                z-index:0;
            }
            #lcst-bubble-fixed:after{
                content:"";
                position:absolute;
                inset:-70%;
                background:conic-gradient(
                    from 0deg,
                    transparent 0 18%,
                    rgba(55,230,255,.72) 24%,
                    transparent 31% 56%,
                    rgba(155,108,255,.60) 63%,
                    transparent 71% 100%
                );
                opacity:.50;
                animation:lcstBubbleOrbit 7s linear infinite;
                z-index:-1;
            }
            #lcst-bubble-fixed:hover{
                transform:translateY(-4px) scale(1.055);
                border-color:rgba(105,235,255,.72);
                box-shadow:
                    0 29px 68px rgba(0,0,0,.64),
                    0 0 0 1px rgba(82,224,255,.15),
                    0 0 42px rgba(39,203,255,.28),
                    inset 0 1px 0 rgba(255,255,255,.28);
            }
            #lcst-bubble-fixed.lcst-dragging{
                cursor:grabbing;
                transform:scale(1.065);
                opacity:.96;
            }
            .lcst-bubble-aura{
                position:absolute;
                inset:13px;
                border-radius:18px;
                border:1px solid rgba(82,220,255,.16);
                box-shadow:0 0 20px rgba(45,212,255,.09),inset 0 0 16px rgba(93,103,255,.07);
                pointer-events:none;
                z-index:1;
            }
            .lcst-bubble-core{
                position:relative;
                z-index:3;
                width:39px;
                height:39px;
                display:grid;
                place-items:center;
                border-radius:14px;
                color:#dffbff;
                background:linear-gradient(145deg,rgba(18,55,91,.88),rgba(8,18,39,.92));
                border:1px solid rgba(110,232,255,.34);
                box-shadow:0 10px 22px rgba(0,0,0,.25),0 0 18px rgba(55,230,255,.12),inset 0 1px 0 rgba(255,255,255,.14);
                overflow:hidden;
                pointer-events:none;
            }
            .lcst-bubble-scan-icon{
                width:27px;
                height:27px;
                stroke:currentColor;
                stroke-width:1.8;
                stroke-linecap:round;
                stroke-linejoin:round;
                filter:drop-shadow(0 0 6px rgba(55,230,255,.52));
            }
            .lcst-bubble-laser{
                position:absolute;
                left:7px;
                right:7px;
                height:1.5px;
                top:10px;
                border-radius:2px;
                background:linear-gradient(90deg,transparent,#62f4ff 22% 78%,transparent);
                box-shadow:0 0 7px rgba(98,244,255,.95);
                animation:lcstBubbleLaser 1.85s ease-in-out infinite;
            }
            .lcst-bubble-label{
                position:relative;
                z-index:3;
                margin-top:2px;
                font-size:9px;
                line-height:1;
                font-weight:1000;
                letter-spacing:1.8px;
                color:#d9faff;
                text-shadow:0 0 10px rgba(55,230,255,.48);
                pointer-events:none;
            }
            .lcst-bubble-live{
                position:absolute;
                z-index:4;
                right:10px;
                top:10px;
                width:8px;
                height:8px;
                border-radius:50%;
                background:#42f5a7;
                border:2px solid #081426;
                box-shadow:0 0 11px rgba(66,245,167,.88);
                animation:lcstBubbleLive 1.8s ease-in-out infinite;
                pointer-events:none;
            }
            @keyframes lcstBubbleOrbit{to{transform:rotate(360deg)}}
            @keyframes lcstBubbleBreathe{0%,100%{opacity:.72}50%{opacity:1}}
            @keyframes lcstBubbleLaser{0%,100%{transform:translateY(0);opacity:.48}50%{transform:translateY(17px);opacity:1}}
            @keyframes lcstBubbleLive{0%,100%{transform:scale(.84);opacity:.68}50%{transform:scale(1.12);opacity:1}}

            /* Latar dashboard */
            #lcst-panel-fixed{
                padding:22px;
                background:
                    radial-gradient(circle at 8% 0%,rgba(24,156,255,.22),transparent 29%),
                    radial-gradient(circle at 94% 3%,rgba(126,66,255,.20),transparent 27%),
                    radial-gradient(circle at 50% 108%,rgba(43,215,190,.10),transparent 35%),
                    linear-gradient(150deg,#020611 0%,#071226 48%,#030712 100%);
            }
            #lcst-panel-fixed:before{
                display:block;
                opacity:.22;
                background-image:
                    radial-gradient(circle,rgba(129,225,255,.20) 1px,transparent 1.4px),
                    linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),
                    linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);
                background-size:30px 30px,60px 60px,60px 60px;
                background-position:0 0,0 0,0 0;
                mask-image:linear-gradient(to bottom,rgba(0,0,0,.72),transparent 86%);
            }
            #lcst-panel-fixed:after{
                content:"";
                position:fixed;
                inset:0;
                pointer-events:none;
                opacity:.28;
                background:
                    linear-gradient(115deg,transparent 0 44%,rgba(255,255,255,.028) 50%,transparent 56%),
                    radial-gradient(ellipse at 50% -15%,rgba(104,223,255,.10),transparent 55%);
            }
            .lcst-wrap{max-width:1540px}

            /* Header premium */
            .lcst-topbar{
                position:sticky;
                top:0;
                z-index:20;
                min-height:76px;
                padding:14px 17px 14px 15px;
                border-radius:23px;
                border:1px solid rgba(110,222,255,.20);
                background:
                    linear-gradient(115deg,rgba(15,38,70,.96),rgba(7,16,35,.96) 54%,rgba(28,15,56,.92));
                box-shadow:
                    0 24px 64px rgba(0,0,0,.42),
                    0 0 0 1px rgba(255,255,255,.025),
                    inset 0 1px 0 rgba(255,255,255,.10);
                backdrop-filter:blur(20px) saturate(145%);
                overflow:hidden;
            }
            .lcst-topbar:before{
                content:"";
                position:absolute;
                left:4%;right:4%;top:0;height:1px;
                background:linear-gradient(90deg,transparent,rgba(100,235,255,.72),rgba(166,120,255,.58),transparent);
                box-shadow:0 0 18px rgba(65,215,255,.36);
            }
            .lcst-topbar:after{
                content:"";
                position:absolute;
                width:230px;height:230px;
                right:-105px;top:-135px;
                border-radius:50%;
                background:radial-gradient(circle,rgba(146,86,255,.18),transparent 68%);
                pointer-events:none;
            }
            .lcst-brand{gap:14px;position:relative;z-index:2}
            .lcst-brand-logo{
                width:51px;
                height:51px;
                border-radius:17px;
                background:
                    radial-gradient(circle at 28% 20%,rgba(108,239,255,.30),transparent 34%),
                    linear-gradient(145deg,rgba(16,76,116,.82),rgba(23,31,83,.82));
                border:1px solid rgba(115,232,255,.38);
                box-shadow:0 13px 30px rgba(0,105,180,.20),0 0 24px rgba(55,230,255,.10),inset 0 1px 0 rgba(255,255,255,.18);
                overflow:hidden;
            }
            .lcst-brand-logo:before{
                content:"";
                position:absolute;
                inset:5px;
                border-radius:13px;
                border:1px solid rgba(255,255,255,.08);
                background:linear-gradient(150deg,rgba(255,255,255,.08),transparent 48%);
            }
            .lcst-brand-logo:after{
                content:"";
                position:absolute;
                inset:-70%;
                background:conic-gradient(from 30deg,transparent,rgba(67,225,255,.55),transparent 28%,transparent 72%,rgba(148,91,255,.48),transparent);
                animation:lcstSpin 6.5s linear infinite;
                opacity:.62;
            }
            .lcst-brand-logo svg{
                position:relative;
                z-index:3;
                width:34px;
                height:34px;
                stroke:#dffbff;
                stroke-width:2;
                stroke-linecap:round;
                stroke-linejoin:round;
                filter:drop-shadow(0 0 8px rgba(68,226,255,.55));
            }
            .lcst-title{
                font-size:19px;
                font-weight:1000;
                letter-spacing:.35px;
                color:#f5fbff;
                text-shadow:0 0 20px rgba(77,220,255,.15);
            }
            .lcst-version{
                margin-left:10px;
                padding:4px 9px;
                border-radius:999px;
                background:linear-gradient(135deg,rgba(34,211,238,.16),rgba(92,72,255,.22));
                border:1px solid rgba(112,232,255,.25);
                color:#bff8ff;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 18px rgba(58,210,255,.06);
            }

            /* Status dan panel */
            .lcst-status-card{
                min-height:78px;
                padding:15px 17px;
                border-radius:21px;
                border:1px solid rgba(69,218,255,.20);
                background:
                    linear-gradient(120deg,rgba(5,42,68,.91),rgba(9,18,40,.94) 52%,rgba(38,17,62,.87));
                box-shadow:0 18px 46px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.065);
            }
            .lcst-status-icon{
                width:42px;
                height:42px;
                border-radius:14px;
                background:linear-gradient(145deg,rgba(36,208,244,.18),rgba(68,78,255,.13));
                border:1px solid rgba(100,230,255,.27);
                box-shadow:0 11px 24px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.10);
            }
            .lcst-status-title{font-size:9px;letter-spacing:1.35px;color:#86efff}
            .lcst-ocr-box{font-size:12px;color:#e1f1ff}
            .lcst-progress{height:3px;background:rgba(255,255,255,.035)}
            .lcst-progress span{
                background:linear-gradient(90deg,#35edff,#4f8cff 52%,#9c6cff);
                box-shadow:0 0 16px rgba(55,230,255,.72);
            }
            .lcst-card{
                position:relative;
                border-radius:22px;
                padding:17px;
                border:1px solid rgba(143,184,224,.13);
                background:
                    linear-gradient(150deg,rgba(13,27,53,.91),rgba(5,12,28,.93));
                box-shadow:0 18px 44px rgba(0,0,0,.27),inset 0 1px 0 rgba(255,255,255,.045);
                overflow:hidden;
            }
            .lcst-card:before{
                content:"";
                position:absolute;
                left:16px;right:16px;top:0;height:1px;
                background:linear-gradient(90deg,transparent,rgba(118,224,255,.18),transparent);
                pointer-events:none;
            }
            .lcst-card:hover{
                border-color:rgba(95,220,255,.22);
                box-shadow:0 20px 48px rgba(0,0,0,.30),0 0 0 1px rgba(55,230,255,.025),inset 0 1px 0 rgba(255,255,255,.055);
            }
            .lcst-field-title{
                color:#bff8ff;
                letter-spacing:1px;
            }
            .lcst-field-title:before{
                width:8px;height:8px;border-radius:3px;
                background:linear-gradient(135deg,#45efff,#5d7cff);
                box-shadow:0 0 10px rgba(69,239,255,.45);
            }
            .lcst-field-title.orange:before{
                background:linear-gradient(135deg,#ffd36b,#ff8a4c);
                box-shadow:0 0 10px rgba(255,177,76,.36);
            }
            .lcst-pill{
                padding:7px 10px;
                border-radius:11px;
                background:linear-gradient(145deg,rgba(17,31,58,.80),rgba(8,17,35,.80));
                border:1px solid rgba(148,188,224,.13);
                box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
            }
            .lcst-pill.blue{background:linear-gradient(145deg,rgba(7,55,78,.68),rgba(8,29,54,.72));border-color:rgba(55,230,255,.20)}
            .lcst-pill.green{background:linear-gradient(145deg,rgba(7,65,46,.64),rgba(4,35,34,.72));border-color:rgba(54,231,154,.21)}
            .lcst-pill.red{background:linear-gradient(145deg,rgba(86,16,40,.62),rgba(48,11,30,.72));border-color:rgba(255,85,120,.22)}
            .lcst-input{
                min-height:43px;
                border-radius:13px;
                border:1px solid rgba(94,221,255,.17);
                background:linear-gradient(180deg,rgba(2,7,20,.92),rgba(5,14,32,.90));
                box-shadow:inset 0 2px 10px rgba(0,0,0,.25),0 1px 0 rgba(255,255,255,.025);
            }
            .lcst-input:hover{border-color:rgba(101,222,255,.27)}
            .lcst-input:focus{
                border-color:rgba(55,230,255,.66);
                box-shadow:0 0 0 3px rgba(55,230,255,.08),0 12px 28px rgba(0,0,0,.18),inset 0 2px 8px rgba(0,0,0,.18);
            }
            .lcst-hint{border-radius:10px;background:rgba(10,22,43,.70)}
            .lcst-hint.strong{background:linear-gradient(145deg,rgba(7,60,82,.55),rgba(8,33,59,.60))}

            /* Tombol */
            .lcst-btn{
                border-radius:13px;
                padding:11px 15px;
                border:1px solid rgba(255,255,255,.11);
                background:linear-gradient(180deg,#293c60,#172641);
                box-shadow:0 11px 25px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.14);
            }
            .lcst-btn:hover{
                filter:brightness(1.10);
                transform:translateY(-2px);
                border-color:rgba(255,255,255,.22);
                box-shadow:0 15px 30px rgba(0,0,0,.29),inset 0 1px 0 rgba(255,255,255,.16);
            }
            .lcst-btn.red{background:linear-gradient(135deg,#db365e,#8d173b);border-color:rgba(255,104,137,.30)}
            .lcst-btn.green{background:linear-gradient(135deg,#17b76a,#08734a);border-color:rgba(80,244,166,.25)}
            .lcst-btn.blue{background:linear-gradient(135deg,#248ff1,#3656dc);border-color:rgba(105,174,255,.30)}
            .lcst-btn.orange{background:linear-gradient(135deg,#f5a623,#b85b0d);border-color:rgba(255,197,88,.30)}
            .lcst-btn.primary{
                min-width:185px;
                background:linear-gradient(125deg,#08a4bd 0%,#316fe9 48%,#763bd2 100%);
                border-color:rgba(119,225,255,.36);
                box-shadow:0 16px 37px rgba(41,104,225,.28),0 0 20px rgba(42,205,255,.08),inset 0 1px 0 rgba(255,255,255,.21);
            }

            /* Status OCR */
            .lcst-scan-state{
                border-radius:17px;
                background:linear-gradient(145deg,rgba(13,28,53,.91),rgba(5,13,31,.92));
                box-shadow:0 13px 29px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.05);
            }
            .lcst-scan-state.scanning{
                background:linear-gradient(145deg,rgba(4,53,70,.76),rgba(6,20,44,.92));
                border-color:rgba(55,230,255,.36);
            }
            .lcst-scan-state.success{
                background:linear-gradient(145deg,rgba(6,72,45,.67),rgba(4,29,31,.92));
                border-color:rgba(54,231,154,.35);
            }
            .lcst-scan-state.failed{
                background:linear-gradient(145deg,rgba(89,16,41,.68),rgba(34,10,28,.92));
                border-color:rgba(255,85,120,.35);
            }

            /* Kartu gambar */
            #lcst-image-grid{gap:15px}
            .lcst-img-card{
                border-radius:21px;
                border:1px solid rgba(137,181,221,.14);
                background:linear-gradient(155deg,rgba(12,27,53,.97),rgba(2,7,18,.98));
                box-shadow:0 17px 39px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.035);
            }
            .lcst-img-card:hover{
                transform:translateY(-3px);
                border-color:rgba(55,230,255,.43);
                box-shadow:0 22px 49px rgba(0,0,0,.34),0 0 24px rgba(55,230,255,.055);
            }
            .lcst-img-card.target{
                border-color:rgba(255,189,89,.48);
                box-shadow:0 19px 44px rgba(0,0,0,.33),0 0 0 1px rgba(255,189,89,.08),0 0 25px rgba(255,165,45,.06),inset 0 1px 0 rgba(255,255,255,.04);
            }
            .lcst-img-card.target .lcst-img-index{
                background:linear-gradient(135deg,rgba(126,57,14,.93),rgba(70,28,5,.91));
                border-color:rgba(255,202,92,.33);
                color:#fff4cf;
            }
            .lcst-img-media{background:linear-gradient(145deg,#01040b,#050b16)}
            .lcst-img-card img{height:270px;background:#020611}
            .lcst-img-index{
                border-radius:10px;
                background:rgba(3,10,23,.84);
                border-color:rgba(255,255,255,.13);
                box-shadow:0 7px 17px rgba(0,0,0,.25);
            }
            .lcst-del{border-radius:11px;background:linear-gradient(145deg,#df3158,#8f1537)}
            .lcst-ocr-badge{border-radius:12px;padding:9px 10px}
            #lcst-output{
                min-height:147px;
                border-radius:15px;
                background:linear-gradient(180deg,rgba(1,7,17,.96),rgba(2,15,21,.94));
                box-shadow:inset 0 2px 13px rgba(0,0,0,.32);
            }
            #lcst-zoom{background:rgba(1,4,12,.975);backdrop-filter:blur(14px)}
            #lcst-zoom img{border:1px solid rgba(110,225,255,.16);border-radius:16px;box-shadow:0 28px 90px rgba(0,0,0,.72),0 0 45px rgba(55,230,255,.08)}

            @media(max-width:760px){
                #lcst-bubble-fixed{width:74px;height:74px;border-radius:24px}
                .lcst-bubble-core{width:36px;height:36px}
                .lcst-bubble-label{font-size:8px}
                #lcst-panel-fixed{padding:10px}
                .lcst-topbar{border-radius:18px}
                .lcst-card,.lcst-status-card{border-radius:18px}
            }

            /* Mode ringan otomatis aktif saat deep scan/OCR agar dashboard tidak berebut CPU/GPU. */
            #lcst-panel-fixed.lcst-performance-mode{
                backdrop-filter:none!important;
                background:#050816!important;
            }
            #lcst-panel-fixed.lcst-performance-mode:before,
            #lcst-panel-fixed.lcst-performance-mode:after{display:none!important}
            #lcst-panel-fixed.lcst-performance-mode *,
            #lcst-panel-fixed.lcst-performance-mode *:before,
            #lcst-panel-fixed.lcst-performance-mode *:after{
                animation-play-state:paused!important;
                transition:none!important;
            }
            #lcst-panel-fixed.lcst-performance-mode .lcst-card,
            #lcst-panel-fixed.lcst-performance-mode .lcst-topbar,
            #lcst-panel-fixed.lcst-performance-mode .lcst-img-card{
                box-shadow:none!important;
                backdrop-filter:none!important;
            }
            .lcst-img-card{
                contain:layout paint style;
                content-visibility:auto;
                contain-intrinsic-size:320px 360px;
            }
            @media(max-width:1050px){#lcst-image-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
            @media(max-width:760px){
                #lcst-panel-fixed{padding:10px}
                .lcst-grid2{grid-template-columns:1fr}
                .lcst-topbar{align-items:flex-start;flex-direction:column}
                .lcst-actions{width:100%;justify-content:stretch}
                .lcst-actions .lcst-btn{flex:1}
                .lcst-note{align-items:stretch;flex-direction:column}
                #lcst-image-grid{grid-template-columns:1fr}
                .lcst-img-card img{height:220px}
                .lcst-status-card{flex-wrap:wrap}
                .lcst-scan-state{width:100%;min-width:0}
            }


            /* =========================================================
               PATEN ROYAL LUXE UI V5.5.6 — FULL VISUAL REBUILD
               CSS terakhir agar struktur lama tidak menimpa desain baru.
               ========================================================= */
            :root{
                --nova-bg:#fffaf8;
                --nova-panel:#ffffff;
                --nova-panel-2:#fff5ef;
                --nova-line:rgba(181,131,56,.18);
                --nova-cyan:#b91c1c;
                --nova-blue:#d4a24c;
                --nova-purple:#f2d28b;
                --nova-green:#15803d;
                --nova-orange:#c79a3f;
                --nova-red:#991b1b;
                --nova-text:#2a1711;
                --nova-muted:#8a5b2b;
            }
            #lcst-panel-fixed{
                padding:18px!important;
                background:
                    radial-gradient(circle at 12% 2%,rgba(245,205,122,.22),transparent 30%),
                    radial-gradient(circle at 88% 5%,rgba(220,38,38,.09),transparent 28%),
                    radial-gradient(circle at 50% 100%,rgba(181,131,56,.08),transparent 36%),
                    linear-gradient(180deg,#fffdf9 0%,#fff4ed 100%)!important;
                color:var(--nova-text)!important;
            }
            #lcst-panel-fixed:before{
                display:block!important;
                opacity:.16!important;
                background-image:
                    linear-gradient(rgba(181,131,56,.06) 1px,transparent 1px),
                    linear-gradient(90deg,rgba(181,131,56,.06) 1px,transparent 1px)!important;
                background-size:28px 28px!important;
                mask-image:linear-gradient(to bottom,#000,transparent 88%);
            }
            .lcst-nova-shell{max-width:1540px!important;margin:0 auto!important;position:relative!important}

            /* Bubble benar-benar baru: lensa OCR bulat */
            #lcst-bubble-fixed{
                width:86px!important;height:86px!important;border-radius:50%!important;
                padding:0!important;gap:0!important;isolation:isolate!important;
                border:1px solid rgba(181,131,56,.34)!important;
                background:
                    radial-gradient(circle at 35% 25%,rgba(255,255,255,.98),transparent 30%),
                    radial-gradient(circle at 50% 58%,#fffdfa 0%,#fff0e1 56%,#f9ddc9 100%)!important;
                box-shadow:
                    0 24px 55px rgba(110,61,20,.20),
                    0 0 0 6px rgba(181,131,56,.08),
                    0 0 34px rgba(199,154,63,.18),
                    inset 0 1px 0 rgba(255,255,255,.96)!important;
                overflow:visible!important;
            }
            #lcst-bubble-fixed:before,
            #lcst-bubble-fixed:after{display:none!important}
            .lcst-nova-ring{
                position:absolute;inset:-6px;border-radius:50%;pointer-events:none;
                border:1px dashed rgba(181,131,56,.44);
                animation:lcstNovaRing 8s linear infinite;
                filter:drop-shadow(0 0 8px rgba(181,131,56,.26));
            }
            .lcst-nova-ring:before,.lcst-nova-ring:after{
                content:"";position:absolute;width:7px;height:7px;border-radius:50%;
                background:#c79a3f;box-shadow:0 0 13px #c79a3f;
            }
            .lcst-nova-ring:before{left:8px;top:10px}.lcst-nova-ring:after{right:7px;bottom:11px;background:#b91c1c;box-shadow:0 0 13px #b91c1c}
            .lcst-nova-lens{
                position:absolute;left:18px;top:14px;width:48px;height:48px;border-radius:17px;
                background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(255,243,227,.98));
                border:1px solid rgba(181,131,56,.26);
                box-shadow:inset 0 0 22px rgba(199,154,63,.09),0 7px 17px rgba(110,61,20,.16);
                overflow:hidden;
            }
            .lcst-nova-lens:before{
                content:"";position:absolute;inset:10px;border-radius:50%;
                border:1px solid rgba(181,131,56,.45);
                box-shadow:inset 0 0 11px rgba(199,154,63,.10),0 0 12px rgba(181,131,56,.12);
            }
            .lcst-nova-lens-dot{
                position:absolute;left:50%;top:50%;width:7px;height:7px;border-radius:50%;
                transform:translate(-50%,-50%);background:#c79a3f;box-shadow:0 0 13px #c79a3f;
            }
            .lcst-nova-laser{
                position:absolute;left:6px;right:6px;top:9px;height:2px;border-radius:4px;
                background:linear-gradient(90deg,transparent,#c79a3f 18%,#fff 50%,#b91c1c 82%,transparent);
                box-shadow:0 0 12px rgba(181,131,56,.45);
                animation:lcstNovaLaser 1.65s ease-in-out infinite;
            }
            .lcst-nova-corner{position:absolute;width:8px;height:8px;border-color:#b58338;border-style:solid;opacity:.9}
            .lcst-nova-corner.c1{left:5px;top:5px;border-width:1.5px 0 0 1.5px;border-radius:4px 0 0 0}
            .lcst-nova-corner.c2{right:5px;top:5px;border-width:1.5px 1.5px 0 0;border-radius:0 4px 0 0}
            .lcst-nova-corner.c3{right:5px;bottom:5px;border-width:0 1.5px 1.5px 0;border-radius:0 0 4px 0}
            .lcst-nova-corner.c4{left:5px;bottom:5px;border-width:0 0 1.5px 1.5px;border-radius:0 0 0 4px}
            .lcst-nova-caption{
                position:absolute;left:0;right:0;bottom:7px;z-index:3;
                font-size:9px;font-weight:1000;letter-spacing:2.3px;color:#8a5b2b;text-align:center;
                text-shadow:0 0 8px rgba(181,131,56,.26);
            }
            .lcst-nova-online{
                position:absolute;right:4px;top:7px;width:10px;height:10px;border-radius:50%;z-index:4;
                background:#22c55e;border:2px solid #fff8f2;box-shadow:0 0 0 3px rgba(34,197,94,.10),0 0 12px #22c55e;
            }
            #lcst-bubble-fixed:hover{transform:translateY(-5px) scale(1.07)!important;box-shadow:0 30px 70px rgba(110,61,20,.24),0 0 0 7px rgba(181,131,56,.08),0 0 44px rgba(199,154,63,.18)!important}
            @keyframes lcstNovaRing{to{transform:rotate(360deg)}}
            @keyframes lcstNovaLaser{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(28px);opacity:1}}

            /* Header baru */
            .lcst-nova-topbar{
                min-height:84px!important;margin:0 0 14px!important;padding:15px 17px!important;
                border-radius:24px!important;border:1px solid rgba(181,131,56,.14)!important;
                background:linear-gradient(135deg,#ffffff,#fff8f2)!important;
                box-shadow:0 18px 48px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.05)!important;
                overflow:hidden!important;
            }
            .lcst-nova-topbar:before{
                content:""!important;display:block!important;position:absolute!important;left:0!important;top:0!important;bottom:0!important;width:4px!important;
                background:linear-gradient(180deg,#b58338,#d4a24c,#b91c1c)!important;
                box-shadow:0 0 18px rgba(77,232,255,.45)!important;
            }
            .lcst-nova-topbar:after{
                content:""!important;display:block!important;position:absolute!important;right:-60px!important;top:-90px!important;width:230px!important;height:230px!important;border-radius:50%!important;
                background:radial-gradient(circle,rgba(181,131,56,.12),transparent 65%)!important;pointer-events:none!important;
            }
            .lcst-nova-logo{
                width:55px!important;height:55px!important;border-radius:19px!important;
                background:linear-gradient(145deg,rgba(199,154,63,.20),rgba(255,255,255,.98))!important;
                border:1px solid rgba(181,131,56,.18)!important;
            }
            .lcst-nova-logo svg{width:33px;height:33px;stroke:#b91c1c;stroke-width:1.7;filter:drop-shadow(0 0 9px rgba(181,131,56,.18))}
            .lcst-nova-brand-copy{min-width:0}
            .lcst-nova-eyebrow{font-size:8px;font-weight:1000;letter-spacing:2.2px;color:#8a5b2b;margin-bottom:3px}
            .lcst-title{font-size:21px!important;line-height:1.15!important;margin:0!important;color:#7c1d1d!important}
            .lcst-subtitle{font-size:10px!important;color:#8a5b2b!important;margin-top:5px!important}
            .lcst-version{font-size:8px!important;padding:4px 8px!important;background:rgba(199,154,63,.12)!important;border-color:rgba(181,131,56,.18)!important;color:#8a5b2b!important}
            .lcst-nova-top-actions{display:flex;align-items:center;gap:10px;position:relative;z-index:2}
            .lcst-nova-live-chip{display:flex;align-items:center;gap:7px;padding:8px 11px;border-radius:12px;background:rgba(199,154,63,.10);border:1px solid rgba(181,131,56,.20);color:#8a5b2b;font-size:8px;font-weight:1000;letter-spacing:1.1px}
            .lcst-nova-live-chip span{width:7px;height:7px;border-radius:50%;background:#48e0a4;box-shadow:0 0 10px #48e0a4;animation:lcstBlink 1.4s ease-in-out infinite}
            .lcst-nova-close{padding:9px 12px!important;display:flex!important;align-items:center!important;gap:9px!important;background:rgba(181,131,56,.10)!important;border-color:rgba(181,131,56,.20)!important;color:#8a5b2b!important}
            .lcst-nova-close b{font-size:17px;line-height:1}

            /* Status hero */
            .lcst-nova-hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(500px,.85fr);gap:14px;margin-bottom:14px}
            .lcst-nova-status{
                min-height:102px!important;margin:0!important;padding:18px!important;border-radius:22px!important;
                align-items:center!important;background:
                    radial-gradient(circle at 88% 0%,rgba(181,131,56,.10),transparent 40%),
                    linear-gradient(135deg,#ffffff,#fff7ef)!important;
                border:1px solid rgba(181,131,56,.12)!important;
            }
            .lcst-nova-status-icon{width:52px!important;height:52px!important;border-radius:17px!important;background:rgba(199,154,63,.09)!important;border-color:rgba(181,131,56,.16)!important}
            .lcst-nova-status-icon svg{width:28px;height:28px;stroke:#8a5b2b;stroke-width:1.6}
            .lcst-nova-status .lcst-status-title{font-size:9px!important;letter-spacing:1.8px!important;color:#8a5b2b!important}
            .lcst-nova-status .lcst-ocr-box{font-size:14px!important;font-weight:750!important;color:#2a1711!important;margin-top:5px!important}
            .lcst-nova-status .lcst-progress{height:4px!important;background:rgba(181,131,56,.08)!important}
            .lcst-nova-status .lcst-progress span{background:linear-gradient(90deg,var(--nova-cyan),var(--nova-blue),var(--nova-purple))!important}
            .lcst-nova-identity{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
            .lcst-nova-stat{
                min-width:0;padding:13px;border-radius:18px;border:1px solid var(--nova-line);
                background:linear-gradient(155deg,rgba(15,29,52,.94),rgba(7,14,27,.94));
                box-shadow:inset 0 1px 0 rgba(255,255,255,.035);
            }
            .lcst-nova-stat.ok{border-color:rgba(34,197,94,.18);background:linear-gradient(155deg,rgba(241,253,244,.96),rgba(232,250,236,.98))}
            .lcst-nova-stat.bad{border-color:rgba(181,131,56,.16);background:linear-gradient(155deg,rgba(255,248,244,.98),rgba(255,239,226,.98))}
            .lcst-nova-stat.user{border-color:rgba(181,131,56,.14)}
            .lcst-nova-stat.mode{border-color:rgba(199,154,63,.16)}
            .lcst-nova-stat-label{display:block;font-size:7px;font-weight:1000;letter-spacing:1.35px;color:#8a5b2b;margin-bottom:6px}
            .lcst-nova-stat strong{display:block;min-width:0;color:#2a1711;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .lcst-nova-stat small{display:block;margin-top:5px;color:#8a5b2b;font-size:7.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .lcst-nova-user-line{display:flex;align-items:center;gap:6px;min-width:0}
            .lcst-nova-user-line strong{flex:1}
            .lcst-user-edit{
                flex:1;min-width:0;width:100%;padding:0;border:0;outline:none;background:transparent;
                color:#2a1711;font:inherit;font-size:10px;font-weight:900;line-height:1.25;
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            }
            .lcst-user-edit:focus{
                padding:4px 6px;margin:-4px -6px;border-radius:7px;background:rgba(255,255,255,.78);
                box-shadow:0 0 0 2px rgba(181,131,56,.13);
            }

            /* Workspace dua kolom */
            .lcst-nova-workspace{display:grid;grid-template-columns:340px minmax(0,1fr);gap:14px;align-items:start}
            .lcst-nova-sidebar{display:flex;flex-direction:column;gap:12px;position:sticky;top:0}
            .lcst-nova-main{min-width:0;display:flex;flex-direction:column;gap:14px}
            .lcst-card{border-radius:24px!important;border:1px solid var(--nova-line)!important;background:linear-gradient(155deg,#ffffff,#fff8f1)!important;box-shadow:0 18px 42px rgba(110,61,20,.08),inset 0 1px 0 rgba(255,255,255,.95)!important}
            .lcst-nova-control-card{margin:0!important;padding:15px!important}
            .lcst-nova-section-head{display:flex;align-items:center;gap:10px;margin-bottom:13px}
            .lcst-nova-step{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;flex:0 0 auto;background:rgba(199,154,63,.10);border:1px solid rgba(181,131,56,.16);color:#8a5b2b;font-size:9px;font-weight:1000}
            .lcst-nova-section-head.orange .lcst-nova-step{background:rgba(181,131,56,.10);border-color:rgba(181,131,56,.18);color:#8a5b2b}
            .lcst-nova-section-head b{display:block;font-size:11px;color:#2a1711}.lcst-nova-section-head small{display:block;font-size:8px;color:#8a5b2b;margin-top:2px}
            .lcst-input{border-radius:14px!important;padding:11px 12px!important;background:#fffdfb!important;border-color:rgba(181,131,56,.16)!important;margin-bottom:8px!important;color:#2a1711!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95)!important}
            .lcst-input:focus{border-color:rgba(181,131,56,.46)!important;box-shadow:0 0 0 3px rgba(181,131,56,.10)!important}
            .lcst-account-scan-state{margin:7px 0 0!important;min-height:62px!important;border-radius:15px!important}
            .lcst-nova-guide{margin:0!important;padding:15px!important;background:linear-gradient(155deg,#fff8f2,#fff)!important}
            .lcst-nova-guide-title{font-size:8px;font-weight:1000;letter-spacing:1.8px;color:#8a5b2b;margin-bottom:10px}
            .lcst-nova-guide-row{display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid rgba(181,131,56,.08)}
            .lcst-nova-guide-row>span{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:rgba(199,154,63,.10);color:#8a5b2b;font-size:14px}
            .lcst-nova-guide-row b{display:block;font-size:9px;color:#2a1711}.lcst-nova-guide-row small{display:block;font-size:7.5px;color:#8a5b2b;margin-top:2px}

            /* Galeri */
            .lcst-nova-gallery-card,.lcst-nova-output-card{margin:0!important;padding:16px!important}
            .lcst-nova-gallery-head,.lcst-output-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;margin-bottom:14px!important}
            .lcst-nova-kicker{display:block;font-size:7px;font-weight:1000;letter-spacing:1.8px;color:#8a5b2b;margin-bottom:4px}
            .lcst-nova-gallery-head h4,.lcst-output-head h4{font-size:15px;margin:0;color:#7c1d1d}.lcst-nova-gallery-head p,.lcst-output-head p{font-size:8.5px;margin:4px 0 0;color:#8a5b2b}
            .lcst-nova-scan-btn{min-width:190px!important;padding:10px 14px!important;border-radius:18px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;text-align:left!important;background:linear-gradient(135deg,#c79a3f,#b58338 50%,#991b1b)!important;box-shadow:0 13px 30px rgba(181,131,56,.22),inset 0 1px 0 rgba(255,255,255,.18)!important}
            .lcst-nova-btn-icon{width:33px;height:33px;border-radius:11px;display:grid;place-items:center;background:rgba(255,255,255,.18);font-size:19px}.lcst-nova-scan-btn b{display:block;font-size:9px;letter-spacing:.7px}.lcst-nova-scan-btn small{display:block;margin-top:2px;font-size:7px;color:rgba(255,255,255,.82)}
            #lcst-image-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:11px!important;margin:0!important}
            .lcst-img-card{border-radius:18px!important;background:linear-gradient(160deg,#ffffff,#fff8f1)!important;border-color:rgba(181,131,56,.12)!important;box-shadow:0 10px 22px rgba(110,61,20,.05)!important}
            .lcst-img-card:hover{transform:translateY(-3px)!important;border-color:rgba(181,131,56,.24)!important;box-shadow:0 18px 34px rgba(110,61,20,.12)!important}
            .lcst-img-card.target{border-color:rgba(181,131,56,.44)!important;box-shadow:0 0 0 1px rgba(181,131,56,.07),0 15px 32px rgba(110,61,20,.10)!important}
            .lcst-img-card img{height:236px!important;background:#fffaf6!important}
            .lcst-img-index{border-radius:9px!important;background:rgba(255,255,255,.98)!important;font-size:8px!important;color:#8a5b2b!important;border:1px solid rgba(181,131,56,.10)!important}
            .lcst-target-tag{color:#b58338!important}
            .lcst-ocr-badge{font-size:8.5px!important;border-radius:10px!important;margin:0 8px 8px!important}
            .lcst-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:220px!important;margin:0!important;border-radius:18px!important;background:#fffaf5!important;border-color:rgba(181,131,56,.12)!important;color:#8a5b2b!important}
            .lcst-empty b{font-size:11px;color:#7c1d1d}.lcst-empty span{font-size:8px}.lcst-nova-empty-icon{font-size:27px;color:#b58338;margin-bottom:4px}

            /* Output */
            .lcst-nova-output-card{background:linear-gradient(155deg,#ffffff,#fff8f1)!important;border-color:rgba(181,131,56,.12)!important}
            .lcst-copy-btn{min-width:120px!important;border-radius:13px!important;padding:10px 13px!important}
            #lcst-output{height:142px!important;margin:0!important;border-radius:15px!important;background:#fffdfb!important;border-color:rgba(181,131,56,.12)!important;color:#7c1d1d!important;font-size:10px!important}

            /* Matikan efek berat saat OCR, desain tetap sama */
            #lcst-panel-fixed.lcst-performance-mode{background:#fff8f2!important}
            #lcst-panel-fixed.lcst-performance-mode:before{display:none!important}
            #lcst-panel-fixed.lcst-performance-mode .lcst-nova-sidebar{position:static!important}

            .lcst-bank-head{justify-content:space-between!important}
            .lcst-bank-head-main{display:flex;align-items:center;gap:10px;min-width:0}
            .lcst-bank-refresh{
                flex:0 0 auto;padding:7px 9px!important;border-radius:10px!important;
                background:linear-gradient(135deg,#c79a3f,#8a5b2b)!important;
                border-color:rgba(181,131,56,.24)!important;color:#fff!important;
                font-size:7px!important;letter-spacing:.7px!important
            }
            .lcst-bank-lookup-state{margin-top:7px!important}
            .lcst-bank-lookup-state.success{border-color:rgba(34,197,94,.28)!important}
            .lcst-bank-lookup-state.failed{border-color:rgba(185,28,28,.24)!important}

            @media(max-width:1180px){
                .lcst-nova-hero{grid-template-columns:1fr!important}
                .lcst-nova-workspace{grid-template-columns:300px minmax(0,1fr)!important}
                .lcst-nova-identity{grid-template-columns:repeat(3,minmax(0,1fr))!important}
                #lcst-image-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
            }
            @media(max-width:820px){
                #lcst-panel-fixed{padding:9px!important}
                .lcst-nova-topbar{align-items:flex-start!important;flex-direction:column!important}
                .lcst-nova-top-actions{width:100%;justify-content:space-between}
                .lcst-nova-workspace{grid-template-columns:1fr!important}
                .lcst-nova-sidebar{position:static!important}
                .lcst-nova-identity{grid-template-columns:1fr!important}
                .lcst-nova-gallery-head,.lcst-output-head{align-items:stretch!important;flex-direction:column!important}
                .lcst-nova-scan-btn{width:100%!important}
                #lcst-image-grid{grid-template-columns:1fr!important}
                .lcst-img-card img{height:220px!important}
            }


            /* =========================================================
               PATEN AUTO REKENING BRIGHT V5.5.9
               Hanya visual: tidak mengubah scan, OCR, rekening, atau output.
               ========================================================= */
            :root{
                --nova-bg:#fffdfc!important;
                --nova-panel:#ffffff!important;
                --nova-panel-2:#fff8f5!important;
                --nova-line:rgba(239,68,68,.15)!important;
                --nova-cyan:#ff3b30!important;
                --nova-blue:#ff5c5c!important;
                --nova-purple:#ff9f43!important;
                --nova-green:#22c55e!important;
                --nova-orange:#ffb020!important;
                --nova-red:#e11d48!important;
                --nova-text:#202331!important;
                --nova-muted:#7b5560!important;
            }
            #lcst-panel-fixed{
                background:
                    radial-gradient(circle at 8% 0%,rgba(255,204,51,.24),transparent 27%),
                    radial-gradient(circle at 94% 4%,rgba(255,59,48,.15),transparent 28%),
                    radial-gradient(circle at 48% 100%,rgba(255,159,67,.10),transparent 35%),
                    linear-gradient(180deg,#ffffff 0%,#fff8f6 54%,#fffdf8 100%)!important;
                color:#202331!important;
            }
            #lcst-panel-fixed:before{
                opacity:.22!important;
                background-image:
                    linear-gradient(rgba(255,99,99,.055) 1px,transparent 1px),
                    linear-gradient(90deg,rgba(255,99,99,.055) 1px,transparent 1px)!important;
            }

            /* Bubble lebih cerah */
            #lcst-bubble-fixed{
                border:2px solid rgba(255,59,48,.46)!important;
                background:
                    radial-gradient(circle at 34% 22%,#ffffff 0%,rgba(255,255,255,.96) 23%,transparent 38%),
                    linear-gradient(145deg,#ffffff 0%,#fff2ed 54%,#ffd7cf 100%)!important;
                box-shadow:
                    0 22px 48px rgba(225,29,72,.20),
                    0 0 0 6px rgba(255,176,32,.10),
                    0 0 36px rgba(255,59,48,.23),
                    inset 0 1px 0 #fff!important;
            }
            .lcst-nova-ring{border-color:rgba(255,59,48,.60)!important;filter:drop-shadow(0 0 8px rgba(255,59,48,.35))!important}
            .lcst-nova-ring:before{background:#ffb020!important;box-shadow:0 0 14px #ffb020!important}
            .lcst-nova-ring:after{background:#ff3b30!important;box-shadow:0 0 14px #ff3b30!important}
            .lcst-nova-lens{
                background:linear-gradient(145deg,#ffffff,#ffe9e3)!important;
                border-color:rgba(255,59,48,.38)!important;
                box-shadow:inset 0 0 20px rgba(255,99,71,.11),0 8px 18px rgba(225,29,72,.14)!important;
            }
            .lcst-nova-lens:before{border-color:rgba(255,59,48,.55)!important;box-shadow:inset 0 0 12px rgba(255,59,48,.10),0 0 13px rgba(255,176,32,.18)!important}
            .lcst-nova-lens-dot{background:#ff3b30!important;box-shadow:0 0 14px #ff3b30!important}
            .lcst-nova-laser{background:linear-gradient(90deg,transparent,#ff3b30 18%,#fff 50%,#ffb020 82%,transparent)!important;box-shadow:0 0 13px rgba(255,59,48,.60)!important}
            .lcst-nova-corner{border-color:#ff3b30!important}
            .lcst-nova-caption{color:#d61f2c!important;text-shadow:0 0 9px rgba(255,59,48,.30)!important}
            #lcst-bubble-fixed:hover{box-shadow:0 28px 65px rgba(225,29,72,.24),0 0 0 8px rgba(255,176,32,.10),0 0 48px rgba(255,59,48,.28)!important}

            /* Header & hero */
            .lcst-nova-topbar{
                border-color:rgba(255,59,48,.16)!important;
                background:linear-gradient(135deg,#ffffff 0%,#fff8f5 58%,#fff0e8 100%)!important;
                box-shadow:0 18px 42px rgba(190,24,93,.08),inset 0 1px 0 #fff!important;
            }
            .lcst-nova-topbar:before{background:linear-gradient(180deg,#ff3b30,#ff6b5e,#ffb020)!important;box-shadow:0 0 18px rgba(255,59,48,.30)!important}
            .lcst-nova-topbar:after{background:radial-gradient(circle,rgba(255,176,32,.18),transparent 65%)!important}
            .lcst-nova-logo{background:linear-gradient(145deg,#ffffff,#ffe4dc)!important;border-color:rgba(255,59,48,.20)!important;box-shadow:0 10px 24px rgba(225,29,72,.10),inset 0 1px 0 #fff!important}
            .lcst-nova-logo svg{stroke:#ef2f3c!important;filter:drop-shadow(0 0 8px rgba(255,59,48,.22))!important}
            .lcst-nova-eyebrow{color:#ef2f3c!important}
            .lcst-title{color:#b3132f!important}
            .lcst-subtitle{color:#84515d!important}
            .lcst-version{background:#fff1cf!important;border-color:rgba(255,176,32,.28)!important;color:#a35e00!important}
            .lcst-nova-live-chip{background:#effdf5!important;border-color:rgba(34,197,94,.22)!important;color:#15803d!important}
            .lcst-nova-close{background:#fff0f2!important;border-color:rgba(225,29,72,.20)!important;color:#be123c!important}
            .lcst-nova-close:hover{background:#ffe1e6!important}

            .lcst-nova-status{
                background:
                    radial-gradient(circle at 92% 0%,rgba(255,176,32,.18),transparent 42%),
                    linear-gradient(135deg,#ffffff,#fff5f1)!important;
                border-color:rgba(255,59,48,.17)!important;
                box-shadow:0 15px 34px rgba(190,24,93,.07),inset 0 1px 0 #fff!important;
            }
            .lcst-nova-status-icon{background:#fff0ed!important;border-color:rgba(255,59,48,.20)!important}
            .lcst-nova-status-icon svg{stroke:#ef2f3c!important}
            .lcst-nova-status .lcst-status-title{color:#e52c39!important}
            .lcst-nova-status .lcst-ocr-box{color:#272534!important}
            .lcst-nova-status .lcst-progress{background:#ffe7e2!important}
            .lcst-nova-status .lcst-progress span{background:linear-gradient(90deg,#ff3b30,#ff6b5e,#ffb020)!important}

            /* Semua kartu dalam dibuat putih terang */
            .lcst-card,
            .lcst-nova-stat,
            .lcst-nova-guide,
            .lcst-nova-output-card{
                background:linear-gradient(155deg,#ffffff 0%,#fffaf8 100%)!important;
                border-color:rgba(239,68,68,.13)!important;
                box-shadow:0 15px 34px rgba(190,24,93,.065),inset 0 1px 0 #fff!important;
            }
            .lcst-nova-stat.ok{background:linear-gradient(155deg,#ffffff,#edfff4)!important;border-color:rgba(34,197,94,.20)!important}
            .lcst-nova-stat.bad{background:linear-gradient(155deg,#ffffff,#fff0f2)!important;border-color:rgba(225,29,72,.18)!important}
            .lcst-nova-stat.user{background:linear-gradient(155deg,#ffffff,#fff6ed)!important;border-color:rgba(255,159,67,.20)!important}
            .lcst-nova-stat.mode{background:linear-gradient(155deg,#ffffff,#fff9df)!important;border-color:rgba(255,176,32,.22)!important}
            .lcst-nova-stat-label{color:#d12a38!important}
            .lcst-nova-stat strong{color:#252331!important}
            .lcst-user-edit{color:#252331!important}
            .lcst-user-edit:focus{background:#fff!important;box-shadow:0 0 0 3px rgba(255,59,48,.10)!important}
            .lcst-nova-stat small{color:#88616a!important}
            .lcst-nova-section-head b,.lcst-nova-guide-row b{color:#252331!important}
            .lcst-nova-section-head small,.lcst-nova-guide-row small,.lcst-nova-guide-title{color:#88616a!important}
            .lcst-nova-step{background:#fff0ed!important;border-color:rgba(255,59,48,.18)!important;color:#e52c39!important}
            .lcst-nova-section-head.orange .lcst-nova-step{background:#fff5cf!important;border-color:rgba(255,176,32,.24)!important;color:#a75e00!important}
            .lcst-nova-guide-row{border-color:rgba(239,68,68,.08)!important}
            .lcst-nova-guide-row>span{background:#fff1ec!important;color:#ef2f3c!important}

            /* Input & tombol */
            .lcst-input{
                background:#ffffff!important;
                border-color:rgba(239,68,68,.16)!important;
                color:#252331!important;
                box-shadow:0 4px 12px rgba(190,24,93,.035),inset 0 1px 0 #fff!important;
            }
            .lcst-input::placeholder{color:#b18b94!important}
            .lcst-input:focus{border-color:rgba(255,59,48,.48)!important;box-shadow:0 0 0 4px rgba(255,59,48,.09),0 6px 16px rgba(190,24,93,.06)!important}
            .lcst-btn{background:linear-gradient(180deg,#ffffff,#fff4f0)!important;border-color:rgba(239,68,68,.16)!important;color:#b3132f!important;box-shadow:0 7px 16px rgba(190,24,93,.07),inset 0 1px 0 #fff!important}
            .lcst-btn:hover{background:linear-gradient(180deg,#fff8f5,#ffe7e1)!important;border-color:rgba(255,59,48,.30)!important}
            .lcst-btn.primary,.lcst-nova-scan-btn{
                color:#fff!important;
                background:linear-gradient(135deg,#ff3b30 0%,#ef2f3c 50%,#ff9f43 100%)!important;
                border-color:rgba(255,59,48,.32)!important;
                box-shadow:0 14px 30px rgba(225,29,72,.22),inset 0 1px 0 rgba(255,255,255,.28)!important;
            }
            .lcst-btn.green{color:#fff!important;background:linear-gradient(135deg,#2dd66f,#16a34a)!important;border-color:rgba(34,197,94,.26)!important}
            .lcst-btn.blue{color:#fff!important;background:linear-gradient(135deg,#38bdf8,#2563eb)!important;border-color:rgba(37,99,235,.25)!important}
            .lcst-btn.red{color:#fff!important;background:linear-gradient(135deg,#fb7185,#e11d48)!important;border-color:rgba(225,29,72,.26)!important}
            .lcst-btn.orange{color:#fff!important;background:linear-gradient(135deg,#ffc62f,#f59e0b)!important;border-color:rgba(245,158,11,.28)!important}
            .lcst-bank-refresh{background:linear-gradient(135deg,#ff9f43,#ef2f3c)!important;border-color:rgba(239,68,68,.24)!important;box-shadow:0 8px 17px rgba(225,29,72,.16)!important}
            .lcst-inline-copy{background:#fff4f0!important;border-color:rgba(239,68,68,.16)!important;color:#e52c39!important}

            /* Status scan dibuat terang */
            .lcst-scan-state{background:#ffffff!important;border-color:rgba(148,163,184,.22)!important;box-shadow:0 8px 20px rgba(71,85,105,.07),inset 0 1px 0 #fff!important}
            .lcst-scan-state-label{color:#98636e!important}
            .lcst-scan-state-text{color:#30303d!important}
            .lcst-scan-state-detail{color:#96737b!important}
            .lcst-scan-state.waiting{background:linear-gradient(145deg,#ffffff,#eff8ff)!important;border-color:rgba(59,130,246,.20)!important}
            .lcst-scan-state.scanning{background:linear-gradient(145deg,#ffffff,#eafcff)!important;border-color:rgba(6,182,212,.24)!important}
            .lcst-scan-state.success{background:linear-gradient(145deg,#ffffff,#edfff3)!important;border-color:rgba(34,197,94,.24)!important}
            .lcst-scan-state.partial{background:linear-gradient(145deg,#ffffff,#fff8db)!important;border-color:rgba(245,158,11,.25)!important}
            .lcst-scan-state.failed{background:linear-gradient(145deg,#ffffff,#fff0f3)!important;border-color:rgba(225,29,72,.24)!important}
            .lcst-scan-state.waiting .lcst-scan-state-text{color:#2563eb!important}
            .lcst-scan-state.scanning .lcst-scan-state-text{color:#0891b2!important}
            .lcst-scan-state.success .lcst-scan-state-text{color:#15803d!important}
            .lcst-scan-state.partial .lcst-scan-state-text{color:#b45309!important}
            .lcst-scan-state.failed .lcst-scan-state-text{color:#be123c!important}

            /* Galeri dan hasil */
            .lcst-nova-kicker{color:#e52c39!important}
            .lcst-nova-gallery-head h4,.lcst-output-head h4{color:#b3132f!important}
            .lcst-nova-gallery-head p,.lcst-output-head p{color:#88616a!important}
            .lcst-img-card{background:#ffffff!important;border-color:rgba(239,68,68,.12)!important;box-shadow:0 10px 23px rgba(190,24,93,.06)!important}
            .lcst-img-card:hover{border-color:rgba(255,59,48,.30)!important;box-shadow:0 18px 36px rgba(190,24,93,.11)!important}
            .lcst-img-card.target{border-color:rgba(255,176,32,.55)!important;box-shadow:0 0 0 2px rgba(255,176,32,.08),0 16px 34px rgba(190,24,93,.08)!important}
            .lcst-img-card img,.lcst-img-media{background:#fffaf8!important}
            .lcst-img-index{background:rgba(255,255,255,.96)!important;color:#b3132f!important;border-color:rgba(239,68,68,.12)!important}
            .lcst-target-tag{color:#d97706!important}
            .lcst-img-label{color:#8f6871!important;border-color:rgba(239,68,68,.07)!important}
            .lcst-ocr-badge{background:#eefcff!important;color:#087f9a!important;border-color:rgba(6,182,212,.16)!important}
            .lcst-ocr-badge.success{background:#edfff4!important;color:#15803d!important;border-color:rgba(34,197,94,.20)!important}
            .lcst-ocr-badge.error{background:#fff0f3!important;color:#be123c!important;border-color:rgba(225,29,72,.20)!important}
            .lcst-ocr-badge.empty{background:#f8fafc!important;color:#64748b!important;border-color:rgba(100,116,139,.14)!important}
            .lcst-empty{background:linear-gradient(145deg,#ffffff,#fff7f3)!important;border-color:rgba(239,68,68,.14)!important;color:#98636e!important}
            .lcst-empty b{color:#b3132f!important}.lcst-nova-empty-icon{color:#ff3b30!important}
            #lcst-output{background:#ffffff!important;border-color:rgba(239,68,68,.15)!important;color:#b3132f!important;box-shadow:inset 0 1px 0 #fff!important}
            #lcst-output:focus{border-color:rgba(255,59,48,.34)!important;box-shadow:0 0 0 4px rgba(255,59,48,.07)!important}
            .lcst-pill{background:#ffffff!important;color:#38323c!important;border-color:rgba(239,68,68,.12)!important}
            .lcst-pill.blue{background:#eefaff!important;color:#087f9a!important;border-color:rgba(6,182,212,.16)!important}
            .lcst-pill.green{background:#effdf5!important;color:#15803d!important;border-color:rgba(34,197,94,.18)!important}
            .lcst-pill.red{background:#fff0f3!important;color:#be123c!important;border-color:rgba(225,29,72,.18)!important}

            #lcst-panel-fixed.lcst-performance-mode{background:#fffaf8!important}

            /* V5.6.1: mode pemindahan gambar super ringan.
               Efek berat dimatikan hanya selama drag agar kartu mengikuti pointer tanpa patah-patah. */
            #lcst-panel-fixed.lcst-reorder-mode .lcst-img-card,
            #lcst-panel-fixed.lcst-reorder-mode .lcst-img-card:hover,
            #lcst-panel-fixed.lcst-reorder-mode .lcst-img-card.target{
                transition:none!important;
                transform:none!important;
                box-shadow:none!important;
                will-change:auto!important;
            }
            #lcst-panel-fixed.lcst-reorder-mode .lcst-img-card img{
                transition:none!important;
                transform:none!important;
                pointer-events:none!important;
            }
            #lcst-panel-fixed.lcst-reorder-mode .lcst-img-card *{pointer-events:none!important}
            #lcst-panel-fixed.lcst-reorder-mode .lcst-img-card.dragging{
                opacity:.32!important;
                border-style:dashed!important;
            }
            #lcst-panel-fixed.lcst-reorder-mode .lcst-img-card.over{
                opacity:1!important;
                border-color:#22c55e!important;
                background:#f0fff5!important;
                box-shadow:0 0 0 3px rgba(34,197,94,.10)!important;
            }

            /* =========================================================
               BUBBLE GAMBAR CUSTOM
               Bubble memakai gambar Postimg; dashboard memakai logo LINE TOGEL.
               Fungsi klik, drag, dan pembuka panel tetap aktif.
               ========================================================= */
            #lcst-bubble-fixed{
                width:94px!important;
                height:94px!important;
                border-radius:50%!important;
                border:2px solid rgba(255,255,255,.96)!important;
                background-color:#fffaf3!important;
                background-image:
                    linear-gradient(145deg,rgba(255,255,255,.34) 0%,transparent 34%,rgba(122,15,26,.07) 100%),
                    url("https://i.postimg.cc/jSc32qYs/85c5a789-2ae2-4b4f-897d-9aab6a0c6b4f.png"),
                    radial-gradient(circle at 32% 20%,#ffffff 0%,#fffdf8 30%,#fff1dc 66%,#e8bd74 100%)!important;
                background-repeat:no-repeat,no-repeat,no-repeat!important;
                background-position:center center,center center,center center!important;
                background-size:100% 100%,78% auto,100% 100%!important;
                overflow:visible!important;
                isolation:isolate!important;
                box-shadow:
                    0 8px 13px rgba(91,32,22,.20),
                    0 22px 42px rgba(91,32,22,.30),
                    0 0 0 5px rgba(255,255,255,.46),
                    0 0 0 8px rgba(218,165,70,.15),
                    0 0 30px rgba(221,45,54,.25),
                    inset 0 2px 3px rgba(255,255,255,1),
                    inset 0 -10px 19px rgba(126,31,27,.12)!important;
            }
            #lcst-bubble-fixed:before{
                content:""!important;
                display:block!important;
                position:absolute!important;
                inset:4px!important;
                width:auto!important;
                height:auto!important;
                border-radius:50%!important;
                border:1px solid rgba(255,255,255,.82)!important;
                background:
                    radial-gradient(ellipse at 35% 15%,rgba(255,255,255,.88) 0%,rgba(255,255,255,.20) 27%,transparent 44%),
                    linear-gradient(155deg,transparent 48%,rgba(108,14,25,.10) 100%)!important;
                box-shadow:inset 0 0 16px rgba(255,255,255,.32)!important;
                pointer-events:none!important;
                z-index:2!important;
                animation:lcstLogoGlass 3.2s ease-in-out infinite!important;
            }
            #lcst-bubble-fixed:after{
                content:""!important;
                display:block!important;
                position:absolute!important;
                inset:-9px!important;
                border-radius:50%!important;
                background:conic-gradient(
                    from 0deg,
                    transparent 0 12%,
                    rgba(255,198,72,.92) 18%,
                    transparent 27% 48%,
                    rgba(224,30,49,.86) 56%,
                    transparent 65% 82%,
                    rgba(255,228,145,.86) 90%,
                    transparent 100%
                )!important;
                opacity:.78!important;
                filter:blur(1px) drop-shadow(0 0 7px rgba(224,30,49,.30))!important;
                pointer-events:none!important;
                z-index:-1!important;
                animation:lcstLogoOrbit 7s linear infinite!important;
            }
            #lcst-bubble-fixed .lcst-nova-ring{
                display:block!important;
                inset:-7px!important;
                border:1px solid rgba(255,220,133,.72)!important;
                filter:drop-shadow(0 0 7px rgba(208,36,49,.34))!important;
                z-index:3!important;
                animation:lcstLogoRing 10s linear infinite!important;
            }
            #lcst-bubble-fixed .lcst-nova-ring:before{
                background:#ffd166!important;
                box-shadow:0 0 12px #ffbe32,0 0 22px rgba(255,190,50,.62)!important;
            }
            #lcst-bubble-fixed .lcst-nova-ring:after{
                background:#e11d3f!important;
                box-shadow:0 0 12px #e11d3f,0 0 22px rgba(225,29,63,.62)!important;
            }
            #lcst-bubble-fixed .lcst-nova-lens,
            #lcst-bubble-fixed .lcst-nova-caption{
                display:none!important;
            }
            #lcst-bubble-fixed .lcst-nova-online{
                display:block!important;
                right:2px!important;
                top:7px!important;
                width:11px!important;
                height:11px!important;
                background:#22d36f!important;
                border:2px solid #ffffff!important;
                box-shadow:0 0 0 3px rgba(34,211,111,.16),0 0 15px #22d36f!important;
                animation:lcstLogoOnline 1.8s ease-in-out infinite!important;
            }
            #lcst-bubble-fixed:hover{
                transform:translateY(-6px) scale(1.075)!important;
                border-color:#ffffff!important;
                box-shadow:
                    0 12px 17px rgba(91,32,22,.18),
                    0 30px 58px rgba(91,32,22,.34),
                    0 0 0 6px rgba(255,255,255,.54),
                    0 0 0 10px rgba(218,165,70,.18),
                    0 0 46px rgba(224,30,49,.34),
                    inset 0 2px 3px #ffffff,
                    inset 0 -11px 20px rgba(126,31,27,.13)!important;
            }
            #lcst-bubble-fixed.lcst-dragging{
                transform:scale(1.085)!important;
                cursor:grabbing!important;
                opacity:.96!important;
            }
            @keyframes lcstLogoOrbit{to{transform:rotate(360deg)}}
            @keyframes lcstLogoRing{to{transform:rotate(-360deg)}}
            @keyframes lcstLogoGlass{
                0%,100%{opacity:.70;transform:translateY(0)}
                50%{opacity:1;transform:translateY(1px)}
            }
            @keyframes lcstLogoOnline{
                0%,100%{transform:scale(.86);opacity:.76}
                50%{transform:scale(1.13);opacity:1}
            }

            /* =========================================================
               DASHBOARD RUBY PREMIUM V6.5.0
               - Logo LINE TOGEL menjadi background dashboard.
               - Bubble kembali memakai gambar Postimg sebelumnya.
               - Seluruh workflow dan fungsi scanner tidak disentuh.
               ========================================================= */

            /* Background dashboard saat bubble dibuka */
            #lcst-panel-fixed{
                background-color:#26030d!important;
                background-image:
                    linear-gradient(145deg,rgba(37,2,12,.52) 0%,rgba(78,5,20,.40) 48%,rgba(38,3,13,.50) 100%),
                    url("https://line32170.com/assets/img/ei/logo.png"),
                    radial-gradient(circle at 7% 2%,rgba(255,197,61,.34),transparent 31%),
                    radial-gradient(circle at 94% 5%,rgba(255,45,68,.32),transparent 30%),
                    radial-gradient(circle at 50% 105%,rgba(255,165,49,.18),transparent 38%),
                    linear-gradient(145deg,#24030d 0%,#5c071d 47%,#1d020a 100%)!important;
                background-repeat:no-repeat,no-repeat,no-repeat,no-repeat,no-repeat,no-repeat!important;
                background-position:center center,center 48%,left top,right top,center bottom,center center!important;
                background-size:100% 100%,72vw auto,100% 100%,100% 100%,100% 100%,100% 100%!important;
                background-attachment:fixed,fixed,fixed,fixed,fixed,fixed!important;
                color:#202331!important;
            }
            #lcst-panel-fixed:before{
                content:""!important;
                display:block!important;
                position:fixed!important;
                inset:0!important;
                z-index:0!important;
                pointer-events:none!important;
                opacity:.34!important;
                background-image:
                    linear-gradient(rgba(255,221,139,.075) 1px,transparent 1px),
                    linear-gradient(90deg,rgba(255,116,93,.07) 1px,transparent 1px)!important;
                background-size:34px 34px!important;
                mask-image:linear-gradient(to bottom,#000,transparent 92%)!important;
            }
            #lcst-panel-fixed:after{
                content:""!important;
                display:block!important;
                position:fixed!important;
                inset:0!important;
                z-index:0!important;
                pointer-events:none!important;
                opacity:.30!important;
                background:
                    linear-gradient(118deg,transparent 0 37%,rgba(255,229,176,.24) 46%,transparent 55%),
                    radial-gradient(ellipse at 50% -12%,rgba(255,214,126,.35),transparent 58%)!important;
            }
            #lcst-panel-fixed .lcst-nova-shell{
                position:relative!important;
                z-index:2!important;
            }
            #lcst-dashboard-brand-bg{
                position:fixed!important;
                left:50%!important;
                top:52%!important;
                width:min(1120px,84vw)!important;
                height:min(730px,76vh)!important;
                transform:translate(-50%,-50%)!important;
                display:flex!important;
                align-items:center!important;
                justify-content:center!important;
                overflow:visible!important;
                border-radius:0!important;
                border:0!important;
                background:transparent!important;
                box-shadow:none!important;
                pointer-events:none!important;
                user-select:none!important;
                z-index:1!important;
                opacity:1!important;
                filter:none!important;
                animation:none!important;
            }
            #lcst-dashboard-logo-bg{
                display:block!important;
                position:relative!important;
                width:88%!important;
                height:62%!important;
                margin:0!important;
                padding:0!important;
                border:0!important;
                object-fit:contain!important;
                object-position:center!important;
                transform:none!important;
                image-rendering:auto!important;
                opacity:1!important;
                filter:
                    saturate(1.34)
                    contrast(1.18)
                    brightness(1.06)
                    drop-shadow(0 12px 16px rgba(22,0,5,.34))
                    drop-shadow(0 0 16px rgba(255,204,85,.24))!important;
                pointer-events:none!important;
                user-select:none!important;
                z-index:2!important;
                animation:lcstDashboardLogoFloat 5.8s ease-in-out infinite!important;
            }
            #lcst-dashboard-logo-fallback{
                position:absolute!important;
                left:50%!important;
                top:50%!important;
                transform:translate(-50%,-50%)!important;
                width:100%!important;
                text-align:center!important;
                color:#ffedbd!important;
                font:1000 clamp(54px,8.5vw,142px)/.88 Inter,Segoe UI,Arial,sans-serif!important;
                letter-spacing:clamp(5px,1.15vw,18px)!important;
                text-shadow:
                    0 3px 0 rgba(255,255,255,.12),
                    0 12px 34px rgba(0,0,0,.42),
                    0 0 45px rgba(255,179,55,.30)!important;
                white-space:nowrap!important;
                opacity:1!important;
                z-index:1!important;
            }
            #lcst-dashboard-logo-fallback small{
                display:block!important;
                margin-top:18px!important;
                color:rgba(255,218,143,.74)!important;
                font:900 clamp(9px,1vw,15px)/1.2 Inter,Segoe UI,Arial,sans-serif!important;
                letter-spacing:clamp(4px,.8vw,11px)!important;
            }
            #lcst-panel-fixed.lcst-dashboard-logo-loaded #lcst-dashboard-logo-fallback{
                opacity:0!important;
            }
            #lcst-panel-fixed.lcst-dashboard-logo-error #lcst-dashboard-logo-bg{
                display:none!important;
            }
            @keyframes lcstDashboardLogoFloat{
                0%,100%{transform:translateY(0) scale(1);opacity:1}
                50%{transform:translateY(-8px) scale(1.018);opacity:1}
            }

            /* Efek glass agar logo background tetap terlihat lembut */
            #lcst-panel-fixed .lcst-nova-topbar{
                background:
                    radial-gradient(circle at 50% -38%,rgba(216,180,254,.34),transparent 47%),
                    radial-gradient(circle at 4% 50%,rgba(236,72,153,.15),transparent 30%),
                    radial-gradient(circle at 96% 45%,rgba(99,102,241,.24),transparent 31%),
                    linear-gradient(135deg,#1d0a35 0%,#3b1766 31%,#5b21b6 62%,#341257 100%)!important;
                backdrop-filter:blur(18px) saturate(145%)!important;
                border-color:rgba(216,180,254,.34)!important;
                box-shadow:
                    0 20px 52px rgba(48,13,82,.32),
                    0 0 0 1px rgba(255,255,255,.035),
                    inset 0 1px 0 rgba(255,255,255,.22),
                    inset 0 -1px 0 rgba(126,34,206,.28)!important;
            }
            #lcst-panel-fixed .lcst-nova-topbar:before{
                background:linear-gradient(180deg,#f0abfc,#c084fc 46%,#818cf8 78%,#fbbf24)!important;
                box-shadow:0 0 22px rgba(216,180,254,.56)!important;
            }
            #lcst-panel-fixed .lcst-nova-topbar:after{
                background:radial-gradient(circle,rgba(233,213,255,.19),transparent 67%)!important;
            }
            #lcst-panel-fixed .lcst-nova-eyebrow{
                color:#f0abfc!important;
                text-shadow:0 0 13px rgba(240,171,252,.30)!important;
            }
            #lcst-panel-fixed .lcst-title{
                color:#ffffff!important;
                text-shadow:0 3px 15px rgba(18,3,31,.45),0 0 20px rgba(216,180,254,.16)!important;
            }
            #lcst-panel-fixed .lcst-subtitle{
                color:rgba(233,213,255,.84)!important;
            }
            #lcst-panel-fixed .lcst-version{
                background:rgba(251,191,36,.17)!important;
                border-color:rgba(253,224,71,.34)!important;
                color:#fde68a!important;
                box-shadow:0 0 13px rgba(251,191,36,.10)!important;
            }
            #lcst-panel-fixed .lcst-nova-live-chip{
                background:rgba(16,185,129,.16)!important;
                border-color:rgba(110,231,183,.34)!important;
                color:#a7f3d0!important;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.10)!important;
            }
            #lcst-panel-fixed .lcst-nova-close{
                background:linear-gradient(135deg,#f43f5e,#e11d48)!important;
                border-color:rgba(255,228,230,.34)!important;
                color:#ffffff!important;
                box-shadow:0 10px 23px rgba(190,24,93,.26),inset 0 1px 0 rgba(255,255,255,.20)!important;
            }
            #lcst-panel-fixed .lcst-nova-close:hover{
                background:linear-gradient(135deg,#fb7185,#e11d48)!important;
            }

            /* Logo resmi LINE TOGEL menggantikan ikon scanner pada header */
            #lcst-panel-fixed .lcst-nova-logo{
                position:relative!important;
                width:200px!important;
                min-width:200px!important;
                height:76px!important;
                flex:0 0 200px!important;
                display:flex!important;
                align-items:center!important;
                justify-content:center!important;
                padding:0!important;
                overflow:visible!important;
                border-radius:0!important;
                border:0!important;
                background:none!important;
                box-shadow:none!important;
            }
            #lcst-panel-fixed .lcst-nova-logo:before,
            #lcst-panel-fixed .lcst-nova-logo:after{
                display:none!important;
            }
            #lcst-header-logo-img{
                position:relative!important;
                display:block!important;
                width:100%!important;
                height:100%!important;
                max-width:100%!important;
                max-height:100%!important;
                object-fit:contain!important;
                object-position:center!important;
                margin:0!important;
                padding:0!important;
                border:0!important;
                opacity:0!important;
                filter:
                    saturate(1.20)
                    contrast(1.08)
                    drop-shadow(0 8px 10px rgba(47,0,12,.34))
                    drop-shadow(0 15px 22px rgba(122,7,34,.24))
                    drop-shadow(0 0 15px rgba(255,194,67,.30))!important;
                transition:opacity .25s ease!important;
                z-index:2!important;
            }
            #lcst-panel-fixed .lcst-header-logo-fallback{
                position:absolute!important;
                inset:0!important;
                display:grid!important;
                place-items:center!important;
                color:#ffe4a6!important;
                font:1000 24px/1 Inter,Segoe UI,Arial,sans-serif!important;
                letter-spacing:3px!important;
                text-shadow:0 3px 10px rgba(0,0,0,.38),0 0 15px rgba(255,191,61,.32)!important;
                z-index:1!important;
                transition:opacity .2s ease!important;
            }
            #lcst-panel-fixed.lcst-header-logo-loaded #lcst-header-logo-img{
                opacity:1!important;
            }
            #lcst-panel-fixed.lcst-header-logo-loaded .lcst-header-logo-fallback{
                opacity:0!important;
            }
            #lcst-panel-fixed.lcst-header-logo-error #lcst-header-logo-img{
                display:none!important;
            }

            /* Logo header berada tepat di tengah dan mengambang */
            #lcst-panel-fixed .lcst-nova-topbar{
                position:sticky!important;
                overflow:visible!important;
                min-height:100px!important;
            }
            #lcst-panel-fixed .lcst-nova-topbar .lcst-brand{
                position:static!important;
            }
            #lcst-panel-fixed .lcst-nova-brand-copy,
            #lcst-panel-fixed .lcst-nova-top-actions{
                position:relative!important;
                z-index:6!important;
            }
            #lcst-panel-fixed .lcst-nova-logo{
                position:absolute!important;
                left:50%!important;
                top:50%!important;
                margin:0!important;
                transform:translate(-50%,-50%)!important;
                z-index:8!important;
                isolation:isolate!important;
                overflow:visible!important;
                pointer-events:none!important;
                animation:lcstHeaderLogoCenterFloat 3.4s ease-in-out infinite!important;
                background:none!important;
                border:0!important;
                box-shadow:none!important;
            }
            #lcst-panel-fixed .lcst-nova-logo:before,
            #lcst-panel-fixed .lcst-nova-logo:after{
                display:none!important;
            }
            @keyframes lcstHeaderLogoCenterFloat{
                0%,100%{transform:translate(-50%,-50%) translateY(-2px) scale(1)}
                50%{transform:translate(-50%,-50%) translateY(-8px) scale(1.035)}
            }
            @keyframes lcstHeaderLogoMobileFloat{
                0%,100%{transform:translateY(0) scale(1)}
                50%{transform:translateY(-6px) scale(1.035)}
            }
            #lcst-panel-fixed .lcst-card,
            #lcst-panel-fixed .lcst-nova-status,
            #lcst-panel-fixed .lcst-nova-stat,
            #lcst-panel-fixed .lcst-nova-stat.ok,
            #lcst-panel-fixed .lcst-nova-stat.bad,
            #lcst-panel-fixed .lcst-nova-stat.user,
            #lcst-panel-fixed .lcst-nova-stat.mode,
            #lcst-panel-fixed .lcst-nova-stat.live{
                background:
                    radial-gradient(circle at 10% 0%,rgba(216,180,254,.16),transparent 34%),
                    radial-gradient(circle at 95% 100%,rgba(129,140,248,.14),transparent 38%),
                    linear-gradient(145deg,rgba(29,10,53,.82),rgba(59,23,102,.78) 52%,rgba(76,29,149,.74))!important;
                backdrop-filter:none!important;
                border-color:rgba(216,180,254,.28)!important;
                color:#f8f2ff!important;
                box-shadow:
                    0 18px 42px rgba(30,7,54,.30),
                    inset 0 1px 0 rgba(255,255,255,.13),
                    inset 0 -1px 0 rgba(126,34,206,.18)!important;
            }

            /* Hero dan kartu informasi */
            #lcst-panel-fixed .lcst-nova-status-icon{
                background:rgba(192,132,252,.16)!important;
                border-color:rgba(216,180,254,.30)!important;
                box-shadow:0 0 20px rgba(168,85,247,.14)!important;
            }
            #lcst-panel-fixed .lcst-nova-status-icon svg{
                stroke:#e9d5ff!important;
                filter:drop-shadow(0 0 7px rgba(216,180,254,.30))!important;
            }
            #lcst-panel-fixed .lcst-nova-status .lcst-status-title{
                color:#f0abfc!important;
            }
            #lcst-panel-fixed .lcst-nova-status .lcst-ocr-box{
                color:#ffffff!important;
                text-shadow:0 2px 11px rgba(10,0,25,.35)!important;
            }
            #lcst-panel-fixed .lcst-nova-status .lcst-progress{
                background:rgba(17,5,35,.56)!important;
            }
            #lcst-panel-fixed .lcst-nova-status .lcst-progress span{
                background:linear-gradient(90deg,#c084fc,#8b5cf6,#6366f1,#f0abfc)!important;
                box-shadow:0 0 15px rgba(192,132,252,.55)!important;
            }
            #lcst-panel-fixed .lcst-nova-stat-label{
                color:#f0abfc!important;
            }
            #lcst-panel-fixed .lcst-nova-stat strong,
            #lcst-panel-fixed .lcst-nova-stat .lcst-user-edit{
                color:#ffffff!important;
            }
            #lcst-panel-fixed .lcst-nova-stat small{
                color:rgba(233,213,255,.76)!important;
            }
            #lcst-panel-fixed .lcst-nova-stat .lcst-inline-copy{
                color:#e9d5ff!important;
                background:rgba(192,132,252,.12)!important;
                border-color:rgba(216,180,254,.26)!important;
            }

            /* Sidebar, periode, dan panduan cepat */
            #lcst-panel-fixed .lcst-nova-section-head b,
            #lcst-panel-fixed .lcst-nova-guide-row b{
                color:#ffffff!important;
            }
            #lcst-panel-fixed .lcst-nova-section-head small,
            #lcst-panel-fixed .lcst-nova-guide-row small,
            #lcst-panel-fixed .lcst-nova-guide-title{
                color:rgba(233,213,255,.76)!important;
            }
            #lcst-panel-fixed .lcst-nova-step,
            #lcst-panel-fixed .lcst-nova-section-head.orange .lcst-nova-step,
            #lcst-panel-fixed .lcst-nova-guide-row>span{
                background:rgba(192,132,252,.16)!important;
                border-color:rgba(216,180,254,.30)!important;
                color:#f5d0fe!important;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.10)!important;
            }
            #lcst-panel-fixed .lcst-nova-guide-row{
                border-color:rgba(216,180,254,.14)!important;
            }

            /* Semua input dibuat ungu gelap, tidak ada kotak putih */
            #lcst-panel-fixed .lcst-input,
            #lcst-panel-fixed #lcst-output{
                background:linear-gradient(145deg,rgba(18,5,37,.90),rgba(43,13,76,.88))!important;
                border-color:rgba(216,180,254,.28)!important;
                color:#f8f2ff!important;
                box-shadow:inset 0 2px 10px rgba(5,0,14,.30),inset 0 1px 0 rgba(255,255,255,.06)!important;
            }
            #lcst-panel-fixed .lcst-input::placeholder,
            #lcst-panel-fixed #lcst-output::placeholder{
                color:rgba(221,214,254,.52)!important;
            }
            #lcst-panel-fixed .lcst-input:focus,
            #lcst-panel-fixed #lcst-output:focus{
                background:linear-gradient(145deg,rgba(24,7,48,.96),rgba(55,18,94,.94))!important;
                border-color:rgba(216,180,254,.66)!important;
                box-shadow:0 0 0 4px rgba(168,85,247,.14),0 0 22px rgba(139,92,246,.13)!important;
            }

            /* Status rekening dan status scan */
            #lcst-panel-fixed .lcst-scan-state,
            #lcst-panel-fixed .lcst-scan-state.waiting,
            #lcst-panel-fixed .lcst-scan-state.scanning,
            #lcst-panel-fixed .lcst-scan-state.success,
            #lcst-panel-fixed .lcst-scan-state.partial,
            #lcst-panel-fixed .lcst-scan-state.failed{
                background:linear-gradient(145deg,rgba(32,10,61,.90),rgba(61,22,103,.84))!important;
                border-color:rgba(216,180,254,.24)!important;
                box-shadow:0 10px 24px rgba(20,3,39,.24),inset 0 1px 0 rgba(255,255,255,.09)!important;
            }
            #lcst-panel-fixed .lcst-scan-state-label{
                color:#d8b4fe!important;
            }
            #lcst-panel-fixed .lcst-scan-state-detail{
                color:rgba(233,213,255,.68)!important;
            }
            #lcst-panel-fixed .lcst-scan-state.waiting .lcst-scan-state-text{color:#c4b5fd!important}
            #lcst-panel-fixed .lcst-scan-state.scanning .lcst-scan-state-text{color:#67e8f9!important}
            #lcst-panel-fixed .lcst-scan-state.success .lcst-scan-state-text{color:#6ee7b7!important}
            #lcst-panel-fixed .lcst-scan-state.partial .lcst-scan-state-text{color:#fde68a!important}
            #lcst-panel-fixed .lcst-scan-state.failed .lcst-scan-state-text{color:#fda4af!important}

            /* Output Excel ikut ungu */
            #lcst-panel-fixed .lcst-nova-output-card .lcst-nova-kicker{
                color:#f0abfc!important;
            }
            #lcst-panel-fixed .lcst-nova-output-card h4{
                color:#ffffff!important;
                text-shadow:0 2px 12px rgba(10,0,25,.36)!important;
            }
            #lcst-panel-fixed .lcst-nova-output-card p{
                color:rgba(233,213,255,.74)!important;
            }
            #lcst-panel-fixed #lcst-output{
                color:#f5e9ff!important;
                caret-color:#f0abfc!important;
            }

            /* WORKSPACE transparan: logo terlihat di belakang galeri */
            #lcst-panel-fixed .lcst-nova-main,
            #lcst-panel-fixed .lcst-nova-gallery-card,
            #lcst-panel-fixed #lcst-image-grid{
                background:transparent!important;
            }
            #lcst-panel-fixed .lcst-nova-gallery-card{
                border:1px solid rgba(255,218,137,.34)!important;
                backdrop-filter:none!important;
                box-shadow:
                    0 22px 48px rgba(18,0,5,.24),
                    inset 0 1px 0 rgba(255,245,219,.18)!important;
            }
            #lcst-panel-fixed .lcst-nova-gallery-head{
                padding:14px 15px!important;
                border:1px solid rgba(255,218,137,.24)!important;
                border-radius:18px!important;
                background:linear-gradient(135deg,rgba(52,2,15,.62),rgba(112,8,31,.43))!important;
                backdrop-filter:blur(8px) saturate(118%)!important;
                box-shadow:0 13px 30px rgba(18,0,5,.18),inset 0 1px 0 rgba(255,236,190,.15)!important;
            }
            #lcst-panel-fixed .lcst-nova-gallery-head .lcst-nova-kicker{
                color:#ffd57c!important;
                text-shadow:0 0 12px rgba(255,184,56,.26)!important;
            }
            #lcst-panel-fixed .lcst-nova-gallery-head h4{
                color:#fff4df!important;
                text-shadow:0 2px 13px rgba(0,0,0,.34)!important;
            }
            #lcst-panel-fixed .lcst-nova-gallery-head p{
                color:rgba(255,231,210,.82)!important;
            }
            #lcst-panel-fixed .lcst-nova-gallery-card .lcst-img-card{
                background:rgba(255,255,255,.08)!important;
                border-color:rgba(255,218,137,.26)!important;
                backdrop-filter:none!important;
                box-shadow:
                    0 15px 28px rgba(20,0,5,.23),
                    inset 0 1px 0 rgba(255,245,219,.15)!important;
            }
            #lcst-panel-fixed .lcst-nova-gallery-card .lcst-img-card:hover{
                border-color:rgba(255,218,137,.55)!important;
                box-shadow:
                    0 20px 38px rgba(20,0,5,.30),
                    0 0 24px rgba(255,180,53,.14)!important;
            }
            #lcst-panel-fixed .lcst-nova-gallery-card .lcst-img-media,
            #lcst-panel-fixed .lcst-nova-gallery-card .lcst-img-card img{
                background:transparent!important;
            }
            #lcst-panel-fixed .lcst-nova-gallery-card .lcst-img-label{
                color:rgba(255,232,215,.82)!important;
                background:rgba(47,2,14,.48)!important;
                border-top-color:rgba(255,218,137,.16)!important;
            }
            #lcst-panel-fixed .lcst-nova-gallery-card .lcst-empty{
                background:rgba(54,3,17,.30)!important;
                border-color:rgba(255,218,137,.28)!important;
                color:#ffe1ba!important;
                backdrop-filter:blur(5px)!important;
            }
            #lcst-panel-fixed .lcst-nova-gallery-card .lcst-empty b{
                color:#fff3dd!important;
            }

            /* Bubble memakai kembali background gambar sebelumnya */
            #lcst-bubble-fixed{
                width:86px!important;
                height:86px!important;
                border-radius:50%!important;
                border:2px solid rgba(255,255,255,.94)!important;
                background-color:#171717!important;
                background-image:url("https://i.postimg.cc/jSc32qYs/85c5a789-2ae2-4b4f-897d-9aab6a0c6b4f.png")!important;
                background-repeat:no-repeat!important;
                background-position:center center!important;
                background-size:cover!important;
                overflow:hidden!important;
                isolation:isolate!important;
                box-shadow:
                    0 10px 16px rgba(69,26,18,.22),
                    0 23px 48px rgba(69,26,18,.34),
                    0 0 0 5px rgba(255,255,255,.38),
                    0 0 0 8px rgba(255,176,32,.13),
                    0 0 30px rgba(239,45,57,.22)!important;
            }
            #lcst-bubble-fixed:before,
            #lcst-bubble-fixed:after,
            #lcst-bubble-fixed .lcst-nova-ring,
            #lcst-bubble-fixed .lcst-nova-lens,
            #lcst-bubble-fixed .lcst-nova-caption,
            #lcst-bubble-fixed .lcst-nova-online{
                display:none!important;
            }
            #lcst-bubble-fixed:hover{
                transform:translateY(-5px) scale(1.07)!important;
                border-color:#ffffff!important;
                box-shadow:
                    0 13px 19px rgba(69,26,18,.20),
                    0 29px 58px rgba(69,26,18,.38),
                    0 0 0 6px rgba(255,255,255,.44),
                    0 0 0 9px rgba(255,176,32,.16),
                    0 0 42px rgba(239,45,57,.30)!important;
            }
            #lcst-bubble-fixed.lcst-dragging{
                transform:scale(1.075)!important;
                cursor:grabbing!important;
                opacity:.96!important;
            }

            @media(max-width:820px){
                #lcst-panel-fixed{
                    background-position:center center,center 34%,left top,right top,center bottom,center center!important;
                    background-size:100% 100%,88vw auto,100% 100%,100% 100%,100% 100%,100% 100%!important;
                }
                #lcst-dashboard-brand-bg{
                    width:88vw!important;
                    height:52vh!important;
                    top:43%!important;
                }
                #lcst-dashboard-logo-bg{width:88%!important;height:45%!important}
                #lcst-panel-fixed .lcst-nova-logo{
                    width:160px!important;
                    min-width:160px!important;
                    height:66px!important;
                    flex-basis:160px!important;
                    position:relative!important;
                    left:auto!important;
                    top:auto!important;
                    margin:0 auto 10px!important;
                    transform:none!important;
                    animation:lcstHeaderLogoMobileFloat 3.4s ease-in-out infinite!important;
                }
                #lcst-panel-fixed .lcst-nova-topbar .lcst-brand{
                    width:100%!important;
                    display:flex!important;
                    flex-direction:column!important;
                    align-items:center!important;
                    text-align:center!important;
                }
            }

        `;
        document.head.appendChild(style);
    }

    /*
     * Memuat logo dashboard lewat jalur userscript agar tidak hilang karena
     * pembatasan hotlink/CSP halaman LiveChat. URL langsung tetap dipakai
     * sebagai fallback sambil menunggu data gambar selesai dimuat.
     */
    function lcstApplyDashboardLogo(img) {
        if (!img) return;
        img.referrerPolicy = 'no-referrer';
        img.src = lcstDashboardLogoDataUrl || LCST_DASHBOARD_LOGO_URL;

        if (lcstDashboardLogoDataUrl) return;
        if (typeof GM_xmlhttpRequest !== 'function') return;

        if (!lcstDashboardLogoPromise) {
            lcstDashboardLogoPromise = new Promise(function (resolve, reject) {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: LCST_DASHBOARD_LOGO_URL,
                    responseType: 'blob',
                    timeout: 20000,
                    headers: {
                        'Accept': 'image/png,image/*;q=0.9,*/*;q=0.5'
                    },
                    onload: function (response) {
                        try {
                            if (response.status && (response.status < 200 || response.status >= 300)) {
                                reject(new Error('Logo HTTP ' + response.status));
                                return;
                            }
                            const blob = response.response instanceof Blob
                                ? response.response
                                : new Blob([response.response], { type: 'image/png' });
                            if (!blob || !blob.size) {
                                reject(new Error('Logo kosong'));
                                return;
                            }
                            const reader = new FileReader();
                            reader.onload = function () {
                                const dataUrl = String(reader.result || '');
                                if (!dataUrl.startsWith('data:image/')) {
                                    reject(new Error('Format logo tidak valid'));
                                    return;
                                }
                                lcstDashboardLogoDataUrl = dataUrl;
                                resolve(dataUrl);
                            };
                            reader.onerror = function () { reject(new Error('Logo gagal dibaca')); };
                            reader.readAsDataURL(blob);
                        } catch (error) {
                            reject(error);
                        }
                    },
                    onerror: function () { reject(new Error('Logo gagal dimuat')); },
                    ontimeout: function () { reject(new Error('Logo timeout')); }
                });
            });
        }

        lcstDashboardLogoPromise.then(function (dataUrl) {
            if (img && img.isConnected) img.src = dataUrl;
        }).catch(function () {
            lcstDashboardLogoPromise = null;
            if (img && img.isConnected && !img.src) img.src = LCST_DASHBOARD_LOGO_URL;
        });
    }

    function createBubble() {
        if (document.getElementById('lcst-bubble-fixed')) return;
        injectStyle();

        const bubble = document.createElement('button');
        bubble.id = 'lcst-bubble-fixed';
        bubble.type = 'button';
        bubble.title = 'Buka Scanner LINE TOGEL';
        bubble.setAttribute('aria-label', 'Buka Scanner LINE TOGEL');
        bubble.innerHTML = `
            <span class="lcst-nova-ring" aria-hidden="true"></span>
            <span class="lcst-nova-lens" aria-hidden="true">
                <span class="lcst-nova-lens-dot"></span>
                <span class="lcst-nova-laser"></span>
                <span class="lcst-nova-corner c1"></span>
                <span class="lcst-nova-corner c2"></span>
                <span class="lcst-nova-corner c3"></span>
                <span class="lcst-nova-corner c4"></span>
            </span>
            <span class="lcst-nova-caption">SCAN</span>
            <span class="lcst-nova-online" aria-hidden="true"></span>
        `;
        document.body.appendChild(bubble);

        const saved = safeJSONParse(localStorage.getItem(POS_KEY), null);
        if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
            bubble.style.left = Math.max(10, Math.min(innerWidth - bubble.offsetWidth - 10, saved.left)) + 'px';
            bubble.style.top = Math.max(10, Math.min(innerHeight - bubble.offsetHeight - 10, saved.top)) + 'px';
            bubble.style.right = 'auto';
            bubble.style.bottom = 'auto';
        }

        let dragging = false;
        let moved = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        bubble.addEventListener('pointerdown', function (e) {
            if (e.button != null && e.button !== 0) return;
            dragging = true;
            moved = false;
            const rect = bubble.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            bubble.classList.add('lcst-dragging');
            bubble.style.left = rect.left + 'px';
            bubble.style.top = rect.top + 'px';
            bubble.style.right = 'auto';
            bubble.style.bottom = 'auto';
            try { bubble.setPointerCapture(e.pointerId); } catch (err) {}
        });

        bubble.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            e.preventDefault();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > 5) moved = true;
            const left = Math.max(6, Math.min(innerWidth - bubble.offsetWidth - 6, startLeft + dx));
            const top  = Math.max(6, Math.min(innerHeight - bubble.offsetHeight - 6, startTop + dy));
            bubble.style.left = left + 'px';
            bubble.style.top = top + 'px';
        });

        bubble.addEventListener('pointerup', function (e) {
            if (!dragging) return;
            dragging = false;
            bubble.classList.remove('lcst-dragging');
            const rect = bubble.getBoundingClientRect();
            localStorage.setItem(POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
            try { bubble.releasePointerCapture(e.pointerId); } catch (err) {}
            if (!moved) openTool();
        });
    }

    function isBadUrl(url) {
        if (!url) return true;
        const u = String(url).toLowerCase();
        return u.includes('avatar') || u.includes('profile') || u.includes('logo') || u.includes('sprite') || u.includes('emoji') || u.includes('icon') || u.includes('gravatar');
    }

    function normalizeUrl(url) {
        if (!url) return '';
        url = String(url).trim();
        if (!url || url === 'none') return '';
        if (url.startsWith('//')) url = location.protocol + url;
        try { return new URL(url, location.href).href; } catch (e) { return url; }
    }

    function addUnique(list, url) {
        url = normalizeUrl(url);
        if (!url || isBadUrl(url)) return;
        if (!/^https?:|^blob:|^data:image\//i.test(url)) return;
        if (!list.includes(url)) list.push(url);
    }

    function extractBgUrl(bg) {
        const out = [];
        if (!bg || bg === 'none') return out;
        const re = /url\((['"]?)(.*?)\1\)/gi;
        let m;
        while ((m = re.exec(bg)) !== null) out.push(m[2]);
        return out;
    }

    function isVisibleElement(el) {
        if (!el || el.nodeType !== 1) return false;
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    function shortText(el) {
        return ((el && (el.innerText || el.textContent)) || '').trim().replace(/\s+/g, ' ');
    }

    function getScrollScopeFrom(el) {
        if (!el) return null;
        let cur = el;
        let best = null;
        while (cur && cur !== document.body && cur !== document.documentElement) {
            const r = cur.getBoundingClientRect();
            const st = getComputedStyle(cur);
            const overflowY = (st.overflowY || '').toLowerCase();
            const scrollable = /(auto|scroll|overlay)/.test(overflowY) || cur.scrollHeight > cur.clientHeight + 80;
            const goodSize = r.width >= 280 && r.height >= 220;
            if (goodSize && scrollable) {
                best = cur;
                break;
            }
            cur = cur.parentElement;
        }

        if (best) return best;

        cur = el;
        while (cur && cur !== document.body && cur !== document.documentElement) {
            const r = cur.getBoundingClientRect();
            const t = shortText(cur);
            const goodSize = r.width >= 320 && r.height >= 260;
            const notWholePage = r.width < innerWidth * 0.98 || r.height < innerHeight * 0.98;
            if (goodSize && notWholePage && t.length < 40000) return cur;
            cur = cur.parentElement;
        }
        return null;
    }

    function findVisibleTextElement(pattern, root) {
        const base = root || document;
        const els = Array.from(base.querySelectorAll('p,span,div,time,section,article,[role="listitem"],[data-testid]'));
        for (let i = els.length - 1; i >= 0; i--) {
            const el = els[i];
            // Jangan pernah membaca panel script sendiri sebagai isi chat aktif.
            if (el.closest && el.closest('#lcst-panel-fixed')) continue;
            if (!isVisibleElement(el)) continue;
            const t = shortText(el);
            if (!t || t.length > 260) continue;
            if (pattern.test(t)) return el;
        }
        return null;
    }

    function findActiveScope() {
        // Prioritas 1: chat aktif yang memiliki marker Started - Today.
        const markerEl = findVisibleTextElement(/Started\s*-\s*Today|Today\s*-\s*Started|Started.*Today/i, document);
        if (markerEl) {
            const scope = getScrollScopeFrom(markerEl);
            if (scope) return { scope, markerHint: markerEl, reason: 'marker' };
        }

        // Prioritas 2: chat aktif yang memiliki USER ID.
        const userEl = findVisibleTextElement(/USER\s*ID\s*[:：]\s*[A-Za-z0-9_.-]+/i, document);
        if (userEl) {
            const scope = getScrollScopeFrom(userEl);
            if (scope) return { scope, markerHint: null, reason: 'user_id' };
        }

        // Prioritas 3: kandidat area utama LiveChat yang terlihat, bukan seluruh halaman.
        const common = [
            '[data-testid*="chat"]', '[data-test*="chat"]', '[class*="chat"]',
            '[data-testid*="conversation"]', '[class*="conversation"]',
            '[data-testid*="thread"]', '[class*="thread"]',
            '[role="main"]', 'main'
        ];
        for (const sel of common) {
            const items = Array.from(document.querySelectorAll(sel)).filter(isVisibleElement);
            for (let i = items.length - 1; i >= 0; i--) {
                const el = items[i];
                const r = el.getBoundingClientRect();
                const t = shortText(el);
                if (r.width >= 320 && r.height >= 260 && t.length < 60000) {
                    return { scope: el, markerHint: null, reason: 'livechat_area' };
                }
            }
        }

        // Sengaja tidak fallback ke document.body agar tidak scan semua chat/semua gambar halaman.
        return { scope: null, markerHint: null, reason: 'not_found' };
    }

    function findMarker(root, markerHint) {
        if (markerHint && root && root.contains(markerHint)) {
            return { marker: markerHint, markerText: shortText(markerHint) || 'Started - Today' };
        }
        let marker = null;
        let markerText = 'Tidak terdeteksi';
        if (!root) return { marker, markerText };
        const els = Array.from(root.querySelectorAll('p,span,div,time,section'));
        for (let i = els.length - 1; i >= 0; i--) {
            if (!isVisibleElement(els[i])) continue;
            const t = shortText(els[i]);
            if (t.length < 140 && /Started\s*-\s*Today|Today\s*-\s*Started|Started.*Today/i.test(t)) {
                marker = els[i];
                markerText = t;
                break;
            }
        }
        return { marker, markerText };
    }

    function findUserId(root) {
        const candidates = [];
        let order = 0;

        function cleanUserId(value) {
            const cleaned = String(value || '')
                .trim()
                .replace(/^[\s:：=\-]+/, '')
                .replace(/[\s,;|)\]}]+$/, '');
            if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{1,49}$/.test(cleaned)) return '';
            if (/^(?:user|userid|id|member|player|livechat|chat|copy|salin|nama|rekening|data|aktif|terdeteksi|belum|otomatis|tampilan)$/i.test(cleaned)) return '';
            // Semua User ID dinormalisasi ke huruf kecil sejak pertama terdeteksi.
            return cleaned.toLowerCase();
        }

        function addCandidate(value, score) {
            const userId = cleanUserId(value);
            if (!userId) return;
            order += 1;
            const existing = candidates.find(item => item.userId.toLowerCase() === userId.toLowerCase());
            if (existing) {
                if (score > existing.score || (score === existing.score && order > existing.order)) {
                    existing.userId = userId;
                    existing.score = score;
                    existing.order = order;
                }
                return;
            }
            candidates.push({ userId, score, order });
        }

        function extractFromLine(line, score) {
            const textLine = String(line || '').trim();
            if (!textLine || textLine.length > 180) return;
            const patterns = [
                /(?:^|[\s(])USER\s*ID\s*(?:(?:[:：=\-])|(?:ADALAH\b))\s*([A-Za-z0-9][A-Za-z0-9_.-]{1,49})(?=$|[\s,;|)\]}])/i,
                /(?:^|[\s(])USERID\s*(?:(?:[:：=\-])|(?:ADALAH\b))\s*([A-Za-z0-9][A-Za-z0-9_.-]{1,49})(?=$|[\s,;|)\]}])/i,
                /(?:^|[\s(])ID\s*USER\s*(?:(?:[:：=\-])|(?:ADALAH\b))\s*([A-Za-z0-9][A-Za-z0-9_.-]{1,49})(?=$|[\s,;|)\]}])/i,
                /(?:^|[\s(])USER\s*ID\s+([A-Za-z0-9][A-Za-z0-9_.-]{1,49})(?=$|[\s,;|)\]}])/i,
                /(?:^|[\s(])USERID\s+([A-Za-z0-9][A-Za-z0-9_.-]{1,49})(?=$|[\s,;|)\]}])/i,
                /(?:^|[\s(])ID\s*USER\s+([A-Za-z0-9][A-Za-z0-9_.-]{1,49})(?=$|[\s,;|)\]}])/i
            ];
            for (const re of patterns) {
                const match = textLine.match(re);
                if (match) {
                    addCandidate(match[1], score);
                    return;
                }
            }
        }

        function isOwnPanelElement(el) {
            return !!(el && el.closest && el.closest('#lcst-panel-fixed'));
        }

        // Prioritas utama: field profil LiveChat yang memang berlabel USER ID.
        const fields = Array.from(document.querySelectorAll('input,textarea,[contenteditable="true"]'));
        fields.forEach((el) => {
            if (isOwnPanelElement(el) || !isVisibleElement(el)) return;
            if (String(el.type || '').toLowerCase() === 'hidden') return;
            const labels = el.labels ? Array.from(el.labels).map(shortText).join(' ') : '';
            const previous = el.previousElementSibling ? shortText(el.previousElementSibling) : '';
            const parent = el.parentElement ? shortText(el.parentElement) : '';
            const hint = [
                el.getAttribute && el.getAttribute('aria-label'),
                el.getAttribute && el.getAttribute('placeholder'),
                el.getAttribute && el.getAttribute('name'),
                el.id,
                labels,
                previous,
                parent.length <= 180 ? parent : ''
            ].filter(Boolean).join(' ');
            if (!/(?:USER\s*ID|USERID|ID\s*USER)/i.test(hint)) return;
            const value = 'value' in el ? el.value : shortText(el);
            addCandidate(value, root && root.contains(el) ? 1080 : 1160);
        });

        // Prioritas berikutnya: pasangan label USER ID dan nilai di panel profil aktif.
        const labelNodes = Array.from(document.querySelectorAll('label,span,div,p,dt,th,strong,b'));
        labelNodes.forEach((labelEl) => {
            if (isOwnPanelElement(labelEl)) return;
            const quickLabelText = String(labelEl.textContent || '').trim().replace(/\s+/g, ' ');
            if (!/^(?:USER\s*ID|USERID|ID\s*USER)\s*[:：]?$/.test(quickLabelText)) return;
            if (!isVisibleElement(labelEl)) return;
            const labelText = shortText(labelEl);
            if (!/^(?:USER\s*ID|USERID|ID\s*USER)\s*[:：]?$/.test(labelText)) return;

            const possible = [];
            if (labelEl.nextElementSibling) possible.push(labelEl.nextElementSibling);
            const parent = labelEl.parentElement;
            if (parent) {
                const children = Array.from(parent.children || []);
                const labelIndex = children.indexOf(labelEl);
                if (labelIndex >= 0) possible.push(...children.slice(labelIndex + 1, labelIndex + 3));
            }

            possible.forEach((valueEl) => {
                if (!valueEl || isOwnPanelElement(valueEl) || !isVisibleElement(valueEl)) return;
                const value = 'value' in valueEl ? valueEl.value : shortText(valueEl);
                addCandidate(value, root && root.contains(labelEl) ? 960 : 1040);
            });
        });

        // Baca pesan hanya dari scope chat aktif dan tetap per baris agar tidak mengambil kata di baris berikutnya.
        if (root && !isOwnPanelElement(root)) {
            const nodes = [root].concat(Array.from(root.querySelectorAll('p,span,div,li,td,dd,strong,b,[data-testid]')));
            nodes.forEach((el) => {
                if (!el || isOwnPanelElement(el)) return;
                const quickRaw = String(el.textContent || '').trim();
                if (!quickRaw || quickRaw.length > 600) return;
                if (!isVisibleElement(el)) return;
                const raw = String(el.innerText || el.textContent || '').trim();
                if (!raw || raw.length > 600) return;
                const lines = raw.split(/[\r\n]+/).map(v => v.trim()).filter(Boolean);
                lines.forEach(line => extractFromLine(line, 820));

                for (let i = 0; i < lines.length - 1; i++) {
                    if (/^(?:USER\s*ID|USERID|ID\s*USER)\s*[:：]?$/.test(lines[i])) {
                        addCandidate(lines[i + 1], 880);
                    }
                }
            });

            // Fallback terakhir tetap dibatasi per baris, bukan seluruh teks sekaligus.
            const rootLines = String(root.innerText || root.textContent || '')
                .split(/[\r\n]+/)
                .map(v => v.trim())
                .filter(Boolean);
            rootLines.forEach(line => extractFromLine(line, 700));
            for (let i = 0; i < rootLines.length - 1; i++) {
                if (/^(?:USER\s*ID|USERID|ID\s*USER)\s*[:：]?$/.test(rootLines[i])) {
                    addCandidate(rootLines[i + 1], 760);
                }
            }
        }

        candidates.sort((a, b) => b.score - a.score || b.order - a.order);
        const selected = candidates.length ? candidates[0].userId : 'user';

        // Pertahankan format lama: ID yang dipakai ditempatkan terakhir pada allIds.
        const allIds = candidates
            .slice()
            .sort((a, b) => a.order - b.order)
            .map(item => item.userId)
            .filter((value, index, list) => list.findIndex(item => item.toLowerCase() === value.toLowerCase()) === index)
            .filter(value => value.toLowerCase() !== selected.toLowerCase());
        if (selected !== 'user') allIds.push(selected);

        return { userId: selected, allIds };
    }

    function isAfterMarker(marker, el) {
        if (!marker || !marker.isConnected) return true;
        try {
            return !!(marker.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
        } catch (e) {
            return true;
        }
    }

    function isRenderedInsideScope(el, root) {
        if (!el || !root || !root.contains(el)) return false;
        try {
            const st = getComputedStyle(el);
            if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
        } catch (e) {}
        return true;
    }

    function looksLikeChatImageUrl(url) {
        const value = String(url || '').trim();
        if (!value) return false;
        if (/^data:image\//i.test(value) || /^blob:/i.test(value)) return true;
        return /\.(?:jpe?g|png|webp|gif|bmp|avif)(?:[?#]|$)/i.test(value) ||
            /(?:files?|usercontent|attachment|image|upload|download|storage|media|cdn|file_id|attachment_id)/i.test(value);
    }

    function collectSrcsetUrls(srcset, output) {
        String(srcset || '').split(',').forEach((part) => {
            const value = part.trim().split(/\s+/)[0];
            if (value) output.push(value);
        });
    }

    function getImageUrlsFromElement(el) {
        const urls = [];
        if (!el || !el.getAttribute) return urls;

        const attrs = [
            'src', 'href', 'data-src', 'data-original', 'data-url', 'data-image-url',
            'data-file-url', 'data-download-url', 'data-attachment-url', 'data-media-url',
            'data-preview-url', 'data-full-src', 'data-lazy-src'
        ];
        attrs.forEach((name) => {
            const value = el.getAttribute(name);
            if (value) urls.push(value);
        });

        if (el.currentSrc) urls.push(el.currentSrc);
        if (el.src && typeof el.src === 'string') urls.push(el.src);
        if (el.href && typeof el.href === 'string') urls.push(el.href);

        collectSrcsetUrls(el.getAttribute('srcset'), urls);
        collectSrcsetUrls(el.getAttribute('data-srcset'), urls);

        const inlineStyle = el.style && el.style.backgroundImage ? el.style.backgroundImage : '';
        extractBgUrl(inlineStyle).forEach((url) => urls.push(url));
        try {
            const computedBg = getComputedStyle(el).backgroundImage;
            extractBgUrl(computedBg).forEach((url) => urls.push(url));
        } catch (e) {}

        return urls;
    }

    function addElementImageUrls(el, root, marker, images, ignoreMarker) {
        if (!isRenderedInsideScope(el, root)) return;
        if (!ignoreMarker && !isAfterMarker(marker, el)) return;

        const tag = String(el.tagName || '').toLowerCase();
        const w = Number(el.naturalWidth || el.width || el.clientWidth || 0);
        const h = Number(el.naturalHeight || el.height || el.clientHeight || 0);
        const urls = getImageUrlsFromElement(el);

        urls.forEach((url) => {
            if (!looksLikeChatImageUrl(url)) return;
            // Ikon/avatar kecil tetap dibuang, tetapi gambar lazy-load berukuran 0 tetap diterima.
            if (tag === 'img' && w > 0 && h > 0 && (w < 45 || h < 45)) return;
            addUnique(images, url);
        });
    }

    function collectImagesFromRoot(root, mk, images, options) {
        if (!root) return images;
        const opts = options || {};
        const ignoreMarker = !!opts.ignoreMarker;
        const marker = mk && mk.marker ? mk.marker : null;

        const selector = [
            'img', 'picture source', 'a[href]', '[srcset]', '[data-srcset]',
            '[data-src]', '[data-original]', '[data-url]', '[data-image-url]',
            '[data-file-url]', '[data-download-url]', '[data-attachment-url]',
            '[data-media-url]', '[data-preview-url]', '[data-full-src]', '[data-lazy-src]',
            '[style*="background-image"]'
        ].join(',');

        const nodes = [];
        if (root.matches && root.matches(selector)) nodes.push(root);
        try { nodes.push(...root.querySelectorAll(selector)); } catch (e) {}
        nodes.forEach((el) => addElementImageUrls(el, root, marker, images, ignoreMarker));
        return images;
    }

    function countAttachmentHints(root) {
        if (!root) return 0;
        const urls = [];
        collectImagesFromRoot(root, { marker: null }, urls, { ignoreMarker: true });
        return urls.length;
    }

    function addScopeCandidate(list, el, anchorWeight) {
        if (!el || el === document.body || el === document.documentElement) return;
        if (el.id === 'lcst-panel-fixed' || el.id === 'lcst-bubble-fixed') return;
        if (list.some((item) => item.el === el)) return;
        let rect;
        try { rect = el.getBoundingClientRect(); } catch (e) { return; }
        if (!rect || rect.width < 280 || rect.height < 220) return;
        if (rect.width > innerWidth * 0.98 && rect.height > innerHeight * 0.98) return;

        let score = Number(anchorWeight) || 0;
        try {
            const st = getComputedStyle(el);
            const scrollable = /(auto|scroll|overlay)/i.test(st.overflowY || '') || el.scrollHeight > el.clientHeight + 40;
            if (scrollable) score += 45;
        } catch (e) {}

        const hints = countAttachmentHints(el);
        score += Math.min(180, hints * 35);
        const text = shortText(el);
        if (/USER\s*ID|USERID|ID\s*USER/i.test(text)) score += 35;
        if (/Started\s*-\s*Today|Today\s*-\s*Started|Started.*Today/i.test(text)) score += 25;
        if (/(chat|conversation|thread|message)/i.test(String(el.className || '') + ' ' + String(el.getAttribute && el.getAttribute('data-testid') || ''))) score += 24;
        if (rect.width > innerWidth * 0.88) score -= 35;
        if (text.length > 70000) score -= 45;
        list.push({ el, score, hints });
    }

    function findAlternativeActiveScope(excludedRoot) {
        const candidates = [];
        const anchors = [
            findVisibleTextElement(/USER\s*ID\s*(?:[:：=\-]|ADALAH)?\s*[A-Za-z0-9_.-]+/i, document),
            findVisibleTextElement(/Started\s*-\s*Today|Today\s*-\s*Started|Started.*Today/i, document)
        ].filter(Boolean);

        anchors.forEach((anchor, anchorIndex) => {
            let cur = anchor;
            let depth = 0;
            while (cur && cur !== document.body && depth < 12) {
                addScopeCandidate(candidates, cur, 120 - depth * 5 - anchorIndex * 8);
                cur = cur.parentElement;
                depth++;
            }
        });

        const selectors = [
            '[data-testid*="conversation"]', '[data-testid*="chat"]', '[data-testid*="thread"]',
            '[data-test*="conversation"]', '[data-test*="chat"]',
            '[class*="conversation"]', '[class*="chat"]', '[class*="thread"]',
            '[role="main"]', 'main'
        ];
        selectors.forEach((selector) => {
            let items = [];
            try { items = Array.from(document.querySelectorAll(selector)); } catch (e) {}
            items.filter(isVisibleElement).forEach((el) => addScopeCandidate(candidates, el, 10));
        });

        candidates.sort((a, b) => b.score - a.score || b.hints - a.hints);
        const picked = candidates.find((item) => item.el !== excludedRoot && item.hints > 0) ||
            candidates.find((item) => item.el !== excludedRoot) || null;
        return picked ? { scope: picked.el, markerHint: null, reason: 'fallback_scored_scope' } : null;
    }

    function scanPageFromActive(active) {
        const root = active && active.scope;
        if (!root) return null;
        const uid = findUserId(root);
        const mk = findMarker(root, active.markerHint);
        const strictImages = [];
        const relaxedImages = [];
        collectImagesFromRoot(root, mk, strictImages, { ignoreMarker: false });
        if (!strictImages.length) {
            collectImagesFromRoot(root, mk, relaxedImages, { ignoreMarker: true });
        }
        const images = strictImages.length ? strictImages : relaxedImages;
        return {
            userId: uid.userId,
            allIds: uid.allIds,
            marker: mk.marker,
            markerText: mk.markerText,
            images,
            scopeReason: active.reason
        };
    }

    function scanPage() {
        const active = findActiveScope();
        if (!active.scope) {
            lastScan = {
                userId: 'user', allIds: [], marker: null,
                markerText: 'Chat aktif tidak terdeteksi', images: [], scopeReason: active.reason
            };
            return lastScan;
        }

        let result = scanPageFromActive(active);
        if (!result || !result.images.length) {
            const alternative = findAlternativeActiveScope(active.scope);
            if (alternative) {
                const altResult = scanPageFromActive(alternative);
                if (altResult && altResult.images.length) result = altResult;
            }
        }
        lastScan = result || {
            userId: 'user', allIds: [], marker: null,
            markerText: 'Chat aktif tidak terdeteksi', images: [], scopeReason: 'not_found'
        };
        return lastScan;
    }

    function waitForChatPaint(delayMs) {
        return new Promise((resolve) => {
            const delay = Math.max(0, Number(delayMs) || 0);
            const done = () => delay > 0 ? setTimeout(resolve, delay) : resolve();
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(done);
            else done();
        });
    }

    async function scanOneScopeDeep(active, onProgress, label) {
        const root = active.scope;
        const uid = findUserId(root);
        const strictImages = [];
        const relaxedImages = [];
        const originalTop = typeof root.scrollTop === 'number' ? root.scrollTop : 0;
        const canScroll = root.scrollHeight > root.clientHeight + 20;
        let mk = findMarker(root, active.markerHint);

        const collectCurrent = () => {
            collectImagesFromRoot(root, mk, strictImages, { ignoreMarker: false });
            if (!strictImages.length) {
                collectImagesFromRoot(root, mk, relaxedImages, { ignoreMarker: true });
            }
        };

        // Amankan gambar yang sedang tampak sebelum posisi scroll diubah.
        collectCurrent();

        try {
            if (canScroll) {
                root.scrollTop = 0;
                await waitForChatPaint(0);
            }

            collectCurrent();
            if (onProgress) onProgress((label || 'Scan chat aktif') + '... sementara <b>' + Math.max(strictImages.length, relaxedImages.length) + '</b> gambar.');

            if (canScroll) {
                let lastTop = -1;
                let safety = 0;
                while (safety < 64) {
                    safety++;
                    const currentTop = Number(root.scrollTop) || 0;
                    const maxTop = Math.max(0, root.scrollHeight - root.clientHeight);

                    if (safety === 1 || safety % 4 === 0) {
                        const foundMarker = findMarker(root, active.markerHint);
                        if (foundMarker && foundMarker.marker) mk = foundMarker;
                    }
                    collectCurrent();

                    if (onProgress && (safety === 1 || safety % 5 === 0 || currentTop >= maxTop - 4)) {
                        onProgress((label || 'Scan chat aktif') + '... posisi ' + (currentTop + 1) + '/' + (maxTop + 1) +
                            ' • <b>' + Math.max(strictImages.length, relaxedImages.length) + '</b> gambar.');
                    }

                    if (currentTop >= maxTop - 4) break;
                    const step = Math.max(300, Math.floor(root.clientHeight * 0.99));
                    const nextTop = Math.min(maxTop, currentTop + step);
                    if (nextTop === currentTop || nextTop === lastTop) break;
                    lastTop = currentTop;
                    root.scrollTop = nextTop;
                    await waitForChatPaint(0);
                }

                root.scrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
                await waitForChatPaint(0);
                collectCurrent();
            }
        } finally {
            try {
                root.scrollTop = originalTop;
                await waitForChatPaint(0);
            } catch (e) {}
        }

        const finalMarker = findMarker(root, active.markerHint);
        const images = strictImages.length ? strictImages : relaxedImages;
        return {
            userId: uid.userId,
            allIds: uid.allIds,
            marker: finalMarker.marker || (mk && mk.marker) || null,
            markerText: finalMarker.markerText !== 'Tidak terdeteksi' ? finalMarker.markerText : ((mk && mk.markerText) || 'Tidak terdeteksi'),
            images,
            strictCount: strictImages.length,
            relaxedCount: relaxedImages.length,
            scopeReason: active.reason
        };
    }

    // ULTRA FAST V6.4.1 — jalur cepat mengumpulkan BUFFER kandidat terbaru.
    // Hasil akhir tetap maksimal 6 gambar, tetapi kandidat ekstra diperlukan agar
    // Gambar 3 dan 6 (Kemenangan Total) tidak memakai screenshot yang sama bila ada alternatif.
    async function scanOneScopeFastLatest(active, onProgress, label) {
        const root = active && active.scope;
        if (!root) return null;

        const uid = findUserId(root);
        const strictImages = [];
        const relaxedImages = [];
        const originalTop = typeof root.scrollTop === 'number' ? root.scrollTop : 0;
        const canScroll = root.scrollHeight > root.clientHeight + 20;
        let mk = findMarker(root, active.markerHint);
        let stableRounds = 0;
        let previousCount = -1;

        const collectCurrent = () => {
            collectImagesFromRoot(root, mk, strictImages, { ignoreMarker: false });
            if (!strictImages.length) {
                collectImagesFromRoot(root, mk, relaxedImages, { ignoreMarker: true });
            }
            return strictImages.length || relaxedImages.length;
        };

        try {
            // Mulai dari bagian PALING BARU (bawah), bukan dari paling atas chat.
            if (canScroll) {
                root.scrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
                await waitForChatPaint(0);
            }

            let count = collectCurrent();
            if (onProgress) onProgress((label || 'Scan cepat') + ' • terbaru dulu • <b>' + count + '</b> gambar.');

            // Jangan berhenti tepat di 6. Ambil kandidat tambahan agar dua Kemenangan Total bisa berbeda.
            if (count >= LCST_SCAN_CANDIDATE_LIMIT) {
                const finalMarker = findMarker(root, active.markerHint);
                return {
                    userId: uid.userId,
                    allIds: uid.allIds,
                    marker: finalMarker.marker || (mk && mk.marker) || null,
                    markerText: finalMarker.markerText !== 'Tidak terdeteksi' ? finalMarker.markerText : ((mk && mk.markerText) || 'Tidak terdeteksi'),
                    images: (strictImages.length ? strictImages : relaxedImages).slice(-LCST_SCAN_CANDIDATE_LIMIT),
                    strictCount: strictImages.length,
                    relaxedCount: relaxedImages.length,
                    scopeReason: active.reason
                };
            }

            if (canScroll) {
                // Maksimal 12 lompatan viewport ke arah atas. Biasanya 1–4 langkah sudah dapat 6 gambar.
                for (let stepNo = 0; stepNo < 12; stepNo++) {
                    const currentTop = Number(root.scrollTop) || 0;
                    if (currentTop <= 2) break;

                    const step = Math.max(420, Math.floor(root.clientHeight * 1.18));
                    root.scrollTop = Math.max(0, currentTop - step);
                    await waitForChatPaint(0);

                    if (stepNo < 2 || stepNo % 3 === 0) {
                        const foundMarker = findMarker(root, active.markerHint);
                        if (foundMarker && foundMarker.marker) mk = foundMarker;
                    }

                    count = collectCurrent();
                    if (count === previousCount) stableRounds++;
                    else stableRounds = 0;
                    previousCount = count;

                    if (onProgress && (stepNo === 0 || stepNo % 2 === 1 || count >= LCST_SCAN_CANDIDATE_LIMIT)) {
                        onProgress((label || 'Scan cepat') + ' • <b>' + count + '</b> gambar • langkah ' + (stepNo + 1) + '.');
                    }

                    if (count >= LCST_SCAN_CANDIDATE_LIMIT) break;
                    if (stableRounds >= 3 && stepNo >= 4) break;
                }
            }
        } finally {
            try {
                root.scrollTop = originalTop;
                await waitForChatPaint(0);
            } catch (e) {}
        }

        const finalMarker = findMarker(root, active.markerHint);
        const images = strictImages.length ? strictImages : relaxedImages;
        return {
            userId: uid.userId,
            allIds: uid.allIds,
            marker: finalMarker.marker || (mk && mk.marker) || null,
            markerText: finalMarker.markerText !== 'Tidak terdeteksi' ? finalMarker.markerText : ((mk && mk.markerText) || 'Tidak terdeteksi'),
            images,
            strictCount: strictImages.length,
            relaxedCount: relaxedImages.length,
            scopeReason: active.reason
        };
    }

    async function scanPageDeep(onProgress) {
        const active = findActiveScope();
        if (!active.scope) {
            lastScan = {
                userId: 'user', allIds: [], marker: null,
                markerText: 'Chat aktif tidak terdeteksi', images: [], scopeReason: active.reason
            };
            return lastScan;
        }

        // 1) Jalur instan: baru berhenti tanpa scroll bila buffer kandidat sudah penuh.
        // Bila baru ada 6 gambar, tetap cari beberapa kandidat tambahan untuk mencegah WIN duplikat.
        const instant = scanPageFromActive(active);
        if (instant && instant.images && instant.images.length >= LCST_SCAN_CANDIDATE_LIMIT) {
            if (onProgress) onProgress('ULTRA FAST • <b>' + instant.images.length + '</b> gambar tersedia • memilih kandidat terbaru.');
            instant.images = instant.images.slice(-LCST_SCAN_CANDIDATE_LIMIT);
            lastScan = instant;
            return lastScan;
        }

        // 2) Jalur cepat: mulai dari chat terbaru dan kumpulkan buffer kandidat (maks. 12).
        let result = await scanOneScopeFastLatest(active, onProgress, 'ULTRA FAST mencari kandidat gambar terbaru');

        // 3) Hanya jika belum cukup gambar, pakai deep scan lama sebagai fallback agar kompatibilitas tidak hilang.
        if (!result || !result.images || result.images.length < Math.min(3, LCST_MAX_SELECTED_IMAGES)) {
            result = await scanOneScopeDeep(active, onProgress, 'Fallback deep scan');
        }

        // Scope alternatif hanya jika scope utama benar-benar kosong.
        if (!result.images.length) {
            const alternative = findAlternativeActiveScope(active.scope);
            if (alternative) {
                if (onProgress) onProgress('Scope pertama kosong. Memeriksa area percakapan aktif yang cocok...');
                let altResult = await scanOneScopeFastLatest(alternative, onProgress, 'ULTRA FAST area percakapan');
                if (!altResult || !altResult.images || !altResult.images.length) {
                    altResult = await scanOneScopeDeep(alternative, onProgress, 'Fallback area percakapan');
                }
                if (altResult.images.length) result = altResult;
            }
        }

        lastScan = {
            userId: result.userId,
            allIds: result.allIds,
            marker: result.marker,
            markerText: result.markerText,
            images: (result.images || []).slice(-LCST_SCAN_CANDIDATE_LIMIT),
            scopeReason: result.scopeReason
        };
        return lastScan;
    }

    function parseRekNama(val) {
        const parts = String(val || '').split(',');
        return {
            nama: parts.length >= 2 ? parts[0].trim() : '',
            rek: parts.length >= 2 ? parts.slice(1).join(',').trim() : ''
        };
    }

    function getAccountDB() {
        return safeJSONParse(localStorage.getItem(DB_KEY) || '{}', {});
    }

    function setAccountDB(db) {
        localStorage.setItem(DB_KEY, JSON.stringify(db || {}));
    }


    /******************************************************************
     * AUTO REKENING V1.1
     * Membaca User ID dari chat aktif, membuka halaman daftar pemain
     * menggunakan sesi login admin pada browser yang sama, kemudian
     * mengambil nama pemilik dan nomor rekening. Nama bank dibuang otomatis.
     ******************************************************************/

    const LCST_ADMIN_PLAYER_URL = 'https://agwl2.admitoto.com/agentplayerlist.php';
    const LCST_ADMIN_TIMEOUT = 6500;
    const LCST_ADMIN_PREFERRED_TIMEOUT = 2800;
    const LCST_ADMIN_MEMORY_TTL = 30 * 60 * 1000;
    const LCST_ADMIN_LOCAL_DB_TTL = 30 * 60 * 1000;
    const LCST_ADMIN_PROFILE_TTL = 7 * 24 * 60 * 60 * 1000;
    const LCST_ADMIN_PROFILE_KEY = 'lcst_admin_request_profile_v642';
    const LCST_ADMIN_UID_TOKEN = '__LCST_UID__';
    const lcstBankMemoryCache = new Map();
    const lcstBankLookupInflight = new Map();

    function lcstValidLookupUserId(value) {
        const userId = String(value || '').trim().toLowerCase();
        if (!userId || /^(user|unknown|null|undefined)$/i.test(userId)) return '';
        return userId;
    }

    // Cocokkan User ID secara utuh. Ini mencegah ID pendek seperti "wakjp"
    // mengambil baris milik ID lain yang hanya mengandung teks yang sama.
    function lcstHasExactLookupUserId(value, userId) {
        const uid = lcstValidLookupUserId(userId);
        const text = String(value == null ? '' : value);
        if (!uid || !text) return false;
        const escaped = uid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp('(?:^|[^A-Za-z0-9_.-])' + escaped + '(?=$|[^A-Za-z0-9_.-])', 'i').test(text);
    }

    function lcstRowHasExactLookupUserId(row, userId) {
        const uid = lcstValidLookupUserId(userId);
        if (!row || !uid) return false;

        const cells = Array.from(row.querySelectorAll('th,td'));
        if (!cells.length) return false;

        const table = row.closest('table');
        let headers = [];
        if (table) {
            const headerRow = table.querySelector('thead tr') || Array.from(table.querySelectorAll('tr')).find(tr => tr.querySelector('th'));
            if (headerRow) headers = Array.from(headerRow.querySelectorAll('th,td')).map(cell => lcstNormalizeBankText(cell.innerText || cell.textContent));
        }

        const userIndex = lcstHeaderIndex(headers, /^(?:user\s*id|userid|user\s*name|username|player\s*(?:id|name)|member\s*(?:id|name))$/i);
        if (userIndex >= 0 && cells[userIndex]) {
            return lcstHasExactLookupUserId(cells[userIndex].innerText || cells[userIndex].textContent, uid);
        }

        // Fallback hanya menerima satu sel yang memuat User ID sebagai token utuh,
        // bukan kecocokan sebagian dari seluruh teks baris.
        return cells.some(cell => lcstHasExactLookupUserId(cell.innerText || cell.textContent, uid));
    }

    function lcstRowHasDifferentLookupUserId(row, userId) {
        const uid = lcstValidLookupUserId(userId);
        if (!row || !uid) return false;

        const cells = Array.from(row.querySelectorAll('th,td'));
        const table = row.closest('table');
        if (!cells.length || !table) return false;

        const headerRow = table.querySelector('thead tr') || Array.from(table.querySelectorAll('tr')).find(tr => tr.querySelector('th'));
        if (!headerRow) return false;

        const headers = Array.from(headerRow.querySelectorAll('th,td')).map(cell => lcstNormalizeBankText(cell.innerText || cell.textContent));
        const userIndex = lcstHeaderIndex(headers, /^(?:user\s*id|userid|user\s*name|username|player\s*(?:id|name)|member\s*(?:id|name))$/i);
        if (userIndex < 0 || !cells[userIndex]) return false;

        const foundUserId = lcstNormalizeBankText(cells[userIndex].innerText || cells[userIndex].textContent);
        return !!foundUserId && !lcstHasExactLookupUserId(foundUserId, uid);
    }

    function lcstNormalizeBankText(value) {
        return String(value == null ? '' : value)
            .replace(/&nbsp;/gi, ' ')
            .replace(/\u00a0/g, ' ')
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    const LCST_BANK_NAME_ALIASES = [
        'BANK CENTRAL ASIA', 'BCA DIGITAL', 'BLU BCA DIGITAL', 'BCA',
        'BANK RAKYAT INDONESIA', 'BRI',
        'BANK NEGARA INDONESIA', 'BNI',
        'BANK MANDIRI', 'MANDIRI',
        'BANK SYARIAH INDONESIA', 'BSI',
        'BANK TABUNGAN NEGARA', 'BTN',
        'BANK CIMB NIAGA', 'CIMB NIAGA', 'CIMB',
        'BANK DANAMON', 'DANAMON',
        'BANK PERMATA', 'PERMATA BANK', 'PERMATA',
        'BANK PANIN', 'PANIN BANK', 'PANIN',
        'BANK OCBC NISP', 'OCBC NISP', 'OCBC',
        'BANK MAYBANK', 'MAYBANK',
        'BANK BTPN', 'BTPN', 'JENIUS',
        'BANK JAGO', 'JAGO',
        'SEA BANK', 'SEABANK',
        'BANK NEO COMMERCE', 'BANK NEO', 'BNC', 'NEO',
        'BANK MEGA', 'MEGA',
        'KB BUKOPIN', 'BANK BUKOPIN', 'KB BANK', 'BUKOPIN',
        'BANK SINARMAS', 'SINARMAS',
        'BANK JABAR BANTEN', 'BANK BJB', 'BJB',
        'BANK DKI', 'BANK JATIM', 'BANK JATENG', 'BANK SUMUT',
        'BANK SUMSEL BABEL', 'BANK RIAU KEPRI', 'BANK KALBAR',
        'BANK KALSEL', 'BANK KALTIMTARA', 'BANK SULSELBAR',
        'BANK SULUTGO', 'BANK PAPUA', 'BANK MALUKU', 'BANK NTT',
        'BANK NTB', 'BANK BALI', 'BANK NAGARI', 'BANK ACEH',
        'BANK MUAMALAT', 'MUAMALAT',
        'BANK ALADIN', 'ALADIN', 'ALLO BANK',
        'LINE BANK', 'UOB', 'TMRW', 'HSBC', 'DBS', 'DIGIBANK',
        'STANDARD CHARTERED', 'CITIBANK', 'QNB',
        'DANA', 'OVO', 'GOPAY', 'SHOPEEPAY', 'LINKAJA'
    ].sort((a, b) => b.length - a.length);

    function lcstNormalizeBankAlias(value) {
        return lcstNormalizeBankText(value)
            .toUpperCase()
            .replace(/[().]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function lcstIsBankNameOnly(value) {
        const normalized = lcstNormalizeBankAlias(value)
            .replace(/^PT\s+/i, '')
            .replace(/\s+(?:SYARIAH|DIGITAL)$/i, '')
            .trim();
        if (!normalized) return false;
        if (LCST_BANK_NAME_ALIASES.includes(normalized)) return true;
        if (/^BANK\s+[A-Z0-9 .&-]{2,40}$/.test(normalized)) return true;
        return false;
    }

    function lcstStripLeadingBankName(value) {
        let result = lcstNormalizeBankText(value);
        if (!result) return '';

        result = result
            .replace(/^(?:nama\s*(?:bank|rekening|pemilik)?|account\s*name)\s*[:\-]?\s*/i, '')
            .replace(/^[,;|:\-\s]+|[,;|:\-\s]+$/g, '')
            .trim();

        // Jika data berbentuk BANK,NAMA atau BANK|NAMA, buang bagian bank.
        let parts = result.split(/\s*[,;|]\s*/).filter(Boolean);
        while (parts.length > 1 && lcstIsBankNameOnly(parts[0])) parts.shift();
        result = parts.join(', ').trim();

        // Jika data berbentuk "BCA SUHARTO" atau "BANK BCA - SUHARTO",
        // buang nama bank yang berada di depan nama pemilik rekening.
        for (let pass = 0; pass < 2; pass++) {
            let changed = false;
            const normalized = lcstNormalizeBankAlias(result).replace(/^PT\s+/i, '');
            for (const alias of LCST_BANK_NAME_ALIASES) {
                const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const re = new RegExp('^(?:PT\\s+)?(?:BANK\\s+)?' + escaped + '(?=\\s*(?:[-–—,:|/]\\s*|\\s+))', 'i');
                if (re.test(result) || normalized === alias) {
                    result = result.replace(re, '').replace(/^[\s\-–—,:|/]+/, '').trim();
                    changed = true;
                    break;
                }
            }
            if (!changed) break;
        }

        return result
            .replace(/^[,;|:\-\s]+|[,;|:\-\s]+$/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function lcstCleanAccountName(value) {
        const cleaned = lcstStripLeadingBankName(value);
        if (!cleaned || lcstIsBankNameOnly(cleaned)) return '';
        return cleaned;
    }

    function lcstCleanAccountNumber(value) {
        const digits = String(value == null ? '' : value).replace(/\D/g, '');
        return digits.length >= 6 && digits.length <= 30 ? digits : '';
    }

    function lcstBankPair(nama, rek, raw) {
        nama = lcstCleanAccountName(nama);
        rek = lcstCleanAccountNumber(rek);
        if (!nama || !rek) return null;
        if (/^(bank|rekening|account|nama|nomor|no)$/i.test(nama)) return null;
        return { nama, rek, raw: lcstNormalizeBankText(raw || (nama + ',' + rek)) };
    }

    function lcstParseBankValue(value, userId) {
        const raw = lcstNormalizeBankText(value);
        if (!raw) return null;

        const labeled = raw.match(/(?:nama(?:\s+(?:bank|rekening|pemilik))?|account\s*name)\s*[:\-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .'/&-]{1,80}?)\s+(?:no(?:mor)?\s*(?:rekening|rek)|rekening|account\s*(?:no|number)?)\s*[:\-]\s*([0-9][0-9 .-]{5,29})/i);
        if (labeled) {
            const pair = lcstBankPair(labeled[1], labeled[2], raw);
            if (pair) return pair;
        }

        // Format yang paling umum: BANK,NAMA PEMILIK,NOMOR atau
        // NAMA PEMILIK,NOMOR. Ambil teks tepat sebelum nomor agar nama
        // bank tidak pernah ikut masuk ke Data Rekening.
        const pieces = raw.split(/\s*[,;|]\s*/).filter(Boolean);
        for (let i = 0; i < pieces.length; i++) {
            const rek = lcstCleanAccountNumber(pieces[i]);
            if (!rek || i === 0) continue;
            for (let j = i - 1; j >= 0; j--) {
                const candidate = lcstCleanAccountName(pieces[j]);
                if (!candidate || lcstIsBankNameOnly(candidate)) continue;
                if (lcstValidLookupUserId(userId).toLowerCase() === candidate.toLowerCase()) continue;
                const pair = lcstBankPair(candidate, rek, raw);
                if (pair) return pair;
            }
        }

        const nameFirst = raw.match(/(?:^|\bBANK\s*[:\-]?\s*)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .'/&-]{1,80}?)\s*[,|;]\s*([0-9][0-9 .-]{5,29})(?:\b|$)/i);
        if (nameFirst) {
            const pair = lcstBankPair(nameFirst[1], nameFirst[2], raw);
            if (pair) return pair;
        }

        const numberFirst = raw.match(/(?:^|\s)([0-9][0-9 .-]{5,29})\s*[,|;]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .'/&-]{1,80})(?:$|\s)/i);
        if (numberFirst) {
            const pair = lcstBankPair(numberFirst[2], numberFirst[1], raw);
            if (pair) return pair;
        }

        // Fallback untuk nilai yang dipisah baris/spasi.
        const numberMatch = raw.match(/(?:^|\D)([0-9][0-9 .-]{5,29})(?:\D|$)/);
        if (numberMatch) {
            const rek = lcstCleanAccountNumber(numberMatch[1]);
            const before = raw.slice(0, numberMatch.index).replace(/(?:rekening|account|no(?:mor)?|rek)\s*[:\-]?/gi, ' ');
            const after = raw.slice((numberMatch.index || 0) + numberMatch[0].length);
            const beforeParts = before.split(/\s*[,;|]\s*/).map(lcstCleanAccountName).filter(Boolean).reverse();
            const afterParts = after.split(/\s*[,;|]\s*/).map(lcstCleanAccountName).filter(Boolean);
            const uid = lcstValidLookupUserId(userId).toLowerCase();
            const candidates = beforeParts.concat(afterParts).filter(v => {
                if (!v || lcstIsBankNameOnly(v)) return false;
                if (uid && (v.toLowerCase() === uid || uid.includes(v.toLowerCase()))) return false;
                return v.length >= 2;
            });
            if (candidates.length) {
                const pair = lcstBankPair(candidates[0], rek, raw);
                if (pair) return pair;
            }
        }
        return null;
    }

    function lcstCreateLookupError(code, message) {
        const err = new Error(message);
        err.code = code;
        return err;
    }

    function lcstRequestAdminText(method, url, data, timeoutMs) {
        const safeTimeout = Math.max(1200, Number(timeoutMs) || LCST_ADMIN_TIMEOUT);
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'function') {
                reject(lcstCreateLookupError('REQUEST_UNAVAILABLE', 'GM_xmlhttpRequest tidak tersedia.'));
                return;
            }
            GM_xmlhttpRequest({
                method: String(method || 'GET').toUpperCase(),
                url,
                data: data || undefined,
                headers: data ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' } : undefined,
                responseType: 'text',
                anonymous: false,
                withCredentials: true,
                timeout: safeTimeout,
                onload: (res) => {
                    const status = Number(res.status) || 0;
                    if (status >= 200 && status < 400) {
                        resolve({
                            text: String(res.responseText || res.response || ''),
                            finalUrl: String(res.finalUrl || url),
                            status
                        });
                    } else {
                        reject(lcstCreateLookupError('HTTP_ERROR', 'Admin membalas HTTP ' + status + '.'));
                    }
                },
                onerror: () => reject(lcstCreateLookupError('NETWORK_ERROR', 'Halaman admin tidak dapat dihubungi.')),
                ontimeout: () => reject(lcstCreateLookupError('TIMEOUT', 'Waktu pengambilan data admin habis.'))
            });
        });
    }

    function lcstIsAdminLoginDocument(doc) {
        if (!doc) return false;
        const bodyText = lcstNormalizeBankText(doc.body ? doc.body.innerText || doc.body.textContent : '').toLowerCase();
        return !!doc.querySelector('input[type="password"]') && /username/.test(bodyText) && /password/.test(bodyText);
    }

    function lcstHeaderIndex(headers, pattern) {
        for (let i = 0; i < headers.length; i++) {
            if (pattern.test(headers[i])) return i;
        }
        return -1;
    }

    function lcstExtractBankFromRow(row, userId, allowWithoutUser) {
        const rowText = lcstNormalizeBankText(row && (row.innerText || row.textContent));
        if (!rowText) return null;
        const uid = lcstValidLookupUserId(userId);
        if (!allowWithoutUser && uid && !lcstRowHasExactLookupUserId(row, uid)) return null;

        const cells = Array.from(row.querySelectorAll('th,td')).map(cell => lcstNormalizeBankText(cell.innerText || cell.textContent));
        if (!cells.length) return null;
        const table = row.closest('table');
        let headers = [];
        if (table) {
            const headerRow = table.querySelector('thead tr') || Array.from(table.querySelectorAll('tr')).find(tr => tr.querySelector('th'));
            if (headerRow) headers = Array.from(headerRow.querySelectorAll('th,td')).map(cell => lcstNormalizeBankText(cell.innerText || cell.textContent));
        }

        const bankIndex = lcstHeaderIndex(headers, /^(?:bank|data\s*bank|bank\s*account|rekening|account)$/i);
        if (bankIndex >= 0 && cells[bankIndex]) {
            const pair = lcstParseBankValue(cells[bankIndex], uid);
            if (pair) return pair;
        }

        const accountIndex = lcstHeaderIndex(headers, /(?:no(?:mor)?\s*(?:rekening|rek)|rekening|account\s*(?:no|number)?|bank\s*account)/i);
        const nameIndex = lcstHeaderIndex(headers, /(?:nama\s*(?:rekening|bank|pemilik)|account\s*name|holder\s*name)/i);
        if (accountIndex >= 0 && nameIndex >= 0 && cells[accountIndex] && cells[nameIndex]) {
            const pair = lcstBankPair(cells[nameIndex], cells[accountIndex], rowText);
            if (pair) return pair;
        }

        for (const cell of cells) {
            const pair = lcstParseBankValue(cell, uid);
            if (pair) return pair;
        }
        return lcstParseBankValue(rowText, uid);
    }

    function lcstExtractBankFromJson(value, userId) {
        const uid = lcstValidLookupUserId(userId).toLowerCase();
        const visited = new Set();

        function walk(node) {
            if (!node || typeof node !== 'object' || visited.has(node)) return null;
            visited.add(node);
            if (Array.isArray(node)) {
                for (const item of node) {
                    const found = walk(item);
                    if (found) return found;
                }
                return null;
            }

            const entries = Object.entries(node);
            let serialized = '';
            try { serialized = JSON.stringify(node).toLowerCase(); } catch (e) {}
            const matchesUser = !uid || lcstHasExactLookupUserId(serialized, uid);
            if (matchesUser) {
                for (const [key, val] of entries) {
                    if (/bank|rekening|account|rek/i.test(key) && typeof val !== 'object') {
                        const pair = lcstParseBankValue(val, uid);
                        if (pair) return pair;
                    }
                }

                const accountEntry = entries.find(([key, val]) => typeof val !== 'object' && /(?:rekening|account_?no|accountnumber|bank_?no|bankaccount|no_?rek|rek$)/i.test(key));
                const nameEntry = entries.find(([key, val]) => typeof val !== 'object' && /(?:nama_?(?:rekening|bank|pemilik)|account_?name|holder_?name|fullname|name$)/i.test(key));
                if (accountEntry && nameEntry) {
                    const pair = lcstBankPair(nameEntry[1], accountEntry[1], serialized);
                    if (pair) return pair;
                }
            }

            for (const [, child] of entries) {
                const found = walk(child);
                if (found) return found;
            }
            return null;
        }
        return walk(value);
    }

    function lcstExtractBankResult(raw, userId) {
        const text = String(raw || '').trim();
        if (!text) return { result: null, loginRequired: false, document: null };

        if (/^[\[{]/.test(text)) {
            try {
                const json = JSON.parse(text);
                const result = lcstExtractBankFromJson(json, userId);
                if (result) return { result, loginRequired: false, document: null };
            } catch (e) {}
        }

        const doc = new DOMParser().parseFromString(text, 'text/html');
        const loginRequired = lcstIsAdminLoginDocument(doc);
        if (loginRequired) return { result: null, loginRequired: true, document: doc };

        const uid = lcstValidLookupUserId(userId);
        const rows = Array.from(doc.querySelectorAll('tr'));
        for (const row of rows) {
            if (uid && lcstRowHasExactLookupUserId(row, uid)) {
                const result = lcstExtractBankFromRow(row, uid, false);
                if (result) return { result, loginRequired: false, document: doc };
            }
        }

        // Jika server sudah memfilter ke satu pemain, izinkan satu baris data
        // walau User ID tidak lagi dicetak pada hasil respons.
        const dataRows = rows.filter(row => row.querySelectorAll('td').length > 0);
        if (dataRows.length === 1 && !lcstRowHasDifferentLookupUserId(dataRows[0], uid)) {
            const result = lcstExtractBankFromRow(dataRows[0], uid, true);
            if (result) return { result, loginRequired: false, document: doc };
        }

        const scripts = Array.from(doc.querySelectorAll('script[type="application/json"]'));
        for (const script of scripts) {
            try {
                const result = lcstExtractBankFromJson(JSON.parse(script.textContent || ''), uid);
                if (result) return { result, loginRequired: false, document: doc };
            } catch (e) {}
        }

        const bodyText = lcstNormalizeBankText(doc.body ? doc.body.innerText || doc.body.textContent : '');
        if (uid) {
            const escapedUid = uid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const exactMatch = new RegExp('(?:^|[^A-Za-z0-9_.-])' + escapedUid + '(?=$|[^A-Za-z0-9_.-])', 'i').exec(bodyText);
            if (exactMatch) {
                const tokenOffset = exactMatch[0].toLowerCase().indexOf(uid.toLowerCase());
                const index = exactMatch.index + Math.max(0, tokenOffset);
                const nearby = bodyText.slice(Math.max(0, index - 250), Math.min(bodyText.length, index + uid.length + 500));
                const result = lcstParseBankValue(nearby, uid);
                if (result) return { result, loginRequired: false, document: doc };
            }
        }
        return { result: null, loginRequired: false, document: doc };
    }

    function lcstBuildCommonAdminParams(userId) {
        const p = new URLSearchParams();
        p.set('username', userId);
        p.set('userid', userId);
        p.set('user_id', userId);
        p.set('player', userId);
        p.set('member', userId);
        p.set('search', userId);
        p.set('keyword', userId);
        p.set('sSearch', userId);
        p.set('search[value]', userId);
        p.set('action', 'search');
        p.set('submit', 'Search');
        return p;
    }

    function lcstDiscoverAdminRequests(doc, baseUrl, userId) {
        const out = [];
        const add = (method, url, data) => {
            try {
                const fullUrl = new URL(url || baseUrl, baseUrl).href;
                if (!/^https:\/\/agwl2\.admitoto\.com\//i.test(fullUrl)) return;
                out.push({ method: String(method || 'GET').toUpperCase(), url: fullUrl, data: data || '' });
            } catch (e) {}
        };

        if (doc) {
            Array.from(doc.forms || []).forEach(form => {
                if (form.querySelector('input[type="password"]')) return;
                const elements = Array.from(form.elements || []);
                const candidates = elements.filter(el => {
                    const hint = [el.name, el.id, el.placeholder].filter(Boolean).join(' ');
                    return el.name && /user|player|member|search|keyword|filter/i.test(hint) && !/password/i.test(hint);
                });
                if (!candidates.length) return;

                const params = new URLSearchParams();
                elements.forEach(el => {
                    if (!el.name || el.disabled) return;
                    const type = String(el.type || '').toLowerCase();
                    if (type === 'password' || type === 'file') return;
                    if ((type === 'checkbox' || type === 'radio') && !el.checked) return;
                    if (type === 'submit' || type === 'button') return;
                    params.set(el.name, type === 'hidden' ? (el.value || '') : (candidates.includes(el) ? userId : (el.value || '')));
                });
                candidates.forEach(el => params.set(el.name, userId));
                const submit = elements.find(el => el.name && /submit|search|filter/i.test(el.name) && /submit|button/i.test(String(el.type || '')));
                if (submit) params.set(submit.name, submit.value || 'Search');

                const method = String(form.method || 'GET').toUpperCase();
                const action = form.getAttribute('action') || baseUrl;
                if (method === 'GET') {
                    const url = new URL(action, baseUrl);
                    params.forEach((value, key) => url.searchParams.set(key, value));
                    add('GET', url.href, '');
                } else {
                    add('POST', action, params.toString());
                }
            });

            const scriptText = Array.from(doc.scripts || []).map(s => s.textContent || '').join('\n');
            const regex = /(?:url|ajax)\s*[:=]\s*["']([^"']+(?:\.php|ajax)[^"']*)["']/gi;
            let match;
            while ((match = regex.exec(scriptText)) !== null) {
                add('POST', match[1], lcstBuildCommonAdminParams(userId).toString());
            }
        }
        return out;
    }

    function lcstAdminRequestKey(req) {
        if (!req) return '';
        return String(req.method || 'GET').toUpperCase() + '|' + String(req.url || '') + '|' + String(req.data || '');
    }

    function lcstAdminRequestToProfile(req, userId) {
        const uid = lcstValidLookupUserId(userId);
        if (!req || !uid) return null;
        const encodedUid = encodeURIComponent(uid);
        const replaceUid = (value) => String(value || '')
            .split(encodedUid).join(LCST_ADMIN_UID_TOKEN)
            .split(uid).join(LCST_ADMIN_UID_TOKEN);
        const profile = {
            method: String(req.method || 'GET').toUpperCase(),
            url: replaceUid(req.url),
            data: replaceUid(req.data),
            savedAt: Date.now()
        };
        if (!/^https:\/\/agwl2\.admitoto\.com\//i.test(profile.url.replace(LCST_ADMIN_UID_TOKEN, encodedUid))) return null;
        if (!profile.url.includes(LCST_ADMIN_UID_TOKEN) && !profile.data.includes(LCST_ADMIN_UID_TOKEN)) return null;
        return profile;
    }

    function lcstAdminProfileToRequest(profile, userId) {
        const uid = lcstValidLookupUserId(userId);
        if (!profile || !uid) return null;
        if (!profile.savedAt || Date.now() - Number(profile.savedAt) > LCST_ADMIN_PROFILE_TTL) return null;
        const encodedUid = encodeURIComponent(uid);
        const hydrate = (value) => String(value || '').split(LCST_ADMIN_UID_TOKEN).join(encodedUid);
        const req = {
            method: String(profile.method || 'GET').toUpperCase(),
            url: hydrate(profile.url),
            data: hydrate(profile.data)
        };
        if (!/^https:\/\/agwl2\.admitoto\.com\//i.test(req.url)) return null;
        return req;
    }

    function lcstLoadAdminPreferredRequest(userId) {
        try {
            const raw = typeof GM_getValue === 'function' ? GM_getValue(LCST_ADMIN_PROFILE_KEY, '') : '';
            const profile = typeof raw === 'string' ? safeJSONParse(raw, null) : raw;
            return lcstAdminProfileToRequest(profile, userId);
        } catch (e) {
            return null;
        }
    }

    function lcstSaveAdminPreferredRequest(req, userId) {
        try {
            const profile = lcstAdminRequestToProfile(req, userId);
            if (!profile) return;
            if (typeof GM_setValue === 'function') GM_setValue(LCST_ADMIN_PROFILE_KEY, JSON.stringify(profile));
        } catch (e) {}
    }

    async function lcstLookupBankFromAdminCore(uid, forceRefresh) {
        if (!uid) throw lcstCreateLookupError('NO_USER_ID', 'User ID chat belum terdeteksi.');

        const cacheKey = uid.toLowerCase();
        const cached = lcstBankMemoryCache.get(cacheKey);
        if (!forceRefresh && cached && Date.now() - cached.time < LCST_ADMIN_MEMORY_TTL) return cached.value;

        const common = lcstBuildCommonAdminParams(uid);

        const parseAdminResponse = (response, req) => {
            const parsed = lcstExtractBankResult(response.text, uid);
            if (parsed.loginRequired) return { loginRequired: true, parsed, response, req };
            if (parsed.result) {
                const value = { ...parsed.result, userId: uid, source: response.finalUrl || req.url };
                return { value, parsed, response, req };
            }
            return { parsed, response, req };
        };

        const requestAndParse = async (req, timeoutMs) => {
            try {
                const response = await lcstRequestAdminText(req.method, req.url, req.data, timeoutMs);
                return parseAdminResponse(response, req);
            } catch (err) {
                return { error: err, req };
            }
        };

        const firstValidFrom = async (requests, timeoutMs) => {
            const tasks = requests.map(req => requestAndParse(req, timeoutMs));
            let first = null;
            await new Promise((resolve) => {
                let settled = 0;
                tasks.forEach(task => Promise.resolve(task).then(item => {
                    if (!first && item && item.value) {
                        first = item;
                        resolve();
                        return;
                    }
                    settled++;
                    if (settled >= tasks.length) resolve();
                }).catch(() => {
                    settled++;
                    if (settled >= tasks.length) resolve();
                }));
            });
            if (first) return { first, results: null, tasks };
            return { first: null, results: await Promise.all(tasks), tasks };
        };

        // V6.4.2: setelah satu pola Admin pernah berhasil, pakai pola itu SENDIRI dahulu.
        // Biasanya lookup berikutnya cukup satu request. Timeout pendek mencegah profil lama
        // memperlambat fallback bila halaman Admin berubah.
        const preferredRequest = !forceRefresh ? lcstLoadAdminPreferredRequest(uid) : null;
        if (preferredRequest) {
            const preferred = await requestAndParse(preferredRequest, LCST_ADMIN_PREFERRED_TIMEOUT);
            if (preferred && preferred.value) {
                lcstBankMemoryCache.set(cacheKey, { time: Date.now(), value: preferred.value });
                return preferred.value;
            }
            if (preferred && preferred.loginRequired) {
                throw lcstCreateLookupError('ADMIN_LOGIN_REQUIRED', 'Sesi login admin belum aktif.');
            }
        }

        // Fallback pertama: empat pola umum tetap dikirim bersamaan. Server yang mengenali
        // salah satu langsung menang; hasil wajib tetap cocok dengan User ID yang diminta.
        const directRequests = [
            { method: 'POST', url: LCST_ADMIN_PLAYER_URL, data: common.toString() },
            { method: 'GET', url: LCST_ADMIN_PLAYER_URL + '?' + new URLSearchParams({ username: uid, search: uid }).toString(), data: '' },
            { method: 'GET', url: LCST_ADMIN_PLAYER_URL + '?' + new URLSearchParams({ userid: uid, keyword: uid }).toString(), data: '' },
            { method: 'GET', url: LCST_ADMIN_PLAYER_URL + '?' + new URLSearchParams({ 'search[value]': uid, sSearch: uid }).toString(), data: '' }
        ];

        const preferredKey = preferredRequest ? lcstAdminRequestKey(preferredRequest) : '';
        const directUnique = preferredKey
            ? directRequests.filter(req => lcstAdminRequestKey(req) !== preferredKey)
            : directRequests;
        const direct = await firstValidFrom(directUnique.length ? directUnique : directRequests, LCST_ADMIN_TIMEOUT);
        if (direct.first && direct.first.value) {
            lcstSaveAdminPreferredRequest(direct.first.req, uid);
            lcstBankMemoryCache.set(cacheKey, { time: Date.now(), value: direct.first.value });
            return direct.first.value;
        }

        const directResults = direct.results || await Promise.all(direct.tasks || []);
        if (directResults.some(item => item && item.loginRequired)) {
            throw lcstCreateLookupError('ADMIN_LOGIN_REQUIRED', 'Sesi login admin belum aktif.');
        }

        const queue = [];
        const seen = new Set((directUnique.length ? directUnique : directRequests).map(lcstAdminRequestKey));
        let lastError = directResults.map(item => item && item.error).filter(Boolean).pop() || null;
        let attempts = (directUnique.length ? directUnique : directRequests).length;

        directResults.forEach(item => {
            if (!item || !item.parsed || !item.response || !item.req) return;
            const discovered = lcstDiscoverAdminRequests(item.parsed.document, item.response.finalUrl || item.req.url, uid);
            discovered.forEach(req => queue.push(req));
        });
        queue.push({ method: 'GET', url: LCST_ADMIN_PLAYER_URL, data: '' });

        // Fallback lama tetap ada, tetapi endpoint hasil discovery dikerjakan per batch 3,
        // bukan satu request -> tunggu -> request berikutnya.
        while (queue.length && attempts < 10) {
            const batch = [];
            while (queue.length && batch.length < 3 && attempts < 10) {
                const req = queue.shift();
                const key = req.method + '|' + req.url + '|' + req.data;
                if (seen.has(key)) continue;
                seen.add(key);
                attempts++;
                batch.push(req);
            }
            if (!batch.length) continue;

            const raced = await firstValidFrom(batch);
            if (raced.first && raced.first.value) {
                lcstSaveAdminPreferredRequest(raced.first.req, uid);
                lcstBankMemoryCache.set(cacheKey, { time: Date.now(), value: raced.first.value });
                return raced.first.value;
            }
            const batchResults = raced.results || await Promise.all(raced.tasks || []);
            if (batchResults.some(item => item && item.loginRequired)) {
                throw lcstCreateLookupError('ADMIN_LOGIN_REQUIRED', 'Sesi login admin belum aktif.');
            }
            batchResults.forEach((item, idx) => {
                const req = batch[idx];
                if (item && item.error) lastError = item.error;
                if (item && item.parsed && item.response) {
                    const discovered = lcstDiscoverAdminRequests(item.parsed.document, item.response.finalUrl || req.url, uid);
                    discovered.forEach(nextReq => queue.push(nextReq));
                }
            });
        }

        if (lastError && attempts <= 1) throw lastError;
        throw lcstCreateLookupError('BANK_NOT_FOUND', 'Data Bank untuk User ID ' + uid + ' tidak ditemukan pada daftar pemain.');
    }

    async function lcstLookupBankFromAdmin(userId, forceRefresh) {
        const uid = lcstValidLookupUserId(userId);
        if (!uid) throw lcstCreateLookupError('NO_USER_ID', 'User ID chat belum terdeteksi.');
        const cacheKey = uid.toLowerCase();

        if (!forceRefresh) {
            const cached = lcstBankMemoryCache.get(cacheKey);
            if (cached && Date.now() - cached.time < LCST_ADMIN_MEMORY_TTL) return cached.value;
            const running = lcstBankLookupInflight.get(cacheKey);
            if (running) return running;
        }

        const task = lcstLookupBankFromAdminCore(uid, !!forceRefresh);
        if (!forceRefresh) lcstBankLookupInflight.set(cacheKey, task);
        try {
            return await task;
        } finally {
            if (!forceRefresh && lcstBankLookupInflight.get(cacheKey) === task) {
                lcstBankLookupInflight.delete(cacheKey);
            }
        }
    }

    function getPackageSizeFromCount(count) {
        const n = Number(count) || 0;
        if (n <= 1) return 1;
        if (n % 3 === 0) return 3;
        if (n % 2 === 0) return 2;
        return n >= 3 ? 3 : 2;
    }

    function getPackageSizeFromImages(images) {
        return getPackageSizeFromCount((images || []).length);
    }

    function makeOutput(scan) {
        const rekInput = document.getElementById('lcst-rek-all');
        const rn = parseRekNama(rekInput ? rekInput.value : '');
        const imgs = scan.images || [];
        const packageSize = getPackageSizeFromImages(imgs);
        let out = '';
        for (let i = 0; i < imgs.length; i += packageSize) {
            const rowIdx = Math.floor(i / packageSize);

            // Paket dengan Taruhan di bawah 1,60 tidak dimasukkan ke output,
            // sehingga paket tersebut tidak dapat tersalin lewat COPY OUTPUT
            // maupun melalui salin manual dari kotak output.
            if (scan.betBelowMinRows && scan.betBelowMinRows[rowIdx]) continue;

            const urls = imgs.slice(i, i + packageSize);
            while (urls.length < 3) urls.push('');
            const periodInput = document.getElementById('lcst-prd-' + rowIdx);
            const inputPeriod = periodInput ? periodInput.value.trim() : '';
            const ocrPeriod = scan.ocrPeriods && scan.ocrPeriods[rowIdx] ? scan.ocrPeriods[rowIdx] : '';
            const period = inputPeriod || ocrPeriod || ('MENUNGGU OCR ' + (rowIdx + 1));

            // V5.7.4: sumber utama batas claim adalah tanggal + jam yang dibaca
            // langsung dari GAMBAR KE-2 pada paket ini. Periode hanya menjadi fallback
            // bila tulisan waktu pada screenshot benar-benar tidak dapat dibaca.
            const imageClaimTimestamp = scan.claimTimestampByRow && scan.claimTimestampByRow[rowIdx]
                ? scan.claimTimestampByRow[rowIdx]
                : null;
            const claimDeadline = lcstCheckClaimDeadline(imageClaimTimestamp, period);
            scan.claimExpiredRows = scan.claimExpiredRows || [];
            scan.claimDeadlineByRow = scan.claimDeadlineByRow || [];
            scan.claimExpiredRows[rowIdx] = !!claimDeadline.expired;
            scan.claimDeadlineByRow[rowIdx] = claimDeadline;
            if (claimDeadline.expired) continue;

            out += String(scan.userId || '').trim().toLowerCase() + '\t' + urls.join('\t') + '\t' + rn.rek + '\t' + rn.nama + '\t' + period + '\n';
        }
        return out;
    }

    function lcstSheetIsConfigured() {
        return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/i.test(String(LCST_SHEET_WEBAPP_URL || '').trim());
    }

    function lcstSheetHash(value) {
        const text = String(value == null ? '' : value);
        let h1 = 0x811c9dc5;
        for (let i = 0; i < text.length; i++) {
            h1 ^= text.charCodeAt(i);
            h1 = Math.imul(h1, 0x01000193);
        }
        return ('00000000' + (h1 >>> 0).toString(16)).slice(-8);
    }

    function lcstBuildSheetRows(scan) {
        const rekInput = document.getElementById('lcst-rek-all');
        const rn = parseRekNama(rekInput ? rekInput.value : '');
        const imgs = scan.images || [];
        const packageSize = getPackageSizeFromImages(imgs);
        const rows = [];

        for (let i = 0; i < imgs.length; i += packageSize) {
            const rowIdx = Math.floor(i / packageSize);

            // Sama seperti COPY OUTPUT: paket berbahaya tidak dikirim ke Sheet.
            if (scan.betBelowMinRows && scan.betBelowMinRows[rowIdx]) continue;

            const periodInput = document.getElementById('lcst-prd-' + rowIdx);
            const inputPeriod = periodInput ? periodInput.value.trim() : '';
            const ocrPeriod = scan.ocrPeriods && scan.ocrPeriods[rowIdx] ? String(scan.ocrPeriods[rowIdx]).trim() : '';
            const period = inputPeriod || ocrPeriod;

            // Hanya hasil scan yang benar-benar memiliki periode valid yang dikirim otomatis.
            // Paket OCR gagal tetap dibiarkan untuk pencatatan manual.
            if (!period || /^MENUNGGU OCR/i.test(period)) continue;

            const imageClaimTimestamp = scan.claimTimestampByRow && scan.claimTimestampByRow[rowIdx]
                ? scan.claimTimestampByRow[rowIdx]
                : null;
            const claimDeadline = lcstCheckClaimDeadline(imageClaimTimestamp, period);
            scan.claimExpiredRows = scan.claimExpiredRows || [];
            scan.claimDeadlineByRow = scan.claimDeadlineByRow || [];
            scan.claimExpiredRows[rowIdx] = !!claimDeadline.expired;
            scan.claimDeadlineByRow[rowIdx] = claimDeadline;
            if (claimDeadline.expired) continue;

            const urls = imgs.slice(i, i + packageSize);
            while (urls.length < 3) urls.push('');

            // Tepat 7 kolom => D, E, F, G, H, I, J.
            rows.push([
                String(scan.userId || '').trim().toLowerCase(),
                String(urls[0] || ''),
                String(urls[1] || ''),
                String(urls[2] || ''),
                String(rn.rek || '').trim(),
                String(rn.nama || '').trim(),
                period
            ]);
        }
        return rows;
    }

    function lcstPostRowsToSheet(rows) {
        return new Promise((resolve, reject) => {
            if (!lcstSheetIsConfigured()) {
                const err = new Error('URL Web App Google Sheet belum dipasang. Ganti LCST_SHEET_WEBAPP_URL dengan URL /exec hasil Deploy Apps Script.');
                err.code = 'SHEET_NOT_CONFIGURED';
                reject(err);
                return;
            }
            if (!Array.isArray(rows) || !rows.length) {
                resolve({ ok: true, inserted: 0, skipped: true, message: 'Tidak ada baris valid untuk dikirim.' });
                return;
            }

            const normalized = rows.map(row => Array.from({ length: 7 }, (_, i) => String((row || [])[i] == null ? '' : (row || [])[i])));
            const batchKey = lcstSheetHash(JSON.stringify(normalized));
            const lastBatch = localStorage.getItem(LCST_SHEET_LAST_BATCH_KEY) || '';
            if (lastBatch === batchKey) {
                resolve({ ok: true, inserted: 0, duplicate: true, batchKey, message: 'Batch ini sudah pernah berhasil dikirim.' });
                return;
            }

            const payload = {
                secret: LCST_SHEET_SECRET,
                batchKey,
                source: 'LiveChat OCR v5.8.1',
                sentAt: new Date().toISOString(),
                rows: normalized
            };

            GM_xmlhttpRequest({
                method: 'POST',
                url: LCST_SHEET_WEBAPP_URL,
                headers: { 'Content-Type': 'application/json;charset=UTF-8' },
                data: JSON.stringify(payload),
                timeout: LCST_SHEET_TIMEOUT,
                onload: (res) => {
                    let data = null;
                    try { data = JSON.parse(res.responseText || '{}'); } catch (e) {}
                    if (res.status >= 200 && res.status < 300 && data && data.ok) {
                        localStorage.setItem(LCST_SHEET_LAST_BATCH_KEY, batchKey);
                        // Bangunkan worker REGC lintas tab segera setelah D:J berhasil masuk.
                        // GM_setValue + GM_addValueChangeListener bekerja lintas domain untuk userscript yang sama.
                        try {
                            GM_setValue(LT_REGC_WAKE_KEY, {
                                ts: Date.now(),
                                source: 'livechat-append',
                                inserted: Number(data.inserted || 0),
                                startRow: Number(data.startRow || 0),
                                endRow: Number(data.endRow || 0)
                            });
                        } catch (ignore) {}
                        resolve(data);
                        return;
                    }
                    const message = data && data.error
                        ? data.error
                        : ('HTTP ' + res.status + ' dari Web App Google Sheet.');
                    const err = new Error(message);
                    err.code = 'SHEET_HTTP_ERROR';
                    err.status = res.status;
                    reject(err);
                },
                onerror: () => {
                    const err = new Error('Gagal terhubung ke Web App Google Sheet.');
                    err.code = 'SHEET_NETWORK_ERROR';
                    reject(err);
                },
                ontimeout: () => {
                    const err = new Error('Koneksi ke Google Sheet timeout.');
                    err.code = 'SHEET_TIMEOUT';
                    reject(err);
                }
            });
        });
    }

    function copyText(text) {
        if (typeof GM_setClipboard === 'function') {
            GM_setClipboard(text, 'text');
            return Promise.resolve();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const copied = document.execCommand('copy');
        ta.remove();
        return copied ? Promise.resolve() : Promise.reject(new Error('Clipboard tidak tersedia'));
    }

    /******************************************************************
     * OCR ENGINE V4.5 - OPTIMAL PROGRESSIVE ROW LOCK
     * Tidak pernah memilih baris hanya dari angka. Baris wajib dikunci
     * terlebih dahulu oleh pasangan dua tanda bulat oranye.
     ******************************************************************/

    const LCST_EXPECTED_TOP_LENGTH = 9;
    const LCST_EXPECTED_BOTTOM_LENGTH = 10;
    const LCST_EXPECTED_FULL_LENGTH = 19;
    const LCST_STRICT_DOUBLE_MARKER = true;
    const LCST_MIN_BET_ODDS = 1.60;

    // V5.7.7 TURBO: perangkat dengan sedikitnya 4 logical CPU memakai worker
    // metadata terpisah. Periode tetap dibaca worker utama, sedangkan taruhan
    // dan tanggal/jam target gambar ke-2/5 dikerjakan bersamaan tanpa mengubah hasil.
    const LCST_CPU_THREADS = Math.max(1, Number(navigator.hardwareConcurrency) || 4);
    const LCST_DEVICE_MEMORY_GB = Math.max(0, Number(navigator.deviceMemory) || 8);
    const LCST_TURBO_PARALLEL_OCR = LCST_CPU_THREADS >= 4;

    // ULTRA FAST V6.3.7:
    // - maksimal 2 paket (6 gambar) dapat membaca PERIODE secara paralel pada perangkat kuat.
    // - worker ke-3 hanya diaktifkan bila CPU/RAM cukup; perangkat ringan otomatis kembali ke jalur stabil lama.
    // - Google Sheet, validasi periode, taruhan, timestamp, dan REGC tidak diubah.
    const LCST_DUAL_PACKAGE_OCR = LCST_CPU_THREADS >= 4 && LCST_DEVICE_MEMORY_GB >= 4;
    // V6.4.3: pada perangkat kuat worker timestamp boleh hidup bersama mode 2 paket.
    // Ini membuat pembacaan kode, taruhan, dan tanggal/jam benar-benar overlap.
    const LCST_TURBO_TIMESTAMP_WORKER =
        LCST_CPU_THREADS >= 8 && LCST_DEVICE_MEMORY_GB >= 8;

    // V6.4.0 — Batas claim berdasarkan waktu yang terbaca pada GAMBAR KE-2 / KE-5.
    // Kolom screenshot menampilkan "Waktu (GMT+X)". Semua timestamp wajib dinormalisasi
    // ke GMT+7 / Asia/Jakarta sebelum tanggal claim dihitung. Contoh GMT+8 -> WIB = -1 jam.
    // Jika pengurangan melewati 00:00, tanggal otomatis mundur satu hari.
    const LCST_CLAIM_TIME_ZONE = 'Asia/Jakarta';
    const LCST_TARGET_GMT_OFFSET_MINUTES = 7 * 60;
    const LCST_HISTORY_DEFAULT_GMT_OFFSET_MINUTES = LCST_TARGET_GMT_OFFSET_MINUTES;
    const LCST_CLAIM_CUTOFF_MINUTES = 2 * 60;
    const LCST_NUMERIC_OCR_WHITELIST = '0123456789';
    // GMT/UTC/+ ikut diizinkan agar header "Waktu (GMT+8)" dapat dibaca OCR.
    const LCST_TIMESTAMP_OCR_WHITELIST = '0123456789:/.-+() AMPampGMTgmtUTCutcWIBwib';

    // Selisih terhadap jam perangkat. Nilainya diperbarui dari header Date server
    // secara non-blocking agar proses scan tidak menunggu koneksi internet.
    let lcstOnlineTimeOffsetMs = 0;
    let lcstOnlineTimeSource = 'PERANGKAT';
    let lcstOnlineTimeLastSync = 0;
    let lcstOnlineTimeSyncRunning = false;

    function lcstNowMs() {
        return Date.now() + (Number(lcstOnlineTimeOffsetMs) || 0);
    }

    function lcstNowDate() {
        return new Date(lcstNowMs());
    }

    function lcstGetOnlineTimeSourceLabel() {
        return lcstOnlineTimeSource === 'ONLINE' ? 'ONLINE' : 'PERANGKAT';
    }

    function lcstSyncOnlineTime(force) {
        const now = Date.now();
        if (lcstOnlineTimeSyncRunning) return;
        if (!force && lcstOnlineTimeLastSync && now - lcstOnlineTimeLastSync < 5 * 60 * 1000) return;
        if (typeof GM_xmlhttpRequest !== 'function') return;

        lcstOnlineTimeSyncRunning = true;
        const startedAt = Date.now();
        try {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://www.google.com/generate_204?lcst_time=' + startedAt,
                timeout: 5000,
                headers: { 'Cache-Control': 'no-cache' },
                onload: (response) => {
                    const endedAt = Date.now();
                    const headers = String(response && response.responseHeaders || '');
                    const match = headers.match(/^date:\s*(.+)$/im);
                    const serverMs = match ? Date.parse(match[1].trim()) : NaN;
                    if (Number.isFinite(serverMs)) {
                        // Tambahkan setengah waktu perjalanan agar pendekatan jam server lebih dekat.
                        const estimatedServerNow = serverMs + Math.max(0, endedAt - startedAt) / 2;
                        lcstOnlineTimeOffsetMs = estimatedServerNow - endedAt;
                        lcstOnlineTimeSource = 'ONLINE';
                        lcstOnlineTimeLastSync = endedAt;
                    }
                    lcstOnlineTimeSyncRunning = false;
                },
                onerror: () => { lcstOnlineTimeSyncRunning = false; },
                ontimeout: () => { lcstOnlineTimeSyncRunning = false; }
            });
        } catch (e) {
            lcstOnlineTimeSyncRunning = false;
        }
    }

    function lcstGetWibParts(dateValue) {
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue != null ? dateValue : lcstNowMs());
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: LCST_CLAIM_TIME_ZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        });
        const values = {};
        formatter.formatToParts(date).forEach((part) => {
            if (part.type !== 'literal') values[part.type] = part.value;
        });
        const year = Number(values.year);
        const month = Number(values.month);
        const day = Number(values.day);
        const hour = Number(values.hour);
        const minute = Number(values.minute);
        const second = Number(values.second);
        return {
            year, month, day, hour, minute, second,
            dateKey: String(year).padStart(4, '0') + String(month).padStart(2, '0') + String(day).padStart(2, '0'),
            minutesOfDay: hour * 60 + minute
        };
    }

    function lcstValidDateParts(year, month, day) {
        year = Number(year);
        month = Number(month);
        day = Number(day);
        if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
        if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
        const check = new Date(Date.UTC(year, month - 1, day));
        if (
            check.getUTCFullYear() !== year ||
            check.getUTCMonth() !== month - 1 ||
            check.getUTCDate() !== day
        ) return null;
        return {
            dateKey: String(year).padStart(4, '0') + String(month).padStart(2, '0') + String(day).padStart(2, '0'),
            year, month, day
        };
    }

    function lcstParseClaimDateFromPeriod(period) {
        const digits = String(period == null ? '' : period).replace(/\D/g, '');
        const candidates = [];
        if (digits.length >= 8) candidates.push(digits.slice(0, 8));
        const embedded = digits.match(/20\d{6}/g) || [];
        embedded.forEach((value) => {
            if (!candidates.includes(value)) candidates.push(value);
        });

        for (const dateKey of candidates) {
            if (!/^20\d{6}$/.test(dateKey)) continue;
            const valid = lcstValidDateParts(
                Number(dateKey.slice(0, 4)),
                Number(dateKey.slice(4, 6)),
                Number(dateKey.slice(6, 8))
            );
            if (valid) return valid;
        }
        return null;
    }

    const LCST_MONTH_NUMBER = {
        JAN: 1, JANUARI: 1, JANUARY: 1,
        FEB: 2, FEBRUARI: 2, FEBRUARY: 2,
        MAR: 3, MARET: 3, MARCH: 3,
        APR: 4, APRIL: 4,
        MEI: 5, MAY: 5,
        JUN: 6, JUNI: 6, JUNE: 6,
        JUL: 7, JULI: 7, JULY: 7,
        AGU: 8, AGT: 8, AGUSTUS: 8, AUG: 8, AUGUST: 8,
        SEP: 9, SEPT: 9, SEPTEMBER: 9,
        OKT: 10, OKTOBER: 10, OCT: 10, OCTOBER: 10,
        NOV: 11, NOVEMBER: 11,
        DES: 12, DESEMBER: 12, DEC: 12, DECEMBER: 12
    };

    function lcstFixOcrNumericText(value) {
        const source = String(value == null ? '' : value).toUpperCase();
        let out = '';
        for (let i = 0; i < source.length; i++) {
            const ch = source[i];
            const prev = source[i - 1] || '';
            const next = source[i + 1] || '';
            const numericNeighbor = /[0-9:\-/.]/.test(prev) || /[0-9:\-/.]/.test(next);
            if (numericNeighbor && (ch === 'O' || ch === 'Q')) out += '0';
            else if (numericNeighbor && (ch === 'I' || ch === 'L' || ch === '|')) out += '1';
            else if (numericNeighbor && ch === 'S') out += '5';
            else if (numericNeighbor && ch === 'B') out += '8';
            else out += ch;
        }
        return out.replace(/[，]/g, ',').replace(/[：]/g, ':');
    }

    function lcstParseClockParts(hourRaw, minuteRaw, secondRaw, ampmRaw) {
        let hour = Number(hourRaw);
        const minute = Number(minuteRaw);
        const second = secondRaw == null || secondRaw === '' ? 0 : Number(secondRaw);
        const ampm = String(ampmRaw || '').toUpperCase().replace(/[^APM]/g, '');
        if (!Number.isInteger(hour) || !Number.isInteger(minute) || !Number.isInteger(second)) return null;
        if (minute < 0 || minute > 59 || second < 0 || second > 59) return null;
        if (ampm) {
            if (hour < 1 || hour > 12) return null;
            if (ampm.startsWith('P') && hour !== 12) hour += 12;
            if (ampm.startsWith('A') && hour === 12) hour = 0;
        }
        if (hour < 0 || hour > 23) return null;
        return { hour, minute, second, minutesOfDay: hour * 60 + minute };
    }

    function lcstParseGmtOffsetMinutes(rawText) {
        const text = String(rawText == null ? '' : rawText)
            .toUpperCase()
            .replace(/[−–—]/g, '-')
            .replace(/\s+/g, ' ');
        // Mendukung GMT+8, GMT + 08, GMT+08:00, UTC+8, dan nilai negatif.
        const match = text.match(/\b(?:GMT|UTC)\s*([+-])\s*(\d{1,2})(?:\s*:\s*(\d{2}))?/i);
        if (!match) return null;
        const hours = Number(match[2]);
        const minutes = match[3] == null ? 0 : Number(match[3]);
        if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 14 || minutes > 59) return null;
        const sign = match[1] === '-' ? -1 : 1;
        return sign * (hours * 60 + minutes);
    }

    function lcstResolveSourceGmtOffsetMinutes(rawText, explicitOffsetMinutes) {
        if (explicitOffsetMinutes != null && explicitOffsetMinutes !== '') {
            const explicit = Number(explicitOffsetMinutes);
            if (Number.isFinite(explicit) && explicit >= -14 * 60 && explicit <= 14 * 60) return explicit;
        }
        const detected = lcstParseGmtOffsetMinutes(rawText);
        return detected == null ? LCST_HISTORY_DEFAULT_GMT_OFFSET_MINUTES : detected;
    }

    function lcstNormalizeTimestampToWib(timestamp, sourceGmtOffsetMinutes) {
        if (!timestamp || !timestamp.hasTime) return timestamp;
        const sourceOffset = lcstResolveSourceGmtOffsetMinutes(timestamp.rawText || '', sourceGmtOffsetMinutes);
        const sourceWallAsUtcMs = Date.UTC(
            Number(timestamp.year),
            Number(timestamp.month) - 1,
            Number(timestamp.day),
            Number(timestamp.hour),
            Number(timestamp.minute),
            Number(timestamp.second) || 0
        );
        // Wall-clock sumber -> instant UTC -> wall-clock GMT+7.
        const utcInstantMs = sourceWallAsUtcMs - sourceOffset * 60000;
        const targetWall = new Date(utcInstantMs + LCST_TARGET_GMT_OFFSET_MINUTES * 60000);
        const year = targetWall.getUTCFullYear();
        const month = targetWall.getUTCMonth() + 1;
        const day = targetWall.getUTCDate();
        const hour = targetWall.getUTCHours();
        const minute = targetWall.getUTCMinutes();
        const second = targetWall.getUTCSeconds();
        const valid = lcstValidDateParts(year, month, day);
        if (!valid) return timestamp;
        return {
            ...timestamp,
            dateKey: valid.dateKey,
            year, month, day, hour, minute, second,
            minutesOfDay: hour * 60 + minute,
            hasTime: true,
            sourceDateKey: timestamp.dateKey,
            sourceYear: timestamp.year,
            sourceMonth: timestamp.month,
            sourceDay: timestamp.day,
            sourceHour: timestamp.hour,
            sourceMinute: timestamp.minute,
            sourceSecond: timestamp.second,
            sourceGmtOffsetMinutes: sourceOffset,
            targetGmtOffsetMinutes: LCST_TARGET_GMT_OFFSET_MINUTES,
            timezoneAdjusted: sourceOffset !== LCST_TARGET_GMT_OFFSET_MINUTES
        };
    }

    function lcstLooksLikeTimestampText(rawText) {
        const text = lcstFixOcrNumericText(rawText || '');
        const hasClock = /\b[0-2]?\d\s*[:.]\s*[0-5]\d(?:\s*[:.]\s*[0-5]\d)?\b/.test(text);
        const hasDate = /\b(?:20\d{2}\s*[-/.]\s*[01]?\d\s*[-/.]\s*[0-3]?\d|[01]?\d\s*[-/.]\s*[0-3]?\d|[0-3]?\d\s*[-/.]\s*[01]?\d)\b/.test(text);
        return hasClock && hasDate;
    }

    function lcstInferYearForMonthDay(month, day, nowWib) {
        const now = nowWib || lcstGetWibParts(lcstNowDate());
        let year = now.year;
        let valid = lcstValidDateParts(year, month, day);
        if (!valid) return null;
        const candidateDay = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
        const todayDay = Math.floor(Date.UTC(now.year, now.month - 1, now.day) / 86400000);
        if (candidateDay > todayDay + 2) year -= 1;
        return year;
    }

    function lcstMakeImageTimestamp(dateInfo, clockInfo, rawText, source, confidence, sourceGmtOffsetMinutes) {
        if (!dateInfo) return null;
        const clock = clockInfo || { hour: null, minute: null, second: null, minutesOfDay: null };
        const timestamp = {
            dateKey: dateInfo.dateKey,
            year: dateInfo.year,
            month: dateInfo.month,
            day: dateInfo.day,
            hour: Number.isInteger(clock.hour) ? clock.hour : null,
            minute: Number.isInteger(clock.minute) ? clock.minute : null,
            second: Number.isInteger(clock.second) ? clock.second : null,
            minutesOfDay: Number.isInteger(clock.minutesOfDay) ? clock.minutesOfDay : null,
            hasTime: Number.isInteger(clock.hour) && Number.isInteger(clock.minute),
            rawText: String(rawText || '').trim().slice(0, 900),
            source: source || 'image-2-ocr',
            confidence: Number(confidence) || 0
        };
        return timestamp.hasTime
            ? lcstNormalizeTimestampToWib(timestamp, sourceGmtOffsetMinutes)
            : timestamp;
    }

    function lcstParseImageTimestampText(rawText, fallbackPeriod, nowValue, sourceGmtOffsetMinutes) {
        const original = String(rawText == null ? '' : rawText)
            .replace(/\r/g, '\n')
            .replace(/[\t ]+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim();
        const numeric = lcstFixOcrNumericText(original);
        const nowWib = lcstGetWibParts(nowValue || lcstNowDate());
        const candidates = [];

        const addCandidate = (yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw, ampmRaw, index, source) => {
            let year = Number(yearRaw);
            if (year >= 0 && year < 100) year += year >= 70 ? 1900 : 2000;
            const dateInfo = lcstValidDateParts(year, Number(monthRaw), Number(dayRaw));
            if (!dateInfo) return;
            const clock = hourRaw == null || minuteRaw == null
                ? null
                : lcstParseClockParts(hourRaw, minuteRaw, secondRaw, ampmRaw);
            if (hourRaw != null && minuteRaw != null && !clock) return;
            const explicitYear = String(yearRaw == null ? '' : yearRaw).replace(/\D/g, '').length >= 4;
            candidates.push({
                timestamp: lcstMakeImageTimestamp(dateInfo, clock, original, source, 0, sourceGmtOffsetMinutes),
                index: Number(index) || 0,
                // UI kolom Waktu memakai MM/DD. Kandidat MM/DD dengan jam diberi prioritas
                // agar 08/09 tidak terbalik menjadi 8 September.
                score: (clock ? 45 : 15) +
                    (/image-2-row/.test(source) ? 90 : 0) +
                    (/(?:time-md|ocr-md)(?:$|\+)/.test(source) ? 34 : 0) +
                    (explicitYear ? 95 : 0)
            });
        };

        const timeTail = '(?:[T,\\s]+([0-2]?\\d)\\s*[:.]\\s*([0-5]\\d)(?:\\s*[:.]\\s*([0-5]\\d))?\\s*(A\\.?M\\.?|P\\.?M\\.?)?)?';
        let match;
        let re = new RegExp('\\b(20\\d{2})\\s*[-/.]\\s*([01]?\\d)\\s*[-/.]\\s*([0-3]?\\d)' + timeTail, 'gi');
        while ((match = re.exec(numeric))) addCandidate(match[1], match[2], match[3], match[4], match[5], match[6], match[7], match.index, 'image-2-ocr-ymd');

        re = new RegExp('\\b([0-3]?\\d)\\s*[-/.]\\s*([01]?\\d)\\s*[-/.]\\s*(20\\d{2}|\\d{2})' + timeTail, 'gi');
        while ((match = re.exec(numeric))) addCandidate(match[3], match[2], match[1], match[4], match[5], match[6], match[7], match.index, 'image-2-ocr-dmy');

        const monthNames = Object.keys(LCST_MONTH_NUMBER).sort((a, b) => b.length - a.length).join('|');
        re = new RegExp('\\b([0-3]?\\d)\\s+(?:' + monthNames + ')\\s+(20\\d{2}|\\d{2})' + timeTail, 'gi');
        while ((match = re.exec(original.toUpperCase()))) {
            const monthWordMatch = String(match[0]).toUpperCase().match(new RegExp('(' + monthNames + ')'));
            const month = monthWordMatch ? LCST_MONTH_NUMBER[monthWordMatch[1]] : null;
            if (month) addCandidate(match[2], month, match[1], match[3], match[4], match[5], match[6], match.index, 'image-2-ocr-month');
        }

        // Format tanpa tahun, misalnya 31/07 23:58. Tahun dipilih yang paling dekat dengan hari ini.
        re = /\b([0-3]?\d)\s*[-/.]\s*([01]?\d)(?!\s*[-/.]\s*\d{2,4})(?:\s+|\s*[,|-]\s*)([0-2]?\d)\s*[:.]\s*([0-5]\d)(?:\s*[:.]\s*([0-5]\d))?\s*(A\.?M\.?|P\.?M\.?)?/gi;
        while ((match = re.exec(numeric))) {
            const inferredYear = lcstInferYearForMonthDay(Number(match[2]), Number(match[1]), nowWib);
            if (inferredYear) addCandidate(inferredYear, match[2], match[1], match[3], match[4], match[5], match[6], match.index, 'image-2-ocr-dm');
        }

        // Format tanpa tahun MM/DD HH:MM, misalnya 07/31 16:33 atau 07/31, 16:33.
        re = /\b([01]?\d)\s*[-/.]\s*([0-3]?\d)(?!\s*[-/.]\s*\d{2,4})(?:\s+|\s*[,|-]\s*)([0-2]?\d)\s*[:.]\s*([0-5]\d)(?:\s*[:.]\s*([0-5]\d))?\s*(A\.?M\.?|P\.?M\.?)?/gi;
        while ((match = re.exec(numeric))) {
            const inferredYear = lcstInferYearForMonthDay(Number(match[1]), Number(match[2]), nowWib);
            if (inferredYear) addCandidate(inferredYear, match[1], match[2], match[3], match[4], match[5], match[6], match.index, 'image-2-ocr-md');
        }

        // Format waktu lebih dulu, lalu tanggal di baris/kolom berikutnya.
        // Mendukung susunan seperti "16:33:25 07/31" yang umum pada screenshot Riwayat Permainan.
        re = /\b([0-2]?\d)\s*[:.]\s*([0-5]\d)(?:\s*[:.]\s*([0-5]\d))?\s*(A\.?M\.?|P\.?M\.?)?(?:\s+|\s*[,|-]\s*)([01]?\d)\s*[-/.]\s*([0-3]?\d)\b(?!\s*[-/.]\s*\d{2,4})/gi;
        while ((match = re.exec(numeric))) {
            const inferredYear = lcstInferYearForMonthDay(Number(match[5]), Number(match[6]), nowWib);
            if (inferredYear) addCandidate(inferredYear, match[5], match[6], match[1], match[2], match[3], match[4], match.index, 'image-2-row-time-md');
        }
        re = /\b([0-2]?\d)\s*[:.]\s*([0-5]\d)(?:\s*[:.]\s*([0-5]\d))?\s*(A\.?M\.?|P\.?M\.?)?(?:\s+|\s*[,|-]\s*)([0-3]?\d)\s*[-/.]\s*([01]?\d)\b(?!\s*[-/.]\s*\d{2,4})/gi;
        while ((match = re.exec(numeric))) {
            const inferredYear = lcstInferYearForMonthDay(Number(match[6]), Number(match[5]), nowWib);
            if (inferredYear) addCandidate(inferredYear, match[6], match[5], match[1], match[2], match[3], match[4], match.index, 'image-2-ocr-time-dm');
        }

        // Bila tanggal dan jam terpisah oleh baris/label, gabungkan tanggal terbaik dengan jam terdekat.
        const dateOnly = [];
        const addDateOnly = (yearRaw, monthRaw, dayRaw, index) => {
            const explicitYear = String(yearRaw == null ? '' : yearRaw).replace(/\D/g, '').length >= 4;
            let year = Number(yearRaw);
            if (year >= 0 && year < 100) year += year >= 70 ? 1900 : 2000;
            const dateInfo = lcstValidDateParts(year, Number(monthRaw), Number(dayRaw));
            if (dateInfo) dateOnly.push({ dateInfo, index, explicitYear });
        };
        const addDateOnlyNoYear = (monthRaw, dayRaw, index, format) => {
            const inferredYear = lcstInferYearForMonthDay(Number(monthRaw), Number(dayRaw), nowWib);
            const dateInfo = inferredYear ? lcstValidDateParts(inferredYear, Number(monthRaw), Number(dayRaw)) : null;
            if (dateInfo) dateOnly.push({ dateInfo, index, explicitYear: false, format: format || '' });
        };
        re = /\b(20\d{2})\s*[-/.]\s*([01]?\d)\s*[-/.]\s*([0-3]?\d)\b/g;
        while ((match = re.exec(numeric))) addDateOnly(match[1], match[2], match[3], match.index);
        re = /\b([0-3]?\d)\s*[-/.]\s*([01]?\d)\s*[-/.]\s*(20\d{2}|\d{2})\b/g;
        while ((match = re.exec(numeric))) addDateOnly(match[3], match[2], match[1], match.index);
        // Format tanpa tahun pada kolom waktu game sering memakai MM/DD, mis. 07/31.
        re = /\b([01]?\d)\s*[-/.]\s*([0-3]?\d)\b(?!\s*[-/.]\s*\d{2,4})/g;
        while ((match = re.exec(numeric))) addDateOnlyNoYear(match[1], match[2], match.index, 'md');
        // Tambahkan juga pembacaan DD/MM agar format lokal tetap terbaca bila muncul.
        re = /\b([0-3]?\d)\s*[-/.]\s*([01]?\d)\b(?!\s*[-/.]\s*\d{2,4})/g;
        while ((match = re.exec(numeric))) addDateOnlyNoYear(match[2], match[1], match.index, 'dm');

        const times = [];
        re = /\b([0-2]?\d)\s*[:.]\s*([0-5]\d)(?:\s*[:.]\s*([0-5]\d))?\s*(A\.?M\.?|P\.?M\.?)?/gi;
        while ((match = re.exec(numeric))) {
            const clock = lcstParseClockParts(match[1], match[2], match[3], match[4]);
            if (clock) times.push({ clock, index: match.index });
        }
        dateOnly.forEach((dateItem) => {
            const nearest = times.slice().sort((a, b) => Math.abs(a.index - dateItem.index) - Math.abs(b.index - dateItem.index))[0];
            if (nearest && Math.abs(nearest.index - dateItem.index) <= 120) {
                candidates.push({
                    timestamp: lcstMakeImageTimestamp(dateItem.dateInfo, nearest.clock, original, 'image-2-ocr-split', 0, sourceGmtOffsetMinutes),
                    index: dateItem.index,
                    score: 52 - Math.min(20, Math.floor(Math.abs(nearest.index - dateItem.index) / 8)) +
                        (dateItem.format === 'md' ? 30 : 0) +
                        (dateItem.explicitYear ? 95 : 0)
                });
            }
        });


        // Cadangan ketika Tesseract menghilangkan tanda ':' '/' '-'.
        // Contoh gambar Riwayat Permainan dapat terbaca sebagai dua baris:
        // 163325 dan 0731, atau 1600 dan 31072025.
        const compactRows = original.split(/\n+/).map((line, index) => ({
            index,
            digits: String(line || '').replace(/\D/g, '')
        })).filter((item) => item.digits.length >= 4 && item.digits.length <= 12);
        const compactDates = [];
        const compactTimes = [];

        const pushCompactDate = (year, month, day, index, source) => {
            const valid = lcstValidDateParts(Number(year), Number(month), Number(day));
            if (valid) compactDates.push({ dateInfo: valid, index, source });
        };
        const pushCompactDateNoYear = (month, day, index, source) => {
            const year = lcstInferYearForMonthDay(Number(month), Number(day), nowWib);
            if (year) pushCompactDate(year, month, day, index, source);
        };
        const pushCompactTime = (hour, minute, second, index, source) => {
            const clock = lcstParseClockParts(hour, minute, second, '');
            if (clock) compactTimes.push({ clock, index, source });
        };

        compactRows.forEach((item) => {
            const d = item.digits;
            if (d.length === 4) {
                pushCompactTime(d.slice(0, 2), d.slice(2, 4), '0', item.index, 'image-2-compact-hm');
                pushCompactDateNoYear(d.slice(0, 2), d.slice(2, 4), item.index, 'image-2-compact-md');
                pushCompactDateNoYear(d.slice(2, 4), d.slice(0, 2), item.index, 'image-2-compact-dm');
            } else if (d.length === 6) {
                pushCompactTime(d.slice(0, 2), d.slice(2, 4), d.slice(4, 6), item.index, 'image-2-compact-hms');
            } else if (d.length === 8) {
                if (/^20\d{6}$/.test(d)) pushCompactDate(d.slice(0, 4), d.slice(4, 6), d.slice(6, 8), item.index, 'image-2-compact-ymd');
                pushCompactDate(d.slice(4, 8), d.slice(2, 4), d.slice(0, 2), item.index, 'image-2-compact-dmy');
                pushCompactDate(d.slice(4, 8), d.slice(0, 2), d.slice(2, 4), item.index, 'image-2-compact-mdy');
            } else if (d.length === 10) {
                // HHMMSS + MMDD atau MMDD + HHMMSS.
                pushCompactTime(d.slice(0, 2), d.slice(2, 4), d.slice(4, 6), item.index, 'image-2-compact-hms-md');
                pushCompactDateNoYear(d.slice(6, 8), d.slice(8, 10), item.index, 'image-2-compact-hms-md');
                pushCompactDateNoYear(d.slice(0, 2), d.slice(2, 4), item.index, 'image-2-compact-md-hms');
                pushCompactTime(d.slice(4, 6), d.slice(6, 8), d.slice(8, 10), item.index, 'image-2-compact-md-hms');
            } else if (d.length === 12) {
                // HHMM + DDMMYYYY / MMDDYYYY atau tanggal 8 digit + HHMM.
                pushCompactTime(d.slice(0, 2), d.slice(2, 4), '0', item.index, 'image-2-compact-hm-date');
                pushCompactDate(d.slice(8, 12), d.slice(6, 8), d.slice(4, 6), item.index, 'image-2-compact-hm-dmy');
                pushCompactDate(d.slice(8, 12), d.slice(4, 6), d.slice(6, 8), item.index, 'image-2-compact-hm-mdy');
                if (/^20\d{6}/.test(d)) {
                    pushCompactDate(d.slice(0, 4), d.slice(4, 6), d.slice(6, 8), item.index, 'image-2-compact-ymd-hm');
                    pushCompactTime(d.slice(8, 10), d.slice(10, 12), '0', item.index, 'image-2-compact-ymd-hm');
                }
                pushCompactDate(d.slice(4, 8), d.slice(2, 4), d.slice(0, 2), item.index, 'image-2-compact-dmy-hm');
                pushCompactTime(d.slice(8, 10), d.slice(10, 12), '0', item.index, 'image-2-compact-dmy-hm');
            }
        });

        compactDates.forEach((dateItem) => {
            const combinedSource = /(?:hms-md|md-hms|hm-dmy|hm-mdy|ymd-hm|dmy-hm)/.test(dateItem.source);
            const timePool = compactTimes.filter((timeItem) => combinedSource || timeItem.index !== dateItem.index);
            const nearest = timePool.sort((a, b) => Math.abs(a.index - dateItem.index) - Math.abs(b.index - dateItem.index))[0];
            if (!nearest || Math.abs(nearest.index - dateItem.index) > 3) return;
            const explicitYear = /(?:ymd|dmy|mdy)/.test(dateItem.source) && !/(?:compact-md$|compact-dm$)/.test(dateItem.source);
            candidates.push({
                timestamp: lcstMakeImageTimestamp(
                    dateItem.dateInfo,
                    nearest.clock,
                    original,
                    dateItem.source + '+' + nearest.source,
                    0,
                    sourceGmtOffsetMinutes
                ),
                index: Math.min(dateItem.index, nearest.index),
                score: 40 - Math.abs(nearest.index - dateItem.index) * 4 +
                    (/compact-md/.test(dateItem.source) ? 28 : 0) +
                    (explicitYear ? 95 : 0)
            });
        });

        if (candidates.length) {
            const todayDay = Math.floor(Date.UTC(nowWib.year, nowWib.month - 1, nowWib.day) / 86400000);
            candidates.forEach((item) => {
                const ts = item.timestamp;
                const itemDay = Math.floor(Date.UTC(ts.year, ts.month - 1, ts.day) / 86400000);
                const dayDistance = todayDay - itemDay;
                if (dayDistance >= 0 && dayDistance <= 3) item.score += 30;
                else if (dayDistance < -1) item.score -= 45;
                if (ts.hasTime) item.score += 12;
            });
            candidates.sort((a, b) => (b.score - a.score) || (a.index - b.index));
            return candidates[0].timestamp;
        }

        const fallbackDate = lcstParseClaimDateFromPeriod(fallbackPeriod);
        if (fallbackDate) {
            return lcstMakeImageTimestamp(fallbackDate, null, original, 'period-date-fallback', 0, sourceGmtOffsetMinutes);
        }
        return null;
    }

    function lcstFormatClaimDate(dateInfo) {
        if (!dateInfo) return '-';
        return String(dateInfo.day).padStart(2, '0') + '/' +
            String(dateInfo.month).padStart(2, '0') + '/' +
            String(dateInfo.year);
    }

    function lcstFormatClaimTimestamp(timestamp) {
        if (!timestamp) return '-';
        const dateText = lcstFormatClaimDate(timestamp);
        if (!timestamp.hasTime) return dateText + ' • jam tidak terbaca';
        return dateText + ' ' + String(timestamp.hour).padStart(2, '0') + ':' + String(timestamp.minute).padStart(2, '0') + ' WIB (GMT+7)';
    }

    function lcstFormatClaimDeadline(status) {
        if (!status || !status.deadlineDate) return '-';
        return lcstFormatClaimDate(status.deadlineDate) + ' 02.00 WIB';
    }

    function lcstFormatCurrentWib(nowValue) {
        const nowWib = lcstGetWibParts(nowValue || lcstNowDate());
        return lcstFormatClaimDate(nowWib) + ' ' +
            String(nowWib.hour).padStart(2, '0') + ':' +
            String(nowWib.minute).padStart(2, '0') + ':' +
            String(nowWib.second).padStart(2, '0') + ' WIB';
    }

    function lcstCheckClaimDeadline(imageTimestamp, fallbackPeriod, nowValue) {
        // Kompatibilitas panggilan lama: lcstCheckClaimDeadline(period, nowDate)
        if (typeof imageTimestamp === 'string') {
            if (fallbackPeriod instanceof Date || typeof fallbackPeriod === 'number') {
                nowValue = fallbackPeriod;
            }
            fallbackPeriod = imageTimestamp;
            imageTimestamp = null;
        }

        const timestamp = imageTimestamp && typeof imageTimestamp === 'object' && imageTimestamp.year
            ? imageTimestamp
            : null;
        const claimDate = timestamp
            ? lcstValidDateParts(timestamp.year, timestamp.month, timestamp.day)
            : lcstParseClaimDateFromPeriod(fallbackPeriod);
        const nowWib = lcstGetWibParts(nowValue || lcstNowDate());
        if (!claimDate) {
            return {
                expired: false,
                hasDate: false,
                claimDate: null,
                imageTimestamp: timestamp,
                timestampSource: timestamp ? timestamp.source : '',
                nowWib,
                onlineTimeSource: lcstGetOnlineTimeSourceLabel(),
                dayDifference: null,
                reason: ''
            };
        }

        const claimDay = Math.floor(Date.UTC(claimDate.year, claimDate.month - 1, claimDate.day) / 86400000);
        const deadlineUtcDay = claimDay + 1;
        const deadlineUtcDate = new Date(deadlineUtcDay * 86400000);
        const deadlineDate = {
            year: deadlineUtcDate.getUTCFullYear(),
            month: deadlineUtcDate.getUTCMonth() + 1,
            day: deadlineUtcDate.getUTCDate(),
            dateKey: String(deadlineUtcDate.getUTCFullYear()).padStart(4, '0') +
                String(deadlineUtcDate.getUTCMonth() + 1).padStart(2, '0') +
                String(deadlineUtcDate.getUTCDate()).padStart(2, '0')
        };
        const todayDay = Math.floor(Date.UTC(nowWib.year, nowWib.month - 1, nowWib.day) / 86400000);
        const dayDifference = todayDay - claimDay;
        const cutoffReached = todayDay > deadlineUtcDay ||
            (todayDay === deadlineUtcDay && nowWib.minutesOfDay >= LCST_CLAIM_CUTOFF_MINUTES);
        const expired = cutoffReached;

        return {
            expired,
            hasDate: true,
            claimDate,
            imageTimestamp: timestamp,
            timestampSource: timestamp ? timestamp.source : 'period-date-fallback',
            usedImageTimestamp: !!timestamp && timestamp.source !== 'period-date-fallback',
            nowWib,
            onlineTimeSource: lcstGetOnlineTimeSourceLabel(),
            dayDifference,
            deadlineDate,
            cutoffReached,
            reason: expired
                ? 'Tidak dapat claim, sudah melewati batas waktu claim pukul 02.00 WIB.'
                : ''
        };
    }

    let lcstSharedWorker = null;
    let lcstSharedWorkerInit = null;
    let lcstSecondaryWorker = null;
    let lcstSecondaryWorkerInit = null;
    let lcstMetadataWorker = null;
    let lcstMetadataWorkerInit = null;
    let lcstTimestampWorker = null;
    let lcstTimestampWorkerInit = null;
    let lcstWorkerProgressHandler = null;
    let lcstWorkerPsm = null;
    let lcstWorkerPsmByWorker = new WeakMap();
    let lcstLastWorkerLogAt = 0;
    let lcstLastWorkerPct = -1;
    let lcstDashboardYieldCounter = 0;
    const lcstPreparedBaseCache = new WeakMap();

    // Cache hanya mempercepat pemuatan/scan ulang. Pemilihan gambar, marker,
    // crop, paket, dan validasi periode tetap memakai cara kerja V5.5.1.
    const lcstBlobUrlCache = new Map();
    const lcstArrangeCanvasCache = new Map();
    const lcstImageAnalysisCache = new Map();
    const lcstPeriodResultCache = new Map();
    const LCST_BLOB_CACHE_LIMIT = 24;
    const LCST_ARRANGE_CANVAS_CACHE_LIMIT = 24;
    const LCST_ANALYSIS_CACHE_LIMIT = 24;
    const LCST_RESULT_CACHE_LIMIT = 24;
    let lcstWorkerWarmupStarted = false;
    let lcstWorkerGeneration = 0;

    function trimFastCache(map, limit, onRemove) {
        while (map.size > limit) {
            const firstKey = map.keys().next().value;
            const value = map.get(firstKey);
            map.delete(firstKey);
            if (onRemove) {
                try { onRemove(value); } catch (e) {}
            }
        }
    }

    function normalizeOcrChars(text) {
        return String(text || '')
            .replace(/[OoQＤＯ○◯]/g, '0')
            .replace(/[Il|!]/g, '1')
            .replace(/[Ｓs]/g, '5')
            .replace(/[Ｂb]/g, '8')
            .replace(/[Ｚz]/g, '2')
            .replace(/[，]/g, ',')
            .replace(/[．]/g, '.');
    }

    function onlyDigits(text) {
        return normalizeOcrChars(text).replace(/\D/g, '');
    }

    function srcToBlobUrlByGM(src) {
        return new Promise((resolve) => {
            if (!src || /^data:image\//i.test(src) || /^blob:/i.test(src)) {
                resolve(src);
                return;
            }

            const cached = lcstBlobUrlCache.get(src);
            if (cached) {
                // Refresh urutan LRU tanpa mengubah URL atau isi gambar.
                lcstBlobUrlCache.delete(src);
                lcstBlobUrlCache.set(src, cached);
                resolve(cached);
                return;
            }

            if (typeof GM_xmlhttpRequest !== 'function') {
                resolve(src);
                return;
            }
            GM_xmlhttpRequest({
                method: 'GET',
                url: src,
                responseType: 'blob',
                anonymous: false,
                timeout: 25000,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300 && res.response) {
                        try {
                            const objectUrl = URL.createObjectURL(res.response);
                            lcstBlobUrlCache.set(src, objectUrl);
                            trimFastCache(lcstBlobUrlCache, LCST_BLOB_CACHE_LIMIT, (url) => {
                                if (/^blob:/i.test(url || '')) URL.revokeObjectURL(url);
                            });
                            resolve(objectUrl);
                        } catch (e) {
                            resolve(src);
                        }
                    } else {
                        resolve(src);
                    }
                },
                onerror: () => resolve(src),
                ontimeout: () => resolve(src)
            });
        });
    }

    function waitForTesseract(timeoutMs) {
        timeoutMs = timeoutMs || 15000;
        const started = Date.now();
        return new Promise((resolve, reject) => {
            (function check() {
                if (window.Tesseract && window.Tesseract.createWorker) {
                    resolve();
                    return;
                }
                if (Date.now() - started > timeoutMs) {
                    reject(new Error('Library OCR belum siap. Refresh halaman lalu coba lagi.'));
                    return;
                }
                setTimeout(check, 100);
            })();
        });
    }
    async function getSharedOCRWorker(onProgress) {
        await waitForTesseract(15000);
        lcstWorkerProgressHandler = onProgress || null;

        if (lcstSharedWorker) return lcstSharedWorker;
        if (lcstSharedWorkerInit) return lcstSharedWorkerInit;

        const workerGeneration = lcstWorkerGeneration;
        lcstSharedWorkerInit = (async () => {
            const worker = await window.Tesseract.createWorker(
                'eng',
                1,
                {
                    logger: (m) => {
                        const fn = lcstWorkerProgressHandler;
                        if (!fn || !m || !m.status) return;
                        const now = Date.now();
                        const pct = typeof m.progress === 'number' ? Math.round(m.progress * 100) : -1;
                        const meaningfulStep = pct < 0 || lcstLastWorkerPct < 0 || Math.abs(pct - lcstLastWorkerPct) >= 10;
                        if (!meaningfulStep && now - lcstLastWorkerLogAt < 800) return;
                        lcstLastWorkerLogAt = now;
                        lcstLastWorkerPct = pct;
                        fn(m.status + (pct < 0 ? '' : ' ' + pct + '%'));
                    },
                    errorHandler: (err) => console.error('[LCST OCR]', err)
                },
                { load_system_dawg: '0', load_freq_dawg: '0' }
            );

            // Parameter tetap hanya dikirim sekali. Selanjutnya hanya PSM yang berubah bila diperlukan.
            await worker.setParameters({
                tessedit_char_whitelist: LCST_NUMERIC_OCR_WHITELIST,
                preserve_interword_spaces: '1',
                user_defined_dpi: '300',
                classify_bln_numeric_mode: '1'
            });
            if (workerGeneration !== lcstWorkerGeneration) {
                try { await worker.terminate(); } catch (e) {}
                throw new Error('Persiapan OCR dibatalkan.');
            }
            lcstWorkerPsm = null;
            lcstSharedWorker = worker;
            return worker;
        })();

        try {
            return await lcstSharedWorkerInit;
        } finally {
            lcstSharedWorkerInit = null;
        }
    }


    async function getSecondaryOCRWorker() {
        if (!LCST_DUAL_PACKAGE_OCR) return null;
        await waitForTesseract(15000);
        if (lcstSecondaryWorker) return lcstSecondaryWorker;
        if (lcstSecondaryWorkerInit) return lcstSecondaryWorkerInit;

        const workerGeneration = lcstWorkerGeneration;
        lcstSecondaryWorkerInit = (async () => {
            const worker = await window.Tesseract.createWorker(
                'eng',
                1,
                {
                    logger: () => {},
                    errorHandler: (err) => console.error('[LCST OCR SECOND]', err)
                },
                { load_system_dawg: '0', load_freq_dawg: '0' }
            );
            await worker.setParameters({
                tessedit_char_whitelist: LCST_NUMERIC_OCR_WHITELIST,
                preserve_interword_spaces: '1',
                user_defined_dpi: '300',
                classify_bln_numeric_mode: '1'
            });
            if (workerGeneration !== lcstWorkerGeneration) {
                try { await worker.terminate(); } catch (e) {}
                throw new Error('Persiapan OCR paket kedua dibatalkan.');
            }
            lcstWorkerPsmByWorker.delete(worker);
            lcstSecondaryWorker = worker;
            return worker;
        })();

        try {
            return await lcstSecondaryWorkerInit;
        } finally {
            lcstSecondaryWorkerInit = null;
        }
    }

    async function getMetadataOCRWorker() {
        if (!LCST_TURBO_PARALLEL_OCR) return null;
        await waitForTesseract(15000);
        if (lcstMetadataWorker) return lcstMetadataWorker;
        if (lcstMetadataWorkerInit) return lcstMetadataWorkerInit;

        const workerGeneration = lcstWorkerGeneration;
        lcstMetadataWorkerInit = (async () => {
            const worker = await window.Tesseract.createWorker(
                'eng',
                1,
                {
                    // Worker metadata dibuat tanpa progress UI agar pembaruan panel
                    // tidak berebut waktu dengan worker periode utama.
                    logger: () => {},
                    errorHandler: (err) => console.error('[LCST OCR META]', err)
                },
                { load_system_dawg: '0', load_freq_dawg: '0' }
            );
            await worker.setParameters({
                tessedit_char_whitelist: LCST_NUMERIC_OCR_WHITELIST,
                preserve_interword_spaces: '1',
                user_defined_dpi: '300',
                classify_bln_numeric_mode: '1'
            });
            if (workerGeneration !== lcstWorkerGeneration) {
                try { await worker.terminate(); } catch (e) {}
                throw new Error('Persiapan OCR metadata dibatalkan.');
            }
            lcstWorkerPsmByWorker.delete(worker);
            lcstMetadataWorker = worker;
            return worker;
        })();

        try {
            return await lcstMetadataWorkerInit;
        } finally {
            lcstMetadataWorkerInit = null;
        }
    }

    async function getTimestampOCRWorker() {
        if (!LCST_TURBO_TIMESTAMP_WORKER) return null;
        await waitForTesseract(15000);
        if (lcstTimestampWorker) return lcstTimestampWorker;
        if (lcstTimestampWorkerInit) return lcstTimestampWorkerInit;

        const workerGeneration = lcstWorkerGeneration;
        lcstTimestampWorkerInit = (async () => {
            const worker = await window.Tesseract.createWorker(
                'eng',
                1,
                {
                    logger: () => {},
                    errorHandler: (err) => console.error('[LCST OCR TIME]', err)
                },
                { load_system_dawg: '0', load_freq_dawg: '0' }
            );
            await worker.setParameters({
                tessedit_char_whitelist: LCST_NUMERIC_OCR_WHITELIST,
                preserve_interword_spaces: '1',
                user_defined_dpi: '300',
                classify_bln_numeric_mode: '1'
            });
            if (workerGeneration !== lcstWorkerGeneration) {
                try { await worker.terminate(); } catch (e) {}
                throw new Error('Persiapan OCR waktu dibatalkan.');
            }
            lcstWorkerPsmByWorker.delete(worker);
            lcstTimestampWorker = worker;
            return worker;
        })();

        try {
            return await lcstTimestampWorkerInit;
        } finally {
            lcstTimestampWorkerInit = null;
        }
    }

    function warmupOCRWorker() {
        const primaryReady = !!(lcstSharedWorker || lcstSharedWorkerInit);
        const secondaryReady = !LCST_DUAL_PACKAGE_OCR || !!(lcstSecondaryWorker || lcstSecondaryWorkerInit);
        const metadataReady = !LCST_TURBO_PARALLEL_OCR || !!(lcstMetadataWorker || lcstMetadataWorkerInit);
        const timestampReady = !LCST_TURBO_TIMESTAMP_WORKER || !!(lcstTimestampWorker || lcstTimestampWorkerInit);
        if (lcstWorkerWarmupStarted || (primaryReady && secondaryReady && metadataReady && timestampReady)) return;
        lcstWorkerWarmupStarted = true;
        setTimeout(() => {
            const jobs = [
                getSharedOCRWorker(null).catch((err) => console.warn('[LCST OCR warmup]', err))
            ];
            if (LCST_DUAL_PACKAGE_OCR) {
                jobs.push(
                    getSecondaryOCRWorker().catch((err) => console.warn('[LCST OCR second warmup]', err))
                );
            }
            if (LCST_TURBO_PARALLEL_OCR) {
                jobs.push(
                    getMetadataOCRWorker().catch((err) => console.warn('[LCST OCR metadata warmup]', err))
                );
            }
            if (LCST_TURBO_TIMESTAMP_WORKER) {
                jobs.push(
                    getTimestampOCRWorker().catch((err) => console.warn('[LCST OCR time warmup]', err))
                );
            }
            Promise.allSettled(jobs)
                .finally(() => { lcstWorkerWarmupStarted = false; });
        }, 0);
    }

    async function destroySharedOCRWorker() {
        lcstWorkerGeneration++;
        const workers = [lcstSharedWorker, lcstSecondaryWorker, lcstMetadataWorker, lcstTimestampWorker].filter(Boolean);
        lcstSharedWorker = null;
        lcstSharedWorkerInit = null;
        lcstSecondaryWorker = null;
        lcstSecondaryWorkerInit = null;
        lcstMetadataWorker = null;
        lcstMetadataWorkerInit = null;
        lcstTimestampWorker = null;
        lcstTimestampWorkerInit = null;
        lcstWorkerProgressHandler = null;
        lcstWorkerPsm = null;
        lcstWorkerPsmByWorker = new WeakMap();
        lcstLastWorkerLogAt = 0;
        lcstLastWorkerPct = -1;
        lcstWorkerWarmupStarted = false;
        await Promise.allSettled(workers.map(async (worker) => {
            try { await worker.terminate(); } catch (e) {}
        }));
    }

    function loadImageElement(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Gambar gagal dimuat untuk OCR.'));
            img.src = src;
        });
    }

    function createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        return canvas;
    }

    function imageToCanvas(img) {
        const canvas = createCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        return canvas;
    }

    async function getArrangeImageCanvas(src) {
        const key = String(src || '');
        if (!key) throw new Error('Sumber gambar kosong.');

        const existing = lcstArrangeCanvasCache.get(key);
        if (existing) {
            lcstArrangeCanvasCache.delete(key);
            lcstArrangeCanvasCache.set(key, existing);
            return existing;
        }

        const task = (async () => {
            // HYPER FAST: gunakan image yang SUDAH dimuat LiveChat bila URL-nya sama.
            // Ini menghindari download kedua lewat GM_xmlhttpRequest pada attachment yang
            // browser sudah punya. Bila canvas terkena CORS/tainted, otomatis fallback.
            try {
                const imgs = Array.from(document.images || []);
                const domImg = imgs.find((img) => {
                    if (!img || !img.complete || !(img.naturalWidth > 0) || !(img.naturalHeight > 0)) return false;
                    const candidates = [
                        img.currentSrc,
                        img.src,
                        img.getAttribute && img.getAttribute('src'),
                        img.getAttribute && img.getAttribute('data-src'),
                        img.getAttribute && img.getAttribute('data-original'),
                        img.getAttribute && img.getAttribute('data-image-url'),
                        img.getAttribute && img.getAttribute('data-full-src')
                    ].filter(Boolean).map(String);
                    return candidates.includes(key);
                });
                if (domImg) {
                    const sourceCanvas = imageToCanvas(domImg);
                    // Tes 1 pixel untuk memastikan canvas tidak tainted.
                    sourceCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, 1, 1);
                    return { blobUrl: key, sourceCanvas, reusedDom: true };
                }
            } catch (e) {}

            const blobUrl = await srcToBlobUrlByGM(key);
            const img = await loadImageElement(blobUrl);
            return {
                blobUrl,
                sourceCanvas: imageToCanvas(img),
                reusedDom: false
            };
        })();

        lcstArrangeCanvasCache.set(key, task);
        trimFastCache(lcstArrangeCanvasCache, LCST_ARRANGE_CANVAS_CACHE_LIMIT);

        try {
            return await task;
        } catch (err) {
            lcstArrangeCanvasCache.delete(key);
            throw err;
        }
    }

    async function getImageAnalysis(src) {
        const key = String(src || '');
        if (!key) throw new Error('Sumber gambar kosong.');

        const existing = lcstImageAnalysisCache.get(key);
        if (existing) {
            lcstImageAnalysisCache.delete(key);
            lcstImageAnalysisCache.set(key, existing);
            return existing;
        }

        const task = (async () => {
            const base = await getArrangeImageCanvas(key);
            const marker = detectDoubleOrangeMarker(base.sourceCanvas);
            return {
                blobUrl: base.blobUrl,
                sourceCanvas: base.sourceCanvas,
                marker
            };
        })();

        lcstImageAnalysisCache.set(key, task);
        trimFastCache(lcstImageAnalysisCache, LCST_ANALYSIS_CACHE_LIMIT);

        try {
            return await task;
        } catch (err) {
            lcstImageAnalysisCache.delete(key);
            throw err;
        }
    }

    /* =========================================================
       AUTO ARRANGE V5.6.9 — FIX URUTAN SESUAI CONTOH
       Setiap paket 3 gambar disusun sendiri-sendiri:
       1) gambar permainan/gabungan,
       2) Riwayat Permainan (TARGET SCAN KODE),
       3) Kemenangan Total.

       CATATAN PENTING:
       - Tanda bulat oranye tidak lagi boleh sendirian menentukan gambar Riwayat.
       - Screenshot Riwayat harus berformat portrait dan dominan gelap.
       - Screenshot Kemenangan Total harus dominan merah/oranye/emas.
       - Screenshot lebar/gabungan diprioritaskan sebagai gambar permainan.
       ========================================================= */
    function lcstMeasureScreenshotVisuals(sourceCanvas) {
        // Sampling kecil supaya koreksi gambar tetap cepat walaupun screenshot banyak.
        const sample = createCanvas(84, 120);
        const ctx = sample.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(sourceCanvas, 0, 0, sample.width, sample.height);

        const sw = sample.width;
        const sh = sample.height;
        const data = ctx.getImageData(0, 0, sw, sh).data;
        const total = Math.max(1, data.length / 4);

        // V6.4.1: sidik-jari visual ringan. Screenshot yang sama dapat mempunyai URL berbeda
        // (token/query CDN berbeda), jadi URL saja tidak cukup untuk mendeteksi duplikat.
        // RGB dikuantisasi agar perubahan kompresi kecil tidak mudah mengubah identitas.
        let visualHash = 0x811c9dc5;
        for (let y = 0; y < sh; y += 2) {
            for (let x = 0; x < sw; x += 2) {
                const o = ((y * sw) + x) * 4;
                const qr = data[o] >> 4;
                const qg = data[o + 1] >> 4;
                const qb = data[o + 2] >> 4;
                visualHash ^= (qr << 8) ^ (qg << 4) ^ qb;
                visualHash = Math.imul(visualHash, 0x01000193) >>> 0;
            }
        }
        const visualFingerprint = sw + 'x' + sh + ':' + visualHash.toString(16).padStart(8, '0');

        let warm = 0;
        let strongWarm = 0;
        let dark = 0;
        let pale = 0;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (r >= 140 && r > g * 1.04 && g > b * 1.18 && b < 145) warm++;
            if (r >= 170 && g >= 55 && g <= 215 && b < 115 && r > g * 1.08) strongWarm++;
            if (r < 82 && g < 82 && b < 94) dark++;
            if (r > 210 && g > 205 && b > 195) pale++;
        }

        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const offset = (x, y) => ((y * sw) + x) * 4;
        const readPixel = (x, y) => {
            const o = offset(x, y);
            return { r: data[o], g: data[o + 1], b: data[o + 2] };
        };
        const isScatterWarm = (x, y) => {
            const { r, g, b } = readPixel(x, y);
            return r >= 155 && g >= 35 && g <= 225 && b < 150 && r > g * 1.07 && g > b * 1.06;
        };
        const measureRegion = (x1, y1, x2, y2) => {
            const left = clamp(Math.floor(x1), 0, sw - 1);
            const top = clamp(Math.floor(y1), 0, sh - 1);
            const right = clamp(Math.ceil(x2), left + 1, sw);
            const bottom = clamp(Math.ceil(y2), top + 1, sh);
            let count = 0;
            let warmCount = 0;
            let darkCount = 0;
            let paleCount = 0;
            let strongWarmCount = 0;
            for (let y = top; y < bottom; y++) {
                for (let x = left; x < right; x++) {
                    const { r, g, b } = readPixel(x, y);
                    count++;
                    if (r >= 140 && r > g * 1.04 && g > b * 1.18 && b < 145) warmCount++;
                    if (r >= 170 && g >= 55 && g <= 215 && b < 115 && r > g * 1.08) strongWarmCount++;
                    if (r < 82 && g < 82 && b < 94) darkCount++;
                    if (r > 210 && g > 205 && b > 195) paleCount++;
                }
            }
            const area = Math.max(1, count);
            return {
                warmRatio: warmCount / area,
                strongWarmRatio: strongWarmCount / area,
                darkRatio: darkCount / area,
                paleRatio: paleCount / area
            };
        };

        // Area papan permainan saja. Cluster merah/oranye dipakai sebagai prioritas scatter.
        const left = clamp(Math.floor(sw * 0.10), 0, sw - 1);
        const top = clamp(Math.floor(sh * 0.18), 0, sh - 1);
        const right = clamp(Math.ceil(sw * 0.90), left + 1, sw);
        const bottom = clamp(Math.ceil(sh * 0.66), top + 1, sh);
        const rw = right - left;
        const rh = bottom - top;
        const visited = new Uint8Array(Math.max(1, rw * rh));
        const localIndex = (x, y) => ((y - top) * rw) + (x - left);
        const minArea = Math.max(8, Math.round(rw * rh * 0.0055));
        const components = [];
        let boardWarmPixels = 0;

        for (let y = top; y < bottom; y++) {
            for (let x = left; x < right; x++) {
                if (!isScatterWarm(x, y)) continue;
                boardWarmPixels++;
                const li = localIndex(x, y);
                if (visited[li]) continue;

                const qx = [x];
                const qy = [y];
                visited[li] = 1;
                let cursor = 0;
                let area = 0;
                let minX = x, maxX = x, minY = y, maxY = y;

                while (cursor < qx.length) {
                    const cx = qx[cursor];
                    const cy = qy[cursor];
                    cursor++;
                    area++;
                    if (cx < minX) minX = cx;
                    if (cx > maxX) maxX = cx;
                    if (cy < minY) minY = cy;
                    if (cy > maxY) maxY = cy;

                    const neighbors = [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];
                    for (let j = 0; j < neighbors.length; j++) {
                        const nx = neighbors[j][0];
                        const ny = neighbors[j][1];
                        if (nx < left || nx >= right || ny < top || ny >= bottom) continue;
                        const ni = localIndex(nx, ny);
                        if (visited[ni] || !isScatterWarm(nx, ny)) continue;
                        visited[ni] = 1;
                        qx.push(nx);
                        qy.push(ny);
                    }
                }

                const cw = maxX - minX + 1;
                const ch = maxY - minY + 1;
                const aspect = cw / Math.max(1, ch);
                if (area >= minArea && aspect >= 0.25 && aspect <= 4.8) {
                    components.push({ area, width: cw, height: ch });
                }
            }
        }

        // V6.3.4 — bedakan GAME ASLI dengan gambar PROMO/INTRO.
        // GAME ASLI wajib terlihat papan Mahjong (banyak tile pucat/putih di area tengah).
        // Gambar promo seperti "PUTARAN GRATIS AKAN DIMENANGKAN / MULAI" biasanya
        // merah-oranye di tengah tetapi hampir tidak mempunyai area tile pucat.
        const topBar = measureRegion(sw * 0.10, sh * 0.02, sw * 0.90, sh * 0.16);
        const boardCenter = measureRegion(sw * 0.12, sh * 0.18, sw * 0.88, sh * 0.72);
        const lowerBanner = measureRegion(sw * 0.04, sh * 0.74, sw * 0.96, sh * 0.99);

        const isBoardGameCandidate = !!(
            boardCenter.paleRatio >= 0.095 &&
            boardCenter.warmRatio <= 0.58
        );

        // Contoh pertama user: gameplay penuh/free-spin, papan terlihat + bagian bawah hangat/oranye.
        const isPreferredFullGame = !!(
            isBoardGameCandidate &&
            boardCenter.paleRatio >= 0.16 &&
            lowerBanner.warmRatio >= 0.18 &&
            dark / total <= 0.28
        );

        // Promo/intro: tengah dominan merah-oranye dan hampir tidak ada tile Mahjong.
        const isPromoSplash = !!(
            boardCenter.paleRatio < 0.075 &&
            boardCenter.warmRatio >= 0.38
        );

        const promoSplashPenalty = isPromoSplash ? 5200 : 0;
        const boardGamePriority = isBoardGameCandidate
            ? 1250 + boardCenter.paleRatio * 1450 - boardCenter.darkRatio * 180
            : -1850;
        const fullGamePriority = isPreferredFullGame
            ? 4200 +
                topBar.warmRatio * 260 +
                boardCenter.paleRatio * 900 +
                lowerBanner.warmRatio * 1050 +
                lowerBanner.strongWarmRatio * 350
            : 0;

        components.sort((a, b) => b.area - a.area);
        const scatterClusterCount = Math.min(6, components.length);
        const scatterLargestArea = components[0] ? components[0].area : 0;
        const scatterArea = components.reduce((sum, c) => sum + c.area, 0);
        const scatterWarmRatio = boardWarmPixels / Math.max(1, rw * rh);
        const scatterPriority =
            scatterClusterCount * 190 +
            Math.min(330, scatterLargestArea * 2.25) +
            Math.min(230, scatterArea * 0.45) +
            scatterWarmRatio * 520 +
            fullGamePriority;

        const width = Math.max(1, Number(sourceCanvas.width) || 1);
        const height = Math.max(1, Number(sourceCanvas.height) || 1);
        return {
            width,
            height,
            aspectRatio: width / height,
            visualFingerprint,
            warmRatio: warm / total,
            strongWarmRatio: strongWarm / total,
            darkRatio: dark / total,
            paleRatio: pale / total,
            scatterClusterCount,
            scatterLargestArea,
            scatterArea,
            scatterWarmRatio,
            isBoardGameCandidate,
            isPreferredFullGame,
            isPromoSplash,
            promoSplashPenalty,
            boardGamePriority,
            fullGamePriority,
            topBarWarmRatio: topBar.warmRatio,
            boardCenterPaleRatio: boardCenter.paleRatio,
            boardCenterWarmRatio: boardCenter.warmRatio,
            lowerBannerWarmRatio: lowerBanner.warmRatio,
            scatterPriority
        };
    }

    async function lcstAnalyzeScreenshotForAutoArrange(src, index) {
        // Tahap cepat: cukup muat canvas sekali dan ukur warna/rasio.
        // Detektor dua bulatan yang lebih berat hanya dijalankan pada kandidat Riwayat.
        const base = await getArrangeImageCanvas(src);
        const stats = lcstMeasureScreenshotVisuals(base.sourceCanvas);
        const portrait = stats.aspectRatio <= 0.74;
        const wideOrCombined = stats.aspectRatio >= 0.78;

        let marker = null;
        const possibleHistory = portrait && stats.darkRatio >= 0.24 && stats.warmRatio <= 0.20;
        if (possibleHistory) {
            marker = detectDoubleOrangeMarker(base.sourceCanvas);
        }

        const markerConfidence = marker && Number(marker.confidence)
            ? Number(marker.confidence)
            : 0;
        const hasHistoryMarker = !!marker;

        const historyScore =
            (portrait ? 250 : -310) +
            stats.darkRatio * 330 -
            stats.warmRatio * 250 -
            stats.strongWarmRatio * 170 +
            ((hasHistoryMarker && portrait && stats.darkRatio >= 0.24)
                ? 105 + Math.min(45, markerConfidence * 0.35)
                : 0);

        const winScore =
            (portrait ? 145 : -120) +
            stats.warmRatio * 320 +
            stats.strongWarmRatio * 270 -
            stats.darkRatio * 250 -
            stats.paleRatio * 8;

        const gameScore =
            (wideOrCombined ? 430 : 0) +
            Math.min(1.5, stats.aspectRatio) * 100 +
            stats.paleRatio * 18 +
            stats.scatterPriority * 0.28 +
            stats.boardGamePriority +
            stats.fullGamePriority -
            stats.promoSplashPenalty -
            (portrait && stats.darkRatio >= 0.62 ? 230 : 0) -
            (portrait && stats.warmRatio >= 0.32 && !stats.isPreferredFullGame ? 260 : 0);

        return {
            src,
            index,
            marker,
            hasHistoryMarker,
            markerConfidence,
            portrait,
            wideOrCombined,
            historyScore,
            winScore,
            gameScore,
            ...stats
        };
    }

    async function lcstAnalyzeScreenshotsForAutoArrange(images, onProgress) {
        const list = Array.isArray(images) ? images.slice() : [];
        const results = new Array(list.length);
        let cursor = 0;
        let completed = 0;

        const runner = async () => {
            while (cursor < list.length) {
                const index = cursor++;
                try {
                    results[index] = await lcstAnalyzeScreenshotForAutoArrange(list[index], index);
                } catch (err) {
                    results[index] = {
                        src: list[index], index, marker: null, hasHistoryMarker: false,
                        markerConfidence: 0, portrait: false, wideOrCombined: false,
                        historyScore: -999, winScore: -999, gameScore: -999,
                        aspectRatio: 1, visualFingerprint: '', warmRatio: 0, strongWarmRatio: 0,
                        darkRatio: 0, paleRatio: 0,
                        scatterClusterCount: 0, scatterLargestArea: 0,
                        scatterArea: 0, scatterWarmRatio: 0,
                        isBoardGameCandidate: false, isPreferredFullGame: false, isPromoSplash: false,
                        promoSplashPenalty: 0, boardGamePriority: -1850, fullGamePriority: 0,
                        topBarWarmRatio: 0, boardCenterPaleRatio: 0, boardCenterWarmRatio: 0,
                        lowerBannerWarmRatio: 0, scatterPriority: 0,
                        error: err && err.message ? err.message : String(err)
                    };
                }
                completed++;
                if (typeof onProgress === 'function') onProgress(completed, list.length);
            }
        };

        // Muat dan ukur maksimal empat gambar bersamaan. Deteksi berat tetap hanya
        // berjalan pada kandidat Riwayat, sehingga auto-susun lebih cepat tanpa membebani semua gambar.
        const workers = [];
        const autoArrangeLimit = LCST_CPU_THREADS >= 4 ? 6 : 3;
        const concurrency = Math.min(autoArrangeLimit, Math.max(1, list.length));
        for (let i = 0; i < concurrency; i++) workers.push(runner());
        await Promise.all(workers);
        return results;
    }

    function lcstPickHighest(items, scoreKey, excluded) {
        const blocked = excluded || new Set();
        return items
            .filter((item) => item && !blocked.has(item.index))
            .slice()
            .sort((a, b) =>
                (Number(b[scoreKey]) || -999) - (Number(a[scoreKey]) || -999) ||
                a.index - b.index
            )[0] || null;
    }

    function lcstArrangeSingleThreeImagePackage(packageImages, packageAnalyses) {
        const images = Array.isArray(packageImages) ? packageImages.slice(0, 3) : [];
        const items = images.map((src, localIndex) => {
            const item = packageAnalyses && packageAnalyses[localIndex]
                ? packageAnalyses[localIndex]
                : null;
            return item || {
                src,
                index: localIndex,
                portrait: false,
                wideOrCombined: false,
                aspectRatio: 1,
                warmRatio: 0,
                strongWarmRatio: 0,
                darkRatio: 0,
                paleRatio: 0,
                historyScore: -999,
                winScore: -999,
                gameScore: -999,
                hasHistoryMarker: false,
                markerConfidence: 0,
                scatterClusterCount: 0,
                scatterPriority: 0,
                isBoardGameCandidate: false,
                isPreferredFullGame: false,
                isPromoSplash: false,
                promoSplashPenalty: 0,
                boardGamePriority: -1850,
                fullGamePriority: 0
            };
        });

        if (images.length !== 3 || items.length !== 3) {
            return { images, changed: false, confident: false, reason: 'incomplete-package' };
        }

        const rankDesc = (list, scoreKey) => list.slice().sort((a, b) =>
            (Number(b[scoreKey]) || -999) - (Number(a[scoreKey]) || -999) ||
            a.index - b.index
        );

        // 1) Tentukan GAME dulu. GAME penuh seperti contoh pertama selalu paling tinggi,
        // lalu fallback ke tampilan papan permainan biasa. Promo/intro mendapat penalti besar.
        const gameRank = items.slice().sort((a, b) =>
            lcstRoleUtility(b, 'game') - lcstRoleUtility(a, 'game') || a.index - b.index
        );
        let game = gameRank[0] || null;

        // 2) Tentukan RIWAYAT dari sisa gambar paling gelap/bermarker.
        const remainingAfterGame = items.filter((item) => !game || item.index !== game.index);
        const historyRank = rankDesc(remainingAfterGame, 'historyScore');
        let history = historyRank.find((item) =>
            item && item.portrait && (
                item.darkRatio >= 0.30 ||
                (item.hasHistoryMarker && item.darkRatio >= 0.24)
            )
        ) || historyRank[0] || null;

        // 3) Sisa terakhir menjadi KEMENANGAN TOTAL; bila perlu ambil skor win tertinggi.
        const remainingAfterHistory = remainingAfterGame.filter((item) => !history || item.index !== history.index);
        const winRank = rankDesc(remainingAfterHistory, 'winScore');
        let win = winRank[0] || null;

        // Pengaman: bila hasil awal tertukar antara Riwayat dan Kemenangan, tukar balik.
        if (history && win) {
            const historyLooksLikeWin = history.darkRatio < 0.26 && (history.warmRatio >= 0.18 || history.strongWarmRatio >= 0.08);
            const winLooksLikeHistory = win.darkRatio >= 0.32 && win.warmRatio <= 0.15;
            if (historyLooksLikeWin && winLooksLikeHistory) {
                const tmp = history;
                history = win;
                win = tmp;
            }
        }

        // Fallback ekstra bila GAME belum terpilih.
        if (!game) {
            const excluded = new Set([
                history ? history.index : -1,
                win ? win.index : -1
            ]);
            game = items.filter((item) => !excluded.has(item.index))
                .sort((a, b) => lcstRoleUtility(b, 'game') - lcstRoleUtility(a, 'game') || a.index - b.index)[0] || null;
        }
        if (!history && game) {
            history = items.find((item) => item.index !== game.index) || null;
        }
        if (!win) {
            win = items.find((item) =>
                item &&
                (!game || item.index !== game.index) &&
                (!history || item.index !== history.index)
            ) || null;
        }

        const orderedItems = [game, history, win].filter(Boolean);
        const used = new Set(orderedItems.map((item) => item.index));
        items.forEach((item) => {
            if (item && !used.has(item.index)) orderedItems.push(item);
        });

        const ordered = orderedItems.slice(0, 3).map((item) => item.src);
        const changed = ordered.some((src, idx) => src !== images[idx]);
        const confident = !!(game && history && win);

        return {
            images: ordered,
            changed,
            confident,
            reason: confident ? 'portrait-three-image-order' : 'deterministic-three-image-order'
        };
    }

    function lcstRoleUtility(item, role) {
        if (!item) return -1000000;

        if (role === 'history') {
            return (Number(item.historyScore) || -999) +
                (Number(item.darkRatio) || 0) * 210 -
                (Number(item.warmRatio) || 0) * 95 -
                (Number(item.scatterClusterCount) || 0) * 30 +
                (item.hasHistoryMarker ? 35 : 0);
        }

        if (role === 'win') {
            return (Number(item.winScore) || -999) +
                (Number(item.warmRatio) || 0) * 155 +
                (Number(item.strongWarmRatio) || 0) * 110 -
                (Number(item.darkRatio) || 0) * 90;
        }

        // Permainan dapat berupa screenshot lebar maupun portrait.
        // Karena jumlah tiap jenis dikunci sama, gambar permainan adalah
        // gambar yang bukan Riwayat paling gelap dan bukan Kemenangan paling hangat.
        return (Number(item.gameScore) || -999) +
            (item.isPreferredFullGame ? 6200 : 0) +
            (item.isBoardGameCandidate ? 1850 : -3600) +
            (item.isPromoSplash ? -9000 : 0) +
            (Number(item.fullGamePriority) || 0) * 0.55 +
            (Number(item.boardGamePriority) || 0) * 0.35 +
            (item.wideOrCombined ? 120 : 0) +
            (Number(item.paleRatio) || 0) * 45 +
            (Number(item.scatterClusterCount) || 0) * 65 -
            Math.max(0, (Number(item.warmRatio) || 0) - 0.38) * 680 -
            Math.max(0, (Number(item.darkRatio) || 0) - 0.72) * 170;
    }

    function lcstAssignScreenshotRolesGlobally(items, rows) {
        const list = Array.isArray(items) ? items : [];
        const target = Math.max(1, Number(rows) || 1);
        if (list.length !== target * 3) return null;

        // Dynamic programming: tepat target Permainan, Riwayat, dan Kemenangan.
        // V6.4.1 menambahkan constraint identitas visual untuk WIN bila alternatif tersedia.
        const enforceDistinctWins = lcstCanEnforceDistinctWins(list, target);
        let states = new Map();
        const initial = { score: 0, roles: [], winKeys: [], g: 0, h: 0, w: 0 };
        states.set(lcstRoleStateMapKey(0, 0, 0, [], enforceDistinctWins), initial);

        list.forEach((item, itemIndex) => {
            const next = new Map();
            const keepBest = (candidate) => {
                const key = lcstRoleStateMapKey(candidate.g, candidate.h, candidate.w, candidate.winKeys, enforceDistinctWins);
                const old = next.get(key);
                if (!old || candidate.score > old.score) next.set(key, candidate);
            };

            states.forEach((state) => {
                ['game', 'history', 'win'].forEach((role) => {
                    let ng = state.g, nh = state.h, nw = state.w;
                    if (role === 'game') ng++;
                    if (role === 'history') nh++;
                    if (role === 'win') nw++;
                    if (ng > target || nh > target || nw > target) return;

                    const remaining = list.length - itemIndex - 1;
                    if (ng + remaining < target || nh + remaining < target || nw + remaining < target) return;

                    let winKeys = state.winKeys.slice();
                    if (role === 'win' && enforceDistinctWins) {
                        const winKey = lcstDistinctImageKey(item);
                        if (winKey && winKeys.includes(winKey)) return;
                        if (winKey) winKeys.push(winKey);
                    }

                    keepBest({
                        score: state.score + lcstRoleUtility(item, role),
                        roles: state.roles.concat(role),
                        winKeys, g: ng, h: nh, w: nw
                    });
                });
            });

            states = next;
        });

        const finalState = lcstPickBestCompleteRoleState(states, target);
        if (!finalState) return null;

        return list.map((item, index) => ({
            ...item,
            assignedRole: finalState.roles[index]
        }));
    }

    /* =========================================================
       KOREKSI KHUSUS GAMBAR — MAKSIMAL 6
       3 gambar  : Scatter/Permainan -> Riwayat -> Kemenangan Total
       6 gambar  : 2 paket dengan urutan yang sama
       >6 gambar : analisa buffer kandidat, pilih tepat 6 terbaik; WIN paket 1/2 dibuat berbeda bila tersedia
       ========================================================= */
    const LCST_MAX_SELECTED_IMAGES = 6;
    const LCST_MAX_SELECTED_PACKAGES = 2;
    // Kumpulkan kandidat ekstra, tetapi dashboard/output akhir tetap 6 gambar.
    const LCST_SCAN_CANDIDATE_LIMIT = 12;

    function lcstDistinctImageKey(item) {
        if (!item) return '';
        const fp = String(item.visualFingerprint || '').trim();
        if (fp) return 'visual:' + fp;
        const src = String(item.src || '').trim();
        if (!src) return 'index:' + String(item.index == null ? '' : item.index);
        // Bila fingerprint gagal dibuat, hilangkan query/hash CDN agar URL gambar yang sama
        // dengan token berbeda tetap dianggap satu screenshot.
        try {
            const u = new URL(src, location.href);
            return 'url:' + u.origin + u.pathname;
        } catch (e) {
            return 'url:' + src.split('#')[0].split('?')[0];
        }
    }

    function lcstLikelyWinCandidate(item) {
        if (!item) return false;
        return (
            Number(item.warmRatio) >= 0.14 ||
            Number(item.strongWarmRatio) >= 0.07 ||
            Number(item.paleRatio) >= 0.09 ||
            Number(item.winScore) >= 120
        );
    }

    function lcstCanEnforceDistinctWins(items, targetRows) {
        const target = Math.max(1, Number(targetRows) || 1);
        if (target <= 1) return false;
        const keys = new Set();
        (items || []).forEach((item) => {
            if (!lcstLikelyWinCandidate(item)) return;
            const key = lcstDistinctImageKey(item);
            if (key) keys.add(key);
        });
        return keys.size >= target;
    }

    function lcstRoleStateMapKey(g, h, w, winKeys, enforceDistinctWins) {
        return g + '|' + h + '|' + w + '|' +
            (enforceDistinctWins ? (winKeys || []).slice().sort().join(',') : '');
    }

    function lcstPickBestCompleteRoleState(states, target) {
        let best = null;
        (states || new Map()).forEach((state) => {
            if (!state || state.g !== target || state.h !== target || state.w !== target) return;
            if (!best || state.score > best.score) best = state;
        });
        return best;
    }

    function lcstAssignScreenshotRolesWithLimit(items, targetRows) {
        const list = Array.isArray(items) ? items : [];
        const target = Math.max(1, Number(targetRows) || 1);
        if (list.length < target * 3) return null;

        // Bila tersedia >=2 screenshot Kemenangan Total yang benar-benar berbeda,
        // DP dilarang memilih fingerprint yang sama untuk role WIN dua kali.
        const enforceDistinctWins = lcstCanEnforceDistinctWins(list, target);
        let states = new Map();
        const initial = { score: 0, roles: [], winKeys: [], g: 0, h: 0, w: 0 };
        states.set(lcstRoleStateMapKey(0, 0, 0, [], enforceDistinctWins), initial);

        list.forEach((item, itemIndex) => {
            const next = new Map();
            const keepBest = (candidate) => {
                const key = lcstRoleStateMapKey(candidate.g, candidate.h, candidate.w, candidate.winKeys, enforceDistinctWins);
                const old = next.get(key);
                if (!old || candidate.score > old.score) next.set(key, candidate);
            };

            states.forEach((state) => {
                const g = state.g, h = state.h, w = state.w;
                const remaining = list.length - itemIndex - 1;

                // Boleh abaikan screenshot. Jadi meski ada 7/8/9/12 gambar, hasil akhir tetap 6.
                if (g + remaining >= target && h + remaining >= target && w + remaining >= target) {
                    keepBest({
                        score: state.score, roles: state.roles.concat(null),
                        winKeys: state.winKeys.slice(), g, h, w
                    });
                }

                ['game', 'history', 'win'].forEach((role) => {
                    let ng = g, nh = h, nw = w;
                    if (role === 'game') ng++;
                    if (role === 'history') nh++;
                    if (role === 'win') nw++;
                    if (ng > target || nh > target || nw > target) return;
                    if (ng + remaining < target || nh + remaining < target || nw + remaining < target) return;

                    let winKeys = state.winKeys.slice();
                    if (role === 'win' && enforceDistinctWins) {
                        const winKey = lcstDistinctImageKey(item);
                        if (winKey && winKeys.includes(winKey)) return;
                        if (winKey) winKeys.push(winKey);
                    }

                    keepBest({
                        score: state.score + lcstRoleUtility(item, role),
                        roles: state.roles.concat(role),
                        winKeys, g: ng, h: nh, w: nw
                    });
                });
            });
            states = next;
        });

        const finalState = lcstPickBestCompleteRoleState(states, target);
        if (!finalState) return null;
        return list.map((item, index) => ({ ...item, assignedRole: finalState.roles[index] || null }));
    }

    function lcstAnalysisItem(src, index, analysis) {
        const a = analysis || {};
        return {
            src, index,
            marker: a.marker || null,
            hasHistoryMarker: !!a.hasHistoryMarker,
            markerConfidence: Number(a.markerConfidence) || 0,
            portrait: !!a.portrait,
            wideOrCombined: !!a.wideOrCombined,
            aspectRatio: Number(a.aspectRatio) || 1,
            visualFingerprint: String(a.visualFingerprint || ''),
            warmRatio: Number(a.warmRatio) || 0,
            strongWarmRatio: Number(a.strongWarmRatio) || 0,
            darkRatio: Number(a.darkRatio) || 0,
            paleRatio: Number(a.paleRatio) || 0,
            scatterClusterCount: Number(a.scatterClusterCount) || 0,
            scatterLargestArea: Number(a.scatterLargestArea) || 0,
            scatterArea: Number(a.scatterArea) || 0,
            scatterWarmRatio: Number(a.scatterWarmRatio) || 0,
            isBoardGameCandidate: !!a.isBoardGameCandidate,
            isPreferredFullGame: !!a.isPreferredFullGame,
            isPromoSplash: !!a.isPromoSplash,
            promoSplashPenalty: Number(a.promoSplashPenalty) || 0,
            boardGamePriority: Number(a.boardGamePriority) || 0,
            fullGamePriority: Number(a.fullGamePriority) || 0,
            topBarWarmRatio: Number(a.topBarWarmRatio) || 0,
            boardCenterPaleRatio: Number(a.boardCenterPaleRatio) || 0,
            boardCenterWarmRatio: Number(a.boardCenterWarmRatio) || 0,
            lowerBannerWarmRatio: Number(a.lowerBannerWarmRatio) || 0,
            scatterPriority: Number(a.scatterPriority) || 0,
            historyScore: Number(a.historyScore) || -999,
            winScore: Number(a.winScore) || -999,
            gameScore: Number(a.gameScore) || -999
        };
    }

    function lcstPickNearestUnused(pool, targetIndex, used, preferBefore, usedContentKeys) {
        let best = null;
        let bestScore = Infinity;
        (pool || []).forEach((item) => {
            if (!item || used.has(item.index)) return;
            if (usedContentKeys) {
                const contentKey = lcstDistinctImageKey(item);
                if (contentKey && usedContentKeys.has(contentKey)) return;
            }
            const delta = (Number(item.index) || 0) - (Number(targetIndex) || 0);
            const distance = Math.abs(delta);
            const sidePenalty = preferBefore ? (delta > 0 ? 0.35 : 0) : (delta < 0 ? 0.35 : 0);
            const score = distance + sidePenalty;
            if (score < bestScore) {
                bestScore = score;
                best = item;
            }
        });
        return best;
    }

    function lcstBuildPackagesFromAssigned(assigned, rows) {
        const target = Math.max(1, Number(rows) || 1);
        const selected = (assigned || []).filter((x) => x && x.assignedRole);
        const games = selected.filter((x) => x.assignedRole === 'game').sort((a,b) => a.index - b.index);
        const histories = selected.filter((x) => x.assignedRole === 'history').sort((a,b) => a.index - b.index);
        const wins = selected.filter((x) => x.assignedRole === 'win').sort((a,b) => a.index - b.index);
        if (games.length !== target || histories.length !== target || wins.length !== target) return null;

        const usedGames = new Set();
        const usedWins = new Set();
        const usedWinContentKeys = new Set();
        const enforceDistinctWins = lcstCanEnforceDistinctWins(wins, target);
        const packages = [];
        histories.forEach((history, row) => {
            const game = lcstPickNearestUnused(games, history.index, usedGames, true);
            const win = lcstPickNearestUnused(
                wins, history.index, usedWins, false,
                enforceDistinctWins ? usedWinContentKeys : null
            );
            if (!game || !win) return;
            usedGames.add(game.index);
            usedWins.add(win.index);
            if (enforceDistinctWins) {
                const winKey = lcstDistinctImageKey(win);
                if (winKey) usedWinContentKeys.add(winKey);
            }
            packages.push({ game, history, win, row });
        });
        if (packages.length !== target) return null;

        // V6.3.4: gambar 1 dan 4 wajib mengutamakan GAME PENUH seperti contoh pertama.
        // Jika game penuh tidak ada, baru pakai tampilan papan permainan biasa seperti contoh kedua.
        // Promo/intro tidak boleh mengalahkan screenshot papan permainan.
        packages.sort((a, b) =>
            Number(!!b.game.isPreferredFullGame) - Number(!!a.game.isPreferredFullGame) ||
            Number(!!b.game.isBoardGameCandidate) - Number(!!a.game.isBoardGameCandidate) ||
            Number(!!a.game.isPromoSplash) - Number(!!b.game.isPromoSplash) ||
            (Number(b.game.fullGamePriority) || 0) - (Number(a.game.fullGamePriority) || 0) ||
            (Number(b.game.scatterPriority) || 0) - (Number(a.game.scatterPriority) || 0) ||
            (Number(b.game.scatterClusterCount) || 0) - (Number(a.game.scatterClusterCount) || 0) ||
            a.row - b.row
        );
        return packages;
    }

    function lcstBuildLimitedSixOrder(images, analyses) {
        const list = Array.isArray(images) ? images.slice() : [];
        const raw = Array.isArray(analyses) ? analyses : [];
        if (list.length <= LCST_MAX_SELECTED_IMAGES) return lcstBuildAutoArrangedOrder(list, raw);

        const items = list.map((src, index) => lcstAnalysisItem(src, index, raw[index]));
        const assigned = lcstAssignScreenshotRolesWithLimit(items, LCST_MAX_SELECTED_PACKAGES);
        if (!assigned) {
            return {
                images: list.slice(0, LCST_MAX_SELECTED_IMAGES),
                changed: true, confident: true, visualConfidence: false,
                rows: 2, originalCount: list.length,
                discarded: Math.max(0, list.length - LCST_MAX_SELECTED_IMAGES),
                reason: 'max-six-fallback'
            };
        }

        const packages = lcstBuildPackagesFromAssigned(assigned, LCST_MAX_SELECTED_PACKAGES);
        if (!packages) {
            return {
                images: list.slice(0, LCST_MAX_SELECTED_IMAGES),
                changed: true, confident: true, visualConfidence: false,
                rows: 2, originalCount: list.length,
                discarded: Math.max(0, list.length - LCST_MAX_SELECTED_IMAGES),
                reason: 'max-six-package-fallback'
            };
        }

        const ordered = [];
        packages.forEach((pack) => ordered.push(pack.game.src, pack.history.src, pack.win.src));
        const visualConfidence = packages.every((pack) =>
            (pack.history.darkRatio >= 0.24 || pack.history.hasHistoryMarker) &&
            (pack.win.warmRatio >= 0.14 || pack.win.strongWarmRatio >= 0.07 || pack.win.paleRatio >= 0.09)
        );

        return {
            images: ordered.slice(0, LCST_MAX_SELECTED_IMAGES),
            changed: true, confident: true, visualConfidence,
            rows: 2, originalCount: list.length,
            discarded: Math.max(0, list.length - LCST_MAX_SELECTED_IMAGES),
            reason: visualConfidence ? 'max-six-exact-distinct-win' : 'max-six-deterministic-distinct-win'
        };
    }

    function lcstBuildAutoArrangedOrder(images, analyses) {
        const list = Array.isArray(images) ? images.slice() : [];
        const packageSize = getPackageSizeFromImages(list);
        if (packageSize !== 3 || list.length < 3 || list.length % 3 !== 0) {
            return { images: list, changed: false, confident: false, rows: 0, reason: 'not-three-image-package' };
        }

        if (list.length === 3) {
            const one = lcstArrangeSingleThreeImagePackage(list, Array.isArray(analyses) ? analyses.slice(0, 3) : []);
            return { ...one, confident: one.images.length === 3, rows: 1 };
        }

        const rows = list.length / 3;
        const raw = Array.isArray(analyses) ? analyses : [];
        const items = list.map((src, index) => lcstAnalysisItem(src, index, raw[index]));
        const assigned = lcstAssignScreenshotRolesGlobally(items, rows);
        if (!assigned) {
            return { images: list, changed: false, confident: false, rows, reason: 'global-role-assignment-failed' };
        }

        const packages = lcstBuildPackagesFromAssigned(assigned, rows);
        if (!packages) {
            return { images: list, changed: false, confident: false, rows, reason: 'package-build-failed' };
        }

        const ordered = [];
        packages.forEach((pack) => ordered.push(pack.game.src, pack.history.src, pack.win.src));
        const changed = ordered.some((src, index) => src !== list[index]);
        const visualConfidence = packages.every((pack) =>
            (pack.history.darkRatio >= 0.24 || pack.history.hasHistoryMarker) &&
            (pack.win.warmRatio >= 0.14 || pack.win.strongWarmRatio >= 0.07 || pack.win.paleRatio >= 0.09)
        );
        return {
            images: ordered,
            changed,
            confident: ordered.length === list.length,
            visualConfidence,
            rows,
            reason: visualConfidence ? 'strict-package-order-exact-distinct-win' : 'strict-package-order-deterministic-distinct-win'
        };
    }

    async function lcstFastVerifyExistingThreeOrder(images) {
        const list = Array.isArray(images) ? images.slice() : [];
        if (!(list.length === 3 || list.length === 6)) return null;
        if (getPackageSizeFromImages(list) !== 3) return null;

        const historyIndexes = [];
        for (let base = 0; base < list.length; base += 3) historyIndexes.push(base + 1);

        try {
            // Hanya cek slot RIWAYAT (gambar 2 dan 5). Bila keduanya memang History,
            // tidak ada alasan mengunduh/menganalisa empat gambar lain untuk memindahkan kartu.
            const probes = await Promise.all(historyIndexes.map(async (idx) => {
                const item = await lcstAnalyzeScreenshotForAutoArrange(list[idx], idx);
                const looksHistory = !!(
                    item && item.portrait && !item.isBoardGameCandidate && !item.isPreferredFullGame && (
                        item.hasHistoryMarker ||
                        (item.darkRatio >= 0.30 && item.warmRatio <= 0.23)
                    )
                );
                return { idx, item, looksHistory };
            }));
            if (!probes.every(p => p.looksHistory)) return null;
            return {
                images: list,
                changed: false,
                confident: true,
                visualConfidence: true,
                rows: list.length / 3,
                reason: 'hyper-fast-existing-order-verified'
            };
        } catch (e) {
            return null;
        }
    }

    function prefetchTargetImages(images) {
        const list = images || [];
        if (!list.length) return;
        const packageSize = getPackageSizeFromImages(list);
        const targets = [];
        for (let base = 0; base < list.length; base += packageSize) {
            const idx = packageSize >= 2 ? base + 1 : base;
            if (list[idx]) targets.push(list[idx]);
        }

        // Dibatasi dua sekaligus agar LiveChat tetap ringan saat pengguna menyusun gambar.
        let cursor = 0;
        const runner = async () => {
            while (cursor < targets.length) {
                const src = targets[cursor++];
                try { await getImageAnalysis(src); } catch (e) {}
            }
        };
        const prefetchConcurrency = Math.min(
            targets.length,
            LCST_CPU_THREADS >= 8 ? 4 : (LCST_CPU_THREADS >= 4 ? 3 : 2)
        );
        for (let i = 0; i < prefetchConcurrency; i++) runner();
    }

    function cropCanvas(source, rect) {
        const left = Math.max(0, Math.floor(rect.left));
        const top = Math.max(0, Math.floor(rect.top));
        const right = Math.min(source.width, Math.ceil(rect.left + rect.width));
        const bottom = Math.min(source.height, Math.ceil(rect.top + rect.height));
        const width = Math.max(1, right - left);
        const height = Math.max(1, bottom - top);
        const canvas = createCanvas(width, height);
        canvas.getContext('2d', { willReadFrequently: true }).drawImage(source, left, top, width, height, 0, 0, width, height);
        return canvas;
    }

    function upscaleCanvas(source, scale) {
        const canvas = createCanvas(source.width * scale, source.height * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    function addWhiteBorder(source, border) {
        const canvas = createCanvas(source.width + border * 2, source.height + border * 2);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(source, border, border);
        return canvas;
    }

    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        if (d !== 0) {
            if (max === r) h = 60 * (((g - b) / d) % 6);
            else if (max === g) h = 60 * (((b - r) / d) + 2);
            else h = 60 * (((r - g) / d) + 4);
        }
        if (h < 0) h += 360;
        return { h, s: max === 0 ? 0 : d / max, v: max };
    }

    function isOrangeMarkerPixel(r, g, b, profile) {
        const hsv = rgbToHsv(r, g, b);
        const warm = r > b + 12 && g > b + 5 && r >= 58 && g >= 38;
        if (!warm) return false;

        if (profile === 1) {
            return hsv.h >= 6 && hsv.h <= 78 && hsv.s >= 0.15 && hsv.v >= 0.25 && b <= 185;
        }
        if (profile === 2) {
            return hsv.h >= 10 && hsv.h <= 68 && hsv.s >= 0.20 && hsv.v >= 0.28 && r >= 68 && g >= 42 && b <= 170;
        }
        return hsv.h >= 12 && hsv.h <= 64 && hsv.s >= 0.25 && hsv.v >= 0.31 && r >= 76 && g >= 46 && b <= 160;
    }

    function connectedComponents(mask, width, height, offsetX, offsetY) {
        const seen = new Uint8Array(mask.length);
        const out = [];
        const stack = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const start = y * width + x;
                if (!mask[start] || seen[start]) continue;

                let minX = x, maxX = x, minY = y, maxY = y, area = 0;
                seen[start] = 1;
                stack.length = 0;
                stack.push(start);

                while (stack.length) {
                    const idx = stack.pop();
                    const cx = idx % width;
                    const cy = Math.floor(idx / width);
                    area++;
                    if (cx < minX) minX = cx;
                    if (cx > maxX) maxX = cx;
                    if (cy < minY) minY = cy;
                    if (cy > maxY) maxY = cy;

                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (!dx && !dy) continue;
                            const nx = cx + dx;
                            const ny = cy + dy;
                            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                            const ni = ny * width + nx;
                            if (!mask[ni] || seen[ni]) continue;
                            seen[ni] = 1;
                            stack.push(ni);
                        }
                    }
                }

                out.push({
                    left: minX + offsetX,
                    top: minY + offsetY,
                    right: maxX + 1 + offsetX,
                    bottom: maxY + 1 + offsetY,
                    width: maxX - minX + 1,
                    height: maxY - minY + 1,
                    area
                });
            }
        }
        return out;
    }

    function overlapSize(a1, a2, b1, b2) {
        return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
    }

    function mergeMarkerFragments(components, scaleUnit) {
        const list = components.map(c => ({ ...c }));
        let changed = true;
        let safety = 0;

        while (changed && safety++ < 200) {
            changed = false;
            outer:
            for (let i = 0; i < list.length; i++) {
                for (let j = i + 1; j < list.length; j++) {
                    const a = list[i];
                    const b = list[j];
                    const overlapX = overlapSize(a.left, a.right, b.left, b.right);
                    const overlapY = overlapSize(a.top, a.bottom, b.top, b.bottom);
                    const gapX = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
                    const gapY = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
                    const minW = Math.max(1, Math.min(a.width, b.width));
                    const minH = Math.max(1, Math.min(a.height, b.height));
                    const sameGlyphVertical = gapY <= Math.max(2, 2.2 * scaleUnit) && overlapX / minW >= 0.30;
                    const sameGlyphHorizontal = gapX <= Math.max(1, 1.6 * scaleUnit) && overlapY / minH >= 0.42;

                    if (!sameGlyphVertical && !sameGlyphHorizontal) continue;

                    const merged = {
                        left: Math.min(a.left, b.left),
                        top: Math.min(a.top, b.top),
                        right: Math.max(a.right, b.right),
                        bottom: Math.max(a.bottom, b.bottom),
                        area: a.area + b.area
                    };
                    merged.width = merged.right - merged.left;
                    merged.height = merged.bottom - merged.top;
                    list[i] = merged;
                    list.splice(j, 1);
                    changed = true;
                    break outer;
                }
            }
        }
        return list;
    }

    function markerShapeScore(c, scaleUnit) {
        const aspect = c.width / Math.max(1, c.height);
        const density = c.area / Math.max(1, c.width * c.height);
        const minSize = Math.max(3, 3.5 * scaleUnit);
        const maxSize = Math.max(24, 31 * scaleUnit);
        if (c.width < minSize || c.width > maxSize || c.height < minSize || c.height > maxSize) return -999;
        if (aspect < 0.38 || aspect > 2.30) return -999;
        if (density < 0.055 || density > 0.93) return -999;

        let score = 38;
        score += 24 * (1 - Math.min(1, Math.abs(1 - aspect)));
        score += 18 * (1 - Math.min(1, Math.abs(0.43 - density) / 0.43));
        score += Math.min(20, c.area / Math.max(1, scaleUnit * scaleUnit) * 0.18);
        return score;
    }

    function resizeForMarkerDetection(sourceCanvas) {
        const wantedWidth = Math.max(360, Math.min(540, sourceCanvas.width));
        const scale = wantedWidth / sourceCanvas.width;
        if (Math.abs(scale - 1) < 0.01) return { canvas: sourceCanvas, scale: 1 };

        const canvas = createCanvas(wantedWidth, sourceCanvas.height * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
        return { canvas, scale };
    }

    function mapMarkerToSource(marker, detectionScale) {
        const inv = 1 / detectionScale;
        const mapped = {
            left: marker.left * inv,
            top: marker.top * inv,
            right: marker.right * inv,
            bottom: marker.bottom * inv,
            score: marker.score,
            confidence: marker.confidence,
            source: marker.source || 'pair'
        };
        mapped.width = mapped.right - mapped.left;
        mapped.height = mapped.bottom - mapped.top;
        mapped.centerX = (mapped.left + mapped.right) / 2;
        mapped.centerY = (mapped.top + mapped.bottom) / 2;
        return mapped;
    }

    function lcstGetHistoryLayoutProfile(sourceCanvas, marker) {
        const w = Math.max(1, Number(sourceCanvas && sourceCanvas.width) || 1);
        const h = Math.max(1, Number(sourceCanvas && sourceCanvas.height) || 1);
        const screenRatio = h / w;
        const markerXRatio = marker && Number.isFinite(Number(marker.centerX))
            ? Number(marker.centerX) / w
            : null;

        const compact = screenRatio <= 2.02 || (markerXRatio != null && markerXRatio <= 0.285);
        return compact ? {
            name: 'history-v2-compact',
            compact: true,
            preferredMarkerX: 0.255,
            searchLeft: 0.115,
            searchRight: 0.515,
            transactionLeft: 0.135,
            transactionRight: 0.535,
            betLeft: 0.495,
            betRight: 0.765,
            timeRight: 0.255
        } : {
            name: 'history-v1-classic',
            compact: false,
            preferredMarkerX: 0.305,
            searchLeft: 0.135,
            searchRight: 0.545,
            transactionLeft: 0.155,
            transactionRight: 0.565,
            betLeft: 0.520,
            betRight: 0.785,
            timeRight: 0.295
        };
    }

    function detectDoubleOrangeMarker(sourceCanvas) {
        const normalized = resizeForMarkerDetection(sourceCanvas);
        const canvas = normalized.canvas;
        const detectionScale = normalized.scale;
        const w = canvas.width;
        const h = canvas.height;
        const scaleUnit = w / 360;
        const layout = lcstGetHistoryLayoutProfile(canvas, null);

        // Area pencarian dipersempit ke kolom transaksi. Ini penting pada UI baru
        // karena angka Taruhan/Untung juga berwarna cokelat-oranye.
        const left = Math.max(0, Math.floor(w * layout.searchLeft));
        const right = Math.min(w, Math.ceil(w * layout.searchRight));
        const top = Math.max(0, Math.floor(h * 0.075));
        const bottom = Math.min(h, Math.ceil(h * 0.865));
        const rw = right - left;
        const rh = bottom - top;
        if (rw < 40 || rh < 80) return null;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const image = ctx.getImageData(left, top, rw, rh);
        const allMarkers = [];

        for (let profile = 0; profile < 3; profile++) {
            const mask = new Uint8Array(rw * rh);
            const data = image.data;
            for (let i = 0, p = 0; i < data.length; i += 4, p++) {
                if (isOrangeMarkerPixel(data[i], data[i + 1], data[i + 2], profile)) mask[p] = 1;
            }

            let components = connectedComponents(mask, rw, rh, left, top)
                .filter(c => c.area >= Math.max(3, Math.round(3 * scaleUnit * scaleUnit)) && c.width <= 82 * scaleUnit && c.height <= 42 * scaleUnit);

            components = mergeMarkerFragments(components, scaleUnit)
                .map(c => ({
                    ...c,
                    centerX: (c.left + c.right) / 2,
                    centerY: (c.top + c.bottom) / 2,
                    shapeScore: markerShapeScore(c, scaleUnit)
                }));

            const roundParts = components.filter(c => c.shapeScore > 0);
            for (let i = 0; i < roundParts.length; i++) {
                for (let j = i + 1; j < roundParts.length; j++) {
                    let a = roundParts[i];
                    let b = roundParts[j];
                    if (a.centerX > b.centerX) [a, b] = [b, a];

                    const yDiff = Math.abs(a.centerY - b.centerY);
                    const gap = b.left - a.right;
                    const sizeRatio = Math.min(a.width, b.width) / Math.max(a.width, b.width);
                    const heightRatio = Math.min(a.height, b.height) / Math.max(a.height, b.height);
                    const pairWidth = b.right - a.left;
                    const pairHeight = Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top);
                    const pairAspect = pairWidth / Math.max(1, pairHeight);

                    if (yDiff > Math.max(8 * scaleUnit, (a.height + b.height) * 0.42)) continue;
                    if (gap < Math.max(0.5, 0.4 * scaleUnit) || gap > Math.max(34 * scaleUnit, w * 0.082)) continue;
                    if (sizeRatio < 0.30 || heightRatio < 0.30) continue;
                    if (pairAspect < 1.25 || pairAspect > 5.6) continue;

                    const targetX = (a.centerX + b.centerX) / 2;
                    const targetY = (a.centerY + b.centerY) / 2;
                    const xPreference = Math.max(
                        0,
                        26 - Math.abs(targetX - w * layout.preferredMarkerX) / Math.max(1, w * 0.020)
                    );
                    const closeness = Math.max(0, 29 * scaleUnit - gap) + Math.max(0, 17 * scaleUnit - yDiff * 2);
                    const headerPenalty = targetY < h * 0.165 ? 62 : 0;
                    const footerPenalty = targetY > h * 0.82 ? 42 : 0;
                    const transactionBandBonus = targetX >= w * 0.18 && targetX <= w * 0.39 ? 16 : 0;
                    const score = a.shapeScore + b.shapeScore + closeness + (sizeRatio + heightRatio) * 14 +
                        xPreference + transactionBandBonus - headerPenalty - footerPenalty;

                    const marker = {
                        left: Math.min(a.left, b.left),
                        top: Math.min(a.top, b.top),
                        right: Math.max(a.right, b.right),
                        bottom: Math.max(a.bottom, b.bottom),
                        score,
                        source: layout.compact ? 'component-pair-v2' : 'component-pair-v1',
                        layout: layout.name
                    };
                    marker.width = marker.right - marker.left;
                    marker.height = marker.bottom - marker.top;
                    marker.centerX = (marker.left + marker.right) / 2;
                    marker.centerY = (marker.top + marker.bottom) / 2;
                    marker.confidence = Math.max(58, Math.min(99, Math.round(58 + (score - 112) * 0.25)));
                    allMarkers.push(marker);
                }
            }

            // Fallback aman untuk History baru: kadang kompresi membuat salah satu
            // dari dua icon oranye hilang. Single anchor hanya dipakai jika kandidat
            // pair yang lebih kuat tidak ada, dan hasil OCR tetap harus lolos 9+10 digit.
            roundParts.forEach(c => {
                if (c.centerX < w * 0.18 || c.centerX > w * 0.40) return;
                if (c.centerY < h * 0.17 || c.centerY > h * 0.82) return;
                const xPreference = Math.max(
                    0,
                    18 - Math.abs(c.centerX - w * layout.preferredMarkerX) / Math.max(1, w * 0.024)
                );
                const score = 62 + c.shapeScore + xPreference;
                allMarkers.push({
                    left: c.left,
                    top: c.top,
                    right: c.right,
                    bottom: c.bottom,
                    width: c.width,
                    height: c.height,
                    centerX: c.centerX,
                    centerY: c.centerY,
                    score,
                    confidence: Math.max(50, Math.min(79, Math.round(48 + score * 0.19))),
                    source: 'single-orange-anchor',
                    layout: layout.name
                });
            });

            // Fallback untuk dua lingkaran yang menyatu akibat kompresi/resizing.
            components.forEach(c => {
                const aspect = c.width / Math.max(1, c.height);
                const density = c.area / Math.max(1, c.width * c.height);
                const minWide = 13 * scaleUnit;
                const maxWide = 72 * scaleUnit;
                const minHigh = 5 * scaleUnit;
                const maxHigh = 34 * scaleUnit;
                const centerX = (c.left + c.right) / 2;
                const centerY = (c.top + c.bottom) / 2;
                if (c.width < minWide || c.width > maxWide || c.height < minHigh || c.height > maxHigh) return;
                if (aspect < 1.35 || aspect > 5.5 || density < 0.045 || density > 0.78) return;
                if (centerX < w * 0.18 || centerX > w * 0.42) return;
                if (centerY < h * 0.17 || centerY > h * 0.82) return;

                const limitedRight = Math.min(c.right, c.left + c.height * 3.8);
                const score = 106 + Math.min(34, aspect * 7) + Math.min(20, c.area / Math.max(1, scaleUnit * scaleUnit) * 0.08);
                const marker = {
                    left: c.left,
                    top: c.top,
                    right: limitedRight,
                    bottom: c.bottom,
                    width: limitedRight - c.left,
                    height: c.height,
                    centerX: (c.left + limitedRight) / 2,
                    centerY,
                    score,
                    confidence: Math.max(55, Math.min(91, Math.round(58 + score * 0.18))),
                    source: 'merged-orange-band',
                    layout: layout.name
                };
                allMarkers.push(marker);
            });
        }

        if (!allMarkers.length) return null;

        // Deduplikasi kandidat dari tiga profil warna.
        const unique = [];
        allMarkers.sort((a, b) => b.score - a.score);
        allMarkers.forEach(m => {
            const duplicate = unique.some(u => Math.abs(u.centerX - m.centerX) < 8 * scaleUnit && Math.abs(u.centerY - m.centerY) < 7 * scaleUnit);
            if (!duplicate) unique.push(m);
        });

        // Pair selalu diprioritaskan. Single anchor hanya menjadi fallback.
        unique.sort((a, b) => {
            const bonus = (m) => {
                if (/component-pair/.test(m.source || '')) return 34;
                if (m.source === 'merged-orange-band') return 12;
                return 0;
            };
            return (b.score + bonus(b)) - (a.score + bonus(a));
        });

        const mapped = mapMarkerToSource(unique[0], detectionScale);
        mapped.layout = unique[0].layout || layout.name;
        return mapped;
    }

    function buildTransactionCropRects(sourceCanvas, marker) {
        const w = sourceCanvas.width;
        const h = sourceCanvas.height;
        const layout = lcstGetHistoryLayoutProfile(sourceCanvas, marker);
        const markerH = Math.max(marker.height, w * 0.016, h * 0.009);
        const codeBottom = Math.max(0, marker.top - Math.max(1, markerH * 0.10));
        const codeHeight = Math.max(
            markerH * (layout.compact ? 3.55 : 3.35),
            h * (layout.compact ? 0.058 : 0.052),
            w * 0.082
        );
        const tightTop = Math.max(0, codeBottom - codeHeight);
        const tightLeft = Math.max(
            Math.floor(w * layout.transactionLeft),
            Math.floor(marker.left - w * (layout.compact ? 0.050 : 0.042))
        );
        const tightRight = Math.min(
            Math.ceil(w * layout.transactionRight),
            Math.ceil(marker.right + w * (layout.compact ? 0.170 : 0.190))
        );

        const variants = [
            {
                left: tightLeft,
                top: tightTop,
                width: tightRight - tightLeft,
                height: codeBottom - tightTop,
                name: layout.compact ? 'tight-v2' : 'tight-v1'
            },
            {
                left: Math.max(0, tightLeft - w * 0.028),
                top: Math.max(0, tightTop - h * 0.010),
                width: Math.min(w, tightRight + w * 0.040) - Math.max(0, tightLeft - w * 0.028),
                height: Math.min(h, codeBottom + h * 0.004) - Math.max(0, tightTop - h * 0.010),
                name: layout.compact ? 'wide-v2' : 'wide-v1'
            },
            {
                left: Math.max(0, w * Math.max(0.11, layout.transactionLeft - 0.02)),
                top: Math.max(0, codeBottom - Math.max(codeHeight * 1.24, h * 0.067)),
                width: Math.min(w, w * Math.min(0.59, layout.transactionRight + 0.035)) -
                    Math.max(0, w * Math.max(0.11, layout.transactionLeft - 0.02)),
                height: codeBottom - Math.max(0, codeBottom - Math.max(codeHeight * 1.24, h * 0.067)),
                name: 'fallback-column-dual'
            }
        ];

        return variants.filter(r => r.width >= Math.max(55, w * 0.14) && r.height >= Math.max(20, h * 0.022));
    }


    function buildDirectMarkerCodeWindow(sourceCanvas, marker) {
        if (!sourceCanvas || !marker) return null;

        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const layout = lcstGetHistoryLayoutProfile(sourceCanvas, marker);
        const markerHeight = Math.max(
            8,
            Number(marker.height) || (Number(marker.bottom) - Number(marker.top)) || 0,
            width * 0.011,
            height * 0.0065
        );

        // Dual-layout: kolom Transaksi UI baru sedikit lebih ke kiri.
        // Area tetap berhenti sebelum Taruhan agar Rp/Profit tidak ikut OCR.
        const left = Math.max(
            0,
            Math.floor(width * layout.transactionLeft),
            Math.floor(marker.left - width * (layout.compact ? 0.045 : 0.032))
        );
        const right = Math.min(
            width,
            Math.ceil(width * layout.transactionRight),
            Math.ceil(marker.right + width * (layout.compact ? 0.135 : 0.125))
        );

        // Ambil dua baris angka transaksi tepat di atas marker.
        const top = Math.max(
            0,
            Math.floor(
                marker.top -
                Math.max(markerHeight * (layout.compact ? 2.35 : 2.25), height * 0.036)
            )
        );
        const bottom = Math.max(
            top + 8,
            Math.floor(
                marker.top -
                Math.max(markerHeight * 0.10, height * 0.0015)
            )
        );

        if (right - left < Math.max(68, width * 0.12)) return null;
        if (bottom - top < Math.max(18, height * 0.013)) return null;

        return cropCanvas(sourceCanvas, {
            left,
            top,
            width: right - left,
            height: bottom - top,
            name: layout.compact ? 'direct-marker-code-window-v2' : 'direct-marker-code-window-v1'
        });
    }

    function buildBetOddsCropCanvas(sourceCanvas, marker) {
        if (!sourceCanvas || !marker) return null;

        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const layout = lcstGetHistoryLayoutProfile(sourceCanvas, marker);
        const markerHeight = Math.max(
            8,
            Number(marker.height) || (Number(marker.bottom) - Number(marker.top)) || 0,
            width * 0.011,
            height * 0.0065
        );

        // UI baru menambahkan prefix "Rp" dan kolom Taruhan sedikit melebar.
        // Crop dimulai lebih ke kiri agar angka seperti Rp3,60 tidak terpotong.
        const left = Math.max(
            0,
            Math.floor(width * layout.betLeft),
            Math.floor(marker.right + width * (layout.compact ? 0.105 : 0.115))
        );
        const right = Math.min(
            width,
            Math.ceil(width * layout.betRight),
            Math.ceil(marker.right + width * (layout.compact ? 0.420 : 0.405))
        );
        const top = Math.max(
            0,
            Math.floor(marker.top - Math.max(markerHeight * 2.35, height * 0.036))
        );
        const bottom = Math.max(
            top + 8,
            Math.floor(marker.top - Math.max(markerHeight * 0.10, height * 0.0015))
        );

        if (right - left < Math.max(48, width * 0.085)) return null;
        if (bottom - top < Math.max(15, height * 0.012)) return null;

        return cropCanvas(sourceCanvas, {
            left,
            top,
            width: right - left,
            height: bottom - top,
            name: layout.compact ? 'bet-odds-window-v2' : 'bet-odds-window-v1'
        });
    }

    function parseBetOddsDigits(value) {
        const digits = onlyDigits(value);
        if (!digits || digits.length > 4) return null;

        let odds;
        if (digits.length === 1) odds = Number(digits);
        else if (digits.length === 2) odds = Number(digits) / 10;
        else odds = Number(digits) / 100;

        if (!Number.isFinite(odds) || odds < 1 || odds > 99.99) return null;
        return Math.round(odds * 100) / 100;
    }

    function parseBetOddsRecognition(result) {
        const data = result && result.data ? result.data : {};
        const candidates = [];

        const addCandidate = (raw, confidence, x) => {
            const value = parseBetOddsDigits(raw);
            if (value == null) return;
            candidates.push({
                value,
                confidence: Number(confidence) || Number(data.confidence) || 0,
                x: Number.isFinite(Number(x)) ? Number(x) : 999999
            });
        };

        const words = Array.isArray(data.words) ? data.words : [];
        words.forEach((word, index) => {
            const matches = String(word && word.text || '').match(/\d+/g) || [];
            matches.forEach(part => addCandidate(
                part,
                word && word.confidence,
                word && word.bbox ? word.bbox.x0 : index * 1000
            ));
        });

        if (!candidates.length) {
            String(data.text || '').split(/\r?\n/).forEach((line, index) => {
                const parts = String(line).match(/\d+/g) || [];
                parts.forEach((part, partIndex) => addCandidate(part, data.confidence, index * 1000 + partIndex));
            });
        }

        candidates.sort((a, b) => (a.x - b.x) || (b.confidence - a.confidence));
        return candidates[0] || null;
    }

    async function readBetOddsForNotification(sourceCanvas, marker, worker) {
        const crop = buildBetOddsCropCanvas(sourceCanvas, marker);
        if (!crop) return { value: null, belowMin: false };

        const runPass = async (mode) => {
            const prepared = renderPreparedVariant(crop, mode, false);
            const result = await recognizePrepared(worker, prepared, 6);
            return parseBetOddsRecognition(result);
        };

        let first = null;
        try { first = await runPass('soft'); } catch (e) {}
        if (!first) {
            try { first = await runPass('otsu'); } catch (e) {}
        }
        if (!first) return { value: null, belowMin: false };

        if (first.value >= LCST_MIN_BET_ODDS) {
            return { value: first.value, belowMin: false };
        }

        // Nilai di bawah 1,60 diverifikasi sekali agar notifikasi tidak salah.
        try {
            const second = await runPass('strong');
            if (second && Math.abs(second.value - first.value) < 0.011) {
                return { value: first.value, belowMin: true };
            }
            if (second && second.value >= LCST_MIN_BET_ODDS) {
                return { value: second.value, belowMin: false };
            }
        } catch (e) {}

        return {
            value: first.value,
            belowMin: (first.confidence || 0) >= 68
        };
    }


    function buildClaimTimestampCropCanvases(sourceCanvas, marker) {
        if (!sourceCanvas || !marker) return [];
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const layout = lcstGetHistoryLayoutProfile(sourceCanvas, marker);
        const markerHeight = Math.max(
            8,
            Number(marker.height) || (Number(marker.bottom) - Number(marker.top)) || 0,
            width * 0.011,
            height * 0.0065
        );
        const rowTop = Math.max(
            0,
            Math.floor(marker.top - Math.max(markerHeight * 3.65, height * 0.060))
        );
        const rowBottom = Math.min(
            height,
            Math.ceil(marker.top + Math.max(markerHeight * 0.50, height * 0.009))
        );
        const leftColumnRight = Math.min(
            width,
            Math.max(
                width * layout.timeRight,
                Math.min(width * (layout.compact ? 0.34 : 0.38), marker.left + width * 0.038)
            )
        );
        const variants = [
            {
                name: layout.compact ? 'image-2-row-left-v2' : 'image-2-row-left-v1',
                left: 0,
                top: rowTop,
                width: leftColumnRight,
                height: rowBottom - rowTop
            },
            {
                name: 'image-2-row-wide-dual',
                left: 0,
                top: Math.max(0, rowTop - height * 0.020),
                width: Math.min(width, width * (layout.compact ? 0.54 : 0.58)),
                height: Math.min(height, rowBottom + height * 0.020) - Math.max(0, rowTop - height * 0.020)
            },
            {
                name: 'image-2-history-upper-dual',
                left: 0,
                top: Math.max(0, marker.top - height * (layout.compact ? 0.205 : 0.19)),
                width: Math.min(width, width * 0.62),
                height: Math.min(height * 0.235, marker.top + height * 0.015) -
                    Math.max(0, marker.top - height * (layout.compact ? 0.205 : 0.19))
            },
            {
                name: 'image-2-row-full-dual',
                left: 0,
                top: Math.max(0, rowTop - height * 0.026),
                width,
                height: Math.min(height, rowBottom + height * 0.026) - Math.max(0, rowTop - height * 0.026)
            }
        ];
        return variants
            .filter((rect) => rect.width >= 70 && rect.height >= 20)
            .map((rect) => ({ name: rect.name, canvas: cropCanvas(sourceCanvas, rect) }));
    }

    function buildClaimTimezoneHeaderCropCanvas(sourceCanvas) {
        if (!sourceCanvas) return null;
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        // Header "Waktu (GMT+8)" berada di kiri atas. Crop dibuat cukup lebar
        // untuk UI compact maupun classic, namun tetap kecil agar OCR cepat.
        const rect = {
            left: 0,
            top: 0,
            width: Math.min(width, Math.max(100, width * 0.38)),
            height: Math.min(height, Math.max(55, height * 0.14))
        };
        if (rect.width < 70 || rect.height < 30) return null;
        return cropCanvas(sourceCanvas, rect);
    }

    async function lcstSetTimestampOcrMode(worker) {
        await worker.setParameters({
            tessedit_char_whitelist: LCST_TIMESTAMP_OCR_WHITELIST,
            preserve_interword_spaces: '1',
            classify_bln_numeric_mode: '0'
        });
    }

    async function lcstRestoreNumericOcrMode(worker) {
        try {
            await worker.setParameters({
                tessedit_char_whitelist: LCST_NUMERIC_OCR_WHITELIST,
                preserve_interword_spaces: '1',
                classify_bln_numeric_mode: '1'
            });
        } catch (e) {}
    }

    async function readClaimTimestampFromSecondImage(sourceCanvas, marker, worker, fallbackPeriod, existingText) {
        // V6.4.0: jangan pernah menganggap angka transaksi/periode sebagai tanggal.
        // Timestamp gambar ke-2/5 harus dibaca dari kolom Waktu terlebih dahulu.
        let parsed = null;
        const crops = buildClaimTimestampCropCanvases(sourceCanvas, marker);
        const rawParts = [];
        let sourceGmtOffsetMinutes = LCST_HISTORY_DEFAULT_GMT_OFFSET_MINUTES;
        let timestampModeActive = false;
        try {
            await lcstSetTimestampOcrMode(worker);
            timestampModeActive = true;

            // Baca header timezone satu kali. Bila OCR gagal, WAJIB fallback ke GMT+7.
            // Jangan lagi menganggap GMT+8 karena dapat mengurangi 1 jam dan membuat
            // transaksi tanggal hari ini salah terbaca sebagai tanggal semalam.
            const timezoneCrop = buildClaimTimezoneHeaderCropCanvas(sourceCanvas);
            if (timezoneCrop) {
                for (const headerPass of [{ mode: 'soft', psm: 6 }, { mode: 'otsu', psm: 11 }]) {
                    try {
                        const preparedHeader = renderPreparedVariant(timezoneCrop, headerPass.mode, false);
                        const headerResult = await recognizePrepared(worker, preparedHeader, headerPass.psm);
                        const headerRaw = String(headerResult && headerResult.data && headerResult.data.text || '');
                        rawParts.push('image-2-timezone-header-psm' + headerPass.psm + '\n' + headerRaw);
                        const detectedOffset = lcstParseGmtOffsetMinutes(headerRaw);
                        if (detectedOffset != null) {
                            sourceGmtOffsetMinutes = detectedOffset;
                            break;
                        }
                    } catch (e) {}
                }
            }

            // Baru baca baris target Waktu yang sejajar dengan transaksi marker.
            for (let i = 0; i < crops.length; i++) {
                const item = crops[i];
                const psmList = i === 0 ? [6, 11] : [6];
                for (let p = 0; p < psmList.length; p++) {
                    try {
                        const prepared = renderPreparedVariant(item.canvas, p === 0 ? 'soft' : 'otsu', false);
                        const result = await recognizePrepared(worker, prepared, psmList[p]);
                        const raw = String(result && result.data && result.data.text || '');
                        rawParts.push(item.name + '-psm' + psmList[p] + '\n' + raw);
                        parsed = lcstParseImageTimestampText(raw, fallbackPeriod, null, sourceGmtOffsetMinutes);
                        if (parsed && parsed.hasTime && parsed.source !== 'period-date-fallback') {
                            parsed.source = item.name + '-psm' + psmList[p];
                            parsed.confidence = Number(result && result.data && result.data.confidence) || 0;
                            parsed.sourceGmtOffsetMinutes = sourceGmtOffsetMinutes;
                            parsed.targetGmtOffsetMinutes = LCST_TARGET_GMT_OFFSET_MINUTES;
                            return parsed;
                        }
                    } catch (e) {}
                }
            }
        } finally {
            if (timestampModeActive) await lcstRestoreNumericOcrMode(worker);
        }

        // Gabungkan hasil crop khusus Waktu. Header hanya membantu timezone.
        parsed = lcstParseImageTimestampText(rawParts.join('\n---\n'), fallbackPeriod, null, sourceGmtOffsetMinutes);
        if (parsed && parsed.hasTime && parsed.source !== 'period-date-fallback') return parsed;

        // Hanya bila teks lama memang jelas mengandung JAM + TANGGAL, boleh dijadikan fallback.
        // Ini mencegah kode 9/10 digit transaksi berubah menjadi tanggal palsu.
        if (lcstLooksLikeTimestampText(existingText || '')) {
            parsed = lcstParseImageTimestampText(existingText || '', fallbackPeriod, null, sourceGmtOffsetMinutes);
            if (parsed && parsed.hasTime && parsed.source !== 'period-date-fallback') return parsed;
        }

        // Bila jam tidak terbaca, tanggal periode tetap menjadi fallback terakhir (tanpa manipulasi jam).
        return lcstParseImageTimestampText('', fallbackPeriod, null, sourceGmtOffsetMinutes);
    }

    function exactTenDigitLinesFromRecognition(result) {
        const data = result && result.data ? result.data : {};
        const output = [];
        const seen = new Set();

        const add = (value) => {
            const digits = onlyDigits(value);
            if (!/^\d{10}$/.test(digits) || seen.has(digits)) return;
            seen.add(digits);
            output.push({
                value: digits,
                confidence: Number(data.confidence) || 0
            });
        };

        String(data.text || '')
            .split(/\r?\n/)
            .forEach(add);

        // Jangan mengambil substring sembarang dari gabungan dua baris.
        // Compact hanya dipakai jika keseluruhan hasil tepat 10 digit.
        const compact = onlyDigits(data.text || '');
        if (/^\d{10}$/.test(compact)) add(compact);

        return output;
    }

    function grayscaleInvertedData(source) {
        const ctx = source.getContext('2d', { willReadFrequently: true });
        const img = ctx.getImageData(0, 0, source.width, source.height);
        const gray = new Uint8Array(source.width * source.height);
        const hist = new Uint32Array(256);
        for (let i = 0, p = 0; i < img.data.length; i += 4, p++) {
            const r = img.data[i];
            const g = img.data[i + 1];
            const b = img.data[i + 2];
            // Hapus garis/kotak anotasi merah agar tidak menutup bentuk angka.
            const isRedAnnotation = r >= 145 && r >= g + 58 && r >= b + 58;
            const original = isRedAnnotation
                ? Math.round((g + b) * 0.50)
                : Math.round(r * 0.299 + g * 0.587 + b * 0.114);
            const inv = 255 - original;
            gray[p] = inv;
            hist[inv]++;
        }
        return { gray, hist };
    }

    function percentileFromHist(hist, total, ratio) {
        const target = total * ratio;
        let sum = 0;
        for (let i = 0; i < hist.length; i++) {
            sum += hist[i];
            if (sum >= target) return i;
        }
        return 255;
    }

    function stretchGray(gray, hist) {
        const lo = percentileFromHist(hist, gray.length, 0.015);
        const hi = percentileFromHist(hist, gray.length, 0.985);
        const den = Math.max(1, hi - lo);
        const out = new Uint8Array(gray.length);
        for (let i = 0; i < gray.length; i++) {
            out[i] = Math.max(0, Math.min(255, Math.round((gray[i] - lo) * 255 / den)));
        }
        return out;
    }

    function otsuThreshold(values) {
        const hist = new Uint32Array(256);
        for (const v of values) hist[v]++;
        const total = values.length;
        let sum = 0;
        for (let i = 0; i < 256; i++) sum += i * hist[i];
        let sumB = 0;
        let weightB = 0;
        let maxVariance = -1;
        let threshold = 128;
        for (let t = 0; t < 256; t++) {
            weightB += hist[t];
            if (!weightB) continue;
            const weightF = total - weightB;
            if (!weightF) break;
            sumB += t * hist[t];
            const meanB = sumB / weightB;
            const meanF = (sum - sumB) / weightF;
            const variance = weightB * weightF * (meanB - meanF) * (meanB - meanF);
            if (variance > maxVariance) {
                maxVariance = variance;
                threshold = t;
            }
        }
        return threshold;
    }

    function adaptiveBinary(values, width, height, radius, bias) {
        const integral = new Float64Array((width + 1) * (height + 1));
        for (let y = 1; y <= height; y++) {
            let rowSum = 0;
            for (let x = 1; x <= width; x++) {
                rowSum += values[(y - 1) * width + (x - 1)];
                integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum;
            }
        }

        const out = new Uint8Array(values.length);
        for (let y = 0; y < height; y++) {
            const y0 = Math.max(0, y - radius);
            const y1 = Math.min(height - 1, y + radius);
            for (let x = 0; x < width; x++) {
                const x0 = Math.max(0, x - radius);
                const x1 = Math.min(width - 1, x + radius);
                const A = integral[y0 * (width + 1) + x0];
                const B = integral[y0 * (width + 1) + x1 + 1];
                const C = integral[(y1 + 1) * (width + 1) + x0];
                const D = integral[(y1 + 1) * (width + 1) + x1 + 1];
                const count = (x1 - x0 + 1) * (y1 - y0 + 1);
                const mean = (D - B - C + A) / Math.max(1, count);
                out[y * width + x] = values[y * width + x] < mean - bias ? 0 : 255;
            }
        }
        return out;
    }
    function chooseUpscale(source, lineMode) {
        // 95-110px tinggi baris sudah cukup untuk angka; versi lama 145-255px membebani CPU/RAM.
        const targetHeight = lineMode ? 108 : 188;
        return Math.max(3.2, Math.min(7.5, targetHeight / Math.max(1, source.height)));
    }
    function renderPreparedVariant(source, mode, lineMode) {
        const cacheKey = lineMode ? 'line' : 'combined';
        let cache = lcstPreparedBaseCache.get(source);
        if (!cache) {
            cache = {};
            lcstPreparedBaseCache.set(source, cache);
        }

        let preparedBase = cache[cacheKey];
        if (!preparedBase) {
            const scale = chooseUpscale(source, !!lineMode);
            const base = upscaleCanvas(source, scale);
            const grayData = grayscaleInvertedData(base);
            preparedBase = {
                width: base.width,
                height: base.height,
                stretched: stretchGray(grayData.gray, grayData.hist)
            };
            cache[cacheKey] = preparedBase;
        }

        const width = preparedBase.width;
        const height = preparedBase.height;
        const stretched = preparedBase.stretched;
        let pixels;

        if (mode === 'otsu') {
            const threshold = otsuThreshold(stretched);
            pixels = new Uint8Array(stretched.length);
            for (let i = 0; i < stretched.length; i++) pixels[i] = stretched[i] < threshold ? 0 : 255;
        } else if (mode === 'adaptive') {
            const radius = Math.max(7, Math.round(height * 0.065));
            pixels = adaptiveBinary(stretched, width, height, radius, 8);
        } else if (mode === 'strong') {
            pixels = new Uint8Array(stretched.length);
            for (let i = 0; i < stretched.length; i++) pixels[i] = Math.max(0, Math.min(255, Math.round((stretched[i] - 28) * 1.48)));
        } else {
            pixels = new Uint8Array(stretched.length);
            for (let i = 0; i < stretched.length; i++) pixels[i] = Math.max(0, Math.min(255, Math.round((stretched[i] - 10) * 1.16)));
        }

        const out = createCanvas(width, height);
        const ctx = out.getContext('2d');
        const img = ctx.createImageData(width, height);
        for (let i = 0, p = 0; p < pixels.length; p++, i += 4) {
            const v = pixels[p];
            img.data[i] = v;
            img.data[i + 1] = v;
            img.data[i + 2] = v;
            img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        return addWhiteBorder(out, lineMode ? 20 : 18);
    }

    function smoothArray(values, radius) {
        const out = new Float64Array(values.length);
        for (let i = 0; i < values.length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = Math.max(0, i - radius); j <= Math.min(values.length - 1, i + radius); j++) {
                sum += values[j];
                count++;
            }
            out[i] = sum / Math.max(1, count);
        }
        return out;
    }

    function findTwoLineRects(source) {
        const ctx = source.getContext('2d', { willReadFrequently: true });
        const img = ctx.getImageData(0, 0, source.width, source.height).data;
        const luminance = [];
        for (let i = 0; i < img.length; i += 4) {
            luminance.push(Math.round(img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114));
        }
        const sorted = luminance.slice().sort((a, b) => a - b);
        const background = sorted[Math.floor(sorted.length * 0.48)] || 55;
        const threshold = Math.max(background + 18, sorted[Math.floor(sorted.length * 0.73)] || 85);
        const rowScore = new Float64Array(source.height);

        for (let y = 0; y < source.height; y++) {
            let score = 0;
            for (let x = Math.floor(source.width * 0.04); x < Math.ceil(source.width * 0.96); x++) {
                const p = (y * source.width + x) * 4;
                const r = img[p], g = img[p + 1], b = img[p + 2];
                const lum = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
                const saturationSpread = Math.max(r, g, b) - Math.min(r, g, b);
                if (lum >= threshold && (saturationSpread <= 58 || lum >= 170)) score++;
            }
            rowScore[y] = score;
        }

        const smooth = smoothArray(rowScore, 1);
        const from = Math.max(2, Math.floor(source.height * 0.34));
        const to = Math.min(source.height - 3, Math.ceil(source.height * 0.66));
        let split = Math.round(source.height * 0.50);
        let best = Infinity;
        for (let y = from; y <= to; y++) {
            const centerPenalty = Math.abs(y - source.height * 0.50) * 0.08;
            const value = smooth[y] + centerPenalty;
            if (value < best) {
                best = value;
                split = y;
            }
        }

        const overlap = Math.max(2, Math.round(source.height * 0.075));
        return [
            {
                left: 0,
                top: 0,
                width: source.width,
                height: Math.max(6, Math.min(source.height, split + overlap)),
                name: 'top-line'
            },
            {
                left: 0,
                top: Math.max(0, split - overlap),
                width: source.width,
                height: Math.max(6, source.height - Math.max(0, split - overlap)),
                name: 'bottom-line'
            }
        ];
    }


    function buildDigitGlyphMask(lineCanvas) {
        // Gunakan hasil Otsu yang sama dengan pipeline OCR supaya bentuk digit
        // yang dianalisis identik dengan gambar yang dilihat Tesseract.
        const prepared = renderPreparedVariant(lineCanvas, 'otsu', true);
        const ctx = prepared.getContext('2d', { willReadFrequently: true });
        const image = ctx.getImageData(0, 0, prepared.width, prepared.height);
        const mask = new Uint8Array(prepared.width * prepared.height);

        for (let i = 0, p = 0; i < image.data.length; i += 4, p++) {
            const lum = Math.round(
                image.data[i] * 0.299 +
                image.data[i + 1] * 0.587 +
                image.data[i + 2] * 0.114
            );
            // Digit berwarna hitam, latar putih.
            mask[p] = lum < 128 ? 1 : 0;
        }

        return {
            mask,
            width: prepared.width,
            height: prepared.height
        };
    }

    function findActiveRuns(values, minimumValue, minimumLength) {
        const runs = [];
        let start = -1;

        for (let i = 0; i <= values.length; i++) {
            const active = i < values.length && values[i] >= minimumValue;
            if (active && start < 0) {
                start = i;
            } else if (!active && start >= 0) {
                const end = i;
                if (end - start >= minimumLength) {
                    runs.push({ start, end, length: end - start });
                }
                start = -1;
            }
        }
        return runs;
    }

    function findDigitGlyphBoxes(lineCanvas, expectedCount) {
        const binary = buildDigitGlyphMask(lineCanvas);
        const mask = binary.mask;
        const width = binary.width;
        const height = binary.height;

        // Marker/badge berada di bawah angka. Batasi pencarian pada 74% bagian
        // atas agar ikon bulat tidak pernah dianggap sebagai digit.
        const scanTop = Math.max(0, Math.round(height * 0.04));
        const scanBottom = Math.max(scanTop + 1, Math.round(height * 0.74));
        const rowCounts = new Uint32Array(height);

        for (let y = scanTop; y < scanBottom; y++) {
            let count = 0;
            for (let x = 0; x < width; x++) {
                if (mask[y * width + x]) count++;
            }
            rowCounts[y] = count;
        }

        let maxRowCount = 0;
        for (let y = scanTop; y < scanBottom; y++) {
            if (rowCounts[y] > maxRowCount) maxRowCount = rowCounts[y];
        }
        if (!maxRowCount) return null;

        const rowThreshold = Math.max(2, Math.round(maxRowCount * 0.10));
        const rowRuns = findActiveRuns(
            Array.from(rowCounts.slice(scanTop, scanBottom)),
            rowThreshold,
            Math.max(3, Math.round(height * 0.035))
        ).map(run => ({
            start: run.start + scanTop,
            end: run.end + scanTop,
            length: run.length
        }));

        if (!rowRuns.length) return null;

        // Pilih pita horizontal dengan jumlah piksel terbesar. Ini mengunci
        // analisis ke satu baris angka, bukan ke badge di bawahnya.
        let bestBand = null;
        let bestBandScore = -1;
        rowRuns.forEach(run => {
            let ink = 0;
            for (let y = run.start; y < run.end; y++) ink += rowCounts[y];
            const centerY = (run.start + run.end) / 2;
            const upperBonus = centerY < height * 0.58 ? 1.16 : 0.82;
            const score = ink * upperBonus;
            if (score > bestBandScore) {
                bestBandScore = score;
                bestBand = run;
            }
        });
        if (!bestBand) return null;

        const padY = Math.max(1, Math.round(height * 0.018));
        const bandTop = Math.max(0, bestBand.start - padY);
        const bandBottom = Math.min(height, bestBand.end + padY);
        const bandHeight = Math.max(1, bandBottom - bandTop);

        // Prioritas pertama: connected component. Pada font PG, setiap digit
        // merupakan satu komponen sehingga pembagian 10 digit sangat presisi.
        const bandMask = new Uint8Array(width * bandHeight);
        for (let y = 0; y < bandHeight; y++) {
            const sourceStart = (bandTop + y) * width;
            bandMask.set(mask.subarray(sourceStart, sourceStart + width), y * width);
        }

        let components = connectedComponents(bandMask, width, bandHeight, 0, bandTop)
            .filter(c => {
                const relativeHeight = c.height / Math.max(1, bandHeight);
                const relativeWidth = c.width / Math.max(1, width);
                return (
                    c.area >= Math.max(12, Math.round(bandHeight * 0.55)) &&
                    relativeHeight >= 0.48 &&
                    relativeWidth >= 0.006 &&
                    relativeWidth <= 0.14
                );
            })
            .sort((a, b) => a.left - b.left);

        if (components.length === expectedCount) {
            return { mask, width, height, boxes: components, method: 'components' };
        }

        // Fallback proyeksi vertikal untuk screenshot yang sangat kecil atau
        // anti-aliasing-nya memecah satu digit menjadi beberapa komponen.
        const colCounts = new Uint32Array(width);
        for (let x = 0; x < width; x++) {
            let count = 0;
            for (let y = bandTop; y < bandBottom; y++) {
                if (mask[y * width + x]) count++;
            }
            colCounts[x] = count;
        }

        let maxColCount = 0;
        for (const count of colCounts) {
            if (count > maxColCount) maxColCount = count;
        }
        const colThreshold = Math.max(1, Math.round(maxColCount * 0.055));
        let colRuns = findActiveRuns(
            Array.from(colCounts),
            colThreshold,
            Math.max(2, Math.round(width * 0.004))
        );

        // Buang noise sempit, lalu pertahankan urutan kiri ke kanan.
        colRuns = colRuns
            .filter(run => run.length >= Math.max(2, Math.round(width * 0.006)))
            .sort((a, b) => a.start - b.start);

        if (colRuns.length === expectedCount) {
            return {
                mask,
                width,
                height,
                method: 'projection',
                boxes: colRuns.map(run => ({
                    left: run.start,
                    right: run.end,
                    top: bandTop,
                    bottom: bandBottom,
                    width: run.end - run.start,
                    height: bandHeight
                }))
            };
        }

        // Fallback terakhir: gunakan pitch tetap di antara piksel digit pertama
        // dan terakhir. Metode ini aman karena panjang baris selalu 10 digit.
        const activeColumns = [];
        for (let x = 0; x < width; x++) {
            if (colCounts[x] >= Math.max(1, Math.round(maxColCount * 0.025))) {
                activeColumns.push(x);
            }
        }
        if (!activeColumns.length) return null;

        const left = activeColumns[0];
        const right = activeColumns[activeColumns.length - 1] + 1;
        const totalWidth = right - left;
        if (totalWidth < expectedCount * 3) return null;

        const pitch = totalWidth / expectedCount;
        const boxes = [];
        for (let i = 0; i < expectedCount; i++) {
            const slotLeft = Math.max(0, Math.floor(left + i * pitch - pitch * 0.08));
            const slotRight = Math.min(width, Math.ceil(left + (i + 1) * pitch + pitch * 0.08));
            boxes.push({
                left: slotLeft,
                right: slotRight,
                top: bandTop,
                bottom: bandBottom,
                width: slotRight - slotLeft,
                height: bandHeight
            });
        }

        return { mask, width, height, boxes, method: 'equal-pitch' };
    }


    function detectTightDigitRowRect(preparedCanvas, expectedCount) {
        const ctx = preparedCanvas.getContext('2d', { willReadFrequently: true });
        const image = ctx.getImageData(0, 0, preparedCanvas.width, preparedCanvas.height);
        const width = preparedCanvas.width;
        const height = preparedCanvas.height;
        const mask = new Uint8Array(width * height);

        for (let i = 0, p = 0; i < image.data.length; i += 4, p++) {
            const lum = Math.round(
                image.data[i] * 0.299 +
                image.data[i + 1] * 0.587 +
                image.data[i + 2] * 0.114
            );
            mask[p] = lum < 178 ? 1 : 0;
        }

        const borderX = Math.max(2, Math.round(width * 0.025));
        const borderY = Math.max(2, Math.round(height * 0.035));
        const rowCounts = new Uint32Array(height);

        for (let y = borderY; y < height - borderY; y++) {
            let count = 0;
            for (let x = borderX; x < width - borderX; x++) {
                if (mask[y * width + x]) count++;
            }
            rowCounts[y] = count;
        }

        let maxRow = 0;
        for (let y = borderY; y < height - borderY; y++) {
            if (rowCounts[y] > maxRow) maxRow = rowCounts[y];
        }
        if (!maxRow) return null;

        const threshold = Math.max(2, Math.round(maxRow * 0.085));
        const runs = findActiveRuns(
            Array.from(rowCounts),
            threshold,
            Math.max(3, Math.round(height * 0.025))
        );

        let best = null;
        let bestScore = -Infinity;

        for (const run of runs) {
            const runTop = Math.max(borderY, run.start);
            const runBottom = Math.min(height - borderY, run.end);
            if (runBottom <= runTop) continue;

            const colCounts = new Uint32Array(width);
            let totalInk = 0;
            for (let x = borderX; x < width - borderX; x++) {
                let count = 0;
                for (let y = runTop; y < runBottom; y++) {
                    if (mask[y * width + x]) count++;
                }
                colCounts[x] = count;
                totalInk += count;
            }

            let left = -1;
            let right = -1;
            const minColInk = Math.max(1, Math.round((runBottom - runTop) * 0.08));
            for (let x = borderX; x < width - borderX; x++) {
                if (colCounts[x] >= minColInk) {
                    if (left < 0) left = x;
                    right = x + 1;
                }
            }
            if (left < 0 || right <= left) continue;

            const span = right - left;
            const centerY = (runTop + runBottom) / 2;
            const spanRatio = span / Math.max(1, width);
            const heightRatio = (runBottom - runTop) / Math.max(1, height);

            // Baris 10 digit harus cukup lebar. Badge dua bulat berada lebih
            // bawah dan umumnya memiliki span lebih pendek.
            if (spanRatio < 0.23 || heightRatio < 0.05) continue;

            const preferredY = height * 0.44;
            const yPenalty = Math.abs(centerY - preferredY) * 0.22;
            const lowerPenalty = centerY > height * 0.76 ? 120 : 0;
            const expectedWidthBonus = Math.min(120, spanRatio * 170);
            const score =
                totalInk * 0.42 +
                span * 1.55 +
                expectedWidthBonus -
                yPenalty -
                lowerPenalty;

            if (score > bestScore) {
                bestScore = score;
                best = {
                    left,
                    top: runTop,
                    right,
                    bottom: runBottom
                };
            }
        }

        if (!best) return null;

        const padX = Math.max(5, Math.round((best.right - best.left) * 0.035));
        const padY = Math.max(4, Math.round((best.bottom - best.top) * 0.28));

        return {
            left: Math.max(0, best.left - padX),
            top: Math.max(0, best.top - padY),
            width: Math.min(width, best.right + padX) - Math.max(0, best.left - padX),
            height: Math.min(height, best.bottom + padY) - Math.max(0, best.top - padY)
        };
    }

    function buildTightBottomRowVariants(bottomLine) {
        const variants = [];
        const seenRects = new Set();

        // Jalur utama: manfaatkan segmentasi 10 glyph.
        const glyphInfo = findDigitGlyphBoxes(bottomLine, LCST_EXPECTED_BOTTOM_LENGTH);
        if (glyphInfo && glyphInfo.boxes && glyphInfo.boxes.length === LCST_EXPECTED_BOTTOM_LENGTH) {
            const minLeft = Math.min(...glyphInfo.boxes.map(b => b.left));
            const minTop = Math.min(...glyphInfo.boxes.map(b => b.top));
            const maxRight = Math.max(...glyphInfo.boxes.map(b => b.right));
            const maxBottom = Math.max(...glyphInfo.boxes.map(b => b.bottom));
            const padX = Math.max(6, Math.round((maxRight - minLeft) * 0.035));
            const padY = Math.max(5, Math.round((maxBottom - minTop) * 0.30));

            const rect = {
                left: Math.max(0, minLeft - padX),
                top: Math.max(0, minTop - padY),
                width: Math.min(glyphInfo.width, maxRight + padX) - Math.max(0, minLeft - padX),
                height: Math.min(glyphInfo.height, maxBottom + padY) - Math.max(0, minTop - padY)
            };

            ['soft', 'otsu', 'adaptive'].forEach(mode => {
                const prepared = renderPreparedVariant(bottomLine, mode, true);
                const key = [
                    Math.round(rect.left),
                    Math.round(rect.top),
                    Math.round(rect.width),
                    Math.round(rect.height),
                    mode
                ].join(':');
                if (seenRects.has(key)) return;
                seenRects.add(key);

                variants.push({
                    canvas: addWhiteBorder(cropCanvas(prepared, rect), 14),
                    mode,
                    source: 'glyph-boxes'
                });
            });
        }

        // Fallback: proyeksi tinta pada hasil preprocessing.
        if (!variants.length) {
            const otsu = renderPreparedVariant(bottomLine, 'otsu', true);
            const projectedRect = detectTightDigitRowRect(otsu, LCST_EXPECTED_BOTTOM_LENGTH);
            if (projectedRect) {
                ['soft', 'otsu', 'adaptive'].forEach(mode => {
                    const prepared = renderPreparedVariant(bottomLine, mode, true);
                    variants.push({
                        canvas: addWhiteBorder(cropCanvas(prepared, projectedRect), 14),
                        mode,
                        source: 'row-projection'
                    });
                });
            }
        }

        return variants;
    }

    function exactBottomValueFromRecognition(result) {
        const data = result && result.data ? result.data : {};
        const values = [];
        const lines = String(data.text || '')
            .split(/\r?\n/)
            .map(onlyDigits)
            .filter(Boolean);

        lines.forEach(line => {
            if (/^\d{10}$/.test(line)) values.push(line);
        });

        const compact = onlyDigits(data.text || '');
        if (/^\d{10}$/.test(compact)) values.push(compact);

        return {
            value: values[0] || '',
            confidence: Number(data.confidence) || 0
        };
    }


    let lcstDigitTemplateBank = null;

    function normalizeGlyphMask(sourceMask, sourceWidth, sourceHeight, box, outWidth, outHeight) {
        outWidth = outWidth || 32;
        outHeight = outHeight || 48;

        const left = Math.max(0, Math.floor(box.left || 0));
        const top = Math.max(0, Math.floor(box.top || 0));
        const right = Math.min(sourceWidth, Math.ceil(box.right != null ? box.right : left + (box.width || 0)));
        const bottom = Math.min(sourceHeight, Math.ceil(box.bottom != null ? box.bottom : top + (box.height || 0)));

        let minX = right;
        let minY = bottom;
        let maxX = -1;
        let maxY = -1;

        for (let y = top; y < bottom; y++) {
            const row = y * sourceWidth;
            for (let x = left; x < right; x++) {
                if (!sourceMask[row + x]) continue;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        const output = new Uint8Array(outWidth * outHeight);
        if (maxX < minX || maxY < minY) return output;

        const glyphWidth = Math.max(1, maxX - minX + 1);
        const glyphHeight = Math.max(1, maxY - minY + 1);
        const marginX = 3;
        const marginY = 3;
        const scale = Math.min(
            (outWidth - marginX * 2) / glyphWidth,
            (outHeight - marginY * 2) / glyphHeight
        );

        const targetWidth = Math.max(1, Math.round(glyphWidth * scale));
        const targetHeight = Math.max(1, Math.round(glyphHeight * scale));
        const offsetX = Math.floor((outWidth - targetWidth) / 2);
        const offsetY = Math.floor((outHeight - targetHeight) / 2);

        for (let ty = 0; ty < targetHeight; ty++) {
            const sy = Math.min(
                maxY,
                minY + Math.floor((ty + 0.5) * glyphHeight / targetHeight)
            );
            for (let tx = 0; tx < targetWidth; tx++) {
                const sx = Math.min(
                    maxX,
                    minX + Math.floor((tx + 0.5) * glyphWidth / targetWidth)
                );
                if (sourceMask[sy * sourceWidth + sx]) {
                    output[(offsetY + ty) * outWidth + offsetX + tx] = 1;
                }
            }
        }

        return output;
    }

    function buildRenderedDigitMask(digit, fontFamily, fontWeight) {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 128;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fontKerning = 'none';
        ctx.font = String(fontWeight) + ' 76px ' + fontFamily;
        ctx.fillText(String(digit), canvas.width / 2, canvas.height / 2 + 2);

        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const mask = new Uint8Array(canvas.width * canvas.height);

        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            const lum = Math.round(
                data[i] * 0.299 +
                data[i + 1] * 0.587 +
                data[i + 2] * 0.114
            );
            mask[p] = lum < 170 ? 1 : 0;
        }

        return normalizeGlyphMask(
            mask,
            canvas.width,
            canvas.height,
            {
                left: 0,
                top: 0,
                right: canvas.width,
                bottom: canvas.height
            },
            32,
            48
        );
    }

    function getDigitTemplateBank() {
        if (lcstDigitTemplateBank) return lcstDigitTemplateBank;

        const families = [
            '"Roboto", sans-serif',
            '"Arial", sans-serif',
            '"Segoe UI", sans-serif',
            '"Helvetica Neue", sans-serif',
            'sans-serif'
        ];
        const weights = [300, 400, 500, 600];
        const bank = {};

        for (let digit = 0; digit <= 9; digit++) {
            const key = String(digit);
            bank[key] = [];

            families.forEach(fontFamily => {
                weights.forEach(fontWeight => {
                    try {
                        bank[key].push(
                            buildRenderedDigitMask(key, fontFamily, fontWeight)
                        );
                    } catch (err) {
                        console.warn('[LCST template font gagal]', fontFamily, fontWeight, err);
                    }
                });
            });
        }

        lcstDigitTemplateBank = bank;
        return bank;
    }

    function shiftedMaskSimilarity(a, b, width, height) {
        let sumA = 0;
        let sumB = 0;
        for (let i = 0; i < a.length; i++) {
            if (a[i]) sumA++;
            if (b[i]) sumB++;
        }
        if (!sumA || !sumB) return 0;

        let best = 0;

        // Pergeseran kecil mengatasi beda hinting/anti-aliasing font.
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                let intersection = 0;
                let shiftedBCount = 0;

                for (let y = 0; y < height; y++) {
                    const by = y - dy;
                    if (by < 0 || by >= height) continue;

                    for (let x = 0; x < width; x++) {
                        const bx = x - dx;
                        if (bx < 0 || bx >= width) continue;

                        const bv = b[by * width + bx];
                        if (bv) shiftedBCount++;
                        if (a[y * width + x] && bv) intersection++;
                    }
                }

                const union = sumA + shiftedBCount - intersection;
                const iou = union > 0 ? intersection / union : 0;
                const dice = (sumA + shiftedBCount) > 0
                    ? (2 * intersection) / (sumA + shiftedBCount)
                    : 0;
                const score = iou * 0.50 + dice * 0.50;
                if (score > best) best = score;
            }
        }

        return best;
    }

    function scoreGlyphAgainstDigit(glyphMask, digit) {
        const bank = getDigitTemplateBank();
        const templates = bank[String(digit)] || [];
        let best = 0;

        for (const template of templates) {
            const score = shiftedMaskSimilarity(
                glyphMask,
                template,
                32,
                48
            );
            if (score > best) best = score;
        }

        return best;
    }

    function classifyAmbiguousGlyphByTemplate(binary, box, pair) {
        const glyphMask = normalizeGlyphMask(
            binary.mask,
            binary.width,
            binary.height,
            box,
            32,
            48
        );

        const first = String(pair[0]);
        const second = String(pair[1]);
        const firstScore = scoreGlyphAgainstDigit(glyphMask, first);
        const secondScore = scoreGlyphAgainstDigit(glyphMask, second);

        const bestDigit = firstScore >= secondScore ? first : second;
        const bestScore = Math.max(firstScore, secondScore);
        const secondBest = Math.min(firstScore, secondScore);
        const margin = bestScore - secondBest;

        // Nilai 0.54 cukup aman untuk glyph normal.
        // Margin 0.055 mencegah koreksi ketika bentuk terlalu samar.
        const reliable = bestScore >= 0.54 && margin >= 0.055;
        const confidence = reliable
            ? Math.max(
                78,
                Math.min(
                    99,
                    Math.round(78 + margin * 95 + Math.max(0, bestScore - 0.54) * 30)
                )
            )
            : 0;

        return {
            digit: reliable ? bestDigit : '',
            confidence,
            bestScore,
            margin,
            scores: {
                [first]: firstScore,
                [second]: secondScore
            }
        };
    }

    function resolveAmbiguousDigitsByTemplate(lineCanvas, recognizedDigits) {
        const digits = onlyDigits(recognizedDigits);
        if (digits.length !== LCST_EXPECTED_BOTTOM_LENGTH) {
            return {
                value: digits,
                changed: false,
                changedCount: 0,
                reliableCount: 0,
                averageConfidence: 0,
                details: []
            };
        }

        const binary = findDigitGlyphBoxes(
            lineCanvas,
            LCST_EXPECTED_BOTTOM_LENGTH
        );

        if (
            !binary ||
            !binary.boxes ||
            binary.boxes.length !== LCST_EXPECTED_BOTTOM_LENGTH
        ) {
            return {
                value: digits,
                changed: false,
                changedCount: 0,
                reliableCount: 0,
                averageConfidence: 0,
                details: []
            };
        }

        const output = digits.split('');
        const details = [];
        let changedCount = 0;
        let reliableCount = 0;
        let confidenceTotal = 0;

        for (let index = 0; index < output.length; index++) {
            const current = output[index];
            let pair = null;

            if (current === '0' || current === '9') {
                pair = ['0', '9'];
            } else if (current === '2' || current === '7') {
                pair = ['2', '7'];
            } else {
                continue;
            }

            const classified = classifyAmbiguousGlyphByTemplate(
                binary,
                binary.boxes[index],
                pair
            );

            details.push({
                index,
                before: current,
                after: classified.digit || current,
                confidence: classified.confidence,
                bestScore: classified.bestScore,
                margin: classified.margin,
                scores: classified.scores,
                boxMethod: binary.method
            });

            if (!classified.digit || classified.confidence < 78) continue;

            reliableCount++;
            confidenceTotal += classified.confidence;

            if (classified.digit !== current) {
                output[index] = classified.digit;
                changedCount++;
            }
        }

        return {
            value: output.join(''),
            changed: changedCount > 0,
            changedCount,
            reliableCount,
            averageConfidence: reliableCount
                ? Math.round(confidenceTotal / reliableCount)
                : 0,
            details
        };
    }

    function countMaskPixels(mask, width, left, top, right, bottom) {
        const x0 = Math.max(0, Math.floor(left));
        const y0 = Math.max(0, Math.floor(top));
        const x1 = Math.max(x0, Math.ceil(right));
        const y1 = Math.max(y0, Math.ceil(bottom));
        let count = 0;

        for (let y = y0; y < y1; y++) {
            const row = y * width;
            for (let x = x0; x < x1; x++) {
                if (mask[row + x]) count++;
            }
        }
        return count;
    }

    function classifyZeroNineGlyph(binary, box) {
        const mask = binary.mask;
        const width = binary.width;

        const left = box.left;
        const top = box.top;
        const glyphWidth = Math.max(1, box.right - box.left);
        const glyphHeight = Math.max(1, box.bottom - box.top);
        const midX = left + glyphWidth * 0.50;

        // Angka 0 memiliki stroke bawah kiri dan kanan yang hampir seimbang.
        // Angka 9 memiliki ekor bawah dominan di sisi kanan. Fokus ke 48%
        // bagian bawah dan beri bobot lebih besar pada sepertiga terbawah.
        const lowerTop = top + glyphHeight * 0.50;
        const bottomTop = top + glyphHeight * 0.66;
        const bottom = box.bottom;

        const lowerLeft = countMaskPixels(mask, width, left, lowerTop, midX, bottom);
        const lowerRight = countMaskPixels(mask, width, midX, lowerTop, box.right, bottom);
        const bottomLeft = countMaskPixels(mask, width, left, bottomTop, midX, bottom);
        const bottomRight = countMaskPixels(mask, width, midX, bottomTop, box.right, bottom);

        const lowerRatio = (lowerRight + 1) / (lowerLeft + 1);
        const bottomRatio = (bottomRight + 1) / (bottomLeft + 1);
        const shapeRatio = bottomRatio * 0.68 + lowerRatio * 0.32;

        if (shapeRatio >= 1.32 && bottomRatio >= 1.38) {
            return {
                digit: '9',
                confidence: Math.max(76, Math.min(99, Math.round(76 + (shapeRatio - 1.32) * 52))),
                shapeRatio,
                bottomRatio,
                lowerRatio
            };
        }

        if (shapeRatio <= 1.15 && bottomRatio <= 1.20) {
            return {
                digit: '0',
                confidence: Math.max(76, Math.min(99, Math.round(76 + (1.15 - shapeRatio) * 85))),
                shapeRatio,
                bottomRatio,
                lowerRatio
            };
        }

        return {
            digit: '',
            confidence: 0,
            shapeRatio,
            bottomRatio,
            lowerRatio
        };
    }


    function countActiveColumnsInBox(mask, width, left, top, right, bottom, minPixelsPerColumn) {
        const x0 = Math.max(0, Math.floor(left));
        const y0 = Math.max(0, Math.floor(top));
        const x1 = Math.max(x0, Math.ceil(right));
        const y1 = Math.max(y0, Math.ceil(bottom));
        const minPixels = Math.max(1, minPixelsPerColumn || 1);

        let active = 0;
        for (let x = x0; x < x1; x++) {
            let count = 0;
            for (let y = y0; y < y1; y++) {
                if (mask[y * width + x]) count++;
            }
            if (count >= minPixels) active++;
        }
        return active;
    }

    function classifyTwoSevenGlyph(binary, box) {
        const mask = binary.mask;
        const width = binary.width;

        const left = box.left;
        const top = box.top;
        const right = box.right;
        const bottom = box.bottom;
        const glyphWidth = Math.max(1, right - left);
        const glyphHeight = Math.max(1, bottom - top);
        const midX = left + glyphWidth * 0.50;

        const topBandTop = top;
        const topBandBottom = top + glyphHeight * 0.28;

        const midBandTop = top + glyphHeight * 0.34;
        const midBandBottom = top + glyphHeight * 0.68;

        const lowBandTop = top + glyphHeight * 0.52;
        const lowBandBottom = bottom;

        const footBandTop = top + glyphHeight * 0.78;
        const footBandBottom = bottom;

        const topInk = countMaskPixels(mask, width, left, topBandTop, right, topBandBottom);
        const midLeft = countMaskPixels(mask, width, left, midBandTop, midX, midBandBottom);
        const midRight = countMaskPixels(mask, width, midX, midBandTop, right, midBandBottom);

        const lowLeft = countMaskPixels(mask, width, left, lowBandTop, midX, lowBandBottom);
        const lowRight = countMaskPixels(mask, width, midX, lowBandTop, right, lowBandBottom);

        const footInk = countMaskPixels(mask, width, left, footBandTop, right, footBandBottom);
        const footLeft = countMaskPixels(mask, width, left, footBandTop, midX, footBandBottom);
        const footRight = countMaskPixels(mask, width, midX, footBandTop, right, footBandBottom);

        const footActiveCols = countActiveColumnsInBox(
            mask,
            width,
            left,
            footBandTop,
            right,
            footBandBottom,
            Math.max(1, Math.round((footBandBottom - footBandTop) * 0.18))
        );

        const footSpanRatio = footActiveCols / Math.max(1, glyphWidth);
        const footToTopRatio = (footInk + 1) / (topInk + 1);
        const footLeftRatio = (footLeft + 1) / (footInk + 1);
        const footRightRatio = (footRight + 1) / (footInk + 1);
        const lowLeftRatio = (lowLeft + 1) / (lowLeft + lowRight + 1);
        const midRightBias = (midRight + 1) / (midLeft + 1);

        if (
            footSpanRatio >= 0.38 &&
            footToTopRatio >= 0.22 &&
            (footLeftRatio >= 0.22 || lowLeftRatio >= 0.28)
        ) {
            const strength =
                (footSpanRatio - 0.38) * 85 +
                (footToTopRatio - 0.22) * 42 +
                Math.max(0, footLeftRatio - 0.22) * 55 +
                Math.max(0, lowLeftRatio - 0.28) * 48;
            return {
                digit: '2',
                confidence: Math.max(76, Math.min(99, Math.round(76 + strength))),
                footSpanRatio,
                footToTopRatio,
                footLeftRatio,
                footRightRatio,
                lowLeftRatio,
                midRightBias
            };
        }

        if (
            footSpanRatio <= 0.28 &&
            footToTopRatio <= 0.18 &&
            footLeftRatio <= 0.19 &&
            midRightBias >= 0.92
        ) {
            const strength =
                (0.28 - footSpanRatio) * 90 +
                (0.18 - footToTopRatio) * 55 +
                (0.19 - footLeftRatio) * 70 +
                Math.max(0, midRightBias - 0.92) * 18;
            return {
                digit: '7',
                confidence: Math.max(76, Math.min(99, Math.round(76 + strength))),
                footSpanRatio,
                footToTopRatio,
                footLeftRatio,
                footRightRatio,
                lowLeftRatio,
                midRightBias
            };
        }

        return {
            digit: '',
            confidence: 0,
            footSpanRatio,
            footToTopRatio,
            footLeftRatio,
            footRightRatio,
            lowLeftRatio,
            midRightBias
        };
    }

    function resolveTwoSevenByGeometry(lineCanvas, recognizedDigits) {
        const digits = onlyDigits(recognizedDigits);
        if (digits.length !== LCST_EXPECTED_BOTTOM_LENGTH) {
            return {
                value: digits,
                changed: false,
                changedCount: 0,
                checkedCount: 0,
                reliableCount: 0,
                averageConfidence: 0,
                details: []
            };
        }

        const binary = findDigitGlyphBoxes(lineCanvas, LCST_EXPECTED_BOTTOM_LENGTH);
        if (!binary || !binary.boxes || binary.boxes.length !== LCST_EXPECTED_BOTTOM_LENGTH) {
            return {
                value: digits,
                changed: false,
                changedCount: 0,
                checkedCount: 0,
                reliableCount: 0,
                averageConfidence: 0,
                details: []
            };
        }

        const output = digits.split('');
        const details = [];
        let changedCount = 0;
        let reliableCount = 0;
        let confidenceTotal = 0;

        for (let i = 0; i < output.length; i++) {
            if (output[i] !== '2' && output[i] !== '7') continue;

            const classified = classifyTwoSevenGlyph(binary, binary.boxes[i]);
            details.push({
                index: i,
                before: output[i],
                after: classified.digit || output[i],
                confidence: classified.confidence,
                footSpanRatio: classified.footSpanRatio,
                footToTopRatio: classified.footToTopRatio,
                footLeftRatio: classified.footLeftRatio,
                method: binary.method
            });

            if (!classified.digit || classified.confidence < 76) continue;
            reliableCount++;
            confidenceTotal += classified.confidence;

            if (classified.digit !== output[i]) {
                output[i] = classified.digit;
                changedCount++;
            }
        }

        return {
            value: output.join(''),
            changed: changedCount > 0,
            changedCount,
            checkedCount: details.length,
            reliableCount,
            averageConfidence: reliableCount
                ? Math.round(confidenceTotal / reliableCount)
                : 0,
            details
        };
    }

    function resolveZeroNineByGeometry(lineCanvas, recognizedDigits) {
        const digits = onlyDigits(recognizedDigits);
        if (digits.length !== LCST_EXPECTED_BOTTOM_LENGTH) {
            return {
                value: digits,
                changed: false,
                changedCount: 0,
                checkedCount: 0,
                reliableCount: 0,
                averageConfidence: 0,
                details: []
            };
        }

        const binary = findDigitGlyphBoxes(lineCanvas, LCST_EXPECTED_BOTTOM_LENGTH);
        if (!binary || !binary.boxes || binary.boxes.length !== LCST_EXPECTED_BOTTOM_LENGTH) {
            return {
                value: digits,
                changed: false,
                changedCount: 0,
                checkedCount: 0,
                reliableCount: 0,
                averageConfidence: 0,
                details: []
            };
        }

        const output = digits.split('');
        const details = [];
        let changedCount = 0;
        let reliableCount = 0;
        let confidenceTotal = 0;

        for (let i = 0; i < output.length; i++) {
            if (output[i] !== '0' && output[i] !== '9') continue;

            const classified = classifyZeroNineGlyph(binary, binary.boxes[i]);
            details.push({
                index: i,
                before: output[i],
                after: classified.digit || output[i],
                confidence: classified.confidence,
                shapeRatio: classified.shapeRatio,
                bottomRatio: classified.bottomRatio,
                method: binary.method
            });

            if (!classified.digit || classified.confidence < 76) continue;
            reliableCount++;
            confidenceTotal += classified.confidence;

            if (classified.digit !== output[i]) {
                output[i] = classified.digit;
                changedCount++;
            }
        }

        return {
            value: output.join(''),
            changed: changedCount > 0,
            changedCount,
            checkedCount: details.length,
            reliableCount,
            averageConfidence: reliableCount
                ? Math.round(confidenceTotal / reliableCount)
                : 0,
            details
        };
    }

    function uniqueStrings(values) {
        return Array.from(new Set(values.filter(Boolean)));
    }

    function textLinesFromRecognition(result) {
        const data = result && result.data ? result.data : {};
        const lines = String(data.text || '').split(/\r?\n/).map(onlyDigits).filter(Boolean);
        const words = (data.words || []).map(w => onlyDigits(w.text || '')).filter(Boolean);
        return uniqueStrings(lines.concat(words));
    }

    function topCandidatesFromDigits(digits) {
        digits = onlyDigits(digits);
        const out = [];
        if (!digits) return out;
        if (digits.length === LCST_EXPECTED_TOP_LENGTH && /^20\d{7}$/.test(digits)) out.push({ value: digits, correction: 0 });
        for (let i = 0; i + LCST_EXPECTED_TOP_LENGTH <= digits.length; i++) {
            const part = digits.slice(i, i + LCST_EXPECTED_TOP_LENGTH);
            if (/^20\d{7}$/.test(part)) out.push({ value: part, correction: digits.length === LCST_EXPECTED_TOP_LENGTH ? 0 : 1 });
        }
        return out;
    }

    function bottomCandidatesFromDigits(digits) {
        digits = onlyDigits(digits);
        const out = [];
        if (!digits) return out;

        if (digits.length === LCST_EXPECTED_BOTTOM_LENGTH) {
            out.push({ value: digits, correction: 0 });
        } else if (digits.length === LCST_EXPECTED_BOTTOM_LENGTH - 1) {
            // Tesseract sangat sering membuang angka nol pertama pada baris kedua.
            out.push({ value: '0' + digits, correction: 1 });
        } else if (digits.length === LCST_EXPECTED_BOTTOM_LENGTH - 2) {
            out.push({ value: '00' + digits, correction: 2 });
        }

        if (digits.length > LCST_EXPECTED_BOTTOM_LENGTH) {
            for (let i = 0; i + LCST_EXPECTED_BOTTOM_LENGTH <= digits.length; i++) {
                const part = digits.slice(i, i + LCST_EXPECTED_BOTTOM_LENGTH);
                out.push({ value: part, correction: 1 + Math.min(2, i) });
            }
        }
        return out;
    }

    function addVote(map, candidate, confidence, sourceWeight, source) {
        if (!candidate || !candidate.value) return;
        const current = map.get(candidate.value) || {
            value: candidate.value,
            votes: 0,
            weight: 0,
            confidenceTotal: 0,
            correction: candidate.correction || 0,
            sources: []
        };
        const correctionPenalty = Math.max(0.45, 1 - (candidate.correction || 0) * 0.20);
        current.votes++;
        current.weight += sourceWeight * correctionPenalty;
        current.confidenceTotal += Number(confidence) || 0;
        current.correction = Math.min(current.correction, candidate.correction || 0);
        current.sources.push(source);
        map.set(candidate.value, current);
    }

    function rankVotes(map) {
        return Array.from(map.values()).map(v => ({
            ...v,
            avgConfidence: v.confidenceTotal / Math.max(1, v.votes)
        })).sort((a, b) => (b.weight - a.weight) || (b.votes - a.votes) || (b.avgConfidence - a.avgConfidence));
    }
    async function recognizePrepared(worker, canvas, psm) {
        const psmValue = String(psm);
        const currentPsm = lcstWorkerPsmByWorker.get(worker);
        if (currentPsm !== psmValue) {
            await worker.setParameters({ tessedit_pageseg_mode: psmValue });
            lcstWorkerPsmByWorker.set(worker, psmValue);
            if (worker === lcstSharedWorker) lcstWorkerPsm = psmValue;
        }
        return worker.recognize(canvas);
    }

    function collectCombinedVotes(result, topVotes, bottomVotes, label, sourceWeight) {
        const data = result && result.data ? result.data : {};
        const confidence = Number(data.confidence) || 25;
        const lines = String(data.text || '').split(/\r?\n/).map(onlyDigits).filter(Boolean);
        const compact = onlyDigits(data.text || '');

        lines.forEach(line => {
            topCandidatesFromDigits(line).forEach(c => addVote(topVotes, c, confidence, sourceWeight, label));
            bottomCandidatesFromDigits(line).forEach(c => addVote(bottomVotes, c, confidence, sourceWeight * 0.92, label));
        });

        if (compact.length >= LCST_EXPECTED_FULL_LENGTH) {
            for (let i = 0; i + LCST_EXPECTED_FULL_LENGTH <= compact.length; i++) {
                const full = compact.slice(i, i + LCST_EXPECTED_FULL_LENGTH);
                const top = full.slice(0, LCST_EXPECTED_TOP_LENGTH);
                const bottom = full.slice(LCST_EXPECTED_TOP_LENGTH);
                if (/^20\d{7}$/.test(top)) {
                    addVote(topVotes, { value: top, correction: 0 }, confidence, sourceWeight + 0.35, label + '-full');
                    addVote(bottomVotes, { value: bottom, correction: 0 }, confidence, sourceWeight + 0.35, label + '-full');
                }
            }
        }
    }

    function collectLineVotes(result, kind, votes, label, sourceWeight) {
        const data = result && result.data ? result.data : {};
        const confidence = Number(data.confidence) || 25;
        const candidates = textLinesFromRecognition(result);
        candidates.forEach(value => {
            const list = kind === 'top' ? topCandidatesFromDigits(value) : bottomCandidatesFromDigits(value);
            list.forEach(c => addVote(votes, c, confidence, sourceWeight, label));
        });
    }

    function chooseFinalPeriod(topVotes, bottomVotes, usedPasses) {
        const tops = rankVotes(topVotes).filter(x => /^20\d{7}$/.test(x.value));
        const bottoms = rankVotes(bottomVotes).filter(x => /^\d{10}$/.test(x.value));
        if (!tops.length || !bottoms.length) {
            return {
                period: '',
                confidence: 0,
                top: tops[0] || null,
                bottom: bottoms[0] || null,
                tops,
                bottoms
            };
        }

        const top = tops[0];
        const bottom = bottoms[0];
        const period = top.value + bottom.value;
        const voteStrength = Math.min(24, (top.votes + bottom.votes) * 3.2);
        const weightStrength = Math.min(20, (top.weight + bottom.weight) * 2.1);
        const ocrStrength = Math.min(16, ((top.avgConfidence || 0) + (bottom.avgConfidence || 0)) * 0.08);
        const correctionPenalty = (top.correction + bottom.correction) * 5;
        const confidence = Math.max(52, Math.min(98, Math.round(52 + voteStrength + weightStrength + ocrStrength - correctionPenalty)));
        return { period, confidence, top, bottom, tops, bottoms, usedPasses };
    }

    function yieldToDashboard(force) {
        // Tesseract berjalan di Web Worker, jadi tidak perlu menunggu satu frame
        // sebelum setiap pass. Beri kesempatan render setiap tiga pass saja.
        lcstDashboardYieldCounter++;
        if (!force && lcstDashboardYieldCounter % 3 !== 0) return Promise.resolve();
        return new Promise(resolve => setTimeout(resolve, 0));
    }
    // ULTRA FAST: satu pass OCR dahulu pada area transaksi terkunci.
    // Jika 9+10 digit sudah valid, langsung selesai. Mesin multi-pass lama hanya fallback.
    function lcstRenderHyperFastPrepared(source, mode) {
        // Khusus jalur pertama: gambar OCR dibuat jauh lebih kecil dari fallback PATEN.
        // Jika gagal, mesin lama tetap mengambil alih dengan preprocessing penuh.
        const targetHeight = 104;
        const scale = Math.max(1.15, Math.min(2.45, targetHeight / Math.max(1, source.height)));
        const base = upscaleCanvas(source, scale);
        const grayData = grayscaleInvertedData(base);
        const stretched = stretchGray(grayData.gray, grayData.hist);
        let pixels = new Uint8Array(stretched.length);
        if (mode === 'otsu') {
            const threshold = otsuThreshold(stretched);
            for (let i = 0; i < stretched.length; i++) pixels[i] = stretched[i] < threshold ? 0 : 255;
        } else {
            for (let i = 0; i < stretched.length; i++) {
                pixels[i] = Math.max(0, Math.min(255, Math.round((stretched[i] - 10) * 1.16)));
            }
        }
        const out = createCanvas(base.width, base.height);
        const ctx = out.getContext('2d');
        const img = ctx.createImageData(base.width, base.height);
        for (let i = 0, p = 0; p < pixels.length; p++, i += 4) {
            const v = pixels[p];
            img.data[i] = v;
            img.data[i + 1] = v;
            img.data[i + 2] = v;
            img.data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        return addWhiteBorder(out, 8);
    }

    function lcstTopPeriodDateValid(value) {
        const digits = onlyDigits(value);
        if (!/^20\d{7}$/.test(digits)) return false;
        return !!lcstValidDateParts(
            Number(digits.slice(0, 4)),
            Number(digits.slice(4, 6)),
            Number(digits.slice(6, 8))
        );
    }

    function lcstFastPeriodReliable(picked, minOcrConfidence) {
        if (!picked || !picked.period || !picked.top || !picked.bottom) return false;
        if (!/^20\d{7}\d{10}$/.test(picked.period)) return false;
        if (!lcstTopPeriodDateValid(picked.top.value)) return false;
        if (picked.top.correction !== 0 || picked.bottom.correction !== 0) return false;
        const minConf = Number(minOcrConfidence) || 55;
        return (picked.top.avgConfidence || 0) >= minConf &&
            (picked.bottom.avgConfidence || 0) >= minConf;
    }

    async function lcstQuickRowsFromLockedMarker(sourceCanvas, marker, worker, helperWorker, onProgress) {
        const rects = buildTransactionCropRects(sourceCanvas, marker);
        const rect = rects && rects.length ? rects[0] : null;
        if (!rect || !worker) return null;

        try {
            if (onProgress) onProgress('FAST STRICT • mengunci baris 9 + 10 digit');
            const cropped = cropCanvas(sourceCanvas, rect);
            const lineRects = findTwoLineRects(cropped);
            if (!lineRects || lineRects.length < 2) return null;
            const topLine = cropCanvas(cropped, lineRects[0]);
            const bottomLine = cropCanvas(cropped, lineRects[1]);
            const topVotes = new Map();
            const bottomVotes = new Map();
            const rawTexts = [];

            const run = async (activeWorker, canvas, kind, label) => {
                const prepared = lcstRenderHyperFastPrepared(canvas, 'soft');
                const result = await recognizePrepared(activeWorker, prepared, 7);
                rawTexts.push('[' + label + ']\n' + String(result && result.data && result.data.text || ''));
                collectLineVotes(
                    result,
                    kind,
                    kind === 'top' ? topVotes : bottomVotes,
                    label,
                    5.8
                );
                return result;
            };

            const secondWorker = helperWorker && helperWorker !== worker ? helperWorker : null;
            if (secondWorker) {
                await Promise.all([
                    run(worker, topLine, 'top', 'fast-strict-top'),
                    run(secondWorker, bottomLine, 'bottom', 'fast-strict-bottom')
                ]);
            } else {
                await run(worker, topLine, 'top', 'fast-strict-top');
                await run(worker, bottomLine, 'bottom', 'fast-strict-bottom');
            }

            const picked = chooseFinalPeriod(topVotes, bottomVotes, 2);
            if (!lcstFastPeriodReliable(picked, 62)) return null;
            if ((marker.confidence || 0) < 54) return null;

            return {
                period: picked.period,
                confidence: Math.max(86, Number(picked.confidence) || 0),
                text: rawTexts.join('\n'),
                preview: '',
                passes: 2,
                debugTop: picked.top ? picked.top.value : '',
                debugBottom: picked.bottom ? picked.bottom.value : '',
                ultraFast: true,
                fastStrictRows: true
            };
        } catch (e) {
            return null;
        }
    }

    async function lcstQuickPeriodFromLockedMarker(sourceCanvas, marker, worker, onProgress) {
        const directWindow = buildDirectMarkerCodeWindow(sourceCanvas, marker);
        const rects = buildTransactionCropRects(sourceCanvas, marker);
        const rect = rects && rects.length ? rects[0] : null;
        if (!directWindow && !rect) return null;

        // V6.4.3: pass pertama memakai window marker yang paling kecil.
        // Lebih sedikit piksel masuk Tesseract = jauh lebih cepat. Bila window ini
        // tidak tersedia, baru gunakan crop transaksi lama sebagai fallback.
        try {
            if (onProgress) onProgress('ULTRA SCAN • 1-pass kode');
            const canvas = directWindow || cropCanvas(sourceCanvas, rect);
            const prepared = lcstRenderHyperFastPrepared(canvas, 'soft');
            const result = await recognizePrepared(worker, prepared, 6);
            const topVotes = new Map();
            const bottomVotes = new Map();
            collectCombinedVotes(result, topVotes, bottomVotes, 'hyper-fast-soft', 5.2);
            const picked = chooseFinalPeriod(topVotes, bottomVotes, 1);

            if (lcstFastPeriodReliable(picked, 52) && (marker.confidence || 0) >= 50) {
                return {
                    period: picked.period,
                    confidence: Math.max(80, Number(picked.confidence) || 0),
                    text: String(result && result.data && result.data.text || ''),
                    preview: '',
                    passes: 1,
                    debugTop: picked.top ? picked.top.value : '',
                    debugBottom: picked.bottom ? picked.bottom.value : '',
                    ultraFast: true,
                    hyperFast: true
                };
            }
        } catch (e) {}
        return null;
    }

    async function ocrMarkerLockedCode(sourceCanvas, marker, worker, onProgress) {
        const rects = buildTransactionCropRects(sourceCanvas, marker);
        const topVotes = new Map();
        const bottomVotes = new Map();
        const rawTexts = [];
        const zeroNineVoteKeys = new Set();
        const zeroNineCorrections = [];
        const tightBottomConsensusLog = [];
        const directMarkerLockLog = [];
        let lockedBottomValue = '';
        let usedPasses = 0;

        const logResult = (label, result) => {
            rawTexts.push('[' + label + ']\n' + ((result && result.data && result.data.text) || ''));
        };

        const runLine = async (canvas, kind, mode, label, weight) => {
            await yieldToDashboard();
            if (onProgress) onProgress('Baris terkunci • ' + label + ' • ' + mode);
            try {
                const prepared = renderPreparedVariant(canvas, mode, true);
                const result = await recognizePrepared(worker, prepared, 7);
                usedPasses++;
                logResult(label + '/' + mode, result);
                collectLineVotes(result, kind, kind === 'top' ? topVotes : bottomVotes, label + '-' + mode, weight);
                return result;
            } catch (err) {
                console.warn('[LCST line OCR gagal]', err);
                return null;
            }
        };

        const runCombined = async (canvas, mode, label, weight) => {
            await yieldToDashboard();
            if (onProgress) onProgress('Baris terkunci • ' + label + ' • gabungan ' + mode);
            try {
                const prepared = renderPreparedVariant(canvas, mode, false);
                const result = await recognizePrepared(worker, prepared, 6);
                usedPasses++;
                logResult(label + '/combined/' + mode, result);
                collectCombinedVotes(result, topVotes, bottomVotes, label + '-' + mode, weight);
                return result;
            } catch (err) {
                console.warn('[LCST combined OCR gagal]', err);
                return null;
            }
        };



        const runDirectMarkerBottomLock = async () => {
            const directWindow = buildDirectMarkerCodeWindow(
                sourceCanvas,
                marker
            );

            if (!directWindow) {
                directMarkerLockLog.push({
                    locked: false,
                    reason: 'direct-window-not-found'
                });
                return null;
            }

            const passes = [
                { mode: 'soft', psm: 6, weight: 1 },
                { mode: 'strong', psm: 6, weight: 1 },
                { mode: 'otsu', psm: 6, weight: 1 }
            ];

            const reads = [];
            const passWinners = [];

            for (const pass of passes) {
                await yieldToDashboard();

                if (onProgress) {
                    onProgress(
                        'Direct marker lock • area 10 digit • ' +
                        pass.mode
                    );
                }

                try {
                    const prepared = renderPreparedVariant(
                        directWindow,
                        pass.mode,
                        false
                    );
                    const result = await recognizePrepared(
                        worker,
                        prepared,
                        pass.psm
                    );

                    usedPasses++;
                    logResult(
                        'direct-marker/' + pass.mode + '/psm-' + pass.psm,
                        result
                    );

                    // Area direct marker berisi dua baris kode. Gunakan hasil yang
                    // sudah dibaca ini untuk voting 9 digit atas dan 10 digit bawah
                    // sekaligus, sehingga baris atas tidak perlu selalu di-OCR ulang.
                    collectCombinedVotes(
                        result,
                        topVotes,
                        bottomVotes,
                        'direct-marker-' + pass.mode,
                        2.65
                    );

                    // V6.4.3 ONE-PASS DIRECT LOCK: bila satu OCR pada crop marker sudah
                    // memberi 9+10 digit tanpa koreksi, tanggal valid, confidence tinggi,
                    // dan marker kuat, jangan paksa consensus pass ke-2. Fallback lama
                    // tetap dipakai untuk hasil yang sedikit saja meragukan.
                    const onePassPicked = chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
                    if (
                        pass.mode === 'soft' &&
                        (marker.confidence || 0) >= 60 &&
                        lcstFastPeriodReliable(onePassPicked, 72)
                    ) {
                        directMarkerLockLog.push({
                            locked: true,
                            reason: 'one-pass-full-period',
                            period: onePassPicked.period,
                            confidence: onePassPicked.confidence
                        });
                        return { fastPicked: onePassPicked, singlePass: true };
                    }

                    const exactItems = exactTenDigitLinesFromRecognition(result);
                    exactItems.forEach(item => {
                        reads.push({
                            value: item.value,
                            confidence: item.confidence,
                            mode: pass.mode,
                            psm: pass.psm
                        });
                    });

                    if (exactItems.length) {
                        const best = exactItems.slice().sort((a, b) =>
                            (Number(b.confidence) || 0) - (Number(a.confidence) || 0)
                        )[0];
                        passWinners.push({
                            value: best.value,
                            confidence: best.confidence,
                            mode: pass.mode,
                            psm: pass.psm
                        });
                    }
                } catch (err) {
                    console.warn(
                        '[LCST direct marker OCR gagal]',
                        pass.mode,
                        err
                    );
                }

                // Cara lock tetap minimal dua preprocessing yang sama.
                // Pass ketiga hanya dijalankan bila dua pass pertama belum sepakat.
                if (
                    passWinners.length >= 2 &&
                    passWinners[passWinners.length - 1].value ===
                        passWinners[passWinners.length - 2].value
                ) {
                    break;
                }
            }

            if (!reads.length) {
                directMarkerLockLog.push({
                    locked: false,
                    reason: 'no-exact-10-digit-line',
                    reads
                });
                return null;
            }

            const grouped = new Map();

            reads.forEach(read => {
                const current = grouped.get(read.value) || {
                    value: read.value,
                    count: 0,
                    confidenceTotal: 0,
                    sources: []
                };

                current.count++;
                current.confidenceTotal += read.confidence || 0;
                current.sources.push(read.mode + '/psm' + read.psm);
                grouped.set(read.value, current);
            });

            const ranked = Array.from(grouped.values())
                .map(item => ({
                    ...item,
                    avgConfidence:
                        item.confidenceTotal / Math.max(1, item.count)
                }))
                .sort((a, b) =>
                    (b.count - a.count) ||
                    (b.avgConfidence - a.avgConfidence)
                );

            const winner = ranked[0];

            // Hard lock hanya jika minimal dua preprocessing membaca sama.
            if (
                !winner ||
                winner.count < 2 ||
                !/^\d{10}$/.test(winner.value)
            ) {
                directMarkerLockLog.push({
                    locked: false,
                    reason: 'no-two-pass-consensus',
                    ranked,
                    reads
                });
                return null;
            }

            lockedBottomValue = winner.value;

            // Bobot dibuat dominan karena sumbernya adalah crop paling bersih:
            // dua baris transaksi, berhenti sebelum ikon marker.
            for (let index = 0; index < 7; index++) {
                addVote(
                    bottomVotes,
                    {
                        value: winner.value,
                        correction: 0
                    },
                    winner.avgConfidence || 90,
                    34.0,
                    'direct-marker-lock-' + (index + 1)
                );
            }

            directMarkerLockLog.push({
                locked: true,
                value: winner.value,
                count: winner.count,
                avgConfidence: winner.avgConfidence,
                sources: winner.sources,
                reads
            });

            rawTexts.push(
                '[DIRECT MARKER LOCK]\n' +
                winner.value +
                ' | sepakat=' + winner.count +
                ' | confidence=' +
                Math.round(winner.avgConfidence || 0) + '%' +
                ' | sumber=' + winner.sources.join(', ')
            );

            return winner;
        };

        const runTightBottomConsensus = async (bottomLine, label) => {
            if (lockedBottomValue) {
                return {
                    value: lockedBottomValue,
                    source: 'direct-marker-lock',
                    locked: true
                };
            }

            const variants = buildTightBottomRowVariants(bottomLine);
            if (!variants.length) return null;

            const reads = [];
            const maxPasses = Math.min(3, variants.length);

            for (let i = 0; i < maxPasses; i++) {
                const variant = variants[i];
                await yieldToDashboard();

                if (onProgress) {
                    onProgress(
                        'Validasi 10 digit • ' + label +
                        ' • ' + variant.source +
                        ' • ' + variant.mode
                    );
                }

                try {
                    // PSM 7 untuk dua pass pertama. Pass terakhir memakai PSM 13
                    // agar hasil tidak dipengaruhi heuristic pemisahan kata.
                    const psm = i < 2 ? 7 : 13;
                    const result = await recognizePrepared(worker, variant.canvas, psm);
                    usedPasses++;
                    logResult(label + '/tight-' + variant.mode + '/psm-' + psm, result);

                    const exact = exactBottomValueFromRecognition(result);
                    if (exact.value) {
                        reads.push({
                            value: exact.value,
                            confidence: exact.confidence,
                            mode: variant.mode,
                            source: variant.source,
                            psm
                        });
                    }
                } catch (err) {
                    console.warn('[LCST tight bottom OCR gagal]', err);
                }

                // Progressive fast path: bila dua pembacaan pertama sama,
                // tidak perlu menjalankan pass ketiga.
                if (
                    reads.length >= 2 &&
                    reads[reads.length - 1].value === reads[reads.length - 2].value
                ) {
                    break;
                }
            }

            if (!reads.length) return null;

            const grouped = new Map();
            reads.forEach(read => {
                const item = grouped.get(read.value) || {
                    value: read.value,
                    count: 0,
                    confidenceTotal: 0,
                    sources: []
                };
                item.count++;
                item.confidenceTotal += read.confidence || 0;
                item.sources.push(read.mode + '/psm' + read.psm);
                grouped.set(read.value, item);
            });

            const ranked = Array.from(grouped.values())
                .map(item => ({
                    ...item,
                    avgConfidence: item.confidenceTotal / Math.max(1, item.count)
                }))
                .sort((a, b) =>
                    (b.count - a.count) ||
                    (b.avgConfidence - a.avgConfidence)
                );

            const winner = ranked[0];
            if (!winner || winner.count < 2 || !/^\d{10}$/.test(winner.value)) {
                tightBottomConsensusLog.push({
                    label,
                    locked: false,
                    reads
                });
                return null;
            }

            const templateResolved = resolveAmbiguousDigitsByTemplate(
                bottomLine,
                winner.value
            );

            const lockedValue = (
                templateResolved &&
                /^\d{10}$/.test(templateResolved.value || '')
            )
                ? templateResolved.value
                : winner.value;

            lockedBottomValue = lockedValue;

            // Hard vote memakai hasil per-slot yang sudah dikoreksi.
            // Dengan ini konsensus baris yang salah seperti 4999460028
            // dapat dikoreksi menjadi 4990460928 sebelum dikunci.
            for (let i = 0; i < 5; i++) {
                addVote(
                    bottomVotes,
                    { value: lockedValue, correction: 0 },
                    Math.max(
                        winner.avgConfidence || 86,
                        templateResolved.averageConfidence || 0
                    ),
                    22.0,
                    label + '-slot-template-lock-' + (i + 1)
                );
            }

            tightBottomConsensusLog.push({
                label,
                locked: true,
                rawValue: winner.value,
                value: lockedValue,
                templateChanged: !!templateResolved.changed,
                templateChangedCount: templateResolved.changedCount || 0,
                templateConfidence: templateResolved.averageConfidence || 0,
                templateDetails: templateResolved.details || [],
                count: winner.count,
                avgConfidence: winner.avgConfidence,
                sources: winner.sources,
                reads
            });

            rawTexts.push(
                '[SLOT TEMPLATE LOCK ' + label + ']\n' +
                winner.value + ' -> ' + lockedValue +
                ' | perubahan=' + (templateResolved.changedCount || 0) +
                ' | template-confidence=' +
                    Math.round(templateResolved.averageConfidence || 0) + '%' +
                ' | sepakat-baris=' + winner.count +
                ' | sumber=' + winner.sources.join(', ')
            );

            return {
                ...winner,
                originalValue: winner.value,
                value: lockedValue,
                templateResolved
            };
        };

        const applyAmbiguousDigitGeometry = (bottomLine, picked, label) => {
            if (lockedBottomValue) {
                return chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
            }
            if (!picked || !picked.bottom || !/^\d{10}$/.test(picked.bottom.value || '')) {
                return picked;
            }

            const applyResolvedVotes = (resolved, caption, weightChanged, weightStable, baseValue) => {
                if (!resolved.checkedCount || !resolved.reliableCount || !/^\d{10}$/.test(resolved.value)) {
                    return;
                }

                const key = caption + '|' + label + '|' + resolved.value;
                if (zeroNineVoteKeys.has(key)) return;
                zeroNineVoteKeys.add(key);

                const visualWeight = resolved.changed ? weightChanged : weightStable;
                const visualConfidence = resolved.averageConfidence || 82;

                addVote(
                    bottomVotes,
                    { value: resolved.value, correction: 0 },
                    visualConfidence,
                    visualWeight,
                    label + '-' + caption + '-a'
                );
                addVote(
                    bottomVotes,
                    { value: resolved.value, correction: 0 },
                    visualConfidence,
                    visualWeight,
                    label + '-' + caption + '-b'
                );

                if (resolved.changed) {
                    zeroNineCorrections.push({
                        label,
                        type: caption,
                        before: baseValue,
                        after: resolved.value,
                        confidence: visualConfidence,
                        changedCount: resolved.changedCount,
                        details: resolved.details
                    });
                    rawTexts.push(
                        '[KOREKSI VISUAL ' + caption + ' ' + label + ']\n' +
                        baseValue + ' -> ' + resolved.value +
                        ' | confidence=' + visualConfidence + '%' +
                        ' | posisi diperbaiki=' + resolved.changedCount
                    );
                }
            };

            const originalValue = picked.bottom.value;
            const resolved09 = resolveZeroNineByGeometry(bottomLine, originalValue);
            applyResolvedVotes(resolved09, '0/9', 5.10, 1.15, originalValue);

            const baseFor27 = (resolved09 && /^\d{10}$/.test(resolved09.value || ''))
                ? resolved09.value
                : originalValue;
            const resolved27 = resolveTwoSevenByGeometry(bottomLine, baseFor27);
            applyResolvedVotes(resolved27, '2/7', 4.95, 1.12, baseFor27);

            return chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
        };

        const makeReturn = (picked) => ({
            period: picked.period || '',
            confidence: picked.period ? picked.confidence : 0,
            text: rawTexts.join('\n--- PASS ---\n'),
            preview: '',
            passes: usedPasses,
            consensus: picked,
            zeroNineCorrections,
            tightBottomConsensusLog,
            directMarkerLockLog,
            lockedBottomValue,
            debugTop: picked.top ? picked.top.value : '',
            debugBottom: picked.bottom ? picked.bottom.value : ''
        });

        const isReliable = (picked, strict) => {
            if (!picked.period || !picked.top || !picked.bottom) return false;
            const exact = picked.top.correction === 0 && picked.bottom.correction === 0;
            const votesOkay = picked.top.votes >= (strict ? 2 : 1) && picked.bottom.votes >= (strict ? 2 : 1);
            const confOkay = (picked.top.avgConfidence || 0) >= (strict ? 42 : 32) && (picked.bottom.avgConfidence || 0) >= (strict ? 42 : 32);
            return exact && votesOkay && confOkay && picked.confidence >= (strict ? 72 : 66);
        };

        const isDirectLockFastReliable = (picked) => {
            if (!lockedBottomValue || !picked.period || !picked.top || !picked.bottom) return false;
            if (picked.bottom.value !== lockedBottomValue) return false;
            if (picked.top.correction !== 0 || picked.bottom.correction !== 0) return false;
            if (!/^20\d{7}$/.test(picked.top.value || '')) return false;
            return (
                (picked.top.avgConfidence || 0) >= 72 &&
                (marker.confidence || 0) >= 64 &&
                picked.confidence >= 68
            );
        };

        const directLockResult = await runDirectMarkerBottomLock();
        if (directLockResult && directLockResult.fastPicked) {
            return makeReturn(directLockResult.fastPicked);
        }

        // TURBO FAST PATH: dua pass direct-marker sudah membaca dua baris.
        // Bila 10 digit bawah terkunci dan 9 digit atas juga sepakat kuat,
        // langsung selesai tanpa OCR crop baris atas tambahan.
        let directFast = chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
        if (
            lockedBottomValue &&
            directFast.top &&
            directFast.top.votes >= 2 &&
            isDirectLockFastReliable(directFast)
        ) {
            return makeReturn(directFast);
        }

        for (let rectIndex = 0; rectIndex < rects.length; rectIndex++) {
            const rect = rects[rectIndex];
            const cropped = cropCanvas(sourceCanvas, rect);
            const lineRects = findTwoLineRects(cropped);
            const topLine = cropCanvas(cropped, lineRects[0]);
            const bottomLine = cropCanvas(cropped, lineRects[1]);

            // FAST PATH PATEN:
            // - Bila 10 digit bawah sudah dikunci langsung dari marker, OCR bawah tidak diulang.
            // - Hasil sangat jelas berhenti cepat; hasil ragu tetap masuk seluruh fallback lama.
            await runLine(topLine, 'top', 'soft', rect.name + '/atas', 1.90);
            if (!lockedBottomValue) {
                await runLine(bottomLine, 'bottom', 'soft', rect.name + '/bawah', 2.00);
            }
            await runTightBottomConsensus(bottomLine, rect.name + '/bawah-10-digit');
            let current = chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
            current = applyAmbiguousDigitGeometry(bottomLine, current, rect.name + '/soft');

            if (isDirectLockFastReliable(current)) {
                return makeReturn(current);
            }

            if (current.period) {
                // Untuk direct lock, konfirmasi kedua cukup membaca crop baris atas yang jauh lebih kecil.
                // Bila belum terkunci direct, cara gabungan lama tetap dipakai.
                if (lockedBottomValue) {
                    await runLine(topLine, 'top', 'otsu', rect.name + '/atas-konfirmasi', 1.70);
                    current = chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
                    current = applyAmbiguousDigitGeometry(bottomLine, current, rect.name + '/top-confirm');
                    if (isReliable(current, true) || isDirectLockFastReliable(current)) {
                        return makeReturn(current);
                    }
                } else {
                    await runCombined(cropped, 'soft', rect.name, 1.45);
                    current = chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
                    current = applyAmbiguousDigitGeometry(bottomLine, current, rect.name + '/combined-soft');
                    if (isReliable(current, true)) return makeReturn(current);
                }
            }

            // FALLBACK TERARAH: hanya baris yang lemah dibaca ulang, bukan semua kombinasi.
            const topWeak = !current.top || current.top.correction > 0 || (current.top.avgConfidence || 0) < 46;
            const bottomWeak = !current.bottom || current.bottom.correction > 0 || (current.bottom.avgConfidence || 0) < 46;
            if (topWeak) await runLine(topLine, 'top', 'otsu', rect.name + '/atas', 1.45);
            if (bottomWeak) await runLine(bottomLine, 'bottom', 'otsu', rect.name + '/bawah', 1.55);

            current = chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
            current = applyAmbiguousDigitGeometry(bottomLine, current, rect.name + '/otsu');
            if (isReliable(current, false)) return makeReturn(current);

            // Adaptive hanya dipakai pada crop utama dan hanya untuk sisi yang masih belum kuat.
            if (rectIndex === 0) {
                const topStillWeak = !current.top || current.top.correction > 0 || current.top.votes < 2;
                const bottomStillWeak = !current.bottom || current.bottom.correction > 0 || current.bottom.votes < 2;
                if (topStillWeak) await runLine(topLine, 'top', 'adaptive', rect.name + '/atas', 1.30);
                if (bottomStillWeak) await runLine(bottomLine, 'bottom', 'adaptive', rect.name + '/bawah', 1.40);
                current = chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
                current = applyAmbiguousDigitGeometry(bottomLine, current, rect.name + '/adaptive');
                if (isReliable(current, false)) return makeReturn(current);
            }

            // Satu konfirmasi Otsu terakhir sebelum pindah ke crop lebih lebar.
            if (!current.period || current.top.votes < 2 || current.bottom.votes < 2) {
                await runCombined(cropped, 'otsu', rect.name, 1.10);
                current = chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
                current = applyAmbiguousDigitGeometry(bottomLine, current, rect.name + '/combined-otsu');
            }
            if (current.period && current.confidence >= 66) return makeReturn(current);

            // Maksimal dua crop cukup; crop ketiga lama sangat mahal dan jarang menambah hasil.
            if (rectIndex >= 1) break;
        }

        return makeReturn(chooseFinalPeriod(topVotes, bottomVotes, usedPasses));
    }

    async function ocrImagePeriod(src, onProgress, workerOverrides) {
        const cacheKey = String(src || '');
        const cachedResult = lcstPeriodResultCache.get(cacheKey);
        if (cachedResult && cachedResult.period) {
            lcstPeriodResultCache.delete(cacheKey);
            lcstPeriodResultCache.set(cacheKey, cachedResult);
            if (onProgress) onProgress('Hasil periode tersedia di cache cepat.');
            return { ...cachedResult, cached: true };
        }

        const overrides = workerOverrides && typeof workerOverrides === 'object'
            ? workerOverrides
            : null;
        const hasOverride = (key) => !!overrides && Object.prototype.hasOwnProperty.call(overrides, key);

        // Mulai semua pekerjaan bersamaan, tetapi PERIODE hanya menunggu image + worker utama.
        const analysisPromise = getImageAnalysis(src);
        const workerPromise = hasOverride('worker')
            ? Promise.resolve(overrides.worker)
            : getSharedOCRWorker(onProgress);
        const metadataWorkerPromise = hasOverride('metadataWorker')
            ? Promise.resolve(overrides.metadataWorker)
            : getMetadataOCRWorker().catch(() => null);
        const timestampWorkerPromise = hasOverride('timestampWorker')
            ? Promise.resolve(overrides.timestampWorker)
            : getTimestampOCRWorker().catch(() => null);

        const [analysis, worker] = await Promise.all([analysisPromise, workerPromise]);
        if (!worker) throw new Error('Worker OCR periode tidak tersedia.');
        const sourceCanvas = analysis.sourceCanvas;
        const marker = analysis.marker;

        if (!marker) {
            return {
                period: '', text: '', confidence: 0, markerFound: false,
                source: 'strict-double-marker-v55',
                error: 'Dua tanda bulat belum terdeteksi. Versi ini sudah menormalkan gambar besar, tetapi marker tetap tidak ditemukan.'
            };
        }

        if (onProgress) {
            onProgress('Marker terkunci ' + marker.confidence + '% • ULTRA FAST membaca periode...');
        }

        // V6.4.3: metadata dimulai SEKARANG, bersamaan dengan OCR periode.
        // Timestamp tidak membutuhkan periode untuk membaca teks nyata pada screenshot;
        // periode hanya fallback bila tanggal benar-benar tidak terbaca.
        const earlyMetadataPromise = (async () => {
            let betInfo = { value: null, belowMin: false };
            let claimTimestamp = null;
            const metadataWorker = await metadataWorkerPromise;
            const timestampWorker = await timestampWorkerPromise;
            if (!metadataWorker) return { betInfo, claimTimestamp };
            try {
                if (timestampWorker && timestampWorker !== metadataWorker) {
                    const meta = await Promise.all([
                        readBetOddsForNotification(sourceCanvas, marker, metadataWorker),
                        readClaimTimestampFromSecondImage(sourceCanvas, marker, timestampWorker, '', '')
                    ]);
                    betInfo = meta[0] || betInfo;
                    claimTimestamp = meta[1] || null;
                } else {
                    // Tetap overlap dengan OCR periode, hanya dua metadata ini yang serial
                    // pada satu helper worker. Primary worker tidak ikut terbebani.
                    betInfo = await readBetOddsForNotification(sourceCanvas, marker, metadataWorker);
                    claimTimestamp = await readClaimTimestampFromSecondImage(
                        sourceCanvas, marker, metadataWorker, '', ''
                    );
                }
            } catch (e) {}
            return { betInfo, claimTimestamp };
        })();

        // Satu pass paling kecil dahulu. Jika gagal, langsung ke fallback PATEN.
        // Stage FAST STRICT 2-pass v6.4.2 sengaja dilewati karena pada gambar sulit
        // justru menambah dua OCR sebelum fallback utama.
        let focused = await lcstQuickPeriodFromLockedMarker(sourceCanvas, marker, worker, onProgress);
        if (!focused || !focused.period) {
            focused = await ocrMarkerLockedCode(sourceCanvas, marker, worker, onProgress);
        }

        // Karena metadata sudah berjalan selama OCR kode, biasanya bagian ini hanya
        // mengambil hasil yang sudah hampir/sepenuhnya selesai, bukan memulai dari nol.
        const earlyMetadata = await earlyMetadataPromise;
        let betInfo = earlyMetadata && earlyMetadata.betInfo
            ? earlyMetadata.betInfo
            : { value: null, belowMin: false };
        let claimTimestamp = earlyMetadata ? (earlyMetadata.claimTimestamp || null) : null;

        // Fallback kompatibilitas: hanya bagian metadata yang belum berhasil.
        if (focused.period && (!betInfo || betInfo.value == null)) {
            betInfo = await readBetOddsForNotification(sourceCanvas, marker, worker);
        }
        if ((!claimTimestamp || !claimTimestamp.hasTime) && lcstLooksLikeTimestampText(focused.text || '')) {
            const parsedFallback = lcstParseImageTimestampText(
                focused.text || '',
                focused.period || '',
                null,
                LCST_HISTORY_DEFAULT_GMT_OFFSET_MINUTES
            );
            if (parsedFallback && parsedFallback.hasTime) claimTimestamp = parsedFallback;
        }
        if (!claimTimestamp || !claimTimestamp.hasTime) {
            const safeTimestamp = await readClaimTimestampFromSecondImage(
                sourceCanvas, marker, worker, focused.period || '', focused.text || ''
            );
            if (safeTimestamp) claimTimestamp = safeTimestamp;
        }

        let finalResult;
        if (!focused.period && LCST_STRICT_DOUBLE_MARKER) {
            const topInfo = focused.debugTop ? ' atas=' + focused.debugTop : '';
            const bottomInfo = focused.debugBottom ? ' bawah=' + focused.debugBottom : '';
            finalResult = {
                period: '', text: focused.text || '', confidence: 0,
                markerFound: true, markerConfidence: marker.confidence, marker,
                preview: focused.preview || '', passes: focused.passes || 0,
                source: 'strict-double-marker-v55',
                error: 'Marker terkunci, tetapi pasangan 9+10 digit belum lengkap.' + topInfo + bottomInfo
            };
        } else {
            finalResult = {
                period: focused.period || '', text: focused.text || '',
                confidence: focused.confidence || 0,
                markerFound: true, markerConfidence: marker.confidence, marker,
                preview: focused.preview || '', passes: focused.passes || 0,
                source: focused.ultraFast
                    ? 'ultra-scan-direct-v643'
                    : 'double-marker-row-lock-v45',
                error: focused.period ? '' : 'Kode belum terbaca.'
            };
        }

        finalResult.betOdds = betInfo ? betInfo.value : null;
        finalResult.betBelowMin = !!(betInfo && betInfo.belowMin);
        finalResult.claimTimestamp = claimTimestamp || null;
        finalResult.claimTimestampText = claimTimestamp ? lcstFormatClaimTimestamp(claimTimestamp) : '';

        if (finalResult.period) {
            lcstPeriodResultCache.set(cacheKey, finalResult);
            trimFastCache(lcstPeriodResultCache, LCST_RESULT_CACHE_LIMIT);
        }
        return finalResult;
    }

    function openTool() {
        injectStyle();
        const old = document.getElementById('lcst-panel-fixed');
        if (old) old.remove();

        const scan = scanPage();
        const db = getAccountDB();
        const scanUid = lcstValidLookupUserId(scan.userId);
        const savedKey = Object.keys(db || {}).find(key => String(key).toLowerCase() === scanUid.toLowerCase());
        const savedRaw = savedKey ? db[savedKey] : null;
        const savedFresh = !!(savedRaw && Number(savedRaw.updatedAt) > 0 &&
            Date.now() - Number(savedRaw.updatedAt) < LCST_ADMIN_LOCAL_DB_TTL);
        const saved = savedFresh ? savedRaw : { nama: '', rek: '' };
        const defaultNama = lcstCleanAccountName(saved.nama) || 'NAMA USER';
        const defaultRek = lcstCleanAccountNumber(saved.rek) || 'NO REKENING';
        const initialSetCount = Math.max(1, Math.ceil((scan.images || []).length / getPackageSizeFromImages(scan.images || [])));

        function placeholderForRow(row) {
            const meta = scan.ocrMeta && scan.ocrMeta[row];
            if (meta && meta.error) return '';
            return 'MENUNGGU OCR ' + (row + 1);
        }

        function buildPeriodInputsHTML(count, values) {
            values = values || {};
            let html = '';
            for (let i = 0; i < count; i++) {
                const val = values[i] || (scan.ocrPeriods && scan.ocrPeriods[i]) || placeholderForRow(i);
                const hasError = scan.ocrMeta && scan.ocrMeta[i] && scan.ocrMeta[i].error && !(scan.ocrPeriods && scan.ocrPeriods[i]);
                const inputPlaceholder = hasError ? 'OCR BELUM BERHASIL - KLIK SCAN DISINI ULANG' : ('Periode Paket ' + (i + 1));
                html += '<input class="lcst-input lcst-period-input" id="lcst-prd-' + i + '" data-lcst-period-row="' + i + '" placeholder="' + cssEscapeText(inputPlaceholder) + '" value="' + cssEscapeText(val) + '"' + (hasError ? ' style="border-color:rgba(251,79,104,.45);color:#ffb7c5"' : '') + '>';
            }
            return html || '<input class="lcst-input lcst-period-input" id="lcst-prd-0" data-lcst-period-row="0" placeholder="Periode Paket 1" value="MENUNGGU OCR 1">';
        }

        const panel = document.createElement('div');
        panel.id = 'lcst-panel-fixed';
        panel.innerHTML = `
            <div class="lcst-wrap lcst-nova-shell">
                <header class="lcst-topbar lcst-nova-topbar">
                    <div class="lcst-brand">
                        <div class="lcst-brand-logo lcst-nova-logo" aria-hidden="true">
                            <span class="lcst-header-logo-fallback">LT</span>
                            <img id="lcst-header-logo-img" alt="" aria-hidden="true" decoding="async">
                        </div>
                        <div class="lcst-nova-brand-copy">
                            <div class="lcst-nova-eyebrow">LINETOGEL BRIGHT RUBY EDITION</div>
                            <h3 class="lcst-title">Scan Studio Bright <span class="lcst-version">5.7.7</span></h3>
                            <div class="lcst-subtitle">Tampilan terang • User ID LiveChat → nama pemilik & nomor rekening otomatis</div>
                        </div>
                    </div>
                    <div class="lcst-nova-top-actions">
                        <div class="lcst-nova-live-chip"><span></span> SYSTEM READY</div>
                        <button class="lcst-btn red lcst-nova-close" id="lcst-close" type="button">TUTUP <b>×</b></button>
                    </div>
                </header>

                <section class="lcst-nova-hero">
                    <div class="lcst-status-card lcst-nova-status" id="lcst-status-card">
                        <div class="lcst-status-icon lcst-nova-status-icon">
                            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                                <path d="M7 12V8a1 1 0 0 1 1-1h4M20 7h4a1 1 0 0 1 1 1v4M25 20v4a1 1 0 0 1-1 1h-4M12 25H8a1 1 0 0 1-1-1v-4"/>
                                <path d="M10 16h12"/><circle cx="13" cy="13" r="1"/><circle cx="19" cy="13" r="1"/>
                            </svg>
                        </div>
                        <div class="lcst-status-content">
                            <div class="lcst-status-title">Aktivitas Pemindaian</div>
                            <div class="lcst-ocr-box" id="lcst-ocr-status">Menyiapkan pemindaian chat aktif...</div>
                        </div>
                        <div class="lcst-progress"><span id="lcst-progress-bar"></span></div>
                    </div>
                    <div class="lcst-nova-identity">
                        <div class="lcst-nova-stat ${scan.marker ? 'ok' : 'bad'}">
                            <span class="lcst-nova-stat-label">CHAT MARKER</span>
                            <strong id="lcst-marker-text">${cssEscapeText(scan.markerText)}</strong>
                        </div>
                        <div class="lcst-nova-stat user">
                            <span class="lcst-nova-stat-label">USER ID</span>
                            <div class="lcst-nova-user-line">
                                <input class="lcst-user-edit" id="lcst-user-text" type="text" value="${cssEscapeText(scan.userId)}" autocomplete="off" spellcheck="false" aria-label="Edit User ID">
                                <button class="lcst-inline-copy" id="lcst-copy-user" type="button" title="Copy User ID" aria-label="Copy User ID">
                                    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 7V5.75A2.75 2.75 0 0 1 10.75 3h7.5A2.75 2.75 0 0 1 21 5.75v7.5A2.75 2.75 0 0 1 18.25 16H17v1.25A2.75 2.75 0 0 1 14.25 20h-7.5A2.75 2.75 0 0 1 4 17.25v-7.5A2.75 2.75 0 0 1 6.75 7H8Zm2 0h4.25A2.75 2.75 0 0 1 17 9.75V14h1.25c.414 0 .75-.336.75-.75v-7.5a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0-.75.75V7Zm-3.25 2a.75.75 0 0 0-.75.75v7.5c0 .414.336.75.75.75h7.5a.75.75 0 0 0 .75-.75v-7.5a.75.75 0 0 0-.75-.75h-7.5Z"/></svg>
                                </button>
                            </div>
                            ${scan.allIds.length > 1 ? `<small>${scan.allIds.length} ID ditemukan • memakai ID terakhir</small>` : '<small>ID chat aktif terdeteksi</small>'}
                        </div>
                        <div class="lcst-nova-stat mode">
                            <span class="lcst-nova-stat-label">OCR MODE</span>
                            <strong>ROW LOCK 9+10</strong>
                            <small>Turbo OCR • periode + waktu dari gambar ke-2</small>
                        </div>
                        <div class="lcst-nova-stat live">
                            <span class="lcst-nova-stat-label">WAKTU ONLINE WIB</span>
                            <strong id="lcst-live-time">${cssEscapeText(lcstFormatCurrentWib(lcstNowDate()))}</strong>
                            <small>Patokan WIB sekarang • sinkron online otomatis • deadline 02.00 WIB</small>
                        </div>
                    </div>
                </section>

                <div class="lcst-nova-workspace">
                    <aside class="lcst-nova-sidebar">
                        <section class="lcst-card lcst-nova-control-card">
                            <div class="lcst-nova-section-head lcst-bank-head">
                                <div class="lcst-bank-head-main">
                                    <span class="lcst-nova-step">01</span>
                                    <div><b>Data Rekening Otomatis</b><small>Diambil dari admin sesuai User ID LiveChat</small></div>
                                </div>
                                <button class="lcst-btn lcst-bank-refresh" id="lcst-bank-refresh" type="button">↻ AMBIL REKENING</button>
                            </div>
                            <input class="lcst-input" id="lcst-rek-all" placeholder="Nama, Nomor Rekening" value="${cssEscapeText(defaultNama + ',' + defaultRek)}">
                            <div class="lcst-scan-state lcst-account-scan-state lcst-bank-lookup-state waiting" id="lcst-bank-state" aria-live="polite">
                                <span class="lcst-scan-state-dot"></span>
                                <span class="lcst-scan-state-copy">
                                    <span class="lcst-scan-state-label">REKENING OTOMATIS</span>
                                    <strong class="lcst-scan-state-text" id="lcst-bank-state-text">MENUNGGU USER ID</strong>
                                    <span class="lcst-scan-state-detail" id="lcst-bank-state-detail">Nama pemilik dan nomor rekening dicari otomatis dari halaman admin</span>
                                </span>
                            </div>
                            <div class="lcst-scan-state lcst-account-scan-state waiting" id="lcst-scan-state" aria-live="polite">
                                <span class="lcst-scan-state-dot"></span>
                                <span class="lcst-scan-state-copy">
                                    <span class="lcst-scan-state-label">STATUS SCAN</span>
                                    <strong class="lcst-scan-state-text" id="lcst-scan-state-text">MENUNGGU SCAN</strong>
                                    <span class="lcst-scan-state-detail" id="lcst-scan-state-detail">Menunggu susunan otomatis</span>
                                </span>
                            </div>
                        </section>

                        <section class="lcst-card lcst-nova-control-card">
                            <div class="lcst-nova-section-head orange">
                                <span class="lcst-nova-step">02</span>
                                <div><b>Hasil Periode</b><small>OCR otomatis atau koreksi manual</small></div>
                            </div>
                            <div id="lcst-period-fields">${buildPeriodInputsHTML(initialSetCount)}</div>
                        </section>

                        <section class="lcst-card lcst-nova-guide">
                            <div class="lcst-nova-guide-title">PANDUAN CEPAT</div>
                            <div class="lcst-nova-guide-row"><span>↕</span><div><b>Susun otomatis</b><small>Permainan → Riwayat → Kemenangan Total</small></div></div>
                            <div class="lcst-nova-guide-row"><span>◎</span><div><b>Target OCR</b><small>Gambar ke-2/5: periode, tanggal, jam • dinormalisasi ke GMT+7</small></div></div>
                            <div class="lcst-nova-guide-row"><span>⌫</span><div><b>Hapus gambar</b><small>Shift + klik atau tombol hapus</small></div></div>
                        </section>
                    </aside>

                    <main class="lcst-nova-main">
                        <section class="lcst-card lcst-nova-gallery-card">
                            <div class="lcst-nova-gallery-head">
                                <div>
                                    <span class="lcst-nova-kicker">WORKSPACE</span>
                                    <h4>Susunan Screenshot</h4>
                                    <p>Screenshot otomatis disusun; Riwayat Permainan menjadi target OCR periode, tanggal, dan jam claim.</p>
                                </div>
                                <button class="lcst-btn primary lcst-nova-scan-btn" id="lcst-ocr-period" type="button">
                                    <span class="lcst-nova-btn-icon">⌁</span>
                                    <span><b>SCAN PERIODE</b><small>Turbo OCR siap</small></span>
                                </button>
                            </div>
                            <div id="lcst-empty-box" class="lcst-empty" style="display:${scan.images.length ? 'none' : 'block'}">
                                <div class="lcst-nova-empty-icon">▧</div>
                                <b>Belum ada screenshot pada chat aktif</b>
                                <span>Pastikan chat yang benar terbuka, lalu tutup dan buka kembali panel OCR.</span>
                            </div>
                            <div id="lcst-image-grid"></div>
                        </section>

                        <section class="lcst-card lcst-nova-output-card">
                            <div class="lcst-output-head">
                                <div>
                                    <span class="lcst-nova-kicker">READY TO PASTE</span>
                                    <h4>Output Excel 7 Kolom</h4>
                                    <p>User ID • Gambar 1 • Gambar 2 • Gambar 3 • Rekening • Nama • Periode</p>
                                </div>
                                <button class="lcst-btn green lcst-copy-btn" id="lcst-copy" type="button" title="Salin output saat ini">COPY OUTPUT</button>
                            </div>
                            <textarea id="lcst-output" readonly spellcheck="false" aria-label="Output yang dapat disalin"></textarea>
                        </section>
                    </main>
                </div>
            </div>
        `;

        const dashboardBrand = document.createElement('div');
        dashboardBrand.id = 'lcst-dashboard-brand-bg';
        dashboardBrand.setAttribute('aria-hidden', 'true');

        const dashboardLogo = document.createElement('img');
        dashboardLogo.id = 'lcst-dashboard-logo-bg';
        dashboardLogo.alt = '';
        dashboardLogo.setAttribute('aria-hidden', 'true');
        dashboardLogo.decoding = 'async';

        const dashboardFallback = document.createElement('div');
        dashboardFallback.id = 'lcst-dashboard-logo-fallback';
        dashboardFallback.innerHTML = 'LINETOGEL<small>BRIGHT RUBY EDITION</small>';

        dashboardLogo.addEventListener('load', function () {
            panel.classList.add('lcst-dashboard-logo-loaded');
            panel.classList.remove('lcst-dashboard-logo-error');
        });
        dashboardLogo.addEventListener('error', function () {
            panel.classList.remove('lcst-dashboard-logo-loaded');
            panel.classList.add('lcst-dashboard-logo-error');
        });

        dashboardBrand.appendChild(dashboardFallback);
        dashboardBrand.appendChild(dashboardLogo);
        panel.prepend(dashboardBrand);
        document.body.appendChild(panel);
        lcstApplyDashboardLogo(dashboardLogo);

        const headerLogo = panel.querySelector('#lcst-header-logo-img');
        if (headerLogo) {
            headerLogo.addEventListener('load', function () {
                panel.classList.add('lcst-header-logo-loaded');
                panel.classList.remove('lcst-header-logo-error');
            });
            headerLogo.addEventListener('error', function () {
                panel.classList.remove('lcst-header-logo-loaded');
                panel.classList.add('lcst-header-logo-error');
            });
            lcstApplyDashboardLogo(headerLogo);
        }

        scan.ocrPeriods = scan.ocrPeriods || [];
        scan.ocrTexts = scan.ocrTexts || [];
        scan.ocrMeta = scan.ocrMeta || [];
        scan.betOddsByRow = scan.betOddsByRow || [];
        scan.betBelowMinRows = scan.betBelowMinRows || [];
        scan.claimExpiredRows = scan.claimExpiredRows || [];
        scan.claimDeadlineByRow = scan.claimDeadlineByRow || [];
        scan.claimTimestampByRow = scan.claimTimestampByRow || [];
        const state = {
            scan,
            dragIdx: -1,
            zoomScale: 1,
            zoomX: 0,
            zoomY: 0,
            ocrRunning: false,
            scanRunning: false,
            closed: false,
            pendingStatus: null,
            statusTimer: null,
            lastStatusAt: 0,
            bankLookupSeq: 0,
            bankLookupRunning: false,
            bankLookupUserId: '',
            dragCard: null,
            dragOverCard: null,
            pendingDragOverCard: null,
            dragFrame: 0,
            arrangePrefetchTimer: null,
            arrangePrefetchIdle: null,
            autoArrangeRunning: false,
            autoArrangeSeq: 0,
            claimDeadlineTimer: null,
            claimExpiredNotified: new Set(),
            dragGhost: null,
            sheetSending: false,
            lastSheetResult: null
        };

        // Drag image transparan 1px yang benar-benar terpasang di DOM.
        // Ini mencegah Chromium membuat preview screenshot besar saat kartu dipindahkan.
        state.dragGhost = document.createElement('canvas');
        state.dragGhost.width = 1;
        state.dragGhost.height = 1;
        state.dragGhost.setAttribute('aria-hidden', 'true');
        state.dragGhost.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;pointer-events:none;z-index:-1';
        panel.appendChild(state.dragGhost);

        function hasDashboardSelection() {
            try {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
                const node = sel.anchorNode || sel.focusNode;
                return !!(node && panel.contains(node));
            } catch (e) {
                return false;
            }
        }

        function getPackageCount() {
            return Math.max(1, Math.ceil((state.scan.images || []).length / getPackageSizeFromImages(state.scan.images || [])));
        }

        function closePanel() {
            if (state.closed) return;
            state.closed = true;
            const z = document.getElementById('lcst-zoom');
            if (z) z.remove();
            document.removeEventListener('keydown', escClose, true);
            document.removeEventListener('selectionchange', flushPendingStatusWhenPossible, true);
            if (state.statusTimer) { clearTimeout(state.statusTimer); state.statusTimer = null; }
            if (state.dragFrame) { cancelAnimationFrame(state.dragFrame); state.dragFrame = 0; }
            if (state.arrangePrefetchTimer) { clearTimeout(state.arrangePrefetchTimer); state.arrangePrefetchTimer = null; }
            if (state.arrangePrefetchIdle && typeof cancelIdleCallback === 'function') {
                try { cancelIdleCallback(state.arrangePrefetchIdle); } catch (e) {}
                state.arrangePrefetchIdle = null;
            }
            if (state.claimDeadlineTimer) {
                clearInterval(state.claimDeadlineTimer);
                state.claimDeadlineTimer = null;
            }
            destroySharedOCRWorker().catch(() => {});
            panel.remove();
        }

        function getBlockedBetRows() {
            const blocked = state.scan.betBelowMinRows || [];
            const count = Math.ceil((state.scan.images || []).length / getPackageSizeFromImages(state.scan.images || []));
            const rows = [];
            for (let i = 0; i < count; i++) {
                if (blocked[i]) rows.push(i);
            }
            return rows;
        }

        function getBlockedClaimRows() {
            const blocked = state.scan.claimExpiredRows || [];
            const count = Math.ceil((state.scan.images || []).length / getPackageSizeFromImages(state.scan.images || []));
            const rows = [];
            for (let i = 0; i < count; i++) {
                if (blocked[i]) rows.push(i);
            }
            return rows;
        }

        function updateCopyAvailability() {
            const copyBtn = panel.querySelector('#lcst-copy');
            if (!copyBtn) return;

            // makeOutput juga menyegarkan status batas claim berdasarkan waktu WIB saat ini.
            const output = makeOutput(state.scan).trim();
            const betBlockedRows = getBlockedBetRows();
            const claimBlockedRows = getBlockedClaimRows();
            const allRowsBlocked = (betBlockedRows.length > 0 || claimBlockedRows.length > 0) && !output;

            // Jika claim kedaluwarsa, tombol tetap dapat diklik agar notifikasi batas waktu muncul.
            // Handler COPY tetap menghentikan proses sehingga data kedaluwarsa tidak tersalin.
            copyBtn.disabled = allRowsBlocked && claimBlockedRows.length === 0;
            copyBtn.title = allRowsBlocked
                ? (claimBlockedRows.length
                    ? 'Klik untuk melihat notifikasi: waktu gambar ke-2 sudah melewati deadline 02.00 WIB'
                    : 'Tidak dapat dicopy: semua paket memiliki Taruhan di bawah 1,60')
                : (claimBlockedRows.length
                    ? 'Paket dengan waktu gambar ke-2 yang melewati deadline 02.00 WIB otomatis tidak ikut dicopy'
                    : (betBlockedRows.length
                        ? 'Paket di bawah 1,60 otomatis tidak ikut dicopy'
                        : 'Salin output saat ini'));
        }

        function updateOutput() {
            const out = panel.querySelector('#lcst-output');
            if (out) out.value = makeOutput(state.scan);
            const empty = panel.querySelector('#lcst-empty-box');
            if (empty) empty.style.display = state.scan.images.length ? 'none' : 'block';
            updateCopyAvailability();
        }

        function setProgress(percent) {
            const bar = panel.querySelector('#lcst-progress-bar');
            if (bar) bar.style.width = Math.max(0, Math.min(100, Number(percent) || 0)) + '%';
        }

        function updateLiveTimeDisplay() {
            const liveEl = panel.querySelector('#lcst-live-time');
            const currentText = lcstFormatCurrentWib(lcstNowDate());
            const sourceText = lcstGetOnlineTimeSourceLabel();
            if (liveEl) liveEl.textContent = currentText + ' • ' + sourceText;
            const detailEl = panel.querySelector('#lcst-scan-state-detail');
            if (detailEl) {
                const baseDetail = detailEl.getAttribute('data-base-detail') || '';
                const onlineNow = 'WIB sekarang ' + currentText + ' (' + sourceText + ')';
                detailEl.textContent = baseDetail ? (baseDetail + ' • ' + onlineNow) : onlineNow;
            }
        }

        function setScanState(type, textValue, detailValue) {
            const box = panel.querySelector('#lcst-scan-state');
            const textEl = panel.querySelector('#lcst-scan-state-text');
            const detailEl = panel.querySelector('#lcst-scan-state-detail');
            if (!box || !textEl || !detailEl || state.closed) return;

            const allowed = ['waiting', 'scanning', 'success', 'partial', 'failed'];
            const safeType = allowed.includes(type) ? type : 'waiting';
            box.className = 'lcst-scan-state ' + safeType;
            textEl.textContent = textValue || 'MENUNGGU SCAN';
            detailEl.setAttribute('data-base-detail', detailValue || '');
            updateLiveTimeDisplay();
        }


        function showTidakCapaiNotification(row, odds) {
            const old = panel.querySelector('#lcst-tidak-capai-only');
            if (old) old.remove();

            const overlay = document.createElement('div');
            overlay.id = 'lcst-tidak-capai-only';
            overlay.setAttribute('role', 'alert');
            overlay.setAttribute('aria-live', 'assertive');
            overlay.style.cssText = [
                'position:fixed',
                'inset:0',
                'z-index:2147483647',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'padding:24px',
                'background:rgba(69,10,10,.58)',
                'backdrop-filter:blur(8px)',
                'pointer-events:none'
            ].join(';');

            const value = Number(odds);
            const oddsText = Number.isFinite(value) ? value.toFixed(2).replace('.', ',') : '-';
            overlay.innerHTML =
                '<div style="width:min(760px,94vw);padding:34px 28px;border-radius:26px;' +
                'border:4px solid #ef4444;background:linear-gradient(145deg,#fff 0%,#fff1f2 100%);' +
                'color:#7f1d1d;text-align:center;box-shadow:0 30px 100px rgba(0,0,0,.55),0 0 55px rgba(239,68,68,.50);' +
                'font-family:Inter,Segoe UI,Arial,sans-serif">' +
                    '<div style="font-size:22px;font-weight:1000;letter-spacing:5px;color:#dc2626;margin-bottom:6px">DANGER</div>' +
                    '<div style="font-size:clamp(30px,5vw,58px);line-height:1.05;font-weight:1000;color:#991b1b;text-shadow:0 2px 0 #fff">TIDAK MENCAPI BET</div>' +
                    '<div style="width:120px;height:5px;margin:20px auto;border-radius:999px;background:#ef4444;box-shadow:0 0 18px rgba(239,68,68,.65)"></div>' +
                    '<div style="font-size:18px;font-weight:1000">PAKET ' + (row + 1) + ' • TARUHAN ' + cssEscapeText(oddsText) + '</div>' +
                    '<div style="margin-top:8px;font-size:15px;font-weight:900;color:#b91c1c">DI BAWAH 1,60 • DATA PAKET INI TIDAK DAPAT DI-COPY</div>' +
                '</div>';

            panel.appendChild(overlay);
            setTimeout(() => {
                if (overlay.isConnected) overlay.remove();
            }, 7500);
        }

        function showManualScanNotification(failedRows) {
            const old = panel.querySelector('#lcst-manual-scan-only');
            if (old) old.remove();

            const rows = Array.isArray(failedRows)
                ? failedRows.filter((row) => Number.isInteger(row) && row >= 0)
                : [];
            const packageText = rows.length
                ? 'PAKET ' + rows.map((row) => row + 1).join(', ')
                : 'KODE TIDAK DITEMUKAN';

            const overlay = document.createElement('div');
            overlay.id = 'lcst-manual-scan-only';
            overlay.setAttribute('role', 'alert');
            overlay.setAttribute('aria-live', 'assertive');
            overlay.style.cssText = [
                'position:fixed',
                'inset:0',
                'z-index:2147483647',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'padding:24px',
                'background:rgba(55,30,4,.62)',
                'backdrop-filter:blur(8px)',
                'pointer-events:none'
            ].join(';');

            overlay.innerHTML =
                '<div style="width:min(780px,94vw);padding:36px 28px;border-radius:26px;' +
                'border:4px solid #f59e0b;background:linear-gradient(145deg,#fff 0%,#fffbeb 100%);' +
                'color:#78350f;text-align:center;box-shadow:0 30px 100px rgba(0,0,0,.58),0 0 55px rgba(245,158,11,.48);' +
                'font-family:Inter,Segoe UI,Arial,sans-serif">' +
                    '<div style="font-size:21px;font-weight:1000;letter-spacing:4px;color:#d97706;margin-bottom:8px">SCAN TIDAK DITEMUKAN</div>' +
                    '<div style="font-size:clamp(30px,5vw,56px);line-height:1.08;font-weight:1000;color:#92400e">SILAKAN CATAT MANUAL YA</div>' +
                    '<div style="width:130px;height:5px;margin:20px auto;border-radius:999px;background:#f59e0b;box-shadow:0 0 18px rgba(245,158,11,.65)"></div>' +
                    '<div style="font-size:18px;font-weight:1000;color:#b45309">' + cssEscapeText(packageText) + '</div>' +
                    '<div style="margin-top:8px;font-size:15px;font-weight:900;color:#92400e">Periksa kode pada gambar lalu isi kolom periode secara manual.</div>' +
                '</div>';

            panel.appendChild(overlay);
            setTimeout(() => {
                if (overlay.isConnected) overlay.remove();
            }, 8000);
        }

        function showClaimExpiredNotification(row, claimStatus) {
            if (state.claimExpiredNotified) state.claimExpiredNotified.add(row);
            const old = panel.querySelector('#lcst-claim-expired-only');
            if (old) old.remove();

            const status = claimStatus || (state.scan.claimDeadlineByRow && state.scan.claimDeadlineByRow[row]) || {};
            const imageTimeText = lcstFormatClaimTimestamp(status.imageTimestamp || status.claimDate);
            const deadlineText = lcstFormatClaimDeadline(status);

            // Notifikasi claim dibuat kecil/compact agar tidak menutupi layar.
            const toast = document.createElement('div');
            toast.id = 'lcst-claim-expired-only';
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.style.cssText = [
                'position:fixed',
                'top:18px',
                'right:18px',
                'z-index:2147483647',
                'width:min(340px,calc(100vw - 36px))',
                'padding:14px 16px',
                'border:2px solid #dc2626',
                'border-radius:14px',
                'background:#fff',
                'color:#7f1d1d',
                'box-shadow:0 10px 30px rgba(0,0,0,.22)',
                'font-family:Inter,Segoe UI,Arial,sans-serif',
                'pointer-events:none'
            ].join(';');

            toast.innerHTML =
                '<div style="font-size:16px;line-height:1.15;font-weight:1000;color:#b91c1c">TIDAK DAPAT CLAIM</div>' +
                '<div style="margin-top:5px;font-size:13px;line-height:1.35;font-weight:900;color:#7f1d1d">PAKET ' + (row + 1) + ' • transaksi ' + cssEscapeText(imageTimeText) + ' WIB</div>' +
                '<div style="margin-top:4px;font-size:12px;line-height:1.35;font-weight:800;color:#991b1b">Sudah melewati batas claim: ' + cssEscapeText(deadlineText) + '.</div>';

            panel.appendChild(toast);
            setTimeout(() => {
                if (toast.isConnected) toast.remove();
            }, 4500);
        }

        function setBankState(type, textValue, detailValue) {
            const box = panel.querySelector('#lcst-bank-state');
            const textEl = panel.querySelector('#lcst-bank-state-text');
            const detailEl = panel.querySelector('#lcst-bank-state-detail');
            if (!box || !textEl || !detailEl || state.closed) return;
            const allowed = ['waiting', 'scanning', 'success', 'partial', 'failed'];
            const safeType = allowed.includes(type) ? type : 'waiting';
            box.className = 'lcst-scan-state lcst-account-scan-state lcst-bank-lookup-state ' + safeType;
            textEl.textContent = textValue || 'MENUNGGU USER ID';
            detailEl.textContent = detailValue || '';
        }

        async function fillAccountFromAdmin(userId, forceRefresh) {
            const uid = lcstValidLookupUserId(userId);
            const refreshBtn = panel.querySelector('#lcst-bank-refresh');
            if (!uid) {
                setBankState('waiting', 'USER ID BELUM TERDETEKSI', 'Isi atau tampilkan USER ID pada chat aktif');
                return;
            }

            // V6.4.2: cache lokal hanya dianggap final bila masih baru. Entry versi lama
            // tanpa updatedAt otomatis diverifikasi ke Admin agar data yang pernah salah/stale
            // tidak dipakai selamanya.
            if (!forceRefresh) {
                try {
                    const dbNow = getAccountDB();
                    const exactKey = Object.keys(dbNow || {}).find(k => String(k).toLowerCase() === uid.toLowerCase());
                    const saved = exactKey ? dbNow[exactKey] : null;
                    const savedName = lcstCleanAccountName(saved && saved.nama);
                    const savedRek = lcstCleanAccountNumber(saved && saved.rek);
                    const savedAt = Number(saved && saved.updatedAt) || 0;
                    const cacheFresh = savedAt > 0 && Date.now() - savedAt < LCST_ADMIN_LOCAL_DB_TTL;
                    if (savedName && savedRek && cacheFresh) {
                        const input = panel.querySelector('#lcst-rek-all');
                        if (input) input.value = savedName + ',' + savedRek;
                        lcstBankMemoryCache.set(uid.toLowerCase(), {
                            time: savedAt,
                            value: { nama: savedName, rek: savedRek, userId: uid, source: 'local-db-fresh' }
                        });
                        updateOutput();
                        setBankState('success', 'DATA REKENING TERISI', savedName + ' • ' + savedRek + ' • cache terverifikasi');
                        return;
                    }
                } catch (e) {}
            }

            if (state.bankLookupRunning && !forceRefresh && state.bankLookupUserId.toLowerCase() === uid.toLowerCase()) return;
            const sequence = ++state.bankLookupSeq;
            state.bankLookupRunning = true;
            state.bankLookupUserId = uid;
            if (refreshBtn) refreshBtn.disabled = true;
            setBankState('scanning', 'MENCARI DATA REKENING', 'Exact User ID: ' + uid + ' • jalur Admin tercepat');

            try {
                const bank = await lcstLookupBankFromAdmin(uid, !!forceRefresh);
                if (state.closed || sequence !== state.bankLookupSeq) return;

                const accountName = lcstCleanAccountName(bank.nama);
                const accountNumber = lcstCleanAccountNumber(bank.rek);
                if (!accountName || !accountNumber) {
                    throw lcstCreateLookupError('BANK_NOT_FOUND', 'Nama pemilik atau nomor rekening tidak valid.');
                }
                const input = panel.querySelector('#lcst-rek-all');
                if (input) input.value = accountName + ',' + accountNumber;
                const dbNow = getAccountDB();
                dbNow[uid] = {
                    nama: accountName,
                    rek: accountNumber,
                    updatedAt: Date.now(),
                    source: 'admin-exact-user'
                };
                setAccountDB(dbNow);
                updateOutput();
                setBankState('success', 'DATA REKENING TERISI', accountName + ' • ' + accountNumber);
            } catch (err) {
                if (state.closed || sequence !== state.bankLookupSeq) return;
                const code = err && err.code ? err.code : '';
                if (code === 'ADMIN_LOGIN_REQUIRED') {
                    setBankState('failed', 'LOGIN ADMIN DIPERLUKAN', 'Login dahulu ke halaman admin pada browser yang sama');
                } else if (code === 'BANK_NOT_FOUND') {
                    setBankState('partial', 'DATA REKENING TIDAK DITEMUKAN', 'User ID ' + uid + ' tidak ditemukan atau data rekening kosong');
                } else if (code === 'NO_USER_ID') {
                    setBankState('waiting', 'USER ID BELUM TERDETEKSI', 'Pastikan member mengisi USER ID di chat aktif');
                } else {
                    setBankState('failed', 'GAGAL MENGAMBIL REKENING', err && err.message ? err.message : 'Terjadi kesalahan pada halaman admin');
                }
            } finally {
                if (sequence === state.bankLookupSeq) {
                    state.bankLookupRunning = false;
                    if (refreshBtn) refreshBtn.disabled = false;
                }
            }
        }

        function applyPendingStatus(force) {
            if (!state.pendingStatus || state.closed) return;
            if (!force && hasDashboardSelection()) return;
            const box = panel.querySelector('#lcst-ocr-status');
            if (!box) return;
            box.innerHTML = state.pendingStatus.msg;
            if (state.pendingStatus.progress != null) setProgress(state.pendingStatus.progress);
            state.pendingStatus = null;
            state.lastStatusAt = Date.now();
        }

        function flushPendingStatusWhenPossible() {
            if (!hasDashboardSelection()) applyPendingStatus(true);
        }

        function setOcrStatus(msg, progress, force) {
            state.pendingStatus = { msg: String(msg == null ? '' : msg), progress };

            if (force) {
                if (state.statusTimer) { clearTimeout(state.statusTimer); state.statusTimer = null; }
                applyPendingStatus(true);
                return;
            }

            // Jangan mengganti isi status ketika pengguna sedang menyeleksi teks untuk dicopy.
            if (hasDashboardSelection()) return;

            const wait = Math.max(0, 90 - (Date.now() - state.lastStatusAt));
            if (state.statusTimer) clearTimeout(state.statusTimer);
            state.statusTimer = setTimeout(() => {
                state.statusTimer = null;
                applyPendingStatus(false);
            }, wait);
        }

        function collectPeriodInputValues() {
            const values = {};
            panel.querySelectorAll('[data-lcst-period-row]').forEach((input) => {
                const row = parseInt(input.getAttribute('data-lcst-period-row') || '0', 10);
                values[row] = input.value || '';
            });
            return values;
        }

        function renderPeriodInputs(preserveValues) {
            const box = panel.querySelector('#lcst-period-fields');
            if (!box) return;
            const values = preserveValues ? collectPeriodInputValues() : {};
            box.innerHTML = buildPeriodInputsHTML(getPackageCount(), values);
            box.querySelectorAll('[data-lcst-period-row]').forEach((input) => {
                input.addEventListener('input', () => {
                    updateOutput();
                    updateClaimPeriodInputState(input);
                });
                updateClaimPeriodInputState(input);
            });
        }

        function updateClaimPeriodInputState(input) {
            if (!input) return;
            const row = parseInt(input.getAttribute('data-lcst-period-row') || '0', 10);
            const imageTimestamp = state.scan.claimTimestampByRow && state.scan.claimTimestampByRow[row]
                ? state.scan.claimTimestampByRow[row]
                : null;
            const status = lcstCheckClaimDeadline(imageTimestamp, input.value);
            state.scan.claimExpiredRows = state.scan.claimExpiredRows || [];
            state.scan.claimDeadlineByRow = state.scan.claimDeadlineByRow || [];
            state.scan.claimExpiredRows[row] = !!status.expired;
            state.scan.claimDeadlineByRow[row] = status;
            input.title = status.expired
                ? 'Tidak dapat claim: waktu gambar ke-2 ' + lcstFormatClaimTimestamp(status.imageTimestamp || status.claimDate) +
                    ' sudah melewati deadline ' + lcstFormatClaimDeadline(status)
                : (status.imageTimestamp
                    ? 'Waktu gambar ke-2: ' + lcstFormatClaimTimestamp(status.imageTimestamp) + ' • deadline ' + lcstFormatClaimDeadline(status)
                    : '');
            if (status.expired) {
                input.style.borderColor = 'rgba(220,38,38,.72)';
                input.style.color = '#b91c1c';
                input.style.background = 'rgba(254,226,226,.92)';
            } else {
                input.style.background = '';
                if (state.claimExpiredNotified) state.claimExpiredNotified.delete(row);
                const ocrValue = String(state.scan.ocrPeriods && state.scan.ocrPeriods[row] || '').trim();
                const currentValue = String(input.value || '').trim();
                if (ocrValue && currentValue === ocrValue) {
                    input.style.borderColor = 'rgba(34,197,94,.40)';
                    input.style.color = '#15803d';
                } else if (!(state.scan.ocrMeta[row] && state.scan.ocrMeta[row].error && !currentValue)) {
                    input.style.borderColor = '';
                    input.style.color = '';
                }
            }
        }
        function syncPeriodInputsFromOcr() {
            const expected = getPackageCount();
            const existing = panel.querySelectorAll('[data-lcst-period-row]').length;
            if (existing !== expected) renderPeriodInputs(true);
            for (let i = 0; i < expected; i++) syncSinglePeriodInput(i);
        }

        function syncSinglePeriodInput(i) {
            const input = panel.querySelector('#lcst-prd-' + i);
            if (!input) return;
            input.style.borderColor = '';
            input.style.color = '';
            if (state.scan.ocrPeriods[i]) {
                input.value = state.scan.ocrPeriods[i];
                input.placeholder = 'Periode Paket ' + (i + 1);
                input.style.borderColor = 'rgba(34,197,94,.40)';
                input.style.color = '#91f5b7';
            } else if (state.scan.ocrMeta[i] && state.scan.ocrMeta[i].error) {
                input.value = '';
                input.placeholder = 'OCR BELUM BERHASIL - KLIK SCAN DISINI ULANG';
                input.style.borderColor = 'rgba(251,79,104,.45)';
                input.style.color = '#ffb7c5';
            }
            updateClaimPeriodInputState(input);
        }

        function clearOcrResults(reason) {
            state.scan.ocrPeriods = [];
            state.scan.ocrTexts = [];
            state.scan.ocrMeta = [];
            state.scan.betOddsByRow = [];
            state.scan.betBelowMinRows = [];
            state.scan.claimExpiredRows = [];
            state.scan.claimDeadlineByRow = [];
            state.scan.claimTimestampByRow = [];
            if (state.claimExpiredNotified) state.claimExpiredNotified.clear();
            renderPeriodInputs(false);
            setScanState('waiting', 'MENUNGGU SCAN', 'Gambar otomatis disusun • klik SCAN DISINI');
            if (reason) setOcrStatus(cssEscapeText(reason), 0);
        }

        function applyAutoArrangedCardsWithoutReload(originalImages, orderedImages) {
            const grid = panel.querySelector('#lcst-image-grid');
            if (!grid) return false;

            const cards = Array.from(grid.children).filter((node) =>
                node && node.classList && node.classList.contains('lcst-img-card')
            );
            const original = Array.isArray(originalImages) ? originalImages : [];
            const ordered = Array.isArray(orderedImages) ? orderedImages : [];
            if (!cards.length || cards.length !== original.length || ordered.length !== original.length) return false;

            // Bucket berdasarkan URL dan urutan kemunculannya agar URL duplikat tetap aman.
            const buckets = new Map();
            original.forEach((src, index) => {
                const key = String(src || '');
                if (!buckets.has(key)) buckets.set(key, []);
                buckets.get(key).push(cards[index]);
            });

            const fragment = document.createDocumentFragment();
            for (const src of ordered) {
                const bucket = buckets.get(String(src || ''));
                const card = bucket && bucket.shift();
                if (!card) return false;
                fragment.appendChild(card);
            }

            // Memindahkan node yang sama mempertahankan gambar, cache, dan event listener.
            // Tidak ada screenshot yang dibuat atau dimuat ulang.
            grid.replaceChildren(fragment);
            refreshImageCardPositions();
            return true;
        }

        async function autoArrangeCurrentScreenshots() {
            if (state.closed || state.autoArrangeRunning || !state.scan.images || state.scan.images.length < 3) {
                return { changed: false, confident: false, rows: 0, reason: 'not-ready' };
            }

            const originalCount = state.scan.images.length;
            const packageSize = getPackageSizeFromImages(state.scan.images);

            // 3/6 disusun. Jika lebih dari 6, tetap proses walaupun jumlahnya 7, 8, 10, dst.
            if (originalCount <= LCST_MAX_SELECTED_IMAGES && (packageSize !== 3 || originalCount % 3 !== 0)) {
                return { changed: false, confident: false, rows: 0, reason: 'not-three-image-package' };
            }

            const sequence = ++state.autoArrangeSeq;
            state.autoArrangeRunning = true;
            setOcrStatus(
                originalCount > LCST_MAX_SELECTED_IMAGES
                    ? 'Menganalisa <b>' + originalCount + '</b> screenshot dan memilih hanya <b>6 gambar</b>...'
                    : 'Mengenali jenis screenshot dan menyusun otomatis...',
                27
            );

            try {
                const original = state.scan.images.slice();

                // HYPER FAST: bila 3/6 gambar ternyata sudah dalam urutan yang benar,
                // cukup validasi gambar History saja (slot 2 dan 5). Empat gambar lain
                // tidak perlu dianalisis sehingga perpindahan kartu terasa langsung.
                let result = null;
                if (original.length <= LCST_MAX_SELECTED_IMAGES) {
                    result = await lcstFastVerifyExistingThreeOrder(original);
                }

                if (!result) {
                    const analyses = await lcstAnalyzeScreenshotsForAutoArrange(original, (done, total) => {
                        if (state.closed || sequence !== state.autoArrangeSeq) return;
                        const progress = 27 + Math.round((done / Math.max(1, total)) * 5);
                        setOcrStatus(
                            (original.length > LCST_MAX_SELECTED_IMAGES
                                ? 'Memilih 6 gambar terbaik <b>' + done + '/' + total + '</b>.<br>'
                                : 'Menyusun otomatis screenshot <b>' + done + '/' + total + '</b>.<br>') +
                            'Urutan wajib: <b>Scatter/Permainan → Riwayat → Kemenangan Total</b>.',
                            progress
                        );
                    });

                    if (state.closed || sequence !== state.autoArrangeSeq) {
                        return { changed: false, confident: false, rows: 0, reason: 'cancelled' };
                    }

                    result = original.length > LCST_MAX_SELECTED_IMAGES
                        ? lcstBuildLimitedSixOrder(original, analyses)
                        : lcstBuildAutoArrangedOrder(original, analyses);
                }

                if (result.confident) {
                    // HARD LIMIT: setelah koreksi, maksimum hanya 6 gambar.
                    state.scan.images = result.images.slice(0, LCST_MAX_SELECTED_IMAGES);
                    state.scan.ocrPeriods = [];
                    state.scan.ocrTexts = [];
                    state.scan.ocrMeta = [];
                    state.scan.betOddsByRow = [];
                    state.scan.betBelowMinRows = [];
                    state.scan.claimExpiredRows = [];
                    state.scan.claimDeadlineByRow = [];
                    state.scan.claimTimestampByRow = [];
                    if (state.claimExpiredNotified) state.claimExpiredNotified.clear();

                    // Jika jumlah berubah (>6 menjadi 6), render ulang agar kartu ekstra benar-benar hilang.
                    if (!applyAutoArrangedCardsWithoutReload(original, state.scan.images)) {
                        renderImages();
                    }
                    setScanState(
                        'waiting',
                        'SIAP DI SCAN',
                        original.length > LCST_MAX_SELECTED_IMAGES
                            ? 'MAX 6: Scatter • Riwayat/Target OCR • Kemenangan Total × 2 paket'
                            : 'Otomatis: Scatter • Riwayat/Target OCR • Kemenangan Total'
                    );
                }
                return result;
            } catch (err) {
                console.warn('[LCST AUTO ARRANGE]', err);
                return {
                    changed: false,
                    confident: false,
                    rows: 0,
                    reason: err && err.message ? err.message : 'auto-arrange-error'
                };
            } finally {
                if (sequence === state.autoArrangeSeq) state.autoArrangeRunning = false;
            }
        }

        function applyNewScan(newScan) {
            state.scan.userId = String(newScan.userId || '').trim().toLowerCase();
            state.scan.allIds = newScan.allIds;
            state.scan.marker = newScan.marker;
            state.scan.markerText = newScan.markerText;
            state.scan.images = newScan.images || [];
            state.scan.ocrPeriods = [];
            state.scan.ocrTexts = [];
            state.scan.ocrMeta = [];
            state.scan.betOddsByRow = [];
            state.scan.betBelowMinRows = [];
            state.scan.claimExpiredRows = [];
            state.scan.claimDeadlineByRow = [];
            state.scan.claimTimestampByRow = [];
            if (state.claimExpiredNotified) state.claimExpiredNotified.clear();
            panel.querySelector('#lcst-marker-text').textContent = newScan.markerText;
            panel.querySelector('#lcst-user-text').value = String(newScan.userId || '').trim().toLowerCase();
            setScanState('waiting', 'MENUNGGU SCAN', 'Gambar otomatis disusun • klik SCAN DISINI');
            renderPeriodInputs(false);
            renderImages();
            updateOutput();
            fillAccountFromAdmin(String(newScan.userId || '').trim().toLowerCase(), false);
        }

        async function runDeepScan() {
            if (state.scanRunning || state.ocrRunning || state.closed) return;
            // Mulai memuat worker sekarang agar selesai bersamaan dengan pengumpulan
            // dan penyusunan gambar. Tombol SCAN tidak perlu menunggu startup OCR.
            warmupOCRWorker();
            state.scanRunning = true;
            panel.classList.add('lcst-performance-mode');
            const ocrBtn = panel.querySelector('#lcst-ocr-period');
            if (ocrBtn) ocrBtn.disabled = true;
            setOcrStatus('Menelusuri seluruh scroll chat aktif untuk mengumpulkan screenshot. OCR belum dijalankan...', 8);
            try {
                const newScan = await scanPageDeep((msg) => setOcrStatus(msg, 24));
                if (state.closed) return;
                applyNewScan(newScan);
                if (newScan.images && newScan.images.length) {
                    const arranged = await autoArrangeCurrentScreenshots();

                    // Worker sudah dipanaskan sejak deep scan dimulai. Panggilan ini hanya
                    // memastikan worker tetap siap bila startup sebelumnya sempat gagal.
                    warmupOCRWorker();
                    prefetchTargetImages(state.scan.images);
                    const packageSize = getPackageSizeFromImages(state.scan.images || []);
                    const rows = Math.max(1, Math.ceil(state.scan.images.length / packageSize));

                    if (arranged.confident) {
                        setOcrStatus(
                            '<b>' + state.scan.images.length + '</b> screenshot ditemukan dan otomatis disusun menjadi <b>' + rows + '</b> paket.<br>' +
                            '<span style="color:#15803d"><b>Urutan siap:</b> Permainan → Riwayat Permainan/Target OCR → Kemenangan Total.</span><br>' +
                            'Sekarang langsung klik <b>SCAN DISINI</b>; tidak perlu menyusun gambar lagi.',
                            34,
                            true
                        );
                    } else {
                        setOcrStatus(
                            '<b>' + state.scan.images.length + '</b> screenshot ditemukan.<br>' +
                            '<span style="color:#b45309">Jenis screenshot belum cukup jelas untuk dipindahkan otomatis, sehingga urutan asli dipertahankan agar tidak salah susun.</span>',
                            32,
                            true
                        );
                    }
                } else {
                    setOcrStatus('Tidak ada screenshot yang terbaca pada chat aktif. Periksa chat, lalu tutup dan buka kembali panel OCR.', 0);
                }
            } catch (err) {
                setOcrStatus('Deep scan gagal: ' + cssEscapeText(err && err.message ? err.message : err), 0);
            } finally {
                state.scanRunning = false;
                if (!state.ocrRunning) panel.classList.remove('lcst-performance-mode');
                if (ocrBtn) ocrBtn.disabled = false;
            }
        }

        function getCardImageIndex(card) {
            if (!card) return -1;
            const value = parseInt(card.dataset.lcstImageIndex || '-1', 10);
            return Number.isFinite(value) ? value : -1;
        }

        function scheduleArrangePrefetch() {
            if (state.arrangePrefetchTimer) {
                clearTimeout(state.arrangePrefetchTimer);
                state.arrangePrefetchTimer = null;
            }
            if (state.arrangePrefetchIdle && typeof cancelIdleCallback === 'function') {
                try { cancelIdleCallback(state.arrangePrefetchIdle); } catch (e) {}
                state.arrangePrefetchIdle = null;
            }

            const run = () => {
                state.arrangePrefetchTimer = null;
                state.arrangePrefetchIdle = null;
                if (state.closed || state.ocrRunning || state.scanRunning) return;
                prefetchTargetImages(state.scan.images);
            };

            // Analisis marker baru dijalankan setelah browser selesai menggambar posisi kartu.
            if (typeof requestIdleCallback === 'function') {
                state.arrangePrefetchIdle = requestIdleCallback(run, { timeout: 900 });
            } else {
                state.arrangePrefetchTimer = setTimeout(run, 260);
            }
        }

        function clearDragOverVisual() {
            if (state.dragFrame) {
                cancelAnimationFrame(state.dragFrame);
                state.dragFrame = 0;
            }
            if (state.dragOverCard) state.dragOverCard.classList.remove('over');
            if (state.pendingDragOverCard && state.pendingDragOverCard !== state.dragOverCard) {
                state.pendingDragOverCard.classList.remove('over');
            }
            state.dragOverCard = null;
            state.pendingDragOverCard = null;
        }

        function queueDragOverVisual(card) {
            if (state.pendingDragOverCard === card || state.dragOverCard === card) return;
            state.pendingDragOverCard = card;
            if (state.dragFrame) return;
            state.dragFrame = requestAnimationFrame(() => {
                state.dragFrame = 0;
                const next = state.pendingDragOverCard;
                state.pendingDragOverCard = null;
                if (state.dragOverCard && state.dragOverCard !== next) state.dragOverCard.classList.remove('over');
                state.dragOverCard = next || null;
                if (state.dragOverCard) state.dragOverCard.classList.add('over');
            });
        }

        function finishDragVisuals() {
            clearDragOverVisual();
            if (state.dragCard) state.dragCard.classList.remove('dragging');
            state.dragCard = null;
            state.dragIdx = -1;
            panel.classList.remove('lcst-reorder-mode');
        }

        function swapCardNodes(first, second) {
            if (!first || !second || first === second || first.parentNode !== second.parentNode) return;
            const parent = first.parentNode;
            const marker = document.createComment('lcst-swap');
            parent.insertBefore(marker, first);
            parent.insertBefore(first, second);
            parent.insertBefore(second, marker);
            marker.remove();
        }

        function refreshImageCardPositions() {
            const packageSize = getPackageSizeFromImages(state.scan.images || []);
            const cards = Array.from(panel.querySelectorAll('#lcst-image-grid > .lcst-img-card'));

            cards.forEach((card, idx) => {
                const rowIdx = Math.floor(idx / packageSize);
                const isTarget = packageSize === 1 ? true : idx === rowIdx * packageSize + 1;
                const meta = state.scan.ocrMeta && state.scan.ocrMeta[rowIdx];
                const period = state.scan.ocrPeriods && state.scan.ocrPeriods[rowIdx];

                card.dataset.lcstRow = String(rowIdx);
                card.dataset.lcstImageIndex = String(idx);
                card.classList.toggle('target', isTarget);

                const indexTag = card.querySelector('.lcst-img-index');
                if (indexTag) {
                    indexTag.innerHTML = 'GAMBAR ' + (idx + 1) + (isTarget ? ' <span class="lcst-target-tag">• TARGET OCR</span>' : '');
                }

                const badge = card.querySelector('.lcst-ocr-badge');
                if (!badge) return;
                badge.dataset.lcstOcrBadgeRow = String(rowIdx);
                if (period) {
                    const claimTime = state.scan.claimTimestampByRow && state.scan.claimTimestampByRow[rowIdx];
                    const claimStatus = lcstCheckClaimDeadline(claimTime || null, period);
                    state.scan.claimExpiredRows = state.scan.claimExpiredRows || [];
                    state.scan.claimDeadlineByRow = state.scan.claimDeadlineByRow || [];
                    state.scan.claimExpiredRows[rowIdx] = !!claimStatus.expired;
                    state.scan.claimDeadlineByRow[rowIdx] = claimStatus;

                    if (claimStatus.expired) {
                        badge.className = 'lcst-ocr-badge error';
                        badge.textContent = '✕ TIDAK DAPAT CLAIM • TRANSAKSI ' +
                            (claimTime ? lcstFormatClaimTimestamp(claimTime) : lcstFormatClaimDate(claimStatus.claimDate)) +
                            ' • DEADLINE ' + lcstFormatClaimDeadline(claimStatus) +
                            ' • SEKARANG ' + lcstFormatCurrentWib(lcstNowDate());
                    } else {
                        badge.className = 'lcst-ocr-badge success';
                        badge.textContent = '✓ CLAIM MASIH BERLAKU • ' + (meta && meta.confidence ? meta.confidence + '% • ' : '') + period +
                            (claimTime ? ' • TRANSAKSI ' + lcstFormatClaimTimestamp(claimTime) : ' • WAKTU BELUM TERBACA') +
                            (claimStatus.hasDate ? ' • DEADLINE ' + lcstFormatClaimDeadline(claimStatus) : '');
                    }
                } else if (meta && meta.error && isTarget) {
                    badge.className = 'lcst-ocr-badge error';
                    badge.textContent = '! ' + meta.error;
                } else {
                    badge.className = 'lcst-ocr-badge empty';
                    badge.textContent = isTarget ? 'Menunggu lock dua bulatan' : 'Bukan target OCR periode';
                }
            });
        }

        function removeImageAt(index, reason) {
            if (state.ocrRunning || state.scanRunning || state.closed) return;
            if (index < 0 || index >= state.scan.images.length) return;
            state.scan.images.splice(index, 1);
            clearOcrResults(reason || 'Gambar dihapus. OCR lama dibersihkan agar hasil tidak tertukar.');
            renderImages();
            updateOutput();
            prefetchTargetImages(state.scan.images);
        }

        function renderImages() {
            const grid = panel.querySelector('#lcst-image-grid');
            grid.innerHTML = '';
            const packageSize = getPackageSizeFromImages(state.scan.images || []);

            state.scan.images.forEach((src, idx) => {
                const rowIdx = Math.floor(idx / packageSize);
                const isTarget = packageSize === 1 ? true : idx === rowIdx * packageSize + 1;
                const meta = state.scan.ocrMeta && state.scan.ocrMeta[rowIdx];
                const period = state.scan.ocrPeriods && state.scan.ocrPeriods[rowIdx];

                const card = document.createElement('div');
                card.className = 'lcst-img-card' + (isTarget ? ' target' : '');
                card.dataset.lcstRow = String(rowIdx);
                card.dataset.lcstImageIndex = String(idx);
                card.draggable = true;

                const media = document.createElement('div');
                media.className = 'lcst-img-media';

                const indexTag = document.createElement('div');
                indexTag.className = 'lcst-img-index';
                indexTag.innerHTML = 'GAMBAR ' + (idx + 1) + (isTarget ? ' <span class="lcst-target-tag">• TARGET OCR</span>' : '');

                const del = document.createElement('button');
                del.className = 'lcst-del';
                del.type = 'button';
                del.textContent = '✕';
                del.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeImageAt(getCardImageIndex(card), 'Gambar dihapus. Paket akan mengikuti urutan yang tersisa lalu dapat discan kembali.');
                });

                const img = document.createElement('img');
                img.loading = 'lazy';
                img.decoding = 'async';
                img.src = src;
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (e.shiftKey) {
                        removeImageAt(getCardImageIndex(card), 'Gambar dihapus tanpa popup. OCR lama dibersihkan agar hasil tidak tertukar.');
                    } else {
                        openZoom(src);
                    }
                });

                const label = document.createElement('div');
                label.className = 'lcst-img-label';
                label.textContent = src.split('/').pop().split('?')[0] || 'screenshot';

                const ocrBadge = document.createElement('div');
                ocrBadge.dataset.lcstOcrBadgeRow = String(rowIdx);
                if (period) {
                    ocrBadge.className = 'lcst-ocr-badge success';
                    ocrBadge.textContent = '✓ BULAT 2 LOCK • ' + (meta && meta.confidence ? meta.confidence + '% • ' : '') + period;
                } else if (meta && meta.error && isTarget) {
                    ocrBadge.className = 'lcst-ocr-badge error';
                    ocrBadge.textContent = '! ' + meta.error;
                } else {
                    ocrBadge.className = 'lcst-ocr-badge empty';
                    ocrBadge.textContent = isTarget ? 'Menunggu lock dua bulatan' : 'Bukan target OCR periode';
                }

                card.addEventListener('dragstart', (e) => {
                    if (state.ocrRunning || state.scanRunning || state.closed) {
                        e.preventDefault();
                        return;
                    }
                    const currentIdx = getCardImageIndex(card);
                    if (currentIdx < 0) {
                        e.preventDefault();
                        return;
                    }
                    state.dragIdx = currentIdx;
                    state.dragCard = card;
                    panel.classList.add('lcst-reorder-mode');
                    card.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(currentIdx));

                    // Hindari browser membuat preview drag berukuran screenshot penuh.
                    // Preview besar adalah salah satu penyebab utama pointer terasa nge-lag.
                    try {
                        if (state.dragGhost) e.dataTransfer.setDragImage(state.dragGhost, 0, 0);
                    } catch (err) {}
                });
                card.addEventListener('dragend', () => {
                    finishDragVisuals();
                });
                card.addEventListener('dragover', (e) => {
                    if (state.dragIdx < 0 || state.dragCard === card) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    queueDragOverVisual(card);
                });
                card.addEventListener('dragleave', (e) => {
                    // Abaikan dragleave palsu ketika pointer hanya berpindah ke anak kartu.
                    if (e.relatedTarget && card.contains(e.relatedTarget)) return;
                    if (state.dragOverCard === card || state.pendingDragOverCard === card) clearDragOverVisual();
                });
                card.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const fromIdx = state.dragIdx;
                    const toIdx = getCardImageIndex(card);
                    const fromCard = state.dragCard;

                    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx || !fromCard) {
                        finishDragVisuals();
                        return;
                    }

                    // Tukar data dan node DOM langsung. Gambar tidak dibuat/dimuat ulang.
                    const temp = state.scan.images[fromIdx];
                    state.scan.images[fromIdx] = state.scan.images[toIdx];
                    state.scan.images[toIdx] = temp;
                    swapCardNodes(fromCard, card);
                    finishDragVisuals();

                    clearOcrResults('Posisi gambar ditukar. OCR lama dihapus agar kode tidak menempel ke paket yang salah.');
                    refreshImageCardPositions();
                    updateOutput();
                    scheduleArrangePrefetch();
                });

                media.appendChild(indexTag);
                media.appendChild(del);
                media.appendChild(img);
                card.appendChild(media);
                card.appendChild(label);
                card.appendChild(ocrBadge);
                grid.appendChild(card);
            });

            renderPeriodInputs(true);
            updateOutput();
        }

        function updateOcrBadgeRow(rowIdx) {
            const meta = state.scan.ocrMeta && state.scan.ocrMeta[rowIdx];
            const period = state.scan.ocrPeriods && state.scan.ocrPeriods[rowIdx];
            panel.querySelectorAll('[data-lcst-ocr-badge-row="' + rowIdx + '"]').forEach((badge) => {
                const card = badge.closest('.lcst-img-card');
                const isTarget = !!(card && card.classList.contains('target'));
                if (period) {
                    badge.className = 'lcst-ocr-badge success';
                    const claimTime = state.scan.claimTimestampByRow && state.scan.claimTimestampByRow[rowIdx];
                    badge.textContent = '✓ BULAT 2 LOCK • ' + (meta && meta.confidence ? meta.confidence + '% • ' : '') + period +
                        (claimTime ? ' • WAKTU ' + lcstFormatClaimTimestamp(claimTime) : ' • WAKTU BELUM TERBACA');
                } else if (meta && meta.error && isTarget) {
                    badge.className = 'lcst-ocr-badge error';
                    badge.textContent = '! ' + meta.error;
                } else {
                    badge.className = 'lcst-ocr-badge empty';
                    badge.textContent = isTarget ? 'Menunggu lock dua bulatan' : 'Bukan target OCR periode';
                }
            });
        }

        function openZoom(src) {
            const oldZoom = document.getElementById('lcst-zoom');
            if (oldZoom) oldZoom.remove();
            state.zoomScale = 1;
            state.zoomX = 0;
            state.zoomY = 0;

            const zoom = document.createElement('div');
            zoom.id = 'lcst-zoom';
            zoom.innerHTML = `
                <button class="lcst-btn red" id="lcst-close-zoom" style="position:absolute;top:20px;right:20px;z-index:2">✕ TUTUP ZOOM</button>
                <img id="lcst-zoom-img" src="${cssEscapeText(src)}">
                <div class="lcst-zoom-help">Drag untuk geser • Scroll untuk zoom • ESC untuk menutup</div>
            `;
            document.body.appendChild(zoom);

            const zimg = zoom.querySelector('#lcst-zoom-img');
            function applyTransform() {
                zimg.style.transform = `translate(${state.zoomX}px, ${state.zoomY}px) scale(${state.zoomScale})`;
            }
            zoom.querySelector('#lcst-close-zoom').addEventListener('click', () => zoom.remove());
            zimg.addEventListener('wheel', (e) => {
                e.preventDefault();
                state.zoomScale += e.deltaY > 0 ? -0.1 : 0.1;
                state.zoomScale = Math.max(0.5, Math.min(6, state.zoomScale));
                applyTransform();
            }, { passive: false });

            let moving = false, sx = 0, sy = 0, ox = 0, oy = 0;
            zimg.addEventListener('pointerdown', (e) => {
                moving = true;
                sx = e.clientX;
                sy = e.clientY;
                ox = state.zoomX;
                oy = state.zoomY;
                try { zimg.setPointerCapture(e.pointerId); } catch (err) {}
            });
            zimg.addEventListener('pointermove', (e) => {
                if (!moving) return;
                state.zoomX = ox + (e.clientX - sx);
                state.zoomY = oy + (e.clientY - sy);
                applyTransform();
            });
            zimg.addEventListener('pointerup', (e) => {
                moving = false;
                try { zimg.releasePointerCapture(e.pointerId); } catch (err) {}
            });
        }

        function lcstAccountLooksReadyForSheet() {
            const input = panel.querySelector('#lcst-rek-all');
            const parsed = parseRekNama(input ? input.value : '');
            const nama = String(parsed.nama || '').trim();
            const rek = String(parsed.rek || '').trim();
            if (!nama || !rek) return false;
            if (/^NAMA USER$/i.test(nama) || /^NO REKENING$/i.test(rek)) return false;
            return true;
        }

        async function lcstEnsureAccountBeforeSheet() {
            if (lcstAccountLooksReadyForSheet()) return true;

            // Bila lookup rekening sedang berjalan, beri kesempatan menyelesaikan dulu.
            const until = Date.now() + 6000;
            while (!state.closed && state.bankLookupRunning && Date.now() < until) {
                await new Promise(resolve => setTimeout(resolve, 250));
                if (lcstAccountLooksReadyForSheet()) return true;
            }

            if (!state.closed && !state.bankLookupRunning && lcstValidLookupUserId(state.scan.userId)) {
                await fillAccountFromAdmin(state.scan.userId, false);
            }
            return lcstAccountLooksReadyForSheet();
        }

        async function lcstAutoSendFinishedScanToSheet(okCount, totalRows) {
            if (state.closed || state.sheetSending || !okCount) return;
            state.sheetSending = true;
            try {
                if (!lcstSheetIsConfigured()) {
                    setOcrStatus(
                        'OCR selesai: <b style="color:#91f5b7">' + okCount + '</b> dari <b>' + totalRows + '</b> paket berhasil.<br>' +
                        '<span style="color:#ffd27a;font-weight:900">AUTO SHEET BELUM AKTIF:</span> pasang URL Web App Apps Script yang berakhir <b>/exec</b> pada LCST_SHEET_WEBAPP_URL.',
                        100,
                        true
                    );
                    return;
                }

                setOcrStatus(
                    'OCR selesai. Menyiapkan hasil valid untuk otomatis masuk ke Google Sheet kolom <b>D:J</b>...',
                    100,
                    true
                );

                const accountReady = await lcstEnsureAccountBeforeSheet();
                if (!accountReady) {
                    setOcrStatus(
                        'OCR selesai, tetapi data belum dikirim ke Sheet karena <b>Nama/Rekening belum siap</b>.<br>' +
                        'Periksa data rekening lalu tekan <b>SCAN DISINI</b> kembali untuk mencoba pengiriman otomatis.',
                        100,
                        true
                    );
                    return;
                }

                const sheetRows = lcstBuildSheetRows(state.scan);
                if (!sheetRows.length) {
                    setOcrStatus(
                        'OCR selesai, tetapi tidak ada paket valid yang boleh dikirim ke Sheet. Paket gagal/di bawah 1,60/melewati deadline tetap tidak ditulis.',
                        100,
                        true
                    );
                    return;
                }

                const result = await lcstPostRowsToSheet(sheetRows);
                state.lastSheetResult = result;

                if (result.duplicate) {
                    setScanState('success', 'BERHASIL DI SCAN', okCount + ' dari ' + totalRows + ' paket • Sheet sudah pernah tersimpan');
                    setOcrStatus(
                        'OCR selesai. Batch yang sama <b>sudah pernah berhasil masuk ke Google Sheet</b>, jadi tidak dikirim ulang agar tidak dobel.',
                        100,
                        true
                    );
                    return;
                }

                const inserted = Number(result.inserted || sheetRows.length) || sheetRows.length;
                const startRow = Number(result.startRow || 0);
                const endRow = Number(result.endRow || 0);
                const rowText = startRow && endRow
                    ? ('baris <b>' + startRow + (endRow !== startRow ? ('–' + endRow) : '') + '</b>')
                    : '<b>baris kosong berikutnya</b>';
                setScanState('success', 'BERHASIL DI SCAN', okCount + ' dari ' + totalRows + ' paket • ' + inserted + ' baris masuk Sheet');
                setOcrStatus(
                    'OCR selesai dan <b style="color:#91f5b7">' + inserted + ' baris berhasil otomatis masuk ke Google Sheet</b> pada ' + rowText + '.<br>' +
                    'Tujuan: <b>D:J</b> • data lama tidak ditimpa.',
                    100,
                    true
                );
            } catch (err) {
                setOcrStatus(
                    'OCR selesai, tetapi <b style="color:#ffb7c5">pengiriman otomatis ke Google Sheet gagal</b>.<br>' +
                    cssEscapeText(err && err.message ? err.message : String(err)),
                    100,
                    true
                );
            } finally {
                state.sheetSending = false;
            }
        }

        async function runOcrPeriods() {
            if (state.ocrRunning || state.scanRunning || state.closed) return;
            if (!state.scan.images.length) {
                setScanState('failed', 'GAGAL DI SCAN', 'Tidak ada gambar target');
                setOcrStatus('Tidak ada gambar untuk OCR. Pastikan screenshot sudah terkumpul pada chat aktif.', 0, true);
                showManualScanNotification([]);
                return;
            }

            setOcrStatus('HYPER FAST aktif. Menyiapkan pembacaan periode dari history setiap paket...', 36);
            state.ocrRunning = true;
            setScanState('scanning', 'SEDANG DI SCAN', 'Menyiapkan OCR periode + waktu gambar ke-2/5 • hasil GMT+7');
            panel.classList.add('lcst-performance-mode');
            const btn = panel.querySelector('#lcst-ocr-period');
            if (btn) btn.disabled = true;
            if (btn) btn.textContent = '◌ OCR HYPER FAST...';
            const alwaysCopyBtn = panel.querySelector('#lcst-copy');
            if (alwaysCopyBtn) {
                alwaysCopyBtn.disabled = false;
                alwaysCopyBtn.title = 'Salin output sementara saat OCR berjalan';
            }

            const packageSize = getPackageSizeFromImages(state.scan.images || []);
            const rows = Math.ceil(state.scan.images.length / packageSize);
            state.scan.ocrPeriods = [];
            state.scan.ocrTexts = [];
            state.scan.ocrMeta = [];
            state.scan.betOddsByRow = [];
            state.scan.betBelowMinRows = [];
            state.scan.claimExpiredRows = [];
            state.scan.claimDeadlineByRow = [];
            state.scan.claimTimestampByRow = [];
            if (state.claimExpiredNotified) state.claimExpiredNotified.clear();

            let ok = 0;
            let completedRows = 0;

            const processRow = async (row, workerOverrides) => {
                if (state.closed) return;

                const base = row * packageSize;
                const preferredIdx = packageSize >= 2 ? base + 1 : base;
                const src = state.scan.images[preferredIdx];
                const overallBase = 38 + (row / Math.max(1, rows)) * 57;

                if (!src) {
                    state.scan.ocrMeta[row] = {
                        error: 'Gambar ke-2 paket tidak tersedia.',
                        confidence: 0
                    };
                    completedRows++;
                    return;
                }

                // Analisis gambar sudah diprefetch sejak auto-arrange. Panggilan ini memakai cache
                // bila siap dan tidak mengunduh ulang screenshot.
                getImageAnalysis(src).catch(() => {});

                setScanState(
                    'scanning',
                    'SEDANG DI SCAN',
                    rows === 2 && LCST_DUAL_PACKAGE_OCR
                        ? '2 paket diproses bersamaan'
                        : ('Paket ' + (row + 1) + ' dari ' + rows)
                );

                let result;
                try {
                    result = await ocrImagePeriod(
                        src,
                        (progress) => {
                            if (state.closed) return;
                            setOcrStatus(
                                (rows === 2 && LCST_DUAL_PACKAGE_OCR
                                    ? '<b>PARALEL 2 PAKET</b> • '
                                    : '') +
                                'Paket <b>' + (row + 1) + '/' + rows +
                                '</b> • screenshot <b>' + (preferredIdx + 1) + '</b><br>' +
                                cssEscapeText(progress),
                                Math.min(94, overallBase + 7)
                            );
                        },
                        workerOverrides
                    );
                } catch (err) {
                    result = {
                        period: '',
                        text: '',
                        confidence: 0,
                        markerFound: false,
                        error: err && err.message ? err.message : String(err)
                    };
                }

                state.scan.ocrTexts[row] = result.text || '';
                state.scan.ocrPeriods[row] = result.period || '';
                state.scan.ocrMeta[row] = {
                    confidence: result.confidence || 0,
                    markerConfidence: result.markerConfidence || 0,
                    markerFound: !!result.markerFound,
                    source: result.source || '',
                    passes: result.passes || 0,
                    error: result.error || ''
                };
                state.scan.betOddsByRow[row] =
                    result.betOdds == null ? null : result.betOdds;
                state.scan.betBelowMinRows[row] = !!result.betBelowMin;
                state.scan.claimTimestampByRow[row] = result.claimTimestamp || null;

                const claimStatus = lcstCheckClaimDeadline(
                    result.claimTimestamp || null,
                    result.period || ''
                );
                state.scan.claimExpiredRows[row] = !!claimStatus.expired;
                state.scan.claimDeadlineByRow[row] = claimStatus;

                if (result.period) ok++;
                if (result.betBelowMin) {
                    showTidakCapaiNotification(row, result.betOdds);
                }
                if (claimStatus.expired) {
                    showClaimExpiredNotification(row, claimStatus);
                }

                syncSinglePeriodInput(row);
                updateOcrBadgeRow(row);
                updateOutput();

                completedRows++;
                const donePct = 38 + (completedRows / Math.max(1, rows)) * 57;

                if (result.period) {
                    setOcrStatus(
                        'Paket <b>' + (row + 1) + '</b> berhasil.' +
                        (rows === 2 && LCST_DUAL_PACKAGE_OCR
                            ? ' <span style="color:#7eeeff"><b>Mode paralel aktif.</b></span>'
                            : '') +
                        '<br>Periode: <b style="color:#91f5b7">' +
                        cssEscapeText(result.period) + '</b> • keyakinan <b>' +
                        (result.confidence || 0) + '%</b>.' +
                        '<br>Waktu gambar ke-2: <b>' +
                        cssEscapeText(result.claimTimestampText || 'belum terbaca') +
                        '</b>.' +
                        (claimStatus.hasDate
                            ? ' • Deadline <b>' +
                              cssEscapeText(lcstFormatClaimDeadline(claimStatus)) +
                              '</b>.'
                            : '') +
                        (claimStatus.expired
                            ? '<br><span style="color:#ffb7c5;font-weight:1000">TIDAK DAPAT CLAIM • melewati batas 02.00 WIB</span>'
                            : ''),
                        donePct
                    );
                } else {
                    setOcrStatus(
                        'Paket <b>' + (row + 1) +
                        '</b> tidak diisi otomatis.<br><span style="color:#ffb7c5">' +
                        cssEscapeText(result.error || 'Kode tidak konsisten.') +
                        '</span>',
                        donePct
                    );
                }
            };

            try {
                // ULTRA FAST: jangan menunggu semua worker siap sebelum paket pertama mulai.
                // Primary segera dipakai; secondary/metadata loading ditutup oleh proses paket pertama.
                const primaryPromise = getSharedOCRWorker(null);
                let secondaryWorkerUsed = false;
                const secondaryPromise = (rows === 2 && LCST_DUAL_PACKAGE_OCR)
                    ? getSecondaryOCRWorker().catch(() => null)
                    : Promise.resolve(null);

                if (LCST_TURBO_PARALLEL_OCR) getMetadataOCRWorker().catch(() => null);
                if (LCST_TURBO_TIMESTAMP_WORKER) getTimestampOCRWorker().catch(() => null);
                await primaryPromise;

                if (rows === 2 && LCST_DUAL_PACKAGE_OCR) {
                    const first = processRow(0, null);
                    const second = (async () => {
                        const secondaryWorker = await secondaryPromise;
                        if (secondaryWorker) {
                            secondaryWorkerUsed = true;
                            return processRow(1, {
                                worker: secondaryWorker,
                                metadataWorker: null,
                                timestampWorker: null
                            });
                        }
                        // Bila worker kedua gagal dibuat, tunggu paket 1 lalu pakai worker utama.
                        await first;
                        return processRow(1, null);
                    })();
                    await Promise.all([first, second]);
                } else {
                    for (let row = 0; row < rows; row++) {
                        await processRow(row, null);
                    }
                }

                syncPeriodInputsFromOcr();
                updateOutput();

                if (rows > 0 && ok === rows) {
                    setScanState(
                        'success',
                        'BERHASIL DI SCAN',
                        ok + ' dari ' + rows + ' paket berhasil' +
                        (rows === 2 && secondaryWorkerUsed ? ' • HYPER FAST' : '')
                    );
                } else if (ok > 0) {
                    setScanState(
                        'partial',
                        'SCAN SELESAI',
                        ok + ' dari ' + rows + ' paket berhasil'
                    );
                } else {
                    setScanState(
                        'failed',
                        'GAGAL DI SCAN',
                        'Tidak ada kode yang lolos'
                    );
                }

                setOcrStatus(
                    'OCR selesai: <b style="color:#91f5b7">' + ok +
                    '</b> dari <b>' + rows + '</b> paket berhasil.' +
                    (rows === 2 && secondaryWorkerUsed
                        ? '<br><span style="color:#7eeeff"><b>HYPER FAST:</b> kedua history diproses bersamaan.</span>'
                        : '') +
                    '<br>' +
                    (ok < rows
                        ? 'Paket gagal sengaja dibiarkan untuk pemeriksaan manual agar OCR tidak mengambil kode dari baris lain.'
                        : 'Semua kode berhasil dikunci pada baris dengan dua bulatan.'),
                    100,
                    true
                );

                if (ok < rows) {
                    const failedRows = [];
                    for (let row = 0; row < rows; row++) {
                        if (!state.scan.ocrPeriods[row]) failedRows.push(row);
                    }
                    showManualScanNotification(failedRows);
                }

                // PENTING: mekanisme Google Sheet tetap fungsi asli dan baru dijalankan
                // setelah seluruh OCR selesai.
                await lcstAutoSendFinishedScanToSheet(ok, rows);
            } catch (err) {
                setScanState(
                    'failed',
                    'GAGAL DI SCAN',
                    'Proses OCR mengalami kesalahan'
                );
                setOcrStatus(
                    'OCR gagal: ' +
                    cssEscapeText(err && err.message ? err.message : err),
                    0,
                    true
                );
                showManualScanNotification([]);
            } finally {
                state.ocrRunning = false;
                if (!state.scanRunning) {
                    panel.classList.remove('lcst-performance-mode');
                }
                if (btn) btn.disabled = false;
                if (btn) btn.textContent = 'SCAN DISINI';
                updateCopyAvailability();
            }
        }

        function saveAccountValue() {
            const input = panel.querySelector('#lcst-rek-all');
            const parsed = parseRekNama(input ? input.value : '');
            if (!parsed.nama && !parsed.rek) return;
            const dbNow = getAccountDB();
            dbNow[state.scan.userId] = { nama: parsed.nama, rek: parsed.rek };
            setAccountDB(dbNow);
        }

        function escClose(e) {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            const z = document.getElementById('lcst-zoom');
            if (z) {
                z.remove();
                return;
            }
            closePanel();
        }

        panel.querySelector('#lcst-close').addEventListener('click', closePanel);
        panel.querySelector('#lcst-ocr-period').addEventListener('click', runOcrPeriods);
        panel.querySelector('#lcst-bank-refresh').addEventListener('click', () => fillAccountFromAdmin(state.scan.userId, true));

        const userIdInput = panel.querySelector('#lcst-user-text');
        let committedUserId = String(state.scan.userId || '').trim().toLowerCase();
        if (userIdInput) {
            userIdInput.value = String(userIdInput.value || '').trim().toLowerCase();
            state.scan.userId = userIdInput.value;
        }

        function stopPendingBankLookupForUserEdit() {
            state.bankLookupSeq += 1;
            state.bankLookupRunning = false;
            state.bankLookupUserId = '';
            const refreshBtn = panel.querySelector('#lcst-bank-refresh');
            if (refreshBtn) refreshBtn.disabled = false;
        }

        function commitEditedUserId(forceLookup) {
            if (!userIdInput) return;
            const nextUserId = String(userIdInput.value || '').trim().toLowerCase();
            userIdInput.value = nextUserId;
            state.scan.userId = nextUserId;
            updateOutput();

            if (nextUserId === committedUserId && !forceLookup) return;
            stopPendingBankLookupForUserEdit();
            committedUserId = nextUserId;

            const accountInput = panel.querySelector('#lcst-rek-all');
            if (!lcstValidLookupUserId(nextUserId)) {
                if (accountInput) accountInput.value = 'NAMA USER,NO REKENING';
                updateOutput();
                setBankState('waiting', 'USER ID BELUM TERDETEKSI', 'Isi User ID yang benar pada kolom USER ID');
                return;
            }

            const savedAccount = getAccountDB()[nextUserId] || { nama: '', rek: '' };
            if (accountInput) {
                const savedName = lcstCleanAccountName(savedAccount.nama) || 'NAMA USER';
                const savedNumber = lcstCleanAccountNumber(savedAccount.rek) || 'NO REKENING';
                accountInput.value = savedName + ',' + savedNumber;
            }
            updateOutput();
            fillAccountFromAdmin(nextUserId, true);
        }

        if (userIdInput) {
            userIdInput.addEventListener('input', () => {
                // Ketik maupun paste langsung dipaksa lowercase di kolom USER ID.
                const typedUserId = String(userIdInput.value || '').trim().toLowerCase();
                if (userIdInput.value !== typedUserId) userIdInput.value = typedUserId;
                state.scan.userId = typedUserId;
                if (typedUserId !== committedUserId) stopPendingBankLookupForUserEdit();
                updateOutput();
            });
            userIdInput.addEventListener('change', () => commitEditedUserId(false));
            userIdInput.addEventListener('blur', () => commitEditedUserId(false));
            userIdInput.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                commitEditedUserId(true);
                userIdInput.blur();
            });
        }

        panel.querySelector('#lcst-copy-user').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const copyUserBtn = panel.querySelector('#lcst-copy-user');
            if (userIdInput) {
                userIdInput.value = String(userIdInput.value || '').trim().toLowerCase();
                state.scan.userId = userIdInput.value;
            }
            const userId = String(state.scan.userId || '').trim().toLowerCase();
            if (!userId) {
                setOcrStatus('User ID belum tersedia untuk disalin.', null, true);
                return;
            }

            copyText(userId).then(() => {
                if (!copyUserBtn) return;
                const oldHtml = copyUserBtn.innerHTML;
                const oldTitle = copyUserBtn.title;
                copyUserBtn.classList.add('copied');
                copyUserBtn.title = 'User ID tersalin';
                copyUserBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m9.55 17.6-5.15-5.15 1.4-1.4 3.75 3.75 8.65-8.65 1.4 1.4L9.55 17.6Z"/></svg>';
                setTimeout(() => {
                    if (!state.closed && copyUserBtn.isConnected) {
                        copyUserBtn.classList.remove('copied');
                        copyUserBtn.title = oldTitle;
                        copyUserBtn.innerHTML = oldHtml;
                    }
                }, 1100);
            }).catch(() => {
                if (copyUserBtn) {
                    copyUserBtn.classList.remove('copied');
                    copyUserBtn.title = 'Gagal copy User ID';
                }
                setOcrStatus('Gagal menyalin User ID. Blok teks User ID lalu salin manual.', null, true);
            });
        });

        function refreshClaimDeadlineClock() {
            if (state.closed) return;
            updateLiveTimeDisplay();
            if (state.ocrRunning) return;

            const output = makeOutput(state.scan);
            const outputBox = panel.querySelector('#lcst-output');
            if (outputBox) outputBox.value = output;
            updateCopyAvailability();

            const expiredRows = getBlockedClaimRows();
            const expiredSet = new Set(expiredRows);
            if (state.claimExpiredNotified) {
                Array.from(state.claimExpiredNotified).forEach((row) => {
                    if (!expiredSet.has(row)) state.claimExpiredNotified.delete(row);
                });
            }

            const freshExpiredRow = expiredRows.find((row) => !state.claimExpiredNotified.has(row));
            if (freshExpiredRow != null) {
                const status = state.scan.claimDeadlineByRow[freshExpiredRow];
                showClaimExpiredNotification(freshExpiredRow, status);
                setOcrStatus(
                    'Paket <b>' + (freshExpiredRow + 1) + '</b> tidak dapat claim.<br>' +
                    'Waktu gambar ke-2: <b>' + cssEscapeText(lcstFormatClaimTimestamp(status && (status.imageTimestamp || status.claimDate))) + ' WIB</b> • ' +
                    'deadline <b>' + cssEscapeText(lcstFormatClaimDeadline(status)) + '</b>.<br>' +
                    'Waktu online sekarang: <b>' + cssEscapeText(lcstFormatCurrentWib(lcstNowDate()) + ' • ' + lcstGetOnlineTimeSourceLabel()) + '</b>.',
                    null,
                    true
                );
            }
        }

        panel.querySelector('#lcst-copy').addEventListener('click', () => {
            const copyBtn = panel.querySelector('#lcst-copy');
            // makeOutput menghitung ulang waktu WIB agar cutoff tetap tepat walau panel sudah lama terbuka.
            const output = makeOutput(state.scan);
            const betBlockedRows = getBlockedBetRows();
            const claimBlockedRows = getBlockedClaimRows();
            const allBlockedRows = Array.from(new Set(betBlockedRows.concat(claimBlockedRows))).sort((a, b) => a - b);
            const outputBox = panel.querySelector('#lcst-output');
            if (outputBox) outputBox.value = output;

            if (allBlockedRows.length && !output.trim()) {
                if (claimBlockedRows.length) {
                    const firstRow = claimBlockedRows[0];
                    showClaimExpiredNotification(firstRow, state.scan.claimDeadlineByRow[firstRow]);
                } else {
                    const firstRow = betBlockedRows[0];
                    showTidakCapaiNotification(firstRow, state.scan.betOddsByRow[firstRow]);
                }
                const reasons = [];
                if (claimBlockedRows.length) reasons.push('melewati batas claim 02.00 WIB');
                if (betBlockedRows.length) reasons.push('Taruhan di bawah 1,60');
                setOcrStatus('DANGER: Semua paket tidak dapat dicopy karena ' + reasons.join(' dan ') + '.', null, true);
                updateCopyAvailability();
                return;
            }

            if (allBlockedRows.length) {
                if (claimBlockedRows.length) {
                    const firstRow = claimBlockedRows[0];
                    showClaimExpiredNotification(firstRow, state.scan.claimDeadlineByRow[firstRow]);
                } else if (betBlockedRows.length) {
                    const firstRow = betBlockedRows[0];
                    showTidakCapaiNotification(firstRow, state.scan.betOddsByRow[firstRow]);
                }

                const messages = [];
                if (claimBlockedRows.length) {
                    messages.push(
                        'Paket ' + claimBlockedRows.map((row) => row + 1).join(', ') +
                        ' tidak ikut dicopy karena sudah melewati batas claim 02.00 WIB.'
                    );
                }
                if (betBlockedRows.length) {
                    messages.push(
                        'Paket ' + betBlockedRows.map((row) => row + 1).join(', ') +
                        ' tidak ikut dicopy karena Taruhan di bawah 1,60.'
                    );
                }
                setOcrStatus('DANGER: ' + messages.join('<br>') + ' Paket lainnya tetap disalin.', null, true);
            }

            copyText(output).then(() => {
                if (copyBtn) {
                    const oldText = copyBtn.textContent;
                    copyBtn.textContent = '✓ TERSALIN';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        if (!state.closed && copyBtn.isConnected) {
                            copyBtn.textContent = oldText;
                            copyBtn.classList.remove('copied');
                        }
                    }, 1200);
                }
            }).catch(() => {
                if (copyBtn) {
                    const oldText = copyBtn.textContent;
                    copyBtn.textContent = '! GAGAL';
                    setTimeout(() => {
                        if (!state.closed && copyBtn.isConnected) copyBtn.textContent = oldText;
                    }, 1400);
                }
                setOcrStatus('Gagal menyalin output. Blok isi kolom output lalu salin manual.', null, true);
            });
        });
        panel.querySelector('#lcst-rek-all').addEventListener('input', updateOutput);
        panel.querySelector('#lcst-rek-all').addEventListener('change', saveAccountValue);
        panel.querySelector('#lcst-rek-all').addEventListener('blur', saveAccountValue);
        document.addEventListener('keydown', escClose, true);
        document.addEventListener('selectionchange', flushPendingStatusWhenPossible, true);
        panel.addEventListener('copy', () => setTimeout(() => applyPendingStatus(false), 0));

        // Periksa waktu WIB berkala. Bila panel terbuka melewati 02.00 WIB,
        // status claim berubah otomatis tanpa perlu menekan SCAN ulang.
        lcstSyncOnlineTime(true);
        state.claimDeadlineTimer = setInterval(() => {
            lcstSyncOnlineTime(false);
            refreshClaimDeadlineClock();
        }, 1000);
        refreshClaimDeadlineClock();

        renderPeriodInputs(true);
        renderImages();
        fillAccountFromAdmin(state.scan.userId, false);
        if (state.scan.images.length) {
            setOcrStatus('Scan awal menemukan <b>' + state.scan.images.length + '</b> gambar. Deep scan sedang mengumpulkan dan menyusun screenshot secara otomatis.', 10);
        } else {
            setOcrStatus('Scan awal belum menemukan gambar. Deep scan sedang mengumpulkan lalu menyusun screenshot secara otomatis...', 6);
        }
        setTimeout(runDeepScan, 0);
    }

    ready(() => {
        lcstSyncOnlineTime(true);
        createBubble();
        // HYPER FAST: Tesseract + worker paket kedua + metadata dipanaskan saat bubble muncul,
        // bukan baru saat panel dibuka/SCAN ditekan. Ini memang memakai RAM lebih awal,
        // tetapi memangkas waktu tunggu tombol SCAN secara nyata.
        setTimeout(() => warmupOCRWorker(), 80);
        setInterval(createBubble, 8000);
    });
})();


  /**************** REGC MODULE ****************/
(function () {
  'use strict';

  if (location.hostname !== 'regc.idnlive.live') return;

  const CFG = {
    WEBAPP_URL: LT_COMBINED_WEBAPP_URL,
    SECRET: LT_COMBINED_SECRET,

    // Kecepatan baca antrean saat tidak sedang memproses.
    POLL_MS: 900,
    REQUEST_TIMEOUT_MS: 30000,
    RESULT_WAIT_MS: 12000,
    PAGE_WAIT_MS: 1100,
    MAX_PAGES: 25,

    // Bila tidak ditemukan, jangan stuck: tunda lalu lanjut user berikutnya.
    NOT_FOUND_DEFER_MS: 60000,
    NO_TABLE_DEFER_MS: 30000,

    // Jika 5 menit tidak ada pencarian User ID, Enter sekali pada Search by Nickname.
    KEEP_ALIVE_MS: 5 * 60 * 1000,

    // Saat antrean terlihat kosong, sinkron manual D/J dari Sheet tiap 10 detik.
    // Ini membuat baris yang ditempel manual juga cepat terbaca.
    IDLE_RESYNC_MS: 3000,

    // Tab REGC didedikasikan sebagai worker. Bila SPA keluar dari menu report saat
    // tab sedang di-background, script mengembalikannya ke halaman Transaction Region.
    WORKER_URL: 'https://regc.idnlive.live/report/transactionregion?%2Freport%2Ftransactionregion=',
    ROUTE_RECOVER_MS: 15000
  };

  const STATE_KEY = 'regc_auto_debit_enabled_v1';
  const PANEL_POS_KEY = 'regc_auto_debit_panel_position_v1';
  let enabled = localStorage.getItem(STATE_KEY) !== '0';
  let busy = false;
  let lastRealSearchAt = Date.now();
  let lastKeepAliveAt = 0;
  let loopTimer = null;
  let currentTask = null;
  let startupResynced = false;
  let lastIdleResyncAt = 0;
  let pendingWake = false;
  let lastLoopStartedAt = 0;
  let heartbeatWorker = null;
  let heartbeatUrl = '';
  let wakeListenerId = null;
  let lastRouteRecoverAt = 0;

  // v6.3.1 NO-FOCUS KEEP-ALIVE
  // Chrome dapat melakukan intensive throttling pada timer background.
  // Koneksi WebRTC lokal dengan RTCDataChannel yang tetap OPEN membuat tab
  // masuk kategori WebRTC aktif, sehingga background timer tidak jatuh ke
  // intensive-throttling 1-menit. Tidak memakai kamera/mikro/STUN/server luar.
  let bgRtcA = null;
  let bgRtcB = null;
  let bgRtcChannel = null;
  let bgRtcRemoteChannel = null;
  let bgRtcStarting = false;
  let bgRtcLastOpenAt = 0;
  let bgRtcRetryTimer = null;
  let bgRtcPulseTimer = null;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const text = v => String(v == null ? '' : v).trim();
  const normalizeUserId = v => text(v).toLowerCase();

  function configured() {
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:\?.*)?$/i.test(text(CFG.WEBAPP_URL));
  }

  function closeRegcBackgroundKeepAlive() {
    try { clearTimeout(bgRtcRetryTimer); } catch (e) {}
    try { clearInterval(bgRtcPulseTimer); } catch (e) {}
    bgRtcRetryTimer = null;
    bgRtcPulseTimer = null;
    try { if (bgRtcChannel) bgRtcChannel.close(); } catch (e) {}
    try { if (bgRtcRemoteChannel) bgRtcRemoteChannel.close(); } catch (e) {}
    try { if (bgRtcA) bgRtcA.close(); } catch (e) {}
    try { if (bgRtcB) bgRtcB.close(); } catch (e) {}
    bgRtcChannel = null;
    bgRtcRemoteChannel = null;
    bgRtcA = null;
    bgRtcB = null;
    bgRtcStarting = false;
  }

  function scheduleRegcBackgroundKeepAliveRetry(delay) {
    try { clearTimeout(bgRtcRetryTimer); } catch (e) {}
    bgRtcRetryTimer = setTimeout(function () {
      startRegcBackgroundKeepAlive().catch(function () {});
    }, Math.max(1000, Number(delay || 5000)));
  }

  async function startRegcBackgroundKeepAlive() {
    if (!enabled || bgRtcStarting) return;
    if (bgRtcChannel && bgRtcChannel.readyState === 'open') return;
    if (typeof RTCPeerConnection !== 'function') return;

    bgRtcStarting = true;
    closeRegcBackgroundKeepAlive();
    bgRtcStarting = true;

    try {
      // Peer-to-peer lokal, tanpa STUN/TURN dan tanpa media device.
      const pc1 = new RTCPeerConnection({ iceServers: [] });
      const pc2 = new RTCPeerConnection({ iceServers: [] });
      bgRtcA = pc1;
      bgRtcB = pc2;

      pc1.onicecandidate = function (e) {
        if (e.candidate) pc2.addIceCandidate(e.candidate).catch(function () {});
      };
      pc2.onicecandidate = function (e) {
        if (e.candidate) pc1.addIceCandidate(e.candidate).catch(function () {});
      };

      pc2.ondatachannel = function (e) {
        bgRtcRemoteChannel = e.channel;
        try { bgRtcRemoteChannel.onmessage = function () {}; } catch (ignore) {}
      };

      const channel = pc1.createDataChannel('regc-no-focus-keepalive', { ordered: false });
      bgRtcChannel = channel;

      channel.onopen = function () {
        bgRtcLastOpenAt = Date.now();
        bgRtcStarting = false;
        try { clearInterval(bgRtcPulseTimer); } catch (e) {}
        // Pulse sangat ringan; tujuannya menjaga data channel tetap aktif.
        bgRtcPulseTimer = setInterval(function () {
          try {
            if (bgRtcChannel && bgRtcChannel.readyState === 'open') {
              bgRtcChannel.send(String(Date.now()));
            } else {
              scheduleRegcBackgroundKeepAliveRetry(1500);
            }
          } catch (e) {
            scheduleRegcBackgroundKeepAliveRetry(1500);
          }
        }, 20000);
        wakeLoop('webrtc-open');
      };

      channel.onclose = function () {
        bgRtcStarting = false;
        scheduleRegcBackgroundKeepAliveRetry(1500);
      };
      channel.onerror = function () {
        bgRtcStarting = false;
        scheduleRegcBackgroundKeepAliveRetry(1500);
      };

      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);
      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);

      // Kalau 8 detik belum OPEN, buat ulang.
      setTimeout(function () {
        if (!bgRtcChannel || bgRtcChannel.readyState !== 'open') {
          bgRtcStarting = false;
          closeRegcBackgroundKeepAlive();
          scheduleRegcBackgroundKeepAliveRetry(2000);
        }
      }, 8000);
    } catch (e) {
      bgRtcStarting = false;
      closeRegcBackgroundKeepAlive();
      scheduleRegcBackgroundKeepAliveRetry(5000);
    }
  }

  function normalizeLoose(v) {
    return text(v)
      .toLowerCase()
      .normalize('NFKC')
      .replace(/\u00a0/g, ' ')
      .replace(/[^a-z0-9]+/g, '');
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  function setNativeValue(input, value) {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function pressEnter(input) {
    input.focus();
    const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    input.dispatchEvent(new KeyboardEvent('keydown', opts));
    input.dispatchEvent(new KeyboardEvent('keypress', opts));
    input.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  function findSearchButtonNear(input) {
    const roots = [];
    try {
      const form = input && input.closest ? input.closest('form') : null;
      if (form) roots.push(form);
      const group = input && input.closest ? input.closest('.form-group,.input-group,.row,.card,.panel,.ant-form-item,div') : null;
      if (group) roots.push(group);
    } catch (e) {}
    roots.push(document);

    let best = null;
    let bestScore = -1;
    const seen = new Set();
    for (const root of roots) {
      const buttons = Array.from(root.querySelectorAll('button,input[type="submit"],input[type="button"],a.btn,.btn'));
      for (const el of buttons) {
        if (seen.has(el) || !isVisible(el)) continue;
        seen.add(el);
        const label = [text(el.innerText), text(el.value), text(el.getAttribute('title')), text(el.getAttribute('aria-label')), text(el.className)].join(' ').toLowerCase();
        let score = 0;
        if (/search|cari|submit|filter/.test(label)) score += 100;
        if (/fa-search|search-icon|icon-search/.test(label)) score += 70;
        if (el.type === 'submit') score += 35;
        if (input && el.closest('form') && input.closest('form') === el.closest('form')) score += 45;
        if (score > bestScore) { best = el; bestScore = score; }
      }
    }
    return bestScore >= 35 ? best : null;
  }

  function submitNicknameSearch(input) {
    if (!input) throw new Error('SEARCH_BY_NICKNAME_TIDAK_DITEMUKAN');
    input.focus();

    // v6.0.6: ikuti alur manual REGC persis:
    // 1) tempel User ID ke Search by Nickname
    // 2) ENTER SATU KALI
    // Tidak klik tombol Search terlebih dahulu.
    pressEnter(input);
    return 'ENTER sekali';
  }

  function candidateContext(input) {
    const attrs = [
      input.getAttribute('placeholder'), input.getAttribute('name'), input.id,
      input.getAttribute('aria-label'), input.getAttribute('data-placeholder')
    ].map(text).join(' ');

    let nearby = '';
    try {
      const id = input.id;
      if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label) nearby += ' ' + text(label.textContent);
      }
      const parent = input.closest('label, .form-group, .form-item, .ant-form-item, .row, .col, div');
      if (parent) nearby += ' ' + text(parent.innerText).slice(0, 250);
    } catch (e) {}
    return (attrs + ' ' + nearby).toLowerCase();
  }

  function findNicknameInput() {
    const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([disabled]), textarea:not([disabled])')).filter(isVisible);

    // Cari yang benar-benar menyebut nickname pada atribut field terlebih dahulu.
    const exact = inputs.find(input => {
      const direct = [input.getAttribute('placeholder'), input.getAttribute('name'), input.id,
        input.getAttribute('aria-label'), input.getAttribute('data-placeholder')].map(text).join(' ').toLowerCase();
      return /search\s*by\s*nickname|nickname|nick\s*name/.test(direct) && !/password|captcha|email/.test(direct);
    });
    if (exact) return exact;

    let best = null;
    let bestScore = -1;
    for (const input of inputs) {
      const ctx = candidateContext(input);
      let score = 0;
      if (/search\s*by\s*nickname/.test(ctx)) score += 160;
      if (/nickname/.test(ctx)) score += 100;
      if (/nick\s*name/.test(ctx)) score += 90;
      if (/search/.test(ctx)) score += 20;
      if (/player|member|user/.test(ctx)) score += 10;
      if (input.type === 'search') score += 10;
      if (/password|captcha|email/.test(ctx)) score -= 200;
      if (score > bestScore) { best = input; bestScore = score; }
    }
    return bestScore >= 70 ? best : null;
  }

  function api(body) {
    return new Promise((resolve, reject) => {
      if (!configured()) {
        reject(new Error('WEBAPP_URL_BELUM_DIPASANG'));
        return;
      }
      GM_xmlhttpRequest({
        method: 'POST',
        url: CFG.WEBAPP_URL,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        data: JSON.stringify(Object.assign({ secret: CFG.SECRET }, body || {})),
        timeout: CFG.REQUEST_TIMEOUT_MS,
        onload: res => {
          let data = null;
          try { data = JSON.parse(res.responseText || '{}'); } catch (e) {}
          if (res.status >= 200 && res.status < 300 && data && data.ok) resolve(data);
          else reject(new Error(data && data.error ? data.error : `HTTP_${res.status}`));
        },
        onerror: () => reject(new Error('NETWORK_ERROR')),
        ontimeout: () => reject(new Error('REQUEST_TIMEOUT'))
      });
    });
  }

  function findReportTable() {
    const tables = Array.from(document.querySelectorAll('table')).filter(isVisible);
    let best = null;
    let bestScore = -1;

    for (const table of tables) {
      const headerCells = Array.from(table.querySelectorAll('thead th'));
      const fallback = headerCells.length ? headerCells : Array.from(table.querySelectorAll('tr:first-child th, tr:first-child td'));
      const headers = fallback.map(c => text(c.innerText || c.textContent));
      const normalized = headers.map(normalizeLoose);
      const periodIdx = normalized.findIndex(h => /period|periode|round|game.*id|game.*no|issue|draw/.test(h));
      const debitIdx = normalized.findIndex(h => /debit|bet.*amount|stake|wager|turnover/.test(h));
      const rowCount = table.querySelectorAll('tbody tr, tr').length;
      const tableText = text(table.innerText || table.textContent).slice(0, 2500);

      let score = 0;
      if (periodIdx >= 0) score += 90;
      if (debitIdx >= 0) score += 120;
      if (/transaction|report|nickname|debit|period|periode/i.test(tableText)) score += 25;
      if (rowCount > 1) score += 20;
      if (score > bestScore) { bestScore = score; best = { table, headers, periodIdx, debitIdx }; }
    }

    // Tidak wajib menemukan header Period dan Debit sekaligus.
    return bestScore >= 100 ? best : null;
  }

  function rowCells(tr) {
    return Array.from(tr.querySelectorAll(':scope > td, :scope > th'));
  }

  function debitNominalOnly(v) {
    const source = text(v).replace(/\u00a0/g, ' ').trim();
    if (!source) return '';

    // REGC sering menampilkan dalam satu blok:
    //   IDR 4,000
    //   Balance : IDR 116,456.27
    // Nominal transaksi adalah IDR PERTAMA sebelum kata Balance.
    const beforeBalance = source.split(/\bbalance\b/i)[0];
    const currency = beforeBalance.match(/\b(?:IDR|RP\.?)\s*([-+]?\d[\d.,]*)/i);
    if (currency && currency[1]) return text(currency[1]).replace(/\s+/g, '');

    let raw = beforeBalance
      .replace(/\bIDR\b/ig, ' ')
      .replace(/\bRP\.?\b/ig, ' ')
      .replace(/\brupiah\b/ig, ' ')
      .replace(/\bdebit\b/ig, ' ')
      .trim();

    // Ambil token nominal PERTAMA, bukan yang terakhir, agar Balance tidak terambil.
    const nums = raw.match(/[-+]?\d[\d.,]*/g);
    if (!nums || !nums.length) return '';
    return text(nums[0]).replace(/\s+/g, '');
  }

  function looksLikeAmount(v) {
    const raw = debitNominalOnly(v);
    return !!raw && /^[-+]?\d[\d.,]*$/.test(raw);
  }

  function fallbackDebitFromRow(cells, targetPeriod) {
    for (const cell of cells) {
      const meta = [cell.getAttribute('data-label'), cell.getAttribute('aria-label'), cell.getAttribute('title')].map(text).join(' ').toLowerCase();
      if (/debit|bet.*amount|stake|wager|turnover/.test(meta)) {
        const v = text(cell.innerText || cell.textContent);
        if (v) return v;
      }
    }
    // Sesuai tampilan REGC: Debit berada di bagian akhir row.
    for (let i = cells.length - 1; i >= 0; i--) {
      const v = text(cells[i].innerText || cells[i].textContent);
      if (!v || periodMatches(v, targetPeriod)) continue;
      if (looksLikeAmount(v)) return v;
    }
    return '';
  }

  function periodMatches(cellValue, target) {
    const a = normalizeLoose(cellValue);
    const b = normalizeLoose(target);
    if (!a || !b) return false;
    if (a === b) return true;
    // Fallback aman untuk tambahan prefix/suffix kecil dari tampilan REGC.
    if (b.length >= 6 && (a.includes(b) || b.includes(a))) return true;
    return false;
  }

  function elementOwnStatus(el) {
    if (!el) return '';
    const direct = text(el.innerText || el.textContent);
    const n = normalizeLoose(direct);
    if (n === 'debit') return 'debit';
    if (n === 'credit') return 'credit';
    return '';
  }

  function findExactStatusElement(root, wanted) {
    if (!root) return null;
    const selector = 'td,th,span,div,p,a,strong,b,small,label';
    const nodes = Array.from(root.querySelectorAll(selector));
    return nodes.find(el => isVisible(el) && elementOwnStatus(el) === wanted) || null;
  }

  function rowHasExactStatus(row, wanted) {
    return !!findExactStatusElement(row, wanted);
  }

  function findRowAroundDebitStatus(statusEl, targetPeriod) {
    if (!statusEl) return null;

    const tr = statusEl.closest && statusEl.closest('tr');
    if (tr && isVisible(tr) && periodMatches(text(tr.innerText || tr.textContent), targetPeriod)) return tr;

    // Untuk layout REGC berbasis DIV/card: ambil ancestor TERKECIL yang sudah
    // memuat status Debit dan periode target. Ini mencegah mengambil row Credit lain.
    let node = statusEl.parentElement;
    for (let i = 0; node && i < 12 && node !== document.body; i++, node = node.parentElement) {
      if (!isVisible(node)) continue;
      const rowText = text(node.innerText || node.textContent);
      if (!rowText || rowText.length > 9000) continue;
      if (periodMatches(rowText, targetPeriod)) return node;
    }
    return null;
  }

  function extractDebitAmountFromRow(row) {
    if (!row) return '';
    const rowText = text(row.innerText || row.textContent).replace(/\u00a0/g, ' ');
    if (!rowText) return '';

    // STATUS WAJIB DEBIT. Credit tidak pernah boleh menjadi sumber nominal.
    const debitStatus = findExactStatusElement(row, 'debit');
    if (!debitStatus) return '';

    // 1) Cara paling akurat: cari nominal IDR/Rp pertama SETELAH kata Debit,
    //    dan hentikan sebelum Balance.
    const debitMatch = /(?:^|[\s•·])Debit(?:[\s:]|$)/i.exec(rowText);
    if (debitMatch) {
      let afterDebit = rowText.slice(debitMatch.index + debitMatch[0].length);
      afterDebit = afterDebit.split(/\bBalance\b/i)[0];
      const m = afterDebit.match(/\b(?:IDR|RP\.?)\s*([-+]?\d[\d.,]*)/i);
      if (m && m[1]) return text(m[1]).replace(/\s+/g, '');
    }

    // 2) Untuk table: nominal biasanya berada di cell sesudah cell status Debit.
    const tr = debitStatus.closest && debitStatus.closest('tr');
    if (tr) {
      const cells = rowCells(tr);
      const statusCell = debitStatus.closest('td,th');
      const idx = statusCell ? cells.indexOf(statusCell) : -1;
      if (idx >= 0) {
        for (let i = idx + 1; i < cells.length; i++) {
          const cellText = text(cells[i].innerText || cells[i].textContent);
          if (!cellText) continue;
          const nominal = debitNominalOnly(cellText);
          if (nominal && /^[-+]?\d[\d.,]*$/.test(nominal)) return nominal;
        }
      }
    }

    // 3) Fallback DOM: cari blok sesudah status Debit yang punya IDR/Rp,
    //    tetap potong Balance dan ambil currency pertama.
    let parent = debitStatus.parentElement;
    for (let depth = 0; parent && depth < 5 && parent !== row; depth++, parent = parent.parentElement) {
      let sib = parent.nextElementSibling;
      for (let i = 0; sib && i < 5; i++, sib = sib.nextElementSibling) {
        const blockText = text(sib.innerText || sib.textContent);
        if (!blockText) continue;
        const nominal = debitNominalOnly(blockText);
        if (/\b(?:IDR|RP\.?)\b/i.test(blockText) && nominal) return nominal;
      }
    }

    return '';
  }

  function collectStrictDebitRows(targetPeriod, tableInfo) {
    const found = [];
    const seen = new Set();

    function add(row, matchedBy) {
      if (!row || seen.has(row) || !isVisible(row)) return;
      const rowText = text(row.innerText || row.textContent);
      if (!periodMatches(rowText, targetPeriod)) return;
      if (!rowHasExactStatus(row, 'debit')) return;
      seen.add(row);
      found.push({ row, matchedBy });
    }

    // Prioritas table row bila REGC memang memakai <table>.
    if (tableInfo && tableInfo.table) {
      const trs = Array.from(tableInfo.table.querySelectorAll('tbody tr, tr')).filter(isVisible);
      for (const tr of trs) add(tr, 'table-row+exact-debit');
    }

    // Fallback/adaptif untuk layout seperti screenshot (row/card berbasis div).
    const statusNodes = Array.from(document.querySelectorAll('td,th,span,div,p,a,strong,b,small,label'))
      .filter(el => isVisible(el) && elementOwnStatus(el) === 'debit');
    for (const statusEl of statusNodes) {
      const row = findRowAroundDebitStatus(statusEl, targetPeriod);
      add(row, 'status-debit+period-same-row');
    }

    // Urutkan sesuai posisi DOM agar kandidat TERAKHIR benar-benar row terbawah/terakhir.
    found.sort((a, b) => {
      if (a.row === b.row) return 0;
      const rel = a.row.compareDocumentPosition(b.row);
      if (rel & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (rel & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    return found;
  }

  function findDebitInCurrentTable(targetPeriod) {
    const info = findReportTable();
    const strictRows = collectStrictDebitRows(targetPeriod, info);

    let matches = 0;
    let debitMatches = 0;
    let lastMatch = null;

    // v6.0.6 RULE UTAMA:
    // 1. Periode harus cocok.
    // 2. STATUS PADA BARIS YANG SAMA WAJIB "Debit".
    // 3. "Credit" tidak pernah diambil meskipun periodenya sama.
    // 4. Dari blok Debit ambil nominal transaksi pertama; Balance diabaikan.
    // 5. Jika Debit periode yang sama muncul beberapa kali, row terakhir menang.
    for (let rowIndex = 0; rowIndex < strictRows.length; rowIndex++) {
      const entry = strictRows[rowIndex];
      const row = entry.row;
      matches++;

      const nominal = extractDebitAmountFromRow(row);
      const candidate = {
        tableFound: !!info || strictRows.length > 0,
        found: !!nominal,
        debit: nominal,
        rowText: text(row.innerText || row.textContent),
        table: (info && info.table) || row.parentElement || document.body,
        periodFound: true,
        matchedBy: entry.matchedBy,
        rowIndex,
        periodCellText: targetPeriod,
        status: 'Debit'
      };

      if (nominal) {
        debitMatches++;
        lastMatch = candidate;
      }
    }

    if (lastMatch) {
      return Object.assign({}, lastMatch, {
        tableFound: true,
        found: true,
        matches,
        debitMatches,
        debitEmpty: false
      });
    }

    // Kalau periode ada di halaman tetapi hanya muncul pada row Credit, tandai secara
    // khusus agar TIDAK mengambil nominal Credit dan tidak menulis K secara salah.
    let periodSeenAnywhere = false;
    let creditOnlyCount = 0;
    const candidateRows = info && info.table
      ? Array.from(info.table.querySelectorAll('tbody tr, tr')).filter(isVisible)
      : [];
    for (const row of candidateRows) {
      const rowText = text(row.innerText || row.textContent);
      if (!periodMatches(rowText, targetPeriod)) continue;
      periodSeenAnywhere = true;
      if (rowHasExactStatus(row, 'credit') && !rowHasExactStatus(row, 'debit')) creditOnlyCount++;
    }

    return {
      tableFound: !!info || strictRows.length > 0,
      found: false,
      table: (info && info.table) || null,
      matches,
      debitMatches,
      periodFound: matches > 0 || periodSeenAnywhere,
      debitEmpty: matches > 0,
      creditOnly: periodSeenAnywhere && matches === 0 && creditOnlyCount > 0
    };
  }

  function findNextButton(table) {
    const roots = [];
    if (table) {
      let root = table.closest('.dataTables_wrapper, .ant-table-wrapper, .table-responsive, .card, .panel, section, main');
      if (root) roots.push(root);
    }
    roots.push(document);

    const seen = new Set();
    let best = null;
    let bestScore = -1;

    for (const root of roots) {
      const candidates = Array.from(root.querySelectorAll('button, a, li'));
      for (const el of candidates) {
        if (seen.has(el) || !isVisible(el)) continue;
        seen.add(el);

        const cls = text(el.className).toLowerCase();
        const label = [text(el.innerText), text(el.getAttribute('aria-label')), text(el.getAttribute('title')), cls].join(' ').toLowerCase();
        let score = 0;
        if (/\bnext\b/.test(label)) score += 100;
        if (/berikut|selanjut/.test(label)) score += 90;
        if (/paginate_button\s+next|pagination.*next/.test(label)) score += 80;
        if (/^(>|›|»)$/.test(text(el.innerText))) score += 65;
        if (el.closest('.pagination, .paginate, .dataTables_paginate, .ant-pagination')) score += 30;

        const disabled = el.matches('[disabled], [aria-disabled="true"], .disabled') || /disabled/.test(cls) ||
          (el.parentElement && /disabled/.test(text(el.parentElement.className).toLowerCase()));
        if (disabled) score -= 300;

        if (score > bestScore) {
          bestScore = score;
          best = el;
        }
      }
    }
    return bestScore >= 70 ? best : null;
  }

  function tableSignature(table) {
    if (!table) return '';
    return text(table.innerText || table.textContent).slice(0, 8000);
  }

  // v6.2.5: helper REJECT SAJA. Tidak mengubah mesin pencarian periode/debit v6.0.6.
  function tableNoDataMarker(table) {
    if (!table) return false;
    const t = text(table.innerText || table.textContent).toLowerCase();
    return /no\s+data(?:\s+available)?|no\s+matching\s+records|no\s+records|data\s+tidak\s+ada|tidak\s+ada\s+data|tidak\s+ditemukan|not\s+found|empty/.test(t);
  }

  function countRealTransactionRows(table) {
    if (!table) return 0;
    let rows = Array.from(table.querySelectorAll('tbody tr')).filter(isVisible);
    if (!rows.length) rows = Array.from(table.querySelectorAll('tr')).filter(isVisible);
    let count = 0;
    for (const tr of rows) {
      const cells = rowCells(tr);
      if (!cells.length) continue;
      const rowText = text(tr.innerText || tr.textContent);
      if (!rowText) continue;
      const low = rowText.toLowerCase();
      if (/no\s+data|no\s+matching\s+records|no\s+records|data\s+tidak\s+ada|tidak\s+ada\s+data|empty/.test(low)) continue;
      // Header yang kebetulan berada di tbody tidak dihitung sebagai transaksi.
      const norm = normalizeLoose(rowText);
      if (/^(period|periode|debit|credit|balance|type|amount|transaction)+$/.test(norm)) continue;
      count++;
    }
    return count;
  }

  async function rejectTaskFinal(task, reason) {
    return api({
      action: 'finalizeRegc',
      row: task.row,
      userId: task.userId,
      period: task.period,
      result: 'REJECT',
      debit: '',
      reason: reason
    });
  }

  async function waitForTableReady(timeoutMs, previousSignature) {
    const end = Date.now() + timeoutMs;
    let latestInfo = null;
    let stableCount = 0;
    let lastSig = '';

    while (Date.now() < end) {
      latestInfo = findReportTable();
      if (latestInfo && latestInfo.table) {
        const sig = tableSignature(latestInfo.table);
        const changedFromPrevious = !previousSignature || !sig || sig !== previousSignature;
        if (sig && sig === lastSig) stableCount++;
        else stableCount = 0;
        lastSig = sig;

        // Sesudah search, tunggu data baru terlihat dan stabil sebentar supaya
        // kita tidak membaca tabel User ID sebelumnya.
        if (changedFromPrevious && sig && stableCount >= 2) return latestInfo;
      }
      await sleep(220);
    }
    return latestInfo;
  }

  async function waitForTableResult(targetPeriod, timeoutMs, previousSignature) {
    await waitForTableReady(timeoutMs, previousSignature);
    const end = Date.now() + Math.min(timeoutMs, 2500);
    let last = null;

    // Beri kesempatan row hasil render lengkap, tetapi JANGAN return hanya karena
    // ketemu satu debit. findDebitInCurrentTable sendiri memilih debit terakhir halaman.
    while (Date.now() < end) {
      last = findDebitInCurrentTable(targetPeriod);
      if (last.tableFound) {
        // dua kali baca singkat membantu table SPA yang merender row bertahap
        await sleep(180);
        const again = findDebitInCurrentTable(targetPeriod);
        if ((again.matches || 0) >= (last.matches || 0)) last = again;
        return last;
      }
      await sleep(220);
    }
    return last || { tableFound: false, found: false, matches: 0, debitMatches: 0 };
  }

  async function scanPagesForPeriod(targetPeriod, previousSignature) {
    // MESIN ASLI v6.0.6: scan SEMUA halaman dan debit terakhir menang.
    // v6.2.5 hanya MENAMBAHKAN statistik pasif untuk keputusan REJECT;
    // cara mencari periode/debit sama sekali tidak diubah.
    let current = await waitForTableResult(targetPeriod, CFG.RESULT_WAIT_MS, previousSignature);
    let table = current.table || (findReportTable() || {}).table;
    if (!table) return Object.assign({}, current, {
      realTransactionRows: 0,
      noDataMarker: false
    });

    let totalMatches = 0;
    let totalDebitMatches = 0;
    let lastFound = null;
    let anyPeriodFound = false;
    let anyDebitEmpty = false;
    let anyCreditOnly = false;
    let totalRealTransactionRows = 0;
    let anyNoDataMarker = false;
    const visited = new Set();

    for (let page = 0; page < CFG.MAX_PAGES; page++) {
      const pageResult = page === 0 ? current : findDebitInCurrentTable(targetPeriod);
      const pageTable = pageResult.table || table || (findReportTable() || {}).table;
      if (pageTable) {
        table = pageTable;
        totalRealTransactionRows += countRealTransactionRows(pageTable);
        if (tableNoDataMarker(pageTable)) anyNoDataMarker = true;
      }

      totalMatches += Number(pageResult.matches || 0);
      totalDebitMatches += Number(pageResult.debitMatches || 0);
      if (pageResult.periodFound || Number(pageResult.matches || 0) > 0) anyPeriodFound = true;
      if (pageResult.debitEmpty) anyDebitEmpty = true;
      if (pageResult.creditOnly) anyCreditOnly = true;
      if (pageResult.found && pageResult.debit) {
        lastFound = Object.assign({}, pageResult, { page: page + 1 });
        updatePanel('searching', `Periode ketemu • halaman ${page + 1}`, `STATUS=Debit • nominal sementara: ${pageResult.debit} • Credit/Balance diabaikan`);
      }

      const sig = tableSignature(table);
      if (sig) {
        if (visited.has(sig)) break;
        visited.add(sig);
      }

      const next = findNextButton(table);
      if (!next) break;

      const before = sig;
      next.click();

      const end = Date.now() + Math.max(CFG.PAGE_WAIT_MS + 2000, 3200);
      let changed = false;
      while (Date.now() < end) {
        await sleep(180);
        const freshInfo = findReportTable();
        if (freshInfo && freshInfo.table) table = freshInfo.table;
        const after = tableSignature(table);
        if (after && after !== before) {
          changed = true;
          break;
        }
      }

      if (!changed) break;
      await sleep(Math.max(180, CFG.PAGE_WAIT_MS));
    }

    if (lastFound) {
      return Object.assign({}, lastFound, {
        tableFound: true,
        found: true,
        matches: totalMatches,
        debitMatches: totalDebitMatches,
        periodFound: true,
        debitEmpty: false,
        realTransactionRows: totalRealTransactionRows,
        noDataMarker: anyNoDataMarker
      });
    }

    return {
      tableFound: true,
      found: false,
      table,
      matches: totalMatches,
      debitMatches: totalDebitMatches,
      periodFound: anyPeriodFound,
      debitEmpty: anyPeriodFound && anyDebitEmpty,
      creditOnly: anyCreditOnly && totalDebitMatches === 0,
      realTransactionRows: totalRealTransactionRows,
      noDataMarker: anyNoDataMarker
    };
  }

  async function searchNickname(userId, previousSignature) {
    userId = normalizeUserId(userId);
    let input = findNicknameInput();
    if (!input) {
      for (let i = 0; i < 28 && !input; i++) {
        await sleep(250);
        input = findNicknameInput();
      }
    }
    if (!input) throw new Error('SEARCH_BY_NICKNAME_TIDAK_DITEMUKAN');

    // Kosongkan lalu isi agar framework REGC mendeteksi perubahan nilai.
    setNativeValue(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(80);
    setNativeValue(input, userId);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(180);

    const mode = submitNicknameSearch(input);
    lastRealSearchAt = Date.now();
    const hint = text(input.getAttribute('placeholder') || input.getAttribute('name') || input.id || 'nickname');
    updatePanel('searching', `Cari ${userId}`, `${hint} • tempel ID → ${mode}`);

    // ENTER tetap hanya satu kali. Jika REGC tidak menangkap event keyboard buatan
    // Tampermonkey, fallback hanya men-submit FORM yang sama (tanpa klik tombol
    // dan tanpa mengirim ENTER kedua).
    await sleep(900);
    const hasLoading = Array.from(document.querySelectorAll('.loading,.spinner,.fa-spinner,[aria-busy="true"],.ant-spin,.dataTables_processing')).some(isVisible);
    const infoNow = findReportTable();
    const sigNow = infoNow && infoNow.table ? tableSignature(infoNow.table) : '';
    const changed = !!sigNow && (!previousSignature || sigNow !== previousSignature);
    if (!hasLoading && !changed) {
      const form = input.closest && input.closest('form');
      if (form && typeof form.requestSubmit === 'function') {
        form.requestSubmit();
        updatePanel('searching', `Cari ${userId}`, `${hint} • ENTER → submit form fallback`);
      } else {
        // Banyak halaman REGC tidak membungkus nickname di <form>.
        // Jika ENTER tidak mengubah hasil (terutama saat tab background), klik tombol
        // Search TERDEKAT sebagai fallback satu kali. Mesin baca periode/debit tetap sama.
        const btn = findSearchButtonNear(input);
        if (btn) {
          try { btn.click(); } catch (ignore) {}
          updatePanel('searching', `Cari ${userId}`, `${hint} • ENTER → klik Search fallback`);
        }
      }
    }
    return input;
  }

  async function processTask(task) {
    task = Object.assign({}, task, { userId: normalizeUserId(task && task.userId) });
    currentTask = task;
    updatePanel('searching', `Cari ${task.userId}`, `Periode ${task.period} • Sheet row ${task.row}`);

    try {
      // PUTARAN PERTAMA = 100% mesin v6.0.6.
      const oldTableInfo = findReportTable();
      const oldTableSignature = oldTableInfo && oldTableInfo.table ? tableSignature(oldTableInfo.table) : '';
      await searchNickname(task.userId, oldTableSignature);
      let result = await scanPagesForPeriod(task.period, oldTableSignature);

      if (result.found && result.debit) {
        const nominal = debitNominalOnly(result.debit);
        if (!nominal) throw new Error('NOMINAL_DEBIT_TIDAK_TERBACA');
        updatePanel('writing', `Debit cocok: ${nominal}`, `Periode + STATUS Debit cocok • hanya nominal transaksi → K${task.row}`);
        const saved = await api({
          action: 'updateDebit',
          row: task.row,
          userId: task.userId,
          period: task.period,
          debit: nominal
        });
        updatePanel('success', `${task.userId} selesai`, `K${task.row}=${nominal} • N${task.row}=done`);
        await sleep(350);
        return saved;
      }

      // ATURAN PALING PENTING:
      // PERIODE ADA = TIDAK PERNAH REJECT.
      // Walau Debit belum terbaca, perilaku kembali seperti versi pertama: defer lalu cari ulang.
      if (result.periodFound) {
        const reason = result.creditOnly
          ? 'PERIODE_ADA_HANYA_CREDIT_TUNGGU_DEBIT'
          : (result.debitEmpty ? 'PERIODE_ADA_DEBIT_BELUM_TERBACA' : 'PERIODE_ADA_TUNGGU_DEBIT');
        await api({
          action: 'deferPending',
          row: task.row,
          userId: task.userId,
          reason,
          delayMs: CFG.NOT_FOUND_DEFER_MS
        });
        updatePanel('warning', `Periode ${task.period} ADA`, 'JANGAN REJECT • akan dicari ulang sampai Debit terbaca');
        await sleep(250);
        return null;
      }

      // Kalau tabel bahkan belum jelas muncul, JANGAN membuat keputusan reject.
      if (!result.tableFound) {
        await api({
          action: 'deferPending',
          row: task.row,
          userId: task.userId,
          reason: 'TABLE_REGC_BELUM_MUNCUL',
          delayMs: CFG.NO_TABLE_DEFER_MS
        });
        updatePanel('warning', `${task.userId} ditunda`, 'Hasil REGC belum pasti • tidak direject');
        return null;
      }

      // REJECT adalah TAMBAHAN TERAKHIR SAJA.
      // Karena periode tidak terlihat pada putaran pertama, lakukan pencarian USER ID
      // YANG SAMA sekali lagi memakai mesin v6.0.6 sebelum boleh REJECT.
      updatePanel('searching', `Konfirmasi ${task.userId}`, `Periode ${task.period} belum terlihat • cek sekali lagi sebelum REJECT`);
      const confirmInfo = findReportTable();
      const confirmOldSig = confirmInfo && confirmInfo.table ? tableSignature(confirmInfo.table) : '';
      await searchNickname(task.userId, confirmOldSig);
      const confirm = await scanPagesForPeriod(task.period, confirmOldSig);

      // Kalau pada konfirmasi periode/debit ternyata ada, keputusan REJECT dibatalkan.
      if (confirm.found && confirm.debit) {
        const nominal = debitNominalOnly(confirm.debit);
        if (!nominal) throw new Error('NOMINAL_DEBIT_TIDAK_TERBACA');
        const saved = await api({
          action: 'updateDebit', row: task.row, userId: task.userId,
          period: task.period, debit: nominal
        });
        updatePanel('success', `${task.userId} selesai`, `Konfirmasi menemukan Debit ${nominal} • K${task.row} • N=done`);
        return saved;
      }

      if (confirm.periodFound) {
        await api({
          action: 'deferPending', row: task.row, userId: task.userId,
          reason: 'PERIODE_ADA_TUNGGU_DEBIT', delayMs: CFG.NOT_FOUND_DEFER_MS
        });
        updatePanel('warning', `Periode ${task.period} ADA`, 'Konfirmasi menemukan periode • REJECT DIBATALKAN');
        return null;
      }

      // Kalau hasil konfirmasi masih belum jelas, tetap jangan reject.
      if (!confirm.tableFound) {
        await api({
          action: 'deferPending', row: task.row, userId: task.userId,
          reason: 'HASIL_KONFIRMASI_BELUM_PASTI', delayMs: CFG.NO_TABLE_DEFER_MS
        });
        updatePanel('warning', `${task.userId} ditunda`, 'Konfirmasi belum pasti • tidak direject');
        return null;
      }

      const firstRows = Number(result.realTransactionRows || 0);
      const secondRows = Number(confirm.realTransactionRows || 0);
      const confirmedNoData = !!result.noDataMarker && !!confirm.noDataMarker;
      const confirmedHasTransactions = firstRows > 0 && secondRows > 0;

      // REJECT #1: User ID benar-benar tidak ada bermain.
      // Harus ada marker no-data pada DUA pencarian. Tidak cukup hanya parser gagal.
      if (confirmedNoData) {
        updatePanel('writing', `REJECT ${task.userId}`, `Dua kali hasil REGC kosong • N${task.row}=REJECT`);
        await rejectTaskFinal(task, 'User ID tidak ada bermain');
        updatePanel('warning', `${task.userId} REJECT`, 'User ID tidak ada bermain');
        return null;
      }

      // REJECT #2: User ID punya transaksi, tetapi periode target benar-benar tidak ada.
      // Harus ada transaksi nyata pada DUA pencarian dan periode tidak ditemukan pada keduanya.
      if (confirmedHasTransactions) {
        updatePanel('writing', `REJECT ${task.userId}`, `User ID ada transaksi tetapi periode ${task.period} tidak ada`);
        await rejectTaskFinal(task, 'Periksa User ID');
        updatePanel('warning', `${task.userId} REJECT`, 'Periksa User ID');
        return null;
      }

      // Kondisi ambigu = jangan reject. Ini sengaja konservatif untuk mencegah
      // periode yang sebenarnya ada ikut ter-REJECT.
      await api({
        action: 'deferPending', row: task.row, userId: task.userId,
        reason: 'HASIL_REGC_AMBIGU_JANGAN_REJECT', delayMs: CFG.NO_TABLE_DEFER_MS
      });
      updatePanel('warning', `${task.userId} ditunda`, 'Hasil belum cukup pasti untuk REJECT • akan dicari ulang');
      return null;

    } catch (err) {
      const message = text(err && err.message ? err.message : err);
      try {
        await api({
          action: 'deferPending',
          row: task.row,
          userId: task.userId,
          reason: message || 'ERROR',
          delayMs: CFG.NO_TABLE_DEFER_MS
        });
      } catch (ignore) {}
      updatePanel('error', 'Pencarian gagal', `${message || 'ERROR'} • TIDAK direject karena hasil belum pasti`);
      await sleep(500);
      return null;
    } finally {
      currentTask = null;
    }
  }

  async function keepAliveIfNeeded() {
    if (!enabled || busy) return;
    const now = Date.now();
    if ((now - lastRealSearchAt) < CFG.KEEP_ALIVE_MS) return;
    if ((now - lastKeepAliveAt) < CFG.KEEP_ALIVE_MS) return;

    const input = findNicknameInput();
    if (!input) return;
    // Sesuai permintaan: tidak mengubah ID, cukup Enter sekali.
    pressEnter(input);
    lastKeepAliveAt = now;
    lastRealSearchAt = now;
    updatePanel('idle', 'Keep-alive REGC', '5 menit idle → Enter sekali pada Search by Nickname');
  }

  function scheduleLoop(delayMs) {
    try { clearTimeout(loopTimer); } catch (e) {}
    loopTimer = setTimeout(loop, Math.max(0, Number(delayMs || 0)));
  }

  function wakeLoop(reason) {
    if (!enabled) return;
    pendingWake = true;
    // Kalau sedang memproses User ID, jangan potong prosesnya. Begitu selesai,
    // finally akan mengambil antrean baru nyaris tanpa jeda.
    if (busy) return;
    scheduleLoop(20);
  }

  function startBackgroundHeartbeat() {
    if (heartbeatWorker) return;
    try {
      const code = `
        let timer = null;
        function start(){ if(timer) clearInterval(timer); timer=setInterval(()=>postMessage(Date.now()), 750); }
        onmessage = (e)=>{ if(e && e.data==='start') start(); };
        start();
      `;
      const blob = new Blob([code], { type: 'application/javascript' });
      heartbeatUrl = URL.createObjectURL(blob);
      heartbeatWorker = new Worker(heartbeatUrl);
      heartbeatWorker.onmessage = function () {
        // Main setTimeout pada background tab bisa di-throttle browser.
        // Dedicated worker memberi heartbeat tambahan. Hanya wake bila loop tidak
        // berjalan sesuai cadence, sehingga tidak membuat request ganda.
        if (!enabled || busy) return;
        if ((Date.now() - lastLoopStartedAt) >= 900) wakeLoop('heartbeat');
      };
    } catch (e) {
      // Fallback biasa; tetap lebih baik daripada tidak ada watchdog sama sekali.
      setInterval(function(){
        if (!enabled || busy) return;
        if ((Date.now() - lastLoopStartedAt) >= 1200) wakeLoop('fallback-heartbeat');
      }, 1000);
    }
  }

  function installCrossTabWake() {
    if (typeof GM_addValueChangeListener !== 'function' || wakeListenerId != null) return;
    try {
      wakeListenerId = GM_addValueChangeListener(LT_REGC_WAKE_KEY, function (name, oldValue, newValue, remote) {
        // Saat LiveChat menulis D:J, worker REGC langsung jalan meskipun tab REGC
        // sedang tidak aktif. Tidak menunggu polling 10 detik / reload halaman.
        wakeLoop(remote ? 'livechat-remote' : 'wake');
      });
    } catch (e) {}
  }

  async function loop() {
    clearTimeout(loopTimer);
    lastLoopStartedAt = Date.now();
    pendingWake = false;

    if (!enabled) {
      updatePanel('off', 'AUTO OFF', 'Klik ON untuk menjalankan pencarian otomatis.');
      scheduleLoop(1500);
      return;
    }

    if (!configured()) {
      updatePanel('error', 'URL Apps Script belum dipasang', 'Menu Tampermonkey → LINETOGEL: Set Google Apps Script /exec.');
      scheduleLoop(5000);
      return;
    }

    if (!/\/report\/transactionregion/i.test(location.pathname + location.search)) {
      const here = (location.pathname + location.search).toLowerCase();
      if (/login|sign[-_]?in|auth/.test(here)) {
        updatePanel('error', 'Sesi REGC perlu login', 'Login REGC satu kali. Setelah itu tab boleh ditinggal di background.');
        scheduleLoop(5000);
        return;
      }
      // Bila tab dedicated worker sedang tidak dilihat, pulihkan route otomatis.
      // Saat user sedang melihat tab REGC, jangan paksa pindah halaman.
      if (document.hidden && (Date.now() - lastRouteRecoverAt) >= CFG.ROUTE_RECOVER_MS) {
        lastRouteRecoverAt = Date.now();
        updatePanel('idle', 'Pulihkan halaman worker', 'Kembali otomatis ke Transaction Region...');
        try { location.assign(CFG.WORKER_URL); } catch (ignore) {}
        return;
      }
      updatePanel('idle', 'Menunggu halaman REGC', 'Tab worker harus berada di Transaction Region. Jika ditinggal di background, route dipulihkan otomatis.');
      scheduleLoop(2000);
      return;
    }

    if (busy) {
      scheduleLoop(500);
      return;
    }

    busy = true;
    let nextDelay = CFG.POLL_MS;
    try {
      // Saat REGC baru dibuka, paksa satu kali sinkron D/J.
      // Ini menangkap data yang sudah keburu ditempel sebelum tab REGC aktif.
      if (!startupResynced) {
        const rs = await api({ action: 'resyncQueue' });
        startupResynced = true;
        lastIdleResyncAt = Date.now();
        setQueueCount(rs.queueCount || 0);
      }

      let next = await api({ action: 'nextPending' });
      if (next && next.pending) next.userId = normalizeUserId(next.userId);

      // Bila antrean kosong, cek ulang Sheet secara berkala agar data yang
      // ditempel manual ke D/J tidak menunggu cache server terlalu lama.
      if (!next.pending && (Date.now() - lastIdleResyncAt) >= CFG.IDLE_RESYNC_MS) {
        const rs = await api({ action: 'resyncQueue' });
        lastIdleResyncAt = Date.now();
        setQueueCount(rs.queueCount || 0);
        if (Number(rs.queueCount || 0) > 0) {
          next = await api({ action: 'nextPending' });
          if (next && next.pending) next.userId = normalizeUserId(next.userId);
        }
      }

      setQueueCount(next.queueCount || 0);
      if (next.pending) {
        await processTask(next);
        nextDelay = 120; // selesai satu → langsung ambil antrean berikutnya
      } else {
        await keepAliveIfNeeded();
        nextDelay = Math.max(1200, Math.min(Number(next.retryAfterMs || CFG.POLL_MS), CFG.POLL_MS));
        const rtcState = bgRtcChannel && bgRtcChannel.readyState === 'open' ? 'NO-FOCUS ON' : 'keep-alive menyiapkan';
        updatePanel('idle', 'Menunggu data baru', `Antrean ${Number(next.queueCount || 0)} • ${rtcState} • tidak perlu fokus tab`);
      }
    } catch (err) {
      const msg = text(err && err.message ? err.message : err);
      if (/ACTION_TIDAK_DIKENAL/i.test(msg)) {
        updatePanel('error', 'Apps Script masih versi lama', 'Deploy Google Apps Script REGC v2/v2.1 lalu Update deployment. D:J lama bisa masuk, tetapi nextPending belum tersedia.');
      } else if (/SECRET_TIDAK_VALID/i.test(msg)) {
        updatePanel('error', 'Secret Apps Script berbeda', 'Gunakan file Apps Script yang satu paket dengan Tampermonkey ini.');
      } else {
        updatePanel('error', 'Koneksi Sheet bermasalah', msg);
      }
      nextDelay = 5000;
    } finally {
      busy = false;
      // Kalau D:J baru masuk ketika proses sebelumnya masih berjalan, ambil pekerjaan
      // berikutnya langsung tanpa menunggu cadence polling normal.
      if (pendingWake) nextDelay = Math.min(nextDelay, 40);
      scheduleLoop(nextDelay);
    }
  }

  function injectPanel() {
    if (document.getElementById('regc-auto-debit-panel')) return;
    const style = document.createElement('style');
    style.textContent = `
      #regc-auto-debit-panel{position:fixed;right:18px;bottom:18px;z-index:2147483647;width:330px;background:rgba(14,18,28,.94);color:#eef4ff;border:1px solid rgba(255,255,255,.14);border-radius:16px;box-shadow:0 18px 55px rgba(0,0,0,.35);font:12px/1.4 Inter,Segoe UI,Arial,sans-serif;backdrop-filter:blur(12px);overflow:hidden}
      #regc-auto-debit-panel .rg-head{display:flex;align-items:center;gap:9px;padding:11px 12px;border-bottom:1px solid rgba(255,255,255,.09);cursor:move;user-select:none;touch-action:none}
      #regc-auto-debit-panel.rg-dragging{opacity:.96;box-shadow:0 24px 70px rgba(0,0,0,.48)}
      #regc-auto-debit-panel .rg-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 14px currentColor}
      #regc-auto-debit-panel .rg-title{font-weight:900;letter-spacing:.3px;flex:1}
      #regc-auto-debit-panel .rg-queue{padding:2px 7px;border-radius:999px;background:rgba(255,255,255,.08);font-weight:800}
      #regc-auto-debit-panel .rg-toggle{border:0;border-radius:9px;padding:6px 10px;font-weight:900;cursor:pointer;background:#22c55e;color:#07110b}
      #regc-auto-debit-panel .rg-toggle.off{background:#ef4444;color:white}
      #regc-auto-debit-panel .rg-body{padding:12px}
      #regc-auto-debit-panel .rg-main{font-size:13px;font-weight:850;margin-bottom:4px}
      #regc-auto-debit-panel .rg-sub{color:#9fb0ca;word-break:break-word}
      #regc-auto-debit-panel[data-state="error"] .rg-dot{background:#ef4444}
      #regc-auto-debit-panel[data-state="warning"] .rg-dot{background:#f59e0b}
      #regc-auto-debit-panel[data-state="searching"] .rg-dot,#regc-auto-debit-panel[data-state="writing"] .rg-dot{background:#38bdf8}
      #regc-auto-debit-panel[data-state="off"] .rg-dot{background:#64748b}
    `;
    document.documentElement.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'regc-auto-debit-panel';
    panel.innerHTML = `
      <div class="rg-head">
        <span class="rg-dot"></span>
        <span class="rg-title">REGC AUTO DEBIT</span>
        <span class="rg-queue" title="Jumlah antrean">0</span>
        <button class="rg-toggle">ON</button>
      </div>
      <div class="rg-body">
        <div class="rg-main">Memulai...</div>
        <div class="rg-sub">Menyiapkan pencarian otomatis.</div>
      </div>`;
    document.body.appendChild(panel);

    restorePanelPosition(panel);
    enablePanelDrag(panel);

    const btn = panel.querySelector('.rg-toggle');
    btn.addEventListener('click', () => {
      enabled = !enabled;
      localStorage.setItem(STATE_KEY, enabled ? '1' : '0');
      syncToggle();
      if (enabled) {
        startRegcBackgroundKeepAlive().catch(function () {});
        clearTimeout(loopTimer);
        wakeLoop('toggle-on');
      } else {
        closeRegcBackgroundKeepAlive();
      }
    });
    syncToggle();
  }

  function clampPanelPosition(panel, left, top) {
    const rect = panel.getBoundingClientRect();
    const margin = 6;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    return {
      left: Math.min(Math.max(margin, left), maxLeft),
      top: Math.min(Math.max(margin, top), maxTop)
    };
  }

  function savePanelPosition(panel) {
    try {
      const rect = panel.getBoundingClientRect();
      localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
    } catch (e) {}
  }

  function restorePanelPosition(panel) {
    try {
      const raw = localStorage.getItem(PANEL_POS_KEY);
      if (!raw) return;
      const pos = JSON.parse(raw);
      if (!Number.isFinite(Number(pos.left)) || !Number.isFinite(Number(pos.top))) return;
      const safe = clampPanelPosition(panel, Number(pos.left), Number(pos.top));
      panel.style.left = safe.left + 'px';
      panel.style.top = safe.top + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    } catch (e) {}
  }

  function enablePanelDrag(panel) {
    const handle = panel.querySelector('.rg-head');
    if (!handle) return;

    let dragging = false;
    let pointerId = null;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener('pointerdown', (ev) => {
      // Tombol ON/OFF tetap bisa diklik normal.
      if (ev.target.closest('.rg-toggle')) return;
      if (ev.button !== undefined && ev.button !== 0) return;

      const rect = panel.getBoundingClientRect();
      dragging = true;
      pointerId = ev.pointerId;
      offsetX = ev.clientX - rect.left;
      offsetY = ev.clientY - rect.top;

      panel.style.left = rect.left + 'px';
      panel.style.top = rect.top + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.classList.add('rg-dragging');

      try { handle.setPointerCapture(pointerId); } catch (e) {}
      ev.preventDefault();
    });

    handle.addEventListener('pointermove', (ev) => {
      if (!dragging || (pointerId !== null && ev.pointerId !== pointerId)) return;
      const safe = clampPanelPosition(panel, ev.clientX - offsetX, ev.clientY - offsetY);
      panel.style.left = safe.left + 'px';
      panel.style.top = safe.top + 'px';
      ev.preventDefault();
    });

    const stopDrag = (ev) => {
      if (!dragging) return;
      if (ev && pointerId !== null && ev.pointerId !== undefined && ev.pointerId !== pointerId) return;
      dragging = false;
      panel.classList.remove('rg-dragging');
      try { handle.releasePointerCapture(pointerId); } catch (e) {}
      pointerId = null;
      savePanelPosition(panel);
    };

    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);

    window.addEventListener('resize', () => {
      const rect = panel.getBoundingClientRect();
      const safe = clampPanelPosition(panel, rect.left, rect.top);
      panel.style.left = safe.left + 'px';
      panel.style.top = safe.top + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      savePanelPosition(panel);
    });
  }

  function syncToggle() {
    const btn = document.querySelector('#regc-auto-debit-panel .rg-toggle');
    if (!btn) return;
    btn.textContent = enabled ? 'ON' : 'OFF';
    btn.classList.toggle('off', !enabled);
  }

  function setQueueCount(count) {
    const el = document.querySelector('#regc-auto-debit-panel .rg-queue');
    if (el) el.textContent = String(count || 0);
  }

  function updatePanel(state, main, sub) {
    const panel = document.getElementById('regc-auto-debit-panel');
    if (!panel) return;
    panel.dataset.state = state || 'idle';
    const m = panel.querySelector('.rg-main');
    const s = panel.querySelector('.rg-sub');
    if (m) m.textContent = text(main);
    if (s) s.textContent = text(sub);
  }

  function start() {
    if (!document.body) return setTimeout(start, 100);
    injectPanel();
    installCrossTabWake();
    startBackgroundHeartbeat();
    startRegcBackgroundKeepAlive().catch(function () {});

    // Resume segera ketika browser mengaktifkan ulang page lifecycle / koneksi.
    window.addEventListener('pageshow', () => {
      startRegcBackgroundKeepAlive().catch(function () {});
      wakeLoop('pageshow');
    });
    window.addEventListener('online', () => {
      startRegcBackgroundKeepAlive().catch(function () {});
      wakeLoop('online');
    });
    document.addEventListener('visibilitychange', () => {
      // Saat menjadi hidden, JANGAN stop worker. Pastikan WebRTC keep-alive hidup.
      startRegcBackgroundKeepAlive().catch(function () {});
      wakeLoop(document.hidden ? 'hidden-no-focus' : 'visible-again');
    });
    document.addEventListener('resume', () => {
      startRegcBackgroundKeepAlive().catch(function () {});
      wakeLoop('resume');
    });
    document.addEventListener('freeze', () => {
      // Jika Chrome benar-benar mem-freeze page, tidak ada userscript yang bisa
      // mengeksekusi task sampai resume. Catat state; saat resume worker langsung lanjut.
      try { GM_setValue('lt_regc_last_freeze_v631', Date.now()); } catch (e) {}
    });

    // Bila tab pernah dibuang Chrome lalu direload saat kembali, langsung resync.
    if (document.wasDiscarded) {
      startupResynced = false;
      pendingWake = true;
    }

    scheduleLoop(80);
  }

  start();
})();

})();
