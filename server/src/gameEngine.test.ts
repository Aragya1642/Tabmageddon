import assert from "node:assert/strict";
import test from "node:test";
import { fallbackCard, normalizeStats } from "./cardCompiler.js";
import { resolveBattle } from "./gameEngine.js";
import type { BrowserTab, Crisis, GameRoom, Player } from "./types.js";

const tabs: BrowserTab[] = [
  { tabId: 1, title: "YouTube - ten hours of coding music", url: "https://youtube.com/watch", domain: "youtube.com" },
  { tabId: 2, title: "GitHub Pull Request", url: "https://github.com/example", domain: "github.com" },
];

test("normalization always creates legal twenty-point stats", () => {
  const stats = normalizeStats({ ram: 99, uselessness: -5, shadiness: 3.4, aura: Number.NaN }, "test");
  assert.equal(Object.values(stats).reduce((sum, stat) => sum + stat, 0), 20);
  assert.ok(Object.values(stats).every((stat) => Number.isInteger(stat) && stat >= 1 && stat <= 9));
});

test("fallback cards are deterministic in mechanics and legal", () => {
  const first = fallbackCard(tabs[0]!);
  const second = fallbackCard(tabs[0]!);
  const other = fallbackCard(tabs[1]!);
  assert.deepEqual(first.stats, second.stats);
  assert.equal(first.type, second.type);
  assert.equal(first.type, "ENTERTAINMENT");
  assert.equal(other.type, "ACADEMIC");
  assert.equal(first.abilityId, second.abilityId);
  assert.equal(Object.values(first.stats).reduce((sum, stat) => sum + stat, 0), 20);
  assert.notEqual(first.cardName, tabs[0]!.title);
  assert.notEqual(first.roast, other.roast);
});

test("battle resolution produces one synchronized breakdown per player", () => {
  const players: Player[] = tabs.map((tab, index) => {
    const card = fallbackCard(tab);
    return {
      id: `p${index}`,
      socketId: `s${index}`,
      sessionToken: `token-${index}`,
      name: `Player ${index}`,
      connected: true,
      deck: [card],
      deckFinalized: true,
      usedCardIds: [],
      selectedCardId: card.id,
      locked: true,
      score: 0,
    };
  });
  const crisis: Crisis = {
    id: "test",
    name: "Test Crisis",
    description: "Highest aura wins.",
    stat: "aura",
    direction: "HIGH",
  };
  const room: GameRoom = {
    code: "TEST",
    createdAt: 1,
    hostId: players[0]!.id,
    roundCount: 3,
    selectionSeconds: 30,
    currentRound: 1,
    phase: "SELECTING",
    players,
    crisisPool: [crisis],
    remainingCrises: [],
    currentCrisis: crisis,
  };
  const result = resolveBattle(room, crisis, players, false, () => 0.5);
  assert.equal(result.scores.length, 2);
  assert.ok(result.winnerId);
  assert.ok(result.scores.every((score) => Number.isFinite(score.finalScore)));
});

test("ordinary exact ties use a server-selected Tab Clash winner", () => {
  const players: Player[] = tabs.map((tab, index) => {
    const card = {
      ...fallbackCard(tab),
      type: "UTILITY" as const,
      stats: { ram: 5, uselessness: 5, shadiness: 5, aura: 5 },
      abilityId: "TYPE_GUARD" as const,
    };
    return {
      id: `tie-${index}`,
      socketId: `tie-socket-${index}`,
      sessionToken: `tie-token-${index}`,
      name: `Tie ${index}`,
      connected: true,
      deck: [card],
      deckFinalized: true,
      usedCardIds: [],
      selectedCardId: card.id,
      locked: true,
      score: 0,
    };
  });
  const crisis: Crisis = {
    id: "tie",
    name: "Perfect Tie",
    description: "Highest aura wins.",
    stat: "aura",
    direction: "HIGH",
  };
  const room: GameRoom = {
    code: "TIE1",
    createdAt: 1,
    hostId: players[0]!.id,
    roundCount: 3,
    selectionSeconds: 30,
    currentRound: 1,
    phase: "SELECTING",
    players,
    crisisPool: [crisis],
    remainingCrises: [],
    currentCrisis: crisis,
  };
  const result = resolveBattle(room, crisis, players, false, () => 0.5);
  assert.ok(result.winnerId);
  assert.equal(result.winnerId, result.tabClashWinnerId);
  assert.deepEqual(result.tiedPlayerIds, players.map((player) => player.id));
});
