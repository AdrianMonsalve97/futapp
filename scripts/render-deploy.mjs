import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import passwordRules from '../backend/src/domain/password-rules.json' with {type:'json'};

export function createRenderClient({ apiKey, serviceId, request = fetch, cloud = {} }) {
  if (!apiKey || !/^srv-[a-z0-9]+$/.test(serviceId ?? '')) throw new Error('Configura RENDER_API_KEY como secreto y RENDER_SERVICE_ID como variable de GitHub Actions');
  const mask = value => { if (process.env.GITHUB_ACTIONS === 'true') process.stdout.write(`::add-mask::${String(value).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')}\n`); };
  mask(apiKey);
  async function api(route, method='GET', body) {
    const res = await request(`https://api.render.com/v1/services/${serviceId}${route}`, { method,
      headers: { Authorization:`Bearer ${apiKey}`, Accept:'application/json', ...(body ? {'Content-Type':'application/json'} : {}) },
      ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`Render rechazó ${method} (${res.status}). Revisa el servicio y los permisos de la API Key.`);
    return res.status === 204 ? null : res.json();
  }
  async function service() {
    const value = await api('');
    const details = value.serviceDetails;
    if (value.type !== 'web_service' || value.repo?.replace(/\.git$/,'').toLowerCase() !== 'https://github.com/adrianmonsalve97/futapp' || value.branch !== 'main' || value.rootDir || details?.runtime !== 'node' || details?.numInstances !== 1 || details?.plan !== 'free' || details?.disk) throw new Error('El servicio debe ser futapp/main, Node, una instancia Free y sin disco de pago. Créalo desde render.yaml.');
    const url = new URL(details.url);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.onrender.com') || url.username || url.password) throw new Error('URL de Render no válida');
    return { ...value, url:url.origin };
  }
  return {
    async configure() {
      const target = await service(), existing = new Map();
      let cursor = '', previous = '';
      for (let page=0; page<100; page++) {
        const result = await api(`/env-vars?limit=100${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`);
        if (!Array.isArray(result)) throw new Error('Respuesta de variables no válida');
        for (const item of result) { mask(item.envVar.value);existing.set(item.envVar.key,item.envVar.value); }
        if (result.length < 100) break;
        cursor=result.at(-1)?.cursor;
        if (!cursor || cursor === previous) throw new Error('No se pudieron leer todas las variables de Render');
        previous=cursor;
        if (page===99) throw new Error('Demasiadas variables de entorno');
      }
      const jwt = existing.get('JWT_SECRET') || randomBytes(48).toString('base64url');
      const password = existing.get('ADMIN_PASSWORD') || 'Aa1!'+randomBytes(24).toString('base64url');
      mask(jwt); mask(password);
      if (jwt.length < 32 || jwt.includes('cambiame') || password.length < passwordRules.minLength || Buffer.byteLength(password)>passwordRules.maxBytes) throw new Error('Los secretos existentes no cumplen los requisitos. Corrígelos en Render.');
      const databaseUrl=cloud.databaseUrl || existing.get('DATABASE_URL'),supabaseUrl=cloud.supabaseUrl || existing.get('SUPABASE_URL'),serverKey=cloud.serverKey || existing.get('SUPABASE_SECRET_KEY') || existing.get('SUPABASE_SERVICE_ROLE_KEY');
      if(!databaseUrl||!supabaseUrl||!serverKey)throw new Error('Configura DATABASE_URL, SUPABASE_URL y SUPABASE_SECRET_KEY como secretos de GitHub Actions');
      let database,storage;
      try{database=new URL(databaseUrl);storage=new URL(supabaseUrl);}catch{throw new Error('Revisa las conexiones privadas de Supabase');}
      if(!['postgres:','postgresql:'].includes(database.protocol)||!database.hostname.endsWith('.pooler.supabase.com')||database.port!=='5432'||!database.username||!database.password||storage.protocol!=='https:'||!storage.hostname.endsWith('.supabase.co')||storage.pathname!=='/'||storage.search||storage.hash)throw new Error('Usa Session pooler de Supabase (5432) y la URL HTTPS del proyecto');
      let serviceRole=false;
      try{serviceRole=JSON.parse(Buffer.from(serverKey.split('.')[1]||'','base64url').toString()).role==='service_role';}catch{}
      if(!serverKey.startsWith('sb_secret_')&&!serviceRole)throw new Error('Usa una clave secreta del servidor; nunca una clave publishable');
      mask(databaseUrl);mask(supabaseUrl);mask(serverKey);
      const variables = {
        NODE_VERSION:'24.19.0',NODE_ENV:'production',TZ:'America/Bogota',DB_DRIVER:'postgres',
        DATABASE_URL:databaseUrl,SUPABASE_URL:storage.origin,SUPABASE_SECRET_KEY:serverKey,SUPABASE_STORAGE_BUCKET:cloud.bucket||existing.get('SUPABASE_STORAGE_BUCKET')||'futapp-media',
        JWT_EXPIRES_IN:'8h',JWT_SECRET:jwt,BOOTSTRAP_ADMIN:'1',
        ADMIN_EMAIL:existing.get('ADMIN_EMAIL') || 'admin@futapp.local',ADMIN_NAME:existing.get('ADMIN_NAME') || 'Administrador de migración',ADMIN_PASSWORD:password,
        PUBLIC_APP_URL:target.url,CORS_ORIGIN:target.url,
      };
      const brevoApiKey=cloud.brevoApiKey||existing.get('BREVO_API_KEY'),mailFrom=cloud.mailFrom||existing.get('MAIL_FROM');
      if(brevoApiKey||mailFrom){
        if(!brevoApiKey||!mailFrom||!/^\S+@[^\s@]+\.[^\s@]+$/.test(mailFrom))throw new Error('Configura BREVO_API_KEY y MAIL_FROM verificado para habilitar la recuperación por correo');
        mask(brevoApiKey);variables.BREVO_API_KEY=brevoApiKey;variables.MAIL_FROM=mailFrom;variables.MAIL_FROM_NAME=cloud.mailFromName||existing.get('MAIL_FROM_NAME')||'FutApp';
      }
      if(cloud.ca||existing.get('SUPABASE_DB_CA'))variables.SUPABASE_DB_CA=cloud.ca||existing.get('SUPABASE_DB_CA');
      if(variables.SUPABASE_DB_CA)mask(variables.SUPABASE_DB_CA);
      // Delete obsolete local persistence and SSL bypass settings before switching to the cloud.
      for(const key of ['DB_PATH','PG_SSL'])if(existing.has(key))await api(`/env-vars/${key}`,'DELETE');
      // Individual PUT preserves unrelated provider variables. Secrets persist across deployments.
      for (const [key,value] of Object.entries(variables)) if (existing.get(key)!==value) await api(`/env-vars/${key}`,'PUT',{value});
      if (target.autoDeployTrigger !== 'off') await api('','PATCH',{autoDeployTrigger:'off'});
      return { url:target.url, variables:Object.keys(variables) };
    },
    async deploy(commit, { sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)), attempts=90 }={}) {
      if (!/^[a-f0-9]{40}$/.test(commit ?? '')) throw new Error('El despliegue requiere el SHA completo validado por GitHub Actions');
      const target = await service();
      if (target.autoDeployTrigger !== 'off') throw new Error('Ejecuta primero la tarea de variables para desactivar el despliegue automático de Render');
      const deploy = await api('/deploys','POST',{commitId:commit,clearCache:'do_not_clear'});
      if (!/^dep-[a-z0-9]+$/.test(deploy?.id ?? '')) throw new Error('Render no confirmó el despliegue');
      const failed = new Set(['build_failed','update_failed','pre_deploy_failed','canceled','deactivated']);
      for (let i=0;i<attempts;i++) {
        const current = await api(`/deploys/${deploy.id}`);
        if (failed.has(current.status)) throw new Error(`Despliegue ${current.status}. Consulta los logs en Render.`);
        if (current.status === 'live') {
          if (current.commit?.id !== commit) throw new Error('Render publicó un commit diferente al validado');
          const health = await request(`${target.url}/api/health`,{signal:AbortSignal.timeout(30000)});
          if (!health.ok || (await health.json()).status !== 'ok') throw new Error('El servicio publicado no superó la comprobación de salud');
          return { url:target.url, commit, deployId:deploy.id };
        }
        await sleep(10000);
      }
      throw new Error('Render sigue desplegando. Revisa su estado antes de volver a ejecutar el workflow.');
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const client = createRenderClient({apiKey:process.env.RENDER_API_KEY,serviceId:process.env.RENDER_SERVICE_ID,cloud:{databaseUrl:process.env.DATABASE_URL,supabaseUrl:process.env.SUPABASE_URL,serverKey:process.env.SUPABASE_SECRET_KEY,ca:process.env.SUPABASE_DB_CA,brevoApiKey:process.env.BREVO_API_KEY,mailFrom:process.env.MAIL_FROM,mailFromName:process.env.MAIL_FROM_NAME}});
    const mode = process.argv[2];
    if (!['configure','deploy'].includes(mode)) throw new Error('Usa configure o deploy');
    const result = mode==='configure' ? await client.configure() : await client.deploy(process.env.GITHUB_SHA);
    console.log(mode==='configure'?'Variables configuradas; secretos conservados.':'Despliegue y salud verificados.');
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`\n${mode==='configure'?'Variables configuradas':'Despliegue verificado'}: [FutApp](${result.url})${result.commit?` · commit \`${result.commit}\``:''}\n`);
  } catch(error) {
    // Never log provider bodies, request headers or error objects that can contain credentials.
    console.error(error instanceof Error && !['TypeError','AbortError','TimeoutError'].includes(error.name) ? error.message : 'No se pudo completar la conexión con Render');
    process.exitCode=1;
  }
}
