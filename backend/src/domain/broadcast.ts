import { ValidationError } from './errors';
export function broadcastUrl(value:string|null):string|null {
  if(!value?.trim())return null;
  try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port||!['youtube.com','www.youtube.com','youtu.be'].includes(url.hostname))throw new Error();
    const id=url.hostname==='youtu.be'?url.pathname.slice(1):url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:live|embed)\/([^/]+)$/)?.[1];
    if(!id||!/^[a-zA-Z0-9_-]{11}$/.test(id))throw new Error();return `https://www.youtube.com/watch?v=${id}`;
  }catch{throw new ValidationError('Indica un enlace HTTPS válido de YouTube Live o deja el campo vacío.');}
}
