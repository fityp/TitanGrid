/** Tiny `{{token}}` interpolator. Values are HTML-escaped; the template markup is not. */
export function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderTemplate(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, raw: string) => {
    const key = String(raw).trim();
    if (!key) return "";
    const v = ctx[key];
    if (v == null || v === "") return "";
    return escapeHtml(v);
  });
}
