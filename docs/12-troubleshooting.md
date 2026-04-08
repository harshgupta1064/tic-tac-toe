# Troubleshooting Guide

## Quick diagnostic commands

```bash
# Check if Nakama is running and healthy
curl http://localhost:7350/healthcheck

# Check if our module loaded correctly
docker-compose logs nakama | grep "TicTacToe module loaded"

# Follow Nakama logs live
docker-compose logs nakama -f

# Check for errors in Nakama logs
docker-compose logs nakama | grep -iE "error|panic|fatal"

# Check leaderboard writes
docker-compose logs nakama | grep -iE "Wrote win|Wrote loss|streak|draw"

# Check auth events
docker-compose logs nakama | grep -iE "registered|guest|login"

# Restart everything cleanly
docker-compose down && docker-compose up -d
```

## Problem -> Cause -> Fix table

| Problem | Likely cause | Fix |
|---|---|---|
| `docker-compose up` fails immediately | Port `5432` or `7350` already in use | Run `lsof -i :5432` and `lsof -i :7350`, stop conflicting process or remap ports |
| Nakama starts but module not found | Build artifact missing in `nakama/build/` | Run `cd nakama && npm run build`, confirm `nakama/build/main.js` exists |
| TypeScript build errors | Type mismatch or invalid syntax in module | Fix reported line, then run build again |
| "TicTacToe module loaded" not in logs | Nakama could not parse module output | Run `node nakama/build/main.js` to surface parse errors quickly |
| Frontend cannot connect to Nakama | Wrong host/port/ssl in `.env.local` | Verify host/port/ssl values, often `127.0.0.1` works better than `localhost` |
| Two players cannot match | Players selected different game modes | Ensure both users select same mode (`Classic` or `Timed`) |
| Matchmaking appears stuck forever | Only one active player searching | Start search from two tabs/windows at the same time |
| "Wrong username or password" for existing account | Username-to-email derivation mismatch | Enter exact same username pattern used at registration |
| Leaderboard empty after game | Frontend parse/refresh issue | Check browser console for leaderboard logs and confirm fetch RPC is triggered |
| Guest leaderboard button visible | `isGuest` state not set or RPC failed | Verify `mark_guest` RPC succeeds and guest flag propagates |
| Streak not incrementing | Storage write/read issue in `player_stats` | Inspect Nakama logs for storage permission or key errors |
| Draws missing from leaderboard | Draw write path not executed | Confirm draw branch calls leaderboard draw write function |
| Room not visible in browser | Room expired/filter excluded | Create a new room (older than 30 min or `full` status is filtered out) |
| Railway deploy fails | Wrong Dockerfile location/name | Ensure `Dockerfile.nakama` exists at repository root |
| Railway Nakama DB connect failure | Wrong DB address format | Use Nakama format `postgres:PASSWORD@HOST:PORT/DATABASE` |
| WebSocket fails in production | SSL and port mismatch | Set `VITE_NAKAMA_USE_SSL=true` and `VITE_NAKAMA_PORT=443` |
| Session not restored on reload | Tokens expired and no credentials fallback | Clear localStorage and log in again; verify fallback keys exist |
| "Account not found" during login | Different username case/format than expected | Use same normalized username convention as registration |
| Game board not updating | Socket disconnected or event handlers not active | Check browser WebSocket errors, refresh, and rejoin |
| Timer not visible in timed mode | Not local player's turn | Timer displays only during your turn in timed mode |
| Forfeit loss not recorded | Disconnect happened before marks assignment | Expected behavior due to pre-start forfeit guard |

## Reading Nakama logs

Typical Nakama log line structure:

```text
<timestamp> <level> <module> <message>
```

Severity guidance:

- `DEBUG`: verbose per-tick details and internal flow tracing
- `INFO`: normal milestones (join, start, result, writes)
- `WARN`: recoverable issues or partial fallbacks
- `ERROR`: failures requiring investigation (write failures, malformed payload paths)

## Resetting all data

Use this only in development when you need a clean state:

```bash
# Stop everything
docker-compose down

# Delete the PostgreSQL volume (ALL data lost - accounts, leaderboards, rooms)
docker-compose down -v

# Start fresh
docker-compose up -d
```

Warning: this permanently removes local development data including accounts, leaderboard history, and room records. Never run data-destructive reset steps in production environments.
