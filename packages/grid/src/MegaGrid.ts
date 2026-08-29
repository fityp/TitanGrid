import {
  defaultQuerySpec,
  ingest,
  isFilterActive,
  QueryEngine,
  simpleFilterToModel,
  type ColumnDef,
  type ColumnFilter,
  type ColumnFilterModel,
  type Field,
  type FilterModel,
  type QuerySpec,
} from "@megagrid/core";
import { exportCsv, selectionToTsv } from "./clipboard.ts";
import {
  applyFloating,
  booleanFloatValue,
  floatingDisplay,
  kindForColumn,
  parseFloatingInput,
  setFloatLabel,
} from "./filter/floating.ts";
import { FilterPopup } from "./filter/popup.ts";
import { ColumnLayout, ROW_NUMBER_FIELD } from "./layout.ts";
import { renderFrame } from "./render.ts";
import { SelectionModel } from "./selection.ts";
import { darkTheme, lightTheme, type GridApi, type GridOptions } from "./types.ts";

export class MegaGrid {
  readonly api: GridApi;
  private readonly root: HTMLElement;
  private readonly options: GridOptions;
  private columns: ColumnDef[] = [];
  private spec: QuerySpec = defaultQuerySpec();
  private readonly engine = new QueryEngine();
  private readonly layout = new ColumnLayout();
  private readonly selection = new SelectionModel();
  private theme = darkTheme;
  private rowHeight: number;
  private headerHeight: number;
  private filterHeight: number;
  private hoverRow = -1;
  private raf = 0;
  private dragging = false;
  private resizing: { index: number; startX: number; startW: number } | null = null;
  private editor: HTMLInputElement | null = null;
  private destroyed = false;
  private exprError = "";

  private queryInput!: HTMLInputElement;
  private queryError!: HTMLElement;
  private groupBar!: HTMLElement;
  private headerEl!: HTMLElement;
  private filterEl!: HTMLElement;
  private viewport!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private scrollEl!: HTMLElement;
  private sizer!: HTMLElement;
  private statusEl!: HTMLElement;
  private ro?: ResizeObserver;
  private popup!: FilterPopup;
  private filterRaf = 0;

  static create(parent: HTMLElement, options: GridOptions): MegaGrid {
    return new MegaGrid(parent, options);
  }

  private constructor(parent: HTMLElement, options: GridOptions) {
    this.options = options;
    this.rowHeight = options.rowHeight ?? 28;
    this.headerHeight = options.headerHeight ?? 34;
    this.filterHeight = options.floatingFilters === false ? 0 : (options.floatingFilterHeight ?? 30);
    this.theme = options.theme === "light" ? lightTheme : darkTheme;
    this.spec.groupBy = [...(options.groupBy ?? [])];
    this.spec.expression = options.query ?? null;

    this.root = document.createElement("div");
    this.root.className = `mg-root${this.theme.name === "light" ? " mg-light" : ""}`;
    this.root.tabIndex = 0;
    parent.appendChild(this.root);
    this.buildChrome();
    this.popup = new FilterPopup(this.root);
    this.bind();
    this.setColumns(options.columns);
    if (options.data) this.setData(options.data);

    this.api = this.createApi();
    options.onReady?.(this.api);
    void document.fonts?.ready.then(() => this.redraw());
  }

  private createApi(): GridApi {
    return {
      setData: (rows) => this.setData(rows),
      setGroupBy: (fields) => this.setGroupBy(fields),
      setQuickFilter: (text) => {
        this.spec.quickFilter = text;
        this.recompute();
      },
      setExpression: (expr) => {
        this.spec.expression = expr;
        this.queryInput.value = expr ?? "";
        this.recompute();
      },
      setFilter: (field, filter) => {
        if (!filter) delete this.spec.filterModel[field];
        else this.spec.filterModel[field] = simpleFromLegacy(filter);
        this.recompute();
        this.syncFilterButtons();
      },
      setFilterModel: (model) => {
        this.spec.filterModel = { ...model };
        this.recompute();
        this.rebuildFilters();
        this.syncFilterButtons();
      },
      getFilterModel: () => ({ ...this.spec.filterModel }),
      setSort: (sorts) => {
        this.spec.sorts = sorts;
        this.rebuildHeader();
        this.recompute();
      },
      expandAll: () => {
        this.engine.expandAll();
        this.recompute();
      },
      collapseAll: () => {
        this.engine.collapseAll();
        this.recompute();
      },
      getDisplayedRowCount: () => this.engine.displayedCount(),
      getSourceRowCount: () => this.engine.getStore()?.rowCount ?? 0,
      getStats: () => this.engine.stats(),
      copySelection: () => this.copy(),
      exportCsv: () => {
        const store = this.engine.getStore();
        if (!store) return "";
        return exportCsv(this.engine, store, this.layout);
      },
      sizeColumnsToFit: () => this.sizeColumnsToFit(),
      redraw: () => this.redraw(),
      destroy: () => this.destroy(),
    };
  }

