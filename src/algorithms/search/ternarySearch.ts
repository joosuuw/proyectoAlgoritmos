import type { Credito, SearchResult, SortKey } from "../types";
import { collectMatches } from "./collectMatches";

/**
 * Búsqueda ternaria.
 *
 * En cada iteración calcula dos puntos que dividen el rango en tres partes y
 * descarta los bloques que no pueden contener el valor buscado. Se usa como
 * búsqueda de límite inferior, de modo que al terminar `lo` apunta al primer
 * elemento mayor o igual que el objetivo. Después se recolectan las
 * coincidencias contiguas.
 *
 * Los pasos reportados son únicamente los del descarte ternario; la
 * recolección posterior es lineal.
 *
 * Requiere que el array esté ordenado de forma ascendente.
 *
 * Complejidad: O(log₃ n + k), donde k es el número de coincidencias.
 */
export function ternarySearch(
  items: readonly Credito[],
  key: SortKey,
  target: number,
): SearchResult {
  const start = performance.now();
  let comparisons = 0;
  let steps = 0;
  let lo = 0;
  let hi = items.length - 1;

  // Límite inferior: al terminar, `lo` es el primer índice >= target.
  while (lo <= hi) {
    steps++;
    const third = Math.floor((hi - lo) / 3);
    const mid1 = lo + third;
    const mid2 = hi - third;

    // Rango de un solo elemento: se resuelve con un paso binario.
    if (mid1 >= mid2) {
      comparisons++;
      if (items[mid1][key] < target) {
        lo = mid1 + 1;
      } else {
        hi = mid1 - 1;
      }
      continue;
    }

    comparisons++;
    if (items[mid1][key] >= target) {
      // El primer elemento >= target está en [lo, mid1].
      hi = mid1;
      continue;
    }

    comparisons++;
    if (items[mid2][key] < target) {
      // Todos los valores de [lo, mid2] son menores que el objetivo.
      lo = mid2 + 1;
    } else {
      // El objetivo está en (mid1, mid2].
      lo = mid1 + 1;
      hi = mid2;
    }
  }

  const indexes = collectMatches(items, key, target, lo);

  return {
    found: indexes.length > 0,
    indexes,
    metrics: {
      comparisons,
      iterations: steps,
      durationMs: performance.now() - start,
    },
  };
}
