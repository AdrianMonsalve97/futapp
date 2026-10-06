import type {
  LineupSlot,
  Match,
  MatchStatus,
  Strategy,
  StrategyKind,
} from '../../../domain/entities';

export interface CreateMatchInput {
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
  list(): Match[];
  findById(id: number): Match | null;
  create(input: CreateMatchInput): Match;
  update(id: number, input: UpdateMatchInput): Match;
  remove(id: number): void;

  listStrategies(matchId: number): Strategy[];
  findStrategy(id: number): Strategy | null;
  createStrategy(input: CreateStrategyInput): Strategy;
  updateStrategy(id: number, input: UpdateStrategyInput): Strategy;
  removeStrategy(id: number): void;

  /** Slots del partido con datos del jugador (nombre, dorsal, posición). */
  getLineup(matchId: number): LineupSlot[];
  /** Reemplaza por completo la alineación del partido. */
  replaceLineup(matchId: number, slots: LineupSlotInput[]): LineupSlot[];
}
