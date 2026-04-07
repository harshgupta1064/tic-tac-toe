import { useGame } from '../context/GameContext';

export default function GameOverScreen() {
  const { gameState, myUserId, leaveMatch, findMatch } = useGame();
  const { winner, winnerMark, reason, board, marks, mode } = gameState;

  const iWon = winner === myUserId;
  const isDraw = winner === 'draw';
  const myMark = marks[myUserId] || '';

  const getResultText = () => {
    if (isDraw) return "It's a draw!";
    if (iWon) {
      if (reason === 'forfeit') return 'You win! (Opponent left)';
      if (reason === 'timeout') return 'You win! (Opponent timed out)';
      return 'You win! 🎉';
    }
    if (reason === 'timeout') return 'You lost! (Time ran out)';
    return 'You lose!';
  };

  const resultColor = isDraw
    ? 'text-yellow-400'
    : iWon
      ? 'text-green-400'
      : 'text-red-400';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">
            {isDraw ? '🤝' : iWon ? '🏆' : '😔'}
          </div>
          <h2 className={`text-3xl font-bold ${resultColor}`}>
            {getResultText()}
          </h2>
          {reason && (
            <p className="text-gray-500 text-sm mt-1 capitalize">{reason}</p>
          )}
        </div>

        {/* Final board (mini) */}
        <div className="grid grid-cols-3 gap-2 mb-8 opacity-60">
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

        <div className="space-y-3">
          <button
            onClick={() => findMatch(mode)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-colors"
          >
            Play Again
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
  );
}
