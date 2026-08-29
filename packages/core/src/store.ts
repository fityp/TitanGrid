import type { ColumnDef, DataType, Field } from "./types.ts";

export const BLANK_CODE = 0xffffffff;

export type Vector =
  | { kind: "number"; values: Float64Array; nulls: Uint8Array }
  | {
      kind: "string";
      codes: Uint32Array;
      dictionary: string[];
      dictionaryLower: string[];
      dictIndex: Map<string, number>;
    }
  | { kind: "boolean"; values: Uint8Array }
  | { kind: "date"; values: Float64Array; nulls: Uint8Array }
  | { kind: "sparkline"; values: Float64Array; points: number }
  | { kind: "mixed"; values: unknown[] };

export interface UniqueValue {
  value: string | number | boolean | null;
  label: string;
  count: number;
}

const EMPTY = "";

export class ColumnStore {
  readonly rowCount: number;
  readonly fields: readonly Field[];
  readonly types: ReadonlyMap<Field, DataType>;
  private readonly vectors: Map<Field, Vector>;
  private uniqueCache = new Map<Field, UniqueValue[]>();

  constructor(
    rowCount: number,
    fields: Field[],
    types: Map<Field, DataType>,
    vectors: Map<Field, Vector>,
  ) {
    this.rowCount = rowCount;
    this.fields = fields;
    this.types = types;
    this.vectors = vectors;
  }

  vector(field: Field): Vector | undefined {
    return this.vectors.get(field);
  }

  get(field: Field, row: number): unknown {
    const vec = this.vectors.get(field);
    if (!vec) return null;
    switch (vec.kind) {
      case "number":
      case "date":
        return vec.nulls[row] ? null : vec.values[row];
      case "string": {
        const code = vec.codes[row] ?? BLANK_CODE;
        return code === BLANK_CODE ? null : vec.dictionary[code];
      }
      case "boolean": {
        const v = vec.values[row] ?? 2;
        return v === 2 ? null : v === 1;
      }
      case "sparkline": {
        const n = vec.points;
        const start = row * n;
        return vec.values.subarray(start, start + n);
      }
      case "mixed":
        return vec.values[row] ?? null;
    }
  }

  getNumber(field: Field, row: number): number {
    const vec = this.vectors.get(field);
    if (!vec) return NaN;
    if (vec.kind === "number" || vec.kind === "date") {
      return vec.nulls[row] ? NaN : (vec.values[row] as number);
    }
    if (vec.kind === "boolean") {
      const v = vec.values[row] ?? 2;
      return v === 2 ? NaN : v;
    }
    const raw = this.get(field, row);
    const n = typeof raw === "number" ? raw : Number(raw);
    return n;
  }

  getString(field: Field, row: number): string {
    const vec = this.vectors.get(field);
    if (!vec) return EMPTY;
    if (vec.kind === "string") {
      const code = vec.codes[row] ?? BLANK_CODE;
      return code === BLANK_CODE ? EMPTY : (vec.dictionary[code] ?? EMPTY);
    }
    if (vec.kind === "number") {
      return vec.nulls[row] ? EMPTY : String(vec.values[row]);
    }
    if (vec.kind === "date") {
      if (vec.nulls[row]) return EMPTY;
      return formatDate(vec.values[row] as number);
    }
    if (vec.kind === "boolean") {
      const v = vec.values[row] ?? 2;
      return v === 2 ? EMPTY : v === 1 ? "true" : "false";
    }
    const raw = this.get(field, row);
    if (raw == null) return EMPTY;
    return String(raw);
  }

  isBlank(field: Field, row: number): boolean {
    const vec = this.vectors.get(field);
    if (!vec) return true;
    switch (vec.kind) {
      case "number":
      case "date":
        return !!vec.nulls[row];
      case "string":
        return (vec.codes[row] ?? BLANK_CODE) === BLANK_CODE;
      case "boolean":
        return (vec.values[row] ?? 2) === 2;
      default:
        return this.get(field, row) == null || this.get(field, row) === "";
    }
  }

