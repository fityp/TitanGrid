# Define columns

Columns are declared once, as an array of `ColumnDef` objects, and passed to `MegaGrid.create`. That array is the schema: it decides which keys are ingested from each row, how they are stored, how they look, and which filter UI they get.

```ts
import { MegaGrid, type ColumnDef } from "@megagrid/grid";

const columns: ColumnDef[] = [
  { field: "id", header: "ID", width: 72, pinned: "left", editable: false, filterable: false },
  { field: "name", header: "Name", width: 180, filter: "text" },
  { field: "country", header: "Country", width: 160, filter: "set" },
  { field: "score", header: "Score", type: "number", width: 88, agg: "sum", filter: "number", align: "right" },
  { field: "when", header: "Date", type: "date", width: 120, filter: "date" },
];

MegaGrid.create(host, {
  columns,
  data: rows,
  defaultColDef: {
    sortable: true,
    filterable: true,
    resizable: true,
    editable: true,
  },
});
```

`defaultColDef` is merged under every column. Per-column properties win.

---

## The only required property: `field`

| Property | Type | Required | Meaning |
| --- | --- | --- | --- |
| `field` | `string` | **yes** | Top-level key on each row object. This is both the data key and the column id. |

```ts
{ field: "country" }  // reads row.country
```

There is no `valueGetter`, no `"user.address.city"` path, and no index-based columns. If your API uses different names, **map the rows** so the keys match `field`. See [Load and map data](data.md).

---

## Full `ColumnDef` reference

| Property | Type | Default | What it does |
| --- | --- | --- | --- |
| `field` | `string` | — | Row object key (required). |
| `header` | `string` | `field` | Header label. |
| `type` | `"string"` \| `"number"` \| `"boolean"` \| `"date"` \| `"sparkline"` | inferred from the first 200 non-empty values | Storage format. **Set this explicitly for dates.** Date strings look like strings; inference will store them as text unless `type: "date"`. |
| `width` | `number` | `128` (`120` for sparklines) | Initial pixel width. |
| `minWidth` | `number` | — | Reserved for layout (not enforced in the current resizer). |
| `maxWidth` | `number` | — | Reserved for layout. |
| `pinned` | `"left"` \| `"right"` \| `false` | unpinned | Frozen column. |
| `sortable` | `boolean` | `true` if `defaultColDef` says so | Click header to sort. Shift-click for multi-sort. |
| `filterable` | `boolean` | from `defaultColDef` | `false` hides the funnel and floating filter. |
| `filter` | `false` \| `"text"` \| `"number"` \| `"date"` \| `"set"` \| `"multi"` | by `type` (see below) | Which filter UI and operators this column uses. |
| `resizable` | `boolean` | from `defaultColDef` | Drag the header edge. |
| `editable` | `boolean` | from `defaultColDef` | Double-click a cell to edit. Writes back into the column store. |
| `groupable` | `boolean` | `true` unless set | `false` disables drag-to-group on that header. |
| `hide` | `boolean` | `false` | Omit the column from the layout. |
| `agg` | `"sum"` \| `"avg"` \| `"min"` \| `"max"` \| `"count"` \| `"first"` \| `"last"` | — | Value shown on group rows when grouping. |
| `align` | `"left"` \| `"center"` \| `"right"` | `"left"` | Cell text alignment. |
| `format` | `(value, sourceIndex) => string` | built-in | Display only. Does **not** change stored values or filters. |

---

## `type` — how the value is stored

Set `type` on the column. Do not rely on inference except for obvious numbers, booleans, and string labels.

| `type` | Expected row value | Stored as | Notes |
| --- | --- | --- | --- |
| `"string"` | `string` \| `null` | Dictionary-encoded codes | Fast set/text filters. Empty string is blank. |
| `"number"` | `number` \| numeric string \| `null` | `Float64Array` + null bitmap | `""` and `null` are blank. |
| `"boolean"` | `true` \| `false` \| `null` | `0` / `1` / blank | Display however you want via `format`. |
| `"date"` | `Date`, ISO `YYYY-MM-DD`, or `DD/MM/YYYY` | Local midnight timestamp | **You must set `type: "date"`.** |
| `"sparkline"` | `number[]` | Packed `Float64Array` | Not filterable or editable by default. |

Inference (only if `type` is omitted), from up to 200 rows:

