import { useState } from "react";
import { optimizarCarteraGreedy } from "../algorithms/greedy";
import {
  optimizarCartera,
  type CarteraOptima,
} from "../algorithms/optimization";
import type { Credito } from "../algorithms/types";
import TablaCarteraOptima from "../components/dashboard/TablaCarteraOptima";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const moneyExact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("en-US");

type AlgoritmoId = "dp" | "greedy";

const NOMBRES_ALGORITMO: Record<AlgoritmoId, string> = {
  dp: "Mochila 0/1 (DP)",
  greedy: "Voraz (Greedy)",
};

interface OptimizacionProps {
  creditos: Credito[];
}

interface MetricasAlgoritmo {
  tiempoMs: number;
  gananciaTotal: number;
  cantidadPrestamos: number;
  presupuestoUsado: number;
}

type Comparacion = Record<AlgoritmoId, MetricasAlgoritmo | null>;

interface ResultadoOptimizacion {
  cartera: CarteraOptima;
  presupuesto: number;
  algoritmo: AlgoritmoId;
}

interface FilaComparacion {
  id: AlgoritmoId;
  nombre: string;
  metricas: MetricasAlgoritmo | null;
}

function formatearTiempo(tiempoMs: number): string {
  if (tiempoMs < 0.01) return "< 0.01 ms";
  return `${tiempoMs.toFixed(2)} ms`;
}

