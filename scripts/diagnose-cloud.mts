import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createPostgresDatabase } from '../backend/src/adapters/out/persistence/postgres-database';

// Read-only diagnostics. Never print provider bodies, connection strings or error messages.
const lines: string[] = [];
function report(label: string, value: string) {
  const line = `${label}: ${value}`;
  lines.push(line); console.log(line);
}
function code(error: unknown): string {
  const value = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  return /^[A-Z0-9_]{2,64}$/.test(value) ? value : 'ERROR_SIN_CODIGO';
}
async function renderRequest(route: string) {
  const response = await fetch(`https://api.render.com/v1/services/${process.env.RENDER_SERVICE_ID}${route}`, {
    headers: { Authorization: `Bearer ${process.env.RENDER_API_KEY}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Object.assign(new Error(), { code: `HTTP_${response.status}` });
  return response.json();
}
let bucket = 'futapp-media';
let publicUrl = '', initialEmail = '', initialPassword = '';
try {
  if (!/^srv-[a-z0-9]+$/.test(process.env.RENDER_SERVICE_ID || '')) throw new Error();
  const service = await renderRequest('');
  report('Render', service.serviceDetails?.plan === 'free' && service.serviceDetails?.runtime === 'node' ? 'FREE_NODE' : 'REVISAR_PLAN_RUNTIME');
  const url = new URL(service.serviceDetails.url);
  if (url.protocol === 'https:' && url.hostname.endsWith('.onrender.com')) report('URL pública', url.origin);
  publicUrl = url.origin;
  const variables = await renderRequest('/env-vars?limit=100');
  const effective = new Map<string,string>(variables.map((item: any) => [item.envVar.key, item.envVar.value]));
  bucket = effective.get('SUPABASE_STORAGE_BUCKET') || bucket;
  initialEmail = effective.get('ADMIN_EMAIL') || '';
  initialPassword = effective.get('ADMIN_PASSWORD') || '';
  const keys = ['DATABASE_URL','SUPABASE_URL','SUPABASE_SECRET_KEY'];
  report('Variables Supabase en Render', keys.every(key => effective.get(key) === process.env[key]) ? 'COINCIDEN_CON_GITHUB' : 'REVISAR_DIFERENCIAS');
  report('Credenciales iniciales', effective.get('JWT_SECRET') && effective.get('ADMIN_PASSWORD') ? 'CONFIGURADAS' : 'FALTAN');
} catch (error) { report('Render', code(error)); }

try {
  const db = createPostgresDatabase(process.env.DATABASE_URL!);
  try {
    await db.query('SELECT 1 AS ok');
    report('PostgreSQL con TLS', 'CONECTADO');
    const [schema] = await db.query("SELECT count(*) AS total FROM information_schema.tables WHERE table_schema='futapp'");
    report('Tablas de FutApp', String(schema.total));
    const [state] = await db.query('SELECT enabled,imported_at FROM migration_state WHERE id=1');
    report('Ingesta', state?.imported_at ? 'COMPLETADA' : state?.enabled ? 'ACTIVADA_SIN_IMPORTAR' : 'DESACTIVADA');
    const [counts] = await db.query('SELECT (SELECT count(*) FROM users) AS users,(SELECT count(*) FROM players) AS players,(SELECT count(*) FROM media_assets) AS files');
    report('Cantidades actuales', `cuentas=${counts.users}, jugadores=${counts.players}, archivos=${counts.files}`);
  } finally { await db.close(); }
} catch (error) { report('PostgreSQL', code(error)); }

try {
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) }) },
  });
  const result = await client.storage.getBucket(bucket);
  if (result.error) {
    const status = String(result.error.statusCode);
    report('Bucket Supabase', /^\d{3}$/.test(status) ? `HTTP_${status}` : 'ERROR_DE_ALMACENAMIENTO');
  } else report('Bucket Supabase', result.data.public ? 'PUBLICO_REQUIERE_CORRECCION' : 'PRIVADO');
} catch (error) { report('Bucket Supabase', code(error)); }

// Optional administrator HTTP probe. It only previews a private backup; never calls import.
// Credentials, cookies, archive URL, archive contents and response bodies never reach logs.
if (process.env.MIGRATION_PREVIEW === 'true') {
  let cookie = '';
  const request = (route: string, options: RequestInit = {}) => fetch(publicUrl + '/api' + route, {
    ...options, signal: AbortSignal.timeout(90000),
    headers: { Origin: publicUrl, 'X-FutApp-Client': 'web', ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
  });
  try {
    if (!publicUrl || !initialEmail || !initialPassword) throw new Error();
    const login = await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: initialEmail, password: initialPassword }) });
    if (!login.ok) throw Object.assign(new Error(), { code: `LOGIN_HTTP_${login.status}` });
    cookie = login.headers.get('set-cookie')?.split(';')[0] || '';
    await login.arrayBuffer();
    if (!cookie) throw new Error();
    const statusResponse = await request('/migration');
    if (!statusResponse.ok) throw Object.assign(new Error(), { code: `STATUS_HTTP_${statusResponse.status}` });
    const status = await statusResponse.json();
    if (!status.enabled || !status.canImport) { report('Previsualización HTTP', 'NO_EJECUTADA_DESTINO_NO_DISPONIBLE'); }
    else {
      const source = new URL(process.env.MIGRATION_PROBE_URL || '');
      if (source.protocol !== 'https:' || !source.hostname.endsWith('.trycloudflare.com')) throw new Error();
      const download = await fetch(source, { signal: AbortSignal.timeout(30000), redirect: 'error' });
      if (!download.ok || Number(download.headers.get('content-length')) > 25 * 1024 * 1024) throw new Error();
      const bytes = await download.arrayBuffer();
      if (bytes.byteLength > 25 * 1024 * 1024) throw new Error();
      const form = new FormData(); form.append('file', new Blob([bytes]), 'team.futapp');
      const started = Date.now();
      const preview = await request('/migration/preview', { method: 'POST', body: form });
      report('Previsualización HTTP', `HTTP_${preview.status}, ${Date.now() - started}ms`);
      if (preview.ok) {
        const data = await preview.json();
        report('Cantidades validadas', `cuentas=${data.counts?.users}, jugadores=${data.counts?.players}, torneos=${data.counts?.tournaments}, archivos=${data.files}`);
      } else await preview.arrayBuffer();
    }
  } catch (error) { report('Previsualización HTTP', code(error)); }
  finally { if (cookie) await request('/auth/logout', { method: 'POST' }).catch(() => {}); }
}

if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '\nDiagnóstico de solo lectura, sin credenciales ni datos de jugadores:\n\n' + lines.map(line => `- ${line}`).join('\n') + '\n');
