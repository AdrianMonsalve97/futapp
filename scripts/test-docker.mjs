import { spawnSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
const prefix=`futapp-ci-${randomUUID()}`, image=process.env.FUTAPP_TEST_IMAGE || 'futapp:ci';
const sourceName=prefix+'-source',destinationName=prefix+'-destination';
const volumes=[sourceName],containers=[sourceName];
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'futapp-docker-ci-')),dataDir=path.join(temporary,'data'),envFile=path.join(temporary,'docker.env');
fs.mkdirSync(dataDir);
const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
const password='Isolated docker migration passphrase 123!',initialPassword='Different initial account passphrase 456!';
fs.writeFileSync(envFile,`FUTAPP_IMAGE=${image}\nFUTAPP_DATA_DIR='${dataDir.replaceAll('\\','/')}'\nFUTAPP_UID=${process.getuid?.()??1000}\nFUTAPP_GID=${process.getgid?.()??1000}\nFUTAPP_PORT=${port}\nJWT_SECRET=${randomBytes(48).toString('base64url')}\nADMIN_PASSWORD=${initialPassword}\nADMIN_EMAIL=initial@docker.test\nPUBLIC_APP_URL=http://localhost:${port}\n`,{flag:'wx',mode:0o600});
function docker(...args){const result=spawnSync('docker',args,{encoding:'utf8',windowsHide:true});if(result.status!==0)throw new Error(`Docker ${args[0]} falló: ${result.stderr}`);return result.stdout.trim();}
const compose=(...args)=>docker('compose','--env-file',envFile,'-p',destinationName,...args);
function run(name,email,pass){
  docker('run','-d','--name',name,'--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--tmpfs','/tmp:rw,nosuid,nodev,size=128m,mode=1777',
    '-p','127.0.0.1::4000','-v',`${name}:/var/lib/futapp`,'-e',`JWT_SECRET=${randomBytes(48).toString('base64url')}`,'-e','BOOTSTRAP_ADMIN=1','-e',`ADMIN_EMAIL=${email}`,'-e',`ADMIN_PASSWORD=${pass}`,image);
  const bindings=JSON.parse(docker('inspect','--format','{{json .NetworkSettings.Ports}}',name));return `http://127.0.0.1:${bindings['4000/tcp'][0].HostPort}`;
}
async function ready(base){for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw new Error('El contenedor no arrancó');}
async function request(base,path,{method='GET',json,token,body}={}){
  const res=await fetch(base+'/api'+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(json?{'Content-Type':'application/json'}:{})},...(json?{body:JSON.stringify(json)}:body?{body}:{})});
  assert.equal(res.status,200,await res.clone().text());return res;
}
async function login(base,email,pass){return (await (await request(base,'/auth/login',{method:'POST',json:{email,password:pass}})).json()).token;}
try{
  const generatedConfig=path.join(temporary,'generated.env'),generatedData=path.join(temporary,'generated-data');
  const initialize=()=>{
    const result=spawnSync('sh',['scripts/docker-init.sh'],{encoding:'utf8',env:{...process.env,FUTAPP_ENV_FILE:generatedConfig,FUTAPP_DATA_DIR:generatedData}});
    assert.equal(result.status,0,result.stderr);
  };
  initialize();
  const originalConfig=fs.readFileSync(generatedConfig,'utf8');
  assert.match(originalConfig,/^JWT_SECRET=[A-Za-z0-9_-]{64}$/m);
  assert.match(originalConfig,/^ADMIN_PASSWORD=[A-Za-z0-9_-]{32}$/m);
  assert.equal(fs.statSync(generatedConfig).mode & 0o777,0o600);
  assert(fs.statSync(generatedData).isDirectory());
  initialize();assert.equal(fs.readFileSync(generatedConfig,'utf8'),originalConfig);
  for(const volume of volumes)docker('volume','create',volume);
  const source=run(sourceName,'source@docker.test',password),destination=`http://127.0.0.1:${port}`;
  compose('config','--quiet');compose('up','-d','--no-build','app');
  await Promise.all([ready(source),ready(destination)]);
  assert((await (await fetch(destination+'/admin/configuracion')).text()).includes('id="root"'));
  const token=await login(source,'source@docker.test',password),initialToken=await login(destination,'initial@docker.test',initialPassword);
  const player=await (await request(source,'/players',{method:'POST',token,json:{email:'player@docker.test',password,fullName:'Arquero de prueba',position:'POR',shirtNumber:5,eps:'EPS de prueba',prepaidHealth:'Plan de prueba'}})).json();
  const tournament=await (await request(source,'/tournaments',{method:'POST',token,json:{name:'Copa de prueba',leagueName:'Liga de pruebas',season:'2026',status:'publicado',notes:'',rules:{format:8,periods:2,minutesPerPeriod:25,breakMinutes:5,maxSquad:22,maxSubstitutions:null,rollingSubstitutions:true,allowedFormations:['1-3-3-1'],tacticalStyle:'equilibrado'}}})).json();
  await request(source,`/tournaments/${tournament.id}/players`,{method:'POST',token,json:{playerIds:[player.player.id]}});
  const form=new FormData();form.append('file',new Blob(['Reglamento de prueba: 2 tiempos de 25 minutos.']),'normativa.txt');
  await request(source,`/tournaments/${tournament.id}/documents`,{method:'POST',token,body:form});
  const packet=await (await request(source,'/migration/export',{token})).arrayBuffer();
  await request(destination,'/migration',{method:'PUT',token:initialToken,json:{enabled:true}});
  const file=new FormData();file.append('file',new Blob([packet]),'snapshot.futapp');
  const preview=await (await request(destination,'/migration/preview',{method:'POST',token:initialToken,body:file})).json();
  assert.equal(preview.counts.users,2);assert.equal(preview.counts.players,1);assert.equal(preview.counts.tournament_players,1);assert.equal(preview.files,1);
  await request(destination,'/migration/import',{method:'POST',token:initialToken,json:{id:preview.id,confirmation:'IMPORTAR'}});
  assert.equal((await fetch(destination+'/api/migration',{headers:{Authorization:`Bearer ${initialToken}`}})).status,401);
  compose('down');compose('up','-d','--no-build','app');
  const recreated=destination;await ready(recreated);
  const importedToken=await login(recreated,'source@docker.test',password);
  const players=await (await request(recreated,'/players',{token:importedToken})).json();assert.equal(players.length,1);
  const detail=await (await request(recreated,`/players/${player.player.id}`,{token:importedToken})).json();assert.equal(detail.player.eps,'EPS de prueba');
  const roster=await (await request(recreated,`/tournaments/${tournament.id}/players`,{token:importedToken})).json();assert.equal(roster.players.length,1);
  const media=await (await request(recreated,'/tournaments/'+tournament.id,{token:importedToken})).json();
  const asset=media.documents[0];assert(asset);const content=await request(recreated,`/media/${asset.assetId}`,{token:importedToken});assert.equal(await content.text(),'Reglamento de prueba: 2 tiempos de 25 minutos.');
  assert.equal((await (await request(recreated,'/migration',{token:importedToken})).json()).canImport,false);
  assert(fs.existsSync(path.join(dataDir,'portal.db')));assert(fs.readdirSync(path.join(dataDir,'uploads')).length===1);
  compose('stop','app');compose('run','--rm','--no-deps','app','node','../scripts/backup.mjs');compose('up','-d','--no-build','app');await ready(recreated);
  assert(fs.readdirSync(path.join(dataDir,'backups')).some(name=>fs.existsSync(path.join(dataDir,'backups',name,'uploads'))));
  console.log('Docker verificado: configuración privada persistente, React, ingesta, cuentas y contraseñas, salud, torneo F8, plantilla, documentos, respaldo y persistencia al recrear el contenedor.');
}finally{
  spawnSync('docker',['compose','--env-file',envFile,'-p',destinationName,'down'],{stdio:'ignore',windowsHide:true});
  for(const name of containers){assert(name.startsWith('futapp-ci-'));spawnSync('docker',['rm','-f',name],{stdio:'ignore',windowsHide:true});}
  for(const name of volumes){assert(name.startsWith('futapp-ci-'));spawnSync('docker',['volume','rm',name],{stdio:'ignore',windowsHide:true});}
  assert.equal(path.dirname(temporary),os.tmpdir());fs.rmSync(temporary,{recursive:true,force:true});
}
