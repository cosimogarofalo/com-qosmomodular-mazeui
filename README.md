# MazeUI

Local visual chain editor for the Maze DSP engine.

MazeUI is a Vue 3 single-page application. Maze remains the authority for the processor catalog,
chain validation, DSP rendering, jobs, logs, and outputs. MazeAI is an optional advisory service:
it analyzes a managed input and proposes a chain, but cannot validate or render it.

## Interface preview

The following screenshot is an example of the MazeUI graphical interface. The exact layout and
available controls may evolve with the processor catalog and ongoing UI work.

![MazeUI graphical interface example](docs/images/MazeUI_Screenshot.png)

## Current workflow

- Vue 3, TypeScript, Vite, Pinia, and Vue Router
- typed client for Maze REST health, catalog, managed audio, validation, render, jobs, logs, and media
- typed client for the asynchronous MazeAI REST proposal workflow, with a three-service version gate
- read-only MazeAI analysis, warnings/logs, and suggested-chain views; the current draft changes only
  after explicit atomic acceptance
- processor catalog loaded from `GET /api/processors`
- managed WAV/AIFF selection and browser upload without server path fields
- strictly linear chain draft with bound inline YAML serialization
- mono/stereo topology checks driven by catalog `inputTypes` and `outputType`
- source-bound and regional parameter preservation, with source fingerprints populated from the
  selected managed input
- metadata-driven processor Inspector with source-derived fields locked read-only
- characteristic vector glyphs for every processor type in the distributed Maze catalog
- static green-phosphor waveform preview for every `lfoWave` parameter
- authoritative bound validation before render, either manual or through the debounced
  `Auto validate` toggle
- explicit `Overwrite` toggle for replacing an existing regular output under the same name
- asynchronous job status/log polling, cancellation/deletion, ordered outputs, playback, A/B,
  live amplitude/spectrum views, RMS/sample-peak meters, and explicit downloads
- dark studio shell based on the approved MazeUI direction
- Vue Flow dependency reserved for the constrained visual canvas integration

Maze remains authoritative for validation and rendering. The Render button is enabled only when the
current managed input/output bindings, topology, source provenance, and latest server validation are
acceptable. Jobs are intentionally session-local; the UI does not imply persistent server history.

## Requirements

- Node.js 20.19 or newer; Node.js 24 LTS is recommended
- Maze REST running locally (default development target: `http://127.0.0.1:8081`)
- MazeAI REST running locally on `http://127.0.0.1:8082` when using the MazeAI tab

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

The development UI listens on `http://127.0.0.1:5173`, proxies `/api` to Maze REST, and proxies the
distinct `/mazeai-api` browser prefix to MazeAI REST.

## Local end-to-end trial

Build and start Maze REST from its `main` worktree:

```powershell
cd C:\Work\Projects\IDEA\com-qosmomodular-maze
mvn clean package
java -jar maze-rest\target\maze-rest.jar --port 8081
```

In a second terminal, start MazeAI REST:

```powershell
cd C:\Work\Projects\IDEA\com-qosmomodular-mazeai
java -jar mazeai-rest\target\mazeai-rest.jar --port 8082
```

In a third terminal, start MazeUI from its canonical project directory:

```powershell
cd C:\Work\Projects\IDEA\com-qosmomodular-mazeui
npm.cmd run dev
```

Open `http://127.0.0.1:5173`, select or upload a WAV/AIFF, add a compatible processor, choose a safe
output base name, validate the bound draft manually or enable `Auto validate`, and render. Completed
outputs appear in order with original/rendered playback, A/B controls, and download actions. Keep
`Overwrite` enabled to reuse the same output name while tuning processor parameters.

For assisted composition, open the `MazeAI` tab after selecting an input, describe the desired
result, and generate a proposal. Analysis, warnings, and suggested processors remain separate from
the editable chain. `Accept proposal` atomically replaces the current draft while retaining the
browser-owned output name, format, and overwrite setting. Review or edit it, then use the normal
Maze validation and render controls.

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
VITE_MAZEAI_PROXY_TARGET=http://127.0.0.1:8082
VITE_MAZEAI_API_URL=/mazeai-api
```

Keep the two browser prefixes distinct in production and route each one to its own REST service.
No secret or provider credential belongs in this browser application. Provider execution and local
audio resolution stay inside MazeAI REST; Maze remains the final validation and render authority.

## Version

0.8.0
