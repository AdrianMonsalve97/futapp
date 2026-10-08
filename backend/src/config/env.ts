/**
 * Configuración de la aplicación (§3 del SPEC).
 * Se carga con `dotenv/config` al inicio de main.ts y de seed.ts.
 */
const production = process.env.NODE_ENV === 'production';
const publicAppUrl = process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL;
if (production && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('cambiame'))) {
  throw new Error('JWT_SECRET debe ser un secreto de al menos 32 caracteres en producción');
}

export const env = {
  production,
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN || publicAppUrl || 'http://localhost:5173',
  publicAppUrl,
  jwtSecret: process.env.JWT_SECRET ?? 'futbol-portal-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  dbPath: process.env.DB_PATH ?? './data/portal.db',
};
