import { Client, Session, Socket } from '@heroiclabs/nakama-js';

// Read from environment (Vite exposes VITE_* vars)
const HOST = import.meta.env.VITE_NAKAMA_HOST || '127.0.0.1';
const PORT = parseInt(import.meta.env.VITE_NAKAMA_PORT || '7350');
const USE_SSL = import.meta.env.VITE_NAKAMA_USE_SSL === 'true';
const SERVER_KEY = import.meta.env.VITE_NAKAMA_SERVER_KEY || 'defaultkey';

export const client = new Client(SERVER_KEY, HOST, PORT, USE_SSL);

export async function createSocket(session: Session): Promise<Socket> {
  const socket = client.createSocket(USE_SSL, false);
  await socket.connect(session, true);
  return socket;
}
