"use client";

import { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { canvasGridMetrics, DEFAULT_CANVAS_ZOOM, MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM, zoomCanvasAtPointer } from "@/engine/canvas-zoom";
import { basicEventProbability, evaluateGate, gateFormula, type FtaGateType } from "@/engine/fta";
import { componentAvailability, meanTimeBetweenFailures } from "@/engine/reliability";
import { Icons } from "@/lib/icons";
import { Asset, DiagramEdge, DiagramNode, DiagramReportRow, DiagramState, REGISTER_UPDATED_EVENT, readAssets, readDiagram, saveDiagram, starterAssets } from "@/data/workspace";
import { accountStorageKey } from "@/services/auth/session";

type PortSide = "top" | "bottom";
type GateType = FtaGateType;
type EventType = "event top" | "event intermediate" | "event basic";
type Analysis = { probability: number; formula: string; topEvent: string } | null;

const EMPTY: DiagramState = { nodes: [], edges: [] };
const EVENT_WIDTH = 196;
const EVENT_HEIGHT = 108;
const GATE_WIDTH = 54;
const GATE_HEIGHT = 60;

function isGate(node?: DiagramNode) { return Boolean(node?.type.startsWith("gate ")); }
function gateLabel(type: string) { return type.replace("gate ", "").toUpperCase(); }

function GateGraphic({ type, id }: { type: string; id: string }) {
  const kind = type.replace("gate ", "");
  return <span className="fta-gate-graphic"><svg viewBox="0 0 64 54" aria-label={`${gateLabel(type)} gate`}>
    <g transform="translate(0 54) scale(1 -1)">
      {kind === "and" && <path d="M10 7h44v17c0 15-10 24-22 24S10 39 10 24V7Z"/>}
      {kind === "or" && <><path d="M10 7c12 6 32 6 44 0-2 19-9 34-22 41C19 41 12 26 10 7Z"/><path className="gate-detail" d="M10 7c13 9 31 9 44 0"/></>}
      {kind === "xor" && <><path d="M10 10c12 5 32 5 44 0-2 18-9 31-22 38C19 41 12 28 10 10Z"/><path className="gate-detail" d="M9 5c13 7 33 7 46 0"/></>}
      {kind === "not" && <><path d="M14 7h36L32 43 14 7Z"/><circle cx="32" cy="48" r="4"/></>}
    </g>
  </svg><b>{id}</b><small>{gateLabel(type)}</small></span>;
}

function reportRows(nodes: DiagramNode[], assets: Asset[]): DiagramReportRow[] {
  return nodes.filter(node => node.assetId).sort((first, second) => first.y - second.y || first.x - second.x).map(node => {
    const asset = assets.find(item => item.id === node.assetId);
    const lambda = asset?.lambda ?? node.failureRate ?? 0;
    const mttr = asset?.mttr ?? node.mttr ?? 0;
    return {
      reference: asset?.tag ?? node.title,
      component: asset?.description ?? node.subtitle,
      type: node.type === "event top" ? "Top event" : node.type === "event intermediate" ? "Intermediate event" : "Basic event",
      failureRate: lambda ? lambda.toExponential(3) : "0",
      mtbf: lambda ? Math.round(meanTimeBetweenFailures(lambda)).toLocaleString() : "∞",
      mttr: mttr.toFixed(2),
      availability: `${(componentAvailability({ lambda, mttr }) * 100).toFixed(5)}%`,
    };
  });
}

export default function FTAEditor({ onReportChange }: { onReportChange?: (rows: DiagramReportRow[]) => void }) {
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [edges, setEdges] = useState<DiagramEdge[]>([]);
  const [assets, setAssets] = useState<Asset[]>(starterAssets);
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(DEFAULT_CANVAS_ZOOM);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [analysed, setAnalysed] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>(null);
  const [notice, setNotice] = useState("");
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [portDrag, setPortDrag] = useState<{ from: number; start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
  const [pendingGate, setPendingGate] = useState<{ from: number; to: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ nodeId: number; x: number; y: number } | null>(null);
  const undoStack = useRef<DiagramState[]>([]);
  const redoStack = useRef<DiagramState[]>([]);
  const latest = useRef<DiagramState>(EMPTY);

  useEffect(() => {
    const version = accountStorageKey("fta-iec61025-v1");
    if (version && !window.localStorage.getItem(version)) {
      window.localStorage.setItem(version, "1");
    }
    const saved = readDiagram("fta", EMPTY);
    latest.current = saved;
    setNodes(saved.nodes);
    setEdges(saved.edges);
    setSelected(saved.nodes[0]?.id ?? 0);
    setAssets(readAssets());
    setHydrated(true);
    const refresh = (event: Event) => setAssets(Array.isArray((event as CustomEvent<Asset[]>).detail) ? (event as CustomEvent<Asset[]>).detail : readAssets());
    window.addEventListener(REGISTER_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(REGISTER_UPDATED_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, []);

  useEffect(() => {
    latest.current = { nodes, edges };
    if (hydrated) {
      saveDiagram("fta", { nodes, edges });
      onReportChange?.(reportRows(nodes, assets));
    }
  }, [nodes, edges, assets, hydrated, onReportChange]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
      if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      if (event.key === "Delete" && !["INPUT", "SELECT", "TEXTAREA"].includes(tag)) selectedEdge !== null ? removeSelectedEdge() : selected && removeSelected();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const filteredAssets = useMemo(() => assets.filter(asset => `${asset.tag} ${asset.description} ${asset.system}`.toLowerCase().includes(search.toLowerCase())), [assets, search]);

  function remember() {
    undoStack.current.push(structuredClone(latest.current));
    if (undoStack.current.length > 60) undoStack.current.shift();
    redoStack.current = [];
  }
  function restore(state: DiagramState) { setNodes(state.nodes); setEdges(state.edges); setSelected(0); setSelectedEdge(null); setAnalysed(false); setAnalysis(null); }
  function undo() { const state = undoStack.current.pop(); if (!state) return; redoStack.current.push(structuredClone(latest.current)); restore(state); }
  function redo() { const state = redoStack.current.pop(); if (!state) return; undoStack.current.push(structuredClone(latest.current)); restore(state); }
  function invalidateAnalysis() { setAnalysed(false); setAnalysis(null); }

  function nodeSize(node: DiagramNode) { return isGate(node) ? { width: GATE_WIDTH, height: GATE_HEIGHT } : { width: EVENT_WIDTH, height: EVENT_HEIGHT }; }
  function point(node: DiagramNode, side: PortSide) {
    const size = nodeSize(node);
    return { x: node.x + size.width / 2, y: side === "top" ? node.y : node.y + size.height };
  }
  function nextPosition() {
    const index = nodes.filter(node => !isGate(node)).length;
    return { x: 330 + (index % 4) * 245, y: 90 + Math.floor(index / 4) * 165 };
  }
  function addAsset(asset: Asset, position?: { x: number; y: number }) {
    remember();
    const id = Math.max(0, ...nodes.map(node => node.id)) + 1;
    setNodes(current => [...current, { id, ...(position ?? nextPosition()), type: "event basic", title: asset.tag, subtitle: asset.description, assetId: asset.id }]);
    setSelected(id); setSelectedEdge(null);
    invalidateAnalysis();
  }
  function drop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault(); setDragOver(false);
    try {
      const { id } = JSON.parse(event.dataTransfer.getData("application/x-ramsport")) as { id?: string };
      const asset = assets.find(item => item.id === id);
      const rect = event.currentTarget.getBoundingClientRect();
      if (asset) addAsset(asset, { x: Math.max(12, ((event.clientX - rect.left) - pan.x) * 100 / zoom - EVENT_WIDTH / 2), y: Math.max(12, ((event.clientY - rect.top) - pan.y) * 100 / zoom - EVENT_HEIGHT / 2) });
      else setNotice("That item is not available in the Data Register.");
    } catch { setNotice("The dropped item could not be added. Drag a component from the Data Register and try again."); }
  }

  function dragNode(event: ReactPointerEvent, node: DiagramNode) {
    if ((event.target as HTMLElement).closest(".port")) return;
    event.preventDefault(); remember(); setSelected(node.id); setSelectedEdge(null); setContextMenu(null); invalidateAnalysis();
    const start = { x: event.clientX, y: event.clientY, nodeX: node.x, nodeY: node.y };
    const move = (pointer: PointerEvent) => setNodes(current => current.map(item => item.id === node.id ? { ...item, x: Math.max(12, start.nodeX + (pointer.clientX - start.x) * 100 / zoom), y: Math.max(12, start.nodeY + (pointer.clientY - start.y) * 100 / zoom) } : item));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function startPortDrag(event: ReactPointerEvent, node: DiagramNode, side: PortSide) {
    event.preventDefault(); event.stopPropagation(); setSelected(node.id);
    const rect = (event.currentTarget.closest(".workbench-canvas-wrap") as HTMLElement)?.getBoundingClientRect();
    const cursor = (x: number, y: number) => ({ x: ((x - (rect?.left ?? 0)) - pan.x) * 100 / zoom, y: ((y - (rect?.top ?? 0)) - pan.y) * 100 / zoom });
    setPortDrag({ from: node.id, start: point(node, side), current: cursor(event.clientX, event.clientY) });
    const move = (pointer: PointerEvent) => setPortDrag(current => current ? { ...current, current: cursor(pointer.clientX, pointer.clientY) } : null);
    const up = (pointer: PointerEvent) => {
      const target = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest<HTMLElement>("[data-port-node]");
      const targetId = Number(target?.dataset.portNode);
      if (targetId && targetId !== node.id) connect(node.id, targetId);
      else setNotice("Connection not created. Release the line on a connection dot of a different event.");
      setPortDrag(null);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function normalizedConnection(firstId: number, secondId: number) {
    const first = nodes.find(node => node.id === firstId), second = nodes.find(node => node.id === secondId);
    if (!first || !second) return null;
    return first.y >= second.y ? { from: first.id, to: second.id } : { from: second.id, to: first.id };
  }
  function addEdge(from: number, to: number) {
    if (edges.some(edge => edge.from === from && edge.to === to)) { setNotice("These events are already connected."); return; }
    remember(); setEdges(current => [...current, { from, to, style: "elbow" }]); invalidateAnalysis();
  }
  function connect(firstId: number, secondId: number) {
    const connection = normalizedConnection(firstId, secondId); if (!connection) { setNotice("Connection not created because one of the selected events is no longer available."); return; }
    const source = nodes.find(node => node.id === connection.from), target = nodes.find(node => node.id === connection.to);
    if (!source || !target) { setNotice("Connection not created because one of the selected events is no longer available."); return; }
    if (isGate(source) || isGate(target)) { addEdge(connection.from, connection.to); return; }
    const existingGateConnection = edges.find(edge => edge.to === target.id && isGate(nodes.find(node => node.id === edge.from)));
    if (existingGateConnection) { addEdge(source.id, existingGateConnection.from); return; }
    setPendingGate(connection);
  }
  function confirmGate(type: GateType) {
    if (!pendingGate) return;
    const source = nodes.find(node => node.id === pendingGate.from), target = nodes.find(node => node.id === pendingGate.to);
    if (!source || !target) { setPendingGate(null); setNotice("The gate could not be created because the selected events are no longer available."); return; }
    remember();
    const id = Math.max(0, ...nodes.map(node => node.id)) + 1;
    const gate: DiagramNode = { id, x: (source.x + target.x) / 2 + (EVENT_WIDTH - GATE_WIDTH) / 2, y: (source.y + target.y) / 2 + 30, type, title: gateLabel(type), subtitle: "Logic gate" };
    setNodes(current => [...current, gate]);
    setEdges(current => [...current, { from: source.id, to: id, style: "elbow" }, { from: id, to: target.id, style: "elbow" }]);
    setSelected(id); setPendingGate(null); invalidateAnalysis();
  }
  function changeGate(nodeId: number, type: GateType) { remember(); setNodes(current => current.map(node => node.id === nodeId ? { ...node, type, title: gateLabel(type) } : node)); setContextMenu(null); invalidateAnalysis(); }
  function changeEvent(nodeId: number, type: EventType) {
    remember();
    setNodes(current => current.map(node => {
      if (type === "event top" && node.type === "event top" && node.id !== nodeId) return { ...node, type: "event intermediate" };
      return node.id === nodeId ? { ...node, type } : node;
    }));
    setContextMenu(null); invalidateAnalysis();
  }
  function removeSelected() { if (!selected) return; remember(); setNodes(current => current.filter(node => node.id !== selected)); setEdges(current => current.filter(edge => edge.from !== selected && edge.to !== selected)); setSelected(0); invalidateAnalysis(); }
  function removeSelectedEdge() { if (selectedEdge === null) return; remember(); setEdges(current => current.filter((_, index) => index !== selectedEdge)); setSelectedEdge(null); invalidateAnalysis(); }

  function edgeHandle(edge: DiagramEdge) {
    if (edge.waypoint) return edge.waypoint;
    const source = nodes.find(node => node.id === edge.from), target = nodes.find(node => node.id === edge.to);
    if (!source || !target) return { x: 0, y: 0 };
    const start = point(source, "top"), end = point(target, "bottom");
    return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  }
  function dragEdgeHandle(event: ReactPointerEvent, index: number) {
    event.preventDefault(); event.stopPropagation(); remember(); setSelectedEdge(index); setSelected(0); invalidateAnalysis();
    const wrap = (event.currentTarget.closest(".workbench-canvas-wrap") as HTMLElement)?.getBoundingClientRect();
    const move = (pointer: PointerEvent) => {
      const waypoint = { x: ((pointer.clientX - (wrap?.left ?? 0)) - pan.x) * 100 / zoom, y: ((pointer.clientY - (wrap?.top ?? 0)) - pan.y) * 100 / zoom };
      setEdges(current => current.map((edge, edgeIndex) => edgeIndex === index ? { ...edge, waypoint } : edge));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
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
    return edgePoints(edge).map((item, index) => `${index ? "L" : "M"}${item.x} ${item.y}`).join(" ");
  }

  function edgePoints(edge: DiagramEdge) {
    const source = nodes.find(node => node.id === edge.from), target = nodes.find(node => node.id === edge.to); if (!source || !target) return [];
    const start = point(source, "top"), end = point(target, "bottom");
    if (!edge.waypoint && Math.abs(start.x - end.x) < 8) return [start, end];
    const waypoint = edge.waypoint ?? { x: end.x, y: (start.y + end.y) / 2 };
    return [start, { x: start.x, y: waypoint.y }, waypoint, { x: waypoint.x, y: end.y }, end].filter((item, index, values) => !index || item.x !== values[index - 1].x || item.y !== values[index - 1].y);
  }

  function edgeArrow(edge: DiagramEdge) {
    const points = edgePoints(edge);
    if (!Array.isArray(points) || points.length < 2) return null;
    const candidates = points.slice(1).map((second, index) => ({ first: points[index], second, index, length: Math.abs(second.x - points[index].x) + Math.abs(second.y - points[index].y) })).filter(segment => segment.length >= 24 && segment.index > 0 && segment.index < points.length - 2);
    const segments = candidates.length ? candidates : points.slice(1).map((second, index) => ({ first: points[index], second, index, length: Math.abs(second.x - points[index].x) + Math.abs(second.y - points[index].y) })).filter(segment => segment.length >= 24);
    const segment = segments.sort((first, second) => second.length - first.length)[0];
    if (!segment) return null;
    return { x: (segment.first.x + segment.second.x) / 2, y: (segment.first.y + segment.second.y) / 2, angle: Math.atan2(segment.second.y - segment.first.y, segment.second.x - segment.first.x) * 180 / Math.PI };
  }

  function evaluate(id: number, visiting = new Set<number>()): number {
    if (visiting.has(id)) return 0;
    const node = nodes.find(item => item.id === id); if (!node) return 0;
    const inputs = edges.filter(edge => edge.to === id).map(edge => evaluate(edge.from, new Set(visiting).add(id)));
    if (isGate(node)) return evaluateGate(node.type, inputs);
    if (inputs.length) return inputs.length === 1 ? inputs[0] : evaluateGate("gate or", inputs);
    const asset = node.assetId ? assets.find(item => item.id === node.assetId) : undefined;
    return basicEventProbability(asset?.lambda ?? node.failureRate ?? 0, asset?.mission ?? node.mission ?? 1);
  }

  function standardLayout(topId: number) {
    const depths = new Map<number, number>([[topId, 0]]);
    const queue = [topId];
    while (queue.length) {
      const target = queue.shift()!;
      const depth = depths.get(target) ?? 0;
      for (const edge of edges.filter(item => item.to === target)) {
        if (!depths.has(edge.from) || (depths.get(edge.from) ?? 0) < depth + 1) {
          depths.set(edge.from, depth + 1); queue.push(edge.from);
        }
      }
    }
    const maxDepth = Math.max(0, ...depths.values());
    for (const node of nodes) if (!depths.has(node.id)) depths.set(node.id, maxDepth + 1);
    const levels = new Map<number, DiagramNode[]>();
    for (const node of nodes) { const depth = depths.get(node.id) ?? 0; levels.set(depth, [...(levels.get(depth) ?? []), node]); }
    return nodes.map(node => {
      const depth = depths.get(node.id) ?? 0;
      const level = levels.get(depth) ?? [node];
      const index = level.findIndex(item => item.id === node.id);
      const spacing = 245;
      const width = (level.length - 1) * spacing;
      const centerOffset = isGate(node) ? GATE_WIDTH / 2 : EVENT_WIDTH / 2;
      return { ...node, x: 900 - width / 2 + index * spacing - centerOffset, y: 55 + depth * 165 };
    });
  }

  function runAnalysis() {
    const eventNodes = nodes.filter(node => !isGate(node));
    if (!eventNodes.length) { setAnalysis(null); setNotice("Add at least one event before calculating the fault tree."); return; }
    let top = eventNodes.find(node => node.type === "event top");
    if (!top) top = eventNodes.filter(node => !edges.some(edge => edge.from === node.id)).sort((a, b) => a.y - b.y)[0] ?? eventNodes[0];
    const topInput = edges.find(edge => edge.to === top!.id);
    const topLogic = nodes.find(node => node.id === topInput?.from && isGate(node));
    const probability = evaluate(top.id);
    remember();
    setNodes(standardLayout(top.id));
    setSelected(top.id); setAnalysed(true);
    setAnalysis({ probability, formula: gateFormula(topLogic?.type), topEvent: top.title });
    setNotice("");
  }

  const grid = canvasGridMetrics(zoom, pan);
  const gridStyle = { "--grid-small": `${grid.small}px`, "--grid-large": `${grid.large}px`, "--grid-x": `${grid.x}px`, "--grid-y": `${grid.y}px` } as CSSProperties;
  return <section className="workbench fta-workbench fta-standard" onClick={() => setContextMenu(null)}>
    <header className="workbench-toolbar">
      <button className={`wb-action history-action ${panMode ? "active" : ""}`} onClick={() => setPanMode(value => !value)} title="Pan the diagram"><Icons.pan/>Pan</button>
      <button className="wb-action history-action" onClick={undo} title="Undo (Ctrl+Z)"><Icons.undo/>Undo</button>
      <button className="wb-action history-action" onClick={redo} title="Redo (Ctrl+Y)"><Icons.redo/>Redo</button>
      <span className="wb-separator"/>
      <button className="wb-action run" onClick={runAnalysis}><Icons.play/>Calculate</button>
      <button className="wb-action clear" onClick={() => { if (!nodes.length || window.confirm("Clear the complete fault tree?")) { remember(); setNodes([]); setEdges([]); setSelected(0); invalidateAnalysis(); } }}>Clear</button>
      <button className="wb-action reset" onClick={() => { setZoom(DEFAULT_CANVAS_ZOOM); setPan({ x: 0, y: 0 }); setSelected(0); setSelectedEdge(null); invalidateAnalysis(); }}>Reset view</button>
      <span className="wb-hint">Drag between connection dots. Select a connector to move its 90° bend.</span>
    </header>
    <div className="workbench-body">
      <aside className="component-library">
        <div className="library-heading"><strong>Data Register</strong><button onClick={() => setAssets(readAssets())} title="Refresh from Data Register">&#8635;</button></div>
        <label className="library-search"><Icons.search/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find component"/></label>
        <div className="library-scroll">{filteredAssets.map(asset => <button className="library-card" key={asset.id} draggable onDragStart={event => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-ramsport", JSON.stringify({ id: asset.id })); }} onClick={() => addAsset(asset)}>
          <strong>{asset.description}</strong><span className="lambda">lambda: {asset.lambda.toExponential(2)} /h</span><span className="mtbf">MTBF: {asset.lambda ? Math.round(meanTimeBetweenFailures(asset.lambda)).toLocaleString() : "-"} h</span><span className="mttr">MTTR: {asset.mttr} h</span><small>{asset.tag}</small>
        </button>)}</div>
      </aside>
      <div className={`workbench-canvas-wrap ${dragOver ? "drop-ready" : ""} ${panMode ? "pan-active" : ""}`} style={gridStyle} onPointerDown={startPan} onWheel={wheelZoom} onDragOver={event => { event.preventDefault(); setDragOver(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false); }} onDrop={drop}>
        {notice && <div className="workbench-notice" role="alert"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}
        <div className="workbench-canvas" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom / 100})`, transformOrigin: "top left" }}>
          <svg className="connections">{edges.map((edge, index) => {
            const arrow = edgeArrow(edge);
            return <g key={`${edge.from}-${edge.to}-${index}`}><path data-export-edge="true" data-export-from={edge.from} data-export-to={edge.to} className={`diagram-edge ${selectedEdge === index ? "selected" : ""}`} d={edgePath(edge)} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); setSelectedEdge(index); setSelected(0); }}/>{arrow && <polygon className="flow-arrow" points="-6,-4 6,0 -6,4" transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}/>}</g>;
          })}{portDrag && <path className="connection-preview" d={`M${portDrag.start.x} ${portDrag.start.y} L${portDrag.current.x} ${portDrag.current.y}`}/>}</svg>
          {edges.map((edge, index) => selectedEdge === index ? <button key={`handle-${index}`} className="edge-handle" style={{ left: edgeHandle(edge).x, top: edgeHandle(edge).y }} onPointerDown={event => dragEdgeHandle(event, index)} title="Drag to adjust connector bend"/> : null)}
          {nodes.map(node => {
            const asset = node.assetId ? assets.find(item => item.id === node.assetId) : undefined;
            const gate = isGate(node);
            const probability = !gate ? basicEventProbability(asset?.lambda ?? node.failureRate ?? 0, asset?.mission ?? node.mission ?? 1) : 0;
            const gateId = gate ? `G${nodes.filter(isGate).findIndex(item => item.id === node.id) + 1}` : "";
            return <div data-export-node="true" data-export-id={node.id} data-export-type={node.type} key={node.id} className={`workbench-node ${gate ? "logic-gate-node" : "fta-event-node"} ${node.type.replaceAll(" ", "-")} ${analysed ? "analysed" : "editing"} ${selected === node.id ? "selected" : ""}`} style={{ left: node.x, top: node.y }} onPointerDown={event => dragNode(event, node)} onClick={event => { event.stopPropagation(); setSelected(node.id); setSelectedEdge(null); }} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); setSelected(node.id); setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY }); }}>
              {(["top", "bottom"] as PortSide[]).map(side => <span key={side} className={`port ${side}`} data-port-node={node.id} onPointerDown={event => startPortDrag(event, node, side)} title="Drag to another connection point"/>)}
              {gate ? <GateGraphic type={node.type} id={gateId}/> : analysed ? <div className={`fta-event-symbol ${node.type.replace("event ", "")}`}><strong>{asset?.tag ?? node.title}</strong><span>{asset?.description ?? node.subtitle}</span><small>Q(t) {probability.toExponential(3)}</small></div> : <><strong className="part-number">{asset?.tag ?? node.title}</strong><div className="block-values"><span><b>lambda</b>{(asset?.lambda ?? node.failureRate ?? 0).toExponential(2)} /h</span><span><b>MTBF</b>{asset?.lambda ? Math.round(meanTimeBetweenFailures(asset.lambda)).toLocaleString() : "-"} h</span><span><b>Mission</b>{asset?.mission ?? node.mission ?? 0} h</span></div><small className="component-name">{asset?.description ?? node.subtitle}</small><span className={`fault-event-badge ${node.type.replace("event ", "")}`} aria-label={node.type}/></>}
            </div>;
          })}
        </div>
        <footer className="workbench-status"><span>{nodes.filter(node => !isGate(node)).length} events</span><span>{nodes.filter(isGate).length} gates</span><span>{edges.length} connections</span><span className="autosave-state">Saved locally</span><div className="zoom-control"><button onClick={() => setZoom(Math.max(MIN_CANVAS_ZOOM, zoom - 10))}>-</button><input type="range" min={MIN_CANVAS_ZOOM} max={MAX_CANVAS_ZOOM} step="10" value={zoom} onChange={event => setZoom(Number(event.target.value))}/><button onClick={() => setZoom(Math.min(MAX_CANVAS_ZOOM, zoom + 10))}>+</button><b>{zoom}%</b></div></footer>
      </div>
      <aside className="workbench-inspector fta-result-panel result-only-panel"><div className="inspector-heading"><strong>Result</strong><span>IEC 61025</span></div>{analysis ? <div className="system-result"><p className="result-summary">Calculated top-event result</p><dl><div><dt>Top event</dt><dd>{analysis.topEvent}</dd></div><div className="availability-row"><dt>Probability</dt><dd>{analysis.probability.toExponential(4)}</dd></div><div><dt>Applied logic</dt><dd>{analysis.formula}</dd></div></dl><p>Constant failure rate and statistically independent inputs assumed.</p></div> : <div className="inspector-empty"><Icons.play/><strong>No result yet</strong><p>Build the fault tree and click Calculate.</p></div>}<section className="method-reference"><h3>Gate reference</h3><dl><div><dt>AND</dt><dd>Output occurs when every input occurs.<code>Q = Π Qi</code></dd></div><div><dt>OR</dt><dd>Output occurs when one or more inputs occur.<code>Q = 1 − Π(1 − Qi)</code></dd></div><div><dt>XOR</dt><dd>Output occurs when exactly one input occurs.</dd></div><div><dt>NOT</dt><dd>Logical complement of one input.<code>Q = 1 − Q1</code></dd></div></dl></section></aside>
    </div>
    {pendingGate && <div className="gate-dialog-backdrop" role="dialog" aria-modal="true"><section className="gate-dialog"><span>FAULT-TREE LOGIC</span><h2>Select the causal relationship</h2><p>The selected standard gate will be inserted between these events. Further inputs connected to the same output reuse this gate automatically.</p><div><button onClick={() => confirmGate("gate and")}>AND</button><button onClick={() => confirmGate("gate or")}>OR</button><button onClick={() => confirmGate("gate xor")}>XOR</button><button onClick={() => confirmGate("gate not")}>NOT</button></div><button className="gate-cancel" onClick={() => setPendingGate(null)}>Cancel</button></section></div>}
    {contextMenu && (() => { const node = nodes.find(item => item.id === contextMenu.nodeId); return node ? <div className="gate-change-menu fta-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={event => event.stopPropagation()}>{isGate(node) ? <><strong>Change logic gate</strong>{(["gate and", "gate or", "gate xor", "gate not"] as GateType[]).map(type => <button key={type} onClick={() => changeGate(node.id, type)}><span className={`mini-gate ${type.replace("gate ", "")}`}/>{gateLabel(type)}</button>)}</> : <><strong>Set event type</strong>{(["event top", "event intermediate", "event basic"] as EventType[]).map(type => <button key={type} onClick={() => changeEvent(node.id, type)}>{type.replace("event ", "").replace(/^./, value => value.toUpperCase())} event</button>)}</>}<button className="context-delete" onClick={removeSelected}>Delete selected</button></div> : null; })()}
  </section>;
}
