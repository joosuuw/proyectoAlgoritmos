import type { Credito, SearchResult, SortKey } from "../types";

/**
 * Búsqueda secuencial (lineal).
 *
 * Recorre el array una sola vez, de principio a fin, guardando todas las
 * coincidencias. No necesita que los datos estén ordenados.
 *
 * Las iteraciones reportadas corresponden a la posición del último elemento
 * encontrado (o al total del array cuando no hay coincidencias), que es el
 * coste real de localizar todos los objetivos en una única pasada.
 *
 * Complejidad: O(n).
 */
export function sequentialSearch(
  items: readonly Credito[],
  key: SortKey,
  target: number,
): SearchResult {
  const start = performance.now();
  const indexes: number[] = [];
  let comparisons = 0;
  let lastFound = -1;

  for (let i = 0; i < items.length; i++) {
    comparisons++;

    if (items[i][key] === target) {
      indexes.push(i);
      lastFound = i;
    }
  }

  return {
    found: indexes.length > 0,
    indexes,
    metrics: {
      comparisons,
      iterations: lastFound === -1 ? items.length : lastFound + 1,
      durationMs: performance.now() - start,
    },
  };
}
