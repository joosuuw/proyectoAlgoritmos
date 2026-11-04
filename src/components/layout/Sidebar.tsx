import type { ReactNode } from "react";
import type { Theme } from "../../hooks/useTheme";

export type ModuleId =
  | "analizador"
  | "ordenamiento"
  | "busqueda"
  | "proximamente";

interface SidebarProps {
  active: ModuleId;
  onChange: (module: ModuleId) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

interface ModuleItem {
  id: ModuleId;
  label: string;
  icon: ReactNode;
}

const MODULES: ModuleItem[] = [
  {
    id: "ordenamiento",
    label: "Ordenamiento",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 7h13M4 12h9M4 17h5" strokeLinecap="round" />
        <path d="M18 12v7m0 0 2.5-2.5M18 19l-2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "busqueda",
    label: "Búsqueda",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 4.5 4.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "proximamente",
    label: "Próximamente",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4.5l3 1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const ANALYZER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function CatIllustration() {
  return (
    <svg
      className="sidebar__cat"
      viewBox="0 0 220 220"
      fill="none"
      role="img"
      aria-label="Ilustración de un gato"
    >
      <path
        d="M40 110c4-10 9-16 16-19l6-45 31 33c9-4 25-4 34 0l31-33 6 45c7 3 12 9 16 19 3 13 4 25 3 38a73 62 0 0 1-146 0c-1-13 0-25 3-38Z"
        fill="#B9DFFA"
        stroke="#0A0A0A"
        strokeWidth="10"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <g stroke="#0A0A0A" strokeWidth="9" strokeLinecap="round">
        <path d="M48 112 31 106" />
        <path d="M47 123 28 123" />
        <path d="M49 134 33 142" />
        <path d="M172 112 189 106" />
        <path d="M173 123 192 123" />
        <path d="M171 134 187 142" />
      </g>
      <circle cx="88" cy="112" r="5.5" fill="#0A0A0A" />
      <circle cx="132" cy="112" r="5.5" fill="#0A0A0A" />
      <circle cx="90" cy="109.6" r="1.7" fill="#FFFFFF" opacity="0.85" />
      <circle cx="134" cy="109.6" r="1.7" fill="#FFFFFF" opacity="0.85" />
      <path
        d="M95 130c5 9 11 9 15 1 4 8 10 8 15-1"
        stroke="#0A0A0A"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Sidebar({
  active,
  onChange,
  theme,
  onToggleTheme,
}: SidebarProps) {
  const isDark = theme === "dark";
  const themeLabel = isDark ? "Activar modo claro" : "Activar modo oscuro";

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <CatIllustration />
        <p className="sidebar__question">¿Qué desea realizar?</p>

        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          title={themeLabel}
          aria-label={themeLabel}
        >
          {isDark ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path
                d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      <nav className="sidebar__nav" aria-label="Módulos">
        <button
          type="button"
          className={
            active === "analizador"
              ? "sidebar__link is-active"
              : "sidebar__link"
          }
          aria-current={active === "analizador" ? "page" : undefined}
          onClick={() => onChange("analizador")}
        >
          <span className="sidebar__icon">{ANALYZER_ICON}</span>
          Analizar algoritmos
        </button>

        <p className="sidebar__section sidebar__section--spaced">Módulos</p>

        {MODULES.map((module) => (
          <button
            key={module.id}
            type="button"
            className={
              module.id === active
                ? "sidebar__link is-active"
                : "sidebar__link"
            }
            aria-current={module.id === active ? "page" : undefined}
            onClick={() => onChange(module.id)}
          >
            <span className="sidebar__icon">{module.icon}</span>
            {module.label}
          </button>
        ))}
      </nav>

      <a
        className="sidebar__github"
        href="https://github.com/joosuuw"
        target="_blank"
        rel="noreferrer noopener"
        title="Perfil de GitHub de joosuuw"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.73.5.99 5.24.99 11.5c0 4.86 3.15 8.98 7.52 10.44.55.1.75-.24.75-.53 0-.26-.01-1.13-.02-2.05-3.06.67-3.71-1.3-3.71-1.3-.5-1.27-1.22-1.61-1.22-1.61-1-.68.08-.67.08-.67 1.1.08 1.68 1.13 1.68 1.13.98 1.68 2.57 1.2 3.2.92.1-.71.38-1.2.69-1.48-2.44-.28-5.01-1.22-5.01-5.43 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.4.11-2.92 0 0 .92-.29 3.02 1.13a10.5 10.5 0 0 1 5.5 0c2.1-1.42 3.02-1.13 3.02-1.13.6 1.52.22 2.64.11 2.92.7.77 1.13 1.75 1.13 2.95 0 4.22-2.58 5.15-5.03 5.42.39.34.74 1.01.74 2.04 0 1.47-.01 2.66-.01 3.02 0 .29.2.64.76.53A10.99 10.99 0 0 0 23.01 11.5C23.01 5.24 18.27.5 12 .5Z" />
        </svg>
        <span>github.com/joosuuw</span>
      </a>
    </aside>
  );
}
