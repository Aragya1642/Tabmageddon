import "dotenv/config";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { Server, type Socket } from "socket.io";
import { compileCards } from "./cardCompiler.js";
import { CRISES } from "./crises.js";
import { resolveBattle, shuffle } from "./gameEngine.js";
import {
  ABILITY_IDS,
  AVATAR_IDS,
  CARD_TYPES,
  type AvatarId,
  type BrowserTab,
  type GameRoom,
  type Player,
  type PublicRoom,
  type TabCard,
} from "./types.js";

const port = Number(process.env.PORT || 3001);
const configuredOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const renderOrigin = process.env.RENDER_EXTERNAL_HOSTNAME
  ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
  : undefined;
const clientOrigins = [...new Set([...configuredOrigins, ...(renderOrigin ? [renderOrigin] : [])])];
const app = express();
app.use(cors({ origin: clientOrigins }));
app.use(express.json({ limit: "100kb" }));

function sanitizeUrl(input: string): { url: string; domain: string } {
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol)) return { url: "", domain: "local-tab" };
    return { url: `${url.origin}${url.pathname}`.slice(0, 500), domain: url.hostname.slice(0, 100) };
  } catch {
    return { url: "", domain: "local-tab" };
  }
}

function isBrowserTab(value: unknown): value is BrowserTab {
  if (!value || typeof value !== "object") return false;
  const tab = value as Record<string, unknown>;
  return Number.isInteger(tab.tabId) && typeof tab.title === "string" && typeof tab.url === "string";
}

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "tabmaggedon-server" });
});

app.post("/api/compile", async (request, response) => {
  const rawTabs = (request.body as { tabs?: unknown })?.tabs;
  if (!Array.isArray(rawTabs) || rawTabs.length < 1 || rawTabs.length > 7 || !rawTabs.every(isBrowserTab)) {
    response.status(400).json({ error: "Send between 1 and 7 valid browser tabs." });
    return;
  }
  const tabs = rawTabs.map((raw) => {
    const cleaned = sanitizeUrl(raw.url);
    return {
      ...raw,
      title: raw.title.slice(0, 180),
      url: cleaned.url,
      domain: cleaned.domain,
      faviconUrl: typeof raw.faviconUrl === "string" ? raw.faviconUrl.slice(0, 500) : undefined,
    };
  });
  response.json(await compileCards(tabs));
});

app.post("/api/rehab", async (request, response) => {
  const rawTabs = (request.body as { tabs?: unknown })?.tabs;
  if (!Array.isArray(rawTabs) || rawTabs.length > 50 || !rawTabs.every(isBrowserTab)) {
    response.status(400).json({ error: "Send up to 50 valid browser tabs." });
    return;
  }
  const tabs = rawTabs.map((raw) => {
    const cleaned = sanitizeUrl(raw.url);
    return {
      ...raw,
      title: raw.title.slice(0, 180),
      url: cleaned.url,
      domain: cleaned.domain,
      faviconUrl: typeof raw.faviconUrl === "string" ? raw.faviconUrl.slice(0, 500) : undefined,
    };
  });
  const batches: BrowserTab[][] = [];
  for (let index = 0; index < tabs.length; index += 7) batches.push(tabs.slice(index, index + 7));
  const compiled = await Promise.all(batches.map((batch) => compileCards(batch)));
  response.json({
    cards: compiled.flatMap((batch) => batch.cards),
    source: compiled.length > 0 && compiled.every((batch) => batch.source === "gemini") ? "gemini" : "fallback",
  });
});

if (process.env.NODE_ENV === "production") {
  const webDist = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");
  app.use(express.static(webDist));
  app.use((request, response, next) => {
    if (request.method === "GET" && request.accepts("html")) {
      response.sendFile(resolve(webDist, "index.html"));
      return;
    }
    next();
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: clientOrigins } });
const rooms = new Map<string, GameRoom>();
const roomTimers = new Map<string, ReturnType<typeof setTimeout>>();
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

function roomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  do {
    let code = "";
    for (let index = 0; index < 4; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!rooms.has(code)) return code;
  } while (true);
}

function cleanName(value: unknown): string {
  if (typeof value !== "string") throw new Error("Enter a display name.");
  const name = value.trim();
  if (name.length < 2 || name.length > 18) throw new Error("Name must be 2–18 characters.");
  return name;
}

function createPlayer(socket: Socket, rawName: unknown): Player {
  return {
    id: crypto.randomUUID(),
    socketId: socket.id,
    sessionToken: crypto.randomUUID(),
    name: cleanName(rawName),
    connected: true,
    deck: [],
    deckFinalized: false,
    usedCardIds: [],
    locked: false,
    readyToContinue: false,
    score: 0,
  };
}

function roomForSocket(socket: Socket): GameRoom | undefined {
  return [...rooms.values()].find((room) => room.players.some((player) => player.socketId === socket.id));
}

function playerForSocket(room: GameRoom, socket: Socket): Player {
  const player = room.players.find((entry) => entry.socketId === socket.id);
  if (!player) throw new Error("You are not in this room.");
  return player;
}

function roomView(room: GameRoom, viewerId: string): PublicRoom {
  const revealSelections = ["RESULT", "SUDDEN_DEATH_RESULT", "GAME_OVER", "TAB_REHAB"].includes(room.phase);
  const maskCard = (card: TabCard) => ({ ...card, tabId: -1, originalUrl: "" });
  const { remainingCrises: _secretCrisisOrder, players: _privatePlayers, ...publicRoom } = room;
  return {
    ...publicRoom,
    lastResult: room.lastResult
      ? {
          ...room.lastResult,
          scores: room.lastResult.scores.map((score) => ({
            ...score,
            card: score.playerId === viewerId ? score.card : maskCard(score.card),
          })),
        }
      : undefined,
    players: room.players.map(({ socketId: _socketId, sessionToken: _sessionToken, ...player }) => ({
      ...player,
      selectedCardId: player.id === viewerId || revealSelections ? player.selectedCardId : undefined,
      deck: player.id === viewerId ? player.deck : [],
    })),
  };
}

function broadcastRoom(room: GameRoom): void {
  for (const player of room.players) io.to(player.socketId).emit("ROOM_UPDATED", roomView(room, player.id));
}

function emitError(socket: Socket, error: unknown): void {
  socket.emit("ERROR", error instanceof Error ? error.message : "Something went wrong.");
}

function resetChoices(players: Player[]): void {
  for (const player of players) {
    player.selectedCardId = undefined;
    player.locked = false;
    player.autoLocked = false;
    player.readyToContinue = false;
  }
}

function activePlayers(room: GameRoom): Player[] {
  if (room.phase.startsWith("SUDDEN_DEATH")) {
    return room.players.filter((player) => room.suddenDeathPlayerIds?.includes(player.id));
  }
  return room.players;
}

function clearSelectionTimer(room: GameRoom): void {
  const timer = roomTimers.get(room.code);
  if (timer) clearTimeout(timer);
  roomTimers.delete(room.code);
  room.selectionDeadline = undefined;
}

function resolveLockedRoom(room: GameRoom): void {
  const participants = activePlayers(room);
  if (!participants.every((player) => player.locked && player.selectedCardId)) return;
  clearSelectionTimer(room);
  const isSuddenDeath = room.phase === "SUDDEN_DEATH_SELECTING";
  const crisis = isSuddenDeath
    ? shuffle(room.suddenDeathOptions ?? [])[0]
    : room.currentCrisis;
  if (!crisis) throw new Error("No crisis is available.");
  room.currentCrisis = crisis;
  const result = resolveBattle(room, crisis, participants, isSuddenDeath);
  room.lastResult = result;
  for (const player of room.players) player.readyToContinue = false;
  if (isSuddenDeath) {
    room.phase = "SUDDEN_DEATH_RESULT";
    return;
  }
  for (const entry of participants) entry.usedCardIds.push(entry.selectedCardId!);
  const winner = room.players.find((entry) => entry.id === result.winnerId);
  if (winner) winner.score += 1;
  room.phase = "RESULT";
}

