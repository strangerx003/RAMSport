export type RbdComponent = { id: number; x: number; availability: number; failureRate?: number; mttr?: number };
export type RbdLink = { from: number; to: number };

export type RbdAnalysis = {
  availability: number;
  unavailability: number;
  configuration: "Single block" | "Series" | "Parallel / mixed" | "Open";
  paths: number;
  exact: boolean;
  note: string;
  failureRate: number;
  mtbf: number;
  mttr: number;
};

function equivalentMetrics(components: RbdComponent[], availability: number) {
  const weightedRepair = components.reduce((total, component) => total + (1 - component.availability) * (component.mttr ?? 0), 0);
  const unavailableWeight = components.reduce((total, component) => total + (1 - component.availability), 0);
  const mttr = unavailableWeight > 0 ? weightedRepair / unavailableWeight : components.reduce((total, component) => total + (component.mttr ?? 0), 0) / Math.max(1, components.length);
  const failureRate = availability > 0 && mttr > 0 ? (1 - availability) / (availability * mttr) : components.reduce((total, component) => total + (component.failureRate ?? 0), 0);
  return { failureRate, mtbf: failureRate > 0 ? 1 / failureRate : Number.POSITIVE_INFINITY, mttr };
}

function adjacency(components: RbdComponent[], links: RbdLink[]) {
  const graph = new Map<number, number[]>(components.map(component => [component.id, []]));
  for (const link of links) {
    if (!graph.has(link.from) || !graph.has(link.to) || link.from === link.to) continue;
    graph.get(link.from)!.push(link.to);
    graph.get(link.to)!.push(link.from);
  }
  return graph;
}

function hasPath(graph: Map<number, number[]>, start: number, end: number, working?: Set<number>) {
  if (working && (!working.has(start) || !working.has(end))) return false;
  const visited = new Set<number>([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === end) return true;
    for (const next of graph.get(current) ?? []) {
      if (!visited.has(next) && (!working || working.has(next))) { visited.add(next); queue.push(next); }
    }
  }
  return false;
}

function countPaths(graph: Map<number, number[]>, start: number, end: number, limit = 100) {
  let count = 0;
  const walk = (current: number, visited: Set<number>) => {
    if (count >= limit) return;
    if (current === end) { count += 1; return; }
    for (const next of graph.get(current) ?? []) if (!visited.has(next)) walk(next, new Set(visited).add(next));
  };
  walk(start, new Set([start]));
  return count;
}

export function analyzeRbd(components: RbdComponent[], links: RbdLink[]): RbdAnalysis {
  if (!components.length) return { availability: 0, unavailability: 1, configuration: "Open", paths: 0, exact: true, note: "No reliability blocks are present.", failureRate: 0, mtbf: 0, mttr: 0 };
  if (components.length === 1) {
    const availability = components[0].availability;
    return { availability, unavailability: 1 - availability, configuration: "Single block", paths: 1, exact: true, note: "System result equals the selected component availability.", ...equivalentMetrics(components, availability) };
  }

  const ordered = [...components].sort((a, b) => a.x - b.x);
  const start = ordered[0].id;
  const end = ordered.at(-1)!.id;
  const graph = adjacency(components, links);
  if (!hasPath(graph, start, end)) return { availability: 0, unavailability: 1, configuration: "Open", paths: 0, exact: true, note: "No complete path exists between the left-most and right-most blocks.", failureRate: 0, mtbf: 0, mttr: 0 };

  const paths = countPaths(graph, start, end);
  const series = paths === 1 && components.every(component => (graph.get(component.id)?.length ?? 0) <= 2);
  const configuration = series ? "Series" : "Parallel / mixed";
  const size = components.length;
  let availability = 0;
  let exact = size <= 20;

  if (exact) {
    const states = 2 ** size;
    for (let mask = 0; mask < states; mask += 1) {
      let probability = 1;
      const working = new Set<number>();
      for (let index = 0; index < size; index += 1) {
        const up = Boolean(mask & (1 << index));
        const component = components[index];
        probability *= up ? component.availability : 1 - component.availability;
        if (up) working.add(component.id);
      }
      if (probability && hasPath(graph, start, end, working)) availability += probability;
    }
  } else {
    // Large diagrams use a deterministic high-sample estimate to keep the editor responsive.
    let seed = 61078;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const samples = 100000;
    let successes = 0;
    for (let sample = 0; sample < samples; sample += 1) {
      const working = new Set(components.filter(component => random() <= component.availability).map(component => component.id));
      if (hasPath(graph, start, end, working)) successes += 1;
    }
    availability = successes / samples;
  }

  availability = Math.max(0, Math.min(1, availability));
  return {
    availability,
    unavailability: 1 - availability,
    configuration,
    paths,
    exact,
    note: exact ? `Calculated from the drawn connectivity across ${paths} successful path${paths === 1 ? "" : "s"}.` : "Estimated from 100,000 deterministic trials because the model contains more than 20 blocks.",
    ...equivalentMetrics(components, availability),
  };
}
