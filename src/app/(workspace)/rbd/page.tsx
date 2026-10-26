"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import DiagramEditor from "@/components/rbd/DiagramEditor";
import ExportDialog from "@/components/reporting/ExportDialog";
import type { DiagramReportRow } from "@/data/workspace";

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
  { topic: "Series", description: "Every block in the success path must operate. System repair time is failure-rate weighted.", formula: "lambda_s = sum(lambda_i); MTTR_s = sum(lambda_i * MTTR_i) / lambda_s; MTBF_s = 1 / lambda_s" },
  { topic: "K-out-of-N", description: "At least K of N channels must operate. Parallel redundancy such as 1oo2 is evaluated by this method.", formula: "lambda_s = n! * lambda_i^(n-r+1) * T_i^(n-r) / ((r-1)! * (n-r+1)!); MTTR_s = 1 / ((n-r+1) * mu)" },
  { topic: "Open", description: "No complete connection exists between the input and output sides.", formula: "A = 0" },
];

export default function RBD() {
  const [rows, setRows] = useState<DiagramReportRow[]>([]);
  return <AppShell title="Reliability Block Diagram" eyebrow="IEC 61078 ANALYSIS" actions={<ExportDialog title="Reliability Block Diagram Report" subtitle="IEC 61078 system availability analysis" columns={columns} rows={rows} captureSelector=".rbd-workbench .workbench-canvas" explanation={explanation}/>}><DiagramEditor mode="rbd" onReportChange={setRows}/></AppShell>;
}
