import { useState } from 'react';
import { useGame, GameMode } from '../context/GameContext';

export default function RoomBrowserScreen() {
  const { createRoom, joinRoomByCode, setScreen, statusMessage } = useGame();
  const [tab, setTab] = useState<'join' | 'create'>('join');
  const [loading, setLoading] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<GameMode>('classic');

  const handleCreate = async () => {
    if (!roomName.trim()) return;
    setLoading(true);
    await createRoom(roomName.trim(), mode);
    setLoading(false);
  };

  const handleJoinByCode = async () => {
    if (!roomCode.trim()) return;
    setLoading(true);
    await joinRoomByCode(roomCode.trim().toUpperCase());
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <button
        onClick={() => setScreen('lobby')}
        className="fixed top-4 left-4 z-40 bg-gray-900/90 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 text-xs px-3 py-2 rounded-lg transition-colors"
      >
        ← Back
      </button>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Game Rooms</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRoomCode('')}
              className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="bg-gray-900 rounded-xl p-1 flex mb-5">
          <button
            onClick={() => setTab('join')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'join' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Join by Code
          </button>
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'create' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Create Room
          </button>
        </div>

        {tab === 'join' && (
          <div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinByCode()}
                placeholder="Enter room code"
                maxLength={6}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm uppercase"
              />
              <button
                onClick={handleJoinByCode}
                disabled={loading || !roomCode.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-400 text-white text-sm font-medium px-3 rounded-lg transition-colors"
              >
                Join
              </button>
            </div>
            {statusMessage && (
              <p className={`text-center text-xs ${statusMessage.toLowerCase().includes('failed') || statusMessage.toLowerCase().includes('not found') ? 'text-red-400' : 'text-gray-400'}`}>
                {statusMessage}
              </p>
            )}
          </div>
        )}

        {tab === 'create' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Room name (e.g. Battle Room)"
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              maxLength={32}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 text-sm"
            />

            <div className="bg-gray-900 rounded-xl p-1 flex">
              <button
                onClick={() => setMode('classic')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'classic' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Classic
              </button>
              <button
                onClick={() => setMode('timed')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'timed' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                ⏱ Timed
              </button>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading || !roomName.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              {loading ? 'Creating...' : 'Create & Wait for Player'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
