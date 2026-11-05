import type { CarteraOptima } from "../optimization/dynamicProgramming/knapsack";
import type { Credito } from "../types";

/** Factor para comparar montos en centavos y evitar decimales flotantes. */
const ESCALA = 100;

interface ItemVoraz {
  credito: Credito;
  /** Posición original dentro del dataset, para conservar el orden al mostrar. */
  orden: number;
  /** Monto del préstamo en centavos. */
  peso: number;
  /** Ganancia por intereses: `loanAmt * (loanIntRate / 100)`. */
  ganancia: number;
}

const CARTERA_VACIA: CarteraOptima = {
  creditosSeleccionados: [],
  gananciaTotal: 0,
  presupuestoUsado: 0,
};

/**
 * Optimización de cartera con un algoritmo voraz (Greedy).
 *
 * Para cada préstamo se calcula su ganancia por intereses:
 * `loanAmt * (loanIntRate / 100)`. Luego se ordenan de mayor a menor ganancia
 * (y, en caso de empate, de mayor a menor tasa) y se recorre la lista tomando
 * cada préstamo que todavía quepa en el presupuesto.
 *
 * Es más rápido que la mochila 0/1 —O(n log n) por la ordenación—, pero no
 * garantiza la ganancia máxima: puede dejar fuera una combinación mejor porque
 * decide con una sola pasada y sin volver atrás.
 */
export function optimizarCarteraGreedy(
  creditos: Credito[],
  presupuestoMaximo: number,
): CarteraOptima {
  if (!Number.isFinite(presupuestoMaximo) || presupuestoMaximo <= 0) {
    return { ...CARTERA_VACIA, creditosSeleccionados: [] };
  }

  const presupuestoCentavos = Math.round(presupuestoMaximo * ESCALA);

  const items: ItemVoraz[] = creditos
    .map((credito, orden) => ({
      credito,
      orden,
      peso: Math.round(credito.loanAmt * ESCALA),
      ganancia: credito.loanAmt * (credito.loanIntRate / 100),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.peso) &&
        Number.isFinite(item.ganancia) &&
        item.peso > 0 &&
        item.ganancia > 0,
    );

  if (items.length === 0) {
    return { ...CARTERA_VACIA, creditosSeleccionados: [] };
  }

  items.sort(
    (a, b) =>
      b.ganancia - a.ganancia ||
      b.credito.loanIntRate - a.credito.loanIntRate ||
      a.orden - b.orden,
  );

  const seleccionados: ItemVoraz[] = [];
  let presupuestoRestante = presupuestoCentavos;

  for (const item of items) {
    // Si no cabe, se prueba con el siguiente; no se detiene la búsqueda.
    if (item.peso > presupuestoRestante) continue;

    seleccionados.push(item);
    presupuestoRestante -= item.peso;
  }

  // La tabla muestra los préstamos en el mismo orden que el dataset.
  seleccionados.sort((a, b) => a.orden - b.orden);

  return {
    creditosSeleccionados: seleccionados.map((item) => item.credito),
    gananciaTotal: seleccionados.reduce(
      (total, item) => total + item.ganancia,
      0,
    ),
    presupuestoUsado: seleccionados.reduce(
      (total, item) => total + item.credito.loanAmt,
      0,
    ),
  };
}
