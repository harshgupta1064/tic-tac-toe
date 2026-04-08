"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rpcGetLeaderboard = void 0;
var leaderboard_1 = require("../utils/leaderboard");
var rpcGetLeaderboard = function (ctx, logger, nk, _payload) {
    var rows = (0, leaderboard_1.getLeaderboardRows)(nk, logger);
    return JSON.stringify({ records: rows });
};
exports.rpcGetLeaderboard = rpcGetLeaderboard;
