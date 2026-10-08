import type {
  AiPlayerInsight,
  Foot,
  Inscription,
  LineupSlot,
  Match,
  MatchStat,
  Payment,
  Player,
  Position,
  StatsSummary,
  Sanction,
  Uniform,
  UniformIssue,
  UniformRequest,
  User,
} from '../../../domain/entities';

export interface MeResponse {
  user: User;
  player: Player | null;
  stats: StatsSummary;
  inscription: Inscription | null;
  sanctions: Sanction[];
  issuedUniforms: UniformIssue[];
  pendingRequests: number;
  forecast: { nextRating: number; confidence: number; trend: string } | null;
}

export interface ProfileInput {
  phone?: string | null;
  dni?: string | null;
  birthDate?: string | null;
  position?: Position;
  secondaryPosition?: Position | null;
  shirtNumber?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  foot?: Foot | null;
  emergencyContact?: string | null;
  eps?: string | null;
  prepaidHealth?: string | null;
}

/** Match con la vista propia del jugador (§7.2). */
export interface MatchView extends Match {
  mySlot: LineupSlot | null;
  strategiesCount: number;
  lineupFilled: number;
}

/** Casos de uso "yo" (§7.2). */
export interface MePort {
  getMe(userId: number): MeResponse;
  updateProfile(userId: number, input: ProfileInput): { user: User; player: Player };
  changePassword(userId: number, currentPassword: string, newPassword: string): { ok: true };
  getInscription(userId: number): { inscription: Inscription | null; payments: Payment[] };
  getUniforms(userId: number): {
    issued: UniformIssue[];
    requests: UniformRequest[];
    catalog: Uniform[];
  };
  createUniformRequest(
    userId: number,
    input: { uniformId: number; size: string; reason?: string | null },
  ): { request: UniformRequest };
  getMatches(userId: number): { upcoming: MatchView[]; finished: MatchView[] };
  getStats(userId: number): { summary: StatsSummary; matches: MatchStat[] };
  getAi(userId: number,matchId?:number): AiPlayerInsight;
}
