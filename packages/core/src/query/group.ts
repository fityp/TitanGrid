import type { ColumnStore } from "../store.ts";
import type { AggName, ColumnDef, DisplayRow, Field, GroupRow } from "../types.ts";

const SEP = "\u001f";

export function applyGroup(
  store: ColumnStore,
  indices: Uint32Array,
  groupBy: Field[],
  columns: ColumnDef[],
  expanded: ReadonlySet<string>,
): { rows: DisplayRow[]; allIds: string[] } {
  if (!groupBy.length) {
    throw new Error("applyGroup requires groupBy");
  }

  const aggCols = columns.filter((c) => c.agg && !groupBy.includes(c.field));
  const root = new Map<string, Node>();

  for (let i = 0; i < indices.length; i++) {
    const row = indices[i] as number;
    let level = root;
    let path = "";
    for (let g = 0; g < groupBy.length; g++) {
      const field = groupBy[g] as Field;
      const key = store.getString(field, row) || "(blank)";
      path = path ? path + SEP + key : key;
      let node = level.get(key);
      if (!node) {
        node = {
          id: path,
          field,
          key,
          depth: g,
          count: 0,
          children: g === groupBy.length - 1 ? null : new Map(),
          leaves: g === groupBy.length - 1 ? [] : null,
          aggs: allocAggs(aggCols),
        };
        level.set(key, node);
      }
      node.count++;
      accumulate(store, row, aggCols, node.aggs);
      if (node.children) level = node.children;
      else node.leaves!.push(row);
    }
  }

  const allIds: string[] = [];
  collectIds(root, allIds);
  const out: DisplayRow[] = [];
  flatten(root, out, expanded, aggCols);
  return { rows: out, allIds };
}

function collectIds(level: Map<string, Node>, ids: string[]): void {
  for (const node of level.values()) {
    ids.push(node.id);
    if (node.children) collectIds(node.children, ids);
  }
}

interface AggState {
  sum: number;
  min: number;
  max: number;
  count: number;
  first: number | string | null;
  last: number | string | null;
}

interface Node {
  id: string;
  field: Field;
  key: string;
  depth: number;
  count: number;
  children: Map<string, Node> | null;
  leaves: number[] | null;
  aggs: AggState[];
}

function allocAggs(cols: ColumnDef[]): AggState[] {
  return cols.map(() => ({
    sum: 0,
    min: Infinity,
    max: -Infinity,
    count: 0,
    first: null,
    last: null,
  }));
}

function accumulate(store: ColumnStore, row: number, cols: ColumnDef[], aggs: AggState[]): void {
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i]!;
    const state = aggs[i]!;
    const vec = store.vector(col.field);
    if (vec?.kind === "number") {
      if (vec.nulls[row]) continue;
      const n = vec.values[row] as number;
      state.sum += n;
      state.count++;
      if (n < state.min) state.min = n;
      if (n > state.max) state.max = n;
      if (state.first == null) state.first = n;
      state.last = n;
    } else {
      const s = store.getString(col.field, row);
      state.count++;
      if (state.first == null) state.first = s;
      state.last = s;
    }
  }
}

function resolveAgg(fn: AggName, state: AggState): number | string | null {
  switch (fn) {
    case "sum":
      return state.sum;
    case "avg":
      return state.count ? state.sum / state.count : null;
    case "min":
      return state.min === Infinity ? null : state.min;
    case "max":
      return state.max === -Infinity ? null : state.max;
    case "count":
      return state.count;
    case "first":
      return state.first;
    case "last":
      return state.last;
  }
}

function flatten(
  level: Map<string, Node>,
  out: DisplayRow[],
  expanded: ReadonlySet<string>,
  aggCols: ColumnDef[],
): void {
  for (const node of level.values()) {
    const isExpanded = expanded.has(node.id);
    const aggregates: GroupRow["aggregates"] = {};
    for (let i = 0; i < aggCols.length; i++) {
      const col = aggCols[i]!;
      aggregates[col.field] = resolveAgg(col.agg ?? "sum", node.aggs[i]!);
    }
    out.push({
      kind: "group",
      id: node.id,
      field: node.field,
      key: node.key,
      depth: node.depth,
      count: node.count,
      expanded: isExpanded,
      aggregates,
    });
    if (!isExpanded) continue;
    if (node.children) {
      flatten(node.children, out, expanded, aggCols);
    } else if (node.leaves) {
      for (let i = 0; i < node.leaves.length; i++) {
        const sourceIndex = node.leaves[i] as number;
        out.push({
          kind: "leaf",
          id: `${node.id}#${sourceIndex}`,
          sourceIndex,
          depth: node.depth + 1,
        });
      }
    }
  }
}

export function collectGroupIds(rows: DisplayRow[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (row.kind === "group") ids.push(row.id);
  }
  return ids;
}
