const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;

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
  return interpolate(template, (key) => ctx[key], true);
}

/** Interpolate `{{tokens}}` without HTML-escaping (URLs, JSON keys). */
export function interpolatePlain(template: string, get: (key: string) => unknown): string {
  return interpolate(template, get, false);
}

function interpolate(template: string, get: (key: string) => unknown, html: boolean): string {
  return template.replace(TOKEN, (_, raw: string) => {
    const key = String(raw).trim();
    if (!key) return "";
    const v = get(key);
    if (v == null || v === "") return "";
    return html ? escapeHtml(v) : String(v);
  });
}
