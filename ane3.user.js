// ==UserScript==
// @name         LiveChat Minimal UI + Toggles (per-ID) + Left-Bar Pulse + Accent Toast + Fixed Sidebars
// @namespace    http://tampermonkey.net/
// @version      2.0.4
// @description  Garis kiri seragam (termasuk Archived). Toast ber-outline sesuai toggle & width 300px. Semua fitur tetap, sidebar width tetap. Left host & pulse scale mengikuti kustom kamu.
// @author       @anonymous
// @match        https://my.livechatinc.com/chats/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// ==/UserScript==

(function () {
    'use strict';

    // ====== Konfigurasi ======
    const BLINK_DELAY_MS = 180000; // 3 menit (Merah Berkedip + ⚠️)
    const YELLOW_THRESHOLD_MS = 120000; // 2 menit (Kuning Diam)
    const TOAST_LIFETIME_MS = 180000;
    const TOAST_ACCENT_COLOR = '#ffcc00'; // Amber/Gold (Lebih Jelas di Putih)
    const TOAST_ACCENT_COLOR_RED = '#ff0000'; // aksen merah terang
    const TOAST_ACCENT_COLOR_BLUE = '#011d47ff'; // Biru Jeans Tua (Pengganti Putih)
    const LEFTBAR_WIDTH_PX = 3; // ketebalan garis kiri
    const TAG_RAINBOW = 'rainbow'; // 🌈 mode pelangi

    // ====== SLA Notification Toggle Settings ======
    const SLA_NOTIF_2MIN_KEY = 'slaNotif2minEnabled';
    const SLA_NOTIF_3MIN_KEY = 'slaNotif3minEnabled';

    // =======================================
    // Utils: Universal Robust Helpers
    // =======================================
    const archTags = [
        'archived', 'customer left', 'inactivity', 'meninggalkan',
        'followup', 'sent to', 'joined', 'assigned', 'invited', 'closed',
        'transferred', 'ditransfer'
    ];

    const detectIsTyping = (item) => {
        if (!item) return false;
        // Hanya deteksi elemen indikator khusus, jangan scan seluruh teks item
        // karena teks "..." di akhir pesan (truncation) akan terbaca sebagai typing.
        const typingEl = item.querySelector(
            '[class*="typing"], [class*="dots"], [data-test*="typing"], [data-testid*="typing"], ' +
            '.typing-indicator, [aria-label*="typing"], [class*="lc-dots"], [class*="lc-typing"], ' +
            'img[src*="typing"], .css-14v0z1c, [class*="DotIndicator"], [class*="ThreeDots"], ' +
            '[class*="LoadingDots"], [class*="typing_dots"], [class*="DotAnimation"]'
        ) || item.querySelector('svg[class*="typing"], svg[class*="dots"], svg[aria-label*="typing"]');

        if (typingEl) return true;

        // Fallback: Cek apakah ada elemen yang secara spesifik mengandung teks 'mengetik' atau 'typing'
        // tapi bukan bagian dari preview pesan.
        const dotsEl = item.querySelector('.chat-item__message--typing, .lc-typing-indicator');
        if (dotsEl) return true;

        return false;
    };

    // Helper functions to check notification settings
    // Use localStorage as a runtime bridge from Script 1
    const isNotif2minEnabled = () => localStorage.getItem(SLA_NOTIF_2MIN_KEY) !== 'false';
    const isNotif3minEnabled = () => localStorage.getItem(SLA_NOTIF_3MIN_KEY) !== 'false';

    // Function to clear specific type of SLA toasts
    const clearSlaToasts = (type) => {
        const host = document.querySelector('.my-toast-host');
        if (!host) return;

        const toasts = host.querySelectorAll('.my-toast[data-chat-id]');
        toasts.forEach(toast => {
            const msgEl = toast.querySelector('.my-toast-msg');
            if (!msgEl) return;
            const text = msgEl.textContent || '';

            if (type === '2min' && text.includes('2 MENIT')) {
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 200);
            } else if (type === '3min' && text.includes('3 MENIT')) {
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 200);
            }
        });
    };

    // Listen for setting changes from dashboard
    window.addEventListener('slaNotifSettingChanged', (e) => {
        const { type, enabled } = e.detail;
        console.log(`🔔 SLA Notif ${type} changed to: ${enabled ? 'ON' : 'OFF'}`);

        // If turned OFF, clear existing toasts of that type
        if (!enabled) {
            clearSlaToasts(type);
        }
    });

    // =========================
    // Utilities (URL & Chat ID)
    // =========================
    const getActiveChatId = () => {
        // 1. Cek via attribute aria-selected atau class active (Sangat Akurat)
        const selectedLi = document.querySelector('li[data-testid^="chat-item-"][aria-selected="true"], li[class*="selected"], li[class*="active"]');
        if (selectedLi) {
            const tid = selectedLi.getAttribute('data-testid') || '';
            const m = tid.match(/chat-item-([^/]+)/i);
            if (m) return m[1];
        }

        // 2. Fallback via URL
        const m = location.pathname.match(/\/chats\/(?:[^/]+\/)?([^/]+)/i);
        return m ? m[1] : null;
    };

    const manuallyRepliedIds = new Map(); // chatId -> timestamp (untuk cleanup otomatis)

    // --- FITUR BARU: Deteksi Kirim Pesan untuk Reset Instan ---
    const handleManualReply = () => {
        const activeId = getActiveChatId();
        if (activeId) {
            console.log(`🚀 [${activeId}] Reply terdeteksi via Input! Mereset Timer...`);

            // Mark as manually replied to prevent restart while sidebar lags
            manuallyRepliedIds.set(activeId, Date.now());

            unrepliedStartTimes.delete(activeId);
            saveUnrepliedTimers();

            // Cari item dan bersihkan visualnya segera
            const item = findItemByChatId(activeId);
            if (item) {
                item.classList.remove('blink-red', 'is-red');
                item.classList.add('replied-instant'); // Force green state visually
                delete item.dataset.redToastShown;
                delete item.dataset.yellowToastShown;
                removeWarningBadge(item);
            }
            updateLiveToastIndices(); // Tutup toast segera
        }
    };

    // Listen untuk klik tombol Send dan tekan Enter
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-testid="send-button"], [class*="send-button"], button.send')) {
            handleManualReply();
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            // Cek apakah sedang fokus di area pesan
            if (document.activeElement.matches('[data-testid="message-input"], [contenteditable="true"], textarea')) {
                handleManualReply();
            }
        }
    }, true);

    const onRouteChange = (cb) => {
        const _ps = history.pushState, _rs = history.replaceState;
        history.pushState = function () { const r = _ps.apply(this, arguments); setTimeout(cb, 0); return r; };
        history.replaceState = function () { const r = _rs.apply(this, arguments); setTimeout(cb, 0); return r; };
        window.addEventListener('popstate', () => setTimeout(cb, 0));
    };

    const findItemByChatId = (chatId) => {
        if (!chatId) return null;
        const li = document.querySelector(`li[data-testid="chat-item-${chatId}"]`);
        return li ? (li.querySelector('.chat-item') || li) : null;
    };

    const getChatIdFromItem = (item) => {
        if (!item) return null;
        if (item.dataset.chatId) return item.dataset.chatId;
        const holder = item.closest('li[data-testid^="chat-item-"]') || item;
        const tid = holder.getAttribute('data-testid') || '';
        const m = tid.match(/chat-item-([^/]+)/i);
        if (m) { item.dataset.chatId = m[1]; return m[1]; }
        const a = item.querySelector('a[href*="/chats/"]');
        if (a) {
            const m2 = (a.getAttribute('href') || '').match(/\/chats\/(?:[^/]+\/)?([^/]+)/i);
            if (m2) { item.dataset.chatId = m2[1]; return m2[1]; }
        }
        return null;
    };

    const getCurrentChatItem = () => findItemByChatId(getActiveChatId());
    const storageKeyForItem = (item) => {
        const id = getChatIdFromItem(item);
        return id ? `chat-toggle-${id}` : null;
    };

    // ============== DOM Helpers ==============
    const waitForElement = (selector, callback) => {
        const el = document.querySelector(selector);
        if (el) callback(el); else setTimeout(() => waitForElement(selector, callback), 500);
    };

    // ======== Persist (per-ID) ========
    const saveColor = (item, token) => {
        const key = storageKeyForItem(item);
        if (key) {
            GM_setValue(key, token);
            localStorage.setItem(key, token); // bridge
        }
    };
    const getSavedColor = (item) => {
        const key = storageKeyForItem(item);
        if (!key) return null;
        let val = GM_getValue(key);
        if (val === undefined) {
            val = localStorage.getItem(key);
            if (val) GM_setValue(key, val);
        }
        return val;
    };
    const clearSavedColor = (item) => {
        const key = storageKeyForItem(item);
        if (key) {
            GM_deleteValue(key);
            localStorage.removeItem(key);
        }
    };

    // ====== Toast ======
    const ensureToastHost = () => {
        let host = document.querySelector('.my-toast-host');
        if (!host) {
            host = document.createElement('div');
            host.className = 'my-toast-host';
            document.body.appendChild(host);
        }
        return host;
    };

    const showToast = (message, accent = TOAST_ACCENT_COLOR, chatId = null, duration = TOAST_LIFETIME_MS, onUserClose = null) => {
        const host = ensureToastHost();

        // --- ANTI-SPAM NOTIFIKASI ---
        const existingToast = host.querySelector(`.my-toast[data-chat-id="${chatId}"]`);
        if (chatId && existingToast) {
            // Jika notifikasi untuk chat ini sudah ada, update pesannya saja, jangan buat baru
            const msgSpan = existingToast.querySelector('.my-toast-msg');
            if (msgSpan) {
                if (message.includes('#')) {
                    const parts = message.split(/#\d+/);
                    msgSpan.innerHTML = `${parts[0]}#<span class="live-idx">?</span>${parts[1] || ''}`;
                } else {
                    msgSpan.textContent = message;
                }
            }
            // Update warna aksen jika berubah (misal dari kuning ke merah)
            existingToast.style.setProperty('--toast-accent', accent);
            updateLiveToastIndices();
            return;
        }

        const toast = document.createElement('div');
        toast.className = 'my-toast';
        if (chatId) {
            toast.dataset.chatId = chatId;
            toast.style.cursor = 'pointer';
        }
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.style.setProperty('--toast-accent', accent);

        const msg = document.createElement('span');
        msg.className = 'my-toast-msg';

        if (message.includes('#')) {
            const parts = message.split(/#\d+/);
            msg.innerHTML = `${parts[0]}#<span class="live-idx">?</span>${parts[1] || ''}`;
        } else {
            msg.textContent = message;
        }

        const btn = document.createElement('button');
        btn.className = 'my-toast-close';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Close');
        btn.textContent = '×';

        toast.appendChild(msg);
        toast.appendChild(btn);
        host.appendChild(toast);

        if (chatId) updateLiveToastIndices();

        const close = (isUserAction = false) => {
            if (isUserAction && onUserClose) onUserClose();

            // Bersihkan flag Shown di item agar bisa dipicu lagi nanti jika diperlukan
            if (chatId) {
                const itm = findItemByChatId(chatId);
                if (itm) {
                    delete itm.dataset.redToastShown;
                    delete itm.dataset.yellowToastShown;
                }
            }

            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 200);
        };

        // --- FITUR QUICK-JUMP ---
        toast.addEventListener('click', () => {
            if (chatId) {
                const item = findItemByChatId(chatId);
                if (item) {
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    item.click();
                }
            }
            close(false);
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            close(true);
        });

        setTimeout(() => {
            if (toast.parentElement) close(false);
        }, duration);
    };

    // =========================
    // Toggle logic + Timer kuning & Merah (Locked Timestamp)
    // =========================
    const bootTime = Date.now(); // Catat waktu booting script
    const UNREPLIED_STORAGE_KEY = 'chatUnrepliedStartTimes';
    const initUnrepliedMap = () => {
        let saved = GM_getValue(UNREPLIED_STORAGE_KEY);
        if (saved === undefined) {
            // Migration
            saved = localStorage.getItem(UNREPLIED_STORAGE_KEY);
            if (saved) {
                try {
                    const obj = JSON.parse(saved);
                    GM_setValue(UNREPLIED_STORAGE_KEY, obj);
                    return new Map(Object.entries(obj).map(([id, time]) => [id, Number(time)]));
                } catch (e) { return new Map(); }
            }
            return new Map();
        }
        return new Map(Object.entries(saved).map(([id, time]) => [id, Number(time)]));
    };

    const yellowTimers = new Map(); // chatId -> timeoutId
    const unrepliedStartTimes = initUnrepliedMap();

    const saveUnrepliedTimers = () => {
        const obj = {};
        unrepliedStartTimes.forEach((v, k) => obj[k] = v);
        GM_setValue(UNREPLIED_STORAGE_KEY, obj);
        localStorage.setItem(UNREPLIED_STORAGE_KEY, JSON.stringify(obj)); // bridge
    };

    const setYellowTimer = (item, enable) => {
        const chatId = getChatIdFromItem(item);
        if (!chatId) return;

        if (yellowTimers.has(chatId)) {
            clearTimeout(yellowTimers.get(chatId));
            yellowTimers.delete(chatId);
        }

        const currentNode = findItemByChatId(chatId);
        if (currentNode) currentNode.classList.remove('blink-yellow');

        if (enable) {
            const tid = setTimeout(() => {
                const node = findItemByChatId(chatId);
                const stillYellow = node && getSavedColor(node) === 'yellow';
                if (stillYellow) {
                    node.classList.add('blink-yellow');
                    showToast(`⏳ Cek chat yang ditandai (kuning) • #1`, TOAST_ACCENT_COLOR, chatId);
                }
                yellowTimers.delete(chatId);
            }, BLINK_DELAY_MS);
            yellowTimers.set(chatId, tid);
        }
    };

    // ========== Warning Badge Functions ==========
    const addWarningBadge = (item) => {
        if (item.querySelector('.warning-badge-3min')) return;
        const badge = document.createElement('div');
        badge.className = 'warning-badge-3min';
        badge.innerHTML = '⚠️';
        item.style.position = 'relative';
        item.appendChild(badge);
    };

    const removeWarningBadge = (item) => {
        const badge = item.querySelector('.warning-badge-3min');
        if (badge) badge.remove();
    };

    // ========== Blink merah (LOCK pada pesan pertama) ==========
    const setRedBlinkState = (item, isRed) => {
        const chatId = getChatIdFromItem(item);
        if (!chatId) return;

        // --- DETEKSI REPLY AGENT YANG LEBIH AKURAT ---
        const hasReplyIcon = !!(
            item.querySelector('[data-testid="replied"]') ||
            item.querySelector('svg[data-testid="Icon--reply"]') ||
            item.querySelector('.chat-item__replied')
        );

        const hasUnread = !!item.querySelector('[data-testid="unread-messages-count"]');
        const isActive = (chatId === getActiveChatId());

        const itemText_lower = (item.textContent || "").toLowerCase();
        const hasReply = !!hasReplyIcon;

        // --- CLEANUP MANUAL REPLY STATUS ---
        if (hasReply || hasUnread) {
            manuallyRepliedIds.delete(chatId);
            item.classList.remove('replied-instant');
            delete item.dataset.redToastSuppressed;
            delete item.dataset.yellowToastSuppressed;
        }

        // --- FIX: Deteksi Pesan Klien di Chat Aktif ---
        // Jika chat aktif, hasUnread biasanya false. Kita cek DOM chat window.
        if (isActive && manuallyRepliedIds.has(chatId)) {
            const allMsgs = document.querySelectorAll('[data-testid="agent-message"], [data-testid="customer-message"]');
            if (allMsgs.length > 0) {
                const last = allMsgs[allMsgs.length - 1];
                if (last.getAttribute('data-testid') === 'customer-message') {
                    console.log(`🧹 Klien membalas di chat aktif [${chatId}], menghapus flag manual reply.`);
                    manuallyRepliedIds.delete(chatId);
                }
            }
        }

        // --- SAFETY TIMEOUT: Jika flag manual reply macet > 30 detik, hapus paksa ---
        if (manuallyRepliedIds.has(chatId)) {
            const replyTime = manuallyRepliedIds.get(chatId);
            if (Date.now() - replyTime > 30000) {
                console.log(`🕒 Manual reply flag expired for [${chatId}], removing...`);
                manuallyRepliedIds.delete(chatId);
            }
        }

        if (manuallyRepliedIds.has(chatId) && !hasReply) {
            item.classList.remove('blink-red', 'is-red', 'blink-yellow');
            removeWarningBadge(item);
            return;
        }

        const itemText = (item.textContent || "").toLowerCase();
        const isArchived = archTags.some(function (tag) { return itemText.indexOf(tag) !== -1; });
        const isTyping = detectIsTyping(item);

        if (isTyping) {
            if (!unrepliedStartTimes.has(chatId)) {
                item.classList.remove('blink-red', 'is-red', 'blink-yellow');
                delete item.dataset.redToastShown;
                delete item.dataset.yellowToastShown;
                removeWarningBadge(item);
                return;
            }
        }

        if (hasReply || isArchived) {
            if (unrepliedStartTimes.has(chatId)) {
                unrepliedStartTimes.delete(chatId);
                saveUnrepliedTimers();
            }
            item.classList.remove('blink-red', 'is-red', 'blink-yellow');
            delete item.dataset.redToastShown;
            delete item.dataset.yellowToastShown;
            delete item.dataset.redToastSuppressed;
            delete item.dataset.yellowToastSuppressed;
            removeWarningBadge(item);
            return;
        }

        const isTransferred = itemText.includes('transferred') || itemText.includes('ditransfer');
        const isRichMessage = itemText.includes('sent a rich message') || itemText.includes('mengirim pesan');

        // Deteksi jika preview teks diawali dengan nama CS (biasanya indikasi agen sudah membalas)
        const isAgentAction = isRichMessage || (/^[a-z0-9]+\s+[a-z0-9]+\s+sent/i.test(itemText)) || itemText.includes('you:');

        if (!unrepliedStartTimes.has(chatId) && (hasUnread || (!hasReplyIcon && !isTransferred && !isAgentAction))) {
            unrepliedStartTimes.set(chatId, Date.now());
            saveUnrepliedTimers();
        }

        // --- EVALUASI TAHAPAN WAKTU (2 Menit & 3 Menit) ---
        const startTime = unrepliedStartTimes.get(chatId);
        if (!startTime) {
            item.classList.remove('blink-red', 'is-red', 'blink-yellow');
            return;
        }

        const elapsed = Date.now() - startTime;

        // 1. TAHAP FINAL: 3 MENIT (Merah Berkedip)
        if (elapsed >= BLINK_DELAY_MS) {
            item.classList.add('is-red');
            item.classList.add('blink-red');
            item.classList.remove('blink-yellow'); // Hilangkan kuning bila sudah merah
            addWarningBadge(item);

            if (!isActive && !item.dataset.redToastShown && !item.dataset.redToastSuppressed && isNotif3minEnabled()) {
                showToast(`🚨 3 MENIT: Belum Dibalas (#1)`, TOAST_ACCENT_COLOR_RED, chatId, TOAST_LIFETIME_MS, () => {
                    item.dataset.redToastSuppressed = '1';
                });
                item.dataset.redToastShown = '1';
            }
        }
        // 2. TAHAP SIAGA: 2 MENIT (Kuning Berdetak Pelan)
        else if (elapsed >= YELLOW_THRESHOLD_MS) {
            item.classList.add('is-red');
            item.classList.remove('blink-red');
            item.classList.add('blink-yellow'); // Detak pelan kuning
            removeWarningBadge(item); // Belum saatnya badge ⚠️

            if (!isActive && !item.dataset.yellowToastShown && !item.dataset.yellowToastSuppressed && isNotif2minEnabled()) {
                showToast(`⚡ 2 MENIT: Segera Balas (#1)`, TOAST_ACCENT_COLOR, chatId, TOAST_LIFETIME_MS, () => {
                    item.dataset.yellowToastSuppressed = '1';
                });
                item.dataset.yellowToastShown = '1';
            }
        } else {
            // Dibawah 2 menit (Merah Solid saja atau sesuai applySingleChatStyling)
            item.classList.add('is-red');
            item.classList.remove('blink-red', 'blink-yellow');
            removeWarningBadge(item);
            delete item.dataset.redToastShown;
            delete item.dataset.yellowToastShown;
            delete item.dataset.redToastSuppressed;
            delete item.dataset.yellowToastSuppressed;
        }
    };

    // Fungsi untuk update semua angka di notifikasi agar AKTUAL (Live)
    // DAN otomatis menutup hanya jika beneran sudah dibalas (timer dihapus)
    const updateLiveToastIndices = () => {
        const toasts = document.querySelectorAll('.my-toast[data-chat-id]');
        const allItems = Array.from(document.querySelectorAll('.chat-item'));

        toasts.forEach(toast => {
            const chatId = toast.dataset.chatId;
            const item = findItemByChatId(chatId);

            // LOGIKA AUDIT: Toast hanya boleh hilang jika timer unreplied sudah dihapus (sudah dibalas/archive)
            // atau jika chat item sudah tidak ada di sidebar
            const itemText = item ? (item.textContent || "").toLowerCase() : "";
            const isArchived = archTags.some(function (tag) { return itemText.indexOf(tag) !== -1; });
            const hasTimer = unrepliedStartTimes.has(chatId);
            const isActive = (chatId === getActiveChatId()); // Cek apakah chat sedang dibuka

            // LOGIKA: Tutup jika: Item hilang, Timer hilang, di-Archive, atau SEDANG DIBUKA (Seen)
            const shouldClose = !item || !hasTimer || isArchived || isActive;

            if (shouldClose) {
                if (!toast.classList.contains('hide')) {
                    console.log(`🧹 Menutup notifikasi (Navigasi/Selesai): ${chatId}`);

                    // Bersihkan flag Shown agar bisa muncul lagi jika nanti pindah chat lagi
                    if (item) {
                        delete item.dataset.redToastShown;
                        delete item.dataset.yellowToastShown;
                    }

                    toast.classList.add('hide');
                    setTimeout(() => toast.remove(), 200);
                }
            } else {
                // Update angka baris jika masih aktif (tetap muncul sampai dibalas)
                const liveIdxSpan = toast.querySelector('.live-idx');
                if (liveIdxSpan && item) {
                    const currentIdx = allItems.indexOf(item) + 1;
                    if (currentIdx > 0) liveIdxSpan.textContent = currentIdx;
                }
            }
        });
    };

    // === PERFORMANCE OPTIMIZATION: Visibility-aware Interval ===
    let periodicCheckerId = null;

    function runPeriodicChecker() {
        // Skip jika tab tidak terlihat
        if (document.hidden) return;

        const allItems = document.querySelectorAll('.chat-item');
        const activeIds = new Set();

        allItems.forEach(item => {
            const id = getChatIdFromItem(item);
            if (id) activeIds.add(id);
            // Kita panggil ulang styling untuk update status blink/badge
            applySingleChatStyling(item);
        });

        // Cleanup: Hapus timer dari storage hanya jika chat benar-benar hilang permanen
        // JANGAN hapus jika masih dalam masa loading (Grace Period 10 detik pertama)
        const isBooting = (Date.now() - bootTime < 10000);
        let isChanged = false;

        if (!isBooting && activeIds.size > 0) {
            unrepliedStartTimes.forEach((v, k) => {
                if (!activeIds.has(k)) {
                    unrepliedStartTimes.delete(k);
                    isChanged = true;
                }
            });
            if (isChanged) saveUnrepliedTimers();
        }

        // Update angka baris di notifikasi agar selalu aktual (100% akurat)
        updateLiveToastIndices();
    }

    // Start interval - 500ms adalah angka aman agar tidak lag
    periodicCheckerId = setInterval(runPeriodicChecker, 500);

    // Pause/resume saat tab visibility berubah
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // Tab aktif kembali - jalankan segera
            runPeriodicChecker();
        }
    });

    // tokenOrNull: 'yellow' | 'black' | null
    const applyToggleToken = (item, tokenOrNull) => {
        if (!item) return;
        if (tokenOrNull === null) { clearSavedColor(item); setYellowTimer(item, false); }
        else { saveColor(item, tokenOrNull); setYellowTimer(item, tokenOrNull === 'yellow'); }
        applySingleChatStyling(item);
    };

    // =========================
    // Navigation (Alt+↑/↓)
    // =========================
    const enablePriorityNavigation = () => {
        let lastIndex = 0;
        const getUnrepliedChats = () => {
            return Array.from(document.querySelectorAll('.chat-item')).filter(item => {
                const isReplied = item.querySelector('[data-testid="replied"]');
                const itemText = (item.textContent || "").toLowerCase();
                const isArchived = archTags.some(function (tag) { return itemText.indexOf(tag) !== -1; });
                const isBlackToggled = getSavedColor(item) === 'black';
                const isYellowToggled = getSavedColor(item) === 'yellow';
                const isTyping = detectIsTyping(item);
                return !isReplied && !isArchived && !isBlackToggled && !isYellowToggled && !isTyping;
            });
        };
        const focusChat = (chat) => {
            if (!chat) return;
            chat.scrollIntoView({ behavior: 'smooth', block: 'center' });
            chat.click();
            chat.focus();
        };
        const navigateUnreplied = (direction) => {
            const chats = getUnrepliedChats();
            if (chats.length === 0) return;
            if (direction === 'down') lastIndex = (lastIndex + 1) % chats.length;
            else if (direction === 'up') lastIndex = (lastIndex - 1 + chats.length) % chats.length;
            focusChat(chats[lastIndex]);
            console.log(`🔁 Lompat ke chat belum dibalas [${lastIndex + 1}/${chats.length}]`);
        };
        document.addEventListener('keydown', (e) => {
            if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); navigateUnreplied('down'); }
            else if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); navigateUnreplied('up'); }
        });
        console.log('✅ Navigasi semua chat belum dibalas AKTIF. Gunakan Alt + ↑ atau Alt + ↓');
    };

    // =========================
    // Layout (Sidebar width + CSS var)
    // =========================
    const applySidebarWidth = () => {
        const leftSidebar = document.querySelector('.css-1cmlcj3');
        const rightSidebar = document.querySelector('.css-1orfco2');
        if (leftSidebar) {
            leftSidebar.style.width = '350px';
            leftSidebar.style.minWidth = '350px';
            leftSidebar.style.maxWidth = '350px';
            leftSidebar.style.paddingRight = '10px';
            document.documentElement.style.setProperty('--mp-left-sidebar-w', '350px'); // dipakai bila perlu
        }
        if (rightSidebar) {
            rightSidebar.style.width = '320px';
            rightSidebar.style.minWidth = '320px';
            rightSidebar.style.maxWidth = '320px';
        }
    };

    // =======================================
    // Helpers
    // =======================================
    const hexToRgb = (hex) => {
        let h = (hex || '').replace('#', '').trim();
        if (!h) return { r: 255, g: 255, b: 255 };
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const n = parseInt(h, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };

    // =======================================
    // Styling per item (garis kiri seragam)
    // =======================================
    const applySingleChatStyling = (item) => {
        const chatId = getChatIdFromItem(item);
        if (!chatId) return;

        const hasReplyIcon = !!item.querySelector('[data-testid="replied"]');
        const hasUnread = !!item.querySelector('[data-testid="unread-messages-count"]');
        const itemText = (item.textContent || "").toLowerCase();

        const isLeft = archTags.some(function (tag) { return itemText.indexOf(tag) !== -1; });

        // --- TRANSFERRED & RICH MESSAGE LOGIC ---
        const isTransferred = itemText.includes('transferred') || itemText.includes('ditransfer');
        const isRichMessage = itemText.includes('sent a rich message') || itemText.includes('mengirim pesan');
        const isAgentAction = isRichMessage || (/^[a-z0-9]+\s+[a-z0-9]+\s+sent/i.test(itemText)) || itemText.includes('you:');

        const hasReply = !!hasReplyIcon || isAgentAction;
        const isTyping = detectIsTyping(item);
        const saved = getSavedColor(item);
        let startTime = unrepliedStartTimes.get(chatId);
        const now = Date.now();

        // Jika timer sudah sangat lama (misal > 30 menit) dan baru muncul lagi, reset saja.
        if (startTime && (now - startTime > 1800000)) {
            unrepliedStartTimes.delete(chatId);
            startTime = null;
            saveUnrepliedTimers();
        }

        const elapsed = startTime ? (now - startTime) : 0;
        let leftColor = '#ff0000'; // Merah Terang
        let isRedState = false;

        // --- CEK MANUAL OVERRIDE (Instan Hijau) ---
        const isManuallyReplied = manuallyRepliedIds.has(chatId);

        // Jika ditransfer atau mengirim rich message dan tidak ada pesan baru (unread), hapus timer jika ada
        if ((isTransferred || isAgentAction) && !hasUnread && unrepliedStartTimes.has(chatId)) {
            unrepliedStartTimes.delete(chatId);
            saveUnrepliedTimers();
            startTime = null;
        }

        // --- LOGIKA PRIORITAS WARNA (PROFESSIONAL MASTER PRIORITY) ---
        const isSlaAlert = (hasUnread || (unrepliedStartTimes.has(chatId) && !hasReply)) && (elapsed >= YELLOW_THRESHOLD_MS);

        // 1. STATUS ARCHIVE/LEFT (HIGHEST PRIORITY): Langsung kunci warna biru gelap & stop semua indikator lain.
        if (isLeft) {
            item.classList.remove('is-typing', 'blink-red', 'is-red', 'blink-yellow');
            leftColor = '#011635ff';
            isRedState = false;
        }
        // 2. TAHAP SLA ALERT: Jika sudah >= 2 menit, abaikan pelangi agar Agent fokus SLA.
        else if (isSlaAlert) {
            item.classList.remove('is-typing');
            isRedState = true;
            if (elapsed >= BLINK_DELAY_MS) {
                leftColor = '#ff0000'; // Red Blink (3m)
            } else {
                leftColor = '#ffb300'; // Kuning Amber (2m)
            }
        }
        // 3. TYPING RAINBOW: Muncul sebagai hiasan selama durasi chat masih aman (< 2 menit).
        else if (isTyping) {
            item.classList.add('is-typing');
            leftColor = 'transparent';
            isRedState = false;
        }
        // 4. SAVED TAGS: Manual override (Yellow/Black)
        else if (saved === 'yellow') {
            item.classList.remove('is-typing');
            leftColor = '#ffb300';
        } else if (saved === 'black') {
            item.classList.remove('is-typing');
            leftColor = '#021736ff';
        }
        // 5. BELUM DIBALAS (FASE AWAL < 2 MENIT): Merah Statis
        else if (hasUnread || (unrepliedStartTimes.has(chatId) && !hasReply)) {
            item.classList.remove('is-typing');
            isRedState = true;
            leftColor = '#ff0000';
        }
        // 6. SUDAH DIBALAS / DEFAULT: Hijau Emerald
        else {
            item.classList.remove('is-typing', 'blink-red', 'is-red', 'blink-yellow');
            leftColor = '#00a300';
        }

        // --- TERAPKAN CSS VARIABLES ---
        const { r, g, b } = hexToRgb(leftColor);
        item.style.setProperty('--leftbar-color', leftColor);
        item.style.setProperty('--leftbar-rgb', `${r}, ${g}, ${b}`);
        item.style.setProperty('--leftbar-w', `${LEFTBAR_WIDTH_PX}px`);
        item.classList.add('mp-lined');
        item.classList.toggle('rainbow', saved === TAG_RAINBOW);

        if (getComputedStyle(item).position === 'static') item.style.position = 'relative';

        // Reset default LiveChat styling
        item.style.backgroundColor = '';
        item.style.color = '';

        // Jalankan logic blink & badge
        setRedBlinkState(item, isRedState);
    };

    const applyAllChatStyling = () => {
        const allItems = document.querySelectorAll('.chat-item');
        allItems.forEach(item => applySingleChatStyling(item));

        // Tambahan: Notifikasi MODE SERIUS
        const unreplied = Array.from(allItems).filter(item => {
            const hasReplyIcon = item.querySelector('[data-testid="replied"]');
            const itemText = (item.textContent || "").toLowerCase();
            const isTransferred = itemText.includes('transferred');
            const isReplied = !!hasReplyIcon;
            const isArchived = archTags.some(function (tag) { return itemText.indexOf(tag) !== -1; });
            const isTyping = detectIsTyping(item);
            const isBlackToggled = getSavedColor(item) === 'black';
            const isYellowToggled = getSavedColor(item) === 'yellow';
            return !isReplied && !isArchived && !isTyping && !isBlackToggled && !isYellowToggled;
        });

        if (unreplied.length > 3 && !document.body.dataset.seriousToastShown) {
            showToast('🔥 MODE SERIUS: >3 Chat Pending!', TOAST_ACCENT_COLOR_RED, null, 10000); // Auto-hide 10 detik
            document.body.dataset.seriousToastShown = '1';

            // Reset agar bisa muncul lagi setelah 1 menit
            setTimeout(() => {
                delete document.body.dataset.seriousToastShown;
            }, 60000); // 1 menit
        }
    };



    const injectMinimalStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
/* —— Garis kiri seragam —— */
.chat-item.mp-lined::before {
content:"";
position:absolute;
left:0; top:0; bottom:0;
width: var(--leftbar-w, 5px); /* Diperlapis menjadi 5px agar lebih tegas */
background: var(--leftbar-color, currentColor);
border-radius: 0;
transform-origin:left center;
z-index: 10;
pointer-events: none;
transition: background 0.4s ease, border-color 0.4s ease, transform 0.3s ease;
/* Outline & Shadow lebih tegas agar tidak menyatu dengan BACKGROUND PUTIH */
box-shadow: 1px 0 4px rgba(0,0,0,0.4), inset -1px 0 0 rgba(0,0,0,0.1);
}

/* —— Pulse halus —— */
@keyframes leftBarPulseRed {
    0%,100% { transform: scaleX(1); }
    50% { transform: scaleX(4.6); }
}
@keyframes leftBarPulseYellow {
    0%,100% { transform: scaleX(1); opacity: 1; }
    50% { transform: scaleX(2.5); opacity: 0.7; }
}

.chat-item.blink-red::before {
    animation: leftBarPulseRed .7s ease-in-out infinite;
}
.chat-item.blink-yellow::before {
    animation: leftBarPulseYellow 2s ease-in-out infinite; /* Detak pelan (2 detik) */
}

/* —— Toast host —— */
.my-toast-host {
position: fixed;
bottom: 20px;
left: 65px;
display: flex;
flex-direction: column-reverse;
gap: 10px;
z-index: 99999;
pointer-events: none;
width: max-content;
max-width: calc(100vw - 77px);
}

/* —— Toast card —— */
.my-toast {
position: relative;
pointer-events: auto;
cursor: pointer;
display: inline-flex;
align-items: center;
gap: 10px;
padding: 12px 36px 12px 16px;
border-radius: 12px;
background: rgba(15, 15, 20, 0.98); /* Lebih gelap & solid */
color: #ffffff;
border: 2px solid var(--toast-accent, ${TOAST_ACCENT_COLOR});
box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 10px rgba(0,0,0,0.2); /* Shadow lebih kuat */
width: 280px;
max-width: 280px;
overflow: hidden;
animation: toastIn 160ms ease-out both;
}

.my-toast::before {
content: "";
position: absolute;
left: 0;
top: 0;
bottom: 0;
width: 4px;
background: var(--toast-accent, ${TOAST_ACCENT_COLOR});
border-radius: 2px 0 0 2px;
}

.my-toast .my-toast-msg {
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
font-size: 13px;
line-height: 1.25;
padding-right: 6px;
}

.my-toast .my-toast-close {
position: absolute;
right: 8px;
top: 8px;
width: 24px;
height: 24px;
border-radius: 6px;
border: 1px solid var(--toast-accent, ${TOAST_ACCENT_COLOR});
background: transparent;
color: var(--toast-accent, ${TOAST_ACCENT_COLOR});
font-size: 16px;
display: grid;
place-items: center;
}

.my-toast .my-toast-close:hover {
background: rgba(255,255,255,0.06);
}

.my-toast.hide {
animation: toastOut 140ms ease-in both;
}

@keyframes toastIn {
from { opacity: 0; transform: translateY(8px) scale(.98); }
to { opacity: 1; transform: none; }
}

@keyframes toastOut {
from { opacity: 1; transform: none; }
to { opacity: 0; transform: translateY(8px) scale(.98); }
}

@media (prefers-reduced-motion: reduce) {
.chat-item.blink-red::before,
.chat-item.blink-yellow::before {
animation: none;
}
.my-toast, .my-toast.hide {
animation: none;
}
}

/* 🌈 Mode Rainbow */
.chat-item.mp-lined.rainbow::before {
background: linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet);
background-size: 400% 100%;
animation: rainbowPulse 3s linear infinite;
}

