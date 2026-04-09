import React, {
  createContext, useContext, useState, useRef, useCallback
} from 'react';
import { Session, Socket, Match } from '@heroiclabs/nakama-js';
import {
  client, createSocket,
  loginWithUsername, saveSession, clearSession, restoreSession,
} from '../lib/nakama';

export type Screen = 'auth' | 'lobby' | 'rooms' | 'matchmaking' | 'game' | 'gameover';
export type GameMode = 'classic' | 'timed';

export interface GameState {
  board: string[];
  marks: { [userId: string]: 'X' | 'O' };
  playerNames: { [userId: string]: string };
  currentTurn: string;
  winner: string | null;
  winnerMark: string | null;
  reason: string | null;
  mode: GameMode;
}



export interface PlayerSessionStats {
  wins: number;
  losses: number;
  draws: number;
  score: number;
}
export type SessionStats = Record<string, PlayerSessionStats>;

export interface Room {
  id: string;
  name: string;
  mode: string;
  hostUsername: string;
  matchId: string;
  status: 'waiting' | 'full';
  createdAt: number;
}

interface GameContextType {
  screen: Screen;
  session: Session | null;
  match: Match | null;
  gameState: GameState;
  myUserId: string;
  displayName: string;
  timerRemaining: number;
  activeRoomCode: string;
  activeRoomId: string;
  rooms: Room[];
  statusMessage: string;
  errorMessage: string;
  joinAsPlayer: (username: string) => Promise<void>;
  restoreAuth: () => Promise<void>;
  logout: () => Promise<void>;
  findMatch: (mode: GameMode) => Promise<void>;
  makeMove: (position: number) => void;
  leaveMatch: () => void;

  fetchRooms: () => Promise<void>;
  createRoom: (name: string, mode: GameMode) => Promise<void>;
  joinRoom: (room: Room) => Promise<void>;
  joinRoomByCode: (code: string) => Promise<void>;
  deleteActiveRoom: () => Promise<void>;
  requestRematch: () => void;
  acceptRematch: () => void;
  declineRematch: () => void;
  rematchState: 'idle' | 'requesting' | 'incoming' | 'declined' | 'declined_timeout';
  rematchRequesterId: string;
  sessionStats: SessionStats;
  setScreen: (s: Screen) => void;
}

const defaultGameState: GameState = {
  board: ['','','','','','','','',''],
  marks: {},
  playerNames: {},
  currentTurn: '',
  winner: null,
  winnerMark: null,
  reason: null,
  mode: 'classic',
};

const OpCode = {
  MOVE: 1, STATE: 2, REJECTED: 3, GAME_OVER: 4, READY: 5, TICK: 6,
  REMATCH_REQUEST: 7, REMATCH_ACCEPT: 8, REMATCH_DECLINE: 9, REMATCH_START: 10,
  OPPONENT_LEFT_LOBBY: 11,
};

const GameContext = createContext<GameContextType | null>(null);

