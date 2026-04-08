import { useState } from 'react';
import { useGame } from '../context/GameContext';

type Tab = 'login' | 'register';

export default function AuthScreen() {
  const { login, register, continueAsGuest, errorMessage } = useGame();
  const [tab, setTab]               = useState<Tab>('login');
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [localError, setLocalError] = useState('');

  const displayError = localError || errorMessage;

  const handleSubmit = async () => {
    setLocalError('');
    if (!username.trim())    { setLocalError('Username is required.'); return; }
    if (password.length < 6) { setLocalError('Password must be at least 6 characters.'); return; }
    if (tab === 'register' && password !== confirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    setLoading(true);
    if (tab === 'register') await register(username.trim(), password);
    else                    await login(username.trim(), password);
    setLoading(false);
  };

  const handleGuest = async () => {
    setLoading(true);
    await continueAsGuest();
    setLoading(false);
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setLocalError('');
    setPassword('');
    setConfirm('');
  };

  return (
    <div className="flex flex-col min-h-screen px-6 pt-8 pb-12 max-w-sm mx-auto w-full">

      {/* ── TOP: compact auth form ── */}
      <div>
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">⚔️</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Tic-Tac-Toe</h1>
          <p className="text-gray-600 text-xs mt-1">Multiplayer · Real-time · Competitive</p>
        </div>

        <div className="bg-gray-900 rounded-xl p-1 flex mb-4">
          <button
            onClick={() => switchTab('login')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'login' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >Log In</button>
          <button
            onClick={() => switchTab('register')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'register' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >Register</button>
        </div>

        <div className="space-y-2">
          <input type="text" placeholder="Username" value={username}
            onChange={e => setUsername(e.target.value)}
            autoCapitalize="none" autoCorrect="off" maxLength={24}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 text-sm" />
          <input type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && tab === 'login') handleSubmit(); }}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 text-sm" />
          {tab === 'register' && (
            <input type="password" placeholder="Confirm password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 text-sm" />
          )}
        </div>

        {displayError && (
          <p className="text-red-400 text-xs mt-2 text-center">{displayError}</p>
        )}

        <button onClick={handleSubmit} disabled={loading}
          className="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
          {loading
            ? (tab === 'register' ? 'Creating account...' : 'Logging in...')
            : (tab === 'register' ? 'Create Account' : 'Log In')}
        </button>
      </div>

      {/* ── CENTER: guest CTA ── */}
      <div className="flex-1 flex flex-col items-center justify-center py-10">
        <div className="flex items-center gap-3 w-full mb-8">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-700 text-xs">or</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <div className="text-center w-full">
          <p className="text-gray-400 text-sm mb-1">Just want to play?</p>
          <p className="text-gray-600 text-xs mb-5">No account needed. Jump straight into a game.</p>
          <button onClick={handleGuest} disabled={loading}
            className="w-full bg-gray-800 hover:bg-gray-700 active:bg-gray-600 disabled:opacity-40 text-white font-semibold py-4 rounded-2xl transition-colors text-base">
            🎮 Continue as Guest
          </button>
          <p className="text-gray-700 text-xs mt-3 leading-relaxed">
            Guest sessions are temporary. Wins are not saved to the leaderboard.
          </p>
        </div>
      </div>

    </div>
  );
}
