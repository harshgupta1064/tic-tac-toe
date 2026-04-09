# Multiplayer Tic-Tac-Toe Backend (Assignment README)

This README documents the backend in a standard, production-like way for assignment submission.

## 1) Setup and Installation Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Nakama binary (3.x) installed and available in PATH

### Project setup

```bash
git clone <your-repo-url>
cd tic-tac-toe

cd nakama
npm install
npm run build

cd ../frontend
npm install
```

### Environment setup (use examples only)

```bash
# Backend env
cp nakama/.env.example nakama/.env

# Frontend env
cp frontend/.env.example frontend/.env.local
```

### Local database

Create a PostgreSQL database named `nakama`.

### Start backend (most common local flow)

Run from `nakama/`:

```powershell
# 1) Migrate schema
nakama migrate up --database.address "postgres:<password>@127.0.0.1:5432/nakama"

# 2) Start server
nakama --name "nakama1" --database.address "postgres:<password>@127.0.0.1:5432/nakama" --logger.level "DEBUG" --session.token_expiry_sec 7200 --runtime.path "D:/Assignments/tic-tac-toe/nakama/build" --runtime.js_entrypoint "main.js"
```

### Start frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000`.

## 2) Architecture and Design Decisions

### Architecture

- Frontend (`frontend`) uses Nakama JS client.
- Backend (`nakama/src`) contains all authoritative game logic.
- Database is PostgreSQL (used by Nakama core + storage collections).

### Design decisions

- **Server authoritative gameplay**: moves validated in backend match loop (`matchLoop`), not trusted from client.
- **Realtime protocol**: WebSocket match state with opcodes for move/state/game-over/timer/rematch.
- **Room system via storage**: room data stored in Nakama collection `rooms`, keyed by generated room IDs.
- **Simple auth model**: device-based auth and username-driven local experience for fast onboarding.

### Key backend modules

- `nakama/src/main.ts`: registers match handler + RPCs.
- `nakama/src/match/handler.ts`: turn logic, win/draw, timer timeout, rematch, disconnect behavior.
- `nakama/src/rpc/rooms.rpc.ts`: room create/list/join-by-code related server APIs.

<!-- ## 3) Deployment Process Documentation

### Common backend deployment

Recommended approach: VM + PostgreSQL + Nakama process manager.

1. Provision Linux VM (or Windows Server) and PostgreSQL.
2. Clone repo and run `cd nakama && npm ci && npm run build`.
3. Install Nakama binary on server.
4. Run migration:
   - `nakama migrate up --database.address "postgres:<PASS>@<HOST>:<PORT>/<DB>"`
5. Start Nakama with:
   - `--database.address`
   - `--runtime.path` (to `nakama/build`)
   - `--runtime.js_entrypoint "main.js"`
   - `--session.token_expiry_sec`
   - `--logger.level`
6. Put reverse proxy/TLS in front (HTTPS + WSS via port 443).

### Frontend deployment

- Deploy `frontend` to Vercel.
- Set `VITE_NAKAMA_HOST` to your backend domain.
- Set `VITE_NAKAMA_PORT=443` and `VITE_NAKAMA_USE_SSL=true`. -->

## 4) API / Server Configuration Details

### Runtime and DB configuration

- DB address format used by Nakama CLI:
  - `postgres:<PASSWORD>@<HOST>:<PORT>/<DATABASE>`
- Runtime path:
  - `--runtime.path "D:/Assignments/tic-tac-toe/nakama/build"`
- JS entrypoint:
  - `--runtime.js_entrypoint "main.js"`
- Token expiry:
  - `--session.token_expiry_sec 7200`

### Registered backend RPCs

- `create_room`
- `list_rooms`
- `mark_room_full`
- `delete_room`
- `get_room_by_code`

### Match/Realtime configuration

- Match module name: `tictactoe`
- Matchmaker requires exactly 2 players (`min=2`, `max=2`)
- Supports `classic` and `timed` modes

### Database notes

- No custom raw SQL `CREATE TABLE` in project code.
- Nakama creates required internal tables through migrations.

## 5) How to Test Multiplayer Functionality

### Basic end-to-end test

1. Start PostgreSQL.
2. Run migration command.
3. Start Nakama backend.
4. Verify health:
   - `http://127.0.0.1:7350/healthcheck` should return `{}`
5. Start frontend (`npm run dev`).
6. Open app in two browser windows/tabs.
7. Login with two different usernames.

### Functional scenarios

- **Matchmaking**: both users click Find Match in same mode and enter same live game.
- **Gameplay rules**: invalid turns are rejected, valid turns update board for both users.
- **Win/Draw flow**: game over screen shows correct winner/draw.
- **Timed mode**: timeout produces game-over with timeout reason.
- **Room flow**: create room in one tab, join by list/code from second tab.
- **Rematch flow**: request/accept and request/decline both work.
- **Disconnect**: when one tab closes, other user is returned safely to lobby state.
