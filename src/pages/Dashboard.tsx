import { useState } from "react";
import Sidebar, { type ModuleId } from "../components/layout/Sidebar";
import PanelAnalizador from "../components/dashboard/PanelAnalizador";
import PanelBusqueda from "../components/dashboard/PanelBusqueda";
import PanelOrdenamiento from "../components/dashboard/PanelOrdenamiento";
import PanelProximamente from "../components/dashboard/PanelProximamente";
import StatsCards from "../components/dashboard/StatsCards";
import TablaPrestamos from "../components/dashboard/TablaPrestamos";
import { useCreditData } from "../hooks/useCreditData";
import { useCreditSearch } from "../hooks/useCreditSearch";
import { useTheme } from "../hooks/useTheme";

export default function Dashboard() {
  const {
    creditos,
    sortedData,
    metrics,
    stats,
    loading,
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
  const isFiltered = module === "busqueda" && search.outcome !== null;

  const tableData =
    isFiltered && search.outcome
      ? search.outcome.matches.map((match) => match.record)
      : sortedData;

  const tableSortKey = isFiltered ? "id" : sortKey;
  const tableOrder = isFiltered ? "asc" : order;

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
          <p className="hero__eyebrow">
            {isAnalyzer ? "Herramientas" : "Proyecto - Algoritmia"}
          </p>
          <h1>{isAnalyzer ? "Analizador de algoritmos" : "Riesgo crediticio"}</h1>
          <p className="hero__subtitle">
            {isAnalyzer
              ? "Calcula la complejidad temporal y espacial de tus algoritmos."
              : "Explora el dataset de préstamos y compara el rendimiento de los algoritmos de ordenamiento y búsqueda."}
          </p>
        </header>

        {isAnalyzer && <PanelAnalizador theme={theme} />}

        {!isAnalyzer && loading && <p className="state">Cargando dataset…</p>}

        {!isAnalyzer && error && (
          <div className="state state--error" role="alert">
            <strong>No se pudieron cargar los datos.</strong>
            <span>{error}</span>
          </div>
        )}

        {!isAnalyzer && !loading && !error && (
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
                onClearSort={clearSort}
                canClear={canClear}
              />
            )}

            {module === "busqueda" && <PanelBusqueda search={search} />}

            {module === "proximamente" && <PanelProximamente />}

            <TablaPrestamos
              creditos={tableData}
              sortKey={tableSortKey}
              order={tableOrder}
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
          </>
        )}
      </main>
    </div>
  );
}
