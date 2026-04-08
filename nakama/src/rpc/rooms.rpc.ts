import { RoomRecord, COLLECTION_ROOMS, SYSTEM_USER_ID, MODULE_NAME } from "../models/types";

function parsePayloadObject(payload: string): any {
  try {
    const parsed = JSON.parse(payload || "{}");
    if (typeof parsed === "string") {
      try { return JSON.parse(parsed); } catch { return { code: parsed }; }
    }
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // Allow raw non-JSON code payloads too, e.g. "ABC123"
    const raw = (payload || "").trim();
    if (raw && raw !== "{}") return { code: raw.replace(/^"+|"+$/g, "") };
    return {};
  }
}

function generateRoomCode(nk: nkruntime.Nakama): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const raw = nk.uuidv4().replace(/-/g, "");
  for (let i = 0; i < 6; i++) {
    const idx = parseInt(raw.substring(i * 2, i * 2 + 2), 16) % alphabet.length;
    code += alphabet[idx];
  }
  return code;
}

export const rpcCreateRoom: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
  let params: { name?: string; mode?: string; hostUsername?: string } = {};
  try { params = JSON.parse(payload || "{}"); } catch {}

  const name = (params.name || "").trim().substring(0, 32) || "Room";
  const mode = params.mode === "timed" ? "timed" : "classic";
  const roomId = nk.uuidv4();
  const code = generateRoomCode(nk);

  let matchId: string;
  try {
    matchId = nk.matchCreate(MODULE_NAME, { mode, roomId } as any);
  } catch (e) {
    logger.error("rpcCreateRoom: matchCreate failed: %s", e);
    return JSON.stringify({ error: "Failed to create match" });
  }

  const record: RoomRecord = {
    id: roomId, code, name, mode,
    hostUserId: ctx.userId || "",
    hostUsername: (params.hostUsername || "").trim().substring(0, 20) || ctx.username || "Player",
    matchId, status: "waiting", createdAt: Date.now(),
  };

  try {
    nk.storageWrite([{
      collection: COLLECTION_ROOMS,
      key: roomId,
      userId: SYSTEM_USER_ID,
      value: record as any,
      permissionRead: 2,
      permissionWrite: 1,
    } as any]);
  } catch (e) {
    logger.error("rpcCreateRoom: storageWrite failed: %s", e);
    return JSON.stringify({ error: "Failed to save room" });
  }

  return JSON.stringify({ roomId, matchId, code, name, mode });
};

export const rpcListRooms: nkruntime.RpcFunction = (ctx, logger, nk, _payload) => {
  try {
    const result = nk.storageList(SYSTEM_USER_ID, COLLECTION_ROOMS, 50, "" as any);
    const rooms: RoomRecord[] = [];
    for (let i = 0; i < (result.objects || []).length; i++) {
      const obj = (result.objects || [])[i] as any;
      try {
        const room: RoomRecord = typeof obj.value === "string" ? JSON.parse(obj.value) : obj.value;
        if (room.status === "waiting" && Date.now() - room.createdAt < 30 * 60 * 1000) {
          rooms.push(room);
        }
      } catch {}
    }
    rooms.sort((a, b) => b.createdAt - a.createdAt);
    return JSON.stringify({ rooms });
  } catch (e) {
    logger.error("rpcListRooms error: %s", e);
    return JSON.stringify({ rooms: [] });
  }
};

export const rpcMarkRoomFull: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
  let params: { roomId?: string } = {};
  try { params = JSON.parse(payload || "{}"); } catch {}
  const roomId = params.roomId || "";
  if (!roomId) return JSON.stringify({ error: "roomId required" });
  try {
    const existing = nk.storageRead([{
      collection: COLLECTION_ROOMS,
      key: roomId,
      userId: SYSTEM_USER_ID,
    } as any]);
    if (!existing || existing.length === 0) return JSON.stringify({ error: "Room not found" });
    const raw = existing[0].value as any;
    const room: RoomRecord = typeof raw === "string" ? JSON.parse(raw) : raw;
    room.status = "full";
    nk.storageWrite([{
      collection: COLLECTION_ROOMS,
      key: roomId,
      userId: SYSTEM_USER_ID,
      value: room as any,
      permissionRead: 2,
      permissionWrite: 1,
    } as any]);
    return JSON.stringify({ ok: true });
  } catch (e) {
    logger.error("rpcMarkRoomFull error: %s", e);
    return JSON.stringify({ error: "Failed to update room" });
  }
};

export const rpcDeleteRoom: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
  let params: { roomId?: string } = {};
  try { params = JSON.parse(payload || "{}"); } catch {}
  const roomId = params.roomId || "";
  if (!roomId) return JSON.stringify({ error: "roomId required" });
  try {
    nk.storageDelete([{
      collection: COLLECTION_ROOMS,
      key: roomId,
      userId: SYSTEM_USER_ID,
    } as any]);
    return JSON.stringify({ ok: true });
  } catch (e) {
    logger.error("rpcDeleteRoom error: %s", e);
    return JSON.stringify({ error: "Failed to delete room" });
  }
};

export const rpcGetRoomByCode: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
  logger.info("rpcGetRoomByCode payload raw: %s", payload || "<empty>");
  const params = parsePayloadObject(payload) as { code?: string };
  const code = (params.code || "").trim().toUpperCase();
  logger.info("rpcGetRoomByCode parsed code: %s", code || "<empty>");
  if (!code) return JSON.stringify({ error: "code required" });
  try {
    const result = nk.storageList(SYSTEM_USER_ID, COLLECTION_ROOMS, 100, "" as any);
    for (let i = 0; i < (result.objects || []).length; i++) {
      const obj = (result.objects || [])[i] as any;
      try {
        const room: RoomRecord = typeof obj.value === "string" ? JSON.parse(obj.value) : obj.value;
        if (room.code === code && room.status === "waiting" && Date.now() - room.createdAt < 30 * 60 * 1000) {
          return JSON.stringify({ room });
        }
      } catch {}
    }
    return JSON.stringify({ error: "Room code not found" });
  } catch (e) {
    logger.error("rpcGetRoomByCode error: %s", e);
    return JSON.stringify({ error: "Failed to lookup room code" });
  }
};
