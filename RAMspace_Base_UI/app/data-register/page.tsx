"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import ExportDialog from "@/components/ExportDialog";
import { Icons } from "@/lib/icons";
import { Asset, componentAvailabilityPercent, readAssets, saveAssets, starterAssets } from "@/lib/workspace";

type ColumnKey = keyof Asset | "mtbf" | "availability" | "fit";
const columns: { key: ColumnKey; label: string; width: number; computed?: boolean }[] = [
  { key: "tag", label: "Component ID", width: 150 },
  { key: "description", label: "Description", width: 250 },
  { key: "system", label: "System", width: 150 },
  { key: "qty", label: "Quantity", width: 90 },
  { key: "lambda", label: "Failure rate λ (/h)", width: 155 },
  { key: "mtbf", label: "MTBF (h)", width: 135, computed: true },
  { key: "mttr", label: "MTTR (h)", width: 110 },
  { key: "availability", label: "Availability", width: 135, computed: true },
  { key: "fit", label: "FIT", width: 110, computed: true },
  { key: "mission", label: "Operating time (h)", width: 145 },
  { key: "criticality", label: "Criticality", width: 155 },
  { key: "status", label: "Status", width: 125 },
];

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "", quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += character;
  }
  values.push(value.trim());
  return values;
}

const aliases: Record<string, keyof Asset> = {
  id: "id", componentid: "tag", assetid: "tag", lruid: "tag", tag: "tag",
  description: "description", component: "description", name: "description",
  system: "system", subsystem: "system", quantity: "qty", qty: "qty",
  lambda: "lambda", failurerate: "lambda", failurerateh: "lambda",
  mttr: "mttr", mission: "mission", missiontime: "mission", operatingtime: "mission",
  criticality: "criticality", status: "status",
};

