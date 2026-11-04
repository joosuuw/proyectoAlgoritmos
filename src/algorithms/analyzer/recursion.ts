import type {
  Cost,
  FunctionFacts,
  MasterTheorem,
  PyFunction,
  PyStmt,
  RecurrenceInfo,
  RecurrenceTreeLevel,
} from "./types";
import {
  CUBIC,
  EXPONENTIAL,
  FACTORIAL,
  LINEAR,
  LINEARITHMIC,
  LOG,
  ONE,
  QUADRATIC,
  customCost,
  maxCost,
  multiplyCost,
} from "./cost";
import type { Estimate } from "./estimate";

export interface RecursionResult {
  time: Cost;
  space: Cost;
  recurrence?: RecurrenceInfo;
  tail: boolean;
  halving: boolean;
  branching: boolean;
  depth: Cost;
}

function powerCost(exponent: number): Cost {
  if (Math.abs(exponent - 1) < 0.001) return LINEAR;
  if (Math.abs(exponent - 2) < 0.001) return QUADRATIC;
  if (Math.abs(exponent - 3) < 0.001) return CUBIC;
  if (Math.abs(exponent) < 0.001) return ONE;
  return customCost(
    `O(n^${exponent.toFixed(3)})`,
    20 * Math.max(1, Math.round(exponent)),
    exponent >= 2 ? "n2" : "n",
  );
}

function withLog(base: Cost): Cost {
  if (base.rank === ONE.rank) return LOG;
  if (Math.abs(base.n - 1) < 0.001 && base.m === 0 && base.k === 0) {
    return LINEARITHMIC;
  }
  if (Math.abs(base.n - 2) < 0.001) {
    return { n: 2, m: 0, k: 0, logN: 1, label: "O(n² log n)", rank: 50, kind: "n2" };
  }
  return base;
}

function exponentOf(cost: Cost): number {
  return cost.n + cost.m + cost.k > 0 ? cost.n + cost.m + cost.k : 0;
}

function costFromExponent(exponent: number): Cost {
  return powerCost(exponent);
}

export function masterTheorem(a: number, b: number, f: Cost): MasterTheorem {
  const exponent = Math.log(a) / Math.log(b);
  const d = exponentOf(f);
  const tolerance = 1e-9;

  if (Math.abs(d - exponent) < tolerance) {
    return {
      case: 2,
      exponent,
      result: withLog(costFromExponent(d)).label,
      explanation: `log_${b}(${a}) = ${exponent.toFixed(2)} y f(n) = n^${d}, así que estamos en el caso 2: Θ(n^${d} log n).`,
    };
  }

  if (d < exponent) {
    return {
      case: 1,
      exponent,
      result: costFromExponent(exponent).label,
      explanation: `log_${b}(${a}) = ${exponent.toFixed(2)} > ${d}, así que el costo lo dominan las hojas (caso 1): Θ(n^${exponent.toFixed(2)}).`,
    };
  }

  return {
    case: 3,
    exponent,
    result: f.label,
    explanation: `log_${b}(${a}) = ${exponent.toFixed(2)} < ${d}, así que el costo lo domina la combinación (caso 3): Θ(${f.label.slice(2, -1)}).`,
  };
}

function levelWork(a: number, b: number, level: number, f: Cost): string {
  const nodes = Math.pow(a, level);
  if (level === 0) return "1";
  if (exponentOf(f) === 0) return String(nodes);
  if (a === b) return "n";
  return `${nodes}·n/${Math.pow(b, level)}`;
}

function buildLevels(a: number, b: number, f: Cost): RecurrenceTreeLevel[] {
  const levels: RecurrenceTreeLevel[] = [];
  const totalNodes = (level: number) => Math.pow(a, level);
  const workPerNode = (level: number) => {
    if (exponentOf(f) === 0) return "1";
    if (level === 0) return f.label.slice(2, -1);
    return `n/${Math.pow(b, level)}`;
  };

  for (let level = 0; level < 4; level += 1) {
    levels.push({
      level,
      nodes: level === 0 ? "1" : String(totalNodes(level)),
      work: workPerNode(level),
      total: levelWork(a, b, level, f),
    });
  }

  return levels;
}

