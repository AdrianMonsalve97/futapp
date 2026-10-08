import { Router } from 'express';
import type { NotificationService } from '../../../../application/services/notification-service';
import type { NotificationSettings, NotificationPreferences, NotificationChannel } from '../../../../domain/notifications';
import { requireAuth, requireRole, getAuth } from '../middleware/auth';
import { jsonBody, paramId } from '../route-helpers';
export function notificationRoutes(service: NotificationService) {
  const router=Router();
  router.get('/notifications',requireAuth,requireRole('admin'),(_req,res)=>res.json(service.view()));
  router.put('/notifications/settings',requireAuth,requireRole('admin'),async(req,res)=>res.json(await service.configureVerified(jsonBody<NotificationSettings>(req))));
  router.get('/notifications/whatsapp/groups',requireAuth,requireRole('admin'),async(_req,res)=>{res.set('Cache-Control','no-store');res.json(await service.groups());});
  router.get('/notifications/whatsapp/connection',requireAuth,requireRole('admin'),async(_req,res)=>{res.set('Cache-Control','no-store');res.json(await service.connection());});
  router.post('/notifications/whatsapp/connect',requireAuth,requireRole('admin'),async(req,res)=>{jsonBody(req);res.set('Cache-Control','no-store');res.json(await service.connect());});
  router.post('/notifications/test-group',requireAuth,requireRole('admin'),(req,res)=>{jsonBody(req);res.json(service.testGroup());});
  router.post('/notifications/test',requireAuth,requireRole('admin'),(req,res)=>res.json(service.test(jsonBody<{channel:NotificationChannel}>(req).channel)));
  router.post('/notifications/:id/retry',requireAuth,requireRole('admin'),(req,res)=>{jsonBody(req);res.json(service.retry(paramId(req)));});
  router.post('/matches/:id/notify',requireAuth,requireRole('admin'),(req,res)=>{jsonBody(req);res.json(service.notifyMatch(paramId(req)));});
  router.get('/me/notifications',requireAuth,(req,res)=>res.json(service.preferences(getAuth(req).userId)));
  router.put('/me/notifications',requireAuth,(req,res)=>res.json(service.savePreferences(getAuth(req).userId,jsonBody<NotificationPreferences>(req))));
  return router;
}
