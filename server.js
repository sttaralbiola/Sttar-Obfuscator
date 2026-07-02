const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const session = require('express-session');
const { execFile } = require('child_process');
const { randomUUID } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ================== MIDDLEWARE ==================
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.disable('x-powered-by');

// Render (and most hosts) sit behind a reverse proxy. This makes req.ip resolve
// the real client IP from X-Forwarded-For instead of the proxy's internal IP.
app.set('trust proxy', true);

app.use(session({
    secret: 'supersecretkey123',
    resave: false,
    saveUninitialized: true
}));

const PASSWORD = "sttaralbiola";

// ================== SUPABASE SETUP ==================
const supabaseUrl = "https://vwtzbbxzcokqiggkmowc.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3dHpiYnh6Y29rcWlnZ2ttb3djIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjIzMDQ0MiwiZXhwIjoyMDk3ODA2NDQyfQ.vtZ9uXyLXLnwCxglqnHvIqqM8oxuWOYt4Qi-ludGmGo";
const supabase = createClient(supabaseUrl, supabaseKey);
const bucketName = "obfuscated";

// ================== RECAPTCHA V2 KEYS ==================
const RECAPTCHA_SITE_KEY = "6LfdizYtAAAAAB7QZmwjr6QcrjX2pg9qPsP5FJLX";
const RECAPTCHA_SECRET = "6LfdizYtAAAAAHoRIVdd6CyjZRN9R4whRHZ5z_GX";
const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

async function verifyRecaptcha(token) {
    if (!token) return false;
    try {
        const params = new URLSearchParams();
        params.append('secret', RECAPTCHA_SECRET);
        params.append('response', token);
        const response = await fetch(RECAPTCHA_VERIFY_URL, {
            method: 'POST',
            body: params
        });
        const data = await response.json();
        return data.success === true;
    } catch (err) {
        console.error('reCAPTCHA verification error:', err);
        return false;
    }
}

// ================== RATE LIMITING & FREE API KEYS ==================
// In-memory only — resets if the server restarts. Fine for a single small app.

// IPs in this list bypass rate limiting entirely. Add your own IP(s) here.
// Note: 192.168.x.x is a private/local address — it will only match if the
// server actually sees that as req.ip (e.g. local network/VPN). On a public
// Render deployment, find your real public IP and add it here instead.
const IP_WHITELIST = ['192.168.8.36'];

const RATE_LIMIT_WINDOW_MS = 60 * 1000;   // 1 minute window
const RATE_LIMIT_MAX_ANON = 5;            // requests/min, no API key
const RATE_LIMIT_MAX_KEYED = 30;          // requests/min, with a valid free API key

const rateLimitStore = new Map(); // ip -> { count, windowStart }
const apiKeys = new Set();        // generated free API keys

function normalizeIp(ip) {
    if (!ip) return ip;
    return ip.replace(/^::ffff:/, '');
}

function getClientIp(req) {
    return normalizeIp(req.ip);
}

function isWhitelisted(ip) {
    return IP_WHITELIST.includes(ip);
}

function checkRateLimit(ip, hasValidKey) {
    const now = Date.now();
    const max = hasValidKey ? RATE_LIMIT_MAX_KEYED : RATE_LIMIT_MAX_ANON;
    const entry = rateLimitStore.get(ip);

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitStore.set(ip, { count: 1, windowStart: now });
        return { allowed: true };
    }

    if (entry.count >= max) {
        const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
        return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
    }

    entry.count += 1;
    return { allowed: true };
}

// ================== PROMETHEUS CLI & HELPER ==================
const PROMETHEUS_CLI = path.join(__dirname, 'Prometheus', 'cli.lua');
const TEMP_DIR = os.tmpdir();

const ALLOWED_PRESETS = ['Minify', 'Weak', 'Medium', 'Strong'];
const ALLOWED_LUA_VERSIONS = ['lua51', 'luau'];

function execFileAsync(cmd, args) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, (error, stdout, stderr) => {
            if (error) reject({ error, stdout, stderr });
            else resolve({ stdout, stderr });
        });
    });
}

// ================== DESIGN SYSTEM ==================
// Concept: Vercel/Linear-style monochrome SaaS console. Pure black canvas, hairline borders,
// a single white CTA, Inter type, segmented pill controls. Motion is restrained: a quick
// scale-down on press plus a soft white ring that expands and fades from the click point.

const FONT_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

