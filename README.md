# mi-proyecto-riesgo

Dashboard de riesgo crediticio en **React + TypeScript + Vite**. Carga un CSV de
préstamos, muestra estadísticas de la cartera y permite ordenar y buscar en la
tabla con algoritmos implementados desde cero, comparando sus métricas en vivo.
Incluye además un **analizador estático de algoritmos en Python** que calcula
complejidad temporal/espacial, detecta patrones y compara fragmentos.

## Puesta en marcha

```bash
npm install
npm run dev
```

Otros scripts:

```bash
npm run typecheck   # solo comprobación de tipos
npm run build       # typecheck + build de producción en dist/
npm run preview     # sirve el build
```

## Estructura

```
mi-proyecto-riesgo/
│
├── public/data/credit_risk_dataset.csv   # Dataset de ejemplo (150 filas)
│
├── src/
│   ├── algorithms/
│   │   ├── analyzer/
│   │   │   ├── parsePython.ts           # Parser Lezer → AST propio
│   │   │   ├── facts.ts                 # Hechos semánticos (estructuras, imports, recursión)
│   │   │   ├── estimate.ts              # Costo temporal/espacial por bloque
│   │   │   ├── recursion.ts             # Recurrencias y Teorema Maestro
│   │   │   ├── detect.ts                # Detección de patrones y clasificación
│   │   │   ├── analyze.ts               # Orquestador del análisis
│   │   │   ├── cost.ts                  # Álgebra de complejidades
│   │   │   ├── samples.ts               # 41 fragmentos de ejemplo
│   │   │   ├── types.ts                 # Contratos del analizador
│   │   │   └── index.ts                 # Exporta la API pública
│   │   ├── sorting/
│   │   │   ├── bubbleSort.ts             # O(n²), detección temprana
│   │   │   ├── mergeSort.ts              # O(n log n), estable
│   │   │   ├── quickSort.ts              # O(n log n) promedio, in-place
│   │   │   └── index.ts                  # Exporta algoritmos y tipos
│   │   ├── search/
│   │   │   ├── sequentialSearch.ts       # Búsqueda lineal, O(n)
│   │   │   ├── binarySearch.ts           # Búsqueda binaria, O(log n)
│   │   │   ├── ternarySearch.ts          # Búsqueda ternaria, O(log₃ n)
│   │   │   ├── interpolationSearch.ts    # Por interpolación, O(log log n)
│   │   │   └── index.ts                  # Exporta búsquedas y tipos
│   │   ├── greedy/
│   │   │   ├── dijkstra.ts               # Grafo de grados + camino mínimo, O((V+E) log V)
│   │   │   ├── knapsackGreedy.ts          # Mochila 0/1 voraz, O(n log n)
│   │   │   └── index.ts                  # Exporta Dijkstra y el voraz
│   │   └── types.ts                      # Interfaz Credito + tipos de orden/búsqueda
│   │
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── PanelAnalizador.tsx       # Editor, resultados, recurrencia y comparación
│   │   │   ├── TablaPrestamos.tsx        # Recibe el array ya ordenado
│   │   │   ├── PanelOrdenamiento.tsx     # Selects de método, variable y sentido
│   │   │   ├── PanelBusqueda.tsx         # Selects de método, variable y valor
│   │   │   ├── StatsCards.tsx            # Tarjetas de resumen
│   │   └── layout/Sidebar.tsx            # Navegación entre módulos
│   │
│   ├── hooks/
│   │   ├── useCreditData.ts              # Carga CSV, estado y ejecución
│   │   ├── useCreditSearch.ts            # Búsquedas con múltiples resultados
│   │   ├── useAlgorithmAnalyzer.ts       # Estado, análisis y comparación
│   │   └── useTheme.ts                   # Tema claro/oscuro persistente
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx                 # Página principal
│   │   ├── Grafo.tsx                     # Módulo de grafos con Dijkstra
│   │   └── Optimizacion.tsx              # Comparación mochila DP vs. voraz
│   ├── main.tsx
│   └── index.css
│
├── public/cat.svg                        # Ilustración del sidebar
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Cómo funciona

1. `useCreditData` hace `fetch("/data/credit_risk_dataset.csv")` y convierte cada
   fila en un objeto `Credito` (`src/algorithms/types.ts`).
2. Cada algoritmo respeta el contrato `SortAlgorithm`:
   ```ts
   (items: readonly Credito[], key: SortKey, order?: SortOrder) => SortResult
   ```
   Nunca muta el array original y devuelve `{ data, metrics }`, donde `metrics`
   incluye comparaciones, intercambios/escrituras y duración en ms.
3. Cuando cambia el algoritmo, el campo o el orden, el hook vuelve a ejecutar el
   algoritmo y entrega el array ordenado a `TablaPrestamos`.
4. `PanelOrdenamiento` muestra las métricas para comparar el costo de cada
   algoritmo con el mismo dataset.

Campos ordenables: `id`, `personAge`, `personIncome`, `personEmpLength`, `loanAmt`,
`loanIntRate`, `loanStatus`, `loanPercentIncome` y `cbPersonCredHistLength`. El
orden es ascendente o descendente. El botón **Borrar filtros** vuelve al orden
original por número de registro. La tabla muestra los 12 campos del dataset.

## Módulos

El sidebar permite cambiar entre módulos sin recargar la página. Ordenamiento y
búsqueda comparten las estadísticas y la tabla de préstamos; **Analizar
algoritmos** es un espacio de trabajo independiente que no muestra datos de la
cartera.

- **Analizar algoritmos**: editor de Python, clasificación del patrón,
  complejidad temporal/espacial, tabla de componentes, recurrencia, Teorema
  Maestro, grafo de llamadas y comparación gráfica.
- **Ordenamiento**: Bubble Sort, Merge Sort y Quick Sort con sus métricas.
- **Búsqueda**: secuencial, binaria, ternaria y por interpolación. Antes de
  buscar se ordena una copia de los datos por la variable elegida, requisito de
  los tres últimos algoritmos.
- **Optimización de cartera**: compara la mochila 0/1 resuelta con programación
  dinámica contra un algoritmo voraz. Ambas variantes comparten presupuesto y
  formato de resultado; la interfaz guarda tiempo, ganancia y cantidad de
  préstamos de cada ejecución para compararlas.
- **Análisis de Grafo**: los grados `loan_grade` son los nodos y las
  aristas pesan la tasa de interés media conjunta de dos grados. El camino de
  menor costo se calcula desde el grado A hasta el destino elegido.

El sidebar incluye un botón para alternar entre modo claro y oscuro (se guarda
en `localStorage`) y un enlace al perfil de GitHub del autor.

## Analizador de algoritmos

El módulo vive en `src/algorithms/analyzer/` y se muestra en
`PanelAnalizador.tsx`. No ejecuta el código: lo parsea con `@lezer/python`, lo
convierte a un AST propio y aplica un motor de costos y heurísticas semánticas.

### Qué muestra

1. **Clasificación**: categoría (ordenamiento, búsqueda, grafos, árboles,
   programación dinámica, backtracking, greedy, divide y vencerás, recursión o
   iterativo), nombre del algoritmo y confianza del patrón.
2. **Complejidad**: tiempo y espacio con la justificación que los respalda.
3. **Evidencia y estructuras auxiliares**: recursión, memoización, colas,
   heaps, Union-Find, tablas DP, matrices, conjuntos de visitados, etc.
4. **Tabla de componentes**: línea o bloque, tipo, costo temporal, costo
   espacial y explicación. Los bucles anidados se marcan por nivel.
5. **Recurrencia**: ecuación, árbol de recursión por niveles, altura, hojas y
   aplicación del Teorema Maestro cuando la forma `T(n) = a·T(n/b) + f(n)` lo
   permite.
6. **Grafo de llamadas**: dependencias entre funciones del fragmento y
   llamadas recursivas.
7. **Observaciones**: casos promedio vs. peor caso, memoria auxiliar, costos
   amortizados y advertencias sobre el código.
8. **Comparación**: se añaden resultados ya analizados (hasta 6), se eliminan
   duplicados y se dibuja una gráfica con escala logarítmica.

### Detección y costos

- Usa el AST para contar bucles, profundidad, llamadas, subíndices, imports y
  asignaciones; las expresiones regulares solo complementan nombres y patrones
  estructurales.
- Reconoce `for`/`while`, bucles anidados, reducción a la mitad, recursión
  simple/múltiple/de cola, divide y vencerás, memoización y tabulación.
- Distingue `append`/`add` (O(1) amortizado), `list.pop(0)` (O(n)),
  concatenación de listas en un bucle (O(n²)), `in` sobre listas (O(n)) y sobre
  set/dict (O(1) promedio).
- Modela `sorted`/`.sort` (Timsort), `heapq` (`heappush`/`heappop` O(log n),
  `heapify` O(n)), `bisect` (O(log n), más `list.insert` O(n)) y estructuras
  como `deque`, `Counter` y Union-Find.
- Reconoce algoritmos implementados con `networkx` y advierte que el costo es
  el de la función de la biblioteca.
- Las matrices de entrada no cuentan como espacio auxiliar; solo se suma la
  memoria que el algoritmo crea.

### Ejemplos incluidos

El selector **Ejemplo** carga 41 fragmentos: bubble/insertion/selection/merge/
quick/heap/counting sort, búsqueda lineal y binaria, BFS, DFS recursivo e
iterativo, Dijkstra, Bellman-Ford, Floyd-Warshall, Kruskal, Prim, ordenamiento
topológico, recorridos de árbol, BST, segment tree, Fenwick, trie, knapsack,
LCS, LIS, edit distance, coin change, N-Queens, permutaciones, subset sum,
activity selection, Fibonacci con y sin memoización, factorial, recursión de
cola, exponenciación rápida, `bisect`, `networkx`, recorrido de matriz y BFS
con `list.pop(0)`.

### Limitaciones

El análisis es estático y asume el peor caso: no mide tiempos reales ni ejecuta
el código. Las heurísticas pueden quedar cortas ante código muy idiomático,
metaprogramación o funciones de librerías cuyo costo no está modelado; en esos
casos la confianza mostrada baja y las observaciones explican el supuesto. El
espacio se calcula sobre las estructuras que el fragmento crea, no sobre la
entrada. Python no aplica optimización de recursión de cola, así que una
recursión de cola se reporta con O(n) de pila.

## Dataset

`public/data/credit_risk_dataset.csv` usa el mismo esquema que el *Credit Risk
Dataset* de Kaggle:

```
person_age, person_income, person_home_ownership, person_emp_length,
loan_intent, loan_grade, loan_amnt, loan_int_rate, loan_status,
loan_percent_income, cb_person_default_on_file, cb_person_cred_hist_length
```

> El CSV incluido es una muestra **sintética** de 150 filas con distribuciones
> plausibles, pensada para desarrollo y pruebas. Para usar datos reales,
> reemplaza el archivo manteniendo el mismo encabezado.

## Búsqueda

Los algoritmos viven en `src/algorithms/search/` y respetan el contrato
`SearchAlgorithm`:

```ts
(items: readonly Credito[], key: SortKey, target: number) => SearchResult
```

Devuelven si hubo coincidencia, el índice dentro del arreglo analizado y las
métricas (comparaciones y tiempo). `useCreditSearch` prepara una copia ordenada
de forma ascendente y, para obtener todas las coincidencias, retira
temporalmente cada registro encontrado y repite la búsqueda hasta que el
algoritmo no encuentre más. Cada coincidencia conserva sus propias métricas y
se identifica por su número de registro (`#`). Mientras hay una búsqueda activa,
la tabla de préstamos muestra únicamente los registros encontrados.

## Análisis de grafo (Dijkstra)

El módulo vive en `src/pages/Grafo.tsx` y la lógica en
`src/algorithms/greedy/dijkstra.ts`:

- **Nodos**: cada valor de `loan_grade` presente en el dataset. El nodo muestra
  la tasa de interés media de sus préstamos.
- **Aristas**: el dataset no contiene transiciones entre grados, así que cada
  grado se conecta con los dos siguientes. Los atajos permiten que existan
  varias rutas y que Dijkstra tenga algo que optimizar.
- **Peso**: tasa de interés media de todos los préstamos de los dos grados que
  conecta la arista. Los registros sin `loan_int_rate` no cuentan en el
  promedio.
- **Dijkstra**: cola de prioridad con montículo binario, O((V + E) log V). El
  costo total es la suma de los pesos de las aristas del camino, no un promedio.

Con el dataset incluido, la ruta de A a F es `A → B → D → F` y el grafo se
dibuja en SVG resaltando el camino y el costo de cada arista.
