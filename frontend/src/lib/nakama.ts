import { Client, Session } from "@heroiclabs/nakama-js";

const HOST       = import.meta.env.VITE_NAKAMA_HOST       || "127.0.0.1";
const PORT       = parseInt(import.meta.env.VITE_NAKAMA_PORT || "7350");
const USE_SSL    = import.meta.env.VITE_NAKAMA_USE_SSL     === "true";
const SERVER_KEY = import.meta.env.VITE_NAKAMA_SERVER_KEY  || "defaultkey";

export const client = new Client(SERVER_KEY, HOST, PORT, USE_SSL);

const LS_TOKEN         = "nk_token";
const LS_REFRESH_TOKEN = "nk_refresh_token";
const LS_USERNAME      = "nk_username";
const LS_USER_ID       = "nk_user_id";

/** Persistent device ID — same device keeps the same account across page reloads. */
function getDeviceId(username: string): string {
  const key = `nk_device_id_${username.toLowerCase().trim()}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function saveSession(session: Session, username: string): void {
  sessionStorage.setItem(LS_TOKEN, session.token);
  sessionStorage.setItem(LS_REFRESH_TOKEN, session.refresh_token || "");
  sessionStorage.setItem(LS_USERNAME, username);
  sessionStorage.setItem(LS_USER_ID, session.user_id || "");
}

export function clearSession(): void {
  [LS_TOKEN, LS_REFRESH_TOKEN, LS_USERNAME, LS_USER_ID].forEach((k) =>
    sessionStorage.removeItem(k)
  );
}

/**
 * Authenticate via device ID with a chosen display name.
 * Same device always maps to the same Nakama account — stats persist.
 */
export async function loginWithUsername(username: string): Promise<Session> {
  const deviceId = getDeviceId(username);
  return client.authenticateDevice(deviceId, true, username);
}

/**
 * Restore a valid session from localStorage.
 * Returns null if nothing usable is stored.
 */
export async function restoreSession(): Promise<{
  session: Session;
  username: string;
  userId: string;
} | null> {
  const token        = sessionStorage.getItem(LS_TOKEN);
  const refreshToken = sessionStorage.getItem(LS_REFRESH_TOKEN);
  const username     = sessionStorage.getItem(LS_USERNAME) || "";
  const userId       = sessionStorage.getItem(LS_USER_ID)  || "";
  if (!token || !refreshToken) return null;
  try {
    let session = Session.restore(token, refreshToken);
    if (session.isexpired(Date.now() / 1000)) {
      session = await client.sessionRefresh(session);
      saveSession(session, username);
    }
    return { session, username, userId: session.user_id || userId };
  } catch {
    clearSession();
    return null;
  }
}

export async function createSocket(session: Session) {
  const socket = client.createSocket(USE_SSL, false);
  await socket.connect(session, true);
  return socket;
}
