import type { ColumnStore, QueryEngine } from "@megagrid/core";
import type { ColumnLayout } from "./layout.ts";
import { ROW_NUMBER_FIELD } from "./layout.ts";
import type { SelectionModel } from "./selection.ts";

export function selectionToTsv(
  engine: QueryEngine,
  store: ColumnStore,
  layout: ColumnLayout,
  selection: SelectionModel,
): string {
  const range = selection.range;
  if (!range) return "";
  const lines: string[] = [];
  const headers: string[] = [];
  for (let c = range.c0; c <= range.c1; c++) {
    const col = layout.all[c];
    if (!col || col.def.field === ROW_NUMBER_FIELD) continue;
    headers.push(col.def.header ?? col.def.field);
  }
  lines.push(headers.join("\t"));
  for (let r = range.r0; r <= range.r1; r++) {
    const display = engine.displayRowAt(r);
    const cells: string[] = [];
    for (let c = range.c0; c <= range.c1; c++) {
      const col = layout.all[c];
      if (!col || col.def.field === ROW_NUMBER_FIELD) continue;
      if (!display) {
        cells.push("");
        continue;
      }
      if (display.kind === "group") {
        cells.push(String(display.aggregates[col.def.field] ?? (c === range.c0 ? display.key : "")));
        continue;
      }
      const v = store.get(col.def.field, display.sourceIndex);
      cells.push(v == null ? "" : String(v));
    }
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

export function exportCsv(engine: QueryEngine, store: ColumnStore, layout: ColumnLayout, maxRows = 100_000): string {
  const cols = layout.all.filter((c) => c.def.field !== ROW_NUMBER_FIELD);
  const header = cols.map((c) => csvCell(c.def.header ?? c.def.field)).join(",");
  const lines = [header];
  const n = Math.min(engine.displayedCount(), maxRows);
  for (let r = 0; r < n; r++) {
    const display = engine.displayRowAt(r);
    const cells: string[] = [];
    for (const col of cols) {
      if (!display) {
        cells.push("");
        continue;
      }
      if (display.kind === "group") {
        cells.push(csvCell(display.aggregates[col.def.field] ?? (col === cols[0] ? display.key : "")));
        continue;
      }
      cells.push(csvCell(store.get(col.def.field, display.sourceIndex)));
    }
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}