export default function Optimizacion({ creditos }: OptimizacionProps) {
  const [presupuesto, setPresupuesto] = useState("50000");
  const [comparacion, setComparacion] = useState<Comparacion>({
    dp: null,
    greedy: null,
  });
  const [resultado, setResultado] = useState<ResultadoOptimizacion | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  function calcular(algoritmo: AlgoritmoId) {
    const valor = Number.parseFloat(presupuesto);

    if (!Number.isFinite(valor) || valor <= 0) {
      setError("Ingresa un presupuesto mayor que cero.");
      setResultado(null);
      return;
    }

    setError(null);

    const inicio = performance.now();
    const cartera =
      algoritmo === "dp"
        ? optimizarCartera(creditos, valor)
        : optimizarCarteraGreedy(creditos, valor);
    const tiempoMs = performance.now() - inicio;

    setResultado({ cartera, presupuesto: valor, algoritmo });
    setComparacion((actual) => ({
      ...actual,
      [algoritmo]: {
        tiempoMs,
        gananciaTotal: cartera.gananciaTotal,
        cantidadPrestamos: cartera.creditosSeleccionados.length,
        presupuestoUsado: cartera.presupuestoUsado,
      },
    }));
  }

  const filas: FilaComparacion[] = [
    {
      id: "dp",
      nombre: NOMBRES_ALGORITMO.dp,
      metricas: comparacion.dp,
    },
    {
      id: "greedy",
      nombre: NOMBRES_ALGORITMO.greedy,
      metricas: comparacion.greedy,
    },
  ];

  const hayComparacion =
    comparacion.dp !== null && comparacion.greedy !== null;
  const mejorGanancia = hayComparacion
    ? Math.max(
        comparacion.dp?.gananciaTotal ?? 0,
        comparacion.greedy?.gananciaTotal ?? 0,
      )
    : null;

  const etiquetaResultado = resultado
    ? NOMBRES_ALGORITMO[resultado.algoritmo]
    : null;

  return (
    <>
      <section className="card panel">
        <header className="card__header">
          <div>
            <h2>Optimización</h2>
            <p>
              Compara la mochila 0/1 resuelta con programación dinámica y un
              algoritmo voraz para elegir la cartera de préstamos más rentable
              sin superar el presupuesto.
            </p>
          </div>
        </header>

        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            calcular("dp");
          }}
        >
          <div className="panel__controls optimizacion__controls">
            <label className="field">
              <span>Presupuesto disponible (USD)</span>
              <input
                type="number"
                min="0"
                step="100"
                value={presupuesto}
                onChange={(event) => setPresupuesto(event.target.value)}
              />
            </label>
          </div>

          <div className="panel__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => calcular("dp")}
            >
              Calcular con Mochila (DP)
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => calcular("greedy")}
            >
              Calcular con Voraz (Greedy)
            </button>
          </div>
        </form>

        <section
          className="comparacion"
          aria-label="Resultados de la comparación"
          aria-live="polite"
        >
          <header className="comparacion__header">
            <h3>Resultados de la comparación</h3>
            <p>
              Ejecuta ambos algoritmos con el mismo presupuesto para comparar
              tiempo, ganancia y cantidad de préstamos.
            </p>
          </header>

          <div className="comparacion__tabla-wrapper">
            <table className="comparacion__tabla">
              <thead>
                <tr>
                  <th scope="col">Algoritmo</th>
                  <th scope="col">Tiempo de ejecución</th>
                  <th scope="col">Ganancia total</th>
                  <th scope="col">Cantidad de préstamos</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => {
                  const esMejor =
                    hayComparacion &&
                    fila.metricas !== null &&
                    fila.metricas.gananciaTotal === mejorGanancia;

                  return (
                    <tr
                      key={fila.id}
                      className={esMejor ? "is-best" : undefined}
                    >
                      <td>
                        <span className="comparacion__algoritmo">
                          {fila.nombre}
                        </span>
                        {esMejor && (
                          <span className="tag comparacion__badge">
                            Mayor ganancia
                          </span>
                        )}
                      </td>
                      <td>
                        {fila.metricas ? (
                          formatearTiempo(fila.metricas.tiempoMs)
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td
                        className={
                          fila.metricas
                            ? "comparacion__ganancia"
                            : "muted"
                        }
                      >
                        {fila.metricas
                          ? moneyExact.format(fila.metricas.gananciaTotal)
                          : "—"}
                      </td>
                      <td>
                        {fila.metricas ? (
                          integer.format(fila.metricas.cantidadPrestamos)
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="comparacion__nota">
            La mochila 0/1 busca la mejor combinación posible. El voraz ordena
            los préstamos por ganancia y toma los que caben, sin volver atrás:
            suele ser más rápido, pero puede obtener una ganancia menor.
          </p>
        </section>

        <p className="optimizacion__note">
          En ambos casos cada préstamo se toma o se descarta (mochila 0/1), el
          peso es el monto solicitado y el valor es la ganancia por intereses.
          La tabla inferior muestra el resultado del último botón presionado.
        </p>

        {error && (
          <div className="search-result search-result--error" role="alert">
            {error}
          </div>
        )}

        {resultado && !error && (
          <div aria-live="polite">
            <p className="optimizacion__ultimo">
              Último cálculo: <strong>{etiquetaResultado}</strong>
            </p>

            <section
              className="stats stats--three"
              aria-label="Resultado de la optimización"
            >
              <article className="card stat">
                <span className="stat__label">Presupuesto usado</span>
                <strong className="stat__value">
                  {money.format(resultado.cartera.presupuestoUsado)}
                </strong>
                <span className="stat__hint">
                  de {money.format(resultado.presupuesto)} disponibles
                </span>
              </article>

              <article className="card stat">
                <span className="stat__label">Ganancia estimada</span>
                <strong className="stat__value stat__value--ok">
                  {moneyExact.format(resultado.cartera.gananciaTotal)}
                </strong>
                <span className="stat__hint">intereses generados</span>
              </article>

              <article className="card stat">
                <span className="stat__label">Préstamos seleccionados</span>
                <strong className="stat__value">
                  {integer.format(
                    resultado.cartera.creditosSeleccionados.length,
                  )}
                </strong>
                <span className="stat__hint">
                  de {integer.format(creditos.length)} préstamos evaluados
                </span>
              </article>
            </section>
          </div>
        )}
      </section>

      {resultado && !error && etiquetaResultado && (
        <TablaCarteraOptima
          creditos={resultado.cartera.creditosSeleccionados}
          presupuesto={resultado.presupuesto}
          algoritmoLabel={etiquetaResultado}
        />
      )}
    </>
  );
}
