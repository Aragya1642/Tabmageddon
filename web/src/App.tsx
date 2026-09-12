import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { CardView } from "./CardView";
import { DEMO_TABS } from "./demoTabs";
import { closeLiveTab, importLiveTabs } from "./extensionBridge";
import type { BrowserTab, Player, Room, TabCard } from "./types";
import "./App.css";

const SERVER_URL = import.meta.env.VITE_SERVER_URL
  || (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);
const socket = io(SERVER_URL);

interface RoomReply {
  ok: boolean;
  playerId?: string;
  room?: Room;
  error?: string;
}

function playerName(room: Room, id?: string): string {
  return room.players.find((player) => player.id === id)?.name ?? "Nobody";
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function App() {
  const [room, setRoom] = useState<Room>();
  const [playerId, setPlayerId] = useState("");
  const [error, setError] = useState("");
  const [deckOpen, setDeckOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const update = (nextRoom: Room) => setRoom(nextRoom);
    const showError = (message: string) => setError(message);
    socket.on("ROOM_UPDATED", update);
    socket.on("ERROR", showError);
    return () => {
      socket.off("ROOM_UPDATED", update);
      socket.off("ERROR", showError);
    };
  }, []);

  const currentPlayer = room?.players.find((player) => player.id === playerId);

  async function copyRoomCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(`Copy failed. Room code: ${room.code}`);
    }
  }

  function acceptRoom(reply: RoomReply) {
    if (!reply.ok || !reply.playerId || !reply.room) {
      setError(reply.error || "Unable to enter room.");
      return;
    }
    setError("");
    setPlayerId(reply.playerId);
    setRoom(reply.room);
  }

  function goHome() {
    if (room) socket.emit("LEAVE_ROOM");
    setRoom(undefined);
    setPlayerId("");
    setDeckOpen(false);
    setCopied(false);
    setError("");
  }

  return (
    <main>
      <header className="site-header">
        <button type="button" className="brand" onClick={goHome}>TAB<span>MAGGEDON</span></button>
        <div className="header-actions">
          {currentPlayer && currentPlayer.deck.length > 0 && <button onClick={() => setDeckOpen(true)}>VIEW MY DECK</button>}
          {room && <button className="room-pill" onClick={() => void copyRoomCode()}>ROOM <b>{room.code}</b> <span>{copied ? "COPIED!" : "COPY"}</span></button>}
        </div>
      </header>
      {error && <button className="error-banner" onClick={() => setError("")}>{error} ×</button>}
      {!room && <Landing onCreate={acceptRoom} onJoin={acceptRoom} />}
      {room?.phase === "LOBBY" && currentPlayer && <Lobby room={room} me={currentPlayer} />}
      {room?.phase === "CRISIS_PREVIEW" && <CrisisPreview room={room} playerId={playerId} />}
      {room && currentPlayer && ["SELECTING", "SUDDEN_DEATH_SELECTING"].includes(room.phase) && (
        <Battle room={room} me={currentPlayer} />
      )}
      {room && ["RESULT", "SUDDEN_DEATH_RESULT"].includes(room.phase) && (
        <Result room={room} playerId={playerId} />
      )}
      {room?.phase === "GAME_OVER" && <GameOver room={room} />}
      {room?.phase === "TAB_REHAB" && currentPlayer && <TabRehab me={currentPlayer} onError={setError} />}
      {deckOpen && currentPlayer && <DeckOverlay player={currentPlayer} onClose={() => setDeckOpen(false)} />}
    </main>
  );
}

function DeckOverlay({ player, onClose }: { player: Player; onClose: () => void }) {
  return (
    <div className="modal-backdrop deck-backdrop" role="presentation" onClick={onClose}>
      <section className="deck-modal" role="dialog" aria-modal="true" aria-label="Your deck" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading"><div><p className="eyebrow">AVAILABLE ANYTIME</p><h2>Your deck</h2></div><button onClick={onClose}>CLOSE ×</button></div>
        <p className="type-loop">🎓 ACADEMIC → 🎮 ENTERTAINMENT → 🛒 SHOPPING → 🧰 UTILITY → 🎓 ACADEMIC</p>
        <div className="card-grid">
          {player.deck.map((card) => <CardView key={card.id} card={card} used={player.usedCardIds.includes(card.id)} disabled />)}
        </div>
      </section>
    </div>
  );
}

