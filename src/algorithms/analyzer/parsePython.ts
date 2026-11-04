import { parser } from "@lezer/python";
import type { SyntaxNode } from "@lezer/common";
import type {
  ParseOutcome,
  PyBranch,
  PyCall,
  PyComprehension,
  PyExprInfo,
  PyFunction,
  PyModule,
  PyStmt,
  StmtKind,
} from "./types";

const pythonParser = parser;

function children(node: SyntaxNode): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  let child = node.firstChild;
  while (child) {
    result.push(child);
    child = child.nextSibling;
  }
  return result;
}

function textOf(node: SyntaxNode, source: string): string {
  return source.slice(node.from, node.to);
}

function createLineOf(source: string) {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return (offset: number) => {
    let low = 0;
    let high = starts.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (starts[mid] <= offset) low = mid + 1;
      else high = mid - 1;
    }
    return high + 1;
  };
}

function snippet(node: SyntaxNode, source: string): string {
  const raw = textOf(node, source);
  const lines = raw.split("\n");
  const first = lines[0].trim();
  const value = lines.length > 1 ? `${first.replace(/:\s*$/, ":")} …` : first;
  return value.length > 120 ? `${value.slice(0, 117)}…` : value;
}

function isTrivia(name: string): boolean {
  return name === "Comment" || name === ":" || name === ";";
}

function emptyExpr(text = ""): PyExprInfo {
  return {
    text,
    calls: [],
    names: [],
    members: [],
    subscripts: [],
    comparisons: [],
    comprehensions: [],
    hasComparison: false,
  };
}

function walk(
  node: SyntaxNode,
  visit: (node: SyntaxNode) => void,
  stopAtFunctions = true,
): void {
  visit(node);
  let child = node.firstChild;
  while (child) {
    const name = child.type.name;
    if (
      stopAtFunctions &&
      (name === "FunctionDefinition" || name === "ClassDefinition")
    ) {
      child = child.nextSibling;
      continue;
    }
    walk(child, visit, stopAtFunctions);
    child = child.nextSibling;
  }
}

function callFromNode(
  node: SyntaxNode,
  source: string,
  lineOf: (offset: number) => number,
): PyCall | null {
  const kids = children(node);
  if (kids.length === 0) return null;
  const callee = kids[0];
  const full = textOf(callee, source);
  const name = full.split(".").pop() ?? full;
  const argList = kids.find((kid) => kid.type.name === "ArgList");
  const args = argList
    ? children(argList)
        .filter(
          (kid) =>
            !["(", ")", ",", "Comment"].includes(kid.type.name) &&
            kid.type.name !== "ArgList",
        )
        .map((kid) => textOf(kid, source))
    : [];
  return { name, full, args, line: lineOf(node.from) };
}

function extractComprehension(
  node: SyntaxNode,
  source: string,
): PyComprehension | null {
  const kids = children(node);
  const loops: { variable: string; iterable: string }[] = [];

  for (let i = 0; i < kids.length; i += 1) {
    if (kids[i].type.name !== "for") continue;

    let variable = "";
    let iterable = "";
    for (let j = i + 1; j < kids.length; j += 1) {
      const name = kids[j].type.name;
      if (name === "VariableName" && !variable) {
        variable = textOf(kids[j], source);
      }
      if (name === "in") {
        const next = kids[j + 1];
        if (next && next.type.name !== "if" && next.type.name !== "]") {
          iterable = textOf(next, source);
        }
        break;
      }
      if (name === "for") break;
    }

    if (variable || iterable) loops.push({ variable, iterable });
  }

  if (loops.length === 0) return null;
  return { loops, text: textOf(node, source) };
}

