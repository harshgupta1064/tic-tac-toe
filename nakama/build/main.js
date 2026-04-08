// src/models/types.ts
var OpCode = {
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
  OPPONENT_LEFT_LOBBY: 11
};
var LEADERBOARD_WINS = "tictactoe_wins";
var LEADERBOARD_LOSSES = "tictactoe_losses";
var LEADERBOARD_STREAK = "tictactoe_best_streak";
var LEADERBOARD_DRAWS = "tictactoe_draws";
var COLLECTION_USERS = "users";
var COLLECTION_ROOMS = "rooms";
var USER_PROFILE_KEY = "profile";
var MODULE_NAME = "tictactoe";
var SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
var PLAYER_PROFILE_COLLECTION = "player_profile";
var WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

// src/utils/userStore.ts
function defaultProfile(userId, username) {
  return {
    userId,
    username,
    wins: 0,
    losses: 0,
    draws: 0,
    currentStreak: 0,
    bestStreak: 0,
    rank: 0,
    totalGames: 0,
    updatedAt: Date.now()
  };
}
function readProfile(nk, userId, username) {
  try {
    const reads = nk.storageRead([{
      collection: COLLECTION_USERS,
      key: USER_PROFILE_KEY,
      userId
    }]);
    if (reads && reads.length > 0) {
      const raw = reads[0].value;
      const stored = typeof raw === "string" ? JSON.parse(raw) : raw;
      stored.username = username || stored.username;
      return stored;
    }
  } catch (e) {
  }
  return defaultProfile(userId, username);
}
function writeProfile(nk, profile) {
  profile.updatedAt = Date.now();
  profile.totalGames = profile.wins + profile.losses + profile.draws;
  nk.storageWrite([{
    collection: COLLECTION_USERS,
    key: USER_PROFILE_KEY,
    userId: profile.userId,
    value: profile,
    permissionRead: 2,
    permissionWrite: 1
  }]);
}

