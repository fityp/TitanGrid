import { describe, expect, it } from "vitest";
import { applyFilters } from "../src/query/filter.ts";
import { ingest } from "../src/store.ts";
import { QueryEngine } from "../src/query/engine.ts";
import type { ColumnDef } from "../src/types.ts";
import { defaultQuerySpec } from "../src/types.ts";
import type { FilterModel } from "../src/filter-model.ts";

const columns: ColumnDef[] = [
  { field: "country", type: "string" },
  { field: "sport", type: "string" },
  { field: "athlete", type: "string" },
  { field: "gold", type: "number" },
  { field: "age", type: "number" },
  { field: "date", type: "date" },
];

function rows() {
  return [
    { country: "USA", sport: "Swimming", athlete: "A", gold: 3, age: 22, date: "24/08/2008" },
    { country: "USA", sport: "Swimming", athlete: "B", gold: 1, age: 28, date: "29/08/2004" },
    { country: "USA", sport: "Athletics", athlete: "C", gold: 0, age: 31, date: "12/08/2012" },
    { country: "UK", sport: "Swimming", athlete: "D", gold: 2, age: 24, date: "24/08/2008" },
    { country: "UK", sport: "Athletics", athlete: "E", gold: 4, age: 19, date: "08/08/2016" },
    { country: "UK", sport: "", athlete: "F", gold: null, age: 21, date: "" },
  ];
}

function ids(store = ingest(rows(), columns), model: FilterModel) {
  return [...applyFilters(store, [], "", null, undefined, model)];
}

describe("text filter operators", () => {
  it("contains / notContains / equals / startsWith / endsWith", () => {
    const store = ingest(rows(), columns);
    expect(ids(store, { sport: { filterType: "text", type: "contains", filter: "swim" } })).toEqual([0, 1, 3]);
    expect(ids(store, { sport: { filterType: "text", type: "notContains", filter: "swim" } }).length).toBe(3);
    expect(ids(store, { sport: { filterType: "text", type: "equals", filter: "athletics" } })).toEqual([2, 4]);
    expect(ids(store, { athlete: { filterType: "text", type: "startsWith", filter: "a" } })).toEqual([0]);
    expect(ids(store, { sport: { filterType: "text", type: "endsWith", filter: "ing" } })).toEqual([0, 1, 3]);
  });

  it("blank / notBlank", () => {
    const store = ingest(rows(), columns);
    expect(ids(store, { sport: { filterType: "text", type: "blank" } })).toEqual([5]);
    expect(ids(store, { sport: { filterType: "text", type: "notBlank" } }).length).toBe(5);
  });

  it("AND / OR combined conditions", () => {
    const store = ingest(rows(), columns);
    expect(
      ids(store, {
        sport: {
          filterType: "text",
          operator: "OR",
          conditions: [
            { filterType: "text", type: "equals", filter: "Swimming" },
            { filterType: "text", type: "equals", filter: "Athletics" },
          ],
        },
      }),
    ).toEqual([0, 1, 2, 3, 4]);
    expect(
      ids(store, {
        country: {
          filterType: "text",
          operator: "AND",
          conditions: [
            { filterType: "text", type: "contains", filter: "U" },
            { filterType: "text", type: "startsWith", filter: "US" },
          ],
        },
      }),
    ).toEqual([0, 1, 2]);
  });
});

describe("number filter", () => {
  it("comparisons, inRange inclusive, blanks", () => {
    const store = ingest(rows(), columns);
    expect(ids(store, { gold: { filterType: "number", type: "greaterThan", filter: 2 } })).toEqual([0, 4]);
    expect(ids(store, { gold: { filterType: "number", type: "greaterThanOrEqual", filter: 2 } })).toEqual([0, 3, 4]);
    expect(ids(store, { gold: { filterType: "number", type: "inRange", filter: 1, filterTo: 3 } })).toEqual([0, 1, 3]);
    expect(ids(store, { gold: { filterType: "number", type: "blank" } })).toEqual([5]);
    expect(ids(store, { gold: { filterType: "number", type: "notEqual", filter: 1 } }).includes(1)).toBe(false);
  });
});

describe("date filter", () => {
  it("equals and greaterThan using DD/MM/YYYY", () => {
    const store = ingest(rows(), columns);
    expect(ids(store, { date: { filterType: "date", type: "equals", dateFrom: "2008-08-24" } })).toEqual([0, 3]);
    expect(ids(store, { date: { filterType: "date", type: "greaterThan", dateFrom: "2012-01-01" } })).toEqual([2, 4]);
  });
});

describe("set filter", () => {
  it("selects values including blanks", () => {
    const store = ingest(rows(), columns);
    expect(ids(store, { country: { filterType: "set", values: ["UK"] } })).toEqual([3, 4, 5]);
    expect(ids(store, { sport: { filterType: "set", values: [null, "Athletics"] } })).toEqual([2, 4, 5]);
    expect(ids(store, { country: { filterType: "set", values: [] } })).toEqual([]);
  });
});

describe("multi filter", () => {
  it("ANDs text and set", () => {
    const store = ingest(rows(), columns);
    expect(
      ids(store, {
        sport: {
          filterType: "multi",
          filterModels: [
            { filterType: "text", type: "contains", filter: "ing" },
            { filterType: "set", values: ["Swimming"] },
          ],
        },
      }),
    ).toEqual([0, 1, 3]);
  });
});

describe("query engine filterModel", () => {
  it("filters 50k set+number in a tight budget", () => {
    const n = 50_000;
    const data = Array.from({ length: n }, (_, i) => ({
      country: i % 3 ? "USA" : "UK",
      gold: i % 10,
    }));
    const cols: ColumnDef[] = [
      { field: "country", type: "string" },
      { field: "gold", type: "number" },
    ];
    const engine = new QueryEngine();
    engine.setStore(ingest(data, cols), cols);
    const t0 = performance.now();
    engine.run({
      ...defaultQuerySpec(),
      filterModel: {
        country: { filterType: "set", values: ["USA"] },
        gold: { filterType: "number", type: "greaterThanOrEqual", filter: 5 },
      },
    });
    const ms = performance.now() - t0;
    let expected = 0;
    for (let i = 0; i < n; i++) if (i % 3 && i % 10 >= 5) expected++;
    expect(engine.displayedCount()).toBe(expected);
    expect(ms).toBeLessThan(40);
  });
});
