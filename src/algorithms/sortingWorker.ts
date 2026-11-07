import { bubbleSort, mergeSort, quickSort } from "./sorting";
import type { Credito, SortKey, SortMetrics, SortOrder } from "./types";

/** Algoritmos de ordenamiento disponibles en el Worker. */
export type SortAlgorithmName = "bubble" | "merge" | "quick";

/** Mensaje que la interfaz envía al Worker para solicitar una ordenación. */
export interface SortWorkerRequest {
  /** Identificador de la petición para descartar respuestas antiguas. */
  id: number;
  creditos: Credito[];
  algorithm: SortAlgorithmName;
  sortKey: SortKey;
  order: SortOrder;
}

/** Mensaje con el que el Worker devuelve el resultado de la ordenación. */
export interface SortWorkerResponse {
  /** Mismo identificador recibido en la petición. */
  id: number;
  data: Credito[];
  metrics: SortMetrics;
}

const ALGORITHMS = {
  bubble: bubbleSort,
  merge: mergeSort,
  quick: quickSort,
} as const;

/**
 * Tipado mínimo del contexto de un Dedicated Worker.
 *
 * El proyecto compila con la librería `DOM` (no `WebWorker`), así que `self`
 * se declara como `Window`. Este alias evita conflictos de tipos y permite
 * usar la firma correcta de `postMessage` dentro del Worker.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent<SortWorkerRequest>) => void) | null;
  postMessage: (message: SortWorkerResponse) => void;
}

const ctx = self as unknown as WorkerScope;

ctx.onmessage = (event: MessageEvent<SortWorkerRequest>) => {
  const { id, creditos, algorithm, sortKey, order } = event.data;
  const sort = ALGORITHMS[algorithm];

  if (!sort) {
    ctx.postMessage({
      id,
      data: creditos,
      metrics: { comparisons: 0, swaps: 0, durationMs: 0 },
    });
    return;
  }

  // El algoritmo ya devuelve una copia ordenada y sus propias métricas.
  const result = sort(creditos, sortKey, order);

  ctx.postMessage({
    id,
    data: result.data,
    metrics: result.metrics,
  });
};