// src/utils/leaderboard.ts
function ensureLeaderboards(nk) {
  try {
    nk.leaderboardCreate(LEADERBOARD_WINS, false, "desc", "incr", "", {});
  } catch (e) {
  }
  try {
    nk.leaderboardCreate(LEADERBOARD_LOSSES, false, "desc", "incr", "", {});
  } catch (e) {
  }
  try {
    nk.leaderboardCreate(LEADERBOARD_DRAWS, false, "desc", "incr", "", {});
  } catch (e) {
  }
  try {
    nk.leaderboardCreate(LEADERBOARD_STREAK, false, "desc", "best", "", {});
  } catch (e) {
  }
}
function writeMatchResult(nk, logger, state, winnerUserId, loserUserId, winnerUsername, loserUsername) {
  try {
    ensureLeaderboards(nk);
    if (winnerUserId && loserUserId) {
      const winner = readProfile(nk, winnerUserId, winnerUsername);
      winner.wins += 1;
      winner.currentStreak += 1;
      if (winner.currentStreak > winner.bestStreak) winner.bestStreak = winner.currentStreak;
      writeProfile(nk, winner);
      nk.leaderboardRecordWrite(LEADERBOARD_WINS, winnerUserId, winnerUsername || "", 1, 0, {});
      nk.leaderboardRecordWrite(LEADERBOARD_STREAK, winnerUserId, winnerUsername || "", winner.bestStreak, 0, {});
      const loser = readProfile(nk, loserUserId, loserUsername);
      loser.losses += 1;
      loser.currentStreak = 0;
      writeProfile(nk, loser);
      nk.leaderboardRecordWrite(LEADERBOARD_LOSSES, loserUserId, loserUsername || "", 1, 0, {});
      logger.info("Wrote win/loss: %s > %s", winnerUserId, loserUserId);
    } else {
      const userIds = Object.keys(state.marks);
      for (let i = 0; i < userIds.length; i++) {
        const uid = userIds[i];
        const profile = readProfile(nk, uid, "");
        profile.draws += 1;
        writeProfile(nk, profile);
        nk.leaderboardRecordWrite(LEADERBOARD_DRAWS, uid, profile.username || "", 1, 0, {});
      }
      logger.info("Wrote draw for %d players", userIds.length);
    }
  } catch (e) {
    logger.error("writeMatchResult failed: %s", e);
  }
}
function getLeaderboardRows(nk, logger) {
  try {
    ensureLeaderboards(nk);
    const winsResult = nk.leaderboardRecordsList(LEADERBOARD_WINS, [], 20, null, null);
    const records = winsResult.records || [];
    if (!records.length) return [];
    const userIds = records.map((r) => r.ownerId);
    const reads = userIds.map((uid) => ({
      collection: "users",
      key: "profile",
      userId: uid
    }));
    const profileMap = {};
    try {
      const profileResults = nk.storageRead(reads);
      for (let i = 0; i < (profileResults || []).length; i++) {
        const r = (profileResults || [])[i];
        const raw = r.value;
        profileMap[r.userId] = typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    } catch (e) {
    }
    return records.map((r, i) => {
      const p = profileMap[r.ownerId];
      const wins = p && typeof p.wins === "number" ? p.wins : r.score;
      const losses = p && typeof p.losses === "number" ? p.losses : 0;
      const draws = p && typeof p.draws === "number" ? p.draws : 0;
      const total = wins + losses + draws;
      return {
        userId: r.ownerId,
        username: p && p.username || r.username || "Player",
        wins,
        losses,
        draws,
        bestStreak: p && p.bestStreak || 0,
        winRate: total > 0 ? Math.round(wins / total * 100) : 0,
        rank: i + 1
      };
    });
  } catch (e) {
    logger.error("getLeaderboardRows failed: %s", e);
    return [];
  }
}

// src/match/handler.ts
function checkWinner(board) {
  for (let i = 0; i < WIN_LINES.length; i++) {
    const line = WIN_LINES[i];
    const a = line[0], b = line[1], c = line[2];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every((cell) => cell !== "")) return "draw";
  return null;
}
function matchInit(ctx, logger, nk, params) {
  const mode = params["mode"] === "timed" ? "timed" : "classic";
  const tickRate = 1;
  const state = {
    board: ["", "", "", "", "", "", "", "", ""],
    marks: {},
    playerNames: {},
    currentTurn: "",
    winner: null,
    gameOver: false,
    presences: {},
    mode,
    turnStartTick: 0,
    tickRate,
    turnLimitTicks: 10,
    roomId: typeof params["roomId"] === "string" ? params["roomId"] : "",
    emptySinceTick: -1,
    rematchRequestedBy: "",
    rematchRequestTick: 0,
    isRematch: false,
    guestUserIds: []
  };
  logger.info("Match initialized, mode: %s", mode);
  return { state, tickRate, label: JSON.stringify({ mode }) };
}
function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  if (state.gameOver) return { state, accept: false };
  if (Object.keys(state.presences).length >= 2) return { state, accept: false };
  return { state, accept: true };
}
function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (let i = 0; i < presences.length; i++) {
    const presence = presences[i];
    state.presences[presence.userId] = presence;
    state.playerNames[presence.userId] = presence.username || "Player";
    try {
      const users = nk.usersGetId([presence.userId]);
      if (users && users.length > 0) {
        const metadataValue = users[0].metadata;
        const meta = typeof metadataValue === "string" ? JSON.parse(metadataValue || "{}") : metadataValue || {};
        if (meta.guest === true) state.guestUserIds.push(presence.userId);
      }
    } catch (e) {
    }
    logger.info("Player joined: %s", presence.userId);
  }
  if (Object.keys(state.presences).length === 2) {
    const userIds = Object.keys(state.presences);
    state.marks[userIds[0]] = "X";
    state.marks[userIds[1]] = "O";
    state.currentTurn = userIds[0];
    state.turnStartTick = tick;
    const readyMsg = JSON.stringify({
      board: state.board,
      marks: state.marks,
      playerNames: state.playerNames,
      currentTurn: state.currentTurn,
      mode: state.mode
    });
    dispatcher.broadcastMessage(OpCode.READY, readyMsg);
    dispatcher.broadcastMessage(OpCode.STATE, readyMsg);
  }
  return { state };
}
function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  var _a;
  for (let i = 0; i < presences.length; i++) {
    const presence = presences[i];
    delete state.presences[presence.userId];
    delete state.playerNames[presence.userId];
    logger.info("Player left: %s", presence.userId);
    const gameWasInProgress = !state.gameOver && Object.keys(state.marks).length === 2 && presence.userId in state.marks;
    if (Object.keys(state.presences).length > 0) {
      const remainingUserId = Object.keys(state.presences)[0];
      const remainingPresence = state.presences[remainingUserId];
      if (gameWasInProgress) {
        state.gameOver = true;
        state.winner = remainingUserId;
        dispatcher.broadcastMessage(
          OpCode.GAME_OVER,
          JSON.stringify({
            board: state.board,
            winner: remainingUserId,
            winnerMark: state.marks[remainingUserId],
            reason: "forfeit"
          }),
          remainingPresence ? [remainingPresence] : void 0
        );
        writeMatchResult(
          nk,
          logger,
          state,
          remainingUserId,
          presence.userId,
          ((_a = state.presences[remainingUserId]) == null ? void 0 : _a.username) || "",
          presence.username || ""
        );
      }
      if (remainingPresence) {
        dispatcher.broadcastMessage(
          OpCode.OPPONENT_LEFT_LOBBY,
          JSON.stringify({ reason: gameWasInProgress ? "forfeit" : "opponent_left" }),
          [remainingPresence]
        );
      }
    }
  }
  return { state };
}
function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  var _a, _b, _c, _d;
  const presenceCount = Object.keys(state.presences).length;
  if (presenceCount === 0) {
    if (state.emptySinceTick < 0) state.emptySinceTick = tick;
    if (tick - state.emptySinceTick >= 60) {
      if (state.roomId) {
        try {
          nk.storageDelete([{ collection: COLLECTION_ROOMS, key: state.roomId, userId: SYSTEM_USER_ID }]);
        } catch (e) {
        }
      }
      return null;
    }
    return { state };
  }
  state.emptySinceTick = -1;
  if (presenceCount < 2) return { state };
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const senderId = message.sender.userId;
    if (message.opCode === OpCode.MOVE) {
      if (state.gameOver) continue;
      if (senderId !== state.currentTurn) {
        dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: "Not your turn" }), [message.sender]);
        continue;
      }
      let move;
      try {
        move = JSON.parse(nk.binaryToString(message.data));
      } catch (e) {
        dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: "Invalid message format" }), [message.sender]);
        continue;
      }
      const pos = move.position;
      if (pos < 0 || pos > 8 || state.board[pos] !== "") {
        dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: "Invalid move position" }), [message.sender]);
        continue;
      }
      state.board[pos] = state.marks[senderId];
      const result = checkWinner(state.board);
      if (result) {
        state.gameOver = true;
        state.rematchRequestedBy = "";
        state.rematchRequestTick = 0;
        if (result === "draw") {
          state.winner = "draw";
          dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({ board: state.board, winner: "draw", reason: "draw" }));
          writeMatchResult(nk, logger, state, null, null, "", "");
        } else {
          const winnerUserId = Object.keys(state.marks).find((uid) => state.marks[uid] === result);
          const loserUserId = Object.keys(state.marks).find((uid) => state.marks[uid] !== result);
          state.winner = winnerUserId;
          dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
            board: state.board,
            winner: winnerUserId,
            winnerMark: result,
            reason: "win"
          }));
          const winnerUsername = ((_a = state.presences[winnerUserId]) == null ? void 0 : _a.username) || "";
          const loserUsername = ((_b = state.presences[loserUserId]) == null ? void 0 : _b.username) || "";
          writeMatchResult(nk, logger, state, winnerUserId, loserUserId, winnerUsername, loserUsername);
        }
      } else {
        const userIds = Object.keys(state.marks);
        state.currentTurn = userIds.find((uid) => uid !== senderId);
        state.turnStartTick = tick;
        dispatcher.broadcastMessage(OpCode.STATE, JSON.stringify({
          board: state.board,
          playerNames: state.playerNames,
          currentTurn: state.currentTurn,
          lastMove: { position: pos, mark: state.marks[senderId] }
        }));
      }
    }
    if (message.opCode === OpCode.REMATCH_REQUEST) {
      if (!state.gameOver || state.rematchRequestedBy) continue;
      state.rematchRequestedBy = senderId;
      state.rematchRequestTick = tick;
      const otherUserId = Object.keys(state.presences).find((uid) => uid !== senderId);
      const otherPresence = otherUserId ? state.presences[otherUserId] : void 0;
      if (otherPresence) dispatcher.broadcastMessage(OpCode.REMATCH_REQUEST, JSON.stringify({ requestedBy: senderId }), [otherPresence]);
    }
    if (message.opCode === OpCode.REMATCH_ACCEPT) {
      if (!state.rematchRequestedBy || senderId === state.rematchRequestedBy || !state.gameOver) continue;
      state.board = ["", "", "", "", "", "", "", "", ""];
      state.winner = null;
      state.gameOver = false;
      state.isRematch = true;
      state.rematchRequestedBy = "";
      state.rematchRequestTick = 0;
      const userIds = Object.keys(state.marks);
      const prevX = userIds.find((uid) => state.marks[uid] === "X");
      const prevO = userIds.find((uid) => state.marks[uid] === "O");
      state.marks[prevX] = "O";
      state.marks[prevO] = "X";
      state.currentTurn = prevO;
      state.turnStartTick = tick;
      dispatcher.broadcastMessage(OpCode.REMATCH_START, JSON.stringify({
        board: state.board,
        marks: state.marks,
        playerNames: state.playerNames,
        currentTurn: state.currentTurn,
        mode: state.mode
      }));
    }
    if (message.opCode === OpCode.REMATCH_DECLINE) {
      if (!state.rematchRequestedBy || !state.gameOver) continue;
      const requesterPresence = state.presences[state.rematchRequestedBy];
      if (requesterPresence) {
        dispatcher.broadcastMessage(OpCode.REMATCH_DECLINE, JSON.stringify({ reason: "declined" }), [requesterPresence]);
      }
      state.rematchRequestedBy = "";
      state.rematchRequestTick = 0;
    }
  }
  if (state.gameOver && state.rematchRequestedBy && tick - state.rematchRequestTick >= 30) {
    dispatcher.broadcastMessage(OpCode.REMATCH_DECLINE, JSON.stringify({ reason: "timeout" }));
    state.rematchRequestedBy = "";
    state.rematchRequestTick = 0;
  }
  if (state.mode === "timed" && !state.gameOver) {
    if (state.turnLimitTicks !== 10) state.turnLimitTicks = 10;
    const elapsed = tick - state.turnStartTick;
    const remaining = state.turnLimitTicks - elapsed;
    if (remaining >= 0) {
      const currentPresence = state.presences[state.currentTurn];
      if (currentPresence) {
        dispatcher.broadcastMessage(OpCode.TICK, JSON.stringify({ remaining }), [currentPresence]);
      }
    }
    if (elapsed >= state.turnLimitTicks) {
      state.gameOver = true;
      const loserUserId = state.currentTurn;
      const winnerUserId = Object.keys(state.marks).find((uid) => uid !== loserUserId);
      state.winner = winnerUserId;
      dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
        board: state.board,
        winner: winnerUserId,
        winnerMark: state.marks[winnerUserId],
        reason: "timeout",
        timedOutPlayer: loserUserId
      }));
      const winnerUsername = ((_c = state.presences[winnerUserId]) == null ? void 0 : _c.username) || "";
      const loserUsername = ((_d = state.presences[loserUserId]) == null ? void 0 : _d.username) || "";
      writeMatchResult(nk, logger, state, winnerUserId, loserUserId, winnerUsername, loserUsername);
    }
  }
  return { state };
}
function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  logger.info("Match terminated");
  return { state };
}
function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  return { state, data: "" };
}
var matchmakerMatched = (ctx, logger, nk, matches) => {
  var _a;
  const mode = ((_a = matches[0]) == null ? void 0 : _a.properties["mode"]) || "classic";
  try {
    const matchId = nk.matchCreate(MODULE_NAME, { mode });
    logger.info("Matchmaker created match %s (mode: %s)", matchId, mode);
    return matchId;
  } catch (e) {
    logger.error("matchmakerMatched error: %s", e);
    return void 0;
  }
};

