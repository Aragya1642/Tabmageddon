import { Children, useEffect, useMemo, useState, type ReactNode } from "react";
import { io } from "socket.io-client";
import { AvatarSprite, type AvatarPose } from "./AvatarSprite";
import { AVATARS } from "./avatars";
import { CardView } from "./CardView";
import { DEMO_TABS } from "./demoTabs";
import { closeLiveTab, importLiveTabs, pingExtension } from "./extensionBridge";
import type { BrowserTab, Crisis, Player, Room, TabCard } from "./types";
import "./App.css";

const SERVER_URL = import.meta.env.VITE_SERVER_URL
  || (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);
const socket = io(SERVER_URL);

interface RoomReply {
  ok: boolean;
  playerId?: string;
  sessionToken?: string;
  room?: Room;
  error?: string;
}

const SESSION_KEY = "tabmaggedon-session";

function vaultSeenKey(code: string, playerId: string): string {
  return `tabmaggedon-vault:${code}:${playerId}`;
}

function crisisRule(crisis: Crisis): string {
  return `${crisis.direction === "HIGH" ? "Highest" : "Lowest"} ${crisis.stat.toUpperCase()} wins.`;
}

function isRealCard(card: TabCard): boolean {
  return card.sourceType !== "synthetic" && card.tabId >= 0;
}

function rowPattern(total: number): number[] {
  if (total <= 3) return [total];
  if (total === 4) return [2, 2];
  if (total === 5) return [3, 2];
  if (total === 6) return [3, 3];
  if (total === 7) return [3, 2, 2];
  return [3, 2, total - 5];
}

function PixelField() {
  const dots = useMemo(() => Array.from({ length: 36 }, (_, index) => ({
    id: index,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    size: 3 + Math.round(Math.random() * 7),
    duration: `${7 + Math.random() * 11}s`,
    delay: `${Math.random() * -10}s`,
    color: ["#931A23", "#8C964F", "#FFFFFF", "#5A3D32", "#BF7759"][index % 5],
  })), []);
  return (
    <div className="pixel-field" aria-hidden>
      {dots.map((dot) => (
        <i key={dot.id} style={{
          left: dot.left,
          top: dot.top,
          width: dot.size,
          height: dot.size,
          background: dot.color,
          animationDuration: dot.duration,
          animationDelay: dot.delay,
        }} />
      ))}
    </div>
  );
}

function CardRows({ children, className = "" }: { children: ReactNode; className?: string }) {
  const items = Children.toArray(children);
  let cursor = 0;
  return (
    <div className={`card-grid stacked-rows ${className}`}>
      {rowPattern(items.length).map((size, index) => {
        const row = items.slice(cursor, cursor + size);
        cursor += size;
        return <div className="card-row" key={index}>{row}</div>;
      })}
    </div>
  );
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
  const [rehabOpen, setRehabOpen] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [vaultSeen, setVaultSeen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);

  useEffect(() => {
    const update = (nextRoom: Room) => setRoom(nextRoom);
    const showError = (message: string) => setError(message);
    const resume = () => {
      const stored = window.localStorage.getItem(SESSION_KEY);
      if (!stored) return;
      try {
        const session = JSON.parse(stored) as { code: string; sessionToken: string };
        setReconnecting(true);
        socket.emit("RESUME_SESSION", session, (reply: RoomReply) => {
          setReconnecting(false);
          if (reply.ok) acceptRoom(reply);
          else window.localStorage.removeItem(SESSION_KEY);
        });
      } catch {
        window.localStorage.removeItem(SESSION_KEY);
      }
    };
    socket.on("ROOM_UPDATED", update);
    socket.on("ERROR", showError);
    socket.on("connect", resume);
    if (socket.connected) resume();
    return () => {
      socket.off("ROOM_UPDATED", update);
      socket.off("ERROR", showError);
      socket.off("connect", resume);
    };
  }, []);

  const currentPlayer = room?.players.find((player) => player.id === playerId);
  const showVaultPage = Boolean(
    room
    && currentPlayer?.deckFinalized
    && !vaultSeen
    && room.crisisPool.length > 0
    && room.phase !== "LOBBY"
  );

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
    setVaultSeen(window.sessionStorage.getItem(vaultSeenKey(reply.room.code, reply.playerId)) === "1");
    setVaultOpen(false);
    if (reply.sessionToken) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify({ code: reply.room.code, sessionToken: reply.sessionToken }));
    }
  }

  function goHome() {
    if (room) socket.emit("LEAVE_ROOM");
    setRoom(undefined);
    setPlayerId("");
    setDeckOpen(false);
    setCopied(false);
    setRehabOpen(false);
    setVaultSeen(false);
    setVaultOpen(false);
    setError("");
    window.localStorage.removeItem(SESSION_KEY);
  }

  function markVaultSeen() {
    setVaultSeen(true);
    setVaultOpen(false);
    if (room && playerId) window.sessionStorage.setItem(vaultSeenKey(room.code, playerId), "1");
  }

  return (
    <main>
      <PixelField />
      <header className="site-header">
        <button type="button" className="brand" onClick={goHome}>TAB<span>MAGGEDON</span></button>
        <div className="header-actions">
          {currentPlayer && currentPlayer.deck.length > 0 && <button onClick={() => setDeckOpen(true)}>VIEW MY DECK</button>}
          {currentPlayer?.deckFinalized && vaultSeen && room && room.crisisPool.length > 0 && (
            <button onClick={() => setVaultOpen(true)}>CRISIS VAULT</button>
          )}
          {room && <button className="room-pill" onClick={() => void copyRoomCode()}>ROOM <b>{room.code}</b> <span>{copied ? "COPIED!" : "COPY"}</span></button>}
        </div>
      </header>
      {reconnecting && <div className="reconnect-overlay">RECONNECTING TO THE ARENA…</div>}
      {error && <button className="error-banner" onClick={() => setError("")}>{error} ×</button>}
      {!room && <Landing onCreate={acceptRoom} onJoin={acceptRoom} />}
      {showVaultPage && room && <CrisisVaultPage crises={room.crisisPool} onContinue={markVaultSeen} />}
      {!showVaultPage && room?.phase === "LOBBY" && currentPlayer && <Lobby room={room} me={currentPlayer} />}
      {!showVaultPage && room?.phase === "TAB_SELECTION" && currentPlayer && <DeckBuilder room={room} me={currentPlayer} />}
      {!showVaultPage && room?.phase === "MATCH_INTRO" && <MatchIntro room={room} />}
      {!showVaultPage && room && currentPlayer && ["SELECTING", "SUDDEN_DEATH_SELECTING"].includes(room.phase) && (
        <Battle room={room} me={currentPlayer} />
      )}
      {!showVaultPage && room && currentPlayer && ["RESULT", "SUDDEN_DEATH_RESULT"].includes(room.phase) && (
        <Result room={room} me={currentPlayer} />
      )}
      {!showVaultPage && room?.phase === "GAME_OVER" && !rehabOpen && <GameOver room={room} onRehab={() => setRehabOpen(true)} />}
      {!showVaultPage && room?.phase === "GAME_OVER" && rehabOpen && currentPlayer && <TabRehab me={currentPlayer} onError={setError} onHome={goHome} />}
      {deckOpen && currentPlayer && <DeckOverlay player={currentPlayer} onClose={() => setDeckOpen(false)} />}
      {vaultOpen && room && <PoolModal room={room} onClose={() => setVaultOpen(false)} />}
    </main>
  );
}

