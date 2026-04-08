"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WIN_LINES = exports.PLAYER_PROFILE_COLLECTION = exports.SYSTEM_USER_ID = exports.MODULE_NAME = exports.USER_PROFILE_KEY = exports.COLLECTION_STATS = exports.COLLECTION_ROOMS = exports.COLLECTION_USERS = exports.LEADERBOARD_DRAWS = exports.LEADERBOARD_STREAK = exports.LEADERBOARD_LOSSES = exports.LEADERBOARD_WINS = exports.OpCode = void 0;
// ─── Op Codes ────────────────────────────────────────────────────────────────
exports.OpCode = {
    MOVE: 1,
    STATE: 2,
    REJECTED: 3,
    GAME_OVER: 4,
    READY: 5,
    TICK: 6,
    REMATCH_REQUEST: 7,
    REMATCH_ACCEPT: 8,
    REMATCH_DECLINE: 9,
    REMATCH_START: 10,
    OPPONENT_LEFT_LOBBY: 11,
};
// ─── Leaderboard IDs ─────────────────────────────────────────────────────────
exports.LEADERBOARD_WINS = "tictactoe_wins";
exports.LEADERBOARD_LOSSES = "tictactoe_losses";
exports.LEADERBOARD_STREAK = "tictactoe_best_streak";
exports.LEADERBOARD_DRAWS = "tictactoe_draws";
// ─── Storage collections ──────────────────────────────────────────────────────
exports.COLLECTION_USERS = "users";
exports.COLLECTION_ROOMS = "rooms";
exports.COLLECTION_STATS = "player_stats";
exports.USER_PROFILE_KEY = "profile";
exports.MODULE_NAME = "tictactoe";
exports.SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
exports.PLAYER_PROFILE_COLLECTION = "player_profile";
// ─── Win lines ────────────────────────────────────────────────────────────────
exports.WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];
