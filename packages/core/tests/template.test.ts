import { describe, expect, it } from "vitest";
import { renderTemplate, escapeHtml } from "../src/template.ts";

describe("renderTemplate", () => {
  it("interpolates tokens and escapes HTML in values", () => {
    expect(renderTemplate("<b>{{name}}</b>", { name: "<script>" })).toBe("<b>&lt;script&gt;</b>");
    expect(escapeHtml("<x>")).toBe("&lt;x&gt;");
  });

  it("treats missing tokens as empty", () => {
    expect(renderTemplate("{{a}}-{{b}}", { a: "1" })).toBe("1-");
  });
});
