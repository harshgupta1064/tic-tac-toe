import { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';

type Tab = 'login' | 'register';

export default function AuthScreen() {
  const { login, register, checkUsername, continueAsGuest, errorMessage } = useGame();
  const [tab, setTab]               = useState<Tab>('login');
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [localError, setLocalError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  const displayError = localError || errorMessage;
  const trimmedUsername = username.trim();
  const usernameTooShort = trimmedUsername.length < 3;

  useEffect(() => {
    if (tab !== 'register') {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    if (!trimmedUsername || usernameTooShort) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    let active = true;
    setCheckingUsername(true);
    setUsernameAvailable(null);
    const timer = window.setTimeout(async () => {
      try {
        const available = await checkUsername(trimmedUsername);
        if (!active) return;
        setUsernameAvailable(available);
      } catch {
        if (!active) return;
        setUsernameAvailable(null);
      } finally {
        if (!active) return;
        setCheckingUsername(false);
      }
    }, 400);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [tab, trimmedUsername, usernameTooShort, checkUsername]);

  const registerDisabled =
    loading ||
    usernameTooShort ||
    password.length < 6 ||
    password !== confirm ||
    checkingUsername ||
    usernameAvailable === false ||
    usernameAvailable === null;

  // Username input border class
  const getUsernameBorderClass = () => {
    if (tab !== 'register' || !trimmedUsername || usernameTooShort) return 'border-gray-800';
    if (checkingUsername) return 'border-gray-600';
    if (usernameAvailable === true) return 'border-green-500';
    if (usernameAvailable === false) return 'border-red-500';
    return 'border-gray-800';
  };

  // Inline status icon inside the input
  const getUsernameIcon = () => {
    if (tab !== 'register' || !trimmedUsername || usernameTooShort) return null;
    if (checkingUsername) return (
      <span className="text-gray-400 text-xs select-none animate-spin inline-block">⟳</span>
    );
    if (usernameAvailable === true) return (
      <span className="text-green-400 text-sm font-bold select-none">✓</span>
    );
    if (usernameAvailable === false) return (
      <span className="text-red-400 text-sm font-bold select-none">✕</span>
    );
    return null;
  };

  // Status message below username input
  const getUsernameStatusMsg = () => {
    if (tab !== 'register') return null;
    if (!trimmedUsername) return null;
    if (usernameTooShort) return (
      <p className="text-xs text-gray-500 mt-1 ml-1">Username must be at least 3 characters.</p>
    );
    if (checkingUsername) return (
      <p className="text-xs text-gray-400 mt-1 ml-1">Checking username...</p>
    );
    if (usernameAvailable === true) return (
      <p className="text-xs text-green-400 mt-1 ml-1 flex items-center gap-1">
        <span>✓</span> <span><strong>{trimmedUsername}</strong> is available</span>
      </p>
    );
    if (usernameAvailable === false) return (
      <p className="text-xs text-red-400 mt-1 ml-1 flex items-center gap-1">
        <span>✕</span> <span><strong>{trimmedUsername}</strong> is already taken</span>
      </p>
    );
    return null;
  };

  const handleSubmit = async () => {
    setLocalError('');
    if (!username.trim())    { setLocalError('Username is required.'); return; }
    if (password.length < 6) { setLocalError('Password must be at least 6 characters.'); return; }
    if (tab === 'register' && password !== confirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (tab === 'register' && usernameAvailable === false) {
      setLocalError('That username is already taken. Please choose a different one.');
      return;
    }
    if (tab === 'register' && usernameAvailable !== true) {
      setLocalError('Please wait for username check to complete.');
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
    setUsernameAvailable(null);
    setCheckingUsername(false);
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
          {/* Username field with inline icon */}
          <div>
            <div className="relative">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  if (tab === 'register') setUsernameAvailable(null);
                }}
                autoCapitalize="none"
                autoCorrect="off"
                maxLength={24}
                className={`w-full bg-gray-900 border rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none text-sm transition-colors pr-9 ${getUsernameBorderClass()}`}
              />
              {/* Icon badge inside the input on the right */}
              {tab === 'register' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {getUsernameIcon()}
                </span>
              )}
            </div>
            {/* Status message below */}
            {getUsernameStatusMsg()}
          </div>

          <input type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && tab === 'login') handleSubmit(); }}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 text-sm" />
          {tab === 'register' && (
            <div>
              <input type="password" placeholder="Confirm password" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                className={`w-full bg-gray-900 border rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none text-sm transition-colors ${
                  confirm && password !== confirm ? 'border-red-500' : 'border-gray-800 focus:border-indigo-500'
                }`} />
              {confirm && password !== confirm && (
                <p className="text-xs text-red-400 mt-1 ml-1 flex items-center gap-1">
                  <span>✕</span> <span>Passwords do not match</span>
                </p>
              )}
              {confirm && password === confirm && confirm.length >= 6 && (
                <p className="text-xs text-green-400 mt-1 ml-1 flex items-center gap-1">
                  <span>✓</span> <span>Passwords match</span>
                </p>
              )}
            </div>
          )}
        </div>

        {displayError && (
          <p className="text-red-400 text-xs mt-2 text-center">{displayError}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={tab === 'register' ? registerDisabled : loading}
          className="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
        >
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
