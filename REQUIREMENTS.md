# Tabmaggedon requirements

## Runtime

- Node.js 22 LTS or newer
- npm 10 or newer
- Google Chrome with Manifest V3 extension support
- Two browser profiles or computers for a real multiplayer demo

## Configuration

Copy `server/.env.example` to `server/.env`. Add a server-side
`GEMINI_API_KEY` to enable Gemini compilation. With no key, the app uses the
deterministic fallback compiler so gameplay remains available.

Copy `web/.env.example` to `web/.env.local` only when the API server is not at
`http://localhost:3001`.

## Dependencies

JavaScript dependencies are declared in the root, `web`, and `server`
`package.json` files and locked by `package-lock.json`.

Install everything from the repository root:

```bash
npm install
```

Start the web app and authoritative game server:

```bash
npm run dev
```
