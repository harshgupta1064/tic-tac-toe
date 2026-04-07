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
  const { gameState, myUserId, timerRemaining, statusMessage } = useGame();
  const { board, marks, currentTurn, mode } = gameState;

  const myMark = marks[myUserId] || '';
  const isMyTurn = currentTurn === myUserId;
  const opponentId = Object.keys(marks).find(uid => uid !== myUserId) || '';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-sm text-gray-400">You are</span>
            <span className={`text-lg font-bold ${myMark === 'X' ? 'text-indigo-400' : 'text-rose-400'}`}>
              {myMark}
            </span>
          </div>

          {/* Turn indicator */}
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium ${
            isMyTurn
              ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/50'
              : 'bg-gray-800 text-gray-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-indigo-400 animate-pulse' : 'bg-gray-600'}`} />
            {isMyTurn ? 'Your turn' : "Opponent's turn"}
          </div>

          {/* Timer (timed mode) */}
          {mode === 'timed' && isMyTurn && (
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
              gameOver={false}
            />
          ))}
        </div>

        {/* Status */}
        {statusMessage && (
          <p className="text-amber-400 text-sm text-center">{statusMessage}</p>
        )}
      </div>
    </div>
  );
}
