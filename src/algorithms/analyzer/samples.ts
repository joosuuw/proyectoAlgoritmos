export interface AlgorithmSample {
  id: string;
  name: string;
  group: string;
  code: string;
}

export const SAMPLES: AlgorithmSample[] = [
  {
    id: "bubble",
    name: "Bubble sort",
    group: "Ordenamiento",
    code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
    return arr
`,
  },
  {
    id: "insertion",
    name: "Insertion sort",
    group: "Ordenamiento",
    code: `def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i - 1
        while j >= 0 and arr[j] > key:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
    return arr
`,
  },
  {
    id: "selection",
    name: "Selection sort",
    group: "Ordenamiento",
    code: `def selection_sort(arr):
    n = len(arr)
    for i in range(n):
        min_idx = i
        for j in range(i + 1, n):
            if arr[j] < arr[min_idx]:
                min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr
`,
  },
  {
    id: "merge",
    name: "Merge sort",
    group: "Ordenamiento",
    code: `def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left, right):
    result = []
    i = 0
    j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result
`,
  },
  {
    id: "quick",
    name: "Quick sort",
    group: "Ordenamiento",
    code: `def quick_sort(arr, lo=0, hi=None):
    if hi is None:
        hi = len(arr) - 1
    if lo >= hi:
        return arr
    pivot = arr[(lo + hi) // 2]
    i = lo
    j = hi
    while i <= j:
        while arr[i] < pivot:
            i += 1
        while arr[j] > pivot:
            j -= 1
        if i <= j:
            arr[i], arr[j] = arr[j], arr[i]
            i += 1
            j -= 1
    quick_sort(arr, lo, j)
    quick_sort(arr, i, hi)
    return arr
`,
  },
  {
    id: "heap-sort",
    name: "Heap sort",
    group: "Ordenamiento",
    code: `import heapq

def heap_sort(arr):
    heap = arr[:]
    heapq.heapify(heap)
    result = []
    while heap:
        result.append(heapq.heappop(heap))
    return result
`,
  },
  {
    id: "counting",
    name: "Counting sort",
    group: "Ordenamiento",
    code: `def counting_sort(arr):
    if not arr:
        return arr
    max_val = max(arr)
    count = [0] * (max_val + 1)
    for num in arr:
        count[num] += 1
    result = []
    for value in range(len(count)):
        for _ in range(count[value]):
            result.append(value)
    return result
`,
  },
  {
    id: "linear-search",
    name: "Búsqueda lineal",
    group: "Búsqueda",
    code: `def linear_search(arr, target):
    for i in range(len(arr)):
        if arr[i] == target:
            return i
    return -1
`,
  },
  {
    id: "binary-search",
    name: "Búsqueda binaria",
    group: "Búsqueda",
    code: `def binary_search(arr, target):
    lo = 0
    hi = len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
`,
  },
  {
    id: "bfs",
    name: "BFS",
    group: "Grafos",
    code: `from collections import deque

def bfs(graph, start):
    visited = set([start])
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return order
`,
  },
  {
    id: "dfs",
    name: "DFS recursivo",
    group: "Grafos",
    code: `def dfs(graph, node, visited=None):
    if visited is None:
        visited = set()
    visited.add(node)
    for neighbor in graph[node]:
        if neighbor not in visited:
            dfs(graph, neighbor, visited)
    return visited
`,
  },
  {
    id: "dijkstra",
    name: "Dijkstra",
    group: "Grafos",
    code: `import heapq

def dijkstra(graph, start):
    dist = {node: float("inf") for node in graph}
    dist[start] = 0
    heap = [(0, start)]
    while heap:
        d, node = heapq.heappop(heap)
        if d > dist[node]:
            continue
        for neighbor, weight in graph[node]:
            new_dist = d + weight
            if new_dist < dist[neighbor]:
                dist[neighbor] = new_dist
                heapq.heappush(heap, (new_dist, neighbor))
    return dist
`,
  },
  {
    id: "bellman",
    name: "Bellman-Ford",
    group: "Grafos",
    code: `def bellman_ford(vertices, edges, start):
    dist = {v: float("inf") for v in range(vertices)}
    dist[start] = 0
    for _ in range(vertices - 1):
        for u, v, w in edges:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
    for u, v, w in edges:
        if dist[u] + w < dist[v]:
            return None
    return dist
`,
  },
  {
    id: "floyd",
    name: "Floyd-Warshall",
    group: "Grafos",
    code: `def floyd_warshall(dist):
    n = len(dist)
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if dist[i][j] > dist[i][k] + dist[k][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
    return dist
`,
  },
  {
    id: "kruskal",
    name: "Kruskal",
    group: "Grafos",
    code: `def kruskal(n, edges):
    parent = list(range(n))
    rank = [0] * n

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra = find(a)
        rb = find(b)
        if ra == rb:
            return False
        if rank[ra] < rank[rb]:
            ra, rb = rb, ra
        parent[rb] = ra
        rank[ra] += 1
        return True

    edges.sort(key=lambda edge: edge[2])
    mst = []
    for u, v, w in edges:
        if union(u, v):
            mst.append((u, v, w))
    return mst
`,
  },
  {
    id: "prim",
    name: "Prim",
    group: "Grafos",
    code: `import heapq

def prim(graph, start):
    visited = set([start])
    heap = []
    for neighbor, weight in graph[start]:
        heapq.heappush(heap, (weight, start, neighbor))
    total = 0
    mst = []
    while heap:
        weight, u, v = heapq.heappop(heap)
        if v in visited:
            continue
        visited.add(v)
        total += weight
        mst.append((u, v, weight))
        for neighbor, w in graph[v]:
            if neighbor not in visited:
                heapq.heappush(heap, (w, v, neighbor))
    return total, mst
`,
  },
  {
    id: "topological",
    name: "Ordenamiento topológico",
    group: "Grafos",
    code: `from collections import deque

def topological_sort(graph):
    indegree = {node: 0 for node in graph}
    for node in graph:
        for neighbor in graph[node]:
            indegree[neighbor] += 1
    queue = deque([node for node in graph if indegree[node] == 0])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph[node]:
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)
    if len(order) != len(graph):
        return []
    return order
`,
  },
  {
    id: "inorder",
    name: "Recorrido inorden",
    group: "Árboles",
    code: `class Node:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None

def inorder(root, result=None):
    if result is None:
        result = []
    if root is not None:
        inorder(root.left, result)
        result.append(root.value)
        inorder(root.right, result)
    return result
`,
  },
  {
    id: "bst",
    name: "Búsqueda en BST",
    group: "Árboles",
    code: `def bst_search(root, key):
    current = root
    while current is not None:
        if key == current.value:
            return current
        if key < current.value:
            current = current.left
        else:
            current = current.right
    return None
`,
  },
  {
    id: "segment",
    name: "Segment Tree",
    group: "Árboles",
    code: `def segment_tree_query(tree, node, left, right, query_left, query_right):
    if query_left <= left and right <= query_right:
        return tree[node]
    mid = (left + right) // 2
    total = 0
    if query_left <= mid:
        total += segment_tree_query(tree, 2 * node, left, mid, query_left, query_right)
    if query_right > mid:
        total += segment_tree_query(tree, 2 * node + 1, mid + 1, right, query_left, query_right)
    return total
`,
  },
  {
    id: "fenwick",
    name: "Fenwick Tree",
    group: "Árboles",
    code: `def fenwick_update(bit, index, delta):
    index += 1
    while index <= len(bit):
        bit[index - 1] += delta
        index += index & -index

def fenwick_query(bit, index):
    index += 1
    total = 0
    while index > 0:
        total += bit[index - 1]
        index -= index & -index
    return total
`,
  },
  {
    id: "trie",
    name: "Trie",
    group: "Árboles",
    code: `def trie_insert(root, word):
    node = root
    for char in word:
        if char not in node:
            node[char] = {}
        node = node[char]
    node["$"] = True
    return root
`,
  },
  {
    id: "knapsack",
    name: "Knapsack 0/1",
    group: "Programación dinámica",
    code: `def knapsack(weights, values, capacity):
    n = len(weights)
    dp = [[0] * (capacity + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for w in range(capacity + 1):
            if weights[i - 1] <= w:
                dp[i][w] = max(dp[i - 1][w], dp[i - 1][w - weights[i - 1]] + values[i - 1])
            else:
                dp[i][w] = dp[i - 1][w]
    return dp[n][capacity]
`,
  },
  {
    id: "lcs",
    name: "LCS",
    group: "Programación dinámica",
    code: `def lcs(a, b):
    n = len(a)
    m = len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[n][m]
`,
  },
  {
    id: "lis",
    name: "LIS",
    group: "Programación dinámica",
    code: `def lis(nums):
    if not nums:
        return 0
    dp = [1] * len(nums)
    for i in range(1, len(nums)):
        for j in range(i):
            if nums[j] < nums[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)
`,
  },
  {
    id: "edit-distance",
    name: "Edit distance",
    group: "Programación dinámica",
    code: `def edit_distance(a, b):
    n = len(a)
    m = len(b)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    return dp[n][m]
`,
  },
  {
    id: "coin-change",
    name: "Coin change",
    group: "Programación dinámica",
    code: `def coin_change(coins, amount):
    dp = [amount + 1] * (amount + 1)
    dp[0] = 0
    for coin in coins:
        for value in range(coin, amount + 1):
            dp[value] = min(dp[value], dp[value - coin] + 1)
    return dp[amount] if dp[amount] <= amount else -1
`,
  },
  {
    id: "nqueens",
    name: "N-Queens",
    group: "Backtracking",
    code: `def solve_n_queens(n):
    solutions = []
    board = []

    def is_safe(row, col):
        for r, c in enumerate(board):
            if c == col or abs(c - col) == row - r:
                return False
        return True

    def backtrack(row):
        if row == n:
            solutions.append(board[:])
            return
        for col in range(n):
            if is_safe(row, col):
                board.append(col)
                backtrack(row + 1)
                board.pop()

    backtrack(0)
    return solutions
`,
  },
  {
    id: "permutations",
    name: "Permutaciones",
    group: "Backtracking",
    code: `def permutations(nums):
    result = []
    used = [False] * len(nums)
    path = []

    def backtrack():
        if len(path) == len(nums):
            result.append(path[:])
            return
        for i in range(len(nums)):
            if used[i]:
                continue
            used[i] = True
            path.append(nums[i])
            backtrack()
            path.pop()
            used[i] = False

    backtrack()
    return result
`,
  },
  {
    id: "subset-sum",
    name: "Subset sum",
    group: "Backtracking",
    code: `def subset_sum(nums, target):
    def backtrack(index, current):
        if current == target:
            return True
        if index == len(nums) or current > target:
            return False
        if backtrack(index + 1, current + nums[index]):
            return True
        return backtrack(index + 1, current)

    return backtrack(0, 0)
`,
  },
  {
    id: "activity",
    name: "Activity selection",
    group: "Greedy",
    code: `def activity_selection(activities):
    activities.sort(key=lambda item: item[1])
    selected = []
    last_end = -1
    for start, end in activities:
        if start >= last_end:
            selected.append((start, end))
            last_end = end
    return selected
`,
  },
  {
    id: "fib-memo",
    name: "Fibonacci con memoización",
    group: "Programación dinámica",
    code: `from functools import lru_cache

@lru_cache(maxsize=None)
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
`,
  },
  {
    id: "fib-naive",
    name: "Fibonacci recursivo",
    group: "Recursión",
    code: `def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
`,
  },
  {
    id: "factorial",
    name: "Factorial recursivo",
    group: "Recursión",
    code: `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
`,
  },
  {
    id: "fast-power",
    name: "Exponenciación rápida",
    group: "Divide y vencerás",
    code: `def fast_power(base, exponent):
    if exponent == 0:
        return 1
    half = fast_power(base, exponent // 2)
    if exponent % 2 == 0:
        return half * half
    return half * half * base
`,
  },
  {
    id: "dfs-iterative",
    name: "DFS iterativo",
    group: "Grafos",
    code: `def dfs_iterativo(grafo, inicio):
    visitados = set()
    pila = [inicio]
    while pila:
        nodo = pila.pop()
        if nodo in visitados:
            continue
        visitados.add(nodo)
        for vecino in grafo[nodo]:
            if vecino not in visitados:
                pila.append(vecino)
    return visitados
`,
  },
  {
    id: "bisect",
    name: "Búsqueda con bisect",
    group: "Búsqueda",
    code: `import bisect

def insertar_ordenado(lista, valor):
    pos = bisect.bisect_left(lista, valor)
    lista.insert(pos, valor)
    return pos
`,
  },
  {
    id: "networkx",
    name: "Camino más corto con NetworkX",
    group: "Grafos",
    code: `import networkx as nx

def camino_mas_corto(grafo, origen, destino):
    return nx.shortest_path(grafo, source=origen, target=destino)
`,
  },
  {
    id: "matrix-sum",
    name: "Recorrido de matriz",
    group: "Iterativo",
    code: `def sumar_matriz(matriz):
    total = 0
    for i in range(len(matriz)):
        for j in range(len(matriz[0])):
            total += matriz[i][j]
    return total
`,
  },
  {
    id: "tail-recursion",
    name: "Recursión de cola",
    group: "Recursión",
    code: `def suma_cola(lista, acumulado=0):
    if not lista:
        return acumulado
    return suma_cola(lista[1:], acumulado + lista[0])
`,
  },
  {
    id: "bfs-pop0",
    name: "BFS con list.pop(0)",
    group: "Grafos",
    code: `def bfs_lista(grafo, inicio):
    visitados = {inicio}
    cola = [inicio]
    while cola:
        nodo = cola.pop(0)
        for vecino in grafo[nodo]:
            if vecino not in visitados:
                visitados.add(vecino)
                cola.append(vecino)
    return visitados
`,
  },
];

export const DEFAULT_SAMPLE = SAMPLES[0];
