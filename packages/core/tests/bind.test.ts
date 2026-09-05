import { describe, expect, it } from "vitest";
import { bindPayload, excelLetter } from "../src/bind.ts";

describe("excelLetter", () => {
  it("maps indexes to A, B, … Z, AA", () => {
    expect(excelLetter(0)).toBe("A");
    expect(excelLetter(25)).toBe("Z");
    expect(excelLetter(26)).toBe("AA");
  });
});

describe("bindPayload", () => {
  it("uses object keys when there are no column definitions", () => {
    const bound = bindPayload({
      table_data: [
        { athlete: "Ada", gold: 3 },
        { athlete: "Tom", gold: 1 },
      ],
    });
    expect(bound.columns.map((c) => c.field)).toEqual(["athlete", "gold"]);
    expect(bound.columns.map((c) => c.header)).toEqual(["Athlete", "Gold"]);
    expect(bound.rows[0]).toEqual({ athlete: "Ada", gold: 3 });
  });

  it("names extra data columns with Excel letters by index", () => {
    const bound = bindPayload({
      column_definitions: [
        { heading: "Name", field: "name", enable_sorting: true, filter_type: "text" },
      ],
      table_data: [
        { name: "Ada", gold: 3, city: "Paris" },
        { name: "Tom", gold: 1, city: "Rome" },
      ],
    });
    expect(bound.columns.map((c) => c.header)).toEqual(["Name", "B", "C"]);
    expect(bound.rows[0]).toEqual({ name: "Ada", B: 3, C: "Paris" });
    expect(bound.columns[0]!.filter).toBe("text");
  });

  it("drops leftover keys when strictColumns is set", () => {
    const bound = bindPayload(
      {
        column_definitions: [{ heading: "Name", field: "name" }],
        table_data: [{ name: "Ada", gold: 3, city: "Paris" }],
      },
      { strictColumns: true },
    );
    expect(bound.columns.map((c) => c.header)).toEqual(["Name"]);
    expect(bound.rows[0]).toEqual({ name: "Ada", gold: 3, city: "Paris" });
  });

  it("trims matrix extras when strictColumns is set", () => {
    const bound = bindPayload(
      {
        column_definitions: [{ heading: "Name" }],
        table_data: [["Ada", 3, "Paris"]],
      },
      { strictColumns: true },
    );
    expect(bound.columns.map((c) => c.header)).toEqual(["Name"]);
    expect(bound.rows[0]).toEqual({ A: "Ada" });
  });

  it("keeps extra headings with empty cells when defs outnumber data", () => {
    const bound = bindPayload({
      column_definitions: [
        { heading: "Name", field: "name" },
        { heading: "Notes" },
        { heading: "Flag" },
      ],
      table_data: [{ name: "Ada" }],
    });
    expect(bound.columns.map((c) => c.header)).toEqual(["Name", "Notes", "Flag"]);
    expect(bound.rows[0]).toEqual({ name: "Ada", Notes: null, Flag: null });
  });

  it("binds a matrix to A, B, C with no definitions", () => {
    const bound = bindPayload({
      table_data: [
        ["Ada", 3],
        ["Tom", 1, "extra"],
      ],
    });
    expect(bound.columns.map((c) => c.header)).toEqual(["A", "B", "C"]);
    expect(bound.rows[0]).toEqual({ A: "Ada", B: 3, C: null });
    expect(bound.rows[1]).toEqual({ A: "Tom", B: 1, C: "extra" });
  });

  it("flattens nested children into a tree", () => {
    const bound = bindPayload({
      column_definitions: [{ heading: "Name", field: "name" }],
      table_data: [
        {
          name: "Americas",
          children: [{ name: "USA" }, { name: "Canada" }],
        },
      ],
    });
    expect(bound.rows.map((r) => r.name)).toEqual(["Americas", "USA", "Canada"]);
    expect(bound.tree).not.toBeNull();
    expect(bound.tree!.parent[0]).toBe(-1);
    expect(bound.tree!.children[0]).toEqual([1, 2]);
  });

  it("accepts a raw array as table_data", () => {
    const bound = bindPayload([{ a: 1 }]);
    expect(bound.columns[0]!.field).toBe("a");
    expect(bound.rows[0]!.a).toBe(1);
  });

  it("reuses row objects when field names already match the data", () => {
    const rows = [{ athlete: "Ada", gold: 3 }];
    const bound = bindPayload({
      columns: [{ field: "athlete" }, { field: "gold", type: "number" }],
      data: rows,
    });
    expect(bound.rows).toBe(rows);
  });

  it("binds matrix extra cells to letters when only some headings are given", () => {
    const bound = bindPayload({
      column_definitions: [{ heading: "Name" }],
      table_data: [["Ada", 3, "Paris"]],
    });
    expect(bound.columns.map((c) => c.header)).toEqual(["Name", "B", "C"]);
    expect(bound.rows[0]).toEqual({ A: "Ada", B: 3, C: "Paris" });
  });

  it("maps visibility and detail templates onto columns", () => {
    const bound = bindPayload({
      column_definitions: [
        { heading: "Name", field: "name", visible: true, detail_template: "<b>{{value}}</b>" },
        { heading: "Bio", field: "bio", visibility: "detail" },
        { heading: "Internal", field: "secret", visibility: "none" },
      ],
      row_definition: { title_template: "{{name}}" },
      table_data: [{ name: "Ada", bio: "Hi", secret: "x" }],
    });
    expect(bound.columns.map((c) => c.hide)).toEqual([false, true, true]);
    expect(bound.columns.map((c) => c.detailVisible)).toEqual([true, true, false]);
    expect(bound.columns[0]!.detailTemplate).toBe("<b>{{value}}</b>");
    expect(bound.row?.titleTemplate).toBe("{{name}}");
  });
});
