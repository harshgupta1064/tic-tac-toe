import { useGame } from '../context/GameContext';

export default function GameOverScreen() {
  const {
    gameState, myUserId, leaveMatch,
    rematchState, requestRematch, acceptRematch, declineRematch,
  } = useGame();

  const { winner, winnerMark, reason, board, marks, mode } = gameState;

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

          {/* Final board (mini, decorative) */}
          <div className="grid grid-cols-3 gap-2 mb-8 opacity-50">
            {board.map((cell, i) => (
              <div
                key={i}
                className="aspect-square flex items-center justify-center bg-gray-800 rounded-xl text-2xl font-bold"
              >
                {cell === 'X' && <span className="text-indigo-400">✕</span>}
                {cell === 'O' && <span className="text-rose-400">○</span>}
              </div>
            ))}
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
