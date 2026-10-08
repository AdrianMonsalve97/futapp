import { Router } from 'express';
import type { AuthPort, LoginInput, RegisterInput } from '../../../../application/ports/in/auth.port';
import { getAuth, requireAuth, requireRole, requestToken, SESSION_COOKIE, clearSessionCookie } from '../middleware/auth';
import type { Request, Response } from 'express';
import type { AuthPayload } from '../../../../domain/entities';
import { env } from '../../../../config/env';
import { jsonBody } from '../route-helpers';

/** §7.1 · Autenticación (público salvo `/auth/me`). */
export function authRoutes(auth: AuthPort): Router {
  const router = Router();
  const respond=(req:Request,res:Response,payload:AuthPayload)=>{
    if(req.get('X-FutApp-Client')!=='web'){res.json(payload);return;}
    res.cookie(SESSION_COOKIE,payload.token,{httpOnly:true,secure:env.production||req.get('origin')?.startsWith('https://'),sameSite:'strict',path:'/',maxAge:8*3600000});
    const {token:_token,...safe}=payload;res.json(safe);
  };

  router.post('/auth/login', async (req, res) => {
    const body = jsonBody<Partial<LoginInput>>(req);
    respond(req,res,
      (await auth.login({
                email: String(body.email ?? ''),
                password: String(body.password ?? ''),
              })),
    );
  });

  router.post('/auth/register', async (req, res) => {
    const body = jsonBody<Partial<RegisterInput>>(req);
    res.json(
      (await auth.register({
                email: String(body.email ?? ''),
                password: String(body.password ?? ''),
                fullName: String(body.fullName ?? ''),
                phone: body.phone ?? null,
                position: body.position,
                shirtNumber: body.shirtNumber ?? null,
                invitationCode:body.invitationCode,
              })),
    );
  });

  router.post('/auth/logout',async (req,res)=>{const body=jsonBody<{sessionKey?:string}>(req);const token=requestToken(req);const matched=token?await auth.logout(token,body.sessionKey):true;if(matched)clearSessionCookie(req,res);res.json({ok:true});});
  router.post('/auth/activity',requireAuth,async(req,res)=>{jsonBody(req);res.json(await auth.activity(requestToken(req)!));});
  router.post('/auth/invitation',requireAuth,requireRole('admin'),async (req,res)=>{jsonBody(req);res.json((await auth.createInvitation()));});

  router.get('/auth/me', requireAuth, async (req, res) => {
    res.json({...await auth.me(getAuth(req).userId),session:getAuth(req).session});
  });

  return router;
}
