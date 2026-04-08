# Room System Explanation

## Purpose

Automatic matchmaking is ideal for quick random games, but rooms add intentional pairing and discoverability. Players can create named rooms to invite specific opponents, or browse open rooms and join one directly.

## Room lifecycle

1. Player A opens `RoomBrowserScreen` and chooses **Create Room**.
2. Player A enters room name and selects `classic` or `timed`.
3. Frontend calls `create_room` RPC with `{ name, mode }`.
4. Server creates a real Nakama match via `nk.matchCreate()`.
5. Server writes room metadata to `rooms` storage collection using system user owner.
6. Server returns `{ roomId, matchId, name, mode }`.
7. Frontend calls `sock.joinMatch(matchId)` for host.
8. UI transitions to waiting/matchmaking state.
9. Player B opens room browser; `list_rooms` returns waiting rooms.
10. Player B clicks Join and client calls `sock.joinMatch(room.matchId)`.
11. Server `matchJoin` sees second presence, assigns marks, and broadcasts `READY`.
12. Client calls `mark_room_full` RPC.
13. Next browser refresh hides room (`status=full` filtered out).

## Storage structure

Room object shape:

```json
{
  "id": "uuid-v4",
  "name": "Battle Room",
  "mode": "classic",
  "hostUserId": "uuid",
  "hostUsername": "Alice",
  "matchId": "nakama-match-id",
  "status": "waiting",
  "createdAt": 1700000000000
}
```

Field meaning:

- `id`: room identifier used as storage key
- `name`: user-facing room label
- `mode`: game mode for this room (`classic`/`timed`)
- `hostUserId`: creator account ID
- `hostUsername`: creator display name
- `matchId`: actual Nakama realtime match identifier
- `status`: lifecycle marker (`waiting` or `full`)
- `createdAt`: Unix epoch millis for soft-expiry filtering

## The system user trick

Nakama storage objects are always owned by a `userId`. To make one global room list visible to all users, rooms are written under system user ID `00000000-0000-0000-0000-000000000000`. Then `storageList` on that owner can return all room objects in one query. Public read permission (`2`) allows all authenticated users to browse the listing.

## Room expiry

Rooms are soft-expired at query time. `list_rooms` filters out:

- rooms older than 30 minutes (`Date.now() - createdAt > 30 * 60 * 1000`)
- rooms where `status = "full"`

Objects remain in storage unless a cleanup job deletes them, which is acceptable for small-to-medium usage footprints.

## Why rooms are not affected by matchmaker

Room joins are direct by `matchId`, not queue-based. Client clears or avoids stale `onmatchmakermatched` callback behavior (for example by setting it to `null`) before room flow to prevent collision with prior matchmaker activity. This keeps manual room joins isolated from automatic matchmaking tickets.
