import {
  combinedConditions,
  isCombinedModel,
  isFilterActive,
  resolveFilterModel,
  type CombinedFilterModel,
  type ColumnFilterModel,
  type DateFilterModel,
  type FilterModel,
  type NumberFilterModel,
  type SetFilterModel,
  type SimpleFilterModel,
  type TextFilterModel,
} from "../filter-model.ts";
import { BLANK_CODE, parseDate, type ColumnStore } from "../store.ts";
import type { ColumnDef, ColumnFilter, Field } from "../types.ts";
import { contentKeys, hasIcons, isContentKey } from "../icons.ts";

export type RowPredicate = (row: number) => boolean;

export function applyFilters(
  store: ColumnStore,
  filters: ColumnFilter[],
  quickFilter: string,
  exprPred: RowPredicate | null,
  source?: Uint32Array,
  filterModel?: FilterModel,
  columns?: ColumnDef[],
): Uint32Array {
  const model = resolveFilterModel(filterModel, filters);
  const preds: RowPredicate[] = [];
  for (const field of Object.keys(model)) {
    const compiled = compileColumnFilter(store, field, model[field]!, columnByField(columns, field));
    if (compiled) preds.push(compiled);
  }
  const q = quickFilter.trim().toLowerCase();
  if (q) preds.push(compileQuickFilter(store, q));
  if (exprPred) preds.push(exprPred);

  const n = source ? source.length : store.rowCount;
  if (!preds.length) {
    if (source) return source;
    const all = new Uint32Array(n);
    for (let i = 0; i < n; i++) all[i] = i;
    return all;
  }

  const out = new Uint32Array(n);
  let w = 0;
  const p0 = preds[0]!;
  const p1 = preds[1];
  const rest = preds.length > 2;

  outer: for (let i = 0; i < n; i++) {
    const row = source ? (source[i] as number) : i;
    if (!p0(row)) continue;
    if (p1 && !p1(row)) continue;
    if (rest) {
      for (let p = 2; p < preds.length; p++) {
        if (!preds[p]!(row)) continue outer;
      }
    }
    out[w++] = row;
  }
  return out.subarray(0, w);
}

export function compileColumnFilter(
  store: ColumnStore,
  field: Field,
  model: ColumnFilterModel | null | undefined,
  def?: ColumnDef,
): RowPredicate | null {
  if (!isFilterActive(model) || !model) return null;
  if (model.filterType === "multi") {
    const parts = model.filterModels
      .map((m) => compileColumnFilter(store, field, m, def))
      .filter((p): p is RowPredicate => p != null);
    if (!parts.length) return null;
    return andPreds(parts);
  }
  if (model.filterType === "set") return compileSet(store, field, model, def);
  if (isCombinedModel(model)) {
    const parts = combinedConditions(model as CombinedFilterModel<SimpleFilterModel>)
      .map((c) => compileSimple(store, field, c))
      .filter((p): p is RowPredicate => p != null);
    if (!parts.length) return null;
    return (model as CombinedFilterModel<SimpleFilterModel>).operator === "OR" ? orPreds(parts) : andPreds(parts);
  }
  return compileSimple(store, field, model as SimpleFilterModel);
}

function compileSimple(store: ColumnStore, field: Field, model: SimpleFilterModel): RowPredicate | null {
  if (!isFilterActive(model)) return null;
  if (model.filterType === "text") return compileText(store, field, model);
  if (model.filterType === "number") return compileNumber(store, field, model);
  return compileDate(store, field, model);
}

function compileText(store: ColumnStore, field: Field, model: TextFilterModel): RowPredicate | null {
  const vec = store.vector(field);
  const type = model.type;
  if (type === "blank") return (row) => store.isBlank(field, row);
  if (type === "notBlank") return (row) => !store.isBlank(field, row);

  const needleRaw = model.filter ?? "";
  if (needleRaw === "") return null;
  const needle = needleRaw.toLowerCase();

  if (vec?.kind === "string") {
    const pass = new Uint8Array(vec.dictionary.length);
    for (let i = 0; i < vec.dictionary.length; i++) {
      const hay = vec.dictionaryLower[i] ?? "";
      pass[i] = textMatch(hay, needle, type) ? 1 : 0;
    }
    const blankPass = textMatch("", needle, type);
    return (row) => {
      const code = vec.codes[row] ?? BLANK_CODE;
      if (code === BLANK_CODE) return blankPass;
      return pass[code] === 1;
    };
  }

  return (row) => {
    if (store.isBlank(field, row)) return textMatch("", needle, type);
    return textMatch(store.getString(field, row).toLowerCase(), needle, type);
  };
}

function textMatch(hay: string, needle: string, type: TextFilterModel["type"]): boolean {
  switch (type) {
    case "contains":
      return hay.includes(needle);
    case "notContains":
      return !hay.includes(needle);
    case "equals":
      return hay === needle;
    case "notEqual":
      return hay !== needle;
    case "startsWith":
      return hay.startsWith(needle);
    case "endsWith":
      return hay.endsWith(needle);
    default:
      return true;
  }
}