  private buildChrome(): void {
    this.root.innerHTML = `
      <div class="mg-query-bar">
        <label>Query</label>
        <input class="mg-query-input" spellcheck="false" placeholder='gold > 2 && contains(country, "USA")' />
        <div class="mg-query-error"></div>
      </div>
      <div class="mg-group-bar"></div>
      <div class="mg-header"></div>
      <div class="mg-filters"></div>
      <div class="mg-viewport">
        <canvas class="mg-canvas"></canvas>
        <div class="mg-scroll"><div class="mg-sizer"></div></div>
      </div>
      <div class="mg-status"></div>
    `;
    this.queryInput = this.root.querySelector(".mg-query-input")!;
    this.queryError = this.root.querySelector(".mg-query-error")!;
    this.groupBar = this.root.querySelector(".mg-group-bar")!;
    this.headerEl = this.root.querySelector(".mg-header")!;
    this.filterEl = this.root.querySelector(".mg-filters")!;
    this.viewport = this.root.querySelector(".mg-viewport")!;
    this.canvas = this.root.querySelector(".mg-canvas")!;
    this.scrollEl = this.root.querySelector(".mg-scroll")!;
    this.sizer = this.root.querySelector(".mg-sizer")!;
    this.statusEl = this.root.querySelector(".mg-status")!;
    if (!this.filterHeight) this.filterEl.style.display = "none";
    if (this.spec.expression) this.queryInput.value = this.spec.expression;
  }

  private bind(): void {
    this.scrollEl.addEventListener("scroll", () => this.scheduleDraw(), { passive: true });
    this.scrollEl.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.scrollEl.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.scrollEl.addEventListener("dblclick", (e) => this.onDblClick(e));
    window.addEventListener("pointermove", this.onWindowMove);
    window.addEventListener("pointerup", this.onWindowUp);
    this.root.addEventListener("keydown", (e) => this.onKey(e));
    this.queryInput.addEventListener("input", () => this.onQueryInput());
    this.queryInput.addEventListener("keydown", (e) => e.stopPropagation());
    this.groupBar.addEventListener("dragover", (e) => e.preventDefault());
    this.groupBar.addEventListener("drop", (e) => {
      e.preventDefault();
      const field = e.dataTransfer?.getData("text/megagrid-field") || e.dataTransfer?.getData("text/plain");
      if (field && !this.spec.groupBy.includes(field) && field !== ROW_NUMBER_FIELD) {
        this.setGroupBy([...this.spec.groupBy, field]);
      }
    });
    this.ro = new ResizeObserver(() => this.redraw());
    this.ro.observe(this.viewport);
  }

  private setColumns(defs: ColumnDef[]): void {
    const d = this.options.defaultColDef ?? {};
    const merged = defs.map((c) => ({
      sortable: true,
      filterable: true,
      resizable: true,
      ...d,
      ...c,
      width: c.width ?? d.width ?? (c.type === "sparkline" ? 120 : 128),
    }));
    if (this.options.rowNumbers !== false) {
      merged.unshift({
        field: ROW_NUMBER_FIELD,
        header: "#",
        width: 56,
        pinned: "left",
        sortable: false,
        filterable: false,
        resizable: false,
        editable: false,
      });
    }
    this.columns = merged;
    this.layout.rebuild(this.columns);
    this.rebuildHeader();
    this.rebuildFilters();
    this.rebuildGroupBar();
  }

  setData(rows: Record<string, unknown>[]): void {
    const t0 = performance.now();
    const store = ingest(rows, this.columns.filter((c) => c.field !== ROW_NUMBER_FIELD));
    this.engine.setStore(store, this.columns);
    this.engine.setIngestMs(performance.now() - t0);
    this.recompute();
  }

