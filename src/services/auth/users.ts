import type { AccountRole } from "./session";

export const USERS_KEY = "ramsport-users";
export const USERS_UPDATED_EVENT = "ramsport-users-updated";

export type StoredUser = {
  id: string;
  username: string;
  usernameKey: string;
  role: AccountRole;
  salt: string;
  hash: string;
  createdAt: string;
  createdBy: string;
};

const PBKDF2_ITERATIONS = 150000;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;

/**
 * The built-in administrator is stored as a PBKDF2 hash so the password itself is
 * never written into the source, the bundle or browser storage.
 * To change it, generate a new salt/hash pair rather than editing a plain string.
 */
const ADMIN_BOOTSTRAP = {
  username: "siva905",
  salt: "lzBP1OQ/LvtNK4defDCFcA==",
  hash: "zMhwvm/1KyqVAactIseAQAfCQQTUxWwqnQlG9CIm9Bg=",
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
  const saltBytes = new Uint8Array(salt);
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, keyMaterial, 256);
  return toBase64(new Uint8Array(bits));
}

function equalHashes(first: string, second: string) {
  if (first.length !== second.length) return false;
  let mismatch = 0;
  for (let index = 0; index < first.length; index += 1) mismatch |= first.charCodeAt(index) ^ second.charCodeAt(index);
  return mismatch === 0;
}

function readUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = window.localStorage.getItem(USERS_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) ? parsed.filter((user): user is StoredUser => Boolean(user?.id && user?.usernameKey)) : [];
  } catch { return []; }
}

function writeUsers(users: StoredUser[]) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  window.dispatchEvent(new CustomEvent(USERS_UPDATED_EVENT, { detail: users }));
}

function usernameKey(username: string) {
  return username.trim().toLocaleLowerCase();
}

function ensureAdminUser(users: StoredUser[]) {
  const key = usernameKey(ADMIN_BOOTSTRAP.username);
  if (users.some(user => user.usernameKey === key)) return users;
  const admin: StoredUser = {
    id: crypto.randomUUID(),
    username: ADMIN_BOOTSTRAP.username,
    usernameKey: key,
    role: "admin",
    salt: ADMIN_BOOTSTRAP.salt,
    hash: ADMIN_BOOTSTRAP.hash,
    createdAt: new Date().toISOString(),
    createdBy: "system",
  };
  const next = [...users, admin];
  writeUsers(next);
  return next;
}

export function listUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  return ensureAdminUser(readUsers());
}

export async function authenticate(username: string, password: string): Promise<StoredUser | null> {
  if (!username.trim() || !password) return null;
  const users = listUsers();
  const user = users.find(item => item.usernameKey === usernameKey(username));
  if (!user) return null;
  const hash = await derivePasswordHash(password, fromBase64(user.salt));
  return equalHashes(hash, user.hash) ? user : null;
}

export type NewUserInput = { username: string; password: string; role: AccountRole; createdBy: string };

export async function createUser({ username, password, role, createdBy }: NewUserInput): Promise<StoredUser> {
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 32) throw new Error("Username must be between 3 and 32 characters.");
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) throw new Error("Username can use letters, numbers, dot, dash and underscore only.");
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (password.length > MAX_PASSWORD_LENGTH) throw new Error(`Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`);

  const users = listUsers();
  if (users.some(user => user.usernameKey === usernameKey(trimmed))) throw new Error("That username is already in use.");

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const created: StoredUser = {
    id: crypto.randomUUID(),
    username: trimmed,
    usernameKey: usernameKey(trimmed),
    role,
    salt: toBase64(salt),
    hash: await derivePasswordHash(password, salt),
    createdAt: new Date().toISOString(),
    createdBy,
  };
  writeUsers([...users, created]);
  return created;
}

export function removeUser(id: string, actorId: string) {
  const users = listUsers();
  const target = users.find(user => user.id === id);
  if (!target) throw new Error("That user no longer exists.");
  if (target.id === actorId) throw new Error("You cannot remove the account you are signed in with.");
  if (target.usernameKey === usernameKey(ADMIN_BOOTSTRAP.username)) throw new Error("The built-in administrator cannot be removed.");
  writeUsers(users.filter(user => user.id !== id));
}

export function isBuiltInAdmin(user: StoredUser) {
  return user.usernameKey === usernameKey(ADMIN_BOOTSTRAP.username);
}
