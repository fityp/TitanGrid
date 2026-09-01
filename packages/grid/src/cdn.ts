import css from "./styles.css?inline";

if (typeof document !== "undefined" && !document.querySelector("style[data-titangrid]")) {
  const el = document.createElement("style");
  el.dataset.titangrid = "";
  el.textContent = css;
  document.head.appendChild(el);
}

export { TitanGrid } from "./TitanGrid.ts";
export { darkTheme, lightTheme } from "./types.ts";
