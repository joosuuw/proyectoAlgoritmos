import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  LogarithmicScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { growthValue } from "../../algorithms/analyzer/cost";
import { useAlgorithmAnalyzer } from "../../hooks/useAlgorithmAnalyzer";
import type { Theme } from "../../hooks/useTheme";

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

const SERIES_COLORS = [
  "#1d4ed8",
  "#0891b2",
  "#0d9488",
  "#d97706",
  "#dc2626",
  "#7c3aed",
];

const CHART_SIZES = Array.from({ length: 48 }, (_, index) => index + 1);

interface PanelAnalizadorProps {
  theme: Theme;
}

export default function PanelAnalizador({ theme }: PanelAnalizadorProps) {
  const {
    code,
    setCode,
    sampleId,
    loadSample,
    samples,
    result,
    error,
    notice,
    analyze,
    clear,
    comparison,
    addToComparison,
    removeFromComparison,
    clearComparison,
  } = useAlgorithmAnalyzer();

  const extensions = useMemo(() => [python()], []);

  const chartData = useMemo(
    () => ({
      labels: CHART_SIZES,
      datasets: comparison.map((entry, index) => {
        const color = SERIES_COLORS[index % SERIES_COLORS.length];
        return {
          label: `${entry.name} · ${entry.timeLabel}`,
          data: CHART_SIZES.map((size) => growthValue(entry.timeKind, size)),
          borderColor: color,
          backgroundColor: `${color}22`,
          pointRadius: 0,
          pointHoverRadius: 3,
          borderWidth: 2,
          tension: 0.25,
          fill: false,
        };
      }),
    }),
    [comparison],
  );

  const chartOptions = useMemo<ChartOptions<"line">>(() => {
    const grid =
      theme === "dark" ? "rgba(147, 197, 253, 0.14)" : "rgba(11, 37, 69, 0.09)";
    const text = theme === "dark" ? "#c7dcfb" : "#0b2545";

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: text,
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            padding: 16,
          },
        },
        tooltip: {
          callbacks: {
            label: (context) =>
              `${context.dataset.label}: ${Number(
                context.parsed.y,
              ).toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Tamaño de entrada (n)", color: text },
          grid: { color: grid },
          ticks: { color: text, maxTicksLimit: 10 },
        },
        y: {
          type: "logarithmic",
          min: 1,
          title: { display: true, text: "Operaciones (escala log)", color: text },
          grid: { color: grid },
          ticks: {
            color: text,
            callback: (value) =>
              Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 }),
          },
        },
      },
    };
  }, [theme]);

  return (
    <section className="analyzer">
      <div className="analyzer__layout">
        <article className="card panel analyzer__editor-card">
          <header className="card__header">
            <div>
              <h2>Código Python</h2>
              <p>
                Pega una función o un bloque. El parser construye un AST real:
                no se usan expresiones regulares para interpretar la sintaxis.
              </p>
            </div>
            <label className="field analyzer__sample-field">
              <span>Ejemplo</span>
              <select
                value={sampleId}
                onChange={(event) => loadSample(event.target.value)}
              >
                {samples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.group} · {sample.name}
                  </option>
                ))}
              </select>
            </label>
          </header>

          <div className="analyzer__editor">
            <CodeMirror
              value={code}
              height="340px"
              theme={theme === "dark" ? oneDark : "light"}
              extensions={extensions}
              onChange={setCode}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                foldGutter: false,
                autocompletion: false,
              }}
            />
          </div>

          {error && (
            <div className="analyzer__error" role="alert">
              <strong>No se pudo analizar el código.</strong>
              <span>{error}</span>
            </div>
          )}

          <div className="analyzer__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={analyze}
              disabled={!code.trim()}
            >
              Analizar
            </button>
            <button type="button" className="btn" onClick={clear}>
              Limpiar resultado
            </button>
            <button
              type="button"
              className="btn btn--outline"
              onClick={addToComparison}
              disabled={!result}
            >
              Añadir a comparación
            </button>
            <span className="analyzer__actions-hint">
              {result
                ? `${result.stats.lines} líneas · ${result.stats.functions} ${
                    result.stats.functions === 1 ? "función" : "funciones"
                  }`
                : "El análisis es estático y asume el peor caso."}
            </span>
          </div>
        </article>

        <aside className="analyzer__side">
          <article className="card panel analyzer__guide">
            <h2>Qué detecta</h2>
            <ul>
              <li>Ordenamiento y búsqueda</li>
              <li>Grafos y árboles</li>
              <li>DP, backtracking y greedy</li>
              <li>Divide y vencerás y recursión</li>
            </ul>
            <p>
              Combina la firma estructural del AST (bucles, llamadas, imports,
              subíndices) con heurísticas de nombres y estructuras auxiliares.
            </p>
          </article>

          <article className="card panel analyzer__guide analyzer__guide--accent">
            <h2>Reglas clave</h2>
            <ul>
              <li>
                <code>for</code> anidados → producto de iteraciones.
              </li>
              <li>
                <code>while n &gt; 0: n //= 2</code> → O(log n).
              </li>
              <li>
                <code>append</code> → O(1) amortizado.
              </li>
              <li>
                <code>in</code> sobre lista → O(n); sobre set/dict → O(1) promedio.
              </li>
              <li>
                Dijkstra con heap → O((V+E) log V).
              </li>
            </ul>
          </article>
        </aside>
      </div>

      {result && (
        <div className="analyzer__result">
          <article className="card panel analyzer__summary">
            <div className="analyzer__summary-main">
              <span className="analyzer__category">{result.category}</span>
              <h2>{result.name}</h2>
              <p>{result.summary}</p>
              <div className="analyzer__confidence">
                <span>Confianza del patrón</span>
                <div
                  className="analyzer__bar"
                  role="img"
                  aria-label={`${Math.round(result.confidence * 100)}% de confianza`}
                >
                  <span
                    style={{ width: `${Math.round(result.confidence * 100)}%` }}
                  />
                </div>
                <strong>{Math.round(result.confidence * 100)}%</strong>
              </div>
            </div>

            <div className="analyzer__complexities">
              <div className="complexity complexity--time">
                <span>Tiempo</span>
                <strong>{result.time.label}</strong>
              </div>
              <div className="complexity complexity--space">
                <span>Espacio</span>
                <strong>{result.space.label}</strong>
              </div>
            </div>
          </article>

          <div className="analyzer__meta-grid">
            <article className="card panel analyzer__chips">
              <h3>Evidencia</h3>
              <div className="analyzer__chip-list">
                {result.evidence.map((item) => (
                  <span key={item} className="analyzer__chip">
                    {item}
                  </span>
                ))}
              </div>
            </article>

            <article className="card panel analyzer__chips">
              <h3>Estructuras auxiliares</h3>
              {result.structures.length > 0 ? (
                <div className="analyzer__chip-list">
                  {result.structures.map((item) => (
                    <span
                      key={item}
                      className="analyzer__chip analyzer__chip--soft"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="analyzer__muted">
                  No se detectaron estructuras auxiliares; el algoritmo parece
                  trabajar in situ.
                </p>
              )}
            </article>
          </div>

          <article className="card panel analyzer__stats">
            <dl className="metrics">
              <div>
                <dt>Líneas</dt>
                <dd>{result.stats.lines}</dd>
              </div>
              <div>
                <dt>Bucles</dt>
                <dd>
                  {result.stats.loops}
                  <span className="analyzer__metric-hint">
                    {" "}
                    · prof. {result.stats.maxLoopDepth}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Llamadas</dt>
                <dd>
                  {result.stats.calls}
                  <span className="analyzer__metric-hint">
                    {" "}
                    · recursivas {result.stats.recursiveCalls}
                  </span>
                </dd>
              </div>
            </dl>
          </article>

          <article className="card analyzer__table-card">
            <header className="card__header">
              <div>
                <h2>Componentes del algoritmo</h2>
                <p>
                  Costo por línea o bloque, con la justificación que lo respalda.
                </p>
              </div>
            </header>
            <div className="table-wrapper analyzer__table-wrapper">
              <table className="tabla analyzer__table">
                <thead>
                  <tr>
                    <th>Línea</th>
                    <th>Tipo</th>
                    <th>Costo temporal</th>
                    <th>Costo espacial</th>
                    <th>Justificación</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={`${row.line}-${row.type}-${index}`}>
                      <td className="analyzer__line-cell">
                        <span className="analyzer__line">L{row.line}</span>
                        <code>{row.code}</code>
                      </td>
                      <td>
                        <span className="analyzer__type">{row.type}</span>
                        {row.depth > 0 && (
                          <span className="analyzer__depth">
                            nivel {row.depth}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="analyzer__cost">{row.time}</span>
                      </td>
                      <td>
                        <span className="analyzer__cost analyzer__cost--space">
                          {row.space}
                        </span>
                      </td>
                      <td className="analyzer__reason">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          {result.recurrence && (
            <article className="card panel analyzer__recurrence">
              <header className="card__header">
                <div>
                  <h2>Recurrencia y árbol de llamadas</h2>
                  <p>
                    {result.recurrence.method}: cada nivel reparte el trabajo de
                    forma distinta.
                  </p>
                </div>
                <span className="analyzer__category">
                  {result.recurrence.method}
                </span>
              </header>

              <div className="recurrence__equation">
                {result.recurrence.equation}
              </div>

              {result.recurrence.master && (
                <div className="recurrence__master">
                  <span className="recurrence__case">
                    Caso {result.recurrence.master.case}
                  </span>
                  <p>{result.recurrence.master.explanation}</p>
                  <strong>{result.recurrence.master.result}</strong>
                </div>
              )}

              <div className="table-wrapper recurrence__table-wrapper">
                <table className="tabla recurrence__table">
                  <thead>
                    <tr>
                      <th>Nivel</th>
                      <th>Nodos</th>
                      <th>Trabajo por nodo</th>
                      <th>Total del nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.recurrence.levels.map((level) => (
                      <tr key={level.level}>
                        <td>{level.level}</td>
                        <td>{level.nodes}</td>
                        <td>{level.work}</td>
                        <td>{level.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <dl className="metrics recurrence__metrics">
                <div>
                  <dt>Altura</dt>
                  <dd>{result.recurrence.height}</dd>
                </div>
                <div>
                  <dt>Hojas</dt>
                  <dd>{result.recurrence.leaves}</dd>
                </div>
                <div>
                  <dt>Espacio</dt>
                  <dd>{result.space.label}</dd>
                </div>
              </dl>

              <p className="analyzer__note">{result.recurrence.spaceNote}</p>
            </article>
          )}

          <div className="analyzer__bottom-grid">
            <article className="card panel analyzer__notes-card">
              <h2>Observaciones</h2>
              <ul>
                {result.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </article>

            <article className="card panel analyzer__callgraph-card">
              <h2>Grafo de llamadas</h2>
              {result.callGraph.length > 0 ? (
                <ul className="callgraph">
                  {result.callGraph.map((edge) => (
                    <li
                      key={`${edge.from}-${edge.to}`}
                      className={
                        edge.from === edge.to
                          ? "callgraph__edge callgraph__edge--recursive"
                          : "callgraph__edge"
                      }
                    >
                      <span>{edge.from}</span>
                      <span aria-hidden="true">→</span>
                      <span>{edge.to}</span>
                      {edge.from === edge.to && (
                        <em>recursión</em>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="analyzer__muted">
                  No hay llamadas a otras funciones del fragmento. Puede ser un
                  algoritmo iterativo o una única función recursiva.
                </p>
              )}
              <p className="analyzer__note">
                Cada flecha indica una dependencia detectada en el AST. Las
                llamadas a funciones de la biblioteca estándar no se dibujan.
              </p>
            </article>
          </div>
        </div>
      )}

      <article className="card panel analyzer__comparison">
        <header className="card__header">
          <div>
            <h2>Comparación de algoritmos</h2>
            <p>
              Analiza un fragmento, añádelo y repite con otro. La gráfica usa
              escala logarítmica para comparar crecimientos muy distintos.
            </p>
          </div>
          <div className="analyzer__comparison-actions">
            <button
              type="button"
              className="btn btn--outline"
              onClick={addToComparison}
              disabled={!result}
            >
              Añadir resultado actual
            </button>
            <button
              type="button"
              className="btn"
              onClick={clearComparison}
              disabled={comparison.length === 0}
            >
              Vaciar
            </button>
          </div>
        </header>

        {notice && <p className="analyzer__notice">{notice}</p>}

        {comparison.length === 0 ? (
          <p className="empty-state">
            Todavía no hay algoritmos en la comparación. Analiza un fragmento y
            pulsa «Añadir resultado actual».
          </p>
        ) : (
          <>
            <div className="comparison__cards">
              {comparison.map((entry, index) => (
                <div key={entry.id} className="comparison__card">
                  <span
                    className="comparison__dot"
                    style={{
                      background: SERIES_COLORS[index % SERIES_COLORS.length],
                    }}
                    aria-hidden="true"
                  />
                  <div className="comparison__card-info">
                    <strong>{entry.name}</strong>
                    <span>{entry.category}</span>
                    <div className="comparison__metrics">
                      <code>{entry.timeLabel}</code>
                      <code>{entry.spaceLabel}</code>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="comparison__remove"
                    onClick={() => removeFromComparison(entry.id)}
                    aria-label={`Quitar ${entry.name} de la comparación`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {comparison.length >= 2 ? (
              <div className="comparison__chart">
                <Line data={chartData} options={chartOptions} />
              </div>
            ) : (
              <p className="comparison__hint">
                Añade al menos otro algoritmo para ver la gráfica comparativa.
              </p>
            )}
          </>
        )}
      </article>
    </section>
  );
}
