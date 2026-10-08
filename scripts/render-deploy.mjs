import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function createRenderClient({ apiKey, serviceId, request = fetch }) {
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
    if (value.type !== 'web_service' || value.repo?.replace(/\.git$/,'').toLowerCase() !== 'https://github.com/adrianmonsalve97/futapp' || value.branch !== 'main' || value.rootDir || details?.runtime !== 'node' || details?.numInstances !== 1 || details?.plan === 'free' || details?.disk?.mountPath !== '/var/data') throw new Error('El servicio debe ser futapp/main, Node, una instancia y un disco persistente en /var/data. Créalo desde render.yaml.');
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
      const password = existing.get('ADMIN_PASSWORD') || randomBytes(24).toString('base64url');
      mask(jwt); mask(password);
      if (jwt.length < 32 || jwt.includes('cambiame') || password.length < 15 || Buffer.byteLength(password)>72) throw new Error('Los secretos existentes no cumplen los requisitos. Corrígelos en Render.');
      const variables = {
        NODE_VERSION:'24.19.0',NODE_ENV:'production',TZ:'America/Bogota',DB_PATH:'/var/data/portal.db',
        JWT_EXPIRES_IN:'8h',JWT_SECRET:jwt,BOOTSTRAP_ADMIN:'1',
        ADMIN_EMAIL:existing.get('ADMIN_EMAIL') || 'admin@futapp.local',ADMIN_NAME:existing.get('ADMIN_NAME') || 'Administrador de migración',ADMIN_PASSWORD:password,
        PUBLIC_APP_URL:target.url,CORS_ORIGIN:target.url,
      };
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
    const client = createRenderClient({apiKey:process.env.RENDER_API_KEY,serviceId:process.env.RENDER_SERVICE_ID});
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
