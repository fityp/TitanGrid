# MegaGrid

[Support on Ko-fi](https://ko-fi.com/fityp)

A high-performance JavaScript data grid. You send **column definitions** and **table data**. MegaGrid fills in the rest, packs columns into typed arrays, and paints the viewport to canvas.

**[Live demo](https://fityp.github.io/MegaGrid/)**

## Usage

```ts
MegaGrid.create(document.getElementById("host")!, {
  column_definitions: [
    { heading: "Name", field: "name", enable_sorting: true, filter_type: "text" },
    { heading: "Score", field: "score", type: "number", filter_type: "number" },
  ],
  table_data: [
    { name: "Ada", score: 91 },
    { name: "Tom", score: 74, city: "Paris" },
  ],
});
```

- Extra data (`city`) becomes column **C**.
- Extra headings with no data still show, with blank cells.
- No definitions: object keys become columns, or arrays become **A**, **B**, **C**.
- Nested `children` become an expandable tree.

**[Load data](docs/data.md)** · **[Column fields](docs/columns.md)**

## Run locally

```bash
npm install
npm test
npm run dev
```

MIT
