"use client";

import { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "@/lib/icons";
import { Asset, DiagramEdge, DiagramNode, DiagramState, REGISTER_UPDATED_EVENT, componentAvailability, componentAvailabilityPercent, readAssets, readDiagram, saveDiagram, starterAssets } from "@/lib/workspace";

type Mode = "rbd" | "fta";
type PortSide = "left" | "right" | "top" | "bottom";
type GateType = "gate and" | "gate or" | "gate xor" | "gate not";
const blankDiagram: DiagramState = { nodes: [], edges: [] };
const BLOCK_WIDTH = 196;
const BLOCK_HEIGHT = 108;
const GATE_WIDTH = 54;
const GATE_HEIGHT = 48;

export type DiagramReportRow = { reference: string; component: string; type: string; failureRate: string; mttr: string; availability: string };

export function createDiagramReportRows(mode: Mode, nodes: DiagramNode[], assets: Asset[] = starterAssets): DiagramReportRow[] {
  return nodes.filter(node => node.assetId).map(node => {
    const asset = assets.find(item => item.id === node.assetId);
    const lambda = asset?.lambda ?? node.failureRate ?? 0;
    const mttr = asset?.mttr ?? node.mttr ?? 0;
    return { reference: asset?.tag ?? node.title, component: asset?.description ?? node.subtitle, type: mode === "rbd" ? "Reliability block" : "Basic event", failureRate: lambda ? lambda.toExponential(3) : "0", mttr: mttr.toFixed(2), availability: `${(componentAvailability({ lambda, mttr }) * 100).toFixed(5)}%` };
  });
}

function isGate(node?: DiagramNode) { return Boolean(node?.type.startsWith("gate ")); }
function gateLabel(type: string) { return type.replace("gate ", "").toUpperCase(); }

export default function DiagramEditor({ mode, onReportChange }: { mode: Mode; onReportChange?: (rows: DiagramReportRow[]) => void }) {
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [edges, setEdges] = useState<DiagramEdge[]>([]);
  const [assets, setAssets] = useState<Asset[]>(starterAssets);
  const [selected, setSelected] = useState(0);
  const [lineStyle, setLineStyle] = useState<"straight" | "elbow">("straight");
  const [zoom, setZoom] = useState(100);
  const [analysis, setAnalysis] = useState("");
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [portDrag, setPortDrag] = useState<{ from: number; start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
  const [pendingGate, setPendingGate] = useState<{ from: number; to: number } | null>(null);
  const [gateMenu, setGateMenu] = useState<{ nodeId: number; x: number; y: number } | null>(null);
  const undoStack = useRef<DiagramState[]>([]);
  const redoStack = useRef<DiagramState[]>([]);
  const latest = useRef<DiagramState>(blankDiagram);

  useEffect(() => {
    const ftaEmptyVersion = "ramsport-fta-empty-v1";
    if (mode === "fta" && !window.localStorage.getItem(ftaEmptyVersion)) {
      window.localStorage.removeItem("ramsport-fta-diagram");
      window.localStorage.setItem(ftaEmptyVersion, "1");
    }
    const saved = readDiagram(mode, blankDiagram);
    latest.current = saved;
    setNodes(saved.nodes); setEdges(saved.edges); setSelected(saved.nodes[0]?.id || 0); setAssets(readAssets()); setHydrated(true);
    const refresh = (event: Event) => setAssets(Array.isArray((event as CustomEvent<Asset[]>).detail) ? (event as CustomEvent<Asset[]>).detail : readAssets());
    window.addEventListener(REGISTER_UPDATED_EVENT, refresh); window.addEventListener("storage", refresh);
    return () => { window.removeEventListener(REGISTER_UPDATED_EVENT, refresh); window.removeEventListener("storage", refresh); };
  }, [mode]);

  useEffect(() => {
    latest.current = { nodes, edges };
    if (hydrated) { saveDiagram(mode, { nodes, edges }); onReportChange?.(createDiagramReportRows(mode, nodes, assets)); }
  }, [nodes, edges, assets, hydrated, mode, onReportChange]);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
      if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      if (event.key === "Delete" && selected && !["INPUT", "SELECT", "TEXTAREA"].includes(tag)) removeSelected();
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  });

  const selectedNode = nodes.find(node => node.id === selected);
  const selectedAsset = selectedNode?.assetId ? assets.find(asset => asset.id === selectedNode.assetId) : undefined;
  const filteredAssets = assets.filter(asset => `${asset.tag} ${asset.description} ${asset.system}`.toLowerCase().includes(search.toLowerCase()));

  function remember() { undoStack.current.push(structuredClone(latest.current)); if (undoStack.current.length > 60) undoStack.current.shift(); redoStack.current = []; }
  function restore(state: DiagramState) { setNodes(state.nodes); setEdges(state.edges); setSelected(0); setAnalysis(""); }
  function undo() { const state = undoStack.current.pop(); if (!state) return; redoStack.current.push(structuredClone(latest.current)); restore(state); }
  function redo() { const state = redoStack.current.pop(); if (!state) return; undoStack.current.push(structuredClone(latest.current)); restore(state); }

  function nodeSize(node: DiagramNode) { return isGate(node) ? { width: GATE_WIDTH, height: GATE_HEIGHT } : { width: BLOCK_WIDTH, height: BLOCK_HEIGHT }; }
  function evaluateFtaNode(id: number, visiting: Set<number>): number {
    if (visiting.has(id)) return 0;
    const node = nodes.find(item => item.id === id); if (!node) return 0;
    const inputs = edges.filter(edge => edge.to === id).map(edge => evaluateFtaNode(edge.from, new Set(visiting).add(id)));
    if (!inputs.length) { const asset = node.assetId ? assets.find(item => item.id === node.assetId) : undefined; return Math.min(1, (asset?.lambda ?? node.failureRate ?? 0) * (asset?.mission ?? node.mission ?? 1)); }
    if (node.type === "gate and") return inputs.reduce((result, value) => result * value, 1);
    if (node.type === "gate xor") return inputs.reduce((total, value, index) => total + value * inputs.reduce((other, candidate, otherIndex) => other * (otherIndex === index ? 1 : 1 - candidate), 1), 0);
    if (node.type === "gate not") return 1 - inputs[0];
    return 1 - inputs.reduce((result, value) => result * (1 - value), 1);
  }

  const analysisValue = useMemo(() => {
    const components = nodes.filter(node => node.assetId);
    if (!components.length) return mode === "rbd" ? "Add components before calculating availability." : "Add component events before calculating the fault tree.";
    if (mode === "rbd") return `System availability: ${(components.reduce((value, node) => { const asset = assets.find(item => item.id === node.assetId); return value * componentAvailability({ lambda: asset?.lambda ?? 0, mttr: asset?.mttr ?? 0 }); }, 1) * 100).toFixed(5)}%`;
    const top = nodes.find(node => !edges.some(edge => edge.from === node.id)) || nodes.at(-1);
    return top ? `Top-event probability: ${evaluateFtaNode(top.id, new Set()).toExponential(3)}` : "Connect component events to calculate the result.";
  }, [mode, nodes, edges, assets]);

  function nextPosition() { const index = nodes.filter(node => !isGate(node)).length; return { x: 75 + index % 4 * 245, y: 90 + Math.floor(index / 4) * 165 }; }
  function addAsset(asset: Asset, position = nextPosition()) { remember(); const id = Math.max(0, ...nodes.map(node => node.id)) + 1; setNodes(current => [...current, { id, ...position, type: mode === "rbd" ? "block" : "event basic", title: asset.tag, subtitle: asset.description, assetId: asset.id }]); setSelected(id); }
  function drop(event: ReactDragEvent<HTMLDivElement>) { event.preventDefault(); setDragOver(false); try { const { id } = JSON.parse(event.dataTransfer.getData("application/x-ramsport")) as { id?: string }; const asset = assets.find(item => item.id === id); const rect = event.currentTarget.getBoundingClientRect(); if (asset) addAsset(asset, { x: Math.max(12, (event.clientX - rect.left) * 100 / zoom - BLOCK_WIDTH / 2), y: Math.max(12, (event.clientY - rect.top) * 100 / zoom - BLOCK_HEIGHT / 2) }); } catch { /* ignore external drops */ } }

  function dragNode(event: ReactPointerEvent, node: DiagramNode) {
    if ((event.target as HTMLElement).closest(".port")) return;
    event.preventDefault(); remember(); setSelected(node.id); setGateMenu(null);
    const start = { x: event.clientX, y: event.clientY, nodeX: node.x, nodeY: node.y };
    const move = (pointer: PointerEvent) => setNodes(current => current.map(item => item.id === node.id ? { ...item, x: Math.max(12, start.nodeX + (pointer.clientX - start.x) * 100 / zoom), y: Math.max(12, start.nodeY + (pointer.clientY - start.y) * 100 / zoom) } : item));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function portPoint(node: DiagramNode, side: PortSide) { const size = nodeSize(node); if (side === "left") return { x: node.x, y: node.y + size.height / 2 }; if (side === "right") return { x: node.x + size.width, y: node.y + size.height / 2 }; if (side === "top") return { x: node.x + size.width / 2, y: node.y }; return { x: node.x + size.width / 2, y: node.y + size.height }; }
  function startPortDrag(event: ReactPointerEvent, node: DiagramNode, side: PortSide) {
    event.preventDefault(); event.stopPropagation(); setSelected(node.id);
    const rect = (event.currentTarget.closest(".workbench-canvas-wrap") as HTMLElement)?.getBoundingClientRect();
    const point = (x: number, y: number) => ({ x: (x - (rect?.left || 0)) * 100 / zoom, y: (y - (rect?.top || 0)) * 100 / zoom });
    setPortDrag({ from: node.id, start: portPoint(node, side), current: point(event.clientX, event.clientY) });
    const move = (pointer: PointerEvent) => setPortDrag(current => current ? { ...current, current: point(pointer.clientX, pointer.clientY) } : null);
    const up = (pointer: PointerEvent) => { const target = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest<HTMLElement>("[data-port-node]"); const to = Number(target?.dataset.portNode); if (to && to !== node.id) connect(node.id, to); setPortDrag(null); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function addEdge(from: number, to: number) { remember(); setEdges(current => current.some(edge => edge.from === from && edge.to === to) ? current : [...current, { from, to, style: mode === "fta" ? "straight" : lineStyle }]); }
  function connect(from: number, to: number) { const source = nodes.find(node => node.id === from), target = nodes.find(node => node.id === to); if (!source || !target) return; if (mode === "rbd" || isGate(source) || isGate(target)) addEdge(from, to); else setPendingGate({ from, to }); }
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
  function removeSelected() { if (!selected) return; remember(); setNodes(current => current.filter(node => node.id !== selected)); setEdges(current => current.filter(edge => edge.from !== selected && edge.to !== selected)); setSelected(0); }

  function edgePath(edge: DiagramEdge) {
    const from = nodes.find(node => node.id === edge.from), to = nodes.find(node => node.id === edge.to); if (!from || !to) return "";
    if (mode === "fta") { const start = portPoint(from, "top"), end = portPoint(to, "bottom"); if (Math.abs(start.x - end.x) < 8) return `M${start.x} ${start.y} L${end.x} ${end.y}`; const middleY = (start.y + end.y) / 2; return `M${start.x} ${start.y} V${middleY} H${end.x} V${end.y}`; }
    const fromSize = nodeSize(from), toSize = nodeSize(to), fromCenter = { x: from.x + fromSize.width / 2, y: from.y + fromSize.height / 2 }, toCenter = { x: to.x + toSize.width / 2, y: to.y + toSize.height / 2 };
    const forward = toCenter.x >= fromCenter.x, start = { x: from.x + (forward ? fromSize.width : 0), y: fromCenter.y }, end = { x: to.x + (forward ? 0 : toSize.width), y: toCenter.y };
    if (edge.style === "straight") return `M${start.x} ${start.y} L${end.x} ${end.y}`;
    const middleX = (start.x + end.x) / 2; return `M${start.x} ${start.y} H${middleX} V${end.y} H${end.x}`;
  }

  const blockPorts: PortSide[] = mode === "rbd" ? ["left", "right"] : ["top", "bottom"];
  return <section className={`workbench ${mode}-workbench`} onClick={() => setGateMenu(null)}>
    <header className="workbench-toolbar">
      {mode === "rbd" && <><button className={`wb-action straight ${lineStyle === "straight" ? "active" : ""}`} onClick={() => setLineStyle("straight")}><Icons.line/>Straight</button><button className={`wb-action elbow ${lineStyle === "elbow" ? "active" : ""}`} onClick={() => setLineStyle("elbow")}><Icons.elbow/>Elbow</button></>}
      <button className="wb-action history-action" onClick={undo} title="Undo (Ctrl+Z)"><Icons.undo/>Undo</button><button className="wb-action history-action" onClick={redo} title="Redo (Ctrl+Y)"><Icons.redo/>Redo</button><span className="wb-separator"/>
      <button className="wb-action run" onClick={() => setAnalysis(analysisValue)}><Icons.play/>Calculate</button><button className="wb-action clear" onClick={() => { if (!nodes.length || window.confirm("Clear the complete diagram?")) { remember(); setNodes([]); setEdges([]); setSelected(0); setAnalysis(""); } }}>Clear</button><button className="wb-action reset" onClick={() => { setZoom(100); setSelected(0); setAnalysis(""); }}>Reset view</button>
      <span className="wb-hint">Drag between connection dots. {mode === "fta" ? "Routing adjusts automatically." : "Choose the connection style before drawing."}</span>
    </header>
    <div className="workbench-body">
      <aside className="component-library"><div className="library-heading"><strong>Components</strong><button onClick={() => setAssets(readAssets())} title="Refresh from Data Register">↻</button></div><label className="library-search"><Icons.search/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find component"/></label><div className="library-scroll">{filteredAssets.map(asset => <button className="library-card" key={asset.id} draggable onDragStart={event => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-ramsport", JSON.stringify({ id: asset.id })); }} onClick={() => addAsset(asset)}><strong>{asset.description}</strong><span className="lambda">λ: {asset.lambda.toExponential(2)} /h</span><span className="mtbf">MTBF: {asset.lambda ? Math.round(1 / asset.lambda).toLocaleString() : "—"} h</span><span className="mttr">MTTR: {asset.mttr} h</span><small>{asset.tag}</small></button>)}</div></aside>
      <div className={`workbench-canvas-wrap ${dragOver ? "drop-ready" : ""}`} onDragOver={event => { event.preventDefault(); setDragOver(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(false); }} onDrop={drop}>
        <div className="workbench-canvas" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
          <svg className="connections"><defs><marker id={`arrow-${mode}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7"/></marker></defs>{edges.map((edge, index) => <path key={`${edge.from}-${edge.to}-${index}`} d={edgePath(edge)} markerEnd={`url(#arrow-${mode})`}/>)}{portDrag && <path className="connection-preview" d={`M${portDrag.start.x} ${portDrag.start.y} L${portDrag.current.x} ${portDrag.current.y}`}/>}</svg>
          {nodes.map(node => {
            const asset = node.assetId ? assets.find(item => item.id === node.assetId) : undefined;
            const gate = isGate(node);
            return <div key={node.id} className={`workbench-node ${gate ? "logic-gate-node" : "engineering-block"} ${node.type.replaceAll(" ", "-")} ${selected === node.id ? "selected" : ""}`} style={{ left: node.x, top: node.y }} onPointerDown={event => dragNode(event, node)} onClick={event => { event.stopPropagation(); setSelected(node.id); }} onContextMenu={event => { if (mode === "fta" && gate) { event.preventDefault(); event.stopPropagation(); setGateMenu({ nodeId: node.id, x: event.clientX, y: event.clientY }); } }}>
              {blockPorts.map(side => <span key={side} className={`port ${side}`} data-port-node={node.id} onPointerDown={event => startPortDrag(event, node, side)} title="Drag to another connection point"/>)}
              {gate ? <><span className={`gate-shape ${node.type.replace("gate ", "")}`}><b>{gateLabel(node.type)}</b></span><small className="gate-caption">{gateLabel(node.type)}</small></> : <><strong className="part-number">{asset?.tag ?? node.title}</strong><div className="block-values"><span><b>λ</b>{(asset?.lambda ?? node.failureRate ?? 0).toExponential(2)} /h</span><span><b>MTBF</b>{asset?.lambda ? Math.round(1 / asset.lambda).toLocaleString() : "—"} h</span><span><b>MTTR</b>{asset?.mttr ?? node.mttr ?? 0} h</span></div><small className="component-name">{asset?.description ?? node.subtitle}</small></>}
            </div>;
          })}
        </div>
        <footer className="workbench-status"><span>{nodes.filter(node => !isGate(node)).length} components</span><span>{edges.length} connections</span><span className="autosave-state">Saved locally</span><div className="zoom-control"><button onClick={() => setZoom(Math.max(60, zoom - 10))}>−</button><input type="range" min="60" max="130" value={zoom} onChange={event => setZoom(Number(event.target.value))}/><button onClick={() => setZoom(Math.min(130, zoom + 10))}>+</button><b>{zoom}%</b></div></footer>
      </div>
      {mode === "rbd" && <aside className="workbench-inspector"><div className="inspector-heading"><strong>Properties</strong><span>RBD</span></div>{selectedNode && !isGate(selectedNode) ? <><div className="inspector-selection"><span>COMPONENT</span><strong>{selectedAsset?.tag ?? selectedNode.title}</strong><small>{selectedAsset?.description ?? selectedNode.subtitle}</small></div><label>Failure rate (λ/h)<input value={selectedAsset?.lambda ?? selectedNode.failureRate ?? 0} readOnly/></label><label>MTBF (hours)<input value={selectedAsset?.lambda ? Math.round(1 / selectedAsset.lambda) : 0} readOnly/></label><label>MTTR (hours)<input value={selectedAsset?.mttr ?? selectedNode.mttr ?? 0} readOnly/></label><div className="inspector-result"><span>COMPONENT AVAILABILITY</span><strong>{componentAvailabilityPercent({ lambda: selectedAsset?.lambda ?? selectedNode.failureRate ?? 0, mttr: selectedAsset?.mttr ?? selectedNode.mttr ?? 0 })}</strong></div><button className="delete-object" onClick={removeSelected}>Delete component</button></> : <div className="inspector-empty"><Icons.pointer/><strong>No component selected</strong><p>Select a block to view its engineering values.</p></div>}{analysis && <div className="analysis-result"><span>CALCULATION RESULT</span><strong>{analysis}</strong></div>}</aside>}
    </div>
    {analysis && mode === "fta" && <div className="fta-result"><span>CALCULATION RESULT</span><strong>{analysis}</strong></div>}
    {pendingGate && <div className="gate-dialog-backdrop" role="dialog" aria-modal="true"><section className="gate-dialog"><span>FAULT-TREE CONNECTION</span><h2>Select logic gate</h2><p>The selected symbol will be inserted between the two component events.</p><div><button onClick={() => confirmGate("gate and")}>AND</button><button onClick={() => confirmGate("gate or")}>OR</button><button onClick={() => confirmGate("gate xor")}>XOR</button><button onClick={() => confirmGate("gate not")}>NOT</button></div><button className="gate-direct" onClick={() => confirmGate("direct")}>Direct / end-event connection</button><button className="gate-cancel" onClick={() => setPendingGate(null)}>Cancel</button></section></div>}
    {gateMenu && <div className="gate-change-menu" style={{ left: gateMenu.x, top: gateMenu.y }} onClick={event => event.stopPropagation()}><strong>Change gate</strong>{(["gate and", "gate or", "gate xor", "gate not"] as GateType[]).map(type => <button key={type} onClick={() => changeGate(gateMenu.nodeId, type)}><span className={`mini-gate ${type.replace("gate ", "")}`}/>{gateLabel(type)}</button>)}</div>}
  </section>;
}
