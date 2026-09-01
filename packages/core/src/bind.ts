import type { AggName, ColumnDef, DataType, PinSide } from "./types.ts";

const CHILD_KEYS = ["children", "items", "rows"] as const;

/** Friendly column object from a service. Snake_case or camelCase both work. */
export interface EasyColumn {
  field?: string;
  key?: string;
  id?: string;
  header?: string;
  heading?: string;
  title?: string;
  name?: string;
  type?: DataType;
  data_type?: DataType;
  dataType?: DataType;
  enable_sorting?: boolean;
  enable_filtering?: boolean;
  enable_editing?: boolean;
  enable_resizing?: boolean;
  enable_grouping?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  editable?: boolean;
  resizable?: boolean;
  groupable?: boolean;
  filter_type?: ColumnDef["filter"];
  filter?: ColumnDef["filter"];
  width?: number;
  pinned?: PinSide | false;
  agg?: AggName;
  aggregation?: AggName;
  align?: ColumnDef["align"];
  hide?: boolean;
  hidden?: boolean;
  format?: ColumnDef["format"];
}

/** Two-field service payload (aliases accepted). */
export interface GridPayload {
  column_definitions?: EasyColumn[];
  columnDefinitions?: EasyColumn[];
  columns?: EasyColumn[];
  table_data?: unknown;
  tableData?: unknown;
  data?: unknown;
  rows?: unknown;
}

export interface BoundTree {
  parent: Int32Array;
  children: number[][];
  depths: Uint8Array;
}

export interface BoundGrid {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  tree: BoundTree | null;
}

/**
 * Turn a service payload (or a raw table) into columns + rows MegaGrid can ingest.
 * One linear pass over the data. Extra headings stay empty; extra data columns
 * get Excel letters (A, B, C, …) by index.
 */
export function bindPayload(input: unknown): BoundGrid {
  const payload = asPayload(input);
  const defs = payload.column_definitions ?? payload.columnDefinitions ?? payload.columns ?? [];
  const raw = payload.table_data ?? payload.tableData ?? payload.data ?? payload.rows ?? [];
  const list = Array.isArray(raw) ? raw : [];
  const nested = detectNested(list);

  if (nested) {
    const flat = flattenNested(list);
    return finishBind(defs, flat.rows, "object", flat.tree);
  }

  const kind = detectKind(list);
  if (kind === "matrix") {
    const matrix = list as unknown[][];
    const dataWidth = matrixWidth(matrix);
    return finishBind(defs, matrixToObjects(matrix, Math.max(dataWidth, defs.length)), "matrix", null);
  }

  const objects = list as Record<string, unknown>[];
  const keys = objectKeys(objects);
  return finishBind(defs, objects, "object", null, keys);
}

export function excelLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

export function asPayload(input: unknown): GridPayload {
  if (input == null) return { table_data: [] };
  if (Array.isArray(input)) return { table_data: input };
  if (typeof input === "object") return input as GridPayload;
  return { table_data: [] };
}

/** True when the value is a `{ column_definitions, table_data }` payload (aliases included). */
export function isGridPayload(input: unknown): boolean {
  if (input == null || typeof input !== "object" || Array.isArray(input)) return false;
  const o = input as Record<string, unknown>;
  return (
    "table_data" in o ||
    "tableData" in o ||
    "column_definitions" in o ||
    "columnDefinitions" in o ||
    ("columns" in o && ("data" in o || "rows" in o || "table_data" in o || "tableData" in o))
  );
}

function detectKind(list: unknown[]): "matrix" | "object" | "empty" {
  if (!list.length) return "empty";
  const first = list.find((r) => r != null);
  if (Array.isArray(first)) return "matrix";
  if (first && typeof first === "object") return "object";
  return "matrix";
}

function detectNested(list: unknown[]): boolean {
  for (let i = 0; i < Math.min(list.length, 50); i++) {
    const row = list[i];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    if (childList(row as Record<string, unknown>)) return true;
  }
  return false;
}

function childList(row: Record<string, unknown>): unknown[] | null {
  for (const k of CHILD_KEYS) {
    const v = row[k];
    if (Array.isArray(v) && v.length && v.some((x) => x && typeof x === "object" && !Array.isArray(x))) {
      return v;
    }
  }
  return null;
}

function matrixWidth(matrix: unknown[][]): number {
  let w = 0;
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (Array.isArray(row) && row.length > w) w = row.length;
  }
  return w;
}

function objectKeys(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const n = rows.length;
  for (let i = 0; i < n; i++) {
    const row = rows[i];
    if (!row || typeof row !== "object") continue;
    for (const k of Object.keys(row)) {
      if (k.startsWith("__mg")) continue;
      if (CHILD_KEYS.includes(k as (typeof CHILD_KEYS)[number]) && Array.isArray(row[k])) continue;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(k);
      }
    }
  }
  return out;
}

function matrixToObjects(matrix: unknown[][], width: number): Record<string, unknown>[] {
  const letters = Array.from({ length: width }, (_, i) => excelLetter(i));
  const rows = new Array<Record<string, unknown>>(matrix.length);
  for (let r = 0; r < matrix.length; r++) {
    const src = Array.isArray(matrix[r]) ? matrix[r]! : [];
    const row: Record<string, unknown> = {};
    for (let c = 0; c < width; c++) row[letters[c]!] = src[c] ?? null;
    rows[r] = row;
  }
  return rows;
}

