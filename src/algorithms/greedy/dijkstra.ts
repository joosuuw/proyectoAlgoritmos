import type { Credito } from "../types";

/** Grado de menor riesgo desde el que siempre parte la ruta. */
export const GRADO_ORIGEN = "A";

/**
 * Número máximo de niveles que puede saltar una arista.
 *
 * El dataset no describe transiciones entre grados, así que el grafo se modela
 * como una escalera de riesgo: cada grado se conecta con los dos siguientes.
 * Sin esos atajos, el camino desde A quedaría determinado por la adyacencia y
 * Dijkstra no tendría nada que optimizar.
 */
const SALTO_MAXIMO = 2;

export interface NodoGrado {
  /** Letra del grado crediticio (`A`, `B`, `C`, …). */
  grado: string;
  /** Tasa de interés media de los préstamos de ese grado. */
  tasaPromedio: number;
  /** Cantidad de préstamos del grado que tienen una tasa válida. */
  prestamos: number;
}

export interface AristaGrado {
  /** Grado de menor riesgo de la arista. */
  desde: string;
  /** Grado de mayor riesgo de la arista. */
  hacia: string;
  /**
   * Tasa de interés media conjunta de los préstamos de ambos grados.
   * Es el costo que Dijkstra acumula al recorrer la arista.
   */
  peso: number;
}

export interface GrafoCrediticio {
  nodos: NodoGrado[];
  aristas: AristaGrado[];
  /** Vecinos de cada grado; la arista se guarda en ambos sentidos. */
  adyacencia: Map<string, AristaGrado[]>;
}

export interface ResultadoDijkstra {
  /** Grados recorridos, en orden, desde el origen hasta el destino. */
  camino: string[];
  /** Suma de los pesos de las aristas del camino. */
  costoTotal: number;
  encontrado: boolean;
  /** Nodos extraídos del montículo (visitados de forma definitiva). */
  nodosVisitados: number;
  /** Aristas relajadas durante la búsqueda. */
  aristasExploradas: number;
}

interface AcumuladoGrado {
  prestamos: number;
  sumaTasas: number;
}

/** Estado interno del nodo mientras se construye el grafo. */
interface NodoAcumulado extends AcumuladoGrado {
  grado: string;
}

const RESULTADO_VACIO: ResultadoDijkstra = {
  camino: [],
  costoTotal: 0,
  encontrado: false,
  nodosVisitados: 0,
  aristasExploradas: 0,
};

/** Agrupa los préstamos por `loan_grade` y calcula su tasa media. */
function acumularGrados(creditos: readonly Credito[]): NodoAcumulado[] {
  const grupos = new Map<string, AcumuladoGrado>();

  for (const credito of creditos) {
    const grado = credito.loanGrade.trim().toUpperCase();
    if (!grado) continue;

    const acumulado = grupos.get(grado) ?? { prestamos: 0, sumaTasas: 0 };

    // Hay registros con `loan_int_rate` vacío: no deben contar en el promedio.
    if (Number.isFinite(credito.loanIntRate) && credito.loanIntRate > 0) {
      acumulado.prestamos += 1;
      acumulado.sumaTasas += credito.loanIntRate;
    }

    grupos.set(grado, acumulado);
  }

  return [...grupos.entries()]
    .map(([grado, acumulado]) => ({ grado, ...acumulado }))
    .sort((a, b) => a.grado.localeCompare(b.grado));
}

/**
 * Construye el grafo de grados crediticios.
 *
 * Los nodos son los valores de `loan_grade` presentes en el dataset. Cada nodo
 * se conecta con los dos grados siguientes y el peso de la arista es la tasa de
 * interés media de todos los préstamos de ambos grados. El resultado es un
 * grafo no dirigido, ponderado y con pesos positivos, requisito de Dijkstra.
 */
export function construirGrafoCrediticio(
  creditos: readonly Credito[],
): GrafoCrediticio {
  const acumulados = acumularGrados(creditos);

  const nodos: NodoGrado[] = acumulados.map((acumulado) => ({
    grado: acumulado.grado,
    tasaPromedio:
      acumulado.prestamos > 0
        ? acumulado.sumaTasas / acumulado.prestamos
        : 0,
    prestamos: acumulado.prestamos,
  }));

  const aristas: AristaGrado[] = [];
  const adyacencia = new Map<string, AristaGrado[]>();

  for (const nodo of nodos) {
    adyacencia.set(nodo.grado, []);
  }

  for (let i = 0; i < acumulados.length; i++) {
    const origen = acumulados[i];

    for (
      let salto = 1;
      salto <= SALTO_MAXIMO && i + salto < acumulados.length;
      salto++
    ) {
      const destino = acumulados[i + salto];

      // Si a alguno de los dos grados le falta la tasa, la arista no se crea.
      if (origen.prestamos === 0 || destino.prestamos === 0) continue;

      const prestamos = origen.prestamos + destino.prestamos;
      const peso = (origen.sumaTasas + destino.sumaTasas) / prestamos;

      const arista: AristaGrado = {
        desde: origen.grado,
        hacia: destino.grado,
        peso,
      };

      aristas.push(arista);
      adyacencia.get(origen.grado)?.push(arista);
      adyacencia.get(destino.grado)?.push({
        desde: destino.grado,
        hacia: origen.grado,
        peso,
      });
    }
  }

  return { nodos, aristas, adyacencia };
}

