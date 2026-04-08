"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rpcMarkGuest = exports.rpcRegisterUser = exports.rpcGetDisplayName = exports.rpcSetDisplayName = exports.rpcGetMyProfile = void 0;
var userStore_1 = require("../utils/userStore");
var types_1 = require("../models/types");
var rpcGetMyProfile = function (ctx, logger, nk, _payload) {
    try {
        var profile = (0, userStore_1.readProfile)(nk, ctx.userId || "", ctx.username || "");
        return JSON.stringify({ profile: profile });
    }
    catch (e) {
        logger.error("rpcGetMyProfile error: %s", e);
        return JSON.stringify({ error: "Failed to fetch profile" });
    }
};
exports.rpcGetMyProfile = rpcGetMyProfile;
var rpcSetDisplayName = function (ctx, logger, nk, payload) {
    var params = {};
    try {
        params = JSON.parse(payload || "{}");
    }
    catch (_a) { }
    var name = (params.name || "").trim().substring(0, 20);
    if (!ctx.userId || !name)
        return JSON.stringify({ error: "invalid name" });
    try {
        nk.storageWrite([{
                collection: types_1.PLAYER_PROFILE_COLLECTION,
                key: "display_name",
                userId: ctx.userId,
                value: { name: name },
                permissionRead: 2,
                permissionWrite: 1,
            }]);
        return JSON.stringify({ ok: true });
    }
    catch (e) {
        logger.error("rpcSetDisplayName error: %s", e);
        return JSON.stringify({ error: "failed to save display name" });
    }
};
exports.rpcSetDisplayName = rpcSetDisplayName;
var rpcGetDisplayName = function (ctx, logger, nk, payload) {
    var params = {};
    try {
        params = JSON.parse(payload || "{}");
    }
    catch (_a) { }
    var userId = (params.userId || "").trim();
    if (!userId)
        return JSON.stringify({ name: "" });
    try {
        var records = nk.storageRead([{
                collection: types_1.PLAYER_PROFILE_COLLECTION,
                key: "display_name",
                userId: userId,
            }]);
        if (!records || records.length === 0)
            return JSON.stringify({ name: "" });
        var raw = records[0].value;
        var value = typeof raw === "string" ? JSON.parse(raw) : raw;
        return JSON.stringify({ name: value && value.name ? value.name : "" });
    }
    catch (e) {
        logger.error("rpcGetDisplayName error: %s", e);
        return JSON.stringify({ name: "" });
    }
};
exports.rpcGetDisplayName = rpcGetDisplayName;
var rpcRegisterUser = function (ctx, logger, nk, _payload) {
    try {
        nk.accountUpdateId(ctx.userId || "", ctx.username || "", null, null, null, null, null, { guest: false, registeredAt: Date.now() });
        return JSON.stringify({ success: true });
    }
    catch (e) {
        logger.error("rpcRegisterUser error: %s", e);
        return JSON.stringify({ error: String(e) });
    }
};
exports.rpcRegisterUser = rpcRegisterUser;
var rpcMarkGuest = function (ctx, logger, nk, _payload) {
    try {
        nk.accountUpdateId(ctx.userId || "", ctx.username || "", null, null, null, null, null, { guest: true });
        return JSON.stringify({ success: true });
    }
    catch (e) {
        logger.error("rpcMarkGuest error: %s", e);
        return JSON.stringify({ error: String(e) });
    }
};
exports.rpcMarkGuest = rpcMarkGuest;
