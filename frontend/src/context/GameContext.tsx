import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Session, Socket, Match } from '@heroiclabs/nakama-js';
import { client, createSocket } from '../lib/nakama';

export type Screen = 'auth' | 'lobby' | 'rooms' | 'matchmaking' | 'game' | 'gameover';
export type GameMode = 'classic' | 'timed';

export interface GameState {
  board: string[];
  marks: { [userId: string]: 'X' | 'O' };
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
  bestStreak: number;
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
  socket: Socket | null;
  match: Match | null;
  gameState: GameState;
  myUserId: string;
  timerRemaining: number;
  leaderboard: LeaderboardEntry[];
  rooms: Room[];
  statusMessage: string;
  login: (username: string) => Promise<void>;
  findMatch: (mode: GameMode) => Promise<void>;
  makeMove: (position: number) => void;
  leaveMatch: () => void;
  fetchLeaderboard: () => Promise<void>;
  createRoom: (name: string, mode: GameMode) => Promise<void>;
  fetchRooms: () => Promise<void>;
  joinRoom: (room: Room) => Promise<void>;
  setScreen: (s: Screen) => void;
}

const defaultGameState: GameState = {
  board: ['','','','','','','','',''],
  marks: {},
  currentTurn: '',
  winner: null,
  winnerMark: null,
  reason: null,
  mode: 'classic',
};

const OpCode = { MOVE: 1, STATE: 2, REJECTED: 3, GAME_OVER: 4, READY: 5, TICK: 6 };

const GameContext = createContext<GameContextType | null>(null);

