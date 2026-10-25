"use client";

import { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, type CSSProperties, useEffect, useRef, useState } from "react";
import { canvasGridMetrics, DEFAULT_CANVAS_ZOOM, MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM, zoomCanvasAtPointer } from "@/engine/canvas-zoom";
import { componentAvailability, meanTimeBetweenFailures } from "@/engine/reliability";
import { analyzeRbd, type RbdAnalysis } from "@/engine/rbd";
import { lockRbdConnectionPorts, lockedPortPoint, routeRbdConnection, type PortSide } from "@/engine/diagram-routing";
import { Icons } from "@/lib/icons";
import { Asset, DiagramEdge, DiagramNode, DiagramReportRow, DiagramState, REGISTER_UPDATED_EVENT, readAssets, readDiagram, saveDiagram, starterAssets } from "@/lib/workspace";
import { accountStorageKey } from "@/lib/account";

type Mode = "rbd" | "fta";
type GateType = "gate and" | "gate or" | "gate xor" | "gate not";
const blankDiagram: DiagramState = { nodes: [], edges: [] };
const BLOCK_WIDTH = 196;
const BLOCK_HEIGHT = 108;

export function createDiagramReportRows(mode: Mode, nodes: DiagramNode[], assets: Asset[] = starterAssets): DiagramReportRow[] {
  return nodes.filter(node => node.assetId).sort((first, second) => first.x - second.x || first.y - second.y).map(node => {
    const asset = assets.find(item => item.id === node.assetId);
    const lambda = asset?.lambda ?? node.failureRate ?? 0;
    const mttr = asset?.mttr ?? node.mttr ?? 0;
    return { reference: asset?.tag ?? node.title, component: asset?.description ?? node.subtitle, type: mode === "rbd" ? "Reliability block" : "Basic event", failureRate: lambda ? lambda.toExponential(3) : "0", mtbf: lambda ? Math.round(meanTimeBetweenFailures(lambda)).toLocaleString() : "∞", mttr: mttr.toFixed(2), availability: `${(componentAvailability({ lambda, mttr }) * 100).toFixed(5)}%` };
  });
}

function isGate(node?: DiagramNode) { return Boolean(node?.type.startsWith("gate ")); }
function gateLabel(type: string) { return type.replace("gate ", "").toUpperCase(); }

