import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT     = Number(process.env.PORT) || 3000;
const API_PORT = 8080;
const PUBLIC   = join(__dirname, 'dist', 'public');

// ── Start bundled API server as child process ─────────────────────────────
const apiProc = spawn('node', [join(__dirname, 'api.cjs')], {
  env: { ...process.env, PORT: String(API_PORT), NODE_ENV: 'production' },
  stdio: 'inherit',
});
apiProc.on('error', e => { console.error('API error:', e.message); process.exit(1); });
apiProc.on('exit', code => { if (code) { console.error('API exited:', code); process.exit(code); } });

process.on('SIGTERM', () => apiProc.kill('SIGTERM'));
process.on('SIGINT',  () => apiProc.kill('SIGTERM'));

// ── Express app ───────────────────────────────────────────────────────────
const app = express();

// Clean URL routes → specific HTML pages
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

// Admin routes
app.get('/admin',   (_req, res) => res.sendFile(join(PUBLIC, 'admin.html')));
app.get('/admin/*', (_req, res) => res.sendFile(join(PUBLIC, 'admin.html')));

// Proxy all /api/* to the API server (wait for it to be ready)
app.use('/api', createProxyMiddleware({
  target: `http://localhost:${API_PORT}`,
  changeOrigin: true,
  on: {
    error: (_err, _req, res) => res.status(502).json({ error: 'API unavailable' }),
  },
}));

// Static files (JS, CSS, images, fonts)
app.use(express.static(PUBLIC, {
  maxAge: '1y',
  index: false,
}));

// Catch-all → index.html (SPA fallback)
app.get('*', (_req, res) => res.sendFile(join(PUBLIC, 'index.html')));

app.listen(PORT, () => {
  console.log(`TimestampAI running on port ${PORT}`);
});