  private setGroupBy(fields: Field[]): void {
    this.spec.groupBy = fields;
    this.engine.collapseAll();
    this.rebuildGroupBar();
    this.recompute();
  }

  private recompute(): void {
    try {
      this.engine.run(this.spec);
      this.exprError = "";
    } catch (err) {
      this.exprError = err instanceof Error ? err.message : String(err);
      this.spec.expression = this.spec.expression;
    }
    this.queryError.textContent = this.exprError;
    this.selection.clamp(this.engine.displayedCount(), this.layout.all.length);
    this.syncSizer();
    this.updateStatus();
    this.options.onStats?.(this.engine.stats());
    this.redraw();
  }

  private syncSizer(): void {
    const rows = this.engine.displayedCount();
    this.sizer.style.width = `${Math.max(this.layout.totalWidth, this.scrollEl.clientWidth)}px`;
    this.sizer.style.height = `${Math.max(rows * this.rowHeight, 1)}px`;
  }

  private scheduleDraw(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  }

  redraw(): void {
    this.syncSizer();
    this.syncHeaderScroll();
    this.draw();
  }

  private draw(): void {
    if (this.destroyed) return;
    const store = this.engine.getStore();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this.scrollEl.clientWidth;
    const cssH = this.scrollEl.clientHeight;
    if (cssW <= 0 || cssH <= 0) return;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    const w = Math.floor(cssW * dpr);
    const h = Math.floor(cssH * dpr);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    const ctx = this.canvas.getContext("2d");
    if (!ctx || !store) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderFrame({
      ctx,
      width: cssW,
      height: cssH,
      scrollLeft: this.scrollEl.scrollLeft,
      scrollTop: this.scrollEl.scrollTop,
      rowHeight: this.rowHeight,
      rowCount: this.engine.displayedCount(),
      layout: this.layout,
      engine: this.engine,
      store,
      selection: this.selection,
      hoverRow: this.hoverRow,
      theme: this.theme,
    });
    this.syncHeaderScroll();
  }

  private syncHeaderScroll(): void {
    const x = `translateX(${-this.scrollEl.scrollLeft}px)`;
    const center = this.headerEl.querySelector(".mg-h-center") as HTMLElement | null;
    const fcenter = this.filterEl.querySelector(".mg-f-center") as HTMLElement | null;
    if (center) center.style.transform = x;
    if (fcenter) fcenter.style.transform = x;
  }

  private rebuildHeader(): void {
    this.popup?.close();
    this.headerEl.style.height = `${this.headerHeight}px`;
    this.headerEl.innerHTML = "";
    const left = el("div", "mg-h-left");
    const clip = el("div", "mg-h-center-clip");
    const center = el("div", "mg-h-center");
    const right = el("div", "mg-h-right");
    for (const col of this.layout.left) left.appendChild(this.headerCell(col.index));
    for (const col of this.layout.center) center.appendChild(this.headerCell(col.index));
    for (const col of this.layout.right) right.appendChild(this.headerCell(col.index));
    center.style.width = `${this.layout.centerWidth}px`;
    clip.appendChild(center);
    this.headerEl.append(left, clip, right);
  }

