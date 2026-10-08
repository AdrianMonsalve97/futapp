import Database from 'better-sqlite3';
import { randomUUID, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import type { MigrationPort, MigrationPreview, MigrationStatus } from '../../../application/ports/in/migration.port';
import { ValidationError } from '../../../domain/errors';
import { FileMigrationStore, type MigrationPacket } from './migration-store';
import { migrate } from './migrate';
import { canonicalSchema } from './postgres-schema';
import type { PostgresDatabase } from './postgres-database';
import type { ObjectStorage } from './supabase-storage';

const transient=new Set(['auth_sessions','registration_invitation','notification_jobs','notification_match_versions','media_deletion_jobs']);
const counted=['users','players','tournaments','tournament_players','matches','inscriptions','payments','payment_receipts','media_assets'];
const counts=(packet:MigrationPacket)=>Object.fromEntries(counted.map(name=>[name,packet.tables[name].rows.length]));
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

export class PostgresMigrationStore implements MigrationPort {
  private schema=canonicalSchema();
  private pending?:{id:string;userId:number;packet:MigrationPacket;expires:number};
  private timer?:NodeJS.Timeout;
  private working=false;
  constructor(private db:PostgresDatabase,private objects:ObjectStorage,private publicUrl?:string){}
  async status():Promise<MigrationStatus>{
    const [state]=await this.db.query('SELECT enabled,imported_at FROM migration_state WHERE id=1');
    const [users]=await this.db.query("SELECT count(*) AS total,count(*) FILTER(WHERE role='admin' AND active=1) AS admins FROM users");
    const bootstrap=new Set(['users','team_settings','qr_payment_settings','notification_settings','migration_state',...transient]);
    const occupied=await this.db.query(this.schema.tables.filter(table=>!bootstrap.has(table.name)).map(table=>`SELECT count(*) AS total FROM "${table.name}"`).join(' UNION ALL '));
    const canImport=!state.imported_at&&users.total===1&&users.admins===1&&!occupied.some(row=>row.total>0);
    return {enabled:!!state.enabled,canImport,importedAt:state.imported_at,reason:canImport?'Instalación nueva lista para recibir los datos del equipo.':'Esta instalación ya tiene datos. La ingesta solo se permite en una instalación nueva con su administrador inicial.'};
  }
  async enable(enabled:boolean){
    if(typeof enabled!=='boolean'||this.working)throw new ValidationError('Indica un estado válido; no puede haber una migración en curso');
    if(enabled&&!(await this.status()).canImport)throw new ValidationError('La ingesta requiere una instalación nueva');
    await this.db.prepare('UPDATE migration_state SET enabled=? WHERE id=1').run(enabled?1:0);
    if(!enabled)this.clear();return this.status();
  }
  private clear(){this.pending=undefined;if(this.timer)clearTimeout(this.timer);this.timer=undefined;}
  private async allowed(){const status=await this.status();if(!status.canImport||!status.enabled)throw new ValidationError('Activa la ingesta en una instalación nueva antes de importar');}
  async preview(userId:number,file:Buffer):Promise<MigrationPreview>{
    if(this.working)throw new ValidationError('Hay una migración en curso');await this.allowed();
    const validatorDb=new Database(':memory:');let packet:MigrationPacket;
    try{migrate(validatorDb);packet=new FileMigrationStore(validatorDb,os.tmpdir()).validateForImport(file);}finally{validatorDb.close();}
    this.clear();const id=randomUUID(),expires=Date.now()+600000;
    this.pending={id,userId,packet,expires};this.timer=setTimeout(()=>this.clear(),600000);this.timer.unref();
    return {id,createdAt:packet.createdAt,counts:counts(packet),files:packet.files.length,expiresAt:new Date(expires).toISOString()};
  }
  async commit(userId:number,id:string,confirmation:string){
    const pending=this.pending;
    if(this.working||!pending||pending.id!==id||pending.userId!==userId||pending.expires<Date.now()||confirmation!=='IMPORTAR')throw new ValidationError('Previsualiza de nuevo el respaldo y escribe IMPORTAR');
    this.working=true;const uploaded:string[]=[],prefix='migration-'+randomUUID()+'-';
    try{
      await this.allowed();
      const media=pending.packet.tables.media_assets,ni=media.columns.indexOf('stored_name'),mi=media.columns.indexOf('mime_type');
      for(const file of pending.packet.files){
        const row=media.rows.find(row=>row[ni]===file.name)!;
        const key=prefix+file.name;await this.objects.put(key,Buffer.from(file.data,'base64'),String(row[mi]));uploaded.push(key);
        if(hash(await this.objects.get(key))!==file.sha256)throw new ValidationError('Un archivo no superó la comprobación después de subirlo');
      }
      const importedAt=new Date().toISOString();
      await this.db.transaction(async()=>{
        // Locks close the gap between eligibility checks and concurrent registrations/uploads.
        await this.db.execute(`LOCK TABLE ${this.schema.tables.map(table=>'"'+table.name+'"').join(',')} IN ACCESS EXCLUSIVE MODE`);
        await this.allowed();await this.db.execute('SET CONSTRAINTS ALL DEFERRED');
        for(const table of this.schema.tables)await this.db.execute(`DELETE FROM "${table.name}"`);
        for(const table of this.schema.tables){
          if(transient.has(table.name)||table.name==='migration_state')continue;
          const data=pending.packet.tables[table.name];
          for(const original of data.rows){
            const row=[...original];if(table.name==='media_assets')row[data.columns.indexOf('stored_name')]=prefix+row[data.columns.indexOf('stored_name')];
            await this.db.query(`INSERT INTO "${table.name}"(${data.columns.map(column=>'"'+column+'"').join(',')}) VALUES(${row.map((_,i)=>'$'+(i+1)).join(',')})`,row);
          }
          if(/AUTOINCREMENT/i.test(table.sql))await this.db.query(`SELECT setval(pg_get_serial_sequence('futapp.${table.name}','id'),COALESCE((SELECT max(id) FROM "${table.name}"),1),(SELECT count(*)>0 FROM "${table.name}"))`);
        }
        await this.db.prepare('INSERT INTO migration_state(id,enabled,imported_at) VALUES(1,0,?)').run(importedAt);
        const [notification]=await this.db.query('SELECT config FROM notification_settings WHERE id=1');
        const config=JSON.parse(notification.config);config.whatsappEnabled=false;config.emailEnabled=false;if(this.publicUrl)config.publicBaseUrl=this.publicUrl;
        await this.db.prepare('UPDATE notification_settings SET config=? WHERE id=1').run(JSON.stringify(config));
        await this.db.execute('DELETE FROM model_artifacts; SET CONSTRAINTS ALL IMMEDIATE');
        for(const [name,count] of Object.entries(counts(pending.packet))){const [row]=await this.db.query(`SELECT count(*) AS total FROM "${name}"`);if(row.total!==count)throw new ValidationError('Las cantidades importadas no coinciden');}
      })();
      this.clear();return {importedAt,counts:counts(pending.packet)};
    }catch(error){
      for(const key of uploaded)await this.objects.remove(key).catch(()=>console.error('Un archivo de una ingesta incompleta requiere limpieza en el bucket privado'));
      if(error instanceof ValidationError)throw error;
      throw new ValidationError('No se pudo completar la ingesta; la base anterior se conservó. Revisa la conexión y vuelve a exportar.');
    }finally{this.working=false;}
  }
  async exportData():Promise<Buffer>{
    return this.db.transaction(async()=>{
      await this.db.execute(`LOCK TABLE ${this.schema.tables.map(table=>'"'+table.name+'"').join(',')} IN SHARE MODE`);
      const tables:MigrationPacket['tables']={};
      for(const table of this.schema.tables){const rows=transient.has(table.name)?[]:await this.db.query(`SELECT ${table.columns.map(column=>'"'+column+'"').join(',')} FROM "${table.name}"`);tables[table.name]={columns:table.columns,rows:rows.map(row=>table.columns.map(column=>row[column]))};}
      const files:MigrationPacket['files']=[],media=tables.media_assets,ni=media.columns.indexOf('stored_name'),si=media.columns.indexOf('size');let bytes=0;
      for(const row of media.rows){const name=String(row[ni]),data=await this.objects.get(name);bytes+=data.length;if(data.length!==row[si]||bytes>32*1024*1024)throw new ValidationError('Archivos incompletos o respaldo demasiado grande para la ingesta');files.push({name,data:data.toString('base64'),sha256:hash(data)});}
      const packet:MigrationPacket={format:'futapp-migration',version:1,createdAt:new Date().toISOString(),tables,files};
      const json=Buffer.from(JSON.stringify(packet));if(json.length>64*1024*1024)throw new ValidationError('El respaldo supera el límite de ingesta');const file=gzipSync(json);if(file.length>25*1024*1024)throw new ValidationError('El respaldo supera 25 MB');return file;
    })();
  }
}
