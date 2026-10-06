// Smoke test end-to-end de la API del portal (§11 + §12.8 del SPEC).
// Uso: node.exe scripts/smoke.mjs   (requiere el backend corriendo en :4000)
const BASE = process.env.API_URL ?? 'http://localhost:4000';
let pass = 0;
let fail = 0;
const PLAYERS = { 5: 5, 7: 7, 8: 8, 11: 11 };

async function req(method, path, { token, body, expect = 200 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* sin cuerpo */
  }
  const ok = res.status === expect;
  ok ? pass++ : fail++;
  console.log(
    `${ok ? '  OK ' : 'FAIL '} ${method} ${path} -> ${res.status}${
      ok ? '' : ` (esperado ${expect}) ${JSON.stringify(data)?.slice(0, 160)}`
    }`,
  );
  return { status: res.status, data };
}

async function login(email, password) {
  const r = await req('POST', '/api/auth/login', { body: { email, password }, expect: 200 });
  return r.data?.token;
}

async function main() {
  console.log(`\n== Smoke test contra ${BASE} (§11 + §12.8) ==\n`);

  // --- Auth y permisos (§11) ---
  const adminToken = await login('admin@club.com', 'Admin123!');
  const playerToken = await login('jugador01@club.com', 'Jugador123!');
  await req('POST', '/api/auth/login', { body: { email: 'admin@club.com', password: 'mala' }, expect: 401 });
  await req('GET', '/api/dashboard/admin', { expect: 401 });
  await req('GET', '/api/players', { token: playerToken, expect: 403 });

  // --- Rutas generales ---
  await req('GET', '/api/auth/me', { token: adminToken });
  await req('GET', '/api/dashboard/admin', { token: adminToken });
  await req('GET', '/api/dashboard/player', { token: playerToken });
  await req('GET', '/api/players', { token: adminToken });
  await req('GET', '/api/inscriptions', { token: adminToken });
  await req('GET', '/api/uniforms', { token: adminToken });
  await req('GET', '/api/uniform-requests', { token: adminToken });
  await req('GET', '/api/sanctions', { token: adminToken });
  await req('GET', '/api/matches', { token: adminToken });
  await req('GET', '/api/team/stats', { token: adminToken });
  await req('GET', '/api/me', { token: playerToken });
  await req('GET', '/api/me/inscription', { token: playerToken });
  await req('GET', '/api/me/uniforms', { token: playerToken });
  await req('GET', '/api/me/matches', { token: playerToken });
  await req('GET', '/api/me/stats', { token: playerToken });
  await req('GET', '/api/me/ai', { token: playerToken });

  // --- Formatos (§12.4 / §12.8) ---
  const settings = await req('GET', '/api/settings', { token: adminToken });
  const format = settings.data?.format;
  const playersOnPitch = settings.data?.profile?.playersOnPitch;
  const okFormat = format === 8 && playersOnPitch === 8;
  okFormat ? pass++ : fail++;
  console.log(`${okFormat ? '  OK ' : 'FAIL '} settings: formato=${format}, jugadores en cancha=${playersOnPitch}`);

  const cat = await req('GET', '/api/formations', { token: adminToken });
  const nFormats = cat.data?.formats?.length ?? 0;
  const nFormations = cat.data?.formations?.length ?? 0;
  const okCat = nFormats === 4 && nFormations === 14;
  okCat ? pass++ : fail++;
  console.log(`${okCat ? '  OK ' : 'FAIL '} catálogo: ${nFormats} formatos / ${nFormations} formaciones`);

  await req('PUT', '/api/settings', { token: adminToken, body: { format: 5 }, expect: 200 });
  const asF5 = await req('GET', '/api/settings', { token: adminToken });
  const okF5 = asF5.data?.format === 5 && asF5.data?.profile?.matchMinutes === 40;
  okF5 ? pass++ : fail++;
  console.log(`${okF5 ? '  OK ' : 'FAIL '} cambio a f5 -> minutos=${asF5.data?.profile?.matchMinutes}`);
  await req('PUT', '/api/settings', { token: adminToken, body: { format: 8 }, expect: 200 });
  await req('PUT', '/api/settings', { token: adminToken, body: { format: 9 }, expect: 400 });

  // --- IA (§12.5 / §12.8) ---
  await req('GET', '/api/ai/insights', { token: adminToken });
  await req('GET', '/api/ai/model', { token: adminToken });
  const trained = await req('POST', '/api/ai/model/train', { token: adminToken });
  const m = trained.data?.metrics ?? {};
  const okModel = typeof m.r2 === 'number' && m.r2 > 0.3;
  okModel ? pass++ : fail++;
  console.log(
    `${okModel ? '  OK ' : 'FAIL '} modelo: n=${m.samples} MAE=${m.mae} R²=${m.r2} (debe ser > 0.3)`,
  );

  const matches = await req('GET', '/api/matches', { token: adminToken });
  const nextMatch = (matches.data ?? []).find((x) => x.status === 'programado');
  if (nextMatch) {
    const fmt = nextMatch.format ?? 8;
    const expected = PLAYERS[fmt] ?? 11;
    const detail = await req('GET', `/api/matches/${nextMatch.id}`, { token: adminToken });
    const xi = await req('POST', '/api/ai/recommend-xi', {
      token: adminToken,
      body: { matchId: nextMatch.id, formation: nextMatch.formation },
    });
    const slots = xi.data?.lineup ?? [];
    const filled = slots.filter((s) => s.playerId != null).length;
    const okXI = slots.length === expected && filled === expected;
    okXI ? pass++ : fail++;
    console.log(
      `${okXI ? '  OK ' : 'FAIL '} XI sugerido (f${fmt}): ${slots.length} slots, ${filled} ocupados (esperado ${expected})`,
    );

    const insight = await req('GET', '/api/ai/insights', { token: adminToken });
    const p = insight.data?.nextMatchPrediction;
    if (p) {
      const sum = p.winProbability + p.drawProbability + p.loseProbability;
      const okP = Math.abs(sum - 1) < 0.005;
      okP ? pass++ : fail++;
      console.log(
        `${okP ? '  OK ' : 'FAIL '} suma de probabilidades = ${sum.toFixed(4)} ` +
          `(V ${p.winProbability.toFixed(2)} / E ${p.drawProbability.toFixed(2)} / D ${p.loseProbability.toFixed(2)})`,
      );
      const xg = p.projectedGoalsFor;
      const fmtXg = fmt === 11 ? xg <= 5 : xg >= 2 && xg <= 14;
      fmtXg ? pass++ : fail++;
      console.log(`${fmtXg ? '  OK ' : 'FAIL '} goles proyectados a favor: ${xg} (escala f${fmt})`);
    }

    // Validaciones de formato (§12.8)
    await req('PUT', `/api/matches/${nextMatch.id}/formation`, {
      token: adminToken,
      body: { formation: '4-3-3' },
      expect: 400,
    });
    const elevenSlots = Array.from({ length: 11 }, (_, i) => ({
      slotIndex: i, playerId: null, x: 50, y: 50, role: 'MED', label: 'MC',
    }));
    await req('PUT', `/api/matches/${nextMatch.id}/lineup`, {
      token: adminToken,
      body: { slots: elevenSlots },
      expect: 400,
    });
    await req('POST', `/api/matches/${nextMatch.id}/stats`, {
      token: adminToken,
      body: { entries: [{ playerId: 1, minutes: 90, rating: 7 }] },
      expect: 400,
    });
    void detail;
  }

  console.log(`\n== Resultado: ${pass} OK, ${fail} FAIL ==\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nNo se pudo contactar al backend. ¿Está corriendo en :4000?\n', err.message);
  process.exit(2);
});
