import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT     = Number(process.env.PORT) || 3000;
const API_PORT = 8080;
const PUBLIC   = join(__dirname, 'dist', 'public');

// Check env vars and warn
const missing = ['DATABASE_URL', 'ADMIN_PASSWORD', 'SESSION_SECRET'].filter(k => !process.env[k]);
if (missing.length) console.warn('[WARN] Missing env vars:', missing.join(', '));

// ── Start API server in-process (no child process spawn needed) ───────────
const savedPort = process.env.PORT;
process.env.PORT = String(API_PORT);
try {
  const require = createRequire(import.meta.url);
  require('./api.cjs');
  console.log('[API] Server started on port', API_PORT);
} catch (e) {
  console.error('[API] Failed to load:', e.message);
}
process.env.PORT = savedPort;

// ── Express web server ────────────────────────────────────────────────────
const app = express();

// Clean URL → HTML page mapping
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

// Proxy /api/* → API server (running in-process on API_PORT)
app.use('/api', createProxyMiddleware({
  target: `http://localhost:${API_PORT}`,
  changeOrigin: true,
  on: {
    error: (_e, _req, res) => res.status(503).json({ error: 'API starting up, please retry' }),
  },
}));

// Static files (JS, CSS, images)
app.use(express.static(PUBLIC, { maxAge: '1y', index: false }));

// Fallback → index.html
app.get('*', (_req, res) => res.sendFile(join(PUBLIC, 'index.html')));

app.listen(PORT, () => console.log(`[TimestampAI] Web on port ${PORT}`));
