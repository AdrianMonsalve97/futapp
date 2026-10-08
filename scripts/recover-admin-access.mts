import bcrypt from 'bcryptjs';
import { createPostgresDatabase } from '../backend/src/adapters/out/persistence/postgres-database';

// Recovery only copies an already valid imported password to Render's private environment.
// It never resets passwords, creates accounts, changes business rows or deploys the app.
async function recover() {
  const password = process.env.ADMIN_ACCESS_PASSWORD || '';
  const serviceId = process.env.RENDER_SERVICE_ID || '';
  if (!/^srv-[a-z0-9]+$/.test(serviceId) || !process.env.RENDER_API_KEY || password.length < 15 || Buffer.byteLength(password) > 72) throw new Error();
  async function render(route: string, value?: string) {
    const response = await fetch(`https://api.render.com/v1/services/${serviceId}${route}`, {
      method: value === undefined ? 'GET' : 'PUT',
      headers: { Authorization: `Bearer ${process.env.RENDER_API_KEY}`, Accept: 'application/json', ...(value === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(value === undefined ? {} : { body: JSON.stringify({ value }) }), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error();
    return response.status === 204 ? null : response.json();
  }
  const service = await render('');
  if (service.repo?.replace(/\.git$/, '').toLowerCase() !== 'https://github.com/adrianmonsalve97/futapp' || service.branch !== 'main' || service.serviceDetails?.plan !== 'free' || service.autoDeployTrigger !== 'off') throw new Error();
  const existing = await render('/env-vars?limit=100');
  const email = existing.find((item: any) => item.envVar.key === 'ADMIN_EMAIL')?.envVar.value;
  if (!email) throw new Error();
  const db = createPostgresDatabase(process.env.DATABASE_URL!);
  try {
    const [state] = await db.query('SELECT imported_at FROM migration_state WHERE id=1');
    const [admin] = await db.query("SELECT password_hash FROM users WHERE email=$1 AND role='admin' AND active=1", [email]);
    if (!state?.imported_at || !admin || !await bcrypt.compare(password, admin.password_hash)) throw new Error();
  } finally { await db.close(); }
  await render('/env-vars/ADMIN_PASSWORD', password);
  const updated = await render('/env-vars?limit=100');
  if (updated.find((item: any) => item.envVar.key === 'ADMIN_PASSWORD')?.envVar.value !== password) throw new Error();
  console.log('Contraseña del administrador importado verificada y disponible en ADMIN_PASSWORD del panel privado de Render.');
  console.log('No se modificaron cuentas ni datos y no se inició ningún despliegue.');
}
try { await recover(); }
catch { console.error('No se pudo verificar o guardar la credencial privada. No se modificó ninguna contraseña de la base de datos.'); process.exitCode = 1; }
