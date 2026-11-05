import type { Credito, SearchResult, SortKey } from "../types";
import { collectMatches } from "./collectMatches";

/**
 * Búsqueda por interpolación.
 *
 * Estima la posición probable del valor usando una interpolación lineal entre
 * los extremos del rango. Funciona muy bien con datos numéricos distribuidos de
 * forma uniforme y requiere que el array esté ordenado de forma ascendente.
 *
 * Al encontrar una coincidencia se recorre hacia los lados para reunir todas
 * las coincidencias contiguas. Las comparaciones reportadas son las de la
 * búsqueda por interpolación, que es la métrica que se muestra en la interfaz.
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
  let steps = 0;
  let index = -1;
  let lo = 0;
  let hi = items.length - 1;

  while (
    lo <= hi &&
    target >= items[lo][key] &&
    target <= items[hi][key]
  ) {
    steps++;
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

  const indexes =
    index === -1 ? [] : collectMatches(items, key, target, index);

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
