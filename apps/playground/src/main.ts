import { MegaGrid, type ColumnDef, type GridApi } from "@megagrid/grid";
import { generateRows } from "./data.ts";
import "./style.css";

type FilterModel = ReturnType<GridApi["getFilterModel"]>;

const QUERIES = [
  { label: "Gold medals", expr: "gold > 2" },
  { label: "Young US stars", expr: 'age < 24 && contains(country, "United States")' },
  { label: "Swim podium", expr: 'sport == "Swimming" && total >= 3' },
  { label: "Clear", expr: "" },
];

const FILTER_EXAMPLES: { label: string; hint: string; model: FilterModel }[] = [
  {
    label: "Text · athlete",
    hint: "Contains “Alex”",
    model: { athlete: { filterType: "text", type: "contains", filter: "Alex" } },
  },
  {
    label: "Number · gold > 2",
    hint: "Greater than",
    model: { gold: { filterType: "number", type: "greaterThan", filter: 2 } },
  },
  {
    label: "Number range · age",
    hint: "20…28 inclusive",
    model: { age: { filterType: "number", type: "inRange", filter: 20, filterTo: 28 } },
  },
  {
    label: "Date · after 2012",
    hint: "Greater than",
    model: { date: { filterType: "date", type: "greaterThan", dateFrom: "2012-01-01" } },
  },
  {
    label: "Set · country",
    hint: "China + Jamaica",
    model: { country: { filterType: "set", values: ["China", "Jamaica"] } },
  },
  {
    label: "Multi · sport",
    hint: "Text + set together",
    model: {
      sport: {
        filterType: "multi",
        filterModels: [
          { filterType: "text", type: "contains", filter: "ing" },
          { filterType: "set", values: ["Swimming"] },
        ],
      },
    },
  },
  {
    label: "Combined OR · sport",
    hint: "Swimming or Athletics",
    model: {
      sport: {
        filterType: "text",
        operator: "OR",
        conditions: [
          { filterType: "text", type: "equals", filter: "Swimming" },
          { filterType: "text", type: "equals", filter: "Athletics" },
        ],
      },
    },
  },
  {
    label: "Boolean · active",
    hint: "True only",
    model: { active: { filterType: "set", values: [true] } },
  },
  { label: "Clear filters", hint: "Reset all column filters", model: {} },
];

const app = document.querySelector("#app")!;
app.innerHTML = `
  <div class="pg">
    <header class="pg-top">
      <div class="pg-brand">
        <div class="pg-mark">MG</div>
        <div>
          <div class="pg-name">MegaGrid</div>
          <div class="pg-tag">Enterprise data grid · columnar engine · canvas virtualization</div>
        </div>
      </div>
      <div class="pg-metrics" id="metrics">Generating…</div>
    </header>
    <aside class="pg-side">
      <section>
        <h2>Dataset</h2>
        <div class="pg-seg" id="sizes">
          <button data-n="50000">50k</button>
          <button data-n="250000" class="on">250k</button>
          <button data-n="1000000">1M</button>
        </div>
      </section>
      <section>
        <h2>Column filters</h2>
        <p class="pg-copy">Every column filter, live on this grid. Country is a set multi-select dropdown — tick values in the floating row. Sport is a multi filter (text + set tabs in the funnel).</p>
        <ul class="pg-legend">
          <li><b>Athlete</b> text</li>
          <li><b>Country</b> set (multi-select)</li>
          <li><b>Sport</b> multi</li>
          <li><b>Age / Gold</b> number</li>
          <li><b>Date</b> date</li>
          <li><b>Active</b> boolean</li>
        </ul>
        <div class="pg-queries" id="filters"></div>
      </section>
      <section>
        <h2>Expression queries</h2>
        <p class="pg-copy">Typed-array store + expression query compiled to a predicate. Filter 250k rows on the main thread in tens of milliseconds, then scroll at display refresh with a canvas viewport.</p>
        <div class="pg-queries" id="queries"></div>
      </section>
      <section>
        <h2>Grouping</h2>
        <div class="pg-actions">
          <button id="group-country">Group by country</button>
          <button id="group-sport">Country → sport</button>
          <button id="expand">Expand all</button>
          <button id="collapse">Collapse all</button>
          <button id="ungroup">Clear grouping</button>
        </div>
      </section>
      <section>
        <h2>Columns</h2>
        <div class="pg-cols" id="cols"></div>
      </section>
      <section>
        <h2>Export</h2>
        <div class="pg-actions">
          <button id="csv">Download CSV</button>
          <button id="theme">Toggle theme</button>
        </div>
      </section>
    </aside>
    <main class="pg-main" id="grid"></main>
  </div>
`;

const host = document.querySelector("#grid") as HTMLElement;
const metrics = document.querySelector("#metrics") as HTMLElement;
const queryBox = document.querySelector("#queries") as HTMLElement;
const filterBox = document.querySelector("#filters") as HTMLElement;
const colBox = document.querySelector("#cols") as HTMLElement;

