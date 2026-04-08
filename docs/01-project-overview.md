# Project Overview

## What this project is

This project is a real-time multiplayer Tic-Tac-Toe game that runs in the browser. Two players are matched together and play on a shared board where both clients stay synchronized through live server updates. The backend is fully server-authoritative, meaning all move validation, turn control, win/draw detection, timer handling, and result decisions are enforced on the server, while the frontend only sends user intentions and renders server state.

## Who it is for

This project is built for developers who want to learn practical multiplayer game architecture using Nakama and a modern React frontend. It is also useful as a reference implementation for:

- Server-authoritative game architecture
- Real-time WebSocket communication
- Matchmaking systems
- Persistent leaderboards
- Room-based multiplayer

## Feature list (complete)

- Real-time multiplayer with WebSocket connections
- Server-authoritative game logic (all moves validated server-side)
- Automatic matchmaking (Nakama matchmaker pairs players by game mode)
- Manual room creation and room browser (create a named room, others can join)
- Two game modes: Classic (no timer) and Timed (30 seconds per turn)
- Auto-forfeit on timeout in timed mode
- Forfeit on disconnect (opponent leaving ends the game)
- Win/loss/draw detection with full leaderboard tracking
- Persistent leaderboard: wins, losses, draws, current streak, best streak, rank
- Personal rank shown even if player is outside top 10
- Frictionless device-based authentication (username only, tied to device ID)
- Persistent stats across sessions via device linking
- Auto session restore on page reload using JWT access and refresh tokens
- Mobile-first responsive UI with dark theme

## Tech stack table

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Game backend | Nakama | 3.21.1 | Real-time authoritative match engine, matchmaking, RPCs, auth, leaderboards |
| Database | PostgreSQL | 14 | Persistent storage for Nakama accounts, leaderboard records, and storage objects |
| Frontend framework | React + Vite + TypeScript | React 18 + Vite 5 + TS 5 | Browser UI, stateful screen flow, strongly typed client-side app |
| Styling | Tailwind CSS | 3.x | Mobile-first utility styling and responsive layout |
| Client SDK | `@heroiclabs/nakama-js` | 2.x | Nakama HTTP/WebSocket client integration in frontend |
| Container runtime | Docker + Docker Compose | Docker Desktop + Compose v2 | Local orchestration for Nakama + PostgreSQL services |
| Deployment targets | Railway (backend), Vercel (frontend) | Managed cloud platforms | Production hosting for stateful game backend and static frontend |

## High-level architecture summary

The system follows a server-authoritative architecture where the React frontend acts as a thin renderer and input layer, not a game engine. The browser sends move intents (for example, "place mark at index 4"), and the Nakama server validates turn order and move legality, applies state changes, computes outcomes, and broadcasts the canonical game state to both players. Because clients never decide the game state locally, cheating vectors are reduced and both players stay in strict sync with one source of truth.