// src/rpc/leaderboard.rpc.ts
var rpcGetLeaderboard = (ctx, logger, nk, _payload) => {
  const rows = getLeaderboardRows(nk, logger);
  return JSON.stringify({ records: rows });
};

// src/rpc/profile.rpc.ts
var rpcGetMyProfile = (ctx, logger, nk, _payload) => {
  try {
    const profile = readProfile(nk, ctx.userId || "", ctx.username || "");
    return JSON.stringify({ profile });
  } catch (e) {
    logger.error("rpcGetMyProfile error: %s", e);
    return JSON.stringify({ error: "Failed to fetch profile" });
  }
};
var rpcSetDisplayName = (ctx, logger, nk, payload) => {
  let params = {};
  try {
    params = JSON.parse(payload || "{}");
  } catch (e) {
  }
  const name = (params.name || "").trim().substring(0, 20);
  if (!ctx.userId || !name) return JSON.stringify({ error: "invalid name" });
  try {
    nk.storageWrite([{
      collection: PLAYER_PROFILE_COLLECTION,
      key: "display_name",
      userId: ctx.userId,
      value: { name },
      permissionRead: 2,
      permissionWrite: 1
    }]);
    return JSON.stringify({ ok: true });
  } catch (e) {
    logger.error("rpcSetDisplayName error: %s", e);
    return JSON.stringify({ error: "failed to save display name" });
  }
};
var rpcGetDisplayName = (ctx, logger, nk, payload) => {
  let params = {};
  try {
    params = JSON.parse(payload || "{}");
  } catch (e) {
  }
  const userId = (params.userId || "").trim();
  if (!userId) return JSON.stringify({ name: "" });
  try {
    const records = nk.storageRead([{
      collection: PLAYER_PROFILE_COLLECTION,
      key: "display_name",
      userId
    }]);
    if (!records || records.length === 0) return JSON.stringify({ name: "" });
    const raw = records[0].value;
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return JSON.stringify({ name: value && value.name ? value.name : "" });
  } catch (e) {
    logger.error("rpcGetDisplayName error: %s", e);
    return JSON.stringify({ name: "" });
  }
};
var rpcRegisterUser = (ctx, logger, nk, _payload) => {
  try {
    nk.accountUpdateId(
      ctx.userId || "",
      ctx.username || "",
      null,
      null,
      null,
      null,
      null,
      { guest: false, registeredAt: Date.now() }
    );
    return JSON.stringify({ success: true });
  } catch (e) {
    logger.error("rpcRegisterUser error: %s", e);
    return JSON.stringify({ error: String(e) });
  }
};
var rpcMarkGuest = (ctx, logger, nk, _payload) => {
  try {
    nk.accountUpdateId(
      ctx.userId || "",
      ctx.username || "",
      null,
      null,
      null,
      null,
      null,
      { guest: true }
    );
    return JSON.stringify({ success: true });
  } catch (e) {
    logger.error("rpcMarkGuest error: %s", e);
    return JSON.stringify({ error: String(e) });
  }
};

