import type { AiInsights, AiPlayerInsight, LineupSlot, ModelInfo } from '../../../domain/entities';

export interface XiSuggestion {
  formation?: string;
  leagueContext?: import('../../../domain/tournament').LeagueContext;
  bench?: { playerId: number; playerName: string; position: string; predictedRating: number }[];
  lineup: LineupSlot[];
  explanation: string;
}

/** Casos de uso de IA (§7.10 y §8). */
export interface AiPort {
  tacticalPlan(matchId: number, style?: import('../../../domain/tactics').TacticalStyle, formation?: string): import('../../../domain/tactics').TacticalPlan;
  getModelInfo(): ModelInfo;
  train(): ModelInfo;
  insights(): AiInsights;
  playerInsight(playerId: number,matchId?:number): AiPlayerInsight;
  recommendXi(matchId: number, formation?: string): XiSuggestion;
}
