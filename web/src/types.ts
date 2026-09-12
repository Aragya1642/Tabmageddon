export type CardType = "ENTERTAINMENT" | "UTILITY" | "ACADEMIC" | "SHOPPING";
export type AbilityId =
  | "OVERCLOCK"
  | "REROLL"
  | "SHIELD"
  | "SABOTAGE"
  | "SPECIALIST"
  | "COMEBACK"
  | "TYPE_GUARD"
  | "CHAOS";
export type StatName = "ram" | "uselessness" | "shadiness" | "aura";

export interface BrowserTab {
  tabId: number;
  title: string;
  url: string;
  domain: string;
  faviconUrl?: string;
  pinned?: boolean;
  audible?: boolean;
  discarded?: boolean;
  active?: boolean;
  lastAccessed?: number;
}

export interface TabCard {
  id: string;
  tabId: number;
  originalTitle: string;
  originalUrl: string;
  domain: string;
  faviconUrl?: string;
  cardName: string;
  type: CardType;
  stats: Record<StatName, number>;
  abilityId: AbilityId;
  abilityName: string;
  abilityDescription: string;
  roast: string;
  browserContext?: { pinned?: boolean; audible?: boolean; stale?: boolean };
}

export interface Crisis {
  id: string;
  name: string;
  description: string;
  stat: StatName;
  direction: "HIGH" | "LOW";
}

export interface ScoreBreakdown {
  playerId: string;
  card: TabCard;
  crisisScore: number;
  typeModifier: number;
  abilityModifier: number;
  abilityNote: string;
  luck: number;
  finalScore: number;
}

export interface RoundResult {
  crisis: Crisis;
  scores: ScoreBreakdown[];
  winnerId?: string;
  tiedPlayerIds: string[];
  isSuddenDeath: boolean;
}

export interface Player {
  id: string;
  name: string;
  deck: TabCard[];
  usedCardIds: string[];
  selectedCardId?: string;
  locked: boolean;
  score: number;
}

export interface Room {
  code: string;
  hostId: string;
  roundCount: 3 | 5 | 7;
  selectionSeconds: 15 | 30 | 45 | 60;
  selectionDeadline?: number;
  currentRound: number;
  phase:
    | "LOBBY"
    | "CRISIS_PREVIEW"
    | "SELECTING"
    | "RESULT"
    | "SUDDEN_DEATH_SELECTING"
    | "SUDDEN_DEATH_RESULT"
    | "GAME_OVER"
    | "TAB_REHAB";
  players: Player[];
  crisisPool: Crisis[];
  remainingCrises: Crisis[];
  currentCrisis?: Crisis;
  suddenDeathOptions?: Crisis[];
  suddenDeathPlayerIds?: string[];
  winnerId?: string;
  lastResult?: RoundResult;
}
