import type {
  Cost,
  FunctionFacts,
  PyCall,
  PyExprInfo,
  PyFunction,
  PyStmt,
} from "./types";
import {
  CUBIC,
  EXPONENTIAL,
  FACTORIAL,
  LINEAR,
  LINEARITHMIC,
  LINEAR_M,
  LOG,
  ONE,
  combineMax,
  loopCost,
  maxCost,
  multiplyCost,
} from "./cost";

export interface EstimateContext {
  facts: FunctionFacts;
  symbols: Map<string, Cost>;
  selfName: string;
  memoized: boolean;
}

export interface Estimate {
  time: Cost;
  space: Cost;
  work: Cost;
  dimensions: number;
  usesTable: boolean;
}

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if ("([{".includes(char)) depth += 1;
    if (")]}".includes(char)) depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function isNumeric(text: string): boolean {
  return /^[0-9_]+$/.test(text.trim());
}

export function buildSymbols(fn: PyFunction): Map<string, Cost> {
  const symbols = new Map<string, Cost>();
  const order = [LINEAR, LINEAR_M, costK()];
  let index = 0;

  for (const param of fn.params) {
    const lower = param.toLowerCase();
    if (lower === "self" || lower === "cls") continue;
    symbols.set(lower, order[Math.min(index, order.length - 1)]);
    index += 1;
  }

  // Alias derivados de asignaciones como `V = len(graph)`.
  for (const assignment of fn.assignments) {
    const target = assignment.target
      .replace(/[[(].*$/, "")
      .trim()
      .toLowerCase();
    const value = assignment.value.toLowerCase();
    if (!target) continue;
    const lenMatch = /^len\(\s*([a-z_][a-z0-9_]*)/.exec(value);
    if (lenMatch) {
      const source = lenMatch[1];
      const symbol = symbols.get(source);
      if (symbol) symbols.set(target, symbol);
      continue;
    }
    if (/^len\(.*\[.*\]\)/.test(value)) {
      symbols.set(target, LINEAR_M);
    }
  }

  if (!symbols.has("n")) symbols.set("n", LINEAR);
  return symbols;
}

function costK(): Cost {
  return { n: 0, m: 0, k: 1, logN: 0, label: "O(k)", rank: 20, kind: "n" };
}

function symbolFor(expr: string, ctx: EstimateContext): Cost {
  const identifiers = expr.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  for (const identifier of identifiers) {
    const symbol = ctx.symbols.get(identifier.toLowerCase());
    if (symbol) return symbol;
  }

  if (/\b(log|lg)\b/.test(expr)) return LOG;
  if (/\b(V|vertices|nodos|nodes|n|N|size|length|count|num)\b/.test(expr)) {
    return LINEAR;
  }
  if (/\b(E|edges|aristas|m|M)\b/.test(expr)) return LINEAR_M;
  if (/^[0-9_+\-*/%()\s]+$/.test(expr)) return ONE;
  return LINEAR;
}

export function iterationCost(iterable: string, ctx: EstimateContext): Cost {
  const text = iterable.trim();
  const lower = text.toLowerCase();

  if (/^range\s*\(/.test(lower)) {
    const open = text.indexOf("(");
    const close = text.lastIndexOf(")");
    const args = splitTopLevel(text.slice(open + 1, close));
    if (args.length === 0) return ONE;
    if (args.length === 1) {
      if (args[0].includes("<<")) return EXPONENTIAL;
      if (isNumeric(args[0])) return ONE;
      return symbolFor(args[0], ctx);
    }
    const start = args[0];
    const stop = args[1];
    if (isNumeric(start) && isNumeric(stop)) {
      const span = Number(stop) - Number(start);
      return span <= 64 ? ONE : LINEAR;
    }
    const stopCost = symbolFor(stop, ctx);
    if (stopCost.rank > 0) return stopCost;
    return symbolFor(start, ctx);
  }

  if (/permutations|product\s*\(/.test(lower)) return FACTORIAL;
  if (/combinations/.test(lower)) return EXPONENTIAL;
  if (/sorted\s*\(|\.sort\s*\(/.test(lower)) return LINEARITHMIC;
  if (/bin\s*\(|str\s*\(\s*n\s*\)|digits/.test(lower)) return LOG;
  if (/graph\s*\[|adj\s*\[|g\s*\[|neighbors|adyacencia|vecinos/.test(lower)) {
    return LINEAR;
  }
  if (/\bedges\b|\baristas\b/.test(lower) && ctx.facts.hasAdjacency) {
    return LINEAR_M;
  }
  if (/\.items\s*\(|\.keys\s*\(|\.values\s*\(/.test(lower)) return LINEAR;
  if (/enumerate\s*\(|zip\s*\(|reversed\s*\(|list\s*\(|iter\s*\(/.test(lower)) {
    return LINEAR;
  }
  if (/set\s*\(|dict\s*\(|counter\s*\(/.test(lower)) return LINEAR;
  if (/\[.*\bfor\b/.test(lower)) {
    let factor: Cost = ONE;
    const matches = lower.matchAll(/\bfor\s+\w+\s+in\s+([^\]]+?)(?=\s+for\b|\s+if\b|\])/g);
    for (const match of matches) {
      factor = multiplyCost(factor, iterationCost(match[1], ctx));
    }
    return factor;
  }
  if (isNumeric(text)) return ONE;

  return LINEAR;
}

export function whileFactor(stmt: PyStmt, ctx: EstimateContext): Cost {
  const bodyText = stmt.body.map((statement) => statement.text).join(" ");
  const test = (stmt.test ?? "").toLowerCase();

  if (
    /\/\/\s*=\s*2|\/\/\s*2|\/\s*=\s*2|\/\s*2|>>\s*=\s*1|>>\s*1|<<\s*=\s*1|<<\s*1|\*\s*=\s*2|\*\s*2/.test(
      bodyText.toLowerCase(),
    )
  ) {
    return LOG;
  }

  if (
    (/lo\s*<=?\s*hi|low\s*<=?\s*high|left\s*<=?\s*right|l\s*<=?\s*r|inicio\s*<=?\s*fin/.test(
      test,
    ) ||
      /mid|medio/.test(bodyText.toLowerCase())) &&
    /mid|medio/.test(bodyText.toLowerCase())
  ) {
    return LOG;
  }

  if (
    /while\s+n\b|while\s+n\s*>|while\s+n\s*!=/.test(test) &&
    /n\s*-=\s*1|n\s*=\s*n\s*-\s*1/.test(bodyText.toLowerCase())
  ) {
    return LINEAR;
  }

  if (
    /queue|cola|stack|pila|heap|frontera|fringe|q\b/.test(test) &&
    !/len\s*\(/.test(test)
  ) {
    return LINEAR;
  }

  if (
    /<\s*len\s*\(|< [a-z_]\w*\b/.test(test) &&
    (/\+\s*=\s*1|i\s*=\s*i\s*\+\s*1|j\s*\+\+|i\s*\+=|\+\+/.test(
      bodyText.toLowerCase(),
    ))
  ) {
    return LINEAR;
  }

  if (/\btrue\b/.test(test) && ctx.facts.hasBacktracking) {
    return LINEAR;
  }

  return LINEAR;
}

const HALF_WORDS = /\b(mid|medio|half|mitad)\b/;

export function callCost(call: PyCall, ctx: EstimateContext): Cost {
  const name = call.name.toLowerCase();
  const full = call.full.toLowerCase();

  if (name === ctx.selfName.toLowerCase()) return ONE;
  if (full === `self.${ctx.selfName.toLowerCase()}`) return ONE;

  if (name === "len" || name === "abs" || name === "id" || name === "hash") {
    return ONE;
  }
  if (name === "sorted" || name === "sort") return LINEARITHMIC;
  if (name === "min" || name === "max") {
    // max(a, b) compara dos valores; max(coleccion) recorre la colección.
    if (call.args.length >= 2) return ONE;
    const arg = call.args[0]?.trim() ?? "";
    if (!arg) return ONE;
    if (arg.includes("[")) return ONE;
    return LINEAR;
  }
  if (name === "sum" || name === "any" || name === "all") {
    return LINEAR;
  }
  if (
    name === "set" ||
    name === "list" ||
    name === "tuple" ||
    name === "dict" ||
    name === "frozenset" ||
    name === "counter" ||
    name === "defaultdict" ||
    name === "deque" ||
    name === "join" ||
    name === "copy"
  ) {
    return LINEAR;
  }
  if (name === "bisect" || name === "bisect_left" || name === "bisect_right") {
    return LOG;
  }
  if (name === "heappush" || name === "heappop" || name === "heappushpop" || name === "heapreplace") {
    return LOG;
  }
  if (name === "heapify" || name === "nlargest" || name === "nsmallest") {
    return LINEAR;
  }
  if (name === "append" || name === "appendleft" || name === "add" || name === "push") {
    return ONE;
  }
  if (name === "popleft") return ONE;
  if (name === "pop") {
    return call.args[0] === "0" ? LINEAR : ONE;
  }
  if (name === "find" || name === "union" || name === "buscar" || name === "unir") {
    return ONE;
  }
  if (name === "permutations") return FACTORIAL;
  if (name === "combinations" || name === "product") return EXPONENTIAL;
  if (name === "range" || name === "enumerate" || name === "zip" || name === "reversed") {
    return ONE;
  }
  if (name === "memorize" || name === "lru_cache" || name === "cache") return ONE;
  if (name === "open" || name === "print" || name === "input") return ONE;

  if (HALF_WORDS.test(full)) return LOG;

  return ONE;
}

export function callSpace(call: PyCall): Cost {
  const name = call.name.toLowerCase();
  if (name === "sorted" || name === "sort") return LINEAR;
  if (
    name === "set" ||
    name === "list" ||
    name === "tuple" ||
    name === "dict" ||
    name === "frozenset" ||
    name === "counter" ||
    name === "defaultdict" ||
    name === "deque" ||
    name === "copy" ||
    name === "join"
  ) {
    return LINEAR;
  }
  if (name === "heapify" || name === "nlargest" || name === "nsmallest") {
    return LINEAR;
  }
  return ONE;
}

export function exprCost(expr: PyExprInfo, ctx: EstimateContext): Cost {
  let result: Cost = ONE;

  for (const call of expr.calls) {
    result = maxCost(result, callCost(call, ctx));
  }

  // Pertenencia: `x in lista` recorre la lista, `x in set/dict` es O(1) promedio.
  const membership = expr.text.match(/\bin\s+([A-Za-z_][A-Za-z0-9_]*)/g) ?? [];
  for (const match of membership) {
    const name = match.replace(/^in\s+/, "").toLowerCase();
    const type = ctx.facts.variableTypes.get(name);
    if (type === "list" || type === "matrix" || type === "string" || type === "tuple") {
      result = maxCost(result, LINEAR);
    }
  }

  for (const comprehension of expr.comprehensions) {
    let factor: Cost = ONE;
    for (const loop of comprehension.loops) {
      factor = multiplyCost(factor, iterationCost(loop.iterable, ctx));
    }
    result = maxCost(result, factor);
  }

  return result;
}

export function exprSpace(expr: PyExprInfo, ctx: EstimateContext): Cost {
  let result: Cost = ONE;

  for (const call of expr.calls) {
    result = maxCost(result, callSpace(call));
  }

  for (const comprehension of expr.comprehensions) {
    let factor: Cost = ONE;
    for (const loop of comprehension.loops) {
      factor = multiplyCost(factor, iterationCost(loop.iterable, ctx));
    }
    result = maxCost(result, factor);
  }

  return result;
}

export function assignmentSpace(statement: PyStmt, ctx: EstimateContext): Cost {
  const value = (statement.value ?? "").trim();
  const lower = value.toLowerCase();
  if (!value) return exprSpace(statement.expr, ctx);

  const hasComprehension = value.includes(" for ");
  const nestedLists = (lower.match(/\[/g) ?? []).length;

  if (value.startsWith("[") && hasComprehension) {
    let factor: Cost = ONE;
    for (const comprehension of statement.expr.comprehensions) {
      for (const loop of comprehension.loops) {
        factor = multiplyCost(factor, iterationCost(loop.iterable, ctx));
      }
    }

    // `[[0] * m for _ in range(n)]` reserva n·m; `[[] for ...]` solo n listas.
    const allocatesInnerValues = /^\[\s*\[[^\]]/.test(value);
    if (allocatesInnerValues) {
      const inner = value.match(/\]\s*\*\s*([^\]\s]+)/)?.[1];
      const innerCost = inner ? symbolFor(inner, ctx) : LINEAR;
      if (innerCost.rank > 0) factor = maxCost(factor, multiplyCost(iterationCostFirst(statement, ctx), innerCost));
    }
    return factor.rank > 0 ? factor : LINEAR;
  }

  if (value.startsWith("[[")) return multiplyCost(LINEAR, LINEAR);
  if (value.startsWith("[")) {
    // Lista plana de n elementos o matriz creada con `[fila] * m`.
    if (/\]\s*\*/.test(lower)) return LINEAR;
    return nestedLists >= 2 ? multiplyCost(LINEAR, LINEAR) : LINEAR;
  }
  if (value.startsWith("{")) {
    return hasComprehension ? LINEAR : ONE;
  }

  const space = exprSpace(statement.expr, ctx);
  if (space.rank > 0) return space;

  if (
    /^(set|dict|list|tuple|deque|counter|defaultdict|sorted)\s*\(/.test(lower)
  ) {
    return LINEAR;
  }

  return ONE;
}

function iterationCostFirst(statement: PyStmt, ctx: EstimateContext): Cost {
  let factor: Cost = ONE;
  for (const comprehension of statement.expr.comprehensions) {
    for (const loop of comprehension.loops) {
      factor = multiplyCost(factor, iterationCost(loop.iterable, ctx));
    }
    break;
  }
  return factor.rank > 0 ? factor : LINEAR;
}

export function dpDimensions(fn: PyFunction): number {
  let dimensions = 0;

  for (const assignment of fn.assignments) {
    const target = assignment.target.toLowerCase();
    if (!/^(dp|tabla|table|memo|cache)/.test(target)) continue;
    const value = assignment.value;
    const lower = value.toLowerCase();
    if (lower.includes("memo") || lower.includes("cache")) {
      dimensions = Math.max(dimensions, 1);
      continue;
    }
    const openBrackets = (lower.match(/\[/g) ?? []).length;
    const rangeCount = (lower.match(/range\s*\(/g) ?? []).length;
    const estimated = Math.max(
      rangeCount,
      openBrackets >= 3 ? 3 : openBrackets >= 2 ? 2 : 1,
    );
    dimensions = Math.max(dimensions, estimated);
  }

  for (const subscript of fn.subscripts) {
    const base = subscript.base.toLowerCase();
    if (!/^(dp|tabla|table|memo|cache)/.test(base)) continue;
    const depth = (subscript.index.match(/,/g) ?? []).length + 1;
    const baseDepth = (subscript.base.match(/\[/g) ?? []).length;
    dimensions = Math.max(dimensions, depth + baseDepth);
  }

  return dimensions;
}

export function blockCost(statements: PyStmt[], ctx: EstimateContext): Cost {
  let result: Cost = ONE;

  for (const statement of statements) {
    result = maxCost(result, statementCost(statement, ctx));
  }

  return result;
}

export function statementCost(statement: PyStmt, ctx: EstimateContext): Cost {
  switch (statement.kind) {
    case "for": {
      const factor = iterationCost(statement.iter ?? "", ctx);
      const body = blockCost(statement.body, ctx);
      const loop = loopCost(factor, body);
      const elseCost = combineMax(
        statement.branches.map((branch) => blockCost(branch.body, ctx)),
      );
      return maxCost(loop, elseCost);
    }
    case "while": {
      const factor = whileFactor(statement, ctx);
      const body = blockCost(statement.body, ctx);
      return maxCost(loopCost(factor, body), combineMax(
        statement.branches.map((branch) => blockCost(branch.body, ctx)),
      ));
    }
    case "if": {
      return maxCost(
        exprCost(statement.expr, ctx),
        combineMax(statement.branches.map((branch) => blockCost(branch.body, ctx))),
      );
    }
    case "try":
    case "with":
    case "match": {
      return maxCost(
        blockCost(statement.body, ctx),
        combineMax(
          statement.branches.map((branch) => blockCost(branch.body, ctx)),
        ),
      );
    }
    case "assign":
    case "augassign": {
      const base = exprCost(statement.expr, ctx);
      const value = (statement.value ?? "").trim();
      const target = (statement.target ?? "").trim();
      if (value.startsWith("[") || value.startsWith("{")) {
        return maxCost(base, assignmentSpace(statement, ctx));
      }
      // `res = res + [x]` copia la lista completa en cada iteración.
      if (
        target &&
        value.includes("[") &&
        value.includes("+") &&
        value.includes(target)
      ) {
        return maxCost(base, LINEAR);
      }
      return base;
    }
    case "return":
    case "call":
    case "expr":
    case "yield":
      return exprCost(statement.expr, ctx);
    case "def":
      return ONE;
    default:
      return ONE;
  }
}

export function blockSpace(statements: PyStmt[], ctx: EstimateContext): Cost {
  let result: Cost = ONE;

  for (const statement of statements) {
    let current = ONE;
    if (statement.kind === "assign" || statement.kind === "augassign") {
      current = assignmentSpace(statement, ctx);
    } else if (statement.kind === "call" || statement.kind === "expr") {
      current = exprSpace(statement.expr, ctx);
    }

    if (statement.kind === "for" || statement.kind === "while") {
      current = maxCost(current, blockSpace(statement.body, ctx));
    } else if (
      statement.kind === "if" ||
      statement.kind === "try" ||
      statement.kind === "with" ||
      statement.kind === "match"
    ) {
      current = maxCost(current, blockSpace(statement.body, ctx));
      for (const branch of statement.branches) {
        current = maxCost(current, blockSpace(branch.body, ctx));
      }
    } else if (statement.kind === "def") {
      current = maxCost(current, blockSpace(statement.body, ctx));
    }

    result = maxCost(result, current);
  }

  return result;
}

function collectionBase(target: string): string {
  return target.replace(/[[(].*$/, "").trim().toLowerCase();
}

/**
 * Detecta colecciones que empiezan vacías y crecen por subíndice dentro de un
 * bucle (`conteo[letra] = ...`). Esas estructuras ocupan O(n) aunque `{}` sea
 * O(1) al inicializarse.
 */
function growsCollection(fn: PyFunction): boolean {
  const emptyTargets = new Set<string>();

  for (const assignment of fn.assignments) {
    const value = assignment.value.trim().toLowerCase();
    if (
      value === "{}" ||
      value === "[]" ||
      value === "set()" ||
      value === "dict()" ||
      value === "list()"
    ) {
      emptyTargets.add(collectionBase(assignment.target));
    }
  }

  if (emptyTargets.size === 0) return false;

  return fn.assignments.some((assignment) => {
    const target = assignment.target.trim();
    return (
      emptyTargets.has(collectionBase(target)) && /[[{]/.test(target)
    );
  });
}

export function buildContext(fn: PyFunction, facts: FunctionFacts): EstimateContext {
  return {
    facts,
    symbols: buildSymbols(fn),
    selfName: fn.name,
    memoized: facts.hasMemoDecorator || facts.hasMemoTable,
  };
}

export function estimateGeneric(fn: PyFunction, facts: FunctionFacts): Estimate {
  const ctx = buildContext(fn, facts);

  const dimensions = dpDimensions(fn);
  const bodyTime = blockCost(fn.body, ctx);
  let time = bodyTime;
  let space = blockSpace(fn.body, ctx);

  if (dimensions >= 2) {
    time = maxCost(time, dimensions === 2 ? multiplyCost(LINEAR, LINEAR) : CUBIC);
    space = maxCost(space, dimensions === 2 ? multiplyCost(LINEAR, LINEAR) : CUBIC);
  } else if (dimensions === 1) {
    time = maxCost(time, LINEAR);
    space = maxCost(space, LINEAR);
  }

  if (facts.hasRecursion) {
    space = maxCost(space, LINEAR);
  }

  if (space.rank < LINEAR.rank && growsCollection(fn)) {
    space = LINEAR;
  }

  return {
    time,
    space,
    work: bodyTime,
    dimensions,
    usesTable: dimensions > 0,
  };
}
