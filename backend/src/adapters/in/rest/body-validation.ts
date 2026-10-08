import { ValidationError } from '../../../domain/errors';

type Rule = (value: unknown) => boolean;
type Shape = Record<string, Rule>;
const text = (max = 200): Rule => v => typeof v === 'string' && v.length <= max;
const nonempty = (max = 200): Rule => v => text(max)(v) && Boolean((v as string).trim());
const number = (min = 0, max = 1e12): Rule => v => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const integer = (min = 0, max = 1e9): Rule => v => number(min, max)(v) && Number.isInteger(v);
const oneOf = (...values: unknown[]): Rule => v => values.includes(v);
const nullable = (rule: Rule): Rule => v => v === null || rule(v);
const boolean: Rule = v => typeof v === 'boolean';
const position = oneOf('POR', 'DEF', 'MED', 'DEL');
const money: Rule = v => number()(v) && Math.abs((v as number) * 100 - Math.round((v as number) * 100)) < 0.00001;
const date: Rule = v => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const dateTime: Rule = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v) && date(v.slice(0, 10)) && Number(v.slice(11, 13)) < 24 && Number(v.slice(14, 16)) < 60 && (!v.slice(17) || Number(v.slice(17)) < 60);

function check(value: unknown, shape: Shape, required: string[] = []): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('Se esperaba un objeto JSON');
  const body = value as Record<string, unknown>;
  for (const key of required) if (!(key in body)) throw new ValidationError(`El campo ${key} es obligatorio`);
  for (const [key, item] of Object.entries(body)) {
    if (!shape[key]) throw new ValidationError(`Campo no permitido: ${key}`);
    if (!shape[key](item)) throw new ValidationError(`Valor inválido para ${key}`);
  }
}

const profile: Shape = {
  phone: nullable(text(40)), dni: nullable(text(40)), birthDate: nullable(date), position,
  secondaryPosition: nullable(position), shirtNumber: nullable(integer(0, 999)),
  heightCm: nullable(integer(50, 250)), weightKg: nullable(integer(20, 300)),
  foot: nullable(oneOf('izq', 'der', 'ambos')), emergencyContact: nullable(text(200)),
  eps: nullable(text(120)), prepaidHealth: nullable(text(120)),
};
const credentials: Shape = { email: nonempty(254), password: nonempty(128), fullName: nonempty(120) };
const match: Shape = {
  streamUrl:nullable(text(500)),
  tournamentId: nullable(integer(1)),
  opponent: nonempty(120), competition: nonempty(120), kickOff: dateTime, venue: nullable(text(200)),
  isHome: boolean, formation: nonempty(40), format: oneOf(5, 7, 8, 11), minutes: integer(1, 400),
  status: oneOf('programado', 'jugado', 'cancelado', 'pospuesto'),
  goalsFor: nullable(integer(0, 100)), goalsAgainst: nullable(integer(0, 100)), notes: nullable(text(5000)),
};
const inscription: Shape = { playerId: integer(1), season: nonempty(40), concept: nonempty(200), amount: money, dueDate: nullable(date), notes: nullable(text(5000)) };
const uniform: Shape = { name: nonempty(120), kind: oneOf('camiseta', 'pantalon', 'medias', 'buzo', 'entrenamiento', 'guantes'), variant: oneOf('titular', 'alterna', 'entrenamiento'), price: money, stock: integer(), minStock: integer(), active: boolean };
const condition = oneOf('nuevo', 'bueno', 'regular', 'danado');
const strategy: Shape = { title: nonempty(120), kind: oneOf('general', 'ataque', 'defensa', 'pelota_parada', 'transicion'), content: nonempty(5000) };
const stats: Shape = {
  matchId: integer(1),
  playerId: integer(1), minutes: integer(0, 400), goals: integer(0, 100), assists: integer(0, 100),
  shots: integer(), shotsOnTarget: integer(), passes: integer(), passesCompleted: integer(), tackles: integer(),
  interceptions: integer(), recoveries: integer(), dribbles: integer(), fouls: integer(),
  yellowCards: integer(0, 2), redCards: integer(0, 1), rating: number(1, 10),
};

