"use strict";
// Nakama TypeScript Runtime Module
// IMPORTANT: This runs in Nakama's sandboxed JS engine, NOT Node.js.
// No npm imports, no fetch, no async/await for RPC functions.
/// <reference types="nakama-common" />
var moduleName = 'tictactoe';
// ─── Op Codes ─────────────────────────────────────────────────────────────────
var OpCode = {
    MOVE: 1, // client → server: player makes a move
    STATE: 2, // server → client: full game state update
    REJECTED: 3, // server → client: move was invalid
    GAME_OVER: 4, // server → client: game ended (win/draw/forfeit)
    READY: 5, // server → client: both players joined, game starting
    TICK: 6, // server → client: timer tick (remaining seconds)
};
// ─── Win Detection ────────────────────────────────────────────────────────────
var WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6], // diagonals
];
function checkWinner(board) {
    for (var _i = 0, WIN_LINES_1 = WIN_LINES; _i < WIN_LINES_1.length; _i++) {
        var _a = WIN_LINES_1[_i], a = _a[0], b = _a[1], c = _a[2];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // returns 'X' or 'O'
        }
    }
    if (board.every(function (cell) { return cell !== ''; }))
        return 'draw';
    return null;
}
// ─── Match Handler ────────────────────────────────────────────────────────────
var matchInit = function (ctx, logger, nk, params) {
    var mode = (params['mode'] === 'timed') ? 'timed' : 'classic';
    var tickRate = 1; // 1 tick per second (sufficient for turn timer)
    var state = {
        board: ['', '', '', '', '', '', '', '', ''],
        marks: {},
        currentTurn: '',
        winner: null,
        gameOver: false,
        presences: {},
        mode: mode,
        turnStartTick: 0,
        tickRate: tickRate,
        turnLimitTicks: 30, // 30 seconds
    };
    logger.info('Match initialized, mode: %s', mode);
    return { state: state, tickRate: tickRate, label: JSON.stringify({ mode: mode }) };
};
var matchJoinAttempt = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    if (state.gameOver)
        return { state: state, accept: false };
    if (Object.keys(state.presences).length >= 2)
        return { state: state, accept: false };
    return { state: state, accept: true };
};
var matchJoin = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    for (var _i = 0, presences_1 = presences; _i < presences_1.length; _i++) {
        var presence = presences_1[_i];
        state.presences[presence.userId] = presence;
        logger.info('Player joined: %s', presence.userId);
    }
    // Assign marks when both players are present
    if (Object.keys(state.presences).length === 2) {
        var userIds = Object.keys(state.presences);
        state.marks[userIds[0]] = 'X';
        state.marks[userIds[1]] = 'O';
        state.currentTurn = userIds[0]; // X always goes first
        state.turnStartTick = tick;
        var readyMsg = JSON.stringify({
            board: state.board,
            marks: state.marks,
            currentTurn: state.currentTurn,
            mode: state.mode,
        });
        dispatcher.broadcastMessage(OpCode.READY, readyMsg);
        dispatcher.broadcastMessage(OpCode.STATE, readyMsg);
        logger.info('Game started. X=%s, O=%s', userIds[0], userIds[1]);
    }
    return { state: state };
};
var matchLeave = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    for (var _i = 0, presences_2 = presences; _i < presences_2.length; _i++) {
        var presence = presences_2[_i];
        delete state.presences[presence.userId];
        logger.info('Player left: %s', presence.userId);
        // If game is still ongoing, the remaining player wins by forfeit
        if (!state.gameOver && Object.keys(state.presences).length > 0) {
            state.gameOver = true;
            var remainingUserId = Object.keys(state.presences)[0];
            state.winner = remainingUserId;
            var gameOverMsg = JSON.stringify({
                board: state.board,
                winner: remainingUserId,
                winnerMark: state.marks[remainingUserId],
                reason: 'forfeit',
            });
            dispatcher.broadcastMessage(OpCode.GAME_OVER, gameOverMsg);
            // Write leaderboard
            writeLeaderboard(nk, logger, state, remainingUserId, presence.userId);
        }
    }
    return { state: state };
};
var matchLoop = function (ctx, logger, nk, dispatcher, tick, state, messages) {
    // If less than 2 players, wait
    if (Object.keys(state.presences).length < 2)
        return { state: state };
    if (state.gameOver)
        return null; // terminate match
    var _loop_1 = function (message) {
        if (message.opCode !== OpCode.MOVE)
            return "continue";
        var senderId = message.sender.userId;
        // Validate: is it this player's turn?
        if (senderId !== state.currentTurn) {
            dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: 'Not your turn' }), [message.sender]);
            return "continue";
        }
        var move = void 0;
        try {
            move = JSON.parse(nk.binaryToString(message.data));
        }
        catch (e) {
            dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: 'Invalid message format' }), [message.sender]);
            return "continue";
        }
        var pos = move.position;
        // Validate: position in range and cell empty
        if (pos < 0 || pos > 8 || state.board[pos] !== '') {
            dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: 'Invalid move position' }), [message.sender]);
            return "continue";
        }
        // Apply move
        state.board[pos] = state.marks[senderId];
        // Check win/draw
        var result = checkWinner(state.board);
        if (result) {
            state.gameOver = true;
            if (result === 'draw') {
                state.winner = 'draw';
                dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
                    board: state.board,
                    winner: 'draw',
                    reason: 'draw',
                }));
                writeLeaderboardDraw(nk, logger, state);
            }
            else {
                // result is 'X' or 'O' — find whose userId it is
                var winnerUserId = Object.keys(state.marks).find(function (uid) { return state.marks[uid] === result; });
                var loserUserId = Object.keys(state.marks).find(function (uid) { return state.marks[uid] !== result; });
                state.winner = winnerUserId;
                dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
                    board: state.board,
                    winner: winnerUserId,
                    winnerMark: result,
                    reason: 'win',
                }));
                writeLeaderboard(nk, logger, state, winnerUserId, loserUserId);
            }
        }
        else {
            // Switch turns
            var userIds = Object.keys(state.marks);
            state.currentTurn = userIds.find(function (uid) { return uid !== senderId; });
            state.turnStartTick = tick;
            dispatcher.broadcastMessage(OpCode.STATE, JSON.stringify({
                board: state.board,
                currentTurn: state.currentTurn,
                lastMove: { position: pos, mark: state.marks[senderId] },
            }));
        }
    };
    // ── Process incoming move messages ──────────────────────────────────────────
    for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
        var message = messages_1[_i];
        _loop_1(message);
    }
    // ── Timer check (timed mode only) ───────────────────────────────────────────
    if (state.mode === 'timed' && !state.gameOver) {
        var elapsed = tick - state.turnStartTick;
        var remaining = state.turnLimitTicks - elapsed;
        if (remaining >= 0) {
            // Broadcast tick every second to current player
            var currentPresence = state.presences[state.currentTurn];
            if (currentPresence) {
                dispatcher.broadcastMessage(OpCode.TICK, JSON.stringify({ remaining: remaining }), [currentPresence]);
            }
        }
        if (elapsed >= state.turnLimitTicks) {
            // Time's up — forfeit current player
            state.gameOver = true;
            var loserUserId_1 = state.currentTurn;
            var winnerUserId = Object.keys(state.marks).find(function (uid) { return uid !== loserUserId_1; });
            state.winner = winnerUserId;
            dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
                board: state.board,
                winner: winnerUserId,
                winnerMark: state.marks[winnerUserId],
                reason: 'timeout',
                timedOutPlayer: loserUserId_1,
            }));
            writeLeaderboard(nk, logger, state, winnerUserId, loserUserId_1);
        }
    }
    return { state: state };
};
var matchTerminate = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    logger.info('Match terminated');
    return { state: state };
};
var matchSignal = function (ctx, logger, nk, dispatcher, tick, state, data) {
    return { state: state, data: '' };
};
// ─── Leaderboard Helpers ──────────────────────────────────────────────────────
var LEADERBOARD_ID = 'tictactoe_wins';
var LEADERBOARD_WIN_STREAK = 'tictactoe_streak';
var ROOMS_COLLECTION = 'rooms';
var ROOMS_USER_ID = '00000000-0000-0000-0000-000000000000';
function ensureLeaderboard(nk, logger) {
    try {
        nk.leaderboardCreate(LEADERBOARD_ID, false, 'desc', 'incr', '', false);
    }
    catch (e) {
        // Already exists — safe to ignore
    }
}
function writeLeaderboard(nk, logger, state, winnerUserId, loserUserId) {
    try {
        // Create leaderboards if they don't exist (idempotent)
        try {
            nk.leaderboardCreate(LEADERBOARD_ID, false, 'desc', 'incr', '', false);
        }
        catch (_a) { }
        try {
            nk.leaderboardCreate('tictactoe_losses', false, 'desc', 'incr', '', false);
        }
        catch (_b) { }
        try {
            nk.leaderboardCreate(LEADERBOARD_WIN_STREAK, false, 'desc', 'best', '', false);
        }
        catch (_c) { }
        // Record win +1 for winner
        nk.leaderboardRecordWrite(LEADERBOARD_ID, winnerUserId, '', 1, 0, {});
        // Record loss +1 for loser
        nk.leaderboardRecordWrite('tictactoe_losses', loserUserId, '', 1, 0, {});
        // Win streak: fetch current streak for winner, increment and write best
        // We store streak as metadata in storage, not a separate leaderboard
        var storageKey = 'streak_' + winnerUserId;
        var streak = 1;
        try {
            var existing = nk.storageRead([{
                    collection: 'player_stats',
                    key: storageKey,
                    userId: winnerUserId,
                }]);
            if (existing && existing.length > 0) {
                var data = existing[0].value;
                streak = (data.streak || 0) + 1;
            }
        }
        catch (_d) { }
        nk.storageWrite([{
                collection: 'player_stats',
                key: storageKey,
                userId: winnerUserId,
                value: { streak: streak },
                permissionRead: 2,
                permissionWrite: 1,
            }]);
        // Reset loser streak
        try {
            var loserKey = 'streak_' + loserUserId;
            nk.storageWrite([{
                    collection: 'player_stats',
                    key: loserKey,
                    userId: loserUserId,
                    value: { streak: 0 },
                    permissionRead: 2,
                    permissionWrite: 1,
                }]);
        }
        catch (_e) { }
        // Write best streak to leaderboard
        nk.leaderboardRecordWrite(LEADERBOARD_WIN_STREAK, winnerUserId, '', streak, 0, {});
    }
    catch (e) {
        logger.error('Failed to write leaderboard: %s', e);
    }
}
function writeLeaderboardDraw(nk, logger, state) {
    // No leaderboard change on draw
}
// ─── RPC: Get Leaderboard ─────────────────────────────────────────────────────
var rpcGetLeaderboard = function (ctx, logger, nk, payload) {
    try {
        var wins = nk.leaderboardRecordsList(LEADERBOARD_ID, [], 10, '', '');
        var losses = nk.leaderboardRecordsList('tictactoe_losses', [], 10, '', '');
        var streaks = nk.leaderboardRecordsList(LEADERBOARD_WIN_STREAK, [], 10, '', '');
        // Build lookup maps
        var lossMap_1 = {};
        for (var _i = 0, _a = (losses.records || []); _i < _a.length; _i++) {
            var r = _a[_i];
            lossMap_1[r.ownerId] = r.score;
        }
        var streakMap_1 = {};
        for (var _b = 0, _c = (streaks.records || []); _b < _c.length; _b++) {
            var r = _c[_b];
            streakMap_1[r.ownerId] = r.score;
        }
        return JSON.stringify({
            records: (wins.records || []).map(function (r) { return ({
                userId: r.ownerId,
                username: r.username,
                wins: r.score,
                losses: lossMap_1[r.ownerId] || 0,
                bestStreak: streakMap_1[r.ownerId] || 0,
                rank: r.rank,
            }); })
        });
    }
    catch (e) {
        logger.error('rpcGetLeaderboard error: %s', e);
        return JSON.stringify({ records: [] });
    }
};
// RPC: create_room
// Payload: { "name": "MyRoom", "mode": "classic" | "timed" }
// Returns: { "roomId": "...", "matchId": "..." }
var rpcCreateRoom = function (ctx, logger, nk, payload) {
    var params = {};
    try {
        params = JSON.parse(payload || '{}');
    }
    catch (_a) { }
    var name = (params.name || '').trim().substring(0, 32) || 'Room';
    var mode = params.mode === 'timed' ? 'timed' : 'classic';
    var roomId = nk.uuidv4();
    var matchId;
    try {
        matchId = nk.matchCreate(moduleName, { mode: mode });
    }
    catch (e) {
        logger.error('rpcCreateRoom: matchCreate failed: %s', e);
        return JSON.stringify({ error: 'Failed to create match' });
    }
    var record = {
        id: roomId,
        name: name,
        mode: mode,
        hostUserId: ctx.userId || '',
        hostUsername: ctx.username || '',
        matchId: matchId,
        status: 'waiting',
        createdAt: Date.now(),
    };
    try {
        nk.storageWrite([{
                collection: ROOMS_COLLECTION,
                key: roomId,
                userId: ROOMS_USER_ID,
                value: record,
                permissionRead: 2, // public read
                permissionWrite: 0, // no client writes
            }]);
    }
    catch (e) {
        logger.error('rpcCreateRoom: storageWrite failed: %s', e);
        return JSON.stringify({ error: 'Failed to save room' });
    }
    logger.info('Room created: %s (%s) by %s', roomId, name, ctx.userId);
    return JSON.stringify({ roomId: roomId, matchId: matchId, name: name, mode: mode });
};
// RPC: list_rooms
// Payload: {} (no params needed)
// Returns: { "rooms": [ RoomRecord, ... ] }
var rpcListRooms = function (ctx, logger, nk, payload) {
    try {
        var result = nk.storageList(ROOMS_USER_ID, ROOMS_COLLECTION, 50, '');
        var rooms = [];
        for (var _i = 0, _a = (result.objects || []); _i < _a.length; _i++) {
            var obj = _a[_i];
            try {
                var room = void 0;
                if (typeof obj.value === 'string') {
                    room = JSON.parse(obj.value);
                }
                else {
                    room = obj.value;
                }
                // Only return waiting rooms created in last 30 minutes
                if (room.status === 'waiting' && Date.now() - room.createdAt < 30 * 60 * 1000) {
                    rooms.push(room);
                }
            }
            catch (_b) { }
        }
        // Sort newest first
        rooms.sort(function (a, b) { return b.createdAt - a.createdAt; });
        return JSON.stringify({ rooms: rooms });
    }
    catch (e) {
        logger.error('rpcListRooms error: %s', e);
        return JSON.stringify({ rooms: [] });
    }
};
// RPC: mark_room_full
// Payload: { "roomId": "..." }
var rpcMarkRoomFull = function (ctx, logger, nk, payload) {
    var params = {};
    try {
        params = JSON.parse(payload || '{}');
    }
    catch (_a) { }
    var roomId = params.roomId || '';
    if (!roomId)
        return JSON.stringify({ error: 'roomId required' });
    try {
        var existing = nk.storageRead([{
                collection: ROOMS_COLLECTION,
                key: roomId,
                userId: ROOMS_USER_ID,
            }]);
        if (!existing || existing.length === 0)
            return JSON.stringify({ error: 'Room not found' });
        var room = void 0;
        if (typeof existing[0].value === 'string') {
            room = JSON.parse(existing[0].value);
        }
        else {
            room = existing[0].value;
        }
        room.status = 'full';
        nk.storageWrite([{
                collection: ROOMS_COLLECTION,
                key: roomId,
                userId: ROOMS_USER_ID,
                value: room,
                permissionRead: 2,
                permissionWrite: 0,
            }]);
        return JSON.stringify({ ok: true });
    }
    catch (e) {
        logger.error('rpcMarkRoomFull error: %s', e);
        return JSON.stringify({ error: 'Failed to update room' });
    }
};
// ─── Matchmaker Matched ───────────────────────────────────────────────────────
// Called by Nakama when 2 players are matched via matchmaker
var matchmakerMatched = function (ctx, logger, nk, matches) {
    var _a;
    var mode = ((_a = matches[0]) === null || _a === void 0 ? void 0 : _a.properties['mode']) || 'classic';
    try {
        var matchId = nk.matchCreate(moduleName, { mode: mode });
        logger.info('Matchmaker created match %s (mode: %s)', matchId, mode);
        return matchId;
    }
    catch (e) {
        logger.error('matchmakerMatched error: %s', e);
        return undefined;
    }
};
// ─── Module Init ─────────────────────────────────────────────────────────────
var InitModule = function (ctx, logger, nk, initializer) {
    initializer.registerMatch(moduleName, {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal,
    });
    initializer.registerMatchmakerMatched(matchmakerMatched);
    initializer.registerRpc('get_leaderboard', rpcGetLeaderboard);
    initializer.registerRpc('create_room', rpcCreateRoom);
    initializer.registerRpc('list_rooms', rpcListRooms);
    initializer.registerRpc('mark_room_full', rpcMarkRoomFull);
    // Ensure leaderboard exists at startup
    try {
        nk.leaderboardCreate(LEADERBOARD_ID, false, 'desc', 'incr', '', false);
    }
    catch (e) {
        // Already exists
    }
    logger.info('TicTacToe module loaded successfully');
};
// Required export
!InitModule && InitModule.bind(null);