function parseRpcPayload(payload: unknown, fallback: Record<string, unknown>) {
  if (payload == null || payload === '') return fallback;
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      if (typeof parsed === 'string') {
        try { return JSON.parse(parsed); } catch { return fallback; }
      }
      return (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : fallback;
    } catch {
      return fallback;
    }
  }
  if (typeof payload === 'object') return payload as Record<string, unknown>;
  return fallback;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen]                     = useState<Screen>('auth');
  const [session, setSession]                   = useState<Session | null>(null);
  const [match, setMatch]                       = useState<Match | null>(null);
  const [gameState, setGameState]               = useState<GameState>(defaultGameState);
  const [myUserId, setMyUserId]                 = useState('');
  const [displayName, setDisplayName]           = useState('');
  const [timerRemaining, setTimerRemaining]     = useState(30);
  const [activeRoomCode, setActiveRoomCode]     = useState('');
  const [activeRoomId, setActiveRoomId]         = useState('');
  const [rooms, setRooms]                       = useState<Room[]>([]);
  const [statusMessage, setStatusMessage]       = useState('');
  const [errorMessage, setErrorMessage]         = useState('');
  const [rematchState, setRematchState] = useState<'idle' | 'requesting' | 'incoming' | 'declined' | 'declined_timeout'>('idle');
  const [rematchRequesterId, setRematchRequesterId] = useState('');
  const [sessionStats, setSessionStats] = useState<SessionStats>({});

  const socketRef  = useRef<Socket | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const gameStateRef = useRef(gameState);

  React.useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // ── Socket setup ───────────────────────────────────────────────────────────
  const setupSocket = useCallback(async (sess: Session) => {
    if (socketRef.current) {
      try { await socketRef.current.disconnect(false); } catch (_) {}
    }

    const sock = await createSocket(sess);
    socketRef.current  = sock;
    sessionRef.current = sess;
    setSession(sess);
    setMyUserId(sess.user_id!);
    setDisplayName(sess.username || '');

    sock.onmatchdata = (matchData) => {
      const opCode = matchData.op_code;
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(new TextDecoder().decode(matchData.data as Uint8Array));
      } catch (_) {}

      if (opCode === OpCode.READY || opCode === OpCode.STATE) {
        setGameState(prev => ({
          ...prev,
          board:       (data.board       as string[])           || prev.board,
          marks:       (data.marks       as GameState['marks']) || prev.marks,
          playerNames: (data.playerNames as GameState['playerNames']) || prev.playerNames,
          currentTurn: (data.currentTurn as string)             || prev.currentTurn,
          mode:        (data.mode        as GameMode)           || prev.mode,
        }));
        if (opCode === OpCode.READY) setScreen('game');
      }

      if (opCode === OpCode.GAME_OVER) {
        setGameState(prev => ({
          ...prev,
          board:      (data.board      as string[]) || prev.board,
          winner:     (data.winner     as string)   || null,
          winnerMark: (data.winnerMark as string)   || null,
          reason:     (data.reason     as string)   || null,
        }));
        
        const winnerId = data.winner as string;
        const isDraw = winnerId === 'draw';
        const uids = Object.keys(gameStateRef.current.marks);
        setSessionStats(prev => {
          const next = { ...prev };
          for (const uid of uids) {
            if (!next[uid]) next[uid] = { wins: 0, losses: 0, draws: 0, score: 0 };
            const curr = { ...next[uid] };
            if (isDraw) {
              curr.draws += 1;
              curr.score += 100;
            } else if (uid === winnerId) {
              curr.wins += 1;
              curr.score += 200;
            } else {
              curr.losses += 1;
            }
            next[uid] = curr;
          }
          return next;
        });
        
        setScreen('gameover');
      }

      if (opCode === OpCode.TICK) {
        setTimerRemaining((data.remaining as number) ?? 10);
      }

      if (opCode === OpCode.REJECTED) {
        setStatusMessage((data.reason as string) || 'Move rejected');
        setTimeout(() => setStatusMessage(''), 2000);
      }

      if (opCode === OpCode.REMATCH_REQUEST) {
        setRematchRequesterId((data.requestedBy as string) || '');
        setRematchState('incoming');
      }

      if (opCode === OpCode.REMATCH_DECLINE) {
        setRematchState((data.reason as string) === 'timeout' ? 'declined_timeout' : 'declined');
        setTimeout(() => {
          setRematchState('idle');
          setRematchRequesterId('');
          setMatch(null);
          setGameState(defaultGameState);
          setScreen('lobby');
        }, 4000);
      }

      if (opCode === OpCode.REMATCH_START) {
        setGameState(prev => ({
          ...prev,
          board: (data.board as string[]) || ['','','','','','','','',''],
          marks: (data.marks as GameState['marks']) || prev.marks,
          playerNames: (data.playerNames as GameState['playerNames']) || prev.playerNames,
          currentTurn: (data.currentTurn as string) || '',
          mode: (data.mode as GameMode) || prev.mode,
          winner: null,
          winnerMark: null,
          reason: null,
        }));
        setRematchState('idle');
        setRematchRequesterId('');
        setTimerRemaining(10);
        setScreen('game');
      }

      if (opCode === OpCode.OPPONENT_LEFT_LOBBY) {
        setMatch(null);
        setRematchState('idle');
        setRematchRequesterId('');
        setGameState(defaultGameState);
        setSessionStats({});
        setScreen('lobby');
      }
    };

    sock.onmatchpresence = (e) => {
      if (e.leaves?.length) {
        setMatch(null);
        setRematchState('idle');
        setRematchRequesterId('');
        setGameState(defaultGameState);
        setSessionStats({});
        setScreen('lobby');
        setStatusMessage('Opponent disconnected');
      }
    };

    sock.ondisconnect = () => {
      setStatusMessage('Disconnected from server');
      setScreen('lobby');
    };

    setScreen('lobby');
    setErrorMessage('');
    setStatusMessage('');
  }, []);

  // ── Join as player (username only, no password) ────────────────────────────
  const joinAsPlayer = useCallback(async (username: string) => {
    setErrorMessage('');
    try {
      const sess = await loginWithUsername(username.trim());
      saveSession(sess, username.trim());
      setDisplayName(username.trim());
      await setupSocket(sess);
    } catch (e: unknown) {
      const msg = String((e as { message?: string })?.message ?? e ?? '');
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror')) {
        setErrorMessage('Cannot reach server. Please ensure the backend is running.');
      } else {
        setErrorMessage('Could not connect. Please try again.');
      }
    }
  }, [setupSocket]);

  // ── Restore session on page reload ─────────────────────────────────────────
  const restoreAuth = useCallback(async () => {
    const restored = await restoreSession();
    if (!restored) return;
    try {
      await setupSocket(restored.session);
    } catch {
      clearSession();
    }
  }, [setupSocket]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    clearSession();
    if (socketRef.current) {
      socketRef.current.ondisconnect = () => {};
      socketRef.current.onmatchpresence = () => {};
      socketRef.current.onmatchdata = () => {};
      try { await socketRef.current.disconnect(true); } catch (_) {}
    }
    socketRef.current  = null;
    sessionRef.current = null;
    setSession(null);
    setMyUserId('');
    setDisplayName('');
    setMatch(null);
    setGameState(defaultGameState);
    setActiveRoomCode('');
    setActiveRoomId('');
    setRematchState('idle');
    setRematchRequesterId('');
    setSessionStats({});
    setScreen('auth');
  }, []);

  const findMatch = useCallback(async (mode: GameMode) => {
    const sock = socketRef.current;
    if (!sock) return;
    setScreen('matchmaking');
    setStatusMessage('Looking for opponent...');
    setActiveRoomCode('');
    setActiveRoomId('');
    setSessionStats({});
    setGameState({ ...defaultGameState, mode });
    setTimerRemaining(30);
    try {
      sock.onmatchmakermatched = async (matched) => {
        try {
          const m = await sock.joinMatch(matched.match_id || undefined, matched.token || undefined);
          setMatch(m);
          setStatusMessage('Opponent found! Starting...');
        } catch (e: unknown) {
          setStatusMessage('Failed to join match: ' +
            String((e as { message?: string })?.message ?? e));
          setScreen('lobby');
        }
      };
      await sock.addMatchmaker('*', 2, 2, { mode });
    } catch (e: unknown) {
      setStatusMessage('Matchmaking failed: ' +
        String((e as { message?: string })?.message ?? e));
      setScreen('lobby');
    }
  }, []);

  // ── Move ───────────────────────────────────────────────────────────────────
  const makeMove = useCallback((position: number) => {
    if (!socketRef.current || !match) return;
    const data = new TextEncoder().encode(JSON.stringify({ position }));
    socketRef.current.sendMatchState(match.match_id, OpCode.MOVE, data);
  }, [match]);

  // ── Leave match ────────────────────────────────────────────────────────────
  const leaveMatch = useCallback(async () => {
    if (!socketRef.current || !match) return;
    try { await socketRef.current.leaveMatch(match.match_id); } catch (_) {}
    setMatch(null);
    setRematchState('idle');
    setRematchRequesterId('');
    setGameState(defaultGameState);
    setSessionStats({});
    setScreen('lobby');
  }, [match]);



  // ── Rooms ──────────────────────────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    const sess = sessionRef.current;
    if (!sess) return;
    try {
      const result = await client.rpc(sess, 'list_rooms', {});
      const body = parseRpcPayload(result.payload, { rooms: [] }) as { rooms?: Room[] };
      setRooms(Array.isArray(body.rooms) ? body.rooms : []);
    } catch (e) {
      console.error('[rooms] fetch failed:', e);
    }
  }, []);

  const createRoom = useCallback(async (name: string, mode: GameMode) => {
    const sess = sessionRef.current;
    const sock = socketRef.current;
    if (!sess || !sock) return;
    setScreen('matchmaking');
    setStatusMessage('Creating room...');
    setActiveRoomCode('');
    setActiveRoomId('');
    setGameState({ ...defaultGameState, mode });
    setTimerRemaining(30);
    setSessionStats({});
    try {
      const result = await client.rpc(sess, 'create_room', { name, mode, hostUsername: displayName });
      const body = parseRpcPayload(result.payload, {}) as { error?: string; code?: string; roomId?: string; matchId?: string };
      if (body.error) throw new Error(body.error);
      setActiveRoomCode(body.code || '');
      setActiveRoomId(body.roomId || '');
      sock.onmatchmakermatched = () => {};
      setStatusMessage(`Room "${name}" ready — waiting for opponent...`);
      const m = await sock.joinMatch(body.matchId || '');
      setMatch(m);
    } catch (e: unknown) {
      setStatusMessage('Failed to create room: ' +
        String((e as { message?: string })?.message ?? e));
      setActiveRoomCode('');
      setActiveRoomId('');
      setScreen('lobby');
    }
  }, [displayName]);

  const joinRoom = useCallback(async (room: Room) => {
    const sess = sessionRef.current;
    const sock = socketRef.current;
    if (!sess || !sock) return;
    setScreen('matchmaking');
    setStatusMessage(`Joining "${room.name}"...`);
    setActiveRoomCode('');
    setActiveRoomId('');
    setGameState({ ...defaultGameState, mode: room.mode as GameMode });
    setTimerRemaining(30);
    setSessionStats({});
    try {
      sock.onmatchmakermatched = () => {};
      const m = await sock.joinMatch(room.matchId);
      setMatch(m);
      await client.rpc(sess, 'mark_room_full', { roomId: room.id });
      setStatusMessage('Joined! Starting game...');
    } catch (e: unknown) {
      setStatusMessage('Failed to join room: ' +
        String((e as { message?: string })?.message ?? e));
      setScreen('lobby');
    }
  }, []);

  const joinRoomByCode = useCallback(async (code: string) => {
    const sess = sessionRef.current;
    const sock = socketRef.current;
    if (!sess || !sock) {
      setStatusMessage('Please re-enter your name and retry.');
      return;
    }
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setStatusMessage('Please enter a room code.');
      return;
    }
    setScreen('matchmaking');
    setStatusMessage(`Joining room ${normalized}...`);
    setActiveRoomCode('');
    setActiveRoomId('');
    try {
      const result = await client.rpc(sess, 'get_room_by_code', { code: normalized });
      const body = parseRpcPayload(result.payload, {}) as { error?: string; room?: Room };
      if (body.error) throw new Error(body.error);
      if (!body.room) throw new Error('Room not found');
      const room = body.room as Room;
      sock.onmatchmakermatched = () => {};
      setGameState({ ...defaultGameState, mode: room.mode as GameMode });
      setTimerRemaining(30);
      setSessionStats({});
      const m = await sock.joinMatch(room.matchId);
      setMatch(m);
      await client.rpc(sess, 'mark_room_full', { roomId: room.id });
      setStatusMessage(`Joined room ${normalized}. Starting game...`);
    } catch (e: unknown) {
      setStatusMessage('Failed to join by code: ' + String((e as { message?: string })?.message ?? 'Invalid room code'));
      setScreen('rooms');
    }
  }, []);

  const deleteActiveRoom = useCallback(async () => {
    const sess = sessionRef.current;
    if (!sess || !activeRoomId) {
      setScreen('lobby');
      return;
    }
    try {
      await client.rpc(sess, 'delete_room', { roomId: activeRoomId });
    } catch {}
    try {
      if (socketRef.current && match) {
        await socketRef.current.leaveMatch(match.match_id);
      }
    } catch {}
    setMatch(null);
    setActiveRoomCode('');
    setActiveRoomId('');
    setStatusMessage('');
    setRematchState('idle');
    setRematchRequesterId('');
    setGameState(defaultGameState);
    setSessionStats({});
    setScreen('lobby');
  }, [activeRoomId, match]);

  const requestRematch = useCallback(() => {
    if (!socketRef.current || !match) return;
    setRematchState('requesting');
    const data = new TextEncoder().encode(JSON.stringify({}));
    socketRef.current.sendMatchState(match.match_id, OpCode.REMATCH_REQUEST, data);
  }, [match]);

  const acceptRematch = useCallback(() => {
    if (!socketRef.current || !match) return;
    setRematchState('idle');
    const data = new TextEncoder().encode(JSON.stringify({}));
    socketRef.current.sendMatchState(match.match_id, OpCode.REMATCH_ACCEPT, data);
  }, [match]);

  const declineRematch = useCallback(async () => {
    if (!socketRef.current || !match) return;
    setRematchState('idle');
    setRematchRequesterId('');
    const data = new TextEncoder().encode(JSON.stringify({}));
    socketRef.current.sendMatchState(match.match_id, OpCode.REMATCH_DECLINE, data);
    try { await socketRef.current.leaveMatch(match.match_id); } catch {}
    setMatch(null);
    setGameState(defaultGameState);
    setSessionStats({});
    setScreen('lobby');
  }, [match]);

  return (
    <GameContext.Provider value={{
      screen, session, match, gameState, myUserId, displayName,
      timerRemaining, activeRoomCode, activeRoomId, rooms,
      statusMessage, errorMessage,
      joinAsPlayer, restoreAuth, logout,
      findMatch, makeMove, leaveMatch,
      fetchRooms, createRoom, joinRoom, joinRoomByCode, deleteActiveRoom,
      requestRematch, acceptRematch, declineRematch, rematchState, rematchRequesterId,
      sessionStats, setScreen,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
