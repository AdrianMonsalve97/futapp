import type { Request, RequestHandler } from 'express';
import { env } from '../../../../config/env';
import { SESSION_COOKIE } from './auth';
export function allowedOrigin(req:Request,origin:string):boolean {
  const origins=new Set([env.corsOrigin,env.publicAppUrl,...(env.production?[]:[`http://${req.get('host')}`]),`https://${req.get('host')}`]);
  return origins.has(origin);
}
export const browserSecurity:RequestHandler=(req,res,next)=>{
  res.setHeader('Cache-Control','no-store');
  if(['GET','HEAD','OPTIONS'].includes(req.method)){next();return;}
  const origin=req.get('origin'),cookie=req.get('cookie')?.includes(SESSION_COOKIE+'=');
  if((origin&&!allowedOrigin(req,origin))||((cookie||req.get('X-FutApp-Client')==='web')&&!origin)){
    res.status(403).json({error:{message:'Origen de solicitud no autorizado'}});return;
  }
  next();
};
