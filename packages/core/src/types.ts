import type { FilterModel } from "./filter-model.ts";

export type Field = string;

export type DataType = "string" | "number" | "boolean" | "date" | "sparkline";

export type AggName = "sum" | "avg" | "min" | "max" | "count" | "first" | "last";

export type SortDir = "asc" | "desc";

export type PinSide = "left" | "right";

export type IconPlacement = "before" | "after" | "replace";

export type IconActionType = "link" | "http" | "modal" | "callback";

export type ChildInclude = "none" | "direct" | "subtree";

export interface IconActionContext {
  row: Record<string, unknown>;
  sourceIndex: number;
  field: Field;
  value: unknown;
  icon: ColumnIcon;
}

export interface IconAction {
  /** Omit or use `"callback"` when only `run` is set. */
  type?: IconActionType;
  /** URL or path. `{{field}}` and `{{value}}` are interpolated (not HTML-escaped). */
  url?: string;
  target?: string;
  method?: string;
  headers?: Record<string, string>;
  /** Default true for `http`. */
  includeRow?: boolean;
  /** Default `subtree` for `http` when the row is included. `true` means `subtree`. */
  includeChildren?: boolean | ChildInclude;
  /** HTML for a modal body. Values are escaped. */
  template?: string;
  title?: string;
  /** JS-only handler. Runs in addition to the declarative action when both are set. */
  run?: (ctx: IconActionContext) => void | Promise<void>;
}

export interface CellStyle {
  color?: string;
  background?: string;
  /** Rounded chip around the formatted text instead of a full-cell fill. */
  pill?: boolean;
}

export interface ColumnIcon {
  id?: string;
  /** Image URL, or a function of `(value, sourceIndex, row?)`. */
  url?: string | ((value: unknown, sourceIndex: number, row: Record<string, unknown>) => string | undefined);
  /** Row field that holds the image URL. Wins over `url` when present. */
  urlField?: string;
  /** Icon-font class for DOM surfaces (filter list). Canvas still needs a `url`. */
  className?: string;
  /**
   * Painted chip text. Interpolates `{{field}}` like `title`.
   * A label-only icon is a button; no image URL required.
   */
  label?: string | ((value: unknown, sourceIndex: number, row: Record<string, unknown>) => string | undefined);
  /** Chip text color. */
  color?: string;
  /** Chip fill. */
  background?: string;
  title?: string;
  placement?: IconPlacement;
  /** Show when the cell value equals this. */
  eq?: unknown;
  in?: unknown[];
  /** Expression over row fields (`gold > 0 && country == "Canada"`). */
  visibleIf?: string;
  visible?: (row: Record<string, unknown>, sourceIndex: number, value: unknown) => boolean;
  action?: IconAction;
}

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
  /** Show this column in the grid. `false` is the same as `hide: true`. */
  visible?: boolean;
  /**
   * Grid and/or row-detail visibility.
   * `true` / `"all"` both, `false` / `"none"` neither, `"grid"` grid only, `"detail"` modal only.
   */
  visibility?: boolean | "all" | "grid" | "detail" | "none";
  /** Show this field in the row-detail modal. Default true. */
  detailVisible?: boolean;
  /** HTML for this field in the row-detail modal. `{{value}}` and other field names work. */
  detailTemplate?: string;
  /** `true` picks a default by column type (set/multi). */
  filter?: boolean | "text" | "number" | "date" | "set" | "multi";
  agg?: AggName;
  align?: "left" | "center" | "right";
  format?: (value: unknown, sourceIndex: number) => string;
  /** Icons painted as cell content. Distinct resolved icons are distinct filter/group values. */
  icons?: ColumnIcon[];
  /** Per-cell color. Functions run on the stored value, like `format`. */
  cellStyle?: CellStyle | ((value: unknown, sourceIndex: number) => CellStyle | undefined | null);
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
  /** When set, this group is also a data row (nested payload). */
  sourceIndex?: number;
  /** Icon URLs for the group key when grouping by an icon column. */
  icons?: string[];
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