function startSelectionTimer(room: GameRoom): void {
  clearSelectionTimer(room);
  const deadline = Date.now() + room.selectionSeconds * 1000;
  room.selectionDeadline = deadline;
  roomTimers.set(room.code, setTimeout(() => {
    const liveRoom = rooms.get(room.code);
    if (
      !liveRoom
      || liveRoom.selectionDeadline !== deadline
      || !["SELECTING", "SUDDEN_DEATH_SELECTING"].includes(liveRoom.phase)
    ) return;
    const standardRound = liveRoom.phase === "SELECTING";
    for (const player of activePlayers(liveRoom)) {
      if (!player.selectedCardId) {
        const available = player.deck.filter((card) =>
          !standardRound || !player.usedCardIds.includes(card.id),
        );
        player.selectedCardId = shuffle(available)[0]?.id;
        player.autoLocked = true;
      }
      player.locked = true;
    }
    resolveLockedRoom(liveRoom);
    broadcastRoom(liveRoom);
  }, room.selectionSeconds * 1000));
}

function newSuddenDeath(room: GameRoom, tiedIds: string[]): void {
  room.suddenDeathPlayerIds = tiedIds;
  room.suddenDeathOptions = shuffle(CRISES).slice(0, 3);
  room.currentCrisis = undefined;
  room.lastResult = undefined;
  resetChoices(room.players);
  room.phase = "SUDDEN_DEATH_SELECTING";
  startSelectionTimer(room);
}

function beginMatch(room: GameRoom): void {
  if (room.phase !== "MATCH_INTRO") return;
  room.currentRound = 1;
  room.currentCrisis = room.remainingCrises.shift();
  room.lastResult = undefined;
  resetChoices(room.players);
  room.phase = "SELECTING";
  startSelectionTimer(room);
}

function scheduleMatchIntro(room: GameRoom): void {
  clearSelectionTimer(room);
  room.phase = "MATCH_INTRO";
  roomTimers.set(room.code, setTimeout(() => {
    const liveRoom = rooms.get(room.code);
    if (!liveRoom || liveRoom.phase !== "MATCH_INTRO") return;
    beginMatch(liveRoom);
    broadcastRoom(liveRoom);
  }, 1800));
}

function advanceRoom(room: GameRoom): void {
  if (room.phase === "RESULT") {
    if (room.currentRound < room.roundCount) {
      room.currentRound += 1;
      room.currentCrisis = room.remainingCrises.shift();
      room.lastResult = undefined;
      resetChoices(room.players);
      room.phase = "SELECTING";
      startSelectionTimer(room);
      return;
    }
    const highScore = Math.max(...room.players.map((player) => player.score));
    const leaders = room.players.filter((player) => player.score === highScore);
    if (leaders.length === 1) {
      room.winnerId = leaders[0]!.id;
      room.phase = "GAME_OVER";
      clearSelectionTimer(room);
    } else {
      newSuddenDeath(room, leaders.map((player) => player.id));
    }
    return;
  }

  if (room.phase === "SUDDEN_DEATH_RESULT") {
    if (room.lastResult?.winnerId) {
      room.winnerId = room.lastResult.winnerId;
      room.phase = "GAME_OVER";
      clearSelectionTimer(room);
    } else {
      newSuddenDeath(room, room.lastResult?.tiedPlayerIds ?? room.suddenDeathPlayerIds ?? []);
    }
  }
}

function tryAdvanceFromResults(room: GameRoom): void {
  if (!["RESULT", "SUDDEN_DEATH_RESULT"].includes(room.phase)) return;
  const voters = room.players.filter((player) => player.connected);
  if (voters.length === 0 || voters.some((player) => !player.readyToContinue)) return;
  for (const player of room.players) player.readyToContinue = false;
  advanceRoom(room);
}

