import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  SortWorkerRequest,
  SortWorkerResponse,
} from "../algorithms/sortingWorker";
import type {
  Credito,
  SortKey,
  SortMetrics,
  SortOrder,
} from "../algorithms/types";

export type AlgorithmName = "bubble" | "merge" | "quick";

export const ALGORITHM_LABELS: Record<AlgorithmName, string> = {
  bubble: "Bubble Sort",
  merge: "Merge Sort",
  quick: "Quick Sort",
};

export const SORT_KEY_LABELS: Record<SortKey, string> = {
  id: "Número",
  personAge: "Edad",
  personIncome: "Ingreso anual",
  personEmpLength: "Antigüedad laboral",
  loanAmt: "Monto del préstamo",
  loanIntRate: "Tasa de interés",
  loanStatus: "Estado del préstamo",
  loanPercentIncome: "Préstamo / ingreso",
  cbPersonCredHistLength: "Historial crediticio",
};

export interface CreditStats {
  total: number;
  totalMonto: number;
  tasaPromedio: number;
  porcentajeDefault: number;
  ingresoPromedio: number;
}

export interface UseCreditDataResult {
  creditos: Credito[];
  sortedData: Credito[];
  metrics: SortMetrics;
  stats: CreditStats;
  loading: boolean;
  /** `true` mientras el Web Worker está ordenando el dataset. */
  isSorting: boolean;
  error: string | null;
  algorithm: AlgorithmName;
  setAlgorithm: (algorithm: AlgorithmName) => void;
  sortKey: SortKey;
  setSortKey: (key: SortKey) => void;
  order: SortOrder;
  setOrder: (order: SortOrder) => void;
  /** Quita los filtros y devuelve el orden original por número de registro. */
  clearSort: () => void;
}

const EMPTY_METRICS: SortMetrics = { comparisons: 0, swaps: 0, durationMs: 0 };

/** Divide una línea CSV respetando comillas dobles. */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function toNumber(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Convierte el contenido del CSV en objetos `Credito`. */
export function parseCreditos(csv: string): Credito[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const column = (name: string) => headers.indexOf(name);

  const idx = {
    age: column("person_age"),
    income: column("person_income"),
    home: column("person_home_ownership"),
    empLength: column("person_emp_length"),
    intent: column("loan_intent"),
    grade: column("loan_grade"),
    amt: column("loan_amnt"),
    rate: column("loan_int_rate"),
    status: column("loan_status"),
    percentIncome: column("loan_percent_income"),
    defaultOnFile: column("cb_person_default_on_file"),
    credHistLength: Math.max(
      column("cb_person_cred_hist_length"),
      column("cb_person_cred_iv"),
    ),
  };

  return lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvLine(line);
    const cell = (index: number) => (index >= 0 ? cells[index]?.trim() : undefined);

    return {
      id: rowIndex + 1,
      personAge: toNumber(cell(idx.age)),
      personIncome: toNumber(cell(idx.income)),
      personHomeOwnership: (cell(idx.home) || "OTHER") as Credito["personHomeOwnership"],
      personEmpLength: toNumber(cell(idx.empLength)),
      loanIntent: cell(idx.intent) ?? "",
      loanGrade: cell(idx.grade) ?? "",
      loanAmt: toNumber(cell(idx.amt)),
      loanIntRate: toNumber(cell(idx.rate)),
      loanStatus: toNumber(cell(idx.status)) === 1 ? 1 : 0,
      loanPercentIncome: toNumber(cell(idx.percentIncome)),
      cbPersonDefaultOnFile: (cell(idx.defaultOnFile) === "Y" ? "Y" : "N") as Credito["cbPersonDefaultOnFile"],
      cbPersonCredHistLength: toNumber(cell(idx.credHistLength)),
    };
  });
}

/**
 * Carga el dataset, mantiene el estado de ordenamiento y delega el trabajo
 * pesado a un Web Worker cada vez que cambia el algoritmo, el campo o el orden.
 */
