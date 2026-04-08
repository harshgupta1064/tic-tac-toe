"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rpcGetRoomByCode = exports.rpcDeleteRoom = exports.rpcMarkRoomFull = exports.rpcListRooms = exports.rpcCreateRoom = void 0;
var types_1 = require("../models/types");
function generateRoomCode(nk) {
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var code = "";
    var raw = nk.uuidv4().replace(/-/g, "");
    for (var i = 0; i < 6; i++) {
        var idx = parseInt(raw.substring(i * 2, i * 2 + 2), 16) % alphabet.length;
        code += alphabet[idx];
    }
    return code;
}
var rpcCreateRoom = function (ctx, logger, nk, payload) {
    var params = {};
    try {
        params = JSON.parse(payload || "{}");
    }
    catch (_a) { }
    var name = (params.name || "").trim().substring(0, 32) || "Room";
    var mode = params.mode === "timed" ? "timed" : "classic";
    var roomId = nk.uuidv4();
    var code = generateRoomCode(nk);
    var matchId;
    try {
        matchId = nk.matchCreate(types_1.MODULE_NAME, { mode: mode, roomId: roomId });
    }
    catch (e) {
        logger.error("rpcCreateRoom: matchCreate failed: %s", e);
        return JSON.stringify({ error: "Failed to create match" });
    }
    var record = {
        id: roomId,
        code: code,
        name: name,
        mode: mode,
        hostUserId: ctx.userId || "",
        hostUsername: (params.hostUsername || "").trim().substring(0, 20) || ctx.username || "Player",
        matchId: matchId,
        status: "waiting", createdAt: Date.now(),
    };
    try {
        nk.storageWrite([{
                collection: types_1.COLLECTION_ROOMS,
                key: roomId,
                userId: types_1.SYSTEM_USER_ID,
                value: record,
                permissionRead: 2,
                permissionWrite: 1,
            }]);
    }
    catch (e) {
        logger.error("rpcCreateRoom: storageWrite failed: %s", e);
        return JSON.stringify({ error: "Failed to save room" });
    }
    return JSON.stringify({ roomId: roomId, matchId: matchId, code: code, name: name, mode: mode });
};
exports.rpcCreateRoom = rpcCreateRoom;
var rpcListRooms = function (ctx, logger, nk, _payload) {
    try {
        var result = nk.storageList(types_1.SYSTEM_USER_ID, types_1.COLLECTION_ROOMS, 50, "");
        var rooms = [];
        for (var i = 0; i < (result.objects || []).length; i++) {
            var obj = (result.objects || [])[i];
            try {
                var room = typeof obj.value === "string" ? JSON.parse(obj.value) : obj.value;
                if (room.status === "waiting" && Date.now() - room.createdAt < 30 * 60 * 1000) {
                    rooms.push(room);
                }
            }
            catch (_a) { }
        }
        rooms.sort(function (a, b) { return b.createdAt - a.createdAt; });
        return JSON.stringify({ rooms: rooms });
    }
    catch (e) {
        logger.error("rpcListRooms error: %s", e);
        return JSON.stringify({ rooms: [] });
    }
};
exports.rpcListRooms = rpcListRooms;
var rpcMarkRoomFull = function (ctx, logger, nk, payload) {
    var params = {};
    try {
        params = JSON.parse(payload || "{}");
    }
    catch (_a) { }
    var roomId = params.roomId || "";
    if (!roomId)
        return JSON.stringify({ error: "roomId required" });
    try {
        var existing = nk.storageRead([{
                collection: types_1.COLLECTION_ROOMS,
                key: roomId,
                userId: types_1.SYSTEM_USER_ID,
            }]);
        if (!existing || existing.length === 0)
            return JSON.stringify({ error: "Room not found" });
        var raw = existing[0].value;
        var room = typeof raw === "string" ? JSON.parse(raw) : raw;
        room.status = "full";
        nk.storageWrite([{
                collection: types_1.COLLECTION_ROOMS,
                key: roomId,
                userId: types_1.SYSTEM_USER_ID,
                value: room,
                permissionRead: 2,
                permissionWrite: 1,
            }]);
        return JSON.stringify({ ok: true });
    }
    catch (e) {
        logger.error("rpcMarkRoomFull error: %s", e);
        return JSON.stringify({ error: "Failed to update room" });
    }
};
exports.rpcMarkRoomFull = rpcMarkRoomFull;
var rpcDeleteRoom = function (ctx, logger, nk, payload) {
    var params = {};
    try {
        params = JSON.parse(payload || "{}");
    }
    catch (_a) { }
    var roomId = params.roomId || "";
    if (!roomId)
        return JSON.stringify({ error: "roomId required" });
    try {
        nk.storageDelete([{
                collection: types_1.COLLECTION_ROOMS,
                key: roomId,
                userId: types_1.SYSTEM_USER_ID,
            }]);
        return JSON.stringify({ ok: true });
    }
    catch (e) {
        logger.error("rpcDeleteRoom error: %s", e);
        return JSON.stringify({ error: "Failed to delete room" });
    }
};
exports.rpcDeleteRoom = rpcDeleteRoom;
var rpcGetRoomByCode = function (ctx, logger, nk, payload) {
    var params = {};
    try {
        params = JSON.parse(payload || "{}");
    }
    catch (_a) { }
    var code = (params.code || "").trim().toUpperCase();
    if (!code)
        return JSON.stringify({ error: "code required" });
    try {
        var result = nk.storageList(types_1.SYSTEM_USER_ID, types_1.COLLECTION_ROOMS, 100, "");
        for (var i = 0; i < (result.objects || []).length; i++) {
            var obj = (result.objects || [])[i];
            try {
                var room = typeof obj.value === "string" ? JSON.parse(obj.value) : obj.value;
                if (room.code === code && room.status === "waiting" && Date.now() - room.createdAt < 30 * 60 * 1000) {
                    return JSON.stringify({ room: room });
                }
            }
            catch (_b) { }
        }
        return JSON.stringify({ error: "Room code not found" });
    }
    catch (e) {
        logger.error("rpcGetRoomByCode error: %s", e);
        return JSON.stringify({ error: "Failed to lookup room code" });
    }
};
exports.rpcGetRoomByCode = rpcGetRoomByCode;
