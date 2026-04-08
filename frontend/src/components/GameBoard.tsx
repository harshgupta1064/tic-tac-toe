import { useGame } from '../context/GameContext';

interface CellProps {
  value: string;
  index: number;
  isMyTurn: boolean;
  gameOver: boolean;
}

function Cell({ value, index, isMyTurn, gameOver }: CellProps) {
  const { makeMove } = useGame();

  const canClick = !value && isMyTurn && !gameOver;

  return (
    <button
      onClick={() => canClick && makeMove(index)}
      disabled={!canClick}
      className={`
        aspect-square flex items-center justify-center rounded-2xl text-5xl font-bold transition-all
        ${canClick ? 'cursor-pointer hover:bg-gray-700/80 active:scale-95' : 'cursor-default'}
        ${value ? 'bg-gray-800' : 'bg-gray-800/50'}
        border border-gray-700/50
      `}
    >
      {value === 'X' && <span className="text-indigo-400">✕</span>}
      {value === 'O' && <span className="text-rose-400">○</span>}
    </button>
  );
}

export default function GameBoard() {
  const { gameState, myUserId, displayName, timerRemaining, leaveMatch, findMatch } = useGame();
  const { board, marks, playerNames, currentTurn, winner, reason, mode } = gameState;

  const myMark = marks[myUserId] || '';
  const isMyTurn = currentTurn === myUserId;
  const isGameOver = Boolean(winner);
  const opponentId = Object.keys(marks).find(uid => uid !== myUserId) || '';
  const myName = displayName || playerNames[myUserId] || 'You';
  const opponentName = playerNames[opponentId] || 'Opponent';
  const iWon = winner === myUserId;
  const isDraw = winner === 'draw';
  const resultText = isDraw
    ? "It's a draw!"
    : iWon
      ? (reason === 'forfeit' ? 'You win! (Opponent left)' : reason === 'timeout' ? 'You win! (Opponent timed out)' : 'You win! 🎉')
      : (reason === 'timeout' ? 'You lost! (Time ran out)' : 'You lose!');
  const resultColor = isDraw ? 'text-yellow-400' : iWon ? 'text-green-400' : 'text-red-400';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-8">
      <button
        onClick={leaveMatch}
        className="fixed top-4 left-4 z-40 bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs px-3 py-2 rounded-lg transition-colors"
      >
        ← Back
      </button>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-4">
          {isGameOver ? (
            <div className="text-5xl mb-4">{isDraw ? '🤝' : iWon ? '🏆' : '😔'}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-4 text-left">
              <div className={`rounded-xl border px-3 py-2 ${isMyTurn ? 'border-indigo-500 bg-indigo-900/30' : 'border-gray-700 bg-gray-900'}`}>
                <p className="text-xs text-gray-400">You</p>
                <p className="text-sm font-semibold text-white truncate">{myName}</p>
              </div>
              <div className={`rounded-xl border px-3 py-2 ${!isMyTurn ? 'border-indigo-500 bg-indigo-900/30' : 'border-gray-700 bg-gray-900'}`}>
                <p className="text-xs text-gray-400">Opponent</p>
                <p className="text-sm font-semibold text-white truncate">{opponentName}</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-sm text-gray-400">You are</span>
            <span className={`text-lg font-bold ${myMark === 'X' ? 'text-indigo-400' : 'text-rose-400'}`}>
              {myMark}
            </span>
          </div>

          {/* Turn indicator */}
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium ${
            !isGameOver && isMyTurn
              ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/50'
              : 'bg-gray-800 text-gray-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${!isGameOver && isMyTurn ? 'bg-indigo-400 animate-pulse' : 'bg-gray-600'}`} />
            {isGameOver ? 'Game finished' : isMyTurn ? 'Your turn' : "Opponent's turn"}
          </div>

          {/* Timer (timed mode) */}
          {mode === 'timed' && isMyTurn && !isGameOver && (
            <div className={`mt-3 text-2xl font-mono font-bold ${
              timerRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-orange-400'
            }`}>
              {timerRemaining}s
            </div>
          )}
        </div>

        {/* Board */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {board.map((cell, i) => (
            <Cell
              key={i}
              value={cell}
              index={i}
              isMyTurn={isMyTurn}
              gameOver={isGameOver}
            />
          ))}
        </div>

        {isGameOver && (
          <div className="text-center">
            <h3 className={`text-2xl font-bold ${resultColor}`}>{resultText}</h3>
            <div className="space-y-3 mt-5">
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
        )}

      </div>
    </div>
  );
}
