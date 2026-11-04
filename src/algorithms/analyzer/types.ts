/** Categorías que puede devolver el analizador. */
export type AlgorithmCategory =
  | "Búsqueda"
  | "Ordenamiento"
  | "Grafos"
  | "Árboles"
  | "Programación dinámica"
  | "Backtracking"
  | "Greedy"
  | "Divide y vencerás"
  | "Recursión"
  | "Iterativo";

/** Clave de crecimiento usada para la gráfica comparativa. */
export type GrowthKind =
  | "1"
  | "log"
  | "n"
  | "nlog"
  | "n2"
  | "n3"
  | "2n"
  | "nf"
  | "custom";

/**
 * Complejidad simbólica. Los exponentes permiten combinar bucles anidados
 * (por ejemplo n·m o n²) sin perder información.
 */
export interface Cost {
  /** Exponente de n. */
  n: number;
  /** Exponente de m (segunda dimensión de entrada). */
  m: number;
  /** Exponente de k (tercera dimensión). */
  k: number;
  /** Exponente de log n. */
  logN: number;
  /** Etiqueta lista para mostrar, por ejemplo "O(n·m)". */
  label: string;
  /** Orden relativo para comparar y elegir el peor caso. */
  rank: number;
  /** Clave de crecimiento para la gráfica. */
  kind: GrowthKind;
}

export interface RecurrenceTreeLevel {
  level: number;
  nodes: string;
  work: string;
  total: string;
}

export interface MasterTheorem {
  case: 1 | 2 | 3;
  exponent: number;
  result: string;
  explanation: string;
}

export interface RecurrenceInfo {
  equation: string;
  a: number;
  b: number;
  fLabel: string;
  method: "Teorema Maestro" | "Expansión" | "Memoización";
  master?: MasterTheorem;
  levels: RecurrenceTreeLevel[];
  height: string;
  leaves: string;
  spaceNote: string;
}

export interface ComponentRow {
  line: number;
  code: string;
  type: string;
  time: string;
  space: string;
  reason: string;
  depth: number;
}

export interface AnalysisStats {
  lines: number;
  functions: number;
  loops: number;
  maxLoopDepth: number;
  recursiveCalls: number;
  calls: number;
}

export interface CallGraphEdge {
  from: string;
  to: string;
}

export interface AnalysisResult {
  name: string;
  category: AlgorithmCategory;
  time: Cost;
  space: Cost;
  confidence: number;
  summary: string;
  evidence: string[];
  structures: string[];
  notes: string[];
  rows: ComponentRow[];
  recurrence?: RecurrenceInfo;
  stats: AnalysisStats;
  callGraph: CallGraphEdge[];
}

/** Datos mínimos de una llamada detectada en el AST. */
export interface PyCall {
  /** Nombre final de la llamada: `heappush`. */
  name: string;
  /** Texto completo del destinatario: `heapq.heappush`. */
  full: string;
  /** Texto de cada argumento. */
  args: string[];
  line: number;
}

export interface PyComprehension {
  loops: { variable: string; iterable: string }[];
  text: string;
}

export interface PyExprInfo {
  text: string;
  calls: PyCall[];
  names: string[];
  members: string[];
  subscripts: { base: string; index: string }[];
  comparisons: string[];
  comprehensions: PyComprehension[];
  hasComparison: boolean;
}

export type StmtKind =
  | "for"
  | "while"
  | "if"
  | "assign"
  | "augassign"
  | "return"
  | "call"
  | "expr"
  | "import"
  | "def"
  | "class"
  | "try"
  | "with"
  | "match"
  | "break"
  | "continue"
  | "pass"
  | "raise"
  | "assert"
  | "delete"
  | "yield"
  | "other";

export interface PyBranch {
  keyword: string;
  test?: string;
  body: PyStmt[];
}

export interface PyStmt {
  kind: StmtKind;
  line: number;
  endLine: number;
  code: string;
  text: string;
  depth: number;
  body: PyStmt[];
  branches: PyBranch[];
  target?: string;
  iter?: string;
  test?: string;
  value?: string;
  op?: string;
  calls: PyCall[];
  expr: PyExprInfo;
}

export interface PyFunction {
  name: string;
  qualifiedName: string;
  params: string[];
  decorators: string[];
  line: number;
  endLine: number;
  source: string;
  body: PyStmt[];
  calls: PyCall[];
  subscripts: { base: string; index: string }[];
  comparisons: string[];
  assignments: { target: string; value: string; line: number }[];
  names: string[];
  comprehensionCount: number;
  loopCount: number;
  maxLoopDepth: number;
}

export interface PyModule {
  source: string;
  functions: PyFunction[];
  topLevel: PyStmt[];
  imports: string[];
  importedNames: string[];
  issues: { line: number; message: string }[];
}

/** Hechos semánticos derivados del AST de una función. */
export interface FunctionFacts {
  fn: PyFunction;
  lowerSource: string;
  callNames: Set<string>;
  callFulls: Set<string>;
  methodNames: Set<string>;
  assignedTargets: Set<string>;
  assignedValues: Map<string, string>;
  subscriptBases: Set<string>;
  subscripts: string[];
  comparisonsText: string;
  imports: string[];
  importedNames: Set<string>;
  variableTypes: Map<string, string>;
  loopCount: number;
  maxLoopDepth: number;
  hasRecursion: boolean;
  selfCalls: PyCall[];
  hasMemoDecorator: boolean;
  hasMemoTable: boolean;
  hasDpTable: boolean;
  hasMatrix: boolean;
  hasAdjacency: boolean;
  hasVisited: boolean;
  hasQueue: boolean;
  hasStack: boolean;
  hasHeap: boolean;
  hasUnionFind: boolean;
  hasTreeLinks: boolean;
  hasBacktracking: boolean;
  hasGreedySort: boolean;
  composedText: string;
}

export interface Candidate {
  id: string;
  name: string;
  category: AlgorithmCategory;
  time: Cost;
  space: Cost;
  confidence: number;
  summary: string;
  evidence: string[];
  structures: string[];
  notes: string[];
  recurrence?: RecurrenceInfo;
}

export interface ParseOutcome {
  module: PyModule | null;
  error: string | null;
}
