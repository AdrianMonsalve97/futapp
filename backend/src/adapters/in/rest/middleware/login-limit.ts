import type { RequestHandler } from 'express';

/** Bounded, in-memory limiter; successful logins do not count as failures. */
export function loginLimit(): RequestHandler {
  const attempts = new Map<string, { failures: number; resetsAt: number }>();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.resetsAt <= now) attempts.delete(key);
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const entry = attempts.get(key) ?? { failures: 0, resetsAt: now + 15 * 60_000 };
    if (entry.failures >= 10) {
      res.setHeader('Retry-After', Math.ceil((entry.resetsAt - now) / 1000));
      res.status(429).json({ error: { message: 'Demasiados intentos. Intenta nuevamente en unos minutos.' } });
      return;
    }
    // Reserve before work so concurrent requests cannot bypass the limit.
    entry.failures++;
    if(attempts.size>=10_000&&!attempts.has(key)){res.status(429).json({error:{message:'Intenta nuevamente más tarde.'}});return;}
    attempts.set(key,entry);
    res.on('finish',()=>{if(res.statusCode<400)entry.failures=Math.max(0,entry.failures-1);});
    next();
  };
}

export function requestLimit(max:number,windowMs:number):RequestHandler {
  const counts=new Map<string,{count:number;until:number}>();
  return (req,res,next)=>{const now=Date.now();for(const [key,value] of counts)if(value.until<=now)counts.delete(key);
    const key=req.ip??req.socket.remoteAddress??'unknown',item=counts.get(key)??{count:0,until:now+windowMs};
    if(item.count>=max||(counts.size>=10000&&!counts.has(key))){res.setHeader('Retry-After',Math.ceil((item.until-now)/1000));res.status(429).json({error:{message:'Demasiadas solicitudes. Intenta nuevamente más tarde.'}});return;}
    item.count++;counts.set(key,item);next();};
}
