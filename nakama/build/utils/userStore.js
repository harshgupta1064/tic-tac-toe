"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readProfile = readProfile;
exports.writeProfile = writeProfile;
exports.readProfiles = readProfiles;
var types_1 = require("../models/types");
function defaultProfile(userId, username) {
    return {
        userId: userId,
        username: username,
        wins: 0,
        losses: 0,
        draws: 0,
        currentStreak: 0,
        bestStreak: 0,
        rank: 0,
        totalGames: 0,
        updatedAt: Date.now(),
    };
}
function readProfile(nk, userId, username) {
    try {
        var reads = nk.storageRead([{
                collection: types_1.COLLECTION_USERS,
                key: types_1.USER_PROFILE_KEY,
                userId: userId,
            }]);
        if (reads && reads.length > 0) {
            var raw = reads[0].value;
            var stored = (typeof raw === "string" ? JSON.parse(raw) : raw);
            stored.username = username || stored.username;
            return stored;
        }
    }
    catch (_a) { }
    return defaultProfile(userId, username);
}
function writeProfile(nk, profile) {
    profile.updatedAt = Date.now();
    profile.totalGames = profile.wins + profile.losses + profile.draws;
    nk.storageWrite([{
            collection: types_1.COLLECTION_USERS,
            key: types_1.USER_PROFILE_KEY,
            userId: profile.userId,
            value: profile,
            permissionRead: 2,
            permissionWrite: 1,
        }]);
}
function readProfiles(nk, userIds) {
    if (!userIds.length)
        return [];
    try {
        var reads = userIds.map(function (uid) { return ({
            collection: types_1.COLLECTION_USERS,
            key: types_1.USER_PROFILE_KEY,
            userId: uid,
        }); });
        var results = nk.storageRead(reads);
        return (results || []).map(function (r) {
            var raw = r.value;
            return (typeof raw === "string" ? JSON.parse(raw) : raw);
        });
    }
    catch (_a) { }
    return [];
}
