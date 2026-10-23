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
  failureRate?: number;
  mttr?: number;
  mission?: number;
};

export type DiagramEdge = { from: number; to: number; style: "straight" | "elbow" };
export type DiagramState = { nodes: DiagramNode[]; edges: DiagramEdge[] };

export const REGISTER_KEY = "ramsport-register";
export const REGISTER_UPDATED_EVENT = "ramsport-register-updated";

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
    const saved = window.localStorage.getItem(REGISTER_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) ? parsed : starterAssets;
  } catch { return starterAssets; }
}

export function saveAssets(assets: Asset[]) {
  window.localStorage.setItem(REGISTER_KEY, JSON.stringify(assets));
  window.dispatchEvent(new CustomEvent(REGISTER_UPDATED_EVENT, { detail: assets }));
}

export function componentAvailability(asset: Pick<Asset, "lambda" | "mttr">) {
  return asset.lambda > 0 ? 1 / (1 + asset.lambda * asset.mttr) : 1;
}

export function componentAvailabilityPercent(asset: Pick<Asset, "lambda" | "mttr">) {
  return `${(componentAvailability(asset) * 100).toFixed(5)}%`;
}

export function diagramStorageKey(mode: "rbd" | "fta") { return `ramsport-${mode}-diagram`; }

export function readDiagram(mode: "rbd" | "fta", fallback: DiagramState): DiagramState {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = window.localStorage.getItem(diagramStorageKey(mode));
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges) ? parsed : fallback;
  } catch { return fallback; }
}

export function saveDiagram(mode: "rbd" | "fta", diagram: DiagramState) {
  window.localStorage.setItem(diagramStorageKey(mode), JSON.stringify(diagram));
}
