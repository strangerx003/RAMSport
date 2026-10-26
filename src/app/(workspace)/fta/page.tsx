"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import FTAEditor from "@/components/fta/FTAEditor";
import ExportDialog from "@/components/reporting/ExportDialog";
import type { DiagramReportRow } from "@/data/workspace";

const columns = [
  { key: "reference", label: "Event ID", width: 16 },
  { key: "component", label: "Event / component", width: 34 },
  { key: "type", label: "Type", width: 18 },
  { key: "failureRate", label: "Failure rate (/h)", width: 18 },
  { key: "mttr", label: "MTTR (h)", width: 12 },
  { key: "availability", label: "Availability", width: 16 },
];
const explanation = [
  { topic: "Basic event", description: "Lowest-level event quantified from its failure rate and mission time.", formula: "Q(t) = 1 - exp(-lambda t)" },
  { topic: "AND gate", description: "The output occurs only when every independent input occurs.", formula: "Q = product(Qi)" },
  { topic: "OR gate", description: "The output occurs when one or more independent inputs occur.", formula: "Q = 1 - product(1 - Qi)" },
  { topic: "XOR gate", description: "The output occurs when exactly one input occurs.", formula: "Q = sum[Qi product(1-Qj)]" },
  { topic: "NOT gate", description: "The output is the logical complement of its single input.", formula: "Q = 1 - Q1" },
  { topic: "Transfer reference", description: "A matching T-number continues the same branch on another A4 page without changing its logic.", formula: "Reference only" },
];

export default function FTA() {
  const [rows, setRows] = useState<DiagramReportRow[]>([]);
  return <AppShell title="Fault Tree Analysis" eyebrow="IEC 61025 ANALYSIS" actions={<ExportDialog title="Fault Tree Analysis Report" subtitle="IEC 61025 qualitative and quantitative analysis" columns={columns} rows={rows} captureSelector=".fta-workbench .workbench-canvas" explanation={explanation}/>}><FTAEditor onReportChange={setRows}/></AppShell>;
}
