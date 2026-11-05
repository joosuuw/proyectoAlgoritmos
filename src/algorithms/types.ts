/**
 * Una fila del dataset `credit_risk_dataset.csv`.
 * Los nombres se mantienen en camelCase para que sean cómodos en TypeScript.
 */
export interface Credito {
  id: number;
  personAge: number;
  personIncome: number;
  personHomeOwnership: "RENT" | "OWN" | "MORTGAGE" | "OTHER";
  personEmpLength: number;
  loanIntent: string;
  loanGrade: string;
  loanAmt: number;
  loanIntRate: number;
  loanStatus: 0 | 1;
  loanPercentIncome: number;
  cbPersonDefaultOnFile: "Y" | "N";
  cbPersonCredHistLength: number;
}

/** Campos numéricos de `Credito` por los que se puede ordenar o buscar. */
export type SortKey =
  | "id"
  | "personAge"
  | "personIncome"
  | "personEmpLength"
  | "loanAmt"
  | "loanIntRate"
  | "loanStatus"
  | "loanPercentIncome"
  | "cbPersonCredHistLength";

export type SortOrder = "asc" | "desc";

/** Métricas que devuelve cada algoritmo para poder compararlos. */
export interface SortMetrics {
  /** Comparaciones entre elementos realizadas durante la ordenación. */
  comparisons: number;
  /** Intercambios (o escrituras en el array auxiliar) realizados. */
  swaps: number;
  /** Tiempo de ejecución medido con `performance.now()`. */
  durationMs: number;
}

export interface SortResult {
  /** Nuevo array ordenado; el array de entrada nunca se muta. */
  data: Credito[];
  metrics: SortMetrics;
}

/**
 * Contrato común de los algoritmos de ordenamiento.
 * Recibe una lista de solo lectura y devuelve una copia ordenada + métricas.
 */
export type SortAlgorithm = (
  items: readonly Credito[],
  key: SortKey,
  order?: SortOrder,
) => SortResult;

/** Métricas que devuelve cada algoritmo de búsqueda. */
export interface SearchMetrics {
  /** Comparaciones entre el valor buscado y los elementos del array. */
  comparisons: number;
  /**
   * Iteraciones o pasos realizados por el algoritmo:
   * - Secuencial: posición del último elemento encontrado (o el total del
   *   arreglo si no hay coincidencias).
   * - Binaria y ternaria: veces que se dividió el rango de búsqueda.
   * - Interpolación: estimaciones realizadas (no se muestra en la interfaz).
   */
  iterations: number;
  /** Tiempo de ejecución medido con `performance.now()`. */
  durationMs: number;
}

export interface SearchResult {
  /** Indica si se encontró al menos una coincidencia. */
  found: boolean;
  /** Índices de todas las coincidencias, de menor a mayor. */
  indexes: number[];
  /** Coste real de la búsqueda que localizó todas las coincidencias. */
  metrics: SearchMetrics;
}

/**
 * Contrato común de los algoritmos de búsqueda.
 * `items` debe estar ordenado de forma ascendente por `key`.
 */
export type SearchAlgorithm = (
  items: readonly Credito[],
  key: SortKey,
  target: number,
) => SearchResult;
