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
const SS_GUEST_DEVICE_ID = "nk_guest_device_id";

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

function getGuestDeviceIdForTab(): string {
  let id = sessionStorage.getItem(SS_GUEST_DEVICE_ID);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SS_GUEST_DEVICE_ID, id);
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
  // Use a per-tab device id so two tabs can act as two players in local testing.
  return client.authenticateDevice(getGuestDeviceIdForTab(), true, guestName);
}

export async function createSocket(session: Session) {
  const socket = client.createSocket(USE_SSL, false);
  await socket.connect(session, true);
  return socket;
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const trimmed = username.trim();
  if (!trimmed) return false;

  const protocol = USE_SSL ? "https" : "http";
  const url = `${protocol}://${HOST}:${PORT}/v2/rpc/check_username?http_key=${encodeURIComponent(SERVER_KEY)}&unwrap=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: trimmed }),
  });

  if (!res.ok) throw new Error("username check failed");
  const raw = await res.json() as unknown;

  let body: { exists?: boolean; valid?: boolean } = {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      body = (parsed && typeof parsed === "object") ? parsed as { exists?: boolean; valid?: boolean } : {};
    } catch {
      body = {};
    }
  } else if (raw && typeof raw === "object") {
    body = raw as { exists?: boolean; valid?: boolean };
  }

  return !!body.valid && body.exists !== true;
}
