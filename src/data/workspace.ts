export type Asset = {
  id: string;
  tag: string;
  description: string;
  system: string;
  qty: number;
  lambda: number;
  mttr: number;
  mission: number;
  criticality: string;
  status: string;
};

export type DiagramNode = {
  id: number;
  x: number;
  y: number;
  type: string;
  title: string;
  subtitle: string;
  assetId?: string;
  groupId?: string;
  failureRate?: number;
  mttr?: number;
  mission?: number;
};

export type RbdGroup = {
  id: string;
  tag: string;
  name: string;
  failureRate: number;
  mtbf: number;
  mttr: number;
  availability: number;
  configuration: string;
  paths: number;
  memberCount: number;
  createdAt: string;
  formulaVersion: "rbd-sheet-v1";
};

export type DiagramEdge = {
  from: number;
  to: number;
  style: "straight" | "elbow";
  waypoint?: { x: number; y: number };
  fromSide?: "left" | "right" | "top" | "bottom";
  toSide?: "left" | "right" | "top" | "bottom";
};
export type DiagramState = { nodes: DiagramNode[]; edges: DiagramEdge[] };
export type DiagramReportRow = { reference: string; component: string; type: string; failureRate: string; mtbf: string; mttr: string; availability: string };

export const REGISTER_KEY = "register";
export const REGISTER_UPDATED_EVENT = "ramsport-register-updated";
export const RBD_GROUPS_KEY = "rbd-groups";
export const RBD_GROUPS_UPDATED_EVENT = "ramsport-rbd-groups-updated";

export const starterAssets: Asset[] = [
  { id: "1", tag: "SIG-CBI-001", description: "Computer Based Interlocking", system: "Signalling", qty: 2, lambda: 0.0000012, mttr: 2.5, mission: 8760, criticality: "Safety critical", status: "Validated" },
  { id: "2", tag: "COM-RAD-014", description: "Trackside Radio Unit", system: "Communications", qty: 18, lambda: 0.0000048, mttr: 1.2, mission: 8760, criticality: "Mission critical", status: "In review" },
  { id: "3", tag: "PWR-UPS-004", description: "Uninterruptible Power Supply", system: "Power", qty: 4, lambda: 0.0000031, mttr: 3.5, mission: 8760, criticality: "Mission critical", status: "Draft" },
  { id: "4", tag: "PSD-CTL-022", description: "Platform Screen Door Controller", system: "Stations", qty: 24, lambda: 0.0000065, mttr: 0.8, mission: 5840, criticality: "Operational", status: "Validated" },
  { id: "5", tag: "TRK-AXC-031", description: "Axle Counter Evaluator", system: "Signalling", qty: 12, lambda: 0.0000021, mttr: 1.8, mission: 8760, criticality: "Safety critical", status: "In review" },
];

export function readAssets(): Asset[] {
  if (typeof window === "undefined") return starterAssets;
  try {
    const key = accountStorageKey(REGISTER_KEY);
    if (!key) return starterAssets;
    const saved = window.localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) ? parsed : starterAssets;
  } catch { return starterAssets; }
}

export function saveAssets(assets: Asset[]) {
  const key = accountStorageKey(REGISTER_KEY);
  if (!key) return;
  window.localStorage.setItem(key, JSON.stringify(assets));
  window.dispatchEvent(new CustomEvent(REGISTER_UPDATED_EVENT, { detail: assets }));
}

export function readRbdGroups(): RbdGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const key = accountStorageKey(RBD_GROUPS_KEY);
    if (!key) return [];
    const saved = window.localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) ? parsed.filter((group): group is RbdGroup => group?.formulaVersion === "rbd-sheet-v1") : [];
  } catch { return []; }
}

export function saveRbdGroups(groups: RbdGroup[]) {
  const key = accountStorageKey(RBD_GROUPS_KEY);
  if (!key) return;
  window.localStorage.setItem(key, JSON.stringify(groups));
  window.dispatchEvent(new CustomEvent(RBD_GROUPS_UPDATED_EVENT, { detail: groups }));
}

export function diagramStorageKey(mode: "rbd" | "fta") { return accountStorageKey(`${mode}-diagram`); }

export function readDiagram(mode: "rbd" | "fta", fallback: DiagramState): DiagramState {
  if (typeof window === "undefined") return fallback;
  try {
    const key = diagramStorageKey(mode);
    if (!key) return fallback;
    const saved = window.localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges) ? parsed : fallback;
  } catch { return fallback; }
}

export function saveDiagram(mode: "rbd" | "fta", diagram: DiagramState) {
  const key = diagramStorageKey(mode);
  if (!key) return;
  window.localStorage.setItem(key, JSON.stringify(diagram));
}
import { accountStorageKey } from "@/services/auth/session";

