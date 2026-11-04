import type {
  AnalysisResult,
  AnalysisStats,
  CallGraphEdge,
  Candidate,
  ComponentRow,
  FunctionFacts,
  PyFunction,
  PyModule,
  PyStmt,
} from "./types";
import { parsePython } from "./parsePython";
import { buildFacts } from "./facts";
import {
  assignmentSpace,
  buildContext,
  callCost,
  callSpace,
  estimateGeneric,
  exprCost,
  iterationCost,
  whileFactor,
} from "./estimate";
import { analyzeRecursion, type RecursionResult } from "./recursion";
import { detectCandidates } from "./detect";
import { LINEAR, ONE, maxCost } from "./cost";

export interface AnalyzeOutcome {
  result: AnalysisResult | null;
  error: string | null;
}

interface Evaluation {
  fn: PyFunction;
  facts: FunctionFacts;
  estimate: ReturnType<typeof estimateGeneric>;
  recursion: RecursionResult | null;
  candidate: Candidate;
  score: number;
}

function nameBonus(name: string): number {
  const lower = name.toLowerCase();

  if (
    /^(main|solve|run|execute|algoritmo|algorithm|programa|program)$/.test(
      lower,
    )
  ) {
    return 28;
  }
  if (
    /(bubble|sort|orden|bfs|dfs|dijkstra|bellman|floyd|kruskal|prim|topolog|knapsack|mochila|lcs|lis|edit|coin|nqueens|n_queens|permut|sudoku|subset|activity|fib|factorial|merge|quick|binary|linear|search|insert|query|recorrido|traversal)/.test(
      lower,
    )
  ) {
    return 22;
  }
  if (
    /^(merge|partition|helper|build|update|relax|dfs_visit|visit|union|find|children|aux)$/.test(
      lower,
    )
  ) {
    return -12;
  }
  return 0;
}

function evaluate(fn: PyFunction, module: PyModule): Evaluation | null {
  const facts = buildFacts(fn, module);
  const estimate = estimateGeneric(fn, facts);
  const recursion = analyzeRecursion(fn, facts, estimate);
  const candidates = detectCandidates({ fn, facts, estimate, recursion });
  const candidate = candidates[0];

  if (!candidate) return null;

  return {
    fn,
    facts,
    estimate,
    recursion,
    candidate,
    score:
      candidate.confidence * 100 +
      candidate.time.rank +
      nameBonus(fn.name) +
      (candidate.recurrence ? 4 : 0),
  };
}

function synthesizeScript(module: PyModule): PyFunction {
  const body = module.topLevel;
  const calls: PyFunction["calls"] = [];
  const subscripts: PyFunction["subscripts"] = [];
  const comparisons: string[] = [];
  const assignments: PyFunction["assignments"] = [];
  const names = new Set<string>();
  let comprehensionCount = 0;
  let loopCount = 0;
  let maxLoopDepth = 0;

  const visit = (statements: PyStmt[], depth: number) => {
    for (const statement of statements) {
      calls.push(...statement.calls);
      subscripts.push(...statement.expr.subscripts);
      comparisons.push(...statement.expr.comparisons);
      for (const name of statement.expr.names) names.add(name);
      comprehensionCount += statement.expr.comprehensions.length;

      if (statement.kind === "assign" || statement.kind === "augassign") {
        if (statement.target) {
          assignments.push({
            target: statement.target,
            value: statement.value ?? "",
            line: statement.line,
          });
        }
      }

      if (statement.kind === "for" || statement.kind === "while") {
        loopCount += 1;
        maxLoopDepth = Math.max(maxLoopDepth, depth + 1);
        visit(statement.body, depth + 1);
      } else {
        visit(statement.body, depth);
        for (const branch of statement.branches) {
          visit(branch.body, depth);
        }
      }
    }
  };

  visit(body, 0);

  return {
    name: "script",
    qualifiedName: "script",
    params: [],
    decorators: [],
    line: 1,
    endLine: Math.max(1, module.source.split("\n").length),
    source: module.source,
    body,
    calls,
    subscripts,
    comparisons,
    assignments,
    names: [...names],
    comprehensionCount,
    loopCount,
    maxLoopDepth,
  };
}

/* ------------------------------------------------------------------ */
/* Tabla de componentes                                                */
/* ------------------------------------------------------------------ */

