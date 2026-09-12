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
export type AvatarId = "warden" | "gremlin" | "technomancer" | "scholar" | "scavenger" | "imp";

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
  sourceType?: "real" | "synthetic";
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
  tabClashWinnerId?: string;
  isSuddenDeath: boolean;
}

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  avatarId?: AvatarId;
  deck: TabCard[];
  deckFinalized: boolean;
  usedCardIds: string[];
  selectedCardId?: string;
  locked: boolean;
  autoLocked?: boolean;
  score: number;
}

export interface Room {
  code: string;
  createdAt: number;
  hostId: string;
  roundCount: 3 | 5 | 7;
  selectionSeconds: 30 | 45 | 60;
  selectionDeadline?: number;
  currentRound: number;
  phase:
    | "LOBBY"
    | "TAB_SELECTION"
    | "MATCH_INTRO"
    | "SELECTING"
    | "RESULT"
    | "SUDDEN_DEATH_SELECTING"
    | "SUDDEN_DEATH_RESULT"
    | "GAME_OVER"
    | "TAB_REHAB"
    | "COMPLETE";
  players: Player[];
  crisisPool: Crisis[];
  currentCrisis?: Crisis;
  suddenDeathOptions?: Crisis[];
  suddenDeathPlayerIds?: string[];
  winnerId?: string;
  lastResult?: RoundResult;
}
