import { useState } from 'react';
import { useGame } from '../context/GameContext';

export default function AuthScreen() {
  const { joinAsPlayer, errorMessage } = useGame();
  const [username, setUsername] = useState('');
  const [loading, setLoading]   = useState(false);

  const trimmed = username.trim();
  const isValid = trimmed.length >= 2 && trimmed.length <= 24;

  const handlePlay = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    await joinAsPlayer(trimmed);
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">⚔️</div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Tic-Tac-Toe</h1>
          <p className="text-gray-500 text-sm mt-2">Multiplayer · Real-time · Competitive</p>
        </div>

        {/* Name input */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Enter your name"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handlePlay(); }}
            autoCapitalize="words"
            autoCorrect="off"
            maxLength={24}
            className="w-full bg-gray-900 border border-gray-800 focus:border-indigo-500 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none text-base transition-colors"
          />

          {errorMessage && (
            <p className="text-red-400 text-xs text-center">{errorMessage}</p>
          )}

          <button
            onClick={handlePlay}
            disabled={!isValid || loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-3.5 rounded-xl transition-colors text-base"
          >
            {loading ? 'Connecting...' : '🎮 Play'}
          </button>
        </div>

        <p className="text-gray-700 text-xs text-center mt-6 leading-relaxed">
          Your name is saved on this device.<br />Stats and rank persist between sessions.
        </p>
      </div>
    </div>
  );
}
