// ==UserScript==
// @name         Cari ID & Rekening HP â€” Bubble Find
// @namespace    local.mobile.find
// @version      2.0.0
// @description  Bubble kecil untuk mencari teks halaman, User ID, dan rekening di HP. Tanpa server dan tanpa OCR.
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
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
  </style>
  <div id="marks"></div>
  <button id="bubble" title="Cari User ID / rekening" aria-label="Buka pencarian"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button>
  <section id="panel" hidden aria-label="Cari di halaman">
    <div class="title" id="panel-handle" title="Sentuh judul lalu geser"><span>COCOKKAN DATA ADMIN</span><button id="close" aria-label="Tutup">Ã—</button></div>
    <div class="row"><select id="mode" aria-label="Jenis pencarian"><option value="auto">Sekali tempel chat â€” cari semua</option><option value="admin_id">Cari User ID di admin (otomatis)</option><option value="admin_bank">Cari nomor rekening di admin (otomatis)</option><option value="id">Ctrl F â€” User ID di halaman</option><option value="name">Nama rekening</option><option value="text">Ctrl F â€” teks di halaman</option><option value="bank">Nomor rekening</option></select></div>
    <div class="row"><textarea id="query" rows="3" placeholder="Tempel chat: nama, nomor rekening, bank / e-walletâ€¦" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="enter"></textarea></div>
    <div class="row"><button id="search">Cari semua</button><button id="clear">Hapus</button></div>
    <div class="row"><span id="status" role="status" aria-live="polite">Masukkan pencarian</span><button id="prev" aria-label="Hasil sebelumnya">â†‘</button><button id="next" aria-label="Hasil berikutnya">â†“</button></div>
    <div id="native-preview" hidden></div><div id="checks"></div>
    <div id="note">Mencari teks yang sudah dimuat pada halaman ini.</div>
    <details id="tidy">
      <summary>âœ¦ RAPIKAN &amp; SALIN</summary>
      <div class="hint">Rapikan teks atau nomor tanpa mengubah kolom pencarian di atas.</div>
      <button id="tidy-from-query" type="button">Ambil teks pencarian</button>
      <label for="tidy-source">Teks asli</label>
      <textarea id="tidy-source" rows="3" placeholder="Tempel teks atau nomor rekening di siniâ€¦" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
      <label for="tidy-format">Cara merapikan</label>
      <select id="tidy-format">
        <option value="account">Nama + nomor + bank (salin satu-satu)</option>
        <option value="text">Teks rapi â€” garis pemisah jadi baris</option>
        <option value="bank">Nomor saja â€” hapus spasi, titik, strip</option>
      </select>
      <div class="row"><button id="tidy-run" type="button">Rapikan</button><button id="tidy-reset" type="button">Hapus</button></div>
      <div id="tidy-fields"></div>
      <label for="tidy-result">Hasil â€” dapat diedit sebelum disalin</label>
      <textarea id="tidy-result" rows="4" placeholder="Hasil rapi muncul di siniâ€¦" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
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
  function toggle(){panel.hidden=!panel.hidden;if(!panel.hidden){place();input.focus();if(input.value)search(false);}else{serial++;$('marks').replaceChildren();}}
  $('close').onclick=()=>{panel.hidden=true;serial++;$('marks').replaceChildren();};
  function clear(){$('native-preview').hidden=true;$('native-preview').replaceChildren();bundle=null;bundles=[];$('checks').replaceChildren();serial++;clearTimeout(timer);hits=[];index=-1;$('marks').replaceChildren();$('status').textContent='Masukkan pencarian';}
  $('clear').onclick=()=>{input.value='';clear();input.focus();};
  mode.onchange=()=>{input.inputMode='text';input.placeholder=mode.value==='admin_id'?'Tempel chat: User ID / username / user nameâ€¦':mode.value==='admin_bank'?'Tempel chat yang memuat nomor rekeningâ€¦':mode.value==='bank'?'Ketik nomor rekeningâ€¦':mode.value==='name'?'Ketik nama atau tempel data rekeningâ€¦':mode.value==='auto'?'Tempel bebas: nama, rekening, bankâ€¦':'Ketik User ID atau teksâ€¦';$('search').textContent=isNativeMode()?'Cari di admin':'Cari';search(false);};
  input.oninput=()=>{serial++;clearTimeout(timer);timer=setTimeout(()=>search(false),300);};
  input.onkeydown=e=>{if(e.key==='Enter'&&(isNativeMode()||mode.value==='id'||e.ctrlKey||e.metaKey)&&!e.shiftKey){e.preventDefault();input.blur();if(isNativeMode())runNativeSearch();else search(true);}if(e.key==='Escape')$('close').click();};
  $('search').onclick=()=>{input.blur();if(isNativeMode())runNativeSearch();else search(true);};
  function status(){ renderChecks();$('status').textContent=hits.length?`${index+1} / ${hits.length}${clipped?'+':''} hasil`:'Tidak ditemukan';}
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
          new MutationObserver(()=>{dirty=true;if(!panel.hidden&&input.value){clearTimeout(timer);timer=setTimeout(()=>search(false),650);}}).observe(doc.body,{subtree:true,childList:true,characterData:true});
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
  async function search(jump){if(isNativeMode()){serial++;clearTimeout(timer);hits=[];index=-1;bundle=null;bundles=[];$('checks').replaceChildren();$('marks').replaceChildren();previewNative();return;}$('native-preview').hidden=true;const token=++serial;clearTimeout(timer);hits=[];index=-1;clipped=false;$('marks').replaceChildren();if(!input.value.trim()){clear();return;}bundles=mode.value==='auto'?extractAccounts(input.value):[];if(mode.value==='auto'&&!bundles.length)bundles=[{label:'Chat ditempel',raw:input.value,name:'',number:'',bank:''}];if(mode.value==='auto'&&/^[a-z_][a-z0-9_]*[0-9][a-z0-9_]*$/i.test(cleanID(input.value))&&!bundles.some(q=>q.name||q.number||q.bank))bundles=[];bundle=bundles[0]||null;$('checks').replaceChildren();$('note').textContent='Mencari teks yang sudah dimuat pada halaman ini.';if(bundle){await searchBundle(token,jump);return;}const regex=pattern();if(!regex){$('status').textContent=mode.value==='bank'?'Masukkan angka rekening':mode.value==='name'?'Masukkan nama rekening yang jelas':'Masukkan User ID';return;}$('status').textContent='Mencariâ€¦';
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
    const source=kind==='number'?value.split('').join('[\\s.\\-â€â€‘â€“â€”]*'):value.split(/\s+/).map(escapeRE).join('\\s+');
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
    return /^[\p{L}\p{M}\s.'â€™\-]+$/u.test(raw)?raw:'';
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
      const numRE=/(?<![\p{L}\p{N}_])\d(?:[\d \t.\-â€â€‘â€“â€”]*\d)?(?![\p{L}\p{N}_])/gu;
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
      const clean=v=>v.replace(/^[\s:;=|/.,\-â€“â€”]+|[\s:;=|/.,\-â€“â€”]+$/g,'').replace(/\s+/g,' ');
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
          .replace(/[|/:;=,â€¢â—â–ª_â€“â€”]+/g,' ').replace(/\s+-+\s+/g,' ');
        rest=clean(rest);
        if(rest&&/^[\p{L}\p{M} .â€™'\-]+$/u.test(rest)&&rest.split(/\s+/).length<=8&&!/\b(?:tolong|cari|cek|transfer|kirim|terima|kasih|terdaftar|baru|akun)\b/i.test(rest))record.name=rest;
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
    const detail=document.createElement('small');detail.textContent=hit?`${hit.admin?.userId?'User ID: '+hit.admin.userId+' â€¢ ':''}${count}/3 bagian cocok dengan chat`:'Tempel chat yang memuat nama, nomor, atau bank.';
    summary.append(heading,detail);
    box.append(summary);
    for(const [key,label] of [['userId','USER ID'],['name','NAMA REKENING'],['number','NOMOR REKENING'],['bank','BANK / E-WALLET']]){
      const isUserId=key==='userId';
      const ok=!isUserId&&!!hit?.matches[key],value=isUserId?(hit?.admin?.userId||''):(values[key]||current[key]||'');
      const card=document.createElement('div');card.className='check'+(ok?' yes':'');
      const title=document.createElement('div');title.className='match-title';title.textContent=label+(hit?.admin?' â€¢ DI ADMIN':'');
      const body=document.createElement('div');body.className='match-value';body.textContent=value||(isUserId?'User ID belum terbaca':'Belum terbaca dari chat');
      const bottom=document.createElement('div');bottom.className='match-bottom';
      const state=document.createElement('span');state.textContent=isUserId?(value?'User ID dari baris admin yang dipilih':'Pilih hasil yang memiliki kolom User ID'):(ok?'â— COCOK DENGAN CHAT':value?'â—‹ Tidak cocok / tidak ada di chat':'â—‹ Belum teridentifikasi');
      const copy=document.createElement('button');copy.textContent=isUserId?'Salin ID':'Salin';copy.setAttribute('aria-label','Salin '+label);copy.disabled=!value;copy.onclick=()=>{
        const temp=document.createElement('input');temp.value=value;temp.style.cssText='position:fixed;left:10px;bottom:10px;width:220px';root.append(temp);copyAccountField(temp,label).then(ok=>{if(ok)temp.remove();else temp.addEventListener('blur',()=>temp.remove(),{once:true});});
      };
      bottom.append(state,copy);card.append(title,body,bottom);box.append(card);
    }
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
      if(!/^[\p{L}\p{M}\s.'â€™\-]+$/u.test(value))return;
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
    const numeric=parts.filter(v=>/^\d[\d\s.\-â€â€‘â€“â€”]*$/.test(v)&&v.replace(/\D/g,'').length>=5);
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
    $('status').textContent='Mencocokkan nama, nomor, bankâ€¦';
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
      .replace(/[ï¼-ï¼™]/g,c=>String(c.charCodeAt(0)-0xFF10));
    if(format==='bank') {
      // Tidak menyatukan nomor melewati Enter, slash, pipe, atau label huruf.
      const results=[];
      for(const part of source.split(/[\n/|;,]+/)) {
        const re=/(?<![\p{L}\p{N}_])\d(?:[\d \t.\-â€â€‘â€“â€”]*\d)?(?![\p{L}\p{N}_])/gu;
        for(const match of part.matchAll(re)) {
          const digits=match[0].replace(/\D/g,'');
          if(digits.length>=5) results.push(digits);
        }
      }
      return results.join('\n');
    }
    return source.split('\n').flatMap(line=> {
      // Slash hanya pemisah jika diberi spasi; A/N, URL dan ID tetap utuh.
      if(/^\s*[-_=â”€â”â€”â€“|â€¢Â·*]{3,}\s*$/.test(line))return [];
      return line.replace(/^[ \t]*[â€¢â—â–ªâ–º]+[ \t]*/,'')
        .replace(/[ \t]*[|â”‚â”ƒ]+[ \t]*|[ \t]+\/[ \t]+|[ \t]+[-â€“â€”]{1,}[ \t]+/g,'\n')
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
        const field=document.createElement('input');field.type='text';field.value=account[key]||'';field.autocomplete='off';field.spellcheck=false;field.setAttribute('aria-label',label);field.placeholder='Belum terbaca â€” isi manual';
        const copy=document.createElement('button');copy.type='button';copy.textContent='Salin';copy.setAttribute('aria-label','Salin '+label);copy.disabled=!field.value.trim();
        field.oninput=()=>{account[key]=field.value;copy.disabled=!field.value.trim();if(tidyFormat.value==='account'){tidyResult.value=accountText(accounts);refreshCopy();}};
        copy.onclick=()=>copyAccountField(field,label);
        caption.append(row);row.append(field,copy);card.append(caption);
        if(key==='name'){
          const find=document.createElement('button');find.type='button';find.textContent='Cari nama ini';
          find.onclick=()=>{if(!field.value.trim()){tidyMessage('Isi nama rekening terlebih dahulu.');field.focus();return;}mode.value='name';input.value=field.value;input.inputMode='text';input.placeholder='Ketik nama rekeningâ€¦';field.blur();search(true);};card.append(find);
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
    tidyMessage(ok?'âœ“ '+label+' berhasil disalin.':'Tekan lama kolom yang terpilih, lalu pilih Salin.');
    if(ok){const toast=$('tidy-toast');toast.textContent='âœ“ '+label+' disalin';toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},2200);}
    return ok;
  }

  $('tidy-run').onclick=runTidy;
  tidyFormat.onchange=runTidy;
  tidySource.addEventListener('input',()=>{
    clearTimeout(tidyTimer);$('tidy-fields').replaceChildren();tidyResult.value='';refreshCopy();tidyMessage('Merapikanâ€¦');tidyTimer=setTimeout(runTidy,180);
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
      tidyMessage('âœ“ Hasil berhasil disalin.');const toast=$('tidy-toast');toast.textContent='âœ“ Hasil rapi disalin';toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true;},2200);
    }else{tidyMessage('Salin otomatis diblokir. Tekan lama hasil yang terpilih, lalu pilih Salin.');}
  };


  // NATIVE_PURE_START
  function extractSearchValues(value,kind){
    const text=String(value).normalize('NFKC').replace(/[\u200B\u2060\uFEFF]/g,'').trim();
    const unique=values=>[...new Set(values)];
    if(kind==='id'){
      const label=/\b(?:user\s*id|user\s*name|id\s*user)\b\s*(?:(?:nya|adalah|yaitu)\s*)?(?:[:=\-â€“>]+\s*)?["'`*]*\s*([a-z0-9_][a-z0-9_.@\-]*)/gi;
      const labelled=Array.from(text.matchAll(label)).map(m=>m[1].replace(/[.,;:]+$/g,''))
        .filter(v=>!['nama','bank','rekening','norek','username','userid','user','id','saya','nya','adalah','yaitu'].includes(v.toLowerCase()));
      if(labelled.length)return unique(labelled);
      const bare=text.replace(/^["'`*]+|["'`*]+$/g,'');
      return /^[a-z0-9_][a-z0-9_.@\-]*$/i.test(bare)?[bare]:[];
    }
    const result=[];
    const labelled=/\b(?:nomor\s*(?:rekening|rek)|no\.?\s*(?:rekening|rek)|norek|rekening|rek|account\s*(?:number|no))\b\s*(?:nya\s*)?[:=\-]*\s*(\d[\d \t.\-â€â€‘â€“â€”]*\d|\d)/gi;
    for(const m of text.matchAll(labelled)){const n=m[1].replace(/\D/g,'');if(n.length>=5&&n.length<=30)result.push(n);}
    if(result.length)return unique(result);
    for(const part of text.split(/[\n/,;|]+/)){
      for(const m of part.matchAll(/(?<![\p{L}\p{N}_])\d[\d \t.\-â€â€‘â€“â€”]*\d(?![\p{L}\p{N}_])/gu)){
        // Ignore obvious date strings instead of turning dates into accounts.
        if(/^\d{1,4}[-.]\d{1,2}[-.]\d{1,4}$/.test(m[0]))continue;
        const n=m[0].replace(/\D/g,'');if(n.length>=5&&n.length<=30)result.push(n);
      }
    }
    return unique(result);
  }
  function nativeFieldKind(value){
    const t=String(value).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');
    if(/^(?:user(?:id|name)|iduser|usernamefilter|searchuser(?:id|name)|txtuser(?:id|name)|cariuser(?:id|name))$/.test(t))return 'id';
    if(/^(?:namarekening|namarek|accountname|accname|bankaccname|bankaccountname|banknameholder|accountholder|txtnamarekening)$/.test(t))return 'name';
    if(/^(?:nomorrekening|norekening|norek|nomorrek|norekbank|rekening|rek|accountnumber|accountno|accno|bankaccount|bankacc|bankaccno|bankaccountnumber|bankaccountno|txtnorek|searchnorek)$/.test(t))return 'bank';
    return '';
  }
  // NATIVE_PURE_END
  function isNativeMode(){return mode.value==='admin_id'||mode.value==='admin_bank';}
  function nativeAllowed(){return location.hostname==='agwl2.admitoto.com'&&location.pathname==='/agentplayerlist.php';}
  function previewNative(){
    const box=$('native-preview');box.hidden=false;box.replaceChildren();
    const kind=mode.value==='admin_id'?'id':'bank',values=extractSearchValues(input.value,kind);
    const title=document.createElement('strong');title.textContent=kind==='id'?'USER ID YANG AKAN DICARI':'NOMOR REKENING YANG AKAN DICARI';box.append(title);
    if(!nativeAllowed()){$('status').textContent='Buka halaman daftar pemain admin';box.append(document.createTextNode(' â€” Fitur ini khusus agwl2.admitoto.com/agentplayerlist.php.'));return;}
    if(values.length===1){const v=document.createElement('div');v.className='native-value';v.textContent=values[0];box.append(v);box.append(document.createTextNode('Tekan Cari di admin untuk mengisi kolom dan menjalankan pencarian.'));$('status').textContent='Siap mencari di admin';}
    else if(values.length>1){box.append(document.createElement('br'));box.append(document.createTextNode('Ada beberapa data. Pilih yang ingin dicari:'));values.forEach(value=>{const b=document.createElement('button');b.textContent=value;b.onclick=()=>runNativeSearch(value);box.append(b);});$('status').textContent='Pilih satu data';}
    else{$('status').textContent=input.value.trim()?'Data belum terbaca':'Tempel data terlebih dahulu';box.append(document.createElement('br'));box.append(document.createTextNode(kind==='id'?'Contoh: username: kohbing007. Bisa juga tempel ID saja.':'Contoh: nomor rekening: 0882-2536-4576. Bisa juga tempel nomor saja.'));}
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
    const setter=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')?.set;
    if(setter)setter.call(field,value);else field.value=value;
    field.dispatchEvent(new w.Event('input',{bubbles:true}));field.dispatchEvent(new w.Event('change',{bubbles:true}));
  }
  let nativeBusy=false;
  function runNativeSearch(chosen){
    if(nativeBusy)return;
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
      // Clear only the companion identity filters, never unrelated form values.
      for(const other of ['id','name','bank']){const old=resolveNativeField(doc,other);if(old&&old!==field&&old.form===form)setNativeValue(old,'');}
      for(const box of scope.querySelectorAll('input[type="checkbox"]')){
        const k=nativeToggleKind(box);if(!['id','name','bank'].includes(k)||box.disabled)continue;
        const checked=k===kind;if(box.checked!==checked)box.click();
      }
      if(field.disabled||field.readOnly)throw new Error('Kolom pencarian tidak aktif.');
      setNativeValue(field,value);
      if(field.value!==value)throw new Error('Nilai pada kolom admin berubah. Pencarian dibatalkan.');
      $('status').textContent='Menjalankan pencarian adminâ€¦';
      try{sessionStorage.setItem('mobile-find-admin-pending',JSON.stringify({time:Date.now(),mode:mode.value,value}));}catch(_){}
      // Click the native search control once; no synthetic Enter or repeated submit.
      buttons[0].click();
      $('status').textContent='Pencarian dikirim: '+value;
    }catch(error){$('status').textContent=error.message||'Pencarian admin gagal.';}
    finally{setTimeout(()=>{nativeBusy=false;},1200);}
  }
  function restoreNativeSearch(){
    if(!nativeAllowed())return;
    try{const raw=sessionStorage.getItem('mobile-find-admin-pending');if(!raw)return;sessionStorage.removeItem('mobile-find-admin-pending');const saved=JSON.parse(raw);if(Date.now()-saved.time>90000||!['admin_id','admin_bank'].includes(saved.mode)||typeof saved.value!=='string')return;
      input.value=saved.value;mode.value=saved.mode;panel.hidden=false;place();$('search').textContent='Cari di admin';previewNative();$('status').textContent='Hasil pencarian admin: '+saved.value;
    }catch(_){}
  }

  const observer=new MutationObserver(records=>{if(!records.some(r=>!host.contains(r.target)))return;dirty=true;if(!panel.hidden&&input.value){clearTimeout(timer);timer=setTimeout(()=>search(false),650);}});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  document.addEventListener('input',e=>{if(e.target===host)return;dirty=true;if(!panel.hidden&&input.value){clearTimeout(timer);timer=setTimeout(()=>search(false),400);}},true);
  window.addEventListener('scroll',schedulePaint,true);
  window.addEventListener('resize',()=>{place();schedulePaint();});
  window.visualViewport?.addEventListener('resize',()=>{place();schedulePaint();});
  window.visualViewport?.addEventListener('scroll',()=>{place();schedulePaint();});
  restoreNativeSearch();
})();
