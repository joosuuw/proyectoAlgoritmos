import type { Credito, SearchResult, SortKey } from "../types";
import { collectMatches } from "./collectMatches";

/**
 * Búsqueda binaria.
 *
 * Localiza el primer elemento que coincide con el valor buscado usando una
 * búsqueda binaria de límite inferior. Después recorre hacia la izquierda y
 * hacia la derecha para reunir todas las coincidencias contiguas.
 *
 * Las iteraciones reportadas son únicamente los pasos de la búsqueda binaria
 * que encontró ese primer elemento; la recolección posterior es lineal y no
 * forma parte del coste logarítmico.
 *
 * Requiere que el array esté ordenado de forma ascendente por la clave.
 *
 * Complejidad: O(log n + k), donde k es el número de coincidencias.
 */
export function binarySearch(
  items: readonly Credito[],
  key: SortKey,
  target: number,
): SearchResult {
  const start = performance.now();
  let comparisons = 0;
  let steps = 0;
  let lo = 0;
  let hi = items.length - 1;

  // Límite inferior: al terminar, `lo` apunta al primer elemento >= target.
  while (lo <= hi) {
    steps++;
    const mid = (lo + hi) >> 1;
    comparisons++;

    if (items[mid][key] < target) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
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
