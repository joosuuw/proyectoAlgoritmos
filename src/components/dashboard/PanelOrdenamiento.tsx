import type { SortKey, SortMetrics, SortOrder } from "../../algorithms/types";
import {
  ALGORITHM_LABELS,
  SORT_KEY_LABELS,
  type AlgorithmName,
} from "../../hooks/useCreditData";

const ALGORITHMS = Object.keys(ALGORITHM_LABELS) as AlgorithmName[];
const SORT_KEYS = Object.keys(SORT_KEY_LABELS) as SortKey[];

const integer = new Intl.NumberFormat("en-US");

interface PanelOrdenamientoProps {
  algorithm: AlgorithmName;
  onAlgorithmChange: (algorithm: AlgorithmName) => void;
  sortKey: SortKey;
  onSortKeyChange: (key: SortKey) => void;
  order: SortOrder;
  onOrderChange: (order: SortOrder) => void;
  metrics: SortMetrics;
  /** Vuelve al orden original por número de registro. */
  onClearSort: () => void;
  /** Indica si ya se está mostrando el orden original. */
  canClear: boolean;
}

export default function PanelOrdenamiento({
  algorithm,
  onAlgorithmChange,
  sortKey,
  onSortKeyChange,
  order,
  onOrderChange,
  metrics,
  onClearSort,
  canClear,
}: PanelOrdenamientoProps) {
  return (
    <section className="card panel">
      <header className="card__header">
        <div>
          <h2>Ordenamiento</h2>
          <p>
            Selecciona el método de ordenamiento, la variable y el sentido para
            ordenar la tabla.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--outline"
          onClick={onClearSort}
          disabled={!canClear}
          title={
            canClear
              ? "Quitar los filtros y ordenar por número de registro"
              : "Los registros ya están en el orden original"
          }
        >
          Borrar filtros
        </button>
      </header>

      <div className="panel__controls">
        <label className="field">
          <span>Método de ordenamiento</span>
          <select
            value={algorithm}
            onChange={(event) =>
              onAlgorithmChange(event.target.value as AlgorithmName)
            }
          >
            {ALGORITHMS.map((name) => (
              <option key={name} value={name}>
                {ALGORITHM_LABELS[name]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Variable a ordenar</span>
          <select
            value={sortKey}
            onChange={(event) => onSortKeyChange(event.target.value as SortKey)}
          >
            {SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {SORT_KEY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Sentido</span>
          <select
            value={order}
            onChange={(event) =>
              onOrderChange(event.target.value as SortOrder)
            }
          >
            <option value="asc">Ascendente</option>
            <option value="desc">Descendente</option>
          </select>
        </label>
      </div>

      <dl className="metrics">
        <div>
          <dt>Comparaciones</dt>
          <dd>{integer.format(metrics.comparisons)}</dd>
        </div>
        <div>
          <dt>Intercambios</dt>
          <dd>{integer.format(metrics.swaps)}</dd>
        </div>
        <div>
          <dt>Tiempo</dt>
          <dd>{metrics.durationMs.toFixed(2)} ms</dd>
        </div>
      </dl>
    </section>
  );
}
