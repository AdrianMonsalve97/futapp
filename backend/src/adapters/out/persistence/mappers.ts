/**
 * Mappers: fila de SQLite → entidad en camelCase con booleanos (§2 del SPEC).
 */
import type {
  Foot,
  Inscription,
  InscriptionStatus,
  LineupSlot,
  Match,
  MatchStat,
  MatchStatus,
  Payment,
  PaymentMethod,
  Player,
  Position,
  Role,
  Sanction,
  SanctionStatus,
  SanctionType,
  Strategy,
  StrategyKind,
  Uniform,
  UniformCondition,
  UniformIssue,
  UniformKind,
  UniformRequest,
  UniformRequestStatus,
  UniformVariant,
  User,
} from '../../../domain/entities';
import { getFormat, toTeamFormat } from '../../../domain/formats';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  active: number;
  created_at: string;
}

export interface PlayerRow {
  id: number;
  user_id: number;
  dni: string | null;
  birth_date: string | null;
  position: string;
  secondary_position: string | null;
  shirt_number: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  foot: string | null;
  emergency_contact: string | null;
  eps: string | null;
  prepaid_health: string | null;
  joined_at: string;
}

export interface InscriptionRow {
  id: number;
  player_id: number;
  season: string;
  concept: string;
  amount: number;
  paid: number;
  due_date: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  player_name?: string | null;
}

export interface PaymentRow {
  registered_by?: number | null;
  registered_by_name?: string | null;
  id: number;
  inscription_id: number;
  amount: number;
  method: string;
  reference: string | null;
  paid_at: string;
  notes: string | null;
}

export interface UniformRow {
  image_url?: string | null;
  id: number;
  name: string;
  kind: string;
  variant: string;
  price: number;
  stock: number;
  min_stock: number;
  active: number;
  issued_count?: number | null;
}

export interface UniformIssueRow {
  recipient_type?:UniformIssue['recipientType'];recipient_name?:string|null;
  id: number;
  player_id: number;
  uniform_id: number;
  size: string;
  cost: number;
  condition: string;
  returned: number;
  notes: string | null;
  issued_at: string;
  player_name?: string | null;
  uniform_name?: string | null;
  kind?: string | null;
  variant?: string | null;
}

export interface UniformRequestRow {
  player_shirt_number?:number|null;player_position?:UniformRequest['playerPosition'];player_email?:string;
  uniform_kind?:UniformRequest['uniformKind'];uniform_variant?:UniformRequest['uniformVariant'];
  recipient_type?:UniformRequest['recipientType'];recipient_name?:string|null;
  quoted_price?: number | null;
  issue_id?: number | null;
  id: number;
  player_id: number;
  uniform_id: number;
  size: string;
  reason: string | null;
  status: string;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  player_name?: string | null;
  uniform_name?: string | null;
}

export interface MatchRow {
  stream_url?:string|null;
  tournament_id?: number | null;
  tournament_rules?: string | null;
  lineup_published_at?: string | null;
  published_formation?: string | null;
  id: number;
  opponent: string;
  competition: string;
  kick_off: string;
  venue: string | null;
  is_home: number;
  status: string;
  formation: string;
  format: number;
  minutes: number;
  goals_for: number | null;
  goals_against: number | null;
  notes: string | null;
  created_at: string;
}

export interface StrategyRow {
  id: number;
  match_id: number;
  title: string;
  kind: string;
  content: string;
  created_at: string;
}

export interface LineupRow {
  avatar_url?: string | null;
  id: number;
  match_id: number;
  player_id: number | null;
  slot_index: number;
  x: number;
  y: number;
  role: string;
  label: string;
  player_name?: string | null;
  shirt_number?: number | null;
  player_position?: string | null;
}

export interface SanctionRow {
  id: number;
  player_id: number;
  match_id: number | null;
  type: string;
  reason: string;
  amount: number;
  points: number;
  status: string;
  match_date: string | null;
  created_at: string;
  player_name?: string | null;
}

export interface MatchStatRow {
  id: number;
  match_id: number;
  player_id: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  passes: number;
  passes_completed: number;
  tackles: number;
  interceptions: number;
  recoveries: number;
  dribbles: number;
  fouls: number;
  yellow_cards: number;
  red_cards: number;
  rating: number;
  player_name?: string | null;
  shirt_number?: number | null;
  player_position?: string | null;
}

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    role: row.role as Role,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

export function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    userId: row.user_id,
    dni: row.dni,
    birthDate: row.birth_date,
    position: row.position as Position,
    secondaryPosition: (row.secondary_position as Position | null) ?? null,
    shirtNumber: row.shirt_number,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    foot: (row.foot as Foot | null) ?? null,
    emergencyContact: row.emergency_contact,
    eps: row.eps,
    prepaidHealth: row.prepaid_health,
    joinedAt: row.joined_at,
  };
}

export function mapInscription(row: InscriptionRow): Inscription {
  const mapped: Inscription = {
    id: row.id,
    playerId: row.player_id,
    season: row.season,
    concept: row.concept,
    amount: row.amount,
    paid: row.paid,
    status: row.status as InscriptionStatus,
    dueDate: row.due_date,
    notes: row.notes,
    createdAt: row.created_at,
  };
  if (row.player_name !== undefined) mapped.playerName = row.player_name ?? undefined;
  return mapped;
}

export function mapPayment(row: PaymentRow): Payment {
  return {
    registeredBy: row.registered_by ?? null,
    registeredByName: row.registered_by_name ?? null,
    id: row.id,
    inscriptionId: row.inscription_id,
    amount: row.amount,
    method: row.method as PaymentMethod,
    reference: row.reference,
    paidAt: row.paid_at,
    notes: row.notes,
  };
}

