import type { TeamFormat } from './formats';
import type { Position } from './entities';

export interface TournamentPlayer {
  playerId: number; playerName: string; shirtNumber: number | null;
  position: Position; secondaryPosition: Position | null; active: boolean; registeredAt: string;
}
export interface TournamentRoster {
  players: TournamentPlayer[];
  myPlayerId: number | null;
}

export interface TournamentRules {
  format: TeamFormat;
  periods: number;
  minutesPerPeriod: number;
  breakMinutes: number | null;
  maxSquad: number | null;
  maxSubstitutions: number | null;
  rollingSubstitutions: boolean | null;
  allowedFormations: string[];
  tacticalStyle: 'equilibrado' | 'ofensivo' | 'defensivo';
}
export interface TournamentDocument {
  id: number; tournamentId: number; title: string; assetId: string;
  fileName: string; mimeType: string; extractedText: string;
  extractionStatus: 'extraido' | 'requiere_texto'; createdAt: string;
}
export interface Tournament {
  imageUrl?: string | null;
  id: number; name: string; leagueName: string; season: string;
  status: 'borrador' | 'publicado' | 'archivado';
  rules: TournamentRules; notes: string; updatedAt: string;
  documents?: TournamentDocument[];
}
export interface TournamentSnapshot extends TournamentRules {
  tournamentName: string; leagueName: string; updatedAt: string;
}
export interface LeagueContext {
  tournamentId: number; name: string; leagueName: string; minutes: number;
  periods: number; minutesPerPeriod: number; maxSquad: number | null;
  maxSubstitutions: number | null; rollingSubstitutions: boolean | null;
  notes: string; documents: { title: string; excerpt: string; extractionStatus: string }[];
  positionPlan: string[];
}