function shorten(value: string, max = 72): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function describeIterable(
  iterable: string,
  costLabel: string,
  depth: number,
  facts: FunctionFacts,
): string {
  const lower = iterable.toLowerCase();
  let reason = "";

  if (/^range\s*\(/.test(lower)) {
    reason = `Itera sobre ${shorten(iterable)} (${costLabel}).`;
  } else if (/(graph|adj|g|grafo|adyacencia)\s*\[|neighbors|vecinos/.test(lower)) {
    reason =
      "Recorre los vecinos de un vértice; sumado sobre todo el grafo cuesta O(E).";
  } else if (/\.items\s*\(|\.keys\s*\(|\.values\s*\(/.test(lower)) {
    reason = "Recorre las entradas del diccionario una vez.";
  } else if (/set\s*\(|dict\s*\(|list\s*\(|sorted\s*\(|enumerate\s*\(|zip\s*\(/.test(lower)) {
    reason = `Construye/recorre ${shorten(iterable)} antes del bucle (${costLabel}).`;
  } else if (/(edges|aristas)/.test(lower) && facts.hasAdjacency) {
    reason = "Recorre las aristas del grafo (O(E)).";
  } else if (/(matrix|grid|tablero|matriz)/.test(lower)) {
    reason = `Recorre filas de la matriz (${costLabel}).`;
  } else {
    reason = `Recorre ${shorten(iterable)} (${costLabel}).`;
  }

  if (depth > 0) {
    reason += " Está anidado: se multiplica por el bucle exterior.";
  }

  return reason;
}

function describeWhile(statement: PyStmt, costLabel: string): string {
  const test = (statement.test ?? "").toLowerCase();
  const body = statement.body.map((item) => item.text).join(" ");
  const lowerBody = body.toLowerCase();

  if (
    /\/\/\s*=?\s*2|>>\s*=?\s*1|\*\s*=?\s*2/.test(lowerBody) ||
    (/(lo|low|left|inicio|izq)/.test(test) && /mid|medio/.test(lowerBody))
  ) {
    return `Reduce el problema a la mitad en cada paso (${costLabel}).`;
  }
  if (/n\s*-=\s*1|n\s*=\s*n\s*-\s*1/.test(lowerBody)) {
    return `Disminuye n de uno en uno hasta llegar a 0 (${costLabel}).`;
  }
  if (/(queue|cola|stack|pila|heap|frontera|fringe|\bq\b)/.test(test)) {
    return "Extrae elementos de una cola/pila; cada elemento entra y sale una vez.";
  }
  if (/(matrix|grid|tablero|board)/.test(test) || /(i|j|k)\s*<\s*/.test(test)) {
    return `Avanza por índices hasta agotar la estructura (${costLabel}).`;
  }
  return `Se repite mientras se cumple la condición (${costLabel}).`;
}

function isStructureAssignment(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("[") ||
    trimmed.startsWith("{") ||
    /^(set|list|dict|tuple|deque|Counter|defaultdict|sorted)\s*\(/.test(
      trimmed,
    )
  );
}

function addRowsForCalls(
  rows: ComponentRow[],
  statement: PyStmt,
  facts: FunctionFacts,
  ctx: ReturnType<typeof buildContext>,
  recursion: RecursionResult | null,
): void {
  const seen = new Set<string>();

  for (const call of statement.expr.calls) {
    const key = `${statement.line}:${call.full}:${call.args.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const name = call.name.toLowerCase();
    const full = call.full.toLowerCase();

    if (name === facts.fn.name.toLowerCase() || full === `self.${facts.fn.name.toLowerCase()}`) {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Llamada recursiva",
        time: recursion?.time.label ?? ONE.label,
        space: recursion?.space.label ?? LINEAR.label,
        reason:
          "Cada llamada resuelve un subproblema y consume un marco de pila.",
        depth: statement.depth,
      });
      continue;
    }

    if (name === "sorted" || name === "sort") {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Ordenamiento",
        time: "O(n log n)",
        space: name === "sort" ? "O(1)" : "O(n)",
        reason:
          "Timsort: O(n log n) en el peor caso y O(n) si la entrada ya está ordenada.",
        depth: statement.depth,
      });
      continue;
    }

    if (name === "heappush" || name === "heappop" || name === "heappushpop" || name === "heapreplace") {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Operación de heap",
        time: "O(log n)",
        space: "O(1)",
        reason: "La altura del heap es logarítmica; se reordena en O(log n).",
        depth: statement.depth,
      });
      continue;
    }

    if (name === "heapify") {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Construcción de heap",
        time: "O(n)",
        space: "O(1)",
        reason: "heapify construye el heap in situ en tiempo lineal.",
        depth: statement.depth,
      });
      continue;
    }

    if (name === "bisect" || name === "bisect_left" || name === "bisect_right") {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Búsqueda binaria",
        time: "O(log n)",
        space: "O(1)",
        reason: "bisect mantiene el arreglo ordenado y busca la posición en O(log n).",
        depth: statement.depth,
      });
      continue;
    }

    if (name === "append" || name === "appendleft" || name === "add" || name === "push") {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Inserción amortizada",
        time: "O(1) amortizado",
        space: "O(1)",
        reason:
          "append/add sobre list/set/deque es O(1) amortizado; el total depende de las iteraciones del bucle.",
        depth: statement.depth,
      });
      continue;
    }

    if (name === "popleft") {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Extracción de cola",
        time: "O(1)",
        space: "O(1)",
        reason: "deque.popleft() es O(1); list.pop(0) sería O(n).",
        depth: statement.depth,
      });
      continue;
    }

    if (name === "pop") {
      const fromFront = call.args[0]?.trim() === "0";
      rows.push({
        line: statement.line,
        code: statement.code,
        type: fromFront ? "Extracción costosa" : "Extracción",
        time: fromFront ? "O(n)" : "O(1)",
        space: "O(1)",
        reason: fromFront
          ? "list.pop(0) desplaza todos los elementos; usa deque.popleft()."
          : "Elimina el último elemento (o una clave) en O(1) promedio.",
        depth: statement.depth,
      });
      continue;
    }

    if (name === "find" || name === "union" || name === "buscar" || name === "unir") {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Union-Find",
        time: "O(α(n))",
        space: "O(1)",
        reason:
          "Con compresión de caminos y unión por rango, cada operación es casi constante.",
        depth: statement.depth,
      });
      continue;
    }

    if (name === "min" || name === "max") {
      const cost =
        call.args.length >= 2 || call.args[0]?.includes("[")
          ? "O(1)"
          : "O(n)";
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Búsqueda del mínimo/máximo",
        time: cost,
        space: "O(1)",
        reason:
          cost === "O(1)"
            ? "Compara valores individuales."
            : "Recorre la colección completa para encontrar el extremo.",
        depth: statement.depth,
      });
      continue;
    }

    if (name === "sum" || name === "any" || name === "all") {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Recorrido de colección",
        time: "O(n)",
        space: "O(1)",
        reason: `${call.name}() recorre la colección completa.`,
        depth: statement.depth,
      });
      continue;
    }

    if (
      name === "set" ||
      name === "list" ||
      name === "tuple" ||
      name === "dict" ||
      name === "frozenset" ||
      name === "counter" ||
      name === "defaultdict" ||
      name === "deque"
    ) {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Construcción de estructura",
        time: "O(n)",
        space: "O(n)",
        reason: `Crear ${call.name}() a partir de n elementos cuesta tiempo y espacio O(n).`,
        depth: statement.depth,
      });
      continue;
    }

    if (name === "permutations") {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Generación de permutaciones",
        time: "O(n!)",
        space: "O(n)",
        reason: "itertools.permutations genera n! tuplas; construir cada una cuesta O(n).",
        depth: statement.depth,
      });
      continue;
    }

    if (name === "combinations" || name === "product" || name === "combinations_with_replacement") {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Generación combinatoria",
        time: "O(2ⁿ)",
        space: "O(n)",
        reason: `${call.name}() explora combinaciones/productos; el número de resultados crece exponencialmente.`,
        depth: statement.depth,
      });
      continue;
    }

    if (name === "len") {
      continue;
    }

    const cost = callCost(call, ctx);
    const space = callSpace(call);
    if (cost.rank > 0 || space.rank > 0) {
      rows.push({
        line: statement.line,
        code: statement.code,
        type: call.full.includes(".") ? "Llamada a método" : "Llamada",
        time: cost.label,
        space: space.label,
        reason: `Llamada a ${call.full}().`,
        depth: statement.depth,
      });
    }
  }

  // Pertenencia `x in coleccion`.
  if (/\bin\s+[A-Za-z_]/.test(statement.expr.text)) {
    const matches = statement.expr.text.matchAll(
      /\bin\s+([A-Za-z_][A-Za-z0-9_]*)/g,
    );
    for (const match of matches) {
      const collection = match[1].toLowerCase();
      const type = facts.variableTypes.get(collection);
      const cost =
        type === "set" || type === "dict" || type === "unionfind"
          ? "O(1) promedio"
          : type === "list" || type === "matrix" || type === "string"
            ? "O(n)"
            : "O(1) promedio";
      rows.push({
        line: statement.line,
        code: statement.code,
        type: "Pertenencia",
        time: cost,
        space: "O(1)",
        reason:
          cost === "O(n)"
            ? `\`in\` sobre ${collection} recorre la colección; usa set/dict para O(1) promedio.`
            : `\`in\` sobre ${collection} usa hash/índice, O(1) promedio.`,
        depth: statement.depth,
      });
    }
  }
}

function buildRows(
  fn: PyFunction,
  facts: FunctionFacts,
  candidate: Candidate,
  recursion: RecursionResult | null,
): ComponentRow[] {
  const ctx = buildContext(fn, facts);
  const rows: ComponentRow[] = [];

  if (candidate.recurrence) {
    rows.push({
      line: fn.line,
      code: `def ${fn.name}(…)`,
      type: "Recurrencia",
      time: candidate.time.label,
      space: candidate.space.label,
      reason: candidate.recurrence.equation,
      depth: 0,
    });
  }

  const visit = (statements: PyStmt[], loopDepth: number) => {
    for (const statement of statements) {
      switch (statement.kind) {
        case "for": {
          const factor = iterationCost(statement.iter ?? "", ctx);
          rows.push({
            line: statement.line,
            code: statement.code,
            type: loopDepth > 0 ? "Bucle for anidado" : "Bucle for",
            time: factor.label,
            space: "O(1)",
            reason: describeIterable(
              statement.iter ?? "la colección",
              factor.label,
              loopDepth,
              facts,
            ),
            depth: loopDepth,
          });
          visit(statement.body, loopDepth + 1);
          for (const branch of statement.branches) {
            visit(branch.body, loopDepth);
          }
          break;
        }

        case "while": {
          const factor = whileFactor(statement, ctx);
          rows.push({
            line: statement.line,
            code: statement.code,
            type: loopDepth > 0 ? "Bucle while anidado" : "Bucle while",
            time: factor.label,
            space: "O(1)",
            reason: describeWhile(statement, factor.label),
            depth: loopDepth,
          });
          visit(statement.body, loopDepth + 1);
          for (const branch of statement.branches) {
            visit(branch.body, loopDepth);
          }
          break;
        }

        case "if": {
          const cost = exprCost(statement.expr, ctx);
          rows.push({
            line: statement.line,
            code: statement.code,
            type: "Condición",
            time: cost.label,
            space: "O(1)",
            reason: `Evalúa \`${shorten(statement.test ?? "la condición", 60)}\` y elige una rama.`,
            depth: loopDepth,
          });
          for (const branch of statement.branches) {
            visit(branch.body, loopDepth);
          }
          break;
        }

        case "assign":
        case "augassign": {
          const value = (statement.value ?? "").trim();
          if (isStructureAssignment(value)) {
            const space = assignmentSpace(statement, ctx);
            const time = maxCost(space, exprCost(statement.expr, ctx));
            rows.push({
              line: statement.line,
              code: statement.code,
              type: "Estructura auxiliar",
              time: time.label,
              space: space.label,
              reason: `Reserva una estructura (${shorten(value, 54)}) que ocupa ${space.label}.`,
              depth: loopDepth,
            });
          } else if (statement.expr.calls.length > 0) {
            addRowsForCalls(rows, statement, facts, ctx, recursion);
          } else if (
            /^(dp|memo|tabla|table|dist|parent|rank|visited|seen|indegree|in_degree)/.test(
              (statement.target ?? "").toLowerCase(),
            )
          ) {
            const space = assignmentSpace(statement, ctx);
            rows.push({
              line: statement.line,
              code: statement.code,
              type: "Estado auxiliar",
              time: "O(1)",
              space: space.label,
              reason: `Inicializa ${shorten(statement.target ?? "la estructura")}.`,
              depth: loopDepth,
            });
          }
          break;
        }

        case "return":
        case "call":
        case "expr":
        case "yield":
          addRowsForCalls(rows, statement, facts, ctx, recursion);
          break;

        case "import":
          rows.push({
            line: statement.line,
            code: statement.code,
            type: "Import",
            time: "O(1)",
            space: "O(1)",
            reason:
              "Carga un módulo o nombre; no afecta el costo asintótico del algoritmo.",
            depth: loopDepth,
          });
          break;

        case "def":
          rows.push({
            line: statement.line,
            code: statement.code,
            type: "Definición",
            time: "O(1)",
            space: "O(1)",
            reason: "Declara una función auxiliar.",
            depth: loopDepth,
          });
          visit(statement.body, loopDepth);
          break;

        default:
          break;
      }

      if (
        statement.kind !== "for" &&
        statement.kind !== "while" &&
        statement.kind !== "if" &&
        statement.kind !== "def"
      ) {
        visit(statement.body, loopDepth);
        for (const branch of statement.branches) {
          visit(branch.body, loopDepth);
        }
      }
    }
  };

  visit(fn.body, 0);

  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    const key = `${row.line}:${row.type}:${row.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique
    .sort((a, b) => a.line - b.line || a.depth - b.depth)
    .slice(0, 48);
}

/* ------------------------------------------------------------------ */
/* Estructuras, notas y estadísticas                                   */
/* ------------------------------------------------------------------ */

const STRUCTURE_LABELS: Record<string, string> = {
  list: "Lista (array)",
  matrix: "Matriz 2D",
  set: "Conjunto (set)",
  dict: "Diccionario (dict)",
  deque: "Cola (deque)",
  stack: "Pila (stack)",
  heap: "Heap (heapq)",
  graph: "Grafo de adyacencia",
  unionfind: "Union-Find",
  table: "Tabla DP",
  tuple: "Tupla",
  string: "Cadena",
  list_str: "Lista de cadenas",
};

function buildStructures(facts: FunctionFacts): string[] {
  const structures = new Set<string>();

  for (const type of facts.variableTypes.values()) {
    const label = STRUCTURE_LABELS[type];
    if (label) structures.add(label);
  }

  if (facts.hasAdjacency) structures.add("Lista de adyacencia");
  if (facts.hasVisited) structures.add("Conjunto de visitados");
  if (facts.hasQueue) structures.add("Cola (deque)");
  if (facts.hasStack) structures.add("Pila (stack)");
  if (facts.hasHeap) structures.add("Heap (heapq)");
  if (facts.hasUnionFind) structures.add("Union-Find (parent/rank)");
  if (facts.hasTreeLinks) structures.add("Nodos con left/right");
  if (facts.hasDpTable) structures.add("Tabla DP");
  if (facts.hasMemoTable || facts.hasMemoDecorator) structures.add("Memo/caché");
  if (facts.hasMatrix) structures.add("Matriz 2D");

  if (facts.callNames.has("sorted") || facts.methodNames.has("sort")) {
    structures.add("Copia ordenada");
  }
  if (facts.methodNames.has("append")) structures.add("Lista acumuladora");
  if (facts.methodNames.has("popleft")) structures.add("Cola (deque)");

  return [...structures];
}

function buildNotes(
  facts: FunctionFacts,
  candidate: Candidate,
  estimate: ReturnType<typeof estimateGeneric>,
): string[] {
  const notes = [...candidate.notes];

  if (facts.methodNames.has("append") || facts.methodNames.has("add")) {
    notes.push(
      "list.append/set.add son O(1) amortizado: el costo total del bucle sigue siendo el número de iteraciones, no el tamaño acumulado.",
    );
  }
  if (
    facts.lowerSource.includes("pop(0)") ||
    /\.pop\s*\(\s*0\s*\)/.test(facts.lowerSource)
  ) {
    notes.push(
      "list.pop(0) es O(n) porque desplaza el resto; para una cola usa collections.deque + popleft().",
    );
  }
  if (/\+\s*\[/.test(facts.lowerSource) && facts.loopCount > 0) {
    notes.push(
      "Concatenar listas con `res = res + [x]` dentro de un bucle copia todos los elementos y eleva el costo a O(n²); usa append.",
    );
  }
  if (facts.callNames.has("sorted") || facts.methodNames.has("sort")) {
    notes.push(
      "sorted()/list.sort() usan Timsort: O(n log n) en el peor caso y O(n) si la entrada ya está ordenada.",
    );
  }
  if (facts.hasHeap) {
    notes.push(
      "heapq: heappush/heappop cuestan O(log n) y heapify cuesta O(n).",
    );
  }
  if (facts.hasVisited) {
    notes.push(
      "Cada vértice se marca como visitado una sola vez; por eso BFS/DFS cuestan O(V+E) con listas de adyacencia.",
    );
  }
  if (facts.hasDpTable || facts.hasMemoTable) {
    notes.push(
      "La tabla DP intercambia memoria por tiempo: el costo es el número de estados por el trabajo de cada transición.",
    );
  }
  if (facts.hasMemoDecorator) {
    notes.push(
      "La memoización evita recalcular estados: el árbol de llamadas se reduce al número de estados únicos.",
    );
  }
  if (facts.hasRecursion) {
    notes.push(
      "Python no aplica optimización de recursión de cola (TCO): incluso una recursión de cola consume O(n) de pila.",
    );
  }
  if (candidate.id === "quick-sort") {
    notes.push(
      "El peor caso de quick sort es O(n²) cuando los pivotes quedan muy desbalanceados; el promedio es O(n log n).",
    );
  }
  if (candidate.id === "bst") {
    notes.push(
      "El O(log n) del BST es promedio/si está balanceado; un árbol degenerado degrada las operaciones a O(n).",
    );
  }
  if (candidate.id === "binary-search") {
    notes.push(
      "La búsqueda binaria solo es válida si la colección está ordenada de antemano.",
    );
  }
  if (facts.hasMatrix && !facts.hasDpTable) {
    notes.push(
      "La matriz de entrada no cuenta como espacio auxiliar; solo se suma la memoria que el algoritmo crea.",
    );
  }
  if (/\blen\s*\(\s*set\s*\(/.test(facts.lowerSource)) {
    notes.push(
      "len(set(x)) es O(n): construir el conjunto recorre todos los elementos, aunque len() sea O(1).",
    );
  }
  if (facts.imports.some((name) => name.includes("networkx"))) {
    notes.push(
      "networkx implementa los recorridos en Python/C; el análisis mide el costo del algoritmo tal como está escrito.",
    );
  }
  if (estimate.dimensions >= 2) {
    notes.push(
      `La tabla de estados tiene ${estimate.dimensions} dimensiones: el costo es proporcional a su producto.`,
    );
  }

  return [...new Set(notes)].slice(0, 9);
}

function buildStats(fn: PyFunction, module: PyModule): AnalysisStats {
  return {
    lines: module.source.split("\n").length,
    functions: Math.max(1, module.functions.length),
    loops: fn.loopCount,
    maxLoopDepth: fn.maxLoopDepth,
    recursiveCalls: fn.calls.filter((call) => call.name === fn.name).length,
    calls: fn.calls.length,
  };
}

function buildCallGraph(fn: PyFunction, module: PyModule): CallGraphEdge[] {
  const names = new Set(module.functions.map((item) => item.name));
  const edges: CallGraphEdge[] = [];
  const seen = new Set<string>();

  for (const call of fn.calls) {
    if (call.name === fn.name) {
      const key = `${fn.name}->${fn.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ from: fn.name, to: fn.name });
      }
      continue;
    }
    if (names.has(call.name)) {
      const key = `${fn.name}->${call.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ from: fn.name, to: call.name });
      }
    }
  }

  return edges;
}

/* ------------------------------------------------------------------ */

function buildResult(evaluation: Evaluation, module: PyModule): AnalysisResult {
  const { fn, facts, estimate, candidate, recursion } = evaluation;

  return {
    name: candidate.name,
    category: candidate.category,
    time: candidate.time,
    space: candidate.space,
    confidence: candidate.confidence,
    summary: candidate.summary,
    evidence: candidate.evidence,
    structures: buildStructures(facts),
    notes: buildNotes(facts, candidate, estimate),
    rows: buildRows(fn, facts, candidate, recursion),
    recurrence: candidate.recurrence,
    stats: buildStats(fn, module),
    callGraph: buildCallGraph(fn, module),
  };
}

/**
 * Analiza un fragmento de Python y devuelve la clasificación, la complejidad
 * temporal/espacial, la tabla de componentes y la recurrencia (si aplica).
 */
export function analyzeCode(source: string): AnalyzeOutcome {
  const parsed = parsePython(source);

  if (!parsed.module) {
    return {
      result: null,
      error: parsed.error ?? "No se pudo analizar el código.",
    };
  }

  if (parsed.error) {
    return { result: null, error: parsed.error };
  }

  const module = parsed.module;
  const functions =
    module.functions.length > 0
      ? module.functions
      : [synthesizeScript(module)];

  const evaluations = functions
    .map((fn) => evaluate(fn, module))
    .filter((item): item is Evaluation => item !== null)
    .sort((a, b) => b.score - a.score);

  const best = evaluations[0];
  if (!best) {
    return {
      result: null,
      error:
        "No se pudo clasificar el código. Verifica que contenga una función o un bloque ejecutable.",
    };
  }

  return { result: buildResult(best, module), error: null };
}
