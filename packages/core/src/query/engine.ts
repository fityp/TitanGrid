import type { BoundTree } from "../bind.ts";
import type { ColumnStore } from "../store.ts";
import type { ColumnDef, DisplayModel, QuerySpec, QueryStats } from "../types.ts";
import { compileExpression } from "./expression.ts";
import { applyFilters } from "./filter.ts";
import { applyGroup } from "./group.ts";
import { applySort } from "./sort.ts";
import { applyTree } from "./tree.ts";

export class QueryEngine {
  private store: ColumnStore | null = null;
  private columns: ColumnDef[] = [];
  private tree: BoundTree | null = null;
  private expanded = new Set<string>();
  private lastStats: QueryStats = emptyStats();
  private lastModel: DisplayModel = { mode: "flat", indices: new Uint32Array(0) };
  private allGroupIds: string[] = [];

  setStore(store: ColumnStore, columns: ColumnDef[], tree: BoundTree | null = null): void {
    this.store = store;
    this.columns = columns;
    this.tree = tree;
    this.expanded.clear();
    if (tree) {
      for (let i = 0; i < tree.parent.length; i++) {
        if (tree.children[i]?.length) this.expanded.add(`t:${i}`);
      }
    }
  }

  getStore(): ColumnStore | null {
    return this.store;
  }

  stats(): QueryStats {
    return this.lastStats;
  }

  model(): DisplayModel {
    return this.lastModel;
  }

  displayedCount(): number {
    const m = this.lastModel;
    return m.mode === "flat" ? m.indices.length : m.rows.length;
  }

  sourceIndexAt(displayIndex: number): number | null {
    const m = this.lastModel;
    if (m.mode === "flat") {
      const v = m.indices[displayIndex];
      return v === undefined ? null : v;
    }
    const row = m.rows[displayIndex];
    if (!row) return null;
    if (row.kind === "leaf") return row.sourceIndex;
    return row.sourceIndex ?? null;
  }

  displayRowAt(displayIndex: number) {
    const m = this.lastModel;
    if (m.mode === "tree") return m.rows[displayIndex] ?? null;
    const sourceIndex = m.indices[displayIndex];
    if (sourceIndex === undefined) return null;
    return {
      kind: "leaf" as const,
      id: String(sourceIndex),
      sourceIndex,
      depth: 0,
    };
  }

  isExpanded(id: string): boolean {
    return this.expanded.has(id);
  }

  toggleExpanded(id: string): void {
    if (this.expanded.has(id)) this.expanded.delete(id);
    else this.expanded.add(id);
  }

  expandAll(): void {
    for (const id of this.allGroupIds) this.expanded.add(id);
  }

  collapseAll(): void {
    this.expanded.clear();
  }

  setExpanded(ids: Iterable<string>, value: boolean): void {
    for (const id of ids) {
      if (value) this.expanded.add(id);
      else this.expanded.delete(id);
    }
  }

  run(spec: QuerySpec): DisplayModel {
    const store = this.store;
    if (!store) {
      this.lastModel = { mode: "flat", indices: new Uint32Array(0) };
      return this.lastModel;
    }

    const t0 = now();
    let exprPred: ((row: number) => boolean) | null = null;
    if (spec.expression?.trim()) {
      const compiled = compileExpression(spec.expression, new Set(store.fields));
      exprPred = (row) => compiled((field) => store.get(field, row));
    }

    const tFilter = now();
    const filtered = applyFilters(
      store,
      spec.filters,
      spec.quickFilter,
      exprPred,
      undefined,
      spec.filterModel,
    );
    const filterMs = now() - tFilter;

    const tSort = now();
    const sorted = applySort(store, filtered, spec.sorts);
    const sortMs = now() - tSort;

    const tGroup = now();
    let model: DisplayModel;
    if (spec.groupBy.length) {
      const grouped = applyGroup(store, sorted, spec.groupBy, this.columns, this.expanded);
      this.allGroupIds = grouped.allIds;
      model = { mode: "tree", rows: grouped.rows };
    } else if (this.tree) {
      const labelField = this.columns.find((c) => c.field && !c.field.startsWith("__"))?.field;
      const nested = applyTree(this.tree, sorted, this.expanded, (row) =>
        labelField ? store.getString(labelField, row) || `(${row})` : String(row),
      );
      this.allGroupIds = nested.allIds;
      model = { mode: "tree", rows: nested.rows };
    } else {
      this.allGroupIds = [];
      model = { mode: "flat", indices: sorted };
    }
    const groupMs = now() - tGroup;

    this.lastModel = model;
    this.lastStats = {
      ingestMs: this.lastStats.ingestMs,
      filterMs,
      sortMs,
      groupMs,
      totalMs: now() - t0,
      sourceRows: store.rowCount,
      resultRows: this.displayedCount(),
    };
    return model;
  }

  setIngestMs(ms: number): void {
    this.lastStats = { ...this.lastStats, ingestMs: ms };
  }
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function emptyStats(): QueryStats {
  return {
    ingestMs: 0,
    filterMs: 0,
    sortMs: 0,
    groupMs: 0,
    totalMs: 0,
    sourceRows: 0,
    resultRows: 0,
  };
}