// src/rpc/rooms.rpc.ts
function parsePayloadObject(payload) {
  try {
    const parsed = JSON.parse(payload || "{}");
    if (typeof parsed === "string") {
      try {
        return JSON.parse(parsed);
      } catch (e) {
        return { code: parsed };
      }
    }
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    const raw = (payload || "").trim();
    if (raw && raw !== "{}") return { code: raw.replace(/^"+|"+$/g, "") };
    return {};
  }
}
function generateRoomCode(nk) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const raw = nk.uuidv4().replace(/-/g, "");
  for (let i = 0; i < 6; i++) {
    const idx = parseInt(raw.substring(i * 2, i * 2 + 2), 16) % alphabet.length;
    code += alphabet[idx];
  }
  return code;
}
var rpcCreateRoom = (ctx, logger, nk, payload) => {
  let params = {};
  try {
    params = JSON.parse(payload || "{}");
  } catch (e) {
  }
  const name = (params.name || "").trim().substring(0, 32) || "Room";
  const mode = params.mode === "timed" ? "timed" : "classic";
  const roomId = nk.uuidv4();
  const code = generateRoomCode(nk);
  let matchId;
  try {
    matchId = nk.matchCreate(MODULE_NAME, { mode, roomId });
  } catch (e) {
    logger.error("rpcCreateRoom: matchCreate failed: %s", e);
    return JSON.stringify({ error: "Failed to create match" });
  }
  const record = {
    id: roomId,
    code,
    name,
    mode,
    hostUserId: ctx.userId || "",
    hostUsername: (params.hostUsername || "").trim().substring(0, 20) || ctx.username || "Player",
    matchId,
    status: "waiting",
    createdAt: Date.now()
  };
  try {
    nk.storageWrite([{
      collection: COLLECTION_ROOMS,
      key: roomId,
      userId: SYSTEM_USER_ID,
      value: record,
      permissionRead: 2,
      permissionWrite: 1
    }]);
  } catch (e) {
    logger.error("rpcCreateRoom: storageWrite failed: %s", e);
    return JSON.stringify({ error: "Failed to save room" });
  }
  return JSON.stringify({ roomId, matchId, code, name, mode });
};
var rpcListRooms = (ctx, logger, nk, _payload) => {
  try {
    const result = nk.storageList(SYSTEM_USER_ID, COLLECTION_ROOMS, 50, "");
    const rooms = [];
    for (let i = 0; i < (result.objects || []).length; i++) {
      const obj = (result.objects || [])[i];
      try {
        const room = typeof obj.value === "string" ? JSON.parse(obj.value) : obj.value;
        if (room.status === "waiting" && Date.now() - room.createdAt < 30 * 60 * 1e3) {
          rooms.push(room);
        }
      } catch (e) {
      }
    }
    rooms.sort((a, b) => b.createdAt - a.createdAt);
    return JSON.stringify({ rooms });
  } catch (e) {
    logger.error("rpcListRooms error: %s", e);
    return JSON.stringify({ rooms: [] });
  }
};
var rpcMarkRoomFull = (ctx, logger, nk, payload) => {
  let params = {};
  try {
    params = JSON.parse(payload || "{}");
  } catch (e) {
  }
  const roomId = params.roomId || "";
  if (!roomId) return JSON.stringify({ error: "roomId required" });
  try {
    const existing = nk.storageRead([{
      collection: COLLECTION_ROOMS,
      key: roomId,
      userId: SYSTEM_USER_ID
    }]);
    if (!existing || existing.length === 0) return JSON.stringify({ error: "Room not found" });
    const raw = existing[0].value;
    const room = typeof raw === "string" ? JSON.parse(raw) : raw;
    room.status = "full";
    nk.storageWrite([{
      collection: COLLECTION_ROOMS,
      key: roomId,
      userId: SYSTEM_USER_ID,
      value: room,
      permissionRead: 2,
      permissionWrite: 1
    }]);
    return JSON.stringify({ ok: true });
  } catch (e) {
    logger.error("rpcMarkRoomFull error: %s", e);
    return JSON.stringify({ error: "Failed to update room" });
  }
};
var rpcDeleteRoom = (ctx, logger, nk, payload) => {
  let params = {};
  try {
    params = JSON.parse(payload || "{}");
  } catch (e) {
  }
  const roomId = params.roomId || "";
  if (!roomId) return JSON.stringify({ error: "roomId required" });
  try {
    nk.storageDelete([{
      collection: COLLECTION_ROOMS,
      key: roomId,
      userId: SYSTEM_USER_ID
    }]);
    return JSON.stringify({ ok: true });
  } catch (e) {
    logger.error("rpcDeleteRoom error: %s", e);
    return JSON.stringify({ error: "Failed to delete room" });
  }
};
var rpcGetRoomByCode = (ctx, logger, nk, payload) => {
  logger.info("rpcGetRoomByCode payload raw: %s", payload || "<empty>");
  const params = parsePayloadObject(payload);
  const code = (params.code || "").trim().toUpperCase();
  logger.info("rpcGetRoomByCode parsed code: %s", code || "<empty>");
  if (!code) return JSON.stringify({ error: "code required" });
  try {
    const result = nk.storageList(SYSTEM_USER_ID, COLLECTION_ROOMS, 100, "");
    for (let i = 0; i < (result.objects || []).length; i++) {
      const obj = (result.objects || [])[i];
      try {
        const room = typeof obj.value === "string" ? JSON.parse(obj.value) : obj.value;
        if (room.code === code && room.status === "waiting" && Date.now() - room.createdAt < 30 * 60 * 1e3) {
          return JSON.stringify({ room });
        }
      } catch (e) {
      }
    }
    return JSON.stringify({ error: "Room code not found" });
  } catch (e) {
    logger.error("rpcGetRoomByCode error: %s", e);
    return JSON.stringify({ error: "Failed to lookup room code" });
  }
};

