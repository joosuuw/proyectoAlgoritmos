import type { Credito } from "../../algorithms/types";

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

const decimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

interface TablaCarteraOptimaProps {
  /** Solo los préstamos elegidos por el algoritmo. */
  creditos: Credito[];
  /** Presupuesto con el que se ejecutó la optimización. */
  presupuesto: number;
  /** Algoritmo que generó la selección (mochila DP o voraz). */
  algoritmoLabel: string;
}

export default function TablaCarteraOptima({
  creditos,
  presupuesto,
  algoritmoLabel,
}: TablaCarteraOptimaProps) {
  const totalGanancia = creditos.reduce(
    (acc, credito) =>
      acc + credito.loanAmt * (credito.loanIntRate / 100),
    0,
  );

  return (
    <section className="card tabla-card">
      <header className="card__header">
        <div>
          <h2>Cartera seleccionada</h2>
          <p>
            Resultado de {algoritmoLabel}: {creditos.length}{" "}
            {creditos.length === 1
              ? "préstamo seleccionado"
              : "préstamos seleccionados"}{" "}
            para un presupuesto de {money.format(presupuesto)}. Ganancia total
            por intereses: {moneyExact.format(totalGanancia)}.
          </p>
        </div>
      </header>

      {creditos.length === 0 ? (
        <p className="empty-state">
          El presupuesto no alcanza para ningún préstamo con ganancia positiva.
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col" title="id">
                  #
                </th>
                <th scope="col" title="person_age">
                  Edad
                </th>
                <th scope="col" title="loan_amnt">
                  Monto
                </th>
                <th scope="col" title="loan_int_rate">
                  Tasa
                </th>
                <th scope="col" title="ganancia generada">
                  Ganancia generada
                </th>
              </tr>
            </thead>
            <tbody>
              {creditos.map((credito) => {
                const ganancia =
                  credito.loanAmt * (credito.loanIntRate / 100);

                return (
                  <tr key={credito.id}>
                    <td className="muted">{credito.id}</td>
                    <td>{credito.personAge}</td>
                    <td>{money.format(credito.loanAmt)}</td>
                    <td>{decimal.format(credito.loanIntRate)}%</td>
                    <td className="cartera__ganancia">
                      {moneyExact.format(ganancia)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
