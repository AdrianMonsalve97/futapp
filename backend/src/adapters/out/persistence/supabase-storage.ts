import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { MediaAsset, MediaPurpose, MediaStorage } from '../../../application/ports/out/media.storage';
import type { ApplicationDatabase } from './async-database';
import { normalizeMedia } from './normalize-media';

export interface ObjectStorage {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
export class SupabaseObjectStorage implements ObjectStorage {
  private client: SupabaseClient;
  constructor(url: string, serverKey: string, private bucket = 'futapp-media', request:typeof fetch = fetch) {
    if (!/^https:\/\/[a-z0-9.-]+\.supabase\.co$/.test(url) || !serverKey || !/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket)) throw new Error('Configura SUPABASE_URL, SUPABASE_SECRET_KEY y un bucket privado válido');
    this.client = createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>request(url,{...options,signal:options?.signal?AbortSignal.any([options.signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)})}});
  }
  async initialize() {
    const result = await this.client.storage.getBucket(this.bucket);
    if (result.error) {
      if (String(result.error.statusCode)!=='404') throw new Error('No se pudo consultar el bucket privado de FutApp');
      const created = await this.client.storage.createBucket(this.bucket,{public:false,fileSizeLimit:12*1024*1024});
      if(created.error)throw new Error('No se pudo crear el bucket privado de FutApp');
    } else if(result.data.public)throw new Error('El bucket de FutApp debe ser privado antes de iniciar la aplicación');
  }
  private key(key:string) { if(!/^[A-Za-z0-9_.-]+$/.test(key)||key==='.'||key==='..')throw new Error('Nombre de archivo inválido');return key; }
  async put(key:string,data:Buffer,mimeType:string) {
    const result=await this.client.storage.from(this.bucket).upload(this.key(key),data,{contentType:mimeType,upsert:false,cacheControl:'0'});
    if(result.error)throw new Error('No se pudo guardar el archivo en el almacenamiento privado');
  }
  async get(key:string):Promise<Buffer> {
    const result=await this.client.storage.from(this.bucket).download(this.key(key));
    if(result.error)throw new Error('No se pudo recuperar el archivo privado');
    return Buffer.from(await result.data.arrayBuffer());
  }
  async remove(key:string) {
    const result=await this.client.storage.from(this.bucket).remove([this.key(key)]);
    if(result.error)throw new Error('No se pudo eliminar el archivo privado');
  }
}

export class CloudMediaStorage implements MediaStorage {
  constructor(private db:ApplicationDatabase,private objects:ObjectStorage){}
  async find(id:string):Promise<MediaAsset|null>{return await this.db.prepare(`SELECT id,owner_id AS ownerId,purpose,file_name AS fileName,stored_name AS storedName,mime_type AS mimeType,size,extracted_text AS extractedText FROM media_assets WHERE id=?`).get(id)??null;}
  content(asset:MediaAsset):Promise<Buffer>{return this.objects.get(asset.storedName);}
  async store(ownerId:number,purpose:MediaPurpose,name:string,data:Uint8Array):Promise<MediaAsset>{
    const normalized=await normalizeMedia(purpose,name,data),id=randomUUID();
    const asset:MediaAsset={id,ownerId,purpose,fileName:normalized.fileName,storedName:id+normalized.extension,mimeType:normalized.mimeType,size:normalized.bytes.length,extractedText:normalized.extractedText};
    await this.objects.put(asset.storedName,normalized.bytes,asset.mimeType);
    try{await this.db.prepare(`INSERT INTO media_assets(id,owner_id,purpose,file_name,stored_name,mime_type,size,extracted_text) VALUES(@id,@ownerId,@purpose,@fileName,@storedName,@mimeType,@size,@extractedText)`).run(asset);}
    catch(error){await this.objects.remove(asset.storedName).catch(()=>console.error('Un archivo huérfano requiere limpieza en el bucket privado'));throw error;}
    return asset;
  }
  async discard(asset:MediaAsset){await this.db.prepare('DELETE FROM media_assets WHERE id=?').run(asset.id);await this.objects.remove(asset.storedName);}
}
