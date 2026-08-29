/**
 * Compiles a boolean expression over column fields into a row predicate.
 *
 * Supported: identifiers, numbers, strings, true/false/null,
 * comparisons, && || !, +, -, *, /, parentheses,
 * contains(field, "x"), startsWith(field, "x"), empty(field).
 */
export function compileExpression(
  source: string,
  fields: ReadonlySet<string>,
): (get: (field: string) => unknown) => boolean {
  const trimmed = source.trim();
  if (!trimmed) return () => true;
  const js = translate(trimmed, fields);
  const fn = new Function(
    "get",
    "num",
    "cmp",
    "truthy",
    "containsFn",
    "startsWithFn",
    "empty",
    `"use strict"; return !!(${js});`,
  ) as (
    get: (field: string) => unknown,
    ...helpers: unknown[]
  ) => boolean;
  return (get) => fn(get, num, cmp, truthy, containsFn, startsWithFn, empty);
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function truthy(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "" && v !== false && v !== 0;
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function containsFn(a: unknown, b: unknown): boolean {
  return str(a).toLowerCase().includes(str(b).toLowerCase());
}

function startsWithFn(a: unknown, b: unknown): boolean {
  return str(a).toLowerCase().startsWith(str(b).toLowerCase());
}

function empty(v: unknown): boolean {
  return v == null || v === "";
}

function cmp(a: unknown, b: unknown, op: string): boolean {
  if (typeof a === "number" && typeof b === "number") {
    switch (op) {
      case "==":
        return a === b;
      case "!=":
        return a !== b;
      case ">":
        return a > b;
      case "<":
        return a < b;
      case ">=":
        return a >= b;
      case "<=":
        return a <= b;
    }
  }
  const sa = str(a);
  const sb = str(b);
  switch (op) {
    case "==":
      return sa === sb;
    case "!=":
      return sa !== sb;
    case ">":
      return sa > sb;
    case "<":
      return sa < sb;
    case ">=":
      return sa >= sb;
    case "<=":
      return sa <= sb;
    default:
      return false;
  }
}

function translate(src: string, fields: ReadonlySet<string>): string {
  const tokens = tokenize(src);
  let i = 0;
  const peek = () => tokens[i];
  const eat = () => tokens[i++];

  const OPS = new Set(["==", "!=", ">=", "<=", ">", "<"]);

  function parseOr(): string {
    let left = parseAnd();
    while (peek()?.kind === "op" && peek()?.value === "||") {
      eat();
      left = `(${left}||${parseAnd()})`;
    }
    return left;
  }

  function parseAnd(): string {
    let left = parseCompare();
    while (peek()?.kind === "op" && peek()?.value === "&&") {
      eat();
      left = `(${left}&&${parseCompare()})`;
    }
    return left;
  }

  function parseCompare(): string {
    const left = parseAdd();
    const t = peek();
    if (t?.kind === "op" && OPS.has(t.value)) {
      eat();
      return `cmp(${left},${parseAdd()},${JSON.stringify(t.value)})`;
    }
    return left;
  }

  function parseAdd(): string {
    let left = parseMul();
    while (peek()?.kind === "op" && (peek()?.value === "+" || peek()?.value === "-")) {
      const op = eat()!.value;
      left = `(num(${left})${op}num(${parseMul()}))`;
    }
    return left;
  }

  function parseMul(): string {
    let left = parseUnary();
    while (peek()?.kind === "op" && (peek()?.value === "*" || peek()?.value === "/")) {
      const op = eat()!.value;
      left = `(num(${left})${op}num(${parseUnary()}))`;
    }
    return left;
  }

  function parseUnary(): string {
    if (peek()?.kind === "op" && peek()?.value === "!") {
      eat();
      return `(!truthy(${parseUnary()}))`;
    }
    if (peek()?.kind === "op" && peek()?.value === "-") {
      eat();
      return `(-num(${parseUnary()}))`;
    }
    return parsePrimary();
  }

  function parsePrimary(): string {
    const t = peek();
    if (!t) throw new Error("Unexpected end of expression");
    if (t.kind === "number") {
      eat();
      return t.value;
    }
    if (t.kind === "string") {
      eat();
      return JSON.stringify(t.value);
    }
    if (t.kind === "ident") {
      eat();
      if (t.value === "true") return "true";
      if (t.value === "false") return "false";
      if (t.value === "null") return "null";
      if (peek()?.kind === "op" && peek()?.value === "(") {
        return parseCall(t.value);
      }
      if (!fields.has(t.value)) {
        throw new Error(`Unknown field '${t.value}'`);
      }
      return `get(${JSON.stringify(t.value)})`;
    }
    if (t.kind === "op" && t.value === "(") {
      eat();
      const inner = parseOr();
      if (peek()?.value !== ")") throw new Error("Expected ')'");
      eat();
      return `(${inner})`;
    }
    throw new Error(`Unexpected token '${t.value}'`);
  }

  function parseCall(name: string): string {
    eat();
    const args: string[] = [];
    if (peek()?.value !== ")") {
      args.push(parseOr());
      while (peek()?.value === ",") {
        eat();
        args.push(parseOr());
      }
    }
    if (peek()?.value !== ")") throw new Error(`Expected ')' after ${name}(`);
    eat();
    if (name === "contains") return `containsFn(${args.join(",")})`;
    if (name === "startsWith") return `startsWithFn(${args.join(",")})`;
    if (name === "empty") return `empty(${args.join(",")})`;
    throw new Error(`Unknown function '${name}'`);
  }

  const body = parseOr();
  if (i < tokens.length) throw new Error(`Unexpected token '${tokens[i]?.value}'`);
  return body;
}

interface Token {
  kind: "ident" | "number" | "string" | "op";
  value: string;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === " " || c === "\n" || c === "\t") {
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      let s = "";
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") {
          s += src[i + 1] ?? "";
          i += 2;
        } else {
          s += src[i];
          i++;
        }
      }
      i++;
      tokens.push({ kind: "string", value: s });
      continue;
    }
    if ((c >= "0" && c <= "9") || (c === "." && src[i + 1] && src[i + 1]! >= "0" && src[i + 1]! <= "9")) {
      let s = "";
      while (i < src.length && /[0-9.]/.test(src[i]!)) s += src[i++];
      tokens.push({ kind: "number", value: s });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let s = "";
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i]!)) s += src[i++];
      tokens.push({ kind: "ident", value: s });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["&&", "||", "==", "!=", ">=", "<="].includes(two)) {
      tokens.push({ kind: "op", value: two });
      i += 2;
      continue;
    }
    if ("()<>=!+-*/,".includes(c)) {
      tokens.push({ kind: "op", value: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected character '${c}'`);
  }
  return tokens;
}
