"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchSignal = exports.matchTerminate = exports.matchLoop = exports.matchLeave = exports.matchJoin = exports.matchJoinAttempt = exports.matchInit = exports.matchmakerMatched = void 0;
var types_1 = require("../models/types");
var leaderboard_1 = require("../utils/leaderboard");
function checkWinner(board) {
    for (var i = 0; i < types_1.WIN_LINES.length; i++) {
        var line = types_1.WIN_LINES[i];
        var a = line[0], b = line[1], c = line[2];
        if (board[a] && board[a] === board[b] && board[a] === board[c])
            return board[a];
    }
    if (board.every(function (cell) { return cell !== ""; }))
        return "draw";
    return null;
}
var matchInit = function (ctx, logger, nk, params) {
    var mode = (params["mode"] === "timed") ? "timed" : "classic";
    var tickRate = 1;
    var state = {
        board: ["", "", "", "", "", "", "", "", ""],
        marks: {},
        playerNames: {},
        currentTurn: "",
        winner: null,
        gameOver: false,
        presences: {},
        mode: mode,
        turnStartTick: 0,
        tickRate: tickRate,
        turnLimitTicks: 30,
        roomId: typeof params["roomId"] === "string" ? params["roomId"] : "",
        emptySinceTick: -1,
        rematchRequestedBy: "",
        rematchRequestTick: 0,
        isRematch: false,
        guestUserIds: [],
    };
    logger.info("Match initialized, mode: %s", mode);
    return { state: state, tickRate: tickRate, label: JSON.stringify({ mode: mode }) };
};
exports.matchInit = matchInit;
var matchJoinAttempt = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    if (state.gameOver)
        return { state: state, accept: false };
    if (Object.keys(state.presences).length >= 2)
        return { state: state, accept: false };
    return { state: state, accept: true };
};
exports.matchJoinAttempt = matchJoinAttempt;
var matchJoin = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    for (var i = 0; i < presences.length; i++) {
        var presence = presences[i];
        state.presences[presence.userId] = presence;
        state.playerNames[presence.userId] = presence.username || "Player";
        try {
            var users = nk.usersGetId([presence.userId]);
            if (users && users.length > 0) {
                var metadataValue = users[0].metadata;
                var meta = typeof metadataValue === "string" ? JSON.parse(metadataValue || "{}") : (metadataValue || {});
                if (meta.guest === true)
                    state.guestUserIds.push(presence.userId);
            }
        }
        catch (_a) { }
        logger.info("Player joined: %s", presence.userId);
    }
    if (Object.keys(state.presences).length === 2) {
        var userIds = Object.keys(state.presences);
        state.marks[userIds[0]] = "X";
        state.marks[userIds[1]] = "O";
        state.currentTurn = userIds[0];
        state.turnStartTick = tick;
        var readyMsg = JSON.stringify({
            board: state.board,
            marks: state.marks,
            playerNames: state.playerNames,
            currentTurn: state.currentTurn,
            mode: state.mode,
        });
        dispatcher.broadcastMessage(types_1.OpCode.READY, readyMsg);
        dispatcher.broadcastMessage(types_1.OpCode.STATE, readyMsg);
    }
    return { state: state };
};
exports.matchJoin = matchJoin;
var matchLeave = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    var _a;
    for (var i = 0; i < presences.length; i++) {
        var presence = presences[i];
        delete state.presences[presence.userId];
        delete state.playerNames[presence.userId];
        logger.info("Player left: %s", presence.userId);
        var gameWasInProgress = !state.gameOver && Object.keys(state.marks).length === 2 && (presence.userId in state.marks);
        if (Object.keys(state.presences).length > 0) {
            var remainingUserId = Object.keys(state.presences)[0];
            var remainingPresence = state.presences[remainingUserId];
            if (gameWasInProgress) {
                state.gameOver = true;
                state.winner = remainingUserId;
                dispatcher.broadcastMessage(types_1.OpCode.GAME_OVER, JSON.stringify({
                    board: state.board,
                    winner: remainingUserId,
                    winnerMark: state.marks[remainingUserId],
                    reason: "forfeit",
                }), remainingPresence ? [remainingPresence] : undefined);
                (0, leaderboard_1.writeMatchResult)(nk, logger, state, remainingUserId, presence.userId, ((_a = state.presences[remainingUserId]) === null || _a === void 0 ? void 0 : _a.username) || "", presence.username || "");
            }
            if (remainingPresence) {
                dispatcher.broadcastMessage(types_1.OpCode.OPPONENT_LEFT_LOBBY, JSON.stringify({ reason: gameWasInProgress ? "forfeit" : "opponent_left" }), [remainingPresence]);
            }
        }
    }
    return { state: state };
};
exports.matchLeave = matchLeave;
var matchLoop = function (ctx, logger, nk, dispatcher, tick, state, messages) {
    var _a, _b, _c, _d;
    var presenceCount = Object.keys(state.presences).length;
    if (presenceCount === 0) {
        if (state.emptySinceTick < 0)
            state.emptySinceTick = tick;
        if (tick - state.emptySinceTick >= 60) {
            if (state.roomId) {
                try {
                    nk.storageDelete([{ collection: types_1.COLLECTION_ROOMS, key: state.roomId, userId: types_1.SYSTEM_USER_ID }]);
                }
                catch (_e) { }
            }
            return null;
        }
        return { state: state };
    }
    state.emptySinceTick = -1;
    if (presenceCount < 2)
        return { state: state };
    var _loop_1 = function (i) {
        var message = messages[i];
        var senderId = message.sender.userId;
        if (message.opCode === types_1.OpCode.MOVE) {
            if (state.gameOver)
                return "continue";
            if (senderId !== state.currentTurn) {
                dispatcher.broadcastMessage(types_1.OpCode.REJECTED, JSON.stringify({ reason: "Not your turn" }), [message.sender]);
                return "continue";
            }
            var move = void 0;
            try {
                move = JSON.parse(nk.binaryToString(message.data));
            }
            catch (_f) {
                dispatcher.broadcastMessage(types_1.OpCode.REJECTED, JSON.stringify({ reason: "Invalid message format" }), [message.sender]);
                return "continue";
            }
            var pos = move.position;
            if (pos < 0 || pos > 8 || state.board[pos] !== "") {
                dispatcher.broadcastMessage(types_1.OpCode.REJECTED, JSON.stringify({ reason: "Invalid move position" }), [message.sender]);
                return "continue";
            }
            state.board[pos] = state.marks[senderId];
            var result_1 = checkWinner(state.board);
            if (result_1) {
                state.gameOver = true;
                state.rematchRequestedBy = "";
                state.rematchRequestTick = 0;
                if (result_1 === "draw") {
                    state.winner = "draw";
                    dispatcher.broadcastMessage(types_1.OpCode.GAME_OVER, JSON.stringify({ board: state.board, winner: "draw", reason: "draw" }));
                    (0, leaderboard_1.writeMatchResult)(nk, logger, state, null, null, "", "");
                }
                else {
                    var winnerUserId = Object.keys(state.marks).find(function (uid) { return state.marks[uid] === result_1; });
                    var loserUserId = Object.keys(state.marks).find(function (uid) { return state.marks[uid] !== result_1; });
                    state.winner = winnerUserId;
                    dispatcher.broadcastMessage(types_1.OpCode.GAME_OVER, JSON.stringify({
                        board: state.board,
                        winner: winnerUserId,
                        winnerMark: result_1,
                        reason: "win",
                    }));
                    var winnerUsername = ((_a = state.presences[winnerUserId]) === null || _a === void 0 ? void 0 : _a.username) || "";
                    var loserUsername = ((_b = state.presences[loserUserId]) === null || _b === void 0 ? void 0 : _b.username) || "";
                    (0, leaderboard_1.writeMatchResult)(nk, logger, state, winnerUserId, loserUserId, winnerUsername, loserUsername);
                }
            }
            else {
                var userIds = Object.keys(state.marks);
                state.currentTurn = userIds.find(function (uid) { return uid !== senderId; });
                state.turnStartTick = tick;
                dispatcher.broadcastMessage(types_1.OpCode.STATE, JSON.stringify({
                    board: state.board,
                    playerNames: state.playerNames,
                    currentTurn: state.currentTurn,
                    lastMove: { position: pos, mark: state.marks[senderId] },
                }));
            }
        }
        if (message.opCode === types_1.OpCode.REMATCH_REQUEST) {
            if (!state.gameOver || state.rematchRequestedBy)
                return "continue";
            state.rematchRequestedBy = senderId;
            state.rematchRequestTick = tick;
            var otherUserId = Object.keys(state.presences).find(function (uid) { return uid !== senderId; });
            var otherPresence = otherUserId ? state.presences[otherUserId] : undefined;
            if (otherPresence)
                dispatcher.broadcastMessage(types_1.OpCode.REMATCH_REQUEST, JSON.stringify({ requestedBy: senderId }), [otherPresence]);
        }
        if (message.opCode === types_1.OpCode.REMATCH_ACCEPT) {
            if (!state.rematchRequestedBy || senderId === state.rematchRequestedBy || !state.gameOver)
                return "continue";
            state.board = ["", "", "", "", "", "", "", "", ""];
            state.winner = null;
            state.gameOver = false;
            state.isRematch = true;
            state.rematchRequestedBy = "";
            state.rematchRequestTick = 0;
            var userIds = Object.keys(state.marks);
            var prevX = userIds.find(function (uid) { return state.marks[uid] === "X"; });
            var prevO = userIds.find(function (uid) { return state.marks[uid] === "O"; });
            state.marks[prevX] = "O";
            state.marks[prevO] = "X";
            state.currentTurn = prevO;
            state.turnStartTick = tick;
            dispatcher.broadcastMessage(types_1.OpCode.REMATCH_START, JSON.stringify({
                board: state.board,
                marks: state.marks,
                playerNames: state.playerNames,
                currentTurn: state.currentTurn,
                mode: state.mode,
            }));
        }
        if (message.opCode === types_1.OpCode.REMATCH_DECLINE) {
            if (!state.rematchRequestedBy || !state.gameOver)
                return "continue";
            var requesterPresence = state.presences[state.rematchRequestedBy];
            if (requesterPresence) {
                dispatcher.broadcastMessage(types_1.OpCode.REMATCH_DECLINE, JSON.stringify({ reason: "declined" }), [requesterPresence]);
            }
            state.rematchRequestedBy = "";
            state.rematchRequestTick = 0;
        }
    };
    for (var i = 0; i < messages.length; i++) {
        _loop_1(i);
    }
    if (state.gameOver && state.rematchRequestedBy && (tick - state.rematchRequestTick) >= 30) {
        dispatcher.broadcastMessage(types_1.OpCode.REMATCH_DECLINE, JSON.stringify({ reason: "timeout" }));
        state.rematchRequestedBy = "";
        state.rematchRequestTick = 0;
    }
    if (state.mode === "timed" && !state.gameOver) {
        var elapsed = tick - state.turnStartTick;
        var remaining = state.turnLimitTicks - elapsed;
        if (remaining >= 0) {
            var currentPresence = state.presences[state.currentTurn];
            if (currentPresence) {
                dispatcher.broadcastMessage(types_1.OpCode.TICK, JSON.stringify({ remaining: remaining }), [currentPresence]);
            }
        }
        if (elapsed >= state.turnLimitTicks) {
            state.gameOver = true;
            var loserUserId_1 = state.currentTurn;
            var winnerUserId = Object.keys(state.marks).find(function (uid) { return uid !== loserUserId_1; });
            state.winner = winnerUserId;
            dispatcher.broadcastMessage(types_1.OpCode.GAME_OVER, JSON.stringify({
                board: state.board,
                winner: winnerUserId,
                winnerMark: state.marks[winnerUserId],
                reason: "timeout",
                timedOutPlayer: loserUserId_1,
            }));
            var winnerUsername = ((_c = state.presences[winnerUserId]) === null || _c === void 0 ? void 0 : _c.username) || "";
            var loserUsername = ((_d = state.presences[loserUserId_1]) === null || _d === void 0 ? void 0 : _d.username) || "";
            (0, leaderboard_1.writeMatchResult)(nk, logger, state, winnerUserId, loserUserId_1, winnerUsername, loserUsername);
        }
    }
    return { state: state };
};
exports.matchLoop = matchLoop;
var matchTerminate = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    logger.info("Match terminated");
    return { state: state };
};
exports.matchTerminate = matchTerminate;
var matchSignal = function (ctx, logger, nk, dispatcher, tick, state, data) {
    return { state: state, data: "" };
};
exports.matchSignal = matchSignal;
var matchmakerMatched = function (ctx, logger, nk, matches) {
    var _a;
    var mode = ((_a = matches[0]) === null || _a === void 0 ? void 0 : _a.properties["mode"]) || "classic";
    try {
        var matchId = nk.matchCreate(types_1.MODULE_NAME, { mode: mode });
        logger.info("Matchmaker created match %s (mode: %s)", matchId, mode);
        return matchId;
    }
    catch (e) {
        logger.error("matchmakerMatched error: %s", e);
        return undefined;
    }
};
exports.matchmakerMatched = matchmakerMatched;
