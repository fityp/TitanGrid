import { describe, expect, it } from "vitest";
import { bindPayload } from "../src/bind.ts";
import {
  contentKeyAt,
  parseContentKey,
  resolveIcons,
  rowWithChildren,
  uniqueCellValues,
} from "../src/icons.ts";
import { applyFilters } from "../src/query/filter.ts";
import { applyGroup } from "../src/query/group.ts";
import { ingest } from "../src/store.ts";
import type { ColumnDef } from "../src/types.ts";

const maple = "data:image/svg+xml,maple";
const alt = "data:image/svg+xml,alt";
const star = "data:image/svg+xml,star";

const columns: ColumnDef[] = [
  {
    field: "country",
    type: "string",
    filter: "set",
    icons: [
      {
        url: (value, i) => (value === "Canada" && i === 3 ? alt : value === "Canada" || value === "Brazil" ? maple : star),
      },
    ],
  },
  { field: "gold", type: "number", agg: "sum" },
];

function rows() {
  return [
    { country: "Brazil", gold: 1 },
    { country: "Brazil", gold: 2 },
    { country: "Canada", gold: 3 },
    { country: "Canada", gold: 4 },
  ];
}

describe("cell icons", () => {
  it("treats different icons as different cell content", () => {
    const store = ingest(rows(), columns);
    const def = columns[0]!;
    expect(resolveIcons(store, def, 0)[0]?.url).toBe(maple);
    expect(resolveIcons(store, def, 2)[0]?.url).toBe(maple);
    expect(resolveIcons(store, def, 3)[0]?.url).toBe(alt);
    const uniques = uniqueCellValues(store, def);
    const canada = uniques.filter((u) => u.label === "Canada");
    expect(canada).toHaveLength(2);
    expect(canada.map((u) => u.count).sort()).toEqual([1, 1]);
    const brazil = uniques.find((u) => u.label === "Brazil");
    expect(brazil?.count).toBe(2);
    expect(brazil?.icons).toEqual([maple]);
  });

  it("set-filters by content key, not the raw label", () => {
    const store = ingest(rows(), columns);
    const def = columns[0]!;
    const altKey = contentKeyAt(store, def, 3);
    const ids = [...applyFilters(store, [], "", null, undefined, {
      country: { filterType: "set", values: [altKey] },
    }, columns)];
    expect(ids).toEqual([3]);
  });

  it("still matches all labels when the filter uses the raw value", () => {
    const store = ingest(rows(), columns);
    const ids = [...applyFilters(store, [], "", null, undefined, {
      country: { filterType: "set", values: ["Canada"] },
    }, columns)];
    expect(ids).toEqual([2, 3]);
  });

  it("groups by cell content so two Canada icons become two groups", () => {
    const store = ingest(rows(), columns);
    const grouped = applyGroup(store, new Uint32Array([0, 1, 2, 3]), ["country"], columns, new Set());
    const groups = grouped.rows.filter((r) => r.kind === "group");
    expect(groups).toHaveLength(3);
    const canadas = groups.filter((g) => g.kind === "group" && g.key === "Canada");
    expect(canadas).toHaveLength(2);
    expect(canadas.map((g) => g.kind === "group" ? g.count : 0).sort()).toEqual([1, 1]);
  });

  it("binds icons from an easy payload and reconstructs nested children", () => {
    const bound = bindPayload({
      column_definitions: [
        {
          heading: "Name",
          field: "name",
          icons: [{ url: star, eq: "Americas" }],
        },
      ],
      table_data: [
        {
          name: "Americas",
          children: [{ name: "USA" }, { name: "Canada" }],
        },
      ],
    });
    expect(bound.columns[0]!.icons?.[0]?.url).toBe(star);
    expect(bound.columns[0]!.filter).toBe("set");
    const store = ingest(bound.rows, bound.columns);
    const nested = rowWithChildren(store, bound.tree, 0, "subtree");
    expect(nested).toMatchObject({
      name: "Americas",
      children: [{ name: "USA" }, { name: "Canada" }],
    });
    expect(parseContentKey(contentKeyAt(store, bound.columns[0]!, 0)).urls).toEqual([star]);
    expect(parseContentKey(contentKeyAt(store, bound.columns[0]!, 1)).urls).toEqual([]);
  });

  it("resolves label-only action chips without an image url", () => {
    const def: ColumnDef = {
      field: "actions",
      icons: [
        { label: "Edit", action: { type: "callback" } },
        { label: "Unlock", visibleIf: "locked == true", action: { run: () => undefined } },
        { label: "Lock", visibleIf: "locked == false", action: { run: () => undefined } },
      ],
    };
    const store = ingest(
      [
        { actions: null, locked: true },
        { actions: null, locked: false },
      ],
      [def, { field: "locked", type: "boolean" }],
    );
    const locked = resolveIcons(store, def, 0);
    expect(locked.map((ic) => ic.label)).toEqual(["Edit", "Unlock"]);
    const open = resolveIcons(store, def, 1);
    expect(open.map((ic) => ic.label)).toEqual(["Edit", "Lock"]);
  });
});
