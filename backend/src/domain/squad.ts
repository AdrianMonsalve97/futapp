import type { MatchStat, Position, StatsSummary } from "./entities";

export interface SquadIdentity {
  playerId: number;
  name: string;
  shirtNumber: number | null;
  position: Position;
  secondaryPosition: Position | null;
  avatarUrl: string | null;
}
export interface PerformanceEntry extends MatchStat {
  opponent: string;
  kickOff: string;
}
export interface SquadMember extends SquadIdentity {
  stats: StatsSummary;
  recent: PerformanceEntry[];
}
