import {
  OpCode, WIN_LINES, MODULE_NAME,
  MatchState, MoveMessage,
  COLLECTION_ROOMS, SYSTEM_USER_ID,
} from "../models/types";
import { writeMatchResult } from "../utils/leaderboard";

function checkWinner(board: string[]): string | null {
  for (let i = 0; i < WIN_LINES.length; i++) {
    const line = WIN_LINES[i];
    const a = line[0], b = line[1], c = line[2];
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every((cell) => cell !== "")) return "draw";
  return null;
}

function matchInit(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: { [key: string]: string }) {
  const mode = (params["mode"] === "timed") ? "timed" : "classic";
  const tickRate = 1;
  const state: MatchState = {
    board: ["","","","","","","","",""],
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
  };
  logger.info("Match initialized, mode: %s", mode);
  return { state, tickRate, label: JSON.stringify({ mode }) };
}

function matchJoinAttempt(
  ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: MatchState, presence: nkruntime.Presence, metadata: { [key: string]: string }
) {
  if (state.gameOver) return { state, accept: false };
  if (Object.keys(state.presences).length >= 2) return { state, accept: false };
  return { state, accept: true };
}

function matchJoin(
  ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: MatchState, presences: nkruntime.Presence[]
) {
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
      mode: state.mode,
    });
    dispatcher.broadcastMessage(OpCode.READY, readyMsg);
    dispatcher.broadcastMessage(OpCode.STATE, readyMsg);
  }
  return { state };
}

function matchLeave(
  ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: MatchState, presences: nkruntime.Presence[]
) {
  for (let i = 0; i < presences.length; i++) {
    const presence = presences[i];
    delete state.presences[presence.userId];
    delete state.playerNames[presence.userId];
    logger.info("Player left: %s", presence.userId);

    const gameWasInProgress = !state.gameOver && Object.keys(state.marks).length === 2 && (presence.userId in state.marks);
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
            reason: "forfeit",
          }),
          remainingPresence ? [remainingPresence] : undefined
        );
        writeMatchResult(
          nk, logger, state,
          remainingUserId, presence.userId,
          state.presences[remainingUserId]?.username || "",
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

function matchLoop(
  ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: MatchState, messages: nkruntime.MatchMessage[]
) {
  const presenceCount = Object.keys(state.presences).length;
  if (presenceCount === 0) {
    if (state.emptySinceTick < 0) state.emptySinceTick = tick;
    if (tick - state.emptySinceTick >= 60) {
      if (state.roomId) {
        try {
          nk.storageDelete([{ collection: COLLECTION_ROOMS, key: state.roomId, userId: SYSTEM_USER_ID } as any]);
        } catch {}
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
      let move: MoveMessage;
      try { move = JSON.parse(nk.binaryToString(message.data)); } catch {
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
          const winnerUserId = Object.keys(state.marks).find((uid) => state.marks[uid] === result)!;
          const loserUserId = Object.keys(state.marks).find((uid) => state.marks[uid] !== result)!;
          state.winner = winnerUserId;
          dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
            board: state.board,
            winner: winnerUserId,
            winnerMark: result,
            reason: "win",
          }));
          const winnerUsername = state.presences[winnerUserId]?.username || "";
          const loserUsername = state.presences[loserUserId]?.username || "";
          writeMatchResult(nk, logger, state, winnerUserId, loserUserId, winnerUsername, loserUsername);
        }
      } else {
        const userIds = Object.keys(state.marks);
        state.currentTurn = userIds.find((uid) => uid !== senderId)!;
        state.turnStartTick = tick;
        dispatcher.broadcastMessage(OpCode.STATE, JSON.stringify({
          board: state.board,
          playerNames: state.playerNames,
          currentTurn: state.currentTurn,
          lastMove: { position: pos, mark: state.marks[senderId] },
        }));
      }
    }

    if (message.opCode === OpCode.REMATCH_REQUEST) {
      if (!state.gameOver || state.rematchRequestedBy) continue;
      state.rematchRequestedBy = senderId;
      state.rematchRequestTick = tick;
      const otherUserId = Object.keys(state.presences).find((uid) => uid !== senderId);
      const otherPresence = otherUserId ? state.presences[otherUserId] : undefined;
      if (otherPresence) dispatcher.broadcastMessage(OpCode.REMATCH_REQUEST, JSON.stringify({ requestedBy: senderId }), [otherPresence]);
    }

    if (message.opCode === OpCode.REMATCH_ACCEPT) {
      if (!state.rematchRequestedBy || senderId === state.rematchRequestedBy || !state.gameOver) continue;
      state.board = ["","","","","","","","",""];
      state.winner = null;
      state.gameOver = false;
      state.isRematch = true;
      state.rematchRequestedBy = "";
      state.rematchRequestTick = 0;
      const userIds = Object.keys(state.marks);
      const prevX = userIds.find((uid) => state.marks[uid] === "X")!;
      const prevO = userIds.find((uid) => state.marks[uid] === "O")!;
      state.marks[prevX] = "O";
      state.marks[prevO] = "X";
      state.currentTurn = prevO;
      state.turnStartTick = tick;
      dispatcher.broadcastMessage(OpCode.REMATCH_START, JSON.stringify({
        board: state.board,
        marks: state.marks,
        playerNames: state.playerNames,
        currentTurn: state.currentTurn,
        mode: state.mode,
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

  if (state.gameOver && state.rematchRequestedBy && (tick - state.rematchRequestTick) >= 30) {
    dispatcher.broadcastMessage(OpCode.REMATCH_DECLINE, JSON.stringify({ reason: "timeout" }));
    state.rematchRequestedBy = "";
    state.rematchRequestTick = 0;
  }

  if (state.mode === "timed" && !state.gameOver) {
    // Enforce timed mode limit even for matches created before config changes.
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
      const winnerUserId = Object.keys(state.marks).find((uid) => uid !== loserUserId)!;
      state.winner = winnerUserId;
      dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
        board: state.board,
        winner: winnerUserId,
        winnerMark: state.marks[winnerUserId],
        reason: "timeout",
        timedOutPlayer: loserUserId,
      }));
      const winnerUsername = state.presences[winnerUserId]?.username || "";
      const loserUsername = state.presences[loserUserId]?.username || "";
      writeMatchResult(nk, logger, state, winnerUserId, loserUserId, winnerUsername, loserUsername);
    }
  }

  return { state };
}

function matchTerminate(
  ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: MatchState, graceSeconds: number
) {
  logger.info("Match terminated");
  return { state };
}

function matchSignal(
  ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: MatchState, data: string
) {
  return { state, data: "" };
}

export const matchmakerMatched: nkruntime.MatchmakerMatchedFunction = (
  ctx, logger, nk, matches
) => {
  const mode = (matches[0]?.properties["mode"] as string) || "classic";
  try {
    const matchId = nk.matchCreate(MODULE_NAME, { mode } as any);
    logger.info("Matchmaker created match %s (mode: %s)", matchId, mode);
    return matchId;
  } catch (e) {
    logger.error("matchmakerMatched error: %s", e);
    return undefined;
  }
};

export {
  matchInit, matchJoinAttempt, matchJoin, matchLeave,
  matchLoop, matchTerminate, matchSignal,
};