function Landing({ onCreate, onJoin }: { onCreate: (reply: RoomReply) => void; onJoin: (reply: RoomReply) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [roundCount, setRoundCount] = useState<3 | 5 | 7>(5);
  return (
    <section className="landing panel">
      <p className="eyebrow">YOUR TABS. YOUR DECK. YOUR PROBLEM.</p>
      <h1>The browser apocalypse is <span>multiplayer.</span></h1>
      <p className="lede">Turn your actual open tabs into balanced battle cards, destroy your friends, then clean up the wreckage.</p>
      <div className="entry-grid">
        <div>
          <label>YOUR NAME<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tab warrior" maxLength={20} /></label>
          <label>ROUNDS
            <select value={roundCount} onChange={(event) => setRoundCount(Number(event.target.value) as 3 | 5 | 7)}>
              <option value={3}>3 — Quick</option>
              <option value={5}>5 — Standard</option>
              <option value={7}>7 — Long</option>
            </select>
          </label>
          <button className="primary" disabled={!name.trim()} onClick={() => socket.emit("CREATE_ROOM", { name, roundCount }, onCreate)}>CREATE GAME</button>
        </div>
        <div className="join-box">
          <span>OR JOIN THE CHAOS</span>
          <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={4} />
          <button disabled={!name.trim() || code.length !== 4} onClick={() => socket.emit("JOIN_ROOM", { name, code }, onJoin)}>JOIN GAME</button>
        </div>
      </div>
      <p className="privacy">🔒 Only the tabs you choose become cards.</p>
    </section>
  );
}

function Lobby({ room, me }: { room: Room; me: Player }) {
  const everyoneReady = room.players.length >= 2 && room.players.every((player) => player.deck.length === room.roundCount);
  const isHost = me.id === room.hostId;
  return (
    <section className="panel">
      <div className="section-heading">
        <div><p className="eyebrow">ASSEMBLE YOUR SURVIVORS</p><h2>Lobby <span>{room.code}</span></h2></div>
        <div className="lobby-settings">
          <div className="round-select">
            <label>Rounds</label>
            <select disabled={!isHost || room.players.some((player) => player.deck.length > 0)} value={room.roundCount} onChange={(event) => socket.emit("SET_ROUND_COUNT", Number(event.target.value))}>
              <option value={3}>3</option><option value={5}>5</option><option value={7}>7</option>
            </select>
          </div>
          <div className="round-select">
            <label>Pick timer</label>
            <select disabled={!isHost} value={room.selectionSeconds} onChange={(event) => socket.emit("SET_SELECTION_TIME", Number(event.target.value))}>
              <option value={15}>15 sec</option><option value={30}>30 sec</option><option value={45}>45 sec</option><option value={60}>60 sec</option>
            </select>
          </div>
        </div>
      </div>
      <div className="player-list">
        {room.players.map((player) => (
          <div key={player.id} className="player-row">
            <span className="avatar">{player.name.charAt(0).toUpperCase()}</span>
            <strong>{player.name}{player.id === room.hostId ? " 👑" : ""}</strong>
            <span className={player.deck.length === room.roundCount ? "ready" : "waiting"}>
              {player.deck.length === room.roundCount ? `✓ DECK READY` : `FORGING 0/${room.roundCount}`}
            </span>
          </div>
        ))}
      </div>
      {me.deck.length === 0 ? <TabPicker required={room.roundCount} /> : (
        <div className="deck-ready">
          <h3>Your deck is forged</h3>
          <div className="card-grid">{me.deck.map((card) => <CardView key={card.id} card={card} compact />)}</div>
        </div>
      )}
      {isHost && (
        <div className="host-actions">
          <button className="primary" disabled={!everyoneReady} onClick={() => socket.emit("START_GAME")}>REVEAL THE APOCALYPSE</button>
          {import.meta.env.DEV && <button disabled={!everyoneReady} onClick={() => socket.emit("DEV_FORCE_TIE")}>DEV: FORCE TIE</button>}
        </div>
      )}
      {!isHost && everyoneReady && <p className="center-note">Waiting for the host to start…</p>}
    </section>
  );
}

function TabPicker({ required }: { required: number }) {
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState("");
  const [forging, setForging] = useState(false);

  async function loadLive() {
    setStatus("Asking the extension for your tabs…");
    try {
      const liveTabs = await importLiveTabs();
      const liveDomains = new Set(liveTabs.map((tab) => tab.domain));
      const shortage = Math.max(0, required - liveTabs.length);
      const presets = shuffled(DEMO_TABS.filter((tab) => !liveDomains.has(tab.domain))).slice(0, shortage);
      const nextTabs = [...liveTabs, ...presets];
      setTabs(nextTabs);
      setSelected((current) => current.filter((id) => nextTabs.some((tab) => tab.tabId === id)).slice(0, required));
      setStatus(shortage > 0
        ? `${liveTabs.length} live tab${liveTabs.length === 1 ? "" : "s"} found. Added ${presets.length} random preset${presets.length === 1 ? "" : "s"} so you can play.`
        : `${liveTabs.length} live tabs found. List refreshed.`);
    } catch (loadError) {
      setStatus(loadError instanceof Error ? loadError.message : "Could not import tabs.");
    }
  }

  function loadDemo() {
    const presets = shuffled(DEMO_TABS);
    setTabs(presets);
    setSelected(presets.slice(0, required).map((tab) => tab.tabId));
    setStatus("20 preset tabs shuffled. A random starting deck is selected.");
  }

  function toggle(tabId: number) {
    setSelected((current) => current.includes(tabId)
      ? current.filter((id) => id !== tabId)
      : current.length < required ? [...current, tabId] : current);
  }

  async function forge() {
    const chosenTabs = tabs.filter((tab) => selected.includes(tab.tabId));
    if (chosenTabs.length !== required) return;
    setForging(true);
    setStatus("Gemini is compiling meaning. The engine is enforcing rules…");
    try {
      const response = await fetch(`${SERVER_URL}/api/compile`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tabs: chosenTabs }),
      });
      const result = await response.json() as { cards?: TabCard[]; source?: string; error?: string };
      if (!response.ok || !result.cards) throw new Error(result.error || "Card compilation failed.");
      socket.emit("SUBMIT_DECK", result.cards);
      setStatus(result.source === "gemini" ? "Deck forged by Gemini." : "Deck forged by deterministic fallback.");
    } catch (forgeError) {
      setStatus(forgeError instanceof Error ? forgeError.message : "Could not forge deck.");
    } finally {
      setForging(false);
    }
  }

  return (
    <div className="tab-picker">
      <div className="picker-heading">
        <div><h3>Select your fighters</h3><p>Pick weird tabs. Balanced does not mean normal.</p></div>
        <b>{selected.length} / {required}</b>
      </div>
      <div className="import-actions">
        <button className="primary" disabled={forging} onClick={loadLive}>{tabs.length === 0 ? "IMPORT MY TABS" : "REFRESH LIVE TABS"}</button>
        <button disabled={forging} onClick={loadDemo}>USE PRESET TABS</button>
      </div>
      {status && <p className="status">{status}</p>}
      <div className="tab-list">
        {tabs.map((tab) => (
          <button type="button" key={tab.tabId} className={selected.includes(tab.tabId) ? "tab-option selected-tab" : "tab-option"} onClick={() => toggle(tab.tabId)}>
            <span className="checkbox">{selected.includes(tab.tabId) ? "✓" : ""}</span>
            {tab.faviconUrl ? <img src={tab.faviconUrl} alt="" /> : <span>🌐</span>}
            <span><strong>{tab.title}</strong><small>{tab.domain}{tab.tabId < 0 ? " · PRESET" : ""}{tab.audible ? " · 🔊 playing audio" : ""}</small></span>
          </button>
        ))}
      </div>
      {tabs.length > 0 && <button className="primary forge-button" disabled={selected.length !== required || forging} onClick={forge}>{forging ? "FORGING…" : "FORGE MY DECK"}</button>}
    </div>
  );
}

