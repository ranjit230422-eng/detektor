// ==UserScript==
// @name         Jejak Main — Pencarian Region
// @namespace    jejak-main.regc.chatgacor.v1
// @version      1.55.0
// @description  Perbaikan koneksi tab Detail IDN Poker lintas alamat HTTPS, plus perbaikan preview Sleekshot dan gambar history.
// @match        https://app.chatgacor.com/app/*
// @match        https://regc.idnlive.live/*
// @match        https://*.idnlive.live/*
// @match        https://agwl2.admitoto.com/*
// @match        https://*/*
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_openInTab
// @grant        GM_setClipboard
// @require      https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  const PREFIX = 'jejak-main-v1:', JOB = PREFIX+'job', OUT = PREFIX+'result';
  const POKER_REQUEST=PREFIX+'poker-tab-request', POKER_REPLY=PREFIX+'poker-tab-reply', POKER_IMAGE=PREFIX+'poker-tab-image';
  const HISTORY_TRANS_TOKEN=PREFIX+'history-trans-worker', HISTORY_TRANS_IMAGE=PREFIX+'history-trans-image';
  const HISTORY_TAB_CLAIM=PREFIX+'history-tab-claim';
  const HISTORY_TAB_PROGRESS=PREFIX+'history-tab-progress';
  const SCRIPT_INSTANCE_ID=crypto.randomUUID();
  const isRegc = location.hostname === 'regc.idnlive.live';
  const isIdnlive = location.hostname === 'idnlive.live' || location.hostname.endsWith('.idnlive.live');
  const isAdmin=location.hostname==='agwl2.admitoto.com';
  const ADMIN=PREFIX+'admin-balance';
  const norm = s => String(s || '').trim().toLowerCase();
  const txt = e => (e?.innerText || e?.textContent || '').trim();
  const visible = e => !!e && !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  const all = (s, root = document) => [...root.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const live = () => GM_getValue(JOB, null);
  const active = j => { const v=live(); return v?.id===j.id && !v.cancel && Date.now()-v.created<45*60*1000; };
  function check(j) { if (!active(j)) throw Error('Pencarian dihentikan / kedaluwarsa.'); }
  function publish(j, patch) {
    if (!active(j)) return;
    const prev=GM_getValue(OUT, {});
    GM_setValue(OUT, {...(prev?.id===j.id ? prev : {}), id:j.id, user:j.user, updated:Date.now(), ...patch});
  }
  function exact(label, root=document) {
    return all('button,a,[role="button"],li,span', root).filter(visible)
      .filter(e=>norm(txt(e))===norm(label)).sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length)[0];
  }
  async function until(fn,j,ms=18000) {
    const start=Date.now();
    while(Date.now()-start<ms) { check(j); const v=fn(); if(v) return v; await sleep(100); }
    return null;
  }
  const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
  const jq=()=>page.jQuery;
  let controlScope='Transaction Regions';
  const controlKey=()=>PREFIX+'controls:'+controlScope;
  const mappings=()=>GM_getValue(controlKey(),controlScope==='Transaction Regions'?GM_getValue(PREFIX+'controls',{}):{});
  function mapped(name) {try{return document.querySelector(mappings()[name]||':not(*)');}catch{return null;}}
  const nickname = () => mapped('nickname')||all('input').filter(visible).find(e=>/nickname|user.?name|user.?id|player.?name/i.test([e.placeholder,e.name,e.id,e.getAttribute('aria-label')].join(' ')));

  function table() {
    if(mapped('table'))return mapped('table');
    const tables=all('table,[role="table"],[role="grid"]').filter(visible);
    const ranked=tables.map(el=>({el,score:all('th,[role="columnheader"]',el).filter(h=>/timestamp|game|round|user|nickname|amount/i.test(txt(h))).length})).sort((a,b)=>b.score-a.score);
    return ranked[0]?.score>=2?ranked[0].el:(tables.length===1?tables[0]:null);
  }
  let pickerCache=null;
  function rangePicker() {
    const $=jq();if(!$)return null;
    if(pickerCache&&pickerCache.el.isConnected&&visible(pickerCache.el)&&$(pickerCache.el).data('daterangepicker')===pickerCache.picker)return pickerCache;
    pickerCache=null;
    const nodes=[mapped('date'),...all('input,button,div,span')].filter(visible);
    for(const el of nodes) {
      const picker=$(el).data('daterangepicker');
      if(picker&&typeof picker.setStartDate==='function'&&typeof picker.setEndDate==='function')return (pickerCache={el,picker});
    }
    return null;
  }
  function dateControl() {
    return mapped('date')||rangePicker()?.el||all('input[type="date"]').filter(visible)[0]||all('input,[id*="reportrange"],[class*="date-range"],[data-toggle="daterangepicker"]').filter(visible)
      .find(e=>/date|range|tanggal/i.test([e.id,e.className,e.getAttribute('placeholder'),e.getAttribute('name')].join(' ')));
  }
  function calendarTrigger(date){
    // Prefer the calendar icon in the date control's own input group.
    const scope=date.closest?.('.input-group,.form-group,[class*="date-range"]')||date.parentElement||date;
    const icons=all('[class*="calendar"],[data-feather="calendar"],[aria-label*="calendar" i],[title*="calendar" i]',scope).filter(visible);
    const icon=icons.find(el=>!el.closest?.('.daterangepicker'));
    return icon?(icon.closest?.('button,.input-group-addon,.input-group-text,a')||icon):date;
  }
  function dateISO(offset=420,delta=0) {return new Date(Date.now()+offset*60000+delta*86400000).toISOString().slice(0,10);}
  function validRange(start,end) {
    const valid=x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
    return valid(start)&&valid(end)&&start<=end;
  }
  function calendarCellISO(cell,picker){
    if(!cell||cell.classList.contains('off')||cell.classList.contains('disabled'))return null;
    const side=cell.closest('.left')?'leftCalendar':cell.closest('.right')?'rightCalendar':null;
    const rc=(cell.getAttribute('data-title')||'').match(/^r(\d+)c(\d+)$/);
    const value=side&&rc&&picker?.[side]?.calendar?.[Number(rc[1])]?.[Number(rc[2])];
    if(value?.format)return value.format('YYYY-MM-DD');
    // DOM fallback: combine day text with the month/year of its own table.
    const table=cell.closest('table'),header=table?.querySelector('th.month,.month');
    if(!header||!/^\d{1,2}$/.test(txt(cell)))return null;
    const month=header.querySelector('select.monthselect'),year=header.querySelector('select.yearselect');
    if(month&&year){const iso=year.value+'-'+String(Number(month.value)+1).padStart(2,'0')+'-'+txt(cell).padStart(2,'0');return validRange(iso,iso)?iso:null;}
    const time=timestamp(txt(cell)+' '+txt(header)+' 00:00:00',0);
    return Number.isFinite(time)?new Date(time).toISOString().slice(0,10):null;
  }
  let domCalendar=null;
  function domClock(root,side){
    const panel=root?.querySelector('.'+side),hour=panel?.querySelector('select.hourselect'),minute=panel?.querySelector('select.minuteselect'),ampm=panel?.querySelector('select.ampmselect');
    if(!hour||!minute)return null;
    let h=Number(hour.value);if(ampm)h=h%12+(/^pm$/i.test(ampm.value)?12:0);
    return String(h).padStart(2,'0')+':'+String(Number(minute.value)).padStart(2,'0');
  }
  function verifyRange(j) {
    const r=rangePicker();
    if(r) return r.picker.startDate?.format('YYYY-MM-DD')===j.startDate&&r.picker.endDate?.format('YYYY-MM-DD')===j.endDate&&r.picker.startDate?.format('HH:mm')==='00:00'&&r.picker.endDate?.format('HH:mm')==='23:59';
    if(domCalendar?.isConnected){
      const starts=all('td.start-date',domCalendar).map(c=>calendarCellISO(c,null)),ends=all('td.end-date',domCalendar).map(c=>calendarCellISO(c,null));
      return starts.includes(j.startDate)&&ends.includes(j.endDate)&&domClock(domCalendar,'left')==='00:00'&&domClock(domCalendar,'right')==='23:59';
    }
    const inputs=all('input[type="date"]').filter(visible);
    return inputs.length===2&&inputs[0].value===j.startDate&&inputs[1].value===j.endDate;
  }
  function pressCalendarDay(cell){
    // Construct events in the cell's own page realm; userscript window proxies can break MouseEvent.view.
    const Mouse=cell.ownerDocument?.defaultView?.MouseEvent||MouseEvent;
    for(const type of ['mousedown','mouseup'])cell.dispatchEvent(new Mouse(type,{bubbles:true,cancelable:true,button:0,buttons:type==='mousedown'?1:0}));
    cell.click();
  }
  async function applyDates(j) {
    if(!validRange(j.startDate,j.endDate))throw Error('Tanggal pencarian tidak valid. Pilih tanggal dari bubble.');
    const date=dateControl();
    if(!date)throw Error('Kontrol tanggal tidak ditemukan. Di bubble REGC buka Pengaturan → Kenali tanggal.');
    publish(j,{message:'Mengatur tanggal '+j.startDate+' → '+j.endDate+'…'});
    calendarTrigger(date).click();await sleep(500);check(j);
    const opened=await until(()=>{const r=rangePicker();const root=r?.picker.container?.[0]||all('.daterangepicker').find(visible);return root&&visible(root)?{r,root}:null;},j,8000);
    if(opened) {
      const picker=opened.r?.picker;domCalendar=opened.root;
      // Read calendar dates only. Selection is performed by the site's actual day click handlers.
      for(const [step,iso] of [j.startDate,j.endDate].entries()){
        let day=null;
        for(let attempt=0;attempt<120;attempt++){
          const root=picker?.container?.[0]||opened.root;
          if(!root)throw Error('Panel kalender belum tersedia.');
          day=all('td.available[data-title]',root).filter(visible).find(cell=>calendarCellISO(cell,picker)===iso);
          if(day)break;
          const readMonths=()=>[...new Set(all('td.available[data-title]',root).filter(visible).map(c=>calendarCellISO(c,picker)?.slice(0,7)).filter(Boolean))].sort();
          const months=readMonths();
          if(!months.length)throw Error('Bulan/tahun kalender belum terbaca.');
          const month=iso.slice(0,7),direction=month<months[0]?'prev':month>months[months.length-1]?'next':null;
          if(!direction)throw Error('Tanggal '+iso+' tidak tersedia atau struktur sel belum dikenali.');
          const arrow=all('.'+direction+'.available',root).find(visible);
          if(!arrow)throw Error('Navigasi bulan ke '+iso+' tidak tersedia.');
          arrow.click();await sleep(450);check(j);
          const changed=await until(()=>readMonths().join('|')!==months.join('|'),j,4000);
          if(!changed)throw Error('Bulan kalender belum berubah setelah klik panah.');
        }
        if(!day)throw Error('Tanggal '+iso+' belum ditemukan setelah navigasi kalender.');
        publish(j,{message:'Klik '+(step+1)+'/2: '+iso+'…'});
        pressCalendarDay(day);await sleep(650);check(j);
      }
      const container=picker?.container?.[0]||opened.root;
      await sleep(300);check(j);
      const apply=container?.querySelector('.applyBtn')||all('.applyBtn').find(visible)||exact('Apply');
      if(!apply||apply.disabled)throw Error('Tombol Apply tanggal belum siap. Pilih rentang yang diizinkan REGC.');
      apply.click();
    } else {
      const inputs=all('input[type="date"]').filter(visible);
      if(inputs.length!==2)throw Error('Jenis kalender belum dikenali. Tekan Diagnosa di bubble REGC lalu kirim hasilnya untuk penyesuaian.');
      inputValue(inputs[0],j.startDate);inputValue(inputs[1],j.endDate);
      const apply=exact('Apply')||exact('Terapkan');
      if(!apply)throw Error('Tombol Apply belum ditemukan.');apply.click();
    }
    await sleep(450);await until(()=>!loading(),j,20000);
    if(!await until(()=>verifyRange(j),j,5000))throw Error('Apply belum menghasilkan '+j.startDate+' 00:00 sampai '+j.endDate+' 23:59. Pencarian dihentikan; kirim pesan ini beserta kalender yang tampil.');
    publish(j,{period:j.startDate+' → '+j.endDate,dateVerified:true});
  }
  function inputValue(el,value) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function enter(el) {
    el.focus();
    for(const type of ['keydown','keypress','keyup']) el.dispatchEvent(new KeyboardEvent(type,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));
  }
  const loading=()=>all('.dataTables_processing,.dt-processing,[aria-busy="true"],.ant-spin-spinning,.el-loading-mask').some(visible);
  async function response(j,action) {
    const initial=table(),before=txt(initial),start=Date.now();
    let current=initial,changed=false,drawComplete=false,last=start;
    const currentTable=()=>{if(!current||!current.isConnected||!visible(current))current=table();return current;};
    const mark=()=>{changed=true;last=Date.now();};
    const draw=()=>{drawComplete=true;mark();};
    const observer=new MutationObserver(records=>{
      const t=currentTable();
      if(t&&records.some(r=>t.contains(r.target)||[...r.addedNodes].some(n=>n===t||(n.nodeType===1&&n.contains(t)))))mark();
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
    const $=jq();if($&&initial)$(initial).on('draw.dt.jejakmain',draw);
    try {
      await action();
      while(Date.now()-start<30000) {
        check(j);const busy=loading(),t=currentTable();
        const fresh=t&&(drawComplete||changed||t!==initial||txt(t)!==before);
        // A completed DataTables draw is stronger evidence than a timer alone.
        // Generic DOM tables get a longer quiet window; stale tables never pass.
        const quiet=drawComplete?160:350,minElapsed=drawComplete?260:560;
        if(fresh&&!busy&&Date.now()-last>=quiet&&Date.now()-start>=minElapsed)return t;
        await sleep(80);
      }
      throw Error('Pencarian belum menghasilkan pembaruan tabel. Buka Pengaturan REGC → Kenali pencarian/tabel, lalu coba lagi.');
    } finally {observer.disconnect();if($&&initial)$(initial).off('draw.dt.jejakmain',draw);}
  }
  async function search(j) {
    const el=nickname();if(!el)throw Error('Search by nickname belum ditemukan. Gunakan Kenali pencarian di REGC.');
    const button=mapped('search');
    try {return await response(j,()=>{inputValue(el,j.user);if(button)button.click();else enter(el);});}
    catch(error) {
      check(j);const $=jq();if(!$||button)throw error;
      publish(j,{message:'Mencoba pemicu pencarian alternatif…'});
      return response(j,()=>{inputValue(el,j.user);for(const name of ['keydown','keypress','keyup']){const e=$.Event(name);e.key='Enter';e.code='Enter';e.which=13;e.keyCode=13;$(el).trigger(e);}});
    }
  }
  function primaryValue(value,label) {
    const k=key(label),raw=String(value||'').trim();
    if(['timestamp','transactiontimestamp','datetime','transactiontime','time','date'].includes(k))return raw.replace(/\s+/g,' ');
    let first=raw.split(/[\r\n]+/).map(x=>x.trim()).find(Boolean)||'';
    if(['roundid','round'].includes(k))first=first.split(/\bExt\.?\s*ID\s*:/i)[0].trim();
    if(k==='amount')first=first.split(/\bBalance\s*:/i)[0].trim();
    if(k==='type'||k==='transactiontype')first=first.replace(/^[•●·]\s*/, '');
    return first;
  }
  function readRows(t,j) {
    let headers=all('thead tr:last-child th,thead tr:last-child td',t).map(txt);
    if(!headers.length)headers=all('tr',t).find(tr=>tr.querySelector('th'))?all('th',all('tr',t).find(tr=>tr.querySelector('th'))).map(txt):all('[role="columnheader"]',t).map(txt);
    const idCol=headers.findIndex(h=>['nickname','user','userid','username','player','playername','playerid','account'].includes(key(h)));
    let trs=all('tbody tr',t).filter(visible);
    if(!trs.length)trs=all('[role="row"]',t).filter(e=>visible(e)&&e.querySelector('[role="cell"],[role="gridcell"]'));
    if(!trs.length) throw Error('Tabel tanpa baris dan tanpa pesan kosong; belum dapat dipastikan.');
    const out=[];let unmatched=0;
    for(const tr of trs) {
      if(tr.classList.contains('child')||tr.querySelector('th'))continue;
      let cells=all('td',tr).map(txt);
      if(!cells.length)cells=all('[role="cell"],[role="gridcell"]',tr).map(txt);
      if(cells.length===1 && /no (data|matching|records|result)|tidak ada|data kosong|no transactions/i.test(cells[0])) continue;
      if(!cells.length) continue;
      if(idCol<0) throw Error('Kolom identitas member belum dikenali; hasil tidak diambil agar tidak tertukar.');
      if(norm(primaryValue(cells[idCol],headers[idCol]))!==j.user){unmatched++;continue;}
      const row=cells.map((value,i)=>({label:headers[i]||`Kolom ${i+1}`,value:primaryValue(value,headers[i])}));
      const gameIndex=headers.findIndex(h=>['game','gamename','permainan'].includes(key(h)));
      if(!headers.some(h=>['provider','gameprovider'].includes(key(h)))&&gameIndex>=0){
        const lines=String(cells[gameIndex]||'').split(/[\r\n]+/).map(x=>x.trim()).filter(Boolean);
        if(lines[1])row.push({label:'Provider',value:lines[1]});
      }
      const roundIndex=headers.findIndex(h=>['roundid','round'].includes(key(h)));
      const amountIndex=headers.findIndex(h=>key(h)==='amount');
      const ext=roundIndex>=0?String(cells[roundIndex]).match(/Ext\.?\s*ID\s*:\s*([\s\S]*)/i):null;
      const balance=amountIndex>=0?String(cells[amountIndex]).match(/Balance\s*:\s*([^\r\n]*)/i):null;
      if(ext?.[1]?.trim())row.push({label:'Ext ID',value:ext[1].replace(/\s+/g,' ').trim()});
      if(balance?.[1]?.trim())row.push({label:'Balance',value:balance[1].trim()});
      // The secondary User/agent line is deliberately never retained.
      out.push(row);
    }
    if(!out.length&&unmatched)throw Error('User pada tabel tidak cocok dengan '+j.user+'. Jalankan pencarian member tersebut di REGC dahulu.');
    return out;
  }
  function nextButton() {
    const candidates=all('.paginate_button.next,.dt-paging-button.next,[aria-label="Next"],.pagination a,.pagination button').filter(visible);
    return candidates.find(e=>/next|berikut|›|»/i.test(txt(e)+' '+e.getAttribute('aria-label')) && !e.disabled && e.getAttribute('aria-disabled')!=='true' && !e.classList.contains('disabled') && !e.closest('li.disabled'));
  }
  async function setHundredRows(j,t){
    const wrapper=t.closest('.dataTables_wrapper,.dt-container,.datatable,.kt-datatable')||t.parentElement;
    const scopes=wrapper?[wrapper,document]:[document];
    let select=null;
    for(const scope of scopes){
      const candidates=all('.dataTables_length select,.dt-length select,select[name$="_length"],.datatable-pager-size select,.kt-datatable__pager-size select',scope)
        .filter(el=>!el.disabled&&[...el.options].some(o=>o.value==='100'||txt(o)==='100'));
      if(candidates.length===1){select=candidates[0];break;}
    }
    if(!select&&wrapper){
      const candidates=all('select',wrapper).filter(el=>!el.disabled&&['10','100'].every(n=>[...el.options].some(o=>o.value===n||txt(o)===n)));
      if(candidates.length===1)select=candidates[0];
    }
    if(select){
      const option=[...select.options].find(o=>o.value==='100'||txt(o)==='100');
      if(select.value===option.value)return t;
      publish(j,{message:'Mengubah jumlah baris tabel menjadi 100…'});
      const updated=await response(j,()=>{
        select.scrollIntoView?.({block:'center'});
        const win=select.ownerDocument?.defaultView||window;
        const setter=Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype,'value').set;
        setter.call(select,option.value);select.dispatchEvent(new win.Event('change',{bubbles:true}));
      });
      const replacement=select.isConnected?select:all('select',updated.closest('.dataTables_wrapper,.dt-container,.datatable,.kt-datatable')||document).find(el=>el.name===select.name);
      if(!replacement||replacement.value!==option.value)throw Error('Pilihan 100 baris belum tersimpan.');
      return updated;
    }
    // Custom pager dropdowns: restrict to the table pager, never the region selector.
    const pager=wrapper?.querySelector('.datatable-pager,.kt-datatable__pager,.dataTables_length,.dt-length');
    const trigger=pager&&all('button,[role="combobox"]',pager).find(el=>visible(el)&&/^(10|25|50|100)$/.test(txt(el)));
    if(!trigger)throw Error('Pilihan 100 baris belum dikenali pada tabel ini.');
    if(txt(trigger)==='100')return t;
    trigger.scrollIntoView?.({block:'center'});trigger.click();await sleep(350);check(j);
    const options=all('[role="option"],.dropdown-menu a,.dropdown-menu button,.dropdown-menu li').filter(el=>visible(el)&&txt(el)==='100');
    const leaves=options.filter(el=>!options.some(other=>other!==el&&el.contains(other)));
    if(leaves.length!==1)throw Error('Opsi 100 pada dropdown belum ditemukan secara unik.');
    return response(j,()=>leaves[0].click());
  }
  async function collect(j,t) {
    let rows=[],partial=false,warning='',invalid=0,transactionCount=0,balanceIncomplete=false,balanceCount=0;const seen=new Set(),balances=new Map();
    try{t=await setHundredRows(j,t);}catch(e){check(j);partial=true;warning='100 baris belum terverifikasi: '+e.message;publish(j,{message:warning});t=table()||t;}
    for(let pageIndex=0;pageIndex<30;pageIndex++){
      check(j);
      try {
        const batch=readRows(t,j),signature=JSON.stringify(batch);
        if(seen.has(signature)){partial=true;warning='Halaman tabel berulang.';break;}seen.add(signature);
        transactionCount+=batch.length;
        for(const row of batch){const raw=rowBalance(row),amount=money(raw);if(amount===null)continue;balanceCount++;const prev=balances.get(amount);if(!prev&&balances.size>=3000){balanceIncomplete=true;continue;}if(!prev||!Number.isFinite(rowTime(prev,j.offset))||rowTime(row,j.offset)>rowTime(prev,j.offset))balances.set(amount,row);}
        invalid+=batch.filter(row=>!Number.isFinite(rowTime(row,j.offset))).length;
        rows=sortRows([...rows,...batch],j.offset).slice(0,3);
        const next=nextButton();if(!next)break;
        if(pageIndex===29){partial=true;warning='Batas 30 halaman tercapai.';break;}
        t=await response(j,()=>next.click());
      }catch(e){check(j);if(!rows.length)throw e;partial=true;warning=e.message;break;}
    }
    return {rows,partial,warning,invalid,transactionCount,balanceCount,balanceIncomplete,balanceIndex:[...balances].map(([amount,row])=>({amount,row})),scope:'latest3'};
  }
  function nativeServer() {
    if(mapped('server')?.tagName==='SELECT')return mapped('server');
    return all('select').find(e=>all('option',e).some(o=>/^REGION\s/i.test(txt(o))));
  }
  function customServer() {
    if(mapped('server')&&mapped('server').tagName!=='SELECT')return mapped('server');
    return all('[role="combobox"],.select2-selection,.ant-select-selector,.el-select').filter(visible)
      .find(e=>/select server|region\s/i.test(txt(e)||e.getAttribute('aria-label'))) || exact('Select Server');
  }
  async function regions(j) {
    const s=nativeServer();
    if(s) return all('option',s).filter(o=>!o.disabled && /^REGION\s/i.test(txt(o))).map(o=>({label:txt(o),value:o.value,native:true}));
    const c=customServer(); if(!c) throw Error('Dropdown Select Server belum dikenali.');
    c.click();await sleep(450);check(j);
    const opts=all('[role="option"],.select2-results__option,.ant-select-item-option,.el-select-dropdown__item').filter(visible).filter(e=>/^REGION\s/i.test(txt(e)));
    const items=[...new Set(opts.map(txt))].map(label=>({label,native:false}));
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    if(!items.length) throw Error('Opsi region belum terbaca. Kirim tampilan lengkap dropdown REGC untuk penyesuaian.');
    return items;
  }
  async function selectRegion(j,r) {
    if(r.native) {
      const el=nativeServer(); if(!el) throw Error('Dropdown server hilang.');
      el.value=r.value; el.dispatchEvent(new Event('change',{bubbles:true}));
      if(el.value!==r.value) throw Error('Pilihan region tidak tersimpan.');
    } else {
      const el=customServer(); if(!el) throw Error('Dropdown server hilang.');
      el.click();await sleep(350);check(j);
      const opt=all('[role="option"],.select2-results__option,.ant-select-item-option,.el-select-dropdown__item').filter(visible).find(e=>txt(e)===r.label);
      if(!opt) throw Error(`Opsi ${r.label} tidak terlihat.`); opt.click();
    }
    await sleep(850); await until(()=>!loading(),j,20000);
    if(loading()) throw Error('Region masih memuat data.');
  }
  function selectedLabel() {
    const s=nativeServer(); return s ? txt(s.selectedOptions[0]) : txt(customServer());
  }

  const EXPECTED=['REGION 1C','REGION 1D','REGION 2A','REGION C','REGION G','REGION H','REGION MASTER','REGION S','REGION Y'];
  const REPORTS=[
    {menu:'Reporting',title:'Transaction Regions',aliases:['Transaction Region']},
    {menu:'Reporting MPS',title:'Daily Transaction MPs',aliases:['Daily Transaction MPS']},
    {menu:'Reporting SportGG/IBL',title:'Daily Transaction SportGG',aliases:[]},
    {menu:'Reporting Net22',title:'Daily Transaction Net22',aliases:[]}
  ];
  const SOURCES=[...EXPECTED,...REPORTS.slice(1).map(r=>r.title)];
  const key=s=>norm(s).replace(/[^a-z0-9]/g,'');
  function field(row,names) {return row.find(c=>names.includes(key(c.label)))?.value || '';}
  function timestamp(raw,offset=420) {
    const text=String(raw||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();
    const numeric12=text.match(/^(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})\s*(?:[-–—,]\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if(numeric12){const h=Number(numeric12[2]);if(h<1||h>12)return NaN;return timestamp(numeric12[1]+' '+String(h%12+(numeric12[5].toUpperCase()==='PM'?12:0)).padStart(2,'0')+':'+numeric12[3]+':'+(numeric12[4]||'00'),offset);}
    // REGC example: 12 Nov 2026 - 23:59:55. Do not rely on locale-dependent Date.parse.
    const named=text.match(/^(\d{1,2})[\s-]+([a-z]+)\.?[\s,-]+(\d{4})\s*(?:[-–—,]\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?\s*(AM|PM)?$/i);
    if(named) {
      const months={jan:1,january:1,januari:1,feb:2,february:2,februari:2,mar:3,march:3,maret:3,apr:4,april:4,may:5,mei:5,jun:6,june:6,juni:6,jul:7,july:7,juli:7,aug:8,august:8,agu:8,ags:8,agustus:8,sep:9,sept:9,september:9,oct:10,october:10,okt:10,oktober:10,nov:11,november:11,dec:12,december:12,des:12,desember:12};
      const month=months[named[2].toLowerCase()];if(!month)return NaN;
      let hour=Number(named[4]);
      if(named[8]){if(hour<1||hour>12)return NaN;hour=hour%12+(named[8].toUpperCase()==='PM'?12:0);}
      const iso=`${named[3]}-${String(month).padStart(2,'0')}-${named[1].padStart(2,'0')} ${String(hour).padStart(2,'0')}:${named[5]}:${named[6]||'00'}${named[7]?'.'+named[7]:''}`;
      return timestamp(iso,offset);
    }
    if(/^\d{10}$/.test(text)) return Number(text)*1000;
    if(/^\d{13}$/.test(text)) return Number(text);
    // Explicit offsets always take precedence over the selected report timezone.
    if(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
      return Date.parse(text.replace(' ','T'));
    }
    const m=text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
    const d=text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/);
    if(!m&&!d) return NaN;
    const a=m||d,y=Number(m?a[1]:a[3]),mo=Number(a[2]),day=Number(m?a[3]:a[1]);
    const h=Number(a[4]),mi=Number(a[5]),sec=Number(a[6]||0),ms=Number((a[7]||'').padEnd(3,'0'));
    const utc=Date.UTC(y,mo-1,day,h,mi,sec,ms), date=new Date(utc);
    if(date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==day||h>23||mi>59||sec>59) return NaN;
    return utc-Number(offset)*60000;
  }
  function money(raw){
    let value=String(raw??'').trim();if(!value)return null;
    if(/[a-z]/i.test(value.replace(/\bIDR\b|\bRp\.?/gi,'')))return null;
    value=value.replace(/\bIDR\b|\bRp\.?/gi,'').replace(/\s+/g,'');
    if(!/^-?\d[\d.,]*$/.test(value))return null;
    const sign=value.startsWith('-')?-1n:1n;value=value.replace(/^-/,'');
    const dot=value.lastIndexOf('.'),comma=value.lastIndexOf(',');let whole=value,fraction='';
    if(dot>=0&&comma>=0){const sep=dot>comma?'.':',';const parts=value.split(sep);if(parts.length!==2||!/^\d{1,2}$/.test(parts[1]))return null;whole=parts[0];fraction=parts[1];const group=sep==='.'?',':'.';if(!new RegExp('^\\d{1,3}(\\'+group+'\\d{3})+$').test(whole))return null;whole=whole.split(group).join('');}
    else if(dot>=0||comma>=0){const sep=dot>=0?'.':',',parts=value.split(sep);if(parts.length===2&&/^\d{1,2}$/.test(parts[1])){whole=parts[0];fraction=parts[1];}else{if(!/^\d{1,3}$/.test(parts[0])||parts.slice(1).some(x=>!/^\d{3}$/.test(x)))return null;whole=parts.join('');}}
    if(!/^\d+$/.test(whole))return null;
    return ((BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0')||'0'))*sign).toString();
  }
  function rowBalance(row){
    const raw=field(row,['balance','saldo','currentbalance','endingbalance']);
    const clean=value=>String(value||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/^\s*(?:balance|saldo)\s*:?\s*/i,'').trim();
    if(money(clean(raw))!==null)return clean(raw);
    const amount=field(row,['amount']);
    const match=String(amount).match(/\bBalance\s*:\s*([^\r\n]*)/i);
    return match?clean(match[1]):'';
  }
  function balanceMatches(result,admin,offset=420){
    if(!admin||admin.id!==result.id||norm(admin.user)!==norm(result.user)||admin.state!=='ready')return [];
    const amount=money(admin.raw);if(amount===null)return [];
    const found=[];
    const matches=row=>norm(primaryValue(field(row,['user','userid','nickname','username','player','playername','playerid','account']),'User'))===norm(result.user)&&money(rowBalance(row))===amount;
    for(const source of result.regions||[]){
      if(source.error||!SOURCES.includes(source.label))continue;
      // balanceIndex retains balances from all fetched rows, even those outside the top-three display.
      const candidates=[...(source.balanceIndex||[]).map(x=>x.row),...(source.rows||[])].filter(row=>row&&matches(row));
      if(!candidates.length)continue;
      candidates.sort((a,b)=>(Number.isFinite(rowTime(b,offset))?rowTime(b,offset):-Infinity)-(Number.isFinite(rowTime(a,offset))?rowTime(a,offset):-Infinity));
      found.push({label:source.label,row:candidates[0],amount,partial:!!(source.partial||source.balanceIncomplete),checked:source.balanceCount??null});
    }
    return found.sort((a,b)=>(Number.isFinite(rowTime(b.row,offset))?rowTime(b.row,offset):-Infinity)-(Number.isFinite(rowTime(a.row,offset))?rowTime(a.row,offset):-Infinity));
  }
  function adminRow(user,includeElement=false){
    const matches=[];const seenRows=new Set();
    const directCells=tr=>[...tr.children].filter(el=>['TD','TH'].includes(el.tagName));
    for(const t of all('table').filter(visible)){
      // Older admin tables often put their header in TD cells inside TBODY.
      const trs=all('tr',t).filter(tr=>visible(tr)&&tr.closest('table')===t);
      let header=null,u=-1,b=-1;
      for(const tr of trs){
        const hs=directCells(tr).map(el=>key(txt(el)));
        const userIndex=hs.findIndex(h=>h==='userid'),bankIndex=hs.findIndex(h=>h==='bank');
        if(userIndex>=0&&bankIndex>=0&&hs[bankIndex+1]==='balance'){
          header=tr;u=userIndex;b=bankIndex+1;break;
        }
      }
      if(!header)continue;
      for(const tr of trs){
        if(tr===header||seenRows.has(tr))continue;
        const cells=directCells(tr);if(cells.length<=Math.max(u,b))continue;
        if(cells.some(el=>/^(subtotal|total)$/.test(key(txt(el)))))continue;
        if(norm(primaryValue(txt(cells[u]),'UserId'))!==norm(user))continue;
        // Reject colspan summary cells rather than shifting the Balance column.
        if(cells.slice(0,b+1).some(el=>(Number(el.getAttribute('colspan'))||1)>1))continue;
        const raw=primaryValue(txt(cells[b]),'Balance');
        if(money(raw)!==null){matches.push({user:norm(user),raw,...(includeElement?{element:tr}:{})});seenRows.add(tr);}
      }
    }
    if(matches.length>1)throw Error('Ada beberapa baris UserId yang sama. Saldo belum dipilih otomatis.');
    return matches[0]||null;
  }
  function historyURL(value){
    try{const url=new URL(value,location.href);return url.origin===location.origin&&url.pathname.endsWith('/editcoinhis.php')&&['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}
  }
  function historyLinks(root){
    const found=new Set();
    for(const el of all('a,button,input,option,[onclick]',root)){
      for(const attr of ['href','value','data-url','onclick']){
        const value=el.getAttribute(attr)||'';
        if(!value.includes('editcoinhis.php'))continue;
        const direct=historyURL(value);if(direct)found.add(direct);
        for(const match of value.matchAll(/["']([^"']*editcoinhis\.php[^"']*)["']/g)){const url=historyURL(match[1]);if(url)found.add(url);}
      }
    }return [...found];
  }
  function parseBankHistory(doc,user,offset){
    const titles=all('h1,h2,h3,h4,caption,th,td,b,strong',doc).map(txt).map(t=>t.match(/^History\s+(?:Coin|Bank)\s*:?\s*([\w.-]+)\s*$/i)).filter(Boolean);
    if(!titles.some(m=>norm(m[1])===norm(user)))throw Error('Identitas pada History Coin/Bank tidak cocok atau belum terbaca.');
    const cells=tr=>[...tr.children].filter(el=>['TD','TH'].includes(el.tagName));
    for(const table of all('table',doc)){
      const trs=all('tr',table).filter(tr=>tr.closest('table')===table);
      let indexes=null,headerIndex=-1;
      for(let i=0;i<trs.length;i++){
        const keys=cells(trs[i]).map(el=>key(txt(el)));
        const ix={date:keys.indexOf('date'),info:keys.indexOf('info'),coin:keys.indexOf('coin'),last:keys.indexOf('lastcoin'),no:keys.indexOf('no')};
        if(ix.date>=0&&ix.info>=0&&ix.coin>=0&&ix.last>=0){indexes=ix;headerIndex=i;break;}
      }
      if(!indexes)continue;
      const records=[];let invalid=0;
      for(const tr of trs.slice(headerIndex+1)){
        const row=cells(tr).map(txt);if(row.length<=Math.max(indexes.date,indexes.info,indexes.coin))continue;
        // The blue "Last" summary row has no date; it is never treated as a transaction.
        if(!row[indexes.date]&&!row[indexes.info])continue;
        if(!row[indexes.date]||!row[indexes.info]){invalid++;continue;}
        const date=row[indexes.date],time=timestamp(date,offset),raw=row[indexes.coin],amount=money(raw);
        if(!Number.isFinite(time)||amount===null){invalid++;continue;}
        records.push({date,time,type:row[indexes.info].replace(/\s+/g,' ').trim(),raw,amount,lastCoin:row[indexes.last],lastAmount:money(row[indexes.last]),no:indexes.no>=0?row[indexes.no]:''});
      }
      const newestFirst=records.every((x,i)=>!i||records[i-1].time>=x.time);
      records.sort((a,b)=>b.time-a.time);
      return {state:'ready',records,invalid,newestFirst,readAt:Date.now()};
    }
    throw Error('Kolom Date / Info / Coin / Last Coin pada History Bank belum dikenali.');
  }
  function historyBankButton(row){
    const buttons=all('button,input[type="button"],input[type="submit"],a,[role="button"]',row).filter(el=>/^(history bank|history coin)$/i.test((txt(el)||el.value||'').replace(/\s+/g,' ').trim()));
    if(buttons.length>1)throw Error('Ada beberapa tombol History Bank pada baris member.');
    return buttons[0]||null;
  }
  async function readHistoryPopup(button,j,options={}){
    const allowed=options.allowed||historyURL,parse=options.parse||parseBankHistory;
    const page=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
    const frame=document.createElement('iframe');frame.name='jejak_history_'+j.id.replace(/[^a-z0-9]/gi,'')+'_'+Date.now();
    frame.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;border:0';frame.src='about:blank';document.body.append(frame);
    const originalOpen=page.open,proto=page.HTMLFormElement?.prototype,originalSubmit=proto?.submit;
    let captured=false,problem=null;
    const routeForm=form=>{
      const action=new URL(form.action||location.href,location.href).href;
      if(!allowed(action))throw Error('Tombol History Bank mengarah ke form selain editcoinhis.php.');
      if(!originalSubmit)throw Error('Form History Bank tidak dapat dibaca pada browser ini.');
      const target=form.target;captured=true;
      try{form.target=frame.name;originalSubmit.call(form);}finally{form.target=target;}
    };
    const open=function(url){
      const value=String(url||'');
      if(value&&value!=='about:blank'&&!allowed(value))throw Error('Alamat History Bank belum dikenali.');
      captured=true;if(value&&value!=='about:blank')frame.src=new URL(value,location.href).href;
      return frame.contentWindow;
    };
    const submit=function(){return routeForm(this);};
    const onSubmit=event=>{event.preventDefault();try{routeForm(event.target);}catch(e){problem=e;}};
    const href=button.tagName==='A'?allowed(button.getAttribute('href')):null;
    const onLink=event=>{if(href){event.preventDefault();captured=true;frame.src=href;}};
    try{
      // Preserve the button's real member fields, POST method and CSRF fields; no guessed member URL.
      page.open=open;if(page.open!==open)throw Error('Pembukaan History Bank tidak dapat dipantau.');
      if(proto&&originalSubmit)proto.submit=submit;
      document.addEventListener('submit',onSubmit,true);if(href)button.addEventListener('click',onLink);
      try{button.click();}finally{
        if(page.open===open)page.open=originalOpen;
        if(proto?.submit===submit)proto.submit=originalSubmit;
        document.removeEventListener('submit',onSubmit,true);if(href)button.removeEventListener('click',onLink);
      }
      if(problem)throw problem;
      if(!captured)throw Error('Aksi tombol History Bank belum tertangkap. Kirim Copy outerHTML tombol History Bank agar mekanismenya dapat disesuaikan.');
      const started=Date.now();let lastError='Menunggu tabel History Coin untuk '+j.user;
      while(Date.now()-started<20000){
        check(j);
        try{
          const doc=frame.contentDocument,url=frame.contentWindow.location.href;
          if(doc?.readyState==='complete'&&allowed(url))return parse(doc,j.user,j.offset);
        }catch(e){lastError=e.message;}
        await sleep(300);
      }
      throw Error('History Bank belum terbaca: '+lastError);
    }finally{
      if(page.open===open)page.open=originalOpen;if(proto?.submit===submit)proto.submit=originalSubmit;
      document.removeEventListener('submit',onSubmit,true);if(href)button.removeEventListener('click',onLink);frame.remove();
    }
  }
  async function readBankHistory(j,raw,readAt,put){
    put({state:'ready',raw,readAt,history:{state:'loading',message:'Memeriksa Tools → History Bank…'}});
    try{
      const row=adminRow(j.user,true);if(!row?.element)throw Error('Baris member tidak tersedia untuk membuka Tools.');
      const button=historyBankButton(row.element);
      // Always execute the member's History Bank button; its handler may set hidden member fields before opening.
      if(button){const history=await readHistoryPopup(button,j);put({state:'ready',raw,readAt,history});return;}
      const links=historyLinks(row.element);
      if(links.length!==1)throw Error('Tombol/tautan History Bank tidak ditemukan secara unik pada baris UserId.');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
      let response,html;try{response=await fetch(links[0],{credentials:'same-origin',signal:controller.signal,cache:'no-store'});html=await response.text();}finally{clearTimeout(timer);}
      if(!response.ok)throw Error('History Bank gagal dimuat (HTTP '+response.status+').');
      if(new URL(response.url).origin!==location.origin)throw Error('History Bank dialihkan ke alamat lain.');
      const doc=new DOMParser().parseFromString(html,'text/html');check(j);
      const history=parseBankHistory(doc,j.user,j.offset);
      put({state:'ready',raw,readAt,history});
    }catch(e){put({state:'ready',raw,readAt,history:{state:'error',message:e.name==='AbortError'?'History Bank melewati batas tunggu 20 detik.':e.message}});}
  }
  function amountText(cents){
    const n=BigInt(cents),negative=n<0n,v=negative?-n:n;
    return (negative?'-':'')+(v/100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(v%100n?','+(v%100n).toString().padStart(2,'0'):'');
  }
  function reconcileBank(result,admin,offset=420){
    if(!result.done)return {state:'waiting',message:'Menunggu waktu transaksi terakhir.'};
    if(!admin||admin.id!==result.id||norm(admin.user)!==norm(result.user)||admin.state!=='ready')return {state:'waiting',message:'Saldo admin belum tersedia.'};
    const source=winningRegion(result,offset),row=source?.rows?.[0];
    if(!row)return {state:'waiting',message:'Transaksi terakhir belum ditemukan.'};
    const playTime=rowTime(row,offset),regc=money(rowBalance(row)),current=money(admin.raw);
    if(regc===null||current===null)return {state:'waiting',message:'Balance transaksi terakhir atau saldo admin belum terbaca.'};
    const history=admin.history;
    if(!history||history.state!=='ready')return {state:'waiting',message:history?.message||'Riwayat deposit belum tersedia.'};
    if(playTime>admin.readAt)return {state:'uncertain',message:'Transaksi REGC lebih baru daripada pembacaan saldo admin. Ulang cek saldo.'};
    // Reparse Date in the same selected timezone as REGC; never mix cached UTC values with a changed timezone.
    const records=(history.records||[]).map(x=>({...x,time:timestamp(x.date,offset),type:String(x.type||'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim(),amount:money(x.raw)}));
    const unreadable=records.filter(x=>!Number.isFinite(x.time)||x.amount===null);
    const validRecords=records.filter(x=>Number.isFinite(x.time)&&x.amount!==null);
    const excluded=validRecords.filter(x=>x.time<=playTime||x.time>admin.readAt).map(x=>({...x,reason:x.time===playTime?'Detik sama dengan permainan; urutan belum pasti':x.time<playTime?'Sebelum permainan terakhir':'Setelah waktu pembacaan saldo admin; ulang cek saldo'}));
    const after=validRecords.filter(x=>x.time>playTime&&x.time<=admin.readAt).sort((a,b)=>a.time-b.time);
    const evidence=after.map(x=>{
      const last=money(x.lastCoin),coin=money(x.raw),type=norm(x.type);
      const before=last===null||coin===null?null:type==='deposit'?(BigInt(last)-BigInt(coin)).toString():type==='withdraw'?(BigInt(last)+BigInt(coin)).toString():null;
      return {...x,lastAmount:last,before};
    });
    const deposits=after.filter(x=>/^deposit$/i.test(x.type));
    const withdrawals=after.filter(x=>/^withdraw$/i.test(x.type));
    const others=after.filter(x=>!/^(deposit|withdraw)$/i.test(x.type));
    const sum=deposits.reduce((total,x)=>total+BigInt(x.amount),0n),withdrawSum=withdrawals.reduce((total,x)=>total+BigInt(x.amount),0n),adjusted=BigInt(current)-sum+withdrawSum;
    const warnings=[];
    if(history.invalid||unreadable.length)warnings.push('Ada Date / Coin riwayat yang tidak terbaca; pengurangan belum lengkap.');
    if(excluded.some(x=>x.time>admin.readAt))warnings.push('Ada mutasi sesudah saldo admin dibaca. Tekan Cek saldo admin untuk memperbarui perbandingan.');
    // Rows are sorted by parsed Date rather than trusting visual order.
    if(evidence.some(x=>x.lastAmount===null))warnings.push('Ada Last Coin yang tidak terbaca.');
    if(evidence.some((x,i)=>i&&x.time===evidence[i-1].time))warnings.push('Ada beberapa mutasi pada detik yang sama; urutannya belum pasti.');
    const anchor=evidence[0],latest=evidence[evidence.length-1];
    if(anchor?.before!==null&&anchor?.before!==undefined&&anchor.before!==regc)warnings.push('Saldo sebelum mutasi pertama (Last Coin dikoreksi Coin) berbeda dari Balance REGC terakhir.');
    if(latest?.lastAmount!==null&&latest?.lastAmount!==undefined&&latest.lastAmount!==current)warnings.push('Last Coin mutasi terbaru berbeda dari saldo admin saat dibaca.');
    if(evidence.some((x,i)=>i&&x.before!==null&&evidence[i-1].lastAmount!==null&&x.before!==evidence[i-1].lastAmount))warnings.push('Rangkaian Coin dan Last Coin tidak tersambung; mungkin ada mutasi lain di antaranya.');
    if(!records.some(x=>x.time<=playTime))warnings.push('Riwayat yang terbaca belum mencapai waktu permainan.');
    if(records.some(x=>x.time===playTime))warnings.push('Ada mutasi pada detik yang sama dengan transaksi permainan; urutannya belum pasti.');
    if(others.length)warnings.push('Ada jenis mutasi selain Deposit/Withdraw setelah bermain yang belum dapat dihitung.');
    if([...deposits,...withdrawals].some(x=>BigInt(x.amount)<0n))warnings.push('Ada nominal mutasi negatif; arah mutasi perlu diperiksa.');
    if(adjusted<0n)warnings.push('Hasil pengurangan negatif.');
    if(!SOURCES.every(label=>result.regions.some(x=>x.label===label&&!x.error&&!x.partial&&!x.invalid)))warnings.push('Pencarian transaksi belum lengkap pada semua sumber.');
    return {state:warnings.length?'uncertain':'calculated',source:source.label,playTime,playDate:field(row,['timestamp','datetime','time','date']),current,regc,sum:sum.toString(),withdrawSum:withdrawSum.toString(),adjusted:adjusted.toString(),equal:adjusted===BigInt(regc),evidence,excluded,unreadable,anchorMatches:anchor?.before===regc,deposits,withdrawals,others,warnings};
  }
  function adminControls(){
    const boxes=all('input[type="checkbox"]').filter(visible);
    const named=boxes.filter(el=>/user.?id/i.test([el.name,el.id,el.getAttribute('aria-label')].join(' ')));
    const labelled=boxes.filter(el=>{
      const label=el.labels?.length?[...el.labels].map(txt).join(' '):txt(el.closest('label'));
      if(/\buser\s*id\b/i.test(label))return true;
      const parent=el.parentElement;
      return parent&&all('input[type="checkbox"]',parent).length===1&&/\buser\s*id\b/i.test(txt(parent));
    });
    const candidates=named.length?named:labelled;
    if(candidates.length>1)throw Error('Lebih dari satu checkbox UserId ditemukan.');
    const checkbox=candidates[0]||null;
    if(checkbox&&!checkbox.checked){checkbox.click();if(!checkbox.checked)throw Error('Checkbox UserId belum berhasil dicentang.');}
    const inputs=all('input').filter(el=>visible(el)&&['text','search',''].includes(el.type)&&!el.disabled);
    let input=inputs.find(el=>/user.?id|user.?name/i.test([el.name,el.id,el.placeholder,el.getAttribute('aria-label')].join(' ')));
    if(!input&&checkbox){
      for(let container=checkbox.parentElement,depth=0;container&&depth<4;container=container.parentElement,depth++){
        const nearby=inputs.filter(el=>container.contains(el));if(nearby.length===1){input=nearby[0];break;}if(nearby.length>1)break;
      }
    }
    if(!input&&inputs.length===1)input=inputs[0];
    return {checkbox,input};
  }
  async function readAdmin(j){
    const requestId=GM_getValue(ADMIN,null)?.requestId||j.id;
    const put=patch=>{if(live()?.id===j.id)GM_setValue(ADMIN,{id:j.id,user:j.user,requestId,updated:Date.now(),...patch});};
    const stateKey=PREFIX+'admin-submit:'+j.id+':'+requestId;
    try{
      check(j);put({state:'loading',message:'Mencari UserId di admin…'});
      if(all('input[type="password"]').some(visible))throw Error('Login admin dahulu, lalu tekan Cek saldo admin.');
      const sent=sessionStorage.getItem(stateKey);
      if(!sent){
        const {input}=adminControls();
        if(!input)throw Error('Kolom UserId admin belum dikenali. Perlu screenshot form pencarian dan header saldo.');
        const form=input.form;
        if(form){const url=new URL(form.action||location.href,location.href);if(url.origin!==location.origin||!url.pathname.endsWith('/agentplayerlist.php'))throw Error('Form ini bukan pencarian daftar pemain.');}
        const button=(form?all('button,input[type="submit"],input[type="button"]',form):[]).find(el=>visible(el)&&/^(search|cari|submit|cari pemain)$/i.test(txt(el)||el.value||''));
        inputValue(input,j.user);
        const before=all('table').filter(visible).map(txt).join('\n');let changed=false;
        const observer=new MutationObserver(records=>{if(records.some(r=>r.target.closest?.('table')||[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('table')||n.querySelector('table')))))changed=true;});
        observer.observe(document.body,{subtree:true,childList:true,characterData:true});
        sessionStorage.setItem(stateKey,String(Date.now()));
        try{
          enter(input);
          await sleep(650);check(j);
          if(!changed&&all('table').filter(visible).map(txt).join('\n')===before){if(button)button.click();else if(form)form.requestSubmit();}
          const start=Date.now();let row=null;
          while(Date.now()-start<25000){check(j);if((changed||all('table').filter(visible).map(txt).join('\n')!==before)&&Date.now()-start>1000){row=adminRow(j.user);if(row)break;}await sleep(300);}
          if(!row)throw Error('Hasil saldo belum terverifikasi. Periksa pencarian UserId di tab admin.');
          await readBankHistory(j,row.raw,Date.now(),put);
        }finally{observer.disconnect();}
      }else{
        const row=await until(()=>adminRow(j.user),j,20000);
        if(!row)throw Error('UserId atau kolom Saldo/Balance tidak ditemukan setelah pencarian.');
        await readBankHistory(j,row.raw,Date.now(),put);
      }
    }catch(e){put({state:'error',message:e.message});}
  }
  function rowTime(row,offset=420){return timestamp(field(row,['timestamp','transactiontimestamp','datetime','transactiontime','transactiondate','time','date','waktu','tanggal']),offset);}
  function sortRows(rows,offset=420){return rows.map((row,i)=>({row,i,time:rowTime(row,offset)})).sort((a,b)=>{
    const x=Number.isFinite(a.time)?a.time:-Infinity,y=Number.isFinite(b.time)?b.time:-Infinity;
    return x===y?a.i-b.i:y-x;
  }).map(x=>x.row);}
  function winningRegion(result,offset=420){
    const options=(result.regions||[]).filter(x=>!x.error&&x.rows?.length&&(SOURCES.includes(x.label)||result.manual));
    let best=null;
    for(const region of options){const rows=sortRows(region.rows,offset),time=rowTime(rows[0],offset);
      if(!Number.isFinite(time))continue;
      if(!best||time>best.time)best={...region,rows:rows.slice(0,3),time};
    }
    return best;
  }
  // Saldo awal REGC harus dikunci sebelum retry. Jangan jadikan hasil dari
  // semua baris historis sebagai pengganti transaksi yang TERAKHIR.
  function regcBalanceSnapshot(result,offset=420){
    const source=winningRegion(result,offset),row=source?.rows?.[0];
    if(!source||!row||!Number.isFinite(source.time))return null;
    const user=field(row,['user','userid','nickname','username','player','playername','playerid','account']);
    const balance=money(rowBalance(row));
    if(!user||norm(user)!==norm(result.user)||balance===null)return null;
    return {user:norm(user),label:source.label,time:source.time,
      date:field(row,['timestamp','transactiontimestamp','datetime','transactiontime','transactiondate','time','date','waktu','tanggal']),
      game:field(row,['game','gamename','permainan']),
      round:field(row,['roundid','round']),
      amount:field(row,['amount']),balance};
  }
  function compareRegcReread(anchor,refreshed,offset=420){
    if(!anchor||!refreshed||refreshed.label!==anchor.label)
      throw Error('Cek ulang tidak berasal dari sumber REGC yang pertama.');
    // Meski tabel hanya mengembalikan sebagian halaman, transaksi yang
    // awalnya dipilih masih boleh diverifikasi asalkan barisnya sama persis.
    // Jangan gagalkan cek ulang hanya karena opsi 100 baris situs tidak tersedia.
    if(refreshed.error)
      throw Error('Pembacaan ulang sumber REGC gagal: '+refreshed.error);
    const rows=refreshed.rows||[];
    const candidates=rows.filter(row=>{
      if(norm(field(row,['user','userid','nickname','username','player','playername','playerid','account']))!==anchor.user)return false;
      if(rowTime(row,offset)!==anchor.time)return false;
      if(anchor.round&&field(row,['roundid','round'])!==anchor.round)return false;
      if(anchor.game&&norm(field(row,['game','gamename','permainan']))!==norm(anchor.game))return false;
      if(anchor.amount&&money(field(row,['amount']))!==money(anchor.amount))return false;
      return true;
    });
    if(candidates.length!==1){
      const last=rows.length?rowTime(sortRows(rows,offset)[0],offset):NaN;
      if(Number.isFinite(last)&&last>anchor.time)
        throw Error('Ada transaksi REGC yang lebih baru daripada pembacaan pertama. Jalankan pencarian baru agar semua 12 sumber dibandingkan lagi.');
      throw Error('Transaksi awal REGC (User ID, jam, Round ID) tidak ditemukan secara unik pada pembacaan kedua. Saldo awal tetap disimpan; jangan lanjut history.');
    }
    const newBalance=money(rowBalance(candidates[0]));
    if(newBalance===null)throw Error('Balance pada pembacaan kedua REGC tidak terbaca.');
    if(newBalance!==anchor.balance)
      throw Error('Saldo transaksi REGC yang sama berubah dari Rp '+amountText(anchor.balance)+' menjadi Rp '+amountText(newBalance)+'. Ulang pencarian agar tidak memakai saldo yang salah.');
    return {label:anchor.label,user:anchor.user,time:anchor.time,date:anchor.date,
      balance:newBalance,confirmed:true};
  }

  function latest(r,now=Date.now(),offset=420) {
    let best=null,invalid=0,total=0;
    for(const region of r.regions||[]) {
      if(!SOURCES.includes(region.label)||region.error) continue;
      for(const row of region.rows||[]) {
        const user=field(row,['user','userid','username','nickname','player','playername','playerid','account']);
        if(norm(user)!==norm(r.user)) continue;
        total++;
        const raw=field(row,['timestamp','transactiontimestamp','datetime','transactiontime','transactiondate','time','date','waktu','tanggal']);
        const ms=timestamp(raw,offset);
        if(!Number.isFinite(ms)) {invalid++;continue;}
        if(r.startDate&&r.endDate){const start=timestamp(r.startDate+' 00:00:00',offset),end=timestamp(r.endDate+' 23:59:59.999',offset);if(ms<start||ms>end){invalid++;continue;}}
        const candidate={region:region.label,ms,distance:Math.abs(now-ms),fields:[
          ['Timestamp',raw],['Game',field(row,['game','gamename','permainan'])],
          ['Round ID',field(row,['roundid','round'])],['User',user],
          ['Type',field(row,['type','transactiontype'])],['Amount',field(row,['amount'])]
        ]};
        if(!best||candidate.ms>best.ms) best=candidate;
      }
    }
    const checked=SOURCES.filter(label=>(r.regions||[]).some(x=>x.label===label&&!x.error&&!x.partial)).length;
    return {best,invalid,total,checked,complete:!!r.done&&checked===12&&invalid===0};
  }

  function isPokerRow(row){
    return ['game','gamename','permainan','provider','gameprovider'].some(name=>/idnpoker/.test(key(field(row,[name]))));
  }
  function pokerTarget(result,offset=420){
    const source=winningRegion(result,offset),row=source?.rows?.[0];
    if(!row||!isPokerRow(row))return null;
    return {row,label:source.label,round:field(row,['roundid','round']),amount:field(row,['amount']),time:rowTime(row,offset)};
  }
  // Compare real times (not the row order or the name of a provider).
  // REGC and AGWL2 dates are both interpreted using the selected report timezone.
  function historyAfterRegc(result,offset=420){
    const proof=result?.historyTransDetail?.proof;
    if(proof?.state==='matched')return !!proof.latestGame;
    return false;
  }
  function lastEvidence(result,offset=420){
    const source=winningRegion(result,offset),history=result?.historyTransDetail?.data;
    if(historyAfterRegc(result,offset)){
      const recent=result.historyTransDetail.proof.latestGame;
      return {type:'history',label:recent.game||recent.keterangan,date:recent.date,time:recent.time};
    }
    if(source)return {type:'regc',label:field(source.rows?.[0]||[],['game','gamename','permainan'])||source.label,
      report:source.label,date:field(source.rows?.[0]||[],['timestamp','datetime','time','date']),time:source.time};
    return null;
  }
  // STRICT PROOF GATE. All images and member replies must wait for this decision.
  // Historical balances are NOT accepted as proof that the most recent balance matches.
  function latestBalanceVerified(result,admin,offset=420){
    if(!result?.done||!admin||admin.id!==result.id||norm(admin.user)!==norm(result.user)||admin.state!=='ready')return false;
    const source=winningRegion(result,offset),row=source?.rows?.[0];
    if(!row||!Number.isFinite(source.time))return false;
    const latest=money(rowBalance(row)),current=money(admin.raw);
    // A balance from an old REGC row or an unrelated bank-history correction
    // must NEVER skip the user's requested second REGC check + history_trans.
    return latest!==null&&current!==null&&latest===current;
  }

  // Transaction ledger after the latest REGC timestamp, not after the newest
  // history transaction. Money is stored as integer cents (string) to avoid
  // floating-point rounding. All rows strictly after REGC are counted once.
  function reconcileHistoryLedger(result,admin,offset=420,providedData=null){
    const fail=(state,message)=>({state,message});
    if(!result?.done||!admin||admin.id!==result.id||norm(admin.user)!==norm(result.user)||admin.state!=='ready')
      return fail('waiting','Menunggu saldo admin dan laporan REGC untuk User ID yang sama.');
    const src=winningRegion(result,offset),first=src?.rows?.[0];
    if(!first||!Number.isFinite(src.time))return fail('error','Waktu REGC terakhir tidak terbaca.');
    const initial=money(rowBalance(first)),actual=money(admin.raw);
    if(initial===null||actual===null)return fail('error','Saldo REGC terakhir atau saldo admin tidak dapat dibaca.');
    const data=providedData||result.historyTransDetail?.data;
    if(!data?.entries?.length)return fail('waiting','Menunggu baris Tanggal, Debet, Kredit, dan Saldo dari history_trans.');
    if(!Number.isFinite(admin.readAt))return fail('error','Waktu pembacaan saldo admin tidak tersedia; lakukan cek saldo admin ulang.');
    const evaluated=data.entries.map((e,i)=>({
      ...e, index:i,
      time:timestamp(e.date||e.tanggal||'',offset)
    }));
    if(evaluated.some(e=>!Number.isFinite(e.time)))return fail('error','Ada tanggal history_trans yang tidak dapat diurutkan.');
    if(evaluated.some(e=>e.time===src.time))return fail('error','Ada transaksi history_trans pada detik yang sama dengan REGC; urutannya belum pasti.');
    if(evaluated.some(e=>e.time>admin.readAt))
      return fail('error','Ada transaksi history_trans setelah saldo admin dibaca. Perbarui cek saldo admin sebelum menghitung.');
    const after=evaluated.filter(e=>e.time>src.time).sort((a,b)=>a.time-b.time||a.index-b.index);
    if(!after.length)return fail('error','Tidak ada mutasi sesudah waktu REGC yang bisa menjelaskan selisih saldo.');
    if((data.truncated||data.hasOlderPages)&&Math.min(...evaluated.map(e=>e.time))>src.time)
      return fail('error','Ada transaksi history_trans lebih lama yang belum dimuat, sedangkan waktu REGC lebih awal dari tabel saat ini. Hitungan belum lengkap.');
    if(after.some((e,i)=>i>0&&e.time===after[i-1].time))
      return fail('error','Beberapa mutasi history_trans memiliki jam dan detik sama. Urutan debit/kredit belum pasti.');

    let balance=BigInt(initial),debits=0n,credits=0n;
    const steps=[];
    for(const e of after){
      const debitRaw=String(e.debet??'').trim(),creditRaw=String(e.kredit??'').trim();
      const debit=money(debitRaw||'0'),credit=money(creditRaw||'0');
      if(debit===null||credit===null||BigInt(debit)<0n||BigInt(credit)<0n)
        return fail('error','Debet/Kredit history_trans tidak valid pada '+(e.date||e.tanggal)+'.');
      const debitValue=BigInt(debit),creditValue=BigInt(credit);
      if(debitValue===0n&&creditValue===0n)continue;
      // A row containing both is allowed only if both figures are explicitly
      // available; its net change is applied exactly once.
      balance=balance-debitValue+creditValue;
      debits+=debitValue;credits+=creditValue;
      const displayed=String(e.saldo??'').trim();
      const ledgerBalance=displayed?money(displayed):null;
      const step={date:e.date||e.tanggal,keterangan:e.keterangan||'',status:e.status||'',
        debet:debit,kredit:credit,expected:balance.toString(),saldo:ledgerBalance,
        time:e.time};
      steps.push(step);
      if(ledgerBalance!==null&&ledgerBalance!==balance.toString())
        return {...fail('error','Saldo pada baris history_trans '+step.date+' tidak sesuai dengan rangkaian Debet/Kredit sejak REGC ('+amountText(balance.toString())+' vs '+amountText(ledgerBalance)+').'),
          steps,regcBalance:initial,adminBalance:actual,debetTotal:debits.toString(),kreditTotal:credits.toString()};
    }
    if(!steps.length)return fail('error','Tidak ada Debet atau Kredit sesudah jam REGC yang bisa dihitung.');
    const expected=balance.toString(),matched=expected===actual;
    const lastGame=evaluated.filter(e=>e.time>src.time&&
      isHistoryBetRecord(e)).sort((a,b)=>b.time-a.time)[0]||null;
    const proof={state:matched?'matched':'mismatch',regcBalance:initial,adminBalance:actual,
      computedBalance:expected,debetTotal:debits.toString(),kreditTotal:credits.toString(),
      fromTime:src.time,fromDate:field(first,['timestamp','datetime','time','date']),steps,
      latestGame:lastGame?{date:lastGame.date||lastGame.tanggal,time:lastGame.time,
        keterangan:lastGame.keterangan,status:lastGame.status,debet:lastGame.debet,
        saldo:lastGame.saldo,game:lastGame.game||parseHistoryGame(lastGame.keterangan)}:null,
      message:matched?'Saldo cocok setelah semua Debet/Kredit sesudah jam REGC dihitung.':
        'Saldo hasil perhitungan '+amountText(expected)+' berbeda dari saldo admin '+amountText(actual)+'. Bukti ditahan.'};
    return proof;
  }

  function parseHistoryGame(ket){
    const value=String(ket||'').replace(/^\s*(?:beli|bet(?:ting)?|main(?:kan)?)\s+/i,'').trim();
    return value.match(/^([\w.-]+)/)?.[1]||value;
  }
  function isHistoryBetRecord(e){
    const combined=String((e.keterangan||'')+' '+(e.status||'')).toLowerCase();
    if(/deposit|bonus|withdraw|rolling|cashback|refund|rebate|komisi|pindah saldo|transfer/i.test(combined))return false;
    const debit=money(e.debet);
    return debit!==null&&BigInt(debit)>0n&&/\bbeli\b|\bbet(?:ting)?\b|\bmain\b|hokidraw|togel|poker|slot|casino|sport|draw|game|lotto|4d|3d|2d/i.test(combined);
  }

  function reconciliationDecision(result,admin,offset=420){
    const pending=message=>({state:'waiting',message});
    const error=message=>({state:'error',message});
    if(!result?.done)return pending('REGC sedang memeriksa semua region dan laporan. Gambar dan balasan belum dibuat.');
    const source=winningRegion(result,offset);
    if(!source||!Number.isFinite(source.time))return error('Waktu transaksi REGC terakhir tidak dapat diverifikasi. Bukti ditahan.');
    if(!admin||admin.id!==result.id||norm(admin.user)!==norm(result.user))return pending('Menunggu pemeriksaan saldo admin untuk User ID yang sama.');
    if(admin.state==='error')return error('Cek saldo admin gagal: '+(admin.message||'buka kembali halaman admin.'));
    if(admin.state!=='ready')return pending('Menunggu saldo admin selesai dibaca.');
    if(money(admin.raw)===null||money(rowBalance(source.rows[0]))===null)return error('Saldo admin atau Balance REGC terbaru tidak terbaca; gambar ditahan.');
    if(latestBalanceVerified(result,admin,offset))
      return {state:'ready',type:'regc',source,time:source.time,label:field(source.rows[0],['game','gamename','permainan'])||source.label,
        verified:'direct'};
    if(!result.balanceRetry)return pending('Saldo REGC dan admin berbeda; wajib cek ulang REGC sebelum mengambil gambar.');
    if(['queued','running'].includes(result.balanceRetry.state))return pending('Cek ulang saldo REGC sedang berjalan. Gambar dan balasan ditahan.');
    if(result.balanceRetry.state==='error')return error('Cek ulang REGC gagal: '+(result.balanceRetry.error||'Belum bisa memutuskan saldo.'));
    if(result.balanceRetry.state!=='done')return pending('Menunggu cek ulang REGC selesai.');
    if(result.balanceRetry.confirmed!==true||!result.balanceRetry.secondRead||
       result.balanceRetry.secondRead.balance!==result.balanceRetry.firstRead?.balance)
      return error('Pembacaan ulang saldo REGC awal belum terverifikasi. Gambar dan balasan ditahan.');
    if(result.balanceRetry.matched===true)
      return {state:'ready',type:'regc',source,time:source.time,label:field(source.rows[0],['game','gamename','permainan'])||source.label,
        verified:'retry'};
    const history=result.historyTransDetail;
    if(!history||['queued','running'].includes(history.state))
      return pending('Cek ulang masih berbeda: membaca User → Submit di history_trans, lalu menghitung semua Debet/Kredit setelah waktu REGC.');
    if(history.state==='error')return error('History transaksi gagal: '+history.error+'. Gambar dan balasan tidak dibuat.');
    if(history.state!=='ready'||!history.data)return pending('Menunggu history_trans yang lengkap.');
    const proof=reconcileHistoryLedger(result,admin,offset,history.data);
    if(proof.state==='waiting')return pending(proof.message);
    if(proof.state!=='matched')return error(proof.message);
    if(proof.latestGame){
      // A verified ledger is sufficient to render its REAL TABLE DATA into a
      // labeled PNG in this bubble. The admin tab screenshot is preferred,
      // but its failure must not silently disable the image button.
      const screenshot=GM_getValue(HISTORY_TRANS_IMAGE,null);
      const sourceImage=!!(screenshot?.id===result.id&&norm(screenshot.user)===norm(result.user)&&
        screenshot.dataURL?.startsWith('data:image/'));
      const canDrawTable=!!(history.data?.headers?.length&&history.data?.rows?.length&&
        history.data.headers.some(x=>key(x)==='tanggal')&&history.data.headers.some(x=>key(x)==='keterangan'));
      if(!sourceImage&&!canDrawTable)
        return error('Gambar history tidak dapat dibuat: screenshot tidak diterima dan data tabel belum lengkap. '+(history.captureError||''));
      return {state:'ready',type:'history',source:null,time:proof.latestGame.time,
        label:proof.latestGame.game||proof.latestGame.keterangan,proof,verified:'ledger',
        imageMode:sourceImage?'screenshot':'verified-table-image'};
    }
    return {state:'ready',type:'regc',source,time:source.time,
      label:field(source.rows[0],['game','gamename','permainan'])||source.label,proof,verified:'ledger'};
  }
  function deliveryDecision(result,admin,offset=420){
    const decision=reconciliationDecision(result,admin,offset);
    if(decision.state!=='ready'||decision.type!=='regc')return decision;
    if(!isPokerRow(decision.source.rows[0]))return decision;
    const detail=result.pokerDetail;
    if(!detail||['queued','running'].includes(detail.state))return {state:'waiting',message:'IDN Poker adalah transaksi terakhir. Menunggu screenshot tab Detail agar tepat dua gambar siap.'};
    if(detail.state==='error')return {state:'error',message:'Screenshot Detail IDN Poker gagal: '+detail.error+'. Tekan Ambil ulang detail sebelum membuat balasan.'};
    if(detail.state!=='ready'||!detail.data?.imageToken)return {state:'waiting',message:'Menunggu screenshot asli tab Detail IDN Poker.'};
    const captured=GM_getValue(POKER_IMAGE,null);
    if(captured?.id!==result.id||captured.token!==detail.data.imageToken||!captured.dataURL?.startsWith('data:image/'))
      return {state:'error',message:'Gambar kedua IDN Poker belum diterima dari tab Detail. Tekan Ambil ulang detail.'};
    return decision;
  }

  function pokerDetailUserVariants(user){
    const raw=String(user||'').trim();
    const compact=norm(raw);
    const variants=new Set([compact]);
    if(compact){
      variants.add('baae'+compact);
      variants.add('baae_'+compact);
      variants.add('baae-'+compact);
      variants.add('baae '+compact);
    }
    return variants;
  }
  function pokerDetailUserMatches(value,user){
    const clean=norm(String(value||'')).replace(/[^a-z0-9]/g,'');
    const base=norm(String(user||'')).replace(/[^a-z0-9]/g,'');
    if(!clean||!base)return false;
    if(clean===base)return true;
    return clean==='baae'+base;
  }
  function parsePokerDetail(doc,user,options={}){
    // Some REGC detail windows use "Transaction start" as a report heading,
    // not as an exact User ID field. Verify the table FIRST; then verify its
    // identity from an explicit User ID or the proven transaction click source.
    // Special REGC rule for IDN Poker Detail only: the displayed user may be
    // prefixed with "BAAE" (for example BAAEcontraa) and must still be
    // treated as the same member.
    const required=['no','id','date','game','table','periode','bet','hand','prize','status','amount','total'];
    const labels={periode:['periode','period'],no:['no','number'],id:['id'],date:['date','datetime'],game:['game'],table:['table'],bet:['bet'],hand:['hand'],prize:['prize'],status:['status'],amount:['amount'],total:['total']};
    const cells=tr=>[...tr.children].filter(x=>['TD','TH'].includes(x.tagName));
    let found=null;
    for(const t of all('table',doc)){
      const trs=all('tr',t).filter(tr=>tr.closest('table')===t);
      const hi=trs.findIndex(tr=>{
        const names=cells(tr).map(c=>key(txt(c)));
        return names.length===required.length&&required.every((name,i)=>labels[name].includes(names[i]));
      });
      if(hi<0)continue;
      const rows=[];let partial=false;
      for(const tr of trs.slice(hi+1)){
        const cs=cells(tr);if(!cs.length||!cs.some(c=>txt(c)))continue;
        if(/no\s+(?:data|records)|tidak\s+ada\s+data/i.test(txt(tr)))continue;
        if(tr.closest('tfoot'))break;
        if(rows.length>=160){partial=true;break;}
        const row=cs.map(c=>({text:txt(c),span:Math.max(1,Number(c.getAttribute('colspan'))||1),link:!!c.querySelector('a')}));
        if(row.reduce((n,c)=>n+c.span,0)!==required.length){partial=true;continue;}
        rows.push(row);
      }
      if(!rows.length)throw Error('Tabel detail IDN Poker sudah muncul, tetapi belum berisi transaksi yang dapat dibaca.');
      found={headers:cells(trs[hi]).map(txt),rows,partial};
      break;
    }
    if(!found)throw Error('Tabel Detail IDN Poker 12 kolom belum muncul (No, ID, Date, Game, Table, Periode, Bet, Hand, Prize, Status, Amount, Total).');

    const clean=x=>String(x||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
    const candidateNodes=all('h1,h2,h3,h4,h5,h6,caption,.page-title,.box-title,.card-title,.modal-title,.content-header,strong,b,span,label,div,p',doc)
      .filter(n=>!n.closest('table'));
    const samples=[];
    for(const el of candidateNodes){
      const v=clean(txt(el));
      if(v&&v.length<=240&&(/transaction\s+start/i.test(v)||/^(?:user\s*id|user\s*name|username|nickname|player\s*id|member)\s*[:：]/i.test(v)))samples.push(v);
      if(samples.length>300)break;
    }
    // On some sites the title is plain text inside the BODY, rather than a title element.
    const whole=clean(doc?.body?txt(doc.body):txt(doc));
    const rawTitle=samples.find(x=>/transaction\s+start/i.test(x)) ||
      (whole.match(/Transaction\s+start\s*[-–—:]\s*[^\n]{0,100}/i)?.[0]||'');
    const title=clean(rawTitle);
    const titleTail=title.match(/transaction\s+start\s*[-–—:]\s*([\w.\-]+)/i)?.[1]||'';
    // A recognized, explicitly labeled User ID overrides the report heading.
    const idSamples=[...new Set(samples.filter(x=>/^(?:user\s*id|user\s*name|username|nickname|player\s*id|member)\s*[:：]/i.test(x)))];
    for(const t of all('table',doc)){
      if(t.querySelector('thead')&&required.every(x=>key(txt(t.querySelector('thead'))).includes(x)))continue;
      for(const tr of all('tr',t)){
        const cs=cells(tr);if(cs.length===2&&/^(?:user\s*id|user\s*name|username|nickname|player\s*id|member)\s*[:：]?$/i.test(clean(txt(cs[0]))))
          idSamples.push(clean(txt(cs[0]))+': '+clean(txt(cs[1])));
      }
    }
    const explicitIds=idSamples.map(v=>v.match(/^(?:user\s*id|user\s*name|username|nickname|player\s*id|member)\s*[:：]\s*([\w.\-]+)/i)?.[1]).filter(Boolean);
    if(explicitIds.some(value=>!pokerDetailUserMatches(value,user)))
      throw Error('User ID yang tercantum pada halaman Detail berbeda dengan '+user+' (khusus IDN Poker Detail awalan BAAE tetap dianggap sama). Bukti tidak diambil agar tidak tertukar.');
    const byTitle=!!titleTail&&pokerDetailUserMatches(titleTail,user);
    const byField=explicitIds.some(value=>pokerDetailUserMatches(value,user));
    // Proven source means: the single "Detail" button was obtained from the
    // user/time-matched IDN Poker row, AND this particular window/modal was
    // launched or newly populated by that click (not a pre-existing dialog).
    const byClick=options.verifiedClick===true;
    if(!byTitle&&!byField&&!byClick)
      throw Error('Tabel poker ditemukan, tetapi asal transaksinya belum terverifikasi untuk User ID '+user+'.');
    const summary=all('div,p,span',doc).map(txt).map(clean).find(x=>/^Total\s+\d+\s+Report$/i.test(x))||'';
    const reported=Number(summary.match(/\d+/)?.[0]);
    const dataCount=found.rows.filter(row=>/^\d+$/.test(row[0]?.text)).length;
    if(reported>dataCount)found.partial=true;
    return {
      title:byTitle&&title?title:'Detail IDN Poker - '+user,
      originalTitle:title||'',
      verifiedBy:byField?'identitas pada detail':byTitle?'judul Transaction start':'tombol Detail pada transaksi yang dipilih',
      ...found,summary
    };
  }
  function samePokerRow(row,target,user,offset,pass=0){
    if(!isPokerRow(row))return false;
    if(norm(field(row,['user','userid','username','nickname','player','playername','playerid','account']))!==norm(user))return false;
    if(rowTime(row,offset)!==target.time)return false;
    const round=field(row,['roundid','round']);
    if(pass===0&&target.round&&round!==target.round)return false;
    if(pass===1&&target.amount){
      const expected=money(target.amount),actual=money(field(row,['amount']));
      if(expected!==null&&actual!==null&&expected!==actual)return false;
    }
    return true;
  }
  function pokerDetailsIn(root){
    if(!root)return [];
    // Include the root itself if it is the blue Detail button.
    const candidates=[root,...all('a,button,input[type="button"],input[type="submit"],[role="button"]',root)];
    return candidates.filter(el=>visible(el) && /^(?:view\s+|lihat\s+)?details?$/i.test(
      String(txt(el)||el.value||el.getAttribute?.('aria-label')||el.getAttribute?.('title')||'').trim().replace(/\s+/g,' ')
    )).filter(el=>['A','BUTTON','INPUT'].includes(el.tagName)||el.getAttribute('role')==='button');
  }
  function pokerExpandedRoots(tr,arrow){
    // Scope detail strictly to the member's matched transaction, NOT the whole report.
    const roots=[tr];
    for(let n=tr.nextElementSibling,i=0;n&&i<5;n=n.nextElementSibling,i++){
      const text=txt(n).trim();
      const explicitlyExpanded=!!n.matches('.child,.details,.shown,.details-row,.datatable-row-subtable,.kt-datatable__row--subtable')
        ||!!n.querySelector('td[colspan],.dtr-details,.details-row');
      const panelText=/^details?\b/i.test(text)||/\n\s*details?\s*(?:\n|$)/i.test(text);
      // A regular *other transaction* may itself have buttons: do not cross that boundary.
      const looksLikeDetail=explicitlyExpanded || (panelText&&!!n.querySelector('.card,.card-body,.details,button,a,[role="button"]'));
      if(!looksLikeDetail)break;
      roots.push(n);
    }
    for(const trigger of [arrow,...all('[aria-controls],[data-target],[data-bs-target],[href^="#"]',tr)]){
      if(!trigger)continue;
      for(const attr of ['aria-controls','data-target','data-bs-target','href']){
        const raw=trigger.getAttribute(attr)||'';
        if(!raw)continue;
        for(const id of (attr==='aria-controls'?raw.split(/\s+/):[raw.replace(/^#/, '')])){
          if(!id||/[\s:?#/]/.test(id))continue;
          const root=document.getElementById(id);
          if(root&&visible(root)&&(!root.closest('tr')||root.closest('tr')===tr||root.closest('tr')===tr.nextElementSibling))roots.push(root);
        }
      }
    }
    return [...new Set(roots)];
  }
  function pokerArrowCandidates(tr){
    // Screenshot: the blue > is directly LEFT of IDN Poker / IDNPoker, often
    // *inside the Game cell*, not in the table's first <td>.
    const cells=[...tr.children].filter(e=>e.tagName==='TD');
    const game=cells.find(td=>/idn\s*poker/i.test(txt(td)))||null;
    const contexts=[];
    if(game){contexts.push(game);const i=cells.indexOf(game);if(i>0)contexts.push(cells[i-1]);}
    for(const td of cells){
      if(td.matches('.details-control,.dt-control,.dtr-control,.control,.datatable-toggle-subtable,.kt-datatable__toggle-subtable')
        ||td.hasAttribute('aria-expanded'))contexts.push(td);
    }
    if(!contexts.length&&cells.length)contexts.push(cells[0]);
    const unique=[...new Set(contexts)];
    const candidates=[];
    const add=(node,score)=>{
      if(!node||!visible(node)||node.closest('tr')!==tr)return;
      if(/^(?:view\s+)?details?$/i.test(txt(node)))return;
      const found=candidates.find(x=>x.node===node);
      if(found)found.score=Math.max(found.score,score);
      else candidates.push({node,score});
    };
    const glyph=/chevron|angle[-_ ]?(?:right|down)|caret|fa-angle|fa-plus|expand|collapse|toggle|arrow-right|right-arrow|dtr-control|details-control|dt-control|fa-rotate|mdi-menu-right/i;
    for(const [index,td] of unique.entries()){
      const inGame=td===game,base=inGame?30:17;
      for(const el of all('a,button,[role="button"],[aria-expanded],[onclick],[data-toggle],[data-bs-toggle],svg,i,span,[class*="chevron"],[class*="expand"],[class*="toggle"]',td)){
        const attr=[el.className?.baseVal||el.className||'',el.id,el.getAttribute('aria-label'),el.getAttribute('title'),el.getAttribute('data-toggle'),el.getAttribute('onclick')].join(' ');
        const label=txt(el);
        if(/^details?$/i.test(label)||/download|copy|delete|edit|hapus|print|export/i.test(attr))continue;
        const special=glyph.test(attr);
        const tag=el.tagName?.toLowerCase();
        const isIcon=tag==='svg'||tag==='i';
        const htmlControl=tag==='a'||tag==='button'||el.getAttribute('role')==='button'||el.hasAttribute('aria-expanded');
        const iconInside=!!el.querySelector('svg,i,[class*="chevron"],[class*="arrow"],[class*="caret"]');
        // Do not click a generic span that only contains the game name.
        if(!special&&!isIcon&&!htmlControl&&!iconInside)continue;
        if(!special&&!isIcon&&/idn\s*poker/i.test(label))continue;
        let score=base+(special?100:0)+(htmlControl?42:0)+(isIcon?38:0)+(iconInside?20:0);
        if(el.hasAttribute('aria-expanded'))score+=45;
        try{if(getComputedStyle(el).cursor==='pointer')score+=15;}catch{}
        if(isIcon){
          // An icon's own click handler is bypassed if we click the <td>.
          // Prefer the nearest interactive wrapper when it exists.
          const own=el.closest('a,button,[role="button"],[aria-expanded],[onclick],[data-bs-toggle],[data-toggle]');
          if(own&&td.contains(own)&&own!==td){add(own,score+15);add(el,score-6);}
          else {add(el,score+8);if(el.parentElement&&el.parentElement!==td)add(el.parentElement,score-4);}
        }else add(el,score);
      }
      // DataTables sometimes binds toggle to the TD instead of the icon.
      if(td.matches('.details-control,.dt-control,.dtr-control,.control,.datatable-toggle-subtable,.kt-datatable__toggle-subtable,[aria-expanded]'))add(td,base+75);
      else if(td.querySelector('svg,i,[class*="chevron"],[class*="caret"],[class*="angle"]'))add(td,base+4);
      // A cell consisting only of a chevron glyph may itself be clickable.
      if(/^[\s›»>+〉❯❱]+$/.test(txt(td))&&td!==game)add(td,base+26);
    }
    // A catchall for an explicit toggle outside the named Game cell.
    for(const el of all('[aria-expanded],.details-control,.dt-control,.dtr-control',tr))add(el,90);
    candidates.sort((a,b)=>b.score-a.score);
    return candidates.slice(0,7).map(x=>x.node);
  }
  function pokerPanelIsOpen(tr,arrow){
    const roots=pokerExpandedRoots(tr,arrow);
    return roots.some(x=>x!==tr&&visible(x)&&(/\bdetails?\b/i.test(txt(x))||pokerDetailsIn(x).length))
      ||all('[aria-expanded="true"]',tr).some(visible)
      ||tr.classList.contains('shown')||tr.classList.contains('expanded');
  }
  async function openPokerRowThenGetDetail(tr,j){
    let found=[...new Set(pokerExpandedRoots(tr,null).flatMap(pokerDetailsIn))];
    if(found.length)return found;
    const arrows=pokerArrowCandidates(tr);
    if(!arrows.length)throw Error('Panah biru > di samping IDN Poker tidak terdeteksi pada baris transaksi. Tidak mengklik tombol lain.');
    let previous=null;
    for(let i=0;i<arrows.length;i++){
      check(j);
      found=[...new Set(pokerExpandedRoots(tr,previous).flatMap(pokerDetailsIn))];
      if(found.length)return found;
      if(pokerPanelIsOpen(tr,previous))break; // do not collapse a successfully opened accordion
      const arrow=arrows[i];
      if(!arrow.isConnected||!visible(arrow))continue;
      publish(j,{message:'IDN Poker: langkah 1/2 — klik panah biru > di samping nama permainan ('+(i+1)+')…'});
      // Use the icon/interactive element itself; element.click() generates the
      // browser's regular bubbling click for the site's registered handlers.
      if(typeof arrow.click==='function')arrow.click();
      else arrow.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
      previous=arrow;
      found=await until(()=>{
        const buttons=[...new Set(pokerExpandedRoots(tr,arrow).flatMap(pokerDetailsIn))];
        return buttons.length?buttons:null;
      },j,2100);
      if(found?.length)return found;
      if(pokerPanelIsOpen(tr,arrow))break;
    }
    publish(j,{message:'IDN Poker: menunggu panel details menampilkan tombol biru Detail…'});
    found=await until(()=>{
      const buttons=[...new Set(pokerExpandedRoots(tr,previous).flatMap(pokerDetailsIn))];
      return buttons.length?buttons:null;
    },j,6500);
    if(found?.length)return found;
    if(pokerPanelIsOpen(tr,previous))throw Error('Panah sudah membuka panel IDN Poker, tetapi tombol biru Detail di bawah tulisan details belum terbaca.');
    throw Error('Panah IDN Poker telah dicoba, tetapi panel details belum terbuka. Periksa ikon panah pada halaman Reporting MPS.');
  }
  function pokerSessionMatches(req){
    // Sites may open Detail through <a target="_blank">, form.target,
    // window.open(url, ..., "noopener"), or links with a suppressed referrer.
    // Those new tabs do not necessarily inherit opener / sessionStorage.
    // Accept any freshly opened HTTPS page that matches the pending request,
    // not only *.idnlive.live, because some Detail pages open on a different
    // host while still showing the same poker transaction detail.
    if(!req?.token||!req?.id||!req?.user)return false;
    const delta=Date.now()-Number(req.created);
    if(delta<0||delta>105000)return false;
    const j=live();
    if(!j||!active(j)||j.id!==req.id||norm(j.user)!==norm(req.user))return false;
    // The Reporting MPS tab that initiated the click must never capture itself.
    const sourceURL=(()=>{try{return new URL(req.sourceUrl);}catch{return null;}})();
    if(!sourceURL || location.hash.includes('jejak-main='+j.id))return false;
    let inheritedToken=false, openerFromReport=false;
    try{inheritedToken=sessionStorage.getItem(PREFIX+'poker-tab-token')===req.token;}catch{}
    try{openerFromReport=!!window.opener&&window.opener.location.href===req.sourceUrl;}catch{}
    let referrerFromReport=false;
    try{const ref=new URL(document.referrer);
      referrerFromReport=ref.origin===sourceURL.origin || ref.hostname.endsWith('.idnlive.live');
    }catch{}
    const expected=(()=>{try{return new URL(req.expectedUrl);}catch{return null;}})();
    const explicitURL=!!expected&&location.origin===expected.origin&&
      location.pathname===expected.pathname&&location.search===expected.search;
    const differentLocation=location.origin!==sourceURL.origin||
      location.pathname!==sourceURL.pathname||location.search!==sourceURL.search;
    // Navigation start must be newer than the click request. Unlike the
    // original script this also handles noopener/referrer-policy=no-referrer.
    // Existing tabs, opened before the request, are not eligible.
    const loadedAt=Number(performance?.timeOrigin)||0;
    const freshNavigation=loadedAt>=req.created-3500 && loadedAt<=Date.now()+1000;
    const pageHint=/Transaction\s+start|\bPeriode\b|\bPoker\b/i.test(
      [document.title,txt(document.body).slice(0,14000)].join(' '));
    const detailTable=!!pokerTableOnPage();
    const onSameURL=location.href===sourceURL.href;
    // A POST form may open a new tab with EXACTLY the same URL as the report.
    // Only accept that case if it is a fresh navigation with the Detail table.
    if(onSameURL&&!(freshNavigation&&detailTable))return false;
    return (explicitURL||openerFromReport||inheritedToken||referrerFromReport||
      (freshNavigation&&(pageHint||detailTable)&&(differentLocation||detailTable)))&&
      (differentLocation||explicitURL||detailTable);
  }
  function pokerTableOnPage(){
    const required=['no','id','date','game','table','periode','bet','hand','prize','status','amount','total'];
    return all('table').find(t=>all('tr',t).some(tr=>{
      const ths=[...tr.children].filter(c=>['TH','TD'].includes(c.tagName)).map(c=>key(txt(c)));
      return ths.length===12&&required.every((name,i)=>ths[i]===name||(name==='periode'&&ths[i]==='period'));
    }))||null;
  }
  function pokerPageRegion(t){
    if(!t)return document.body;
    const candidates=['.content-wrapper','.container-fluid','main','.content','.container','.card','.box','.panel','#content'];
    let best=null;
    for(const selector of candidates){
      const ancestor=t.closest(selector);
      if(!ancestor)continue;
      // The report title usually sits immediately above the table, inside this element.
      const size=ancestor.scrollWidth*ancestor.scrollHeight;
      if(size>0&&size<25000000&&(!best||size<best.size))best={node:ancestor,size};
    }
    let region=best?.node||t.parentElement||t.ownerDocument?.body||document.body;
    // The minimal IDN Poker detail page contains just heading + 12-column table.
    // Capture the actual page surface, including 'Transaction start - BAAE...'
    // and the 'Total N Report' row, not a re-drawn approximation.
    const body=t.ownerDocument?.body;
    if(body && /Transaction\s+start/i.test(txt(body).slice(0,500)) &&
       body.scrollWidth<=2600 && body.scrollHeight<=1700)region=body;
    // Keep the page heading if it sits in an adjacent sibling.
    const parent=region.parentElement;
    if(parent&&parent!==document.documentElement&&parent.scrollWidth<2400&&parent.scrollHeight<7500){
      const text=txt(parent);
      if(/Transaction\s+start/i.test(text)&&!/(?:Search by nickname|Transaction Regions)/i.test(text))region=parent;
    }
    return region;
  }
  async function pokerScreenshotFromNewTab(table){
    if(typeof html2canvas!=='function')throw Error('Pustaka tangkapan halaman tidak termuat. Pastikan koneksi ke CDN jsDelivr tersedia.');
    const doc=table?.ownerDocument||document;
    try{await Promise.race([doc.fonts?.ready||Promise.resolve(),sleep(2500)]);}catch{}
    await sleep(500);
    const root=pokerPageRegion(table);
    const host=doc.getElementById('jejak-main-isolated-v1');
    const before=host?.style.display;
    if(host)host.style.display='none';
    try{
      const width=Math.min(Math.max(root.scrollWidth||root.clientWidth,800),2300);
      const height=Math.min(Math.max(root.scrollHeight||root.clientHeight,250),9000);
      const scale=Math.min(1.5,1800/width,7000/height);
      const canvas=await html2canvas(root,{backgroundColor:'#ffffff',useCORS:true,allowTaint:false,
        logging:false,scale:Math.max(0.45,scale),width,height,windowWidth:Math.max(doc.documentElement.clientWidth,width),
        scrollX:0,scrollY:-(doc.defaultView?.scrollY||0)});
      if(!canvas?.width||!canvas?.height)throw Error('Canvas tangkapan halaman kosong.');
      let url=canvas.toDataURL('image/png');let format='png';
      if(url.length>1500000){url=canvas.toDataURL('image/jpeg',0.86);format='jpg';}
      if(url.length>1500000){
        const down=document.createElement('canvas');
        const ratio=Math.min(0.8,Math.sqrt(1300000/url.length));
        down.width=Math.max(400,Math.floor(canvas.width*ratio));down.height=Math.max(220,Math.floor(canvas.height*ratio));
        down.getContext('2d').drawImage(canvas,0,0,down.width,down.height);
        url=down.toDataURL('image/jpeg',0.79);format='jpg';
      }
      if(url.length>1800000)throw Error('Gambar terlalu besar untuk dikirim antartab (maksimum 1,8 MB).');
      return {dataURL:url,format,width:canvas.width,height:canvas.height};
    }finally{if(host)host.style.display=before||'';}
  }
  async function runPokerDetailNewTab(req){
    if(!pokerSessionMatches(req))return;
    const token=req.token;
    const reply=patch=>{
      const current=GM_getValue(POKER_REQUEST,null);
      if(current?.token!==token)return;
      GM_setValue(POKER_REPLY,{id:req.id,token,user:req.user,created:Date.now(),...patch});
    };
    try{
      // Acknowledge immediately so the originating tab can distinguish
      // "userscript did not run" from "detail page is still loading".
      reply({state:'seen',url:location.href,message:'Tab Detail terhubung, sedang membaca tabel…'});
      // Wait for server-side content or async reporting widgets to populate the new tab.
      const start=Date.now();let data=null,table=null,lastError='';
      while(Date.now()-start<45000){
        if(!pokerSessionMatches(req))throw Error('Sesi pengambilan detail berubah.');
        table=pokerTableOnPage();
        if(table){
          try{data=parsePokerDetail(document,req.user,{verifiedClick:true});break;}
          catch(e){lastError=e.message;
            if(/berbeda dengan|tidak cocok|tidak terverifikasi/i.test(lastError))throw e;
          }
        }
        await sleep(300);
      }
      if(!table)throw Error('Tab baru terbuka, tetapi tabel IDN Poker (12 kolom) belum muncul dalam 45 detik.');
      // A successful capture is an actual rendered image of the new tab DOM,
      // not a hand-drawn imitation of the table.
      let picture=null,captureError='';
      try{picture=await pokerScreenshotFromNewTab(table);}
      catch(e){captureError=e.message;}
      if(!data&&picture){
        // Image-only fallback: preserve tab binding; do NOT fabricate table rows.
        data={title:'Detail IDN Poker - '+req.user,headers:[],rows:[],partial:true,summary:'Gambar langsung dari tab Detail',verifiedBy:'tab baru dari transaksi yang dipilih',parseWarning:lastError};
      }
      if(!data)throw Error(lastError||'Tabel detail baru belum bisa dibaca.');
      if(picture){
        GM_setValue(POKER_IMAGE,{id:req.id,user:req.user,token,created:Date.now(),...picture});
      }
      reply({state:'ready',data,hasScreenshot:!!picture,format:picture?.format||null,captureError,
        url:location.href});
      // The tab is left open, so the operator can compare the original Detail page.
    }catch(e){reply({state:'error',error:e.message,url:location.href});}
  }
  {
    const pending=GM_getValue(POKER_REQUEST,null);
    if(pokerSessionMatches(pending)){
      // Read/capture in the REAL new tab, even if "noopener" removed opener
      // or the site redirects Detail to another HTTPS host.
      runPokerDetailNewTab(pending);
      return;
    }
    // Non-REGC HTTPS pages are loaded only so a real Detail tab can be read.
    if(!isRegc && !isAdmin && location.hostname!=='app.chatgacor.com'){
      // Never inject the Jejak Main control bubble on unrelated pages.
      return;
    }
  }
  async function readPokerDetailClick(button,j){
    const token=crypto.randomUUID();
    const pageWindow=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
    const originalOpen=pageWindow.open;
    const originalToken=sessionStorage.getItem(PREFIX+'poker-tab-token');
    const allowed=value=>{
      try{const u=new URL(String(value),location.href);return u.origin===location.origin&&/^https?:$/.test(u.protocol)?u.href:null;}
      catch{return null;}
    };
    const directHref=button.closest('a')?.getAttribute('href')||button.getAttribute('href');
    const expectedUrl=directHref&&!/^(?:javascript:|#)/i.test(directHref)?allowed(directHref):null;
    const request={id:j.id,user:j.user,token,created:Date.now(),sourceUrl:location.href,
      expectedUrl,target:GM_getValue(OUT,null)?.pokerDetail?.target||null};
    GM_setValue(POKER_IMAGE,null);GM_setValue(POKER_REPLY,null);
    GM_setValue(POKER_REQUEST,request);
    sessionStorage.setItem(PREFIX+'poker-tab-token',token);
    let opened=false,observedURL='',manualFallback=false,tabSeen=false;const popupWindows=[],backgroundTabs=[];
    const observingOpen=function(...args){
      if(args[0]){
        const u=allowed(args[0]);
        if(u){observedURL=u;GM_setValue(POKER_REQUEST,{...request,expectedUrl:u});}
      }
      // Open normal GET detail URLs in an INACTIVE Tampermonkey tab.
      // Keep native window.open only for blank windows / script-written pages,
      // where the site needs a writable Window reference.
      const backgroundURL=args[0]&&args[0]!=='about:blank'?allowed(args[0]):null;
      if(backgroundURL){
        try{
          backgroundTabs.push(GM_openInTab(backgroundURL,{active:false,insert:true,setParent:true}));
          opened=true;manualFallback=true;
          return {closed:false,focus(){},blur(){},location:{href:backgroundURL}};
        }catch{}
      }
      const child=originalOpen.apply(this,args);
      if(child){opened=true;popupWindows.push(child);
        try{child.sessionStorage.setItem(PREFIX+'poker-tab-token',token);}catch{}
        // POST / blank child windows might activate despite an automated click.
        // Return attention to the report tab where the user started.
        try{child.blur();pageWindow.focus();}catch{}
      }else if(observedURL&&!/\bnoopener\b/i.test(String(args[2]||''))){
        // Native window.open may be blocked without a physical click.
        // GM_openInTab has extension permission and keeps the real GET destination.
        try{backgroundTabs.push(GM_openInTab(observedURL,{active:false,insert:true,setParent:true}));opened=true;manualFallback=true;}catch{}
      }
      return child;
    };
    try{
      pageWindow.open=observingOpen;
      // Direct target=_blank anchor: avoid browser activation by using GM_openInTab.
      // Form-backed and dynamically generated details keep the site's real click.
      const anchor=button.closest('a[href]');
      if(expectedUrl&&anchor&&/^_blank$/i.test(anchor.target||'')&&!anchor.hasAttribute('onclick')){
        try{backgroundTabs.push(GM_openInTab(expectedUrl,{active:false,insert:true,setParent:true}));opened=true;manualFallback=true;}
        catch{button.click();}
      }else button.click();
      // Undo the passive observer after the site's click handlers have run.
      setTimeout(()=>{if(pageWindow.open===observingOpen)pageWindow.open=originalOpen;},2500);
      publish(j,{message:'IDN Poker: tombol Detail diklik; membaca tabel dan mengambil gambar dari tab BARU…'});
      const start=Date.now();
      while(Date.now()-start<70000){
        check(j);
        // Some sites call window.open('about:blank') and then document.write()
        // the report into it. Such a page does not match @match rules, so the
        // opener must capture the REAL child-tab document through its handle.
        for(const child of popupWindows){
          try{
            if(child.closed||!child.document?.body)continue;
            const childDoc=child.document;
            const childTable=all('table',childDoc).find(t=>all('tr',t).some(tr=>{
              const names=[...tr.children].filter(c=>['TH','TD'].includes(c.tagName)).map(c=>key(txt(c)));
              return names.length===12&&['no','id','date','game','table','periode','bet','hand','prize','status','amount','total'].every((n,i)=>names[i]===n||(n==='periode'&&names[i]==='period'));
            }));
            if(!childTable)continue;
            const data=parsePokerDetail(childDoc,j.user,{verifiedClick:true});
            let picture=null,captureError='';
            try{picture=await pokerScreenshotFromNewTab(childTable);}catch(e){captureError=e.message;}
            if(picture)GM_setValue(POKER_IMAGE,{id:j.id,user:j.user,token,created:Date.now(),...picture});
            return {...data,imageToken:picture?token:null,imageFormat:picture?.format||null,captureError};
          }catch(e){
            // Explicitly wrong User ID is a hard stop. A not-yet-rendered table
            // may still become valid, so continue polling that case.
            if(/User ID.*berbeda|berbeda dengan|tidak cocok/i.test(e.message))throw e;
          }
        }
        if(!opened&&!manualFallback&&!tabSeen&&expectedUrl&&Date.now()-start>12000){
          // Plain direct Detail link: try the extension's tab opener if a
          // script-driven anchor click was blocked by the browser.
          try{backgroundTabs.push(GM_openInTab(expectedUrl,{active:false,insert:true,setParent:true}));manualFallback=true;}catch{}
        }
        const response=GM_getValue(POKER_REPLY,null);
        if(response?.token===token&&response.id===j.id){
          if(response.state==='seen')tabSeen=true;
          if(response.state==='error')throw Error('Tab Detail: '+response.error);
          if(response.state==='ready'){
            const screenshot=GM_getValue(POKER_IMAGE,null);
            const matched=!!response.hasScreenshot&&screenshot?.token===token&&screenshot.id===j.id;
            return {...response.data,imageToken:matched?token:null,imageFormat:matched?response.format:null,
              captureError:response.captureError||(!matched?'Tangkapan gambar tab baru tidak tersedia.':'')};
          }
        }
        await sleep(250);
      }
      throw Error(tabSeen
        ? 'Tab Detail sudah terhubung, tetapi belum mengirim hasil gambar. Periksa apakah isi tabel Detail sudah tampil.'
        : 'Tab Detail tidak terhubung ke Tampermonkey. Ini bukan kesalahan User ID; skrip belum berjalan pada alamat tab yang terbuka. Versi ini sudah mencoba membaca tab Detail lintas alamat HTTPS. Jika masih gagal, buka tab Detail dan pastikan Tampermonkey aktif pada alamat tersebut. '+
          (observedURL?'URL yang dipanggil: '+observedURL:opened?'Tab baru diminta oleh situs.':'Tidak ada panggilan window.open yang terdeteksi (mungkin tab dibuat lewat tautan/form).'));
    }finally{
      // Evidence is already stored in GM values; no reason to leave Detail tabs open.
      for(const tab of backgroundTabs){try{tab?.close?.();}catch{}}
      for(const child of popupWindows){try{if(!child.closed)child.close();}catch{}}
      if(pageWindow.open===observingOpen)pageWindow.open=originalOpen;
      if(originalToken===null)sessionStorage.removeItem(PREFIX+'poker-tab-token');
      else sessionStorage.setItem(PREFIX+'poker-tab-token',originalToken);
      const current=GM_getValue(POKER_REQUEST,null);
      if(current?.token===token)GM_setValue(POKER_REQUEST,null);
    }
  }
  const host=document.createElement('div'); host.id='jejak-main-isolated-v1';
  host.style.cssText='position:fixed;right:8px;bottom:12px;z-index:2147483647';
  if(isAdmin)host.style.display='none';
  document.body.append(host);
  const shadow=host.attachShadow({mode:'closed'});
  shadow.innerHTML=`<style>
    :host{font:13px system-ui,sans-serif;color:#e9f7ff}*{box-sizing:border-box}button,input{font:inherit}
    button{cursor:pointer;border:1px solid #2b5363;border-radius:10px;padding:9px 12px;background:#183443;color:#e9f7ff}button:hover{background:#245064}
    #toggle{touch-action:none;user-select:none;cursor:grab;background:linear-gradient(120deg,#12657a,#25445f);box-shadow:0 5px 25px #0006;border-color:#46c6d4;border-radius:25px}
    #panel{display:none;width:370px;max-width:calc(100vw - 32px);background:#101d2a;border:1px solid #347287;border-radius:18px;box-shadow:0 15px 65px #0009;margin-bottom:10px;overflow:auto;max-height:calc(100vh - 80px)}
    header{cursor:grab;touch-action:none;user-select:none;display:flex;justify-content:space-between;align-items:center;padding:12px 15px;background:#193343}b{color:#70e2dc}main{padding:12px}input{width:100%;background:#0b1620;color:white;border:1px solid #386477;border-radius:9px;padding:11px;margin-bottom:9px}
    .actions{display:flex;gap:6px;flex-wrap:wrap}#status{white-space:pre-wrap;margin:12px 0;color:#b6d6e5;line-height:1.5}#results{max-height:48vh;overflow:auto}.card{border:1px solid #294957;border-radius:10px;padding:10px;margin-top:8px;overflow-wrap:anywhere}.muted{font-size:11px;color:#a6bccb;line-height:1.5;margin-top:9px}details{margin-top:8px}summary{cursor:pointer;color:#8ce7dc}dl{margin:7px 0}dt{color:#91b7c9;font-size:11px}dd{margin:0 0 5px;white-space:pre-wrap}#start{background:#147e82}[hidden]{display:none!important}
    :host{color-scheme:dark}#panel{width:390px;background:linear-gradient(145deg,#101e30,#0a1421);border:1px solid #375b70;border-radius:22px;box-shadow:0 24px 80px #0009,0 0 0 1px #ffffff05}header{padding:16px;background:linear-gradient(110deg,#193a4b,#142539);border-bottom:1px solid #74d7d522}header strong{letter-spacing:2px}main{padding:16px}input,select{border:1px solid #315166;background:#0b1726;color:#e4f6ff;border-radius:10px;padding:10px;font:inherit;min-width:0}input:focus,select:focus{outline:1px solid #59d9cf}#uid{font-size:15px;padding:13px}select{width:100%;margin-top:5px}.date-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0 5px}.date-grid label{font-size:11px;color:#9bb6c8}.date-grid input{margin:5px 0;width:100%;font-size:12px;padding:9px}.quick{display:flex;gap:6px;margin-bottom:12px}.quick button{font-size:11px;padding:6px 10px}#start{flex:1;background:linear-gradient(110deg,#27b7a9,#137b98);border-color:#51d9c2;color:white;font-weight:700}button{transition:filter .15s}button:hover{filter:brightness(1.15)}#status{padding:12px;background:#0a1423;border:1px solid #213c51;border-radius:12px;font-size:12px}dl{display:grid;grid-template-columns:85px 1fr;gap:9px;margin-top:14px}dt{font-size:11px;text-transform:uppercase;letter-spacing:.5px}dd{font-size:13px;margin:0}.card{background:linear-gradient(120deg,#183b43,#152838);border-color:#359e9580;padding:14px}.tools{margin-top:14px;border-top:1px solid #284354;padding-top:9px}.tools button{margin:5px 4px 0 0;font-size:11px;padding:7px 9px}#progress{height:4px;background:#173243;border-radius:4px;overflow:hidden;margin-top:10px}#bar{height:100%;background:linear-gradient(90deg,#38d5b7,#64b5ff);width:0%;transition:width .3s}
    .sleek-box{margin-top:14px;padding:13px;border:1px solid #47758a;border-radius:14px;background:linear-gradient(130deg,#18384d,#142032)}.sleek-box strong{letter-spacing:1.5px;color:#77dfd1}.sleek-box small{font-size:9px;color:#a7becd;letter-spacing:1px}.sleek-box p{font-size:11px;color:#a7becd;line-height:1.8}.sleek-box input{margin-bottom:8px;font-size:12px}.sleek-box button{width:100%;background:#215570}a:hover{text-decoration:underline}

    :host{font:12px system-ui,-apple-system,"Segoe UI",sans-serif;color:#dfeaf0}
    #panel{width:var(--jm-width,321px);max-width:calc(100vw - 16px);max-height:calc(100dvh - 76px);background:#142228;border:1px solid #30434c;border-radius:16px;box-shadow:0 14px 48px #0006;overflow:auto;scrollbar-width:thin;scrollbar-color:#3c5661 #142228}
    header{position:sticky;top:0;z-index:2;background:#172930;border-bottom:1px solid #2b414a;padding:13px 14px}header strong{font-size:14px;letter-spacing:1.5px}header b{color:#43d3bc}.subtitle{display:block;margin-top:4px;font-size:10px;color:#91a8b3;letter-spacing:.3px}#close{padding:4px 9px;background:#20363f;border-color:#3a535e;font-size:18px}
    main{padding:12px}input,select{background:#102027;border:1px solid #314b57;border-radius:8px;color:#e4f0f4}#uid{padding:10px;font-size:13px;margin-bottom:2px}input:focus,select:focus{outline:1px solid #31baa8}button{font-size:11px;padding:8px 10px;border-radius:8px;background:#223942;border-color:#36525e}button:disabled{opacity:.4;cursor:not-allowed;filter:none}.date-grid{gap:7px;margin:10px 0 6px}.date-grid label{font-size:9px;letter-spacing:.8px}.date-grid input{padding:8px 5px;font-size:11px}.quick{gap:5px;margin-bottom:9px}.quick button{flex:1;padding:6px 3px;font-size:10px}
    #start{background:#118d80;border:1px solid #30b8a5}#stop{background:#273840;border-color:#41555d}.actions{gap:6px}.actions button{flex:1;white-space:normal}#status{font-size:11px;line-height:1.6;margin:10px 0;padding:10px;background:#102027;border-color:#2a424d;border-radius:10px;overflow-wrap:anywhere}#progress{height:3px;margin:8px 0}#bar{background:#2ac5aa}#results{max-height:none;overflow:visible}.card{padding:10px;background:#182e34;border:1px solid #31534f;border-radius:10px}.card b{color:#62d6c4;font-size:11px}.card:empty,#activity:empty,#refresh-info:empty{display:none}dl{grid-template-columns:70px minmax(0,1fr);gap:6px;margin:10px 0 0}dt{font-size:9px;color:#94adb8}dd{font-size:11px;overflow-wrap:anywhere}.card p,#activity{font-size:11px;line-height:1.6}#activity ul{padding-left:16px;margin:6px 0}#activity p{color:#95b2be}#reply{font:12px/1.65 system-ui!important;background:#102027!important;border-color:#314b57!important;min-height:110px!important;resize:vertical}
    .sleek-box{background:#182b32;border-color:#36525e;padding:10px;border-radius:11px}.sleek-box strong{font-size:11px;letter-spacing:1px}.sleek-box small{font-size:8px}.sleek-box p{font-size:10px;margin:7px 0;line-height:1.7}.sleek-box input{padding:9px;font-size:11px}.sleek-box button{padding:9px;font-size:11px}#copy-sleek-link{background:#118d80;border-color:#36b7a5}#open-sleek-link{background:transparent;color:#9bb9c6;border-color:#36525e}.muted{font-size:10px}.tools{border-top:1px solid #2c424c;margin-top:11px;padding-top:10px}.tools summary{font-size:11px;color:#95b4c0}.tools label{display:block;margin:10px 0}.tools button{font-size:10px;padding:6px 8px}#toggle{background:#1d373e;border:1px solid #3f9b90;font-size:12px;padding:10px 15px}

    #balance-info{padding:0;background:transparent;border:0;margin:12px 0}
    .balance-card{--accent:#63e3bb;background:linear-gradient(145deg,#173b36,#142a31);border:1px solid #36715e;border-radius:15px;overflow:hidden;box-shadow:0 6px 18px #0002}
    .balance-card.pending{--accent:#f5cb78;border-color:#776441;background:linear-gradient(145deg,#393326,#202b30)}
    .balance-head{display:flex;align-items:center;gap:10px;padding:15px 13px 10px}
    .balance-icon{display:grid;place-items:center;width:32px;height:32px;flex-shrink:0;border-radius:50%;background:#ffffff0b;border:1px solid var(--accent);color:var(--accent);font-size:18px;font-weight:700}
    .balance-kicker{font-size:9px;color:#b8cdc7;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:3px}
    .balance-title{font-size:16px;line-height:1.25;font-weight:750;color:var(--accent)}
    .balance-sub{margin:0;padding:0 13px 12px;color:#d3e4e1;font-size:11px;line-height:1.6}
    .balance-values{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px;padding:0 12px 12px}
    .balance-value{padding:11px 9px;background:#091c2380;border:1px solid #ffffff10;border-radius:10px;min-width:0}
    .balance-value span{display:block;font-size:10px;color:#a8c2c6;margin-bottom:6px}
    .balance-value strong{display:block;font-size:clamp(13px,4vw,18px);line-height:1.35;letter-spacing:-.3px;color:#f3fffc;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
    .balance-meta{padding:11px 13px;border-top:1px solid #ffffff10;display:grid;gap:7px}
    .balance-meta-row{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;font-size:11px;line-height:1.5}
    .balance-meta-row span{color:#9fbabf}.balance-meta-row strong{color:#e0f0ed;font-size:11px;font-weight:600;overflow-wrap:anywhere}
    .balance-foot{margin:0;padding:10px 13px;background:#081a2240;color:#acc6c6;font-size:10px;line-height:1.65;border-top:1px solid #ffffff0c}
    #results>.card{border-radius:12px;background:#132a32;border-color:#304b56;padding:12px;margin-top:10px}
    #results>.card b{font-size:12px}#results dd{line-height:1.6}#activity{padding:0 2px;color:#bed0d6}

    #panel{background:linear-gradient(155deg,#152d37 0%,#101d29 55%,#102c30 100%);border:1px solid #42616d;border-radius:20px;box-shadow:0 22px 65px #0007,inset 0 1px 0 #ffffff12}
    header{background:linear-gradient(115deg,#1b4651,#162c40);padding:16px 14px;border-bottom:1px solid #5dd6c326;box-shadow:0 4px 14px #0002}header strong{color:#f4fffe;font-size:15px;letter-spacing:1px}header b{color:#68e0c6}.subtitle{color:#b0c8d2;font-size:10px}
    main{padding:13px}#uid{background:#0c1c28;border-color:#4b6979;padding:13px 11px;font-size:14px;border-radius:11px;box-shadow:inset 0 2px 4px #0002}input:focus,select:focus{outline:2px solid #66d9c1;outline-offset:1px}
    button{border-radius:10px;box-shadow:inset 0 1px 0 #ffffff09;transition:background .15s,box-shadow .15s}button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid #8ae8d2;outline-offset:3px}
    #start{background:linear-gradient(110deg,#129987,#187f99);border-color:#4acdb4;padding:11px;font-size:12px;box-shadow:0 4px 14px #0c8a7b33}#stop{background:#293d4b;border-color:#50616d}#status{background:#0b192681;border-color:#304959;color:#c2d7e1;border-radius:12px;padding:12px}#progress{height:5px;border-radius:5px}#bar{background:linear-gradient(90deg,#43cfad,#6ec9ef)}
    .quick button{background:#213b48;color:#dcebf1;border-color:#3c5b67}#activity{padding:8px 10px;background:#10222b66;border-radius:10px;border:1px solid #ffffff08}#activity:empty{display:none}#activity ul{color:#d4e4e7;line-height:1.8}#activity p{margin:0;color:#a8c8d1}
    .balance-card{box-shadow:0 8px 24px #0003,inset 0 1px 0 #ffffff0c}.balance-value{background:linear-gradient(150deg,#112c32,#0d202c);box-shadow:inset 0 1px 0 #ffffff07}#results>.card{background:linear-gradient(145deg,#1b3340,#142632);border-color:#365461;box-shadow:0 4px 12px #0002}#results>.card b{color:#86e1d1}#results dt{color:#9bbdc9}#results dd{color:#eef5f7}
    #image-links{margin-top:13px;background:#112736;border:1px solid #3d6071;border-radius:14px;overflow:hidden;font-size:11px}
    #image-links:empty{display:none}.image-heading{display:flex;justify-content:space-between;align-items:center;padding:12px;color:#e6f3f6;font-weight:650}.image-heading span{font-size:9px;font-weight:600;color:#87e3c8;background:#1e4945;border:1px solid #3b7465;border-radius:20px;padding:3px 7px}
    .image-thumb{display:block;margin:0 10px;border-radius:9px;background:#fff;padding:7px;box-shadow:0 3px 12px #0003;overflow:hidden}.image-thumb img{display:block;width:100%;height:auto;min-height:40px;object-fit:contain}.image-hint{padding:7px 11px 2px;color:#a7c4d0;font-size:10px}
    .image-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:10px}.image-actions a{padding:9px 5px;border:1px solid #477284;border-radius:8px;text-align:center;color:#d6f8f1!important;background:#20434e;text-decoration:none;font-weight:600;margin:0!important}.image-actions a:hover{background:#2c5862}#image-links>.muted{margin:0;padding:0 11px 11px;color:#a8bdc9}
    .sleek-box{background:linear-gradient(145deg,#1c3544,#132734);border:1px solid #3b5c70;border-radius:14px;padding:12px}.sleek-box strong{color:#a0e5da;font-size:12px}.sleek-box p{color:#bed0da}#copy-sleek-link{background:linear-gradient(110deg,#128b7a,#187c91)}#reply{border-radius:12px!important;color:#e3eff3!important;background:#10232e!important}#toggle{background:linear-gradient(120deg,#1b605c,#213e55);border-color:#59b8a5;border-radius:25px;box-shadow:0 6px 24px #0005;color:#eafff9}

    /* Amethyst theme — presentation only. */
    :host{--ink:#f4f0ff;--soft:#c2b8d7;--line:#ffffff19;--gold:#efd2a3;--lavender:#c8acff;color:var(--ink)}
    #panel{background:radial-gradient(ellipse at 100% 0%,#653b7829,transparent 45%),linear-gradient(155deg,#241b36,#161422 60%,#221b33);border:1px solid #766087;border-radius:22px;box-shadow:0 24px 70px #09051399,0 0 0 3px #bba0e009,inset 0 1px 0 #ffffff1a;scrollbar-color:#665478 #1c172a}
    header{background:linear-gradient(115deg,#47305d,#2b2441 70%,#393044);padding:17px 15px;border-bottom:1px solid #e2c3ff2b;box-shadow:0 5px 20px #0b071d40}
    header strong{font-size:15px;letter-spacing:1.8px;color:#fff6ed;text-shadow:0 1px 6px #0c081b44}header b{color:var(--gold)}.subtitle{color:#cbbddc;letter-spacing:.4px;margin-top:5px}#close{background:#ffffff09;color:#f2e7ff;border-color:#ffffff22;border-radius:9px}
    main{padding:14px}input,select{background:#171322;border-color:#574766;color:#f0e9ff;border-radius:10px;box-shadow:inset 0 2px 6px #08051233}input::placeholder{color:#a497b6}#uid{background:#181323;border-color:#725789;color:#fff7ff;border-radius:12px;padding:14px 12px;font-size:14px;box-shadow:inset 0 2px 8px #0003,0 0 0 3px #b68bea08}input:focus,select:focus{outline:2px solid #c3a0f3;outline-offset:2px}
    .date-grid{gap:9px;margin-top:13px}.date-grid label{color:#c9b8db;letter-spacing:.7px}.date-grid input{background:#1b1628;color:#ece3fa;border-color:#554361;padding:9px 5px}.quick{gap:6px;margin:8px 0 12px}.quick button{background:#30263e;color:#e8d9fa;border-color:#604b75;border-radius:20px;padding:7px 3px}
    button{background:#33283f;color:#eee5fa;border-color:#685177;border-radius:10px;box-shadow:inset 0 1px 0 #ffffff10;transition:background .16s,border-color .16s,box-shadow .16s}button:hover{background:#493455;border-color:#aa83c9;filter:none;box-shadow:0 3px 12px #0002}button:focus-visible,a:focus-visible,summary:focus-visible{outline:2px solid #e0c2ff;outline-offset:3px}
    #start{background:linear-gradient(115deg,#bc91ef,#9568c5 65%,#a56bb8);color:#1b102c;border:1px solid #e1baff;padding:12px 10px;font-size:12px;font-weight:800;box-shadow:0 5px 18px #ac7cdb30,inset 0 1px 0 #fff5}#start:hover{background:linear-gradient(115deg,#d1aff8,#ac80df);box-shadow:0 6px 20px #ac7cdb44}#stop{background:#352737;border-color:#765262;color:#f2d3df}
    #status{background:linear-gradient(130deg,#271e34,#1c192b);color:#d8cce6;border:1px solid #584466;border-left:3px solid #b78bdd;border-radius:12px;padding:12px;line-height:1.7;box-shadow:inset 0 1px 0 #fff03}#progress{height:5px;background:#382a47;margin:11px 0}#bar{background:linear-gradient(90deg,#a57ce4,#dab9f8 60%,#efd2a3);box-shadow:0 0 12px #b991e950}
    #activity{padding:10px 12px;background:#251d31;border:1px solid #4a395b;border-radius:12px}#activity p{color:#c9b4df}#activity ul{color:#eee3f7;line-height:1.9;margin-bottom:0}
    .balance-card{--accent:#9be3c1;background:linear-gradient(145deg,#243f3d,#242a39 65%,#2b253b);border-color:#658979;border-radius:17px;box-shadow:0 10px 26px #09051244,inset 0 1px 0 #d2ffe619}.balance-card.pending{--accent:#f4d6a3;background:linear-gradient(145deg,#493b34,#30273a);border-color:#987b52}.balance-head{padding:16px 14px 11px}.balance-icon{width:35px;height:35px;background:#abf1cd10;box-shadow:0 0 14px #9ce3c008}.balance-kicker{color:#c4cfcf;font-size:9px}.balance-title{font-size:18px;letter-spacing:-.3px}.balance-sub{color:#e0e3eb;padding:0 14px 13px;font-size:11px}.balance-values{gap:8px;padding:0 12px 13px}.balance-value{background:linear-gradient(145deg,#201f30,#191a29);border:1px solid #a7a0c32b;padding:13px 9px;border-radius:11px;box-shadow:inset 0 1px 0 #fff06}.balance-value span{color:#c5bdd4;font-size:10px}.balance-value strong{color:#fff6e5;font-size:18px;font-weight:750;letter-spacing:-.5px}.balance-meta{border-color:#a4abce1a;padding:12px 14px}.balance-meta-row span{color:#beb6d0}.balance-meta-row strong{color:#f1e9fb}.balance-foot{color:#c3bcd2;background:#100f213d;border-color:#ffffff0d;line-height:1.7}
    #results>p{color:#decaef;font-size:12px;line-height:1.7;margin:15px 2px 8px}#results>.card{background:linear-gradient(140deg,#30253e,#211c30);border:1px solid #5b456c;border-radius:14px;padding:13px;box-shadow:0 5px 16px #09051233,inset 0 1px 0 #fff05}#results>.card b{color:#e5c6ff;font-size:12px;line-height:1.6}#results dt{color:#bfaacb}#results dd{color:#f2eafa;font-size:12px}#results dl{row-gap:8px}summary{color:#d4b6f0}.muted{color:#bfb0cd}
    #image-links{background:linear-gradient(145deg,#33263f,#211c30);border-color:#705681;border-radius:16px;box-shadow:0 7px 18px #09051230}.image-heading{padding:13px;color:#f3e7ff;font-size:12px}.image-heading span{background:#414234;border-color:#7c8055;color:#e2e6af;font-size:9px}.image-thumb{padding:8px;margin:0 11px;background:#fff;border-radius:10px;box-shadow:0 5px 15px #0c081b66}.image-hint{color:#ccbbdb;padding:9px 12px 1px}.image-actions{gap:8px;padding:11px}.image-actions a{background:#423050;border-color:#82618f;color:#f4e3ff!important;border-radius:9px;padding:10px 5px}.image-actions a:hover{background:#5b3e69}#image-links>.muted{color:#c5b5d5}
    .sleek-box{background:linear-gradient(135deg,#35263f,#211b30);border:1px solid #6a4c7d;border-radius:16px;padding:13px;box-shadow:inset 0 1px 0 #ffffff08}.sleek-box strong{color:#efd2a3;font-size:12px;letter-spacing:1.5px}.sleek-box small{color:#ccb7d7}.sleek-box p{color:#d2c2df;font-size:11px}.sleek-box input{background:#191323;border-color:#705181;color:#f1e5fc}#copy-sleek-link{background:linear-gradient(110deg,#d7b889,#bb91bd);border-color:#efcfab;color:#281d2b;font-weight:750}#open-sleek-link{background:transparent;border-color:#685277;color:#d7c1e7}#reply{background:#1c1728!important;border-color:#624a74!important;color:#f0e7f8!important;border-radius:13px!important;padding:12px!important;line-height:1.8!important}.tools{border-color:#513d62;margin-top:15px}.tools summary{color:#c5aedb}.tools button{background:#30253f;border-color:#5d456f;color:#e7d6f4}.tools label{color:#c9b6d9}#toggle{background:linear-gradient(120deg,#674884,#3b2e50);border:1px solid #c8a2e7;color:#fff0db;padding:11px 17px;border-radius:28px;box-shadow:0 9px 26px #13092166,inset 0 1px 0 #fff3;font-weight:650;letter-spacing:.4px}

    :host{--ink:#fff3e6;--soft:#cbb9b5;--gold:#ecd0a0;--lavender:#f0c38e;color:var(--ink)}
    #panel{background:radial-gradient(ellipse at top right,#a1353d24,transparent 48%),linear-gradient(160deg,#341b23,#171418 65%,#2b1920);border-color:#795550;border-radius:20px;box-shadow:0 22px 65px #10090c99,inset 0 1px 0 #ffe2b51a;scrollbar-color:#795451 #21171c}
    header{background:linear-gradient(115deg,#69303d,#2c1c27);border-bottom-color:#e8bb8529;padding:16px 15px}header strong{color:#fff3e1;letter-spacing:1.4px}header b{color:#f0c68f}.subtitle{color:#d5bcb8}#close{background:#ffffff09;border-color:#ffffff25;color:#f9e6dd}
    input,select,#uid{background:#21171d;color:#fff0e5;border-color:#6a464b}#uid{border-color:#99666a;box-shadow:inset 0 2px 6px #0002,0 0 0 3px #da9e9408}input::placeholder{color:#bca2a4}input:focus,select:focus{outline-color:#edbe8b}.date-grid label{color:#d6b6b4}.date-grid input{background:#24191f;border-color:#64424a;color:#f9e8df}
    button,.quick button{background:#472a33;border-color:#81505a;color:#f8e4dd}.quick button{border-radius:9px}button:hover,.quick button:hover{background:#623743;border-color:#bc7b7e}button:focus-visible,a:focus-visible,summary:focus-visible{outline-color:#f1cd9c}#start{background:linear-gradient(115deg,#efcd96,#c59868);border-color:#f6dcb1;color:#352013;box-shadow:0 5px 18px #daa8742b}#start:hover{background:linear-gradient(115deg,#f9e1b9,#e1b37f)}#stop{background:#40272e;border-color:#80525b;color:#f1cdd0}
    #status{background:linear-gradient(135deg,#35222b,#23191f);border-color:#64434d;border-left-color:#d4a071;color:#ecd6cd}#progress{background:#492a33}#bar{background:linear-gradient(90deg,#a96565,#dbab81,#f1d4a3);box-shadow:0 0 10px #d9a47544}#activity{background:#2b1d24;border-color:#583a44}#activity p{color:#d3aea9}#activity ul{color:#f0d8cf}
    .balance-card{background:linear-gradient(140deg,#273c33,#28262d);border-color:#597965;--accent:#b1e0bf}.balance-card.pending{background:linear-gradient(140deg,#46382a,#2c222b);border-color:#88734b;--accent:#f3d59d}.balance-value{background:linear-gradient(145deg,#201e24,#19181e);border-color:#bda89935}.balance-value span{color:#cdbdb5}.balance-value strong{color:#fff3df}.balance-kicker{color:#c9c5b8}.balance-sub{color:#e2dfd5}.balance-meta-row span{color:#c0b9b1}.balance-meta-row strong{color:#f5ece1}.balance-foot{color:#c9bfb6;background:#17151d50}
    #results>p{color:#e4beb3}#results>.card{background:linear-gradient(145deg,#39232c,#241a23);border-color:#69414f}#results>.card b{color:#f0c596}#results dt{color:#c6a6a5}#results dd{color:#f9e7dc}summary{color:#e8c095}.muted{color:#c9b2ad}
    #image-links{background:linear-gradient(145deg,#3a252e,#241a22);border-color:#8a5d68;border-radius:15px}.image-heading{color:#ffe8d8}.image-heading span{background:#244740;color:#abe7cd;border-color:#497b68}.image-hint,#image-links>.muted{color:#d1b4af}.image-actions a{background:#603743;border-color:#a86e77;color:#ffebd8!important}.image-actions a:hover{background:#794553}#reply{background:#24191f!important;border-color:#805263!important;color:#f7e4d9!important}.tools{border-color:#62414a}.tools summary{color:#ddbaad}.tools button{background:#452a34;color:#f0d8ce;border-color:#79505d}.tools label{color:#d2b7b2}#toggle{background:linear-gradient(120deg,#743b49,#35202d);border-color:#c29175;color:#ffe7c6;box-shadow:0 8px 24px #17090f66,inset 0 1px 0 #ffffff24}

    .jm-brand{display:flex;align-items:center;gap:10px;min-width:0}.jm-emblem{display:grid;place-items:center;flex:none;width:44px;height:44px;color:#edc58e;border-radius:14px;background:linear-gradient(140deg,#56313e,#261b26);border:1px solid #c49b6f70;box-shadow:inset 0 1px 0 #ffe4b526,0 4px 12px #08040a33}.jm-emblem svg{display:block;width:38px;height:38px;pointer-events:none}.jm-brand strong{font-size:14px;letter-spacing:1.2px}.jm-brand .subtitle{font-size:9px;letter-spacing:.2px}
    #toggle{display:inline-flex;align-items:center;gap:11px;padding:8px 14px 8px 8px;border-radius:19px;background:linear-gradient(120deg,#5a2d3b,#291c28);border-color:#b9896c;box-shadow:0 10px 30px #18080e66,inset 0 1px 0 #f7d2a51a;text-align:left;max-width:calc(100vw - 20px)}#toggle:hover{background:linear-gradient(120deg,#733b49,#392332)}#toggle .jm-emblem{width:42px;height:42px;border-radius:12px}.jm-launch-label{font-size:12px;font-weight:750;letter-spacing:1.2px;color:#f9dfbb;line-height:1.4}.jm-launch-label small{display:block;color:#d7b7b4;font-weight:400;font-size:9px;letter-spacing:.2px;margin-top:3px}.jm-launch-dot{width:5px;height:5px;background:#dfba84;border-radius:50%;margin-left:4px;box-shadow:0 0 0 4px #dfba8410}
.jm-emblem,#toggle .jm-emblem{width:66px;height:43px;background:#fff;border-color:#e8d4b2;border-radius:10px;padding:5px;box-shadow:0 3px 12px #0003}.jm-idn-logo{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none}
    #panel{background:radial-gradient(ellipse at top right,#a17b2720,transparent 45%),linear-gradient(155deg,#25262b,#15171d 65%,#242329);border-color:#736449;box-shadow:0 24px 65px #05060c99,inset 0 1px 0 #fff3d012;scrollbar-color:#76654b #1b1c22}
    header{background:linear-gradient(115deg,#403a2f,#252831);border-bottom-color:#e2bd762c}header strong{color:#fff3db}header b{color:#ebc778}.subtitle{color:#c8c4b9}#close{background:#ffffff08;border-color:#ffffff22;color:#f3e7d3}
    .jm-emblem,#toggle .jm-emblem{width:44px;height:44px;border-radius:13px;background:linear-gradient(145deg,#fff7e8,#ead9b7);border:1px solid #e3bf7e;padding:7px;box-shadow:0 5px 14px #0004,inset 0 1px 0 #fff}.jm-idn-logo{width:100%;height:100%;object-fit:contain}.jm-brand{gap:10px}
    input,select,#uid,.date-grid input{background:#171a22;border-color:#56514a;color:#f8f0e1}#uid{border-color:#8b7756;box-shadow:inset 0 2px 7px #0003,0 0 0 3px #d6b26709}input::placeholder{color:#aaa69e}.date-grid label{color:#c9bfae}input:focus,select:focus{outline-color:#dfbe7f}
    button,.quick button,.tools button{background:#33343b;border-color:#62605b;color:#eee7dc}button:hover,.quick button:hover{background:#494840;border-color:#a58d60}#start{background:linear-gradient(115deg,#f3d99d,#d2aa61);border-color:#ffe5ac;color:#30271a;box-shadow:0 5px 18px #d6ac5d24}#start:hover{background:linear-gradient(115deg,#ffe9b9,#e5bd75)}#stop{background:#3a3033;border-color:#76585d;color:#ebcdd0}button:focus-visible,a:focus-visible,summary:focus-visible{outline-color:#f1d392}
    #status{background:linear-gradient(130deg,#2b2b31,#1c2029);border-color:#534c41;border-left-color:#d7b575;color:#ded7ca}#progress{background:#38362e}#bar{background:linear-gradient(90deg,#a57c3f,#edce8d,#fff0c7);box-shadow:0 0 10px #d8ba6a33}#activity{background:#21252e;border-color:#4a4944}#activity p{color:#c8b691}#activity ul{color:#e7dfd1}
    .balance-card{background:linear-gradient(140deg,#273d36,#222a30);border-color:#647b63;--accent:#b8e2b5}.balance-card.pending{background:linear-gradient(140deg,#453c2b,#29292f);border-color:#a18752;--accent:#f3d69b}.balance-value{background:linear-gradient(145deg,#1f242b,#181c24);border-color:#acaa8829}.balance-value span{color:#bbbeb5}.balance-value strong{color:#fff2d6}.balance-sub{color:#dedfd6}.balance-meta-row span{color:#b8b9ad}.balance-meta-row strong{color:#f2ebdb}.balance-foot{color:#c2c4b8;background:#14191f44}
    #results>p{color:#e1cca4}#results>.card{background:linear-gradient(140deg,#2b303a,#1e222d);border-color:#595447}#results>.card b{color:#ecd29f}#results dt{color:#b5ae9f}#results dd{color:#f0eade}summary,.tools summary{color:#d9c297}.muted,.tools label{color:#bdb5a6}
    #image-links{background:linear-gradient(140deg,#30323b,#20242d);border-color:#756348}.image-heading{color:#f5e6ca}.image-heading span{background:#384332;border-color:#74815a;color:#d1e2ae}.image-hint,#image-links>.muted{color:#c5bba7}.image-actions a{background:#494234;border-color:#947b50;color:#fff0d0!important}.image-actions a:hover{background:#62543b}#reply{background:#1a1e28!important;border-color:#665b48!important;color:#f0e7d6!important}.tools{border-color:#514b40}
    #toggle{background:linear-gradient(120deg,#464032,#252831);border-color:#c09a5f;border-radius:18px;box-shadow:0 10px 30px #080a1166,inset 0 1px 0 #fff0c21a}#toggle:hover{background:linear-gradient(120deg,#5c5038,#30333d)}.jm-launch-label{color:#f9dfaa}.jm-launch-label small{color:#c9c3b6}.jm-launch-dot{background:#e2bc72;box-shadow:0 0 0 4px #e2bc7210}
</style><section id="panel"><header><div class="jm-brand"><span class="jm-emblem"><img class="jm-idn-logo" src="https://regc.idnlive.live/img/favicon.png" alt="IDN Play" referrerpolicy="no-referrer"></span><div><strong>JEJAK <b>MAIN</b></strong><small class="subtitle">Riwayat bermain member</small></div></div><button id="close">−</button></header><main>
    <input id="uid" placeholder="Tempel User ID member" autocomplete="off" spellcheck="false">
    <div class="date-grid"><label>DARI TANGGAL<input id="date-start" type="date"></label><label>SAMPAI TANGGAL<input id="date-end" type="date"></label></div>
    <div class="quick"><button id="today">Hari ini</button><button id="yesterday">Kemarin</button><button id="week">7 hari</button></div>
    <div class="actions" style="margin-top:9px"><button id="start">Cari member</button><button id="stop">Stop</button></div>
    <div id="status">${isRegc?'Tab REGC siap. Pencarian dimulai dari ChatGacor.':'Login REGC dahulu. Tempel User ID, lalu cari.'}</div><div id="progress"><div id="bar"></div></div><select id="result-region" hidden aria-label="Region hasil"></select><div id="activity"></div><div id="balance-info" class="card"></div><div id="results"></div><div id="delivery" hidden><textarea id="reply" readonly style="width:100%;min-height:95px;margin-top:12px;background:#0b1726;color:#e4f6ff;border:1px solid #315166;border-radius:10px;padding:10px"></textarea><div class="actions"><button id="copy-reply">Salin balasan</button><button id="sleek-preview">Gambar Sleekshot</button></div><div id="image-links" class="muted"></div><div id="image-feedback" class="muted" role="status" style="padding:5px 9px"></div><div id="poker-image-status" class="muted" role="status"></div><div id="history-trans-status" class="muted" role="status"></div></div><button id="retry-poker-image" hidden style="width:100%;margin-top:8px">Ambil ulang detail IDN Poker</button><div id="refresh-info" class="muted"></div>
    <div class="muted" style="text-align:center">Geser melalui judul · Hasil sesuai tanggal pilihan</div>
    <details class="tools"><summary>Bantuan & pengaturan</summary><label class="muted">Zona waktu timestamp tanpa zona: <select id="zone"><option value="420">WIB / UTC+7</option><option value="480">UTC+8 / SGT</option><option value="0">UTC</option></select></label><button id="check-admin">Ulang cek saldo</button><button id="copy">Salin rincian</button><button id="make-image">Ulang gambar</button><button id="open-regc">Buka REGC</button><button id="bind-date">Kenali tanggal</button><button id="bind-nick">Kenali pencarian</button><button id="bind-table">Kenali tabel</button><button id="bind-server">Kenali server</button><button id="bind-search">Kenali tombol cari</button><button id="diagnose">Salin diagnosa</button><button id="capture">Ambil tabel manual</button><button id="clear">Hapus hasil</button></details></main></section><button id="toggle" aria-label="Buka atau tutup Jejak Main"><span class="jm-emblem"><img class="jm-idn-logo" src="https://regc.idnlive.live/img/favicon.png" alt="IDN Play" referrerpolicy="no-referrer"></span><span class="jm-launch-label">JEJAK MAIN<small>Cek transaksi member</small></span><span class="jm-launch-dot" aria-hidden="true"></span></button>`;
  const q=s=>shadow.querySelector(s), status=s=>{q('#status').textContent=s;};
  const positionKey=PREFIX+'position:'+location.hostname;
  let draggedUntil=0;
  function clampPosition(x,y) {
    const box=host.getBoundingClientRect();
    return {x:Math.max(6,Math.min(x,Math.max(6,innerWidth-box.width-6))),y:Math.max(6,Math.min(y,Math.max(6,innerHeight-box.height-6)))};
  }
  function place(x,y) {
    const pos=clampPosition(x,y);
    host.style.right='auto';host.style.bottom='auto';host.style.left=pos.x+'px';host.style.top=pos.y+'px';return pos;
  }
  const savedPosition=GM_getValue(positionKey,null);
  if(savedPosition&&Number.isFinite(savedPosition.x)&&Number.isFinite(savedPosition.y)) place(savedPosition.x,savedPosition.y);
  for(const handle of [q('header'),q('#toggle')]) {
    let drag=null;
    handle.addEventListener('pointerdown',e=>{
      if(e.button!==0||(handle!==q('#toggle')&&e.target.closest('button')))return;
      const box=host.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:box.left,top:box.top,moved:false};
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove',e=>{
      if(!drag||e.pointerId!==drag.id)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.hypot(dx,dy)>4)drag.moved=true;
      if(drag.moved){e.preventDefault();place(drag.left+dx,drag.top+dy);}
    });
    const finish=e=>{
      if(!drag||e.pointerId!==drag.id)return;
      if(drag.moved){draggedUntil=Date.now()+400;const box=host.getBoundingClientRect();GM_setValue(positionKey,{x:box.left,y:box.top});}
      if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);drag=null;
    };
    handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
  }
  function fit(){if(host.style.left){const box=host.getBoundingClientRect();place(box.left,box.top);}}
  window.addEventListener('resize',fit);
  new ResizeObserver(fit).observe(host);
  let watchedSidebar=null,sidebarWatch=null;
  function sidebarWidth(){
    if(location.hostname!=='app.chatgacor.com')return 321;
    const labels=all('h1,h2,h3,h4,[role="heading"],strong,span').filter(el=>visible(el)&&norm(txt(el))==='pengunjung');
    for(const label of labels){
      for(let node=label.parentElement,depth=0;node&&depth<9;node=node.parentElement,depth++){
        const box=node.getBoundingClientRect();
        if(box.width>=240&&box.width<=480&&box.height>=innerHeight*.45&&box.left>=innerWidth*.5&&box.right<=innerWidth+2){
          if(watchedSidebar!==node){sidebarWatch?.disconnect();watchedSidebar=node;sidebarWatch=new ResizeObserver(updatePanelWidth);sidebarWatch.observe(node);}
          return Math.max(220,Math.floor(box.width-16));
        }
      }
    }
    return 321;
  }
  function updatePanelWidth(){const width=Math.min(sidebarWidth(),Math.max(180,innerWidth-16));host.style.setProperty('--jm-width',width+'px');fit();}
  updatePanelWidth();window.addEventListener('resize',updatePanelWidth);
  if(location.hostname==='app.chatgacor.com')setInterval(updatePanelWidth,3000);
  q('#toggle').onclick=()=>{if(Date.now()<draggedUntil)return;q('#panel').style.display=q('#panel').style.display==='block'?'none':'block';fit();};
  q('#close').onclick=()=>q('#panel').style.display='none';
  q('#zone').value=String(GM_getValue(PREFIX+'timezone',420));
  q('#zone').onchange=()=>{GM_setValue(PREFIX+'timezone',Number(q('#zone').value));if(lastResult)render(lastResult);};
  let viewId=null, workerTab=null, lastResult=null, chosenRegion='',workerJobId=null;
  function quickDate(back){const z=Number(q('#zone').value);q('#date-start').value=dateISO(z,-back);q('#date-end').value=dateISO(z);}
  quickDate(0);
  q('#today').onclick=()=>quickDate(0);
  q('#week').onclick=()=>quickDate(6);
  q('#yesterday').onclick=()=>{quickDate(1);q('#date-end').value=q('#date-start').value;};
  q('#open-regc').onclick=()=>GM_openInTab(GM_getValue(PREFIX+'reportURL','https://regc.idnlive.live/'),{active:true});
  function selector(el){
    if(el.id)return '#'+CSS.escape(el.id);
    const parts=[];while(el&&el!==document.body){let part=el.tagName.toLowerCase();const siblings=[...el.parentElement.children].filter(x=>x.tagName===el.tagName);if(siblings.length>1)part+=':nth-of-type('+(siblings.indexOf(el)+1)+')';parts.unshift(part);el=el.parentElement;}return 'body > '+parts.join(' > ');
  }
  function bind(name){
    if(!isRegc)return status('Buka bubble di tab REGC untuk mengenali kontrol.');
    status('Klik '+({date:'kotak tanggal',nickname:'kolom Search by nickname',table:'tabel hasil',server:'dropdown Select Server',search:'tombol Search'}[name])+' di halaman REGC. Esc untuk batal.');
    const cleanup=()=>{document.removeEventListener('click',pick,true);document.removeEventListener('keydown',cancel,true);};
    const cancel=e=>{if(e.key==='Escape'){cleanup();status('Pengenalan dibatalkan.');}};
    const pick=e=>{
      if(e.composedPath().includes(host))return;e.preventDefault();e.stopImmediatePropagation();
      let el=e.target;
      if(name==='table')el=el.closest('table,[role="table"],[role="grid"]');
      if(name==='nickname')el=el.closest('input');
      if(name==='server')el=el.closest('select,[role="combobox"],.select2-selection,.ant-select-selector')||el;
      if(name==='search')el=el.closest('button,a,[role="button"],input[type="submit"]');
      if(!el){status('Bagian yang diklik tidak sesuai. Klik kontrol yang dimaksud atau tekan Esc.');return;}
      const config=mappings();config[name]=selector(el);GM_setValue(controlKey(),config);cleanup();status('Kontrol tersimpan. Tekan Cari member untuk mencoba ulang.');
    };
    document.addEventListener('click',pick,true);document.addEventListener('keydown',cancel,true);
  }
  for(const [id,name] of [['date','date'],['nick','nickname'],['table','table'],['server','server'],['search','search']])q('#bind-'+id).onclick=()=>bind(name);
  q('#diagnose').onclick=()=>{
    if(!isRegc)return status('Tekan Salin diagnosa dari bubble di tab REGC.');
    const summary={version:'1.50.0',path:location.pathname,jquery:!!jq(),dateRangePicker:!!rangePicker(),nickname:!!nickname(),table:!!table(),nativeServer:!!nativeServer(),dateInputCount:all('input[type="date"]').length,headers:table()?all('th,[role="columnheader"]',table()).map(txt):[],inputs:all('input').filter(e=>e.type!=='password'&&e.type!=='hidden').map(e=>({type:e.type,placeholder:e.placeholder})),lastStatus:q('#status').textContent};
    GM_setClipboard(JSON.stringify(summary,null,2),'text');status('Diagnosa tersalin. Kirim teks ini jika pencarian masih gagal. Tidak menyertakan isi tabel atau sandi.');
  };

  function available(r){return (r.regions||[]).filter(x=>!x.error&&x.rows?.length);}
  function chosen(r){return winningRegion(r,Number(q('#zone').value));}
  function displayFields(row){return [
    ['Timestamp',field(row,['timestamp','transactiontimestamp','datetime','transactiontime','transactiondate','time','date','waktu','tanggal'])],
    ['Game',field(row,['game','gamename','permainan'])],['Provider',field(row,['provider','gameprovider'])],['Round ID',field(row,['roundid','round'])],
    ['User',field(row,['user','userid','username','nickname','player','playername','playerid','account'])],
    ['Type',field(row,['type','transactiontype'])],['Amount',field(row,['amount'])]
  ];}

  let adminTab=null,adminJobId=null,adminOpenedAt=0,historyTab=null,historyJobId=null,historyOpenedAt=0;
  function closeHandle(handle){try{if(handle&&!handle.closed)handle.close();}catch{}}
  function finishedFor(id,result,admin){if(!id||result?.id!==id||!result.done)return false;const decision=deliveryDecision(result,admin,Number(q('#zone').value));return decision.state==='ready'||decision.state==='error';}
  function scheduleBalanceRetry(j,result,admin,ownedId){
    if(!j||!active(j)||ownedId!==j.id||result?.id!==j.id||!result.done)return;
    const retry=result.balanceRetry;
    if(retry){
      if(['queued','running'].includes(retry.state)&&Date.now()-retry.started>180000)publish(j,{balanceRetry:{...retry,state:'error',error:'Cek ulang melewati 3 menit.'},message:'Cek ulang dihentikan karena batas waktu.'});
      return;
    }
    // Begitu saldo admin TERBACA, langsung cek ulang REGC. History Bank
    // admin tidak perlu ditunggu untuk tugas ini.
    if(admin?.id!==j.id||admin.state!=='ready'||money(admin.raw)===null)return;
    if(latestBalanceVerified(result,admin,j.offset))return;
    const firstRead=regcBalanceSnapshot(result,j.offset);
    if(!firstRead){
      publish(j,{balanceRetry:{state:'error',started:Date.now(),error:'Saldo/waktu/User ID pada transaksi REGC pertama tidak dapat dikunci.'}});
      return;
    }
    const phase=EXPECTED.includes(firstRead.label)?0:REPORTS.findIndex(x=>x.title===firstRead.label);if(phase<0)return;
    publish(j,{balanceRetry:{state:'queued',label:firstRead.label,phase,started:Date.now(),
      admin:{...admin},firstRead,nav:null,dateApplied:false},
      message:'Saldo REGC pertama Rp '+amountText(firstRead.balance)+' di '+firstRead.label+
        ' ('+firstRead.date+'). Membaca ulang transaksi yang SAMA sebelum history_trans…'});
  }
  function schedulePokerDetail(j,result,admin,ownedId){
    if(!j||!active(j)||ownedId!==j.id||result?.id!==j.id||!result.done)return;
    if(result.pokerDetail){if(['queued','running'].includes(result.pokerDetail.state)&&Date.now()-result.pokerDetail.started>180000)publish(j,{pokerDetail:{...result.pokerDetail,state:'error',error:'Detail poker melewati batas tunggu 3 menit.'}});return;}
    // Only request a poker screenshot AFTER saldo reconciliation and (when needed) history_trans.
    const resolved=reconciliationDecision(result,admin,j.offset);
    if(resolved.state!=='ready'||resolved.type!=='regc')return;
    const target=pokerTarget(result,j.offset);if(!target)return;
    if(!Number.isFinite(target.time)){publish(j,{pokerDetail:{state:'error',error:'Waktu transaksi poker belum lengkap.'}});return;}
    publish(j,{pokerDetail:{state:'queued',phase:1,nav:null,target,started:Date.now()},message:'Menyiapkan gambar kedua: detail IDN Poker…'});
  }

  function scheduleHistoryTrans(j,result,admin,ownedId){
    if(!j||!active(j)||ownedId!==j.id||result?.id!==j.id||!result.done)return;
    const state=result.historyTransDetail;
    if(state){
      if(['queued','running'].includes(state.state)&&Date.now()-state.started>180000)publish(j,{historyTransDetail:{...state,state:'error',error:'Pemeriksaan history_trans melewati 3 menit.'},message:'history_trans dihentikan karena batas waktu.'});
      return;
    }
    if(result.balanceRetry?.state!=='done'||result.balanceRetry.matched||
       result.balanceRetry.confirmed!==true||!result.balanceRetry.secondRead)return;
    // Tidak perlu menunggu History Bank lain; pembacaan saldo admin sudah ada.
    if(admin?.id!==j.id||admin.state!=='ready'||money(admin.raw)===null)return;
    if(latestBalanceVerified(result,admin,j.offset))return;
    publish(j,{historyTransDetail:{state:'queued',started:Date.now()},
      message:'Pembacaan ulang '+result.balanceRetry.label+' mengonfirmasi saldo awal Rp '+
      amountText(result.balanceRetry.firstRead.balance)+'. Masih berbeda dengan admin; cek history_trans…'});
  }
  // Each page running Jejak Main owns independent JS variables. In v1.46 any
  // page seeing historyTransDetail.state='queued' could open another tab. Store
  // one job-scoped claim in Tampermonkey before opening the tab and never
  // automatically retry an opened/closed tab during that same search.
  function launchHistoryTrans(j){
    if(!j||!active(j)||workerJobId!==j.id)return;
    const result=GM_getValue(OUT,null);
    if(result?.id!==j.id||result.historyTransDetail?.state!=='queued')return;
    const previous=GM_getValue(HISTORY_TAB_CLAIM,null);
    if(previous?.jobId===j.id)return; // One opening attempt per job, across all tabs.

    const claim={jobId:j.id,owner:SCRIPT_INSTANCE_ID,openedAt:Date.now(),state:'opening'};
    GM_setValue(HISTORY_TAB_CLAIM,claim); // Claim BEFORE browser creates a tab.
    const verify=GM_getValue(HISTORY_TAB_CLAIM,null);
    if(verify?.jobId!==j.id||verify.owner!==SCRIPT_INSTANCE_ID)return;
    historyJobId=j.id;historyOpenedAt=claim.openedAt;
    try{
      const opened=GM_openInTab('https://agwl2.admitoto.com/history_trans.php#jejak-history='+j.id,
        {active:false,insert:true,setParent:true});
      if(!opened||typeof opened.close!=='function')throw Error('Tampermonkey tidak memberikan kontrol penutupan tab.');
      historyTab=opened;
      GM_setValue(HISTORY_TAB_CLAIM,{...claim,state:'opened'});
    }catch(e){
      const current=GM_getValue(HISTORY_TAB_CLAIM,null);
      if(current?.jobId===j.id&&current?.owner===SCRIPT_INSTANCE_ID)
        GM_setValue(HISTORY_TAB_CLAIM,{...claim,state:'failed',error:String(e.message||e)});
      publish(j,{historyTransDetail:{...result.historyTransDetail,state:'error',error:'Gagal membuka satu tab history: '+(e.message||e)}});
      historyTab=null;
    }
  }
  function closeHistoryOwnedTab(reason='finished'){
    const id=historyJobId;
    if(!id)return;
    const tab=historyTab;
    historyTab=null;historyJobId=null;historyOpenedAt=0;
    if(tab&&typeof tab.close==='function'){
      try{tab.close();}catch(e){ /* Tab mungkin telah ditutup oleh pengguna. */ }
    }
    const claim=GM_getValue(HISTORY_TAB_CLAIM,null);
    if(claim?.jobId===id&&claim.owner===SCRIPT_INSTANCE_ID)
      GM_setValue(HISTORY_TAB_CLAIM,{...claim,state:reason,finishedAt:Date.now()});
  }

  function closeFinishedTabs(){
    const result=GM_getValue(OUT,null);let admin=GM_getValue(ADMIN,null);
    if(result?.done&&workerJobId===result.id&&admin?.id===result.id&&admin.state==='waiting'){const job=live();if(job?.id===result.id&&active(job))launchAdmin(job);admin=GM_getValue(ADMIN,null);}
    // A login redirect may prevent the admin userscript from running: report it instead of waiting forever.
    if(adminTab&&!adminTab.closed&&admin?.id===adminJobId&&(admin.state==='loading'||admin.history?.state==='loading')&&Date.now()-adminOpenedAt>90000){
      admin={...admin,state:'error',updated:Date.now(),message:'Pembacaan saldo admin melewati 90 detik. Pastikan sudah login AGWL2, lalu ulangi Cek saldo admin.'};GM_setValue(ADMIN,admin);
    }
    const j=live();
    scheduleBalanceRetry(j,result,admin,workerJobId);
    scheduleHistoryTrans(j,GM_getValue(OUT,null),admin,workerJobId);
    schedulePokerDetail(j,GM_getValue(OUT,null),admin,workerJobId);
    let latest=GM_getValue(OUT,null);

    // Only the tab that STARTED the search may create the history tab. Once
    // claimed, even a closed handle must never cause another tab to be opened.
    if(latest?.historyTransDetail?.state==='queued'&&j&&active(j)&&workerJobId===j.id)
      launchHistoryTrans(j);

    const claim=GM_getValue(HISTORY_TAB_CLAIM,null);
    const heartbeat=GM_getValue(HISTORY_TAB_PROGRESS,null);
    if(j&&active(j)&&workerJobId===j.id&&latest?.id===j.id&&
       ['queued','running'].includes(latest.historyTransDetail?.state)&&
       claim?.jobId===j.id&&claim.owner===SCRIPT_INSTANCE_ID){
      const started=heartbeat?.jobId===j.id;
      const elapsed=Date.now()-claim.openedAt;
      if((!started&&elapsed>35000)||(started&&elapsed>105000)){
        const detail=!started?
          'Skrip tidak aktif di tab history. Periksa ekstensi Tampermonkey, login AGWL2, atau redirect ke alamat lain.':
          ('Tahap terakhir: '+heartbeat.phase+' pada '+heartbeat.path+
           (heartbeat.lastError?' — '+heartbeat.lastError:heartbeat.error?' — '+heartbeat.error:''));
        publish(j,{historyTransDetail:{...latest.historyTransDetail,state:'error',
          error:'Tab history belum berhasil: '+detail+' Tidak membuka tab kedua.'}});
        latest=GM_getValue(OUT,null);
      }
    }

    // Close history IMMEDIATELY once it reports ready/error (including after
    // taking the screenshot), even while a separate IDN Poker job is running.
    if(historyJobId&&(
      j?.id!==historyJobId||j?.cancel||
      (latest?.id===historyJobId&&['ready','error'].includes(latest.historyTransDetail?.state)))){
      closeHistoryOwnedTab(j?.cancel?'cancelled':j?.id!==historyJobId?'replaced':'finished');
    }

    if(['queued','running'].includes(latest?.balanceRetry?.state)||['queued','running'].includes(latest?.pokerDetail?.state)||['queued','running'].includes(latest?.historyTransDetail?.state))return;
    if((workerJobId&&j?.id!==workerJobId)||(workerJobId&&j?.cancel)||finishedFor(workerJobId,latest,admin)){closeHandle(workerTab);workerTab=null;workerJobId=null;}
    if((adminJobId&&j?.id!==adminJobId)||(adminJobId&&j?.cancel)||finishedFor(adminJobId,latest,admin)){closeHandle(adminTab);adminTab=null;adminJobId=null;}
  }
  setInterval(closeFinishedTabs,1000);

  function launchAdmin(j){
    if(adminTab&&!adminTab.closed)adminTab.close();
    adminJobId=j.id;adminOpenedAt=Date.now();
    GM_setValue(ADMIN,{id:j.id,user:j.user,requestId:crypto.randomUUID(),updated:Date.now(),state:'loading',message:'Membuka pencarian saldo admin…'});
    adminTab=GM_openInTab('https://agwl2.admitoto.com/agentplayerlist.php#jejak-balance='+j.id,{active:false,insert:true,setParent:true});
  }
  q('#retry-poker-image').onclick=()=>{
    const j=live(),result=GM_getValue(OUT,null);
    if(!j||!active(j)||!result?.done||result.id!==j.id)return status('Mulai pencarian baru dahulu agar detail sesuai hasil terbaru.');
    const verdict=reconciliationDecision(result,GM_getValue(ADMIN,null),j.offset);
    if(verdict.state!=='ready'||verdict.type!=='regc')return status('Verifikasi saldo/history belum selesai atau permainan terakhir bukan IDN Poker.');
    const target=pokerTarget(result,j.offset);if(!target||!Number.isFinite(target.time))return status('Waktu transaksi IDN Poker belum lengkap.');
    publish(j,{pokerDetail:{state:'queued',phase:1,nav:null,target,started:Date.now()},message:'Membuka MPS untuk mengambil detail IDN Poker…'});
    if(isRegc){runPokerDetail();return;}
    if(workerTab&&!workerTab.closed)return;
    workerJobId=j.id;const url=new URL(GM_getValue(PREFIX+'reportURL','https://regc.idnlive.live/'));url.hash='jejak-main='+j.id;
    workerTab=GM_openInTab(url.href,{active:false,insert:true,setParent:true});
  };
  q('#check-admin').onclick=()=>{const j=live();if(!j||!active(j))return status('Mulai pencarian User ID dahulu.');launchAdmin(j);};
  function balanceCard({title,subtitle,leftLabel,left,right,region,time,note,pending=false}){
    const box=document.createElement('section');box.className='balance-card'+(pending?' pending':'');box.setAttribute('aria-label','Hasil pencocokan saldo');
    const head=document.createElement('div');head.className='balance-head';
    const icon=document.createElement('span');icon.className='balance-icon';icon.textContent=pending?'!':'✓';icon.setAttribute('aria-hidden','true');
    const text=document.createElement('div'),kicker=document.createElement('div'),heading=document.createElement('div');kicker.className='balance-kicker';kicker.textContent='Pencocokan saldo';heading.className='balance-title';heading.textContent=title;text.append(kicker,heading);head.append(icon,text);box.append(head);
    const sub=document.createElement('p');sub.className='balance-sub';sub.textContent=subtitle;box.append(sub);
    const values=document.createElement('div');values.className='balance-values';
    for(const [label,amount] of [[leftLabel,left],['Balance REGC',right]]){const item=document.createElement('div'),caption=document.createElement('span'),value=document.createElement('strong');item.className='balance-value';caption.textContent=label;value.textContent='Rp '+amountText(amount);item.append(caption,value);values.append(item);}box.append(values);
    if(region||time){const meta=document.createElement('div');meta.className='balance-meta';for(const [label,value] of [['Region',region],['Transaksi',time]]){if(!value)continue;const row=document.createElement('div'),key=document.createElement('span'),content=document.createElement('strong');row.className='balance-meta-row';key.textContent=label;content.textContent=value;row.append(key,content);meta.append(row);}box.append(meta);}
    if(note){const foot=document.createElement('p');foot.className='balance-foot';foot.textContent=note;box.append(foot);}return box;
  }
  function showContext(r){
    q('#activity').replaceChildren();
    const list=(r.regions||[]).filter(x=>SOURCES.includes(x.label)&&!x.error&&x.rows?.length);
    if(list.length){const title=document.createElement('p');title.textContent='Transaksi juga ditemukan di:';q('#activity').append(title);
      const ul=document.createElement('ul');for(const item of list){const li=document.createElement('li');li.textContent=item.label+' — '+(item.transactionCount??item.rows.length)+' transaksi terbaca'+(item.partial?' (sebagian)':'');ul.append(li);}q('#activity').append(ul);
    }
    const panel=q('#balance-info');panel.replaceChildren();
    const admin=GM_getValue(ADMIN,null);
    if(!admin||admin.id!==r.id){panel.textContent='Saldo admin belum diperiksa.';return;}
    if(admin.state!=='ready'){panel.textContent=admin.message||'Menunggu saldo admin…';return;}
    const offset=Number(q('#zone').value),source=winningRegion(r,offset);
    if(latestBalanceVerified(r,admin,offset)){
      const amount=money(admin.raw),row=source.rows[0];
      panel.append(balanceCard({title:'Saldo cocok',subtitle:'Saldo transaksi REGC paling baru sama dengan saldo admin.',
        leftLabel:'Saldo admin',left:amount,right:money(rowBalance(row)),region:source.label,
        time:field(row,['timestamp','datetime','time','date']),note:'Perbandingan menggunakan waktu dan saldo terbaru.'}));return;
    }
    if(['queued','running'].includes(r.balanceRetry?.state)){
      const first=r.balanceRetry.firstRead;
      panel.textContent='Saldo REGC awal '+(first?'Rp '+amountText(first.balance)+' · '+first.label+' · '+first.date:'terdeteksi')+
        '. Membaca ulang transaksi yang sama sebelum membuka history_trans…';return;
    }
    if(r.balanceRetry?.state==='done'&&!r.balanceRetry.matched){
      if(r.balanceRetry.confirmed!==true){panel.textContent='Pembacaan ulang saldo REGC belum terverifikasi. Bukti ditahan.';return;}
      if(r.historyTransDetail?.state==='ready'){
        const proof=reconcileHistoryLedger(r,admin,offset);
        if(proof.state==='matched'){
          const terms=proof.steps.flatMap(x=>[
            ...(BigInt(x.debet)>0n?[' − Rp '+amountText(x.debet)]:[]),
            ...(BigInt(x.kredit)>0n?[' + Rp '+amountText(x.kredit)]:[])
          ]);
          const equation=terms.length<=6?
            ('Rp '+amountText(proof.regcBalance)+terms.join('')+' = Rp '+amountText(proof.computedBalance)):
            ('Rp '+amountText(proof.regcBalance)+' − Rp '+amountText(proof.debetTotal)+
            ' + Rp '+amountText(proof.kreditTotal)+' = Rp '+amountText(proof.computedBalance));
          panel.append(balanceCard({title:'Saldo sesuai setelah mutasi',subtitle:equation,
            leftLabel:'Saldo admin',left:proof.adminBalance,right:proof.computedBalance,
            region:source.label,time:proof.fromDate,note:proof.steps.length+' mutasi setelah waktu REGC dihitung berdasarkan Tanggal, Debet, Kredit, dan Saldo.'}));return;
        }
        panel.textContent='Saldo belum terverifikasi: '+proof.message;return;
      }
      panel.textContent=r.historyTransDetail?.state==='error'?'Pemeriksaan history_trans gagal: '+r.historyTransDetail.error:
        'REGC awal Rp '+amountText(r.balanceRetry.firstRead.balance)+' = baca ulang Rp '+
        amountText(r.balanceRetry.secondRead.balance)+'. Admin Rp '+amountText(money(admin.raw))+
        '. Saldo tetap berbeda; menunggu history_trans dan penjumlahan Debet/Kredit…';return;
    }
    panel.textContent=r.balanceRetry?.state==='error'?'Cek ulang REGC gagal: '+r.balanceRetry.error:
      'Saldo berbeda; cek ulang REGC wajib dilakukan sebelum menyiapkan bukti.';
  }
  function imageKey(r){
    if(!r)return '';
    const zone=Number(q('#zone').value),src=winningRegion(r,zone),row=src?.rows?.[0]||[];
    const proof=r.historyTransDetail?.proof;
    return [r.id,norm(r.user),zone,src?.label||'',src?.time||'',
      rowBalance(row),field(row,['roundid','round']),
      proof?.state||'',proof?.computedBalance||'',proof?.latestGame?.date||'',
      proof?.latestGame?.keterangan||'',r.pokerDetail?.data?.imageToken||''].join('|');
  }
  function render(r) {
    if(!r)return;
    // A previous bubble instance may still be displaying another member.
    // Adopt only the current active job: never let an old viewId hide a new ID.
    let adoptedJob=false;
    if(viewId&&r.id!==viewId){
      if(live()?.id!==r.id)return;
      viewId=r.id;
      imageAttempt='';adoptedJob=true;
    }
    // Never overwrite a new User ID typed in the search box just because
    // the old job updates in another browser tab or on the 15-second refresh.
    if((adoptedJob||!q('#uid').value.trim())&&document.activeElement!==q('#uid'))
      q('#uid').value=r.user||'';
    if(imageIdentity&&imageIdentity!==imageKey(r))revokeImage();
    if(lastResult&&imageKey(lastResult)!==imageKey(r)){if(previewOverlay){previewOverlay.remove();previewOverlay=null;}}
    lastResult=r;showContext(r);
    const decision=deliveryDecision(r,GM_getValue(ADMIN,null),Number(q('#zone').value));
    const needsPokerRetry=reconciliationDecision(r,GM_getValue(ADMIN,null),Number(q('#zone').value));
    q('#retry-poker-image').hidden=!(needsPokerRetry.state==='ready'&&needsPokerRetry.type==='regc'&&pokerTarget(r,Number(q('#zone').value))&&!['queued','running'].includes(r.pokerDetail?.state)&&r.pokerDetail?.state==='error');
    q('#poker-image-status').textContent=r.pokerDetail?.state==='error'?'Gambar detail poker belum tersedia: '+r.pokerDetail.error:['queued','running'].includes(r.pokerDetail?.state)?'Menyiapkan gambar kedua dari tab baru…':r.done&&pokerTarget(r,Number(q('#zone').value))&&!r.pokerDetail?'IDN Poker terdeteksi. Gambar detail belum diambil; tekan tombol di bawah.':'';
    q('#history-trans-status').textContent=r.historyTransDetail?.state==='error'?'History trans gagal: '+r.historyTransDetail.error:['queued','running'].includes(r.historyTransDetail?.state)?'Mengecek history_trans: '+(GM_getValue(HISTORY_TAB_PROGRESS,null)?.jobId===r.id?(GM_getValue(HISTORY_TAB_PROGRESS,null)?.phase||'menunggu tab'):'menunggu tab')+'…':r.historyTransDetail?.proof?.state==='matched'?('Perhitungan saldo sesuai. '+r.historyTransDetail.proof.steps.length+' mutasi setelah jam REGC telah dihitung. '+(r.historyTransDetail.captureMode==='table-image'?'Gambar tabel history siap.':r.historyTransDetail.captureError?'Gambar tabel history akan dibuat dari data yang diverifikasi.':'Screenshot history siap.')):
      r.historyTransDetail?.state==='ready'?'History trans telah diperiksa, tetapi saldo belum dapat dipastikan.':'';
    q('#delivery').hidden=true;
    const checked=(r.regions||[]).filter(x=>SOURCES.includes(x.label)&&!x.error&&!x.partial&&!x.invalid).length;
    const errors=(r.regions||[]).filter(x=>x.error||x.partial||x.invalid);
    // Keep core REGC discovery visible for every ID, even while the *new*
    // balance/history verification is pending. The selected row here is only
    // a preview; it NEVER authorizes images or reply text.
    const selected=chosen(r);
    status(`${r.user}\n${decision.state!=='ready'?decision.message:r.message||''}${r.manual?'\nSumber: tabel yang sedang tampil di REGC':`\nSumber terbaca: ${checked}/12 (9 region + 3 laporan)`}${r.period?'\nPeriode: '+r.period:''}${errors.length?'\nKendala: '+errors[0].label+' — '+(errors[0].error||errors[0].warning||'Ada timestamp belum dikenali'):''}`);
    q('#bar').style.width=(r.manual?100:checked/12*100)+'%';
    q('#result-region').hidden=true;
    q('#results').replaceChildren();
    q('#reply').value='';
    if(decision.state!=='ready'){
      // This is the original 9-region + MPS + SportGG + Net22 search output.
      // Hide only final artifacts, not the search results themselves.
      revokeImage();imageAttempt='';q('#image-feedback').textContent='Gambar menunggu verifikasi saldo selesai.';
      const note=document.createElement('p');
      note.textContent=decision.message+'  •  Gambar dan balasan belum dibuat.';
      q('#results').append(note);
      if(selected){
        const summary=document.createElement('p');
        summary.textContent='Hasil REGC sementara untuk '+r.user+' · '+selected.label+
          ' (3 transaksi terbaru; belum menjadi keputusan akhir).';
        q('#results').append(summary);
        for(const [i,row] of selected.rows.slice(0,3).entries()){
          const card=document.createElement('div');card.className='card';
          const title=document.createElement('b');
          title.textContent=(i+1)+'. '+selected.label+' · hasil pencarian sementara';card.append(title);
          const dl=document.createElement('dl');
          for(const [label,value] of displayFields(row)){
            const dt=document.createElement('dt'),dd=document.createElement('dd');
            dt.textContent=label;dd.textContent=value||'Tidak tersedia';dl.append(dt,dd);
          }
          card.append(dl);q('#results').append(card);
        }
      }else{
        const empty=document.createElement('p');
        empty.textContent=r.done?'Belum ada transaksi yang dapat dibaca untuk '+r.user+
          '. Periksa daftar sumber dan kesalahan di bawah.':'Mencari '+r.user+
          ' di seluruh 9 region, MPS, SportGG, dan Net22…';
        q('#results').append(empty);
      }
      if(errors.length){
        const d=document.createElement('details'),summary=document.createElement('summary');
        summary.textContent='Rincian '+errors.length+' sumber belum terverifikasi';d.append(summary);
        for(const x of errors){const p=document.createElement('p');
          p.textContent=x.label+': '+(x.error||x.warning||'Timestamp belum dikenali');d.append(p);}
        q('#results').append(d);
      }
      return;
    }
    if(!selected){const p=document.createElement('p');p.textContent=!r.done?'Sedang memeriksa 9 region, MPS, SportGG, dan Net22. Tiga transaksi terbaru tampil setelah semua sumber diperiksa.':'Belum bisa menentukan region terakhir. Lihat kendala pembacaan di atas.';q('#results').append(p);}
    else {const p=document.createElement('p'),e=lastEvidence(r,Number(q('#zone').value));
      p.textContent=(checked===12&&!r.manual?'Terakhir menurut jam: ':'Hasil sementara menurut jam: ')+
        (e?.type==='history'?e.label+' (history_trans.php, '+e.date+')':(e?.label||selected.label)+' ('+selected.label+')');
      q('#results').append(p);}
    if(selected&&decision.state==='ready'){q('#delivery').hidden=false;q('#reply').value=replyForResult(r,selected);}
    if(decision.type==='history'){
      // Show ONLY the proven later game from AGWL2, not a misleading older REGC game list.
      const h=r.historyTransDetail.proof.latestGame,card=document.createElement('div');card.className='card';
      const title=document.createElement('b');title.textContent='Permainan terakhir · history_trans';card.append(title);
      const dl=document.createElement('dl');
      for(const [label,value] of [['Tanggal',h.date],['Keterangan',h.keterangan],['Debet',h.debet],['Saldo',h.saldo]]){
        const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value||'Tidak tersedia';dl.append(dt,dd);
      }
      card.append(dl);q('#results').append(card);
    }else if(selected) for(const [i,row] of selected.rows.slice(0,3).entries()){
      const card=document.createElement('div');card.className='card';
      const title=document.createElement('b');title.textContent=`${i+1}. ${selected.label} · transaksi terbaru`;card.append(title);
      const dl=document.createElement('dl');for(const [label,value] of displayFields(row)){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value||'Tidak tersedia';dl.append(dt,dd);}card.append(dl);q('#results').append(card);
    }
    if(errors.length){const d=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Rincian kegagalan '+errors.length+' sumber';d.append(summary);for(const x of errors){const p=document.createElement('p');p.textContent=x.label+': '+(x.error||x.warning||'Timestamp belum dikenali');d.append(p);}q('#results').append(d);}
    if(selected&&r.done){const identity=imageKey(r);if(imageIdentity!==identity&&imageAttempt!==identity){imageAttempt=identity;Promise.resolve().then(ensureImageReady).catch(e=>{q('#image-feedback').textContent='Gambar belum tersedia: '+e.message;status('Gambar: '+e.message);});}}
  }
  function replyForResult(r,source){
    if(historyAfterRegc(r,Number(q('#zone').value))){
      const last=r.historyTransDetail.proof.latestGame;
      return 'Kami cek User ID Anda. Transaksi permainan terbaru yang tercatat adalah '+
        (last.game||last.keterangan)+' pada '+last.date+' (keterangan: '+last.keterangan+').';
    }
    return replyText(source);
  }
  function replyText(source){
    const row=source?.rows?.[0];if(!row)return '';
    const game=field(row,['game','gamename','permainan']),provider=field(row,['provider','gameprovider']);
    if(!game||!provider)return 'Nama game atau provider belum terbaca lengkap. Periksa rincian sebelum mengirim balasan.';
    return `Mohon maaf bosku, kami cekkan untuk user id Anda sudah bermain pada permainan ${game} pada provider ${provider}.`;
  }
  function dataURLToBlob(dataURL){
    const value=String(dataURL||'');
    const match=value.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
    if(!match)throw Error('Format data gambar tidak dikenali.');
    const mime=match[1]||'application/octet-stream';
    const encoded=match[3]||'';
    let bytes;
    if(match[2]){
      const binary=atob(encoded);
      bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    }else{
      const decoded=decodeURIComponent(encoded);
      bytes=new TextEncoder().encode(decoded);
    }
    return new Blob([bytes],{type:mime});
  }
  let imageURL=null,pokerImageURL=null,historyTransImageURL=null,imageIdentity='',imageAttempt='',imageBuildPromise=null;
  function revokeImage(){
    for(const url of new Set([historyTransImageURL,pokerImageURL,imageURL].filter(Boolean)))URL.revokeObjectURL(url);
    historyTransImageURL=null;pokerImageURL=null;imageURL=null;imageIdentity='';q('#image-links').replaceChildren();
  }
  async function ensureImageReady(){
    const verdict=deliveryDecision(lastResult,GM_getValue(ADMIN,null),Number(q('#zone').value));
    if(verdict.state!=='ready')throw Error(verdict.message||'Pemeriksaan saldo belum selesai.');
    if(imageURL&&imageIdentity===imageKey(lastResult)&&q('#image-links').querySelector('img'))return;
    if(imageBuildPromise)return imageBuildPromise;
    imageBuildPromise=(async()=>{
      q('#image-feedback').textContent='Mempersiapkan gambar bukti…';
      await makeImage();
      if(!imageURL||!q('#image-links').querySelector('img'))throw Error('Gambar tidak muncul di panel. Periksa data bukti.');
      q('#image-feedback').textContent=verdict.type==='history'?'Gambar history transaksi siap. Klik gambar untuk memperbesar.':'Gambar transaksi siap. Klik gambar untuk memperbesar.';
    })();
    try{return await imageBuildPromise;}
    finally{imageBuildPromise=null;}
  }
  q('#copy-reply').onclick=()=>{
    const approval=deliveryDecision(lastResult,GM_getValue(ADMIN,null),Number(q('#zone').value));
    if(approval.state!=='ready')return status(approval.message);
    const source=chosen(lastResult),row=source?.rows?.[0];
    if(approval.type==='regc'&&(!row||!field(row,['game','gamename','permainan'])))return status('Game REGC belum lengkap; balasan belum disalin.');
    GM_setClipboard(replyForResult(lastResult,source),'text');
  };
  async function makeImage(){
    const approval=deliveryDecision(lastResult,GM_getValue(ADMIN,null),Number(q('#zone').value));
    if(approval.state!=='ready')throw Error(approval.message);
    const source=chosen(lastResult);if(!source)throw Error('Belum ada hasil transaksi.');
    const snapshot=JSON.parse(JSON.stringify(lastResult)),identity=imageKey(snapshot);
    // A newer confirmed bet in history_trans replaces the REGC image. ONE image only.
    if(approval.type==='history'){
      revokeImage();await makeHistoryTransImage(snapshot,identity);
      if(!imageURL)throw Error('Screenshot history_trans belum berhasil dibuat.');
      imageIdentity=identity;return;
    }
    const rows=source.rows.slice(0,3),canvas=document.createElement('canvas');
    canvas.width=1463;const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('Browser tidak mendukung gambar canvas.');
    // Only transaction rows are inside the PNG; no title, summary, toolbar or agent text.
    const columns=[32,196,340,250,236,124,285];
    const wrap=(value,width)=>{
      ctx.font='13px Arial';const lines=[];let line='';
      for(const ch of String(value||'')){if(ch==='\n'||ctx.measureText(line+ch).width>width){lines.push(line);line=ch==='\n'?'':ch;}else line+=ch;}if(line)lines.push(line);return lines;
    };
    const cells=rows.map(row=>[
      [['›','#31a4ff']],
      [[field(row,['game','gamename','permainan']),'#174778'],[field(row,['provider','gameprovider']),'#a6afbf']],
      [[field(row,['roundid','round']),'#174778'],[field(row,['extid'])?'Ext. ID : '+field(row,['extid']):'','#a6afbf']],
      [[field(row,['user','userid','username','nickname','player','playername','playerid','account']),'#174778']],
      [[field(row,['timestamp','transactiontimestamp','datetime','transactiontime','transactiondate','time','date','waktu','tanggal']),'#174778']],
      [[field(row,['type','transactiontype']),/credit/i.test(field(row,['type','transactiontype']))?'#16b8b3':'#ff496f']],
      [[field(row,['amount']),'#174778'],[field(row,['balance'])?'Balance : '+field(row,['balance']):'','#a6afbf']]
    ].map((parts,i)=>parts.flatMap(([value,color])=>wrap(value,columns[i]-24).map(text=>({text,color})))));
    const heights=cells.map(row=>Math.max(64,Math.max(...row.map(lines=>lines.length))*19+24));
    canvas.height=heights.reduce((a,b)=>a+b,0)+2;
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
    let y=1;
    cells.forEach((row,index)=>{
      let x=0;ctx.strokeStyle='#e4eaf2';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();
      row.forEach((lines,col)=>{ctx.font=col===0?'bold 22px Arial':'13px Arial';lines.forEach((line,k)=>{
          ctx.fillStyle=line.color;
          const center=col===0||col===4||col===5;
          const baseline=center?y+heights[index]/2+4+k*19:y+24+k*19;
          if(col===5&&k===0){ctx.beginPath();ctx.arc(x+18,baseline-4,3,0,Math.PI*2);ctx.fill();ctx.fillText(line.text,x+27,baseline);}
          else ctx.fillText(line.text,x+(col===0?14:14),baseline);
        });
        // Below the User ID stays solid white. No hidden agent text is drawn into the image.
        if(col===3){const maskTop=Math.max(30,lines.length*19+10);ctx.fillStyle='#ffffff';ctx.fillRect(x+8,y+maskTop,columns[col]-16,Math.max(0,heights[index]-maskTop-2));}
        x+=columns[col];
      });y+=heights[index];
    });
    ctx.strokeStyle='#e4eaf2';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error('Gambar tidak berhasil dibuat.');
    if(!lastResult||imageKey(lastResult)!==identity)throw Error('Transaksi sudah berubah; gambar lama tidak digunakan.');
    revokeImage();imageURL=URL.createObjectURL(blob);imageIdentity=identity;
    const open=document.createElement('a');open.href=imageURL;open.target='_blank';open.rel='noopener';open.textContent='Buka gambar hasil';open.style.color='#77dfd1';
    const download=document.createElement('a');download.href=imageURL;download.download='Jejak_Main_'+snapshot.user.replace(/[^a-z0-9_-]/gi,'_')+'.png';download.textContent='Unduh PNG';download.style.cssText='color:#77dfd1;margin-left:14px';
    const note=document.createElement('p');note.className='muted';note.textContent='Untuk tautan gambar, ambil pratinjau ini melalui aplikasi Sleekshot.';
    const heading=document.createElement('div');heading.className='image-heading';heading.textContent='Gambar transaksi';
    const badge=document.createElement('span');badge.textContent='PNG siap';heading.append(badge);
    const thumb=document.createElement('a');thumb.className='image-thumb';thumb.href=imageURL;thumb.target='_blank';thumb.rel='noopener';thumb.setAttribute('aria-label','Perbesar gambar transaksi');
    const preview=document.createElement('img');preview.src=imageURL;preview.alt='Pratinjau tiga transaksi terbaru, tanpa informasi agen';thumb.append(preview);
    const hint=document.createElement('div');hint.className='image-hint';hint.textContent='Klik gambar untuk melihat ukuran penuh.';
    const actions=document.createElement('div');actions.className='image-actions';open.textContent='Perbesar gambar';actions.append(open,download);
    q('#image-links').append(heading,thumb,hint,actions,note);
    // Exactly TWO images only if the latest verified game is IDN Poker.
    if(isPokerRow(source.rows[0])){
      try{await makePokerImage(snapshot,identity);}
      catch(e){revokeImage();throw e;} // Never leave the first image alone when two are required.
    }
  }
  async function makePokerImage(snapshot,identity){
    const data=snapshot.pokerDetail.data;
    const captured=GM_getValue(POKER_IMAGE,null);
    if(data.imageToken&&captured?.token===data.imageToken&&captured.id===snapshot.id&&captured.dataURL?.startsWith('data:image/')){
      if(!lastResult||imageKey(lastResult)!==identity)return;
      const binary=dataURLToBlob(captured.dataURL);
      if(pokerImageURL)URL.revokeObjectURL(pokerImageURL);
      pokerImageURL=URL.createObjectURL(binary);
      const heading=document.createElement('div');heading.className='image-heading';heading.textContent='Gambar 2 · Screenshot asli Detail IDN Poker';
      const thumb=document.createElement('a');thumb.className='image-thumb';thumb.href=pokerImageURL;thumb.target='_blank';thumb.rel='noopener';
      const img=document.createElement('img');img.src=pokerImageURL;img.alt='Screenshot asli dari halaman Detail IDN Poker di tab baru';thumb.append(img);
      const actions=document.createElement('div');actions.className='image-actions';
      const open=document.createElement('a');open.href=pokerImageURL;open.target='_blank';open.rel='noopener';open.textContent='Perbesar gambar detail';
      const download=document.createElement('a');download.href=pokerImageURL;
      download.download='Jejak_Main_'+snapshot.user.replace(/[^a-z0-9_-]/gi,'_')+'_IDN_Poker_Tab_Detail.'+(captured.format||'png');
      download.textContent='Unduh screenshot Detail';actions.append(open,download);
      const note=document.createElement('p');note.className='muted';note.textContent='Gambar diambil dari tampilan halaman Detail pada tab baru REGC.';
      q('#image-links').append(heading,thumb,actions,note);
      return;
    }
    throw Error('Gambar asli tab Detail belum tersedia. '+(data.captureError||'Periksa izin tab atau pemuatan html2canvas.'));
  }
  async function makeHistoryTransImage(snapshot,identity){
    const data=snapshot.historyTransDetail?.data;
    if(!data?.headers?.length||!data?.rows?.length)throw Error('Data history_trans belum lengkap.');
    let capture=GM_getValue(HISTORY_TRANS_IMAGE,null);
    if(!capture||capture.id!==snapshot.id||norm(capture.user)!==norm(snapshot.user)||
       !capture.dataURL?.startsWith('data:image/')){
      // Only draw from VERIFIED AGWL2 rows. Distinguish this graphic from a
      // screenshot; do not invent rows, values, or claim the image is original.
      const proof=reconcileHistoryLedger(snapshot,GM_getValue(ADMIN,null),Number(q('#zone').value),data);
      if(proof.state!=='matched'||!proof.latestGame)
        throw Error('Gambar history ditahan: Debet/Kredit belum membuktikan saldo cocok. '+(proof.message||''));
      capture=historyTransTableImage(data,proof,snapshot.user);
    }
    const blob=dataURLToBlob(capture.dataURL);
    if(!lastResult||imageKey(lastResult)!==identity)return;
    if(historyTransImageURL)URL.revokeObjectURL(historyTransImageURL);
    historyTransImageURL=URL.createObjectURL(blob);
    imageURL=historyTransImageURL;
    const heading=document.createElement('div');heading.className='image-heading';
    const last=snapshot.historyTransDetail.proof?.latestGame;
    heading.textContent='Gambar transaksi · '+(last?.game||'Permainan terakhir')+' · '+(last?.date||'');
    const thumb=document.createElement('a');thumb.className='image-thumb';thumb.href=historyTransImageURL;
    thumb.target='_blank';thumb.rel='noopener';const img=document.createElement('img');
    img.src=historyTransImageURL;img.alt=capture.mode==='table-image'?'Gambar tabel dari data history_trans yang diverifikasi':'Screenshot asli dari history_trans.php';thumb.append(img);
    const actions=document.createElement('div');actions.className='image-actions';
    const open=document.createElement('a');open.href=historyTransImageURL;open.target='_blank';open.rel='noopener';open.textContent='Perbesar gambar';
    const download=document.createElement('a');download.href=historyTransImageURL;
    download.download='Jejak_Main_'+snapshot.user.replace(/[^a-z0-9_-]/gi,'_')+'_History_Trans.'+(capture.format||'png');
    download.textContent=capture.mode==='table-image'?'Unduh gambar tabel':'Unduh screenshot';actions.append(open,download);
    const note=document.createElement('p');note.className='muted';
    note.textContent=capture.mode==='table-image'?'Gambar disusun dari tabel history_trans yang dibaca langsung, karena screenshot halaman tidak tersedia.':'Screenshot asli dari hasil history_trans.php.';
    q('#image-links').append(heading,thumb,actions,note);
  }
  let previewOverlay=null;
  q('#sleek-preview').onclick=async()=>{
    const button=q('#sleek-preview'),oldText=button.textContent;
    button.disabled=true;button.textContent='Membuat gambar…';
    try{
      await ensureImageReady();
      if(!imageURL)throw Error('Gambar utama belum tersedia untuk Sleekshot.');
      if(previewOverlay)previewOverlay.remove();
      previewOverlay=document.createElement('div');
      previewOverlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#171b22;overflow:auto;';
      const root=previewOverlay.attachShadow({mode:'closed'});
      root.innerHTML='<style>*{box-sizing:border-box}main{font:14px system-ui;color:#edf1f5;padding:22px;max-width:1540px;margin:auto}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}h2{margin:0;font-size:20px}p{color:#c2d4dc;line-height:1.7}button,a{background:#674e4e;color:white;border:0;border-radius:9px;padding:10px 14px;cursor:pointer;text-decoration:none;display:inline-block}img{display:block;max-width:100%;height:auto;background:white;box-shadow:0 8px 32px #0006;border-radius:4px;margin:10px 0 22px}small{display:block;color:#c2d4dc;margin-top:7px}section{margin:20px 0 28px}</style><main><header><h2>Gambar bukti untuk Sleekshot</h2><button type="button">Tutup</button></header><p>Gambar hasil pemeriksaan ada di bawah. Untuk Sleekshot, tekan <b>PrtSc</b> pada gambar atau simpan PNG/JPG langsung. Browser tidak mengunggah gambar otomatis ke Sleekshot.</p><div id="evidence"></div></main>';
      const container=root.querySelector('#evidence');
      const readyImages=[{label:'Gambar transaksi',url:imageURL,filename:'Jejak_Main_'+lastResult.user+'_Transaksi.png'}];
      if(pokerImageURL)readyImages.push({label:'Gambar 2 · Detail IDN Poker',url:pokerImageURL,filename:'Jejak_Main_'+lastResult.user+'_Poker_Detail.png'});
      for(const item of readyImages){
        const section=document.createElement('section'),title=document.createElement('h2'),img=document.createElement('img'),save=document.createElement('a');
        title.textContent=item.label;img.src=item.url;img.alt=item.label;
        save.href=item.url;save.download=item.filename;save.textContent='Simpan gambar';
        section.append(title,img,save);container.append(section);
      }
      root.querySelector('button').onclick=()=>{previewOverlay?.remove();previewOverlay=null;};
      document.body.append(previewOverlay);
    }catch(e){
      const msg='Gambar Sleekshot belum bisa dibuka: '+(e.message||e);
      q('#image-feedback').textContent=msg;
      status(msg);
    }finally{button.disabled=false;button.textContent=oldText;}
  };
  q('#make-image').onclick=()=>{revokeImage();imageAttempt='';ensureImageReady().catch(e=>{q('#image-feedback').textContent='Gambar gagal: '+e.message;status(e.message);});};
  if(isRegc){
    let refreshStart=Date.now();
    setInterval(()=>{
      if(typeof previewOverlay!=='undefined'&&previewOverlay){refreshStart=Date.now();q('#refresh-info').textContent='Refresh dijeda selama pratinjau Sleekshot terbuka.';return;}
      const remaining=Math.max(0,300000-(Date.now()-refreshStart));
      const job=live(),result=GM_getValue(OUT,null),busy=job&&active(job)&&(!(result?.id===job.id&&result.done)||['queued','running'].includes(result?.balanceRetry?.state)||['queued','running'].includes(result?.pokerDetail?.state)||['queued','running'].includes(result?.historyTransDetail?.state));
      const login=all('input[type="password"]').some(visible);
      q('#refresh-info').textContent=busy?'Refresh 5 menit: menunggu pencarian selesai.':login?'Refresh dijeda pada halaman login.':'Refresh REGC: '+Math.ceil(remaining/1000)+' detik';
      if(!remaining&&!busy&&!login)location.reload();
    },1000);
  }
  q('#capture').onclick=()=>{
    if(!isRegc){status('Tekan Ambil 3 di REGC pada bubble di tab REGC setelah tabel member tampil. Hasil akan dikirim ke bubble ChatGacor.');q('#open-regc').click();return;}
    try {
      const current=live();
      const verdict=deliveryDecision(lastResult,GM_getValue(ADMIN,null),Number(q('#zone').value));
      if(verdict.state!=='ready')throw Error('Ambil bukti hanya setelah saldo dan history selesai diperiksa: '+verdict.message);
      const user=norm(q('#uid').value||nickname()?.value||current?.user);
      if(!user)throw Error('Isi User ID member di bubble atau kolom nickname REGC.');
      const t=table();if(!t)throw Error('Tabel belum ditemukan. Buka Pengaturan → Kenali tabel, lalu klik tabel transaksi.');
      if(loading())throw Error('Tabel masih memuat data. Tunggu sebentar lalu ulangi.');
      const captured=readRows(t,{user}),rows=sortRows(captured,Number(q('#zone').value)).slice(0,3);
      const balanceIndex=captured.map(row=>({amount:money(rowBalance(row)),row})).filter(x=>x.amount!==null);
      if(!rows.length)throw Error('Tidak ada baris transaksi untuk member ini pada halaman yang tampil.');
      const id=current?.id||crypto.randomUUID();viewId=id;chosenRegion='';
      const label=selectedLabel()||'Region pada halaman REGC';
      const r={id,user,updated:Date.now(),done:true,manual:true,message:`${rows.length} transaksi teratas berhasil diambil.`,period:(dateControl()?.value||txt(dateControl())||'Mengikuti tampilan REGC'),regions:[{label,rows,transactionCount:captured.length,balanceCount:balanceIndex.length,balanceIndex,scope:'visible-page'}]};
      GM_setValue(OUT,r);render(r);
    }catch(e){status(e.message);}
  };
  setInterval(()=>{if(lastResult && q('#panel').style.display==='block')render(lastResult);},15000);
  GM_addValueChangeListener(ADMIN,()=>{if(lastResult)render(lastResult);setTimeout(closeFinishedTabs,500);});
  GM_addValueChangeListener(OUT,(_k,_old,value)=>{render(value);setTimeout(closeFinishedTabs,500);});
  const saved=GM_getValue(OUT,null);if(saved && Date.now()-saved.updated<60*60*1000) {viewId=saved.id;render(saved);}
  q('#uid').addEventListener('input',e=>{e.target.value=e.target.value.toLowerCase();});
  q('#stop').onclick=()=>{const j=live();if(j) GM_setValue(JOB,{...j,cancel:true});closeHistoryOwnedTab('cancelled');closeFinishedTabs();status('Pencarian dihentikan. Hasil yang sudah diperiksa tetap terlihat.');};
  q('#clear').onclick=()=>{revokeImage();q('#delivery').hidden=true;q('#stop').click();GM_setValue(OUT,null);lastResult=null;viewId=null;q('#uid').value='';q('#results').replaceChildren();q('#activity').replaceChildren();q('#balance-info').replaceChildren();q('#poker-image-status').textContent='';q('#history-trans-status').textContent='';q('#image-feedback').textContent='';q('#retry-poker-image').hidden=true;GM_setValue(ADMIN,null);GM_setValue(PREFIX+'sleek-link',null);status('Hasil dihapus.');};
  q('#copy').onclick=()=>{
    if(!lastResult)return status('Belum ada hasil.');
    const verdict=deliveryDecision(lastResult,GM_getValue(ADMIN,null),Number(q('#zone').value));
    if(verdict.state!=='ready')return status(verdict.message);
    const source=chosen(lastResult);if(!source)return status('Belum ada baris transaksi terbaca.');
    if(verdict.type==='history'){
      const h=lastResult.historyTransDetail.proof.latestGame;
      GM_setClipboard([`Jejak Main | ${lastResult.user}`,'Sumber: history_trans.php',`Tanggal: ${h.date}`,`Keterangan: ${h.keterangan}`,`Debet: ${h.debet}`,`Saldo: ${h.saldo}`].join('\n'),'text');
      return;
    }
    GM_setClipboard([`Jejak Main | ${lastResult.user}`,`Region / laporan: ${source.label}`,`Periode: ${lastResult.period||'mengikuti REGC'}`,...source.rows.slice(0,3).map((row,i)=>`Transaksi ${i+1}
`+displayFields(row).map(([k,v])=>`${k}: ${v||'Tidak tersedia'}`).join('\n'))].join('\n\n'),'text');
  };
  q('#start').onclick=()=>{

    if(isAdmin)return status('Mulai pencarian dari bubble ChatGacor atau REGC.');
    const user=norm(q('#uid').value);
    if(!user || /\s/.test(user)) return status('Isi satu User ID tanpa spasi.');
    const startDate=q('#date-start').value,endDate=q('#date-end').value;
    if(!validRange(startDate,endDate))return status('Isi tanggal awal dan akhir dengan benar; tanggal akhir tidak boleh lebih awal.');
    const previous=live(),previousResult=GM_getValue(OUT,{});
    if(previous&&active(previous)&&!previousResult?.done){
      // A *different* User ID is a new job, not a continuation of the last one.
      // Cancel the old worker before replacing JOB; previously this prevented
      // staff from searching the next member while one report was still busy.
      if(previous.user===user)
        return status('Pencarian '+user+' masih berjalan. Tunggu selesai atau tekan Stop.');
      GM_setValue(JOB,{...previous,cancel:true});
    }
    // If an earlier finished search still owns its history tab, clean it up
    // before beginning a new job. The next job has a new ID and claim.
    closeHistoryOwnedTab('replaced');
    const id=crypto.randomUUID();viewId=id;chosenRegion='';
    revokeImage();imageAttempt='';
    const j={id,user,startDate,endDate,offset:Number(q('#zone').value),created:Date.now(),cancel:false};
    // Isolate region checkpoint and every supplemental result by job ID.
    // The core REGC functions themselves are unchanged from the original.
    GM_setValue(PREFIX+'checkpoint',null);
    GM_setValue(JOB,j);GM_setValue(HISTORY_TAB_PROGRESS,null);GM_setValue(HISTORY_TRANS_IMAGE,null);GM_setValue(POKER_IMAGE,null);GM_setValue(OUT,{id,user,message:'Membuka tab REGC. Jika diminta, login di tab tersebut.',regions:[],updated:Date.now()});
    GM_setValue(ADMIN,{id:j.id,user:j.user,updated:Date.now(),state:'waiting',message:'Saldo dan History Bank akan diperiksa setelah pencarian permainan selesai.'});
    if(workerTab && !workerTab.closed) workerTab.close();
    if(adminTab && !adminTab.closed) adminTab.close();
    adminTab=null;adminJobId=null;
    const reportURL=new URL(GM_getValue(PREFIX+'reportURL','https://regc.idnlive.live/'));reportURL.hash='jejak-main='+id;
    workerJobId=j.id;
    workerTab=GM_openInTab(reportURL.href,{active:false,insert:true,setParent:true});
  };
  q('#uid').addEventListener('keydown',e=>{if(e.key==='Enter') q('#start').click();});

  function route(url=location.href){const u=new URL(url,location.href);return u.origin+u.pathname+u.search+(u.hash.startsWith('#jejak-main=')?'':u.hash);}
  function reportHeading(report){
    const names=[report.title,...report.aliases].map(norm);
    return all('h1,h2,h3,h4,.page-title,.breadcrumb li,.breadcrumb-item').filter(visible).some(el=>names.includes(norm(txt(el))));
  }
  async function openReport(j,report,state,save){
    controlScope=report.title;
    const ready=()=>!!nickname()&&!!dateControl();
    if(state.nav?.phase===state.phase&&state.nav.target&&route()===state.nav.target){
      if(await until(ready,j,20000))return;
    }
    if(reportHeading(report)&&ready())return;
    // Regions may have no heading; a region selector identifies that report.
    if(state.phase===0&&ready()&&(nativeServer()||customServer()))return;
    const menu=await until(()=>exact(report.menu),j,12000);
    let link=[report.title,...report.aliases].map(label=>exact(label)).find(Boolean);
    if(!link&&menu){menu.click();link=await until(()=>[report.title,...report.aliases].map(label=>exact(label)).find(Boolean),j,10000);}
    if(!link)throw Error('Menu '+report.menu+' → '+report.title+' tidak ditemukan.');
    const anchor=link.closest('a')||link.querySelector('a');
    const href=anchor?.getAttribute('href');
    let target=null;
    if(href&&!/^javascript:|^#$/i.test(href)){
      const url=new URL(href,location.href);if(url.origin===location.origin)target=route(url.href);
    }
    const previousTable=table(),previousField=nickname();
    // This checkpoint survives both full page navigation and in-page navigation.
    state.nav={phase:state.phase,target,attempts:(state.nav?.phase===state.phase?state.nav.attempts||0:0)+1};save();
    if(state.nav.attempts>3)throw Error('Halaman '+report.title+' belum siap setelah 3 percobaan navigasi.');
    link.click();
    const loaded=await until(()=>{
      if(!ready())return false;
      if(target&&route()===target)return true;
      if(reportHeading(report))return true;
      return !target&&table()!==previousTable&&nickname()!==previousField;
    },j,25000);
    if(!loaded)throw Error('Halaman '+report.title+' belum terverifikasi. Tidak membaca tabel laporan sebelumnya.');
    await sleep(180);
  }
  let working=false;
  async function work(j) {
    if(working)return;working=true;
    const stateKey=PREFIX+'checkpoint';
    const stored=GM_getValue(stateKey,null);
    const state=stored?.id===j.id?stored:{id:j.id,phase:0,regionIndex:0,results:[],nav:null};
    const save=()=>{check(j);GM_setValue(stateKey,state);};
    const record=item=>{const at=state.results.findIndex(x=>x.label===item.label);if(at<0)state.results.push(item);else state.results[at]=item;save();publish(j,{regions:state.results});};
    try {
      save();
      publish(j,{message:'Melanjutkan pemeriksaan 9 region + 3 laporan…',regions:state.results,done:false,startDate:j.startDate,endDate:j.endDate,offset:j.offset,period:j.startDate+' → '+j.endDate});
      while(state.phase<REPORTS.length){
        check(j);const report=REPORTS[state.phase];
        publish(j,{message:'Membuka '+report.menu+' → '+report.title+'…'});
        try {
          await openReport(j,report,state,save);
          // Set dates once per report, including Today; retain this checkpoint across page reloads.
          if(state.dateAppliedPhase!==state.phase){
            await applyDates(j);state.dateAppliedPhase=state.phase;save();
          }else if(!verifyRange(j)){
            throw Error('Tanggal reporting berubah setelah dimuat ulang. Mulai pencarian baru untuk mengatur tanggal kembali.');
          }
          if(state.phase===0){
            GM_setValue(PREFIX+'reportURL',location.origin+location.pathname+location.search);
            const found=await regions(j);
            for(let i=state.regionIndex;i<EXPECTED.length;i++){
              check(j);const label=EXPECTED[i];
              publish(j,{message:'Memeriksa '+label+' ('+(i+1)+'/9)…'});
              const item=found.find(x=>x.label.toUpperCase().replace(/\s+/g,' ').trim()===label);
              try {
                if(!item)throw Error('Region tidak ditemukan di Select Server.');
                await selectRegion(j,item);
                if(!selectedLabel().toUpperCase().includes(label))throw Error('Pilihan region belum cocok.');
                // Region switches only verify the date; never click the date or Apply again.
                if(!verifyRange(j))throw Error('Tanggal berubah saat pindah region. Hasil region ini tidak dibaca agar periodenya tidak salah.');
                record({label,...await collect(j,await search(j))});
              }catch(e){check(j);record({label,rows:[],error:e.message});}
              state.regionIndex=i+1;save();
            }
          }else{
            publish(j,{message:'Mencari '+j.user+' di '+report.title+'…'});
            record({label:report.title,...await collect(j,await search(j))});
          }
        }catch(e){
          check(j);
          const labels=state.phase===0?EXPECTED.slice(state.regionIndex):[report.title];
          for(const label of labels)record({label,rows:[],error:e.message});
        }
        state.phase++;state.nav=null;save();
      }
      const incomplete=SOURCES.some(label=>{const r=state.results.find(x=>x.label===label);return !r||r.error||r.partial||r.invalid;});
      publish(j,{regions:state.results,done:true,message:incomplete?'Pemeriksaan selesai sebagian. Ada sumber yang belum terverifikasi.':'Selesai: 9 region + MPS + SportGG + Net22. Tiga transaksi dari sumber terakhir bermain ditampilkan.'});
    }catch(e){publish(j,{regions:state.results,done:true,message:e.message});status(e.message);}
    finally{working=false;}
  }
  let retryWorking=false;
  async function runBalanceRetry(){
    const j=live(),r=GM_getValue(OUT,null),initial=r?.balanceRetry;
    if(!isRegc||retryWorking||working||!j||!active(j)||sessionStorage.getItem(PREFIX+'worker')!==j.id||r?.id!==j.id||!['queued','running'].includes(initial?.state))return;
    retryWorking=true;const state={...initial};
    const save=()=>{check(j);const current=GM_getValue(OUT,null);if(!['queued','running'].includes(current?.balanceRetry?.state))throw Error('Cek ulang sudah dihentikan.');publish(j,{balanceRetry:{...state}});};
    try{
      state.state='running';save();
      await openReport(j,REPORTS[state.phase],state,save);
      if(!state.dateApplied){if(!verifyRange(j))await applyDates(j);state.dateApplied=true;save();}
      if(state.phase===0){
        const choices=await regions(j),item=choices.find(x=>x.label.toUpperCase().replace(/\s+/g,' ').trim()===state.label);
        if(!item)throw Error('Region cek ulang tidak ditemukan.');await selectRegion(j,item);
        if(!selectedLabel().toUpperCase().includes(state.label))throw Error('Region cek ulang belum terpilih.');
      }
      if(!verifyRange(j))throw Error('Tanggal cek ulang belum sesuai.');
      publish(j,{message:'Membaca ulang transaksi REGC awal pada '+state.label+'…'});
      const refreshed={label:state.label,...await collect(j,await search(j))};
      // Pembacaan kedua JANGAN menimpa hasil 12 sumber yang ditemukan pertama.
      // Cocokkan User ID, waktu, game, nominal, dan Round ID transaksi awal.
      const secondRead=compareRegcReread(state.firstRead,refreshed,j.offset);
      check(j);
      const latest=GM_getValue(OUT,null);
      if(latest?.id!==j.id||latest.balanceRetry?.firstRead?.balance!==state.firstRead.balance)
        throw Error('Pencarian telah berganti; cek ulang saldo REGC lama dibatalkan.');
      const matched=secondRead.balance===money(state.admin.raw);
      publish(j,{balanceRetry:{...state,state:'done',matched,confirmed:true,secondRead},
        message:'REGC dicek 2 kali pada '+state.label+': Rp '+amountText(state.firstRead.balance)+
          ' → Rp '+amountText(secondRead.balance)+'. Saldo admin Rp '+amountText(money(state.admin.raw))+
          (matched?'. Sesuai.':'. Masih berbeda; lanjut history_trans.')});
    }catch(e){if(active(j)&&['queued','running'].includes(GM_getValue(OUT,null)?.balanceRetry?.state))publish(j,{balanceRetry:{...state,state:'error',error:e.message},message:'Cek ulang '+state.label+': '+e.message});}
    finally{retryWorking=false;}
  }
  let pokerWorking=false;
  async function runPokerDetail(){
    const j=live(),result=GM_getValue(OUT,null),initial=result?.pokerDetail;
    if(!isRegc||pokerWorking||retryWorking||working||!j||!active(j)||sessionStorage.getItem(PREFIX+'worker')!==j.id||result?.id!==j.id||!['queued','running'].includes(initial?.state))return;
    const verified=reconciliationDecision(result,GM_getValue(ADMIN,null),j.offset);
    if(verified.state!=='ready'||verified.type!=='regc')return;
    pokerWorking=true;const state={...initial};
    const save=()=>{check(j);if(!['queued','running'].includes(GM_getValue(OUT,null)?.pokerDetail?.state))throw Error('Pengambilan detail dihentikan.');publish(j,{pokerDetail:{...state}});};
    try{
      state.state='running';save();
      publish(j,{message:'IDN Poker: membuka Reporting MPS → Daily Transaction MPs…'});
      await openReport(j,REPORTS[1],state,save);
      if(!verifyRange(j))await applyDates(j);
      if(!verifyRange(j))throw Error('Tanggal MPS belum sesuai periode pencarian.');
      let t=await search(j),tr=null;
      // A report without the 100-row selector can still expose the target via pagination.
      try{t=await setHundredRows(j,t);}catch(e){
        check(j);publish(j,{message:'IDN Poker: pilihan 100 baris tidak tersedia; mencari transaksi melalui halaman tabel…'});
        t=table()||t;
      }
      for(let pass=0;pass<3&&!tr;pass++){
        // Pass 1: member + round + waktu + game. Pass 2: amount + waktu.
        // Pass 3: exact member + waktu + game, only if there is exactly one row.
        // MPS can use a different Round ID / amount representation.
        let candidateTable=t,matches=[];
        for(let pg=0;pg<30;pg++){
          check(j);
          for(const candidate of all('tbody tr',candidateTable).filter(visible)){
            if(candidate.classList.contains('child')||candidate.querySelector('th'))continue;
            try{
              const wrapper={querySelectorAll:sel=>sel==='tbody tr'?[candidate]:candidateTable.querySelectorAll(sel)};
              const parsed=readRows(wrapper,j);
              if(parsed.some(row=>samePokerRow(row,state.target,j.user,j.offset,pass)))matches.push(candidate);
            }catch{}
          }
          if(matches.length>=1)break;
          const next=nextButton();if(!next)break;
          candidateTable=await response(j,()=>next.click());
        }
        if(matches.length===1){tr=matches[0];if(!tr.isConnected){ // Return to first page and locate target again.
            t=await search(j);tr=null;continue;
          }break;}
        if(matches.length>1&&pass===2)throw Error('Ada '+matches.length+' transaksi IDN Poker pada waktu yang sama. Tidak memilih Detail dari transaksi lain.');
        if(pass<2){publish(j,{message:pass===0?'IDN Poker: mencocokkan waktu dan nominal ketika Round ID berbeda…':'IDN Poker: mencocokkan User ID + waktu secara unik tanpa nominal…'});t=await search(j);}
      }
      if(!tr)throw Error('Transaksi IDN Poker terbaru tidak ditemukan secara unik pada Reporting MPS.');
      tr.scrollIntoView?.({block:'center'});
      // Screenshot sequence: BLUE CHEVRON beside Game name > expanded "details" > blue Detail.
      // Never click a random Detail button before opening the correct member row.
      const buttons=await openPokerRowThenGetDetail(tr,j);
      if(buttons.length!==1)throw Error('Ada beberapa tombol Detail di sekitar transaksi; tidak memilih sembarang transaksi.');
      if(!buttons[0].isConnected||!visible(buttons[0]))throw Error('Tombol biru Detail di panel IDN Poker sudah hilang sebelum diklik.');
      publish(j,{message:'IDN Poker: langkah 2/2 — panel details sudah terbuka, klik tombol biru Detail…'});
      const data=await readPokerDetailClick(buttons[0],j);
      save();
      publish(j,{pokerDetail:{...state,state:'ready',data},message:data.imageToken?'Dua gambar siap: transaksi terakhir dan screenshot asli tab Detail IDN Poker.':'Detail Poker terbaca, tetapi screenshot asli tab belum tersedia.'});
    }catch(e){
      if(active(j)&&['queued','running'].includes(GM_getValue(OUT,null)?.pokerDetail?.state)){
        publish(j,{pokerDetail:{...state,state:'error',error:e.message},message:'Gambar utama tersedia; detail IDN Poker: '+e.message});
      }
    }finally{pokerWorking=false;}
  }
  GM_addValueChangeListener(OUT,()=>{if(isRegc){runBalanceRetry();runPokerDetail();}});


  // Heartbeat: the originating tab can distinguish a broken/missing worker from
  // a working worker whose form, redirect, or screenshot is still processing.
  function historyPhase(j,phase,extra={}){
    if(!j||!active(j))return;
    const old=GM_getValue(HISTORY_TAB_PROGRESS,null);
    GM_setValue(HISTORY_TAB_PROGRESS,{jobId:j.id,user:j.user,phase,at:Date.now(),
      startedAt:old?.jobId===j.id?old.startedAt:Date.now(),
      path:location.pathname,...extra});
  }
  function historyWorkerCanRun(j){
    if(!j||!active(j)||!isAdmin)return false;
    const claim=GM_getValue(HISTORY_TAB_CLAIM,null);
    const result=GM_getValue(OUT,null);
    return claim?.jobId===j.id&&result?.id===j.id&&
      ['queued','running'].includes(result?.historyTransDetail?.state)&&
      sessionStorage.getItem(HISTORY_TRANS_TOKEN)===j.id;
  }

  // AGWL2 history_trans.php: the search box is labeled precisely "User :".
  function historyTransControls(){
    const clean=x=>String(x||'').replace(/\s+/g,' ').trim();
    const inputs=all('input').filter(el=>visible(el)&&['text','search',''].includes(el.type)&&!el.disabled);
    const matches=inputs.filter(el=>{
      const attrs=[el.name,el.id,el.placeholder,el.getAttribute('aria-label'),
        ...(el.labels?[...el.labels].map(txt):[])].map(clean);
      if(attrs.some(v=>/^(user|userid|user id|username|user name|nickname|player id)\s*:?$/i.test(v)))return true;
      const row=el.closest('tr');
      if(row){
        const cs=[...row.children].filter(c=>['TD','TH'].includes(c.tagName));
        const at=cs.findIndex(c=>c.contains(el));
        if(at>0&&cs.slice(0,at).some(c=>/^user(?:\s*id)?\s*:?$/i.test(clean(txt(c)))))return true;
      }
      const parent=el.parentElement;
      if(parent){
        const previous=parent.previousElementSibling;
        if(previous&&/^user(?:\s*id)?\s*:?$/i.test(clean(txt(previous))))return true;
      }
      return false;
    });
    if(matches.length>1)throw Error('Ada beberapa kolom User. Pencarian otomatis dihentikan agar tidak salah mengisi.');
    const input=matches[0]||(inputs.length===1?inputs[0]:null);
    if(!input)throw Error('Input di samping label "User :" belum ditemukan secara unik.');
    const form=input.form||input.closest('form');
    let candidates=(form?all('button,input[type="submit"],input[type="button"]',form):
      all('button,input[type="submit"],input[type="button"]')).filter(el=>visible(el)&&
      /^submit$/i.test(clean(txt(el)||el.value)));
    if(candidates.length!==1){
      candidates=all('button,input[type="submit"],input[type="button"]',form||document).filter(el=>visible(el)&&
        /^(submit|search|cari)$/i.test(clean(txt(el)||el.value)));
    }
    if(candidates.length!==1)throw Error('Tombol Submit yang terhubung ke User belum ditemukan secara unik.');
    return {input,form,button:candidates[0]};
  }
  function findHistoryTable(doc){
    const cells=tr=>[...tr.children].filter(c=>['TD','TH'].includes(c.tagName));
    for(const t of all('table',doc)){
      for(const tr of all('tr',t)){
        const headings=cells(tr).map(c=>key(txt(c)));
        if(headings.includes('tanggal')&&headings.includes('keterangan')&&
          headings.includes('saldo')&&(headings.includes('debet')||headings.includes('debit'))){
          return t;
        }
      }
    }
    return null;
  }
  function parseHistoryTrans(doc,user,offset=420){
    const clean=v=>String(v||'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
    const id=clean(user).toLowerCase();
    // Confirm identity from the report heading; never present another member's bets.
    const main=clean(txt(doc.body||doc));
    const identity=main.match(/Transaksi\s+Pemain\s*:\s*([\w.\-]+)/i);
    if(!identity)throw Error('Judul Transaksi Pemain belum tampil. Menunggu hasil Submit untuk '+user+'.');
    if(identity[1].toLowerCase()!==id)throw Error('Halaman history_trans masih menampilkan User lain ('+identity[1]+').');
    const t=findHistoryTable(doc);
    if(!t)throw Error('Tabel history_trans: Tanggal, Keterangan, Debet, Saldo belum tampil.');
    const cells=tr=>[...tr.children].filter(el=>['TD','TH'].includes(el.tagName));
    const trs=all('tr',t).filter(tr=>tr.closest('table')===t);
    let hi=-1,headers=[];
    for(let i=0;i<trs.length;i++){
      const names=cells(trs[i]).map(c=>clean(txt(c)));
      const ks=names.map(key);
      if(ks.includes('tanggal')&&ks.includes('keterangan')&&ks.includes('saldo')){hi=i;headers=names;break;}
    }
    if(hi<0)throw Error('Header history_trans belum cocok.');
    const idx=k=>headers.findIndex(h=>key(h)===k);
    const iTanggal=idx('tanggal'),iKet=idx('keterangan'),iStatus=idx('status'),
      iDebet=idx('debet')>=0?idx('debet'):idx('debit'),iKredit=idx('kredit'),iSaldo=idx('saldo');
    const rows=[];let truncated=false;
    for(const tr of trs.slice(hi+1)){
      const vals=cells(tr).map(c=>clean(txt(c)));
      if(vals.length!==headers.length||!vals[iTanggal]||!vals[iKet])continue;
      const when=timestamp(vals[iTanggal],offset);
      if(!Number.isFinite(when))continue;
      rows.push({values:vals,time:when,keterangan:vals[iKet],status:iStatus>=0?vals[iStatus]:'',
        debet:iDebet>=0?vals[iDebet]:'',kredit:iKredit>=0?vals[iKredit]:'',saldo:iSaldo>=0?vals[iSaldo]:''});
      if(rows.length>=160){truncated=true;break;}
    }
    if(!rows.length)throw Error('Baris Tanggal dan Keterangan belum terbaca.');
    const playLike=row=>isHistoryBetRecord(row);
    const ordered=[...rows].sort((a,b)=>b.time-a.time);
    const selected=ordered.find(playLike)||null;
    const ket=selected?clean(selected.keterangan):'';
    const name=selected?parseHistoryGame(ket):'';
    const index=rows.findIndex(x=>x===selected);
    // "Lihat Transaksi Lama" means the visible table may not cover every
    // movement between REGC and the admin reading. Require an older anchor row.
    const hasOlderPages=/Lihat\s+Transaksi\s+Lama/i.test(txt(doc.body||doc));
    return {title:'Transaksi Pemain : '+user,headers,rows:rows.map(x=>x.values),truncated,hasOlderPages,
      entries:rows.map(x=>({date:x.values[iTanggal],keterangan:x.keterangan,status:x.status,
        debet:x.debet,kredit:x.kredit,saldo:x.saldo})),
      pickedIndex:index,pickedDate:selected?.values[iTanggal]||'',pickedTime:selected?.time??null,pickedNote:ket,
      pickedStatus:selected?.status||'',pickedGame:name,pickedDebet:selected?.debet||'',pickedSaldo:selected?.saldo||''};
  }
  // Fallback IMAGE built only from the verified AGWL2 table rows (never a
  // fabricated website screenshot). This ensures history evidence remains a
  // real PNG even if html2canvas fails, times out, or cannot load in a tab.
  // The UI explicitly labels this mode as "gambar tabel" rather than "screenshot asli".
  function historyTransTableImage(data,proof,user){
    if(!data?.headers?.length||!data?.rows?.length||proof?.state!=='matched')
      throw Error('Data history belum lengkap untuk membuat gambar tabel.');
    const headers=data.headers.map(String),rows=data.rows;
    const dateAt=headers.findIndex(h=>key(h)==='tanggal');
    const noteAt=headers.findIndex(h=>key(h)==='keterangan');
    if(dateAt<0||noteAt<0)throw Error('Kolom Tanggal/Keterangan tidak tersedia untuk gambar history.');
    const evidence=new Set((proof.steps||[]).map(s=>String(s.date).trim()+'|'+String(s.keterangan).trim()));
    const latest=proof.latestGame;
    const lastKey=latest?String(latest.date).trim()+'|'+String(latest.keterangan).trim():'';
    const selected=new Set();
    // Show the newest rows as on the website, plus supporting evidence outside
    // the first page if those rows were returned in the same verified result.
    for(let i=0;i<Math.min(22,rows.length);i++)selected.add(i);
    for(let i=0;i<rows.length;i++){
      const r=rows[i],k=String(r[dateAt]||'').trim()+'|'+String(r[noteAt]||'').trim();
      if(evidence.has(k)||k===lastKey)selected.add(i);
    }
    const indexes=[...selected].sort((a,b)=>a-b).slice(0,65);
    const widths=headers.map(h=>{
      const k=key(h);
      if(k==='no')return 54;
      if(k==='periode')return 170;
      if(k==='tanggal')return 216;
      if(k==='keterangan')return 440;
      if(k==='status')return 112;
      if(['debet','debit','kredit','saldo'].includes(k))return 122;
      if(k==='via')return 104;
      return 116;
    });
    const width=widths.reduce((a,b)=>a+b,0),canvas=document.createElement('canvas');
    const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('Canvas untuk gambar history_trans tidak tersedia.');
    const wrap=(value,w)=>{
      ctx.font='15px Arial';
      const parts=String(value??'').split(/\s+/),out=[];
      let line='';
      for(const word of parts){
        const candidate=line?line+' '+word:word;
        if(line&&ctx.measureText(candidate).width>w-12){out.push(line);line=word;}
        else line=candidate;
      }
      out.push(line);
      return out;
    };
    const layout=indexes.map(i=>{
      const values=rows[i];
      const contents=headers.map((_,j)=>wrap(values[j]??'',widths[j]));
      return {original:i,values,contents,height:Math.max(34,...contents.map(c=>c.length*19+10))};
    });
    const headerH=102,rowHeaderH=37,footH=66;
    canvas.width=width+24;
    canvas.height=headerH+rowHeaderH+layout.reduce((a,b)=>a+b.height,0)+footH;
    if(canvas.height>7200)throw Error('Tabel history terlalu panjang untuk satu gambar.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font='bold 20px Arial';ctx.fillStyle='#092e78';
    ctx.fillText('Transaksi Pemain : '+user,canvas.width/2,28);
    ctx.font='13px Arial';ctx.fillStyle='#4d5665';
    ctx.fillText('GAMBAR TABEL · data hasil history_trans.php (bukan screenshot asli)',canvas.width/2,52);
    ctx.fillText('Baris kuning: mutasi setelah waktu REGC | Garis oranye: permainan terakhir',canvas.width/2,74);
    let y=headerH,x=12;
    ctx.fillStyle='#f6e462';ctx.fillRect(x,y,width,rowHeaderH);
    headers.forEach((h,i)=>{
      ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(x,y,widths[i],rowHeaderH);
      ctx.font='bold 15px Arial';ctx.fillStyle='#080808';
      ctx.fillText(h,x+widths[i]/2,y+rowHeaderH/2);
      x+=widths[i];
    });
    y+=rowHeaderH;
    for(let n=0;n<layout.length;n++){
      const r=layout[n],k=String(r.values[dateAt]||'').trim()+'|'+String(r.values[noteAt]||'').trim();
      const highlighted=k===lastKey,matching=evidence.has(k);
      x=12;
      for(let c=0;c<headers.length;c++){
        ctx.fillStyle=highlighted?'#ffe6a3':matching?'#fff4be':(n%2===0?'#e8e8e8':'#ffdfbf');
        ctx.fillRect(x,y,widths[c],r.height);
        ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(x,y,widths[c],r.height);
        const lines=r.contents[c];ctx.font='15px Arial';
        const centered=!['keterangan','periode','tanggal'].includes(key(headers[c]));
        ctx.textAlign=centered?'center':'left';ctx.textBaseline='middle';
        const raw=String(r.values[c]||'');
        ctx.fillStyle=key(headers[c])==='keterangan'?'#0644e8':
          /deposit/i.test(raw)?'#bc1c20':'#151515';
        lines.forEach((line,li)=>ctx.fillText(line,centered?x+widths[c]/2:x+6,
          y+10+(li+.5)*19));
        x+=widths[c];
      }
      if(highlighted){ctx.strokeStyle='#d37e0a';ctx.lineWidth=3;
        ctx.strokeRect(12+1,y+1,width-2,r.height-2);}
      y+=r.height;
    }
    ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#203044';
    ctx.font='bold 14px Arial';
    ctx.fillText('Saldo REGC: Rp '+amountText(proof.regcBalance)+'   − Debet: Rp '+amountText(proof.debetTotal)+
      '   + Kredit: Rp '+amountText(proof.kreditTotal)+'   = Rp '+amountText(proof.computedBalance),18,y+28);
    ctx.font='12px Arial';ctx.fillStyle='#526276';
    ctx.fillText('Hanya data tabel AGWL2 untuk User ID terverifikasi '+user+' yang digambarkan.',18,y+50);
    let dataURL=canvas.toDataURL('image/png'),format='png';
    if(dataURL.length>1350000){dataURL=canvas.toDataURL('image/jpeg',.82);format='jpg';}
    if(dataURL.length>1750000){
      const small=document.createElement('canvas'),ratio=Math.sqrt(1300000/dataURL.length);
      small.width=Math.round(canvas.width*ratio);small.height=Math.round(canvas.height*ratio);
      small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
      dataURL=small.toDataURL('image/jpeg',.77);format='jpg';
    }
    if(dataURL.length>1900000)throw Error('Gambar history terlalu besar untuk dikirim ke bubble.');
    return {dataURL,format,mode:'table-image'};
  }

  async function captureHistoryTransScreenshot(selected,proof){
    if(typeof html2canvas!=='function')throw Error('html2canvas belum tersedia di AGWL2.');
    const tableEl=findHistoryTable(document);
    if(!tableEl)throw Error('Tabel untuk screenshot history_trans belum terlihat.');
    const body=document.body;
    const compact=body&&body.scrollWidth<=2600&&body.scrollHeight<=1600&&
      /Transaksi\s+Pemain/i.test(txt(body).slice(0,500));
    const region=compact?body:(tableEl.closest('.table-responsive,.content-wrapper,.container')||tableEl);
    const host=document.getElementById('jejak-main-isolated-v1'),prev=host?.style.display;
    if(host)host.style.display='none';
    try{
      await Promise.race([document.fonts?.ready||Promise.resolve(),sleep(1600)]);
      const width=Math.min(Math.max(region.scrollWidth||region.clientWidth,600),2400);
      const height=Math.min(Math.max(region.scrollHeight||region.clientHeight,150),7500);
      const scale=Math.max(.5,Math.min(1.35,1800/width,6500/height));
      const tableMark='jm-hist-'+Date.now();
      tableEl.setAttribute('data-jejak-capture',tableMark);
      let canvas;
      try{
        canvas=await html2canvas(region,{backgroundColor:'#fff',useCORS:true,logging:false,
          width,height,scale,windowWidth:Math.max(document.documentElement.clientWidth,width),
          onclone:cloneDoc=>{
            const cloneTable=cloneDoc.querySelector('[data-jejak-capture="'+tableMark+'"]');
            if(!cloneTable)return;
            const last=proof?.latestGame||null;
            const keys=new Set((proof?.steps||[]).map(s=>s.date+'|'+s.keterangan));
            for(const tr of cloneTable.querySelectorAll('tr')){
              const cells=[...tr.children].filter(c=>['TD','TH'].includes(c.tagName))
                .map(c=>c.textContent.replace(/\s+/g,' ').trim());
              const date=cells.find(c=>/^\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}/.test(c));
              const note=cells.find(c=>c===last?.keterangan||
                (proof?.steps||[]).some(s=>c===s.keterangan));
              if(!date||!note||!keys.has(date+'|'+note))continue;
              const highlighted=last&&date===last.date&&note===last.keterangan;
              if(highlighted){tr.style.outline='3px solid #c57800';tr.style.outlineOffset='-3px';}
              [...tr.children].forEach(cell=>{cell.style.backgroundColor=highlighted?'#fff1ae':'#f4f9c4';});
            }
          }
        });
      }finally{tableEl.removeAttribute('data-jejak-capture');}
      let dataURL=canvas.toDataURL('image/png'),format='png';
      if(dataURL.length>1350000){dataURL=canvas.toDataURL('image/jpeg',.86);format='jpg';}
      if(dataURL.length>1550000){
        const down=document.createElement('canvas'),ratio=Math.min(.8,Math.sqrt(1250000/dataURL.length));
        down.width=Math.max(400,Math.floor(canvas.width*ratio));down.height=Math.max(200,Math.floor(canvas.height*ratio));
        down.getContext('2d').drawImage(canvas,0,0,down.width,down.height);
        dataURL=down.toDataURL('image/jpeg',.76);format='jpg';
      }
      if(dataURL.length>1900000)throw Error('Tangkapan history_trans terlalu besar untuk penyimpanan antartab.');
      return {dataURL,format};
    }finally{if(host)host.style.display=prev||'';}
  }
  // An in-memory mutex protects against duplicate runs on this document.
  // Unlike sessionStorage it resets automatically when Submit navigates.
  let historyWorkerInProgress=false;
  // The actual AGWL2 submit may navigate to another path. The checkpoint is
  // retained in sessionStorage (same tab + same origin) across that navigation.
  // Never click Submit twice for the same job.
  async function readHistoryTransPage(j){
    const submitKey=HISTORY_TRANS_TOKEN+':submitted:'+j.id;
    if(historyWorkerInProgress)return;
    historyWorkerInProgress=true;
    const put=state=>{if(active(j))publish(j,{historyTransDetail:state});};
    const started=Date.now();
    const existing=GM_getValue(OUT,null)?.historyTransDetail||{};
    let submitDone=!!sessionStorage.getItem(submitKey);
    let originalFormTarget=null,originalButtonTarget=null,form=null,button=null;
    let enforceSelf=null,restoreSubmit=null;
    try{
      check(j);
      historyPhase(j,'worker-started');
      if(all('input[type="password"]').some(visible)){
        throw Error('Halaman AGWL2 meminta login. Buka AGWL2 dan login dahulu.');
      }
      const isLogin=/(?:login|signin|auth|index)\.php$/i.test(location.pathname)&&
        !/Transaksi\s+Pemain/i.test(txt(document.body));
      if(submitDone&&isLogin)throw Error('Setelah Submit, AGWL2 mengarahkan tab history ke halaman login. Login ulang diperlukan.');
      put({state:'running',started:existing.started||started,
        message:submitDone?'Membaca halaman hasil Submit…':'Menyiapkan kolom User dan tombol Submit…'});
      if(!submitDone){
        // If there is already a complete history for this member, do not
        // click Submit again (for example if the site restored its last query).
        let loaded=null;
        try{loaded=parseHistoryTrans(document,j.user,j.offset);}catch{}
        if(!loaded){
          let controls=null,lastError='';
          const deadline=Date.now()+18000;
          while(Date.now()<deadline){
            check(j);
            if(all('input[type="password"]').some(visible))throw Error('AGWL2 meminta login sebelum Submit.');
            try{controls=historyTransControls();break;}
            catch(e){lastError=e.message;}
            await sleep(300);
          }
          if(!controls)throw Error('Kolom User / tombol Submit tidak ditemukan: '+lastError+' (halaman: '+location.pathname+').');
          const {input}=controls;button=controls.button;form=controls.form;
          inputValue(input,j.user);
          if(norm(input.value)!==norm(j.user))throw Error('User ID gagal dimasukkan ke kolom User.');
          historyPhase(j,'user-filled',{formAction:form?.getAttribute('action')||'',formMethod:form?.method||''});
          // Prevent target=_blank, formtarget=_blank and JS assigning target
          // during submit from creating a second tab. Keep the site's genuine
          // submit handler, search fields, cookies and CSRF tokens intact.
          if(form){
            originalFormTarget=form.getAttribute('target');
            form.setAttribute('target','_self');
            enforceSelf=e=>{if(e.target===form){form.setAttribute('target','_self');
              if(button)button.setAttribute('formtarget','_self');}};
            form.addEventListener('submit',enforceSelf,true);
            // Legacy AGWL2 forms sometimes call form.submit() directly,
            // bypassing the normal 'submit' event. Retarget that one form at
            // call time, while preserving the original submit implementation.
            const win=typeof unsafeWindow!=='undefined'?unsafeWindow:window;
            const proto=win.HTMLFormElement?.prototype;
            const nativeSubmit=proto?.submit;
            if(proto&&typeof nativeSubmit==='function'){
              try{
                const proxy=function(){
                  if(this===form)this.setAttribute('target','_self');
                  return nativeSubmit.call(this);
                };
                proto.submit=proxy;
                if(proto.submit===proxy)restoreSubmit=()=>{
                  if(proto.submit===proxy)proto.submit=nativeSubmit;
                };
              }catch{} // Don't block normal form submit on hardened browsers.
            }
          }
          originalButtonTarget=button.getAttribute('formtarget');
          button.setAttribute('formtarget','_self');
          // Persist before click to survive normal POST navigation or redirect.
          sessionStorage.setItem(submitKey,String(Date.now()));
          submitDone=true;
          historyPhase(j,'submit-clicked');
          button.click();
          // Form navigation may unload the worker; the new document will
          // resume below without clicking Submit again.
        }
      }
      let data=null,lastError='',lastLog='';
      const start=Date.now();
      while(Date.now()-start<45000){
        check(j);
        if(all('input[type="password"]').some(visible))
          throw Error('AGWL2 kembali ke halaman login setelah Submit. Login ulang diperlukan.');
        try{data=parseHistoryTrans(document,j.user,j.offset);break;}
        catch(e){lastError=e.message;}
        if(Date.now()-start>4000&&Date.now()-start<4500)historyPhase(j,'waiting-result',{lastError});
        if(lastError!==lastLog&&Date.now()-start>12000){
          historyPhase(j,'waiting-result',{lastError});lastLog=lastError;
        }
        await sleep(300);
      }
      if(!data)throw Error('Hasil Submit tidak muncul pada '+location.pathname+': '+lastError);
      historyPhase(j,'report-read',{rows:data.entries?.length||0});
      const current=GM_getValue(OUT,null),admin=GM_getValue(ADMIN,null);
      const proof=reconcileHistoryLedger(current,admin,j.offset,data);
      let screenshotError='',captureMode='';
      // History evidence is ALWAYS an image when the ledger matches. Prefer
      // the REAL AGWL2 screenshot; if DOM capture fails, draw an explicitly
      // labeled image from the already verified table rows (not invented rows).
      if(proof.state==='matched'&&proof.latestGame){
        historyPhase(j,'capturing-image');
        let capture=null;
        try{
          capture=await Promise.race([
            captureHistoryTransScreenshot(data,proof),
            sleep(14000).then(()=>{throw Error('Screenshot halaman melampaui 14 detik.');})
          ]);
          capture.mode='screenshot';
        }catch(e){
          const originalError=e.message||String(e);
          historyPhase(j,'rendering-table-image',{lastError:originalError});
          try{capture=historyTransTableImage(data,proof,j.user);}
          catch(fallbackError){screenshotError=originalError+'; gambar tabel juga gagal: '+fallbackError.message;}
        }
        if(capture){
          try{
            GM_setValue(HISTORY_TRANS_IMAGE,{id:j.id,user:j.user,created:Date.now(),...capture});
            captureMode=capture.mode;
          }catch(e){screenshotError='Gambar history gagal dikirim antartab: '+(e.message||e);}
        }
      }
      historyPhase(j,'completed',{proof:proof.state,captureMode});
      put({state:'ready',started:existing.started||started,data,proof,captureError:screenshotError,captureMode});
      publish(j,{message:proof.state==='matched'?
        'Saldo cocok setelah Debet/Kredit history. Menyiapkan bukti dari transaksi paling akhir.':
        'History selesai, tetapi saldo belum terverifikasi: '+proof.message});
      sessionStorage.removeItem(submitKey);
    }catch(e){
      historyPhase(j,'error',{lastError:String(e.message||e)});
      put({state:'error',started:existing.started||started,error:e.message||String(e)});
      sessionStorage.removeItem(submitKey);
    }finally{
      if(restoreSubmit)restoreSubmit();
      if(form&&enforceSelf)form.removeEventListener('submit',enforceSelf,true);
      if(form){if(originalFormTarget===null)form.removeAttribute('target');
        else form.setAttribute('target',originalFormTarget);}
      if(button){if(originalButtonTarget===null)button.removeAttribute('formtarget');
        else button.setAttribute('formtarget',originalButtonTarget);}
      historyWorkerInProgress=false;
    }
  }

  if(isAdmin){
    const token=location.hash.match(/jejak-balance=([a-f0-9-]+)/i)?.[1];
    const historyToken=location.hash.match(/jejak-history=([a-f0-9-]+)/i)?.[1];
    if(token)sessionStorage.setItem(PREFIX+'admin-worker',token);
    if(historyToken)sessionStorage.setItem(HISTORY_TRANS_TOKEN,historyToken);
    const j=live();
    if(historyWorkerCanRun(j)){
      // Continue reading even when POST/redirect lands on another AGWL2 path.
      readHistoryTransPage(j);
    }else if(j&&active(j)&&/\/agentplayerlist\.php$/i.test(location.pathname)&&
      sessionStorage.getItem(PREFIX+'admin-worker')===j.id)readAdmin(j);
  }
  if(isRegc) {
    const hash=location.hash.match(/jejak-main=([a-f0-9-]+)/i);
    if(hash) sessionStorage.setItem(PREFIX+'worker',hash[1]);
    const workerId=sessionStorage.getItem(PREFIX+'worker'), j=live();
    if(j && active(j) && workerId===j.id && !GM_getValue(OUT,{})?.done) work(j);
    else {runBalanceRetry();runPokerDetail();}
  }
})();