function findLoopCalls(
  statements: PyStmt[],
  name: string,
  insideLoop = false,
): { call: PyStmt; inLoop: boolean }[] {
  const result: { call: PyStmt; inLoop: boolean }[] = [];
  for (const statement of statements) {
    if (statement.kind === "for" || statement.kind === "while") {
      result.push(...findLoopCalls(statement.body, name, true));
      continue;
    }
    if (
      statement.kind === "call" ||
      statement.kind === "expr" ||
      statement.kind === "assign" ||
      statement.kind === "return" ||
      statement.kind === "if" ||
      statement.kind === "augassign"
    ) {
      if (statement.calls.some((call) => call.name === name)) {
        result.push({ call: statement, inLoop: insideLoop });
      }
    }
    result.push(...findLoopCalls(statement.body, name, insideLoop));
    for (const branch of statement.branches) {
      result.push(...findLoopCalls(branch.body, name, insideLoop));
    }
  }
  return result;
}

function isTailCall(fn: PyFunction, name: string): boolean {
  const last = fn.body[fn.body.length - 1];
  if (!last || last.kind !== "return") return false;
  const value = (last.value ?? "").replace(/\s+/g, "");
  const expected = name.replace(/\s+/g, "");
  return (
    value === `${expected}()` ||
    new RegExp(`^${expected}\\(.*\\)$`).test(value) ||
    new RegExp(`^self\\.${expected}\\(.*\\)$`).test(value)
  );
}

function fibShape(halving: boolean, args: string[]): boolean {
  if (halving) return false;
  const hasMinusOne = args.some((arg) => /-\s*1\b/.test(arg));
  const hasMinusTwo = args.some((arg) => /-\s*2\b/.test(arg));
  return hasMinusOne && hasMinusTwo;
}

