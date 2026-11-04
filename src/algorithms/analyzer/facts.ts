import type { FunctionFacts, PyFunction, PyModule } from "./types";

function normalizeTarget(value: string): string {
  return value
    .replace(/[[(].*$/, "")
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/)[0]
    .toLowerCase();
}

function inferType(value: string, name: string): string | null {
  const text = value.trim();
  const lower = text.toLowerCase();
  const varName = name.toLowerCase();

  if (/^(graph|adj|g|edges|weight|weights|grafo|adyacencia)\b/.test(varName)) {
    return "graph";
  }
  if (/^(queue|q|cola)$/.test(varName) || lower.includes("deque(")) {
    return "deque";
  }
  if (/^(stack|pila)$/.test(varName)) {
    return "stack";
  }
  if (/^(visited|visitados|seen|vis|visitado)$/.test(varName)) {
    return "set";
  }
  if (/^(parent|padre|rank|rango|dsu|uf)$/.test(varName)) {
    return "unionfind";
  }
  if (
    lower.includes("deque(") ||
    lower.includes("queue(") ||
    lower.includes("lifoqueue(")
  ) {
    return "deque";
  }
  if (lower.includes("counter(") || lower.includes("defaultdict(")) {
    return "dict";
  }
  if (lower.includes("dict(") || lower.startsWith("{")) {
    // `{}` es un dict vacío; `{1, 2}` y `{x for x in y}` son conjuntos.
    if (lower === "{}") return "dict";
    if (lower.startsWith("{") && !lower.includes(":")) return "set";
    return "dict";
  }
  if (lower.includes("set(")) return "set";
  if (lower.includes("sorted(") || lower.includes("list(")) return "list";
  if (lower.includes("heapq") || lower.includes("heap(")) return "heap";

  if (text.startsWith("[")) {
    const inner = text.slice(1, -1);
    if (inner.trim().startsWith("[") || inner.includes(" for ") && inner.includes("[")) {
      return "matrix";
    }
    return "list";
  }
  if (text.startsWith("(")) return "tuple";
  if (/^["']/.test(text) || lower.includes("str(")) return "string";
  if (/^dp\b/.test(varName) || /^memo\b/.test(varName) || /^tabla\b/.test(varName)) {
    return "table";
  }
  return null;
}

function buildVariableTypes(fn: PyFunction): Map<string, string> {
  const types = new Map<string, string>();

  for (const param of fn.params) {
    const lower = param.toLowerCase();
    if (/^(graph|adj|g|edges|weights|grafo|adyacencia)$/.test(lower)) {
      types.set(param, "graph");
    } else if (/^(matrix|grid|board|tablero|matriz)$/.test(lower)) {
      types.set(param, "matrix");
    } else if (
      /^(arr|nums|items|values|lista|array|a|data|datos|coins|monedas|weights)$/.test(
        lower,
      )
    ) {
      types.set(param, "list");
    } else if (/^(s|t|text|texto|word|palabra|str|pattern|patron)$/.test(lower)) {
      types.set(param, "string");
    } else if (/^(queue|q|cola)$/.test(lower)) {
      types.set(param, "deque");
    } else if (/^(graph|adj)$/.test(lower)) {
      types.set(param, "graph");
    }
  }

  for (const assignment of fn.assignments) {
    const target = normalizeTarget(assignment.target);
    if (!target) continue;
    const inferred = inferType(assignment.value, target);
    if (inferred) types.set(target, inferred);
  }

  return types;
}

function addCalls(
  fn: PyFunction,
): { callNames: Set<string>; callFulls: Set<string>; methodNames: Set<string> } {
  const callNames = new Set<string>();
  const callFulls = new Set<string>();
  const methodNames = new Set<string>();

  for (const call of fn.calls) {
    callNames.add(call.name.toLowerCase());
    callFulls.add(call.full.toLowerCase());
    if (call.full.includes(".")) {
      methodNames.add(call.name.toLowerCase());
    }
  }

  return { callNames, callFulls, methodNames };
}

export function buildFacts(fn: PyFunction, module: PyModule): FunctionFacts {
  const lowerSource = fn.source.toLowerCase();
  const callInfo = addCalls(fn);
  const assignedTargets = new Set<string>();
  const assignedValues = new Map<string, string>();

  for (const assignment of fn.assignments) {
    const target = normalizeTarget(assignment.target);
    if (target) {
      assignedTargets.add(target);
      assignedValues.set(target, assignment.value);
    }
  }

  const subscriptBases = new Set(fn.subscripts.map((item) => item.base.toLowerCase()));
  const variableTypes = buildVariableTypes(fn);

  const selfCalls = fn.calls.filter(
    (call) =>
      call.name === fn.name ||
      (call.full.endsWith(`.${fn.name}`) && call.full.startsWith("self.")),
  );

  const decorators = fn.decorators.join(" ").toLowerCase();
  const hasMemoDecorator =
    decorators.includes("lru_cache") ||
    decorators.includes("cache") ||
    decorators.includes("memoize");

  const hasRecursion = selfCalls.length > 0;

  const hasMemoTable =
    hasRecursion &&
    ([...assignedTargets].some((target) =>
      /^(memo|cache|memoria)$/.test(target),
    ) ||
      [...subscriptBases].some((base) => /^(memo|cache|memoria)$/.test(base)));

  const hasDpTable =
    [...assignedTargets].some((target) => /^(dp|tabla|table|dp_|memo)/.test(target)) ||
    [...subscriptBases].some((base) => /^(dp|tabla|table)/.test(base)) ||
    lowerSource.includes("memo[");

  const hasMatrix =
    [...variableTypes.values()].includes("matrix") ||
    /\[\s*\[/.test(lowerSource) ||
    /dp\[[^\]]+\]\[[^\]]+\]/.test(lowerSource);

  const hasAdjacency =
    [...variableTypes.values()].includes("graph") ||
    [...subscriptBases].some((base) =>
      /^(graph|adj|g|edges|weights|grafo|adyacencia)$/.test(base),
    ) ||
    /(graph|adj|adyacencia)\s*\[/.test(lowerSource) ||
    /\bneighbors\b/.test(lowerSource);

  const hasVisited =
    [...assignedTargets].some((target) =>
      /^(visited|visitados|seen|vis|visitado)$/.test(target),
    ) || /\bvisited\b/.test(lowerSource);

  const hasQueue =
    callInfo.callNames.has("deque") ||
    callInfo.callNames.has("queue") ||
    callInfo.methodNames.has("popleft") ||
    callInfo.methodNames.has("appendleft") ||
    [...variableTypes.values()].includes("deque") ||
    /\bqueue\b/.test(lowerSource) ||
    /\bcola\b/.test(lowerSource);

  const hasStack =
    callInfo.methodNames.has("append") &&
      ([...variableTypes.values()].includes("stack") ||
        /\bstack\b/.test(lowerSource) ||
        /\bpila\b/.test(lowerSource)) ||
    /\bstack\b/.test(lowerSource);

  const hasHeap =
    module.imports.some((name) => name.includes("heapq")) ||
    callInfo.callNames.has("heappush") ||
    callInfo.callNames.has("heappop") ||
    callInfo.callNames.has("heapify") ||
    callInfo.callNames.has("heappushpop") ||
    callInfo.callNames.has("nlargest") ||
    callInfo.callNames.has("nsmallest") ||
    callInfo.callFulls.has("heapq.heappush") ||
    callInfo.callFulls.has("heapq.heappop");

  const hasUnionFind =
    (callInfo.callNames.has("find") || callInfo.callNames.has("buscar")) &&
    (callInfo.callNames.has("union") ||
      callInfo.callNames.has("unir") ||
      callInfo.callNames.has("unite")) &&
    [...assignedTargets].some((target) => /^(parent|padre|rank|rango)$/.test(target));

  const hasTreeLinks =
    /\.(left|right)\b/.test(lowerSource) ||
    /\b(left|right|izquierda|derecha)\s*=/.test(lowerSource) ||
    /nodo\.(izq|der)/.test(lowerSource);

  const hasBacktracking =
    hasRecursion &&
    (callInfo.methodNames.has("pop") ||
      callInfo.methodNames.has("append") ||
      callInfo.methodNames.has("add") ||
      callInfo.methodNames.has("remove") ||
      callInfo.methodNames.has("discard") ||
      /backtrack|deshacer/.test(lowerSource) ||
      /\bused\b/.test(lowerSource));

  const hasGreedySort =
    (callInfo.callNames.has("sorted") || callInfo.callNames.has("sort")) &&
    !hasDpTable &&
    !hasRecursion;

  const composedText = `${fn.name} ${fn.source}`.toLowerCase();

  return {
    fn,
    lowerSource,
    callNames: callInfo.callNames,
    callFulls: callInfo.callFulls,
    methodNames: callInfo.methodNames,
    assignedTargets,
    assignedValues,
    subscriptBases,
    subscripts: fn.subscripts.map((item) => `${item.base}[${item.index}]`),
    comparisonsText: fn.comparisons.join(" \n "),
    imports: module.imports,
    importedNames: new Set(module.importedNames.map((name) => name.toLowerCase())),
    variableTypes,
    loopCount: fn.loopCount,
    maxLoopDepth: fn.maxLoopDepth,
    hasRecursion,
    selfCalls,
    hasMemoDecorator,
    hasMemoTable,
    hasDpTable,
    hasMatrix,
    hasAdjacency,
    hasVisited,
    hasQueue,
    hasStack,
    hasHeap,
    hasUnionFind,
    hasTreeLinks,
    hasBacktracking,
    hasGreedySort,
    composedText,
  };
}
