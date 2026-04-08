# System Design

## Architecture overview

The project uses a three-tier architecture:

- **Tier 1 - React frontend (browser):** Handles UI rendering, user input, and local session persistence.
- **Tier 2 - Nakama game server (TypeScript runtime):** Owns all gameplay validation, matchmaking decisions, room RPCs, and authoritative match state.
- **Tier 3 - PostgreSQL database:** Stores persistent user accounts, leaderboard records, and storage objects managed through Nakama APIs.

## Why server-authoritative?

Client-authoritative games are easy to tamper with because browser code can be modified, replayed, or desynchronized between players. In this system, clients only send intentions (for example, "place at index 4"), and the server decides whether the move is legal, applies it to canonical state, and broadcasts the result to everyone. Because the browser never decides wins, turn order, or move legality, invalid or cheated actions are rejected by the server and cannot corrupt shared state.

## Communication protocol: WebSockets + Op-Codes

Nakama uses persistent WebSocket connections for low-latency bidirectional messaging. Instead of polling over HTTP, clients keep one live connection and exchange typed match data using numeric op-codes.

| Op-Code | Name | Direction | Payload | When sent |
|---|---|---|---|---|
| 1 | MOVE | Client -> Server | `{ position: 0-8 }` | Player taps a cell |
| 2 | STATE | Server -> Client | `{ board, currentTurn, lastMove }` | After a valid move |
| 3 | REJECTED | Server -> Client | `{ reason: string }` | Move failed validation |
| 4 | GAME_OVER | Server -> Client | `{ winner, winnerMark, reason }` | Game ends |
| 5 | READY | Server -> Client | `{ board, marks, currentTurn, mode }` | Both players joined |
| 6 | TICK | Server -> Client | `{ remaining: number }` | Every second in timed mode |

## Match lifecycle

1. **`matchInit`** - Called once when a match is created. Initializes empty board state, tick rate, and mode-specific settings from params.
2. **`matchJoinAttempt`** - Called before admission. Rejects join if the game is already full or marked complete.
3. **`matchJoin`** - Called when join is confirmed. Adds presence, and when second player joins assigns X/O, sets initial turn, and broadcasts `READY` then initial `STATE`.
4. **`matchLoop`** - Called every tick (1/sec). Processes incoming move messages, validates turn/position, applies state, checks win/draw, updates timers in timed mode, and returns `null` when match should terminate.
5. **`matchLeave`** - Called on disconnect. If gameplay had already started, awards forfeit win to remaining player and ends match.
6. **`matchTerminate`** - Called when Nakama is shutting down or explicitly terminating the match.

## Matchmaking flow

1. Client calls `addMatchmaker` with properties like `{ mode: "classic" | "timed" }`.
2. Nakama queues players in the matchmaker pool.
3. When two compatible players are found, Nakama triggers `matchmakerMatched` on the server.
4. Server creates a real-time match using `nk.matchCreate()`.
5. Both clients receive `onmatchmakermatched` with the created match ID.
6. Both clients call `joinMatch(matchId)` over socket.
7. Server `matchJoin` executes and gameplay begins after second join.

## Room flow

Manual rooms are explicit and named, unlike automatic random pairing:

1. Player A calls `create_room` RPC.
2. Server creates a Nakama match and stores room metadata in PostgreSQL via Nakama storage.
3. Server returns the `matchId`.
4. Player A joins and waits alone.
5. Player B opens room browser and calls `list_rooms`.
6. Player B joins via `joinMatch(matchId)`.
7. On second presence join, game starts and `mark_room_full` is called to hide room from listings.

## State management on the server vs client

Server holds canonical `MatchState` (board, marks, turn, winner, timer, guests). Client keeps a mirror copy in React state. After each valid state transition, the server broadcasts the new state and the client replaces local snapshot from server payload instead of mutating game logic client-side. This prevents frontend drift and keeps both players synchronized with one authority.

## Token lifecycle

- **Access token:** short-lived JWT (default 2 hours), sent on requests and socket auth.
- **Refresh token:** longer-lived token used to mint new access token when access expires.
- **Page load restore chain:** frontend first checks if access token is still valid; if expired it tries refresh; if refresh fails it re-authenticates using stored credentials; if credentials are missing (guest or fresh browser), auth screen is shown.
