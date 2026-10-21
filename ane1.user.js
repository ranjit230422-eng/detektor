// ==UserScript==
// @name         Admitoto - Cek & Daftar Otomatis
// @namespace    http://tampermonkey.net/
// @version      9.29
// @description  Cari rekening di agentplayerlist_old.php (pisahkan format koma) → isi User ID/bank/nama otomatis → daftar → verifikasi di agentplayerlist.php. Plus tombol Hapus.
// @match        https://agwl2.admitoto.com/agentnewplayer.php*
// @match        https://my.livechatinc.com/*
// @grant        GM_xmlhttpRequest
// @connect      agwl2.admitoto.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

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
    function generatePassword() {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const bytes = new Uint8Array(32);
        let password;
        do {
            password = '';
            while (password.length < 10) {
                crypto.getRandomValues(bytes);
                for (const byte of bytes) {
                    if (byte < 248) password += alphabet[byte % alphabet.length];
                    if (password.length === 10) break;
                }
            }
        } while (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password));
        return password;
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

    // ==== PENGURAI CERDAS UNTUK FORMAT BANK,NAMA,NOMOR ====
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

                // Bersihkan User ID dari teks tambahan seperti "No Name"
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

                // Ekstraksi format koma: BANK,NAMA,NOMOR
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

                // Fallback jika format koma gagal tapi nomor ada di baris tersebut
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
       ROUTING
       ===================================================================== */
    if (location.hostname === 'my.livechatinc.com') {
        if (document.readyState === 'loading')
            document.addEventListener('DOMContentLoaded', mountBubble, { once: true });
        else mountBubble();
        return;
    }
    if (location.pathname !== '/agentnewplayer.php') return;
    installBridge();

    /* =====================================================================
       ██ BUBBLE DI LIVECHAT
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
        :host{color-scheme:dark}
        button,input,select,textarea{font:inherit}
        button{cursor:pointer;border:0;background:none;color:inherit}
        button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #22a88a;outline-offset:3px}
        button:disabled{cursor:not-allowed;opacity:.55}
        .panel{display:flex;flex-direction:column;width:min(470px,calc(100vw - 24px));height:min(690px,calc(100dvh - 24px));min-width:min(320px,calc(100vw - 24px));min-height:min(360px,calc(100dvh - 16px));max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);resize:both;overflow:hidden;border:1px solid #ffffffa6;border-radius:25px;background:#f1f5f6;color:#243648;box-shadow:0 24px 80px #0c25354a,0 5px 18px #0c253520;font:13px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;container-type:inline-size}
        .panel[hidden],.launcher[hidden],.result-card[hidden]{display:none!important}
        header{position:relative;isolation:isolate;display:flex;align-items:center;gap:13px;padding:23px 24px;background:linear-gradient(118deg,#102c40,#174353 75%,#205c62);color:#f5fffd;flex:none;cursor:grab;touch-action:none;user-select:none;overflow:hidden}
        header:after{content:'';position:absolute;z-index:-1;width:220px;height:220px;border:1px solid #76e9c725;border-radius:50%;right:-45px;top:-125px;box-shadow:0 0 0 24px #8ce6ca08,0 0 0 48px #8ce6ca05;pointer-events:none}
        .brand{display:grid;place-items:center;flex:none;width:46px;height:46px;border:1px solid #b5ffe945;background:linear-gradient(135deg,#76e5be,#b5f3e1);border-radius:15px;color:#143f3d;box-shadow:0 5px 14px #0002}
        .brand svg{width:24px;height:24px}
        .title{flex:1;min-width:0}
        .eyebrow{display:block;font-size:9px;letter-spacing:2.1px;font-weight:700;color:#9bddcc;margin-bottom:3px}
        .title strong{display:block;font-size:21px;line-height:1.2;font-weight:700;letter-spacing:-.6px}
        .title small{display:block;font-size:11px;color:#c0d4df;margin-top:6px}
        .icon-btn{display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:10px;background:#ffffff12;border:1px solid #ffffff20;color:inherit;font-size:20px;transition:background .15s}
        .icon-btn:hover{background:#ffffff26}
        .status{display:flex;align-items:center;gap:9px;padding:11px 23px;flex:none;border-bottom:1px solid #dce7e6;background:#e9f4ef;color:#246551;font-size:11px;line-height:1.5}
        .status-text{flex:1;min-width:0;overflow-wrap:anywhere}
        .dot{width:7px;height:7px;border-radius:50%;background:currentColor;flex:none;box-shadow:0 0 0 3px #2f8d6810}
        .status[data-state=init]{color:#4d6d85;background:#eaf0f7}
        .status[data-state=warn]{color:#875b10;background:#fff5da}
        .status[data-state=err]{color:#a63248;background:#fff0f2}
        .status-btn{padding:6px 10px;border-radius:7px;background:#fff;border:1px solid currentColor;font-weight:700;flex:none}
        .regform{flex:1;min-height:0;overflow:auto;padding:19px 20px 0;scrollbar-width:thin;scrollbar-color:#bbcbd1 transparent;scroll-padding-block:15px 85px}
        .form-intro{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 2px 13px}
        .form-intro strong{font-size:12px;color:#526777;font-weight:600}
        .form-intro span{font-size:10px;color:#648078}
        .form-card{padding:18px;background:#fff;border:1px solid #e0e8ed;border-radius:16px;box-shadow:0 3px 8px #1f3c5003;margin-bottom:13px}
        .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 16px}
        .grid>label{display:block;min-width:0}
        .span2{grid-column:1/-1}
        .section-title{grid-column:1/-1;display:flex;align-items:center;gap:10px;margin:0 0 1px;padding-bottom:13px;border-bottom:1px solid #edf1f4}
        .step{display:grid;place-items:center;width:32px;height:32px;background:#e9f5ef;color:#327963;border:1px solid #d8ebe1;border-radius:10px;font-weight:750;font-size:11px;flex:none}
        .bank-section .step{background:#ecf2fb;color:#5072a0;border-color:#dfe8f5}
        .section-title strong{display:block;font-size:13px;color:#253d50;letter-spacing:-.1px}
        .section-title small{display:block;font-size:10px;color:#778b98;margin-top:2px}
        .lbl{display:block;font-size:11px;line-height:18px;font-weight:650;color:#435c70;margin-bottom:6px}
        .auto-badge{float:right;border-radius:5px;padding:0 5px;background:#ecf7f0;color:#39735e;font-size:9px;font-weight:550;line-height:17px}
        .field{position:relative;display:block}
        .field input,.field select{display:block;width:100%;height:43px;min-width:0;padding:10px 12px;border:1px solid #d9e3e9;border-radius:9px;background:#f7f9fb;color:#233b4f;font-size:12px;transition:background .15s,border-color .15s,box-shadow .15s}
        .field input::placeholder{color:#8395a3;opacity:1}
        .field input:hover,.field select:hover{border-color:#a9c4c5;background:#fff}
        .field input:focus,.field select:focus{outline:none;border-color:#4da88e;box-shadow:0 0 0 3px #5fbd9c1c;background:#fff}
        .field select{appearance:none;padding-right:30px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b798c' stroke-width='2'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 9px center;background-size:17px}
        input[name=userid],input[name=rekening]{padding-right:78px}
        input[name=password]{padding-right:72px;letter-spacing:.6px;font-variant-numeric:tabular-nums}
        input[name=referral]{background:#f5faf7;color:#38745c;font-weight:650}
        .eye,.regen{position:absolute;right:5px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:29px;height:29px;border-radius:7px;color:#698291}
        .regen{right:36px;font-size:19px;color:#347f67}
        .eye:hover,.regen:hover{background:#e4eee9}
        .eye[aria-pressed=true]{color:#187b5d;background:#e4f4eb}
        .eye svg{width:16px;height:16px}
        .chip{position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:9px;font-weight:700;padding:3px 6px;border-radius:5px;pointer-events:none}
        .chip[hidden]{display:none}
        .chip[data-state=checking]{color:#406d9b;background:#e4edf9}
        .chip[data-state=ok]{color:#247557;background:#e0f3e8}
        .chip[data-state=err]{color:#ad3e50;background:#fbe7eb}
        .chip[data-state=warn]{color:#906516;background:#fff0cf}
        .summary{display:flex;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid #dce5e9;border-radius:12px;background:#eaf0f3;margin-top:1px}
        .sum{display:flex;align-items:flex-start;gap:8px;flex:1;min-width:180px;font-size:10px;line-height:1.6;color:#657c8d}
        .sum-ico{display:grid;place-items:center;width:18px;height:18px;flex:none;border-radius:50%;font-weight:700;background:#dce6ec;color:#668193;font-size:11px}
        .sum-text{overflow-wrap:anywhere}
        .sum[data-state=ok] .sum-ico{background:#ccebdc;color:#216e50}.sum[data-state=ok] .sum-text{color:#286b52}
        .sum[data-state=err] .sum-ico{background:#f6dce3;color:#a8364e}.sum[data-state=err] .sum-text{color:#a23e52}
        .sum[data-state=warn] .sum-ico{background:#f6e6c3;color:#856014}.sum[data-state=warn] .sum-text{color:#856014}
        .sum[data-state=checking] .sum-ico{background:#dce7f6;color:#466a99;animation:spin 1.2s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .actions{position:sticky;bottom:0;z-index:2;display:flex;gap:10px;padding:15px 0 17px;background:linear-gradient(#f1f5f6e6,#f1f5f6 25%);margin-top:4px}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;padding:12px 17px;border-radius:11px;font-size:12px;font-weight:700;transition:box-shadow .15s,background .15s,transform .15s}
        .btn:active{transform:translateY(1px)}
        .btn.ghost{border:1px solid #cfdce3;background:#fff;color:#4c6577;flex:0 0 auto}
        .btn.ghost:hover{background:#e9f0f4}
        .btn.ghost.danger{color:#a13650;border-color:#e3b8c2;background:#fff5f7}
        .btn.ghost.danger:hover{background:#fbe6ea;border-color:#d18e9f}
        .btn.primary{flex:1;background:linear-gradient(115deg,#195d50,#247d67);color:#fff;box-shadow:0 5px 12px #22665320}
        .btn.primary:hover{background:linear-gradient(115deg,#145348,#1b6e59);box-shadow:0 6px 16px #22665335}
        .btn-ico{font-size:16px}.btn svg{width:15px;height:15px}
        .result-card{margin-top:15px;padding:16px;border:1px solid #b9dfcc;border-radius:15px;background:linear-gradient(135deg,#edf9f0,#e4f4ee)}
        .result-heading{display:flex;align-items:center;gap:8px;color:#286d52;font-size:12px;margin-bottom:11px}
        .result-heading strong{flex:1}
        .result-heading>.icon-btn{background:#d9eee3;border-color:#c7e3d4;color:#38745c;width:26px;height:26px;font-size:18px}
        .result-card textarea{display:block;width:100%;min-height:141px;resize:vertical;padding:12px;border:1px solid #d0e5d8;border-radius:9px;background:#ffffffd9;color:#284b3f;font:11px/1.8 ui-monospace,monospace;overflow-wrap:anywhere}
        .result-tools{display:flex;align-items:center;gap:12px;margin-top:11px}
        .copy-result{padding:9px 14px;border-radius:8px;background:#296f55;color:#fff;font-size:11px;font-weight:700}
        .copy-result:hover{background:#205c46}.copy-feedback{font-size:10px;color:#4c7666;flex:1}
        footer{display:flex;gap:7px;align-items:center;justify-content:center;flex:none;border-top:1px solid #e0e7eb;background:#f9fbfb;padding:10px 16px;font-size:9px;color:#7a8e9b}
        footer svg{width:12px;height:12px;flex:none;color:#6f9285}
        .launcher{position:relative;display:grid;place-items:center;width:70px;height:70px;border:1px solid #c5fff166;border-radius:24px;background:linear-gradient(140deg,#1a4558,#123044);color:#b0f5d9;box-shadow:0 10px 28px #0a34454d,inset 0 1px 0 #ffffff30;cursor:grab;touch-action:none;user-select:none;transition:box-shadow .2s,transform .2s}
        .launcher:before{content:'';position:absolute;inset:7px;border-radius:18px;border:1px solid #b5ffe51c;pointer-events:none}
        .launcher:hover{transform:translateY(-2px);box-shadow:0 14px 35px #0a34455e}
        .launcher svg{width:29px;height:29px;pointer-events:none;filter:drop-shadow(0 2px 5px #91edc935)}
        .launcher .pulse{position:absolute;right:-2px;top:-2px;width:17px;height:17px;border:3px solid #f4faf7;border-radius:50%;background:#70dcb0;pointer-events:none}
        .launcher .tip{position:absolute;right:82px;white-space:nowrap;padding:10px 14px;border-radius:12px;background:#12384b;color:#f2fff9;font-size:12px;box-shadow:0 5px 16px #17384a26;opacity:0;pointer-events:none;transform:translateX(5px);transition:opacity .18s,transform .18s}
        .launcher:hover .tip,.launcher:focus-visible .tip{opacity:1;transform:translateX(0)}
        .transport{position:fixed;left:-10000px;top:0;width:1024px;height:768px;opacity:0;pointer-events:none;border:0}.transport iframe{width:100%;height:100%;border:0}
        .toasts{position:fixed;right:16px;bottom:100px;display:flex;flex-direction:column;gap:8px;z-index:2147483647;width:min(360px,calc(100vw - 32px));pointer-events:none}
        .toast{display:flex;align-items:flex-start;gap:10px;padding:13px;border:1px solid #d9e6e4;border-radius:13px;background:#fff;color:#355164;box-shadow:0 10px 35px #123a4d26;font-size:12px;line-height:1.5;opacity:0;transform:translateY(10px);transition:opacity .2s,transform .2s;pointer-events:auto}
        .toast.show{opacity:1;transform:translateY(0)}
        .t-ico{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;background:#e9f0f5;color:#4c7291;flex:none;font-weight:700}.t-msg{flex:1;overflow-wrap:anywhere}
        .toast-ok .t-ico{background:#d9f1e4;color:#267554}.toast-err .t-ico{background:#fbe2e8;color:#b34860}.toast-warn .t-ico{background:#fff0cc;color:#966c1d}
        @container(max-width:480px){.grid{grid-template-columns:1fr}.regform{padding:13px 12px 0}.form-card{padding:14px}.sum{min-width:100%}header{padding:18px 16px}.title strong{font-size:18px}.status{padding:10px 16px}.auto-badge{float:none;margin-left:7px}.form-intro span{display:none}}
        @media(max-width:470px){.grid{grid-template-columns:1fr}.regform{padding:13px 12px 0}.form-card{padding:14px}.sum{min-width:100%}header{padding:18px 16px}.title strong{font-size:18px}}
        @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}

        .panel{background:#0e1b2c;color:#edf5ff;border-color:#3a536e;box-shadow:0 24px 80px #0009,0 5px 18px #0005}
        header{background:linear-gradient(118deg,#163a55,#205c76 75%,#29758b);color:#fff}
        .eyebrow{color:#b5ffe5}.title small{color:#d1e6f2}
        .brand{background:linear-gradient(135deg,#77e8c1,#67c7ef);color:#0b3541;border-color:#aeffe6}
        .status{background:#102c29;color:#a2f2d3;border-bottom-color:#294b49;font-size:12px}
        .status[data-state=init]{background:#162e49;color:#badfff}
        .status[data-state=warn]{background:#352b16;color:#ffdc8c}
        .status[data-state=err]{background:#381d2a;color:#ffb3c3}
        .status-btn{background:#f9d887;color:#362b14;border-color:#f9d887}
        .regform{scrollbar-color:#47607b #0e1b2c}
        .form-intro strong{color:#d7e6f4}.form-intro span{color:#afc5d9}
        .form-card{background:#16263a;border-color:#354c65;box-shadow:0 4px 12px #0002}
        .section-title{border-bottom-color:#33495f}.section-title strong{color:#f3f8ff;font-size:14px}.section-title small{color:#b1c6da;font-size:11px}
        .step{background:#1b493f;color:#a6f4d3;border-color:#347460}
        .bank-section .step{background:#223f61;color:#b6dbff;border-color:#42658e}
        .lbl{color:#e1ecf7;font-size:12px}
        .auto-badge{background:#20483c;color:#aff5d7;font-size:10px}
        .field input,.field select{background:#0d1b2c;color:#f0f7ff;border-color:#49617a;font-size:13px}
        .field input::placeholder{color:#a3b7cd}
        .field input:hover,.field select:hover{background:#11253a;border-color:#7190ab}
        .field input:focus,.field select:focus{background:#112b3b;border-color:#7de7c3;box-shadow:0 0 0 3px #7de7c325}
        .field select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23c1d7ec' stroke-width='2'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E")}
        .field select option{background:#132439;color:#f0f7ff}
        input[name=referral]{background:#112d2b;color:#b5f4d9}
        .eye{color:#bed4e8}.regen{color:#a1efd2}
        .eye:hover,.regen:hover{background:#2a4555}.eye[aria-pressed=true]{background:#245447;color:#b5ffe5}
        .chip[data-state=checking]{background:#244564;color:#d1eaff}
        .chip[data-state=ok]{background:#20513e;color:#b5f7d3}
        .chip[data-state=err]{background:#592c3c;color:#ffc2d1}
        .chip[data-state=warn]{background:#514122;color:#ffe4a1}
        .summary{background:#112237;border-color:#3b526b}
        .sum{color:#c2d3e4;font-size:11px}.sum-ico{background:#2b425b;color:#d2e4f4}
        .sum[data-state=ok] .sum-ico{background:#20513e;color:#aef3cd}.sum[data-state=ok] .sum-text{color:#aef3cd}
        .sum[data-state=err] .sum-ico{background:#592c3c;color:#ffb3c6}.sum[data-state=err] .sum-text{color:#ffb3c6}
        .sum[data-state=warn] .sum-ico{background:#514122;color:#ffe0a0}.sum[data-state=warn] .sum-text{color:#ffe0a0}
        .sum[data-state=checking] .sum-ico{background:#244564;color:#c6e5ff}
        .actions{background:linear-gradient(#0e1b2ce6,#0e1b2c 25%)}
        .btn{font-size:13px}.btn.ghost{background:#20354c;border-color:#49647d;color:#e3eff9}.btn.ghost:hover{background:#2c465f}
        .btn.ghost.danger{color:#ffb3c6;border-color:#8a3f52;background:#2e1a22}
        .btn.ghost.danger:hover{background:#3d222d;border-color:#b05068}
        .btn.primary{background:linear-gradient(110deg,#7ce7c3,#6bc8ed);color:#0b2c38;box-shadow:0 5px 16px #61d8b525}
        .btn.primary:hover{background:linear-gradient(110deg,#98f3d4,#8bdbf7);box-shadow:0 6px 20px #61d8b540}
        .result-card{background:linear-gradient(135deg,#16392f,#143438);border-color:#43866e}
        .result-heading{color:#b1f7d8}.result-heading>.icon-btn{background:#285443;border-color:#457f65;color:#cbffe2}
        .result-card textarea{background:#0b211f;color:#e1fff0;border-color:#4b7766;font-size:12px}
        .copy-result{background:#99efca;color:#14382b;font-size:12px}.copy-result:hover{background:#b3ffdd}.copy-feedback{color:#c0e2d1;font-size:11px}
        footer{background:#0c1828;color:#b4c8dc;border-color:#30465e;font-size:10px}footer svg{color:#9edbc4}
        .launcher{background:linear-gradient(140deg,#68e0b7,#4bafd5);color:#0a3441;border-color:#c2ffe9;box-shadow:0 10px 30px #122c5870,inset 0 1px 0 #ffffff90}
        .launcher:before{border-color:#ffffff60}.launcher:hover{box-shadow:0 14px 36px #47c7b34d}
        .launcher .pulse{background:#f3fff9;border-color:#27765f}.launcher .tip{background:#163a52;color:#f1fff9;border:1px solid #477a8f}
        .toast{background:#162a40;color:#edf6ff;border-color:#49617a;box-shadow:0 10px 35px #0006}
        .t-ico{background:#294660;color:#c7e4ff}.toast-ok .t-ico{background:#25503e;color:#b5f5d1}.toast-err .t-ico{background:#592c3c;color:#ffc0d0}.toast-warn .t-ico{background:#514122;color:#ffe4a1}

        .userid-block label{display:block}.userid-block input[name=userid]{padding-right:12px;font-size:14px}
        .userid-block .chip{display:none!important}
        .userid-status{display:flex;align-items:center;gap:12px;margin-top:9px;padding:13px 14px;border:1px solid #476079;border-left-width:4px;border-radius:10px;background:#152a40;color:#d2e4f4}
        .uid-symbol{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:50%;background:#29455f;font-size:20px;font-weight:800}
        .uid-title{display:block;font-size:14px;font-weight:800;letter-spacing:.25px;line-height:1.5}
        .uid-detail{display:block;font-size:12px;line-height:1.5;margin-top:2px;overflow-wrap:anywhere}
        .userid-status[data-state=ok]{background:#133d2e;border-color:#71dfac;color:#c3ffe0}
        .userid-status[data-state=ok] .uid-symbol{background:#91efbd;color:#10442b}
        .userid-status[data-state=err]{background:#492332;border-color:#ff91aa;color:#ffdae3}
        .userid-status[data-state=err] .uid-symbol{background:#ff9bb1;color:#5a1328}
        .userid-status[data-state=warn]{background:#3d321c;border-color:#edc66b;color:#ffebbb}
        .userid-status[data-state=warn] .uid-symbol{background:#f3ce7f;color:#4d350b}
        .userid-status[data-state=checking]{background:#19364f;border-color:#84bde9;color:#d2ebff}
        .userid-status[data-state=checking] .uid-symbol{background:#2e5575;color:#d2ebff;animation:spin 1.2s linear infinite}
        .userid-status[data-state=old]{background:#19394d;border-color:#8dc4e2;color:#d8f1ff}
        .userid-status[data-state=old] .uid-symbol{background:#8dc4e2;color:#122e3d}
        .summary .sum{font-size:12px}.summary .sum-ico{width:22px;height:22px;font-size:13px}
        @container(max-width:480px){.uid-title{font-size:13px}}

        .rekening-block label{display:block}.rekening-block input[name=rekening]{padding-right:12px;font-size:14px}
        .rekening-block .chip{display:none!important}
        select[name=bank]{min-height:46px;font-size:13px;font-weight:600;cursor:pointer}
        select[name=bank] optgroup{background:#132439;color:#a8e8d1;font-weight:700}
        select[name=bank] option{background:#132439;color:#f0f7ff;font-weight:400}
        #checkRegistrationLog[hidden]{display:none!important}
        .actions{flex-wrap:wrap}

        .panel{border-radius:19px}
        header{padding:14px 17px;gap:11px}
        .brand{width:38px;height:38px;border-radius:12px}.brand svg{width:21px;height:21px}
        .eyebrow{font-size:8px;letter-spacing:1.6px;margin-bottom:3px}
        .title strong{font-size:18px;letter-spacing:-.35px}.title small{font-size:10px;margin-top:4px}
        .status{padding:8px 16px;font-size:11px;line-height:1.45}
        .regform{padding:12px 13px 10px;scroll-padding-block:10px}
        .form-intro{margin:0 2px 10px}.form-intro strong{font-size:11px}.form-intro span{font-size:9px}
        .form-card{padding:13px;margin-bottom:10px;border-radius:12px}
        .grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:11px 12px}
        .section-title{padding-bottom:9px;gap:9px;margin-bottom:0}.step{width:27px;height:27px;border-radius:8px;font-size:10px}
        .section-title strong{font-size:12px}.section-title small{font-size:10px;margin-top:1px}
        .lbl{font-size:11px;line-height:17px;margin-bottom:5px}.auto-badge{font-size:9px;line-height:16px;float:right}
        .field input,.field select{height:39px;font-size:12px;border-radius:8px;padding-top:8px;padding-bottom:8px}
        select[name=bank]{min-height:40px;font-size:12px}
        .userid-block input[name=userid],.rekening-block input[name=rekening]{font-size:13px}
        .userid-status{padding:9px 10px;gap:9px;margin-top:7px;border-radius:8px;border-left-width:3px}
        .uid-symbol{width:26px;height:26px;font-size:17px}.uid-title{font-size:12px;letter-spacing:.1px;line-height:1.4}.uid-detail{font-size:11px;margin-top:2px}
        .summary{display:none}
        .actions{position:static;flex:none;margin:0;padding:11px 14px;gap:9px;background:#122337;border-top:1px solid #354d64;box-shadow:0 -5px 16px #00000015}
        .btn{min-height:42px;padding:10px 14px;font-size:12px;border-radius:9px}
        .btn.primary{min-width:120px;box-shadow:0 4px 12px #61d8b51c}
        footer{padding:7px 12px;font-size:9px;line-height:1.4}
        .result-card{padding:12px;margin-top:10px;border-radius:11px}.result-heading{font-size:11px;margin-bottom:9px}
        .result-card textarea{min-height:135px;padding:10px;font-size:11px;line-height:1.7}.result-tools{gap:9px;margin-top:9px}.copy-feedback{font-size:10px}
        .launcher{width:58px;height:58px;border-radius:19px}.launcher:before{inset:6px;border-radius:14px}.launcher svg{width:25px;height:25px}
        .launcher .pulse{width:14px;height:14px;border-width:2px}.launcher .tip{right:70px;font-size:11px;padding:8px 12px}
        @container(max-width:410px){.grid{grid-template-columns:1fr}.form-card{padding:12px}.regform{padding:11px 10px}.title strong{font-size:16px}.auto-badge{float:right}.form-intro span{display:none}.actions{padding:10px}.uid-title{font-size:11px}}
        @media(max-width:410px){.grid{grid-template-columns:1fr}.form-card{padding:12px}.actions{padding:10px}.title small{font-size:9px}}

        .panel{border-radius:15px;background:#111f30;border-color:#3b536c}
        header{padding:14px 16px;background:#19354d;border-bottom:2px solid #6bd4b3;gap:10px}
        header:after,.eyebrow,.form-intro,.section-title,.auto-badge{display:none}
        .brand{width:32px;height:32px;border-radius:9px;box-shadow:none}.brand svg{width:19px;height:19px}
        .title strong{font-size:17px}.title small{font-size:11px;margin-top:4px;color:#d2e4f1}
        .status{padding:8px 14px;font-size:11px;border-bottom-width:1px}
        .regform{padding:14px;background:#111f30}
        .form-card{padding:0;margin:0 0 11px;border:0;border-radius:0;background:none;box-shadow:none}
        .grid{display:grid;grid-template-columns:minmax(0,1fr);gap:11px}
        .grid>label,.userid-block label,.rekening-block label{display:grid;grid-template-columns:100px minmax(0,1fr);align-items:center;gap:10px}
        .span2{grid-column:1/-1}
        .lbl{margin:0;font-size:12px;line-height:1.4;font-weight:600;color:#dce9f6}
        .field{min-width:0}
        .field input,.field select{height:39px;border-radius:7px;font-size:13px;background:#182d43;border-color:#4b657e;color:#f3f8ff}
        .field input::placeholder{color:#b0c2d5;font-size:12px}
        .field input:focus,.field select:focus{background:#1b3549;border-color:#87e6c7;box-shadow:0 0 0 2px #87e6c723}
        select[name=bank]{min-height:39px;font-size:12px;font-weight:500}
        input[name=referral]{color:#aef2d3;background:#19392f}
        input[name=password]{letter-spacing:.2px}
        .userid-status{margin:7px 0 0 110px;padding:8px 9px;gap:8px;border-radius:7px;border-left-width:3px}
        .uid-symbol{width:23px;height:23px;font-size:15px}.uid-title{font-size:11px;letter-spacing:0;line-height:1.4}.uid-detail{font-size:10px;line-height:1.5}
        .userid-status[data-state=idle]{padding:7px 9px;background:#182b3f;border-color:#405873;color:#bacfe3}
        .userid-status[data-state=idle] .uid-detail{display:none}
        .actions{padding:11px 14px;background:#172b40;border-top-color:#3b536c;box-shadow:none;gap:8px}
        .btn{min-height:42px;border-radius:8px;font-size:12px}.btn.primary{background:#87e3c2;color:#123b30;box-shadow:none;font-size:14px}.btn.primary:hover{background:#a1f2d4;box-shadow:none}
        .btn.ghost{background:#233e57;color:#e7f2fc;border-color:#526f88}
        .btn.ghost.danger{background:#3a1e2a;color:#ffb9cc;border-color:#7d374b}.btn.ghost.danger:hover{background:#4d2735;border-color:#a04860}
        footer{padding:7px 10px;background:#111f30;font-size:9px;color:#aec2d5}
        .result-card{margin-top:12px;border-radius:9px;padding:12px}.result-card textarea{font-size:12px;min-height:150px}
        .launcher{width:54px;height:54px;border-radius:50%;background:#86e2c2;color:#153e34;border-color:#c4ffeb;box-shadow:0 5px 18px #0005}
        .launcher:before{display:none}.launcher .pulse{width:12px;height:12px;right:0;top:0}.launcher svg{width:24px;height:24px}
        @container(max-width:370px){.grid>label,.userid-block label,.rekening-block label{grid-template-columns:1fr;gap:5px}.userid-status{margin-left:0}.regform{padding:12px}.title strong{font-size:16px}.title small{font-size:10px}}
        @media(max-width:370px){.grid>label,.userid-block label,.rekening-block label{grid-template-columns:1fr;gap:5px}.userid-status{margin-left:0}}
        .chat-import{margin:0 0 12px;padding:10px;border:1px solid #41647a;border-radius:9px;background:#173147}
        .chat-import-top{display:flex;align-items:center;gap:9px}.chat-import-top button{padding:7px 10px;border-radius:6px;background:#a0e8cf;color:#153c32;font-size:11px;font-weight:700;flex:none}
        .chat-import-message{font-size:11px;color:#e0eef9;line-height:1.5;overflow-wrap:anywhere}.chat-import select{width:100%;margin-top:8px;padding:8px;background:#11283b;border:1px solid #5a7a91;border-radius:6px;color:#f0f7ff;font-size:12px}
        .chat-import select[hidden]{display:none!important}
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
                            <input name="password" type="password" required minlength="10" maxlength="10" pattern="(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{10}" placeholder="10 karakter otomatis" autocomplete="new-password">
                            <button type="button" class="regen" id="generatePassword" aria-label="Buat password baru 10 karakter" title="Buat password baru">↻</button>
                            <button type="button" class="eye" id="eye" aria-label="Tampilkan password" aria-pressed="false">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                            </button>
                        </span>
                    </label>

                    <label>
                        <span class="lbl">Email</span>
                        <span class="field"><input name="email" type="email" required placeholder="player@email.com"></span>
                    </label>

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

        // ---------- refs ----------
        const $ = s => root.querySelector(s);
        const panel = $('.panel');
        const iframe = $('#bridge');
        const form = $('#regform');
        function applyAccountDefaults() {
            form.elements.password.value = generatePassword();
            form.elements.referral.value = DEFAULT_REFERRAL;
        }
        applyAccountDefaults();
        $('#generatePassword').addEventListener('click', () => {
            if (state.sending) return;
            form.elements.password.value = generatePassword();
            toast('Password baru campuran huruf dan angka sudah dibuat.', 'info');
        });
        const statusBar = $('#status');
        const statusText = statusBar.querySelector('.status-text');
        const activateBtn = $('#activateBtn');
        const sendBtn = $('#sendBtn');
        const toasts = $('#toasts');

        // ---------- state ----------
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

        // ---------- helpers ----------
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

        // ---------- koneksi ke bridge ----------
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

        // ---------- cek otomatis ----------
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

        // ---------- toggle password ----------
        root.getElementById('eye').addEventListener('click', e => {
            const inp = form.elements.password;
            const show = inp.type === 'password';
            inp.type = show ? 'text' : 'password';
            e.currentTarget.setAttribute('aria-pressed', String(show));
            e.currentTarget.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
        });

        // ---------- validasi + submit ----------
        const REQUIRED = [
            ['userid', 'User ID', /^[A-Za-z0-9._-]{3,20}$/],
            ['password', 'Password (10 karakter, huruf dan angka)', /^(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{10}$/],
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

        // ---------- hapus / kosongkan form ----------
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

        // ---------- cek ulang ----------
        root.getElementById('recheck').addEventListener('click', () => {
            state.checks.uid.value = '__force__';
            state.checks.rek.value = '__force__';
            runCheck('uid');
            runCheck('rek');
        });

        // ---------- buka/tutup ----------
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

})();
