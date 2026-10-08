import type {
  LineupSlot,
  Match,
  MatchStat,
  MatchStatus,
  Strategy,
  StrategyKind,
} from '../../../domain/entities';

export interface CreateMatchInput {
  streamUrl?: string | null;
  tournamentId?: number | null;
  opponent: string;
  competition: string;
  kickOff: string;
  venue?: string | null;
  isHome: boolean;
  formation?: string;
  /** Formato 5|7|8|11 (§12.4); default: `team_settings.format`. */
  format?: number;
  /** Duración; default: `profile.matchMinutes` del formato elegido. */
  minutes?: number;
  notes?: string | null;
}

export interface UpdateMatchInput {
  streamUrl?:string|null;
  tournamentId?: number | null;
  opponent?: string;
  competition?: string;
  kickOff?: string;
  venue?: string | null;
  isHome?: boolean;
  formation?: string;
  format?: number;
  minutes?: number;
  status?: MatchStatus;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  notes?: string | null;
}

export interface MatchDetail {
  match: Match;
  strategies: Strategy[];
  lineup: LineupSlot[];
  stats: MatchStat[];
}

export interface StrategyInput {
  title: string;
  kind: StrategyKind;
  content: string;
}

export interface LineupEntryInput {
  slotIndex: number;
  playerId: number | null;
  x: number;
  y: number;
  role: 'POR' | 'DEF' | 'MED' | 'DEL';
  label: string;
}

export interface XiSuggestion {
  formation?: string;
  leagueContext?: import('../../../domain/tournament').LeagueContext;
  bench?: { playerId: number; playerName: string; position: string; predictedRating: number }[];
  lineup: LineupSlot[];
  explanation: string;
}

/** Casos de uso de partidos (§7.3). */
export interface MatchPort {
  list(): Match[];
  get(id: number, playerView?: boolean): MatchDetail;
  publishLineup(id: number): Match;
  attendance(id: number, userId?: number): import('../../../domain/entities').MatchAttendance[];
  setAttendance(id: number, userId: number, status: import('../../../domain/entities').AttendanceStatus): import('../../../domain/entities').MatchAttendance;
  create(input: CreateMatchInput): Match;
  update(id: number, input: UpdateMatchInput): Match;
  remove(id: number): { ok: true };
  setFormation(id: number, formation: string): { match: Match; lineup: LineupSlot[] };
  addStrategy(matchId: number, input: StrategyInput): Strategy;
  updateStrategy(id: number, input: Partial<StrategyInput>): Strategy;
  removeStrategy(id: number): { ok: true };
  setLineup(id: number, slots: LineupEntryInput[]): { lineup: LineupSlot[] };
  autoLineup(id: number, formation?: string): XiSuggestion;
  saveStats(matchId: number, entries: Array<Partial<MatchStat> & { playerId: number }>): { entries: MatchStat[] };
  getStats(matchId: number): { entries: MatchStat[] };
}
