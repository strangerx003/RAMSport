"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { readAccountSession } from "@/services/auth/session";
import { projects } from "@/data/projects";
import { Icons } from "@/lib/icons";

function accountName(value: string) {
  const name = value.trim().split(/\s+/)[0] || "Engineer";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function dayGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const [selectedId, setSelectedId] = useState(projects[0].id);
  const [user, setUser] = useState("Engineer");
  const [greeting, setGreeting] = useState("Good morning");
  const project = useMemo(() => projects.find((item) => item.id === selectedId) || projects[0], [selectedId]);
  const fileCount = projects.reduce((total, item) => total + item.files.length, 0);

  useEffect(() => {
    setUser(accountName(readAccountSession()?.username || "Engineer"));
    setGreeting(dayGreeting(new Date().getHours()));
  }, []);

  return (
    <AppShell title="Dashboard" eyebrow="PROJECT PORTFOLIO">
      <main className="agndex-rams" aria-label="RAMSport project dashboard">
        <header className="agndex-rams-intro">
          <p className="agndex-rams-eyebrow">RAMSPORT ENGINEERING</p>
          <h2>{greeting}, Mr. {user}</h2>
          <p>Manage reliability analysis documents for the selected engineering project.</p>
        </header>

        <div className="agndex-rams-projects" role="tablist" aria-label="Available projects">
          {projects.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={item.id === project.id} className={item.id === project.id ? "selected" : ""} onClick={() => setSelectedId(item.id)}>
              <Icons.grid />
              <span><strong>{item.name}</strong><small>{item.id} · {item.client}</small></span>
            </button>
          ))}
        </div>

        <section className="agndex-rams-meta" aria-label="Selected project summary">
          <div><span className="agndex-rams-meta-icon"><Icons.grid /></span><span><small>PROJECT</small><strong>{project.name}</strong></span></div>
          <div><span className="agndex-rams-meta-icon"><Icons.shield /></span><span><small>CLIENT</small><strong>{project.client}</strong></span></div>
          <div><span className="agndex-rams-meta-icon"><Icons.table /></span><span><small>DELIVERABLES</small><strong>{project.files.length} documents</strong></span></div>
          <div><span className="agndex-rams-meta-icon"><Icons.rbd /></span><span><small>PORTFOLIO</small><strong>{fileCount} available files</strong></span></div>
        </section>

        <div className="agndex-rams-rule" />

        <section className="agndex-rams-documents">
          <header>
            <div><div className="agndex-rams-title"><Icons.table /><h3>Project documents</h3><span>{project.files.length} active</span></div><p>Open an analysis or maintain its source component register.</p></div>
            <span className="agndex-rams-updated">Updated {project.updated}</span>
          </header>
          <div className="agndex-rams-list">
            {project.files.map((file) => {
              const FileIcon = file.kind === "RBD" ? Icons.rbd : file.kind === "FTA" ? Icons.fta : Icons.table;
              return <Link href={file.href} key={file.name} aria-label={`Open ${file.name}`}><span className={`agndex-rams-file-icon ${file.kind.toLowerCase()}`}><FileIcon /></span><span className="agndex-rams-file-copy"><strong>{file.name}</strong><small>{file.kind === "Register" ? "Component data register" : `${file.kind} analysis document`}</small></span><span className="agndex-rams-file-date">{project.updated}</span><span className="agndex-rams-open">Open <Icons.chevron /></span></Link>;
            })}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
