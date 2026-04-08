# Leaderboard Explanation

## Overview

The leaderboard system tracks six player metrics for registered users:

1. Wins
2. Losses
3. Draws
4. Current win streak
5. Best win streak ever
6. Overall rank

Guest users are excluded from all leaderboard and streak writes. Draw outcomes are streak-neutral (no increment, no reset).

## Why four separate leaderboards?

Nakama leaderboards are sorted by one score dimension each. Because the UI requires multiple metrics, this project uses four leaderboards: wins (primary rank), losses, draws, and best streak. The server fetches secondary records, builds hash maps by user ID, and joins those metrics onto the primary wins list when constructing the final response.

## Current streak vs best streak - the split design

`currentStreak` must increase on win and reset to zero on loss. Nakama leaderboard `best` operator cannot decrease values, so it is not suitable for mutable live streak.

Design split:

- **Current streak:** stored in `player_stats` storage object (`stats_{userId}`), mutable every game.
- **Best streak:** stored in `tictactoe_best_streak` leaderboard with `best` operator.

Write logic:

- On win:
  - Read current streak from storage
  - Increment and write back
  - Write new value into best-streak leaderboard (auto-updates only if improved)
- On loss:
  - Reset current streak storage to `0`
- On draw:
  - Leave streak unchanged

This cleanly supports both live streak display and all-time best ranking.

## The get_leaderboard RPC in detail

1. Ensure all 4 leaderboards exist (idempotent create).
2. Fetch top 10 from `tictactoe_wins`.
3. Fetch top 50 from losses/draws/best streak leaderboards.
4. Build `lossMap`, `drawMap`, and `streakMap` keyed by `ownerId`.
5. Batch-read `currentStreak` storage for top-10 users.
6. Merge all metrics into normalized leaderboard row objects.
7. Check whether caller (`ctx.userId`) is already in top 10.
8. If not in top 10, fetch caller-specific win record via `ownerIds=[ctx.userId]` to retrieve true global rank.
9. Return:
   - `records: LeaderboardEntry[]` (top 10)
   - `myRecord: LeaderboardEntry | null` (outside-top-10 personal row)

## Frontend display

Leaderboard modal renders:

- Column headers: `# / Player / W / L / D / Streak / Best`
- Top-10 table rows with medals/icons for ranks 1, 2, and 3
- Current-user highlight style when present in top list
- Separate "Your rank" card below divider when `myRecord` exists
- In-modal manual refresh action
- Silent data warm-up from `GameOverScreen` so data is current upon returning to lobby

## Leaderboard write timing

Writes happen immediately at result decision points:

- **Win/Loss:** inside `matchLoop` right after winner detection, and inside `matchLeave` for forfeit outcomes
- **Draw:** inside `matchLoop` when draw is detected

Runtime writes are synchronous in Nakama's module execution model, so updates are persisted before final state broadcast completes. This makes leaderboard fetches immediately after match completion consistent with latest outcomes.

## Guest exclusion

Two enforcement layers:

- **Layer 1 (authoritative server):** write functions check `guestUserIds` before any leaderboard/storage write.
- **Layer 2 (frontend UX):** leaderboard button is hidden for `isGuest === true`.

Even if client behavior is altered, server checks prevent guest records from being created.
