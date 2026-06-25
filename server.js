const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const session = require('express-session');
const { execFile } = require('child_process');
const { randomUUID } = require('crypto');

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

// ================== PATH TO PROMETHEUS CLI ==================
const PROMETHEUS_CLI = path.join(__dirname, 'Prometheus', 'cli.lua');
const TEMP_DIR = os.tmpdir();

// ================== ROOT ROUTE ==================
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sttar Obfuscator</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a0a;
            color: #e0e0e0;
            font-family: 'Inter', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
            text-align: center;
        }
        .card {
            background: rgba(20,20,20,0.8);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        }
        h1 {
            font-size: 2.2em;
            background: linear-gradient(135deg, #bb86fc, #03dac6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 15px;
        }
        p { color: #aaa; margin-bottom: 20px; }
        a {
            display: inline-block;
            background: linear-gradient(135deg, #bb86fc, #7c4dff);
            color: #fff;
            padding: 14px 30px;
            border-radius: 30px;
            font-weight: 600;
            text-decoration: none;
            transition: transform 0.2s, box-shadow 0.3s;
        }
        a:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(187,134,252,0.4);
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>Sttar Obfuscator</h1>
        <p>Invalid route. If you want to use our obfuscator, please go to:</p>
        <a href="/home">https://obfuscator-api-bzc1.onrender.com/home</a>
    </div>
</body>
</html>`);
});

// ================== OBFS API (DIRECT CODE RESPONSE) ==================
app.post('/api/obfuscate', (req, res) => {
    const rawCode = req.body.code;

    if (!rawCode) {
        return res.status(400).json({ error: 'Walang code na nilagay!' });
    }

    const id = randomUUID();
    const inputFile = path.join(TEMP_DIR, `temp_in_${id}.lua`);
    const outputFile = path.join(TEMP_DIR, `temp_out_${id}.lua`);

    console.log(`[${id}] Received code, length: ${rawCode.length}`);

    const cleanup = () => {
        try {
            if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
            if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
        } catch (e) {
            console.error("Cleanup error:", e.message);
        }
    };

    try {
        fs.writeFileSync(inputFile, rawCode);

        execFile(
            'luajit',
            [
                PROMETHEUS_CLI,
                '--preset', 'Medium',
                inputFile,
                '--out', outputFile
            ],
            (error, stdout, stderr) => {
                console.log(`[${id}] CLI stdout:`, stdout);
                if (error) {
                    console.error(`[${id}] Engine error:`, stderr || error.message);
                    cleanup();
                    return res.status(500).json({ error: 'Obfuscation failed.' });
                }

                try {
                    if (!fs.existsSync(outputFile)) {
                        cleanup();
                        return res.status(500).json({ error: 'No output generated.' });
                    }

                    const obfuscatedCode = fs.readFileSync(outputFile, 'utf8');

                    // No emoji, simple header
                    const header = `-- Obfuscated by Sttar Obfuscator https://obfuscator-api-bzc1.onrender.com/home`;
                    const finalCode = header + '\n' + obfuscatedCode;

                    cleanup();

                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    return res.send(finalCode);

                } catch (err) {
                    console.error("Error:", err.message);
                    cleanup();
                    return res.status(500).json({ error: 'Failed to process.' });
                }
            }
        );

    } catch (err) {
        console.error(err.message);
        cleanup();
        return res.status(500).json({ error: 'Server error.' });
    }
});

