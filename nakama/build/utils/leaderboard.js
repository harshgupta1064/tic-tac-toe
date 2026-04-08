"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureLeaderboards = ensureLeaderboards;
exports.writeMatchResult = writeMatchResult;
exports.getLeaderboardRows = getLeaderboardRows;
var types_1 = require("../models/types");
var userStore_1 = require("./userStore");
function ensureLeaderboards(nk) {
    try {
        nk.leaderboardCreate(types_1.LEADERBOARD_WINS, false, "desc", "incr", "", {});
    }
    catch (_a) { }
    try {
        nk.leaderboardCreate(types_1.LEADERBOARD_LOSSES, false, "desc", "incr", "", {});
    }
    catch (_b) { }
    try {
        nk.leaderboardCreate(types_1.LEADERBOARD_DRAWS, false, "desc", "incr", "", {});
    }
    catch (_c) { }
    try {
        nk.leaderboardCreate(types_1.LEADERBOARD_STREAK, false, "desc", "best", "", {});
    }
    catch (_d) { }
}
function writeMatchResult(nk, logger, state, winnerUserId, loserUserId, winnerUsername, loserUsername) {
    try {
        ensureLeaderboards(nk);
        if (winnerUserId && loserUserId) {
            var winner = (0, userStore_1.readProfile)(nk, winnerUserId, winnerUsername);
            winner.wins += 1;
            winner.currentStreak += 1;
            if (winner.currentStreak > winner.bestStreak)
                winner.bestStreak = winner.currentStreak;
            (0, userStore_1.writeProfile)(nk, winner);
            nk.leaderboardRecordWrite(types_1.LEADERBOARD_WINS, winnerUserId, winnerUsername || "", 1, 0, {});
            nk.leaderboardRecordWrite(types_1.LEADERBOARD_STREAK, winnerUserId, winnerUsername || "", winner.bestStreak, 0, {});
            var loser = (0, userStore_1.readProfile)(nk, loserUserId, loserUsername);
            loser.losses += 1;
            loser.currentStreak = 0;
            (0, userStore_1.writeProfile)(nk, loser);
            nk.leaderboardRecordWrite(types_1.LEADERBOARD_LOSSES, loserUserId, loserUsername || "", 1, 0, {});
            logger.info("Wrote win/loss: %s > %s", winnerUserId, loserUserId);
        }
        else {
            var userIds = Object.keys(state.marks);
            for (var i = 0; i < userIds.length; i++) {
                var uid = userIds[i];
                var profile = (0, userStore_1.readProfile)(nk, uid, "");
                profile.draws += 1;
                (0, userStore_1.writeProfile)(nk, profile);
                nk.leaderboardRecordWrite(types_1.LEADERBOARD_DRAWS, uid, profile.username || "", 1, 0, {});
            }
            logger.info("Wrote draw for %d players", userIds.length);
        }
    }
    catch (e) {
        logger.error("writeMatchResult failed: %s", e);
    }
}
function getLeaderboardRows(nk, logger) {
    try {
        ensureLeaderboards(nk);
        var winsResult = nk.leaderboardRecordsList(types_1.LEADERBOARD_WINS, [], 20, null, null);
        var records = winsResult.records || [];
        if (!records.length)
            return [];
        var userIds = records.map(function (r) { return r.ownerId; });
        var reads = userIds.map(function (uid) { return ({
            collection: "users",
            key: "profile",
            userId: uid,
        }); });
        var profileMap_1 = {};
        try {
            var profileResults = nk.storageRead(reads);
            for (var i = 0; i < (profileResults || []).length; i++) {
                var r = (profileResults || [])[i];
                var raw = r.value;
                profileMap_1[r.userId] = typeof raw === "string" ? JSON.parse(raw) : raw;
            }
        }
        catch (_a) { }
        return records.map(function (r, i) {
            var p = profileMap_1[r.ownerId];
            var wins = p && typeof p.wins === "number" ? p.wins : r.score;
            var losses = p && typeof p.losses === "number" ? p.losses : 0;
            var draws = p && typeof p.draws === "number" ? p.draws : 0;
            var total = wins + losses + draws;
            return {
                userId: r.ownerId,
                username: (p && p.username) || r.username || "Player",
                wins: wins,
                losses: losses,
                draws: draws,
                bestStreak: (p && p.bestStreak) || 0,
                winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
                rank: i + 1,
            };
        });
    }
    catch (e) {
        logger.error("getLeaderboardRows failed: %s", e);
        return [];
    }
}
