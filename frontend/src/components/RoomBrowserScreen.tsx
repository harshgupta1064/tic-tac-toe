import { useEffect, useState } from 'react';
import { useGame, GameMode, Room } from '../context/GameContext';

export default function RoomBrowserScreen() {
  const { fetchRooms, rooms, joinRoom, createRoom, setScreen, statusMessage } = useGame();
  const [tab, setTab] = useState<'browse' | 'create'>('browse');
  const [loading, setLoading] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [mode, setMode] = useState<GameMode>('classic');

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleJoin = async (room: Room) => {
    setLoading(true);
    await joinRoom(room);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!roomName.trim()) return;
    setLoading(true);
    await createRoom(roomName.trim(), mode);
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Game Rooms</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchRooms()}
              className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => setScreen('lobby')}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="bg-gray-900 rounded-xl p-1 flex mb-5">
          <button
            onClick={() => setTab('browse')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'browse' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Browse ({rooms.length})
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

        {tab === 'browse' && (
          <div>
            {statusMessage && (
              <p className="text-center text-xs text-gray-400 mb-3">{statusMessage}</p>
            )}
            {rooms.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                <div className="text-3xl mb-3">🏜️</div>
                No open rooms right now.
                <br />
                <button
                  onClick={() => setTab('create')}
                  className="text-indigo-400 hover:text-indigo-300 mt-2 inline-block"
                >
                  Create one!
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map(room => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3"
                  >
                    <div>
                      <p className="text-white text-sm font-medium">{room.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {room.hostUsername} · {room.mode === 'timed' ? '⏱ Timed' : 'Classic'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleJoin(room)}
                      disabled={loading}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
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