// ================== HOME PAGE – RESPONSIVE, NO EMOJI ==================
app.get('/home', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sttar Obfuscator</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: #0a0a0a;
            color: #e0e0e0;
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 20px;
            position: relative;
            overflow-x: hidden;
        }
        body::before {
            content: "";
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: radial-gradient(circle at 30% 20%, rgba(138, 43, 226, 0.08), transparent 50%),
                        radial-gradient(circle at 70% 80%, rgba(0, 255, 255, 0.05), transparent 50%);
            pointer-events: none;
        }
        .navbar {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10;
        }
        .navbar a {
            color: #aaa;
            text-decoration: none;
            margin-left: 25px;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.5px;
            transition: color 0.3s;
        }
        .navbar a:hover { color: #bb86fc; }
        .main-container {
            width: 100%;
            max-width: 900px;
            background: rgba(20, 20, 20, 0.8);
            backdrop-filter: blur(25px);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 24px;
            padding: clamp(20px, 5vw, 40px);
            box-shadow: 0 30px 60px rgba(0,0,0,0.6);
            transition: transform 0.3s;
        }
        h1 {
            font-size: clamp(2em, 6vw, 2.8em);
            font-weight: 700;
            text-align: center;
            margin-bottom: 10px;
            background: linear-gradient(135deg, #bb86fc, #03dac6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            line-height: 1.2;
        }
        .subtitle {
            text-align: center;
            color: #888;
            margin-bottom: 30px;
            font-size: clamp(14px, 2vw, 16px);
        }
        textarea {
            width: 100%;
            height: clamp(200px, 50vh, 280px);
            background: #111;
            border: 1px solid #2a2a2a;
            border-radius: 16px;
            padding: 20px;
            color: #e0e0e0;
            font-family: 'Fira Code', monospace;
            font-size: 14px;
            resize: vertical;
            transition: border 0.3s, box-shadow 0.3s;
        }
        textarea:focus {
            outline: none;
            border-color: #bb86fc;
            box-shadow: 0 0 0 3px rgba(187,134,252,0.3);
        }
        .obfuscate-btn {
            display: block;
            margin: 25px auto 0;
            background: linear-gradient(135deg, #bb86fc, #7c4dff);
            border: none;
            color: #fff;
            font-size: clamp(16px, 2.5vw, 18px);
            font-weight: 700;
            padding: 14px 35px;
            border-radius: 50px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.3s;
            letter-spacing: 1px;
            text-transform: uppercase;
            position: relative;
            overflow: hidden;
            width: 100%;
            max-width: 300px;
        }
        .obfuscate-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px rgba(187,134,252,0.4);
        }
        .obfuscate-btn:active { transform: scale(0.97); }
        .loading {
            display: none;
            text-align: center;
            margin-top: 25px;
        }
        .loader {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(187,134,252,0.3);
            border-top-color: #bb86fc;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 10px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .result-section {
            display: none;
            margin-top: 30px;
            animation: fadeSlideUp 0.5s ease-out;
        }
        @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .result-header h3 {
            color: #bb86fc;
            font-weight: 600;
            font-size: 1.2em;
        }
        .action-btns {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        .action-btns button, .action-btns a {
            background: rgba(187,134,252,0.15);
            border: 1px solid rgba(187,134,252,0.4);
            color: #e0e0e0;
            padding: 8px 18px;
            border-radius: 30px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            text-decoration: none;
            display: inline-block;
        }
        .action-btns button:hover, .action-btns a:hover {
            background: rgba(187,134,252,0.3);
            border-color: #bb86fc;
        }
        pre {
            background: #111;
            border: 1px solid #2a2a2a;
            border-radius: 16px;
            padding: 20px;
            font-family: 'Fira Code', monospace;
            font-size: 13px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 400px;
            color: #ccc;
            line-height: 1.6;
        }
        .toast {
            visibility: hidden;
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 30px;
            border-radius: 30px;
            font-weight: 600;
            z-index: 999;
            box-shadow: 0 10px 20px rgba(0,0,0,0.5);
            font-size: 14px;
            white-space: nowrap;
        }
        .toast.show {
            visibility: visible;
            animation: fadeInOut 2s ease;
        }
        @keyframes fadeInOut {
            0% { opacity: 0; bottom: 20px; }
            10% { opacity: 1; bottom: 30px; }
            90% { opacity: 1; bottom: 30px; }
            100% { opacity: 0; bottom: 20px; }
        }
        @media (max-width: 600px) {
            .navbar { top: 10px; right: 10px; }
            .navbar a { margin-left: 15px; font-size: 13px; }
            .main-container { padding: 20px 15px; }
            .action-btns { flex-direction: column; width: 100%; }
            .action-btns button, .action-btns a { text-align: center; }
            pre { font-size: 12px; }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <a href="/dashboard">Dashboard</a>
    </nav>
    <div class="main-container">
        <h1>Sttar Obfuscator</h1>
        <p class="subtitle">Paste your Lua code below and get obfuscated output instantly.</p>
        <textarea id="luaInput" placeholder="-- Write your Lua script here..."></textarea>
        <button class="obfuscate-btn" id="obfBtn">Obfuscate</button>
        <div class="loading" id="loading">
            <div class="loader"></div>
            <p>Obfuscating...</p>
        </div>
        <div class="result-section" id="resultSection">
            <div class="result-header">
                <h3>Obfuscated Result</h3>
                <div class="action-btns">
                    <button id="copyBtn">Copy</button>
                    <a id="downloadLink" href="#" download="">Download .lua</a>
                </div>
            </div>
            <pre id="resultCode"></pre>
        </div>
    </div>
    <div class="toast" id="toast"></div>

    <script>
        const input = document.getElementById('luaInput');
        const obfBtn = document.getElementById('obfBtn');
        const loading = document.getElementById('loading');
        const resultSection = document.getElementById('resultSection');
        const resultCode = document.getElementById('resultCode');
        const copyBtn = document.getElementById('copyBtn');
        const downloadLink = document.getElementById('downloadLink');
        const toast = document.getElementById('toast');

        obfBtn.addEventListener('click', async () => {
            const code = input.value.trim();
            if (!code) {
                showToast('Warning: Please enter some Lua code.');
                return;
            }
            loading.style.display = 'block';
            resultSection.style.display = 'none';
            obfBtn.disabled = true;

            try {
                const response = await fetch('/api/obfuscate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Obfuscation failed');
                }
                const obfuscated = await response.text();
                resultCode.textContent = obfuscated;
                resultSection.style.display = 'block';
                // Setup download
                const randomStr = Math.random().toString(36).substr(2, 8);
                const filename = \`Sttar_ObfuscatedCode_\${randomStr}.lua\`;
                const blob = new Blob([obfuscated], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                downloadLink.href = url;
                downloadLink.download = filename;
            } catch (error) {
                showToast('Error: ' + error.message);
            } finally {
                loading.style.display = 'none';
                obfBtn.disabled = false;
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
    </script>
</body>
</html>`);
});

// ================== DASHBOARD PAGE – RESPONSIVE, NO EMOJI ==================
app.get('/dashboard', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sttar Obfuscator – Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #0a0a0a;
            color: #ddd;
            font-family: 'Inter', sans-serif;
            display: flex;
            min-height: 100vh;
        }
        .sidebar {
            width: 260px;
            background: rgba(20,20,20,0.9);
            backdrop-filter: blur(15px);
            border-right: 1px solid rgba(255,255,255,0.06);
            padding: 40px 20px;
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0; left: 0; bottom: 0;
            z-index: 5;
            transition: transform 0.3s;
        }
        .sidebar h2 {
            font-size: 1.5em;
            margin-bottom: 40px;
            font-weight: 700;
            background: linear-gradient(135deg, #bb86fc, #03dac6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-align: center;
        }
        .sidebar a, .sidebar button {
            background: none;
            border: none;
            color: #aaa;
            text-align: left;
            padding: 14px 18px;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 5px;
            cursor: pointer;
            transition: all 0.25s;
            text-decoration: none;
            display: block;
            width: 100%;
        }
        .sidebar a:hover, .sidebar button:hover {
            background: rgba(187,134,252,0.1);
            color: #fff;
        }
        .sidebar a.active, .sidebar button.active {
            background: rgba(187,134,252,0.25);
            color: #bb86fc;
        }
        .main-content {
            margin-left: 260px;
            padding: 60px 50px;
            flex: 1;
            animation: fadeIn 0.5s ease;
            width: calc(100% - 260px);
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .content-panel {
            background: rgba(20,20,20,0.7);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 24px;
            padding: clamp(25px, 5vw, 40px);
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            display: none;
            animation: slideIn 0.3s ease-out;
        }
        .content-panel.active { display: block; }
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .content-panel h2 {
            font-size: clamp(1.5em, 4vw, 2em);
            margin-bottom: 20px;
            color: #bb86fc;
        }
        .content-panel p {
            line-height: 1.8;
            color: #bbb;
            margin-bottom: 20px;
            font-size: clamp(15px, 2vw, 16px);
        }
        .content-panel a {
            color: #03dac6;
            font-weight: 600;
        }
        .hamburger {
            display: none;
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 20;
            background: rgba(20,20,20,0.8);
            border: 1px solid #333;
            color: #fff;
            font-size: 24px;
            padding: 8px 15px;
            border-radius: 10px;
            cursor: pointer;
        }
        @media (max-width: 768px) {
            body { flex-direction: column; }
            .sidebar {
                transform: translateX(-100%);
                width: 260px;
                padding-top: 60px;
            }
            .sidebar.open { transform: translateX(0); }
            .hamburger { display: block; }
            .main-content {
                margin-left: 0;
                width: 100%;
                padding: 20px;
                margin-top: 60px;
            }
            .sidebar a, .sidebar button { margin: 5px 0; }
        }
        .overlay {
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6);
            z-index: 4;
        }
        .overlay.show { display: block; }
    </style>
</head>
<body>
    <button class="hamburger" id="hamburger">&#9776;</button>
    <div class="overlay" id="overlay"></div>
    <div class="sidebar" id="sidebar">
        <h2>Sttar</h2>
        <button class="tab-btn active" data-tab="about">What is Sttar?</button>
        <button class="tab-btn" data-tab="privacy">Privacy Policy</button>
        <button class="tab-btn" data-tab="usage">How to Use</button>
        <a href="/docs">API Docs (Locked)</a>
    </div>
    <div class="main-content">
        <div id="about" class="content-panel active">
            <h2>What is Sttar Obfuscator?</h2>
            <p>Sttar Obfuscator is a high-performance Lua code protection tool built for Roblox scripters. It transforms readable source code into a secure, obfuscated version that is extremely difficult to reverse-engineer, while keeping your scripts fully functional. Powered by the Prometheus engine with custom optimizations, Sttar delivers robust obfuscation without compromising execution speed.</p>
            <p>Our mission is to give developers a free, easy-to-use layer of security for their intellectual property directly from the browser.</p>
        </div>
        <div id="privacy" class="content-panel">
            <h2>Privacy Policy</h2>
            <p>We do not store, log, or share any Lua code you submit. All processing is done in-memory and temporary files are deleted immediately after obfuscation. No personal data is collected. Your scripts remain yours alone.</p>
            <p>For any questions, contact <a href="https://sttar-obfuscator.netlify.app" target="_blank">sttar-obfuscator.netlify.app</a>.</p>
        </div>
        <div id="usage" class="content-panel">
            <h2>How to Use</h2>
            <p><strong>Step 1:</strong> Go to the <a href="/home">Obfuscator tool</a>.</p>
            <p><strong>Step 2:</strong> Paste your Lua script into the text box.</p>
            <p><strong>Step 3:</strong> Click the OBFUSCATE button and wait for the process.</p>
            <p><strong>Step 4:</strong> Copy the result or download it as a .lua file.</p>
            <p>You can then load the obfuscated script in Roblox using a standard executor.</p>
            <p>Need programmatic access? Use our <a href="/docs">API Docs</a> (password required).</p>
        </div>
    </div>
    <script>
        // Tab switching
        const btns = document.querySelectorAll('.tab-btn');
        const panels = document.querySelectorAll('.content-panel');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                panels.forEach(p => p.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    overlay.classList.remove('show');
                }
            });
        });

        // Hamburger menu
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

        // Close sidebar when link to /docs is clicked
        document.querySelector('.sidebar a[href="/docs"]').addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                overlay.classList.remove('show');
            }
        });
    </script>