export default function DiagramEditor({ mode, onReportChange }: { mode: Mode; onReportChange?: (rows: DiagramReportRow[]) => void }) {
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [edges, setEdges] = useState<DiagramEdge[]>([]);
  const [assets, setAssets] = useState<Asset[]>(starterAssets);
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(DEFAULT_CANVAS_ZOOM);
  const [analysis, setAnalysis] = useState<RbdAnalysis | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [portDrag, setPortDrag] = useState<{ from: number; side: PortSide; start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
  const [pendingGate, setPendingGate] = useState<{ from: number; to: number } | null>(null);
  const [gateMenu, setGateMenu] = useState<{ nodeId: number; x: number; y: number } | null>(null);
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
    setNodes(saved.nodes); setEdges(normalizedEdges); setSelected(saved.nodes[0]?.id || 0); setAssets(readAssets()); setHydrated(true);
    const refresh = (event: Event) => setAssets(Array.isArray((event as CustomEvent<Asset[]>).detail) ? (event as CustomEvent<Asset[]>).detail : readAssets());
    window.addEventListener(REGISTER_UPDATED_EVENT, refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(REGISTER_UPDATED_EVENT, refresh); window.removeEventListener("storage", refresh); };
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
      if (event.key === "Delete" && !["INPUT", "SELECT", "TEXTAREA"].includes(tag)) selectedEdge !== null ? removeSelectedEdge() : selected && removeSelected();
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  });

  const filteredAssets = assets.filter(asset => `${asset.tag} ${asset.description} ${asset.system}`.toLowerCase().includes(search.toLowerCase()));

  function remember() { undoStack.current.push(structuredClone(latest.current)); if (undoStack.current.length > 60) undoStack.current.shift(); redoStack.current = []; }
  function restore(state: DiagramState) { setNodes(state.nodes); setEdges(mode === "rbd" ? lockRbdConnectionPorts(state.nodes, state.edges) : state.edges); setSelected(0); setSelectedEdge(null); setAnalysis(null); }
  function undo() { const state = undoStack.current.pop(); if (!state) return; redoStack.current.push(structuredClone(latest.current)); restore(state); }
  function redo() { const state = redoStack.current.pop(); if (!state) return; undoStack.current.push(structuredClone(latest.current)); restore(state); }

  function runAnalysis() {
    const components = nodes.filter(node => node.assetId).map(node => {
      const asset = assets.find(item => item.id === node.assetId);
      const failureRate = asset?.lambda ?? node.failureRate ?? 0, mttr = asset?.mttr ?? node.mttr ?? 0;
      return { id: node.id, x: node.x, availability: componentAvailability({ lambda: failureRate, mttr }), failureRate, mttr };
    });
    setAnalysis(analyzeRbd(components, edges));
  }

  function nextPosition() { const index = nodes.filter(node => !isGate(node)).length; return { x: 75 + index % 4 * 245, y: 90 + Math.floor(index / 4) * 165 }; }
  function invalidateAnalysis() { setAnalysis(null); }
  function addAsset(asset: Asset, position = nextPosition()) { remember(); const id = Math.max(0, ...nodes.map(node => node.id)) + 1; setNodes(current => [...current, { id, ...position, type: mode === "rbd" ? "block" : "event basic", title: asset.tag, subtitle: asset.description, assetId: asset.id }]); setSelected(id); setSelectedEdge(null); invalidateAnalysis(); }
  function drop(event: ReactDragEvent<HTMLDivElement>) { event.preventDefault(); setDragOver(false); try { const { id } = JSON.parse(event.dataTransfer.getData("application/x-ramsport")) as { id?: string }; const asset = assets.find(item => item.id === id); const rect = event.currentTarget.getBoundingClientRect(); if (asset) addAsset(asset, { x: Math.max(12, ((event.clientX - rect.left) - pan.x) * 100 / zoom - BLOCK_WIDTH / 2), y: Math.max(12, ((event.clientY - rect.top) - pan.y) * 100 / zoom - BLOCK_HEIGHT / 2) }); } catch { /* ignore external drops */ } }

  function dragNode(event: ReactPointerEvent, node: DiagramNode) {
    if ((event.target as HTMLElement).closest(".port")) return;
    event.preventDefault(); remember(); setSelected(node.id); setSelectedEdge(null); setGateMenu(null); invalidateAnalysis();
    const start = { x: event.clientX, y: event.clientY, nodeX: node.x, nodeY: node.y };
    const move = (pointer: PointerEvent) => setNodes(current => current.map(item => item.id === node.id ? { ...item, x: Math.max(12, start.nodeX + (pointer.clientX - start.x) * 100 / zoom), y: Math.max(12, start.nodeY + (pointer.clientY - start.y) * 100 / zoom) } : item));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function portPoint(node: DiagramNode, side: PortSide) { return lockedPortPoint(node, side); }
  function startPortDrag(event: ReactPointerEvent, node: DiagramNode, side: PortSide) {
    event.preventDefault(); event.stopPropagation(); setSelected(node.id);
    const rect = (event.currentTarget.closest(".workbench-canvas-wrap") as HTMLElement)?.getBoundingClientRect();
    const point = (x: number, y: number) => ({ x: ((x - (rect?.left || 0)) - pan.x) * 100 / zoom, y: ((y - (rect?.top || 0)) - pan.y) * 100 / zoom });
    setPortDrag({ from: node.id, side, start: portPoint(node, side), current: point(event.clientX, event.clientY) });
    const move = (pointer: PointerEvent) => setPortDrag(current => current ? { ...current, current: point(pointer.clientX, pointer.clientY) } : null);
    const up = (pointer: PointerEvent) => { const target = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest<HTMLElement>("[data-port-node]"); const to = Number(target?.dataset.portNode); const toSide = target?.dataset.portSide as PortSide | undefined; if (to && to !== node.id && toSide) connect(node.id, to, side, toSide); setPortDrag(null); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function addEdge(from: number, to: number, fromSide?: PortSide, toSide?: PortSide) {
    remember();
    setEdges(current => {
      if (current.some(edge => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from))) return current;
      const candidate: DiagramEdge = { from, to, style: "elbow", fromSide, toSide };
      const fixed = mode === "rbd" ? lockRbdConnectionPorts(nodes, [candidate])[0] : candidate;
      return [...current, fixed];
    });
    invalidateAnalysis();
  }
  function connect(from: number, to: number, fromSide?: PortSide, toSide?: PortSide) { const source = nodes.find(node => node.id === from), target = nodes.find(node => node.id === to); if (!source || !target) return; if (mode === "rbd" || isGate(source) || isGate(target)) addEdge(from, to, fromSide, toSide); else setPendingGate({ from, to }); }
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
  function removeSelected() { if (!selected) return; remember(); setNodes(current => current.filter(node => node.id !== selected)); setEdges(current => current.filter(edge => edge.from !== selected && edge.to !== selected)); setSelected(0); invalidateAnalysis(); }
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
    const from = nodes.find(node => node.id === edge.from), to = nodes.find(node => node.id === edge.to); if (!from || !to) return "";
    if (mode === "fta") { const start = portPoint(from, "top"), end = portPoint(to, "bottom"); if (Math.abs(start.x - end.x) < 8) return `M${start.x} ${start.y} L${end.x} ${end.y}`; const middleY = (start.y + end.y) / 2; return `M${start.x} ${start.y} V${middleY} H${end.x} V${end.y}`; }
    return routeRbdConnection(nodes, edge).path;
  }

  const blockPorts: PortSide[] = mode === "rbd" ? ["left", "right"] : ["top", "bottom"];
  const grid = canvasGridMetrics(zoom, pan);
  const gridStyle = { "--grid-small": `${grid.small}px`, "--grid-large": `${grid.large}px`, "--grid-x": `${grid.x}px`, "--grid-y": `${grid.y}px` } as CSSProperties;
  return <section className={`workbench ${mode}-workbench`} onClick={() => setGateMenu(null)}>
    <header className="workbench-toolbar">
      <button className={`wb-action history-action ${panMode ? "active" : ""}`} onClick={() => setPanMode(value => !value)} title="Pan the diagram"><Icons.pan/>Pan</button>
      <button className="wb-action history-action" onClick={undo} title="Undo (Ctrl+Z)"><Icons.undo/>Undo</button><button className="wb-action history-action" onClick={redo} title="Redo (Ctrl+Y)"><Icons.redo/>Redo</button><span className="wb-separator"/>
      <button className="wb-action run" onClick={runAnalysis}><Icons.play/>Calculate</button><button className="wb-action clear" onClick={() => { if (!nodes.length || window.confirm("Clear the complete diagram?")) { remember(); setNodes([]); setEdges([]); setSelected(0); setSelectedEdge(null); setAnalysis(null); } }}>Clear</button><button className="wb-action reset" onClick={() => { setZoom(DEFAULT_CANVAS_ZOOM); setPan({ x: 0, y: 0 }); setSelected(0); setSelectedEdge(null); }}>Reset view</button>
      <span className="wb-hint">Drag between connection dots. Select a connector to move its 90° bend.</span>
    </header>
    <div className="workbench-body">
      <aside className="component-library"><div className="library-heading"><strong>Components</strong><button onClick={() => setAssets(readAssets())} title="Refresh from Data Register">↻</button></div><label className="library-search"><Icons.search/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find component"/></label><div className="library-scroll">{filteredAssets.map(asset => <button className="library-card" key={asset.id} draggable onDragStart={event => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-ramsport", JSON.stringify({ id: asset.id })); }} onClick={() => addAsset(asset)}><strong>{asset.description}</strong><span className="lambda">λ: {asset.lambda.toExponential(2)} /h</span><span className="mtbf">MTBF: {asset.lambda ? Math.round(meanTimeBetweenFailures(asset.lambda)).toLocaleString() : "—"} h</span><span className="mttr">MTTR: {asset.mttr} h</span><small>{asset.tag}</small></button>)}</div></aside>
      <div className={`workbench-canvas-wrap ${dragOver ? "drop-ready" : ""} ${panMode ? "pan-active" : ""}`} style={gridStyle} onPointerDown={startPan} onWheel={wheelZoom} onDragOver={event => { event.preventDefault(); setDragOver(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false); }} onDrop={drop}>
        <div className="workbench-canvas" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom / 100})`, transformOrigin: "top left" }}>
          <svg className="connections"><defs><marker id={`arrow-${mode}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7"/></marker></defs>{edges.map((edge, index) => <path data-export-edge="true" data-export-from={edge.from} data-export-to={edge.to} className={`diagram-edge ${selectedEdge === index ? "selected" : ""}`} key={`${edge.from}-${edge.to}-${index}`} d={edgePath(edge)} onPointerDown={event => { event.preventDefault(); event.stopPropagation(); setSelectedEdge(index); setSelected(0); }}/>) }{portDrag && <path className="connection-preview" d={`M${portDrag.start.x} ${portDrag.start.y} L${portDrag.current.x} ${portDrag.current.y}`}/>}</svg>
          {edges.map((edge, index) => selectedEdge === index ? <button key={`handle-${index}`} className="edge-handle" style={{ left: edgeHandle(edge).x, top: edgeHandle(edge).y }} onPointerDown={event => dragEdgeHandle(event, index)} title="Drag to adjust connector bend"/> : null)}
          {nodes.map(node => {
            const asset = node.assetId ? assets.find(item => item.id === node.assetId) : undefined;
            const gate = isGate(node);
            return <div data-export-node="true" data-export-id={node.id} data-export-type={node.type} key={node.id} className={`workbench-node ${gate ? "logic-gate-node" : "engineering-block"} ${node.type.replaceAll(" ", "-")} ${selected === node.id ? "selected" : ""}`} style={{ left: node.x, top: node.y }} onPointerDown={event => dragNode(event, node)} onClick={event => { event.stopPropagation(); setSelected(node.id); setSelectedEdge(null); }} onContextMenu={event => { if (mode === "fta" && gate) { event.preventDefault(); event.stopPropagation(); setGateMenu({ nodeId: node.id, x: event.clientX, y: event.clientY }); } }}>
              {blockPorts.map(side => <span key={side} className={`port ${side}`} data-port-node={node.id} data-port-side={side} onPointerDown={event => startPortDrag(event, node, side)} title="Drag to another connection point"/>)}
              {gate ? <><span className={`gate-shape ${node.type.replace("gate ", "")}`}><b>{gateLabel(node.type)}</b></span><small className="gate-caption">{gateLabel(node.type)}</small></> : <><strong className="part-number">{asset?.tag ?? node.title}</strong><div className="block-values"><span><b>λ</b>{(asset?.lambda ?? node.failureRate ?? 0).toExponential(2)} /h</span><span><b>MTBF</b>{asset?.lambda ? Math.round(meanTimeBetweenFailures(asset.lambda)).toLocaleString() : "—"} h</span><span><b>MTTR</b>{asset?.mttr ?? node.mttr ?? 0} h</span></div><small className="component-name">{asset?.description ?? node.subtitle}</small></>}
            </div>;
          })}
        </div>
        <footer className="workbench-status"><span>{nodes.filter(node => !isGate(node)).length} components</span><span>{edges.length} connections</span><span className="autosave-state">Saved locally</span><div className="zoom-control"><button onClick={() => setZoom(Math.max(MIN_CANVAS_ZOOM, zoom - 10))}>−</button><input type="range" min={MIN_CANVAS_ZOOM} max={MAX_CANVAS_ZOOM} step="10" value={zoom} onChange={event => setZoom(Number(event.target.value))}/><button onClick={() => setZoom(Math.min(MAX_CANVAS_ZOOM, zoom + 10))}>+</button><b>{zoom}%</b></div></footer>
      </div>
      {mode === "rbd" && <aside className="workbench-inspector rbd-inspector result-only-panel"><div className="inspector-heading"><strong>Result</strong><span>IEC 61078</span></div>{analysis ? <div className="system-result"><p className="result-summary">Overall result for the connected RBD flow</p><dl><div><dt>Failure rate (λ/h)</dt><dd>{analysis.failureRate.toExponential(4)}</dd></div><div><dt>MTBF</dt><dd>{Number.isFinite(analysis.mtbf) ? `${Math.round(analysis.mtbf).toLocaleString()} h` : "∞"}</dd></div><div><dt>MTTR</dt><dd>{analysis.mttr.toFixed(2)} h</dd></div><div className="availability-row"><dt>Availability</dt><dd>{(analysis.availability * 100).toFixed(6)}%</dd></div></dl></div> : <div className="inspector-empty"><Icons.play/><strong>No result yet</strong><p>Connect the blocks in the required flow and click Calculate.</p></div>}</aside>}
    </div>
    {pendingGate && <div className="gate-dialog-backdrop" role="dialog" aria-modal="true"><section className="gate-dialog"><span>FAULT-TREE CONNECTION</span><h2>Select logic gate</h2><p>The selected symbol will be inserted between the two component events.</p><div><button onClick={() => confirmGate("gate and")}>AND</button><button onClick={() => confirmGate("gate or")}>OR</button><button onClick={() => confirmGate("gate xor")}>XOR</button><button onClick={() => confirmGate("gate not")}>NOT</button></div><button className="gate-direct" onClick={() => confirmGate("direct")}>Direct / end-event connection</button><button className="gate-cancel" onClick={() => setPendingGate(null)}>Cancel</button></section></div>}
    {gateMenu && <div className="gate-change-menu" style={{ left: gateMenu.x, top: gateMenu.y }} onClick={event => event.stopPropagation()}><strong>Change gate</strong>{(["gate and", "gate or", "gate xor", "gate not"] as GateType[]).map(type => <button key={type} onClick={() => changeGate(gateMenu.nodeId, type)}><span className={`mini-gate ${type.replace("gate ", "")}`}/>{gateLabel(type)}</button>)}</div>}
  </section>;
}
