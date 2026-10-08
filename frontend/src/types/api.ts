// Espejo EXACTO de docs/SPEC.md §5 (domain/entities.ts).
// Si algo cambia en el SPEC, cambia acá: el frontend consume estos tipos tal cual.

export type Role = 'admin' | 'player';
export type Position = 'POR' | 'DEF' | 'MED' | 'DEL';
export type Foot = 'izq' | 'der' | 'ambos';
export type InscriptionStatus = 'pendiente' | 'parcial' | 'pagada';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'qr' | 'tarjeta';
export type UniformKind = 'camiseta' | 'pantalon' | 'medias' | 'buzo' | 'entrenamiento' | 'guantes';
export type UniformVariant = 'titular' | 'alterna' | 'entrenamiento';
export type UniformCondition = 'nuevo' | 'bueno' | 'regular' | 'danado';
export type UniformRequestStatus = 'pendiente' | 'aprobada' | 'rechazada' | 'entregada';
export type MatchStatus = 'programado' | 'jugado' | 'cancelado' | 'pospuesto';
export type StrategyKind = 'general' | 'ataque' | 'defensa' | 'pelota_parada' | 'transicion';
export type SanctionType = 'tarjeta_amarilla' | 'tarjeta_roja' | 'suspension' | 'multa' | 'amonestacion';
export type SanctionStatus = 'activa' | 'cumplida' | 'anulada';
/** §12.1 — formato de juego del equipo/partido. */
export type TeamFormat = 5 | 7 | 8 | 11;

export interface User {
  id: number; email: string; fullName: string; phone: string | null;
  avatarUrl: string | null; role: Role; active: boolean; createdAt: string;
}
export interface Player {
  id: number; userId: number; dni: string | null; birthDate: string | null;
  position: Position; secondaryPosition: Position | null; shirtNumber: number | null;
  heightCm: number | null; weightKg: number | null; foot: Foot | null;
  emergencyContact: string | null; eps: string | null; prepaidHealth: string | null; joinedAt: string;
}
export interface RegistrationPayload { user: User; player: Player | null; pendingApproval: true; message: string }
export interface AuthPayload { token: string; user: User; player: Player | null; }

