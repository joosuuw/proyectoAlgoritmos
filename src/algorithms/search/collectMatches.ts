import type { Credito, SortKey } from "../types";

/**
 * Recolecta todas las coincidencias contiguas alrededor de un índice ya
 * encontrado. El array debe estar ordenado de forma ascendente por `key`.
 */
export function collectMatches(
  items: readonly Credito[],
  key: SortKey,
  target: number,
  index: number,
): number[] {
  if (index < 0 || index >= items.length || items[index][key] !== target) {
    return [];
  }

  let left = index;
  while (left > 0 && items[left - 1][key] === target) {
    left--;
  }

  let right = index;
  while (right + 1 < items.length && items[right + 1][key] === target) {
    right++;
  }

  const indexes: number[] = [];
  for (let i = left; i <= right; i++) {
    indexes.push(i);
  }

  return indexes;
}
