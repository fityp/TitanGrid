# TitanGrid

[Support on Ko-fi](https://ko-fi.com/fityp)

A high-performance JavaScript data grid. You send **column definitions** and **table data**. TitanGrid fills in the rest, packs columns into typed arrays, and paints the viewport to canvas.

**[Live demo](https://fityp.github.io/TitanGrid/)**

## Use it in your project

```bash
npm install titangrid
```

```ts
import { TitanGrid } from "titangrid";
import "titangrid/styles.css";

TitanGrid.create(document.getElementById("host")!, {
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

### HTML, no bundler

```html
<div id="host" style="height: 80vh"></div>
<script type="module">
  import { TitanGrid } from "https://cdn.jsdelivr.net/npm/titangrid@0.1.0/dist/titangrid.js";

  TitanGrid.create(document.getElementById("host"), {
    column_definitions: [/* … */],
    table_data: [/* … */],
  });
</script>
```

## Usage

- Extra data (`city`) becomes column **C**.
- Extra headings with no data still show, with blank cells.
- No definitions: object keys become columns, or arrays become **A**, **B**, **C**.
- Nested `children` become an expandable tree.

**[Load data](docs/data.md)** · **[Column fields](docs/columns.md)**

## Run this repo

```bash
npm install
npm test
npm run dev
```

MIT
