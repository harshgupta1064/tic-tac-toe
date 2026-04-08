// main.ts — registration only. No logic lives here.
import {
  MODULE_NAME, LEADERBOARD_WINS, LEADERBOARD_LOSSES, LEADERBOARD_STREAK, LEADERBOARD_DRAWS,
} from "./models/types";
import {
  matchInit, matchJoinAttempt, matchJoin, matchLeave,
  matchLoop, matchTerminate, matchSignal, matchmakerMatched,
} from "./match/handler";
import { rpcGetLeaderboard } from "./rpc/leaderboard.rpc";

import {
  rpcCreateRoom, rpcListRooms, rpcMarkRoomFull, rpcDeleteRoom, rpcGetRoomByCode,
} from "./rpc/rooms.rpc";

function InitModule(
  ctx:         nkruntime.Context,
  logger:      nkruntime.Logger,
  nk:          nkruntime.Nakama,
  initializer: nkruntime.Initializer
) {
  initializer.registerMatch(MODULE_NAME, {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLeave: matchLeave,
    matchLoop: matchLoop,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal,
  });

  initializer.registerMatchmakerMatched(matchmakerMatched);

  initializer.registerRpc("get_leaderboard",  rpcGetLeaderboard);

  initializer.registerRpc("create_room",      rpcCreateRoom);
  initializer.registerRpc("list_rooms",       rpcListRooms);
  initializer.registerRpc("mark_room_full",   rpcMarkRoomFull);
  initializer.registerRpc("delete_room",      rpcDeleteRoom);
  initializer.registerRpc("get_room_by_code", rpcGetRoomByCode);


  try { nk.leaderboardCreate(LEADERBOARD_WINS,   false, "desc" as any, "incr" as any, "", {} as any); } catch {}
  try { nk.leaderboardCreate(LEADERBOARD_LOSSES, false, "desc" as any, "incr" as any, "", {} as any); } catch {}
  try { nk.leaderboardCreate(LEADERBOARD_STREAK, false, "desc" as any, "best" as any, "", {} as any); } catch {}
  try { nk.leaderboardCreate(LEADERBOARD_DRAWS,  false, "desc" as any, "incr" as any, "", {} as any); } catch {}

  logger.info("TicTacToe module loaded — modular build");
}

!InitModule && InitModule.bind(null);
