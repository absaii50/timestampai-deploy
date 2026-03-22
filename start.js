import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root     = dirname(fileURLToPath(import.meta.url));
const PORT     = process.env.PORT || '3000';
const API_PORT = '8080';
const env      = { ...process.env, NODE_ENV: 'production' };

const api = spawn('node', [join(root, 'api.cjs')], {
  env: { ...env, PORT: API_PORT }, stdio: 'inherit',
});
api.on('error', e => { console.error('API error:', e.message); process.exit(1); });
api.on('exit',  c => { if (c) process.exit(c); });

const web = spawn('node', [join(root, 'server.js')], {
  env: { ...env, PORT }, stdio: 'inherit',
});
web.on('error', e => { console.error('Web error:', e.message); process.exit(1); });
web.on('exit',  c => { if (c) process.exit(c); });

process.on('SIGTERM', () => { api.kill('SIGTERM'); web.kill('SIGTERM'); });
process.on('SIGINT',  () => { api.kill('SIGTERM'); web.kill('SIGTERM'); });
console.log('TimestampAI | web=' + PORT + ' api=' + API_PORT);