const BASE_STYLE = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg: #000000;
            --panel: #0a0a0a;
            --panel-2: #0d0d0d;
            --border: #1f1f1f;
            --border-hover: #333333;
            --text: #ededed;
            --text-dim: #8a8a8a;
            --text-dimmer: #555555;
            --white: #ffffff;
            --danger: #f87171;
            --accent: #5e9eff;
        }
        html, body { background: var(--bg); }
        body {
            color: var(--text);
            font-family: 'Inter', -apple-system, sans-serif;
            min-height: 100vh;
            -webkit-font-smoothing: antialiased;
        }
        a { color: inherit; }
        .click-ring {
            position: fixed;
            pointer-events: none;
            z-index: 9999;
            width: 16px; height: 16px;
            border-radius: 50%;
            border: 1px solid rgba(255,255,255,0.5);
            transform: translate(-50%, -50%) scale(0.3);
            opacity: 0.6;
            animation: clickRing 0.45s ease-out forwards;
        }
        @keyframes clickRing {
            to { transform: translate(-50%, -50%) scale(5.5); opacity: 0; }
        }
        button, a.btn, .pill, .tab { transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease; }
        button:active, a.btn:active, .pill:active, .tab:active { transform: scale(0.97); }
        @media (prefers-reduced-motion: reduce) {
            .click-ring { display: none; }
            button:active, a.btn:active, .pill:active, .tab:active { transform: none; }
        }`;

const CLICK_SCRIPT = `
        (function () {
            document.addEventListener('click', function (e) {
                const target = e.target.closest('button, a, .pill, .tab');
                if (!target || target.disabled) return;
                const ring = document.createElement('span');
                ring.className = 'click-ring';
                ring.style.left = e.clientX + 'px';
                ring.style.top = e.clientY + 'px';
                document.body.appendChild(ring);
                ring.addEventListener('animationend', () => ring.remove());
            });
        })();`;

// ================== ROOT ROUTE ==================
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sttar</title>
    ${FONT_LINK}
    <style>
        ${BASE_STYLE}
        body { display: flex; align-items: center; justify-content: center; padding: 24px; }
        .card {
            width: 100%; max-width: 420px;
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 36px 32px;
            text-align: center;
        }
        .badge {
            display: inline-block; font-size: 11px; font-weight: 600; letter-spacing: 0.5px;
            text-transform: uppercase; color: var(--text-dim);
            border: 1px solid var(--border); border-radius: 20px; padding: 4px 12px;
            margin-bottom: 18px;
        }
        h1 { font-size: 1.5em; font-weight: 700; margin-bottom: 10px; }
        p { color: var(--text-dim); font-size: 14px; margin-bottom: 24px; line-height: 1.6; }
        a.btn {
            display: inline-block; background: var(--white); color: #000;
            padding: 10px 22px; border-radius: 8px; font-weight: 600; font-size: 13.5px;
            text-decoration: none;
        }
        a.btn:hover { background: #d9d9d9; }
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">404</span>
        <h1>This route doesn't exist</h1>
        <p>The obfuscator lives at /home.</p>
        <a class="btn" href="/home">Go to console →</a>
    </div>
    <script>${CLICK_SCRIPT}</script>
</body>
</html>`);
});

app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/raw/:id', (req, res) => {
    const supabasePublicUrl = `https://vwtzbbxzcokqiggkmowc.supabase.co/storage/v1/object/public/${bucketName}/${req.params.id}.lua`;
    res.redirect(302, supabasePublicUrl);
});

// ================== OBFUSCATION API ==================
app.post('/api/obfuscate', async (req, res) => {
    const rawCode = req.body.code;
    const recaptchaToken = req.body.recaptchaToken;

    const clientIp = getClientIp(req);
    const apiKey = req.headers['x-api-key'];
    const hasValidKey = !!(apiKey && apiKeys.has(apiKey));

    if (!isWhitelisted(clientIp)) {
        const rl = checkRateLimit(clientIp, hasValidKey);
        if (!rl.allowed) {
            res.setHeader('Retry-After', rl.retryAfterSeconds);
            return res.status(429).json({
                error: 'Too many requests. Slow down a bit.',
                retryAfterSeconds: rl.retryAfterSeconds
            });
        }
    }

    let preset = req.body.preset || 'Medium';
    if (!ALLOWED_PRESETS.includes(preset)) preset = 'Medium';

    let luaVersion = req.body.luaVersion || 'lua51';
    if (!ALLOWED_LUA_VERSIONS.includes(luaVersion)) luaVersion = 'lua51';

    if (!rawCode) return res.status(400).json({ error: 'No code provided.' });

    const isHuman = await verifyRecaptcha(recaptchaToken);
    if (!isHuman) return res.status(403).json({ error: 'reCAPTCHA verification failed.' });

    const id = randomUUID();
    const inputFile = path.join(TEMP_DIR, `temp_in_${id}.lua`);
    const outputFile = path.join(TEMP_DIR, `temp_out_${id}.lua`);

    const cleanup = () => {
        try {
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        } catch (e) { console.error("Cleanup error:", e.message); }
    };

    try {
        fs.writeFileSync(inputFile, rawCode);

        // NOTE: adjust the LuaU flag below to match whatever flag your actual
        // Prometheus cli.lua build uses to target LuaU vs Lua 5.1 output.
        const cliArgs = [PROMETHEUS_CLI, '--preset', preset];
        if (luaVersion === 'luau') cliArgs.push('--LuaU');
        cliArgs.push(inputFile, '--out', outputFile);

        await execFileAsync('luajit', cliArgs);

        if (!fs.existsSync(outputFile)) {
            cleanup();
            return res.status(500).json({ error: 'No output generated.' });
        }

        const obfuscatedCode = fs.readFileSync(outputFile, 'utf8');
        const header = `-- Obfuscated by Sttar Obfuscator https://sttar-obfuscators.onrender.com/home`;
        const finalCode = header + '\n' + obfuscatedCode;

        cleanup();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(finalCode);

    } catch (err) {
        const detail = err.stderr ? err.stderr.toString().trim() : 'Unknown error';
        cleanup();
        return res.status(500).json({ error: 'Obfuscation failed.', detail });
    }
});

// ================== FREE API KEY ==================
app.post('/api/generate-key', (req, res) => {
    const clientIp = getClientIp(req);
    if (!isWhitelisted(clientIp)) {
        const rl = checkRateLimit('keygen:' + clientIp, false);
        if (!rl.allowed) {
            res.setHeader('Retry-After', rl.retryAfterSeconds);
            return res.status(429).json({ error: 'Too many key requests. Try again later.' });
        }
    }
    const key = 'sttar_' + randomUUID().replace(/-/g, '');
    apiKeys.add(key);
    return res.json({ apiKey: key, rateLimitPerMinute: RATE_LIMIT_MAX_KEYED });
});

// ================== SHARE API ==================
app.post('/api/share', async (req, res) => {
    const obfuscatedCode = req.body.code;
    if (!obfuscatedCode) return res.status(400).json({ error: 'No code provided.' });

    const id = randomUUID();
    const fileName = `${id}.lua`;

    try {
        const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(fileName, Buffer.from(obfuscatedCode, 'utf8'), {
                contentType: 'text/plain',
                upsert: true
            });

        if (uploadError) return res.status(500).json({ error: 'Failed to upload.' });

        const loaderUrl = `https://sttar-obfuscators.onrender.com/raw/${id}`;
        const loaderScript = `loadstring(game:HttpGet("${loaderUrl}"))()`;

        return res.json({ loaderUrl, loaderScript });
    } catch (err) {
        return res.status(500).json({ error: 'Share failed.' });
    }
});

