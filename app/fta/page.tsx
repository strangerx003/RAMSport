"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import DiagramEditor, { DiagramReportRow } from "@/components/DiagramEditor";
import ExportDialog from "@/components/ExportDialog";

const columns = [
  { key: "reference", label: "Event ID", width: 16 },
  { key: "component", label: "Event / component", width: 34 },
  { key: "type", label: "Type", width: 18 },
  { key: "failureRate", label: "Failure rate (/h)", width: 18 },
  { key: "mttr", label: "MTTR (h)", width: 12 },
  { key: "availability", label: "Availability", width: 16 },
];

export default function FTA() {
  const [rows, setRows] = useState<DiagramReportRow[]>([]);
  return <AppShell title="Fault Tree Analysis" eyebrow="IEC 61025 ANALYSIS" actions={<ExportDialog title="Fault Tree Analysis Report" subtitle="IEC 61025 qualitative and quantitative analysis" columns={columns} rows={rows} captureSelector=".fta-workbench .workbench-canvas"/>}><DiagramEditor mode="fta" onReportChange={setRows}/></AppShell>;
}