let theme: "dark" | "light" = "dark";
let api: GridApi | undefined;
let grid: MegaGrid | undefined;

const columns: ColumnDef[] = [
  { field: "athlete", header: "Athlete", width: 170, pinned: "left" as const, groupable: false, filter: "text" },
  { field: "age", header: "Age", type: "number" as const, width: 88, agg: "avg" as const, filter: "number" },
  { field: "country", header: "Country", width: 176, filter: "set" },
  { field: "year", header: "Year", type: "number" as const, width: 88, filter: "number" },
  { field: "date", header: "Date", type: "date", width: 124, filter: "date" },
  { field: "sport", header: "Sport", width: 148, filter: "multi" },
  { field: "gold", header: "Gold", type: "number" as const, width: 80, agg: "sum" as const, filter: "number" },
  { field: "silver", header: "Silver", type: "number" as const, width: 80, agg: "sum" as const, filter: "number" },
  { field: "bronze", header: "Bronze", type: "number" as const, width: 90, agg: "sum" as const, filter: "number" },
  { field: "total", header: "Total", type: "number" as const, width: 84, agg: "sum" as const, filter: "number" },
  {
    field: "active",
    header: "Active",
    type: "boolean",
    width: 92,
    filter: "set",
    format: (v) => (v == null ? "" : v ? "Yes" : "No"),
  },
  { field: "trend", header: "Form", type: "sparkline" as const, width: 130, sortable: false, filterable: false, editable: false, groupable: false },
];

for (const q of QUERIES) {
  const b = document.createElement("button");
  b.textContent = q.label;
  b.addEventListener("click", () => api?.setExpression(q.expr || null));
  queryBox.appendChild(b);
}

for (const example of FILTER_EXAMPLES) {
  const b = document.createElement("button");
  b.textContent = example.label;
  b.title = example.hint;
  b.addEventListener("click", () => {
    api?.setFilterModel(example.model);
    filterBox.querySelectorAll("button").forEach((el) => el.classList.toggle("on", el === b));
  });
  filterBox.appendChild(b);
}

function renderColToggles() {
  colBox.innerHTML = "";
  for (const col of columns) {
    const lab = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !col.hide;
    input.addEventListener("change", () => {
      col.hide = !input.checked;
      reload(currentN, false);
    });
    lab.append(input, col.header ?? col.field);
    colBox.appendChild(lab);
  }
}

let currentN = 250_000;
let cachedRows: ReturnType<typeof generateRows> | null = null;
let cachedN = 0;
let genMs = 0;

function reload(n: number, regen: boolean) {
  currentN = n;
  grid?.destroy();
  host.innerHTML = "";
  filterBox.querySelectorAll("button").forEach((el) => el.classList.remove("on"));
  if (regen || !cachedRows || cachedN !== n) {
    metrics.textContent = `Generating ${n.toLocaleString()} rows…`;
    const tGen = performance.now();
    cachedRows = generateRows(n);
    cachedN = n;
    genMs = performance.now() - tGen;
  }
  const data = cachedRows;
  grid = MegaGrid.create(host, {
    columns: columns.map((c) => ({ ...c })),
    data,
    theme,
    rowHeight: 28,
    floatingFilters: true,
    rowNumbers: true,
    defaultColDef: { sortable: true, filterable: true, resizable: true, editable: true },
    onReady: (next) => {
      api = next;
    },
    onStats: (stats) => {
      metrics.innerHTML = `
        <span>${n.toLocaleString()} rows</span>
        <span>gen ${genMs.toFixed(0)}ms</span>
        <span>ingest ${stats.ingestMs.toFixed(0)}ms</span>
        <span>query ${stats.totalMs.toFixed(1)}ms</span>
        <span>shown ${stats.resultRows.toLocaleString()}</span>
      `;
    },
  });
}

document.querySelector("#sizes")!.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest("button");
  if (!btn) return;
  document.querySelectorAll("#sizes button").forEach((b) => b.classList.toggle("on", b === btn));
  reload(Number(btn.dataset.n), true);
});

document.querySelector("#group-country")!.addEventListener("click", () => api?.setGroupBy(["country"]));
document.querySelector("#group-sport")!.addEventListener("click", () => api?.setGroupBy(["country", "sport"]));
document.querySelector("#expand")!.addEventListener("click", () => api?.expandAll());
document.querySelector("#collapse")!.addEventListener("click", () => api?.collapseAll());
document.querySelector("#ungroup")!.addEventListener("click", () => api?.setGroupBy([]));
document.querySelector("#theme")!.addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  reload(currentN, false);
});
document.querySelector("#csv")!.addEventListener("click", () => {
  const csv = api?.exportCsv() ?? "";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "megagrid.csv";
  a.click();
  URL.revokeObjectURL(url);
});

document.documentElement.dataset.theme = theme;
renderColToggles();
reload(currentN, true);
