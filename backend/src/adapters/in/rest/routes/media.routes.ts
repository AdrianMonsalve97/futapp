import { Router, type Response } from 'express';
import multer from 'multer';
import type { MediaService } from '../../../../application/services/media-service';
import type { MediaAsset } from '../../../../application/ports/out/media.storage';
import { ValidationError } from '../../../../domain/errors';
import { getAuth, requireAuth, requireRole } from '../middleware/auth';
import { paramId } from '../route-helpers';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1, fields: 1, parts: 2, fieldSize: 500 } }).single('file');
function sendAsset(res: Response, media: MediaService, asset: MediaAsset) {
  res.setHeader('Content-Type', asset.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  if (asset.purpose === 'tournament' || asset.purpose === 'receipt') res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`);
  res.sendFile(media.filePath(asset));
}
export function brandingRoutes(media: MediaService): Router {
  const router = Router();
  router.get('/branding', (_req, res) => res.json(media.branding()));
  router.get('/branding/logo', (_req, res) => sendAsset(res, media, media.publicLogo()));
  return router;
}
export function mediaRoutes(media: MediaService): Router {
  const router = Router();
  router.get('/media/:assetId', requireAuth, (req, res) => {
    const auth = getAuth(req); sendAsset(res, media, media.read(String(req.params.assetId), auth.userId, auth.role === 'admin'));
  });
  for (const [route, purpose] of [['/settings/logo', 'logo'], ['/me/avatar', 'avatar'], ['/uniforms/:id/image', 'uniform'], ['/tournaments/:id/image', 'tournament_image'], ['/tournaments/:id/documents', 'tournament']] as const) {
    const guards = purpose === 'avatar' ? [requireAuth] : [requireAuth, requireRole('admin')];
    router.post(route, ...guards, (req, res, next) => {
      upload(req, res, async error => {
        try {
          if (error) throw new ValidationError('Carga inválida. Selecciona un solo archivo de hasta 12 MB');
          if (!req.file) throw new ValidationError('Selecciona un archivo');
          if (Object.keys(req.body ?? {}).some(key => purpose !== 'tournament' || key !== 'title')) throw new ValidationError('Campo de carga no permitido');
          res.json(await media.upload(getAuth(req).userId, purpose, purpose === 'uniform' || purpose === 'tournament' || purpose === 'tournament_image' ? paramId(req) : null,
            req.file.originalname, req.file.buffer, req.body?.title));
        } catch (err) { next(err); }
      });
    });
    if (purpose !== 'tournament') router.delete(route, ...guards, (req, res) => res.json(media.clear(getAuth(req).userId, purpose, purpose === 'uniform' || purpose === 'tournament_image' ? paramId(req) : undefined)));
  }
  return router;
}
