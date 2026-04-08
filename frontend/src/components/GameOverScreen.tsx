import { useEffect } from 'react';
import { useGame } from '../context/GameContext';

export default function GameOverScreen() {
  const { fetchLeaderboard } = useGame();
  const {
    gameState, myUserId, leaveMatch, sessionStats,
    rematchState, requestRematch, acceptRematch, declineRematch,
  } = useGame();

  useEffect(() => {
    // Silently refresh global leaderboard in background after each game.
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const { winner, winnerMark, reason, board, marks, mode, playerNames } = gameState;

  const iWon   = winner === myUserId;
  const isDraw = winner === 'draw';
  const myMark = marks[myUserId] || '';

  const getResultText = () => {
    if (isDraw) return "It's a draw!";
    if (iWon) {
      if (reason === 'forfeit') return 'You win! Opponent left.';
      if (reason === 'timeout') return 'You win! Time ran out.';
      return 'You win! 🎉';
    }
    if (reason === 'timeout') return 'You lose. Time ran out.';
    return 'You lose!';
  };

  const resultColor = isDraw
    ? 'text-yellow-400'
    : iWon ? 'text-green-400' : 'text-red-400';

  // ── Rematch overlay content ──────────────────────────────────────────────
  const renderRematchOverlay = () => {
    // Incoming request from opponent
    if (rematchState === 'incoming') {
      return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center px-6 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🔄</div>
            <h3 className="text-lg font-bold text-white mb-1">
              Rematch requested!
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Your opponent wants to play again.
            </p>
            <div className="flex gap-3">
              <button
                onClick={declineRematch}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl transition-colors"
              >
                Decline
              </button>
              <button
                onClick={acceptRematch}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Waiting for opponent to respond
    if (rematchState === 'requesting') {
      return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center px-6 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-10 h-10 rounded-full border-4 border-gray-700 border-t-indigo-500 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">
              Waiting for opponent...
            </h3>
            <p className="text-gray-400 text-sm">
              Request expires in 30 seconds.
            </p>
          </div>
        </div>
      );
    }

    // Opponent declined
    if (rematchState === 'declined') {
      return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center px-6 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🙅</div>
            <h3 className="text-lg font-bold text-white mb-1">
              Rematch declined
            </h3>
            <p className="text-gray-400 text-sm">
              Returning to lobby...
            </p>
          </div>
        </div>
      );
    }

    // Timeout — opponent didn't respond
    if (rematchState === 'declined_timeout') {
      return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center px-6 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">⏳</div>
            <h3 className="text-lg font-bold text-white mb-1">
              No response
            </h3>
            <p className="text-gray-400 text-sm">
              Opponent didn't respond. Returning to lobby...
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {/* Rematch overlay (sits above everything) */}
      {renderRematchOverlay()}

      {/* Main game over screen */}
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <button
          onClick={leaveMatch}
          className="fixed top-4 left-4 z-40 bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs px-3 py-2 rounded-lg transition-colors"
        >
          ← Back
        </button>
        <div className="w-full max-w-sm">

          {/* Result */}
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">
              {isDraw ? '🤝' : iWon ? '🏆' : '😔'}
            </div>
            <h2 className={`text-3xl font-bold ${resultColor}`}>
              {getResultText()}
            </h2>
            {reason === 'timeout' && (
              <div className="mt-3 inline-flex items-center gap-2 bg-gray-800 rounded-full px-4 py-1.5 text-sm text-gray-400">
                <span>⏱</span>
                <span>
                  {iWon ? 'Opponent ran out of time' : 'Your time ran out'}
                </span>
              </div>
            )}
          </div>

          {/* Session Stats Leaderboard */}
          <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-5 mb-8 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <span className="text-8xl">🏆</span>
            </div>
            
            <div className="flex items-center justify-center gap-2 mb-4 text-emerald-400">
              <span className="text-xl">🏆</span>
              <span className="font-semibold text-lg">Session Score</span>
            </div>

            <div className="text-sm font-medium text-gray-500 mb-2 mt-4 flex px-2 border-b border-gray-800 pb-2">
              <span className="flex-1">Player</span>
              <span className="w-20 text-center">W/L/D</span>
              <span className="w-16 text-right">Score</span>
            </div>

            <div className="space-y-3">
              {Object.keys(marks)
                .sort((a, b) => {
                   const sA = sessionStats[a]?.score || 0;
                   const sB = sessionStats[b]?.score || 0;
                   return sB - sA;
                })
                .map((uid, idx) => {
                const s = sessionStats[uid] || { wins: 0, losses: 0, draws: 0, score: 0 };
                const isMe = uid === myUserId;
                const name = playerNames[uid] || 'Player';
                return (
                  <div key={uid} className={`flex items-center px-2 py-1 ${isMe ? 'text-white font-medium' : 'text-gray-300'}`}>
                    <div className="flex-1 truncate pr-2">
                      <span className="text-gray-500 mr-2">{idx + 1}.</span>
                      {name} {isMe && <span className="text-gray-500 font-normal text-sm ml-1">(you)</span>}
                    </div>
                    <div className="w-20 text-center tabular-nums text-sm">
                      <span className="text-emerald-400">{s.wins}</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-rose-400">{s.losses}</span>
                      <span className="text-gray-600">/</span>
                      <span className="text-gray-400">{s.draws}</span>
                    </div>
                    <div className="w-16 text-right tabular-nums text-sm font-mono tracking-tight text-white">
                      {s.score}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={requestRematch}
              disabled={rematchState !== 'idle'}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              🔄 Play Again (Rematch)
            </button>
            <button
              onClick={leaveMatch}
              className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl transition-colors"
            >
              Back to Lobby
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
