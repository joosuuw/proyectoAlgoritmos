import { useMemo, useState } from "react";
import Sidebar, { type ModuleId } from "../components/layout/Sidebar";
import PanelAnalizador from "../components/dashboard/PanelAnalizador";
import PanelBusqueda from "../components/dashboard/PanelBusqueda";
import PanelOrdenamiento from "../components/dashboard/PanelOrdenamiento";
import StatsCards from "../components/dashboard/StatsCards";
import TablaPrestamos from "../components/dashboard/TablaPrestamos";
import Grafo from "./Grafo";
import Optimizacion from "./Optimizacion";
import { useCreditData } from "../hooks/useCreditData";
import { useCreditSearch } from "../hooks/useCreditSearch";
import { useTheme } from "../hooks/useTheme";

interface HeroContent {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

const HERO_CONTENT: Record<ModuleId, HeroContent> = {
  inicio: {
    eyebrow: "Módulo",
    title: "Inicio",
  },
  analizador: {
    eyebrow: "Herramientas",
    title: "Analizador de algoritmos",
    subtitle:
      "Calcula la complejidad temporal y espacial de tus algoritmos.",
  },
  ordenamiento: {
    eyebrow: "Módulo",
    title: "Ordenamiento",
    subtitle:
      "Ordena los préstamos con Bubble Sort, Merge Sort y Quick Sort, y compara su rendimiento en comparaciones, intercambios y tiempo.",
  },
  busqueda: {
    eyebrow: "Módulo",
    title: "Búsqueda",
    subtitle:
      "Encuentra préstamos por un valor exacto con búsqueda secuencial, binaria, ternaria o por interpolación, y compara el costo de cada búsqueda.",
  },
  optimizacion: {
    eyebrow: "Módulo",
    title: "Optimización de cartera",
    subtitle:
      "Selecciona la combinación de préstamos que maximiza la ganancia por intereses sin superar tu presupuesto.",
  },
  grafos: {
    eyebrow: "Módulo",
    title: "Análisis de Grafo",
    subtitle:
      "Modela los grados crediticios como un grafo ponderado y encuentra con Dijkstra el camino de menor riesgo acumulado desde el grado A.",
  },
};

export default function Dashboard() {
  const {
    creditos,
    sortedData,
    metrics,
    stats,
    loading,
    isSorting,
    error,
    algorithm,
    setAlgorithm,
    sortKey,
    setSortKey,
    order,
    setOrder,
    clearSort,
  } = useCreditData();

  const [module, setModule] = useState<ModuleId>("ordenamiento");
  const { theme, toggleTheme } = useTheme();
  const search = useCreditSearch(creditos);

  const canClear = !(sortKey === "id" && order === "asc");
  const isAnalyzer = module === "analizador";
  const isInicio = module === "inicio";
  const isOptimization = module === "optimizacion";
  const isGraph = module === "grafos";
  const isFiltered = module === "busqueda" && search.outcome !== null;
  const hero = HERO_CONTENT[module];

  const tableData = useMemo(
    () =>
      isFiltered && search.outcome ? search.outcome.matches : sortedData,
    [isFiltered, search.outcome, sortedData],
  );

  const tableSortKey = isFiltered ? "id" : sortKey;
  const tableOrder = isFiltered ? "asc" : order;
  // La búsqueda muestra sus propios resultados; no se difuminan por un
  // ordenamiento en segundo plano.
  const tableIsSorting = isSorting && !isFiltered;

  return (
    <div className="app">
      <Sidebar
        active={module}
        onChange={setModule}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="dashboard">
        <header className="hero">
          <p className="hero__eyebrow">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          {hero.subtitle && <p className="hero__subtitle">{hero.subtitle}</p>}
        </header>

        {isAnalyzer && <PanelAnalizador theme={theme} />}

        {!isAnalyzer && !isInicio && loading && (
          <p className="state">Cargando dataset…</p>
        )}

        {!isAnalyzer && !isInicio && error && (
          <div className="state state--error" role="alert">
            <strong>No se pudieron cargar los datos.</strong>
            <span>{error}</span>
          </div>
        )}

        {!isAnalyzer && !isInicio && !loading && !error && (
          <>
            <StatsCards stats={stats} />

            {module === "ordenamiento" && (
              <PanelOrdenamiento
                algorithm={algorithm}
                onAlgorithmChange={setAlgorithm}
                sortKey={sortKey}
                onSortKeyChange={setSortKey}
                order={order}
                onOrderChange={setOrder}
                metrics={metrics}
                isSorting={isSorting}
                onClearSort={clearSort}
                canClear={canClear}
              />
            )}

            {module === "busqueda" && <PanelBusqueda search={search} />}

            {isOptimization && <Optimizacion creditos={creditos} />}

            {isGraph && <Grafo creditos={creditos} />}

            {!isOptimization && !isGraph && (
              <TablaPrestamos
                creditos={tableData}
                sortKey={tableSortKey}
                order={tableOrder}
                isSorting={tableIsSorting}
                totalRecords={creditos.length}
                subtitle={
                  isFiltered
                    ? `${tableData.length} ${
                        tableData.length === 1
                          ? "registro coincide"
                          : "registros coinciden"
                      } con la búsqueda.`
                    : undefined
                }
                emptyMessage={
                  isFiltered
                    ? "No hay registros que coincidan con la búsqueda."
                    : undefined
                }
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