function exprInfo(
  node: SyntaxNode | undefined,
  source: string,
  lineOf: (offset: number) => number,
): PyExprInfo {
  if (!node) return emptyExpr();
  const info = emptyExpr(textOf(node, source));
  const names = new Set<string>();
  const members = new Set<string>();
  const subscripts = new Map<string, { base: string; index: string }>();
  const comparisons = new Set<string>();
  const calls: PyCall[] = [];
  const comprehensions: PyComprehension[] = [];

  walk(node, (current) => {
    const name = current.type.name;

    if (name === "CallExpression") {
      const call = callFromNode(current, source, lineOf);
      if (call) calls.push(call);
    }

    if (name === "VariableName") names.add(textOf(current, source));

    if (name === "MemberExpression") {
      const raw = textOf(current, source);
      members.add(raw);
      if (raw.includes("[")) {
        const kids = children(current);
        const openIndex = kids.findIndex((kid) => kid.type.name === "[");
        if (openIndex > 0) {
          const baseText = kids
            .slice(0, openIndex)
            .map((kid) => textOf(kid, source))
            .join("")
            .trim();
          const indexText = kids
            .slice(openIndex + 1)
            .filter((kid) => !["[", "]"].includes(kid.type.name))
            .map((kid) => textOf(kid, source))
            .join(" ")
            .trim();
          const base = baseText.split("[")[0].trim();
          subscripts.set(`${base}[${indexText}]`, { base, index: indexText });
        }
      }
    }

    if (name === "BinaryExpression") {
      const hasCompare = children(current).some((kid) =>
        ["CompareOp", "in", "not", "is", "and", "or"].includes(
          kid.type.name,
        ) || ["in", "not", "is", "and", "or"].includes(textOf(kid, source)),
      );
      if (hasCompare) comparisons.add(textOf(current, source));
    }

    if (name.endsWith("ComprehensionExpression")) {
      const comprehension = extractComprehension(current, source);
      if (comprehension) comprehensions.push(comprehension);
    }
  });

  return {
    text: info.text,
    calls,
    names: [...names],
    members: [...members],
    subscripts: [...subscripts.values()],
    comparisons: [...comparisons],
    comprehensions,
    hasComparison: comparisons.size > 0,
  };
}

function parseBody(
  bodyNode: SyntaxNode | null | undefined,
  source: string,
  lineOf: (offset: number) => number,
  depth: number,
): PyStmt[] {
  if (!bodyNode) return [];
  const statements: PyStmt[] = [];

  for (const child of children(bodyNode)) {
    const name = child.type.name;
    if (isTrivia(name) || name === "Body") continue;
    if (name === "StatementGroup") {
      statements.push(...parseBody(child, source, lineOf, depth));
      continue;
    }
    const parsed = parseStatement(child, source, lineOf, depth);
    if (parsed) statements.push(parsed);
  }

  return statements;
}

function parseIf(
  node: SyntaxNode,
  source: string,
  lineOf: (offset: number) => number,
  depth: number,
): PyStmt {
  const kids = children(node);
  const branches: PyBranch[] = [];
  let keyword = "if";
  let testNode: SyntaxNode | undefined;
  let test: string | undefined;
  let firstTestNode: SyntaxNode | undefined;
  let firstTest: string | undefined;

  for (const kid of kids) {
    const name = kid.type.name;
    if (name === "if" || name === "elif") {
      keyword = name;
      testNode = undefined;
      test = undefined;
      continue;
    }
    if (name === "else") {
      keyword = "else";
      testNode = undefined;
      test = undefined;
      continue;
    }
    if (name === "Body") {
      if (branches.length === 0) {
        firstTestNode = testNode;
        firstTest = test;
      }
      branches.push({
        keyword,
        test,
        body: parseBody(kid, source, lineOf, depth + 1),
      });
      keyword = "if";
      testNode = undefined;
      test = undefined;
      continue;
    }
    if (keyword === "if" || keyword === "elif") {
      testNode = kid;
      test = textOf(kid, source);
    }
  }

  const testExpr = exprInfo(firstTestNode, source, lineOf);

  return {
    kind: "if",
    line: lineOf(node.from),
    endLine: lineOf(node.to),
    code: snippet(node, source),
    text: textOf(node, source),
    depth,
    body: branches[0]?.body ?? [],
    branches,
    test: firstTest,
    calls: testExpr.calls,
    expr: testExpr,
  };
}