function flattenNested(list: unknown[]): { rows: Record<string, unknown>[]; tree: BoundTree } {
  const rows: Record<string, unknown>[] = [];
  const parentArr: number[] = [];
  const depths: number[] = [];

  const walk = (node: unknown, parent: number, depth: number) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const rec = node as Record<string, unknown>;
    const kids = childList(rec);
    const copy: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      if (CHILD_KEYS.includes(k as (typeof CHILD_KEYS)[number]) && Array.isArray(v)) continue;
      copy[k] = v;
    }
    const idx = rows.length;
    rows.push(copy);
    parentArr.push(parent);
    depths.push(depth);
    if (kids) for (const child of kids) walk(child, idx, depth + 1);
  };

  for (const node of list) walk(node, -1, 0);

  const n = rows.length;
  const parent = new Int32Array(n);
  const depthOut = new Uint8Array(n);
  const children: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    parent[i] = parentArr[i]!;
    depthOut[i] = Math.min(255, depths[i]!);
    const p = parentArr[i]!;
    if (p >= 0) children[p]!.push(i);
  }
  return { rows, tree: { parent, children, depths: depthOut } };
}

function finishBind(
  defs: EasyColumn[],
  sourceRows: Record<string, unknown>[],
  kind: "matrix" | "object" | "empty",
  tree: BoundTree | null,
  objectKeyList?: string[],
): BoundGrid {
  const dataKeys =
    kind === "matrix"
      ? Array.from({ length: matrixWidthFromRows(sourceRows) }, (_, i) => excelLetter(i))
      : (objectKeyList ?? objectKeys(sourceRows));
  const plan = planColumns(defs, dataKeys, kind);
  const columns = plan.map((p, i) => toColumnDef(p.def, p.field, p.header, i, p.letter));
  const rows = projectRows(sourceRows, plan);
  return { columns, rows, tree };
}

interface ColPlan {
  def: EasyColumn;
  field: string;
  header: string;
  sourceKey: string | null;
  letter: boolean;
}

function planColumns(defs: EasyColumn[], dataKeys: string[], kind: "matrix" | "object" | "empty"): ColPlan[] {
  const usedData = new Set<string>();
  const usedFields = new Set<string>();
  const plan: ColPlan[] = [];

  const takeField = (wanted: string, fallback: string) => {
    let field = wanted;
    if (usedFields.has(field)) field = fallback;
    usedFields.add(field);
    return field;
  };

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]!;
    const named = pickField(def);
    let sourceKey: string | null = null;
    if (named && dataKeys.includes(named) && !usedData.has(named)) {
      sourceKey = named;
      usedData.add(named);
    } else {
      const next = dataKeys.find((k) => !usedData.has(k));
      if (next) {
        sourceKey = next;
        usedData.add(next);
      }
    }
    const letter = excelLetter(i);
    const field = takeField(named ?? sourceKey ?? pickHeader(def) ?? letter, letter);
    const header =
      pickHeader(def) ??
      (named ? prettify(named) : sourceKey && kind === "object" ? prettify(sourceKey) : letter);
    plan.push({ def, field, header, sourceKey, letter: false });
  }

  if (!defs.length && kind === "object") {
    for (const key of dataKeys) {
      const field = takeField(key, excelLetter(plan.length));
      plan.push({ def: {}, field, header: prettify(key), sourceKey: key, letter: false });
    }
  } else {
    let extraIndex = defs.length;
    for (const key of dataKeys) {
      if (usedData.has(key)) continue;
      const letter = excelLetter(extraIndex++);
      const field = takeField(letter, letter);
      plan.push({ def: {}, field, header: letter, sourceKey: key, letter: true });
      usedData.add(key);
    }
  }

  return plan;
}

function matrixWidthFromRows(rows: Record<string, unknown>[]): number {
  let w = 0;
  for (const row of rows) w = Math.max(w, Object.keys(row).length);
  return w;
}

function projectRows(sourceRows: Record<string, unknown>[], plan: ColPlan[]): Record<string, unknown>[] {
  const identity = plan.every((p) => p.sourceKey === p.field);
  if (identity) return sourceRows;
  const rows = new Array<Record<string, unknown>>(sourceRows.length);
  for (let r = 0; r < sourceRows.length; r++) {
    const src = sourceRows[r]!;
    const next: Record<string, unknown> = {};
    for (const col of plan) {
      next[col.field] = col.sourceKey != null ? (src[col.sourceKey] ?? null) : null;
    }
    rows[r] = next;
  }
  return rows;
}

function pickField(def: EasyColumn): string | undefined {
  return emptyToUndef(def.field) ?? emptyToUndef(def.key) ?? emptyToUndef(def.id);
}

function pickHeader(def: EasyColumn): string | undefined {
  return emptyToUndef(def.header) ?? emptyToUndef(def.heading) ?? emptyToUndef(def.title) ?? emptyToUndef(def.name);
}

function emptyToUndef(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

function prettify(field: string): string {
  if (/^[A-Z]+$/.test(field) && field.length <= 3) return field;
  return field
    .replace(/[_\-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toColumnDef(def: EasyColumn, field: string, header: string, _index: number, letterCol: boolean): ColumnDef {
  const type = def.type ?? def.data_type ?? def.dataType;
  const filterable = def.enable_filtering ?? def.filterable;
  const sortable = def.enable_sorting ?? def.sortable;
  const editable = def.enable_editing ?? def.editable;
  const resizable = def.enable_resizing ?? def.resizable;
  const groupable = def.enable_grouping ?? def.groupable;
  const filter = def.filter_type ?? def.filter;
  return {
    field,
    header,
    type,
    width: def.width,
    pinned: def.pinned,
    sortable: sortable ?? true,
    filterable: filterable ?? true,
    editable: editable ?? true,
    resizable: resizable ?? true,
    groupable: groupable ?? true,
    hide: def.hide ?? def.hidden,
    filter: filterable === false ? false : filter ?? (letterCol ? "text" : undefined),
    agg: def.agg ?? def.aggregation,
    align: def.align,
    format: def.format,
  };
}

