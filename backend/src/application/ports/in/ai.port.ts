import type { AiInsights, AiPlayerInsight, LineupSlot, ModelInfo } from '../../../domain/entities';

export interface XiSuggestion {
  lineup: LineupSlot[];
  explanation: string;
}

/** Casos de uso de IA (§7.10 y §8). */
export interface AiPort {
  getModelInfo(): ModelInfo;
  train(): ModelInfo;
  insights(): AiInsights;
  playerInsight(playerId: number): AiPlayerInsight;
  recommendXi(matchId: number, formation?: string): XiSuggestion;
}