- all sampled values are `number` → `"number"`
- all sampled values are `boolean` → `"boolean"`
- all sampled values are `number[]` → `"sparkline"`
- otherwise → `"string"` (this includes date strings)

---

## `filter` — which filter the column gets

If you omit `filter` and `filterable` is not `false`:

| Column `type` | Default `filter` |
| --- | --- |
| `"number"` | `"number"` |
| `"date"` | `"date"` |
| `"boolean"` | `"set"` (True / False) |
| `"sparkline"` | none |
| `"string"` (and anything else) | `"multi"` (text **and** set) |

Set `filter` yourself when you want a specific UI:

```ts
{ field: "athlete", filter: "text" }     // contains / equals / starts with / …
{ field: "country", filter: "set" }      // Excel-style multi-select list
{ field: "sport",   filter: "multi" }    // text tab + set tab
{ field: "gold",    type: "number", filter: "number" }
{ field: "date",    type: "date", filter: "date" }
{ field: "id",      filterable: false }  // no filter at all
```

| `filter` | Floating row | Header funnel |
| --- | --- | --- |
| `"text"` | Contains… | Operator + value, AND/OR two conditions |
| `"number"` | `> 2` or `1...5` for inclusive range | Comparisons, in range, blank |
| `"date"` | Native date input | Comparisons, in range |
| `"set"` | Dropdown (`All`, names, or `N selected`) | Search, Select All, checkboxes, counts |
| `"multi"` | Text contains (first part of multi) | Filter tab + Set tab |
| `false` / `filterable: false` | Empty | No funnel |

---

## Display vs stored value

`format` only changes what is painted. Filters and expressions still use the stored value.

```ts
{
  field: "active",
  type: "boolean",
  filter: "set",
  format: (value) => (value == null ? "" : value ? "Yes" : "No"),
}
```

The set filter still uses `true` / `false`, not `"Yes"` / `"No"`.

```ts
{
  field: "gold",
  type: "number",
  align: "right",
  format: (value) => (value == null ? "" : Number(value).toFixed(0)),
}
```

---

## Pinning, grouping, aggregations

```ts
{ field: "athlete", pinned: "left", groupable: false }
{ field: "country" }                         // drag header to the group bar
{ field: "gold", type: "number", agg: "sum" }
{ field: "age", type: "number", agg: "avg" }
```

Grouping is also available on the API:

```ts
api.setGroupBy(["country", "sport"]);
api.expandAll();
api.collapseAll();
```

Only columns with `agg` show an aggregate on the group row.

---

## Grid-level options that affect columns

Passed next to `columns` on `MegaGrid.create`:

| Option | Default | Meaning |
| --- | --- | --- |
| `defaultColDef` | `{}` | Defaults merged under every column. |
| `floatingFilters` | `true` | Set `false` to hide the filter row. |
| `rowNumbers` | `true` | Inserts a `#` column on the left. Not in your data. |
| `rowHeight` | `28` | Pixel height of body rows. |
| `headerHeight` | `34` | Pixel height of the header. |
| `theme` | `"dark"` | `"dark"` \| `"light"` |
| `groupBy` | `[]` | Initial grouped fields. |
| `query` | — | Initial expression (`gold > 2 && contains(country, "China")`). |

---

## After create: filters and sort from code

```ts
api.setSort([{ field: "gold", dir: "desc" }]);

api.setFilterModel({
  country: { filterType: "set", values: ["China", "Jamaica"] },
  gold: { filterType: "number", type: "greaterThan", filter: 2 },
});

api.setExpression('gold > 2 && contains(country, "United States")');
api.setQuickFilter("swim"); // contains across all string-like columns
```

Expression language: identifiers (column `field`s), numbers, strings, `true` / `false` / `null`, `== != > < >= <= && || !`, `+ - * /`, parentheses, `contains(field, "x")`, `startsWith(field, "x")`, `empty(field)`.

---

## Checklist

1. One `ColumnDef` per column you want to show (or hide).
2. `field` equals the key you will put on each mapped row.
3. Set `type: "date"` for dates. Set `type: "number"` for numeric filters and aggregations.
4. Set `filter` when the default is not what you want (`"set"` for a multi-select list, `"text"` for contains-only).
5. Map incoming records so those keys exist — [Load and map data](data.md).
