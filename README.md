# Multiplayer Tic-Tac-Toe Backend

This README documents the backend in a standard, production-like way for assignment submission.

## Live Links

- Frontend Live Demo:
  - [https://tic-tac-toe-git-main-harshgupta1064-7247s-projects.vercel.app/](https://tic-tac-toe-git-main-harshgupta1064-7247s-projects.vercel.app/)
- Backend Health Endpoint:
  - [https://tic-tac-toe-production-97e5.up.railway.app/healthcheck](https://tic-tac-toe-production-97e5.up.railway.app/healthcheck)

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

### Docker setup (backend + database)

From repo root:

```bash
# 1) Create env file for compose
cp .env.docker.example .env

# 2) Start PostgreSQL + Nakama
docker compose up --build -d

# 3) Check logs (optional)
docker compose logs -f nakama
```

Stop services:

```bash
docker compose down
```

Reset DB volume too:

```bash
docker compose down -v
```

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

## 3) Deployment Process Documentation

### Deployed stack (current)

- **Frontend**: Vercel (`frontend` project root)
- **Backend**: Railway (Nakama Docker service)
- **Database**: Railway PostgreSQL

### Backend deployment (Railway)

1. Create a Railway project.
2. Add a PostgreSQL service and copy DB credentials/connection info.
3. Add a new service from this GitHub repository, with root directory `nakama`.
4. Railway builds using `nakama/Dockerfile`.
5. Set backend environment variables in Railway:
   - `NAKAMA_NAME=tictactoe`
   - `NAKAMA_LOGGER_LEVEL=INFO`
   - `NAKAMA_SESSION_TOKEN_EXPIRY_SEC=7200`
   - `NAKAMA_RUNTIME_PATH=/nakama/data/modules/build`
   - `NAKAMA_DB_ADDRESS=postgres:<PASSWORD>@<HOST>:<PORT>/<DATABASE>`
6. Ensure Railway public routing targets Nakama HTTP port `7350`.
7. Deploy and verify:
   - `https://<your-railway-backend-domain>/healthcheck` returns `{}`

### Frontend deployment (Vercel)

1. Import this repository into Vercel.
2. Set project root directory to `frontend`.
3. Build command:
   - `npm run build`
4. Output directory:
   - `dist`
5. Set frontend environment variables:
   - `VITE_NAKAMA_HOST=<your-railway-backend-domain>`
   - `VITE_NAKAMA_PORT=443`
   - `VITE_NAKAMA_USE_SSL=true`
6. Deploy and open the generated Vercel production URL.

### Deployment notes

- Frontend uses HTTPS/WSS to connect to Railway backend through port `443`.
- Railway routes public traffic to Nakama internal port `7350`.
- If deployment logs show permission issues for `.bin/tsc` or `.bin/vite`, this repo already uses Node-invoked scripts in `frontend/package.json`.

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
