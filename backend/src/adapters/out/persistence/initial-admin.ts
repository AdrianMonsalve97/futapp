import bcrypt from 'bcryptjs';
import type { Database } from 'better-sqlite3';
/** Bootstraps only an empty database. Redeploys and imports never reset accounts. */
export function ensureInitialAdmin(db: Database, options = process.env): boolean {
  if (options.BOOTSTRAP_ADMIN !== '1' || (db.prepare('SELECT count(*) n FROM users').get() as { n:number }).n) return false;
  const email = options.ADMIN_EMAIL?.trim().toLowerCase(), password = options.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 15 || Buffer.byteLength(password)>72) throw new Error('Configura ADMIN_EMAIL y ADMIN_PASSWORD seguros para el administrador inicial');
  db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run(email,bcrypt.hashSync(password,12),options.ADMIN_NAME || 'Administrador de migración');
  return true;
}
