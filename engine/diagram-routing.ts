import type { DiagramEdge, DiagramNode } from "../lib/workspace";

export type PortSide = "left" | "right" | "top" | "bottom";

const BLOCK_WIDTH = 196;
const BLOCK_HEIGHT = 108;
const GATE_WIDTH = 54;
const GATE_HEIGHT = 48;

function nodeSize(node: DiagramNode) {
  return node.type.startsWith("gate ") ? { width: GATE_WIDTH, height: GATE_HEIGHT } : { width: BLOCK_WIDTH, height: BLOCK_HEIGHT };
}

export function lockedPortPoint(node: DiagramNode, side: PortSide) {
  const size = nodeSize(node);
  if (side === "left") return { x: node.x, y: node.y + size.height / 2 };
  if (side === "right") return { x: node.x + size.width, y: node.y + size.height / 2 };
  if (side === "top") return { x: node.x + size.width / 2, y: node.y };
  return { x: node.x + size.width / 2, y: node.y + size.height };
}

export function resolveRbdConnectionSides(from: DiagramNode, to: DiagramNode): { fromSide: PortSide; toSide: PortSide } {
  const fromSize = nodeSize(from), toSize = nodeSize(to);
  const dx = (to.x + toSize.width / 2) - (from.x + fromSize.width / 2);
  const dy = (to.y + toSize.height / 2) - (from.y + fromSize.height / 2);
  if (Math.abs(dx) >= Math.abs(dy) * .75) return dx >= 0 ? { fromSide: "right", toSide: "left" } : { fromSide: "left", toSide: "right" };
  return { fromSide: "right", toSide: "right" };
}

/** Assigns missing ports once. Existing ports are never recalculated from block position. */
export function lockRbdConnectionPorts(nodes: DiagramNode[], edges: DiagramEdge[]): DiagramEdge[] {
  return edges.map(edge => {
    if (edge.fromSide && edge.toSide) return edge;
    const from = nodes.find(node => node.id === edge.from), to = nodes.find(node => node.id === edge.to);
    if (!from || !to) return edge;
    const automatic = resolveRbdConnectionSides(from, to);
    return { ...edge, fromSide: edge.fromSide ?? automatic.fromSide, toSide: edge.toSide ?? automatic.toSide };
  });
}

type Point = { x: number; y: number };
type Rectangle = { left: number; right: number; top: number; bottom: number };
type Direction = "h" | "v" | "start";
const ROUTE_CLEARANCE = 14;

function outsidePort(point: Point, side: PortSide): Point {
  if (side === "left") return { x: point.x - ROUTE_CLEARANCE, y: point.y };
  if (side === "right") return { x: point.x + ROUTE_CLEARANCE, y: point.y };
  if (side === "top") return { x: point.x, y: point.y - ROUTE_CLEARANCE };
  return { x: point.x, y: point.y + ROUTE_CLEARANCE };
}

function obstacle(node: DiagramNode): Rectangle {
  const size = nodeSize(node), margin = 8;
  return { left: node.x - margin, right: node.x + size.width + margin, top: node.y - margin, bottom: node.y + size.height + margin };
}

function inside(point: Point, rectangle: Rectangle) {
  return point.x > rectangle.left && point.x < rectangle.right && point.y > rectangle.top && point.y < rectangle.bottom;
}

function segmentClear(first: Point, second: Point, obstacles: Rectangle[]) {
  if (first.x !== second.x && first.y !== second.y) return false;
  return obstacles.every(rectangle => {
    if (first.y === second.y) {
      if (first.y <= rectangle.top || first.y >= rectangle.bottom) return true;
      return Math.max(Math.min(first.x, second.x), rectangle.left) >= Math.min(Math.max(first.x, second.x), rectangle.right);
    }
    if (first.x <= rectangle.left || first.x >= rectangle.right) return true;
    return Math.max(Math.min(first.y, second.y), rectangle.top) >= Math.min(Math.max(first.y, second.y), rectangle.bottom);
  });
}

