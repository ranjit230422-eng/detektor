// ==UserScript==
// @name         DeepSeek Original + Gopath Email TurboCheck AutoClose v12.3
// @namespace    http://tampermonkey.net/
// @version      12.3
// @description  DeepSeek lengkap + pemeriksaan email Gopath segera setelah paste; tanpa pemeriksaan duplikat; tab pekerja otomatis ditutup; indikator centang/X saja.
// @match        https://agwl2.admitoto.com/agentnewplayer.php*
// @match        https://my.livechatinc.com/*
// @match        https://gopath.id/link_linetogel/register*
// @match        https://www.gopath.id/link_linetogel/register*
// @match        https://gopath.id/register*
// @match        https://www.gopath.id/register*
// @match        https://line38602.com/register*
// @match        https://www.line38602.com/register*
// @match        https://*.line38602.com/register*
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @grant        unsafeWindow
// @connect      agwl2.admitoto.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    /* =====================================================================
       ============ BAGIAN 1: ADMITOTO — KONSTANTA & UTIL ============
       ===================================================================== */
    const REG_URL  = 'https://agwl2.admitoto.com/agentnewplayer.php';
    const LIST_URL = 'https://agwl2.admitoto.com/agentplayerlist.php';
    const OLD_LIST_URL = 'https://agwl2.admitoto.com/agentplayerlist_old.php';
    const LIST_PATHS = ['/agentplayerlist.php','/agentplayerlist_old.php'];
    const PARENT   = 'https://my.livechatinc.com';
    const ORIGIN   = 'https://agwl2.admitoto.com';
    const BANKS = ['BCA','BRI','BNI','BSI','CIMB','MANDIRI','DANAMON','MAYBANK',
                   'BANK JAGO','SEABANK','DANA','OVO','LINK AJA','GOPAY'];

    const norm = s => String(s || '').replace(/\s+/g, ' ').trim();

    const DEFAULT_REFERRAL = '504rf';
    const passwordGroups = {
        upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lower: 'abcdefghijklmnopqrstuvwxyz',
        digits: '0123456789'
    };
    let selectedPasswordGroups = ['upper', 'lower', 'digits'];
    function generatePassword() {
        const groups = selectedPasswordGroups.map(key => passwordGroups[key]);
        if (!groups.length) throw new Error('Pilih minimal satu kelompok karakter.');
        const alphabet = groups.join('');
        const randomIndex = max => {
            const bytes = new Uint8Array(1);
            const limit = 256 - (256 % max);
            do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
            return bytes[0] % max;
        };
        const chars = groups.map(group => group[randomIndex(group.length)]);
        while (chars.length < 10) chars.push(alphabet[randomIndex(alphabet.length)]);
        for (let i = chars.length - 1; i > 0; i--) {
            const j = randomIndex(i + 1);
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        return chars.join('');
    }

    function registrationCopyText(data) {
        return 'User Id : ' + data.userid + '\n' +
            'Password : ' + data.password + '\n' +
            'Silahkan di coba login ya bosku. Terima Kasih\n' +
            'Note : Saran kami di simpan di memo anda.';
    }

    function adminRequest(url, method = 'GET', body = null) {
        const destination = new URL(url, LIST_URL);
        if (destination.origin !== ORIGIN || !LIST_PATHS.includes(destination.pathname)) {
            return Promise.reject(new Error('Tujuan pencarian tidak cocok dengan halaman daftar pemain.'));
        }
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'function') {
                reject(new Error('Izin Tampermonkey belum aktif. Simpan seluruh skrip v9.29, lalu muat ulang LiveChat.')); return;
            }
            GM_xmlhttpRequest({
                method, url: destination.href,
                anonymous: false,
                timeout: 20000,
                headers: method === 'POST' ? {'Content-Type':'application/x-www-form-urlencoded'} : {},
                ...(body === null ? {} : {data: body}),
                onload(response) {
                    const finalURL = new URL(response.finalUrl || destination.href, destination.href);
                    if (finalURL.origin !== ORIGIN || finalURL.pathname !== destination.pathname) {
                        reject(new Error('Sesi admin tidak aktif. Login admin sekali, lalu klik Cek Ulang.')); return;
                    }
                    if (response.status < 200 || response.status >= 300) {
                        reject(new Error('Admin mengembalikan HTTP ' + response.status + '. Coba Cek Ulang.')); return;
                    }
                    const doc = new DOMParser().parseFromString(response.responseText || '', 'text/html');
                    if (doc.querySelector('input[type="password"],input[name="entered_login"],form[action*="login"]')) {
                        reject(new Error('Sesi admin tidak aktif. Login admin sekali, lalu klik Cek Ulang.')); return;
                    }
                    resolve({doc, url:finalURL.href});
                },
                onerror() { reject(new Error('Request admin gagal. Periksa izin akses agwl2.admitoto.com di Tampermonkey.')); },
                ontimeout() { reject(new Error('Pencarian melewati 20 detik. Klik Cek Ulang.')); },
                onabort() { reject(new Error('Pencarian dibatalkan.')); }
            });
        });
    }

    function searchCheckbox(input, kind) {
        if (!input.form) return null;
        const all = [...input.form.querySelectorAll('input[type="checkbox"][name]')].filter(el => !el.disabled);
        const re = kind === 'uid' ? /user[_\s-]*(id|name)|userid|username/i : /rekening|no[_\s-]*rek|account[_\s-]*(no|number)/i;
        const named = all.filter(el => re.test([el.name,el.id,...[...(el.labels || [])].map(l => l.textContent)].join(' ')));
        if (named.length === 1) return named[0];
        const scope = input.closest('td') || input.parentElement;
        let nearby = all.filter(el => scope?.contains(el));
        if (!nearby.length) nearby = all.filter(el => input.closest('tr')?.contains(el));
        return nearby.length === 1 ? nearby[0] : null;
    }

    function searchField(doc, kind) {
        const inputs = [...doc.querySelectorAll('input[name]')].filter(el =>
            (!el.disabled || searchCheckbox(el,kind)) && ['text','search','tel','number','email'].includes(el.type) && el.form);
        const key = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const names = kind === 'uid'
            ? ['userid','username','user','iduser','searchuserid','searchusername','txtuserid','txtusername']
            : ['rekening','norek','norekening','nomorrekening','accountnumber','accountno','searchrekening','no_rek','no_rekening','rek'];
        const re = kind === 'uid' ? /user\s*id|user\s*name|id\s*user/i : /nomor\s*rekening|no\.?\s*rek|account\s*(number|no)|rekening/i;
        const exact = inputs.filter(el => names.includes(key(el.name)) || names.includes(key(el.id)));
        if (exact.length === 1) return {input:exact[0], selector:null};
        const labeled = inputs.filter(el => {
            const labels = [...(el.labels || [])].map(l => l.textContent);
            const prev = el.closest('td')?.previousElementSibling;
            return re.test([el.placeholder,el.getAttribute('aria-label'),...labels,prev?.textContent].join(' '));
        });
        if (labeled.length === 1) return {input:labeled[0], selector:null};
        for (const form of doc.forms) {
            const boxes = inputs.filter(el => el.form === form && /^(q|search|keyword|searchtext|searchvalue|searchkeyword|cari)$/i.test(key(el.name)));
            if (boxes.length !== 1) continue;
            const selectors = [...form.querySelectorAll('select[name]')].filter(el => !el.disabled);
            for (const selector of selectors) {
                const option = [...selector.options].find(o => !o.disabled &&
                    (names.includes(key(o.value)) || re.test(o.textContent)));
                if (option) return {input:boxes[0], selector, option};
            }
        }
        throw new Error('Kolom pencarian ' + (kind === 'uid' ? 'User ID' : 'rekening') + ' belum dikenali. Perlu menyesuaikan form halaman daftar admin.');
    }

    function buildSearch(page, kind, value) {
        const {input, selector, option} = searchField(page.doc, kind);
        const form = input.form;
        const checkbox = searchCheckbox(input,kind);
        if (input.disabled && !checkbox) throw new Error('Filter pencarian tidak aktif.');
        if (checkbox) { checkbox.checked = true; input.disabled = false; }
        const buttons = [...form.querySelectorAll('button,input[type="submit"],input[type="button"]')].filter(el => !el.disabled);
        const submitter = buttons.find(el => /cari|search|filter|tampilkan/i.test(norm(el.textContent || el.value))) ||
            buttons.find(el => el.type === 'submit');
        const url = new URL(page.url);
        const method = (submitter?.getAttribute('formmethod') || form.getAttribute('method') || 'GET').toUpperCase();
        if (!['GET','POST'].includes(method)) throw new Error('Metode pencarian tidak didukung.');

        const params = new URLSearchParams();
        for (const el of form.elements) {
            if (!el.name || el.matches(':disabled') || ['submit','button','reset','file','image'].includes(el.type)) continue;
            if (el.type === 'checkbox' && el !== checkbox) continue;
            if (el.type === 'radio' && !el.checked) continue;
            if (el === input) { params.append(el.name,value); continue; }
            if (el === selector) { params.append(el.name,option.value); continue; }
            if (el.tagName === 'SELECT') {
                const blank = [...el.options].find(o => !o.disabled && (o.value === '' || /^(semua|all)$/i.test(norm(o.textContent))));
                const values = blank ? [blank] : [...el.selectedOptions].filter(o => !o.disabled);
                values.forEach(o => params.append(el.name,o.value)); continue;
            }
            params.append(el.name, ['text','search','tel','number','email','textarea'].includes(el.type) ? '' : el.value);
        }
        if (submitter?.name) params.append(submitter.name,submitter.value);
        if (method === 'GET') { url.search = params.toString(); return {url:url.href, method, body:null}; }
        return {url:url.href, method, body:params.toString()};
    }

    async function directCheck(kind, value) {
        if (kind === 'rek') return lookupAccountAt(LIST_URL,value);
        const page = await adminRequest(LIST_URL);
        const request = buildSearch(page, kind, value);
        const result = await adminRequest(request.url,request.method,request.body);
        return directReadResult(result.doc,kind,value, verifiedSearch(result.doc,kind,value)) || {state:'unknown',message:'Respon admin belum dikenali; hasil tidak dianggap tersedia.'};
    }

    function extractChatAccounts(text) {
        const found = new Set();
        const normalized = String(text || '').replace(/\u00a0/g,' ');
        const re = /(?:nomor\s*rekening|no\.?\s*rekening|no\.?\s*rek\b|norek\b|rekening\b|account\s*(?:number|no\.?))\s*[:=\-]?\s*([0-9][0-9 .-]{3,35}[0-9])(?![0-9])/gi;
        for (const match of normalized.matchAll(re)) {
            const digits = match[1].replace(/[^0-9]/g,'');
            if (/^[0-9]{5,25}$/.test(digits)) found.add(digits);
        }
        return [...found];
    }

    let selectedAccount = null;
    document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        const anchor = selection?.anchorNode?.parentElement;
        if (!selection || selection.isCollapsed || !anchor || anchor.closest('#admitoto-hub,nav,aside,[role="navigation"]')) return;
        const raw = selection.toString().trim();
        const digits = raw.replace(/[\s.\-\u200B-\u200D\uFEFF]/g,'');
        const numbers = /^[0-9]{5,25}$/.test(digits) ? [digits] : extractChatAccounts(raw);
        selectedAccount = numbers.length === 1 ? {number:numbers[0],route:location.href,time:Date.now()} : null;
    });

    function activeChatAccounts() {
        const visible = el => !el.closest('[hidden],[aria-hidden="true"]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
        const selected = window.getSelection();
        const anchor = selected?.anchorNode?.parentElement;
        if (selected && !selected.isCollapsed && anchor && !anchor.closest('#admitoto-hub') && !anchor.closest('nav,aside,[role="navigation"]')) {
            const candidates = extractChatAccounts(selected.toString());
            if (candidates.length) return candidates;
            const digits = selected.toString().trim().replace(/[\s.\-\u200B-\u200D\uFEFF]/g,'');
            if (/^[0-9]{5,25}$/.test(digits)) return [digits];
        }
        if (selectedAccount && selectedAccount.route === location.href && Date.now() - selectedAccount.time < 120000) return [selectedAccount.number];
        const selectors = '[role="log"],[data-testid*="message-list"],[data-testid*="messages-list"],[data-testid*="chat-messages"],[class*="MessageList"],[class*="messageList"],[class*="messagesList"],[aria-label="Chat messages"]';
        const candidates = [...document.querySelectorAll(selectors)].filter(visible).filter(el => !el.closest('#admitoto-hub,nav,aside,[role="navigation"]'));
        const roots = candidates.filter(el => !candidates.some(other => other !== el && other.contains(el)));
        if (roots.length !== 1) return [];
        return extractChatAccounts(roots[0].innerText);
    }

    function canonicalBank(text) {
        const clean = value => norm(value).toUpperCase().replace(/[^A-Z0-9]/g,'');
        const aliases = {CIMBNIAGA:'CIMB',JAGO:'BANK JAGO',LINKAJA:'LINK AJA'};
        const value = clean(String(text || '').replace(/^(?:jenis bank|nama bank|bank)\s*[:=]\s*/i,''));
        return BANKS.find(bank => clean(bank) === value) || aliases[value] || aliases[value.replace(/^BANK/,'')] ||
            BANKS.find(bank => clean(bank) === value.replace(/^BANK/,'')) || '';
    }

    function cellLines(cell) {
        if (!cell) return [];
        const copy = cell.cloneNode(true);
        copy.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        copy.querySelectorAll('div,p,li,tr,td,span,b,strong,font').forEach(el => { el.prepend('\n'); el.append('\n'); });
        copy.querySelectorAll('script,style,button,input,select').forEach(el => el.remove());
        return copy.textContent.split(/\r?\n/).map(norm).filter(Boolean);
    }

    function columnTitle(cell) {
        const copy = cell.cloneNode(true);
        copy.querySelectorAll('input,select,textarea,button,script,style,.sort-icon,.sorting-icon,[aria-hidden="true"]').forEach(el => el.remove());
        return norm(copy.textContent).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    }

    function readAccountRecord(doc, number, verified) {
        const records = [];
        for (const table of doc.querySelectorAll('table')) {
            const rows = [...table.rows].filter(row => row.closest('table') === table);
            let header = -1, columns;
            for (let i = 0; i < rows.length; i++) {
                const titles = [...rows[i].cells].map(columnTitle);
                const uid = titles.findIndex(t => /^(user\s*id|userid|username|user\s*name|id\s*user|account|player)$/i.test(t));
                if (uid < 0) continue;
                columns = {
                    uid,
                    bank: titles.findIndex(t => /^(bank|jenis bank|nama bank|bank name|bank account|bank e wallet|bank ewallet|e wallet|ewallet|bank list)$/i.test(t)),
                    number: titles.findIndex(t => /^(rekening|nomor rekening|no\.?\s*rek(ening)?|norek|account\s*(number|no\.?)|account|no\.?\s*rek)$/i.test(t)),
                    holder: titles.findIndex(t => /^(nama rekening|nama rek|nama pemilik rekening|atas nama|nama pemilik|account name|nama bank account|pemilik)$/i.test(t))
                };
                if (columns.bank < 0 && columns.number < 0) continue;
                header = i; break;
            }
            if (header < 0) continue;

            for (const row of rows.slice(header + 1)) {
                const uidCell = row.cells[columns.uid];
                if (!uidCell || uidCell.colSpan !== 1) continue;

                const rawLines = cellLines(uidCell);
                let userid = '';
                if (rawLines.length > 0) {
                    userid = rawLines[0].split(/\s+/)[0].replace(/^(?:user\s*id|username|account)\s*[:=]\s*/i, '').trim();
                }
                if (!userid || !/^[A-Za-z0-9._-]{3,20}$/.test(userid) || /^(?:userid|username|edit|detail|delete|hapus|ubah|user|id)$/i.test(userid)) {
                    continue;
                }

                const bankCell = columns.bank >= 0 ? row.cells[columns.bank] : null;
                const bankText = bankCell ? norm(bankCell.textContent) : '';

                let bank = '', rekening = '', namarekening = '';

                if (bankText) {
                    const parts = bankText.split(/,/).map(norm);
                    if (parts.length >= 3) {
                        const maybeBank = canonicalBank(parts[0]);
                        const maybeRek = parts[parts.length - 1].replace(/[\s.\-\u200B-\u200D\uFEFF]/g, '');
                        const maybeName = parts.slice(1, -1).join(', ').trim();

                        if (maybeBank && /^[0-9]{5,25}$/.test(maybeRek) && maybeRek === number) {
                            bank = maybeBank;
                            rekening = maybeRek;
                            namarekening = maybeName;
                        }
                    }
                }

                if (!rekening) {
                    const allLines = [...row.cells].flatMap(cell => cellLines(cell));
                    const foundNumber = allLines.find(line => line.replace(/[^0-9]/g, '') === number);
                    if (foundNumber) {
                        rekening = number;
                        bank = allLines.map(canonicalBank).find(Boolean) || '';
                        namarekening = allLines.find(line =>
                            line !== foundNumber &&
                            line !== userid &&
                            !canonicalBank(line) &&
                            /^[A-Za-z\s.,'-]+$/.test(line) &&
                            !/^(user\s*id|username|no name)$/i.test(line)
                        ) || '';
                    }
                }

                if (rekening === number) {
                    records.push({ userid, rekening: number, bank, namarekening });
                }
            }
        }
        const unique = [...new Map(records.map(r => [JSON.stringify(r), r])).values()];
        unique.sort((a, b) => (b.bank.length + b.namarekening.length) - (a.bank.length + a.namarekening.length));
        return unique.length > 0 ? unique[0] : null;
    }

    async function lookupAccountAt(url, number) {
        const page = await adminRequest(url);
        const request = buildSearch(page, 'rek', number);
        const result = await adminRequest(request.url, request.method, request.body);
        const verified = verifiedSearch(result.doc, 'rek', number);
        const record = readAccountRecord(result.doc, number, verified);
        if (record) return { state: 'taken', message: 'NOMOR REKENING SUDAH TERDAFTAR', record };
        return directReadResult(result.doc, 'rek', number, verified) || { state: 'unknown', message: 'Hasil rekening belum dikenali.' };
    }

    async function lookupAccount(number, onProgress = () => {}) {
        onProgress('1/2 — Mencari data pemain di agentplayerlist_old.php…');
        let old;
        try { old = await lookupAccountAt(OLD_LIST_URL, number); }
        catch (error) { old = {state:'unknown', message:error.message}; }

        onProgress('2/2 — Memeriksa status rekening di agentplayerlist.php…');
        let main;
        try { main = await lookupAccountAt(LIST_URL, number); }
        catch (error) { main = {state:'unknown', message:error.message}; }

        if (main.state === 'taken') {
            return {
                state:'taken', source:'utama', record:main.record || null,
                message:'NOMOR REKENING SUDAH TERDAFTAR DI ADMIN UTAMA'
            };
        }
        if (old.state === 'taken') {
            return {
                state:'old', source:'lama', record:old.record || null,
                message: old.record
                    ? 'Data pemain ditemukan di daftar lama; rekening belum ada di admin utama.'
                    : 'Rekening ada di daftar lama, tetapi data pemain tidak dapat dibaca otomatis.'
            };
        }
        if (main.state === 'free') {
            return {
                state:'free', source:'utama', record:null,
                message:'NOMOR REKENING BELUM TERDAFTAR DI DAFTAR LAMA MAUPUN UTAMA'
            };
        }
        return {
            state:'unknown', source:'utama', record:null,
            message:main.message || old.message || 'Status rekening tidak dapat dipastikan.'
        };
    }

    function primaryAccountStatus(result) {
        return {state:result.state, source:result.source, message:result.message};
    }

    function verifiedSearch(doc, kind, value) {
        try {
            const {input,selector,option} = searchField(doc,kind);
            const cb = searchCheckbox(input,kind);
            return input.value.trim() === value && (!cb || cb.checked) && (!selector || selector.value === option.value);
        } catch { return false; }
    }

    function directReadResult(doc, kind, value, filterVerified = false) {
        const uidHeader = /^(user\s*id|userid|user\s*name|username|id\s*user)$/i;
        const rekHeader = /^(nomor\s*rekening|no\.?\s*rekening|rekening|norek|account\s*(number|no\.?)|bank\s*account|accountno|accountnumber|no\.?\s*rek)$/i;
        const empty = /^(no (data|records?)( available| found)?|no data available in table|no matching records found|tidak ada data( yang ditemukan)?|data (tidak ditemukan|kosong)|data not found|tidak ditemukan|tidak ada hasil|no results?( found)?)[.!]?$/i;
        const candidates = [];

        for (const table of doc.querySelectorAll('table')) {
            const rows = [...table.rows].filter(row => row.closest('table') === table);
            for (const header of rows) {
                const labels = [...header.cells].map(columnTitle);
                const uidIndex = labels.findIndex(t => uidHeader.test(t));
                const index = labels.findIndex(t => (kind === 'uid' ? uidHeader : rekHeader).test(t));
                const noIndex = labels.findIndex(t => /^no\.?$/i.test(t));
                const playerTable = uidIndex >= 0 && labels.some(t => /^(bank|jenis bank|nama bank|bank account|bank e wallet|bank ewallet|e wallet|ewallet|bank list)$/.test(t));
                if (index >= 0 || (kind === 'rek' && playerTable)) {
                    candidates.push({rows,header,index,uidIndex,noIndex,playerTable});
                    break;
                }
            }
        }

        const answer = state => ({state,message:(kind === 'uid' ? 'USER ID' : 'NOMOR REKENING') + (state === 'taken' ? ' TERDAFTAR' : ' BELUM TERDAFTAR')});
        const unknown = message => ({state:'unknown',message});

        if (candidates.length === 0) {
            const tables = [...doc.querySelectorAll('table')];
            const headers = tables.flatMap(table => [...table.rows].filter(row => row.querySelector('th') || [...row.cells].some(cell => /^(user id|userid|username|user name|id user)$/.test(columnTitle(cell)))).slice(0,2).map(row => [...row.cells].map(columnTitle).join(' | '))).slice(0,3);
            return unknown('Tabel hasil belum dikenali (0 cocok, '+tables.length+' tabel diterima). '+(headers.length ? 'Judul kolom: '+headers.join(' / ').slice(0,300) : 'Tidak ada judul kolom User ID yang terbaca.'));
        }

        for (const candidate of candidates) {
            const {rows,header,index,uidIndex,noIndex,playerTable} = candidate;
            const data = rows.slice(rows.indexOf(header)+1).filter(r => norm(r.textContent));
            const subtotal = r => /^(?:sub\s*)?total\s*:?$/i.test(norm(r.cells[0]?.textContent));
            const content = data.filter(r => !subtotal(r));
            const want = kind === 'uid' ? value.toLowerCase() : value;
            const matches = text => (kind === 'uid' ? norm(text).toLowerCase() : norm(text)) === want;

            if (index >= 0 && content.some(row => {
                const cell = row.cells[index];
                if (!cell || cell.colSpan !== 1) return false;
                if (matches(cell.textContent)) return true;
                if (kind !== 'uid') return false;
                const first = [...cell.childNodes].find(n => norm(n.textContent));
                return first && matches(first.textContent);
            })) return answer('taken');

            if (playerTable && filterVerified && kind === 'rek' && index < 0) {
                const embeddedNumber = content.some(row => [...row.cells].some(cell => {
                    const text = norm(cell.textContent).replace(/[\s.\-\u200B-\u200D\uFEFF]/g, '');
                    return text.includes(value);
                }));
                if (embeddedNumber) return answer('taken');
            }
        }

        if (filterVerified) return answer('free');
        return unknown('Filter belum terkonfirmasi di balasan admin. Klik Cek Ulang.');
    }

    function registrationRequest(url, method = 'GET', body = null) {
        const target = new URL(url, REG_URL);
        if (target.origin !== ORIGIN || target.pathname !== new URL(REG_URL).pathname) {
            return Promise.reject(new Error('Tujuan formulir Tambah Pemain berbeda; pendaftaran belum dikirim.'));
        }
        return new Promise((resolve,reject) => {
            if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('Aktifkan izin Tampermonkey untuk admin.')); return; }
            GM_xmlhttpRequest({
                method,url:target.href,anonymous:false,timeout:30000,
                headers:method === 'POST' ? {'Content-Type':'application/x-www-form-urlencoded'} : {},
                ...(body === null ? {} : {data:body}),
                onload(r) {
                    const url = new URL(r.finalUrl || target.href,target.href);
                    if (url.origin !== ORIGIN) { reject(new Error('Balasan pendaftaran menuju situs lain.')); return; }
                    if (r.status < 200 || r.status >= 300) { reject(new Error('Admin mengembalikan HTTP '+r.status+'.')); return; }
                    const doc = new DOMParser().parseFromString(r.responseText || '', 'text/html');
                    if (/login|signin|logout/i.test(url.pathname) || doc.querySelector('input[name="entered_login"],form[action*="login"]')) {
                        reject(new Error('Sesi admin berakhir. Login admin lalu coba kembali.')); return;
                    }
                    resolve({doc,url:url.href});
                },
                onerror(){reject(new Error('Koneksi ke admin gagal.'));},
                ontimeout(){reject(new Error('Admin belum membalas dalam 30 detik.'));},
                onabort(){reject(new Error('Permintaan dibatalkan.'));}
            });
        });
    }

    function prepareRegistration(page,data) {
        const document = page.doc;
        const visible = el => {
            if (!el || el.disabled || el.type === 'hidden') return false;
            const view = el.ownerDocument.defaultView;
            for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
                const st = view && view.getComputedStyle(n);
                if (st && (st.display === 'none' || st.visibility === 'hidden')) return false;
            }
            return true;
        };
        const labelTexts = el => {
            const out = [];
            for (const l of (el.labels || [])) out.push(norm(l.textContent));
            const td = el.closest('td,th');
            if (td) {
                let prev = td.previousElementSibling;
                while (prev && !prev.querySelector('input,select,textarea')) {
                    const t = norm(prev.textContent);
                    if (t) { out.push(t); break; }
                    prev = prev.previousElementSibling;
                }
            }
            if (el.parentElement) {
                const copy = el.parentElement.cloneNode(true);
                copy.querySelectorAll('input,select,textarea,button').forEach(n => n.remove());
                const t = norm(copy.textContent);
                if (t) out.push(t);
            }
            return out.map(t => t.replace(/[:*]+$/g, '').trim()).filter(Boolean);
        };
        const setValue = (el, value) => {
            try { el.focus({ preventScroll: true }); } catch {}
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('keyup', { bubbles: true }));
            try { el.blur(); } catch {}
        };
        const FIELD_SELECTORS = {
            userid: ['input[name="userid"]','input[name="user_id"]','input[name="username"]','input[name="user"]'],
            password: ['input[name="password"]','input[name="pass"]','input[name="sandi"]','input[type="password"]'],
            email: ['input[name="email"]','input[name="email_address"]','input[name="emailaddress"]','input[type="email"]'],
            telepon: ['input[name="telepon"]','input[name="telp"]','input[name="telephone"]','input[name="phone"]',
                     'input[name="nohp"]','input[name="no_hp"]','input[name="nomorhp"]','input[name="handphone"]',
                     'input[name="notelp"]','input[name="hp"]','input[name="whatsapp"]','input[name="wa"]'],
            referral: ['input[name="referral"]','input[name="referal"]','input[name="ref"]',
                      'input[name="kode_referral"]','input[name="kodereferral"]','input[name="kode"]'],
            rekening: ['input[name="rekening"]','input[name="norek"]','input[name="no_rek"]',
                      'input[name="nomorrekening"]','input[name="nomor_rekening"]',
                      'input[name="accountnumber"]','input[name="account_number"]'],
            namarekening: ['input[name="namarekening"]','input[name="nama_rekening"]','input[name="atasnama"]',
                          'input[name="atas_nama"]','input[name="namapemilik"]','input[name="nama_pemilik"]',
                          'input[name="pemilik"]','input[name="accountname"]','input[name="account_name"]']
        };
        const BANK_SELECTORS = ['select[name="bank"]','select[name="namabank"]','select[name="nama_bank"]',
                               'select[name="bankname"]','select[name="bank_name"]','select[name="kodebank"]','select[name="kode_bank"]'];
        const LABELS = {
            userid: /^(user\s*id|userid|username|user\s*name|id\s*user)$/i,
            password: /^(password|pass|kata\s*sandi|sandi)$/i,
            email: /^(email|e-mail|alamat\s*email)$/i,
            telepon: /^(telepon|telp|telephone|phone|no\.?\s*(hp|telp|telepon|handphone)|nomor\s*(hp|telepon)|handphone|hp|whatsapp|wa)$/i,
            referral: /^(referral|referal|kode\s*referal|kode\s*referral|ref)$/i,
            rekening: /^(nomor\s*rekening|no\.?\s*rekening|rekening|norek|account\s*(number|no\.?))$/i,
            namarekening: /^(nama\s*rekening|atas\s*nama|nama\s*pemilik(\s*rekening)?|pemilik\s*rekening|account\s*name)$/i
        };
        function findField(key) {
            for (const sel of (FIELD_SELECTORS[key] || [])) {
                let list;
                try { list = [...document.querySelectorAll(sel)].filter(visible); } catch { continue; }
                if (list.length === 1) return list[0];
            }
            const allInputs = [...document.querySelectorAll(
                'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"])'
            )].filter(visible);
            const re = LABELS[key];
            if (re) {
                const byLabel = allInputs.filter(el => labelTexts(el).some(t => re.test(t)));
                if (byLabel.length === 1) return byLabel[0];
            }
            const nameRe = {
                userid: /user_?id|user_?name/i,
                password: /pass/i,
                email: /e-?mail/i,
                telepon: /phone|telp|telepon|handphone|\bhp\b|whatsapp|\bwa\b/i,
                referral: /referal|referral|kode_?ref/i,
                rekening: /^(rekening|norek|no_?rek|nomor_?rekening|account_?(number|no))$/i,
                namarekening: /nama_?rek|atas_?nama|account_?name|pemilik/i
            }[key];
            if (nameRe) {
                const byName = allInputs.filter(el => nameRe.test(norm(el.name || el.id || '')));
                if (byName.length === 1) return byName[0];
            }
            return null;
        }
        function setBank(el, name) {
            if (el.tagName !== 'SELECT') {
                if (el.tagName === 'INPUT') { setValue(el, name); return true; }
                return false;
            }
            const want = norm(name).toUpperCase();
            const flat = s => s.replace(/[^A-Z]/g, '');
            let best = -1, bestScore = 0;
            [...el.options].forEach((o, i) => {
                const t = norm(o.textContent).toUpperCase();
                const v = norm(o.value).toUpperCase();
                if (o.disabled || !o.value || (!t && !v)) return;
                let s = 0;
                if (t === want || v === want) s = 5;
                else if (flat(t) === flat(want)) s = 4;
                else {
                    const aliases = {'CIMB':['CIMB NIAGA'], 'BANK JAGO':['JAGO'], 'LINK AJA':['LINKAJA']};
                    const candidates = [want, ...(aliases[want] || [])].map(flat);
                    if (candidates.includes(flat(t.replace(/^BANK\s+/, ''))) || candidates.includes(flat(t))) s = 3;
                }
                if (s > bestScore) { bestScore = s; best = i; }
            });
            if (best < 0) return false;
            el.selectedIndex = best;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        const els = {};
        const missing = [];
        for (const key of ['userid','password','email','telepon','rekening','namarekening']) {
            const el = findField(key);
            if (!el) { missing.push(key); continue; }
            els[key] = el;
            setValue(el, key === 'password' ? String(data[key] || '') : String(data[key] || '').trim());
        }
        if (missing.length) {
            throw new Error('Kolom tidak ditemukan: ' + missing.join(', '));
        }
        const referralField = findField('referral');
        if (referralField && !data.referral) setValue(referralField, '');
        if (data.referral) {
            const ref = referralField;
            if (!ref) throw new Error('Kolom referral tidak ditemukan.');
            setValue(ref, String(data.referral).trim());
        }
        let bankEl = null;
        for (const sel of BANK_SELECTORS) {
            const list = [...document.querySelectorAll(sel)].filter(visible);
            if (list.length) { bankEl = list[0]; break; }
        }
        if (!bankEl) {
            bankEl = [...document.querySelectorAll('select')].filter(visible)
                .find(s => labelTexts(s).some(t => /^(bank|nama\s*bank)$/i.test(t)));
        }
        if (!bankEl) throw new Error('Pilihan bank tidak ditemukan.');
        if (!setBank(bankEl, data.bank)) throw new Error(`Bank "${data.bank}" tidak ada di form.`);
        const form = els.userid.form || els.userid.closest('form');
        if (!form) throw new Error('Formulir pendaftaran tidak ditemukan.');
        if (new Set(Object.values(els)).size !== Object.keys(els).length || Object.values(els).some(el => el.form !== form) || bankEl.form !== form) throw new Error('Pemetaan kolom tidak cocok. Periksa formulir admin.');
        for (const el of form.querySelectorAll('input[type="password"]')) {
            if (el !== els.password && /confirm|repeat|retype|konfirmasi|password2|pass2/i.test(el.name+' '+el.id)) el.value = data.password;
        }
        const buttons = [...form.querySelectorAll('button,input[type="submit"]')].filter(el => !el.disabled && el.type === 'submit');
        const matching = buttons.filter(el => /tambah|simpan|daftar|register|kirim|save|proses/i.test(norm(el.textContent || el.value)));
        const choices = matching.length ? matching : buttons;
        if (choices.length > 1) throw new Error('Tombol Tambah Pemain belum dapat dipilih secara pasti.');
        const button = choices[0];
        const url = new URL(button?.getAttribute('formaction') || form.getAttribute('action') || page.url,page.url);
        if (url.origin !== ORIGIN || url.pathname !== new URL(REG_URL).pathname) throw new Error('Alamat submit Tambah Pemain berbeda. Pendaftaran belum dikirim.');
        const method = (button?.getAttribute('formmethod') || form.getAttribute('method') || 'GET').toUpperCase();
        if (method !== 'POST') throw new Error('Form admin tidak memakai POST. Pendaftaran belum dikirim.');
        if (!form.checkValidity()) throw new Error('Ada kolom wajib admin yang belum lengkap.');
        const params = new URLSearchParams();
        for (const [key,value] of new FormData(form)) {
            if (typeof value !== 'string') { if (value.size) throw new Error('Form meminta unggahan file.'); continue; }
            params.append(key,value);
        }
        if (button?.name) params.append(button.name,button.value);
        return {url:url.href,method,body:params.toString()};
    }

    function registrationMessages(doc) {
        const messages = [...doc.querySelectorAll('[role="alert"],.alert,.success,.error,.notification')].map(el => norm(el.textContent));
        const copy = doc.body?.cloneNode(true);
        if (copy) {
            copy.querySelectorAll('script,style,form,table,nav,header,footer').forEach(el => el.remove());
            for (const line of (copy.innerText || copy.textContent || '').split(/\r?\n/).map(norm)) {
                if (line && line.length <= 400 && /(?:email|e-mail|user\s*id|rekening|pendaftaran|password|telepon|referral).{0,100}(?:(?:sudah|telah)\s+(?:terdaftar|digunakan|ada)|tidak valid|gagal|ditolak)|(?:gagal|invalid|error|ditolak)/i.test(line)) messages.push(line);
            }
        }
        for (const script of doc.querySelectorAll('script:not([src])')) {
            for (const match of script.textContent.matchAll(/\balert\s*\(\s*(['"])([^'"\r\n]{1,300})\1\s*\)/g)) messages.push(norm(match[2]));
        }
        if (!doc.querySelector('form,input,table')) {
            const text = norm(doc.body?.textContent);
            if (text && text.length < 400) messages.push(text);
        }
        return messages.filter(Boolean);
    }

    function classifyRegistration(messages) {
        const bad = /gagal|kesalahan|error|invalid|duplikat|duplicate|(?:sudah|telah) (ada|terdaftar|digunakan)|already (exists|registered|used)|ditolak|tidak berhasil|belum berhasil|unsuccessful|not successful/i;
        const good = /berhasil|sukses|successfully|\bsuccess\b|telah (di)?tambah|ditambahkan|\bregistered\b|\bsaved\b/i;
        const failure = messages.find(m => bad.test(m));
        if (failure) return {ok:false,message:failure.slice(0,220)};
        const success = messages.find(m => good.test(m));
        return success ? {ok:true,message:success.slice(0,220)} : {ok:null,message:'Admin sudah membalas, tetapi status pendaftaran belum dapat dipastikan. Data tetap tersimpan di bubble; periksa User ID sebelum mengirim ulang.'};
    }

    function logDate(now = new Date()) {
        const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(now);
        const get = type => parts.find(p => p.type === type).value;
        return get('day') + '-' + get('month') + '-' + get('year');
    }

    async function verifyRegistrationLog(data,date,onProgress = () => {},adminResult = null) {
        let last = 'Hasil pencarian belum tersedia.';
        let lastState = 'unknown';
        for (let attempt = 1; attempt <= 3; attempt++) {
            onProgress('Memeriksa User ID di daftar pemain '+attempt+'/3 · '+data.userid);
            try {
                const result = await directCheck('uid',data.userid);
                lastState = result.state;
                last = result.message;
                if (result.state === 'taken') {
                    if (adminResult?.ok === false) return {ok:false,date,message:'GAGAL DAFTAR — '+adminResult.message+' User ID '+data.userid+' ditemukan di daftar pemain; jangan daftarkan ulang.'};
                    return {ok:true,date,message:'DONE DAFTAR — User ID '+data.userid+' terkonfirmasi di agentplayerlist.php.'};
                }
            } catch(error) {lastState = 'unknown'; last = error.message;}
            if (attempt < 3) await new Promise(resolve => setTimeout(resolve,1500));
        }
        const reason = adminResult?.ok === false ? adminResult.message : '';
        if (lastState === 'free') return {ok:false,date,message:'GAGAL DAFTAR — User ID '+data.userid+' tidak ditemukan di agentplayerlist.php. '+(reason ? 'Keterangan admin: '+reason : 'Admin belum memberikan alasan penolakan yang dapat dibaca.')};
        return {ok:null,date,message:(reason ? 'Keterangan admin: '+reason+'. ' : '')+'Pendaftaran belum dapat dikonfirmasi. Pemeriksaan User ID gagal: '+last+' Klik Cek User ID tanpa mengirim pendaftaran ulang.',adminResult};
    }

    async function registerDirect(data,onProgress = () => {}) {
        const page = await registrationRequest(REG_URL);
        const request = prepareRegistration(page,data);
        const date = logDate();
        let adminResult = null;
        onProgress('Mengirim pendaftaran…');
        try {
            const response = await registrationRequest(request.url,request.method,request.body);
            adminResult = classifyRegistration(registrationMessages(response.doc));
        } catch(error) {
            onProgress('Balasan pendaftaran belum pasti. Memeriksa User ID…');
        }
        return verifyRegistrationLog(data,date,onProgress,adminResult);
    }

    /* =====================================================================
       ============ BAGIAN 2: ROUTER UTAMA ============
       ===================================================================== */
    const _host = location.hostname.toLowerCase();
    const _path = location.pathname;

    // (A) LiveChat → bubble Admitoto
    if (_host === 'my.livechatinc.com') {
        if (document.readyState === 'loading')
            document.addEventListener('DOMContentLoaded', mountBubble, { once: true });
        else mountBubble();
        return;
    }

    // (B) Halaman admin Admitoto → bridge
    if (_host === 'agwl2.admitoto.com' && _path === '/agentnewplayer.php') {
        installBridge();
        return;
    }

    // (C) Halaman register Linetogel → cek email
    const isLinetogelHost =
        _host === 'gopath.id' || _host === 'www.gopath.id' ||
        _host === 'line38602.com' || _host === 'www.line38602.com' ||
        _host.endsWith('.line38602.com');
    if (isLinetogelHost && /\/register/i.test(_path)) {
        if (document.readyState === 'loading')
            document.addEventListener('DOMContentLoaded', startGopathRegisterTools, { once: true });
        else startGopathRegisterTools();
        return;
    }

    function startGopathRegisterTools() {
        if (window.top !== window.self) return;
        installGopathBackgroundWorker();
        // Pada tab pekerja latar belakang tidak tampilkan bubble kedua.
        if (!new URLSearchParams(location.search).has('tm_email_worker')) {
            mountLinetogelEmailChecker();
        }
    }

    /* =====================================================================
       ██ BUBBLE DI LIVECHAT (ADMITOTO) + EMAIL CHECKER
       ===================================================================== */
    function mountBubble() {
        if (window.top !== window.self || document.getElementById('admitoto-hub')) return;

        const host = document.createElement('div');
        host.id = 'admitoto-hub';
        host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;font:13px/1.5 system-ui';
        const root = host.attachShadow({ mode: 'open' });

        root.innerHTML = `
        <style>
        *{box-sizing:border-box}
        :host{color-scheme:light}
        button,input,select,textarea{font:inherit}
        button{cursor:pointer;border:0;background:none;color:inherit}
        button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #0d9488;outline-offset:3px}
        button:disabled{cursor:not-allowed;opacity:.55}
        .panel{display:flex;flex-direction:column;width:min(470px,calc(100vw - 24px));height:min(740px,calc(100dvh - 24px));min-width:min(320px,calc(100vw - 24px));min-height:min(360px,calc(100dvh - 16px));max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);resize:both;overflow:hidden;border:1px solid #cbd8e3;border-radius:20px;background:#f3f6fa;color:#203449;box-shadow:0 24px 70px #102c4433,0 4px 16px #102c441a;font:13px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;container-type:inline-size}
        .panel[hidden],.launcher[hidden],.result-card[hidden],[hidden]{display:none!important}
        header{position:relative;isolation:isolate;display:flex;align-items:center;gap:12px;padding:18px;background:linear-gradient(115deg,#152d46,#164f61);color:#fff;flex:none;cursor:grab;touch-action:none;user-select:none;overflow:hidden;border-bottom:3px solid #5ee1c4}
        header:after{content:'';position:absolute;z-index:-1;width:180px;height:180px;border:1px solid #ffffff14;border-radius:50%;right:-40px;top:-115px;box-shadow:0 0 0 22px #ffffff06,0 0 0 44px #ffffff04;pointer-events:none}
        .brand{display:grid;place-items:center;flex:none;width:40px;height:40px;border:1px solid #a2f5e2;border-radius:12px;background:#a2f5e2;color:#124d4b}
        .brand svg{width:23px;height:23px}
        .title{flex:1;min-width:0}.eyebrow{display:block;color:#a9e9df;font-size:10px;letter-spacing:1.5px;font-weight:700;margin-bottom:3px}
        .title strong{display:block;font-size:20px;line-height:1.25;letter-spacing:-.4px}.title small{display:block;font-size:11px;color:#d6e5ef;margin-top:5px}
        .icon-btn{display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:9px;background:#ffffff12;border:1px solid #ffffff30;color:inherit;font-size:21px}.icon-btn:hover{background:#ffffff28}
        .status{display:flex;align-items:center;gap:9px;padding:10px 18px;flex:none;border-bottom:1px solid #cce5db;background:#eaf7f0;color:#205b43;font-size:12px;line-height:1.5}
        .status-text{flex:1;min-width:0;overflow-wrap:anywhere}.dot{width:7px;height:7px;flex:none;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px #205b4310}
        .status[data-state=init]{color:#245782;background:#edf5ff;border-color:#d2e3f5}.status[data-state=warn]{color:#79500b;background:#fff6df;border-color:#eddbb1}.status[data-state=err]{color:#9c2945;background:#fff0f3;border-color:#efcad5}
        .status-btn{padding:6px 10px;border-radius:7px;background:#fff;border:1px solid currentColor;font-weight:700;flex:none}
        .regform{flex:1;min-height:0;overflow:auto;padding:16px;scrollbar-width:thin;scrollbar-color:#a7bacb #f3f6fa;scroll-padding-block:14px}
        .form-intro{display:none}
        .chat-import{margin:0 0 14px;padding:12px;border:1px solid #c5dfe7;border-radius:12px;background:#eaf4f8}
        .chat-import-top{display:flex;align-items:center;gap:11px}.chat-import-top button{padding:9px 11px;border-radius:8px;background:#165d70;color:#fff;font-size:12px;font-weight:700;flex:none}.chat-import-top button:hover{background:#104b5b}
        .chat-import-message{font-size:12px;color:#34566a;line-height:1.55;overflow-wrap:anywhere}.chat-import select{width:100%;margin-top:9px;padding:9px;background:#fff;border:1px solid #aabfcd;border-radius:8px;color:#203449;font-size:13px}
        .form-card{padding:15px;margin:0 0 14px;border:1px solid #dbe4ed;border-radius:14px;background:#fff;box-shadow:0 2px 5px #18354e04}
        .grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}
        .grid>label,.userid-block label,.rekening-block label{display:grid;grid-template-columns:106px minmax(0,1fr);align-items:center;gap:10px;min-width:0}
        .span2{grid-column:1/-1}
        .section-title{grid-column:1/-1;display:flex;align-items:center;gap:9px;padding-bottom:12px;margin-bottom:2px;border-bottom:1px solid #e5ebf1}
        .step{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:9px;background:#e3f5ef;color:#17614f;font-size:11px;font-weight:750}
        .bank-section .step{background:#eaf0fc;color:#365b9a}.section-title strong{display:block;font-size:14px;color:#203449}.section-title small{display:block;margin-top:1px;font-size:11px;color:#52677b}
        .lbl{display:block;margin:0;color:#374f65;font-size:12px;line-height:1.5;font-weight:650}.auto-badge{display:none}
        .field{position:relative;display:block;min-width:0}.field input,.field select{display:block;width:100%;min-width:0;height:42px;padding:10px 11px;border:1px solid #b8c8d6;border-radius:8px;background:#f9fbfd;color:#172f45;font-size:13px;transition:background .15s,border-color .15s,box-shadow .15s}
        .field input::placeholder{color:#61758a;opacity:1;font-size:12px}.field input:hover,.field select:hover{border-color:#7394aa;background:#fff}
        .field input:focus,.field select:focus{outline:none;border-color:#087f73;box-shadow:0 0 0 3px #0d948820;background:#fff}
        .field select{appearance:none;padding-right:30px;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23374f65' stroke-width='2'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 8px center;background-size:17px}
        .field select option,.field select optgroup{background:#fff;color:#203449}select[name=bank]{font-size:12px;font-weight:500}
        input[name=password]{padding-right:70px;letter-spacing:.3px;font-variant-numeric:tabular-nums}input[name=referral]{color:#22634e;background:#f0faf5;font-weight:650}
        input[name=rekening]{font-variant-numeric:tabular-nums}
        .eye,.regen{position:absolute;right:5px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:29px;height:30px;border-radius:6px;color:#47657b}.regen{right:36px;font-size:20px;color:#176b5b}.eye svg{width:17px;height:17px}
        .eye:hover,.regen:hover{background:#e0eee9}.eye[aria-pressed=true]{color:#14664f;background:#e0f3ea}
        .chip{display:none!important}
        .email-check-status{margin:-3px 0 3px 116px;padding:7px 10px;border:1px solid #cbd7e2;border-radius:8px;background:#f2f6fa;color:#486075;font-size:11px;line-height:1.5;overflow-wrap:anywhere}
        .email-check-status[data-state=checking]{border-color:#a3bce3;background:#eef5ff;color:#235787}
        .email-check-status[data-state=ok]{border-color:#87caa3;background:#e8f8ed;color:#216141;font-weight:700}
        .email-check-status[data-state=err]{border-color:#e6a2ad;background:#fff0f2;color:#ad3047;font-weight:700}
        .email-check-status[data-state=warn]{border-color:#e1c37e;background:#fff7e6;color:#805b10}
        .userid-status{display:flex;align-items:flex-start;gap:8px;margin:8px 0 0 116px;padding:9px 10px;border:1px solid #c9d7e3;border-left-width:3px;border-radius:8px;background:#f0f5fa;color:#425e76}
        .uid-symbol{display:grid;place-items:center;flex:none;width:24px;height:24px;border-radius:50%;background:#dce7f0;color:#3a5871;font-size:16px;font-weight:750}
        .uid-title{display:block;font-size:11px;font-weight:750;line-height:1.5;overflow-wrap:anywhere}.uid-detail{display:block;font-size:11px;line-height:1.55;margin-top:2px;overflow-wrap:anywhere}
        .userid-status[data-state=idle] .uid-detail{display:none}
        .userid-status[data-state=ok]{background:#edf9f1;border-color:#86c8a2;color:#205d39}.userid-status[data-state=ok] .uid-symbol{background:#ccebd8;color:#205d39}
        .userid-status[data-state=err]{background:#fff0f3;border-color:#e3a1b2;color:#9c2945}.userid-status[data-state=err] .uid-symbol{background:#f8d8e1;color:#9c2945}
        .userid-status[data-state=warn]{background:#fff7e5;border-color:#ddbd73;color:#79500b}.userid-status[data-state=warn] .uid-symbol{background:#f5e5ba;color:#79500b}
        .userid-status[data-state=checking],.userid-status[data-state=old]{background:#edf5ff;border-color:#a0bfdf;color:#285984}
        .userid-status[data-state=checking] .uid-symbol,.userid-status[data-state=old] .uid-symbol{background:#d5e7f7;color:#285984}.userid-status[data-state=checking] .uid-symbol{animation:spin 1.2s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .summary{display:none}
        .actions{display:flex;flex-wrap:wrap;flex:none;gap:8px;padding:12px 16px;background:#fff;border-top:1px solid #dbe4ed;box-shadow:0 -4px 12px #20344905}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:43px;padding:10px 13px;border-radius:9px;font-size:12px;font-weight:700;transition:background .15s,box-shadow .15s,transform .15s}.btn:active{transform:translateY(1px)}.btn svg{width:15px;height:15px}.btn-ico{font-size:17px}
        .btn.ghost{background:#f4f7fb;border:1px solid #c5d3e0;color:#3a546c}.btn.ghost:hover{background:#e8eff6}
        .btn.ghost.danger{background:#fff6f7;border-color:#e6c6cf;color:#a02d4a}.btn.ghost.danger:hover{background:#ffe8ed;border-color:#ce92a3}
        .btn.primary{flex:1;min-width:110px;background:linear-gradient(110deg,#116d62,#087f73);color:#fff;font-size:14px;box-shadow:0 4px 10px #087f731f}.btn.primary:hover{background:#105e55;box-shadow:0 5px 14px #087f7333}
        .result-card{margin-top:12px;padding:13px;border:1px solid #a7d5b9;border-radius:12px;background:#edf8f1}.result-heading{display:flex;align-items:center;gap:8px;color:#205d39;font-size:12px;margin-bottom:10px}.result-heading strong{flex:1}.result-heading>.icon-btn{width:27px;height:27px;background:#d9eee1;border-color:#b9d9c5;color:#205d39;font-size:18px}
        .result-card textarea{display:block;width:100%;min-height:150px;resize:vertical;padding:11px;border:1px solid #b6d2c0;border-radius:8px;background:#fff;color:#244b37;font:12px/1.8 ui-monospace,monospace;overflow-wrap:anywhere}
        .result-tools{display:flex;align-items:center;gap:10px;margin-top:10px}.copy-result{padding:9px 13px;border-radius:8px;background:#216a49;color:#fff;font-size:12px;font-weight:700}.copy-result:hover{background:#185337}.copy-feedback{flex:1;font-size:11px;color:#3c6650}
        footer{display:flex;align-items:center;justify-content:center;gap:6px;flex:none;border-top:1px solid #e3eaf1;background:#f7f9fc;padding:8px 12px;font-size:10px;color:#536a7f;line-height:1.5}footer svg{width:12px;height:12px;flex:none;color:#367767}
        .launcher{position:relative;display:grid;place-items:center;width:58px;height:58px;border:1px solid #8ce4d0;border-radius:20px;background:linear-gradient(140deg,#1b4a61,#126f67);color:#fff;box-shadow:0 8px 24px #163d5940;cursor:grab;touch-action:none;user-select:none;transition:box-shadow .2s,transform .2s}
        .launcher:hover{transform:translateY(-2px);box-shadow:0 12px 28px #163d5955}.launcher svg{width:27px;height:27px;pointer-events:none}.launcher .pulse{position:absolute;right:1px;top:1px;width:12px;height:12px;border:2px solid #fff;border-radius:50%;background:#77e8c1;pointer-events:none}
        .launcher .tip{position:absolute;right:70px;white-space:nowrap;padding:9px 12px;border-radius:10px;background:#183e54;color:#fff;font-size:12px;box-shadow:0 5px 16px #17384a26;opacity:0;pointer-events:none;transform:translateX(5px);transition:opacity .18s,transform .18s}.launcher:hover .tip,.launcher:focus-visible .tip{opacity:1;transform:translateX(0)}
        .transport{position:fixed;left:-10000px;top:0;width:1024px;height:768px;opacity:0;pointer-events:none;border:0}.transport iframe{width:100%;height:100%;border:0}
        .toasts{position:fixed;right:16px;bottom:100px;display:flex;flex-direction:column;gap:8px;z-index:2147483647;width:min(360px,calc(100vw - 32px));pointer-events:none}
        .toast{display:flex;align-items:flex-start;gap:10px;padding:13px;border:1px solid #c4d3e0;border-radius:12px;background:#fff;color:#29475e;box-shadow:0 10px 35px #123a4d26;font-size:12px;line-height:1.55;opacity:0;transform:translateY(10px);transition:opacity .2s,transform .2s;pointer-events:auto}.toast.show{opacity:1;transform:translateY(0)}
        .t-ico{display:grid;place-items:center;width:23px;height:23px;border-radius:7px;background:#e5eff8;color:#315f84;flex:none;font-weight:700}.t-msg{flex:1;overflow-wrap:anywhere}.toast-ok .t-ico{background:#d9f1e4;color:#216345}.toast-err .t-ico{background:#fbe2e8;color:#9c2945}.toast-warn .t-ico{background:#fff0cc;color:#79500b}
        @container(max-width:390px){.grid>label,.userid-block label,.rekening-block label{grid-template-columns:1fr;gap:5px}.userid-status{margin-left:0}.regform{padding:12px}.form-card{padding:12px}.title strong{font-size:18px}.chat-import-top{align-items:flex-start;flex-wrap:wrap}}
        @media(max-width:390px){.panel{border-radius:15px}header{padding:14px}.actions{padding:10px}.btn{padding:10px}.title small{font-size:10px}}
        @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}

        :host{color-scheme:dark}
        .panel{background:radial-gradient(ellipse at 100% 0%,#51417a45,transparent 55%),radial-gradient(ellipse at 0% 100%,#245b6a30,transparent 50%),#191a29;color:#eeeaf8;border-color:#57516f;box-shadow:0 25px 75px #10101c80,0 0 0 1px #c7b5ff0c,inset 0 1px 0 #ffffff12}
        header{background:linear-gradient(115deg,#29253f,#453660 65%,#33445d);border-bottom-color:#bca4ed}
        header:after{border-color:#d9caff25;box-shadow:0 0 0 23px #d9caff08,0 0 0 46px #d9caff05}
        .brand{background:linear-gradient(145deg,#e1d1ff,#b4c8f6);border-color:#e7ddff;color:#392956;box-shadow:0 4px 16px #0f0b2426}
        .eyebrow{color:#d9c7ff}.title small{color:#ddd6ec}.icon-btn{background:#ffffff0c;border-color:#ffffff24}.icon-btn:hover{background:#ffffff20}
        .status{background:#233b36;color:#bdebd8;border-color:#3f5c53}
        .status[data-state=init]{background:#26334a;color:#c3dafe;border-color:#445877}
        .status[data-state=warn]{background:#443923;color:#ffe2a5;border-color:#6a5837}
        .status[data-state=err]{background:#472c3a;color:#ffcad9;border-color:#704459}
        .status-btn{background:#d9c8fa;color:#35254b;border-color:#d9c8fa}
        .regform{background:radial-gradient(ellipse at 5% 20%,#8d6ccd16,transparent 50%),radial-gradient(ellipse at 95% 80%,#568daf12,transparent 55%);scrollbar-color:#625878 #1b1b2b}
        .chat-import{background:linear-gradient(120deg,#34304d,#29374a);border-color:#5a5578;box-shadow:inset 0 1px 0 #ffffff07}
        .chat-import-top button{background:#d6c3fa;color:#35224f;box-shadow:0 3px 10px #12101e26}.chat-import-top button:hover{background:#e5d7ff}.chat-import-message{color:#ded9ec}
        .chat-import select{background:#211f33;border-color:#6d6487;color:#f2edff}
        .form-card{background:linear-gradient(130deg,#2b293eeF,#242536f5);border-color:#49455e;box-shadow:0 5px 15px #0d0b171c,inset 0 1px 0 #ffffff05}
        .section-title{border-color:#464155}.section-title strong{color:#f1ebfc}.section-title small{color:#c2b9d2}
        .step{background:#493d64;color:#e5d5ff;border:1px solid #66527f}.bank-section .step{background:#34445e;color:#d2e0ff;border-color:#50678a}
        .lbl{color:#e2dbee}
        .field input,.field select{background:#1d1e30;color:#f7f2ff;border-color:#68607d;box-shadow:inset 0 1px 3px #00000012}
        .field input::placeholder{color:#b4aac4}.field input:hover,.field select:hover{background:#242237;border-color:#9684b5}
        .field input:focus,.field select:focus{background:#27233c;border-color:#ccb0ff;box-shadow:0 0 0 3px #c4a2ff20}
        .field select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23daceed' stroke-width='2'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E")}
        .field select option,.field select optgroup{background:#252337;color:#f2edff}
        input[name=referral]{background:#273731;color:#c1ecd6}
        .eye{color:#cbbfe0}.regen{color:#d5bcfa}.eye:hover,.regen:hover{background:#443653}.eye[aria-pressed=true]{background:#4b3d61;color:#efddff}
        button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline-color:#d2b7ff}
        .userid-status{background:#302d43;border-color:#625976;color:#ddd2ed}.uid-symbol{background:#49405d;color:#eadcff}
        .userid-status[data-state=ok]{background:#243c32;border-color:#609a7b;color:#c2f1d5}.userid-status[data-state=ok] .uid-symbol{background:#365f47;color:#d2ffe0}
        .userid-status[data-state=err]{background:#442a39;border-color:#b2738c;color:#ffd0df}.userid-status[data-state=err] .uid-symbol{background:#713e54;color:#ffe0e9}
        .userid-status[data-state=warn]{background:#403723;border-color:#a68b56;color:#ffe4ad}.userid-status[data-state=warn] .uid-symbol{background:#665231;color:#ffedc7}
        .userid-status[data-state=checking],.userid-status[data-state=old]{background:#29364b;border-color:#6e88af;color:#cee2ff}.userid-status[data-state=checking] .uid-symbol,.userid-status[data-state=old] .uid-symbol{background:#405674;color:#e3eeff}
        .actions{background:linear-gradient(100deg,#292538,#252739);border-color:#4b445e;box-shadow:0 -5px 18px #0a071b20}
        .btn.ghost{background:#373448;border-color:#69607d;color:#e9e1f4}.btn.ghost:hover{background:#484058}
        .btn.ghost.danger{background:#422b3c;border-color:#8b546f;color:#ffc7dc}.btn.ghost.danger:hover{background:#563349;border-color:#b67593}
        .btn.primary{background:linear-gradient(115deg,#d3b4fa,#b8baf2);color:#302044;box-shadow:0 4px 15px #b595ec25}.btn.primary:hover{background:linear-gradient(115deg,#e3caff,#cfcef9);box-shadow:0 5px 20px #b595ec35}
        .result-card{background:linear-gradient(130deg,#293e38,#273b3e);border-color:#5e8f79}.result-heading{color:#c4f0d7}.result-heading>.icon-btn{background:#3b574a;border-color:#64816e;color:#e0ffeb}
        .result-card textarea{background:#1b2b29;color:#dff7e9;border-color:#557668}.copy-result{background:#bce9ce;color:#204632}.copy-result:hover{background:#d2f7df}.copy-feedback{color:#c4dfcf}
        footer{background:#1c1b2b;border-color:#413b54;color:#c1b7d0}footer svg{color:#c0acd9}
        .launcher{width:62px;height:62px;border-radius:21px;background:radial-gradient(circle at 22% 15%,#e4c8ff45,transparent 48%),linear-gradient(140deg,#755799,#494874 65%,#34576b);border:1px solid #c5a9ee;color:#f7eeff;box-shadow:0 8px 25px #21153470,inset 0 1px 0 #f4deff55}
        .launcher:before{content:'';position:absolute;inset:5px;border:1px solid #e9d5ff25;border-radius:16px;pointer-events:none}.launcher:hover{box-shadow:0 12px 32px #68428d60,inset 0 1px 0 #ffffff50}
        .launcher .pulse{background:#b4eccf;border-color:#393149}.launcher .tip{background:#39304e;color:#f5eaff;border:1px solid #8f78ac}
        .toast{background:#302b43;color:#f3eafa;border-color:#726383;box-shadow:0 12px 35px #09071466}.t-ico{background:#49405f;color:#e7d6ff}.toast-ok .t-ico{background:#365642;color:#d0f5de}.toast-err .t-ico{background:#6c3c51;color:#ffdae7}.toast-warn .t-ico{background:#655131;color:#ffe6b5}

        .panel{width:min(540px,calc(100vw - 24px));height:min(790px,calc(100dvh - 24px));background:radial-gradient(ellipse at top right,#45657930,transparent 60%),#1c2935;border-color:#566775;font-size:15px}
        header{background:linear-gradient(115deg,#243645,#354c5d);border-bottom-color:#d5b77c;padding:19px 20px}
        .brand{background:linear-gradient(135deg,#efdbad,#cdb27b);color:#3d3524;border-color:#ead5a4}.eyebrow{color:#ecd6aa;font-size:11px}.title strong{font-size:23px}.title small{font-size:13px;color:#d9e3e9}
        .status{font-size:14px;padding:12px 20px}.status-btn{font-size:13px}
        .regform{padding:20px;background:radial-gradient(ellipse at top right,#71899a12,transparent 65%);scrollbar-color:#71818c #1c2935}
        .chat-import{background:#2a3d4b;border-color:#556c7c;padding:13px;margin-bottom:20px}.chat-import-top button{background:#e0c58e;color:#332c20;font-size:14px}.chat-import-top button:hover{background:#efd7a9}.chat-import-message{font-size:14px;color:#e0e9ef}.chat-import select{background:#202f3c;border-color:#718796;color:#f3f6fa;font-size:15px}
        .form-card{padding:0;margin:0;border:0;border-radius:0;background:none;box-shadow:none}
        .form-card+.form-card{margin-top:16px}
        .section-title{display:none}
        .grid{gap:16px}.grid>label,.userid-block label,.rekening-block label{grid-template-columns:128px minmax(0,1fr);gap:12px}
        .lbl{font-size:15px;line-height:1.5;color:#edf1f5;font-weight:600}
        .field input,.field select{height:48px;font-size:16px;background:#172531;color:#f5f7fa;border-color:#738592;border-radius:9px;padding-top:11px;padding-bottom:11px}
        .field input::placeholder{font-size:14px;color:#b7c5cf}.field input:hover,.field select:hover{background:#213341;border-color:#9eafb9}
        .field input:focus,.field select:focus{background:#243743;border-color:#e2c58d;box-shadow:0 0 0 3px #dfbf8325}
        .field select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e1d4b7' stroke-width='2'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E")}
        select[name=bank]{font-size:15px}.field select option,.field select optgroup{background:#223442;color:#f5f7fa}
        input[name=referral]{background:#30392f;color:#efe0ba}
        .eye{color:#d9dfdf}.regen{color:#ead09e;font-size:23px}.eye:hover,.regen:hover{background:#4b4c41}.eye[aria-pressed=true]{background:#4b4c41;color:#ffe6ae}
        .userid-status{margin-left:140px;padding:10px 11px;background:#2b3c4a;color:#dce6ed;border-color:#607686}.uid-symbol{background:#465b6b;color:#e7edf2;width:27px;height:27px;font-size:18px}.uid-title{font-size:13px}.uid-detail{font-size:13px}
        .actions{background:#263845;border-color:#506572;padding:15px 20px;gap:10px}.btn{font-size:15px;min-height:48px;padding:12px 15px}.btn.primary{font-size:17px;background:linear-gradient(110deg,#e5cca0,#ccae76);color:#30291e;box-shadow:0 4px 15px #d9bc7d18}.btn.primary:hover{background:linear-gradient(110deg,#f2ddb6,#dfc18a)}
        .btn.ghost{background:#334957;color:#edf3f6;border-color:#718491}.btn.ghost:hover{background:#415a69}
        .btn.ghost.danger{background:#49323b;color:#ffd3dc;border-color:#936473}.btn.ghost.danger:hover{background:#5d3c49}
        footer{background:#1d2b37;border-color:#475b69;color:#c3d0d9;font-size:12px;padding:10px 14px}
        .result-heading{font-size:15px}.result-card textarea{font-size:14px;min-height:180px}.copy-result{font-size:14px}.copy-feedback{font-size:13px}
        .launcher{background:radial-gradient(circle at 20% 10%,#ead5a535,transparent 55%),linear-gradient(135deg,#4a6270,#263b4a);border-color:#dbbe83;color:#f6dfb2;box-shadow:0 8px 25px #12202c70,inset 0 1px 0 #e7d4ab45}.launcher:before{border-color:#dcc49335}.launcher:hover{box-shadow:0 12px 32px #10273870}.launcher .pulse{border-color:#314453;background:#e4cc99}.launcher .tip{background:#2c404f;border-color:#9b8e72;color:#f9e8c5;font-size:14px}
        .toast{background:#293e4d;color:#f2f6f9;border-color:#708593;font-size:14px}.t-ico{background:#485b68;color:#f1dab0}
        button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline-color:#e5c78c}
        @container(max-width:440px){.grid>label,.userid-block label,.rekening-block label{grid-template-columns:1fr;gap:7px}.userid-status{margin-left:0}.regform{padding:16px}.title strong{font-size:21px}.chat-import-top{flex-wrap:wrap}.form-card{padding:0}}

        .panel{border-radius:24px;border:1px solid #8d815f;background:radial-gradient(ellipse at 100% 0%,#b89b6120,transparent 45%),linear-gradient(155deg,#1d2c3b,#152331 70%);box-shadow:0 28px 80px #07111b80,0 8px 24px #07111b40,inset 0 1px 0 #fce4b72b}
        header{padding:23px 22px 21px;gap:14px;background:radial-gradient(ellipse at 95% 0%,#bda26d28,transparent 65%),linear-gradient(115deg,#1d3043,#294252);border-bottom:1px solid #bba16d6b}
        header:after{width:240px;height:240px;right:-100px;top:-150px;border-color:#ebd39e25;box-shadow:0 0 0 22px #ebd39e09,0 0 0 44px #ebd39e05}
        .brand{width:47px;height:47px;border-radius:15px;background:linear-gradient(145deg,#f5e3b8,#bea16c);box-shadow:0 5px 16px #0003,inset 0 1px 0 #fff8}.brand svg{width:25px;height:25px}
        .eyebrow{letter-spacing:2px;font-size:10px;color:#e1c895;margin-bottom:5px}.title strong{font-weight:700;letter-spacing:-.5px;font-size:24px}.title small{color:#ccd8e2;margin-top:7px;font-size:13px}
        header>.icon-btn{width:34px;height:34px;background:#12243350;border-color:#c6d8e12b;border-radius:11px;color:#eee6d6}
        .status{padding:11px 22px;font-size:13px;line-height:1.6}.dot{width:6px;height:6px;box-shadow:0 0 0 4px #9bd5b712}
        .regform{padding:20px 22px;background-image:radial-gradient(circle at 1px 1px,#b8cbd20b 1px,transparent 0),radial-gradient(ellipse at 0% 100%,#486d7b16,transparent 60%);background-size:20px 20px,100% 100%;scrollbar-width:thin;scrollbar-color:#65798a transparent}
        .chat-import{position:relative;padding:14px;border-radius:13px;border-color:#7f8e944d;background:linear-gradient(120deg,#324857bb,#263c4dbb);box-shadow:inset 0 1px 0 #ffffff08,0 4px 12px #07111b12;margin-bottom:23px}
        .chat-import-top{gap:13px}.chat-import-top button{border:1px solid #f3dfb0a6;background:linear-gradient(135deg,#e9d5aa,#c5a873);padding:10px 13px;border-radius:9px;font-size:13px;box-shadow:0 3px 10px #08141c33;color:#332b1e}.chat-import-top button:hover{background:linear-gradient(135deg,#f6e5bf,#dac08d)}.chat-import-message{font-size:13px;line-height:1.65;color:#dde6ec}
        .grid{gap:15px}.form-card+.form-card{margin-top:15px}.lbl{font-size:15px;color:#e4ebef;letter-spacing:.05px;font-weight:550}
        .field input,.field select{height:49px;border-radius:11px;border-color:#536a7b;background-color:#142330;box-shadow:inset 0 2px 5px #050c141a,0 1px 0 #ffffff06;font-size:16px;padding-left:13px;transition:border-color .16s,background-color .16s,box-shadow .16s}
        .field input::placeholder{color:#a8b9c6;font-size:14px}.field input:hover,.field select:hover{background-color:#1b2e3d;border-color:#899da9}.field input:focus,.field select:focus{background-color:#1e3241;border-color:#e1c78f;box-shadow:0 0 0 3px #d7b97b20,inset 0 1px 3px #0001}
        input[name=referral]{background-color:#2c352f;color:#ecd7a8;border-color:#717b64}
        .userid-status{border-radius:10px;border-left-width:3px;padding:10px 12px;margin-top:9px;box-shadow:inset 0 1px 0 #ffffff06}.uid-title{font-size:13px;letter-spacing:.2px}.uid-detail{font-size:12px;line-height:1.65}
        .userid-status[data-state=idle]{background:#293d4b;color:#c8d7e1;border-color:#526b7c}.userid-status[data-state=idle] .uid-symbol{background:#3b5363;color:#dbe5ec}
        .eye,.regen{height:32px;width:30px;border-radius:8px}.eye svg{width:18px;height:18px}
        .actions{padding:16px 22px;background:linear-gradient(115deg,#253a49,#203240);border-top:1px solid #8a7a594d;box-shadow:0 -6px 22px #0b16211a;gap:10px}
        .btn{min-height:49px;border-radius:12px;font-size:14px;letter-spacing:.1px}.btn.primary{background:linear-gradient(115deg,#f0deb4,#d9bc83 60%,#c4a56c);border:1px solid #f3dfb4;color:#30291e;font-size:17px;box-shadow:0 5px 15px #0002,inset 0 1px 0 #fff6}.btn.primary:hover{background:linear-gradient(115deg,#f9eac9,#e5cd9a);box-shadow:0 6px 19px #d6b57c24}.btn.primary .btn-ico{font-size:21px}
        .btn.ghost{background:#2e4352;border-color:#627887;color:#e0e9ee}.btn.ghost:hover{background:#3b5363}.btn.ghost.danger{background:#41313b;border-color:#805767;color:#f2c4d1}.btn.ghost.danger:hover{background:#573b49}
        footer{background:#192b38;border-color:#4056656b;color:#b6c6d1;font-size:11px;padding:11px 16px;line-height:1.6}footer svg{color:#dcc28f;width:13px;height:13px}
        .result-card{border-radius:14px;padding:16px;background:linear-gradient(130deg,#29453b,#233c3d);box-shadow:0 5px 18px #0001}.result-card textarea{border-radius:10px;padding:13px}
        .launcher{width:66px;height:66px;border-radius:23px;background:radial-gradient(circle at 20% 5%,#e3c48c35,transparent 50%),linear-gradient(135deg,#3c5667,#192f40 70%);border:1px solid #d5b77e;color:#f3dcae;box-shadow:0 10px 28px #0a172760,inset 0 1px 0 #f6e1b75c,0 0 0 4px #d5b77e0b}.launcher:before{inset:6px;border-radius:17px;border-color:#ddc28d40}.launcher svg{width:29px;height:29px;filter:drop-shadow(0 2px 4px #0003)}.launcher:hover{box-shadow:0 14px 36px #0a172775,0 0 0 4px #d5b77e1a;transform:translateY(-2px)}.launcher .pulse{top:1px;right:1px;width:13px;height:13px;border-color:#253c4b;background:#eed39b}.launcher .tip{right:79px;border-radius:11px;border-color:#b9a374;color:#f3e1bb;background:#263d4d}
        @container(max-width:440px){header{padding:18px 16px;gap:10px}.title strong{font-size:21px}.title small{font-size:12px}.regform{padding:17px 16px}.actions{padding:14px 16px}.brand{width:40px;height:40px;border-radius:12px}.status{padding:10px 16px}.chat-import-top{flex-wrap:wrap}}

        .password-options{min-width:0;margin:0 0 2px 140px;padding:0;border:0}
        .password-options legend{padding:0;margin-bottom:9px;font-size:13px;font-weight:600;color:#d4dbe2}
        .password-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
        .password-choices label{display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:9px 5px;border:1px solid #71808d;border-radius:11px;background:#263947;color:#d6e1e9;cursor:pointer;font-size:14px;font-weight:700;transition:background .15s,border-color .15s}
        .password-choices label:has(input:checked){background:linear-gradient(135deg,#653947,#492d39);border-color:#c66b82;color:#ffedf2}
        .password-choices label:hover{border-color:#e6a0b0}
        .password-choices input{width:15px;height:15px;margin:0;accent-color:#f25477;cursor:pointer;flex:none}
        .password-options small{display:block;margin-top:8px;color:#b9c8d3;font-size:11px;line-height:1.6}
        @container(max-width:440px){.password-options{margin-left:0}}
        </style>

        <section class="panel" hidden aria-label="Formulir pendaftaran pemain">
            <header id="hdr">
                <span class="brand">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                        <circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M19 8v8m-4-4h8"/>
                    </svg>
                </span>
                <div class="title">
                    <span class="eyebrow">ADMITOTO · LIVECHAT</span>
                    <strong>Daftar pemain</strong>
                    <small>Isi data → klik Daftar → salin hasil</small>
                </div>
                <button type="button" class="icon-btn" id="min" title="Kecilkan panel" aria-label="Kecilkan panel">×</button>
            </header>

            <div role="status" aria-live="polite" class="status" id="status" data-state="ok">
                <span class="dot"></span>
                <span class="status-text">Pencarian langsung siap • ketik User ID untuk memeriksa</span>
                <button type="button" class="status-btn" id="activateBtn" hidden>Aktifkan</button>
            </div>

            <form class="regform" id="regform" novalidate autocomplete="off">
                <div class="chat-import"><div class="chat-import-top"><button type="button" id="readChatAccount">Cari rekening</button><span id="chatImportMessage" class="chat-import-message" role="status" aria-live="polite">Buka bubble untuk mencari rekening dari chat aktif.</span></div><select id="chatAccountChoice" aria-label="Pilih rekening dari chat" hidden></select></div>
                <div class="form-intro"><strong>Formulir pendaftaran</strong><span>Password & referral otomatis</span></div>
                <div class="grid form-card">
                    <div class="section-title"><span class="step">01</span><div><strong>Data akun</strong><small>Identitas dan akses pemain baru</small></div></div>
                    <div class="span2 userid-block"><label>
                        <span class="lbl">User ID</span>
                        <span class="field">
                            <input name="userid" type="text" aria-describedby="useridStatus" required placeholder="huruf & angka, 3-20" spellcheck="false">
                            <span class="chip" data-chip="userid" hidden></span>
                        </span>
                    </label>
                        <div id="useridStatus" class="userid-status" data-state="idle" role="status" aria-live="polite" aria-atomic="true">
                            <span class="uid-symbol" aria-hidden="true">○</span>
                            <div><strong class="uid-title">BELUM DIPERIKSA</strong><span class="uid-detail">Ketik User ID untuk memeriksa ketersediaannya.</span></div>
                        </div>
                    </div>

                    <label>
                        <span class="lbl">Password <span class="auto-badge">Otomatis</span></span>
                        <span class="field">
                            <input name="password" type="password" required minlength="10" maxlength="10" pattern="[A-Za-z0-9]{10}" placeholder="10 karakter otomatis" autocomplete="new-password">
                            <button type="button" class="regen" id="generatePassword" aria-label="Buat password baru 10 karakter" title="Buat password baru">↻</button>
                            <button type="button" class="eye" id="eye" aria-label="Tampilkan password" aria-pressed="false">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                            </button>
                        </span>
                    </label>

                    <fieldset class="password-options span2">
                        <legend>Karakter yang digunakan</legend>
                        <div class="password-choices">
                            <label><input type="checkbox" data-password-group="upper" checked><span>A-Z</span></label>
                            <label><input type="checkbox" data-password-group="lower" checked><span>a-z</span></label>
                            <label><input type="checkbox" data-password-group="digits" checked><span>0-9</span></label>
                        </div>
                        <small>10 karakter · centang pilihan, lalu klik ↻</small>
                    </fieldset>

                    <label>
                        <span class="lbl">Email</span>
                        <span class="field">
                            <input name="email" type="email" required placeholder="player@email.com">
                            <span id="gopathEmailStatus" aria-hidden="true" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:20px;display:none;font-weight:800;"></span>
                        </span>
                    </label>
                    <div class="email-check-status" id="gopathEmailMessage" data-state="idle" role="status" aria-live="polite">Tempel email untuk memeriksa otomatis di formulir Gopath.</div>

                    <label>
                        <span class="lbl">Telepon</span>
                        <span class="field"><input name="telepon" type="tel" required placeholder="0812xxxxxxx"></span>
                    </label>

                    <label class="span2">
                        <span class="lbl">Referral <span class="auto-badge">Terisi otomatis</span></span>
                        <span class="field"><input name="referral" type="text" value="504rf" placeholder="504rf" spellcheck="false"></span>
                    </label>

                </div>
                <div class="grid form-card">
                    <div class="section-title bank-section"><span class="step">02</span><div><strong>Data rekening</strong><small>Bank atau dompet digital pemain</small></div></div>
                    <label class="span2">
                        <span class="lbl">Bank / E-wallet</span>
                        <span class="field">
                            <select name="bank" required aria-label="Pilih bank atau dompet digital">
                                <option value="">Pilih bank / e-wallet</option>
                                <optgroup label="Bank">${BANKS.slice(0,10).map(b => `<option value="${b}">${b}</option>`).join('')}</optgroup>
                                <optgroup label="Dompet digital">${BANKS.slice(10).map(b => `<option value="${b}">${b}</option>`).join('')}</optgroup>
                            </select>
                        </span>
                    </label>

                    <div class="span2 rekening-block"><label>
                        <span class="lbl">Nomor Rekening</span>
                        <span class="field">
                            <input name="rekening" type="text" inputmode="numeric" aria-describedby="rekeningStatus" required placeholder="hanya angka">
                            <span class="chip" data-chip="rekening" hidden></span>
                        </span>
                    </label>
                        <div id="rekeningStatus" class="userid-status" data-state="idle" role="status" aria-live="polite" aria-atomic="true">
                            <span class="uid-symbol" aria-hidden="true">○</span>
                            <div><strong class="uid-title">BELUM DIPERIKSA</strong><span class="uid-detail">Ketik nomor rekening untuk memeriksa ketersediaannya.</span></div>
                        </div>
                    </div>

                    <label class="span2">
                        <span class="lbl">Nama Rekening</span>
                        <span class="field"><input name="namarekening" type="text" required placeholder="sesuai buku tabungan"></span>
                    </label>
                </div>

                <div class="summary">
                    <div class="sum" data-sum="uid" data-state="idle">
                        <span class="sum-ico">○</span>
                        <span class="sum-text">User ID belum diperiksa</span>
                    </div>
                    <div class="sum" data-sum="rek" data-state="idle">
                        <span class="sum-ico">○</span>
                        <span class="sum-text">Rekening belum diperiksa</span>
                    </div>
                </div>

                <section class="result-card" id="registrationResult" hidden aria-label="Hasil pendaftaran terakhir yang berhasil">
                    <div class="result-heading"><span aria-hidden="true">✓</span><strong>Pendaftaran terakhir berhasil</strong><button type="button" class="icon-btn" id="dismissResult" aria-label="Hapus tampilan hasil">×</button></div>
                    <textarea id="registrationText" readonly aria-label="Pesan akun untuk disalin" spellcheck="false"></textarea>
                    <div class="result-tools"><button type="button" class="copy-result" id="copyResult">Salin hasil</button><span class="copy-feedback" id="copyFeedback" role="status" aria-live="polite">Pesan siap disalin.</span></div>
                </section>

            </form>
                <div class="actions">
                    <button type="button" class="btn ghost danger" id="clearForm" form="regform">Hapus</button>
                    <button type="button" class="btn ghost" id="checkRegistrationLog" form="regform" hidden>Cek User ID</button>
                    <button type="button" class="btn ghost" id="recheck" form="regform"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3"/></svg>Cek Ulang</button>
                    <button type="submit" class="btn primary" id="sendBtn" form="regform">
                        <span class="btn-ico">↗</span>
                        <span class="btn-label">Daftar</span>
                    </button>
                </div>

            <footer><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Gunakan sesi admin aktif untuk memeriksa dan mendaftarkan pemain.</footer>
        </section>

        <div class="transport"><iframe id="bridge" title="Admitoto" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-popups-to-escape-sandbox"></iframe></div>

        <button type="button" class="launcher" aria-expanded="false" aria-label="Buka formulir daftar pemain">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="9" cy="7" r="3.5"/>
                <path d="M2.5 21v-2a6.5 6.5 0 0 1 13 0v2M19 8v8m-4-4h8"/>
            </svg>
            <span class="pulse"></span>
            <span class="tip">＋ Daftar pemain baru</span>
        </button>

        <div class="toasts" id="toasts"></div>`;

        document.body.appendChild(host);

        const $ = s => root.querySelector(s);
        const panel = $('.panel');
        const iframe = $('#bridge');
        const form = $('#regform');
        function applyAccountDefaults() {
            form.elements.password.value = generatePassword();
            form.elements.referral.value = DEFAULT_REFERRAL;
        }
        applyAccountDefaults();
        root.querySelectorAll('[data-password-group]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                if (state.sending) {
                    checkbox.checked = selectedPasswordGroups.includes(checkbox.dataset.passwordGroup);
                    return;
                }
                const selected = [...root.querySelectorAll('[data-password-group]:checked')]
                    .map(el => el.dataset.passwordGroup);
                if (!selected.length) {
                    checkbox.checked = true;
                    toast('Pilih minimal satu kelompok karakter.', 'warn');
                    return;
                }
                selectedPasswordGroups = selected;
            });
        });
        $('#generatePassword').addEventListener('click', () => {
            if (state.sending) return;
            form.elements.password.value = generatePassword();
            toast('Password 10 karakter sesuai pilihan sudah dibuat.', 'info');
        });
        const statusBar = $('#status');
        const statusText = statusBar.querySelector('.status-text');
        const activateBtn = $('#activateBtn');
        const sendBtn = $('#sendBtn');
        const toasts = $('#toasts');

        const versions = { uid: 0, rek: 0 };
        const state = {
            ready: false,
            source: null,
            popup: null,
            pending: new Map(),
            lastCheck: { uid: null, rek: null },
            sending: false,
            uncertainUser: null,
            pendingRegistration: null,
            autoLoadTimer: null,
            iframeReadyTimer: null,
            checks: { uid: { timer: null, value: '' }, rek: { timer: null, value: '' } }
        };

        let importEpoch = 0;
        let lastImportKey = '';
        let lastAutoFilled = '';
        let importBusy = false;
        const importNames = ['userid','rekening','namarekening','bank'];
        const formFingerprint = () => importNames.map(name => form.elements[name].value).join('\n');
        form.addEventListener('input', () => { ++importEpoch; });
        form.addEventListener('change', event => { if (event.target.name) ++importEpoch; });

        // === PERBAIKAN v12: pemeriksaan email dari tab Gopath yang tidak aktif ===
        // Iframe dihapus karena situs dapat memakai X-Frame-Options / frame-ancestors.
        // Tab latar belakang dibuka saat dibutuhkan dan otomatis ditutup setelah hasil diterima.
        const EMAIL_REQ_KEY = 'tm_gopath_email_req_v12';
        const EMAIL_RES_KEY = 'tm_gopath_email_res_v12';
        const EMAIL_HEARTBEAT_KEY = 'tm_gopath_email_heartbeat_v12';
        const EMAIL_WORKER_URL = 'https://line38602.com/register?referral_code=504rf&tm_email_worker=1';
        const emailStatusInd = $('#gopathEmailStatus');
        const emailMessage = $('#gopathEmailMessage');
        const emailField = form.elements.email;
        let emailDebounce = null;
        let emailSequence = 0;
        let emailPending = null;
        let emailWorkerLaunchAt = 0;
        let emailWorkerTab = null;
        // Penanda agar heartbeat milik tab yang baru saja ditutup tidak membuat
        // pemeriksaan berikutnya keliru mengira tab pekerja masih aktif.
        let emailWorkerNeedsLaunch = false;
        let observedEmailValue = emailField.value;
        let emailLastResolved = null; // Hindari membuka tab lagi untuk email yang baru saja memperoleh hasil.

        function closeOwnedEmailWorker() {
            // HANYA tab yang dibuat lewat GM_openInTab; tab pengguna tidak disentuh.
            const tab = emailWorkerTab;
            if (!tab) return;
            emailWorkerTab = null;
            emailWorkerNeedsLaunch = true;
            emailWorkerLaunchAt = 0;
            try {
                if (typeof tab.close === 'function') tab.close();
                else console.warn('[Gopath email] Pengendali tab tidak menyediakan metode close().');
            } catch (e) {
                console.warn('[Gopath email] Gagal menutup tab pemeriksaan:', e);
            }
        }

        function emailIndicator(status, message) {
            const icons = { idle:'', checking:'⟳', ok:'✓', err:'✕', warn:'?' };
            const colors = { checking:'#69a9ff', ok:'#31c888', err:'#ff667f', warn:'#e8b65e' };
            emailStatusInd.style.display = icons[status] ? 'block' : 'none';
            emailStatusInd.textContent = icons[status] || '';
            emailStatusInd.style.color = colors[status] || '';
            // Untuk hasil email: hanya indikator ✓ atau ✕ di dalam kolom.
            // Pesan panjang tetap digunakan saat proses berjalan atau ada kendala.
            const finalResult = status === 'ok' || status === 'err';
            emailStatusInd.title = finalResult ? '' : message;
            emailStatusInd.setAttribute('aria-label', status === 'ok' ? 'Email tersedia' : status === 'err' ? 'Email sudah digunakan' : message);
            emailMessage.dataset.state = status;
            emailMessage.textContent = finalResult ? '' : message;
            emailMessage.hidden = finalResult;
        }

        function stopEmailCheck() {
            clearTimeout(emailDebounce);
            if (emailPending) clearTimeout(emailPending.timeout);
            emailPending = null;
            ++emailSequence;
        }

        function workerFresh() {
            try {
                const hb = GM_getValue(EMAIL_HEARTBEAT_KEY, null);
                return hb && typeof hb.at === 'number' && Date.now() - hb.at < 5500;
            } catch { return false; }
        }

        function ensureEmailWorker() {
            // Sesudah tab ditutup, abaikan heartbeat sementara dari tab lama.
            if (!emailWorkerNeedsLaunch && workerFresh()) return true;
            if (!emailWorkerNeedsLaunch && Date.now() - emailWorkerLaunchAt < 10500) return true;
            if (typeof GM_openInTab !== 'function') {
                emailIndicator('warn', 'GM_openInTab tidak tersedia. Periksa izin Tampermonkey.');
                return false;
            }
            try {
                emailWorkerLaunchAt = Date.now();
                emailWorkerTab = GM_openInTab(EMAIL_WORKER_URL, {
                    active: false, insert: true, setParent: true
                });
                emailWorkerNeedsLaunch = false;
                return true;
            } catch (e) {
                emailIndicator('warn', 'Tidak bisa membuka tab pemeriksaan di latar belakang: ' + (e.message || e));
                return false;
            }
        }

        function runBackgroundEmailCheck() {
            const email = emailField.value.trim().toLowerCase();
            clearTimeout(emailDebounce);
            observedEmailValue = emailField.value;
            // Event input, change, paste, dan blur sering dipicu oleh satu aksi paste.
            // Jangan membatalkan atau mengirim request yang identik dua kali.
            if (emailPending && emailPending.email === email) return;
            if (emailLastResolved && emailLastResolved.email === email &&
                Date.now() - emailLastResolved.at < 60000) {
                emailIndicator(emailLastResolved.state, 'Hasil pemeriksaan terakhir untuk email ini.');
                return;
            }
            stopEmailCheck();
            if (!email) {
                emailIndicator('idle', 'Tempel alamat email untuk memeriksa otomatis.');
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
                emailIndicator('warn','Format alamat email belum lengkap.');
                return;
            }
            if (typeof GM_setValue !== 'function' || typeof GM_addValueChangeListener !== 'function') {
                emailIndicator('warn','Izin komunikasi antar-tab Tampermonkey belum aktif.');
                return;
            }
            const id = Date.now().toString(36) + '-' + (++emailSequence);
            const current = { id, email, timeout:null };
            emailPending = current;
            emailIndicator('checking','Memeriksa ' + email + ' menggunakan halaman Gopath di tab latar belakang…');
            if (!ensureEmailWorker()) {
                emailPending = null;
                return;
            }
            try {
                GM_setValue(EMAIL_REQ_KEY, { id, email, at:Date.now() });
            } catch (e) {
                emailPending = null;
                emailIndicator('warn','Gagal mengirim email ke pemeriksa: ' + (e.message || e));
                closeOwnedEmailWorker();
                return;
            }
            current.timeout = setTimeout(() => {
                if (emailPending !== current) return;
                emailPending = null;
                const reason = workerFresh()
                    ? 'Halaman Gopath terbuka, tetapi belum ada konfirmasi status email dari situs.'
                    : 'Halaman Gopath belum siap atau membuka tab latar belakang diblokir. Periksa tab Gopath.';
                emailIndicator('warn', reason + ' Status tidak dianggap tersedia.');
                closeOwnedEmailWorker();
            }, 16000);
        }

        function emailEdited(immediate = false) {
            observedEmailValue = emailField.value;
            const email = emailField.value.trim().toLowerCase();
            if (!email) {
                if (emailPending) closeOwnedEmailWorker();
                stopEmailCheck();
                emailLastResolved = null;
                emailIndicator('idle','Tempel email untuk memeriksa otomatis.');
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
                if (emailPending) closeOwnedEmailWorker();
                stopEmailCheck();
                emailLastResolved = null;
                emailIndicator('warn','Format email belum benar.');
                return;
            }
            if (emailPending && emailPending.email === email) return;
            if (emailLastResolved && emailLastResolved.email === email &&
                Date.now() - emailLastResolved.at < 60000) {
                clearTimeout(emailDebounce);
                emailIndicator(emailLastResolved.state, 'Hasil pemeriksaan terakhir untuk email ini.');
                return;
            }
            clearTimeout(emailDebounce);
            // Paste langsung: 0 ms. Ketik manual: 100 ms agar request tidak
            // berjalan berkali-kali di tengah pengetikan.
            emailIndicator('checking','Memulai pemeriksaan email…');
            if (immediate) runBackgroundEmailCheck();
            else emailDebounce = setTimeout(runBackgroundEmailCheck, 100);
        }

        emailField.addEventListener('input', event => {
            // Chrome biasanya mengirim insertFromPaste untuk satu aksi paste.
            emailEdited(event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop');
        });
        emailField.addEventListener('change', () => emailEdited(true));
        // Fallback browser yang tidak menyediakan inputType; default paste
        // harus selesai dulu sebelum membaca value.
        emailField.addEventListener('paste', () => setTimeout(() => emailEdited(true), 0));
        emailField.addEventListener('blur', () => {
            if (emailField.value.trim()) emailEdited(true);
        });
        setInterval(() => {
            if (!emailField.isConnected || !emailMessage.isConnected) return;
            if (emailField.value !== observedEmailValue) emailEdited(true);
        }, 350);

        GM_addValueChangeListener(EMAIL_RES_KEY, (_name, _old, result) => {
            if (!emailPending || !result || typeof result !== 'object') return;
            if (result.id !== emailPending.id || result.email !== emailPending.email ||
                emailField.value.trim().toLowerCase() !== emailPending.email) return;
            clearTimeout(emailPending.timeout);
            const checkedEmail = emailPending.email;
            emailPending = null;
            emailLastResolved = (result.state === 'ok' || result.state === 'err')
                ? {email:checkedEmail, at:Date.now(), state:result.state} : null;
            if (result.state === 'ok') {
                emailIndicator('ok','✓ EMAIL BELUM DIGUNAKAN — ' + (result.message || 'Dikonfirmasi oleh Gopath.'));
            } else if (result.state === 'err') {
                emailIndicator('err','✕ EMAIL SUDAH DIGUNAKAN — ' + (result.message || 'Dikonfirmasi oleh Gopath.'));
            } else {
                emailIndicator('warn','Status belum pasti — ' + (result.message || 'Tidak ada jawaban khusus email.'));
            }
            // Hasil diterima dan sudah muncul di bubble: tab Gopath ditutup.
            closeOwnedEmailWorker();
        });
        emailIndicator('idle','Tempel email. Tab Gopath akan ditutup otomatis setelah hasil diperoleh.');
        // =====================================================================

        async function importChatNumber(number, automatic = false) {
            number = String(number || '').replace(/[\s.\-\u200B-\u200D\uFEFF]/g,'');
            if (!/^[0-9]{5,25}$/.test(number)) { $('#chatImportMessage').textContent = 'Blok hanya nomor rekening yang ingin dicari.'; return; }
            if (state.sending || state.pendingRegistration || importBusy) return;
            const route = location.href;
            const key = route + '|' + number;
            if (automatic && key === lastImportKey) return;
            if (lastAutoFilled && lastAutoFilled === formFingerprint() && key !== lastImportKey) {
                for (const name of ['userid','namarekening','bank']) form.elements[name].value = '';
                lastAutoFilled = '';
                setSum('uid','idle','User ID belum diperiksa');
            }
            const token = ++importEpoch;
            for (const kind of ['uid','rek']) { ++versions[kind]; clearTimeout(state.checks[kind].timer); }
            state.lastCheck = {uid:null,rek:null};
            form.elements.rekening.value = number;
            const fingerprint = formFingerprint();
            const current = () => token === importEpoch && location.href === route && formFingerprint() === fingerprint && !state.sending;
            importBusy = true;
            $('#readChatAccount').disabled = true;
            $('#chatAccountChoice').disabled = true;
            setSum('rek','checking','Mencari rekening…');
            try {
                const result = await lookupAccount(number,message => { if (current()) $('#chatImportMessage').textContent = message; });
                if (!current()) { $('#chatImportMessage').textContent = 'Isian atau chat berubah. Klik Ambil dari chat untuk mencari kembali.'; return; }
                lastImportKey = key;
                const primary = primaryAccountStatus(result);
                const status = primary.state === 'taken' ? 'err'
                             : primary.state === 'free' ? 'ok'
                             : primary.state === 'old' ? 'old'
                             : 'warn';
                setSum('rek', status, primary.message);
                state.lastCheck.rek = {...primary, value:number, record:result.record || null};

                if (primary.state === 'old' && result.record) {
                    const record = result.record;
                    form.elements.userid.value = record.userid;
                    form.elements.rekening.value = record.rekening;
                    form.elements.email.value = '';
                    form.elements.telepon.value = '';
                    if (!form.elements.password.value) form.elements.password.value = generatePassword();
                    form.elements.referral.value = DEFAULT_REFERRAL;
                    form.elements.namarekening.value = record.namarekening || '';
                    form.elements.bank.value = record.bank || '';
                    lastAutoFilled = formFingerprint();
                    const missing = [!record.bank && 'bank',!record.namarekening && 'nama rekening'].filter(Boolean);
                    state.lastCheck.uid = null;
                    $('#chatImportMessage').textContent = 'Data dari admin lama sudah diisi. Memeriksa User ID di admin utama…';
                    await runCheck('uid');
                    if (token !== importEpoch || location.href !== route || form.elements.userid.value !== record.userid) return;
                    const uidState = state.lastCheck.uid?.state;
                    $('#chatImportMessage').textContent = uidState === 'taken'
                        ? 'Data admin lama sudah diambil, tetapi User ID sudah terpakai di admin utama. Ganti User ID sebelum daftar.'
                        : uidState === 'free'
                        ? 'Data admin lama sudah diambil. User ID dan rekening belum ada di admin utama. Lengkapi data lalu klik Daftar.'
                        : 'Data admin lama sudah diambil. Status User ID di admin utama belum pasti; klik Cek Ulang.';
                    if (missing.length) $('#chatImportMessage').textContent += ' '+missing.join(' dan ')+' belum terbaca dari tabel; lengkapi manual.';
                } else if (primary.state === 'old') {
                    $('#chatImportMessage').textContent = 'Rekening ada di daftar lama, tetapi data pemain (User ID/nama) tidak dapat dibaca otomatis. Isi User ID, nama rekening, dan bank secara manual.';
                } else if (primary.state === 'taken') {
                    $('#chatImportMessage').textContent = 'Rekening sudah terdaftar di admin utama. Tidak perlu didaftarkan ulang.';
                } else if (primary.state === 'free') {
                    $('#chatImportMessage').textContent = 'Rekening belum terdaftar di daftar lama maupun utama. Lengkapi data untuk daftar baru.';
                } else {
                    $('#chatImportMessage').textContent = primary.message;
                }
            } catch(error) {
                if (current()) { setSum('rek','warn',error.message); $('#chatImportMessage').textContent = error.message; }
            } finally {
                importBusy = false;
                if (!state.sending) { $('#readChatAccount').disabled = false; $('#chatAccountChoice').disabled = false; }
            }
        }

        function importFromActiveChat(automatic = false) {
            if (state.sending || state.pendingRegistration || importBusy) return;
            const numbers = activeChatAccounts();
            const choice = $('#chatAccountChoice');
            choice.replaceChildren(); choice.hidden = true;
            if (!numbers.length && !automatic && /^[0-9]{5,25}$/.test(form.elements.rekening.value.replace(/\s/g,''))) {
                importChatNumber(form.elements.rekening.value.trim(),false); return;
            }
            if (!numbers.length) {
                $('#chatImportMessage').textContent = 'Rekening chat belum terbaca. Blok nomor rekening pada chat lalu klik Ambil dari chat, atau isi rekening lalu klik tombol ini.';
                return;
            }
            if (numbers.length > 1) {
                choice.add(new Option('Pilih rekening yang ingin diperiksa',''));
                numbers.forEach(number => choice.add(new Option(number,number)));
                choice.hidden = false;
                $('#chatImportMessage').textContent = 'Ada beberapa rekening di chat. Pilih rekening yang sesuai.';
                return;
            }
            importChatNumber(numbers[0],automatic);
        }
        $('#readChatAccount').addEventListener('click', () => importFromActiveChat(false));
        $('#chatAccountChoice').addEventListener('change', event => {
            if (event.target.value) importChatNumber(event.target.value,false);
        });

        function setStatus(state_, text, showActivate = false) {
            statusBar.dataset.state = state_;
            statusText.textContent = text;
            activateBtn.hidden = !showActivate;
        }

        function toast(msg, kind = 'info', ms = 4200) {
            const el = document.createElement('div');
            el.className = 'toast toast-' + kind;
            const ico = { ok: '✓', err: '×', warn: '!', info: 'ℹ' }[kind] || 'ℹ';
            el.innerHTML = `<span class="t-ico">${ico}</span><span class="t-msg"></span>`;
            el.querySelector('.t-msg').textContent = msg;
            toasts.appendChild(el);
            requestAnimationFrame(() => el.classList.add('show'));
            setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, ms);
        }

        function setChip(key, state_, text) {
            const chip = root.querySelector(`.chip[data-chip="${key}"]`);
            if (!chip) return;
            if (!text) { chip.hidden = true; return; }
            chip.hidden = false;
            chip.dataset.state = state_;
            chip.textContent = text;
        }

        function setSum(kind, state_, text) {
            if (kind === 'uid') {
                const box = $('#useridStatus');
                box.dataset.state = state_;
                const title = {idle:'BELUM DIPERIKSA',checking:'SEDANG MEMERIKSA…',ok:'USER ID BELUM TERDAFTAR',err:'USER ID SUDAH TERDAFTAR',warn:'HASIL BELUM PASTI'};
                box.querySelector('.uid-title').textContent = title[state_] || title.idle;
                box.querySelector('.uid-symbol').textContent = {idle:'○',checking:'⟳',ok:'✓',err:'×',warn:'!'}[state_] || '○';
                box.querySelector('.uid-detail').textContent = state_ === 'ok' ? 'User ID tersedia untuk didaftarkan.' : state_ === 'err' ? 'User ID sudah digunakan. Silakan gunakan User ID lain.' : text;
            }
            if (kind === 'rek') {
                const box = $('#rekeningStatus');
                box.dataset.state = state_;
                const title = {idle:'BELUM DIPERIKSA',checking:'SEDANG MEMERIKSA…',ok:'NOMOR REKENING BELUM TERDAFTAR',err:'NOMOR REKENING SUDAH TERDAFTAR',warn:'HASIL BELUM PASTI',old:'DITEMUKAN DI DAFTAR LAMA'};
                box.querySelector('.uid-title').textContent = title[state_] || title.idle;
                box.querySelector('.uid-symbol').textContent = {idle:'○',checking:'⟳',ok:'✓',err:'×',warn:'!',old:'ⓘ'}[state_] || '○';
                box.querySelector('.uid-detail').textContent = state_ === 'ok' ? 'Rekening tersedia untuk daftar di admin utama.'
                    : state_ === 'err' ? 'Rekening sudah digunakan di admin utama. Periksa kembali datanya.'
                    : state_ === 'old' ? text
                    : text;
            }
            const el = root.querySelector(`.sum[data-sum="${kind}"]`);
            if (!el) return;
            el.dataset.state = state_;
            el.querySelector('.sum-ico').textContent =
                state_ === 'ok' ? '✓' : state_ === 'err' ? '×' : (state_ === 'warn' || state_ === 'old') ? '!' :
                state_ === 'checking' ? '⟳' : '○';
            el.querySelector('.sum-text').textContent = text;
        }

        function target() {
            if (state.source === 'popup' && state.popup) return state.popup;
            if (state.source === 'iframe') return iframe.contentWindow;
            return null;
        }

        function sendToBridge(msg) {
            return new Promise((resolve, reject) => {
                const id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
                msg.requestId = id;
                const timer = setTimeout(() => {
                    state.pending.delete(id);
                    reject(new Error('Timeout dari bridge.'));
                }, 30000);
                state.pending.set(id, { resolve, reject, timer });
                const tgt = target();
                if (!tgt) {
                    clearTimeout(timer);
                    state.pending.delete(id);
                    reject(new Error('Bridge belum tersambung.'));
                    return;
                }
                try { tgt.postMessage(msg, ORIGIN); }
                catch (e) {
                    clearTimeout(timer);
                    state.pending.delete(id);
                    reject(e);
                }
            });
        }

        function loadIframe() {
            if (iframe.src && state.source === 'iframe') return;
            if (state.source === 'popup') return;
            if (iframe.src && !state.ready) iframe.removeAttribute('src');
            iframe.src = REG_URL + '?bridge=1';
            clearTimeout(state.iframeReadyTimer);
            state.iframeReadyTimer = setTimeout(() => {
                if (!state.ready) {
                    setStatus('err', 'Koneksi iframe belum siap atau diblokir. Klik Aktifkan.', true);
                }
            }, 5000);
        }

        function openPopup() {
            if (state.popup && !state.popup.closed) {
                try { state.popup.focus(); } catch {}
                return;
            }
            const w = 480, h = 720;
            const left = Math.max(20, innerWidth - w - 60);
            const top = Math.max(20, innerHeight - h - 100);
            const pop = window.open(
                REG_URL + '?bridge=1&popup=1',
                'admitoto-bridge',
                `width=${w},height=${h},left=${left},top=${top},popup=yes`
            );
            if (!pop) {
                toast('Popup diblokir. Izinkan popup untuk situs ini.', 'err', 6000);
                return;
            }
            state.popup = pop;
            state.source = null;
            state.ready = false;
            setStatus('init', 'Menghubungkan ke Admitoto lewat popup…');
            clearTimeout(state.iframeReadyTimer);
            state.iframeReadyTimer = setTimeout(() => {
                if (!state.ready) setStatus('err', 'Popup tidak merespon. Coba tutup lalu buka lagi.', true);
            }, 8000);
        }

        activateBtn.addEventListener('click', openPopup);

        window.addEventListener('message', event => {
            if (event.origin !== ORIGIN) return;
            const d = event.data || {};
            if (!d.type) return;

            const fromIframe = event.source === iframe.contentWindow;
            const fromPopup = state.popup && event.source === state.popup;
            if (!fromIframe && !fromPopup) return;
            if (state.source === 'popup' && !fromPopup) return;

            if (d.type === 'bridge-ready') {
                if (fromIframe) { state.source = 'iframe'; state.ready = true; }
                else if (fromPopup) { state.source = 'popup'; state.ready = true; }
                else if (!state.ready) return;
                else return;

                setStatus('ok', 'Terhubung ke Admitoto' + (state.source === 'popup' ? ' (popup)' : ''));
                clearTimeout(state.iframeReadyTimer);
                return;
            }

            if (d.type === 'login-required') {
                state.ready = false;
                setStatus('warn', 'Sesi login Admitoto berakhir. Klik Aktifkan.', true);
                toast('Login dulu di popup Admitoto.', 'warn', 6000);
                return;
            }

            if (d.type === 'check-result') {
                const p = state.pending.get(d.requestId);
                if (!p) return;
                clearTimeout(p.timer);
                state.pending.delete(d.requestId);
                p.resolve({ state: d.state, message: d.message });
                return;
            }

            if (d.type === 'register-result') {
                const p = state.pending.get(d.requestId);
                if (!p) return;
                if (p) { clearTimeout(p.timer); state.pending.delete(d.requestId); p.resolve({ ok: d.ok, message: d.message }); }
                state.sending = false;
                for (const el of form.elements) el.disabled = false;
                sendBtn.disabled = false;
                sendBtn.querySelector('.btn-label').textContent = 'Daftar';
                if (d.ok === true) {
                    toast(d.message || 'Pendaftaran berhasil!', 'ok', 7000);
                    resetForm();
                } else if (d.ok === false) {
                    toast(d.message || 'Pendaftaran ditolak.', 'err', 8000);
                } else {
                    toast(d.message || 'Hasil tidak dapat dipastikan.', 'warn', 8000);
                }
                return;
            }
        });

        async function runCheck(kind) {
            const version = ++versions[kind];
            const inputName = kind === 'uid' ? 'userid' : 'rekening';
            const value = String(form.elements[inputName].value || '').trim();
            const chipKey = inputName;

            if (!value) {
                setChip(chipKey, '', '');
                setSum(kind, 'idle', kind === 'uid' ? 'User ID belum diperiksa' : 'Rekening belum diperiksa');
                return;
            }
            if (kind === 'uid' && !/^[A-Za-z0-9._-]{3,20}$/.test(value)) {
                setChip(chipKey, 'warn', 'format');
                setSum(kind, 'warn', 'Format User ID tidak valid');
                return;
            }
            if (kind === 'rek' && !/^[0-9]{5,25}$/.test(value)) {
                setChip(chipKey, 'warn', 'format');
                setSum(kind, 'warn', 'Nomor rekening harus 5–25 digit');
                return;
            }

            setChip(chipKey, 'checking', '⟳');
            state.lastCheck[kind] = null;
            setSum(kind, 'checking', kind === 'uid' ? 'Memeriksa User ID…' : 'Memeriksa Rekening…');

            try {
                const res = await directCheck(kind, value);
                if (version !== versions[kind]) return;
                const st = res.state === 'free' ? 'ok' : res.state === 'taken' ? 'err' : 'warn';
                const txt = res.state === 'free' ? '✓ bebas' : res.state === 'taken' ? '× terpakai' : '! cek';
                setChip(chipKey, st, txt);
                setSum(kind, st, res.message);
                state.lastCheck[kind] = { ...res, value };
                if (!state.ready) setStatus('ok', 'Pencarian langsung aktif • tanpa membuka link');
            } catch (err) {
                if (version !== versions[kind]) return;
                setChip(chipKey, 'warn', '!');
                setSum(kind, 'warn', err.message || 'Gagal memeriksa');
                if (/Sesi admin/.test(err.message)) setStatus('warn', err.message, true);
            }
        }

        function scheduleCheck(kind) {
            versions[kind]++;
            state.lastCheck[kind] = null;
            setChip(kind === 'uid' ? 'userid' : 'rekening', '', '');
            setSum(kind, 'idle', 'Menunggu pemeriksaan…');
            clearTimeout(state.checks[kind].timer);
            state.checks[kind].timer = setTimeout(() => {
                const inputName = kind === 'uid' ? 'userid' : 'rekening';
                const value = String(form.elements[inputName].value || '').trim();
                state.checks[kind].value = value;
                runCheck(kind);
            }, 700);
        }

        form.elements.userid.addEventListener('input', () => scheduleCheck('uid'));
        form.elements.rekening.addEventListener('input', () => {
            form.elements.rekening.value = form.elements.rekening.value.replace(/[\s.\-\u200B-\u200D\uFEFF]/g,'');
            scheduleCheck('rek');
        });
        form.elements.userid.addEventListener('blur', () => scheduleCheck('uid'));
        form.elements.rekening.addEventListener('blur', () => scheduleCheck('rek'));

        function showRegistrationResult(data) {
            $('#registrationText').value = registrationCopyText(data);
            $('#registrationResult').hidden = false;
            $('#copyFeedback').textContent = 'Pesan siap disalin.';
            requestAnimationFrame(() => {
                if (!panel.hidden) $('#registrationResult').scrollIntoView({block:'nearest'});
            });
        }
        $('#copyResult').addEventListener('click', async () => {
            const output = $('#registrationText');
            const text = output.value;
            if (!text) return;
            try {
                if (!navigator.clipboard?.writeText) throw new Error('Clipboard API tidak tersedia');
                await navigator.clipboard.writeText(text);
                $('#copyFeedback').textContent = 'Hasil berhasil disalin.';
            } catch {
                output.focus();
                output.select();
                let copied = false;
                try { copied = document.execCommand('copy'); } catch {}
                $('#copyFeedback').textContent = copied ? 'Hasil berhasil disalin.' : 'Teks dipilih. Tekan Ctrl+C / Cmd+C untuk menyalin.';
            }
        });
        $('#dismissResult').addEventListener('click', () => {
            $('#registrationText').value = '';
            $('#registrationResult').hidden = true;
            $('#copyFeedback').textContent = '';
        });

        root.getElementById('eye').addEventListener('click', e => {
            const inp = form.elements.password;
            const show = inp.type === 'password';
            inp.type = show ? 'text' : 'password';
            e.currentTarget.setAttribute('aria-pressed', String(show));
            e.currentTarget.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
        });

        const REQUIRED = [
            ['userid', 'User ID', /^[A-Za-z0-9._-]{3,20}$/],
            ['password', 'Password (10 karakter A-Z, a-z, atau 0-9)', /^[A-Za-z0-9]{10}$/],
            ['email', 'Email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/],
            ['telepon', 'Telepon', /^[0-9+\-\s()]{6,20}$/],
            ['bank', 'Nama Bank', v => !!v],
            ['rekening', 'Nomor Rekening', /^[0-9]{5,25}$/],
            ['namarekening', 'Nama Rekening', v => v.length >= 2]
        ];

        function validate() {
            for (const [name, label, rule] of REQUIRED) {
                const v = name === 'password' ? form.elements[name].value : String(form.elements[name].value || '').trim();
                if (!v) { toast('Lengkapi ' + label + '.', 'warn'); form.elements[name].focus(); return false; }
                const ok = typeof rule === 'function' ? rule(v) : rule.test(v);
                if (!ok) { toast('Format ' + label + ' belum benar.', 'warn'); form.elements[name].focus(); return false; }
            }
            return true;
        }

        function resetForm() {
            for (const kind of ['uid','rek']) { ++versions[kind]; clearTimeout(state.checks[kind].timer); }
            form.reset();
            for (const n of ['userid','password','email','telepon','rekening','namarekening']) {
                try { form.elements[n].value = ''; } catch {}
            }
            applyAccountDefaults();
            form.elements.password.type = 'password';
            root.getElementById('eye').setAttribute('aria-label', 'Tampilkan password');
            root.getElementById('eye').setAttribute('aria-pressed', 'false');
            setChip('userid', '', '');
            setChip('rekening', '', '');
            setSum('uid', 'idle', 'User ID belum diperiksa');
            setSum('rek', 'idle', 'Rekening belum diperiksa');
            state.checks.uid.value = '';
            state.checks.rek.value = '';
            state.lastCheck = { uid: null, rek: null };
            form.elements.userid.focus();
        }

        form.addEventListener('submit', async e => {
            e.preventDefault();
            if (state.sending) return;
            if (importBusy) { toast('Pemeriksaan rekening masih berjalan. Tunggu hasilnya dahulu.', 'warn'); return; }
            if (!validate()) return;

            if (state.lastCheck.uid && state.lastCheck.uid.state === 'taken') {
                toast('User ID sudah terpakai. Gunakan User ID lain.', 'err'); return;
            }
            if (state.lastCheck.rek && state.lastCheck.rek.state === 'taken' && state.lastCheck.rek.source === 'utama') {
                toast('Nomor rekening sudah terpakai di admin utama. Periksa kembali datanya.', 'err'); return;
            }

            const data = {};
            for (const el of form.elements) if (el.name) data[el.name] = el.name === 'password' ? el.value : String(el.value || '').trim();

            if (state.pendingRegistration) { toast('Pendaftaran sebelumnya belum terkonfirmasi. Klik Cek User ID terlebih dahulu.', 'warn', 7000); return; }
            state.sending = true;
            for (const el of form.elements) el.disabled = true;
            sendBtn.disabled = true;
            sendBtn.querySelector('.btn-label').textContent = 'Mengirim…';

            try {
                const result = await registerDirect(data, message => {
                    setStatus('init',message);
                    sendBtn.querySelector('.btn-label').textContent = message.startsWith('Mengirim') ? 'Mengirim…' : 'Memeriksa User ID…';
                });
                state.pendingRegistration = result.ok === null ? {data:{...data},date:result.date,adminResult:result.adminResult} : null;
                $('#checkRegistrationLog').hidden = !state.pendingRegistration;
                state.uncertainUser = result.ok === null ? data.userid : null;
                toast(result.message, result.ok === true ? 'ok' : result.ok === false ? 'err' : 'warn', 10000);
                setStatus(result.ok === true ? 'ok' : 'warn', result.message);
                if (result.ok === true) {
                    resetForm();
                    showRegistrationResult(data);
                }
            } catch (err) {
                toast(err.message || 'Pendaftaran belum dikirim.', 'err', 8000);
                setStatus('warn', err.message || 'Pendaftaran belum dikirim.');
            } finally {
                state.sending = false;
                for (const el of form.elements) el.disabled = false;
                sendBtn.disabled = false;
                sendBtn.querySelector('.btn-label').textContent = 'Daftar';
            }
        });

        $('#checkRegistrationLog').addEventListener('click', async () => {
            if (state.sending || !state.pendingRegistration) return;
            const pending = state.pendingRegistration;
            state.sending = true;
            for (const el of form.elements) el.disabled = true;
            try {
                const result = await verifyRegistrationLog(pending.data,pending.date,message => setStatus('init',message),pending.adminResult);
                setStatus(result.ok === true ? 'ok' : 'warn',result.message);
                toast(result.message,result.ok === true ? 'ok' : 'warn',10000);
                if (result.ok === true) {
                    state.pendingRegistration = null;
                    state.uncertainUser = null;
                    $('#checkRegistrationLog').hidden = true;
                    resetForm();
                    showRegistrationResult(pending.data);
                }
            } finally {
                state.sending = false;
                for (const el of form.elements) el.disabled = false;
            }
        });

        $('#clearForm').addEventListener('click', () => {
            if (state.sending) { toast('Tunggu proses pendaftaran selesai.', 'warn'); return; }
            if (state.pendingRegistration) {
                toast('Klik "Cek User ID" untuk menyelesaikan verifikasi sebelum menghapus.', 'warn', 6000);
                return;
            }
            ++importEpoch;
            lastImportKey = '';
            lastAutoFilled = '';
            resetForm();
            $('#registrationText').value = '';
            $('#registrationResult').hidden = true;
            $('#copyFeedback').textContent = '';
            $('#chatImportMessage').textContent = 'Form dikosongkan. Blok nomor rekening di chat untuk mencari data dari admin lama.';
            toast('Form berhasil dikosongkan.', 'ok');
        });

        root.getElementById('recheck').addEventListener('click', () => {
            state.checks.uid.value = '__force__';
            state.checks.rek.value = '__force__';
            runCheck('uid');
            runCheck('rek');
        });

        let suppressClick = false;
        root.getElementById('min').onclick = () => {
            panel.hidden = true;
            $('.launcher').hidden = false;
            try { localStorage.setItem('admitoto_mini', '1'); } catch {}
            $('.launcher').setAttribute('aria-expanded', 'false');
            clampHost();
            $('.launcher').focus();
        };

        const launcher = $('.launcher');
        launcher.onclick = () => {
            if (suppressClick) { suppressClick = false; return; }
            panel.hidden = false;
            launcher.hidden = true;
            launcher.setAttribute('aria-expanded', 'true');
            try { localStorage.setItem('admitoto_mini', '0'); } catch {}
            clampHost();
            root.getElementById('min').focus();
            importFromActiveChat(true);
        };

        try {
            if (localStorage.getItem('admitoto_mini') === '0') {
                panel.hidden = false;
                launcher.hidden = true;
            }
        } catch {}

        function clampHost() {
            const r = host.getBoundingClientRect();
            host.style.right = 'auto'; host.style.bottom = 'auto';
            host.style.left = Math.max(8, Math.min(r.left, innerWidth - r.width - 8)) + 'px';
            host.style.top = Math.max(8, Math.min(r.top, innerHeight - r.height - 8)) + 'px';
        }
        window.addEventListener('resize', clampHost);
        new ResizeObserver(clampHost).observe(panel);
        if (!panel.hidden) { launcher.setAttribute('aria-expanded', 'true'); }

        let bubbleDrag = null;
        launcher.addEventListener('pointerdown', e => {
            const r = host.getBoundingClientRect();
            bubbleDrag = { x: e.clientX - r.left, y: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
            suppressClick = false;
            launcher.setPointerCapture(e.pointerId);
        });
        launcher.addEventListener('pointermove', e => {
            if (!bubbleDrag) return;
            if (Math.hypot(e.clientX - bubbleDrag.sx, e.clientY - bubbleDrag.sy) > 5) bubbleDrag.moved = true;
            if (bubbleDrag.moved) {
                host.style.right = 'auto'; host.style.bottom = 'auto';
                host.style.left = Math.max(8, Math.min(e.clientX - bubbleDrag.x, innerWidth - 80)) + 'px';
                host.style.top = Math.max(8, Math.min(e.clientY - bubbleDrag.y, innerHeight - 80)) + 'px';
            }
        });
        const endBubbleDrag = () => {
            if (bubbleDrag) suppressClick = bubbleDrag.moved;
            bubbleDrag = null;
        };
        launcher.addEventListener('pointerup', endBubbleDrag);
        launcher.addEventListener('pointercancel', endBubbleDrag);

        let drag = null;
        root.getElementById('hdr').addEventListener('pointerdown', e => {
            if (e.target.closest('button')) return;
            const r = host.getBoundingClientRect();
            drag = { x: e.clientX - r.left, y: e.clientY - r.top };
            e.currentTarget.setPointerCapture(e.pointerId);
        });
        root.getElementById('hdr').addEventListener('pointermove', e => {
            if (!drag) return;
            host.style.right = 'auto'; host.style.bottom = 'auto';
            host.style.left = Math.max(8, Math.min(e.clientX - drag.x, innerWidth - host.getBoundingClientRect().width - 8)) + 'px';
            host.style.top = Math.max(8, Math.min(e.clientY - drag.y, innerHeight - host.getBoundingClientRect().height - 8)) + 'px';
        });
        root.getElementById('hdr').addEventListener('pointerup', () => { drag = null; });
        root.getElementById('hdr').addEventListener('pointercancel', () => { drag = null; });

        window.addEventListener('pagehide', () => {
            try { state.popup?.close(); } catch {}
        });

        setInterval(() => {
            if (state.source === 'popup' && state.popup && state.popup.closed) {
                state.popup = null;
                state.source = null;
                state.ready = false;
                setStatus('warn', 'Popup ditutup. Klik Aktifkan untuk menyambung lagi.', true);
            }
        }, 1500);
    }

    /* =====================================================================
       ██ BRIDGE DI HALAMAN ADMITOTO
       ===================================================================== */
    function installBridge() {
        if (window.__admitotoBridge) return;
        window.__admitotoBridge = true;

        const inIframe = window.parent !== window;
        const inPopup = !!(window.opener && window.opener !== window);
        if (!inIframe && !inPopup) return;

        const visible = el => {
            if (!el || el.disabled || el.type === 'hidden') return false;
            const view = el.ownerDocument.defaultView;
            for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
                const st = view && view.getComputedStyle(n);
                if (st && (st.display === 'none' || st.visibility === 'hidden')) return false;
            }
            return true;
        };

        const labelTexts = el => {
            const out = [];
            for (const l of (el.labels || [])) out.push(norm(l.textContent));
            const td = el.closest('td,th');
            if (td) {
                let prev = td.previousElementSibling;
                while (prev && !prev.querySelector('input,select,textarea')) {
                    const t = norm(prev.textContent);
                    if (t) { out.push(t); break; }
                    prev = prev.previousElementSibling;
                }
            }
            if (el.parentElement) {
                const copy = el.parentElement.cloneNode(true);
                copy.querySelectorAll('input,select,textarea,button').forEach(n => n.remove());
                const t = norm(copy.textContent);
                if (t) out.push(t);
            }
            return out.map(t => t.replace(/[:*]+$/g, '').trim()).filter(Boolean);
        };

        const setValue = (el, value) => {
            try { el.focus({ preventScroll: true }); } catch {}
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('keyup', { bubbles: true }));
            try { el.blur(); } catch {}
        };

        const FIELD_SELECTORS = {
            userid: ['input[name="userid"]','input[name="user_id"]','input[name="username"]','input[name="user"]'],
            password: ['input[name="password"]','input[name="pass"]','input[name="sandi"]','input[type="password"]'],
            email: ['input[name="email"]','input[name="email_address"]','input[name="emailaddress"]','input[type="email"]'],
            telepon: ['input[name="telepon"]','input[name="telp"]','input[name="telephone"]','input[name="phone"]',
                     'input[name="nohp"]','input[name="no_hp"]','input[name="nomorhp"]','input[name="handphone"]',
                     'input[name="notelp"]','input[name="hp"]','input[name="whatsapp"]','input[name="wa"]'],
            referral: ['input[name="referral"]','input[name="referal"]','input[name="ref"]',
                      'input[name="kode_referral"]','input[name="kodereferral"]','input[name="kode"]'],
            rekening: ['input[name="rekening"]','input[name="norek"]','input[name="no_rek"]',
                      'input[name="nomorrekening"]','input[name="nomor_rekening"]',
                      'input[name="accountnumber"]','input[name="account_number"]'],
            namarekening: ['input[name="namarekening"]','input[name="nama_rekening"]','input[name="atasnama"]',
                          'input[name="atas_nama"]','input[name="namapemilik"]','input[name="nama_pemilik"]',
                          'input[name="pemilik"]','input[name="accountname"]','input[name="account_name"]']
        };
        const BANK_SELECTORS = ['select[name="bank"]','select[name="namabank"]','select[name="nama_bank"]',
                               'select[name="bankname"]','select[name="bank_name"]','select[name="kodebank"]','select[name="kode_bank"]'];
        const LABELS = {
            userid: /^(user\s*id|userid|username|user\s*name|id\s*user)$/i,
            password: /^(password|pass|kata\s*sandi|sandi)$/i,
            email: /^(email|e-mail|alamat\s*email)$/i,
            telepon: /^(telepon|telp|telephone|phone|no\.?\s*(hp|telp|telepon|handphone)|nomor\s*(hp|telepon)|handphone|hp|whatsapp|wa)$/i,
            referral: /^(referral|referal|kode\s*referal|kode\s*referral|ref)$/i,
            rekening: /^(nomor\s*rekening|no\.?\s*rekening|rekening|norek|account\s*(number|no\.?))$/i,
            namarekening: /^(nama\s*rekening|atas\s*nama|nama\s*pemilik(\s*rekening)?|pemilik\s*rekening|account\s*name)$/i
        };

        function findField(key) {
            for (const sel of (FIELD_SELECTORS[key] || [])) {
                let list;
                try { list = [...document.querySelectorAll(sel)].filter(visible); } catch { continue; }
                if (list.length === 1) return list[0];
            }
            const allInputs = [...document.querySelectorAll(
                'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"])'
            )].filter(visible);
            const re = LABELS[key];
            if (re) {
                const byLabel = allInputs.filter(el => labelTexts(el).some(t => re.test(t)));
                if (byLabel.length === 1) return byLabel[0];
            }
            const nameRe = {
                userid: /user_?id|user_?name/i,
                password: /pass/i,
                email: /e-?mail/i,
                telepon: /phone|telp|telepon|handphone|\bhp\b|whatsapp|\bwa\b/i,
                referral: /referal|referral|kode_?ref/i,
                rekening: /^(rekening|norek|no_?rek|nomor_?rekening|account_?(number|no))$/i,
                namarekening: /nama_?rek|atas_?nama|account_?name|pemilik/i
            }[key];
            if (nameRe) {
                const byName = allInputs.filter(el => nameRe.test(norm(el.name || el.id || '')));
                if (byName.length === 1) return byName[0];
            }
            return null;
        }

        function setBank(el, name) {
            if (el.tagName !== 'SELECT') {
                if (el.tagName === 'INPUT') { setValue(el, name); return true; }
                return false;
            }
            const want = norm(name).toUpperCase();
            const flat = s => s.replace(/[^A-Z]/g, '');
            let best = -1, bestScore = 0;
            [...el.options].forEach((o, i) => {
                const t = norm(o.textContent).toUpperCase();
                const v = norm(o.value).toUpperCase();
                if (o.disabled || !o.value || (!t && !v)) return;
                let s = 0;
                if (t === want || v === want) s = 5;
                else if (flat(t) === flat(want)) s = 4;
                else {
                    const aliases = {'CIMB':['CIMB NIAGA'], 'BANK JAGO':['JAGO'], 'LINK AJA':['LINKAJA']};
                    const candidates = [want, ...(aliases[want] || [])].map(flat);
                    if (candidates.includes(flat(t.replace(/^BANK\s+/, ''))) || candidates.includes(flat(t))) s = 3;
                }
                if (s > bestScore) { bestScore = s; best = i; }
            });
            if (best < 0) return false;
            el.selectedIndex = best;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }

        function findSearchInput(doc, kind) {
            const all = [...doc.querySelectorAll('input')].filter(el => {
                if (el.type === 'hidden' || el.type === 'password' || el.type === 'checkbox' || el.type === 'radio' || el.type === 'submit' || el.type === 'button' || el.type === 'file') return false;
                if (el.disabled) return false;
                return true;
            });
            const patterns = kind === 'uid'
                ? [/user\s*id/i, /userid/i, /user\s*name/i, /username/i, /id\s*user/i]
                : [/nomor\s*rekening/i, /no\.?\s*rekening/i, /rekening/i, /norek/i, /account\s*number/i, /accountno/i];
            const namePatterns = kind === 'uid'
                ? /user_?id|user_?name|username/i
                : /rekening|no_?rek|norek|account_?no/i;
            for (const el of all) {
                if (namePatterns.test(el.name || '') || namePatterns.test(el.id || '')) return el;
            }
            for (const el of all) {
                const txt = [el.placeholder || '', el.getAttribute('aria-label') || '', el.title || ''].join(' | ');
                if (patterns.some(p => p.test(txt))) return el;
            }
            for (const el of all) {
                const txt = labelTexts(el).join(' | ');
                if (patterns.some(p => p.test(txt))) return el;
            }
            return null;
        }

        function findSearchButton(form) {
            const buttons = [...form.querySelectorAll('button:not([type="reset"]), input[type="submit"], input[type="button"]')].filter(visible);
            const direct = buttons.find(b => /cari|search|filter|tampilkan|submit|go|kirim/i.test(norm(b.textContent || b.value || '')));
            if (direct) return direct;
            const submit = buttons.find(b => b.type === 'submit');
            return submit || buttons[0] || null;
        }

        function readResult(doc, kind, value) {
            const want = String(value).trim().toLowerCase();
            const tables = [...doc.querySelectorAll('table')];
            for (const table of tables) {
                const rows = [...table.rows];
                if (rows.length === 0) continue;
                let headerRow = null, headerIdx = -1;
                for (let i = 0; i < Math.min(rows.length, 3); i++) {
                    const cells = [...rows[i].cells];
                    if (!cells.length) continue;
                    const isHeader = cells.every(c => !c.querySelector('input,select,textarea')) &&
                                    cells.some(c => /user\s*id|userid|username|rekening|norek|bank|tools|^no\.?$/i.test(norm(c.textContent)));
                    if (isHeader) { headerRow = rows[i]; headerIdx = i; break; }
                }
                if (!headerRow) continue;
                const headers = [...headerRow.cells].map(c => norm(c.textContent).toLowerCase());
                const uidIdx = headers.findIndex(h => /user\s*id|userid|username/.test(h));
                const rekIdx = headers.findIndex(h => /^(nomor\s*rekening|no\.?\s*rekening|rekening|norek|account\s*(number|no\.?))$/.test(h));
                if ((kind === 'uid' ? uidIdx : rekIdx) < 0) continue;
                const dataRows = rows.slice(headerIdx + 1).filter(r => {
                    const t = norm(r.textContent);
                    if (!t) return false;
                    if (/^sub\s*total/i.test(t)) return false;
                    return true;
                });
                if (dataRows.length === 0) {
                    return { state: 'free', message: (kind === 'uid' ? 'USER ID' : 'NOMOR REKENING') + ' BELUM TERDAFTAR' };
                }
                const joined = dataRows.map(r => norm(r.textContent)).join(' ');
                if (/no (data|records?|matching)|tidak ada data|data (tidak ditemukan|kosong)|no results?/i.test(joined)) {
                    return { state: 'free', message: (kind === 'uid' ? 'USER ID' : 'NOMOR REKENING') + ' BELUM TERDAFTAR' };
                }
                if (kind === 'uid' && uidIdx >= 0) {
                    for (const r of dataRows) {
                        const cell = r.cells[uidIdx];
                        if (!cell) continue;
                        const txt = norm(cell.textContent).toLowerCase();
                        if (txt === want || txt.split(/\s+/)[0] === want) {
                            return { state: 'taken', message: 'USER ID TERDAFTAR' };
                        }
                    }
                    return { state: 'unknown', message: 'Tidak ada kecocokan pada halaman ini. Periksa filter atau halaman berikutnya.' };
                }
                if (kind === 'rek') {
                    if (rekIdx >= 0) {
                        for (const r of dataRows) {
                            const cell = r.cells[rekIdx];
                            if (!cell) continue;
                            const txt = norm(cell.textContent).toLowerCase();
                            if (txt === want) return { state: 'taken', message: 'NOMOR REKENING TERDAFTAR' };
                        }
                        return { state: 'unknown', message: 'Rekening tidak cocok pada halaman ini. Periksa filter atau halaman berikutnya.' };
                    }
                    return { state: 'taken', message: 'NOMOR REKENING TERDAFTAR (ada pemain dengan filter ini)' };
                }
            }
            const body = (doc.body?.textContent || '').toLowerCase();
            if (/no (data|records?|matching)|tidak ada data|data (tidak ditemukan|kosong)|no results?/i.test(body)) {
                return { state: 'free', message: (kind === 'uid' ? 'USER ID' : 'NOMOR REKENING') + ' BELUM TERDAFTAR' };
            }
            return null;
        }

        function performCheck(kind, value) {
            return new Promise(resolve => {
                const frame = document.createElement('iframe');
                frame.style.cssText = 'position:fixed;left:-10000px;width:1280px;height:900px';
                let submitted = false, done = false;
                const finish = result => {
                    if (done) return; done = true;
                    clearTimeout(timer); frame.remove(); resolve(result);
                };
                const timer = setTimeout(() => finish({state:'unknown', message:'Belum ada hasil pencarian yang dapat dipastikan. Cek langsung di admin.'}), 20000);
                frame.onload = () => {
                    if (done) return;
                    try {
                        const doc = frame.contentDocument;
                        if (!doc || frame.contentWindow.location.href === 'about:blank') return;
                        if (doc.querySelector('input[name="entered_login"],form[action*="login"]')) {
                            finish({state:'unknown',message:'Sesi login berakhir. Login ulang di admin.'}); return;
                        }
                        if (submitted) {
                            finish(readResult(doc, kind, value) || {state:'unknown',message:'Format hasil tidak dikenali. Cek langsung di admin.'}); return;
                        }
                        const input = findSearchInput(doc, kind);
                        const form = input?.form;
                        if (!form) { finish({state:'unknown',message:'Form pencarian tidak ditemukan.'}); return; }
                        for (const el of form.elements) {
                            if (el === input || el.disabled) continue;
                            if (el.tagName === 'INPUT' && ['text','search','tel','number','email'].includes(el.type)) el.value = '';
                            if (el.tagName === 'SELECT') {
                                const blank = [...el.options].findIndex(o => o.value === '' || /^(semua|all)$/i.test(norm(o.textContent)));
                                if (blank >= 0) el.selectedIndex = blank;
                            }
                        }
                        input.value = value;
                        input.dispatchEvent(new frame.contentWindow.Event('input', {bubbles:true}));
                        input.dispatchEvent(new frame.contentWindow.Event('change', {bubbles:true}));
                        submitted = true;
                        form.target = '_self';
                        const btn = findSearchButton(form);
                        if (btn) btn.click();
                        else frame.contentWindow.HTMLFormElement.prototype.requestSubmit.call(form);
                    } catch (error) { finish({state:'unknown',message:error.message || 'Pemeriksaan gagal.'}); }
                };
                frame.src = LIST_URL;
                document.body.appendChild(frame);
            });
        }

        async function fillAndRegister(data) {
            if (document.querySelector('input[name="entered_login"]')) {
                throw new Error('Sesi login berakhir. Login ulang di popup.');
            }
            const els = {};
            const missing = [];
            for (const key of ['userid','password','email','telepon','rekening','namarekening']) {
                const el = findField(key);
                if (!el) { missing.push(key); continue; }
                els[key] = el;
                setValue(el, key === 'password' ? String(data[key] || '') : String(data[key] || '').trim());
            }
            if (missing.length) {
                throw new Error('Kolom tidak ditemukan: ' + missing.join(', '));
            }
            const referralField = findField('referral');
            if (referralField && !data.referral) setValue(referralField, '');
            if (data.referral) {
                const ref = referralField;
                if (!ref) throw new Error('Kolom referral tidak ditemukan.');
                setValue(ref, String(data.referral).trim());
            }
            let bankEl = null;
            for (const sel of BANK_SELECTORS) {
                const list = [...document.querySelectorAll(sel)].filter(visible);
                if (list.length) { bankEl = list[0]; break; }
            }
            if (!bankEl) {
                bankEl = [...document.querySelectorAll('select')].filter(visible)
                    .find(s => labelTexts(s).some(t => /^(bank|nama\s*bank)$/i.test(t)));
            }
            if (!bankEl) throw new Error('Pilihan bank tidak ditemukan.');
            if (!setBank(bankEl, data.bank)) throw new Error(`Bank "${data.bank}" tidak ada di form.`);
            const form = els.userid.form || els.userid.closest('form');
            if (!form) throw new Error('Formulir pendaftaran tidak ditemukan.');
            if (new Set(Object.values(els)).size !== Object.keys(els).length || Object.values(els).some(el => el.form !== form) || bankEl.form !== form) throw new Error('Pemetaan kolom tidak cocok. Periksa formulir admin.');
            if (!form.reportValidity()) throw new Error('Lengkapi kolom wajib di formulir admin.');
            return await submitAndWait(form);
        }

        function submitAndWait(form) {
            return new Promise(resolve => {
                const runnerName = 'admitoto-result-' + Date.now().toString(36);
                const runner = document.createElement('iframe');
                runner.name = runnerName;
                runner.setAttribute('aria-hidden', 'true');
                runner.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:900px;opacity:0;pointer-events:none;border:0';
                document.body.appendChild(runner);

                let done = false, poll = null, timeout = null;
                const finish = r => {
                    if (done) return;
                    done = true;
                    clearTimeout(timeout);
                    clearInterval(poll);
                    if (oldTarget === null) form.removeAttribute('target'); else form.setAttribute('target', oldTarget);
                    setTimeout(() => { try { runner.remove(); } catch {} }, 3000);
                    resolve(r);
                };

                timeout = setTimeout(() => {
                    finish({ ok: null, message: 'Formulir terkirim, tetapi tidak ada respon dalam 20 detik. Cek daftar pemain.' });
                }, 20000);

                const oldTarget = form.getAttribute('target');
                const initialMessages = new Set([...document.querySelectorAll('[role=alert],.alert,.success,.error')].map(el => norm(el.textContent)));
                let lastContent = '';

                poll = setInterval(() => {
                    if (done) return;
                    let doc = null, text = '';
                    try {
                        doc = runner.contentDocument;
                        if (doc && doc.body) text = doc.body.innerText || doc.body.textContent || '';
                    } catch {}

                    if (doc) {
                        const notices = [...doc.querySelectorAll('[role=alert],.alert,.success,.error')].map(el => norm(el.textContent)).join(' ');
                        text = notices || (norm(text).length <= 400 ? norm(text) : '');
                    }
                    if (text && text !== lastContent) {
                        lastContent = text;
                        const t = text.toLowerCase();
                        const bad = t.match(/gagal|kesalahan|error|tidak valid|sudah (ada|terdaftar)|duplikat|duplicate|invalid|ditolak/);
                        const good = t.match(/berhasil|sukses|success|tersimpan|telah (di)?tambah|ditambahkan|registered|saved/);
                        if (good && !bad && !/tidak berhasil|belum berhasil|unsuccessful|not successful/.test(t)) {
                            finish({ ok: true, message: 'Pendaftaran berhasil dikirim!' });
                            return;
                        }
                        if (bad) {
                            finish({ ok: false, message: 'Situs menolak. Pesan: ' + text.trim().slice(0, 180) });
                            return;
                        }
                    }

                    const messages = [...document.querySelectorAll('[role=alert],.alert,.success,.error')]
                        .map(el => norm(el.textContent)).filter(t => t && !initialMessages.has(t));
                    for (const message of messages) {
                        if (/gagal|error|invalid|duplikat|sudah terdaftar|tidak berhasil/i.test(message)) {
                            finish({ok:false,message:message.slice(0,180)}); return;
                        }
                        if (/berhasil|sukses|successfully|telah ditambah/i.test(message)) {
                            finish({ok:true,message:message.slice(0,180)}); return;
                        }
                    }
                }, 500);

                try {
                    form.setAttribute('target', runnerName);
                    const buttons = [...form.querySelectorAll('button:not([type="reset"]),input[type="submit"],input[type="button"]')].filter(visible);
                    const btn = buttons.find(b => /tambah|simpan|daftar|register|submit|kirim|save|proses/i.test(norm(b.textContent || b.value || ''))) || buttons[0];
                    if (!form.reportValidity()) { finish({ok:false,message:'Form admin belum valid.'}); return; }
                    if (btn) btn.click();
                    else HTMLFormElement.prototype.requestSubmit.call(form);
                } catch (err) {
                    finish({ ok: false, message: 'Gagal submit: ' + (err.message || err) });
                }
            });
        }

        function postToParent(type, payload = {}) {
            const tgt = window.parent !== window ? window.parent : window.opener;
            if (!tgt) return;
            try { tgt.postMessage({ type, ...payload }, PARENT); } catch {}
        }

        let registering = false;
        window.addEventListener('message', async event => {
            if (event.origin !== PARENT || event.source !== (inIframe ? window.parent : window.opener)) return;
            const d = event.data || {};
            if (!d.type) return;

            if (d.type === 'check') {
                if (!['uid','rek'].includes(d.kind) || typeof d.value !== 'string' || d.value.length > 100) return;
                try {
                    const res = await performCheck(d.kind, d.value);
                    postToParent('check-result', { requestId: d.requestId, state: res.state, message: res.message });
                } catch (err) {
                    postToParent('check-result', { requestId: d.requestId, state: 'unknown', message: err.message || 'Pemeriksaan gagal.' });
                }
                return;
            }

            if (d.type === 'register') {
                if (registering) { postToParent('register-result', {requestId:d.requestId,ok:false,message:'Pendaftaran lain masih diproses.'}); return; }
                registering = true;
                try {
                    const res = await registerDirect(d.data || {});
                    postToParent('register-result', { requestId: d.requestId, ok: res.ok, message: res.message });
                } catch (err) {
                    postToParent('register-result', { requestId: d.requestId, ok: false, message: err.message || 'Pendaftaran gagal.' });
                } finally { registering = false; }
                return;
            }
        });

        function announceReady() {
            if (document.querySelector('input[name="entered_login"]')) {
                postToParent('login-required', {});
                return;
            }
            if (findField('userid') && findField('password')) postToParent('bridge-ready', {});
            else postToParent('login-required', {});
        }

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(announceReady, 200);
        } else {
            window.addEventListener('load', () => setTimeout(announceReady, 200));
        }
    }

    /* =====================================================================
       ██ BUBBLE CEK EMAIL LINETOGEL & GOPATH BRIDGE
       ===================================================================== */
    function mountLinetogelEmailChecker() {
        const isBridge = window.top !== window.self && (window.name === 'gopath-email-bridge' || new URLSearchParams(location.search).has('gopath_bridge'));

        if (isBridge) {
            installGopathBridge();
            return;
        }

        if (window.top !== window.self) return;
        if (document.getElementById('lt-email-bubble')) return;

        const host = document.createElement('div');
        host.id = 'lt-email-bubble';
        host.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;';
        const shadow = host.attachShadow({ mode: 'open' });

        shadow.innerHTML = `
        <style>
        *{box-sizing:border-box}
        :host{color-scheme:dark}
        button,input,select{font:inherit}
        button{cursor:pointer;border:0;background:none;color:inherit}
        button:focus-visible,input:focus-visible{outline:3px solid #e0c58e;outline-offset:2px}
        button:disabled{cursor:not-allowed;opacity:.55}
        .bubble{width:min(360px,calc(100vw - 24px));background:radial-gradient(ellipse at top right,#b89b6120,transparent 55%),linear-gradient(155deg,#1d2c3b,#152331 70%);color:#e8eef3;border:1px solid #8d815f;border-radius:18px;box-shadow:0 20px 60px #07111b90,0 4px 16px #07111b40,inset 0 1px 0 #fce4b72b;overflow:hidden;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;transition:box-shadow .2s}
        .bubble.minimized .body{display:none}
        .header{display:flex;align-items:center;gap:10px;padding:14px 16px;background:radial-gradient(ellipse at 95% 0%,#bda26d28,transparent 65%),linear-gradient(115deg,#1d3043,#294252);border-bottom:1px solid #bba16d6b;cursor:grab;touch-action:none;user-select:none}
        .header:active{cursor:grabbing}
        .brand{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:10px;background:linear-gradient(145deg,#f5e3b8,#bea16c);color:#3d3524;font-size:18px;font-weight:800;box-shadow:0 3px 10px #0003,inset 0 1px 0 #fff8}
        .title{flex:1;min-width:0}
        .title strong{display:block;font-size:14px;line-height:1.3;color:#f3e1bb}
        .title small{display:block;font-size:11px;color:#b6c6d1;margin-top:1px}
        .hdr-btn{display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:7px;background:#12243350;border:1px solid #c6d8e12b;color:#eee6d6;font-size:16px;line-height:1}
        .hdr-btn:hover{background:#ffffff20}
        .body{padding:14px}
        .field{display:flex;gap:8px;margin-bottom:10px}
        .field input{flex:1;min-width:0;height:42px;padding:9px 11px;border:1px solid #536a7b;border-radius:10px;background-color:#142330;color:#f5f7fa;font-size:14px;box-shadow:inset 0 2px 5px #050c141a,0 1px 0 #ffffff06;transition:border-color .15s,background-color .15s}
        .field input::placeholder{color:#a8b9c6}
        .field input:hover{background-color:#1b2e3d;border-color:#899da9}
        .field input:focus{outline:none;background-color:#1e3241;border-color:#e1c78f;box-shadow:0 0 0 3px #d7b97b20}
        .btn-check{flex:none;padding:0 16px;height:42px;border-radius:10px;background:linear-gradient(115deg,#f0deb4,#d9bc83 60%,#c4a56c);color:#30291e;font-weight:800;font-size:13px;border:1px solid #f3dfb4;box-shadow:0 3px 10px #0002,inset 0 1px 0 #fff6;transition:background .15s,transform .15s}
        .btn-check:hover{background:linear-gradient(115deg,#f9eac9,#e5cd9a)}
        .btn-check:active{transform:translateY(1px)}
        .btn-check:disabled{opacity:.6;cursor:wait}
        .status{display:flex;align-items:flex-start;gap:10px;padding:11px 12px;border-radius:10px;font-size:13px;line-height:1.55;background:#293d4b;border:1px solid #526b7c;color:#c8d7e1;border-left-width:3px;transition:background .2s,border-color .2s,color .2s}
        .status .icon{display:grid;place-items:center;flex:none;width:26px;height:26px;border-radius:50%;background:#3b5363;color:#dbe5ec;font-size:15px;font-weight:800}
        .status .txt{flex:1;min-width:0;overflow-wrap:anywhere}
        .status .txt strong{display:block;font-size:12px;font-weight:700;margin-bottom:2px}
        .status .txt span{display:block;font-size:12px;line-height:1.5}
        .status.info{background:#293d4b;border-color:#526b7c;color:#c8d7e1}
        .status.info .icon{background:#3b5363;color:#dbe5ec}
        .status.checking{background:#29364b;border-color:#6e88af;color:#cee2ff}
        .status.checking .icon{background:#405674;color:#e3eeff;animation:spin 1.2s linear infinite}
        .status.ok{background:#1f3d2f;border-color:#5b9e7a;color:#c6f0d8}
        .status.ok .icon{background:#365f47;color:#d2ffe0}
        .status.err{background:#442630;border-color:#b26b82;color:#ffd0dc}
        .status.err .icon{background:#713e54;color:#ffe0e9}
        .status.warn{background:#3f3723;border-color:#a68b56;color:#ffe4ad}
        .status.warn .icon{background:#665231;color:#ffedc7}
        @keyframes spin{to{transform:rotate(360deg)}}
        .tools{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
        .tool{flex:1;min-width:78px;padding:8px 10px;border-radius:8px;background:#2e4352;border:1px solid #627887;color:#e0e9ee;font-size:11px;font-weight:600;transition:background .15s}
        .tool:hover{background:#3b5363}
        .tool:disabled{opacity:.45;cursor:not-allowed}
        .note{margin-top:10px;padding:8px 10px;border-radius:8px;background:#1d2c3b80;border:1px solid #3f5869;font-size:10.5px;line-height:1.55;color:#a9b8c4}
        .toasts{position:fixed;right:16px;bottom:calc(20px + 100% + 10px);display:flex;flex-direction:column;gap:8px;z-index:2147483647;width:min(340px,calc(100vw - 32px));pointer-events:none}
        .toast{display:flex;align-items:flex-start;gap:9px;padding:11px 13px;border:1px solid #708593;border-radius:11px;background:#293e4d;color:#f2f6f9;box-shadow:0 10px 30px #09071466;font-size:12px;line-height:1.5;opacity:0;transform:translateY(10px);transition:opacity .2s,transform .2s;pointer-events:auto}
        .toast.show{opacity:1;transform:translateY(0)}
        .t-ico{display:grid;place-items:center;flex:none;width:22px;height:22px;border-radius:6px;background:#485b68;color:#f1dab0;font-weight:800;font-size:13px}
        .t-msg{flex:1;overflow-wrap:anywhere}
        .toast-ok .t-ico{background:#365642;color:#d0f5de}
        .toast-err .t-ico{background:#6c3c51;color:#ffdae7}
        .toast-warn .t-ico{background:#655131;color:#ffe6b5}
        @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
        </style>
        <div class="bubble" id="bubble" role="complementary" aria-label="Cek email Linetogel">
          <div class="header" id="hdr">
            <span class="brand" aria-hidden="true">@</span>
            <div class="title">
              <strong>Cek Email Register</strong>
              <small>Linetogel / Gopath · cek otomatis</small>
            </div>
            <button type="button" class="hdr-btn" id="minBtn" title="Kecilkan" aria-label="Kecilkan">−</button>
            <button type="button" class="hdr-btn" id="closeBtn" title="Tutup" aria-label="Tutup">×</button>
          </div>
          <div class="body">
            <div class="field">
              <input type="email" id="emailInput" placeholder="contoh@email.com" autocomplete="off" spellcheck="false" aria-label="Alamat email yang ingin diperiksa">
              <button type="button" class="btn-check" id="checkBtn">Cek</button>
            </div>
            <div class="status info" id="statusBox" role="status" aria-live="polite">
              <span class="icon" id="statusIcon" aria-hidden="true">ℹ</span>
              <div class="txt">
                <strong id="statusTitle">BELUM DIPERIKSA</strong>
                <span id="statusText">Tempel email; pemeriksaan akan berjalan otomatis.</span>
              </div>
            </div>
            <div class="tools">
              <button type="button" class="tool" id="clearBtn">Kosongkan</button>
              <button type="button" class="tool" id="copyBtn" disabled>Salin email</button>
              <button type="button" class="tool" id="fillBtn" disabled>Isi ke form</button>
            </div>
            <div class="note">
              Status diambil dari respons validasi server (AJAX) dan indikator visual form.
              Jika situs tidak menampilkan indikator apa pun, periksa manual di form register.
            </div>
          </div>
        </div>
        <div class="toasts" id="toasts" aria-live="polite"></div>
        `;

        document.body.appendChild(host);

        const $ = id => shadow.getElementById(id);
        const bubble = $('bubble');
        const emailInput = $('emailInput');
        const checkBtn = $('checkBtn');
        const clearBtn = $('clearBtn');
        const copyBtn = $('copyBtn');
        const fillBtn = $('fillBtn');
        const statusBox = $('statusBox');
        const statusIcon = $('statusIcon');
        const statusTitle = $('statusTitle');
        const statusText = $('statusText');
        const minBtn = $('minBtn');
        const closeBtn = $('closeBtn');
        const toasts = $('toasts');
        const hdr = $('hdr');

        let lastEmail = '';
        let lastState = null;
        let checking = false;
        let ajaxDetected = null;
        let ajaxSource = null;

        function toast(msg, kind = 'info', ms = 3800) {
            const el = document.createElement('div');
            el.className = 'toast toast-' + kind;
            const ico = { ok: '✓', err: '✕', warn: '!', info: 'ℹ' }[kind] || 'ℹ';
            el.innerHTML = `<span class="t-ico">${ico}</span><span class="t-msg"></span>`;
            el.querySelector('.t-msg').textContent = msg;
            toasts.appendChild(el);
            requestAnimationFrame(() => el.classList.add('show'));
            setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
        }

        function setStatus(kind, title, detail) {
            statusBox.className = 'status ' + kind;
            const icons = { ok: '✓', err: '✕', warn: '!', info: 'ℹ', checking: '⟳' };
            statusIcon.textContent = icons[kind] || 'ℹ';
            statusTitle.textContent = title;
            statusText.textContent = detail || '';
            lastState = kind;
        }

        function updateButtons() {
            const has = !!lastEmail;
            copyBtn.disabled = !has;
            fillBtn.disabled = !has;
        }

        function analyzeResponse(url, body) {
            if (!body) return false;
            const lower = String(body).toLowerCase();
            const urlStr = String(url || '').toLowerCase();

            if (!/email|mail|register|check|available|exist|taken|used|valid/.test(urlStr) &&
                !/email|mail|available|exist|taken|used|tersedia|digunakan|terdaftar/.test(lower)) {
                return false;
            }

            const usedPatterns = [
                /"available"\s*:\s*false/,
                /"exists"\s*:\s*true/,
                /"taken"\s*:\s*true/,
                /"used"\s*:\s*true/,
                /email\s*(sudah|telah)\s*(di)?gunakan/i,
                /email\s*sudah\s*terdaftar/i,
                /email\s*(tidak|sudah tidak)\s*(tersedia|valid|boleh)/i,
                /already\s*(used|registered|exists|taken)/i,
                /email.*(is\s*)?(already\s*)?(used|taken|registered|exists)/i,
                /(used|taken|registered|exists).*email/i,
                /not\s*available/i
            ];

            const availablePatterns = [
                /"available"\s*:\s*true/,
                /"exists"\s*:\s*false/,
                /"taken"\s*:\s*false/,
                /"used"\s*:\s*false/,
                /email\s*tersedia/i,
                /email\s*belum\s*(di)?gunakan/i,
                /email\s*belum\s*terdaftar/i,
                /not\s*(used|registered|exists|taken)/i,
                /email\s*(is\s*)?(available|valid|free|ok)/i,
                /(available|free)\s*email/i
            ];

            if (usedPatterns.some(p => p.test(lower))) {
                ajaxDetected = 'err';
                ajaxSource = urlStr;
                if (checking) {
                    setStatus('err', '✕ EMAIL SUDAH DIGUNAKAN', 'Email sudah dipakai orang lain. Gunakan email lain.');
                }
                return true;
            }
            if (availablePatterns.some(p => p.test(lower))) {
                ajaxDetected = 'ok';
                ajaxSource = urlStr;
                if (checking) {
                    setStatus('ok', '✓ EMAIL BELUM DIGUNAKAN', 'Email tersedia dan bisa didaftarkan.');
                }
                return true;
            }
            return false;
        }

        const originalFetch = window.fetch;
        if (typeof originalFetch === 'function') {
            window.fetch = async function (...args) {
                const response = await originalFetch.apply(this, args);
                try {
                    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
                    const clone = response.clone();
                    const text = await clone.text();
                    analyzeResponse(url, text);
                } catch {}
                return response;
            };
        }

        const XHR = XMLHttpRequest.prototype;
        const originalOpen = XHR.open;
        const originalSend = XHR.send;
        XHR.open = function (method, url, ...rest) {
            this._lt_url = url;
            return originalOpen.call(this, method, url, ...rest);
        };
        XHR.send = function (...args) {
            this.addEventListener('load', function () {
                try {
                    const url = this._lt_url || '';
                    if (/email|mail|check|available|exist|taken|used|valid|register/i.test(url)) {
                        analyzeResponse(url, this.responseText);
                    }
                } catch {}
            });
            return originalSend.apply(this, args);
        };

        function findEmailInput() {
            const selectors = [
                'input[type="email"]',
                'input[name*="email" i]',
                'input[id*="email" i]',
                'input[name*="mail" i]',
                'input[id*="mail" i]',
                'input[placeholder*="email" i]',
                'input[placeholder*="mail" i]'
            ];
            for (const sel of selectors) {
                const list = document.querySelectorAll(sel);
                for (const el of list) {
                    if (el === emailInput) continue;
                    if (el.offsetParent !== null && !el.disabled && !el.readOnly && el.type !== 'hidden') {
                        return el;
                    }
                }
            }
            const all = document.querySelectorAll('input');
            for (const el of all) {
                if (el === emailInput) continue;
                const meta = ((el.name || '') + ' ' + (el.id || '') + ' ' + (el.placeholder || '')).toLowerCase();
                if (meta.includes('email') && el.offsetParent !== null && !el.disabled && el.type !== 'hidden') {
                    return el;
                }
            }
            return null;
        }

        function waitForEmailInput(timeout = 15000) {
            return new Promise((resolve, reject) => {
                const existing = findEmailInput();
                if (existing) return resolve(existing);

                const observer = new MutationObserver(() => {
                    const el = findEmailInput();
                    if (el) {
                        observer.disconnect();
                        clearTimeout(timer);
                        resolve(el);
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });

                const timer = setTimeout(() => {
                    observer.disconnect();
                    reject(new Error('Kolom email tidak ditemukan dalam ' + Math.round(timeout / 1000) + ' detik. Halaman mungkin belum selesai dimuat.'));
                }, timeout);
            });
        }

        function findVisualIndicator(emailEl) {
            let container = emailEl.parentElement;
            let best = null;
            for (let i = 0; i < 5 && container; i++) {
                const text = (container.innerText || container.textContent || '').toLowerCase();
                if (/tersedia|digunakan|terdaftar|available|used|registered|valid|invalid|sudah|belum/i.test(text)) {
                    best = container;
                    break;
                }
                container = container.parentElement;
            }
            container = best || emailEl.parentElement;
            if (!container) return null;

            const text = (container.innerText || container.textContent || '').toLowerCase();

            if (/sudah\s*(di)?gunakan|telah\s*(di)?gunakan|sudah\s*terdaftar|already\s*(used|registered|taken)|email\s*(tidak|sudah tidak)\s*(tersedia|valid)|email.*sudah.*(dipakai|digunakan|terdaftar)/i.test(text)) {
                return { state: 'err', message: 'Email sudah digunakan' };
            }
            if (/tersedia|belum\s*(di)?gunakan|belum\s*terdaftar|available|not\s*used|email\s*(is\s*)?(available|valid|free|ok)/i.test(text)) {
                return { state: 'ok', message: 'Email tersedia (belum digunakan)' };
            }

            const icons = container.querySelectorAll(
                'i,svg,span,img,.icon,.fa,[class*="check"],[class*="valid"],[class*="error"],[class*="times"],[class*="success"],[class*="danger"],[class*="ok"],[class*="remove"]'
            );
            for (const el of icons) {
                if (el === emailEl) continue;
                const cls = String(el.className?.baseVal || el.className || '') + ' ' + (el.getAttribute('class') || '');
                const iconText = (el.textContent || '').trim();
                const aria = (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.getAttribute('data-icon') || '');

                if (/fa-check|fa-circle-check|check-circle|checkmark|check-mark|is-valid|valid-feedback|valid-tooltip|icon-success|icon-ok|glyphicon-ok|bi-check|success|text-success|text-green|has-success/i.test(cls) ||
                    /^[✓✔]$/.test(iconText) ||
                    /valid|available|tersedia|ok|success|benar|hijau/i.test(aria)) {
                    return { state: 'ok', message: 'Email tersedia (belum digunakan)' };
                }

                if (/fa-times|fa-xmark|fa-circle-xmark|times-circle|xmark|is-invalid|invalid-feedback|invalid-tooltip|icon-error|icon-remove|glyphicon-remove|bi-x|error|danger|text-danger|text-red|has-error/i.test(cls) ||
                    /^[✕×✖❌]$/.test(iconText) ||
                    /invalid|error|used|taken|registered|digunakan|salah|merah/i.test(aria)) {
                    return { state: 'err', message: 'Email sudah digunakan' };
                }
            }

            return null;
        }

        function fireEvents(el) {
            ['input', 'change', 'blur', 'keyup'].forEach(type => {
                try { el.dispatchEvent(new Event(type, { bubbles: true })); } catch {}
            });
            try { el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', bubbles: true })); } catch {}
            try { el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); } catch {}
            try { el.dispatchEvent(new Event('input', { bubbles: true, composed: true })); } catch {}
        }

        async function checkEmail() {
            if (checking) return;
            const email = emailInput.value.trim();

            if (!email) {
                toast('Masukkan email terlebih dahulu.', 'warn');
                emailInput.focus();
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
                setStatus('warn', 'FORMAT TIDAK VALID', 'Masukkan alamat email yang benar (contoh: nama@email.com).');
                toast('Format email tidak valid.', 'warn');
                emailInput.focus();
                return;
            }

            checking = true;
            ajaxDetected = null;
            ajaxSource = null;
            checkBtn.disabled = true;
            checkBtn.textContent = '...';
            setStatus('checking', 'MEMERIKSA…', 'Mengisi email ke form dan menunggu validasi server…');

            try {
                const emailEl = await waitForEmailInput();
                emailEl.focus();
                emailEl.value = email;
                fireEvents(emailEl);
                try { emailEl.blur(); } catch {}

                const start = Date.now();
                let result = null;

                while (Date.now() - start < 8000) {
                    await new Promise(r => setTimeout(r, 400));

                    if (ajaxDetected === 'ok') {
                        setStatus('ok', '✓ EMAIL BELUM DIGUNAKAN', 'Email tersedia dan bisa didaftarkan.');
                        lastEmail = email;
                        updateButtons();
                        toast('Email tersedia (belum digunakan).', 'ok', 5000);
                        return;
                    }
                    if (ajaxDetected === 'err') {
                        setStatus('err', '✕ EMAIL SUDAH DIGUNAKAN', 'Email sudah dipakai orang lain. Gunakan email lain.');
                        lastEmail = email;
                        updateButtons();
                        toast('Email sudah digunakan oleh orang lain.', 'err', 5000);
                        return;
                    }

                    result = findVisualIndicator(emailEl);
                    if (result) break;
                }

                if (result) {
                    if (result.state === 'ok') {
                        setStatus('ok', '✓ EMAIL BELUM DIGUNAKAN', result.message + '.');
                        toast('Email tersedia.', 'ok', 5000);
                    } else {
                        setStatus('err', '✕ EMAIL SUDAH DIGUNAKAN', result.message + '.');
                        toast('Email sudah digunakan.', 'err', 5000);
                    }
                    lastEmail = email;
                    updateButtons();
                } else {
                    setStatus('warn', 'INDIKATOR TIDAK TERDETEKSI', 'Situs tidak menampilkan indikator otomatis. Coba klik di luar field email, atau periksa manual di form register.');
                    toast('Indikator tidak terdeteksi. Periksa manual di form.', 'warn', 6000);
                }
            } catch (err) {
                setStatus('warn', 'GAGAL MEMERIKSA', err.message || 'Terjadi kesalahan.');
                toast(err.message || 'Gagal memeriksa email.', 'err', 5000);
            } finally {
                checking = false;
                checkBtn.disabled = false;
                checkBtn.textContent = 'Cek';
            }
        }

        // Pemeriksaan pada bubble lokal Gopath juga dimulai otomatis setelah paste/ketik.
        // Bubble utama LiveChat menggunakan bridge di atas.
        let localEmailTimer = null;
        emailInput.addEventListener('input', () => {
            clearTimeout(localEmailTimer);
            if (!emailInput.value.trim()) {
                setStatus('info','BELUM DIPERIKSA','Tempel email; pemeriksaan berjalan otomatis.');
                return;
            }
            if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailInput.value.trim())) {
                localEmailTimer = setTimeout(() => { if (!checking) checkEmail(); }, 700);
            }
        });
        checkBtn.addEventListener('click', checkEmail);

        emailInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                checkEmail();
            }
        });

        clearBtn.addEventListener('click', () => {
            emailInput.value = '';
            setStatus('info', 'BELUM DIPERIKSA', 'Masukkan email lalu klik Cek.');
            lastEmail = '';
            lastState = null;
            ajaxDetected = null;
            ajaxSource = null;
            updateButtons();
            emailInput.focus();
        });

        copyBtn.addEventListener('click', async () => {
            if (!lastEmail) return;
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(lastEmail);
                } else {
                    throw new Error('Clipboard tidak tersedia');
                }
                toast('Email disalin ke clipboard.', 'ok');
            } catch {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = lastEmail;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    ta.remove();
                    toast('Email disalin.', 'ok');
                } catch {
                    toast('Gagal menyalin email.', 'warn');
                }
            }
        });

        fillBtn.addEventListener('click', async () => {
            if (!lastEmail) return;
            try {
                const emailEl = await waitForEmailInput(3000);
                emailEl.focus();
                emailEl.value = lastEmail;
                fireEvents(emailEl);
                toast('Email diisi ke form register.', 'ok');
            } catch (err) {
                toast(err.message, 'warn');
            }
        });

        minBtn.addEventListener('click', () => {
            bubble.classList.toggle('minimized');
        });

        closeBtn.addEventListener('click', () => {
            host.style.display = 'none';
        });

        let drag = null;
        hdr.addEventListener('pointerdown', e => {
            if (e.target.closest('button')) return;
            const r = host.getBoundingClientRect();
            drag = { x: e.clientX - r.left, y: e.clientY - r.top };
            e.currentTarget.setPointerCapture(e.pointerId);
        });
        hdr.addEventListener('pointermove', e => {
            if (!drag) return;
            host.style.right = 'auto';
            host.style.bottom = 'auto';
            host.style.left = Math.max(8, Math.min(e.clientX - drag.x, innerWidth - host.offsetWidth - 8)) + 'px';
            host.style.top = Math.max(8, Math.min(e.clientY - drag.y, innerHeight - host.offsetHeight - 8)) + 'px';
        });
        hdr.addEventListener('pointerup', () => { drag = null; });
        hdr.addEventListener('pointercancel', () => { drag = null; });

        setTimeout(() => { try { emailInput.focus(); } catch {} }, 600);
        setTimeout(() => {
            toast('Bubble siap. Masukkan email lalu klik Cek.', 'info', 4000);
        }, 800);
    }

    /* =====================================================================
       ██ GOPATH BRIDGE (UNTUK IFrame TERSEMBUNYI DI ADMITOTO)
       ===================================================================== */
    function installGopathBridge() {
        // BRIDGE hanya aktif pada iframe tersembunyi dari LiveChat.
        // window.name tetap ada meski Gopath redirect ke line38602.com.
        if (window.top === window.self) return;
        const ALLOWED_PARENT = 'https://my.livechatinc.com';
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        let currentToken = 0;
        let lastRequest = '';

        function send(type, args = {}) {
            try { window.parent.postMessage({type, ...args}, ALLOWED_PARENT); } catch {}
        }
        function isVisible(el) {
            if (!el || el.disabled || el.readOnly || el.type === 'hidden') return false;
            const style = getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
        }
        function findRegistrationEmail() {
            const inputs = [...document.querySelectorAll('input[type="email"],input[name*="email" i],input[id*="email" i],input[placeholder*="email" i]')]
                .filter(isVisible);
            if (!inputs.length) return null;
            const scored = inputs.map(input => {
                let score = 0;
                const form = input.closest('form');
                const wrapper = input.closest('.form-group,.mb-3,.form-floating,.input-group,.form-item') || input.parentElement;
                const attrs = [input.name,input.id,input.placeholder,input.getAttribute('autocomplete')].join(' ').toLowerCase();
                if (/email/.test(attrs)) score += 3;
                if (form) {
                    const formMeta = ((form.id || '') + ' ' + (form.getAttribute('action') || '')).toLowerCase();
                    if (/regist|daftar|signup|sign-up/.test(formMeta)) score += 10;
                    if (form.querySelector('input[name*="referral" i],input[name*="rekening" i],input[name*="bank" i],select[name*="bank" i],input[name*="captcha" i]')) score += 8;
                    if ([...form.querySelectorAll('input[type="password"]')].length >= 2) score += 7;
                    if (/login|masuk|sign.?in/.test(formMeta)) score -= 15;
                }
                const label = [...(input.labels || [])].map(e=>e.textContent).join(' ');
                if (/^\s*(email|e-mail)\s*\*?\s*$/i.test(label.trim())) score += 3;
                if (/email/i.test(wrapper?.textContent || '')) score += 1;
                const header = input.closest('header,nav,[role="navigation"]');
                if (header) score -= 25;
                return {input,score};
            }).sort((a,b)=>b.score-a.score);
            if (scored.length > 1 && scored[0].score === scored[1].score) return null;
            return scored[0].input;
        }
        function setNativeValue(el, value) {
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(el,value);
            else el.value = value;
        }
        function emitEvents(el) {
            try { el.focus({preventScroll:true}); } catch {}
            for (const type of ['input','keyup','change']) {
                const event = type === 'keyup'
                    ? new KeyboardEvent(type,{bubbles:true,key:'a'})
                    : new Event(type,{bubbles:true});
                el.dispatchEvent(event);
            }
            try { el.blur(); } catch {}
        }
        function statusFromNode(el) {
            const text = String(el?.innerText || el?.textContent || '').trim().replace(/\s+/g,' ');
            // Hindari kata seperti 'valid' / 'success' saja: itu bisa hanya validasi format email.
            if (/(?:email|e-mail)[^.!\n]{0,70}(?:sudah|telah)[^.!\n]{0,35}(?:digunakan|dipakai|terdaftar)|(?:email|e-mail)[^.!\n]{0,60}(?:already|is already)[^.!\n]{0,35}(?:used|taken|registered|exists)|(?:email|e-mail)[^.!\n]{0,55}(?:tidak tersedia|not available|unavailable)|(?:already used|already registered)[^.!\n]{0,40}(?:email|e-mail)/i.test(text))
                return {state:'err',message:'Status tidak tersedia terdeteksi pada area email.'};
            if (/(?:email|e-mail)[^.!\n]{0,55}(?:belum digunakan|belum terdaftar|tersedia|available|not used|not registered|is free)|(?:tersedia|available)[^.!\n]{0,35}(?:email|e-mail)/i.test(text))
                return {state:'ok',message:'Status tersedia terdeteksi pada area email.'};
            return null;
        }
        function inspectEmailArea(el) {
            // Scoped: jangan baca teks seluruh halaman, icon global, atau border hijau format.
            const candidates = [];
            const selectors = ['.form-group','.form-floating','.form-item','.input-group','.field','.mb-3','.mb-4','[class*="field"]','[class*="form-group"]'];
            let cur=el.parentElement;
            for (let i=0;cur && i<4 && cur!==document.body;i++,cur=cur.parentElement) {
                if (cur.querySelectorAll('input').length > 2) break;
                if (selectors.some(sel=>cur.matches?.(sel)) || i<=1) candidates.push(cur);
            }
            for (const node of candidates) {
                const res = statusFromNode(node);
                if (res) return res;
            }
            // Icon di area email bisa bermakna validasi format saja. Jangan menganggap
            // sekadar centang hijau sebagai bukti server memastikan email unik.
            return null;
        }
        async function waitForEmail(max=14000) {
            const end=Date.now()+max;
            while (Date.now() < end) {
                const field=findRegistrationEmail();
                if (field) return field;
                await delay(350);
            }
            return null;
        }
        function isAllowedMessage(event) {
            return event.source === window.parent && event.origin === ALLOWED_PARENT;
        }
        window.addEventListener('message', async event => {
            if (!isAllowedMessage(event)) return;
            const d=event.data;
            if (!d || typeof d !== 'object') return;
            if (d.type === 'gopath-bridge-ping-v113') {
                send('gopath-bridge-ready-v113');
                return;
            }
            if (d.type !== 'gopath-check-email-v113') return;
            const email=String(d.email||'').trim().toLowerCase();
            const requestId=String(d.requestId||'');
            if (!requestId || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
                send('gopath-email-result-v113',{requestId,state:'unknown',message:'Format email tidak sesuai.'});
                return;
            }
            if (lastRequest === requestId) return;
            lastRequest=requestId;
            const token=++currentToken;
            const input=await waitForEmail(3500);
            if (token!==currentToken) return;
            if (!input) {
                send('gopath-email-result-v113',{requestId,state:'unknown',message:'Input Email pada formulir pendaftaran tidak ditemukan.'});
                return;
            }
            // Set kosong lebih dahulu untuk membersihkan indikator pemeriksaan sebelumnya.
            setNativeValue(input,''); emitEvents(input);
            await delay(80);
            if (token!==currentToken) return;
            setNativeValue(input,email);
            emitEvents(input);
            const end=Date.now()+9000;
            while (Date.now()<end) {
                if (token!==currentToken) return;
                await delay(350);
                const value=String(input.value||'').trim().toLowerCase();
                if (value!==email) {
                    send('gopath-email-result-v113',{requestId,state:'unknown',message:'Kolom Email berubah ketika diperiksa.'});
                    return;
                }
                const result=inspectEmailArea(input);
                if (result) {
                    send('gopath-email-result-v113',{requestId,...result});
                    return;
                }
            }
            send('gopath-email-result-v113',{requestId,state:'unknown',message:'Tidak ditemukan keterangan tersedia/terdaftar yang spesifik untuk Email.'});
        });
        // Siapkan bridge tanpa membuka tab. Selalu beri sinyal siap setelah listener terpasang.
        send('gopath-bridge-ready-v113');
    }

    /* =====================================================================
       GOPATH EMAIL BACKGROUND WORKER v12 — NO IFRAME
       - Proses nyata terjadi di tab register, bukan HTML hasil fetch.
       - Hanya validasi satu email yang dipaste; tidak submit pendaftaran.
       - Hasil hijau hanya jika ada bukti status ketersediaan dari server.
       ===================================================================== */
    function installGopathBackgroundWorker() {
        if (window.top !== window.self || typeof GM_addValueChangeListener !== 'function') return;
        if (window.__tmGopathWorkerV12) return;
        window.__tmGopathWorkerV12 = true;

        const REQ = 'tm_gopath_email_req_v12';
        const RES = 'tm_gopath_email_res_v12';
        const HB = 'tm_gopath_email_heartbeat_v12';
        const workerId = Math.random().toString(36).slice(2);
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        let serial = 0;
        let currentEmail = '';
        let startAt = 0;
        let networkResponses = [];

        function heartbeat() {
            try { GM_setValue(HB, {at:Date.now(), workerId, url:location.origin+location.pathname}); } catch {}
        }
        heartbeat();
        setInterval(heartbeat, 1700);

        function findRealEmail() {
            const fields = [...document.querySelectorAll('input[type="email"], input[name*="email" i], input[id*="email" i],input[placeholder*="email" i]')]
                .filter(el => !el.disabled && !el.readOnly && el.type !== 'hidden' && el.getClientRects().length);
            const scored = fields.map(el => {
                const f = el.form || el.closest('form');
                const meta = [el.name, el.id, el.placeholder].join(' ').toLowerCase();
                const fmeta = f ? [f.id,f.getAttribute('action')].join(' ').toLowerCase() : '';
                let score = /email/.test(meta) ? 5 : 0;
                if (f && /register|regist|daftar|signup|sign-up/.test(fmeta)) score += 10;
                if (f && f.querySelectorAll('input[type="password"]').length >= 2) score += 8;
                if (f && f.querySelector('select[name*="bank" i],input[name*="rekening" i],input[name*="referral" i]')) score += 8;
                if (el.closest('header,nav,[role="navigation"]')) score -= 20;
                if (/login|signin|sign-in|masuk/.test(fmeta)) score -= 20;
                return {el,score};
            }).sort((a,b)=>b.score-a.score);
            if (!scored.length || (scored.length > 1 && scored[0].score === scored[1].score)) return null;
            return scored[0].el;
        }

        function writeInput(el, value) {
            const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const setter = Object.getOwnPropertyDescriptor(page.HTMLInputElement.prototype,'value')?.set;
            if (setter) setter.call(el, value); else el.value = value;
            try { el.focus({preventScroll:true}); } catch {}
            try { el.dispatchEvent(new page.InputEvent('input',{bubbles:true,inputType:'insertText',data:value})); }
            catch { el.dispatchEvent(new Event('input',{bubbles:true})); }
            el.dispatchEvent(new page.Event('change',{bubbles:true}));
            el.dispatchEvent(new page.KeyboardEvent('keyup',{bubbles:true,key:'Tab'}));
            try { el.blur(); } catch {}
        }

        // Hindari respons login/password dan respons check lain; kenali hanya
        // keterangan ketersediaan email yang muncul sesudah input diganti.
        function classifyMessage(text) {
            text = String(text || '').replace(/\s+/g,' ').slice(0,500);
            if (/(?:email|e-mail)[^.!]{0,85}(?:sudah|telah)\s*(?:di)?(?:gunakan|pakai|daftar)|(?:email|e-mail)[^.!]{0,75}(?:already|taken|exists|used|registered|not available)|(?:email|e-mail)[^.!]{0,85}(?:tidak tersedia)|(?:sudah\s*terdaftar|already\s*(?:used|registered|taken))[^.!]{0,40}(?:email|e-mail)/i.test(text)) {
                return {state:'err',message:'Situs menyatakan email sudah terdaftar.'};
            }
            if (/(?:email|e-mail)[^.!]{0,85}(?:belum\s*(?:di)?gunakan|belum\s*terdaftar|tersedia|available|not\s*(?:used|registered)|is\s*free)|(?:tersedia|available)[^.!]{0,35}(?:email|e-mail)/i.test(text)) {
                return {state:'ok',message:'Situs menyatakan email tersedia.'};
            }
            return null;
        }

        function classifyNetwork(entry, email) {
            // Harus ada kaitan dengan input email, bukan response umum dari halaman.
            const context = (entry.url+' '+entry.request).toLowerCase();
            const responseText = String(entry.response || '');
            const emailRelated = /(?:email|e-mail|check.?mail|validate.?mail)/i.test(context);
            const exactEmail = context.includes(email.toLowerCase());
            if (!emailRelated && !exactEmail) return null;
            // Hanya tanggapan request yang DIMULAI setelah email baru ditempel.
            if ((entry.sentAt || entry.at) < startAt || entry.at > Date.now()) return null;
            let decoded = context;
            try { decoded = decodeURIComponent(context.replace(/\+/g,' ')); } catch {}
            // Tolak respons untuk email berbeda/permintaan lama.
            const mentionedEmails = decoded.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
            if (mentionedEmails.length && !mentionedEmails.includes(email.toLowerCase())) return null;
            const explicit = classifyMessage(responseText);
            if (explicit) return explicit;
            if (!emailRelated || !/check|validat|exists|available|unique|used|taken|email/i.test(entry.url)) return null;
            let obj;
            try { obj = JSON.parse(responseText); } catch { return null; }
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
            const known = obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data) ? obj.data : obj;
            if (known.email && String(known.email).toLowerCase() !== email) return null;
            const pairs = [['available',true,'ok'],['available',false,'err'],
                ['exists',true,'err'],['exists',false,'ok'],
                ['taken',true,'err'],['taken',false,'ok'],
                ['is_available',true,'ok'],['is_available',false,'err'],
                ['is_unique',true,'ok'],['is_unique',false,'err'],
                ['email_exists',true,'err'],['email_exists',false,'ok']];
            for (const [key,val,state] of pairs) {
                if (Object.prototype.hasOwnProperty.call(known,key) && known[key] === val) {
                    return {state,message:'Respons validasi email diterima dari Gopath.'};
                }
            }
            for (const key of ['message','error','email_error','email_message']) {
                if (typeof known[key] === 'string') {
                    const found = classifyMessage(known[key]);
                    if (found) return found;
                }
            }
            return null;
        }

        function inspectEmailArea(input) {
            let node = input.parentElement;
            for (let depth=0; node && node !== document.body && depth < 4; depth++, node=node.parentElement) {
                if (node.querySelectorAll('input').length > 2) break;
                const text = (node.innerText || node.textContent || '').slice(0,500);
                const explicit = classifyMessage(text);
                if (explicit) return explicit;
            }
            // Jika ada panggilan validasi email dari situs, indikator visual
            // yang terkait hanya dengan kolom Email boleh digunakan. Tanpa
            // panggilan itu, centang bisa sekadar menandakan format benar.
            const hasEmailAjax = networkResponses.some(entry =>
                (entry.sentAt || entry.at) >= startAt && /email|e-mail|check.?mail|validat/i.test(entry.url+' '+entry.request));
            if (!hasEmailAjax) return null;
            let area = input.parentElement;
            for (let depth=0; area && area!==document.body && depth<3; ++depth,area=area.parentElement) {
                if (area.querySelectorAll('input').length>1) break;
                const icons = [...area.querySelectorAll('svg,i,[class*="icon"],[class*="feedback"],[class*="check"],[class*="cross"]')];
                for (const ico of icons) {
                    if (ico === input) continue;
                    if (getComputedStyle(ico).display==='none' || getComputedStyle(ico).visibility==='hidden') continue;
                    const attr = [ico.getAttribute('class'),ico.getAttribute('aria-label'),ico.getAttribute('title'),ico.getAttribute('data-icon')].join(' ').toLowerCase();
                    const glyph=(ico.textContent||'').trim();
                    if (/fa-times|fa-xmark|bi-x|circle-x|close-circle|icon-error|icon-invalid|text-danger|text-red|is-invalid|invalid-feedback/i.test(attr) || /^[✕×✖❌]$/.test(glyph))
                        return {state:'err',message:'Indikator X pada kolom Email muncul setelah validasi situs.'};
                    if (/fa-check|bi-check|check-circle|circle-check|icon-success|icon-valid|text-success|text-green|valid-feedback/i.test(attr) || /^[✓✔]$/.test(glyph))
                        return {state:'ok',message:'Indikator centang Email muncul setelah validasi situs.'};
                }
            }
            return null;
        }

        // Sniffer untuk respons AJAX yang dihasilkan oleh validator asli pada situs.
        // Tidak membuat request registrasi atau menebak endpoint API.
        function installNetworkObserver() {
            try {
                const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
                if (page.__tmEmailNetV12) return;
                page.__tmEmailNetV12 = true;
                const bodyText = body => {
                    if (!body) return '';
                    if (typeof body === 'string') return body;
                    try { if (typeof body.entries === 'function') return [...body.entries()].map(([k,v])=>k+'='+v).join('&'); }
                    catch {}
                    return String(body);
                };
                if (typeof page.fetch === 'function') {
                    const fetch0 = page.fetch;
                    page.fetch = function(...args) {
                        const requestUrl = String(typeof args[0] === 'string' ? args[0] : args[0]?.url || '');
                        const requestBody = bodyText(args[1]?.body);
                        const sentAt=Date.now();
                        return fetch0.apply(this,args).then(res => {
                            try {
                                if (res.ok) res.clone().text().then(body => {
                                    networkResponses.push({at:Date.now(),sentAt,url:requestUrl,request:requestBody,response:body.slice(0,10000)});
                                    networkResponses=networkResponses.slice(-25);
                                }).catch(()=>{});
                            } catch {}
                            return res;
                        });
                    };
                }
                const proto = page.XMLHttpRequest?.prototype;
                if (proto && proto.open && proto.send) {
                    const open0 = proto.open, send0 = proto.send;
                    proto.open = function(method,url,...rest) {
                        this.__tmCheckUrlV12 = String(url||'');
                        return open0.call(this,method,url,...rest);
                    };
                    proto.send = function(body) {
                        const requestBody = bodyText(body);
                        const sentAt = Date.now();
                        this.addEventListener('load', function() {
                            try {
                                if (this.status >= 200 && this.status < 300 && typeof this.responseText === 'string') {
                                    networkResponses.push({at:Date.now(),sentAt,url:this.__tmCheckUrlV12||'',request:requestBody,response:this.responseText.slice(0,10000)});
                                    networkResponses=networkResponses.slice(-25);
                                }
                            } catch {}
                        });
                        return send0.call(this,body);
                    };
                }
            } catch {}
        }
        installNetworkObserver();

        async function check(req) {
            if (!req || typeof req !== 'object' || !req.id || !req.email) return;
            if (!req.at || Date.now() - req.at > 60000) return;
            const token = ++serial;
            const email = String(req.email).trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return;
            function send(state,message) {
                if (serial !== token) return;
                try { GM_setValue(RES,{id:req.id,email,state,message,at:Date.now()}); } catch {}
            }
            currentEmail = email;
            const lookupUntil = Date.now() + 9000;
            let input = findRealEmail();
            while (!input && Date.now() < lookupUntil && serial===token) {
                await delay(180);
                input = findRealEmail();
            }
            if (serial!==token) return;
            if (!input) { send('unknown','Kolom email pendaftaran tidak ditemukan di halaman Gopath.'); return; }
            // Kosongkan sebelumnya untuk menghindari status tersisa dari email lama.
            writeInput(input,'');
            await delay(35);
            if (serial!==token) return;
            networkResponses=[];
            startAt=Date.now();
            writeInput(input,email);
            const deadline = Date.now()+6500;
            let candidate = null;
            let candidateAt = 0;
            while (Date.now()<deadline && serial===token) {
                await delay(75);
                if (input.value.trim().toLowerCase() !== email) {
                    send('unknown','Kolom email berubah selama pengecekan.'); return;
                }
                let finding = null;
                for (const net of networkResponses) {
                    finding=classifyNetwork(net,email);
                    if (finding) break;
                }
                if (!finding) finding=inspectEmailArea(input);
                if (finding) {
                    if (!candidate || candidate.state!==finding.state) {candidate=finding;candidateAt=Date.now();}
                    // Beri jeda pendek untuk memastikan UI tidak sekadar transisi.
                    if (Date.now()-candidateAt>=125) {send(candidate.state,candidate.message);return;}
                }
            }
            if (serial===token) send('unknown','Validator situs tidak memberikan konfirmasi bahwa email tersedia/sudah dipakai. Centang format saja tidak dianggap cukup.');
        }

        GM_addValueChangeListener(REQ, (_name,_old,newValue) => check(newValue));
        // Permintaan dapat dikirim sebelum tab selesai dimuat.
        try { check(GM_getValue(REQ,null)); } catch {}
    }

})();
