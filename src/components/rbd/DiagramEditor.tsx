"use client";

import { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, type CSSProperties, useEffect, useRef, useState } from "react";
import { canvasGridMetrics, DEFAULT_CANVAS_ZOOM, MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM, zoomCanvasAtPointer } from "@/engine/canvas-zoom";
import { componentAvailability, meanTimeBetweenFailures } from "@/engine/reliability";
import { analyzeRbd, type RbdAnalysis } from "@/engine/rbd";
import { lockRbdConnectionPorts, lockedPortPoint, routeRbdConnection, type PortSide } from "@/engine/rbd-routing";
import { Icons } from "@/lib/icons";
import { Asset, DiagramEdge, DiagramNode, DiagramReportRow, DiagramState, RbdGroup, RBD_GROUPS_UPDATED_EVENT, REGISTER_UPDATED_EVENT, readAssets, readDiagram, readRbdGroups, saveDiagram, saveRbdGroups, starterAssets } from "@/data/workspace";
import { accountStorageKey } from "@/services/auth/session";

type Mode = "rbd" | "fta";
type GateType = "gate and" | "gate or" | "gate xor" | "gate not";
const blankDiagram: DiagramState = { nodes: [], edges: [] };
const BLOCK_WIDTH = 196;
const BLOCK_HEIGHT = 108;

export function createDiagramReportRows(mode: Mode, nodes: DiagramNode[], assets: Asset[] = starterAssets): DiagramReportRow[] {
  return nodes.filter(node => node.assetId || node.groupId).sort((first, second) => first.x - second.x || first.y - second.y).map(node => {
    const asset = assets.find(item => item.id === node.assetId);
    const lambda = asset?.lambda ?? node.failureRate ?? 0;
    const mttr = asset?.mttr ?? node.mttr ?? 0;
    return { reference: asset?.tag ?? node.title, component: asset?.description ?? node.subtitle, type: node.groupId ? "Reusable RBD group" : mode === "rbd" ? "Reliability block" : "Basic event", failureRate: lambda ? lambda.toExponential(3) : "0", mtbf: lambda ? Math.round(meanTimeBetweenFailures(lambda)).toLocaleString() : "∞", mttr: mttr.toFixed(2), availability: `${(componentAvailability({ lambda, mttr }) * 100).toFixed(5)}%` };
  });
}

function isGate(node?: DiagramNode) { return Boolean(node?.type.startsWith("gate ")); }
function gateLabel(type: string) { return type.replace("gate ", "").toUpperCase(); }

