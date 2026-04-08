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
const LS_DEVICE_ID     = "nk_device_id";

export function saveSession(session: Session, username: string): void {
  localStorage.setItem(LS_TOKEN, session.token);
  localStorage.setItem(LS_REFRESH_TOKEN, session.refresh_token || "");
  localStorage.setItem(LS_USERNAME, username);
  localStorage.setItem(LS_USER_ID, session.user_id || "");
}

export function clearSession(): void {
  [LS_TOKEN, LS_REFRESH_TOKEN, LS_USERNAME, LS_USER_ID].forEach((k) => localStorage.removeItem(k));
}

export function getDeviceId(): string {
  let id = localStorage.getItem(LS_DEVICE_ID);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(LS_DEVICE_ID, id);
  }
  return id;
}

export async function restoreSession(): Promise<{
  session: Session;
  username: string;
  userId: string;
} | null> {
  const token = localStorage.getItem(LS_TOKEN);
  const refreshToken = localStorage.getItem(LS_REFRESH_TOKEN);
  const username = localStorage.getItem(LS_USERNAME) || "";
  const userId = localStorage.getItem(LS_USER_ID) || "";
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

export async function registerAccount(username: string, password: string): Promise<Session> {
  const email = username.toLowerCase() + "@tictactoe.local";
  return client.authenticateEmail(email, password, true, username);
}

export async function loginAccount(username: string, password: string): Promise<Session> {
  const email = username.toLowerCase() + "@tictactoe.local";
  return client.authenticateEmail(email, password, false, username);
}

export async function loginGuest(): Promise<Session> {
  const guestName = "Guest_" + Math.random().toString(36).substring(2, 7).toUpperCase();
  return client.authenticateDevice(getDeviceId(), true, guestName);
}

export async function createSocket(session: Session) {
  const socket = client.createSocket(USE_SSL, false);
  await socket.connect(session, true);
  return socket;
}
