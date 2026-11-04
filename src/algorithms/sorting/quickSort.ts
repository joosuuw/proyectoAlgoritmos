import type { Credito, SortKey, SortOrder, SortResult } from "../types";

/** Compara dos créditos por la clave numérica indicada (ascendente). */
function compare(a: Credito, b: Credito, key: SortKey): number {
  return a[key] - b[key];
}

/**
 * Quick Sort (ordenamiento rápido).
 *
 * Elige como pivote la mediana de tres candidatos (primero, medio y último)
 * para evitar el peor caso con arrays ya ordenados, y particiona alrededor
 * del pivote de forma recursiva.
 *
 * Complejidad: O(n log n) promedio, O(n²) en el peor caso. In-place.
 */
export function quickSort(
  items: readonly Credito[],
  key: SortKey,
  order: SortOrder = "asc",
): SortResult {
  const start = performance.now();
  const data = [...items];
  const direction = order === "asc" ? 1 : -1;

  let comparisons = 0;
  let swaps = 0;

  const cmp = (a: Credito, b: Credito): number => {
    comparisons++;
    return compare(a, b, key) * direction;
  };

  function swap(i: number, j: number): void {
    if (i === j) return;
    [data[i], data[j]] = [data[j], data[i]];
    swaps++;
  }

  function partition(lo: number, hi: number): number {
    const mid = (lo + hi) >> 1;

    // Ordena los tres candidatos y deja la mediana en `hi` como pivote.
    if (cmp(data[mid], data[lo]) < 0) swap(mid, lo);
    if (cmp(data[hi], data[lo]) < 0) swap(hi, lo);
    if (cmp(data[hi], data[mid]) < 0) swap(hi, mid);
    swap(mid, hi);

    const pivot = data[hi];
    let storeIndex = lo;

    for (let i = lo; i < hi; i++) {
      if (cmp(data[i], pivot) <= 0) {
        swap(i, storeIndex);
        storeIndex++;
      }
    }

    swap(storeIndex, hi);
    return storeIndex;
  }

  function sort(lo: number, hi: number): void {
    while (lo < hi) {
      const pivotIndex = partition(lo, hi);

      // Recursión sobre el lado más pequeño y bucle sobre el más grande
      // para acotar la profundidad de la pila.
      if (pivotIndex - lo < hi - pivotIndex) {
        sort(lo, pivotIndex - 1);
        lo = pivotIndex + 1;
      } else {
        sort(pivotIndex + 1, hi);
        hi = pivotIndex - 1;
      }
    }
  }

  sort(0, data.length - 1);

  return {
    data,
    metrics: {
      comparisons,
      swaps,
      durationMs: performance.now() - start,
    },
  };
}