function parseStatement(
  node: SyntaxNode,
  source: string,
  lineOf: (offset: number) => number,
  depth: number,
): PyStmt | null {
  const type = node.type.name;
  const kids = children(node);
  const base = {
    line: lineOf(node.from),
    endLine: lineOf(node.to),
    code: snippet(node, source),
    text: textOf(node, source),
    depth,
    body: [] as PyStmt[],
    branches: [] as PyBranch[],
    calls: [] as PyCall[],
    expr: emptyExpr(),
  };

  const make = (patch: Partial<PyStmt> & { kind: StmtKind }): PyStmt => ({
    ...base,
    ...patch,
  });

  switch (type) {
    case "DecoratedStatement": {
      const fn = kids.find((kid) => kid.type.name === "FunctionDefinition");
      if (!fn) return make({ kind: "other" });
      const nameNode = fn.getChild("VariableName");
      return make({
        kind: "def",
        value: nameNode ? textOf(nameNode, source) : "función",
        body: parseBody(fn.getChild("Body"), source, lineOf, depth + 1),
      });
    }

    case "FunctionDefinition": {
      const nameNode = node.getChild("VariableName");
      return make({
        kind: "def",
        value: nameNode ? textOf(nameNode, source) : "función",
        body: parseBody(node.getChild("Body"), source, lineOf, depth + 1),
      });
    }

    case "ClassDefinition": {
      const nameNode = node.getChild("VariableName");
      const bodyNode = node.getChild("Body");
      return make({
        kind: "class",
        value: nameNode ? textOf(nameNode, source) : "clase",
        body: parseBody(bodyNode, source, lineOf, depth + 1),
      });
    }

    case "IfStatement":
      return parseIf(node, source, lineOf, depth);

    case "ForStatement": {
      const bodyIndex = kids.findIndex((kid) => kid.type.name === "Body");
      const inIndex = kids.findIndex((kid) => kid.type.name === "in");
      const targetNode = kids
        .slice(1, inIndex >= 0 ? inIndex : 2)
        .find((kid) => !["for", "in"].includes(kid.type.name));
      const iterNode = kids
        .slice(inIndex + 1, bodyIndex >= 0 ? bodyIndex : undefined)
        .find((kid) => !["in", "Body", ":"].includes(kid.type.name));
      const bodies = kids
        .filter((kid) => kid.type.name === "Body")
        .map((kid) => parseBody(kid, source, lineOf, depth + 1));
      const expr = exprInfo(iterNode, source, lineOf);

      return make({
        kind: "for",
        target: targetNode ? textOf(targetNode, source) : "",
        iter: iterNode ? textOf(iterNode, source) : "",
        body: bodies[0] ?? [],
        branches: bodies.slice(1).map((body) => ({ keyword: "else", body })),
        calls: expr.calls,
        expr,
      });
    }

    case "WhileStatement": {
      const bodyIndex = kids.findIndex((kid) => kid.type.name === "Body");
      const testNode = kids
        .slice(1, bodyIndex >= 0 ? bodyIndex : undefined)
        .find((kid) => kid.type.name !== ":");
      const bodies = kids
        .filter((kid) => kid.type.name === "Body")
        .map((kid) => parseBody(kid, source, lineOf, depth + 1));
      const expr = exprInfo(testNode, source, lineOf);

      return make({
        kind: "while",
        test: testNode ? textOf(testNode, source) : "",
        body: bodies[0] ?? [],
        branches: bodies.slice(1).map((body) => ({ keyword: "else", body })),
        calls: expr.calls,
        expr,
      });
    }

    case "TryStatement": {
      const bodies = kids
        .filter((kid) => kid.type.name === "Body")
        .map((kid) => parseBody(kid, source, lineOf, depth + 1));
      return make({
        kind: "try",
        body: bodies[0] ?? [],
        branches: bodies.slice(1).map((body) => ({ keyword: "except", body })),
      });
    }

    case "WithStatement": {
      const bodyNode = node.getChild("Body");
      return make({
        kind: "with",
        body: parseBody(bodyNode, source, lineOf, depth + 1),
      });
    }

    case "MatchStatement": {
      const bodies = kids
        .filter((kid) => kid.type.name === "MatchBody" || kid.type.name === "Body")
        .map((kid) => parseBody(kid, source, lineOf, depth + 1));
      return make({
        kind: "match",
        body: bodies[0] ?? [],
        branches: bodies.slice(1).map((body) => ({ keyword: "case", body })),
      });
    }

    case "AssignStatement": {
      const opIndex = kids.findIndex((kid) => kid.type.name === "AssignOp");
      const opNode = opIndex >= 0 ? kids[opIndex] : undefined;
      const firstTarget = kids.find(
        (kid) => !["=", ":", "Comment"].includes(kid.type.name),
      );

      let target = "";
      let value = "";
      if (opNode && firstTarget) {
        target = source.slice(firstTarget.from, opNode.from).trim();
        value = source.slice(opNode.to, node.to).trim();
      }

      const valueNode =
        opIndex >= 0
          ? kids
              .slice(opIndex + 1)
              .find((kid) => !["Comment"].includes(kid.type.name))
          : undefined;
      const expr = exprInfo(valueNode, source, lineOf);
      const op = opNode ? textOf(opNode, source) : "=";

      return make({
        kind: op === "=" ? "assign" : "augassign",
        target,
        value,
        op,
        calls: expr.calls,
        expr,
      });
    }

    case "ReturnStatement": {
      const valueNode = kids.find(
        (kid) => !["return", "Comment"].includes(kid.type.name),
      );
      const expr = exprInfo(valueNode, source, lineOf);
      return make({
        kind: "return",
        value: valueNode ? textOf(valueNode, source) : "",
        calls: expr.calls,
        expr,
      });
    }

    case "ExpressionStatement": {
      const expr = exprInfo(node, source, lineOf);
      return make({
        kind: expr.calls.length > 0 ? "call" : "expr",
        calls: expr.calls,
        expr,
      });
    }

    case "ImportStatement":
    case "ScopeStatement":
      return make({
        kind: "import",
        value: textOf(node, source),
      });

    case "BreakStatement":
      return make({ kind: "break" });
    case "ContinueStatement":
      return make({ kind: "continue" });
    case "PassStatement":
      return make({ kind: "pass" });
    case "RaiseStatement":
      return make({ kind: "raise" });
    case "AssertStatement":
      return make({ kind: "assert" });
    case "DeleteStatement":
      return make({ kind: "delete" });
    case "YieldStatement":
      return make({ kind: "yield" });

    default:
      return make({ kind: "other" });
  }
}

