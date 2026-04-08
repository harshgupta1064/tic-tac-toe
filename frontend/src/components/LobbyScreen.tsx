import React, { useState } from 'react';
import { useGame, GameMode } from '../context/GameContext';

export default function LobbyScreen() {
  const {
    findMatch, 
    session, logout, setScreen,
  } = useGame();

  const [mode, setMode] = useState<GameMode>('classic');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <button
        onClick={logout}
        className="fixed top-4 left-4 z-40 bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs px-3 py-2 rounded-lg transition-colors"
      >
        Log out
      </button>
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-white">{session?.username}</h2>
            <p className="text-gray-600 text-xs mt-0.5">Session player</p>
          </div>
          <div />
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
          >⏱ Timed (10s)</button>
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

      </div>
    </div>
  );
}
