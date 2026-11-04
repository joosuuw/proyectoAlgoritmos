import type { Credito, SortKey, SortOrder, SortResult } from "../types";

/** Compara dos créditos por la clave numérica indicada (ascendente). */
function compare(a: Credito, b: Credito, key: SortKey): number {
  return a[key] - b[key];
}

/**
 * Bubble Sort (ordenamiento burbuja).
 *
 * Recorre el array comparando pares adyacentes e intercambiándolos si están
 * desordenados. Si en una pasada no hubo intercambios, el array ya está
 * ordenado y se detiene antes.
 *
 * Complejidad: O(n²) en el peor caso, O(n) en el mejor (array ya ordenado).
 */
export function bubbleSort(
  items: readonly Credito[],
  key: SortKey,
  order: SortOrder = "asc",
): SortResult {
  const start = performance.now();
  const data = [...items];
  const direction = order === "asc" ? 1 : -1;

  let comparisons = 0;
  let swaps = 0;

  for (let i = 0; i < data.length - 1; i++) {
    let swapped = false;

    // Tras cada pasada, el mayor de la parte no ordenada queda al final.
    for (let j = 0; j < data.length - 1 - i; j++) {
      comparisons++;

      if (compare(data[j], data[j + 1], key) * direction > 0) {
        [data[j], data[j + 1]] = [data[j + 1], data[j]];
        swaps++;
        swapped = true;
      }
    }

    if (!swapped) break;
  }

  return {
    data,
    metrics: {
      comparisons,
      swaps,
      durationMs: performance.now() - start,
    },
  };
}
