// ==UserScript==
// @name         LiveChat OCR Claim Jam 2 WIB - TERPISAH
// @namespace    linetogel-livechat-ocr-claim-jam2-independent
// @version      1.5.1
// @description  Ultra Fast Scan + baca Taruhan MINBET 1,60; di bawah 1,60 otomatis TIDAK CAPAI MINBET dan tidak dapat claim/copy.
// @author       Random
// @match        https://my.livechatinc.com/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      *
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    if (location.hostname !== 'my.livechatinc.com') return;

    // Versi terbaru mengambil alih UI lama bila lebih dari satu versi tidak sengaja aktif.
    // Ini mencegah script lama memblokir perbaikan melalui guard boolean yang sama.
    const LCJ2_BUILD_VERSION = '1.5.1-minbet-160';
    const lcj2ExistingInstance = window.__LCJ2_OCR_CLAIM_JAM2_INDEPENDENT__;
    if (lcj2ExistingInstance && typeof lcj2ExistingInstance === 'object' && lcj2ExistingInstance.version === LCJ2_BUILD_VERSION) return;
    try {
        const oldPanel = document.getElementById('lcj2-panel-fixed');
        const oldBubble = document.getElementById('lcj2-bubble-fixed');
        if (oldPanel) oldPanel.remove();
        if (oldBubble) oldBubble.remove();
    } catch (e) {}
    window.__LCJ2_OCR_CLAIM_JAM2_INDEPENDENT__ = { version: LCJ2_BUILD_VERSION, startedAt: Date.now() };

    const POS_KEY = 'lcj2_ocr_claim_jam2_position_v1';
    const DB_KEY  = 'lcj2_ocr_claim_jam2_account_db_v1';
    const Z_TOP   = 2147483647;

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
        if (document.getElementById('lcj2-style-active-only')) return;
        const style = document.createElement('style');
        style.id = 'lcj2-style-active-only';
        style.textContent = `
            :root{
                --lcj2-bg:#050816;
                --lcj2-surface:rgba(13,19,38,.88);
                --lcj2-surface-2:rgba(18,27,51,.82);
                --lcj2-line:rgba(148,163,184,.16);
                --lcj2-text:#eef6ff;
                --lcj2-muted:#8fa3bf;
                --lcj2-cyan:#22d3ee;
                --lcj2-blue:#3b82f6;
                --lcj2-violet:#8b5cf6;
                --lcj2-green:#22c55e;
                --lcj2-red:#fb4f68;
                --lcj2-orange:#f5a524;
                --lcj2-radius:18px;
            }
            #lcj2-bubble-fixed{
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
            #lcj2-bubble-fixed:before{
                content:"";
                position:absolute;
                width:54px;
                height:54px;
                border-radius:50%;
                border:1px solid rgba(34,211,238,.28);
                box-shadow:0 0 25px rgba(34,211,238,.12),inset 0 0 20px rgba(59,130,246,.10);
                animation:lcj2Pulse 2.2s ease-in-out infinite;
            }
            #lcj2-bubble-fixed:after{
                content:"";
                position:absolute;
                inset:-45%;
                background:conic-gradient(from 90deg,transparent 0 26%,rgba(34,211,238,.50) 34%,transparent 42% 65%,rgba(139,92,246,.45) 74%,transparent 83%);
                animation:lcj2Spin 5.5s linear infinite;
                opacity:.62;
            }
            #lcj2-bubble-fixed .lcj2-icon{
                position:relative;
                z-index:2;
                width:23px;
                height:23px;
                border:2px solid #7eeeff;
                border-radius:8px;
                box-shadow:0 0 18px rgba(34,211,238,.42);
            }
            #lcj2-bubble-fixed .lcj2-icon:before{
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
            #lcj2-bubble-fixed .lcj2-icon:after{
                content:"";
                position:absolute;
                left:4px;
                right:4px;
                bottom:4px;
                height:2px;
                border-radius:4px;
                background:linear-gradient(90deg,#22d3ee,#8b5cf6);
            }
            #lcj2-bubble-fixed .lcj2-text{
                position:relative;
                z-index:2;
                font-size:10px;
                line-height:1;
                font-weight:900;
                letter-spacing:1.5px;
                color:#dffbff;
            }
            #lcj2-bubble-fixed:hover{
                transform:translateY(-3px) scale(1.035);
                border-color:rgba(34,211,238,.55);
                box-shadow:0 26px 65px rgba(0,0,0,.65),0 0 30px rgba(34,211,238,.20),inset 0 1px 0 rgba(255,255,255,.22);
            }
            #lcj2-bubble-fixed.lcj2-dragging{cursor:grabbing;transform:scale(1.04);opacity:.94}
            @keyframes lcj2Spin{to{transform:rotate(360deg)}}
            @keyframes lcj2Pulse{0%,100%{transform:scale(.92);opacity:.55}50%{transform:scale(1.08);opacity:1}}
            @keyframes lcj2Blink{0%,100%{opacity:.45}50%{opacity:1}}

            #lcj2-panel-fixed{
                position:fixed;
                inset:0;
                z-index:${Z_TOP - 1};
                color:var(--lcj2-text);
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
            #lcj2-panel-fixed:before{
                content:"";
                position:fixed;
                inset:0;
                pointer-events:none;
                opacity:.22;
                background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);
                background-size:32px 32px;
            }
            #lcj2-panel-fixed *{box-sizing:border-box}
            #lcj2-panel-fixed button,#lcj2-panel-fixed input,#lcj2-panel-fixed textarea{font-family:inherit}
            /* Paksa teks dashboard tetap dapat diseleksi/copy, termasuk saat OCR berjalan. */
            #lcj2-panel-fixed,#lcj2-panel-fixed .lcj2-wrap,#lcj2-panel-fixed section,#lcj2-panel-fixed div,#lcj2-panel-fixed span,#lcj2-panel-fixed b,#lcj2-panel-fixed textarea,#lcj2-panel-fixed input{
                -webkit-user-select:text!important;user-select:text!important
            }
            #lcj2-panel-fixed button,#lcj2-panel-fixed img,#lcj2-panel-fixed .lcj2-img-card,#lcj2-panel-fixed .lcj2-brand-logo,#lcj2-panel-fixed .lcj2-status-icon,#lcj2-panel-fixed .lcj2-progress{
                -webkit-user-select:none!important;user-select:none!important
            }
            .lcj2-wrap{position:relative;max-width:1480px;margin:0 auto}
            .lcj2-topbar{
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:18px;
                margin-bottom:16px;
                padding:16px 18px;
                border:1px solid var(--lcj2-line);
                border-radius:22px;
                background:linear-gradient(135deg,rgba(20,30,56,.90),rgba(8,12,27,.84));
                box-shadow:0 20px 55px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.05);
            }
            .lcj2-brand{display:flex;align-items:center;gap:13px;min-width:0}
            .lcj2-brand-logo{
                width:46px;height:46px;border-radius:15px;display:grid;place-items:center;flex:0 0 auto;
                background:linear-gradient(145deg,rgba(34,211,238,.24),rgba(139,92,246,.22));
                border:1px solid rgba(126,238,255,.26);box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 12px 24px rgba(0,0,0,.25)
            }
            .lcj2-brand-logo span{font-size:20px;filter:drop-shadow(0 0 10px rgba(34,211,238,.65))}
            .lcj2-title{margin:0;font-size:18px;font-weight:900;letter-spacing:.2px;color:#f7fbff}
            .lcj2-subtitle{margin-top:3px;color:var(--lcj2-muted);font-size:11px;letter-spacing:.35px}
            .lcj2-version{display:inline-flex;margin-left:8px;padding:3px 7px;border-radius:999px;background:rgba(34,211,238,.12);color:#8ff3ff;border:1px solid rgba(34,211,238,.18);font-size:9px;vertical-align:middle}
            .lcj2-actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}
            .lcj2-btn{
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
            .lcj2-btn:hover{filter:brightness(1.12);transform:translateY(-1px);border-color:rgba(255,255,255,.22)}
            .lcj2-btn:active{transform:translateY(0)}
            .lcj2-btn:disabled{opacity:.48;cursor:not-allowed;filter:grayscale(.35);transform:none}
            .lcj2-btn.green{background:linear-gradient(135deg,#14a65a,#08763c);border-color:rgba(74,222,128,.28)}
            .lcj2-btn.blue{background:linear-gradient(135deg,#2585f4,#3154d8);border-color:rgba(96,165,250,.30)}
            .lcj2-btn.red{background:linear-gradient(135deg,#ed4662,#b91c42);border-color:rgba(251,113,133,.30)}
            .lcj2-btn.orange{background:linear-gradient(135deg,#f59e0b,#b45309);border-color:rgba(251,191,36,.32)}
            .lcj2-btn.primary{padding:12px 18px;background:linear-gradient(135deg,#06b6d4,#2563eb 55%,#7c3aed);border-color:rgba(125,211,252,.35);box-shadow:0 14px 28px rgba(37,99,235,.22),inset 0 1px 0 rgba(255,255,255,.18)}

            .lcj2-status-card{
                position:relative;overflow:hidden;display:flex;align-items:flex-start;gap:12px;padding:13px 15px;margin-bottom:13px;
                border-radius:17px;border:1px solid rgba(34,211,238,.18);background:linear-gradient(135deg,rgba(7,26,42,.90),rgba(12,16,34,.86));
                box-shadow:0 14px 32px rgba(0,0,0,.20)
            }
            .lcj2-status-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex:0 0 auto;background:rgba(34,211,238,.10);border:1px solid rgba(34,211,238,.18)}
            .lcj2-status-dot{width:9px;height:9px;border-radius:50%;background:#22d3ee;box-shadow:0 0 14px rgba(34,211,238,.9);animation:lcj2Blink 1.4s ease-in-out infinite}
            .lcj2-status-content{min-width:0;flex:1}
            .lcj2-status-title{font-size:10px;font-weight:900;letter-spacing:1px;color:#7eeeff;text-transform:uppercase;margin-bottom:3px}
            .lcj2-ocr-box{font-size:12px;line-height:1.5;color:#d8ebff}
            .lcj2-scan-state{
                min-width:190px;min-height:54px;display:flex;align-items:center;gap:11px;flex:0 0 auto;
                padding:10px 13px;border-radius:14px;border:1px solid rgba(148,163,184,.18);
                background:linear-gradient(145deg,rgba(15,23,42,.90),rgba(5,10,24,.88));
                box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 10px 24px rgba(0,0,0,.16);
                transition:border-color .18s ease,background .18s ease,box-shadow .18s ease
            }
            .lcj2-scan-state-dot{
                width:12px;height:12px;border-radius:50%;flex:0 0 auto;background:#64748b;
                box-shadow:0 0 0 5px rgba(100,116,139,.10),0 0 15px rgba(100,116,139,.28)
            }
            .lcj2-scan-state-copy{min-width:0}
            .lcj2-scan-state-label{
                display:block;margin-bottom:3px;color:#7f91ad;font-size:9px;font-weight:900;
                letter-spacing:1px;text-transform:uppercase
            }
            .lcj2-scan-state-text{
                display:block;color:#c9d4e5;font-size:12px;font-weight:1000;letter-spacing:.25px;white-space:nowrap
            }
            .lcj2-scan-state-detail{
                display:block;margin-top:2px;color:#7387a6;font-size:9px;font-weight:700;white-space:nowrap
            }
            .lcj2-scan-state.waiting{border-color:rgba(96,165,250,.20)}
            .lcj2-scan-state.waiting .lcj2-scan-state-dot{
                background:#60a5fa;box-shadow:0 0 0 5px rgba(96,165,250,.10),0 0 15px rgba(96,165,250,.42)
            }
            .lcj2-scan-state.waiting .lcj2-scan-state-text{color:#bfdbfe}
            .lcj2-scan-state.scanning{
                border-color:rgba(34,211,238,.35);
                background:linear-gradient(145deg,rgba(5,47,64,.72),rgba(6,18,38,.90));
                box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 25px rgba(34,211,238,.10)
            }
            .lcj2-scan-state.scanning .lcj2-scan-state-dot{
                background:#22d3ee;box-shadow:0 0 0 5px rgba(34,211,238,.11),0 0 18px rgba(34,211,238,.80);
                animation:lcj2Blink 1s ease-in-out infinite
            }
            .lcj2-scan-state.scanning .lcj2-scan-state-text{color:#7eeeff}
            .lcj2-scan-state.success{
                border-color:rgba(34,197,94,.34);
                background:linear-gradient(145deg,rgba(7,67,38,.68),rgba(5,24,27,.90));
                box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 25px rgba(34,197,94,.10)
            }
            .lcj2-scan-state.success .lcj2-scan-state-dot{
                background:#22c55e;box-shadow:0 0 0 5px rgba(34,197,94,.11),0 0 18px rgba(34,197,94,.68)
            }
            .lcj2-scan-state.success .lcj2-scan-state-text{color:#91f5b7}
            .lcj2-scan-state.partial{
                border-color:rgba(245,158,11,.34);
                background:linear-gradient(145deg,rgba(92,51,8,.60),rgba(28,20,16,.90))
            }
            .lcj2-scan-state.partial .lcj2-scan-state-dot{
                background:#f59e0b;box-shadow:0 0 0 5px rgba(245,158,11,.11),0 0 18px rgba(245,158,11,.55)
            }
            .lcj2-scan-state.partial .lcj2-scan-state-text{color:#ffd58e}
            .lcj2-scan-state.failed{
                border-color:rgba(251,79,104,.34);
                background:linear-gradient(145deg,rgba(76,15,35,.65),rgba(28,12,25,.90))
            }
            .lcj2-scan-state.failed .lcj2-scan-state-dot{
                background:#fb4f68;box-shadow:0 0 0 5px rgba(251,79,104,.11),0 0 18px rgba(251,79,104,.55)
            }
            .lcj2-scan-state.failed .lcj2-scan-state-text{color:#ffb7c5}
            .lcj2-account-scan-state{
                width:100%;
                min-width:0;
                min-height:58px;
                margin-top:10px;
                justify-content:flex-start;
            }
            .lcj2-progress{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.04)}
            .lcj2-progress span{display:block;height:100%;width:0;background:linear-gradient(90deg,#22d3ee,#3b82f6,#8b5cf6);box-shadow:0 0 14px rgba(34,211,238,.65);transition:width .25s ease}

            .lcj2-card{
                background:linear-gradient(155deg,rgba(17,25,47,.88),rgba(7,11,24,.88));
                border:1px solid var(--lcj2-line);
                border-radius:var(--lcj2-radius);
                padding:15px;
                margin-bottom:13px;
                box-shadow:0 15px 38px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.035)
            }
            .lcj2-grid2{display:grid;grid-template-columns:1fr 1fr;gap:13px}
            .lcj2-info-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
            .lcj2-info-group{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
            .lcj2-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:900;border:1px solid rgba(255,255,255,.10);background:rgba(15,23,42,.72);color:#d8e6f8}
            .lcj2-pill.blue{background:rgba(8,47,73,.62);color:#86efff;border-color:rgba(34,211,238,.20)}
            .lcj2-pill.red{background:rgba(76,15,35,.62);color:#ffb7c5;border-color:rgba(251,79,104,.25)}
            .lcj2-pill.green{background:rgba(7,67,38,.58);color:#91f5b7;border-color:rgba(34,197,94,.24)}
            .lcj2-inline-copy{
                width:24px;height:24px;display:inline-grid;place-items:center;flex:0 0 auto;margin:-3px -4px -3px 1px;
                padding:0;border-radius:8px;border:1px solid rgba(126,238,255,.18);
                color:#9af4ff;background:rgba(3,18,31,.46);cursor:pointer;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
                transition:background .14s ease,border-color .14s ease,transform .14s ease,color .14s ease
            }
            .lcj2-inline-copy:hover{background:rgba(34,211,238,.14);border-color:rgba(34,211,238,.42);transform:translateY(-1px)}
            .lcj2-inline-copy:active{transform:translateY(0)}
            .lcj2-inline-copy svg{width:13px;height:13px;display:block;pointer-events:none}
            .lcj2-inline-copy.copied{color:#91f5b7;background:rgba(7,67,38,.58);border-color:rgba(34,197,94,.34)}
            .lcj2-field-title{display:flex;align-items:center;gap:8px;font-weight:900;margin-bottom:9px;color:#b9f7ff;font-size:10px;letter-spacing:.8px;text-transform:uppercase}
            .lcj2-field-title:before{content:"";width:7px;height:7px;border-radius:3px;background:linear-gradient(135deg,#22d3ee,#3b82f6)}
            .lcj2-field-title.orange{color:#ffd58e}
            .lcj2-field-title.orange:before{background:linear-gradient(135deg,#fbbf24,#f97316)}
            .lcj2-input{
                width:100%;padding:11px 12px;border-radius:12px;border:1px solid rgba(126,238,255,.18);
                background:rgba(3,7,18,.78);color:#f4f9ff;outline:none;margin-bottom:9px;font-size:12px;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.025);transition:border-color .15s ease,box-shadow .15s ease,background .15s ease
            }
            .lcj2-input:focus{border-color:rgba(34,211,238,.62);box-shadow:0 0 0 3px rgba(34,211,238,.08);background:rgba(5,10,24,.92)}
            .lcj2-note{display:flex;gap:14px;align-items:center;justify-content:space-between}
            .lcj2-hints{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
            .lcj2-hint{padding:6px 9px;border-radius:9px;background:rgba(15,23,42,.68);border:1px solid rgba(148,163,184,.12);color:#9eb0c7;font-size:10px}
            .lcj2-hint.strong{color:#8ff3ff;border-color:rgba(34,211,238,.20);background:rgba(8,47,73,.40);font-weight:900}
            .lcj2-hint.copy-ready{color:#9ff7bd;border-color:rgba(34,197,94,.22);background:rgba(7,67,38,.38);font-weight:900}
            .lcj2-copy-btn{min-width:112px}
            .lcj2-copy-btn.copied{background:linear-gradient(135deg,#16a34a,#047857);box-shadow:0 0 0 3px rgba(34,197,94,.10),0 10px 22px rgba(0,0,0,.20)}

            #lcj2-image-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-bottom:14px}
            .lcj2-img-card{position:relative;background:linear-gradient(160deg,rgba(15,23,42,.94),rgba(4,7,16,.96));border:1px solid rgba(148,163,184,.15);border-radius:17px;overflow:hidden;cursor:grab;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
            .lcj2-img-card:hover{border-color:rgba(34,211,238,.45);transform:translateY(-2px);box-shadow:0 18px 36px rgba(0,0,0,.28),0 0 0 1px rgba(34,211,238,.05)}
            .lcj2-img-card.target{border-color:rgba(245,165,36,.30)}
            .lcj2-img-card.dragging{opacity:.42;border:1px dashed #fb4f68;transform:scale(.98)}
            .lcj2-img-card.over{border-color:#22c55e;background:#0b2117}
            .lcj2-img-media{position:relative;background:#02040a;overflow:hidden}
            .lcj2-img-card img{display:block;width:100%;height:250px;object-fit:contain;background:#02040a;cursor:zoom-in;transition:transform .2s ease}
            .lcj2-img-card:hover img{transform:scale(1.012)}
            .lcj2-img-index{position:absolute;top:9px;left:9px;z-index:2;display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:9px;background:rgba(3,7,18,.82);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.12);font-size:9px;font-weight:900;color:#eef7ff}
            .lcj2-target-tag{color:#ffd58e}
            .lcj2-del{position:absolute;top:9px;right:9px;width:30px;height:30px;border:1px solid rgba(251,113,133,.28);border-radius:10px;background:rgba(190,24,60,.88);color:#fff;font-weight:900;cursor:pointer;display:none;z-index:4;box-shadow:0 8px 20px rgba(0,0,0,.30)}
            .lcj2-img-card:hover .lcj2-del{display:block}
            .lcj2-img-label{padding:9px 10px 7px;color:#7f93af;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-top:1px solid rgba(255,255,255,.04)}
            .lcj2-ocr-badge{margin:0 9px 9px;padding:8px 9px;border-radius:10px;background:rgba(6,45,65,.66);color:#8ff3ff;border:1px solid rgba(34,211,238,.16);font-size:10px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .lcj2-ocr-badge.success{background:rgba(7,68,39,.58);color:#91f5b7;border-color:rgba(34,197,94,.22)}
            .lcj2-ocr-badge.error{background:rgba(83,17,35,.56);color:#ffb2c0;border-color:rgba(251,79,104,.24)}
            .lcj2-ocr-badge.empty{background:rgba(31,41,55,.66);color:#8fa3bf;border-color:rgba(148,163,184,.12)}
            .lcj2-empty{padding:26px;border:1px dashed rgba(251,113,133,.30);border-radius:17px;color:#ffbec9;background:rgba(61,10,27,.38);text-align:center;margin-bottom:14px}

            .lcj2-output-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;flex-wrap:wrap}
            #lcj2-output{width:100%;height:132px;background:rgba(2,6,15,.86);color:#7ef6a4;border:1px solid rgba(74,222,128,.16);border-radius:13px;padding:12px;font:11px/1.5 Consolas,Monaco,monospace;margin-bottom:10px;resize:vertical;outline:none}
            #lcj2-output:focus{border-color:rgba(74,222,128,.38);box-shadow:0 0 0 3px rgba(34,197,94,.06)}
            #lcj2-zoom{position:fixed;inset:0;z-index:${Z_TOP};background:rgba(1,3,8,.97);display:flex;align-items:center;justify-content:center;flex-direction:column;backdrop-filter:blur(10px)}
            #lcj2-zoom img{max-width:92%;max-height:84%;object-fit:contain;cursor:move;transition:transform .05s;border-radius:12px;box-shadow:0 25px 80px rgba(0,0,0,.68)}
            .lcj2-zoom-help{position:absolute;bottom:20px;padding:8px 11px;border-radius:10px;background:rgba(15,23,42,.72);border:1px solid rgba(255,255,255,.10);color:#9aacc3;font-size:10px}

            /* =========================================================
               PATEN TURBO UI — hanya tampilan, tidak menyentuh workflow
               ========================================================= */
            #lcj2-panel-fixed{
                background:
                    radial-gradient(circle at 9% 3%,rgba(14,165,233,.22),transparent 30%),
                    radial-gradient(circle at 91% 5%,rgba(124,58,237,.20),transparent 27%),
                    radial-gradient(circle at 50% 105%,rgba(245,158,11,.10),transparent 34%),
                    linear-gradient(145deg,#020617 0%,#071123 48%,#030712 100%);
            }
            #lcj2-panel-fixed:after{
                content:"";position:fixed;inset:0;pointer-events:none;opacity:.20;
                background:
                    linear-gradient(115deg,transparent 0 44%,rgba(255,255,255,.025) 50%,transparent 56%),
                    radial-gradient(circle at 50% 0,rgba(255,255,255,.035),transparent 45%);
            }
            .lcj2-wrap{max-width:1540px}
            .lcj2-topbar{
                position:sticky;top:0;z-index:20;
                border-radius:20px;
                border-color:rgba(125,211,252,.18);
                background:linear-gradient(135deg,rgba(13,28,55,.96),rgba(5,10,25,.94));
                box-shadow:0 22px 60px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.09);
                backdrop-filter:blur(18px) saturate(145%);
            }
            .lcj2-brand-logo{
                position:relative;overflow:hidden;width:50px;height:50px;border-radius:16px;
                background:linear-gradient(145deg,rgba(14,165,233,.30),rgba(79,70,229,.25) 55%,rgba(245,158,11,.16));
                border-color:rgba(125,211,252,.35);
                box-shadow:0 13px 30px rgba(2,132,199,.18),inset 0 1px 0 rgba(255,255,255,.18);
            }
            .lcj2-brand-logo:after{
                content:"";position:absolute;inset:-60%;
                background:conic-gradient(from 0deg,transparent,rgba(125,211,252,.55),transparent 28%);
                animation:lcj2Spin 5s linear infinite;
            }
            .lcj2-brand-logo span{position:relative;z-index:2;font-size:23px;color:#c6f7ff}
            .lcj2-title{font-size:19px;letter-spacing:.35px;text-shadow:0 0 22px rgba(56,189,248,.16)}
            .lcj2-version{
                margin-left:10px;padding:4px 9px;
                background:linear-gradient(135deg,rgba(6,182,212,.18),rgba(79,70,229,.22));
                border-color:rgba(103,232,249,.27);color:#a5f3fc;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.07);
            }
            .lcj2-status-card{
                min-height:78px;border-radius:20px;
                border-color:rgba(56,189,248,.22);
                background:linear-gradient(125deg,rgba(4,35,58,.92),rgba(13,18,42,.94) 58%,rgba(34,18,54,.88));
                box-shadow:0 18px 44px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.06);
            }
            .lcj2-status-card:after{
                content:"";position:absolute;top:0;bottom:0;width:110px;left:-140px;
                background:linear-gradient(90deg,transparent,rgba(125,211,252,.08),transparent);
                transform:skewX(-18deg);animation:lcj2StatusSweep 4.8s ease-in-out infinite;
            }
            @keyframes lcj2StatusSweep{0%,55%{left:-140px}100%{left:calc(100% + 140px)}}
            .lcj2-status-icon{
                width:40px;height:40px;border-radius:13px;
                background:linear-gradient(145deg,rgba(6,182,212,.17),rgba(37,99,235,.12));
                border-color:rgba(103,232,249,.28);
                box-shadow:0 10px 22px rgba(2,132,199,.12),inset 0 1px 0 rgba(255,255,255,.08);
            }
            .lcj2-card{
                border-radius:20px;padding:17px;
                border-color:rgba(148,163,184,.14);
                background:linear-gradient(145deg,rgba(14,24,48,.91),rgba(5,10,24,.92));
                box-shadow:0 17px 42px rgba(0,0,0,.27),inset 0 1px 0 rgba(255,255,255,.045);
            }
            .lcj2-card:hover{border-color:rgba(125,211,252,.20)}
            .lcj2-pill{
                padding:7px 11px;border-radius:11px;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.045);
            }
            .lcj2-input{
                min-height:43px;border-radius:13px;
                background:linear-gradient(180deg,rgba(2,6,23,.90),rgba(5,12,29,.88));
                border-color:rgba(125,211,252,.18);
                box-shadow:inset 0 2px 9px rgba(0,0,0,.24),0 1px 0 rgba(255,255,255,.025);
            }
            .lcj2-input:focus{
                border-color:rgba(34,211,238,.68);
                box-shadow:0 0 0 3px rgba(34,211,238,.09),0 12px 30px rgba(0,0,0,.18);
            }
            .lcj2-scan-state{
                border-radius:16px;
                box-shadow:0 13px 28px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.05);
            }
            .lcj2-btn{
                border-radius:13px;padding:11px 15px;
                box-shadow:0 11px 24px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.14);
            }
            .lcj2-btn.primary{
                position:relative;overflow:hidden;min-width:180px;
                background:linear-gradient(125deg,#0891b2 0%,#2563eb 47%,#6d28d9 100%);
                box-shadow:0 16px 36px rgba(37,99,235,.29),inset 0 1px 0 rgba(255,255,255,.22);
            }
            .lcj2-btn.primary:before{
                content:"";position:absolute;inset:0;transform:translateX(-115%);
                background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.22),transparent 70%);
                transition:transform .42s ease;
            }
            .lcj2-btn.primary:hover:before{transform:translateX(115%)}
            #lcj2-image-grid{gap:15px}
            .lcj2-img-card{
                border-radius:20px;
                background:linear-gradient(155deg,rgba(13,24,48,.96),rgba(2,6,17,.98));
                box-shadow:0 16px 36px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.035);
            }
            .lcj2-img-card.target{
                border-color:rgba(245,158,11,.48);
                box-shadow:0 17px 40px rgba(0,0,0,.31),0 0 0 1px rgba(245,158,11,.08),inset 0 1px 0 rgba(255,255,255,.04);
            }
            .lcj2-img-card.target .lcj2-img-index{
                background:linear-gradient(135deg,rgba(120,53,15,.90),rgba(69,26,3,.88));
                border-color:rgba(251,191,36,.30);color:#fff7d6;
            }
            .lcj2-img-card img{height:270px}
            .lcj2-ocr-badge{border-radius:11px;padding:9px 10px}
            #lcj2-output{
                min-height:145px;border-radius:15px;
                background:linear-gradient(180deg,rgba(1,7,16,.94),rgba(2,13,18,.92));
                box-shadow:inset 0 2px 12px rgba(0,0,0,.30);
            }


            /* =========================================================
               PATEN LUXE UI V5.5.3
               Hanya visual dashboard + bubble. Workflow tidak disentuh.
               ========================================================= */
            :root{
                --lcj2-bg:#020611;
                --lcj2-surface:rgba(8,16,34,.90);
                --lcj2-surface-2:rgba(13,24,49,.86);
                --lcj2-line:rgba(125,211,252,.15);
                --lcj2-text:#f3f8ff;
                --lcj2-muted:#91a7c5;
                --lcj2-cyan:#37e6ff;
                --lcj2-blue:#4f8cff;
                --lcj2-violet:#9b6cff;
                --lcj2-green:#36e79a;
                --lcj2-red:#ff5578;
                --lcj2-orange:#ffbd59;
                --lcj2-radius:22px;
            }

            /* Bubble scanner baru */
            #lcj2-bubble-fixed{
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
            #lcj2-bubble-fixed:before{
                content:"";
                position:absolute;
                inset:5px;
                width:auto;
                height:auto;
                border-radius:22px;
                border:1px solid rgba(255,255,255,.11);
                background:linear-gradient(150deg,rgba(255,255,255,.07),transparent 42%);
                box-shadow:inset 0 0 24px rgba(45,212,255,.06);
                animation:lcj2BubbleBreathe 2.8s ease-in-out infinite;
                z-index:0;
            }
            #lcj2-bubble-fixed:after{
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
                animation:lcj2BubbleOrbit 7s linear infinite;
                z-index:-1;
            }
            #lcj2-bubble-fixed:hover{
                transform:translateY(-4px) scale(1.055);
                border-color:rgba(105,235,255,.72);
                box-shadow:
                    0 29px 68px rgba(0,0,0,.64),
                    0 0 0 1px rgba(82,224,255,.15),
                    0 0 42px rgba(39,203,255,.28),
                    inset 0 1px 0 rgba(255,255,255,.28);
            }
            #lcj2-bubble-fixed.lcj2-dragging{
                cursor:grabbing;
                transform:scale(1.065);
                opacity:.96;
            }
            .lcj2-bubble-aura{
                position:absolute;
                inset:13px;
                border-radius:18px;
                border:1px solid rgba(82,220,255,.16);
                box-shadow:0 0 20px rgba(45,212,255,.09),inset 0 0 16px rgba(93,103,255,.07);
                pointer-events:none;
                z-index:1;
            }
            .lcj2-bubble-core{
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
            .lcj2-bubble-scan-icon{
                width:27px;
                height:27px;
                stroke:currentColor;
                stroke-width:1.8;
                stroke-linecap:round;
                stroke-linejoin:round;
                filter:drop-shadow(0 0 6px rgba(55,230,255,.52));
            }
            .lcj2-bubble-laser{
                position:absolute;
                left:7px;
                right:7px;
                height:1.5px;
                top:10px;
                border-radius:2px;
                background:linear-gradient(90deg,transparent,#62f4ff 22% 78%,transparent);
                box-shadow:0 0 7px rgba(98,244,255,.95);
                animation:lcj2BubbleLaser 1.85s ease-in-out infinite;
            }
            .lcj2-bubble-label{
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
            .lcj2-bubble-live{
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
                animation:lcj2BubbleLive 1.8s ease-in-out infinite;
                pointer-events:none;
            }
            @keyframes lcj2BubbleOrbit{to{transform:rotate(360deg)}}
            @keyframes lcj2BubbleBreathe{0%,100%{opacity:.72}50%{opacity:1}}
            @keyframes lcj2BubbleLaser{0%,100%{transform:translateY(0);opacity:.48}50%{transform:translateY(17px);opacity:1}}
            @keyframes lcj2BubbleLive{0%,100%{transform:scale(.84);opacity:.68}50%{transform:scale(1.12);opacity:1}}

            /* Latar dashboard */
            #lcj2-panel-fixed{
                padding:22px;
                background:
                    radial-gradient(circle at 8% 0%,rgba(24,156,255,.22),transparent 29%),
                    radial-gradient(circle at 94% 3%,rgba(126,66,255,.20),transparent 27%),
                    radial-gradient(circle at 50% 108%,rgba(43,215,190,.10),transparent 35%),
                    linear-gradient(150deg,#020611 0%,#071226 48%,#030712 100%);
            }
            #lcj2-panel-fixed:before{
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
            #lcj2-panel-fixed:after{
                content:"";
                position:fixed;
                inset:0;
                pointer-events:none;
                opacity:.28;
                background:
                    linear-gradient(115deg,transparent 0 44%,rgba(255,255,255,.028) 50%,transparent 56%),
                    radial-gradient(ellipse at 50% -15%,rgba(104,223,255,.10),transparent 55%);
            }
            .lcj2-wrap{max-width:1540px}

            /* Header premium */
            .lcj2-topbar{
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
            .lcj2-topbar:before{
                content:"";
                position:absolute;
                left:4%;right:4%;top:0;height:1px;
                background:linear-gradient(90deg,transparent,rgba(100,235,255,.72),rgba(166,120,255,.58),transparent);
                box-shadow:0 0 18px rgba(65,215,255,.36);
            }
            .lcj2-topbar:after{
                content:"";
                position:absolute;
                width:230px;height:230px;
                right:-105px;top:-135px;
                border-radius:50%;
                background:radial-gradient(circle,rgba(146,86,255,.18),transparent 68%);
                pointer-events:none;
            }
            .lcj2-brand{gap:14px;position:relative;z-index:2}
            .lcj2-brand-logo{
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
            .lcj2-brand-logo:before{
                content:"";
                position:absolute;
                inset:5px;
                border-radius:13px;
                border:1px solid rgba(255,255,255,.08);
                background:linear-gradient(150deg,rgba(255,255,255,.08),transparent 48%);
            }
            .lcj2-brand-logo:after{
                content:"";
                position:absolute;
                inset:-70%;
                background:conic-gradient(from 30deg,transparent,rgba(67,225,255,.55),transparent 28%,transparent 72%,rgba(148,91,255,.48),transparent);
                animation:lcj2Spin 6.5s linear infinite;
                opacity:.62;
            }
            .lcj2-brand-logo svg{
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
            .lcj2-title{
                font-size:19px;
                font-weight:1000;
                letter-spacing:.35px;
                color:#f5fbff;
                text-shadow:0 0 20px rgba(77,220,255,.15);
            }
            .lcj2-version{
                margin-left:10px;
                padding:4px 9px;
                border-radius:999px;
                background:linear-gradient(135deg,rgba(34,211,238,.16),rgba(92,72,255,.22));
                border:1px solid rgba(112,232,255,.25);
                color:#bff8ff;
                box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 18px rgba(58,210,255,.06);
            }

            /* Status dan panel */
            .lcj2-status-card{
                min-height:78px;
                padding:15px 17px;
                border-radius:21px;
                border:1px solid rgba(69,218,255,.20);
                background:
                    linear-gradient(120deg,rgba(5,42,68,.91),rgba(9,18,40,.94) 52%,rgba(38,17,62,.87));
                box-shadow:0 18px 46px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.065);
            }
            .lcj2-status-icon{
                width:42px;
                height:42px;
                border-radius:14px;
                background:linear-gradient(145deg,rgba(36,208,244,.18),rgba(68,78,255,.13));
                border:1px solid rgba(100,230,255,.27);
                box-shadow:0 11px 24px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.10);
            }
            .lcj2-status-title{font-size:9px;letter-spacing:1.35px;color:#86efff}
            .lcj2-ocr-box{font-size:12px;color:#e1f1ff}
            .lcj2-progress{height:3px;background:rgba(255,255,255,.035)}
            .lcj2-progress span{
                background:linear-gradient(90deg,#35edff,#4f8cff 52%,#9c6cff);
                box-shadow:0 0 16px rgba(55,230,255,.72);
            }
            .lcj2-card{
                position:relative;
                border-radius:22px;
                padding:17px;
                border:1px solid rgba(143,184,224,.13);
                background:
                    linear-gradient(150deg,rgba(13,27,53,.91),rgba(5,12,28,.93));
                box-shadow:0 18px 44px rgba(0,0,0,.27),inset 0 1px 0 rgba(255,255,255,.045);
                overflow:hidden;
            }
            .lcj2-card:before{
                content:"";
                position:absolute;
                left:16px;right:16px;top:0;height:1px;
                background:linear-gradient(90deg,transparent,rgba(118,224,255,.18),transparent);
                pointer-events:none;
            }
            .lcj2-card:hover{
                border-color:rgba(95,220,255,.22);
                box-shadow:0 20px 48px rgba(0,0,0,.30),0 0 0 1px rgba(55,230,255,.025),inset 0 1px 0 rgba(255,255,255,.055);
            }
            .lcj2-field-title{
                color:#bff8ff;
                letter-spacing:1px;
            }
            .lcj2-field-title:before{
                width:8px;height:8px;border-radius:3px;
                background:linear-gradient(135deg,#45efff,#5d7cff);
                box-shadow:0 0 10px rgba(69,239,255,.45);
            }
            .lcj2-field-title.orange:before{
                background:linear-gradient(135deg,#ffd36b,#ff8a4c);
                box-shadow:0 0 10px rgba(255,177,76,.36);
            }
            .lcj2-pill{
                padding:7px 10px;
                border-radius:11px;
                background:linear-gradient(145deg,rgba(17,31,58,.80),rgba(8,17,35,.80));
                border:1px solid rgba(148,188,224,.13);
                box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
            }
            .lcj2-pill.blue{background:linear-gradient(145deg,rgba(7,55,78,.68),rgba(8,29,54,.72));border-color:rgba(55,230,255,.20)}
            .lcj2-pill.green{background:linear-gradient(145deg,rgba(7,65,46,.64),rgba(4,35,34,.72));border-color:rgba(54,231,154,.21)}
            .lcj2-pill.red{background:linear-gradient(145deg,rgba(86,16,40,.62),rgba(48,11,30,.72));border-color:rgba(255,85,120,.22)}
            .lcj2-input{
                min-height:43px;
                border-radius:13px;
                border:1px solid rgba(94,221,255,.17);
                background:linear-gradient(180deg,rgba(2,7,20,.92),rgba(5,14,32,.90));
                box-shadow:inset 0 2px 10px rgba(0,0,0,.25),0 1px 0 rgba(255,255,255,.025);
            }
            .lcj2-input:hover{border-color:rgba(101,222,255,.27)}
            .lcj2-input:focus{
                border-color:rgba(55,230,255,.66);
                box-shadow:0 0 0 3px rgba(55,230,255,.08),0 12px 28px rgba(0,0,0,.18),inset 0 2px 8px rgba(0,0,0,.18);
            }
            .lcj2-hint{border-radius:10px;background:rgba(10,22,43,.70)}
            .lcj2-hint.strong{background:linear-gradient(145deg,rgba(7,60,82,.55),rgba(8,33,59,.60))}

            /* Tombol */
            .lcj2-btn{
                border-radius:13px;
                padding:11px 15px;
                border:1px solid rgba(255,255,255,.11);
                background:linear-gradient(180deg,#293c60,#172641);
                box-shadow:0 11px 25px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.14);
            }
            .lcj2-btn:hover{
                filter:brightness(1.10);
                transform:translateY(-2px);
                border-color:rgba(255,255,255,.22);
                box-shadow:0 15px 30px rgba(0,0,0,.29),inset 0 1px 0 rgba(255,255,255,.16);
            }
            .lcj2-btn.red{background:linear-gradient(135deg,#db365e,#8d173b);border-color:rgba(255,104,137,.30)}
            .lcj2-btn.green{background:linear-gradient(135deg,#17b76a,#08734a);border-color:rgba(80,244,166,.25)}
            .lcj2-btn.blue{background:linear-gradient(135deg,#248ff1,#3656dc);border-color:rgba(105,174,255,.30)}
            .lcj2-btn.orange{background:linear-gradient(135deg,#f5a623,#b85b0d);border-color:rgba(255,197,88,.30)}
            .lcj2-btn.primary{
                min-width:185px;
                background:linear-gradient(125deg,#08a4bd 0%,#316fe9 48%,#763bd2 100%);
                border-color:rgba(119,225,255,.36);
                box-shadow:0 16px 37px rgba(41,104,225,.28),0 0 20px rgba(42,205,255,.08),inset 0 1px 0 rgba(255,255,255,.21);
            }

            /* Status OCR */
            .lcj2-scan-state{
                border-radius:17px;
                background:linear-gradient(145deg,rgba(13,28,53,.91),rgba(5,13,31,.92));
                box-shadow:0 13px 29px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.05);
            }
            .lcj2-scan-state.scanning{
                background:linear-gradient(145deg,rgba(4,53,70,.76),rgba(6,20,44,.92));
                border-color:rgba(55,230,255,.36);
            }
            .lcj2-scan-state.success{
                background:linear-gradient(145deg,rgba(6,72,45,.67),rgba(4,29,31,.92));
                border-color:rgba(54,231,154,.35);
            }
            .lcj2-scan-state.failed{
                background:linear-gradient(145deg,rgba(89,16,41,.68),rgba(34,10,28,.92));
                border-color:rgba(255,85,120,.35);
            }

            /* Kartu gambar */
            #lcj2-image-grid{gap:15px}
            .lcj2-img-card{
                border-radius:21px;
                border:1px solid rgba(137,181,221,.14);
                background:linear-gradient(155deg,rgba(12,27,53,.97),rgba(2,7,18,.98));
                box-shadow:0 17px 39px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.035);
            }
            .lcj2-img-card:hover{
                transform:translateY(-3px);
                border-color:rgba(55,230,255,.43);
                box-shadow:0 22px 49px rgba(0,0,0,.34),0 0 24px rgba(55,230,255,.055);
            }
            .lcj2-img-card.target{
                border-color:rgba(255,189,89,.48);
                box-shadow:0 19px 44px rgba(0,0,0,.33),0 0 0 1px rgba(255,189,89,.08),0 0 25px rgba(255,165,45,.06),inset 0 1px 0 rgba(255,255,255,.04);
            }
            .lcj2-img-card.target .lcj2-img-index{
                background:linear-gradient(135deg,rgba(126,57,14,.93),rgba(70,28,5,.91));
                border-color:rgba(255,202,92,.33);
                color:#fff4cf;
            }
            .lcj2-img-media{background:linear-gradient(145deg,#01040b,#050b16)}
            .lcj2-img-card img{height:270px;background:#020611}
            .lcj2-img-index{
                border-radius:10px;
                background:rgba(3,10,23,.84);
                border-color:rgba(255,255,255,.13);
                box-shadow:0 7px 17px rgba(0,0,0,.25);
            }
            .lcj2-del{border-radius:11px;background:linear-gradient(145deg,#df3158,#8f1537)}
            .lcj2-ocr-badge{border-radius:12px;padding:9px 10px}
            #lcj2-output{
                min-height:147px;
                border-radius:15px;
                background:linear-gradient(180deg,rgba(1,7,17,.96),rgba(2,15,21,.94));
                box-shadow:inset 0 2px 13px rgba(0,0,0,.32);
            }
            #lcj2-zoom{background:rgba(1,4,12,.975);backdrop-filter:blur(14px)}
            #lcj2-zoom img{border:1px solid rgba(110,225,255,.16);border-radius:16px;box-shadow:0 28px 90px rgba(0,0,0,.72),0 0 45px rgba(55,230,255,.08)}

            @media(max-width:760px){
                #lcj2-bubble-fixed{width:74px;height:74px;border-radius:24px}
                .lcj2-bubble-core{width:36px;height:36px}
                .lcj2-bubble-label{font-size:8px}
                #lcj2-panel-fixed{padding:10px}
                .lcj2-topbar{border-radius:18px}
                .lcj2-card,.lcj2-status-card{border-radius:18px}
            }

            /* Mode ringan otomatis aktif saat deep scan/OCR agar dashboard tidak berebut CPU/GPU. */
            #lcj2-panel-fixed.lcj2-performance-mode{
                backdrop-filter:none!important;
                background:#050816!important;
            }
            #lcj2-panel-fixed.lcj2-performance-mode:before,
            #lcj2-panel-fixed.lcj2-performance-mode:after{display:none!important}
            #lcj2-panel-fixed.lcj2-performance-mode *,
            #lcj2-panel-fixed.lcj2-performance-mode *:before,
            #lcj2-panel-fixed.lcj2-performance-mode *:after{
                animation-play-state:paused!important;
                transition:none!important;
            }
            #lcj2-panel-fixed.lcj2-performance-mode .lcj2-card,
            #lcj2-panel-fixed.lcj2-performance-mode .lcj2-topbar,
            #lcj2-panel-fixed.lcj2-performance-mode .lcj2-img-card{
                box-shadow:none!important;
                backdrop-filter:none!important;
            }
            .lcj2-img-card{
                contain:layout paint style;
                content-visibility:auto;
                contain-intrinsic-size:320px 360px;
            }
            @media(max-width:1050px){#lcj2-image-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
            @media(max-width:760px){
                #lcj2-panel-fixed{padding:10px}
                .lcj2-grid2{grid-template-columns:1fr}
                .lcj2-topbar{align-items:flex-start;flex-direction:column}
                .lcj2-actions{width:100%;justify-content:stretch}
                .lcj2-actions .lcj2-btn{flex:1}
                .lcj2-note{align-items:stretch;flex-direction:column}
                #lcj2-image-grid{grid-template-columns:1fr}
                .lcj2-img-card img{height:220px}
                .lcj2-status-card{flex-wrap:wrap}
                .lcj2-scan-state{width:100%;min-width:0}
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
            #lcj2-panel-fixed{
                padding:18px!important;
                background:
                    radial-gradient(circle at 12% 2%,rgba(245,205,122,.22),transparent 30%),
                    radial-gradient(circle at 88% 5%,rgba(220,38,38,.09),transparent 28%),
                    radial-gradient(circle at 50% 100%,rgba(181,131,56,.08),transparent 36%),
                    linear-gradient(180deg,#fffdf9 0%,#fff4ed 100%)!important;
                color:var(--nova-text)!important;
            }
            #lcj2-panel-fixed:before{
                display:block!important;
                opacity:.16!important;
                background-image:
                    linear-gradient(rgba(181,131,56,.06) 1px,transparent 1px),
                    linear-gradient(90deg,rgba(181,131,56,.06) 1px,transparent 1px)!important;
                background-size:28px 28px!important;
                mask-image:linear-gradient(to bottom,#000,transparent 88%);
            }
            .lcj2-nova-shell{max-width:1540px!important;margin:0 auto!important;position:relative!important}

            /* Bubble benar-benar baru: lensa OCR bulat */
            #lcj2-bubble-fixed{
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
            #lcj2-bubble-fixed:before,
            #lcj2-bubble-fixed:after{display:none!important}
            .lcj2-nova-ring{
                position:absolute;inset:-6px;border-radius:50%;pointer-events:none;
                border:1px dashed rgba(181,131,56,.44);
                animation:lcj2NovaRing 8s linear infinite;
                filter:drop-shadow(0 0 8px rgba(181,131,56,.26));
            }
            .lcj2-nova-ring:before,.lcj2-nova-ring:after{
                content:"";position:absolute;width:7px;height:7px;border-radius:50%;
                background:#c79a3f;box-shadow:0 0 13px #c79a3f;
            }
            .lcj2-nova-ring:before{left:8px;top:10px}.lcj2-nova-ring:after{right:7px;bottom:11px;background:#b91c1c;box-shadow:0 0 13px #b91c1c}
            .lcj2-nova-lens{
                position:absolute;left:18px;top:14px;width:48px;height:48px;border-radius:17px;
                background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(255,243,227,.98));
                border:1px solid rgba(181,131,56,.26);
                box-shadow:inset 0 0 22px rgba(199,154,63,.09),0 7px 17px rgba(110,61,20,.16);
                overflow:hidden;
            }
            .lcj2-nova-lens:before{
                content:"";position:absolute;inset:10px;border-radius:50%;
                border:1px solid rgba(181,131,56,.45);
                box-shadow:inset 0 0 11px rgba(199,154,63,.10),0 0 12px rgba(181,131,56,.12);
            }
            .lcj2-jam2-lens{
                display:flex!important;
                flex-direction:column!important;
                align-items:center!important;
                justify-content:center!important;
                gap:0!important;
                padding-top:1px!important;
            }
            .lcj2-jam2-lens:before{
                inset:6px!important;
                border-radius:13px!important;
            }
            .lcj2-jam2-number{
                position:relative;
                z-index:3;
                display:block;
                font-size:23px;
                line-height:21px;
                font-weight:1000;
                letter-spacing:-1px;
                color:#dc2626;
                text-shadow:0 0 11px rgba(239,68,68,.30);
            }
            .lcj2-jam2-wib{
                position:relative;
                z-index:3;
                display:block;
                margin-top:2px;
                font-size:7px;
                line-height:8px;
                font-weight:1000;
                letter-spacing:1.4px;
                color:#a16207;
            }
            .lcj2-nova-lens-dot{
                position:absolute;left:50%;top:50%;width:7px;height:7px;border-radius:50%;
                transform:translate(-50%,-50%);background:#c79a3f;box-shadow:0 0 13px #c79a3f;
            }
            .lcj2-nova-laser{
                position:absolute;left:6px;right:6px;top:9px;height:2px;border-radius:4px;
                background:linear-gradient(90deg,transparent,#c79a3f 18%,#fff 50%,#b91c1c 82%,transparent);
                box-shadow:0 0 12px rgba(181,131,56,.45);
                animation:lcj2NovaLaser 1.65s ease-in-out infinite;
            }
            .lcj2-nova-corner{position:absolute;width:8px;height:8px;border-color:#b58338;border-style:solid;opacity:.9}
            .lcj2-nova-corner.c1{left:5px;top:5px;border-width:1.5px 0 0 1.5px;border-radius:4px 0 0 0}
            .lcj2-nova-corner.c2{right:5px;top:5px;border-width:1.5px 1.5px 0 0;border-radius:0 4px 0 0}
            .lcj2-nova-corner.c3{right:5px;bottom:5px;border-width:0 1.5px 1.5px 0;border-radius:0 0 4px 0}
            .lcj2-nova-corner.c4{left:5px;bottom:5px;border-width:0 0 1.5px 1.5px;border-radius:0 0 0 4px}
            .lcj2-nova-caption{
                position:absolute;left:0;right:0;bottom:7px;z-index:3;
                font-size:9px;font-weight:1000;letter-spacing:2.3px;color:#8a5b2b;text-align:center;
                text-shadow:0 0 8px rgba(181,131,56,.26);
            }
            .lcj2-nova-online{
                position:absolute;right:4px;top:7px;width:10px;height:10px;border-radius:50%;z-index:4;
                background:#22c55e;border:2px solid #fff8f2;box-shadow:0 0 0 3px rgba(34,197,94,.10),0 0 12px #22c55e;
            }
            #lcj2-bubble-fixed:hover{transform:translateY(-5px) scale(1.07)!important;box-shadow:0 30px 70px rgba(110,61,20,.24),0 0 0 7px rgba(181,131,56,.08),0 0 44px rgba(199,154,63,.18)!important}
            @keyframes lcj2NovaRing{to{transform:rotate(360deg)}}
            @keyframes lcj2NovaLaser{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(28px);opacity:1}}

            /* Header baru */
            .lcj2-nova-topbar{
                min-height:84px!important;margin:0 0 14px!important;padding:15px 17px!important;
                border-radius:24px!important;border:1px solid rgba(181,131,56,.14)!important;
                background:linear-gradient(135deg,#ffffff,#fff8f2)!important;
                box-shadow:0 18px 48px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.05)!important;
                overflow:hidden!important;
            }
            .lcj2-nova-topbar:before{
                content:""!important;display:block!important;position:absolute!important;left:0!important;top:0!important;bottom:0!important;width:4px!important;
                background:linear-gradient(180deg,#b58338,#d4a24c,#b91c1c)!important;
                box-shadow:0 0 18px rgba(77,232,255,.45)!important;
            }
            .lcj2-nova-topbar:after{
                content:""!important;display:block!important;position:absolute!important;right:-60px!important;top:-90px!important;width:230px!important;height:230px!important;border-radius:50%!important;
                background:radial-gradient(circle,rgba(181,131,56,.12),transparent 65%)!important;pointer-events:none!important;
            }
            .lcj2-nova-logo{
                width:55px!important;height:55px!important;border-radius:19px!important;
                background:linear-gradient(145deg,rgba(199,154,63,.20),rgba(255,255,255,.98))!important;
                border:1px solid rgba(181,131,56,.18)!important;
            }
            .lcj2-nova-logo svg{width:33px;height:33px;stroke:#b91c1c;stroke-width:1.7;filter:drop-shadow(0 0 9px rgba(181,131,56,.18))}
            .lcj2-nova-brand-copy{min-width:0}
            .lcj2-nova-eyebrow{font-size:8px;font-weight:1000;letter-spacing:2.2px;color:#8a5b2b;margin-bottom:3px}
            .lcj2-title{font-size:21px!important;line-height:1.15!important;margin:0!important;color:#7c1d1d!important}
            .lcj2-subtitle{font-size:10px!important;color:#8a5b2b!important;margin-top:5px!important}
            .lcj2-version{font-size:8px!important;padding:4px 8px!important;background:rgba(199,154,63,.12)!important;border-color:rgba(181,131,56,.18)!important;color:#8a5b2b!important}
            .lcj2-nova-top-actions{display:flex;align-items:center;gap:10px;position:relative;z-index:2}
            .lcj2-nova-live-chip{display:flex;align-items:center;gap:7px;padding:8px 11px;border-radius:12px;background:rgba(199,154,63,.10);border:1px solid rgba(181,131,56,.20);color:#8a5b2b;font-size:8px;font-weight:1000;letter-spacing:1.1px}
            .lcj2-nova-live-chip span{width:7px;height:7px;border-radius:50%;background:#48e0a4;box-shadow:0 0 10px #48e0a4;animation:lcj2Blink 1.4s ease-in-out infinite}
            .lcj2-nova-close{padding:9px 12px!important;display:flex!important;align-items:center!important;gap:9px!important;background:rgba(181,131,56,.10)!important;border-color:rgba(181,131,56,.20)!important;color:#8a5b2b!important}
            .lcj2-nova-close b{font-size:17px;line-height:1}

            /* Status hero */
            .lcj2-nova-hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(500px,.85fr);gap:14px;margin-bottom:14px}
            .lcj2-nova-status{
                min-height:102px!important;margin:0!important;padding:18px!important;border-radius:22px!important;
                align-items:center!important;background:
                    radial-gradient(circle at 88% 0%,rgba(181,131,56,.10),transparent 40%),
                    linear-gradient(135deg,#ffffff,#fff7ef)!important;
                border:1px solid rgba(181,131,56,.12)!important;
            }
            .lcj2-nova-status-icon{width:52px!important;height:52px!important;border-radius:17px!important;background:rgba(199,154,63,.09)!important;border-color:rgba(181,131,56,.16)!important}
            .lcj2-nova-status-icon svg{width:28px;height:28px;stroke:#8a5b2b;stroke-width:1.6}
            .lcj2-nova-status .lcj2-status-title{font-size:9px!important;letter-spacing:1.8px!important;color:#8a5b2b!important}
            .lcj2-nova-status .lcj2-ocr-box{font-size:14px!important;font-weight:750!important;color:#2a1711!important;margin-top:5px!important}
            .lcj2-nova-status .lcj2-progress{height:4px!important;background:rgba(181,131,56,.08)!important}
            .lcj2-nova-status .lcj2-progress span{background:linear-gradient(90deg,var(--nova-cyan),var(--nova-blue),var(--nova-purple))!important}
            .lcj2-nova-identity{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
            .lcj2-nova-stat{
                min-width:0;padding:13px;border-radius:18px;border:1px solid var(--nova-line);
                background:linear-gradient(155deg,rgba(15,29,52,.94),rgba(7,14,27,.94));
                box-shadow:inset 0 1px 0 rgba(255,255,255,.035);
            }
            .lcj2-nova-stat.ok{border-color:rgba(34,197,94,.18);background:linear-gradient(155deg,rgba(241,253,244,.96),rgba(232,250,236,.98))}
            .lcj2-nova-stat.bad{border-color:rgba(181,131,56,.16);background:linear-gradient(155deg,rgba(255,248,244,.98),rgba(255,239,226,.98))}
            .lcj2-nova-stat.user{border-color:rgba(181,131,56,.14)}
            .lcj2-nova-stat.mode{border-color:rgba(199,154,63,.16)}
            .lcj2-nova-stat-label{display:block;font-size:7px;font-weight:1000;letter-spacing:1.35px;color:#8a5b2b;margin-bottom:6px}
            .lcj2-nova-stat strong{display:block;min-width:0;color:#2a1711;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .lcj2-nova-stat small{display:block;margin-top:5px;color:#8a5b2b;font-size:7.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .lcj2-nova-user-line{display:flex;align-items:center;gap:6px;min-width:0}
            .lcj2-nova-user-line strong{flex:1}
            .lcj2-user-edit{
                flex:1;min-width:0;width:100%;padding:0;border:0;outline:none;background:transparent;
                color:#2a1711;font:inherit;font-size:10px;font-weight:900;line-height:1.25;
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            }
            .lcj2-user-edit:focus{
                padding:4px 6px;margin:-4px -6px;border-radius:7px;background:rgba(255,255,255,.78);
                box-shadow:0 0 0 2px rgba(181,131,56,.13);
            }

            /* Workspace dua kolom */
            .lcj2-nova-workspace{display:grid;grid-template-columns:340px minmax(0,1fr);gap:14px;align-items:start}
            .lcj2-nova-sidebar{display:flex;flex-direction:column;gap:12px;position:sticky;top:0}
            .lcj2-nova-main{min-width:0;display:flex;flex-direction:column;gap:14px}
            .lcj2-card{border-radius:24px!important;border:1px solid var(--nova-line)!important;background:linear-gradient(155deg,#ffffff,#fff8f1)!important;box-shadow:0 18px 42px rgba(110,61,20,.08),inset 0 1px 0 rgba(255,255,255,.95)!important}
            .lcj2-nova-control-card{margin:0!important;padding:15px!important}
            .lcj2-nova-section-head{display:flex;align-items:center;gap:10px;margin-bottom:13px}
            .lcj2-nova-step{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;flex:0 0 auto;background:rgba(199,154,63,.10);border:1px solid rgba(181,131,56,.16);color:#8a5b2b;font-size:9px;font-weight:1000}
            .lcj2-nova-section-head.orange .lcj2-nova-step{background:rgba(181,131,56,.10);border-color:rgba(181,131,56,.18);color:#8a5b2b}
            .lcj2-nova-section-head b{display:block;font-size:11px;color:#2a1711}.lcj2-nova-section-head small{display:block;font-size:8px;color:#8a5b2b;margin-top:2px}
            .lcj2-input{border-radius:14px!important;padding:11px 12px!important;background:#fffdfb!important;border-color:rgba(181,131,56,.16)!important;margin-bottom:8px!important;color:#2a1711!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95)!important}
            .lcj2-input:focus{border-color:rgba(181,131,56,.46)!important;box-shadow:0 0 0 3px rgba(181,131,56,.10)!important}
            .lcj2-account-scan-state{margin:7px 0 0!important;min-height:62px!important;border-radius:15px!important}
            .lcj2-nova-guide{margin:0!important;padding:15px!important;background:linear-gradient(155deg,#fff8f2,#fff)!important}
            .lcj2-nova-guide-title{font-size:8px;font-weight:1000;letter-spacing:1.8px;color:#8a5b2b;margin-bottom:10px}
            .lcj2-nova-guide-row{display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid rgba(181,131,56,.08)}
            .lcj2-nova-guide-row>span{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:rgba(199,154,63,.10);color:#8a5b2b;font-size:14px}
            .lcj2-nova-guide-row b{display:block;font-size:9px;color:#2a1711}.lcj2-nova-guide-row small{display:block;font-size:7.5px;color:#8a5b2b;margin-top:2px}

            /* Galeri */
            .lcj2-nova-gallery-card,.lcj2-nova-output-card{margin:0!important;padding:16px!important}
            .lcj2-nova-gallery-head,.lcj2-output-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;margin-bottom:14px!important}
            .lcj2-nova-kicker{display:block;font-size:7px;font-weight:1000;letter-spacing:1.8px;color:#8a5b2b;margin-bottom:4px}
            .lcj2-nova-gallery-head h4,.lcj2-output-head h4{font-size:15px;margin:0;color:#7c1d1d}.lcj2-nova-gallery-head p,.lcj2-output-head p{font-size:8.5px;margin:4px 0 0;color:#8a5b2b}
            .lcj2-nova-scan-btn{min-width:190px!important;padding:10px 14px!important;border-radius:18px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;text-align:left!important;background:linear-gradient(135deg,#c79a3f,#b58338 50%,#991b1b)!important;box-shadow:0 13px 30px rgba(181,131,56,.22),inset 0 1px 0 rgba(255,255,255,.18)!important}
            .lcj2-nova-btn-icon{width:33px;height:33px;border-radius:11px;display:grid;place-items:center;background:rgba(255,255,255,.18);font-size:19px}.lcj2-nova-scan-btn b{display:block;font-size:9px;letter-spacing:.7px}.lcj2-nova-scan-btn small{display:block;margin-top:2px;font-size:7px;color:rgba(255,255,255,.82)}
            #lcj2-image-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:11px!important;margin:0!important}
            .lcj2-img-card{border-radius:18px!important;background:linear-gradient(160deg,#ffffff,#fff8f1)!important;border-color:rgba(181,131,56,.12)!important;box-shadow:0 10px 22px rgba(110,61,20,.05)!important}
            .lcj2-img-card:hover{transform:translateY(-3px)!important;border-color:rgba(181,131,56,.24)!important;box-shadow:0 18px 34px rgba(110,61,20,.12)!important}
            .lcj2-img-card.target{border-color:rgba(181,131,56,.44)!important;box-shadow:0 0 0 1px rgba(181,131,56,.07),0 15px 32px rgba(110,61,20,.10)!important}
            .lcj2-img-card img{height:236px!important;background:#fffaf6!important}
            .lcj2-img-index{border-radius:9px!important;background:rgba(255,255,255,.98)!important;font-size:8px!important;color:#8a5b2b!important;border:1px solid rgba(181,131,56,.10)!important}
            .lcj2-target-tag{color:#b58338!important}
            .lcj2-ocr-badge{font-size:8.5px!important;border-radius:10px!important;margin:0 8px 8px!important}
            .lcj2-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:220px!important;margin:0!important;border-radius:18px!important;background:#fffaf5!important;border-color:rgba(181,131,56,.12)!important;color:#8a5b2b!important}
            .lcj2-empty b{font-size:11px;color:#7c1d1d}.lcj2-empty span{font-size:8px}.lcj2-nova-empty-icon{font-size:27px;color:#b58338;margin-bottom:4px}

            /* Output */
            .lcj2-nova-output-card{background:linear-gradient(155deg,#ffffff,#fff8f1)!important;border-color:rgba(181,131,56,.12)!important}
            .lcj2-copy-btn{min-width:120px!important;border-radius:13px!important;padding:10px 13px!important}
            #lcj2-output{height:142px!important;margin:0!important;border-radius:15px!important;background:#fffdfb!important;border-color:rgba(181,131,56,.12)!important;color:#7c1d1d!important;font-size:10px!important}

            /* Matikan efek berat saat OCR, desain tetap sama */
            #lcj2-panel-fixed.lcj2-performance-mode{background:#fff8f2!important}
            #lcj2-panel-fixed.lcj2-performance-mode:before{display:none!important}
            #lcj2-panel-fixed.lcj2-performance-mode .lcj2-nova-sidebar{position:static!important}

            .lcj2-bank-head{justify-content:space-between!important}
            .lcj2-bank-head-main{display:flex;align-items:center;gap:10px;min-width:0}
            .lcj2-bank-refresh{
                flex:0 0 auto;padding:7px 9px!important;border-radius:10px!important;
                background:linear-gradient(135deg,#c79a3f,#8a5b2b)!important;
                border-color:rgba(181,131,56,.24)!important;color:#fff!important;
                font-size:7px!important;letter-spacing:.7px!important
            }
            .lcj2-bank-lookup-state{margin-top:7px!important}
            .lcj2-bank-lookup-state.success{border-color:rgba(34,197,94,.28)!important}
            .lcj2-bank-lookup-state.failed{border-color:rgba(185,28,28,.24)!important}

            @media(max-width:1180px){
                .lcj2-nova-hero{grid-template-columns:1fr!important}
                .lcj2-nova-workspace{grid-template-columns:300px minmax(0,1fr)!important}
                .lcj2-nova-identity{grid-template-columns:repeat(3,minmax(0,1fr))!important}
                #lcj2-image-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
            }
            @media(max-width:820px){
                #lcj2-panel-fixed{padding:9px!important}
                .lcj2-nova-topbar{align-items:flex-start!important;flex-direction:column!important}
                .lcj2-nova-top-actions{width:100%;justify-content:space-between}
                .lcj2-nova-workspace{grid-template-columns:1fr!important}
                .lcj2-nova-sidebar{position:static!important}
                .lcj2-nova-identity{grid-template-columns:1fr!important}
                .lcj2-nova-gallery-head,.lcj2-output-head{align-items:stretch!important;flex-direction:column!important}
                .lcj2-nova-scan-btn{width:100%!important}
                #lcj2-image-grid{grid-template-columns:1fr!important}
                .lcj2-img-card img{height:220px!important}
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
            #lcj2-panel-fixed{
                background:
                    radial-gradient(circle at 8% 0%,rgba(255,204,51,.24),transparent 27%),
                    radial-gradient(circle at 94% 4%,rgba(255,59,48,.15),transparent 28%),
                    radial-gradient(circle at 48% 100%,rgba(255,159,67,.10),transparent 35%),
                    linear-gradient(180deg,#ffffff 0%,#fff8f6 54%,#fffdf8 100%)!important;
                color:#202331!important;
            }
            #lcj2-panel-fixed:before{
                opacity:.22!important;
                background-image:
                    linear-gradient(rgba(255,99,99,.055) 1px,transparent 1px),
                    linear-gradient(90deg,rgba(255,99,99,.055) 1px,transparent 1px)!important;
            }

            /* Bubble lebih cerah */
            #lcj2-bubble-fixed{
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
            .lcj2-nova-ring{border-color:rgba(255,59,48,.60)!important;filter:drop-shadow(0 0 8px rgba(255,59,48,.35))!important}
            .lcj2-nova-ring:before{background:#ffb020!important;box-shadow:0 0 14px #ffb020!important}
            .lcj2-nova-ring:after{background:#ff3b30!important;box-shadow:0 0 14px #ff3b30!important}
            .lcj2-nova-lens{
                background:linear-gradient(145deg,#ffffff,#ffe9e3)!important;
                border-color:rgba(255,59,48,.38)!important;
                box-shadow:inset 0 0 20px rgba(255,99,71,.11),0 8px 18px rgba(225,29,72,.14)!important;
            }
            .lcj2-nova-lens:before{border-color:rgba(255,59,48,.55)!important;box-shadow:inset 0 0 12px rgba(255,59,48,.10),0 0 13px rgba(255,176,32,.18)!important}
            .lcj2-nova-lens-dot{background:#ff3b30!important;box-shadow:0 0 14px #ff3b30!important}
            .lcj2-jam2-number{color:#ef2f3c!important;text-shadow:0 0 12px rgba(255,59,48,.35)!important}
            .lcj2-jam2-wib{color:#b45309!important}
            .lcj2-nova-laser{background:linear-gradient(90deg,transparent,#ff3b30 18%,#fff 50%,#ffb020 82%,transparent)!important;box-shadow:0 0 13px rgba(255,59,48,.60)!important}
            .lcj2-nova-corner{border-color:#ff3b30!important}
            .lcj2-nova-caption{color:#d61f2c!important;text-shadow:0 0 9px rgba(255,59,48,.30)!important}
            #lcj2-bubble-fixed:hover{box-shadow:0 28px 65px rgba(225,29,72,.24),0 0 0 8px rgba(255,176,32,.10),0 0 48px rgba(255,59,48,.28)!important}

            /* Header & hero */
            .lcj2-nova-topbar{
                border-color:rgba(255,59,48,.16)!important;
                background:linear-gradient(135deg,#ffffff 0%,#fff8f5 58%,#fff0e8 100%)!important;
                box-shadow:0 18px 42px rgba(190,24,93,.08),inset 0 1px 0 #fff!important;
            }
            .lcj2-nova-topbar:before{background:linear-gradient(180deg,#ff3b30,#ff6b5e,#ffb020)!important;box-shadow:0 0 18px rgba(255,59,48,.30)!important}
            .lcj2-nova-topbar:after{background:radial-gradient(circle,rgba(255,176,32,.18),transparent 65%)!important}
            .lcj2-nova-logo{background:linear-gradient(145deg,#ffffff,#ffe4dc)!important;border-color:rgba(255,59,48,.20)!important;box-shadow:0 10px 24px rgba(225,29,72,.10),inset 0 1px 0 #fff!important}
            .lcj2-nova-logo svg{stroke:#ef2f3c!important;filter:drop-shadow(0 0 8px rgba(255,59,48,.22))!important}
            .lcj2-nova-eyebrow{color:#ef2f3c!important}
            .lcj2-title{color:#b3132f!important}
            .lcj2-subtitle{color:#84515d!important}
            .lcj2-version{background:#fff1cf!important;border-color:rgba(255,176,32,.28)!important;color:#a35e00!important}
            .lcj2-nova-live-chip{background:#effdf5!important;border-color:rgba(34,197,94,.22)!important;color:#15803d!important}
            .lcj2-nova-close{background:#fff0f2!important;border-color:rgba(225,29,72,.20)!important;color:#be123c!important}
            .lcj2-nova-close:hover{background:#ffe1e6!important}

            .lcj2-nova-status{
                background:
                    radial-gradient(circle at 92% 0%,rgba(255,176,32,.18),transparent 42%),
                    linear-gradient(135deg,#ffffff,#fff5f1)!important;
                border-color:rgba(255,59,48,.17)!important;
                box-shadow:0 15px 34px rgba(190,24,93,.07),inset 0 1px 0 #fff!important;
            }
            .lcj2-nova-status-icon{background:#fff0ed!important;border-color:rgba(255,59,48,.20)!important}
            .lcj2-nova-status-icon svg{stroke:#ef2f3c!important}
            .lcj2-nova-status .lcj2-status-title{color:#e52c39!important}
            .lcj2-nova-status .lcj2-ocr-box{color:#272534!important}
            .lcj2-nova-status .lcj2-progress{background:#ffe7e2!important}
            .lcj2-nova-status .lcj2-progress span{background:linear-gradient(90deg,#ff3b30,#ff6b5e,#ffb020)!important}

            /* Semua kartu dalam dibuat putih terang */
            .lcj2-card,
            .lcj2-nova-stat,
            .lcj2-nova-guide,
            .lcj2-nova-output-card{
                background:linear-gradient(155deg,#ffffff 0%,#fffaf8 100%)!important;
                border-color:rgba(239,68,68,.13)!important;
                box-shadow:0 15px 34px rgba(190,24,93,.065),inset 0 1px 0 #fff!important;
            }
            .lcj2-nova-stat.ok{background:linear-gradient(155deg,#ffffff,#edfff4)!important;border-color:rgba(34,197,94,.20)!important}
            .lcj2-nova-stat.bad{background:linear-gradient(155deg,#ffffff,#fff0f2)!important;border-color:rgba(225,29,72,.18)!important}
            .lcj2-nova-stat.user{background:linear-gradient(155deg,#ffffff,#fff6ed)!important;border-color:rgba(255,159,67,.20)!important}
            .lcj2-nova-stat.mode{background:linear-gradient(155deg,#ffffff,#fff9df)!important;border-color:rgba(255,176,32,.22)!important}
            .lcj2-nova-stat-label{color:#d12a38!important}
            .lcj2-nova-stat strong{color:#252331!important}
            .lcj2-user-edit{color:#252331!important}
            .lcj2-user-edit:focus{background:#fff!important;box-shadow:0 0 0 3px rgba(255,59,48,.10)!important}
            .lcj2-nova-stat small{color:#88616a!important}
            .lcj2-nova-section-head b,.lcj2-nova-guide-row b{color:#252331!important}
            .lcj2-nova-section-head small,.lcj2-nova-guide-row small,.lcj2-nova-guide-title{color:#88616a!important}
            .lcj2-nova-step{background:#fff0ed!important;border-color:rgba(255,59,48,.18)!important;color:#e52c39!important}
            .lcj2-nova-section-head.orange .lcj2-nova-step{background:#fff5cf!important;border-color:rgba(255,176,32,.24)!important;color:#a75e00!important}
            .lcj2-nova-guide-row{border-color:rgba(239,68,68,.08)!important}
            .lcj2-nova-guide-row>span{background:#fff1ec!important;color:#ef2f3c!important}

            /* Input & tombol */
            .lcj2-input{
                background:#ffffff!important;
                border-color:rgba(239,68,68,.16)!important;
                color:#252331!important;
                box-shadow:0 4px 12px rgba(190,24,93,.035),inset 0 1px 0 #fff!important;
            }
            .lcj2-input::placeholder{color:#b18b94!important}
            .lcj2-input:focus{border-color:rgba(255,59,48,.48)!important;box-shadow:0 0 0 4px rgba(255,59,48,.09),0 6px 16px rgba(190,24,93,.06)!important}
            .lcj2-btn{background:linear-gradient(180deg,#ffffff,#fff4f0)!important;border-color:rgba(239,68,68,.16)!important;color:#b3132f!important;box-shadow:0 7px 16px rgba(190,24,93,.07),inset 0 1px 0 #fff!important}
            .lcj2-btn:hover{background:linear-gradient(180deg,#fff8f5,#ffe7e1)!important;border-color:rgba(255,59,48,.30)!important}
            .lcj2-btn.primary,.lcj2-nova-scan-btn{
                color:#fff!important;
                background:linear-gradient(135deg,#ff3b30 0%,#ef2f3c 50%,#ff9f43 100%)!important;
                border-color:rgba(255,59,48,.32)!important;
                box-shadow:0 14px 30px rgba(225,29,72,.22),inset 0 1px 0 rgba(255,255,255,.28)!important;
            }
            .lcj2-btn.green{color:#fff!important;background:linear-gradient(135deg,#2dd66f,#16a34a)!important;border-color:rgba(34,197,94,.26)!important}
            .lcj2-btn.blue{color:#fff!important;background:linear-gradient(135deg,#38bdf8,#2563eb)!important;border-color:rgba(37,99,235,.25)!important}
            .lcj2-btn.red{color:#fff!important;background:linear-gradient(135deg,#fb7185,#e11d48)!important;border-color:rgba(225,29,72,.26)!important}
            .lcj2-btn.orange{color:#fff!important;background:linear-gradient(135deg,#ffc62f,#f59e0b)!important;border-color:rgba(245,158,11,.28)!important}
            .lcj2-bank-refresh{background:linear-gradient(135deg,#ff9f43,#ef2f3c)!important;border-color:rgba(239,68,68,.24)!important;box-shadow:0 8px 17px rgba(225,29,72,.16)!important}
            .lcj2-inline-copy{background:#fff4f0!important;border-color:rgba(239,68,68,.16)!important;color:#e52c39!important}

            /* Status scan dibuat terang */
            .lcj2-scan-state{background:#ffffff!important;border-color:rgba(148,163,184,.22)!important;box-shadow:0 8px 20px rgba(71,85,105,.07),inset 0 1px 0 #fff!important}
            .lcj2-scan-state-label{color:#98636e!important}
            .lcj2-scan-state-text{color:#30303d!important}
            .lcj2-scan-state-detail{color:#96737b!important}
            .lcj2-scan-state.waiting{background:linear-gradient(145deg,#ffffff,#eff8ff)!important;border-color:rgba(59,130,246,.20)!important}
            .lcj2-scan-state.scanning{background:linear-gradient(145deg,#ffffff,#eafcff)!important;border-color:rgba(6,182,212,.24)!important}
            .lcj2-scan-state.success{background:linear-gradient(145deg,#ffffff,#edfff3)!important;border-color:rgba(34,197,94,.24)!important}
            .lcj2-scan-state.partial{background:linear-gradient(145deg,#ffffff,#fff8db)!important;border-color:rgba(245,158,11,.25)!important}
            .lcj2-scan-state.failed{background:linear-gradient(145deg,#ffffff,#fff0f3)!important;border-color:rgba(225,29,72,.24)!important}
            .lcj2-scan-state.waiting .lcj2-scan-state-text{color:#2563eb!important}
            .lcj2-scan-state.scanning .lcj2-scan-state-text{color:#0891b2!important}
            .lcj2-scan-state.success .lcj2-scan-state-text{color:#15803d!important}
            .lcj2-scan-state.partial .lcj2-scan-state-text{color:#b45309!important}
            .lcj2-scan-state.failed .lcj2-scan-state-text{color:#be123c!important}

            /* Galeri dan hasil */
            .lcj2-nova-kicker{color:#e52c39!important}
            .lcj2-nova-gallery-head h4,.lcj2-output-head h4{color:#b3132f!important}
            .lcj2-nova-gallery-head p,.lcj2-output-head p{color:#88616a!important}
            .lcj2-img-card{background:#ffffff!important;border-color:rgba(239,68,68,.12)!important;box-shadow:0 10px 23px rgba(190,24,93,.06)!important}
            .lcj2-img-card:hover{border-color:rgba(255,59,48,.30)!important;box-shadow:0 18px 36px rgba(190,24,93,.11)!important}
            .lcj2-img-card.target{border-color:rgba(255,176,32,.55)!important;box-shadow:0 0 0 2px rgba(255,176,32,.08),0 16px 34px rgba(190,24,93,.08)!important}
            .lcj2-img-card img,.lcj2-img-media{background:#fffaf8!important}
            .lcj2-img-index{background:rgba(255,255,255,.96)!important;color:#b3132f!important;border-color:rgba(239,68,68,.12)!important}
            .lcj2-target-tag{color:#d97706!important}
            .lcj2-img-label{color:#8f6871!important;border-color:rgba(239,68,68,.07)!important}
            .lcj2-ocr-badge{background:#eefcff!important;color:#087f9a!important;border-color:rgba(6,182,212,.16)!important}
            .lcj2-ocr-badge.success{background:#edfff4!important;color:#15803d!important;border-color:rgba(34,197,94,.20)!important}
            .lcj2-ocr-badge.error{background:#fff0f3!important;color:#be123c!important;border-color:rgba(225,29,72,.20)!important}
            .lcj2-ocr-badge.empty{background:#f8fafc!important;color:#64748b!important;border-color:rgba(100,116,139,.14)!important}
            .lcj2-empty{background:linear-gradient(145deg,#ffffff,#fff7f3)!important;border-color:rgba(239,68,68,.14)!important;color:#98636e!important}
            .lcj2-empty b{color:#b3132f!important}.lcj2-nova-empty-icon{color:#ff3b30!important}
            #lcj2-output{background:#ffffff!important;border-color:rgba(239,68,68,.15)!important;color:#b3132f!important;box-shadow:inset 0 1px 0 #fff!important}
            #lcj2-output:focus{border-color:rgba(255,59,48,.34)!important;box-shadow:0 0 0 4px rgba(255,59,48,.07)!important}
            .lcj2-pill{background:#ffffff!important;color:#38323c!important;border-color:rgba(239,68,68,.12)!important}
            .lcj2-pill.blue{background:#eefaff!important;color:#087f9a!important;border-color:rgba(6,182,212,.16)!important}
            .lcj2-pill.green{background:#effdf5!important;color:#15803d!important;border-color:rgba(34,197,94,.18)!important}
            .lcj2-pill.red{background:#fff0f3!important;color:#be123c!important;border-color:rgba(225,29,72,.18)!important}

            #lcj2-panel-fixed.lcj2-performance-mode{background:#fffaf8!important}

            /* V5.6.1: mode pemindahan gambar super ringan.
               Efek berat dimatikan hanya selama drag agar kartu mengikuti pointer tanpa patah-patah. */
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card,
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card:hover,
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card.target{
                transition:none!important;
                transform:none!important;
                box-shadow:none!important;
                will-change:auto!important;
            }
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card img{
                transition:none!important;
                transform:none!important;
                pointer-events:none!important;
            }
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card *{pointer-events:none!important}
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card.dragging{
                opacity:.32!important;
                border-style:dashed!important;
            }
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card.over{
                opacity:1!important;
                border-color:#22c55e!important;
                background:#f0fff5!important;
                box-shadow:0 0 0 3px rgba(34,197,94,.10)!important;
            }

            /* =========================================================
               LAMPU AKSES HARIAN 23.50–02.00 WIB
               ========================================================= */
            #lcj2-bubble-fixed{
                width:92px!important;
                height:108px!important;
                padding:0!important;
                border:0!important;
                border-radius:28px!important;
                background:linear-gradient(160deg,#171b24,#080a0f)!important;
                box-shadow:0 22px 52px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.10)!important;
                overflow:visible!important;
                isolation:isolate!important;
                transition:transform .2s ease,filter .25s ease,box-shadow .25s ease!important;
            }
            #lcj2-bubble-fixed:before{
                content:""!important;
                display:block!important;
                position:absolute!important;
                left:11px!important;
                right:11px!important;
                top:9px!important;
                height:72px!important;
                border-radius:23px!important;
                background:linear-gradient(145deg,#242a35,#0c0f16)!important;
                border:1px solid rgba(255,255,255,.10)!important;
                box-shadow:inset 0 0 22px rgba(0,0,0,.58)!important;
                z-index:0!important;
            }
            #lcj2-bubble-fixed:after{
                content:""!important;
                display:block!important;
                position:absolute!important;
                left:29px!important;
                bottom:-7px!important;
                width:34px!important;
                height:12px!important;
                border-radius:0 0 9px 9px!important;
                background:linear-gradient(#151922,#05070b)!important;
                border:1px solid rgba(255,255,255,.08)!important;
                z-index:-1!important;
            }
            #lcj2-bubble-fixed .lcj2-nova-ring{display:none!important}
            .lcj2-lamp-face{
                position:absolute;
                left:20px;
                top:17px;
                width:52px;
                height:52px;
                border-radius:50%;
                display:flex;
                flex-direction:column;
                align-items:center;
                justify-content:center;
                z-index:3;
                background:radial-gradient(circle at 36% 28%,#4b5563,#111827 58%,#030712);
                border:2px solid #475569;
                box-shadow:inset 0 0 18px rgba(0,0,0,.72),0 0 0 6px rgba(71,85,105,.13);
                transition:background .3s ease,border-color .3s ease,box-shadow .3s ease;
            }
            .lcj2-lamp-number{
                font-size:23px;
                line-height:21px;
                font-weight:1000;
                letter-spacing:-1px;
                color:#94a3b8;
                text-shadow:none;
                transition:color .3s ease,text-shadow .3s ease;
            }
            .lcj2-lamp-unit{
                margin-top:2px;
                font-size:7px;
                line-height:8px;
                font-weight:1000;
                letter-spacing:1.5px;
                color:#64748b;
                transition:color .3s ease;
            }
            .lcj2-lamp-caption{
                position:absolute;
                left:5px;
                right:5px;
                bottom:13px;
                z-index:3;
                font-size:9px;
                line-height:11px;
                font-weight:1000;
                letter-spacing:1.3px;
                text-align:center;
                color:#64748b;
            }
            .lcj2-lamp-led{
                position:absolute;
                right:13px;
                top:12px;
                z-index:5;
                width:10px;
                height:10px;
                border-radius:50%;
                background:#475569;
                border:2px solid #111827;
                box-shadow:none;
                transition:background .25s ease,box-shadow .25s ease;
            }
            .lcj2-lamp-message{
                position:absolute;
                right:102px;
                top:28px;
                width:max-content;
                max-width:190px;
                padding:9px 12px;
                border-radius:12px;
                color:#e2e8f0;
                background:rgba(8,10,15,.96);
                border:1px solid rgba(148,163,184,.20);
                box-shadow:0 14px 32px rgba(0,0,0,.36);
                font-size:10px;
                line-height:1.35;
                font-weight:900;
                letter-spacing:.35px;
                text-align:left;
                pointer-events:none;
                opacity:0;
                transform:translateX(8px);
                transition:opacity .18s ease,transform .18s ease;
            }
            #lcj2-bubble-fixed.lcj2-show-message .lcj2-lamp-message{
                opacity:1;
                transform:translateX(0);
            }
            #lcj2-bubble-fixed.lcj2-access-active{
                cursor:grab!important;
                box-shadow:0 24px 58px rgba(0,0,0,.62),0 0 26px rgba(34,197,94,.23),inset 0 1px 0 rgba(255,255,255,.12)!important;
            }
            #lcj2-bubble-fixed.lcj2-access-active .lcj2-lamp-face{
                background:radial-gradient(circle at 36% 28%,#ecfdf5,#22c55e 38%,#047857 72%,#022c22);
                border-color:#86efac;
                box-shadow:inset 0 0 16px rgba(255,255,255,.28),0 0 0 6px rgba(34,197,94,.12),0 0 30px rgba(34,197,94,.72);
                animation:lcj2LampAlive 1.65s ease-in-out infinite;
            }
            #lcj2-bubble-fixed.lcj2-access-active .lcj2-lamp-number{
                color:#ffffff;
                text-shadow:0 0 12px rgba(255,255,255,.92),0 0 18px rgba(187,247,208,.72);
            }
            #lcj2-bubble-fixed.lcj2-access-active .lcj2-lamp-unit{color:#dcfce7}
            #lcj2-bubble-fixed.lcj2-access-active .lcj2-lamp-caption{color:#86efac}
            #lcj2-bubble-fixed.lcj2-access-active .lcj2-lamp-led{
                background:#4ade80;
                box-shadow:0 0 0 4px rgba(74,222,128,.12),0 0 14px #4ade80;
                animation:lcj2LampLed 1s ease-in-out infinite;
            }
            #lcj2-bubble-fixed.lcj2-access-inactive{
                cursor:not-allowed!important;
                filter:saturate(.28) brightness(.80);
            }
            #lcj2-bubble-fixed.lcj2-access-inactive:hover{
                transform:translateY(-2px) scale(1.02)!important;
                filter:saturate(.35) brightness(.88);
            }
            #lcj2-bubble-fixed.lcj2-access-inactive .lcj2-lamp-caption{
                color:#94a3b8;
                letter-spacing:.7px;
            }
            @keyframes lcj2LampAlive{
                0%,100%{transform:scale(.96);box-shadow:inset 0 0 16px rgba(255,255,255,.24),0 0 0 6px rgba(34,197,94,.10),0 0 22px rgba(34,197,94,.50)}
                50%{transform:scale(1.035);box-shadow:inset 0 0 18px rgba(255,255,255,.34),0 0 0 8px rgba(34,197,94,.15),0 0 38px rgba(34,197,94,.88)}
            }
            @keyframes lcj2LampLed{0%,100%{opacity:.55}50%{opacity:1}}

            /* =========================================================
               FINAL UI V1.4 — panel dalam hijau hitam
               ========================================================= */
            :root{
                --lcj2-v14-bg:#06110b!important;
                --lcj2-v14-panel:#0a1810!important;
                --lcj2-v14-panel2:#102219!important;
                --lcj2-v14-soft:#163124!important;
                --lcj2-v14-line:rgba(74,222,128,.14)!important;
                --lcj2-v14-green:#4ade80!important;
                --lcj2-v14-green2:#22c55e!important;
                --lcj2-v14-mint:#86efac!important;
                --lcj2-v14-lime:#bef264!important;
                --lcj2-v14-gold:#facc15!important;
                --lcj2-v14-red:#fb7185!important;
                --lcj2-v14-text:#eefcf3!important;
                --lcj2-v14-muted:#9db8a6!important;
            }

            #lcj2-panel-fixed{
                background:
                    radial-gradient(circle at 10% 0%,rgba(34,197,94,.16),transparent 28%),
                    radial-gradient(circle at 100% 8%,rgba(74,222,128,.12),transparent 24%),
                    radial-gradient(circle at 50% 100%,rgba(190,242,100,.06),transparent 33%),
                    linear-gradient(180deg,#040c07 0%,#07110b 48%,#030905 100%)!important;
                color:var(--lcj2-v14-text)!important;
            }
            #lcj2-panel-fixed:before{
                opacity:.14!important;
                background-image:
                    linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),
                    linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)!important;
            }
            #lcj2-panel-fixed:after{
                opacity:.18!important;
                background:
                    linear-gradient(115deg,transparent 0 42%,rgba(255,255,255,.03) 50%,transparent 58%),
                    radial-gradient(circle at 50% -10%,rgba(74,222,128,.08),transparent 50%)!important;
            }

            .lcj2-nova-topbar{
                background:linear-gradient(145deg,rgba(10,24,16,.96),rgba(7,18,12,.96),rgba(12,29,19,.95))!important;
                border-color:rgba(74,222,128,.12)!important;
                box-shadow:0 20px 52px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.04)!important;
            }
            .lcj2-nova-topbar:before{
                background:linear-gradient(90deg,transparent,#4ade80,#86efac,#bef264,transparent)!important;
                box-shadow:0 0 18px rgba(74,222,128,.18)!important;
            }
            .lcj2-nova-topbar:after{background:radial-gradient(circle,rgba(74,222,128,.14),transparent 66%)!important}
            .lcj2-nova-logo{
                background:linear-gradient(145deg,rgba(15,34,22,.95),rgba(8,18,12,.95))!important;
                border-color:rgba(74,222,128,.15)!important;
                box-shadow:0 10px 24px rgba(0,0,0,.28),0 0 24px rgba(34,197,94,.07)!important;
            }
            .lcj2-nova-logo svg{stroke:#86efac!important}
            .lcj2-nova-eyebrow{color:#a7f3c5!important}
            .lcj2-title{color:#f3fff7!important}
            .lcj2-subtitle,.lcj2-version,.lcj2-nova-gallery-head p,.lcj2-output-head p,.lcj2-nova-guide-title,.lcj2-nova-section-head small,.lcj2-nova-guide-row small{
                color:var(--lcj2-v14-muted)!important;
            }
            .lcj2-version{
                background:rgba(74,222,128,.08)!important;
                border-color:rgba(74,222,128,.15)!important;
            }
            .lcj2-nova-live-chip{
                background:rgba(74,222,128,.10)!important;
                border-color:rgba(74,222,128,.16)!important;
                color:#d8ffe6!important;
            }
            .lcj2-nova-close{
                background:rgba(15,27,19,.94)!important;
                border-color:rgba(148,163,184,.10)!important;
                color:#d0e3d6!important;
            }
            .lcj2-nova-close:hover{background:rgba(23,41,28,.98)!important;color:#fff!important}

            .lcj2-nova-status,
            .lcj2-card,
            .lcj2-nova-stat,
            .lcj2-nova-guide,
            .lcj2-nova-output-card,
            .lcj2-img-card{
                background:linear-gradient(155deg,rgba(10,24,16,.97),rgba(6,14,9,.99))!important;
                border-color:var(--lcj2-v14-line)!important;
                box-shadow:0 18px 38px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.03)!important;
            }
            .lcj2-nova-status{
                background:
                    radial-gradient(circle at 92% 0%,rgba(74,222,128,.08),transparent 40%),
                    linear-gradient(145deg,rgba(10,24,16,.97),rgba(6,14,9,.99))!important;
            }
            .lcj2-nova-status-icon{
                background:linear-gradient(145deg,rgba(18,42,26,.94),rgba(8,17,11,.96))!important;
                border-color:rgba(74,222,128,.16)!important;
            }
            .lcj2-nova-status-icon svg{stroke:#86efac!important}
            .lcj2-status-title,.lcj2-nova-kicker,.lcj2-nova-gallery-head h4,.lcj2-output-head h4{color:#ecfff2!important}
            .lcj2-ocr-box,.lcj2-nova-section-head b,.lcj2-nova-guide-row b,.lcj2-nova-stat strong,.lcj2-user-edit{color:#f4fff8!important}
            .lcj2-user-edit:focus{background:rgba(10,24,16,.96)!important;box-shadow:0 0 0 3px rgba(74,222,128,.14)!important}

            .lcj2-nova-stat.ok{
                background:linear-gradient(155deg,rgba(8,38,22,.97),rgba(5,22,12,.99))!important;
                border-color:rgba(74,222,128,.18)!important;
            }
            .lcj2-nova-stat.bad{
                background:linear-gradient(155deg,rgba(34,14,22,.97),rgba(18,8,12,.99))!important;
                border-color:rgba(251,113,133,.14)!important;
            }
            .lcj2-nova-stat.user{
                background:linear-gradient(155deg,rgba(31,29,8,.97),rgba(16,15,5,.99))!important;
                border-color:rgba(250,204,21,.15)!important;
            }
            .lcj2-nova-stat.mode{
                background:linear-gradient(155deg,rgba(12,34,20,.97),rgba(7,18,10,.99))!important;
                border-color:rgba(134,239,172,.15)!important;
            }
            .lcj2-nova-stat-label{color:#bde9cb!important}
            .lcj2-nova-stat small{color:#96b1a0!important}

            .lcj2-nova-step,
            .lcj2-nova-guide-row>span{
                background:rgba(74,222,128,.08)!important;
                border-color:rgba(74,222,128,.14)!important;
                color:#b9ffd1!important;
            }
            .lcj2-nova-section-head.orange .lcj2-nova-step{
                background:rgba(250,204,21,.09)!important;
                border-color:rgba(250,204,21,.14)!important;
                color:#ffe58c!important;
            }
            .lcj2-nova-guide-row{border-color:rgba(148,163,184,.07)!important}

            .lcj2-input,
            #lcj2-output{
                background:linear-gradient(180deg,rgba(4,10,6,.97),rgba(6,14,9,.97))!important;
                border-color:rgba(74,222,128,.14)!important;
                color:#eefcf3!important;
                box-shadow:inset 0 2px 10px rgba(0,0,0,.34),0 1px 0 rgba(255,255,255,.015)!important;
            }
            .lcj2-input::placeholder{color:#6d8a76!important}
            .lcj2-input:focus,
            #lcj2-output:focus{
                border-color:rgba(74,222,128,.30)!important;
                box-shadow:0 0 0 4px rgba(74,222,128,.08),0 10px 24px rgba(0,0,0,.22)!important;
            }

            .lcj2-btn{
                background:linear-gradient(180deg,#173224,#112519)!important;
                border-color:rgba(148,163,184,.12)!important;
                color:#edfdf2!important;
                box-shadow:0 10px 24px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.04)!important;
            }
            .lcj2-btn:hover{
                background:linear-gradient(180deg,#1c3d2b,#143020)!important;
                border-color:rgba(74,222,128,.20)!important;
            }
            .lcj2-btn.primary,.lcj2-nova-scan-btn{
                background:linear-gradient(135deg,#16a34a 0%,#22c55e 56%,#84cc16 100%)!important;
                border-color:rgba(74,222,128,.26)!important;
                color:#fff!important;
                box-shadow:0 16px 34px rgba(34,197,94,.22),inset 0 1px 0 rgba(255,255,255,.14)!important;
            }
            .lcj2-btn.green{background:linear-gradient(135deg,#22c55e,#16a34a)!important;color:#fff!important;border-color:rgba(74,222,128,.24)!important}
            .lcj2-btn.blue{background:linear-gradient(135deg,#34d399,#059669)!important;color:#fff!important;border-color:rgba(52,211,153,.24)!important}
            .lcj2-btn.red{background:linear-gradient(135deg,#fb7185,#e11d48)!important;color:#fff!important;border-color:rgba(251,113,133,.20)!important}
            .lcj2-btn.orange{background:linear-gradient(135deg,#facc15,#eab308)!important;color:#fff!important;border-color:rgba(250,204,21,.22)!important}
            .lcj2-bank-refresh{background:linear-gradient(135deg,#16a34a,#65a30d)!important;border-color:rgba(74,222,128,.22)!important}
            .lcj2-inline-copy{
                background:rgba(74,222,128,.08)!important;
                border-color:rgba(74,222,128,.14)!important;
                color:#bbffd1!important;
            }

            .lcj2-scan-state{
                background:linear-gradient(145deg,rgba(10,22,15,.97),rgba(6,14,9,.99))!important;
                border-color:rgba(148,163,184,.10)!important;
                box-shadow:0 10px 24px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.03)!important;
            }
            .lcj2-scan-state-label{color:#9ab5a2!important}
            .lcj2-scan-state-text{color:#edfdf2!important}
            .lcj2-scan-state-detail{color:#90aa99!important}
            .lcj2-scan-state.waiting{background:linear-gradient(145deg,rgba(14,27,18,.97),rgba(8,16,10,.99))!important;border-color:rgba(134,239,172,.12)!important}
            .lcj2-scan-state.scanning{background:linear-gradient(145deg,rgba(8,38,20,.97),rgba(6,18,10,.99))!important;border-color:rgba(74,222,128,.16)!important}
            .lcj2-scan-state.success{background:linear-gradient(145deg,rgba(7,43,20,.97),rgba(5,22,12,.99))!important;border-color:rgba(74,222,128,.18)!important}
            .lcj2-scan-state.partial{background:linear-gradient(145deg,rgba(39,36,8,.97),rgba(20,18,5,.99))!important;border-color:rgba(250,204,21,.16)!important}
            .lcj2-scan-state.failed{background:linear-gradient(145deg,rgba(43,15,22,.97),rgba(21,8,11,.99))!important;border-color:rgba(251,113,133,.16)!important}
            .lcj2-scan-state.waiting .lcj2-scan-state-text{color:#ccffe0!important}
            .lcj2-scan-state.scanning .lcj2-scan-state-text{color:#b9ffd1!important}
            .lcj2-scan-state.success .lcj2-scan-state-text{color:#d6ffe4!important}
            .lcj2-scan-state.partial .lcj2-scan-state-text{color:#ffe58c!important}
            .lcj2-scan-state.failed .lcj2-scan-state-text{color:#fecdd3!important}

            .lcj2-img-card:hover{border-color:rgba(74,222,128,.22)!important;box-shadow:0 18px 38px rgba(0,0,0,.32),0 0 0 1px rgba(74,222,128,.05)!important}
            .lcj2-img-card.target{border-color:rgba(250,204,21,.34)!important;box-shadow:0 0 0 1px rgba(250,204,21,.06),0 16px 34px rgba(0,0,0,.30)!important}
            .lcj2-img-card img,.lcj2-img-media{background:#07110b!important}
            .lcj2-img-index{
                background:rgba(7,17,11,.95)!important;
                border-color:rgba(148,163,184,.10)!important;
                color:#effcf3!important;
            }
            .lcj2-target-tag{color:#ffe58c!important}
            .lcj2-img-label{color:#92ad9b!important;border-color:rgba(148,163,184,.06)!important}
            .lcj2-ocr-badge{background:rgba(21,128,61,.16)!important;color:#bbffd1!important;border-color:rgba(74,222,128,.14)!important}
            .lcj2-ocr-badge.success{background:rgba(22,163,74,.14)!important;color:#d7ffe5!important;border-color:rgba(74,222,128,.15)!important}
            .lcj2-ocr-badge.error{background:rgba(190,24,93,.12)!important;color:#fecdd3!important;border-color:rgba(251,113,133,.14)!important}
            .lcj2-ocr-badge.empty{background:rgba(23,33,28,.48)!important;color:#a5b8ab!important;border-color:rgba(148,163,184,.10)!important}
            .lcj2-empty{
                background:linear-gradient(145deg,rgba(10,22,15,.97),rgba(6,14,9,.99))!important;
                border-color:rgba(148,163,184,.10)!important;
                color:#9db8a6!important;
            }
            .lcj2-empty b{color:#effcf3!important}
            .lcj2-nova-empty-icon{color:#86efac!important}

            .lcj2-pill{
                background:rgba(10,22,15,.92)!important;
                border-color:rgba(148,163,184,.10)!important;
                color:#edfdf2!important;
            }
            .lcj2-pill.blue{background:rgba(8,56,34,.82)!important;color:#bbffd1!important;border-color:rgba(74,222,128,.14)!important}
            .lcj2-pill.green{background:rgba(7,43,20,.82)!important;color:#d6ffe4!important;border-color:rgba(74,222,128,.14)!important}
            .lcj2-pill.red{background:rgba(62,15,34,.82)!important;color:#fecdd3!important;border-color:rgba(251,113,133,.14)!important}

            #lcj2-panel-fixed.lcj2-performance-mode{background:#07110b!important}

            /* =========================================================
               V1.4.2 — RED BLACK READABLE UI
               Hanya tampilan panel; workflow OCR tidak berubah.
               ========================================================= */
            #lcj2-panel-fixed{
                background:
                    radial-gradient(circle at 8% 0%,rgba(239,68,68,.18),transparent 28%),
                    radial-gradient(circle at 96% 3%,rgba(127,29,29,.20),transparent 27%),
                    radial-gradient(circle at 50% 108%,rgba(248,113,113,.07),transparent 34%),
                    linear-gradient(180deg,#050505 0%,#0b0505 48%,#030303 100%)!important;
                color:#fff7f7!important;
            }
            #lcj2-panel-fixed:before{
                opacity:.14!important;
                background-image:
                    linear-gradient(rgba(248,113,113,.035) 1px,transparent 1px),
                    linear-gradient(90deg,rgba(248,113,113,.035) 1px,transparent 1px)!important;
            }
            #lcj2-panel-fixed:after{
                opacity:.20!important;
                background:
                    linear-gradient(115deg,transparent 0 43%,rgba(255,255,255,.025) 50%,transparent 57%),
                    radial-gradient(circle at 50% -10%,rgba(239,68,68,.09),transparent 52%)!important;
            }

            #lcj2-panel-fixed .lcj2-nova-topbar{
                background:linear-gradient(145deg,rgba(24,7,7,.97),rgba(8,4,4,.98),rgba(33,8,8,.95))!important;
                border-color:rgba(248,113,113,.18)!important;
                box-shadow:0 20px 52px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.04)!important;
            }
            #lcj2-panel-fixed .lcj2-nova-topbar:before{
                background:linear-gradient(90deg,transparent,#ef4444,#f87171,#b91c1c,transparent)!important;
                box-shadow:0 0 20px rgba(239,68,68,.28)!important;
            }
            #lcj2-panel-fixed .lcj2-nova-topbar:after{
                background:radial-gradient(circle,rgba(239,68,68,.17),transparent 68%)!important;
            }
            #lcj2-panel-fixed .lcj2-nova-logo{
                background:linear-gradient(145deg,#2b0b0b,#100505)!important;
                border-color:rgba(248,113,113,.22)!important;
                box-shadow:0 10px 26px rgba(0,0,0,.34),0 0 22px rgba(239,68,68,.11)!important;
            }
            #lcj2-panel-fixed .lcj2-nova-logo svg{stroke:#f87171!important}
            #lcj2-panel-fixed .lcj2-nova-eyebrow{
                color:#ff9c9c!important;
                opacity:1!important;
                text-shadow:0 0 10px rgba(239,68,68,.24)!important;
            }
            #lcj2-panel-fixed .lcj2-title{
                color:#ffffff!important;
                opacity:1!important;
                text-shadow:0 0 14px rgba(239,68,68,.18)!important;
            }
            #lcj2-panel-fixed .lcj2-subtitle{
                color:#f4c7c7!important;
                opacity:1!important;
                font-weight:750!important;
            }
            #lcj2-panel-fixed .lcj2-version{
                color:#ffe4e6!important;
                background:rgba(239,68,68,.14)!important;
                border-color:rgba(248,113,113,.22)!important;
            }
            #lcj2-panel-fixed .lcj2-nova-live-chip{
                color:#ffe4e6!important;
                background:rgba(185,28,28,.18)!important;
                border-color:rgba(248,113,113,.22)!important;
            }
            #lcj2-panel-fixed .lcj2-nova-close{
                color:#fff1f2!important;
                background:#250909!important;
                border-color:rgba(248,113,113,.22)!important;
            }
            #lcj2-panel-fixed .lcj2-nova-close:hover{background:#3b0c0c!important}

            #lcj2-panel-fixed .lcj2-nova-status,
            #lcj2-panel-fixed .lcj2-card,
            #lcj2-panel-fixed .lcj2-nova-stat,
            #lcj2-panel-fixed .lcj2-nova-guide,
            #lcj2-panel-fixed .lcj2-nova-output-card,
            #lcj2-panel-fixed .lcj2-img-card{
                background:linear-gradient(155deg,rgba(22,7,7,.98),rgba(7,4,4,.99))!important;
                border-color:rgba(248,113,113,.15)!important;
                box-shadow:0 18px 40px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.025)!important;
            }
            #lcj2-panel-fixed .lcj2-nova-status{
                background:
                    radial-gradient(circle at 94% 0%,rgba(239,68,68,.12),transparent 42%),
                    linear-gradient(145deg,rgba(24,7,7,.98),rgba(7,4,4,.99))!important;
                border-color:rgba(248,113,113,.22)!important;
            }
            #lcj2-panel-fixed .lcj2-nova-status-icon{
                background:linear-gradient(145deg,#370d0d,#120505)!important;
                border-color:rgba(248,113,113,.26)!important;
                box-shadow:0 10px 24px rgba(0,0,0,.32),0 0 18px rgba(239,68,68,.10)!important;
            }
            #lcj2-panel-fixed .lcj2-nova-status-icon svg{
                stroke:#ff8a8a!important;
                filter:drop-shadow(0 0 6px rgba(239,68,68,.36))!important;
            }

            /* Perbaikan utama: judul aktivitas harus jelas terlihat. */
            #lcj2-panel-fixed .lcj2-nova-status .lcj2-status-title,
            #lcj2-panel-fixed .lcj2-status-title{
                display:block!important;
                visibility:visible!important;
                opacity:1!important;
                color:#ff8a8a!important;
                font-size:12px!important;
                line-height:1.35!important;
                font-weight:1000!important;
                letter-spacing:1.35px!important;
                text-shadow:0 0 12px rgba(239,68,68,.38)!important;
                margin-bottom:6px!important;
            }
            #lcj2-panel-fixed .lcj2-nova-status .lcj2-ocr-box,
            #lcj2-panel-fixed .lcj2-ocr-box{
                color:#ffffff!important;
                opacity:1!important;
                font-size:14px!important;
                line-height:1.55!important;
                font-weight:750!important;
                text-shadow:0 1px 1px rgba(0,0,0,.55)!important;
            }
            #lcj2-panel-fixed .lcj2-progress{background:#270909!important}
            #lcj2-panel-fixed .lcj2-progress span{
                background:linear-gradient(90deg,#991b1b,#ef4444,#f87171)!important;
                box-shadow:0 0 15px rgba(239,68,68,.58)!important;
            }

            #lcj2-panel-fixed .lcj2-nova-stat-label,
            #lcj2-panel-fixed .lcj2-field-title,
            #lcj2-panel-fixed .lcj2-nova-kicker,
            #lcj2-panel-fixed .lcj2-nova-guide-title{
                color:#ff9c9c!important;
                opacity:1!important;
                font-weight:1000!important;
            }
            #lcj2-panel-fixed .lcj2-nova-stat strong,
            #lcj2-panel-fixed .lcj2-user-edit,
            #lcj2-panel-fixed .lcj2-nova-section-head b,
            #lcj2-panel-fixed .lcj2-nova-guide-row b,
            #lcj2-panel-fixed .lcj2-nova-gallery-head h4,
            #lcj2-panel-fixed .lcj2-output-head h4{
                color:#ffffff!important;
                opacity:1!important;
            }
            #lcj2-panel-fixed .lcj2-nova-stat small,
            #lcj2-panel-fixed .lcj2-nova-section-head small,
            #lcj2-panel-fixed .lcj2-nova-guide-row small,
            #lcj2-panel-fixed .lcj2-nova-gallery-head p,
            #lcj2-panel-fixed .lcj2-output-head p,
            #lcj2-panel-fixed .lcj2-hint,
            #lcj2-panel-fixed .lcj2-img-label{
                color:#e6bcbc!important;
                opacity:1!important;
                font-weight:700!important;
            }
            #lcj2-panel-fixed .lcj2-nova-step,
            #lcj2-panel-fixed .lcj2-nova-guide-row>span{
                color:#ffe4e6!important;
                background:rgba(185,28,28,.22)!important;
                border-color:rgba(248,113,113,.20)!important;
            }

            #lcj2-panel-fixed .lcj2-input,
            #lcj2-panel-fixed #lcj2-output{
                color:#ffffff!important;
                background:linear-gradient(180deg,#080404,#0e0505)!important;
                border-color:rgba(248,113,113,.22)!important;
                caret-color:#f87171!important;
                box-shadow:inset 0 2px 11px rgba(0,0,0,.48)!important;
            }
            #lcj2-panel-fixed .lcj2-input::placeholder{color:#c98f8f!important;opacity:1!important}
            #lcj2-panel-fixed .lcj2-input:focus,
            #lcj2-panel-fixed #lcj2-output:focus{
                border-color:rgba(248,113,113,.55)!important;
                box-shadow:0 0 0 4px rgba(239,68,68,.12),inset 0 2px 10px rgba(0,0,0,.42)!important;
            }

            #lcj2-panel-fixed .lcj2-btn,
            #lcj2-panel-fixed .lcj2-btn.green,
            #lcj2-panel-fixed .lcj2-btn.blue,
            #lcj2-panel-fixed .lcj2-btn.orange,
            #lcj2-panel-fixed .lcj2-bank-refresh{
                color:#ffffff!important;
                background:linear-gradient(180deg,#611313,#310909)!important;
                border-color:rgba(248,113,113,.25)!important;
                box-shadow:0 10px 24px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.06)!important;
            }
            #lcj2-panel-fixed .lcj2-btn:hover{
                background:linear-gradient(180deg,#7f1d1d,#450a0a)!important;
                border-color:rgba(248,113,113,.40)!important;
            }
            #lcj2-panel-fixed .lcj2-btn.primary,
            #lcj2-panel-fixed .lcj2-nova-scan-btn{
                color:#ffffff!important;
                background:linear-gradient(135deg,#7f1d1d 0%,#dc2626 55%,#ef4444 100%)!important;
                border-color:rgba(248,113,113,.38)!important;
                box-shadow:0 16px 36px rgba(185,28,28,.28),inset 0 1px 0 rgba(255,255,255,.16)!important;
            }
            #lcj2-panel-fixed .lcj2-btn.red{
                color:#ffffff!important;
                background:linear-gradient(135deg,#be123c,#7f1d1d)!important;
            }
            #lcj2-panel-fixed .lcj2-inline-copy{
                color:#ffe4e6!important;
                background:rgba(185,28,28,.20)!important;
                border-color:rgba(248,113,113,.22)!important;
            }

            #lcj2-panel-fixed .lcj2-scan-state{
                background:linear-gradient(145deg,#180707,#080404)!important;
                border-color:rgba(248,113,113,.18)!important;
                box-shadow:0 10px 25px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.025)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state-label{
                color:#ff9c9c!important;
                opacity:1!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state-text{
                color:#ffffff!important;
                opacity:1!important;
                font-weight:1000!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state-detail{
                color:#e6bcbc!important;
                opacity:1!important;
                font-weight:700!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state-dot{
                background:#ef4444!important;
                box-shadow:0 0 0 5px rgba(239,68,68,.12),0 0 18px rgba(239,68,68,.70)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.success,
            #lcj2-panel-fixed .lcj2-scan-state.partial,
            #lcj2-panel-fixed .lcj2-scan-state.failed,
            #lcj2-panel-fixed .lcj2-scan-state.scanning,
            #lcj2-panel-fixed .lcj2-scan-state.waiting{
                background:linear-gradient(145deg,#1c0808,#080404)!important;
                border-color:rgba(248,113,113,.20)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.success .lcj2-scan-state-text,
            #lcj2-panel-fixed .lcj2-scan-state.partial .lcj2-scan-state-text,
            #lcj2-panel-fixed .lcj2-scan-state.failed .lcj2-scan-state-text,
            #lcj2-panel-fixed .lcj2-scan-state.scanning .lcj2-scan-state-text,
            #lcj2-panel-fixed .lcj2-scan-state.waiting .lcj2-scan-state-text{
                color:#ffffff!important;
            }

            #lcj2-panel-fixed .lcj2-img-card img,
            #lcj2-panel-fixed .lcj2-img-media{background:#050202!important}
            #lcj2-panel-fixed .lcj2-img-card:hover{
                border-color:rgba(248,113,113,.38)!important;
                box-shadow:0 18px 40px rgba(0,0,0,.40),0 0 0 1px rgba(239,68,68,.08)!important;
            }
            #lcj2-panel-fixed .lcj2-img-card.target{
                border-color:rgba(248,113,113,.50)!important;
                box-shadow:0 0 0 2px rgba(239,68,68,.08),0 18px 40px rgba(0,0,0,.38)!important;
            }
            #lcj2-panel-fixed .lcj2-img-index{
                color:#ffffff!important;
                background:rgba(18,5,5,.96)!important;
                border-color:rgba(248,113,113,.20)!important;
            }
            #lcj2-panel-fixed .lcj2-target-tag{color:#ff9c9c!important}
            #lcj2-panel-fixed .lcj2-ocr-badge{
                color:#ffe4e6!important;
                background:rgba(127,29,29,.30)!important;
                border-color:rgba(248,113,113,.20)!important;
            }
            #lcj2-panel-fixed .lcj2-ocr-badge.success{
                color:#ffffff!important;
                background:rgba(153,27,27,.30)!important;
            }
            #lcj2-panel-fixed .lcj2-ocr-badge.error{
                color:#ffffff!important;
                background:rgba(190,24,93,.25)!important;
            }
            #lcj2-panel-fixed .lcj2-ocr-badge.empty{
                color:#e6bcbc!important;
                background:rgba(39,13,13,.72)!important;
            }
            #lcj2-panel-fixed .lcj2-empty{
                color:#e6bcbc!important;
                background:linear-gradient(145deg,#170707,#080404)!important;
                border-color:rgba(248,113,113,.18)!important;
            }
            #lcj2-panel-fixed .lcj2-empty b{color:#ffffff!important}
            #lcj2-panel-fixed .lcj2-nova-empty-icon{color:#f87171!important}

            #lcj2-panel-fixed .lcj2-pill,
            #lcj2-panel-fixed .lcj2-pill.blue,
            #lcj2-panel-fixed .lcj2-pill.green,
            #lcj2-panel-fixed .lcj2-pill.red{
                color:#fff1f2!important;
                background:rgba(41,10,10,.90)!important;
                border-color:rgba(248,113,113,.18)!important;
            }
            #lcj2-panel-fixed.lcj2-performance-mode{background:#070303!important}

            /* =========================================================
               V1.4.3 — STATUS TERANG DAN MUDAH DIBEDAKAN
               ========================================================= */

            /* Tulisan umum status dibuat lebih jelas. */
            #lcj2-panel-fixed .lcj2-scan-state{
                min-height:64px!important;
                border-width:2px!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state-label{
                font-size:10px!important;
                line-height:1.25!important;
                font-weight:1000!important;
                letter-spacing:1.25px!important;
                opacity:1!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state-text{
                font-size:14px!important;
                line-height:1.3!important;
                font-weight:1000!important;
                letter-spacing:.25px!important;
                opacity:1!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state-detail{
                margin-top:4px!important;
                font-size:11px!important;
                line-height:1.4!important;
                font-weight:850!important;
                opacity:1!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state-dot{
                width:14px!important;
                height:14px!important;
                border:2px solid rgba(255,255,255,.88)!important;
            }

            /* Menunggu: netral terang. */
            #lcj2-panel-fixed .lcj2-scan-state.waiting{
                background:linear-gradient(145deg,#191919,#070707)!important;
                border-color:rgba(226,232,240,.28)!important;
                box-shadow:0 13px 30px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.04)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.waiting .lcj2-scan-state-dot{
                background:#cbd5e1!important;
                box-shadow:0 0 0 5px rgba(203,213,225,.12),0 0 18px rgba(203,213,225,.44)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.waiting .lcj2-scan-state-label{color:#cbd5e1!important}
            #lcj2-panel-fixed .lcj2-scan-state.waiting .lcj2-scan-state-text{color:#ffffff!important}
            #lcj2-panel-fixed .lcj2-scan-state.waiting .lcj2-scan-state-detail{color:#d1d5db!important}

            /* Sedang mencari / scanning: oranye terang. */
            #lcj2-panel-fixed .lcj2-scan-state.scanning{
                background:linear-gradient(145deg,#3a2003,#110900)!important;
                border-color:#f59e0b!important;
                box-shadow:
                    0 13px 30px rgba(0,0,0,.38),
                    0 0 0 1px rgba(245,158,11,.18),
                    0 0 28px rgba(245,158,11,.18),
                    inset 0 1px 0 rgba(255,255,255,.05)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.scanning .lcj2-scan-state-dot{
                background:#fbbf24!important;
                box-shadow:0 0 0 6px rgba(251,191,36,.15),0 0 22px rgba(251,191,36,.92)!important;
                animation:lcj2BrightStatusBlink .9s ease-in-out infinite!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.scanning .lcj2-scan-state-label{color:#fde68a!important}
            #lcj2-panel-fixed .lcj2-scan-state.scanning .lcj2-scan-state-text{
                color:#fff7d6!important;
                text-shadow:0 0 10px rgba(251,191,36,.35)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.scanning .lcj2-scan-state-detail{color:#fef3c7!important}

            /* SCAN CODE selesai: success maupun partial dibuat hijau terang. */
            #lcj2-panel-fixed .lcj2-scan-state.success:not(.lcj2-bank-lookup-state),
            #lcj2-panel-fixed .lcj2-scan-state.partial:not(.lcj2-bank-lookup-state){
                background:
                    radial-gradient(circle at 94% 0%,rgba(134,239,172,.18),transparent 38%),
                    linear-gradient(145deg,#063d20,#02170c)!important;
                border-color:#22c55e!important;
                box-shadow:
                    0 14px 32px rgba(0,0,0,.40),
                    0 0 0 1px rgba(74,222,128,.22),
                    0 0 34px rgba(34,197,94,.28),
                    inset 0 1px 0 rgba(255,255,255,.07)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.success:not(.lcj2-bank-lookup-state) .lcj2-scan-state-dot,
            #lcj2-panel-fixed .lcj2-scan-state.partial:not(.lcj2-bank-lookup-state) .lcj2-scan-state-dot{
                background:#4ade80!important;
                box-shadow:
                    0 0 0 6px rgba(74,222,128,.18),
                    0 0 24px rgba(74,222,128,1)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.success:not(.lcj2-bank-lookup-state) .lcj2-scan-state-label,
            #lcj2-panel-fixed .lcj2-scan-state.partial:not(.lcj2-bank-lookup-state) .lcj2-scan-state-label{
                color:#bbf7d0!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.success:not(.lcj2-bank-lookup-state) .lcj2-scan-state-text,
            #lcj2-panel-fixed .lcj2-scan-state.partial:not(.lcj2-bank-lookup-state) .lcj2-scan-state-text{
                color:#ffffff!important;
                font-size:15px!important;
                text-shadow:0 0 12px rgba(74,222,128,.50)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.success:not(.lcj2-bank-lookup-state) .lcj2-scan-state-detail,
            #lcj2-panel-fixed .lcj2-scan-state.partial:not(.lcj2-bank-lookup-state) .lcj2-scan-state-detail{
                color:#dcfce7!important;
            }

            /* Scan gagal: merah terang. */
            #lcj2-panel-fixed .lcj2-scan-state.failed:not(.lcj2-bank-lookup-state){
                background:
                    radial-gradient(circle at 94% 0%,rgba(254,202,202,.13),transparent 38%),
                    linear-gradient(145deg,#500b13,#1b0307)!important;
                border-color:#ef4444!important;
                box-shadow:
                    0 14px 32px rgba(0,0,0,.40),
                    0 0 0 1px rgba(248,113,113,.22),
                    0 0 34px rgba(239,68,68,.26),
                    inset 0 1px 0 rgba(255,255,255,.06)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.failed:not(.lcj2-bank-lookup-state) .lcj2-scan-state-dot{
                background:#fb7185!important;
                box-shadow:0 0 0 6px rgba(251,113,133,.18),0 0 24px rgba(251,113,133,.95)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.failed:not(.lcj2-bank-lookup-state) .lcj2-scan-state-label{color:#fecdd3!important}
            #lcj2-panel-fixed .lcj2-scan-state.failed:not(.lcj2-bank-lookup-state) .lcj2-scan-state-text{
                color:#ffffff!important;
                text-shadow:0 0 12px rgba(251,113,133,.42)!important;
            }
            #lcj2-panel-fixed .lcj2-scan-state.failed:not(.lcj2-bank-lookup-state) .lcj2-scan-state-detail{color:#ffe4e6!important}

            /* DATA REKENING ditemukan: hijau neon terang. */
            #lcj2-panel-fixed .lcj2-bank-lookup-state.success{
                background:
                    radial-gradient(circle at 94% 0%,rgba(187,247,208,.22),transparent 40%),
                    linear-gradient(145deg,#07592d,#022512)!important;
                border-color:#4ade80!important;
                box-shadow:
                    0 15px 34px rgba(0,0,0,.42),
                    0 0 0 2px rgba(74,222,128,.18),
                    0 0 40px rgba(34,197,94,.34),
                    inset 0 1px 0 rgba(255,255,255,.08)!important;
            }
            #lcj2-panel-fixed .lcj2-bank-lookup-state.success .lcj2-scan-state-dot{
                background:#86efac!important;
                box-shadow:
                    0 0 0 6px rgba(134,239,172,.20),
                    0 0 26px rgba(134,239,172,1)!important;
            }
            #lcj2-panel-fixed .lcj2-bank-lookup-state.success .lcj2-scan-state-label{
                color:#d1fae5!important;
            }
            #lcj2-panel-fixed .lcj2-bank-lookup-state.success .lcj2-scan-state-text{
                color:#ffffff!important;
                font-size:15px!important;
                text-shadow:0 0 13px rgba(134,239,172,.58)!important;
            }
            #lcj2-panel-fixed .lcj2-bank-lookup-state.success .lcj2-scan-state-detail{
                color:#dcfce7!important;
                font-size:12px!important;
            }

            /* DATA REKENING tidak ditemukan atau gagal: merah neon terang. */
            #lcj2-panel-fixed .lcj2-bank-lookup-state.partial,
            #lcj2-panel-fixed .lcj2-bank-lookup-state.failed{
                background:
                    radial-gradient(circle at 94% 0%,rgba(254,202,202,.16),transparent 40%),
                    linear-gradient(145deg,#650d18,#210307)!important;
                border-color:#f43f5e!important;
                box-shadow:
                    0 15px 34px rgba(0,0,0,.42),
                    0 0 0 2px rgba(244,63,94,.18),
                    0 0 40px rgba(244,63,94,.30),
                    inset 0 1px 0 rgba(255,255,255,.07)!important;
            }
            #lcj2-panel-fixed .lcj2-bank-lookup-state.partial .lcj2-scan-state-dot,
            #lcj2-panel-fixed .lcj2-bank-lookup-state.failed .lcj2-scan-state-dot{
                background:#fb7185!important;
                box-shadow:
                    0 0 0 6px rgba(251,113,133,.20),
                    0 0 26px rgba(251,113,133,1)!important;
            }
            #lcj2-panel-fixed .lcj2-bank-lookup-state.partial .lcj2-scan-state-label,
            #lcj2-panel-fixed .lcj2-bank-lookup-state.failed .lcj2-scan-state-label{
                color:#fecdd3!important;
            }
            #lcj2-panel-fixed .lcj2-bank-lookup-state.partial .lcj2-scan-state-text,
            #lcj2-panel-fixed .lcj2-bank-lookup-state.failed .lcj2-scan-state-text{
                color:#ffffff!important;
                font-size:15px!important;
                text-shadow:0 0 13px rgba(251,113,133,.55)!important;
            }
            #lcj2-panel-fixed .lcj2-bank-lookup-state.partial .lcj2-scan-state-detail,
            #lcj2-panel-fixed .lcj2-bank-lookup-state.failed .lcj2-scan-state-detail{
                color:#ffe4e6!important;
                font-size:12px!important;
            }

            @keyframes lcj2BrightStatusBlink{
                0%,100%{opacity:.55;transform:scale(.90)}
                50%{opacity:1;transform:scale(1.10)}
            }

            /* V1.4.4 — DRAG TURBO: matikan seluruh efek berat selama pemindahan. */
            #lcj2-panel-fixed.lcj2-reorder-mode,
            #lcj2-panel-fixed.lcj2-reorder-mode:before,
            #lcj2-panel-fixed.lcj2-reorder-mode:after{
                backdrop-filter:none!important;
            }
            #lcj2-panel-fixed.lcj2-reorder-mode #lcj2-image-grid{
                contain:layout paint!important;
                isolation:isolate!important;
            }
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card,
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card:hover,
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card.target,
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card.over{
                animation:none!important;
                transition:none!important;
                transform:none!important;
                filter:none!important;
                backdrop-filter:none!important;
                box-shadow:none!important;
                text-shadow:none!important;
            }
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card img{
                animation:none!important;
                transition:none!important;
                transform:none!important;
                filter:none!important;
            }
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-label,
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-ocr-badge,
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-del{
                visibility:hidden!important;
            }
            #lcj2-panel-fixed.lcj2-reorder-mode .lcj2-img-card.over{
                border:2px solid #4ade80!important;
                background:#07170d!important;
                outline:3px solid rgba(74,222,128,.16)!important;
            }

        `;
        document.head.appendChild(style);
    }

    const LCJ2_ACCESS_START_MINUTES = 23 * 60 + 50;
    const LCJ2_ACCESS_END_MINUTES = 2 * 60;
    let lcj2DailyLampTimer = null;
    let lcj2LampMessageTimer = null;
    let lcj2LastAccessActive = null;

    function lcj2GetDailyAccessState() {
        let now;
        try {
            now = lcj2GetWibParts(lcj2NowDate());
        } catch (e) {
            const values = {};
            new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Jakarta',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hourCycle: 'h23'
            }).formatToParts(new Date()).forEach((part) => {
                if (part.type !== 'literal') values[part.type] = Number(part.value);
            });
            now = {
                year: values.year,
                month: values.month,
                day: values.day,
                hour: values.hour,
                minute: values.minute,
                second: values.second,
                minutesOfDay: values.hour * 60 + values.minute
            };
        }

        const active = now.minutesOfDay >= LCJ2_ACCESS_START_MINUTES ||
            now.minutesOfDay < LCJ2_ACCESS_END_MINUTES;

        return {
            active,
            now,
            clockText: String(now.hour).padStart(2, '0') + ':' +
                String(now.minute).padStart(2, '0') + ':' +
                String(now.second).padStart(2, '0')
        };
    }

    function lcj2ShowLampMessage(message, duration) {
        const bubble = document.getElementById('lcj2-bubble-fixed');
        if (!bubble) return;
        const messageEl = bubble.querySelector('.lcj2-lamp-message');
        if (messageEl) messageEl.textContent = message || 'KEMBALI LAGI BESOK';
        bubble.classList.add('lcj2-show-message');
        if (lcj2LampMessageTimer) clearTimeout(lcj2LampMessageTimer);
        lcj2LampMessageTimer = setTimeout(() => {
            const current = document.getElementById('lcj2-bubble-fixed');
            if (current) current.classList.remove('lcj2-show-message');
        }, Number(duration) || 2600);
    }

    function lcj2RefreshDailyLamp() {
        const bubble = document.getElementById('lcj2-bubble-fixed');
        if (!bubble) return;

        const state = lcj2GetDailyAccessState();
        const caption = bubble.querySelector('.lcj2-lamp-caption');
        const message = bubble.querySelector('.lcj2-lamp-message');

        bubble.classList.toggle('lcj2-access-active', state.active);
        bubble.classList.toggle('lcj2-access-inactive', !state.active);
        bubble.disabled = false;
        bubble.setAttribute('aria-disabled', state.active ? 'false' : 'true');
        bubble.title = state.active
            ? 'OCR AKTIF • Klik untuk membuka • WIB ' + state.clockText
            : 'OCR MATI • Kembali lagi besok • Aktif pukul 23.50 WIB';

        if (caption) caption.textContent = state.active ? 'LAMPU HIDUP' : 'LAMPU MATI';
        if (message) {
            message.textContent = state.active
                ? 'OCR AKTIF • 23.50–02.00 WIB'
                : 'KEMBALI LAGI BESOK';
        }

        if (lcj2LastAccessActive === true && !state.active) {
            const closeButton = document.querySelector('#lcj2-panel-fixed #lcj2-close');
            if (closeButton) closeButton.click();
            lcj2ShowLampMessage('WAKTU HABIS • KEMBALI LAGI BESOK', 4200);
        }

        lcj2LastAccessActive = state.active;
    }

    function lcj2EnsureDailyLampTimer() {
        if (lcj2DailyLampTimer) return;
        lcj2DailyLampTimer = setInterval(lcj2RefreshDailyLamp, 1000);
    }

    function createBubble() {
        if (document.getElementById('lcj2-bubble-fixed')) return;
        injectStyle();

        const bubble = document.createElement('button');
        bubble.id = 'lcj2-bubble-fixed';
        bubble.type = 'button';
        bubble.title = 'Buka OCR Claim Jam 2 WIB';
        bubble.setAttribute('aria-label', 'Buka OCR Claim Jam 2 WIB');
        bubble.innerHTML = `
            <span class="lcj2-lamp-face" aria-hidden="true">
                <strong class="lcj2-lamp-number">02</strong>
                <small class="lcj2-lamp-unit">WIB</small>
            </span>
            <span class="lcj2-lamp-led" aria-hidden="true"></span>
            <span class="lcj2-lamp-caption">MEMERIKSA</span>
            <span class="lcj2-lamp-message" role="status" aria-live="polite">KEMBALI LAGI BESOK</span>
        `;
        document.body.appendChild(bubble);
        lcj2RefreshDailyLamp();
        lcj2EnsureDailyLampTimer();

        const saved = safeJSONParse(localStorage.getItem(POS_KEY), null);
        if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
            bubble.style.left = Math.max(6, Math.min(innerWidth - 84, saved.left)) + 'px';
            bubble.style.top = Math.max(6, Math.min(innerHeight - 84, saved.top)) + 'px';
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
            bubble.classList.add('lcj2-dragging');
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
            bubble.classList.remove('lcj2-dragging');
            const rect = bubble.getBoundingClientRect();
            localStorage.setItem(POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
            try { bubble.releasePointerCapture(e.pointerId); } catch (err) {}
            if (!moved) {
                const access = lcj2GetDailyAccessState();
                if (access.active) {
                    openTool();
                } else {
                    lcj2RefreshDailyLamp();
                    lcj2ShowLampMessage('KEMBALI LAGI BESOK', 3200);
                }
            }
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
            if (el.closest && el.closest('#lcj2-panel-fixed')) continue;
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
            return cleaned;
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
            return !!(el && el.closest && el.closest('#lcj2-panel-fixed'));
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
        if (el.id === 'lcj2-panel-fixed' || el.id === 'lcj2-bubble-fixed') return;
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
        collectImagesFromRoot(root, mk, relaxedImages, { ignoreMarker: true });
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
            collectImagesFromRoot(root, mk, relaxedImages, { ignoreMarker: true });
        };

        // Amankan gambar yang sedang tampak sebelum posisi scroll diubah.
        collectCurrent();

        try {
            if (canScroll) {
                root.scrollTop = 0;
                await waitForChatPaint(4);
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
                    await waitForChatPaint(2);
                }

                root.scrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
                await waitForChatPaint(4);
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

    async function scanPageDeep(onProgress) {
        const active = findActiveScope();
        if (!active.scope) {
            lastScan = {
                userId: 'user', allIds: [], marker: null,
                markerText: 'Chat aktif tidak terdeteksi', images: [], scopeReason: active.reason
            };
            return lastScan;
        }

        let result = await scanOneScopeDeep(active, onProgress, 'Memindai chat aktif');

        // Fallback hanya dijalankan ketika scope utama benar-benar menghasilkan 0 gambar.
        if (!result.images.length) {
            const alternative = findAlternativeActiveScope(active.scope);
            if (alternative) {
                if (onProgress) onProgress('Scope pertama kosong. Memeriksa area percakapan aktif yang cocok...');
                const altResult = await scanOneScopeDeep(alternative, onProgress, 'Memindai area percakapan');
                if (altResult.images.length) result = altResult;
            }
        }

        lastScan = {
            userId: result.userId,
            allIds: result.allIds,
            marker: result.marker,
            markerText: result.markerText,
            images: result.images,
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

    const LCJ2_ADMIN_PLAYER_URL = 'https://agwl2.admitoto.com/agentplayerlist.php';
    const LCJ2_ADMIN_TIMEOUT = 20000;
    const lcj2BankMemoryCache = new Map();

    function lcj2ValidLookupUserId(value) {
        const userId = String(value || '').trim();
        if (!userId || /^(user|unknown|null|undefined)$/i.test(userId)) return '';
        return userId;
    }

    // Cocokkan User ID secara utuh. Ini mencegah ID pendek seperti "wakjp"
    // mengambil baris milik ID lain yang hanya mengandung teks yang sama.
    function lcj2HasExactLookupUserId(value, userId) {
        const uid = lcj2ValidLookupUserId(userId);
        const text = String(value == null ? '' : value);
        if (!uid || !text) return false;
        const escaped = uid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp('(?:^|[^A-Za-z0-9_.-])' + escaped + '(?=$|[^A-Za-z0-9_.-])', 'i').test(text);
    }

    function lcj2RowHasExactLookupUserId(row, userId) {
        const uid = lcj2ValidLookupUserId(userId);
        if (!row || !uid) return false;

        const cells = Array.from(row.querySelectorAll('th,td'));
        if (!cells.length) return false;

        const table = row.closest('table');
        let headers = [];
        if (table) {
            const headerRow = table.querySelector('thead tr') || Array.from(table.querySelectorAll('tr')).find(tr => tr.querySelector('th'));
            if (headerRow) headers = Array.from(headerRow.querySelectorAll('th,td')).map(cell => lcj2NormalizeBankText(cell.innerText || cell.textContent));
        }

        const userIndex = lcj2HeaderIndex(headers, /^(?:user\s*id|userid|user\s*name|username|player\s*(?:id|name)|member\s*(?:id|name))$/i);
        if (userIndex >= 0 && cells[userIndex]) {
            return lcj2HasExactLookupUserId(cells[userIndex].innerText || cells[userIndex].textContent, uid);
        }

        // Fallback hanya menerima satu sel yang memuat User ID sebagai token utuh,
        // bukan kecocokan sebagian dari seluruh teks baris.
        return cells.some(cell => lcj2HasExactLookupUserId(cell.innerText || cell.textContent, uid));
    }

    function lcj2RowHasDifferentLookupUserId(row, userId) {
        const uid = lcj2ValidLookupUserId(userId);
        if (!row || !uid) return false;

        const cells = Array.from(row.querySelectorAll('th,td'));
        const table = row.closest('table');
        if (!cells.length || !table) return false;

        const headerRow = table.querySelector('thead tr') || Array.from(table.querySelectorAll('tr')).find(tr => tr.querySelector('th'));
        if (!headerRow) return false;

        const headers = Array.from(headerRow.querySelectorAll('th,td')).map(cell => lcj2NormalizeBankText(cell.innerText || cell.textContent));
        const userIndex = lcj2HeaderIndex(headers, /^(?:user\s*id|userid|user\s*name|username|player\s*(?:id|name)|member\s*(?:id|name))$/i);
        if (userIndex < 0 || !cells[userIndex]) return false;

        const foundUserId = lcj2NormalizeBankText(cells[userIndex].innerText || cells[userIndex].textContent);
        return !!foundUserId && !lcj2HasExactLookupUserId(foundUserId, uid);
    }

    function lcj2NormalizeBankText(value) {
        return String(value == null ? '' : value)
            .replace(/&nbsp;/gi, ' ')
            .replace(/\u00a0/g, ' ')
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    const LCJ2_BANK_NAME_ALIASES = [
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

    function lcj2NormalizeBankAlias(value) {
        return lcj2NormalizeBankText(value)
            .toUpperCase()
            .replace(/[().]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function lcj2IsBankNameOnly(value) {
        const normalized = lcj2NormalizeBankAlias(value)
            .replace(/^PT\s+/i, '')
            .replace(/\s+(?:SYARIAH|DIGITAL)$/i, '')
            .trim();
        if (!normalized) return false;
        if (LCJ2_BANK_NAME_ALIASES.includes(normalized)) return true;
        if (/^BANK\s+[A-Z0-9 .&-]{2,40}$/.test(normalized)) return true;
        return false;
    }

    function lcj2StripLeadingBankName(value) {
        let result = lcj2NormalizeBankText(value);
        if (!result) return '';

        result = result
            .replace(/^(?:nama\s*(?:bank|rekening|pemilik)?|account\s*name)\s*[:\-]?\s*/i, '')
            .replace(/^[,;|:\-\s]+|[,;|:\-\s]+$/g, '')
            .trim();

        // Jika data berbentuk BANK,NAMA atau BANK|NAMA, buang bagian bank.
        let parts = result.split(/\s*[,;|]\s*/).filter(Boolean);
        while (parts.length > 1 && lcj2IsBankNameOnly(parts[0])) parts.shift();
        result = parts.join(', ').trim();

        // Jika data berbentuk "BCA SUHARTO" atau "BANK BCA - SUHARTO",
        // buang nama bank yang berada di depan nama pemilik rekening.
        for (let pass = 0; pass < 2; pass++) {
            let changed = false;
            const normalized = lcj2NormalizeBankAlias(result).replace(/^PT\s+/i, '');
            for (const alias of LCJ2_BANK_NAME_ALIASES) {
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

    function lcj2CleanAccountName(value) {
        const cleaned = lcj2StripLeadingBankName(value);
        if (!cleaned || lcj2IsBankNameOnly(cleaned)) return '';
        return cleaned;
    }

    function lcj2CleanAccountNumber(value) {
        const digits = String(value == null ? '' : value).replace(/\D/g, '');
        return digits.length >= 6 && digits.length <= 30 ? digits : '';
    }

    function lcj2BankPair(nama, rek, raw) {
        nama = lcj2CleanAccountName(nama);
        rek = lcj2CleanAccountNumber(rek);
        if (!nama || !rek) return null;
        if (/^(bank|rekening|account|nama|nomor|no)$/i.test(nama)) return null;
        return { nama, rek, raw: lcj2NormalizeBankText(raw || (nama + ',' + rek)) };
    }

    function lcj2ParseBankValue(value, userId) {
        const raw = lcj2NormalizeBankText(value);
        if (!raw) return null;

        const labeled = raw.match(/(?:nama(?:\s+(?:bank|rekening|pemilik))?|account\s*name)\s*[:\-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .'/&-]{1,80}?)\s+(?:no(?:mor)?\s*(?:rekening|rek)|rekening|account\s*(?:no|number)?)\s*[:\-]\s*([0-9][0-9 .-]{5,29})/i);
        if (labeled) {
            const pair = lcj2BankPair(labeled[1], labeled[2], raw);
            if (pair) return pair;
        }

        // Format yang paling umum: BANK,NAMA PEMILIK,NOMOR atau
        // NAMA PEMILIK,NOMOR. Ambil teks tepat sebelum nomor agar nama
        // bank tidak pernah ikut masuk ke Data Rekening.
        const pieces = raw.split(/\s*[,;|]\s*/).filter(Boolean);
        for (let i = 0; i < pieces.length; i++) {
            const rek = lcj2CleanAccountNumber(pieces[i]);
            if (!rek || i === 0) continue;
            for (let j = i - 1; j >= 0; j--) {
                const candidate = lcj2CleanAccountName(pieces[j]);
                if (!candidate || lcj2IsBankNameOnly(candidate)) continue;
                if (lcj2ValidLookupUserId(userId).toLowerCase() === candidate.toLowerCase()) continue;
                const pair = lcj2BankPair(candidate, rek, raw);
                if (pair) return pair;
            }
        }

        const nameFirst = raw.match(/(?:^|\bBANK\s*[:\-]?\s*)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .'/&-]{1,80}?)\s*[,|;]\s*([0-9][0-9 .-]{5,29})(?:\b|$)/i);
        if (nameFirst) {
            const pair = lcj2BankPair(nameFirst[1], nameFirst[2], raw);
            if (pair) return pair;
        }

        const numberFirst = raw.match(/(?:^|\s)([0-9][0-9 .-]{5,29})\s*[,|;]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .'/&-]{1,80})(?:$|\s)/i);
        if (numberFirst) {
            const pair = lcj2BankPair(numberFirst[2], numberFirst[1], raw);
            if (pair) return pair;
        }

        // Fallback untuk nilai yang dipisah baris/spasi.
        const numberMatch = raw.match(/(?:^|\D)([0-9][0-9 .-]{5,29})(?:\D|$)/);
        if (numberMatch) {
            const rek = lcj2CleanAccountNumber(numberMatch[1]);
            const before = raw.slice(0, numberMatch.index).replace(/(?:rekening|account|no(?:mor)?|rek)\s*[:\-]?/gi, ' ');
            const after = raw.slice((numberMatch.index || 0) + numberMatch[0].length);
            const beforeParts = before.split(/\s*[,;|]\s*/).map(lcj2CleanAccountName).filter(Boolean).reverse();
            const afterParts = after.split(/\s*[,;|]\s*/).map(lcj2CleanAccountName).filter(Boolean);
            const uid = lcj2ValidLookupUserId(userId).toLowerCase();
            const candidates = beforeParts.concat(afterParts).filter(v => {
                if (!v || lcj2IsBankNameOnly(v)) return false;
                if (uid && (v.toLowerCase() === uid || uid.includes(v.toLowerCase()))) return false;
                return v.length >= 2;
            });
            if (candidates.length) {
                const pair = lcj2BankPair(candidates[0], rek, raw);
                if (pair) return pair;
            }
        }
        return null;
    }

    function lcj2CreateLookupError(code, message) {
        const err = new Error(message);
        err.code = code;
        return err;
    }

    function lcj2RequestAdminText(method, url, data) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'function') {
                reject(lcj2CreateLookupError('REQUEST_UNAVAILABLE', 'GM_xmlhttpRequest tidak tersedia.'));
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
                timeout: LCJ2_ADMIN_TIMEOUT,
                onload: (res) => {
                    const status = Number(res.status) || 0;
                    if (status >= 200 && status < 400) {
                        resolve({
                            text: String(res.responseText || res.response || ''),
                            finalUrl: String(res.finalUrl || url),
                            status
                        });
                    } else {
                        reject(lcj2CreateLookupError('HTTP_ERROR', 'Admin membalas HTTP ' + status + '.'));
                    }
                },
                onerror: () => reject(lcj2CreateLookupError('NETWORK_ERROR', 'Halaman admin tidak dapat dihubungi.')),
                ontimeout: () => reject(lcj2CreateLookupError('TIMEOUT', 'Waktu pengambilan data admin habis.'))
            });
        });
    }

    function lcj2IsAdminLoginDocument(doc) {
        if (!doc) return false;
        const bodyText = lcj2NormalizeBankText(doc.body ? doc.body.innerText || doc.body.textContent : '').toLowerCase();
        return !!doc.querySelector('input[type="password"]') && /username/.test(bodyText) && /password/.test(bodyText);
    }

    function lcj2HeaderIndex(headers, pattern) {
        for (let i = 0; i < headers.length; i++) {
            if (pattern.test(headers[i])) return i;
        }
        return -1;
    }

    function lcj2ExtractBankFromRow(row, userId, allowWithoutUser) {
        const rowText = lcj2NormalizeBankText(row && (row.innerText || row.textContent));
        if (!rowText) return null;
        const uid = lcj2ValidLookupUserId(userId);
        if (!allowWithoutUser && uid && !lcj2RowHasExactLookupUserId(row, uid)) return null;

        const cells = Array.from(row.querySelectorAll('th,td')).map(cell => lcj2NormalizeBankText(cell.innerText || cell.textContent));
        if (!cells.length) return null;
        const table = row.closest('table');
        let headers = [];
        if (table) {
            const headerRow = table.querySelector('thead tr') || Array.from(table.querySelectorAll('tr')).find(tr => tr.querySelector('th'));
            if (headerRow) headers = Array.from(headerRow.querySelectorAll('th,td')).map(cell => lcj2NormalizeBankText(cell.innerText || cell.textContent));
        }

        const bankIndex = lcj2HeaderIndex(headers, /^(?:bank|data\s*bank|bank\s*account|rekening|account)$/i);
        if (bankIndex >= 0 && cells[bankIndex]) {
            const pair = lcj2ParseBankValue(cells[bankIndex], uid);
            if (pair) return pair;
        }

        const accountIndex = lcj2HeaderIndex(headers, /(?:no(?:mor)?\s*(?:rekening|rek)|rekening|account\s*(?:no|number)?|bank\s*account)/i);
        const nameIndex = lcj2HeaderIndex(headers, /(?:nama\s*(?:rekening|bank|pemilik)|account\s*name|holder\s*name)/i);
        if (accountIndex >= 0 && nameIndex >= 0 && cells[accountIndex] && cells[nameIndex]) {
            const pair = lcj2BankPair(cells[nameIndex], cells[accountIndex], rowText);
            if (pair) return pair;
        }

        for (const cell of cells) {
            const pair = lcj2ParseBankValue(cell, uid);
            if (pair) return pair;
        }
        return lcj2ParseBankValue(rowText, uid);
    }

    function lcj2ExtractBankFromJson(value, userId) {
        const uid = lcj2ValidLookupUserId(userId).toLowerCase();
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
            const matchesUser = !uid || lcj2HasExactLookupUserId(serialized, uid);
            if (matchesUser) {
                for (const [key, val] of entries) {
                    if (/bank|rekening|account|rek/i.test(key) && typeof val !== 'object') {
                        const pair = lcj2ParseBankValue(val, uid);
                        if (pair) return pair;
                    }
                }

                const accountEntry = entries.find(([key, val]) => typeof val !== 'object' && /(?:rekening|account_?no|accountnumber|bank_?no|bankaccount|no_?rek|rek$)/i.test(key));
                const nameEntry = entries.find(([key, val]) => typeof val !== 'object' && /(?:nama_?(?:rekening|bank|pemilik)|account_?name|holder_?name|fullname|name$)/i.test(key));
                if (accountEntry && nameEntry) {
                    const pair = lcj2BankPair(nameEntry[1], accountEntry[1], serialized);
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

    function lcj2ExtractBankResult(raw, userId) {
        const text = String(raw || '').trim();
        if (!text) return { result: null, loginRequired: false, document: null };

        if (/^[\[{]/.test(text)) {
            try {
                const json = JSON.parse(text);
                const result = lcj2ExtractBankFromJson(json, userId);
                if (result) return { result, loginRequired: false, document: null };
            } catch (e) {}
        }

        const doc = new DOMParser().parseFromString(text, 'text/html');
        const loginRequired = lcj2IsAdminLoginDocument(doc);
        if (loginRequired) return { result: null, loginRequired: true, document: doc };

        const uid = lcj2ValidLookupUserId(userId);
        const rows = Array.from(doc.querySelectorAll('tr'));
        for (const row of rows) {
            if (uid && lcj2RowHasExactLookupUserId(row, uid)) {
                const result = lcj2ExtractBankFromRow(row, uid, false);
                if (result) return { result, loginRequired: false, document: doc };
            }
        }

        // Jika server sudah memfilter ke satu pemain, izinkan satu baris data
        // walau User ID tidak lagi dicetak pada hasil respons.
        const dataRows = rows.filter(row => row.querySelectorAll('td').length > 0);
        if (dataRows.length === 1 && !lcj2RowHasDifferentLookupUserId(dataRows[0], uid)) {
            const result = lcj2ExtractBankFromRow(dataRows[0], uid, true);
            if (result) return { result, loginRequired: false, document: doc };
        }

        const scripts = Array.from(doc.querySelectorAll('script[type="application/json"]'));
        for (const script of scripts) {
            try {
                const result = lcj2ExtractBankFromJson(JSON.parse(script.textContent || ''), uid);
                if (result) return { result, loginRequired: false, document: doc };
            } catch (e) {}
        }

        const bodyText = lcj2NormalizeBankText(doc.body ? doc.body.innerText || doc.body.textContent : '');
        if (uid) {
            const escapedUid = uid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const exactMatch = new RegExp('(?:^|[^A-Za-z0-9_.-])' + escapedUid + '(?=$|[^A-Za-z0-9_.-])', 'i').exec(bodyText);
            if (exactMatch) {
                const tokenOffset = exactMatch[0].toLowerCase().indexOf(uid.toLowerCase());
                const index = exactMatch.index + Math.max(0, tokenOffset);
                const nearby = bodyText.slice(Math.max(0, index - 250), Math.min(bodyText.length, index + uid.length + 500));
                const result = lcj2ParseBankValue(nearby, uid);
                if (result) return { result, loginRequired: false, document: doc };
            }
        }
        return { result: null, loginRequired: false, document: doc };
    }

    function lcj2BuildCommonAdminParams(userId) {
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

    function lcj2DiscoverAdminRequests(doc, baseUrl, userId) {
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
                add('POST', match[1], lcj2BuildCommonAdminParams(userId).toString());
            }
        }
        return out;
    }

    async function lcj2LookupBankFromAdmin(userId, forceRefresh) {
        const uid = lcj2ValidLookupUserId(userId);
        if (!uid) throw lcj2CreateLookupError('NO_USER_ID', 'User ID chat belum terdeteksi.');

        const cacheKey = uid.toLowerCase();
        const cached = lcj2BankMemoryCache.get(cacheKey);
        if (!forceRefresh && cached && Date.now() - cached.time < 5 * 60 * 1000) return cached.value;

        const common = lcj2BuildCommonAdminParams(uid);
        const queue = [
            { method: 'POST', url: LCJ2_ADMIN_PLAYER_URL, data: common.toString() },
            { method: 'GET', url: LCJ2_ADMIN_PLAYER_URL + '?' + new URLSearchParams({ username: uid, search: uid }).toString(), data: '' },
            { method: 'GET', url: LCJ2_ADMIN_PLAYER_URL, data: '' }
        ];
        const seen = new Set();
        let lastError = null;
        let attempts = 0;

        while (queue.length && attempts < 10) {
            const req = queue.shift();
            const key = req.method + '|' + req.url + '|' + req.data;
            if (seen.has(key)) continue;
            seen.add(key);
            attempts++;

            try {
                const response = await lcj2RequestAdminText(req.method, req.url, req.data);
                const parsed = lcj2ExtractBankResult(response.text, uid);
                if (parsed.loginRequired) {
                    throw lcj2CreateLookupError('ADMIN_LOGIN_REQUIRED', 'Sesi login admin belum aktif.');
                }
                if (parsed.result) {
                    const value = { ...parsed.result, userId: uid, source: response.finalUrl || req.url };
                    lcj2BankMemoryCache.set(cacheKey, { time: Date.now(), value });
                    return value;
                }

                const discovered = lcj2DiscoverAdminRequests(parsed.document, response.finalUrl || req.url, uid);
                discovered.forEach(item => queue.push(item));
            } catch (err) {
                if (err && err.code === 'ADMIN_LOGIN_REQUIRED') throw err;
                lastError = err;
            }
        }

        if (lastError && attempts <= 1) throw lastError;
        throw lcj2CreateLookupError('BANK_NOT_FOUND', 'Data Bank untuk User ID ' + uid + ' tidak ditemukan pada daftar pemain.');
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
        const rekInput = document.getElementById('lcj2-rek-all');
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
            const periodInput = document.getElementById('lcj2-prd-' + rowIdx);
            const inputPeriod = periodInput ? periodInput.value.trim() : '';
            const ocrPeriod = scan.ocrPeriods && scan.ocrPeriods[rowIdx] ? scan.ocrPeriods[rowIdx] : '';
            const period = inputPeriod || ocrPeriod || ('MENUNGGU OCR ' + (rowIdx + 1));

            // V5.7.4: sumber utama batas claim adalah tanggal + jam yang dibaca
            // langsung dari GAMBAR 2 DAN GAMBAR 4 sesuai paket. Periode hanya menjadi fallback
            // bila tulisan waktu pada screenshot benar-benar tidak dapat dibaca.
            const imageClaimTimestamp = scan.claimTimestampByRow && scan.claimTimestampByRow[rowIdx]
                ? scan.claimTimestampByRow[rowIdx]
                : null;
            const claimDeadline = lcj2CheckClaimDeadline(imageClaimTimestamp, period);
            scan.claimExpiredRows = scan.claimExpiredRows || [];
            scan.claimDeadlineByRow = scan.claimDeadlineByRow || [];
            scan.claimExpiredRows[rowIdx] = !!claimDeadline.expired;
            scan.claimDeadlineByRow[rowIdx] = claimDeadline;
            if (claimDeadline.expired) continue;

            out += scan.userId + '\t' + urls.join('\t') + '\t' + rn.rek + '\t' + rn.nama + '\t' + period + '\n';
        }
        return out;
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

    const LCJ2_EXPECTED_TOP_LENGTH = 9;
    const LCJ2_EXPECTED_BOTTOM_LENGTH = 10;
    const LCJ2_EXPECTED_FULL_LENGTH = 19;
    const LCJ2_STRICT_DOUBLE_MARKER = true;
    const LCJ2_MIN_BET_ODDS = 1.60;

    function lcj2FormatBetOdds(value, fallback) {
        const n = Number(value);
        return Number.isFinite(n)
            ? n.toFixed(2).replace('.', ',')
            : (fallback || 'BELUM TERBACA');
    }

    // V5.7.7 TURBO: perangkat dengan sedikitnya 4 logical CPU memakai worker
    // metadata terpisah. Periode tetap dibaca worker utama, sedangkan taruhan
    // dan tanggal/jam gambar 2 serta gambar 4 dikerjakan bersamaan tanpa mengubah hasil.
    const LCJ2_CPU_THREADS = Math.max(1, Number(navigator.hardwareConcurrency) || 4);
    const LCJ2_DEVICE_MEMORY_GB = Math.max(0, Number(navigator.deviceMemory) || 0);
    const LCJ2_TURBO_PARALLEL_OCR = LCJ2_CPU_THREADS >= 4;

    // V1.4.4 TURBO STABIL:
    // Worker ketiga hanya aktif pada perangkat yang cukup kuat. Perangkat ringan
    // tetap memakai maksimal dua worker agar browser tidak kehabisan memori.
    const LCJ2_TURBO_TIMESTAMP_WORKER =
        (LCJ2_CPU_THREADS >= 6 && LCJ2_DEVICE_MEMORY_GB >= 4) ||
        (LCJ2_CPU_THREADS >= 8 && LCJ2_DEVICE_MEMORY_GB === 0);
    const LCJ2_FAST_SCAN_MODE = true;

    // V1.0.0 — OCR CLAIM JAM 2 TERPISAH.
    // Jendela khusus berlaku pukul 23.00 sampai sebelum 02.00 WIB.
    // - 23.00-23.59: tanggal operasional = tanggal hari ini.
    // - 00.00-01.59: tanggal operasional = tanggal semalam.
    // - Dalam jendela khusus, transaksi 22.59 ke bawah TIDAK dapat claim.
    // - Transaksi mulai 23.00 dapat claim sampai sebelum pukul 02.00 WIB.
    // Di luar jendela khusus, aturan lama D+1 pukul 02.00 tetap dipakai.
    // Zona waktu dipaksa ke Asia/Jakarta agar hasil tidak mengikuti zona komputer.
    const LCJ2_CLAIM_TIME_ZONE = 'Asia/Jakarta';
    const LCJ2_CLAIM_CUTOFF_MINUTES = 2 * 60;
    const LCJ2_NIGHT_CLAIM_START_MINUTES = 23 * 60;
    const LCJ2_NIGHT_CLAIM_END_MINUTES = 2 * 60;
    const LCJ2_NUMERIC_OCR_WHITELIST = '0123456789';
    const LCJ2_TIMESTAMP_OCR_WHITELIST = '0123456789:/.-+− AMPampGMTUTCgmtutcBIOQSLZbioqslz';

    // Selisih terhadap jam perangkat. Nilainya diperbarui dari header Date server
    // secara non-blocking agar proses scan tidak menunggu koneksi internet.
    let lcj2OnlineTimeOffsetMs = 0;
    let lcj2OnlineTimeSource = 'PERANGKAT';
    let lcj2OnlineTimeLastSync = 0;
    let lcj2OnlineTimeSyncRunning = false;

    function lcj2NowMs() {
        return Date.now() + (Number(lcj2OnlineTimeOffsetMs) || 0);
    }

    function lcj2NowDate() {
        return new Date(lcj2NowMs());
    }

    function lcj2GetOnlineTimeSourceLabel() {
        return lcj2OnlineTimeSource === 'ONLINE' ? 'ONLINE' : 'PERANGKAT';
    }

    function lcj2SyncOnlineTime(force) {
        const now = Date.now();
        if (lcj2OnlineTimeSyncRunning) return;
        if (!force && lcj2OnlineTimeLastSync && now - lcj2OnlineTimeLastSync < 5 * 60 * 1000) return;
        if (typeof GM_xmlhttpRequest !== 'function') return;

        lcj2OnlineTimeSyncRunning = true;
        const startedAt = Date.now();
        try {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://www.google.com/generate_204?lcj2_time=' + startedAt,
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
                        lcj2OnlineTimeOffsetMs = estimatedServerNow - endedAt;
                        lcj2OnlineTimeSource = 'ONLINE';
                        lcj2OnlineTimeLastSync = endedAt;
                    }
                    lcj2OnlineTimeSyncRunning = false;
                },
                onerror: () => { lcj2OnlineTimeSyncRunning = false; },
                ontimeout: () => { lcj2OnlineTimeSyncRunning = false; }
            });
        } catch (e) {
            lcj2OnlineTimeSyncRunning = false;
        }
    }

    function lcj2GetWibParts(dateValue) {
        const date = dateValue instanceof Date ? dateValue : new Date(dateValue != null ? dateValue : lcj2NowMs());
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: LCJ2_CLAIM_TIME_ZONE,
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

    function lcj2ValidDateParts(year, month, day) {
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

    function lcj2ParseClaimDateFromPeriod(period) {
        const digits = String(period == null ? '' : period).replace(/\D/g, '');
        const candidates = [];
        if (digits.length >= 8) candidates.push(digits.slice(0, 8));
        const embedded = digits.match(/20\d{6}/g) || [];
        embedded.forEach((value) => {
            if (!candidates.includes(value)) candidates.push(value);
        });

        for (const dateKey of candidates) {
            if (!/^20\d{6}$/.test(dateKey)) continue;
            const valid = lcj2ValidDateParts(
                Number(dateKey.slice(0, 4)),
                Number(dateKey.slice(4, 6)),
                Number(dateKey.slice(6, 8))
            );
            if (valid) return valid;
        }
        return null;
    }

    const LCJ2_MONTH_NUMBER = {
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

    function lcj2FixOcrNumericText(value) {
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

    function lcj2ParseClockParts(hourRaw, minuteRaw, secondRaw, ampmRaw) {
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

    function lcj2InferYearForMonthDay(month, day, nowWib) {
        const now = nowWib || lcj2GetWibParts(lcj2NowDate());
        let year = now.year;
        let valid = lcj2ValidDateParts(year, month, day);
        if (!valid) return null;
        const candidateDay = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
        const todayDay = Math.floor(Date.UTC(now.year, now.month - 1, now.day) / 86400000);
        if (candidateDay > todayDay + 2) year -= 1;
        return year;
    }

    function lcj2IsValidGmtOffsetMinutes(offsetMinutes) {
        const total = Number(offsetMinutes);
        if (!Number.isFinite(total) || !Number.isInteger(total)) return false;

        // Rentang zona waktu dunia yang valid: GMT-12:00 sampai GMT+14:00.
        if (total < -12 * 60 || total > 14 * 60) return false;

        // Menit zona waktu harus 0–59. Mendukung offset setengah/45 menit
        // seperti GMT+5:30, GMT+5:45, GMT+9:30, dan GMT+12:45.
        const absoluteMinutes = Math.abs(total);
        return absoluteMinutes % 60 >= 0 && absoluteMinutes % 60 <= 59;
    }

    function lcj2ParseGmtHourMinute(signRaw, hourRaw, minuteRaw) {
        const sign = String(signRaw || '+') === '-' ? -1 : 1;
        const hour = Number(hourRaw);
        const minute = minuteRaw == null || minuteRaw === '' ? 0 : Number(minuteRaw);

        if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
        if (hour < 0 || hour > 14 || minute < 0 || minute > 59) return null;

        const total = sign * (hour * 60 + minute);
        return lcj2IsValidGmtOffsetMinutes(total) ? total : null;
    }

    function lcj2FindExplicitGmtOffsetMinutes(rawText) {
        let value = String(rawText == null ? '' : rawText)
            .toUpperCase()
            .replace(/[，]/g, ',')
            .replace(/[：]/g, ':')
            .replace(/[＋]/g, '+')
            .replace(/[−–—]/g, '-')
            .replace(/\s+/g, ' ')
            .trim();

        if (!value) return null;

        // Koreksi OCR umum pada label GMT/UTC.
        value = value
            .replace(/\bG\s*M\s*[T7I1]\b/g, 'GMT')
            .replace(/\bG[HNM]\s*T\b/g, 'GMT')
            .replace(/\bG\s*M\s*7\b/g, 'GMT')
            .replace(/\bU\s*T\s*C\b/g, 'UTC')
            .replace(/\bU[7T]\s*C\b/g, 'UTC')
            .replace(/(?:GMT|UTC)\s*\+\s*B\b/g, 'GMT+8')
            .replace(/(?:GMT|UTC)\s*\+\s*Q\b/g, 'GMT+9')
            .replace(/(?:GMT|UTC)\s*\+\s*O\s*(\d{1,2})\b/g, 'GMT+$1')
            .replace(/(?:GMT|UTC)\s*\+\s*I\s*(\d)\b/g, 'GMT+1$1')
            .replace(/(?:GMT|UTC)\s*\+\s*L\s*(\d)\b/g, 'GMT+1$1')
            .replace(/(?:GMT|UTC)\s*\+\s*S\b/g, 'GMT+5');

        // Format yang didukung:
        // GMT+7, GMT+08, GMT+8:00, GMT+0530, UTC-4, UTC+12:45.
        const signedPatterns = [
            /\b(?:GMT|UTC)\s*([+-])\s*(\d{1,2})\s*[:.]\s*([0-5]\d)\b/i,
            /\b(?:GMT|UTC)\s*([+-])\s*(\d{1,2})([0-5]\d)\b/i,
            /\b(?:GMT|UTC)\s*([+-])\s*0?(\d{1,2})\b/i
        ];

        for (const pattern of signedPatterns) {
            const match = value.match(pattern);
            if (!match) continue;

            let hourRaw = match[2];
            let minuteRaw = match[3] || '';

            // Untuk pola HHMM, pecah menjadi jam dan menit.
            if (pattern === signedPatterns[1]) {
                hourRaw = match[2];
                minuteRaw = match[3];
            }

            const parsed = lcj2ParseGmtHourMinute(match[1], hourRaw, minuteRaw);
            if (parsed != null) return parsed;
        }

        // Sebagian screenshot menulis "GMT 8" tanpa tanda +.
        // Tanpa tanda, angka dianggap offset positif.
        const unsigned = value.match(/\b(?:GMT|UTC)\s*(0?\d|1[0-4])(?:\s*[:.]\s*([0-5]\d))?\b/i);
        if (unsigned) {
            const parsed = lcj2ParseGmtHourMinute('+', unsigned[1], unsigned[2] || '');
            if (parsed != null) return parsed;
        }

        // Bentuk singkat seperti "GMT+7H" atau "UTC-5H".
        const hourSuffix = value.match(/\b(?:GMT|UTC)\s*([+-])\s*(\d{1,2})\s*H\b/i);
        if (hourSuffix) {
            const parsed = lcj2ParseGmtHourMinute(hourSuffix[1], hourSuffix[2], '');
            if (parsed != null) return parsed;
        }

        return null;
    }

    function lcj2DetectImageGmtOffsetMinutes(rawText) {
        const explicit = lcj2FindExplicitGmtOffsetMinutes(rawText);
        return explicit == null ? 7 * 60 : explicit;
    }

    function lcj2GmtOffsetLabel(offsetMinutes) {
        const total = Number(offsetMinutes);
        const sign = total < 0 ? '-' : '+';
        const absolute = Math.abs(total);
        const hour = Math.floor(absolute / 60);
        const minute = absolute % 60;
        return 'GMT' + sign + hour + (minute ? ':' + String(minute).padStart(2, '0') : '');
    }

    function lcj2ApplySourceGmtOffset(timestamp, sourceOffsetMinutes, evidenceText) {
        if (!timestamp || !timestamp.hasTime) return timestamp;

        const targetOffsetMinutes = 7 * 60;
        const explicitOffset = Number(sourceOffsetMinutes);
        const safeSourceOffset = lcj2IsValidGmtOffsetMinutes(explicitOffset)
            ? explicitOffset
            : targetOffsetMinutes;

        // Selalu hitung ulang dari waktu sebelum konversi agar pengurangan zona
        // tidak pernah diterapkan dua kali.
        const base = timestamp.originalTimestamp || {
            year: timestamp.year,
            month: timestamp.month,
            day: timestamp.day,
            hour: timestamp.hour,
            minute: timestamp.minute,
            second: timestamp.second || 0
        };

        const shiftedMs = Date.UTC(
            base.year,
            base.month - 1,
            base.day,
            base.hour,
            base.minute,
            base.second || 0
        ) + (targetOffsetMinutes - safeSourceOffset) * 60000;

        const shifted = new Date(shiftedMs);
        timestamp.year = shifted.getUTCFullYear();
        timestamp.month = shifted.getUTCMonth() + 1;
        timestamp.day = shifted.getUTCDate();
        timestamp.hour = shifted.getUTCHours();
        timestamp.minute = shifted.getUTCMinutes();
        timestamp.second = shifted.getUTCSeconds();
        timestamp.minutesOfDay = timestamp.hour * 60 + timestamp.minute;
        timestamp.dateKey = String(timestamp.year).padStart(4, '0') +
            String(timestamp.month).padStart(2, '0') +
            String(timestamp.day).padStart(2, '0');

        timestamp.originalTimestamp = {
            year: base.year,
            month: base.month,
            day: base.day,
            hour: base.hour,
            minute: base.minute,
            second: base.second || 0
        };
        timestamp.sourceGmtOffsetMinutes = safeSourceOffset;
        timestamp.sourceGmtLabel = lcj2GmtOffsetLabel(safeSourceOffset);
        timestamp.normalizedGmtLabel = 'GMT+7';
        timestamp.timezoneAdjusted = safeSourceOffset !== targetOffsetMinutes;
        timestamp.timezoneExplicit = true;
        timestamp.timezoneEvidence = String(evidenceText || '').trim().slice(0, 300);

        return timestamp;
    }

    function lcj2NormalizeTimestampToGmt7(timestamp, rawText) {
        if (!timestamp || !timestamp.hasTime) {
            if (timestamp) {
                timestamp.sourceGmtOffsetMinutes = 7 * 60;
                timestamp.sourceGmtLabel = 'GMT+7';
                timestamp.normalizedGmtLabel = 'GMT+7';
                timestamp.timezoneAdjusted = false;
                timestamp.timezoneExplicit = false;
            }
            return timestamp;
        }

        const explicitOffset = lcj2FindExplicitGmtOffsetMinutes(rawText);
        const sourceOffsetMinutes = explicitOffset == null ? 7 * 60 : explicitOffset;

        lcj2ApplySourceGmtOffset(timestamp, sourceOffsetMinutes, rawText);
        timestamp.timezoneExplicit = explicitOffset != null;
        return timestamp;
    }

    function lcj2MakeImageTimestamp(dateInfo, clockInfo, rawText, source, confidence) {
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
            source: source || 'image-2-or-4-ocr',
            confidence: Number(confidence) || 0
        };
        return lcj2NormalizeTimestampToGmt7(timestamp, rawText);
    }

    function lcj2ParseImageTimestampText(rawText, fallbackPeriod, nowValue) {
        const original = String(rawText == null ? '' : rawText)
            .replace(/\r/g, '\n')
            .replace(/[\t ]+/g, ' ')
            .replace(/\n+/g, '\n')
            .trim();
        const numeric = lcj2FixOcrNumericText(original);
        const nowWib = lcj2GetWibParts(nowValue || lcj2NowDate());
        const candidates = [];

        const addCandidate = (yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw, ampmRaw, index, source) => {
            let year = Number(yearRaw);
            if (year >= 0 && year < 100) year += year >= 70 ? 1900 : 2000;
            const dateInfo = lcj2ValidDateParts(year, Number(monthRaw), Number(dayRaw));
            if (!dateInfo) return;
            const clock = hourRaw == null || minuteRaw == null
                ? null
                : lcj2ParseClockParts(hourRaw, minuteRaw, secondRaw, ampmRaw);
            if (hourRaw != null && minuteRaw != null && !clock) return;
            const explicitYear = String(yearRaw == null ? '' : yearRaw).replace(/\D/g, '').length >= 4;
            candidates.push({
                timestamp: lcj2MakeImageTimestamp(dateInfo, clock, original, source, 0),
                index: Number(index) || 0,
                score: (clock ? 45 : 15) + (/image-2-row/.test(source) ? 18 : 0) + (explicitYear ? 95 : 0)
            });
        };

        const timeTail = '(?:[T,\\s]+([0-2]?\\d)\\s*[:.]\\s*([0-5]\\d)(?:\\s*[:.]\\s*([0-5]\\d))?\\s*(A\\.?M\\.?|P\\.?M\\.?)?)?';
        let match;
        let re = new RegExp('\\b(20\\d{2})\\s*[-/.]\\s*([01]?\\d)\\s*[-/.]\\s*([0-3]?\\d)' + timeTail, 'gi');
        while ((match = re.exec(numeric))) addCandidate(match[1], match[2], match[3], match[4], match[5], match[6], match[7], match.index, 'image-2-ocr-ymd');

        re = new RegExp('\\b([0-3]?\\d)\\s*[-/.]\\s*([01]?\\d)\\s*[-/.]\\s*(20\\d{2}|\\d{2})' + timeTail, 'gi');
        while ((match = re.exec(numeric))) addCandidate(match[3], match[2], match[1], match[4], match[5], match[6], match[7], match.index, 'image-2-ocr-dmy');

        const monthNames = Object.keys(LCJ2_MONTH_NUMBER).sort((a, b) => b.length - a.length).join('|');
        re = new RegExp('\\b([0-3]?\\d)\\s+(?:' + monthNames + ')\\s+(20\\d{2}|\\d{2})' + timeTail, 'gi');
        while ((match = re.exec(original.toUpperCase()))) {
            const monthWordMatch = String(match[0]).toUpperCase().match(new RegExp('(' + monthNames + ')'));
            const month = monthWordMatch ? LCJ2_MONTH_NUMBER[monthWordMatch[1]] : null;
            if (month) addCandidate(match[2], month, match[1], match[3], match[4], match[5], match[6], match.index, 'image-2-ocr-month');
        }

        // Format tanpa tahun, misalnya 31/07 23:58. Tahun dipilih yang paling dekat dengan hari ini.
        re = /\b([0-3]?\d)\s*[-/.]\s*([01]?\d)(?!\s*[-/.]\s*\d{2,4})(?:\s+|\s*[,|-]\s*)([0-2]?\d)\s*[:.]\s*([0-5]\d)(?:\s*[:.]\s*([0-5]\d))?\s*(A\.?M\.?|P\.?M\.?)?/gi;
        while ((match = re.exec(numeric))) {
            const inferredYear = lcj2InferYearForMonthDay(Number(match[2]), Number(match[1]), nowWib);
            if (inferredYear) addCandidate(inferredYear, match[2], match[1], match[3], match[4], match[5], match[6], match.index, 'image-2-ocr-dm');
        }

        // Format tanpa tahun MM/DD HH:MM, misalnya 07/31 16:33 atau 07/31, 16:33.
        re = /\b([01]?\d)\s*[-/.]\s*([0-3]?\d)(?!\s*[-/.]\s*\d{2,4})(?:\s+|\s*[,|-]\s*)([0-2]?\d)\s*[:.]\s*([0-5]\d)(?:\s*[:.]\s*([0-5]\d))?\s*(A\.?M\.?|P\.?M\.?)?/gi;
        while ((match = re.exec(numeric))) {
            const inferredYear = lcj2InferYearForMonthDay(Number(match[1]), Number(match[2]), nowWib);
            if (inferredYear) addCandidate(inferredYear, match[1], match[2], match[3], match[4], match[5], match[6], match.index, 'image-2-ocr-md');
        }

        // Format waktu lebih dulu, lalu tanggal di baris/kolom berikutnya.
        // Mendukung susunan seperti "16:33:25 07/31" yang umum pada screenshot Riwayat Permainan.
        re = /\b([0-2]?\d)\s*[:.]\s*([0-5]\d)(?:\s*[:.]\s*([0-5]\d))?\s*(A\.?M\.?|P\.?M\.?)?(?:\s+|\s*[,|-]\s*)([01]?\d)\s*[-/.]\s*([0-3]?\d)\b(?!\s*[-/.]\s*\d{2,4})/gi;
        while ((match = re.exec(numeric))) {
            const inferredYear = lcj2InferYearForMonthDay(Number(match[5]), Number(match[6]), nowWib);
            if (inferredYear) addCandidate(inferredYear, match[5], match[6], match[1], match[2], match[3], match[4], match.index, 'image-2-ocr-time-md');
        }
        re = /\b([0-2]?\d)\s*[:.]\s*([0-5]\d)(?:\s*[:.]\s*([0-5]\d))?\s*(A\.?M\.?|P\.?M\.?)?(?:\s+|\s*[,|-]\s*)([0-3]?\d)\s*[-/.]\s*([01]?\d)\b(?!\s*[-/.]\s*\d{2,4})/gi;
        while ((match = re.exec(numeric))) {
            const inferredYear = lcj2InferYearForMonthDay(Number(match[6]), Number(match[5]), nowWib);
            if (inferredYear) addCandidate(inferredYear, match[6], match[5], match[1], match[2], match[3], match[4], match.index, 'image-2-ocr-time-dm');
        }

        // Bila tanggal dan jam terpisah oleh baris/label, gabungkan tanggal terbaik dengan jam terdekat.
        const dateOnly = [];
        const addDateOnly = (yearRaw, monthRaw, dayRaw, index) => {
            const explicitYear = String(yearRaw == null ? '' : yearRaw).replace(/\D/g, '').length >= 4;
            let year = Number(yearRaw);
            if (year >= 0 && year < 100) year += year >= 70 ? 1900 : 2000;
            const dateInfo = lcj2ValidDateParts(year, Number(monthRaw), Number(dayRaw));
            if (dateInfo) dateOnly.push({ dateInfo, index, explicitYear });
        };
        const addDateOnlyNoYear = (monthRaw, dayRaw, index) => {
            const inferredYear = lcj2InferYearForMonthDay(Number(monthRaw), Number(dayRaw), nowWib);
            const dateInfo = inferredYear ? lcj2ValidDateParts(inferredYear, Number(monthRaw), Number(dayRaw)) : null;
            if (dateInfo) dateOnly.push({ dateInfo, index, explicitYear: false });
        };
        re = /\b(20\d{2})\s*[-/.]\s*([01]?\d)\s*[-/.]\s*([0-3]?\d)\b/g;
        while ((match = re.exec(numeric))) addDateOnly(match[1], match[2], match[3], match.index);
        re = /\b([0-3]?\d)\s*[-/.]\s*([01]?\d)\s*[-/.]\s*(20\d{2}|\d{2})\b/g;
        while ((match = re.exec(numeric))) addDateOnly(match[3], match[2], match[1], match.index);
        // Format tanpa tahun pada kolom waktu game sering memakai MM/DD, mis. 07/31.
        re = /\b([01]?\d)\s*[-/.]\s*([0-3]?\d)\b(?!\s*[-/.]\s*\d{2,4})/g;
        while ((match = re.exec(numeric))) addDateOnlyNoYear(match[1], match[2], match.index);
        // Tambahkan juga pembacaan DD/MM agar format lokal tetap terbaca bila muncul.
        re = /\b([0-3]?\d)\s*[-/.]\s*([01]?\d)\b(?!\s*[-/.]\s*\d{2,4})/g;
        while ((match = re.exec(numeric))) addDateOnlyNoYear(match[2], match[1], match.index);

        const times = [];
        re = /\b([0-2]?\d)\s*[:.]\s*([0-5]\d)(?:\s*[:.]\s*([0-5]\d))?\s*(A\.?M\.?|P\.?M\.?)?/gi;
        while ((match = re.exec(numeric))) {
            const clock = lcj2ParseClockParts(match[1], match[2], match[3], match[4]);
            if (clock) times.push({ clock, index: match.index });
        }
        dateOnly.forEach((dateItem) => {
            const nearest = times.slice().sort((a, b) => Math.abs(a.index - dateItem.index) - Math.abs(b.index - dateItem.index))[0];
            if (nearest && Math.abs(nearest.index - dateItem.index) <= 120) {
                candidates.push({
                    timestamp: lcj2MakeImageTimestamp(dateItem.dateInfo, nearest.clock, original, 'image-2-ocr-split', 0),
                    index: dateItem.index,
                    score: 52 - Math.min(20, Math.floor(Math.abs(nearest.index - dateItem.index) / 8)) + (dateItem.explicitYear ? 95 : 0)
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
            const valid = lcj2ValidDateParts(Number(year), Number(month), Number(day));
            if (valid) compactDates.push({ dateInfo: valid, index, source });
        };
        const pushCompactDateNoYear = (month, day, index, source) => {
            const year = lcj2InferYearForMonthDay(Number(month), Number(day), nowWib);
            if (year) pushCompactDate(year, month, day, index, source);
        };
        const pushCompactTime = (hour, minute, second, index, source) => {
            const clock = lcj2ParseClockParts(hour, minute, second, '');
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
                timestamp: lcj2MakeImageTimestamp(
                    dateItem.dateInfo,
                    nearest.clock,
                    original,
                    dateItem.source + '+' + nearest.source,
                    0
                ),
                index: Math.min(dateItem.index, nearest.index),
                score: 40 - Math.abs(nearest.index - dateItem.index) * 4 + (explicitYear ? 95 : 0)
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

        const fallbackDate = lcj2ParseClaimDateFromPeriod(fallbackPeriod);
        if (fallbackDate) {
            return lcj2MakeImageTimestamp(fallbackDate, null, original, 'period-date-fallback', 0);
        }
        return null;
    }

    function lcj2FormatClaimDate(dateInfo) {
        if (!dateInfo) return '-';
        return String(dateInfo.day).padStart(2, '0') + '/' +
            String(dateInfo.month).padStart(2, '0') + '/' +
            String(dateInfo.year);
    }

    function lcj2FormatClaimTimestamp(timestamp) {
        if (!timestamp) return '-';
        const dateText = lcj2FormatClaimDate(timestamp);
        if (!timestamp.hasTime) return dateText + ' • jam tidak terbaca';
        const base = dateText + ' ' +
            String(timestamp.hour).padStart(2, '0') + ':' +
            String(timestamp.minute).padStart(2, '0');
        if (timestamp.timezoneAdjusted) {
            const original = timestamp.originalTimestamp || {};
            const originalText = Number.isInteger(original.hour) && Number.isInteger(original.minute)
                ? String(original.hour).padStart(2, '0') + ':' + String(original.minute).padStart(2, '0')
                : '-';
            return base + ' GMT+7 (asli ' + originalText + ' ' + timestamp.sourceGmtLabel + ')';
        }
        return base + ' GMT+7' + (timestamp.timezoneExplicit ? '' : ' • zona tidak terbaca');
    }

    function lcj2FormatClaimDeadline(status) {
        if (!status || !status.deadlineDate) return '-';
        return lcj2FormatClaimDate(status.deadlineDate) + ' 02.00 WIB';
    }

    function lcj2UtcDayToDateInfo(utcDay) {
        const value = new Date(Number(utcDay) * 86400000);
        return {
            year: value.getUTCFullYear(),
            month: value.getUTCMonth() + 1,
            day: value.getUTCDate(),
            dateKey: String(value.getUTCFullYear()).padStart(4, '0') +
                String(value.getUTCMonth() + 1).padStart(2, '0') +
                String(value.getUTCDate()).padStart(2, '0')
        };
    }

    function lcj2IsNightClaimWindow(nowWib) {
        if (!nowWib) return false;
        return nowWib.minutesOfDay >= LCJ2_NIGHT_CLAIM_START_MINUTES ||
            nowWib.minutesOfDay < LCJ2_NIGHT_CLAIM_END_MINUTES;
    }

    function lcj2GetNightOperationalUtcDay(nowWib) {
        const todayUtcDay = Math.floor(Date.UTC(nowWib.year, nowWib.month - 1, nowWib.day) / 86400000);
        return nowWib.minutesOfDay < LCJ2_NIGHT_CLAIM_END_MINUTES
            ? todayUtcDay - 1
            : todayUtcDay;
    }

    function lcj2ClaimStatusMessage(status) {
        if (!status) return 'Tidak dapat claim.';
        return status.reason || 'Tidak dapat claim karena tidak memenuhi aturan waktu.';
    }

    function lcj2FormatCurrentWib(nowValue) {
        const nowWib = lcj2GetWibParts(nowValue || lcj2NowDate());
        return lcj2FormatClaimDate(nowWib) + ' ' +
            String(nowWib.hour).padStart(2, '0') + ':' +
            String(nowWib.minute).padStart(2, '0') + ':' +
            String(nowWib.second).padStart(2, '0') + ' WIB';
    }

    function lcj2CheckClaimDeadline(imageTimestamp, fallbackPeriod, nowValue) {
        // Kompatibilitas panggilan lama: lcj2CheckClaimDeadline(period, nowDate)
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
            ? lcj2ValidDateParts(timestamp.year, timestamp.month, timestamp.day)
            : lcj2ParseClaimDateFromPeriod(fallbackPeriod);
        const nowWib = lcj2GetWibParts(nowValue || lcj2NowDate());

        if (!claimDate) {
            return {
                expired: false,
                hasDate: false,
                claimDate: null,
                imageTimestamp: timestamp,
                timestampSource: timestamp ? timestamp.source : '',
                nowWib,
                onlineTimeSource: lcj2GetOnlineTimeSourceLabel(),
                dayDifference: null,
                reasonCode: 'NO_DATE',
                reason: '',
                ruleText: 'Tanggal belum terbaca; lakukan pemeriksaan manual.'
            };
        }

        const claimDay = Math.floor(Date.UTC(claimDate.year, claimDate.month - 1, claimDate.day) / 86400000);
        const todayDay = Math.floor(Date.UTC(nowWib.year, nowWib.month - 1, nowWib.day) / 86400000);
        const yesterdayDay = todayDay - 1;
        const dayDifference = todayDay - claimDay;
        const deadlineUtcDay = claimDay + 1;
        const deadlineDate = lcj2UtcDayToDateInfo(deadlineUtcDay);
        const transactionMinutes = timestamp && timestamp.hasTime &&
            Number.isInteger(timestamp.minutesOfDay)
            ? timestamp.minutesOfDay
            : null;

        let expired = false;
        let reasonCode = '';
        let reason = '';
        let ruleText = '';

        // PERATURAN UTAMA:
        // 1. Tanggal hari ini langsung dapat claim.
        // 2. Tanggal semalam hanya dapat claim bila jam transaksi GMT+7 adalah 23.00–23.59,
        //    dan claim dilakukan sebelum pukul 02.00 WIB.
        // 3. Tanggal yang lebih lama dari semalam tidak dapat claim.
        if (claimDay === todayDay) {
            expired = false;
            reasonCode = 'TODAY_VALID';
            ruleText = 'Tanggal hari ini dapat claim.';
        } else if (claimDay === yesterdayDay) {
            if (nowWib.minutesOfDay >= LCJ2_CLAIM_CUTOFF_MINUTES) {
                expired = true;
                reasonCode = 'YESTERDAY_AFTER_02';
                reason = 'Tanggal semalam hanya dapat claim sebelum pukul 02.00 WIB.';
                ruleText = 'Tanggal semalam dapat diajukan pukul 00.00–01.59 WIB saja.';
            } else if (transactionMinutes == null) {
                expired = true;
                reasonCode = 'YESTERDAY_TIME_NOT_READABLE';
                reason = 'Jam transaksi pada gambar 2 atau gambar 4 belum terbaca.';
                ruleText = 'Tanggal semalam hanya bisa claim jika waktu GMT+7 terbaca pada rentang 23.00–23.59.';
            } else if (transactionMinutes < 23 * 60) {
                expired = true;
                reasonCode = 'YESTERDAY_0000_2259_BLOCKED';
                reason = 'Tanggal semalam tidak dapat claim untuk transaksi pukul 00.00–22.59 GMT+7.';
                ruleText = 'Yang bisa claim untuk tanggal semalam hanya transaksi pukul 23.00–23.59 GMT+7.';
            } else {
                expired = false;
                reasonCode = 'YESTERDAY_2300_2359_VALID';
                ruleText = 'Tanggal semalam dapat claim karena waktu transaksi berada pada 23.00–23.59 GMT+7.';
            }
        } else if (claimDay < yesterdayDay) {
            expired = true;
            reasonCode = 'OLDER_THAN_YESTERDAY';
            reason = 'Tanggal transaksi lebih lama dari tanggal semalam dan tidak dapat claim.';
            ruleText = 'Hanya tanggal hari ini, atau tanggal semalam dengan waktu 23.00–23.59 GMT+7, yang dapat claim.';
        } else {
            expired = true;
            reasonCode = 'FUTURE_DATE';
            reason = 'Tanggal transaksi berada setelah tanggal hari ini dan tidak dapat claim.';
            ruleText = 'Tanggal transaksi tidak boleh melebihi tanggal WIB sekarang.';
        }

        return {
            expired,
            hasDate: true,
            claimDate,
            imageTimestamp: timestamp,
            timestampSource: timestamp ? timestamp.source : 'period-date-fallback',
            usedImageTimestamp: !!timestamp && timestamp.source !== 'period-date-fallback',
            nowWib,
            onlineTimeSource: lcj2GetOnlineTimeSourceLabel(),
            dayDifference,
            deadlineDate,
            cutoffReached: expired && reasonCode === 'YESTERDAY_AFTER_02',
            nightWindowActive: nowWib.minutesOfDay < LCJ2_CLAIM_CUTOFF_MINUTES,
            operationalDate: lcj2UtcDayToDateInfo(todayDay),
            operationalUtcDay: todayDay,
            reasonCode,
            reason,
            ruleText
        };
    }

    let lcj2SharedWorker = null;
    let lcj2SharedWorkerInit = null;
    let lcj2MetadataWorker = null;
    let lcj2MetadataWorkerInit = null;
    let lcj2TimestampWorker = null;
    let lcj2TimestampWorkerInit = null;
    let lcj2WorkerProgressHandler = null;
    let lcj2WorkerPsm = null;
    let lcj2WorkerPsmByWorker = new WeakMap();
    let lcj2LastWorkerLogAt = 0;
    let lcj2LastWorkerPct = -1;
    let lcj2DashboardYieldCounter = 0;
    const lcj2PreparedBaseCache = new WeakMap();

    // Cache hanya mempercepat pemuatan/scan ulang. Pemilihan gambar, marker,
    // crop, paket, dan validasi periode tetap memakai cara kerja V5.5.1.
    const lcj2BlobUrlCache = new Map();
    const lcj2ArrangeCanvasCache = new Map();
    const lcj2ImageAnalysisCache = new Map();
    const lcj2PeriodResultCache = new Map();
    const lcj2TimezoneOffsetCache = new WeakMap();
    const LCJ2_BLOB_CACHE_LIMIT = 24;
    const LCJ2_ARRANGE_CANVAS_CACHE_LIMIT = 24;
    const LCJ2_ANALYSIS_CACHE_LIMIT = 24;
    const LCJ2_RESULT_CACHE_LIMIT = 24;
    let lcj2WorkerWarmupStarted = false;
    let lcj2WorkerGeneration = 0;

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

            const cached = lcj2BlobUrlCache.get(src);
            if (cached) {
                // Refresh urutan LRU tanpa mengubah URL atau isi gambar.
                lcj2BlobUrlCache.delete(src);
                lcj2BlobUrlCache.set(src, cached);
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
                            lcj2BlobUrlCache.set(src, objectUrl);
                            trimFastCache(lcj2BlobUrlCache, LCJ2_BLOB_CACHE_LIMIT, (url) => {
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
        lcj2WorkerProgressHandler = onProgress || null;

        if (lcj2SharedWorker) return lcj2SharedWorker;
        if (lcj2SharedWorkerInit) return lcj2SharedWorkerInit;

        const workerGeneration = lcj2WorkerGeneration;
        lcj2SharedWorkerInit = (async () => {
            const worker = await window.Tesseract.createWorker(
                'eng',
                1,
                {
                    logger: (m) => {
                        const fn = lcj2WorkerProgressHandler;
                        if (!fn || !m || !m.status) return;
                        const now = Date.now();
                        const pct = typeof m.progress === 'number' ? Math.round(m.progress * 100) : -1;
                        const meaningfulStep = pct < 0 || lcj2LastWorkerPct < 0 || Math.abs(pct - lcj2LastWorkerPct) >= 10;
                        if (!meaningfulStep && now - lcj2LastWorkerLogAt < 800) return;
                        lcj2LastWorkerLogAt = now;
                        lcj2LastWorkerPct = pct;
                        fn(m.status + (pct < 0 ? '' : ' ' + pct + '%'));
                    },
                    errorHandler: (err) => console.error('[LCJ2 OCR]', err)
                },
                { load_system_dawg: '0', load_freq_dawg: '0' }
            );

            // Parameter tetap hanya dikirim sekali. Selanjutnya hanya PSM yang berubah bila diperlukan.
            await worker.setParameters({
                tessedit_char_whitelist: LCJ2_NUMERIC_OCR_WHITELIST,
                preserve_interword_spaces: '1',
                user_defined_dpi: '300',
                classify_bln_numeric_mode: '1'
            });
            if (workerGeneration !== lcj2WorkerGeneration) {
                try { await worker.terminate(); } catch (e) {}
                throw new Error('Persiapan OCR dibatalkan.');
            }
            lcj2WorkerPsm = null;
            lcj2SharedWorker = worker;
            return worker;
        })();

        try {
            return await lcj2SharedWorkerInit;
        } finally {
            lcj2SharedWorkerInit = null;
        }
    }

    async function getMetadataOCRWorker() {
        if (!LCJ2_TURBO_PARALLEL_OCR) return null;
        await waitForTesseract(15000);
        if (lcj2MetadataWorker) return lcj2MetadataWorker;
        if (lcj2MetadataWorkerInit) return lcj2MetadataWorkerInit;

        const workerGeneration = lcj2WorkerGeneration;
        lcj2MetadataWorkerInit = (async () => {
            const worker = await window.Tesseract.createWorker(
                'eng',
                1,
                {
                    // Worker metadata dibuat tanpa progress UI agar pembaruan panel
                    // tidak berebut waktu dengan worker periode utama.
                    logger: () => {},
                    errorHandler: (err) => console.error('[LCJ2 OCR META]', err)
                },
                { load_system_dawg: '0', load_freq_dawg: '0' }
            );
            await worker.setParameters({
                tessedit_char_whitelist: LCJ2_NUMERIC_OCR_WHITELIST,
                preserve_interword_spaces: '1',
                user_defined_dpi: '300',
                classify_bln_numeric_mode: '1'
            });
            if (workerGeneration !== lcj2WorkerGeneration) {
                try { await worker.terminate(); } catch (e) {}
                throw new Error('Persiapan OCR metadata dibatalkan.');
            }
            lcj2WorkerPsmByWorker.delete(worker);
            lcj2MetadataWorker = worker;
            return worker;
        })();

        try {
            return await lcj2MetadataWorkerInit;
        } finally {
            lcj2MetadataWorkerInit = null;
        }
    }

    async function getTimestampOCRWorker() {
        if (!LCJ2_TURBO_TIMESTAMP_WORKER) return null;
        await waitForTesseract(15000);
        if (lcj2TimestampWorker) return lcj2TimestampWorker;
        if (lcj2TimestampWorkerInit) return lcj2TimestampWorkerInit;

        const workerGeneration = lcj2WorkerGeneration;
        lcj2TimestampWorkerInit = (async () => {
            const worker = await window.Tesseract.createWorker(
                'eng',
                1,
                {
                    logger: () => {},
                    errorHandler: (err) => console.error('[LCJ2 OCR TIME]', err)
                },
                { load_system_dawg: '0', load_freq_dawg: '0' }
            );
            await worker.setParameters({
                tessedit_char_whitelist: LCJ2_NUMERIC_OCR_WHITELIST,
                preserve_interword_spaces: '1',
                user_defined_dpi: '300',
                classify_bln_numeric_mode: '1'
            });
            if (workerGeneration !== lcj2WorkerGeneration) {
                try { await worker.terminate(); } catch (e) {}
                throw new Error('Persiapan OCR waktu dibatalkan.');
            }
            lcj2WorkerPsmByWorker.delete(worker);
            lcj2TimestampWorker = worker;
            return worker;
        })();

        try {
            return await lcj2TimestampWorkerInit;
        } finally {
            lcj2TimestampWorkerInit = null;
        }
    }

    function warmupOCRWorker() {
        const primaryReady = !!(lcj2SharedWorker || lcj2SharedWorkerInit);
        const metadataReady = !LCJ2_TURBO_PARALLEL_OCR || !!(lcj2MetadataWorker || lcj2MetadataWorkerInit);
        const timestampReady = !LCJ2_TURBO_TIMESTAMP_WORKER || !!(lcj2TimestampWorker || lcj2TimestampWorkerInit);
        if (lcj2WorkerWarmupStarted || (primaryReady && metadataReady && timestampReady)) return;
        lcj2WorkerWarmupStarted = true;
        setTimeout(() => {
            const jobs = [
                getSharedOCRWorker(null).catch((err) => console.warn('[LCJ2 OCR warmup]', err))
            ];
            if (LCJ2_TURBO_PARALLEL_OCR) {
                jobs.push(
                    getMetadataOCRWorker().catch((err) => console.warn('[LCJ2 OCR metadata warmup]', err))
                );
            }
            if (LCJ2_TURBO_TIMESTAMP_WORKER) {
                jobs.push(
                    getTimestampOCRWorker().catch((err) => console.warn('[LCJ2 OCR time warmup]', err))
                );
            }
            Promise.allSettled(jobs)
                .finally(() => { lcj2WorkerWarmupStarted = false; });
        }, 0);
    }

    async function destroySharedOCRWorker() {
        lcj2WorkerGeneration++;
        const workers = [lcj2SharedWorker, lcj2MetadataWorker, lcj2TimestampWorker].filter(Boolean);
        lcj2SharedWorker = null;
        lcj2SharedWorkerInit = null;
        lcj2MetadataWorker = null;
        lcj2MetadataWorkerInit = null;
        lcj2TimestampWorker = null;
        lcj2TimestampWorkerInit = null;
        lcj2WorkerProgressHandler = null;
        lcj2WorkerPsm = null;
        lcj2WorkerPsmByWorker = new WeakMap();
        lcj2LastWorkerLogAt = 0;
        lcj2LastWorkerPct = -1;
        lcj2WorkerWarmupStarted = false;
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

        const existing = lcj2ArrangeCanvasCache.get(key);
        if (existing) {
            lcj2ArrangeCanvasCache.delete(key);
            lcj2ArrangeCanvasCache.set(key, existing);
            return existing;
        }

        const task = (async () => {
            const blobUrl = await srcToBlobUrlByGM(key);
            const img = await loadImageElement(blobUrl);
            return {
                blobUrl,
                sourceCanvas: imageToCanvas(img)
            };
        })();

        lcj2ArrangeCanvasCache.set(key, task);
        trimFastCache(lcj2ArrangeCanvasCache, LCJ2_ARRANGE_CANVAS_CACHE_LIMIT);

        try {
            return await task;
        } catch (err) {
            lcj2ArrangeCanvasCache.delete(key);
            throw err;
        }
    }

    async function getImageAnalysis(src) {
        const key = String(src || '');
        if (!key) throw new Error('Sumber gambar kosong.');

        const existing = lcj2ImageAnalysisCache.get(key);
        if (existing) {
            lcj2ImageAnalysisCache.delete(key);
            lcj2ImageAnalysisCache.set(key, existing);
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

        lcj2ImageAnalysisCache.set(key, task);
        trimFastCache(lcj2ImageAnalysisCache, LCJ2_ANALYSIS_CACHE_LIMIT);

        try {
            return await task;
        } catch (err) {
            lcj2ImageAnalysisCache.delete(key);
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
    function lcj2MeasureScreenshotVisuals(sourceCanvas) {
        const sample = createCanvas(72, 96);
        const ctx = sample.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(sourceCanvas, 0, 0, sample.width, sample.height);

        const data = ctx.getImageData(0, 0, sample.width, sample.height).data;
        const total = Math.max(1, data.length / 4);
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

        const width = Math.max(1, Number(sourceCanvas.width) || 1);
        const height = Math.max(1, Number(sourceCanvas.height) || 1);

        return {
            width,
            height,
            aspectRatio: width / height,
            warmRatio: warm / total,
            strongWarmRatio: strongWarm / total,
            darkRatio: dark / total,
            paleRatio: pale / total
        };
    }

    async function lcj2AnalyzeScreenshotForAutoArrange(src, index) {
        // Tahap cepat: cukup muat canvas sekali dan ukur warna/rasio.
        // Detektor dua bulatan yang lebih berat hanya dijalankan pada kandidat Riwayat.
        const base = await getArrangeImageCanvas(src);
        const stats = lcj2MeasureScreenshotVisuals(base.sourceCanvas);
        const portrait = stats.aspectRatio <= 0.74;
        const wideOrCombined = stats.aspectRatio >= 0.78;

        let marker = null;
        const possibleHistory = portrait && stats.darkRatio >= 0.24 && stats.warmRatio <= 0.20;
        if (possibleHistory) {
            // Sekaligus isi cache marker untuk proses SCAN. Dengan demikian deteksi
            // dua bulatan tidak dikerjakan dua kali setelah gambar selesai disusun.
            try {
                const fullAnalysis = await getImageAnalysis(src);
                marker = fullAnalysis ? fullAnalysis.marker : null;
            } catch (e) {
                marker = detectDoubleOrangeMarker(base.sourceCanvas);
            }
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
            stats.paleRatio * 18 -
            (portrait && stats.darkRatio >= 0.62 ? 230 : 0) -
            (portrait && stats.warmRatio >= 0.32 ? 170 : 0);

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

    async function lcj2AnalyzeScreenshotsForAutoArrange(images, onProgress) {
        const list = Array.isArray(images) ? images.slice() : [];
        const results = new Array(list.length);
        let cursor = 0;
        let completed = 0;

        const runner = async () => {
            while (cursor < list.length) {
                const index = cursor++;
                try {
                    results[index] = await lcj2AnalyzeScreenshotForAutoArrange(list[index], index);
                } catch (err) {
                    results[index] = {
                        src: list[index], index, marker: null, hasHistoryMarker: false,
                        markerConfidence: 0, portrait: false, wideOrCombined: false,
                        historyScore: -999, winScore: -999, gameScore: -999,
                        aspectRatio: 1, warmRatio: 0, strongWarmRatio: 0,
                        darkRatio: 0, paleRatio: 0,
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
        const autoArrangeLimit = LCJ2_CPU_THREADS >= 12 ? 10 : (LCJ2_CPU_THREADS >= 8 ? 8 : (LCJ2_CPU_THREADS >= 4 ? 5 : 2));
        const concurrency = Math.min(autoArrangeLimit, Math.max(1, list.length));
        for (let i = 0; i < concurrency; i++) workers.push(runner());
        await Promise.all(workers);
        return results;
    }

    function lcj2PickHighest(items, scoreKey, excluded) {
        const blocked = excluded || new Set();
        return items
            .filter((item) => item && !blocked.has(item.index))
            .slice()
            .sort((a, b) =>
                (Number(b[scoreKey]) || -999) - (Number(a[scoreKey]) || -999) ||
                a.index - b.index
            )[0] || null;
    }

    function lcj2ArrangeSingleThreeImagePackage(packageImages, packageAnalyses) {
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
                markerConfidence: 0
            };
        });

        if (images.length !== 3 || items.length !== 3) {
            return { images, changed: false, confident: false, reason: 'incomplete-package' };
        }

        const rankDesc = (list, scoreKey) => list.slice().sort((a, b) =>
            (Number(b[scoreKey]) || -999) - (Number(a[scoreKey]) || -999) ||
            a.index - b.index
        );

        // 1) Selalu tentukan RIWAYAT dulu dari gambar paling gelap.
        //    Ini menyesuaikan contoh terbaru pengguna: semua screenshot portrait,
        //    jadi gambar permainan tidak lagi dicari dari rasio lebar.
        const historyRank = rankDesc(items, 'historyScore');
        let history = historyRank.find((item) =>
            item && item.portrait && (
                item.darkRatio >= 0.30 ||
                (item.hasHistoryMarker && item.darkRatio >= 0.24)
            )
        ) || historyRank[0] || null;

        const remainingAfterHistory = items.filter((item) => !history || item.index !== history.index);

        // 2) Dari sisa dua gambar, tentukan KEMENANGAN TOTAL dari gambar paling hangat/keemasan.
        const winRank = rankDesc(remainingAfterHistory, 'winScore');
        let win = winRank.find((item) =>
            item && item.portrait &&
            item.darkRatio <= 0.60 && (
                item.warmRatio >= 0.16 ||
                item.strongWarmRatio >= 0.08 ||
                item.paleRatio >= 0.10
            )
        ) || winRank[0] || null;

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

        // 3) Gambar yang tersisa pasti menjadi screenshot PERMAINAN.
        let game = items.find((item) =>
            item &&
            (!history || item.index !== history.index) &&
            (!win || item.index !== win.index)
        ) || null;

        // Fallback ekstra bila ada benturan yang tidak terduga.
        if (!game) {
            const excluded = new Set([
                history ? history.index : -1,
                win ? win.index : -1
            ]);
            game = rankDesc(items.filter((item) => !excluded.has(item.index)), 'gameScore')[0] || null;
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
        const confident = !!(
            game && history && win &&
            history.darkRatio >= 0.24 &&
            win.darkRatio <= 0.60 &&
            (win.warmRatio >= 0.16 || win.strongWarmRatio >= 0.08 || win.paleRatio >= 0.10)
        );

        return {
            images: ordered,
            changed,
            confident,
            reason: confident ? 'portrait-three-image-order' : 'deterministic-three-image-order'
        };
    }

    function lcj2RoleUtility(item, role) {
        if (!item) return -1000000;

        if (role === 'history') {
            return (Number(item.historyScore) || -999) +
                (Number(item.darkRatio) || 0) * 210 -
                (Number(item.warmRatio) || 0) * 95 +
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
            (item.wideOrCombined ? 120 : 0) +
            (Number(item.paleRatio) || 0) * 45 -
            Math.max(0, (Number(item.darkRatio) || 0) - 0.72) * 170;
    }

    function lcj2AssignScreenshotRolesGlobally(items, rows) {
        const list = Array.isArray(items) ? items : [];
        const target = Math.max(1, Number(rows) || 1);
        if (list.length !== target * 3) return null;

        // Dynamic programming: tepat target gambar Permainan, target Riwayat,
        // dan target Kemenangan. Ini mencegah paket bercampur sebelum klasifikasi.
        let states = new Map();
        states.set('0|0|0', { score: 0, roles: [] });

        list.forEach((item, itemIndex) => {
            const next = new Map();

            states.forEach((state, key) => {
                const parts = key.split('|').map(Number);
                const g = parts[0];
                const h = parts[1];
                const w = parts[2];

                const choices = [
                    ['game', g, h, w],
                    ['history', g, h, w],
                    ['win', g, h, w]
                ];

                choices.forEach((choice) => {
                    const role = choice[0];
                    let ng = g;
                    let nh = h;
                    let nw = w;
                    if (role === 'game') ng++;
                    if (role === 'history') nh++;
                    if (role === 'win') nw++;
                    if (ng > target || nh > target || nw > target) return;

                    const remaining = list.length - itemIndex - 1;
                    if (ng + remaining < target || nh + remaining < target || nw + remaining < target) return;

                    const score = state.score + lcj2RoleUtility(item, role);
                    const nextKey = ng + '|' + nh + '|' + nw;
                    const old = next.get(nextKey);
                    if (!old || score > old.score) {
                        next.set(nextKey, {
                            score,
                            roles: state.roles.concat(role)
                        });
                    }
                });
            });

            states = next;
        });

        const finalState = states.get(target + '|' + target + '|' + target);
        if (!finalState) return null;

        return list.map((item, index) => ({
            ...item,
            assignedRole: finalState.roles[index]
        }));
    }

    function lcj2BuildAutoArrangedOrder(images, analyses) {
        const list = Array.isArray(images) ? images.slice() : [];
        const packageSize = getPackageSizeFromImages(list);

        if (packageSize !== 3 || list.length < 3 || list.length % 3 !== 0) {
            return {
                images: list,
                changed: false,
                confident: false,
                rows: 0,
                reason: 'not-three-image-package'
            };
        }

        const rows = list.length / 3;
        const rawAnalyses = Array.isArray(analyses) ? analyses : [];
        const items = list.map((src, index) => {
            const analysis = rawAnalyses[index] || {};
            return {
                src,
                index,
                marker: analysis.marker || null,
                hasHistoryMarker: !!analysis.hasHistoryMarker,
                markerConfidence: Number(analysis.markerConfidence) || 0,
                portrait: !!analysis.portrait,
                wideOrCombined: !!analysis.wideOrCombined,
                aspectRatio: Number(analysis.aspectRatio) || 1,
                warmRatio: Number(analysis.warmRatio) || 0,
                strongWarmRatio: Number(analysis.strongWarmRatio) || 0,
                darkRatio: Number(analysis.darkRatio) || 0,
                paleRatio: Number(analysis.paleRatio) || 0,
                historyScore: Number(analysis.historyScore) || -999,
                winScore: Number(analysis.winScore) || -999,
                gameScore: Number(analysis.gameScore) || -999
            };
        });

        const assigned = lcj2AssignScreenshotRolesGlobally(items, rows);
        if (!assigned) {
            return {
                images: list,
                changed: false,
                confident: false,
                rows,
                reason: 'global-role-assignment-failed'
            };
        }

        // Urutan asli di dalam masing-masing jenis dipertahankan.
        // Dengan begitu Paket 1 tetap berpasangan dengan Paket 1 dan Paket 2
        // tetap berpasangan dengan Paket 2, baik LiveChat mengirim urutan normal,
        // terbalik, maupun mengelompokkan gambar berdasarkan jenis.
        const games = assigned
            .filter((item) => item.assignedRole === 'game')
            .sort((a, b) => a.index - b.index);
        const histories = assigned
            .filter((item) => item.assignedRole === 'history')
            .sort((a, b) => a.index - b.index);
        const wins = assigned
            .filter((item) => item.assignedRole === 'win')
            .sort((a, b) => a.index - b.index);

        if (games.length !== rows || histories.length !== rows || wins.length !== rows) {
            return {
                images: list,
                changed: false,
                confident: false,
                rows,
                reason: 'role-count-mismatch'
            };
        }

        const ordered = [];
        for (let row = 0; row < rows; row++) {
            ordered.push(games[row].src, histories[row].src, wins[row].src);
        }

        const changed = ordered.some((src, index) => src !== list[index]);
        const visualConfidence = histories.every((item) =>
            item.darkRatio >= 0.24 || item.hasHistoryMarker
        ) && wins.every((item) =>
            item.warmRatio >= 0.14 || item.strongWarmRatio >= 0.07 || item.paleRatio >= 0.09
        );

        return {
            images: ordered,
            changed,
            confident: ordered.length === list.length,
            visualConfidence,
            rows,
            reason: visualConfidence ? 'global-package-order-exact' : 'global-package-order-deterministic'
        };
    }

    async function lcj2WarmUltraFastScanCache(src) {
        const analysis = await getImageAnalysis(src);
        if (!analysis || !analysis.sourceCanvas || !analysis.marker) return analysis;

        const sourceCanvas = analysis.sourceCanvas;
        const marker = analysis.marker;

        // Siapkan crop utama kode dan preprocessing soft.
        const directWindow = buildDirectMarkerCodeWindow(sourceCanvas, marker);
        if (directWindow) {
            renderPreparedVariant(directWindow, 'soft', false);
        }

        // Siapkan baris atas/bawah crop pertama untuk fallback cepat.
        const rects = buildTransactionCropRects(sourceCanvas, marker);
        if (rects && rects[0]) {
            const cropped = cropCanvas(sourceCanvas, rects[0]);
            const lineRects = findTwoLineRects(cropped);
            if (lineRects && lineRects.length >= 2) {
                const topLine = cropCanvas(cropped, lineRects[0]);
                const bottomLine = cropCanvas(cropped, lineRects[1]);
                renderPreparedVariant(topLine, 'soft', true);
                renderPreparedVariant(bottomLine, 'soft', true);
            }
        }

        // Siapkan crop tanggal/jam utama. OCR belum dijalankan sebelum tombol ditekan.
        const timeCrops = buildClaimTimestampCropCanvases(sourceCanvas, marker);
        if (timeCrops && timeCrops[0]) {
            renderPreparedVariant(timeCrops[0].canvas, 'soft', false);
        }

        return analysis;
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
                try { await lcj2WarmUltraFastScanCache(src); } catch (e) {}
            }
        };
        const prefetchConcurrency = Math.min(
            targets.length,
            LCJ2_CPU_THREADS >= 8 ? 4 : (LCJ2_CPU_THREADS >= 4 ? 3 : 2)
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

    function detectDoubleOrangeMarker(sourceCanvas) {
        const normalized = resizeForMarkerDetection(sourceCanvas);
        const canvas = normalized.canvas;
        const detectionScale = normalized.scale;
        const w = canvas.width;
        const h = canvas.height;
        const scaleUnit = w / 360;

        const left = Math.max(0, Math.floor(w * 0.16));
        const right = Math.min(w, Math.ceil(w * 0.66));
        const top = Math.max(0, Math.floor(h * 0.09));
        const bottom = Math.min(h, Math.ceil(h * 0.86));
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

                    if (yDiff > Math.max(7 * scaleUnit, (a.height + b.height) * 0.38)) continue;
                    if (gap < Math.max(0.5, 0.5 * scaleUnit) || gap > Math.max(31 * scaleUnit, w * 0.075)) continue;
                    if (sizeRatio < 0.34 || heightRatio < 0.34) continue;
                    if (pairAspect < 1.35 || pairAspect > 5.2) continue;

                    const targetX = (a.centerX + b.centerX) / 2;
                    const xPreference = Math.max(0, 18 - Math.abs(targetX - w * 0.31) / Math.max(1, w * 0.025));
                    const closeness = Math.max(0, 27 * scaleUnit - gap) + Math.max(0, 15 * scaleUnit - yDiff * 2);
                    const score = a.shapeScore + b.shapeScore + closeness + (sizeRatio + heightRatio) * 14 + xPreference;

                    const marker = {
                        left: Math.min(a.left, b.left),
                        top: Math.min(a.top, b.top),
                        right: Math.max(a.right, b.right),
                        bottom: Math.max(a.bottom, b.bottom),
                        score,
                        source: 'component-pair'
                    };
                    marker.width = marker.right - marker.left;
                    marker.height = marker.bottom - marker.top;
                    marker.centerX = (marker.left + marker.right) / 2;
                    marker.centerY = (marker.top + marker.bottom) / 2;
                    marker.confidence = Math.max(58, Math.min(99, Math.round(58 + (score - 120) * 0.25)));
                    allMarkers.push(marker);
                }
            }

            // Fallback untuk dua lingkaran yang menyatu akibat kompresi/resizing.
            components.forEach(c => {
                const aspect = c.width / Math.max(1, c.height);
                const density = c.area / Math.max(1, c.width * c.height);
                const minWide = 13 * scaleUnit;
                const maxWide = 72 * scaleUnit;
                const minHigh = 5 * scaleUnit;
                const maxHigh = 34 * scaleUnit;
                if (c.width < minWide || c.width > maxWide || c.height < minHigh || c.height > maxHigh) return;
                if (aspect < 1.45 || aspect > 5.4 || density < 0.045 || density > 0.78) return;

                const limitedRight = Math.min(c.right, c.left + c.height * 3.6);
                const score = 105 + Math.min(32, aspect * 7) + Math.min(20, c.area / Math.max(1, scaleUnit * scaleUnit) * 0.08);
                const marker = {
                    left: c.left,
                    top: c.top,
                    right: limitedRight,
                    bottom: c.bottom,
                    width: limitedRight - c.left,
                    height: c.height,
                    centerX: (c.left + limitedRight) / 2,
                    centerY: (c.top + c.bottom) / 2,
                    score,
                    confidence: Math.max(55, Math.min(91, Math.round(58 + score * 0.18))),
                    source: 'merged-orange-band'
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

        unique.sort((a, b) => {
            const aPair = a.source === 'component-pair' ? 18 : 0;
            const bPair = b.source === 'component-pair' ? 18 : 0;
            return (b.score + bPair) - (a.score + aPair);
        });
        return mapMarkerToSource(unique[0], detectionScale);
    }

    function buildTransactionCropRects(sourceCanvas, marker) {
        const w = sourceCanvas.width;
        const h = sourceCanvas.height;
        const markerH = Math.max(marker.height, w * 0.018, h * 0.010);
        const codeBottom = Math.max(0, marker.top - Math.max(1, markerH * 0.18));
        const codeHeight = Math.max(markerH * 3.15, h * 0.050, w * 0.090);
        const tightTop = Math.max(0, codeBottom - codeHeight);
        const tightLeft = Math.max(Math.floor(w * 0.175), Math.floor(marker.left - w * 0.045));
        const tightRight = Math.min(Math.ceil(w * 0.585), Math.ceil(marker.right + w * 0.205));

        const variants = [
            {
                left: tightLeft,
                top: tightTop,
                width: tightRight - tightLeft,
                height: codeBottom - tightTop,
                name: 'tight'
            },
            {
                left: Math.max(0, tightLeft - w * 0.022),
                top: Math.max(0, tightTop - h * 0.009),
                width: Math.min(w, tightRight + w * 0.030) - Math.max(0, tightLeft - w * 0.022),
                height: Math.min(h, codeBottom + h * 0.004) - Math.max(0, tightTop - h * 0.009),
                name: 'wide'
            },
            {
                left: Math.max(0, w * 0.17),
                top: Math.max(0, codeBottom - Math.max(codeHeight * 1.22, h * 0.065)),
                width: Math.min(w, w * 0.61) - Math.max(0, w * 0.17),
                height: codeBottom - Math.max(0, codeBottom - Math.max(codeHeight * 1.22, h * 0.065)),
                name: 'fallback-column'
            }
        ];

        return variants.filter(r => r.width >= Math.max(55, w * 0.16) && r.height >= Math.max(22, h * 0.025));
    }


    function buildDirectMarkerCodeWindow(sourceCanvas, marker) {
        if (!sourceCanvas || !marker) return null;

        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const markerHeight = Math.max(
            8,
            Number(marker.height) || (Number(marker.bottom) - Number(marker.top)) || 0,
            width * 0.012,
            height * 0.007
        );

        // Koordinat dibuat relatif terhadap marker dua bulatan.
        // Batas kanan dijaga agar tidak masuk ke kolom Taruhan/Surplus.
        const left = Math.max(
            0,
            Math.floor(width * 0.17),
            Math.floor(marker.left - width * 0.030)
        );
        const right = Math.min(
            width,
            Math.ceil(width * 0.50),
            Math.ceil(marker.right + width * 0.100)
        );

        // Ambil dua baris transaksi tepat di atas marker dan hentikan crop
        // beberapa piksel sebelum marker agar ikon/teks 1+11 tidak ikut OCR.
        const top = Math.max(
            0,
            Math.floor(
                marker.top -
                Math.max(markerHeight * 1.85, height * 0.030)
            )
        );
        const bottom = Math.max(
            top + 8,
            Math.floor(
                marker.top -
                Math.max(markerHeight * 0.15, height * 0.0025)
            )
        );

        if (right - left < Math.max(70, width * 0.12)) return null;
        if (bottom - top < Math.max(18, height * 0.014)) return null;

        return cropCanvas(sourceCanvas, {
            left,
            top,
            width: right - left,
            height: bottom - top,
            name: 'direct-marker-code-window'
        });
    }

    function buildBetOddsCropCanvas(sourceCanvas, marker) {
        if (!sourceCanvas || !marker) return null;

        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const markerHeight = Math.max(
            8,
            Number(marker.height) || (Number(marker.bottom) - Number(marker.top)) || 0,
            width * 0.012,
            height * 0.007
        );

        const left = Math.max(0, Math.floor(width * 0.545), Math.floor(marker.right + width * 0.115));
        const right = Math.min(width, Math.ceil(width * 0.765), Math.ceil(marker.right + width * 0.355));
        const top = Math.max(0, Math.floor(marker.top - Math.max(markerHeight * 1.85, height * 0.030)));
        const bottom = Math.max(top + 8, Math.floor(marker.top - Math.max(markerHeight * 0.15, height * 0.0025)));

        if (right - left < Math.max(45, width * 0.08)) return null;
        if (bottom - top < Math.max(15, height * 0.012)) return null;

        return cropCanvas(sourceCanvas, {
            left,
            top,
            width: right - left,
            height: bottom - top,
            name: 'bet-odds-window'
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

        if (first.value >= LCJ2_MIN_BET_ODDS) {
            return { value: first.value, belowMin: false };
        }

        // Nilai di bawah 1,60 diverifikasi sekali agar notifikasi tidak salah.
        try {
            const second = await runPass('strong');
            if (second && Math.abs(second.value - first.value) < 0.011) {
                return { value: first.value, belowMin: true };
            }
            if (second && second.value >= LCJ2_MIN_BET_ODDS) {
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
        const markerHeight = Math.max(
            8,
            Number(marker.height) || (Number(marker.bottom) - Number(marker.top)) || 0,
            width * 0.012,
            height * 0.007
        );
        const rowTop = Math.max(0, Math.floor(marker.top - Math.max(markerHeight * 3.25, height * 0.052)));
        const rowBottom = Math.min(height, Math.ceil(marker.top + Math.max(markerHeight * 0.42, height * 0.008)));
        const leftColumnRight = Math.min(
            width,
            Math.max(width * 0.24, Math.min(width * 0.38, marker.left + width * 0.035))
        );
        const variants = [
            {
                name: 'image-2-row-left',
                left: 0,
                top: rowTop,
                width: leftColumnRight,
                height: rowBottom - rowTop
            },
            {
                name: 'image-2-row-wide',
                left: 0,
                top: Math.max(0, rowTop - height * 0.018),
                width: Math.min(width, width * 0.58),
                height: Math.min(height, rowBottom + height * 0.018) - Math.max(0, rowTop - height * 0.018)
            },
            {
                name: 'image-2-history-upper',
                left: 0,
                top: Math.max(0, marker.top - height * 0.19),
                width: Math.min(width, width * 0.62),
                height: Math.min(height * 0.22, marker.top + height * 0.015) - Math.max(0, marker.top - height * 0.19)
            },
            {
                name: 'image-2-row-full',
                left: 0,
                top: Math.max(0, rowTop - height * 0.025),
                width,
                height: Math.min(height, rowBottom + height * 0.025) - Math.max(0, rowTop - height * 0.025)
            }
        ];
        return variants
            .filter((rect) => rect.width >= 70 && rect.height >= 20)
            .map((rect) => ({ name: rect.name, canvas: cropCanvas(sourceCanvas, rect) }));
    }

    async function lcj2SetTimestampOcrMode(worker) {
        await worker.setParameters({
            tessedit_char_whitelist: LCJ2_TIMESTAMP_OCR_WHITELIST,
            preserve_interword_spaces: '1',
            classify_bln_numeric_mode: '0'
        });
    }

    async function lcj2RestoreNumericOcrMode(worker) {
        try {
            await worker.setParameters({
                tessedit_char_whitelist: LCJ2_NUMERIC_OCR_WHITELIST,
                preserve_interword_spaces: '1',
                classify_bln_numeric_mode: '1'
            });
        } catch (e) {}
    }

    function buildTimezoneCropCanvases(sourceCanvas, marker) {
        if (!sourceCanvas) return [];
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const rects = [
            // Zona waktu dapat berada pada header, kanan atas, samping, atau footer.
            { name: 'timezone-top', left: 0, top: 0, width, height: Math.max(40, height * 0.30) },
            { name: 'timezone-top-left', left: 0, top: 0, width: width * 0.60, height: Math.max(40, height * 0.40) },
            { name: 'timezone-top-right', left: width * 0.36, top: 0, width: width * 0.64, height: Math.max(40, height * 0.42) },
            { name: 'timezone-middle-right', left: width * 0.48, top: height * 0.20, width: width * 0.52, height: height * 0.48 },
            { name: 'timezone-bottom', left: 0, top: height * 0.68, width, height: height * 0.32 },
            { name: 'timezone-full', left: 0, top: 0, width, height }
        ];

        if (marker) {
            const markerHeight = Math.max(8, Number(marker.height) || 0, height * 0.008);
            const top = Math.max(0, marker.top - Math.max(markerHeight * 4.2, height * 0.075));
            const bottom = Math.min(height, marker.top + Math.max(markerHeight * 1.2, height * 0.025));
            rects.unshift({
                name: 'timezone-transaction-row',
                left: 0,
                top,
                width,
                height: Math.max(30, bottom - top)
            });
        }

        return rects
            .filter((rect) => rect.width >= 80 && rect.height >= 25)
            .map((rect) => ({ name: rect.name, canvas: cropCanvas(sourceCanvas, rect) }));
    }

    async function readExplicitTimezoneOffsetFromImage(sourceCanvas, marker, worker, knownRawParts) {
        const combinedKnownText = (knownRawParts || []).join('\n');
        const knownOffset = lcj2FindExplicitGmtOffsetMinutes(combinedKnownText);
        if (knownOffset != null) {
            return { offsetMinutes: knownOffset, rawText: combinedKnownText, source: 'timestamp-raw' };
        }

        if (sourceCanvas && lcj2TimezoneOffsetCache.has(sourceCanvas)) {
            return lcj2TimezoneOffsetCache.get(sourceCanvas);
        }

        const crops = buildTimezoneCropCanvases(sourceCanvas, marker);
        let resultInfo = null;

        // Jalur cepat: satu pass soft pada area yang paling sering menyimpan GMT.
        // Otsu dan full-image hanya dijalankan bila zona belum ditemukan.
        const passPlan = [];
        const preferredNames = [
            'timezone-transaction-row',
            'timezone-top',
            'timezone-top-right',
            'timezone-top-left',
            'timezone-bottom'
        ];

        preferredNames.forEach((name) => {
            const index = crops.findIndex((item) => item.name === name);
            if (index >= 0) passPlan.push({ index, mode: 'soft', psm: 11 });
        });

        ['timezone-top', 'timezone-top-right', 'timezone-bottom'].forEach((name) => {
            const index = crops.findIndex((item) => item.name === name);
            if (index >= 0) passPlan.push({ index, mode: 'otsu', psm: 6 });
        });

        const fullIndex = crops.findIndex((item) => item.name === 'timezone-full');
        if (fullIndex >= 0) {
            passPlan.push({ index: fullIndex, mode: 'soft', psm: 11 });
            passPlan.push({ index: fullIndex, mode: 'otsu', psm: 6 });
        }

        const usedPassKeys = new Set();
        for (const pass of passPlan) {
            if (resultInfo) break;
            const item = crops[pass.index];
            if (!item) continue;
            const key = item.name + '|' + pass.mode + '|' + pass.psm;
            if (usedPassKeys.has(key)) continue;
            usedPassKeys.add(key);

            try {
                const prepared = renderPreparedVariant(item.canvas, pass.mode, false);
                const result = await recognizePrepared(worker, prepared, pass.psm);
                const raw = String(result && result.data && result.data.text || '');
                const offset = lcj2FindExplicitGmtOffsetMinutes(raw);
                if (offset != null) {
                    resultInfo = {
                        offsetMinutes: offset,
                        rawText: raw,
                        source: item.name + '-' + pass.mode + '-psm' + pass.psm
                    };
                }
            } catch (e) {}
        }

        if (!resultInfo) {
            resultInfo = {
                offsetMinutes: null,
                rawText: combinedKnownText,
                source: 'not-detected'
            };
        }

        if (sourceCanvas) lcj2TimezoneOffsetCache.set(sourceCanvas, resultInfo);
        return resultInfo;
    }

    async function readClaimTimestampFromSecondImage(sourceCanvas, marker, worker, fallbackPeriod, existingText) {
        const rawParts = [];
        let bestTimestamp = null;
        let explicitTimezone = null;
        let timestampModeActive = false;

        const considerRawText = (raw, sourceName, confidence) => {
            const textValue = String(raw || '');
            if (textValue) rawParts.push((sourceName || 'ocr') + '\n' + textValue);

            const zone = lcj2FindExplicitGmtOffsetMinutes(textValue);
            if (zone != null) {
                explicitTimezone = {
                    offsetMinutes: zone,
                    rawText: textValue,
                    source: sourceName || 'ocr'
                };
            }

            const parsed = lcj2ParseImageTimestampText(textValue, fallbackPeriod);
            if (parsed && parsed.hasTime && parsed.source !== 'period-date-fallback') {
                parsed.source = sourceName || parsed.source;
                parsed.confidence = Number(confidence) || parsed.confidence || 0;
                if (!bestTimestamp || (parsed.confidence || 0) > (bestTimestamp.confidence || 0)) {
                    bestTimestamp = parsed;
                }
            }
        };

        // Teks OCR periode dapat memberi tanggal/jam, tetapi TIDAK boleh langsung
        // dipakai sebelum zona waktu gambar diperiksa.
        considerRawText(existingText || '', 'existing-ocr', 0);

        const crops = buildClaimTimestampCropCanvases(sourceCanvas, marker);

        const runTimestampPass = async (item, psm, mode) => {
            try {
                const prepared = renderPreparedVariant(item.canvas, mode, false);
                const result = await recognizePrepared(worker, prepared, psm);
                const raw = String(result && result.data && result.data.text || '');
                considerRawText(raw, item.name + '-psm' + psm, Number(result && result.data && result.data.confidence) || 0);
                return true;
            } catch (e) {
                return false;
            }
        };

        try {
            await lcj2SetTimestampOcrMode(worker);
            timestampModeActive = true;

            // Jalur cepat tanggal/jam.
            const primaryLimit = Math.min(3, crops.length);
            for (let i = 0; i < primaryLimit; i++) {
                await runTimestampPass(crops[i], 6, 'soft');
                if (bestTimestamp && explicitTimezone) break;
            }

            if ((!bestTimestamp || !explicitTimezone) && crops[0]) {
                await runTimestampPass(crops[0], 11, 'otsu');
            }

            if ((!bestTimestamp || !explicitTimezone) && crops.length > 3) {
                await runTimestampPass(crops[3], 6, 'soft');
            }

            // Pemeriksaan zona waktu wajib. Ini yang mencegah GMT+8 dianggap GMT+7.
            if (!explicitTimezone) {
                explicitTimezone = await readExplicitTimezoneOffsetFromImage(
                    sourceCanvas,
                    marker,
                    worker,
                    rawParts
                );
                if (explicitTimezone && explicitTimezone.rawText) {
                    rawParts.push(explicitTimezone.source + '\n' + explicitTimezone.rawText);
                }
            }
        } finally {
            if (timestampModeActive) await lcj2RestoreNumericOcrMode(worker);
        }

        if (!bestTimestamp) {
            bestTimestamp = lcj2ParseImageTimestampText(rawParts.join('\n---\n'), fallbackPeriod);
        }

        if (!bestTimestamp) {
            return lcj2ParseImageTimestampText('', fallbackPeriod);
        }

        if (
            explicitTimezone &&
            explicitTimezone.offsetMinutes != null &&
            bestTimestamp.hasTime
        ) {
            lcj2ApplySourceGmtOffset(
                bestTimestamp,
                explicitTimezone.offsetMinutes,
                explicitTimezone.rawText
            );
            bestTimestamp.timezoneDetectionSource = explicitTimezone.source;
        }

        // Jika label zona tidak berhasil dibaca, pertahankan GMT+7 sebagai fallback,
        // tetapi tandai agar operator dapat melihat bahwa zona tidak eksplisit.
        if (!bestTimestamp.timezoneExplicit) {
            bestTimestamp.sourceGmtOffsetMinutes = 7 * 60;
            bestTimestamp.sourceGmtLabel = 'GMT+7';
            bestTimestamp.normalizedGmtLabel = 'GMT+7';
            bestTimestamp.timezoneAdjusted = false;
            bestTimestamp.timezoneExplicit = false;
            bestTimestamp.timezoneDetectionSource = 'fallback-gmt7';
        }

        return bestTimestamp;
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
        // Turbo Scan:
        // Crop kecil tetap diperbesar, tetapi gambar yang sudah besar tidak lagi
        // dipaksa membesar 3,2x. Perubahan ini mengurangi jumlah piksel OCR secara besar.
        const targetHeight = lineMode ? 86 : 146;
        const sourceHeight = Math.max(1, Number(source && source.height) || 1);
        const wantedScale = targetHeight / sourceHeight;
        const minScale = lineMode ? 0.84 : 0.50;
        const maxScale = lineMode ? 4.4 : 2.6;
        return Math.max(minScale, Math.min(maxScale, wantedScale));
    }
    function renderPreparedVariant(source, mode, lineMode) {
        const cacheKey = lineMode ? 'line' : 'combined';
        const variantKey = 'variant-' + cacheKey + '-' + String(mode || 'soft');
        let cache = lcj2PreparedBaseCache.get(source);
        if (!cache) {
            cache = {};
            lcj2PreparedBaseCache.set(source, cache);
        }

        // Hasil canvas akhir disimpan. Pass berikutnya dengan crop/mode yang sama
        // tidak perlu menghitung grayscale, threshold, dan border lagi.
        if (cache[variantKey]) return cache[variantKey];

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
        const finalCanvas = addWhiteBorder(out, lineMode ? 13 : 11);
        cache[variantKey] = finalCanvas;
        return finalCanvas;
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
        const glyphInfo = findDigitGlyphBoxes(bottomLine, LCJ2_EXPECTED_BOTTOM_LENGTH);
        if (glyphInfo && glyphInfo.boxes && glyphInfo.boxes.length === LCJ2_EXPECTED_BOTTOM_LENGTH) {
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
            const projectedRect = detectTightDigitRowRect(otsu, LCJ2_EXPECTED_BOTTOM_LENGTH);
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


    let lcj2DigitTemplateBank = null;

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
        if (lcj2DigitTemplateBank) return lcj2DigitTemplateBank;

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
                        console.warn('[LCJ2 template font gagal]', fontFamily, fontWeight, err);
                    }
                });
            });
        }

        lcj2DigitTemplateBank = bank;
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
        if (digits.length !== LCJ2_EXPECTED_BOTTOM_LENGTH) {
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
            LCJ2_EXPECTED_BOTTOM_LENGTH
        );

        if (
            !binary ||
            !binary.boxes ||
            binary.boxes.length !== LCJ2_EXPECTED_BOTTOM_LENGTH
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
        if (digits.length !== LCJ2_EXPECTED_BOTTOM_LENGTH) {
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

        const binary = findDigitGlyphBoxes(lineCanvas, LCJ2_EXPECTED_BOTTOM_LENGTH);
        if (!binary || !binary.boxes || binary.boxes.length !== LCJ2_EXPECTED_BOTTOM_LENGTH) {
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
        if (digits.length !== LCJ2_EXPECTED_BOTTOM_LENGTH) {
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

        const binary = findDigitGlyphBoxes(lineCanvas, LCJ2_EXPECTED_BOTTOM_LENGTH);
        if (!binary || !binary.boxes || binary.boxes.length !== LCJ2_EXPECTED_BOTTOM_LENGTH) {
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
        if (digits.length === LCJ2_EXPECTED_TOP_LENGTH && /^20\d{7}$/.test(digits)) out.push({ value: digits, correction: 0 });
        for (let i = 0; i + LCJ2_EXPECTED_TOP_LENGTH <= digits.length; i++) {
            const part = digits.slice(i, i + LCJ2_EXPECTED_TOP_LENGTH);
            if (/^20\d{7}$/.test(part)) out.push({ value: part, correction: digits.length === LCJ2_EXPECTED_TOP_LENGTH ? 0 : 1 });
        }
        return out;
    }

    function bottomCandidatesFromDigits(digits) {
        digits = onlyDigits(digits);
        const out = [];
        if (!digits) return out;

        if (digits.length === LCJ2_EXPECTED_BOTTOM_LENGTH) {
            out.push({ value: digits, correction: 0 });
        } else if (digits.length === LCJ2_EXPECTED_BOTTOM_LENGTH - 1) {
            // Tesseract sangat sering membuang angka nol pertama pada baris kedua.
            out.push({ value: '0' + digits, correction: 1 });
        } else if (digits.length === LCJ2_EXPECTED_BOTTOM_LENGTH - 2) {
            out.push({ value: '00' + digits, correction: 2 });
        }

        if (digits.length > LCJ2_EXPECTED_BOTTOM_LENGTH) {
            for (let i = 0; i + LCJ2_EXPECTED_BOTTOM_LENGTH <= digits.length; i++) {
                const part = digits.slice(i, i + LCJ2_EXPECTED_BOTTOM_LENGTH);
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
        const currentPsm = lcj2WorkerPsmByWorker.get(worker);
        if (currentPsm !== psmValue) {
            await worker.setParameters({ tessedit_pageseg_mode: psmValue });
            lcj2WorkerPsmByWorker.set(worker, psmValue);
            if (worker === lcj2SharedWorker) lcj2WorkerPsm = psmValue;
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

        if (compact.length >= LCJ2_EXPECTED_FULL_LENGTH) {
            for (let i = 0; i + LCJ2_EXPECTED_FULL_LENGTH <= compact.length; i++) {
                const full = compact.slice(i, i + LCJ2_EXPECTED_FULL_LENGTH);
                const top = full.slice(0, LCJ2_EXPECTED_TOP_LENGTH);
                const bottom = full.slice(LCJ2_EXPECTED_TOP_LENGTH);
                if (/^20\d{7}$/.test(top)) {
                    addVote(topVotes, { value: top, correction: 0 }, confidence, sourceWeight + 0.35, label + '-full');
                    addVote(bottomVotes, { value: bottom, correction: 0 }, confidence, sourceWeight + 0.35, label + '-full');
                }
            }
        }
    }

    function lcj2ExtractExactDirectPeriod(result) {
        const data = result && result.data ? result.data : {};
        const confidence = Number(data.confidence) || 0;
        const lines = String(data.text || '')
            .split(/\r?\n/)
            .map(onlyDigits)
            .filter(Boolean);

        const topValues = [];
        const bottomValues = [];

        lines.forEach((digits) => {
            if (/^20\d{7}$/.test(digits)) topValues.push(digits);
            if (/^\d{10}$/.test(digits)) bottomValues.push(digits);
        });

        // Cadangan ketika Tesseract menyatukan dua baris menjadi 19 digit.
        const compact = onlyDigits(data.text || '');
        for (let i = 0; i + LCJ2_EXPECTED_FULL_LENGTH <= compact.length; i++) {
            const full = compact.slice(i, i + LCJ2_EXPECTED_FULL_LENGTH);
            const top = full.slice(0, LCJ2_EXPECTED_TOP_LENGTH);
            const bottom = full.slice(LCJ2_EXPECTED_TOP_LENGTH);
            if (/^20\d{7}$/.test(top) && /^\d{10}$/.test(bottom)) {
                topValues.push(top);
                bottomValues.push(bottom);
            }
        }

        const uniqueTop = uniqueStrings(topValues);
        const uniqueBottom = uniqueStrings(bottomValues);

        // Satu-pass hanya boleh dipakai bila tidak ada kandidat lain yang bersaing.
        if (uniqueTop.length !== 1 || uniqueBottom.length !== 1) return null;

        return {
            top: uniqueTop[0],
            bottom: uniqueBottom[0],
            period: uniqueTop[0] + uniqueBottom[0],
            confidence
        };
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
        // Turbo Stabil: Tesseract sudah berjalan di Web Worker. Browser hanya diberi
        // kesempatan render setiap enam tahap agar tidak ada jeda pada setiap pass.
        lcj2DashboardYieldCounter++;
        if (lcj2DashboardYieldCounter % 12 !== 0) return Promise.resolve();
        return new Promise(resolve => setTimeout(resolve, 0));
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
        let singlePassFastPeriod = null;
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
                console.warn('[LCJ2 line OCR gagal]', err);
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
                console.warn('[LCJ2 combined OCR gagal]', err);
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

                    // ULTRA FAST ONE-PASS:
                    // Bila satu pembacaan menghasilkan tepat satu kode 9 digit dan
                    // satu kode 10 digit tanpa kandidat pesaing, hasil langsung dikunci.
                    const onePass = lcj2ExtractExactDirectPeriod(result);
                    if (
                        onePass &&
                        onePass.confidence >= 72 &&
                        (marker.confidence || 0) >= 64
                    ) {
                        singlePassFastPeriod = onePass;
                        lockedBottomValue = onePass.bottom;

                        // Tambahkan vote dominan dari satu crop direct yang sangat jelas.
                        for (let voteIndex = 0; voteIndex < 3; voteIndex++) {
                            addVote(
                                topVotes,
                                { value: onePass.top, correction: 0 },
                                onePass.confidence,
                                14.0,
                                'direct-one-pass-top-' + (voteIndex + 1)
                            );
                            addVote(
                                bottomVotes,
                                { value: onePass.bottom, correction: 0 },
                                onePass.confidence,
                                14.0,
                                'direct-one-pass-bottom-' + (voteIndex + 1)
                            );
                        }

                        reads.push({
                            value: onePass.bottom,
                            confidence: onePass.confidence,
                            mode: pass.mode,
                            psm: pass.psm
                        });
                        passWinners.push({
                            value: onePass.bottom,
                            confidence: onePass.confidence,
                            mode: pass.mode,
                            psm: pass.psm
                        });

                        rawTexts.push(
                            '[ULTRA FAST ONE PASS]\n' +
                            onePass.period +
                            ' | confidence=' + Math.round(onePass.confidence) + '%' +
                            ' | marker=' + Math.round(marker.confidence || 0) + '%'
                        );
                        break;
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
                        '[LCJ2 direct marker OCR gagal]',
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

            if (singlePassFastPeriod) {
                directMarkerLockLog.push({
                    locked: true,
                    singlePass: true,
                    value: singlePassFastPeriod.bottom,
                    top: singlePassFastPeriod.top,
                    period: singlePassFastPeriod.period,
                    avgConfidence: singlePassFastPeriod.confidence,
                    sources: ['direct-one-pass']
                });
                return {
                    value: singlePassFastPeriod.bottom,
                    count: 1,
                    avgConfidence: singlePassFastPeriod.confidence,
                    singlePass: true
                };
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
                    console.warn('[LCJ2 tight bottom OCR gagal]', err);
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

        const isSoftPairFastReliable = (picked) => {
            if (!picked || !picked.period || !picked.top || !picked.bottom) return false;
            if (picked.top.correction !== 0 || picked.bottom.correction !== 0) return false;
            if (!/^20\d{7}$/.test(picked.top.value || '')) return false;
            if (!/^\d{10}$/.test(picked.bottom.value || '')) return false;
            return (
                (picked.top.avgConfidence || 0) >= 64 &&
                (picked.bottom.avgConfidence || 0) >= 64 &&
                (marker.confidence || 0) >= 62 &&
                picked.confidence >= 73
            );
        };

        const isDirectLockFastReliable = (picked) => {
            if (!lockedBottomValue || !picked.period || !picked.top || !picked.bottom) return false;
            if (picked.bottom.value !== lockedBottomValue) return false;
            if (picked.top.correction !== 0 || picked.bottom.correction !== 0) return false;
            if (!/^20\d{7}$/.test(picked.top.value || '')) return false;
            return (
                (picked.top.avgConfidence || 0) >= 62 &&
                (marker.confidence || 0) >= 58 &&
                picked.confidence >= 66
            );
        };

        await runDirectMarkerBottomLock();

        // TURBO FAST PATH: dua pass direct-marker sudah membaca dua baris.
        // Bila 10 digit bawah terkunci dan 9 digit atas juga sepakat kuat,
        // langsung selesai tanpa OCR crop baris atas tambahan.
        let directFast = chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
        if (
            singlePassFastPeriod &&
            directFast.period === singlePassFastPeriod.period
        ) {
            return makeReturn(directFast);
        }

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

            let current = chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
            current = applyAmbiguousDigitGeometry(bottomLine, current, rect.name + '/soft');

            // Bila dua baris soft sudah exact dan jelas, jangan jalankan 2–3 pass
            // tight consensus tambahan.
            if (isDirectLockFastReliable(current) || isSoftPairFastReliable(current)) {
                return makeReturn(current);
            }

            await runTightBottomConsensus(bottomLine, rect.name + '/bawah-10-digit');
            current = chooseFinalPeriod(topVotes, bottomVotes, usedPasses);
            current = applyAmbiguousDigitGeometry(bottomLine, current, rect.name + '/tight');

            if (isDirectLockFastReliable(current) || isSoftPairFastReliable(current)) {
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

    async function ocrImagePeriod(src, onProgress) {
        const cacheKey = String(src || '');
        const cachedResult = lcj2PeriodResultCache.get(cacheKey);
        if (cachedResult && cachedResult.period) {
            lcj2PeriodResultCache.delete(cacheKey);
            lcj2PeriodResultCache.set(cacheKey, cachedResult);
            if (onProgress) onProgress('Hasil periode tersedia di cache cepat.');
            return { ...cachedResult, cached: true };
        }

        // Muat gambar/marker dan kedua worker secara paralel.
        // Worker metadata bersifat opsional; perangkat ringan tetap memakai jalur lama.
        const [analysis, worker, metadataWorker, timestampWorker] = await Promise.all([
            getImageAnalysis(src),
            getSharedOCRWorker(onProgress),
            getMetadataOCRWorker().catch(() => null),
            getTimestampOCRWorker().catch(() => null)
        ]);
        const sourceCanvas = analysis.sourceCanvas;
        const marker = analysis.marker;

        if (!marker) {
            return {
                period: '',
                text: '',
                confidence: 0,
                markerFound: false,
                source: 'strict-double-marker-v55',
                error: 'Dua tanda bulat belum terdeteksi. Versi ini sudah menormalkan gambar besar, tetapi marker tetap tidak ditemukan.'
            };
        }

        if (onProgress) {
            onProgress(
                'Dua tanda bulat ditemukan • metode ' + marker.source +
                ' • posisi Y ' + Math.round(marker.centerY) +
                ' • lock ' + marker.confidence + '%'
            );
        }

        // V5.7.7 TURBO: metadata dimulai bersamaan dengan OCR periode.
        // Ini tidak mengubah sumber gambar atau aturan validasi; hanya menghilangkan
        // antrean berurutan antara periode, taruhan, dan tanggal/jam.
        const focusedPromise = ocrMarkerLockedCode(sourceCanvas, marker, worker, onProgress);
        const metadataPromise = metadataWorker
            ? (async () => {
                // CPU kuat: taruhan dan timestamp diproses benar-benar bersamaan.
                // CPU ringan: tetap berurutan pada satu worker seperti versi lama.
                if (timestampWorker) {
                    const [betInfo, claimTimestamp] = await Promise.all([
                        readBetOddsForNotification(sourceCanvas, marker, metadataWorker),
                        readClaimTimestampFromSecondImage(sourceCanvas, marker, timestampWorker, '', '')
                    ]);
                    return { betInfo, claimTimestamp };
                }
                const betInfo = await readBetOddsForNotification(sourceCanvas, marker, metadataWorker);
                const claimTimestamp = await readClaimTimestampFromSecondImage(
                    sourceCanvas, marker, metadataWorker, '', ''
                );
                return { betInfo, claimTimestamp };
            })().catch(() => ({
                betInfo: { value: null, belowMin: false },
                claimTimestamp: null
            }))
            : null;

        const focused = await focusedPromise;
        let betInfo;
        let claimTimestamp;

        if (metadataPromise) {
            const metadata = await metadataPromise;
            betInfo = metadata.betInfo || { value: null, belowMin: false };
            claimTimestamp = metadata.claimTimestamp || null;

            // Gunakan periode/teks worker utama sebagai fallback tanpa OCR tambahan.
            if (!claimTimestamp || !claimTimestamp.hasTime) {
                const parsedFallback = lcj2ParseImageTimestampText(
                    focused.text || '',
                    focused.period || ''
                );
                if (parsedFallback) claimTimestamp = parsedFallback;
            }

            // Jalur aman: hanya bila worker turbo tidak memperoleh metadata lengkap,
            // ulangi bagian yang gagal dengan worker utama setelah periode selesai.
            // Dengan demikian hasil V5.7.6 tetap dipertahankan pada gambar yang sulit.
            if (focused.period && (!betInfo || betInfo.value == null)) {
                betInfo = await readBetOddsForNotification(sourceCanvas, marker, worker);
            }
            if (!claimTimestamp || !claimTimestamp.hasTime) {
                const safeTimestamp = await readClaimTimestampFromSecondImage(
                    sourceCanvas,
                    marker,
                    worker,
                    focused.period || '',
                    focused.text || ''
                );
                if (safeTimestamp) claimTimestamp = safeTimestamp;
            }
        } else {
            // Jalur kompatibilitas perangkat ringan: sama seperti versi sebelumnya.
            betInfo = focused.period
                ? await readBetOddsForNotification(sourceCanvas, marker, worker)
                : { value: null, belowMin: false };
            claimTimestamp = await readClaimTimestampFromSecondImage(
                sourceCanvas,
                marker,
                worker,
                focused.period || '',
                focused.text || ''
            );
        }

        let finalResult;
        if (!focused.period && LCJ2_STRICT_DOUBLE_MARKER) {
            const topInfo = focused.debugTop ? ' atas=' + focused.debugTop : '';
            const bottomInfo = focused.debugBottom ? ' bawah=' + focused.debugBottom : '';
            finalResult = {
                period: '',
                text: focused.text || '',
                confidence: 0,
                markerFound: true,
                markerConfidence: marker.confidence,
                marker,
                preview: focused.preview || '',
                passes: focused.passes || 0,
                source: 'strict-double-marker-v55',
                error: 'Marker terkunci, tetapi pasangan 9+10 digit belum lengkap.' + topInfo + bottomInfo
            };
        } else {
            finalResult = {
                period: focused.period || '',
                text: focused.text || '',
                confidence: focused.confidence || 0,
                markerFound: true,
                markerConfidence: marker.confidence,
                marker,
                preview: focused.preview || '',
                passes: focused.passes || 0,
                source: 'double-marker-row-lock-v45',
                error: focused.period ? '' : 'Kode belum terbaca.'
            };
        }

        finalResult.betOdds = betInfo.value;
        finalResult.betBelowMin = !!betInfo.belowMin;
        finalResult.claimTimestamp = claimTimestamp || null;
        finalResult.claimTimestampText = claimTimestamp ? lcj2FormatClaimTimestamp(claimTimestamp) : '';

        if (finalResult.period) {
            lcj2PeriodResultCache.set(cacheKey, finalResult);
            trimFastCache(lcj2PeriodResultCache, LCJ2_RESULT_CACHE_LIMIT);
        }
        return finalResult;
    }

    function openTool() {
        const dailyAccess = lcj2GetDailyAccessState();
        if (!dailyAccess.active) {
            lcj2RefreshDailyLamp();
            lcj2ShowLampMessage('KEMBALI LAGI BESOK', 3200);
            return;
        }

        injectStyle();
        const old = document.getElementById('lcj2-panel-fixed');
        if (old) old.remove();

        const scan = scanPage();
        const db = getAccountDB();
        const saved = db[scan.userId] || { nama: '', rek: '' };
        const defaultNama = lcj2CleanAccountName(saved.nama) || 'NAMA USER';
        const defaultRek = saved.rek || 'NO REKENING';
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
                html += '<input class="lcj2-input lcj2-period-input" id="lcj2-prd-' + i + '" data-lcj2-period-row="' + i + '" placeholder="' + cssEscapeText(inputPlaceholder) + '" value="' + cssEscapeText(val) + '"' + (hasError ? ' style="border-color:rgba(251,79,104,.45);color:#ffb7c5"' : '') + '>';
            }
            return html || '<input class="lcj2-input lcj2-period-input" id="lcj2-prd-0" data-lcj2-period-row="0" placeholder="Periode Paket 1" value="MENUNGGU OCR 1">';
        }

        const panel = document.createElement('div');
        panel.id = 'lcj2-panel-fixed';
        panel.innerHTML = `
            <div class="lcj2-wrap lcj2-nova-shell">
                <header class="lcj2-topbar lcj2-nova-topbar">
                    <div class="lcj2-brand">
                        <div class="lcj2-brand-logo lcj2-nova-logo" aria-hidden="true">
                            <svg viewBox="0 0 56 56" fill="none">
                                <path d="M15 22v-6a3 3 0 0 1 3-3h6M32 13h6a3 3 0 0 1 3 3v6M41 34v6a3 3 0 0 1-3 3h-6M24 43h-6a3 3 0 0 1-3-3v-6"/>
                                <circle cx="28" cy="28" r="9"/>
                                <circle cx="28" cy="28" r="3"/>
                                <path d="M18 28h20"/>
                            </svg>
                        </div>
                        <div class="lcj2-nova-brand-copy">
                            <div class="lcj2-nova-eyebrow">OCR CLAIM JAM 2 • SCRIPT TERPISAH</div>
                            <h3 class="lcj2-title">OCR Claim Jam 2 <span class="lcj2-version">1.5.0</span></h3>
                            <div class="lcj2-subtitle">Ultra Fast Scan • aktif setiap hari pukul 23.50–02.00 WIB</div>
                        </div>
                    </div>
                    <div class="lcj2-nova-top-actions">
                        <div class="lcj2-nova-live-chip"><span></span> AKTIF 23.50–02.00 WIB</div>
                        <button class="lcj2-btn red lcj2-nova-close" id="lcj2-close" type="button">TUTUP <b>×</b></button>
                    </div>
                </header>

                <section class="lcj2-nova-hero">
                    <div class="lcj2-status-card lcj2-nova-status" id="lcj2-status-card">
                        <div class="lcj2-status-icon lcj2-nova-status-icon">
                            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
                                <path d="M7 12V8a1 1 0 0 1 1-1h4M20 7h4a1 1 0 0 1 1 1v4M25 20v4a1 1 0 0 1-1 1h-4M12 25H8a1 1 0 0 1-1-1v-4"/>
                                <path d="M10 16h12"/><circle cx="13" cy="13" r="1"/><circle cx="19" cy="13" r="1"/>
                            </svg>
                        </div>
                        <div class="lcj2-status-content">
                            <div class="lcj2-status-title">Aktivitas Pemindaian • Mode Jam 2</div>
                            <div class="lcj2-ocr-box" id="lcj2-ocr-status">Menyiapkan pemindaian chat aktif...</div>
                        </div>
                        <div class="lcj2-progress"><span id="lcj2-progress-bar"></span></div>
                    </div>
                    <div class="lcj2-nova-identity">
                        <div class="lcj2-nova-stat ${scan.marker ? 'ok' : 'bad'}">
                            <span class="lcj2-nova-stat-label">CHAT MARKER</span>
                            <strong id="lcj2-marker-text">${cssEscapeText(scan.markerText)}</strong>
                        </div>
                        <div class="lcj2-nova-stat user">
                            <span class="lcj2-nova-stat-label">USER ID</span>
                            <div class="lcj2-nova-user-line">
                                <input class="lcj2-user-edit" id="lcj2-user-text" type="text" value="${cssEscapeText(scan.userId)}" autocomplete="off" spellcheck="false" aria-label="Edit User ID">
                                <button class="lcj2-inline-copy" id="lcj2-copy-user" type="button" title="Copy User ID" aria-label="Copy User ID">
                                    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 7V5.75A2.75 2.75 0 0 1 10.75 3h7.5A2.75 2.75 0 0 1 21 5.75v7.5A2.75 2.75 0 0 1 18.25 16H17v1.25A2.75 2.75 0 0 1 14.25 20h-7.5A2.75 2.75 0 0 1 4 17.25v-7.5A2.75 2.75 0 0 1 6.75 7H8Zm2 0h4.25A2.75 2.75 0 0 1 17 9.75V14h1.25c.414 0 .75-.336.75-.75v-7.5a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0-.75.75V7Zm-3.25 2a.75.75 0 0 0-.75.75v7.5c0 .414.336.75.75.75h7.5a.75.75 0 0 0 .75-.75v-7.5a.75.75 0 0 0-.75-.75h-7.5Z"/></svg>
                                </button>
                            </div>
                            ${scan.allIds.length > 1 ? `<small>${scan.allIds.length} ID ditemukan • memakai ID terakhir</small>` : '<small>ID chat aktif terdeteksi</small>'}
                        </div>
                        <div class="lcj2-nova-stat mode">
                            <span class="lcj2-nova-stat-label">OCR MODE</span>
                            <strong>ROW LOCK 9+10</strong>
                            <small>Turbo OCR • gambar 2 & 4 • GMT-12 sampai GMT+14 → GMT+7</small>
                        </div>
                        <div class="lcj2-nova-stat live">
                            <span class="lcj2-nova-stat-label">WAKTU ONLINE WIB</span>
                            <strong id="lcj2-live-time">${cssEscapeText(lcj2FormatCurrentWib(lcj2NowDate()))}</strong>
                            <small>Mode pergantian hari • 23.00-02.00 WIB • sebelum 02.00 memakai tanggal semalam</small>
                        </div>
                    </div>
                </section>

                <div class="lcj2-nova-workspace">
                    <aside class="lcj2-nova-sidebar">
                        <section class="lcj2-card lcj2-nova-control-card">
                            <div class="lcj2-nova-section-head lcj2-bank-head">
                                <div class="lcj2-bank-head-main">
                                    <span class="lcj2-nova-step">01</span>
                                    <div><b>Data Rekening Otomatis</b><small>Diambil dari admin sesuai User ID LiveChat</small></div>
                                </div>
                                <button class="lcj2-btn lcj2-bank-refresh" id="lcj2-bank-refresh" type="button">↻ AMBIL REKENING</button>
                            </div>
                            <input class="lcj2-input" id="lcj2-rek-all" placeholder="Nama, Nomor Rekening" value="${cssEscapeText(defaultNama + ',' + defaultRek)}">
                            <div class="lcj2-scan-state lcj2-account-scan-state lcj2-bank-lookup-state waiting" id="lcj2-bank-state" aria-live="polite">
                                <span class="lcj2-scan-state-dot"></span>
                                <span class="lcj2-scan-state-copy">
                                    <span class="lcj2-scan-state-label">REKENING OTOMATIS</span>
                                    <strong class="lcj2-scan-state-text" id="lcj2-bank-state-text">MENUNGGU USER ID</strong>
                                    <span class="lcj2-scan-state-detail" id="lcj2-bank-state-detail">Nama pemilik dan nomor rekening dicari otomatis dari halaman admin</span>
                                </span>
                            </div>
                            <div class="lcj2-scan-state lcj2-account-scan-state waiting" id="lcj2-scan-state" aria-live="polite">
                                <span class="lcj2-scan-state-dot"></span>
                                <span class="lcj2-scan-state-copy">
                                    <span class="lcj2-scan-state-label">STATUS SCAN</span>
                                    <strong class="lcj2-scan-state-text" id="lcj2-scan-state-text">MENUNGGU SCAN</strong>
                                    <span class="lcj2-scan-state-detail" id="lcj2-scan-state-detail">Menunggu susunan otomatis</span>
                                </span>
                            </div>
                        </section>

                        <section class="lcj2-card lcj2-nova-control-card">
                            <div class="lcj2-nova-section-head orange">
                                <span class="lcj2-nova-step">02</span>
                                <div><b>Hasil Periode</b><small>OCR otomatis atau koreksi manual</small></div>
                            </div>
                            <div id="lcj2-period-fields">${buildPeriodInputsHTML(initialSetCount)}</div>
                        </section>

                        <section class="lcj2-card lcj2-nova-guide">
                            <div class="lcj2-nova-guide-title">PANDUAN CEPAT</div>
                            <div class="lcj2-nova-guide-row"><span>↕</span><div><b>Susun otomatis</b><small>Permainan → Riwayat → Kemenangan Total</small></div></div>
                            <div class="lcj2-nova-guide-row"><span>◎</span><div><b>Target OCR</b><small>Gambar ke-2: periode, tanggal, dan jam</small></div></div>
                            <div class="lcj2-nova-guide-row"><span>⌫</span><div><b>Hapus gambar</b><small>Shift + klik atau tombol hapus</small></div></div>
                        </section>
                    </aside>

                    <main class="lcj2-nova-main">
                        <section class="lcj2-card lcj2-nova-gallery-card">
                            <div class="lcj2-nova-gallery-head">
                                <div>
                                    <span class="lcj2-nova-kicker">WORKSPACE</span>
                                    <h4>Susunan Screenshot</h4>
                                    <p>Screenshot otomatis disusun; Riwayat Permainan menjadi target OCR periode, tanggal, dan jam claim.</p>
                                </div>
                                <button class="lcj2-btn primary lcj2-nova-scan-btn" id="lcj2-ocr-period" type="button">
                                    <span class="lcj2-nova-btn-icon">⌁</span>
                                    <span><b>SCAN PERIODE</b><small>Turbo OCR siap</small></span>
                                </button>
                            </div>
                            <div id="lcj2-empty-box" class="lcj2-empty" style="display:${scan.images.length ? 'none' : 'block'}">
                                <div class="lcj2-nova-empty-icon">▧</div>
                                <b>Belum ada screenshot pada chat aktif</b>
                                <span>Pastikan chat yang benar terbuka, lalu tutup dan buka kembali panel OCR.</span>
                            </div>
                            <div id="lcj2-image-grid"></div>
                        </section>

                        <section class="lcj2-card lcj2-nova-output-card">
                            <div class="lcj2-output-head">
                                <div>
                                    <span class="lcj2-nova-kicker">READY TO PASTE</span>
                                    <h4>Output Excel 7 Kolom</h4>
                                    <p>User ID • Gambar 1 • Gambar 2 • Gambar 3 • Rekening • Nama • Periode</p>
                                </div>
                                <button class="lcj2-btn green lcj2-copy-btn" id="lcj2-copy" type="button" title="Salin output saat ini">COPY OUTPUT</button>
                            </div>
                            <textarea id="lcj2-output" readonly spellcheck="false" aria-label="Output yang dapat disalin"></textarea>
                        </section>
                    </main>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

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
            fastReorderFrame: 0,
            arrangePrefetchTimer: null,
            arrangePrefetchIdle: null,
            autoArrangeRunning: false,
            autoArrangeSeq: 0,
            claimDeadlineTimer: null,
            claimExpiredNotified: new Set(),
            dragGhost: null
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
            const z = document.getElementById('lcj2-zoom');
            if (z) z.remove();
            document.removeEventListener('keydown', escClose, true);
            document.removeEventListener('selectionchange', flushPendingStatusWhenPossible, true);
            if (state.statusTimer) { clearTimeout(state.statusTimer); state.statusTimer = null; }
            if (state.dragFrame) { cancelAnimationFrame(state.dragFrame); state.dragFrame = 0; }
            if (state.fastReorderFrame) { cancelAnimationFrame(state.fastReorderFrame); state.fastReorderFrame = 0; }
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
            const copyBtn = panel.querySelector('#lcj2-copy');
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
                    ? 'Klik untuk melihat alasan paket tidak memenuhi aturan claim 23.00-02.00 WIB'
                    : 'TIDAK CAPAI MINBET: semua paket memiliki Taruhan di bawah 1,60')
                : (claimBlockedRows.length
                    ? 'Paket yang tidak memenuhi aturan claim 23.00-02.00 WIB otomatis tidak ikut dicopy'
                    : (betBlockedRows.length
                        ? 'TIDAK CAPAI MINBET: paket di bawah 1,60 otomatis tidak ikut dicopy'
                        : 'Salin output saat ini'));
        }

        function updateOutput() {
            const out = panel.querySelector('#lcj2-output');
            if (out) out.value = makeOutput(state.scan);
            const empty = panel.querySelector('#lcj2-empty-box');
            if (empty) empty.style.display = state.scan.images.length ? 'none' : 'block';
            updateCopyAvailability();
        }

        function setProgress(percent) {
            const bar = panel.querySelector('#lcj2-progress-bar');
            if (bar) bar.style.width = Math.max(0, Math.min(100, Number(percent) || 0)) + '%';
        }

        function updateLiveTimeDisplay() {
            const liveEl = panel.querySelector('#lcj2-live-time');
            const currentText = lcj2FormatCurrentWib(lcj2NowDate());
            const sourceText = lcj2GetOnlineTimeSourceLabel();
            if (liveEl) liveEl.textContent = currentText + ' • ' + sourceText;
            const detailEl = panel.querySelector('#lcj2-scan-state-detail');
            if (detailEl) {
                const baseDetail = detailEl.getAttribute('data-base-detail') || '';
                const onlineNow = 'WIB sekarang ' + currentText + ' (' + sourceText + ')';
                detailEl.textContent = baseDetail ? (baseDetail + ' • ' + onlineNow) : onlineNow;
            }
        }

        function setScanState(type, textValue, detailValue) {
            const box = panel.querySelector('#lcj2-scan-state');
            const textEl = panel.querySelector('#lcj2-scan-state-text');
            const detailEl = panel.querySelector('#lcj2-scan-state-detail');
            if (!box || !textEl || !detailEl || state.closed) return;

            const allowed = ['waiting', 'scanning', 'success', 'partial', 'failed'];
            const safeType = allowed.includes(type) ? type : 'waiting';
            box.className = 'lcj2-scan-state ' + safeType;
            textEl.textContent = textValue || 'MENUNGGU SCAN';
            detailEl.setAttribute('data-base-detail', detailValue || '');
            updateLiveTimeDisplay();
        }


        function showTidakCapaiNotification(row, odds) {
            const old = panel.querySelector('#lcj2-tidak-capai-only');
            if (old) old.remove();

            const overlay = document.createElement('div');
            overlay.id = 'lcj2-tidak-capai-only';
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
                    '<div style="font-size:clamp(30px,5vw,58px);line-height:1.05;font-weight:1000;color:#991b1b;text-shadow:0 2px 0 #fff">TIDAK CAPAI MINBET</div>' +
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
            const old = panel.querySelector('#lcj2-manual-scan-only');
            if (old) old.remove();

            const rows = Array.isArray(failedRows)
                ? failedRows.filter((row) => Number.isInteger(row) && row >= 0)
                : [];
            const packageText = rows.length
                ? 'PAKET ' + rows.map((row) => row + 1).join(', ')
                : 'KODE TIDAK DITEMUKAN';

            const overlay = document.createElement('div');
            overlay.id = 'lcj2-manual-scan-only';
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
            const old = panel.querySelector('#lcj2-claim-expired-only');
            if (old) old.remove();

            const status = claimStatus || (state.scan.claimDeadlineByRow && state.scan.claimDeadlineByRow[row]) || {};
            const imageTimeText = lcj2FormatClaimTimestamp(status.imageTimestamp || status.claimDate);
            const deadlineText = lcj2FormatClaimDeadline(status);
            const yesterdayDateText = status && status.claimDate
                ? lcj2FormatClaimDate(status.claimDate)
                : '-';
            const deadlineDisplayText = status && Number(status.dayDifference) === 1
                ? 'Tanggal semalam: ' + yesterdayDateText + ' • 23:00 - 02:00 WIB'
                : deadlineText;
            const onlineNowText = lcj2FormatCurrentWib(lcj2NowDate()) + ' • ' + lcj2GetOnlineTimeSourceLabel();
            const blockReasonText = lcj2ClaimStatusMessage(status);
            const ruleText = status.ruleText ||
                'Tanggal hari ini dapat claim; tanggal semalam hanya transaksi 23.00–23.59 GMT+7 sebelum pukul 02.00 WIB.';

            const overlay = document.createElement('div');
            overlay.id = 'lcj2-claim-expired-only';
            overlay.setAttribute('role', 'alert');
            overlay.setAttribute('aria-live', 'assertive');
            overlay.style.cssText = [
                'position:fixed',
                'inset:0',
                'z-index:2147483647',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'padding:28px',
                'background:rgba(8,2,2,.80)',
                'backdrop-filter:blur(10px)',
                'pointer-events:none'
            ].join(';');

            overlay.innerHTML =
                '<div style="width:min(860px,95vw);position:relative;overflow:hidden;padding:0;border-radius:30px;' +
                'border:2px solid rgba(239,68,68,.36);background:linear-gradient(160deg,#030303 0%,#100404 54%,#1b0606 100%);' +
                'color:#fff5f5;box-shadow:0 30px 100px rgba(0,0,0,.66),0 0 0 1px rgba(255,255,255,.02),0 0 60px rgba(239,68,68,.12);' +
                'font-family:Inter,Segoe UI,Arial,sans-serif">' +

                    '<div style="position:absolute;inset:auto auto 0 0;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(239,68,68,.10),transparent 68%);transform:translate(-32%,34%)"></div>' +
                    '<div style="position:absolute;right:-60px;top:-70px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(185,28,28,.12),transparent 70%)"></div>' +

                    '<div style="position:relative;padding:26px 30px 18px;border-bottom:1px solid rgba(248,113,113,.10);display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap">' +
                        '<div>' +
                            '<div style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.18);color:#fecaca;font-size:11px;font-weight:1000;letter-spacing:1.2px">STATUS CLAIM • PAKET ' + (row + 1) + '</div>' +
                            '<div style="margin-top:14px;font-size:clamp(28px,4.4vw,48px);line-height:1.04;font-weight:1000;letter-spacing:.3px;color:#fff7f7">TIDAK DAPAT CLAIM</div>' +
                            '<div style="margin-top:8px;font-size:15px;line-height:1.55;color:#e6bcbc;max-width:560px">' + cssEscapeText(blockReasonText) + '</div>' +
                        '</div>' +
                        '<div style="min-width:140px;padding:16px 18px;border-radius:18px;background:linear-gradient(145deg,rgba(35,10,10,.98),rgba(12,5,5,.96));border:1px solid rgba(239,68,68,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.03)">' +
                            '<div style="font-size:10px;color:#d1a1a1;font-weight:900;letter-spacing:1.3px">BATAS AKSES</div>' +
                            '<div style="margin-top:7px;font-size:26px;font-weight:1000;color:#f87171">02:00</div>' +
                            '<div style="margin-top:4px;font-size:12px;color:#ffe4e6">GMT+7 / WIB</div>' +
                        '</div>' +
                    '</div>' +

                    '<div style="position:relative;padding:22px 30px 28px">' +
                        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">' +

                            '<div style="padding:16px 16px 15px;border-radius:20px;background:linear-gradient(155deg,rgba(28,10,10,.96),rgba(8,5,5,.98));border:1px solid rgba(248,113,113,.08)">' +
                                '<div style="font-size:10px;font-weight:1000;letter-spacing:1.2px;color:#d1a1a1">WAKTU TRANSAKSI</div>' +
                                '<div style="margin-top:9px;font-size:18px;line-height:1.4;font-weight:1000;color:#fff7f7">' + cssEscapeText(imageTimeText) + '</div>' +
                            '</div>' +

                            '<div style="padding:16px 16px 15px;border-radius:20px;background:linear-gradient(155deg,rgba(28,10,10,.96),rgba(8,5,5,.98));border:1px solid rgba(248,113,113,.08)">' +
                                '<div style="font-size:11px;font-weight:1000;letter-spacing:1.2px;color:#ff9c9c">BATAS TERAKHIR</div>' +
                                '<div style="margin-top:9px;font-size:18px;line-height:1.45;font-weight:1000;color:#ffffff;text-shadow:0 0 10px rgba(239,68,68,.18)">' + cssEscapeText(deadlineDisplayText) + '</div>' +
                            '</div>' +

                            '<div style="padding:16px 16px 15px;border-radius:20px;background:linear-gradient(155deg,rgba(28,10,10,.96),rgba(8,5,5,.98));border:1px solid rgba(248,113,113,.08)">' +
                                '<div style="font-size:10px;font-weight:1000;letter-spacing:1.2px;color:#d1a1a1">WAKTU SEKARANG</div>' +
                                '<div style="margin-top:9px;font-size:18px;line-height:1.4;font-weight:1000;color:#ffe4e6">' + cssEscapeText(onlineNowText) + '</div>' +
                            '</div>' +

                        '</div>' +

                        '<div style="margin-top:16px;padding:18px 18px;border-radius:22px;background:linear-gradient(145deg,rgba(42,10,10,.76),rgba(18,7,7,.94));border:1px solid rgba(239,68,68,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.03)">' +
                            '<div style="font-size:11px;font-weight:1000;letter-spacing:1.25px;color:#fca5a5">ATURAN CLAIM</div>' +
                            '<div style="margin-top:10px;font-size:15px;line-height:1.6;color:#f1d1d1">' + cssEscapeText(ruleText) + '</div>' +
                        '</div>' +

                        '<div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
                            '<div style="display:inline-flex;align-items:center;gap:10px;padding:10px 14px;border-radius:999px;background:rgba(239,68,68,.10);border:1px solid rgba(239,68,68,.16);color:#ffe4e6;font-size:12px;font-weight:900">' +
                                '<span style="width:10px;height:10px;border-radius:50%;background:#ef4444;box-shadow:0 0 12px rgba(239,68,68,.82)"></span>' +
                                'Periksa tanggal, jam, dan zona waktu pada gambar 2 / 4.' +
                            '</div>' +
                            '<div style="font-size:12px;color:#d1a1a1;font-weight:800">Notifikasi ini akan menutup otomatis.</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';

            panel.appendChild(overlay);
            setTimeout(() => {
                if (overlay.isConnected) overlay.remove();
            }, 9000);
        }

        function setBankState(type, textValue, detailValue) {
            const box = panel.querySelector('#lcj2-bank-state');
            const textEl = panel.querySelector('#lcj2-bank-state-text');
            const detailEl = panel.querySelector('#lcj2-bank-state-detail');
            if (!box || !textEl || !detailEl || state.closed) return;
            const allowed = ['waiting', 'scanning', 'success', 'partial', 'failed'];
            const safeType = allowed.includes(type) ? type : 'waiting';
            box.className = 'lcj2-scan-state lcj2-account-scan-state lcj2-bank-lookup-state ' + safeType;
            textEl.textContent = textValue || 'MENUNGGU USER ID';
            detailEl.textContent = detailValue || '';
        }

        async function fillAccountFromAdmin(userId, forceRefresh) {
            const uid = lcj2ValidLookupUserId(userId);
            const refreshBtn = panel.querySelector('#lcj2-bank-refresh');
            if (!uid) {
                setBankState('waiting', 'USER ID BELUM TERDETEKSI', 'Isi atau tampilkan USER ID pada chat aktif');
                return;
            }

            if (state.bankLookupRunning && !forceRefresh && state.bankLookupUserId.toLowerCase() === uid.toLowerCase()) return;
            const sequence = ++state.bankLookupSeq;
            state.bankLookupRunning = true;
            state.bankLookupUserId = uid;
            if (refreshBtn) refreshBtn.disabled = true;
            setBankState('scanning', 'MENCARI DATA REKENING', 'User ID: ' + uid);

            try {
                const bank = await lcj2LookupBankFromAdmin(uid, !!forceRefresh);
                if (state.closed || sequence !== state.bankLookupSeq) return;

                const accountName = lcj2CleanAccountName(bank.nama);
                const accountNumber = lcj2CleanAccountNumber(bank.rek);
                if (!accountName || !accountNumber) {
                    throw lcj2CreateLookupError('BANK_NOT_FOUND', 'Nama pemilik atau nomor rekening tidak valid.');
                }
                const input = panel.querySelector('#lcj2-rek-all');
                if (input) input.value = accountName + ',' + accountNumber;
                const dbNow = getAccountDB();
                dbNow[uid] = { nama: accountName, rek: accountNumber };
                setAccountDB(dbNow);
                updateOutput();
                setBankState('success', '✓ DATA REKENING BERHASIL DITEMUKAN', accountName + ' • ' + accountNumber);
            } catch (err) {
                if (state.closed || sequence !== state.bankLookupSeq) return;
                const code = err && err.code ? err.code : '';
                if (code === 'ADMIN_LOGIN_REQUIRED') {
                    setBankState('failed', 'LOGIN ADMIN DIPERLUKAN', 'Login dahulu ke halaman admin pada browser yang sama');
                } else if (code === 'BANK_NOT_FOUND') {
                    setBankState('partial', '✕ DATA REKENING TIDAK DITEMUKAN', 'User ID ' + uid + ' tidak ditemukan atau data rekening kosong');
                } else if (code === 'NO_USER_ID') {
                    setBankState('waiting', 'USER ID BELUM TERDETEKSI', 'Pastikan member mengisi USER ID di chat aktif');
                } else {
                    setBankState('failed', '✕ GAGAL MENGAMBIL DATA REKENING', err && err.message ? err.message : 'Terjadi kesalahan pada halaman admin');
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
            const box = panel.querySelector('#lcj2-ocr-status');
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

            const wait = Math.max(0, 700 - (Date.now() - state.lastStatusAt));
            if (state.statusTimer) clearTimeout(state.statusTimer);
            state.statusTimer = setTimeout(() => {
                state.statusTimer = null;
                applyPendingStatus(false);
            }, wait);
        }

        function collectPeriodInputValues() {
            const values = {};
            panel.querySelectorAll('[data-lcj2-period-row]').forEach((input) => {
                const row = parseInt(input.getAttribute('data-lcj2-period-row') || '0', 10);
                values[row] = input.value || '';
            });
            return values;
        }

        function renderPeriodInputs(preserveValues) {
            const box = panel.querySelector('#lcj2-period-fields');
            if (!box) return;
            const values = preserveValues ? collectPeriodInputValues() : {};
            box.innerHTML = buildPeriodInputsHTML(getPackageCount(), values);
            box.querySelectorAll('[data-lcj2-period-row]').forEach((input) => {
                input.addEventListener('input', () => {
                    updateOutput();
                    updateClaimPeriodInputState(input);
                });
                updateClaimPeriodInputState(input);
            });
        }

        function updateClaimPeriodInputState(input) {
            if (!input) return;
            const row = parseInt(input.getAttribute('data-lcj2-period-row') || '0', 10);
            const imageTimestamp = state.scan.claimTimestampByRow && state.scan.claimTimestampByRow[row]
                ? state.scan.claimTimestampByRow[row]
                : null;
            const status = lcj2CheckClaimDeadline(imageTimestamp, input.value);
            state.scan.claimExpiredRows = state.scan.claimExpiredRows || [];
            state.scan.claimDeadlineByRow = state.scan.claimDeadlineByRow || [];
            state.scan.claimExpiredRows[row] = !!status.expired;
            state.scan.claimDeadlineByRow[row] = status;
            input.title = status.expired
                ? lcj2ClaimStatusMessage(status) + ' • Waktu gambar target ' +
                    lcj2FormatClaimTimestamp(status.imageTimestamp || status.claimDate)
                : (status.imageTimestamp
                    ? 'Waktu gambar 2/4: ' + lcj2FormatClaimTimestamp(status.imageTimestamp) + ' • deadline ' + lcj2FormatClaimDeadline(status)
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
            const existing = panel.querySelectorAll('[data-lcj2-period-row]').length;
            if (existing !== expected) renderPeriodInputs(true);
            for (let i = 0; i < expected; i++) syncSinglePeriodInput(i);
        }

        function syncSinglePeriodInput(i) {
            const input = panel.querySelector('#lcj2-prd-' + i);
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

        function clearOcrResultsAfterFastReorder(reason) {
            // Kosongkan data OCR langsung, tetapi tunda pekerjaan DOM yang lebih berat
            // sampai pertukaran kartu sudah selesai digambar oleh browser.
            state.scan.ocrPeriods = [];
            state.scan.ocrTexts = [];
            state.scan.ocrMeta = [];
            state.scan.betOddsByRow = [];
            state.scan.betBelowMinRows = [];
            state.scan.claimExpiredRows = [];
            state.scan.claimDeadlineByRow = [];
            state.scan.claimTimestampByRow = [];
            if (state.claimExpiredNotified) state.claimExpiredNotified.clear();

            setScanState('waiting', 'SIAP DI SCAN', 'Posisi gambar sudah dipindahkan');
            if (state.fastReorderFrame) cancelAnimationFrame(state.fastReorderFrame);
            state.fastReorderFrame = requestAnimationFrame(() => {
                state.fastReorderFrame = 0;
                if (state.closed) return;
                refreshImageCardPositions();
                renderPeriodInputs(false);
                if (reason) setOcrStatus(cssEscapeText(reason), 0);
                updateOutput();
                scheduleArrangePrefetch();
            });
        }

        function applyAutoArrangedCardsWithoutReload(originalImages, orderedImages) {
            const grid = panel.querySelector('#lcj2-image-grid');
            if (!grid) return false;

            const cards = Array.from(grid.children).filter((node) =>
                node && node.classList && node.classList.contains('lcj2-img-card')
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

            const packageSize = getPackageSizeFromImages(state.scan.images);
            if (packageSize !== 3 || state.scan.images.length % 3 !== 0) {
                return { changed: false, confident: false, rows: 0, reason: 'not-three-image-package' };
            }

            const sequence = ++state.autoArrangeSeq;
            state.autoArrangeRunning = true;
            setOcrStatus('Mengenali jenis screenshot dan menyusun otomatis...', 27);

            try {
                const original = state.scan.images.slice();
                const analyses = await lcj2AnalyzeScreenshotsForAutoArrange(original, (done, total) => {
                    if (state.closed || sequence !== state.autoArrangeSeq) return;
                    const progress = 27 + Math.round((done / Math.max(1, total)) * 5);
                    setOcrStatus(
                        'Menyusun otomatis screenshot <b>' + done + '/' + total + '</b>.<br>' +
                        'Urutan: <b>Permainan → Riwayat Permainan → Kemenangan Total</b>.',
                        progress
                    );
                });

                if (state.closed || sequence !== state.autoArrangeSeq) {
                    return { changed: false, confident: false, rows: 0, reason: 'cancelled' };
                }

                const result = lcj2BuildAutoArrangedOrder(original, analyses);
                if (result.confident) {
                    state.scan.images = result.images.slice();
                    state.scan.ocrPeriods = [];
                    state.scan.ocrTexts = [];
                    state.scan.ocrMeta = [];
                    state.scan.betOddsByRow = [];
                    state.scan.betBelowMinRows = [];
                    state.scan.claimExpiredRows = [];
                    state.scan.claimDeadlineByRow = [];
                    state.scan.claimTimestampByRow = [];
                    if (state.claimExpiredNotified) state.claimExpiredNotified.clear();

                    // Pindahkan kartu yang sudah tampil tanpa membuat ulang elemen <img>.
                    // Fallback ke render lama hanya bila struktur kartu tidak cocok.
                    if (!applyAutoArrangedCardsWithoutReload(original, result.images)) {
                        renderImages();
                    }
                    setScanState(
                        'waiting',
                        'SIAP DI SCAN',
                        'Otomatis: Permainan • Riwayat/Target OCR • Kemenangan Total'
                    );
                }
                return result;
            } catch (err) {
                console.warn('[LCJ2 AUTO ARRANGE]', err);
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
            state.scan.userId = newScan.userId;
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
            panel.querySelector('#lcj2-marker-text').textContent = newScan.markerText;
            panel.querySelector('#lcj2-user-text').value = newScan.userId;
            setScanState('waiting', 'MENUNGGU SCAN', 'Gambar otomatis disusun • klik SCAN DISINI');
            renderPeriodInputs(false);
            renderImages();
            updateOutput();
            fillAccountFromAdmin(newScan.userId, false);
        }

        async function runDeepScan() {
            if (state.scanRunning || state.ocrRunning || state.closed) return;
            // Mulai memuat worker sekarang agar selesai bersamaan dengan pengumpulan
            // dan penyusunan gambar. Tombol SCAN tidak perlu menunggu startup OCR.
            warmupOCRWorker();
            state.scanRunning = true;
            panel.classList.add('lcj2-performance-mode');
            const ocrBtn = panel.querySelector('#lcj2-ocr-period');
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
                if (!state.ocrRunning) panel.classList.remove('lcj2-performance-mode');
                if (ocrBtn) ocrBtn.disabled = false;
            }
        }

        function getCardImageIndex(card) {
            if (!card) return -1;
            const value = parseInt(card.dataset.lcj2ImageIndex || '-1', 10);
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
                state.arrangePrefetchIdle = requestIdleCallback(run, { timeout: 180 });
            } else {
                state.arrangePrefetchTimer = setTimeout(run, 30);
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
            panel.classList.remove('lcj2-reorder-mode');
        }

        function swapCardNodes(first, second) {
            if (!first || !second || first === second || first.parentNode !== second.parentNode) return;
            const parent = first.parentNode;
            const marker = document.createComment('lcj2-swap');
            parent.insertBefore(marker, first);
            parent.insertBefore(first, second);
            parent.insertBefore(second, marker);
            marker.remove();
        }

        function refreshImageCardPositions() {
            const packageSize = getPackageSizeFromImages(state.scan.images || []);
            const cards = Array.from(panel.querySelectorAll('#lcj2-image-grid > .lcj2-img-card'));

            cards.forEach((card, idx) => {
                const rowIdx = Math.floor(idx / packageSize);
                const isTarget = packageSize === 1 ? true : idx === rowIdx * packageSize + 1;
                const meta = state.scan.ocrMeta && state.scan.ocrMeta[rowIdx];
                const period = state.scan.ocrPeriods && state.scan.ocrPeriods[rowIdx];

                card.dataset.lcj2Row = String(rowIdx);
                card.dataset.lcj2ImageIndex = String(idx);
                card.classList.toggle('target', isTarget);

                const indexTag = card.querySelector('.lcj2-img-index');
                if (indexTag) {
                    indexTag.innerHTML = 'GAMBAR ' + (idx + 1) + (isTarget ? ' <span class="lcj2-target-tag">• TARGET OCR</span>' : '');
                }

                const badge = card.querySelector('.lcj2-ocr-badge');
                if (!badge) return;
                badge.dataset.lcj2OcrBadgeRow = String(rowIdx);
                if (period) {
                    const claimTime = state.scan.claimTimestampByRow && state.scan.claimTimestampByRow[rowIdx];
                    const claimStatus = lcj2CheckClaimDeadline(claimTime || null, period);
                    state.scan.claimExpiredRows = state.scan.claimExpiredRows || [];
                    state.scan.claimDeadlineByRow = state.scan.claimDeadlineByRow || [];
                    state.scan.claimExpiredRows[rowIdx] = !!claimStatus.expired;
                    state.scan.claimDeadlineByRow[rowIdx] = claimStatus;

                    const betValue = state.scan.betOddsByRow && state.scan.betOddsByRow[rowIdx];
                    const betBelowMin = !!(state.scan.betBelowMinRows && state.scan.betBelowMinRows[rowIdx]);
                    const betText = lcj2FormatBetOdds(betValue);

                    if (betBelowMin) {
                        badge.className = 'lcj2-ocr-badge error';
                        badge.textContent = '✕ TIDAK CAPAI MINBET • TARUHAN ' + betText +
                            ' • MINIMAL 1,60 • PAKET TIDAK DAPAT CLAIM';
                    } else if (claimStatus.expired) {
                        badge.className = 'lcj2-ocr-badge error';
                        badge.textContent = '✕ TIDAK DAPAT CLAIM • TARUHAN ' + betText + ' • ' + lcj2ClaimStatusMessage(claimStatus) +
                            ' • TRANSAKSI ' +
                            (claimTime ? lcj2FormatClaimTimestamp(claimTime) : lcj2FormatClaimDate(claimStatus.claimDate)) +
                            ' • SEKARANG ' + lcj2FormatCurrentWib(lcj2NowDate());
                    } else {
                        badge.className = 'lcj2-ocr-badge success';
                        badge.textContent = '✓ MINBET OK • TARUHAN ' + betText + ' • ' +
                            (meta && meta.confidence ? meta.confidence + '% • ' : '') + period +
                            (claimTime ? ' • TRANSAKSI ' + lcj2FormatClaimTimestamp(claimTime) : ' • WAKTU BELUM TERBACA') +
                            (claimStatus.ruleText ? ' • ' + claimStatus.ruleText : '');
                    }
                } else if (meta && meta.error && isTarget) {
                    badge.className = 'lcj2-ocr-badge error';
                    badge.textContent = '! ' + meta.error;
                } else {
                    badge.className = 'lcj2-ocr-badge empty';
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
            const grid = panel.querySelector('#lcj2-image-grid');
            grid.innerHTML = '';
            const packageSize = getPackageSizeFromImages(state.scan.images || []);

            state.scan.images.forEach((src, idx) => {
                const rowIdx = Math.floor(idx / packageSize);
                const isTarget = packageSize === 1 ? true : idx === rowIdx * packageSize + 1;
                const meta = state.scan.ocrMeta && state.scan.ocrMeta[rowIdx];
                const period = state.scan.ocrPeriods && state.scan.ocrPeriods[rowIdx];

                const card = document.createElement('div');
                card.className = 'lcj2-img-card' + (isTarget ? ' target' : '');
                card.dataset.lcj2Row = String(rowIdx);
                card.dataset.lcj2ImageIndex = String(idx);
                card.draggable = true;

                const media = document.createElement('div');
                media.className = 'lcj2-img-media';

                const indexTag = document.createElement('div');
                indexTag.className = 'lcj2-img-index';
                indexTag.innerHTML = 'GAMBAR ' + (idx + 1) + (isTarget ? ' <span class="lcj2-target-tag">• TARGET OCR</span>' : '');

                const del = document.createElement('button');
                del.className = 'lcj2-del';
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
                label.className = 'lcj2-img-label';
                label.textContent = src.split('/').pop().split('?')[0] || 'screenshot';

                const ocrBadge = document.createElement('div');
                ocrBadge.dataset.lcj2OcrBadgeRow = String(rowIdx);
                if (period) {
                    ocrBadge.className = 'lcj2-ocr-badge success';
                    ocrBadge.textContent = '✓ BULAT 2 LOCK • ' + (meta && meta.confidence ? meta.confidence + '% • ' : '') + period;
                } else if (meta && meta.error && isTarget) {
                    ocrBadge.className = 'lcj2-ocr-badge error';
                    ocrBadge.textContent = '! ' + meta.error;
                } else {
                    ocrBadge.className = 'lcj2-ocr-badge empty';
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

                    // Jangan biarkan analisis background berjalan saat kartu sedang dipindah.
                    if (state.arrangePrefetchTimer) {
                        clearTimeout(state.arrangePrefetchTimer);
                        state.arrangePrefetchTimer = null;
                    }
                    if (state.arrangePrefetchIdle && typeof cancelIdleCallback === 'function') {
                        try { cancelIdleCallback(state.arrangePrefetchIdle); } catch (err) {}
                        state.arrangePrefetchIdle = null;
                    }

                    panel.classList.add('lcj2-reorder-mode');
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

                    clearOcrResultsAfterFastReorder(
                        'Posisi gambar berhasil ditukar. Target OCR sudah diperbarui dan siap discan.'
                    );
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
            panel.querySelectorAll('[data-lcj2-ocr-badge-row="' + rowIdx + '"]').forEach((badge) => {
                const card = badge.closest('.lcj2-img-card');
                const isTarget = !!(card && card.classList.contains('target'));
                if (period) {
                    const claimTime = state.scan.claimTimestampByRow && state.scan.claimTimestampByRow[rowIdx];
                    const betValue = state.scan.betOddsByRow && state.scan.betOddsByRow[rowIdx];
                    const betBelowMin = !!(state.scan.betBelowMinRows && state.scan.betBelowMinRows[rowIdx]);
                    const betText = lcj2FormatBetOdds(betValue);

                    if (betBelowMin) {
                        badge.className = 'lcj2-ocr-badge error';
                        badge.textContent = '✕ TIDAK CAPAI MINBET • TARUHAN ' + betText + ' • MINIMAL 1,60 • ' + period;
                    } else {
                        badge.className = 'lcj2-ocr-badge success';
                        badge.textContent = '✓ MINBET OK • TARUHAN ' + betText + ' • BULAT 2 LOCK • ' +
                            (meta && meta.confidence ? meta.confidence + '% • ' : '') + period +
                            (claimTime ? ' • WAKTU ' + lcj2FormatClaimTimestamp(claimTime) : ' • WAKTU BELUM TERBACA');
                    }
                } else if (meta && meta.error && isTarget) {
                    badge.className = 'lcj2-ocr-badge error';
                    badge.textContent = '! ' + meta.error;
                } else {
                    badge.className = 'lcj2-ocr-badge empty';
                    badge.textContent = isTarget ? 'Menunggu lock dua bulatan' : 'Bukan target OCR periode';
                }
            });
        }

        function openZoom(src) {
            const oldZoom = document.getElementById('lcj2-zoom');
            if (oldZoom) oldZoom.remove();
            state.zoomScale = 1;
            state.zoomX = 0;
            state.zoomY = 0;

            const zoom = document.createElement('div');
            zoom.id = 'lcj2-zoom';
            zoom.innerHTML = `
                <button class="lcj2-btn red" id="lcj2-close-zoom" style="position:absolute;top:20px;right:20px;z-index:2">✕ TUTUP ZOOM</button>
                <img id="lcj2-zoom-img" src="${cssEscapeText(src)}">
                <div class="lcj2-zoom-help">Drag untuk geser • Scroll untuk zoom • ESC untuk menutup</div>
            `;
            document.body.appendChild(zoom);

            const zimg = zoom.querySelector('#lcj2-zoom-img');
            function applyTransform() {
                zimg.style.transform = `translate(${state.zoomX}px, ${state.zoomY}px) scale(${state.zoomScale})`;
            }
            zoom.querySelector('#lcj2-close-zoom').addEventListener('click', () => zoom.remove());
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

        async function runOcrPeriods() {
            if (state.ocrRunning || state.scanRunning || state.closed) return;
            if (!state.scan.images.length) {
                setScanState('failed', 'GAGAL DI SCAN', 'Tidak ada gambar target');
                setOcrStatus('Tidak ada gambar untuk OCR. Pastikan screenshot sudah terkumpul pada chat aktif.', 0, true);
                showManualScanNotification([]);
                return;
            }

            // OCR hanya berjalan setelah tombol ditekan manual oleh pengguna.
            // Tidak ada pemanggilan otomatis dari deep scan, refresh, drag, atau saat panel dibuka.
            setOcrStatus('Susunan otomatis siap. Membaca periode, tanggal, jam, dan GMT dari gambar 2 serta gambar 4...', 36);
            state.ocrRunning = true;
            setScanState('scanning', '⚡ ULTRA FAST SCAN', 'Memakai cache cepat dan jalur satu-pass bila gambar jelas');
            panel.classList.add('lcj2-performance-mode');
            const btn = panel.querySelector('#lcj2-ocr-period');
            if (btn) btn.disabled = true;
            if (btn) btn.textContent = '⚡ ULTRA FAST SCAN...';
            const alwaysCopyBtn = panel.querySelector('#lcj2-copy');
            if (alwaysCopyBtn) { alwaysCopyBtn.disabled = false; alwaysCopyBtn.title = 'Salin output sementara saat OCR berjalan'; }

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

            try {
                // Turbo Scan: worker dan seluruh gambar target disiapkan bersamaan.
                // Paket berikutnya tidak perlu menunggu download, decode, dan deteksi marker.
                const targetSources = [];
                for (let preRow = 0; preRow < rows; preRow++) {
                    const preBase = preRow * packageSize;
                    const preIdx = packageSize >= 2 ? preBase + 1 : preBase;
                    const preSrc = state.scan.images[preIdx];
                    if (preSrc) targetSources.push(preSrc);
                }

                setOcrStatus(
                    'Ultra Fast menyiapkan <b>' + targetSources.length +
                    '</b> gambar target dan worker OCR secara bersamaan...',
                    37,
                    true
                );

                await Promise.all([
                    getSharedOCRWorker(null),
                    getMetadataOCRWorker().catch(() => null),
                    getTimestampOCRWorker().catch(() => null),
                    Promise.allSettled(targetSources.map((targetSrc) => lcj2WarmUltraFastScanCache(targetSrc)))
                ]);

                for (let row = 0; row < rows; row++) {
                    if (state.closed) return;
                    const base = row * packageSize;
                    const preferredIdx = packageSize >= 2 ? base + 1 : base;
                    const src = state.scan.images[preferredIdx];
                    const overallBase = 38 + (row / Math.max(1, rows)) * 57;

                    if (!src) {
                        state.scan.ocrMeta[row] = { error: 'Gambar ke-2 paket tidak tersedia.', confidence: 0 };
                        continue;
                    }

                    setScanState('scanning', 'SEDANG DI SCAN', 'Paket ' + (row + 1) + ' dari ' + rows);
                    setOcrStatus(
                        'Paket <b>' + (row + 1) + '/' + rows + '</b> • membaca screenshot nomor <b>' + (preferredIdx + 1) + '</b>.<br>' +
                        'Tahap pertama: mencari pasangan <b>dua tanda bulat oranye</b>.',
                        overallBase
                    );

                    let result;
                    try {
                        result = await ocrImagePeriod(src, (progress) => {
                            setOcrStatus(
                                'Paket <b>' + (row + 1) + '/' + rows + '</b> • screenshot <b>' + (preferredIdx + 1) + '</b><br>' + cssEscapeText(progress),
                                Math.min(94, overallBase + 7)
                            );
                        });
                    } catch (err) {
                        result = {
                            period: '', text: '', confidence: 0, markerFound: false,
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
                    state.scan.betOddsByRow[row] = result.betOdds == null ? null : result.betOdds;
                    state.scan.betBelowMinRows[row] = !!result.betBelowMin;
                    if (result.claimTimestamp) {
                        result.claimTimestamp.sourceImageNumber = preferredIdx + 1;
                        result.claimTimestamp.source = 'gambar-' + (preferredIdx + 1) + '-' +
                            String(result.claimTimestamp.source || 'ocr');
                        result.claimTimestampText = lcj2FormatClaimTimestamp(result.claimTimestamp);
                    }
                    state.scan.claimTimestampByRow[row] = result.claimTimestamp || null;
                    const claimStatus = lcj2CheckClaimDeadline(result.claimTimestamp || null, result.period || '');
                    state.scan.claimExpiredRows[row] = !!claimStatus.expired;
                    state.scan.claimDeadlineByRow[row] = claimStatus;
                    if (result.period) ok++;
                    if (result.betBelowMin) showTidakCapaiNotification(row, result.betOdds);
                    if (claimStatus.expired) showClaimExpiredNotification(row, claimStatus);

                    syncSinglePeriodInput(row);
                    updateOcrBadgeRow(row);

                    // Output besar tidak perlu dibangun ulang pada setiap paket.
                    // Perbarui setiap dua paket dan selalu pada paket terakhir.
                    if (row === rows - 1 || row % 2 === 1) updateOutput();

                    if (result.period) {
                        setOcrStatus(
                            'Paket <b>' + (row + 1) + '</b> berhasil. Dua bulatan terkunci dan kode lolos konsensus.<br>' +
                            'Periode: <b style="color:#91f5b7">' + cssEscapeText(result.period) + '</b> • keyakinan <b>' + (result.confidence || 0) + '%</b>.' +
                            '<br>Taruhan: <b style="color:' + (result.betBelowMin ? '#ff7b93' : '#91f5b7') + '">' +
                                cssEscapeText(lcj2FormatBetOdds(result.betOdds)) + '</b> • ' +
                                (result.betBelowMin
                                    ? '<span style="color:#ff7b93;font-weight:1000">TIDAK CAPAI MINBET • MINIMAL 1,60</span>'
                                    : (result.betOdds == null
                                        ? '<span style="color:#fde68a;font-weight:1000">TARUHAN BELUM TERBACA • PERIKSA MANUAL</span>'
                                        : '<span style="color:#91f5b7;font-weight:1000">MINBET OK</span>')) +
                            '<br>Waktu gambar <b>' + (preferredIdx + 1) + '</b>: <b>' +
                                cssEscapeText(result.claimTimestampText || 'belum terbaca') + '</b>.' +
                            (result.claimTimestamp && result.claimTimestamp.timezoneExplicit
                                ? '<br><span style="color:#fde68a;font-weight:1000">ZONA TERBACA: ' +
                                    cssEscapeText(result.claimTimestamp.sourceGmtLabel) +
                                    (result.claimTimestamp.timezoneAdjusted ? ' → GMT+7' : ' • sudah GMT+7') +
                                    '</span>'
                                : '<br><span style="color:#fecaca;font-weight:1000">ZONA WAKTU TIDAK TERBACA • PERIKSA MANUAL</span>') +
                            (claimStatus.hasDate ? ' • Deadline <b>' + cssEscapeText(lcj2FormatClaimDeadline(claimStatus)) + '</b>.' : '') +
                            (claimStatus.expired ? '<br><span style="color:#ffb7c5;font-weight:1000">TIDAK DAPAT CLAIM • ' +
                                cssEscapeText(lcj2ClaimStatusMessage(claimStatus)) + '</span>' : ''),
                            38 + ((row + 1) / rows) * 57
                        );
                    } else {
                        setOcrStatus(
                            'Paket <b>' + (row + 1) + '</b> tidak diisi otomatis.<br><span style="color:#ffb7c5">' + cssEscapeText(result.error || 'Kode tidak konsisten.') + '</span>',
                            38 + ((row + 1) / rows) * 57
                        );
                    }
                }

                syncPeriodInputsFromOcr();
                updateOutput();

                if (rows > 0 && ok === rows) {
                    setScanState('success', '✓ SCAN CODE SELESAI', ok + ' dari ' + rows + ' paket berhasil ditemukan');
                } else if (ok > 0) {
                    setScanState('partial', '✓ SCAN CODE SELESAI', ok + ' dari ' + rows + ' paket berhasil ditemukan');
                } else {
                    setScanState('failed', '✕ SCAN CODE GAGAL', 'Tidak ada kode yang berhasil ditemukan');
                }

                setOcrStatus(
                    'OCR selesai: <b style="color:#91f5b7">' + ok + '</b> dari <b>' + rows + '</b> paket berhasil.<br>' +
                    (ok < rows ? 'Paket gagal sengaja dibiarkan untuk pemeriksaan manual agar OCR tidak mengambil kode dari baris lain.' : 'Semua kode berhasil dikunci pada baris dengan dua bulatan.'),
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
            } catch (err) {
                setScanState('failed', 'GAGAL DI SCAN', 'Proses OCR mengalami kesalahan');
                setOcrStatus('OCR gagal: ' + cssEscapeText(err && err.message ? err.message : err), 0, true);
                showManualScanNotification([]);
            } finally {
                state.ocrRunning = false;
                if (!state.scanRunning) panel.classList.remove('lcj2-performance-mode');
                if (btn) btn.disabled = false;
                if (btn) btn.textContent = 'SCAN DISINI';
                updateCopyAvailability();
            }
        }

        function saveAccountValue() {
            const input = panel.querySelector('#lcj2-rek-all');
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
            const z = document.getElementById('lcj2-zoom');
            if (z) {
                z.remove();
                return;
            }
            closePanel();
        }

        panel.querySelector('#lcj2-close').addEventListener('click', closePanel);
        panel.querySelector('#lcj2-ocr-period').addEventListener('click', runOcrPeriods);
        panel.querySelector('#lcj2-bank-refresh').addEventListener('click', () => fillAccountFromAdmin(state.scan.userId, true));

        const userIdInput = panel.querySelector('#lcj2-user-text');
        let committedUserId = String(state.scan.userId || '').trim();

        function stopPendingBankLookupForUserEdit() {
            state.bankLookupSeq += 1;
            state.bankLookupRunning = false;
            state.bankLookupUserId = '';
            const refreshBtn = panel.querySelector('#lcj2-bank-refresh');
            if (refreshBtn) refreshBtn.disabled = false;
        }

        function commitEditedUserId(forceLookup) {
            if (!userIdInput) return;
            const nextUserId = String(userIdInput.value || '').trim();
            userIdInput.value = nextUserId;
            state.scan.userId = nextUserId;
            updateOutput();

            if (nextUserId === committedUserId && !forceLookup) return;
            stopPendingBankLookupForUserEdit();
            committedUserId = nextUserId;

            const accountInput = panel.querySelector('#lcj2-rek-all');
            if (!lcj2ValidLookupUserId(nextUserId)) {
                if (accountInput) accountInput.value = 'NAMA USER,NO REKENING';
                updateOutput();
                setBankState('waiting', 'USER ID BELUM TERDETEKSI', 'Isi User ID yang benar pada kolom USER ID');
                return;
            }

            const savedAccount = getAccountDB()[nextUserId] || { nama: '', rek: '' };
            if (accountInput) {
                const savedName = lcj2CleanAccountName(savedAccount.nama) || 'NAMA USER';
                const savedNumber = lcj2CleanAccountNumber(savedAccount.rek) || 'NO REKENING';
                accountInput.value = savedName + ',' + savedNumber;
            }
            updateOutput();
            fillAccountFromAdmin(nextUserId, true);
        }

        if (userIdInput) {
            userIdInput.addEventListener('input', () => {
                const typedUserId = String(userIdInput.value || '').trim();
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

        panel.querySelector('#lcj2-copy-user').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const copyUserBtn = panel.querySelector('#lcj2-copy-user');
            if (userIdInput) state.scan.userId = String(userIdInput.value || '').trim();
            const userId = String(state.scan.userId || '').trim();
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
            const outputBox = panel.querySelector('#lcj2-output');
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
                    'Waktu gambar 2/4: <b>' + cssEscapeText(lcj2FormatClaimTimestamp(status && (status.imageTimestamp || status.claimDate))) + '</b>.<br>' +
                    '<span style="color:#ffb7c5;font-weight:1000">' + cssEscapeText(lcj2ClaimStatusMessage(status)) + '</span><br>' +
                    'Waktu online sekarang: <b>' + cssEscapeText(lcj2FormatCurrentWib(lcj2NowDate()) + ' • ' + lcj2GetOnlineTimeSourceLabel()) + '</b>.',
                    null,
                    true
                );
            }
        }

        panel.querySelector('#lcj2-copy').addEventListener('click', () => {
            const copyBtn = panel.querySelector('#lcj2-copy');
            // makeOutput menghitung ulang waktu WIB agar cutoff tetap tepat walau panel sudah lama terbuka.
            const output = makeOutput(state.scan);
            const betBlockedRows = getBlockedBetRows();
            const claimBlockedRows = getBlockedClaimRows();
            const allBlockedRows = Array.from(new Set(betBlockedRows.concat(claimBlockedRows))).sort((a, b) => a - b);
            const outputBox = panel.querySelector('#lcj2-output');
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
                if (claimBlockedRows.length) reasons.push('tidak memenuhi aturan claim pergantian hari 23.00-02.00 WIB');
                if (betBlockedRows.length) reasons.push('TIDAK CAPAI MINBET (Taruhan di bawah 1,60)');
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
                        ' tidak ikut dicopy karena TIDAK CAPAI MINBET (Taruhan di bawah 1,60).'
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
        panel.querySelector('#lcj2-rek-all').addEventListener('input', updateOutput);
        panel.querySelector('#lcj2-rek-all').addEventListener('change', saveAccountValue);
        panel.querySelector('#lcj2-rek-all').addEventListener('blur', saveAccountValue);
        document.addEventListener('keydown', escClose, true);
        document.addEventListener('selectionchange', flushPendingStatusWhenPossible, true);
        panel.addEventListener('copy', () => setTimeout(() => applyPendingStatus(false), 0));

        // Periksa waktu WIB berkala. Bila panel terbuka melewati 02.00 WIB,
        // status claim berubah otomatis tanpa perlu menekan SCAN ulang.
        lcj2SyncOnlineTime(true);
        state.claimDeadlineTimer = setInterval(() => {
            lcj2SyncOnlineTime(false);
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
        lcj2SyncOnlineTime(true);
        createBubble();
        setInterval(createBubble, 8000);
    });
})();
