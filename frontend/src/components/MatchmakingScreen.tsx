import { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';

export default function MatchmakingScreen() {
  const { statusMessage, setScreen } = useGame();
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="text-center">
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-full border-4 border-gray-700 border-t-indigo-500 animate-spin mx-auto" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Finding opponent{dots}
        </h2>
        <p className="text-gray-400 text-sm">{statusMessage || 'Searching for a match'}</p>
        <button
          onClick={() => setScreen('lobby')}
          className="mt-10 text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
