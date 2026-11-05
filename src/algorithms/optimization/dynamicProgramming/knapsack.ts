import type { Credito } from "../../types";

/** Resultado de la selección de cartera con la mochila 0/1. */
export interface CarteraOptima {
  /** Préstamos elegidos por el algoritmo, en el orden original del dataset. */
  creditosSeleccionados: Credito[];
  /** Suma de los intereses que generarán los préstamos elegidos (USD). */
  gananciaTotal: number;
  /** Suma de los montos de los préstamos elegidos (USD). */
  presupuestoUsado: number;
}

/** Factor para trabajar con centavos y evitar los decimales flotantes. */
const ESCALA = 100;

/** Máximo común divisor de dos enteros no negativos (algoritmo de Euclides). */
function mcd(a: number, b: number): number {
  let x = a;
  let y = b;

  while (y !== 0) {
    const resto = x % y;
    x = y;
    y = resto;
  }

  return x;
}

interface ItemMochila {
  credito: Credito;
  /** Peso del artículo: monto del préstamo en centavos, ya normalizado. */
  peso: number;
  /** Valor del artículo: ganancia por intereses en centavos. */
  valor: number;
  /** Posición original dentro del dataset, para conservar el orden. */
  orden: number;
}

const CARTERA_VACIA: CarteraOptima = {
  creditosSeleccionados: [],
  gananciaTotal: 0,
  presupuestoUsado: 0,
};

/**
 * Optimización de cartera con el problema de la mochila 0/1.
 *
 * Cada préstamo se puede tomar una sola vez (0/1). El peso es el monto del
 * préstamo y el valor es la ganancia por intereses:
 * `loanAmt * (loanIntRate / 100)`. Se maximiza la ganancia total sin que la
 * suma de los montos supere `presupuestoMaximo`.
 *
 * Los montos se multiplican por 100 (centavos) y se redondean para trabajar
 * únicamente con enteros. Además, los pesos se dividen por su máximo común
 * divisor y la capacidad se reduce en la misma proporción: el resultado es
 * idéntico, pero la tabla DP recorre muchos menos estados.
 *
 * Complejidad: O(n · W) en tiempo y O(n · W) para la traza de reconstrucción,
 * donde `n` es el número de préstamos y `W` la capacidad normalizada.
 */
export function optimizarCartera(
  creditos: Credito[],
  presupuestoMaximo: number,
): CarteraOptima {
  if (!Number.isFinite(presupuestoMaximo) || presupuestoMaximo <= 0) {
    return CARTERA_VACIA;
  }

  const presupuestoCentavos = Math.max(
    0,
    Math.round(presupuestoMaximo * ESCALA),
  );

  // Artículos válidos: monto positivo que quepa y ganancia positiva.
  const items: ItemMochila[] = creditos
    .map((credito, orden) => ({
      credito,
      orden,
      peso: Math.round(credito.loanAmt * ESCALA),
      valor: Math.round(credito.loanAmt * (credito.loanIntRate / 100) * ESCALA),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.peso) &&
        Number.isFinite(item.valor) &&
        item.peso > 0 &&
        item.peso <= presupuestoCentavos &&
        item.valor > 0,
    );

  if (items.length === 0) {
    return CARTERA_VACIA;
  }

  const divisor = items.reduce((acc, item) => mcd(acc, item.peso), 0) || 1;

  const pesos = items.map((item) => item.peso / divisor);
  const valores = items.map((item) => item.valor);
  const totalPesos = pesos.reduce((acc, peso) => acc + peso, 0);

  // Si el presupuesto alcanza para todo, no hace falta llenar la tabla.
  const capacidad = Math.min(
    Math.floor(presupuestoCentavos / divisor),
    totalPesos,
  );

  if (capacidad === totalPesos) {
    return construirResultado(items);
  }

  // Tabla DP unidimensional: dp[c] = mejor ganancia con capacidad c.
  const anchoFila = capacidad + 1;
  const dp = new Float64Array(anchoFila);

  // Traza de decisiones para reconstruir la cartera sin ambigüedad.
  // Se guarda un bit por cada par (préstamo, capacidad) para no multiplicar
  // el uso de memoria cuando el presupuesto es grande.
  const totalDecisiones = items.length * anchoFila;
  const decisiones = new Uint8Array(Math.ceil(totalDecisiones / 8));

  for (let i = 0; i < items.length; i++) {
    const peso = pesos[i];
    const valor = valores[i];
    const fila = i * anchoFila;

    // Se recorre de mayor a menor capacidad para que cada préstamo se use
    // como máximo una vez.
    for (let c = capacidad; c >= peso; c--) {
      const candidato = dp[c - peso] + valor;

      if (candidato > dp[c]) {
        dp[c] = candidato;
        const posicion = fila + c;
        decisiones[Math.floor(posicion / 8)] |= 1 << posicion % 8;
      }
    }
  }

  // Reconstrucción hacia atrás: se decide préstamo por préstamo.
  const seleccionados = new Set<number>();
  let capacidadRestante = capacidad;

  for (let i = items.length - 1; i >= 0 && capacidadRestante > 0; i--) {
    const posicion = i * anchoFila + capacidadRestante;
    const tomado =
      (decisiones[Math.floor(posicion / 8)] & (1 << posicion % 8)) !== 0;

    if (tomado) {
      seleccionados.add(i);
      capacidadRestante -= pesos[i];
    }
  }

  return construirResultado(
    items.filter((_, index) => seleccionados.has(index)),
  );
}

/** Calcula los totales visibles a partir de los préstamos elegidos. */
function construirResultado(items: ItemMochila[]): CarteraOptima {
  const elegidos = [...items].sort((a, b) => a.orden - b.orden);

  const gananciaTotal = elegidos.reduce(
    (acc, item) =>
      acc + item.credito.loanAmt * (item.credito.loanIntRate / 100),
    0,
  );

  const presupuestoUsado = elegidos.reduce(
    (acc, item) => acc + item.credito.loanAmt,
    0,
  );

  return {
    creditosSeleccionados: elegidos.map((item) => item.credito),
    gananciaTotal,
    presupuestoUsado,
  };
}