function CrisisPreview({ room, playerId }: { room: Room; playerId: string }) {
  return (
    <section className="panel">
      <p className="eyebrow">THIS MATCH'S APOCALYPSE</p>
      <h2>You know what's coming.<br /><span>You just don't know when.</span></h2>
      <div className="crisis-grid">
        {room.crisisPool.map((crisis) => (
          <div className="crisis-card" key={crisis.id}><span>⚠</span><h3>{crisis.name}</h3></div>
        ))}
      </div>
      {room.hostId === playerId ? <button className="primary big-action" onClick={() => socket.emit("BEGIN_BATTLE")}>BEGIN TABMAGGEDON</button> : <p className="center-note">The host is deciding when civilization ends…</p>}
    </section>
  );
}

function Battle({ room, me }: { room: Room; me: Player }) {
  const sudden = room.phase === "SUDDEN_DEATH_SELECTING";
  const participating = !sudden || room.suddenDeathPlayerIds?.includes(me.id);
  const availableCards = me.deck;
  return (
    <section className="panel battle">
      <Scoreboard room={room} />
      {sudden ? (
        <div className="sudden-banner">
          <p className="eyebrow">☠ SUDDEN DEATH ☠</p>
          <h2>Choose before fate chooses the crisis.</h2>
          <div className="crisis-options">{room.suddenDeathOptions?.map((crisis) => <span key={crisis.id}>{crisis.name}</span>)}</div>
        </div>
      ) : room.currentCrisis && (
        <div className="current-crisis">
          <p className="eyebrow">🚨 ROUND {room.currentRound} / {room.roundCount}</p>
          <h2>{room.currentCrisis.name}</h2>
        </div>
      )}
      <SelectionTimer deadline={room.selectionDeadline} />
      <div className="lock-status">
        {room.players.filter((player) => !sudden || room.suddenDeathPlayerIds?.includes(player.id)).map((player) => (
          <span key={player.id} className={player.locked ? "locked" : ""}>{player.name} {player.locked ? "🔒 LOCKED" : "Choosing…"}</span>
        ))}
      </div>
      {!participating ? <p className="center-note">The tied leaders are fighting. Enjoy the wreckage.</p> : (
        <>
          <div className="section-heading"><div><h3>Choose one tab</h3><p>Your choice stays hidden until everyone locks.</p></div></div>
          <div className="card-grid">
            {availableCards.map((card) => {
              const used = !sudden && me.usedCardIds.includes(card.id);
              return <CardView key={card.id} card={card} selected={me.selectedCardId === card.id} used={used} disabled={used || me.locked} onClick={() => socket.emit("SELECT_CARD", card.id)} />;
            })}
          </div>
          <button className="primary big-action" disabled={!me.selectedCardId || me.locked} onClick={() => socket.emit("LOCK_IN")}>{me.locked ? "LOCKED IN 🔒" : "LOCK IN"}</button>
        </>
      )}
    </section>
  );
}

