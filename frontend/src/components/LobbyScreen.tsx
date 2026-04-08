import React, { useState } from 'react';
import { useGame, GameMode } from '../context/GameContext';

export default function LobbyScreen() {
  const {
    findMatch, fetchLeaderboard, leaderboard, myLeaderboardRecord,
    session, isGuest, logout, setScreen,
  } = useGame();

  const [mode, setMode]               = useState<GameMode>('classic');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [loadingLB, setLoadingLB]     = useState(false);

  const handleShowLeaderboard = async () => {
    setLoadingLB(true);
    await fetchLeaderboard();
    setLoadingLB(false);
    setShowLeaderboard(true);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">{session?.username}</h2>
              {isGuest && (
                <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                  Guest
                </span>
              )}
            </div>
            <p className="text-gray-600 text-xs mt-0.5">
              {isGuest ? 'Playing as guest — wins not saved' : 'Ranked player'}
            </p>
          </div>
          <button
            onClick={logout}
            className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
          >
            Log out
          </button>
        </div>

        {/* Mode selector */}
        <div className="bg-gray-900 rounded-xl p-1 flex mb-6">
          <button
            onClick={() => setMode('classic')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'classic' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >Classic</button>
          <button
            onClick={() => setMode('timed')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'timed' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >⏱ Timed (30s)</button>
        </div>

        <button
          onClick={() => findMatch(mode)}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-colors text-base mb-3"
        >
          Find Match
        </button>

        <button
          onClick={() => setScreen('rooms')}
          className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl transition-colors text-sm mb-3"
        >
          🚪 Browse / Create Rooms
        </button>

        {!isGuest && (
          <button
            onClick={handleShowLeaderboard}
            disabled={loadingLB}
            className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 font-medium py-3 rounded-xl transition-colors text-sm"
          >
            {loadingLB ? 'Loading...' : '🏆 Leaderboard'}
          </button>
        )}

      </div>

      {/* ── Leaderboard modal ── */}
      {showLeaderboard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setShowLeaderboard(false)}
        >
          <div
            className="bg-gray-900 rounded-2xl w-full max-w-sm p-5 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">🏆 Leaderboard</h3>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >×</button>
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">No records yet.</p>
                <p className="text-gray-600 text-xs mt-1">Play some games to appear here!</p>
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div className="flex items-center px-3 pb-2 mb-1 border-b border-gray-800">
                  <span className="text-gray-600 text-xs w-6">#</span>
                  <span className="text-gray-600 text-xs flex-1">Player</span>
                  <div className="flex gap-3 text-gray-600 text-xs">
                    <span className="w-6 text-center">W</span>
                    <span className="w-6 text-center">L</span>
                    <span className="w-6 text-center">D</span>
                    <span className="w-14 text-center">Best</span>
                    <span className="w-12 text-center">WR%</span>
                  </div>
                </div>

                {/* Top 10 rows */}
                <div className="space-y-1 mb-3">
                  {leaderboard.map((entry, i) => {
                    const isMe = entry.userId === session?.user_id;
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                    return (
                      <div
                        key={entry.userId}
                        className={`flex items-center px-3 py-2 rounded-xl ${
                          isMe
                            ? 'bg-indigo-900/40 border border-indigo-700/40'
                            : i === 0
                              ? 'bg-yellow-900/20 border border-yellow-800/20'
                              : 'bg-gray-800'
                        }`}
                      >
                        <span className="text-xs w-6 text-gray-500">
                          {medal ?? `#${entry.rank}`}
                        </span>
                        <span className={`text-sm flex-1 truncate font-medium ${isMe ? 'text-indigo-300' : 'text-white'}`}>
                          {entry.username}{isMe ? ' (you)' : ''}
                        </span>
                        <div className="flex gap-3 text-sm">
                          <span className="w-6 text-center text-green-400 font-semibold">{entry.wins}</span>
                          <span className="w-6 text-center text-red-400">{entry.losses}</span>
                          <span className="w-6 text-center text-gray-400">{entry.draws}</span>
                          <span className="w-14 text-center text-amber-400">
                            {entry.bestStreak > 1 ? `⭐ ${entry.bestStreak}` : '—'}
                          </span>
                          <span className="w-12 text-center text-gray-400">{entry.winRate}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Personal rank card — shown only if player is outside top 10 */}
                {myLeaderboardRecord && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-px bg-gray-800" />
                      <span className="text-gray-600 text-xs">your rank</span>
                      <div className="flex-1 h-px bg-gray-800" />
                    </div>
                    <div className="flex items-center px-3 py-2.5 rounded-xl bg-indigo-900/40 border border-indigo-700/40">
                      <span className="text-xs w-6 text-gray-500">#{myLeaderboardRecord.rank}</span>
                      <span className="text-sm flex-1 truncate font-medium text-indigo-300">
                        {myLeaderboardRecord.username} (you)
                      </span>
                      <div className="flex gap-3 text-sm">
                        <span className="w-6 text-center text-green-400 font-semibold">{myLeaderboardRecord.wins}</span>
                        <span className="w-6 text-center text-red-400">{myLeaderboardRecord.losses}</span>
                        <span className="w-6 text-center text-gray-400">{myLeaderboardRecord.draws}</span>
                        <span className="w-14 text-center text-amber-400">
                          {myLeaderboardRecord.bestStreak > 1 ? `⭐ ${myLeaderboardRecord.bestStreak}` : '—'}
                        </span>
                        <span className="w-12 text-center text-gray-400">{myLeaderboardRecord.winRate}</span>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            <button
              onClick={async () => { setLoadingLB(true); await fetchLeaderboard(); setLoadingLB(false); }}
              className="w-full mt-4 text-gray-600 hover:text-gray-400 text-xs transition-colors"
            >
              {loadingLB ? 'Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
