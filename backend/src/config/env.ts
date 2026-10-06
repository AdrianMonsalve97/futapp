/**
 * Configuración de la aplicación (§3 del SPEC).
 * Se carga con `dotenv/config` al inicio de main.ts y de seed.ts.
 */
export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET ?? 'futbol-portal-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  dbPath: process.env.DB_PATH ?? './data/portal.db',
};