  private headerCell(index: number): HTMLElement {
    const col = this.layout.all[index]!;
    const node = el("div", "mg-col-h");
    node.style.width = `${col.width}px`;
    node.textContent = col.def.header ?? col.def.field;
    const sort = this.spec.sorts.find((s) => s.field === col.def.field);
    if (sort) {
      const mark = el("span", "mg-sort");
      mark.textContent = sort.dir === "asc" ? "▲" : "▼";
      node.appendChild(mark);
    }
    const kind = kindForColumn(col.def);
    if (kind !== "none") {
      node.title = filterKindTitle(kind);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mg-filter-btn";
      btn.dataset.field = col.def.field;
      btn.setAttribute("aria-label", `Filter ${col.def.header ?? col.def.field}`);
      btn.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2 3h12l-4.5 5.4V13l-3 1.5V8.4z"/></svg>`;
      if (isFilterActive(this.spec.filterModel[col.def.field])) btn.classList.add("on");
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openColumnFilter(col.def, btn);
      });
      node.appendChild(btn);
    }
    node.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).classList.contains("mg-resize")) return;
      this.toggleSort(col.def.field, e.shiftKey);
    });
    if (col.def.resizable !== false) {
      const handle = el("div", "mg-resize");
      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.resizing = { index: col.index, startX: e.clientX, startW: col.width };
        handle.setPointerCapture(e.pointerId);
      });
      node.appendChild(handle);
    }
    if (col.def.groupable !== false && col.def.field !== ROW_NUMBER_FIELD) {
      node.draggable = true;
      node.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/megagrid-field", col.def.field);
        e.dataTransfer?.setData("text/plain", col.def.field);
      });
    }
    return node;
  }

  private rebuildFilters(): void {
    if (!this.filterHeight) return;
    this.filterEl.innerHTML = "";
    const left = el("div", "mg-f-left");
    const clip = el("div", "mg-f-center-clip");
    const center = el("div", "mg-f-center");
    const right = el("div", "mg-f-right");
    for (const col of this.layout.left) left.appendChild(this.filterCell(col.index));
    for (const col of this.layout.center) center.appendChild(this.filterCell(col.index));
    for (const col of this.layout.right) right.appendChild(this.filterCell(col.index));
    center.style.width = `${this.layout.centerWidth}px`;
    clip.appendChild(center);
    this.filterEl.append(left, clip, right);
  }

  private filterCell(index: number): HTMLElement {
    const col = this.layout.all[index]!;
    const wrap = el("div", "mg-col-f");
    wrap.style.width = `${col.width}px`;
    const kind = kindForColumn(col.def);
    if (kind === "none" || col.def.field === ROW_NUMBER_FIELD) return wrap;
    const field = col.def.field;
    const model = this.spec.filterModel[field];

    if (col.def.type === "boolean") {
      wrap.appendChild(this.booleanFloat(field, model));
      return wrap;
    }
    if (kind === "set") {
      wrap.appendChild(this.setFloat(col.def, model));
      return wrap;
    }

    const input = document.createElement("input");
    input.dataset.field = field;
    if (kind === "date") {
      input.type = "date";
      input.title = "Date filter";
    } else {
      input.placeholder = kind === "number" ? "> 0  or  1...5" : "Contains…";
    }
    input.value = floatingDisplay(model, kind);
    input.addEventListener("keydown", (e) => e.stopPropagation());
    input.addEventListener("input", () => {
      const parsed = parseFloatingInput(input.value, kind === "multi" ? "text" : kind);
      const next = applyFloating(kind, this.spec.filterModel[field], parsed);
      if (next) this.spec.filterModel[field] = next;
      else delete this.spec.filterModel[field];
      this.scheduleFilter();
      this.syncFilterButtons();
    });
    wrap.appendChild(input);
    return wrap;
  }

  private setFloat(def: ColumnDef, model: ColumnFilterModel | undefined): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mg-set-float";
    btn.dataset.field = def.field;
    btn.title = "Set filter · multi-select";
    const label = document.createElement("span");
    label.className = "mg-set-float-label";
    label.textContent = setFloatLabel(model);
    btn.appendChild(label);
    if (isFilterActive(model)) btn.classList.add("on");
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openColumnFilter(def, btn);
    });
    return btn;
  }

  private booleanFloat(field: string, model: ColumnFilterModel | undefined): HTMLSelectElement {
    const select = document.createElement("select");
    select.className = "mg-bool-float";
    select.dataset.field = field;
    select.title = "Boolean filter";
    for (const [value, text] of [
      ["", "All"],
      ["true", "True"],
      ["false", "False"],
    ] as const) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      select.appendChild(opt);
    }
    select.value = booleanFloatValue(model);
    select.addEventListener("keydown", (e) => e.stopPropagation());
    select.addEventListener("change", () => {
      if (!select.value) delete this.spec.filterModel[field];
      else this.spec.filterModel[field] = { filterType: "set", values: [select.value === "true"] };
      this.scheduleFilter();
      this.syncFilterButtons();
    });
    return select;
  }

  private openColumnFilter(def: ColumnDef, anchor: HTMLElement): void {
    const store = this.engine.getStore();
    if (!store) return;
    if (this.popup.openField === def.field) {
      this.popup.close();
      return;
    }
    this.popup.open({
      anchor,
      def,
      store,
      handlers: {
        getModel: (field) => this.spec.filterModel[field],
        setModel: (field, model) => {
          if (model) this.spec.filterModel[field] = model;
          else delete this.spec.filterModel[field];
          this.scheduleFilter();
          this.syncFilterButtons();
          this.syncFloatingValue(field);
        },
      },
    });
  }

  private rebuildGroupBar(): void {
    this.groupBar.innerHTML = "";
    if (!this.spec.groupBy.length) {
      const hint = el("span", "mg-hint");
      hint.textContent = "Drag a column header here to group (row grouping · aggregation)";
      this.groupBar.appendChild(hint);
    }
    for (const field of this.spec.groupBy) {
      const chip = el("div", "mg-chip");
      const def = this.columns.find((c) => c.field === field);
      chip.append(def?.header ?? field);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "×";
      btn.addEventListener("click", () => this.setGroupBy(this.spec.groupBy.filter((f) => f !== field)));
      chip.appendChild(btn);
      this.groupBar.appendChild(chip);
    }
  }

  private toggleSort(field: Field, additive: boolean): void {
    const col = this.columns.find((c) => c.field === field);
    if (!col || col.sortable === false) return;
    const existing = this.spec.sorts.find((s) => s.field === field);
    let next = [...this.spec.sorts];
    if (!additive) next = existing ? [existing] : [];
    if (!existing) next.push({ field, dir: "asc" });
    else if (existing.dir === "asc") existing.dir = "desc";
    else next = next.filter((s) => s.field !== field);
    this.spec.sorts = next;
    this.rebuildHeader();
    this.recompute();
  }

  private hit(e: PointerEvent | MouseEvent): { row: number; col: number } | null {
    const rect = this.scrollEl.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const vy = e.clientY - rect.top;
    if (vx < 0 || vy < 0 || vx > this.scrollEl.clientWidth || vy > this.scrollEl.clientHeight) return null;
    const row = Math.floor((vy + this.scrollEl.scrollTop) / this.rowHeight);
    if (row < 0 || row >= this.engine.displayedCount()) return null;
    const col = this.layout.columnAtVisualX(vx, this.scrollEl.scrollLeft, this.scrollEl.clientWidth);
    if (!col) return null;
    return { row, col: col.index };
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.root.focus({ preventScroll: true });
    const hit = this.hit(e);
    if (!hit) return;
    const display = this.engine.displayRowAt(hit.row);
    if (display?.kind === "group") {
      const col = this.layout.all[hit.col];
      const first = this.layout.all.find((c) => c.def.field !== ROW_NUMBER_FIELD);
      if (col && first && col.index === first.index) {
        this.engine.toggleExpanded(display.id);
        this.recompute();
        return;
      }
    }
    this.dragging = true;
    this.selection.setFocus(hit.row, hit.col, e.shiftKey);
    this.scrollEl.setPointerCapture(e.pointerId);
    this.updateStatus();
    this.scheduleDraw();
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.resizing) {
      const dx = e.clientX - this.resizing.startX;
      this.layout.setWidth(this.resizing.index, this.resizing.startW + dx);
      this.rebuildHeader();
      this.rebuildFilters();
      this.syncSizer();
      this.scheduleDraw();
      return;
    }
    const hit = this.hit(e);
    const nextHover = hit?.row ?? -1;
    if (nextHover !== this.hoverRow) {
      this.hoverRow = nextHover;
      this.scheduleDraw();
    }
    if (this.dragging && hit) {
      this.selection.dragTo(hit.row, hit.col);
      this.updateStatus();
      this.scheduleDraw();
    }
  }

  private onWindowMove = (e: PointerEvent): void => {
    if (!this.resizing) return;
    const dx = e.clientX - this.resizing.startX;
    this.layout.setWidth(this.resizing.index, this.resizing.startW + dx);
    this.rebuildHeader();
    this.rebuildFilters();
    this.syncSizer();
    this.scheduleDraw();
  };

  private onWindowUp = (): void => {
    this.dragging = false;
    this.resizing = null;
  };

  private onDblClick(e: MouseEvent): void {
    const hit = this.hit(e);
    if (hit) this.startEdit(hit.row, hit.col);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.target !== this.root) return;
    const rows = this.engine.displayedCount();
    const cols = this.layout.all.length;
    const extend = e.shiftKey;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.selection.move(1, 0, extend, rows, cols);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.selection.move(-1, 0, extend, rows, cols);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.selection.move(0, -1, extend, rows, cols);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      this.selection.move(0, 1, extend, rows, cols);
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      this.startEdit(this.selection.focus.row, this.selection.focus.col);
      return;
    } else if (e.key === "Escape") {
      this.selection.clear();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      this.copy();
      return;
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
      e.preventDefault();
      if (rows && cols) this.selection.setFocus(0, 0);
      if (rows && cols) {
        this.selection.anchor = { row: 0, col: 0 };
        this.selection.dragTo(rows - 1, cols - 1);
      }
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      this.startEdit(this.selection.focus.row, this.selection.focus.col, e.key);
      return;
    } else {
      return;
    }
    this.ensureFocusVisible();
    this.updateStatus();
    this.scheduleDraw();
  }

  private ensureFocusVisible(): void {
    const row = this.selection.focus.row;
    const y0 = row * this.rowHeight;
    const y1 = y0 + this.rowHeight;
    const top = this.scrollEl.scrollTop;
    const bottom = top + this.scrollEl.clientHeight;
    if (y0 < top) this.scrollEl.scrollTop = y0;
    else if (y1 > bottom) this.scrollEl.scrollTop = y1 - this.scrollEl.clientHeight;
    const col = this.layout.all[this.selection.focus.col];
    if (!col || col.pinned) return;
    const x0 = this.layout.leftWidth + col.x;
    const x1 = x0 + col.width;
    const left = this.scrollEl.scrollLeft;
    const vis = this.scrollEl.clientWidth - this.layout.leftWidth - this.layout.rightWidth;
    if (x0 < left + this.layout.leftWidth) this.scrollEl.scrollLeft = col.x;
    else if (x1 > left + this.layout.leftWidth + vis) {
      this.scrollEl.scrollLeft = col.x + col.width - vis;
    }
  }

  private startEdit(row: number, colIndex: number, seed?: string): void {
    this.closeEditor(true);
    const col = this.layout.all[colIndex];
    const store = this.engine.getStore();
    const display = this.engine.displayRowAt(row);
    if (!col || !store || !display || display.kind !== "leaf") return;
    if (col.def.editable === false || col.def.field === ROW_NUMBER_FIELD || col.def.type === "sparkline") return;
    const x = this.layout.xForColumn(col, this.scrollEl.scrollLeft, this.scrollEl.clientWidth);
    const y = row * this.rowHeight - this.scrollEl.scrollTop;
    const input = document.createElement("input");
    input.className = "mg-editor";
    input.style.left = `${x}px`;
    input.style.top = `${y}px`;
    input.style.width = `${col.width}px`;
    input.style.height = `${this.rowHeight}px`;
    const oldValue = store.get(col.def.field, display.sourceIndex);
    input.value = seed ?? (oldValue == null ? "" : String(oldValue));
    this.viewport.appendChild(input);
    this.editor = input;
    input.focus();
    if (seed) input.setSelectionRange(input.value.length, input.value.length);
    else input.select();
    const commit = () => {
      let value: unknown = input.value;
      if (col.def.type === "number") value = input.value === "" ? null : Number(input.value);
      store.set(col.def.field, display.sourceIndex, value);
      this.options.onCellValueChanged?.({
        field: col.def.field,
        sourceIndex: display.sourceIndex,
        value,
        oldValue,
      });
      this.closeEditor(false);
      this.recompute();
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") commit();
      if (e.key === "Escape") this.closeEditor(false);
    });
    input.addEventListener("blur", () => commit());
  }

  private closeEditor(commit: boolean): void {
    void commit;
    this.editor?.remove();
    this.editor = null;
  }

  private copy(): string {
    const store = this.engine.getStore();
    if (!store) return "";
    const text = selectionToTsv(this.engine, store, this.layout, this.selection);
    void navigator.clipboard?.writeText(text);
    return text;
  }

  private onQueryInput(): void {
    const value = this.queryInput.value;
    this.spec.expression = value.trim() ? value : null;
    this.recompute();
  }

  private sizeColumnsToFit(): void {
    const avail = this.scrollEl.clientWidth || this.viewport.clientWidth;
    if (avail <= 0 || !this.layout.all.length) return;
    const total = this.layout.totalWidth || 1;
    const scale = avail / total;
    for (const col of this.layout.all) {
      if (col.def.field === ROW_NUMBER_FIELD) continue;
      this.layout.setWidth(col.index, Math.max(64, Math.floor(col.width * scale)));
    }
    this.rebuildHeader();
    this.rebuildFilters();
    this.syncSizer();
    this.redraw();
  }

  private updateStatus(): void {
    const stats = this.engine.stats();
    const store = this.engine.getStore();
    const range = this.selection.range;
    let sel = "none";
    if (range) {
      const cells = (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1);
      sel = `${cells.toLocaleString()} cells`;
      if (store && range.c0 === range.c1) {
        const col = this.layout.all[range.c0];
        if (col && col.def.type === "number") {
          let sum = 0;
          let n = 0;
          for (let r = range.r0; r <= range.r1; r++) {
            const display = this.engine.displayRowAt(r);
            if (display?.kind !== "leaf") continue;
            const v = store.getNumber(col.def.field, display.sourceIndex);
            if (Number.isFinite(v)) {
              sum += v;
              n++;
            }
          }
          if (n) sel += ` · sum ${sum.toLocaleString()} · avg ${(sum / n).toFixed(2)}`;
        }
      }
    }
    this.statusEl.innerHTML = `
      <span>Rows <b>${stats.sourceRows.toLocaleString()}</b></span>
      <span>Shown <b>${stats.resultRows.toLocaleString()}</b></span>
      <span>Ingest <b>${stats.ingestMs.toFixed(1)}ms</b></span>
      <span>Filter <b>${stats.filterMs.toFixed(1)}ms</b></span>
      <span>Sort <b>${stats.sortMs.toFixed(1)}ms</b></span>
      <span>Group <b>${stats.groupMs.toFixed(1)}ms</b></span>
      <span>Selection <b>${sel}</b></span>
    `;
  }

  destroy(): void {
    this.destroyed = true;
    this.ro?.disconnect();
    window.removeEventListener("pointermove", this.onWindowMove);
    window.removeEventListener("pointerup", this.onWindowUp);
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.filterRaf) cancelAnimationFrame(this.filterRaf);
    this.popup.destroy();
    this.root.remove();
  }

  private scheduleFilter(): void {
    if (this.filterRaf) return;
    this.filterRaf = requestAnimationFrame(() => {
      this.filterRaf = 0;
      this.recompute();
    });
  }

  private syncFilterButtons(): void {
    this.headerEl.querySelectorAll<HTMLButtonElement>(".mg-filter-btn").forEach((btn) => {
      const field = btn.dataset.field;
      btn.classList.toggle("on", !!(field && isFilterActive(this.spec.filterModel[field])));
    });
    this.filterEl.querySelectorAll<HTMLButtonElement>(".mg-set-float").forEach((btn) => {
      const field = btn.dataset.field;
      btn.classList.toggle("on", !!(field && isFilterActive(this.spec.filterModel[field])));
    });
  }

  private syncFloatingValue(field: string): void {
    const col = this.columns.find((c) => c.field === field);
    if (!col) return;
    const kind = kindForColumn(col);
    const model = this.spec.filterModel[field];
    const setBtn = this.filterEl.querySelector<HTMLButtonElement>(`.mg-set-float[data-field="${cssAttr(field)}"]`);
    if (setBtn) {
      const label = setBtn.querySelector(".mg-set-float-label");
      if (label) label.textContent = setFloatLabel(model);
      setBtn.classList.toggle("on", isFilterActive(model));
      return;
    }
    const boolSel = this.filterEl.querySelector<HTMLSelectElement>(`.mg-bool-float[data-field="${cssAttr(field)}"]`);
    if (boolSel) {
      boolSel.value = booleanFloatValue(model);
      return;
    }
    const input = this.filterEl.querySelector<HTMLInputElement>(`input[data-field="${cssAttr(field)}"]`);
    if (input) input.value = floatingDisplay(model, kind);
  }
}

function filterKindTitle(kind: string): string {
  if (kind === "set") return "Set filter (multi-select)";
  if (kind === "multi") return "Multi filter (text + set)";
  if (kind === "number") return "Number filter";
  if (kind === "date") return "Date filter";
  if (kind === "text") return "Text filter";
  return "";
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function cssAttr(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function simpleFromLegacy(filter: ColumnFilter): ColumnFilterModel {
  return simpleFilterToModel(filter);
}
