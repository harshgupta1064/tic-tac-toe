# Project Structure

## Folder tree

```text
/
├── docker-compose.yml          ← spins up Nakama + PostgreSQL locally
├── Dockerfile.nakama           ← production image for Nakama + our module
├── railway.toml                ← Railway deployment config
├── vercel.json                 ← Vercel deployment config
├── README.md                   ← project index
├── docs/                       ← all documentation (this folder)
│
├── nakama/                     ← Nakama server module
│   ├── src/
│   │   └── main.ts             ← ALL server-side game logic
│   ├── build/                  ← compiled JS output (git-ignored)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                    ← local Nakama environment config
│
└── frontend/                   ← React application
    ├── src/
    │   ├── main.tsx             ← React entry point
    │   ├── App.tsx              ← screen router
    │   ├── index.css            ← Tailwind base styles
    │   ├── vite-env.d.ts        ← Vite env type declarations
    │   ├── lib/
    │   │   └── nakama.ts        ← Nakama client singleton + auth helpers
    │   ├── context/
    │   │   └── GameContext.tsx  ← global React state + all game actions
    │   └── components/
    │       ├── AuthScreen.tsx        ← login / register / guest
    │       ├── LobbyScreen.tsx       ← mode select, find match, leaderboard
    │       ├── MatchmakingScreen.tsx ← waiting spinner
    │       ├── GameBoard.tsx         ← live game board
    │       ├── GameOverScreen.tsx    ← result screen
    │       └── RoomBrowserScreen.tsx ← create / browse / join rooms
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── .env.local               ← local frontend env (Nakama host/port)
    └── .env.production          ← production frontend env
```

## File responsibilities

`docker-compose.yml`
: Defines local multi-service orchestration for Nakama and PostgreSQL, including ports, health checks, and startup dependencies. It is the primary local runtime entrypoint for backend infrastructure. Removing it breaks one-command local backend startup.

`Dockerfile.nakama`
: Builds a deployable Nakama image with the compiled TypeScript module copied into Nakama's module path. It is used by cloud deployment to package runtime logic. Removing it breaks containerized backend deployment workflows.

`railway.toml`
: Stores Railway-specific deployment and runtime settings, including start command conventions. It coordinates migration and server boot behavior in Railway environments. Removing it risks failed or inconsistent Railway deploys.

`vercel.json`
: Defines frontend deployment behavior on Vercel, including routing/build expectations for a Vite app. It keeps production serving behavior predictable. Removing it may cause incorrect build or route handling in Vercel.

`README.md`
: Serves as the top-level project index and onboarding entrypoint. It links to detailed docs and exposes quick-start commands. Removing it makes repository navigation and setup harder for new contributors.

`docs/`
: Contains all project documentation in topic-specific markdown files. It centralizes architecture, setup, operations, and troubleshooting knowledge. Removing it eliminates maintainable long-form project docs.

`nakama/src/main.ts`
: Contains all authoritative multiplayer game logic, RPC handlers, room logic, leaderboard writes, and module initialization. It exports and registers server-side behaviors consumed by Nakama runtime. Removing it breaks gameplay, matchmaking hooks, and custom RPC functionality.

`nakama/build/`
: Contains compiled JavaScript artifacts generated from TypeScript source. Nakama loads this output at runtime rather than the `.ts` source. Removing it prevents the module from loading in container/runtime environments unless rebuilt.

`nakama/package.json`
: Declares build scripts and development dependencies for the Nakama TypeScript module. It enables install/build/watch tasks used by local and CI workflows. Removing it breaks dependency installation and compile commands.

`nakama/tsconfig.json`
: Configures TypeScript compilation behavior for the server module (target, module output, typings). It ensures generated JavaScript is compatible with Nakama runtime constraints. Removing it breaks reliable compilation.

`nakama/.env`
: Provides local Nakama runtime environment settings such as database address and runtime module path. It is consumed during local container startup. Removing it causes local runtime configuration failures.

`frontend/src/main.tsx`
: React bootstrap file that mounts the app tree into the DOM and attaches providers. It exports app startup side effects through execution, not named exports. Removing it prevents frontend application startup.

`frontend/src/App.tsx`
: Top-level screen router that selects which screen component renders based on context state. It binds navigation state to concrete UI views. Removing it breaks high-level UI flow and screen transitions.

