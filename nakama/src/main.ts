// Nakama TypeScript Runtime Module
// IMPORTANT: This runs in Nakama's sandboxed JS engine, NOT Node.js.
// No npm imports, no fetch, no async/await for RPC functions.
/// <reference types="nakama-common" />
const moduleName = 'tictactoe';

// ─── Op Codes ─────────────────────────────────────────────────────────────────
const OpCode = {
  MOVE: 1,          // client → server: player makes a move
  STATE: 2,         // server → client: full game state update
  REJECTED: 3,      // server → client: move was invalid
  GAME_OVER: 4,     // server → client: game ended (win/draw/forfeit)
  READY: 5,         // server → client: both players joined, game starting
  TICK: 6,          // server → client: timer tick (remaining seconds)
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface MatchState {
  board: string[];           // 9 cells: '' | 'X' | 'O'
  marks: { [userId: string]: 'X' | 'O' };
  currentTurn: string;       // userId whose turn it is
  winner: string | null;     // userId of winner, or 'draw'
  gameOver: boolean;
  presences: { [userId: string]: nkruntime.Presence };
  mode: 'classic' | 'timed';
  turnStartTick: number;     // loop tick count when turn started
  tickRate: number;          // ticks per second
  turnLimitTicks: number;    // 30s * tickRate
}

interface MoveMessage {
  position: number; // 0-8
}

// ─── Win Detection ────────────────────────────────────────────────────────────
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6],         // diagonals
];

function checkWinner(board: string[]): string | null {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a]; // returns 'X' or 'O'
    }
  }
  if (board.every(cell => cell !== '')) return 'draw';
  return null;
}

// ─── Match Handler ────────────────────────────────────────────────────────────
const matchInit: nkruntime.MatchInitFunction<MatchState> = (
  ctx, logger, nk, params
) => {
  const mode = (params['mode'] === 'timed') ? 'timed' : 'classic';
  const tickRate = 1; // 1 tick per second (sufficient for turn timer)

  const state: MatchState = {
    board: ['','','','','','','','',''],
    marks: {},
    currentTurn: '',
    winner: null,
    gameOver: false,
    presences: {},
    mode,
    turnStartTick: 0,
    tickRate,
    turnLimitTicks: 30, // 30 seconds
  };

  logger.info('Match initialized, mode: %s', mode);
  return { state, tickRate, label: JSON.stringify({ mode }) };
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<MatchState> = (
  ctx, logger, nk, dispatcher, tick, state, presence, metadata
) => {
  if (state.gameOver) return { state, accept: false };
  if (Object.keys(state.presences).length >= 2) return { state, accept: false };
  return { state, accept: true };
};

const matchJoin: nkruntime.MatchJoinFunction<MatchState> = (
  ctx, logger, nk, dispatcher, tick, state, presences
) => {
  for (const presence of presences) {
    state.presences[presence.userId] = presence;
    logger.info('Player joined: %s', presence.userId);
  }

  // Assign marks when both players are present
  if (Object.keys(state.presences).length === 2) {
    const userIds = Object.keys(state.presences);
    state.marks[userIds[0]] = 'X';
    state.marks[userIds[1]] = 'O';
    state.currentTurn = userIds[0]; // X always goes first
    state.turnStartTick = tick;

    const readyMsg = JSON.stringify({
      board: state.board,
      marks: state.marks,
      currentTurn: state.currentTurn,
      mode: state.mode,
    });

    dispatcher.broadcastMessage(OpCode.READY, readyMsg);
    dispatcher.broadcastMessage(OpCode.STATE, readyMsg);
    logger.info('Game started. X=%s, O=%s', userIds[0], userIds[1]);
  }

  return { state };
};

const matchLeave: nkruntime.MatchLeaveFunction<MatchState> = (
  ctx, logger, nk, dispatcher, tick, state, presences
) => {
  for (const presence of presences) {
    delete state.presences[presence.userId];
    logger.info('Player left: %s', presence.userId);

    // If game is still ongoing, the remaining player wins by forfeit
    if (!state.gameOver && Object.keys(state.presences).length > 0) {
      state.gameOver = true;
      const remainingUserId = Object.keys(state.presences)[0];
      state.winner = remainingUserId;

      const gameOverMsg = JSON.stringify({
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
  return { state };
};

const matchLoop: nkruntime.MatchLoopFunction<MatchState> = (
  ctx, logger, nk, dispatcher, tick, state, messages
) => {
  // If less than 2 players, wait
  if (Object.keys(state.presences).length < 2) return { state };
  if (state.gameOver) return null; // terminate match

  // ── Process incoming move messages ──────────────────────────────────────────
  for (const message of messages) {
    if (message.opCode !== OpCode.MOVE) continue;

    const senderId = message.sender.userId;

    // Validate: is it this player's turn?
    if (senderId !== state.currentTurn) {
      dispatcher.broadcastMessage(
        OpCode.REJECTED,
        JSON.stringify({ reason: 'Not your turn' }),
        [message.sender]
      );
      continue;
    }

    let move: MoveMessage;
    try {
      move = JSON.parse(nk.binaryToString(message.data));
    } catch (e) {
      dispatcher.broadcastMessage(
        OpCode.REJECTED,
        JSON.stringify({ reason: 'Invalid message format' }),
        [message.sender]
      );
      continue;
    }

    const pos = move.position;

    // Validate: position in range and cell empty
    if (pos < 0 || pos > 8 || state.board[pos] !== '') {
      dispatcher.broadcastMessage(
        OpCode.REJECTED,
        JSON.stringify({ reason: 'Invalid move position' }),
        [message.sender]
      );
      continue;
    }

    // Apply move
    state.board[pos] = state.marks[senderId];

    // Check win/draw
    const result = checkWinner(state.board);

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
      } else {
        // result is 'X' or 'O' — find whose userId it is
        const winnerUserId = Object.keys(state.marks).find(
          uid => state.marks[uid] === result
        )!;
        const loserUserId = Object.keys(state.marks).find(
          uid => state.marks[uid] !== result
        )!;
        state.winner = winnerUserId;

        dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
          board: state.board,
          winner: winnerUserId,
          winnerMark: result,
          reason: 'win',
        }));
        writeLeaderboard(nk, logger, state, winnerUserId, loserUserId);
      }
    } else {
      // Switch turns
      const userIds = Object.keys(state.marks);
      state.currentTurn = userIds.find(uid => uid !== senderId)!;
      state.turnStartTick = tick;

      dispatcher.broadcastMessage(OpCode.STATE, JSON.stringify({
        board: state.board,
        currentTurn: state.currentTurn,
        lastMove: { position: pos, mark: state.marks[senderId] },
      }));
    }
  }

  // ── Timer check (timed mode only) ───────────────────────────────────────────
  if (state.mode === 'timed' && !state.gameOver) {
    const elapsed = tick - state.turnStartTick;
    const remaining = state.turnLimitTicks - elapsed;

    if (remaining >= 0) {
      // Broadcast tick every second to current player
      const currentPresence = state.presences[state.currentTurn];
      if (currentPresence) {
        dispatcher.broadcastMessage(
          OpCode.TICK,
          JSON.stringify({ remaining }),
          [currentPresence]
        );
      }
    }

    if (elapsed >= state.turnLimitTicks) {
      // Time's up — forfeit current player
      state.gameOver = true;
      const loserUserId = state.currentTurn;
      const winnerUserId = Object.keys(state.marks).find(uid => uid !== loserUserId)!;
      state.winner = winnerUserId;

      dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
        board: state.board,
        winner: winnerUserId,
        winnerMark: state.marks[winnerUserId],
        reason: 'timeout',
        timedOutPlayer: loserUserId,
      }));
      writeLeaderboard(nk, logger, state, winnerUserId, loserUserId);
    }
  }

  return { state };
};

