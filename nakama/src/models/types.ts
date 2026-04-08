// ─── Op Codes ────────────────────────────────────────────────────────────────
export const OpCode = {
  MOVE:            1,
  STATE:           2,
  REJECTED:        3,
  GAME_OVER:       4,
  READY:           5,
  TICK:            6,
  REMATCH_REQUEST: 7,
  REMATCH_ACCEPT:  8,
  REMATCH_DECLINE: 9,
  REMATCH_START:   10,
  OPPONENT_LEFT_LOBBY: 11,
} as const;



// ─── Storage collections ──────────────────────────────────────────────────────
export const COLLECTION_USERS   = "users";
export const COLLECTION_ROOMS   = "rooms";
export const COLLECTION_STATS   = "player_stats";
export const USER_PROFILE_KEY   = "profile";
export const MODULE_NAME        = "tictactoe";
export const SYSTEM_USER_ID     = "00000000-0000-0000-0000-000000000000";
export const PLAYER_PROFILE_COLLECTION = "player_profile";

// ─── Win lines ────────────────────────────────────────────────────────────────
export const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
] as const;



export interface MatchState {
  board:               string[];
  marks:               { [userId: string]: "X" | "O" };
  playerNames:         { [userId: string]: string };
  currentTurn:         string;
  winner:              string | null;
  gameOver:            boolean;
  presences:           { [userId: string]: nkruntime.Presence };
  mode:                "classic" | "timed";
  turnStartTick:       number;
  tickRate:            number;
  turnLimitTicks:      number;
  roomId:              string;
  emptySinceTick:      number;
  rematchRequestedBy:  string;
  rematchRequestTick:  number;
  isRematch:           boolean;
}

export interface RoomRecord {
  id:           string;
  code?:        string;
  name:         string;
  mode:         string;
  hostUserId:   string;
  hostUsername: string;
  matchId:      string;
  status:       "waiting" | "full";
  createdAt:    number;
}

export interface MoveMessage {
  position: number;
}


