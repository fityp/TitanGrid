import { describe, expect, it } from "vitest";
import { renderTemplate, escapeHtml, interpolatePlain } from "../src/template.ts";

describe("renderTemplate", () => {
  it("interpolates tokens and escapes HTML in values", () => {
    expect(renderTemplate("<b>{{name}}</b>", { name: "<script>" })).toBe("<b>&lt;script&gt;</b>");
    expect(escapeHtml("<x>")).toBe("&lt;x&gt;");
  });

  it("interpolates without escaping for URLs", () => {
    expect(interpolatePlain("https://x.test/{{name}}", (k) => (k === "name" ? "a b" : ""))).toBe("https://x.test/a b");
  });
});
