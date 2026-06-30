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
    <style>
        ${BASE_STYLE}
        body { display: flex; flex-direction: column; align-items: center; padding: 0 16px 60px; }
        .nav {
            width: 100%; max-width: 760px;
            display: flex; justify-content: space-between; align-items: center;
            padding: 22px 0;
        }
        .logo { font-weight: 800; font-size: 14px; letter-spacing: -0.2px; }
        .logo span { color: var(--text-dim); font-weight: 500; }
        .nav a {
            font-size: 13px; color: var(--text-dim); text-decoration: none;
            border: 1px solid var(--border); padding: 7px 14px; border-radius: 7px;
        }
        .nav a:hover { color: var(--text); border-color: var(--border-hover); }
        .hero { width: 100%; max-width: 760px; margin: 18px 0 28px; }
        .hero h1 { font-size: clamp(1.6em, 4.5vw, 2.1em); font-weight: 700; letter-spacing: -0.5px; margin-bottom: 8px; }
        .hero p { color: var(--text-dim); font-size: 14.5px; }
        .panel {
            width: 100%; max-width: 760px;
            background: var(--panel);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: clamp(18px, 4vw, 28px);
        }
        .section-label {
            font-size: 11.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px;
            color: var(--text-dim); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;
        }
        .upload-link { color: var(--text-dim); font-weight: 500; text-transform: none; letter-spacing: 0; cursor: pointer; font-size: 12.5px; }
        .upload-link:hover { color: var(--text); }
        textarea {
            width: 100%;
            height: clamp(190px, 42vh, 260px);
            background: var(--panel-2);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 16px;
            color: var(--text);
            font-family: 'Menlo', 'Consolas', monospace;
            font-size: 13px;
            resize: vertical;
        }
        textarea::placeholder { color: var(--text-dimmer); }
        textarea:focus { outline: none; border-color: var(--border-hover); }
        .meta { display: flex; justify-content: space-between; color: var(--text-dimmer); font-size: 11.5px; margin-top: 8px; }

        .controls { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        @media (max-width: 560px) { .controls { grid-template-columns: 1fr; } }
        .pill-group {
            display: flex; gap: 4px; background: var(--panel-2);
            border: 1px solid var(--border); border-radius: 9px; padding: 4px;
        }
        .pill {
            flex: 1; text-align: center;
            background: transparent; border: none; color: var(--text-dim);
            font-family: inherit; font-size: 12.5px; font-weight: 600;
            padding: 8px 6px; border-radius: 6px; cursor: pointer;
        }
        .pill.active { background: var(--white); color: #000; }
        .pill:not(.active):hover { color: var(--text); }
        .hint { font-size: 11.5px; color: var(--text-dimmer); margin-top: 7px; }

        .captcha-row { display: flex; justify-content: center; margin: 24px 0 4px; }
        .actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
        button {
            font-family: 'Inter', sans-serif;
            padding: 11px 18px;
            border-radius: 9px;
            font-weight: 600;
            font-size: 13.5px;
            cursor: pointer;
            border: 1px solid var(--border);
            background: transparent;
            color: var(--text-dim);
        }
        button:hover { border-color: var(--border-hover); color: var(--text); }
        #runBtn {
            flex: 1;
            background: var(--white);
            color: #000;
            border-color: var(--white);
        }
        #runBtn:hover { background: #d9d9d9; }
        #runBtn:disabled { opacity: 0.35; cursor: not-allowed; background: var(--text-dim); border-color: var(--text-dim); }
        #shareBtn { border-color: var(--accent); color: var(--accent); display: none; }
        #shareBtn:hover { background: rgba(94,158,255,0.1); }

        .loading { display: none; align-items: center; gap: 10px; margin-top: 20px; color: var(--text-dim); font-size: 13px; }
        .spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--text); animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .result { display: none; margin-top: 26px; }
        .result-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
        .result-bar h3 { font-size: 13px; font-weight: 600; color: var(--text); }
        .actbtns { display: flex; gap: 8px; flex-wrap: wrap; }
        .actbtns button, .actbtns a.btn {
            border: 1px solid var(--border); color: var(--text-dim);
            background: transparent; padding: 7px 14px; border-radius: 7px;
            font-size: 12px; text-decoration: none; cursor: pointer; font-family: inherit; font-weight: 600;
        }
        .actbtns button:hover, .actbtns a.btn:hover { border-color: var(--border-hover); color: var(--text); }
        pre {
            background: var(--panel-2);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 18px;
            font-size: 12.5px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 380px;
            color: var(--text);
            line-height: 1.55;
            font-family: 'Menlo', 'Consolas', monospace;
        }
        #errDetail { color: var(--danger); margin-top: 10px; display: none; font-size: 12.5px; }
        .toast {
            visibility: hidden;
            position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%);
            background: var(--panel); color: var(--text); border: 1px solid var(--border);
            padding: 10px 20px; border-radius: 9px; font-size: 12.5px;
            z-index: 999; white-space: nowrap;
        }
        .toast.show { visibility: visible; animation: fadeInOut 2s ease; }
        @keyframes fadeInOut {
            0% { opacity: 0; bottom: 16px; } 10% { opacity: 1; bottom: 26px; }
            90% { opacity: 1; bottom: 26px; } 100% { opacity: 0; bottom: 16px; }
        }
        @media (max-width: 560px) {
            .actbtns { flex-direction: column; width: 100%; }
            .actbtns button, .actbtns a.btn { text-align: center; }
        }
    </style>
