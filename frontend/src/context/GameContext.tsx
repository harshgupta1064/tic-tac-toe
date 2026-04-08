import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Session, Socket, Match } from '@heroiclabs/nakama-js';
import { client, createSocket } from '../lib/nakama';

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
  bestStreak: number;
  rank: number;
}

export interface Room {
  id: string;
  code: string;
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
  displayName: string;
  timerRemaining: number;
  activeRoomCode: string;
  activeRoomId: string;
  leaderboard: LeaderboardEntry[];
  rooms: Room[];
  statusMessage: string;
  rematchState: 'idle' | 'requesting' | 'incoming' | 'declined' | 'declined_timeout';
  rematchRequesterId: string;
  login: (username: string) => Promise<void>;
  findMatch: (mode: GameMode) => Promise<void>;
  makeMove: (position: number) => void;
  leaveMatch: () => void;
  fetchLeaderboard: () => Promise<void>;
  createRoom: (name: string, mode: GameMode) => Promise<void>;
  fetchRooms: () => Promise<void>;
  joinRoom: (room: Room) => Promise<void>;
  joinRoomByCode: (code: string) => Promise<void>;
  deleteActiveRoom: () => Promise<void>;
  requestRematch: () => void;
  acceptRematch: () => void;
  declineRematch: () => void;
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
};

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
  const [displayName, setDisplayName] = useState('');
  const [timerRemaining, setTimerRemaining] = useState(30);
  const [activeRoomCode, setActiveRoomCode] = useState('');
  const [activeRoomId, setActiveRoomId] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [rematchState, setRematchState] = useState<'idle' | 'requesting' | 'incoming' | 'declined' | 'declined_timeout'>('idle');
  const [rematchRequesterId, setRematchRequesterId] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const login = useCallback(async (username: string) => {
    setStatusMessage('Connecting...');
    try {
      // Always generate a fresh device ID per login attempt so two tabs
      // never accidentally share the same Nakama user identity.
      const deviceId = crypto.randomUUID();
      sessionStorage.setItem('deviceId', deviceId);

      const base = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 14) || 'player';
      const suffix = Math.random().toString(36).slice(2, 8);
      const internalUsername = `${base}_${suffix}`;
      const sess = await client.authenticateDevice(deviceId, true, internalUsername);
      setSession(sess);
      setMyUserId(sess.user_id!);
      setDisplayName(username.trim());
      setActiveRoomCode('');
      setActiveRoomId('');
      try {
        await client.rpc(sess, 'set_display_name', JSON.stringify({ name: username.trim() }));
      } catch {}

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
          let mergedMarks: { [userId: string]: 'X' | 'O' } = {};
          setGameState(prev => {
            const nextState = {
              ...prev,
              board: data.board || prev.board,
              marks: data.marks || prev.marks,
              playerNames: data.playerNames || prev.playerNames,
              currentTurn: data.currentTurn || prev.currentTurn,
              mode: data.mode || prev.mode,
            };
            mergedMarks = nextState.marks;
            return nextState;
          });
          // Resolve opponent visible name from profile storage.
          const ids = Object.keys(mergedMarks || {});
          const otherId = ids.find(id => id !== (sess.user_id || ''));
          if (otherId) {
            client.rpc(sess, 'get_display_name', JSON.stringify({ userId: otherId }))
              .then((res) => {
                const body = parseRpcPayload(res.payload, { name: '' }) as { name?: string };
                if (body.name) {
                  setGameState((curr) => ({
                    ...curr,
                    playerNames: { ...curr.playerNames, [otherId]: body.name as string },
                  }));
                }
              })
              .catch(() => {});
          }
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

        // ── Rematch op-codes ──────────────────────────────────────────────
        if (opCode === OpCode.REMATCH_REQUEST) {
          setRematchRequesterId(data.requestedBy || '');
          setRematchState('incoming');
        }

        if (opCode === OpCode.REMATCH_DECLINE) {
          setRematchState(data.reason === 'timeout' ? 'declined_timeout' : 'declined');
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
            board: data.board || ['','','','','','','','',''],
            marks: data.marks || prev.marks,
            playerNames: data.playerNames || prev.playerNames,
            currentTurn: data.currentTurn || '',
            mode: data.mode || prev.mode,
            winner: null,
            winnerMark: null,
            reason: null,
          }));
          setRematchState('idle');
          setRematchRequesterId('');
          setTimerRemaining(30);
          setScreen('game');
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
    setActiveRoomCode('');
    setActiveRoomId('');
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
    setRematchState('idle');
    setRematchRequesterId('');
    setGameState(defaultGameState);
    setScreen('lobby');
  }, [match]);

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

  const declineRematch = useCallback(() => {
    if (!socketRef.current || !match) return;
    setRematchState('idle');
    setRematchRequesterId('');
    const data = new TextEncoder().encode(JSON.stringify({}));
    socketRef.current.sendMatchState(match.match_id, OpCode.REMATCH_DECLINE, data);
    // Go back to lobby immediately on decline
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
    setActiveRoomCode('');
    setActiveRoomId('');
    setGameState({ ...defaultGameState, mode });
    setTimerRemaining(30);

    try {
      const result = await client.rpc(session, 'create_room', JSON.stringify({ name, mode, hostUsername: displayName }));
      const body = parseRpcPayload(result.payload, {}) as { error?: string; matchId?: string; code?: string; roomId?: string };
      if (body.error) throw new Error(body.error);
      if (!body.matchId) throw new Error('No matchId returned from create_room');
      setActiveRoomCode(body.code || '');
      setActiveRoomId(body.roomId || '');

      const sock = socketRef.current!;
      sock.onmatchmakermatched = null; // disable auto-matchmaker handler

      setStatusMessage(`Room "${name}" created (code: ${body.code || 'N/A'}) — waiting for opponent...`);

      // Join the match we just created
      const m = await sock.joinMatch(body.matchId);
      setMatch(m);

      // Poll until READY op-code fires (handled by existing onmatchdata)
    } catch (e: any) {
      setStatusMessage('Failed to create room: ' + (e.message || ''));
      setActiveRoomCode('');
      setActiveRoomId('');
      setScreen('lobby');
    }
  }, [displayName, session]);

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
    setActiveRoomCode('');
    setActiveRoomId('');
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
      setActiveRoomCode('');
      setActiveRoomId('');
      setScreen('lobby');
    }
  }, [session]);

  const joinRoomByCode = useCallback(async (code: string) => {
    if (!session || !socketRef.current) {
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
      const result = await client.rpc(session, 'get_room_by_code', JSON.stringify({ code: normalized }));
      const body = parseRpcPayload(result.payload, {}) as { room?: Room; error?: string };
      if (body.error) throw new Error(body.error);
      if (!body.room) throw new Error('Room not found');
      const room = body.room;
      const sock = socketRef.current;
      sock.onmatchmakermatched = null;
      setGameState({ ...defaultGameState, mode: room.mode as GameMode });
      setTimerRemaining(30);
      const m = await sock.joinMatch(room.matchId);
      setMatch(m);
      await client.rpc(session, 'mark_room_full', JSON.stringify({ roomId: room.id }));
      setStatusMessage(`Joined room ${normalized}. Starting game...`);
    } catch (e: any) {
      setStatusMessage('Failed to join by code: ' + (e.message || 'Invalid room code'));
      setScreen('rooms');
    }
  }, [session]);

  const deleteActiveRoom = useCallback(async () => {
    if (!session || !activeRoomId) {
      setScreen('lobby');
      return;
    }
    try {
      await client.rpc(session, 'delete_room', JSON.stringify({ roomId: activeRoomId }));
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
    setGameState(defaultGameState);
    setScreen('lobby');
  }, [activeRoomId, match, session]);

  return (
    <GameContext.Provider value={{
      screen, session, socket, match, gameState, myUserId, displayName,
      timerRemaining, activeRoomCode, activeRoomId, leaderboard, rooms, statusMessage,
      rematchState, rematchRequesterId,
      login, findMatch, makeMove, leaveMatch, fetchLeaderboard, createRoom, fetchRooms, joinRoom, joinRoomByCode, deleteActiveRoom,
      requestRematch, acceptRematch, declineRematch, setScreen,
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