interface EntradaMonticulo {
  grado: string;
  distancia: number;
}

/** Montículo binario de mínimos, implementado desde cero. */
class MonticuloMinimos {
  private datos: EntradaMonticulo[] = [];

  get tamano(): number {
    return this.datos.length;
  }

  insertar(grado: string, distancia: number): void {
    const entrada = { grado, distancia };
    this.datos.push(entrada);

    let indice = this.datos.length - 1;

    while (indice > 0) {
      const padre = (indice - 1) >> 1;

      if (this.datos[padre].distancia <= this.datos[indice].distancia) break;

      [this.datos[padre], this.datos[indice]] = [
        this.datos[indice],
        this.datos[padre],
      ];
      indice = padre;
    }
  }

  extraerMinimo(): EntradaMonticulo | undefined {
    if (this.datos.length === 0) return undefined;

    const minimo = this.datos[0];
    const ultimo = this.datos.pop();

    if (ultimo && this.datos.length > 0) {
      this.datos[0] = ultimo;
      let indice = 0;

      for (;;) {
        const izquierdo = indice * 2 + 1;
        const derecho = izquierdo + 1;
        let menor = indice;

        if (
          izquierdo < this.datos.length &&
          this.datos[izquierdo].distancia < this.datos[menor].distancia
        ) {
          menor = izquierdo;
        }

        if (
          derecho < this.datos.length &&
          this.datos[derecho].distancia < this.datos[menor].distancia
        ) {
          menor = derecho;
        }

        if (menor === indice) break;

        [this.datos[indice], this.datos[menor]] = [
          this.datos[menor],
          this.datos[indice],
        ];
        indice = menor;
      }
    }

    return minimo;
  }
}

/**
 * Camino de menor costo entre dos grados con el algoritmo de Dijkstra.
 *
 * Usa un montículo binario para extraer siempre el nodo con menor distancia
 * acumulada. Complejidad: O((V + E) log V) en tiempo y O(V + E) en espacio,
 * donde V es la cantidad de grados y E la cantidad de aristas.
 */
export function dijkstra(
  grafo: GrafoCrediticio,
  origen: string,
  destino: string,
): ResultadoDijkstra {
  const origenNormalizado = origen.trim().toUpperCase();
  const destinoNormalizado = destino.trim().toUpperCase();

  if (
    !grafo.adyacencia.has(origenNormalizado) ||
    !grafo.adyacencia.has(destinoNormalizado)
  ) {
    return RESULTADO_VACIO;
  }

  if (origenNormalizado === destinoNormalizado) {
    return {
      camino: [origenNormalizado],
      costoTotal: 0,
      encontrado: true,
      nodosVisitados: 1,
      aristasExploradas: 0,
    };
  }

  const distancias = new Map<string, number>();
  const anteriores = new Map<string, string>();
  const visitados = new Set<string>();

  for (const nodo of grafo.nodos) {
    distancias.set(nodo.grado, Number.POSITIVE_INFINITY);
  }

  distancias.set(origenNormalizado, 0);

  const monticulo = new MonticuloMinimos();
  monticulo.insertar(origenNormalizado, 0);
  let aristasExploradas = 0;

  while (monticulo.tamano > 0) {
    const actual = monticulo.extraerMinimo();
    if (!actual) break;

    // Puede haber entradas obsoletas del mismo nodo en el montículo.
    if (actual.distancia > (distancias.get(actual.grado) ?? Infinity)) {
      continue;
    }

    if (visitados.has(actual.grado)) continue;
    visitados.add(actual.grado);

    if (actual.grado === destinoNormalizado) break;

    for (const arista of grafo.adyacencia.get(actual.grado) ?? []) {
      if (visitados.has(arista.hacia)) continue;

      aristasExploradas += 1;
      const candidato = actual.distancia + arista.peso;

      if (candidato < (distancias.get(arista.hacia) ?? Infinity)) {
        distancias.set(arista.hacia, candidato);
        anteriores.set(arista.hacia, actual.grado);
        monticulo.insertar(arista.hacia, candidato);
      }
    }
  }

  const costoTotal = distancias.get(destinoNormalizado) ?? Infinity;

  if (!Number.isFinite(costoTotal)) {
    return {
      ...RESULTADO_VACIO,
      nodosVisitados: visitados.size,
      aristasExploradas,
    };
  }

  const camino: string[] = [];
  let actual: string | undefined = destinoNormalizado;

  while (actual) {
    camino.unshift(actual);
    if (actual === origenNormalizado) break;
    actual = anteriores.get(actual);
  }

  if (camino[0] !== origenNormalizado) {
    return {
      ...RESULTADO_VACIO,
      nodosVisitados: visitados.size,
      aristasExploradas,
    };
  }

  return {
    camino,
    costoTotal,
    encontrado: true,
    nodosVisitados: visitados.size,
    aristasExploradas,
  };
}
