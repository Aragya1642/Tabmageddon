import type {
  CardType,
  Crisis,
  GameRoom,
  Player,
  RoundResult,
  ScoreBreakdown,
  TabCard,
} from "./types.js";

export type RandomSource = () => number;

const BEATS: Record<CardType, CardType> = {
  ACADEMIC: "ENTERTAINMENT",
  ENTERTAINMENT: "SHOPPING",
  SHOPPING: "UTILITY",
  UTILITY: "ACADEMIC",
};

export function shuffle<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function selectedCard(player: Player): TabCard {
  const card = player.deck.find((entry) => entry.id === player.selectedCardId);
  if (!card) throw new Error(`${player.name} has no selected card`);
  return card;
}

function typeModifier(card: TabCard, opponents: TabCard[]): number {
  let modifier = 0;
  for (const opponent of opponents) {
    if (BEATS[card.type] === opponent.type) modifier += 1;
    if (BEATS[opponent.type] === card.type && card.abilityId !== "TYPE_GUARD") modifier -= 1;
  }
  return clamp(modifier, -2, 2);
}

function luckRoll(random: RandomSource): number {
  return Math.floor(random() * 3) - 1;
}

function chooseRandom<T>(items: readonly T[], random: RandomSource): T {
  const chosen = items[Math.floor(random() * items.length)];
  if (!chosen) throw new Error("Cannot choose from an empty list");
  return chosen;
}

export function resolveBattle(
  room: GameRoom,
  crisis: Crisis,
  participants: Player[],
  isSuddenDeath: boolean,
  random: RandomSource = Math.random,
): RoundResult {
  if (participants.length < 2 || participants.some((player) => !player.locked)) {
    throw new Error("All participating players must be locked");
  }

  const cards = new Map(participants.map((player) => [player.id, selectedCard(player)]));
  const shieldUsed = new Set<string>();
  const abilityModifiers = new Map<string, number>(participants.map((player) => [player.id, 0]));
  const abilityNotes = new Map<string, string[]>(participants.map((player) => [player.id, []]));
  const highestMatchScore = Math.max(...participants.map((player) => player.score));

  const base = participants.map((player) => {
    const card = cards.get(player.id)!;
    const opponents = participants.filter((entry) => entry.id !== player.id).map((entry) => cards.get(entry.id)!);
    let modifier = typeModifier(card, opponents);
    if (card.abilityId === "SHIELD" && modifier < 0) {
      modifier += 1;
      shieldUsed.add(player.id);
      abilityNotes.get(player.id)!.push("Shield blocked -1");
    }
    return { player, card, typeModifier: modifier };
  });

  for (const { player, card } of base) {
    const notes = abilityNotes.get(player.id)!;
    let modifier = 0;
    if (card.abilityId === "OVERCLOCK") {
      modifier += 2;
      notes.push("Overclock +2");
    } else if (card.abilityId === "SPECIALIST") {
      const strongest = Math.max(...Object.values(card.stats));
      if (card.stats[crisis.stat] === strongest) {
        modifier += 2;
        notes.push("Specialist +2");
      }
    } else if (card.abilityId === "COMEBACK" && player.score < highestMatchScore) {
      modifier += 2;
      notes.push("Comeback +2");
    } else if (card.abilityId === "TYPE_GUARD") {
      notes.push("Type disadvantage ignored");
    } else if (card.abilityId === "CHAOS") {
      const chaos = random() < 0.5 ? 3 : -1;
      modifier += chaos;
      notes.push(`Chaos ${chaos > 0 ? "+" : ""}${chaos}`);
    }
    abilityModifiers.set(player.id, modifier);
  }

  for (const { player, card } of base) {
    if (card.abilityId !== "SABOTAGE") continue;
    const target = chooseRandom(participants.filter((entry) => entry.id !== player.id), random);
    const targetCard = cards.get(target.id)!;
    if (targetCard.abilityId === "SHIELD" && !shieldUsed.has(target.id)) {
      shieldUsed.add(target.id);
      abilityNotes.get(target.id)!.push(`Shield blocked ${player.name}'s sabotage`);
      abilityNotes.get(player.id)!.push(`${target.name} blocked sabotage`);
    } else {
      abilityModifiers.set(target.id, abilityModifiers.get(target.id)! - 2);
      abilityNotes.get(target.id)!.push(`Sabotaged by ${player.name} -2`);
      abilityNotes.get(player.id)!.push(`Sabotaged ${target.name}`);
    }
  }

  const scores: ScoreBreakdown[] = base.map(({ player, card, typeModifier: matchupModifier }) => {
    const crisisScore = crisis.direction === "HIGH" ? card.stats[crisis.stat] : 10 - card.stats[crisis.stat];
    const firstLuck = luckRoll(random);
    const luck = card.abilityId === "REROLL" ? Math.max(firstLuck, luckRoll(random)) : firstLuck;
    if (card.abilityId === "REROLL") abilityNotes.get(player.id)!.push("Rerolled luck");
    const abilityModifier = abilityModifiers.get(player.id)!;
    return {
      playerId: player.id,
      card,
      crisisScore,
      typeModifier: matchupModifier,
      abilityModifier,
      abilityNote: abilityNotes.get(player.id)!.join(" · ") || "No ability bonus",
      luck,
      finalScore: crisisScore + matchupModifier + abilityModifier + luck,
    };
  });

  const bestScore = Math.max(...scores.map((score) => score.finalScore));
  const tiedPlayerIds = scores.filter((score) => score.finalScore === bestScore).map((score) => score.playerId);
  const winnerId = tiedPlayerIds.length === 1 ? tiedPlayerIds[0] : undefined;

  return { crisis, scores, winnerId, tiedPlayerIds, isSuddenDeath };
}
