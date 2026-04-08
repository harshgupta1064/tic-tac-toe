# Frontend Explanation

## Technology choices

- **React 18:** A component-driven UI maps cleanly to screen-based game flow (`auth`, `lobby`, `matchmaking`, `game`, `gameover`, `rooms`), while context centralizes shared app state and actions.
- **Vite:** Fast startup and hot module replacement reduce iteration time while tuning real-time UX and socket-driven views.
- **TypeScript:** Strong typing helps enforce payload shape consistency between Nakama messages/RPC payloads and frontend state models.
- **Tailwind CSS:** Utility-first classes enable rapid mobile-first styling with less context-switching between component files and separate CSS authoring.

## Screen flow diagram

```text
auth
 ├─ (login/register success) -> lobby
 └─ (continue as guest) -> lobby

lobby
 ├─ (find match) -> matchmaking -> game -> gameover -> lobby
 ├─ (browse/create rooms) -> rooms -> matchmaking -> game -> gameover -> lobby
 └─ (logout) -> auth
```

## Component explanations

### App.tsx

`App.tsx` acts as a screen router that reads `screen` from `GameContext` and renders one active screen component at a time. It is the central place where navigation state maps to concrete UI. Adding a new screen requires one additional render branch in `App.tsx` plus a new component implementation.

### lib/nakama.ts

This module uses a singleton client pattern so one Nakama `Client` instance is created once and reused throughout the app.

Exported functions:

- `saveSession`: persists access token, refresh token, and fallback credentials into localStorage
- `clearSession`: removes persisted auth/session values
- `restoreSession`: performs 3-tier restore (`token -> refresh -> re-auth -> null`)
- `registerAccount`: wraps email auth with `create=true`
- `loginAccount`: wraps email auth with `create=false`
- `loginGuest`: wraps device auth using random temporary ID
- `createSocket`: creates and connects WebSocket socket for real-time features

### context/GameContext.tsx

`GameContext` holds global auth, socket, game, leaderboard, and navigation state, plus action methods consumed by screens.

Two-ref pattern:

- `sessionRef`: synchronously mirrors latest session object for callbacks to avoid stale closures
- `socketRef`: synchronously mirrors latest connected socket for action handlers/events

Refs are used because state updates are asynchronous; refs allow immediate in-callback reads.

`setupSocket` is the shared initialization path used by register/login/guest flows. It wires:

- `onmatchdata`: routes server op-codes to state updates
- `onmatchpresence`: detects peer disconnect and presence changes
- `ondisconnect`: handles server/network disconnect transitions

`fetchLeaderboard` calls `get_leaderboard` RPC and parses `result.payload` as JSON string (important: payload arrives as string, not object). It updates both top leaderboard records and personal rank card data.

### AuthScreen.tsx

This screen uses a two-section vertical layout. The top section stays compact with title, auth mode tabs, and form fields; the bottom `flex-1` section positions guest CTA closer to vertical center on taller screens. The result is better mobile ergonomics without displacing auth inputs.

### LobbyScreen.tsx

UI and action mapping:

- Header: username, guest badge, logout action
- Mode selector: local-only state until matchmaking trigger
- **Find Match**: calls `findMatch(mode)` then navigates to matchmaking
- **Browse/Create Rooms**: navigates to rooms screen
- **Leaderboard button**: hidden for guests; calls `fetchLeaderboard` before modal open
- Leaderboard modal: renders top 10 (`W/L/D/streak/best`) and personal rank card

### GameBoard.tsx

Renders a 3x3 button grid from authoritative board state. Cell click calls `makeMove(index)`, which sends `MOVE` to server. Interaction is disabled when it is not the local player's turn or after game completion. UI includes active-turn highlighting and timed-mode countdown visible only during the local player's turn.

### GameOverScreen.tsx

Displays contextual outcome styling (win/loss/draw) with color and emoji cues and a mini final board preview. Actions:

- **Play Again:** re-enters matchmaking with the same mode
- **Back to Lobby:** leaves current match context

On mount, registered users trigger a silent leaderboard refresh so lobby modal data is warm/fresh after returning.

### RoomBrowserScreen.tsx

Two-tab experience:

- **Browse tab:** polls `list_rooms` every 5 seconds and renders joinable rooms
- **Create tab:** captures room name + mode and creates via RPC

Create flow joins returned `matchId` directly (no matchmaker), while join flow uses room `matchId` then calls `mark_room_full` so room listing is hidden for others.

### MatchmakingScreen.tsx

This component is intentionally presentational: it shows waiting spinner and status text from context. The cancel action returns to lobby; it does not currently remove pending matchmaker ticket, so a production-hardening improvement would include explicit `removeMatchmaker` support.
