import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Session, Socket, Match } from '@heroiclabs/nakama-js';
import { client, createSocket } from '../lib/nakama';

export type Screen = 'auth' | 'lobby' | 'matchmaking' | 'game' | 'gameover';
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
  rank: number;
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
  statusMessage: string;
  login: (username: string) => Promise<void>;
  findMatch: (mode: GameMode) => Promise<void>;
  makeMove: (position: number) => void;
  leaveMatch: () => void;
  fetchLeaderboard: () => Promise<void>;
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

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>('auth');
  const [session, setSession] = useState<Session | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [gameState, setGameState] = useState<GameState>(defaultGameState);
  const [myUserId, setMyUserId] = useState('');
  const [timerRemaining, setTimerRemaining] = useState(30);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const login = useCallback(async (username: string) => {
    setStatusMessage('Connecting...');
    try {
      // Use device ID stored in localStorage for persistence
      let deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('deviceId', deviceId);
      }

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
      const body = result.payload as any;
      setLeaderboard(body?.records || []);
    } catch (e) {
      console.error('Leaderboard fetch failed', e);
    }
  }, [session]);

  return (
    <GameContext.Provider value={{
      screen, session, socket, match, gameState, myUserId,
      timerRemaining, leaderboard, statusMessage,
      login, findMatch, makeMove, leaveMatch, fetchLeaderboard, setScreen,
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
