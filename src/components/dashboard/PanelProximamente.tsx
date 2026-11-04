export default function PanelProximamente() {
  return (
    <section className="card panel panel--coming-soon">
      <div className="coming-soon">
        <span className="coming-soon__icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <circle cx="12" cy="12" r="8.5" />
            <path
              d="M12 7.5V12l3.2 2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h2>Próximamente</h2>
        <p>Se agregarán más módulos</p>
      </div>
    </section>
  );
}
