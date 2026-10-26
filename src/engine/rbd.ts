import { componentAvailability } from "@/engine/reliability";

export type RbdComponent = { id: number; x: number; availability: number; failureRate?: number; mttr?: number };
export type RbdLink = { from: number; to: number };

export type RbdAnalysis = {
  availability: number;
  unavailability: number;
  configuration: "Single block" | "Series" | "K-out-of-N" | "Open";
  paths: number;
  exact: boolean;
  note: string;
  formula: string;
  koon?: { k: number; n: number };
  failureRate: number;
  mtbf: number;
  mttr: number;
};

type EquivalentMetrics = { availability: number; failureRate: number; mtbf: number; mttr: number };

function positive(value: number | undefined) { return Number.isFinite(value) && Number(value) > 0 ? Number(value) : 0; }
function factorial(value: number) { let result = 1; for (let number = 2; number <= value; number += 1) result *= number; return result; }

/** λs = Σλi; MTTRs = Σ(λi × MTTRi) / λs. */
export function seriesEquivalentMetrics(components: RbdComponent[]): EquivalentMetrics {
  const failureRate = components.reduce((total, component) => total + positive(component.failureRate), 0);
  const weightedRepair = components.reduce((total, component) => total + positive(component.failureRate) * Math.max(0, component.mttr ?? 0), 0);
  const mttr = failureRate > 0 ? weightedRepair / failureRate : components.reduce((total, component) => total + Math.max(0, component.mttr ?? 0), 0) / Math.max(1, components.length);
  const mtbf = failureRate > 0 ? 1 / failureRate : Number.POSITIVE_INFINITY;
  const availability = componentAvailability({ lambda: failureRate, mttr });
  return { availability, failureRate, mtbf, mttr };
}

/**
 * Attached-sheet r-out-of-n equations, using T = 1/μ:
 * λs = n! / ((r−1)!(n−r+1)!) × λi^(n−r+1) × Ti^(n−r)
 * MTTRs = 1 / ((n−r+1)μ).
 * Heterogeneous channels use geometric-mean λ and mean repair rate so 1oo2
 * preserves the λ1×λ2 term while retaining one KooN equivalent block.
 */
export function kOutOfNEquivalentMetrics(channels: RbdComponent[], k: number): EquivalentMetrics {
  const n = channels.length;
  const required = Math.max(1, Math.min(Math.trunc(k), n));
  const exponent = n - required + 1;
  const rates = channels.map(channel => positive(channel.failureRate)).filter(rate => rate > 0);
  const lambdaI = rates.length === n ? Math.exp(rates.reduce((sum, rate) => sum + Math.log(rate), 0) / n) : 0;
  const repairRates = channels.map(channel => positive(channel.mttr) > 0 ? 1 / positive(channel.mttr) : 0).filter(rate => rate > 0);
  const mu = repairRates.length ? repairRates.reduce((sum, rate) => sum + rate, 0) / repairRates.length : 0;
  const repairTime = mu > 0 ? 1 / mu : 0;
  const coefficient = factorial(n) / (factorial(required - 1) * factorial(n - required + 1));
  const failureRate = lambdaI > 0 ? coefficient * lambdaI ** exponent * repairTime ** (exponent - 1) : 0;
  const mttr = mu > 0 ? 1 / (exponent * mu) : 0;
  const mtbf = failureRate > 0 ? 1 / failureRate : Number.POSITIVE_INFINITY;
  const availability = componentAvailability({ lambda: failureRate, mttr });
  return { availability, failureRate, mtbf, mttr };
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

function listPaths(graph: Map<number, number[]>, start: number, end: number, limit = 100) {
  const paths: number[][] = [];
  const walk = (current: number, path: number[], visited: Set<number>) => {
    if (paths.length >= limit) return;
    if (current === end) { paths.push(path); return; }
    for (const next of graph.get(current) ?? []) if (!visited.has(next)) walk(next, [...path, next], new Set(visited).add(next));
  };
  walk(start, [start], new Set([start]));
  return paths;
}

function openResult(note: string): RbdAnalysis {
  return { availability: 0, unavailability: 1, configuration: "Open", paths: 0, exact: true, note, formula: "No formula applied", failureRate: 0, mtbf: 0, mttr: 0 };
}

export function analyzeRbd(components: RbdComponent[], links: RbdLink[]): RbdAnalysis {
  if (!components.length) return openResult("No reliability blocks are present.");
  if (components.length === 1) {
    const component = components[0];
    const failureRate = positive(component.failureRate), mttr = Math.max(0, component.mttr ?? 0);
    const metrics = { availability: componentAvailability({ lambda: failureRate, mttr }), failureRate, mtbf: failureRate > 0 ? 1 / failureRate : Number.POSITIVE_INFINITY, mttr };
    return { ...metrics, unavailability: 1 - metrics.availability, configuration: "Single block", paths: 1, exact: true, note: "System result equals the selected component values.", formula: "MTBF = 1 / λ" };
  }

  const ordered = [...components].sort((first, second) => first.x - second.x);
  const start = ordered[0].id, end = ordered.at(-1)!.id;
  const graph = adjacency(components, links);
  const paths = listPaths(graph, start, end);
  if (!paths.length) return openResult("No complete path exists between the left-most and right-most blocks.");

  if (paths.length === 1) {
    const metrics = seriesEquivalentMetrics(components);
    return { ...metrics, unavailability: 1 - metrics.availability, configuration: "Series", paths: 1, exact: true, note: "Applied the series equations from the approved formula sheet.", formula: "λs = Σλi; MTTRs = Σ(λi × MTTRi) / λs; MTBFs = 1 / λs" };
  }

  // Shared blocks occur in series with the redundant branch set. Each remaining
  // complete branch is reduced to a series-equivalent channel before 1ooN.
  const commonIds = paths.reduce((common, path) => new Set([...common].filter(id => path.includes(id))), new Set(paths[0]));
  const componentById = new Map(components.map(component => [component.id, component]));
  const branchKeys = [...new Set(paths.map(path => path.filter(id => !commonIds.has(id)).sort((a, b) => a - b).join(",")).filter(Boolean))];
  const branchChannels = branchKeys.map((key, index) => {
    const branch = key.split(",").map(Number).map(id => componentById.get(id)).filter((component): component is RbdComponent => Boolean(component));
    const metrics = seriesEquivalentMetrics(branch);
    return { id: -(index + 1), x: index, ...metrics };
  });
  if (branchChannels.length < 2) return openResult("The redundant branches could not be resolved into independent K-out-of-N channels.");

  const k = 1, n = branchChannels.length;
  const koon = kOutOfNEquivalentMetrics(branchChannels, k);
  const common = [...commonIds].map(id => componentById.get(id)).filter((component): component is RbdComponent => Boolean(component));
  const combined = common.length ? seriesEquivalentMetrics([...common, { id: -1000, x: 0, ...koon }]) : koon;
  return {
    ...combined,
    unavailability: 1 - combined.availability,
    configuration: "K-out-of-N",
    koon: { k, n },
    paths: n,
    exact: true,
    note: `Applied ${k}oo${n} using the K-out-of-N equation from the approved formula sheet${common.length ? ", with shared blocks combined in series" : ""}.`,
    formula: "λs = n! / ((r−1)!(n−r+1)!) × λi^(n−r+1) × Ti^(n−r); MTTRs = 1 / ((n−r+1)μ)",
  };
}
