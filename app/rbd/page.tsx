"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import DiagramEditor, { DiagramReportRow } from "@/components/DiagramEditor";
import ExportDialog from "@/components/ExportDialog";

const columns = [
  { key: "reference", label: "Reference", width: 16 },
  { key: "component", label: "Component", width: 32 },
  { key: "type", label: "Configuration", width: 18 },
  { key: "failureRate", label: "Failure rate (/h)", width: 18 },
  { key: "mttr", label: "MTTR (h)", width: 12 },
  { key: "availability", label: "Availability", width: 16 },
];

export default function RBD() {
  const [rows, setRows] = useState<DiagramReportRow[]>([]);
  return <AppShell title="Reliability Block Diagram" eyebrow="IEC 61078 ANALYSIS" actions={<ExportDialog title="Reliability Block Diagram Report" subtitle="IEC 61078 system availability analysis" columns={columns} rows={rows} captureSelector=".rbd-workbench .workbench-canvas"/>}><DiagramEditor mode="rbd" onReportChange={setRows}/></AppShell>;
}
