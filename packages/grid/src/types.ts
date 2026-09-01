import type { ColumnDef, ColumnFilter, EasyColumn, Field, FilterModel, QueryStats, Sort } from "@megagrid/core";

export interface GridOptions {
  columns?: ColumnDef[];
  data?: unknown;
  column_definitions?: EasyColumn[];
  table_data?: unknown;
  rowHeight?: number;
  headerHeight?: number;
  floatingFilterHeight?: number;
  rowNumbers?: boolean;
  floatingFilters?: boolean;
  groupBy?: Field[];
  theme?: "dark" | "light";
  defaultColDef?: Partial<ColumnDef>;
  query?: string;
  onReady?: (api: GridApi) => void;
  onCellValueChanged?: (event: CellValueChangedEvent) => void;
  onStats?: (stats: QueryStats) => void;
}

export interface CellValueChangedEvent {
  field: Field;
  sourceIndex: number;
  value: unknown;
  oldValue: unknown;
}

export interface CellCoord {
  row: number;
  col: number;
}

export interface CellRange {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export interface GridApi {
  setData(rows: unknown): void;
  setPayload(payload: unknown): void;
  setGroupBy(fields: Field[]): void;
  setQuickFilter(text: string): void;
  setExpression(expr: string | null): void;
  setFilter(field: Field, filter: ColumnFilter | null): void;
  setFilterModel(model: FilterModel): void;
  getFilterModel(): FilterModel;
  setSort(sorts: Sort[]): void;
  expandAll(): void;
  collapseAll(): void;
  getDisplayedRowCount(): number;
  getSourceRowCount(): number;
  getStats(): QueryStats;
  copySelection(): string;
  exportCsv(): string;
  sizeColumnsToFit(): void;
  redraw(): void;
  destroy(): void;
}

export interface Theme {
  name: "dark" | "light";
  bg: string;
  altRow: string;
  groupRow: string;
  headerBg: string;
  gridLine: string;
  text: string;
  textMuted: string;
  accent: string;
  selectionFill: string;
  focusBorder: string;
  hoverFill: string;
  sparkPos: string;
  sparkNeg: string;
  font: string;
  fontSize: number;
  headerFont: string;
}

export const darkTheme: Theme = {
  name: "dark",
  bg: "#0c0f14",
  altRow: "#10141b",
  groupRow: "#151b26",
  headerBg: "#121722",
  gridLine: "#1f2633",
  text: "#e7ecf3",
  textMuted: "#8b97a8",
  accent: "#4c9fff",
  selectionFill: "rgba(76, 159, 255, 0.22)",
  focusBorder: "#4c9fff",
  hoverFill: "rgba(255, 255, 255, 0.04)",
  sparkPos: "#3dd68c",
  sparkNeg: "#ff6b7a",
  font: 'Inter, "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
  fontSize: 12.5,
  headerFont: 'Inter, "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
};

export const lightTheme: Theme = {
  name: "light",
  bg: "#ffffff",
  altRow: "#f6f8fb",
  groupRow: "#eef2f7",
  headerBg: "#f3f6fa",
  gridLine: "#e2e8f0",
  text: "#1a2332",
  textMuted: "#5d6b80",
  accent: "#2563eb",
  selectionFill: "rgba(37, 99, 235, 0.16)",
  focusBorder: "#2563eb",
  hoverFill: "rgba(15, 23, 42, 0.04)",
  sparkPos: "#16a34a",
  sparkNeg: "#dc2626",
  font: 'Inter, "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
  fontSize: 12.5,
  headerFont: 'Inter, "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
};
