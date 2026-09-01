# Easy payload

Your service returns two fields. MegaGrid binds them with defaults — no mapping layer required.

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
MegaGrid.create(document.getElementById("host")!, payload);
api.setPayload(payload);
```

`city` is extra data, so it becomes column **C** (Excel letter for index 2).

## Defaults

| Situation | What happens |
| --- | --- |
| No `column_definitions` + object rows | Keys become columns. `athlete` → heading **Athlete**. Sorting and filtering on. |
| No `column_definitions` + arrays | Columns **A**, **B**, **C**, … |
| More headings than data | Extra headings show, cells blank. |
| More data than headings | Extra columns named **A**, **B**, **C** by index. |
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
| `agg` | `sum` `avg` `min` `max` `count` when grouped | — |

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

The live demo is a static page: [https://fityp.github.io/MegaGrid/](https://fityp.github.io/MegaGrid/). Open it in a browser — no Node required to use it. GitHub Actions builds the playground to HTML/JS/CSS and publishes it.

See [Define columns](columns.md) for the full engine `ColumnDef` if you need `format` functions.

## Row detail

Set `rowDetail: true` to open a modal with every field when a row is clicked. Expand/collapse still uses the first column on nested group rows. You can also listen with `onRowClicked` and read `api.getRow(sourceIndex)`.
