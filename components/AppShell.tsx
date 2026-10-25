"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icons } from "@/lib/icons";
import { readAccountSession, SESSION_KEY } from "@/lib/account";

const nav = [
  { href: "/dashboard", label: "Projects", icon: Icons.grid },
  { href: "/data-register", label: "Data Register", icon: Icons.table },
  { href: "/rbd", label: "RBD", icon: Icons.rbd },
  { href: "/fta", label: "FTA", icon: Icons.fta },
];
const searchableItems = [
  ...nav,
  { href: "/rbd", label: "01_GMRC RBD", icon: Icons.rbd },
  { href: "/fta", label: "02_GMRC FTA", icon: Icons.fta },
  { href: "/data-register", label: "GMRC Component Register", icon: Icons.table },
  { href: "/dashboard", label: "Depot Power Analysis", icon: Icons.grid },
  { href: "/dashboard", label: "Rolling Stock HVAC", icon: Icons.grid },
];

export default function AppShell({ children, title, eyebrow, actions }: { children: React.ReactNode; title: string; eyebrow?: string; actions?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState("RAMS User");
  const [navSearch, setNavSearch] = useState("");

  useEffect(() => {
    const session = readAccountSession();
    if (!session) { router.replace("/"); return; }
    setUser(session.username || "RAMS User");
    setReady(true);
  }, [router]);

  function logout() { window.localStorage.removeItem(SESSION_KEY); router.replace("/"); }
  if (!ready) return <div className="boot-screen"><div className="brand-mark small">R</div><span>Loading RAMSport…</span></div>;

  const searchResults = navSearch.trim() ? searchableItems.filter(item => item.label.toLowerCase().includes(navSearch.toLowerCase())).slice(0, 7) : [];
  return <div className="app-layout">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">R</div><div><strong>RAMSport</strong><span>Engineering Suite</span></div></div>
      <label className="sidebar-search"><Icons.search/><input value={navSearch} onChange={event => setNavSearch(event.target.value)} placeholder="Search files and tools"/></label>
      {searchResults.length > 0 && <div className="sidebar-results">{searchResults.map((item, index) => { const ResultIcon = item.icon; return <Link href={item.href} prefetch={false} key={`${item.label}-${index}`} onClick={() => setNavSearch("")}><ResultIcon/><span>{item.label}</span></Link>; })}</div>}
      <div className="workspace-label">TOOLS</div>
      <nav>{nav.map(item => { const ActiveIcon = item.icon; const active = pathname === item.href; return <Link key={item.href} href={item.href} prefetch={false} className={active ? "nav-item active" : "nav-item"}><ActiveIcon/><span>{item.label}</span>{active && <i/>}</Link>; })}</nav>
      <div className="sidebar-spacer"/>
      <div className="sidebar-account"><span className="avatar">{user.slice(0, 2).toUpperCase()}</span><span className="user-copy"><strong>{user}</strong><small>My account</small></span><button onClick={logout} title="Sign out"><Icons.logout/></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="product-context"><strong>{title}</strong><span>RAMS engineering application</span></div></header>
      <section className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1></div>{actions && <div className="page-actions">{actions}</div>}</section>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}
