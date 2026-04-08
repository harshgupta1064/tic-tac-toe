# Server Module Explanation (nakama/src/main.ts)

## What is a Nakama server module?

Nakama allows custom server logic in Go, Lua, or TypeScript. This project uses TypeScript for authoring, then compiles to JavaScript for runtime execution inside Nakama's embedded Duktape engine (not Node.js). That runtime model has important constraints:

- No npm runtime imports (packages are for compile-time types/tooling only)
- No `fetch()`, no `require()`, and no Node built-ins
- No direct filesystem access
- No `async/await` style RPC flow in the same way as Node services
- All backend capabilities come from Nakama-provided APIs on `nk`

## Module sections (annotated)

### Op-Codes

The module declares numeric op-code constants used as a stable protocol contract:

- `MOVE` (`1`): client -> server move intention
- `STATE` (`2`): server -> clients canonical board state update
- `REJECTED` (`3`): server -> client validation failure reason
- `GAME_OVER` (`4`): server -> clients final outcome
- `READY` (`5`): server -> clients game start state once two players join
- `TICK` (`6`): server -> client timed-turn countdown updates

### MatchState interface

`MatchState` is the canonical in-memory state for each active match:

- `board: string[]` - 9 cells; `""` empty, `"X"` or `"O"` occupied
- `marks: { [userId]: "X" | "O" }` - mark assignment per player
- `currentTurn: string` - user ID whose turn is active
- `winner: string | null` - winner user ID, `"draw"`, or `null`
- `gameOver: boolean` - set true after final outcome
- `presences: { [userId]: Presence }` - connected player presences
- `mode: "classic" | "timed"` - match mode chosen at creation
- `turnStartTick: number` - tick index when active turn began
- `tickRate: number` - loop ticks per second (1 in this project)
- `turnLimitTicks: number` - timed mode turn limit (30 ticks)
- `guestUserIds: string[]` - guest players excluded from leaderboard writes

### Win detection

`WIN_LINES` enumerates all 8 winning patterns:

- 3 rows
- 3 columns
- 2 diagonals

`checkWinner` iterates those patterns and returns:

- `"X"` or `"O"` when a line is completed
- `"draw"` when board is full with no winner
- `null` when game should continue

### matchInit

Called once per new match. It allocates an empty board, initializes maps/flags, sets tick rate and turn limit rules, and applies mode from params provided by matchmaking or room creation RPC flow.

### matchJoinAttempt

Called before a user is admitted to the match. It rejects joins when:

- Player capacity is already 2
- Game is already completed

This prevents invalid late joins.

### matchJoin

Called after join is accepted. It stores presence in `presences`, inspects account metadata to classify guests, and when second player arrives it:

- Assigns marks (`X`/`O`)
- Sets initial `currentTurn`
- Broadcasts `READY`
- Broadcasts initial `STATE`

### matchLoop

Executed every tick (1/sec), this is the core game engine:

1. If fewer than 2 players are present, skip processing and wait.
2. If `gameOver` is true, return `null` so Nakama can terminate match.
3. Process each incoming message:
   - Validate op-code is `MOVE`
   - Validate sender equals `currentTurn`
   - Parse payload JSON
   - Validate `position` in `[0..8]` and target cell is empty
   - Apply mark to board
   - Call `checkWinner`
   - If winner/draw:
     - Broadcast `GAME_OVER`
     - Write leaderboard/streak outcomes
     - Set `gameOver = true`
   - Else:
     - Swap turn
     - Set `turnStartTick`
     - Broadcast updated `STATE`
4. If mode is `timed`, compute elapsed turn ticks:
   - Broadcast `TICK` updates to active player
   - If elapsed reaches 30, current player forfeits and `GAME_OVER` is broadcast

### matchLeave

Called when a player disconnects. If game had actually started (marks assigned), remaining player is awarded a forfeit win and leaderboard writes are applied. This guard avoids false forfeits during pre-game waiting states.

### Leaderboard functions

`writeLeaderboard` (win/loss path):

- Checks `guestUserIds` and skips writes for guest participants
- Winner:
  - Increments wins leaderboard
  - Reads `currentStreak` from `player_stats`
  - Increments and writes streak back
  - Writes updated streak to `tictactoe_best_streak` (`best` operator)
- Loser:
  - Increments losses leaderboard
  - Resets `currentStreak` to `0` in storage

`writeLeaderboardDraw`:

- Iterates both players
- Skips guests
- Increments draw leaderboard for each
- Does not alter streak values (draws are streak-neutral)

### RPC functions

- `get_leaderboard`:
  - Reads top 10 wins
  - Joins losses/draws/best streak from secondary boards
  - Reads current streak from storage
  - Optionally fetches caller's own ranked record if outside top 10
- `create_room`:
  - Creates a new match with mode params
  - Writes room metadata object to `rooms` collection
- `list_rooms`:
  - Lists room objects
  - Filters to waiting and recent rooms
- `mark_room_full`:
  - Marks room status as full in storage
- `register_user`:
  - Writes metadata (`guest=false`) for registered users
- `mark_guest`:
  - Writes metadata (`guest=true`) for guest users

### InitModule

`InitModule` is Nakama's startup entrypoint for this module. It registers match handler lifecycle functions and RPC methods, then creates leaderboards in an idempotent way so restarts are safe. The final idiom `!InitModule && InitModule.bind(null)` is required in Nakama TypeScript builds to prevent tree-shaking from removing module initialization.
