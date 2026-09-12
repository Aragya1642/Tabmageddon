import "dotenv/config";
import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { Server, type Socket } from "socket.io";
import { compileCards } from "./cardCompiler.js";
import { CRISES } from "./crises.js";
import { resolveBattle, shuffle } from "./gameEngine.js";
import {
  ABILITY_IDS,
  CARD_TYPES,
  RARITIES,
  type BrowserTab,
  type GameRoom,
  type Player,
  type PublicRoom,
  type TabCard,
} from "./types.js";

const port = Number(process.env.PORT || 3001);
const clientOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",").map((value) => value.trim());
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

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: clientOrigins } });
const rooms = new Map<string, GameRoom>();

function roomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  do {
    let code = "";
    for (let index = 0; index < 4; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!rooms.has(code)) return code;
  } while (true);
}

function cleanName(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 20) : "Anonymous Tabber";
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
  return {
    ...room,
    lastResult: room.lastResult
      ? {
          ...room.lastResult,
          scores: room.lastResult.scores.map((score) => ({
            ...score,
            card: score.playerId === viewerId ? score.card : maskCard(score.card),
          })),
        }
      : undefined,
    players: room.players.map(({ socketId: _socketId, ...player }) => ({
      ...player,
      selectedCardId: player.id === viewerId || revealSelections ? player.selectedCardId : undefined,
      deck: player.deck.map((card) =>
        player.id === viewerId ? card : maskCard(card),
      ),
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
  }
}

function activePlayers(room: GameRoom): Player[] {
  if (room.phase.startsWith("SUDDEN_DEATH")) {
    return room.players.filter((player) => room.suddenDeathPlayerIds?.includes(player.id));
  }
  return room.players;
}

function newSuddenDeath(room: GameRoom, tiedIds: string[]): void {
  room.suddenDeathPlayerIds = tiedIds;
  room.suddenDeathOptions = shuffle(CRISES).slice(0, 3);
  room.currentCrisis = undefined;
  room.lastResult = undefined;
  resetChoices(room.players);
  room.phase = "SUDDEN_DEATH_SELECTING";
}

function advanceRoom(room: GameRoom): void {
  if (room.phase === "RESULT") {
    if (room.currentRound < room.roundCount) {
      room.currentRound += 1;
      room.currentCrisis = room.remainingCrises.shift();
      room.lastResult = undefined;
      resetChoices(room.players);
      room.phase = "SELECTING";
      return;
    }
    const highScore = Math.max(...room.players.map((player) => player.score));
    const leaders = room.players.filter((player) => player.score === highScore);
    if (leaders.length === 1) {
      room.winnerId = leaders[0]!.id;
      room.phase = "GAME_OVER";
    } else {
      newSuddenDeath(room, leaders.map((player) => player.id));
    }
    return;
  }

  if (room.phase === "SUDDEN_DEATH_RESULT") {
    if (room.lastResult?.winnerId) {
      room.winnerId = room.lastResult.winnerId;
      room.phase = "GAME_OVER";
    } else {
      newSuddenDeath(room, room.lastResult?.tiedPlayerIds ?? room.suddenDeathPlayerIds ?? []);
    }
  }
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
    RARITIES.includes(card.rarity) &&
    ABILITY_IDS.includes(card.abilityId) &&
    Array.isArray(stats) &&
    stats.length === 4 &&
    stats.every((stat) => Number.isInteger(stat) && stat >= 1 && stat <= 9) &&
    stats.reduce((sum, stat) => sum + stat, 0) === 20
  );
}

io.on("connection", (socket) => {
  socket.on("CREATE_ROOM", (payload: { name?: unknown; roundCount?: unknown }, callback?: (data: unknown) => void) => {
    try {
      const roundCount = [3, 5, 7].includes(Number(payload?.roundCount)) ? (Number(payload.roundCount) as 3 | 5 | 7) : 5;
      const player: Player = {
        id: crypto.randomUUID(),
        socketId: socket.id,
        name: cleanName(payload?.name),
        deck: [],
        usedCardIds: [],
        locked: false,
        score: 0,
      };
      const room: GameRoom = {
        code: roomCode(),
        hostId: player.id,
        roundCount,
        currentRound: 0,
        phase: "LOBBY",
        players: [player],
        crisisPool: [],
        remainingCrises: [],
      };
      rooms.set(room.code, room);
      socket.join(room.code);
      callback?.({ ok: true, playerId: player.id, room: roomView(room, player.id) });
      broadcastRoom(room);
    } catch (error) {
      callback?.({ ok: false, error: error instanceof Error ? error.message : "Could not create room." });
    }
  });

  socket.on("JOIN_ROOM", (payload: { name?: unknown; code?: unknown }, callback?: (data: unknown) => void) => {
    try {
      const code = typeof payload?.code === "string" ? payload.code.trim().toUpperCase() : "";
      const room = rooms.get(code);
      if (!room) throw new Error("Room not found.");
      if (room.phase !== "LOBBY") throw new Error("This match has already started.");
      if (room.players.length >= 4) throw new Error("This room is full.");
      const player: Player = {
        id: crypto.randomUUID(),
        socketId: socket.id,
        name: cleanName(payload?.name),
        deck: [],
        usedCardIds: [],
        locked: false,
        score: 0,
      };
      room.players.push(player);
      socket.join(code);
      callback?.({ ok: true, playerId: player.id, room: roomView(room, player.id) });
      broadcastRoom(room);
    } catch (error) {
      callback?.({ ok: false, error: error instanceof Error ? error.message : "Could not join room." });
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

  socket.on("SUBMIT_DECK", (cards: unknown) => {
    try {
      const room = roomForSocket(socket);
      if (!room || room.phase !== "LOBBY") throw new Error("Decks can only be submitted in the lobby.");
      const player = playerForSocket(room, socket);
      if (!Array.isArray(cards) || cards.length !== room.roundCount || !cards.every(validCard)) {
        throw new Error(`Your deck must contain ${room.roundCount} legal cards.`);
      }
      player.deck = cards;
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("START_GAME", () => {
    try {
      const room = roomForSocket(socket);
      if (!room) throw new Error("Room not found.");
      const player = playerForSocket(room, socket);
      if (player.id !== room.hostId || room.phase !== "LOBBY") throw new Error("Only the host can start.");
      if (room.players.length < 2) throw new Error("At least two players are required.");
      if (room.players.some((entry) => entry.deck.length !== room.roundCount)) throw new Error("Everyone must forge a deck first.");
      room.crisisPool = shuffle(CRISES).slice(0, room.roundCount);
      room.remainingCrises = [...room.crisisPool];
      room.phase = "CRISIS_PREVIEW";
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("BEGIN_BATTLE", () => {
    try {
      const room = roomForSocket(socket);
      if (!room) throw new Error("Room not found.");
      const player = playerForSocket(room, socket);
      if (player.id !== room.hostId || room.phase !== "CRISIS_PREVIEW") throw new Error("Only the host can begin.");
      room.currentRound = 1;
      room.currentCrisis = room.remainingCrises.shift();
      room.phase = "SELECTING";
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

  socket.on("LOCK_IN", () => {
    try {
      const room = roomForSocket(socket);
      if (!room || !["SELECTING", "SUDDEN_DEATH_SELECTING"].includes(room.phase)) throw new Error("You cannot lock now.");
      const player = playerForSocket(room, socket);
      const participants = activePlayers(room);
      if (!participants.some((entry) => entry.id === player.id)) throw new Error("You are not in this battle.");
      if (!player.selectedCardId) throw new Error("Choose a card first.");
      player.locked = true;
      if (participants.every((entry) => entry.locked)) {
        const isSuddenDeath = room.phase === "SUDDEN_DEATH_SELECTING";
        const crisis = isSuddenDeath
          ? shuffle(room.suddenDeathOptions ?? [])[0]
          : room.currentCrisis;
        if (!crisis) throw new Error("No crisis is available.");
        room.currentCrisis = crisis;
        const result = resolveBattle(room, crisis, participants, isSuddenDeath);
        room.lastResult = result;
        if (isSuddenDeath) {
          room.phase = "SUDDEN_DEATH_RESULT";
        } else {
          for (const entry of participants) entry.usedCardIds.push(entry.selectedCardId!);
          const winner = room.players.find((entry) => entry.id === result.winnerId);
          if (winner) winner.score += 1;
          room.phase = "RESULT";
        }
      }
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("NEXT_ROUND", () => {
    try {
      const room = roomForSocket(socket);
      if (!room) throw new Error("Room not found.");
      const player = playerForSocket(room, socket);
      if (player.id !== room.hostId) throw new Error("Only the host can continue.");
      if (!["RESULT", "SUDDEN_DEATH_RESULT"].includes(room.phase)) throw new Error("The battle is not ready to continue.");
      advanceRoom(room);
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

  socket.on("ENTER_REHAB", () => {
    try {
      const room = roomForSocket(socket);
      if (!room || room.phase !== "GAME_OVER") throw new Error("Finish the match first.");
      room.phase = "TAB_REHAB";
      broadcastRoom(room);
    } catch (error) {
      emitError(socket, error);
    }
  });

  socket.on("disconnect", () => {
    const room = roomForSocket(socket);
    if (!room || room.phase !== "LOBBY") return;
    room.players = room.players.filter((player) => player.socketId !== socket.id);
    if (room.players.length === 0) rooms.delete(room.code);
    else {
      if (!room.players.some((player) => player.id === room.hostId)) room.hostId = room.players[0]!.id;
      broadcastRoom(room);
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Tabmaggedon server listening on http://localhost:${port}`);
});
