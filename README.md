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

Give the host element a height.

### HTML, no bundler

Pin a version. Styles are inside this file.

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

Needs `http`/`https`, not a `file://` open. A copy-paste page is in [`examples/embed.html`](examples/embed.html). The demo site also hosts the same file at [https://fityp.github.io/TitanGrid/titangrid.js](https://fityp.github.io/TitanGrid/titangrid.js) (always latest `main`, not a version).

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

`npm run build` emits the library into `packages/grid/dist` (`index.js`, types, `styles.css`, and the browser file `titangrid.js`).

## Publish to npm

One-time:

1. Create an [npm](https://www.npmjs.com) account and enable 2FA.
2. From a clean tree: `npm login`, then `npm run build -w titangrid` and `npm publish -w titangrid`.
3. On [the package settings](https://www.npmjs.com/package/titangrid) → **Trusted Publisher**: GitHub, `fityp` / `TitanGrid`, workflow `publish.yml`.

Each release after that:

1. Bump `version` in `packages/grid/package.json`.
2. Commit, tag, push:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The **Publish npm** workflow builds and publishes `titangrid`. jsDelivr picks up the version within a few minutes.

MIT
