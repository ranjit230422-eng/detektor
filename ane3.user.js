// ==UserScript==
// @name         KHUSUS VALIDASI - Sleekshot One Message FAST
// @namespace    linetogel-sleekshot-one-message-fast
// @version      16.0
// @description  Deteksi gambar terdekat, hanya 1 pesan, preload cepat, multi gambar jadi 1 link Sleekshot
// @match        https://chat-linetogel.hokibgs.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      sleekshot.app
// @connect      socket-linetogel.hokibgs.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // CONFIG
    // ============================================================

    const ROOM_NAME = 'KHUSUS VALIDASI';

    const SLEEKSHOT_UPLOAD =
        'https://sleekshot.app/api/upload';

    const POSITION_KEY =
        'ss_one_message_fast_position_v16';

    const LINK_CACHE_KEY =
        'ss_sleekshot_link_cache_v16';

    const MAX_BLOB_CACHE = 25;

    const MAX_PREPARED_CACHE = 12;

    const MAX_LINK_CACHE = 80;


    // ============================================================
    // STATE
    // ============================================================

    let selectedMessage = null;

    let selectedImages = [];

    let selectedURLs = [];

    let selectedGroupKey = '';

    let selectedContentKey = '';

    let uploading = false;

    let prepareTimer = null;


    /*
     * Cache link Sleekshot
     */
    const uploadCache = new Map();


    /*
     * Cache Blob masing-masing gambar.
     *
     * Value bisa berupa:
     * Blob
     * Promise<Blob>
     */
    const blobCache = new Map();


    /*
     * Cache file final yang sudah siap upload.
     *
     * Untuk 1 gambar:
     * blob asli.
     *
     * Untuk 2+:
     * blob hasil gabungan.
     */
    const preparedCache = new Map();


    /*
     * ID lokal message apabila website
     * tidak mempunyai data-message-id.
     */
    const localMessageIds = new WeakMap();

    let localMessageCounter = 1;


    // ============================================================
    // LOAD PERSISTENT LINK CACHE
    // ============================================================

    function loadLinkCache() {

        try {

            const raw =
                localStorage.getItem(
                    LINK_CACHE_KEY
                );


            if (!raw) {
                return;
            }


            const data =
                JSON.parse(raw);


            if (
                !data ||
                typeof data !== 'object'
            ) {
                return;
            }


            Object.entries(data)
                .slice(-MAX_LINK_CACHE)
                .forEach(
                    ([key, url]) => {

                        if (
                            key &&
                            typeof url === 'string' &&
                            url.startsWith('http')
                        ) {

                            uploadCache.set(
                                key,
                                url
                            );

                        }

                    }
                );

        }

        catch (error) {

            console.warn(
                '[SLEEKSHOT] cache load error',
                error
            );

        }

    }


    function saveLinkCache() {

        try {

            const entries =
                [
                    ...uploadCache.entries()
                ]
                .slice(
                    -MAX_LINK_CACHE
                );


            localStorage.setItem(

                LINK_CACHE_KEY,

                JSON.stringify(
                    Object.fromEntries(
                        entries
                    )
                )

            );

        }

        catch {}

    }


    loadLinkCache();


    // ============================================================
    // CSS
    // ============================================================

    GM_addStyle(`

        #ss-bubble {

            position: fixed;

            right: 28px;
            bottom: 80px;

            z-index: 999999;

            display: none;
            align-items: center;

            width: 210px;

            padding: 9px 12px 9px 9px;

            box-sizing: border-box;

            border-radius: 22px;

            border:
                1px solid
                rgba(238,58,74,.52);

            background:

                radial-gradient(
                    circle at 15% 10%,
                    rgba(224,42,58,.20),
                    transparent 42%
                ),

                linear-gradient(
                    145deg,
                    rgba(25,13,16,.985),
                    rgba(6,6,8,.995)
                );

            box-shadow:

                0 16px 44px
                rgba(0,0,0,.65),

                0 0 27px
                rgba(225,40,55,.16),

                inset 0 1px 0
                rgba(255,255,255,.055);

            backdrop-filter: blur(20px);

            -webkit-backdrop-filter: blur(20px);

            font-family:
                Inter,
                "Segoe UI",
                Arial,
                sans-serif;

            color: #fffafb;

            user-select: none;

            touch-action: none;

            cursor: grab;

            transition:
                border-color .18s ease,
                box-shadow .18s ease,
                transform .18s ease;
        }


        #ss-bubble.visible {
            display: flex;
        }


        #ss-bubble:hover {

            border-color:
                rgba(255,78,92,.9);

            transform:
                translateY(-2px);

            box-shadow:

                0 20px 54px
                rgba(0,0,0,.72),

                0 0 36px
                rgba(235,45,60,.24);
        }


        #ss-bubble.dragging {

            cursor: grabbing;

            transform:
                scale(1.025);
        }


        #ss-bubble.uploading #ss-icon {

            animation:
                ssPulse
                1s ease-in-out
                infinite;
        }


        @keyframes ssPulse {

            50% {

                transform:
                    scale(.87);

                opacity:
                    .65;
            }

        }


        #ss-icon {

            width: 46px;
            height: 46px;

            flex: 0 0 46px;

            display: flex;

            align-items: center;
            justify-content: center;

            border-radius: 15px;

            background:

                linear-gradient(
                    145deg,
                    #ff5663,
                    #d72b39 50%,
                    #86141e
                );

            box-shadow:

                0 9px 23px
                rgba(205,30,45,.34),

                inset 0 1px 1px
                rgba(255,255,255,.18);

            font-size: 19px;
        }


        #ss-info {

            flex: 1;

            min-width: 0;

            margin-left: 10px;
        }


        #ss-title {

            display: flex;

            align-items: center;

            gap: 6px;

            color: #fffafb;

            font-size: 13px;

            font-weight: 750;
        }


        #ss-dot {

            width: 6px;
            height: 6px;

            flex: 0 0 6px;

            border-radius: 50%;

            background: #5bd5a8;

            box-shadow:
                0 0 9px
                rgba(91,213,168,.65);
        }


        #ss-status {

            margin-top: 4px;

            max-width: 123px;

            overflow: hidden;

            white-space: nowrap;

            text-overflow: ellipsis;

            color: #b89ca1;

            font-size: 9.5px;
        }


        #ss-drag {

            width: 13px;

            display: grid;

            grid-template-columns:
                repeat(2,3px);

            gap: 3px;

            opacity: .30;
        }


        #ss-drag span {

            width: 3px;
            height: 3px;

            border-radius: 50%;

            background:
                rgba(255,255,255,.70);
        }


        .ss-selected-image {

            outline:
                2px solid
                rgba(235,55,70,.74) !important;

            outline-offset:
                3px !important;

            box-shadow:

                0 0 0 4px
                rgba(220,40,55,.055),

                0 0 19px
                rgba(220,40,55,.16) !important;
        }


        #ss-overlay {

            position: fixed;

            inset: 0;

            z-index: 1000000;

            display: none;

            align-items: center;
            justify-content: center;

            padding: 10px;

            box-sizing: border-box;

            background:

                radial-gradient(
                    circle at 50% 10%,
                    rgba(175,25,38,.13),
                    transparent 42%
                ),

                rgba(0,0,0,.92);

            backdrop-filter: blur(15px);

            -webkit-backdrop-filter: blur(15px);
        }


        #ss-overlay.visible {

            display: flex;
        }


        #ss-modal {

            width:
                min(680px,95vw);

            max-height: 95vh;

            overflow-y: auto;

            padding: 14px;

            box-sizing: border-box;

            border-radius: 22px;

            border:
                1px solid
                rgba(226,55,70,.20);

            background:

                radial-gradient(
                    circle at 8% 0%,
                    rgba(190,30,43,.12),
                    transparent 32%
                ),

                linear-gradient(
                    155deg,
                    rgba(20,14,17,.995),
                    rgba(5,5,6,.998)
                );

            box-shadow:

                0 38px 100px
                rgba(0,0,0,.86),

                0 0 48px
                rgba(200,28,43,.10),

                inset 0 1px 0
                rgba(255,255,255,.04);

            color: #fff8f9;

            font-family:
                Inter,
                "Segoe UI",
                Arial,
                sans-serif;

            animation:
                ssModalIn
                .18s ease both;
        }


        @keyframes ssModalIn {

            from {

                opacity: 0;

                transform:
                    translateY(10px)
                    scale(.985);
            }

            to {

                opacity: 1;

                transform:
                    translateY(0)
                    scale(1);
            }

        }


        #ss-modal::-webkit-scrollbar {

            width: 5px;
        }


        #ss-modal::-webkit-scrollbar-thumb {

            border-radius: 20px;

            background:
                rgba(215,55,68,.22);
        }


        #ss-header {

            display: flex;

            align-items: center;

            padding:
                1px 2px 11px;
        }


        #ss-header-icon {

            width: 42px;
            height: 42px;

            flex: 0 0 42px;

            display: flex;

            align-items: center;
            justify-content: center;

            margin-right: 10px;

            border-radius: 13px;

            background:

                linear-gradient(
                    145deg,
                    #ff5663,
                    #d42a38 50%,
                    #80131c
                );

            box-shadow:
                0 8px 20px
                rgba(190,30,44,.25);

            font-size: 18px;
        }


        #ss-header-info {

            flex: 1;

            min-width: 0;
        }


        #ss-header-title {

            font-size: 16px;

            font-weight: 760;
        }


        #ss-header-sub {

            margin-top: 3px;

            color: #947d81;

            font-size: 9px;
        }


        #ss-count {

            margin-right: 8px;

            padding: 4px 8px;

            border-radius: 999px;

            border:
                1px solid
                rgba(220,55,70,.17);

            background:
                rgba(215,40,55,.10);

            color: #e99ca4;

            font-size: 8px;
        }


        #ss-esc {

            margin-right: 8px;

            color: #745f63;

            font-size: 8px;
        }


        #ss-esc span {

            margin-left: 3px;

            padding:
                3px 6px;

            border-radius: 6px;

            border:
                1px solid
                rgba(255,255,255,.07);

            color: #ab9296;
        }


        #ss-close {

            width: 35px;
            height: 35px;

            flex: 0 0 35px;

            border-radius: 11px;

            border:
                1px solid
                rgba(255,255,255,.05);

            background:
                rgba(255,255,255,.025);

            color: #a58b90;

            font-size: 21px;

            cursor: pointer;
        }


        #ss-preview-card {

            overflow: hidden;

            border-radius: 17px;

            border:
                1px solid
                rgba(220,65,78,.11);

            background: #030304;

            box-shadow:
                0 15px 48px
                rgba(0,0,0,.52);
        }


        #ss-preview-bar {

            height: 30px;

            display: flex;

            align-items: center;

            padding:
                0 11px;

            box-sizing: border-box;

            border-bottom:
                1px solid
                rgba(255,255,255,.04);
        }


        #ss-preview-title {

            color: #c59da3;

            font-size: 9px;

            font-weight: 700;
        }


        #ss-preview-info {

            margin-left: auto;

            color: #826a6e;

            font-size: 8px;
        }


        #ss-grid {

            display: grid;

            grid-template-columns:
                repeat(2,minmax(0,1fr));

            gap: 8px;

            max-height: 56vh;

            overflow-y: auto;

            padding: 9px;

            box-sizing: border-box;

            background:

                radial-gradient(
                    circle at center,
                    rgba(150,22,34,.065),
                    transparent 65%
                ),

                #030304;
        }


        #ss-grid.one {

            grid-template-columns:
                1fr;
        }


        #ss-grid.three {

            grid-template-columns:
                repeat(3,minmax(0,1fr));
        }


        .ss-image-box {

            position: relative;

            min-width: 0;

            display: flex;

            align-items: center;
            justify-content: center;

            padding: 5px;

            box-sizing: border-box;

            overflow: hidden;

            border-radius: 11px;

            border:
                1px solid
                rgba(215,55,68,.10);

            background: #080607;
        }


        .ss-image-box img {

            display: block;

            width: 100%;

            max-height: 47vh;

            object-fit: contain;

            border-radius: 8px;
        }


        .ss-image-number {

            position: absolute;

            top: 7px;
            left: 7px;

            min-width: 20px;
            height: 20px;

            display: flex;

            align-items: center;
            justify-content: center;

            padding: 0 5px;

            box-sizing: border-box;

            border-radius: 999px;

            background:
                rgba(7,7,8,.86);

            border:
                1px solid
                rgba(235,60,74,.32);

            color: #f1b4ba;

            font-size: 8px;

            font-weight: 700;
        }


        #ss-details {

            margin-top: 9px;

            padding: 10px;

            border-radius: 15px;

            border:
                1px solid
                rgba(205,60,73,.10);

            background:

                linear-gradient(
                    145deg,
                    rgba(27,18,21,.80),
                    rgba(10,9,11,.88)
                );
        }


        #ss-details-head {

            display: flex;

            align-items: center;

            margin-bottom: 6px;
        }


        #ss-link-label {

            font-size: 9.5px;

            font-weight: 750;
        }


        #ss-link-state {

            margin-left: auto;

            padding:
                3px 7px;

            border-radius: 999px;

            border:
                1px solid
                rgba(210,50,65,.14);

            background:
                rgba(205,35,50,.10);

            color: #e89ba3;

            font-size: 8px;
        }


        #ss-link-row {

            display: flex;

            gap: 6px;
        }


        #ss-link {

            height: 36px;

            min-width: 0;

            flex: 1;

            padding:
                0 11px;

            box-sizing: border-box;

            border-radius: 10px;

            border:
                1px solid
                rgba(207,65,78,.11);

            outline: none;

            background:
                rgba(4,4,5,.82);

            color: #eadde0;

            font-family:
                Consolas,
                monospace;

            font-size: 9px;
        }


        #ss-copy {

            width: 40px;

            flex: 0 0 40px;

            border: 0;

            border-radius: 10px;

            background:

                linear-gradient(
                    145deg,
                    #ed4452,
                    #ae202e
                );

            color: #fff;

            cursor: pointer;
        }


        #ss-actions {

            display: grid;

            grid-template-columns:
                1fr 1fr;

            gap: 7px;

            margin-top: 7px;
        }


        .ss-button {

            min-height: 36px;

            border-radius: 10px;

            font-family:
                "Segoe UI",
                Arial;

            font-size: 9.5px;

            font-weight: 700;

            cursor: pointer;
        }


        #ss-open {

            border:
                1px solid
                rgba(255,91,102,.24);

            background:

                linear-gradient(
                    135deg,
                    #ed4653,
                    #bf2332 48%,
                    #79111a
                );

            color: #fff;
        }


        #ss-retry {

            border:
                1px solid
                rgba(205,80,90,.10);

            background:
                rgba(30,20,23,.90);

            color: #cdb4b8;
        }


        #ss-error {

            display: none;

            margin-top: 7px;

            padding:
                7px 9px;

            border-radius: 10px;

            border:
                1px solid
                rgba(220,55,70,.12);

            background:
                rgba(100,20,30,.13);

            color: #ffb5bd;

            font-size: 9px;
        }


        #ss-toast {

            position: fixed;

            left: 50%;
            bottom: 22px;

            z-index: 1000002;

            padding:
                9px 14px;

            border-radius: 11px;

            border:
                1px solid
                rgba(210,65,78,.15);

            background:
                rgba(18,11,13,.98);

            box-shadow:
                0 15px 45px
                rgba(0,0,0,.65);

            color: #eadbdd;

            font-family:
                "Segoe UI",
                Arial;

            font-size: 9px;

            pointer-events: none;

            opacity: 0;

            transform:
                translate(-50%,8px);

            transition: .18s ease;
        }


        #ss-toast.show {

            opacity: 1;

            transform:
                translate(-50%,0);
        }


        @media (max-height:800px) {

            #ss-modal {

                max-height: 96vh;

                padding: 11px;
            }


            #ss-grid {

                max-height: 49vh;
            }


            .ss-image-box img {

                max-height: 41vh;
            }

        }


        @media (max-width:650px) {

            #ss-bubble {

                width: 188px;

                right: 15px;
                bottom: 65px;
            }


            #ss-modal {

                width: 100%;

                padding: 10px;

                border-radius: 18px;
            }


            #ss-esc {

                display: none;
            }


            #ss-grid.three {

                grid-template-columns:
                    repeat(2,minmax(0,1fr));
            }

        }

    `);


    // ============================================================
    // CREATE BUBBLE
    // ============================================================

    const bubble =
        document.createElement(
            'div'
        );


    bubble.id =
        'ss-bubble';


    bubble.innerHTML = `

        <div id="ss-icon">
            🖼
        </div>

        <div id="ss-info">

            <div id="ss-title">

                Sleekshot

                <span id="ss-dot"></span>

            </div>

            <div id="ss-status">
                Menunggu gambar
            </div>

        </div>

        <div id="ss-drag">

            <span></span>
            <span></span>

            <span></span>
            <span></span>

            <span></span>
            <span></span>

        </div>

    `;


    document.body.appendChild(
        bubble
    );


    // ============================================================
    // CREATE MODAL
    // ============================================================

    const overlay =
        document.createElement(
            'div'
        );


    overlay.id =
        'ss-overlay';


    overlay.innerHTML = `

        <div id="ss-modal">

            <div id="ss-header">

                <div id="ss-header-icon">
                    🖼
                </div>

                <div id="ss-header-info">

                    <div id="ss-header-title">
                        Sleekshot Preview
                    </div>

                    <div id="ss-header-sub">
                        ● KHUSUS VALIDASI
                    </div>

                </div>

                <div id="ss-count">
                    1 GAMBAR
                </div>

                <div id="ss-esc">

                    Tekan

                    <span>ESC</span>

                </div>

                <button
                    id="ss-close"
                    title="Tutup"
                >
                    ×
                </button>

            </div>


            <div id="ss-preview-card">

                <div id="ss-preview-bar">

                    <div id="ss-preview-title">
                        1 PESAN
                    </div>

                    <div id="ss-preview-info">
                        1 gambar
                    </div>

                </div>

                <div id="ss-grid"></div>

            </div>


            <div id="ss-details">

                <div id="ss-details-head">

                    <div id="ss-link-label">
                        1 Link Sleekshot
                    </div>

                    <div id="ss-link-state">
                        MENUNGGU
                    </div>

                </div>


                <div id="ss-link-row">

                    <input
                        id="ss-link"
                        readonly
                        placeholder="Link Sleekshot..."
                    >

                    <button
                        id="ss-copy"
                        title="Salin link"
                    >
                        📋
                    </button>

                </div>


                <div id="ss-actions">

                    <button
                        id="ss-open"
                        class="ss-button"
                    >
                        ↗ Buka Sleekshot
                    </button>

                    <button
                        id="ss-retry"
                        class="ss-button"
                    >
                        ↻ Upload Ulang
                    </button>

                </div>

                <div id="ss-error"></div>

            </div>

        </div>

    `;


    document.body.appendChild(
        overlay
    );


    // ============================================================
    // TOAST
    // ============================================================

    const toast =
        document.createElement(
            'div'
        );


    toast.id =
        'ss-toast';


    document.body.appendChild(
        toast
    );


    const bubbleStatus =
        document.querySelector(
            '#ss-status'
        );


    const grid =
        document.querySelector(
            '#ss-grid'
        );


    const countBadge =
        document.querySelector(
            '#ss-count'
        );


    const previewInfo =
        document.querySelector(
            '#ss-preview-info'
        );


    const linkInput =
        document.querySelector(
            '#ss-link'
        );


    const linkState =
        document.querySelector(
            '#ss-link-state'
        );


    const errorBox =
        document.querySelector(
            '#ss-error'
        );


    // ============================================================
    // TOAST
    // ============================================================

    let toastTimer;


    function showToast(text) {

        toast.textContent =
            text;


        toast.classList.add(
            'show'
        );


        clearTimeout(
            toastTimer
        );


        toastTimer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        'show'
                    );

                },
                1600
            );

    }


    // ============================================================
    // ROOM
    // ============================================================

    function normalizeText(text) {

        return String(
            text || ''
        )
            .replace(
                /\s+/g,
                ' '
            )
            .trim()
            .toUpperCase();

    }


    function isValidationRoom() {

        const active =
            document.querySelectorAll(`

                [aria-selected="true"],
                [aria-current="page"],
                [data-state="active"],
                .active,
                .selected

            `);


        for (
            const el
            of active
        ) {

            if (
                normalizeText(
                    el.textContent
                ).includes(
                    ROOM_NAME
                )
            ) {

                return true;

            }

        }


        const headers =
            document.querySelectorAll(`

                h1,
                h2,
                h3,
                header,

                [class*="chat-title"],
                [class*="room-title"],
                [class*="conversation-title"],
                [class*="channel-title"],
                [class*="header-title"]

            `);


        for (
            const el
            of headers
        ) {

            if (
                normalizeText(
                    el.textContent
                ) ===
                ROOM_NAME
            ) {

                return true;

            }

        }


        return false;

    }


    // ============================================================
    // URL
    // ============================================================

    function absoluteURL(url) {

        try {

            return new URL(
                url,
                location.href
            ).href;

        }

        catch {

            return url || '';

        }

    }


    function getFullImageURL(img) {

        if (!img) {

            return '';

        }


        const anchor =
            img.closest(
                'a[href]'
            );


        if (anchor) {

            const href =
                anchor.getAttribute(
                    'href'
                );


            const lower =
                String(
                    href || ''
                ).toLowerCase();


            if (
                href &&
                href !== '#' &&
                !href.startsWith(
                    'javascript:'
                ) &&
                (
                    lower.includes(
                        '/uploads/'
                    ) ||

                    lower.includes(
                        '/media/'
                    ) ||

                    /\.(jpg|jpeg|png|webp|gif)(\?|$)/i
                        .test(
                            lower
                        )
                )
            ) {

                return absoluteURL(
                    href
                );

            }

        }


        const attrs = [

            'data-full',

            'data-full-src',

            'data-original',

            'data-original-src',

            'data-src-original',

            'data-image-url',

            'data-url',

            'data-src'

        ];


        for (
            const attr
            of attrs
        ) {

            const value =
                img.getAttribute(
                    attr
                );


            if (value) {

                return absoluteURL(
                    value
                );

            }

        }


        return absoluteURL(

            img.currentSrc ||

            img.src ||

            ''

        );

    }


    // ============================================================
    // MESSAGE CONTAINER
    // ============================================================

    function getMessageContainer(element) {

        if (!element) {

            return null;

        }


        const byID =
            element.closest(`

                [data-message-id],
                [data-msg-id],
                [data-messageid]

            `);


        if (
            byID &&
            !byID.closest(
                '#ss-overlay,#ss-bubble'
            )
        ) {

            return byID;

        }


        const strong =
            element.closest(`

                [class*="message-item"],
                [class*="message_item"],

                [class*="chat-message"],
                [class*="chat_message"],

                [class*="message-row"],
                [class*="message_row"],

                [class*="msg-item"],
                [class*="msg_item"],

                [class*="msg-row"],
                [class*="msg_row"]

            `);


        if (
            strong &&
            !strong.closest(
                '#ss-overlay,#ss-bubble'
            )
        ) {

            return strong;

        }


        let node =
            element.parentElement;


        let depth =
            0;


        while (
            node &&
            node !== document.body &&
            depth < 10
        ) {

            if (
                node.id === 'ss-overlay' ||
                node.id === 'ss-bubble'
            ) {

                return null;

            }


            const signature =
                String(

                    (node.id || '') +

                    ' ' +

                    (node.className || '')

                )
                .toLowerCase();


            const messageLike =
                /(^|[\s_-])(message|msg)([\s_-]|$)/
                    .test(
                        signature
                    );


            const mediaLike =
                /(gallery|media-grid|image-grid|image-list|attachment-list)/
                    .test(
                        signature
                    );


            if (
                messageLike &&
                !mediaLike
            ) {

                return node;

            }


            node =
                node.parentElement;


            depth++;

        }


        return null;

    }


    // ============================================================
    // FILTER IMAGE
    // ============================================================

    function isSentChatImage(img) {

        if (
            !img ||
            img.closest(
                '#ss-overlay,#ss-bubble'
            )
        ) {

            return false;

        }


        const url =
            getFullImageURL(
                img
            );


        if (!url) {

            return false;

        }


        const info =
            String([

                img.id,

                img.className,

                img.alt,

                img.title,

                img.parentElement
                    ?.id,

                img.parentElement
                    ?.className

            ].join(' '))
            .toLowerCase();


        const forbidden = [

            'avatar',

            'profile',

            'user-photo',

            'userphoto',

            'user-image',

            'profile-image',

            'profile-photo',

            'member-avatar',

            'sender-avatar',

            'chat-avatar',

            'emoji',

            'logo',

            'icon',

            'badge'

        ];


        if (
            forbidden.some(
                word =>
                    info.includes(
                        word
                    )
            )
        ) {

            return false;

        }


        if (
            img.closest(`

                header,
                nav,
                aside,

                [class*="sidebar"],
                [class*="member-list"],
                [class*="user-list"],
                [class*="contact-list"],
                [class*="navigation"]

            `)
        ) {

            return false;

        }


        const rect =
            img.getBoundingClientRect();


        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {

            return false;

        }


        if (
            rect.width < 60 ||
            rect.height < 60
        ) {

            return false;

        }


        const naturalW =
            img.naturalWidth || 0;


        const naturalH =
            img.naturalHeight || 0;


        if (
            naturalW &&
            naturalH &&
            naturalW < 100 &&
            naturalH < 100
        ) {

            return false;

        }


        const lower =
            url.toLowerCase();


        const mediaURL =

            lower.includes(
                '/uploads/linetogel/media/'
            ) ||

            (
                lower.includes(
                    '/uploads/'
                ) &&
                lower.includes(
                    '/media/'
                )
            );


        return (
            mediaURL ||
            !!getMessageContainer(
                img
            )
        );

    }


    // ============================================================
    // UNIQUE
    // ============================================================

    function uniqueImages(images) {

        const used =
            new Set();


        return images.filter(
            img => {

                const url =
                    getFullImageURL(
                        img
                    );


                if (
                    !url ||
                    used.has(
                        url
                    )
                ) {

                    return false;

                }


                used.add(
                    url
                );


                return true;

            }
        );

    }


    // ============================================================
    // HIGHLIGHT
    // ============================================================

    function clearHighlight() {

        document
            .querySelectorAll(
                '.ss-selected-image'
            )
            .forEach(
                el => {

                    el.classList.remove(
                        'ss-selected-image'
                    );

                }
            );

    }


    // ============================================================
    // NEAREST IMAGE
    // ============================================================

    function findNearestImage() {

        const images =
            [
                ...document.querySelectorAll(
                    'img'
                )
            ]
            .filter(
                isSentChatImage
            );


        const visible =
            images.filter(
                img => {

                    const r =
                        img.getBoundingClientRect();


                    return (

                        r.bottom > 0 &&

                        r.top <
                        window.innerHeight &&

                        r.right > 0 &&

                        r.left <
                        window.innerWidth

                    );

                }
            );


        if (!visible.length) {

            return null;

        }


        const centerY =
            window.innerHeight /
            2;


        let best =
            null;


        let bestScore =
            -Infinity;


        for (
            const img
            of visible
        ) {

            const r =
                img.getBoundingClientRect();


            const visibleTop =
                Math.max(
                    0,
                    r.top
                );


            const visibleBottom =
                Math.min(
                    window.innerHeight,
                    r.bottom
                );


            const visibleHeight =
                Math.max(
                    0,
                    visibleBottom -
                    visibleTop
                );


            const ratio =
                Math.min(

                    1,

                    visibleHeight /

                    Math.max(
                        r.height,
                        1
                    )

                );


            const imageCenter =
                r.top +
                r.height / 2;


            const distance =
                Math.abs(
                    imageCenter -
                    centerY
                );


            const score =

                ratio *
                10000 -

                distance;


            if (
                score >
                bestScore
            ) {

                bestScore =
                    score;


                best =
                    img;

            }

        }


        return best;

    }


    // ============================================================
    // MESSAGE KEY
    // ============================================================

    function getMessageKey(
        message,
        urls
    ) {

        if (!message) {

            return (
                'single::' +
                urls.join(
                    '||'
                )
            );

        }


        const explicit =

            message.getAttribute(
                'data-message-id'
            ) ||

            message.getAttribute(
                'data-msg-id'
            ) ||

            message.getAttribute(
                'data-messageid'
            );


        if (explicit) {

            return (

                explicit +

                '::' +

                urls.join(
                    '||'
                )

            );

        }


        if (
            !localMessageIds.has(
                message
            )
        ) {

            localMessageIds.set(

                message,

                'message-' +
                localMessageCounter++

            );

        }


        return (

            localMessageIds.get(
                message
            ) +

            '::' +

            urls.join(
                '||'
            )

        );

    }


    // ============================================================
    // CONTENT KEY
    //
    // Dipakai untuk persistent cache link.
    // ============================================================

    function getContentKey(urls) {

        return urls.join(
            '||'
        );

    }


    // ============================================================
    // CACHE UTIL
    // ============================================================

    function trimMap(
        map,
        maximum
    ) {

        while (
            map.size >
            maximum
        ) {

            const first =
                map.keys()
                    .next()
                    .value;


            map.delete(
                first
            );

        }

    }


    // ============================================================
    // FAST DOWNLOAD CACHE
    // ============================================================

    function downloadImageRaw(url) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                GM_xmlhttpRequest({

                    method:
                        'GET',

                    url:
                        url,

                    responseType:
                        'blob',

                    timeout:
                        30000,


                    onload(response) {

                        if (
                            response.status >= 200 &&
                            response.status < 300
                        ) {

                            resolve(
                                response.response
                            );

                        }

                        else {

                            reject(
                                new Error(
                                    'Gagal mengambil gambar. HTTP ' +
                                    response.status
                                )
                            );

                        }

                    },


                    onerror() {

                        reject(
                            new Error(
                                'Gagal mengambil gambar'
                            )
                        );

                    },


                    ontimeout() {

                        reject(
                            new Error(
                                'Timeout mengambil gambar'
                            )
                        );

                    }

                });

            }
        );

    }


    async function downloadImageCached(url) {

        if (
            blobCache.has(
                url
            )
        ) {

            return await blobCache.get(
                url
            );

        }


        /*
         * Simpan Promise langsung,
         * supaya request URL sama
         * tidak berjalan dua kali.
         */

        const promise =
            downloadImageRaw(
                url
            )
            .then(
                blob => {

                    blobCache.set(
                        url,
                        blob
                    );


                    trimMap(
                        blobCache,
                        MAX_BLOB_CACHE
                    );


                    return blob;

                }
            )
            .catch(
                error => {

                    blobCache.delete(
                        url
                    );


                    throw error;

                }
            );


        blobCache.set(
            url,
            promise
        );


        return await promise;

    }


    // ============================================================
    // UPDATE BUBBLE TEXT
    // ============================================================

    function updateBubbleText() {

        const count =
            selectedURLs.length;


        if (!count) {

            bubbleStatus.textContent =
                'Belum ada gambar';


            return;

        }


        /*
         * Link lama sudah tersedia.
         */

        const cachedLink =

            uploadCache.get(
                selectedContentKey
            ) ||

            uploadCache.get(
                selectedGroupKey
            );


        if (cachedLink) {

            bubbleStatus.textContent =

                count > 1

                    ? `${count} gambar • Link siap ✓`

                    : '1 gambar • Link siap ✓';


            return;

        }


        /*
         * File sudah selesai dipersiapkan.
         */

        if (
            preparedCache.has(
                selectedGroupKey
            )
        ) {

            const prepared =
                preparedCache.get(
                    selectedGroupKey
                );


            if (
                prepared instanceof Blob
            ) {

                bubbleStatus.textContent =
                    count > 1

                        ? `${count} gambar • Siap cepat ✓`

                        : 'Gambar siap cepat ✓';


                return;

            }

        }


        bubbleStatus.textContent =
            count > 1

                ? `${count} gambar • 1 pesan`

                : '1 gambar terdeteksi';

    }


    // ============================================================
    // FIND ONE MESSAGE
    // ============================================================

    function findNearestMessageGroup() {

        clearHighlight();


        const nearest =
            findNearestImage();


        if (!nearest) {

            selectedMessage =
                null;


            selectedImages =
                [];


            selectedURLs =
                [];


            selectedGroupKey =
                '';


            selectedContentKey =
                '';


            updateBubbleText();


            return [];

        }


        const message =
            getMessageContainer(
                nearest
            );


        let images =
            [];


        if (message) {

            images =
                [
                    ...message.querySelectorAll(
                        'img'
                    )
                ]
                .filter(
                    isSentChatImage
                );


            if (
                !images.includes(
                    nearest
                )
            ) {

                images.unshift(
                    nearest
                );

            }


            images =
                uniqueImages(
                    images
                );

        }


        if (!images.length) {

            images =
                [
                    nearest
                ];

        }


        const previousKey =
            selectedGroupKey;


        selectedMessage =
            message;


        selectedImages =
            images;


        selectedURLs =
            images
                .map(
                    getFullImageURL
                )
                .filter(
                    Boolean
                );


        selectedGroupKey =
            getMessageKey(
                message,
                selectedURLs
            );


        selectedContentKey =
            getContentKey(
                selectedURLs
            );


        selectedImages.forEach(
            img => {

                img.classList.add(
                    'ss-selected-image'
                );

            }
        );


        updateBubbleText();


        /*
         * Hanya jadwalkan persiapan
         * jika target message berubah.
         */

        if (
            previousKey !==
            selectedGroupKey
        ) {

            scheduleFastPrepare();

        }


        return selectedImages;

    }


    // ============================================================
    // PREVIEW
    // ============================================================

    function showPreview() {

        const count =
            selectedURLs.length;


        grid.innerHTML =
            '';


        grid.classList.remove(
            'one',
            'three'
        );


        if (
            count === 1
        ) {

            grid.classList.add(
                'one'
            );

        }

        else if (
            count === 3 ||
            count >= 5
        ) {

            grid.classList.add(
                'three'
            );

        }


        countBadge.textContent =
            `${count} GAMBAR`;


        previewInfo.textContent =

            count === 1

                ? '1 gambar dalam 1 pesan'

                : `${count} gambar dalam 1 pesan`;


        selectedURLs.forEach(
            (
                url,
                index
            ) => {

                const box =
                    document.createElement(
                        'div'
                    );


                box.className =
                    'ss-image-box';


                const img =
                    document.createElement(
                        'img'
                    );


                img.src =
                    url;


                img.alt =
                    `Gambar ${index + 1}`;


                const number =
                    document.createElement(
                        'div'
                    );


                number.className =
                    'ss-image-number';


                number.textContent =
                    index + 1;


                box.appendChild(
                    img
                );


                box.appendChild(
                    number
                );


                grid.appendChild(
                    box
                );

            }
        );

    }


    // ============================================================
    // FAST IMAGE DECODE
    // ============================================================

    async function decodeBlob(blob) {

        /*
         * createImageBitmap biasanya
         * lebih cepat daripada Image().
         */

        if (
            typeof createImageBitmap ===
            'function'
        ) {

            try {

                const bitmap =
                    await createImageBitmap(
                        blob
                    );


                return {

                    source:
                        bitmap,

                    width:
                        bitmap.width,

                    height:
                        bitmap.height,

                    close() {

                        try {

                            bitmap.close();

                        }

                        catch {}

                    }

                };

            }

            catch {}

        }


        /*
         * Fallback.
         */

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const objectURL =
                    URL.createObjectURL(
                        blob
                    );


                const img =
                    new Image();


                img.onload =
                    () => {

                        resolve({

                            source:
                                img,

                            width:
                                img.naturalWidth,

                            height:
                                img.naturalHeight,

                            close() {

                                URL.revokeObjectURL(
                                    objectURL
                                );

                            }

                        });

                    };


                img.onerror =
                    () => {

                        URL.revokeObjectURL(
                            objectURL
                        );


                        reject(
                            new Error(
                                'Gambar gagal dibaca'
                            )
                        );

                    };


                img.src =
                    objectURL;

            }
        );

    }


    // ============================================================
    // PREPARE FINAL FILE
    // ============================================================

    async function prepareFinalBlob(
        urls
    ) {

        /*
         * SATU GAMBAR:
         * cukup download/cache.
         */

        if (
            urls.length === 1
        ) {

            return await downloadImageCached(
                urls[0]
            );

        }


        /*
         * MULTI:
         * download semua paralel.
         */

        const blobs =
            await Promise.all(

                urls.map(
                    downloadImageCached
                )

            );


        /*
         * Decode paralel.
         */

        const images =
            await Promise.all(

                blobs.map(
                    decodeBlob
                )

            );


        const count =
            images.length;


        let columns;


        if (
            count <= 3
        ) {

            columns =
                count;

        }

        else if (
            count === 4
        ) {

            columns =
                2;

        }

        else {

            columns =
                3;

        }


        const rows =
            Math.ceil(
                count /
                columns
            );


        /*
         * Sedikit lebih kecil dari versi lama
         * supaya file hasil jauh lebih ringan
         * dan upload lebih cepat.
         */

        const TILE_W =
            620;


        const MAX_TILE_H =
            860;


        const GAP =
            12;


        const PADDING =
            14;


        const proposedHeights =
            images.map(
                item => {

                    return Math.min(

                        MAX_TILE_H,

                        item.height *

                        (
                            TILE_W /

                            Math.max(
                                item.width,
                                1
                            )
                        )

                    );

                }
            );


        const TILE_H =
            Math.max(

                380,

                Math.min(

                    MAX_TILE_H,

                    Math.max(
                        ...proposedHeights
                    )

                )

            );


        const canvas =
            document.createElement(
                'canvas'
            );


        canvas.width =

            PADDING * 2 +

            columns *
            TILE_W +

            (
                columns - 1
            ) *
            GAP;


        canvas.height =

            PADDING * 2 +

            rows *
            TILE_H +

            (
                rows - 1
            ) *
            GAP;


        const ctx =
            canvas.getContext(
                '2d',
                {
                    alpha: false
                }
            );


        ctx.fillStyle =
            '#070708';


        ctx.fillRect(

            0,
            0,

            canvas.width,
            canvas.height

        );


        images.forEach(
            (
                item,
                index
            ) => {

                const col =
                    index %
                    columns;


                const row =
                    Math.floor(
                        index /
                        columns
                    );


                const x =

                    PADDING +

                    col *
                    (
                        TILE_W +
                        GAP
                    );


                const y =

                    PADDING +

                    row *
                    (
                        TILE_H +
                        GAP
                    );


                ctx.fillStyle =
                    '#101011';


                ctx.fillRect(

                    x,
                    y,

                    TILE_W,
                    TILE_H

                );


                const scale =
                    Math.min(

                        TILE_W /
                        item.width,

                        TILE_H /
                        item.height

                    );


                const drawW =
                    item.width *
                    scale;


                const drawH =
                    item.height *
                    scale;


                const drawX =

                    x +

                    (
                        TILE_W -
                        drawW
                    ) /
                    2;


                const drawY =

                    y +

                    (
                        TILE_H -
                        drawH
                    ) /
                    2;


                ctx.drawImage(

                    item.source,

                    drawX,
                    drawY,

                    drawW,
                    drawH

                );

            }
        );


        images.forEach(
            item => {

                item.close();

            }
        );


        return await new Promise(
            (
                resolve,
                reject
            ) => {

                canvas.toBlob(
                    blob => {

                        if (blob) {

                            resolve(
                                blob
                            );

                        }

                        else {

                            reject(
                                new Error(
                                    'Gagal menyusun gambar'
                                )
                            );

                        }

                    },

                    'image/png'

                );

            }
        );

    }


    // ============================================================
    // PREPARED CACHE
    // ============================================================

    async function getPreparedBlob(
        groupKey,
        urls
    ) {

        if (
            preparedCache.has(
                groupKey
            )
        ) {

            return await preparedCache.get(
                groupKey
            );

        }


        const promise =
            prepareFinalBlob(
                urls
            )
            .then(
                blob => {

                    preparedCache.set(
                        groupKey,
                        blob
                    );


                    trimMap(
                        preparedCache,
                        MAX_PREPARED_CACHE
                    );


                    if (
                        selectedGroupKey ===
                        groupKey
                    ) {

                        updateBubbleText();

                    }


                    return blob;

                }
            )
            .catch(
                error => {

                    preparedCache.delete(
                        groupKey
                    );


                    throw error;

                }
            );


        preparedCache.set(
            groupKey,
            promise
        );


        trimMap(
            preparedCache,
            MAX_PREPARED_CACHE
        );


        return await promise;

    }


    // ============================================================
    // BACKGROUND PREPARE
    //
    // TIDAK UPLOAD.
    // HANYA SIAPKAN FILE DI MEMORY.
    // ============================================================

    function scheduleFastPrepare() {

        clearTimeout(
            prepareTimer
        );


        if (
            !selectedURLs.length ||
            !selectedGroupKey
        ) {

            return;

        }


        /*
         * Kalau link sudah ada,
         * tidak perlu menyiapkan lagi.
         */

        if (
            uploadCache.has(
                selectedContentKey
            ) ||
            uploadCache.has(
                selectedGroupKey
            )
        ) {

            return;

        }


        const groupKey =
            selectedGroupKey;


        const urls =
            [
                ...selectedURLs
            ];


        /*
         * Tunggu scroll berhenti sedikit.
         *
         * Setelah 180ms:
         * download + susun di memory.
         *
         * BELUM upload.
         */

        prepareTimer =
            setTimeout(
                () => {

                    getPreparedBlob(
                        groupKey,
                        urls
                    )
                    .catch(
                        error => {

                            console.debug(
                                '[SLEEKSHOT PRELOAD]',
                                error
                            );

                        }
                    );

                },
                180
            );

    }


    // ============================================================
    // UPLOAD SLEEKSHOT
    // ============================================================

    function uploadToSleekshot(
        blob
    ) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const form =
                    new FormData();


                form.append(

                    'image',

                    blob,

                    'screenshot.png'

                );


                GM_xmlhttpRequest({

                    method:
                        'POST',

                    url:
                        SLEEKSHOT_UPLOAD,

                    data:
                        form,

                    timeout:
                        60000,


                    headers: {

                        Accept:
                            'application/json'

                    },


                    onload(response) {

                        if (
                            response.status < 200 ||
                            response.status >= 300
                        ) {

                            reject(
                                new Error(
                                    'Upload Sleekshot gagal. HTTP ' +
                                    response.status
                                )
                            );


                            return;

                        }


                        let data;


                        try {

                            data =
                                JSON.parse(
                                    response.responseText
                                );

                        }

                        catch {

                            const raw =
                                String(
                                    response.responseText ||
                                    ''
                                )
                                .trim();


                            if (
                                raw.startsWith(
                                    'https://'
                                )
                            ) {

                                resolve(
                                    raw
                                );


                                return;

                            }


                            reject(
                                new Error(
                                    'Response Sleekshot tidak dikenali'
                                )
                            );


                            return;

                        }


                        let url =

                            data.viewUrl ||

                            data.viewURL ||

                            data.view_url ||

                            data.url ||

                            data.link ||

                            data.shareUrl ||

                            data.shareURL ||

                            data.share_url ||

                            data.result?.viewUrl ||

                            data.result?.url ||

                            data.result?.link ||

                            data.data?.viewUrl ||

                            data.data?.viewURL ||

                            data.data?.view_url ||

                            data.data?.url ||

                            data.data?.link ||

                            data.data?.shareUrl;


                        if (
                            !url &&
                            (
                                data.id ||
                                data.data?.id
                            )
                        ) {

                            const id =

                                data.id ||

                                data.data.id;


                            url =

                                'https://sleekshot.app/v/' +

                                id;

                        }


                        if (!url) {

                            reject(
                                new Error(
                                    'Link Sleekshot tidak ditemukan'
                                )
                            );


                            return;

                        }


                        resolve(
                            url
                        );

                    },


                    onerror() {

                        reject(
                            new Error(
                                'Tidak dapat terhubung ke Sleekshot'
                            )
                        );

                    },


                    ontimeout() {

                        reject(
                            new Error(
                                'Upload Sleekshot timeout'
                            )
                        );

                    }

                });

            }
        );

    }


    // ============================================================
    // ERROR
    // ============================================================

    function showError(text) {

        errorBox.textContent =
            text;


        errorBox.style.display =
            'block';

    }


    function hideError() {

        errorBox.textContent =
            '';


        errorBox.style.display =
            'none';

    }


    // ============================================================
    // PROCESS MESSAGE
    // ============================================================

    async function processSelectedMessage(
        force = false
    ) {

        if (
            !selectedURLs.length ||
            !selectedGroupKey
        ) {

            return;

        }


        /*
         * Kunci data message saat klik.
         */

        const urls =
            [
                ...selectedURLs
            ];


        const groupKey =
            selectedGroupKey;


        const contentKey =
            selectedContentKey;


        // ========================================================
        // LINK CACHE
        // ========================================================

        if (!force) {

            const cached =

                uploadCache.get(
                    contentKey
                ) ||

                uploadCache.get(
                    groupKey
                );


            if (cached) {

                linkInput.value =
                    cached;


                linkState.textContent =
                    'SIAP ✓';


                updateBubbleText();


                return;

            }

        }


        if (uploading) {

            return;

        }


        uploading =
            true;


        bubble.classList.add(
            'uploading'
        );


        hideError();


        linkInput.value =
            '';


        try {

            // ====================================================
            // FILE SUDAH DIPREPARE SAAT SCROLL
            // ====================================================

            linkState.textContent =
                'MENYIAPKAN';


            bubbleStatus.textContent =
                'Menyiapkan cepat...';


            /*
             * Kalau preload selesai,
             * ini langsung return Blob.
             *
             * Kalau masih berjalan,
             * hanya menunggu sisa proses.
             */

            const finalBlob =
                await getPreparedBlob(
                    groupKey,
                    urls
                );


            // ====================================================
            // UPLOAD
            // ====================================================

            linkState.textContent =
                'UPLOAD';


            bubbleStatus.textContent =
                'Upload Sleekshot...';


            const sleekshotURL =
                await uploadToSleekshot(
                    finalBlob
                );


            // ====================================================
            // CACHE LINK
            // ====================================================

            uploadCache.set(
                groupKey,
                sleekshotURL
            );


            uploadCache.set(
                contentKey,
                sleekshotURL
            );


            trimMap(
                uploadCache,
                MAX_LINK_CACHE
            );


            saveLinkCache();


            linkInput.value =
                sleekshotURL;


            linkState.textContent =
                'SIAP ✓';


            updateBubbleText();


            showToast(
                'Link Sleekshot siap ✓'
            );

        }

        catch (error) {

            console.error(
                '[SLEEKSHOT]',
                error
            );


            linkState.textContent =
                'GAGAL';


            bubbleStatus.textContent =
                'Upload gagal';


            showError(
                error.message
            );

        }

        finally {

            uploading =
                false;


            bubble.classList.remove(
                'uploading'
            );

        }

    }


    // ============================================================
    // OPEN BUBBLE
    // ============================================================

    async function openBubble() {

        if (
            !isValidationRoom()
        ) {

            return;

        }


        /*
         * Cari SATU message berdasarkan
         * gambar terdekat dengan scroll.
         */

        const group =
            findNearestMessageGroup();


        if (!group.length) {

            showToast(
                'Dekatkan layar ke gambar'
            );


            return;

        }


        showPreview();


        overlay.classList.add(
            'visible'
        );


        hideError();


        const cached =

            uploadCache.get(
                selectedContentKey
            ) ||

            uploadCache.get(
                selectedGroupKey
            );


        if (cached) {

            linkInput.value =
                cached;


            linkState.textContent =
                'SIAP ✓';


            return;

        }


        linkInput.value =
            '';


        linkState.textContent =
            'MEMPROSES';


        /*
         * Upload hanya mulai
         * ketika bubble diklik.
         */

        await processSelectedMessage();

    }


    // ============================================================
    // CLOSE
    // ============================================================

    function closeModal() {

        overlay.classList.remove(
            'visible'
        );

    }


    document
        .querySelector(
            '#ss-close'
        )
        .addEventListener(
            'click',
            closeModal
        );


    overlay.addEventListener(
        'click',
        event => {

            if (
                event.target ===
                overlay
            ) {

                closeModal();

            }

        }
    );


    // ============================================================
    // ESC
    // ============================================================

    document.addEventListener(
        'keydown',
        event => {

            if (
                (
                    event.key ===
                    'Escape' ||

                    event.key ===
                    'Esc'
                ) &&
                overlay.classList.contains(
                    'visible'
                )
            ) {

                event.preventDefault();

                event.stopPropagation();


                closeModal();

            }

        },
        true
    );


    // ============================================================
    // COPY
    // ============================================================

    document
        .querySelector(
            '#ss-copy'
        )
        .addEventListener(
            'click',
            function () {

                if (
                    !linkInput.value
                ) {

                    showToast(
                        'Link belum tersedia'
                    );


                    return;

                }


                GM_setClipboard(
                    linkInput.value
                );


                const old =
                    this.textContent;


                this.textContent =
                    '✓';


                showToast(
                    'Link berhasil disalin'
                );


                setTimeout(
                    () => {

                        this.textContent =
                            old;

                    },
                    800
                );

            }
        );


    // ============================================================
    // OPEN LINK
    // ============================================================

    document
        .querySelector(
            '#ss-open'
        )
        .addEventListener(
            'click',
            function () {

                if (
                    !linkInput.value
                ) {

                    showToast(
                        'Link belum tersedia'
                    );


                    return;

                }


                window.open(

                    linkInput.value,

                    '_blank',

                    'noopener,noreferrer'

                );

            }
        );


    // ============================================================
    // RETRY
    // ============================================================

    document
        .querySelector(
            '#ss-retry'
        )
        .addEventListener(
            'click',
            async function () {

                if (
                    uploading ||
                    !selectedGroupKey
                ) {

                    return;

                }


                /*
                 * Hapus link saja.
                 *
                 * Blob hasil prepare TETAP disimpan
                 * supaya retry upload jauh lebih cepat.
                 */

                uploadCache.delete(
                    selectedGroupKey
                );


                uploadCache.delete(
                    selectedContentKey
                );


                saveLinkCache();


                linkInput.value =
                    '';


                linkState.textContent =
                    'MENGULANG';


                await processSelectedMessage(
                    true
                );

            }
        );


    // ============================================================
    // DRAG
    // ============================================================

    let dragging = false;

    let moved = false;

    let startX = 0;

    let startY = 0;

    let startLeft = 0;

    let startTop = 0;


    bubble.addEventListener(
        'pointerdown',
        event => {

            if (
                event.button !== 0
            ) {

                return;

            }


            dragging = true;

            moved = false;


            const rect =
                bubble.getBoundingClientRect();


            startX =
                event.clientX;


            startY =
                event.clientY;


            startLeft =
                rect.left;


            startTop =
                rect.top;


            bubble.style.right =
                'auto';


            bubble.style.bottom =
                'auto';


            bubble.style.left =
                `${rect.left}px`;


            bubble.style.top =
                `${rect.top}px`;


            bubble.classList.add(
                'dragging'
            );


            try {

                bubble.setPointerCapture(
                    event.pointerId
                );

            }

            catch {}

        }
    );


    bubble.addEventListener(
        'pointermove',
        event => {

            if (!dragging) {

                return;

            }


            const dx =
                event.clientX -
                startX;


            const dy =
                event.clientY -
                startY;


            if (
                Math.abs(dx) > 5 ||
                Math.abs(dy) > 5
            ) {

                moved = true;

            }


            if (!moved) {

                return;

            }


            const margin =
                8;


            let left =
                startLeft +
                dx;


            let top =
                startTop +
                dy;


            left =
                Math.max(

                    margin,

                    Math.min(

                        left,

                        window.innerWidth -
                        bubble.offsetWidth -
                        margin

                    )

                );


            top =
                Math.max(

                    margin,

                    Math.min(

                        top,

                        window.innerHeight -
                        bubble.offsetHeight -
                        margin

                    )

                );


            bubble.style.left =
                `${left}px`;


            bubble.style.top =
                `${top}px`;

        }
    );


    bubble.addEventListener(
        'pointerup',
        async event => {

            if (!dragging) {

                return;

            }


            dragging = false;


            bubble.classList.remove(
                'dragging'
            );


            try {

                bubble.releasePointerCapture(
                    event.pointerId
                );

            }

            catch {}


            if (moved) {

                saveBubblePosition();


                return;

            }


            await openBubble();

        }
    );


    // ============================================================
    // POSITION
    // ============================================================

    function saveBubblePosition() {

        const rect =
            bubble.getBoundingClientRect();


        try {

            localStorage.setItem(

                POSITION_KEY,

                JSON.stringify({

                    left:
                        rect.left,

                    top:
                        rect.top

                })

            );

        }

        catch {}

    }


    function restoreBubblePosition() {

        try {

            const raw =
                localStorage.getItem(
                    POSITION_KEY
                );


            if (!raw) {

                return;

            }


            const pos =
                JSON.parse(
                    raw
                );


            if (
                typeof pos.left !== 'number' ||
                typeof pos.top !== 'number'
            ) {

                return;

            }


            bubble.style.right =
                'auto';


            bubble.style.bottom =
                'auto';


            bubble.style.left =
                `${pos.left}px`;


            bubble.style.top =
                `${pos.top}px`;

        }

        catch {}

    }


    function clampBubblePosition() {

        if (!bubble.style.left) {

            return;

        }


        const r =
            bubble.getBoundingClientRect();


        const margin =
            8;


        const left =
            Math.max(

                margin,

                Math.min(

                    r.left,

                    window.innerWidth -
                    r.width -
                    margin

                )

            );


        const top =
            Math.max(

                margin,

                Math.min(

                    r.top,

                    window.innerHeight -
                    r.height -
                    margin

                )

            );


        bubble.style.left =
            `${left}px`;


        bubble.style.top =
            `${top}px`;


        saveBubblePosition();

    }


    window.addEventListener(
        'resize',
        clampBubblePosition
    );


    // ============================================================
    // SCROLL
    // ============================================================

    let scrollTimer;


    document.addEventListener(
        'scroll',
        () => {

            if (
                !isValidationRoom()
            ) {

                return;

            }


            /*
             * Popup terbuka:
             * target message dikunci.
             */

            if (
                overlay.classList.contains(
                    'visible'
                )
            ) {

                return;

            }


            clearTimeout(
                scrollTimer
            );


            scrollTimer =
                setTimeout(
                    findNearestMessageGroup,
                    55
                );

        },
        true
    );


    // ============================================================
    // UPDATE ROOM
    // ============================================================

    function updateRoom() {

        if (
            isValidationRoom()
        ) {

            bubble.classList.add(
                'visible'
            );


            if (
                !overlay.classList.contains(
                    'visible'
                )
            ) {

                findNearestMessageGroup();

            }

        }

        else {

            bubble.classList.remove(
                'visible'
            );


            closeModal();


            clearHighlight();


            selectedMessage =
                null;


            selectedImages =
                [];


            selectedURLs =
                [];


            selectedGroupKey =
                '';


            selectedContentKey =
                '';


            clearTimeout(
                prepareTimer
            );

        }

    }


    // ============================================================
    // OBSERVER
    // ============================================================

    let observerTimer;


    const observer =
        new MutationObserver(
            () => {

                clearTimeout(
                    observerTimer
                );


                observerTimer =
                    setTimeout(
                        updateRoom,
                        180
                    );

            }
        );


    observer.observe(

        document.documentElement,

        {

            childList:
                true,

            subtree:
                true

        }

    );


    // ============================================================
    // START
    // ============================================================

    restoreBubblePosition();


    setInterval(
        updateRoom,
        850
    );


    setTimeout(
        updateRoom,
        600
    );

})();
