# TABMAGGEDON

Turn your real Chrome tabs into a 2–4 player card battle, then decide which
tabs survive in Tab Rehab.

This repository contains the judging-focused MVP:

- `web/` — React + Vite game client
- `server/` — Express, Socket.IO, Gemini compiler, and authoritative game engine
- `extension/` — lightweight unpacked Chrome Manifest V3 bridge

## Quick start

Requirements are listed in [REQUIREMENTS.md](./REQUIREMENTS.md).

```bash
npm install
cp server/.env.example server/.env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in two browser windows or
profiles. Use **USE DEMO TABS** when the extension is not loaded.

The app is fully playable without a Gemini key through its deterministic
fallback compiler. To enable Gemini, set `GEMINI_API_KEY` in `server/.env`.

## Load the Chrome extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository's `extension/` directory.
5. Reload the Tabmaggedon web page.
6. Click **IMPORT MY TABS**.

The bridge runs only on known Tabmaggedon origins. It strips URL queries and
hashes before returning tab metadata. Only selected game tabs leave the browser
during deck forging. On the final screen, the player can explicitly request
temporary Gemini sorting of the remaining live tabs. A real tab can only be
closed from Tab Rehab after an explicit click, and the extension checks that the
tab URL has not changed.

## Commands

```bash
npm run dev      # start client and server
npm run build    # type-check and production-build both workspaces
npm test         # test balancing and battle resolution
```

## Game flow

1. Create or join a four-character room.
2. Import live tabs or load reliable demo tabs.
3. Select exactly 3, 5, or 7 tabs and forge a legal deck.
4. Preview every crisis in the match before its order is revealed.
5. Secretly choose and lock one unused card each round.
6. Resolve stats, type counters, whitelisted abilities, and server luck.
7. Break match ties through uncertain Sudden Death.
8. Keep or explicitly close game tabs, with optional Gemini sorting of all
   remaining live tabs in Tab Rehab.

Gemini performs semantic interpretation only. The server validates cards,
normalizes every stat budget to exactly 20, rejects illegal moves, generates
luck, and decides every result. Invalid or unavailable AI output automatically
falls back to deterministic cards derived from tab title and domain.

## Environment

Server variables are documented in `server/.env.example`:

- `PORT` — API and Socket.IO port, default `3001`
- `CLIENT_ORIGIN` — allowed client origins, comma-separated
- `GEMINI_API_KEY` — optional and server-only
- `GEMINI_MODEL` — defaults to `gemini-3.8-flash` and retries the current Flash alias on model `404` errors

The web client optionally accepts `VITE_SERVER_URL`; see `web/.env.example`.

## Deploy to Render

The included `render.yaml` deploys the client, server, and Socket.IO endpoint as
one Render web service. In Render, create a **Blueprint** from this repository:

<https://dashboard.render.com/blueprints>

Choose `Aragya1642/Tabmageddon`, review the `tabmageddon-hackcmu` service, add
`GEMINI_API_KEY` when prompted, and apply the Blueprint. Gemini is optional; an
empty key still produces a working deployment through the fallback compiler.

The default deployment URL is:

<https://tabmageddon-hackcmu.onrender.com>

If you change the Render service name, update `CLIENT_ORIGIN` in Render and the
production URL match in `extension/manifest.json`, then reload the unpacked
extension. Free Render services sleep when idle, so the first request after a
quiet period can take roughly a minute.
