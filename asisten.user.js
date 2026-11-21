// ==UserScript==
// @name         LiveChat • Pengingat Member
// @namespace    local.livechat.pengingat
// @version      2.73.41
// @description  Celestial Orchid 2.73.37 (desain premium saja): pencocokan admin-led; nama/bank admin dicari dalam pesan member yang diblok, tanpa mencampur frasa lupa password. NOW/OLD/888, bubble mini.
// @match        https://my.livechatinc.com/*
// @match        https://app.chatgacor.com/*
// @match        https://agwl2.admitoto.com/*
// @match        *://agwl2.suksesbogil.com/*
// @grant        GM_addValueChangeListener
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      agwl2.admitoto.com
// @connect      agwl2.suksesbogil.com
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  if(window.top!==window.self)return;
  if (document.getElementById('lc-pengingat-bosku')) return;
  const isChatGacor=location.hostname==='app.chatgacor.com';
  // Chat saya dan Arsip bisa menampilkan room tanpa mengganti URL (SPA).
  // Jangan menolak chat hanya karena ID room tidak terdapat di path.
  function gacorPage(){
    const path=location.pathname.match(/^\/app\/([^/]+)\/(my-chats|my_chat|chats|archives?|archived-chats|arsip)(?:\/(.*))?\/?$/i);
    const hashPath=location.hash.replace(/^#!?/, '').split('?')[0];
    const archivePattern=/(?:^|\/)(archives?|archived(?:[-_]chats)?|chat[-_]archives?|arsip)(?:\/|$)(.*)/i;
    const archive=hashPath.match(archivePattern)||location.pathname.match(archivePattern);
    if(archive){
      const [room='', ...thread]=archive[2].split('/').filter(Boolean);
      const query=new URLSearchParams(location.hash.split('?')[1]||location.search);
      const id=room||['conversation_id','conversationId','chat_id','chatId','room','roomId','id'].map(k=>query.get(k)).find(Boolean)||'';
      return {app:location.pathname.split('/')[2]||'',section:'arsip',room:id,thread:thread.join('/')};
    }
    const query=new URLSearchParams(location.search);
    const archiveLabel=/^(?:arsip|archive[sd]?)(?: (?:chat|percakapan))?(?:\s*\(?\d+\)?)?$/i;
    const archiveTab=['tab','view','section','status','filter'].some(key=>archiveLabel.test(query.get(key)||''));
    const labels=document.querySelectorAll('h1,h2,[role="heading"],[aria-selected="true"],[aria-current="page"],nav .active,aside .active,[role="tab"][data-state="active"]');
    const archiveHeading=Array.from(labels).some(el=>el.getClientRects().length && archiveLabel.test((el.getAttribute('aria-label')||el.textContent||'').trim()));
    if(archiveTab||archiveHeading){
      const room=['conversation_id','conversationId','chat_id','chatId','room','roomId','id'].map(key=>query.get(key)).find(Boolean)||path?.[3]||'';
      return {app:location.pathname.split('/')[2]||'',section:'arsip',room,thread:''};
    }
    if(!path)return null;
    const parts=(path[3]||'').split('/').filter(Boolean);
    const room=parts[0]||['conversation_id','conversationId','chat_id','chatId','room','roomId','id'].map(x=>query.get(x)).find(Boolean)||'';
    return {app:path[1],section:path[2],room,thread:parts.slice(1).join('/')};
  }
  const isArchive=()=>isChatGacor ? !!gacorPage()&&/archive|arsip/i.test(gacorPage().section) : /^\/archives?(?:\/|$)/.test(location.pathname);
  // ID lokal bukan informasi yang dikirim keluar. Hanya menjaga agar hasil
  // rekening percakapan A tidak terbawa ketika berpindah ke percakapan B.
  const gacorDomKeys=new WeakMap();let gacorDomSeq=0;
  function gacorKeyText(s){
    const value=String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
    let hash=2166136261;for(let i=0;i<value.length;i++)hash=Math.imul(hash^value.charCodeAt(i),16777619);
    return (hash>>>0).toString(36);
  }
  function gacorActiveIdentity(){
    const selectors='[aria-selected="true"],[aria-current="page"],[data-active="true"],[data-selected="true"],[data-state="active"],.chat-item.active,.chat-item.selected,.conversation-item.active,.conversation-item.selected';
    const selected=[...document.querySelectorAll(selectors)].filter(el=>!el.closest('#lc-pengingat-bosku')&&el.getClientRects().length&&
      (el.closest('aside,nav,[role="listbox"],.chat-list,.conversation-list,[data-testid="chat-list"]')||/chat|convers|room/i.test(String(el.className||''))));
    const ids=[];
    for(const e of selected){
      const target=e.closest('[data-chat-id],[data-conversation-id],[data-room-id]')||e;
      const id=['data-chat-id','data-conversation-id','data-room-id','data-id'].map(k=>target.getAttribute(k)||e.getAttribute(k)).find(Boolean);
      const href=e.getAttribute('href')||e.closest('a[href]')?.getAttribute('href')||'';
      if(id)ids.push('id:'+id);
      else if(/(?:chat|room|conversation)\/?[a-z\d_-]{3,}/i.test(href))ids.push('link:'+href);
      else {
        const title=(e.querySelector('[data-testid*="name"],.name,.contact-name')?.textContent||e.textContent||'').replace(/\s+/g,' ').trim();
        if(title&&title.length<=130)ids.push('selected:'+gacorKeyText(title));
      }
    }
    const distinct=[...new Set(ids)];if(distinct.length===1)return distinct[0];
    // Bila daftar chat tidak menunjukkan item terpilih, baca identitas
    // dari header percakapan, bukan dari daftar chat atau daftar kontak.
    const headers=[...document.querySelectorAll('[data-testid="conversation-header"],[data-testid="chat-header"],.conversation-header,.chat-header,[data-testid="contact-header"]')]
      .filter(el=>el.getClientRects().length&&!el.closest('aside,nav,[role="navigation"]')&&!el.closest('#lc-pengingat-bosku'));
    if(headers.length===1){
      const h=headers[0],id=['data-chat-id','data-conversation-id','data-room-id'].map(k=>h.getAttribute(k)).find(Boolean);
      if(id)return 'headerid:'+id;
      const title=(h.querySelector('[data-testid*="name"],h1,h2,h3,strong,.contact-name,.name')?.textContent||h.textContent||'').replace(/\s+/g,' ').trim();
      if(title&&title.length<=100)return 'header:'+gacorKeyText(title);
    }
    return '';
  }
  function gacorTranscriptKey(){
    const area=gacorScope();if(!area)return '';
    const explicit=['data-chat-id','data-conversation-id','data-room-id'].map(k=>area.getAttribute(k)).find(Boolean);
    if(explicit)return 'scopeid:'+explicit;
    // Sebagai pilihan terakhir, ikat pada DOM transkrip ini saja dan pesan
    // pertama yang stabil. Tidak memakai ID universal untuk semua room.
    let local=gacorDomKeys.get(area);
    if(!local){local='dom'+(++gacorDomSeq);gacorDomKeys.set(area,local);}
    const first=[...area.querySelectorAll('[data-message-id],[data-testid="message"],.message-row,.chat-message,.message-item')]
      .find(e=>e.getClientRects().length);
    const seed=first?.getAttribute('data-message-id')||first?.textContent?.slice(0,110)||'';
    return local+(seed?':'+gacorKeyText(seed):'');
  }
  const conversationRoute=()=>{
    if(!isChatGacor)return location.pathname+(isArchive()?location.search+location.hash:'');
    const page=gacorPage();if(!page)return location.pathname+location.search+location.hash;
    const identity=page.room ? 'room:'+page.room+(page.thread?':'+page.thread:'') : gacorActiveIdentity()||gacorTranscriptKey()||'unselected';
    return 'chatgacor:'+page.app+':'+(page.section==='arsip'?'arsip:':'')+identity;
  };
  const allowedTopics=new Set(['deposit','withdraw','username','password']);
  let intentCorrections={};
  try{const saved=JSON.parse(localStorage.getItem('lc-intent-corrections-v1')||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))intentCorrections=saved;}catch{}
  function normalizeMemberLanguage(value){
    // Semua pola salah ketik diproses hanya sebagai petunjuk kebutuhan member,
    // bukan perintah untuk otomatis mereset sandi.
    return String(value||'').normalize('NFKC').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g,'')
      .replace(/\b(?:lupaa+|lupah|lupaak|lpa|lp|lup)\b/g,'lupa')
      .replace(/\b(?:pasword|paswrod|pasworrd|paswod|paswrd|passwod|passwor|pswod|psword|pswd|pswrd|pwsod|pasor|paspor|pawod|paword|pword|passwordnya|passwordku|pwku|pwnya|pw|psw)\b/g,'password')
      .replace(/\b(?:slah|salahh|salh)\b/g,'salah')
      .replace(/\b(?:usernam|usernme|usernem|usernamenya|usernameku|useridnya|idnya)\b/g,'username')
      .replace(/\b(?:diblok|keblok|ke blok|di blok|terblok|teblokir|terblokirr+|keblokir|di blokir)\b/g,'diblokir')
      .replace(/\b(?:akunku|akunnya)\b/g,'akun').replace(/\b(?:ke\s*kunci|di\s*kunci)\b/g,'terkunci')
      .replace(/\b(?:blom|blum|belom|belim|blm)\b/g,'belum')
      .replace(/\b(?:masok|msk|masukkk)\b/g,'masuk')
      .replace(/\b(?:ggnti|gganti|gnti|gnt|gntii|gantii|gantiin)\b/g,'ganti')
      .replace(/\b(?:menggnti|menganti)\b/g,'mengganti')
      .replace(/\b(?:nmr|nomer)\b/g,'nomor')
      .replace(/\b(?:no\.?\s*rek|no\.?\s*rekening|norek|no rekning)\b/g,'nomor rekening')
      .replace(/\b(?:rekning|rekenig|rekeningnya|reknya)\b/g,'rekening')
      .replace(/\b(?:yg)\b/g,'yang').replace(/\b(?:udh|udah|sdh)\b/g,'sudah')
      .replace(/\b(?:tdk|tak|gak|ga|nggak|ngga|enggak|gk|gbs|nggk)\b/g,'tidak')
      .replace(/\b(?:gabisa|gakbisa|nggabisa|nggakbisa|tdkbisa|tidakbisa)\b/g,'tidak bisa')
      .replace(/\b(?:ga\s*bisa|gak\s*bisa|tidak\s*bsa|tdk\s*bs)\b/g,'tidak bisa')
      .replace(/\s+/g,' ').trim();
  }
    function wantsAccountChange(value){
    const t=normalizeMemberLanguage(value);
    if(/\b(?:batal|jangan|tidak jadi|gak jadi|ga jadi|nggak jadi|tidak mau)\b/.test(t))return false;
    return /\b(?:ganti|mengganti|ubah|mengubah|tukar|pindah|pindahkan|perbarui|update)\b/.test(t)&&/\b(?:rek(?:ening)?|norek|akun(?: yang)? terdaftar|akun|bank|e[- ]?wallet|nomor dana|nomor ovo|no\.? dana)\b/.test(t)&&! /\b(?:password|kata sandi)\b/.test(t);
  }
  function changeAdvice(messages){
    const start=messages.findIndex(m=>m.kind==='member'&&wantsAccountChange(m.text));
    const category='GANTI REKENING / AKUN';
    let requested=false,reason='',candidate='',cancelled=false;
    if(start<0)return {category,title:'PERIKSA PERMINTAAN MEMBER',body:'Permintaan perubahan belum terbaca.',tone:'review'};
    const target=/\b(?:rek(?:ening)?|norek|akun|bank|e[- ]?wallet|dana|ovo)\b/i;
    const asksReason=t=>/\b(?:kenapa|mengapa|knp|alasan(?:nya)?|sebab(?:nya)?|kendala(?:nya)?)\b/i.test(t)&&(/\?|\b(?:apa|boleh|bisa|mohon|tolong|sebut|beritahu|jelas|info|kenapa|mengapa|knp)\b/i.test(t))&&!/\b(?:sudah (?:tanya|ditanya|dijelaskan)|alasan (?:sudah|telah))\b/i.test(t);
    for(let i=Math.max(0,start-3);i<messages.length;i++){
      const m=messages[i],t=normalizeMemberLanguage(m.text).trim();
      if(m.kind==='agent'){
        if(asksReason(t)&&(!/\b(?:deposit|withdraw|password|scatter)\b/i.test(t)||/ganti|ubah|pindah/i.test(t))&&(i>=start||target.test(t)&&/ganti|ubah|pindah/i.test(t)))requested=true;
        continue;
      }
      if(m.kind!=='member'||i<start)continue;
      if(/\b(?:batal|tidak jadi|gak jadi|ga jadi|nggak jadi)\b/i.test(t)&&/ganti|ubah|pindah/i.test(t)){cancelled=true;continue;}
      if(wantsAccountChange(t))cancelled=false;
      const explicit=/\b(?:karena|karna|soalnya|sebab|alasannya|alasan saya)\b/i.test(t);
      const problem=/\b(?:terblokir|diblokir|keblokir|hilang|rusak|hangus|nonaktif|tidak aktif|gak aktif|ga aktif|ditutup|salah input|salah (?:nomor|rekening)|bukan (?:punya|milik) saya)\b/i.test(t);
      if((explicit&&(target.test(t)||wantsAccountChange(t)||requested&&!/\b(?:deposit|withdraw|password|scatter)\b/i.test(t)))||problem&&target.test(t)){reason=m.text.trim().slice(0,220);candidate='';}
      else if(requested&&!reason&&!wantsAccountChange(t)&&/[a-z]{3}/i.test(t)&&! /^(?:iya|ya|oke|ok|siap|bos|bosku|makasih|terima kasih)[.!\s]*$/i.test(t)&&!/^\s*(?:user\s*id|username|norek|no\.?\s*rek(?:ening)?|rekening)\s*[:=]/i.test(t)&&!/^\s*[\d\s.,-]+\s*$/.test(t))candidate=m.text.trim().slice(0,220);
    }
    if(cancelled)return {category,title:'PERMINTAAN GANTI DIBATALKAN',body:'Member menyatakan batal mengganti. Periksa pesan terakhir sebelum melanjutkan.',tone:'waiting'};
    if(reason)return {category,title:'ALASAN SUDAH DISAMPAIKAN',body:'Jangan tanya alasan lagi ya bosku. Keterangan member: “'+reason+'”. Cocokkan dengan permintaan perubahan sebelum melanjutkan.',tone:'ready'};
    if(candidate)return {category,title:'ADA JAWABAN — PERIKSA ALASANNYA',body:'AI / agen sudah menanyakan alasan. Cek jawaban member: “'+candidate+'”. Jika belum menjawab alasan perubahan, klarifikasi bagian yang belum jelas saja.',tone:'review'};
    if(requested)return {category,title:'ALASAN SUDAH DITANYAKAN',body:'AI / agen sudah menanyakan alasan. Jangan tanya ulang; tunggu atau cek jawaban member di atas ya bosku.',tone:'waiting'};
    return {category,title:'TANYAKAN ALASAN PERUBAHAN',body:'Pertanyaan alasan belum terdeteksi pada chat yang terbaca. Tanyakan: “Boleh diinformasikan alasan ingin mengganti rekening atau akun yang terdaftar, bosku?”',tone:'review'};
  }
  // Local language rules: inferred intent is an operator hint, not an AI verdict.
  function detectIntent(value) {
    const correction=intentCorrections[normalizeMemberLanguage(value).trim()];
    if(Array.isArray(correction)){
      const enabled=correction.filter(t=>allowedTopics.has(t));
      if(enabled.length)return [...new Set(enabled)];
    }
    const t=normalizeMemberLanguage(value)
      .replace(/\b(?:sm|sma)\b/g,'sama')
      .replace(/\b(?:uname|userid|user\s+name)\b/g,'username')
      .replace(/\b(?:depo|dp)\b/g,'deposit')
      .replace(/\b(?:wd|wede|withd(?:r)?aw|withdrawal)\b/g,'withdraw')
      .replace(/\b(?:topup|top-up)\b/g,'top up');
    const types=new Set();
    if(wantsAccountChange(value))types.add('change');
    // Pisahkan klausa agar 'sudah bisa login, tapi lupa password' tetap terdeteksi.
    const parts=t.split(/[,.!?;\n]+|\btapi\b|\btetapi\b|\bmelainkan\b|\bdan\s+(?=(?:proses|deposit|withdraw|lupa)\b)|\bterus\b/);
    for(let part of parts){
      part=part.trim();
      if(!part || /\b(?:bukan|tidak perlu|tidak lupa|tidak salah|jangan)\b/.test(part))continue;
      if(/\b(?:scatter|scater|skater|skatter)\b/.test(part))types.add('scatter');
      const unresolved=/\b(?:belum|tidak|lupa|salah|gagal|pending|tertunda|nyangkut|hilang|reset|riset|ganti|ubah|mengubah|cek|tolong|bantu|minta|baru)\b/.test(part);
      if(!unresolved && /\b(?:sudah|berhasil|selesai|sukses|normal)\b/.test(part))continue;
      const recovery=/\b(?:lupa|tidak ingat|tidak inget|tidak hafal|tidak tahu|tidak tau|hilang|reset|riset|ganti|ubah|mengubah|salah|invalid|error|bermasalah|minta|tolong|bantu)\b/;
      const hasPassword=/\b(?:password|kata\s+sandi|sandi|passcode|kata\s+kunci)\b/.test(part);
      const cannotLogin=/\b(?:tidak\s+(?:bisa|dapat)|gagal|susah|sulit)\s+(?:login|log\s*in|masuk(?:\s+(?:akun|game))?|akses\s+akun)\b|\b(?:login|masuk\s+akun)\s+(?:gagal|error|tidak\s+bisa)\b/.test(part);
      const shortHelp=hasPassword&&/\b(?:min|mimin|admin|bos|bosku|kak|gan)\b/.test(part)&&part.split(/\s+/).length<=6;
      if((hasPassword&&(recovery.test(part)||shortHelp))||cannotLogin)types.add('password');
      if((/\b(?:username|user\s*id|nama\s+(?:akun|pengguna)|id\s+akun)\b/.test(part)&&recovery.test(part))||/\blupa\s+(?:akun|id)\b/.test(part))types.add('username');
      if(/\b(?:deposit|top\s*up|isi saldo|setor(?:an)?)\b/.test(part))types.add('deposit');
      else if(/\b(?:saldo|transfer|tf)\b/.test(part)&&/\b(?:belum masuk|tidak masuk|belum bertambah|tidak bertambah|nyangkut)\b/.test(part)&&! /\b(?:withdraw|penarikan|tarik)\b/.test(part))types.add('deposit');
      if(/\b(?:withdraw|penarikan|tarik (?:dana|saldo|uang))\b/.test(part))types.add('withdraw');
    }
    // 'km bisa kan' saja tidak cukup untuk mengidentifikasi jenis akun;
    // bila muncul setelah permintaan password, kebutuhan sudah aktif dari pesan sebelumnya.
    return [...types].filter(t=>allowedTopics.has(t));
  }
    // Interpret adjacent short member fragments together, without borrowing
  // an agent's words or combining identity/payment data into a request.
  function contextualMessages(messages){
    let fragments=[];
    return messages.map(m=>{
      const raw=String(m.text||''),t=normalizeMemberLanguage(raw).trim();
      const barrier=m.kind!=='member'||!t||t.length>180||/\d|[:=]/.test(t)||
        /\b(?:nama rekening|nomor rekening|nama bank|user id)\s*[:=]/.test(t)||
        /\b(?:batal|jangan|tidak jadi|gak jadi|ga jadi|bukan|selesai|berhasil|makasih|terima kasih)\b/.test(t);
      if(barrier){fragments=[];return {...m};}
      const direct=detectIntent(raw);
      const combined=[...fragments,raw].join(' ').replace(/\s*[.!?]+\s*/g,' ');
      // A known request ends the fragment window so a different topic is not
      // pulled into it later. Negations and resolved statements also end it.
      const inferred=fragments.length?detectIntent(combined):[];
      const use=inferred.length&&direct.length===0;
      if(direct.length||use||/\b(?:sudah|tidak|gak|ga|gk|nggak)\b/.test(t))fragments=[];
      else fragments=[...fragments,raw].slice(-3);
      return use?{...m,text:combined,originalText:raw,contextual:true}:{...m};
    });
  }

  const intentMatcher=type=>({test:value=>detectIntent(value).includes(type)});
  const rules = [
    ['change',intentMatcher('change'),'TANYAKAN ALASAN PERUBAHAN','Periksa apakah AI / agen sudah menanyakan alasan perubahan.'],
    ['scatter', intentMatcher('scatter'), 'PL SCATTER — PERIKSA BUKTI', 'Periksa gambar detail putaran dan riwayat permainan. Cocokkan nomor transaksi / kode tiket, waktu, nominal taruhan, dan jumlah scatter. Jika bukti belum lengkap, minta bagian yang kurang saja ya bosku.'],
    ['deposit', intentMatcher('deposit'), 'MINTA BUKTI', 'Minta bukti deposit kepada member ya bosku.'],
    ['password', intentMatcher('password'), 'CEK DATA SEBELUM RESET', 'Periksa hasil pencarian rekening di panel Now / Old, lalu cocokkan identitas member ya bosku.'],
    ['username', intentMatcher('username'), 'KASIH USER ID SAJA', 'Kasih User ID saja ya bosku. JANGAN reset password-nya.'],
    ['withdraw', intentMatcher('withdraw'), 'CEK USER ID DI ATAS', 'Cek User ID pada chat di atas. Jika belum ada, minta User ID ya bosku.']
  ];
  function clarification(messages){
    const members=messages.filter(m=>m.kind==='member'&&m.text.trim());
    const known=members.flatMap(m=>detectIntent(m.text));
    const recovery=members.map(m=>detectIntent(m.text).filter(t=>t==='password'||t==='username')).filter(a=>a.length).at(-1)||[];
    if(new Set(recovery).size>1&&/\b(?:atau|or)\b/i.test([...members].reverse().find(m=>detectIntent(m.text).some(t=>t==='password'||t==='username'))?.text||''))return {title:'PASTIKAN KEBUTUHAN AKUN',body:'Member menyebut username dan password. Tanyakan apakah perlu User ID saja atau juga reset password. Pencarian otomatis menunggu maksud yang jelas.',message:members.at(-1)?.text||''};
    if(known.length)return null;
    const latest=[...members].reverse().find(m=>/[a-z]/i.test(m.text)&&!/^\s*(?:no(?:mor)?\.?\s*(?:rek(?:ening)?)|norek|rekening|user\s*id|username)\s*[:=]/i.test(m.text))?.text||members.at(-1)?.text||'';
    if(!latest)return null;
    const login=/\b(?:login|log in|masuk akun|buka akun|akses akun|akun.*(?:blokir|terkunci))\b/i.test(latest);
    return {title:login?'KENDALA LOGIN • PERLU DIPASTIKAN':'MAKSUD MEMBER BELUM JELAS',body:login?'Tanyakan pesan error yang muncul dan apakah yang lupa User ID atau password. Gagal login saja belum cukup untuk menyarankan reset.':'Tanyakan: “Ada yang bisa dibantu bosku? Kendalanya deposit, withdraw, lupa password, lupa User ID, atau hal lain?”',message:latest};
  }
  // Text-only signals. Image pixels cannot be classified by these local rules.
  function conductNotice(value){
    const original=String(value||'');
    const t=original.normalize('NFKC').toLowerCase()
      .replace(/[“"][^”"]*[”"]/g,' ')
      .replace(/\b(?:gak|ga|nggak|ngga|gk|gkk|tdk|enggak|gag)\b/g,'tidak')
      .replace(/\b(?:gamenya|game nya|permainannya|permainan nya)\b/g,'game')
      .replace(/([a-z])\1{2,}/g,'$1$1');
    const parts=t.split(/[.!?;\n]+/).filter(x=>! /\b(?:jangan (?:bilang|ngomong|menghina|maki)|dibilang|dikatai|kata kasar|contoh makian)\b/.test(x));
    const dirty=/\b(?:anj(?:ing|eng|ir|rit)|anjg|bangsat|bajingan|bgst|kontol|k[o0]nt[o0]l|kntl|memek|m[e3]m[e3]k|mmk|ngentot|ngentod|ngewe|puki|pukimak|pepek|jancuk|jancok|cok|fuck|shit|tai|taik|tolol|goblok|goblog|bego|bodoh)\b/;
    // Evaluate each clause, so negated praise does not suppress a later complaint.
    const gameParts=t.split(/[.!?;\n]+|\btapi\b|\btetapi\b/);
    const badGame=gameParts.some(x=>{
      if(/\b(?:bukan|jangan bilang|tidak pernah bilang)\b/.test(x))return false;
      const gameNamed=/\b(?:game|permainan|slot)\b/.test(x);
      const negative=/\b(?:jelek|buruk|ampas|sampah|busuk|tidak bagus|tidak enak|tidak seru|tidak adil|curang|rigged)\b/.test(x);
      const losing=/\b(?:susah menang|sulit menang|kalah (?:terus|mulu|melulu)|rungkad(?: terus| mulu)?|tidak (?:pernah |bisa |ada )?(?:menang|gacor|kemenangan)|belum (?:pernah )?menang)\b/.test(x);
      const stop=/\b(?:(?:tidak|ogah|malas|males|kapok)\s+(?:mau\s+)?main(?:\s+lagi)?|(?:berhenti|pensiun|stop)\s+(?:main|bermain))\b/.test(x);
      return (gameNamed&&negative)||losing||stop;
    });
    const curse=parts.some(x=>{
      if(/\b(?:tidak|bukan)\s+(?:bodoh|goblok|tolol|bego)\b/.test(x))x=x.replace(/\b(?:tidak|bukan)\s+(?:bodoh|goblok|tolol|bego)\b/g,'');
      x=x.replace(/\b(?:anjing|tai)\s+(?:saya|peliharaan|tetangga)\b/g,'');
      return dirty.test(x);
    });
    if(!curse&&!badGame)return null;
    return {title:'Kasih PK doa aja',category:curse?'MEMBER CAKAP TIDAK BAIK':'KELUHAN TENTANG GAME',tone:'conduct',
      body:curse&&badGame?'Terdeteksi makian / ucapan kotor dan keluhan tentang game.':curse?'Terdeteksi makian / ucapan kotor dalam pesan member.':'Member mengeluhkan kualitas atau hasil permainan.',
      message:original.slice(0,240)};
  }
  function memberHasImage(e){
    // Ignore avatars, icons and tiny inline emoji; never infer explicit content.
    return [...e.querySelectorAll('img')].some(img=>{
      const label=[img.alt,img.className,img.getAttribute('data-testid')].join(' ');
      if(/avatar|emoji|emoticon|icon|profile/i.test(label))return false;
      return Math.max(img.naturalWidth||0,img.width||0)>=100 && Math.max(img.naturalHeight||0,img.height||0)>=70;
    });
  }
  // Context is evaluated again on every scan, so a later AI request or
  // member reply updates the existing Deposit / Withdraw card immediately.
  function idContext(messages) {
    let requested = false, id = '', candidate = '', numericReply=false;
    const label = /\b(?:user\s*id|username|user\s*name|id\s*(?:akun|anda|kamu|bosku)|id)\b/i;
    const request = /\b(?:minta|meminta|boleh|tolong|mohon|sebutkan|berikan|kirim|kirimkan|infokan|informasikan|isi|masukkan|cantumkan|berapa)\b/i;
    const invalid = /^(?:saya|aku|anda|kamu|nya|bos|bosku|ya|iya|oke|ok|adalah|ini|itu|lupa|belum|tidak|ada|mana|berapa|tolong|cek|deposit|withdraw|username|userid|terblokir|teblokir|diblokir|keblokir|blokir|blok|dikunci|kekunci|kunci|di|locked|blocked|banned|suspend|terkunci|bosku|kak|min|admin|kenapa|mengapa|karena|tolong|proses|masih|sudah|bang|yang|kena|bank|dana|ovo|terdaftar|nomor|user|makasih|terimakasih|halo|hello|siap|sebentar|tunggu|bentar|terima)$/i;
    for (const m of messages) {
      const t = m.text.trim();
      if (m.kind === 'agent' && label.test(t) && (request.test(t) || /user\s*id.*\?/i.test(t))) requested = true;
      if(m.kind==='agent')numericReply=label.test(t)&&request.test(t)&&!/rekening|norek|nomor hp|telepon/i.test(t);
      if (m.kind !== 'member') continue;
      // Explicit values only. Do not treat an AI request as proof an ID exists.
      const match = t.match(/\b(?:user\s*id|username|user\s*name|id(?:\s+akun)?|akun)(?:\s+(?:saya|aku|nya))?(?:\s*[:=]\s*|\s+adalah\s+|\s+)([a-z0-9_.-]{3,32})(?![a-z0-9_.-])/i);
      if (match && !invalid.test(match[1])) { id=match[1]; candidate=''; }
      else if(numericReply&&!id&&/^\d{3,40}$/.test(t))candidate=t;
      else if (!id && /^[a-z0-9_.-]{3,32}$/i.test(t) && /[a-z]/i.test(t) && (requested||/\d/.test(t)) && !invalid.test(t)) candidate=t;
      numericReply=false;
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
      title=context.requested?'ADA JAWABAN SETELAH PERMINTAAN ID':'ADA CALON USER ID DI ATAS'; tone='review';
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
  // Read-only account lookup; completion status follows SENT chat messages. No reset/password mutation.
  const defaultAdmin = 'https://agwl2.admitoto.com';
  const suksesLogin = 'http://agwl2.suksesbogil.com/?passkey=WH9eRDBqtriK4pL';
  const adminOrigins = [defaultAdmin, 'http://agwl2.suksesbogil.com', 'https://agwl2.suksesbogil.com'];
  const adminKey = 'lc-active-admin-origin';
  const onAdmin = adminOrigins.includes(location.origin);
  const savedAdmin = GM_getValue(adminKey, defaultAdmin);
  const ADMIN_ORIGIN = onAdmin ? location.origin : (adminOrigins.includes(savedAdmin) ? savedAdmin : defaultAdmin);
  const adminCacheScope = ADMIN_ORIGIN === defaultAdmin ? '' : ADMIN_ORIGIN + ':';
  const ADMIN_PATHS = ['/agentplayerlist.php','/agentplayerlist_old.php'];
  const resetIntent = intentMatcher('password');
  const accountLabel = /(?:nomor\s*rekening|no\.?\s*(?:rekening|rek)\b|norek\b|rekening\b|account\s*(?:number|no\.?))/i;

  if(onAdmin){
    const jobId = new URLSearchParams(location.hash.slice(1)).get('lc-profile-job') || sessionStorage.getItem('lc-profile-job');
    if(jobId){
      void runProfileWorker();
    }else if(savedAdmin !== location.origin){
      GM_setValue(adminKey, location.origin);
    }
    return;
  }
  GM_addValueChangeListener(adminKey, (_key, _previous, origin) => {
    if(adminOrigins.includes(origin) && origin !== ADMIN_ORIGIN) location.reload();
  });

  const usernameIntent=intentMatcher('username');
  // Inspect sent agent messages only; never retain the password value.
  // v2.73.23: selesai HANYA setelah balasan dari agen benar-benar muncul
  // pada transkrip (bukan setelah data rekening cocok / tombol reset diklik).
  // Tidak menyimpan teks ataupun nilai password; hanya tipe dan waktu selesai.
  function sentCompletion(messages,fallbackRequest=''){
    let request=['password','username'].includes(fallbackRequest)?fallbackRequest:'';
    let complete='',agentParts=[];
    for(const m of messages){
      if(m.kind==='member'){
        agentParts=[];
        const intents=detectIntent(m.originalText||m.text||'');
        if(intents.includes('password')){request='password';complete='';}
        else if(intents.includes('username')){request='username';complete='';}
        continue;
      }
      if(m.kind!=='agent'||!request){agentParts=[];continue;}
      const part=String(m.text||'').normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\u00a0/g,' ')
        .replace(/[*_`]/g,'').trim();
      if(!part)continue;
      // Instruksi / contoh balasan bukan bukti sandi baru telah dikirim.
      if(/\b(?:contoh\s+(?:format|pesan|template)|jangan\s+(?:kirim|dikirim)|template\s+balasan)\b/i.test(part)){
        agentParts=[];continue;
      }
      if(/\b(?:user\s*id|userid|username)\s*[:=]/i.test(part))agentParts=[];
      agentParts.push(part);if(agentParts.length>6)agentParts.shift();
      const t=agentParts.join('\n');
      const uid=t.match(/\b(?:user\s*id|userid|username)\s*[:=]\s*([a-z0-9_.-]{3,40})(?![a-z0-9_.-])/i);
      if(!uid||/^(?:password|pasword|note|silahkan|silakan|userid|username|contoh|kosong|belum)$/i.test(uid[1]))continue;
      // Password harus memiliki nilai sesudah label, bukan sekadar kata "password".
      const pass=t.match(/\b(?:password|pasword|passwod|kata\s+sandi)\s*[:=]\s*([^\s:]{3,100})/i);
      const hasPassword=Boolean(pass&&!/^(?:note|silahkan|silakan|contoh|password|baru|belum|xxx+|[.*-]+)$/i.test(pass[1])&&
        !/^(?:xxx+|\*+|\.{3,}|\-{3,})$/i.test(pass[1]));
      const note=/\bnote\s*:/i.test(t)&&/\b(?:simpan|memo|catat)\b/i.test(t);
      const login=/(?:silakan|silahkan|coba|cek|dicoba|gunakan|pakai)[\s\S]{0,70}\b(?:login|masuk|password)\b/i.test(t);
      if(hasPassword){
        // Jika agen mengirim User ID + password baru, itu penutupan reset,
        // termasuk saat permintaan awal member hanya berbunyi "lupa akun".
        complete='password';
      }else if(request==='username'&&!/\b(?:password|pasword|passwod|kata\s+sandi)\s*[:=]/i.test(t)&&
        (note||login||/^\s*(?:user\s*id|userid|username)\s*[:=]\s*[a-z0-9_.-]{3,40}\s*[.!\s]*$/i.test(t))){
        complete='username';
      }
    }
    return complete;
  }
  const conversationDonePrefix='lc-conversation-completed-v1:'+adminCacheScope;
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
    setStatus(completedStatusText(done.type));
  }
  function completedStatusText(type){
    return type==='username'
      ? '✓ SELESAI — User ID sudah dikirim kepada member. Tidak perlu reset password.'
      : '✓ SELESAI — Balasan reset password sudah dikirim kepada member. Tidak perlu cari rekening ulang.';
  }

  // 2.73.11: Perbaikan label Jenis: agar tidak menempel pada nama; teks sama tidak otomatis menjadi CEK. Red hanya untuk perbedaan
  // yang tegas; format tidak dikenali / pernyataan berkonflik = kuning.
  function cleanAccount(value){
    // Nomor HP/e-wallet internasional dipetakan ke format lokal Indonesia.
    // +6281345455445 / 006281345455445 / 6281345455445 -> 081345455445.
    // Rekening bank biasa yang berawalan 62 (bukan 628 nomor HP) tidak diubah.
    const raw=String(value??'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
    const digits=raw.replace(/\D/g,'');
    if(!digits)return '';
    if(/^\+\s*62(?:[\s().-]*\d)/.test(raw)&&digits.startsWith('62'))return '0'+digits.slice(2);
    if(/^0062\d{7,14}$/.test(digits))return '0'+digits.slice(4);
    // Tanpa tanda +, hanya normalisasi 628... dalam panjang nomor seluler wajar.
    if(/^628\d{7,11}$/.test(digits))return '0'+digits.slice(2);
    return digits; // Nol di depan untuk rekening lain tetap dijaga.
  }
  const accountNumberRE=/^\d{5,25}$/;
  function numberRuns(value){
    const raw=String(value||'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,' ');
    const outputs=[];
    // Digit yang dipisahkan titik/strip/spasi tetap dianggap satu rekening
    // selama tidak ada dua kelompok panjang yang jelas merupakan rekening lain.
    for(const hit of raw.matchAll(/(?<!\d)(?:\+\s*)?\d(?:[\d\s.,\-\/]*\d)?(?!\d)/g)){
      const segment=hit[0],chunks=segment.match(/\d+/g)||[];
      if(!chunks.length)continue;
      let group=[],isFirstGroup=true;
      const flush=()=>{
        const v=(isFirstGroup&&segment.trimStart().startsWith('+')?'+':'')+group.join('');
        const canonical=cleanAccount(v);
        if(accountNumberRE.test(canonical))outputs.push(canonical);
        group=[];isFirstGroup=false;
      };
      for(const chunk of chunks){
        // 1234567890 9876543210 = dua nomor. Potongan pendek (mis.
        // 1234 5678 90) adalah satu nomor berformat kelompok digit.
        if(group.length&&group.join('').length>=5&&chunk.length>=5)flush();
        if(group.join('').length+chunk.length>25)flush();
        group.push(chunk);
      }
      flush();
    }
    return [...new Set(outputs)];
  }
  // Nama hanya dibandingkan setelah format diseragamkan; teks asli admin tidak diubah.
  // Kapital, spasi, titik, tanda hubung dan aksen bukan perbedaan identitas.
  // Jangan gunakan fuzzy/kemiripan nama untuk memberi lampu hijau otomatis.
  function normalizeHolder(value){
    let t=String(value||'').normalize('NFKD').replace(/\p{M}/gu,'')
      .normalize('NFKC').toLocaleUpperCase('id-ID')
      .replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g,'').replace(/\s+/g,' ').trim();
    if(!t||/^(?:-|N\/?A|NO NAME|BELUM ADA|BELUM TERBACA|TIDAK ADA|UNKNOWN|NONE)$/.test(t))return '';
    // Hapus label kolom bila penyalinan admin menyertakan judulnya.
    t=t.replace(/^(?:(?:NAMA\s+(?:PEMILIK\s+)?(?:REKENING|REK|NASABAH|LENGKAP)|NAMA\s+PEMILIK|ATAS\s+NAMA(?:\s+REKENING)?|A\s*\/?\s*N)\s*[:=\-]\s*)+/g,'')
      .replace(/^(?:BPK\.?|BAPAK|IBU|SDR\.?|SDRI\.?|MR\.?|MRS\.?)\s+/,'')
      // Jangan sampai label bank/nomor berikutnya menjadi bagian nama.
      .replace(/\s*(?:[.,;|]\s*|\s+)(?:JENIS(?:\s+BANK)?|BANK|E\s*WALLET|NOMOR\s+REKENING|NO\.?\s*REK)\s*[:=].*$/,'')
      // A trailing label with its value clipped is not part of a person's name.
      .replace(/\s*[.,;|]\s*(?:JENIS(?:\s+BANK)?|NAMA\s+BANK|BANK|E\s*WALLET)\s*$/,'')
      .trim();
    return t.replace(/[^\p{L}\p{N}]+/gu,'');
  }
  const BANK_ALIAS_LIST=[
    ['BCA',/^(?:BCA|CENTRAL ASIA|CENTRALASIA)$/],['BCA DIGITAL',/^(?:BCA DIGITAL|BLU|BLU BY BCA)$/],
    ['BRI',/^(?:BRI|RAKYAT INDONESIA|RAKYAT)$/],['BNI',/^(?:BNI|NEGARA INDONESIA|NEGARA)$/],
    ['BSI',/^(?:BSI|SYARIAH INDONESIA|SYARIAH)$/],['BTN',/^(?:BTN|TABUNGAN NEGARA|TABUNGAN)$/],
    ['MANDIRI',/^MANDIRI$/],['CIMB NIAGA',/^(?:CIMB|CIMB NIAGA)$/],
    ['DANAMON',/^DANAMON$/],['MAYBANK',/^MAYBANK$/],['PERMATA',/^PERMATA$/],
    ['JAGO',/^JAGO$/],['SEABANK',/^(?:SEA ?BANK|SEABANK)$/],['BJB',/^(?:BJB|JABAR BANTEN)$/],
    ['JATIM',/^JATIM$/],['JATENG',/^JATENG$/],['DKI',/^DKI$/],['DANA',/^DANA$/],
    ['OVO',/^OVO$/],['GOPAY',/^(?:GOPAY|GO PAY)$/],['LINKAJA',/^(?:LINKAJA|LINK AJA)$/],
    ['SHOPEEPAY',/^(?:SHOPEEPAY|SHOPEE PAY)$/],['NEOBANK',/^(?:NEOBANK|NEO BANK|NEO COMMERCE|NEO)$/],
    ['ALADIN',/^(?:ALADIN|ALADIN SYARIAH)$/],['PANIN',/^(?:PANIN|PAN INDONESIA)$/],
    ['OCBC',/^(?:OCBC|OCBC NISP|NISP)$/],['UOB',/^UOB$/],['MEGA',/^MEGA$/],['BCA SYARIAH',/^(?:BCA SYARIAH|SYARIAH BCA)$/],['MUAMALAT',/^MUAMALAT$/],['SINARMAS',/^SINARMAS$/],['BUKOPIN',/^(?:BUKOPIN|KB BUKOPIN)$/],['LINE BANK',/^(?:LINE BANK|LINEBANK)$/]
  ];
  const knownBankNames=new Set(BANK_ALIAS_LIST.map(x=>x[0]));
  // 2.73.21: ejaan bank diperiksa dari bentuk kanonis yang sama pada CHAT
  // dan ADMIN. Jangan pernah menyamakan dua bank hanya karena mirip.
  // Huruf besar/kecil, separator, dan leetspeak jelas: D4N4, D@N@,
  // B.C.A, BN1, 8R1, 0V0 diperbolehkan. Angka rekening TIDAK diubah.
  const BANK_EQUIVALENTS=[
    ['BCA',['BCA','BANK CENTRAL ASIA','CENTRAL ASIA']],
    ['BCA DIGITAL',['BCA DIGITAL','BLU','BLU BY BCA','BLUBYBCA']],
    ['BCA SYARIAH',['BCA SYARIAH','SYARIAH BCA']],
    ['BRI',['BRI','BANK RAKYAT INDONESIA','RAKYAT INDONESIA']],
    ['BNI',['BNI','BANK NEGARA INDONESIA','NEGARA INDONESIA']],
    ['BSI',['BSI','BANK SYARIAH INDONESIA','SYARIAH INDONESIA']],
    ['BTN',['BTN','BANK TABUNGAN NEGARA','TABUNGAN NEGARA']],
    ['MANDIRI',['MANDIRI','BANK MANDIRI']],
    ['CIMB NIAGA',['CIMB NIAGA','CIMB','BANK CIMB NIAGA']],
    ['DANAMON',['DANAMON','BANK DANAMON']],
    ['MAYBANK',['MAYBANK','BANK MAYBANK']],
    ['PERMATA',['PERMATA','BANK PERMATA']],
    ['JAGO',['JAGO','BANK JAGO']],
    ['SEABANK',['SEABANK','SEA BANK','BANK SEABANK']],
    ['BJB',['BJB','BANK JABAR BANTEN','JABAR BANTEN']],
    ['JATIM',['JATIM','BANK JATIM']],
    ['JATENG',['JATENG','BANK JATENG']],
    ['DKI',['DKI','BANK DKI']],
    ['DANA',['DANA','EWALLET DANA','E WALLET DANA']],
    ['OVO',['OVO','EWALLET OVO','E WALLET OVO']],
    ['GOPAY',['GOPAY','GO PAY','EWALLET GOPAY']],
    ['LINKAJA',['LINKAJA','LINK AJA']],
    ['SHOPEEPAY',['SHOPEEPAY','SHOPEE PAY']],
    ['NEOBANK',['NEOBANK','NEO BANK','NEO COMMERCE','NEO']],
    ['ALADIN',['ALADIN','BANK ALADIN','ALADIN SYARIAH']],
    ['PANIN',['PANIN','PAN INDONESIA']],
    ['OCBC',['OCBC','OCBC NISP','NISP']],
    ['UOB',['UOB','BANK UOB']],
    ['MEGA',['MEGA','BANK MEGA']],
    ['MUAMALAT',['MUAMALAT','BANK MUAMALAT']],
    ['SINARMAS',['SINARMAS','BANK SINARMAS']],
    ['BUKOPIN',['BUKOPIN','KB BUKOPIN']],
    ['LINE BANK',['LINE BANK','LINEBANK']]
  ];
  const BANK_LEET_DIGITS={'0':'O','1':'I','2':'Z','3':'E','4':'A','5':'S','6':'G','7':'T','8':'B','9':'G'};
  function bankLetters(value){
    return String(value??'').normalize('NFKD').replace(/\p{M}/gu,'')
      .normalize('NFKC').toUpperCase().replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g,'')
      .replace(/[@]/g,'A').replace(/\$/g,'S').replace(/[!]/g,'I')
      .replace(/[0-9]/g,c=>BANK_LEET_DIGITS[c]||c)
      .replace(/[^A-Z]/g,'');
  }
  const BANK_KEYS=new Map();
  for(const [name,aliases] of BANK_EQUIVALENTS){
    for(const item of [name,...aliases]){
      const k=bankLetters(item);
      if(BANK_KEYS.has(k)&&BANK_KEYS.get(k)!==name)throw Error('Alias bank ambigu: '+item);
      BANK_KEYS.set(k,name);
    }
  }
  function normalizeBank(value){
    let raw=String(value??'').normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g,'').trim();
    if(!raw||/^(?:-|N\/?A|UNKNOWN|NONE|BELUM TERBACA|TIDAK ADA)$/i.test(raw))return '';
    // Ambil hanya nilai bank yang diberi label; jangan menyerap label kolom
    // berikutnya, nama orang, atau nomor rekening.
    raw=raw.replace(/^(?:(?:PT\.?|PERSERO|TBK|JENIS\s+(?:BANK(?:NYA)?|E[- ]?WALLET)|NAMA\s+BANK|BANK(?:NYA)?|E[- ]?WALLET|DOMPET\s+DIGITAL|PAKAI|MENGGUNAKAN|GUNAKAN|ADALAH|SAYA)\s*[:=.-]?\s*)+/i,'').trim()
      .replace(/\s+(?:PERSERO|TBK|T\.?B\.?K\.?)\s*$/i,'').trim();
    const fragments=[raw];
    for(const match of raw.matchAll(/\(([^()]{2,60})\)/g))fragments.push(match[1]);
    const compact=raw.replace(/\([^()]*\)/g,' ').trim();if(compact!==raw)fragments.push(compact);
    const matches=new Set();
    for(const frag of fragments){
      const key=bankLetters(frag);
      const canonical=BANK_KEYS.get(key);
      if(canonical)matches.add(canonical);
      // Kesalahan huruf dobel yang tegas (contoh: DAAANAA), tetapi
      // pertahankan kecocokan khusus SHOPEEPAY/SEABANK dan nama resmi lain.
      if(!canonical){
        const collapsed=key.replace(/([A-Z])\1+/g,'$1');
        const options=new Set();
        for(const [alias,bank] of BANK_KEYS){
          if(alias.replace(/([A-Z])\1+/g,'$1')===collapsed)options.add(bank);
        }
        if(options.size===1)matches.add([...options][0]);
      }
    }
    // Tidak menebak lewat kemiripan/fuzzy jika jenis bank tidak jelas.
    if(matches.size===1)return [...matches][0];
    if(matches.size>1)return '';
    return raw.toLocaleUpperCase('id-ID').replace(/\s+/g,' ').trim();
  }
  // Gunakan singkatan resmi/umum untuk hasil chat, hasil admin, dan salinan.
  // Normalisasi hanya untuk nama bank yang dikenali; jika belum jelas,
  // pertahankan teks aslinya dan jangan menganggap bank cocok otomatis.
  function displayBank(value){
    const canonical=normalizeBank(value);
    return knownBankNames.has(canonical)?canonical:String(value||'').trim();
  }
  const chatBankRE=/\b(?:bank\s+(?:central\s+asia|rakyat\s+indonesia|negara\s+indonesia|syariah\s+indonesia|tabungan\s+negara|jatim|jateng|dki)|bca(?:\s+syariah)?|blu|bri|bni|bsi|btn|mandiri|cimb(?:\s+niaga)?|danamon|maybank|permata|jago|sea\s*bank|bjb|dana|ovo|go\s*pay|link\s*aja|shopee\s*pay|neo\s*bank|aladin|ocbc|uob|panin|mega|muamalat|sinarmas|bukopin|line\s*bank)\b/i;
  function validHolder(value){
    const raw=String(value||'').trim(),norm=normalizeHolder(raw);
    return /^[\p{L}][\p{L} .'-]{1,85}$/u.test(raw)&&norm.length>=3&&
      !knownBankNames.has(normalizeBank(raw)) &&
      !/\b(?:lupa|belum|tidak|gak|ga|tolong|minta|terblokir|hilang|kenapa|saldo|masuk|login|iya|oke|bosku|password|paspor|pasor|paswod|pswod|psword|pawod|pw|rekening|username|berapa|bukan|ganti|ubah|bank|saya|aku|nomor|silahkan|silakan|member|yang|benar|salah|mohon|bisa|kan|km)\b/i.test(raw) &&
      !detectIntent(raw).includes('password');
  }
  // Ambil label yang disediakan member; jangan menebak nama dari kalimat umum.
  const identityLabelRE=/(?:^|[\s,;|])((?:nomor|no\.?|number)\s*(?:rek(?:ening)?(?:nya)?|rekening(?:nya)?|account|dana|ovo|gopay)|norek(?:nya)?|rek(?:ening)?(?:nya)?|nama\s*(?:pemilik\s*)?(?:rek(?:ening)?(?:nya)?|rekening(?:nya)?)|nama\s+(?:pemilik|nasabah|penerima|lengkap)|atas\s+nama\s+(?:rek(?:ening)?|akun)|atas\s+nama|a\s*\/?\s*n\b|jenis\s+bank(?:nya)?|jenis(?:nya)?(?=\s*[:=])|nama\s+bank|bank(?:nya)?(?:\s*\/\s*(?:e[- ]?wallet|ewallet))?|e[- ]?wallet|dompet\s+digital|nama\s+(?:yang\s+benar|sebenarnya|saya)|nama\s*[:=])(?:\s+(?:saya|aku|anda|nya|yang\s+dipakai|yang\s+digunakan|adalah))?\s*[:=\-]?\s*/gi;
  function labelKind(label){
    const t=label.toLowerCase();
    if(/^(?:jenis(?:nya)?(?:\s+bank(?:nya)?)?\b|nama\s+bank|bank(?:nya)?|e[- ]?wallet|dompet)/.test(t))return 'bank';
    if(/^(?:nama|atas\s+nama|a\s*\/?\s*n\b)/.test(t))return 'holder';
    return 'number';
  }
  function clearIdentityValue(value){
    return String(value||'').trim().replace(/^[\s,:=\-]+/,'')
      .replace(/^(?:(?:saya|aku|punya\s+saya|yang\s+benar|seharusnya|maksud\s+saya|koreksi|revisi|adalah|yakni|yaitu)\s*[:=\-]?\s*)+/i,'')
      .replace(/[\s,.!?;]+$/,'').trim();
  }

  // PEMBACA IDENTITAS v2.73.22 — diadaptasi khusus dari fungsi extractAccounts,
  // parseBundle, dan extractSearchValues milik skrip "Cari ID & Rekening HP — Emas Hitam"
  // yang diberikan pengguna. Hanya logika pengambilan; UI asli tidak berubah.
  // Pakai data member per PESAN (bukan DOM semua halaman) agar balasan agent
  // dan rekening dari percakapan berbeda tidak tercampur.
  function referenceIdentityFields(text){
    const raw=String(text||'').normalize('NFKC').replace(/\r\n?/g,'\n')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').trim();
    const out={number:[],holder:[],bank:[],certain:false};
    if(!raw)return out;
    const push=(kind,value)=>{
      if(kind==='number'){
        const n=cleanAccount(value);
        if(accountNumberRE.test(n)&&!out.number.includes(n))out.number.push(n);
      }else if(kind==='bank'){
        const n=normalizeBank(value);
        if(knownBankNames.has(n)&&!out.bank.includes(n))out.bank.push(n);
      }else if(kind==='holder'){
        const n=String(value||'').trim().replace(/^[,:.=\-\s]+|[,:.=\-\s]+$/g,'')
          .replace(/\s+/g,' ');
        if(validHolder(n)&&!out.holder.some(v=>normalizeHolder(v)===normalizeHolder(n)))out.holder.push(n);
      }
    };
    // Sama seperti extractSearchValues: ambil satu nomor utuh yang diberi label,
    // atau angka tersendiri. Jangan gabung dua nomor panjang/timestamp.
    const numericHits=[];
    const numRE=/(?<![\p{L}\p{N}_])\+?\d(?:[\d \t.\-\u2010\u2011\u2013\u2014]*\d)?(?![\p{L}\p{N}_])/gu;
    const excludedLine=/\b(?:user\s*id|username|otp|password|nominal|taruhan|saldo|deposit|withdraw|tanggal|jam|kode\s*tiket)\b/i;
    for(const line of raw.split(/[\n;]+/)){
      // Hindari mengambil angka ID, saldo, tanggal, dan password sebagai nomor rekening.
      if(excludedLine.test(line)&&!/(?:no\.?\s*rek|nomor\s*rek|norek|rekening|bank|e[- ]?wallet)/i.test(line))continue;
      for(const hit of line.matchAll(numRE)){
        const sample=hit[0].trim();
        if(/^\d{1,4}[.\-/]\d{1,2}[.\-/]\d{1,4}$/.test(sample))continue;
        const n=cleanAccount(sample);
        if(accountNumberRE.test(n))numericHits.push(n);
      }
    }
    const candidates=[...new Set(numericHits)];
    // Bila ada beberapa nomor dalam satu pesan, tidak mengasosiasikan nama/bank
    // dengan sembarang nomor; biarkan pemilihan rekening existing yang menangani.
    for(const n of candidates)push('number',n);
    if(candidates.length>1)return out;

    const cleanup=t=>String(t||'').trim().replace(/^[\s:;=|/.,\-\u2013\u2014]+|[\s:;=|/.,\-\u2013\u2014]+$/g,'')
      .replace(/\s+/g,' ');
    // Pecah bank dari awalan sebuah potongan: "bank jago irah" => JAGO + Irah.
    // Cocokkan alias terpanjang terlebih dahulu, bukan fuzzy yang akan
    // menyamakan bank berbeda. Bank bisa ditulis D4N4, B.C.A, DanA.
    const splitBankPrefix=(candidate)=>{
      const words=cleanup(candidate).replace(/^(?:jenis\s+(?:bank|e[- ]?wallet)|nama\s+bank|bank|e[- ]?wallet|dompet\s+digital|rekening)\s*[:=.-]?\s*/i,'').trim()
        .split(/\s+/).filter(Boolean);
      const hits=[];
      for(let i=1;i<=Math.min(words.length,7);i++){
        const bank=normalizeBank(words.slice(0,i).join(' '));
        if(knownBankNames.has(bank))hits.push({bank,rest:cleanup(words.slice(i).join(' ')),size:i});
      }
      hits.sort((a,b)=>b.size-a.size);
      return hits[0]||null;
    };
    const splitBankSuffix=(candidate)=>{
      const words=cleanup(candidate).split(/\s+/).filter(Boolean),hits=[];
      for(let i=0;i<words.length;i++){
        const bank=normalizeBank(words.slice(i).join(' '));
        if(knownBankNames.has(bank))hits.push({bank,rest:cleanup(words.slice(0,i).join(' ')),size:words.length-i});
      }
      hits.sort((a,b)=>b.size-a.size);
      return hits[0]||null;
    };
    // Label eksplisit dari sumber. Ambil nilai hanya sampai label BERIKUTNYA,
    // sehingga "Nama: Muksalmina. Jenis: DANA" tidak menjadi "Muksalmina Jenis".
    const labels=/(?:^|[\s,;|])((?:nama\s*(?:bank|bqnk|bnk)|jenis\s*(?:bank|bqnk|bnk|e[- ]?wallet)?|bank|bqnk|bnk|e[- ]?wallet|dompet(?:\s+digital)?|nama\s*(?:rekening|rek|pemilik|penerima|nasabah|lengkap)?|atas\s+nama\s+(?:rek(?:ening)?|akun)|atas\s+nama|a\s*[/.]\s*n\.?|nomor\s*(?:rekening|rek|dana|ovo|gopay)?|no\.?\s*(?:rekening|rek)|norek|rekening|rek))\s*[:=\-]?\s*/gi;
    const fields=[...raw.matchAll(labels)];
    for(let i=0;i<fields.length;i++){
      const f=fields[i],label=f[1].toLowerCase();
      let tail=cleanup(raw.slice(f.index+f[0].length,fields[i+1]?.index??raw.length).split(/[\n;|]/)[0]);
      if(!tail)continue;
      if(/^(?:nomor|no\.?|norek|rek(?:ening)?$)/.test(label)){
        if(candidates.length===1&&/\d/.test(tail))push('number',candidates[0]);
      }else if(/bank|bqnk|bnk|wallet|dompet|^jenis/.test(label)){
        const part=splitBankPrefix(tail);
        if(part){push('bank',part.bank);if(part.rest&&!/\d/.test(part.rest))push('holder',part.rest);}
        else {const suffix=splitBankSuffix(tail);if(suffix){push('bank',suffix.bank);push('holder',suffix.rest);}}
      }else{
        // Field boundary in copied chats: "Nama: Holis Setiawan. Jenis: DANA".
        // The label "Jenis" may be consumed without its colon by a permissive
        // regex; never include the dangling label in the holder's name.
        tail=tail.replace(/\s*[.,;|]\s*(?:jenis(?:\s+bank)?|nama\s+bank|bank|e[- ]?wallet)\s*$/i,'').trim();
        tail=tail.replace(/\b(?:no\.?\s*rek|norek|nomor\s*rek|rekening|bank)\b.*$/i,'').trim();
        if(candidates.length===1)tail=tail.replace(numRE,' ').trim();
        const suffix=splitBankSuffix(tail);
        if(suffix&&suffix.rest){push('holder',suffix.rest);push('bank',suffix.bank);}
        else push('holder',tail);
      }
    }
    // Paket dari sumber: "BCA / Budi Santoso / 123456789" dan permutasinya.
    // Hanya satu nomor => aman mengelompokkan tiga bagian dalam satu pesan.
    if(candidates.length===1){
      const parts=raw.replace(/\ba\s*\/\s*n\b/gi,'atas nama').split(/\s*[,|;]\s*|\s+\/\s+/)
        .map(cleanup).filter(Boolean);
      if(parts.length===3){
        const npos=parts.findIndex(v=>numberRuns(v).includes(candidates[0]));
        const bpos=parts.findIndex(v=>knownBankNames.has(normalizeBank(v)));
        if(npos>=0&&bpos>=0&&npos!==bpos){
          const nameIndex=[0,1,2].find(i=>i!==npos&&i!==bpos);
          if(nameIndex!==undefined){push('bank',parts[bpos]);push('holder',parts[nameIndex].replace(/^(?:nama\s*(?:rekening)?|atas\s+nama)\s*[:=-]?\s*/i,''));}
        }
      }
      // Salah satu format paling sering dari Chatgacor:
      //   "108428689829 bank jago irah" (nomor -> bank -> nama).
      const numberFirst=raw.match(/^\s*(\+?\d[\d\s.,()\-/]*\d)\s+(?:bank|jenis\s+bank|rekening|e[- ]?wallet)\s+(.+)$/iu);
      if(numberFirst&&cleanAccount(numberFirst[1])===candidates[0]){
        const split=splitBankPrefix(numberFirst[2]);
        if(split){push('bank',split.bank);push('holder',split.rest);}
      }
      // "BCA Rendi Azari 081345455445" (bank -> nama -> nomor).
      const endNumber=raw.match(/^\s*(.+?)\s+(\+?\d[\d\s.,()\-/]*\d)\s*$/u);
      if(endNumber&&cleanAccount(endNumber[2])===candidates[0]){
        const left=cleanup(endNumber[1]);const prefix=splitBankPrefix(left);
        if(prefix){push('bank',prefix.bank);push('holder',prefix.rest);}
        else {const suffix=splitBankSuffix(left);if(suffix){push('bank',suffix.bank);push('holder',suffix.rest);}}
      }
      // "123456789 DANA Irah", tanpa kata bank.
      const firstNumber=raw.match(/^\s*(\+?\d[\d\s.,()\-/]*\d)\s+(.+)$/u);
      if(firstNumber&&cleanAccount(firstNumber[1])===candidates[0]){
        const prefix=splitBankPrefix(firstNumber[2]);
        if(prefix){push('bank',prefix.bank);push('holder',prefix.rest);}
      }
      // Satu blok tiga baris dari skrip contoh: bank, nama, nomor (urutan bebas).
      const lines=raw.split(/[\n;]+/).map(cleanup).filter(Boolean);
      if(lines.length===3){
        const npos=lines.findIndex(v=>numberRuns(v).includes(candidates[0]));
        const bpos=lines.findIndex(v=>knownBankNames.has(normalizeBank(v)));
        const nameIndex=[0,1,2].find(i=>i!==npos&&i!==bpos);
        if(npos>=0&&bpos>=0&&npos!==bpos&&nameIndex!==undefined){push('bank',lines[bpos]);push('holder',lines[nameIndex]);}
      }
    }
    // v2.73.24: Paket identitas dengan URUTAN APA SAJA dari chat yang diblok.
    // Skrip lama bisa membaca "nomor bank nama" tetapi melewatkan "nama nomor bank".
    // Cari bank hanya dari alias yang sudah dikenali, lalu pastikan sisa katanya
    // adalah satu nama manusia, bukan kalimat agent/teks antarmuka.
    function flexibleSingleLine(line){
      const source=String(line||'').normalize('NFKC').trim();
      if(!source||candidates.length!==1)return null;
      const numberMatches=[...source.matchAll(numRE)].filter(m=>cleanAccount(m[0])===candidates[0]);
      if(numberMatches.length!==1)return null;
      const hit=numberMatches[0];
      const before=source.slice(0,hit.index),after=source.slice(hit.index+hit[0].length);
      const stripEdge=s=>String(s||'')
        .replace(/\b(?:no\.?\s*(?:rek(?:ening)?)?|nomor\s*(?:rek(?:ening)?)?|norek|account\s*(?:number|no))\s*[:=.-]?\s*$/i,' ')
        .replace(/^(?:(?:no\.?\s*(?:rek(?:ening)?)?|nomor\s*(?:rek(?:ening)?)?|norek|rekening|account\s*(?:number|no))\s*[:=.-]?\s*)+/i,' ')
        .replace(/^[\s.,;:|/()\-]+|[\s.,;:|/()\-]+$/g,'').trim();
      const identity=cleanup(stripEdge(before)+' '+stripEdge(after));
      if(!identity)return null;
      const tokens=identity.split(/[\s,;|/]+/).filter(Boolean);
      if(tokens.length<2||tokens.length>18)return null;
      const matches=[];
      for(let start=0;start<tokens.length;start++){
        for(let size=1;size<=Math.min(6,tokens.length-start);size++){
          const bank=normalizeBank(tokens.slice(start,start+size).join(' '));
          if(!knownBankNames.has(bank))continue;
          let name=tokens.slice(0,start).concat(tokens.slice(start+size)).join(' ');
          name=name.replace(/^(?:(?:nama(?:\s+(?:pemilik|rekening|rek|lengkap|nasabah))?|atas\s+nama|a\s*\/?\s*n|pemilik|jenis\s*bank|e[- ]?wallet|adalah|bank(?:nya)?)\s*[:=.-]?\s*)+/i,'')
            .replace(/\s+(?:(?:nomor|no\.?)\s*(?:rek(?:ening)?)?|norek|jenis\s*bank|nama\s*bank)\s*[:=.-]?\s*$/i,'')
            .replace(/^[\s:.,|/()\-]+|[\s:.,|/()\-]+$/g,'').trim();
          if(!validHolder(name))continue;
          matches.push({bank,holder:name,size,start});
        }
      }
      if(!matches.length)return null;
      // Pilih label bank terpanjang dan tolak dua interpretasi yang saling
      // bertentangan. Contoh BCA DIGITAL tak boleh diam-diam menjadi BCA.
      const longest=Math.max(...matches.map(m=>m.size));
      const best=matches.filter(m=>m.size===longest);
      const distinct=[...new Set(best.map(m=>m.bank+'|'+normalizeHolder(m.holder)))];
      return distinct.length===1?best[0]:null;
    }
    if(candidates.length===1){
      const perLine=[];
      for(const line of raw.split(/[\r\n;]+/)){
        const entry=flexibleSingleLine(line);
        if(entry)perLine.push(entry);
      }
      if(perLine.length===1){
        // Satu paket lengkap mengalahkan potongan ambigu dari parser lama.
        out.holder=[perLine[0].holder];
        out.bank=[perLine[0].bank];
      }
    }
    // Satu pesan dapat berisi label nama & bank tanpa nomor. Hubungannya
    // ke rekening dilakukan oleh chatFieldsForAccount, BUKAN ditebak di sini.
    out.holder=[...new Map(out.holder.map(v=>
      String(v||'').replace(/\s*[.,;|]\s*(?:jenis(?:\s+bank)?|nama\s+bank|bank|e[- ]?wallet)\s*$/i,'').trim()
    ).filter(validHolder).map(v=>[normalizeHolder(v),v])).values()];
    out.certain=candidates.length<=1&&(out.bank.length<=1&&out.holder.length<=1);
    return out;
  }

  // v2.73.29: Ambil langsung baris identitas milik MEMBER dengan label lengkap.
  // Contoh: "- atas nama rekening : Fuad Fahyumi Mauliddia".
  // Jangan pernah menganggap balasan umum/keluhan sebagai nama pemilik.
  function directLabeledIdentity(text){
    const out={holder:[],number:[],bank:[]};
    const add=(key,value)=>{
      if(key==='holder'){
        const name=String(value||'').replace(/\b(?:jenis\s*bank|nama\s+bank|no\.?\s*rek(?:ening)?|nomor\s+rek(?:ening)?)\s*[:=].*$/i,'').trim();
        if(validHolder(name)&&!out.holder.some(v=>normalizeHolder(v)===normalizeHolder(name)))out.holder.push(name);
      }else if(key==='bank'){
        const b=normalizeBank(value);
        if(knownBankNames.has(b)&&!out.bank.includes(b))out.bank.push(b);
      }else{
        const ns=numberRuns(value);
        if(ns.length===1&&!out.number.includes(ns[0]))out.number.push(ns[0]);
      }
    };
    const holderRE=/^\s*[-*•]?\s*(?:atas\s+nama\s*(?:rek(?:ening)?|akun)?|nama\s+(?:pemilik\s+)?rek(?:ening)?|nama\s+(?:pemilik|nasabah|penerima|lengkap))(?:\s+(?:saya|aku))?\s*[:=\-]\s*(.+?)\s*$/i;
    const numberRE=/^\s*[-*•]?\s*(?:nomor\s*rek(?:ening)?|no\.?\s*rek(?:ening)?|norek|rekening)(?:\s+(?:saya|aku))?\s*[:=\-]\s*(.+?)\s*$/i;
    const bankRE=/^\s*[-*•]?\s*(?:nama\s+bank(?:\s*\/\s*(?:e[- ]?wallet|ewallet))?|jenis\s*(?:bank|e[- ]?wallet)?|bank(?:\s*\/\s*(?:e[- ]?wallet|ewallet))?|e[- ]?wallet|dompet\s+digital)\s*[:=\-]\s*(.+?)\s*$/i;
    for(const line of String(text||'').normalize('NFKC').split(/[\r\n;]+/)){
      let m;
      if((m=line.match(holderRE)))add('holder',m[1]);
      else if((m=line.match(numberRE)))add('number',m[1]);
      else if((m=line.match(bankRE)))add('bank',m[1]);
    }
    return out;
  }
  function parseExplicitIdentity(text){
    const result={number:[],holder:[],bank:[],correction:false};
    const raw=String(text||'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'');
    result.correction=/\b(?:maaf|ralat|revisi|koreksi|yang\s+benar|seharusnya|maksud\s+saya|salah\s+ketik|salah\s+tulis)\b/i.test(raw);
    const lines=raw.split(/[\r\n;]+/);
    for(let li=0;li<lines.length;li++){
      const line=lines[li].trim();if(!line)continue;
      // CHATGACOR: "Nama victorius dharwin rekening dana no 082150977178".
      // Atribut bank/nomor tidak boleh menjadi akhiran nama.
      const compact=line.match(/\b(?:nama(?:\s+(?:pemilik|rekening|rek|lengkap))?|atas\s+nama|a\s*\/\s*n)\s*[:=\-]?\s+([\p{L}][\p{L}\s.'-]{2,85}?)\s+(?:rekening|rek|bank|jenis(?:\s+bank)?|ewallet|e-wallet)\s*[:=\-]?\s+(?:bank\s+)?([\p{L}][\p{L}\s]{1,35}?)\s+(?:no\.?|nomor|norek|no\s*rek|nomor\s*rekening)\s*[:=\-]?\s*(\+?[0-9][0-9\s.()\/-]{4,28}[0-9])/iu);
      if(compact){
        const holder=clearIdentityValue(compact[1]);
        const bank=normalizeBank(compact[2]);
        const nums=numberRuns(compact[3]);
        if(validHolder(holder)&&knownBankNames.has(bank)&&nums.length===1){
          result.holder.push(holder);result.bank.push(bank);result.number.push(nums[0]);
        }
      }
      // Versi sederhana: "nama Rendi Azari dana 0813...".
      const concise=line.match(/\bnama\s*[:=\-]?\s+([\p{L}][\p{L}\s.'-]{2,85}?)\s+(bca|bni|bri|bsi|btn|mandiri|dana|ovo|gopay|cimb|jago|seabank)\s+(?:no\.?\s*)?(\+?[0-9][0-9\s.()\/-]{4,28}[0-9])/iu);
      if(concise&&validHolder(concise[1])){
        const nums=numberRuns(concise[3]);if(nums.length===1){result.holder.push(clearIdentityValue(concise[1]));result.bank.push(normalizeBank(concise[2]));result.number.push(nums[0]);}
      }
      const parts=[...line.matchAll(identityLabelRE)];
      for(let i=0;i<parts.length;i++){
        const m=parts[i],kind=labelKind(m[1]);
        let value=clearIdentityValue(line.slice(m.index+m[0].length,i+1<parts.length?parts[i+1].index:undefined));
        if(!value&&i===parts.length-1&&lines[li+1]&&!identityLabelRE.test(lines[li+1])){
          identityLabelRE.lastIndex=0;
          value=clearIdentityValue(lines[li+1]);
        }
        identityLabelRE.lastIndex=0;
        if(!value||/^(?:yang\s+lama|rekening\s+lama|bukan|tidak\s+jadi)$/i.test(value))continue;
        if(kind==='number')result.number.push(...numberRuns(value));
        else if(kind==='holder'){
          value=value.replace(/\s*\([^)]*\)\s*$/,'').replace(/^(?:nama\s+saya|atas\s+nama|an)\s+/i,'')
            // Chat semisal 'Nama Rekening: Muksalmina. Jenis: DANA' tidak boleh
            // terbaca sebagai nama 'Muksalmina. Jenis'.
            .replace(/[.,;]\s*(?:jenis(?:\s+bank)?|bank|e[- ]?wallet)\s*$/i,'').trim();
          if(validHolder(value))result.holder.push(value);
        }else{
          value=value.replace(/^(?:pakai|menggunakan|punya|adalah|saya|jenisnya)\s+/i,'').replace(/^(?:e[- ]?wallet|ewallet)\s*[:=\-]?\s*/i,'').trim();
          const bank=normalizeBank(value);
          if(knownBankNames.has(bank))result.bank.push(bank);
        }
      }
      identityLabelRE.lastIndex=0;
      // Paket singkat 'BCA, Budi Santoso, 1234567890', juga urutan
      // '1234567890 / BUDI SANTOSO / BCA'. Satu pesan = satu paket.
      const groups=line.split(/\s*[,|;]\s*|\s+\/\s+/).map(clearIdentityValue).filter(Boolean);
      if(groups.length===3){
        const nums=groups.map(numberRuns),numAt=nums.findIndex(a=>a.length===1);
        const banks=groups.map(normalizeBank),bankAt=banks.findIndex(b=>knownBankNames.has(b));
        const nameAt=[0,1,2].find(i=>i!==numAt&&i!==bankAt);
        if(numAt>=0&&bankAt>=0&&bankAt!==numAt&&nameAt!==undefined&&validHolder(groups[nameAt])){
          result.number.push(nums[numAt][0]);result.bank.push(banks[bankAt]);result.holder.push(groups[nameAt]);
        }
      }
      // Format tanpa label: hanya satu kata bank atau 'BANK BCA'.
      // Pesan tanpa label nama: 'Muksalmina. Jenis: DANA'.
      // Hanya ambil teks sebelum 'Jenis:' sebagai calon nama jika valid.
      const implicitNameBank=line.match(/^([\p{L}][\p{L} .'-]{1,85}?)\s*(?:[.,;|]\s*|\s+)jenis(?:\s+bank)?\s*[:=]\s*(.+)$/iu);
      if(implicitNameBank){
        const inferredBank=normalizeBank(clearIdentityValue(implicitNameBank[2]));
        if(validHolder(implicitNameBank[1])&&knownBankNames.has(inferredBank)){
          result.holder.push(implicitNameBank[1].trim());result.bank.push(inferredBank);
        }
      }
      const bareBank=normalizeBank(line);
      if(knownBankNames.has(bareBank))result.bank.push(bareBank);
      // Format 'BCA 1234567890' atau '1234567890 BCA'.
      const edgeBank=line.match(/^(.{2,55}?)\s*[:=,\-]?\s+(\+?\d[\d\s.()\-]*\d)$/iu)
        ||line.match(/^(\+?\d[\d\s.()\-]*\d)\s+(.{2,55}?)$/iu);
      if(edgeBank){
        const first=normalizeBank(edgeBank[1]),second=normalizeBank(edgeBank[2]);
        const bankAt=knownBankNames.has(first)&&!knownBankNames.has(second)?1:
          knownBankNames.has(second)&&!knownBankNames.has(first)?2:0;
        const numberAt=bankAt===1?2:bankAt===2?1:0;
        if(numberAt){
          const foundNumber=numberRuns(edgeBank[numberAt]);
          if(foundNumber.length===1){result.bank.push(bankAt===1?first:second);result.number.push(foundNumber[0]);}
        }
      }
    }
    // Satu pesan tanpa label, misalnya: 'BCA\nRendi Azari\n081345455445'.
    // Hanya terima bila tepat satu bank, satu nama, dan satu nomor.
    const bareLines=lines.map(clearIdentityValue).filter(Boolean);
    if(bareLines.length===3){
      const banks=bareLines.map(normalizeBank),bankIndex=banks.findIndex(b=>knownBankNames.has(b));
      const numbers=bareLines.map(v=>/^\+?[\d\s.,()\-/]+$/.test(v)?numberRuns(v):[]);
      const numIndex=numbers.findIndex(a=>a.length===1);
      const nameIndex=bareLines.findIndex((v,i)=>i!==bankIndex&&i!==numIndex&&validHolder(v));
      if(bankIndex>=0&&numIndex>=0&&nameIndex>=0&&new Set([bankIndex,numIndex,nameIndex]).size===3){
        result.bank.push(banks[bankIndex]);result.number.push(numbers[numIndex][0]);result.holder.push(bareLines[nameIndex]);
      }
    }
    // Satu baris tanpa pemisah: 'D4N4 Rendi Azari 081345455445',
    // 'Bank Central Asia Rendi Azari 12345' atau ejaan biasa.
    if(lines.length===1){
      const row=lines[0].replace(/\s+/g,' ').trim();
      const final=row.match(/^(.+?)\s+(\+?\d[\d .\-/()]*\d)$/u);
      if(final){
        const prefix=final[1],nums=numberRuns(final[2]);
        const parts=prefix.split(/\s+/).filter(Boolean);
        const hits=[];
        for(let size=1;size<=Math.min(5,parts.length-1);size++){
          const candidate=normalizeBank(parts.slice(0,size).join(' '));
          const owner=parts.slice(size).join(' ');
          if(knownBankNames.has(candidate)&&validHolder(owner))hits.push({bank:candidate,holder:owner,size});
        }
        if(nums.length===1&&hits.length){
          hits.sort((x,y)=>y.size-x.size);
          result.bank.push(hits[0].bank);result.holder.push(hits[0].holder);result.number.push(nums[0]);
        }
      }
    }
    // Prioritaskan pembaca paket dari skrip referensi. Ini memperbaiki format
    // "108428689829 bank jago irah" tanpa menempelkan 'jago irah' sebagai bank.
    const reference=referenceIdentityFields(raw);
    if(reference.certain){
      if(reference.number.length)result.number=reference.number;
      if(reference.holder.length)result.holder=reference.holder;
      if(reference.bank.length)result.bank=reference.bank;
    }
    const direct=directLabeledIdentity(raw);
    for(const key of ['number','holder','bank'])if(direct[key].length)result[key]=direct[key];
    for(const key of ['number','holder','bank'])result[key]=[...new Map(result[key].map(v=>[
      key==='holder'?normalizeHolder(v):key==='bank'?normalizeBank(v):cleanAccount(v),v])).values()];
    return result;
  }
  function memberIdentityFields(text,requestedFields=[]){
    const parsed=parseExplicitIdentity(text),t=String(text||'').trim();
    if(requestedFields.length===1){
      if(requestedFields[0]==='holder'&&validHolder(t))parsed.holder.push(t);
      if(requestedFields[0]==='bank'&&knownBankNames.has(normalizeBank(t)))parsed.bank.push(normalizeBank(t));
      if(requestedFields[0]==='number'&&numberRuns(t).length===1&&/^\s*\+?[0-9\s.,()\-]+\s*$/.test(t))parsed.number.push(numberRuns(t)[0]);
    }
    return {number:[...new Set(parsed.number)],holder:[...new Set(parsed.holder)],bank:[...new Set(parsed.bank)]};
  }
  function extractAccounts(messages){
    const strong=new Set(),possible=new Set();let requested=false,userIdReply=false;
    for(const m of messages){
      const text=String(m.originalText||m.text||'');
      if(m.kind==='agent'){
        userIdReply=/user\s*id|username/i.test(text)&&/minta|mohon|tolong|kirim|sebut|berikan|info|berapa/i.test(text)&&!accountLabel.test(text);
        if(accountLabel.test(text)&&/minta|mohon|tolong|kirim|sebut|berikan|info|berapa/i.test(text))requested=true;
        continue;
      }
      if(m.kind!=='member')continue;
      if(userIdReply&&/^\s*\d{3,40}\s*$/.test(text)){userIdReply=false;continue;}
      userIdReply=false;
      const parsed=parseExplicitIdentity(text);parsed.number.forEach(n=>strong.add(n));
      const lines=text.split(/[\r\n]+/);
      for(let i=0;i<lines.length;i++){
        const line=lines[i].trim();if(!line)continue;
        if(accountLabel.test(line)&&!/\bnama\s+(?:pemilik\s*)?rek(?:ening)?/i.test(line)){
          const m=line.match(accountLabel);
          const remain=line.slice(m.index+m[0].length).split(/\b(?:nama\s+rek(?:ening)?|jenis\s+bank|nama\s+bank|bank|hp|telp|telepon|nominal|taruhan|deposit|saldo|otp|pin|password|user\s*id)\b/i)[0];
          const values=numberRuns(remain||((i+1<lines.length)?lines[i+1]:''));
          values.forEach(n=>strong.add(n));continue;
        }
        if(/\b(?:hp|telp|telepon|nominal|saldo|otp|pin|bet|taruhan|deposit|withdraw|tanggal|jam|rp|rupiah|kode\s+tiket)\b/i.test(line))continue;
        const candidates=numberRuns(line);
        // Berdiri sendiri / bank + nomor, tetapi jangan ambil nominal transaksi.
        if(/^(?:[+\d\s.,()\-/]+)$/.test(line))candidates.forEach(n=>(requested?strong:possible).add(n));
        else if(chatBankRE.test(line)&&/\d/.test(line))candidates.forEach(n=>strong.add(n));
      }
    }
    return {strong:[...strong],possible:[...possible].filter(n=>!strong.has(n))};
  }
  // Calon nama tanpa label harus benar-benar menyerupai nama orang.
  // Pesan singkat setelah reset seperti "Ok tks" tidak boleh dijadikan identitas.
  function plausibleHolderCandidate(value){
    const t=String(value||'').normalize('NFKC').trim().replace(/[.!?]+$/,'').trim();
    if(!validHolder(t)||t.length>65||t.split(/\s+/).length>5)return false;
    if(/\b(?:tuh|jing|anjing|anjir|anjg|anjay|bangsat|tolol|goblok|woy|woi|bro|cuy|lah|dong|ok|okay|oke|tks|thx|thanks|makasih|terimakasih|terima|kasih|sip|siap|baik|sudah|makasi|iya|ya|y|yes|no|halo|hello|hai|bos|min|admin|cs|kak|bang|mantap|noted|selesai|silahkan|silakan|bantu|cek|proses|akun|id|user|reset|password|tunggu|maklum|segera|ini|itu|atas|salah|betul|benar|ganti|kirim|nama|jenis)\b/i.test(t))return false;
    if(/\d|[:=]|(?:\?|!)/.test(t))return false;
    return true;
  }
  function recoveryData(messages){
    const accounts=extractAccounts(messages),requested=new Set(),claims=[];
    let pending=[],pendingCorrection=new Set(),pendingAge=0;
    const fields=text=>{
      const t=normalizeMemberLanguage(text),f=[];
      // 'nama rekening' ≠ 'nomor rekening': jangan mengaktifkan dua filter sekaligus.
      if(/\b(?:nomor\s*rek(?:ening)?|no\.?\s*rek(?:ening)?|norek|nomor\s+(?:dana|ovo|gopay)|no\.?\s+(?:dana|ovo|gopay))\b/.test(t))f.push('number');
      if(/\b(?:nama\s*(?:pemilik\s*)?(?:rek(?:ening)?|akun)|nama\s+(?:pemilik|nasabah|penerima|lengkap)|atas\s+nama|a\s*\/\s*n|nama\s+(?:yang\s+)?benar)\b/.test(t))f.push('holder');
      if(/\b(?:bank(?:nya)?|e[- ]?wallet|ewallet|dompet\s+digital|jenis\s+(?:bank(?:nya)?|rekening))\b/.test(t))f.push('bank');
      if(/\brekening\b/.test(t)&&!f.includes('holder')&&!f.includes('number')&&!f.includes('bank'))f.push('number');
      return [...new Set(f)];
    };
    const questionRE=/\b(?:minta|mohon|tolong|kirim|berikan|sebutkan|infokan|informasikan|berapa|apa|boleh|ketik|tulis|isi|ulang|ulangi|kembali|pastikan|yang\s+benar|sebenarnya|perbaiki|koreksi|revisi|sesuai|coba)\b|\?/i;
    const redoRE=/\b(?:salah|tidak\s+(?:sesuai|cocok|benar)|beda|berbeda|yang\s+benar|sebenarnya|ketik\s+ulang|tulis\s+ulang|ulang|ulangi|sekali\s+lagi|revisi|koreksi|perbaiki|yang\s+sesuai)\b/i;
    const correctedText=t=>String(t||'').replace(/^\s*(?:(?:maaf|ralat|koreksi|revisi|maksud\s+saya|yang\s+benar|seharusnya|nama\s+saya)\s*[:=,\-]?\s*)+/i,'').trim();
    for(const m of messages){
      const t=String(m.originalText||m.text||'').trim();if(!t)continue;
      if(m.kind==='agent'){
        const asked=fields(t);
        if(asked.length&&questionRE.test(normalizeMemberLanguage(t))){
          asked.forEach(x=>requested.add(x));
          pending=asked;pendingCorrection=new Set(redoRE.test(normalizeMemberLanguage(t))?asked:[]);
          pendingAge=0;
        }
        continue;
      }
      if(m.kind!=='member')continue;
      const explicit=parseExplicitIdentity(t),detected=extractAccounts([{kind:'member',text:t}]);
      const numbers=[...new Set([...explicit.number,...detected.strong,...detected.possible])];
      const corrections=new Set(),provided=new Set();
      for(const type of ['holder','bank','number'])if(explicit[type].length)provided.add(type);
      if(numbers.length)provided.add('number');
      // Jawaban tanpa label setelah pertanyaan agent boleh menjawab SATU field
      // dari antrian. Jika agent meminta tiga field sekaligus, baca pesan
      // terpisah berurutan (bank, nama, nomor) sesuai bentuk masing-masing.
      if(pending.length){
        const short=correctedText(t).replace(/[.!]+$/,'').trim();
        if(pending.includes('bank')&&!explicit.bank.length){
          const canonical=normalizeBank(short);
          if(knownBankNames.has(canonical)){explicit.bank.push(canonical);provided.add('bank');}
        }
        if(pending.includes('number')&&!numbers.length&&/^\+?[\d\s.,()\-/]+$/.test(short)){
          numbers.push(...numberRuns(short));if(numbers.length)provided.add('number');
        }
        if(pending.includes('holder')&&!explicit.holder.length&&!numbers.length&&!knownBankNames.has(normalizeBank(short))&&plausibleHolderCandidate(short)){
          explicit.holder.push(short);provided.add('holder');
        }
        for(const type of provided)if(pending.includes(type)){
          if(pendingCorrection.has(type))corrections.add(type);
          pending=pending.filter(x=>x!==type);pendingCorrection.delete(type);
        }
        if(++pendingAge>6){pending=[];pendingCorrection.clear();}
      }
      // Ralat tegas dari member tanpa label tetap menghapus nilai lama jika
      // bentuk jawabannya dikenali; ralat bank tidak menghapus nomor/nama.
      if(explicit.correction){
        for(const type of provided)corrections.add(type);
        if(!provided.size){
          const short=correctedText(t);
          if(knownBankNames.has(normalizeBank(short))){explicit.bank.push(normalizeBank(short));corrections.add('bank');}
          else if(validHolder(short)){explicit.holder.push(short);corrections.add('holder');}
        }
      }
      const candidateHolder=!explicit.holder.length&&!explicit.bank.length&&!numbers.length&&plausibleHolderCandidate(t)?t:'';
      claims.push({holder:[...new Set(explicit.holder)],bank:[...new Set(explicit.bank)],numbers:[...new Set(numbers)],
        candidateHolder,correction:explicit.correction,correctionFields:[...corrections],raw:t});
    }
    return {number:[...new Set([...accounts.strong,...accounts.possible])],
      holder:[...new Set(claims.flatMap(c=>c.holder))],bank:[...new Set(claims.flatMap(c=>c.bank))],requested,claims};
  }
  function chatFieldsForAccount(data,number){
    const target=cleanAccount(number),claims=data.claims||[];
    const chosen={holder:[],bank:[],ambiguous:false};
    const anchorItems=claims.flatMap((c,i)=>c.numbers.length===1?[{idx:i,number:cleanAccount(c.numbers[0])}]:[]);
    const linked=anchorItems.filter(a=>a.number===target);
    if(!target||!linked.length)return chosen; // Do not assert identity for manual lookup absent from chat.
    const otherNumbers=new Set(data.number.map(cleanAccount).filter(n=>n&&n!==target));
    const uniqueAccount=otherNumbers.size===0;
    const seen={holder:[],bank:[]},closest=i=>Math.min(...linked.map(a=>Math.abs(i-a.idx)));
    const explicitHolderPresent=claims.some((c,i)=>c.holder.length>0 && (uniqueAccount || (c.numbers.length===1&&cleanAccount(c.numbers[0])===target)));
    let uncertain=false;
    const hasInfo=c=>Boolean(c.holder.length||c.bank.length||c.candidateHolder);
    const beforeFirst=claims.slice(Math.max(0,anchorItems[0].idx-6),anchorItems[0].idx).filter(hasInfo).length;
    const afterFirst=claims.slice(anchorItems[0].idx+1,Math.min(claims.length,anchorItems[0].idx+7)).filter(hasInfo).length;
    const useForward=anchorItems.length>1&&beforeFirst>0&&beforeFirst>=afterFirst;
    const ownerOf=i=>{
      if(uniqueAccount){
        // Do not attach every bank/name mentioned anywhere in a long chat.
        // Attach only declarations close to a member's account number, or
        // direct, labeled corrections after it. Agent requests are already
        // used by recoveryData() to identify otherwise unlabeled replies.
        const nearest=closest(i);
        if(nearest>8)return '';
        return target;
      }
      const direct=anchorItems.find(a=>a.idx===i);if(direct)return direct.number;
      const before=[...anchorItems].reverse().find(a=>a.idx<i);
      const after=anchorItems.find(a=>a.idx>i);
      if(!before)return after&&after.idx-i<=8?after.number:'';
      if(!after)return i-before.idx<=8?before.number:'';
      if(useForward)return after.idx-i<=8?after.number:i-before.idx<=3?before.number:'';
      // In a mixed-account conversation, never borrow a member's name across
      // adjacent account blocks merely because it is close to another number.
      return i-before.idx<=8&&i-before.idx<=after.idx-i?before.number:
        after.idx-i<=5?after.number:'';
    };
    for(let i=0;i<claims.length;i++){
      const c=claims[i];
      if(c.numbers.length>1){if(c.numbers.map(cleanAccount).includes(target))uncertain=true;continue;}
      if(ownerOf(i)!==target)continue;
      const holderValues=[...c.holder];
      const distance=closest(i);
      // Unlabelled names are accepted only when the chat contains one
      // account, a member supplied that account number, and nearby context
      // supports it. Explicitly labelled names may be farther away.
      // Once an explicit holder is supplied for this account, generic short replies
      // and stray standalone phrases are not additional holder candidates.
      // Tidak menebak nama dari pesan tanpa label; jawaban permintaan nama
      // yang sah sudah masuk c.holder melalui alur pertanyaan agent di atas.
      for(const [key,values] of [['holder',holderValues],['bank',c.bank]]){
        const normFn=key==='holder'?normalizeHolder:normalizeBank;
        const unique=[...new Map(values.filter(Boolean).map(v=>[normFn(v),v])).values()];
        if(unique.length>1){uncertain=true;continue;}
        if(!unique.length)continue;
        const correction=c.correctionFields?.includes(key)||(c.correction&&!c.correctionFields?.length);
        if(correction)seen[key]=[];
        const norm=normFn(unique[0]);
        if(norm&&!seen[key].some(x=>x.norm===norm))seen[key].push({norm,value:unique[0]});
      }
    }
    for(const key of ['holder','bank']){
      chosen[key]=seen[key].map(x=>x.value);
      if(chosen[key].length>1)uncertain=true;
    }
    chosen.ambiguous=uncertain;
    return chosen;
  }
  // v2.73.34: PENCARIAN BERDASARKAN HASIL ADMIN, bukan menebak nama dari
  // kalimat panjang member. Contoh: "Lp paswot riswanto 081327486795 dana".
  // Nama ADMIN = RISWANTO, lalu cari RISWANTO sebagai kata UTUH di teks member.
  // Ini juga menerima "rendi azari" = "rendiazari" tanpa menebak ejaan lain.
  function findExactAdminHolderInText(text,adminName){
    const key=normalizeHolder(adminName);
    if(!key||key.length<3||key.length>90)return '';
    const regexBody=[...key].map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))
      .join('[\\s\\p{P}\\p{S}\\u200B-\\u200D]*');
    try{
      const match=String(text||'').normalize('NFKC').match(new RegExp('(?<![\\p{L}\\p{N}])'+regexBody+'(?![\\p{L}\\p{N}])','iu'));
      return match?.[0]||'';
    }catch(_){return '';}
  }
  // Bank diidentifikasi dari token utuh agar DANA bukan potongan DANAMON,
  // tetapi d.a.n.a, D4N4, B.C.A, dan go pay tetap dapat dibaca.
  function findExactAdminBankInText(text,adminBank){
    const target=normalizeBank(adminBank);
    if(!knownBankNames.has(target))return '';
    const tokens=String(text||'').normalize('NFKC').match(/[\p{L}\p{N}@$!]+/gu)||[];
    // Bank maksimal empat kata ("Bank Central Asia", "Go Pay", dsb).
    for(let i=0;i<tokens.length;i++){
      for(let n=1;n<=Math.min(4,tokens.length-i);n++){
        const phrase=tokens.slice(i,i+n).join(' ');
        if(normalizeBank(phrase)===target)return phrase;
      }
    }
    return '';
  }
  // Hanya pesan MEMBER. Nama/bank tidak boleh dipinjam dari pesan agent,
  // rekening lain, sidebar, atau teks admin yang bukan isi chat pilihan.
  function memberAccountEvidence(messages,number){
    const target=cleanAccount(number);
    const entries=(messages||[]).filter(m=>m?.kind==='member')
      .map(m=>String(m.originalText||m.text||'').trim()).filter(Boolean);
    const indexed=entries.map((text,i)=>({text,i,numbers:numberRuns(text)}));
    const anchors=indexed.filter(e=>e.numbers.includes(target));
    if(!target||!anchors.length)return [];
    const allAnchors=indexed.filter(e=>e.numbers.length);
    return indexed.filter(e=>{
      if(e.numbers.length&&(!e.numbers.includes(target)||e.numbers.length>1))return false;
      // Jika nama, nomor, dan bank pada pesan yang sama, langsung sah.
      if(e.numbers.includes(target))return true;
      // Nama dan bank yang dikirim terpisah perlu berada dalam konteks
      // rekening terdekat (maksimum enam pesan member).
      const closest=allAnchors.map(a=>({a,d:Math.abs(e.i-a.i)})).sort((x,y)=>x.d-y.d);
      return Boolean(closest.length&&closest[0].d<=6&&
        closest[0].a.numbers.length===1&&closest[0].a.numbers[0]===target&&
        (closest.length===1||closest[1].d!==closest[0].d));
    }).map(e=>e.text);
  }
  function compareChatAdmin(messages,number,record){
    if(!record||!number||!messages?.length)return null;
    const data=recoveryData(messages),chosen=chatFieldsForAccount(data,number);
    const adminNumber=cleanAccount(record.number||'');
    const target=cleanAccount(number);
    const memberTexts=memberAccountEvidence(messages,number);
    const chatNumbers=[...new Set(data.number.map(cleanAccount).filter(Boolean))];
    const numberConfirmed=memberTexts.some(t=>numberRuns(t).includes(target));
    const prefix888Verified=record.recovery888?.originalNumber===target&&
      record.recovery888?.storedNumber===adminNumber&&
      adminNumber==='888'+target&&record.recovery888?.source==='NOW';
    const numberIsMatch=numberConfirmed&&(adminNumber===target||prefix888Verified);

    // Gunakan NAMA dan BANK ADMIN sebagai query pada pesan member relevan.
    // Keberhasilan pencarian ini MENANG atas parser nama lama.
    const exactHolder=memberTexts.map(t=>findExactAdminHolderInText(t,record.holder)).find(Boolean)||'';
    const exactBank=memberTexts.map(t=>findExactAdminBankInText(t,record.bank)).find(Boolean)||'';
    const chooseStatus=(field,exact,chosenValues,admin,normalize,verified)=>{
      if(exact)return {status:'match',chat:[exact],admin};
      const unique=[...new Map(chosenValues.filter(Boolean).map(v=>[normalize(v),v]))].filter(([k])=>k).map(([,v])=>v);
      if(!memberTexts.length||!admin||!normalize(admin))return {status:'unknown',chat:unique,admin};
      if(unique.length>1)return {status:'ambiguous',chat:unique,admin};
      if(unique.length===1){
        const k=normalize(unique[0]),a=normalize(admin);
        if(k===a)return {status:'match',chat:unique,admin};
        if(field==='holder'&&k.length>=5&&a.length>=5&&
          (k.startsWith(a)||a.startsWith(k)))return {status:'partial',chat:unique,admin};
        // Merah hanya jika member memang menyebutkan identitas LAIN
        // secara jelas, bukan kalimat "Lp paswot" yang gagal dipotong.
        const explicit=field==='holder'
          ? data.claims.some(c=>c.holder?.some(v=>normalize(v)===k)&&
              /(?:atas\s+nama|nama\s+(?:pemilik\s*)?rek|nama\s+yang\s+benar)/i.test(c.raw||''))
          : data.claims.some(c=>c.bank?.some(v=>normalize(v)===k)&&
              /(?:jenis\s*bank|nama\s+bank|bank\s*[:=]|e[- ]?wallet)/i.test(c.raw||''));
        if(explicit&&verified===true)return {status:'mismatch',chat:unique,admin};
      }
      // Ketidakhadiran nama admin bukan bukti nama berbeda.
      return {status:'not_found',chat:[],admin};
    };
    const check={
      number:{status:numberIsMatch?'match':'unknown',chat:chatNumbers,admin:record.number||number},
      holder:chooseStatus('holder',exactHolder,chosen.holder,record.holder||'',normalizeHolder,record.holderVerified===true),
      bank:chooseStatus('bank',exactBank,chosen.bank,displayBank(record.bank),normalizeBank,record.bankVerified===true)
    };
    if(chosen.ambiguous){
      // Ambiguitas parser tidak boleh membatalkan kecocokan LANGSUNG
      // dengan nama/bank admin pada teks member yang dipilih.
      for(const key of ['holder','bank'])if(!['match','not_found'].includes(check[key].status))check[key].status='ambiguous';
    }
    const diff=Object.entries(check).filter(([,v])=>v.status==='mismatch');
    const unclear=Object.entries(check).filter(([,v])=>['unknown','not_found','ambiguous','partial'].includes(v.status));
    const names={number:'Nomor rekening',holder:'Nama rekening',bank:'Bank / E-wallet'};
    const explain=([k,v])=>names[k]+' — Chat: '+(v.chat.join(' / ')||'tidak ditemukan')+' | Admin: '+(v.admin||'belum terbaca');
    const state=diff.length?'mismatch':unclear.length?'review':'match';
    const detail=diff.length?'✖ DATA BERBEDA TERKONFIRMASI: '+diff.map(explain).join(' • ')+'. Periksa identitas sebelum reset.':
      unclear.length?'⚠ PERIKSA CHAT: '+unclear.map(([k,v])=>names[k]+(
        v.status==='not_found'?' tidak ditemukan dalam pesan member yang berkaitan dengan rekening ini':
        v.status==='partial'?' hanya cocok sebagian':v.status==='ambiguous'?' ambigu':' belum dapat dipastikan')).join('; ')+'.':
      '✓ NAMA, NOMOR REKENING, dan BANK ADMIN ditemukan dan cocok di pesan MEMBER.';
    return {state,check,detail:state==='match'&&prefix888Verified?
      detail+' Ditemukan di ADMIN NOW memakai awalan 888, nomor asli member '+target+'.':detail};
  }
  function recoveryAdvice(type,messages){
    const latest=[...messages].reverse().find(m=>m.kind==='member'&&detectIntent(m.text).some(t=>t==='password'||t==='username'));
    const both=latest&&['password','username'].every(t=>detectIntent(latest.text).includes(t));
    const locked=accountState.active&&accountState.record?.lock?accountState.record:null;
    if(locked)return {category:'PEMULIHAN AKUN • GEMBOK TERDETEKSI',title:'PERIKSA STATUS AKUN TERKUNCI',body:'User ID: '+locked.userid+'\nStatus terbaca: '+(locked.profile?.status||'Belum berhasil dibaca')+'\nInformation: '+(locked.profile?.information||locked.profileError||'Lihat panel hasil rekening.')+'\nPeriksa keterangan admin sebelum melanjutkan. '+(type==='username'?'Permintaan hanya User ID; jangan reset password.':'Jangan menganggap reset password akan membuka kunci akun.'),tone:'review'};
    const data=recoveryData(messages),labels={number:'Nomor rekening',holder:'Nama rekening',bank:'Jenis bank / e-wallet'};
    // Saat sudah ada rekening terpilih, pakai nama/bank efektif setelah ralat,
    // bukan daftar seluruh kesalahan ketik dalam riwayat chat.
    const selectedNumber=accountState.active?accountState.number:'';
    const current=selectedNumber?chatFieldsForAccount(data,selectedNumber):null;
    if(current){data.holder=current.holder;data.bank=current.bank;}
    const present=Object.keys(labels).filter(k=>data[k].length),missing=Object.keys(labels).filter(k=>!data[k].length);
    const ambiguous=present.some(k=>data[k].length>1)||(current?.ambiguous===true);
    const lines=present.map(k=>labels[k]+': '+data[k].join(' / '));
    const waiting=missing.filter(k=>data.requested.has(k)),ask=missing.filter(k=>!data.requested.has(k));
    let title=ambiguous?'ADA BEBERAPA DATA — COCOKKAN DULU':!missing.length?'DATA MEMBER SUDAH ADA':ask.length?'MINTA BAGIAN YANG MASIH KURANG':'DATA SUDAH DIMINTA — TUNGGU JAWABAN';
    if(lines.length)lines.push('Jangan minta ulang data yang sudah tercantum. Cocokkan dengan hasil admin.');
    if(ambiguous)lines.push('Ada beberapa nilai di percakapan. Pastikan data mana yang digunakan; jangan menganggap semuanya satu rekening.');
    if(waiting.length)lines.push('Sudah diminta AI / agen: '+waiting.map(k=>labels[k]).join(', ')+'. Cek atau tunggu jawabannya; jangan minta ulang.');
    if(ask.length)lines.push('Belum terdeteksi: '+ask.map(k=>labels[k]).join(', ')+'. Periksa chat di atas, lalu minta hanya bagian yang belum diberikan.');
    lines.push(both?'Member lupa User ID dan password. Cocokkan identitas, lalu bantu reset password dan berikan User ID.':type==='username'?'Berikan User ID setelah identitas cocok; jangan reset password.':'Cocokkan identitas sebelum melanjutkan reset password.');
    const evidence=manualEvidence?.route===route?manualEvidence.messages:null;
    const check=accountState.record&&evidence?.length?compareChatAdmin(evidence,accountState.number,accountState.record):null;
    if(check){
      lines.unshift(check.detail);
      if(check.state==='mismatch')title='✖ DATA BERBEDA — PERIKSA SEBELUM LANJUT';
      else if(check.state==='review')title='⚠ IDENTITAS BELUM TERVERIFIKASI';
      else title='✓ IDENTITAS REKENING COCOK';
    }
    return {category:both?'LUPA USER ID + PASSWORD • DATA MEMBER':type==='username'?'LUPA AKUN / USER ID • DATA MEMBER':'LUPA PASSWORD • DATA MEMBER',title,body:lines.join('\n'),tone:check?.state==='match'?'ready':'review'};
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
  function userIdField(doc){
    const fields=[...doc.querySelectorAll('input[name]')].filter(e=>['text','search'].includes(e.type)&&e.form);
    const exact=fields.filter(e=>/^(?:userid|username|searchuserid)$/i.test(e.name.replace(/[^a-z0-9]/gi,'')));
    if(exact.length===1)return exact[0];
    const labelled=fields.filter(e=>/user\s*id|username/i.test(inputCaption(e)));
    if(labelled.length===1)return labelled[0];
    throw new Error('Kolom UserId belum dikenali pada admin.');
  }
  function nearbyFilterCaption(check){
    const parts=[];
    for(const direction of ['previousSibling','nextSibling']){
      let n=check[direction];
      for(let i=0;n&&i<3;i++,n=n[direction]){
        if(n.nodeType===1&&(n.matches('input,select,textarea,button,table,tr')||n.querySelector('input,select,textarea')))break;
        const value=String(n.textContent||'').trim();if(value)parts.push(value);
      }
    }
    const cell=check.closest('td,th,label');
    if(cell&&cell.querySelectorAll('input[type="checkbox"]').length===1&&adminText(cell).length<100)parts.push(adminText(cell));
    return parts.join(' ');
  }
  function associatedFilterChecks(checks,input,kind){
    const matches=t=>kind==='userid'?/\buser[\s_-]*(?:id|name)\b/i.test(t):accountLabel.test(t)&&!/nama\s*rek/i.test(t);
    const adjacent=checks.filter(e=>matches(nearbyFilterCaption(e)));
    if(adjacent.length)return adjacent;
    // Checkbox and caption may occupy the cell immediately before the input.
    const cell=input.closest('td,th'),previous=cell?.previousElementSibling;
    if(previous&&matches(adminText(previous))){
      const local=checks.filter(e=>previous.contains(e));if(local.length)return local;
      const before=previous.previousElementSibling;
      if(before&&adminText(before).trim()===''){
        const only=checks.filter(e=>before.contains(e));if(only.length===1)return only;
      }
    }
    return [];
  }
  function searchRequest(page,number,kind='account'){
    const input=kind==='userid'?userIdField(page.doc):accountField(page.doc),form=input.form;
    if(form.querySelector('input[type="password"]'))throw new Error('Sesi admin belum login.');
    const buttons=[...form.querySelectorAll('button,input[type="submit"]')].filter(e=>!e.disabled);
    const submit=buttons.find(e=>/^(?:cari|search|submit|filter|tampilkan)$/i.test(adminText(e)||e.value));
    if(!submit)throw new Error('Tombol Cari / Submit belum dikenali.');
    const url=new URL(submit.getAttribute('formaction')||form.getAttribute('action')||page.url,page.url);
    if(url.origin!==ADMIN_ORIGIN || url.pathname!==new URL(page.url).pathname)throw new Error('Tujuan formulir pencarian berbeda; pencarian dihentikan.');
    const method=(submit.getAttribute('formmethod')||form.getAttribute('method')||'GET').toUpperCase();
    if(!['GET','POST'].includes(method))throw new Error('Metode pencarian belum didukung.');
    const checks=[...form.querySelectorAll('input[type="checkbox"]')];
    let targetCheck=checks.filter(e=>kind==='userid'?/user[_\s-]*(?:id|name)/i.test(inputCaption(e)):accountLabel.test(inputCaption(e)));
    if(!targetCheck.length)targetCheck=associatedFilterChecks(checks,input,kind);
    if(!targetCheck.length){
      const cell=input.closest('td')||input.closest('label')||input.parentElement;
      const textFields=cell?[...cell.querySelectorAll('input')].filter(e=>['text','search','tel','number','email'].includes(e.type)):[];
      // A form-wide checkbox may belong to User ID; never enable it for rekening.
      if(cell && cell!==form && textFields.length===1 && textFields[0]===input){
        targetCheck=checks.filter(e=>cell.contains(e)&&(kind==='userid'||!/user[_\s-]*(?:id|name)|username|userid/i.test(inputCaption(e))));
      }
    }
    if(targetCheck.length>1)throw new Error('Lebih dari satu centang cocok dengan filter '+(kind==='userid'?'UserId':'Nomor Rekening')+'.');
    const checkbox=targetCheck[0];
    if(kind==='userid'&&!checkbox)throw new Error('Centang filter UserId belum dikenali; pencarian dihentikan agar tidak memakai filter yang salah.');
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
    if(checkbox?.name&&!params.has(checkbox.name))params.append(checkbox.name,checkbox.value||'on');
    if(submit.name)params.set(submit.name,submit.value||'');
    url.search='';url.hash='';
    if(method==='GET')url.search=params.toString();
    return {url:url.href,method,body:method==='POST'?params.toString():null};
  }
  const profileReadUrls=new Set();
  const profilePlans=new Map(),profileRequests=new Set();
  const profileRequestKey=(url,method,body)=>JSON.stringify([url,method,body]);
  function rememberProfileForm(row,userid,pageUrl){
    const key=new URL(pageUrl).pathname+'|'+userid.toLowerCase();profilePlans.delete(key);
    const buttons=[...row.querySelectorAll('input[type="submit"][name="cmdsend"]')].filter(e=>/^profil$/i.test(e.value.trim())&&!e.disabled);
    if(buttons.length!==1)return;
    const button=buttons[0],form=button.form;
    if(!form||button.getAttribute('onclick')||form.getAttribute('onsubmit'))return;
    if(form.querySelectorAll('input[type="submit"][name="cmdsend"][value="Profil"]').length!==1)return;
    const url=new URL(button.getAttribute('formaction')||form.getAttribute('action')||pageUrl,pageUrl);
    const method=(button.getAttribute('formmethod')||form.method||'GET').toUpperCase();
    if(url.origin!==ADMIN_ORIGIN||url.pathname!=='/editplayerlist.php'||!['GET','POST'].includes(method))return;
    if([...url.searchParams].some(([k,v])=>/delete|save|update|password|unlock/i.test(k)||/^(?:action|cmd|do)$/i.test(k)&&!/^(?:profil|profile|view|show|read)$/i.test(v)))return;
    const params=new URLSearchParams();
    for(const field of form.elements){
      if(field.disabled||!field.name||/^(?:submit|button|reset|image)$/i.test(field.type))continue;
      // Fast path is only for a navigation form containing hidden player fields/tokens.
      if(field.type!=='hidden'||/password|balance|information|status|delete|update|save|unlock/i.test(field.name))return;
      if(/^(?:action|act|do|mode|cmd)$/i.test(field.name)&&!/^(?:profil|profile|view|show|detail|read)$/i.test(field.value))return;
      params.append(field.name,field.value);
    }
    params.append(button.name,button.value);
    if(method==='GET')url.search=params.toString();
    profilePlans.set(key,{url:url.href,method,body:method==='POST'?params.toString():null,created:Date.now()});
  }
  async function readProfileFast(userid,listPath){
    const plan=profilePlans.get(listPath+'|'+userid.toLowerCase());
    if(!plan||Date.now()-plan.created>60000)return null;
    const key=profileRequestKey(plan.url,plan.method,plan.body);profileRequests.add(key);
    try{
      const page=await fetchAdmin(plan.url,plan.method,plan.body,'profile-fast');
      return {...profileDetails(page,userid),source:'Profil · Information (latar belakang)'};
    }finally{profileRequests.delete(key);}
  }

  const pendingAdmin=new Map();
  function cancelAdminGroup(group){for(const [handle,kind] of pendingAdmin){if(group&&kind!==group)continue;try{handle.abort();}catch{}pendingAdmin.delete(handle);}}
  function fetchAdmin(url,method='GET',body=null,group='account'){
    return new Promise((resolve,reject)=>{
      const dest=new URL(url);
      if(dest.origin!==ADMIN_ORIGIN||(!ADMIN_PATHS.includes(dest.pathname)&&dest.pathname!=='/referrallist.php'&&!(method==='GET'&&profileReadUrls.has(dest.href))&&!profileRequests.has(profileRequestKey(dest.href,method,body)))){reject(new Error('Alamat admin tidak diizinkan.'));return;}
      if(typeof GM_xmlhttpRequest!=='function'){reject(new Error('Perbarui izin skrip di Tampermonkey untuk mengakses admin.'));return;}
      let handle;
      const finish=()=>pendingAdmin.delete(handle);
      handle=GM_xmlhttpRequest({method,url:dest.href,data:body,anonymous:false,timeout:20000,
        headers:{'Cache-Control':'no-cache','Pragma':'no-cache',...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},
        onload(response){
          finish();
          try{
            if(response.status<200||response.status>=300)throw new Error('Admin merespons HTTP '+response.status+'.');
            const final=new URL(response.finalUrl||dest.href);
            if(final.origin!==ADMIN_ORIGIN||final.pathname!==dest.pathname)throw new Error('Sesi admin berubah / belum login. Buka admin dan login, lalu Cek ulang.');
            const doc=new DOMParser().parseFromString(response.responseText||'','text/html');
            const profileForm=final.pathname==='/editplayerlist.php'&&[...doc.querySelectorAll('th,td,h1,h2,h3,legend')].some(e=>/^Status\s+\S+/i.test(adminText(e)))&&/Information|Informasi/i.test(adminText(doc.body));
            if(doc.querySelector('form[action*="login"]')||doc.querySelector('input[type="password"]')&&!profileForm)throw new Error('Admin belum login. Login di Chrome yang sama, lalu Cek ulang.');
            if(/verify you are human|checking your browser|access denied/i.test(adminText(doc.body).slice(0,1500)))throw new Error('Admin menampilkan pemeriksaan akses; hasil belum bisa dibaca.');
            resolve({doc,url:final.href});
          }catch(e){reject(e);}
        },onerror(){finish();reject(new Error('Koneksi admin gagal. Periksa sesi login dan izin Tampermonkey.'));},
        ontimeout(){finish();reject(new Error('Admin tidak merespons dalam 20 detik.'));},
        onabort(){finish();reject(new Error('Pencarian dibatalkan.'));}
      });pendingAdmin.set(handle,group);
    });
  }

  function profileLink(row,pageUrl){
    const urls=[];
    for(const el of row.querySelectorAll('a,button,option,[onclick],[data-url],[data-href]')){
      const label=[adminText(el),el.title,el.getAttribute('aria-label'),...[...el.querySelectorAll('img,[title],[aria-label]')].map(n=>[n.getAttribute('alt'),n.getAttribute('title'),n.getAttribute('aria-label')].join(' '))].join(' ');
      const attrs=['href','data-url','data-href','onclick','onmousedown'].map(a=>el.getAttribute(a)||'');
      if(el.tagName==='OPTION')attrs.push(el.value);
      if(!/\bprofil(?:e)?\b/i.test(label)&&!attrs.some(v=>/editplayerlist\.php(?:[?"']|$)/i.test(v)))continue;
      // Extract literal popup URLs from href as well as onclick; never execute JS.
      const values=attrs.flatMap(raw=>[raw,...[...raw.matchAll(/['"]([^'"]+\.php(?:\?[^'"]*)?)['"]/g)].map(m=>m[1])]);
      for(const value of values){
        if(!value||/^(?:javascript:|#)/i.test(value))continue;
        let u;try{u=new URL(value,pageUrl);}catch{continue;}
        if(u.origin!==ADMIN_ORIGIN||!u.pathname.endsWith('.php')||/delete|remove|logout|reset|update|save|submit|changepass|unlock|lockuser/i.test(u.pathname))continue;
        if([...u.searchParams].some(([k])=>/delete|remove|reset|update|save|password|unlock|lockuser/i.test(k)))continue;
        if([...u.searchParams].some(([k,v])=>/^(?:action|act|do|mode|cmd|submit|status|locked|lock)$/i.test(k)&&! /^(?:view|profile|profil|show|detail|read)$/i.test(v)))continue;
        u.hash='';urls.push(u.href);
      }
    }
    const preferred=urls.filter(v=>new URL(v).pathname==='/editplayerlist.php');
    const unique=[...new Set(preferred.length?preferred:urls)];if(unique.length!==1)throw new Error('Tautan Profil pada baris User ID belum dikenali dengan pasti. Buka Tools → Profil di admin.');
    profileReadUrls.add(unique[0]);return unique[0];
  }
  function rowLock(cell){
    if(!cell)return null;
    const icons=[...cell.querySelectorAll('img,svg,i,span')].map(e=>[e.getAttribute('src'),e.getAttribute('alt'),e.getAttribute('title'),e.getAttribute('aria-label'),e.getAttribute('class')].join(' '));
    return icons.some(t=>/lock|gembok|🔒/i.test(t)&&!/unlock|unlocked|🔓/i.test(t))||/🔒/.test(adminText(cell));
  }
  function accountLockRecord(record,row,labels,pageUrl){
    const idx=labels.findIndex(l=>/^(?:userid|user\s*id|username|player)$/i.test(l));
    record.lock=rowLock(row.cells[idx]);record.lockCheckVersion=7;record.profileListPath=new URL(pageUrl).pathname;
    if(record.lock)rememberProfileForm(row,record.userid,pageUrl);
    return {state:'found',record};
  }
  function troubleDetails(page,userid){
    const copy=page.doc.body.cloneNode(true);copy.querySelectorAll('script,style').forEach(e=>e.remove());
    copy.querySelectorAll('br').forEach(e=>e.replaceWith(' '));
    const parts=copy.textContent.split(/\bUser\s*:/i).slice(1),entries=[];
    for(const part of parts){
      const m=part.trim().match(/^([\w.-]+)\s*,?\s*(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s*alasan\s*:\s*([\s\S]*)$/i);
      if(!m||m[1].toLowerCase()!==userid.toLowerCase())continue;
      const reason=m[8].replace(/\s+/g,' ').trim();if(!reason)continue;
      const [day,month,year,hour,minute,second]=m.slice(2,8).map(Number);
      const stamp=Date.UTC(year,month-1,day,hour,minute,second),date=new Date(stamp);
      if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||hour>23||minute>59||second>59)continue;
      entries.push({stamp,reason,dateText:m.slice(2,5).join('-')+' '+m.slice(5,8).join(':')});
    }
    entries.sort((a,b)=>b.stamp-a.stamp);
    if(!entries.length)throw Error('Keterangan gembok kosong atau User ID / format belum cocok.');
    if(entries[1]?.stamp===entries[0].stamp&&entries[1].reason!==entries[0].reason)throw Error('Keterangan terbaru gembok berbeda pada waktu yang sama.');
    const item=entries[0],status=/^unlocked\b/i.test(item.reason)?'Unlocked':/^locked\b/i.test(item.reason)?'Locked':/^lupa\s+password\b/i.test(item.reason)?'Lupa password':'Status belum terbaca';
    return {status,information:item.reason,source:'Gembok · alasan terbaru',reasonDate:item.dateText};
  }
  // Run only inside a dedicated admin tab created for this lookup.
  async function runProfileWorker(){
    let id=new URLSearchParams(location.hash.slice(1)).get('lc-profile-job');
    try{id=id||window.opener?.sessionStorage.getItem('lc-profile-job')||sessionStorage.getItem('lc-profile-job');}catch{}
    if(!id||!/^[a-z0-9-]+$/i.test(id)||typeof GM_getValue!=='function')return;
    const key='lc-profile-job:'+id,job=GM_getValue(key,null);
    if(!job||job.expires<Date.now()||job.result||job.error)return;
    sessionStorage.setItem('lc-profile-job',id);
    const finish=(result,error)=>{
      const current=GM_getValue(key,null);if(!current||current.result||current.error)return;
      GM_setValue(key,{...current,...(result?{result}:{error}),finished:Date.now()});
      sessionStorage.removeItem('lc-profile-job');
      if(location.pathname==='/editplayerlist.php')try{window.close();}catch{}
    };
    try{
      if(document.querySelector('form[action*="login"]'))throw Error('Login admin diperlukan untuk membuka Tools → Profil.');
      if(location.pathname==='/editplayerlist.php'){
        if(job.stage!=='profile')return;
        const result=profileDetails({doc:document,url:location.href},job.userid);
        finish({...result,source:'Tools → Profil · Information'});return;
      }
      if(!ADMIN_PATHS.includes(location.pathname)||location.pathname!==job.listPath)return;
      if(job.stage==='start'){
        const req=searchRequest({doc:document,url:location.href},job.userid,'userid');
        GM_setValue(key,{...job,stage:'searched'});
        // Submit only the verified player-list search, never the Profile editor.
        const form=document.createElement('form'),dest=new URL(req.url);form.method=req.method;form.action=dest.origin+dest.pathname;
        for(const [name,value] of new URLSearchParams(req.method==='POST'?req.body:dest.search)){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input);}
        document.body.append(form);HTMLFormElement.prototype.submit.call(form);return;
      }
      if(job.stage!=='searched')return;
      const player=playerById({doc:document,url:location.href},job.userid);
      if(!player)throw Error('User ID tidak ditemukan pada tab admin; Profil tidak dibuka.');
      const caption=e=>[adminText(e),e.title,e.getAttribute('aria-label'),...[...e.querySelectorAll('img')].map(x=>x.alt||x.title||'')].join(' ').trim();
      const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
      const options=()=>[...player.row.querySelectorAll('a,button,input[type="button"],input[type="submit"],option,[role="menuitem"]')].filter(e=>!e.disabled&&(/^(?:profil|profile)$/i.test(caption(e))||/^(?:profil|profile)$/i.test(e.tagName==='INPUT'?e.value:adminText(e))));
      let entries=options();
      if(!entries.some(e=>e.tagName==='OPTION'||visible(e))){
        const tools=[...player.row.querySelectorAll('a,button,[role="button"]')].filter(e=>/^tools$/i.test(adminText(e)||e.title||''));
        if(tools.length===1&&!(tools[0].tagName==='BUTTON'&&tools[0].type==='submit'))tools[0].click();
        await new Promise(r=>setTimeout(r,300));entries=options();
      }
      entries=entries.filter(e=>e.tagName==='OPTION'||visible(e));
      if(entries.length!==1)throw Error('Tombol Profil pada baris User ID belum dikenali secara unik. Kirim HTML tombol Tools → Profil.');
      const target=entries[0];
      if(/^(?:INPUT|BUTTON)$/.test(target.tagName)&&target.type==='submit'){
        // Confirmed admin control: <input name="cmdsend" type="submit" value="Profil" id="xxx">.
        // Scope by exact player row, never by the potentially repeated id="xxx".
        if(target.name!=='cmdsend'||!/^profil$/i.test(target.value.trim())||!target.form)throw Error('Tombol submit Profil belum cocok dengan cmdsend=Profil.');
        const action=new URL(target.getAttribute('formaction')||target.form.getAttribute('action')||location.href,location.href);
        if(action.origin!==ADMIN_ORIGIN||![...ADMIN_PATHS,'/editplayerlist.php'].includes(action.pathname))throw Error('Tujuan form Profil berbeda dari halaman admin yang dikenali.');
        // Native click retains the form's hidden player identifier, tokens and submitter value.
      }
      const href=target.getAttribute('href')||'';
      if(href&&!/^(?:javascript:|#)/i.test(href)){
        const dest=new URL(href,location.href);
        if(dest.origin!==ADMIN_ORIGIN||dest.pathname!=='/editplayerlist.php')throw Error('Tujuan tombol Profil belum sesuai editplayerlist.php.');
      }
      GM_setValue(key,{...job,stage:'profile'});
      // Execute the original row handler so the site selects this exact player.
      if(target.tagName==='OPTION'){
        const select=target.closest('select');if(!select)throw Error('Pilihan Profil tidak memiliki menu.');
        select.value=target.value;select.dispatchEvent(new Event('change',{bubbles:true}));
      }else target.click();
      // Also support a same-page Profile dialog / same-origin iframe.
      const timer=setInterval(()=>{
        const current=GM_getValue(key,null);if(!current||current.result||current.error||Date.now()>job.expires){clearInterval(timer);return;}
        for(const doc of [document,...[...document.querySelectorAll('iframe')].map(e=>{try{return e.contentDocument;}catch{return null;}}).filter(Boolean)]){
          try{const result=profileDetails({doc,url:location.href},job.userid);finish({...result,source:'Tools → Profil · Information'});clearInterval(timer);return;}catch{}
        }
      },500);
    }catch(e){finish(null,e.message);}
  }
  let profileWorkerQueue=Promise.resolve();
  function readProfileFromPlayerRow(userid,listPath){
    const run=async()=>{
      if(typeof GM_openInTab!=='function'||typeof GM_setValue!=='function'||typeof GM_getValue!=='function')throw Error('Simpan versi terbaru dan izinkan akses tab admin di Tampermonkey.');
      if(!ADMIN_PATHS.includes(listPath))throw Error('Sumber daftar pemain belum diketahui. Cek ulang rekening.');
      const id=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),key='lc-profile-job:'+id;
      GM_setValue(key,{userid,listPath,stage:'start',expires:Date.now()+45000});
      let tab;
      try{
        tab=GM_openInTab(ADMIN_ORIGIN+listPath+'#lc-profile-job='+id,{active:false,insert:true,setParent:true});
        const deadline=Date.now()+45000;
        while(Date.now()<deadline){
          await new Promise(r=>setTimeout(r,500));
          const value=GM_getValue(key,null);
          if(value?.error)throw Error(value.error);
          if(value?.result)return value.result;
        }
        throw Error('Tools → Profil belum terbuka dalam 45 detik. Periksa login dan izin popup admin; Profil kosong tidak digunakan.');
      }finally{try{tab?.close();}catch{}GM_deleteValue(key);}
    };
    const pending=profileWorkerQueue.then(run,run);profileWorkerQueue=pending.catch(()=>{});return pending;
  }
  async function readLockReason(userid,listPath=ADMIN_PATHS[0]){
    // Direct Profile lookup: execute Tools → Profil on the exact player row.
    // Do not request trouble.php or open an unselected editplayerlist.php.
    try{
      // Reuse the exact row's form before opening an inactive compatibility tab.
      let fast=null;try{fast=await readProfileFast(userid,listPath);}catch{}
      if(fast)return {...fast,fallbackNote:''};
      return {...await readProfileFromPlayerRow(userid,listPath),fallbackNote:''};
    }
    catch(e){throw Error('Profil: '+e.message);}
  }
  async function readRecoveryProfile(record){
    if(!record.lock)return;
    try{
      record.profile=await readLockReason(record.userid,record.profileListPath);
      record.profileCheckedAt=Date.now();record.profileError='';
    }catch(e){record.profileError=e.message;}
  }
  function playerById(page,userid){
    const rowsFound=[];let empty=false,recognized=false,rowsSeen=false;
    for(const table of page.doc.querySelectorAll('table')){
      const rows=[...table.rows].filter(r=>r.closest('table')===table);
      const hi=rows.findIndex(r=>[...r.cells].some(c=>/^(?:userid|user\s*id|username)$/i.test(adminText(c))));if(hi<0)continue;
      const labels=[...rows[hi].cells].map(adminText),idx=labels.findIndex(l=>/^(?:userid|user\s*id|username)$/i.test(l));recognized=true;
      for(const row of rows.slice(hi+1)){
        if(/^(?:tidak ada data|data tidak ditemukan|no data(?: available(?: in table)?)?|no records found)[.!\s]*$/i.test(adminText(row))){empty=true;continue;}
        if(!adminText(row)||[...row.cells].every(c=>c.tagName==='TH'))continue;rowsSeen=true;
        if(!row.cells[idx]||row.cells[idx].colSpan!==1)continue;
        const record=recordFromRow(row,labels,'');
        if(record.userid.toLowerCase()!==userid.toLowerCase())continue;
        const icons=[...row.cells[idx].querySelectorAll('img,svg,i,span')].map(e=>[e.getAttribute('src'),e.getAttribute('alt'),e.getAttribute('title'),e.getAttribute('aria-label'),e.getAttribute('class')].join(' '));
        const lock=icons.some(t=>/lock|gembok|🔒/i.test(t)&&! /unlock|unlocked|🔓/i.test(t))||/🔒/.test(adminText(row.cells[idx]));
        rowsFound.push({row,userid:record.userid,lock});
      }
    }
    if(rowsFound.length>1)throw new Error('Lebih dari satu baris cocok dengan User ID. Periksa admin.');
    if(rowsFound.length===1)return rowsFound[0];
    let echoed=false;try{echoed=userIdField(page.doc).value.toLowerCase()===userid.toLowerCase();}catch{}
    if(recognized&&empty&&echoed&&!rowsSeen)return null;
    throw new Error('User ID persis belum ditemukan; hasil kosong belum terkonfirmasi.');
  }
  function profileDetails(page,userid){
    const heading=[...page.doc.querySelectorAll('th,td,caption,h1,h2,h3,legend,b,strong')].some(e=>adminText(e).toLowerCase()==='status '+userid.toLowerCase());
    const identity=[...page.doc.querySelectorAll('input[name]')].some(e=>/^(?:userid|user_id|username)$/i.test(e.name)&&e.value.toLowerCase()===userid.toLowerCase());
    if(!heading&&!identity)throw new Error('Profil terbuka tetapi User ID tidak cocok. Buka Profil pemain yang benar di admin lalu Cek ulang; alamat lengkap Profil diperlukan jika pemain belum terpilih.');
    const controlFor=(label,selector)=>{
      for(const tr of page.doc.querySelectorAll('tr')){const cells=[...tr.cells];if(cells.length>=2&&label.test(adminText(cells[0])))return cells.slice(1).map(c=>c.querySelector(selector)).find(Boolean);}
      return [...page.doc.querySelectorAll(selector)].find(e=>label.test((e.labels?.[0]?.textContent||e.name||e.id||'').trim()));
    };
    const select=controlFor(/^status\s*:?$/i,'select');
    const raw=select?[...select.selectedOptions].map(o=>adminText(o)).join(' '):'';
    const key=raw.toLowerCase().replace(/[^a-z]/g,'');
    const status=/^unlo?cked$|^unloked$/.test(key)?'Unlocked':/^locked$|^loked$/.test(key)?'Locked':/^lupapass?word$|^lupapassword$/.test(key)?'Lupa password':'';
    if(!status)throw new Error('Status Profil belum terbaca sebagai Unlocked, Locked, atau Lupa password.');
    const info=controlFor(/^(?:information|informasi)\s*:?$/i,'textarea,input');
    if(!info)throw new Error('Kolom Information belum dikenali pada Profil.');
    return {status,information:String(info.value||'').trim()};
  }
  function parseBalance(value){
    const raw=String(value??'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/−/g,'-').trim().replace(/^(?:rp\.?|idr)\s*/i,'').replace(/\s/g,'');
    if(!raw)return null;
    let numeric;
    // Admin format: 3,055.50; also accept explicit Indonesian 3.055,50.
    if(/^-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(raw))numeric=raw.replace(/,/g,'');
    else if(/^-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw))numeric=raw.replace(/\./g,'').replace(',','.');
    else if(/^-?\d+(?:[.,]\d{1,2})?$/.test(raw))numeric=raw.replace(',','.');
    else return null;
    const amount=Number(numeric);
    return Number.isFinite(amount)&&Math.abs(amount)<=Number.MAX_SAFE_INTEGER/100?amount:null;
  }
  function balanceDisplay(record){
    const value=record.balance;
    if(typeof value!=='number'||!Number.isFinite(value))return {text:'Belum terbaca',tone:'unknown',note:record.balanceError||'Balance belum diambil dari admin.'};
    // Saldo < Rp10.000 = hijau, Rp10.000 ke atas = merah.
    // Nilai tepat 10.000 tidak boleh dianggap di bawah ambang.
    const high=value>=10000;
    return {text:value.toLocaleString('id-ID',{minimumFractionDigits:0,maximumFractionDigits:0}),
      tone:high?'high':'low',note:high?'SALDO 10.000 KE ATAS':'DI BAWAH 10.000'};
  }
  function balanceFromRow(row,labels){
    const label=s=>String(s||'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[↕↑↓▲▼:]/g,'').replace(/\s+/g,' ').trim();
    const matches=s=>/^(?:(?:current|available)\s+)?(?:balance|saldo)(?:\s*(?:\((?:rp|idr)\)|rp|idr|tersedia|saat ini))?$/i.test(label(s));
    let index=labels.findIndex(matches);
    const cell=index>=0?row.cells[index]:[...row.cells].find(c=>matches(c.getAttribute('data-label')||c.getAttribute('data-title')||''));
    if(!cell)return {balance:null,balanceRaw:'',balanceError:'Kolom Balance tidak ditemukan pada hasil admin.'};
    const copy=cell.cloneNode(true);copy.querySelectorAll('script,style,button,img,svg').forEach(n=>n.remove());
    const values=[copy.textContent,...[...cell.querySelectorAll('input:not([type="hidden"]),output')].map(n=>n.value||n.textContent),cell.getAttribute('data-balance')].filter(v=>v!=null&&String(v).trim());
    const parsed=values.map(v=>({raw:String(v).trim(),value:parseBalance(String(v).replace(/^\s*(?:balance|saldo)\s*:?\s*/i,''))})).filter(v=>v.value!==null);
    if(new Set(parsed.map(v=>v.value)).size===1)return {balance:parsed[0].value,balanceRaw:parsed[0].raw,balanceError:''};
    return {balance:null,balanceRaw:String(values[0]||'').slice(0,100),balanceError:parsed.length?'Ada beberapa nilai balance yang berbeda.':'Kolom Balance ditemukan, tetapi nilainya kosong atau formatnya belum dikenali.'};
  }
  async function refreshBalance(){
    if(accountState.phase==='loading'||!accountState.number||paused)return;
    // The account number may have been reassigned. Re-resolve from Now to Old,
    // replace the entire record, and bypass the cached owner and balance.
    await runAccount(accountState.number,true);
  }
  function combinedBankInfo(cell,number){
    const empty={matched:false,bank:'',holder:'',bankVerified:false,holderVerified:false};
    if(!cell)return empty;
    const copy=cell.cloneNode(true);
    copy.querySelectorAll('script,style,button,svg,img,input').forEach(x=>x.remove());
    // <br> dan elemen blok dijadikan pemisah sebelum textContent dibaca.
    copy.querySelectorAll('br,div,p,li').forEach(x=>{if(x.tagName==='BR')x.replaceWith('\n');else x.append('\n');});
    const raw=String(copy.textContent||'').replace(/\u00a0/g,' ');
    const chunks=raw.split(/[\r\n,;|]+|\s+\/\s+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
    let matched=false,bank='',holder='',bv=false,hv=false;
    const stripped=ch=>ch.replace(/^(?:no\.?\s*rek(?:ening)?|nomor\s*rek(?:ening)?|norek|account\s*(?:no|number))\s*[:=\-]?\s*/i,'').trim();
    for(const chunk of chunks){
      const clean=stripped(chunk);
      if(exactAccountCell(clean,number))matched=true;
      const bankLabel=chunk.match(/^(?:jenis\s+bank|nama\s+bank|bank|e-?wallet)\s*[:=\-]\s*(.+)$/i);
      const holderLabel=chunk.match(/^(?:nama(?:\s*rek(?:ening)?|\s+pemilik(?:\s*rek(?:ening)?)?)?|atas\s+nama|a\s*\/?\s*n)\s*[:=\-]\s*(.+)$/i);
      if(bankLabel&&knownBankNames.has(normalizeBank(bankLabel[1]))){bank=bankLabel[1];bv=true;}
      if(holderLabel&&validHolder(holderLabel[1])){holder=holderLabel[1];hv=true;}
    }
    // Cari satu nomor persis di blok gabungan tanpa mengira angka parsial.
    if(!matched&&numberRuns(raw).includes(cleanAccount(number)))matched=true;
    if(!matched)return empty;
    const withoutNumber=chunks.filter(ch=>!exactAccountCell(stripped(ch),number));
    if(!bv){
      const banks=withoutNumber.filter(ch=>knownBankNames.has(normalizeBank(ch)));
      if(banks.length===1){bank=banks[0];bv=true;}
    }
    if(!hv){
      const holders=withoutNumber.filter(ch=>validHolder(ch)&&!knownBankNames.has(normalizeBank(ch)));
      if(holders.length===1){holder=holders[0];hv=true;}
    }
    // Format admin satu baris: 'BCA BUDI SANTOSO 1234567890'.
    if(!bv||!hv){
      const words=raw.replace(/\s+/g,' ').trim(),escaped=number.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      let m=words.match(new RegExp('^(.*?)\\b'+escaped+'\\b(.*)$'));
      // Format admin dapat menyimpan +62 / 62, walaupun pencarian memakai 0.
      if(!m){
        for(const hit of words.matchAll(/(?<!\d)(?:\+\s*)?\d(?:[\d\s.,\-\/]*\d)?(?!\d)/g)){
          if(cleanAccount(hit[0])!==cleanAccount(number))continue;
          m=[words,words.slice(0,hit.index),words.slice(hit.index+hit[0].length)];
          break;
        }
      }
      if(m){
        const around=(m[1]+' '+m[2]).replace(/\s+/g,' ').trim();
        const toks=[...around.matchAll(/\S+/g)].map(hit=>({text:hit[0],start:hit.index,end:hit.index+hit[0].length}));
        const candidates=[];
        for(let a=0;a<toks.length;a++)for(let size=1;size<=5&&a+size<=toks.length;size++){
          const b=a+size-1,part=around.slice(toks[a].start,toks[b].end),canonical=normalizeBank(part);
          if(knownBankNames.has(canonical))candidates.push({start:toks[a].start,end:toks[b].end,bank:canonical,size});
        }
        const distinct=new Set(candidates.map(c=>c.bank));
        if(distinct.size===1){
          candidates.sort((a,b)=>b.size-a.size);
          const best=candidates[0],rest=around.slice(0,best.start)+' '+around.slice(best.end);
          if(!bv){bank=best.bank;bv=true;}
          const cleanRest=rest.replace(/^(?:nama\s*(?:rekening|pemilik)?\s*[:=]?\s*)/i,'')
            .replace(/^[\s:,.\-/]+|[\s:,.\-/]+$/g,'').trim();
          if(!hv&&validHolder(cleanRest)){holder=cleanRest;hv=true;}
        }
      }
    }
    return {matched,bank,holder,bankVerified:bv,holderVerified:hv};
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
    const bankIndex=find(/^(?:bank(?:\s*account|\s*\/\s*e-wallet|\s*\/\s*rekening)?|bank\s*e\s*wallet|jenis bank|nama bank|bank\s*dan\s*rekening|bank\s*\/\s*nama\s*rekening)$/i);
    const holderIndex=find(/^(?:nama rekening|nama rek|nama lengkap|nama(?:\s+pemilik)?|atas nama|nama pemilik(?: rekening)?|account name|nama nasabah|pemilik rekening)$/i);
    let bank=value(bankIndex),holder=value(holderIndex);
    let bankVerified=bankIndex>=0&&knownBankNames.has(normalizeBank(bank));
    let holderVerified=holderIndex>=0&&validHolder(holder);
    const combined=bankIndex>=0?combinedBankInfo(row.cells[bankIndex],number):null;
    if(combined?.matched){
      if(combined.bankVerified){bank=combined.bank;bankVerified=true;}
      else if(!bankVerified){bank='';bankVerified=false;}
      if(combined.holderVerified){holder=combined.holder;holderVerified=true;}
    }else if(bankIndex>=0 && /\d{5,}/.test(bank) && !knownBankNames.has(normalizeBank(bank))){
      // Bank/holder bernilai campur tanpa pemisah yang jelas.
      bankVerified=false;
    }
    if(bankVerified)bank=displayBank(bank);
    return {userid,referral,bank,holder,number,bankVerified,holderVerified,identityReadRevision:15,...balanceFromRow(row,labels)};
  }
  function exactAccountCell(value,number){
    const raw=String(value||'').normalize('NFKC').trim();
    return /^\+?[0-9\s.,()/-]+$/.test(raw)&&accountNumberRE.test(cleanAccount(raw))&&cleanAccount(raw)===cleanAccount(number);
  }
  function resultAt(page,number){
    let verified=false;
    try{verified=cleanAccount(accountField(page.doc).value)===number;}catch{}
    const emptyText=t=>/^(?:tidak ada data|data tidak ditemukan|data kosong|no data(?: available)?(?: in table)?|no records(?: found)?|no matching records found|0 records)[.!\s]*$/i.test(t);
    let emptyEvidence=false,tableSeen=false,rowsSeen=false;const exactMatches=[];
    for(const table of page.doc.querySelectorAll('table')){
      const rows=[...table.rows].filter(r=>r.closest('table')===table);
      const header=rows.findIndex(r=>{
        const labels=[...r.cells].map(adminText);
        return labels.some(t=>/^(?:user\s*id|userid|username|player)$/i.test(t))&&labels.some(t=>/^(?:nomor\s*rekening|no\.?\s*rek(?:ening)?|rekening|norek|bank(?:\s*account|\s*\/\s*e-wallet|\s*\/\s*rekening)?|bank\s*e\s*wallet|jenis bank|nama bank)$/i.test(t));
      });
      if(header<0)continue;tableSeen=true;
      const labels=[...rows[header].cells].map(adminText);
      const nr=labels.findIndex(t=>/^(?:nomor\s*rekening|no\.?\s*rek(?:ening)?|rekening|norek)$/i.test(t));
      const bank=labels.findIndex(t=>/^(?:bank(?:\s*account|\s*\/\s*e-wallet|\s*\/\s*rekening)?|bank\s*e\s*wallet|jenis bank|nama bank)$/i.test(t));
      for(const row of rows.slice(header+1)){
        const txt=adminText(row);
        if(emptyText(txt)){emptyEvidence=true;continue;}
        if(!txt||!row.cells.length||[...row.cells].every(c=>c.tagName==='TH'))continue;
        rowsSeen=true;
        const record=recordFromRow(row,labels,number);
        if(!/^[a-z0-9_.-]{3,40}$/i.test(record.userid)||/^(?:total|userid|username|no|data)$/i.test(record.userid))continue;
        if(nr>=0&&row.cells[nr]?.colSpan===1&&exactAccountCell(adminText(row.cells[nr]),number)){exactMatches.push(accountLockRecord(record,row,labels,page.url));continue;}
        if(bank>=0&&row.cells[bank]?.colSpan===1){
          // Rekening berlabel 'No Rek:' atau dipisah <br> / koma tetap dikenali.
          if(combinedBankInfo(row.cells[bank],number).matched){exactMatches.push(accountLockRecord(record,row,labels,page.url));continue;}
        }
      }
    }
    if(exactMatches.length>1)throw new Error('Ada beberapa pemain dengan nomor rekening yang sama. Cocokkan langsung di admin sebelum memberikan User ID / reset password.');
    if(exactMatches.length===1)return exactMatches[0];
    // An empty indicator must belong to a recognized player table, and the
    // response must echo this exact account search. Unrelated "Total: 0" is ignored.
    if(verified&&tableSeen&&emptyEvidence&&!rowsSeen)return {state:'absent'};
    return {state:'unknown',message:tableSeen?'Tidak ada kecocokan persis yang terbaca; hasil kosong belum terkonfirmasi.':'Tabel hasil admin belum dikenali.'};
  }
  async function lookupAt(path,number,group='account'){
    const page=await fetchAdmin(ADMIN_ORIGIN+path,'GET',null,group);
    const req=searchRequest(page,number);
    return resultAt(await fetchAdmin(req.url,req.method,req.body,group),number);
  }
  // Cadangan 888 hanya di ADMIN NOW. Alur wajib berurutan:
  // cari NOMOR ASLI NOW -> NOMOR ASLI OLD (di runAccount) -> 888+ASLI NOW
  // -> NOMOR ASLI NOW sekali lagi. Tidak pernah mencari 888 di OLD.
  async function search888ThenRestoreOriginal(number,lookup=lookupAt){
    const original=cleanAccount(number),prefixed='888'+original;
    if(!accountNumberRE.test(original)||!accountNumberRE.test(prefixed)||original.startsWith('888')){
      return {skipped:true,original,prefixed:'',prefixedResult:null,recheck:null,
        reason:original.startsWith('888')?'Nomor sudah berawalan 888; tidak menambahkan awalan lagi.':'Nomor terlalu panjang untuk dicoba dengan awalan 888.'};
    }
    let prefixedResult,recheck;
    try{prefixedResult=await lookup(ADMIN_PATHS[0],prefixed);}
    catch(e){prefixedResult={state:'unknown',message:'Pencarian awalan 888 gagal: '+String(e?.message||e)};}
    // Kembalikan nomor asli lalu lakukan pencarian NOW lagi.
    try{recheck=await lookup(ADMIN_PATHS[0],original);}
    catch(e){recheck={state:'unknown',message:'Pemeriksaan ulang nomor asli gagal: '+String(e?.message||e)};}
    const prefixedFound=prefixedResult.state==='found',originalFound=recheck.state==='found';
    const conflict=prefixedFound&&originalFound&&
      String(prefixedResult.record?.userid||'').toLowerCase()!==String(recheck.record?.userid||'').toLowerCase();
    return {skipped:false,original,prefixed,prefixedResult,recheck,
      conflict,chosen:originalFound?'original':prefixedFound?'prefixed':'',
      // Jangan menyimpulkan tidak ada jika salah satu pencarian gagal/unknown.
      fullyAbsent:prefixedResult.state==='absent'&&recheck.state==='absent'};
  }


  let liveChatContext=null,selectionTimer=null,selectionDragging=false,selectionKeyboard=false;
  // Manual selection is in RAM only, scoped to the active conversation.
  // Do not write highlighted chat/passwords into localStorage or GM storage.
  let manualEvidence=null, highlightedDraft=null;

  const selectionPins=new Map();
  let accountShowResult=false;
  const accountCachePrefix='lc-account-results-v1:'+adminCacheScope;
  const accountCacheMemory=new Map();
  function readAccountCache(chat=route){
    if(!chat)return {latest:'',results:{}};
    if(accountCacheMemory.has(chat))return accountCacheMemory.get(chat);
    let data;
    try{data=JSON.parse(localStorage.getItem(accountCachePrefix+chat)||'null');}catch{}
    if(!data||data.version!==1||!data.results||typeof data.results!=='object')data={version:1,latest:'',results:{}};
    accountCacheMemory.set(chat,data);return data;
  }
  // Kunci hasil HIJAU per percakapan. Isi pesan/password TIDAK disimpan.
  // Hanya nomor, asal admin, waktu, dan sidik jari pesan (hash) yang disimpan.
  const greenLocksMemory=new Map();
  const recoveryWindows=new Map();
  function briefHash(text){
    let h=2166136261;
    for(const c of String(text||'').normalize('NFKC').toLowerCase()){
      h^=c.charCodeAt(0);h=Math.imul(h,16777619);
    }
    return (h>>>0).toString(36);
  }
  function messageToken(m){
    const stable=m?.e?.getAttribute?.('data-message-id')||m?.e?.getAttribute?.('data-event-id')||'';
    return stable?'id:'+stable:'text:'+String(m?.kind||'')+':'+briefHash(m?.originalText||m?.text||'');
  }
  function tailCheckpoint(messages){
    if(!messages?.length)return null;
    const end=messages.length-1,token=messageToken(messages[end]);
    return {token,occurrence:messages.slice(0,end+1).filter(m=>messageToken(m)===token).length};
  }
  function positionOfCheckpoint(messages,checkpoint){
    if(!checkpoint||!messages?.length)return -1;
    let n=0;
    for(let i=0;i<messages.length;i++){
      if(messageToken(messages[i])===checkpoint.token&&++n===checkpoint.occurrence)return i;
    }
    return -1; // DOM virtualized/previous messages missing -> do not guess.
  }
  function getGreenLock(chat=route){
    if(greenLocksMemory.has(chat))return greenLocksMemory.get(chat);
    const value=readAccountCache(chat).greenLock||null;
    // Hasil hijau versi lama harus dibandingkan ulang dengan pembaca baru.
    const safe=value?.identityRevision===16?value:null;
    greenLocksMemory.set(chat,safe);return safe;
  }
  function setGreenLock(value,chat=route){
    greenLocksMemory.set(chat,value||null);
    const cache=readAccountCache(chat);
    if(value)cache.greenLock=value;else delete cache.greenLock;
    try{localStorage.setItem(accountCachePrefix+chat,JSON.stringify(cache));}catch{}
  }
  function sourceText(source){
    return source==='NOW'?'ADMIN SEKARANG (NOW)':source==='OLD'?'ADMIN LAMA (OLD)':'ADMIN BELUM DIPASTIKAN';
  }
  function freezeGreenAccount(evidence){
    if(accountState.phase!=='done'||!accountState.record||!evidence?.length||!['NOW','OLD'].includes(accountState.source))return;
    const old=getGreenLock();
    if(old&&old.number===accountState.number&&old.source===accountState.source)return;
    const live=liveChatContext?.route===route?liveChatContext.messages:null;
    const checkpoint=tailCheckpoint(live);
    const lock={number:accountState.number,source:accountState.source,identityRevision:16,ts:Date.now(),
      checkpoint,selectionHash:manualEvidence?.route===route?briefHash(manualEvidence.messages.map(m=>m.text).join('\n')):'',
      userId:accountState.record.userid};
    setGreenLock(lock);
  }
  function newerRequestWithNewData(messages,lock){
    const boundary=positionOfCheckpoint(messages,lock.checkpoint);
    if(boundary<0)return null; // cannot prove this text is below the verified one
    const fresh=messages.slice(boundary+1);
    for(let i=0;i<fresh.length;i++){
      const m=fresh[i];
      if(m.kind!=='member')continue;
      const intents=detectIntent(m.originalText||m.text||'');
      if(!intents.includes('password')&&!intents.includes('username'))continue;
      const section=fresh.slice(i);
      const extracted=extractAccounts(section);
      const nums=[...new Set([...extracted.strong,...extracted.possible])];
      // A new request without a NEW account reply is NOT a new lookup.
      if(nums.length!==1)continue;
      const requestType=intents.includes('password')?'password':'username';
      return {number:nums[0],requestType,messages:section,checkpoint:tailCheckpoint(messages),
        requestToken:messageToken(m)};
    }
    return null;
  }
  function clearGreenLockForNewRequest(fresh){
    setGreenLock(null);
    manualEvidence=null;highlightedDraft=null;accountFingerprint='';
    selectionPins.delete(route);
    cancelAccount();
    accountShowResult=true;
    if(fresh?.requestToken)recoveryWindows.set(route,{token:fresh.requestToken});
    else recoveryWindows.delete(route);
    accountState={active:true,options:[],requestType:fresh?.requestType||'password',number:'',
      phase:'idle',now:'Belum dicek',old:'Menunggu hasil Now',
      message:'Permintaan pemulihan BARU setelah verifikasi selesai; mencari rekening baru.'};
  }
  function windowedRecoveryMessages(messages){
    const point=recoveryWindows.get(route);
    if(!point)return messages;
    const i=messages.findIndex(m=>messageToken(m)===point.token);
    return i<0?null:messages.slice(i);
  }
  function greenStatus(){
    const lock=getGreenLock();
    return lock?'💡 SESUAI · '+sourceText(lock.source)+' · '+lock.number+' · Pencarian dikunci sampai ada permintaan pemulihan baru dan data rekening baru.':'';
  }
  function cachedAccount(number='',chat=route){
    const data=readAccountCache(chat),result=data.results[number||data.latest];
    if(!result||!/^\d{5,25}$/.test(result.number)||!['done','error'].includes(result.phase))return null;
    // Older versions cached a stop at Now without ever searching Old.
    // Retry those incomplete entries once under the corrected lookup flow.
    if(!result.lookupRevision && result.now!=='TERDAFTAR' && /^(?:Belum dicek|Menunggu hasil Now)$/i.test(result.old||''))return null;
    // Refresh old negative results once using stricter, table-scoped evidence.
    // Versi lama (termasuk 2.73.19) kadang melewati 888 ketika respons
    // NOW/OLD tidak dapat dipastikan. Cache negatif harus diperiksa ulang.
    if((result.lookupRevision||0)<5&&!result.record&&result.phase==='done')return null;
    if(result.record&&(result.record.lockCheckVersion||0)<7&&!result.completed&&!result.conversationCompleted)return null;
    if(result.record&&(result.record.identityReadRevision||0)<15&&!result.completed&&!result.conversationCompleted)return null;
    if(result.record&&(!result.record.number||!result.record.bank||!result.record.holder)&&!result.completed&&!result.conversationCompleted)return null;
    const restored=JSON.parse(JSON.stringify(result));restored.balanceLoading=false;if(restored.record)delete restored.record.referralPending;return restored;
  }
  function saveAccountResult(){
    if(!accountState.number||!['done','error'].includes(accountState.phase))return;
    const data=readAccountCache();
    accountState.lookupRevision=5;
    accountState.savedAt=accountState.savedAt||Date.now();
    accountState.stored=true;
    data.version=1;data.latest=accountState.number;
    data.results[accountState.number]=JSON.parse(JSON.stringify(accountState));
    try{localStorage.setItem(accountCachePrefix+route,JSON.stringify(data));}
    catch{accountState.stored=false;data.results[accountState.number].stored=false;}
  }
  function restoreAccountResult(number=''){
    const lock=getGreenLock();
    if(lock&&!number)number=lock.number;
    const result=cachedAccount(number);
    if(!result)return false;
    cancelAccount();accountShowResult=false;accountState={...result,active:true,fromCache:true};
    const data=readAccountCache();if(data.latest!==result.number){data.latest=result.number;try{localStorage.setItem(accountCachePrefix+route,JSON.stringify(data));}catch{}}
    drawAccount();return true;
  }
  function isAccountFinished(chat=route){return Boolean(conversationDone(chat)||cachedAccount('',chat)?.completed);}
  function finishAccount(){
    if(conversationRoute()!==route){scan();return;}
    if(!['done','error'].includes(accountState.phase))return;
    accountShowResult=false;accountState.completed=true;saveAccountResult();
    cards=cards.filter(c=>c.type!=='password');render();drawAccount();
    if(!cards.length)$('bubble').classList.remove('unread');
  }
  let accountState={active:false,options:[],number:'',phase:'idle',now:'Belum dicek',old:'Menunggu hasil Now',message:''};
  let accountEpoch=0,accountTimer=null,accountFingerprint='',accountLastRender='';
  function cancelAccount(){
    accountEpoch++;clearTimeout(accountTimer);accountTimer=null;
    cancelAdminGroup('account');
  }
  function resetAccount(){
    cancelAccount();accountFingerprint='';
    accountState={active:false,options:[],number:'',phase:'idle',now:'Belum dicek',old:'Menunggu hasil Now',message:''};
    const finished=conversationDone();
    if(finished)applyConversationDone(finished);else if(!restoreAccountResult())drawAccount();
  }
  function verificationTranscript(){
    // v2.73.33 FIX: The selected chat transcript is AUTHORITATIVE for identity.
    // Previous code returned the full chat first, silently ignoring selection.
    // Do not borrow any name/bank from outside the user's highlight.
    const selected=manualEvidence?.route===route?manualEvidence.messages:null;
    if(selected?.length)return selected;
    // When nothing is selected, automatic scanning of the active conversation
    // stays available, starting strictly after Started/Mulai - Hari ini.
    const full=liveChatContext?.route===route?liveChatContext.messages:null;
    return full?.length?(windowedRecoveryMessages(full)||full):null;
  }
  function verificationEvidenceSource(){
    return manualEvidence?.route===route&&manualEvidence.messages?.length?'BLOK CHAT':isChatGacor&&isArchive()?'CHAT ARSIP':'CHAT HARI INI';
  }
  function drawAccount(){
    const el=$('account');if(!el)return;
    // Identity verdict: selected chat has priority; entire active conversation
    // is only the fallback when there is no selected evidence.
    const evidence=verificationTranscript();
    const verification=accountState.record&&evidence?.length?
      compareChatAdmin(evidence,accountState.number,accountState.record):null;
    if(verification){
      verification.detail='SUMBER '+verificationEvidenceSource()+' • '+verification.detail;
    }
    if(verification&&accountState.lookupConflict){
      verification.state='review';
      verification.detail='⚠ Nomor asli dan nomor berawalan 888 ditemukan pada User ID yang berbeda di ADMIN NOW. Jangan tetapkan cocok sebelum memeriksa keduanya langsung di admin.';
      if(verification.check?.number)verification.check.number.status='ambiguous';
    }
    if(verification&&accountState.record&&(accountState.record.identityReadRevision||0)<15){
      verification.state='review';
      verification.detail='⚠ Hasil admin tersimpan berasal dari versi pembaca lama. Klik Cek ulang untuk memakai pembacaan identitas terbaru.';
      for(const key of ['number','holder','bank'])if(verification.check[key])verification.check[key].status='unknown';
    }
    // Hasil cache tetap ditampilkan, tapi jangan diberi tanda hijau sebagai
    // verifikasi terkini jika belum di-refresh sejak 15 menit lalu.
    if(verification&&accountState.savedAt&&Date.now()-accountState.savedAt>15*60*1000){
      verification.state=verification.state==='mismatch'?'mismatch':'review';
      verification.detail+=' ⚠ Data admin sudah lebih dari 15 menit; klik Cek ulang.';
    }
    if(verification?.state==='match'&&accountState.phase==='done')freezeGreenAccount(evidence);
    // Lampu pada bubble mengikuti hasil pemeriksaan, hanya indikator visual.
    const light=$('bubble');
    if(light){
      const allMatch=verification?.state==='match' && accountState.phase==='done';
      light.dataset.identity=allMatch?'match':verification?.state==='mismatch'?'mismatch':verification?.state==='review'?'review':'idle';
      light.style.removeProperty('box-shadow');
      light.style.removeProperty('border-color');
      light.title=allMatch?'💡 COCOK SEMUA: nomor, nama rekening, dan bank dari percakapan hari ini cocok dengan admin.':
                  verification?.state==='mismatch'?'Ada data berbeda antara chat dan admin.':
                  verification?.state==='review'?'Data belum cocok semua; lihat rincian di tabel.':'Asisten Chat';
    }
    const signature=JSON.stringify(accountState)+'|'+accountShowResult+'|'+JSON.stringify(verification);
    if(signature===accountLastRender)return;accountLastRender=signature;
    el.hidden=!accountState.active;el.replaceChildren();if(!accountState.active)return;
    el.dataset.found=String(Boolean(accountState.record));
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
      const reopen=document.createElement('button');reopen.id='account-reopen';reopen.className='view-result';reopen.textContent='Buka kembali';reopen.onclick=manuallyReopen;actions.append(reopen);
      if(accountState.number)actions.append(view,retry);el.append(icon,eyebrow,title,note,actions);
      const foot=document.createElement('small');foot.className='finished-foot';
      foot.textContent=accountState.stored?'✓ Tersimpan untuk chat ini':'Tersimpan selama halaman ini terbuka';
      el.append(foot);return;
    }
    const heading=document.createElement('div');heading.className='category';heading.textContent=accountState.requestType==='username'?'LUPA USERNAME • CEK REKENING':accountState.requestType==='account'?'CEK IDENTITAS • REKENING MEMBER':'RESET PASSWORD • CEK REKENING';el.append(heading);
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
      const line=document.createElement('div'),label=document.createElement('b'),valueEl=document.createElement('span');line.dataset.source=name;line.dataset.state=/GAGAL|BELUM BISA/.test(value)?'error':/TIDAK ADA/.test(value)?'empty':/TERDAFTAR/.test(value)?'found':/Sedang/.test(value)?'loading':'idle';label.textContent=name;label.title=sourceText(name);valueEl.textContent=value;line.append(label,valueEl);status.append(line);
    }
    const context=document.createElement('details');context.className='aux-details account-context';
    const contextTitle=document.createElement('summary');contextTitle.textContent='Detail pemeriksaan';context.append(contextTitle);
    if(accountState.record&&accountState.phase==='done'){
      context.open=/GAGAL|BELUM BISA|BELUM ADA/.test(accountState.now+' '+accountState.old);
      context.append(status);el.append(context);
    }else el.append(status);
    if(accountState.now==='DI PEMAIN NOW TIDAK ADA'&&accountState.old==='DI PEMAIN OLD TIDAK ADA'){
      const absent=document.createElement('div');absent.className='not-registered';
      const title=document.createElement('strong');title.textContent='TIDAK TERDAFTAR';
      const note=document.createElement('span');note.textContent='Nomor rekening tidak ditemukan di admin Now maupun Old.';
      absent.append(title,note);el.append(absent);
    }
    if(accountState.record){
      const record=accountState.record;
      const card=document.createElement('section');card.className='player-result';card.dataset.source=accountState.source;
      card.dataset.verification=verification?.state||'idle';
      const banner=document.createElement('div');banner.className='player-banner';banner.dataset.source=accountState.source;
      banner.textContent=(verification?.state==='mismatch'?'✖ TERDAFTAR · IDENTITAS TIDAK COCOK':verification?.state==='review'?'⚠ TERDAFTAR · PERLU VERIFIKASI':verification?.state==='match'?'💡 ✓ SEMUA DATA COCOK':!manualEvidence?'🔎 TERDAFTAR · MENUNGGU DATA VERIFIKASI':'✓ TERDAFTAR')+' · '+sourceText(accountState.source);
      if(verification?.state==='mismatch'){
        banner.style.setProperty('background','#bd263b','important');
        banner.style.setProperty('color','#fff','important');
        banner.style.setProperty('border-color','#d33244','important');
      }
      if(verification?.state==='review'){
        banner.style.setProperty('background','#6a491b','important');
        banner.style.setProperty('color','#ffe9b1','important');
        banner.style.setProperty('border-color','#bf8e31','important');
      }
      card.append(banner);
      const table=document.createElement('table');table.className='player-table';
      for(const [label,value] of [['User ID',record.userid],['Referral (Downline Aktif)',referralText(record)],['Bank / E-wallet',displayBank(record.bank)],['Nama Rekening',record.holder],['Nomor Rekening',record.number]]){
        const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');
        th.scope='row';th.textContent=label;td.textContent=value||'Belum terbaca';
        if(label==='Nomor Rekening')td.className='number-highlight';
        if(label==='User ID')td.className='userid-value';
        const checkKey=label==='Nomor Rekening'?'number':label==='Nama Rekening'?'holder':label==='Bank / E-wallet'?'bank':'';
        const compared=checkKey&&verification?.check?.[checkKey];
        if(compared?.status==='match'){
          // Lampu hijau pada ISI bubble admin bila cocok dengan blok chat.
          td.textContent=(value||'Belum terbaca')+' ✓';
          td.title='COCOK setelah normalisasi. Chat: '+compared.chat.join(' / ')+' | Admin: '+compared.admin;
          td.style.setProperty('background','#146c3b','important');
          td.style.setProperty('color','#ffffff','important');
          td.style.setProperty('font-weight','750','important');
          td.style.setProperty('box-shadow','inset 0 0 0 1px #7df5aa, 0 0 9px #35dd7359','important');
        }else if(compared?.status==='partial'){
          td.textContent=(value||'Belum terbaca')+' ⚠ SEBAGIAN';
          td.title='Nama dalam chat hanya sebagian dari nama admin. Chat: '+compared.chat.join(' / ')+'; Admin: '+compared.admin+'. Belum cocok penuh.';
          td.style.setProperty('background','#795422','important');
          td.style.setProperty('color','#fff0c7','important');
        }else if(compared?.status==='mismatch'){
          td.textContent=(value||'Belum terbaca')+' ✖ BERBEDA';
          td.title='PERBEDAAN TERKONFIRMASI — Teks yang diblok: '+(compared.chat.join(' / ')||'Belum ada')+' | Hasil admin: '+(compared.admin||'Belum terbaca');
          td.style.setProperty('background','#ba2139','important');
          td.style.setProperty('color','#ffffff','important');
          td.style.setProperty('font-weight','750','important');
        }else if(compared?.status==='unknown'||compared?.status==='ambiguous'||compared?.status==='not_found'){
          td.textContent=(value||'Belum terbaca')+(compared.status==='not_found'?' ⚠ TIDAK ADA DI CHAT':' ⚠ CEK');
          td.title='Belum terverifikasi — Chat: '+(compared.chat.join(' / ')||'tidak terbaca')+'; Admin: '+(compared.admin||'tidak terbaca')+'. Klik Cek ulang jika ini data lama.';
          td.style.setProperty('background','#5f471f','important');
          td.style.setProperty('color','#ffe5a1','important');
        }
        tr.append(th,td);table.append(tr);
      }card.append(table);
      if(record.lock){
        const warning=document.createElement('div');warning.className='recovery-lock';
        const title=document.createElement('strong');title.textContent='🔒 USER ID TERKUNCI · '+record.userid;
        const status=document.createElement('p');status.textContent='Status terbaca: '+(record.profile?.status||'Belum berhasil dibaca');
        const info=document.createElement('p');info.textContent=record.profile?(record.profile.source||'Information')+(record.profile.reasonDate?' · '+record.profile.reasonDate:'')+'\nKeterangan: '+(record.profile.information||'(kosong)'):record.profileError||'Sedang membuka Profil dan membaca Information…';
        const advice=document.createElement('p');advice.textContent=record.profile?.status==='Unlocked'?'Gembok dan Status Profil berbeda. Periksa langsung di admin.':'Periksa keterangan admin sebelum melanjutkan. Lupa User ID tetap tidak memerlukan reset password.';
        warning.append(title,status,info,advice);card.append(warning);
      }
      const refnote=document.createElement('small');refnote.textContent=record.referralStats?'Upline '+record.userid+' · '+record.referralStats.from+' sampai '+record.referralStats.to:record.referralError||'Referral diperiksa setelah rekening ditemukan.';const refdetail=document.createElement('details');refdetail.className='aux-details referral-detail';
      const refsummary=document.createElement('summary');refsummary.textContent=record.referralError?'Detail referral · perlu diperiksa':'Detail referral';refdetail.open=Boolean(record.referralError);refdetail.append(refsummary,refnote);
      if(record.referral){const code=document.createElement('p');code.textContent='Kode referral pemain: '+record.referral;refdetail.append(code);}card.append(refdetail);
      if(accountState.phase==='done'&&!record.referralStats&&!record.referralError&&!record.referralPending){
        record.referralPending=true;const chat=route,number=accountState.number,epoch=accountEpoch;
        Promise.resolve().then(async()=>{
          try{const result=await lookupReferral(record.userid);if(route===chat&&accountEpoch===epoch&&accountState.number===number&&accountState.record===record)record.referralStats=result;}
          catch(e){if(route===chat&&accountEpoch===epoch&&accountState.record===record)record.referralError=e.message;}
          finally{delete record.referralPending;if(route===chat&&accountEpoch===epoch&&accountState.record===record){saveAccountResult();drawAccount();}}
        });
      }
      const balance=balanceDisplay(record);
      const balanceBox=document.createElement('div');balanceBox.className='balance-box';balanceBox.dataset.tone=balance.tone;
      const balanceLabel=document.createElement('span');balanceLabel.textContent='BALANCE';
      const balanceValue=document.createElement('strong');balanceValue.textContent=accountState.balanceLoading?'Membaca…':balance.text;
      const balanceNote=document.createElement('span');balanceNote.textContent=balance.note;
      const balanceTime=document.createElement('small');balanceTime.textContent='Saat pengecekan • '+new Date(accountState.balanceCheckedAt||accountState.savedAt||Date.now()).toLocaleString('id-ID');
      balanceBox.append(balanceLabel,balanceValue,balanceNote,balanceTime);
      const refresh=document.createElement('button');refresh.textContent=accountState.balanceLoading?'Mengambil balance…':'↻ Perbarui saldo';refresh.disabled=Boolean(accountState.balanceLoading);refresh.title='Cari ulang rekening dari Now ke Old dan perbarui User ID beserta balance, termasuk setelah rekening dipindahkan.';refresh.onclick=refreshBalance;balanceBox.append(refresh);card.append(balanceBox);
      // Migrate a cached result lacking a balance only once; never poll indefinitely.
      if(balance.tone==='unknown'&&!accountState.balanceReadRevision&&!accountState.balanceLoading&&!paused){
        accountState.balanceReadRevision=1;saveAccountResult();
        const chat=route,number=accountState.number;
        Promise.resolve().then(()=>{if(route===chat&&accountState.number===number)refreshBalance();});
      }
      const copy=document.createElement('button');copy.className='copy-player';copy.textContent='Salin data pemain';
      if(verification&&verification.state!=='match'){
        copy.disabled=true;copy.title='Nomor, nama, dan bank dari chat belum semuanya cocok dengan admin.';
      }
      copy.onclick=async()=>{
        const content=['Pemain '+accountState.source,'User ID: '+(record.userid||'Belum terbaca'),'Referral (Downline Aktif): '+referralText(record),'Bank / E-wallet: '+(displayBank(record.bank)||'Belum terbaca'),'Nama Rekening: '+(record.holder||'Belum terbaca'),'Nomor Rekening: '+record.number,'Balance (saat pengecekan): '+balanceDisplay(record).text].join('\n');
        try{await navigator.clipboard.writeText(content);copy.textContent='✓ Data tersalin';}catch{setStatus('Clipboard belum diizinkan browser.');}
      };card.append(copy);el.append(card);
    }
    const note=document.createElement('p');
    note.textContent=verification?.detail||accountState.message||'Ambil rekening dari pesan member setelah Started - Today.';
    if(verification?.state==='mismatch'){
      note.style.setProperty('color','#ff7085','important');
      note.style.fontWeight='800';
    }else if(verification?.state==='review'){
      note.style.setProperty('color','#edc072','important');
    }
    if(accountState.record&&accountState.phase==='done'&&(!verification||verification.state==='match'))context.append(note);
    else el.append(note);
    for(const option of accountState.options.filter(n=>n!==accountState.number)){
      const b=document.createElement('button');b.className='account-option';b.textContent='Cek '+option;
      b.onclick=()=>runAccount(option,manualEvidence?.route===route);el.append(b);
    }
    const field=document.createElement('input');field.type='text';field.inputMode='numeric';field.autocomplete='off';field.placeholder='Tempel rekening jika belum terbaca';field.setAttribute('aria-label','Nomor rekening untuk diperiksa');
    const go=document.createElement('button');go.textContent=accountState.phase==='loading'?'Mencari…':'Cek rekening';go.disabled=accountState.phase==='loading';
    go.onclick=()=>{const value=cleanAccount(field.value);if(!/^\d{5,25}$/.test(value)){setStatus('Isi nomor rekening 5–25 digit, bosku.');return;}runAccount(value,manualEvidence?.route===route);};
    const manual=document.createElement('details');manual.className='manual-account';
    const summary=document.createElement('summary');summary.textContent='Tempel / ganti nomor rekening';
    manual.append(summary,field,go);el.append(manual);
    if(accountState.number && accountState.phase!=='loading'){
      const retry=document.createElement('button');retry.textContent='Cek ulang';retry.id='account-retry';retry.onclick=()=>runAccount(accountState.number,true);el.append(retry);
    }
    const finish=document.createElement('button');finish.id='account-finish';finish.className='account-finish';finish.textContent=accountState.completed?'Kembali ke pencarian selesai':'✓ Selesai';finish.disabled=!['done','error'].includes(accountState.phase);finish.title='Tampilkan ringkasan selesai; hasil tetap tersimpan';finish.onclick=finishAccount;el.append(finish);
    for(const [name, href] of [['Admitoto', defaultAdmin+ADMIN_PATHS[0]], ['Suksesbogil', suksesLogin]]){
      const link=document.createElement('a');
      link.href=href;
      link.target='_blank';
      link.rel='noopener noreferrer';
      link.textContent='Buka admin '+name+' / login';
      link.className='admin-link';
      manual.append(link);
    }
  }
  function referralDates(){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get=k=>+parts.find(p=>p.type===k).value,y=get('year'),m=get('month'),d=get('day'),prev=Math.min(d,new Date(Date.UTC(y-1,m,0)).getUTCDate());
    const fmt=(yr,day)=>String(day).padStart(2,'0')+'-'+String(m).padStart(2,'0')+'-'+yr;
    return {from:fmt(y-1,prev),to:fmt(y,d)};
  }
  function referralFields(doc){
    const fields=[...doc.querySelectorAll('input[name]')].filter(e=>e.form&&!['hidden','submit','checkbox','radio','button','password'].includes(e.type));
    const pick=re=>{const matches=fields.filter(e=>re.test(inputCaption(e)));if(matches.length!==1)throw Error('Kolom Upline / tanggal referral belum dikenali dengan pasti.');return matches[0];};
    const up=pick(/\bupline\b/i),from=pick(/tanggal\s*awal|date\s*from|start\s*date|\bvaldatef\b/i),to=pick(/tanggal\s*akhir|date\s*to|end\s*date|\bvaldatet\b/i);
    if(up.form!==from.form||up.form!==to.form)throw Error('Kolom referral berada di formulir berbeda.');return {up,from,to};
  }
  function referralRequest(page,userid,dates){
    const {up,from,to}=referralFields(page.doc),form=up.form;
    const submit=[...form.querySelectorAll('button,input[type="submit"]')].find(e=>/^(cari|search|submit)$/i.test(adminText(e)||e.value));if(!submit)throw Error('Tombol Cari referral belum dikenali.');
    const url=new URL(submit.getAttribute('formaction')||form.getAttribute('action')||page.url,page.url),method=(form.method||'GET').toUpperCase();
    if(url.origin!==ADMIN_ORIGIN||url.pathname!=='/referrallist.php'||!['GET','POST'].includes(method))throw Error('Tujuan pencarian referral tidak sesuai.');
    const params=new URLSearchParams();const dateValue=(e,v)=>e.type==='date'?v.split('-').reverse().join('-'):v;
    for(const e of form.elements){
      if(!e.name||e.disabled||['submit','button','reset','file'].includes(e.type))continue;
      if(e===up){params.set(e.name,userid);continue;}if(e===from||e===to){params.set(e.name,dateValue(e,e===from?dates.from:dates.to));continue;}
      if(e.type==='hidden'){params.set(e.name,/^page$/i.test(e.name)?'1':e.value);continue;}
      if(['checkbox','radio'].includes(e.type))continue;
      if(e.tagName==='SELECT'){
        if(/^(bts|limit|show|rows|pagesize)$/i.test(e.name)){params.set(e.name,e.value);continue;}
        const all=[...e.options].find(o=>o.value===''||/^(semua|all)$/i.test(o.textContent.trim()));if(!all)throw Error('Filter referral '+e.name+' belum memiliki pilihan Semua / kosong.');params.set(e.name,all.value);continue;
      }params.set(e.name,'');
    }
    if(submit.name)params.set(submit.name,submit.value||'Cari');
    url.search='';if(method==='GET')url.search=params.toString();return {url:url.href,method,body:method==='POST'?params.toString():null};
  }
  function referralResult(page,userid,dates){
    const f=referralFields(page.doc),dateNorm=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v.split('-').reverse().join('-'):v;
    if(f.up.value.trim().toLowerCase()!==userid.toLowerCase()||dateNorm(f.from.value)!==dates.from||dateNorm(f.to.value)!==dates.to)throw Error('Hasil referral tidak mengonfirmasi Upline dan rentang tanggal yang diminta.');
    for(const table of page.doc.querySelectorAll('table')){
      const rows=[...table.rows],header=rows.find(r=>{const text=[...r.cells].map(adminText).join(' ');return /\bupline\b/i.test(text)&&/downline\s*total/i.test(text)&&/downline\s*aktif/i.test(text);});if(!header)continue;
      const names=[...header.cells].map(adminText),ui=names.findIndex(t=>/^upline$/i.test(t)),ti=names.findIndex(t=>/^downline\s*total$/i.test(t)),ai=names.findIndex(t=>/^downline\s*aktif$/i.test(t));if([ui,ti,ai].some(i=>i<0))continue;
      const body=rows.slice(rows.indexOf(header)+1).filter(r=>r.cells.length>=names.length&&!/^total\s*:/i.test(adminText(r)));
      const exact=body.filter(r=>adminText(r.cells[ui]).toLowerCase()===userid.toLowerCase());
      const count=t=>/^\d+(?:[.,]\d{3})*$/.test(t)?Number(t.replace(/[.,]/g,'')):null;
      if(exact.length===1){const total=count(adminText(exact[0].cells[ti])),active=count(adminText(exact[0].cells[ai]));if(total===null||active===null)throw Error('Jumlah downline belum terbaca.');return {total,active,...dates,userid,checkedAt:Date.now()};}
      if(!body.length&&/(?:^|\D)0\s+of\s+0(?:\D|$)|tidak ada data|no (?:data|records)/i.test(adminText(page.doc.body)))return {total:0,active:0,...dates,userid,checkedAt:Date.now()};
      throw Error('Baris Upline tidak cocok atau hasil belum pasti.');
    }throw Error('Tabel referral belum dikenali.');
  }
  async function lookupReferral(userid){
    if(!userid||!String(userid).trim())throw Error('User ID hasil rekening belum terbaca.');
    const dates=referralDates(),page=await fetchAdmin(ADMIN_ORIGIN+'/referrallist.php');
    const req=referralRequest(page,userid,dates);return referralResult(await fetchAdmin(req.url,req.method,req.body),userid,dates);
  }
  function referralText(record){return record.referralStats?String(record.referralStats.active):record.referralError?'Belum berhasil dicek':'Belum dicek';}

  async function runAccount(number,force=false){
    number=cleanAccount(number);
    if(!accountNumberRE.test(number)){setStatus('Nomor rekening belum valid. Periksa kembali angka yang dikirim member.');return;}
    if(conversationRoute()!==route){scan();return;}
    if(!force && getGreenLock()){
      if(cachedAccount(getGreenLock().number))restoreAccountResult(getGreenLock().number);
      setStatus(greenStatus());return;
    }
    if(force && getGreenLock())setGreenLock(null); // Explicit manual Cek ulang bypass.
    if(!force && accountState.phase==='loading'&&accountState.number===number)return;
    if(!force && restoreAccountResult(number))return;
    if(paused){setStatus('Klik Lanjut sebelum mengecek rekening.');return;}
    cancelAccount();accountShowResult=false;const epoch=accountEpoch,chat=route;
    const current=()=>epoch===accountEpoch&&chat===route&&conversationRoute()===chat;
    accountState={...accountState,number,record:null,source:'',lookupVariant:'',lookupConflict:false,fallbackSearch:null,balanceReadRevision:1,balanceLoading:false,balanceCheckedAt:null,savedAt:null,stored:false,completed:false,conversationCompleted:false,completionRefresh:force&&Boolean(conversationDone()),fromCache:false,phase:'loading',now:'Sedang mencari…',old:'Menunggu hasil Now',message:'Membersihkan filter dan mencari Nomor Rekening di Pemain Now.'};drawAccount();
    try{
      const now=await lookupAt(ADMIN_PATHS[0],number);if(!current())return;
      if(now.state==='found'){
        accountState.record=now.record;accountState.source='NOW';accountState.now='TERDAFTAR';accountState.old='Tidak perlu dicek';accountState.message=accountState.requestType==='username'?'Rekening ditemukan di Pemain Now. Berikan User ID saja setelah cocok; jangan reset password.':'Rekening ditemukan di Pemain Now. Cocokkan identitas member sebelum reset password.';
      }else{
        // Hasil unknown BUKAN bukti rekening tidak terdaftar.
        const nowAbsent=now.state==='absent';
        accountState.now=nowAbsent?'DI PEMAIN NOW TIDAK ADA':'BELUM ADA KECOCOKAN TERBACA';
        accountState.old='Sedang mencari…';
        accountState.message='Lanjut mencari nomor ASLI di Pemain Old.';drawAccount();
        const old=await lookupAt(ADMIN_PATHS[1],number);if(!current())return;
        accountState.record=old.state==='found'?old.record:null;
        accountState.source=old.state==='found'?'OLD':'';
        accountState.old=old.state==='found'?'TERDAFTAR':old.state==='absent'?'DI PEMAIN OLD TIDAK ADA':'BELUM BISA DIPASTIKAN';
        if(old.state==='found'){
          accountState.message=nowAbsent?'Nomor asli ditemukan di ADMIN LAMA (OLD).':'Nomor asli ditemukan di ADMIN LAMA (OLD); hasil NOW belum pasti.';
        }else if(old.state!=='found'){
          // NOMOR ASLI tidak ditemukan sebagai kecocokan yang terkonfirmasi di NOW dan OLD.
          // Halaman admin dapat mengembalikan 'unknown' walau hasil kosong (form filter tidak
          // di-echo). Tetap coba pencarian 888 di NOW; jangan menganggap unknown = tidak ada.
          const firstPassConfirmedEmpty=nowAbsent&&old.state==='absent';
          accountState.now='Mencari 888'+number+' di NOW…';
          accountState.message=(firstPassConfirmedEmpty?
            'Nomor asli tidak terdaftar di NOW/OLD. ':
            'Nomor asli belum ditemukan; status kosong NOW/OLD belum terkonfirmasi. ')+
            'Mencari 888'+number+' hanya di ADMIN NOW, lalu mencari ulang '+number+' di ADMIN NOW.';
          drawAccount();
          const fallback=await search888ThenRestoreOriginal(number);if(!current())return;
          accountState.fallbackSearch=fallback.skipped?{skipped:true,reason:fallback.reason}:
            {prefixedNumber:fallback.prefixed,prefixedState:fallback.prefixedResult.state,
              originalRecheckState:fallback.recheck.state};
          if(fallback.skipped){
            accountState.now='DI PEMAIN NOW TIDAK ADA';
            accountState.message='Nomor asli tidak ditemukan di NOW maupun OLD. '+fallback.reason;
          }else if(fallback.chosen==='original'){
            accountState.record=fallback.recheck.record;
            accountState.source='NOW';
            accountState.lookupVariant='original-recheck';
            accountState.lookupConflict=fallback.conflict;
            accountState.now=fallback.conflict?'TERDAFTAR · NOMOR ASLI DAN 888':'TERDAFTAR · NOMOR ASLI';
            accountState.message=fallback.conflict?
              'PERLU VERIFIKASI: nomor asli dan nomor 888 ditemukan pada User ID berbeda.':
              'Nomor asli ditemukan di ADMIN NOW pada pemeriksaan ulang setelah mencari awalan 888.';
          }else if(fallback.chosen==='prefixed'){
            // Nomor admin apa adanya (888...) ditampilkan pada tabel.
            // Nama/bank tetap harus cocok sebelum lampu hijau menyala.
            accountState.record={...fallback.prefixedResult.record,
              recovery888:{source:'NOW',originalNumber:number,storedNumber:fallback.prefixed}};
            accountState.source='NOW';
            accountState.lookupVariant='prefix-888';
            accountState.now='TERDAFTAR · AWALAN 888';
            accountState.lookupConflict=!firstPassConfirmedEmpty&&fallback.recheck.state==='unknown';
            accountState.message='Nomor cadangan '+fallback.prefixed+' ditemukan di ADMIN NOW. Nomor asli '+number+
              ' sudah dicari kembali di NOW. '+
              (accountState.lookupConflict?'Hasil asli sebelumnya belum pasti; verifikasi manual diperlukan.':
               fallback.recheck.state==='absent'?'Nomor asli tidak ditemukan pada pemeriksaan ulang.':
               'Hasil pemeriksaan ulang nomor asli belum pasti.');
          }else if(fallback.fullyAbsent&&firstPassConfirmedEmpty){
            accountState.now='DI PEMAIN NOW TIDAK ADA';
            accountState.message='TIDAK TERDAFTAR setelah empat pemeriksaan: NOW '+number+', OLD '+number+
              ', NOW '+fallback.prefixed+', lalu NOW '+number+'.';
          }else{
            accountState.now='BELUM BISA DIPASTIKAN';
            accountState.message='Empat langkah pencarian sudah dicoba: NOW '+number+', OLD '+number+
              ', NOW '+fallback.prefixed+', NOW '+number+'. Belum ada hasil cocok yang bisa dipastikan. '+
              [now.message,old.message,fallback.prefixedResult.message,fallback.recheck.message].filter(Boolean).join(' ');
          }
        }
      }
      if(accountState.requestType==='username'&&accountState.source==='OLD')accountState.message+=' Berikan User ID saja; jangan reset password.';
      if(accountState.record?.userid){
        const record=accountState.record;drawAccount();
        await readRecoveryProfile(record);if(!current())return;
        if(record.lock)accountState.message='Gembok terdeteksi pada User ID '+record.userid+'. Periksa Status dan Information pada Profil sebelum melanjutkan pemulihan akun.';
        drawAccount();
        try{record.referralStats=await lookupReferral(record.userid);record.referralError='';}
        catch(e){record.referralError=e.message;}
        if(!current())return;
      }
      accountState.phase='done';
    }catch(e){
      if(!current())return;
      if(accountState.old==='Sedang mencari…')accountState.old='GAGAL DICEK';else accountState.now='GAGAL DICEK';
      accountState.phase='error';accountState.message=e.message;
    }
    if(current()){
      if(conversationDone()&&manualEvidence?.route!==route){accountState.conversationCompleted=true;accountState.completed=true;accountShowResult=false;}
      accountState.completionRefresh=false;saveAccountResult();drawAccount();
      if(manualEvidence?.route===route){
        if(accountState.phase==='error')setStatus('Blok chat terbaca, tetapi pencarian admin gagal: '+accountState.message);
        else if(accountState.record){
          const check=compareChatAdmin(verificationTranscript()||manualEvidence.messages,accountState.number,accountState.record);
          setStatus(check?.state==='match'?'✓ COCOK: nomor rekening, nama, dan bank dari percakapan sesuai admin.':
            check?.state==='mismatch'?'✖ TIDAK COCOK: '+check.detail:
            '⚠ PERLU VERIFIKASI: '+(check?.detail||'Sebagian data belum terbaca.'));
        }else setStatus('Blok chat terbaca, tetapi nomor rekening belum ditemukan atau hasil NOW/OLD belum dapat dipastikan.');
      }
      $('bubble').classList.add('unread');playNotice();
    }
  }
  function hasNewRecoveryAfterCompletion(messages){
    const lastRequest=messages.map((m,i)=>({m,i})).filter(({m})=>m.kind==='member'&&(resetIntent.test(m.text)||usernameIntent.test(m.text))).at(-1);
    if(!lastRequest)return false;
    // Only reopen automatically with a visible earlier SENT completion. This
    // avoids treating a partial, virtualized transcript as a brand new request.
    for(let i=lastRequest.i-1;i>=0;i--){
      const m=messages[i];
      if(m.kind==='agent'&&/user\s*id\s*:/i.test(m.text)&&/note\s*:/i.test(m.text)&&sentCompletion(messages.slice(0,i+1)))return true;
    }
    return false;
  }
  const reopenedMemory=new Map();
  function reopenMessageKey(m){
    const id=m.e?.getAttribute('data-message-id')||m.e?.getAttribute('data-event-id');
    if(id)return 'id:'+id;
    // No password or message body is persisted in the reopen checkpoint.
    const text=String(m.text||'').replace(/password\s*:[\s\S]*?(?=silahkan|silakan|note\s*:|$)/gi,'password: [removed]');
    let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return 'text:'+text.length+':'+(hash>>>0);
  }
  function reopenedCheckpoint(){
    if(reopenedMemory.has(route))return reopenedMemory.get(route);
    let value=null;try{value=JSON.parse(localStorage.getItem('lc-reopened-v1:'+adminCacheScope+route)||'null');}catch{}
    reopenedMemory.set(route,value);return value;
  }
  function freshCompletionMessages(messages){
    const checkpoint=reopenedCheckpoint();if(!checkpoint)return messages;
    const counts={};return messages.filter(m=>{
      if(m.kind!=='agent')return true;
      const key=reopenMessageKey(m);counts[key]=(counts[key]||0)+1;
      return counts[key]>(checkpoint[key]||0);
    });
  }
  function manuallyReopen(){
    const context=liveChatContext;
    if(!context||context.route!==route){setStatus('Muat Started - Today lalu Baca ulang sebelum membuka kembali.');return;}
    const checkpoint={};for(const m of context.messages)if(m.kind==='agent'){const key=reopenMessageKey(m);checkpoint[key]=(checkpoint[key]||0)+1;}
    reopenedMemory.set(route,checkpoint);try{localStorage.setItem('lc-reopened-v1:'+adminCacheScope+route,JSON.stringify(checkpoint));}catch{}
    reopenRecovery();accountState.active=true;
    accountState.message='Percakapan dibuka kembali di Asisten. Hasil pencarian tetap tersimpan; gunakan Cek ulang bila perlu memperbarui.';
    saveAccountResult();drawAccount();scan();$('panel').hidden=false;
  }
  function reopenRecovery(){
    conversationDoneMemory.delete(route);try{localStorage.removeItem(conversationDonePrefix+route);}catch{}
    const cache=readAccountCache();
    for(const result of Object.values(cache.results)){result.completed=false;result.conversationCompleted=false;}
    try{localStorage.setItem(accountCachePrefix+route,JSON.stringify(cache));}catch{}
    for(const signature of [...completed()])if(/\|(?:password|username)$/.test(signature))completed().delete(signature);
    for(const signature of [...seen])if(/\|(?:password|username)$/.test(signature))seen.delete(signature);
    selectionPins.delete(route);accountState.completed=false;accountState.conversationCompleted=false;accountFingerprint='';accountShowResult=true;
  }
  function syncAccount(messages){
    const rawCompletion=sentCompletion(freshCompletionMessages(messages),accountState.requestType||'');
    if(rawCompletion&&!conversationDone()){
      selectionPins.delete(route);markConversationDone(rawCompletion);return;
    }
    const green=getGreenLock();
    if(green){
      const fresh=newerRequestWithNewData(messages,green);
      if(!fresh){
        if(accountState.number!==green.number||!accountState.record)restoreAccountResult(green.number);
        return; // all green: other messages and name/bank edits DO NOT run a lookup
      }
      clearGreenLockForNewRequest(fresh);
      setStatus('Permintaan pemulihan baru ditemukan di bawah chat dan rekening baru sudah diberikan.');
    }
    // v2.73.33: Live transcript must not replace a manually selected account
    // while the selection is active. Completion and genuinely NEW recovery
    // requests were handled above; identity matching stays selection-only.
    if(manualEvidence?.route===route&&manualEvidence.messages?.length)return;
    const scoped=windowedRecoveryMessages(messages);
    if(!scoped)return; // missing original request; no mixing with earlier account
    messages=scoped;
    if(accountState.phase==='loading'&&accountState.completionRefresh)return;
    if(conversationDone()&&hasNewRecoveryAfterCompletion(messages))reopenRecovery();
    const pin=selectionPins.get(route);
    const latestRecovery=[...messages].reverse().find(m=>m.kind==='member'&&(resetIntent.test(m.text)||usernameIntent.test(m.text)));
    if(pin&&latestRecovery){pin.requestType=resetIntent.test(latestRecovery.text)?'password':'username';}
    const recoveryHint=pin?.requestType||(accountState.active?accountState.requestType:'');
    const completion=sentCompletion(freshCompletionMessages(messages),recoveryHint);
    if(completion){selectionPins.delete(route);markConversationDone(completion);return;}
    if(pin){
      if(accountState.number!==pin.number){accountState.active=true;runAccount(pin.number);}
      if(accountState.requestType!==pin.requestType){accountState.requestType=pin.requestType;drawAccount();}
      return;
    }
    const finished=conversationDone();
    if(finished){if(!accountState.conversationCompleted)applyConversationDone(finished);return;}
    if(clarification(messages)?.title==='PASTIKAN KEBUTUHAN AKUN'){
      if(accountState.phase==='loading'||!accountState.savedAt)resetAccount();return;
    }
    const intentMessage=[...messages].reverse().find(m=>m.kind==='member'&&(resetIntent.test(m.text)||usernameIntent.test(m.text)));
    const found=extractAccounts(messages);
    // Tanpa kata "lupa", nomor yang diberikan member tetap boleh memulai
    // PENCARIAN ADMIN bila ada penanda rekening/bank. Jangan menganggap
    // nomor saldo, tanggal, dan pesan agent sebagai rekening.
    const numberCandidates=[...new Set([...found.strong,...found.possible])];
    const relevantNumber=numberCandidates.length===1 && messages.some(m=>m.kind==='member' &&
      (/(?:no\.?\s*rek|nomor\s*rek|norek|rekening|bank|e[- ]?wallet|dana|gopay|jago|bca|bni|bri|bsi|mandiri)/i.test(m.originalText||m.text||'')) &&
      extractAccounts([{kind:'member',text:m.originalText||m.text||''}]).strong.concat(
        extractAccounts([{kind:'member',text:m.originalText||m.text||''}]).possible).includes(numberCandidates[0]));
    const active=Boolean(intentMessage||relevantNumber);
    if(!active){if(!accountState.savedAt && accountState.active)resetAccount();return;}
    const requestType=intentMessage?(resetIntent.test(intentMessage.text)?'password':'username'):'account';
    const freshIdentity=recoveryData(messages);
    const fingerprint=JSON.stringify({requestType,...found,claims:freshIdentity.claims.map(c=>[c.numbers,c.holder,c.bank,c.candidateHolder,c.correctionFields])});
    if(accountState.active && fingerprint===accountFingerprint)return;
    accountFingerprint=fingerprint;
    const options=[...new Set([...found.strong,...found.possible])];
    const prior=cachedAccount();
    const candidate=options.length===1?options[0]:prior&&options.includes(prior.number)?prior.number:'';
    if(candidate && restoreAccountResult(candidate)){
      accountState.options=options;accountState.requestType=requestType;drawAccount();return;
    }
    cancelAccount();
    accountState={active:true,options,requestType,number:'',phase:'idle',now:'Belum dicek',old:'Menunggu hasil Now',message:options.length>1?'Ada beberapa nomor. Pilih rekening yang benar ya bosku.':!options.length?'Nomor rekening belum terbaca. Tunggu member mengirim rekening atau tempel di bawah.':'Nomor terdeteksi dari chat.'};
    drawAccount();
    if(options.length===1){
      const epoch=accountEpoch,number=options[0];
      accountState.number=number;accountState.message='Nomor terdeteksi otomatis. Mencari di admin NOW/OLD dan mencocokkan nama serta bank dari percakapan setelah penanda hari ini.';drawAccount();
      accountTimer=setTimeout(()=>{if(epoch===accountEpoch&&!paused)runAccount(number);},900);
    }
  }

  const normalize = s => s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const startRE = /^(?:(?:Started|Mulai|Dimulai)\s*[-–—:·|]?\s*(?:Today|Hari\s+ini)|(?:Hari\s+ini|Today)\s*[-–—:]\s*(?:Started|Mulai))\b/i;
  const key = 'lc-pengingat-settings-v1';
  let cfg = {};
  try { cfg = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
  const host = document.createElement('div');
  host.id = 'lc-pengingat-bosku';
  host.dataset.chatPlatform = isChatGacor ? 'chatgacor' : 'livechat';
  host.style.cssText = 'position:fixed;right:22px;bottom:24px;z-index:2147483647;';
  document.body.appendChild(host);
  const ui = host.attachShadow({mode:'open'});
  ui.innerHTML = `<style>
:host{--bg:#101722;--surface:#182230;--line:#2b394b;--text:#edf2f8;--muted:#a3b2c5;--gold:#dfc294;--mint:#91dfc2;font:12px/1.6 'Segoe UI',Arial,sans-serif;color:var(--text);color-scheme:dark;text-align:left}
*{box-sizing:border-box}[hidden]{display:none!important}button,input,select{font:inherit}button{cursor:pointer;color:#dce6f3;background:#233044;border:1px solid #3a4a60;border-radius:10px;padding:8px 11px;line-height:1.4;transition:background .16s,border-color .16s,box-shadow .16s;overflow-wrap:anywhere}button:hover{background:#304058;border-color:#70809a}button:active{background:#172133}button:disabled{opacity:.45;cursor:default}button:focus-visible,summary:focus-visible,a:focus-visible{outline:2px solid var(--gold);outline-offset:3px}input,select{width:100%;padding:10px 11px;border:1px solid #3b4a60;background:#101923;color:#f2f5fa;border-radius:10px;margin:7px 0;min-width:0}input:focus,select:focus{outline:2px solid #dfc29444;border-color:var(--gold)}input::placeholder{color:#8798af}label{display:block;color:#b9c7d8}small{display:block;color:#9aaec1;font-size:10px;line-height:1.6;margin-top:10px}a{color:#b1cde8}summary{cursor:pointer;line-height:1.6;padding:3px 0}::selection{background:#dfc29444;color:#fff}
#bubble{display:flex;align-items:center;gap:10px;margin-left:auto;padding:9px 13px 9px 9px;border-radius:18px;border:1px solid #a68c6670;background:linear-gradient(130deg,#263245,#141d2b);font-size:12px;font-weight:650;box-shadow:0 9px 28px #0005,inset 0 1px #ffffff0c;touch-action:none}#bubble:hover{border-color:var(--gold);background:#263449}.bubble-symbol{display:grid;place-items:center;width:28px;height:28px;border-radius:10px;background:#dfc29417;color:var(--gold);font-size:20px}#count{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;border-radius:8px;font-size:10px;background:#ffffff0b;color:#cbd7e5;border:1px solid #ffffff10}#bubble.unread{border-color:var(--gold);box-shadow:0 0 0 3px #dfc29416,0 9px 28px #0005}#bubble.unread #count{background:var(--gold);color:#24202b}
#panel{width:min(332px,calc(100vw - 24px));max-height:calc(100dvh - 86px);overflow:auto;border:1px solid #50607680;border-radius:22px;margin-bottom:10px;background:var(--bg);box-shadow:0 22px 70px #0007,0 2px 10px #0004;scrollbar-width:thin;scrollbar-color:#445268 transparent;overscroll-behavior:contain}header{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:16px;background:linear-gradient(120deg,#263244,#172130);border-bottom:1px solid #dfc29426;cursor:move;touch-action:none}.brand-mark{display:grid;place-items:center;flex:0 0 34px;height:36px;border:1px solid #dfc29438;background:#dfc2940d;border-radius:12px;color:var(--gold);font-size:25px}.brand{flex:1;min-width:0}.brand strong{display:block;font-size:15px;font-weight:650;letter-spacing:.1px;color:#f4f0e9}.brand-caption{display:block;font-size:9px;letter-spacing:1.2px;text-transform:uppercase;color:#b9aa93;margin-top:2px}.edition{display:inline-block;margin-left:5px;padding:1px 4px;border-radius:4px;font-size:9px;letter-spacing:0;color:#acbbce;background:#ffffff09}#close{flex:0 0 28px;height:28px;padding:0;border-radius:9px;font-size:21px;color:#afbdd0;background:#ffffff06;border-color:#ffffff16}.body{padding:13px}#status{padding:0 1px 11px;border-bottom:1px solid #ffffff09;font-size:10px;line-height:1.65;color:#a1b1c4;margin:0 0 12px;overflow-wrap:anywhere}.category{font-size:9px;letter-spacing:.9px;font-weight:700;color:var(--gold);margin-bottom:8px;line-height:1.6}
#account{padding:13px;background:linear-gradient(145deg,#1c2939,#16212f);border:1px solid #36485d;border-radius:16px;margin-bottom:12px;overflow-wrap:anywhere}.account-number{display:block;font-size:20px;font-weight:650;letter-spacing:.5px;line-height:1.4;color:#f5f7fb;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.lookup-steps{display:grid;gap:6px;margin:12px 0}.lookup-steps>div{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:9px;background:#101925;border:1px solid #ffffff09}.lookup-steps b{flex:0 0 28px;font-size:9px;letter-spacing:.8px;color:#9dacc0;margin-top:2px}.lookup-steps span{font-size:10px;line-height:1.65;color:#c5d2e3}.lookup-steps>div[data-state="found"]{background:#15342f;border-color:#437e644f}.lookup-steps>div[data-state="found"] span{color:#a5e9c8}.lookup-steps>div[data-state="empty"] span{color:#e8cb98}.lookup-steps>div[data-state="error"] span{color:#ffadb5}.lookup-steps>div[data-state="loading"] span{color:#b4d8ff}#account p{font-size:11px;line-height:1.75;color:#b6c6d8;margin:10px 0}.account-option{font-size:11px;margin:3px;max-width:100%;overflow-wrap:anywhere}.manual-account{border-top:1px solid #ffffff10;margin-top:12px;padding-top:10px}.manual-account summary{color:#b3c0d1;font-size:11px}#account-retry{font-size:11px;margin-top:8px}.admin-link{display:block;margin:12px 0 0;text-align:center;color:#9dafc4;font-size:10px;text-decoration:none}.admin-link:hover{color:var(--gold);text-decoration:underline}
#account .account-finish{display:block;width:100%;margin-top:12px;padding:11px;font-size:12px;font-weight:700;background:#aacdbb;border:1px solid #c1ddcf;color:#142b25;border-radius:11px;box-shadow:0 3px 9px #0002}#account .account-finish:hover{background:#c4e3d3}.saved-result{border-radius:9px;padding:9px 10px;margin:0 0 12px;background:#17352e;border:1px solid #46765d66;font-size:10px;font-weight:600;color:#aee7c8}.saved-result small{font-size:9px;font-weight:400;color:#a7c4b7;margin-top:3px}
.player-result{margin:13px 0;border:1px solid #40516a;border-radius:12px;overflow:hidden;background:#101b28;color:#e6edf8}.player-banner{padding:10px 11px;font-size:10px;font-weight:700;letter-spacing:.5px;background:#29374a;color:#e9d5b2;border-bottom:1px solid #ffffff0c}.player-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}.player-table th,.player-table td{padding:10px 9px;border-bottom:1px solid #ffffff0a;vertical-align:top;text-align:left;overflow-wrap:anywhere}.player-table th{width:39%;background:#ffffff03;color:#a1b2c8;font-size:10px;font-weight:500}.player-table td{background:transparent;color:#eaf0f8;font-weight:600;user-select:text}.player-table .userid-value{color:#f0d6ab;font-weight:700;font-size:16px}.player-table .number-highlight{background:#dfc2940c;color:#e8d1aa;font-size:13px;font-weight:700;letter-spacing:.3px}.player-result .copy-player{display:block;width:calc(100% - 20px);margin:10px;padding:9px;background:#253348;color:#d6e3f4;border-color:#40536c;font-size:10px}.player-result .copy-player:hover{background:#35485e}
.balance-box{margin:11px;padding:14px 10px;border:1px solid #65758a;border-radius:12px;background:#263144;color:#d4deec;text-align:center}.balance-box>span{display:block;font-size:9px;font-weight:700;letter-spacing:1.2px}.balance-box strong{display:block;font-size:28px;font-weight:700;line-height:1.5;letter-spacing:-.6px;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.balance-box[data-tone="high"]{background:linear-gradient(120deg,#4a2530,#35202d);border-color:#d46b7b;color:#ffb2bd}.balance-box[data-tone="low"]{background:linear-gradient(120deg,#193e33,#162e2c);border-color:#528c74;color:#a6ebc7}.balance-box small{color:inherit;opacity:.9;font-size:9px;margin-top:5px}
.recovery-lock{margin:11px;padding:12px;border:1px solid #b45d72;border-radius:11px;background:#3a222e;color:#ffc1ce}.recovery-lock strong{font-size:13px;letter-spacing:.2px}.recovery-lock p{color:#f2c0ca!important;font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}.blocked-panel{padding:14px;margin-bottom:12px;border:1px solid #40516b;border-radius:15px;background:linear-gradient(145deg,#223046,#182333)}.blocked-panel>strong{display:block;font-size:20px;font-weight:650;color:#f3f6fa;overflow-wrap:anywhere}.blocked-badge{padding:9px 11px;margin:11px 0;border:1px solid #526079;border-radius:9px;background:#2e3b50;color:#dce5f2;font-weight:650;font-size:12px}.blocked-panel[data-status="Locked"] .blocked-badge{background:#472835;border-color:#a85469;color:#ffbccc}.blocked-panel[data-status="Unlocked"] .blocked-badge{background:#1b3f32;border-color:#558970;color:#b4efd2}.blocked-panel[data-status="Lupa password"] .blocked-badge{background:#433925;border-color:#8e7850;color:#f4dbad}.blocked-panel p{font-size:11px;color:#bdcadc;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.75}.blocked-panel .blocked-information{background:#101b2a;padding:12px;border-radius:10px;border:1px solid #384b64;color:#edf3fc;font-size:12px}.blocked-panel>b{font-size:10px;color:#b6c8df}
#cards{max-height:none;overflow:visible}.card{padding:13px;margin:0 0 10px;border:1px solid #344357;border-left:3px solid #82c6b1;border-radius:12px;background:#192433;overflow-wrap:anywhere}.card b{font-size:12px;color:#b8ebd9;line-height:1.6}.card p{font-size:11px;color:#c4d1e2;line-height:1.75;margin:7px 0;white-space:pre-line}.card[data-tone="waiting"]{border-left-color:#ddbd87}.card[data-tone="waiting"] b{color:#edcf9c}.card[data-tone="review"]{border-left-color:#9abbe7}.card[data-tone="review"] b{color:#c2d9f5}.card[data-tone="conduct"]{border-left-color:#d791a0;background:#2b2431}.card[data-tone="conduct"] b{color:#f2c6cd}.card[data-tone="conduct"] .category{color:#dbacb6}.quote{font-size:10px;color:#a4b4c8;margin-top:10px;padding:9px 10px;border-left:2px solid #52617a;border-radius:0 7px 7px 0;background:#0c142344;overflow-wrap:anywhere}.actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}.actions button{font-size:10px;padding:8px 10px}.body>.actions{display:grid;grid-template-columns:1fr 1fr;padding-top:12px;border-top:1px solid #ffffff0b}.body>.actions button{min-height:34px}.body>.actions #scan{color:#ead5b4;background:#dfc29412;border-color:#917e5e80}.body>.actions #clear{color:#c9b4bf}.body>details{border:1px solid #344154;border-radius:12px;margin-top:13px;padding:10px 11px;color:#afbed1;font-size:10px;background:#141f2d}.body>details[open] summary{margin-bottom:10px;color:#e3c99f}.body>details button{font-size:10px;margin:4px 2px 3px 0}.body>small{text-align:center;font-size:9px;color:#9baabd;margin:13px 7px 2px}.intent-correction{display:grid;gap:7px;margin-top:10px}.intent-correction select{margin:0;font-size:11px}.topic-summary{padding:11px;margin-bottom:10px;border:1px solid #685c46;border-radius:10px;background:#322e27;color:#e9d6b3;font-size:10px;line-height:1.7}
.not-registered{padding:16px 10px;margin:12px 0;border:1px solid #9e765b;border-radius:11px;background:#3b2e28;text-align:center}.not-registered strong{display:block;color:#f4c7a6;font-size:14px;letter-spacing:.5px}.not-registered span{display:block;color:#d7bca9;font-size:10px;margin-top:6px;line-height:1.7}
#account[data-phase="finished"]{padding:24px 15px 16px;text-align:center;background:radial-gradient(ellipse at 50% 0%,#4b9b7133,transparent 72%),#172b2b;border:1px solid #477867;border-radius:16px}.finished-icon{display:grid;place-items:center;width:49px;height:49px;margin:0 auto 16px;border:1px solid #86c8a5;border-radius:17px;background:#37785530;color:#b2efcc;font-size:25px;box-shadow:0 0 0 6px #5a9e7510}.finished-eyebrow{color:#a1c5b4;font-size:9px;letter-spacing:1.3px;font-weight:600;margin-bottom:7px}.finished-title{display:block;color:#edf8f2;font-size:20px;font-weight:650;letter-spacing:-.3px}#account[data-phase="finished"] p{font-size:11px;line-height:1.75;color:#b7cec3;margin:9px 0 18px}.finished-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.finished-actions button{margin:0!important;padding:10px 7px!important;font-size:10px!important}.finished-actions .view-result{background:#2c5146;border-color:#5d8a76;color:#dcf3e6}.finished-actions #account-retry{background:transparent;border-color:#4d7065;color:#b9d4c7}.finished-actions #account-reopen{grid-column:1/-1;background:#adcdbb;border-color:#adcdbb;color:#19362c}.finished-foot{display:block;border-top:1px solid #ffffff10;margin-top:15px;padding-top:12px;font-size:9px;color:#a0bdaf}
@media(max-width:420px){#panel{width:min(320px,calc(100vw - 24px))}header{padding:13px}.body{padding:11px}.brand strong{font-size:14px}}@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
/* Compact edition: key information first, optional controls folded. */
:host{--bg:#10151f;--gold:#d5b98e}#panel{width:min(320px,calc(100vw - 24px));border-radius:18px;background:#10151f;border-color:#384357;box-shadow:0 18px 55px #0006}header{padding:13px 14px;background:linear-gradient(115deg,#212b3b,#151e2b)}.brand-mark{flex-basis:30px;height:32px;border-radius:10px;font-size:22px}.brand strong{font-size:14px}.brand-caption,.edition{display:none}.body{padding:11px}#status{font-size:10px;margin-bottom:10px;padding-bottom:9px;color:#aab9ca}.category{font-size:9px;letter-spacing:.6px;margin-bottom:6px}#account{padding:11px;border-radius:13px;background:#182332;border-color:#324359}#account[data-found="true"]>.account-number{display:none}.saved-result{display:inline-block;padding:3px 7px;margin:0 0 8px;border-radius:6px;font-size:9px;background:#1a332b}.saved-result small{display:none}.player-result{margin:9px 0;border-radius:10px;border-color:#3a4960}.player-banner{padding:8px 10px;font-size:9px;background:#253246}.player-table th,.player-table td{padding:8px 9px}.player-table .userid-value{font-size:16px}.balance-box{margin:9px;padding:11px 9px;border-radius:10px}.balance-box strong{font-size:26px}.balance-box button{padding:6px 9px;margin-top:9px;font-size:10px;background:#ffffff08;border-color:currentColor;color:inherit}.balance-box small{font-size:9px}.recovery-lock{margin:9px;padding:10px}.recovery-lock p{line-height:1.6!important}.copy-player{margin:9px!important;width:calc(100% - 18px)!important}#account .account-finish{padding:10px;margin-top:10px}.card{padding:11px;border-radius:11px}.card p{margin:6px 0}.card .actions{margin-top:8px}.card>.actions{justify-content:flex-end}.card>.actions button{background:#254a3e;color:#c4efdc;border-color:#4b7967;min-width:80px}.aux-details{border-top:1px solid #ffffff0c;margin-top:8px;padding-top:5px;font-size:10px;color:#a7b8ca}.aux-details>summary{color:#a7b8ca;font-size:10px;padding:5px 0}.aux-details[open]>summary{color:var(--gold)}.aux-details .quote{margin-top:5px}.aux-details .actions{margin:7px 0 2px}.aux-details .actions button{font-size:9px;padding:7px 8px}.aux-details .lookup-steps{margin:7px 0}.account-context{padding:0;border-top:0;margin:0 0 7px}.referral-detail{margin:0 10px 8px}.referral-detail p{font-size:10px!important}.manual-account{margin-top:9px;padding-top:7px}.manual-account summary{font-size:10px}.body>.actions{display:block;padding-top:9px;margin-top:9px}.body>.actions button{width:100%;min-height:32px;background:transparent!important;border-color:#38495d!important;color:#c0cede!important}.body>details{padding:8px 10px;margin-top:8px;border-radius:10px;background:#141d2a}.body>details .actions{margin:5px 0 12px}#account[data-phase="finished"]{padding:20px 13px 14px}.finished-eyebrow,.finished-foot{display:none}.finished-icon{width:40px;height:40px;border-radius:13px;font-size:22px;margin-bottom:12px}.finished-title{font-size:18px}#account[data-phase="finished"] p{font-size:10px;margin-bottom:13px}.blocked-panel{padding:12px;border-radius:12px}.blocked-panel>strong{font-size:18px}.blocked-panel .blocked-information{padding:10px}.topic-summary{padding:9px;font-size:10px}
/* Midnight pearl: restrained contrast and warm metallic accents. */
:host{--bg:#15141d;--surface:#201f2d;--line:#3c394c;--text:#f2eef7;--muted:#b3adbf;--gold:#e0c6a2;--mint:#b0dccb}#panel{width:min(324px,calc(100vw - 24px));background:linear-gradient(160deg,#1e1b2a 0%,#13151f 65%);border:1px solid #69607470;border-radius:22px;box-shadow:0 24px 65px #09081475,0 0 0 1px #0003,inset 0 1px #ffffff0c}header{padding:15px 14px;background:linear-gradient(115deg,#353044,#242333 65%,#222635);border-bottom:1px solid #d4b49230}.brand-mark{background:linear-gradient(140deg,#ead4b0,#b49b80);color:#30293a;border-color:#f1dfc3;box-shadow:0 3px 12px #0003;flex-basis:33px;height:35px;border-radius:12px}.brand strong{font-size:14px;letter-spacing:.25px;color:#fff5e8}#close{background:#ffffff06;border-color:#ffffff18;color:#d9d2e1;border-radius:50%}#close:hover{background:#ffffff12}.body{padding:12px}#status{color:#afaabd;border-color:#ffffff09;padding:0 1px 10px;margin-bottom:11px}#bubble{background:linear-gradient(125deg,#363044,#222333);border:1px solid #b49b805e;border-radius:19px;padding:9px 12px 9px 9px;box-shadow:0 8px 28px #11101c55,inset 0 1px #ffffff0c;color:#f3e8d9}#bubble:hover{background:#3a3248;border-color:#dfc5a3}.bubble-symbol{background:#e4cba31c;color:#efd9b5;border-radius:10px}#count{background:#e8d3b8;color:#31283b;border:0;font-weight:700}.category{color:#d8c2a5;letter-spacing:.7px}
#account{background:linear-gradient(145deg,#272435,#1c2130);border:1px solid #51465e;border-radius:15px;padding:12px;box-shadow:inset 0 1px #ffffff07}.player-result{background:#181d2a;border-color:#4b455b;border-radius:12px;margin:10px 0}.player-banner{background:linear-gradient(100deg,#44394c,#2c3448);color:#f1d8b4;border-bottom:1px solid #ffffff08;padding:9px 10px;letter-spacing:.7px}.player-table th{background:#ffffff02;color:#b2adc2;font-weight:400}.player-table td{color:#eeeaf6}.player-table th,.player-table td{border-bottom-color:#ffffff08;padding:9px}.player-table .userid-value{color:#f5d9b0;font-size:17px;letter-spacing:.15px}.player-table .number-highlight{background:#b4a1c110;color:#ebd9ef;font-size:13px}.player-result .copy-player{background:#302d42;border-color:#554a67;color:#e6daef;border-radius:9px}.player-result .copy-player:hover{background:#42374f}.balance-box{padding:13px 9px;border-radius:12px}.balance-box strong{font-size:29px;letter-spacing:-.7px}.balance-box[data-tone="low"]{background:linear-gradient(120deg,#244439,#1c3034);border-color:#679682;color:#c1eed4;box-shadow:inset 0 1px #d7ffee0b}.balance-box[data-tone="high"]{background:linear-gradient(120deg,#512b3a,#332433);border-color:#c57887;color:#ffc3cc}.balance-box[data-tone="unknown"]{background:#292b3c;border-color:#706c84;color:#ddd7ea}.balance-box button{border-color:#ffffff30;border-radius:8px;background:#ffffff08;color:inherit}.balance-box button:hover{background:#ffffff14}#account .account-finish,.finished-actions #account-reopen{background:linear-gradient(110deg,#e0c9a6,#c7b198);color:#302a36;border-color:#ead8bc;box-shadow:0 3px 10px #0002;border-radius:10px}#account .account-finish:hover,.finished-actions #account-reopen:hover{background:#efdcbd}
button{background:#2c2c3e;border-color:#49465d;color:#e1dcec;border-radius:9px}button:hover{background:#3c354e;border-color:#8c769b}input,select{background:#181c29;border-color:#4b455e;color:#f0ebf8;border-radius:9px}input::placeholder{color:#a39baf}.card{background:linear-gradient(135deg,#252232,#202635);border-color:#484055;border-left-color:#9fcdb8;border-radius:13px;padding:12px}.card b{color:#c2e9d7;font-size:12px}.card p{color:#d0c9dd;line-height:1.75}.card[data-tone="review"]{border-left-color:#b3a4dc}.card[data-tone="review"] b{color:#ded0fa}.card[data-tone="waiting"]{border-left-color:#d9ba89}.card[data-tone="waiting"] b{color:#eed2a5}.card[data-tone="conduct"]{background:#332734;border-left-color:#cd94a3}.card>.actions button{background:#bfcfc3;border-color:#d1e0d4;color:#24362f;font-weight:600}.quote{background:#11152066;border-left-color:#796984;color:#bcb2cb}.aux-details,.aux-details>summary{color:#bcb0ca;border-top-color:#ffffff0b}.aux-details[open]>summary{color:#f0d9b4}.body>details{background:#201d2b;border-color:#474055;border-radius:12px}.body>.actions button{border-color:#51475f!important;color:#d9cbe8!important}.body>.actions button:hover{background:#30283d!important}.saved-result{background:#254036;color:#c2e8d0;border-color:#547e6655}.lookup-steps>div{background:#171b28;border-color:#ffffff0a}.blocked-panel{background:linear-gradient(135deg,#2f293d,#202b3d);border-color:#5b4c6b;border-radius:14px}.blocked-panel .blocked-information{background:#171a27;border-color:#514762;color:#eee7f5;border-radius:10px}.blocked-panel>strong{color:#f8e8d3}.blocked-panel p{color:#d0c5db}.recovery-lock{background:linear-gradient(120deg,#402733,#302334);border-color:#b17486;border-radius:11px}.recovery-lock strong{color:#ffd1da}.recovery-lock p{color:#eec2d0!important}.manual-account summary,.admin-link{color:#bcaecb}#account[data-phase="finished"]{background:radial-gradient(ellipse at 50% 0%,#79a58e25,transparent 75%),#212732;border-color:#6d827a}.finished-icon{border-radius:15px;background:#accdb9;color:#21392f;border-color:#d1e7d9;box-shadow:0 0 0 6px #accdb90c}.finished-title{color:#f7efdf}.finished-actions .view-result{background:#303b3c;border-color:#5b7670;color:#d6e8de}.finished-actions #account-retry{border-color:#64716f;color:#c3d3ce}#account[data-phase="finished"] p{color:#bec9c4}.topic-summary{background:#38302e;border-color:#79664e;color:#eddbc2}
/* Studio: redesigned hierarchy, identity hero and two-column account details. */
:host{--bg:#0b1420;--surface:#132331;--line:#2a414e;--text:#edf7f8;--muted:#98b3bf;--gold:#a8e8dc;--mint:#a8e8dc;font-family:'Segoe UI',Arial,sans-serif}
#panel{width:min(336px,calc(100vw - 24px));background:#0c1722;border:1px solid #385360;border-radius:23px;box-shadow:0 24px 70px #07111c66,0 4px 14px #07111c55;overflow:auto}header{padding:17px 15px;gap:11px;background:radial-gradient(ellipse at 0% 0%,#23595066,transparent 80%),#132431;border-bottom:1px solid #72988920}.brand-mark{display:grid;place-items:center;flex:0 0 36px;height:38px;padding:8px;background:linear-gradient(135deg,#b6ead7,#72bbac);border:1px solid #d1f4e5;border-radius:13px;color:#123d39;box-shadow:0 4px 12px #001b2233}.brand-mark svg,.bubble-symbol svg{width:100%;height:100%;display:block}.brand strong{font-size:15px;font-weight:650;letter-spacing:-.2px;color:#eff9f6}.brand-caption{display:block;margin-top:3px;font-size:9px;font-weight:500;letter-spacing:1.3px;color:#9db9b5}.edition{display:none}#close{flex-basis:27px;height:27px;border-radius:9px;background:#ffffff05;border-color:#ffffff13;color:#b9ccce;font-size:20px}#close:hover{background:#ffffff14}.body{padding:12px}#status{margin:0 0 12px;padding:9px 11px;border:1px solid #29404a;border-radius:10px;background:#13222e;color:#b0c5ce;font-size:10px;line-height:1.6}
#bubble{padding:9px 13px 9px 9px;border-radius:18px;border-color:#75a99988;background:linear-gradient(120deg,#183b3e,#162b39);color:#e7f5f0;box-shadow:0 9px 28px #06182355;gap:10px}#bubble:hover{background:#244447;border-color:#c1e9db}.bubble-symbol{width:29px;height:29px;padding:6px;background:#aee4d3;color:#16433f;border-radius:10px}.bubble-label{display:flex;flex-direction:column;align-items:flex-start;line-height:1.35;font-size:12px;font-weight:650}.bubble-label span{font-size:8px;color:#a6c5c2;letter-spacing:1px;font-weight:400;margin-top:1px}#count{background:#ffffff0b;color:#d9eee6;border:1px solid #ffffff15;border-radius:8px;min-width:23px;height:23px}#bubble.unread #count{background:#b2e1ce;color:#1c3e35}#bubble.unread{border-color:#acdbc8;box-shadow:0 0 0 3px #80c8ad12,0 9px 28px #06182355}
#account{padding:12px;background:#142330;border:1px solid #2d4653;border-radius:16px;box-shadow:inset 0 1px #ffffff04}.category{color:#a2c5c1;font-size:9px;letter-spacing:.8px;font-weight:600}.saved-result{font-size:9px;border:0;background:#234337;color:#bce2cd;padding:3px 7px}.account-context{margin:1px 0 8px}.player-result{margin:9px 0 11px;background:#101d29;border:1px solid #35505a;border-radius:14px;overflow:hidden}.player-banner{padding:8px 12px;background:#203b3b;color:#b4dccc;border-bottom:1px solid #41645b44;font-size:9px;font-weight:600;letter-spacing:.6px}
.player-table{display:block;padding:0 11px 10px;width:100%;font-size:12px}.player-table tbody{display:contents}.player-table{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px}.player-table tr{display:flex;flex-direction:column;min-width:0;padding:8px 9px;background:#1b2a38;border:1px solid #304350;border-radius:9px}.player-table th,.player-table td{display:block;width:auto;padding:0;background:transparent;border:0;overflow-wrap:anywhere}.player-table th{font-size:9px;line-height:1.5;font-weight:400;color:#9fb5bf;margin-bottom:4px}.player-table td{font-size:11px;color:#e3edf0;font-weight:550;line-height:1.55}.player-table tr:has(.userid-value){grid-column:1/-1;padding:15px 1px 12px;border:0;border-radius:0;background:transparent;margin-bottom:1px;border-bottom:1px solid #38515b66}.player-table tr:has(.userid-value) th{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#8dacae;margin-bottom:5px}.player-table .userid-value{font-size:24px;line-height:1.2;font-weight:650;letter-spacing:-.6px;color:#e9f8f3}.player-table tr:has(.number-highlight){grid-column:1/-1;flex-direction:row;justify-content:space-between;align-items:center;gap:10px;background:#172b35;border-color:#34535e}.player-table tr:has(.number-highlight) th{margin:0;max-width:40%}.player-table .number-highlight{font-size:13px;background:transparent;color:#bce5df;letter-spacing:.4px;font-weight:600;text-align:right}.balance-box{margin:0 11px 11px;padding:15px 10px 11px;border-radius:12px;border-width:1px}.balance-box>span:first-child{font-size:9px;letter-spacing:1.6px;font-weight:500}.balance-box strong{font-size:30px;font-weight:650;letter-spacing:-1px;padding:3px 0;line-height:1.4}.balance-box>span:not(:first-child){font-size:9px;font-weight:400;letter-spacing:0}.balance-box[data-tone="low"]{background:radial-gradient(ellipse at 50% 0%,#4f9a7230,transparent 85%),#18362d;border-color:#598e71;color:#c5f0d4;box-shadow:none}.balance-box[data-tone="high"]{background:radial-gradient(ellipse at 50% 0%,#b25d7030,transparent 85%),#3f2530;border-color:#bb6c7c;color:#ffc8ce}.balance-box[data-tone="unknown"]{background:#263440;border-color:#5b7482;color:#d7e3e8}.balance-box small{font-size:9px;opacity:.85}.balance-box button{display:block;width:100%;margin-top:10px;padding:7px;background:#ffffff06;border-color:#ffffff22;color:inherit;font-size:9px}.balance-box button:hover{background:#ffffff14}.player-result .copy-player{background:transparent;border-color:#385563;color:#b8ced6;margin:10px 11px!important;width:calc(100% - 22px)!important;font-size:10px}.player-result .copy-player:hover{background:#233744}#account .account-finish,.finished-actions #account-reopen{background:linear-gradient(110deg,#b0dfc9,#8ec4b7);color:#173d32;border-color:#c4ebd8;border-radius:11px;padding:11px;font-size:12px;box-shadow:0 4px 12px #001b1833}#account .account-finish:hover,.finished-actions #account-reopen:hover{background:#c7efdb}
button{background:#203442;border-color:#3b5563;color:#d9e8ed;border-radius:9px}button:hover{background:#2d4754;border-color:#739e9c}input,select{background:#0f202c;border-color:#3c5563;color:#e5f3f5;border-radius:10px}input::placeholder{color:#95acb7}.card{padding:12px;background:#162735;border:1px solid #324c59;border-left:3px solid #93c9b7;border-radius:13px}.card b{font-size:13px;color:#c9ece0;font-weight:600;letter-spacing:-.1px}.card p{font-size:11px;color:#c6d6df;line-height:1.8}.card[data-tone="review"]{border-left-color:#95b9d4;background:#192b3b}.card[data-tone="review"] b{color:#cee3f5}.card[data-tone="waiting"]{border-left-color:#d3b58b;background:#292d30}.card[data-tone="waiting"] b{color:#ebd4ae}.card[data-tone="conduct"]{background:#312731;border-left-color:#d092a4}.card>.actions button{background:#23493c;border-color:#537969;color:#d1eadb;border-radius:8px;font-size:10px;min-width:84px}.quote{background:#0c1c2866;color:#a9c0ce;border-left-color:#537b89}.aux-details,.aux-details>summary,.manual-account summary{color:#9fb8c4;border-color:#ffffff0c;font-size:10px}.aux-details[open]>summary{color:#c7e7de}.body>details{background:#11232f;border-color:#2e4856;border-radius:11px}.body>details>summary{color:#a9bfcb}.body>.actions button{border-color:#365361!important;color:#afc9d3!important;border-radius:10px}.body>.actions button:hover{background:#203b48!important}.blocked-panel{background:#182a39;border:1px solid #3c5767;border-radius:14px}.blocked-panel>strong{font-size:23px;color:#ebf5f3;letter-spacing:-.4px}.blocked-panel .blocked-information{background:#10202d;border-color:#375565;color:#e6f1f5;line-height:1.8}.blocked-panel p{color:#bdd0dd}.blocked-panel[data-status="Locked"] .blocked-badge{background:#432b35;border-color:#ae6b7e;color:#f5bdcc}.blocked-panel[data-status="Unlocked"] .blocked-badge{background:#203d33;border-color:#5e927a;color:#bee8d0}.recovery-lock{background:#3a2530;border-color:#ac687c;margin:10px 11px;border-radius:11px}.recovery-lock strong{color:#ffced7;font-size:12px}.recovery-lock p{color:#e8bec9!important}.admin-link{color:#a4becb}.lookup-steps>div{background:#12212e;border-color:#2c4350}.topic-summary{background:#2b332f;border-color:#647464;color:#d8e3cc}
#account[data-phase="finished"]{background:radial-gradient(ellipse at 50% 0%,#5c9e7d25,transparent 80%),#172a2d;border-color:#4d7666;padding:24px 13px 16px}.finished-icon{width:52px;height:52px;font-size:26px;border-radius:18px;background:#b5dfc5;color:#234635;border-color:#d4efd8;box-shadow:0 0 0 6px #a8d1b60b;margin-bottom:15px}.finished-title{font-size:20px;color:#edf8f0;letter-spacing:-.4px}#account[data-phase="finished"] p{color:#b9d0c7;font-size:11px}.finished-actions .view-result{background:#254438;border-color:#537867;color:#d4e9db}.finished-actions #account-retry{border-color:#4b6b63;color:#b5cec5}@media(max-width:370px){#panel{width:calc(100vw - 24px)}.player-table .userid-value{font-size:22px}.balance-box strong{font-size:27px}}
/* Glass edition. Opaque default protects readability when blur is unsupported. */
:host{--bg:#182239;--surface:#243149;--line:#ffffff26;--gold:#dedbf8;--mint:#c0e9da;--text:#f5f5fc;--muted:#bec8df}#panel{background:linear-gradient(145deg,#30364b,#19283b 65%,#172b36);border:1px solid #b8c5e65c;border-radius:25px;box-shadow:0 26px 70px #101d354d,0 4px 16px #07102030,inset 0 1px #ffffff35;scrollbar-color:#b5c1dc55 transparent}header{background:linear-gradient(110deg,#ffffff12,#ffffff04);border-bottom:1px solid #ffffff18;padding:16px;gap:11px}.brand-mark{background:linear-gradient(145deg,#f1efff,#b8c8e7);color:#394a70;border:1px solid #ffffffa0;border-radius:13px;box-shadow:0 4px 14px #17243c33,inset 0 1px #fff}.brand strong{color:#faf8ff;font-size:15px}.brand-caption{color:#c3c7dc;letter-spacing:1.5px;font-size:8px}#close{background:#ffffff08;border:1px solid #ffffff25;color:#e1e5f2;border-radius:50%;height:28px;flex-basis:28px}#close:hover{background:#ffffff20}.body{padding:13px}#status{background:#ffffff06;border:1px solid #ffffff13;color:#c1cbe0;border-radius:11px;font-size:10px;padding:9px 11px}#bubble{background:linear-gradient(125deg,#3d4562,#243c4b);border:1px solid #c7d4ef70;border-radius:22px;padding:10px;box-shadow:0 10px 35px #10243d55,inset 0 1px #ffffff40;color:#f2f5ff}.bubble-symbol{background:linear-gradient(135deg,#e9e5ff,#b7d9e6);color:#3f4f72;border:1px solid #ffffffe0;border-radius:11px}.bubble-label{font-size:12px;letter-spacing:.15px}.bubble-label span{color:#c0cbde;font-size:8px}#count{background:#ffffff14;border:1px solid #ffffff30;color:#eef2ff;border-radius:9px}#bubble:hover{background:#435572;border-color:#d3ddf1}#bubble.unread{border-color:#d2d8f4;box-shadow:0 0 0 3px #d2d8f416,0 10px 35px #10243d55}#bubble.unread #count{background:#d7d5ee;color:#383f5b}
#account{background:linear-gradient(140deg,#ffffff0d,#ffffff04);border:1px solid #d0d9ec2e;border-radius:18px;padding:12px;box-shadow:inset 0 1px #ffffff13}.category{color:#d0cae6;font-weight:600;font-size:9px;letter-spacing:.85px}.saved-result{background:#a4d2b921;border:1px solid #b4e1c32d;color:#d3efdc;border-radius:7px;padding:3px 7px}.player-result{background:#18273be6;border:1px solid #c8d7ed33;border-radius:15px;box-shadow:0 5px 15px #0c1c3022}.player-banner{background:linear-gradient(110deg,#c1b4e320,#a5d9d91c);border-color:#ffffff13;color:#d9e5ee;padding:9px 12px;font-size:9px;letter-spacing:.65px}.player-table tr{background:#ffffff06;border-color:#ffffff13;border-radius:10px}.player-table th{color:#b6c1d7;font-size:9px}.player-table td{color:#f0f3fd}.player-table tr:has(.userid-value){background:none;border-bottom-color:#ffffff18;padding-top:17px;padding-bottom:15px}.player-table tr:has(.userid-value) th{color:#acbcd8;font-size:8px;letter-spacing:1.8px}.player-table .userid-value{font-size:25px;color:#f2efff;letter-spacing:-.7px}.player-table tr:has(.number-highlight){background:#c4d9f50a;border-color:#c4d9f522}.player-table .number-highlight{color:#d3e2f4;background:transparent}.balance-box[data-tone="low"]{background:linear-gradient(120deg,#2f5148,#203c40);border-color:#a2c6b87a;color:#d9f5e5;box-shadow:inset 0 1px #ffffff12}.balance-box[data-tone="high"]{background:linear-gradient(120deg,#613849,#412c40);border-color:#e3a1b280;color:#ffd9e1;box-shadow:inset 0 1px #ffffff12}.balance-box[data-tone="unknown"]{background:#344058;border-color:#b9c8e16e;color:#e2e8f5}.balance-box{border-radius:14px;padding:15px 10px 12px}.balance-box strong{font-size:30px;line-height:1.45;font-weight:650}.balance-box button{border:1px solid #ffffff26;background:#ffffff08;border-radius:9px;color:inherit}.balance-box button:hover{background:#ffffff18}.player-result .copy-player{background:#ffffff05;border-color:#ffffff22;color:#d6e0f5;border-radius:10px}.player-result .copy-player:hover{background:#ffffff12}#account .account-finish,.finished-actions #account-reopen{background:linear-gradient(110deg,#e1dbf2,#c4d8e9);border:1px solid #fff8;color:#353f5b;border-radius:12px;box-shadow:0 4px 14px #121e3330,inset 0 1px #ffffff9e;padding:11px;font-weight:650}#account .account-finish:hover,.finished-actions #account-reopen:hover{background:linear-gradient(110deg,#efeaff,#dceafa)}
button{background:#ffffff0c;border-color:#ffffff26;color:#e5ebfa;border-radius:10px}button:hover{background:#ffffff1b;border-color:#d0d8ee70}input,select{background:#17263de6;border-color:#a4b4d24d;border-radius:11px;color:#eef3fc}input::placeholder{color:#b3bdd0}.card{background:linear-gradient(130deg,#ffffff0f,#ffffff04);border:1px solid #c2d2eb33;border-left:3px solid #b9d6cf;border-radius:16px;box-shadow:inset 0 1px #ffffff0b;padding:13px}.card b{color:#e4f2ed;font-size:13px}.card p{color:#d4deef;line-height:1.8;font-size:11px}.card[data-tone="review"]{background:linear-gradient(130deg,#c5c0f119,#b8d4ed09);border-left-color:#cac0ed}.card[data-tone="review"] b{color:#e9dffb}.card[data-tone="waiting"]{background:linear-gradient(130deg,#eed1a41a,#d0bb9e06);border-left-color:#decaac}.card[data-tone="waiting"] b{color:#f3e4cf}.card[data-tone="conduct"]{background:linear-gradient(130deg,#ca94af23,#ac91be0d);border-left-color:#ddb7cd}.card>.actions button{background:#d6e5e0e8;border:1px solid #ffffff50;color:#344942;box-shadow:0 3px 8px #12223522;border-radius:9px}.quote{color:#c5d0e6;background:#111f353d;border-left-color:#c7d2ec66}.aux-details,.aux-details>summary,.manual-account summary{color:#bfc9dd;border-color:#ffffff16}.aux-details[open]>summary{color:#f0e7ff}.body>details{background:#ffffff05;border-color:#ffffff20;border-radius:13px}.body>details>summary{color:#c8d1e3}.body>.actions button{background:#ffffff04!important;border-color:#c3d0e633!important;color:#d5deef!important;border-radius:12px}.body>.actions button:hover{background:#ffffff14!important}.blocked-panel{background:linear-gradient(130deg,#ffffff0e,#ffffff05);border-color:#c8d5ed3d;border-radius:16px}.blocked-panel>strong{color:#f2f0fb;font-size:23px}.blocked-panel .blocked-information{background:#16263ad9;border-color:#b7c9e735;color:#edf2ff;border-radius:12px}.blocked-panel p{color:#d5dff0}.blocked-panel[data-status="Locked"] .blocked-badge{background:#5a3549;border-color:#d39aad66;color:#f9d6e0}.blocked-panel[data-status="Unlocked"] .blocked-badge{background:#314d45;border-color:#a2c7b366;color:#d3f0df}.blocked-panel[data-status="Lupa password"] .blocked-badge{background:#51483b;border-color:#d9c19b77;color:#f0dfbe}.recovery-lock{background:linear-gradient(120deg,#563144,#3d2b40);border-color:#d29aae70;border-radius:13px}.recovery-lock strong{color:#ffdae5}.recovery-lock p{color:#f3cddc!important}.admin-link{color:#bfcee6}.lookup-steps>div{background:#17253c88;border-color:#ffffff17}.topic-summary{background:#e4d5ac14;border-color:#e5d1ad44;color:#ece3d4}.not-registered{background:#4c3d37;border-color:#d7b49780;color:#ffe1c8}#account[data-phase="finished"]{background:radial-gradient(ellipse at 50% 0%,#c9ded025,transparent 85%),#253c3ee6;border-color:#afcdb964;border-radius:18px}.finished-icon{background:linear-gradient(130deg,#e1eee1,#b7d4c4);border-color:#f2fff0;color:#365748;box-shadow:0 0 0 7px #d0e4d40a,0 6px 18px #102c2422;border-radius:18px}.finished-title{color:#f1f6f1}.finished-actions .view-result{background:#ffffff09;border-color:#ffffff30;color:#d4e8de}.finished-actions #account-retry{border-color:#d6ead140;color:#d4e2da}#account[data-phase="finished"] p{color:#cadbd3}
@supports ((backdrop-filter:blur(20px)) or (-webkit-backdrop-filter:blur(20px))){#panel{background:linear-gradient(145deg,rgba(39,45,66,.90),rgba(22,40,58,.88) 65%,rgba(23,44,51,.90));backdrop-filter:blur(24px) saturate(120%);-webkit-backdrop-filter:blur(24px) saturate(120%)}#bubble{background:linear-gradient(125deg,rgba(55,65,94,.90),rgba(32,57,72,.88));backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}}@media(prefers-reduced-transparency:reduce){#panel{background:#202e42;backdrop-filter:none;-webkit-backdrop-filter:none}#bubble{background:#304159;backdrop-filter:none;-webkit-backdrop-filter:none}}
/* Rose graphite: warm glass, quiet surfaces and restrained metallic accents. */
:host{--bg:#211c20;--surface:#30282b;--line:#9f7b714d;--text:#faf2ec;--muted:#c5b4af;--gold:#e8beb0;--mint:#c5dfca}#panel{background:linear-gradient(145deg,#3b2e32,#262126 65%,#252329);border:1px solid #b291815e;box-shadow:0 24px 65px #1e111a55,inset 0 1px #ffe8db30;border-radius:24px;scrollbar-color:#b5978955 transparent}header{background:linear-gradient(110deg,#e2a68c14,#ffffff03);border-bottom-color:#d9b3a422}.brand-mark{background:linear-gradient(140deg,#f9ddcc,#cf9f8d);border-color:#ffe9db;color:#593c38;box-shadow:0 4px 14px #28141938,inset 0 1px #fff7ef}.brand strong{color:#fff3e9;letter-spacing:.1px}.brand-caption{color:#c5a99b}#close{color:#dec8bc;border-color:#dabba128;background:#ffffff05}#close:hover{background:#e4b8a41c}.body{padding:13px}#status{background:#201c2466;border:1px solid #cfaa9726;color:#cdbcb3}#bubble{background:linear-gradient(125deg,#4a353b,#302b33);border-color:#cea89580;color:#f8e7da;box-shadow:0 10px 32px #30151e4d,inset 0 1px #ffdccb36}.bubble-symbol{background:linear-gradient(135deg,#f6d7c5,#d2a38e);border-color:#ffe9dacc;color:#653f37}.bubble-label span{color:#d5b4a5}#count{background:#f0c7ae15;border-color:#f0c7ae30;color:#f4deca}#bubble:hover{background:#564047;border-color:#ecc1a8}#bubble.unread{border-color:#e9b69e;box-shadow:0 0 0 3px #edbb9b15,0 10px 32px #30151e4d}#bubble.unread #count{background:#efc5ad;color:#583e35}
#account{background:linear-gradient(145deg,#f0bda50c,#ffffff03);border-color:#b68d7c45;box-shadow:inset 0 1px #ffe4d615}.category{color:#dfb7a2;letter-spacing:.75px}.saved-result{background:#b6c9b518;color:#dcebd7;border-color:#becfb426}.player-result{background:#241f28ed;border-color:#b1907b4d;box-shadow:0 5px 15px #160d1824}.player-banner{background:linear-gradient(110deg,#bc8c7429,#d0ae940b);border-color:#f4c9b01c;color:#e9c5af;letter-spacing:.8px}.player-table tr{background:#ffe4ce05;border-color:#e3bfa318}.player-table th{color:#bfa9a1}.player-table td{color:#f0e5df}.player-table tr:has(.userid-value){border-bottom-color:#cfa99625}.player-table tr:has(.userid-value) th{color:#c2a68f}.player-table .userid-value{color:#f7d9c2;font-size:25px;font-weight:600}.player-table tr:has(.number-highlight){background:#d6b49d0b;border-color:#caab8f2e}.player-table .number-highlight{color:#f1cfb8}.player-result .copy-player{background:#d9aa9207;border-color:#c4a28f38;color:#e4cbbb}.player-result .copy-player:hover{background:#d9aa9216}.balance-box[data-tone="low"]{background:linear-gradient(115deg,#354a3d,#293a36);border-color:#94b39477;color:#ddf0d8}.balance-box[data-tone="high"]{background:linear-gradient(115deg,#63393e,#412932);border-color:#d99a9b80;color:#ffdbda}.balance-box[data-tone="unknown"]{background:#3c353d;border-color:#b5a1aa70;color:#eadfe4}.balance-box button{background:#ffffff05;border-color:#ffffff25;color:inherit}#account .account-finish,.finished-actions #account-reopen{background:linear-gradient(110deg,#efcdb4,#d4ab94);border:1px solid #ffe1cd9c;color:#513b32;box-shadow:0 4px 12px #26121c30,inset 0 1px #fff1df80;font-weight:650}#account .account-finish:hover,.finished-actions #account-reopen:hover{background:linear-gradient(110deg,#ffe3cb,#ecc5a9)}
button{background:#d9bba50b;border-color:#b2928045;color:#e8d4c8}button:hover{background:#deb49a1b;border-color:#c6a28b80}input,select{background:#221f29eb;border-color:#b4968550;color:#f4e9e1}input::placeholder{color:#baa79d}.card{background:linear-gradient(130deg,#f5c3a70c,#ffffff03);border-color:#b8948140;border-left-color:#afc4a9;box-shadow:inset 0 1px #ffe4d50a}.card b{color:#e2eddb}.card p{color:#e1d1c8}.card[data-tone="review"]{background:linear-gradient(130deg,#e0b7b40f,#bba6b508);border-left-color:#ccb1c0}.card[data-tone="review"] b{color:#f0d5e1}.card[data-tone="waiting"]{background:linear-gradient(130deg,#e7bc8c16,#d8b89405);border-left-color:#dcba8e}.card[data-tone="waiting"] b{color:#f5dbb9}.card[data-tone="conduct"]{background:linear-gradient(130deg,#ca8c9b1c,#b18f9b09);border-left-color:#d4a1ae}.card>.actions button{background:#d9dfcfe8;border-color:#f2efda60;color:#3f4c3b}.quote{background:#201c294d;color:#cdb9b0;border-left-color:#bc9a8666}.aux-details,.aux-details>summary,.manual-account summary{color:#c4aea1;border-color:#eacdb21a}.aux-details[open]>summary{color:#f5d5bf}.body>details{background:#211d270f;border-color:#b5977f30}.body>details>summary{color:#d6beb0}.body>.actions button{background:#e1bca104!important;border-color:#bd9b8238!important;color:#dfc7b7!important}.body>.actions button:hover{background:#deb69a14!important}.blocked-panel{background:linear-gradient(130deg,#d7afa00e,#ffffff03);border-color:#bc9b8545}.blocked-panel>strong{color:#f7dbca}.blocked-panel .blocked-information{background:#241e2ad9;border-color:#baa18b38;color:#f6e9e2}.blocked-panel p{color:#dfccc2}.blocked-panel[data-status="Locked"] .blocked-badge{background:#56333e;border-color:#d2a0a266;color:#f8d7da}.blocked-panel[data-status="Unlocked"] .blocked-badge{background:#35483b;border-color:#a9b89a66;color:#e4edda}.blocked-panel[data-status="Lupa password"] .blocked-badge{background:#514033;border-color:#d8ba9577;color:#f6e0c1}.recovery-lock{background:linear-gradient(120deg,#56343e,#402a37);border-color:#cc969f70}.recovery-lock strong{color:#ffdcdf}.recovery-lock p{color:#efd1d3!important}.admin-link{color:#d7bca9}.lookup-steps>div{background:#261f2c77;border-color:#deb79b20}.topic-summary{background:#e3c2a211;border-color:#d6b28b44;color:#ebd8bd}.not-registered{background:#49382f;border-color:#d9b08d80;color:#ffe5ce}#account[data-phase="finished"]{background:radial-gradient(ellipse at 50% 0%,#c8ceb522,transparent 85%),#303832e8;border-color:#b8c0a564}.finished-icon{background:linear-gradient(130deg,#e6ead7,#bfccb3);border-color:#f0f2de;color:#465741;box-shadow:0 0 0 7px #d9dfc30a,0 6px 18px #242c1c22}.finished-title{color:#f6f2e4}.finished-actions .view-result{background:#ffffff07;border-color:#d4d2b530;color:#e4e8d5}.finished-actions #account-retry{border-color:#d8d9b940;color:#dbdfca}#account[data-phase="finished"] p{color:#d1d6c4}
@supports ((backdrop-filter:blur(20px)) or (-webkit-backdrop-filter:blur(20px))){#panel{background:linear-gradient(145deg,rgba(53,40,45,.93),rgba(35,31,39,.91) 65%,rgba(36,34,40,.93));backdrop-filter:blur(25px) saturate(105%);-webkit-backdrop-filter:blur(25px) saturate(105%)}#bubble{background:linear-gradient(125deg,rgba(69,48,55,.94),rgba(42,38,47,.92));backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}}@media(prefers-reduced-transparency:reduce){#panel{background:#30272e;backdrop-filter:none;-webkit-backdrop-filter:none}#bubble{background:#46353d;backdrop-filter:none;-webkit-backdrop-filter:none}}
/* Admin reference palette: turquoise, gray, white, yellow and black. */
.player-result{background:#fff;color:#111;border:1px solid #22a1b9;border-radius:10px;box-shadow:none}.player-banner{background:#209fb6;color:#fff;border-bottom:1px solid #178da4;font-size:10px;font-weight:700;padding:10px 11px;letter-spacing:.35px}.player-table{display:table;width:100%;padding:0;border-collapse:collapse;table-layout:fixed;background:#fff;color:#111}.player-table tbody{display:table-row-group}.player-table tr,.player-table tr:has(.userid-value),.player-table tr:has(.number-highlight){display:table-row;background:#fff;border:0;border-radius:0;margin:0;padding:0}.player-table th,.player-table tr:has(.userid-value) th,.player-table tr:has(.number-highlight) th{display:table-cell;width:40%;max-width:none;background:#dedede;color:#111;font-size:10px;font-weight:600;line-height:1.55;letter-spacing:0;text-transform:none;padding:9px 8px;border-bottom:1px solid #32abc3;border-right:1px solid #32abc3;margin:0;vertical-align:middle}.player-table td{display:table-cell;background:#fff;color:#111;font-size:12px;font-weight:500;padding:9px 8px;line-height:1.55;border-bottom:1px solid #32abc3;vertical-align:middle;overflow-wrap:anywhere}.player-table .userid-value{font-size:17px;font-weight:700;letter-spacing:0;color:#111;line-height:1.4;background:#fff}.player-table .number-highlight{background:#ffff00;color:#000;font-size:13px;font-weight:700;text-align:left;letter-spacing:.2px}.player-result .referral-detail{color:#333;border-top-color:#ddd;margin:9px 10px}.player-result .referral-detail>summary{color:#333}.player-result .referral-detail[open]>summary{color:#06758b}.player-result small{color:#44545b}.player-result .referral-detail p{color:#33434c!important}.player-result .balance-box{background:#f5f7f8;color:#26333a;border:1px solid #80939b;border-radius:8px;box-shadow:none;margin:11px 10px;padding:0 10px 11px;overflow:hidden}.player-result .balance-box>span:first-child{display:block;background:#ffff00;color:#111;margin:0 -10px 8px;padding:8px 10px;letter-spacing:.8px;font-size:10px;font-weight:700;border-bottom:1px solid #dedc62}.player-result .balance-box strong{font-size:29px;font-weight:750;letter-spacing:-.4px;padding:0;line-height:1.5}.player-result .balance-box[data-tone="high"]{background:#fff1f2;border-color:#ce3449;color:#a71930}.player-result .balance-box[data-tone="low"]{background:#effaf2;border-color:#358456;color:#14623b}.player-result .balance-box[data-tone="unknown"]{background:#f3f5f6;border-color:#8e9ba0;color:#35454e}.player-result .balance-box small{color:inherit;opacity:1}.player-result .balance-box button{background:#fff;border-color:currentColor;color:inherit;box-shadow:none}.player-result .balance-box button:hover{background:#ffffffb3}.player-result .copy-player{background:#209fb6;border:1px solid #158ca3;color:#fff;font-weight:600;border-radius:7px;padding:9px}.player-result .copy-player:hover{background:#16869d;border-color:#147a90}.player-result .recovery-lock{background:#fff0f2;border-color:#bc5265;color:#7d1932;border-radius:8px}.player-result .recovery-lock strong{color:#851f39}.player-result .recovery-lock p{color:#7d1932!important}
/* Whole assistant follows the supplied admin palette. */
:host{--bg:#fff;--surface:#f4f4f4;--line:#22a1b9;--text:#111;--muted:#48565c;--gold:#08778d;--mint:#08778d;color:#111;color-scheme:light}#panel{background:#fff;border:1px solid #209fb6;box-shadow:0 16px 45px #14374333;border-radius:15px;backdrop-filter:none;-webkit-backdrop-filter:none;scrollbar-color:#209fb6 #eee}header{background:#209fb6;border-bottom:1px solid #13869b;padding:14px;color:#fff}.brand-mark{background:#fff;color:#13869b;border-color:#fff;box-shadow:none;border-radius:9px}.brand strong{color:#fff}.brand-caption{color:#e9faff}#close{background:#ffffff19;border-color:#ffffff70;color:#fff;border-radius:7px}#close:hover{background:#ffffff30}.body{background:#fff;padding:12px}#status{background:#f2f2f2;border-color:#d2d2d2;color:#39474d;border-radius:7px}#bubble{background:#209fb6;border:1px solid #13869b;color:#fff;box-shadow:0 6px 20px #164c5633;border-radius:13px;backdrop-filter:none;-webkit-backdrop-filter:none}.bubble-symbol{background:#fff;color:#13869b;border-color:#fff;border-radius:8px}.bubble-label span{color:#e6faff}#count{background:#fff;color:#0b7288;border:1px solid #fff;border-radius:6px}#bubble:hover{background:#168ca3;border-color:#0a7287}#bubble.unread{border-color:#08748a;box-shadow:0 0 0 3px #209fb625,0 6px 20px #164c5633}#bubble.unread #count{background:#ffff00;color:#111;border-color:#ffff00}
#account{background:#f5f5f5;border-color:#22a1b9;border-radius:10px;box-shadow:none}.category{color:#08758b;font-weight:700}.account-number{color:#111}.saved-result{background:#eaf7ed;color:#215d36;border:1px solid #94bc9f}#account p{color:#303c42}.lookup-steps>div{background:#fff;border-color:#a1cbd4}.lookup-steps b{color:#146b7e}.lookup-steps span{color:#222}.lookup-steps>div[data-state="found"]{background:#ecf8ee;border-color:#89b99b}.lookup-steps>div[data-state="found"] span{color:#17613a}.lookup-steps>div[data-state="empty"] span{color:#78500b}.lookup-steps>div[data-state="error"] span{color:#aa1931}.lookup-steps>div[data-state="loading"] span{color:#05697d}.aux-details,.aux-details>summary,.manual-account summary{color:#37484e;border-color:#c7d9df}.aux-details[open]>summary{color:#08758b}.saved-result small,small{color:#485a61}#account .account-finish{background:#209fb6;border-color:#13869b;color:#fff;box-shadow:none;border-radius:8px}#account .account-finish:hover{background:#16869c}.admin-link{color:#076d83}.admin-link:hover{color:#03495b}button{background:#209fb6;color:#fff;border:1px solid #12859c;border-radius:7px;box-shadow:none}button:hover{background:#16869c;border-color:#0b6b80}button:focus-visible,summary:focus-visible,a:focus-visible{outline-color:#086d83}input,select{background:#fff;border-color:#98aeb5;color:#111;border-radius:7px}input:focus,select:focus{outline-color:#209fb633;border-color:#168ba2}input::placeholder{color:#64757d}label{color:#273b44}.body>.actions button{background:#209fb6!important;color:#fff!important;border-color:#13869b!important;border-radius:7px}.body>.actions button:hover{background:#16869c!important}.body>details{background:#f1f1f1;border-color:#c5ced1;border-radius:8px;color:#37484e}.body>details>summary,.body>details[open]>summary{color:#146b7e}
.card{background:#fff;border:1px solid #b6ccd2;border-left:3px solid #209fb6;border-radius:8px;box-shadow:none}.card b{color:#134c5a;font-weight:700}.card p{color:#263b43}.card[data-tone="review"]{background:#f3fafc;border-left-color:#209fb6}.card[data-tone="review"] b{color:#105a6c}.card[data-tone="waiting"]{background:#fffbe9;border-left-color:#b99a16}.card[data-tone="waiting"] b{color:#735900}.card[data-tone="conduct"]{background:#fff2f2;border-left-color:#be4c61}.card[data-tone="conduct"] b,.card[data-tone="conduct"] .category{color:#9c2740}.card>.actions button{background:#209fb6;border-color:#13869b;color:#fff;box-shadow:none}.quote{background:#eee;color:#334a53;border-left-color:#209fb6}.topic-summary{background:#ffffbf;border-color:#bdbd54;color:#333}.blocked-panel{background:#fff;border-color:#209fb6;border-radius:10px}.blocked-panel>strong{color:#111}.blocked-panel>b{color:#13697c}.blocked-panel p{color:#33464f}.blocked-badge{background:#dedede;border-color:#a7b8be;color:#111}.blocked-panel .blocked-information{background:#f3f3f3;border-color:#a7c1c9;color:#111;border-radius:7px}.blocked-panel[data-status="Locked"] .blocked-badge{background:#ffe7ec;border-color:#bc5b72;color:#8f1c36}.blocked-panel[data-status="Unlocked"] .blocked-badge{background:#e7f7e9;border-color:#609d73;color:#1b5e32}.blocked-panel[data-status="Lupa password"] .blocked-badge{background:#fff9cc;border-color:#b3a35c;color:#705514}.not-registered{background:#fffbe0;border-color:#aaa048;border-radius:8px}.not-registered strong{color:#5e510a}.not-registered span{color:#655d36}#account[data-phase="finished"]{background:#f1faf4;border-color:#6c9f80;border-radius:11px}.finished-icon{background:#dcf0e2;border-color:#72a884;color:#25643a;box-shadow:none}.finished-title{color:#204d32}#account[data-phase="finished"] p{color:#385a44}.finished-actions .view-result,.finished-actions #account-reopen{background:#209fb6;border-color:#13869b;color:#fff;box-shadow:none}.finished-actions .view-result:hover,.finished-actions #account-reopen:hover{background:#16869c}.finished-actions #account-retry{background:#fff;border-color:#6ba5b2;color:#166477}.finished-foot{color:#416651}.intent-correction select{background:#fff;border-color:#98aeb5;color:#111}
/* Outer shell only. Account results and admin status components are unchanged. */
#panel{background:#eaf0f4;border:1px solid #809caf;border-radius:21px;box-shadow:0 20px 55px #15364b38,inset 0 1px #fff}header{background:linear-gradient(120deg,#183748,#215c6a);border-bottom:1px solid #93c2c233;padding:16px;color:#fff}.brand-mark{background:linear-gradient(140deg,#e9f7ef,#b4d8cb);border-color:#f0fff5;color:#27594f;border-radius:12px;box-shadow:0 3px 10px #102f3c30}.brand strong{color:#f4faf7;letter-spacing:.15px}.brand-caption{color:#b8d5d3;letter-spacing:1.4px}#close{background:#ffffff09;border-color:#c8e1df44;color:#e2eeeb;border-radius:9px}#close:hover{background:#ffffff1b}.body{background:linear-gradient(145deg,#f5f7f9,#e9eff3);padding:13px}#status{background:#fff9;border-color:#c6d5df;color:#526b7a;border-radius:10px;box-shadow:0 1px 2px #15374b08}#bubble{background:linear-gradient(120deg,#1c3c50,#286774);border:1px solid #7faeb2;color:#f1f8f7;border-radius:20px;box-shadow:0 8px 25px #16384c38,inset 0 1px #ffffff20;padding:10px}.bubble-symbol{background:linear-gradient(135deg,#eaf8ee,#b8dbcd);color:#2b5e54;border-color:#effff5;border-radius:10px}.bubble-label span{color:#bbd9d7}#count{background:#ffffff15;border-color:#ffffff30;color:#edf7f4;border-radius:8px}#bubble:hover{background:linear-gradient(120deg,#244d60,#307887);border-color:#acd4d1}#bubble.unread{border-color:#afd5c4;box-shadow:0 0 0 3px #afdbc526,0 8px 25px #16384c38}#bubble.unread #count{background:#d9ebdc;border-color:#d9ebdc;color:#285348}
.body>.actions button{background:linear-gradient(100deg,#25485c,#316b79)!important;color:#f3f8f9!important;border-color:#315f73!important;border-radius:10px;box-shadow:0 2px 5px #17354b15}.body>.actions button:hover{background:#397889!important;border-color:#37778a!important}.body>details{background:#f7fafc;border-color:#c3d3df;border-radius:12px;color:#496273;box-shadow:0 1px 2px #17364c08}.body>details>summary,.body>details[open]>summary{color:#315a6c;font-weight:600}.body>details button{background:#e5edf2;border-color:#b4c8d5;color:#31586c;border-radius:8px}.body>details button:hover{background:#d6e6ee;border-color:#8eafc1}.body>details input{background:#fff;border-color:#b4c7d4;color:#223e4f;border-radius:9px}.body>details input:focus{border-color:#377d8d;outline-color:#377d8d28}.body>details label,.body>details small{color:#536e7e}
/* Crimson/black outer shell. Admin result components retain their existing colors. */
#panel{background:#151114;border:1px solid #81404a;border-radius:21px;box-shadow:0 22px 60px #18080c66,inset 0 1px #ffffff0b}header{background:linear-gradient(115deg,#741f30,#39151e 65%,#1e151b);border-bottom:1px solid #cf657c40;color:#fff;padding:16px}.brand-mark{background:linear-gradient(140deg,#ffd9df,#dc8392);border:1px solid #ffe4e9;color:#6a1e30;border-radius:12px;box-shadow:0 3px 12px #19070c44}.brand strong{color:#fff0f3}.brand-caption{color:#e2acb8}#close{background:#ffffff06;border-color:#e5a1b139;color:#f0ccd5}#close:hover{background:#b14a6033}.body{background:linear-gradient(145deg,#22171d,#131216 70%);padding:13px}#status{background:#2a1c23;border:1px solid #68404d;color:#dfc1cc;border-radius:10px;box-shadow:none}#bubble{background:linear-gradient(120deg,#821f34,#461a29 60%,#20151d);border:1px solid #bc687b;color:#fff1f5;border-radius:20px;box-shadow:0 9px 30px #2a091746,inset 0 1px #ffffff13}.bubble-symbol{background:linear-gradient(135deg,#ffd9e2,#dd8fa0);border-color:#ffe9ee;color:#741f36;border-radius:10px}.bubble-label span{color:#e6afbd}#count{background:#ffffff0e;border-color:#f2bbca40;color:#ffe5ed}#bubble:hover{background:linear-gradient(120deg,#a12a45,#5c2235 70%,#291923);border-color:#e498ab}#bubble.unread{border-color:#f1a3b6;box-shadow:0 0 0 3px #d95c7c22,0 9px 30px #2a091746}#bubble.unread #count{background:#ffd7e2;border-color:#ffd7e2;color:#6c1731}
.body>.actions button{background:linear-gradient(100deg,#84253b,#a73851)!important;border-color:#be6579!important;color:#fff0f4!important;border-radius:10px;box-shadow:0 3px 8px #16050a33}.body>.actions button:hover{background:#b54560!important;border-color:#e39aae!important}.body>details{background:#21191f;border-color:#65414f;color:#d5b8c3;border-radius:12px;box-shadow:inset 0 1px #ffffff04}.body>details>summary,.body>details[open]>summary{color:#f0becd;font-weight:600}.body>details p,.body>details label,.body>details small{color:#d2b7c2}.body>details button{background:#38212d;border-color:#754452;color:#f0cbd7;border-radius:8px}.body>details button:hover{background:#572b3e;border-color:#b16b81}.body>details input{background:#16131a;border-color:#714554;color:#faeaf0;border-radius:9px}.body>details input::placeholder{color:#b999a6}.body>details input:focus{border-color:#d77994;outline-color:#d779942d}

:host([data-sidebar-open]) #panel{width:100%!important;max-width:100%!important;min-width:0!important;height:100%!important;max-height:100%!important;box-sizing:border-box!important;margin:0!important;display:flex;flex-direction:column;overflow:hidden;border-radius:14px}
:host([data-sidebar-open]) #panel>header{flex:0 0 auto;cursor:default}
:host([data-sidebar-open]) #panel>.body{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;overflow-wrap:anywhere}
:host([data-sidebar-open]) #bubble{display:none!important}
:host([data-sidebar-open]) input,:host([data-sidebar-open]) select{min-width:0;max-width:100%;box-sizing:border-box}

/* Status sumber admin: NOW hijau terang, OLD merah. Berlaku hanya saat ditemukan. */
#account .player-result[data-source="NOW"]{border-color:#10b948}
#account .player-result[data-source="OLD"]{border-color:#eb3747}
#account .player-result .player-banner[data-source="NOW"]{
  background:linear-gradient(100deg,#08af3e 0%,#22d653 55%,#41e575 100%);
  color:#fff;border-bottom:1px solid #069332;text-shadow:0 1px 1px #08652b55;
}
#account .player-result .player-banner[data-source="OLD"]{
  background:linear-gradient(100deg,#c81f32 0%,#e93847 55%,#fb5861 100%);
  color:#fff;border-bottom:1px solid #af1f30;text-shadow:0 1px 1px #7a142655;
}
#account .lookup-steps>div[data-source="NOW"][data-state="found"]{
  background:#e8fff0;border-color:#39bd68;
}
#account .lookup-steps>div[data-source="NOW"][data-state="found"] b,
#account .lookup-steps>div[data-source="NOW"][data-state="found"] span{color:#087c31}
#account .lookup-steps>div[data-source="OLD"][data-state="found"]{
  background:#fff0f0;border-color:#ec6871;
}
#account .lookup-steps>div[data-source="OLD"][data-state="found"] b,
#account .lookup-steps>div[data-source="OLD"][data-state="found"] span{color:#bd2033}

/* ===============================================================
   v2.73.26 - OBSIDIAN ROYALE | BUBBLE PREMIUM
   Hanya visual bubble dan header; tabel admin & proses tetap utuh.
   =============================================================== */
#bubble{
  position:relative;isolation:isolate;overflow:visible;
  display:flex;align-items:center;gap:9px;
  min-height:56px;max-width:min(92vw,220px);
  padding:8px 12px 8px 8px;
  border-radius:19px;
  border:1px solid #e6a0b08f;
  background:linear-gradient(118deg,#6b253a 0%,#422033 45%,#221824 100%);
  color:#fff6f8;
  box-shadow:0 12px 28px #16071176,0 2px 7px #120b16a8,inset 0 1px #ffffff35;
  text-shadow:none;
  transform:translateZ(0);
  transition:transform .18s ease,box-shadow .18s ease,background .18s ease,border-color .18s ease;
}
#bubble::before{
  content:'';position:absolute;inset:1px;border-radius:18px;
  border-top:1px solid #ffe6ee4d;
  background:radial-gradient(ellipse at 6% 8%,#fff3f11f,transparent 60%);
  pointer-events:none;z-index:-1;
}
#bubble::after{
  content:'';position:absolute;top:6px;right:7px;
  width:6px;height:6px;border-radius:50%;background:#dfb7a1;
  border:1px solid #30202e;box-shadow:0 0 6px #dfb7a166;
  pointer-events:none;
}
#bubble .bubble-symbol{
  display:grid;place-items:center;flex:0 0 37px;
  width:37px;height:37px;padding:8px;
  border:1px solid #ffe8e7a8;border-radius:13px;
  background:linear-gradient(145deg,#ffe6dd,#f3b6be 72%,#d990a0);
  color:#67283f;
  box-shadow:0 4px 11px #09051055,inset 0 1px #ffffffb3;
}
#bubble .bubble-symbol svg{display:block;width:21px;height:21px;stroke:currentColor}
#bubble .bubble-label{
  display:flex;flex-direction:column;align-items:flex-start;
  min-width:0;line-height:1.18;
  font-size:12px;font-weight:780;letter-spacing:.12px;color:#fff4f3;
}
#bubble .bubble-label span{margin-top:4px;color:#e7aebb;font-size:7.5px;font-weight:650;letter-spacing:1.4px}
#bubble #count{
  flex:0 0 auto;display:grid;place-items:center;
  min-width:23px;height:23px;padding:0 6px;
  border:1px solid #fbd4dc4f;border-radius:9px;
  background:#ffffff17;color:#ffe9ed;font-size:10px;font-weight:850;
  box-shadow:inset 0 1px #ffffff1c;
}
#bubble:hover{
  transform:translateY(-2px);
  border-color:#ffd1dd;
  background:linear-gradient(120deg,#833149,#51253d 55%,#29202f);
  box-shadow:0 16px 34px #1607118c,0 2px 8px #120b16a8,inset 0 1px #ffffff4d;
}
#bubble:active{transform:translateY(0) scale(.985)}
#bubble:focus-visible{outline:2px solid #ffe0b5;outline-offset:3px}
#bubble.unread{
  border-color:#ffd2b0;
  box-shadow:0 0 0 3px #f9bc9e24,0 11px 30px #16071183,inset 0 1px #ffffff40;
}
#bubble.unread #count{background:#ffe1c2;color:#552639;border-color:#fff2d8}
#bubble.unread::after{background:#ffd783;box-shadow:0 0 0 3px #ffd7832b,0 0 11px #ffd783}
#bubble[data-identity="match"]{
  border-color:#5ceba8;
  box-shadow:0 0 0 2px #70ffb575,0 0 24px 5px #2fe49e43,0 12px 29px #120b1680;
}
#bubble[data-identity="match"]::after{background:#70ffb5;box-shadow:0 0 0 3px #70ffb52d,0 0 12px #58f2a3}
#bubble[data-identity="match"] #count{background:#bfffe0;color:#15563a;border-color:#a1ffd3}
#bubble[data-identity="review"]::after{background:#ffc578;box-shadow:0 0 0 3px #ffc57826,0 0 10px #ffc578}
#bubble[data-identity="mismatch"]::after{background:#ff778b;box-shadow:0 0 0 3px #ff778b22,0 0 10px #ff778b}
/* Panel: sentuhan tipis yang menyatu dengan bubble, tanpa mengubah ukuran atau tabel. */
#panel{border-color:#a6657d88;box-shadow:0 25px 65px #0f06118c,0 4px 13px #09060d66,inset 0 1px #ffffff17}
#panel>header{position:sticky;background:linear-gradient(115deg,#6f2b43,#3d2437 53%,#241c30);border-bottom-color:#e7a8bd38}
#panel>header .brand-mark{border-color:#fff0e4;background:linear-gradient(145deg,#ffe7e0,#f0b1b8);color:#6a2944}
#panel>header .brand strong{color:#fff4f1}
#panel>header #close{border-color:#f6c5d74d;color:#ffe3eb}
#panel>header #close:hover{background:#ffffff1e}
:host([data-sidebar-open]) #bubble{display:none!important}
@media(prefers-reduced-motion:reduce){#bubble{transition:none!important;animation:none!important}#bubble:hover,#bubble:active{transform:none}}
@media(prefers-reduced-transparency:reduce){#bubble{backdrop-filter:none;-webkit-backdrop-filter:none}}

/* =====================================================================
  v2.73.26 | OBSIDIAN ROYALE — polished, compact, high-contrast interface
  Presentation only: search, admin parsing, controls, and event handlers
  are unchanged. Inline verification colors retain highest priority.
===================================================================== */
:host{
 --bg:#100e15;--surface:#211924;--line:#67495b;--text:#fff6f1;
 --muted:#d4c1c6;--gold:#f0c78f;--mint:#88e5bb;
 font-family:'Segoe UI',Tahoma,Arial,sans-serif;
}
#panel{
 width:min(342px,calc(100vw - 24px));
 background:radial-gradient(ellipse at 8% 0%,#7740532e,transparent 52%),
            linear-gradient(160deg,#201723 0%,#11121b 55%,#15121b 100%);
 border:1px solid #bf8d9b8c;border-radius:21px;
 box-shadow:0 28px 65px #060407b3,0 0 0 1px #f3c7a512,
            inset 0 1px #ffffff1d;
 scrollbar-color:#8f6278 transparent;
}
#panel>header{
 position:sticky;top:0;z-index:3;gap:11px;
 background:linear-gradient(110deg,#6d3144,#462639 52%,#261c30);
 border-bottom:1px solid #f4c99648;padding:15px 15px;
 box-shadow:inset 0 1px #ffffff2a;
}
#panel>header::after{
 content:'';pointer-events:none;position:absolute;bottom:0;
 left:15px;right:15px;height:1px;
 background:linear-gradient(90deg,transparent,#f5cf9f99,transparent)
}
#panel>header .brand-mark{
 flex:0 0 36px;height:36px;
 border:1px solid #ffdfbaca;border-radius:12px;
 background:linear-gradient(145deg,#ffe6c9,#dba9a8);
 color:#592c40;box-shadow:0 5px 12px #19091670,inset 0 1px #ffffffc7;
}
#panel>header .brand strong{color:#fff5ed;font-weight:780;font-size:14px;letter-spacing:.25px}
#panel>header .brand-caption{color:#f3d5bf;letter-spacing:1.35px}
#panel>header #close{
 background:#ffffff13;border:1px solid #ffe7d45b;
 color:#fff0e7;border-radius:9px;
}
#panel>header #close:hover{background:#ffffff27}
#panel>.body{padding:13px}
#panel #status{color:#dec5cf;border-bottom:1px solid #f1c39820;line-height:1.7}
#bubble{
 isolation:isolate;overflow:visible;position:relative;
 min-height:54px;max-width:min(91vw,224px);padding:8px 13px 8px 8px;
 border:1px solid #ecc19aa8;border-radius:18px;
 background:linear-gradient(115deg,#762c46,#50263c 52%,#291d2d);
 color:#fff8f2;box-shadow:0 14px 30px #130714a3,inset 0 1px #ffffff43,
            0 0 0 1px #0006;
 transition:transform .17s ease,box-shadow .17s ease,border-color .17s ease;
}
#bubble::before{
 content:'';position:absolute;z-index:-1;pointer-events:none;
 inset:1px;border-radius:17px;
 background:radial-gradient(circle at 8% 0%,#fff2da32,transparent 62%);
}
#bubble .bubble-symbol{
 display:grid;place-items:center;flex:0 0 37px;height:37px;width:37px;
 border:1px solid #ffe2b5e0;border-radius:12px;
 color:#5b2b40;background:linear-gradient(140deg,#ffead5,#e8b0aa);
 box-shadow:0 4px 13px #0005,inset 0 1px #fff9;
}
#bubble .bubble-symbol svg{width:21px;height:21px;display:block;stroke:currentColor}
#bubble .bubble-label{font-weight:760;color:#fff6f1;letter-spacing:.2px;line-height:1.23}
#bubble .bubble-label span{font-size:8px;color:#edc6be;letter-spacing:1.25px;margin-top:3px}
#bubble #count{background:#ffe9ce26;border:1px solid #f9dab080;
 color:#fff1d7;min-width:23px;height:23px;border-radius:9px;font-weight:750}
#bubble::after{
 content:'';position:absolute;right:8px;top:6px;
 width:7px;height:7px;border-radius:50%;
 background:#e7c9ac;box-shadow:0 0 0 2px #391b2d,0 0 7px #f6dab0;
 pointer-events:none;
}
#bubble:hover{transform:translateY(-2px);border-color:#ffe0bd;
 box-shadow:0 18px 38px #130714b8,inset 0 1px #ffffff59}
#bubble:active{transform:translateY(0)}
#bubble:focus-visible{outline:2px solid #ffdfb0;outline-offset:4px}
#bubble[data-identity="match"]{border-color:#7cf5b9;
 box-shadow:0 0 0 2px #70f0ab55,0 0 23px #39e69a77,0 14px 30px #0008}
#bubble[data-identity="match"]::after{background:#80ffbc;
 box-shadow:0 0 0 3px #6dffb62e,0 0 13px #67ffc0}
#bubble[data-identity="review"]::after{background:#ffd785;
 box-shadow:0 0 0 3px #ffc97930,0 0 13px #ffc979}
#bubble[data-identity="mismatch"]::after{background:#ff738d;
 box-shadow:0 0 0 3px #ff738d30,0 0 13px #ff738d}
#bubble.unread #count{background:#ffe0b5;color:#572a40;border-color:#ffe0b5}
#panel #account{
 background:linear-gradient(155deg,#261c2b,#1a1b29);
 border:1px solid #73576a99;border-radius:14px;
 box-shadow:inset 0 1px #ffffff0a;
}
#panel .saved-result{
 background:#1c3d32;border-color:#549c7c7b;
 color:#c0f0d5;border-radius:8px;
}
#panel .player-result{
 background:#fcfaf9;color:#29232a;border:1px solid #cfa5ac;
 border-radius:13px;box-shadow:0 7px 18px #0003;
}
#panel .player-table th{background:#eee9eb;color:#594f58;font-weight:650}
#panel .player-table td{color:#28232b;background:#fffdfc;font-weight:720}
#panel .player-table th,#panel .player-table td{border-bottom:1px solid #d8cdd1;padding:10px 9px;line-height:1.5}
#panel .player-table .userid-value{color:#1f283a;font-size:17px}
#panel .player-table .number-highlight{background:#fff5ce;color:#504015}
#panel .player-result .player-banner{font-weight:800;line-height:1.5}
#account .player-result .player-banner[data-source="NOW"]{
 background:linear-gradient(110deg,#07884c,#159d5a 52%,#24b96d);
 color:#fff;border-bottom:1px solid #0d7848;text-shadow:none;
}
#account .player-result .player-banner[data-source="OLD"]{
 background:linear-gradient(110deg,#9e2a46,#b5364f 55%,#ce5265);
 color:#fff;border-bottom:1px solid #99263e;text-shadow:none;
}
#panel .player-result .balance-box>span:first-child{
 background:linear-gradient(105deg,#ffebc4,#e4c18e);
 color:#453020;border-bottom:1px solid #c8a36d;
 font-size:10px;font-weight:800;letter-spacing:1.15px;
}
#panel .player-result .copy-player{
 background:linear-gradient(110deg,#e5c18e,#d1a56c);
 border-color:#b68755;color:#3b2a28;
 font-weight:800;box-shadow:inset 0 1px #fff8;
}
#panel .player-result .copy-player:hover{
 background:linear-gradient(110deg,#ffdfaa,#deb679);
 border-color:#c4935b;
}
#panel .balance-box{
 border-radius:12px;box-shadow:inset 0 1px #ffffff14;
}
#panel .balance-box strong{font-size:28px;letter-spacing:-.6px}
#panel .aux-details>summary{color:#e8c7ac;font-weight:650}
#panel .manual-account>summary{color:#e7c7af}
#panel .body button:not(:disabled):hover{filter:brightness(1.11)}
#panel button:focus-visible,#panel input:focus-visible,#panel summary:focus-visible{
 outline:2px solid #ffdaae;outline-offset:2px;
}
#panel .body>details{border:1px solid #655167;background:#211a28;border-radius:10px}
#panel .category{color:#f2ca9a;letter-spacing:.85px}
:host([data-sidebar-open]) #panel{width:100%!important;max-width:100%!important;
 height:100%!important;max-height:100%!important}
:host([data-sidebar-open]) #bubble{display:none!important}
@media(prefers-reduced-motion:reduce){#bubble{transition:none!important}#bubble:hover,#bubble:active{transform:none}}

/* ================================================================
  v2.73.27 | LUXURY AMETHYST BLOOM
  Tampilan saja; fungsi NOW/OLD/888, cek identitas, dan selesai tidak diubah.
  Aset dekoratif tertanam (tanpa internet). Hindari menaruh gambar di atas teks.
================================================================ */
:host{
 --bg:#111025;--surface:#211a3f;--line:#71518f;--text:#f9f2ff;
 --muted:#c8b5e8;--gold:#f4c6a3;--mint:#72edaf;
 font-family:'Segoe UI',Tahoma,Arial,sans-serif;
}
#panel{
 width:min(414px,calc(100vw - 22px));max-height:calc(100dvh - 50px);
 border:1px solid #d8a2e3a6;border-radius:22px;
 background:
  radial-gradient(ellipse at 100% 100%,#69379b32,transparent 40%),
  radial-gradient(ellipse at 0% 5%,#60329b36,transparent 41%),
  linear-gradient(155deg,#1c1538 0%,#111124 56%,#1a1234 100%);
 box-shadow:0 22px 64px #050310ca,0 0 0 1px #f4c1cb13,0 0 26px #9c62ff25;
 color:#f7efff;scrollbar-color:#936eb0 #201937;
}
#panel>header{
 padding:16px 15px 18px;min-height:89px;position:sticky;top:0;z-index:4;
 border-bottom:1px solid #eec1b3a8;
 background:
  url("data:image/png;base64,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") right 48px center / 160px auto no-repeat,
  radial-gradient(ellipse at 95% 0%,#984bbd71,transparent 66%),
  linear-gradient(105deg,#3e204f 0%,#29183f 54%,#211733 100%);
 box-shadow:inset 0 1px #ffe0ed36,0 4px 20px #10052370;
 gap:11px;
}
#panel>header::after{
 left:12px;right:12px;height:1px;bottom:0;
 background:linear-gradient(90deg,#cf8cb32b,#ffe5b1,#b47dff72,transparent);
}
#panel>header .brand-mark{
 flex:0 0 52px;width:52px;height:54px;padding:0;
 border:1px solid #f5c19ca3;border-radius:17px;
 background:
  url("data:image/png;base64,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") center / cover no-repeat,
  linear-gradient(145deg,#473160,#1a1534);
 box-shadow:0 4px 17px #08051db8,0 0 13px #b87ff33d;
 overflow:hidden;
}
#panel>header .brand-mark svg{display:none!important}
#panel>header .brand strong{
 font:700 20px/1.2 Georgia,'Times New Roman',serif;
 color:#fff0e8;letter-spacing:.1px;text-shadow:0 1px 8px #080412;
}
#panel>header .brand .edition{display:none}
#panel>header .brand-caption{
 margin-top:7px;color:#ffd0a9;font-size:9px;letter-spacing:3px;font-weight:700;
}
#panel>header #close{
 position:relative;z-index:2;flex:0 0 31px;width:31px;height:32px;
 border:1px solid #f7c6b078;border-radius:10px;
 background:linear-gradient(130deg,#62355d9e,#2d203d8f);color:#ffedec;
 box-shadow:inset 0 1px #ffeff026;
}
#panel>header #close:hover{background:#805181dd}
#panel>.body{padding:14px 13px 16px}
#panel #status{
 margin:0 0 12px;padding:12px 12px 13px;color:#eaddfa;
 background:linear-gradient(145deg,#291d48ba,#1a1834e8);
 border:1px solid #9572b95e;border-radius:13px;
 box-shadow:inset 0 1px #ffffff0c;
 font-size:10px;line-height:1.65;
}
#panel #account{
 padding:12px;border:1px solid #976aa3ba;border-radius:15px;
 background:linear-gradient(160deg,#291c43,#1b1934 65%,#251638);
 box-shadow:inset 0 1px #ffffff11,0 7px 20px #08051070;
}
#panel .category{
 color:#f1bf9d;font-size:10px;letter-spacing:1.1px;font-weight:800;
}
#panel .saved-result{
 background:#153e34;color:#c6ffe2;border:1px solid #54bd8880;
 border-radius:999px;padding:5px 9px;font-size:9px;
}
#panel .lookup-steps>div{
 border-radius:10px;border-color:#a18bc048;
 background:#171a32;color:#dfd2f5;
}
#panel .lookup-steps b{color:#f1bb9b}
#panel .lookup-steps span{color:#f3e9ff}
#panel .lookup-steps>div[data-source="NOW"][data-state="found"]{background:#12462f;border-color:#28b776}
#panel .lookup-steps>div[data-source="NOW"][data-state="found"] span{color:#ccffe2}
#panel .lookup-steps>div[data-source="OLD"][data-state="found"]{background:#4c2239;border-color:#d97793}
#panel .lookup-steps>div[data-source="OLD"][data-state="found"] span{color:#ffdae4}
#panel .player-result{
 margin:10px 0 12px;border:1px solid #b882cb;border-radius:13px;
 overflow:hidden;background:#15192d;color:#fff3f6;
 box-shadow:0 8px 21px #06051599,0 0 0 1px #f9bce311;
}
#panel .player-result[data-source="NOW"]{border-color:#68cb9b}
#panel .player-result[data-source="OLD"]{border-color:#dc799a}
#panel .player-result .player-banner{
 padding:13px 12px;line-height:1.5;letter-spacing:.23px;font-size:10px;
 font-weight:800;color:#fff0ff;text-shadow:none;
 background:linear-gradient(115deg,#56307b,#32215c 70%,#432858);
 border-bottom:1px solid #e6b2f764;
}
#panel .player-result[data-verification="match"] .player-banner{
 background:linear-gradient(110deg,#583484,#3c276c 65%,#513275)!important;
 color:#fff9ee!important;border-color:#d09de3!important;
}
#panel .player-result[data-verification="review"] .player-banner{
 background:linear-gradient(110deg,#744e26,#574023)!important;
 color:#fff2cb!important;border-color:#e3a75d!important;
}
#panel .player-result[data-verification="mismatch"] .player-banner{
 background:linear-gradient(110deg,#a8214d,#812140)!important;
 color:#fff!important;border-color:#ea658d!important;
}
/* Rangka tabel persis seperti gambar: label kiri, data admin kanan. */
#panel .player-result .player-table{
 display:table!important;width:100%!important;table-layout:fixed;
 border-collapse:collapse!important;gap:0!important;padding:0!important;
 margin:0!important;font-size:11px;
}
#panel .player-result .player-table tbody{display:table-row-group!important}
#panel .player-result .player-table tr{
 display:table-row!important;background:transparent!important;
 border:0!important;padding:0!important;margin:0!important;
}
#panel .player-result .player-table th,
#panel .player-result .player-table td{
 display:table-cell!important;vertical-align:middle!important;
 border-bottom:1px solid #75568d70!important;
 padding:10px 9px!important;white-space:normal;overflow-wrap:anywhere;
}
#panel .player-result .player-table th{
 width:43%!important;min-width:0!important;
 color:#f0d7e7!important;background:#251b3e!important;
 font-size:10px!important;font-weight:550!important;line-height:1.55!important;
}
#panel .player-result .player-table td{
 width:57%!important;min-width:0!important;
 color:#fff5fa;background:#171d39;font-size:12px!important;
 font-weight:720!important;line-height:1.55!important;
}
#panel .player-result .player-table .userid-value{
 font-size:16px!important;color:#fff4eb!important;
}
#panel .player-result .player-table .number-highlight{letter-spacing:.2px}
#panel .player-result .player-table tr:last-child th,
#panel .player-result .player-table tr:last-child td{border-bottom:0!important}
#panel .balance-box{
 margin:11px 8px;border:1px solid #c99ac3ba;border-radius:16px;
 background:
  radial-gradient(ellipse at 100% 0%,#b67bd71a,transparent 50%),
  linear-gradient(126deg,#3d285b,#251e49);
 color:#f9dfcf;
 box-shadow:inset 0 1px #fff6,0 7px 20px #110a23a8;
}
#panel .balance-box>span:first-child{
 display:block;padding:10px;color:#ffe0b8;
 background:linear-gradient(115deg,#74518f,#442d69);
 border-bottom:1px solid #d9a7dc65;
 font-size:10px;letter-spacing:2px;font-weight:850;
}
#panel .balance-box strong{
 color:#ffd1ab;font-size:29px;letter-spacing:-1px;
 text-shadow:0 0 17px #fdb4c92c;
}
#panel .balance-box[data-tone="low"] strong{color:#acf5bc}
#panel .balance-box[data-tone="high"] strong{color:#ffd1ad}
#panel .balance-box small{color:#dac8ee}
#panel .balance-box button,
#panel #account-retry,
#panel .finished-actions button{
 background:linear-gradient(115deg,#6e3fa6,#9a65de 65%,#ad72cc);
 color:#fff5ff;border:1px solid #d8a2e0;border-radius:12px;
 box-shadow:0 5px 13px #15091b8c,inset 0 1px #fff4;
 font-weight:750;
}
#panel .player-result .copy-player{
 background:linear-gradient(115deg,#ffe0b2,#e5a98a)!important;
 color:#432b39!important;border-color:#ffebd3!important;
}
#panel .aux-details>summary,#panel .manual-account>summary{
 color:#f1c9ad;font-size:11px;font-weight:680;
}
#panel .card{
 border:1px solid #835dac;border-left:3px solid #c38ef5;
 background:linear-gradient(145deg,#282044,#211c38);
 box-shadow:0 4px 16px #04031265;border-radius:12px;
}
#panel .card b{color:#ffd5b8}
#panel .card p{color:#e7dcef}
#panel .body>details{background:#251c3a;border-color:#785a92;border-radius:12px}
#panel .body button{border-radius:10px}
#panel #scan{background:linear-gradient(110deg,#55318a,#7852ae);border:1px solid #b58adf;color:#fff0f9}
#panel .body button:not(:disabled):hover{filter:brightness(1.12)}
#panel button:focus-visible,#panel input:focus-visible,#panel summary:focus-visible,
#bubble:focus-visible{outline:2px solid #f6cae5;outline-offset:2px}
/* Floating orb: use actual decorative art from the user's reference image. */
#bubble{
 isolation:isolate;overflow:visible;position:relative;
 width:116px;min-width:116px;max-width:116px;
 height:118px;min-height:118px;
 margin-left:auto;padding:10px 9px 11px;
 border-radius:50%;display:flex;flex-direction:column;
 align-items:center;justify-content:center;gap:3px;
 background:
  radial-gradient(ellipse at 57% 15%,#b77bf668,transparent 55%),
  radial-gradient(ellipse at 50% 100%,#ce90ef5a,transparent 60%),
  linear-gradient(145deg,#3a245f,#1c153e 67%,#29184c);
 border:2px solid #e8a9da;
 color:#fff5fe;
 box-shadow:0 0 0 2px #d7a7e921,0 0 19px #9a62f58f,
  0 13px 32px #070318b8,inset 0 2px #fff9;
 text-shadow:0 1px 5px #080415;
 transition:transform .18s ease,box-shadow .18s ease;
}
#bubble::before{
 content:'';position:absolute;inset:0;border-radius:50%;z-index:-1;
 background:
  url("data:image/png;base64,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") right -9px bottom -10px / 87px auto no-repeat,
  radial-gradient(circle at 22% 20%,#ffffff24,transparent 55%);
 opacity:.74;pointer-events:none;
}
#bubble::after{
 content:'';position:absolute;right:13px;top:9px;width:9px;height:9px;
 border-radius:50%;background:#f6bf82;border:1px solid #221034;
 box-shadow:0 0 0 3px #d8b3ef3d,0 0 12px #ffd79a;
 z-index:4;pointer-events:none;
}
#bubble .bubble-symbol{
 display:block;flex:0 0 56px;width:59px;height:56px;
 padding:0;margin-top:-2px;margin-bottom:1px;
 background:url("data:image/png;base64,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") center / cover no-repeat;
 border:0;border-radius:50%;
 box-shadow:0 0 13px #e2a3ff7d;
}
#bubble .bubble-symbol svg{display:none!important}
#bubble .bubble-label{
 display:flex;flex-direction:column;text-align:center;align-items:center;
 color:#fff6ff;font-size:11px;font-weight:750;
 line-height:1.1;max-width:97px;letter-spacing:.05px;
}
#bubble .bubble-label span{
 margin-top:3px;font-size:6.5px;letter-spacing:1.5px;
 color:#f3c5d1;font-weight:700;
}
#bubble #count{
 position:absolute;right:-4px;top:-5px;z-index:5;
 display:grid;place-items:center;
 min-width:24px;height:24px;padding:0 5px;
 background:linear-gradient(150deg,#ff68bd,#b72b8f);color:#fff;
 border:2px solid #f9c1e3;border-radius:50%;font-size:11px;
 box-shadow:0 4px 10px #190527c2;
}
#bubble[data-unread="0"] #count{display:none}
/* Bubble ke kiri panel saat terbuka, seperti gambar referensi; tidak menutupi judul. */
#panel:not([hidden]) + #bubble{
 position:absolute;right:calc(100% + 16px);bottom:12px;margin:0;
}
@media(max-width:700px){#panel:not([hidden]) + #bubble{display:none}}
#bubble:hover{transform:translateY(-3px) scale(1.03);
 border-color:#ffe2fa;box-shadow:0 0 0 2px #e9adf34d,0 0 31px #c67dffb0,0 17px 34px #070318b8}
#bubble:active{transform:scale(.98)}
#bubble[data-identity="match"]{
 border-color:#73ffc1;box-shadow:0 0 0 2px #93ffd45e,0 0 30px #42f1aa94,0 13px 32px #070318c4;
}
#bubble[data-identity="match"]::after{background:#78ffc2;box-shadow:0 0 0 3px #6bffac44,0 0 15px #65ffb4}
#bubble[data-identity="review"]::after{background:#ffd47c;box-shadow:0 0 0 3px #ffc56b38,0 0 14px #ffc57a}
#bubble[data-identity="mismatch"]::after{background:#ff687e;box-shadow:0 0 0 3px #ff587938,0 0 14px #ff5879}
:host([data-sidebar-open]) #panel{
 width:100%!important;max-width:100%!important;
 height:100%!important;max-height:100%!important;
 border-radius:14px;
}
:host([data-sidebar-open]) #bubble{display:none!important}
@media(max-width:400px){
 #panel{width:min(350px,calc(100vw - 12px))}
 #panel>header .brand strong{font-size:17px}
 #panel .player-result .player-table td{font-size:11px!important}
}
@media(prefers-reduced-motion:reduce){#bubble{transition:none!important}#bubble:hover,#bubble:active{transform:none!important}}

/* =======================================================================
   v2.73.28 — Amethyst Bloom Compact (VISUAL ONLY)
   - Menyerupai referensi: ungu safir, bunga lotus, aksen rose-gold.
   - Bubble LiveChat mini 68px; Chatgacor tetap 106px.
   - Status yang dibaca dan seluruh tombol tetap menggunakan logika asli.
   ======================================================================= */
:host{--bg:#101021;--surface:#211a3b;--line:#a171bf;--text:#fff3ff;--gold:#f5c2ad;--mint:#81efb3}
#panel{
 width:min(426px,calc(100vw - 20px));
 border:1px solid #f2b8d5a0;
 border-radius:24px;
 background:
   radial-gradient(ellipse at 90% 100%,#7039b630,transparent 48%),
   linear-gradient(151deg,#1a1532 0%,#111325 45%,#21163a 100%);
 box-shadow:0 24px 70px #050313cc,0 0 0 1px #e7a7df18,
 0 0 28px #8c4dfc2b,inset 0 1px #ffe7f329;
}
#panel>header{
 min-height:96px;padding:17px 15px 17px;
 border-bottom:1px solid #edbfa2bb;
 box-shadow:inset 0 1px #fff6,0 4px 17px #0b0617a1;
}
#panel>header .brand-mark{
 width:52px;height:53px;flex-basis:52px;
 border-color:#e7b7d0;border-radius:17px;
 box-shadow:0 0 0 1px #f6dcff23,0 5px 18px #06020dd2,0 0 14px #a87ffd57;
}
#panel>header .brand strong{
 font-size:20px;letter-spacing:.08px;
 color:#fff4f4;text-shadow:0 2px 9px #09031e;
}
#panel>header .brand-caption{font-size:9px;color:#ffe0bd;letter-spacing:3px}
#panel #status{
 border:1px solid #aa7bbc73;
 background:linear-gradient(110deg,#312149ba,#1c1731d9);
 border-radius:14px;padding:11px 12px;
 color:#efe1fc;line-height:1.65;
}
#panel #account{
 border-color:#ba88ca9c;border-radius:16px;
 background:linear-gradient(158deg,#302144,#1b1b36 70%,#26183d);
}
#panel .player-result{
 border-color:#b788e0;border-radius:15px;
 box-shadow:0 10px 24px #07041299,0 0 0 1px #f9d0f41c;
}
#panel .player-result .player-banner{
 font-weight:800;letter-spacing:.35px;
 background:linear-gradient(105deg,#5e368c,#392269 70%,#66468c);
 border-bottom:1px solid #f4bbd46b;
}
#panel .player-result[data-verification="match"] .player-banner{
 background:linear-gradient(100deg,#59368a,#42276d 65%,#5f3d87)!important;
}
#panel .player-result .player-table th{
 background:#221b37!important;color:#e5cae7!important;
 border-right:1px solid #ad7fc961;
}
#panel .player-result .player-table td{
 background:#151b32;color:#fff7ff!important;
}
/* Keep green/amber/red inline verification states from the original code. */
#panel .player-result .player-table td[style*="background"]{
 box-shadow:inset 0 0 0 1px #ffffff1c;
}
#panel .balance-box{
 border-color:#dda4d4d4;
 background:linear-gradient(145deg,#422c63,#241d43);
 border-radius:16px;
}
#panel .balance-box>span:first-child{
 letter-spacing:2px;color:#ffe5bf;
 background:linear-gradient(120deg,#765294,#503574);
}
#panel .balance-box button,
#panel #account-retry,
#panel .finished-actions button{
 background:linear-gradient(110deg,#5c3697,#8855c0 58%,#b378d3);
 border-color:#eab5de;color:#fff8ff;
}
#panel .player-result .copy-player{
 background:linear-gradient(110deg,#ffe2c4,#e8ad99)!important;
 color:#4e2848!important;
}
#panel .body>details{background:#241a39;border-color:#805ca3}
#panel #scan{background:linear-gradient(110deg,#5e3396,#985bc0);border-color:#d5a3eb}
/* Chatgacor orb is still decorative; shrink a little relative to v2.73.27. */
:host([data-chat-platform="chatgacor"]) #bubble{
 width:106px;min-width:106px;max-width:106px;
 height:108px;min-height:108px;padding:8px 8px 10px;
}
:host([data-chat-platform="chatgacor"]) #bubble .bubble-symbol{
 width:53px;height:51px;flex-basis:51px;
}
:host([data-chat-platform="chatgacor"]) #bubble .bubble-label{font-size:10px}
:host([data-chat-platform="chatgacor"]) #bubble .bubble-label span{font-size:6px}
/* LiveChat: small, round, decorative icon only. No big text in chat area. */
:host([data-chat-platform="livechat"]) #bubble{
 width:68px!important;min-width:68px!important;max-width:68px!important;
 height:68px!important;min-height:68px!important;max-height:68px!important;
 padding:0!important;border-radius:50%!important;gap:0!important;
 display:flex;align-items:center;justify-content:center;
 box-shadow:0 0 0 1px #edd0ff4a,0 0 14px #b06eff80,
 0 7px 20px #060319bd,inset 0 1px #fff6;
}
:host([data-chat-platform="livechat"]) #bubble .bubble-symbol{
 width:46px;height:46px;flex:0 0 46px;
 padding:0;margin:0;border-radius:50%;
 background-size:cover;
 box-shadow:0 0 10px #c998ff88;
}
:host([data-chat-platform="livechat"]) #bubble .bubble-label{display:none!important}
:host([data-chat-platform="livechat"]) #bubble::after{
 width:7px;height:7px;top:7px;right:8px;
}
:host([data-chat-platform="livechat"]) #bubble #count{
 top:-6px;right:-7px;min-width:20px;height:20px;
 font-size:10px;padding:0 4px;border-width:1.5px;
}
:host([data-chat-platform="livechat"]) #panel:not([hidden]) + #bubble{
 right:calc(100% + 9px);bottom:10px;
}
:host([data-chat-platform="livechat"]) #bubble:hover{transform:translateY(-2px) scale(1.035)}
:host([data-chat-platform="livechat"]) #bubble[data-identity="match"]{
 box-shadow:0 0 0 2px #80ffd980,0 0 23px #46ffb59b,0 8px 22px #050314b5;
}
@media(max-width:700px){
 #panel{width:min(414px,calc(100vw - 12px))}
 :host([data-chat-platform="livechat"]) #panel:not([hidden]) + #bubble{display:none!important}
}
:host([data-sidebar-open]) #panel{
 width:100%!important;max-width:100%!important;
 height:100%!important;max-height:100%!important;
 border-radius:14px;
}
:host([data-sidebar-open]) #bubble{display:none!important}
@media(prefers-reduced-motion:reduce){#bubble{transition:none!important}}

/* v2.73.29 MINI BUBBLE — visual-only overrides */
:host([data-chat-platform="livechat"]) #bubble{
 width:48px!important;min-width:48px!important;max-width:48px!important;
 height:48px!important;min-height:48px!important;max-height:48px!important;
 padding:0!important;gap:0!important;border-radius:50%!important;
 display:flex;align-items:center;justify-content:center;
 box-shadow:0 0 0 1px #edc4f965,0 0 9px #b674f96a,0 4px 13px #060319ae;
}
:host([data-chat-platform="livechat"]) #bubble .bubble-symbol{
 width:39px!important;height:39px!important;flex:0 0 39px!important;
 margin:0!important;padding:0!important;border-radius:50%!important;
}
:host([data-chat-platform="livechat"]) #bubble .bubble-label{display:none!important}
:host([data-chat-platform="livechat"]) #bubble #count{
 top:-5px!important;right:-5px!important;min-width:16px!important;
 height:16px!important;font-size:9px!important;padding:0 3px!important;
}
:host([data-chat-platform="livechat"]) #bubble::after{width:6px!important;height:6px!important;top:4px!important;right:5px!important}
:host([data-chat-platform="chatgacor"]) #bubble{
 width:62px!important;min-width:62px!important;max-width:62px!important;
 height:62px!important;min-height:62px!important;max-height:62px!important;
 padding:0!important;gap:0!important;border-radius:50%!important;
 display:flex;align-items:center;justify-content:center;
}
:host([data-chat-platform="chatgacor"]) #bubble .bubble-symbol{
 width:48px!important;height:48px!important;flex:0 0 48px!important;
 margin:0!important;padding:0!important;border-radius:50%!important;
}
:host([data-chat-platform="chatgacor"]) #bubble .bubble-label{display:none!important}
:host([data-chat-platform="chatgacor"]) #bubble #count{top:-5px!important;right:-4px!important;min-width:17px!important;height:17px!important;font-size:9px!important;padding:0 3px!important}
:host([data-chat-platform="chatgacor"]) #bubble::after{width:7px!important;height:7px!important;top:6px!important;right:6px!important}



/* ======================================================================
   v2.73.30 — HIGH-CONTRAST READABILITY PATCH
   Hanya warna/kontras di panel Amethyst; tidak mengubah parser atau tombol.
   Beberapa aturan dari tema putih lama masih aktif pada kartu selesai:
   teks hijau tua di atas panel ungu. Override secara spesifik di bawah.
   ====================================================================== */
#panel #account[data-phase="finished"]{
  background:linear-gradient(152deg,#35244f 0%,#221c3a 57%,#1b1933 100%)!important;
  border:1px solid #b58adb!important;
  box-shadow:inset 0 1px #ffffff21,0 10px 28px #080411a1,0 0 20px #884aff1a!important;
  color:#fff3ff!important;
}
#panel #account[data-phase="finished"] > .finished-title{
  display:block;
  color:#fff5ff!important;
  font-size:19px!important;
  font-weight:800!important;
  text-shadow:0 2px 12px #0b061d!important;
  opacity:1!important;
}
#panel #account[data-phase="finished"] > p{
  color:#f1dffb!important;
  font-size:12px!important;
  font-weight:500!important;
  line-height:1.75!important;
  opacity:1!important;
  text-shadow:none!important;
}
#panel #account[data-phase="finished"] > .finished-icon{
  color:#164b37!important;
  background:linear-gradient(145deg,#deffeb,#acefcd)!important;
  border:1px solid #b3f6d1!important;
  box-shadow:0 5px 16px #03040d59,0 0 0 4px #9bf2c515!important;
}
#panel #account[data-phase="finished"] > .finished-eyebrow,
#panel #account[data-phase="finished"] > .finished-foot{
  color:#d9c4ef!important;
  opacity:1!important;
}
#panel #account[data-phase="finished"] .finished-actions button{
  color:#fffaff!important;
  background:linear-gradient(135deg,#603c97,#8556bb)!important;
  border:1px solid #c28fe4!important;
  opacity:1!important;
  font-weight:750!important;
}
#panel #account[data-phase="finished"] .finished-actions button:hover{
  background:linear-gradient(135deg,#7b50af,#a273d2)!important;
  color:white!important;
}
#panel #account[data-phase="finished"] .finished-actions #account-reopen{
  color:#281733!important;
  background:linear-gradient(110deg,#ffe1bb,#e7af9b)!important;
  border-color:#f5d8bc!important;
}
#panel #account[data-phase="finished"] .finished-actions #account-reopen:hover{
  background:linear-gradient(110deg,#fff0d7,#f7c5ae)!important;
}
/* Heading, captions, informational text and controls on dark panels. */
#panel #status{
  color:#f7eaff!important;
  background:linear-gradient(125deg,#342549,#251c3d)!important;
  border-color:#c19adeba!important;
  opacity:1!important;
}
#panel #account .category{color:#ffe2bd!important}
#panel #account .saved-result{color:#e9ffed!important;border-color:#679e7d!important}
#panel #account .saved-result small{color:#dcf4e2!important}
#panel #account .account-context,
#panel #account .lookup-steps span{color:#eee1f9!important}
#panel #account .lookup-steps b{color:#f5d1ff!important}
#panel #account .manual-account > summary,
#panel #account .aux-details > summary,
#panel #account .referral-detail > summary{
  color:#ffdfb9!important;opacity:1!important;
}
#panel #account .manual-account small,
#panel #account .aux-details small,
#panel #account .referral-detail small{color:#e6d4fa!important;opacity:1!important}
#panel .card p{color:#f1e2f6!important}
#panel .card .category{color:#f9d6aa!important}
#panel .body > details,
#panel .body > details label,
#panel .body > details small{color:#e7d5ef!important;opacity:1!important}
#panel .body > details > summary{color:#ffe1bd!important}
#panel .player-result .player-table th{color:#f0daf9!important}
#panel .player-result .player-table td{opacity:1!important}
#panel .balance-box small,
#panel .balance-box p{color:inherit!important;opacity:1!important}
#panel button:disabled{opacity:.72!important}
#panel button:focus-visible,#panel summary:focus-visible{
  outline:2px solid #f7d0a9!important;outline-offset:2px!important;
}


/* v2.73.32 • Readable balance levels: GREEN < 10.000, RED >= 10.000. */
#panel .player-result .balance-box[data-tone="low"]{
 background:linear-gradient(145deg,#123d2c,#176a42)!important;
 border:2px solid #53e59a!important;color:#edfff4!important;
 box-shadow:0 0 0 1px #8affb841,0 8px 26px #031b1066!important;
}
#panel .player-result .balance-box[data-tone="high"]{
 background:linear-gradient(145deg,#571b2a,#8e2138)!important;
 border:2px solid #ff8f9c!important;color:#fff0f0!important;
 box-shadow:0 0 0 1px #ff919441,0 8px 26px #2607127a!important;
}
#panel .player-result .balance-box[data-tone="low"] > span:first-child{
 background:linear-gradient(90deg,#0b6237,#138f52)!important;
 color:#f2fff4!important;border-color:#65f4a2!important;
}
#panel .player-result .balance-box[data-tone="high"] > span:first-child{
 background:linear-gradient(90deg,#912235,#c42f45)!important;
 color:#fff9f3!important;border-color:#ffa9b4!important;
}
#panel .player-result .balance-box[data-tone="low"] strong{
 color:#b5ffce!important;text-shadow:0 1px 8px #052b21!important;
}
#panel .player-result .balance-box[data-tone="high"] strong{
 color:#ffe1e2!important;text-shadow:0 1px 8px #3b0914!important;
}
#panel .player-result .balance-box[data-tone="low"] > span,
#panel .player-result .balance-box[data-tone="low"] small,
#panel .player-result .balance-box[data-tone="high"] > span,
#panel .player-result .balance-box[data-tone="high"] small{
 color:#fff9fc!important;opacity:1!important;font-weight:650;
}
#panel .player-result .balance-box[data-tone="low"] button{
 color:#ecfff4!important;border-color:#6ff5ae!important;
 background:#0c5435!important;
}
#panel .player-result .balance-box[data-tone="high"] button{
 color:#fff5f5!important;border-color:#ffb1b1!important;
 background:#9d2c42!important;
}


/* ======================================================================
 v2.73.35 — AMETHYST AURORA / BEAUTY-ONLY PASS
 Visual CSS only; user-script parsers, admin lookup and account logic untouched.
 ====================================================================== */
:host{
  --bg:#100e23;--surface:#211933;--line:#9566c4;
  --text:#fff6ff;--muted:#dccaea;--gold:#ffd5b8;--mint:#98f5c6;
}
#panel{
  width:min(414px,calc(100vw - 18px));
  border:1px solid #e9a9ddc7;border-radius:23px;
  background:radial-gradient(ellipse at 95% 93%,#6d348a33,transparent 55%),
             radial-gradient(ellipse at 0% 30%,#453a8333,transparent 50%),
             linear-gradient(154deg,#17112f,#111122 56%,#1c1435);
  box-shadow:0 27px 68px #05020ed9,0 0 0 1px #ffd0e31c,
             0 0 26px #965fe83a,inset 0 1px #ffddf12b;
  color:#fff4ff;scrollbar-color:#ad79c9 #211731;
}
#panel>header{
  min-height:94px;padding:17px 15px;
  border-bottom:1px solid #ffd0b7c9;
  box-shadow:inset 0 1px #fff8,0 8px 25px #0a0518a3;
}
#panel>header .brand strong{
  font:700 20px/1.2 Georgia,'Times New Roman',serif;
  color:#fff7f4;text-shadow:0 2px 10px #090318;
}
#panel>header .brand-caption{
  color:#ffdfc3;font-size:9px;font-weight:800;letter-spacing:2.7px;
}
#panel>header .brand-mark{
  border-color:#ffcfdb;border-radius:17px;
  box-shadow:0 0 0 2px #ffe0fc1b,0 5px 17px #050313bd,
             0 0 13px #d996f175;
}
#panel>header #close{
  color:#fff3ff;border:1px solid #eec7f399;
  background:linear-gradient(140deg,#704585,#42294e);
  box-shadow:inset 0 1px #ffffff32;
}
#panel>.body{padding:14px 13px 18px}
#panel #status{
  color:#f9ecff!important;font-size:11px;line-height:1.75;
  background:linear-gradient(115deg,#33244d,#251c3f)!important;
  border:1px solid #c6a1e4b9!important;border-left:3px solid #ebbdcc!important;
  border-radius:12px;padding:11px 12px;
  box-shadow:0 4px 12px #0703134d,inset 0 1px #ffffff18;
}
#panel #account:not([data-phase="finished"]){
  border-color:#b38adaaf;border-radius:16px;
  background:linear-gradient(160deg,#332447,#1c1a36 68%,#221735);
  box-shadow:0 10px 25px #0704147d,inset 0 1px #ffeff31b;
}
#panel #account .category{
  font-size:10px;letter-spacing:1px;font-weight:800;color:#ffe0bc!important;
}
#panel .lookup-steps{gap:7px}
#panel .lookup-steps>div{
  background:linear-gradient(135deg,#201d3c,#17182f);
  border:1px solid #8567a77a;border-radius:10px;
}
#panel .lookup-steps b{color:#ffd9ba!important}
#panel .lookup-steps span{color:#f5eaff!important}
#panel .player-result{
  border:1px solid #c496d9;
  border-radius:15px;
  background:#151627;
  box-shadow:0 10px 26px #06030da3,0 0 0 1px #ffcef023;
}
#panel .player-result[data-source="NOW"]{border-color:#69c9a0}
#panel .player-result[data-source="OLD"]{border-color:#e397b0}
#panel .player-result .player-banner{
  padding:13px 12px;font-size:11px;line-height:1.6;letter-spacing:.15px;
  color:#fff5f9;
  background:linear-gradient(110deg,#62418c,#38265d 70%,#53346f);
  border-bottom:1px solid #deb5e889;
}
#panel .player-result[data-verification="match"] .player-banner{
  background:linear-gradient(110deg,#52347e,#38275e 70%,#513875)!important;
  color:#fff7f7!important;
  border-bottom-color:#b893dd!important;
}
#panel .player-result .player-table th{
  color:#f3def7!important;background:#271d3e!important;
  font-size:10.5px!important;line-height:1.6!important;
  border-right:1px solid #ae8bd68c!important;
}
#panel .player-result .player-table td{
  color:#fff4ff;background:#181d37;
  font-size:12px!important;line-height:1.65!important;
}
#panel .player-result .player-table th,
#panel .player-result .player-table td{
  padding:11px 10px!important;
  border-bottom-color:#755b937d!important;
}
#panel .player-result .player-table .userid-value{
  color:#fff3e8!important;font-weight:850!important;font-size:16px!important;
}
/* Preserve JS verification cell backgrounds (green / amber / red). */
#panel .player-result .player-table td[style*="background"]{
  box-shadow:inset 0 1px #ffffff22;
}
#panel .saved-result{
  border-radius:999px;background:#19513c;
  border:1px solid #73dfaaa6;color:#edfff4!important;
  padding:5px 9px;font-weight:750;
}
#panel .card{
  border:1px solid #aa7abf;border-left:3px solid #e7a7d6;
  border-radius:13px;background:linear-gradient(140deg,#342444,#211e3c);
  box-shadow:0 7px 17px #06041270;
}
#panel .card b{color:#ffe1bf}
#panel .card p{color:#f4e5fa!important}
#panel .aux-details>summary,
#panel .manual-account>summary,
#panel .referral-detail>summary{
  color:#ffdeb9!important;font-weight:700;letter-spacing:.1px;
}
#panel .body>details{
  border-radius:13px;background:#261d3c;
  border-color:#946db9;
}
#panel .body>details>summary{color:#ffe0c0!important}
#panel #scan{
  color:#fff8ff!important;font-weight:800;
  background:linear-gradient(112deg,#68409d,#905bb9 65%,#ad79c7)!important;
  border:1px solid #dfb2eb!important;
  box-shadow:inset 0 1px #ffecff57,0 5px 13px #10081f9c;
}
#panel #account-retry,
#panel .finished-actions button{
  color:#fff8ff!important;
  background:linear-gradient(112deg,#7147a4,#985eb9)!important;
  border:1px solid #ecc4ef!important;
  box-shadow:0 5px 13px #07031699,inset 0 1px #ffffff40;
}
#panel .player-result .copy-player{
  color:#3e223b!important;font-weight:850!important;
  background:linear-gradient(115deg,#ffe4cd,#efb8b0)!important;
  border:1px solid #ffedd9!important;
  box-shadow:inset 0 1px #fff8,0 4px 12px #13071970;
}
#panel button:not(:disabled):hover{filter:brightness(1.12)}
#panel input,#panel select{
  background:#18182f;color:#fff6fc;border-color:#9a7aba;
}
#panel input::placeholder{color:#c5b4d5;opacity:1}
#panel #account[data-phase="finished"]{
  border-color:#bd98da!important;
  background:linear-gradient(150deg,#392750,#241d3e 62%,#1d1a35)!important;
}
#panel #account[data-phase="finished"] > .finished-title{
  color:#fff3ff!important;text-shadow:0 2px 10px #070214!important;
}
#panel #account[data-phase="finished"] > p,
#panel #account[data-phase="finished"] > .finished-foot{
  color:#f1dff9!important;opacity:1!important;
}
/* Keep original threshold: under 10,000 green; 10,000 and above red. */
#panel .player-result .balance-box[data-tone="low"]{
  border-color:#60f0a7!important;
  background:linear-gradient(140deg,#103d2d,#176941)!important;
}
#panel .player-result .balance-box[data-tone="high"]{
  border-color:#ff9cab!important;
  background:linear-gradient(140deg,#542032,#8a293e)!important;
}
#panel .player-result .balance-box[data-tone="low"] strong{color:#baffd7!important}
#panel .player-result .balance-box[data-tone="high"] strong{color:#ffe3e3!important}
/* The same compact, image-backed bubble; no changes to its behavior. */
:host([data-chat-platform="livechat"]) #bubble{
  width:48px!important;height:48px!important;min-width:48px!important;
  min-height:48px!important;max-width:48px!important;max-height:48px!important;
  border:1.5px solid #edb6f4!important;
  box-shadow:0 0 0 1px #e4b0ff54,0 0 14px #ae64ee9c,0 6px 17px #050312aa!important;
}
:host([data-chat-platform="chatgacor"]) #bubble{
  width:62px!important;height:62px!important;min-width:62px!important;
  min-height:62px!important;max-width:62px!important;max-height:62px!important;
  border:1.5px solid #efb9f5!important;
  box-shadow:0 0 0 1px #e4b0ff52,0 0 15px #ae64ee9c,0 8px 20px #050312aa!important;
}
#bubble[data-identity="match"]{
  border-color:#84ffd0!important;
  box-shadow:0 0 0 2px #76f3be85,0 0 20px #39efae93,0 7px 17px #050312aa!important;
}
#bubble #count{background:linear-gradient(140deg,#fa5db0,#a92c8c);color:#fff}
@media(max-width:420px){#panel{width:min(414px,calc(100vw - 12px))}}
@media(prefers-reduced-motion:reduce){#bubble{transition:none!important}#bubble:hover{transform:none!important}}


/* =======================================================================
   v2.73.36 — ROYAL BLOOM / REAL HIGH-CONTRAST RECOLOR
   Applied AFTER all original/legacy CSS in this script's own shadow root.
   Appearance only: identity comparison, admin calls, cache, messages intact.
   ======================================================================= */
:host{
 --bg:#160d32!important;--surface:#21173b!important;--line:#b289df!important;
 --text:#fff9ff!important;--muted:#ebd8ff!important;--gold:#ffe0ad!important;
 --mint:#83ffc2!important;font-family:Inter,"Segoe UI",Arial,sans-serif!important;
 color:#fff9ff!important;color-scheme:dark;
}
#panel{
 background:radial-gradient(ellipse at 92% 5%,rgba(194,76,225,.27),transparent 36%),
  radial-gradient(ellipse at 0% 83%,rgba(113,80,255,.24),transparent 44%),
  linear-gradient(162deg,#29104a 0%,#1a1239 38%,#0f1530 100%)!important;
 border:2px solid #ecc0f9!important;border-radius:24px!important;
 box-shadow:0 0 0 1px #6b3578,0 8px 25px #a64bc64a,0 24px 70px #070416d9,
  inset 0 1px #ffe8ff54!important;
 color:#fffaff!important;scrollbar-color:#dc8ff0 #231434!important;
 width:min(426px,calc(100vw - 14px))!important;
}
#panel>header{
 background-image:url("data:image/png;base64,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"),
  radial-gradient(ellipse at 15% 0%,#ac5ada92,transparent 72%),
  linear-gradient(108deg,#65277f 0%,#512675 45%,#2a194c 84%)!important;
 background-repeat:no-repeat,no-repeat,no-repeat!important;
 background-position:right 42px center,center,center!important;
 background-size:175px auto,cover,cover!important;
 min-height:101px!important;padding:16px 14px!important;
 border-bottom:2px solid #ffcfaf!important;
 box-shadow:0 7px 22px #120920a8,inset 0 1px #ffefff80!important;
}
#panel>header::before{filter:saturate(1.32) brightness(1.12)!important;opacity:1!important}
#panel>header .brand strong{
 color:#fff9ec!important;font-family:Georgia,"Times New Roman",serif!important;
 font-size:20px!important;font-weight:800!important;
 text-shadow:0 3px 12px #1b052f!important;
}
#panel>header .brand-caption{
 display:block!important;color:#ffe4b6!important;
 font-size:9px!important;letter-spacing:2.1px!important;
 font-weight:900!important;text-shadow:0 2px 4px #1b052f!important;
}
/* A visible visual version mark helps distinguish new UI from an old cached script. */
#panel>header .brand-caption::after{content:"  · ROYAL BLOOM";color:#ff9ddc!important;letter-spacing:1px!important}
#panel>header .brand-mark{
 border:2px solid #ffd8e6!important;
 box-shadow:0 0 0 2px #ca79ee53,0 7px 19px #1b052cbf,
  0 0 19px #e17ee27f!important;
}
#panel>header #close{
 color:#fff6ff!important;border:1px solid #fbd5e9!important;
 background:linear-gradient(145deg,#9250ac,#522471)!important;
 border-radius:12px!important;font-weight:900!important;
 box-shadow:0 4px 11px #1c062755!important;
}
#panel>.body{
 background:radial-gradient(circle at 100% 100%,#5f2b8644,transparent 45%),
 linear-gradient(172deg,#251638,#1a1735 58%,#16172c)!important;
 padding:14px 13px 16px!important;color:#fff8ff!important;
}
#panel #status{
 background:linear-gradient(112deg,#4b2b72,#2d255b)!important;
 border:1px solid #dfb4fa!important;border-left:4px solid #ffbbd7!important;
 border-radius:14px!important;padding:12px 13px!important;
 color:#fff8ff!important;font-size:11.5px!important;font-weight:650!important;
 line-height:1.7!important;text-shadow:0 1px 2px #0a051a90!important;
 box-shadow:0 8px 17px #10082799,inset 0 1px #ffffff24!important;
}
#panel #account:not([data-phase="finished"]){
 background:linear-gradient(150deg,#392454,#242044 57%,#211a3b)!important;
 border:1px solid #d3a8f2!important;border-radius:17px!important;
 box-shadow:0 12px 27px #0b061e8f,inset 0 1px #ffe8ff20!important;
}
#panel .category,#panel #account .category{
 color:#ffe4b4!important;font-size:10.5px!important;font-weight:900!important;
 letter-spacing:1.1px!important;text-shadow:0 1px 5px #15081a!important;
}
#panel .account-number{color:#ffffff!important;font-weight:800!important;font-size:21px!important;text-shadow:0 2px 7px #100820!important}
#panel .account-context>summary,#panel .aux-details>summary,#panel .manual-account>summary,#panel .referral-detail>summary{
 color:#ffe4c8!important;font-size:11.5px!important;font-weight:750!important;opacity:1!important;
}
#panel .lookup-steps>div{
 background:#251a42!important;border:1px solid #ab83d0!important;
 border-radius:10px!important;padding:8px 9px!important;
}
#panel .lookup-steps b{color:#ffdeab!important}
#panel .lookup-steps span{color:#f9efff!important;font-weight:650!important}
#panel .saved-result{
 display:block!important;background:#105c45!important;border:1px solid #77f2b7!important;
 color:#f2fff7!important;border-radius:11px!important;
 font-size:11px!important;font-weight:800!important;padding:9px 10px!important;
}
#panel .saved-result small{display:block!important;color:#d9ffe8!important;font-weight:550!important;margin-top:3px!important}
#panel .player-result{
 border:1px solid #e5b7ed!important;border-radius:16px!important;
 background:#16172e!important;
 box-shadow:0 10px 24px #0a051cc9,0 0 0 1px #c9a3e852!important;
}
#panel .player-result .player-banner{
 background:linear-gradient(104deg,#8145a3,#4d2b83)!important;
 border-bottom:1px solid #ffd2ef!important;color:#fffaff!important;
 font-size:11.5px!important;font-weight:900!important;line-height:1.5!important;
 padding:12px!important;text-shadow:0 1px 5px #12082b!important;
}
/* NOW green / OLD red remain visible even when all three fields match. */
#panel .player-result[data-source="NOW"] .player-banner,
#panel .player-result[data-source="NOW"][data-verification="match"] .player-banner{
 background:linear-gradient(105deg,#0f8e65,#11684f 75%,#174b57)!important;
 color:#f2fff8!important;border-bottom-color:#7ff5bd!important;
}
#panel .player-result[data-source="OLD"] .player-banner,
#panel .player-result[data-source="OLD"][data-verification="match"] .player-banner{
 background:linear-gradient(105deg,#a8325c,#77264f 74%,#4d265e)!important;
 color:#fff6f8!important;border-bottom-color:#ffa4bf!important;
}
/* Verification mismatch/review inline !important values retain priority. */
#panel .player-table{width:100%!important}
#panel .player-result .player-table th{
 background:#35224d!important;color:#ffe7ed!important;
 border-color:#7d5d9e!important;font-size:11px!important;
 font-weight:750!important;padding:10px!important;
}
#panel .player-result .player-table td{
 border-color:#bd9fce!important;font-size:12.4px!important;
 font-weight:800!important;line-height:1.55!important;padding:10px!important;
 text-shadow:none!important;
}
#panel .player-result .player-table td:not([style*="background"]){
 background:#f6eafa!important;color:#25163d!important;
}
#panel .player-result .player-table .userid-value{
 background:#fff2e0!important;color:#3a1e4b!important;
 font-weight:900!important;font-size:15px!important;
}
/* Data cells with verification signals are set inline by JavaScript;
   their important green/amber/red styles must be preserved. */
#panel .player-result .player-table td[style*="background"]{
 /* Let JS's inline verdict colors win, including green/amber/red. */
 font-weight:850!important;
}
#panel .player-result .balance-box[data-tone="low"]{
 background:linear-gradient(143deg,#0b553d,#11764c)!important;
 color:#edfff5!important;border:2px solid #5bffac!important;
 box-shadow:0 0 0 1px #acffd64d,0 8px 24px #06281e8a!important;
}
#panel .player-result .balance-box[data-tone="high"]{
 background:linear-gradient(143deg,#712036,#b12d4b)!important;
 color:#fff4f6!important;border:2px solid #ffb0bb!important;
 box-shadow:0 0 0 1px #ffc4c866,0 8px 24px #3107168a!important;
}
#panel .player-result .balance-box[data-tone="low"] strong{color:#c4ffdc!important;font-size:31px!important}
#panel .player-result .balance-box[data-tone="high"] strong{color:#ffe4e8!important;font-size:31px!important}
#panel .balance-box span,#panel .balance-box small{opacity:1!important;font-size:10px!important;line-height:1.6!important}
#panel .player-result .balance-box[data-tone="low"] button{
 background:#074f35!important;color:#f3fff8!important;border-color:#8bffc0!important;
}
#panel .player-result .balance-box[data-tone="high"] button{
 background:#81233b!important;color:#fff5f7!important;border-color:#ffc6d0!important;
}
#panel .player-result .copy-player{
 background:linear-gradient(112deg,#ffe4a9,#f7b5c0)!important;
 color:#412346!important;border:1px solid #ffedda!important;
 font-size:12px!important;font-weight:900!important;padding:11px!important;
 box-shadow:0 4px 14px #0d051b77,inset 0 1px #fff9!important;
}
#panel button,#panel .body button{
 border-radius:12px!important;font-size:11.5px!important;font-weight:750!important;
}
#panel .actions button,#panel #account-retry,#panel #account-view,#panel #account-reopen,#panel #scan,
#panel #account .finished-actions button{
 background:linear-gradient(117deg,#a450d1,#6c3eb4)!important;
 border:1px solid #e8bbf7!important;color:#fff9ff!important;
 box-shadow:inset 0 1px #ffffff50,0 4px 13px #12061f9e!important;
 padding:10px 12px!important;
}
#panel button:disabled{opacity:.65!important;filter:saturate(.6)!important}
#panel button:not(:disabled):hover{filter:brightness(1.14) saturate(1.13)!important}
#panel .body>details{
 background:#24163f!important;border:1px solid #966cc5!important;
 color:#f7eaff!important;border-radius:13px!important;
}
#panel .body>details>summary{color:#ffe6bd!important;font-weight:750!important;font-size:11.5px!important}
#panel input,#panel select{
 background:#1c1538!important;color:#fff7ff!important;border:1px solid #aa80d7!important;
}
#panel input::placeholder{color:#d9c6e7!important;opacity:1!important}
#panel .card{
 background:linear-gradient(135deg,#35224c,#211e42)!important;
 border:1px solid #ab86d3!important;border-left:4px solid #ffb9d4!important;
 color:#fff9ff!important;border-radius:12px!important;
}
#panel .card b,#panel .card strong{color:#ffe4bd!important}
#panel .card p,#panel .card small{color:#f3e7fd!important}
/* Ensure completed screen is readable: prior dark-green text was invisible. */
#panel #account[data-phase="finished"]{
 background:radial-gradient(ellipse at 50% 0,#b755d957,transparent 60%),
 linear-gradient(145deg,#44255c,#211d42 80%)!important;
 border:2px solid #e7b4ed!important;border-radius:19px!important;
 box-shadow:inset 0 1px #ffeafa54,0 9px 25px #090518aa!important;
}
#panel #account[data-phase="finished"] .finished-icon{
 background:linear-gradient(145deg,#e5ffe9,#8cddad)!important;
 border:2px solid #dbffe5!important;color:#155d3d!important;
 box-shadow:0 0 0 7px #98eab01d,0 6px 19px #0d152866!important;
}
#panel #account[data-phase="finished"] .finished-eyebrow{
 color:#ffe4b6!important;font-size:10px!important;font-weight:850!important;letter-spacing:1px!important;
}
#panel #account[data-phase="finished"] .finished-title{
 color:#ffffff!important;font-size:21px!important;font-weight:900!important;
 line-height:1.45!important;text-shadow:0 2px 10px #0e0518!important;
}
#panel #account[data-phase="finished"] > p,
#panel #account[data-phase="finished"] .finished-foot{
 color:#f5e9ff!important;font-size:11px!important;line-height:1.7!important;
 font-weight:650!important;opacity:1!important;
}
#panel #account[data-phase="finished"] .finished-actions button{color:#fff!important}
#panel .not-registered strong{color:#ffe4c3!important}
#panel .not-registered span{color:#f5dfd1!important}
/* Same mini bubble footprint; visually brighter. */
#bubble{
 background:radial-gradient(circle at 28% 14%,#e3a8ff90,transparent 38%),
 linear-gradient(150deg,#6532a3,#341c6c)!important;
 border:2px solid #ffd2fb!important;
 box-shadow:0 0 0 2px #d889ff59,0 0 22px #d071f0a1,0 8px 24px #090318c9!important;
}
#bubble::before{box-shadow:inset 0 0 9px #ffcbef88!important}
#bubble::after{box-shadow:0 0 0 3px #aa81ff4d,0 0 15px #ec8bed!important}
#bubble[data-identity="match"]{border-color:#96ffcf!important;box-shadow:0 0 0 2px #8cffe169,0 0 20px #6affb59b!important}
#bubble[data-identity="mismatch"]{border-color:#ff9fad!important}
#bubble #count{background:#ed4c96!important;color:#fff!important;border-color:#ffdaed!important}
:host([data-chat-platform="livechat"]) #bubble{
 width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;
 max-width:48px!important;max-height:48px!important;
}
:host([data-chat-platform="chatgacor"]) #bubble{
 width:62px!important;height:62px!important;min-width:62px!important;min-height:62px!important;
 max-width:62px!important;max-height:62px!important;
}
/* Sidebar layout remains managed by existing script; don't resize it here. */
:host([data-sidebar-open]) #panel{width:100%!important;max-width:100%!important;height:100%!important;max-height:100%!important}
:host([data-sidebar-open]) #bubble{display:none!important}
@media(max-width:420px){#panel{width:min(426px,calc(100vw - 12px))!important}}
@media(prefers-reduced-motion:reduce){#bubble{transition:none!important;animation:none!important}}


/* ===========================================================================
   v2.73.37 · CELESTIAL ORCHID — JEWEL GLASS / EDITION
   Visual-only finishing layer. Admin-led matching and every JS action stay intact.
   =========================================================================== */
:host{
  --bg:#0a1029!important;--surface:#181c40!important;--line:#c99bff!important;
  --text:#fffaff!important;--muted:#f2dfff!important;--gold:#ffe4ae!important;
  --mint:#81ffcd!important;
  font-family:Inter,"Segoe UI",Arial,sans-serif!important;
  color:#fffaff!important;
}
#panel{
  width:min(432px,calc(100vw - 14px))!important;
  border:2px solid #fac7f0!important;
  border-radius:25px!important;
  background:
    radial-gradient(ellipse at 0% 100%,#8f4eeb52,transparent 47%),
    radial-gradient(ellipse at 105% 35%,#ff5fbc25,transparent 40%),
    linear-gradient(161deg,#101a43 0%,#151436 52%,#161033 100%)!important;
  box-shadow:0 0 0 1px #ffdbfa32,0 0 28px #b94ee273,0 25px 74px #08051de0,
    inset 0 1px #fff2ff88!important;
  scrollbar-color:#d991ee #171435!important;
  color:#fffaff!important;
}
#panel>header{
  position:sticky!important;
  min-height:110px!important;
  padding:17px 15px!important;
  background-image:
    url("data:image/png;base64,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"),
    radial-gradient(circle at 93% 3%,#ffc1ec7d 0%,transparent 40%),
    radial-gradient(ellipse at 0% 100%,#b065d8a1,transparent 73%),
    linear-gradient(118deg,#46348c 0%,#5b2d94 48%,#241b60 100%)!important;
  background-repeat:no-repeat,no-repeat,no-repeat,no-repeat!important;
  background-position:right 29px center,center,center,center!important;
  background-size:180px auto,cover,cover,cover!important;
  border-bottom:2px solid #ffd3af!important;
  box-shadow:0 8px 30px #0c0a2fc9,inset 0 2px #ffe3ff8c!important;
  isolation:isolate;
}
#panel>header::after{
  content:""!important;position:absolute!important;inset:0!important;
  width:auto!important;height:auto!important;right:0!important;top:0!important;
  opacity:.83!important;pointer-events:none!important;z-index:0!important;
  border-radius:inherit!important;
  background:
    radial-gradient(circle at 62% 19%,#fff 0 1px,transparent 3px),
    radial-gradient(circle at 86% 81%,#ffdfbd 0 1px,transparent 3px),
    radial-gradient(circle at 12% 13%,#fff0ff 0 1px,transparent 3px),
    radial-gradient(circle at 47% 70%,#ffe5c4 0 1px,transparent 3px),
    linear-gradient(180deg,#ffffff16,transparent 52%)!important;
  box-shadow:none!important;
}
#panel>header::before{
  content:""!important;position:absolute!important;left:0!important;right:0!important;
  bottom:0!important;top:auto!important;width:auto!important;height:2px!important;
  border:0!important;transform:none!important;border-radius:0!important;
  background:linear-gradient(90deg,transparent,#fff4d5,#ffd5f2,#fff4d5,transparent)!important;
  opacity:1!important;filter:drop-shadow(0 0 4px #ffd1b8)!important;
  pointer-events:none!important;z-index:1!important;
}
#panel>header>*{position:relative;z-index:2}
#panel>header .brand strong{
  font:700 21px/1.2 Georgia,"Times New Roman",serif!important;
  color:#fff7f5!important;letter-spacing:.2px!important;
  text-shadow:0 2px 12px #0c0623e0,0 0 18px #ffa8eb6e!important;
}
#panel>header .brand-caption{
  color:#ffecc9!important;font-size:8.2px!important;letter-spacing:2.5px!important;
  font-weight:900!important;text-shadow:0 1px 6px #110d37!important;
}
#panel>header .brand-caption::after{
  content:"  · CELESTIAL ORCHID"!important;color:#ffc4ea!important;letter-spacing:1px!important;
}
#panel>header .brand-mark{
  width:55px!important;height:55px!important;flex:0 0 55px!important;
  border:2px solid #ffe4cd!important;border-radius:17px!important;
  box-shadow:0 0 0 3px #f8adff40,0 0 22px #ffc4e578,0 8px 20px #080b2fbe!important;
}
#panel>header #close{
  color:#fff8fd!important;background:linear-gradient(139deg,#a664d7,#542885)!important;
  border:1px solid #ffe1ec!important;border-radius:12px!important;
  box-shadow:0 5px 14px #1b0b4a99,inset 0 1px #fff6!important;
  font-weight:900!important;
}
#panel>.body{
  padding:14px 13px 20px!important;
  background:
    radial-gradient(circle at 0% 85%,#764dc126,transparent 47%),
    linear-gradient(172deg,#17234a,#191b40 60%,#161233)!important;
  color:#fffaff!important;
}
#panel #status{
  color:#fff9ff!important;
  background:linear-gradient(119deg,#49418b,#3d2c77 63%,#49246f)!important;
  border:1px solid #d8c0ff!important;border-left:4px solid #ffd4ae!important;
  border-radius:14px!important;font-size:11.4px!important;
  font-weight:750!important;line-height:1.65!important;
  padding:13px 13px!important;
  box-shadow:0 6px 17px #0e0d35c2,inset 0 1px #fff6!important;
  text-shadow:0 1px 2px #211149!important;
}
#panel #account:not([data-phase="finished"]){
  border:1px solid #dfb9ff!important;border-radius:19px!important;
  background:linear-gradient(145deg,#292555,#211c46 65%,#262053)!important;
  box-shadow:0 9px 29px #090b2dc2,inset 0 1px #ffffff1d!important;
}
#panel #account .category,#panel .category{
  font-size:10.4px!important;letter-spacing:1.05px!important;
  color:#ffe6bc!important;font-weight:900!important;
  text-shadow:0 1px 5px #130d37!important;
}
#panel .lookup-steps>div{
  background:linear-gradient(120deg,#212653,#181c43)!important;
  border:1px solid #a792e3!important;border-radius:10px!important;
}
#panel .lookup-steps b{color:#ffe3b8!important}
#panel .lookup-steps span{color:#f8f0ff!important;font-size:10.5px!important}
#panel .account-number{color:#fff9ff!important;text-shadow:0 2px 9px #111033!important}
#panel .saved-result{
  background:linear-gradient(116deg,#127d60,#0b604d)!important;
  border:1px solid #84ffd8!important;color:#f4fffc!important;
  border-radius:11px!important;box-shadow:0 0 17px #2bdfb82d,inset 0 1px #e6fff45e!important;
}
#panel .saved-result small{color:#e6fff4!important}
#panel .player-result{
  overflow:hidden!important;border:1px solid #e4bfff!important;border-radius:17px!important;
  background:#161a3f!important;
  box-shadow:0 8px 25px #0a0b2db3,0 0 0 1px #eac8ff25!important;
}
#panel .player-result .player-banner{
  color:#fffaff!important;padding:13px 12px!important;font-size:11.5px!important;
  font-weight:900!important;line-height:1.6!important;letter-spacing:.18px!important;
  background:linear-gradient(106deg,#7142ae,#402b82)!important;
  border-bottom:1px solid #edd1ff!important;
  text-shadow:0 1px 4px #060721!important;
}
#panel .player-result[data-source="NOW"] .player-banner{
  color:#f4fff8!important;background:linear-gradient(100deg,#128768,#0a6756 67%,#11596b)!important;
  border-bottom:1px solid #83ffd9!important;
}
#panel .player-result[data-source="OLD"] .player-banner{
  color:#fff6fa!important;background:linear-gradient(101deg,#ac365b,#74274c 67%,#592a69)!important;
  border-bottom:1px solid #ffb6d3!important;
}
#panel .player-result .player-table th{
  background:linear-gradient(108deg,#f2e5fe,#ead9fb)!important;
  color:#34234e!important;
  font-weight:850!important;font-size:11px!important;line-height:1.5!important;
  border-color:#bfa9e1!important;padding:11px 10px!important;
  text-shadow:none!important;
}
#panel .player-result .player-table td{
  border-color:#baa5d2!important;padding:11px 10px!important;
  font-size:12.7px!important;line-height:1.6!important;
  font-weight:850!important;
  text-shadow:none!important;
}
#panel .player-result .player-table td:not([style*="background"]){
  background:#fffbff!important;color:#2e2348!important;
}
#panel .player-result .player-table .userid-value{
  background:#fff1df!important;color:#3b2550!important;font-size:15.5px!important;
  font-weight:950!important;
}
/* Critical: keep real verification colors set by JS and show mismatch in red. */
#panel .player-result .player-table td[style*="background"]{
  box-shadow:inset 0 1px #ffffff4d,inset 0 0 0 1px #ffffff2b!important;
  font-weight:900!important;
}
#panel .player-result .balance-box{
  position:relative!important;isolation:isolate!important;
  overflow:hidden!important;border-radius:17px!important;
  margin:11px 8px!important;
}
#panel .player-result .balance-box::after{
  content:"";position:absolute;right:-27px;top:4px;
  width:130px;height:130px;pointer-events:none;z-index:-1;
  background:radial-gradient(circle,#ffffff20 0,transparent 61%),
    repeating-conic-gradient(from 11deg,#ffffff0c 0deg 5deg,transparent 5deg 18deg);
  border-radius:50%;opacity:.8;
}
#panel .player-result .balance-box[data-tone="low"]{
  background:linear-gradient(135deg,#065542,#087e59 60%,#0b533f)!important;
  color:#f0fff7!important;border:2px solid #8fffd2!important;
  box-shadow:0 0 0 1px #92ffd552,0 8px 25px #06392d99!important;
}
#panel .player-result .balance-box[data-tone="high"]{
  background:linear-gradient(135deg,#62203a,#b52c51 60%,#6c214b)!important;
  color:#fff4f7!important;border:2px solid #ffc1d0!important;
  box-shadow:0 0 0 1px #ffb2c64e,0 8px 25px #380b258c!important;
}
#panel .player-result .balance-box>span:first-child{
  background:linear-gradient(103deg,#ffe7b9,#f9c7df)!important;
  color:#43254f!important;letter-spacing:2.3px!important;
  text-shadow:none!important;font-weight:950!important;
}
#panel .player-result .balance-box[data-tone="low"] strong{
  color:#dcffe7!important;font-size:33px!important;text-shadow:0 2px 13px #033829!important;
}
#panel .player-result .balance-box[data-tone="high"] strong{
  color:#ffe6eb!important;font-size:33px!important;text-shadow:0 2px 13px #3b0922!important;
}
#panel .player-result .balance-box small,
#panel .player-result .balance-box>span:not(:first-child){
  color:#fffaff!important;opacity:1!important;font-weight:750!important;font-size:10px!important;
}
#panel .player-result .balance-box[data-tone="low"] button{
  background:linear-gradient(110deg,#07573e,#0b7955)!important;
  border:1px solid #baffdf!important;color:#fff!important;
}
#panel .player-result .balance-box[data-tone="high"] button{
  background:linear-gradient(110deg,#7d2442,#a13858)!important;
  border:1px solid #ffcad6!important;color:#fff!important;
}
#panel .player-result .copy-player{
  background:linear-gradient(105deg,#ffe7ba 0%,#ffd3bd 46%,#f9afd8 100%)!important;
  color:#3c214a!important;border:1px solid #fff1de!important;
  font-size:12px!important;font-weight:950!important;
  padding:12px!important;border-radius:12px!important;
  box-shadow:0 5px 17px #1710368a,inset 0 1px #fff!important;
}
#panel .actions button,#panel #account-retry,#panel #account-view,
#panel #account-reopen,#panel #scan,#panel #account .finished-actions button{
  background:linear-gradient(112deg,#ac55e1,#8052df 56%,#6c42b7)!important;
  color:#fffaff!important;border:1px solid #f4caff!important;
  border-radius:12px!important;font-size:11.6px!important;font-weight:850!important;
  padding:11px 13px!important;
  box-shadow:0 5px 17px #1b1044a3,inset 0 1px #ffffff5e!important;
}
#panel button:not(:disabled){transition:filter .17s,transform .17s,box-shadow .17s!important}
#panel button:not(:disabled):hover{
  transform:translateY(-1px)!important;filter:brightness(1.10) saturate(1.08)!important;
}
#panel button:focus-visible{outline:2px solid #ffdfbd!important;outline-offset:2px!important}
#panel button:disabled{opacity:.65!important}
#panel .body>details,#panel .card{
  background:linear-gradient(130deg,#292650,#1d224a)!important;
  border:1px solid #b99be5!important;border-radius:13px!important;
  color:#fff9ff!important;
}
#panel .body>details>summary,#panel .card strong,#panel .card b{
  color:#ffe3b7!important;font-weight:850!important;
}
#panel .body>details p,#panel .card p,#panel .card small{
  color:#f7ecff!important;opacity:1!important;
}
#panel input,#panel select{
  background:#141b40!important;color:#fff7ff!important;
  border:1px solid #b99cee!important;border-radius:10px!important;
}
#panel input::placeholder{color:#dfd0f1!important;opacity:1!important}
#panel #account[data-phase="finished"]{
  background:radial-gradient(circle at 50% 0%,#ca6af052,transparent 60%),
    linear-gradient(147deg,#302b67,#1c244c)!important;
  border:2px solid #f8cbf4!important;border-radius:19px!important;
  box-shadow:0 10px 28px #0b0d35bb,inset 0 1px #fff8!important;
}
#panel #account[data-phase="finished"] .finished-title{
  color:#fffaff!important;font-size:21px!important;font-weight:950!important;
  text-shadow:0 1px 9px #100c3b!important;
}
#panel #account[data-phase="finished"] .finished-eyebrow{
  color:#ffe7b9!important;font-weight:850!important;
}
#panel #account[data-phase="finished"]>p,
#panel #account[data-phase="finished"] .finished-foot{
  color:#f7efff!important;opacity:1!important;line-height:1.7!important;
  font-size:11px!important;font-weight:650!important;
}
#panel #account[data-phase="finished"] .finished-icon{
  color:#17523e!important;background:linear-gradient(145deg,#f0fff1,#a9edcf)!important;
  border:2px solid #deffea!important;
  box-shadow:0 0 0 7px #c5fff423,0 8px 20px #16103899!important;
}
/* Same mini bubble footprint on each platform, but a brilliant opal rim. */
#bubble{
  border:2px solid #ffe1f6!important;
  background:radial-gradient(circle at 22% 14%,#ffdeff93,transparent 43%),
    linear-gradient(145deg,#8e4bd3,#4d2f9a)!important;
  box-shadow:0 0 0 2px #e9b4ff75,0 0 20px #d277ffba,
    0 8px 24px #080923d6,inset 0 1px #ffffff9e!important;
}
#bubble::before{
  box-shadow:inset 0 0 10px #ffe9ffad!important;
}
#bubble[data-identity="match"]{
  border-color:#8bffd4!important;
  box-shadow:0 0 0 2px #8dffd775,0 0 22px #45ffc6b5,
    0 8px 22px #080923cc!important;
}
#bubble[data-identity="mismatch"]{
  border-color:#ff9eae!important;
  box-shadow:0 0 0 2px #ff9cb45a,0 0 20px #ff6b9b9c!important;
}
#bubble[data-identity="review"]{border-color:#ffdf91!important}
#bubble #count{background:#f15bac!important;color:#fff!important;border:1px solid #ffe1f3!important}
:host([data-chat-platform="livechat"]) #bubble{
  width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;
  max-width:48px!important;max-height:48px!important;
}
:host([data-chat-platform="chatgacor"]) #bubble{
  width:62px!important;height:62px!important;min-width:62px!important;min-height:62px!important;
  max-width:62px!important;max-height:62px!important;
}
:host([data-sidebar-open]) #panel{
  width:100%!important;max-width:100%!important;height:100%!important;max-height:100%!important;
}
:host([data-sidebar-open]) #bubble{display:none!important}
@media(max-width:440px){#panel{width:min(432px,calc(100vw - 12px))!important}}
@media(prefers-reduced-motion:reduce){#bubble,#panel button{animation:none!important;transition:none!important}}

</style>
  <section id="panel" hidden><header><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5h14v10H10l-5 4V5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 9h6M9 12h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span><div class="brand"><strong>Asisten Pribadi <span class="edition">2.73</span></strong><span class="brand-caption">CHAT ASSIST</span></div><button id="close" title="Kecilkan" aria-label="Kecilkan asisten">−</button></header><div class="body"><p id="status">Menunggu chat…</p><div id="account" hidden></div><div id="cards"></div><div class="actions"><button id="scan">↻ Baca ulang chat</button></div><details><summary>Opsi & pengaturan</summary><div class="actions"><button id="pause">Jeda</button><button id="clear">Bersihkan</button><button id="sound" aria-pressed="false">Suara: mati</button></div><p>Jika pesan member belum dikenali, isi selector CSS khusus baris pesan member. Selector harus membedakan member dari agen.</p><label>Selector pesan member<input id="member" placeholder="Otomatis berdasarkan penanda pengirim"></label><label>Selector pesan AI / agen (opsional)<input id="agent" placeholder="Penanda khusus pengirim AI / agen"></label><label>Selector area percakapan (opsional)<input id="scope" placeholder="Otomatis dari penanda Started - Today"></label><button id="save">Simpan pengaturan</button> <button id="restore">Tampilkan lagi pengingat selesai</button> <button id="position">Reset posisi bubble</button><small>LiveChat: membaca setelah Started - Today. ChatGacor: hanya membaca setelah Mulai - Hari ini di Chat saya dan Arsip; gulir ke pesan sebelumnya untuk melengkapi konteks. Jika belum terbaca, atur selector area dan pengirim di atas.</small></details></div></section><button id="bubble"><span class="bubble-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5h14v10H10l-5 4V5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 9h6M9 12h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span><span class="bubble-label">Asisten Pribadi<span>CHAT ASSIST</span></span><span id="count">0</span></button>`;
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
  function presentationCards(items){
    const taskNames={change:'ganti rekening / akun',deposit:'deposit',withdraw:'withdraw',password:'pemulihan password',username:'lupa User ID',scatter:'PL scatter',clarify:'pemulihan akun — pastikan kebutuhan'};
    const pending=items.filter(c=>taskNames[c.type]&&(c.type!=='clarify'||c.title==='PASTIKAN KEBUTUHAN AKUN')&&c.title!=='PERMINTAAN GANTI DIBATALKAN');
    const primary=pending[0];
    const secondary=items.filter(c=>!pending.includes(c)).slice().reverse().map(c=>{
      if(!primary||c.type!=='conduct')return c;
      return {...c,category:'CATATAN UCAPAN MEMBER',title:'Tetap tangani permintaan awal',tone:'waiting',body:'Prioritas: '+taskNames[primary.type]+'. Ikuti pengingat utama di atas dan tetap respons kebutuhan member. Ada makian / keluhan tambahan; permintaan awal belum ditandai selesai.'};
    });
    return [...pending,...secondary];
  }
  function render() {
    cards=cards.filter(c=>allowedTopics.has(c.type));
    const value = JSON.stringify({cards});
    if (value === lastRender) return;
    lastRender = value; $('cards').replaceChildren(); $('count').textContent = cards.length; $('bubble').dataset.unread=String(cards.length); $('bubble').setAttribute('aria-label','Pengingat: '+cards.length+' aktif. Alt Shift B untuk buka atau tutup.');
    const topicLabels={deposit:'Cek Deposit',withdraw:'Cek Withdraw',password:'Lupa Password',username:'Lupa Username'};
    const topics=[...new Set(cards.filter(c=>c.title!=='PERMINTAAN GANTI DIBATALKAN').map(c=>topicLabels[c.type]).filter(Boolean))];
    if(topics.length>1){const summary=document.createElement('div');summary.className='topic-summary';summary.textContent='Aktif: '+topics.join(' • ');$('cards').append(summary);}
    for (const c of presentationCards(cards)) {
      const box=document.createElement('div'); box.className='card'; box.dataset.tone=c.tone || 'ready';
      const category=document.createElement('div');category.className='category';category.textContent=c.category || 'PENGINGAT MEMBER';box.append(category);
      const title=document.createElement('b'); title.textContent=c.title;
      const body=document.createElement('p'); body.textContent=c.body;
      const quote=document.createElement('div'); quote.className='quote'; quote.textContent='Pesan: '+c.message;
      box.append(title,body);
      const extra=document.createElement('details');extra.className='aux-details';
      const extraTitle=document.createElement('summary');extraTitle.textContent='Pesan & opsi';extra.append(extraTitle,quote);
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
      const correct=document.createElement('button');correct.textContent='Koreksi maksud';correct.onclick=()=>{
        if(box.querySelector('.intent-correction'))return;
        const panel=document.createElement('div');panel.className='intent-correction';
        const select=document.createElement('select');select.setAttribute('aria-label','Pilih maksud member');
        for(const [value,label] of [['','Pilih maksud member…'],['deposit','Cek Deposit'],['withdraw','Cek Withdraw'],['username','Lupa Username'],['password','Lupa Password']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
        const save=document.createElement('button');save.textContent='Simpan koreksi';save.onclick=()=>{
          if(!select.value)return;
          const source=sources.get(c.signature),phrase=normalizeMemberLanguage(source?text(source):c.message).trim();if(!phrase)return;
          intentCorrections[phrase]=select.value.split(',');
          const entries=Object.entries(intentCorrections).slice(-100);intentCorrections=Object.fromEntries(entries);
          try{localStorage.setItem('lc-intent-corrections-v1',JSON.stringify(intentCorrections));}catch{setStatus('Koreksi hanya tersimpan sementara; penyimpanan browser penuh.');}
          cards=[];seen.clear();scan();
        };panel.append(select,save);box.append(panel);
      };
      const secondary=document.createElement('div');secondary.className='actions';secondary.append(jump,copy,correct);extra.append(secondary);
      actions.append(done);box.append(actions,extra);$('cards').append(box);
    }
  }
  function reset() { cancelAdminGroup();seen.clear(); sources.clear(); cards=[]; render();resetAccount(); }
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
    if(isChatGacor&&!$('panel').hidden){fitGacorSidebar();return;}
    if(!host.style.left)return;
    host.style.left=Math.max(8,Math.min(parseFloat(host.style.left)||8,innerWidth-host.offsetWidth-8))+'px';
    host.style.top=Math.max(8,Math.min(parseFloat(host.style.top)||8,innerHeight-host.offsetHeight-8))+'px';
  }
  function findStart(root) {
    const candidates=[...root.querySelectorAll('div,span,p,li,time,[role="separator"]')].filter(e=>{
      if(!visible(e)||excluded(e))return false;
      const s=text(e).replace(/[•·|]+/g,' ').replace(/\s+/g,' ').trim();
      if(s.length>95)return false;
      if(startRE.test(s))return true;
      // Chatgacor kadang memakai label tanggal 'Hari ini' tanpa kata Mulai.
      // Terima HANYA jika elemennya separator tanggal pada transkrip aktif.
      if(!isChatGacor||!/^(?:hari ini|today)$/i.test(s))return false;
      const tag=[e.className,e.getAttribute('data-testid'),e.getAttribute('role'),e.parentElement?.className].filter(x=>typeof x==='string').join(' ');
      return /date|tanggal|separator|divider|timeline|day[-_ ]?label/i.test(tag);
    });
    return candidates.filter(e=>!candidates.some(c=>c!==e&&e.contains(c))).pop()||null;
  }
  function inferScope(marker) {
    let p=marker?.parentElement;
    while(p && p!==document.body){
      const style=getComputedStyle(p);
      if (/(auto|scroll)/.test(style.overflowY) || p.getAttribute('role')==='log') return p;
      p=p.parentElement;
    }
    return null;
  }

  // ChatGacor adapter: reads the loaded transcript only; never clicks a chat,
  // sends messages, requests a read receipt, or reads the conversation list.
  const gacorRows='[data-message-id],[data-message-id],[data-testid="message"],[data-testid^="message-"],[data-sender-role],[data-sender-type],[data-sender-id],[data-direction],[data-is-mine],[data-from-me],.message,.message-row,.message-wrapper,.message-item,.chat-message,.chat-bubble,.message-content,.incoming,.outgoing,.inbound,.outbound';
  const gacorScopes='[role="log"],[data-testid="message-list"],[data-testid="chat-messages"],[data-testid="conversation-messages"],[data-testid="messages-container"],[data-testid="chat-history"],.chat-messages,.messages-container,.conversation-messages,.message-list,.messages-list,.chat-message-list,.chat-history,.conversation-body,.message-scroll';
  function gacorKind(e,scope){
    for(let p=e;p&&p!==scope;p=p.parentElement){
      if(p.matches('nav,aside,[role="navigation"],button,textarea,[contenteditable="true"]'))return 'unknown';
      const attrs=['data-sender-role','data-role','data-author-role','data-sender-type','data-author-type','data-message-author-type','data-message-type','data-direction','data-message-sender','data-origin','data-from'].map(k=>p.getAttribute(k)||'').join(' ');
      const tag=[attrs,p.getAttribute('data-testid'),typeof p.className==='string'?p.className:''].join(' ').replace(/([a-z])([A-Z])/g,'$1-$2');
      const has=word=>new RegExp('(?:^|[\\s_-])(?:'+word+')(?:$|[\\s_-])','i').test(tag);
      const mine=p.getAttribute('data-is-mine')??p.getAttribute('data-from-me');
      if(mine==='true'||mine==='1')return 'agent';
      if(mine==='false'||mine==='0')return 'member';
      if(has('system|note|internal|activity|notification|date-separator'))return 'unknown';
      if(has('agent|assistant|operator|admin|bot|outgoing|outbound|sent|self|mine|from-me'))return 'agent';
      if(has('visitor|customer|member|user|incoming|inbound|received|client|guest'))return 'member';
      if(p.matches(gacorRows)||/justify-|items-|self-|ml-auto|mr-auto|chat-(?:start|end)/i.test(String(p.className||''))){
        if(p.matches('.justify-end,.items-end,.self-end,.ml-auto,.text-right,.message-right,.chat-end,.from-me'))return 'agent';
        if(p.matches('.justify-start,.items-start,.self-start,.mr-auto,.text-left,.message-left,.chat-start,.from-them'))return 'member';
      }
    }
    return 'unknown';
  }
  function gacorScope(){
    const usable=e=>visible(e)&&!excluded(e)&&!e.closest('nav,aside,[role="navigation"]')&&e!==document.body&&!host.contains(e);
    const starts=e=>Boolean(findStart(e));
    const countMessages=e=>{
      const rows=[...e.querySelectorAll(gacorRows)].filter(usable);
      return Math.min(rows.length,25);
    };
    let options=[...document.querySelectorAll(gacorScopes)].filter(usable);
    // Jika nama kontainer berbeda pada versi Chatgacor tertentu, cari
    // pembungkus scroll yang berisi pesan dan tanggal 'Started - Today'.
    if(!options.length){
      const markers=[...document.querySelectorAll('div,span,p,li,time')].filter(e=>visible(e)&&!excluded(e)&&startRE.test(text(e))&&text(e).length<100);
      for(const marker of markers){
        let p=marker.parentElement;
        while(p&&p!==document.body){
          if(usable(p)&&/(auto|scroll)/.test(getComputedStyle(p).overflowY)){options.push(p);break;}
          p=p.parentElement;
        }
      }
    }
    if(!options.length){
      const rows=[...document.querySelectorAll(gacorRows)].filter(usable);
      for(const row of rows){
        for(let p=row.parentElement;p&&p!==document.body;p=p.parentElement){
          if(!usable(p))break;
          if(/auto|scroll/.test(getComputedStyle(p).overflowY)){options.push(p);break;}
        }
      }
    }
    options=[...new Set(options)].filter(usable);
    const ranked=options.map(e=>{
      const rect=e.getBoundingClientRect(),hasMarker=starts(e),rowCount=countMessages(e);
      const label=[e.id,typeof e.className==='string'?e.className:'',e.getAttribute('data-testid')].join(' ');
      const likely=/chat-messages|message-list|message-scroll|chat-history|conversation-messages|conversation-body/i.test(label);
      const hasList=e.querySelector('a[href*="/my-chats/"],a[href*="/archives/"],a[href*="/arsip/"]')!==null;
      const highContent=e.querySelector('textarea,[contenteditable="true"]')!==null;
      const score=(hasMarker?50:0)+(likely?18:0)+Math.min(rowCount,12)*2+(e.matches('[role="log"]')?18:0)-(hasList?28:0)-(highContent?8:0)-(rect.width<150?25:0);
      return {e,score,hasMarker,rowCount};
    }).filter(x=>x.score>=15&&(x.hasMarker||x.rowCount>0)).sort((a,b)=>b.score-a.score||a.e.getBoundingClientRect().width-b.e.getBoundingClientRect().width);
    if(!ranked.length)return null;
    // Bila ada dua kontainer calon chat dengan skor sama, jangan diam-diam
    // membaca daftar chat. Pilih yang punya marker; selain itu butuh unik.
    const best=ranked[0];
    const peers=ranked.filter(x=>x!==best&&Math.abs(x.score-best.score)<=2&&!x.e.contains(best.e)&&!best.e.contains(x.e));
    return peers.length?null:best.e;
  }
  function gacorVisualRows(scope,marker){
    const bounds=scope.getBoundingClientRect();
    const after=e=>!marker||(!e.contains(marker)&&!!(marker.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING));
    const painted=e=>{
      const cs=getComputedStyle(e),r=e.getBoundingClientRect(),bg=cs.backgroundColor;
      const hasPaint=bg&&bg!=='transparent'&&!/rgba\([^)]*,\s*0(?:\.0+)?\s*\)/.test(bg);
      const rounded=['borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius'].some(k=>parseFloat(cs[k])>=6);
      const t=String(e.innerText||'').trim();
      return hasPaint&&rounded&&r.width>=28&&r.height>=18&&r.width<bounds.width-8&&t.length<=3000;
    };
    const nodes=[...scope.querySelectorAll('div,p,li,article,section')].filter(e=>
      visible(e)&&!excluded(e)&&after(e)&&!e.closest('button,[role="button"],header,footer')&&
      text(e)&&!/^(?:\d{1,2}[.:]\d{2}(?:\s*[AP]M)?|hari ini|today)$/i.test(text(e))&&painted(e));
    const bubbles=nodes.filter(e=>!nodes.some(p=>p!==e&&p.contains(e)));
    return bubbles.map(e=>{
      let kind=gacorKind(e,scope);
      if(kind==='unknown'){
        const r=e.getBoundingClientRect(),left=r.left-bounds.left,right=bounds.right-r.right;
        // Sisi kiri biasanya pesan member. Jangan menebak pada bubble tengah.
        if(Math.abs(left-right)<18)return null;
        kind=left<right?'member':'agent';
      }
      return {e,kind};
    }).filter(Boolean);
  }
  function gacorMessageText(e){
    // Jangan menambahkan UI, tetapi buang header jam/tombol pada pembacaan.
    const value=String(e.innerText||e.textContent||'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
    return value.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!/^(?:\d{1,2}[.:]\d{2}(?::\d{2})?(?:\s*[AP]M)?|dibaca|terkirim|read|delivered)$/i.test(x)).join('\n').trim();
  }
  function gacorTranscript(scope,marker){
    const after=e=>!marker||(!e.contains(marker)&&!!(marker.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING));
    const structural=[...scope.querySelectorAll(gacorRows)].filter(e=>visible(e)&&!excluded(e)&&after(e)&&
      gacorMessageText(e)&&!e.closest('button,[role="button"],header,footer')&&e!==scope);
    // Elemen luar yang mengandung lebih dari satu pesan tidak boleh
    // dijadikan satu bubble. Pilih pembungkus pesan terdekat, bukan list.
    let rows=structural.filter(e=>!structural.some(p=>p!==e&&p.contains(e)));
    const children=e=>rows.filter(r=>r!==e&&e.contains(r));
    rows=rows.filter(e=>!children(e).length);
    rows=rows.map(e=>({e,kind:gacorKind(e,scope)})).filter(m=>m.kind!=='unknown');
    const visual=gacorVisualRows(scope,marker);
    for(const m of visual){
      if(rows.some(r=>r.e===m.e||r.e.contains(m.e)||m.e.contains(r.e)))continue;
      rows.push(m);
    }
    // Fallback terkontrol untuk elemen dengan alignment tetapi tanpa warna
    // (sebagian tema Chatgacor memakai bubble transparan).
    if(!rows.length){
      const aligned=[...scope.querySelectorAll('.justify-start,.justify-end,.chat-start,.chat-end,.message-left,.message-right,[data-is-mine],[data-from-me]')]
        .filter(e=>visible(e)&&!excluded(e)&&after(e)&&gacorMessageText(e)&&!e.closest('button,[role="button"]'));
      for(const e of aligned){
        const kind=gacorKind(e,scope);
        if(kind!=='unknown'&&!aligned.some(p=>p!==e&&p.contains(e)))rows.push({e,kind});
      }
    }
    rows.sort((a,b)=>a.e===b.e?0:(a.e.compareDocumentPosition(b.e)&Node.DOCUMENT_POSITION_FOLLOWING)?-1:1);
    // Dedup elemen berlapis (misalnya message-row + message-content)
    const clean=[];
    for(const m of rows){
      if(clean.some(p=>p.e===m.e||p.e.contains(m.e)||m.e.contains(p.e)))continue;
      clean.push({...m,text:gacorMessageText(m.e)});
    }
    return clean;
  }

  function senderKind(e, scope) {
    if(isChatGacor)return gacorKind(e,scope);
    for(let p=e;p && p!==scope;p=p.parentElement){
      const tag=[p.getAttribute('data-author-type'),p.getAttribute('data-sender-type'),p.getAttribute('data-message-author-type'),p.getAttribute('data-testid'),p.className].filter(x=>typeof x==='string').join(' ').toLowerCase();
      if (/(^|[\s_\-])(agent|operator|outgoing|system|bot)([\s_\-]|$)/.test(tag)) return 'agent';
      if (/(^|[\s_\-])(visitor|customer|member|incoming)([\s_\-]|$)/.test(tag)) return 'member';
    }
    return 'unknown';
  }
  // Pemantau khusus balasan selesai di Chatgacor. Tidak dipengaruhi mode
  // blok percakapan ataupun kunci hijau hasil pencocokan rekening.
  function watchSentCompletionOnChatgacor(){
    if(!isChatGacor||conversationDone()||!gacorPage())return false;
    try{
      const scope=cfg.scope?document.querySelector(cfg.scope):gacorScope();
      if(!scope||!visible(scope))return false;
      const marker=findStart(scope);
      if(!marker)return false;
      const transcript=gacorTranscript(scope,marker);
      if(!transcript.some(m=>m.kind==='agent'))return false;
      const messages=contextualMessages(transcript);
      const last=[...messages].reverse().find(m=>m.kind==='member'&&
        detectIntent(m.originalText||m.text||'').some(x=>x==='password'||x==='username'));
      if(!last)return false;
      const hint=detectIntent(last.originalText||last.text||'').includes('password')?'password':'username';
      const result=sentCompletion(freshCompletionMessages(messages),hint);
      if(!result)return false;
      selectionPins.delete(route);
      markConversationDone(result);
      return true;
    }catch(_){return false;}
  }
  function scan(){
    if(isChatGacor&&!host.isConnected)document.body.appendChild(host);
    const next=conversationRoute();
    const menu=isChatGacor?(gacorPage()?.section||location.pathname+location.search+location.hash):'';
    if(isChatGacor && lastGacorMenu!==null && menu!==lastGacorMenu){
      $('panel').hidden=true;
      fitGacorSidebar();
    }
    lastGacorMenu=menu;
    if(next!==route){archiveManualRoute=null;archiveInput.value='';manualEvidence=null;highlightedDraft=null;cancelAdminGroup();liveChatContext=null;clearTimeout(selectionTimer);route=next;baselineReady=false;reset();$('bubble').classList.remove('unread');}
    host.hidden=!isChatGacor&&!/^\/chats(?:\/|$)/.test(location.pathname)&&!isArchive();
    const inArchive=isChatGacor && isArchive();
    archiveForm.hidden=!inArchive;
    const needsChat=next.endsWith(':unselected');
    archiveButton.disabled=archiveInput.disabled=needsChat;
    archiveInput.placeholder=needsChat?'Pilih satu percakapan arsip':'Nomor rekening di arsip';
    if(host.hidden || paused) return;
    if(isChatGacor&&!gacorPage()){
      setStatus('Asisten aktif. Buka Chat saya atau Arsip untuk mengecek nomor rekening.');
      return;
    }
    // Tetap cek pesan yang DIKIRIM agen walaupun mode blok atau hijau aktif.
    if(!(isChatGacor&&isArchive())&&watchSentCompletionOnChatgacor())return;
    // Sebelumnya mode blok menghentikan scan. Sekarang pemindaian tetap
    // membaca seluruh pesan setelah penanda hari ini, termasuk koreksi terbaru.
    // Teks pilihan tetap dapat digunakan sebagai pencarian manual, bukan
    // pembatas pembacaan percakapan yang telah dimuat.
    if(isChatGacor&&!gacorPage()?.room&&!gacorScope()){
      if(archiveManualRoute===route)return;
      reset();setStatus((isArchive()?'Arsip':'Chat saya')+' • Buka percakapan untuk membaca pesan.');return;
    }
    liveChatContext=null;
    try{
      let scope=cfg.scope ? document.querySelector(cfg.scope) : null;
      if(cfg.scope && (!scope || !visible(scope))){if(archiveManualRoute===route)return;reset();setStatus('Area percakapan belum ditemukan. Periksa pengaturan.');return;}
      if(!isChatGacor&&isArchive()&&!scope){
        // Read only a single identified transcript, never the Archives list.
        const logs=[...document.querySelectorAll('[role="log"]')].filter(e=>visible(e)&&!excluded(e));
        if(logs.length===1)scope=logs[0];
      }
      if(isChatGacor&&!scope)scope=gacorScope();
      // Jangan mengambil penanda tanggal dari daftar chat, laporan, atau sidebar.
      const marker=isChatGacor&&isArchive()?null:findStart(scope || (isChatGacor?document.createElement('div'):document.body));
      if(!marker && !(isChatGacor&&isArchive()&&scope)){
        if(archiveManualRoute===route)return;
        if(manualEvidence?.route===route&&manualEvidence.messages?.length){
          drawAccount();setStatus('MODE BLOK AKTIF • Verifikasi memakai teks yang kamu sorot.');return;
        }
        if(getGreenLock()){setStatus(greenStatus());return;}reset();setStatus(isChatGacor?'Transkrip ditemukan, tetapi penanda Mulai - Hari ini / Started - Today belum termuat. Gulir ke awal percakapan hari ini lalu Baca ulang.':'Belum menemukan Started - Today. Gulir ke awal chat hari ini, lalu Baca ulang.');return;}
      scope=scope || (marker?inferScope(marker):null);
      if(!scope){reset();setStatus(isArchive()?'Archives aktif. Buka satu percakapan; jika belum terbaca, isi selector area percakapan pada pengaturan.':'Area chat belum dikenali. Isi selector area percakapan pada pengaturan.');return;}
      if(marker&&!scope.contains(marker)){cards=[];seen.clear();render();setStatus('Started - Today belum ditemukan di percakapan yang dipilih.');return;}
      const after=e=>!marker||(!e.contains(marker)&&!!(marker.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING));
      let candidates=[],agentRows=[],transcript=[];
      if(isChatGacor&&!cfg.member&&!cfg.agent){
        const rows=gacorTranscript(scope,marker);
        candidates=rows.filter(m=>m.kind==='member').map(m=>m.e);
        agentRows=rows.filter(m=>m.kind==='agent').map(m=>m.e);
        transcript=rows.map(({e,kind,text})=>({e,kind,text}));
      }else{
        const after=e=>!marker||(!e.contains(marker)&&!!(marker.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING));
        if(cfg.member){
          candidates=[...scope.querySelectorAll(cfg.member)].filter(e=>visible(e)&&!excluded(e)&&after(e));
          candidates=candidates.filter(e=>!candidates.some(p=>p!==e&&p.contains(e)));
        }else{
          candidates=[...scope.querySelectorAll('div,p,li,span')].filter(e=>visible(e)&&!excluded(e)&&after(e)&&senderKind(e,scope)==='member');
          candidates=candidates.filter(e=>!candidates.some(p=>p!==e&&p.contains(e)));
        }
        const agents=[...scope.querySelectorAll(cfg.agent||'div,p,li,span')]
          .filter(e=>visible(e)&&!excluded(e)&&after(e)&&!candidates.some(m=>m===e||m.contains(e)||e.contains(m))&&(cfg.agent||senderKind(e,scope)==='agent'));
        agentRows=agents.filter(e=>!agents.some(p=>p!==e&&p.contains(e)));
        transcript=[...candidates.map(e=>({e,kind:'member'})),...agentRows.map(e=>({e,kind:'agent'}))]
          .sort((a,b)=>(a.e.compareDocumentPosition(b.e)&Node.DOCUMENT_POSITION_FOLLOWING)?-1:1)
          .map(m=>({...m,text:m.e.innerText||''}));
      }
      if(!candidates.length){
        if(archiveManualRoute===route)return;
        if(manualEvidence?.route===route&&manualEvidence.messages?.length){
          drawAccount();setStatus('MODE BLOK AKTIF • Identitas dibaca dari teks yang kamu sorot.');return;
        }
        if(getGreenLock()){setStatus(greenStatus());return;}reset();setStatus('Area chat ditemukan, tetapi pengirim pesan member belum dikenali. Buka chat member dan klik Baca ulang.');return;
      }
      transcript=contextualMessages(transcript);
      const contextualText=new Map(transcript.map(m=>[m.e,m.text]));
      liveChatContext={route,scope,candidates,messages:transcript};
      if(archiveManualRoute!==route)syncAccount(liveChatContext.messages);
      if(getGreenLock()){drawAccount();setStatus(greenStatus());return;}
      const context = idContext(transcript);
      const uncertainty=null;
      const lastRecovery=[...transcript].reverse().find(m=>m.kind==='member'&&detectIntent(m.text).some(t=>t==='password'||t==='username'));
      const combinedRecovery=!uncertainty&&lastRecovery&&['password','username'].every(t=>detectIntent(lastRecovery.text).includes(t));
      if(combinedRecovery)cards=cards.filter(c=>c.type!=='username');
      cards=cards.filter(c=>c.type!=='clarify'&&!(uncertainty&&['password','username'].includes(c.type)));
      if(uncertainty&&!conversationDone()){
        const signature='clarify|'+uncertainty.title;
        sources.set(signature,candidates.at(-1));
        if(!completed().has(signature))cards.push({signature,type:'clarify',category:'BANTU PAHAMI MEMBER',tone:'review',...uncertainty,message:uncertainty.message.slice(0,240)});
      }
      const occurrences=new Map(); let added=false;
      for(const e of candidates){
        const message=contextualText.get(e)||text(e); if(!message)continue;
        const n=(occurrences.get(message)||0)+1;occurrences.set(message,n);
        const identity=e.getAttribute('data-message-id') || e.getAttribute('data-event-id') || message+'#'+n;
        for(const [type,re,title,body] of rules){
          if(!allowedTopics.has(type))continue;
          if(!re.test(message))continue;
          if(combinedRecovery&&type==='username')continue;
          if(uncertainty&&['password','username'].includes(type))continue;
          if(['password','username'].includes(type)&&isAccountFinished())continue;
          const signature=identity+'|'+type;
          sources.set(signature,e);
          if(completed().has(signature))continue;
          const advice = ['password','username'].includes(type)?recoveryAdvice(type,transcript):type==='change'?changeAdvice(transcript):(['deposit','withdraw'].includes(type)) ? contextualAdvice(type,context) : {title,body,category:'MAKSUD TERDETEKSI • '+(type==='scatter'?'PL SCATTER':type==='username'?'LUPA USER ID':'PASSWORD')};
          const existing=cards.find(c=>c.signature===signature);
          if(existing){ Object.assign(existing,advice); continue; }
          if(seen.has(signature))continue;
          // One current card per transaction topic; update it as conversation progresses.
          if(['deposit','withdraw','scatter','change'].includes(type)) cards=cards.filter(c=>c.type!==type);
          seen.add(signature);cards.push({signature,type,...advice,message:message.slice(0,240)});added=true;
        }
      }
      for(const card of cards) if(['deposit','withdraw'].includes(card.type)) Object.assign(card,contextualAdvice(card.type,context));
      for(const card of cards)if(['password','username'].includes(card.type))Object.assign(card,recoveryAdvice(card.type,transcript));
      for(const card of cards)if(card.type==='change')Object.assign(card,changeAdvice(transcript));
      if(accountState.record)drawAccount(); // update tanda merah saat member mengirim nama / bank baru
      cards=cards.slice(-30);render();
      if(added){
        $('bubble').classList.add('unread');
        if(baselineReady)playNotice();
      }
      baselineReady=true;
      if(conversationDone())setStatus(completedStatusText(conversationDone().type));
      else if(manualEvidence?.route===route&&manualEvidence.messages?.length)
        setStatus('MODE BLOK AKTIF • Nama, nomor rekening, dan bank hanya dibandingkan dari teks yang kamu blok.');
      else setStatus(`${isChatGacor?(isArchive()?'ChatGacor · Arsip':'ChatGacor · Chat saya'):isArchive()?'Archives':'Aktif'} • ${candidates.length} pesan member • ${agentRows.length} pesan AI/agen • ${isChatGacor&&isArchive()?"percakapan arsip":isChatGacor?"setelah Mulai - Hari ini":"mulai Started - Today"} • hanya chat yang sudah dimuat`);
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
  $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Lanjut':'Jeda';if(paused){cancelAdminGroup();cancelAccount();accountFingerprint='';if(accountState.phase==='loading'){accountState.phase='paused';accountState.message='Pencarian dijeda. Klik Lanjut untuk membaca kembali.';drawAccount();}setStatus('Pembacaan dijeda.');}else scan();};
  // MODE BLOK: pencarian teks setara Ctrl+F *di dalam blok yang diseleksi*; bukan membuka dialog browser.
  // Lampu hijau hanya bila nomor, nama lengkap, dan bank semuanya match.
  // No new buttons, containers, styles, or panel layout.
  // Mengambil HANYA bagian yang disorot dalam bubble pesan yang memang
  // terbaca di percakapan aktif, sambil mempertahankan role MEMBER/AGENT.
  // Jangan meminjam teks di luar seleksi walaupun berada dalam bubble sama.
  function selectionTranscriptFromDOM(selection){
    const ctx=liveChatContext;
    if(!ctx||ctx.route!==route||!ctx.messages?.length||selection.rangeCount!==1)return [];
    const highlight=selection.getRangeAt(0),chosen=[];
    for(const m of ctx.messages){
      if(!['member','agent'].includes(m.kind)||!m.e?.isConnected)continue;
      if(!highlight.intersectsNode(m.e))continue;
      const part=document.createRange();part.selectNodeContents(m.e);
      try{
        if(highlight.compareBoundaryPoints(Range.START_TO_START,part)>0){
          part.setStart(highlight.startContainer,highlight.startOffset);
        }
        if(highlight.compareBoundaryPoints(Range.END_TO_END,part)<0){
          part.setEnd(highlight.endContainer,highlight.endOffset);
        }
        // Range.toString() menyatukan teks di sekitar <br> tanpa baris baru.
        // Gunakan fragment terpilih agar label nama/nomor/bank tidak menyatu.
        const content=part.cloneContents();
        for(const br of content.querySelectorAll('br'))br.replaceWith('\n');
        const value=content.textContent.replace(/\u200B|\u200C|\u200D|\uFEFF/g,'').trim();
        if(value)chosen.push({kind:m.kind,text:value});
      }catch(_){/* virtualized DOM: fallback to selected plain text */}
    }
    return chosen;
  }
  function selectedTranscriptDraft(){
    const selection=window.getSelection();
    if(!selection||selection.isCollapsed||selection.rangeCount!==1)return null;
    const toEl=n=>n?.nodeType===1?n:n?.parentElement;
    const anchor=toEl(selection.anchorNode),focus=toEl(selection.focusNode);
    if(!anchor||!focus||host.contains(anchor)||host.contains(focus))return null;
    const text=String(selection.toString()||'').normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
    if(text.length<15||text.length>80000||!/[A-Za-z\p{L}]/u.test(text))return null;
    // A highlight of a single number is handled by the original number-selector.
    if(numberRuns(text).length===1&&text.length<100&&/^[+\d\s.,()\-/]+$/.test(text))return null;
    // Selected chat may contain compact "nama nomor bank" without labels.
    // Reject selections unrelated to identity/recovery; no sidebar selection.
    if(!numberRuns(text).length&&!/(?:rekening|norek|nomor|bank|jenis|atas\s+nama|nama|dana|ovo|gopay|bca|bni|bri|bsi|btn|mandiri|cimb|lupa|password|paswod|pasor|login|user\s*id|username)/i.test(text))return null;
    const ctx=liveChatContext;
    if(ctx?.route===route && ctx.scope &&
       (!ctx.scope.contains(anchor)||!ctx.scope.contains(focus)))return null;
    const messages=selectionTranscriptFromDOM(selection);
    return {route:conversationRoute(),text,ts:Date.now(),messages};
  }
  function captureHighlightedTranscript(){
    const draft=selectedTranscriptDraft();
    if(draft)highlightedDraft=draft;
    // A new, unrelated selection must not reuse an older highlighted chat.
    else if(window.getSelection()?.toString()?.trim())highlightedDraft=null;
  }
  // Otomatis setelah member/agent diblok dengan mouse/keyboard:
  // cari 3 identitas pada teks yang dipilih seperti Ctrl+F, tanpa dialog Find.
  // Hindari pencarian berulang untuk blok yang sama pada percakapan yang sama.
  let autoBlockTimer=null,autoBlockSignature='';
  function checkHighlightedTranscriptAutomatically(){
    const draft=highlightedDraft;
    if(!draft||draft.route!==route||paused)return;
    const blockMessages=draft.messages?.length?draft.messages:manualTranscriptMessages(draft.text);
    const parsed=extractAccounts(blockMessages);
    if(!parsed.strong.length&&!parsed.possible.length)return;
    const signature=draft.route+'|'+briefHash(draft.text)+'|'+blockMessages.map(m=>m.kind).join(',');
    if(signature===autoBlockSignature)return;
    clearTimeout(autoBlockTimer);
    autoBlockTimer=setTimeout(()=>{
      if(selectionDragging||paused||conversationRoute()!==draft.route||highlightedDraft?.text!==draft.text)return;
      autoBlockSignature=signature;
      startManualTranscriptComparison(draft);
    },280);
  }
  // The chat selection is normally lost on focusing the existing scan button.
  // Capture BEFORE pointerdown reaches the button; no new UI element is needed.
  $('scan').addEventListener('pointerdown',captureHighlightedTranscript,{capture:true});
  $('scan').addEventListener('mousedown',captureHighlightedTranscript,{capture:true});
  $('scan').addEventListener('touchstart',captureHighlightedTranscript,{capture:true,passive:true});
  function manualTranscriptMessages(raw){
    const cleaned=String(raw||'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'');
    const lines=cleaned.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const transcript=[];
    let currentRole='member',roleExplicit=false;
    const actorRE=/^(?:(?:\[)?(agent|admin|cs|customer\s+service|operator|staff|support|ai|bot|member|visitor|pengunjung|pelanggan|customer|user|anggota)(?:\])?)\s*[:|\-]\s*(.*)$/i;
    const actorAloneRE=/^(?:agent|admin|cs|customer\s+service|operator|staff|support|ai|bot|member|visitor|pengunjung|pelanggan|customer|user|anggota)$/i;
    // Unlabelled copied text: detect an AGENT requesting identity data, not
    // merely a member mentioning a bank or saying 'saya minta reset password'.
    const probableAgent=t=>{
      const hasField=/\b(?:nama\s+(?:rekening|rek|bank|pemilik|lengkap)|nomor\s+(?:rekening|rek)|no\.?\s*rek|norek|jenis\s*(?:bank|rekening)?|atas\s+nama|bank\s*(?:apa|yang\s+benar)?)\b/i.test(t);
      if(!hasField)return false;
      const polite=/\b(?:tolong|mohon|boleh|silakan|silahkan|coba|harap|kirim(?:kan)?|sebut(?:kan)?|ketik(?:kan)?|tulis(?:kan)?|berikan|infokan|informasikan|pastikan|minta\s+ulang)\b/i.test(t);
      const correction=/\b(?:yang\s+benar|yang\s+sesuai|tulis\s+ulang|ketik\s+ulang|ulangi|ulang\s+lagi|salah\s+ketik)\b/i.test(t);
      const shortQuestion=/^\s*(?:nama\s+(?:rekening|bank|pemilik)(?:nya)?|no\.?\s*rek(?:ening)?(?:nya)?|nomor\s+rekening(?:nya)?|bank(?:nya)?|jenis\s+bank(?:nya)?)\s*(?:apa|yang\s+benar)?\s*[?!.]*\s*$/i.test(t);
      // Kalimat member "nama rekening yang benar Rendi Azari" adalah jawaban,
      // bukan instruksi agent. Salah klasifikasi membuat nama koreksi hilang.
      const isMemberCorrection=/^\s*(?:maaf|ralat|koreksi|revisi|maksud\s+saya)\b/i.test(t)||
        /^\s*(?:nama(?:\s+rekening)?|bank|jenis\s+bank|atas\s+nama)\s+(?:yang\s+)?benar\s*(?:[:=]|adalah\s+)?\s*[\p{L}]{3}/iu.test(t)&&!/[?]\s*$/.test(t);
      if(isMemberCorrection)return false;
      const isImperative=/^\s*(?:tolong|mohon|boleh|silakan|silahkan|coba|harap|kirim(?:kan)?|sebut(?:kan)?|ketik(?:kan)?|tulis(?:kan)?|berikan|infokan|informasikan|pastikan|minta\s+ulang)\b/i.test(t);
      return (isImperative||shortQuestion||(correction&&/[?]\s*$/.test(t)))&&
        !/^\s*(?:saya|aku)\s+(?:minta|mau|ingin|perlu)\s+(?:reset|ganti|ubah)/i.test(t);
    };
    for(let line of lines){
      line=line.replace(/^(?:Today|Hari\s+ini|Started\s*[-–]\s*Today)\s*\d{1,2}:\d{2}(?::\d{2})?\s*/i,'')
        .replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*(?=(?:agent|admin|cs|member|visitor|pengunjung|pelanggan|customer|user)\b)/i,'');
      if(!line||/^(?:Started\s*[-–]\s*Today|Mulai\s*[-–]\s*Hari\s+ini|Hari ini|Today)$/i.test(line))continue;
      // Copying Chatgacor often includes timestamp-only or sender status lines.
      if(/^\[?\d{1,2}[:.]\d{2}(?::\d{2})?\]?\s*(?:am|pm|wib|wita|wit)?$/i.test(line))continue;
      const actor=line.match(actorRE);
      if(actor){currentRole=/^(?:agent|admin|cs|customer\s+service|operator|staff|support|ai|bot)$/i.test(actor[1])?'agent':'member';roleExplicit=true;line=actor[2].trim();if(!line)continue;}
      else if(actorAloneRE.test(line)){currentRole=/^(?:agent|admin|cs|customer\s+service|operator|staff|support|ai|bot)$/i.test(line)?'agent':'member';roleExplicit=true;continue;}
      const kind=roleExplicit?currentRole:(probableAgent(line)?'agent':'member');
      // Pair field label with its next answer even when Chatgacor inserts a line break.
      // E.g. "Nama rekening:" then "Muksalmina".
      const last=transcript[transcript.length-1];
      const labelOnly=last&&last.kind===kind&&/^(?:nama\s*(?:pemilik\s*)?(?:rek(?:ening)?|rekening)|atas\s+nama|jenis(?:\s+bank)?|nama\s+bank|bank|no\.?\s*(?:rek(?:ening)?|rekening)|nomor\s+rekening|norek|e[- ]?wallet)\s*[:=]?$/i.test(last.text.trim());
      if(labelOnly){last.text+='\n'+line;continue;}
      transcript.push({kind,text:line});
    }
    return transcript;
  }
  function manualRequestType(messages){
    const member=messages.filter(m=>m.kind==='member');
    const hit=[...member].reverse().find(m=>detectIntent(m.text).includes('username')||detectIntent(m.text).includes('password'));
    if(hit)return detectIntent(hit.text).includes('password')?'password':'username';
    return accountState.requestType==='username'?'username':accountState.requestType==='account'?'account':'password';
  }
  function startManualTranscriptComparison(draft){
    // Semua identitas untuk verifikasi hanya berasal dari BLOK pilihan user.
    // Gunakan role DOM bila tersedia; jangan menebak pesan agent sebagai member.
    let messages=draft.messages?.length?draft.messages.map(m=>({kind:m.kind,text:m.text})):
      manualTranscriptMessages(draft.text);
    const lock=getGreenLock();
    if(lock){
      // Jika seluruh chat diblok dan terdapat dua permintaan pemulihan,
      // gunakan HANYA bagian sejak permintaan TERAKHIR untuk rekening baru.
      const requests=messages.map((m,i)=>({m,i})).filter(({m})=>m.kind==='member'&&
        detectIntent(m.text).some(t=>t==='password'||t==='username'));
      if(requests.length>=2){
        const recent=messages.slice(requests[requests.length-1].i);
        const found=extractAccounts(recent);
        const nums=[...new Set([...found.strong,...found.possible])];
        if(nums.length===1&&nums[0]!==lock.number)messages=recent;
      }
      const accounts=extractAccounts(messages),numbers=[...new Set([...accounts.strong,...accounts.possible])];
      const recovery=messages.some(m=>m.kind==='member'&&detectIntent(m.text).some(t=>t==='password'||t==='username'));
      const differentSelection=briefHash(messages.map(m=>m.text).join('\n'))!==lock.selectionHash;
      // A separate highlighted recovery request and a new account number are
      // required. Merely selecting names/banks again never reopens the lookup.
      const newNumber=numbers.length===1&&numbers[0]!==lock.number;
      // A same-number repeat must be provably newer in the live chat.
      const freshInLive=liveChatContext?.route===route?
        newerRequestWithNewData(liveChatContext.messages,lock):null;
      const provenRepeat=!!freshInLive&&freshInLive.number===numbers[0];
      // An explicit selection of the SAME account is a request to re-compare
      // the selected evidence, NOT to search the admin again. Older versions
      // wrongly refused such highlights once the bubble had turned green.
      if(numbers.length===1&&numbers[0]===lock.number&&!provenRepeat){
        if((accountState.number!==lock.number||!accountState.record)&&!restoreAccountResult(lock.number)){
          // No cached record: continue with the normal lookup below.
        }else{
          manualEvidence={route,messages};highlightedDraft=null;
          accountShowResult=true;accountLastRender='';
          const rechecked=compareChatAdmin(messages,lock.number,accountState.record);
          if(rechecked?.state!=='match')setGreenLock(null);
          $('panel').hidden=false;drawAccount();
          setStatus('BLOK DIPERIKSA ULANG • Rekening sama, tanpa pencarian admin baru.');
          clampPosition();return;
        }
      }
      if(!recovery||!differentSelection||(!newNumber&&!provenRepeat)||numbers.length!==1){
        if(accountState.number!==lock.number||!accountState.record)restoreAccountResult(lock.number);
        setStatus(greenStatus());$('panel').hidden=false;drawAccount();return;
      }
      clearGreenLockForNewRequest({requestType:manualRequestType(messages)});
    }
    const parsed=extractAccounts(messages);
    const choices=[...new Set([...parsed.strong,...parsed.possible])];
    // Store only the parsed messages in RAM; no clipboard, remote AI call, or persistent chat log.
    manualEvidence={route,messages};highlightedDraft=null;
    cancelAccount();accountShowResult=true;
    accountFingerprint='';
    const requestType=manualRequestType(messages);
    accountState={active:true,options:choices,requestType,number:'',record:null,phase:'idle',now:'Belum dicek',old:'Menunggu hasil Now',message:''};
    $('panel').hidden=false;
    if(!choices.length){
      accountState.message='Teks yang diblok sudah dibaca, tetapi nomor rekening 5–25 digit belum teridentifikasi. Pastikan kamu ikut memblok pesan nomor rekening, nama, dan bank.';
      drawAccount();setStatus('Mode blok chat aktif · nomor rekening belum terbaca.');
    }else if(choices.length>1){
      accountState.message='Ada '+choices.length+' calon nomor rekening dalam teks yang diblok. Pilih "Cek" pada nomor yang benar; rekening lama dan baru tidak digabung.';
      drawAccount();setStatus('Blok terbaca: '+choices.length+' nomor rekening. Pilih satu nomor di panel; identitas tiap rekening tidak boleh tertukar.');
    }else{
      accountState.number=choices[0];
      const extracted=chatFieldsForAccount(recoveryData(messages),choices[0]);
      const shownName=extracted.holder.length===1?extracted.holder[0]:'belum jelas';
      const shownBank=extracted.bank.length===1?displayBank(extracted.bank[0]):'belum jelas';
      const summary='BLOK TERBACA • Rek: '+choices[0]+' • Nama: '+shownName+' • Bank: '+shownBank;
      accountState.message=summary+'. Sedang dicocokkan dengan admin NOW/OLD.';
      drawAccount();
      const existing=cachedAccount(choices[0]);
      if(existing?.record && existing.phase==='done' &&
         Date.now()-(existing.savedAt||0)<15*60*1000){
        // The admin has already been searched automatically. Reuse its result,
        // but ALWAYS recompare against this new selection from the user.
        accountState={...existing,active:true,completed:false,conversationCompleted:false};
        accountShowResult=true;accountLastRender='';drawAccount();
        setStatus(summary+' • Dibandingkan dengan hasil admin NOW/OLD yang sudah ditemukan.');
      }else{
        setStatus(summary+' • Mencari di admin…');
        runAccount(choices[0],true);
      }
    }
    clampPosition();
  }
  $('scan').onclick=()=>{
    const draft=selectedTranscriptDraft() ||
      (highlightedDraft?.route===conversationRoute()&&Date.now()-highlightedDraft.ts<15000?highlightedDraft:null);
    if(draft && draft.route===route){startManualTranscriptComparison(draft);return;}
    manualEvidence=null;highlightedDraft=null;
    baselineReady=false;reset();scan();
  };
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
      if(isChatGacor&&!$('panel').hidden)return;
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
    if(!context||context.route!==route||conversationRoute()!==route||paused||!selection||selection.isCollapsed||selection.rangeCount!==1)return '';
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
    if(getGreenLock())return; // Only a fresh recovery request with new details unlocks verified data.
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
    const chat=conversationRoute();
    selectionTimer=setTimeout(()=>{if(chat===conversationRoute()&&chat===route)checkSelectedAccount();},450);
  }
  document.addEventListener('selectionchange',scheduleSelectedAccount);
  document.addEventListener('pointerdown',e=>{
    if(e.composedPath().includes(host))return;
    selectionDragging=true;clearTimeout(selectionTimer);
  },true);
  document.addEventListener('pointerup',e=>{selectionDragging=false;if(e.composedPath().includes(host))return;captureHighlightedTranscript();checkHighlightedTranscriptAutomatically();scheduleSelectedAccount();},true);
  document.addEventListener('pointercancel',()=>{selectionDragging=false;clearTimeout(selectionTimer);},true);
  document.addEventListener('keydown',e=>{if(e.key==='Shift'){selectionKeyboard=true;clearTimeout(selectionTimer);}},true);
  document.addEventListener('keyup',e=>{if(e.key==='Shift')selectionKeyboard=false;if(e.key==='Shift'||e.key.startsWith('Arrow')){captureHighlightedTranscript();checkHighlightedTranscriptAutomatically();scheduleSelectedAccount();}},true);
  window.addEventListener('blur',()=>{selectionDragging=false;selectionKeyboard=false;clearTimeout(selectionTimer);});

  let lastGacorMenu=null;
  let archiveManualRoute=null;
  const archiveForm=document.createElement('form');
  archiveForm.hidden=true;
  const archiveInput=document.createElement('input');
  archiveInput.type='text';
  archiveInput.inputMode='numeric';
  archiveInput.placeholder='Nomor rekening di arsip';
  archiveInput.setAttribute('aria-label',archiveInput.placeholder);
  const archiveButton=document.createElement('button');
  archiveButton.type='submit';
  archiveButton.textContent='Cek norek';
  archiveForm.append(archiveInput,archiveButton);
  $('account').before(archiveForm);
  archiveForm.onsubmit=event=>{
    event.preventDefault();
    if(paused||route!==conversationRoute()||archiveForm.hidden||archiveButton.disabled)return;
    const number=cleanAccount(archiveInput.value);
    if(!accountNumberRE.test(number)){setStatus('Isi nomor rekening 5–25 digit.');return;}
    archiveManualRoute=route;
    accountState.active=true;
    accountState.requestType='account';
    void runAccount(number,true);
  };
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(scan,250);};
  new MutationObserver(records=>{if(records.some(r=>!host.contains(r.target)))schedule();}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-sender-role','data-sender-type','data-direction','data-message-id']});
  setInterval(scan,1800);window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);scan();

  // Open the assistant inside the right contact column. Reader logic is unchanged.
  function fitGacorSidebar(){
    if(!isChatGacor)return;
    if($('panel').hidden){
      if(host.hasAttribute('data-sidebar-open')){
        host.removeAttribute('data-sidebar-open');
        for(const k of ['width','height','max-width','max-height','left','top'])host.style.removeProperty(k);
        host.style.right='22px';host.style.bottom='24px';
      }
      return;
    }
    const options=[...document.querySelectorAll('aside,section,div')].filter(e=>{
      if(e===host||host.contains(e))return false;
      const r=e.getBoundingClientRect();
      if(r.left<innerWidth*.65||r.width<200||r.width>480||r.height<innerHeight*.5||!visible(e))return false;
      const t=e.innerText||'';
      return /\bKONTAK\b/i.test(t)&&/\bPERCAKAPAN\b/i.test(t);
    });
    options.sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height);
    const r=options[0]?.getBoundingClientRect();
    const gap=8;
    const left=r?Math.max(gap,r.left+gap):Math.max(gap,innerWidth-328);
    const top=r?Math.max(gap,r.top+gap):gap;
    const width=Math.max(1,Math.min(r?r.width-gap*2:320,innerWidth-left-gap));
    const bottom=r?Math.min(innerHeight-gap,r.bottom-gap):innerHeight-gap;
    const height=Math.max(1,bottom-top);
    host.setAttribute('data-sidebar-open','');
    Object.assign(host.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px',right:'auto',bottom:'auto'});
  }
  if(isChatGacor){
    new MutationObserver(fitGacorSidebar).observe($('panel'),{attributes:true,attributeFilter:['hidden']});
    window.addEventListener('resize',fitGacorSidebar);
    setInterval(fitGacorSidebar,1500);
    fitGacorSidebar();
  }
})();
