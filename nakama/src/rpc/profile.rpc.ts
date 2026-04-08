import { readProfile } from "../utils/userStore";
import { PLAYER_PROFILE_COLLECTION } from "../models/types";

export const rpcGetMyProfile: nkruntime.RpcFunction = (
  ctx, logger, nk, _payload
) => {
  try {
    const profile = readProfile(nk, ctx.userId || "", ctx.username || "");
    return JSON.stringify({ profile });
  } catch (e) {
    logger.error("rpcGetMyProfile error: %s", e);
    return JSON.stringify({ error: "Failed to fetch profile" });
  }
};

export const rpcSetDisplayName: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
  let params: { name?: string } = {};
  try { params = JSON.parse(payload || "{}"); } catch {}
  const name = (params.name || "").trim().substring(0, 20);
  if (!ctx.userId || !name) return JSON.stringify({ error: "invalid name" });
  try {
    nk.storageWrite([{
      collection: PLAYER_PROFILE_COLLECTION,
      key: "display_name",
      userId: ctx.userId,
      value: { name },
      permissionRead: 2,
      permissionWrite: 1,
    } as any]);
    return JSON.stringify({ ok: true });
  } catch (e) {
    logger.error("rpcSetDisplayName error: %s", e);
    return JSON.stringify({ error: "failed to save display name" });
  }
};

export const rpcGetDisplayName: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
  let params: { userId?: string } = {};
  try { params = JSON.parse(payload || "{}"); } catch {}
  const userId = (params.userId || "").trim();
  if (!userId) return JSON.stringify({ name: "" });
  try {
    const records = nk.storageRead([{
      collection: PLAYER_PROFILE_COLLECTION,
      key: "display_name",
      userId,
    } as any]);
    if (!records || records.length === 0) return JSON.stringify({ name: "" });
    const raw = records[0].value as any;
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return JSON.stringify({ name: value && value.name ? value.name : "" });
  } catch (e) {
    logger.error("rpcGetDisplayName error: %s", e);
    return JSON.stringify({ name: "" });
  }
};

export const rpcRegisterUser: nkruntime.RpcFunction = (ctx, logger, nk, _payload) => {
  try {
    nk.accountUpdateId(
      ctx.userId || "", ctx.username || "", null, null, null, null, null,
      { guest: false, registeredAt: Date.now() } as any
    );
    return JSON.stringify({ success: true });
  } catch (e) {
    logger.error("rpcRegisterUser error: %s", e);
    return JSON.stringify({ error: String(e) });
  }
};

export const rpcMarkGuest: nkruntime.RpcFunction = (ctx, logger, nk, _payload) => {
  try {
    nk.accountUpdateId(
      ctx.userId || "", ctx.username || "", null, null, null, null, null,
      { guest: true } as any
    );
    return JSON.stringify({ success: true });
  } catch (e) {
    logger.error("rpcMarkGuest error: %s", e);
    return JSON.stringify({ error: String(e) });
  }
};
