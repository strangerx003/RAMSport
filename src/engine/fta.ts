export type FtaGateType = "gate and" | "gate or" | "gate xor" | "gate not";

export function basicEventProbability(lambda: number, missionTime: number) {
  const rate = Math.max(0, lambda);
  const time = Math.max(0, missionTime);
  return Math.max(0, Math.min(1, 1 - Math.exp(-rate * time)));
}

export function evaluateGate(type: FtaGateType | string, inputs: number[]) {
  const probabilities = inputs.map(value => Math.max(0, Math.min(1, value)));
  if (!probabilities.length) return 0;
  if (type === "gate and") return probabilities.reduce((result, value) => result * value, 1);
  if (type === "gate xor") {
    return probabilities.reduce((total, value, index) => total + value * probabilities.reduce((other, candidate, otherIndex) => other * (index === otherIndex ? 1 : 1 - candidate), 1), 0);
  }
  if (type === "gate not") return 1 - probabilities[0];
  return 1 - probabilities.reduce((result, value) => result * (1 - value), 1);
}

export function gateFormula(type?: FtaGateType | string) {
  if (!type) return "Q(t) = 1 - e^(-lambda t)";
  if (type === "gate and") return "AND: Q = product(Qi)";
  if (type === "gate xor") return "XOR: Q = sum[Qi product(1 - Qj)]";
  if (type === "gate not") return "NOT: Q = 1 - Q1";
  return "OR: Q = 1 - product(1 - Qi)";
}
