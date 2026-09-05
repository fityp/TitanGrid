import {
  contentLabel,
  defaultFilterKind,
  isFilterActive,
  type ColumnDef,
  type ColumnFilterModel,
  type FilterKind,
  type MultiFilterModel,
  type NumberFilterModel,
  type SetFilterModel,
} from "@titangrid/core";

export function kindForColumn(def: ColumnDef): FilterKind {
  if (def.filterable === false) return "none";
  return defaultFilterKind(def.type, def.filter);
}

export function parseFloatingInput(text: string, kind: FilterKind): ColumnFilterModel | null {
  const t = text.trim();
  if (!t) return null;
  if (kind === "number") {
    const m = t.match(/^(>=|<=|!=|>|<|=)?\s*(.+)$/);
    if (!m?.[2]) return null;
    const inner = m[2].trim();
    if (inner.includes("...")) {
      const [a, b] = inner.split("...").map((s) => Number(s.trim()));
      if (Number.isFinite(a) && Number.isFinite(b)) {
        return { filterType: "number", type: "inRange", filter: a, filterTo: b };
      }
    }
    const value = Number(inner);
    if (!Number.isFinite(value)) return null;
    const map: Record<string, NumberFilterModel["type"]> = {
      ">=": "greaterThanOrEqual",
      "<=": "lessThanOrEqual",
      ">": "greaterThan",
      "<": "lessThan",
      "!=": "notEqual",
      "=": "equals",
    };
    return { filterType: "number", type: map[m[1] ?? "="] ?? "equals", filter: value };
  }
  if (kind === "date") {
    return { filterType: "date", type: "equals", dateFrom: t };
  }
  return { filterType: "text", type: "contains", filter: t };
}

export function floatingDisplay(model: ColumnFilterModel | undefined, _kind: FilterKind): string {
  if (!model || !isFilterActive(model)) return "";
  if (model.filterType === "multi") {
    const inner = model.filterModels.find((m) => m && isFilterActive(m));
    return inner ? floatingDisplay(inner, _kind) : "";
  }
  if (model.filterType === "set") {
    return model.values.length ? `${model.values.length} selected` : "";
  }
  if ("operator" in model) return "";
  if (model.filterType === "text") return model.filter ?? "";
  if (model.filterType === "number") {
    if (model.type === "inRange") return `${model.filter ?? ""}...${model.filterTo ?? ""}`;
    if (model.type === "blank") return "(blank)";
    if (model.type === "notBlank") return "(not blank)";
    const op = {
      equals: "",
      notEqual: "!= ",
      greaterThan: "> ",
      greaterThanOrEqual: ">= ",
      lessThan: "< ",
      lessThanOrEqual: "<= ",
    }[model.type] ?? "";
    return `${op}${model.filter ?? ""}`;
  }
  if (model.filterType === "date") return model.dateFrom ?? "";
  return "";
}

export function setFloatLabel(model: ColumnFilterModel | undefined): string {
  if (!model || !isFilterActive(model)) return "All";
  if (model.filterType === "multi") {
    const inner = model.filterModels.find((m) => m?.filterType === "set");
    return inner?.filterType === "set" ? setFloatLabel(inner) : "All";
  }
  if (model.filterType !== "set") return floatingDisplay(model, "set") || "All";
  return formatSetValues(model);
}

export function booleanFloatValue(model: ColumnFilterModel | undefined): "" | "true" | "false" {
  const set = model?.filterType === "set" ? model : model?.filterType === "multi"
    ? model.filterModels.find((m): m is SetFilterModel => m?.filterType === "set")
    : undefined;
  if (!set || set.values.length !== 1) return "";
  const v = set.values[0];
  if (v === true || v === "true") return "true";
  if (v === false || v === "false") return "false";
  return "";
}

function formatSetValues(model: SetFilterModel): string {
  if (!model.values.length) return "(None)";
  const labels = model.values.map((v) => (v == null ? "(Blanks)" : contentLabel(v)));
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.length} selected`;
}

export function applyFloating(
  kind: FilterKind,
  existing: ColumnFilterModel | undefined,
  floating: ColumnFilterModel | null,
): ColumnFilterModel | null {
  if (kind === "multi") {
    const multi: MultiFilterModel = existing?.filterType === "multi"
      ? { filterType: "multi", filterModels: [...existing.filterModels] }
      : { filterType: "multi", filterModels: [null, existing?.filterType === "set" ? existing : null] };
    multi.filterModels[0] = floating?.filterType === "text" ? floating : floating;
    const parts = multi.filterModels.filter((m) => isFilterActive(m));
    if (!parts.length) return null;
    return { filterType: "multi", filterModels: multi.filterModels.map((m) => (isFilterActive(m) ? m : null)) };
  }
  return floating;
}
