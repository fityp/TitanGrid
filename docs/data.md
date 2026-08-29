# Load and map data

MegaGrid does not fetch, parse CSV, or walk nested JSON. You give it an array of **plain objects**. Each object is one row. Each `ColumnDef.field` is a **top-level key** on that object.

```
Your API / file  →  map to Row[]  →  MegaGrid.create({ columns, data }) or api.setData(rows)
```

If a key is missing, `null`, or `""`, that cell is blank. Extra keys that are not in `columns` are ignored.

---

## 1. The row shape

```ts
type Row = Record<string, unknown>;
```

Concrete example that matches three columns `{ field: "athlete" }`, `{ field: "gold" }`, `{ field: "country" }`:

```ts
const rows: Row[] = [
  { athlete: "Alex Nguyen", gold: 3, country: "China" },
  { athlete: "Sam Patel", gold: 1, country: "Jamaica" },
];
```

| Column `field` | Reads | Allowed values |
| --- | --- | --- |
| string column | `row[field]` | `string`, `null`, `undefined`, `""` |
| `type: "number"` | `row[field]` | `number`, numeric string, `null`, `""` |
| `type: "boolean"` | `row[field]` | `true`, `false`, `null` |
| `type: "date"` | `row[field]` | `Date`, `"2012-08-05"`, `"05/08/2012"` (`DD/MM/YYYY`) |
| `type: "sparkline"` | `row[field]` | `number[]` (same length per row) |

**Dates:** ISO `YYYY-MM-DD` and `DD/MM/YYYY` are parsed as local calendar dates. A `Date` object uses its local year/month/day. Always set `type: "date"` on the column or the value stays a string.

**Booleans:** stored as true / false / blank. Use `format` if you want `Yes` / `No` on screen.

---

## 2. Load at create time

```ts
import { MegaGrid, type ColumnDef } from "@megagrid/grid";

const columns: ColumnDef[] = [
  { field: "name", header: "Name", filter: "text" },
  { field: "score", header: "Score", type: "number", filter: "number" },
];

const rows = [
  { name: "Ada", score: 91 },
  { name: "Tom", score: 74 },
];

const grid = MegaGrid.create(document.getElementById("host")!, {
  columns,
  data: rows,
});
```

`data` is optional. You can create an empty grid and load later.

---

## 3. Load or replace later: `api.setData`

`setData` **replaces the entire dataset**. It re-ingests every row into columnar storage. Column definitions stay as they were at create time.

```ts
api.setData(nextRows);
```

Typical pattern:

```ts
const res = await fetch("/api/athletes");
const payload: unknown = await res.json();
api.setData(mapAthletes(payload));
```

Do not mutate objects already passed to `setData` and expect the grid to notice. Map a new array (or clone) and call `setData` again.

---

## 4. Mapping: rename keys so they match `field`

Your API will often not use the same names as your columns. **Map first.** The grid never sees the original keys.

```ts
type ApiAthlete = {
  full_name: string;
  nation: string;
  medals_gold: number;
  event_date: string;
};

type GridRow = {
  athlete: string;
  country: string;
  gold: number;
  date: string;
};

const columns: ColumnDef[] = [
  { field: "athlete", header: "Athlete", filter: "text" },
  { field: "country", header: "Country", filter: "set" },
  { field: "gold", header: "Gold", type: "number", agg: "sum", filter: "number" },
  { field: "date", header: "Date", type: "date", filter: "date" },
];

function mapAthletes(payload: ApiAthlete[]): GridRow[] {
  return payload.map((row) => ({
    athlete: row.full_name,
    country: row.nation,
    gold: row.medals_gold,
    date: row.event_date,
  }));
}

api.setData(mapAthletes(await res.json()));
```

Every `field` in `columns` must appear as a key in the object you return from the mapper.

---

## 5. Mapping: nested JSON

MegaGrid does **not** support `field: "user.profile.country"`. Flatten in the mapper.

```ts
type ApiRow = {
  id: string;
  user: { first: string; last: string; profile: { country: string } };
  stats: { gold: number };
};

function mapNested(payload: ApiRow[]) {
  return payload.map((row) => ({
    id: row.id,
    athlete: `${row.user.first} ${row.user.last}`,
    country: row.user.profile.country,
    gold: row.stats.gold,
  }));
}
```

Columns then use `field: "athlete"`, `field: "country"`, `field: "gold"` — not nested paths.

---

## 6. Mapping: arrays of arrays or CSV-like rows

If you have positional data, zip against a header list (or column `field`s) yourself.

