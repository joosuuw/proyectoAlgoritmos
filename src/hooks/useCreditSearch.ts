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

export interface SearchOutcome {
  algorithm: SearchAlgorithmName;
  key: SortKey;
  target: number;
  /** Todos los registros que coinciden con el valor buscado. */
  matches: Credito[];
  /** Total de registros del dataset antes de filtrar. */
  total: number;
  /** Coste real de la única búsqueda que localizó todas las coincidencias. */
  metrics: SearchMetrics;
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

/**
 * Gestiona el estado de la búsqueda y ejecuta el algoritmo seleccionado.
 *
 * Cada algoritmo hace una sola pasada/búsqueda y devuelve todas las
 * coincidencias junto con el coste real de esa búsqueda, sin eliminaciones ni
 * reinicios que inflen las iteraciones.
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

    // Binaria, ternaria e interpolación necesitan datos ordenados. La
    // secuencial también los recibe ordenados por coherencia con la tabla.
    const pool = [...creditos].sort((a, b) => a[key] - b[key]);

    // Una sola ejecución del algoritmo devuelve todas las coincidencias.
    const result = SEARCHES[algorithm](pool, key, target);

    const matches = result.indexes
      .map((index) => pool[index])
      .filter((record): record is Credito => record !== undefined)
      // Se presentan ordenadas por número de registro (#).
      .sort((a, b) => a.id - b.id);

    setError(null);
    setOutcome({
      algorithm,
      key,
      target,
      matches,
      total: pool.length,
      metrics: result.metrics,
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