function simplify(points: Point[]) {
  const unique = points.filter((point, index) => !index || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  return unique.filter((point, index) => {
    if (!index || index === unique.length - 1) return true;
    const before = unique[index - 1], after = unique[index + 1];
    return !((before.x === point.x && point.x === after.x) || (before.y === point.y && point.y === after.y));
  });
}

function orthogonalRoute(start: Point, end: Point, obstacles: Rectangle[], waypoint?: Point): Point[] {
  if (waypoint && !obstacles.some(rectangle => inside(waypoint, rectangle))) {
    const first = orthogonalRoute(start, waypoint, obstacles);
    const second = orthogonalRoute(waypoint, end, obstacles);
    return simplify([...first, ...second.slice(1)]);
  }
  const padding = 26;
  const xs = new Set<number>([start.x, end.x, ...obstacles.flatMap(item => [item.left, item.right])]);
  const ys = new Set<number>([start.y, end.y, ...obstacles.flatMap(item => [item.top, item.bottom])]);
  if (obstacles.length) {
    xs.add(Math.min(...obstacles.map(item => item.left)) - padding); xs.add(Math.max(...obstacles.map(item => item.right)) + padding);
    ys.add(Math.min(...obstacles.map(item => item.top)) - padding); ys.add(Math.max(...obstacles.map(item => item.bottom)) + padding);
  }
  const points: Point[] = [];
  for (const x of xs) for (const y of ys) { const point = { x, y }; if (!obstacles.some(rectangle => inside(point, rectangle))) points.push(point); }
  const indexByPoint = new Map(points.map((point, index) => [`${point.x}:${point.y}`, index]));
  const startIndex = indexByPoint.get(`${start.x}:${start.y}`), endIndex = indexByPoint.get(`${end.x}:${end.y}`);
  if (startIndex === undefined || endIndex === undefined) return [start, end];
  const neighbours = new Map<number, { index: number; direction: Exclude<Direction, "start">; distance: number }[]>();
  const addLink = (a: number, b: number, direction: Exclude<Direction, "start">) => {
    if (!segmentClear(points[a], points[b], obstacles)) return;
    const distance = Math.abs(points[a].x - points[b].x) + Math.abs(points[a].y - points[b].y);
    neighbours.set(a, [...(neighbours.get(a) ?? []), { index: b, direction, distance }]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), { index: a, direction, distance }]);
  };
  for (const y of ys) {
    const row = points.map((point, index) => ({ point, index })).filter(item => item.point.y === y).sort((a, b) => a.point.x - b.point.x);
    for (let index = 1; index < row.length; index += 1) addLink(row[index - 1].index, row[index].index, "h");
  }
  for (const x of xs) {
    const column = points.map((point, index) => ({ point, index })).filter(item => item.point.x === x).sort((a, b) => a.point.y - b.point.y);
    for (let index = 1; index < column.length; index += 1) addLink(column[index - 1].index, column[index].index, "v");
  }
  type State = { point: number; direction: Direction; cost: number; previous?: string };
  const queue: State[] = [{ point: startIndex, direction: "start", cost: 0 }], best = new Map<string, State>();
  best.set(`${startIndex}:start`, queue[0]);
  let final: State | undefined;
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!, currentKey = `${current.point}:${current.direction}`;
    if (best.get(currentKey)?.cost !== current.cost) continue;
    if (current.point === endIndex) { final = current; break; }
    for (const next of neighbours.get(current.point) ?? []) {
      const cost = current.cost + next.distance + (current.direction !== "start" && current.direction !== next.direction ? 24 : 0);
      const key = `${next.index}:${next.direction}`;
      if (cost >= (best.get(key)?.cost ?? Infinity)) continue;
      const state = { point: next.index, direction: next.direction, cost, previous: currentKey };
      best.set(key, state); queue.push(state);
    }
  }
  if (!final) return [start, end];
  const route: Point[] = [];
  let current: State | undefined = final;
  while (current) { route.push(points[current.point]); current = current.previous ? best.get(current.previous) : undefined; }
  return simplify(route.reverse());
}

export function routeRbdConnection(nodes: DiagramNode[], edge: DiagramEdge) {
  const from = nodes.find(node => node.id === edge.from), to = nodes.find(node => node.id === edge.to);
  if (!from || !to) return { path: "", points: [] as Point[] };
  const automatic = resolveRbdConnectionSides(from, to);
  const fromSide = edge.fromSide ?? automatic.fromSide, toSide = edge.toSide ?? automatic.toSide;
  const start = lockedPortPoint(from, fromSide), end = lockedPortPoint(to, toSide);
  const startOutside = outsidePort(start, fromSide), endOutside = outsidePort(end, toSide);
  const obstacles = nodes.map(obstacle);
  const middle = orthogonalRoute(startOutside, endOutside, obstacles, edge.waypoint);
  const points = simplify([start, startOutside, ...middle.slice(1, -1), endOutside, end]);
  return { path: points.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" "), points };
}
