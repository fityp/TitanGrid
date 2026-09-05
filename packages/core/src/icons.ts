import type { BoundTree } from "./bind.ts";
import { compileExpression } from "./query/expression.ts";
import type { ColumnStore, UniqueValue } from "./store.ts";
import { interpolatePlain } from "./template.ts";
import type { ChildInclude, ColumnDef, ColumnIcon } from "./types.ts";

/** Separates icon URLs from cell text in a content key. */
export const CONTENT_SEP = "\u001f";
const ICON_SEP = "\u001e";

export interface ResolvedIcon {
  def: ColumnIcon;
  url: string;
  className: string;
  label: string;
  color: string;
  background: string;
  title: string;
  placement: "before" | "after" | "replace";
}

type ContentCache = { gen: number; keys: string[]; uniques: UniqueValue[] };

const contentCache = new WeakMap<ColumnStore, Map<string, ContentCache>>();

export function hasIcons(def: ColumnDef | undefined | null): boolean {
  return !!def?.icons?.length;
}

export function isContentKey(value: unknown): boolean {
  return typeof value === "string" && value.includes(CONTENT_SEP);
}

export function cellContentKey(text: string, urls: string[]): string {
  if (!text && !urls.length) return "";
  return `${urls.join(ICON_SEP)}${CONTENT_SEP}${text}`;
}

export function parseContentKey(key: string): { urls: string[]; text: string } {
  const i = key.indexOf(CONTENT_SEP);
  if (i < 0) return { urls: [], text: key };
  const urlsPart = key.slice(0, i);
  return {
    urls: urlsPart ? urlsPart.split(ICON_SEP) : [],
    text: key.slice(i + CONTENT_SEP.length),
  };
}

export function contentLabel(value: unknown): string {
  if (value == null || value === "") return "(Blanks)";
  if (isContentKey(value)) {
    const parsed = parseContentKey(String(value));
    return parsed.text || (parsed.urls.length ? "(icon)" : "(Blanks)");
  }
  return String(value);
}

export function resolveChildInclude(
  value: boolean | ChildInclude | undefined,
  fallback: ChildInclude,
): ChildInclude {
  if (value === true) return "subtree";
  if (value === false) return "none";
  if (value === "none" || value === "direct" || value === "subtree") return value;
  return fallback;
}

export function cellText(store: ColumnStore, def: ColumnDef, row: number): string {
  const raw = store.get(def.field, row);
  if (def.format) {
    const formatted = def.format(raw, row);
    return formatted == null ? "" : String(formatted);
  }
  return store.getString(def.field, row);
}

export function resolveIcons(store: ColumnStore, def: ColumnDef, row: number): ResolvedIcon[] {
  const icons = def.icons;
  if (!icons?.length) return [];
  const value = store.get(def.field, row);
  const fields = new Set(store.fields);
  let record: Record<string, unknown> | undefined;
  const ensureRow = (): Record<string, unknown> => {
    if (!record) record = store.getRow(row);
    return record;
  };
  const get = (key: string): unknown => {
    if (key === "value") return value;
    if (key === "field") return def.field;
    if (key === "heading" || key === "header") return def.header ?? def.field;
    return store.get(key, row);
  };

  const out: ResolvedIcon[] = [];
  for (let i = 0; i < icons.length; i++) {
    const icon = icons[i]!;
    if (!iconVisible(icon, value, row, fields, get, ensureRow)) continue;
    const url = resolveUrl(icon, value, row, get, ensureRow);
    const className = icon.className ?? "";
    const label = resolveLabel(icon, value, row, get, ensureRow);
    if (!url && !className && !label) continue;
    out.push({
      def: icon,
      url,
      className,
      label,
      color: icon.color ?? "",
      background: icon.background ?? "",
      title: icon.title ? interpolatePlain(icon.title, get) : "",
      placement: icon.placement ?? "before",
    });
  }
  return out;
}

export function contentKeyAt(store: ColumnStore, def: ColumnDef, row: number): string {
  if (!hasIcons(def)) return store.getString(def.field, row);
  const icons = resolveIcons(store, def, row);
  return cellContentKey(
    cellText(store, def, row),
    icons.map((ic) => ic.url || ic.className || ic.label),
  );
}

export function uniqueCellValues(store: ColumnStore, def: ColumnDef): UniqueValue[] {
  if (!hasIcons(def)) return store.uniqueValues(def.field);
  return contentUniques(store, def).uniques;
}

export function contentKeys(store: ColumnStore, def: ColumnDef): string[] {
  if (!hasIcons(def)) {
    const keys = new Array<string>(store.rowCount);
    for (let i = 0; i < store.rowCount; i++) keys[i] = store.getString(def.field, i);
    return keys;
  }
  return contentUniques(store, def).keys;
}

