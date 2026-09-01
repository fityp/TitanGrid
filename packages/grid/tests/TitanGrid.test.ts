import { afterEach, describe, expect, it } from "vitest";
import { TitanGrid } from "../src/index.ts";
import type { GridApi } from "../src/types.ts";

const payload = {
  column_definitions: [
    { heading: "Name", field: "name", enable_sorting: true, filter_type: "text" as const },
    { heading: "Score", field: "score", type: "number" as const, filter_type: "number" as const },
  ],
  table_data: [
    { name: "Ada", score: 91 },
    { name: "Tom", score: 74 },
    { name: "Lin", score: 88 },
  ],
};

function mount(options: Record<string, unknown> = payload) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const grid = TitanGrid.create(host, options);
  return { host, grid, api: grid.api, root: host.querySelector(".tg-root") as HTMLElement };
}

function press(root: HTMLElement, key: string, mods: { ctrl?: boolean; shift?: boolean } = {}) {
  root.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ctrlKey: mods.ctrl,
      shiftKey: mods.shift,
    }),
  );
}

describe("TitanGrid", () => {
  let api: GridApi | undefined;
  let host: HTMLElement | undefined;

  afterEach(() => {
    api?.destroy();
    host?.remove();
    api = undefined;
    host = undefined;
  });

  it("create mounts chrome and loads rows", () => {
    const mounted = mount();
    api = mounted.api;
    host = mounted.host;
    expect(mounted.root).toBeTruthy();
    expect(mounted.root.classList.contains("tg-root")).toBe(true);
    expect(api.getSourceRowCount()).toBe(3);
    expect(api.getDisplayedRowCount()).toBe(3);
    expect(api.getRow(0)).toMatchObject({ name: "Ada", score: 91 });
  });

  it("destroy removes the grid from the host", () => {
    const mounted = mount();
    api = mounted.api;
    host = mounted.host;
    api.destroy();
    expect(host.querySelector(".tg-root")).toBeNull();
    expect(document.body.contains(mounted.root)).toBe(false);
    api = undefined;
  });

  it("setPayload replaces data", () => {
    const mounted = mount();
    api = mounted.api;
    host = mounted.host;
    api.setPayload({
      column_definitions: [{ heading: "City", field: "city" }],
      table_data: [{ city: "Paris" }, { city: "Rome" }],
    });
    expect(api.getSourceRowCount()).toBe(2);
    expect(api.getDisplayedRowCount()).toBe(2);
    expect(api.getRow(0)).toMatchObject({ city: "Paris" });
  });

  it("selection copy is empty until a range exists, then Ctrl+A copies all rows", () => {
    const mounted = mount();
    api = mounted.api;
    host = mounted.host;
    expect(api.copySelection()).toBe("");
    press(mounted.root, "a", { ctrl: true });
    const tsv = api.copySelection();
    expect(tsv).toContain("Name\tScore");
    expect(tsv).toContain("Ada\t91");
    expect(tsv).toContain("Tom\t74");
    expect(tsv).toContain("Lin\t88");
  });

  it("setFilter and setQuickFilter reduce displayed rows", () => {
    const mounted = mount();
    api = mounted.api;
    host = mounted.host;
    api.setFilter("name", { field: "name", op: "contains", value: "Ada" });
    expect(api.getDisplayedRowCount()).toBe(1);
    expect(api.getFilterModel().name).toMatchObject({ filterType: "text", type: "contains", filter: "Ada" });
    api.setFilter("name", null);
    expect(api.getDisplayedRowCount()).toBe(3);
    api.setQuickFilter("Tom");
    expect(api.getDisplayedRowCount()).toBe(1);
    expect(api.getRow(1)).toMatchObject({ name: "Tom", score: 74 });
  });
});