function parseFunction(
  node: SyntaxNode,
  source: string,
  lineOf: (offset: number) => number,
  depth: number,
  decorators: string[],
  className?: string,
): PyFunction {
  const nameNode = node.getChild("VariableName");
  const name = nameNode ? textOf(nameNode, source) : "anónima";
  const paramList = node.getChild("ParamList");
  const params = paramList
    ? children(paramList)
        .filter((kid) => kid.type.name === "VariableName")
        .map((kid) => textOf(kid, source))
    : [];
  const bodyNode = node.getChild("Body");
  const body = parseBody(bodyNode, source, lineOf, depth);

  const fn: PyFunction = {
    name,
    qualifiedName: className ? `${className}.${name}` : name,
    params,
    decorators,
    line: lineOf(node.from),
    endLine: lineOf(node.to),
    source: textOf(node, source),
    body,
    calls: [],
    subscripts: [],
    comparisons: [],
    assignments: [],
    names: [],
    comprehensionCount: 0,
    loopCount: 0,
    maxLoopDepth: 0,
  };

  if (bodyNode) {
    const callNames: PyCall[] = [];
    const subscripts: { base: string; index: string }[] = [];
    const comparisons: string[] = [];
    const assignments: { target: string; value: string; line: number }[] = [];
    const names = new Set<string>();
    let comprehensionCount = 0;

    walk(bodyNode, (current) => {
      const type = current.type.name;
      if (type === "CallExpression") {
        const call = callFromNode(current, source, lineOf);
        if (call) callNames.push(call);
      }
      if (type === "VariableName") names.add(textOf(current, source));
      if (type === "MemberExpression") {
        const raw = textOf(current, source);
        if (raw.includes("[")) {
          const kids = children(current);
          const openIndex = kids.findIndex((kid) => kid.type.name === "[");
          if (openIndex > 0) {
            const baseText = kids
              .slice(0, openIndex)
              .map((kid) => textOf(kid, source))
              .join("");
            subscripts.push({
              base: baseText.split("[")[0].trim(),
              index: kids
                .slice(openIndex + 1)
                .filter((kid) => !["[", "]"].includes(kid.type.name))
                .map((kid) => textOf(kid, source))
                .join(" "),
            });
          }
        }
      }
      if (type === "BinaryExpression") {
        const hasCompare = children(current).some(
          (kid) =>
            ["CompareOp", "in", "not", "is", "and", "or"].includes(
              kid.type.name,
            ) ||
            ["in", "not", "is", "and", "or"].includes(
              textOf(kid, source),
            ),
        );
        if (hasCompare) comparisons.push(textOf(current, source));
      }
      if (type === "AssignStatement") {
        const kids = children(current);
        const opIndex = kids.findIndex((kid) => kid.type.name === "AssignOp");
        const op = kids[opIndex];
        const firstTarget = kids.find(
          (kid) => !["=", ":", "Comment"].includes(kid.type.name),
        );
        if (op && firstTarget) {
          assignments.push({
            target: source.slice(firstTarget.from, op.from).trim(),
            value: source.slice(op.to, current.to).trim(),
            line: lineOf(current.from),
          });
        }
      }
      if (type.endsWith("ComprehensionExpression")) comprehensionCount += 1;
    });

    fn.calls = callNames;
    fn.subscripts = subscripts;
    fn.comparisons = comparisons;
    fn.assignments = assignments;
    fn.names = [...names];
    fn.comprehensionCount = comprehensionCount;
  }

  let loopTotal = 0;
  let loopDepth = 0;
  const scanLoops = (statements: PyStmt[], level: number) => {
    for (const statement of statements) {
      if (statement.kind === "for" || statement.kind === "while") {
        loopTotal += 1;
        loopDepth = Math.max(loopDepth, level + 1);
        scanLoops(statement.body, level + 1);
      } else {
        scanLoops(statement.body, level);
        for (const branch of statement.branches) {
          scanLoops(branch.body, level);
        }
      }
    }
  };
  scanLoops(body, 0);

  fn.loopCount = loopTotal;
  fn.maxLoopDepth = loopDepth;

  return fn;
}

