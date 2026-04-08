# Local Setup Guide

## Prerequisites

- Node.js 18+ - [https://nodejs.org](https://nodejs.org)
- npm 9+ (bundled with Node.js)
- Docker Desktop - [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- Docker Compose v2 (bundled with Docker Desktop)
- Git - [https://git-scm.com](https://git-scm.com)

## Step-by-step setup

### Step 1: Clone the repository

```bash
git clone <your-repo-url>
cd tictactoe-nakama
```

### Step 2: Install Nakama module dependencies

```bash
cd nakama
npm install
```

This installs the TypeScript compiler toolchain, `ts-patch`, and Nakama runtime type definitions used during development and compilation. These packages are compile-time dependencies that help generate runtime-compatible JavaScript for Nakama.

### Step 3: Build the Nakama server module

```bash
npm run build
```

This compiles `nakama/src/main.ts` into JavaScript output at `nakama/build/main.js`. Docker/Nakama loads the compiled build output, not raw TypeScript, so this step is required before running the module.

Example successful output:

```bash
> nakama-module@1.0.0 build
> tsc
```

### Step 4: Install frontend dependencies

```bash
cd ../frontend
npm install
```

### Step 5: Configure local environment variables

`nakama/.env` controls Nakama runtime config and is already committed with local defaults:

```bash
NAKAMA_DB_DRIVER=postgres
NAKAMA_DB_ADDRESS=postgres:localdb@localhost:5432/nakama
NAKAMA_RUNTIME_PATH=./build
NAKAMA_LOGGER_LEVEL=DEBUG
NAKAMA_SESSION_TOKEN_EXPIRY_SEC=7200
```

`frontend/.env.local` controls where the frontend connects:

```bash
VITE_NAKAMA_HOST=127.0.0.1
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_USE_SSL=false
VITE_NAKAMA_SERVER_KEY=defaultkey
```

Note: `.env.local` is git-ignored. Create it manually if it does not exist.

### Step 6: Start Nakama and PostgreSQL with Docker

```bash
cd ..  # back to project root
docker-compose up -d
```

This starts PostgreSQL on `5432` and Nakama on `7349` (gRPC), `7350` (HTTP/WebSocket), and `7351` (console). Nakama waits for PostgreSQL health/readiness before fully starting.

### Step 7: Verify Nakama is running and the module loaded

```bash
# Wait about 30 seconds after docker-compose up, then:
curl http://localhost:7350/healthcheck
# Expected: {}

# Check that our TypeScript module loaded successfully:
docker-compose logs nakama | grep "TicTacToe module loaded"
# Expected: a log line containing "TicTacToe module loaded successfully"
```

### Step 8: Start the frontend dev server

```bash
cd frontend
npm run dev
```

Expected output includes a Vite local URL such as:

```bash
VITE vX.X.X  ready in XXX ms
➜  Local:   http://localhost:3000/
```

### Step 9: Test multiplayer locally

Open two browser tabs at `http://localhost:3000`, register two different accounts, and select the same mode on both clients. Click **Find Match** in both tabs; matchmaking should pair them and start a match within seconds.

## Useful development commands

| Command | Location | What it does |
|---|---|---|
| `npm run build` | `nakama/` | Compile TypeScript server module |
| `npm run watch` | `nakama/` | Watch mode - recompiles on save |
| `npm run dev` | `frontend/` | Start Vite dev server with HMR |
| `npm run build` | `frontend/` | Build production bundle |
| `docker-compose up -d` | root | Start all backend services |
| `docker-compose down` | root | Stop all backend services |
| `docker-compose logs nakama` | root | View Nakama server logs |
| `docker-compose logs nakama -f` | root | Follow Nakama logs live |
| `docker-compose down -v` | root | Stop and delete all data (wipe DB) |

## Nakama Console

Nakama includes an admin console at `http://localhost:7351` (default credentials: `admin` / `password`). You can inspect accounts, verify leaderboard records, browse storage objects (including rooms and streak stats), invoke RPC endpoints, and monitor active matches from one interface.
