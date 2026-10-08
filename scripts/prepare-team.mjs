import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

/** Always backs up the current database and files before replacing operational demo data. */
export async function prepareTeam({dbPath,email,name,credentialsPath,apply=false}){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name.trim())throw new Error('Correo y nombre del administrador inválidos');
  const db=new Database(dbPath,{fileMustExist:true});db.pragma('foreign_keys = ON');
  try {
    const counts={};for(const table of ['users','players','matches','inscriptions','payments','payment_receipts','uniform_issues','uniform_requests'])counts[table]=db.prepare('SELECT COUNT(*) n FROM '+table).get().n;
    if(!apply)return {preview:true,counts};
    const directory=path.dirname(dbPath),backup=path.join(directory,'backups','inicio-equipo-'+new Date().toISOString().replace(/[:.]/g,'-'));
    await fs.mkdir(backup,{recursive:true});await db.backup(path.join(backup,'portal.db'));
    for(const entry of ['uploads','model.json'])try{await fs.cp(path.join(directory,entry),path.join(backup,entry),{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
    const password='FutApp-'+randomBytes(18).toString('base64url');const hash=bcrypt.hashSync(password,12);
    await fs.mkdir(path.dirname(credentialsPath),{recursive:true});
    // Fail rather than overwrite a previously delivered credential file.
    await fs.writeFile(credentialsPath,`Administrador inicial de FutApp\nCorreo: ${email}\nContraseña: ${password}\n\nCámbiala en Configuración → Cambiar mi contraseña.\nRespaldo previo: ${backup}\n`,{flag:'wx',mode:0o600});
    db.transaction(()=>{
      const id=Number(db.prepare("INSERT INTO users(email,password_hash,full_name,role,active) VALUES(?,?,?,'admin',1)").run(email.toLowerCase(),hash,name.trim()).lastInsertRowid);
      for(const table of ['notification_jobs','notification_match_versions','notification_preferences','payment_receipts','uniform_requests','uniform_issues','payments','inscriptions','sanctions','match_stats','lineups','published_lineups','match_attendance','strategies','matches','players','auth_sessions','registration_invitation'])db.prepare('DELETE FROM '+table).run();
      db.prepare("DELETE FROM media_assets WHERE purpose IN ('avatar','receipt')").run();
      db.prepare('UPDATE media_assets SET owner_id=?').run(id);
      db.prepare('DELETE FROM users WHERE id<>?').run(id);
      db.prepare('UPDATE uniforms SET stock=0').run();
      const row=db.prepare('SELECT config FROM notification_settings WHERE id=1').get();
      const config={...JSON.parse(row.config),whatsappEnabled:false,emailEnabled:false,adminWhatsapp:'',adminEmail:'',matchGroupId:'',matchGroupName:''};
      db.prepare('UPDATE notification_settings SET config=? WHERE id=1').run(JSON.stringify(config));
      if(db.pragma('foreign_key_check').length)throw new Error('La limpieza no pudo preservar las referencias');
    }).immediate();
    // Remove old learned demo results; the model rebuilds from actual team statistics.
    try{await fs.unlink(path.join(directory,'model.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
    return {preview:false,counts,backup,credentialsPath,email,players:0,matches:0};
  }finally{db.close();}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');dotenv.config({path:path.join(root,'backend/.env'),quiet:true});
  const email=process.env.TEAM_ADMIN_EMAIL??'admin@futapp.local',name=process.env.TEAM_ADMIN_NAME??'Administrador Alergicos del gol';
  const result=await prepareTeam({dbPath:path.resolve(root,'backend',process.env.DB_PATH??'data/portal.db'),email,name,credentialsPath:path.join(root,'.local','admin-inicial.txt'),apply:process.argv.includes('--apply')});
  console.log(JSON.stringify(result,null,2));
}
