import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'futapp-production-'));
const cwd = path.resolve('backend');
const environment = { ...process.env, NODE_ENV: 'production', DB_PATH: path.join(directory, 'portal.db'),
  PUBLIC_APP_URL: '', CORS_ORIGIN: '', RENDER_EXTERNAL_URL: 'https://futapp-render-test.onrender.com',
  JWT_SECRET: 'isolated-production-verification-secret-1234567890', ADMIN_EMAIL: 'production@test.com',
  ADMIN_PASSWORD: 'IsolatedProduction123!', ADMIN_NAME: 'Admin de prueba' };
let child;
try {
  const initial = spawnSync(process.execPath, ['dist/adapters/out/persistence/bootstrap-admin.js'], { cwd, env: environment, encoding: 'utf8' });
  assert.equal(initial.status, 0, initial.stderr);
  const repeat = spawnSync(process.execPath, ['dist/adapters/out/persistence/bootstrap-admin.js'], { cwd, env: environment, encoding: 'utf8' });
  assert.equal(repeat.status, 1);
  const seed = spawnSync(process.execPath, ['dist/adapters/out/persistence/seed.js'], { cwd, env: environment, encoding: 'utf8' });
  assert.equal(seed.status, 1); assert(seed.stderr.includes('deshabilitado'));
  const secret = spawnSync(process.execPath, ['-e', "require('./dist/config/env.js')"], { cwd, env: { ...environment, JWT_SECRET: '' }, encoding: 'utf8' });
  assert.equal(secret.status, 1); assert(secret.stderr.includes('JWT_SECRET'));
  environment.DB_PATH = path.join(directory, 'runtime.db');
  environment.BOOTSTRAP_ADMIN = '1';
  const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  child = spawn(process.execPath, ['dist/main.js'], { cwd, env: { ...environment, PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = ''; child.stderr.on('data', chunk => errors += chunk);
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try { const response = await fetch(base + '/api/health'); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(ready, errors);
  const response = await fetch(base + '/admin/partidos/7'); const html = await response.text();
  assert.equal(response.status, 200); assert(html.includes('id="root"'));
  const css = html.match(/href="(\/assets\/[^\"]+\.css)"/)[1];
  const styles = await fetch(base + css); assert.equal(styles.status, 200); assert((await styles.text()).includes('.matchday-hero'));
  assert(html.includes('name="viewport"'));
  const defaultLogo = await fetch(base + '/brand/aag-logo.jpg'); assert.equal(defaultLogo.status, 200); assert(defaultLogo.headers.get('content-type').includes('image/jpeg'));
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: environment.ADMIN_EMAIL, password: environment.ADMIN_PASSWORD }) });
  assert.equal(login.status, 200); const { token } = await login.json();
  const browserLogin = await fetch(base + '/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json',Origin:environment.RENDER_EXTERNAL_URL,'X-FutApp-Client':'web'}, body:JSON.stringify({email:environment.ADMIN_EMAIL,password:environment.ADMIN_PASSWORD}) });
  assert.equal(browserLogin.status,200); assert.equal((await browserLogin.json()).token,undefined);
  const cookie = browserLogin.headers.get('set-cookie'); assert(cookie.includes('HttpOnly'));
  const invitation = await fetch(base + '/api/auth/invitation', { method:'POST', headers:{'Content-Type':'application/json',Origin:environment.RENDER_EXTERNAL_URL,Cookie:cookie.split(';')[0]}, body:'{}' });
  assert.equal(invitation.status,200);
  const forged = await fetch(base + '/api/auth/invitation', { method:'POST', headers:{'Content-Type':'application/json',Origin:'https://attacker.example',Cookie:cookie.split(';')[0]}, body:'{}' });
  assert.equal(forged.status,403);
  const dashboard = await fetch(base + '/api/dashboard/admin', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(dashboard.status, 200); assert.equal((await dashboard.json()).playersCount, 0);
  assert.equal((await fetch(base + '/api/players')).status, 401);
  const migration = await fetch(base + '/api/migration', { headers:{Authorization:`Bearer ${token}`} });
  assert.equal(migration.status,200);assert.equal((await migration.json()).canImport,true);
  const { default: sharp } = await import('sharp');
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#d8b86a' } }).png().toBuffer();
  const body = new FormData(); body.append('file', new Blob([image]), 'escudo.png');
  const upload = await fetch(base + '/api/settings/logo', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
  assert.equal(upload.status, 200); const uploaded = await upload.json();
  assert.equal((await fetch(base + uploaded.url)).status, 401);
  const logo = await fetch(base + '/api/branding/logo'); assert.equal(logo.status, 200); assert(logo.headers.get('content-type').includes('image/webp'));
  assert(fs.readdirSync(path.join(directory, 'uploads')).length === 1);
  console.log('Producción verificada: administrador inicial, controles de acceso, React y rutas directas, CSS, viewport móvil, escudo y carga persistente de imágenes.');
} finally {
  if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
  assert.equal(path.dirname(directory), os.tmpdir());
  fs.rmSync(directory, { recursive: true, force: true });
}
