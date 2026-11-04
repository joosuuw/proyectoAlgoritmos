import type {
  AlgorithmCategory,
  Candidate,
  Cost,
  FunctionFacts,
  PyFunction,
} from "./types";
import {
  CUBIC,
  E_LOG_E,
  E_LOG_V,
  EXPONENTIAL,
  FACTORIAL,
  LINEAR,
  LINEARITHMIC,
  LINEAR_M,
  LOG,
  N_TIMES_M,
  ONE,
  QUADRATIC,
  V_CUBED,
  V_PLUS_E,
  V_SQUARED,
  V_TIMES_E,
  customCost,
} from "./cost";
import type { Estimate } from "./estimate";
import type { RecursionResult } from "./recursion";

export interface DetectInput {
  fn: PyFunction;
  facts: FunctionFacts;
  estimate: Estimate;
  recursion: RecursionResult | null;
}

interface Draft {
  id: string;
  name: string;
  category: AlgorithmCategory;
  time: Cost;
  space: Cost;
  confidence: number;
  summary: string;
  evidence?: string[];
  notes?: string[];
  recurrence?: Candidate["recurrence"];
}

const N_TIMES_W = customCost("O(n·W)", 40, "n2");
const N_TIMES_AMOUNT = customCost("O(n·amount)", 40, "n2");
const N_TIMES_K = customCost("O(n + k)", 24, "n");
const K_SPACE = customCost("O(k)", 20, "n");
const RADIX = customCost("O(d·(n + b))", 34, "nlog");
const SHELL = customCost("O(n log² n)", 32, "nlog");
const SUDOKU = customCost("O(9^(n·n))", 96, "2n");
const N_QUEENS = customCost("O(n!) con poda", 94, "nf");
const BST_AVERAGE = customCost("O(log n) promedio", 16, "log");
const TRIE = customCost("O(L) por palabra", 26, "n");

function baseEvidence(facts: FunctionFacts): string[] {
  const evidence: string[] = [];

  if (facts.hasRecursion) evidence.push("La función se llama a sí misma.");
  if (facts.hasMemoDecorator) {
    evidence.push("Usa un decorador de memoización (@lru_cache / @cache).");
  }
  if (facts.hasMemoTable) {
    evidence.push("Guarda resultados en una tabla memo/cache.");
  }
  if (facts.hasDpTable) {
    evidence.push("Construye una tabla dp/tabla de estados.");
  }
  if (facts.hasMatrix) evidence.push("Trabaja con una matriz o tabla 2D.");
  if (facts.hasAdjacency) {
    evidence.push("Recorre una lista/estructura de adyacencia.");
  }
  if (facts.hasVisited) {
    evidence.push("Mantiene un conjunto de visitados para no repetir nodos.");
  }
  if (facts.hasQueue) evidence.push("Usa una cola (deque/queue).");
  if (facts.hasStack) evidence.push("Usa una pila (stack).");
  if (facts.hasHeap) evidence.push("Usa heapq (heappush/heappop/heapify).");
  if (facts.hasUnionFind) {
    evidence.push("Tiene find/parent/union: estructura Union-Find.");
  }
  if (facts.hasTreeLinks) {
    evidence.push("Accede a enlaces izquierda/derecha de nodos.");
  }
  if (facts.hasBacktracking) {
    evidence.push("Modifica y deshace estado (append/pop) durante la búsqueda.");
  }
  if (facts.loopCount > 0) {
    evidence.push(
      `${facts.loopCount} ${
        facts.loopCount === 1 ? "bucle" : "bucles"
      } con profundidad máxima ${facts.maxLoopDepth}.`,
    );
  }
  if (facts.callNames.has("sorted") || facts.methodNames.has("sort")) {
    evidence.push("Ordena con sorted()/sort() (Timsort, O(n log n)).");
  }
  if (facts.callNames.has("bisect") || facts.callNames.has("bisect_left")) {
    evidence.push("Usa búsqueda binaria con bisect.");
  }

  return evidence;
}

function make(facts: FunctionFacts, draft: Draft): Candidate {
  return {
    ...draft,
    evidence: [...baseEvidence(facts), ...(draft.evidence ?? [])],
    structures: [],
    notes: draft.notes ?? [],
  };
}

function hasCall(facts: FunctionFacts, ...names: string[]): boolean {
  return names.some(
    (name) =>
      facts.callNames.has(name) ||
      facts.callFulls.has(name) ||
      facts.methodNames.has(name),
  );
}

function functionName(fn: PyFunction): string {
  return fn.name.toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Ordenamiento                                                        */
/* ------------------------------------------------------------------ */

function isAdjacentSwap(text: string): boolean {
  return (
    /\w+\s*\[\s*[^\]]*?\+\s*1\s*\]\s*,\s*\w+\s*\[[^\]]*\]\s*=/.test(text) ||
    /\w+\s*\[\s*\w+\s*\]\s*,\s*\w+\s*\[\s*\w+\s*\]\s*=/.test(text) ||
    /temp\s*=\s*\w+\s*\[[^\]]+\][\s\S]{0,80}\w+\s*\[[^\]]+\]\s*=\s*\w+\s*\[[^\]]+\][\s\S]{0,80}\w+\s*\[[^\]]+\]\s*=\s*temp/.test(
      text,
    )
  );
}

function sortingSignals(facts: FunctionFacts): boolean {
  const text = facts.composedText;
  if (facts.maxLoopDepth >= 2 && isAdjacentSwap(text)) return true;
  if (facts.maxLoopDepth >= 2 && /(pivot|particion|partition|min_idx|min_index|menor)/.test(text)) {
    return true;
  }
  if (facts.maxLoopDepth >= 2 && /while/.test(text) && /\bkey\b/.test(text) && /\[j\]/.test(text)) {
    return true;
  }
  if (
    facts.hasRecursion &&
    /(merge|mezcla|fusion)/.test(text) &&
    /(temp|aux|merged|resultado)/.test(text)
  ) {
    return true;
  }
  if (
    hasCall(facts, "sorted", "sort") &&
    /\b(arr|nums|items|values|lista|array|datos|a)\b/.test(text) &&
    !facts.hasRecursion
  ) {
    return true;
  }
  return false;
}

