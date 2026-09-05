/** Tiny SVG data URIs so demo icons need no network. */

function svg(body: string, w = 16, h = 12): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`,
  )}`;
}

function flag(bg: string, fg = "#fff"): string {
  return svg(
    `<rect width="16" height="12" rx="1.5" fill="${bg}"/><circle cx="8" cy="6" r="2.4" fill="${fg}"/>`,
  );
}

export const COUNTRY_FLAGS: Record<string, string> = {
  "United States": flag("#3c3b6e", "#fff"),
  "United Kingdom": flag("#012169", "#c8102e"),
  China: flag("#de2910", "#ffde00"),
  Australia: flag("#00008b", "#fff"),
  France: flag("#0055a4", "#fff"),
  Germany: flag("#dd0000", "#ffce00"),
  Japan: flag("#fff", "#bc002d"),
  Italy: flag("#009246", "#fff"),
  Canada: flag("#ff0000", "#fff"),
  Netherlands: flag("#ae1c28", "#fff"),
  "South Korea": flag("#fff", "#0047a0"),
  Brazil: flag("#009c3b", "#ffdf00"),
  Kenya: flag("#006600", "#c00"),
  Jamaica: flag("#009b3a", "#fed100"),
  Norway: flag("#ba0c2f", "#fff"),
};

export const CANADA_ALT_FLAG = flag("#1e3a5f", "#7dd3fc");

export const ICON_INFO = svg(
  `<circle cx="8" cy="8" r="7" fill="#4c9fff"/><rect x="7.2" y="7" width="1.6" height="5" rx="0.6" fill="#fff"/><circle cx="8" cy="4.6" r="1" fill="#fff"/>`,
  16,
  16,
);

export const ICON_LINK = svg(
  `<rect x="1" y="1" width="14" height="14" rx="3" fill="#3dd68c"/><path d="M6 8.5h4M8.5 6v5" stroke="#062" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  16,
  16,
);

export function countryFlagUrl(value: unknown, sourceIndex: number): string {
  const name = String(value ?? "");
  if (name === "Canada" && sourceIndex % 23 === 0) return CANADA_ALT_FLAG;
  return COUNTRY_FLAGS[name] ?? "";
}
