import type { CreditStats } from "../../hooks/useCreditData";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const decimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

interface StatsCardsProps {
  stats: CreditStats;
}

interface StatCard {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const cards: StatCard[] = [
    {
      label: "Préstamos",
      value: new Intl.NumberFormat("en-US").format(stats.total),
      hint: "registros en el dataset",
    },
    {
      label: "Monto total",
      value: compactMoney.format(stats.totalMonto),
      hint: money.format(stats.totalMonto),
    },
    {
      label: "Tasa promedio",
      value: `${decimal.format(stats.tasaPromedio)}%`,
      hint: "interés anual",
    },
    {
      label: "Tasa de default",
      value: `${decimal.format(stats.porcentajeDefault)}%`,
      hint: "préstamos incumplidos",
      danger: stats.porcentajeDefault > 20,
    },
  ];

  return (
    <section className="stats" aria-label="Resumen del dataset">
      {cards.map((card) => (
        <article
          key={card.label}
          className={card.danger ? "card stat stat--danger" : "card stat"}
        >
          <span className="stat__label">{card.label}</span>
          <strong className="stat__value">{card.value}</strong>
          <span className="stat__hint">{card.hint}</span>
        </article>
      ))}
    </section>
  );
}