  set(field: Field, row: number, value: unknown): void {
    const vec = this.vectors.get(field);
    if (!vec) return;
    this.uniqueCache.delete(field);
    switch (vec.kind) {
      case "number":
      case "date": {
        if (value == null || value === "") {
          vec.nulls[row] = 1;
          vec.values[row] = 0;
        } else {
          vec.nulls[row] = 0;
          vec.values[row] = vec.kind === "date" ? (parseDate(value) ?? 0) : Number(value);
        }
        break;
      }
      case "string":
        encodeStringAt(vec, row, value == null ? EMPTY : String(value));
        break;
      case "boolean":
        vec.values[row] = value == null ? 2 : value ? 1 : 0;
        break;
      case "mixed":
        vec.values[row] = value;
        break;
      case "sparkline":
        break;
    }
  }

  uniqueStrings(field: Field, limit = 10_000): string[] {
    return this.uniqueValues(field)
      .filter((u) => u.value != null)
      .slice(0, limit)
      .map((u) => String(u.value));
  }

  uniqueValues(field: Field): UniqueValue[] {
    const cached = this.uniqueCache.get(field);
    if (cached) return cached;
    const vec = this.vectors.get(field);
    const out: UniqueValue[] = [];
    if (!vec) return out;

    if (vec.kind === "string") {
      const counts = new Uint32Array(vec.dictionary.length);
      let blanks = 0;
      for (let i = 0; i < this.rowCount; i++) {
        const code = vec.codes[i] ?? BLANK_CODE;
        if (code === BLANK_CODE) blanks++;
        else counts[code]!++;
      }
      const items: UniqueValue[] = vec.dictionary.map((label, i) => ({
        value: label,
        label,
        count: counts[i] ?? 0,
      }));
      items.sort((a, b) => a.label.localeCompare(b.label));
      if (blanks) out.push({ value: null, label: "(Blanks)", count: blanks });
      out.push(...items);
    } else if (vec.kind === "number") {
      const map = new Map<number, number>();
      let blanks = 0;
      for (let i = 0; i < this.rowCount; i++) {
        if (vec.nulls[i]) blanks++;
        else map.set(vec.values[i] as number, (map.get(vec.values[i] as number) ?? 0) + 1);
      }
      if (blanks) out.push({ value: null, label: "(Blanks)", count: blanks });
      const nums = [...map.keys()].sort((a, b) => a - b);
      for (const n of nums) out.push({ value: n, label: String(n), count: map.get(n) ?? 0 });
    } else if (vec.kind === "date") {
      const map = new Map<number, number>();
      let blanks = 0;
      for (let i = 0; i < this.rowCount; i++) {
        if (vec.nulls[i]) blanks++;
        else map.set(vec.values[i] as number, (map.get(vec.values[i] as number) ?? 0) + 1);
      }
      if (blanks) out.push({ value: null, label: "(Blanks)", count: blanks });
      const times = [...map.keys()].sort((a, b) => a - b);
      for (const t of times) {
        const label = formatDate(t);
        out.push({ value: label, label, count: map.get(t) ?? 0 });
      }
    } else if (vec.kind === "boolean") {
      let t = 0, f = 0, blanks = 0;
      for (let i = 0; i < this.rowCount; i++) {
        const v = vec.values[i] ?? 2;
        if (v === 2) blanks++;
        else if (v === 1) t++;
        else f++;
      }
      if (blanks) out.push({ value: null, label: "(Blanks)", count: blanks });
      if (t) out.push({ value: true, label: "True", count: t });
      if (f) out.push({ value: false, label: "False", count: f });
    }

    this.uniqueCache.set(field, out);
    return out;
  }
}