export function mapUniform(row: UniformRow): Uniform {
  const mapped: Uniform = {
    imageUrl: row.image_url ?? null,
    id: row.id,
    name: row.name,
    kind: row.kind as UniformKind,
    variant: row.variant as UniformVariant,
    price: row.price,
    stock: row.stock,
    minStock: row.min_stock,
    active: row.active === 1,
  };
  if (row.issued_count !== undefined && row.issued_count !== null) {
    mapped.issuedCount = row.issued_count;
  }
  return mapped;
}

export function mapUniformIssue(row: UniformIssueRow): UniformIssue {
  const mapped: UniformIssue = {
    recipientType:row.recipient_type??'jugador',recipientName:row.recipient_name??null,
    id: row.id,
    playerId: row.player_id,
    uniformId: row.uniform_id,
    size: row.size,
    cost: row.cost,
    condition: row.condition as UniformCondition,
    returned: row.returned === 1,
    notes: row.notes,
    issuedAt: row.issued_at,
  };
  if (row.player_name !== undefined) mapped.playerName = row.player_name ?? undefined;
  if (row.uniform_name !== undefined) mapped.uniformName = row.uniform_name ?? undefined;
  if (row.kind !== undefined) mapped.kind = (row.kind as UniformKind) ?? undefined;
  if (row.variant !== undefined) mapped.variant = (row.variant as UniformVariant) ?? undefined;
  return mapped;
}

export function mapUniformRequest(row: UniformRequestRow): UniformRequest {
  const mapped: UniformRequest = {
    playerShirtNumber:row.player_shirt_number??null,playerPosition:row.player_position,playerEmail:row.player_email,
    uniformKind:row.uniform_kind,uniformVariant:row.uniform_variant,
    recipientType:row.recipient_type??'jugador',recipientName:row.recipient_name??null,
    quotedPrice: row.quoted_price ?? null,
    issueId: row.issue_id ?? null,
    id: row.id,
    playerId: row.player_id,
    uniformId: row.uniform_id,
    size: row.size,
    reason: row.reason,
    status: row.status as UniformRequestStatus,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
  if (row.player_name !== undefined) mapped.playerName = row.player_name ?? undefined;
  if (row.uniform_name !== undefined) mapped.uniformName = row.uniform_name ?? undefined;
  return mapped;
}

export function mapMatch(row: MatchRow): Match {
  const format = toTeamFormat(row.format);
  return {
    streamUrl:row.stream_url??null,
    tournamentId: row.tournament_id ?? null,
    tournamentRules: row.tournament_rules ? JSON.parse(row.tournament_rules) : null,
    lineupPublishedAt: row.lineup_published_at ?? null,
    publishedFormation: row.published_formation ?? null,
    id: row.id,
    opponent: row.opponent,
    competition: row.competition,
    kickOff: row.kick_off,
    venue: row.venue,
    isHome: row.is_home === 1,
    status: row.status as MatchStatus,
    formation: row.formation,
    format,
    minutes: Number.isFinite(row.minutes) && row.minutes > 0 ? row.minutes : getFormat(format).matchMinutes,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function mapStrategy(row: StrategyRow): Strategy {
  return {
    id: row.id,
    matchId: row.match_id,
    title: row.title,
    kind: row.kind as StrategyKind,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function mapLineupSlot(row: LineupRow): LineupSlot {
  const mapped: LineupSlot = {
    slotIndex: row.slot_index,
    playerId: row.player_id,
    x: row.x,
    y: row.y,
    role: row.role as LineupSlot['role'],
    label: row.label,
  };
  if (row.player_name !== undefined) mapped.playerName = row.player_name ?? null;
  if (row.avatar_url !== undefined) mapped.avatarUrl = row.avatar_url ?? null;
  if (row.shirt_number !== undefined) mapped.shirtNumber = row.shirt_number ?? null;
  if (row.player_position !== undefined) {
    mapped.playerPosition = (row.player_position as Position | null) ?? null;
  }
  return mapped;
}

export function mapSanction(row: SanctionRow): Sanction {
  const mapped: Sanction = {
    id: row.id,
    playerId: row.player_id,
    matchId: row.match_id,
    type: row.type as SanctionType,
    reason: row.reason,
    amount: row.amount,
    points: row.points,
    status: row.status as SanctionStatus,
    matchDate: row.match_date,
    createdAt: row.created_at,
  };
  if (row.player_name !== undefined) mapped.playerName = row.player_name ?? undefined;
  return mapped;
}

export function mapMatchStat(row: MatchStatRow): MatchStat {
  const mapped: MatchStat = {
    id: row.id,
    matchId: row.match_id,
    playerId: row.player_id,
    minutes: row.minutes,
    goals: row.goals,
    assists: row.assists,
    shots: row.shots,
    shotsOnTarget: row.shots_on_target,
    passes: row.passes,
    passesCompleted: row.passes_completed,
    tackles: row.tackles,
    interceptions: row.interceptions,
    recoveries: row.recoveries,
    dribbles: row.dribbles,
    fouls: row.fouls,
    yellowCards: row.yellow_cards,
    redCards: row.red_cards,
    rating: row.rating,
  };
  if (row.player_name !== undefined) mapped.playerName = row.player_name ?? undefined;
  if (row.shirt_number !== undefined) mapped.shirtNumber = row.shirt_number ?? null;
  if (row.player_position !== undefined) {
    mapped.position = (row.player_position as Position | null) ?? undefined;
  }
  return mapped;
}