function detectSorting(input: DetectInput): Candidate | null {
  const { fn, facts } = input;
  const name = functionName(fn);
  const text = facts.composedText;
  const named =
    /(sort|bubble|burbuja|insertion|insercion|selection|seleccion|merge|mezcla|quick|rapido|heap|monticulo|counting|conteo|radix|shell|ordenamiento|ordenacion|ordenar)/.test(
      name,
    );

  // "activity selection" o "interval scheduling" son greedy, no ordenamientos.
  if (/(activity|actividad|interval|intervalo|huffman|greedy|coin_greedy)/.test(name)) {
    return null;
  }

  if (!named && !sortingSignals(facts)) return null;

  const bubble =
    /bubble|burbuja/.test(name) ||
    (facts.maxLoopDepth >= 2 &&
      isAdjacentSwap(text) &&
      /\[j\s*\+\s*1\]/.test(text));
  const insertion =
    /insertion|insercion/.test(name) ||
    (facts.maxLoopDepth >= 2 &&
      /while/.test(text) &&
      /\bkey\b/.test(text) &&
      /\[j\]/.test(text));
  const selection =
    /selection|seleccion/.test(name) ||
    /(min_idx|min_index|indice_min|indice_menor|menor_idx)/.test(text);
  const merge =
    /(merge|mezcla|fusion)/.test(name) &&
      (facts.hasRecursion || /(merge|mezcla|fusion).*(sort|orden)|(sort|orden).*(merge|mezcla|fusion)/.test(name)) ||
    (facts.hasRecursion &&
      /(merge|mezcla|fusion)/.test(text) &&
      /(temp|aux|merged|resultado)/.test(text));
  const quick =
    /(quick|rapido)/.test(name) ||
    (facts.hasRecursion && /(pivot|particion|partition)/.test(text));
  const heap =
    /(heap|monticulo)/.test(name) ||
    (facts.hasHeap && /(sort|orden)/.test(name));
  const counting =
    /(counting|conteo)/.test(name) ||
    (/count/.test(text) && /max\s*\(/.test(text) && facts.loopCount > 0);
  const radix = /(radix|raiz)/.test(name);
  const shell = /shell/.test(name);

  if (bubble) {
    return make(facts, {
      id: "bubble-sort",
      name: "Bubble sort",
      category: "Ordenamiento",
      time: QUADRATIC,
      space: ONE,
      confidence: /bubble|burbuja/.test(name) ? 0.97 : 0.78,
      summary:
        "Compara e intercambia vecinos en dos bucles anidados; el peor caso es cuadrático.",
      evidence: ["Dos bucles anidados con intercambio de elementos adyacentes."],
      notes: [
        "El mejor caso (lista ya ordenada) es O(n) si el algoritmo detecta que no hubo intercambios.",
        "Es estable y ordena in situ, pero no escala para n grandes.",
      ],
    });
  }

  if (insertion) {
    return make(facts, {
      id: "insertion-sort",
      name: "Insertion sort",
      category: "Ordenamiento",
      time: QUADRATIC,
      space: ONE,
      confidence: /insertion|insercion/.test(name) ? 0.97 : 0.8,
      summary:
        "Inserta cada elemento en la parte ordenada desplazando los mayores; O(n²) en el peor caso.",
      evidence: ["Bucle externo + while interno que desplaza elementos con una clave."],
      notes: [
        "Es O(n) cuando la entrada ya está casi ordenada.",
        "Es estable y ordena in situ.",
      ],
    });
  }

  if (selection) {
    return make(facts, {
      id: "selection-sort",
      name: "Selection sort",
      category: "Ordenamiento",
      time: QUADRATIC,
      space: ONE,
      confidence: /selection|seleccion/.test(name) ? 0.97 : 0.8,
      summary:
        "Busca el mínimo en el resto y lo coloca al inicio; siempre recorre el arreglo completo.",
      evidence: ["Selección del mínimo/máximo dentro de un bucle anidado."],
      notes: [
        "Hace O(n²) comparaciones incluso si la lista ya está ordenada.",
        "Ordena in situ y hace O(n) intercambios.",
      ],
    });
  }

  if (merge) {
    return make(facts, {
      id: "merge-sort",
      name: "Merge sort",
      category: "Ordenamiento",
      time: LINEARITHMIC,
      space: LINEAR,
      confidence:
        /(merge|mezcla|fusion)/.test(name) || input.recursion ? 0.96 : 0.72,
      summary:
        "Divide el arreglo a la mitad, ordena las partes y las fusiona en tiempo lineal por nivel.",
      evidence: ["Recursión sobre mitades + fusión de dos secuencias ordenadas."],
      notes: [
        "Estable y con O(n log n) garantizado, pero necesita O(n) memoria auxiliar.",
        "La recurrencia es T(n) = 2T(n/2) + O(n).",
      ],
      recurrence: {
        equation: "T(n) = 2·T(n/2) + O(n)",
        a: 2,
        b: 2,
        fLabel: "O(n)",
        method: "Teorema Maestro",
        master: {
          case: 2,
          exponent: 1,
          result: "O(n log n)",
          explanation:
            "log₂(2) = 1 y f(n) = n, así que el trabajo por nivel es constante: caso 2 del Teorema Maestro.",
        },
        levels: [
          { level: 0, nodes: "1", work: "n", total: "n" },
          { level: 1, nodes: "2", work: "n/2", total: "n" },
          { level: 2, nodes: "4", work: "n/4", total: "n" },
          { level: 3, nodes: "8", work: "n/8", total: "n" },
        ],
        height: "log₂ n",
        leaves: "n",
        spaceNote: "Cada nivel usa O(n) para fusionar; la pila es O(log n).",
      },
    });
  }

  if (quick) {
    return make(facts, {
      id: "quick-sort",
      name: "Quick sort",
      category: "Ordenamiento",
      time: LINEARITHMIC,
      space: LOG,
      confidence:
        /(quick|rapido)/.test(name) || /(pivot|particion|partition)/.test(text)
          ? 0.95
          : 0.7,
      summary:
        "Elige un pivote y particiona el arreglo; en promedio O(n log n), con peor caso O(n²).",
      evidence: ["Partición alrededor de un pivote + llamadas recursivas."],
      notes: [
        "El peor caso ocurre con pivotes muy desbalanceados: O(n²).",
        "La pila de recursión es O(log n) en promedio y O(n) en el peor caso.",
        "Ordena in situ y no es estable.",
      ],
      recurrence: {
        equation: "T(n) = T(k) + T(n-k-1) + O(n)",
        a: 2,
        b: 2,
        fLabel: "O(n)",
        method: "Expansión",
        levels: [
          { level: 0, nodes: "1", work: "n", total: "n" },
          { level: 1, nodes: "2", work: "n/2", total: "n" },
          { level: 2, nodes: "4", work: "n/4", total: "n" },
          { level: 3, nodes: "8", work: "n/8", total: "n" },
        ],
        height: "log₂ n promedio · n peor",
        leaves: "n",
        spaceNote:
          "La partición es in situ; solo la pila de recursión ocupa O(log n) promedio (O(n) en el peor caso).",
      },
    });
  }

  if (heap) {
    return make(facts, {
      id: "heap-sort",
      name: "Heap sort",
      category: "Ordenamiento",
      time: LINEARITHMIC,
      space: ONE,
      confidence: 0.92,
      summary:
        "Construye un heap y extrae el mínimo/máximo repetidamente; cada extracción cuesta O(log n).",
      evidence: ["Uso de heapq/heapify junto con extracciones repetidas."],
      notes: [
        "heapify cuesta O(n) y cada heappop O(log n): total O(n log n).",
        "Con heapq se usa O(n) de memoria auxiliar; el heapsort clásico ordena in situ.",
      ],
    });
  }

  if (counting) {
    return make(facts, {
      id: "counting-sort",
      name: "Counting sort",
      category: "Ordenamiento",
      time: N_TIMES_K,
      space: K_SPACE,
      confidence: 0.9,
      summary:
        "Cuenta frecuencias en un arreglo auxiliar y reconstruye la salida; depende del rango de valores.",
      evidence: ["Arreglo de conteo y recorrido para reconstruir la salida."],
      notes: [
        "Es O(n + k), donde k es el rango de valores; si k es enorme deja de ser eficiente.",
        "No es comparativo y es estable si se reconstruye con cuidado.",
      ],
    });
  }

  if (radix) {
    return make(facts, {
      id: "radix-sort",
      name: "Radix sort",
      category: "Ordenamiento",
      time: RADIX,
      space: LINEAR,
      confidence: 0.9,
      summary:
        "Ordena dígito por dígito usando un ordenamiento estable auxiliar; O(d·(n+b)).",
      evidence: ["Separación por dígitos (división/módulo por la base)."],
      notes: ["d es el número de dígitos y b la base; suele usarse con counting sort por dígito."],
    });
  }

  if (shell) {
    return make(facts, {
      id: "shell-sort",
      name: "Shell sort",
      category: "Ordenamiento",
      time: SHELL,
      space: ONE,
      confidence: 0.88,
      summary:
        "Insertion sort por saltos decrecientes; mejora el caso promedio del ordenamiento por inserción.",
      evidence: ["Bucle con un salto/gap que disminuye."],
      notes: ["Su complejidad exacta depende de la secuencia de saltos elegida."],
    });
  }

  if (named || sortingSignals(facts)) {
    const usesBuiltin = hasCall(facts, "sorted", "sort");
    const inPlace = facts.methodNames.has("sort") && !facts.callNames.has("sorted");

    return make(facts, {
      id: "generic-sort",
      name: usesBuiltin
        ? inPlace
          ? "Ordenamiento in situ (.sort)"
          : "Ordenamiento con sorted()"
        : "Ordenamiento",
      category: "Ordenamiento",
      time: usesBuiltin
        ? LINEARITHMIC
        : facts.maxLoopDepth >= 2
          ? QUADRATIC
          : LINEARITHMIC,
      space: usesBuiltin
        ? inPlace
          ? ONE
          : LINEAR
        : facts.maxLoopDepth >= 2
          ? ONE
          : LINEAR,
      confidence: usesBuiltin ? 0.9 : 0.6,
      summary: usesBuiltin
        ? inPlace
          ? "Ordena la propia lista con list.sort(); Timsort trabaja in situ."
          : "Ordena una copia de la colección con sorted(); Timsort usa O(n) de memoria."
        : "Se detectaron operaciones de ordenamiento, pero la firma no coincide con un algoritmo clásico.",
      evidence: [
        usesBuiltin
          ? "Llamada a sorted()/sort() (Timsort)."
          : "Nombre o llamadas relacionadas con ordenar.",
      ],
      notes: [
        usesBuiltin
          ? "Timsort es O(n log n) en el peor caso y O(n) si la entrada ya está ordenada."
          : "Revisa si el algoritmo ordena in situ o usa una copia auxiliar.",
      ],
    });
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Búsqueda                                                            */
/* ------------------------------------------------------------------ */

function detectSearch(input: DetectInput): Candidate | null {
  const { fn, facts, recursion } = input;
  const name = functionName(fn);
  const text = facts.composedText;

  const namedBinary = /(binar|binary|bsearch|bin_search)/.test(name);
  const namedLinear = /(linear|lineal|secuencial)/.test(name);
  const hasMid =
    /(^|[^a-z_])mid([^a-z_]|$)/.test(text) || /\bmedio\b/.test(text);
  const intervalWhile = /while\s+[^:]*\b(lo|low|left|inicio|izq)\b[^:]*<=?\s*[^:]*\b(hi|high|right|fin|der)\b/.test(
    text,
  );
  const recursiveBinary =
    !!recursion?.halving &&
    /(target|objetivo|buscar|search|encontrar)/.test(name + text);
  const usesBisect = hasCall(facts, "bisect", "bisect_left", "bisect_right");

  if (usesBisect) {
    // bisect_left/right localizan la posición en O(log n). Si además se
    // inserta en una lista, el desplazamiento de elementos cuesta O(n).
    const inserts = facts.methodNames.has("insert");
    return make(facts, {
      id: "bisect-search",
      name: "Búsqueda binaria con bisect",
      category: "Búsqueda",
      time: inserts ? LINEAR : LOG,
      space: ONE,
      confidence: 0.9,
      summary: inserts
        ? "bisect localiza la posición en O(log n), pero list.insert desplaza elementos y cuesta O(n)."
        : "bisect_left/bisect_right mantienen el orden y encuentran la posición en O(log n).",
      evidence: [
        inserts
          ? "bisect_left/right sobre una lista ordenada + inserción con list.insert."
          : "bisect_left/right sobre una colección ordenada.",
      ],
      notes: [
        "bisect requiere que la colección ya esté ordenada.",
        inserts
          ? "Para inserciones masivas, considera otra estructura o insertar al final y ordenar una sola vez."
          : "La búsqueda es O(log n) y no crea estructuras auxiliares.",
      ],
    });
  }

  if (namedBinary || recursiveBinary || (hasMid && intervalWhile)) {
    return make(facts, {
      id: "binary-search",
      name: "Búsqueda binaria",
      category: "Búsqueda",
      time: LOG,
      space: recursion ? LOG : ONE,
      confidence: namedBinary || recursiveBinary ? 0.98 : 0.86,
      summary:
        "Descarta la mitad del espacio de búsqueda en cada paso; requiere datos ordenados.",
      evidence: [
        "Intervalo [lo, hi] reducido con mid y comparaciones contra el objetivo.",
      ],
      notes: [
        "Si la entrada no está ordenada, primero hay que ordenarla: O(n log n).",
        "La versión iterativa usa O(1) de memoria; la recursiva O(log n) de pila.",
      ],
      recurrence: recursion?.halving
        ? {
            equation: "T(n) = T(n/2) + O(1)",
            a: 1,
            b: 2,
            fLabel: "O(1)",
            method: "Teorema Maestro",
            master: {
              case: 2,
              exponent: 0,
              result: "O(log n)",
              explanation:
                "log₂(1) = 0 y f(n) = 1: cada nivel hace trabajo constante y hay log₂ n niveles.",
            },
            levels: [
              { level: 0, nodes: "1", work: "1", total: "1" },
              { level: 1, nodes: "1", work: "1", total: "1" },
              { level: 2, nodes: "1", work: "1", total: "1" },
              { level: 3, nodes: "1", work: "1", total: "1" },
            ],
            height: "log₂ n",
            leaves: "1",
            spaceNote: "Solo se conserva un intervalo; la pila recursiva es O(log n).",
          }
        : undefined,
    });
  }

  if (
    namedLinear ||
    (facts.maxLoopDepth === 1 &&
      /==|!=|<=|>=/.test(facts.comparisonsText) &&
      /return/.test(text) &&
      !facts.hasAdjacency) ||
    (/\bin\s+[A-Za-z_]/.test(facts.comparisonsText) && namedLinear)
  ) {
    return make(facts, {
      id: "linear-search",
      name: "Búsqueda lineal",
      category: "Búsqueda",
      time: LINEAR,
      space: ONE,
      confidence: namedLinear ? 0.95 : 0.7,
      summary:
        "Recorre la colección elemento por elemento hasta encontrar el objetivo.",
      evidence: ["Recorrido secuencial con comparación y retorno."],
      notes: [
        "En el peor caso revisa los n elementos; en el mejor, el primero.",
        "`x in lista` también es O(n); sobre set/dict es O(1) promedio.",
      ],
    });
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Grafos                                                              */
/* ------------------------------------------------------------------ */

function detectGraph(input: DetectInput): Candidate | null {
  const { fn, facts } = input;
  const name = functionName(fn);
  const text = facts.composedText;
  const adjacency = facts.hasAdjacency;
  const visited = facts.hasVisited;
  const heap = facts.hasHeap;
  const queue = facts.hasQueue;
  const unionFind = facts.hasUnionFind;
  const graphName =
    /(bfs|breadth|dfs|depth_first|dijkstra|bellman|floyd|warshall|kruskal|prim|topolog|tarjan|kosaraju|astar|a_star|graph|grafo)/.test(
      name,
    );

  const nxCalls = [...facts.callNames].filter((call) =>
    /^(shortest_path|shortest_path_length|bfs_edges|bfs_tree|dfs_edges|dfs_tree|dijkstra_path|dijkstra_path_length|astar_path|minimum_spanning_tree|minimum_spanning_edges|connected_components|topological_sort|pagerank)$/.test(
      call,
    ),
  );
  const usesNetworkx =
    nxCalls.length > 0 &&
    facts.imports.some((name) => name.toLowerCase().includes("networkx"));

  if (!graphName && !adjacency && !unionFind && !usesNetworkx) return null;

  if (usesNetworkx) {
    const joined = nxCalls.join(" ");
    const weighted = /dijkstra|astar|minimum_spanning/.test(joined);
    const traversal = /shortest_path|bfs_|dfs_|connected|topological/.test(joined);
    const nameLabel = /dijkstra/.test(joined)
      ? "Dijkstra con NetworkX"
      : /astar/.test(joined)
        ? "A* con NetworkX"
        : /minimum_spanning/.test(joined)
          ? "Árbol de expansión mínima con NetworkX"
          : /shortest_path/.test(joined)
            ? "Camino más corto con NetworkX"
            : /bfs_/.test(joined)
              ? "BFS con NetworkX"
              : /dfs_/.test(joined)
                ? "DFS con NetworkX"
                : "Algoritmo de grafos con NetworkX";

    return make(facts, {
      id: "networkx",
      name: nameLabel,
      category: "Grafos",
      time: weighted
        ? E_LOG_V
        : traversal
          ? V_PLUS_E
          : customCost("según la función de NetworkX", 30, "nlog"),
      space: LINEAR,
      confidence: 0.84,
      summary:
        "Delega el recorrido o el cálculo de caminos en NetworkX; el costo es el de la función de la biblioteca.",
      evidence: [
        `Importa NetworkX y llama a ${nxCalls.map((call) => `${call}()`).join(", ")}.`,
      ],
      notes: [
        "NetworkX implementa los recorridos en Python/C; el análisis mide la llamada tal como está escrita.",
        "El costo real depende de la representación del grafo y de la función concreta.",
        weighted
          ? "Las variantes con pesos usan colas de prioridad: O(E log V) típicamente."
          : "Los recorridos BFS/DFS y el camino más corto no ponderado cuestan O(V+E).",
      ],
    });
  }

  if (
    /(floyd|warshall)/.test(name) ||
    (facts.maxLoopDepth >= 3 &&
      /\[i\]\s*\[j\]/.test(text) &&
      /\[i\]\s*\[k\]/.test(text) &&
      /\[k\]\s*\[j\]/.test(text))
  ) {
    return make(facts, {
      id: "floyd-warshall",
      name: "Floyd-Warshall",
      category: "Grafos",
      time: V_CUBED,
      space: QUADRATIC,
      confidence: /(floyd|warshall)/.test(name) ? 0.98 : 0.86,
      summary:
        "Calcula todos los caminos mínimos con tres bucles sobre la matriz de distancias.",
      evidence: ["Tres bucles anidados sobre dist[i][j] usando un vértice intermedio k."],
      notes: [
        "Funciona con pesos negativos, pero no con ciclos negativos.",
        "La matriz de distancias ocupa O(V²).",
      ],
    });
  }

  const bellman =
    /(bellman|ford)/.test(name) ||
    (adjacency &&
      /(edges|aristas)/.test(text) &&
      /range\s*\([^)]*-\s*1\s*\)/.test(text) &&
      facts.maxLoopDepth >= 2);
  if (bellman) {
    return make(facts, {
      id: "bellman-ford",
      name: "Bellman-Ford",
      category: "Grafos",
      time: V_TIMES_E,
      space: LINEAR,
      confidence: /(bellman|ford)/.test(name) ? 0.98 : 0.84,
      summary:
        "Relaja todas las aristas V-1 veces; detecta ciclos negativos en una pasada extra.",
      evidence: ["Bucle de V-1 rondas sobre la lista de aristas y relajación de distancias."],
      notes: [
        "Soporta pesos negativos; Dijkstra no.",
        "Con matriz de adyacencia el recorrido de aristas puede elevar el costo a O(V³).",
      ],
    });
  }

  const dijkstra =
    /dijkstra/.test(name) ||
    (heap && adjacency && /(dist|distance|distancia)/.test(text));
  if (dijkstra) {
    return make(facts, {
      id: "dijkstra",
      name: "Dijkstra",
      category: "Grafos",
      time: heap ? E_LOG_V : V_SQUARED,
      space: LINEAR,
      confidence: /dijkstra/.test(name) ? 0.99 : 0.9,
      summary: heap
        ? "Extrae siempre el vértice de menor distancia con una cola de prioridad."
        : "Selecciona el vértice no visitado de menor distancia en cada iteración.",
      evidence: [
        "Distancias + relajación de vecinos.",
        heap ? "Cola de prioridad (heapq)." : "Selección lineal del mínimo no visitado.",
      ],
      notes: [
        "Con heap: O((V+E) log V). Sin heap: O(V²).",
        "No admite aristas de peso negativo.",
      ],
    });
  }

  const prim =
    /prim/.test(name) ||
    (heap &&
      visited &&
      adjacency &&
      !/(dist|distance|distancia)/.test(text) &&
      !/dijkstra/.test(name));
  if (prim) {
    return make(facts, {
      id: "prim",
      name: "Prim",
      category: "Grafos",
      time: heap ? E_LOG_V : V_SQUARED,
      space: LINEAR,
      confidence: /prim/.test(name) ? 0.98 : 0.82,
      summary:
        "Construye el árbol de expansión mínima agregando el vértice más barato conectado al árbol.",
      evidence: [
        "Conjunto de visitados + selección del borde de menor peso.",
        heap ? "Cola de prioridad para elegir el borde mínimo." : "",
      ].filter(Boolean),
      notes: [
        "Con heap: O(E log V). Con búsqueda lineal del mínimo: O(V²).",
        "Funciona en grafos conexos no dirigidos.",
      ],
    });
  }

  const kruskal =
    /kruskal/.test(name) ||
    (unionFind && (hasCall(facts, "sorted", "sort") || /(edges|aristas)/.test(text)));
  if (kruskal) {
    return make(facts, {
      id: "kruskal",
      name: "Kruskal",
      category: "Grafos",
      time: E_LOG_E,
      space: LINEAR,
      confidence: /kruskal/.test(name) ? 0.99 : 0.9,
      summary:
        "Ordena las aristas por peso y las une con Union-Find evitando ciclos.",
      evidence: [
        "Aristas ordenadas + find/union (Union-Find).",
        "La unión usa compresión de caminos y unión por rango.",
      ],
      notes: [
        "Ordenar las aristas domina el costo: O(E log E).",
        "Union-Find aporta O(α(V)) amortizado por operación.",
      ],
    });
  }

  const topological =
    /topolog/.test(name) ||
    ((queue || facts.hasStack) &&
      /(indegree|in_degree|grado_entrada|degree|grados)/.test(text));
  if (topological) {
    return make(facts, {
      id: "topological-sort",
      name: "Ordenamiento topológico",
      category: "Grafos",
      time: V_PLUS_E,
      space: LINEAR,
      confidence: /topolog/.test(name) ? 0.98 : 0.88,
      summary:
        "Procesa los vértices según su grado de entrada; solo existe en grafos dirigidos acíclicos.",
      evidence: ["Grados de entrada + cola/pila de vértices listos para procesar."],
      notes: [
        "Si al terminar quedan vértices sin procesar, el grafo tiene un ciclo.",
        "También puede resolverse con DFS y orden de finalización.",
      ],
    });
  }

  const tarjan =
    /(tarjan|kosaraju)/.test(name) ||
    (adjacency && facts.hasRecursion && /(low|disc|discovery|descubrimiento)/.test(text));
  if (tarjan) {
    return make(facts, {
      id: "tarjan",
      name: /kosaraju/.test(name) ? "Kosaraju" : "Tarjan",
      category: "Grafos",
      time: V_PLUS_E,
      space: LINEAR,
      confidence: 0.9,
      summary:
        "Encuentra componentes fuertemente conexas con una DFS y arreglos de descubrimiento/bajo.",
      evidence: ["Recursión DFS + arreglos low/disc (o dos pasadas en Kosaraju)."],
      notes: ["Cada arista y vértice se procesa un número constante de veces."],
    });
  }

  if (/astar|a_star/.test(name) || (heap && /(heuristic|heuristica)/.test(text))) {
    return make(facts, {
      id: "a-star",
      name: "A*",
      category: "Grafos",
      time: E_LOG_V,
      space: LINEAR,
      confidence: /astar|a_star/.test(name) ? 0.98 : 0.82,
      summary:
        "Dijkstra guiado por una heurística; con una heurística admisible encuentra el camino óptimo.",
      evidence: ["Cola de prioridad + costo acumulado g(n) + heurística h(n)."],
      notes: [
        "El costo depende de la heurística; en el peor caso explora todo el grafo.",
        "Con h(n)=0 se reduce a Dijkstra.",
      ],
    });
  }

  if (/bfs|breadth/.test(name) || (queue && (visited || adjacency))) {
    const popZero = /\.pop\s*\(\s*0\s*\)/.test(text);
    return make(facts, {
      id: "bfs",
      name: "BFS (recorrido en anchura)",
      category: "Grafos",
      time: popZero
        ? customCost("O(V² + E)", 52, "n2")
        : V_PLUS_E,
      space: LINEAR,
      confidence: /bfs|breadth/.test(name) ? 0.99 : 0.88,
      summary:
        "Explora el grafo por niveles usando una cola; cada vértice y arista se visita una vez.",
      evidence: [
        popZero
          ? "Cola implementada con list.pop(0) + visitados + lista de adyacencia."
          : "Cola (deque) + conjunto de visitados + lista de adyacencia.",
      ],
      notes: [
        "En grafos no ponderados, BFS encuentra el camino con menos aristas.",
        "El espacio es O(V) para la cola y los visitados.",
        popZero
          ? "list.pop(0) desplaza todos los elementos: cada extracción cuesta O(V), así que la cola domina el costo. Usa collections.deque + popleft() para lograr O(V+E)."
          : "deque.popleft() es O(1); con list.pop(0) el costo subiría a O(V² + E).",
      ],
    });
  }

  if (
    /(dfs|depth_first)/.test(name) ||
    (facts.hasRecursion && adjacency) ||
    (facts.hasStack && visited)
  ) {
    return make(facts, {
      id: "dfs",
      name: "DFS (recorrido en profundidad)",
      category: "Grafos",
      time: V_PLUS_E,
      space: LINEAR,
      confidence: /(dfs|depth_first)/.test(name) ? 0.99 : 0.84,
      summary:
        "Explora hasta el fondo antes de retroceder; visita cada vértice y arista una vez.",
      evidence: [
        facts.hasRecursion ? "Recursión sobre vecinos." : "Pila explícita.",
        "Conjunto de visitados.",
      ],
      notes: [
        "La pila de recursión puede llegar a O(V) en un grafo profundo.",
        "Sirve para detectar ciclos, orden topológico y componentes conexas.",
      ],
    });
  }

  if (adjacency && (visited || graphName)) {
    return make(facts, {
      id: "graph-traversal",
      name: "Recorrido de grafo",
      category: "Grafos",
      time: V_PLUS_E,
      space: LINEAR,
      confidence: 0.62,
      summary:
        "Recorre vértices y aristas apoyándose en una lista de adyacencia y un conjunto de visitados.",
      evidence: ["Estructura de adyacencia y control de visitados."],
      notes: ["El costo O(V+E) asume representación por listas de adyacencia."],
    });
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Árboles                                                             */
/* ------------------------------------------------------------------ */

function detectTrees(input: DetectInput): Candidate | null {
  const { fn, facts } = input;
  const name = functionName(fn);
  const text = facts.composedText;
  const treeName =
    /(tree|arbol|bst|avl|segment|fenwick|trie|lca|ancestor|inorder|preorder|postorder|inorden|preorden|postorden|recorrido|traversal)/.test(
      name,
    );

  if (!treeName && !facts.hasTreeLinks) return null;

  if (
    /(trie|prefix|prefijo)/.test(name) ||
    (/children|child/.test(text) && /(is_end|end|terminal|word)/.test(text))
  ) {
    return make(facts, {
      id: "trie",
      name: "Trie (árbol de prefijos)",
      category: "Árboles",
      time: TRIE,
      space: LINEAR,
      confidence: /(trie|prefix|prefijo)/.test(name) ? 0.95 : 0.78,
      summary:
        "Inserta/busca palabras recorriendo un nodo por carácter; el costo depende de la longitud L.",
      evidence: ["Hijos por carácter + marca de fin de palabra."],
      notes: [
        "Insertar/buscar una palabra es O(L), no O(n) por el número de palabras.",
        "El espacio total es O(suma de longitudes) en el peor caso.",
      ],
    });
  }

  if (
    /(segment)/.test(name) ||
    (/tree\s*\[/.test(text) && /(2\s*\*|<<\s*1|\*\s*2)/.test(text))
  ) {
    return make(facts, {
      id: "segment-tree",
      name: "Segment Tree",
      category: "Árboles",
      time: LOG,
      space: LINEAR,
      confidence: /segment/.test(name) ? 0.96 : 0.8,
      summary:
        "Consulta/actualiza rangos en O(log n) recorriendo el árbol de segmentos.",
      evidence: ["Árbol almacenado en arreglo con hijos 2·i y 2·i+1."],
      notes: [
        "Construir el árbol cuesta O(n); cada consulta o actualización O(log n).",
        "El arreglo del árbol ocupa O(n) (habitualmente 4n).",
      ],
    });
  }

  if (
    /fenwick/.test(name) ||
    /(\w+)\s*&\s*-\s*\1/.test(text) ||
    /&\s*\(\s*-/.test(text)
  ) {
    return make(facts, {
      id: "fenwick",
      name: "Fenwick Tree (BIT)",
      category: "Árboles",
      time: LOG,
      space: LINEAR,
      confidence: /fenwick/.test(name)
        ? 0.95
        : /(\w+)\s*&\s*-\s*\1/.test(text)
          ? 0.8
          : 0.6,
      summary:
        "Actualiza y consulta sumas de prefijos en O(log n) usando el bit menos significativo.",
      evidence: ["Operaciones con i & -i y actualización de índices."],
      notes: [
        "Construir el BIT cuesta O(n log n) o O(n) con una técnica especial.",
        "Es más compacto que un segment tree, pero menos flexible.",
      ],
    });
  }

  if (
    /(lca|ancestor|ancestro)/.test(name) ||
    /(lowest_common_ancestor|ancestro_comun)/.test(text)
  ) {
    return make(facts, {
      id: "lca",
      name: "LCA (ancestro común más bajo)",
      category: "Árboles",
      time: LOG,
      space: LINEAR,
      confidence: 0.9,
      summary:
        "Sube por el árbol desde ambos nodos para encontrar su ancestro común más bajo.",
      evidence: ["Comparación de profundidades/ancestros de dos nodos."],
      notes: [
        "Con binario lifting (tabla de ancestros) cada consulta es O(log n).",
        "La versión ingenua puede ser O(n) por consulta.",
      ],
    });
  }

  if (/avl/.test(name) || /(balance|rotat|rotacion)/.test(text)) {
    return make(facts, {
      id: "avl",
      name: "AVL",
      category: "Árboles",
      time: BST_AVERAGE,
      space: LINEAR,
      confidence: /avl/.test(name) ? 0.96 : 0.76,
      summary:
        "Árbol binario de búsqueda balanceado; las rotaciones mantienen la altura en O(log n).",
      evidence: ["Cálculo de alturas/balance y rotaciones."],
      notes: [
        "La altura se mantiene O(log n), así que buscar/insertar es O(log n).",
        "La recursión de inserción/eliminación usa O(log n) de pila.",
      ],
    });
  }

  if (
    /(inorder|preorder|postorder|inorden|preorden|postorden|traversal|recorrido)/.test(
      name,
    )
  ) {
    return make(facts, {
      id: "tree-traversal",
      name: "Recorrido de árbol",
      category: "Árboles",
      time: LINEAR,
      space: LINEAR,
      confidence: 0.95,
      summary:
        "Visita cada nodo del árbol exactamente una vez siguiendo el orden del recorrido.",
      evidence: ["Recursión sobre hijo izquierdo/derecho (o pila explícita)."],
      notes: [
        "Tiempo O(n); el espacio es O(h) de pila, que puede ser O(n) en un árbol degenerado.",
        "Inorden en un BST produce los valores ordenados.",
      ],
    });
  }

  if (
    /(bst|binary_search_tree|arbol_binario)/.test(name) ||
    (facts.hasTreeLinks &&
      /(insert|search|find|delete|buscar|insertar|eliminar)/.test(name))
  ) {
    const iterative = /while/.test(text) && !facts.hasRecursion;
    return make(facts, {
      id: "bst",
      name: "BST (árbol binario de búsqueda)",
      category: "Árboles",
      time: BST_AVERAGE,
      space: iterative ? ONE : LINEAR,
      confidence: /(bst|binary_search_tree)/.test(name) ? 0.96 : 0.8,
      summary:
        "Desciende por el árbol comparando con la clave; O(log n) si está balanceado.",
      evidence: ["Comparaciones con la clave + enlaces izquierda/derecha."],
      notes: [
        "El peor caso es O(n) si el árbol queda degenerado (por ejemplo, insertando datos ordenados).",
        iterative
          ? "La versión iterativa usa O(1) de memoria."
          : "La versión recursiva usa O(h) de pila.",
      ],
    });
  }

  if (facts.hasTreeLinks && facts.hasRecursion) {
    return make(facts, {
      id: "tree-recursion",
      name: "Recursión sobre árbol",
      category: "Árboles",
      time: LINEAR,
      space: LINEAR,
      confidence: 0.72,
      summary:
        "Recorre los hijos de cada nodo; cada nodo se procesa una vez.",
      evidence: ["Llamadas recursivas sobre enlaces izquierda/derecha."],
      notes: ["El espacio de pila es O(h); en el peor caso h = n."],
    });
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Programación dinámica                                               */
/* ------------------------------------------------------------------ */

function detectDynamic(input: DetectInput): Candidate | null {
  const { fn, facts, recursion } = input;
  const name = functionName(fn);
  const text = facts.composedText;
  const memoized = facts.hasMemoDecorator || facts.hasMemoTable;
  const dpSignal =
    facts.hasDpTable ||
    memoized ||
    /(dp|memo|tabla|table)\s*\[/.test(text) ||
    /(dp|memo|tabla|table)\s*=/.test(text);

  if (!dpSignal) return null;

  const knapsack =
    /(knapsack|mochila)/.test(name) ||
    (/(capacity|capacidad)/.test(text) && /(weight|peso|value|valor)/.test(text));
  if (knapsack) {
    const oneDimensional = !/\[\s*\[/.test(text) || /dp\s*=\s*\[0\]\s*\*/.test(text);
    return make(facts, {
      id: "knapsack",
      name: "Knapsack 0/1",
      category: "Programación dinámica",
      time: N_TIMES_W,
      space: oneDimensional ? LINEAR_M : N_TIMES_W,
      confidence: 0.95,
      summary:
        "Llena una tabla de capacidad/objetos decidiendo incluir o no cada elemento.",
      evidence: ["Tabla dp sobre objetos y capacidad + transición max(no tomar, tomar)."],
      notes: [
        "Tiempo O(n·W) y espacio O(n·W); puede reducirse a O(W) con una sola fila.",
        "W es la capacidad, no el número de elementos.",
      ],
    });
  }

  if (
    /(lcs|longest_common|edit_distance|levenshtein|distancia)/.test(name)
  ) {
    return make(facts, {
      id: "sequence-dp",
      name: /(edit|levenshtein|distancia)/.test(name)
        ? "Edit distance"
        : "LCS (subsecuencia común más larga)",
      category: "Programación dinámica",
      time: N_TIMES_M,
      space: N_TIMES_M,
      confidence: 0.95,
      summary:
        "Compara dos secuencias posición por posición usando una tabla de prefijos.",
      evidence: ["Tabla 2D indexada por prefijos de ambas cadenas."],
      notes: [
        "Tiempo y espacio O(n·m); el espacio puede bajar a O(min(n,m)) guardando dos filas.",
        "Cada celda depende de la diagonal y de las celdas vecinas.",
      ],
    });
  }

  if (/(lis|longest_increasing|subsecuencia.*creciente)/.test(name)) {
    const fast = hasCall(facts, "bisect", "bisect_left", "bisect_right");
    return make(facts, {
      id: "lis",
      name: "LIS (subsecuencia creciente más larga)",
      category: "Programación dinámica",
      time: fast ? LINEARITHMIC : QUADRATIC,
      space: LINEAR,
      confidence: 0.95,
      summary: fast
        ? "Mantiene las colas mínimas y usa búsqueda binaria para insertar cada elemento."
        : "Calcula la mejor longitud terminando en cada posición con dos bucles.",
      evidence: [fast ? "Uso de bisect sobre colas ordenadas." : "Tabla dp + doble recorrido."],
      notes: [
        fast ? "La variante con paciencia/bisect es O(n log n)." : "La versión DP clásica es O(n²).",
        "El espacio es O(n) para la tabla/colas.",
      ],
    });
  }

  if (/(coin|moneda|cambio)/.test(name)) {
    const twoDimensional = /\[\s*\[/.test(text);
    return make(facts, {
      id: "coin-change",
      name: "Coin change",
      category: "Programación dinámica",
      time: N_TIMES_AMOUNT,
      space: twoDimensional ? N_TIMES_AMOUNT : LINEAR,
      confidence: 0.94,
      summary:
        "Calcula el mínimo de monedas (o el número de formas) para cada monto.",
      evidence: ["Tabla dp sobre montos + transición usando cada moneda."],
      notes: [
        "Tiempo O(n·amount), donde n es el número de monedas.",
        "Con una tabla 1D el espacio es O(amount).",
      ],
    });
  }

  if (/(matrix_chain|cadena.*matriz|multiplicacion.*matriz)/.test(name)) {
    return make(facts, {
      id: "matrix-chain",
      name: "Matrix chain multiplication",
      category: "Programación dinámica",
      time: CUBIC,
      space: QUADRATIC,
      confidence: 0.93,
      summary:
        "Prueba todos los puntos de corte para minimizar el costo de multiplicar una cadena de matrices.",
      evidence: ["Tabla 2D + tres bucles sobre longitudes y puntos de corte."],
      notes: ["Tiempo O(n³) y espacio O(n²)."],
    });
  }

  if (memoized && recursion) {
    return make(facts, {
      id: "memoization",
      name: "Recursión con memoización",
      category: "Programación dinámica",
      time: recursion.time,
      space: recursion.space,
      confidence: 0.96,
      summary:
        "La memoización guarda cada estado y evita recalcular subproblemas repetidos.",
      evidence: [
        "La función es recursiva y guarda resultados en memo/cache o usa @lru_cache.",
      ],
      notes: [
        "El costo pasa de exponencial a (número de estados × trabajo por estado).",
        "El espacio incluye la tabla de memo y la pila de recursión.",
      ],
      recurrence: recursion.recurrence,
    });
  }

  const dimensions = input.estimate.dimensions;
  if (dimensions > 0) {
    const time =
      dimensions >= 3 ? CUBIC : dimensions === 2 ? N_TIMES_M : LINEAR;
    const space =
      dimensions >= 3 ? QUADRATIC : dimensions === 2 ? N_TIMES_M : LINEAR;
    return make(facts, {
      id: "tabulation",
      name: "Programación dinámica (tabulación)",
      category: "Programación dinámica",
      time,
      space,
      confidence: 0.8,
      summary:
        "Rellena una tabla de estados de forma iterativa para evitar recomputar subproblemas.",
      evidence: ["Tabla dp/tabla construida con bucles."],
      notes: [
        dimensions >= 2
          ? "El costo es el producto de las dimensiones de la tabla."
          : "El costo es lineal en el número de estados.",
        "Revisa si es posible reducir el espacio a una o dos filas.",
      ],
    });
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Backtracking                                                        */
/* ------------------------------------------------------------------ */

function detectBacktracking(input: DetectInput): Candidate | null {
  const { fn, facts } = input;
  const name = functionName(fn);
  const named =
    /(nqueens|n_queens|queens|reinas|sudoku|permut|subset|subconjunto|combination|combinacion|backtrack|vuelta_atras)/.test(
      name,
    );
  const usesItertools = hasCall(
    facts,
    "permutations",
    "combinations",
    "combinations_with_replacement",
    "product",
  );
  const structural =
    facts.hasRecursion &&
    facts.hasBacktracking &&
    (facts.maxLoopDepth >= 1 || facts.hasMatrix);

  if (!named && !structural && !usesItertools) return null;

  if (/sudoku/.test(name)) {
    return make(facts, {
      id: "sudoku",
      name: "Sudoku (backtracking)",
      category: "Backtracking",
      time: SUDOKU,
      space: LINEAR,
      confidence: 0.97,
      summary:
        "Prueba números en cada celda vacía y retrocede cuando una elección no es válida.",
      evidence: ["Matriz del tablero + recursión con prueba/retroceso."],
      notes: [
        "El peor caso es exponencial en el número de celdas vacías.",
        "La poda por filas, columnas y cajas reduce muchísimo el espacio de búsqueda.",
      ],
    });
  }

  if (/(nqueens|n_queens|queens|reinas)/.test(name)) {
    return make(facts, {
      id: "n-queens",
      name: "N-Queens",
      category: "Backtracking",
      time: N_QUEENS,
      space: LINEAR,
      confidence: 0.98,
      summary:
        "Coloca una reina por fila y retrocede cuando la posición entra en conflicto.",
      evidence: ["Recursión por filas + tablero/columnas/diagonales."],
      notes: [
        "Sin poda el árbol tendría n^n hojas; con validación se aproxima a O(n!).",
        "El estado mutable (tablero, columnas, diagonales) ocupa O(n).",
      ],
    });
  }

  if (/(permut)/.test(name)) {
    return make(facts, {
      id: "permutations",
      name: "Permutaciones (backtracking)",
      category: "Backtracking",
      time: FACTORIAL,
      space: LINEAR,
      confidence: 0.97,
      summary:
        "Genera todas las permutaciones eligiendo un elemento libre y deshaciendo la elección.",
      evidence: ["Recursión + conjunto de usados/append-pop."],
      notes: [
        "Hay n! permutaciones; el costo de construir cada una añade un factor O(n).",
        "El espacio es O(n) por la profundidad y el estado de usados.",
      ],
    });
  }

  if (/(subset|subconjunto|combination|combinacion)/.test(name)) {
    return make(facts, {
      id: "subsets",
      name: "Subconjuntos / combinaciones",
      category: "Backtracking",
      time: EXPONENTIAL,
      space: LINEAR,
      confidence: 0.95,
      summary:
        "Explora incluir o excluir cada elemento; genera 2^n subconjuntos en el caso completo.",
      evidence: ["Recursión con dos ramas (tomar/no tomar) o combinaciones."],
      notes: [
        "El número de subconjuntos es 2^n; el de combinaciones C(n,k).",
        "La profundidad y el estado mutable son O(n).",
      ],
    });
  }

  if (usesItertools) {
    const permutations = hasCall(facts, "permutations");
    const product = hasCall(facts, "product", "combinations_with_replacement");
    const combinationCall = fn.calls.find(
      (call) => call.name.toLowerCase() === "combinations",
    );
    const fixedK = Number.parseInt(combinationCall?.args[1]?.trim() ?? "", 10);
    const time = permutations
      ? FACTORIAL
      : product
        ? EXPONENTIAL
        : Number.isFinite(fixedK) && fixedK > 0
          ? fixedK === 2
            ? QUADRATIC
            : customCost(
                `O(n${fixedK === 3 ? "³" : `^${fixedK}`})`,
                20 * Math.min(fixedK, 4),
                fixedK >= 3 ? "n3" : "n2",
              )
          : EXPONENTIAL;

    return make(facts, {
      id: "itertools-enumeration",
      name: "Enumeración combinatoria (itertools)",
      category: "Backtracking",
      time,
      space: LINEAR,
      confidence: 0.9,
      summary:
        "Genera permutaciones, combinaciones o productos con itertools en lugar de escribir el retroceso a mano.",
      evidence: [
        `Usa itertools.${permutations ? "permutations" : product ? "product" : "combinations"}().`,
      ],
      notes: [
        "itertools genera los resultados de forma perezosa, pero materializar la lista cuesta O(n) por resultado.",
        permutations
          ? "Hay n! permutaciones."
          : product
            ? "El producto cartesiano crece como el producto de los tamaños de cada iterable."
            : "El número de combinaciones es C(n,k); para k fijo es polinómico y para k variable puede ser exponencial.",
        "El espacio auxiliar de cada resultado es O(k) más la lista construida.",
      ],
    });
  }

  return make(facts, {
    id: "backtracking",
    name: "Backtracking",
    category: "Backtracking",
    time: EXPONENTIAL,
    space: LINEAR,
    confidence: 0.72,
    summary:
      "Explora decisiones y retrocede cuando una rama no puede llevar a una solución válida.",
    evidence: ["Recursión + modificación/restauración de estado."],
    notes: [
      "El costo depende del factor de ramificación y de la poda.",
      "El espacio es O(profundidad) más el estado mutable.",
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Greedy                                                              */
/* ------------------------------------------------------------------ */

function detectGreedy(input: DetectInput): Candidate | null {
  const { fn, facts } = input;
  const name = functionName(fn);
  const named =
    /(greedy|voraz|activity|actividad|interval|intervalo|huffman|coin_greedy|moneda_greedy)/.test(
      name,
    );

  if (!named && !(facts.hasGreedySort && facts.loopCount > 0)) return null;

  if (/huffman/.test(name)) {
    return make(facts, {
      id: "huffman",
      name: "Huffman",
      category: "Greedy",
      time: LINEARITHMIC,
      space: LINEAR,
      confidence: 0.97,
      summary:
        "Fusiona repetidamente los dos nodos de menor frecuencia usando una cola de prioridad.",
      evidence: ["Heap + fusión de los dos menores."],
      notes: [
        "Hay n-1 fusiones y cada una cuesta O(log n) con heap.",
        "El árbol resultante ocupa O(n).",
      ],
    });
  }

  if (/(activity|actividad|interval|intervalo)/.test(name)) {
    return make(facts, {
      id: "activity-selection",
      name: "Activity selection / interval scheduling",
      category: "Greedy",
      time: LINEARITHMIC,
      space: ONE,
      confidence: 0.96,
      summary:
        "Ordena por tiempo de finalización y elige siempre la actividad que termina antes.",
      evidence: ["Ordenamiento por fin + recorrido seleccionando intervalos compatibles."],
      notes: [
        "El ordenamiento domina el costo: O(n log n).",
        "La elección local (terminar antes) es óptima para este problema.",
      ],
    });
  }

  if (named) {
    return make(facts, {
      id: "greedy",
      name: "Greedy",
      category: "Greedy",
      time: facts.hasGreedySort ? LINEARITHMIC : LINEAR,
      space: ONE,
      confidence: 0.8,
      summary:
        "Toma la mejor opción local en cada paso; requiere demostrar que conduce al óptimo global.",
      evidence: ["Recorrido con decisiones locales y sin retroceso."],
      notes: [
        "No todos los problemas admiten una estrategia greedy óptima.",
        "El costo suele ser el del ordenamiento inicial más un recorrido lineal.",
      ],
    });
  }

  if (facts.hasGreedySort) {
    return make(facts, {
      id: "sort-and-scan",
      name: "Ordenar y recorrer (greedy)",
      category: "Greedy",
      time: LINEARITHMIC,
      space: LINEAR,
      confidence: 0.66,
      summary:
        "Ordena la entrada y toma decisiones locales en un recorrido posterior.",
      evidence: ["sorted()/sort() seguido de un recorrido sin retroceso."],
      notes: [
        "El ordenamiento aporta O(n log n); el recorrido suele ser O(n).",
        "No se detectó backtracking ni tabla DP.",
      ],
    });
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Divide y vencerás + recursión                                       */
/* ------------------------------------------------------------------ */

function detectRecursion(input: DetectInput): Candidate | null {
  const { fn, facts, recursion } = input;
  if (!recursion) return null;

  const name = functionName(fn);

  if (/(pow|potencia|exponenciacion|fast_power|power)/.test(name) && recursion.halving) {
    return make(facts, {
      id: "fast-power",
      name: "Exponenciación rápida",
      category: "Divide y vencerás",
      time: LOG,
      space: LOG,
      confidence: 0.96,
      summary:
        "Reduce el exponente a la mitad en cada llamada; solo hay O(log n) niveles.",
      evidence: ["Recursión sobre n//2 y combinación de resultados."],
      notes: [
        "La recurrencia es T(n) = T(n/2) + O(1), por lo que T(n) = O(log n).",
        "La pila recursiva también es O(log n).",
      ],
      recurrence: recursion.recurrence,
    });
  }

  if (recursion.halving) {
    return make(facts, {
      id: "divide-conquer",
      name: "Divide y vencerás",
      category: "Divide y vencerás",
      time: recursion.time,
      space: recursion.space,
      confidence: 0.88,
      summary:
        "Divide el problema en subproblemas más pequeños, los resuelve recursivamente y combina los resultados.",
      evidence: ["Llamadas recursivas sobre mitades (n/2)."],
      notes: [
        recursion.recurrence?.master
          ? recursion.recurrence.master.explanation
          : "Aplica el Teorema Maestro para obtener la complejidad.",
        "El espacio corresponde a la profundidad de la recursión y a las estructuras auxiliares.",
      ],
      recurrence: recursion.recurrence,
    });
  }

  if (recursion.branching) {
    return make(facts, {
      id: "branching-recursion",
      name: "Recursión múltiple",
      category: "Recursión",
      time: recursion.time,
      space: recursion.space,
      confidence: 0.88,
      summary:
        "Cada llamada genera varias llamadas hijas; el árbol de recursión crece exponencialmente.",
      evidence: ["Más de una llamada recursiva por ejecución."],
      notes: [
        "El número de hojas crece como a^n si cada llamada genera a hijos.",
        "La profundidad suele ser O(n), por lo que la pila es O(n).",
      ],
      recurrence: recursion.recurrence,
    });
  }

  const fibonacciShape =
    /fib|fibo/.test(name) ||
    /T\(n\s*-\s*1\)\s*\+\s*T\(n\s*-\s*2\)/.test(
      recursion.recurrence?.equation ?? "",
    );
  if (fibonacciShape && recursion.time.rank >= EXPONENTIAL.rank) {
    return make(facts, {
      id: "fibonacci-naive",
      name: "Fibonacci (recursión ingenua)",
      category: "Recursión",
      time: EXPONENTIAL,
      space: LINEAR,
      confidence: 0.97,
      summary:
        "Recalcula los mismos subproblemas una y otra vez; el árbol de llamadas es exponencial.",
      evidence: ["Dos llamadas recursivas T(n-1) y T(n-2) sin memoización."],
      notes: [
        "T(n) = T(n-1) + T(n-2) + O(1) ⇒ O(2^n).",
        "La memoización o la iteración reducen el costo a O(n).",
        "Python no optimiza la recursión de cola: la pila es O(n).",
      ],
      recurrence: recursion.recurrence,
    });
  }

  return make(facts, {
    id: "linear-recursion",
    name: recursion.tail ? "Recursión de cola" : "Recursión simple",
    category: "Recursión",
    time: recursion.time,
    space: recursion.space,
    confidence: recursion.tail ? 0.94 : 0.84,
    summary: recursion.tail
      ? "La llamada recursiva es la última operación, pero Python no aplica optimización de cola."
      : "Cada llamada reduce el problema en una unidad y hace trabajo constante.",
    evidence: [
      recursion.tail
        ? "La última sentencia retorna directamente la llamada recursiva."
        : "Una llamada recursiva por ejecución.",
    ],
    notes: [
      recursion.tail
        ? "En un lenguaje con TCO el espacio sería O(1); en Python es O(n)."
        : "La recurrencia T(n) = T(n-1) + O(1) da O(n) y la pila es O(n).",
      "Puede convertirse a iterativo para evitar el límite de recursión de Python.",
    ],
    recurrence: recursion.recurrence,
  });
}

/* ------------------------------------------------------------------ */
/* Caso iterativo / fallback                                           */
/* ------------------------------------------------------------------ */

function detectIterative(input: DetectInput): Candidate | null {
  const { fn, facts, estimate } = input;
  const name = functionName(fn);
  const text = facts.composedText;

  if (/(two_pointer|dos_punteros|sliding_window|ventana)/.test(name)) {
    return make(facts, {
      id: "two-pointers",
      name: /window|ventana/.test(name) ? "Ventana deslizante" : "Dos punteros",
      category: "Iterativo",
      time: LINEAR,
      space: ONE,
      confidence: 0.85,
      summary:
        "Recorre la estructura con uno o dos índices que avanzan sin retroceder.",
      evidence: ["Punteros/ventana que avanzan en un solo recorrido."],
      notes: [
        "El puntero no retrocede, por lo que el trabajo total es O(n).",
        "El espacio auxiliar es O(1) o O(k) si se guarda la ventana.",
      ],
    });
  }

  if (/(prefix|prefijo|suffix|sufijo)/.test(name)) {
    return make(facts, {
      id: "prefix",
      name: "Sumas de prefijos",
      category: "Iterativo",
      time: LINEAR,
      space: LINEAR,
      confidence: 0.84,
      summary:
        "Precalcula acumulados para responder consultas de rango en O(1).",
      evidence: ["Arreglo de prefijos construido con un recorrido."],
      notes: ["Construir cuesta O(n); cada consulta posterior O(1)."],
    });
  }

  if (
    facts.hasMatrix &&
    facts.maxLoopDepth >= 2 &&
    /(matrix|grid|tablero|matriz)/.test(name + text)
  ) {
    return make(facts, {
      id: "matrix-traversal",
      name: "Recorrido de matriz",
      category: "Iterativo",
      time: N_TIMES_M,
      space: ONE,
      confidence: 0.8,
      summary:
        "Recorre las n·m celdas de una matriz con dos bucles anidados.",
      evidence: ["Dos bucles anidados sobre filas y columnas."],
      notes: ["Si se crea una matriz auxiliar, el espacio sube a O(n·m)."],
    });
  }

  if (facts.loopCount === 0) {
    const hasCollectionWork = estimate.time.rank > ONE.rank;
    return make(facts, {
      id: "constant",
      name: hasCollectionWork ? "Operaciones sobre colecciones" : "Cálculo directo",
      category: "Iterativo",
      time: hasCollectionWork ? estimate.time : ONE,
      space: estimate.space,
      confidence: 0.62,
      summary: hasCollectionWork
        ? "No hay bucles ni recursión, pero las operaciones sobre colecciones recorren sus elementos."
        : "No se detectaron bucles ni recursión: el trabajo es constante.",
      evidence: [
        hasCollectionWork
          ? "Llamadas como set(), sorted(), sum() o similares sobre una colección."
          : "Sin bucles ni llamadas recursivas.",
      ],
      notes: [
        hasCollectionWork
          ? "set(x), list(x), sorted(x), sum(x) y max(x) recorren los n elementos de x."
          : "El costo puede crecer si las operaciones internas sobre colecciones son O(n).",
      ],
    });
  }

  if (facts.maxLoopDepth >= 2) {
    return make(facts, {
      id: "nested-loops",
      name: "Bucles anidados",
      category: "Iterativo",
      time: estimate.time,
      space: estimate.space,
      confidence: 0.68,
      summary:
        "Los bucles anidados multiplican sus iteraciones; el costo es el producto de los recorridos.",
      evidence: [
        `${facts.loopCount} bucles con profundidad ${facts.maxLoopDepth}.`,
      ],
      notes: [
        "Revisa si el bucle interno recorre i..n (n²/2) o siempre n (n²).",
        "Si el bucle interno reduce el problema a la mitad, el costo baja a O(n log n).",
      ],
    });
  }

  const heavy = estimate.time.rank > LINEAR.rank;
  return make(facts, {
    id: "linear-scan",
    name: heavy ? "Procesamiento iterativo" : "Recorrido lineal",
    category: "Iterativo",
    time: estimate.time.rank > 0 ? estimate.time : LINEAR,
    space: estimate.space,
    confidence: 0.58,
    summary: heavy
      ? "Hay un bucle principal, pero la operación interna tiene un costo mayor que constante."
      : "Recorre la entrada una vez realizando operaciones de costo constante.",
    evidence: ["Un único bucle principal."],
    notes: [
      heavy
        ? "El costo total combina las iteraciones del bucle con el costo de la operación más cara del cuerpo."
        : "El costo es O(n) si el cuerpo del bucle no contiene otro recorrido.",
    ],
  });
}

/* ------------------------------------------------------------------ */

export function detectCandidates(input: DetectInput): Candidate[] {
  const detectors = [
    detectSorting,
    detectGraph,
    detectTrees,
    detectDynamic,
    detectBacktracking,
    detectGreedy,
    detectSearch,
    detectRecursion,
    detectIterative,
  ];

  const candidates: Candidate[] = [];
  for (const detector of detectors) {
    const candidate = detector(input);
    if (candidate) candidates.push(candidate);
  }

  return candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.time.rank - a.time.rank;
  });
}

