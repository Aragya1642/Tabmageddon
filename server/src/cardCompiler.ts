import { createHash, randomUUID } from "node:crypto";
import {
  ABILITY_IDS,
  CARD_TYPES,
  RARITIES,
  type AbilityId,
  type BrowserTab,
  type CardType,
  type Rarity,
  type StatName,
  type TabCard,
} from "./types.js";

const STAT_NAMES: StatName[] = ["ram", "uselessness", "shadiness", "aura"];
const ABILITY_COPY: Record<AbilityId, [string, string]> = {
  OVERCLOCK: ["Fan Goes BRRR", "+2 score."],
  REROLL: ["Refresh Until It Works", "Roll luck twice and keep the better result."],
  SHIELD: ["Not My Tab", "Ignore the first negative modifier."],
  SABOTAGE: ["Suspicious Pop-up", "A random opponent receives -2."],
  SPECIALIST: ["Built Different", "+2 when this crisis uses the card's strongest stat."],
  COMEBACK: ["One Last Tab", "+2 while its player is behind."],
  TYPE_GUARD: ["Incognito Armor", "Ignore type disadvantage."],
  CHAOS: ["Clear Cache and Pray", "50% chance of +3; otherwise -1."],
};

function hashNumbers(input: string): number[] {
  return [...createHash("sha256").update(input).digest()];
}

export function normalizeStats(input: Partial<Record<StatName, unknown>>, seed = ""): Record<StatName, number> {
  const tieBreakers = hashNumbers(seed);
  const stats = STAT_NAMES.map((name) => {
    const number = Number(input[name]);
    return Number.isFinite(number) ? Math.max(1, Math.min(9, Math.round(number))) : 5;
  });

  let total = stats.reduce((sum, stat) => sum + stat, 0);
  let cursor = tieBreakers[0]! % stats.length;
  while (total !== 20) {
    const direction = total < 20 ? 1 : -1;
    const index = cursor % stats.length;
    const next = stats[index]! + direction;
    if (next >= 1 && next <= 9) {
      stats[index] = next;
      total += direction;
    }
    cursor += 1;
  }

  return Object.fromEntries(STAT_NAMES.map((name, index) => [name, stats[index]!])) as Record<StatName, number>;
}

function inferType(tab: BrowserTab, hash: number[]): CardType {
  const text = `${tab.domain} ${tab.title}`.toLowerCase();
  if (/github|docs|canvas|notion|slack|gmail|course|learn|work/.test(text)) return "GRIND";
  if (/reddit|discord|twitter|x\.com|facebook|instagram|linkedin|social/.test(text)) return "SOCIAL";
  if (/youtube|netflix|twitch|spotify|game|meme|tiktok/.test(text)) return "BRAINROT";
  if (/google|stackoverflow|maps|weather|localhost|tool|search/.test(text)) return "UTILITY";
  return CARD_TYPES[hash[4]! % CARD_TYPES.length]!;
}

export function fallbackCard(tab: BrowserTab): TabCard {
  const seed = `${tab.domain}|${tab.title}`;
  const hash = hashNumbers(seed);
  const abilityId = ABILITY_IDS[hash[5]! % ABILITY_IDS.length]!;
  const [abilityName, abilityDescription] = ABILITY_COPY[abilityId];
  const rawStats = Object.fromEntries(
    STAT_NAMES.map((name, index) => [name, 1 + (hash[index]! % 9)]),
  ) as Record<StatName, number>;
  const rarityRoll = hash[6]!;
  const rarity: Rarity =
    rarityRoll > 246 ? "MYTHIC" : rarityRoll > 210 ? "EPIC" : rarityRoll > 120 ? "RARE" : "COMMON";
  const shortTitle = tab.title.trim().slice(0, 38) || tab.domain;

  return {
    id: randomUUID(),
    tabId: tab.tabId,
    originalTitle: tab.title,
    originalUrl: tab.url,
    domain: tab.domain,
    faviconUrl: tab.faviconUrl,
    cardName: shortTitle,
    type: inferType(tab, hash),
    stats: normalizeStats(rawStats, seed),
    rarity,
    abilityId,
    abilityName,
    abilityDescription,
    roast: tab.audible
      ? "It is making noise and pretending that is helpful."
      : "You kept this open because closing it felt too final.",
    browserContext: {
      pinned: tab.pinned,
      audible: tab.audible,
      stale: typeof tab.lastAccessed === "number" && Date.now() - tab.lastAccessed > 86_400_000,
    },
  };
}

function safeText(value: unknown, fallback: string, max: number): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

function legalEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function validateGeminiCard(value: unknown, tab: BrowserTab): TabCard {
  const fallback = fallbackCard(tab);
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Record<string, unknown>;
  const abilityId = legalEnum(candidate.abilityId, ABILITY_IDS, fallback.abilityId);
  const defaultAbility = ABILITY_COPY[abilityId];

  return {
    ...fallback,
    cardName: safeText(candidate.cardName, fallback.cardName, 48),
    type: legalEnum(candidate.type, CARD_TYPES, fallback.type),
    stats: normalizeStats(
      candidate.stats && typeof candidate.stats === "object"
        ? (candidate.stats as Partial<Record<StatName, unknown>>)
        : fallback.stats,
      `${tab.domain}|${tab.title}`,
    ),
    rarity: legalEnum(candidate.rarity, RARITIES, fallback.rarity),
    abilityId,
    abilityName: safeText(candidate.abilityName, defaultAbility[0], 40),
    abilityDescription: defaultAbility[1],
    roast: safeText(candidate.roast, fallback.roast, 120),
  };
}

async function compileWithGemini(tabs: BrowserTab[]): Promise<TabCard[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini is not configured");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = `You are the semantic compiler for Tabmaggedon, an internet-themed card game.
Interpret each browser tab and return one object per input, in the same order.
Allowed types: ${CARD_TYPES.join(", ")}.
Allowed abilities: ${ABILITY_IDS.join(", ")}.
Allowed rarities: ${RARITIES.join(", ")}. Rarity is cosmetic; MYTHIC means unusual or hilarious.
Stats are integers from 1 to 9 for ram, uselessness, shadiness, and aura. They should express semantic
traits; a deterministic validator will rebalance them. Never invent mechanics.
Keep cardName under 48 characters, abilityName under 40, and roast under 120.
Return only JSON in this shape:
{"cards":[{"cardName":"...","type":"GRIND","stats":{"ram":5,"uselessness":5,"shadiness":5,"aura":5},"rarity":"COMMON","abilityId":"OVERCLOCK","abilityName":"...","roast":"..."}]}

Input tabs:
${JSON.stringify(tabs.map(({ title, domain, pinned, audible, discarded, active, lastAccessed }) => ({
    title: title.slice(0, 180),
    domain,
    pinned,
    audible,
    discarded,
    active,
    lastAccessed,
  })))}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
      }),
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")) as { cards?: unknown[] };
  if (!Array.isArray(parsed.cards) || parsed.cards.length !== tabs.length) {
    throw new Error("Gemini returned the wrong card count");
  }
  return tabs.map((tab, index) => validateGeminiCard(parsed.cards![index], tab));
}

export async function compileCards(tabs: BrowserTab[]): Promise<{ cards: TabCard[]; source: "gemini" | "fallback" }> {
  try {
    return { cards: await compileWithGemini(tabs), source: "gemini" };
  } catch (error) {
    console.warn("Using fallback card compiler:", error instanceof Error ? error.message : error);
    return { cards: tabs.map(fallbackCard), source: "fallback" };
  }
}