// src/main.ts
function InitModule(ctx, logger, nk, initializer) {
  initializer.registerMatch(MODULE_NAME, {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLeave: matchLeave,
    matchLoop: matchLoop,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal
  });
  initializer.registerMatchmakerMatched(matchmakerMatched);
  initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
  initializer.registerRpc("get_my_profile", rpcGetMyProfile);
  initializer.registerRpc("create_room", rpcCreateRoom);
  initializer.registerRpc("list_rooms", rpcListRooms);
  initializer.registerRpc("mark_room_full", rpcMarkRoomFull);
  initializer.registerRpc("delete_room", rpcDeleteRoom);
  initializer.registerRpc("get_room_by_code", rpcGetRoomByCode);
  initializer.registerRpc("set_display_name", rpcSetDisplayName);
  initializer.registerRpc("get_display_name", rpcGetDisplayName);
  initializer.registerRpc("register_user", rpcRegisterUser);
  initializer.registerRpc("mark_guest", rpcMarkGuest);
  try {
    nk.leaderboardCreate(LEADERBOARD_WINS, false, "desc", "incr", "", {});
  } catch (e) {
  }
  try {
    nk.leaderboardCreate(LEADERBOARD_LOSSES, false, "desc", "incr", "", {});
  } catch (e) {
  }
  try {
    nk.leaderboardCreate(LEADERBOARD_STREAK, false, "desc", "best", "", {});
  } catch (e) {
  }
  try {
    nk.leaderboardCreate(LEADERBOARD_DRAWS, false, "desc", "incr", "", {});
  } catch (e) {
  }
  logger.info("TicTacToe module loaded \u2014 modular build");
}
!InitModule && InitModule.bind(null);
