import { useCallback, useState } from "react";
import {
  binarySearch,
  interpolationSearch,
  sequentialSearch,
  ternarySearch,
} from "../algorithms/search";
import type {
  Credito,
  SearchAlgorithm,
  SearchMetrics,
  SortKey,
} from "../algorithms/types";

export type SearchAlgorithmName =
  | "sequential"
  | "binary"
  | "ternary"
  | "interpolation";

export const SEARCH_ALGORITHM_LABELS: Record<SearchAlgorithmName, string> = {
  sequential: "Secuencial",
  binary: "Binaria",
  ternary: "Ternaria",
  interpolation: "Interpolación",
};

const SEARCHES: Record<SearchAlgorithmName, SearchAlgorithm> = {
  sequential: sequentialSearch,
  binary: binarySearch,
  ternary: ternarySearch,
  interpolation: interpolationSearch,
};

export interface SearchMatch {
  record: Credito;
  /** Comparaciones y tiempo medidos en la búsqueda de este registro. */
  metrics: SearchMetrics;
}

export interface SearchOutcome {
  algorithm: SearchAlgorithmName;
  key: SortKey;
  target: number;
  /** Todos los registros que coinciden con el valor buscado. */
  matches: SearchMatch[];
  /** Total de registros del dataset antes de filtrar. */
  total: number;
  /** Suma de las métricas de todas las búsquedas exitosas. */
  totals: SearchMetrics;
  /** Métricas del último intento, útil cuando no hay coincidencias. */
  lastAttempt: SearchMetrics;
}

export interface UseCreditSearchResult {
  algorithm: SearchAlgorithmName;
  setAlgorithm: (algorithm: SearchAlgorithmName) => void;
  key: SortKey;
  setKey: (key: SortKey) => void;
  query: string;
  setQuery: (query: string) => void;
  outcome: SearchOutcome | null;
  error: string | null;
  search: () => void;
  reset: () => void;
}

const EMPTY_METRICS: SearchMetrics = { comparisons: 0, durationMs: 0 };

/**
 * Gestiona el estado de la búsqueda y ejecuta el algoritmo seleccionado.
 *
 * Para obtener todas las coincidencias se busca, se extrae temporalmente el
 * registro encontrado del conjunto y se vuelve a buscar, hasta que el
 * algoritmo no encuentre más resultados. Cada coincidencia conserva sus
 * propias comparaciones y su propio tiempo.
 */
export function useCreditSearch(creditos: Credito[]): UseCreditSearchResult {
  const [algorithm, setAlgorithmState] =
    useState<SearchAlgorithmName>("sequential");
  const [key, setKeyState] = useState<SortKey>("personAge");
  const [query, setQueryState] = useState("");
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setAlgorithm = useCallback((value: SearchAlgorithmName) => {
    setAlgorithmState(value);
    setOutcome(null);
    setError(null);
  }, []);

  const setKey = useCallback((value: SortKey) => {
    setKeyState(value);
    setOutcome(null);
    setError(null);
  }, []);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setOutcome(null);
    setError(null);
  }, []);

  const search = useCallback(() => {
    const normalized = query.trim().replace(",", ".");
    const target = Number.parseFloat(normalized);

    if (normalized === "") {
      setOutcome(null);
      setError("Escribe un valor para buscar.");
      return;
    }

    if (!Number.isFinite(target)) {
      setOutcome(null);
      setError("Ingresa un valor numérico válido.");
      return;
    }

    if (creditos.length === 0) {
      setOutcome(null);
      setError("Todavía no hay datos cargados.");
      return;
    }

    // Binaria, ternaria e interpolación necesitan datos ordenados.
    const pool = [...creditos].sort((a, b) => a[key] - b[key]);
    const total = pool.length;
    const matches: SearchMatch[] = [];
    let lastAttempt = EMPTY_METRICS;

    while (pool.length > 0) {
      const result = SEARCHES[algorithm](pool, key, target);
      lastAttempt = result.metrics;

      if (!result.found || result.index < 0) break;

      const record = pool[result.index];

      // Salvaguarda para no repetir indefinidamente un resultado inválido.
      if (!record || record[key] !== target) break;

      pool.splice(result.index, 1);
      matches.push({ record, metrics: result.metrics });
    }

    // Se presentan ordenadas por número de registro (#).
    matches.sort((a, b) => a.record.id - b.record.id);

    const totals = matches.reduce<SearchMetrics>(
      (acc, match) => ({
        comparisons: acc.comparisons + match.metrics.comparisons,
        durationMs: acc.durationMs + match.metrics.durationMs,
      }),
      { ...EMPTY_METRICS },
    );

    setError(null);
    setOutcome({
      algorithm,
      key,
      target,
      matches,
      total,
      totals,
      lastAttempt,
    });
  }, [algorithm, creditos, key, query]);

  const reset = useCallback(() => {
    setQueryState("");
    setOutcome(null);
    setError(null);
  }, []);

  return {
    algorithm,
    setAlgorithm,
    key,
    setKey,
    query,
    setQuery,
    outcome,
    error,
    search,
    reset,
  };
}
