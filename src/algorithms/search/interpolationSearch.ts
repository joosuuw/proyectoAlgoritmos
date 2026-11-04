import type { Credito, SearchResult, SortKey } from "../types";

/**
 * Búsqueda por interpolación.
 *
 * Estima la posición probable del valor usando una interpolación lineal entre
 * los extremos del rango. Funciona muy bien con datos numéricos distribuidos de
 * forma uniforme y requiere que el array esté ordenado de forma ascendente.
 *
 * Complejidad: O(log log n) promedio, O(n) en el peor caso.
 */
export function interpolationSearch(
  items: readonly Credito[],
  key: SortKey,
  target: number,
): SearchResult {
  const start = performance.now();
  let comparisons = 0;
  let index = -1;
  let lo = 0;
  let hi = items.length - 1;

  while (
    lo <= hi &&
    target >= items[lo][key] &&
    target <= items[hi][key]
  ) {
    const lowValue = items[lo][key];
    const highValue = items[hi][key];

    if (lowValue === highValue) {
      comparisons++;
      if (lowValue === target) {
        index = lo;
      }
      break;
    }

    const estimate =
      lo +
      Math.floor(((target - lowValue) * (hi - lo)) / (highValue - lowValue));

    // La posición calculada siempre debe caer dentro del rango actual.
    const pos = Math.min(hi, Math.max(lo, estimate));
    const value = items[pos][key];
    comparisons++;

    if (value === target) {
      index = pos;
      break;
    }

    if (value < target) {
      lo = pos + 1;
    } else {
      hi = pos - 1;
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