</head>
<body>
    <div class="nav">
        <div class="logo">Sttar<span> / obfuscator</span></div>
        <a href="/dashboard">Dashboard</a>
    </div>
    <div class="hero">
        <h1>Obfuscate your Lua scripts</h1>
        <p>Paste code, pick a preset, verify you're human, and run.</p>
    </div>
    <div class="panel">
        <div class="section-label">
            <span>Source</span>
            <span class="upload-link" id="uploadLink">Upload .lua file</span>
            <input type="file" id="fileUpload" accept=".lua" style="display:none">
        </div>
        <textarea id="luaInput" placeholder="-- paste your Lua script here"></textarea>
        <div class="meta"><span id="counter">0 lines · 0 chars</span></div>

        <div class="controls">
            <div>
                <div class="section-label">Obfuscation preset</div>
                <div class="pill-group" id="presetGroup">
                    <button type="button" class="pill" data-value="Minify">Minify</button>
                    <button type="button" class="pill" data-value="Weak">Weak</button>
                    <button type="button" class="pill active" data-value="Medium">Medium</button>
                    <button type="button" class="pill" data-value="Strong">Strong</button>
                </div>
            </div>
            <div>
                <div class="section-label">Lua version</div>
                <div class="pill-group" id="luaVersionGroup">
                    <button type="button" class="pill active" data-value="lua51">Lua 5.1</button>
                    <button type="button" class="pill" data-value="luau">LuaU</button>
                </div>
                <div class="hint" id="luauHint" style="display:none;">LuaU output disables the loadstring Share link.</div>
            </div>
        </div>

        <div class="captcha-row">
            <div class="g-recaptcha" data-sitekey="${RECAPTCHA_SITE_KEY}" data-callback="onCaptchaSuccess" data-expired-callback="onCaptchaExpired"></div>
        </div>

        <div class="actions">
            <button id="sampleBtn" type="button">Load sample</button>
            <button id="clearBtn" type="button">Clear</button>
            <button id="runBtn" type="button" disabled>Obfuscate</button>
        </div>

        <div class="loading" id="loading"><div class="spin"></div><span>Obfuscating…</span></div>

        <div class="result" id="resultSection">
            <div class="result-bar">
                <h3>Output</h3>
                <div class="actbtns">
                    <button id="copyBtn" type="button">Copy</button>
                    <a id="downloadLink" class="btn" href="#" download="">Download .lua</a>
                    <button id="shareBtn" type="button">Share loader</button>
                </div>
            </div>
            <pre id="resultCode"></pre>
            <div id="errDetail"></div>
        </div>
    </div>
    <div class="toast" id="toast"></div>
    <script>
        const input = document.getElementById('luaInput');
        const runBtn = document.getElementById('runBtn');
        const clearBtn = document.getElementById('clearBtn');
        const sampleBtn = document.getElementById('sampleBtn');
        const shareBtn = document.getElementById('shareBtn');
        const loading = document.getElementById('loading');
        const resultSection = document.getElementById('resultSection');
        const resultCode = document.getElementById('resultCode');
        const errDetail = document.getElementById('errDetail');
        const copyBtn = document.getElementById('copyBtn');
        const downloadLink = document.getElementById('downloadLink');
        const toast = document.getElementById('toast');
        const fileUpload = document.getElementById('fileUpload');
        const uploadLink = document.getElementById('uploadLink');
        const counter = document.getElementById('counter');
        const presetGroup = document.getElementById('presetGroup');
        const luaVersionGroup = document.getElementById('luaVersionGroup');
        const luauHint = document.getElementById('luauHint');

        let lastObfuscatedCode = '';
        let selectedPreset = 'Medium';
        let selectedLuaVersion = 'lua51';

        function updateCounter() {
            const text = input.value;
            const lines = text.split('\\n').length;
            const chars = text.length;
            counter.textContent = lines + ' lines · ' + chars + ' chars';
        }
        input.addEventListener('input', updateCounter);
        updateCounter();

        function wireGroup(group, onSelect) {
            group.querySelectorAll('.pill').forEach(p => {
                p.addEventListener('click', () => {
                    group.querySelectorAll('.pill').forEach(x => x.classList.remove('active'));
                    p.classList.add('active');
                    onSelect(p.dataset.value);
                });
            });
        }

        wireGroup(presetGroup, (val) => { selectedPreset = val; });
        wireGroup(luaVersionGroup, (val) => {
            selectedLuaVersion = val;
            const isLuau = val === 'luau';
            luauHint.style.display = isLuau ? 'block' : 'none';
            if (isLuau) {
                shareBtn.style.display = 'none';
            } else if (lastObfuscatedCode) {
                shareBtn.style.display = 'inline-block';
            }
        });

        uploadLink.addEventListener('click', () => fileUpload.click());
        fileUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                input.value = ev.target.result;
                updateCounter();
                showToast('File loaded.');
            };
            reader.readAsText(file);
        });

        sampleBtn.addEventListener('click', () => {
            input.value = '-- sample script\\nprint("hello from sttar")\\nfor i = 1, 3 do\\n    print("iteration " .. i)\\nend\\nlocal function add(a, b)\\n    return a + b\\nend\\nprint(add(5, 7))';
            updateCounter();
            showToast('Sample loaded.');
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            resultSection.style.display = 'none';
            errDetail.style.display = 'none';
            lastObfuscatedCode = '';
            shareBtn.style.display = 'none';
            updateCounter();
        });

        window.onCaptchaSuccess = function() { runBtn.disabled = false; };
        window.onCaptchaExpired = function() { runBtn.disabled = true; };

        runBtn.addEventListener('click', () => {
            const code = input.value.trim();
            if (!code) { showToast('Please enter some Lua code.'); return; }
            const recaptchaToken = grecaptcha.getResponse();
            if (!recaptchaToken) { showToast('Please verify you are not a robot.'); return; }

            loading.style.display = 'flex';
            resultSection.style.display = 'none';
            errDetail.style.display = 'none';
            shareBtn.style.display = 'none';
            runBtn.disabled = true;
            grecaptcha.reset();

            fetch('/api/obfuscate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, recaptchaToken, preset: selectedPreset, luaVersion: selectedLuaVersion })
            })
            .then(async response => {
                if (!response.ok) { const err = await response.json(); throw err; }
                return response.text();
            })
            .then(obfuscated => {
                resultCode.textContent = obfuscated;
                lastObfuscatedCode = obfuscated;
                resultSection.style.display = 'block';
                errDetail.style.display = 'none';
                shareBtn.style.display = (selectedLuaVersion === 'luau') ? 'none' : 'inline-block';

                const randomStr = Math.random().toString(36).substr(2, 8);
                const filename = 'Sttar_ObfuscatedCode_' + randomStr + '.lua';
                const blob = new Blob([obfuscated], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                downloadLink.href = url;
                downloadLink.download = filename;
            })
            .catch(err => {
                let msg = err.error || 'Obfuscation failed';
                let detail = err.detail || '';
                showToast('Error: ' + msg);
                if (detail) {
                    errDetail.textContent = detail;
                    errDetail.style.display = 'block';
                }
            })
            .finally(() => {
                loading.style.display = 'none';
                runBtn.disabled = false;
                if (!grecaptcha.getResponse()) runBtn.disabled = true;
            });
        });

        shareBtn.addEventListener('click', async () => {
            if (!lastObfuscatedCode) { showToast('No obfuscated code to share.'); return; }
            shareBtn.disabled = true;
            try {
                const response = await fetch('/api/share', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: lastObfuscatedCode })
                });
                if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Share failed'); }
                const data = await response.json();
                await navigator.clipboard.writeText(data.loaderScript);
                showToast('Loader copied! Paste in executor.');
            } catch (err) {
                showToast('Share error: ' + err.message);
            } finally {
                shareBtn.disabled = false;
            }
        });

        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(resultCode.textContent);
                showToast('Copied to clipboard!');
            } catch (err) {
                showToast('Failed to copy');
            }
        });

        function showToast(msg) {
            toast.textContent = msg;
            toast.className = 'toast show';
            setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 2000);
        }

        ${CLICK_SCRIPT}
    </script>