export function rowWithChildren(
  store: ColumnStore,
  tree: BoundTree | null,
  index: number,
  include: ChildInclude = "subtree",
): Record<string, unknown> {
  const row = store.getRow(index);
  if (!tree || include === "none") return row;
  const kids = tree.children[index] ?? [];
  if (!kids.length) return row;
  const key = childKeyAt(tree, index);
  const next: ChildInclude = include === "direct" ? "none" : "subtree";
  row[key] = kids.map((c) => rowWithChildren(store, tree, c, next));
  return row;
}

function childKeyAt(tree: BoundTree, index: number): string {
  const keys = tree.childKey;
  if (Array.isArray(keys)) return keys[index] || "children";
  if (typeof keys === "string" && keys) return keys;
  return "children";
}

function contentUniques(store: ColumnStore, def: ColumnDef): ContentCache {
  let byField = contentCache.get(store);
  if (!byField) {
    byField = new Map();
    contentCache.set(store, byField);
  }
  const hit = byField.get(def.field);
  if (hit && hit.gen === store.generation) return hit;

  const keys = new Array<string>(store.rowCount);
  const counts = new Map<string, { label: string; icons: string[]; iconClass: string; count: number }>();
  for (let i = 0; i < store.rowCount; i++) {
    const icons = resolveIcons(store, def, i);
    const text = cellText(store, def, i);
    const urls = icons.map((ic) => ic.url).filter(Boolean);
    const className = icons.find((ic) => ic.className)?.className ?? "";
    const labels = icons.map((ic) => ic.label).filter(Boolean).join(" ");
    const key = cellContentKey(text, icons.map((ic) => ic.url || ic.className || ic.label));
    keys[i] = key;
    const bucket = counts.get(key);
    if (bucket) bucket.count++;
    else {
      counts.set(key, {
        label: text || labels || (urls.length || className ? "(icon)" : "(Blanks)"),
        icons: urls,
        iconClass: className,
        count: 1,
      });
    }
  }

  const uniques: UniqueValue[] = [];
  for (const [value, info] of counts) {
    uniques.push({
      value: value || null,
      label: value ? info.label : "(Blanks)",
      count: info.count,
      icons: info.icons.length ? info.icons : undefined,
      iconClass: info.iconClass || undefined,
    });
  }
  uniques.sort((a, b) => {
    if (a.value == null) return -1;
    if (b.value == null) return 1;
    const byLabel = a.label.localeCompare(b.label);
    if (byLabel) return byLabel;
    const ia = a.icons?.[0] ?? a.iconClass ?? "";
    const ib = b.icons?.[0] ?? b.iconClass ?? "";
    return ia.localeCompare(ib);
  });

  const next: ContentCache = { gen: store.generation, keys, uniques };
  byField.set(def.field, next);
  return next;
}

function iconVisible(
  icon: ColumnIcon,
  value: unknown,
  row: number,
  fields: ReadonlySet<string>,
  get: (key: string) => unknown,
  ensureRow: () => Record<string, unknown>,
): boolean {
  if (icon.eq !== undefined && !valueEquals(value, icon.eq)) return false;
  if (icon.in && !icon.in.some((v) => valueEquals(value, v))) return false;
  if (icon.visibleIf?.trim()) {
    try {
      const pred = compileExpression(icon.visibleIf, fields);
      if (!pred(get)) return false;
    } catch {
      return false;
    }
  }
  if (icon.visible && !icon.visible(ensureRow(), row, value)) return false;
  return true;
}

function resolveLabel(
  icon: ColumnIcon,
  value: unknown,
  row: number,
  get: (key: string) => unknown,
  ensureRow: () => Record<string, unknown>,
): string {
  const spec = icon.label;
  if (typeof spec === "function") {
    const resolved = spec.length >= 3 ? spec(value, row, ensureRow()) : spec(value, row, undefined as unknown as Record<string, unknown>);
    return resolved ?? "";
  }
  if (typeof spec === "string" && spec) return interpolatePlain(spec, get);
  return "";
}

function resolveUrl(
  icon: ColumnIcon,
  value: unknown,
  row: number,
  get: (key: string) => unknown,
  ensureRow: () => Record<string, unknown>,
): string {
  if (icon.urlField) {
    const raw = get(icon.urlField);
    return raw == null || raw === "" ? "" : String(raw);
  }
  const spec = icon.url;
  if (typeof spec === "function") {
    const resolved = spec.length >= 3 ? spec(value, row, ensureRow()) : spec(value, row, undefined as unknown as Record<string, unknown>);
    return resolved ?? "";
  }
  if (typeof spec === "string" && spec) return interpolatePlain(spec, get);
  return "";
}

function valueEquals(cell: unknown, expected: unknown): boolean {
  if (cell === expected) return true;
  if (cell == null || expected == null) return cell == expected;
  return String(cell) === String(expected);
}