@keyframes rainbowPulse {
0% { background-position: 0% 50%; }
100% { background-position: 400% 50%; }
}

/* 🌈 Mode Typing Rainbow (Tanpa Merah agar tidak terkecoh) */
@keyframes rainbowBar {
    0% { background: #00ff00; } /* Hijau */
    20% { background: #00ffff; } /* Cyan */
    40% { background: #0000ff; } /* Biru */
    60% { background: #ff00ff; } /* Magenta */
    80% { background: #ffff00; } /* Kuning */
    100% { background: #00ff00; }
}
.chat-item.is-typing::before {
    animation: rainbowBar 1s linear infinite !important;
    width: 6px !important;
    box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
}

/* —— Warning Badge (3 menit) —— */
.warning-badge-3min {
    position: absolute;
    right: 8px; /* Lebih ke pinggir */
    bottom: 8px;
    font-size: 20px; /* Lebih besar */
    z-index: 100;
    /* Efek Glow & Shadow Ganda agar terbaca di putih */
    filter: drop-shadow(0 0 5px rgba(255, 255, 0, 0.8)) drop-shadow(0 2px 5px rgba(0,0,0,0.6));
    animation: badgePulse 0.8s ease-in-out infinite;
    user-select: none;
    pointer-events: none;
}

@keyframes badgePulse {
    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 5px rgba(255, 255, 0, 0.8)) drop-shadow(0 2px 5px rgba(0,0,0,0.6)); }
    50% { transform: scale(1.4); filter: drop-shadow(0 0 15px rgba(255, 255, 0, 1)) drop-shadow(0 4px 8px rgba(0,0,0,0.8)); }
}
`;

        document.head.appendChild(style);
    };

    // =========================
    // Global keybinds (Alt+. / Alt+/)
    // =========================
    document.addEventListener('keydown', (e) => {
        const isRainbow = e.ctrlKey && (e.key === '.' || e.code === 'Period'); // Ctrl + .
        const isBlack = e.altKey && (e.key === '/' || e.code === 'Slash' || e.code === 'NumpadDivide'); // Alt + /
        if (!isRainbow && !isBlack) return;
        e.preventDefault();

        const item = getCurrentChatItem();
        if (!item) return;

        const current = getSavedColor(item);
        const desired = isRainbow ? TAG_RAINBOW : 'black'; // kalau rainbow toggle rainbow, kalau black toggle black
        const nextToken = (current === desired) ? null : desired;

        applyToggleToken(item, nextToken);
    });

    // =========================
    // Observer & bootstrap - OPTIMIZED
    // =========================
    // Debounce helper untuk observer
    function debounceUI(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Debounced styling function for general UI updates (PENTING AGAR TIDAK LAG)
    const debouncedStyling = debounceUI(() => {
        applySidebarWidth();
        applyAllChatStyling();
        updateLiveToastIndices();
    }, 80); // 80ms: instan di mata, tapi ringan di prosesor

    const observer = new MutationObserver((mutations) => {
        // Deteksi apakah ada perubahan DI DALAM chat-item
        const isRelevant = mutations.some(m => {
            const target = (m.type === 'attributes' || m.type === 'characterData') ? m.target : m.addedNodes[0];
            if (!target) return false;

            // Jika teks atau elemen berubah di dalam .chat-item, maka itu RELEVAN
            const node = (target.nodeType === 3) ? target.parentElement : target;
            return node && (node.closest?.('.chat-item') || (node.classList && node.classList.contains('chat-item')));
        });

        if (isRelevant) {
            debouncedStyling();
        }
    });

    const init = () => {
        // Observe seluruh body untuk cakupan maksimal (Penting untuk SPA seperti LiveChat)
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });

        applySidebarWidth();
        applyAllChatStyling();
        injectMinimalStyles(); // CSS garis kiri + toast accent
        enablePriorityNavigation();
    };

    onRouteChange(() => {
        debouncedStyling();
    });
    // =========================
    // === 🔴 Deteksi Spam Langsung Saat Pesan Baru Masuk ===
    function setupLiveSpamDetector() {
        // normalisasi teks (hapus tanda baca, ubah ke huruf kecil)
        const normalize = txt => txt.replace(/[!?.]/g, '').trim().toLowerCase();

        // tempat menyimpan teks pesan yang sudah pernah muncul
        const seenMessages = new Map();

        // fungsi untuk menandai pesan spam
        const markAsSpam = (el, count) => {
            el.style.color = '#ff0000';
            el.style.fontWeight = '900';
            el.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
            el.style.borderLeft = '6px solid #ff0000';
            el.style.boxShadow = 'inset 0 0 10px rgba(0,0,0,0.1)';
            el.setAttribute('title', `Spam terdeteksi (${count}x)`);
        };
        // fungsi untuk memproses satu pesan
        const processMessage = (el) => {
            // Ambil semua teks termasuk <span> dan <a> di dalam bubble chat
            const text = normalize(
                Array.from(el.querySelectorAll('*'))
                    .map(n => n.textContent)
                    .join(' ')
                    .trim()
            );

            if (!text) return;
            const count = (seenMessages.get(text) || 0) + 1;
            seenMessages.set(text, count);

            // Tandai spam kalau muncul 2 kali atau lebih
            if (count >= 2) markAsSpam(el, count);
        };

        // proses semua pesan yang sudah ada saat awal
        document.querySelectorAll('[data-testid="message-text"], .message__text, .message, .message-text')
            .forEach(processMessage);

        // pantau pesan baru yang masuk
        const chatContainer = document.querySelector('[data-testid="chat-messages-list"]') || document.body;
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        const msg = node.querySelector('[data-testid="message-text"], .message__text, .message, .message-text');
                        if (msg) processMessage(msg);
                    }
                });
            }
        });

        observer.observe(chatContainer, { childList: true, subtree: true });
        console.log('✅ Live spam detector aktif');
    }

    // aktifkan deteksi spam
    setupLiveSpamDetector();

    waitForElement('.chat-item', init);
})();
