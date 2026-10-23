"use client";

import { useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Icons } from "@/lib/icons";

const projects = [
  { id: "GMRC", name: "GMRC System Assurance", client: "Metro Programme", updated: "Today, 10:42", files: [{ name: "01_GMRC", kind: "RBD", href: "/rbd" }, { name: "02_GMRC", kind: "FTA", href: "/fta" }, { name: "GMRC Component Register", kind: "Register", href: "/data-register" }] },
  { id: "DEPOT", name: "Depot Power Analysis", client: "Power Systems", updated: "Yesterday", files: [{ name: "01_DEPOT", kind: "RBD", href: "/rbd" }, { name: "DEPOT Component Register", kind: "Register", href: "/data-register" }] },
  { id: "HVAC", name: "Rolling Stock HVAC", client: "Rolling Stock", updated: "21 Oct 2026", files: [{ name: "01_HVAC", kind: "FTA", href: "/fta" }, { name: "HVAC Component Register", kind: "Register", href: "/data-register" }] },
];

export default function Dashboard() {
  const [selected, setSelected] = useState(projects[0].id);
  const project = projects.find(item => item.id === selected) || projects[0];
  return <AppShell title="Projects" eyebrow="ENGINEERING PROJECTS" actions={<><button className="secondary-button">Open project</button><button className="primary-button"><Icons.plus/> New project</button></>}>
    <section className="project-home">
      <header className="project-home-header"><div><h2>Recent projects</h2><p>Select a project to continue its RAMS deliverables.</p></div></header>
      <div className="project-browser">
        <div className="project-list" role="listbox" aria-label="Projects">
          {projects.map(item => <button key={item.id} className={selected === item.id ? "selected" : ""} onClick={() => setSelected(item.id)}><span className="project-folder"><Icons.grid/></span><span><strong>{item.name}</strong><small>{item.id} · {item.client}</small><time>Updated {item.updated}</time></span></button>)}
        </div>
        <section className="project-detail"><div className="project-detail-title"><div><span>SELECTED PROJECT</span><h2>{project.name}</h2><p>{project.id} · {project.client}</p></div><button className="secondary-button">Project settings</button></div><div className="deliverable-head"><strong>Deliverables</strong><span>{project.files.length} files</span></div><div className="deliverable-list">{project.files.map(file => <Link href={file.href} key={file.name}><span className={`deliverable-icon ${file.kind.toLowerCase()}`}>{file.kind === "RBD" ? <Icons.rbd/> : file.kind === "FTA" ? <Icons.fta/> : <Icons.table/>}</span><span><strong>{file.name}</strong><small>{file.kind} deliverable</small></span><time>{project.updated}</time><b>Open →</b></Link>)}</div></section>
      </div>
    </section>
  </AppShell>;
}
