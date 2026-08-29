export type JoinOperator = "AND" | "OR";

export type TextFilterType =
  | "equals"
  | "notEqual"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "blank"
  | "notBlank";

export type NumberFilterType =
  | "equals"
  | "notEqual"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "inRange"
  | "blank"
  | "notBlank";

export type DateFilterType = NumberFilterType;

export interface TextFilterModel {
  filterType: "text";
  type: TextFilterType;
  filter?: string | null;
  filterTo?: string | null;
}

export interface NumberFilterModel {
  filterType: "number";
  type: NumberFilterType;
  filter?: number | null;
  filterTo?: number | null;
}

export interface DateFilterModel {
  filterType: "date";
  type: DateFilterType;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface SetFilterModel {
  filterType: "set";
  values: (string | number | boolean | null)[];
}

export interface CombinedFilterModel<T> {
  filterType: T extends { filterType: infer F } ? F : string;
  operator: JoinOperator;
  conditions: T[];
  condition1?: T;
  condition2?: T;
}

export interface MultiFilterModel {
  filterType: "multi";
  filterModels: (ColumnFilterModel | null)[];
}

export type SimpleFilterModel = TextFilterModel | NumberFilterModel | DateFilterModel;

export type ColumnFilterModel =
  | TextFilterModel
  | NumberFilterModel
  | DateFilterModel
  | SetFilterModel
  | CombinedFilterModel<TextFilterModel>
  | CombinedFilterModel<NumberFilterModel>
  | CombinedFilterModel<DateFilterModel>
  | MultiFilterModel;

export type FilterModel = Record<string, ColumnFilterModel>;

export type FilterKind = "text" | "number" | "date" | "set" | "multi" | "none";

export function isCombinedModel(model: ColumnFilterModel): boolean {
  return "operator" in model;
}

export function combinedConditions<T extends SimpleFilterModel>(model: CombinedFilterModel<T> | T): T[] {
  if (!("operator" in model)) return [model];
  if (model.conditions?.length) return model.conditions;
  const out: T[] = [];
  if (model.condition1) out.push(model.condition1);
  if (model.condition2) out.push(model.condition2);
  return out;
}

export function isFilterActive(model: ColumnFilterModel | null | undefined): boolean {
  if (!model) return false;
  if (model.filterType === "multi") {
    return model.filterModels.some((m) => isFilterActive(m));
  }
  if (model.filterType === "set") {
    return Array.isArray(model.values);
  }
  if (isCombinedModel(model)) {
    return combinedConditions(model as CombinedFilterModel<SimpleFilterModel>).some((c) => isFilterActive(c));
  }
  const simple = model as SimpleFilterModel;
  const type = simple.type;
  if (type === "blank" || type === "notBlank") return true;
  if (simple.filterType === "text") {
    return (simple.filter ?? "") !== "";
  }
  if (simple.filterType === "number") {
    if (simple.type === "inRange") {
      return simple.filter != null || simple.filterTo != null;
    }
    return simple.filter != null && Number.isFinite(simple.filter);
  }
  if (simple.filterType === "date") {
    if (simple.type === "inRange") return !!(simple.dateFrom || simple.dateTo);
    return !!simple.dateFrom;
  }
  return false;
}

export function simpleFilterToModel(filter: {
  field: string;
  op: string;
  value?: unknown;
}): ColumnFilterModel {
  const op = filter.op;
  if (op === "in") {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];
    return { filterType: "set", values: values.map((v) => (v == null ? null : v as string | number | boolean)) };
  }
  if (op === "contains" || op === "startsWith") {
    return { filterType: "text", type: op, filter: String(filter.value ?? "") };
  }
  if (op === "eq" || op === "neq" || op === "gt" || op === "gte" || op === "lt" || op === "lte") {
    if (typeof filter.value === "number" || filter.value === "" || filter.value == null) {
      const map: Record<string, NumberFilterType> = {
        eq: "equals",
        neq: "notEqual",
        gt: "greaterThan",
        gte: "greaterThanOrEqual",
        lt: "lessThan",
        lte: "lessThanOrEqual",
      };
      return {
        filterType: "number",
        type: map[op]!,
        filter: filter.value == null || filter.value === "" ? null : Number(filter.value),
      };
    }
    const map: Record<string, TextFilterType> = {
      eq: "equals",
      neq: "notEqual",
    };
    return { filterType: "text", type: map[op] ?? "equals", filter: String(filter.value) };
  }
  if (op === "blank" || op === "notBlank") {
    return { filterType: "text", type: op, filter: null };
  }
  return { filterType: "text", type: "contains", filter: String(filter.value ?? "") };
}

export function filtersToModel(
  filters: { field: string; op: string; value?: unknown }[],
): FilterModel {
  const model: FilterModel = {};
  for (const f of filters) model[f.field] = simpleFilterToModel(f);
  return model;
}

export function resolveFilterModel(
  filterModel: FilterModel | undefined,
  filters: { field: string; op: string; value?: unknown }[] | undefined,
): FilterModel {
  if (filterModel && Object.keys(filterModel).length) return filterModel;
  return filtersToModel(filters ?? []);
}

export function defaultFilterKind(type: string | undefined, filter?: boolean | FilterKind): FilterKind {
  if (filter === false || filter === "none") return "none";
  if (filter === "text" || filter === "number" || filter === "date" || filter === "set" || filter === "multi") {
    return filter;
  }
  if (type === "number") return "number";
  if (type === "date") return "date";
  if (type === "boolean") return "set";
  if (type === "sparkline") return "none";
  return "multi";
}

export const TEXT_OPTIONS: { key: TextFilterType; label: string }[] = [
  { key: "contains", label: "Contains" },
  { key: "notContains", label: "Does not contain" },
  { key: "equals", label: "Equals" },
  { key: "notEqual", label: "Does not equal" },
  { key: "startsWith", label: "Begins with" },
  { key: "endsWith", label: "Ends with" },
  { key: "blank", label: "Blank" },
  { key: "notBlank", label: "Not blank" },
];

export const NUMBER_OPTIONS: { key: NumberFilterType; label: string }[] = [
  { key: "equals", label: "Equals" },
  { key: "notEqual", label: "Does not equal" },
  { key: "greaterThan", label: "Greater than" },
  { key: "greaterThanOrEqual", label: "Greater than or equal" },
  { key: "lessThan", label: "Less than" },
  { key: "lessThanOrEqual", label: "Less than or equal" },
  { key: "inRange", label: "In range" },
  { key: "blank", label: "Blank" },
  { key: "notBlank", label: "Not blank" },
];

export function needsValueInput(type: string): boolean {
  return type !== "blank" && type !== "notBlank";
}

export function needsSecondInput(type: string): boolean {
  return type === "inRange";
}