</body>
</html>`);
});

// ================== API DOCS (Password Protected) – NO EMOJI ==================
app.get('/docs', (req, res) => {
    if (!req.session.authenticated) {
        return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Obfuscator API – Login</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(15px);
            border-radius: 20px;
            padding: clamp(30px, 8vw, 40px);
            width: 100%;
            max-width: 380px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.15);
            text-align: center;
        }
        .card h2 {
            color: #fff;
            margin-bottom: 20px;
            font-weight: 600;
            font-size: clamp(1.5em, 5vw, 1.8em);
        }
        .card input[type="password"] {
            width: 100%;
            padding: 14px 18px;
            border: none;
            border-radius: 12px;
            background: rgba(255,255,255,0.08);
            color: #fff;
            font-size: 16px;
            margin-bottom: 20px;
            outline: none;
            transition: 0.3s;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .card input[type="password"]:focus {
            border-color: #a18cd1;
            background: rgba(255,255,255,0.15);
        }
        .card button {
            background: linear-gradient(135deg, #a18cd1, #fbc2eb);
            border: none;
            color: #1e1e2f;
            font-weight: bold;
            padding: 14px 30px;
            border-radius: 12px;
            font-size: 16px;
            cursor: pointer;
            width: 100%;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .card button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(161,140,209,0.4);
        }
        .card p {
            color: rgba(255,255,255,0.5);
            margin-top: 15px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="card">
        <h2>Obfuscator API</h2>
        <p style="color: rgba(255,255,255,0.7); margin-bottom: 20px;">Enter password to view docs</p>
        <form method="POST" action="/docs">
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Enter</button>
        </form>
    </div>
</body>
</html>`);
    }

    // Authenticated docs page
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Obfuscator API – Documentation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            line-height: 1.6;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: clamp(20px, 5vw, 40px) 20px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
            margin-bottom: 40px;
            border-bottom: 1px solid #334155;
            padding-bottom: 20px;
        }
        .header h1 {
            font-size: clamp(1.8em, 5vw, 2.2em);
            font-weight: 700;
            background: linear-gradient(135deg, #a78bfa, #f472b6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .logout-btn {
            background: #334155;
            color: #cbd5e1;
            padding: 8px 18px;
            border-radius: 30px;
            text-decoration: none;
            font-size: 14px;
            transition: 0.3s;
        }
        .logout-btn:hover {
            background: #475569;
            color: white;
        }
        .card {
            background: #1e293b;
            border-radius: 16px;
            padding: clamp(20px, 4vw, 30px);
            margin-bottom: 30px;
            border: 1px solid #334155;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
        }
        .card h2 {
            font-size: 1.5em;
            margin-bottom: 15px;
            color: #a78bfa;
        }
        .code-block {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 20px;
            font-family: 'Fira Code', monospace;
            font-size: clamp(13px, 2vw, 15px);
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
            margin: 15px 0;
            color: #e2e8f0;
        }
        .method {
            display: inline-block;
            background: #a78bfa;
            color: #0f172a;
            padding: 2px 10px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 13px;
            margin-right: 10px;
        }
        .endpoint {
            font-size: 1.1em;
            font-weight: 600;
            color: #f8fafc;
        }
        .note {
            background: #2d3748;
            border-left: 4px solid #f472b6;
            padding: 15px;
            border-radius: 8px;
            margin-top: 25px;
            color: #e2e8f0;
            font-size: 14px;
        }
        @media (max-width: 600px) {
            .container { padding: 20px 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Obfuscator API Documentation</h1>
            <a href="/logout" class="logout-btn">Logout</a>
        </div>
        <div class="card">
            <h2>Endpoint</h2>
            <p><span class="method">POST</span><span class="endpoint">/api/obfuscate</span></p>
            <p style="margin-top: 15px; color: #94a3b8;">Send Lua code, directly receive obfuscated code (plain text).</p>
        </div>
        <div class="card">
            <h2>Request Body</h2>
            <div class="code-block">{ "code": "print('Hello world')" }</div>
        </div>
        <div class="card">
            <h2>Response (Obfuscated Code)</h2>
            <div class="code-block">-- Obfuscated by Sttar Obfuscator https://obfuscator-api-bzc1.onrender.com/home
[... obfuscated Lua code ...]</div>
        </div>
        <div class="note">
            <strong>Note:</strong> Direct text response, no external storage. Medium preset.
        </div>
    </div>
</body>
</html>`);
});

// ================== LOGIN CHECK ==================
app.post('/docs', (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD) {
        req.session.authenticated = true;
        return res.redirect('/docs');
    }
    return res.send(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wrong Password</title>
    <style>
        body {
            background: #0f172a;
            color: #f1f5f9;
            font-family: 'Segoe UI', sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
            padding: 20px;
        }
        h2 { color: #f87171; font-size: clamp(1.5em, 5vw, 2em); }
        a { color: #a78bfa; text-decoration: none; margin-top: 20px; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h2>Wrong password</h2>
    <p>Please try again.</p>
    <a href="/docs">Back to Login</a>
</body>
</html>`);
});

// ================== LOGOUT ==================
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/docs');
    });
});

// ================== HEALTH CHECK ==================
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
