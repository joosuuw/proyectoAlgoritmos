import type { Credito, SearchResult, SortKey } from "../types";

/**
 * Búsqueda ternaria.
 *
 * En cada iteración calcula dos puntos medios que dividen el rango en tres
 * partes. Requiere que el array esté ordenado de forma ascendente.
 *
 * Complejidad: O(log₃ n).
 */
export function ternarySearch(
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
    const third = Math.floor((hi - lo) / 3);
    const mid1 = lo + third;
    const mid2 = hi - third;

    if (mid1 === mid2) {
      const value = items[mid1][key];
      comparisons++;

      if (value === target) {
        index = mid1;
        break;
      }

      if (value < target) {
        lo = mid1 + 1;
      } else {
        hi = mid1 - 1;
      }
      continue;
    }

    const value1 = items[mid1][key];
    comparisons++;
    if (value1 === target) {
      index = mid1;
      break;
    }

    const value2 = items[mid2][key];
    comparisons++;
    if (value2 === target) {
      index = mid2;
      break;
    }

    if (target < value1) {
      hi = mid1 - 1;
    } else if (target > value2) {
      lo = mid2 + 1;
    } else {
      lo = mid1 + 1;
      hi = mid2 - 1;
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
