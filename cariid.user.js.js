// ==UserScript==
// @name         Cari ID & Rekening HP — Bubble Find
// @namespace    local.mobile.find
// @version      1.3.0
// @description  Bubble kecil untuk mencari teks halaman, User ID, dan rekening di HP. Tanpa server dan tanpa OCR.
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
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
    #panel{position:fixed;left:10px;top:12px;width:min(350px,calc(100vw - 20px));padding:12px;background:#111d30;color:#eef5ff;border:1px solid #3d587c;border-radius:16px;box-shadow:0 10px 35px #0008;pointer-events:auto;font:14px system-ui;max-height:85vh;overflow:auto}
    [hidden]{display:none!important}.row{display:flex;gap:8px;align-items:center;margin-top:9px}.title{display:flex;align-items:center;justify-content:space-between;font-weight:700}.title button{font-size:20px}
    input,textarea,select{color:#f1f5ff;background:#0a1424;border:1px solid #425b7e;border-radius:9px;padding:10px;min-width:0;font-size:16px}input,textarea{width:100%}textarea{resize:vertical;min-height:88px;line-height:1.4}select{flex:1}#status{flex:1;font-size:13px;color:#cedef6}#note{font-size:11px;color:#9eafc8;line-height:1.4;margin-top:9px}
    #checks{display:grid;gap:6px;margin-top:9px}.check{padding:8px;border-radius:8px;background:#172235;color:#9eafc8;border:1px solid #344155;overflow-wrap:anywhere}.check.yes{background:#123e2d;color:#bcffdb;border-color:#328e63;box-shadow:0 0 8px #26a86633}.hit.good{background:#27c47538;border-color:#27c475}.hit.good.current{outline-color:#27c475}
    .hit{position:fixed;pointer-events:none;background:#ffbf0038;border:1px solid #e5a800;border-radius:2px}.hit.current{background:#ff7a0044;outline:2px solid #ff8c22}
  </style>
  <div id="marks"></div>
  <button id="bubble" title="Cari User ID / rekening" aria-label="Buka pencarian">⌕</button>
  <section id="panel" hidden aria-label="Cari di halaman">
    <div class="title">CARI DI HALAMAN<button id="close" aria-label="Tutup">×</button></div>
    <div class="row"><select id="mode" aria-label="Jenis pencarian"><option value="auto">Otomatis / sekali tempel</option><option value="text">User ID / teks</option><option value="bank">Nomor rekening</option></select></div>
    <div class="row"><textarea id="query" rows="3" placeholder="Tempel bebas: nama, rekening, bank…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="enter"></textarea></div>
    <div class="row"><button id="search">Cari</button><button id="clear">Hapus</button></div>
    <div class="row"><span id="status" role="status" aria-live="polite">Masukkan pencarian</span><button id="prev" aria-label="Hasil sebelumnya">↑</button><button id="next" aria-label="Hasil berikutnya">↓</button></div>
    <div id="checks"></div>
    <div id="note">Mencari teks yang sudah dimuat pada halaman ini.</div>
  </section>`;
  const $ = id => root.getElementById(id);
  const bubble = $('bubble'), panel = $('panel'), input = $('query'), mode = $('mode');
  let bundle = null;
  let hits = [], index = -1, serial = 0, timer, frame = 0, dirty = true, clipped = false;
  let position = {x:innerWidth-58,y:innerHeight*0.6};
  try {position = GM_getValue('bubble-position',position);} catch (_) {}
  const viewport = () => {const v=window.visualViewport;return {x:v?.offsetLeft||0,y:v?.offsetTop||0,w:v?.width||innerWidth,h:v?.height||innerHeight};};
  function place(){const v=viewport();position.x=Math.max(v.x+6,Math.min(position.x,v.x+v.w-50));position.y=Math.max(v.y+6,Math.min(position.y,v.y+v.h-50));bubble.style.left=position.x+'px';bubble.style.top=position.y+'px';panel.style.left=(v.x+10)+'px';panel.style.top=(v.y+10)+'px';panel.style.width=Math.min(350,v.w-20)+'px';panel.style.maxHeight=Math.max(100,v.h-20)+'px';}
  place();
  let drag=null, suppressClickUntil=0;
  function savePosition(){try{GM_setValue('bubble-position',position);}catch(_){}}
  function startDrag(id,x,y){
    drag={id,x,y,bx:position.x,by:position.y,moved:false};
  }
  function moveDrag(id,x,y){
    if(!drag||drag.id!==id)return;
    const dx=x-drag.x,dy=y-drag.y;
    if(Math.hypot(dx,dy)>7)drag.moved=true;
    if(drag.moved){position={x:drag.bx+dx,y:drag.by+dy};place();}
  }
  function endDrag(id,cancelled=false){
    if(!drag||drag.id!==id)return;
    const moved=drag.moved;drag=null;
    suppressClickUntil=Date.now()+700;
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
  window.addEventListener('blur',()=>{if(drag)endDrag(drag.id,true);});
  bubble.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    if(Date.now()<suppressClickUntil)return;
    toggle();
  });
  function toggle(){panel.hidden=!panel.hidden;if(!panel.hidden){place();input.focus();if(input.value)search(false);}else{serial++;$('marks').replaceChildren();}}
  $('close').onclick=()=>{panel.hidden=true;serial++;$('marks').replaceChildren();};
  function clear(){bundle=null;$('checks').replaceChildren();serial++;clearTimeout(timer);hits=[];index=-1;$('marks').replaceChildren();$('status').textContent='Masukkan pencarian';}
  $('clear').onclick=()=>{input.value='';clear();input.focus();};
  mode.onchange=()=>{input.inputMode=mode.value==='bank'?'numeric':'text';input.placeholder=mode.value==='bank'?'Ketik nomor rekening…':mode.value==='auto'?'Tempel bebas: nama, rekening, bank…':'Ketik User ID atau teks…';search(false);};
  input.oninput=()=>{serial++;clearTimeout(timer);timer=setTimeout(()=>search(false),300);};
  input.onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();input.blur();search(true);}if(e.key==='Escape')$('close').click();};
  $('search').onclick=()=>{input.blur();search(true);};
  function status(){ renderChecks();$('status').textContent=hits.length?`${index+1} / ${hits.length}${clipped?'+':''} hasil`:'Tidak ditemukan';}
  function navigate(delta){if(dirty){search(true);return;}if(!hits.length)return;index=(index+delta+hits.length)%hits.length;reveal();}
  $('prev').onclick=()=>navigate(-1);$('next').onclick=()=>navigate(1);
  function reveal(){const h=hits[index];if(!h)return;const el=h.el||h.range.startContainer.parentElement;el.scrollIntoView({block:'center',inline:'center',behavior:'instant'});if(h.el){try{h.el.setSelectionRange(h.start,h.end);}catch(_){}}status();schedulePaint();}
  function schedulePaint(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;paint();});}
  function paint(){const marks=$('marks');marks.replaceChildren();if(panel.hidden)return;const fragment=document.createDocumentFragment();let count=0;for(let i=0;i<hits.length;i++){const h=hits[i];if(!(h.el||h.range.startContainer).isConnected)continue;const rects=h.parts?h.parts.flatMap(p=>Array.from(p.range.getClientRects())):h.el?[h.el.getBoundingClientRect()]:h.range.getClientRects();for(const r of rects){if(!r.width||!r.height||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)continue;const mark=document.createElement('div');mark.className='hit'+(h.parts?' good':'')+(i===index?' current':'');mark.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;fragment.append(mark);if(++count>=400)break;}if(count>=400)break;}marks.append(fragment);}
  function visible(el){if(!el||el.closest('script,style,noscript,template,[hidden],[inert]'))return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&s.visibility!=='collapse'&&el.getClientRects().length>0;}
  // Keep inline fragments together, but never join separate table cells/blocks.
  function block(el){while(el&&el!==document.body){const d=getComputedStyle(el).display;if(!['inline','contents'].includes(d))return el;el=el.parentElement;}return document.body;}
  function pattern(){const raw=input.value.trim();if(!raw)return null;if(mode.value==='bank'){const digits=raw.replace(/[\s.\-]/g,'');if(!/^\d+$/.test(digits))return null;return new RegExp(digits.split('').join('[\\s.\\-]*'),'g');}return new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');}
  async function search(jump){const token=++serial;clearTimeout(timer);hits=[];index=-1;clipped=false;$('marks').replaceChildren();if(!input.value.trim()){clear();return;}bundle=mode.value==='auto'?parseBundle(input.value):null;$('checks').replaceChildren();$('note').textContent='Mencari teks yang sudah dimuat pada halaman ini.';if(bundle){await searchBundle(token,jump);return;}const regex=pattern();if(!regex){$('status').textContent='Masukkan angka rekening';return;}$('status').textContent='Mencari…';
    const groups=[];let group=null,owner=null,n,steps=0;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(node){const p=node.parentElement;return p&&!host.contains(p)&&!p.closest('textarea,select')&&visible(p)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
    while((n=walker.nextNode())){const b=block(n.parentElement);if(b!==owner){owner=b;group={text:'',nodes:[]};groups.push(group);}group.nodes.push({node:n,start:group.text.length});group.text+=n.data;if(++steps%600===0){await new Promise(r=>setTimeout(r,0));if(token!==serial)return;}}
    const found=[];
    for(const g of groups){regex.lastIndex=0;let m;while((m=regex.exec(g.text))){const end=m.index+m[0].length;const first=g.nodes.find(x=>x.start+x.node.length>m.index);const last=g.nodes.find(x=>x.start+x.node.length>=end);if(!first||!last)continue;const range=document.createRange();try{range.setStart(first.node,m.index-first.start);range.setEnd(last.node,end-last.start);if(range.getClientRects().length)found.push({range});}catch(_){}if(found.length>=2000){clipped=true;break;}}if(clipped)break;if(++steps%250===0){await new Promise(r=>setTimeout(r,0));if(token!==serial)return;}}
    if(!clipped)for(const el of document.querySelectorAll('input:not([type]),input[type="text"],input[type="search"],input[type="tel"],input[type="number"],textarea')){if(!visible(el))continue;regex.lastIndex=0;let m;while((m=regex.exec(el.value))){found.push({el,start:m.index,end:m.index+m[0].length});if(found.length>=2000){clipped=true;break;}}if(clipped)break;}
    if(token!==serial)return;hits=found;index=hits.length?0:-1;dirty=false;status();if(jump&&hits.length)reveal();else schedulePaint();
  }

  // A zero in a bank name remains a zero: 0vo is NOT silently changed to OVO.
  // PURE_HELPERS_START
  function parseBundle(value) {
    const text=value.normalize('NFKC').replace(/\r/g,'').trim();
    if(!text)return null;
    const result={bank:'',number:'',name:''};
    // Longer labels first; label boundaries also work when pasted on one line.
    const labels=/\b(nama\s*(?:bank|bqnk|bnk)|jenis\s*(?:bank|bqnk|bnk)|bank|bqnk|bnk|bangk|e[ -]?wallet|dompet(?:\s*digital)?|nama\s*(?:rekening|rek|pemilik|penerima)|atas\s*nama|a\s*[/.]\s*n\.?|an\.|nomor\s*(?:rekening|rek)|no\.?\s*(?:rekening|rek)|norek|no\s*rek|rekening|rek\.?|nm\.?(?:\s*(?:rekening|rek))?|nama)\b\s*[:=\-]?\s*/gi;
    const bankPattern=/\b(?:BCA|BRI|BNI|BSI|MANDIRI|CIMB(?:\s+NIAGA)?|PERMATA|DANAMON|BTN|MAYBANK|OCBC|PANIN|MEGA|JAGO|SEABANK|NEOBANK|DANA|OVO|0VO|GOPAY|SHOPEEPAY|LINKAJA)\b/i;
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
    const source=kind==='number'?value.split('').join('[\\s.\\-]*'):value.split(/\s+/).map(escapeRE).join('\\s+');
    const re=new RegExp(source,'giu');let m;
    while((m=re.exec(text))){
      const before=text.slice(0,m.index),after=text.slice(m.index+m[0].length);
      const word=kind==='number'?/[0-9]/u:/[\p{L}\p{N}_]/u;
      if((before&&word.test(before.slice(-1)))||(after&&word.test(after[0])))continue;
      return {start:m.index,end:m.index+m[0].length};
    }
    return null;
  }
  // PURE_HELPERS_END
  function renderChecks(){
    const box=$('checks');box.replaceChildren();if(!bundle)return;
    const hit=hits[index];
    for(const [key,label] of [['bank','Bank / dompet'],['number','Rekening'],['name','Nama']]){
      if(!bundle[key])continue;
      const ok=!!hit?.matches[key],el=document.createElement('div');el.className='check'+(ok?' yes':'');
      el.textContent=`${ok?'✓':'○'} ${label}: ${bundle[key]} — ${ok?'cocok':'tidak ditemukan pada data ini'}`;box.append(el);
    }
    $('note').textContent='Cocok dengan teks halaman, bukan verifikasi bank. Status berlaku untuk satu baris/data yang dipilih. 0 dan O dianggap berbeda.';
  }
  function recordOwner(el){
    return el.closest('tr,[role="row"],li,article,[data-record-id]')||block(el);
  }
  function makeRange(g,match){
    const a=g.nodes.find(n=>n.start+n.node.length>match.start);
    const b=g.nodes.find(n=>n.start+n.node.length>=match.end);
    if(!a||!b)return null;
    const r=document.createRange();r.setStart(a.node,match.start-a.start);r.setEnd(b.node,match.end-b.start);return r;
  }
  async function searchBundle(token,jump){
    $('status').textContent='Mencocokkan…';
    const records=new Map();let n,steps=0;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const p=node.parentElement;return p&&!host.contains(p)&&!p.closest('textarea,select,script,style')&&visible(p)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    while((n=walker.nextNode())){
      const el=recordOwner(n.parentElement);
      // Do not combine an entire page into a supposed single account record.
      if(!el||el===document.body||el===document.documentElement)continue;
      let g=records.get(el);if(!g){g={el,text:'',nodes:[],lastBlock:null};records.set(el,g);}
      const b=block(n.parentElement);if(g.lastBlock&&g.lastBlock!==b)g.text+=' ';
      g.nodes.push({node:n,start:g.text.length});g.text+=n.data;g.lastBlock=b;
      if(++steps%500===0){await new Promise(r=>setTimeout(r,0));if(token!==serial)return;}
    }
    const candidates=[];
    for(const g of records.values()){
      if(g.text.length>5000)continue;
      const matches={},parts=[];
      for(const key of ['bank','number','name']){
        const match=fieldMatch(g.text,bundle[key],key);
        if(match){const range=makeRange(g,match);if(range&&range.getClientRects().length){matches[key]=true;parts.push({range,key});}}
      }
      if(parts.length)candidates.push({el:g.el,parts,matches});
      if(++steps%300===0){await new Promise(r=>setTimeout(r,0));if(token!==serial)return;}
    }
    if(token!==serial)return;
    // Prefer account-number records. If absent, try the full name, then bank.
    const anchor=candidates.some(h=>h.matches.number)?'number':candidates.some(h=>h.matches.name)?'name':'bank';
    const selected=candidates.filter(h=>h.matches[anchor]);clipped=selected.length>2000;
    hits=selected.slice(0,2000);index=hits.length?0:-1;dirty=false;status();
    if(jump&&hits.length)reveal();else schedulePaint();
  }

  const observer=new MutationObserver(records=>{if(!records.some(r=>!host.contains(r.target)))return;dirty=true;if(!panel.hidden&&input.value){clearTimeout(timer);timer=setTimeout(()=>search(false),650);}});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  document.addEventListener('input',e=>{if(e.target===host)return;dirty=true;if(!panel.hidden&&input.value){clearTimeout(timer);timer=setTimeout(()=>search(false),400);}},true);
  window.addEventListener('scroll',schedulePaint,true);
  window.addEventListener('resize',()=>{place();schedulePaint();});
  window.visualViewport?.addEventListener('resize',()=>{place();schedulePaint();});
  window.visualViewport?.addEventListener('scroll',()=>{place();schedulePaint();});
})();
