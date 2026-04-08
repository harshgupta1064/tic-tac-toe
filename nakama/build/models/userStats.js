"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_STATS_OWNER_ID = exports.USER_STATS_COLLECTION = void 0;
exports.readUserStats = readUserStats;
exports.writeUserStats = writeUserStats;
exports.listAllUserStats = listAllUserStats;
exports.USER_STATS_COLLECTION = 'user_stats';
exports.USER_STATS_OWNER_ID = '00000000-0000-0000-0000-000000000000';
function normalize(raw, userId, username) {
    return {
        userId: userId,
        username: ((raw === null || raw === void 0 ? void 0 : raw.username) || username || 'Player').toString(),
        wins: Number((raw === null || raw === void 0 ? void 0 : raw.wins) || 0),
        losses: Number((raw === null || raw === void 0 ? void 0 : raw.losses) || 0),
        draws: Number((raw === null || raw === void 0 ? void 0 : raw.draws) || 0),
        currentStreak: Number((raw === null || raw === void 0 ? void 0 : raw.currentStreak) || 0),
        bestStreak: Number((raw === null || raw === void 0 ? void 0 : raw.bestStreak) || 0),
        updatedAt: Number((raw === null || raw === void 0 ? void 0 : raw.updatedAt) || Date.now()),
    };
}
function readUserStats(nk, userId, username) {
    try {
        var rows = nk.storageRead([{
                collection: exports.USER_STATS_COLLECTION,
                key: userId,
                userId: exports.USER_STATS_OWNER_ID,
            }]);
        if (rows && rows.length > 0) {
            var raw = rows[0].value;
            var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return normalize(parsed, userId, username);
        }
    }
    catch (_) { }
    return normalize({}, userId, username);
}
function writeUserStats(nk, stats) {
    nk.storageWrite([{
            collection: exports.USER_STATS_COLLECTION,
            key: stats.userId,
            userId: exports.USER_STATS_OWNER_ID,
            value: stats,
            permissionRead: 2,
            permissionWrite: 0,
        }]);
}
function listAllUserStats(nk) {
    var out = [];
    var cursor = '';
    do {
        var page = nk.storageList(exports.USER_STATS_OWNER_ID, exports.USER_STATS_COLLECTION, 100, cursor);
        for (var _i = 0, _a = (page.objects || []); _i < _a.length; _i++) {
            var obj = _a[_i];
            try {
                var raw = obj.value;
                var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                out.push(normalize(parsed, obj.key, (parsed === null || parsed === void 0 ? void 0 : parsed.username) || 'Player'));
            }
            catch (_) { }
        }
        cursor = page.cursor || '';
    } while (cursor);
    return out;
}