function collectClassFunctions(
  node: SyntaxNode,
  source: string,
  lineOf: (offset: number) => number,
): PyFunction[] {
  const classNameNode = node.getChild("VariableName");
  const className = classNameNode ? textOf(classNameNode, source) : "Clase";
  const body = node.getChild("Body");
  if (!body) return [];

  const functions: PyFunction[] = [];
  for (const child of children(body)) {
    if (child.type.name === "FunctionDefinition") {
      functions.push(
        parseFunction(child, source, lineOf, 0, [], className),
      );
    } else if (child.type.name === "DecoratedStatement") {
      const fn = children(child).find(
        (kid) => kid.type.name === "FunctionDefinition",
      );
      if (fn) {
        const decorators = children(child)
          .filter((kid) => kid.type.name === "Decorator")
          .map((kid) => textOf(kid, source));
        functions.push(
          parseFunction(fn, source, lineOf, 0, decorators, className),
        );
      }
    }
  }
  return functions;
}

function parseImports(source: string, tree: ReturnType<typeof parser.parse>) {
  const imports = new Set<string>();
  const importedNames = new Set<string>();

  walk(
    tree.topNode,
    (node) => {
      if (node.type.name !== "ImportStatement") return;
      const raw = textOf(node, source).trim();
      const parts = raw.split(/\s+/);
      if (parts[0] === "from") {
        const module = parts[1] ?? "";
        if (module) imports.add(module);
        const importIndex = parts.indexOf("import");
        if (importIndex >= 0) {
          parts
            .slice(importIndex + 1)
            .join(" ")
            .split(",")
            .map((name) => name.trim().split(/\s+as\s+/)[0])
            .filter(Boolean)
            .forEach((name) => {
              importedNames.add(name);
              imports.add(`${module}.${name}`);
            });
        }
      } else {
        const importIndex = parts.indexOf("import");
        parts
          .slice(importIndex >= 0 ? importIndex + 1 : 1)
          .join(" ")
          .split(",")
          .map((name) => name.trim().split(/\s+as\s+/)[0])
          .filter(Boolean)
          .forEach((name) => {
            imports.add(name);
            importedNames.add(name);
          });
      }
    },
    false,
  );

  return { imports: [...imports], importedNames: [...importedNames] };
}

