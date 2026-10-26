export const SESSION_KEY = "ramsport-session";

export type AccountRole = "admin" | "user";

export type AccountSession = { username: string; accountId: string; role: AccountRole; signedInAt: string };

/**
 * Legacy account id used by the original local login. Still needed so that data
 * saved before the admin user directory existed can be re-keyed on first sign-in.
 */
export async function createLegacyAccountId(username: string, password: string) {
  const identity = `${username.trim().toLocaleLowerCase()}\u0000${password}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function readAccountSession(): AccountSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(SESSION_KEY);
    const parsed = value ? JSON.parse(value) as Partial<AccountSession> : null;
    if (!parsed?.username || !parsed.accountId) return null;
    return { username: parsed.username, accountId: parsed.accountId, role: parsed.role === "admin" ? "admin" : "user", signedInAt: parsed.signedInAt || new Date().toISOString() };
  } catch { return null; }
}

export function saveAccountSession(session: AccountSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearAccountSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function accountStorageKey(resource: string) {
  const session = readAccountSession();
  return session ? `ramsport:account:${session.accountId}:${resource}` : null;
}

/**
 * Moves records written under the old credential hash onto the user id issued by
 * the user directory, so existing registers and diagrams stay visible.
 */
export function migrateAccountData(legacyAccountId: string, accountId: string) {
  if (typeof window === "undefined" || !legacyAccountId || legacyAccountId === accountId) return;
  try {
    const legacyPrefix = `ramsport:account:${legacyAccountId}:`;
    const targetPrefix = `ramsport:account:${accountId}:`;
    const pending: Array<{ from: string; to: string }> = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(legacyPrefix)) pending.push({ from: key, to: `${targetPrefix}${key.slice(legacyPrefix.length)}` });
    }
    for (const { from, to } of pending) {
      const value = window.localStorage.getItem(from);
      if (value === null) continue;
      if (window.localStorage.getItem(to) === null) window.localStorage.setItem(to, value);
      window.localStorage.removeItem(from);
    }
  } catch {
    // Migration is best-effort; a failure must never block sign-in.
  }
}
