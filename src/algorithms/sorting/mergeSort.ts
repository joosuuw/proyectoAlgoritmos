import type { Credito, SortKey, SortOrder, SortResult } from "../types";

/** Compara dos créditos por la clave numérica indicada (ascendente). */
function compare(a: Credito, b: Credito, key: SortKey): number {
  return a[key] - b[key];
}

/**
 * Merge Sort (ordenamiento por mezcla).
 *
 * Divide el array en mitades, las ordena recursivamente y luego las mezcla.
 * Es estable y su rendimiento es predecible.
 *
 * Complejidad: O(n log n) en todos los casos. Usa O(n) de memoria extra.
 */
export function mergeSort(
  items: readonly Credito[],
  key: SortKey,
  order: SortOrder = "asc",
): SortResult {
  const start = performance.now();
  const data = [...items];
  const buffer: Credito[] = new Array(data.length);
  const direction = order === "asc" ? 1 : -1;

  let comparisons = 0;
  let writes = 0;

  function merge(lo: number, mid: number, hi: number): void {
    for (let k = lo; k <= hi; k++) {
      buffer[k] = data[k];
    }

    let left = lo;
    let right = mid + 1;

    for (let k = lo; k <= hi; k++) {
      if (left > mid) {
        data[k] = buffer[right++];
        writes++;
      } else if (right > hi) {
        data[k] = buffer[left++];
        writes++;
      } else {
        comparisons++;

        // Se toma el de la izquierda cuando hay empate para mantener estabilidad.
        if (compare(buffer[right], buffer[left], key) * direction < 0) {
          data[k] = buffer[right++];
        } else {
          data[k] = buffer[left++];
        }
        writes++;
      }
    }
  }

  function sort(lo: number, hi: number): void {
    if (lo >= hi) return;

    const mid = (lo + hi) >> 1;
    sort(lo, mid);
    sort(mid + 1, hi);
    merge(lo, mid, hi);
  }

  sort(0, data.length - 1);

  return {
    data,
    metrics: {
      comparisons,
      swaps: writes,
      durationMs: performance.now() - start,
    },
  };
}