export default function DiagramEditor({ mode, onReportChange }: { mode: Mode; onReportChange?: (rows: DiagramReportRow[]) => void }) {
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [edges, setEdges] = useState<DiagramEdge[]>([]);
  const [assets, setAssets] = useState<Asset[]>(starterAssets);
  const [groups, setGroups] = useState<RbdGroup[]>([]);
  const [selected, setSelected] = useState(0);
  const [selectedNodes, setSelectedNodes] = useState<number[]>([]);
  const [zoom, setZoom] = useState(DEFAULT_CANVAS_ZOOM);
  const [analysis, setAnalysis] = useState<RbdAnalysis | null>(null);
  const [notice, setNotice] = useState("");
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [portDrag, setPortDrag] = useState<{ from: number; side: PortSide; start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
  const [pendingGate, setPendingGate] = useState<{ from: number; to: number } | null>(null);
  const [gateMenu, setGateMenu] = useState<{ nodeId: number; x: number; y: number } | null>(null);
  const [groupMenu, setGroupMenu] = useState<{ x: number; y: number } | null>(null);
  const [groupDialog, setGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupError, setGroupError] = useState("");
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const undoStack = useRef<DiagramState[]>([]);
  const redoStack = useRef<DiagramState[]>([]);
  const latest = useRef<DiagramState>(blankDiagram);

  useEffect(() => {
    const ftaEmptyVersion = accountStorageKey("fta-empty-v1");
    if (mode === "fta" && ftaEmptyVersion && !window.localStorage.getItem(ftaEmptyVersion)) {
      window.localStorage.setItem(ftaEmptyVersion, "1");
    }
    const saved = readDiagram(mode, blankDiagram);
    const normalizedEdges = mode === "rbd" ? lockRbdConnectionPorts(saved.nodes, saved.edges) : saved.edges;
    latest.current = { nodes: saved.nodes, edges: normalizedEdges };
    setNodes(saved.nodes); setEdges(normalizedEdges); setSelected(saved.nodes[0]?.id || 0); setSelectedNodes(saved.nodes[0] ? [saved.nodes[0].id] : []); setAssets(readAssets()); setGroups(mode === "rbd" ? readRbdGroups() : []); setHydrated(true);
    const refresh = (event: Event) => setAssets(Array.isArray((event as CustomEvent<Asset[]>).detail) ? (event as CustomEvent<Asset[]>).detail : readAssets());
    const refreshGroups = (event: Event) => setGroups(Array.isArray((event as CustomEvent<RbdGroup[]>).detail) ? (event as CustomEvent<RbdGroup[]>).detail : readRbdGroups());
    window.addEventListener(REGISTER_UPDATED_EVENT, refresh); window.addEventListener(RBD_GROUPS_UPDATED_EVENT, refreshGroups); window.addEventListener("storage", refresh); window.addEventListener("storage", refreshGroups);
    return () => { window.removeEventListener(REGISTER_UPDATED_EVENT, refresh); window.removeEventListener(RBD_GROUPS_UPDATED_EVENT, refreshGroups); window.removeEventListener("storage", refresh); window.removeEventListener("storage", refreshGroups); };
  }, [mode]);

  useEffect(() => {
    latest.current = { nodes, edges };
    if (hydrated) {
      saveDiagram(mode, { nodes, edges });
      const rows = createDiagramReportRows(mode, nodes, assets);
      if (mode === "rbd" && analysis) rows.push({ reference: "SYSTEM", component: "Overall connected RBD", type: analysis.configuration, failureRate: analysis.failureRate.toExponential(4), mtbf: Number.isFinite(analysis.mtbf) ? Math.round(analysis.mtbf).toLocaleString() : "∞", mttr: analysis.mttr.toFixed(2), availability: `${(analysis.availability * 100).toFixed(5)}%` });
      onReportChange?.(rows);
    }
  }, [nodes, edges, assets, hydrated, mode, onReportChange, analysis]);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
      if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      if (event.key === "Delete" && !["INPUT", "SELECT", "TEXTAREA"].includes(tag)) selectedEdge !== null ? removeSelectedEdge() : (selectedNodes.length || selected) && removeSelected();
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  });

  const filteredAssets = assets.filter(asset => `${asset.tag} ${asset.description} ${asset.system}`.toLowerCase().includes(search.toLowerCase()));
  const filteredGroups = groups.filter(group => `${group.tag} ${group.name} ${group.configuration}`.toLowerCase().includes(search.toLowerCase()));

  function remember() { undoStack.current.push(structuredClone(latest.current)); if (undoStack.current.length > 60) undoStack.current.shift(); redoStack.current = []; }
  function restore(state: DiagramState) { setNodes(state.nodes); setEdges(mode === "rbd" ? lockRbdConnectionPorts(state.nodes, state.edges) : state.edges); setSelected(0); setSelectedNodes([]); setSelectedEdge(null); setAnalysis(null); }
  function undo() { const state = undoStack.current.pop(); if (!state) return; redoStack.current.push(structuredClone(latest.current)); restore(state); }
  function redo() { const state = redoStack.current.pop(); if (!state) return; undoStack.current.push(structuredClone(latest.current)); restore(state); }

  function nodeMetrics(node: DiagramNode) {
    const asset = node.assetId ? assets.find(item => item.id === node.assetId) : undefined;
    const failureRate = asset?.lambda ?? node.failureRate ?? 0;
    const mttr = asset?.mttr ?? node.mttr ?? 0;
    return { failureRate, mttr, availability: componentAvailability({ lambda: failureRate, mttr }) };
  }

  function rbdComponents(sourceNodes = nodes) {
    return sourceNodes.filter(node => node.assetId || node.groupId).map(node => ({ id: node.id, x: node.x, ...nodeMetrics(node) }));
  }

  function runAnalysis() {
    const components = rbdComponents();
    if (!components.length) { setAnalysis(null); setNotice("Add at least one component before calculating the RBD."); return; }
    const result = analyzeRbd(components, edges);
    setAnalysis(result);
    setNotice(result.configuration === "Open" ? "No complete RBD path was found. Connect the required blocks, then calculate again." : "");
  }

  function nextPosition() { const index = nodes.filter(node => !isGate(node)).length; return { x: 75 + index % 4 * 245, y: 90 + Math.floor(index / 4) * 165 }; }
  function invalidateAnalysis() { setAnalysis(null); }
  function selectOnly(id: number) { setSelected(id); setSelectedNodes(id ? [id] : []); setSelectedEdge(null); }
  function addAsset(asset: Asset, position = nextPosition()) { remember(); const id = Math.max(0, ...nodes.map(node => node.id)) + 1; setNodes(current => [...current, { id, ...position, type: mode === "rbd" ? "block" : "event basic", title: asset.tag, subtitle: asset.description, assetId: asset.id }]); selectOnly(id); invalidateAnalysis(); }
  function addGroup(group: RbdGroup, position = nextPosition()) { remember(); const id = Math.max(0, ...nodes.map(node => node.id)) + 1; setNodes(current => [...current, { id, ...position, type: "group", title: group.tag, subtitle: group.name, groupId: group.id, failureRate: group.failureRate, mttr: group.mttr }]); selectOnly(id); invalidateAnalysis(); }
  function drop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragOver(false);
    try {
      const { id, groupId } = JSON.parse(event.dataTransfer.getData("application/x-ramsport")) as { id?: string; groupId?: string };
      const asset = assets.find(item => item.id === id), group = groups.find(item => item.id === groupId);
      const rect = event.currentTarget.getBoundingClientRect();
      const position = { x: Math.max(12, ((event.clientX - rect.left) - pan.x) * 100 / zoom - BLOCK_WIDTH / 2), y: Math.max(12, ((event.clientY - rect.top) - pan.y) * 100 / zoom - BLOCK_HEIGHT / 2) };
      if (asset) addAsset(asset, position); else if (mode === "rbd" && group) addGroup(group, position); else setNotice("That item is not available in the active component library.");
    } catch { setNotice("The dropped item could not be added. Drag a component from the library and try again."); }
  }

  function dragNode(event: ReactPointerEvent, node: DiagramNode) {
    if ((event.target as HTMLElement).closest(".port")) return;
    if (event.button !== 0) return;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault(); event.stopPropagation();
      setSelectedNodes(current => current.includes(node.id) ? current.filter(id => id !== node.id) : [...current, node.id]);
      setSelected(0); setSelectedEdge(null); return;
    }
    event.preventDefault(); event.stopPropagation(); remember();
    const movingIds = selectedNodes.includes(node.id) && selectedNodes.length > 1 ? selectedNodes : [node.id];
    if (!selectedNodes.includes(node.id)) selectOnly(node.id); else { setSelected(node.id); setSelectedEdge(null); }
    setGateMenu(null); setGroupMenu(null); invalidateAnalysis();
    const original = new Map(nodes.filter(item => movingIds.includes(item.id)).map(item => [item.id, { x: item.x, y: item.y }]));
    const start = { x: event.clientX, y: event.clientY };
    const move = (pointer: PointerEvent) => setNodes(current => current.map(item => {
      const initial = original.get(item.id); if (!initial) return item;
      return { ...item, x: Math.max(12, initial.x + (pointer.clientX - start.x) * 100 / zoom), y: Math.max(12, initial.y + (pointer.clientY - start.y) * 100 / zoom) };
    }));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function portPoint(node: DiagramNode, side: PortSide) { return lockedPortPoint(node, side); }
  function startPortDrag(event: ReactPointerEvent, node: DiagramNode, side: PortSide) {
    event.preventDefault(); event.stopPropagation(); selectOnly(node.id);
    const rect = (event.currentTarget.closest(".workbench-canvas-wrap") as HTMLElement)?.getBoundingClientRect();
    const point = (x: number, y: number) => ({ x: ((x - (rect?.left || 0)) - pan.x) * 100 / zoom, y: ((y - (rect?.top || 0)) - pan.y) * 100 / zoom });
    setPortDrag({ from: node.id, side, start: portPoint(node, side), current: point(event.clientX, event.clientY) });
    const move = (pointer: PointerEvent) => setPortDrag(current => current ? { ...current, current: point(pointer.clientX, pointer.clientY) } : null);
    const up = (pointer: PointerEvent) => { const target = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest<HTMLElement>("[data-port-node]"); const to = Number(target?.dataset.portNode); const toSide = target?.dataset.portSide as PortSide | undefined; if (to && to !== node.id && toSide) connect(node.id, to, side, toSide); else setNotice("Connection not created. Release the line on a connection dot of a different block."); setPortDrag(null); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function addEdge(from: number, to: number, fromSide?: PortSide, toSide?: PortSide) {
    remember();
    setEdges(current => {
      if (current.some(edge => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from))) { setNotice("These two blocks are already connected."); return current; }
      const candidate: DiagramEdge = { from, to, style: "elbow", fromSide, toSide };
      const fixed = mode === "rbd" ? lockRbdConnectionPorts(nodes, [candidate])[0] : candidate;
      return [...current, fixed];
    });
    invalidateAnalysis();
  }
  function connect(from: number, to: number, fromSide?: PortSide, toSide?: PortSide) { const source = nodes.find(node => node.id === from), target = nodes.find(node => node.id === to); if (!source || !target) { setNotice("Connection not created because one of the selected blocks is no longer available."); return; } if (mode === "rbd" || isGate(source) || isGate(target)) addEdge(from, to, fromSide, toSide); else setPendingGate({ from, to }); }
  function confirmGate(type: GateType | "direct") {
    if (!pendingGate) return;
    if (type === "direct") addEdge(pendingGate.from, pendingGate.to);
    else {
      remember(); const from = nodes.find(node => node.id === pendingGate.from), to = nodes.find(node => node.id === pendingGate.to);
      if (from && to) { const id = Math.max(0, ...nodes.map(node => node.id)) + 1; setNodes(current => [...current, { id, x: (from.x + to.x) / 2 + 70, y: (from.y + to.y) / 2 + 30, type, title: gateLabel(type), subtitle: "Logic gate" }]); setEdges(current => [...current, { from: pendingGate.from, to: id, style: "straight" }, { from: id, to: pendingGate.to, style: "straight" }]); setSelected(id); }
    }
    setPendingGate(null);
  }
  function changeGate(nodeId: number, type: GateType) { remember(); setNodes(current => current.map(node => node.id === nodeId ? { ...node, type, title: gateLabel(type) } : node)); setGateMenu(null); }
  function removeSelected() { const ids = selectedNodes.length ? selectedNodes : selected ? [selected] : []; if (!ids.length) return; remember(); setNodes(current => current.filter(node => !ids.includes(node.id))); setEdges(current => current.filter(edge => !ids.includes(edge.from) && !ids.includes(edge.to))); setSelected(0); setSelectedNodes([]); invalidateAnalysis(); }
  function removeSelectedEdge() { if (selectedEdge === null) return; remember(); setEdges(current => current.filter((_, index) => index !== selectedEdge)); setSelectedEdge(null); invalidateAnalysis(); }

  function edgeHandle(edge: DiagramEdge) {
    if (edge.waypoint) return edge.waypoint;
    const route = routeRbdConnection(nodes, edge).points;
    if (route.length < 2) return { x: 0, y: 0 };
    let longest = { first: route[0], second: route[1], length: 0 };
    for (let index = 1; index < route.length; index += 1) {
      const first = route[index - 1], second = route[index];
      const length = Math.abs(second.x - first.x) + Math.abs(second.y - first.y);
      if (length > longest.length) longest = { first, second, length };
    }
    return { x: (longest.first.x + longest.second.x) / 2, y: (longest.first.y + longest.second.y) / 2 };
  }

  function edgeArrow(edge: DiagramEdge) {
    const points = routeRbdConnection(nodes, edge).points;
    if (points.length < 2) return null;
    const candidates = points.slice(1).map((second, index) => {
      const first = points[index];
      return { first, second, index, length: Math.abs(second.x - first.x) + Math.abs(second.y - first.y) };
    }).filter(segment => segment.length >= 26 && segment.index > 0 && segment.index < points.length - 2);
    const segments = candidates.length ? candidates : points.slice(1).map((second, index) => ({ first: points[index], second, index, length: Math.abs(second.x - points[index].x) + Math.abs(second.y - points[index].y) })).filter(segment => segment.length >= 26);
    const segment = segments.sort((first, second) => second.length - first.length)[0];
    if (!segment) return null;
    return { x: (segment.first.x + segment.second.x) / 2, y: (segment.first.y + segment.second.y) / 2, angle: Math.atan2(segment.second.y - segment.first.y, segment.second.x - segment.first.x) * 180 / Math.PI };
  }

  function dragEdgeHandle(event: ReactPointerEvent, index: number) {
    event.preventDefault(); event.stopPropagation(); remember(); setSelectedEdge(index); setSelected(0); setSelectedNodes([]); invalidateAnalysis();
    const wrap = (event.currentTarget.closest(".workbench-canvas-wrap") as HTMLElement)?.getBoundingClientRect();
    const move = (pointer: PointerEvent) => {
      const waypoint = { x: ((pointer.clientX - (wrap?.left ?? 0)) - pan.x) * 100 / zoom, y: ((pointer.clientY - (wrap?.top ?? 0)) - pan.y) * 100 / zoom };
      setEdges(current => current.map((edge, edgeIndex) => edgeIndex === index ? { ...edge, waypoint } : edge));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function openGroupDialog() {
    setGroupMenu(null); setGroupError(""); setGroupName(""); setGroupDialog(true);
  }

  function createGroup() {
    const name = groupName.trim();
    const ids = new Set(selectedNodes);
    const members = nodes.filter(node => ids.has(node.id) && !isGate(node));
    if (!name) { setGroupError("Enter a group name."); return; }
    if (members.length < 2) { setGroupError("Select at least two connected RBD blocks."); return; }
    const internalEdges = edges.filter(edge => ids.has(edge.from) && ids.has(edge.to));
    const adjacency = new Map(members.map(member => [member.id, [] as number[]]));
    internalEdges.forEach(edge => { adjacency.get(edge.from)?.push(edge.to); adjacency.get(edge.to)?.push(edge.from); });
    const visited = new Set<number>(); const queue = [members[0].id];
    while (queue.length) { const current = queue.shift()!; if (visited.has(current)) continue; visited.add(current); queue.push(...(adjacency.get(current) ?? [])); }
    if (visited.size !== members.length) { setGroupError("All selected blocks must belong to one connected subsystem."); return; }
    const result = analyzeRbd(rbdComponents(members), internalEdges);
    if (result.configuration === "Open") { setGroupError("The selected blocks do not form a complete RBD path."); return; }

    const nextNumber = groups.reduce((highest, group) => Math.max(highest, Number(group.tag.match(/\d+/)?.[0] ?? 0)), 0) + 1;
    const definition: RbdGroup = { id: globalThis.crypto?.randomUUID?.() ?? `group-${Date.now()}`, tag: `GRP-${String(nextNumber).padStart(3, "0")}`, name, failureRate: result.failureRate, mtbf: result.mtbf, mttr: result.mttr, availability: result.availability, configuration: result.configuration, paths: result.paths, memberCount: members.length, createdAt: new Date().toISOString(), formulaVersion: "rbd-sheet-v1" };
    const updatedGroups = [...groups, definition];
    saveRbdGroups(updatedGroups); setGroups(updatedGroups); remember();

    const newId = Math.max(0, ...nodes.map(node => node.id)) + 1;
    const left = Math.min(...members.map(node => node.x)), right = Math.max(...members.map(node => node.x + BLOCK_WIDTH));
    const top = Math.min(...members.map(node => node.y)), bottom = Math.max(...members.map(node => node.y + BLOCK_HEIGHT));
    const groupNode: DiagramNode = { id: newId, x: (left + right - BLOCK_WIDTH) / 2, y: (top + bottom - BLOCK_HEIGHT) / 2, type: "group", title: definition.tag, subtitle: definition.name, groupId: definition.id, failureRate: definition.failureRate, mttr: definition.mttr };
    const remaining = nodes.filter(node => !ids.has(node.id));
    const rewired: DiagramEdge[] = [];
    for (const edge of edges) {
      const fromInside = ids.has(edge.from), toInside = ids.has(edge.to);
      if (fromInside && toInside) continue;
      if (!fromInside && !toInside) { rewired.push(edge); continue; }
      const outsideId = fromInside ? edge.to : edge.from;
      const outside = nodes.find(node => node.id === outsideId); if (!outside) continue;
      const groupSide: PortSide = outside.x + BLOCK_WIDTH / 2 < groupNode.x + BLOCK_WIDTH / 2 ? "left" : "right";
      rewired.push(fromInside ? { ...edge, from: newId, fromSide: groupSide, waypoint: undefined } : { ...edge, to: newId, toSide: groupSide, waypoint: undefined });
    }
    const unique = rewired.filter((edge, index, all) => index === all.findIndex(other => (other.from === edge.from && other.to === edge.to) || (other.from === edge.to && other.to === edge.from)));
    const nextNodes = [...remaining, groupNode];
    setNodes(nextNodes); setEdges(lockRbdConnectionPorts(nextNodes, unique)); selectOnly(newId); setGroupDialog(false); invalidateAnalysis();
  }

  function startCanvasInteraction(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (panMode) { startPan(event); return; }
    if (mode !== "rbd" || (event.target as HTMLElement).closest(".workbench-node,.edge-handle,.workbench-status")) return;
    event.preventDefault(); setGroupMenu(null); setGateMenu(null); setSelectedEdge(null);
    const rect = event.currentTarget.getBoundingClientRect();
    const point = (clientX: number, clientY: number) => ({ x: ((clientX - rect.left) - pan.x) * 100 / zoom, y: ((clientY - rect.top) - pan.y) * 100 / zoom });
    const start = point(event.clientX, event.clientY);
    const move = (pointer: PointerEvent) => { const current = point(pointer.clientX, pointer.clientY); setSelectionBox({ x: Math.min(start.x, current.x), y: Math.min(start.y, current.y), width: Math.abs(current.x - start.x), height: Math.abs(current.y - start.y) }); };
    const up = (pointer: PointerEvent) => {
      const current = point(pointer.clientX, pointer.clientY);
      const box = { x: Math.min(start.x, current.x), y: Math.min(start.y, current.y), width: Math.abs(current.x - start.x), height: Math.abs(current.y - start.y) };
      const picked = box.width < 4 && box.height < 4 ? [] : nodes.filter(node => node.x < box.x + box.width && node.x + BLOCK_WIDTH > box.x && node.y < box.y + box.height && node.y + BLOCK_HEIGHT > box.y).map(node => node.id);
      setSelectedNodes(picked); setSelected(picked.length === 1 ? picked[0] : 0); setSelectionBox(null);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function startPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!panMode || (event.target as HTMLElement).closest(".workbench-node,.edge-handle")) return;
    event.preventDefault();
    const start = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    const move = (pointer: PointerEvent) => setPan({ x: start.panX + pointer.clientX - start.x, y: start.panY + pointer.clientY - start.y });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function wheelZoom(event: ReactWheelEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".workbench-status")) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const result = zoomCanvasAtPointer(zoom, pan, { x: event.clientX - rect.left, y: event.clientY - rect.top }, event.deltaY);
    setZoom(result.zoom); setPan(result.pan);
  }

  function edgePath(edge: DiagramEdge) {
    const from = nodes.find(node => node.id === edge.from), to = nodes.find(node => node.id === edge.to); if (!from || !to) return "";
    if (mode === "fta") { const start = portPoint(from, "top"), end = portPoint(to, "bottom"); if (Math.abs(start.x - end.x) < 8) return `M${start.x} ${start.y} L${end.x} ${end.y}`; const middleY = (start.y + end.y) / 2; return `M${start.x} ${start.y} V${middleY} H${end.x} V${end.y}`; }
    return routeRbdConnection(nodes, edge).path;
  }

  const blockPorts: PortSide[] = mode === "rbd" ? ["left", "right"] : ["top", "bottom"];
  const grid = canvasGridMetrics(zoom, pan);
  const gridStyle = { "--grid-small": `${grid.small}px`, "--grid-large": `${grid.large}px`, "--grid-x": `${grid.x}px`, "--grid-y": `${grid.y}px` } as CSSProperties;
  return <section className={`workbench ${mode}-workbench`} onClick={() => { setGateMenu(null); setGroupMenu(null); }}>
    <header className="workbench-toolbar">
      <button className={`wb-action history-action ${panMode ? "active" : ""}`} onClick={() => setPanMode(value => !value)} title="Pan the diagram"><Icons.pan/>Pan</button>
      <button className="wb-action history-action" onClick={undo} title="Undo (Ctrl+Z)"><Icons.undo/>Undo</button><button className="wb-action history-action" onClick={redo} title="Redo (Ctrl+Y)"><Icons.redo/>Redo</button><span className="wb-separator"/>
      <button className="wb-action run" onClick={runAnalysis}><Icons.play/>Calculate</button><button className="wb-action clear" onClick={() => { if (!nodes.length || window.confirm("Clear the complete diagram?")) { remember(); setNodes([]); setEdges([]); setSelected(0); setSelectedNodes([]); setSelectedEdge(null); setAnalysis(null); } }}>Clear</button><button className="wb-action reset" onClick={() => { setZoom(DEFAULT_CANVAS_ZOOM); setPan({ x: 0, y: 0 }); setSelected(0); setSelectedNodes([]); setSelectedEdge(null); }}>Reset view</button>
      <span className="wb-hint">Drag around RBD blocks to select them. Right-click the selection to create a reusable group.</span>
    </header>
    <div className="workbench-body">
      <aside className="component-library">
        <div className="library-heading"><strong>Components</strong><button onClick={() => { setAssets(readAssets()); setGroups(readRbdGroups()); }} title="Refresh component library">↻</button></div>
        <label className="library-search"><Icons.search/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find component or group"/></label>
        <div className="library-scroll">
          {mode === "rbd" && groups.length > 0 && <section className="group-library"><div className="library-section-title"><strong>Reusable groups</strong><span>{groups.length}</span></div><div className="group-library-scroll">{filteredGroups.map(group => <button className="library-card group-card" key={group.id} draggable onDragStart={event => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-ramsport", JSON.stringify({ groupId: group.id })); }} onClick={() => addGroup(group)}><strong>{group.name}</strong><span className="lambda">λ: {group.failureRate.toExponential(2)} /h</span><span className="mtbf">MTBF: {Number.isFinite(group.mtbf) ? Math.round(group.mtbf).toLocaleString() : "∞"} h</span><span className="mttr">MTTR: {group.mttr.toFixed(2)} h</span><small>{group.tag} · {group.memberCount} blocks</small></button>)}</div></section>}
          <div className="library-section-title asset-section-title"><strong>Data Register</strong><span>{filteredAssets.length}</span></div>
          {filteredAssets.map(asset => <button className="library-card" key={asset.id} draggable onDragStart={event => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-ramsport", JSON.stringify({ id: asset.id })); }} onClick={() => addAsset(asset)}><strong>{asset.description}</strong><span className="lambda">λ: {asset.lambda.toExponential(2)} /h</span><span className="mtbf">MTBF: {asset.lambda ? Math.round(meanTimeBetweenFailures(asset.lambda)).toLocaleString() : "∞"} h</span><span className="mttr">MTTR: {asset.mttr} h</span><small>{asset.tag}</small></button>)}
        </div>
      </aside>
      <div className={`workbench-canvas-wrap ${dragOver ? "drop-ready" : ""} ${panMode ? "pan-active" : ""}`} style={gridStyle} onPointerDown={startCanvasInteraction} onContextMenu={event => { if (mode === "rbd" && selectedNodes.length >= 2) { event.preventDefault(); setGroupMenu({ x: event.clientX, y: event.clientY }); } }} onWheel={wheelZoom} onDragOver={event => { event.preventDefault(); setDragOver(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false); }} onDrop={drop}>
        {notice && <div className="workbench-notice" role="alert"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}
        <div className="workbench-canvas" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom / 100})`, transformOrigin: "top left" }}>
          <svg className="connections">{edges.map((edge, index) => { const arrow = edgeArrow(edge); return <g key={`${edge.from}-${edge.to}-${index}`}><path data-export-edge="true" data-export-from={edge.from} data-export-to={edge.to} className={`diagram-edge ${selectedEdge === index ? "selected" : ""}`} d={edgePath(edge)} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); setSelectedEdge(index); setSelected(0); setSelectedNodes([]); }}/>{arrow && <polygon className="flow-arrow" points="-6,-4 6,0 -6,4" transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}/>}</g>; })}{portDrag && <path className="connection-preview" d={`M${portDrag.start.x} ${portDrag.start.y} L${portDrag.current.x} ${portDrag.current.y}`}/>}</svg>
          {edges.map((edge, index) => selectedEdge === index ? <button key={`handle-${index}`} className="edge-handle" style={{ left: edgeHandle(edge).x, top: edgeHandle(edge).y }} onPointerDown={event => dragEdgeHandle(event, index)} title="Drag to adjust connector bend"/> : null)}
          {nodes.map(node => {
            const asset = node.assetId ? assets.find(item => item.id === node.assetId) : undefined, gate = isGate(node), metrics = nodeMetrics(node);
            return <div data-export-node="true" data-export-id={node.id} data-export-type={node.type} key={node.id} className={`workbench-node ${gate ? "logic-gate-node" : "engineering-block"} ${node.type.replaceAll(" ", "-")} ${selectedNodes.includes(node.id) || selected === node.id ? "selected" : ""}`} style={{ left: node.x, top: node.y }} onPointerDown={event => dragNode(event, node)} onClick={event => { event.stopPropagation(); if (event.ctrlKey || event.metaKey) return; if (!selectedNodes.includes(node.id)) selectOnly(node.id); }} onContextMenu={event => { if (mode === "fta" && gate) { event.preventDefault(); event.stopPropagation(); setGateMenu({ nodeId: node.id, x: event.clientX, y: event.clientY }); } else if (mode === "rbd") { event.preventDefault(); event.stopPropagation(); if (!selectedNodes.includes(node.id)) selectOnly(node.id); if ((selectedNodes.includes(node.id) ? selectedNodes.length : 1) >= 2) setGroupMenu({ x: event.clientX, y: event.clientY }); } }}>
              {blockPorts.map(side => <span key={side} className={`port ${side}`} data-port-node={node.id} data-port-side={side} onPointerDown={event => startPortDrag(event, node, side)} title="Drag to another connection point"/>)}
              {gate ? <><span className={`gate-shape ${node.type.replace("gate ", "")}`}><b>{gateLabel(node.type)}</b></span><small className="gate-caption">{gateLabel(node.type)}</small></> : <><strong className="part-number">{asset?.tag ?? node.title}</strong><div className="block-values"><span><b>λ</b>{metrics.failureRate.toExponential(2)} /h</span><span><b>MTBF</b>{metrics.failureRate ? Math.round(meanTimeBetweenFailures(metrics.failureRate)).toLocaleString() : "∞"} h</span><span><b>MTTR</b>{metrics.mttr.toFixed(2)} h</span></div><small className="component-name">{asset?.description ?? node.subtitle}</small></>}
            </div>;
          })}
          {selectionBox && <div
            className="selection-marquee"
            style={{ left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height }}
          />}
        </div>
        <footer className="workbench-status"><span>{nodes.filter(node => !isGate(node)).length} components</span><span>{edges.length} connections</span>{selectedNodes.length > 1 && <span>{selectedNodes.length} selected</span>}<span className="autosave-state">Saved locally</span><div className="zoom-control"><button onClick={() => setZoom(Math.max(MIN_CANVAS_ZOOM, zoom - 10))}>−</button><input type="range" min={MIN_CANVAS_ZOOM} max={MAX_CANVAS_ZOOM} step="10" value={zoom} onChange={event => setZoom(Number(event.target.value))}/><button onClick={() => setZoom(Math.min(MAX_CANVAS_ZOOM, zoom + 10))}>+</button><b>{zoom}%</b></div></footer>
      </div>
      {mode === "rbd" && <aside className="workbench-inspector rbd-inspector result-only-panel"><div className="inspector-heading"><strong>Result</strong><span>IEC 61078</span></div>{analysis ? <div className="system-result"><p className="result-summary">{analysis.configuration}{analysis.koon ? ` · ${analysis.koon.k}oo${analysis.koon.n}` : ""}<br/>{analysis.note}</p><dl><div><dt>Failure rate (λ/h)</dt><dd>{analysis.failureRate.toExponential(4)}</dd></div><div><dt>MTBF</dt><dd>{Number.isFinite(analysis.mtbf) ? `${Math.round(analysis.mtbf).toLocaleString()} h` : "∞"}</dd></div><div><dt>MTTR</dt><dd>{analysis.mttr.toFixed(2)} h</dd></div><div className="availability-row"><dt>Availability</dt><dd>{(analysis.availability * 100).toFixed(6)}%</dd></div></dl><div className="applied-formula"><b>Applied formula</b><code>{analysis.formula}</code></div></div> : <div className="inspector-empty"><Icons.play/><strong>No result yet</strong><p>Connect the blocks in the required flow and click Calculate.</p></div>}<section className="method-reference"><h3>Method reference</h3><dl><div><dt>Series</dt><dd>Every connected block must operate.<code>λs = Σλi</code><code>MTTRs = Σ(λi × MTTRi) / λs</code></dd></div><div><dt>K-out-of-N</dt><dd>At least K of N channels must operate. A 1oo2 arrangement uses this same method.<code>λs = n! λi^(n−r+1) Ti^(n−r) / ((r−1)!(n−r+1)!)</code><code>MTTRs = 1 / ((n−r+1)μ)</code></dd></div></dl></section></aside>}
    </div>
    {pendingGate && <div className="gate-dialog-backdrop" role="dialog" aria-modal="true"><section className="gate-dialog"><span>FAULT-TREE CONNECTION</span><h2>Select logic gate</h2><p>The selected symbol will be inserted between the two component events.</p><div><button onClick={() => confirmGate("gate and")}>AND</button><button onClick={() => confirmGate("gate or")}>OR</button><button onClick={() => confirmGate("gate xor")}>XOR</button><button onClick={() => confirmGate("gate not")}>NOT</button></div><button className="gate-direct" onClick={() => confirmGate("direct")}>Direct / end-event connection</button><button className="gate-cancel" onClick={() => setPendingGate(null)}>Cancel</button></section></div>}
    {gateMenu && <div className="gate-change-menu" style={{ left: gateMenu.x, top: gateMenu.y }} onClick={event => event.stopPropagation()}><strong>Change gate</strong>{(["gate and", "gate or", "gate xor", "gate not"] as GateType[]).map(type => <button key={type} onClick={() => changeGate(gateMenu.nodeId, type)}><span className={`mini-gate ${type.replace("gate ", "")}`}/>{gateLabel(type)}</button>)}</div>}
    {groupMenu && <div className="group-context-menu" style={{ left: groupMenu.x, top: groupMenu.y }} onClick={event => event.stopPropagation()}><strong>{selectedNodes.length} blocks selected</strong><button onClick={openGroupDialog}>Group selected blocks</button><button onClick={() => { setSelectedNodes([]); setSelected(0); setGroupMenu(null); }}>Clear selection</button></div>}
    {groupDialog && <div className="gate-dialog-backdrop" role="dialog" aria-modal="true" onPointerDown={event => { if (event.target === event.currentTarget) setGroupDialog(false); }}><section className="gate-dialog group-dialog"><span>REUSABLE RBD SUBSYSTEM</span><h2>Name this group</h2><p>The {selectedNodes.length} selected blocks and their internal connections will be calculated as one equivalent reliability block. External connections will stay attached.</p><label>Group name<input autoFocus value={groupName} maxLength={80} onChange={event => { setGroupName(event.target.value); setGroupError(""); }} onKeyDown={event => { if (event.key === "Enter") createGroup(); if (event.key === "Escape") setGroupDialog(false); }} placeholder="e.g. Traction power subsystem"/></label>{groupError && <p className="group-error" role="alert">{groupError}</p>}<div className="group-dialog-actions"><button className="group-cancel" onClick={() => setGroupDialog(false)}>Cancel</button><button className="group-create" onClick={createGroup}>Create group</button></div></section></div>}
  </section>;
}
