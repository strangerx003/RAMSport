"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { Icons } from "@/lib/icons";
import { AccountRole, AccountSession, readAccountSession } from "@/services/auth/session";
import { createUser, isBuiltInAdmin, listUsers, removeUser, StoredUser, USERS_UPDATED_EVENT } from "@/services/auth/users";

function formatCreated(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<AccountSession | null>(null);
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AccountRole>("user");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = readAccountSession();
    if (!stored) { router.replace("/"); return; }
    if (stored.role !== "admin") { router.replace("/dashboard"); return; }
    setSession(stored);
    setUsers(listUsers());
    const refresh = () => setUsers(listUsers());
    window.addEventListener(USERS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(USERS_UPDATED_EVENT, refresh);
  }, [router]);

  async function addUser(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const created = await createUser({ username, password, role, createdBy: session.username });
      setUsers(listUsers());
      setUsername("");
      setPassword("");
      setRole("user");
      setNotice(`${created.username} can now sign in to RAMSport.`);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The user could not be created.");
    } finally {
      setBusy(false);
    }
  }

  function deleteUser(target: StoredUser) {
    if (!session) return;
    if (!window.confirm(`Remove ${target.username}? They will no longer be able to sign in. Their saved diagrams stay in this browser.`)) return;
    setError("");
    setNotice("");
    try {
      removeUser(target.id, session.accountId);
      setUsers(listUsers());
      setNotice(`${target.username} was removed.`);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "The user could not be removed.");
    }
  }

  if (!session || session.role !== "admin") return <div className="boot-screen"><div className="brand-mark small">R</div><span>Checking access…</span></div>;

  return (
    <AppShell title="User Management" eyebrow="ADMINISTRATION">
      <main className="admin-users" aria-label="RAMSport user management">
        <div className="admin-users-grid">
          <section className="admin-users-card">
            <h2>Add a user</h2>
            <p className="admin-hint">These credentials sign in to the RAMSport workspace.</p>
            {error && <div className="admin-error" role="alert">{error}</div>}
            {notice && <div className="admin-success" role="status">{notice}</div>}
            <form onSubmit={addUser}>
              <label>Username
                <input value={username} onChange={event => setUsername(event.target.value)} placeholder="e.g. ramesh.k" autoComplete="off" autoCapitalize="none" spellCheck={false}/>
              </label>
              <label>Password
                <input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete="new-password"/>
              </label>
              <label>Access level
                <select value={role} onChange={event => setRole(event.target.value as AccountRole)}>
                  <option value="user">Standard user</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <button className="primary-button" type="submit" disabled={busy}>{busy ? "Adding…" : "Add user"} <Icons.plus/></button>
            </form>
          </section>

          <section className="admin-users-card">
            <h2>Accounts <span className="admin-role">{users.length}</span></h2>
            <p className="admin-hint">Administrators can add and remove users. Standard users only see the engineering tools.</p>
            <ul className="admin-user-list">
              {users.map(user => {
                const privileged = user.role === "admin";
                const removable = user.id !== session.accountId && !isBuiltInAdmin(user);
                return <li className="admin-user-row" key={user.id}>
                  <span className={`admin-user-avatar${privileged ? " admin" : ""}`}>{user.username.slice(0, 2).toUpperCase()}</span>
                  <span className="admin-user-copy">
                    <strong>{user.username}</strong>
                    <small>Added {formatCreated(user.createdAt)}{user.createdBy !== "system" ? ` by ${user.createdBy}` : ""}</small>
                  </span>
                  <span className={`admin-role${privileged ? " admin" : ""}`}>{privileged ? "Admin" : "User"}</span>
                  <button className="admin-remove" type="button" onClick={() => deleteUser(user)} disabled={!removable} title={removable ? `Remove ${user.username}` : "This account cannot be removed"}>
                    <Icons.logout/>
                  </button>
                </li>;
              })}
            </ul>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
