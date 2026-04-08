# Multiplayer Tic-Tac-Toe — Nakama

Real-time multiplayer Tic-Tac-Toe with server-authoritative game logic,
session-based scoring, matchmaking, room browser, and full auth system.

## Documentation

| Doc | Description |
|-----|-------------|
| [Project Overview](docs/01-project-overview.md) | Features, tech stack, architecture summary |
| [Project Structure](docs/02-project-structure.md) | Every file explained, folder tree, data flow |
| [Setup Guide](docs/03-setup-guide.md) | Local development setup, step by step |
| [System Design](docs/04-system-design.md) | Architecture, protocol, match lifecycle, token flow |
| [Database Explanation](docs/05-database-explanation.md) | PostgreSQL, Nakama storage, leaderboard schema |
| [Server Module](docs/06-server-module-explanation.md) | main.ts annotated — match handlers, RPCs, logic |
| [Frontend](docs/07-frontend-explanation.md) | React components, context, screen flow |
| [Authentication](docs/08-auth-explanation.md) | Token lifecycle, guest mode, session restore |

| [Room System](docs/10-rooms-explanation.md) | Room lifecycle, storage design, expiry |
| [Deployment Guide](docs/11-deployment-guide.md) | Railway + Vercel, env vars, production checklist |
| [Troubleshooting](docs/12-troubleshooting.md) | Diagnostic commands, problem/fix table |

## Quick start

```bash
# 1. Install dependencies
cd nakama && npm install && cd ../frontend && npm install && cd ..

# 2. Build Nakama module
cd nakama && npm run build && cd ..

# 3. Start backend
docker-compose up -d

# 4. Verify
curl http://localhost:7350/healthcheck

# 5. Start frontend
cd frontend && npm run dev
```

Open http://localhost:3000 in two browser tabs to test multiplayer.

## Tech stack

Nakama 3.21.1 · PostgreSQL 14 · React 18 · Vite · TypeScript · Tailwind CSS

## Live demo

Frontend: https://your-game.vercel.app
Nakama: https://your-app.up.railway.app
