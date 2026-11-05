import { useMemo, useState, type FormEvent } from "react";
import {
  GRADO_ORIGEN,
  construirGrafoCrediticio,
  dijkstra,
  type GrafoCrediticio,
  type ResultadoDijkstra,
} from "../algorithms/greedy";
import type { Credito } from "../algorithms/types";

const decimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const oneDecimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat("en-US");

const ANCHO = 900;
const ALTO = 280;
const MARGEN_X = 68;
const Y_NODO = 145;

interface Posicion {
  x: number;
  y: number;
}

interface GrafoRiesgoProps {
  grafo: GrafoCrediticio;
  camino: string[];
  destino: string;
}

function claveArista(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function crearPosiciones(grafo: GrafoCrediticio): Map<string, Posicion> {
  const total = grafo.nodos.length;
  const anchoDisponible = ANCHO - MARGEN_X * 2;

  return new Map(
    grafo.nodos.map((nodo, indice) => [
      nodo.grado,
      {
        x:
          total <= 1
            ? ANCHO / 2
            : MARGEN_X + (indice * anchoDisponible) / (total - 1),
        y: Y_NODO,
      },
    ]),
  );
}

function GrafoRiesgo({ grafo, camino, destino }: GrafoRiesgoProps) {
  const posiciones = crearPosiciones(grafo);
  const indices = new Map(
    grafo.nodos.map((nodo, indice) => [nodo.grado, indice]),
  );
  const aristasCamino = new Set<string>();

  for (let i = 0; i < camino.length - 1; i++) {
    aristasCamino.add(claveArista(camino[i], camino[i + 1]));
  }

  return (
    <div className="grafo__canvas">
      <svg
        className="grafo__svg"
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-label={
          camino.length > 0
            ? `Grafo de grados crediticios con el camino ${camino.join(" a ")} resaltado.`
            : "Grafo de grados crediticios conectados por su tasa de interés promedio."
        }
      >
        <title>
          Grados crediticios: cada nodo muestra su tasa media y cada arista su
          tasa conjunta.
        </title>

        <g className="grafo__aristas">
          {grafo.aristas.map((arista) => {
            const desde = posiciones.get(arista.desde);
            const hacia = posiciones.get(arista.hacia);

            if (!desde || !hacia) return null;

            const indiceDesde = indices.get(arista.desde) ?? 0;
            const indiceHacia = indices.get(arista.hacia) ?? 0;
            const esArco = Math.abs(indiceHacia - indiceDesde) > 1;
            const controlX = (desde.x + hacia.x) / 2;
            const controlY = desde.y - 82;

            const d = esArco
              ? `M ${desde.x} ${desde.y} Q ${controlX} ${controlY} ${hacia.x} ${hacia.y}`
              : `M ${desde.x} ${desde.y} L ${hacia.x} ${hacia.y}`;

            const activa = aristasCamino.has(
              claveArista(arista.desde, arista.hacia),
            );

            // Punto medio de la curva cuadrática para colocar la etiqueta.
            const etiquetaX = esArco
              ? (desde.x + 2 * controlX + hacia.x) / 4
              : (desde.x + hacia.x) / 2;
            const etiquetaY = esArco
              ? (desde.y + 2 * controlY + hacia.y) / 4 - 6
              : (desde.y + hacia.y) / 2 - 8;

            return (
              <g key={`${arista.desde}-${arista.hacia}`}>
                <path
                  className={
                    activa ? "grafo__arista is-active" : "grafo__arista"
                  }
                  d={d}
                />
                {activa && (
                  <text
                    className="grafo__peso"
                    x={etiquetaX}
                    y={etiquetaY}
                    textAnchor="middle"
                  >
                    {decimal.format(arista.peso)}%
                  </text>
                )}
              </g>
            );
          })}
        </g>

        <g className="grafo__nodos">
          {grafo.nodos.map((nodo) => {
            const posicion = posiciones.get(nodo.grado);
            if (!posicion) return null;

            const enCamino = camino.includes(nodo.grado);
            const esDestino = nodo.grado === destino;
            const clases = [
              "grafo__nodo",
              enCamino ? "is-path" : "",
              esDestino ? "is-target" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <g
                key={nodo.grado}
                className={clases}
                transform={`translate(${posicion.x} ${posicion.y})`}
              >
                {esDestino && <circle className="grafo__halo" r="32" />}
                <circle className="grafo__nodo-circulo" r="24" />
                <text
                  className="grafo__nodo-letra"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {nodo.grado}
                </text>
                <text
                  className="grafo__nodo-tasa"
                  y="43"
                  textAnchor="middle"
                >
                  {oneDecimal.format(nodo.tasaPromedio)}%
                </text>
                <text
                  className="grafo__nodo-cantidad"
                  y="58"
                  textAnchor="middle"
                >
                  {integer.format(nodo.prestamos)} prést.
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

interface GrafoProps {
  creditos: Credito[];
}

interface CalculoRuta {
  resultado: ResultadoDijkstra;
  destino: string;
}

export default function Grafo({ creditos }: GrafoProps) {
  const grafo = useMemo(() => construirGrafoCrediticio(creditos), [creditos]);

  const destinos = useMemo(
    () => grafo.nodos.filter((nodo) => nodo.grado !== GRADO_ORIGEN),
    [grafo],
  );

  const [destino, setDestino] = useState("F");
  const [calculo, setCalculo] = useState<CalculoRuta | null>(null);

  const destinoSeleccionado = destinos.some(
    (nodo) => nodo.grado === destino,
  )
    ? destino
    : (destinos[0]?.grado ?? "");

  const destinoResaltado = calculo?.destino ?? destinoSeleccionado;

  function calcular(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!destinoSeleccionado) return;

    setCalculo({
      resultado: dijkstra(grafo, GRADO_ORIGEN, destinoSeleccionado),
      destino: destinoSeleccionado,
    });
  }

  if (
    destinos.length === 0 ||
    !grafo.adyacencia.has(GRADO_ORIGEN)
  ) {
    return (
      <section className="card panel">
        <header className="card__header">
          <div>
            <h2>Análisis de grafo con Dijkstra</h2>
            <p>
              El grafo se construye a partir de los grados crediticios del
              dataset.
            </p>
          </div>
        </header>

        <p className="empty-state">
          No hay suficientes grados crediticios para construir el grafo. Se
          necesita al menos el grado A y otro grado con tasa de interés.
        </p>
      </section>
    );
  }

  const nodoOrigen = grafo.nodos.find(
    (nodo) => nodo.grado === GRADO_ORIGEN,
  );
  const nodoDestino = calculo
    ? grafo.nodos.find((nodo) => nodo.grado === calculo.destino)
    : undefined;

  const detalle =
    calculo && calculo.resultado.encontrado
      ? calculo.resultado.camino.slice(0, -1).map((grado, indice) => {
          const siguiente = calculo.resultado.camino[indice + 1];
          const arista = grafo.aristas.find(
            (candidata) =>
              (candidata.desde === grado && candidata.hacia === siguiente) ||
              (candidata.desde === siguiente && candidata.hacia === grado),
          );

          return {
            desde: grado,
            hacia: siguiente,
            peso: arista?.peso ?? 0,
          };
        })
      : [];

  return (
    <section className="card panel">
      <header className="card__header">
        <div>
          <h2>Análisis de grafo con Dijkstra</h2>
          <p>
            Encuentra la ruta de menor riesgo crediticio desde el grado A hasta
            el grado que elijas.
          </p>
        </div>
      </header>

      <form className="search-form" onSubmit={calcular}>
        <div className="panel__controls grafo__controls">
          <label className="field">
            <span>Grado de destino</span>
            <select
              value={destinoSeleccionado}
              onChange={(event) => {
                setDestino(event.target.value);
                setCalculo(null);
              }}
            >
              {destinos.map((nodo) => (
                <option key={nodo.grado} value={nodo.grado}>
                  Grado {nodo.grado} · tasa media{" "}
                  {oneDecimal.format(nodo.tasaPromedio)}%
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="panel__actions">
          <button type="submit" className="btn btn--primary">
            Calcular Ruta de Menor Riesgo
          </button>
        </div>
      </form>

      <p className="grafo__note">
        Cada grado se conecta con los dos siguientes. El peso de una arista es
        la tasa de interés media de los préstamos de ambos grados; el costo
        total es la suma de las aristas del camino elegido.
      </p>

      <GrafoRiesgo
        grafo={grafo}
        camino={calculo?.resultado.camino ?? []}
        destino={destinoResaltado}
      />

      {calculo && !calculo.resultado.encontrado && (
        <div className="search-result search-result--error" role="alert">
          No existe una ruta entre el grado {GRADO_ORIGEN} y el grado{" "}
          {calculo.destino}.
        </div>
      )}

      {calculo && calculo.resultado.encontrado && (
        <div aria-live="polite">
          <div className="search-result search-result--found">
            <div className="search-result__headline">
              <span className="badge badge--ok">Ruta encontrada</span>
              <span>
                Menor costo acumulado desde el grado {GRADO_ORIGEN} hasta el
                grado {calculo.destino}.
              </span>
            </div>

            <ol
              className="grafo__camino"
              aria-label="Camino de menor riesgo crediticio"
            >
              {calculo.resultado.camino.map((grado, indice) => (
                <li key={`${grado}-${indice}`} className="grafo__paso">
                  <span className="grafo__grado">{grado}</span>
                  {indice < calculo.resultado.camino.length - 1 && (
                    <span className="grafo__flecha" aria-hidden="true">
                      →
                    </span>
                  )}
                </li>
              ))}
            </ol>

            <dl className="metrics">
              <div>
                <dt>Costo total acumulado</dt>
                <dd>{decimal.format(calculo.resultado.costoTotal)} pts</dd>
              </div>
              <div>
                <dt>Saltos del camino</dt>
                <dd>{integer.format(calculo.resultado.camino.length - 1)}</dd>
              </div>
              <div>
                <dt>Nodos visitados</dt>
                <dd>
                  {integer.format(calculo.resultado.nodosVisitados)} de{" "}
                  {integer.format(grafo.nodos.length)}
                </dd>
              </div>
            </dl>

            <ul className="grafo__detalle" aria-label="Costo de cada arista">
              {detalle.map((paso, indice) => (
                <li key={`${paso.desde}-${paso.hacia}-${indice}`}>
                  <span>
                    {paso.desde} → {paso.hacia}
                  </span>
                  <strong>{decimal.format(paso.peso)}%</strong>
                </li>
              ))}
            </ul>

            <section
              className="grafo__contexto"
              aria-label="Interpretación del resultado"
            >
              <h3>¿Qué significa este resultado?</h3>

              <p>
                El grado <strong>{GRADO_ORIGEN}</strong> reúne los préstamos de
                menor riesgo del modelo, con una tasa media del{" "}
                <strong>
                  {oneDecimal.format(nodoOrigen?.tasaPromedio ?? 0)}%
                </strong>
                . El grado <strong>{calculo.destino}</strong> tiene una tasa
                media del{" "}
                <strong>
                  {oneDecimal.format(nodoDestino?.tasaPromedio ?? 0)}%
                </strong>
                . El algoritmo buscó la forma de llegar de {GRADO_ORIGEN} a{" "}
                {calculo.destino} pagando la menor suma de tasas posible y
                encontró{" "}
                <strong>{calculo.resultado.camino.join(" → ")}</strong>.
              </p>

              <p>
                El costo de{" "}
                <strong>
                  {decimal.format(calculo.resultado.costoTotal)} puntos
                </strong>{" "}
                es la suma de las tasas promedio de cada salto. En palabras
                sencillas, es el “peaje” acumulado por avanzar entre niveles de
                riesgo: cuanto más bajo sea, más barato resulta moverse de un
                grado a otro. Que la ruta salte algunos grados significa que esa
                combinación resultó más económica, no que los demás grados no
                existan.
              </p>

              <p>
                Para el proyecto de riesgo crediticio, esto permite ver cómo
                sube el costo del crédito entre segmentos y qué grados
                intermedios aparecen al pasar de un perfil de bajo riesgo a uno
                de mayor riesgo. <strong>No es una probabilidad de impago ni una
                recomendación para aprobar o rechazar préstamos</strong>: es una
                comparación basada en las tasas de interés del dataset.
              </p>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
