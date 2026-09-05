# Easy payload

Your service returns two fields. TitanGrid binds them with defaults — no mapping layer required.

```json
{
  "column_definitions": [
    { "heading": "Name", "field": "name", "enable_sorting": true, "enable_filtering": true, "filter_type": "text" },
    { "heading": "Score", "field": "score", "type": "number", "filter_type": "number" }
  ],
  "table_data": [
    { "name": "Ada", "score": 91 },
    { "name": "Tom", "score": 74, "city": "Paris" }
  ]
}
```

```ts
TitanGrid.create(document.getElementById("host")!, payload);
api.setPayload(payload);
```

`city` is extra data, so it becomes column **C** (Excel letter for index 2). Pass `strictColumns: true` on `TitanGrid.create` (or the second argument of `bindPayload`) to keep only the defined columns.

## Defaults

| Situation | What happens |
| --- | --- |
| No `column_definitions` + object rows | Keys become columns. `athlete` → heading **Athlete**. Sorting and filtering on. |
| No `column_definitions` + arrays | Columns **A**, **B**, **C**, … |
| More headings than data | Extra headings show, cells blank. |
| More data than headings | Extra columns named **A**, **B**, **C** by index. `strictColumns: true` skips this. |
| Nested `children` / `items` / `rows` | Flattened to a tree. Click the first column to expand. |
| Missing `field` on a heading | Bound by position, or the heading text is used as the field. |

This is one pass over the rows, then the same typed-array ingest as before. 250k rows stay in the millisecond range.

## Column definition fields

Use these names (camelCase aliases work too):

| Field | Meaning | Default |
| --- | --- | --- |
| `heading` | Header text (`header`, `title`, `name` also work) | prettified `field` |
| `field` | Key on each row (`key`, `id` also work) | matched by index, or a letter |
| `type` | `string` `number` `boolean` `date` `sparkline` | inferred |
| `enable_sorting` | Click header to sort | `true` |
| `enable_filtering` | Funnel + floating filter | `true` |
| `filter_type` | `text` `number` `date` `set` `multi` | from `type` |
| `enable_editing` | Double-click to edit | `true` |
| `enable_resizing` | Drag column edge | `true` |
| `enable_grouping` | Drag header to group bar | `true` |
| `width` | Pixels | `128` |
| `pinned` | `"left"` or `"right"` | — |
| `visible` | Show in the grid (`false` hides the column) | `true` |
| `visibility` | `all` `grid` `detail` `none` — grid and/or row modal | `all` |
| `detail_visible` | Show in the row-detail modal | `true` |
| `detail_template` | HTML for this field in the modal. `{{value}}`, `{{heading}}`, and other field names work. Values are escaped. | plain text |
| `icons` | Array of cell icons (`url`, `url_field`, `label`, `eq`, `in`, `visible_if`, `placement`, `action`). Distinct icons are distinct filter/group values. | — |
| `cell_style` / `cellStyle` | `{ color, background, pill }` or a function of `(value, sourceIndex)`. Canvas-only; not JSON. | — |
| `agg` | `sum` `avg` `min` `max` `count` when grouped | — |

Optional `row_definition` (alongside the two payload fields) lays out the whole modal:

```json
{
  "column_definitions": [
    { "heading": "Name", "field": "name", "detail_template": "<strong>{{value}}</strong>" },
    { "heading": "Bio", "field": "bio", "visibility": "detail", "detail_template": "<p>{{value}}</p>" }
  ],
  "row_definition": { "title_template": "{{name}}" },
  "table_data": [{ "name": "Ada", "bio": "Wrote the first algorithm." }]
}
```

`row_definition.template` replaces the field list with one HTML block. Tokens are the row's fields. Click a row to open the modal (`rowDetail: true`).

## Nested rows

```json
{
  "column_definitions": [{ "heading": "Name", "field": "name" }],
  "table_data": [
    {
      "name": "Americas",
      "children": [
        { "name": "United States" },
        { "name": "Canada" }
      ]
    }
  ]
}
```

Also recognizes `items` or `rows` as the child array (array of objects, not a sparkline of numbers).

## GitHub demo

The live demo is a static page: [https://fityp.github.io/TitanGrid/](https://fityp.github.io/TitanGrid/). Open it in a browser — no Node required to use it. GitHub Actions builds the playground to HTML/JS/CSS and publishes it.

To put TitanGrid on your own page, install `titangrid` or import a versioned jsDelivr URL. See the [README](../README.md#use-it-in-your-project).

See [Define columns](columns.md) for the full engine `ColumnDef` if you need `format` functions.

## Row detail

Set `rowDetail: true` to open a modal with every field when a row is clicked. Expand/collapse still uses the first column on nested group rows. You can also listen with `onRowClicked` and read `api.getRow(sourceIndex)`.
