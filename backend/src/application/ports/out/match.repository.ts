import type {
  LineupSlot,
  Match,
  MatchStatus,
  Strategy,
  StrategyKind,
} from '../../../domain/entities';

export interface CreateMatchInput {
  streamUrl?:string|null;
  tournamentId?: number | null;
  tournamentRules?: import('../../../domain/tournament').TournamentSnapshot | null;
  opponent: string;
  competition?: string;
  kickOff: string;
  venue?: string | null;
  isHome?: boolean;
  status?: MatchStatus;
  formation?: string;
  /** Formato del partido 5|7|8|11 (§12.4); si no llega, usa el default de la BD. */
  format?: number;
  /** Duración efectiva; si no llega, deriva del perfil del formato. */
  minutes?: number;
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  notes?: string | null;
}

export type UpdateMatchInput = Partial<CreateMatchInput>;

export interface CreateStrategyInput {
  matchId: number;
  title: string;
  kind: StrategyKind;
  content: string;
}

export interface UpdateStrategyInput {
  title?: string;
  kind?: StrategyKind;
  content?: string;
}

export interface LineupSlotInput {
  slotIndex: number;
  playerId: number | null;
  x: number;
  y: number;
  role: 'POR' | 'DEF' | 'MED' | 'DEL';
  label: string;
}

/** Puerto de salida para partidos, estrategias y alineaciones. */
export interface MatchRepository {
  getPublishedLineup(matchId: number): Promise<LineupSlot[]>;
  publishLineup(matchId: number): Promise<Match>;
  unpublishLineup(matchId: number): Promise<void>;
  listAttendance(matchId: number): Promise<import('../../../domain/entities').MatchAttendance[]>;
  setAttendance(matchId: number, playerId: number, status: import('../../../domain/entities').AttendanceStatus): Promise<void>;
  list(): Promise<Match[]>;
  findById(id: number): Promise<Match | null>;
  create(input: CreateMatchInput): Promise<Match>;
  update(id: number, input: UpdateMatchInput): Promise<Match>;
  remove(id: number): Promise<void>;

  listStrategies(matchId: number): Promise<Strategy[]>;
  findStrategy(id: number): Promise<Strategy | null>;
  createStrategy(input: CreateStrategyInput): Promise<Strategy>;
  updateStrategy(id: number, input: UpdateStrategyInput): Promise<Strategy>;
  removeStrategy(id: number): Promise<void>;

  /** Slots del partido con datos del jugador (nombre, dorsal, posición). */
  getLineup(matchId: number): Promise<LineupSlot[]>;
  /** Reemplaza por completo la alineación del partido. */
  replaceLineup(matchId: number, slots: LineupSlotInput[]): Promise<LineupSlot[]>;
}
