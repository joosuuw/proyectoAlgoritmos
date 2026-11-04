import type { Cost, GrowthKind } from "./types";

function superscript(value: number): string {
  const map: Record<string, string> = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
  };
  return String(value)
    .split("")
    .map((digit) => map[digit] ?? digit)
    .join("");
}

function variableLabel(name: string, exponent: number): string {
  if (exponent <= 0) return "";
  if (exponent === 1) return name;
  return `${name}${superscript(exponent)}`;
}

function buildLabel(n: number, m: number, k: number, logN: number): string {
  const parts: string[] = [];
  const poly = variableLabel("n", n) + variableLabel("m", m) + variableLabel("k", k);
  const polyParts = [
    variableLabel("n", n),
    variableLabel("m", m),
    variableLabel("k", k),
  ].filter(Boolean);

  if (polyParts.length > 0) {
    parts.push(polyParts.join("·"));
  }

  if (logN > 0) {
    const logPart =
      logN === 1 ? "log n" : `log${superscript(logN)} n`;
    if (poly.length > 0) parts.push(logPart);
    else parts.push(logPart);
  }

  if (parts.length === 0) return "O(1)";
  if (polyParts.length > 0 && logN > 0) return `O(${parts.join(" ")})`;
  return `O(${parts.join("·")})`;
}

function kindFrom(n: number, m: number, k: number, logN: number): GrowthKind {
  const degree = n + m + k;
  if (degree === 0) return logN > 0 ? "log" : "1";
  if (degree >= 3) return "n3";
  if (degree === 2) return "n2";
  return logN > 0 ? "nlog" : "n";
}

export function cost(n: number, m: number, k: number, logN: number): Cost {
  const rank = 20 * (n + m + k) + 10 * logN;
  return {
    n,
    m,
    k,
    logN,
    label: buildLabel(n, m, k, logN),
    rank,
    kind: kindFrom(n, m, k, logN),
  };
}

export const ONE: Cost = cost(0, 0, 0, 0);
export const LOG: Cost = cost(0, 0, 0, 1);
export const LINEAR: Cost = cost(1, 0, 0, 0);
export const LINEAR_M: Cost = cost(0, 1, 0, 0);
export const LINEAR_K: Cost = cost(0, 0, 1, 0);
export const LINEARITHMIC: Cost = cost(1, 0, 0, 1);
export const QUADRATIC: Cost = cost(2, 0, 0, 0);
export const CUBIC: Cost = cost(3, 0, 0, 0);
export const N_TIMES_M: Cost = cost(1, 1, 0, 0);

export function customCost(
  label: string,
  rank: number,
  kind: GrowthKind = "n",
): Cost {
  return { n: 0, m: 0, k: 0, logN: 0, label, rank, kind };
}

export const EXPONENTIAL = customCost("O(2ⁿ)", 90, "2n");
export const FACTORIAL = customCost("O(n!)", 100, "nf");
export const V_PLUS_E = customCost("O(V + E)", 26, "n");
export const E_LOG_E = customCost("O(E log E)", 34, "nlog");
export const E_LOG_V = customCost("O(E log V)", 34, "nlog");
export const V_TIMES_E = customCost("O(V·E)", 44, "n2");
export const V_SQUARED = customCost("O(V²)", 44, "n2");
export const V_CUBED = customCost("O(V³)", 64, "n3");
export const ALPHA = customCost("O(α(n)) amortizado", 12, "1");

export function multiplyCost(a: Cost, b: Cost): Cost {
  if (a.kind === "custom" || b.kind === "custom") {
    return a.rank >= b.rank ? a : b;
  }
  return cost(a.n + b.n, a.m + b.m, a.k + b.k, a.logN + b.logN);
}

export function maxCost(a: Cost, b: Cost): Cost {
  if (a.rank === b.rank) {
    return a.n + a.m + a.k + a.logN >= b.n + b.m + b.k + b.logN ? a : b;
  }
  return a.rank > b.rank ? a : b;
}

export function combineMax(costs: Cost[]): Cost {
  return costs.reduce((best, current) => maxCost(best, current), ONE);
}

/** Multiplica un costo por un factor de iteración expresado como Cost. */
export function loopCost(factor: Cost, body: Cost): Cost {
  return multiplyCost(factor, body);
}

export function isConstant(value: Cost): boolean {
  return value.n === 0 && value.m === 0 && value.k === 0 && value.logN === 0;
}

/** Valor aproximado para la gráfica comparativa. */
export function growthValue(kind: GrowthKind, size: number): number {
  const n = Math.max(size, 1);
  switch (kind) {
    case "1":
      return 1;
    case "log":
      return Math.log2(n + 1);
    case "n":
      return n;
    case "nlog":
      return n * Math.log2(n + 1);
    case "n2":
      return n * n;
    case "n3":
      return n * n * n;
    case "2n":
      return Math.pow(2, Math.min(n, 60));
    case "nf": {
      let result = 1;
      for (let i = 2; i <= Math.min(n, 15); i += 1) result *= i;
      return result;
    }
    default:
      return n;
  }
}

export function formatComplexity(value: Cost): string {
  return value.label;
}