export interface Payment {
  registeredBy?: number | null;
  registeredByName?: string | null;
  id: number; inscriptionId: number; amount: number; method: PaymentMethod;
  reference: string | null; paidAt: string; notes: string | null;
}
export interface Inscription {
  id: number; playerId: number; playerName?: string; season: string; concept: string;
  amount: number; paid: number; status: InscriptionStatus;
  dueDate: string | null; notes: string | null; createdAt: string;
  payments?: Payment[];
}
export interface Uniform {
  imageUrl?: string | null;
  id: number; name: string; kind: UniformKind; variant: UniformVariant;
  price: number; stock: number; minStock: number; active: boolean; issuedCount?: number;
}
export interface UniformIssue {
  id: number; playerId: number; playerName?: string; uniformId: number;
  uniformName?: string; kind?: UniformKind; variant?: UniformVariant;
  size: string; cost: number; condition: UniformCondition; returned: boolean;
  notes: string | null; issuedAt: string;
}
export interface UniformRequest {
  quotedPrice?: number | null;
  issueId?: number | null;
  id: number; playerId: number; playerName?: string; uniformId: number;
  uniformName?: string; size: string; reason: string | null;
  status: UniformRequestStatus; reviewNotes: string | null;
  createdAt: string; reviewedAt: string | null;
}
/** §12.1 — perfil de formato (fuente única de verdad, espejo del backend). */
export interface FormatProfile {
  format: TeamFormat; key: 'f5' | 'f7' | 'f8' | 'f11'; name: string;
  playersOnPitch: number; matchMinutes: number;
  defaultFormation: string; squadHint: string;
  ai: {
    baselineFor: number; baselineAgainst: number; xgClampMax: number;
    winProbK: number; drawLogWeight: number; homeBonus: number; minSamples: number;
  };
}
/** §12.2 — formaciones (catálogo por formato, coordenadas en % de la cancha). */
export type FormationRole = 'POR' | 'DEF' | 'MED' | 'DEL';
export interface FormationSlot {
  slotIndex: number; x: number; y: number; role: FormationRole; label: string;
}
export interface FormationDef { key: string; name: string; format: TeamFormat; slots: FormationSlot[] }
export interface Match {
  streamUrl?:string|null;
  tournamentId?: number | null;
  tournamentRules?: import('./tournament').TournamentSnapshot | null;
  lineupPublishedAt?: string | null;
  publishedFormation?: string | null;
  id: number; opponent: string; competition: string; kickOff: string; venue: string | null;
  isHome: boolean; status: MatchStatus; formation: string;
  format: TeamFormat;   // §12.4 — formato del partido (puede sobreescribir el global)
  minutes: number;      // §12.4 — duración efectiva del partido
  goalsFor: number | null; goalsAgainst: number | null; notes: string | null; createdAt: string;
}
export type AttendanceStatus = 'pendiente' | 'confirmado' | 'no_disponible';
export interface MatchAttendance {
  starterEligible?: boolean; benchEligible?: boolean; referee?: import('./referee').RefereePaymentRow & {dueAt:string};
  playerId: number; playerName: string; shirtNumber: number | null;
  position: Position; status: AttendanceStatus; updatedAt: string | null;
  eligible: boolean; reason: string | null;
}
export interface Strategy {
  id: number; matchId: number; title: string; kind: StrategyKind; content: string; createdAt: string;
}
export interface LineupSlot {
  slotIndex: number; playerId: number | null; playerName?: string | null;
  shirtNumber?: number | null; playerPosition?: Position | null; avatarUrl?: string | null;
  x: number; y: number; role: 'POR' | 'DEF' | 'MED' | 'DEL'; label: string;
}
export interface MatchStat {
  id?: number; matchId: number; playerId: number; playerName?: string; shirtNumber?: number | null;
  position?: Position; minutes: number; goals: number; assists: number; shots: number;
  shotsOnTarget: number; passes: number; passesCompleted: number; tackles: number;
  interceptions: number; recoveries: number; dribbles: number; fouls: number;
  yellowCards: number; redCards: number; rating: number;
}
export interface Sanction {
  id: number; playerId: number; playerName?: string; matchId: number | null;
  type: SanctionType; reason: string; amount: number; points: number;
  status: SanctionStatus; matchDate: string | null; createdAt: string;
}
export interface StatsSummary {
  appearances: number; minutes: number; goals: number; assists: number; shots: number;
  shotsOnTarget: number; passes: number; passesCompleted: number; tackles: number;
  interceptions: number; recoveries: number; dribbles: number; fouls: number;
  yellowCards: number; redCards: number; avgRating: number;
}
export interface PlayerListItem {
  pendingApproval?: boolean;
  user: User; player: Player;
  inscription: { season: string; status: InscriptionStatus; amount: number; paid: number; dueDate: string | null } | null;
  stats: StatsSummary;
  activeSanctions: number;
}
export interface TeamStats {
  topScorers: { playerId: number; playerName: string; shirtNumber: number | null; value: number }[];
  topAssists: { playerId: number; playerName: string; shirtNumber: number | null; value: number }[];
  topRated:   { playerId: number; playerName: string; shirtNumber: number | null; value: number }[];
  byPosition: { position: Position; count: number; avgRating: number }[];
  teamAverages: StatsSummary;
}
export interface ModelInfo {
  validation?: { samples: number; mae: number; rmse: number; r2: number; method: string };
  featuresDescription?: string;
  model: string;                     // 'regresion-lineal-gradiente-descendente'
  features: string[];                // nombres de features
  weights: number[];                 // w0 + w1..wn
  metrics: { samples: number; mae: number; rmse: number; r2: number };
  trainedAt: string;
}
export interface AiPlayerInsight {
  avatarUrl?: string | null;
  preparation:{matchId:number|null;opponent:string|null;format:TeamFormat;minutes:number;formation:string;publishedAt:string|null;lineup:LineupSlot[];role:Position;assignment:'titular'|'sin_publicar'|'fuera_inicial'|'sin_partido';style:'equilibrado'|'ofensivo'|'defensivo';individual:{title:string;detail:string}[];team:string[];training:string[];plays:import('./tactics').TacticalPlay[];metricNote:string};
  leagueContext?: import('./tournament').LeagueContext;
  playerId: number; playerName: string; position: Position;
  forecast: { nextRating: number; confidence: number; trend: 'sube' | 'estable' | 'baja'; history: { matchId: number; opponent: string; rating: number }[] };
  strengths: { label: string; detail: string }[];
  weaknesses: { label: string; detail: string }[];
  recommendation: string;
}
export interface AiInsights {
  leagueContext?: import('./tournament').LeagueContext;
  model: ModelInfo;
  teamRating: number;
  format: TeamFormat;                     // §12.4 — formato usado por la IA (vista de plantel)
  formTrend: { matchId: number; opponent: string; rating: number; result: string }[];
  nextMatchPrediction: {
    matchId: number; opponent: string; kickOff: string; format: TeamFormat;
    winProbability: number; drawProbability: number; loseProbability: number;
    projectedGoalsFor: number; projectedGoalsAgainst: number; teamRating: number; opponentRating: number;
  } | null;
  topPlayers: { playerId: number; playerName: string; shirtNumber: number | null; predictedRating: number; avgRating: number }[];
  insights: { level: 'positivo' | 'alerta' | 'info'; title: string; message: string }[];
  recommendedXI: { formation: string; slots: LineupSlot[]; explanation: string };
}
export interface DashboardAdmin {
  playersCount: number; activePlayers: number;
  inscriptions: { season: string; total: number; collected: number; pending: number; paidCount: number; pendingCount: number };
  nextMatch: Match | null; recentSanctions: Sanction[];
  pendingUniformRequests: number; lowStockUniforms: Uniform[];
  teamStats: TeamStats; pendingInscriptionPlayers: { playerId: number; playerName: string; amount: number; paid: number; dueDate: string | null }[];
}
export interface DashboardPlayer {
  inscription: Inscription | null;
  upcomingMatch: (Match & { lineupSlot: LineupSlot | null; lineup: LineupSlot[] }) | null;
  myStats: StatsSummary;
  myRecentStats: MatchStat[];
  mySanctions: Sanction[];
  uniforms: { issued: UniformIssue[]; pendingRequests: number };
  forecast: { nextRating: number; confidence: number; trend: string } | null;
}

