// ==UserScript==
// @name         LiveChat • Pengingat Member
// @namespace    local.livechat.pengingat
// @version      2.7.0
// @description  Pengingat lokal dari pesan member setelah Started - Today. Tidak mengirim chat atau mengubah akun.
// @match        https://my.livechatinc.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      agwl2.admitoto.com
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  if (document.getElementById('lc-pengingat-bosku')) return;
  const rules = [
    ['deposit', /\bcek\s+deposit\b/i, 'MINTA BUKTI', 'Minta bukti deposit kepada member ya bosku.'],
    ['password', /\b(?:lupa|reset|riset|ganti|ubah)\s+(?:password|pasword|pasw[oa]rd|kata\s+sandi)\b/i, 'CEK DATA SEBELUM RESET', 'Periksa hasil pencarian rekening di panel Now / Old, lalu cocokkan identitas member ya bosku.'],
    ['username', /\blupa\s+(?:username|user\s*id|user\s*name)\b/i, 'KASIH USER ID SAJA', 'Kasih User ID saja ya bosku. JANGAN reset password-nya.'],
    ['withdraw', /\bcek\s+(?:withdraw|withdrawal|wd)\b/i, 'CEK USER ID DI ATAS', 'Cek User ID pada chat di atas. Jika tidak ada, minta User ID kepada member ya bosku.']
  ];
  // Context is evaluated again on every scan, so a later AI request or
  // member reply updates the existing Deposit / Withdraw card immediately.
  function idContext(messages) {
    let requested = false, id = '', candidate = '';
    const label = /\b(?:user\s*id|username|user\s*name|id\s*(?:akun|anda|kamu|bosku)|id)\b/i;
    const request = /\b(?:minta|meminta|boleh|tolong|mohon|sebutkan|berikan|kirim|kirimkan|infokan|informasikan|isi|masukkan|cantumkan|berapa)\b/i;
    const invalid = /^(?:saya|aku|anda|kamu|nya|bos|bosku|ya|iya|oke|ok|adalah|ini|itu|lupa|belum|tidak|ada|mana|berapa|tolong|cek|deposit|withdraw|username|userid)$/i;
    for (const m of messages) {
      const t = m.text.trim();
      if (m.kind === 'agent' && label.test(t) && (request.test(t) || /user\s*id.*\?/i.test(t))) requested = true;
      if (m.kind !== 'member') continue;
      // Explicit values only. Do not treat an AI request as proof an ID exists.
      const match = t.match(/\b(?:user\s*id|username|user\s*name|id(?:\s+akun)?)(?:\s+(?:saya|aku|nya))?(?:\s*[:=]\s*|\s+adalah\s+|\s+)([a-z0-9_.-]{3,32})(?![a-z0-9_.-])/i);
      if (match && !invalid.test(match[1]) && /[a-z]/i.test(match[1])) { id=match[1]; candidate=''; }
      else if (requested && !id && /^[a-z0-9_.-]{3,32}$/i.test(t) && /[a-z]/i.test(t) && !invalid.test(t)) candidate=t;
    }
    return {requested,id,candidate};
  }
  function contextualAdvice(type, context) {
    const category = type === 'deposit' ? 'CEK DEPOSIT' : 'CEK WITHDRAW';
    let title, body, tone;
    if (context.id) {
      title='USER ID SUDAH ADA DI ATAS'; tone='ready';
      body='Jangan minta User ID lagi ya bosku. Gunakan User ID: '+context.id+'.';
    } else if (context.candidate) {
      title='ADA JAWABAN SETELAH PERMINTAAN ID'; tone='review';
      body='Jangan minta ulang dulu ya bosku. Cek jawaban member di atas: '+context.candidate+'. Pastikan itu User ID-nya.';
    } else if (context.requested) {
      title='USER ID SUDAH DIMINTA'; tone='waiting';
      body='AI / agen sudah meminta User ID. Jangan minta lagi ya bosku; cek atau tunggu jawaban member di atas.';
    } else {
      title='CEK USER ID TERLEBIH DAHULU'; tone='review';
      body='User ID belum terdeteksi pada chat yang terbaca. Cek chat di atas terlebih dahulu; jika memang belum ada dan belum diminta, baru minta User ID ya bosku.';
    }
    if (type==='deposit') body+=' Untuk deposit, cek bukti di atas; jika belum dikirim, minta bukti deposit ya bosku.';
    else body+=' Lanjutkan pengecekan withdraw setelah User ID dipastikan.';
    return {category,title,body,tone};
  }
  // v2: read-only account lookup. No password change or registration requests.
  const ADMIN_ORIGIN = 'https://agwl2.admitoto.com';
  const ADMIN_PATHS = ['/agentplayerlist.php','/agentplayerlist_old.php'];
  const resetIntent = /\b(?:lupa|reset|riset|ganti|ubah)\s+(?:pass?wo?rd|password|pasword|pasw[oa]rd|kata\s+sandi)\b/i;
  const accountLabel = /(?:nomor\s*rekening|no\.?\s*(?:rekening|rek)\b|norek\b|rekening\b|account\s*(?:number|no\.?))/i;

  const usernameIntent=/\blupa\s+(?:username|user\s*name|user\s*id)\b/i;
  // Inspect sent agent messages only; never retain the password value.
  function sentCompletion(messages){
    let request='',complete='';
    for(const m of messages){
      if(m.kind==='member'){
        if(resetIntent.test(m.text)){request='password';complete='';}
        else if(usernameIntent.test(m.text)){request='username';complete='';}
        continue;
      }
      if(m.kind!=='agent'||!request)continue;
      const t=m.text;
      const uid=t.match(/\buser\s*id[^\S\r\n]*:[^\S\r\n]*([a-z0-9_.-]{3,40})\b/i);
      if(!uid || /^(?:password|note|silahkan|silakan|userid|username)$/i.test(uid[1]))continue;
      const note=/\bnote\s*:[\s\S]*saran\s+kami[\s\S]*di\s*simpan[\s\S]*memo\s+anda/i.test(t);
      const password=/\bpass?word[^\S\r\n]*:[^\S\r\n]*[^\s:]+/i.test(t);
      if(request==='password'&&password&&note)complete='password';
      if(request==='username'&&!/\bpass?word[^\S\r\n]*:/i.test(t)&&note)complete='username';
    }
    return complete;
  }
  const conversationDonePrefix='lc-conversation-completed-v1:';
  const conversationDoneMemory=new Map();
  function conversationDone(chat=route){
    if(conversationDoneMemory.has(chat))return conversationDoneMemory.get(chat);
    try{
      const saved=JSON.parse(localStorage.getItem(conversationDonePrefix+chat)||'null');
      if(saved&&['password','username'].includes(saved.type)){conversationDoneMemory.set(chat,saved);return saved;}
    }catch{}
    return null;
  }
  function applyConversationDone(done){
    cancelAccount();accountShowResult=false;
    const saved=cachedAccount();
    accountState={...(saved||accountState),active:true,phase:'done',completed:true,conversationCompleted:true,requestType:done.type,stored:done.stored!==false,savedAt:saved?.savedAt||done.time,options:[]};
    if(!saved){
      accountState.now='Pengecekan dihentikan';accountState.old='Percakapan selesai';
      accountState.message='Balasan penyelesaian sudah terkirim.';
    }
    if(saved)saveAccountResult();
    cards=cards.filter(c=>!['password','username'].includes(c.type));render();drawAccount();
    if(!cards.length)$('bubble').classList.remove('unread');
  }
  function markConversationDone(type){
    let done=conversationDone();
    if(!done||done.type!==type){
      done={type,time:Date.now(),stored:true};
      try{localStorage.setItem(conversationDonePrefix+route,JSON.stringify(done));}catch{done.stored=false;}
      conversationDoneMemory.set(route,done);
    }
    if(!accountState.conversationCompleted)applyConversationDone(done);
  }

  function cleanAccount(value){
    return String(value||'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[^0-9]/g,'');
  }
  function numberRuns(value){
    // Do not join digits across words or separate lines. Preserve leading zeroes.
    const text=String(value||'').normalize('NFKC').replace(/^[\s:=]+/,'');
    const separate=text.split(/\s*[/;|]\s*|,\s+(?=\d{5})/).map(t=>t.trim());
    if(separate.length>1 && separate.every(t=>/^[\d\s.,()\-]+$/.test(t)&&/^\d{5,25}$/.test(cleanAccount(t))))return [...new Set(separate.map(cleanAccount))];
    const runs=text.match(/[0-9](?:[0-9\p{P}\p{S}\t \u00a0\u200B-\u200D\uFEFF]*[0-9])?/gu)||[];
    return [...new Set(runs.map(cleanAccount).filter(n=>/^\d{5,25}$/.test(n)))];
  }
  function extractAccounts(messages){
    const strong=new Set(),possible=new Set();let requested=false;
    for(const m of messages){
      if(m.kind==='agent' && accountLabel.test(m.text) && /minta|mohon|tolong|kirim|sebut|berikan|info|berapa/i.test(m.text)){requested=true;continue;}
      if(m.kind!=='member')continue;
      const lines=m.text.split(/\r?\n/);
      for(let i=0;i<lines.length;i++){
        const line=lines[i],label=line.match(accountLabel);
        if(label){
          let tail=line.slice(label.index+label[0].length);
          if(!/\d/.test(tail)&&i+1<lines.length)tail=lines[i+1];
          // Ignore anything after a different named field, e.g. HP or nominal.
          tail=tail.split(/\b(?:hp|telp|telepon|nominal|taruhan|deposit|saldo|otp|pin|password|user\s*id)\b/i)[0];
          numberRuns(tail).forEach(n=>strong.add(n));continue;
        }
        if(/\b(?:hp|telp|telepon|nominal|saldo|otp|pin|bet|taruhan|deposit|withdraw|tanggal|jam|rp|rupiah)\b/i.test(line))continue;
        const values=numberRuns(line);
        if(/\b(?:bca|bri|bni|bsi|mandiri|cimb|danamon|maybank|jago|seabank|dana|ovo|gopay|link\s*aja)\b/i.test(line))values.forEach(n=>strong.add(n));
        else if(/^[\d\p{P}\p{S}\s\u200B-\u200D\uFEFF]+$/u.test(line.trim()))values.forEach(n=>(requested?strong:possible).add(n));
      }
    }
    return {strong:[...strong],possible:[...possible].filter(n=>!strong.has(n))};
  }
  function adminText(el){return String(el?.textContent||'').replace(/\s+/g,' ').trim();}
  function inputCaption(el){
    return [el.name,el.id,el.placeholder,el.getAttribute('aria-label'),...[...(el.labels||[])].map(l=>l.textContent),el.closest('td')?.previousElementSibling?.textContent].join(' ');
  }
  function accountField(doc){
    const inputs=[...doc.querySelectorAll('input[name]')].filter(e=>['text','search','tel','number'].includes(e.type)&&e.form);
    const exact=inputs.filter(e=>/^(rekening|norek|norekening|nomorrekening|accountnumber|accountno|searchrekening|rek)$/i.test((e.name||e.id).replace(/[^a-z0-9]/gi,'')));
    if(exact.length===1)return exact[0];
    const labels=inputs.filter(e=>accountLabel.test(inputCaption(e))&&!/nama\s*(?:rek|rekening)/i.test(inputCaption(e)));
    if(labels.length===1)return labels[0];
    throw new Error('Kolom Nomor Rekening belum dikenali. Perlu menyesuaikan formulir admin.');
  }
  function searchRequest(page,number){
    const input=accountField(page.doc),form=input.form;
    if(form.querySelector('input[type="password"]'))throw new Error('Sesi admin belum login.');
    const buttons=[...form.querySelectorAll('button,input[type="submit"]')].filter(e=>!e.disabled);
    const submit=buttons.find(e=>/^(?:cari|search|submit|filter|tampilkan)$/i.test(adminText(e)||e.value));
    if(!submit)throw new Error('Tombol Cari / Submit belum dikenali.');
    const url=new URL(submit.getAttribute('formaction')||form.getAttribute('action')||page.url,page.url);
    if(url.origin!==ADMIN_ORIGIN || url.pathname!==new URL(page.url).pathname)throw new Error('Tujuan formulir pencarian berbeda; pencarian dihentikan.');
    const method=(submit.getAttribute('formmethod')||form.getAttribute('method')||'GET').toUpperCase();
    if(!['GET','POST'].includes(method))throw new Error('Metode pencarian belum didukung.');
    const checks=[...form.querySelectorAll('input[type="checkbox"][name]')];
    let targetCheck=checks.filter(e=>accountLabel.test(inputCaption(e)));
    if(!targetCheck.length){
      const cell=input.closest('td')||input.closest('label')||input.parentElement;
      const textFields=cell?[...cell.querySelectorAll('input')].filter(e=>['text','search','tel','number','email'].includes(e.type)):[];
      // A form-wide checkbox may belong to User ID; never enable it for rekening.
      if(cell && cell!==form && textFields.length===1 && textFields[0]===input){
        targetCheck=checks.filter(e=>cell.contains(e)&&!/user[_\s-]*(?:id|name)|username|userid/i.test(inputCaption(e)));
      }
    }
    if(targetCheck.length>1)throw new Error('Pilihan filter rekening ambigu.');
    const checkbox=targetCheck[0];
    if(input.disabled&&!checkbox)throw new Error('Filter Nomor Rekening belum aktif.');
    const params=new URLSearchParams();
    for(const e of form.elements){
      if(!e.name || (e.disabled&&e!==input)||['submit','button','reset','image','file'].includes(e.type))continue;
      if(e===input){params.set(e.name,number);continue;}
      if(e.type==='checkbox'){if(e===checkbox)params.append(e.name,e.value||'on');continue;}
      if(e.type==='radio'){
        // A checked restrictive radio filter cannot safely be guessed away.
        if(e.checked && !/^(?:all|semua|)$/i.test(e.value))throw new Error('Filter radio admin perlu disetel ke Semua.');
        if(e.checked)params.append(e.name,e.value);continue;
      }
      if(e.tagName==='SELECT'){
        // bts is the admin's list/display control. Keep its server-selected
        // value; it does not need an option called "Semua".
        if(/^(?:bts|batas|limit|per[_-]?page|page[_-]?size|rows[_-]?per[_-]?page|display[_-]?length)$/i.test(e.name)){
          const selected=[...e.selectedOptions].filter(o=>!o.disabled);
          if(!selected.length)throw new Error('Pilihan tampilan '+e.name+' belum terpilih pada admin.');
          selected.forEach(o=>params.append(e.name,o.value));
          continue;
        }
        const neutral=[...e.options].find(o=>!o.disabled&&(o.value===''||/^(all|semua|all banks|semua bank)$/i.test(adminText(o))));
        if(!neutral)throw new Error('Pilihan filter '+e.name+' belum memiliki opsi Semua yang dikenali.');
        params.append(e.name,neutral.value);continue;
      }
      if(e.type==='hidden'){
        if(/^(page|pageno|halaman)$/i.test(e.name))params.append(e.name,'1');
        else params.append(e.name,e.value); // retain server tokens
      }else params.append(e.name,'');
    }
    if(checkbox&&!params.has(checkbox.name))params.append(checkbox.name,checkbox.value||'on');
    if(submit.name)params.set(submit.name,submit.value||'');
    url.search='';url.hash='';
    if(method==='GET')url.search=params.toString();
    return {url:url.href,method,body:method==='POST'?params.toString():null};
  }
  const pendingAdmin=new Set();
  function fetchAdmin(url,method='GET',body=null){
    return new Promise((resolve,reject)=>{
      const dest=new URL(url);
      if(dest.origin!==ADMIN_ORIGIN||!ADMIN_PATHS.includes(dest.pathname)){reject(new Error('Alamat admin tidak diizinkan.'));return;}
      if(typeof GM_xmlhttpRequest!=='function'){reject(new Error('Perbarui izin skrip di Tampermonkey untuk mengakses admin.'));return;}
      let handle;
      const finish=()=>pendingAdmin.delete(handle);
      handle=GM_xmlhttpRequest({method,url:dest.href,data:body,anonymous:false,timeout:20000,
        headers:method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{},
        onload(response){
          finish();
          try{
            if(response.status<200||response.status>=300)throw new Error('Admin merespons HTTP '+response.status+'.');
            const final=new URL(response.finalUrl||dest.href);
            if(final.origin!==ADMIN_ORIGIN||final.pathname!==dest.pathname)throw new Error('Sesi admin berubah / belum login. Buka admin dan login, lalu Cek ulang.');
            const doc=new DOMParser().parseFromString(response.responseText||'','text/html');
            if(doc.querySelector('input[type="password"],form[action*="login"]'))throw new Error('Admin belum login. Login di Chrome yang sama, lalu Cek ulang.');
            if(/verify you are human|checking your browser|access denied/i.test(adminText(doc.body).slice(0,1500)))throw new Error('Admin menampilkan pemeriksaan akses; hasil belum bisa dibaca.');
            resolve({doc,url:final.href});
          }catch(e){reject(e);}
        },onerror(){finish();reject(new Error('Koneksi admin gagal. Periksa sesi login dan izin Tampermonkey.'));},
        ontimeout(){finish();reject(new Error('Admin tidak merespons dalam 20 detik.'));},
        onabort(){finish();reject(new Error('Pencarian dibatalkan.'));}
      });pendingAdmin.add(handle);
    });
  }

  function recordFromRow(row,labels,number){
    const find=re=>labels.findIndex(t=>re.test(t));
    const value=index=>index>=0?adminText(row.cells[index]):'';
    const uidIndex=find(/^(?:user\s*id|userid|username|player)$/i);
    let userid='';
    const uidCell=row.cells[uidIndex];
    if(uidCell){
      const copy=uidCell.cloneNode(true);
      copy.querySelectorAll('script,style,button,input,img,svg').forEach(e=>e.remove());
      copy.querySelectorAll('br').forEach(e=>e.replaceWith('\n'));
      userid=copy.textContent.split(/\r?\n/).map(t=>t.trim()).filter(Boolean)[0]||'';
      userid=userid.replace(/\s*No Name\s*$/i,'').trim();
    }
    const referral=value(find(/^referral(?:\s*(?:id|code))?$/i));
    const bankIndex=find(/^(?:bank(?:\s*account|\s*\/\s*e-wallet)?|bank\s*e\s*wallet|jenis bank|nama bank)$/i);
    const holderIndex=find(/^(?:nama rekening|nama rek|atas nama|nama pemilik(?: rekening)?|account name)$/i);
    let bank=value(bankIndex),holder=value(holderIndex);
    if(bankIndex>=0 && row.cells[bankIndex]){
      const copy=row.cells[bankIndex].cloneNode(true);
      copy.querySelectorAll('br').forEach(e=>e.replaceWith('\n'));
      const parts=copy.textContent.split(/[,;\r\n]+/).map(t=>t.trim()).filter(Boolean);
      const accountIndex=parts.findIndex(t=>/^[\d\s.\-()]+$/.test(t)&&cleanAccount(t)===number);
      if(accountIndex>=1){
        bank=parts[0];
        if(!holder)holder=parts.slice(1,accountIndex).join(', ');
      }
    }
    return {userid,referral,bank,holder,number};
  }
  function exactAccountCell(value,number){
    const raw=String(value||'').normalize('NFKC').trim();
    return /^[0-9\s.,()/-]+$/.test(raw)&&cleanAccount(raw)===number;
  }
  function resultAt(page,number){
    let verified=false;
    try{verified=cleanAccount(accountField(page.doc).value)===number;}catch{}
    const emptyText=t=>/^(?:tidak ada data|data tidak ditemukan|data kosong|no data(?: available)?(?: in table)?|no records(?: found)?|no matching records found|0 records)[.!\s]*$/i.test(t);
    let emptyEvidence=false,tableSeen=false,rowsSeen=false;
    for(const table of page.doc.querySelectorAll('table')){
      const rows=[...table.rows].filter(r=>r.closest('table')===table);
      const header=rows.findIndex(r=>{
        const labels=[...r.cells].map(adminText);
        return labels.some(t=>/^(?:user\s*id|userid|username|player)$/i.test(t))&&labels.some(t=>/^(?:nomor\s*rekening|no\.?\s*rek(?:ening)?|rekening|norek|bank(?:\s*account)?|bank\s*\/\s*e-wallet)$/i.test(t));
      });
      if(header<0)continue;tableSeen=true;
      const labels=[...rows[header].cells].map(adminText);
      const nr=labels.findIndex(t=>/^(?:nomor\s*rekening|no\.?\s*rek(?:ening)?|rekening|norek)$/i.test(t));
      const bank=labels.findIndex(t=>/^bank(?:\s*account|\s*\/\s*e-wallet)?$/i.test(t));
      for(const row of rows.slice(header+1)){
        const txt=adminText(row);
        if(emptyText(txt)){emptyEvidence=true;continue;}
        if(!txt||!row.cells.length||[...row.cells].every(c=>c.tagName==='TH'))continue;
        rowsSeen=true;
        const record=recordFromRow(row,labels,number);
        if(!/^[a-z0-9_.-]{3,40}$/i.test(record.userid)||/^(?:total|userid|username|no|data)$/i.test(record.userid))continue;
        if(nr>=0&&row.cells[nr]?.colSpan===1&&exactAccountCell(adminText(row.cells[nr]),number))return {state:'found',record};
        if(bank>=0&&row.cells[bank]?.colSpan===1){
          const cell=row.cells[bank].cloneNode(true);cell.querySelectorAll('br').forEach(e=>e.replaceWith('\n'));
          const chunks=cell.textContent.split(/[\r\n,;]+/).map(t=>t.trim()).filter(Boolean);
          // Combined Bank column: bank, holder, account. Never match holder digits.
          const last=chunks[chunks.length-1];
          if(chunks.length>=2&&exactAccountCell(last,number))return {state:'found',record};
        }
      }
    }
    // An empty indicator must belong to a recognized player table, and the
    // response must echo this exact account search. Unrelated "Total: 0" is ignored.
    if(verified&&tableSeen&&emptyEvidence&&!rowsSeen)return {state:'absent'};
    return {state:'unknown',message:tableSeen?'Tidak ada kecocokan persis yang terbaca; hasil kosong belum terkonfirmasi.':'Tabel hasil admin belum dikenali.'};
  }
  async function lookupAt(path,number){
    const page=await fetchAdmin(ADMIN_ORIGIN+path);
    const req=searchRequest(page,number);
    return resultAt(await fetchAdmin(req.url,req.method,req.body),number);
  }


  let liveChatContext=null,selectionTimer=null,selectionDragging=false,selectionKeyboard=false;
  const selectionPins=new Map();
  let accountShowResult=false;
  const accountCachePrefix='lc-account-results-v1:';
  const accountCacheMemory=new Map();
  function readAccountCache(chat=route){
    if(!chat)return {latest:'',results:{}};
    if(accountCacheMemory.has(chat))return accountCacheMemory.get(chat);
    let data;
    try{data=JSON.parse(localStorage.getItem(accountCachePrefix+chat)||'null');}catch{}
    if(!data||data.version!==1||!data.results||typeof data.results!=='object')data={version:1,latest:'',results:{}};
    accountCacheMemory.set(chat,data);return data;
  }
  function cachedAccount(number='',chat=route){
    const data=readAccountCache(chat),result=data.results[number||data.latest];
    if(!result||!/^\d{5,25}$/.test(result.number)||!['done','error'].includes(result.phase))return null;
    // Older versions cached a stop at Now without ever searching Old.
    // Retry those incomplete entries once under the corrected lookup flow.
    if(!result.lookupRevision && result.now!=='TERDAFTAR' && /^(?:Belum dicek|Menunggu hasil Now)$/i.test(result.old||''))return null;
    // Refresh old negative results once using stricter, table-scoped evidence.
    if((result.lookupRevision||0)<2&&result.now==='DI PEMAIN NOW TIDAK ADA'&&result.old==='DI PEMAIN OLD TIDAK ADA'&&!result.completed)return null;
    return JSON.parse(JSON.stringify(result));
  }
  function saveAccountResult(){
    if(!accountState.number||!['done','error'].includes(accountState.phase))return;
    const data=readAccountCache();
    accountState.lookupRevision=2;
    accountState.savedAt=accountState.savedAt||Date.now();
    accountState.stored=true;
    data.version=1;data.latest=accountState.number;
    data.results[accountState.number]=JSON.parse(JSON.stringify(accountState));
    try{localStorage.setItem(accountCachePrefix+route,JSON.stringify(data));}
    catch{accountState.stored=false;data.results[accountState.number].stored=false;}
  }
  function restoreAccountResult(number=''){
    const result=cachedAccount(number);
    if(!result)return false;
    cancelAccount();accountShowResult=false;accountState={...result,active:true,fromCache:true};
    const data=readAccountCache();if(data.latest!==result.number){data.latest=result.number;try{localStorage.setItem(accountCachePrefix+route,JSON.stringify(data));}catch{}}
    drawAccount();return true;
  }
  function isAccountFinished(chat=route){return Boolean(conversationDone(chat)||cachedAccount('',chat)?.completed);}
  function finishAccount(){
    if(location.pathname!==route){scan();return;}
    if(!['done','error'].includes(accountState.phase))return;
    accountShowResult=false;accountState.completed=true;saveAccountResult();
    cards=cards.filter(c=>c.type!=='password');render();drawAccount();
    if(!cards.length)$('bubble').classList.remove('unread');
  }
  let accountState={active:false,options:[],number:'',phase:'idle',now:'Belum dicek',old:'Menunggu hasil Now',message:''};
  let accountEpoch=0,accountTimer=null,accountFingerprint='',accountLastRender='';
  function cancelAccount(){
    accountEpoch++;clearTimeout(accountTimer);accountTimer=null;
    for(const r of pendingAdmin)try{r.abort();}catch{}pendingAdmin.clear();
  }
  function resetAccount(){
    cancelAccount();accountFingerprint='';
    accountState={active:false,options:[],number:'',phase:'idle',now:'Belum dicek',old:'Menunggu hasil Now',message:''};
    const finished=conversationDone();
    if(finished)applyConversationDone(finished);else if(!restoreAccountResult())drawAccount();
  }
  function drawAccount(){
    const el=$('account');if(!el)return;
    const signature=JSON.stringify(accountState)+'|'+accountShowResult;if(signature===accountLastRender)return;accountLastRender=signature;
    el.hidden=!accountState.active;el.replaceChildren();if(!accountState.active)return;
    el.dataset.phase=accountState.completed&&!accountShowResult?'finished':accountState.phase;
    if(accountState.completed&&!accountShowResult){
      const icon=document.createElement('div');icon.className='finished-icon';icon.textContent='✓';
      const eyebrow=document.createElement('div');eyebrow.className='finished-eyebrow';eyebrow.textContent='CHAT SUDAH DITANGANI';
      const title=document.createElement('strong');title.className='finished-title';title.textContent=accountState.conversationCompleted?'Percakapan selesai':'Pencarian selesai';
      const note=document.createElement('p');note.textContent=accountState.conversationCompleted?'Balasan penyelesaian sudah terkirim, bosku. Hasil tersimpan dan tidak dicari ulang.':'Hasil tetap tersimpan, bosku. Kembali ke chat ini tidak akan menjalankan pencarian ulang.';
      const actions=document.createElement('div');actions.className='finished-actions';
      const view=document.createElement('button');view.id='account-view';view.className='view-result';view.textContent='Lihat hasil';
      view.onclick=()=>{accountShowResult=true;drawAccount();};
      const retry=document.createElement('button');retry.id='account-retry';retry.textContent='Cek ulang';retry.onclick=()=>runAccount(accountState.number,true);
      if(accountState.number)actions.append(view,retry);el.append(icon,eyebrow,title,note,actions);
      const foot=document.createElement('small');foot.className='finished-foot';
      foot.textContent=accountState.stored?'✓ Tersimpan untuk chat ini':'Tersimpan selama halaman ini terbuka';
      el.append(foot);return;
    }
    const heading=document.createElement('div');heading.className='category';heading.textContent=accountState.requestType==='username'?'LUPA USERNAME • CEK REKENING':'RESET PASSWORD • CEK REKENING';el.append(heading);
    if(accountState.savedAt){
      const saved=document.createElement('div');saved.className='saved-result';
      saved.textContent=(accountState.completed?'✓ Selesai · ':'✓ ')+(accountState.stored?'Hasil tersimpan':'Tersimpan selama halaman terbuka');
      const stamp=document.createElement('small');
      stamp.textContent='Dicek '+new Date(accountState.savedAt).toLocaleString('id-ID')+' · Cek ulang untuk memperbarui';
      saved.append(stamp);el.append(saved);
    }
    const number=document.createElement('strong');number.className='account-number';number.textContent=accountState.number||'Pilih nomor rekening';el.append(number);
    const status=document.createElement('div');status.className='lookup-steps';
    for(const [name,value] of [['NOW',accountState.now],['OLD',accountState.old]]){
      const line=document.createElement('div'),label=document.createElement('b'),valueEl=document.createElement('span');line.dataset.state=/GAGAL|BELUM BISA/.test(value)?'error':/TIDAK ADA/.test(value)?'empty':/TERDAFTAR/.test(value)?'found':/Sedang/.test(value)?'loading':'idle';label.textContent=name;valueEl.textContent=value;line.append(label,valueEl);status.append(line);
    }el.append(status);
    if(accountState.now==='DI PEMAIN NOW TIDAK ADA'&&accountState.old==='DI PEMAIN OLD TIDAK ADA'){
      const absent=document.createElement('div');absent.className='not-registered';
      const title=document.createElement('strong');title.textContent='TIDAK TERDAFTAR';
      const note=document.createElement('span');note.textContent='Nomor rekening tidak ditemukan di admin Now maupun Old.';
      absent.append(title,note);el.append(absent);
    }
    if(accountState.record){
      const record=accountState.record;
      const card=document.createElement('section');card.className='player-result';
      const banner=document.createElement('div');banner.className='player-banner';
      banner.textContent='✓ TERDAFTAR DI PEMAIN '+accountState.source;card.append(banner);
      const table=document.createElement('table');table.className='player-table';
      for(const [label,value] of [['User ID',record.userid],['Referral',record.referral],['Bank / E-wallet',record.bank],['Nama Rekening',record.holder],['Nomor Rekening',record.number]]){
        const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');
        th.scope='row';th.textContent=label;td.textContent=value||'Belum terbaca';
        if(label==='Nomor Rekening')td.className='number-highlight';
        if(label==='User ID')td.className='userid-value';
        tr.append(th,td);table.append(tr);
      }card.append(table);
      const copy=document.createElement('button');copy.className='copy-player';copy.textContent='Salin data pemain';
      copy.onclick=async()=>{
        const content=['Pemain '+accountState.source,'User ID: '+(record.userid||'Belum terbaca'),'Referral: '+(record.referral||'Belum terbaca'),'Bank / E-wallet: '+(record.bank||'Belum terbaca'),'Nama Rekening: '+(record.holder||'Belum terbaca'),'Nomor Rekening: '+record.number].join('\n');
        try{await navigator.clipboard.writeText(content);copy.textContent='✓ Data tersalin';}catch{setStatus('Clipboard belum diizinkan browser.');}
      };card.append(copy);el.append(card);
    }
    const note=document.createElement('p');note.textContent=accountState.message||'Ambil rekening dari pesan member setelah Started - Today.';el.append(note);
    for(const option of accountState.options.filter(n=>n!==accountState.number)){
      const b=document.createElement('button');b.className='account-option';b.textContent='Cek '+option;b.onclick=()=>runAccount(option);el.append(b);
    }
    const field=document.createElement('input');field.type='text';field.inputMode='numeric';field.autocomplete='off';field.placeholder='Tempel rekening jika belum terbaca';field.setAttribute('aria-label','Nomor rekening untuk diperiksa');
    const go=document.createElement('button');go.textContent=accountState.phase==='loading'?'Mencari…':'Cek rekening';go.disabled=accountState.phase==='loading';
    go.onclick=()=>{const value=cleanAccount(field.value);if(!/^\d{5,25}$/.test(value)){setStatus('Isi nomor rekening 5–25 digit, bosku.');return;}runAccount(value);};
    const manual=document.createElement('details');manual.className='manual-account';
    const summary=document.createElement('summary');summary.textContent='Tempel / ganti nomor rekening';
    manual.append(summary,field,go);el.append(manual);
    if(accountState.number && accountState.phase!=='loading'){
      const retry=document.createElement('button');retry.textContent='Cek ulang';retry.id='account-retry';retry.onclick=()=>runAccount(accountState.number,true);el.append(retry);
    }
    const finish=document.createElement('button');finish.id='account-finish';finish.className='account-finish';finish.textContent=accountState.completed?'Kembali ke pencarian selesai':'✓ Selesai';finish.disabled=!['done','error'].includes(accountState.phase);finish.title='Tampilkan ringkasan selesai; hasil tetap tersimpan';finish.onclick=finishAccount;el.append(finish);
    const link=document.createElement('a');link.href=ADMIN_ORIGIN+ADMIN_PATHS[0];link.target='_blank';link.rel='noopener noreferrer';link.textContent='Buka admin / login';link.className='admin-link';el.append(link);
  }
  async function runAccount(number,force=false){
    if(location.pathname!==route){scan();return;}
    if(!force && accountState.phase==='loading'&&accountState.number===number)return;
    if(!force && restoreAccountResult(number))return;
    if(paused){setStatus('Klik Lanjut sebelum mengecek rekening.');return;}
    cancelAccount();accountShowResult=false;const epoch=accountEpoch,chat=route;
    const current=()=>epoch===accountEpoch&&chat===route&&location.pathname===chat;
    accountState={...accountState,number,record:null,source:'',savedAt:null,stored:false,completed:false,conversationCompleted:false,completionRefresh:force&&Boolean(conversationDone()),fromCache:false,phase:'loading',now:'Sedang mencari…',old:'Menunggu hasil Now',message:'Membersihkan filter dan mencari Nomor Rekening di Pemain Now.'};drawAccount();
    try{
      const now=await lookupAt(ADMIN_PATHS[0],number);if(!current())return;
      if(now.state==='found'){
        accountState.record=now.record;accountState.source='NOW';accountState.now='TERDAFTAR';accountState.old='Tidak perlu dicek';accountState.message=accountState.requestType==='username'?'Rekening ditemukan di Pemain Now. Berikan User ID saja setelah cocok; jangan reset password.':'Rekening ditemukan di Pemain Now. Cocokkan identitas member sebelum reset password.';
      }else{
        // Both confirmed empty and unrecognized/no exact match continue to Old.
        // Do not mislabel an unrecognized response as confirmed absence.
        const nowAbsent=now.state==='absent';
        accountState.now=nowAbsent?'DI PEMAIN NOW TIDAK ADA':'BELUM ADA KECOCOKAN TERBACA';
        accountState.old='Sedang mencari…';
        accountState.message='Lanjut mencari Nomor Rekening di Pemain Old.';drawAccount();
        const old=await lookupAt(ADMIN_PATHS[1],number);if(!current())return;
        accountState.record=old.state==='found'?old.record:null;
        accountState.source=old.state==='found'?'OLD':'';
        accountState.old=old.state==='found'?'TERDAFTAR':old.state==='absent'?'DI PEMAIN OLD TIDAK ADA':'BELUM BISA DIPASTIKAN';
        if(old.state==='found'){
          accountState.message=nowAbsent?'Rekening hanya ditemukan di Pemain Old.':'Rekening ditemukan di Pemain Old. Hasil Now belum dapat dipastikan.';
        }else if(old.state==='absent'){
          accountState.message=nowAbsent?'TIDAK TERDAFTAR — nomor rekening tidak ditemukan di admin Now maupun Old.':'Di Pemain Old tidak ada. Hasil Now belum dapat dipastikan.';
        }else{
          accountState.message='Pencarian Old sudah dijalankan, tetapi hasilnya belum bisa dipastikan. '+(old.message||'');
        }
      }
      if(accountState.requestType==='username'&&accountState.source==='OLD')accountState.message+=' Berikan User ID saja; jangan reset password.';
      accountState.phase='done';
    }catch(e){
      if(!current())return;
      if(accountState.old==='Sedang mencari…')accountState.old='GAGAL DICEK';else accountState.now='GAGAL DICEK';
      accountState.phase='error';accountState.message=e.message;
    }
    if(current()){if(conversationDone()){accountState.conversationCompleted=true;accountState.completed=true;accountShowResult=false;}accountState.completionRefresh=false;saveAccountResult();drawAccount();$('bubble').classList.add('unread');playNotice();}
  }
  function syncAccount(messages){
    if(accountState.phase==='loading'&&accountState.completionRefresh)return;
    const pin=selectionPins.get(route);
    const completion=sentCompletion(pin?[{kind:'member',text:pin.requestType==='username'?'lupa username':'reset password'},...messages.slice(pin.startIndex)]:messages);
    if(completion){selectionPins.delete(route);markConversationDone(completion);return;}
    if(pin){
      if(accountState.number!==pin.number){accountState.active=true;runAccount(pin.number);}
      return;
    }
    const finished=conversationDone();
    if(finished){if(!accountState.conversationCompleted)applyConversationDone(finished);return;}
    const intentMessage=[...messages].reverse().find(m=>m.kind==='member'&&(resetIntent.test(m.text)||usernameIntent.test(m.text)));
    const requestType=intentMessage&&usernameIntent.test(intentMessage.text)?'username':'password';
    const active=Boolean(intentMessage);
    if(!active){if(!accountState.savedAt && accountState.active)resetAccount();return;}
    const found=extractAccounts(messages),fingerprint=JSON.stringify({requestType,...found});
    if(accountState.active && fingerprint===accountFingerprint)return;
    accountFingerprint=fingerprint;
    const options=[...new Set([...found.strong,...found.possible])];
    const prior=cachedAccount();
    const candidate=options.length===1?options[0]:prior&&(!options.length||options.includes(prior.number))?prior.number:'';
    if(candidate && restoreAccountResult(candidate)){
      accountState.options=options;accountState.requestType=requestType;drawAccount();return;
    }
    cancelAccount();
    accountState={active:true,options,requestType,number:'',phase:'idle',now:'Belum dicek',old:'Menunggu hasil Now',message:options.length>1?'Ada beberapa nomor. Pilih rekening yang benar ya bosku.':!options.length?'Nomor rekening belum terbaca. Tunggu member mengirim rekening atau tempel di bawah.':'Nomor terdeteksi dari chat.'};
    drawAccount();
    if(options.length===1){
      const epoch=accountEpoch,number=options[0];
      accountState.number=number;accountState.message='Rekening dikenali. Menyiapkan pencarian…';drawAccount();
      accountTimer=setTimeout(()=>{if(epoch===accountEpoch&&!paused)runAccount(number);},900);
    }
  }

  const normalize = s => s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const startRE = /^Started\s*[-–—]?\s*Today\b/i;
  const key = 'lc-pengingat-settings-v1';
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
  const host = document.createElement('div');
  host.id = 'lc-pengingat-bosku';
  host.style.cssText = 'position:fixed;right:22px;bottom:24px;z-index:2147483647;';
  document.body.appendChild(host);
  const ui = host.attachShadow({mode:'open'});
  ui.innerHTML = `<style>
:host{font:12px/1.55 'Segoe UI',Arial,sans-serif;color:#e9f3fa;color-scheme:dark}*{box-sizing:border-box}[hidden]{display:none!important}button,input{font:inherit}button{cursor:pointer;color:#dfeef7;background:#20384b;border:1px solid #38586d;border-radius:8px;padding:7px 10px;transition:background .15s,border-color .15s}button:hover{background:#2a4b60;border-color:#72b8ba}button:focus-visible,summary:focus-visible{outline:2px solid #88ded0;outline-offset:3px}button:disabled{opacity:.5;cursor:default}input{width:100%;padding:9px 10px;border:1px solid #38576b;background:#101e2d;color:#f1f7fc;border-radius:8px;margin:8px 0}input:focus{outline:none;border-color:#6dbdb4}input::placeholder{color:#8da4b5}
#bubble{display:flex;align-items:center;gap:8px;border-radius:26px;padding:10px 14px;border:1px solid #72c5bc;background:linear-gradient(120deg,#236e72,#28465f);font-size:12px;font-weight:700;letter-spacing:.2px;box-shadow:0 6px 24px #020a1755;touch-action:none}#bubble.unread{border-color:#f0cf8a;box-shadow:0 0 0 3px #f0cf8a20,0 6px 24px #020a1755}#count{display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;padding:0 5px;border-radius:12px;font-size:10px;background:#ffffff1f;color:#fff}
#panel{width:min(310px,calc(100vw - 24px));max-height:calc(100dvh - 80px);overflow:auto;border:1px solid #3a596d;border-radius:19px;margin-bottom:9px;background:#101e2e;box-shadow:0 20px 60px #010a1673;scrollbar-width:thin;scrollbar-color:#38576b transparent}header{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(110deg,#1a3f4d,#1c3147);border-bottom:1px solid #ffffff0c;padding:13px 14px;cursor:move;touch-action:none}header strong{font-size:14px;font-weight:700;letter-spacing:.2px}header strong span{margin-left:5px;padding:2px 5px;border:1px solid #539c9750;border-radius:5px}#close{height:26px;min-width:26px;padding:0;background:#ffffff09;border-color:#ffffff15;font-size:17px}.body{padding:12px}#status{font-size:10px;line-height:1.5;color:#94adbf;margin:0 1px 11px}.category{font-size:9px;letter-spacing:1.1px;font-weight:700;color:#8cc7c7;margin-bottom:7px}
#account{padding:13px;background:linear-gradient(140deg,#193441,#142838);border:1px solid #355967;border-radius:13px;margin-bottom:12px}.account-number{display:block;font-size:19px;letter-spacing:.8px;line-height:1.35;color:#f0f8fb;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.lookup-steps{display:grid;gap:6px;margin:12px 0}.lookup-steps>div{display:flex;gap:10px;align-items:flex-start;padding:8px 9px;border-radius:8px;background:#0c1e2c80;border:1px solid #ffffff08}.lookup-steps b{flex:0 0 29px;font-size:9px;letter-spacing:.5px;color:#8ad4cb;margin-top:1px}.lookup-steps span{font-size:10px;line-height:1.6;color:#c6d9e4}.lookup-steps>div[data-state="found"]{background:#17524530;border-color:#3c7d6350}.lookup-steps>div[data-state="found"] span{color:#a6e7c9}.lookup-steps>div[data-state="empty"] span{color:#e9cc8d}.lookup-steps>div[data-state="error"] span{color:#f7b4b7}.lookup-steps>div[data-state="loading"] span{color:#a4d4f3}#account p{font-size:11px;line-height:1.65;color:#abc2d0;margin:10px 0}.account-option{font-size:11px;margin:3px;max-width:100%;overflow-wrap:anywhere}.manual-account{border-top:1px solid #ffffff0e;margin-top:12px;padding-top:10px}.manual-account summary{color:#99b6c7;font-size:10px}#account-retry{font-size:10px;margin-top:8px}.admin-link{display:block;margin:10px 0 0;text-align:center;color:#84a2b6;font-size:10px;text-decoration:none}.admin-link:hover{color:#c6e7ed;text-decoration:underline}
#account .account-finish{display:block;width:100%;margin-top:12px;padding:10px 9px;font-size:12px;font-weight:700;background:linear-gradient(110deg,#2a917b,#24796f);border:1px solid #68bda6;color:#f4fffb;border-radius:9px;box-shadow:0 4px 12px #021c1420}#account .account-finish:hover{background:#319c86}.saved-result{border-radius:8px;padding:8px 9px;margin:0 0 11px;background:#286f5630;border:1px solid #498a6f40;font-size:10px;font-weight:600;color:#abe1c9}.saved-result small{display:block;font-size:9px;font-weight:400;color:#8fb4b1;margin-top:3px;line-height:1.6}
.player-result{margin:12px 0;border:1px solid #76bcc4;border-radius:10px;overflow:hidden;background:#f1f8fa;color:#193747}.player-banner{padding:9px 10px;font-size:10px;font-weight:700;letter-spacing:.3px;background:#207f90;color:#fff}.player-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}.player-table th,.player-table td{padding:9px 8px;border-bottom:1px solid #d5e4e9;vertical-align:top;text-align:left;overflow-wrap:anywhere}.player-table th{width:38%;background:#e9f2f5;color:#526f7f;font-size:10px;font-weight:600}.player-table td{background:#fff;color:#173b50;font-weight:600;user-select:text}.player-table .userid-value{color:#12627a;font-weight:800;font-size:15px}.player-table .number-highlight{background:#fff2a6;color:#3e3a1b;font-size:13px;font-weight:800;letter-spacing:.2px}.player-result .copy-player{display:block;width:calc(100% - 16px);margin:8px;padding:7px;background:#e4f0f3;color:#235d70;border-color:#bbd7df;font-size:10px}.player-result .copy-player:hover{background:#d1e7ec}
#account[data-phase="finished"]{padding:23px 16px 16px;text-align:center;background:radial-gradient(ellipse at 50% 0%,#2e6b5938,transparent 72%),#162d35;border:1px solid #3d6e62;border-radius:14px}.finished-icon{width:46px;height:46px;line-height:44px;margin:0 auto 13px;border:1px solid #6ebe9b;border-radius:50%;background:#3d8f662b;color:#a1ebc4;font-size:25px;box-shadow:0 0 0 6px #3d8f660c}.finished-eyebrow{color:#83b9a6;font-size:8px;letter-spacing:1.6px;font-weight:700;margin-bottom:6px}.finished-title{display:block;color:#e0f8ed;font-size:18px;font-weight:700;letter-spacing:-.3px}#account[data-phase="finished"] p{font-size:11px;line-height:1.7;color:#a3c0b9;margin:9px 0 17px}.finished-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.finished-actions button{margin:0!important;padding:8px!important;font-size:11px!important}.finished-actions .view-result{background:#286457;border-color:#4b917a;color:#e5fff2}.finished-actions #account-retry{background:transparent;border-color:#395e59;color:#a8cbc1}.finished-foot{display:block;border-top:1px solid #ffffff0b;margin-top:14px;padding-top:11px;font-size:9px;color:#76a795}
#cards{max-height:205px;overflow:auto;scrollbar-width:thin}.card{padding:11px;margin:0 0 8px;border:1px solid #304b60;border-left:3px solid #58b7a8;border-radius:10px;background:#172c3d}.card b{font-size:12px;color:#a1e3d4}.card p{font-size:11px;color:#c2d4e0;line-height:1.65;margin:6px 0}.card[data-tone="waiting"]{border-left-color:#cdaa60}.card[data-tone="waiting"] b{color:#e7cf98}.card[data-tone="review"]{border-left-color:#72a6d2}.card[data-tone="review"] b{color:#b7d5ee}.quote{font-size:10px;color:#8da8bb;margin-top:9px;padding-top:8px;border-top:1px solid #ffffff0b;overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.actions button{font-size:10px;padding:6px 8px}.body>details{border-top:1px solid #ffffff0c;margin-top:13px;padding-top:11px;color:#93adbf;font-size:10px}summary{cursor:pointer}small{display:block;color:#718c9f;font-size:9px;line-height:1.5;margin-top:11px}
  .not-registered{padding:14px 10px;margin:12px 0;border:1px solid #d7957d88;border-radius:10px;background:#70432d30;text-align:center}.not-registered strong{display:block;color:#ffd0b4;font-size:15px;letter-spacing:.5px}.not-registered span{display:block;color:#d6b9a9;font-size:10px;margin-top:5px;line-height:1.6}
  </style>
  <section id="panel" hidden><header><strong>✦ Chat Assist <span style="font-size:10px;color:#6ce0c5">2.7</span></strong><button id="close" title="Kecilkan">−</button></header><div class="body"><p id="status">Menunggu chat…</p><div id="account" hidden></div><div id="cards"></div><div class="actions"><button id="scan">Baca ulang</button><button id="pause">Jeda</button><button id="clear">Bersihkan</button><button id="sound" aria-pressed="false">Suara: mati</button></div><details><summary>Pengaturan pembacaan</summary><p>Jika pesan member belum dikenali, isi selector CSS khusus baris pesan member. Selector harus membedakan member dari agen.</p><label>Selector pesan member<input id="member" placeholder="Otomatis berdasarkan penanda pengirim"></label><label>Selector pesan AI / agen (opsional)<input id="agent" placeholder="Penanda khusus pengirim AI / agen"></label><label>Selector area percakapan (opsional)<input id="scope" placeholder="Otomatis dari penanda Started - Today"></label><button id="save">Simpan pengaturan</button> <button id="restore">Tampilkan lagi pengingat selesai</button> <button id="position">Reset posisi bubble</button><small>Hanya membaca pesan yang dimuat di halaman. Jika penanda awal belum ditemukan, gulir chat ke Started - Today lalu klik Baca ulang.</small></details><small>Blok rekening di chat untuk cek • hasil tersimpan otomatis</small></div></section><button id="bubble">✦ Asisten <span id="count">0</span></button>`;
  const $ = id => ui.getElementById(id);
  $('member').value = cfg.member || ''; $('agent').value = cfg.agent || ''; $('scope').value = cfg.scope || '';
  const completedByChat = new Map(), sources = new Map();
  let audioContext=null, soundEnabled=false, lastBeep=-Infinity, baselineReady=false;
  function playNotice(){
    if(!soundEnabled || !audioContext || audioContext.state!=='running')return;
    const now=performance.now();
    if(now-lastBeep<5000)return;
    lastBeep=now;
    const oscillator=audioContext.createOscillator(),volume=audioContext.createGain();
    oscillator.type='sine';oscillator.frequency.setValueAtTime(740,audioContext.currentTime);
    oscillator.frequency.setValueAtTime(960,audioContext.currentTime+0.1);
    volume.gain.setValueAtTime(0,audioContext.currentTime);
    volume.gain.linearRampToValueAtTime(0.08,audioContext.currentTime+0.02);
    volume.gain.exponentialRampToValueAtTime(0.001,audioContext.currentTime+0.24);
    oscillator.connect(volume);volume.connect(audioContext.destination);
    oscillator.start();oscillator.stop(audioContext.currentTime+0.25);
    oscillator.onended=()=>{oscillator.disconnect();volume.disconnect();};
  }
  let paused = false, route = '', seen = new Set(), cards = [], lastRender = '', timer;
  const visible = e => e && e.isConnected && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const excluded = e => host.contains(e) || e.closest('input,textarea,[contenteditable="true"],nav,aside,script,style');
  const text = e => normalize(e.innerText || '');
  function setStatus(s) { if ($('status').textContent !== s) $('status').textContent = s; }
  function render() {
    const value = JSON.stringify(cards);
    if (value === lastRender) return;
    lastRender = value; $('cards').replaceChildren(); $('count').textContent = cards.length; $('bubble').setAttribute('aria-label','Pengingat: '+cards.length+' aktif. Alt Shift B untuk buka atau tutup.');
    for (const c of cards.slice().reverse()) {
      const box=document.createElement('div'); box.className='card'; box.dataset.tone=c.tone || 'ready';
      const category=document.createElement('div');category.className='category';category.textContent=c.category || 'PENGINGAT MEMBER';box.append(category);
      const title=document.createElement('b'); title.textContent=c.title;
      const body=document.createElement('p'); body.textContent=c.body;
      const quote=document.createElement('div'); quote.className='quote'; quote.textContent='Pesan: '+c.message;
      box.append(title,body,quote);
      const actions=document.createElement('div');actions.className='actions';
      const jump=document.createElement('button');jump.textContent='↗ Lihat pesan';
      jump.onclick=()=>{
        const target=sources.get(c.signature);
        if(!target || !target.isConnected){setStatus('Pesan belum dimuat. Gulir chat lalu klik Baca ulang.');return;}
        target.scrollIntoView({behavior:'smooth',block:'center'});
        if(typeof target.animate==='function')target.animate([{outline:'2px solid #72e9d0'},{outline:'2px solid transparent'}],{duration:1600});
      };
      const done=document.createElement('button');done.textContent='✓ Selesai';
      done.onclick=()=>{
        completed().add(c.signature);
        cards=cards.filter(item=>item.signature!==c.signature);render();
        if(!cards.length)$('bubble').classList.remove('unread');
      };
      const copy=document.createElement('button');copy.textContent='Salin';
      copy.title='Salin pengingat untuk operator';
      copy.onclick=async()=>{
        try{
          await navigator.clipboard.writeText((c.category||'PENGINGAT')+'\n'+c.title+'\n'+c.body);
          copy.textContent='✓ Tersalin';
          setTimeout(()=>{if(copy.isConnected)copy.textContent='Salin';},1500);
        }catch{setStatus('Tidak bisa menyalin. Izinkan clipboard pada browser atau salin teks pengingat secara manual.');}
      };
      actions.append(jump,copy,done);box.append(actions);$('cards').append(box);
    }
  }
  function reset() { seen.clear(); sources.clear(); cards=[]; render();resetAccount(); }
  function completed() {
    if(!completedByChat.has(route)){
      if(completedByChat.size>=40)completedByChat.delete(completedByChat.keys().next().value);
      completedByChat.set(route,new Set());
    }
    return completedByChat.get(route);
  }
  function savePosition(){
    const r=host.getBoundingClientRect();
    cfg.position={x:r.left,y:r.top};
    try{localStorage.setItem(key,JSON.stringify(cfg));}catch{}
  }
  function clampPosition(){
    if(!host.style.left)return;
    host.style.left=Math.max(8,Math.min(parseFloat(host.style.left)||8,innerWidth-host.offsetWidth-8))+'px';
    host.style.top=Math.max(8,Math.min(parseFloat(host.style.top)||8,innerHeight-host.offsetHeight-8))+'px';
  }
  function findStart(root) {
    const candidates = [...root.querySelectorAll('div,span,p,li,time')].filter(e => {
      if (!visible(e) || excluded(e)) return false;
      const s = text(e); return s.length < 150 && startRE.test(s);
    });
    // Keep the smallest matching element and use the last Today session.
    return candidates.filter(e=>!candidates.some(c=>c!==e && e.contains(c))).pop();
  }
  function inferScope(marker) {
    let p=marker.parentElement;
    while(p && p!==document.body){
      const style=getComputedStyle(p);
      if (/(auto|scroll)/.test(style.overflowY) || p.getAttribute('role')==='log') return p;
      p=p.parentElement;
    }
    return null; // Never scan the entire application as a transcript.
  }
  function senderKind(e, scope) {
    for(let p=e;p && p!==scope;p=p.parentElement){
      const tag=[p.getAttribute('data-author-type'),p.getAttribute('data-sender-type'),p.getAttribute('data-message-author-type'),p.getAttribute('data-testid'),p.className].filter(x=>typeof x==='string').join(' ').toLowerCase();
      if (/(^|[\s_\-])(agent|operator|outgoing|system|bot)([\s_\-]|$)/.test(tag)) return 'agent';
      if (/(^|[\s_\-])(visitor|customer|member|incoming)([\s_\-]|$)/.test(tag)) return 'member';
    }
    return 'unknown';
  }
  function scan(){
    const next=location.pathname;
    if(next!==route){liveChatContext=null;clearTimeout(selectionTimer);route=next;baselineReady=false;reset();$('bubble').classList.remove('unread');}
    host.hidden=!/^\/chats(?:\/|$)/.test(next);
    if(host.hidden || paused) return;
    liveChatContext=null;
    try{
      let scope=cfg.scope ? document.querySelector(cfg.scope) : null;
      if(cfg.scope && (!scope || !visible(scope))){reset();setStatus('Area percakapan belum ditemukan. Periksa pengaturan.');return;}
      const marker=findStart(scope || document.body);
      if(!marker){cards=[];seen.clear();render();setStatus('Belum menemukan Started - Today. Gulir ke awal chat hari ini, lalu Baca ulang.');return;}
      scope=scope || inferScope(marker);
      if(!scope){reset();setStatus('Area chat belum dikenali. Isi selector area percakapan pada pengaturan.');return;}
      const after=e=>!e.contains(marker) && !!(marker.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING);
      let candidates;
      if(cfg.member){
        candidates=[...scope.querySelectorAll(cfg.member)].filter(e=>visible(e)&&!excluded(e)&&after(e));
        candidates=candidates.filter(e=>!candidates.some(p=>p!==e&&p.contains(e)));
      } else {
        candidates=[...scope.querySelectorAll('div,p,li,span')].filter(e=>visible(e)&&!excluded(e)&&after(e)&&senderKind(e,scope)==='member');
        // Outermost member wrapper is one message; do not count nested text twice.
        candidates=candidates.filter(e=>!candidates.some(p=>p!==e&&p.contains(e)));
      }
      if(!candidates.length){reset();setStatus('Started - Today ditemukan; pesan member belum dikenali. Cek pengaturan jika chat sudah berisi pesan.');return;}
      const agents = [...scope.querySelectorAll(cfg.agent || 'div,p,li,span')]
        .filter(e=>visible(e)&&!excluded(e)&&after(e)&&!candidates.some(m=>m===e||m.contains(e)||e.contains(m))&&(cfg.agent||senderKind(e,scope)==='agent'));
      const agentRows = agents.filter(e=>!agents.some(p=>p!==e&&p.contains(e)));
      const transcript = [...candidates.map(e=>({e,kind:'member'})),...agentRows.map(e=>({e,kind:'agent'}))]
        .sort((a,b)=>(a.e.compareDocumentPosition(b.e)&Node.DOCUMENT_POSITION_FOLLOWING)?-1:1)
        .map(m=>({kind:m.kind,text:m.e.innerText||''}));
      liveChatContext={route,scope,candidates,messages:transcript};
      syncAccount(transcript);
      const context = idContext(transcript);
      const occurrences=new Map(); let added=false;
      for(const e of candidates){
        const message=text(e); if(!message || message.length>10000)continue;
        const n=(occurrences.get(message)||0)+1;occurrences.set(message,n);
        const identity=e.getAttribute('data-message-id') || e.getAttribute('data-event-id') || message+'#'+n;
        for(const [type,re,title,body] of rules){
          if(!re.test(message))continue;
          if(['password','username'].includes(type)&&isAccountFinished())continue;
          const signature=identity+'|'+type;
          sources.set(signature,e);
          if(completed().has(signature))continue;
          const advice = (type==='deposit'||type==='withdraw') ? contextualAdvice(type,context) : {title,body};
          const existing=cards.find(c=>c.signature===signature);
          if(existing){ Object.assign(existing,advice); continue; }
          if(seen.has(signature))continue;
          // One current card per transaction topic; update it as conversation progresses.
          if(type==='deposit'||type==='withdraw') cards=cards.filter(c=>c.type!==type);
          seen.add(signature);cards.push({signature,type,...advice,message:message.slice(0,240)});added=true;
        }
      }
      for(const card of cards) if(card.type==='deposit'||card.type==='withdraw') Object.assign(card,contextualAdvice(card.type,context));
      cards=cards.slice(-30);render();
      if(added){
        $('bubble').classList.add('unread');
        if(baselineReady)playNotice();
      }
      baselineReady=true;
      setStatus(`Aktif • ${candidates.length} pesan member • ${agentRows.length} pesan AI/agen • mulai Started - Today`);
    }catch(err){reset();setStatus('Pembacaan belum cocok: '+err.message.slice(0,140));}
  }
  $('bubble').onclick=()=>{
    $('panel').hidden=!$('panel').hidden;
    if(!$('panel').hidden){
      $('bubble').classList.remove('unread');
      const r=host.getBoundingClientRect();
      if(host.style.top) host.style.top=Math.max(8,Math.min(r.top,innerHeight-host.offsetHeight-8))+'px';
      if(host.style.left) host.style.left=Math.max(8,Math.min(r.left,innerWidth-host.offsetWidth-8))+'px';
    }
  };
  $('sound').onclick=async()=>{
    if(soundEnabled){soundEnabled=false;}
    else {
      try{
        const AudioAPI=window.AudioContext||window.webkitAudioContext;
        if(!AudioAPI)throw new Error('Audio tidak tersedia');
        audioContext=audioContext||new AudioAPI();
        await audioContext.resume();
        if(audioContext.state!=='running')throw new Error('Audio diblokir browser');
        soundEnabled=true;lastBeep=-Infinity;playNotice();
      }catch{setStatus('Suara belum bisa diaktifkan pada browser ini.');soundEnabled=false;}
    }
    $('sound').textContent=soundEnabled?'Suara: aktif':'Suara: mati';
    $('sound').setAttribute('aria-pressed',String(soundEnabled));
  };
  document.addEventListener('keydown',e=>{
    if(e.altKey&&e.shiftKey&&e.code==='KeyB'&&!e.ctrlKey&&!e.metaKey&&!e.repeat&&!host.hidden){
      e.preventDefault();$('bubble').click();
    }
  });
  $('close').onclick=()=>{$('panel').hidden=true;};
  $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Lanjut':'Jeda';if(paused){cancelAccount();accountFingerprint='';if(accountState.phase==='loading'){accountState.phase='paused';accountState.message='Pencarian dijeda. Klik Lanjut untuk membaca kembali.';drawAccount();}setStatus('Pembacaan dijeda.');}else scan();};
  $('scan').onclick=()=>{baselineReady=false;reset();scan();};
  $('clear').onclick=()=>{cards.forEach(c=>completed().add(c.signature));cards=[];render();$('bubble').classList.remove('unread');};
  $('save').onclick=()=>{
    const nextCfg={position:cfg.position,agent:$('agent').value.trim(),member:$('member').value.trim(),scope:$('scope').value.trim()};
    try{for(const name of ['agent','member','scope'])if(nextCfg[name])document.querySelector(nextCfg[name]);}catch{setStatus('Selector CSS tidak valid. Periksa kembali.');return;}
    cfg=nextCfg;try{localStorage.setItem(key,JSON.stringify(cfg));}catch{}
    reset();scan();
  };
  $('restore').onclick=()=>{baselineReady=false;completed().clear();reset();scan();};
  $('position').onclick=()=>{
    host.style.left='';host.style.top='';host.style.right='22px';host.style.bottom='24px';
    delete cfg.position;try{localStorage.setItem(key,JSON.stringify(cfg));}catch{}
  };
  if(cfg.position && Number.isFinite(cfg.position.x) && Number.isFinite(cfg.position.y)){
    host.style.right='auto';host.style.bottom='auto';host.style.left=cfg.position.x+'px';host.style.top=cfg.position.y+'px';clampPosition();
  }
  window.addEventListener('resize',clampPosition);
  let drag=null, moved=false;
  for(const handle of [ui.querySelector('header'),$('bubble')]){
    handle.addEventListener('pointerdown',e=>{
      if(e.target.closest('header button'))return;
      const r=host.getBoundingClientRect();drag={x:e.clientX,y:e.clientY,left:r.left,top:r.top};moved=false;handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove',e=>{
      if(!drag)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)<5&&!moved)return;moved=true;
      host.style.right='auto';host.style.bottom='auto';
      host.style.left=Math.max(0,Math.min(innerWidth-host.offsetWidth,drag.left+dx))+'px';
      host.style.top=Math.max(0,Math.min(innerHeight-host.offsetHeight,drag.top+dy))+'px';
    });
    handle.addEventListener('pointerup',()=>{if(moved)savePosition();drag=null;});handle.addEventListener('pointercancel',()=>{drag=null;});
    handle.addEventListener('click',e=>{if(moved){e.stopImmediatePropagation();e.preventDefault();moved=false;}},true);
  }
  window.addEventListener('storage',e=>{
    if(e.key===conversationDonePrefix+route){conversationDoneMemory.delete(route);const done=conversationDone();if(done)applyConversationDone(done);}
    if(e.key===accountCachePrefix+route){
      accountCacheMemory.delete(route);
      if(accountState.phase!=='loading')restoreAccountResult();
    }
  });

  function selectedChatAccount(){
    const context=liveChatContext,selection=window.getSelection();
    if(!context||context.route!==route||location.pathname!==route||paused||!selection||selection.isCollapsed||selection.rangeCount!==1)return '';
    const asElement=node=>node?.nodeType===1?node:node?.parentElement;
    const anchor=asElement(selection.anchorNode),focus=asElement(selection.focusNode);
    if(!anchor||!focus||excluded(anchor)||excluded(focus))return '';
    const row=context.candidates.find(e=>e.isConnected&&e.contains(anchor)&&e.contains(focus));
    if(!row)return '';
    const raw=selection.toString().normalize('NFKC').trim();
    // Selection must be one number, not names, passwords, or multiple messages.
    if(!raw||raw.length>100||!/^[0-9\p{P}\p{S}\s\u200B-\u200D\uFEFF]+$/u.test(raw))return '';
    const choices=numberRuns(raw);
    return choices.length===1?choices[0]:'';
  }
  function checkSelectedAccount(){
    const number=selectedChatAccount();if(!number)return;
    const previous=selectionPins.get(route);
    if(previous?.number===number&&accountState.number===number){
      $('panel').hidden=false;accountShowResult=true;drawAccount();clampPosition();return;
    }
    const requestType=accountState.requestType||'password';
    selectionPins.set(route,{number,requestType,startIndex:liveChatContext.messages.length});
    // Selecting another number is an explicit new check within this chat.
    conversationDoneMemory.delete(route);
    try{localStorage.removeItem(conversationDonePrefix+route);}catch{}
    accountState.active=true;accountState.requestType=requestType;
    $('panel').hidden=false;
    if(restoreAccountResult(number)){
      accountShowResult=true;drawAccount();
      setStatus('Nomor ini sudah pernah dicek. Menampilkan hasil tersimpan.');
    }else{
      runAccount(number);
      setStatus('Nomor yang diblok dipilih untuk pencarian Now → Old.');
    }
    clampPosition();
  }
  function scheduleSelectedAccount(){
    clearTimeout(selectionTimer);
    if(selectionDragging||selectionKeyboard)return;
    const chat=location.pathname;
    selectionTimer=setTimeout(()=>{if(chat===location.pathname&&chat===route)checkSelectedAccount();},450);
  }
  document.addEventListener('selectionchange',scheduleSelectedAccount);
  document.addEventListener('pointerdown',e=>{
    if(e.composedPath().includes(host))return;
    selectionDragging=true;clearTimeout(selectionTimer);
  },true);
  document.addEventListener('pointerup',e=>{selectionDragging=false;if(e.composedPath().includes(host))return;scheduleSelectedAccount();},true);
  document.addEventListener('pointercancel',()=>{selectionDragging=false;clearTimeout(selectionTimer);},true);
  document.addEventListener('keydown',e=>{if(e.key==='Shift'){selectionKeyboard=true;clearTimeout(selectionTimer);}},true);
  document.addEventListener('keyup',e=>{if(e.key==='Shift')selectionKeyboard=false;if(e.key==='Shift'||e.key.startsWith('Arrow'))scheduleSelectedAccount();},true);
  window.addEventListener('blur',()=>{selectionDragging=false;selectionKeyboard=false;clearTimeout(selectionTimer);});

  const schedule=()=>{clearTimeout(timer);timer=setTimeout(scan,250);};
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(scan,1800);window.addEventListener('popstate',schedule);scan();
})();