function DeckOverlay({ player, onClose }: { player: Player; onClose: () => void }) {
  return (
    <div className="modal-backdrop deck-backdrop" role="presentation" onClick={onClose}>
      <section className="deck-modal" role="dialog" aria-modal="true" aria-label="Your deck" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading"><div><p className="eyebrow">AVAILABLE ANYTIME</p><h2>Your deck</h2></div><button onClick={onClose}>CLOSE ×</button></div>
        <p className="type-loop">ACADEMIC - ENTERTAINMENT - SHOPPING - UTILITY - ACADEMIC</p>
        <CardRows>
          {player.deck.map((card) => <CardView key={card.id} card={card} used={player.usedCardIds.includes(card.id)} preview />)}
        </CardRows>
      </section>
    </div>
  );
}

function Landing({ onCreate, onJoin }: { onCreate: (reply: RoomReply) => void; onJoin: (reply: RoomReply) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [roundCount, setRoundCount] = useState<3 | 5 | 7>(5);
  const [selectionSeconds, setSelectionSeconds] = useState<30 | 45 | 60>(30);
  const [panel, setPanel] = useState<"create" | "join">();
  const [rulebook, setRulebook] = useState(false);
  const [creating, setCreating] = useState(false);
  const [extensionReady, setExtensionReady] = useState<boolean>();
  const validName = name.trim().length >= 2 && name.trim().length <= 18;

  useEffect(() => {
    void pingExtension().then(setExtensionReady);
  }, []);

  if (rulebook) {
    return (
      <section className="panel rulebook">
        <button className="back-button" onClick={() => setRulebook(false)}>← BACK</button>
        <p className="eyebrow">CORRUPTED BROWSER MANUAL</p>
        <h1>HOW TO SURVIVE</h1>
        <div className="rules-grid">
          <article><b>01</b><h3>ENTER THE LOBBY</h3><p>Create a room, invite up to five victims, and claim a unique fighter.</p></article>
          <article><b>02</b><h3>BUILD FOR THE POOL</h3><p>Study every possible crisis, import real tabs, then forge one card per round.</p></article>
          <article><b>03</b><h3>LOCK YOUR FATE</h3><p>Choose one unused card. You can change it until you lock—then there are no takebacks.</p></article>
          <article><b>04</b><h3>SURVIVE THE SCORE</h3><p>Stats, category counters, abilities, and bounded server luck decide each battle.</p></article>
          <article><b>05</b><h3>BREAK THE TIE</h3><p>A round tie triggers Tab Clash. A final match tie unleashes Sudden Death.</p></article>
          <article><b>06</b><h3>ENTER REHAB</h3><p>Keep your bad decisions or explicitly close the real tabs that deserve oblivion.</p></article>
        </div>
      </section>
    );
  }

  return (
    <section className="landing panel">
      <p className="eyebrow">YOUR TABS. YOUR DECK. YOUR PROBLEM.</p>
      <h1>TAB<span>MAGGEDON</span></h1>
      <p className="lede">Your tabs have survived long enough.</p>
      <div className="landing-actions">
        <button className={panel === "create" ? "primary" : ""} onClick={() => setPanel(panel === "create" ? undefined : "create")}>CREATE GAME</button>
        <button className={panel === "join" ? "primary" : ""} onClick={() => setPanel(panel === "join" ? undefined : "join")}>JOIN GAME</button>
      </div>
      {panel && (
        <div className="entry-panel">
          <label>DISPLAY NAME<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tab warrior" maxLength={18} /></label>
          {panel === "create" ? (
            <>
              <label>ROUNDS<span className="segmented">{([3, 5, 7] as const).map((count) => <button key={count} className={roundCount === count ? "active" : ""} onClick={() => setRoundCount(count)}>{count}</button>)}</span><small>You'll forge one card per round.</small></label>
              <label>ROUND TIMER<span className="segmented">{([30, 45, 60] as const).map((seconds) => <button key={seconds} className={selectionSeconds === seconds ? "active" : ""} onClick={() => setSelectionSeconds(seconds)}>{seconds}s</button>)}</span></label>
              <button className="primary wide" disabled={!validName || creating} onClick={() => {
                setCreating(true);
                socket.emit("CREATE_ROOM", { name, roundCount, selectionSeconds }, (reply: RoomReply) => {
                  setCreating(false);
                  onCreate(reply);
                });
              }}>{creating ? "OPENING THE GATES…" : "OPEN THE GATES"}</button>
            </>
          ) : (
            <>
              <label>ROOM CODE<input value={code} onChange={(event) => setCode(event.target.value.replace(/\s/g, "").toUpperCase())} onKeyDown={(event) => {
                if (event.key === "Enter" && validName && code.length >= 4) socket.emit("JOIN_ROOM", { name, code }, onJoin);
              }} placeholder="ABCD" maxLength={6} /></label>
              <button className="primary wide" disabled={!validName || code.length < 4} onClick={() => socket.emit("JOIN_ROOM", { name, code }, onJoin)}>ENTER THE ARENA</button>
            </>
          )}
        </div>
      )}
      <button className="text-button" onClick={() => setRulebook(true)}>RULEBOOK</button>
      <p className={`extension-chip ${extensionReady ? "ready" : ""}`}>
        {extensionReady === undefined ? "CHECKING EXTENSION…" : extensionReady ? "EXTENSION READY" : "EXTENSION NOT CONNECTED"}
      </p>
      <p className="privacy">Only the tabs you choose become cards.</p>
    </section>
  );
}

function Lobby({ room, me }: { room: Room; me: Player }) {
  const isHost = me.id === room.hostId;
  const canStart = room.players.length >= 2 && room.players.every((player) => player.avatarId);
  const [copied, setCopied] = useState(false);
  async function copyCode() {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <section className="panel lobby-screen">
      <div className="lobby-top">
        <div>
          <p className="eyebrow">THE GATES ARE OPEN</p>
          <h2>ASSEMBLE YOUR SURVIVORS</h2>
        </div>
        <span className="player-count">{room.players.length}/6 PLAYERS</span>
      </div>
      <div className="lobby-layout">
        <aside className="room-panel">
          <small>ROOM CODE</small>
          <button className="room-code" onClick={() => void copyCode()}>{room.code}<span>{copied ? "COPIED" : "COPY"}</span></button>
          <p>Share this code with victims.</p>
          <dl><div><dt>ROUNDS</dt><dd>{room.roundCount}</dd></div><div><dt>TIMER</dt><dd>{room.selectionSeconds}s</dd></div></dl>
          <div className="mini-roster">
            {room.players.map((player) => (
              <span key={player.id} className={!player.connected ? "offline" : ""}>
                <AvatarSprite avatarId={player.avatarId} size={22} pose="idle" /> {player.name}{player.id === room.hostId ? " HOST" : ""}
              </span>
            ))}
          </div>
        </aside>
        <div className="avatar-stage">
          <h3>CHOOSE YOUR FIGHTER</h3>
          <div className="avatar-grid">
            {AVATARS.map((avatar) => {
              const owner = room.players.find((player) => player.avatarId === avatar.id);
              const mine = owner?.id === me.id;
              return (
                <button key={avatar.id} disabled={Boolean(owner && !mine)} className={`avatar-card ${owner ? "taken" : ""} ${mine ? "mine" : ""}`} onClick={() => socket.emit("CLAIM_AVATAR", avatar.id)}>
                  <span className="avatar-portrait"><AvatarSprite avatarId={avatar.id} size={96} pose={mine ? "ready" : "idle"} /></span>
                  <strong>{avatar.name}</strong><small>{avatar.role}</small>
                  {mine && <em>YOU</em>}
                  {owner && !mine && <em>TAKEN BY {owner.name}</em>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {canStart ? (
        <CrisisPool crises={room.crisisPool} />
      ) : (
        <aside className="crisis-pool sealed-pool">
          <p className="eyebrow">CRISIS VAULT</p>
          <h3>Sealed until the party is assembled.</h3>
          <p>Possible crises unlock after every survivor joins and claims a fighter.</p>
        </aside>
      )}
      {isHost ? (
        <div className="host-actions">
          <button className="primary big-action" disabled={!canStart} onClick={() => socket.emit("START_TAB_SELECTION")}>START TAB PICKING</button>
          {!canStart && <p>{room.players.length < 2 ? "Need at least one more victim." : "Every player must claim a fighter."}</p>}
        </div>
      ) : <p className="center-note">Waiting for the host to unleash tab picking…</p>}
    </section>
  );
}

function CrisisPool({ crises, hideIntro = false }: { crises: Room["crisisPool"]; hideIntro?: boolean }) {
  return (
    <aside className="crisis-pool">
      {!hideIntro && (
        <>
          <p className="eyebrow">CRISIS VAULT</p>
          <h3>You know what's coming. You don't know when.</h3>
        </>
      )}
      <div className="crisis-list">{crises.map((crisis) => (
        <article key={crisis.id}>
          <strong>{crisis.name}</strong>
          <p>{crisis.description}</p>
        </article>
      ))}</div>
    </aside>
  );
}

function CrisisVaultPage({ crises, onContinue }: { crises: Room["crisisPool"]; onContinue: () => void }) {
  return (
    <section className="panel vault-reveal">
      <p className="eyebrow">THE VAULT IS OPEN</p>
      <h1>CRISIS VAULT</h1>
      <p className="lede">These are every crisis that can hit this match. Study them now. After this, the vault is one button away.</p>
      <CrisisPool crises={crises} hideIntro />
      <button className="primary big-action" onClick={onContinue}>CONTINUE</button>
    </section>
  );
}

function DeckBuilder({ room, me }: { room: Room; me: Player }) {
  const required = room.roundCount;
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState("");
  const [forging, setForging] = useState(false);
  const [forgedCards, setForgedCards] = useState<TabCard[]>();
  const [poolOpen, setPoolOpen] = useState(false);
  const liveCount = tabs.filter((tab) => tab.tabId >= 0).length;

  function extraForgeTabs(existing: BrowserTab[], count: number) {
    const taken = new Set(existing.map((tab) => `${tab.tabId}|${tab.domain}`));
    return shuffled(DEMO_TABS).filter((tab) => !taken.has(`${tab.tabId}|${tab.domain}`)).slice(0, count);
  }

  async function loadLive(fillShortage = false) {
    setStatus("Asking the extension for your tabs…");
    try {
      const liveTabs = await importLiveTabs();
      const shortage = Math.max(0, required - liveTabs.length);
      const extras = extraForgeTabs(liveTabs, (fillShortage ? shortage : 0) + 3);
      const nextTabs = [...liveTabs, ...extras];
      setTabs(nextTabs);
      setSelected((current) => {
        const kept = current.filter((id) => nextTabs.some((tab) => tab.tabId === id));
        if (!fillShortage) return kept.slice(0, required);
        const fillers = nextTabs.map((tab) => tab.tabId).filter((id) => !kept.includes(id));
        return [...kept, ...fillers].slice(0, required);
      });
      setStatus(shortage > 0
        ? fillShortage
          ? `${liveTabs.length} live tabs found. Added forged options so you can fill the deck.`
          : `${liveTabs.length} live tabs found. Need ${shortage} more, or forge the rest.`
        : `${liveTabs.length} live tabs found. 3 extra forge options added.`);
    } catch (loadError) {
      setStatus(loadError instanceof Error ? loadError.message : "Could not import tabs.");
    }
  }

  function loadDemo() {
    const presets = shuffled(DEMO_TABS).slice(0, required + 2);
    setTabs(presets);
    setSelected(presets.slice(0, required).map((tab) => tab.tabId));
    setStatus(`Shuffled a ${presets.length}-tab demo hand. Pick ${required}.`);
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
      setForgedCards(result.cards);
      setStatus(result.source === "gemini" ? "Deck forged by Gemini." : "Deck forged by deterministic fallback.");
    } catch (forgeError) {
      setStatus(forgeError instanceof Error ? forgeError.message : "Could not forge deck.");
    } finally {
      setForging(false);
    }
  }

  if (me.deckFinalized) {
    return (
      <section className="panel deck-waiting">
        <p className="eyebrow">DECK LOCKED</p>
        <h1>NO TAKEBACKS.</h1>
        <div className="wait-banner">
          <h3>WAITING FOR THE REST OF THE LOBBY</h3>
          <div className="ready-roster">{room.players.map((player) => <span key={player.id} className={player.deckFinalized ? "ready" : ""}>{player.deckFinalized ? "READY" : "WAIT"} {player.name}</span>)}</div>
        </div>
        <CardRows>{me.deck.map((card) => <CardView key={card.id} card={card} compact />)}</CardRows>
      </section>
    );
  }

  if (forgedCards) {
    return (
      <section className="panel deck-review">
        <div className="section-heading"><div><p className="eyebrow">FORGE COMPLETE</p><h2>REVIEW YOUR DECK</h2></div><b>{forgedCards.length} CARDS / {required} ROUNDS</b></div>
        <button onClick={() => setPoolOpen(true)}>CRISIS VAULT · {room.crisisPool.length}</button>
        <CardRows>{forgedCards.map((card) => <CardView key={card.id} card={card} />)}</CardRows>
        <div className="review-actions"><button onClick={() => setForgedCards(undefined)}>BACK TO TABS</button><button className="primary big-action" onClick={() => socket.emit("SUBMIT_DECK", forgedCards)}>FINALIZE MY CARDS</button></div>
        {poolOpen && <PoolModal room={room} onClose={() => setPoolOpen(false)} />}
      </section>
    );
  }

  return (
    <section className="panel tab-build">
      <div className="picker-heading">
        <div><p className="eyebrow">BUILD YOUR DECK</p><h2>SELECT YOUR FIGHTERS</h2><p>Pick wisely. Every card burns after one use.</p></div>
        <b>{selected.length} / {required}</b>
      </div>
      <div className="import-actions">
        <button className="primary" disabled={forging} onClick={() => void loadLive(false)}>{tabs.length === 0 ? "IMPORT CURRENT TABS" : "REFRESH TABS"}</button>
        {liveCount > 0 && liveCount < required && (
          <button disabled={forging} onClick={() => void loadLive(true)}>IMPORT CURRENT & FORGE THE REST</button>
        )}
        <button disabled={forging} onClick={loadDemo}>FORGE A FULL DEMO SET</button>
        <button onClick={() => setPoolOpen(true)}>CRISIS VAULT · {room.crisisPool.length}</button>
      </div>
      <p className="privacy">Your tab list stays tied to your game session. We only send what is needed to forge the cards you choose.</p>
      {status && <p className="status">{status}</p>}
      <div className="tab-list">
        {tabs.map((tab) => (
          <button type="button" key={tab.tabId} className={selected.includes(tab.tabId) ? "tab-option selected-tab" : "tab-option"} onClick={() => toggle(tab.tabId)}>
            <span className="checkbox">{selected.includes(tab.tabId) ? "X" : ""}</span>
            {tab.faviconUrl ? <img src={tab.faviconUrl} alt="" /> : <span className="tm-mark favicon-fallback">TM</span>}
            <span><strong>{tab.title}</strong><small>{tab.domain}{tab.tabId < 0 ? " · PRESET" : ""}{tab.audible ? " · AUDIO" : ""}</small></span>
          </button>
        ))}
      </div>
      {tabs.length > 0 && <button className="primary forge-button" disabled={selected.length !== required || forging} onClick={forge}>{forging ? "WEAPONIZING YOUR TABS…" : "FORGE MY CARDS"}</button>}
      {poolOpen && <PoolModal room={room} onClose={() => setPoolOpen(false)} />}
    </section>
  );
}

function PoolModal({ room, onClose }: { room: Room; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}><div className="pool-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><p className="center-note">Build for the pool, not the order.</p><CrisisPool crises={room.crisisPool} /></div></div>
  );
}

function MatchIntro({ room }: { room: Room }) {
  return <section className="panel match-intro"><div className="gate">TM</div><p className="eyebrow">ENTER THE RUINS</p><h1>TABMAGGEDON</h1><h2>{room.roundCount} ROUNDS. ONE SURVIVOR.</h2></section>;
}

function battlePose(room: Room, player: Player): AvatarPose {
  if (room.lastResult) {
    if (player.id === room.lastResult.winnerId) return "winner";
    return "lose";
  }
  if (player.locked) return "ready";
  return "idle";
}

function Battle({ room, me }: { room: Room; me: Player }) {
  const sudden = room.phase === "SUDDEN_DEATH_SELECTING";
  const participating = !sudden || room.suddenDeathPlayerIds?.includes(me.id);
  const availableCards = me.deck;
  const lockedCount = room.players.filter((player) => player.locked && (!sudden || room.suddenDeathPlayerIds?.includes(player.id))).length;
  const activeCount = room.players.filter((player) => !sudden || room.suddenDeathPlayerIds?.includes(player.id)).length;
  return (
    <section className={`panel battle arena-shell ${sudden ? "sudden-arena" : ""}`}>
      <Scoreboard room={room} />
      <div className="battle-arena">
        <div className="arena-players">
          {room.players.map((player, index) => (
            <div className={`battle-avatar slot-${index + 1} ${player.locked ? "locked" : ""}`} key={player.id}>
              <AvatarSprite avatarId={player.avatarId} size={112} pose={battlePose(room, player)} />
              <strong>{player.name}{player.id === me.id ? " · YOU" : ""}</strong>
              <small>{player.score} {player.score === 1 ? "WIN" : "WINS"} · {player.locked ? "LOCKED" : sudden && !room.suddenDeathPlayerIds?.includes(player.id) ? "SPECTATING" : "CHOOSING"}</small>
            </div>
          ))}
        </div>
        <div className="arena-center">
          {sudden ? (
            <div className="sudden-banner">
              <p className="eyebrow">SUDDEN DEATH</p>
              <h2>THREE CRISES. ONE WILL FIRE.</h2>
              <div className="crisis-options">{room.suddenDeathOptions?.map((crisis) => <span key={crisis.id}>{crisis.name}<small>{crisis.description}</small></span>)}</div>
            </div>
          ) : room.currentCrisis && (
            <div className="current-crisis" key={`${room.currentRound}-${room.currentCrisis.id}`}>
              <p className="eyebrow">ROUND {room.currentRound} / {room.roundCount}</p>
              <h2>{room.currentCrisis.name}</h2>
              <p>{room.currentCrisis.description}</p>
            </div>
          )}
          <SelectionTimer deadline={room.selectionDeadline} />
        </div>
      </div>
      <div className="lock-status">
        <span className="locked-count">{lockedCount}/{activeCount} PLAYERS LOCKED</span>
        {room.players.filter((player) => !sudden || room.suddenDeathPlayerIds?.includes(player.id)).map((player) => (
          <span key={player.id} className={player.locked ? "locked" : ""}>{player.name} {player.locked ? "LOCKED" : "CHOOSING"}</span>
        ))}
      </div>
      {me.autoLocked && <p className="center-note">The arena chose for you.</p>}
      {!participating ? <p className="center-note">The tied leaders are fighting. Enjoy the wreckage.</p> : (
        <>
          <div className="hand-heading"><h3>YOUR HAND</h3><b>{me.locked ? "LOCKED. NO TAKEBACKS." : "SELECT ONE UNUSED CARD"}</b></div>
          <CardRows className="battle-hand">
            {availableCards.map((card) => {
              const used = !sudden && me.usedCardIds.includes(card.id);
              return <CardView key={card.id} card={card} selected={me.selectedCardId === card.id} used={used} disabled={used || me.locked} onClick={() => socket.emit("SELECT_CARD", card.id)} />;
            })}
          </CardRows>
          <button className="primary big-action" disabled={!me.selectedCardId || me.locked} onClick={() => socket.emit("LOCK_IN")}>{me.locked ? "LOCKED IN" : me.selectedCardId ? "LOCK IN" : "SELECT A CARD"}</button>
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
  return <div className={`selection-timer ${seconds <= 5 ? "urgent" : ""}`}><b>{seconds}</b><span>SEC TO<br />LOCK</span></div>;
}

function Scoreboard({ room }: { room: Room }) {
  return <div className="scoreboard">{room.players.map((player) => <span key={player.id}><b>{player.score}</b>{player.name}</span>)}</div>;
}

function Result({ room, me }: { room: Room; me: Player }) {
  const result = room.lastResult;
  if (!result) return null;
  const isTie = result.tiedPlayerIds.length > 1;
  const title = isTie
    ? result.isSuddenDeath ? "SUDDEN DEATH TIE — AGAIN." : `${playerName(room, result.tabClashWinnerId)} WINS TAB CLASH`
    : `${playerName(room, result.winnerId)} WINS`;
  const waiting = room.players.filter((player) => player.connected && !player.readyToContinue).length;
  return (
    <section className="panel result-screen">
      <Scoreboard room={room} />
      <p className="eyebrow">{result.isSuddenDeath ? "SUDDEN DEATH RESULT" : `ROUND ${room.currentRound} RESULT`}</p>
      <h2>{result.crisis.name}</h2>
      <p className="crisis-rule">{crisisRule(result.crisis)}</p>
      <h1>{title}</h1>
      <div className="clash-arena">
        {result.scores.map((score, index) => {
          const player = room.players.find((entry) => entry.id === score.playerId);
          const won = score.playerId === result.winnerId;
          const special = /sabotag|chaos|pop-up/i.test(score.abilityNote);
          const pops = [
            score.abilityModifier !== 0 ? {
              text: `${score.abilityModifier > 0 ? "+" : ""}${score.abilityModifier}`,
              kind: special ? "special" : score.abilityModifier > 0 ? "good" : "bad",
            } : undefined,
            score.luck !== 0 ? {
              text: `${score.luck > 0 ? "+" : ""}${score.luck} LUCK`,
              kind: score.luck > 0 ? "good" : "bad",
            } : undefined,
          ].filter((pop): pop is { text: string; kind: string } => Boolean(pop));
          return (
            <div className={`clash-fighter ${won ? "winner" : "loser"} side-${index % 2 === 0 ? "left" : "right"}`} key={score.playerId}>
              <AvatarSprite avatarId={player?.avatarId} size={156} pose={won ? "winner" : "lose"} />
              <strong>{playerName(room, score.playerId)}</strong>
              <div className="clash-pops">
                {pops.map((pop) => <span key={pop.text} className={pop.kind}>{pop.text}</span>)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="result-grid">
        {result.scores.map((score) => {
          const tied = isTie && result.tiedPlayerIds.includes(score.playerId);
          const won = score.playerId === result.winnerId;
          return (
          <div className={`result-column ${won ? "winner-column" : ""} ${tied ? "tie-column" : ""}`} key={score.playerId}>
            <h3>{playerName(room, score.playerId)}{tied && <span className="tie-badge">{result.isSuddenDeath ? "TIED" : score.playerId === result.tabClashWinnerId ? "TAB CLASH +1" : "TAB CLASH"}</span>}</h3>
            <CardView card={score.card} compact preview />
            <div className="math-row"><span>Crisis score</span><b>{score.crisisScore}</b></div>
            <div className="math-row"><span>Category matchup</span><b>{score.typeModifier >= 0 ? "+" : ""}{score.typeModifier}</b></div>
            <div className="math-row"><span>{score.abilityNote}</span><b>{score.abilityModifier >= 0 ? "+" : ""}{score.abilityModifier}</b></div>
            <div className="math-row"><span>Luck</span><b>{score.luck >= 0 ? "+" : ""}{score.luck}</b></div>
            <div className="math-row total"><span>FINAL</span><b>{score.finalScore}</b></div>
          </div>
        )})}
      </div>
      <button className="primary big-action" disabled={me.readyToContinue} onClick={() => socket.emit("CONTINUE_ROUND")}>
        {me.readyToContinue ? "WAITING…" : result.isSuddenDeath || room.currentRound >= room.roundCount ? "CONTINUE" : "NEXT ROUND"}
      </button>
      <p className="center-note">{waiting === 0 ? "Advancing…" : `Waiting on ${waiting} player${waiting === 1 ? "" : "s"} to continue.`}</p>
    </section>
  );
}

function GameOver({ room, onRehab }: { room: Room; onRehab: () => void }) {
  const standings = [...room.players].sort((left, right) => right.score - left.score);
  return (
    <section className="panel winner-screen">
      <p className="eyebrow">THE BROWSER HAS SPOKEN</p>
      <h1><span>{playerName(room, room.winnerId)}</span><br />TABMAGGEDON CHAMPION</h1>
      <div className="podium">
        {standings.slice(0, 3).map((player, index) => (
          <div className={`podium-slot place-${index + 1}`} key={player.id}>
            {index === 0 && <span className="crown">1ST</span>}
            <b>{index + 1}</b>
            <span className="podium-avatar"><AvatarSprite avatarId={player.avatarId} size={index === 0 ? 150 : 120} pose={index === 0 ? "winner" : "lose"} /></span>
            <strong>{player.name}</strong>
            <small>{player.score} {player.score === 1 ? "WIN" : "WINS"}</small>
          </div>
        ))}
      </div>
      {standings.length > 3 && (
        <div className="fallen">
          {standings.slice(3).map((player) => (
            <span key={player.id}><AvatarSprite avatarId={player.avatarId} size={36} pose="lose" /> {player.name}</span>
          ))}
        </div>
      )}
      <button className="primary big-action" onClick={onRehab}>ENTER TAB REHAB</button>
    </section>
  );
}

function TabRehab({ me, onError, onHome }: { me: Player; onError: (message: string) => void; onHome: () => void }) {
  const [decisions, setDecisions] = useState<Record<string, "kept" | "closed">>({});
  const [extraCards, setExtraCards] = useState<TabCard[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [extraStatus, setExtraStatus] = useState("");
  const [complete, setComplete] = useState(false);
  const gameCards = useMemo(() => me.deck.filter(isRealCard), [me.deck]);
  const allCards = useMemo(() => [...gameCards, ...extraCards], [extraCards, gameCards]);
  const remaining = useMemo(() => allCards.filter((card) => !decisions[card.id]).length, [allCards, decisions]);
  const gameRemaining = useMemo(() => gameCards.filter((card) => !decisions[card.id]).length, [decisions, gameCards]);
  const closedCount = useMemo(
    () => allCards.filter((card) => decisions[card.id] === "closed").length,
    [allCards, decisions],
  );
  const keptCount = useMemo(() => allCards.filter((card) => decisions[card.id] === "kept").length, [allCards, decisions]);
  const total = Math.max(1, allCards.length);
  const closedPercent = Math.round((closedCount / total) * 100);
  const keptPercent = Math.round((keptCount / total) * 100);
  const pendingPercent = Math.max(0, 100 - closedPercent - keptPercent);

  async function loadRemainingTabs() {
    setLoadingExtras(true);
    setExtraStatus("Importing the rest of your browser and asking Gemini to sort it…");
    try {
      const liveTabs = await importLiveTabs();
      const gameTabIds = new Set(gameCards.map((card) => card.tabId));
      const remainingTabs = liveTabs.filter((tab) => !gameTabIds.has(tab.tabId));
      if (remainingTabs.length === 0) {
        setExtraCards([]);
        setExtraStatus("No additional live tabs found.");
        return;
      }
      const batches: BrowserTab[][] = [];
      for (let index = 0; index < remainingTabs.length; index += 50) {
        batches.push(remainingTabs.slice(index, index + 50));
      }
      const results = await Promise.all(batches.map(async (tabs) => {
        const response = await fetch(`${SERVER_URL}/api/rehab`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tabs }),
        });
        const result = await response.json() as { cards?: TabCard[]; source?: string; error?: string };
        if (!response.ok || !result.cards) throw new Error(result.error || "Tab sorting failed.");
        return result;
      }));
      const sorted = results
        .flatMap((result) => result.cards ?? [])
        .sort((left, right) => right.stats.uselessness - left.stats.uselessness);
      setExtraCards(sorted);
      setExtraStatus(results.every((result) => result.source === "gemini")
        ? `Gemini sorted ${sorted.length} remaining tabs. Least useful appear first.`
        : `Sorted ${sorted.length} remaining tabs with the deterministic backup. Least useful appear first.`);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Could not load remaining tabs.";
      setExtraStatus(message);
      onError(message);
    } finally {
      setLoadingExtras(false);
    }
  }

  async function close(card: TabCard) {
    try {
      await closeLiveTab(card.tabId, card.originalUrl);
      setDecisions((current) => ({ ...current, [card.id]: "closed" }));
    } catch (closeError) {
      const message = closeError instanceof Error ? closeError.message : "Could not close that tab.";
      if (/no tab|already|changed/i.test(message)) {
        setDecisions((current) => ({ ...current, [card.id]: "closed" }));
        onError("That tab was already gone.");
        return;
      }
      onError(message);
    }
  }

  if (complete) {
    return (
      <section className="panel rehab rehab-complete">
        <p className="eyebrow">RECOVERY REPORT</p>
        <h1>YOU CLOSED {closedCount} TABS</h1>
        <h2>AND KEPT {keptCount} BAD {keptCount === 1 ? "DECISION" : "DECISIONS"}.</h2>
        <div className="rehab-final-actions"><button className="primary" onClick={onHome}>PLAY AGAIN</button><button onClick={onHome}>RETURN HOME</button></div>
      </section>
    );
  }

  return (
    <section className="panel rehab">
      <p className="eyebrow">POST-GAME CLEANUP</p>
      <h1>TAB REHAB</h1>
      <p className="lede">Time to deal with what survived.</p>
      <p>{remaining} loaded decisions remaining. Nothing closes without your click.</p>
      <button className="primary load-remaining" disabled={loadingExtras} onClick={() => void loadRemainingTabs()}>
        {loadingExtras ? "GEMINI IS SORTING…" : extraCards.length > 0 ? "REFRESH REMAINING TABS" : "LOAD ALL REMAINING TABS"}
      </button>
      {extraStatus && <p className="status">{extraStatus}</p>}
      <div className="cleanup-progress">
        <div><span>CLOSED</span><b>{closedCount} · {closedPercent}%</b><span>KEPT</span><b>{keptCount} · {keptPercent}%</b><span>UNDECIDED</span><b>{remaining} · {pendingPercent}%</b></div>
        <div className="cleanup-track"><span className="closed-segment" style={{ width: `${closedPercent}%` }} /><span className="kept-segment" style={{ width: `${keptPercent}%` }} /></div>
      </div>
      <h3 className="rehab-section-title">GAME TABS</h3>
      <div className="rehab-list">
        {gameCards.map((card) => (
          <RehabRow
            key={card.id}
            card={card}
            decision={decisions[card.id]}
            onKeep={() => setDecisions((current) => ({ ...current, [card.id]: "kept" }))}
            onClose={() => void close(card)}
          />
        ))}
      </div>
      {extraCards.length > 0 && (
        <>
          <h3 className="rehab-section-title">REMAINING TABS · LEAST USEFUL FIRST</h3>
          <div className="rehab-list extra-tabs">
            {extraCards.map((card) => {
              const usefulness = 10 - card.stats.uselessness;
              const recommendation = usefulness <= 3 ? "CONSIDER CLOSING" : usefulness >= 7 ? "LIKELY USEFUL" : "REVIEW";
              return (
                <RehabRow
                  key={card.id}
                  card={card}
                  decision={decisions[card.id]}
                  note={`${card.type} · ${usefulness}/9 USEFULNESS · ${recommendation}`}
                  onKeep={() => setDecisions((current) => ({ ...current, [card.id]: "kept" }))}
                  onClose={() => void close(card)}
                />
              );
            })}
          </div>
        </>
      )}
      <button className="primary big-action" disabled={gameRemaining > 0} onClick={() => setComplete(true)}>FINISH REHAB</button>
      {gameCards.length === 0 && <p className="center-note">Your deck used demo tabs, so there are no game tabs to close.</p>}
    </section>
  );
}

function RehabRow({
  card,
  decision,
  note,
  onKeep,
  onClose,
}: {
  card: TabCard;
  decision?: "kept" | "closed";
  note?: string;
  onKeep: () => void;
  onClose: () => void;
}) {
  return (
    <div className={`rehab-row ${decision ?? ""}`}>
      {card.sourceType === "synthetic" || !card.faviconUrl ? <span className="favicon-fallback tm-mark">TM</span> : <img src={card.faviconUrl} alt="" />}
      <div className="rehab-copy">
        <strong>{card.originalTitle || card.cardName}</strong>
        <small>{card.domain}{card.sourceType === "synthetic" ? " · FORGED" : ""}{note ? ` · ${note}` : ""}</small>
      </div>
      {decision ? <strong className="decision">{decision === "closed" ? "CLOSED" : "KEPT"}</strong> : (
        <div><button className="close-button" onClick={onClose}>CLOSE</button><button className="keep-button" onClick={onKeep}>KEEP</button></div>
      )}
    </div>
  );
}

export default App;
