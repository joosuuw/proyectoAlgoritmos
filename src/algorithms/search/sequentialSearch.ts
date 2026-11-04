import type { Credito, SearchResult, SortKey } from "../types";

/**
 * Búsqueda secuencial (lineal).
 *
 * Recorre el array de principio a fin comparando cada elemento con el valor
 * buscado. No necesita que los datos estén ordenados.
 *
 * Complejidad: O(n).
 */
export function sequentialSearch(
  items: readonly Credito[],
  key: SortKey,
  target: number,
): SearchResult {
  const start = performance.now();
  let comparisons = 0;
  let index = -1;

  for (let i = 0; i < items.length; i++) {
    comparisons++;

    if (items[i][key] === target) {
      index = i;
      break;
    }
  }

  return {
    found: index !== -1,
    index,
    metrics: {
      comparisons,
      durationMs: performance.now() - start,
    },
  };
}
