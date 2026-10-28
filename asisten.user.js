// ==UserScript==
// @name         LiveChat • Pengingat Member
// @namespace    local.livechat.pengingat
// @version      2.68.0
// @description  Pengingat lokal dari pesan member setelah Started - Today. Tidak mengirim chat atau mengubah akun.
// @match        https://my.livechatinc.com/*
// @match        https://agwl2.admitoto.com/agentplayerlist.php*
// @match        https://agwl2.admitoto.com/agentplayerlist_old.php*
// @match        https://agwl2.admitoto.com/editplayerlist.php*
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      agwl2.admitoto.com
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  if(window.top!==window.self)return;
  if (document.getElementById('lc-pengingat-bosku')) return;
  const isArchive=()=>/^\/archives?(?:\/|$)/.test(location.pathname);
  const conversationRoute=()=>location.pathname+(isArchive()?location.search+location.hash:'');
  const allowedTopics=new Set(['deposit','withdraw','username','password','blocked']);
  let intentCorrections={};
  try{const saved=JSON.parse(localStorage.getItem('lc-intent-corrections-v1')||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))intentCorrections=saved;}catch{}
  function normalizeMemberLanguage(value){
    return String(value||'').normalize('NFKC').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g,'')
      .replace(/\b(?:lupaa+|lupah|lupaak)\b/g,'lupa')
      .replace(/\b(?:pasword|paswrod|pasworrd|paswod|paswrd|passwordnya|passwordku|pwku|pwnya)\b/g,'password')
      .replace(/\b(?:usernam|usernme|usernem|usernamenya|usernameku|useridnya|idnya)\b/g,'username')
      .replace(/\b(?:diblok|keblok|ke blok|di blok|terblok|teblokir|terblokirr+|keblokir|di blokir)\b/g,'diblokir')
      .replace(/\b(?:akunku|akunnya)\b/g,'akun').replace(/\b(?:ke\s*kunci|di\s*kunci)\b/g,'terkunci')
      .replace(/\b(?:blom|blum|belom|belim|blm|blum)\b/g,'belum')
      .replace(/\b(?:msk|masok)\b/g,'masuk')
      .replace(/\b(?:ggnti|gganti|gnti|gnt|gntii|gantii|gantiin)\b/g,'ganti')
      .replace(/\b(?:menggnti|menganti)\b/g,'mengganti')
      .replace(/\b(?:nmr|nomer)\b/g,'nomor')
      .replace(/\b(?:no\.?\s*rek|no\.?\s*rekening|norek|no rekning)\b/g,'nomor rekening')
      .replace(/\b(?:rekning|rekenig|rekeningnya|reknya)\b/g,'rekening')
      .replace(/\b(?:yg)\b/g,'yang').replace(/\b(?:udh|udah|sdh)\b/g,'sudah');
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
    if(Array.isArray(correction)){const enabled=correction.filter(t=>allowedTopics.has(t));if(enabled.length)return [...new Set(enabled)];}
    const t=normalizeMemberLanguage(value)
      .replace(/\b(?:lp|lpa|lup)\b(?=[^.!?\n]{0,50}\b(?:id|akun|user(?:name)?|pw|pass?word|pasword|sandi)\b)/g,'lupa')
      .replace(/\b(?:sm|sma)\b/g,'sama')
      .replace(/\b(?:gak|ga|nggak|ngga|enggak|gk|tdk|tak)\b/g,'tidak')
      .replace(/\b(?:blm|blum|belom|belim|blom)\b/g,'belum').replace(/\b(?:msk|masukkk|masok)\b/g,'masuk').replace(/\budah\b/g,'sudah')
      .replace(/\blupa\s*(?:pass?word|pasword|pw)\b/g,'lupa password').replace(/\b(?:pw|pass|pasword|paswod|paswrd|pasworrd|pasw[oa]rd)\b/g,'password')
      .replace(/\b(?:uname|userid|user\s+name)\b/g,'username').replace(/\b(?:depo|dp)\b/g,'deposit')
      .replace(/\b(?:wd|wede|withd(?:r)?aw|withdrawal)\b/g,'withdraw').replace(/\b(?:topup|top-up)\b/g,'top up');
    const types=new Set();
    if(wantsAccountChange(value))types.add('change');
    // Negated topics and resolved reports must not become a fresh recovery request.
    const parts=t.split(/[,.!?;\n]+|\btapi\b|\btetapi\b|\bmelainkan\b|\bdan\s+(?=(?:proses|deposit|withdraw|lupa)\b)|\bterus\b/);
    for(let part of parts){
      part=part.trim();
      if(!part || /\b(?:bukan|tidak perlu|tidak lupa|tidak salah|jangan)\b/.test(part))continue;
      if(/\b(?:scatter|scater|skater|skatter)\b/.test(part))types.add('scatter');
      if(/\b(?:akun|account|user\s*id|username|id)\b/.test(part)&&/\b(?:di\s*blok(?:ir)?|terblokir|keblokir|ke\s*blok|blokir|kena\s*blok|blocked|banned|suspend(?:ed)?|terkunci|di\s*lock|locked)\b/.test(part)&&! /\b(?:akun\s+(?:bank|dana|ovo)|rekening|norek|tidak\s+(?:di\s*blok(?:ir)?|terblokir|terkunci|banned|blocked)|sudah\s+(?:dibuka|normal))\b/.test(part))types.add('blocked');
      const unresolved=/\b(?:belum|tidak|lupa|salah|gagal|pending|tertunda|nyangkut|hilang|reset|ganti|ubah|cek|tolong|bantu)\b/.test(part);
      if(!unresolved && /\b(?:sudah|berhasil|selesai|sukses)\b/.test(part))continue;
      const recovery=/\b(?:lupa|tidak ingat|tidak inget|tidak hafal|tidak tahu|tidak tau|hilang|reset|riset|ganti|ubah|salah|invalid)\b/;
      if(/\b(?:password|kata sandi|sandi)\b/.test(part)&&recovery.test(part))types.add('password');
      if((/\b(?:username|user name|user\s*id|nama (?:akun|pengguna)|id akun)\b/.test(part)&&recovery.test(part))||/\blupa\s+(?:akun|id)\b/.test(part))types.add('username');
      if(/\b(?:deposit|top up|isi saldo|setor(?:an)?)\b/.test(part))types.add('deposit');
      else if(/\b(?:saldo|transfer|tf)\b/.test(part)&&/\b(?:belum masuk|tidak masuk|belum bertambah|tidak bertambah|nyangkut)\b/.test(part)&&! /\b(?:withdraw|penarikan|tarik)\b/.test(part))types.add('deposit');
      if(/\b(?:withdraw|penarikan|tarik (?:dana|saldo|uang))\b/.test(part))types.add('withdraw');
    }
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
    ['blocked',intentMatcher('blocked'),'MINTA USER ID','Periksa User ID yang sudah diberikan member sebelum meminta ulang.'],
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
    const category = type==='blocked'?'AKUN DIBLOKIR • CEK USER ID':type === 'deposit' ? 'CEK DEPOSIT' : 'CEK WITHDRAW';
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
      title=type==='blocked'?'MINTA USER ID MEMBER':'CEK USER ID TERLEBIH DAHULU'; tone='review';
      body='User ID belum terdeteksi pada chat yang terbaca. Cek chat di atas terlebih dahulu; jika memang belum ada dan belum diminta, baru minta User ID ya bosku.';
    }
    if (type==='deposit') body+=' Untuk deposit, cek bukti di atas; jika belum dikirim, minta bukti deposit ya bosku.';
    else if(type==='blocked')body+=' Periksa status akun memakai User ID tersebut. Akun diblokir bukan otomatis lupa password; jangan arahkan reset tanpa permintaan yang jelas.';
    else body+=' Lanjutkan pengecekan withdraw setelah User ID dipastikan.';
    return {category,title,body,tone};
  }
  // v2: read-only account lookup. No password change or registration requests.
  const ADMIN_ORIGIN = 'https://agwl2.admitoto.com';
  const ADMIN_PATHS = ['/agentplayerlist.php','/agentplayerlist_old.php'];
  const resetIntent = intentMatcher('password');
  const accountLabel = /(?:nomor\s*rekening|no\.?\s*(?:rekening|rek)\b|norek\b|rekening\b|account\s*(?:number|no\.?))/i;

  if(location.origin===ADMIN_ORIGIN){void runProfileWorker();return;}

  const usernameIntent=intentMatcher('username');
  // Inspect sent agent messages only; never retain the password value.
  function sentCompletion(messages,fallbackRequest=''){
    let request=['password','username'].includes(fallbackRequest)?fallbackRequest:'',complete='',agentParts=[];
    for(const m of messages){
      if(m.kind==='member'){
        agentParts=[];
        if(resetIntent.test(m.text)){request='password';complete='';}
        else if(usernameIntent.test(m.text)){request='username';complete='';}
        continue;
      }
      if(m.kind!=='agent'||!request){agentParts=[];continue;}
      const part=String(m.text||'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\u00a0/g,' ').replace(/[*_`]/g,'');
      if(/\b(?:contoh\s+(?:format|pesan|template)|jangan\s+(?:kirim|dikirim))\b/i.test(part)){agentParts=[];continue;}
      // Support a sent template split into several consecutive agent bubbles.
      // A newly started User ID block supersedes any earlier incomplete one.
      if(/\buser\s*id\s*:/i.test(part))agentParts=[];
      agentParts.push(part);if(agentParts.length>6)agentParts.shift();
      const t=agentParts.join('\n');
      const uid=t.match(/\buser\s*id\s*:\s*([a-z0-9.-]{1,40})(?![a-z0-9.-])/i);
      if(!uid||/^(?:password|pasword|note|silahkan|silakan|userid|username)$/i.test(uid[1]))continue;
      const note=/\bnote\s*:[\s\S]*saran\s+kami[\s\S]*di\s*simpan[\s\S]*memo\s+anda/i.test(t);
      const password=t.match(/\bpass?word\s*:\s*([^\s:]+)/i);
      const hasPassword=Boolean(password&&!/^(?:note|silahkan|silakan)$/i.test(password[1]));
      const login=/silah?kan|silahkan/i.test(t)&&/coba\s+login/i.test(t);
      if(request==='password'&&hasPassword&&(note||login))complete='password';
      if(request==='username'&&!/\bpass?word\s*:/i.test(t)&&note)complete='username';
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
    const strong=new Set(),possible=new Set();let requested=false,userIdReply=false;
    for(const m of messages){
      if(m.kind==='agent')userIdReply=/user\s*id|username/i.test(m.text)&&/minta|mohon|tolong|kirim|sebut|berikan|info|berapa/i.test(m.text)&&!accountLabel.test(m.text);
      if(m.kind==='agent' && accountLabel.test(m.text) && /minta|mohon|tolong|kirim|sebut|berikan|info|berapa/i.test(m.text)){requested=true;continue;}
      if(m.kind!=='member')continue;
      const isUserId=userIdReply&&/^\s*\d{3,40}\s*$/.test(m.text);userIdReply=false;if(isUserId)continue;
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
  function recoveryData(messages){
    const names=new Set(),banks=new Set(),requested=new Set();let pending=[];
    const bankRE=/\b(?:bca|bri|bni|bsi|cimb(?: niaga)?|mandiri|danamon|maybank|(?:bank )?jago|seabank|sea bank|dana|ovo|gopay|go pay|link\s*aja)\b/ig;
    const holderRE=/\b(?:nama\s*(?:pemilik\s*)?rek(?:ening)?|atas\s+nama|a\/?n)\b\s*(?:saya|nya)?\s*[:=\-]?\s*(.*)/i;
    const validName=t=>/^[\p{L}][\p{L} .'-]{1,79}$/u.test(t)&&!/(?:lupa|belum|tidak|gak|saya|aku|tolong|minta|terblokir|hilang|kenapa|saldo|masuk|iya|oke|bosku|password|rekening|username)/i.test(t);
    const fields=t=>{
      const result=[];
      if(/\b(?:nomor\s*rek(?:ening)?|no\.?\s*rek(?:ening)?|norek)\b/i.test(t))result.push('number');
      if(/nama\s*(?:pemilik\s*)?rek(?:ening)?|atas nama|\ba\/?n\b/i.test(t))result.push('holder');
      if(/\b(?:bank|e[- ]?wallet)\b/i.test(t))result.push('bank');return result;
    };
    for(const m of messages){
      const t=m.text.trim();
      if(m.kind==='agent'){
        if(/\b(?:minta|mohon|tolong|kirim|kirimkan|berikan|sebutkan|infokan|informasikan|berapa|apa|boleh)\b/i.test(t)){
          const f=fields(t);if(f.length){f.forEach(x=>requested.add(x));pending=f;}
        }continue;
      }
      if(m.kind!=='member')continue;
      const lines=t.split(/[\n;]+/);
      for(let i=0;i<lines.length;i++){
        const line=lines[i],match=line.match(holderRE);
        if(match){const value=(match[1].trim()||lines[i+1]||'').split(/\b(?:nomor rekening|no\.?\s*rek(?:ening)?|norek|jenis bank|bank|user\s*id|username)\b|[,;]/i)[0].trim();if(validName(value))names.add(value);}
        // Bank names only from a stated field, a standalone bank, or structured data.
        if(/^\s*(?:jenis\s+)?bank\b|e[- ]?wallet\s*[:=]/i.test(line)||/^[a-z ]{2,20}$/i.test(line.trim())||/\d{5}|[,;]/.test(line)){
          for(const b of line.matchAll(bankRE)){
            if(/\b(?:mau|ganti|pindah|bukan|jangan)\b/i.test(line))continue;
            if(b[0].toLowerCase()==='dana'&&!/^\s*(?:(?:jenis\s+)?bank\s*[:=]?\s*)?dana\s*(?:$|[,;:\d])/i.test(line))continue;
            banks.add(b[0].toUpperCase().replace(/^BANK /,'').replace('SEA BANK','SEABANK').replace('GO PAY','GOPAY'));
          }
        }
        const combined=line.split(',').map(x=>x.trim());
        if(combined.length===3&&bankRE.test(combined[0])&&/^\d{5,25}$/.test(cleanAccount(combined[2]))&&validName(combined[1]))names.add(combined[1]);
        bankRE.lastIndex=0;
      }
      if(pending.length===1&&pending[0]==='holder'&&validName(t))names.add(t);
      pending=[];
    }
    const accounts=extractAccounts(messages);
    return {number:[...new Set([...accounts.strong,...accounts.possible])],holder:[...names],bank:[...banks],requested};
  }
  function recoveryAdvice(type,messages){
    const latest=[...messages].reverse().find(m=>m.kind==='member'&&detectIntent(m.text).some(t=>t==='password'||t==='username'));
    const both=latest&&['password','username'].every(t=>detectIntent(latest.text).includes(t));
    const locked=accountState.active&&accountState.record?.lock?accountState.record:null;
    if(locked)return {category:'PEMULIHAN AKUN • GEMBOK TERDETEKSI',title:'PERIKSA STATUS AKUN TERKUNCI',body:'User ID: '+locked.userid+'\nStatus terbaca: '+(locked.profile?.status||'Belum berhasil dibaca')+'\nInformation: '+(locked.profile?.information||locked.profileError||'Lihat panel hasil rekening.')+'\nPeriksa keterangan admin sebelum melanjutkan. '+(type==='username'?'Permintaan hanya User ID; jangan reset password.':'Jangan menganggap reset password akan membuka kunci akun.'),tone:'review'};
    const data=recoveryData(messages),labels={number:'Nomor rekening',holder:'Nama rekening',bank:'Jenis bank / e-wallet'};
    const present=Object.keys(labels).filter(k=>data[k].length),missing=Object.keys(labels).filter(k=>!data[k].length);
    const ambiguous=present.some(k=>data[k].length>1);
    const lines=present.map(k=>labels[k]+': '+data[k].join(' / '));
    const waiting=missing.filter(k=>data.requested.has(k)),ask=missing.filter(k=>!data.requested.has(k));
    let title=ambiguous?'ADA BEBERAPA DATA — COCOKKAN DULU':!missing.length?'DATA MEMBER SUDAH ADA':ask.length?'MINTA BAGIAN YANG MASIH KURANG':'DATA SUDAH DIMINTA — TUNGGU JAWABAN';
    if(lines.length)lines.push('Jangan minta ulang data yang sudah tercantum. Cocokkan dengan hasil admin.');
    if(ambiguous)lines.push('Ada beberapa nilai di percakapan. Pastikan data mana yang digunakan; jangan menganggap semuanya satu rekening.');
    if(waiting.length)lines.push('Sudah diminta AI / agen: '+waiting.map(k=>labels[k]).join(', ')+'. Cek atau tunggu jawabannya; jangan minta ulang.');
    if(ask.length)lines.push('Belum terdeteksi: '+ask.map(k=>labels[k]).join(', ')+'. Periksa chat di atas, lalu minta hanya bagian yang belum diberikan.');
    lines.push(both?'Member lupa User ID dan password. Cocokkan identitas, lalu bantu reset password dan berikan User ID.':type==='username'?'Berikan User ID setelah identitas cocok; jangan reset password.':'Cocokkan identitas sebelum melanjutkan reset password.');
    return {category:both?'LUPA USER ID + PASSWORD • DATA MEMBER':type==='username'?'LUPA AKUN / USER ID • DATA MEMBER':'LUPA PASSWORD • DATA MEMBER',title,body:lines.join('\n'),tone:missing.length||ambiguous?'review':'ready'};
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

  const blockedMemory=new Map();
  function blockedState(chat=route){
    if(blockedMemory.has(chat))return blockedMemory.get(chat);
    let state;try{state=JSON.parse(localStorage.getItem('lc-blocked-result-v1:'+chat)||'null');}catch{}
    if(!state||typeof state!=='object')state={active:false,userid:'',phase:'idle'};
    if(state.phase==='loading')state.phase='idle';blockedMemory.set(chat,state);return state;
  }
  function saveBlocked(state,chat=route){try{localStorage.setItem('lc-blocked-result-v1:'+chat,JSON.stringify(state));}catch{state.storageError=true;}}
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
  async function runBlocked(userid,force=false){
    if(paused||!/^\w[\w.-]{2,39}$/.test(userid))return;
    const state=blockedState(),chat=route;
    if(!force&&state.userid===userid&&['loading','done','error'].includes(state.phase)&&!(state.phase==='error'&&/Centang filter UserId|Tautan Profil|Profil:/.test(state.error||'')&&state.filterRevision!==252))return;
    const token=(state.token||0)+1;Object.assign(state,{active:true,userid,filterRevision:252,phase:'loading',token,status:'',information:'',source:'',reasonDate:'',fallbackNote:'',error:'',lock:null,profileUrl:'',checkedAt:0});saveBlocked(state);render();
    const valid=()=>route===chat&&conversationRoute()===chat&&state.token===token;
    try{
      const page=await fetchAdmin(ADMIN_ORIGIN+ADMIN_PATHS[0],'GET',null,'blocked');if(!valid())return;
      const req=searchRequest(page,userid,'userid');
      const result=await fetchAdmin(req.url,req.method,req.body,'blocked');if(!valid())return;
      const player=playerById(result,userid);
      if(!player){state.status='Tidak ditemukan';state.phase='done';}
      else{
        state.lock=player.lock;rememberProfileForm(player.row,userid,result.url);
        const details=await readLockReason(userid,ADMIN_PATHS[0]);if(!valid())return;
        Object.assign(state,details);state.phase='done';
      }
      state.checkedAt=Date.now();
    }catch(e){if(valid()){state.phase='error';state.error=e.message;}}
    finally{if(valid()){saveBlocked(state);render();}else if(state.token===token){state.phase='idle';saveBlocked(state,chat);}}
  }
  function syncBlocked(messages){
    if(!messages.some(m=>m.kind==='member'&&detectIntent(m.text).includes('blocked')))return;
    const context=idContext(messages),state=blockedState();state.active=true;
    const userid=state.selectedUserid||context.id||(context.requested?context.candidate:'');
    if(userid)runBlocked(userid);
  }
  function drawBlocked(container){
    const state=blockedState();if(!state.active)return;
    const box=document.createElement('section');box.className='blocked-panel';box.dataset.status=state.status||state.phase;
    const eyebrow=document.createElement('div');eyebrow.className='category';eyebrow.textContent='PEMERIKSAAN AKUN • ADMIN NOW';
    const heading=document.createElement('strong');heading.textContent=state.userid||'Menunggu User ID member';
    const badge=document.createElement('div');badge.className='blocked-badge';badge.textContent=state.phase==='loading'?'Membuka Tools → Profil sesuai User ID…':state.status||'Status belum terbaca';
    box.append(eyebrow,heading,badge);
    if(state.status&&state.status!=='Tidak ditemukan'){
      const label=document.createElement('b');label.textContent=(state.source||'Information dari admin')+(state.reasonDate?' · '+state.reasonDate:'');const info=document.createElement('p');info.className='blocked-information';info.textContent=state.information||'(Information kosong)';box.append(label,info);
    }
    const note=document.createElement('p');note.textContent=state.error||(state.lock===true?'Indikator gembok ditemukan di sebelah User ID.':state.lock===false?'Indikator gembok belum terdeteksi. Acuan status: kolom Status pada Profil.':'User ID akan dicari setelah diberikan member.');box.append(note);
    if(state.lock===true&&state.status==='Unlocked'){const warn=document.createElement('p');warn.textContent='Indikator gembok dan Status Profil berbeda. Periksa langsung sebelum menyimpulkan.';box.append(warn);}
    if(state.checkedAt){const time=document.createElement('small');time.textContent='Hasil saat pengecekan: '+new Date(state.checkedAt).toLocaleString('id-ID');box.append(time);}
    const field=document.createElement('input');field.placeholder='User ID yang ingin diperiksa';field.value=state.userid||'';field.setAttribute('aria-label','User ID pemeriksaan blokir');
    const check=document.createElement('button');check.textContent='Periksa / perbarui profil';check.disabled=state.phase==='loading';check.onclick=()=>{const uid=field.value.trim();if(!/^\w[\w.-]{2,39}$/.test(uid)){setStatus('Periksa User ID: 3–40 karakter huruf, angka, titik, garis bawah atau tanda hubung.');return;}runBlocked(uid,true);};box.append(field,check);container.append(box);
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
    return {text:value.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}),tone:value>10000?'high':'low',note:value>10000?'DI ATAS 10.000':value===10000?'TEPAT 10.000':'DI BAWAH 10.000'};
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
    return {userid,referral,bank,holder,number,...balanceFromRow(row,labels)};
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
        if(nr>=0&&row.cells[nr]?.colSpan===1&&exactAccountCell(adminText(row.cells[nr]),number))return accountLockRecord(record,row,labels,page.url);
        if(bank>=0&&row.cells[bank]?.colSpan===1){
          const cell=row.cells[bank].cloneNode(true);cell.querySelectorAll('br').forEach(e=>e.replaceWith('\n'));
          const chunks=cell.textContent.split(/[\r\n,;]+/).map(t=>t.trim()).filter(Boolean);
          // Combined Bank column: bank, holder, account. Never match holder digits.
          const last=chunks[chunks.length-1];
          if(chunks.length>=2&&exactAccountCell(last,number))return accountLockRecord(record,row,labels,page.url);
        }
      }
    }
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
    if(result.record&&(result.record.lockCheckVersion||0)<7&&!result.completed&&!result.conversationCompleted)return null;
    const restored=JSON.parse(JSON.stringify(result));restored.balanceLoading=false;if(restored.record)delete restored.record.referralPending;return restored;
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
  function drawAccount(){
    const el=$('account');if(!el)return;
    const signature=JSON.stringify(accountState)+'|'+accountShowResult;if(signature===accountLastRender)return;accountLastRender=signature;
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
      const card=document.createElement('section');card.className='player-result';
      const banner=document.createElement('div');banner.className='player-banner';
      banner.textContent='✓ TERDAFTAR DI PEMAIN '+accountState.source;card.append(banner);
      const table=document.createElement('table');table.className='player-table';
      for(const [label,value] of [['User ID',record.userid],['Referral (Downline Aktif)',referralText(record)],['Bank / E-wallet',record.bank],['Nama Rekening',record.holder],['Nomor Rekening',record.number]]){
        const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');
        th.scope='row';th.textContent=label;td.textContent=value||'Belum terbaca';
        if(label==='Nomor Rekening')td.className='number-highlight';
        if(label==='User ID')td.className='userid-value';
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
      copy.onclick=async()=>{
        const content=['Pemain '+accountState.source,'User ID: '+(record.userid||'Belum terbaca'),'Referral (Downline Aktif): '+referralText(record),'Bank / E-wallet: '+(record.bank||'Belum terbaca'),'Nama Rekening: '+(record.holder||'Belum terbaca'),'Nomor Rekening: '+record.number,'Balance (saat pengecekan): '+balanceDisplay(record).text].join('\n');
        try{await navigator.clipboard.writeText(content);copy.textContent='✓ Data tersalin';}catch{setStatus('Clipboard belum diizinkan browser.');}
      };card.append(copy);el.append(card);
    }
    const note=document.createElement('p');note.textContent=accountState.message||'Ambil rekening dari pesan member setelah Started - Today.';if(accountState.record&&accountState.phase==='done')context.append(note);else el.append(note);
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
    const link=document.createElement('a');link.href=ADMIN_ORIGIN+ADMIN_PATHS[0];link.target='_blank';link.rel='noopener noreferrer';link.textContent='Buka admin / login';link.className='admin-link';manual.append(link);
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
    if(conversationRoute()!==route){scan();return;}
    if(!force && accountState.phase==='loading'&&accountState.number===number)return;
    if(!force && restoreAccountResult(number))return;
    if(paused){setStatus('Klik Lanjut sebelum mengecek rekening.');return;}
    cancelAccount();accountShowResult=false;const epoch=accountEpoch,chat=route;
    const current=()=>epoch===accountEpoch&&chat===route&&conversationRoute()===chat;
    accountState={...accountState,number,record:null,source:'',balanceReadRevision:1,balanceLoading:false,balanceCheckedAt:null,savedAt:null,stored:false,completed:false,conversationCompleted:false,completionRefresh:force&&Boolean(conversationDone()),fromCache:false,phase:'loading',now:'Sedang mencari…',old:'Menunggu hasil Now',message:'Membersihkan filter dan mencari Nomor Rekening di Pemain Now.'};drawAccount();
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
    if(current()){if(conversationDone()){accountState.conversationCompleted=true;accountState.completed=true;accountShowResult=false;}accountState.completionRefresh=false;saveAccountResult();drawAccount();$('bubble').classList.add('unread');playNotice();}
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
    let value=null;try{value=JSON.parse(localStorage.getItem('lc-reopened-v1:'+route)||'null');}catch{}
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
    reopenedMemory.set(route,checkpoint);try{localStorage.setItem('lc-reopened-v1:'+route,JSON.stringify(checkpoint));}catch{}
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
    const requestType=intentMessage&&resetIntent.test(intentMessage.text)?'password':'username';
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
  </style>
  <section id="panel" hidden><header><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5h14v10H10l-5 4V5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 9h6M9 12h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span><div class="brand"><strong>Asisten Pribadi <span class="edition">2.68</span></strong><span class="brand-caption">CHAT ASSIST</span></div><button id="close" title="Kecilkan" aria-label="Kecilkan asisten">−</button></header><div class="body"><p id="status">Menunggu chat…</p><div id="account" hidden></div><div id="cards"></div><div class="actions"><button id="scan">↻ Baca ulang chat</button></div><details><summary>Opsi &amp; pengaturan</summary><div class="actions"><button id="pause">Jeda</button><button id="clear">Bersihkan</button><button id="sound" aria-pressed="false">Suara: mati</button></div><p>Jika pesan member belum dikenali, isi selector CSS khusus baris pesan member. Selector harus membedakan member dari agen.</p><label>Selector pesan member<input id="member" placeholder="Otomatis berdasarkan penanda pengirim"></label><label>Selector pesan AI / agen (opsional)<input id="agent" placeholder="Penanda khusus pengirim AI / agen"></label><label>Selector area percakapan (opsional)<input id="scope" placeholder="Otomatis dari penanda Started - Today"></label><button id="save">Simpan pengaturan</button> <button id="restore">Tampilkan lagi pengingat selesai</button> <button id="position">Reset posisi bubble</button><small>Chats dan Archives: hanya membaca pesan setelah Started - Today terakhir. Gulir sampai penanda tersebut dimuat, lalu klik Baca ulang.</small></details></div></section><button id="bubble"><span class="bubble-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5h14v10H10l-5 4V5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 9h6M9 12h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span><span class="bubble-label">Asisten<span>CHAT ASSIST</span></span><span id="count">0</span></button>`;
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
    const taskNames={blocked:'akun diblokir',change:'ganti rekening / akun',deposit:'deposit',withdraw:'withdraw',password:'pemulihan password',username:'lupa User ID',scatter:'PL scatter',clarify:'pemulihan akun — pastikan kebutuhan'};
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
    const value = JSON.stringify({cards,blocked:blockedState()});
    if (value === lastRender) return;
    lastRender = value; $('cards').replaceChildren(); $('count').textContent = cards.length; $('bubble').setAttribute('aria-label','Pengingat: '+cards.length+' aktif. Alt Shift B untuk buka atau tutup.');
    if(cards.some(c=>c.type==='blocked')||blockedState().selectedUserid)drawBlocked($('cards'));
    const topicLabels={blocked:'Akun Terkunci / Terblokir',deposit:'Cek Deposit',withdraw:'Cek Withdraw',password:'Lupa Password',username:'Lupa Username'};
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
        for(const [value,label] of [['','Pilih maksud member…'],['deposit','Cek Deposit'],['withdraw','Cek Withdraw'],['username','Lupa Username'],['password','Lupa Password'],['blocked','Akun Terkunci / Terblokir']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
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
  function reset() { if(!blockedState().selectedUserid)cancelAdminGroup();seen.clear(); sources.clear(); cards=[]; render();resetAccount(); }
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
    const next=conversationRoute();
    if(next!==route){cancelAdminGroup();liveChatContext=null;clearTimeout(selectionTimer);route=next;baselineReady=false;reset();$('bubble').classList.remove('unread');}
    host.hidden=!/^\/chats(?:\/|$)/.test(location.pathname)&&!isArchive();
    if(host.hidden || paused) return;
    liveChatContext=null;
    try{
      let scope=cfg.scope ? document.querySelector(cfg.scope) : null;
      if(cfg.scope && (!scope || !visible(scope))){reset();setStatus('Area percakapan belum ditemukan. Periksa pengaturan.');return;}
      if(isArchive()&&!scope){
        // Read only a single identified transcript, never the Archives list.
        const logs=[...document.querySelectorAll('[role="log"]')].filter(e=>visible(e)&&!excluded(e));
        if(logs.length===1)scope=logs[0];
      }
      const marker=findStart(scope || document.body);
      if(!marker){cards=[];seen.clear();render();setStatus('Belum menemukan Started - Today. Gulir ke awal chat hari ini, lalu Baca ulang.');return;}
      scope=scope || (marker?inferScope(marker):null);
      if(!scope){reset();setStatus(isArchive()?'Archives aktif. Buka satu percakapan; jika belum terbaca, isi selector area percakapan pada pengaturan.':'Area chat belum dikenali. Isi selector area percakapan pada pengaturan.');return;}
      if(!scope.contains(marker)){cards=[];seen.clear();render();setStatus('Started - Today belum ditemukan di percakapan yang dipilih.');return;}
      const after=e=>!e.contains(marker)&&!!(marker.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING);
      let candidates;
      if(cfg.member){
        candidates=[...scope.querySelectorAll(cfg.member)].filter(e=>visible(e)&&!excluded(e)&&after(e));
        candidates=candidates.filter(e=>!candidates.some(p=>p!==e&&p.contains(e)));
      } else {
        candidates=[...scope.querySelectorAll('div,p,li,span')].filter(e=>visible(e)&&!excluded(e)&&after(e)&&senderKind(e,scope)==='member');
        // Outermost member wrapper is one message; do not count nested text twice.
        candidates=candidates.filter(e=>!candidates.some(p=>p!==e&&p.contains(e)));
      }
      if(!candidates.length){reset();setStatus('Area percakapan ditemukan; pesan member belum dikenali. Periksa selector pesan jika chat sudah berisi pesan.');return;}
      const agents = [...scope.querySelectorAll(cfg.agent || 'div,p,li,span')]
        .filter(e=>visible(e)&&!excluded(e)&&after(e)&&!candidates.some(m=>m===e||m.contains(e)||e.contains(m))&&(cfg.agent||senderKind(e,scope)==='agent'));
      const agentRows = agents.filter(e=>!agents.some(p=>p!==e&&p.contains(e)));
      let transcript = [...candidates.map(e=>({e,kind:'member'})),...agentRows.map(e=>({e,kind:'agent'}))]
        .sort((a,b)=>(a.e.compareDocumentPosition(b.e)&Node.DOCUMENT_POSITION_FOLLOWING)?-1:1)
        .map(m=>({e:m.e,kind:m.kind,text:m.e.innerText||''}));
      transcript=contextualMessages(transcript);
      const contextualText=new Map(transcript.map(m=>[m.e,m.text]));
      liveChatContext={route,scope,candidates,messages:transcript};
      syncAccount(liveChatContext.messages);
      syncBlocked(transcript);
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
          const advice = ['password','username'].includes(type)?recoveryAdvice(type,transcript):type==='change'?changeAdvice(transcript):(['deposit','withdraw','blocked'].includes(type)) ? contextualAdvice(type,context) : {title,body,category:'MAKSUD TERDETEKSI • '+(type==='scatter'?'PL SCATTER':type==='username'?'LUPA USER ID':'PASSWORD')};
          const existing=cards.find(c=>c.signature===signature);
          if(existing){ Object.assign(existing,advice); continue; }
          if(seen.has(signature))continue;
          // One current card per transaction topic; update it as conversation progresses.
          if(['deposit','withdraw','blocked','scatter','change'].includes(type)) cards=cards.filter(c=>c.type!==type);
          seen.add(signature);cards.push({signature,type,...advice,message:message.slice(0,240)});added=true;
        }
      }
      for(const card of cards) if(['deposit','withdraw','blocked'].includes(card.type)) Object.assign(card,contextualAdvice(card.type,context));
      for(const card of cards)if(['password','username'].includes(card.type))Object.assign(card,recoveryAdvice(card.type,transcript));
      for(const card of cards)if(card.type==='change')Object.assign(card,changeAdvice(transcript));
      cards=cards.slice(-30);render();
      if(added){
        $('bubble').classList.add('unread');
        if(baselineReady)playNotice();
      }
      baselineReady=true;
      setStatus(`${isArchive()?'Archives':'Aktif'} • ${candidates.length} pesan member • ${agentRows.length} pesan AI/agen • mulai Started - Today • hanya chat yang sudah dimuat`);
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

  function selectedChatUserid(){
    const context=liveChatContext,selection=window.getSelection();
    if(conversationRoute()!==route||paused||!selection||selection.isCollapsed||selection.rangeCount!==1)return '';
    const asElement=node=>node?.nodeType===1?node:node?.parentElement;
    const anchor=asElement(selection.anchorNode),focus=asElement(selection.focusNode);
    if(!anchor||!focus||excluded(anchor)||excluded(focus)||anchor.closest('input,textarea,[contenteditable="true"]')||focus.closest('input,textarea,[contenteditable="true"]'))return '';
    let message=context?.route===route?context.messages.find(m=>m.e?.isConnected&&m.e.contains(anchor)&&m.e.contains(focus)):null;
    // Manual selection does not depend on automatic sender classification.
    if(!message){
      const marker=findStart(document.body);if(!marker)return '';
      const scope=(cfg.scope?document.querySelector(cfg.scope):null)||inferScope(marker);
      if(!scope||!scope.contains(marker)||!scope.contains(anchor)||!scope.contains(focus))return '';
      const after=e=>!e.contains(marker)&&!!(marker.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING);
      if(!after(anchor)||!after(focus))return '';
      let row=asElement(selection.getRangeAt(0).commonAncestorContainer);
      while(row?.parentElement&&row.parentElement!==scope&&row.textContent.length<120)row=row.parentElement;
      if(!row||row.contains(marker))return '';
      message={e:row};
    }
    const raw=selection.toString().normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
    const userid=raw.replace(/^(?:user\s*id|username|id)\s*[:=]\s*/i,'');
    if(!/^\w[\w.-]{2,39}$/.test(userid))return '';
    const range=selection.getRangeAt(0),prefix=range.cloneRange();
    prefix.selectNodeContents(message.e);prefix.setEnd(range.startContainer,range.startOffset);
    const linePrefix=prefix.toString().split(/\n/).pop();
    if(/(?:password|kata sandi|nomor rekening|norek|no\.?\s*rek|telepon|phone|email)\s*[:=]\s*$/i.test(linePrefix))return '';
    const labelled=/^(?:user\s*id|username|id)\s*[:=]/i.test(raw)||/(?:user\s*id|username|id)\s*[:=]\s*$/i.test(linePrefix);
    const blocked=context?.route===route&&context.messages.some(m=>m.kind==='member'&&detectIntent(m.text).includes('blocked'));
    // Bare numbers remain rekening unless an ID label or blocked context identifies them.
    if(/^\d+$/.test(userid)&&!labelled&&!blocked)return '';
    if(/^(?:akun|saya|aku|bos|bosku|kenapa|terblokir|teblokir|diblokir|terkunci|locked|blocked|password|username|userid|tolong|admin)$/i.test(userid))return '';
    return userid;
  }
  function checkSelectedUserid(){
    const userid=selectedChatUserid();if(!userid)return false;
    const state=blockedState();state.active=true;state.selectedUserid=userid;saveBlocked(state);
    $('panel').hidden=false;
    runBlocked(userid,state.phase==='error');render();clampPosition();
    setStatus('User ID pilihan: '+userid+' — membaca Status dan Information dari Profil.');
    return true;
  }
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
    if(checkSelectedUserid())return;
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
  document.addEventListener('pointerup',e=>{selectionDragging=false;if(e.composedPath().includes(host))return;scheduleSelectedAccount();},true);
  document.addEventListener('pointercancel',()=>{selectionDragging=false;clearTimeout(selectionTimer);},true);
  document.addEventListener('keydown',e=>{if(e.key==='Shift'){selectionKeyboard=true;clearTimeout(selectionTimer);}},true);
  document.addEventListener('keyup',e=>{if(e.key==='Shift')selectionKeyboard=false;if(e.key==='Shift'||e.key.startsWith('Arrow'))scheduleSelectedAccount();},true);
  window.addEventListener('blur',()=>{selectionDragging=false;selectionKeyboard=false;clearTimeout(selectionTimer);});

  const schedule=()=>{clearTimeout(timer);timer=setTimeout(scan,250);};
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(scan,1800);window.addEventListener('popstate',schedule);window.addEventListener('hashchange',schedule);scan();
})();
