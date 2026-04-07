import { useState } from 'react';
import { useGame } from '../context/GameContext';

export default function AuthScreen() {
  const { login, statusMessage } = useGame();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim()) return;
    setLoading(true);
    await login(username.trim());
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">⚔️</div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Tic-Tac-Toe</h1>
          <p className="text-gray-400 mt-2 text-sm">Multiplayer · Real-time · Competitive</p>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-base"
            maxLength={20}
          />
          <button
            onClick={handleLogin}
            disabled={loading || !username.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition-colors text-base"
          >
            {loading ? 'Connecting...' : 'Play Now'}
          </button>
        </div>

        {statusMessage && (
          <p className="text-red-400 text-sm text-center mt-4">{statusMessage}</p>
        )}
      </div>
    </div>
  );
}
