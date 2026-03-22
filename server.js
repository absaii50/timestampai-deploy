import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT     = Number(process.env.PORT) || 3000;
const API_PORT = 8080;
const PUBLIC   = join(__dirname, 'dist', 'public');

// Check critical env vars and warn (don't crash)
const required = ['DATABASE_URL', 'ADMIN_PASSWORD', 'SESSION_SECRET'];
const missing  = required.filter(k => !process.env[k]);
if (missing.length) console.warn('[WARN] Missing env vars:', missing.join(', '));

// ── Start API server with auto-restart ────────────────────────────────────
let apiProc = null;

function startApi() {
  apiProc = spawn('node', [join(__dirname, 'api.cjs')], {
    env: { ...process.env, PORT: String(API_PORT), NODE_ENV: 'production' },
    stdio: 'inherit',
  });
  apiProc.on('error', e => console.error('[API] spawn error:', e.message));
  apiProc.on('exit', (code, signal) => {
    if (signal === 'SIGTERM' || signal === 'SIGINT') return; // intentional shutdown
    console.error('[API] exited with code', code, '— restarting in 3s…');
    setTimeout(startApi, 3000);
  });
}

startApi();

process.on('SIGTERM', () => { apiProc?.kill('SIGTERM'); process.exit(0); });
process.on('SIGINT',  () => { apiProc?.kill('SIGTERM'); process.exit(0); });

// ── Express app ───────────────────────────────────────────────────────────
const app = express();

// Clean URL → HTML file mapping
const HTML_ROUTES = {
  '/login':       'login.html',
  '/admin-login': 'admin-login.html',
  '/dashboard':   'dashboard.html',
  '/pricing':     'pricing.html',
  '/privacy':     'privacy.html',
  '/terms':       'terms.html',
  '/contact':     'contact.html',
};
for (const [route, file] of Object.entries(HTML_ROUTES)) {
  app.get(route, (_req, res) => res.sendFile(join(PUBLIC, file)));
}
app.get('/admin',   (_req, res) => res.sendFile(join(PUBLIC, 'admin.html')));
app.get('/admin/*', (_req, res) => res.sendFile(join(PUBLIC, 'admin.html')));

// Proxy /api/* to API server
app.use('/api', createProxyMiddleware({
  target: `http://localhost:${API_PORT}`,
  changeOrigin: true,
  on: {
    error: (_err, _req, res) => {
      res.status(503).json({ error: 'API starting up, please retry in a moment' });
    },
  },
}));

// Static files
app.use(express.static(PUBLIC, { maxAge: '1y', index: false }));

// Catch-all → index.html
app.get('*', (_req, res) => res.sendFile(join(PUBLIC, 'index.html')));

app.listen(PORT, () => console.log(`[TimestampAI] Web on port ${PORT} | API on port ${API_PORT}`));
