import {
  LEADERBOARD_WINS,
  LEADERBOARD_LOSSES,
  LEADERBOARD_STREAK,
  LEADERBOARD_DRAWS,
  LeaderboardRow,
} from "../models/types";
import { readProfile, writeProfile } from "./userStore";

export function ensureLeaderboards(nk: nkruntime.Nakama): void {
  try { nk.leaderboardCreate(LEADERBOARD_WINS,   false, "desc" as any, "incr" as any, "", {} as any); } catch {}
  try { nk.leaderboardCreate(LEADERBOARD_LOSSES, false, "desc" as any, "incr" as any, "", {} as any); } catch {}
  try { nk.leaderboardCreate(LEADERBOARD_DRAWS,  false, "desc" as any, "incr" as any, "", {} as any); } catch {}
  try { nk.leaderboardCreate(LEADERBOARD_STREAK, false, "desc" as any, "best" as any, "", {} as any); } catch {}
}

export function writeMatchResult(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  state: { marks: { [uid: string]: "X" | "O" } },
  winnerUserId: string | null,
  loserUserId:  string | null,
  winnerUsername: string,
  loserUsername:  string
): void {
  try {
    ensureLeaderboards(nk);

    if (winnerUserId && loserUserId) {
      const winner = readProfile(nk, winnerUserId, winnerUsername);
      winner.wins += 1;
      winner.currentStreak += 1;
      if (winner.currentStreak > winner.bestStreak) winner.bestStreak = winner.currentStreak;
      writeProfile(nk, winner);

      nk.leaderboardRecordWrite(LEADERBOARD_WINS, winnerUserId, winnerUsername || "", 1, 0, {});
      nk.leaderboardRecordWrite(LEADERBOARD_STREAK, winnerUserId, winnerUsername || "", winner.bestStreak, 0, {});

      const loser = readProfile(nk, loserUserId, loserUsername);
      loser.losses += 1;
      loser.currentStreak = 0;
      writeProfile(nk, loser);
      nk.leaderboardRecordWrite(LEADERBOARD_LOSSES, loserUserId, loserUsername || "", 1, 0, {});
      logger.info("Wrote win/loss: %s > %s", winnerUserId, loserUserId);
    } else {
      const userIds = Object.keys(state.marks);
      for (let i = 0; i < userIds.length; i++) {
        const uid = userIds[i];
        const profile = readProfile(nk, uid, "");
        profile.draws += 1;
        writeProfile(nk, profile);
        nk.leaderboardRecordWrite(LEADERBOARD_DRAWS, uid, profile.username || "", 1, 0, {});
      }
      logger.info("Wrote draw for %d players", userIds.length);
    }
  } catch (e) {
    logger.error("writeMatchResult failed: %s", e);
  }
}

export function getLeaderboardRows(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger
): LeaderboardRow[] {
  try {
    ensureLeaderboards(nk);
    const winsResult = nk.leaderboardRecordsList(LEADERBOARD_WINS, [], 20, null as any, null as any);
    const records = winsResult.records || [];
    if (!records.length) return [];

    const userIds = records.map((r: any) => r.ownerId);
    const reads = userIds.map((uid: string) => ({
      collection: "users",
      key: "profile",
      userId: uid,
    }));

    const profileMap: { [uid: string]: any } = {};
    try {
      const profileResults = nk.storageRead(reads as any);
      for (let i = 0; i < (profileResults || []).length; i++) {
        const r = (profileResults || [])[i] as any;
        const raw = r.value as any;
        profileMap[r.userId] = typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } catch {}

    return records.map((r: any, i: number) => {
      const p = profileMap[r.ownerId];
      const wins = p && typeof p.wins === "number" ? p.wins : r.score;
      const losses = p && typeof p.losses === "number" ? p.losses : 0;
      const draws = p && typeof p.draws === "number" ? p.draws : 0;
      const total = wins + losses + draws;
      return {
        userId: r.ownerId,
        username: (p && p.username) || r.username || "Player",
        wins,
        losses,
        draws,
        bestStreak: (p && p.bestStreak) || 0,
        winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
        rank: i + 1,
      };
    });
  } catch (e) {
    logger.error("getLeaderboardRows failed: %s", e);
    return [];
  }
}