`frontend/src/index.css`
: Global stylesheet entry for Tailwind layers and shared base styling tokens. It ensures utility classes and baseline styles are present. Removing it causes broken styling and missing Tailwind output.

`frontend/src/vite-env.d.ts`
: Type declaration bridge for Vite-specific globals and environment variable typing. It improves type safety around `import.meta.env` usage. Removing it can introduce TypeScript type errors around Vite globals.

`frontend/src/lib/nakama.ts`
: Encapsulates Nakama client initialization, auth helpers, session persistence, and socket creation. It exports reusable integration utilities for the rest of the frontend. Removing it breaks backend connectivity and authentication flow.

`frontend/src/context/GameContext.tsx`
: Central state container for auth, match state, screen navigation, matchmaking, leaderboard loading, and action methods. It exports context and provider used by UI components. Removing it breaks state propagation and action orchestration across the app.

`frontend/src/components/AuthScreen.tsx`
: Renders login/register/guest entry UI and binds submissions to context auth actions. It is the first user-facing gate into the app. Removing it breaks account entry and guest access.

`frontend/src/components/LobbyScreen.tsx`
: Renders mode selection, match start actions, leaderboard access, and room navigation controls. It bridges post-auth users into game discovery flows. Removing it breaks entry into matchmaking and room systems.

`frontend/src/components/MatchmakingScreen.tsx`
: Displays waiting status while players are being paired or waiting in room flow. It provides user feedback during async pairing periods. Removing it degrades or breaks the interim UX state between lobby and game start.

`frontend/src/components/GameBoard.tsx`
: Renders the live Tic-Tac-Toe board and emits move intents to context actions. It reflects authoritative state updates from server events. Removing it breaks active gameplay interaction and board visualization.

`frontend/src/components/GameOverScreen.tsx`
: Shows final outcome state, rematch option, and return-to-lobby actions. It is the post-match transition screen for user continuation. Removing it breaks end-of-game UX and replay flow.

`frontend/src/components/RoomBrowserScreen.tsx`
: Provides create/browse/join interfaces for manual room-based matchmaking. It binds room RPC operations and direct match joins to UI controls. Removing it removes manual room gameplay capability.

`frontend/index.html`
: Vite HTML host template containing root mount point for React application. It is required by Vite build/dev serving pipeline. Removing it prevents frontend rendering.

`frontend/package.json`
: Defines frontend dependencies, scripts, and build tooling metadata. It enables install, dev, and production build commands. Removing it breaks frontend dependency resolution and scripts.

`frontend/vite.config.ts`
: Configures Vite dev server and build behavior for the React app. It controls bundling defaults and plugin integration. Removing it can break dev/build execution or expected defaults.

`frontend/tailwind.config.js`
: Tailwind scanner and theme configuration file. It determines which files are scanned and how utilities are generated. Removing it breaks Tailwind class generation and final styling output.

`frontend/postcss.config.js`
: PostCSS pipeline configuration used by Tailwind during build/dev processing. It ensures CSS transformations run correctly. Removing it can break style compilation.

`frontend/.env.local`
: Local frontend runtime variables for host/port/SSL/server key against local Nakama. It is developer-specific and typically ignored by git. Removing it causes connection defaults to be missing or incorrect for local runs.

`frontend/.env.production`
: Production frontend runtime variables for hosted Nakama endpoint settings. It ensures the deployed app points to cloud backend infrastructure. Removing it risks failed production connectivity.

## Data flow between files

The core data path starts in `nakama/src/main.ts`, where all game and RPC logic is authored, then gets compiled into `nakama/build/main.js` as runtime-ready JavaScript. That build artifact is mounted into the Dockerized Nakama server, which exposes APIs and a real-time WebSocket endpoint. The frontend connects through `frontend/src/lib/nakama.ts`, then `frontend/src/context/GameContext.tsx` receives and normalizes live events into app state, and finally `frontend/src/components/*.tsx` render those states into user-visible screens.

## Key architectural boundaries

1. **Server/client boundary:** Only serialized JSON messages cross the network; frontend and backend never share direct function calls or in-memory state.
2. **Context/component boundary:** UI components do not call Nakama APIs directly; they call context actions that centralize side effects and networking.
3. **Auth/game boundary:** Authentication/session state is maintained in `GameContext`, and match/game-specific state is re-initialized per match lifecycle to avoid stale carryover.