function SelectionTimer({ deadline }: { deadline?: number }) {
  const [seconds, setSeconds] = useState(() => deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0);
  useEffect(() => {
    if (!deadline) return;
    const update = () => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    update();
    const interval = window.setInterval(update, 200);
    return () => window.clearInterval(interval);
  }, [deadline]);
  if (!deadline) return null;
  return <div className={`selection-timer ${seconds <= 5 ? "urgent" : ""}`}><b>{seconds}</b><span>SECONDS TO LOCK</span></div>;
}

function Scoreboard({ room }: { room: Room }) {
  return <div className="scoreboard">{room.players.map((player) => <span key={player.id}><b>{player.score}</b>{player.name}</span>)}</div>;
}

function Result({ room, playerId }: { room: Room; playerId: string }) {
  const result = room.lastResult;
  if (!result) return null;
  const isTie = result.tiedPlayerIds.length > 1;
  const tiedNames = result.tiedPlayerIds.map((id) => playerName(room, id)).join(" & ");
  const title = isTie
    ? result.isSuddenDeath ? "SUDDEN DEATH TIE — RUN IT BACK" : `${tiedNames} TIE — EACH GETS A POINT`
    : `${playerName(room, result.winnerId)} WINS`;
  return (
    <section className="panel result-screen">
      <Scoreboard room={room} />
      <p className="eyebrow">{result.isSuddenDeath ? "☠ SUDDEN DEATH RESULT" : `ROUND ${room.currentRound} RESULT`}</p>
      <h2>{result.crisis.name}</h2>
      <p className="crisis-rule">{result.crisis.description}</p>
      <h1>{title}</h1>
      <div className="result-grid">
        {result.scores.map((score) => {
          const tied = isTie && result.tiedPlayerIds.includes(score.playerId);
          const won = !isTie && score.playerId === result.winnerId;
          return (
          <div className={`result-column ${won ? "winner-column" : ""} ${tied ? "tie-column" : ""}`} key={score.playerId}>
            <h3>{playerName(room, score.playerId)}{tied && <span className="tie-badge">TIE{result.isSuddenDeath ? "" : " +1"}</span>}</h3>
            <CardView card={score.card} compact />
            <div className="math-row"><span>Crisis score</span><b>{score.crisisScore}</b></div>
            <div className="math-row"><span>Type matchup</span><b>{score.typeModifier >= 0 ? "+" : ""}{score.typeModifier}</b></div>
            <div className="math-row"><span>{score.abilityNote}</span><b>{score.abilityModifier >= 0 ? "+" : ""}{score.abilityModifier}</b></div>
            <div className="math-row"><span>Luck</span><b>{score.luck >= 0 ? "+" : ""}{score.luck}</b></div>
            <div className="math-row total"><span>FINAL</span><b>{score.finalScore}</b></div>
          </div>
        )})}
      </div>
      {room.hostId === playerId ? <button className="primary big-action" onClick={() => socket.emit("NEXT_ROUND")}>{room.currentRound >= room.roundCount || result.isSuddenDeath ? "SETTLE THE SCORE" : "NEXT CRISIS"}</button> : <p className="center-note">Waiting for the host…</p>}
    </section>
  );
}

