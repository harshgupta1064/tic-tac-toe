"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rpcMarkGuest = exports.rpcRegisterUser = void 0;
var rpcRegisterUser = function (ctx, logger, nk, payload) {
    try {
        nk.accountUpdateId(ctx.userId || '', ctx.username || '', null, null, null, null, null, { guest: false, registeredAt: Date.now() });
        logger.info('User registered: %s (%s)', ctx.userId, ctx.username);
        return JSON.stringify({ success: true });
    }
    catch (e) {
        logger.error('rpcRegisterUser error: %s', e);
        return JSON.stringify({ error: String(e) });
    }
};
exports.rpcRegisterUser = rpcRegisterUser;
var rpcMarkGuest = function (ctx, logger, nk, payload) {
    try {
        nk.accountUpdateId(ctx.userId || '', ctx.username || '', null, null, null, null, null, { guest: true });
        logger.info('Marked user as guest: %s', ctx.userId);
        return JSON.stringify({ success: true });
    }
    catch (e) {
        logger.error('rpcMarkGuest error: %s', e);
        return JSON.stringify({ error: String(e) });
    }
};
exports.rpcMarkGuest = rpcMarkGuest;
