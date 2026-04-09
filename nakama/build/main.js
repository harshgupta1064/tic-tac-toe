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
var COLLECTION_ROOMS = "rooms";
var MODULE_NAME = "tictactoe";
var SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
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
    turnLimitTicks: 30,
    roomId: typeof params["roomId"] === "string" ? params["roomId"] : "",
    emptySinceTick: -1,
    rematchRequestedBy: "",
    rematchRequestTick: 0,
    isRematch: false
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
  initializer.registerRpc("create_room", rpcCreateRoom);
  initializer.registerRpc("list_rooms", rpcListRooms);
  initializer.registerRpc("mark_room_full", rpcMarkRoomFull);
  initializer.registerRpc("delete_room", rpcDeleteRoom);
  initializer.registerRpc("get_room_by_code", rpcGetRoomByCode);
  logger.info("TicTacToe module loaded \u2014 modular build");
}
!InitModule && InitModule.bind(null);