function validCard(value: unknown): value is TabCard {
  if (!value || typeof value !== "object") return false;
  const card = value as TabCard;
  const stats = card.stats && Object.values(card.stats);
  return (
    typeof card.id === "string" &&
    Number.isInteger(card.tabId) &&
    typeof card.originalTitle === "string" &&
    typeof card.originalUrl === "string" &&
    typeof card.domain === "string" &&
    typeof card.cardName === "string" &&
    CARD_TYPES.includes(card.type) &&
    ABILITY_IDS.includes(card.abilityId) &&
    Array.isArray(stats) &&
    stats.length === 4 &&
    stats.every((stat) => Number.isInteger(stat) && stat >= 1 && stat <= 9) &&
    stats.reduce((sum, stat) => sum + stat, 0) === 20
  );
}

function removePlayer(room: GameRoom, socketId: string): void {
  const departing = room.players.find((player) => player.socketId === socketId);
  if (!departing) return;
  const disconnectTimer = disconnectTimers.get(departing.id);
  if (disconnectTimer) clearTimeout(disconnectTimer);
  disconnectTimers.delete(departing.id);
  room.players = room.players.filter((player) => player.socketId !== socketId);
  room.suddenDeathPlayerIds = room.suddenDeathPlayerIds?.filter((id) => id !== departing.id);
  if (room.players.length === 0) {
    clearSelectionTimer(room);
    rooms.delete(room.code);
    return;
  }
  if (!room.players.some((player) => player.id === room.hostId)) room.hostId = room.players[0]!.id;
  if (room.phase !== "LOBBY" && room.players.length === 1) {
    clearSelectionTimer(room);
    room.winnerId = room.players[0]!.id;
    room.phase = "GAME_OVER";
  } else if (room.phase.startsWith("SUDDEN_DEATH") && room.suddenDeathPlayerIds?.length === 1) {
    clearSelectionTimer(room);
    room.winnerId = room.suddenDeathPlayerIds[0];
    room.phase = "GAME_OVER";
  } else if (["SELECTING", "SUDDEN_DEATH_SELECTING"].includes(room.phase)) {
    resolveLockedRoom(room);
  }
  broadcastRoom(room);
}

function markDisconnected(room: GameRoom, socketId: string): void {
  const player = room.players.find((entry) => entry.socketId === socketId);
  if (!player) return;
  player.connected = false;
  if (room.phase === "LOBBY") {
    disconnectTimers.set(player.id, setTimeout(() => {
      const liveRoom = rooms.get(room.code);
      const livePlayer = liveRoom?.players.find((entry) => entry.id === player.id);
      if (liveRoom && livePlayer && !livePlayer.connected) removePlayer(liveRoom, livePlayer.socketId);
    }, 90_000));
  }
  broadcastRoom(room);
}