export default function DataRegister() {
  const [rows, setRows] = useState<Asset[]>(starterAssets);
  const [selected, setSelected] = useState({ row: 0, col: 0 });
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { setRows(readAssets()); setLoaded(true); }, []);
  useEffect(() => { if (loaded) { saveAssets(rows); setSaved(true); } }, [loaded, rows]);

  const filtered = useMemo(() => rows.filter(row => Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase())), [rows, query]);
  const selectedValue = filtered[selected.row] ? valueFor(filtered[selected.row], columns[selected.col]?.key || "tag") : "";
  const exportRows = rows.map(row => Object.fromEntries(columns.map(column => [column.key, valueFor(row, column.key)])));

  function valueFor(row: Asset, key: ColumnKey) {
    if (key === "mtbf") return row.lambda ? Math.round(1 / row.lambda).toLocaleString() : "—";
    if (key === "availability") return row.lambda ? componentAvailabilityPercent(row) : "—";
    if (key === "fit") return Math.round(row.lambda * 1e9).toLocaleString();
    return String(row[key]);
  }

  function update(rowIndex: number, key: keyof Asset, value: string) {
    const numeric = ["qty", "lambda", "mttr", "mission"].includes(key);
    setRows(current => current.map(row => row.id === filtered[rowIndex].id ? { ...row, [key]: numeric ? Number(value) : value } : row));
    setSaved(false);
  }

  function addRow() {
    setRows(current => [...current, { id: crypto.randomUUID(), tag: "NEW-COMPONENT", description: "New component", system: "Unassigned", qty: 1, lambda: 0, mttr: 0, mission: 8760, criticality: "Operational", status: "Draft" }]);
    setSaved(false);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) { setNotice("CSV import requires a header row and at least one component."); return; }
    const header = parseCsvLine(lines[0]).map(name => aliases[name.toLowerCase().replace(/[^a-z0-9]/g, "")]);
    const imported = lines.slice(1).map(line => {
      const values = parseCsvLine(line);
      const record: Partial<Asset> = {};
      header.forEach((key, index) => { if (key && values[index] !== undefined) (record as Record<string, string | number>)[key] = ["qty", "lambda", "mttr", "mission"].includes(key) ? Number(values[index]) : values[index]; });
      return record;
    }).filter(record => record.tag || record.description);
    setRows(current => {
      const merged = [...current];
      imported.forEach(record => {
        const match = merged.findIndex(row => row.tag.toLowerCase() === String(record.tag || "").toLowerCase());
        if (match >= 0) merged[match] = { ...merged[match], ...record };
        else merged.push({ id: String(record.id || crypto.randomUUID()), tag: String(record.tag || `COMP-${merged.length + 1}`), description: String(record.description || "Imported component"), system: String(record.system || "Unassigned"), qty: Number(record.qty || 1), lambda: Number(record.lambda || 0), mttr: Number(record.mttr || 0), mission: Number(record.mission || 8760), criticality: String(record.criticality || "Operational"), status: String(record.status || "Draft") });
      });
      return merged;
    });
    setNotice(`${imported.length} component records imported and merged by Component ID.`);
    setSaved(false);
  }

  return <AppShell title="Data Register" eyebrow="ASSET RELIABILITY DATABASE" actions={<>
    <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={importCsv}/>
    <button className="secondary-button" onClick={() => fileInput.current?.click()}><Icons.download/> Import CSV</button>
    <ExportDialog title="RAMS Component Data Register" subtitle="Reliability and maintainability asset baseline" columns={columns.map(({ key, label, width }) => ({ key, label, width: Math.max(12, Math.round(width / 8)) }))} rows={exportRows}/>
  </>}>
    <section className="sheet-panel professional-sheet">
      <div className="register-commandbar">
        <button onClick={addRow}><Icons.plus/><span>Add row</span></button>
        <button onClick={() => { const row = filtered[selected.row]; if (row) setRows(current => current.filter(item => item.id !== row.id)); }}><span className="command-symbol">−</span><span>Delete row</span></button>
        <label className="register-search"><Icons.search/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find component"/></label>
      </div>
      {notice && <div className="register-notice"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
      <div className="formula-bar"><span className="name-box">{String.fromCharCode(65 + selected.col)}{selected.row + 1}</span><span className="fx">fx</span><input readOnly value={selectedValue}/></div>
      <div className="sheet-scroll"><table className="excel-table"><colgroup><col style={{ width: 48 }}/>{columns.map(column => <col key={column.key} style={{ width: column.width }}/>)}</colgroup><thead><tr><th className="corner"/>{columns.map((column, index) => <th key={column.key}><span>{String.fromCharCode(65 + index)}</span>{column.label}{column.computed && <b title="Calculated field">ƒ</b>}</th>)}</tr></thead><tbody>{filtered.map((row, rowIndex) => <tr key={row.id}><th>{rowIndex + 1}</th>{columns.map((column, columnIndex) => {
        const active = selected.row === rowIndex && selected.col === columnIndex;
        const raw = column.key in row ? String(row[column.key as keyof Asset]) : valueFor(row, column.key);
        return <td key={column.key} className={`${active ? "selected" : ""} ${column.computed ? "computed" : ""}`} onClick={() => setSelected({ row: rowIndex, col: columnIndex })}>{column.computed ? <span>{valueFor(row, column.key)}</span> : column.key === "status" ? <select value={raw} onChange={event => update(rowIndex, "status", event.target.value)}><option>Draft</option><option>In review</option><option>Validated</option></select> : column.key === "criticality" ? <select value={raw} onChange={event => update(rowIndex, "criticality", event.target.value)}><option>Operational</option><option>Mission critical</option><option>Safety critical</option></select> : <input value={raw} type={["qty", "lambda", "mttr", "mission"].includes(column.key) ? "number" : "text"} step="any" onChange={event => update(rowIndex, column.key as keyof Asset, event.target.value)}/>}</td>;
      })}</tr>)}</tbody></table></div>
      <div className="sheet-tabs"><button className="active">Component Register</button><span>{filtered.length} components · {saved ? "All changes saved" : "Unsaved changes"}</span></div>
    </section>
  </AppShell>;
}