/** Parsea el código Python y devuelve un árbol de sentencias propio. */
export function parsePython(source: string): ParseOutcome {
  const trimmed = source.trim();
  if (trimmed === "") {
    return { module: null, error: "Escribe o pega código Python para analizar." };
  }

  const lineOf = createLineOf(source);
  let tree;
  try {
    tree = pythonParser.parse(source);
  } catch (error) {
    return {
      module: null,
      error:
        error instanceof Error
          ? `No se pudo parsear el código: ${error.message}`
          : "No se pudo parsear el código.",
    };
  }

  const issues: { line: number; message: string }[] = [];
  tree.iterate({
    enter: (node) => {
      if (node.type.isError) {
        issues.push({
          line: lineOf(node.from),
          message: "Token o bloque no reconocido por el parser de Python.",
        });
      }
    },
  });

  const top = tree.topNode;
  const functions: PyFunction[] = [];
  const topLevel: PyStmt[] = [];

  for (const child of children(top)) {
    const type = child.type.name;
    if (type === "FunctionDefinition") {
      functions.push(parseFunction(child, source, lineOf, 0, []));
    } else if (type === "DecoratedStatement") {
      const fn = children(child).find(
        (kid) => kid.type.name === "FunctionDefinition",
      );
      if (fn) {
        const decorators = children(child)
          .filter((kid) => kid.type.name === "Decorator")
          .map((kid) => textOf(kid, source));
        functions.push(parseFunction(fn, source, lineOf, 0, decorators));
      }
    } else if (type === "ClassDefinition") {
      functions.push(...collectClassFunctions(child, source, lineOf));
    } else if (!isTrivia(type) && type !== "Body") {
      const parsed = parseStatement(child, source, lineOf, 0);
      if (parsed) topLevel.push(parsed);
    }
  }

  const { imports, importedNames } = parseImports(source, tree);

  const module: PyModule = {
    source,
    functions,
    topLevel,
    imports,
    importedNames,
    issues,
  };

  if (issues.length > 0) {
    const first = issues[0];
    return {
      module,
      error: `Error de sintaxis en la línea ${first.line}: ${first.message}`,
    };
  }

  if (functions.length === 0 && topLevel.length === 0) {
    return { module: null, error: "No se encontró código analizable." };
  }

  return { module, error: null };
}
