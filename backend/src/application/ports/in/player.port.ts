import type {
  AiPlayerInsight,
  Foot,
  Inscription,
  MatchStat,
  Player,
  PlayerListItem,
  Position,
  Role,
  Sanction,
  StatsSummary,
  UniformIssue,
  User,
} from '../../../domain/entities';

export interface CreatePlayerInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  dni?: string | null;
  position: Position;
  secondaryPosition?: Position | null;
  shirtNumber?: number | null;
  birthDate?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  foot?: Foot | null;
  emergencyContact?: string | null;
  eps?: string | null;
  prepaidHealth?: string | null;
}

export interface UpdatePlayerInput {
  fullName?: string;
  phone?: string | null;
  role?: Role;
  active?: boolean;
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

export interface PlayerDetail {
  user: User;
  player: Player;
  inscriptions: Inscription[];
  uniformIssues: UniformIssue[];
  sanctions: Sanction[];
  stats: MatchStat[];
  summary: StatsSummary;
  ai: AiPlayerInsight;
}

/** Casos de uso de jugadores (§7.4). */
export interface PlayerPort {
  list(): Promise<PlayerListItem[]>;
  get(id: number): Promise<PlayerDetail>;
  create(input: CreatePlayerInput): Promise<{ user: User; player: Player }>;
  update(id: number, input: UpdatePlayerInput): Promise<{ user: User; player: Player }>;
  remove(id: number): Promise<{ ok: true }>;
  approve(id:number,reviewerId:number):Promise<{ok:true}>;
}