app.get('/home', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sttar — Lua Obfuscator</title>
    ${FONT_LINK}
    <script src="https://www.google.com/recaptcha/api.js" async defer></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/lua/lua.min.js"></script>
    <style>
        ${BASE_STYLE}

        /* ── layout ── */
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 0 16px 60px;
            min-height: 100vh;
        }
        .nav {
            width: 100%;
            max-width: 760px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 22px 0;
            position: relative;
            z-index: 5;
        }
        .logo { font-weight: 800; font-size: 14px; letter-spacing: -0.2px; }
        .logo span { color: var(--text-dim); font-weight: 500; }
        .menu-btn {
            font-size: 13px; color: var(--text-dim);
            border: 1px solid var(--border); padding: 7px 14px;
            border-radius: 7px; background: transparent;
            font-family: inherit; cursor: pointer; font-weight: 600;
        }
        .menu-btn:hover { color: var(--text); border-color: var(--border-hover); }

        /* ── 3D scene ── */
        .scene {
            width: 100%;
            max-width: 760px;
            perspective: 1400px;
        }
        .flipcard {
            width: 100%;
            position: relative;
            transform-style: preserve-3d;
            transition: transform 0.72s cubic-bezier(.4,0,.2,1);
            /* height is driven by the taller of front/back */
        }
        .flipcard.flipped { transform: rotateY(180deg); }

        .flipcard-front,
        .flipcard-back {
            width: 100%;
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: clamp(18px, 4vw, 28px);
        }
        .flipcard-front { position: relative; }
        .flipcard-back {
            position: absolute;
            top: 0; left: 0;
            transform: rotateY(180deg);
            min-height: 100%;
        }
        /* when flipped, back needs to be in flow so page height adjusts */
        .flipcard.flipped .flipcard-front  { visibility: hidden; }
        .flipcard.flipped .flipcard-back   { position: relative; }

        /* ── shared label style ── */
        .section-label {
            font-size: 11.5px; font-weight: 600;
            text-transform: uppercase; letter-spacing: 0.6px;
            color: var(--text-dim); margin-bottom: 10px;
            display: flex; justify-content: space-between; align-items: center;
        }
        .upload-link {
            color: var(--text-dim); font-weight: 500;
            text-transform: none; letter-spacing: 0;
            cursor: pointer; font-size: 12.5px;
        }
        .upload-link:hover { color: var(--text); }

        /* ── CodeMirror ── */
        .editor-wrap {
            border: 1px solid var(--border);
            border-radius: 10px;
            overflow: hidden;
        }
        .editor-wrap:focus-within { border-color: var(--border-hover); }
        .CodeMirror {
            height: auto;
            min-height: 200px;
            max-height: 55vh;
            font-family: 'Menlo','Consolas',monospace;
            font-size: 13px;
        }
        .cm-s-sttar.CodeMirror { background: var(--panel-2); color: var(--text); }
        .cm-s-sttar .CodeMirror-gutters { background: var(--panel-2); border-right: 1px solid var(--border); }
        .cm-s-sttar .CodeMirror-linenumber { color: var(--text-dimmer); }
        .cm-s-sttar .cm-keyword  { color: #5e9eff; font-weight: 600; }
        .cm-s-sttar .cm-string   { color: #2dd4bf; }
        .cm-s-sttar .cm-comment  { color: var(--text-dimmer); font-style: italic; }
        .cm-s-sttar .cm-number   { color: #ffb000; }
        .cm-s-sttar .cm-variable,.cm-s-sttar .cm-def { color: var(--text); }
        .cm-s-sttar .cm-operator { color: var(--text-dim); }
        .cm-s-sttar .CodeMirror-cursor { border-left: 1px solid var(--text); }
        .cm-s-sttar div.CodeMirror-selected { background: rgba(255,255,255,0.1); }
        .CodeMirror-placeholder { color: var(--text-dimmer) !important; }

        /* ── meta row ── */
        .meta {
            display: flex; justify-content: space-between;
            flex-wrap: wrap; gap: 6px;
            color: var(--text-dimmer); font-size: 11.5px; margin-top: 8px;
        }

        /* ── pill controls ── */
        .controls {
            margin-top: 22px;
            display: grid; grid-template-columns: 1fr 1fr; gap: 18px;
        }
        @media (max-width: 560px) { .controls { grid-template-columns: 1fr; } }
        .pill-group {
            display: flex; gap: 4px;
            background: var(--panel-2);
            border: 1px solid var(--border);
            border-radius: 9px; padding: 4px;
        }
        .pill {
            flex: 1; text-align: center;
            background: transparent; border: none;
            color: var(--text-dim); font-family: inherit;
            font-size: 12.5px; font-weight: 600;
            padding: 8px 6px; border-radius: 6px; cursor: pointer;
        }
        .pill.active  { background: #fff; color: #000; }
        .pill:not(.active):hover { color: var(--text); }
        .hint {
            font-size: 11.5px; color: var(--text-dimmer);
            margin-top: 7px; min-height: 16px;
        }

        /* ── action buttons ── */
        .captcha-row { display: flex; justify-content: center; margin: 24px 0 4px; }
        .actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
        button {
            font-family: 'Inter', sans-serif;
            padding: 11px 18px; border-radius: 9px;
            font-weight: 600; font-size: 13.5px;
            cursor: pointer; border: 1px solid var(--border);
            background: transparent; color: var(--text-dim);
        }
        button:hover { border-color: var(--border-hover); color: var(--text); }
        #runBtn {
            flex: 1; background: #fff; color: #000; border-color: #fff;
        }
        #runBtn:hover { background: #d9d9d9; }
        #runBtn:disabled {
            opacity: 0.35; cursor: not-allowed;
            background: var(--text-dim); border-color: var(--text-dim); color: #000;
        }

        /* ── loading ── */
        .loading {
            display: none; align-items: center;
            gap: 10px; margin-top: 20px;
            color: var(--text-dim); font-size: 13px;
        }
        .spin {
            width: 14px; height: 14px; border-radius: 50%;
            border: 2px solid var(--border);
            border-top-color: var(--text);
            animation: spin 0.7s linear infinite; flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── result ── */
        .result { display: none; margin-top: 26px; }
        .result-bar {
            display: flex; justify-content: space-between;
            align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;
        }
        .result-bar h3 { font-size: 13px; font-weight: 600; color: var(--text); }
        .actbtns { display: flex; gap: 8px; flex-wrap: wrap; }
        .actbtns button, .actbtns a.btn {
            border: 1px solid var(--border); color: var(--text-dim);
            background: transparent; padding: 7px 14px; border-radius: 7px;
            font-size: 12px; text-decoration: none; cursor: pointer;
            font-family: inherit; font-weight: 600;
        }
        .actbtns button:hover, .actbtns a.btn:hover {
            border-color: var(--border-hover); color: var(--text);
        }
        .share-actions {
            display: none; gap: 8px; flex-wrap: wrap; margin-top: 10px;
        }
        .share-actions button {
            border: 1px solid var(--accent); color: var(--accent);
            background: transparent; padding: 8px 14px; border-radius: 7px;
            font-size: 12px; cursor: pointer; font-family: inherit; font-weight: 600;
        }
        .share-actions button:hover { background: rgba(94,158,255,0.1); }
        .share-actions .share-trigger {
            border-color: var(--border); color: var(--text-dim);
        }
        .share-actions .share-trigger:hover { border-color: var(--border-hover); color: var(--text); }
        pre {
            background: var(--panel-2);
            border: 1px solid var(--border); border-radius: 10px;
            padding: 18px; font-size: 12.5px;
            overflow-x: auto; white-space: pre-wrap;
            word-break: break-word; max-height: 380px;
            color: var(--text); line-height: 1.55;
            font-family: 'Menlo','Consolas',monospace;
        }
        #errDetail { color: var(--danger); margin-top: 10px; display: none; font-size: 12.5px; }

        /* ── BACK PANEL ── */
        .back-header {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 18px;
        }
        .back-title { font-size: 13px; font-weight: 700; color: var(--text); }
        .back-btn {
            font-size: 12.5px; color: var(--text-dim);
            border: 1px solid var(--border); padding: 6px 12px;
            border-radius: 7px; background: transparent;
            cursor: pointer; font-family: inherit; font-weight: 600;
        }
        .back-btn:hover { border-color: var(--border-hover); color: var(--text); }
        /* horizontal tab pills */
        .back-tabs {
            display: flex; gap: 4px; overflow-x: auto;
            padding-bottom: 4px; margin-bottom: 18px;
            scrollbar-width: none;
        }
        .back-tabs::-webkit-scrollbar { display: none; }
        .btab {
            flex-shrink: 0; background: transparent;
            border: 1px solid var(--border); color: var(--text-dim);
            font-family: inherit; font-size: 12px; font-weight: 600;
            padding: 7px 14px; border-radius: 20px; cursor: pointer;
        }
        .btab.active { background: #fff; color: #000; border-color: #fff; }
        .btab:not(.active):hover { border-color: var(--border-hover); color: var(--text); }
        /* horizontal slider viewport */
        .back-viewport {
            overflow: hidden;
            position: relative;
        }
        .back-slider {
            display: flex;
            transition: transform 0.38s cubic-bezier(.4,0,.2,1);
            will-change: transform;
        }
        .bpanel {
            flex: 0 0 100%;
            min-width: 0;
            padding-right: 2px; /* avoid clip on right border radius */
        }
        .bpanel h3 { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
        .bpanel p  { color: var(--text-dim); font-size: 13.5px; line-height: 1.75; margin-bottom: 10px; }
        .bpanel a  { color: var(--accent); font-weight: 600; text-decoration: none; }
        .bpanel a:hover { text-decoration: underline; }

        /* key box */
        .key-box {
            background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px;
            padding: 12px; font-size: 11.5px; word-break: break-all;
            font-family: 'Menlo','Consolas',monospace; color: var(--text); margin: 10px 0;
            display: none;
        }
        .key-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        /* history items */
        .hist-item {
            border: 1px solid var(--border); border-radius: 8px;
            padding: 10px 12px; margin-bottom: 8px; cursor: pointer;
        }
        .hist-item:hover { border-color: var(--border-hover); }
        .hist-item .hi-top {
            display: flex; justify-content: space-between;
            font-weight: 600; font-size: 12px; color: var(--text); margin-bottom: 3px;
        }
        .hist-item .hi-preview { font-size: 11.5px; color: var(--text-dim); }
        .empty-hist { color: var(--text-dimmer); font-size: 12.5px; }

        /* ── toast ── */
        .toast {
            visibility: hidden;
            position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%);
            background: var(--panel); color: var(--text);
            border: 1px solid var(--border);
            padding: 10px 20px; border-radius: 9px;
            font-size: 12.5px; z-index: 999; white-space: nowrap;
        }
        .toast.show { visibility: visible; animation: fadeInOut 2s ease; }
        @keyframes fadeInOut {
            0%  { opacity: 0; bottom: 16px; }
            10% { opacity: 1; bottom: 26px; }
            90% { opacity: 1; bottom: 26px; }
            100%{ opacity: 0; bottom: 16px; }
        }

        @media (max-width: 560px) {
            .actbtns { flex-direction: column; width: 100%; }
            .actbtns button, .actbtns a.btn { text-align: center; }
            .share-actions { flex-direction: column; }
            .share-actions button { text-align: center; }
        }
    </style>
</head>
<body>
    <div class="nav">
        <div class="logo">Sttar<span> / obfuscator</span></div>
        <button class="menu-btn" id="menuBtn">Menu</button>
    </div>

    <div class="scene">
        <div class="flipcard" id="flipcard">

            <!-- ══════════ FRONT ══════════ -->
            <div class="flipcard-front">
                <div class="section-label">
                    <span>Source</span>
                    <span class="upload-link" id="uploadLink">Upload .lua file</span>
                    <input type="file" id="fileUpload" accept=".lua" style="display:none">
                </div>
                <div class="editor-wrap">
                    <textarea id="luaInput" style="display:none"></textarea>
                </div>
                <div class="meta">
                    <span id="counter">0 lines · 0 chars</span>
                    <span style="color:var(--text-dimmer)">Ctrl + Enter to run</span>
                </div>

                <div class="controls">
                    <div>
                        <div class="section-label">Preset</div>
                        <div class="pill-group" id="presetGroup">
                            <button type="button" class="pill" data-value="Minify">Minify</button>
                            <button type="button" class="pill" data-value="Weak">Weak</button>
                            <button type="button" class="pill active" data-value="Medium">Medium</button>
                            <button type="button" class="pill" data-value="Strong">Strong</button>
                        </div>
                        <div class="hint" id="presetHint">Balanced protection and output size.</div>
                    </div>
                    <div>
                        <div class="section-label">Lua version</div>
                        <div class="pill-group" id="luaVersionGroup">
                            <button type="button" class="pill active" data-value="lua51">Lua 5.1</button>
                            <button type="button" class="pill" data-value="luau">LuaU</button>
                        </div>
                        <div class="hint" id="luauHint" style="min-height:16px">
                            Lua 5.1 — standard. Supports Share link.
                        </div>
                    </div>
                </div>

                <div class="captcha-row">
                    <div class="g-recaptcha"
                         data-sitekey="${RECAPTCHA_SITE_KEY}"
                         data-callback="onCaptchaSuccess"
                         data-expired-callback="onCaptchaExpired"></div>
                </div>

                <div class="actions">
                    <button id="sampleBtn" type="button">Load sample</button>
                    <button id="clearBtn" type="button">Clear</button>
                    <button id="runBtn" type="button" disabled>Obfuscate</button>
                </div>

                <div class="loading" id="loading">
                    <div class="spin"></div>
                    <span>Obfuscating…</span>
                </div>

                <div class="result" id="resultSection">
                    <div class="result-bar">
                        <h3>Output</h3>
                        <div class="actbtns">
                            <button id="copyBtn" type="button">Copy</button>
                            <a id="downloadLink" class="btn" href="#" download="">Download .lua</a>
                        </div>
                    </div>
                    <pre id="resultCode"></pre>
                    <div id="errDetail"></div>
                    <div class="share-actions" id="shareActions">
                        <button class="share-trigger" id="shareBtn" type="button">Share</button>
                        <button id="copyLoaderBtn" type="button" style="display:none">Copy loadstring</button>
                        <button id="copyUrlBtn"    type="button" style="display:none">Copy URL</button>
                    </div>
                </div>
            </div>
            <!-- ══════════ END FRONT ══════════ -->

            <!-- ══════════ BACK ══════════ -->
            <div class="flipcard-back">
                <div class="back-header">
                    <span class="back-title">Menu</span>
                    <button class="back-btn" id="backBtn">← Back</button>
                </div>
                <div class="back-tabs" id="backTabs">
                    <button class="btab active" data-idx="0">About</button>
                    <button class="btab" data-idx="1">Usage</button>
                    <button class="btab" data-idx="2">Privacy</button>
                    <button class="btab" data-idx="3">API Key</button>
                    <button class="btab" data-idx="4">History</button>
                </div>
                <div class="back-viewport">
                    <div class="back-slider" id="backSlider">

                        <div class="bpanel">
                            <h3>About Sttar</h3>
                            <p>Sttar is a Lua obfuscation tool built for Roblox scripters. Paste a script, pick a preset, and get back a transformed output that's far harder to reverse-engineer while staying fully functional.</p>
                            <p>Runs on the Prometheus engine with extra passes on top. Supports both Lua 5.1 and LuaU.</p>
                            <p><a href="/docs">API reference 🔒</a></p>
                        </div>

                        <div class="bpanel">
                            <h3>How to use</h3>
                            <p>1. Paste or upload a .lua file into the editor.</p>
                            <p>2. Choose a preset — Minify just compresses, Weak adds basic obfuscation, Medium is the safe default, Strong is maximum but slower.</p>
                            <p>3. Pick Lua version. LuaU disables the Share link.</p>
                            <p>4. Complete the human check then hit Obfuscate, or press Ctrl + Enter.</p>
                            <p>5. Copy output, download it, or Share to get a loadstring URL (Lua 5.1 only).</p>
                        </div>

                        <div class="bpanel">
                            <h3>Privacy</h3>
                            <p>Nothing you paste is stored or logged server-side. Processing happens in memory; temp files are deleted right after each job.</p>
                            <p>Your last 5 obfuscations are saved in your own browser localStorage only for the History tab — nothing goes to the server for that.</p>
                            <p><a href="https://sttar-obfuscator.netlify.app" target="_blank">sttar-obfuscator.netlify.app</a></p>
                        </div>

                        <div class="bpanel">
                            <h3>Free API key</h3>
                            <p>Get a personal key to raise your rate limit from 5 to 30 requests/min on <code style="font-family:monospace;font-size:12px">/api/obfuscate</code>. Free, no signup needed. Key is saved in this browser.</p>
                            <div class="key-box" id="keyDisplay"></div>
                            <div class="key-actions">
                                <button id="genKeyBtn" type="button">Generate key</button>
                                <button id="copyKeyBtn" type="button" style="display:none">Copy key</button>
                            </div>
                        </div>

                        <div class="bpanel">
                            <h3>History <span style="color:var(--text-dimmer);font-weight:400;font-size:12px">(last 5, this browser)</span></h3>
                            <div id="historyList"></div>
                        </div>

                    </div><!-- /back-slider -->
                </div><!-- /back-viewport -->
            </div>
            <!-- ══════════ END BACK ══════════ -->

        </div><!-- /flipcard -->
    </div><!-- /scene -->

    <div class="toast" id="toast"></div>

    <script>
        /* ── refs ── */
        const flipcard       = document.getElementById('flipcard');
        const menuBtn        = document.getElementById('menuBtn');
        const backBtn        = document.getElementById('backBtn');
        const runBtn         = document.getElementById('runBtn');
        const clearBtn       = document.getElementById('clearBtn');
        const sampleBtn      = document.getElementById('sampleBtn');
        const loading        = document.getElementById('loading');
        const resultSection  = document.getElementById('resultSection');
        const resultCode     = document.getElementById('resultCode');
        const errDetail      = document.getElementById('errDetail');
        const copyBtn        = document.getElementById('copyBtn');
        const downloadLink   = document.getElementById('downloadLink');
        const shareActions   = document.getElementById('shareActions');
        const shareBtn       = document.getElementById('shareBtn');
        const copyLoaderBtn  = document.getElementById('copyLoaderBtn');
        const copyUrlBtn     = document.getElementById('copyUrlBtn');
        const fileUpload     = document.getElementById('fileUpload');
        const uploadLink     = document.getElementById('uploadLink');
        const counter        = document.getElementById('counter');
        const presetGroup    = document.getElementById('presetGroup');
        const presetHint     = document.getElementById('presetHint');
        const luaVersionGroup= document.getElementById('luaVersionGroup');
        const luauHint       = document.getElementById('luauHint');
        const toast          = document.getElementById('toast');
        const backTabs       = document.querySelectorAll('.btab');
        const backSlider     = document.getElementById('backSlider');
        const genKeyBtn      = document.getElementById('genKeyBtn');
        const copyKeyBtn     = document.getElementById('copyKeyBtn');
        const keyDisplay     = document.getElementById('keyDisplay');
        const historyList    = document.getElementById('historyList');

        let lastObfuscatedCode = '';
        let lastLoaderUrl      = '';
        let lastLoaderScript   = '';
        let selectedPreset     = 'Medium';
        let selectedLuaVersion = 'lua51';
        let isLuaU             = false;

        /* ── flip ── */
        menuBtn.addEventListener('click', () => {
            flipcard.classList.add('flipped');
            renderHistory();
        });
        backBtn.addEventListener('click', () => {
            flipcard.classList.remove('flipped');
        });

        /* ── back tab slider ── */
        let activeTabIdx = 0;
        function goToTab(idx) {
            activeTabIdx = idx;
            backSlider.style.transform = 'translateX(-' + (idx * 100) + '%)';
            backTabs.forEach((t, i) => t.classList.toggle('active', i === idx));
        }
        backTabs.forEach(t => {
            t.addEventListener('click', () => goToTab(parseInt(t.dataset.idx)));
        });

        /* ── CodeMirror ── */
        const cm = CodeMirror.fromTextArea(document.getElementById('luaInput'), {
            mode: 'lua',
            theme: 'sttar',
            lineNumbers: true,
            tabSize: 4,
            placeholder: '-- paste your Lua script here'
        });
        cm.on('change', () => {
            const val  = cm.getValue();
            const lines = val.length ? val.split('\\n').length : 0;
            counter.textContent = lines + ' lines · ' + val.length.toLocaleString() + ' chars';
        });

        /* ── preset pills ── */
        const PRESET_HINTS = {
            Minify:  'Removes whitespace and comments only. Smallest output.',
            Weak:    'Adds light obfuscation. Fast, small output.',
            Medium:  'Balanced protection and output size.',
            Strong:  'Maximum protection. Larger output, may be slower.'
        };
        function wireGroup(group, onSelect) {
            group.querySelectorAll('.pill').forEach(p => {
                p.addEventListener('click', () => {
                    group.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
                    p.classList.add('active');
                    onSelect(p.dataset.value);
                });
            });
        }
        wireGroup(presetGroup, val => {
            selectedPreset = val;
            presetHint.textContent = PRESET_HINTS[val] || '';
        });
        wireGroup(luaVersionGroup, val => {
            selectedLuaVersion = val;
            isLuaU = (val === 'luau');
            luauHint.textContent = isLuaU
                ? 'LuaU — no Share link available.'
                : 'Lua 5.1 — standard. Supports Share link.';
            if (isLuaU) {
                shareActions.style.display = 'none';
            } else if (lastObfuscatedCode) {
                shareActions.style.display = 'flex';
            }
        });

        /* ── upload ── */
        uploadLink.addEventListener('click', () => fileUpload.click());
        fileUpload.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            new Promise(res => {
                const r = new FileReader();
                r.onload = ev => res(ev.target.result);
                r.readAsText(file);
            }).then(text => { cm.setValue(text); showToast('File loaded.'); });
        });

        /* ── sample / clear ── */
        sampleBtn.addEventListener('click', () => {
            cm.setValue('-- sample script\\nprint("hello from sttar")\\nfor i = 1, 3 do\\n    print("pass " .. i)\\nend\\nlocal function add(a, b)\\n    return a + b\\nend\\nprint(add(5, 7))');
            showToast('Sample loaded.');
        });
        clearBtn.addEventListener('click', () => {
            cm.setValue('');
            resultSection.style.display = 'none';
            errDetail.style.display = 'none';
            shareActions.style.display = 'none';
            copyLoaderBtn.style.display = 'none';
            copyUrlBtn.style.display = 'none';
            lastObfuscatedCode = '';
        });

        /* ── captcha ── */
        window.onCaptchaSuccess  = () => { runBtn.disabled = false; };
        window.onCaptchaExpired  = () => { runBtn.disabled = true; };

        /* ── helpers ── */
        function getApiKey() {
            try { return localStorage.getItem('sttar_api_key') || ''; } catch(e) { return ''; }
        }
        function showToast(msg, duration) {
            toast.textContent = msg;
            toast.className = 'toast show';
            setTimeout(() => { toast.className = toast.className.replace('show',''); }, duration || 2200);
        }

        /* ── obfuscate ── */
        runBtn.addEventListener('click', doObfuscate);
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !runBtn.disabled) {
                e.preventDefault();
                doObfuscate();
            }
        });

        function doObfuscate() {
            const code = cm.getValue().trim();
            if (!code) { showToast('Paste some Lua code first.'); return; }
            const token = grecaptcha.getResponse();
            if (!token) { showToast('Verify the captcha first.'); return; }

            loading.style.display    = 'flex';
            resultSection.style.display = 'none';
            errDetail.style.display  = 'none';
            shareActions.style.display = 'none';
            copyLoaderBtn.style.display = 'none';
            copyUrlBtn.style.display    = 'none';
            runBtn.disabled = true;
            grecaptcha.reset();

            const headers = { 'Content-Type': 'application/json' };
            const key = getApiKey();
            if (key) headers['x-api-key'] = key;

            fetch('/api/obfuscate', {
                method: 'POST', headers,
                body: JSON.stringify({
                    code, recaptchaToken: token,
                    preset: selectedPreset,
                    luaVersion: selectedLuaVersion
                })
            })
            .then(async r => {
                if (!r.ok) { const e = await r.json(); throw e; }
                return r.text();
            })
            .then(out => {
                resultCode.textContent = out;
                lastObfuscatedCode     = out;
                resultSection.style.display = 'block';
                if (!isLuaU) shareActions.style.display = 'flex';

                const rnd = Math.random().toString(36).substr(2, 8);
                const blob = new Blob([out], { type: 'text/plain' });
                downloadLink.href     = URL.createObjectURL(blob);
                downloadLink.download = 'Sttar_' + rnd + '.lua';

                saveHistory({ time: new Date().toLocaleString(), preset: selectedPreset, luaVersion: selectedLuaVersion, input: code, output: out });
            })
            .catch(err => {
                showToast('Error: ' + (err.error || 'Obfuscation failed'));
                if (err.detail) {
                    errDetail.textContent = err.detail;
                    errDetail.style.display = 'block';
                }
            })
            .finally(() => {
                loading.style.display = 'none';
                runBtn.disabled = false;
                if (!grecaptcha.getResponse()) runBtn.disabled = true;
            });
        }

        /* ── copy ── */
        copyBtn.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(resultCode.textContent); showToast('Copied.'); }
            catch(e) { showToast('Copy failed.'); }
        });

        /* ── share flow ── */
        shareBtn.addEventListener('click', async () => {
            if (!lastObfuscatedCode) { showToast('Nothing to share.'); return; }
            shareBtn.disabled = true;
            shareBtn.textContent = 'Sharing…';
            try {
                const r = await fetch('/api/share', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: lastObfuscatedCode })
                });
                if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Share failed'); }
                const data = await r.json();
                lastLoaderUrl    = data.loaderUrl;
                lastLoaderScript = data.loaderScript;
                copyLoaderBtn.style.display = 'inline-block';
                copyUrlBtn.style.display    = 'inline-block';
                shareBtn.textContent = 'Share';
                showToast('Ready — copy loadstring or URL below.');
            } catch(err) {
                showToast('Share error: ' + err.message);
                shareBtn.textContent = 'Share';
            } finally {
                shareBtn.disabled = false;
            }
        });
        copyLoaderBtn.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(lastLoaderScript); showToast('Loadstring copied!'); }
            catch(e) { showToast('Copy failed.'); }
        });
        copyUrlBtn.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(lastLoaderUrl); showToast('URL copied!'); }
            catch(e) { showToast('Copy failed.'); }
        });

        /* ── API key ── */
        function renderKey(key) {
            keyDisplay.textContent    = key;
            keyDisplay.style.display  = 'block';
            copyKeyBtn.style.display  = 'inline-block';
            genKeyBtn.textContent     = 'Regenerate key';
        }
        (function initKey() {
            const k = getApiKey();
            if (k) renderKey(k);
        })();
        genKeyBtn.addEventListener('click', async () => {
            genKeyBtn.disabled = true;
            try {
                const r = await fetch('/api/generate-key', { method: 'POST' });
                if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Failed'); }
                const d = await r.json();
                try { localStorage.setItem('sttar_api_key', d.apiKey); } catch(e) {}
                renderKey(d.apiKey);
                showToast('API key generated.');
            } catch(err) {
                showToast('Error: ' + err.message);
            } finally {
                genKeyBtn.disabled = false;
            }
        });
        copyKeyBtn.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(getApiKey()); showToast('Key copied.'); }
            catch(e) { showToast('Copy failed.'); }
        });

        /* ── history ── */
        function getHistory() {
            try { return JSON.parse(localStorage.getItem('sttar_history') || '[]'); } catch(e) { return []; }
        }
        function saveHistory(entry) {
            const list = getHistory();
            list.unshift(entry);
            try { localStorage.setItem('sttar_history', JSON.stringify(list.slice(0, 5))); } catch(e) {}
        }
        function renderHistory() {
            const list = getHistory();
            historyList.innerHTML = '';
            if (!list.length) {
                historyList.innerHTML = '<div class="empty-hist">No obfuscations yet in this browser.</div>';
                return;
            }
            list.forEach(item => {
                const el = document.createElement('div');
                el.className = 'hist-item';
                el.innerHTML =
                    '<div class="hi-top"><span>' + item.preset + ' · ' + item.luaVersion + '</span><span>' + item.time + '</span></div>' +
                    '<div class="hi-preview">' + (item.input.slice(0, 72).replace(/</g,'&lt;')) + (item.input.length > 72 ? '…' : '') + '</div>';
                el.addEventListener('click', () => {
                    cm.setValue(item.input);
                    resultCode.textContent = item.output;
                    lastObfuscatedCode     = item.output;
                    resultSection.style.display = 'block';
                    flipcard.classList.remove('flipped');
                    showToast('Loaded from history.');
                });
                historyList.appendChild(el);
            });
        }
        renderHistory();

        /* ── click ring animation ── */
        ${CLICK_SCRIPT}
    </script>
