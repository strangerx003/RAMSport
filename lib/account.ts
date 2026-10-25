export const SESSION_KEY = "ramsport-session";

export type AccountSession = { username: string; accountId: string; signedInAt: string };

export async function createAccountId(username: string, password: string) {
  const identity = `${username.trim().toLocaleLowerCase()}\u0000${password}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function readAccountSession(): AccountSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(SESSION_KEY);
    const parsed = value ? JSON.parse(value) as Partial<AccountSession> : null;
    return parsed?.username && parsed.accountId ? parsed as AccountSession : null;
  } catch { return null; }
}

export function accountStorageKey(resource: string) {
  const session = readAccountSession();
  return session ? `ramsport:account:${session.accountId}:${resource}` : null;
}
