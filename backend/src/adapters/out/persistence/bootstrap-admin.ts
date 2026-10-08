import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { migrate } from './migrate';
import { closeDb, getDb } from './database';

try {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrador';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 15 || Buffer.byteLength(password,'utf8')>72) {
    throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD (15 caracteres, hasta 72 bytes); ADMIN_NAME es opcional.');
  }
  migrate();
  const db = getDb();
  db.transaction(() => {
    const existing = db.prepare("SELECT id FROM users WHERE role = 'admin' AND active = 1").get();
    if (existing) throw new Error('Ya existe un administrador activo. Usa la gestión de jugadores para administrar permisos.');
    db.prepare("INSERT INTO users(email, password_hash, full_name, role) VALUES (?, ?, ?, 'admin')")
      .run(email, bcrypt.hashSync(password, 12), name);
  }).immediate();
  console.log('Administrador inicial creado. Puedes iniciar sesión con el correo indicado.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo crear el administrador');
  process.exitCode = 1;
} finally {
  closeDb();
}
