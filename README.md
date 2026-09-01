# MegaGrid

[Support on Ko-fi](https://ko-fi.com/fityp)

A high-performance JavaScript data grid. You send **column definitions** and **table data**. MegaGrid fills in the rest, packs columns into typed arrays, and paints the viewport to canvas.

**Live demo (no Node):** [https://fityp.github.io/MegaGrid/](https://fityp.github.io/MegaGrid/)

Turn on GitHub Pages once: repo **Settings → Pages → Source: GitHub Actions**. After that, every push to `main` publishes the playground as static HTML/JS.

## The only payload you need

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
- No definitions at all: object keys become columns, or arrays become **A**, **B**, **C**.
- Nested `children` become an expandable tree.

Full rules: **[Load data](docs/data.md)** · **[Column fields](docs/columns.md)**

## Local playground

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The GitHub demo is the same app, built to static files (the browser runs it; you do not install Node to view it).

## Repo

```
packages/core     Bind payload + column store + query engine
packages/grid     Canvas UI
apps/playground   Demo
docs/             Guides
```

MIT licensed.