export function analyzeRecursion(
  fn: PyFunction,
  facts: FunctionFacts,
  estimate: Estimate,
): RecursionResult | null {
  if (!facts.hasRecursion) return null;

  const calls = facts.selfCalls;
  const a = Math.max(1, Math.min(calls.length, 16));
  const allArgs = calls.flatMap((call) => call.args).join(" ");
  const lowerArgs = allArgs.toLowerCase();
  const halving =
    /\/\/\s*2|\/\s*2|>>\s*1|mid|medio/.test(lowerArgs) ||
    calls.some((call) => call.args.some((arg) => /\bmid\b|\bmedio\b/.test(arg)));
  const tail = isTailCall(fn, fn.name);
  const loopCalls = findLoopCalls(fn.body, fn.name);
  const branching = loopCalls.some((entry) => entry.inLoop) || facts.hasBacktracking;
  const memoized = facts.hasMemoDecorator || facts.hasMemoTable;
  const fibonacci = fibShape(halving, calls.flatMap((call) => call.args));
  const parameterCount = fn.params.filter(
    (param) => !["self", "cls"].includes(param.toLowerCase()),
  ).length;
  // Si no hay tabla explícita, los estados se deducen de los argumentos recursivos.
  const dimensions = Math.max(
    1,
    estimate.dimensions,
    facts.hasMemoTable ? 1 : Math.min(parameterCount, 3),
  );

  if (memoized) {
    const states =
      dimensions >= 2
        ? multiplyCost(LINEAR, LINEAR)
        : LINEAR;
    const work = maxCost(estimate.work, ONE);
    const time = maxCost(states, multiplyCost(states, work));
    const space = maxCost(states, LINEAR);
    return {
      time,
      space,
      tail,
      halving,
      branching,
      depth: LINEAR,
      recurrence: {
        equation: `T(n) = ${time.label} con memoización (${dimensions} ${
          dimensions === 1 ? "estado" : "dimensiones"
        })`,
        a: 1,
        b: 2,
        fLabel: estimate.work.label,
        method: "Memoización",
        levels: [
          { level: 0, nodes: "1", work: "estado", total: "1" },
          { level: 1, nodes: "n", work: "O(1)", total: "n" },
          { level: 2, nodes: "n", work: "O(1)", total: "n" },
          { level: 3, nodes: "n", work: "O(1)", total: "n" },
        ],
        height: "n estados",
        leaves: "n",
        spaceNote:
          "La tabla/memo guarda cada estado una sola vez y evita recalcular.",
      },
    };
  }

  if (branching && !halving) {
    const permutations =
      /permut|used|visited|path|camino/.test(facts.lowerSource) ||
      (facts.callNames.has("permutations") && facts.loopCount > 0);
    const time = permutations
      ? multiplyCost(FACTORIAL, LINEAR)
      : EXPONENTIAL;
    const space = LINEAR;
    return {
      time,
      space,
      tail,
      halving,
      branching,
      depth: LINEAR,
      recurrence: {
        equation: permutations
          ? "T(n) = n·T(n-1) + O(n) (permutaciones)"
          : "T(n) = 2·T(n-1) + O(1) (ramificación)",
        a: permutations ? 1 : 2,
        b: 1,
        fLabel: permutations ? LINEAR.label : ONE.label,
        method: "Expansión",
        levels: buildLevels(permutations ? 1 : 2, 1, permutations ? LINEAR : ONE),
        height: "n",
        leaves: permutations ? "n!" : "2ⁿ",
        spaceNote:
          "La profundidad de la recursión es n; el estado mutable (tablero, camino o conjunto usado) añade O(n) por nivel.",
      },
    };
  }

  if (halving) {
    const f = estimate.work;
    const master = masterTheorem(a, 2, f);
    const result = costFromExponent(master.exponent);
    const time =
      master.case === 1
        ? result
        : master.case === 2
          ? withLog(costFromExponent(exponentOf(f)))
          : f;
    const exponent = master.exponent;
    const leaves =
      Math.abs(exponent - 1) < 0.001
        ? "n"
        : Math.abs(exponent - 2) < 0.001
          ? "n²"
          : `n^${exponent.toFixed(3)}`;

    return {
      time,
      space: LOG,
      tail,
      halving,
      branching,
      depth: LOG,
      recurrence: {
        equation: `T(n) = ${a === 1 ? "" : `${a}·`}T(n/2) + ${f.label}`,
        a,
        b: 2,
        fLabel: f.label,
        method: "Teorema Maestro",
        master,
        levels: buildLevels(a, 2, f),
        height: "log₂ n",
        leaves,
        spaceNote:
          "Cada llamada divide el problema a la mitad: la pila de recursión mide O(log n).",
      },
    };
  }

  // Recursión lineal: T(n) = a·T(n-1) + f(n).
  if (a >= 2) {
    const fibonacciLayout = fibonacci;
    const time =
      exponentOf(estimate.work) > 0
        ? multiplyCost(estimate.work, EXPONENTIAL)
        : EXPONENTIAL;
    return {
      time,
      space: LINEAR,
      tail,
      halving,
      branching,
      depth: LINEAR,
      recurrence: {
        equation: fibonacciLayout
          ? "T(n) = T(n-1) + T(n-2) + O(1)"
          : `T(n) = ${a}·T(n-1) + ${estimate.work.label}`,
        a,
        b: 1,
        fLabel: estimate.work.label,
        method: "Expansión",
        levels: buildLevels(a, 1, estimate.work),
        height: "n",
        leaves: fibonacciLayout ? "2ⁿ" : `${a}ⁿ`,
        spaceNote:
          "La profundidad es n, por lo que la pila consume O(n) aunque el árbol de llamadas sea exponencial.",
      },
    };
  }

  const f = estimate.work;
  const time =
    exponentOf(f) > 0 ? multiplyCost(f, LINEAR) : LINEAR;
  return {
    time,
    space: LINEAR,
    tail,
    halving,
    branching,
    depth: LINEAR,
    recurrence: {
      equation: `T(n) = T(n-1) + ${f.label}`,
      a: 1,
      b: 1,
      fLabel: f.label,
      method: "Expansión",
      levels: buildLevels(1, 1, f),
      height: "n",
      leaves: "1",
      spaceNote:
        "La recursión avanza una unidad por llamada; en Python no hay optimización de cola, así que la pila es O(n).",
    },
  };
}
