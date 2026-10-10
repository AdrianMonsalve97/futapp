import bcrypt from 'bcryptjs';
import { env } from '../../../config/env';
import { createPostgresDatabase } from './postgres-database';
import { migratePostgres } from './postgres-schema';
import { CloudMediaStorage, SupabaseObjectStorage } from './supabase-storage';
import { PostgresModelStore } from './postgres-model-store';
import { PostgresMigrationStore } from './postgres-migration-store';
import {validatePassword} from '../../../domain/password-policy';

export async function initializeCloudPersistence(){
  const db=createPostgresDatabase(env.databaseUrl!);
  try{
    await migratePostgres(db);
    const objects=new SupabaseObjectStorage(env.supabaseUrl!,env.supabaseSecretKey!,env.supabaseBucket);
    await objects.initialize();
    await db.transaction(async()=>{
      const [users]=await db.query('SELECT count(*) AS total FROM users');
      if(process.env.BOOTSTRAP_ADMIN!=='1'||users.total)return;
      const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(),password=process.env.ADMIN_PASSWORD;
      if(!email||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!password)throw new Error('Configura las credenciales seguras del administrador inicial');
      validatePassword(password);
      await db.prepare("INSERT INTO users(email,password_hash,full_name,role) VALUES(?,?,?,'admin')").run(email,bcrypt.hashSync(password,12),process.env.ADMIN_NAME||'Administrador de migración');
    })();
    return {db,media:new CloudMediaStorage(db,objects),model:new PostgresModelStore(db),migration:new PostgresMigrationStore(db,objects,env.publicAppUrl)};
  }catch(error){await db.close();throw error;}
}
