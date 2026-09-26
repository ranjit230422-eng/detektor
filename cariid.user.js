// ==UserScript==
// @name         Cari ID & Rekening HP \u2014 Emas Hitam
// @namespace    local.mobile.find
// @version      3.28.0
// @description  Bubble kecil untuk mencari teks halaman, User ID, dan rekening di HP. Kartu saldo per ID dan permintaan data pendukung di atas Rp10.000. Tanpa OCR.
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_addValueChangeListener
// ==/UserScript==
(() => {
  'use strict';
  if (window.top !== window.self || document.getElementById('mobile-find-local')) return;
  const host = document.createElement('div');
  host.id = 'mobile-find-local';
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;';
  document.documentElement.append(host);
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `<style>
    *{box-sizing:border-box}button,input,textarea,select{font:inherit}button{cursor:pointer;touch-action:manipulation;color:#eef5ff;background:#243855;border:1px solid #47618a;border-radius:10px;min-height:42px;padding:8px 12px}
    button:active{background:#35527d}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #81baff}
    #bubble{position:fixed;width:44px;height:44px;min-height:44px;padding:0;border-radius:50%;background:linear-gradient(145deg,#264971,#111f35);box-shadow:0 4px 14px #0008;pointer-events:auto;touch-action:none;font:24px system-ui;user-select:none}
    #panel{position:fixed;left:10px;top:12px;width:min(370px,calc(100vw - 20px));padding:12px;background:#111d30;color:#eef5ff;border:1px solid #3d587c;border-radius:16px;box-shadow:0 10px 35px #0008;pointer-events:auto;font:14px system-ui;max-height:85vh;overflow:auto}
    #panel-handle{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab;position:sticky;top:0;background:#111d30;z-index:2;min-height:44px}#panel-handle:active{cursor:grabbing}
    [hidden]{display:none!important}.row{display:flex;gap:8px;align-items:center;margin-top:9px}.title{display:flex;align-items:center;justify-content:space-between;font-weight:700}.title button{font-size:20px}
    input,textarea,select{color:#f1f5ff;background:#0a1424;border:1px solid #425b7e;border-radius:9px;padding:10px;min-width:0;font-size:16px}input,textarea{width:100%}textarea{resize:vertical;min-height:88px;line-height:1.4}select{flex:1}#status{flex:1;font-size:13px;color:#cedef6}#note{font-size:11px;color:#9eafc8;line-height:1.4;margin-top:9px}
    #checks{display:grid;gap:6px;margin-top:9px}.check{padding:8px;border-radius:8px;background:#172235;color:#9eafc8;border:1px solid #344155;overflow-wrap:anywhere}.check.yes{background:#123e2d;color:#bcffdb;border-color:#328e63;box-shadow:0 0 8px #26a86633}.hit.good{background:#27c47538;border-color:#27c475}.hit.good.current{outline-color:#27c475}
    .hit{position:fixed;pointer-events:none;background:#ffbf0038;border:1px solid #e5a800;border-radius:2px}.hit.current{background:#ff7a0044;outline:2px solid #ff8c22}
    #tidy{margin-top:12px;border-top:1px solid #3d587c;padding-top:12px}#tidy summary{cursor:pointer;min-height:40px;font-weight:700;color:#b6d6ff}#tidy .row{flex-wrap:wrap}#tidy label{display:block;margin:10px 0 5px;color:#cedef6;font-size:12px}#tidy .hint{font-size:11px;line-height:1.5;color:#9eafc8;margin:8px 0}#tidy-status{font-size:12px;line-height:1.5;min-height:18px;margin-top:8px;color:#bcffdb}#tidy-copy{background:#194735;border-color:#328e63}#tidy button:disabled{opacity:.45;cursor:default}#tidy-format{width:100%}#tidy-toast{position:fixed;right:12px;bottom:20px;max-width:calc(100vw - 24px);padding:12px 16px;border:1px solid #328e63;border-radius:12px;background:#123326;color:#e7fff0;font:13px system-ui;box-shadow:0 6px 24px #0008;pointer-events:none}
    .account-card{margin-top:12px;padding:10px;border:1px solid #3d587c;border-radius:12px;background:#0c1729}.account-card strong{font-size:12px;color:#b6d6ff}.field-row{display:flex;gap:6px;align-items:center}.field-row input{flex:1;width:0;font-size:14px}.field-row button{padding:8px;font-size:12px;flex-shrink:0}.account-card .hint{margin-bottom:0}
    #panel{background:linear-gradient(155deg,#14253b,#0c1423);border-color:#38577a;box-shadow:0 16px 45px #0009;padding:14px;border-radius:20px}#panel-handle{background:#142338;letter-spacing:.6px;font-size:12px;border-bottom:1px solid #2b425e;padding-bottom:7px}#query{min-height:100px;background:#080f1d;border-color:#355676}#search{flex:1;background:linear-gradient(145deg,#294d77,#1a3352);font-weight:700}#checks{gap:10px}.check{background:#111e30;border-radius:12px;padding:12px;color:#c0cee1}.check.yes{background:linear-gradient(130deg,#123e30,#112c26);border-color:#3ea97a;color:#d4ffe8}.match-title{font-size:11px;color:#9fb6d0;margin-bottom:6px;letter-spacing:.5px}.match-value{font-size:15px;font-weight:700;overflow-wrap:anywhere}.match-bottom{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-top:8px;font-size:11px}.match-bottom button{min-height:32px;padding:5px 10px;font-size:11px}.match-summary{padding:10px;border-radius:10px;background:#1d3048;font-size:12px;line-height:1.5;color:#deebff}#status{font-weight:600}#tidy summary{color:#b8cde6;font-size:12px}
    #bubble{display:grid;place-items:center;color:#d2e8ff;border-color:#51769d}#panel{padding:14px;background:linear-gradient(150deg,#16263b,#0b1220 65%);border:1px solid #3b5471}#panel-handle{background:#132136;min-height:44px}#panel-handle span{font-size:12px;font-weight:800}#query{min-height:84px;font-size:15px;line-height:1.55}#checks{gap:8px}.result-choices{display:flex;gap:6px;overflow-x:auto;padding:3px 0 6px;max-width:100%}.result-choice{flex:0 0 auto;min-height:38px;font-size:11px;border-radius:9px;padding:7px 10px;background:#142238}.result-choice.active{background:#284565;border-color:#91b9e1}.result-choice small{display:block;margin-top:2px;color:#b3c6dc}.result-heading{border:1px solid #41648a;padding:12px;border-radius:12px;background:linear-gradient(120deg,#203b59,#15283e)}.result-heading strong{display:block;font-size:16px;color:#eff7ff;overflow-wrap:anywhere}.result-heading small{display:block;font-size:11px;color:#aabed6;margin-top:5px}.result-heading.good{border-color:#378566;background:linear-gradient(120deg,#173f32,#142a29)}.check{padding:11px 12px;border-color:#2f425b}.match-title{font-size:10px;letter-spacing:1px}.match-value{font-size:16px}.match-bottom{margin-top:7px}.match-bottom button{border-color:#415b78;background:#243c57;min-height:34px}.check.yes .match-bottom button{border-color:#378163;background:#1d4d3a}#note{line-height:1.6}#tidy{border-color:#2d425e}#prev,#next{min-height:36px;min-width:38px}
    #native-preview{margin-top:10px;background:#101e32;border:1px solid #365577;border-radius:12px;padding:11px;font-size:12px;line-height:1.6;overflow-wrap:anywhere}#native-preview button{margin:6px 6px 0 0;font-size:12px;min-height:36px}#native-preview strong{color:#d5e9ff}#native-preview .native-value{padding:7px 0;font-size:17px;font-weight:700;color:#d4ffe8}
    #prefix-row{display:flex;justify-content:flex-end;margin-top:7px}#prefix-888{min-width:66px;min-height:36px;padding:6px 12px;background:#234838;border-color:#438c68;font-weight:700;color:#d9ffe8}#prefix-888:disabled{opacity:.65;cursor:default}#prefix-options{margin-top:8px;padding:10px;border:1px solid #365577;border-radius:10px;color:#d5e9ff;font-size:12px}#prefix-options button{display:block;width:100%;margin-top:7px;font-size:13px}
    #referral-box{margin-top:12px;padding:12px;border:1px solid #47688a;border-radius:14px;background:linear-gradient(135deg,#1a3049,#111e30)}.ref-heading{font-size:12px;font-weight:800;letter-spacing:.7px;color:#c8e4ff}.ref-dates{font-size:11px;line-height:1.6;color:#a6bbd3;margin:5px 0 10px}.ref-row{margin-top:8px;padding:10px;border-radius:10px;background:#0c1828;border:1px solid #304861}.ref-id{font-size:13px;font-weight:700;overflow-wrap:anywhere}.ref-count{font-size:23px;color:#a2e4bd;font-weight:800;min-height:28px}.ref-caption,.ref-state{font-size:11px;color:#a6bbd3;line-height:1.5}.ref-error{color:#edc38e}#referral-box button{font-size:11px;min-height:32px;margin-top:8px}

    /* Emas Hitam: solid midnight surfaces, restrained blue accents. */
    #panel{background:#0b101b;border:1px solid #354561;box-shadow:0 24px 70px #000b,inset 0 1px #ffffff0d;border-radius:22px}
    #panel-handle{background:#0b101b;padding:4px 0 12px;letter-spacing:1px;color:#dbe9ff}
    #panel-handle span:before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:#82acd6;box-shadow:0 0 10px #82acd655;margin-right:9px}
    #close{background:#181e2b;border-color:#35405a;min-height:34px;width:34px;padding:0;border-radius:50%}
    #bubble{width:48px;height:48px;background:linear-gradient(145deg,#365675,#101c30);box-shadow:0 8px 22px #0009,inset 0 2px #ffffff25}
    #search{background:linear-gradient(135deg,#375b84,#233b5b);border-color:#5c7ba3;box-shadow:inset 0 1px #ffffff20;font-weight:800;letter-spacing:.4px}
    #query{background:#080d16;border-color:#2f405b}input,textarea,select{border-radius:12px}button{transition:background .15s,border-color .15s}button:disabled{opacity:.45;cursor:default}
    #balance-box{margin-top:12px;border:1px solid #354561;border-radius:16px;padding:12px;background:linear-gradient(145deg,#172337,#0e1725)}
    .balance-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:800;letter-spacing:.8px}.balance-top button{font-size:11px;min-height:32px;padding:5px 9px}
    .balance-card{margin-top:10px;padding:13px;border:1px solid #34445d;border-radius:13px;background:#0b1320;overflow-wrap:anywhere}.balance-card.high{border-color:#92643a;background:linear-gradient(135deg,#302319,#17151a)}
    .balance-id{font-size:12px;color:#ceddf1;font-weight:700}.balance-number{font-size:27px;font-weight:800;letter-spacing:-.6px;margin:8px 0;color:#e6f0ff;font-variant-numeric:tabular-nums}.balance-card.high .balance-number{color:#f1c18c}
    .balance-caption{font-size:11px;line-height:1.6;color:#aabbd1}.balance-state{display:inline-block;margin:2px 0 8px;padding:5px 8px;border:1px solid #43546b;border-radius:6px;font-size:10px;font-weight:800}.high .balance-state{color:#f5cea1;border-color:#855e3c;background:#4b3120}
    #support-editor{margin-top:12px;border-top:1px solid #39485f;padding-top:12px}#support-editor label{display:block;font-size:12px;margin-bottom:8px}#support-text{min-height:180px;font-size:13px;line-height:1.65}#support-editor button{margin-top:8px}#balance-box .support-open{width:100%;margin-top:9px;font-size:12px;background:#694527;border-color:#9b734c}
    #referral-box{background:#111c2d;border-color:#354561}.check{background:#121c2b}.result-heading{background:linear-gradient(130deg,#213650,#152135)}

    /* Gold edition: high-contrast controls, opaque black surfaces. */
    #panel{background:linear-gradient(150deg,#26231c,#151411 60%,#1b1914);border:1px solid #b5964e;border-radius:22px;color:#fff2d1;box-shadow:0 24px 65px #000a,inset 0 1px #fff0b526}
    #panel-handle{background:linear-gradient(110deg,#ffe6a2,#edc65b 60%,#c99a36);color:#211b0c;border:1px solid #ffe9ac;margin:-3px -3px 13px;padding:11px 12px;border-radius:14px;min-height:52px;box-shadow:0 5px 16px #0005}
    #panel-handle span{font-size:15px;letter-spacing:1.6px;font-weight:850}#panel-handle span:before{background:#292418;box-shadow:0 0 0 3px #fff3;width:8px;height:8px;margin-right:10px}
    #close{display:grid;place-items:center;background:#27200f12;color:#30240c;border-color:#81652755;width:32px;min-height:32px;border-radius:9px}
    #bubble{width:48px;height:48px;border:1px solid #ffe9a6;background:linear-gradient(140deg,#fff0b6,#eac35e 52%,#ad7b24);color:#221b0a;box-shadow:0 8px 22px #0009,inset 0 2px 1px #fff9,inset 0 -2px 2px #80581566}
    button{color:#f9e9bc;background:linear-gradient(#393222,#27231a);border-color:#7a693f;border-radius:10px;box-shadow:inset 0 1px #fff1;min-height:42px}
    button:active{background:#594a28}button:hover:not(:disabled){filter:brightness(1.1)}button:disabled{opacity:.45}
    button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #ffdd7c;outline-offset:2px}
    input,textarea,select{color:#fff1cf;background:#15130e;border-color:#77633b;border-radius:11px}select option{background:#211e16;color:#fff1cf}
    input::placeholder,textarea::placeholder{color:#bbae8e;opacity:1}#query{background:#100f0c;border-color:#877044;color:#fff2d3;box-shadow:inset 0 2px 8px #0004}
    #search{color:#251b08;background:linear-gradient(120deg,#ffe599,#e5b94b);border-color:#ffe9a9;box-shadow:inset 0 1px #fff7,0 4px 12px #0004;font-weight:800}
    #status{color:#f5d889}#note,.hint,#tidy .hint{color:#c7b998}#note{font-size:11px}#prev,#next{display:grid;place-items:center;background:#30291b;border-color:#7a6639;color:#ffdf86}
    .check{background:#211e17;border-color:#655736;color:#e9dcbf;border-radius:13px}.match-title{color:#d8c28a}.match-value{color:#fff2cf}.match-bottom{color:#c9bda0}.match-bottom button{color:#ffdfa0;background:#3b321f;border-color:#86713b}
    .check.yes{background:linear-gradient(130deg,#20392b,#19251e);border-color:#628b64;color:#e3f5d6}.check.yes .match-value{color:#e9ffe2}.check.yes .match-title{color:#c1dfa7}.check.yes .match-bottom button{background:#304c32;color:#def6d4;border-color:#729469}
    .match-summary{background:#39301e;color:#fae8b6}.result-heading{background:linear-gradient(120deg,#514225,#2c2619);border-color:#a88c48}.result-heading strong{color:#ffe5a4}.result-heading small{color:#d4c7a5}.result-heading.good{background:linear-gradient(130deg,#2e4430,#202c23);border-color:#7a9566}.result-heading.good strong{color:#e9f3cd}
    .result-choice{background:#282318;border-color:#685733;color:#dfce9e}.result-choice small{color:#c9b789}.result-choice.active{background:#645026;border-color:#e5c66e;color:#fff0b5}
    #native-preview,#prefix-options,.account-card{background:#211d14;border-color:#8c723e;color:#edddb4}#native-preview strong,.account-card strong{color:#ffe4a0}#native-preview .native-value{color:#ffdf8c}#prefix-888{background:#53431f;border-color:#c5a453;color:#ffedbb}
    #balance-box{background:linear-gradient(135deg,#342c1b,#201c14);border-color:#a98a48;border-radius:16px}.balance-top{color:#ffe49b}.balance-card{background:#181610;border-color:#78633c}.balance-id{color:#f0d89d}.balance-number{color:#fff0b8}.balance-caption{color:#cbbb94}.balance-state{border-color:#7e714d;color:#e4d4a6;background:#2e291b}
    .balance-card.high{background:linear-gradient(130deg,#4e321b,#281e13);border-color:#d7a251}.balance-card.high .balance-number{color:#ffd582}.high .balance-state{background:#6e471f;color:#ffe5ad;border-color:#c79749}#balance-box .support-open{color:#231906;background:linear-gradient(125deg,#ffe199,#dcae43);border-color:#ffe2a0;font-weight:750}
    #support-editor{border-color:#7d683a}#support-editor label{color:#ffe6a3}#support-text{background:#14120d;color:#f5e7c4;border-color:#947847}
    #referral-box{background:linear-gradient(135deg,#302819,#1e1b13);border-color:#8d733f}.ref-heading{color:#ffe09b}.ref-dates,.ref-caption,.ref-state{color:#d0bf98}.ref-row{background:#17150f;border-color:#6b5831}.ref-id{color:#f4dfaa}.ref-count{color:#ffe49b}.ref-error{color:#ffc58b}
    #tidy{border-color:#6a5835}#tidy summary{color:#ffe39a}#tidy label{color:#e3d3ac}#tidy-status{color:#e8dbb1}#tidy-copy{background:#574720;border-color:#c5a456;color:#ffedb6}
    #tidy-toast{background:#312917;border-color:#d1ad58;color:#fff0bd;box-shadow:0 8px 28px #0009;border-radius:12px}
    @media(prefers-reduced-motion:reduce){button{transition:none}}

    #referral-box{padding:15px;border:1px solid #b8954d;border-radius:18px;background:linear-gradient(145deg,#39301e,#1a1812 70%);box-shadow:0 7px 20px #0004,inset 0 1px #fff0b51a}
    .ref-header{display:flex;align-items:center;justify-content:space-between;gap:10px}.ref-heading{font-size:13px;letter-spacing:1.4px;color:#ffe7a6}.ref-period{font-size:9px;letter-spacing:.8px;font-weight:800;padding:5px 8px;border:1px solid #aa8c46;border-radius:6px;color:#ffe5a0;background:#514323}
    .ref-dates{font-size:11px;color:#d1bd8d;margin:7px 0 12px}.ref-row{padding:14px;margin-top:10px;border-radius:14px;border:1px solid #88703e;background:linear-gradient(140deg,#2a2519,#15140f);box-shadow:inset 0 1px #ffffff0d}
    .ref-identity{padding-bottom:10px;border-bottom:1px solid #dcc27a25}.ref-id-label{display:block;font-size:9px;color:#b7a77f;letter-spacing:1.2px;margin-bottom:4px}.ref-id{font-size:15px;font-weight:750;color:#fff0c1;overflow-wrap:anywhere}
    .ref-metric{text-align:center;padding:16px 4px 12px}.ref-count{font-size:42px;line-height:1.15;font-weight:800;letter-spacing:-1px;color:#ffe298;min-height:48px;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.ref-caption{font-size:9px;font-weight:700;letter-spacing:1.4px;color:#cbb684;margin-top:6px}
    .ref-badge{border:1px solid #aa8b41;border-radius:7px;padding:6px 8px;font-size:9px;font-weight:800;letter-spacing:.5px;text-align:center;background:#4e401f;color:#ffe8ad}
    .ref-state{font-size:11px;color:#cfc0a0;line-height:1.6;margin-top:9px;text-align:center}.ref-total{font-size:11px;color:#e1ca96;text-align:center;margin-top:7px}
    .ref-active{border-color:#bfa05a}.ref-empty .ref-badge{background:#302b1e;border-color:#716448;color:#d5c7a5}.ref-error .ref-badge{background:#482721;border-color:#aa6b51;color:#ffd1b8}.ref-error .ref-count{color:#e8b59d}.ref-loading .ref-count{color:#c8b581}
    #referral-box .ref-retry{width:100%;min-height:36px;margin-top:12px;font-size:11px;background:linear-gradient(#423820,#2e281b);border-color:#8f783f;color:#ffe5a2}.ref-wait{padding:14px 10px;border:1px dashed #7d6a3d;border-radius:12px;background:#211d14}

    #account-warning{margin-top:12px;padding:13px;border:1px solid #d1a04e;border-radius:15px;background:linear-gradient(140deg,#45301b,#231b12);box-shadow:0 6px 16px #0004}
    .account-warning-heading{color:#ffe3a0;font-size:12px;font-weight:800;letter-spacing:.6px;margin-bottom:7px}.account-warning-note{color:#e1c69e;font-size:11px;line-height:1.6;margin:6px 0}
    .account-warning-card{margin-top:10px;padding:11px;background:#1d1810;border:1px solid #8b6936;border-radius:11px}.account-warning-id{color:#ffdf9a;font-size:12px;font-weight:750;overflow-wrap:anywhere}.account-warning-label{font-size:10px;color:#bba783;margin-top:9px}.account-warning-number{font:700 16px/1.6 ui-monospace,monospace;color:#fff0c0;overflow-wrap:anywhere}.account-warning-number mark{background:#f0c466;color:#241a08;border-radius:4px;padding:2px 4px;margin-left:2px}.account-warning-card button{width:100%;margin-top:9px;min-height:36px;font-size:11px;background:#59421f;border-color:#b28a44;color:#ffe7ac}
  </style>
  <div id="marks"></div>
  <button id="bubble" title="Cari User ID / rekening" aria-label="Buka pencarian"><svg width="31" height="31" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="3" y="5" width="23" height="21" rx="5" fill="#17150e" stroke="#ffe8a0" stroke-width="1.5"/><circle cx="11" cy="12" r="3" fill="#f4cc64"/><path d="M6.5 21c0-5.3 9-5.3 9 0" stroke="#f4cc64" stroke-width="2" stroke-linecap="round"/><path d="M18 10h4M18 14h3" stroke="#fff0be" stroke-width="1.7" stroke-linecap="round"/><circle cx="23" cy="23" r="5" fill="#f9d679" stroke="#15110a" stroke-width="2"/><path d="m26.5 26.5 3 3" stroke="#15110a" stroke-width="3" stroke-linecap="round"/></svg></button>
  <section id="panel" hidden aria-label="Cari di halaman">
    <div class="title" id="panel-handle" title="Sentuh judul lalu geser"><span>CARI ID</span><button id="close" aria-label="Tutup"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
    <div class="row"><select id="mode" aria-label="Jenis pencarian"><option value="auto">Sekali tempel chat \u2014 cari semua</option><option value="admin_id">Cari User ID di admin (otomatis)</option><option value="admin_bank">Cari nomor rekening di admin (otomatis)</option><option value="id">Ctrl F \u2014 User ID di halaman</option><option value="name">Nama rekening</option><option value="text">Ctrl F \u2014 teks di halaman</option><option value="bank">Nomor rekening</option></select></div>
    <div class="row"><textarea id="query" rows="3" placeholder="Tempel chat: nama, nomor rekening, bank / e-wallet\u2026" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="enter"></textarea></div>
    <div class="row"><button id="search">Cari semua</button><button id="clear">Hapus</button></div>
    <div id="prefix-row" hidden><button id="prefix-888" type="button" title="Tambahkan 888 di depan nomor rekening">+888</button></div>
    <div id="prefix-options" hidden></div>
    <div class="row"><span id="status" role="status" aria-live="polite">Masukkan pencarian</span><button id="prev" aria-label="Hasil sebelumnya"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg></button><button id="next" aria-label="Hasil berikutnya"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button></div>
    <div id="native-preview" hidden></div><div id="checks"></div><section id="account-warning" hidden aria-live="polite"></section><section id="balance-box" hidden aria-live="polite"></section><section id="referral-box" hidden aria-live="polite"></section>
    <div id="note">Mencari teks yang sudah dimuat pada halaman ini.</div>
    <details id="tidy">
      <summary>RAPIKAN &amp; SALIN</summary>
      <div class="hint">Rapikan teks atau nomor tanpa mengubah kolom pencarian di atas.</div>
      <button id="tidy-from-query" type="button">Ambil teks pencarian</button>
      <label for="tidy-source">Teks asli</label>
      <textarea id="tidy-source" rows="3" placeholder="Tempel teks atau nomor rekening di sini\u2026" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
      <label for="tidy-format">Cara merapikan</label>
      <select id="tidy-format">
        <option value="account">Nama + nomor + bank (salin satu-satu)</option>
        <option value="text">Teks rapi \u2014 garis pemisah jadi baris</option>
        <option value="bank">Nomor saja \u2014 hapus spasi, titik, strip</option>
      </select>
      <div class="row"><button id="tidy-run" type="button">Rapikan</button><button id="tidy-reset" type="button">Hapus</button></div>
      <div id="tidy-fields"></div>
      <label for="tidy-result">Hasil \u2014 dapat diedit sebelum disalin</label>
      <textarea id="tidy-result" rows="4" placeholder="Hasil rapi muncul di sini\u2026" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
      <div class="row"><button id="tidy-copy" type="button" disabled>Salin hasil</button></div>
      <div id="tidy-status" role="status" aria-live="polite"></div>
      <p class="hint">Nomor berbeda: pisahkan dengan Enter, /, atau |. Mode nomor menganggap angka berspasi dalam satu bagian sebagai satu nomor. Periksa hasil sebelum disalin.</p>
    </details>
  </section>
  <div id="tidy-toast" role="status" hidden></div>`;
  const $ = id => root.getElementById(id);
  const bubble = $('bubble'), panel = $('panel'), input = $('query'), mode = $('mode');
  let bundle = null, bundles = [];
  let hits = [], index = -1, serial = 0, timer, frame = 0, dirty = true, clipped = false;
  let position = {x:innerWidth-58,y:innerHeight*0.6};
  try {position = GM_getValue('bubble-position',position);} catch (_) {}
  let panelPosition={x:10,y:10};
  try{const saved=GM_getValue('panel-position',panelPosition);if(Number.isFinite(saved?.x)&&Number.isFinite(saved?.y))panelPosition=saved;}catch(_){}
  const viewport = () => {const v=window.visualViewport;return {x:v?.offsetLeft||0,y:v?.offsetTop||0,w:v?.width||innerWidth,h:v?.height||innerHeight};};
  function place(){
    const v=viewport();position.x=Math.max(v.x+6,Math.min(position.x,v.x+v.w-50));position.y=Math.max(v.y+6,Math.min(position.y,v.y+v.h-50));
    bubble.style.left=position.x+'px';bubble.style.top=position.y+'px';
    const w=Math.min(370,Math.max(160,v.w-20));
    panelPosition.x=Math.max(6,Math.min(panelPosition.x,Math.max(6,v.w-w-6)));
    panelPosition.y=Math.max(6,Math.min(panelPosition.y,Math.max(6,v.h-130)));
    panel.style.left=(v.x+panelPosition.x)+'px';panel.style.top=(v.y+panelPosition.y)+'px';
    panel.style.width=w+'px';panel.style.maxHeight=Math.max(70,v.h-panelPosition.y-10)+'px';
  }
  place();
  let drag=null, suppressClickUntil=0;
  function savePosition(){try{GM_setValue('bubble-position',position);}catch(_){}}
  function startDrag(id,x,y,target='bubble'){
    const pos=target==='panel'?panelPosition:position;
    drag={id,x,y,bx:pos.x,by:pos.y,moved:false,target};
  }
  function moveDrag(id,x,y){
    if(!drag||drag.id!==id)return;
    const dx=x-drag.x,dy=y-drag.y;
    if(Math.hypot(dx,dy)>7)drag.moved=true;
    if(drag.moved){const pos={x:drag.bx+dx,y:drag.by+dy};if(drag.target==='panel')panelPosition=pos;else position=pos;place();}
  }
  function endDrag(id,cancelled=false){
    if(!drag||drag.id!==id)return;
    const moved=drag.moved,target=drag.target;drag=null;
    suppressClickUntil=Date.now()+700;
    if(target==='panel'){if(moved){try{GM_setValue('panel-position',panelPosition);}catch(_){}}return;}
    if(moved)savePosition();
    else if(!cancelled)toggle();
  }
  bubble.style.setProperty('touch-action','none');
  bubble.style.setProperty('-webkit-user-select','none');
  bubble.style.setProperty('-webkit-touch-callout','none');
  bubble.addEventListener('contextmenu',e=>e.preventDefault());
  bubble.addEventListener('dragstart',e=>e.preventDefault());
  if(window.PointerEvent){
    bubble.addEventListener('pointerdown',e=>{
      if(!e.isPrimary||drag||(e.pointerType==='mouse'&&e.button!==0))return;
      e.preventDefault();e.stopPropagation();startDrag(e.pointerId,e.clientX,e.clientY);
      try{bubble.setPointerCapture(e.pointerId);}catch(_){}
    });
    window.addEventListener('pointermove',e=>{
      if(!drag||drag.id!==e.pointerId)return;
      e.preventDefault();moveDrag(e.pointerId,e.clientX,e.clientY);
    },{capture:true,passive:false});
    window.addEventListener('pointerup',e=>endDrag(e.pointerId),true);
    window.addEventListener('pointercancel',e=>endDrag(e.pointerId,true),true);
    bubble.addEventListener('lostpointercapture',e=>endDrag(e.pointerId,true));
  }else{
    bubble.addEventListener('touchstart',e=>{
      if(drag||e.touches.length!==1)return;
      const t=e.changedTouches[0];e.preventDefault();e.stopPropagation();startDrag(t.identifier,t.clientX,t.clientY);
    },{passive:false});
    window.addEventListener('touchmove',e=>{
      if(!drag)return;
      for(const t of e.changedTouches)if(t.identifier===drag.id){e.preventDefault();moveDrag(t.identifier,t.clientX,t.clientY);}
    },{capture:true,passive:false});
    window.addEventListener('touchend',e=>{for(const t of e.changedTouches)endDrag(t.identifier);},true);
    window.addEventListener('touchcancel',e=>{for(const t of e.changedTouches)endDrag(t.identifier,true);},true);
    bubble.addEventListener('mousedown',e=>{if(e.button!==0||Date.now()<suppressClickUntil)return;e.preventDefault();startDrag('mouse',e.clientX,e.clientY);});
    window.addEventListener('mousemove',e=>moveDrag('mouse',e.clientX,e.clientY),true);
    window.addEventListener('mouseup',()=>endDrag('mouse'),true);
  }
  const handle=$('panel-handle');
  const isClose=e=>e.target.closest?.('button');
  handle.addEventListener('contextmenu',e=>{if(!isClose(e))e.preventDefault();});
  if(window.PointerEvent){
    handle.addEventListener('pointerdown',e=>{
      if(isClose(e)||!e.isPrimary||drag||(e.pointerType==='mouse'&&e.button!==0))return;
      e.preventDefault();e.stopPropagation();startDrag(e.pointerId,e.clientX,e.clientY,'panel');
      try{handle.setPointerCapture(e.pointerId);}catch(_){}
    });
    handle.addEventListener('lostpointercapture',e=>endDrag(e.pointerId,true));
  }else{
    handle.addEventListener('touchstart',e=>{
      if(isClose(e)||drag||e.touches.length!==1)return;
      const t=e.changedTouches[0];e.preventDefault();e.stopPropagation();startDrag(t.identifier,t.clientX,t.clientY,'panel');
    },{passive:false});
    handle.addEventListener('mousedown',e=>{
      if(isClose(e)||drag||e.button!==0||Date.now()<suppressClickUntil)return;
      e.preventDefault();startDrag('mouse',e.clientX,e.clientY,'panel');
    });
  }
  window.addEventListener('blur',()=>{if(drag)endDrag(drag.id,true);});
  bubble.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    if(Date.now()<suppressClickUntil)return;
    toggle();
  });
  function toggle(){panel.hidden=!panel.hidden;if(!panel.hidden){place();if(root.getElementById('qris-menu')&&!root.getElementById('qris-menu').hidden){root.getElementById('q-id').focus();}else{input.focus();if(input.value)search(false);}}else{serial++;$('marks').replaceChildren();}}
  $('close').onclick=()=>{panel.hidden=true;serial++;$('marks').replaceChildren();};
  function clear(){clearAccountWarning();clearBalance();stopReferralWatch();prefix888Applied='';refreshPrefix888();$('native-preview').hidden=true;$('native-preview').replaceChildren();bundle=null;bundles=[];$('checks').replaceChildren();serial++;clearTimeout(timer);hits=[];index=-1;$('marks').replaceChildren();$('status').textContent='Masukkan pencarian';}
  $('clear').onclick=()=>{input.value='';clear();input.focus();};
  mode.onchange=()=>{stopReferralWatch();refreshPrefix888();input.inputMode='text';input.placeholder=mode.value==='admin_id'?'Tempel chat: User ID / username / user name\u2026':mode.value==='admin_bank'?'Tempel chat yang memuat nomor rekening\u2026':mode.value==='bank'?'Ketik nomor rekening\u2026':mode.value==='name'?'Ketik nama atau tempel data rekening\u2026':mode.value==='auto'?'Tempel bebas: nama, rekening, bank\u2026':'Ketik User ID atau teks\u2026';$('search').textContent=isNativeMode()?'Cari di admin':'Cari';search(false);};
  input.oninput=()=>{stopReferralWatch();prefix888Applied='';refreshPrefix888();clearAccountWarning();clearBalance();serial++;clearTimeout(timer);timer=setTimeout(()=>search(false),300);};
  input.addEventListener('paste',e=>{
    if(!['admin_id','id'].includes(mode.value))return;
    const text=e.clipboardData?.getData('text/plain');if(!text)return;
    const values=extractSearchValues(text,'id');
    if(values.length!==1)return;
    e.preventDefault();input.value=values[0];input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  input.onkeydown=e=>{if(e.key==='Enter'&&(isNativeMode()||mode.value==='id'||e.ctrlKey||e.metaKey)&&!e.shiftKey){e.preventDefault();input.blur();if(isNativeMode())runNativeSearch();else search(true);}if(e.key==='Escape')$('close').click();};
  $('search').onclick=()=>{input.blur();if(isNativeMode())runNativeSearch();else search(true);};
  function status(){ renderChecks();refreshBalance();refreshAccountWarning();$('status').textContent=hits.length?`${index+1} / ${hits.length}${clipped?'+':''} hasil`:'Tidak ditemukan';}
  function navigate(delta){if(dirty){search(true);return;}if(!hits.length)return;index=(index+delta+hits.length)%hits.length;reveal();}
  $('prev').onclick=()=>navigate(-1);$('next').onclick=()=>navigate(1);
  function reveal(){const h=hits[index];if(!h)return;const el=h.el||h.range.startContainer.parentElement;let w=el.ownerDocument.defaultView;while(w&&w!==window){try{const f=w.frameElement;if(!f)break;f.scrollIntoView({block:'center',inline:'center',behavior:'instant'});w=w.parent;}catch(_){break;}}el.scrollIntoView({block:'center',inline:'center',behavior:'instant'});if(h.el){try{h.el.setSelectionRange(h.start,h.end);}catch(_){}}status();schedulePaint();}
  function schedulePaint(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;paint();});}
  function paint(){const marks=$('marks');marks.replaceChildren();if(panel.hidden)return;const fragment=document.createDocumentFragment();let count=0;for(let i=0;i<hits.length;i++){const h=hits[i];if(!(h.el||h.range.startContainer).isConnected)continue;const rects=h.parts?h.parts.flatMap(p=>p.el?[p.el.getBoundingClientRect()]:Array.from(p.range.getClientRects())):h.el?[h.el.getBoundingClientRect()]:h.range.getClientRects();for(const rawRect of rects){const r=topRect(rawRect,(h.el||h.range?.startContainer||h.parts?.[0]?.range.startContainer).ownerDocument);if(!r.width||!r.height||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)continue;const mark=document.createElement('div');mark.className='hit'+(h.parts?' good':'')+(i===index?' current':'');mark.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;fragment.append(mark);if(++count>=400)break;}if(count>=400)break;}marks.append(fragment);}
  function visible(el){if(!el||el.closest('script,style,noscript,template,[hidden],[inert]'))return false;const s=el.ownerDocument.defaultView.getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&s.visibility!=='collapse'&&el.getClientRects().length>0;}
  // Keep inline fragments together, but never join separate table cells/blocks.
  function block(el){while(el&&el!==document.body){const d=el.ownerDocument.defaultView.getComputedStyle(el).display;if(!['inline','contents'].includes(d))return el;el=el.parentElement;}return document.body;}
  const watchedDocuments=new WeakSet();
  let inaccessibleFrames=0;
  function searchDocuments(){
    const docs=[],seen=new Set();inaccessibleFrames=0;
    function visit(doc){
      if(!doc?.body||seen.has(doc))return;seen.add(doc);docs.push(doc);
      if(!watchedDocuments.has(doc)){
        watchedDocuments.add(doc);doc.addEventListener('scroll',schedulePaint,true);
        if(doc!==document){
          new MutationObserver(()=>{scheduleReferralScan();scheduleBalance();dirty=true;if(!panel.hidden&&input.value){clearTimeout(timer);timer=setTimeout(()=>search(false),650);}}).observe(doc.body,{subtree:true,childList:true,characterData:true});
        }
      }
      for(const f of doc.querySelectorAll('iframe,frame')){
        if(!visible(f))continue;
        try{const child=f.contentDocument;if(child)visit(child);else inaccessibleFrames++;}catch(_){inaccessibleFrames++;}
      }
    }
    visit(document);return docs;
  }
  function topRect(rect,doc){
    let left=rect.left,top=rect.top,width=rect.width,height=rect.height,w=doc.defaultView;
    while(w&&w!==window){
      try{
        const f=w.frameElement;if(!f)break;const box=f.getBoundingClientRect();
        const sx=f.offsetWidth?box.width/f.offsetWidth:1,sy=f.offsetHeight?box.height/f.offsetHeight:1;
        left=box.left+(left+f.clientLeft)*sx;top=box.top+(top+f.clientTop)*sy;width*=sx;height*=sy;w=w.parent;
      }catch(_){break;}
    }
    return {left,top,width,height,right:left+width,bottom:top+height};
  }
  function pattern(){if(mode.value==='name')return namePattern(nameQuery(input.value));const raw=(mode.value==='id'||mode.value==='auto')?cleanID(input.value):input.value.trim();if(!raw)return null;if(mode.value==='bank'){const options=extractSearchValues(input.value,'bank');if(options.length!==1)return null;const digits=options[0];return new RegExp(digits.split('').join('[\\s.\\-]*'),'g');}return new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');}
  async function search(jump){clearAccountWarning();clearBalance();if(isNativeMode()){serial++;clearTimeout(timer);hits=[];index=-1;bundle=null;bundles=[];$('checks').replaceChildren();$('marks').replaceChildren();previewNative();return;}$('native-preview').hidden=true;const token=++serial;clearTimeout(timer);hits=[];index=-1;clipped=false;$('marks').replaceChildren();if(!input.value.trim()){clear();return;}bundles=mode.value==='auto'?extractAccounts(input.value):[];if(mode.value==='auto'&&!bundles.length)bundles=[{label:'Chat ditempel',raw:input.value,name:'',number:'',bank:''}];if(mode.value==='auto'&&/^[a-z_][a-z0-9_]*[0-9][a-z0-9_]*$/i.test(cleanID(input.value))&&!bundles.some(q=>q.name||q.number||q.bank))bundles=[];bundle=bundles[0]||null;$('checks').replaceChildren();$('note').textContent='Mencari teks yang sudah dimuat pada halaman ini.';if(bundle){await searchBundle(token,jump);return;}const regex=pattern();if(!regex){$('status').textContent=mode.value==='bank'?'Masukkan angka rekening':mode.value==='name'?'Masukkan nama rekening yang jelas':'Masukkan User ID';return;}$('status').textContent='Mencari\u2026';
    const groups=[];let steps=0;const documents=searchDocuments();
    for(const doc of documents){
      let group=null,owner=null,n;
      const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT,{acceptNode(node){const p=node.parentElement;return p&&!host.contains(p)&&!p.closest('textarea,select')&&visible(p)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
      while((n=walker.nextNode())){
        const b=block(n.parentElement);if(b!==owner){owner=b;group={text:'',nodes:[]};groups.push(group);}
        group.nodes.push({node:n,start:group.text.length});group.text+=n.data;
        if(++steps%600===0){await new Promise(r=>setTimeout(r,0));if(token!==serial)return;}
      }
    }
    const found=[];
    for(const g of groups){regex.lastIndex=0;let m;while((m=regex.exec(g.text))){const end=m.index+m[0].length;const first=g.nodes.find(x=>x.start+x.node.length>m.index);const last=g.nodes.find(x=>x.start+x.node.length>=end);if(!first||!last)continue;const range=first.node.ownerDocument.createRange();try{range.setStart(first.node,m.index-first.start);range.setEnd(last.node,end-last.start);if(range.getClientRects().length)found.push({range});}catch(_){}if(found.length>=2000){clipped=true;break;}}if(clipped)break;if(++steps%250===0){await new Promise(r=>setTimeout(r,0));if(token!==serial)return;}}
    if(!clipped)for(const el of documents.flatMap(doc=>Array.from(doc.querySelectorAll('input:not([type]),input[type="text"],input[type="search"],input[type="tel"],input[type="number"],textarea')))){if(!visible(el))continue;regex.lastIndex=0;let m;while((m=regex.exec(el.value))){found.push({el,start:m.index,end:m.index+m[0].length});if(found.length>=2000){clipped=true;break;}}if(clipped)break;}
    if(token!==serial)return;hits=found;index=hits.length?0:-1;dirty=false;status();if(!hits.length)$('note').textContent=inaccessibleFrames?'Ada frame yang tidak dapat diakses. Buka tabel langsung di tab baru lalu cari lagi.':(mode.value==='name'?'Nama':'ID')+' tidak ditemukan pada teks yang sudah dimuat. Periksa halaman/halaman berikutnya pada tabel.';if(jump&&hits.length)reveal();else schedulePaint();
  }

  // A zero in a bank name remains a zero: 0vo is NOT silently changed to OVO.
  // PURE_HELPERS_START
  function cleanID(value){const candidates=extractSearchValues(value,'id');return candidates.length===1?candidates[0]:String(value).normalize('NFKC').trim();}
  function parseBundle(value) {
    const text=value.normalize('NFKC').replace(/\r/g,'').trim();
    if(!text)return null;
    const result={bank:'',number:'',name:''};
    // Longer labels first; label boundaries also work when pasted on one line.
    const labels=/\b(nama\s*(?:bank|bqnk|bnk)|jenis\s*(?:bank|bqnk|bnk)|bank|bqnk|bnk|bangk|e[ -]?wallet|dompet(?:\s*digital)?|nama\s*(?:rekening|rek|pemilik|penerima)|atas\s*nama|a\s*[/.]\s*n\.?|an\.|nomor\s*(?:rekening|rek)|no\.?\s*(?:rekening|rek)|norek|no\s*rek|rekening|rek\.?|nm\.?(?:\s*(?:rekening|rek))?|nama)\b\s*[:=\-]?\s*/gi;
    const bankPattern=/\b(?:BCA|BRI|BNI|BSI|MANDIRI|CIMB(?:\s+NIAGA)?|PERMATA|DANAMON|BTN|MAYBANK|OCBC|PANIN|MEGA|JAGO|SEABANK|NEOBANK|DANA|OVO|0VO|GO\s*PAY|SHOPEE\s*PAY|LINK\s*AJA)\b/i;
    const clean=v=>v.replace(/^[\s.:=,;|/\-]+|[\s.:=,;|/\-]+$/g,'').replace(/\s+/g,' ');
    const found=Array.from(text.matchAll(labels));
    for(let i=0;i<found.length;i++){
      const m=found[i],label=m[1].toLowerCase();
      let tail=text.slice(m.index+m[0].length,found[i+1]?.index??text.length).trim();
      const numberLabel=/^(?:nomor|no\.?|norek|rekening|rek)/i.test(label);
      const key=numberLabel?'number':/bank|bqnk|bnk|bangk|wallet|dompet/.test(label)?'bank':'name';
      if(key==='number'){
        const match=tail.match(/(?<!\d)\d(?:[\d .\-]*\d)?(?!\d)/);
        const digits=match?.[0].replace(/\D/g,'')||'';
        if(digits.length>=5&&digits.length<=24)result.number=digits;
      }else{
        tail=tail.split(/[\n;|,]/)[0];
        const numberAt=tail.search(/\d(?:[\d .-]*\d){4}/);
        if(numberAt>=0)tail=tail.slice(0,numberAt);
        if(key==='bank'){
          const known=tail.match(bankPattern);
          tail=known?known[0]:tail;
        }else{
          // A bank name after a name is a boundary, not part of the holder's name.
          const bankAt=tail.search(bankPattern);
          if(bankAt>0)tail=tail.slice(0,bankAt);
        }
        tail=clean(tail);
        if(tail&&!/\d{5}/.test(tail))result[key]=tail;
      }
    }
    if(!result.number){
      const candidates=Array.from(text.matchAll(/(?<![\p{L}\p{N}])\d(?:[\d .\-]*\d)?(?![\p{L}\p{N}])/gu))
        .map(m=>m[0].replace(/\D/g,'')).filter(n=>n.length>=5&&n.length<=24);
      // One unlabelled number is safe to extract; do not guess among several.
      if(candidates.length===1)result.number=candidates[0];
    }
    if(!result.bank){
      const known=text.match(bankPattern);
      if(known)result.bank=known[0];
    }
    if(!found.length){
      // Preserve the original compact format, including an unknown/incorrect bank.
      const compact=text.match(/^(\S+)\s+(\d(?:[\d .-]*\d)?)\s+([\p{L}][\p{L} .'-]*)$/u);
      if(compact&&compact[2].replace(/\D/g,'')===result.number){
        result.bank=compact[1];result.name=clean(compact[3]);
      }
    }
    if(!result.name&&!found.length&&result.number&&result.bank){
      let rest=text.replace(bankPattern,' ').replace(/\d(?:[\d .-]*\d)?/g,' ');
      rest=clean(rest);
      if(rest&&/^[\p{L} .'-]+$/u.test(rest)&&rest.split(/\s+/).length<=6&&!/\b(?:tolong|cek|cari|transfer|kirim|terima|kasih|ini|ya)\b/i.test(rest))result.name=rest;
    }
    return result.number||result.name||result.bank?result:null;
  }
  function escapeRE(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function fieldMatch(text,value,kind){
    if(!value)return null;
    if(kind==='bank'){value=value.replace(/^bank\s+/i,'');const compact=value.replace(/[\s.\-]/g,'').toUpperCase();if(['CIMB','CIMBNIAGA'].includes(compact))value='CIMB';if(['OCBC','OCBCNISP'].includes(compact))value='OCBC';const re=namePattern(value);if(!re)return null;const m=re.exec(text);return m?{start:m.index,end:m.index+m[0].length}:null;}
    if(kind==='name'){const re=namePattern(value);if(!re)return null;const m=re.exec(text);return m?{start:m.index,end:m.index+m[0].length}:null;}
    const source=kind==='number'?value.split('').join('[\\s.\\-\u2010\u2011\u2013\u2014]*'):value.split(/\s+/).map(escapeRE).join('\\s+');
    const re=new RegExp(source,'giu');let m;
    while((m=re.exec(text))){
      const before=text.slice(0,m.index),after=text.slice(m.index+m[0].length);
      const word=kind==='number'?/[0-9]/u:/[\p{L}\p{N}_]/u;
      if((before&&word.test(before.slice(-1)))||(after&&word.test(after[0])))continue;
      return {start:m.index,end:m.index+m[0].length};
    }
    return null;
  }
  function parseBundles(value){
    const text=value.normalize('NFKC').trim();
    const markers=Array.from(text.matchAll(/\b(?:akun|rekening|data)\s+(?:yang\s+)?(?:terdaftar|baru|lama|pengganti)\s*[:=]?\s*/gi));
    const chunks=[];
    if(markers.length){
      const prefix=text.slice(0,markers[0].index).trim();
      if(/\d{5}/.test(prefix))chunks.push({text:prefix,label:'Data awal'});
      markers.forEach((m,i)=>chunks.push({label:m[0].replace(/[:=\s]+$/g,''),text:text.slice(m.index+m[0].length,markers[i+1]?.index??text.length)}));
    }else{
      const lines=text.split(/\n|;/).filter(t=>t.trim());
      const numbered=lines.filter(t=>/\d{5}/.test(t));
      if(numbered.length>1)numbered.forEach(t=>chunks.push({text:t,label:'Akun '+(chunks.length+1)}));
      else chunks.push({text,label:'Akun 1'});
    }
    const results=[];
    for(const chunk of chunks){
      const raw=chunk.text.replace(/^[\s.;|]+|[\s.;|]+$/g,'');
      const numeric=Array.from(raw.matchAll(/(?<![\p{L}\p{N}])\d(?:[\d .-]*\d)?(?![\p{L}\p{N}])/gu))
        .map(m=>m[0].replace(/\D/g,'')).filter(n=>n.length>=5&&n.length<=24);
      const numbers=[...new Set(numeric)];
      if(numbers.length>1){
        // Unclear association: search each number without borrowing a name/bank.
        numbers.forEach((number,i)=>results.push({bank:'',name:'',number,label:chunk.label+' / nomor '+(i+1)}));continue;
      }
      let parsed=parseBundle(raw);
      // Slash/pipe/comma-separated records, including name/number/bank.
      const parts=raw.replace(/\ba\s*\/\s*n\b/gi,'Atas nama').split(/[\/|,]/).map(t=>t.trim().replace(/\.+$/,'')).filter(Boolean);
      if(parts.length>1&&numbers.length===1){
        const number=numbers[0];
        const bankRE=/^(?:BCA|BRI|BNI|BSI|MANDIRI|CIMB(?:\s+NIAGA)?|PERMATA|DANAMON|BTN|MAYBANK|OCBC|PANIN|MEGA|JAGO|SEABANK|NEOBANK|DANA|OVO|0VO|GO\s*PAY|SHOPEE\s*PAY|LINK\s*AJA)$/i;
        const bank=parts.find(p=>bankRE.test(p))||parsed?.bank||'';
        const possibleNames=parts.filter(p=>!bankRE.test(p)&&!/[0-9]/.test(p)&&/^[\p{L} .'-]+$/u.test(p)&&!/^\s*(?:bank|bqnk|bnk)\b/i.test(p));
        let name=parsed?.name||'';
        if(possibleNames.length===1)name=possibleNames[0].replace(/^(?:atas\s*nama|nama\s*(?:rek(?:ening)?)?|nm)\s*[:.-]?\s*/i,'').trim();
        parsed={bank,number,name};
      }
      if(parsed)results.push({...parsed,label:chunk.label});
    }
    return results;
  }
  function selectAccountHits(candidates,queries){
    const selected=[];
    for(const query of queries){
      const own=candidates.filter(h=>h.query===query);
      const anchor=own.some(h=>h.matches.number)?'number':own.some(h=>h.matches.name)?'name':'bank';
      selected.push(...own.sort((a,b)=>matchScore(b)-matchScore(a)));
    }
    return selected;
  }

  // ACCOUNT_HELPERS_START
  function namePattern(value){
    const letters=String(value).normalize('NFKC').replace(/[^\p{L}\p{M}\p{N}]/gu,'');
    if(letters.length<2)return null;
    // Match literal letters in order; separators/case may differ, spelling may not.
    return new RegExp('(?<![\\p{L}\\p{N}])'+Array.from(letters).map(escapeRE).join('[\\s\\p{P}\\u200B]*')+'(?![\\p{L}\\p{N}])','giu');
  }
  function nameQuery(value){
    const accounts=extractAccounts(value);
    if(accounts.length===1&&accounts[0].name)return accounts[0].name;
    const raw=String(value).trim().replace(/^(?:nama\s*(?:rekening|pemilik|penerima)?|atas\s*nama|a\s*[/.]\s*n)\s*[:=\-]?\s*/i,'');
    return /^[\p{L}\p{M}\s.'\u2019\-]+$/u.test(raw)?raw:'';
  }
  function extractAccounts(value){
    const text=String(value).normalize('NFKC').replace(/\r\n?/g,'\n').replace(/[\u200B\u2060\uFEFF]/g,'').trim();
    if(!text)return [];
    const bankRE=/\b(?:BCA|BRI|BNI|BSI|MANDIRI|CIMB(?:\s+NIAGA)?|PERMATA|DANAMON|BTN|MAYBANK|OCBC(?:\s+NISP)?|PANIN|MEGA|JAGO|SEABANK|NEOBANK|DANA|OVO|0VO|GO\s*PAY|SHOPEE\s*PAY|LINK\s*AJA)\b/gi;
    const markers=Array.from(text.matchAll(/\b(?:akun|rekening|data)\s+(?:yang\s+)?(?:terdaftar|baru|lama|pengganti)\s*[:=]?\s*/gi));
    let chunks=[];
    if(markers.length){
      if(text.slice(0,markers[0].index).trim())chunks.push({text:text.slice(0,markers[0].index),label:'Data awal'});
      markers.forEach((m,i)=>chunks.push({text:text.slice(m.index+m[0].length,markers[i+1]?.index??text.length),label:m[0].replace(/[:=\s]+$/g,'')}));
    }else chunks=text.split(/\n\s*\n/).filter(t=>t.trim()).map((t,i)=>({text:t,label:'Akun '+(i+1)}));
    const results=[];
    for(const chunk of chunks){
      const raw=chunk.text.trim();
      const lines=raw.split(/\n|;/).filter(t=>t.trim());
      const numRE=/(?<![\p{L}\p{N}_])\d(?:[\d \t.\-\u2010\u2011\u2013\u2014]*\d)?(?![\p{L}\p{N}_])/gu;
      const nums=t=>Array.from(t.matchAll(numRE)).map(m=>m[0].replace(/\D/g,'')).filter(n=>n.length>=5);
      const numbers=nums(raw);
      if(numbers.length>1){
        // Complete records on separate lines can be handled independently.
        if(lines.filter(t=>nums(t).length).length===numbers.length&&lines.every(t=>nums(t).length===1)){
          lines.forEach(t=>extractAccounts(t).forEach(a=>results.push({...a,label:chunk.label+' / '+(results.length+1)})));continue;
        }
        numbers.forEach((number,i)=>results.push({name:'',bank:'',number,label:chunk.label+' / nomor '+(i+1),raw,uncertain:true}));continue;
      }
      const record={name:'',bank:'',number:numbers[0]||'',label:chunk.label,raw};
      const labels=/\b(nama\s*bank|jenis\s*bank|bank|e[ -]?wallet|nama\s*(?:rekening|rek|pemilik|penerima)|atas\s*nama|a\s*[/.]\s*n\.?|nomor\s*(?:rekening|rek)|no\.?\s*(?:rekening|rek)|norek|rekening|rek\.?|nama)\s*[:=\-]?\s*/gi;
      const found=Array.from(raw.matchAll(labels));
      const clean=v=>v.replace(/^[\s:;=|/.,\-\u2013\u2014]+|[\s:;=|/.,\-\u2013\u2014]+$/g,'').replace(/\s+/g,' ');
      for(let i=0;i<found.length;i++){
        const m=found[i],label=m[1].toLowerCase();
        let tail=raw.slice(m.index+m[0].length,found[i+1]?.index??raw.length).split(/[\n|/;]/)[0];
        if(/bank|wallet/.test(label))record.bank=clean(tail.replace(numRE,''));
        else if(/^(?:nama|atas|a\s*[/.])/.test(label))record.name=clean(tail.replace(numRE,'').replace(bankRE,''));
      }
      const banks=Array.from(raw.matchAll(bankRE));
      if(!record.bank&&banks.length===1)record.bank=banks[0][0];
      if(!record.name){
        let rest=raw.replace(labels,' ').replace(bankRE,' ').replace(numRE,' ')
          .replace(/[|/:;=,\u2022\u25cf\u25aa_\u2013\u2014]+/g,' ').replace(/\s+-+\s+/g,' ');
        rest=clean(rest);
        if(rest&&/^[\p{L}\p{M} .\u2019'\-]+$/u.test(rest)&&rest.split(/\s+/).length<=8&&!/\b(?:tolong|cari|cek|transfer|kirim|terima|kasih|terdaftar|baru|akun)\b/i.test(rest))record.name=rest;
      }
      results.push(record);
    }
    return results;
  }
  // ACCOUNT_HELPERS_END

  // PURE_HELPERS_END
  function renderChecks(){
    const box=$('checks');box.replaceChildren();if(!bundles.length)return;
    const hit=hits[index],current=hit?.query||bundles[0],values=hit?.values||current;
    if(hits.length>1){
      const choices=document.createElement('div');choices.className='result-choices';
      const first=Math.max(0,index-4),last=Math.min(hits.length,first+12);
      for(let i=first;i<last;i++){
        const h=hits[i],button=document.createElement('button');button.className='result-choice'+(i===index?' active':'');button.setAttribute('aria-pressed',String(i===index));
        button.textContent=h.admin?.userId||'Hasil '+(i+1);
        const note=document.createElement('small');note.textContent=[h.matches.name?'Nama':'',h.matches.number?'Nomor':'',h.matches.bank?'Bank':''].filter(Boolean).join(' + ');button.append(note);
        button.onclick=()=>{index=i;reveal();};choices.append(button);
      }
      box.append(choices);
    }
    const summary=document.createElement('div');summary.className='result-heading'+(hit?.matches.name?' good':'');
    const count=hit?Object.keys(hit.matches).length:0;
    const heading=document.createElement('strong');heading.textContent=hit?(hit.matches.name?'NAMA COCOK':hit.matches.number?'NOMOR COCOK':'BANK / E-WALLET COCOK'):'Belum ditemukan';
    const detail=document.createElement('small');detail.textContent=hit?`${hit.admin?.userId?'User ID: '+hit.admin.userId+' \u2022 ':''}${count}/3 bagian cocok dengan chat`:'Tempel chat yang memuat nama, nomor, atau bank.';
    summary.append(heading,detail);
    box.append(summary);
    for(const [key,label] of [['userId','USER ID'],['name','NAMA REKENING'],['number','NOMOR REKENING'],['bank','BANK / E-WALLET']]){
      const isUserId=key==='userId';
      const ok=!isUserId&&!!hit?.matches[key],value=isUserId?(hit?.admin?.userId||''):(values[key]||current[key]||'');
      const card=document.createElement('div');card.className='check'+(ok?' yes':'');
      const title=document.createElement('div');title.className='match-title';title.textContent=label+(hit?.admin?' \u2022 DI ADMIN':'');
      const body=document.createElement('div');body.className='match-value';body.textContent=value||(isUserId?'User ID belum terbaca':'Belum terbaca dari chat');
      const bottom=document.createElement('div');bottom.className='match-bottom';
      const state=document.createElement('span');state.textContent=isUserId?(value?'User ID dari baris admin yang dipilih':'Pilih hasil yang memiliki kolom User ID'):(ok?'COCOK DENGAN CHAT':value?'Tidak cocok / tidak ada di chat':'Belum teridentifikasi');
      const copy=document.createElement('button');copy.textContent=isUserId?'Salin ID':'Salin';copy.setAttribute('aria-label','Salin '+label);copy.disabled=!value;copy.onclick=()=>{
        const temp=document.createElement('input');temp.value=value;temp.style.cssText='position:fixed;left:10px;bottom:10px;width:220px';root.append(temp);copyAccountField(temp,label).then(ok=>{if(ok)temp.remove();else temp.addEventListener('blur',()=>temp.remove(),{once:true});});
      };
      bottom.append(state,copy);card.append(title,body,bottom);box.append(card);
    }
    if(hit?.admin?.userId&&hit.matches.number)beginReferralIDs([{id:hit.admin.userId}],false);
    $('note').textContent='Nama saja sudah dihitung cocok. Bank dan nomor dinilai terpisah. Tombol Salin mengambil nilai pada kartu. Hanya baris admin yang sudah dimuat dapat dicari.';
  }
  function matchScore(hit){return (hit.matches.number?5:0)+(hit.matches.name?7:0)+(hit.matches.bank?1:0);}
  function recordOwner(el){
    return el.closest('tr,[role="row"],li,article,[data-record-id],dl,.form-group,.field')||block(el);
  }
  function makeRange(g,match){
    const a=g.nodes.find(n=>n.start+n.node.length>match.start);
    const b=g.nodes.find(n=>n.start+n.node.length>=match.end);
    if(!a||!b)return null;
    const r=a.node.ownerDocument.createRange();r.setStart(a.node,match.start-a.start);r.setEnd(b.node,match.end-b.start);return r;
  }
  // Cari nama dari kedua arah: hasil ekstraksi chat dan nama yang ada di admin.
  function nameCandidates(g){
    const candidates=[];
    const add=(value,trusted=false)=>{
      value=String(value).trim().replace(/^(?:nama\s*(?:rekening|pemilik|penerima)?|atas\s*nama|a\s*[/.]\s*n)\s*[:=\-]?\s*/i,'').trim();
      if(!value||value.length>90||!/[\p{L}]/u.test(value)||/[0-9]/.test(value))return;
      if(!/^[\p{L}\p{M}\s.'\u2019\-]+$/u.test(value))return;
      if(/\b(?:nama|rekening|bank|wallet|status|aktif|deposit|withdraw|transfer|saldo|terdaftar|admin|member|username|userid|user|referral|balance|no name|nomor|tanggal|lihat|salin|cari|data)\b/i.test(value))return;
      if(/^(?:BCA|BRI|BNI|BSI|MANDIRI|DANA|OVO|GO\s*PAY|SHOPEE\s*PAY|LINK\s*AJA|CIMB NIAGA|SEABANK|JAGO)$/i.test(value))return;
      if(!trusted&&(value.length<3||value.split(/\s+/).length>6))return;
      if(!candidates.includes(value))candidates.push(value);
    };
    if(g.el.matches('tr,[role="row"]')){
      const table=g.el.closest('table,[role="table"],[role="grid"]');
      const headers=table?Array.from(table.querySelectorAll('thead th,[role="columnheader"]')):[];
      const cells=Array.from(g.el.children);
      cells.forEach((cell,i)=>{const h=headers[i]?.textContent||'';if(/nama|holder|beneficiary/i.test(h)&&!/bank/i.test(h))add(cell.textContent,true);});
    }
    for(const n of g.nodes){
      const value=n.node.data||'';
      value.split(/[\n,|/:]/).forEach(v=>add(v));
    }
    for(const field of g.inputs)add(field.value,/nama|holder/i.test(field.getAttribute('aria-label')||field.name||''));
    return candidates;
  }

  // ADMIN_CELL_HELPERS_START
  function parseAdminBankCell(value, trusted=false){
    const raw=String(value).normalize('NFKC').trim();
    const parts=raw.split(/[,|;\n]+|\s+\/\s+/).map(v=>v.trim()).filter(Boolean);
    if(parts.length<3)return null;
    const numeric=parts.filter(v=>/^\d[\d\s.\-\u2010\u2011\u2013\u2014]*$/.test(v)&&v.replace(/\D/g,'').length>=5);
    if(numeric.length!==1)return null;
    const bankRE=/^(?:BANK\s+)?(?:BCA|BRI|BNI|BSI|MANDIRI|CIMB(?:\s*NIAGA)?|PERMATA|DANAMON|BTN|MAYBANK|OCBC(?:\s*NISP)?|PANIN|MEGA|JAGO|SEABANK|NEOBANK|DANA|OVO|0VO|GO\s*PAY|SHOPEE\s*PAY|LINK\s*AJA)$/i;
    let bank=parts.find(v=>bankRE.test(v));
    if(!bank&&trusted&&parts.length===3&&!/\d/.test(parts[0]))bank=parts[0];
    if(!bank)return null;
    const names=parts.filter(v=>v!==bank&&v!==numeric[0]);
    if(names.length!==1||!/[\p{L}]/u.test(names[0])||/[0-9]/.test(names[0]))return null;
    return {bank,name:names[0],number:numeric[0].replace(/\D/g,'')};
  }
  function readAdminRecord(row){
    if(!row.matches('tr,[role="row"]'))return null;
    const table=row.closest('table,[role="table"],[role="grid"]');
    const cells=Array.from(row.children).filter(c=>c.matches('td,th,[role="cell"],[role="gridcell"]'));
    if(!cells.length)return null;
    let bankIndex=-1,idIndex=-1;
    if(table){
      for(const header of Array.from(table.querySelectorAll('tr,[role="row"]')).slice(0,12)){
        let column=0;
        for(const cell of Array.from(header.children)){
          const text=cell.textContent.replace(/\s+/g,' ').trim();
          if(/^(?:bank|bank\s*\/\s*e-?wallet|data\s*bank)$/i.test(text))bankIndex=column;
          if(/^(?:user\s*id|username|id\s*user)$/i.test(text))idIndex=column;
          column+=Number(cell.colSpan)||1;
        }
        if(bankIndex>=0&&idIndex>=0)break;
      }
    }
    let bankCell=bankIndex>=0?cells[bankIndex]:null;
    let account=bankCell?parseAdminBankCell(bankCell.textContent,true):null;
    if(!account){for(const cell of cells){const parsed=parseAdminBankCell(cell.textContent);if(parsed){account=parsed;bankCell=cell;break;}}}
    if(!account)return null;
    let userId='';
    if(idIndex>=0&&cells[idIndex]){
      userId=(cells[idIndex].innerText||cells[idIndex].textContent).replace(/No\s*Name.*$/i,'').trim().match(/[\p{L}\p{N}_@.\-]+/u)?.[0]||'';
    }
    return {...account,userId,bankCell};
  }
  // ADMIN_CELL_HELPERS_END

  async function searchBundle(token,jump){
    $('status').textContent='Mencocokkan nama, nomor, bank\u2026';
    const records=new Map();let steps=0;
    const getRecord=el=>{let g=records.get(el);if(!g){g={el,text:'',nodes:[],inputs:[],lastBlock:null};records.set(el,g);}return g;};
    const documents=searchDocuments();
    for(const doc of documents){
      let n;const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT,{acceptNode(node){
        const p=node.parentElement;return p&&!host.contains(p)&&!p.closest('textarea,select,script,style')&&visible(p)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
      }});
      while((n=walker.nextNode())){
        const el=recordOwner(n.parentElement);if(!el||el===doc.body||el===doc.documentElement)continue;
        const g=getRecord(el),b=block(n.parentElement);if(g.lastBlock&&g.lastBlock!==b)g.text+=' ';
        g.nodes.push({node:n,start:g.text.length});g.text+=n.data;g.lastBlock=b;
        if(++steps%500===0){await new Promise(r=>setTimeout(r,0));if(token!==serial)return;}
      }
      for(const field of doc.querySelectorAll('input:not([type]),input[type="text"],input[type="tel"],input[type="number"],textarea,select')){
        if(!visible(field)||host.contains(field))continue;const el=recordOwner(field);if(el===doc.body||el===doc.documentElement)continue;getRecord(el).inputs.push(field);
      }
    }
    const candidates=[];
    for(const g of records.values()){
      if(g.text.length>5000)continue;
      const admin=readAdminRecord(g.el);
      const names=nameCandidates(g);
      for(const query of bundles){
        const matches={},parts=[],values=admin?{name:admin.name,number:admin.number,bank:admin.bank}:{...query};
        const locate=(value,key)=>{
          const match=fieldMatch(g.text,value,key);
          if(match){const range=makeRange(g,match);if(range&&range.getClientRects().length)return {range,key};}
          for(const field of g.inputs){const text=field.tagName==='SELECT'?field.selectedOptions[0]?.textContent||'':field.value;const m=fieldMatch(text,value,key);if(m)return {el:field,key};}
          return null;
        };
        for(const key of ['bank','number','name']){
          let part=admin?(fieldMatch(query.raw||input.value,admin[key],key)?locate(admin[key],key):null):locate(query[key],key);
          if(!admin&&!part&&key==='name'){
            const raw=query.raw||input.value;
            const matching=names.filter(name=>namePattern(name)?.test(raw)).sort((a,b)=>b.length-a.length);
            for(const name of matching){part=locate(name,key);if(part){values.name=name;break;}}
          }
          if(part){matches[key]=true;parts.push(part);}
        }
        if(parts.length)candidates.push({el:g.el,parts,matches,values,query,admin});
      }
      if(++steps%200===0){await new Promise(r=>setTimeout(r,0));if(token!==serial)return;}
    }
    if(token!==serial)return;
    const selected=selectAccountHits(candidates,bundles);selected.sort((a,b)=>matchScore(b)-matchScore(a));clipped=selected.length>2000;
    hits=selected.slice(0,2000);index=hits.length?0:-1;dirty=false;status();
    if(inaccessibleFrames)$('note').textContent+=' Ada frame yang tidak dapat diakses; buka halaman tabel langsung.';
    if(jump&&hits.length)reveal();else schedulePaint();
  }

  // Tambahan 1.6: formatter terpisah; fungsi pencarian lama tetap utuh.
  // TIDY_HELPERS_START
  function tidyText(value, format='text') {
    const source=String(value).replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ')
      .replace(/[\u200B\u2060\uFEFF]/g,'')
      .replace(/[\u00ef\u00bc\u0090-\u00ef\u00bc\u2122]/g,c=>String(c.charCodeAt(0)-0xFF10));
    if(format==='bank') {
      // Tidak menyatukan nomor melewati Enter, slash, pipe, atau label huruf.
      const results=[];
      for(const part of source.split(/[\n/|;,]+/)) {
        const re=/(?<![\p{L}\p{N}_])\d(?:[\d \t.\-\u2010\u2011\u2013\u2014]*\d)?(?![\p{L}\p{N}_])/gu;
        for(const match of part.matchAll(re)) {
          const digits=match[0].replace(/\D/g,'');
          if(digits.length>=5) results.push(digits);
        }
      }
      return results.join('\n');
    }
    return source.split('\n').flatMap(line=> {
      // Slash hanya pemisah jika diberi spasi; A/N, URL dan ID tetap utuh.
      if(/^\s*[-_=\u2500\u2501\u2014\u2013|\u2022\u00b7*]{3,}\s*$/.test(line))return [];
      return line.replace(/^[ \t]*[\u2022\u25cf\u25aa\u25ba]+[ \t]*/,'')
        .replace(/[ \t]*[|\u2502\u2503]+[ \t]*|[ \t]+\/[ \t]+|[ \t]+[-\u2013\u2014]{1,}[ \t]+/g,'\n')
        .split('\n').map(v=>v.replace(/[ \t]+/g,' ').trim()).filter(Boolean);
    }).join('\n');
  }
  // TIDY_HELPERS_END
  const tidySource=$('tidy-source'), tidyResult=$('tidy-result'), tidyFormat=$('tidy-format');
  let tidyTimer, toastTimer, tidyRevision=0;
  function tidyMessage(text){$('tidy-status').textContent=text;}
  function refreshCopy(){tidyRevision++;$('tidy-copy').disabled=!tidyResult.value.trim();}
  function runTidy(){
    clearTimeout(tidyTimer);
    const accounts=extractAccounts(tidySource.value);
    renderAccountFields(accounts);
    tidyResult.value=tidyFormat.value==='account'?accountText(accounts):tidyText(tidySource.value,tidyFormat.value);refreshCopy();
    tidyMessage(!tidySource.value.trim()?'Tempel teks terlebih dahulu.':!tidyResult.value?'Tidak ada nomor dengan minimal 5 digit.':tidyFormat.value==='account'?'Data dipisahkan. Periksa tiap kolom lalu salin satu-satu.':tidyFormat.value==='bank'?'Nomor dirapikan. Nol depan tetap ada; periksa pemisahan nomor.':'Teks dirapikan. Isi kata, ID, dan nomor tetap dipertahankan.');
  }

  function accountText(accounts){return accounts.map(a=>[['Nama rekening',a.name],['Nomor rekening',a.number],['Jenis bank',a.bank]].map(([k,v])=>k+': '+(v||'')).join('\n')).join('\n\n');}
  function renderAccountFields(accounts){
    const box=$('tidy-fields');box.replaceChildren();
    accounts.forEach(account=>{
      const card=document.createElement('div');card.className='account-card';
      const title=document.createElement('strong');title.textContent=account.label;card.append(title);
      for(const [key,label] of [['name','Nama rekening'],['number','Nomor rekening'],['bank','Jenis bank']]){
        const caption=document.createElement('label');caption.textContent=label;
        const row=document.createElement('div');row.className='field-row';
        const field=document.createElement('input');field.type='text';field.value=account[key]||'';field.autocomplete='off';field.spellcheck=false;field.setAttribute('aria-label',label);field.placeholder='Belum terbaca \u2014 isi manual';
        const copy=document.createElement('button');copy.type='button';copy.textContent='Salin';copy.setAttribute('aria-label','Salin '+label);copy.disabled=!field.value.trim();
        field.oninput=()=>{account[key]=field.value;copy.disabled=!field.value.trim();if(tidyFormat.value==='account'){tidyResult.value=accountText(accounts);refreshCopy();}};
        copy.onclick=()=>copyAccountField(field,label);
        caption.append(row);row.append(field,copy);card.append(caption);
        if(key==='name'){
          const find=document.createElement('button');find.type='button';find.textContent='Cari nama ini';
          find.onclick=()=>{if(!field.value.trim()){tidyMessage('Isi nama rekening terlebih dahulu.');field.focus();return;}mode.value='name';input.value=field.value;input.inputMode='text';input.placeholder='Ketik nama rekening\u2026';field.blur();search(true);};card.append(find);
        }
      }
      if(account.uncertain){const note=document.createElement('p');note.className='hint';note.textContent='Ada beberapa nomor. Nama dan bank perlu diisi agar tidak salah pasangan.';card.append(note);}
      box.append(card);
    });
  }
  async function copyAccountField(field,label){
    const value=field.value.trim();if(!value)return;let ok=false;
    try{if(typeof GM_setClipboard==='function'){await GM_setClipboard(value,'text');ok=true;}else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);ok=true;}}catch(_){}
    if(!ok){field.focus();field.select();field.setSelectionRange(0,field.value.length);try{ok=document.execCommand('copy');}catch(_){}}
    tidyMessage(ok?label+' berhasil disalin.':'Tekan lama kolom yang terpilih, lalu pilih Salin.');
    if(ok){const toast=$('tidy-toast');toast.textContent=label+' disalin';toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},2200);}
    return ok;
  }

  $('tidy-run').onclick=runTidy;
  tidyFormat.onchange=runTidy;
  tidySource.addEventListener('input',()=>{
    clearTimeout(tidyTimer);$('tidy-fields').replaceChildren();tidyResult.value='';refreshCopy();tidyMessage('Merapikan\u2026');tidyTimer=setTimeout(runTidy,180);
  });
  tidyResult.addEventListener('input',()=>{refreshCopy();tidyMessage('Hasil diedit. Siap disalin.');});
  $('tidy-from-query').onclick=()=>{tidySource.value=input.value;runTidy();};
  $('tidy-reset').onclick=()=>{clearTimeout(tidyTimer);tidySource.value='';tidyResult.value='';$('tidy-fields').replaceChildren();refreshCopy();tidyMessage('');tidySource.focus();};
  $('tidy-copy').onclick=async()=>{
    const text=tidyResult.value;if(!text.trim())return;
    const revision=tidyRevision;let copied=false;
    try {
      if(typeof GM_setClipboard==='function'){await GM_setClipboard(text,'text');copied=true;}
      else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);copied=true;}
    } catch (_) {}
    if(!copied&&revision===tidyRevision){
      tidyResult.focus();tidyResult.select();tidyResult.setSelectionRange(0,tidyResult.value.length);
      try{copied=document.execCommand('copy');}catch(_){}
    }
    if(revision!==tidyRevision)return;
    if(copied){
      tidyMessage('Hasil berhasil disalin.');const toast=$('tidy-toast');toast.textContent='Hasil rapi disalin';toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},2200);
    }else{tidyMessage('Salin otomatis diblokir. Tekan lama hasil yang terpilih, lalu pilih Salin.');}
  };


  // NATIVE_PURE_START
  function extractSearchValues(value,kind){
    const text=String(value).normalize('NFKC').replace(/[\u200B\u2060\uFEFF]/g,'').trim();
    const unique=values=>[...new Set(values)];
    if(kind==='id'){
      const label=/\b(?:(?:user|usr)[\s_-]*(?:name|id)|id[\s_-]*(?:user|usr)(?:[\s_-]*id)?|user|usr|id)\b\s*(?:(?:saya|aku|nya|adalah|yaitu)\b\s*)*(?:[:=\-\u2013>]+\s*)?["'`*]*\s*([a-z0-9_][a-z0-9_.@\-]*)/gi;
      const excluded=['nama','name','bank','rekening','norek','username','userid','usrid','usr','user','id','saya','aku','nya','adalah','yaitu','ini','dan'];
      const labelled=Array.from(text.matchAll(label)).map(m=>m[1].replace(/[.,;:]+$/g,''))
        .filter(v=>!excluded.includes(v.toLowerCase()));
      if(labelled.length)return unique(labelled);
      const bare=text.replace(/^["'`*]+|["'`*]+$/g,'');
      return /^[a-z0-9_][a-z0-9_.@\-]*$/i.test(bare)&&!excluded.includes(bare.toLowerCase())?[bare]:[];
    }
    const result=[];
    const labelled=/\b(?:nomor\s*(?:rekening|rek)|no\.?\s*(?:rekening|rek)|norek|rekening|rek|account\s*(?:number|no))\b\s*(?:nya\s*)?[:=\-]*\s*(\d[\d \t.\-\u2010\u2011\u2013\u2014]*\d|\d)/gi;
    for(const m of text.matchAll(labelled)){const n=m[1].replace(/\D/g,'');if(n.length>=5&&n.length<=30)result.push(n);}
    if(result.length)return unique(result);
    for(const part of text.split(/[\n/,;|]+/)){
      for(const m of part.matchAll(/(?<![\p{L}\p{N}_])\d[\d \t.\-\u2010\u2011\u2013\u2014]*\d(?![\p{L}\p{N}_])/gu)){
        // Ignore obvious date strings instead of turning dates into accounts.
        if(/^\d{1,4}[-.]\d{1,2}[-.]\d{1,4}$/.test(m[0]))continue;
        const n=m[0].replace(/\D/g,'');if(n.length>=5&&n.length<=30)result.push(n);
      }
    }
    return unique(result);
  }
  function nativeFieldKind(value){
    const t=String(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
    if(/^(?:user(?:id|name)|usr(?:id|name)|idusr|iduser|user|usr|id|usernamefilter|searchuser(?:id|name)|txtuser(?:id|name)|cariuser(?:id|name))$/.test(t))return 'id';
    if(/^(?:namarekening|namarek|accountname|accname|bankaccname|bankaccountname|banknameholder|accountholder|txtnamarekening)$/.test(t))return 'name';
    if(/^(?:nomorrekening|norekening|norek|nomorrek|norekbank|rekening|rek|accountnumber|accountno|accno|bankaccount|bankacc|bankaccno|bankaccountnumber|bankaccountno|txtnorek|searchnorek)$/.test(t))return 'bank';
    return '';
  }
  // NATIVE_PURE_END
  let prefix888Applied='';
  function refreshPrefix888(){
    const bankMode=mode.value==='admin_bank'||mode.value==='bank';
    $('prefix-row').hidden=!bankMode;
    const added=bankMode&&prefix888Applied!==''&&input.value===prefix888Applied;
    $('prefix-888').disabled=added;$('prefix-888').textContent=added?'888 ditambahkan':'+888';
    $('prefix-options').hidden=true;$('prefix-options').replaceChildren();
  }
  function addPrefix888(chosen){
    if(!['admin_bank','bank'].includes(mode.value))return;
    if(prefix888Applied&&input.value===prefix888Applied)return;
    const values=extractSearchValues(input.value,'bank');
    const value=chosen&&values.includes(chosen)?chosen:values.length===1?values[0]:'';
    if(!value){
      if(!values.length){$('status').textContent='Tempel nomor rekening terlebih dahulu';return;}
      const box=$('prefix-options');box.hidden=false;box.replaceChildren();box.append(document.createTextNode('Pilih nomor yang akan ditambah 888:'));
      values.forEach(number=>{const button=document.createElement('button');button.textContent=number;button.onclick=()=>addPrefix888(number);box.append(button);});return;
    }
    clearTimeout(timer);serial++;input.value='888'+value;prefix888Applied=input.value;
    refreshPrefix888();search(false);
    $('status').textContent='888 ditambahkan: '+input.value;
  }
  $('prefix-888').onclick=()=>addPrefix888();
  function isNativeMode(){return mode.value==='admin_id'||mode.value==='admin_bank';}
  function nativeAllowed(){return location.hostname==='agwl2.admitoto.com'&&location.pathname==='/agentplayerlist.php';}
  function previewNative(){
    refreshBalance();refreshAccountWarning();
    const box=$('native-preview');box.hidden=false;box.replaceChildren();
    const kind=mode.value==='admin_id'?'id':'bank',values=extractSearchValues(input.value,kind);
    const title=document.createElement('strong');title.textContent=kind==='id'?'USER ID YANG AKAN DICARI':'NOMOR REKENING YANG AKAN DICARI';box.append(title);
    if(!nativeAllowed()){$('status').textContent='Buka halaman daftar pemain admin';box.append(document.createTextNode(' \u2014 Fitur ini khusus agwl2.admitoto.com/agentplayerlist.php.'));return;}
    if(values.length===1){const v=document.createElement('div');v.className='native-value';v.textContent=values[0];box.append(v);box.append(document.createTextNode('Tekan Cari di admin untuk mengisi kolom dan menjalankan pencarian.'));$('status').textContent='Siap mencari di admin';}
    else if(values.length>1){box.append(document.createElement('br'));box.append(document.createTextNode('Ada beberapa data. Pilih yang ingin dicari:'));values.forEach(value=>{const b=document.createElement('button');b.textContent=value;b.onclick=()=>runNativeSearch(value);box.append(b);});$('status').textContent='Pilih satu data';}
    else{$('status').textContent=input.value.trim()?'Data belum terbaca':'Tempel data terlebih dahulu';box.append(document.createElement('br'));box.append(document.createTextNode(kind==='id'?'Tempel username, user name, userid, id user, usrid, usr id, user, atau id diikuti nilai ID.':'Contoh: nomor rekening: 0882-2536-4576. Bisa juga tempel nomor saja.'));}
    $('note').textContent='Pilihan pencarian tetap. Nama rekening dan Ctrl F tersedia di daftar pilihan atas.';
  }
  function nativeInputs(scope){return Array.from(scope.querySelectorAll('input:not([type]),input[type="text"],input[type="search"],input[type="tel"],input[type="number"]')).filter(el=>!el.readOnly&&visible(el));}
  function nativeLabels(field){
    const labels=[field.name,field.id,field.getAttribute('aria-label'),field.placeholder].filter(Boolean).map(text=>({text,weight:6}));
    for(const label of field.labels||[])labels.push({text:label.textContent,weight:12});
    const ref=field.getAttribute('aria-labelledby');if(ref)for(const id of ref.split(/\s+/)){const el=field.ownerDocument.getElementById(id);if(el)labels.push({text:el.textContent,weight:12});}
    const cell=field.closest('td,th');
    if(cell){const prev=cell.previousElementSibling;if(prev&&!nativeInputs(prev).length)labels.push({text:prev.textContent,weight:10});}
    const parent=field.parentElement;
    if(parent){const prev=field.previousElementSibling;if(prev&&!nativeInputs(prev).length)labels.push({text:prev.textContent,weight:10});const direct=Array.from(parent.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ');labels.push({text:direct,weight:8});}
    return labels;
  }
  function resolveNativeField(doc,kind){
    const ranked=nativeInputs(doc).map(el=>({el,score:Math.max(0,...nativeLabels(el).map(l=>nativeFieldKind(l.text)===kind?l.weight:0))})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    if(!ranked.length)return null;
    if(ranked.length>1&&ranked[0].score===ranked[1].score)return null;
    return ranked[0].el;
  }
  function nativeToggleKind(el){
    const labels=[el.name,el.id,...Array.from(el.labels||[]).map(l=>l.textContent)];
    const cell=el.closest('td,th,label');if(cell)labels.push(cell.textContent);
    const sibling=el.nextSibling;if(sibling?.nodeType===3)labels.push(sibling.textContent);
    return labels.map(nativeFieldKind).find(Boolean)||'';
  }
  function setNativeValue(field,value){
    const w=field.ownerDocument.defaultView;
    const proto=field.tagName==='TEXTAREA'?w.HTMLTextAreaElement.prototype:w.HTMLInputElement.prototype;
    const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
    if(setter)setter.call(field,value);else field.value=value;
    field.dispatchEvent(new w.Event('input',{bubbles:true}));field.dispatchEvent(new w.Event('change',{bubbles:true}));
  }
  function clearOtherSearchFilters(scope,field){
    const textTypes=new Set(['text','search','tel','number','email','url']);
    for(const other of scope.querySelectorAll('input,textarea,select')){
      if(other===field||other.form!==field.form||other.disabled||other.readOnly||!visible(other))continue;
      if(other.tagName==='INPUT'&&!textTypes.has(other.type))continue;
      if(other.tagName==='SELECT'){
        const empty=Array.from(other.options).find(o=>!o.disabled&&(o.value===''||/^(?:semua|all|semua\s+\w+|all\s+\w+)$/i.test(o.textContent.trim())));
        if(!empty)continue;
        const w=other.ownerDocument.defaultView;other.value=empty.value;other.dispatchEvent(new w.Event('change',{bubbles:true}));continue;
      }
      setNativeValue(other,'');
      if(other.value!=='')throw new Error('Kolom filter lain belum berhasil dikosongkan. Pencarian belum dijalankan.');
    }
  }
  let nativeBusy=false;
  function runNativeSearch(chosen){
    if(nativeBusy)return;
    clearAccountWarning();clearBalance();
    clearTimeout(timer);serial++;$('marks').replaceChildren();$('checks').replaceChildren();
    if(!nativeAllowed()){previewNative();return;}
    const kind=mode.value==='admin_id'?'id':'bank',values=extractSearchValues(input.value,kind);
    const value=chosen&&values.includes(chosen)?chosen:values.length===1?values[0]:'';
    if(!value){previewNative();return;}
    const candidates=searchDocuments().map(doc=>({doc,field:resolveNativeField(doc,kind)})).filter(x=>x.field);
    if(candidates.length!==1){previewNative();$('status').textContent='Kolom admin belum dapat dipastikan';$('note').textContent='Kolom tidak diisi karena labelnya belum dikenali atau ada lebih dari satu kolom. Kirim HTML formulir pencarian agar pemetaannya dapat disesuaikan.';return;}
    const {doc,field}=candidates[0],form=field.form;
    if(form){let url;try{url=new URL(form.action||doc.URL,doc.URL);}catch(_){return;}if(url.origin!==location.origin||url.pathname!=='/agentplayerlist.php'){$('status').textContent='Formulir bukan pencarian daftar pemain';return;}}
    const scope=form||doc;
    const buttons=Array.from(scope.querySelectorAll('button,input[type="submit"],input[type="button"],a[onclick]')).filter(el=>visible(el)&&!el.disabled&&/^(?:cari|search)$/i.test((el.tagName==='INPUT'?el.value:el.textContent).trim()));
    if(buttons.length!==1){$('status').textContent='Tombol Cari admin belum dapat dipastikan';$('note').textContent='Pencarian belum dikirim karena tombol Cari tidak ditemukan atau ada beberapa tombol dengan label sama.';return;}
    nativeBusy=true;
    try{
      // Restrict clearing to this search form or the common search-control container.
      let filterScope=form;
      if(!filterScope){filterScope=field.parentElement;while(filterScope&&filterScope!==doc.body&&!filterScope.contains(buttons[0]))filterScope=filterScope.parentElement;}
      if(!filterScope||filterScope===doc.body&&!form)throw new Error('Area filter pencarian belum dapat dipastikan.');
      clearOtherSearchFilters(filterScope,field);
      for(const box of filterScope.querySelectorAll('input[type="checkbox"]')){
        const k=nativeToggleKind(box);if(!['id','name','bank'].includes(k)||box.disabled)continue;
        const checked=k===kind;if(box.checked!==checked)box.click();
      }
      if(field.disabled||field.readOnly)throw new Error('Kolom pencarian tidak aktif.');
      setNativeValue(field,value);
      if(field.value!==value)throw new Error('Nilai pada kolom admin berubah. Pencarian dibatalkan.');
      $('status').textContent='Menjalankan pencarian admin\u2026';
      try{sessionStorage.setItem('mobile-find-admin-pending',JSON.stringify({time:Date.now(),mode:mode.value,value}));}catch(_){}
      // Click the native search control once; no synthetic Enter or repeated submit.
      if(kind==='bank')startReferralWatch(value);else stopReferralWatch();
      buttons[0].click();
      if(kind==='bank')setTimeout(scanReferralAccounts,500);
      $('status').textContent='Pencarian dikirim: '+value;
    }catch(error){$('status').textContent=error.message||'Pencarian admin gagal.';}
    finally{setTimeout(()=>{nativeBusy=false;},1200);}
  }
  function restoreNativeSearch(){
    if(!nativeAllowed())return;
    try{const raw=sessionStorage.getItem('mobile-find-admin-pending');if(!raw)return;sessionStorage.removeItem('mobile-find-admin-pending');const saved=JSON.parse(raw);if(Date.now()-saved.time>90000||!['admin_id','admin_bank'].includes(saved.mode)||typeof saved.value!=='string')return;
      input.value=saved.value;mode.value=saved.mode;refreshPrefix888();panel.hidden=false;place();$('search').textContent='Cari di admin';previewNative();$('status').textContent='Hasil pencarian admin: '+saved.value;if(saved.mode==='admin_bank'){startReferralWatch(saved.value);setTimeout(scanReferralAccounts,350);}
    }catch(_){}
  }


  // REFERRAL_PURE_START
  function referralDateRange(now=new Date()){
    const y=now.getFullYear(),m=now.getMonth(),d=now.getDate();
    const last=new Date(y-1,m+1,0).getDate();
    const start=new Date(y-1,m,Math.min(d,last)),end=new Date(y,m,d);
    const format=(v,iso=false)=>{const yy=v.getFullYear(),mm=String(v.getMonth()+1).padStart(2,'0'),dd=String(v.getDate()).padStart(2,'0');return iso?`${yy}-${mm}-${dd}`:`${dd}-${mm}-${yy}`;};
    return {start:format(start),end:format(end),startISO:format(start,true),endISO:format(end,true),key:format(end,true)};
  }
  function referralFieldKind(value){
    const t=String(value).toLowerCase().replace(/[^a-z0-9]/g,'');
    if(/^(?:tanggalawal|tglawal|startdate|datestart|datefrom|fromdate|date1|tgl1|start|from)$/.test(t))return 'start';
    if(/^(?:tanggalakhir|tglakhir|enddate|dateend|dateto|todate|date2|tgl2|end|to)$/.test(t))return 'end';
    if(/^(?:userid|username|iduser|upline|referral|namareferral|referralname|referralid|referrer|searchuser|searchuserid)$/.test(t))return 'id';
    return '';
  }
  function parseReferralCount(value){
    const s=String(value).trim();
    return /^\d+(?:[.,]\d{3})*$/.test(s)?s.replace(/[.,]/g,''):null;
  }
  // REFERRAL_PURE_END
  let referralWatch='',referralScanTimer=0,referralGeneration=0,referralBusy=false;
  let referralItems=[],referralQueue=[],referralDay=referralDateRange().key;
  const referralCache=new Map();
  const referralURL='https://agwl2.admitoto.com/referrallist.php';
  function referralHost(){return location.hostname==='agwl2.admitoto.com';}
  function stopReferralWatch(){referralWatch='';clearTimeout(referralScanTimer);referralGeneration++;referralItems=[];referralQueue=[];$('referral-box').hidden=true;}
  function startReferralWatch(number){stopReferralWatch();referralWatch=number;renderReferral();}
  function scheduleReferralScan(){if(referralWatch){clearTimeout(referralScanTimer);referralScanTimer=setTimeout(scanReferralAccounts,600);}}
  function scanReferralAccounts(){
    if(!referralWatch||!referralHost())return;
    const ids=[];
    for(const doc of searchDocuments())for(const row of doc.querySelectorAll('tr,[role="row"]')){
      const record=readAdminRecord(row);
      if(record?.number===referralWatch&&record.userId&&!ids.some(v=>v.id.toLowerCase()===record.userId.toLowerCase()))ids.push({id:record.userId});
    }
    if(ids.length)beginReferralIDs(ids,true);else renderReferral();
  }
  function beginReferralIDs(ids,fromWatch=false){
    if(!referralHost())return;
    if(referralWatch&&!fromWatch)return;
    const range=referralDateRange();
    for(const {id} of ids){
      if(!id||referralItems.some(v=>v.id.toLowerCase()===id.toLowerCase()))continue;
      const cached=referralCache.get(range.key+'|'+id.toLowerCase());
      const item={id,range,state:cached?'done':'loading',data:cached||null};referralItems.push(item);
      if(!cached)referralQueue.push({item,generation:referralGeneration});
    }
    renderReferral();processReferralQueue();
  }
  // REFERRAL_DISPLAY_START
  function referralDisplay(item){
    if(item.state==='loading')return {count:'...',label:'MEMERIKSA',kind:'loading',note:'Sedang memeriksa referral aktif.'};
    if(item.state==='error')return {count:'-',label:'BELUM TERBACA',kind:'error',note:item.error||'Pemeriksaan gagal. Silakan periksa ulang.'};
    const data=item.data;
    const count=item.state==='done'&&data?(data.found?parseReferralCount(data.active):'0'):null;
    if(count===null)return {count:'-',label:'BELUM TERBACA',kind:'error',note:'Jumlah referral aktif belum dapat dipastikan.'};
    const zero=/^0+$/.test(count);
    return {count:zero?'0':count,label:zero?'TIDAK ADA YANG AKTIF':'REFERRAL AKTIF',kind:zero?'empty':'active',note:zero?'Tidak ada referral aktif pada periode ini.':'Referral aktif ditemukan pada periode ini.'};
  }
  // REFERRAL_DISPLAY_END
  function renderReferral(){
    const box=$('referral-box');box.replaceChildren();box.hidden=!referralWatch&&!referralItems.length;
    if(box.hidden)return;
    const range=referralDateRange();
    const header=document.createElement('div');header.className='ref-header';
    const title=document.createElement('div');title.className='ref-heading';title.textContent='REFERRAL';
    const period=document.createElement('span');period.className='ref-period';period.textContent='1 TAHUN';header.append(title,period);
    const dates=document.createElement('div');dates.className='ref-dates';dates.textContent=range.start+' sampai '+range.end;box.append(header,dates);
    if(!referralItems.length){const waiting=document.createElement('div');waiting.className='ref-state ref-wait';waiting.textContent='Menunggu User ID dari hasil rekening '+referralWatch;box.append(waiting);return;}
    for(const item of referralItems){
      const display=referralDisplay(item);
      const row=document.createElement('div');row.className='ref-row ref-'+display.kind;
      const identity=document.createElement('div');identity.className='ref-identity';
      const label=document.createElement('span');label.className='ref-id-label';label.textContent='USER ID';
      const id=document.createElement('div');id.className='ref-id';id.textContent=item.id;identity.append(label,id);
      const metric=document.createElement('div');metric.className='ref-metric';
      const count=document.createElement('div');count.className='ref-count';count.textContent=display.count;
      const caption=document.createElement('div');caption.className='ref-caption';caption.textContent='DOWNLINE AKTIF';metric.append(count,caption);
      const badge=document.createElement('div');badge.className='ref-badge';badge.textContent=display.label;
      const state=document.createElement('div');state.className='ref-state';state.textContent=display.note;
      row.append(identity,metric,badge,state);
      if(item.state==='done'&&item.data?.found&&item.data.total!==null&&item.data.total!==undefined){const total=document.createElement('div');total.className='ref-total';total.textContent='Total downline: '+item.data.total;row.append(total);}
      if(item.state!=='loading'){const retry=document.createElement('button');retry.className='ref-retry';retry.textContent='Periksa ulang';retry.onclick=()=>{item.state='loading';item.range=referralDateRange();referralQueue.push({item,generation:referralGeneration});renderReferral();processReferralQueue();};row.append(retry);}
      box.append(row);
    }
  }
  function resolveReferralField(doc,kind){
    const fields=Array.from(doc.querySelectorAll('input:not([type]),input[type="text"],input[type="search"],input[type="date"]'));
    const ranked=fields.map(el=>{
      const labels=[el.name,el.id,el.getAttribute('aria-label'),el.placeholder,...Array.from(el.labels||[]).map(l=>l.textContent)];
      const cell=el.closest('td,th');if(cell?.previousElementSibling)labels.push(cell.previousElementSibling.textContent);
      if(el.previousElementSibling)labels.push(el.previousElementSibling.textContent);
      if(el.parentElement)labels.push(Array.from(el.parentElement.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join(' '));
      return {el,score:labels.some(l=>referralFieldKind(l||'')===kind)?1:0};
    }).filter(x=>x.score);
    return ranked.length===1?ranked[0].el:null;
  }
  function setReferralDates(doc,live=false){
    const start=resolveReferralField(doc,'start'),end=resolveReferralField(doc,'end'),range=referralDateRange();
    if(!start||!end)return null;
    for(const [field,value] of [[start,start.type==='date'?range.startISO:range.start],[end,end.type==='date'?range.endISO:range.end]]){
      if(field.value!==value){if(live)setNativeValue(field,value);else field.value=value;}
    }
    return {start,end,range};
  }
  function parseReferralResult(doc,id){
    const expected=id.trim().toLowerCase();let recognized=false;
    for(const table of doc.querySelectorAll('table')){
      const rows=Array.from(table.querySelectorAll('tr')).filter(row=>row.closest('table')===table);let cols=null;
      for(const row of rows){
        const cells=Array.from(row.children).filter(c=>/^(TD|TH)$/.test(c.tagName));
        const texts=cells.map(c=>c.textContent.replace(/\s+/g,' ').trim());
        const u=texts.findIndex(v=>/^upline$/i.test(v)),a=texts.findIndex(v=>/^downline\s*aktif$/i.test(v)),t=texts.findIndex(v=>/^downline\s*total$/i.test(v));
        if(u>=0&&a>=0){cols={u,a,t};recognized=true;continue;}
        if(!cols)continue;
        if((texts[cols.u]||'').toLowerCase()!==expected)continue;
        const active=parseReferralCount(texts[cols.a]||''),total=cols.t<0?null:parseReferralCount(texts[cols.t]||'');
        if(active===null)throw new Error('Angka Downline Aktif belum dapat dibaca.');
        return {found:true,active,total};
      }
    }
    if(recognized){if(/\b[0-9]+\s+of\s+([2-9][0-9]*|1[0-9]+)\b/i.test(doc.body?.textContent||''))throw new Error('Hasil referral memiliki beberapa halaman; User ID belum ditemukan pada halaman yang terbaca.');return {found:false,active:'',total:null};}
    if(/(?:data\s+(?:tidak\s+(?:ada|ditemukan)|kosong)|no\s+(?:records?|data|results?)\s*(?:found|available)?)/i.test(doc.body?.textContent||''))return {found:false,active:'',total:null};
    throw new Error('Tabel referral belum terbaca. Periksa login atau tampilan halaman referral.');
  }
  async function referralRequest(url,options={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),18000);
    try{
      const res=await fetch(url,{...options,credentials:'same-origin',signal:controller.signal});
      if(!res.ok)throw new Error('Halaman referral gagal dimuat ('+res.status+').');
      const finalURL=new URL(res.url||url,referralURL);
      if(finalURL.origin!==location.origin||finalURL.pathname!=='/referrallist.php')throw new Error('Sesi admin perlu login ulang.');
      const html=await res.text(),doc=new DOMParser().parseFromString(html,'text/html');
      if(doc.querySelector('input[type="password"]'))throw new Error('Sesi admin perlu login ulang.');
      return doc;
    }catch(e){if(e.name==='AbortError')throw new Error('Pemeriksaan referral melewati batas waktu. Tekan Periksa ulang.');throw e;}
    finally{clearTimeout(timeout);}
  }
  async function lookupReferral(id){
    const doc=await referralRequest(referralURL),dates=setReferralDates(doc),field=resolveReferralField(doc,'id');
    if(!dates||!field||!field.name)throw new Error('Kolom User ID / tanggal referral belum dikenali. Perlu pemetaan formulir referral.');
    const form=field.form;
    if(!form||dates.start.form!==form||dates.end.form!==form||!dates.start.name||!dates.end.name)throw new Error('Formulir pencarian referral belum dikenali.');
    const url=new URL(form.getAttribute('action')||referralURL,referralURL);
    if(url.origin!==location.origin||url.pathname!=='/referrallist.php')throw new Error('Tujuan formulir referral tidak sesuai.');
    field.value=id;
    for(const checkbox of form.querySelectorAll('input[type="checkbox"]')){
      if(referralFieldKind(checkbox.name)==='id'||Array.from(checkbox.labels||[]).some(l=>referralFieldKind(l.textContent)==='id'))checkbox.checked=true;
    }
    const buttons=Array.from(form.querySelectorAll('button,input[type="submit"],input[type="button"]')).filter(el=>/^(cari|search)$/i.test((el.tagName==='INPUT'?el.value:el.textContent).trim()));
    if(buttons.length!==1)throw new Error('Tombol pencarian referral belum dikenali.');
    const params=new URLSearchParams();
    for(const [k,v] of new FormData(form))if(typeof v==='string')params.append(k,v);
    params.set(field.name,id);params.set(dates.start.name,dates.start.value);params.set(dates.end.name,dates.end.value);
    const button=buttons[0];if(button.name)params.set(button.name,button.value||'');
    const method=(form.getAttribute('method')||'get').toLowerCase();let result;
    if(method==='post'){result=await referralRequest(url.href,{method:'POST',body:params});}
    else if(method==='get'){for(const key of new Set(params.keys()))url.searchParams.delete(key);for(const [k,v] of params)url.searchParams.append(k,v);result=await referralRequest(url.href);}
    else throw new Error('Metode pencarian referral belum didukung.');
    // Verify the returned search fields when present, so old filters are not mistaken for a result.
    const returnedId=resolveReferralField(result,'id'),start=resolveReferralField(result,'start'),end=resolveReferralField(result,'end');
    if(returnedId&&returnedId.value.trim().toLowerCase()!==id.toLowerCase())throw new Error('Filter User ID belum diterapkan oleh halaman referral.');
    if(start&&start.value!==dates.start.value||end&&end.value!==dates.end.value)throw new Error('Rentang 1 tahun belum diterapkan oleh halaman referral.');
    if(!start||!end){const caption=result.body?.textContent||'';const range=referralDateRange();if(!caption.includes(range.start)||!caption.includes(range.end))throw new Error('Rentang tanggal pada hasil referral belum dapat dipastikan.');}
    return parseReferralResult(result,id);
  }
  async function processReferralQueue(){
    if(referralBusy)return;referralBusy=true;
    try{while(referralQueue.length){const task=referralQueue.shift();if(task.generation!==referralGeneration)continue;
      try{const data=await lookupReferral(task.item.id);if(task.generation!==referralGeneration)continue;task.item.data=data;task.item.state='done';referralCache.set(task.item.range.key+'|'+task.item.id.toLowerCase(),data);}
      catch(error){if(task.generation!==referralGeneration)continue;task.item.state='error';task.item.error=error.message||'Referral gagal dibaca.';}
      renderReferral();
    }}finally{referralBusy=false;}
  }
  function maintainReferralDates(){
    if(!referralHost())return;
    if(location.pathname==='/referrallist.php')setReferralDates(document,true);
    const day=referralDateRange().key;
    if(day!==referralDay){referralDay=day;referralCache.clear();const ids=referralItems.map(v=>({id:v.id}));referralGeneration++;referralItems=[];referralQueue=[];if(ids.length)beginReferralIDs(ids,true);else renderReferral();}
  }
  if(referralHost()){
    maintainReferralDates();setInterval(maintainReferralDates,60000);window.addEventListener('focus',maintainReferralDates);
    if(location.pathname==='/referrallist.php'){
      document.addEventListener('submit',()=>setReferralDates(document,true),true);
      document.addEventListener('click',e=>{const button=e.target.closest('button,input[type="submit"],input[type="button"]');if(button&&/^(cari|search)$/i.test((button.tagName==='INPUT'?button.value:button.textContent).trim()))setReferralDates(document,true);},true);
    }
  }



  // ACCOUNT_SUFFIX_HELPERS_START
  function missingAccountSuffix(given,registered){
    const clean=value=>String(value||'').normalize('NFKC').trim().replace(/[\s.\-\u2010\u2011\u2013\u2014]/g,'');
    const short=clean(given),full=clean(registered);
    if(!/^\d{5,24}$/.test(short)||!/^\d{6,25}$/.test(full))return null;
    return full.length===short.length+1&&full.startsWith(short)?{given:short,full,missing:full.slice(-1)}:null;
  }
  function accountSuffixCandidates(numbers,records){
    const out=[],seen=new Set();
    for(const given of numbers){
      // An exact registered number takes precedence over a longer similar one.
      if(records.some(r=>r.number===given))continue;
      for(const record of records){
        const difference=missingAccountSuffix(given,record.number);if(!difference)continue;
        const key=[given,record.userId,record.number,record.bank,record.name].join('|');
        if(seen.has(key))continue;seen.add(key);out.push({...record,...difference});
      }
    }
    return out;
  }
  // ACCOUNT_SUFFIX_HELPERS_END
  function clearAccountWarning(){const box=$('account-warning');box.hidden=true;box.replaceChildren();}
  function refreshAccountWarning(){
    clearAccountWarning();
    if(panel.hidden||!['auto','bank','admin_bank'].includes(mode.value)||!input.value.trim())return;
    const numbers=extractSearchValues(input.value,'bank');if(!numbers.length)return;
    const records=[];
    for(const doc of searchDocuments())for(const row of doc.querySelectorAll('tr,[role="row"]')){
      if(!visible(row))continue;
      const record=readAdminRecord(row);if(record)records.push(record);
    }
    const candidates=accountSuffixCandidates(numbers,records);if(!candidates.length)return;
    const box=$('account-warning');box.hidden=false;
    const heading=document.createElement('div');heading.className='account-warning-heading';heading.textContent='NOMOR REKENING KURANG 1 ANGKA DI BELAKANG';
    const note=document.createElement('div');note.className='account-warning-note';note.textContent='Ditemukan nomor terdaftar yang sama di bagian awal. Cocokkan nama, bank, dan User ID sebelum memakai nomor lengkap.';
    box.append(heading,note);
    for(const r of candidates){
      const card=document.createElement('div');card.className='account-warning-card';
      const id=document.createElement('div');id.className='account-warning-id';id.textContent=[r.userId?'User ID: '+r.userId:'User ID belum terbaca',r.name,r.bank].filter(Boolean).join(' / ');card.append(id);
      for(const [label,value] of [['NOMOR YANG DIBERIKAN',r.given],['NOMOR TERDAFTAR',r.full]]){
        const caption=document.createElement('div');caption.className='account-warning-label';caption.textContent=label;
        const number=document.createElement('div');number.className='account-warning-number';
        if(value===r.full){number.textContent=r.given;const digit=document.createElement('mark');digit.textContent=r.missing;number.append(digit);}else number.textContent=value;
        card.append(caption,number);
      }
      const detail=document.createElement('div');detail.className='account-warning-note';detail.textContent='Angka terakhir yang belum ditulis: '+r.missing+'.';card.append(detail);
      const copy=document.createElement('button');copy.textContent='Salin nomor lengkap';copy.onclick=()=>{
        const field=document.createElement('textarea');field.value=r.full;card.append(field);
        copyAccountField(field,'Nomor lengkap').then(ok=>{if(ok)field.remove();else field.addEventListener('blur',()=>field.remove(),{once:true});});
      };card.append(copy);box.append(card);
    }
    if(candidates.length>1){const more=document.createElement('div');more.className='account-warning-note';more.textContent='Ada '+candidates.length+' kemungkinan. Pilih berdasarkan identitas akun, jangan hanya kemiripan nomor.';box.append(more);}
    const source=document.createElement('div');source.className='account-warning-note';source.textContent='Perbandingan memakai rekening pada tabel admin yang sudah dimuat.';box.append(source);
  }

  // BALANCE_HELPERS_START
  function parseBalance(value){
    let s=String(value).normalize('NFKC').trim().replace(/^(?:Rp\.?|IDR)\s*/i,'').replace(/\s*(?:IDR|rupiah)$/i,'').trim();
    if(!s||!/^[-+]?\d[\d., \u00a0]*$/.test(s))return null;
    s=s.replace(/[ \u00a0]/g,'');
    const sign=s.startsWith('-')?-1:1;s=s.replace(/^[-+]/,'');
    let normalized;
    if(/^\d+$/.test(s))normalized=s;
    else if(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(s))normalized=s.replace(/\./g,'').replace(',','.');
    else if(/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(s))normalized=s.replace(/,/g,'');
    else if(/^\d+[.,]\d{1,2}$/.test(s))normalized=s.replace(',','.');
    else return null;
    const n=Number(normalized)*sign;return Number.isFinite(n)&&Math.abs(n)<=Number.MAX_SAFE_INTEGER/100?n:null;
  }
  function isBalanceHeader(value){
    return /^(?:(?:current|available|main|member|player)\s+balance|balance(?:\s+(?:IDR|Rp|utama))?|saldo(?:\s+(?:utama|tersedia|saat ini|IDR|Rp))?)$/i.test(String(value).replace(/[():]/g,' ').replace(/\s+/g,' ').trim());
  }
  // Read only explicitly labelled cells belonging to this row. Never page totals.
  function readBalanceRecord(row){
    if(!row?.matches('tr,[role="row"]'))return null;
    const table=row.closest('table,[role="table"],[role="grid"]');if(!table)return null;
    const cells=Array.from(row.children).filter(c=>c.matches('td,th,[role="cell"],[role="gridcell"]'));
    if(!cells.length||cells.every(c=>c.matches('th,[role="columnheader"]')))return null;
    let idIndices=[],balanceIndices=[],source='';
    const add=(list,i)=>{if(!list.includes(i))list.push(i);};
    for(const header of Array.from(table.querySelectorAll('tr,[role="row"]')).filter(r=>r.closest('table,[role="table"],[role="grid"]')===table).slice(0,12)){
      const hc=Array.from(header.children).filter(c=>c.matches('td,th,[role="columnheader"]'));
      if(!hc.some(c=>/^(?:user\s*id|username|id\s*user)$/i.test(c.textContent.trim())))continue;
      if(hc.some(c=>Number(c.colSpan)>1||Number(c.rowSpan)>1))continue;
      hc.forEach((c,i)=>{const t=c.textContent.trim();if(/^(?:user\s*id|username|id\s*user)$/i.test(t))add(idIndices,i);if(isBalanceHeader(t)){add(balanceIndices,i);source=t;}});
    }
    cells.forEach((c,i)=>{const t=c.getAttribute('data-label')||c.getAttribute('data-title')||'';if(/^(?:user\s*id|username|id\s*user)$/i.test(t))add(idIndices,i);if(isBalanceHeader(t)){add(balanceIndices,i);source=t;}});
    if(idIndices.length!==1)return null;
    const idText=(cells[idIndices[0]]?.innerText||cells[idIndices[0]]?.textContent||'').replace(/No\s*Name.*$/i,'').trim();
    const userId=idText.match(/^[\p{L}\p{N}_@.\-]+/u)?.[0]||'';if(!userId)return null;
    const cell=balanceIndices.length===1?cells[balanceIndices[0]]:null;
    const raw=cell?(cell.innerText||cell.textContent).trim():'';
    return {userId,amount:cell?parseBalance(raw):null,raw,source:source||'Balance / Saldo',row};
  }
  // BALANCE_HELPERS_END
  let balanceTimer=0,balanceSignature='',balanceRecords=[];
  const rupiah=value=>'Rp'+value.toLocaleString('id-ID',{minimumFractionDigits:0,maximumFractionDigits:2});
  function clearBalance(){clearTimeout(balanceTimer);balanceSignature='';balanceRecords=[];$('balance-box').hidden=true;$('balance-box').replaceChildren();}
  function refreshBalance(force=false){
    if(panel.hidden||!input.value.trim()){clearBalance();return;}
    const records=[];
    if(isNativeMode()){
      const kind=mode.value==='admin_id'?'id':'bank',values=extractSearchValues(input.value,kind);
      for(const doc of searchDocuments())for(const row of doc.querySelectorAll('tr,[role="row"]')){
        if(!visible(row))continue;
        const r=readBalanceRecord(row);if(!r)continue;
        const matches=kind==='id'?values.some(v=>v.toLowerCase()===r.userId.toLowerCase()):values.includes(readAdminRecord(row)?.number);
        if(matches)records.push(r);
      }
    }else{
      const h=hits[index];const el=h?.el||h?.range?.startContainer?.parentElement;
      const r=readBalanceRecord(el?.closest('tr,[role="row"]'));if(r)records.push(r);
    }
    // Multiple rows with the same ID may disagree: make the uncertainty visible.
    const unique=[];
    for(const r of records){const old=unique.find(v=>v.userId.toLowerCase()===r.userId.toLowerCase());if(!old)unique.push({...r});else if(old.amount!==r.amount){old.amount=null;old.source='Beberapa baris memiliki saldo berbeda';}}
    const signature=JSON.stringify(unique.map(({userId,amount,raw,source})=>({userId,amount,raw,source})));
    if(!force&&signature===balanceSignature)return;
    balanceSignature=signature;balanceRecords=unique;
    const box=$('balance-box');box.replaceChildren();box.hidden=false;
    const top=document.createElement('div');top.className='balance-top';top.textContent='BALANCE / SALDO';
    const retry=document.createElement('button');retry.textContent='Baca ulang';retry.onclick=()=>refreshBalance(true);top.append(retry);box.append(top);
    if(!unique.length){const p=document.createElement('p');p.className='balance-caption';p.textContent='Saldo belum terbaca. Cari atau pilih baris User ID dengan kolom Balance / Saldo pada halaman admin.';box.append(p);return;}
    for(const r of unique){
      const high=r.amount!==null&&r.amount>10000;
      const card=document.createElement('div');card.className='balance-card'+(high?' high':'');
      const id=document.createElement('div');id.className='balance-id';id.textContent='USER ID \u2022 '+r.userId;
      const number=document.createElement('div');number.className='balance-number';number.textContent=r.amount===null?'Belum terbaca':rupiah(r.amount);
      const state=document.createElement('div');state.className='balance-state';state.textContent=r.amount===null?'PERLU CEK MANUAL':high?'MINTA DATA PENDUKUNG':'SALDO MAKSIMAL Rp10.000';
      const note=document.createElement('div');note.className='balance-caption';note.textContent=r.amount===null?'Kolom tidak dikenali, format tidak jelas, atau saldo berbeda. Tidak dianggap nol.':'Sumber: kolom '+r.source+' pada baris ID ini. Dibaca '+new Date().toLocaleTimeString('id-ID')+'.';
      card.append(id,number,state,note);
      if(high){const b=document.createElement('button');b.className='support-open';b.textContent='Siapkan permintaan data pendukung';b.onclick=()=>openSupport(r);card.append(b);}
      box.append(card);
    }
  }
  function openSupport(record){
    refreshBalance();
    const current=balanceRecords.find(r=>r.userId===record.userId);
    if(!current||current.amount===null||current.amount<=10000)return;
    $('support-editor')?.remove();
    const editor=document.createElement('div');editor.id='support-editor';
    const label=document.createElement('label');label.htmlFor='support-text';label.textContent='PERMINTAAN DATA PENDUKUNG';
    const field=document.createElement('textarea');field.id='support-text';field.value=`Mohon bantu lengkapi data pendukung untuk verifikasi User ID ${current.userId}, karena saldo yang terbaca sebesar ${rupiah(current.amount)} (di atas Rp10.000).\n\nMohon kirimkan:\n1. User ID dan keterangan kendala / perubahan yang diminta.\n2. Bukti transaksi terakhir yang relevan, lengkap dengan tanggal, nominal, dan nomor referensi.\n3. Tangkapan layar kendala yang dialami, jika ada.\n\nMohon tutup informasi yang tidak diperlukan. Jangan kirim password, PIN, atau kode OTP. Terima kasih.`;
    const hint=document.createElement('p');hint.className='balance-caption';hint.textContent='Sesuaikan daftar bukti dengan SOP sebelum disalin. Pesan tidak dikirim otomatis.';
    const copy=document.createElement('button');copy.textContent='Salin permintaan';copy.onclick=()=>copyAccountField(field,'Permintaan data pendukung');
    editor.append(label,field,hint,copy);$('balance-box').append(editor);editor.scrollIntoView({block:'nearest'});
  }
  function scheduleBalance(){clearTimeout(balanceTimer);if(!panel.hidden&&input.value.trim())balanceTimer=setTimeout(()=>refreshBalance(),700);}

  const observer=new MutationObserver(records=>{if(!records.some(r=>!host.contains(r.target)))return;scheduleReferralScan();dirty=true;if(!panel.hidden&&input.value){clearTimeout(timer);timer=setTimeout(()=>search(false),650);}});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  document.addEventListener('input',e=>{if(e.target===host)return;dirty=true;if(!panel.hidden&&input.value){clearTimeout(timer);timer=setTimeout(()=>search(false),400);}},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)$('close').click();});
  window.addEventListener('focus',scheduleBalance);
  window.addEventListener('scroll',schedulePaint,true);
  window.addEventListener('resize',()=>{place();schedulePaint();});
  window.visualViewport?.addEventListener('resize',()=>{place();schedulePaint();});
  window.visualViewport?.addEventListener('scroll',()=>{place();schedulePaint();});
  restoreNativeSearch();
  // QRIS_ADDON_START â€” isolated workflow; existing modes remain unchanged.
  const Q_URL='https://m2qris.com/staff/disburstment', Q_ADMIN='https://agwl2.admitoto.com/agentplayerlist.php';
  const Q_KEY='mf-qris-job-v2', Q_SESSION='mf-qris-worker-v2', Q_OWNER='mf-qris-owner-v2';
  const qMenu=document.createElement('details');
  qMenu.id='qris-menu';
  qMenu.style.cssText='margin-top:12px;border-top:1px solid #cba534;padding-top:12px';
  qMenu.innerHTML='<summary style="cursor:pointer;font-weight:800;color:#f4cf65;padding:8px 0">PENCARIAN QRIS Â· v3.28.0</summary><div class="row"><textarea id="q-id" placeholder="Tempel User ID / username di sini" aria-label="User ID QRIS"></textarea></div><div class="row"><button id="q-start" type="button">Cari QRIS</button><button id="q-stop" type="button">Batalkan</button><button id="q-clear" type="button">Hapus</button></div><div class="row"><button id="q-diagnostic" type="button">Salin pemeriksaan QRIS</button></div><div id="q-result" role="status" style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;padding-top:10px">Hasil muncul di sini. Pencarian berjalan di latar belakang; pastikan admin dan QRIS sudah login.</div>';
  panel.append(qMenu);
  const qLegacy=document.createElement('div');qLegacy.id='main-search-page';
  for(const child of Array.from(panel.children))if(child.id!=='panel-handle'&&child!==qMenu)qLegacy.append(child);
  const qNav=document.createElement('div');qNav.setAttribute('role','tablist');
  qNav.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0;';
  qNav.innerHTML='<button type="button" id="main-search-tab" role="tab" aria-controls="main-search-page">ID &amp; REKENING</button><button type="button" id="qris-search-tab" role="tab" aria-controls="qris-menu">PENCARIAN QRIS</button>';
  panel.insertBefore(qNav,qMenu);panel.insertBefore(qLegacy,qMenu);
  qLegacy.setAttribute('role','tabpanel');qLegacy.setAttribute('aria-labelledby','main-search-tab');
  qMenu.setAttribute('role','tabpanel');qMenu.setAttribute('aria-labelledby','qris-search-tab');
  qMenu.open=true;qMenu.querySelector('summary').hidden=true;qMenu.style.cssText='margin-top:0;padding-top:0;border:0;';
  $('panel-handle').querySelector('span').textContent='PENCARIAN Â· v3.28.0';
  function qShowPage(page){
    const qris=page==='qris';qLegacy.hidden=qris;qMenu.hidden=!qris;qMenu.open=true;
    for(const [id,active] of [['main-search-tab',!qris],['qris-search-tab',qris]]){
      const tab=root.getElementById(id);tab.setAttribute('aria-selected',String(active));
      tab.style.cssText='font-weight:800;font-size:12px;min-height:46px;border-radius:12px;'+(active?'background:linear-gradient(145deg,#ffe18a,#c69b32);color:#1e190d;border:1px solid #ffe4a0;box-shadow:0 3px 9px #0005;':'background:#22252c;color:#d8dce5;border:1px solid #494e58;');
    }
    try{sessionStorage.setItem('mf-search-page',page);}catch(_){}
    if(qris){serial++;clearTimeout(timer);$('marks').replaceChildren();}
  }
  let qWorkerReleased=false;
  function qSelectMain(){
    // Only relinquish automation when the user takes over the worker tab itself.
    // Choosing Main in the originating tab leaves its separate QRIS worker running.
    const token=qWorkerToken();
    if(token){
      qWorkerReleased=true;clearTimeout(qRefreshTimer);
      sessionStorage.removeItem(Q_SESSION);
      const hash=new URLSearchParams(location.hash.slice(1));
      if(hash.has('mfq')){hash.delete('mfq');history.replaceState(null,'',location.pathname+location.search+(hash.toString()?'#'+hash:''));}
      const job=qJob();
      if(job?.token===token){job.stage='cancelled';job.autoRefresh=false;job.message='Tab digunakan untuk ID & REKENING. Pencarian QRIS dapat dimulai lagi dari menu QRIS.';qSave(job);}
    }
    qShowPage('main');
  }
  root.getElementById('main-search-tab').onclick=qSelectMain;
  root.getElementById('qris-search-tab').onclick=()=>qShowPage('qris');
  qShowPage(new URLSearchParams(location.hash.slice(1)).has('mfq')?'qris':sessionStorage.getItem('mf-search-page')||'main');
  const qEl=id=>root.getElementById(id);
  const qSay=text=>{
    qEl('q-result').textContent=text;
    const j=qJob();
    if(j&&qWorkerToken()===j.token&&!['done','error','cancelled'].includes(j.stage)){
      j.progress=text;j.updated=Date.now();qSave(j);
    }
  };
  const qSleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const qDigits=v=>String(v||'').replace(/[\s.\-]/g,'');
  const qText=el=>(el?.textContent||'').replace(/\s+/g,' ').trim();
  let qRefreshTimer=0,qRenderedSignature='';
  let qRunning=false,qOwnedToken=sessionStorage.getItem(Q_OWNER)||'',qTab=null,qWatchTimer=0;
  function qStatusStyle(raw){
    const status=String(raw||'').trim().toUpperCase().replace(/[_\s]+/g,'-').replace(/-+/g,'-');
    if(!status||status==='PENDING')return {label:'PENDING',color:'#ffda57',background:'#493b10'};
    if(status==='SUCCESS')return {label:'SUCCESS',color:'#69efa8',background:'#103e2c'};
    if(status==='FAILED-REFUND'||status==='FAILED'||status==='REFUND')return {label:status,color:'#ff9292',background:'#4a2027'};
    return {label:status,color:'#d6dfed',background:'#283345'};
  }
  function qRenderResult(j){
    const signature=JSON.stringify([j.stage,j.result,j.message,j.progress,j.finished,j.autoRefresh]);
    if(signature===qRenderedSignature)return;qRenderedSignature=signature;
    const box=qEl('q-result');box.replaceChildren();
    const results=j.result?.records||[];
    if(results.length){
      const count=document.createElement('div');count.textContent=results.length+' transaksi Â· terbaru di atas';count.style.cssText='font-weight:700;margin-bottom:10px;color:#f4cf65';box.append(count);
      for(const r of results){
        const card=document.createElement('div');card.style.cssText='background:#171b22;border:1px solid #a58a38;border-radius:12px;padding:12px;margin-bottom:8px;white-space:normal;';
        const status=qStatusStyle(r.status);
        for(const [label,value] of [['AMOUNT',r.amount],['STATUS',status.label],['DATETIME',r.datetime]]){
          const row=document.createElement('div');row.style.cssText='display:flex;justify-content:space-between;gap:12px;align-items:center;margin:6px 0;';
          const name=document.createElement('span');name.textContent=label;name.style.cssText='font-size:11px;color:#b4bcc8;';
          const val=document.createElement('strong');val.textContent=value||'â€”';val.style.cssText='text-align:right;font-size:14px;overflow-wrap:anywhere;';
          if(label==='STATUS')val.style.cssText+=`color:${status.color};background:${status.background};padding:5px 9px;border-radius:8px;`;
          row.append(name,val);card.append(row);
        }
        box.append(card);
      }
    }
    const note=document.createElement('div');note.style.cssText='font-size:12px;color:#c4c9d2;white-space:pre-wrap;';
    note.textContent=j.stage==='done'?(j.result?.note||(!results.length?'Belum ada transaksi yang cocok.':'')):(j.message||j.progress||'Mencariâ€¦');
    if(j.stage==='done'&&j.autoRefresh)note.textContent+=(note.textContent?'\n':'')+'Pembaruan otomatis setiap 1 menit.';
    if(results.length&&j.stage!=='done')note.textContent+='\nKartu masih menampilkan hasil pemeriksaan sebelumnya.';
    box.append(note);
  }
  function qWorkerToken(){if(qWorkerReleased)return '';return new URLSearchParams(location.hash.slice(1)).get('mfq')||sessionStorage.getItem(Q_SESSION)||'';}
  function qTerminal(j){return ['done','error','cancelled'].includes(j.stage);}
  function qCloseWorker(){if(qTab){try{qTab.close();}catch(_){}qTab=null;}}
  function qDisplayOwned(){
    if(!qOwnedToken)return;
    const j=qJob();
    if(!j||j.token!==qOwnedToken){
      qEl('q-result').textContent='Pencarian diganti dari tab lain atau sudah kedaluwarsa.';
      qCloseWorker();qOwnedToken='';sessionStorage.removeItem(Q_OWNER);clearInterval(qWatchTimer);return;
    }
    qRenderResult(j);
    qEl('q-start').disabled=!qTerminal(j);
    if(qTerminal(j)){if(j.stage!=='done'||!j.autoRefresh){qCloseWorker();clearInterval(qWatchTimer);}return;}
    if(Date.now()-(j.cycleStarted||j.created)>180000){
      j.stage='error';j.message='Pencarian belum selesai. Pastikan admin dan QRIS sudah login, lalu coba lagi. Browser HP mungkin menunda tab latar belakang.';qSave(j);qDisplayOwned();
    }
  }
  function qWatchOwned(){
    clearInterval(qWatchTimer);qWatchTimer=setInterval(qDisplayOwned,1000);qDisplayOwned();
  }
  // Storage notifications deliver results without moving or focusing the originating tab.
  if(typeof GM_addValueChangeListener==='function')GM_addValueChangeListener(Q_KEY,()=>qDisplayOwned());
  function qJob(){const j=GM_getValue(Q_KEY,null);return j&&Date.now()-(j.updated||j.finished||j.created)<15*60*1000?j:null;}
  function qSave(j){GM_setValue(Q_KEY,j);}
  function qAssert(j){if(qWorkerReleased)throw Error('Tab ini digunakan untuk ID & REKENING.');if(qJob()?.token!==j.token||qJob()?.stage==='cancelled')throw Error('Pencarian dibatalkan atau diganti pencarian baru.');}
  function qDayRange(now=new Date()){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const get=k=>parts.find(p=>p.type===k).value;
    const end=`${get('year')}-${get('month')}-${get('day')}`;
    const yesterday=new Date(end+'T00:00:00Z');yesterday.setUTCDate(yesterday.getUTCDate()-1);
    return {start:yesterday.toISOString().slice(0,10),end};
  }
  function qGo(url,j){qAssert(j);if(qWorkerToken()!==j.token)throw Error('Navigasi hanya diizinkan di tab pekerja QRIS.');qSave(j);location.replace(url+'#mfq='+encodeURIComponent(j.token));}
  function qLabel(el){
    const nearby=[];
    let group=el.parentElement;
    for(let depth=0;group&&depth<3;depth++,group=group.parentElement){
      if(Array.from(group.querySelectorAll('input')).filter(e=>visible(e)&&e.type!=='hidden').length!==1)break;
      for(const label of group.querySelectorAll('label,.form-label,.control-label,span,small'))nearby.push(qText(label));
      const direct=Array.from(group.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim();
      if(direct.length<80)nearby.push(direct);
    }
    return [el.name,el.id,el.placeholder,el.getAttribute('aria-label'),...Array.from(el.labels||[]).map(qText),...nearby].join(' ').toLowerCase();
  }
  function qThreeBarPattern(bars){
    const flat=bars.filter(b=>Number.isFinite(b.x+b.y+b.width+b.height)&&b.width>0&&b.height<=b.width*0.25).sort((a,b)=>a.y-b.y);
    if(flat.length!==3)return false;
    const [a,b,c]=flat,tolerance=Math.max(1,a.width*0.12);
    return a.width>b.width*1.15&&b.width>c.width*1.15&&Math.abs(a.x-b.x)<=tolerance&&Math.abs(a.x-c.x)<=tolerance&&b.y>a.y+a.height&&c.y>b.y+b.height;
  }
  function qHasThreeLineIcon(el){
    const svgs=el.tagName?.toLowerCase()==='svg'?[el]:Array.from(el.querySelectorAll('svg'));
    for(const svg of svgs){
      const bars=[];
      for(const shape of svg.querySelectorAll('line,rect,path,polyline')){
        try{const b=shape.getBBox();if(b.width>0&&b.height<=b.width*0.25)bars.push({x:b.x,y:b.y,width:b.width,height:b.height});}catch(_){}
      }
      if(qThreeBarPattern(bars))return true;
      // Many icon libraries combine all three horizontal strokes in one SVG path.
      for(const path of svg.querySelectorAll('path')){
        const d=path.getAttribute('d')||'';
        const strokes=[];
        const re=/M\s*(-?\d*\.?\d+)[ ,]+(-?\d*\.?\d+)\s*([Hh])\s*(-?\d*\.?\d+)/g;
        let match;while((match=re.exec(d))){const x=+match[1],y=+match[2],end=match[3]==='h'?x+(+match[4]):+match[4];strokes.push({x:Math.min(x,end),y,width:Math.abs(end-x),height:0});}
        if(qThreeBarPattern(strokes))return true;
      }
    }
    return false;
  }
  function qIsFilterButton(el){
    const text=el.tagName==='INPUT'?el.value:qText(el);
    const meta=[text,el.id,el.name,el.getAttribute('title'),el.getAttribute('aria-label'),el.getAttribute('data-original-title'),el.getAttribute('data-bs-original-title')].join(' ').toLowerCase();
    if(/export|download|refresh|reset|reload|transfer|withdraw|delete|hapus/.test(meta))return false;
    if(qHasThreeLineIcon(el))return true;
    if(/^(search|cari|filter|apply|terapkan|tampilkan)$/i.test(text))return true;
    if(/(?:^|[\s_-])(?:filter|search|cari|apply)(?:$|[\s_-])/.test(meta))return true;
    const icons=Array.from(el.querySelectorAll('svg,i,span,[data-feather],[data-lucide]'));
    return icons.some(icon=>{
      const tags=[icon.getAttribute('class'),icon.getAttribute('data-feather'),icon.getAttribute('data-lucide'),icon.getAttribute('data-icon'),icon.getAttribute('aria-label'),qText(icon)].join(' ').toLowerCase();
      return /(?:^|[\s_:-])(?:filter|filter_list|filter-list|list-filter|sort-variant|sort-descending|funnel|search)(?:$|[\s_:-])/.test(tags);
    });
  }
  function qFilterActionMeta(el){
    return [qText(el),el.id,el.name,el.getAttribute('class'),el.getAttribute('title'),el.getAttribute('aria-label'),...Array.from(el.querySelectorAll('svg,i,span')).map(e=>[e.getAttribute('class'),e.getAttribute('data-icon'),e.getAttribute('data-feather'),e.getAttribute('data-lucide')].join(' '))].join(' ').toLowerCase();
  }
  function qFindFilterButton(scope,search){
    // Confirmed by the user's live DOM diagnostic, independent of mobile geometry.
    const exact=Array.from(scope.querySelectorAll('button.btn-result')).filter(e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true');
    if(exact.length===1)return exact[0];
    if(exact.length>1)throw Error('Lebih dari satu tombol hasil QRIS; pencarian belum dikirim.');
    const selector='button,[role="button"],a.btn,input[type="submit"],input[type="button"],[onclick]';
    const iconControls=[];
    for(const svg of scope.querySelectorAll('svg')){
      if(!qHasThreeLineIcon(svg))continue;
      let target=svg.closest(selector);
      if(!target){
        let parent=svg.parentElement;
        for(let depth=0;parent&&scope.contains(parent)&&depth<3;depth++,parent=parent.parentElement){
          if(parent.contains(search))break;
          if(getComputedStyle(parent).cursor==='pointer'){target=parent;break;}
        }
      }
      if(target)iconControls.push(target);
    }
    const controls=[...new Set([...scope.querySelectorAll(selector),...iconControls])].filter(e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true'&&!e.contains(search));
    // Keep the actual outer clickable control, not both its icon and its button.
    const candidates=controls.filter(e=>!controls.some(other=>other!==e&&other.contains(e)));
    const r=search.getBoundingClientRect();
    const right=candidates.map(el=>{
      const b=el.getBoundingClientRect();
      const overlap=Math.min(r.bottom,b.bottom)-Math.max(r.top,b.top);
      return {el,gap:b.left-r.right,aligned:overlap>=Math.min(r.height,b.height)*0.5&&b.width>0&&b.height>0&&b.width<=Math.max(180,r.width)};
    }).filter(x=>x.aligned&&x.gap>=-2&&x.gap<=Math.max(120,r.width*0.6)).sort((a,b)=>a.gap-b.gap);
    if(right.length){
      const nearest=right[0].el;
      // The screenshot confirms this immediate neighbour is the three-line filter.
      // Never substitute refresh/export/financial action controls for that neighbour.
      if(/refresh|reload|reset|export|download|transfer|withdraw|delete|hapus|logout/.test(qFilterActionMeta(nearest)))throw Error('Tombol di sebelah Search bukan filter tiga garis. Pencarian belum dikirim.');
      if(right[1]&&Math.abs(right[1].gap-right[0].gap)<2)throw Error('Ada dua tombol bertumpuk di sebelah Search; filter belum ditekan.');
      return nearest;
    }
    const named=candidates.filter(qIsFilterButton);
    return named.length===1?named[0]:null;
  }
  function qDateRole(field){
    if(['start','end'].includes(field.dataset?.mfQrisDateRole))return field.dataset.mfQrisDateRole;
    const text=qLabel(field).replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().replace(/[^a-z0-9]+/g,' ');
    const compact=text.replace(/ /g,'');
    const start=/date\s*start|start\s*date|tanggal\s*awal|tgl\s*awal|date\s*from|from\s*date/.test(text)||/datestart|startdate|datefrom|fromdate|tanggalawal|tglawal/.test(compact);
    const end=/date\s*end|end\s*date|tanggal\s*akhir|tgl\s*akhir|date\s*to|to\s*date/.test(text)||/dateend|enddate|dateto|todate|tanggalakhir|tglakhir/.test(compact);
    if(start===end)return '';
    return start?'start':'end';
  }
  function qDateISO(value){
    const s=String(value||'').trim();
    let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m)return `${m[1]}-${m[2]}-${m[3]}`;
    m=s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    return m?`${m[3]}-${m[2]}-${m[1]}`:'';
  }
  function qCalendarLabels(iso){
    const date=new Date(iso+'T12:00:00Z'),labels=new Set();
    for(const locale of ['en-US','en-GB','id-ID'])for(const month of ['long','short','numeric','2-digit']){
      labels.add(new Intl.DateTimeFormat(locale,{year:'numeric',month,day:'numeric',timeZone:'UTC'}).format(date).toLowerCase().replace(/[^a-z0-9]/g,''));
    }
    labels.add(iso.replace(/-/g,''));return labels;
  }
  function qCalendarMonth(text){
    const year=String(text).match(/\b(20\d{2})\b/)?.[1];if(!year)return null;
    const words=String(text).toLowerCase().replace(/[^a-z]/g,'');
    for(let month=0;month<12;month++)for(const locale of ['en-US','id-ID'])for(const length of ['short','long']){
      const name=new Intl.DateTimeFormat(locale,{month:length,timeZone:'UTC'}).format(new Date(Date.UTC(2026,month,15))).toLowerCase().replace(/[^a-z]/g,'');
      if(words===name)return Number(year)*12+month;
    }
    return null;
  }
  function qFieldDateISO(field){
    if(field.dataset?.mfQrisDateShown===field.value&&field.dataset?.mfQrisDateISO)return field.dataset.mfQrisDateISO;
    return qDateISO(field.value);
  }
  function qCalendarIsOpen(calendar){
    // Angular custom-element hosts may have no rectangle although their days are visible.
    return !!calendar?.isConnected&&Array.from(calendar.querySelectorAll('button.mat-calendar-body-cell,.mat-calendar-period-button')).some(visible);
  }
  function qCalendarSelected(cell){
    return cell?.getAttribute('aria-selected')==='true'||!!cell?.querySelector('.mat-calendar-body-selected');
  }
  async function qSetDate(field,iso,j){
    qAssert(j);
    if(field.disabled||field.readOnly)throw Error('Date Start tidak dapat diketik pada halaman ini.');
    const [year,month,day]=iso.split('-'),text=`${day}-${month}-${year}`;
    const w=field.ownerDocument.defaultView;
    delete field.dataset.mfQrisDateISO;delete field.dataset.mfQrisDateShown;
    field.focus({preventScroll:true});
    try{field.setSelectionRange(0,field.value.length);}catch(_){}
    // Clear the entire old date, then enter DD-MM-YYYY through the input's native setter.
    setNativeValue(field,'');
    setNativeValue(field,text);
    field.dispatchEvent(new w.KeyboardEvent('keyup',{key:year.slice(-1),bubbles:true}));
    field.blur();
    await qSleep(400);
    await qWait(j,()=>qDateISO(field.value)===iso&&field.getAttribute('aria-invalid')!=='true'&&!field.classList.contains('ng-invalid'),10000,'Date Start belum menerima tanggal '+text+'. Proses dihentikan sebelum menekan tombol.');
    qAssert(j);return field.value;
  }
  function qUnique(items,label){if(items.length!==1)throw Error(label+' belum dapat dipastikan. Kirim screenshot filter dan judul kolom tabel QRIS untuk penyesuaian.');return items[0];}
  function qDateValue(el,iso){
    if(el.type==='date')return iso;
    const [y,m,d]=iso.split('-');
    const formats=[el.getAttribute('data-date-format'),el.getAttribute('data-format'),el.placeholder].filter(Boolean).map(v=>v.toLowerCase().trim());
    for(const f of formats){
      if(/dd\/mm\/yyyy|d\/m\/y/.test(f))return `${d}/${m}/${y}`;
      if(/dd-mm-yyyy|d-m-y/.test(f))return `${d}-${m}-${y}`;
      if(/yyyy-mm-dd|y-m-d/.test(f))return iso;
    }
    const current=String(el.value||'').trim();
    if(/^\d{2}\/\d{2}\/\d{4}$/.test(current))return `${d}/${m}/${y}`;
    if(/^\d{2}-\d{2}-\d{4}$/.test(current))return `${d}-${m}-${y}`;
    if(/^\d{4}-\d{2}-\d{2}$/.test(current))return iso;
    // Confirmed screenshot: M2QRIS Date Start / Date End show DD-MM-YYYY.
    if(location.hostname==='m2qris.com'&&qDateRole(el))return `${d}-${m}-${y}`;
    throw Error('Format Date Start / Date End belum dikenali.');
  }
  async function qApplyFilters(j){
    if(!/^\d{5,30}$/.test(j.account))throw Error('Nomor rekening AGWL belum valid; Search QRIS tidak diisi.');
    qAssert(j);
    let c=qFilterControls();
    const endValue=c.end.value,endISO=qDateISO(endValue);
    if(!endISO)throw Error('Tanggal bawaan Date End belum terbaca. Muat ulang halaman QRIS terlebih dahulu.');
    // Preserve the site's Date End exactly; never focus, click, or write to it.
    j.range.end=endISO;qSave(j);
    await qSetDate(c.start,j.range.start,j);
    qAssert(j);c=qFilterControls();
    if(c.end.value!==endValue||qDateISO(c.start.value)!==j.range.start)throw Error('Tanggal berubah setelah Date Start diisi. Pencarian belum dilanjutkan.');
    const refresh=c.refresh;
    if(!refresh?.isConnected||refresh.disabled)throw Error('Tombol panah putar QRIS belum siap.');
    qSay('Memuat ulang Disbursement lewat tombol panah putarâ€¦');
    refresh.click(); // Exactly once per cycle, before inserting the account.
    await qSleep(2000);
    await qWait(j,()=>!Array.from(document.querySelectorAll('[aria-busy="true"],.dataTables_processing,.dt-processing,mat-progress-spinner,mat-spinner,mat-progress-bar')).some(visible),25000,'QRIS masih memuat data setelah tombol panah putar.');
    qAssert(j);c=qFilterControls();
    if(c.end.value!==endValue||qDateISO(c.start.value)!==j.range.start)throw Error('Tanggal berubah setelah tombol panah putar. Hasil belum dibaca.');
    setNativeValue(c.search,j.account);
    // Support live filters bound to keyup, as after releasing Ctrl+V; never send Enter.
    const w=c.search.ownerDocument.defaultView;
    c.search.dispatchEvent(new w.KeyboardEvent('keyup',{key:'Control',code:'ControlLeft',bubbles:true}));
    await qSleep(400);qAssert(j);c=qFilterControls();
    if(qDateISO(c.start.value)===j.range.start&&c.end.value===endValue&&c.search.value===j.account){
      if(!c.button?.isConnected||c.button.disabled)throw Error('Tombol tiga garis belum siap.');
      qSay('Menekan tombol tiga garis sekali dan menunggu hasilâ€¦');
      j.stage='qris-result';j.accountPastedAt=Date.now();j.filterClickedAt=Date.now();qSave(j);
      c.button.click();return c;
    }
    throw Error('Date Start atau Search belum tersimpan. Filter belum dijalankan agar hasil tidak salah.');
  }

  function qTimestamp(raw){
    const s=String(raw).trim();
    let m=s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i);
    if(!m){const d=s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);if(d)m=[d[0],d[3],d[2],d[1],d[4],d[5],d[6],null];}
    if(!m)return null;
    const [,y,mo,d,h,mi,se='00',tz]=m;
    const check=new Date(Date.UTC(+y,+mo-1,+d));
    if(check.getUTCFullYear()!==+y||check.getUTCMonth()!==+mo-1||check.getUTCDate()!==+d||+h>23||+mi>59||+se>59)return null;
    const time=Date.parse(`${y}-${mo}-${d}T${h.padStart(2,'0')}:${mi}:${se}${tz||'+07:00'}`);
    return Number.isFinite(time)?{time,day:`${y}-${mo}-${d}`} : null;
  }
  async function qWait(j,read,ms=25000,message='Halaman belum selesai dimuat atau data belum dikenali. Periksa login dan hasil pencarian, lalu tekan Cari QRIS lagi.'){const until=Date.now()+ms;while(Date.now()<until){qAssert(j);const value=read();if(value)return value;await qSleep(400);}throw Error(message);}
  async function qAdmin(j){
    qSay('Mencari User ID di admin: '+j.id);
    if(j.stage==='admin'){
      await qWait(j,()=>resolveNativeField(document,'id'));
      j.stage='admin-result';qSave(j);
      mode.value='admin_id';input.value=j.id;runNativeSearch(j.id);
      if(!$('status').textContent.startsWith('Pencarian dikirim:'))throw Error($('status').textContent);
      await qSleep(1500);
    }
    const account=await qWait(j,()=>{
      const records=Array.from(document.querySelectorAll('tr,[role="row"]')).map(readAdminRecord).filter(r=>r?.userId?.toLowerCase()===j.id.toLowerCase()&&/^\d{5,30}$/.test(r.number));
      const unique=[...new Set(records.map(r=>r.number))];
      if(unique.length>1)throw Error('User ID mempunyai beberapa rekening berbeda. Nomor tujuan QRIS belum dapat dipastikan.');
      return unique.length===1?records[0]:null;
    });
    qAssert(j);j.account=account.number;j.bank=account.bank||'';j.range=qDayRange();j.stage='qris';
    qSay('Rekening ditemukan: '+j.account+'\nMembuka Disbursementâ€¦');qGo(Q_URL,j);
  }
  function qDiagnostic(reason='Pemeriksaan manual'){
    const short=v=>String(v||'').replace(/\s+/g,' ').trim().slice(0,160);
    const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(Math.round);};
    const attrs=e=>({tag:e.tagName,type:e.type||'',id:short(e.id),name:short(e.name),class:short(e.getAttribute('class')),role:short(e.getAttribute('role')),title:short(e.getAttribute('title')),aria:short(e.getAttribute('aria-label')),visible:visible(e),rect:rect(e)});
    // Collect control structure only. Never include input values, table rows, cookies or tokens.
    const inputs=Array.from(document.querySelectorAll('input')).filter(e=>e.type!=='hidden'&&e.type!=='password').slice(0,60).map(e=>{
      let group=e.parentElement;
      const wrappers=[];
      for(let depth=0;group&&depth<3;depth++,group=group.parentElement)wrappers.push({tag:group.tagName,class:short(group.getAttribute('class')),inputs:group.querySelectorAll('input').length});
      return {...attrs(e),placeholder:short(e.placeholder),labels:Array.from(e.labels||[]).map(e=>short(e.textContent)),detectedLabel:short(qLabel(e)),dateRole:qDateRole(e),readonly:e.readOnly,disabled:e.disabled,hasValue:!!e.value,dateDisplay:e.matches('.mat-datepicker-input')?short(e.value):undefined,invalid:e.getAttribute('aria-invalid'),dateShape:/^\d{4}-\d{2}-\d{2}$/.test(e.value)?'YYYY-MM-DD':/^\d{2}-\d{2}-\d{4}$/.test(e.value)?'DD-MM-YYYY':/^\d{2}\/\d{2}\/\d{4}$/.test(e.value)?'DD/MM/YYYY':'other/empty',wrappers};
    });
    const buttons=Array.from(document.querySelectorAll('button,[role="button"],a.btn,input[type="submit"],[onclick]')).filter(visible).slice(0,80).map(e=>({...attrs(e),text:e.tagName==='INPUT'?'':short(qText(e)),icons:Array.from(e.querySelectorAll('svg,i,span')).slice(0,5).map(i=>({tag:i.tagName,class:short(i.getAttribute('class')),icon:short(i.getAttribute('data-icon')),paths:Array.from(i.querySelectorAll('path')).slice(0,3).map(p=>short(p.getAttribute('d')))}))}));
    const headings=Array.from(document.querySelectorAll('table')).slice(0,8).map(t=>Array.from(t.querySelectorAll('thead th,thead td,th')).slice(0,24).map(e=>short(qText(e))));
    const captions=[];const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
    while((n=walker.nextNode()))if(qDateCaptionRole(n.nodeValue)&&visible(n.parentElement))captions.push({text:short(n.nodeValue),parent:attrs(n.parentElement)});
    return {version:'3.28.0',page:location.origin+location.pathname,reason:short(reason),ready:document.readyState,visibility:document.visibilityState,calendars:Array.from(document.querySelectorAll('mat-calendar,.mat-calendar')).map(c=>({connected:c.isConnected,open:qCalendarIsOpen(c),selected:Array.from(c.querySelectorAll('button.mat-calendar-body-cell')).filter(qCalendarSelected).map(e=>e.getAttribute('aria-label')),animations:(c.closest('.cdk-overlay-pane')?.getAnimations?.({subtree:true})||[]).map(a=>a.playState)})),iframes:document.querySelectorAll('iframe').length,inputs,buttons,headings,captions:captions.slice(0,12)};
  }
  qEl('q-diagnostic').onclick=async()=>{
    const j=qJob();let diagnostic;
    try{
      if(j?.token===qOwnedToken&&j.diagnostic)diagnostic=j.diagnostic;
      else if(location.hostname==='m2qris.com'||nativeAllowed())diagnostic=qDiagnostic();
      else diagnostic={version:'3.28.0',stage:j?.stage||'none',reason:'Belum ada laporan halaman. Buka Disbursement, lalu tekan Salin pemeriksaan QRIS di bubble.'};
      const text=JSON.stringify(diagnostic,null,2);
      if(typeof GM_setClipboard==='function')GM_setClipboard(text,'text');else await navigator.clipboard.writeText(text);
      qEl('q-result').textContent='Pemeriksaan tersalin. Tempel hasilnya ke percakapan ini agar bagian yang gagal dapat diperbaiki.';
    }catch(error){qEl('q-result').textContent='Belum berhasil menyalin pemeriksaan: '+error.message;}
  };
  function qDateCaptionRole(text){
    const t=String(text||'').toLowerCase().replace(/[^a-z]/g,'');
    if(/^(datestart|startdate|datefrom|fromdate|tanggalawal|tglawal|start|from)$/.test(t))return 'start';
    if(/^(dateend|enddate|dateto|todate|tanggalakhir|tglakhir|end|to)$/.test(t))return 'end';
    return '';
  }
  function qDateLike(field){
    return field.type==='date'||!!qDateISO(field.value)||/date|tanggal|tgl|dd.mm|yyyy|flatpickr|datepicker/i.test([qLabel(field),field.className,field.placeholder].join(' '));
  }
  function qResolveDates(fields,search){
    const dates=fields.filter(e=>e!==search&&qDateLike(e));
    let start=dates.filter(e=>qDateRole(e)==='start'),end=dates.filter(e=>qDateRole(e)==='end');
    if(start.length===1&&end.length===1&&start[0]!==end[0])return {start:start[0],end:end[0]};
    // Some layouts render captions as plain DIV text without label/for attributes.
    const captions=[];
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      const role=qDateCaptionRole(node.nodeValue),parent=node.parentElement;
      if(!role||!parent||parent.closest('table,script,style,nav,aside')||!visible(parent))continue;
      const range=document.createRange();range.selectNodeContents(node);
      const rect=range.getBoundingClientRect();
      if(rect.width&&rect.height)captions.push({role,parent,rect});
    }
    function findByCaption(role){
      const found=new Set();
      for(const caption of captions.filter(c=>c.role===role)){
        // A single editable/displayed input inside a caption's small wrapper is strongest.
        let group=caption.parent;
        for(let depth=0;group&&depth<3;depth++,group=group.parentElement){
          const local=fields.filter(e=>e!==search&&group.contains(e));
          if(local.length===1){found.add(local[0]);break;}
          if(local.length>1)break;
        }
        if(found.size)continue;
        const ranked=fields.filter(e=>e!==search&&['date','text','search',''].includes(e.type)).map(field=>{
          const r=field.getBoundingClientRect(),c=caption.rect;
          const overlap=Math.min(r.right,c.right)-Math.max(r.left,c.left);
          const gap=r.top-c.bottom;
          return {field,score:Math.abs(gap)+Math.abs(r.left-c.left)*0.1,ok:overlap>0&&gap>=-5&&gap<=100};
        }).filter(v=>v.ok).sort((a,b)=>a.score-b.score);
        if(ranked.length&&(!ranked[1]||ranked[1].score-ranked[0].score>8))found.add(ranked[0].field);
      }
      return [...found];
    }
    start=findByCaption('start');end=findByCaption('end');
    if(start.length===1&&end.length===1&&start[0]!==end[0])return {start:start[0],end:end[0]};
    // Screenshot-confirmed toolbar: exactly two date boxes before Search, start on the left.
    // Require both captions in that same toolbar; never guess among multiple date pairs.
    let scope=search.parentElement;
    for(let depth=0;scope&&scope!==document.body&&depth<7;depth++,scope=scope.parentElement){
      const local=dates.filter(e=>scope.contains(e));
      if(local.length>2)break;
      if(local.length!==2)continue;
      const text=qText(scope).toLowerCase();
      if(!/date\s*start|start\s*date/.test(text)||!/date\s*end|end\s*date/.test(text))continue;
      const ordered=local.slice().sort((a,b)=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return Math.abs(x.top-y.top)>12?x.top-y.top:x.left-y.left;});
      return {start:ordered[0],end:ordered[1]};
    }
    throw Error('Kotak Date Start / Date End belum terhubung. Pastikan halaman Disbursement selesai dimuat dan kedua kotak tanggal terlihat.');
  }
  function qFilterControls(){
    const fields=Array.from(document.querySelectorAll('input')).filter(e=>visible(e)&&!e.disabled);
    const search=qUnique(fields.filter(e=>!qDateLike(e)&&!e.readOnly&&['text','search','tel'].includes(e.type)&&/search|cari|rekening|account.?number/.test(qLabel(e))),'Kolom Search QRIS');
    const mapped=qResolveDates(fields,search),start=[mapped.start],end=[mapped.end];
    // Retain the role for blank date fields whose captions were resolved visually.
    mapped.start.dataset.mfQrisDateRole='start';mapped.end.dataset.mfQrisDateRole='end';
    const form=search.form;
    if(form){const url=new URL(form.action||location.href,location.href);if(url.origin!==location.origin||url.pathname.replace(/\/$/,'')!=='/staff/disburstment')throw Error('Form bukan filter Disbursement.');}
    // Restrict icon recognition to the smallest filter toolbar enclosing both dates and Search.
    let scope=search.parentElement;
    while(scope&&(!scope.contains(start[0])||!scope.contains(end[0])))scope=scope.parentElement;
    scope=scope||form||document;
    let refresh=null,button=null;
    for(let depth=0;scope&&depth<4;depth++,scope=scope.parentElement){
      const matches=Array.from(scope.querySelectorAll('button.btn-refresh')).filter(visible);
      if(matches.length>1)throw Error('Ada lebih dari satu tombol panah putar pada filter QRIS.');
      if(matches.length===1)refresh=matches[0];
      const filters=Array.from(scope.querySelectorAll('button.btn-result')).filter(visible);
      if(filters.length>1)throw Error('Ada lebih dari satu tombol tiga garis pada filter QRIS.');
      if(filters.length===1)button=filters[0];
      if(refresh&&button)break;
      if(scope===form||scope===document.body)break;
    }
    if(!refresh)throw Error('Tombol panah putar di kanan tombol tiga garis belum ditemukan.');
    if(!button)throw Error('Tombol tiga garis QRIS belum ditemukan.');
    return {start:start[0],end:end[0],search,refresh,button};
  }

  function qReadTable(j){
    const matches=[];
    for(const table of document.querySelectorAll('table')){
      const headers=Array.from(table.querySelectorAll('thead tr,tr')).map(r=>Array.from(r.children).map(qText));
      for(const labels of headers){
        const norm=labels.map(s=>s.toLowerCase().replace(/[^a-z0-9]/g,''));
        const account=norm.findIndex(s=>/^(bankno|banknumber|bankaccno|accountnumber|accountno|bankaccountnumber|bankaccount|nomorrekening|norekening|norek|rekening|beneficiaryaccountnumber)$/.test(s));
        const amount=norm.findIndex(s=>/^(amount|nominal|jumlah)$/.test(s));
        const status=norm.findIndex(s=>/^(status|withdrawstatus|statuswithdraw|disbursementstatus)$/.test(s));
        const preferred=norm.findIndex(s=>/^(datetime|tanggalwaktu|dateandtime|createdat)$/.test(s));
        const date=preferred>=0?preferred:norm.findIndex(s=>/^(createddate|transactiondate|date)$/.test(s));
        if(account>=0&&status>=0&&date>=0&&amount>=0){matches.push({table,account,status,date,amount});break;}
      }
    }
    const schema=qUnique(matches,'Kolom rekening, status, dan datetime');
    const records=[];
    for(const row of schema.table.querySelectorAll('tbody tr')){
      const cells=Array.from(row.children);if(cells.length<=Math.max(schema.account,schema.status,schema.date,schema.amount))continue;
      // Trust the completed QRIS search results, including fully or partially masked accounts.
      // Do not reconstruct private account numbers or discard rows by matching visible digits.
      if(!visible(row))continue;
      const raw=qText(cells[schema.date]),date=qTimestamp(raw);
      if(!date)throw Error('Datetime tidak dikenali: '+raw+'. Hasil terbaru belum dapat dipastikan.');
      // User rule: a present but empty Status cell means the withdrawal is PENDING.
      // A missing Status column is still rejected by schema validation above.
      const rawStatus=qText(cells[schema.status]).replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').trim();
      const status=rawStatus||'PENDING',amount=qText(cells[schema.amount]);
      if(!amount)throw Error('Amount pada transaksi kosong; hasil belum dapat dipastikan.');
      records.push({amount,datetime:raw,status,rawStatus,pendingFromBlank:!rawStatus,time:date.time});
    }
    return {table:schema.table,records};
  }
  function qNext(table){
    let area=table.parentElement;
    for(let depth=0;area&&depth<7;depth++,area=area.parentElement){
      const material=Array.from(area.querySelectorAll('button.mat-mdc-paginator-navigation-next,button.mat-paginator-navigation-next'));
      if(material.length>1)break;
      if(material.length===1){const next=material[0];const disabled=next.disabled||next.getAttribute('aria-disabled')==='true';return {next:disabled?null:next,complete:!!disabled};}
    }
    const container=table.closest('.dataTables_wrapper,.dt-container')||table.parentElement;
    const candidates=Array.from(container.querySelectorAll('button,a')).filter(e=>visible(e)&&/^(next|berikutnya|selanjutnya|â€º|Â»|>)$/i.test(qText(e)||e.getAttribute('aria-label')||''));
    if(candidates.length>1)throw Error('Navigasi tabel ambigu; hasil terbaru belum dapat dipastikan.');
    const next=candidates[0];
    if(!next)return {next:null,complete:false};
    const disabled=next.disabled||next.getAttribute('aria-disabled')==='true'||next.matches('.disabled')||next.closest('li.disabled');
    return {next:disabled?null:next,complete:!!disabled};
  }
  async function qQRIS(j){
    if(j.stage==='qris'){
      qSay('Mengisi Date Start dengan tanggal kemarin (DD-MM-YYYY); Date End tetapâ€¦');
      await qWait(j,()=>document.querySelector('table')&&document.querySelector('input'));
      j.range=qDayRange();qSave(j);
      const c=await qApplyFilters(j);
      qSay('Rekening AGWL: '+j.account+'\nSearch QRIS: '+c.search.value+'\nDate Start: '+c.start.value+'\nDate End: '+c.end.value+'\nMembaca Disbursementâ€¦');
      await qSleep(2000); // Wait for the response after the single three-line button click.
    }
    const currentFilters=qFilterControls();
    if(currentFilters.search.value!==j.account||qFieldDateISO(currentFilters.start)!==j.range.start||qFieldDateISO(currentFilters.end)!==j.range.end)throw Error('Filter QRIS berubah atau belum diterapkan. Hasil tidak ditampilkan agar rekening/tanggal tidak tertukar.');
    const collected=[],seen=new Set();let complete=false;
    for(let page=0;page<100;page++){
      qAssert(j);
      // Require unchanged table content for 1.2 seconds before reading AJAX results.
      let last='',stable=0;const until=Date.now()+25000;
      while(Date.now()<until){qAssert(j);const s=Array.from(document.querySelectorAll('table')).map(qText).join('|');const busy=Array.from(document.querySelectorAll('[aria-busy="true"],.dataTables_processing,.dt-processing,mat-progress-spinner,mat-spinner,mat-progress-bar')).some(visible);if(s&&s===last&&!busy)stable++;else stable=0;last=s;if(stable>=3)break;await qSleep(400);}
      if(stable<3)throw Error('Tabel masih memuat data. Coba lagi setelah halaman siap.');
      const active=qFilterControls();
      if(active.search.value!==j.account||qFieldDateISO(active.start)!==j.range.start||qFieldDateISO(active.end)!==j.range.end)throw Error('Pencarian berubah ketika tabel dibaca. Hasil belum ditampilkan.');
      const {table,records}=qReadTable(j),signature=qText(table);
      if(seen.has(signature))throw Error('Halaman tabel berulang; hasil terbaru belum dapat dipastikan.');seen.add(signature);collected.push(...records);
      const nav=qNext(table);if(!nav.next){complete=nav.complete;break;}
      if(page===99)throw Error('Lebih dari 100 halaman; hasil terbaru belum dapat dipastikan.');
      qSay('Membaca Disbursement halaman '+(page+2)+'â€¦');nav.next.click();await qWait(j,()=>qText(table)!==signature);await qSleep(500);
    }
    qAssert(j);collected.sort((a,b)=>b.time-a.time);
    const notes=[];
    if(!collected.length)notes.push('Tidak ada transaksi pada hasil pencarian QRIS untuk rentang tanggal yang dipilih.');
    if(!complete)notes.push('Hasil hanya mencakup halaman yang berhasil dibaca; kelengkapan semua halaman belum dapat dipastikan.');
    j.result={records:collected.map(({amount,status,datetime})=>({amount,status,datetime})),note:notes.join('\n')};
    // Persist the complete result before the owner closes this dedicated worker tab.
    j.autoRefresh=false;
    j.stage='done';j.message='';j.progress='';j.finished=Date.now();j.updated=Date.now();qSave(j);qRenderResult(j);
  }
  function qScheduleRefresh(j){
    clearTimeout(qRefreshTimer);
    if(!j.autoRefresh||j.stage!=='done'||qWorkerToken()!==j.token)return;
    qRefreshTimer=setTimeout(()=>{
      const current=qJob();if(!current||current.token!==j.token||current.stage!=='done'||!current.autoRefresh)return;
      current.stage='qris';current.range=qDayRange();current.message='';current.progress='Memperbarui transaksi QRISâ€¦';current.cycleStarted=Date.now();current.updated=Date.now();qSave(current);qResume();
    },60000);
  }

  async function qResume(){
    if(qRunning||qWorkerReleased)return;
    let token=new URLSearchParams(location.hash.slice(1)).get('mfq');
    if(token){sessionStorage.setItem(Q_SESSION,token);history.replaceState(null,'',location.pathname+location.search);}
    token=token||sessionStorage.getItem(Q_SESSION);
    const j=qJob();if(!j||j.token!==token)return;
    if(j.stage==='done'){qScheduleRefresh(j);return;}if(['error','cancelled'].includes(j.stage))return;
    if(!nativeAllowed()&&!(location.origin==='https://m2qris.com'&&location.pathname.replace(/\/$/,'')==='/staff/disburstment')){
      j.stage='error';j.message='Sesi login belum aktif atau halaman dialihkan. Login admin dan M2QRIS terlebih dahulu, lalu ulangi pencarian.';qSave(j);return;
    }
    qRunning=true;qEl('q-id').value=j.id;
    try{if(nativeAllowed()&&j.stage.startsWith('admin'))await qAdmin(j);else if(location.hostname==='m2qris.com'&&j.stage.startsWith('qris'))await qQRIS(j);}
    catch(e){if(qWorkerReleased)return;qSay(e.message);if(qJob()?.token===j.token&&qJob()?.stage!=='cancelled'){j.stage='error';j.message=e.message+'\nTekan Salin pemeriksaan QRIS lalu kirim hasilnya.';try{j.diagnostic=qDiagnostic(e.message);}catch(_){}qSave(j);}}
    finally{qRunning=false;const current=qJob()||j;if(current.stage==='done'&&current.autoRefresh)qScheduleRefresh(current);else if(qWorkerToken()===j.token&&qTerminal(current))setTimeout(()=>window.close(),500);}
  }
  qEl('q-start').onclick=()=>{
    if(qMenu.hidden)return;
    const ids=extractSearchValues(qEl('q-id').value,'id');if(ids.length!==1){qSay('Tempel satu User ID yang jelas.');return;}
    if(qRunning){qSay('Pencarian sedang berjalan.');return;}
    if(typeof GM_openInTab!=='function'){qSay('Perbarui script di Tampermonkey agar izin tab latar belakang tersedia.');return;}
    const previous=qJob();if(previous&&!qTerminal(previous)){previous.stage='cancelled';qSave(previous);}
    qCloseWorker();
    const j={token:crypto.randomUUID(),created:Date.now(),cycleStarted:Date.now(),autoRefresh:false,id:ids[0],stage:'admin',progress:'Mencari rekening di adminâ€¦'};
    qOwnedToken=j.token;sessionStorage.setItem(Q_OWNER,j.token);qSave(j);
    qMenu.open=true;qEl('q-start').disabled=true;
    try{
      qTab=GM_openInTab(Q_ADMIN+'#mfq='+encodeURIComponent(j.token),{active:false,insert:true,setParent:true});
      if(!qTab)throw Error('Tab latar belakang tidak berhasil dibuka. Periksa izin Tampermonkey.');
      qTab.onclose=()=>{
        const current=qJob();if(current?.token===j.token&&(!qTerminal(current)||(current.stage==='done'&&current.autoRefresh))){
          current.stage='error';current.message='Tab pencarian ditutup; pembaruan otomatis berhenti. Tekan Cari QRIS untuk mulai lagi.';qSave(current);
        }
      };
      qWatchOwned();
    }catch(e){j.stage='error';j.message=e.message||'Tidak dapat memulai pencarian latar belakang.';qSave(j);qDisplayOwned();}
  };
  qEl('q-stop').onclick=()=>{
    const j=qJob();if(j&&j.token===qOwnedToken){j.stage='cancelled';j.autoRefresh=false;j.message='Pencarian dan pembaruan otomatis dihentikan.';qSave(j);qDisplayOwned();}
  };
  function qClear(){
    const j=qJob(),worker=qWorkerToken();
    const own=j&&(j.token===qOwnedToken||j.token===worker);
    qOwnedToken='';sessionStorage.removeItem(Q_OWNER);
    clearInterval(qWatchTimer);qWatchTimer=0;clearTimeout(qRefreshTimer);
    if(worker){qWorkerReleased=true;sessionStorage.removeItem(Q_SESSION);}
    if(own)qSave({token:j.token,stage:'cancelled',autoRefresh:false,created:j.created,updated:Date.now(),message:'Pencarian QRIS dihapus.'});
    qCloseWorker();qRenderedSignature='';
    qEl('q-id').value='';qEl('q-result').replaceChildren();
    qEl('q-start').disabled=false;
    qEl('q-id').focus({preventScroll:true});
  }
  qEl('q-clear').onclick=qClear;
  // Worker tabs own the page automation; the originating tab only displays progress/results.
  if(qOwnedToken&&!qWorkerToken()){
    const saved=qJob();if(saved?.token===qOwnedToken){qEl('q-id').value=saved.id;qWatchOwned();}
  }
  // Standalone QRIS tabs also refresh data once per minute, without reloading a form mid-edit.
  if(location.origin==='https://m2qris.com'&&location.pathname.replace(/\/$/,'')==='/staff/disburstment'){
    setInterval(()=>{
      if(qWorkerToken()||qRunning)return;
      if(Array.from(document.querySelectorAll('mat-calendar,.mat-calendar')).some(qCalendarIsOpen)||document.activeElement?.matches('input,textarea,select'))return;
      const refresh=Array.from(document.querySelectorAll('button.btn-refresh')).filter(e=>visible(e)&&!e.disabled);
      if(refresh.length===1)refresh[0].click();
    },60000);
  }
  setTimeout(qResume,700);
  // QRIS_ADDON_END
})();
