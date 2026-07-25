# MazeUI

Local visual chain editor for the Maze DSP engine.

MazeUI is a Vue 3 single-page application. Maze remains the authority for the processor catalog,
chain validation, DSP rendering, jobs, logs, and outputs. MazeAI is intentionally outside the first
implementation phase.

## Current scaffold

- Vue 3, TypeScript, Vite, Pinia, and Vue Router
- typed client for the existing Maze REST health, processor, validation, and render contracts
- processor catalog loaded from `GET /api/processors`
- strictly linear chain draft and Maze YAML serialization
- metadata-driven processor Inspector
- chain overview, YAML view, and Maze validation panel
- initial dark studio shell based on the approved MazeUI direction
- Vue Flow dependency reserved for the constrained visual canvas integration

Chain persistence, audio browsing, job monitoring, playback, and output downloads are the next
implementation slices. The Render button stays disabled until a draft can be persisted safely or
Maze accepts inline render YAML.

## Requirements

- Node.js 20.19 or newer; Node.js 24 LTS is recommended
- Maze REST running locally (default development target: `http://127.0.0.1:8081`)

Dependencies are locked in `package-lock.json`; `node_modules` remains local and is not committed.

## IntelliJ IDEA

Open this directory directly:

```text
C:\Work\Projects\IDEA\com-qosmomodular-mazeui
```

Configure a local Node.js runtime in IntelliJ, then run:

```powershell
npm ci
npm run dev
```

The development UI listens on `http://127.0.0.1:5173` and proxies `/api` to Maze REST.

## Commands

```powershell
npm run dev
npm run typecheck
npm test
npm run build
```

## Configuration

Copy `.env.example` to `.env.local` only when the defaults are unsuitable:

```properties
VITE_MAZE_PROXY_TARGET=http://127.0.0.1:8081
VITE_MAZE_API_URL=/api
```

Keep `VITE_MAZE_API_URL=/api` for same-origin production packaging. No secret or provider credential
belongs in this browser application.
