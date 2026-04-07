import { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';

export default function MatchmakingScreen() {
  const { statusMessage, activeRoomCode, deleteActiveRoom, setScreen } = useGame();
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
        {activeRoomCode && (
          <div className="mt-6 bg-gray-900 border border-indigo-700/50 rounded-xl px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Room Code</p>
            <p className="text-3xl font-mono font-bold text-indigo-300 tracking-[0.25em]">{activeRoomCode}</p>
            <p className="text-xs text-gray-500 mt-2">Share this code with your friend to join.</p>
          </div>
        )}
        <button
          onClick={() => {
            if (activeRoomCode) {
              deleteActiveRoom();
            } else {
              setScreen('lobby');
            }
          }}
          className="mt-10 text-gray-500 hover:text-gray-300 text-sm transition-colors"
        >
          {activeRoomCode ? 'Delete Room' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