/** Runtime validation before a body reaches a use case. Unknown fields are rejected. */
export function validateBody(path: string, method: string, body: unknown): void {
  const create = method === 'POST';
  if (/^\/tournaments\/\d+\/players$/.test(path)) return check(body, { playerIds: v =>
    Array.isArray(v) && v.length > 0 && v.length <= 100 && v.every(integer(1)) && new Set(v).size === v.length }, ['playerIds']);
  if (path === '/notifications/settings') {
    const shape: Shape = {whatsappEnabled:boolean,emailEnabled:boolean,matchAnnouncements:boolean,reminder24h:boolean,reminder2h:boolean,paymentAlerts:boolean,
      adminWhatsapp:text(20),adminEmail:text(254),publicBaseUrl:text(500),matchTemplate:nonempty(100),paymentTemplate:nonempty(100),templateLanguage:nonempty(10),
      whatsappProvider:oneOf('meta','evolution'),matchDestination:oneOf('players','group'),matchGroupId:text(60),matchGroupName:text(200)};
    return check(body,shape,Object.keys(shape).filter(key=>!['whatsappProvider','matchDestination','matchGroupId','matchGroupName'].includes(key)));
  }
  if (path === '/me/notifications') {
    const shape: Shape = {whatsapp:boolean,email:boolean,whatsappNumber:text(20),matchAlerts:boolean,paymentUpdates:boolean};
    return check(body,shape,Object.keys(shape));
  }
  if (path === '/notifications/test') return check(body,{channel:oneOf('whatsapp','email')},['channel']);
  if(path==='/notifications/test-group'||path==='/notifications/whatsapp/connect')return check(body,{});
  if (/^\/notifications\/\d+\/retry$/.test(path) || /^\/matches\/\d+\/notify$/.test(path)) return check(body,{});
  if (path === '/me/payment-receipts') return check(body, { kind: oneOf('inscription','uniform_request','uniform_issue','referee'), targetId: integer(1), amount: money, reference: nonempty(120), paidAt: typeof body==='object'&&body!==null&&'kind' in body&&body.kind==='referee'?text(40):date }, ['kind','targetId','amount','reference','paidAt']);
  if (/^\/payment-receipts\/\d+\/review$/.test(path)) return check(body, {status:oneOf('aprobado','rechazado'),notes:text(2000)},['status','notes']);
  if (path === '/settings/payment-qr') return check(body, {recipient:nonempty(120),paymentKey:nonempty(120)},['recipient','paymentKey']);
  if (path === '/auth/login') return check(body, { email: credentials.email, password: credentials.password }, ['email', 'password']);
  if (path === '/auth/register') return check(body, { ...credentials, invitationCode:nonempty(100),phone: profile.phone, position, shirtNumber: profile.shirtNumber }, ['email', 'password', 'fullName']);
  if(path==='/auth/invitation'||path==='/auth/logout')return check(body,{});
  if (path === '/me/profile') return check(body, profile);
  if (path === '/me/password') return check(body, { currentPassword: nonempty(128), newPassword: nonempty(128) }, ['currentPassword', 'newPassword']);
  if (/^\/players(\/\d+)?$/.test(path)) return check(body, create ? { ...profile, ...credentials } : { ...profile, fullName: credentials.fullName, role: oneOf('admin', 'player'), active: boolean }, create ? ['email', 'password', 'fullName'] : []);
  if (/^\/matches(\/\d+)?$/.test(path)) return check(body, match, create ? ['opponent', 'kickOff'] : []);
  if (path.endsWith('/formation')) return check(body, { formation: match.formation }, ['formation']);
  if (path.endsWith('/lineup/auto')) return check(body, { formation: match.formation });
  if (path.endsWith('/lineup')) return check(body, { slots: v => {
    if (!Array.isArray(v) || v.length > 11) return false;
    for (const slot of v) check(slot, { slotIndex: integer(0, 10), playerId: nullable(integer(1)), x: number(0, 100), y: number(0, 100), role: position, label: text(30) }, ['slotIndex', 'playerId']);
    return true;
  } }, ['slots']);
  if (path.endsWith('/stats')) return check(body, { entries: v => {
    if (!Array.isArray(v) || v.length > 100) return false;
    for (const entry of v) check(entry, stats, ['playerId']);
    return true;
  } }, ['entries']);
  if (/\/strategies(\/\d+)?$/.test(path)) return check(body, strategy, create ? ['title', 'content'] : []);
  if (path.endsWith('/payments')) return check(body, { amount: money, method: oneOf('efectivo', 'transferencia', 'qr', 'tarjeta'), reference: nullable(text(200)), paidAt: date, notes: nullable(text(5000)) }, ['amount', 'method']);
  if (/^\/inscriptions(\/\d+)?$/.test(path)) {
    const { playerId: _player, ...update } = inscription;
    return check(body, create ? inscription : update, create ? ['playerId', 'season', 'amount'] : []);
  }
  if (/^\/uniforms(\/\d+)?$/.test(path)) return check(body, uniform, create ? ['name'] : []);
  if (/^\/uniform-issues(\/\d+)?$/.test(path)) return check(body, create ? { playerId: integer(1), uniformId: integer(1), size: nonempty(20), cost: money, condition, notes: nullable(text(5000)) } : { returned: boolean, condition, notes: nullable(text(5000)) }, create ? ['playerId', 'uniformId'] : []);
  if (path === '/me/uniform-requests') return check(body, { uniformId: integer(1), size: nonempty(20), reason: nullable(text(5000)) }, ['uniformId', 'size']);
  if (/^\/uniform-requests\/\d+$/.test(path)) return check(body, { status: oneOf('pendiente', 'aprobada', 'rechazada', 'entregada'), reviewNotes: nullable(text(5000)) }, ['status']);
  if (/^\/sanctions(\/\d+)?$/.test(path)) return check(body, { playerId: integer(1), matchId: nullable(integer(1)), type: oneOf('tarjeta_amarilla', 'tarjeta_roja', 'suspension', 'multa', 'amonestacion'), reason: nonempty(5000), amount: money, points: integer(), status: oneOf('activa', 'cumplida', 'anulada'), matchDate: nullable(date) }, create ? ['playerId', 'reason'] : []);
  if (path === '/settings') return check(body, { brandColor: v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v), defaultTournamentId: nullable(integer(1)), teamName: nonempty(80), season: nonempty(40), format: oneOf(5, 7, 8, 11) });
  if (/^\/tournaments(\/\d+)?$/.test(path)) return check(body, { name: nonempty(120), leagueName: nonempty(120), season: nonempty(40), notes: text(20000), status: oneOf('borrador', 'publicado', 'archivado'), rules: v => {
    const rules: Shape = { format: oneOf(5,7,8,11), periods: integer(1,4), minutesPerPeriod: integer(1,400), breakMinutes: nullable(integer(0,60)), maxSquad: nullable(integer(5,50)), maxSubstitutions: nullable(integer(0,50)), rollingSubstitutions: nullable(boolean), tacticalStyle: oneOf('equilibrado','ofensivo','defensivo'), allowedFormations: a => Array.isArray(a) && a.length > 0 && a.length <= 14 && a.every(nonempty(40)) };
    check(v, rules, Object.keys(rules)); return true;
  } }, ['name','leagueName','season','notes','status','rules']);
  if (path === '/ai/recommend-xi') return check(body, { matchId: integer(1), formation: nonempty(40) }, ['matchId']);
  if (path === '/ai/tactical-plan') return check(body, {matchId:integer(1),style:oneOf('equilibrado','ofensivo','defensivo'),formation:nonempty(40)},['matchId']);
  if (path === '/ai/research') return check(body, {matchId:integer(1),style:oneOf('equilibrado','ofensivo','defensivo')},['matchId']);
  if (path.endsWith('/attendance')) return check(body, { status: oneOf('confirmado', 'no_disponible', 'pendiente') }, ['status']);
  if (path.endsWith('/lineup/publish')) return check(body, {});
}
