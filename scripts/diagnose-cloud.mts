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
try {
  if (!/^srv-[a-z0-9]+$/.test(process.env.RENDER_SERVICE_ID || '')) throw new Error();
  const service = await renderRequest('');
  report('Render', service.serviceDetails?.plan === 'free' && service.serviceDetails?.runtime === 'node' ? 'FREE_NODE' : 'REVISAR_PLAN_RUNTIME');
  const url = new URL(service.serviceDetails.url);
  if (url.protocol === 'https:' && url.hostname.endsWith('.onrender.com')) report('URL pública', url.origin);
  const variables = await renderRequest('/env-vars?limit=100');
  const effective = new Map<string,string>(variables.map((item: any) => [item.envVar.key, item.envVar.value]));
  bucket = effective.get('SUPABASE_STORAGE_BUCKET') || bucket;
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

if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '\nDiagnóstico de solo lectura, sin credenciales ni datos de jugadores:\n\n' + lines.map(line => `- ${line}`).join('\n') + '\n');
