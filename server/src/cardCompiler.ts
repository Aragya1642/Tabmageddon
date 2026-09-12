import { createHash, randomUUID } from "node:crypto";
import {
  ABILITY_IDS,
  CARD_TYPES,
  type AbilityId,
  type BrowserTab,
  type CardType,
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
const FALLBACK_NAMES: Record<CardType, string[]> = {
  ENTERTAINMENT: ["The Infinite Scroll", "Autoplay's Chosen", "Dopamine Overdraft", "One More Video", "The Attention Vacuum"],
  UTILITY: ["The Swiss Army Tab", "Answer Engine", "Bookmark in Denial", "The Helpful Hoarder", "Emergency Reference"],
  ACADEMIC: ["Deadline Devourer", "The Productivity Theater", "Academic Weapon", "Citation Final Boss", "The Unfinished Business"],
  SHOPPING: ["Cart Abandoner", "The Impulse Merchant", "Free Shipping Prophet", "Checkout Final Boss", "The Wallet Vacuum"],
};
const FALLBACK_ROASTS = [
  "You called this research, but your search history calls it a cry for help.",
  "This has survived three cleanup attempts through pure emotional blackmail.",
  "Open long enough to become infrastructure, useful enough to avoid accountability.",
  "You keep returning here like the next refresh contains personal growth.",
  "Pinned in your browser and apparently also in your unresolved business.",
  "A tiny rectangle carrying an unreasonable amount of your personality.",
  "The browser equivalent of putting something on a chair instead of away.",
  "You were definitely going to finish this right after one completely unrelated tab.",
  "It started as a quick check and is now legally part of the desktop.",
  "Somewhere beneath this tab is the task you originally opened Chrome to complete.",
];

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
  if (/amazon|ebay|etsy|shop|shopping|cart|checkout|store|marketplace|doordash|ubereats/.test(text)) return "SHOPPING";
  if (/github|docs|canvas|notion|slack|gmail|course|learn|school|research|paper|scholar|linkedin|work/.test(text)) return "ACADEMIC";
  if (/youtube|netflix|twitch|spotify|game|meme|tiktok|reddit|discord|twitter|x\.com|facebook|instagram|social/.test(text)) return "ENTERTAINMENT";
  if (/google|stackoverflow|maps|weather|localhost|tool|search/.test(text)) return "UTILITY";
  return CARD_TYPES[hash[4]! % CARD_TYPES.length]!;
}

function titleToken(tab: BrowserTab): string {
  const ignored = new Set([
    "this", "that", "with", "from", "your", "home", "page", "google", "www",
    ...tab.domain.toLowerCase().split(/[.-]/),
  ]);
  const words = tab.title.match(/[a-zA-Z][a-zA-Z0-9'-]{3,}/g) ?? [];
  const token = words
    .filter((word) => !ignored.has(word.toLowerCase()))
    .sort((left, right) => right.length - left.length)[0];
  if (!token) return "Unclosed";
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function fallbackCard(tab: BrowserTab): TabCard {
  const seed = `${tab.domain}|${tab.title}`;
  const hash = hashNumbers(seed);
  const abilityId = ABILITY_IDS[hash[5]! % ABILITY_IDS.length]!;
  const [abilityName, abilityDescription] = ABILITY_COPY[abilityId];
  const type = inferType(tab, hash);
  const rawStats = Object.fromEntries(
    STAT_NAMES.map((name, index) => [name, 1 + (hash[index]! % 9)]),
  ) as Record<StatName, number>;
  const token = titleToken(tab);
  const baseName = FALLBACK_NAMES[type][hash[6]! % FALLBACK_NAMES[type].length]!;
  const cardName = `${baseName}: ${token}`.slice(0, 48);
  const rawRoast = tab.audible
    ? `Still playing audio from ${tab.domain} because silence might reveal your choices.`
    : tab.pinned
      ? `Pinned on ${tab.domain}: ${FALLBACK_ROASTS[hash[8]! % FALLBACK_ROASTS.length]!.toLowerCase()}`
      : `${FALLBACK_ROASTS[hash[8]! % FALLBACK_ROASTS.length]!} Apparently "${token}" was essential.`;
  const roast = rawRoast.slice(0, 120);

  return {
    id: randomUUID(),
    tabId: tab.tabId,
    originalTitle: tab.title,
    originalUrl: tab.url,
    domain: tab.domain,
    faviconUrl: tab.faviconUrl,
    cardName,
    type,
    stats: normalizeStats(rawStats, seed),
    abilityId,
    abilityName,
    abilityDescription,
    roast,
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
    abilityId,
    abilityName: safeText(candidate.abilityName, defaultAbility[0], 40),
    abilityDescription: defaultAbility[1],
    roast: safeText(candidate.roast, fallback.roast, 120),
  };
}

async function compileWithGemini(tabs: BrowserTab[]): Promise<TabCard[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini is not configured");
  const configuredModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const prompt = `You are the semantic compiler for Tabmaggedon, an internet-themed card game.
Interpret each browser tab and return one object per input, in the same order.
Allowed types: ${CARD_TYPES.join(", ")}.
ACADEMIC means school, research, or focused work. ENTERTAINMENT means media, games, or social feeds.
SHOPPING means stores, carts, delivery, or marketplaces. UTILITY means tools, search, references, maps,
or practical information.
Allowed abilities: ${ABILITY_IDS.join(", ")}.
Stats are integers from 1 to 9 for ram, uselessness, shadiness, and aura. They should express semantic
traits; a deterministic validator will rebalance them. Never invent mechanics.
cardName must be an original, dramatic card nickname inspired by the page's meaning. Never copy or
slightly truncate the original tab title or simply use the site/domain name. roast must be a unique,
page-specific quote that jokes about why this exact tab is open. Every cardName and roast in the deck
must be distinct. Keep cardName under 48 characters, abilityName under 40, and roast under 120.
Return only JSON in this shape:
{"cards":[{"cardName":"...","type":"ACADEMIC","stats":{"ram":5,"uselessness":5,"shadiness":5,"aura":5},"abilityId":"OVERCLOCK","abilityName":"...","roast":"..."}]}

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

  const models = [...new Set([configuredModel, "gemini-3.8-flash", "gemini-flash-latest"])];
  let response: Response | undefined;
  let lastError: Error | undefined;
  for (const model of models) {
    const candidate = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(12_000),
      },
    );
    if (candidate.ok) {
      response = candidate;
      break;
    }
    const detail = (await candidate.text()).replace(/\s+/g, " ").slice(0, 400);
    lastError = new Error(`Gemini ${model} returned ${candidate.status}: ${detail}`);
    if (candidate.status !== 404) throw lastError;
    console.warn(`${lastError.message} Trying the next supported model.`);
  }
  if (!response) throw lastError ?? new Error("No Gemini model was available");
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
