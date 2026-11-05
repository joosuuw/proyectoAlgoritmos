import type { Credito, SearchMetrics, SortKey } from "../../algorithms/types";
import { SORT_KEY_LABELS } from "../../hooks/useCreditData";
import {
  SEARCH_ALGORITHM_LABELS,
  type SearchAlgorithmName,
  type UseCreditSearchResult,
} from "../../hooks/useCreditSearch";

const ALGORITHMS = Object.keys(
  SEARCH_ALGORITHM_LABELS,
) as SearchAlgorithmName[];
const SEARCH_KEYS = Object.keys(SORT_KEY_LABELS) as SortKey[];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

const decimal = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("en-US");

function formatValue(key: SortKey, value: number): string {
  switch (key) {
    case "personIncome":
    case "loanAmt":
      return money.format(value);
    case "loanIntRate":
      return `${decimal.format(value)}%`;
    case "loanPercentIncome":
      return percent.format(value);
    case "loanStatus":
      return value === 1 ? "Default (1)" : "Pagado (0)";
    default:
      return decimal.format(value);
  }
}

function describeRecord(record: Credito): string {
  return `${record.personAge} años · ${money.format(
    record.personIncome,
  )} de ingreso · ${money.format(record.loanAmt)} de préstamo`;
}

type SearchMetricKind = "iterations" | "steps" | "comparisons";

/**
 * La secuencial reporta elementos recorridos, la binaria y la ternaria reportan
 * divisiones del rango, y la interpolación conserva las comparaciones.
 */
function metricKind(algorithm: SearchAlgorithmName): SearchMetricKind {
  if (algorithm === "interpolation") return "comparisons";
  if (algorithm === "sequential") return "iterations";
  return "steps";
}

function metricValue(
  metrics: SearchMetrics,
  algorithm: SearchAlgorithmName,
): number {
  return metricKind(algorithm) === "comparisons"
    ? metrics.comparisons
    : metrics.iterations;
}

function metricHeading(algorithm: SearchAlgorithmName): string {
  const kind = metricKind(algorithm);

  if (kind === "comparisons") {
    return "Comparaciones";
  }

  if (kind === "iterations") {
    return "Iteraciones";
  }

  return "Pasos";
}

interface PanelBusquedaProps {
  search: UseCreditSearchResult;
}

export default function PanelBusqueda({ search }: PanelBusquedaProps) {
  const {
    algorithm,
    setAlgorithm,
    key,
    setKey,
    query,
    setQuery,
    outcome,
    error,
    search: runSearch,
    reset,
  } = search;

  return (
    <section className="card panel">
      <header className="card__header">
        <div>
          <h2>Búsqueda</h2>
          <p>
            Busca un valor concreto en la variable que elijas. Se muestran todas
            las coincidencias y el costo de encontrarlas.
          </p>
        </div>
      </header>

      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
      >
        <div className="panel__controls">
          <label className="field">
            <span>Método de búsqueda</span>
            <select
              value={algorithm}
              onChange={(event) =>
                setAlgorithm(event.target.value as SearchAlgorithmName)
              }
            >
              {ALGORITHMS.map((name) => (
                <option key={name} value={name}>
                  {SEARCH_ALGORITHM_LABELS[name]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Variable a buscar</span>
            <select
              value={key}
              onChange={(event) => setKey(event.target.value as SortKey)}
            >
              {SEARCH_KEYS.map((searchKey) => (
                <option key={searchKey} value={searchKey}>
                  {SORT_KEY_LABELS[searchKey]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Valor a buscar</span>
            <input
              type="text"
              inputMode="decimal"
              value={query}
              placeholder="Ej. 24"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="panel__actions">
          <button type="submit" className="btn btn--primary">
            Buscar
          </button>
          <button type="button" className="btn" onClick={reset}>
            Limpiar
          </button>
        </div>
      </form>

      <p className="search-note">
        Los datos se ordenan de forma ascendente por la variable elegida antes de
        buscar. Cada algoritmo se ejecuta una sola vez y localiza todas las
        coincidencias en esa misma búsqueda.
      </p>

      {error && (
        <div className="search-result search-result--error" role="alert">
          {error}
        </div>
      )}

      {outcome && !error && outcome.matches.length > 0 && (
        <div className="search-result search-result--found">
          <div className="search-result__headline">
            <span className="badge badge--ok">
              {outcome.matches.length}{" "}
              {outcome.matches.length === 1 ? "coincidencia" : "coincidencias"}
            </span>
            <span>
              {SORT_KEY_LABELS[outcome.key]}:{" "}
              <strong>{formatValue(outcome.key, outcome.target)}</strong> en{" "}
              {integer.format(outcome.total)} registros.
            </span>
          </div>

          <ol className="search-matches">
            {outcome.matches.map((record) => (
              <li key={record.id} className="search-match">
                <div className="search-match__info">
                  <span className="search-match__id">#{record.id}</span>
                  <span className="search-match__desc">
                    {describeRecord(record)}
                  </span>
                </div>
              </li>
            ))}
          </ol>

          <dl className="metrics">
            <div>
              <dt>Coincidencias</dt>
              <dd>{integer.format(outcome.matches.length)}</dd>
            </div>
            <div>
              <dt>{metricHeading(outcome.algorithm)}</dt>
              <dd>
                {integer.format(
                  metricValue(outcome.metrics, outcome.algorithm),
                )}
              </dd>
            </div>
            <div>
              <dt>Tiempo</dt>
              <dd>{outcome.metrics.durationMs.toFixed(2)} ms</dd>
            </div>
          </dl>
        </div>
      )}

      {outcome && !error && outcome.matches.length === 0 && (
        <div className="search-result search-result--empty">
          <div className="search-result__headline">
            <span className="badge badge--danger">Sin coincidencias</span>
            <span>
              No se encontró{" "}
              <strong>{formatValue(outcome.key, outcome.target)}</strong> en{" "}
              {SORT_KEY_LABELS[outcome.key].toLowerCase()}.
            </span>
          </div>

          <dl className="metrics">
            <div>
              <dt>{metricHeading(outcome.algorithm)}</dt>
              <dd>
                {integer.format(
                  metricValue(outcome.metrics, outcome.algorithm),
                )}
              </dd>
            </div>
            <div>
              <dt>Tiempo</dt>
              <dd>{outcome.metrics.durationMs.toFixed(2)} ms</dd>
            </div>
            <div>
              <dt>Método</dt>
              <dd>{SEARCH_ALGORITHM_LABELS[outcome.algorithm]}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
