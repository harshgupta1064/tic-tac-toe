# Multiplayer Tic-Tac-Toe (Nakama + React)

Production-oriented multiplayer Tic-Tac-Toe with a **server-authoritative** architecture.

- Backend: Nakama authoritative match handler (TypeScript runtime module)
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Realtime transport: Nakama JS socket API
- Persistence: PostgreSQL (via Docker)

---

## Tech Stack

### Backend
- [Nakama](https://heroiclabs.com/docs/nakama/) `3.21.1`
- TypeScript runtime module compiled to JS (`nakama/src/main.ts` -> `nakama/build/main.js`)
- PostgreSQL `14` (containerized)

### Frontend
- React `18`
- Vite `4`
- TypeScript `5`
- Tailwind CSS `3`
- `@heroiclabs/nakama-js` `^2.8.0`

### Infra / Tooling
- Docker Compose
- npm

---

## Key Features

- Server-authoritative Tic-Tac-Toe match logic
- Automatic matchmaking -> match creation
- Move validation and invalid move rejection
- Win / draw detection
- Timed mode (30s per turn) with timeout forfeit
- Forfeit handling on disconnect/leave
- Leaderboard write on win and read via RPC
- Mobile-first dark UI (Tailwind)

---

## Architecture

The game uses a strict **server-authoritative** model:

- Client sends only intent (`MOVE` with board position)
- Server validates state, applies move, checks win/draw, advances turn
- Server broadcasts canonical state updates
- Client acts as renderer + input sender (no trusted game logic on client)

This prevents client-side cheating and race-condition inconsistencies.

---

## Project Structure

```text
/
├── docker-compose.yml
├── README.md
├── nakama/
│   ├── src/
│   │   └── main.ts
│   ├── build/
│   │   └── main.js
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   ├── context/
    │   │   └── GameContext.tsx
    │   └── lib/
    │       └── nakama.ts
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── postcss.config.js
    └── tailwind.config.js
```

---

## Setup (Local)

## Prerequisites
- Node.js 18+
- npm
- Docker Desktop (with `docker compose`)

## 1) Build Nakama module

```bash
cd nakama
npm install
npm run build
```

Expected artifact:
- `nakama/build/main.js`

## 2) Start backend (Postgres + Nakama)

```bash
cd ..
docker compose up -d
```

Check health:

```bash
curl http://localhost:7350/healthcheck
```

Expected response:

```json
{}
```

Verify module load:

```bash
docker compose logs nakama | grep "TicTacToe module loaded successfully"
```

> On Windows PowerShell, replace `grep` with `findstr`.

## 3) Frontend environment

Create `frontend/.env.local`:

```env
VITE_NAKAMA_HOST=127.0.0.1
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_USE_SSL=false
VITE_NAKAMA_SERVER_KEY=defaultkey
```

## 4) Run frontend

```bash
cd frontend
npm install
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

---

## End-to-End Test Flow

1. Open two browser tabs at `http://localhost:3000`
2. Login as `Player1` in tab 1, `Player2` in tab 2
3. Select the same mode (`classic` or `timed`)
4. Click **Find Match** in both tabs
5. Validate:
   - real-time board sync
   - correct turn switching
   - invalid move rejection
   - win/draw game-over behavior
   - timed mode countdown + timeout forfeit

---

## Technical Decisions

### 1) Server-authoritative gameplay
**Decision:** Keep all gameplay logic in Nakama authoritative match loop.  
**Why:** Security, consistency, and deterministic outcomes across clients.  
**Trade-off:** Slightly more backend complexity and increased round-trip dependency.

### 2) Matchmaker-driven session creation
**Decision:** Use `matchmakerMatched` to create server matches automatically.  
**Why:** Clean player pairing and scalable queue-based flow.  
**Trade-off:** Adds queue orchestration logic and edge cases around cancellations/timeouts.

### 3) Tick-rate based timer (1 tick/sec)
**Decision:** Use match loop tick counters for timed mode.  
**Why:** Simple and deterministic timeout behavior in authoritative loop.  
**Trade-off:** Timer granularity is coarse (1-second resolution).

### 4) Lightweight frontend state via React Context
**Decision:** Use Context + hooks instead of Redux/Zustand initially.  
**Why:** Fast iteration, small project surface area, low ceremony.  
**Trade-off:** As app grows, global state complexity may warrant a dedicated state library.

### 5) Dockerized local stack
**Decision:** Compose-based Nakama + Postgres for reproducible dev environment.  
**Why:** Easy onboarding and parity across machines.  
**Trade-off:** Requires Docker runtime and can be heavier than native installs.

---

## Known Limitations / Future Improvements

- No reconnect/resume strategy for in-progress matches
- Basic auth flow (device ID + username) without account linking
- No telemetry/metrics dashboards yet
- No formal E2E automation (manual 2-tab validation currently)
- Default insecure Nakama keys are still used for local development

---

## Production Readiness Notes

Before production deployment:

- Rotate all default Nakama secrets/keys
- Add structured logging + tracing
- Add server/runtime health and alerting
- Add integration tests for match flow + timer edge cases
- Harden rate limits, auth strategy, and abuse prevention
- Add CI/CD for build, lint, test, and deploy pipelines

---

## Useful Commands

```bash
# Rebuild Nakama module
cd nakama && npm run build

# Restart backend
cd .. && docker compose restart nakama

# Tail Nakama logs
docker compose logs -f nakama

# Stop stack
docker compose down
```

---

## License

MIT (recommended). Update this section based on your preferred license.