</body>
</html>`);
});

app.get('/dashboard', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sttar — Dashboard</title>
    ${FONT_LINK}
    <style>
        ${BASE_STYLE}
        body { display: flex; }
        .sidebar {
            width: 240px;
            background: var(--panel);
            border-right: 1px solid var(--border);
            padding: 28px 16px;
            display: flex; flex-direction: column;
            position: fixed; top: 0; left: 0; bottom: 0; z-index: 5;
            transition: transform 0.25s;
        }
        .sidebar .logo { font-weight: 800; font-size: 14px; margin-bottom: 28px; padding: 0 8px; }
        .sidebar .logo span { color: var(--text-dim); font-weight: 500; }
        .tab, .sidebar a {
            background: none; border: none; color: var(--text-dim);
            text-align: left; padding: 10px 12px; border-radius: 7px;
            font-family: inherit; font-size: 13.5px; font-weight: 500;
            margin-bottom: 2px; cursor: pointer; text-decoration: none;
            display: block; width: 100%;
        }
        .tab:hover, .sidebar a:hover { color: var(--text); background: var(--panel-2); }
        .tab.active { color: #000; background: var(--white); font-weight: 600; }
        .main { position: relative; z-index: 1; margin-left: 240px; padding: 50px 40px; flex: 1; width: calc(100% - 240px); }
        .panelc {
            max-width: 640px;
            display: none;
        }
        .panelc.active { display: block; }
        .panelc h2 { font-size: clamp(1.3em, 3.5vw, 1.6em); font-weight: 700; margin-bottom: 14px; letter-spacing: -0.3px; }
        .panelc p { line-height: 1.8; color: var(--text-dim); margin-bottom: 14px; font-size: 14px; }
        .panelc a { color: var(--accent); font-weight: 600; text-decoration: none; }
        .panelc a:hover { text-decoration: underline; }
        .hamburger {
            display: none; position: fixed; top: 16px; left: 16px; z-index: 20;
            background: var(--panel); border: 1px solid var(--border); color: var(--text);
            font-size: 18px; padding: 6px 12px; border-radius: 7px; cursor: pointer;
        }
        @media (max-width: 768px) {
            body { flex-direction: column; }
            .sidebar { transform: translateX(-100%); padding-top: 60px; }
            .sidebar.open { transform: translateX(0); }
            .hamburger { display: block; }
            .main { margin-left: 0; width: 100%; padding: 84px 22px 30px; }
        }
        .overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 4; }
        .overlay.show { display: block; }
    </style>
</head>
<body>
    <button class="hamburger" id="hamburger">☰</button>
    <div class="overlay" id="overlay"></div>
    <div class="sidebar" id="sidebar">
        <div class="logo">Sttar<span> / docs</span></div>
        <button class="tab active" data-tab="about">About</button>
        <button class="tab" data-tab="privacy">Privacy</button>
        <button class="tab" data-tab="usage">How to use</button>
        <a href="/docs">API reference 🔒</a>
    </div>
    <div class="main">
        <div id="about" class="panelc active">
            <h2>About Sttar</h2>
            <p>Sttar is a Lua obfuscation tool built for Roblox scripters. Paste a script, pick a preset, and get back a transformed version that's far harder to reverse-engineer while staying fully functional.</p>
            <p>It runs on the Prometheus engine with a few additional passes, and supports both Lua 5.1 and LuaU output.</p>
        </div>
        <div id="privacy" class="panelc">
            <h2>Privacy</h2>
            <p>Code you submit is never stored or logged. Processing happens in memory; temp files are deleted immediately after each job completes. No accounts, no analytics on your scripts.</p>
            <p>Questions: <a href="https://sttar-obfuscator.netlify.app" target="_blank">sttar-obfuscator.netlify.app</a></p>
        </div>
        <div id="usage" class="panelc">
            <h2>How to use</h2>
            <p>1. Open the <a href="/home">obfuscator</a>.</p>
            <p>2. Paste or upload a .lua file.</p>
            <p>3. Choose a preset and Lua version.</p>
            <p>4. Complete the human check, then click Obfuscate.</p>
            <p>5. Copy, download, or share a loadstring link (Lua 5.1 only).</p>
        </div>
    </div>
    <script>
        const tabs = document.querySelectorAll('.tab');
        const panels = document.querySelectorAll('.panelc');
        tabs.forEach(t => {
            t.addEventListener('click', () => {
                const id = t.dataset.tab;
                tabs.forEach(x => x.classList.remove('active'));
                t.classList.add('active');
                panels.forEach(p => p.classList.remove('active'));
                document.getElementById(id).classList.add('active');
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    overlay.classList.remove('show');
                }
            });
        });
        const hamburger = document.getElementById('hamburger');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('show');
        });
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        });
        document.querySelector('.sidebar a[href="/docs"]').addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                overlay.classList.remove('show');
            }
        });

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
