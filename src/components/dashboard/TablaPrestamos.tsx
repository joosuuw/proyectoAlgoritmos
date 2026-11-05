import { useEffect, useState } from "react";
import type { Credito, SortKey, SortOrder } from "../../algorithms/types";

const REGISTROS_POR_PAGINA = 50;

// Mismo estilo que el botón "Borrar filtros".
const BOTON_PAGINACION = "btn btn--outline";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const decimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

function formatRate(value: number): string {
  return value > 0 ? `${decimal.format(value)}%` : "—";
}

function formatYears(value: number): string {
  const formatted = Number.isInteger(value)
    ? String(value)
    : decimal.format(value);
  return `${formatted} años`;
}

interface TablaPrestamosProps {
  /** Array ya ordenado por el algoritmo activo. */
  creditos: Credito[];
  sortKey: SortKey;
  order: SortOrder;
  /** Texto descriptivo opcional bajo el título. */
  subtitle?: string;
  /** Mensaje cuando no hay registros que mostrar. */
  emptyMessage?: string;
}

export default function TablaPrestamos({
  creditos,
  sortKey,
  order,
  subtitle,
  emptyMessage,
}: TablaPrestamosProps) {
  const [paginaActual, setPaginaActual] = useState(1);

  const totalPaginas = Math.max(
    1,
    Math.ceil(creditos.length / REGISTROS_POR_PAGINA),
  );
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const indiceInicial = (paginaSegura - 1) * REGISTROS_POR_PAGINA;
  const creditosVisibles = creditos.slice(
    indiceInicial,
    indiceInicial + REGISTROS_POR_PAGINA,
  );

  // Al cambiar de filtro, algoritmo, variable o sentido, volvemos al inicio.
  useEffect(() => {
    setPaginaActual(1);
  }, [creditos, sortKey, order]);

  function renderHeader(key: SortKey, label: string, field: string) {
    const active = sortKey === key;

    return (
      <th
        key={key}
        scope="col"
        className={active ? "is-active" : undefined}
        title={`${label} (${field})`}
        aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        {active && (
          <span className="th-indicator" aria-hidden="true">
            {order === "asc" ? "↑" : "↓"}
          </span>
        )}
      </th>
    );
  }

  return (
    <section className="card tabla-card">
      <header className="card__header">
        <div>
          <h2>Préstamos</h2>
          <p>
            {subtitle ??
              `${creditos.length} registros con todos los campos del dataset, ordenados por el algoritmo activo.`}
          </p>
        </div>
      </header>

      {creditos.length === 0 ? (
        <p className="empty-state">
          {emptyMessage ?? "No hay préstamos para mostrar."}
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="tabla">
            <thead>
              <tr>
                {renderHeader("id", "#", "id")}
                {renderHeader("personAge", "Edad", "person_age")}
                {renderHeader("personIncome", "Ingreso", "person_income")}
                <th scope="col" title="person_home_ownership">
                  Vivienda
                </th>
                {renderHeader(
                  "personEmpLength",
                  "Antigüedad laboral",
                  "person_emp_length",
                )}
                <th scope="col" title="loan_intent">
                  Intención
                </th>
                <th scope="col" title="loan_grade">
                  Grado
                </th>
                {renderHeader("loanAmt", "Monto", "loan_amnt")}
                {renderHeader("loanIntRate", "Tasa", "loan_int_rate")}
                {renderHeader("loanStatus", "Estado", "loan_status")}
                {renderHeader(
                  "loanPercentIncome",
                  "Préstamo / ingreso",
                  "loan_percent_income",
                )}
                <th scope="col" title="cb_person_default_on_file">
                  Default previo
                </th>
                {renderHeader(
                  "cbPersonCredHistLength",
                  "Historial",
                  "cb_person_cred_hist_length",
                )}
              </tr>
            </thead>
            <tbody>
              {creditosVisibles.map((credito) => (
                <tr key={credito.id}>
                  <td className="muted">{credito.id}</td>
                  <td>{credito.personAge}</td>
                  <td>{money.format(credito.personIncome)}</td>
                  <td>
                    <span className="tag">{credito.personHomeOwnership}</span>
                  </td>
                  <td>{formatYears(credito.personEmpLength)}</td>
                  <td>
                    <span className="tag">{credito.loanIntent}</span>
                  </td>
                  <td>
                    <span className="tag tag--grade">{credito.loanGrade}</span>
                  </td>
                  <td>{money.format(credito.loanAmt)}</td>
                  <td>{formatRate(credito.loanIntRate)}</td>
                  <td>
                    <span
                      className={
                        credito.loanStatus === 1
                          ? "badge badge--danger"
                          : "badge badge--ok"
                      }
                    >
                      {credito.loanStatus === 1 ? "Default" : "Pagado"}
                    </span>
                  </td>
                  <td>{percent.format(credito.loanPercentIncome)}</td>
                  <td>
                    <span
                      className={
                        credito.cbPersonDefaultOnFile === "Y"
                          ? "badge badge--danger"
                          : "badge badge--ok"
                      }
                    >
                      {credito.cbPersonDefaultOnFile === "Y" ? "Sí" : "No"}
                    </span>
                  </td>
                  <td>{formatYears(credito.cbPersonCredHistLength)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creditos.length > 0 && (
        <nav
          className="pagination flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-alt)] px-5 py-4"
          aria-label="Paginación de préstamos"
        >
          <button
            type="button"
            className={BOTON_PAGINACION}
            onClick={() =>
              setPaginaActual((pagina) => Math.max(1, pagina - 1))
            }
            disabled={paginaSegura === 1}
          >
            Anterior
          </button>

          <span
            className="text-sm font-medium text-[var(--muted)]"
            aria-live="polite"
          >
            Página{" "}
            <strong className="font-bold text-[var(--heading)]">
              {paginaSegura}
            </strong>{" "}
            de{" "}
            <strong className="font-bold text-[var(--heading)]">
              {totalPaginas}
            </strong>
            <span className="hidden sm:inline">
              {" "}
              · Mostrando {indiceInicial + 1}–
              {indiceInicial + creditosVisibles.length} de {creditos.length}
            </span>
          </span>

          <button
            type="button"
            className={BOTON_PAGINACION}
            onClick={() =>
              setPaginaActual((pagina) =>
                Math.min(totalPaginas, pagina + 1),
              )
            }
            disabled={paginaSegura === totalPaginas}
          >
            Siguiente
          </button>
        </nav>
      )}
    </section>
  );
}