io.on("connection", (socket) => {
  socket.on("CREATE_ROOM", (payload: { name?: unknown; roundCount?: unknown; selectionSeconds?: unknown }, callback?: (data: unknown) => void) => {
    try {
      const roundCount = [3, 5, 7].includes(Number(payload?.roundCount)) ? (Number(payload.roundCount) as 3 | 5 | 7) : 5;
      const selectionSeconds = [30, 45, 60].includes(Number(payload?.selectionSeconds))
        ? (Number(payload.selectionSeconds) as 30 | 45 | 60)
        : 30;
      const player = createPlayer(socket, payload?.name);
      const crisisPool = shuffle(CRISES).slice(0, roundCount);
      const room: GameRoom = {
        code: roomCode(),
        createdAt: Date.now(),
        hostId: player.id,
        roundCount,
        selectionSeconds,
        currentRound: 0,
        phase: "LOBBY",
        players: [player],
        crisisPool,
        remainingCrises: shuffle(crisisPool),
      };
      rooms.set(room.code, room);
      socket.join(room.code);
      callback?.({ ok: true, playerId: player.id, sessionToken: player.sessionToken, room: roomView(room, player.id) });
      broadcastRoom(room);
    } catch (error) {
      callback?.({ ok: false, error: error instanceof Error ? error.message : "Could not create room." });
    }
  });

  socket.on("JOIN_ROOM", (payload: { name?: unknown; code?: unknown }, callback?: (data: unknown) => void) => {
    try {
      const code = typeof payload?.code === "string" ? payload.code.trim().toUpperCase() : "";
      const room = rooms.get(code);
      if (!room) throw new Error("That room doesn't exist.");
      if (room.phase !== "LOBBY") throw new Error("That match already started.");
      if (room.players.length >= 6) throw new Error("Lobby full. Maximum 6 players.");
      const player = createPlayer(socket, payload?.name);
      if (room.players.some((entry) => entry.name.toLowerCase() === player.name.toLowerCase())) {
        throw new Error("Someone in this room already has that name.");
      }
      room.players.push(player);
      socket.join(code);
      callback?.({ ok: true, playerId: player.id, sessionToken: player.sessionToken, room: roomView(room, player.id) });
      broadcastRoom(room);
    } catch (error) {
      callback?.({ ok: false, error: error instanceof Error ? error.message : "Could not join room." });
    }
  });

  socket.on("RESUME_SESSION", (payload: { code?: unknown; sessionToken?: unknown }, callback?: (data: unknown) => void) => {
    try {
      const code = typeof payload?.code === "string" ? payload.code.trim().toUpperCase() : "";
      const token = typeof payload?.sessionToken === "string" ? payload.sessionToken : "";
      const room = rooms.get(code);
      const player = room?.players.find((entry) => entry.sessionToken === token);
      if (!room || !player) throw new Error("That room session expired.");
      player.socketId = socket.id;
      player.connected = true;
      const disconnectTimer = disconnectTimers.get(player.id);
      if (disconnectTimer) clearTimeout(disconnectTimer);
      disconnectTimers.delete(player.id);
      socket.join(room.code);
      callback?.({ ok: true, playerId: player.id, sessionToken: player.sessionToken, room: roomView(room, player.id) });
      broadcastRoom(room);
    } catch (error) {
      callback?.({ ok: false, error: error instanceof Error ? error.message : "Could not restore session." });
    }
  });

  socket.on("CLAIM_AVATAR", (avatarId: unknown) => {
    try {
      const room = roomForSocket(socket);
      if (!room || room.phase !== "LOBBY") throw new Error("Avatars can only be chosen in the lobby.");
      const player = playerForSocket(room, socket);
      if (typeof avatarId !== "string" || !AVATAR_IDS.includes(avatarId as AvatarId)) {
        throw new Error("Choose a valid avatar.");
      }
      if (room.players.some((entry) => entry.id !== player.id && entry.avatarId === avatarId)) {
        throw new Error("Too slow. Pick another.");
      }
      player.avatarId = avatarId as AvatarId;
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("START_TAB_SELECTION", () => {
    try {
      const room = roomForSocket(socket);
      if (!room || room.phase !== "LOBBY") throw new Error("Tab selection cannot start now.");
      const player = playerForSocket(room, socket);
      if (player.id !== room.hostId) throw new Error("Only the host can start tab picking.");
      if (room.players.length < 2) throw new Error("Need at least 2 players.");
      if (room.players.some((entry) => !entry.avatarId)) throw new Error("Everyone must choose an avatar.");
      room.phase = "TAB_SELECTION";
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("SET_ROUND_COUNT", (roundCount: unknown) => {
    try {
      const room = roomForSocket(socket);
      if (!room) throw new Error("Room not found.");
      const player = playerForSocket(room, socket);
      if (player.id !== room.hostId || room.phase !== "LOBBY") throw new Error("Only the host can change match length.");
      if (![3, 5, 7].includes(Number(roundCount))) throw new Error("Round count must be 3, 5, or 7.");
      if (room.players.some((entry) => entry.deck.length > 0)) throw new Error("Match length is locked after deck forging starts.");
      room.roundCount = Number(roundCount) as 3 | 5 | 7;
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("SET_SELECTION_TIME", (seconds: unknown) => {
    try {
      const room = roomForSocket(socket);
      if (!room) throw new Error("Room not found.");
      const player = playerForSocket(room, socket);
      if (player.id !== room.hostId || room.phase !== "LOBBY") {
        throw new Error("Only the host can change selection time.");
      }
      if (![30, 45, 60].includes(Number(seconds))) {
        throw new Error("Selection time must be 30, 45, or 60 seconds.");
      }
      room.selectionSeconds = Number(seconds) as 30 | 45 | 60;
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("SUBMIT_DECK", (cards: unknown) => {
    try {
      const room = roomForSocket(socket);
      if (!room || room.phase !== "TAB_SELECTION") throw new Error("Decks can only be finalized during tab selection.");
      const player = playerForSocket(room, socket);
      if (player.deckFinalized) throw new Error("Your deck is already locked.");
      if (!Array.isArray(cards) || cards.length !== room.roundCount || !cards.every(validCard)) {
        throw new Error(`Your deck must contain ${room.roundCount} legal cards.`);
      }
      if (new Set(cards.map((card) => card.id)).size !== cards.length) {
        throw new Error("Every card must have a unique ID.");
      }
      player.deck = cards;
      player.deckFinalized = true;
      if (room.players.every((entry) => entry.deckFinalized)) scheduleMatchIntro(room);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("SELECT_CARD", (cardId: unknown) => {
    try {
      const room = roomForSocket(socket);
      if (!room || !["SELECTING", "SUDDEN_DEATH_SELECTING"].includes(room.phase)) throw new Error("Cards cannot be selected now.");
      const player = playerForSocket(room, socket);
      if (!activePlayers(room).some((entry) => entry.id === player.id)) throw new Error("You are not in this sudden death.");
      if (player.locked) throw new Error("Your choice is locked.");
      if (typeof cardId !== "string" || !player.deck.some((card) => card.id === cardId)) throw new Error("That card is not yours.");
      if (room.phase === "SELECTING" && player.usedCardIds.includes(cardId)) throw new Error("That card was already used.");
      player.selectedCardId = cardId;
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("CONTINUE_ROUND", () => {
    try {
      const room = roomForSocket(socket);
      if (!room || !["RESULT", "SUDDEN_DEATH_RESULT"].includes(room.phase)) throw new Error("Nothing to continue yet.");
      const player = playerForSocket(room, socket);
      player.readyToContinue = true;
      tryAdvanceFromResults(room);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("LOCK_IN", () => {
    try {
      const room = roomForSocket(socket);
      if (!room || !["SELECTING", "SUDDEN_DEATH_SELECTING"].includes(room.phase)) throw new Error("You cannot lock now.");
      const player = playerForSocket(room, socket);
      const participants = activePlayers(room);
      if (!participants.some((entry) => entry.id === player.id)) throw new Error("You are not in this battle.");
      if (!player.selectedCardId) throw new Error("Choose a card first.");
      player.locked = true;
      resolveLockedRoom(room);
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("DEV_FORCE_TIE", () => {
    try {
      const room = roomForSocket(socket);
      if (!room) throw new Error("Room not found.");
      const player = playerForSocket(room, socket);
      if (player.id !== room.hostId || room.players.length < 2) throw new Error("Host needs at least two players.");
      if (room.players.some((entry) => entry.deck.length !== room.roundCount)) throw new Error("Everyone needs a deck.");
      for (const entry of room.players) entry.score = 1;
      newSuddenDeath(room, room.players.map((entry) => entry.id));
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("LEAVE_ROOM", () => {
    const room = roomForSocket(socket);
    if (!room) return;
    socket.leave(room.code);
    removePlayer(room, socket.id);
  });

  socket.on("disconnect", () => {
    const room = roomForSocket(socket);
    if (room) markDisconnected(room, socket.id);
  });
});

httpServer.listen(port, () => {
  console.log(`Tabmaggedon server listening on http://localhost:${port}`);
});
