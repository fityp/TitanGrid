import type { FilterModel } from "./filter-model.ts";

export type Field = string;

export type DataType = "string" | "number" | "boolean" | "date" | "sparkline";

export type AggName = "sum" | "avg" | "min" | "max" | "count" | "first" | "last";

export type SortDir = "asc" | "desc";

export type PinSide = "left" | "right";

export interface ColumnDef {
  field: Field;
  header?: string;
  type?: DataType;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  pinned?: PinSide | false;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  editable?: boolean;
  groupable?: boolean;
  hide?: boolean;
  /** `true` picks a default by column type (set/multi). */
  filter?: boolean | "text" | "number" | "date" | "set" | "multi";
  agg?: AggName;
  align?: "left" | "center" | "right";
  format?: (value: unknown, sourceIndex: number) => string;
}

export type FilterOp =
  | "eq"
  | "neq"
  | "contains"
  | "startsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "blank"
  | "notBlank";

export interface ColumnFilter {
  field: Field;
  op: FilterOp;
  value?: unknown;
}

export interface Sort {
  field: Field;
  dir: SortDir;
}

export interface QuerySpec {
  filters: ColumnFilter[];
  filterModel: FilterModel;
  sorts: Sort[];
  groupBy: Field[];
  quickFilter: string;
  expression: string | null;
}

export interface GroupRow {
  kind: "group";
  id: string;
  field: Field;
  key: string;
  depth: number;
  count: number;
  expanded: boolean;
  aggregates: Record<string, number | string | null>;
}

export interface LeafRow {
  kind: "leaf";
  id: string;
  sourceIndex: number;
  depth: number;
}

export type DisplayRow = GroupRow | LeafRow;

export type DisplayModel =
  | { mode: "flat"; indices: Uint32Array }
  | { mode: "tree"; rows: DisplayRow[] };

export interface QueryStats {
  ingestMs: number;
  filterMs: number;
  sortMs: number;
  groupMs: number;
  totalMs: number;
  sourceRows: number;
  resultRows: number;
}

export function defaultQuerySpec(): QuerySpec {
  return {
    filters: [],
    filterModel: {},
    sorts: [],
    groupBy: [],
    quickFilter: "",
    expression: null,
  };
}
