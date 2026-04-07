import { useState } from 'react';
import { useGame, GameMode } from '../context/GameContext';

export default function LobbyScreen() {
  const { findMatch, fetchLeaderboard, leaderboard, session, displayName, setScreen } = useGame();
  const [mode, setMode] = useState<GameMode>('classic');
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const handleShowLeaderboard = async () => {
    await fetchLeaderboard();
    setShowLeaderboard(true);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white">Welcome back!</h2>
          <p className="text-gray-400 text-sm mt-1">{displayName || session?.username}</p>
        </div>

        {/* Mode selector */}
        <div className="bg-gray-900 rounded-xl p-1 flex mb-6">
          <button
            onClick={() => setMode('classic')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'classic'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Classic
          </button>
          <button
            onClick={() => setMode('timed')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'timed'
                ? 'bg-orange-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ⏱ Timed (30s)
          </button>
        </div>

        <button
          onClick={() => findMatch(mode)}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-colors text-base mb-3"
        >
          Find Match
        </button>

        <button
          onClick={() => setScreen('rooms' as any)}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl transition-colors text-sm mb-3"
        >
          🚪 Browse / Create Rooms
        </button>

        <button
          onClick={handleShowLeaderboard}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl transition-colors text-sm"
        >
          🏆 Leaderboard
        </button>

        {/* Leaderboard overlay */}
        {showLeaderboard && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center px-6 z-50">
            <div className="bg-gray-900 rounded-2xl w-full max-w-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">🏆 Top Players</h3>
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="text-gray-400 hover:text-white text-xl"
                >×</button>
              </div>
              {leaderboard.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No records yet. Play some games!</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, i) => (
                    <div
                      key={entry.userId}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${
                        i === 0 ? 'bg-yellow-900/40 border border-yellow-700/40' : 'bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm w-5">#{entry.rank}</span>
                        <span className="text-white text-sm font-medium">{entry.username || 'Player'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-indigo-400 font-semibold">{entry.wins}W</span>
                        <span className="text-red-400">{entry.losses}L</span>
                        {entry.bestStreak > 1 && (
                          <span className="text-orange-400">🔥{entry.bestStreak}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