function parseRpcPayload(payload: unknown, fallback: Record<string, unknown>) {
  if (payload == null || payload === '') return fallback;
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      if (typeof parsed === 'string') {
        try {
          return JSON.parse(parsed);
        } catch {
          return fallback;
        }
      }
      return parsed;
    } catch {
      return fallback;
    }
  }
  if (typeof payload === 'object') return payload as Record<string, unknown>;
  return fallback;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>('auth');
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [gameState, setGameState] = useState<GameState>(defaultGameState);
  const [myUserId, setMyUserId] = useState('');
  const [timerRemaining, setTimerRemaining] = useState(30);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const login = useCallback(async (username: string) => {
    setStatusMessage('Connecting...');
    try {
      // Always generate a fresh device ID per login attempt so two tabs
      // never accidentally share the same Nakama user identity.
      const deviceId = crypto.randomUUID();
      sessionStorage.setItem('deviceId', deviceId);

      const sess = await client.authenticateDevice(deviceId, true, username);
      setSession(sess);
      setMyUserId(sess.user_id!);

      const sock = await createSocket(sess);
      socketRef.current = sock;
      setSocket(sock);

      // Set up socket listeners
      sock.onmatchdata = (matchData) => {
        const opCode = matchData.op_code;
        let data: any = {};
        try {
          data = JSON.parse(new TextDecoder().decode(matchData.data as Uint8Array));
        } catch {}

        if (opCode === OpCode.READY || opCode === OpCode.STATE) {
          setGameState(prev => ({
            ...prev,
            board: data.board || prev.board,
            marks: data.marks || prev.marks,
            currentTurn: data.currentTurn || prev.currentTurn,
            mode: data.mode || prev.mode,
          }));
          if (opCode === OpCode.READY) setScreen('game');
        }

        if (opCode === OpCode.GAME_OVER) {
          setGameState(prev => ({
            ...prev,
            board: data.board || prev.board,
            winner: data.winner || null,
            winnerMark: data.winnerMark || null,
            reason: data.reason || null,
          }));
          setScreen('gameover');
        }

        if (opCode === OpCode.TICK) {
          setTimerRemaining(data.remaining ?? 30);
        }

        if (opCode === OpCode.REJECTED) {
          setStatusMessage(data.reason || 'Move rejected');
          setTimeout(() => setStatusMessage(''), 2000);
        }
      };

      sock.onmatchpresence = (presenceEvent) => {
        if (presenceEvent.leaves && presenceEvent.leaves.length > 0) {
          setStatusMessage('Opponent disconnected');
        }
      };

      sock.ondisconnect = () => {
        setStatusMessage('Disconnected from server');
        setScreen('lobby');
      };

      setScreen('lobby');
      setStatusMessage('');
    } catch (e: any) {
      setStatusMessage('Login failed: ' + (e.message || 'Unknown error'));
    }
  }, []);

  const findMatch = useCallback(async (mode: GameMode) => {
    if (!socketRef.current || !session) return;
    setScreen('matchmaking');
    setStatusMessage('Looking for opponent...');
    setGameState({ ...defaultGameState, mode });
    setTimerRemaining(30);

    try {
      const sock = socketRef.current;

      sock.onmatchmakermatched = async (matched) => {
        try {
          const m = await sock.joinMatch(matched.match_id || '', matched.token);
          setMatch(m);
          setStatusMessage('Opponent found! Starting game...');
        } catch (e: any) {
          setStatusMessage('Failed to join match: ' + e.message);
          setScreen('lobby');
        }
      };

      await sock.addMatchmaker('*', 2, 2, { mode });
    } catch (e: any) {
      setStatusMessage('Matchmaking failed: ' + e.message);
      setScreen('lobby');
    }
  }, [session]);

  const makeMove = useCallback((position: number) => {
    if (!socketRef.current || !match) return;
    const data = new TextEncoder().encode(JSON.stringify({ position }));
    socketRef.current.sendMatchState(match.match_id, OpCode.MOVE, data);
  }, [match]);

  const leaveMatch = useCallback(async () => {
    if (!socketRef.current || !match) return;
    try {
      await socketRef.current.leaveMatch(match.match_id);
    } catch {}
    setMatch(null);
    setGameState(defaultGameState);
    setScreen('lobby');
  }, [match]);

  const fetchLeaderboard = useCallback(async () => {
    if (!session) return;
    try {
      const result = await client.rpc(session, 'get_leaderboard', '');
      const body = parseRpcPayload(result.payload, { records: [] }) as { records?: LeaderboardEntry[] };
      setLeaderboard(body?.records || []);
    } catch (e) {
      console.error('Leaderboard fetch failed', e);
    }
  }, [session]);

  const createRoom = useCallback(async (name: string, mode: GameMode) => {
    if (!session) return;
    setScreen('matchmaking');
    setStatusMessage('Creating room...');
    setGameState({ ...defaultGameState, mode });
    setTimerRemaining(30);

    try {
      const result = await client.rpc(session, 'create_room', JSON.stringify({ name, mode }));
      const body = parseRpcPayload(result.payload, {}) as { error?: string; matchId?: string };
      if (body.error) throw new Error(body.error);
      if (!body.matchId) throw new Error('No matchId returned from create_room');

      const sock = socketRef.current!;
      sock.onmatchmakermatched = null; // disable auto-matchmaker handler

      setStatusMessage(`Room "${name}" created — waiting for opponent...`);

      // Join the match we just created
      const m = await sock.joinMatch(body.matchId);
      setMatch(m);

      // Poll until READY op-code fires (handled by existing onmatchdata)
    } catch (e: any) {
      setStatusMessage('Failed to create room: ' + (e.message || ''));
      setScreen('lobby');
    }
  }, [session]);

  const fetchRooms = useCallback(async () => {
    if (!session) {
      setStatusMessage('Not logged in. Please login again.');
      return;
    }
    try {
      const result = await client.rpc(session, 'list_rooms', '');
      const body = parseRpcPayload(result.payload, { rooms: [] }) as { rooms?: Room[] };
      const nextRooms = Array.isArray(body.rooms) ? body.rooms : [];
      setRooms(nextRooms);
      setStatusMessage(nextRooms.length > 0 ? `${nextRooms.length} room(s) found` : 'No open rooms right now.');
    } catch (e: any) {
      console.error('fetchRooms failed', e);
      setStatusMessage('Failed to fetch rooms: ' + (e?.message || 'Unknown error'));
    }
  }, [session]);

  const joinRoom = useCallback(async (room: Room) => {
    if (!session || !socketRef.current) return;
    setScreen('matchmaking');
    setStatusMessage(`Joining "${room.name}"...`);
    setGameState({ ...defaultGameState, mode: room.mode as GameMode });
    setTimerRemaining(30);

    try {
      const sock = socketRef.current;
      sock.onmatchmakermatched = null;

      const m = await sock.joinMatch(room.matchId);
      setMatch(m);

      // Mark room full so it disappears from browser
      await client.rpc(session, 'mark_room_full', JSON.stringify({ roomId: room.id }));

      setStatusMessage('Joined! Starting game...');
    } catch (e: any) {
      setStatusMessage('Failed to join room: ' + (e.message || ''));
      setScreen('lobby');
    }
  }, [session]);

  return (
    <GameContext.Provider value={{
      screen, session, socket, match, gameState, myUserId,
      timerRemaining, leaderboard, rooms, statusMessage,
      login, findMatch, makeMove, leaveMatch, fetchLeaderboard, createRoom, fetchRooms, joinRoom, setScreen,
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
