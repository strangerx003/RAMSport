"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/lib/icons";
import { createAccountId, SESSION_KEY } from "@/lib/account";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) { setError("Enter a username and password to continue."); return; }
    const accountId = await createAccountId(username, password);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username: username.trim(), accountId, signedInAt: new Date().toISOString() }));
    router.push("/dashboard");
  }

  return <main className="login-page">
    <section className="login-visual">
      <div className="login-brand"><div className="brand-mark">R</div><div><strong>RAMSport</strong><span>Engineering Suite</span></div></div>
      <div className="visual-copy">
        <span className="secure-pill"><Icons.shield/> Engineering confidence, built in</span>
        <h1>Reliability decisions.<br/><em>Clearly connected.</em></h1>
        <p>Integrated reliability, availability, maintainability and safety engineering.</p>
        <div className="standard-row"><span>EN 50126</span><span>IEC 61078</span><span>IEC 61025</span><span>MIL-STD-882E</span></div>
      </div>
      <div className="network-art" aria-hidden="true"><svg viewBox="0 0 800 430"><path d="M50 290H190V170H325V260H470V115H650V235H770"/><path d="M190 290v65h280v-95M325 170V90h145v25"/><circle cx="190" cy="170" r="12"/><circle cx="325" cy="260" r="12"/><circle cx="470" cy="115" r="12"/><circle cx="650" cy="235" r="12"/></svg></div>
      <small className="login-footer">© 2026 RAMSport · Engineering systems you can trust</small>
    </section>
    <section className="login-panel">
      <form className="login-card" onSubmit={submit}>
        <div className="mobile-brand"><div className="brand-mark">R</div><strong>RAMSport</strong></div>
        <p className="eyebrow">SECURE ACCESS</p><h2>Welcome back</h2><p className="muted">Sign in to continue to RAMSport.</p>
        <label>Username<input value={username} onChange={event => setUsername(event.target.value)} placeholder="Username" autoComplete="username" autoFocus/></label>
        <label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password"/><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button login-button" type="submit">Sign in <span>→</span></button>
      </form>
    </section>
  </main>;
}