// ---------------------------------------------------------------------------
// Envolventes de respuestas del contrato API (§7). Auxiliares, no forman parte
// de §5 pero se derivan literalmente de las tablas de respuesta de ese capítulo.
// ---------------------------------------------------------------------------

/** §7.2 — vista de partido vista desde el jugador. */
export type MatchView = Match & { mySlot: LineupSlot | null; strategiesCount: number; lineupFilled: number };
/** §7.1 — `GET /api/auth/me`. */
export interface AuthMeResponse { user: User; player: Player | null }
/** §7.2 — `GET /api/me`. */
export interface MeResponse {
  user: User; player: Player | null; stats: StatsSummary;
  inscription: Inscription | null; sanctions: Sanction[]; issuedUniforms: UniformIssue[];
  pendingRequests: number;
  forecast: { nextRating: number; confidence: number; trend: string } | null;
}
/** §7.2 — `PUT /api/me/profile`. */
export interface UserPlayerResponse { user: User; player: Player | null }
/** §7.3 — `GET /api/matches/:id`. */
export interface MatchDetailResponse { match: Match; strategies: Strategy[]; lineup: LineupSlot[]; stats: MatchStat[] }
/** §7.3 — respuestas con lineup. */
export interface LineupResponse { lineup: LineupSlot[] }
export interface MatchWithLineupResponse { match: Match; lineup: LineupSlot[] }
export interface AutoLineupResponse { lineup: LineupSlot[]; explanation: string; formation?: string; leagueContext?: import('./tournament').LeagueContext; bench?: { playerId: number; playerName: string; position: string; predictedRating: number }[] }
export interface StatsEntriesResponse { entries: MatchStat[] }
/** §7.4 — `GET /api/players/:id` y alta/edición. */
export interface PlayerDetailResponse {
  user: User; player: Player;
  inscriptions: Inscription[]; uniformIssues: UniformIssue[]; sanctions: Sanction[];
  stats: MatchStat[]; summary: StatsSummary; ai: AiPlayerInsight;
}
/** §7.5/7.6/7.7 — responses con envoltorio. */
export interface InscriptionResponse { inscription: Inscription }
export interface UniformResponse { uniform: Uniform }
export interface UniformIssueResponse { issue: UniformIssue }
export interface UniformRequestResponse { request: UniformRequest }
export interface SanctionResponse { sanction: Sanction }
/** §7.2 — respuestas "yo". */
export interface MeInscriptionResponse { inscription: Inscription | null; payments: Payment[] }
export interface MeUniformsResponse { issued: UniformIssue[]; requests: UniformRequest[]; catalog: Uniform[] }
export interface MeMatchesResponse { upcoming: MatchView[]; finished: MatchView[] }
export interface MeStatsResponse { summary: StatsSummary; matches: MatchStat[] }
export interface UniformRequestCreatedResponse { request: UniformRequest }
/** Genéricas. */
export interface OkResponse { ok: true }
export interface PasswordResponse { ok: true }
/** §12.4 — `GET/PUT /api/settings`. */
export interface TeamSettings {
  logoUrl?: string | null; brandColor?: string; defaultTournamentId?: number | null;
  teamName: string; format: TeamFormat; season: string; profile: FormatProfile;
}
/** §12.4 — body de `PUT /api/settings` (todos los campos opcionales). */
export interface TeamSettingsPayload { brandColor?: string; defaultTournamentId?: number | null; teamName?: string; format?: TeamFormat; season?: string }
/** §12.4 — `GET /api/formations` (catálogo completo; el front filtra por formato). */
export interface FormationsResponse { formats: FormatProfile[]; formations: FormationDef[] }
/** §7.10 — IA. */
export interface RecommendXiResponse { formation?: string; lineup: LineupSlot[]; explanation: string }
/** Cuerpo de error del contrato (§7). */
export interface ApiErrorBody { error?: { message?: string; code?: string } }
