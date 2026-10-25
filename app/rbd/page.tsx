"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import DiagramEditor from "@/components/DiagramEditor";
import ExportDialog from "@/components/ExportDialog";
import type { DiagramReportRow } from "@/lib/workspace";

const columns = [
  { key: "reference", label: "Reference", width: 16 },
  { key: "component", label: "Component", width: 32 },
  { key: "type", label: "Configuration", width: 18 },
  { key: "failureRate", label: "Failure rate (/h)", width: 18 },
  { key: "mtbf", label: "MTBF (h)", width: 15 },
  { key: "mttr", label: "MTTR (h)", width: 12 },
  { key: "availability", label: "Availability", width: 16 },
];
const explanation = [
  { topic: "Series", description: "Every block in the success path must operate.", formula: "A = product(Ai)" },
  { topic: "Parallel", description: "At least one independent branch must operate.", formula: "A = 1 - product(1 - Ai)" },
  { topic: "K-out-of-N", description: "At least K of N identical independent channels must operate.", formula: "A = sum C(N,i) A^i (1-A)^(N-i), i=K..N" },
  { topic: "Open", description: "No complete connection exists between the input and output sides.", formula: "A = 0" },
];

export default function RBD() {
  const [rows, setRows] = useState<DiagramReportRow[]>([]);
  return <AppShell title="Reliability Block Diagram" eyebrow="IEC 61078 ANALYSIS" actions={<ExportDialog title="Reliability Block Diagram Report" subtitle="IEC 61078 system availability analysis" columns={columns} rows={rows} captureSelector=".rbd-workbench .workbench-canvas" explanation={explanation}/>}><DiagramEditor mode="rbd" onReportChange={setRows}/></AppShell>;
}
