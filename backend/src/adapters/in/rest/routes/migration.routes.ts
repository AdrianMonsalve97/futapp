import { Router } from 'express';
import multer from 'multer';
import type { MigrationPort } from '../../../../application/ports/in/migration.port';
import { ValidationError } from '../../../../domain/errors';
import { getAuth, requireAuth, requireRole } from '../middleware/auth';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25*1024*1024, files:1, fields:0, parts:1 } }).single('file');
export function migrationRoutes(migration: MigrationPort) {
  const router = Router();
  router.use('/migration', requireAuth, requireRole('admin'), (_req,res,next) => { res.setHeader('Cache-Control','private, no-store'); next(); });
  router.get('/migration', (_req,res) => res.json(migration.status()));
  router.put('/migration', (req,res) => {
    if (!req.body || Object.keys(req.body).join() !== 'enabled') throw new ValidationError('Indica enabled');
    res.json(migration.enable(req.body.enabled));
  });
  router.get('/migration/export', async (_req,res) => {
    const file = await migration.exportData();
    res.setHeader('Content-Type','application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="futapp-${new Date().toISOString().slice(0,10)}.futapp"`);
    res.send(file);
  });
  router.post('/migration/preview', (req,res,next) => upload(req,res,async err => {
    try {
      if (err || !req.file) throw new ValidationError('Selecciona un archivo .futapp de hasta 25 MB');
      res.json(await migration.preview(getAuth(req).userId,req.file.buffer));
    } catch(error) { next(error); }
  }));
  router.post('/migration/import', async (req,res) => {
    if (!req.body || typeof req.body.id !== 'string' || typeof req.body.confirmation !== 'string' || Object.keys(req.body).some(k => !['id','confirmation'].includes(k))) throw new ValidationError('Confirmación inválida');
    res.json(await migration.commit(getAuth(req).userId,req.body.id,req.body.confirmation));
  });
  return router;
}
