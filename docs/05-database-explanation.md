# Database Explanation

## Overview

The project uses PostgreSQL as the persistence layer, but application logic does not write raw SQL directly. All persistence goes through Nakama APIs: account API, leaderboard API, and storage API. On startup, Nakama runs migrations (`nakama migrate up`) to ensure required internal tables exist and match expected schema.

## Nakama's data model

Nakama provides multiple storage primitives, and this project uses four core ones:

### 1. Accounts (users table)

Accounts are managed automatically by Nakama authentication flows.

Relevant fields:

- `user_id` (UUID) - immutable primary identifier
- `username` - display username
- `email` - internal convention: `username@tictactoe.local`
- `metadata` (JSON) - stores fields like `{ guest: true/false, registeredAt: timestamp }`
- `created_at`, `updated_at`

Registered users are created via `authenticateEmail`, while guests use `authenticateDevice`. Guest device IDs are random and intentionally not persisted locally, so guest sessions are effectively disposable.

### 2. Storage Objects (storage table)

Nakama storage is key-value JSON with `(collection, key, userId)` namespacing.

**Collection: `rooms`**

- Key pattern: `{roomId}` (UUID)
- Value: `{ id, name, mode, hostUserId, hostUsername, matchId, status, createdAt }`
- Owner userId: `00000000-0000-0000-0000-000000000000` (system user)
- Permissions: `read=2` (public), `write=1`

Why system user for rooms: all players need shared visibility into room listings, independent of room creator identity.

### 4. Sessions (internal, managed by Nakama)

Nakama internally manages JWT access and refresh token records. Access token expiry is configured via `--session.token_expiry_sec` (here `7200`, i.e., 2 hours). Refresh tokens are longer-lived and stored client-side for session renewal.

## Data that is NOT in the database

Some runtime state is intentionally in-memory and non-persistent:

- Active match state (`board`, `turn`, timer ticks, in-flight presences) exists in in-memory match handlers.
- Live WebSocket connections are transient and must reconnect after disruption.

If Nakama restarts during a game, active matches are lost and players must start a new match.

## PostgreSQL connection

Nakama expects DB addresses in this format:

```text
postgres:PASSWORD@HOST:PORT/DATABASE
```

Local default:

```text
postgres:localdb@postgres:5432/nakama
```

Important: this is Nakama's internal DSN style, not standard PostgreSQL URI style (`postgresql://...`). Supplying standard URI format directly will not work unless converted appropriately for Nakama runtime configuration.