function encodeStringAt(
  vec: Extract<Vector, { kind: "string" }>,
  row: number,
  value: string,
): void {
  if (!value) {
    vec.codes[row] = BLANK_CODE;
    return;
  }
  let idx = vec.dictIndex.get(value);
  if (idx === undefined) {
    idx = vec.dictionary.length;
    vec.dictionary.push(value);
    vec.dictionaryLower.push(value.toLowerCase());
    vec.dictIndex.set(value, idx);
  }
  vec.codes[row] = idx;
}

export function parseDate(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return startOfLocalDay(value);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  }
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])).getTime();
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])).getTime();
  const parsed = Date.parse(s);
  if (Number.isNaN(parsed)) return null;
  return startOfLocalDay(parsed);
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatDateIso(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function inferType(rows: Record<string, unknown>[], field: Field): DataType {
  let sawNumber = false;
  let sawBool = false;
  let sawSpark = false;
  let sawOther = false;
  const n = Math.min(rows.length, 200);
  for (let i = 0; i < n; i++) {
    const v = rows[i]?.[field];
    if (v == null || v === "") continue;
    if (Array.isArray(v) && v.every((x) => typeof x === "number")) {
      sawSpark = true;
      continue;
    }
    const t = typeof v;
    if (t === "number") sawNumber = true;
    else if (t === "boolean") sawBool = true;
    else sawOther = true;
  }
  if (sawSpark && !sawOther && !sawNumber && !sawBool) return "sparkline";
  if (sawNumber && !sawOther && !sawBool) return "number";
  if (sawBool && !sawOther && !sawNumber) return "boolean";
  return "string";
}

export function ingest(
  rows: Record<string, unknown>[],
  columnDefs: ColumnDef[],
): ColumnStore {
  const fields = columnDefs.map((c) => c.field);
  const n = rows.length;
  const types = new Map<Field, DataType>();
  const vectors = new Map<Field, Vector>();

  for (const def of columnDefs) {
    const type = def.type ?? inferType(rows, def.field);
    types.set(def.field, type);

    if (type === "number") {
      const values = new Float64Array(n);
      const nulls = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const v = rows[i]?.[def.field];
        if (v == null || v === "") nulls[i] = 1;
        else values[i] = typeof v === "number" ? v : Number(v);
      }
      vectors.set(def.field, { kind: "number", values, nulls });
    } else if (type === "date") {
      const values = new Float64Array(n);
      const nulls = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const parsed = parseDate(rows[i]?.[def.field]);
        if (parsed == null) nulls[i] = 1;
        else values[i] = parsed;
      }
      vectors.set(def.field, { kind: "date", values, nulls });
    } else if (type === "boolean") {
      const values = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        const v = rows[i]?.[def.field];
        values[i] = v == null ? 2 : v ? 1 : 0;
      }
      vectors.set(def.field, { kind: "boolean", values });
    } else if (type === "sparkline") {
      const points = sparklineWidth(rows, def.field);
      const values = new Float64Array(n * points);
      for (let i = 0; i < n; i++) {
        const v = rows[i]?.[def.field];
        if (Array.isArray(v)) {
          for (let p = 0; p < points; p++) values[i * points + p] = Number(v[p] ?? 0);
        }
      }
      vectors.set(def.field, { kind: "sparkline", values, points });
    } else {
      const codes = new Uint32Array(n);
      const dictionary: string[] = [];
      const dictionaryLower: string[] = [];
      const dictIndex = new Map<string, number>();
      const vec: Extract<Vector, { kind: "string" }> = {
        kind: "string",
        codes,
        dictionary,
        dictionaryLower,
        dictIndex,
      };
      for (let i = 0; i < n; i++) {
        const v = rows[i]?.[def.field];
        encodeStringAt(vec, i, v == null ? EMPTY : String(v));
      }
      vectors.set(def.field, vec);
    }
  }

  return new ColumnStore(n, fields, types, vectors);
}

function sparklineWidth(rows: Record<string, unknown>[], field: Field): number {
  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const v = rows[i]?.[field];
    if (Array.isArray(v) && v.length) return v.length;
  }
  return 12;
}