function compileNumber(store: ColumnStore, field: Field, model: NumberFilterModel): RowPredicate | null {
  const vec = store.vector(field);
  const type = model.type;
  if (type === "blank") return (row) => store.isBlank(field, row);
  if (type === "notBlank") return (row) => !store.isBlank(field, row);

  const a = model.filter;
  const b = model.filterTo;
  const from = a == null ? -Infinity : a;
  const to = b == null ? Infinity : b;

  if (vec?.kind === "number" || vec?.kind === "date") {
    const values = vec.values;
    const nulls = vec.nulls;
    switch (type) {
      case "equals":
        return (row) => !nulls[row] && values[row] === a;
      case "notEqual":
        return (row) => !nulls[row] && values[row] !== a;
      case "greaterThan":
        return (row) => !nulls[row] && (values[row] as number) > from;
      case "greaterThanOrEqual":
        return (row) => !nulls[row] && (values[row] as number) >= from;
      case "lessThan":
        return (row) => !nulls[row] && (values[row] as number) < from;
      case "lessThanOrEqual":
        return (row) => !nulls[row] && (values[row] as number) <= from;
      case "inRange":
        return (row) => {
          if (nulls[row]) return false;
          const n = values[row] as number;
          // Inclusive bounds (Excel-style).
          return n >= from && n <= to;
        };
      default:
        return null;
    }
  }

  return (row) => {
    if (store.isBlank(field, row)) return false;
    const n = store.getNumber(field, row);
    if (!Number.isFinite(n)) return false;
    switch (type) {
      case "equals":
        return n === a;
      case "notEqual":
        return n !== a;
      case "greaterThan":
        return n > from;
      case "greaterThanOrEqual":
        return n >= from;
      case "lessThan":
        return n < from;
      case "lessThanOrEqual":
        return n <= from;
      case "inRange":
        return n >= from && n <= to;
      default:
        return true;
    }
  };
}

function compileDate(store: ColumnStore, field: Field, model: DateFilterModel): RowPredicate | null {
  const from = parseDate(model.dateFrom);
  const to = parseDate(model.dateTo);
  return compileNumber(store, field, {
    filterType: "number",
    type: model.type,
    filter: from,
    filterTo: to,
  });
}

function compileSet(store: ColumnStore, field: Field, model: SetFilterModel, def?: ColumnDef): RowPredicate {
  const selected = new Set<string>();
  let includeBlank = false;
  for (const v of model.values) {
    if (v == null || v === "") includeBlank = true;
    else selected.add(String(v));
  }

  if (def && hasIcons(def)) {
    const keys = contentKeys(store, def);
    const byContentKey = model.values.some((v) => isContentKey(v));
    if (byContentKey) {
      return (row) => {
        const key = keys[row] ?? "";
        if (!key) return includeBlank;
        return selected.has(key);
      };
    }
  }

  const vec = store.vector(field);
  if (vec?.kind === "string") {
    const pass = new Uint8Array(vec.dictionary.length);
    for (let i = 0; i < vec.dictionary.length; i++) {
      if (selected.has(vec.dictionary[i]!)) pass[i] = 1;
    }
    return (row) => {
      const code = vec.codes[row] ?? BLANK_CODE;
      if (code === BLANK_CODE) return includeBlank;
      return pass[code] === 1;
    };
  }
  if (vec?.kind === "number") {
    const nums = new Set<number>();
    for (const v of model.values) {
      if (v == null || v === "") continue;
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n)) nums.add(n);
    }
    return (row) => {
      if (vec.nulls[row]) return includeBlank;
      return nums.has(vec.values[row] as number);
    };
  }
  if (vec?.kind === "boolean") {
    const wantTrue = selected.has("true") || selected.has("True") || model.values.includes(true);
    const wantFalse = selected.has("false") || selected.has("False") || model.values.includes(false);
    return (row) => {
      const v = vec.values[row] ?? 2;
      if (v === 2) return includeBlank;
      return v === 1 ? wantTrue : wantFalse;
    };
  }

  return (row) => {
    if (store.isBlank(field, row)) return includeBlank;
    return selected.has(store.getString(field, row));
  };
}

function compileQuickFilter(store: ColumnStore, q: string): RowPredicate {
  const fields = store.fields;
  const fieldPreds = fields.map((field) =>
    compileText(store, field, { filterType: "text", type: "contains", filter: q }),
  );
  return (row) => {
    for (let i = 0; i < fieldPreds.length; i++) {
      if (fieldPreds[i]?.(row)) return true;
    }
    return false;
  };
}

function andPreds(preds: RowPredicate[]): RowPredicate {
  if (preds.length === 1) return preds[0]!;
  return (row) => {
    for (let i = 0; i < preds.length; i++) if (!preds[i]!(row)) return false;
    return true;
  };
}

function orPreds(preds: RowPredicate[]): RowPredicate {
  if (preds.length === 1) return preds[0]!;
  return (row) => {
    for (let i = 0; i < preds.length; i++) if (preds[i]!(row)) return true;
    return false;
  };
}

function columnByField(columns: ColumnDef[] | undefined, field: Field): ColumnDef | undefined {
  if (!columns) return undefined;
  for (let i = 0; i < columns.length; i++) {
    if (columns[i]!.field === field) return columns[i];
  }
  return undefined;
}
