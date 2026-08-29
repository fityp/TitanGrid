# MegaGrid

A high-performance JavaScript data grid. Rows are ingested into a **columnar typed-array store**. Filter, sort, and group run on index arrays. The viewport is **painted to canvas** so scrolling does not create a DOM node per cell.

| Package | Role |
| --- | --- |
| `@megagrid/core` | Column store + query engine (no DOM) |
| `@megagrid/grid` | Canvas grid, headers, filters, editors, selection |
| `@megagrid/playground` | 250k-row demo at [http://localhost:5173](http://localhost:5173) |

## Documentation

- **[Define columns](docs/columns.md)** — every `ColumnDef` property, types, filters, pinning, formatting
- **[Load and map data](docs/data.md)** — row shape, `setData`, renaming keys, nested JSON, dates, nulls

## Quick start

```bash
npm install
npm test
npm run dev
```

Playground: [http://localhost:5173](http://localhost:5173)

```ts
import { MegaGrid, type ColumnDef } from "@megagrid/grid";

const columns: ColumnDef[] = [
  { field: "athlete", header: "Athlete", width: 170, pinned: "left", filter: "text" },
  { field: "country", header: "Country", width: 176, filter: "set" },
  { field: "gold", header: "Gold", type: "number", width: 80, agg: "sum", filter: "number" },
];

const rows = [
  { athlete: "Alex Nguyen", country: "China", gold: 3 },
  { athlete: "Sam Patel", country: "Jamaica", gold: 1 },
];

const grid = MegaGrid.create(document.getElementById("host")!, {
  columns,
  data: rows,
  floatingFilters: true,
  defaultColDef: { sortable: true, filterable: true, resizable: true },
  onReady: (api) => {
    // Replace the dataset later without recreating the grid:
    // api.setData(nextRows);
  },
});
```

**The contract:** each `ColumnDef.field` is a **top-level key** on every row object. MegaGrid does not read nested paths like `"user.name"`. Flatten or rename first — see [Load and map data](docs/data.md).

## Repo layout

```
packages/core     Column store + query engine
packages/grid     Canvas UI
apps/playground   Demo app
docs/             Column and data guides
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite playground |
| `npm test` | Engine tests |
| `npm run build` | Build core, grid, playground |

Requires Node 20+.

## License

MIT