function GameOver({ room }: { room: Room }) {
  return (
    <section className="panel winner-screen">
      <p className="eyebrow">THE BROWSER HAS SPOKEN</p>
      <div className="trophy">🏆</div>
      <h1>{playerName(room, room.winnerId)} survived<br /><span>TABMAGGEDON</span></h1>
      <Scoreboard room={room} />
      <button className="primary big-action" onClick={() => socket.emit("ENTER_REHAB")}>ENTER TAB REHAB</button>
    </section>
  );
}

function TabRehab({ me, onError }: { me: Player; onError: (message: string) => void }) {
  const [decisions, setDecisions] = useState<Record<string, "kept" | "closed">>({});
  const remaining = useMemo(() => me.deck.filter((card) => !decisions[card.id]).length, [decisions, me.deck]);
  const closedCount = useMemo(() => Object.values(decisions).filter((decision) => decision === "closed").length, [decisions]);
  const closedPercent = Math.round((closedCount / me.deck.length) * 100);
  const pendingPercent = 100 - closedPercent;
  async function close(card: TabCard) {
    try {
      await closeLiveTab(card.tabId, card.originalUrl);
      setDecisions((current) => ({ ...current, [card.id]: "closed" }));
    } catch (closeError) {
      onError(closeError instanceof Error ? closeError.message : "Could not close that tab.");
    }
  }
  return (
    <section className="panel rehab">
      <p className="eyebrow">POST-GAME CLEANUP</p>
      <h1>TAB REHAB</h1>
      <p className="lede">The battle is over. Do these tabs deserve to survive?</p>
      <p>{remaining} decisions remaining. Nothing closes without your click.</p>
      <div className="cleanup-progress">
        <div><span>PENDING / OPEN</span><b>{pendingPercent}%</b><span>CLOSED</span><b>{closedPercent}%</b></div>
        <div className="cleanup-track"><span style={{ width: `${closedPercent}%` }} /></div>
      </div>
      <div className="rehab-list">
        {me.deck.map((card) => (
          <div className={`rehab-row ${decisions[card.id] ?? ""}`} key={card.id}>
            <CardView card={card} compact />
            {decisions[card.id] ? <strong className="decision">{decisions[card.id] === "closed" ? "CLOSED ✕" : "KEPT ✓"}</strong> : (
              <div><button onClick={() => setDecisions((current) => ({ ...current, [card.id]: "kept" }))}>KEEP</button><button className="danger" onClick={() => void close(card)}>CLOSE TAB</button></div>
            )}
          </div>
        ))}
      </div>
      {remaining === 0 && <h2>Your browser is now slightly less doomed.</h2>}
    </section>
  );
}

export default App;