export function useCreditData(
  csvUrl = `${import.meta.env.BASE_URL}data/credit_risk_dataset.csv`,
): UseCreditDataResult {
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [algorithm, setAlgorithm] = useState<AlgorithmName>("quick");
  // Al cargar la página el dataset se muestra siempre en su orden original.
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [order, setOrder] = useState<SortOrder>("asc");

  const [sortedData, setSortedData] = useState<Credito[]>([]);
  const [metrics, setMetrics] = useState<SortMetrics>(EMPTY_METRICS);
  const [isSorting, setIsSorting] = useState(false);

  // Worker activo y contador de peticiones para descartar respuestas viejas.
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(csvUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`No se pudo cargar el CSV (HTTP ${response.status}).`);
        }

        const text = await response.text();
        if (!cancelled) {
          const parsed = parseCreditos(text);
          setCreditos(parsed);
          // Evita mostrar la tabla vacía mientras arranca la primera ordenación.
          if (parsed.length > 0) setIsSorting(true);
        }
      } catch (err) {
        if (!cancelled && (err as Error).name !== "AbortError") {
          setError((err as Error).message || "Error desconocido al cargar los datos.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [csvUrl]);

  /**
   * Envía los datos al Web Worker para ordenarlos fuera del hilo principal.
   *
   * Si ya había una ordenación en curso, se termina ese Worker antes de crear
   * uno nuevo: así una petición reciente (por ejemplo, cambiar a Quick Sort)
   * no tiene que esperar a que termine un Bubble Sort lento.
   */
  const ejecutarOrdenamiento = useCallback(
    (
      data: Credito[],
      nextAlgorithm: AlgorithmName,
      nextSortKey: SortKey,
      nextOrder: SortOrder,
    ) => {
      workerRef.current?.terminate();
      workerRef.current = null;

      if (data.length === 0) {
        setSortedData([]);
        setMetrics(EMPTY_METRICS);
        setIsSorting(false);
        return;
      }

      const requestId = ++requestIdRef.current;

      // Estado de carga: ocultamos las métricas anteriores.
      setIsSorting(true);
      setMetrics(EMPTY_METRICS);

      const worker = new Worker(
        new URL("../algorithms/sortingWorker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<SortWorkerResponse>) => {
        const response = event.data;

        // Ignoramos respuestas de peticiones que ya fueron reemplazadas.
        if (response.id !== requestId || workerRef.current !== worker) return;

        setSortedData(response.data);
        setMetrics(response.metrics);
        setIsSorting(false);
      };

      worker.onerror = (event: ErrorEvent) => {
        if (workerRef.current !== worker) return;

        console.error("Error al ordenar en el Web Worker:", event.message);
        setIsSorting(false);
      };

      const message: SortWorkerRequest = {
        id: requestId,
        creditos: data,
        algorithm: nextAlgorithm,
        sortKey: nextSortKey,
        order: nextOrder,
      };

      worker.postMessage(message);
    },
    [],
  );

  // Reordena cuando cambian los datos o cualquiera de los controles.
  useEffect(() => {
    ejecutarOrdenamiento(creditos, algorithm, sortKey, order);
  }, [creditos, algorithm, sortKey, order, ejecutarOrdenamiento]);

  // Libera el Worker al desmontar el componente.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const stats = useMemo<CreditStats>(() => {
    const total = creditos.length;

    if (total === 0) {
      return {
        total: 0,
        totalMonto: 0,
        tasaPromedio: 0,
        porcentajeDefault: 0,
        ingresoPromedio: 0,
      };
    }

    const sum = (pick: (credito: Credito) => number) =>
      creditos.reduce((acc, credito) => acc + pick(credito), 0);

    return {
      total,
      totalMonto: sum((c) => c.loanAmt),
      tasaPromedio: sum((c) => c.loanIntRate) / total,
      porcentajeDefault: (sum((c) => c.loanStatus) / total) * 100,
      ingresoPromedio: sum((c) => c.personIncome) / total,
    };
  }, [creditos]);

  const clearSort = useCallback(() => {
    setSortKey("id");
    setOrder("asc");
  }, []);

  return {
    creditos,
    sortedData,
    metrics,
    stats,
    loading,
    isSorting,
    error,
    algorithm,
    setAlgorithm,
    sortKey,
    setSortKey,
    order,
    setOrder,
    clearSort,
  };
}
