import React, {
  createContext, useContext, useState, useRef, useCallback
} from 'react';
import { Session, Socket, Match } from '@heroiclabs/nakama-js';
import {
  client, createSocket,
  registerAccount, loginAccount, loginGuest,
  saveSession, clearSession, restoreSession,
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

export interface LeaderboardEntry {
  userId: string;
  username: string;
  wins: number;
  losses: number;
  draws: number;
  bestStreak: number;
  winRate: number;
  rank: number;
}

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
  isGuest: boolean;
  timerRemaining: number;
  activeRoomCode: string;
  activeRoomId: string;
  leaderboard: LeaderboardEntry[];
  myLeaderboardRecord: LeaderboardEntry | null;
  rooms: Room[];
  statusMessage: string;
  errorMessage: string;
  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  restoreAuth: () => Promise<void>;
  logout: () => Promise<void>;
  findMatch: (mode: GameMode) => Promise<void>;
  makeMove: (position: number) => void;
  leaveMatch: () => void;
  fetchLeaderboard: () => Promise<void>;
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

function getAuthErrorMessage(kind: 'login' | 'register' | 'guest', e: unknown): string {
  const err = e as { message?: string; code?: number; statusCode?: number };
  const raw = String(err?.message ?? e ?? '');
  const msg = raw.toLowerCase();
  const code = err?.code ?? err?.statusCode;

  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed')
  ) {
    return 'Cannot reach server. Please ensure backend is running and try again.';
  }

  if (kind === 'register') {
    if (code === 409 || msg.includes('already') || msg.includes('exists') || msg.includes('taken')) {
      return 'Username already exists. Try a different username.';
    }
    if (code === 400 || msg.includes('invalid')) {
      return 'Invalid registration details. Please check username/password format.';
    }
    return 'Registration failed. Please try again.';
  }

  if (kind === 'login') {
    if (code === 401 || code === 404 || msg.includes('credentials') || msg.includes('not found') || msg.includes('password')) {
      return 'Username or password is wrong.';
    }
    return 'Login failed. Please try again.';
  }

  return 'Could not start guest session. Please try again.';
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen]                     = useState<Screen>('auth');
  const [session, setSession]                   = useState<Session | null>(null);
  const [match, setMatch]                       = useState<Match | null>(null);
  const [gameState, setGameState]               = useState<GameState>(defaultGameState);
  const [myUserId, setMyUserId]                 = useState('');
  const [displayName, setDisplayName]           = useState('');
  const [isGuest, setIsGuest]                   = useState(false);
  const [timerRemaining, setTimerRemaining]     = useState(10);
  const [activeRoomCode, setActiveRoomCode]     = useState('');
  const [activeRoomId, setActiveRoomId]         = useState('');
  const [leaderboard, setLeaderboard]           = useState<LeaderboardEntry[]>([]);
  const [myLeaderboardRecord, setMyLeaderboardRecord] = useState<LeaderboardEntry | null>(null);
  const [rooms, setRooms]                       = useState<Room[]>([]);
  const [statusMessage, setStatusMessage]       = useState('');
  const [errorMessage, setErrorMessage]         = useState('');
  const [rematchState, setRematchState] = useState<'idle' | 'requesting' | 'incoming' | 'declined' | 'declined_timeout'>('idle');
  const [rematchRequesterId, setRematchRequesterId] = useState('');

  const socketRef  = useRef<Socket | null>(null);
  const sessionRef = useRef<Session | null>(null);

  // ── Socket setup ─────────────────────────────────────────────────────────
  const setupSocket = useCallback(async (sess: Session, guest: boolean) => {
    if (socketRef.current) {
      try { socketRef.current.disconnect(); } catch (_) {}
    }

    const sock = await createSocket(sess);
    socketRef.current  = sock;
    sessionRef.current = sess;
    setSession(sess);
    setMyUserId(sess.user_id!);
    setDisplayName(sess.username || '');
    setIsGuest(guest);

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
        setScreen('lobby');
      }
    };

    sock.onmatchpresence = (e) => {
      if (e.leaves?.length) {
        setMatch(null);
        setRematchState('idle');
        setRematchRequesterId('');
        setGameState(defaultGameState);
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

  const restoreAuth = useCallback(async () => {
    const restored = await restoreSession();
    if (!restored) return;
    try {
      await setupSocket(restored.session, false);
    } catch {
      clearSession();
    }
  }, [setupSocket]);

  // ── Register ─────────────────────────────────────────────────────────────
  const register = useCallback(async (username: string, password: string) => {
    setErrorMessage('');
    try {
      const sess = await registerAccount(username, password);
      await client.rpc(sess, 'register_user', '');
      saveSession(sess, username);
      await setupSocket(sess, false);
    } catch (e: unknown) {
      setErrorMessage(getAuthErrorMessage('register', e));
    }
  }, [setupSocket]);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (username: string, password: string) => {
    setErrorMessage('');
    try {
      const sess = await loginAccount(username, password);
      saveSession(sess, username);
      setDisplayName(username);
      await setupSocket(sess, false);
    } catch (e: unknown) {
      setErrorMessage(getAuthErrorMessage('login', e));
    }
  }, [setupSocket]);

  // ── Guest ────────────────────────────────────────────────────────────────
  const continueAsGuest = useCallback(async () => {
    setErrorMessage('');
    try {
      const sess = await loginGuest();
      await client.rpc(sess, 'mark_guest', '');
      setDisplayName(sess.username || 'Guest');
      await setupSocket(sess, true);
    } catch (e: unknown) {
      setErrorMessage(getAuthErrorMessage('guest', e));
    }
  }, [setupSocket]);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    clearSession();
    if (socketRef.current) {
      // Avoid redirect race: ondisconnect currently sends users to lobby.
      socketRef.current.ondisconnect = null;
      socketRef.current.onmatchpresence = null;
      socketRef.current.onmatchdata = null;
      try { await socketRef.current.disconnect(true); } catch (_) {}
    }
    socketRef.current  = null;
    sessionRef.current = null;
    setSession(null);
    setMyUserId('');
    setDisplayName('');
    setIsGuest(false);
    setMatch(null);
    setGameState(defaultGameState);
    setActiveRoomCode('');
    setActiveRoomId('');
    setRematchState('idle');
    setRematchRequesterId('');
    setLeaderboard([]);
    setMyLeaderboardRecord(null);
    setScreen('auth');
  }, []);

  // ── Matchmaking ──────────────────────────────────────────────────────────
  const findMatch = useCallback(async (mode: GameMode) => {
    const sock = socketRef.current;
    if (!sock) return;
    setScreen('matchmaking');
    setStatusMessage('Looking for opponent...');
    setActiveRoomCode('');
    setActiveRoomId('');
    setGameState({ ...defaultGameState, mode });
    setTimerRemaining(10);
    try {
      sock.onmatchmakermatched = async (matched) => {
        try {
          const m = await sock.joinMatch(matched.match_id || '', matched.token);
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

  // ── Move ─────────────────────────────────────────────────────────────────
  const makeMove = useCallback((position: number) => {
    if (!socketRef.current || !match) return;
    const data = new TextEncoder().encode(JSON.stringify({ position }));
    socketRef.current.sendMatchState(match.match_id, OpCode.MOVE, data);
  }, [match]);

  // ── Leave match ──────────────────────────────────────────────────────────
  const leaveMatch = useCallback(async () => {
    if (!socketRef.current || !match) return;
    try { await socketRef.current.leaveMatch(match.match_id); } catch (_) {}
    setMatch(null);
    setRematchState('idle');
    setRematchRequesterId('');
    setGameState(defaultGameState);
    setScreen('lobby');
  }, [match]);

  // ── Leaderboard ──────────────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(async () => {
    const sess = sessionRef.current;
    if (!sess) return;
    try {
      const result = await client.rpc(sess, 'get_leaderboard', '');
      const body = parseRpcPayload(result.payload, { records: [], myRecord: null }) as {
        records?: LeaderboardEntry[];
        myRecord?: LeaderboardEntry | null;
      };
      console.log('[leaderboard] records:', body.records, 'myRecord:', body.myRecord);
      setLeaderboard(Array.isArray(body.records) ? body.records : []);
      setMyLeaderboardRecord(body.myRecord ?? null);
    } catch (e) {
      console.error('[leaderboard] fetch failed:', e);
    }
  }, []);

  // ── Rooms ────────────────────────────────────────────────────────────────
  const fetchRooms = useCallback(async () => {
    const sess = sessionRef.current;
    if (!sess) return;
    try {
      const result = await client.rpc(sess, 'list_rooms', '');
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
    setTimerRemaining(10);
    try {
      const result = await client.rpc(sess, 'create_room', JSON.stringify({ name, mode, hostUsername: displayName }));
      const body = parseRpcPayload(result.payload, {}) as { error?: string; code?: string; roomId?: string; matchId?: string };
      if (body.error) throw new Error(body.error);
      setActiveRoomCode(body.code || '');
      setActiveRoomId(body.roomId || '');
      sock.onmatchmakermatched = null;
      setStatusMessage(`Room "${name}" ready — waiting for opponent...`);
      const m = await sock.joinMatch(body.matchId);
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
    setTimerRemaining(10);
    try {
      sock.onmatchmakermatched = null;
      const m = await sock.joinMatch(room.matchId);
      setMatch(m);
      await client.rpc(sess, 'mark_room_full', JSON.stringify({ roomId: room.id }));
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
      setStatusMessage('Please login again and retry.');
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
      const result = await client.rpc(sess, 'get_room_by_code', JSON.stringify({ code: normalized }));
      const body = parseRpcPayload(result.payload, {}) as { error?: string; room?: Room };
      if (body.error) throw new Error(body.error);
      if (!body.room) throw new Error('Room not found');
      const room = body.room as Room;
      sock.onmatchmakermatched = null;
      setGameState({ ...defaultGameState, mode: room.mode as GameMode });
      setTimerRemaining(10);
      const m = await sock.joinMatch(room.matchId);
      setMatch(m);
      await client.rpc(sess, 'mark_room_full', JSON.stringify({ roomId: room.id }));
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
      await client.rpc(sess, 'delete_room', JSON.stringify({ roomId: activeRoomId }));
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
    setScreen('lobby');
  }, [match]);

  return (
    <GameContext.Provider value={{
      screen, session, match, gameState, myUserId, displayName, isGuest,
      timerRemaining, activeRoomCode, activeRoomId, leaderboard, myLeaderboardRecord, rooms,
      statusMessage, errorMessage,
      register, login, continueAsGuest, restoreAuth, logout,
      findMatch, makeMove, leaveMatch,
      fetchLeaderboard, fetchRooms, createRoom, joinRoom, joinRoomByCode, deleteActiveRoom,
      requestRematch, acceptRematch, declineRematch, rematchState, rematchRequesterId,
      setScreen,
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
