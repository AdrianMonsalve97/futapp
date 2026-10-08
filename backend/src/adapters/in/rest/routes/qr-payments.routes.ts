import { Router } from 'express';
import multer from 'multer';
import type { QrPaymentService } from '../../../../application/services/qr-payment-service';
import type { PaymentTargetKind } from '../../../../domain/payments';
import { ValidationError } from '../../../../domain/errors';
import { requireAuth, requireRole, getAuth } from '../middleware/auth';
import { jsonBody, paramId } from '../route-helpers';
import { validateBody } from '../body-validation';
const upload = multer({ storage: multer.memoryStorage(), limits: {fileSize:8*1024*1024,files:1,fields:5,parts:6,fieldSize:300} }).single('file');

export function qrPaymentRoutes(service: QrPaymentService): Router {
  const router = Router();
  router.get('/me/payment-receipts',requireAuth,(req,res) => res.json(service.view(getAuth(req).userId,false)));
  router.get('/payment-receipts',requireAuth,requireRole('admin'),(req,res) => res.json(service.view(getAuth(req).userId,true)));
  router.put('/payment-receipts/:id/review',requireAuth,requireRole('admin'),(req,res) => {
    const body = jsonBody<{status:'aprobado'|'rechazado';notes:string}>(req);
    res.json(service.review(paramId(req),getAuth(req).userId,body.status,body.notes));
  });
  for (const route of ['/me/payment-receipts','/settings/payment-qr']) {
    const guards = route.includes('/settings') ? [requireAuth,requireRole('admin')] : [requireAuth];
    router.post(route,...guards,(req,res,next) => upload(req,res,async error => {
      try {
        if (error || !req.file) throw new ValidationError('Selecciona un archivo de hasta 8 MB');
        if (route.includes('/settings')) {
          validateBody('/settings/payment-qr','POST',req.body);
          res.json(await service.setQr(getAuth(req).userId,req.body.recipient,req.body.paymentKey,req.file.originalname,req.file.buffer));
        } else {
          const body = { ...req.body, targetId:Number(req.body.targetId), amount:Number(req.body.amount) };
          validateBody('/me/payment-receipts','POST',body);
          res.json(await service.submit(getAuth(req).userId,{ ...body, kind:body.kind as PaymentTargetKind,
            idempotencyKey:String(req.headers['idempotency-key']??'') },req.file.originalname,req.file.buffer));
        }
      } catch(err) { next(err); }
    }));
  }
  return router;
}
