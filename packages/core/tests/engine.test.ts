import { describe, expect, it } from "vitest";
import { bindPayload } from "../src/bind.ts";
import { compileExpression } from "../src/query/expression.ts";
import { QueryEngine } from "../src/query/engine.ts";
import { ingest } from "../src/store.ts";
import type { ColumnDef } from "../src/types.ts";
import { defaultQuerySpec } from "../src/types.ts";

const columns: ColumnDef[] = [
  { field: "country", type: "string" },
  { field: "sport", type: "string" },
  { field: "athlete", type: "string" },
  { field: "gold", type: "number", agg: "sum" },
  { field: "age", type: "number", agg: "avg" },
];

function rows() {
  return [
    { country: "USA", sport: "Swim", athlete: "A", gold: 3, age: 22 },
    { country: "USA", sport: "Swim", athlete: "B", gold: 1, age: 28 },
    { country: "USA", sport: "Track", athlete: "C", gold: 0, age: 31 },
    { country: "UK", sport: "Swim", athlete: "D", gold: 2, age: 24 },
    { country: "UK", sport: "Track", athlete: "E", gold: 4, age: 19 },
  ];
}

describe("ColumnStore ingest", () => {
  it("packs numbers into typed arrays and strings into columns", () => {
    const store = ingest(rows(), columns);
    expect(store.rowCount).toBe(5);
    expect(store.get("athlete", 0)).toBe("A");
    expect(store.getNumber("gold", 4)).toBe(4);
    store.set("gold", 0, 9);
    expect(store.getNumber("gold", 0)).toBe(9);
  });
});

describe("QueryEngine", () => {
  it("filters and sorts without grouping", () => {
    const engine = new QueryEngine();
    engine.setStore(ingest(rows(), columns), columns);
    const model = engine.run({
      ...defaultQuerySpec(),
      filters: [{ field: "gold", op: "gte", value: 2 }],
      sorts: [{ field: "gold", dir: "desc" }],
    });
    expect(model.mode).toBe("flat");
    if (model.mode !== "flat") return;
    const golds = [...model.indices].map((i) => engine.getStore()!.getNumber("gold", i));
    expect(golds).toEqual([4, 3, 2]);
  });

  it("quick-filters across columns", () => {
    const engine = new QueryEngine();
    engine.setStore(ingest(rows(), columns), columns);
    const model = engine.run({ ...defaultQuerySpec(), quickFilter: "track" });
    expect(model.mode).toBe("flat");
    if (model.mode !== "flat") return;
    expect(model.indices.length).toBe(2);
  });

  it("groups, aggregates, and expands", () => {
    const engine = new QueryEngine();
    engine.setStore(ingest(rows(), columns), columns);
    engine.run({ ...defaultQuerySpec(), groupBy: ["country"] });
    expect(engine.displayedCount()).toBe(2);
    const usa = engine.displayRowAt(0);
    expect(usa?.kind).toBe("group");
    if (usa?.kind !== "group") return;
    expect(usa.count).toBe(3);
    expect(usa.aggregates.gold).toBe(4);
    engine.toggleExpanded(usa.id);
    engine.run({ ...defaultQuerySpec(), groupBy: ["country"] });
    expect(engine.displayedCount()).toBe(5);
  });

  it("nests group-by fields", () => {
    const engine = new QueryEngine();
    engine.setStore(ingest(rows(), columns), columns);
    const spec = { ...defaultQuerySpec(), groupBy: ["country", "sport"] };
    engine.run(spec);
    const first = engine.displayRowAt(0);
    if (first?.kind !== "group") throw new Error("expected group");
    engine.toggleExpanded(first.id);
    engine.run(spec);
    const nested = engine.displayRowAt(1);
    expect(nested?.kind).toBe("group");
    if (nested?.kind !== "group") return;
    expect(nested.depth).toBe(1);
  });

  it("shows nested payload rows as an expandable tree", () => {
    const bound = bindPayload({
      column_definitions: [{ heading: "Name", field: "name" }],
      table_data: [
        {
          name: "Americas",
          children: [{ name: "USA" }, { name: "Canada" }],
        },
      ],
    });
    const engine = new QueryEngine();
    engine.setStore(ingest(bound.rows, bound.columns), bound.columns, bound.tree);
    engine.run(defaultQuerySpec());
    expect(engine.displayedCount()).toBe(3);
    const root = engine.displayRowAt(0);
    expect(root?.kind).toBe("group");
    if (root?.kind !== "group") return;
    expect(root.key).toBe("Americas");
    expect(root.sourceIndex).toBe(0);
    engine.toggleExpanded(root.id);
    engine.run(defaultQuerySpec());
    expect(engine.displayedCount()).toBe(1);
  });
});

describe("compileExpression", () => {
  it("evaluates comparisons, boolean ops, and functions", () => {
    const fields = new Set(["gold", "country", "athlete"]);
    const pred = compileExpression(
      `gold >= 2 && contains(country, "u") && !empty(athlete)`,
      fields,
    );
    const get = (row: Record<string, unknown>) => (field: string) => row[field];
    expect(pred(get({ gold: 3, country: "USA", athlete: "A" }))).toBe(true);
    expect(pred(get({ gold: 1, country: "USA", athlete: "A" }))).toBe(false);
    expect(pred(get({ gold: 4, country: "UK", athlete: "D" }))).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(() => compileExpression("nope > 1", new Set(["gold"]))).toThrow(/Unknown field/);
  });
});

describe("performance", () => {
  it("ingests and filters 50k rows in a tight budget", () => {
    const n = 50_000;
    const data = Array.from({ length: n }, (_, i) => ({
      country: i % 3 ? "USA" : "UK",
      gold: i % 10,
      age: 20,
    }));
    const cols: ColumnDef[] = [
      { field: "country", type: "string" },
      { field: "gold", type: "number", agg: "sum" },
      { field: "age", type: "number" },
    ];
    const engine = new QueryEngine();
    const t0 = performance.now();
    engine.setStore(ingest(data, cols), cols);
    const ingestMs = performance.now() - t0;
    const t1 = performance.now();
    engine.run({ ...defaultQuerySpec(), filters: [{ field: "gold", op: "gte", value: 5 }] });
    const filterMs = performance.now() - t1;
    expect(engine.displayedCount()).toBe(n / 2);
    expect(ingestMs).toBeLessThan(400);
    expect(filterMs).toBeLessThan(40);
  });
});
