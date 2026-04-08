import { getLeaderboardRows } from "../utils/leaderboard";

export const rpcGetLeaderboard: nkruntime.RpcFunction = (
  ctx, logger, nk, _payload
) => {
  const rows = getLeaderboardRows(nk, logger);
  return JSON.stringify({ records: rows });
};