```ts
const fields = ["athlete", "country", "gold"] as const;
const table: unknown[][] = [
  ["Alex Nguyen", "China", 3],
  ["Sam Patel", "Jamaica", 1],
];

const rows = table.map((cells) => {
  const row: Record<string, unknown> = {};
  fields.forEach((field, i) => {
    row[field] = cells[i];
  });
  return row;
});

api.setData(rows);
```

There is no built-in CSV parser. Parse with your own code or a CSV library, then produce objects whose keys match `field`.

---

## 7. Mapping: type coercions

Do this in the mapper when the wire format is not what the column `type` expects.

```ts
function mapRow(raw: Record<string, unknown>) {
  return {
    athlete: String(raw.name ?? ""),
    gold: raw.gold == null || raw.gold === "" ? null : Number(raw.gold),
    active: raw.status === "active",
    date: String(raw.date ?? ""), // column must be type: "date"
    trend: Array.isArray(raw.spark) ? raw.spark.map(Number) : [],
  };
}
```

| Wire value | Column `type` | What to put on the row |
| --- | --- | --- |
| `"3"` | `"number"` | `Number("3")` or leave as `"3"` (ingest calls `Number`) |
| `""` | `"number"` | `null` or `""` → blank |
| `"true"` | `"boolean"` | `value === true` or `value === "true"` — ingest treats any truthy JS value as true if it is not `null` |
| unix ms | `"date"` | `new Date(ms)` or an ISO date string |
| `1` / `0` flags | `"boolean"` | `Boolean(value)` or `value === 1` |

---

## 8. What ingest does (so mapping stays honest)

For each column, MegaGrid walks **every row** and copies `row[column.field]` into a typed column:

- **string** — interned into a dictionary; identical labels share one code (this is why set filters are fast).
- **number** — `Float64Array`; `null` / `""` set a null flag.
- **boolean** — `null` → blank, otherwise `value ? true : false`.
- **date** — parsed; failure → blank.
- **sparkline** — copies numbers into a packed buffer.

Then filter/sort/group never walk the original objects again. That is why `setData` is the right way to load a new file: it rebuilds those columns.

---

## 9. End-to-end example

```ts
import { MegaGrid, type ColumnDef, type GridApi } from "@megagrid/grid";

interface ApiRecord {
  displayName: string;
  loc: { country: string };
  medals: { gold: number; silver: number };
  lastEvent: string; // "2012-08-05"
  enrolled: boolean;
}

interface GridRow {
  athlete: string;
  country: string;
  gold: number;
  silver: number;
  date: string;
  active: boolean;
}

const columns: ColumnDef[] = [
  { field: "athlete", header: "Athlete", width: 180, pinned: "left", filter: "text" },
  { field: "country", header: "Country", width: 160, filter: "set" },
  { field: "gold", header: "Gold", type: "number", width: 80, agg: "sum", filter: "number" },
  { field: "silver", header: "Silver", type: "number", width: 80, agg: "sum", filter: "number" },
  { field: "date", header: "Date", type: "date", width: 120, filter: "date" },
  {
    field: "active",
    header: "Active",
    type: "boolean",
    width: 92,
    filter: "set",
    format: (v) => (v == null ? "" : v ? "Yes" : "No"),
  },
];

function mapRecords(records: ApiRecord[]): GridRow[] {
  return records.map((r) => ({
    athlete: r.displayName,
    country: r.loc.country,
    gold: r.medals.gold,
    silver: r.medals.silver,
    date: r.lastEvent,
    active: r.enrolled,
  }));
}

let api: GridApi | undefined;

MegaGrid.create(document.getElementById("grid")!, {
  columns,
  data: [],
  floatingFilters: true,
  defaultColDef: { sortable: true, filterable: true, resizable: true },
  onReady: (next) => {
    api = next;
  },
});

async function reload() {
  const res = await fetch("/api/records");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as ApiRecord[];
  api?.setData(mapRecords(json));
}

void reload();
```

---

## 10. Failure modes

| Symptom | Cause |
| --- | --- |
| Column is empty | `field` does not match any key on the mapped row (typo, or you forgot to map). |
| Dates sort/filter as text | Missing `type: "date"` on the column. |
| Set filter shows `"true"` / weird labels | Value was a string; use a real boolean or map it. |
| Numbers show `NaN` | Non-numeric string in a `type: "number"` column. Coerce or blank in the mapper. |
| Grid does not update after fetch | You mutated old objects. Call `setData` with a new array. |
| Nested field never appears | Used `"a.b"` as `field`. Flatten in the mapper instead. |

---

## 11. Related

- [Define columns](columns.md) — `field`, `type`, `filter`, `format`, `agg`
- `api.getSourceRowCount()` — rows after last `setData`
- `api.getDisplayedRowCount()` — rows after filter / group
- `api.exportCsv()` — current view as CSV text
