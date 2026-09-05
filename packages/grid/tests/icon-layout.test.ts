import { describe, expect, it } from "vitest";
import { iconAtPoint, layoutCellIcons } from "../src/icon-layout.ts";
import type { ResolvedIcon } from "@titangrid/core";

function icon(partial: Partial<ResolvedIcon> & Pick<ResolvedIcon, "label" | "url">): ResolvedIcon {
  return {
    def: {},
    className: "",
    color: "",
    background: "",
    title: "",
    placement: "before",
    ...partial,
  };
}

describe("layoutCellIcons", () => {
  it("lays out labeled chips wider than image icons", () => {
    const layout = layoutCellIcons({
      icons: [icon({ label: "Edit", url: "" }), icon({ label: "Lock", url: "" })],
      text: "",
      textWidth: 0,
      cellX: 0,
      cellWidth: 200,
      rowY: 0,
      rowHeight: 28,
      fontSize: 12,
      align: "left",
      indent: 0,
      pad: 10,
      measure: (s) => s.length * 7,
    });
    expect(layout.boxes).toHaveLength(2);
    expect(layout.boxes[0]!.width).toBeGreaterThan(20);
    expect(layout.boxes[1]!.x).toBeGreaterThan(layout.boxes[0]!.x);
    expect(iconAtPoint(layout.boxes, layout.boxes[1]!.x + 2, 14)?.label).toBe("Lock");
  });
});
