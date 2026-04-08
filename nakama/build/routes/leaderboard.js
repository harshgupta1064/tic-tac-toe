"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rpcGetLeaderboard = void 0;
var leaderboard_1 = require("../utils/leaderboard");
var rpcGetLeaderboard = function (ctx, logger, nk, payload) {
    try {
        var data = (0, leaderboard_1.buildLeaderboardFromUserTable)(nk, ctx.userId || '');
        logger.info('get_leaderboard: returning %d records, myRecord=%s', data.records.length, data.myRecord ? data.myRecord.rank : 'in top10');
        return JSON.stringify(data);
    }
    catch (e) {
        logger.error('rpcGetLeaderboard error: %s', JSON.stringify(e));
        return JSON.stringify({ records: [], myRecord: null });
    }
};
exports.rpcGetLeaderboard = rpcGetLeaderboard;