const matchTerminate: nkruntime.MatchTerminateFunction<MatchState> = (
  ctx, logger, nk, dispatcher, tick, state, graceSeconds
) => {
  logger.info('Match terminated');
  return { state };
};

const matchSignal: nkruntime.MatchSignalFunction<MatchState> = (
  ctx, logger, nk, dispatcher, tick, state, data
) => {
  return { state, data: '' };
};

// ─── Leaderboard Helpers ──────────────────────────────────────────────────────
const LEADERBOARD_ID = 'tictactoe_wins';

function ensureLeaderboard(nk: nkruntime.Nakama, logger: nkruntime.Logger) {
  try {
    nk.leaderboardCreate(LEADERBOARD_ID, false, 'desc' as any, 'incr' as any, '', false as any);
  } catch (e) {
    // Already exists — safe to ignore
  }
}

function writeLeaderboard(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  state: MatchState,
  winnerUserId: string,
  loserUserId: string
) {
  try {
    ensureLeaderboard(nk, logger);
    nk.leaderboardRecordWrite(LEADERBOARD_ID, winnerUserId, '', 1, 0, {});
  } catch (e) {
    logger.error('Failed to write leaderboard: %s', e);
  }
}

function writeLeaderboardDraw(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  state: MatchState
) {
  // No leaderboard change on draw
}

// ─── RPC: Get Leaderboard ─────────────────────────────────────────────────────
const rpcGetLeaderboard: nkruntime.RpcFunction = (ctx, logger, nk, payload) => {
  try {
    const records = nk.leaderboardRecordsList(LEADERBOARD_ID, [], 10, '' as any, '' as any);
    return JSON.stringify({
      records: (records.records || []).map(r => ({
        userId: r.ownerId,
        username: r.username,
        wins: r.score,
        rank: r.rank,
      }))
    });
  } catch (e) {
    logger.error('rpcGetLeaderboard error: %s', e);
    return JSON.stringify({ records: [] });
  }
};

// ─── Matchmaker Matched ───────────────────────────────────────────────────────
// Called by Nakama when 2 players are matched via matchmaker
const matchmakerMatched: nkruntime.MatchmakerMatchedFunction = (
  ctx, logger, nk, matches
) => {
  const mode = matches[0]?.properties['mode'] as string || 'classic';

  try {
    const matchId = nk.matchCreate(moduleName, { mode });
    logger.info('Matchmaker created match %s (mode: %s)', matchId, mode);
    return matchId;
  } catch (e) {
    logger.error('matchmakerMatched error: %s', e);
    return undefined;
  }
};

// ─── Module Init ─────────────────────────────────────────────────────────────
const InitModule: nkruntime.InitModule = (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
) => {
  initializer.registerMatch(moduleName, {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal,
  });

  initializer.registerMatchmakerMatched(matchmakerMatched);
  initializer.registerRpc('get_leaderboard', rpcGetLeaderboard);

  // Ensure leaderboard exists at startup
  try {
    nk.leaderboardCreate(LEADERBOARD_ID, false, 'desc' as any, 'incr' as any, '', false as any);
  } catch (e) {
    // Already exists
  }

  logger.info('TicTacToe module loaded successfully');
};

// Required export
!InitModule && (InitModule as any).bind(null);