</body>
</html>`);
});

app.get('/docs', (req, res) => {
    if (!req.session.authenticated) {
        return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sttar — API Docs</title>
    ${FONT_LINK}
    <style>
        ${BASE_STYLE}
        body { display: flex; align-items: center; justify-content: center; padding: 20px; }
        .card { width: 100%; max-width: 360px; background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 32px 28px; }
        h2 { font-size: 1.3em; font-weight: 700; margin-bottom: 6px; }
        .sub { color: var(--text-dim); font-size: 13px; margin-bottom: 22px; }
        input[type="password"] {
            width: 100%; padding: 11px 14px; border-radius: 8px;
            background: var(--panel-2); color: var(--text); font-size: 14px;
            margin-bottom: 14px; outline: none; border: 1px solid var(--border);
            font-family: inherit;
        }
        input[type="password"]:focus { border-color: var(--border-hover); }
        button {
            background: var(--white); border: 1px solid var(--white); color: #000; font-weight: 700;
            padding: 11px 22px; border-radius: 8px; font-size: 13.5px; cursor: pointer;
            width: 100%; font-family: inherit;
        }
        button:hover { background: #d9d9d9; }
    </style>
</head>
<body>
    <div class="card">
        <h2>API access</h2>
        <p class="sub">Enter the password to view documentation.</p>
        <form method="POST" action="/docs">
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Continue</button>
        </form>
    </div>
    <script>${CLICK_SCRIPT}</script>
</body>
</html>`);
    }

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sttar — API Docs</title>
    ${FONT_LINK}
    <style>
        ${BASE_STYLE}
        body { padding: 20px; }
        .container { max-width: 740px; margin: 0 auto; padding: clamp(20px, 5vw, 48px) 16px; }
        .header {
            display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;
            gap: 16px; margin-bottom: 32px; border-bottom: 1px solid var(--border); padding-bottom: 18px;
        }
        .header h1 { font-size: clamp(1.4em, 4.5vw, 1.8em); font-weight: 700; letter-spacing: -0.4px; }
        .logout {
            background: transparent; border: 1px solid var(--border); color: var(--text-dim);
            padding: 7px 16px; border-radius: 8px; text-decoration: none; font-size: 12.5px; font-weight: 600;
        }
        .logout:hover { border-color: var(--danger); color: var(--danger); }
        .card {
            background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
            padding: clamp(18px, 4vw, 26px); margin-bottom: 18px;
        }
        .card h2 { font-size: 1.05em; font-weight: 700; margin-bottom: 8px; }
        .method {
            display: inline-block; background: var(--panel-2); border: 1px solid var(--border);
            color: var(--text-dim); padding: 2px 9px; border-radius: 5px; font-size: 11px; font-weight: 700; margin-right: 8px;
        }
        .card .desc { color: var(--text-dim); font-size: 13px; margin: 8px 0 12px; }
        .code-block {
            background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px;
            padding: 16px; font-size: 12.5px; overflow-x: auto; white-space: pre-wrap;
            word-break: break-word; color: var(--text); font-family: 'Menlo', 'Consolas', monospace;
        }
        .note {
            background: var(--panel); border: 1px solid var(--border);
            padding: 14px 16px; border-radius: 10px; color: var(--text-dim); font-size: 13px;
        }
        .note b { color: var(--text); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>API reference</h1>
            <a href="/logout" class="logout">Log out</a>
        </div>
        <div class="card">
            <h2><span class="method">POST</span>/api/obfuscate</h2>
            <p class="desc">Obfuscates Lua source. Requires a reCAPTCHA v2 token. Optional preset and luaVersion fields.</p>
            <div class="code-block">{
  "code": "...",
  "recaptchaToken": "...",
  "preset": "Minify | Weak | Medium | Strong",
  "luaVersion": "lua51 | luau"
}</div>
        </div>
        <div class="card">
            <h2><span class="method">POST</span>/api/share</h2>
            <p class="desc">Uploads obfuscated output and returns a loadstring-ready link.</p>
            <div class="code-block">{ "code": "obfuscated code..." }</div>
        </div>
        <div class="note"><b>Note:</b> /raw/:id redirects to permanent Supabase storage.</div>
    </div>
    <script>${CLICK_SCRIPT}</script>
</body>
</html>`);
});

app.post('/docs', (req, res) => {
    if (req.body.password === PASSWORD) {
        req.session.authenticated = true;
        return res.redirect('/docs');
    }
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sttar — Access denied</title>
    ${FONT_LINK}
    <style>
        ${BASE_STYLE}
        body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 20px; }
        h2 { color: var(--danger); font-size: clamp(1.3em, 5vw, 1.7em); font-weight: 700; }
        p { color: var(--text-dim); margin-top: 8px; font-size: 13px; }
        a { color: var(--text); text-decoration: none; margin-top: 18px; display: inline-block; font-size: 13px; border-bottom: 1px solid var(--border); }
        a:hover { border-color: var(--text); }
    </style>
</head>
<body>
    <h2>Wrong password</h2>
    <p>That key didn't match. Try again.</p>
    <a href="/docs">Back to login</a>
    <script>${CLICK_SCRIPT}</script>
</body>
</html>`);
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/docs'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
