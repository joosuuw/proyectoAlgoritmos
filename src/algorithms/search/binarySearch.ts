import type { Credito, SearchResult, SortKey } from "../types";

/**
 * Búsqueda binaria.
 *
 * Divide el rango de búsqueda a la mitad en cada comparación. Requiere que el
 * array esté ordenado de forma ascendente por la clave indicada.
 *
 * Complejidad: O(log n).
 */
export function binarySearch(
  items: readonly Credito[],
  key: SortKey,
  target: number,
): SearchResult {
  const start = performance.now();
  let comparisons = 0;
  let index = -1;
  let lo = 0;
  let hi = items.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const value = items[mid][key];
    comparisons++;

    if (value === target) {
      index = mid;
      break;
    }

    if (value < target) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
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
