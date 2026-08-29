import {
  defaultFilterKind,
  isFilterActive,
  needsSecondInput,
  needsValueInput,
  NUMBER_OPTIONS,
  TEXT_OPTIONS,
  type ColumnDef,
  type ColumnFilterModel,
  type ColumnStore,
  type CombinedFilterModel,
  type DateFilterModel,
  type FilterKind,
  type MultiFilterModel,
  type NumberFilterModel,
  type SetFilterModel,
  type SimpleFilterModel,
  type TextFilterModel,
  type UniqueValue,
} from "@megagrid/core";

export interface FilterPopupHandlers {
  getModel(field: string): ColumnFilterModel | undefined;
  setModel(field: string, model: ColumnFilterModel | null): void;
}

export class FilterPopup {
  private el: HTMLElement;
  private onDoc = (e: MouseEvent) => {
    if (!this.el.contains(e.target as Node) && !this.anchor?.contains(e.target as Node)) this.close();
  };
  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.close();
  };
  private anchor: HTMLElement | null = null;
  private field = "";
  private kind: FilterKind = "text";
  private store: ColumnStore | null = null;
  private def: ColumnDef | null = null;
  private handlers: FilterPopupHandlers | null = null;

  constructor(private readonly host: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "mg-filter-popup";
    this.el.hidden = true;
    host.appendChild(this.el);
  }

  get openField(): string | null {
    return this.el.hidden ? null : this.field;
  }

  open(args: {
    anchor: HTMLElement;
    def: ColumnDef;
    store: ColumnStore;
    handlers: FilterPopupHandlers;
  }): void {
    this.anchor = args.anchor;
    this.def = args.def;
    this.store = args.store;
    this.handlers = args.handlers;
    this.field = args.def.field;
    this.kind = defaultFilterKind(args.def.type, args.def.filter);
    this.render();
    this.el.hidden = false;
    this.position();
    document.addEventListener("mousedown", this.onDoc, true);
    document.addEventListener("keydown", this.onKey, true);
  }

  close(): void {
    this.el.hidden = true;
    this.anchor = null;
    document.removeEventListener("mousedown", this.onDoc, true);
    document.removeEventListener("keydown", this.onKey, true);
  }

  destroy(): void {
    this.close();
    this.el.remove();
  }

  private position(): void {
    const anchor = this.anchor;
    const host = this.host;
    if (!anchor) return;
    const ar = anchor.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    let left = ar.left - hr.left;
    const top = ar.bottom - hr.top + 4;
    const width = this.kind === "set" || this.kind === "multi" ? 320 : 280;
    if (left + width > hr.width - 8) left = Math.max(8, hr.width - width - 8);
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.style.width = `${width}px`;
  }

  private model(): ColumnFilterModel | undefined {
    return this.handlers?.getModel(this.field);
  }

  private push(model: ColumnFilterModel | null): void {
    this.handlers?.setModel(this.field, model);
  }

  private render(): void {
    const kind = this.kind;
    const model = this.model();
    this.el.innerHTML = "";
    if (kind === "multi") this.renderMulti(model);
    else if (kind === "set") this.renderSet(this.setModel(model));
    else if (kind === "number") this.renderSimple("number", model);
    else if (kind === "date") this.renderSimple("date", model);
    else this.renderSimple("text", model);
  }

  private renderMulti(model: ColumnFilterModel | undefined): void {
    const multi: MultiFilterModel = model?.filterType === "multi"
      ? model
      : { filterType: "multi", filterModels: [this.pick(model, "text"), this.pick(model, "set")] };
    const tabs = el("div", "mg-filter-tabs");
    const textBtn = tabBtn("Filter", true);
    const setBtn = tabBtn("Set", false);
    tabs.append(textBtn, setBtn);
    const body = el("div", "mg-filter-tab-body");
    const textPane = el("div", "");
    const setPane = el("div", "");
    setPane.hidden = true;
    this.fillSimple(textPane, "text", multi.filterModels[0] ?? null, (next) => {
      multi.filterModels[0] = next;
      this.push(normalizeMulti(multi));
    });
    this.fillSet(setPane, this.setModel(multi.filterModels[1] ?? undefined), (next) => {
      multi.filterModels[1] = next;
      this.push(normalizeMulti(multi));
    });
    textBtn.addEventListener("click", () => {
      textBtn.classList.add("on");
      setBtn.classList.remove("on");
      textPane.hidden = false;
      setPane.hidden = true;
    });
    setBtn.addEventListener("click", () => {
      setBtn.classList.add("on");
      textBtn.classList.remove("on");
      setPane.hidden = false;
      textPane.hidden = true;
    });
    body.append(textPane, setPane);
    this.el.append(tabs, body, this.resetBar(() => {
      this.push(null);
      this.render();
    }));
  }

  private renderSimple(kind: "text" | "number" | "date", model: ColumnFilterModel | undefined): void {
    const pane = el("div", "");
    this.fillSimple(pane, kind, model ?? null, (next) => this.push(next));
    this.el.append(pane, this.resetBar(() => {
      this.push(null);
      this.render();
    }));
  }

  private renderSet(model: SetFilterModel | null): void {
    const pane = el("div", "");
    this.fillSet(pane, model, (next) => this.push(next));
    this.el.append(pane, this.resetBar(() => {
      this.push(null);
      this.render();
    }));
  }

  private fillSimple(
    pane: HTMLElement,
    kind: "text" | "number" | "date",
    model: ColumnFilterModel | null,
    onChange: (model: ColumnFilterModel | null) => void,
  ): void {
    const conditions = splitConditions(kind, model);
    while (conditions.length < 2) conditions.push(emptySimple(kind));
    let join: "AND" | "OR" = model && "operator" in model ? model.operator : "AND";
    const push = (nextJoin: "AND" | "OR", next: SimpleFilterModel[]) => {
      join = nextJoin;
      onChange(joinModel(kind, nextJoin, next));
    };
    conditions.forEach((cond, i) => {
      if (i > 0) {
        const row = el("div", "mg-filter-join");
        const andB = tabBtn("AND", join === "AND");
        const orB = tabBtn("OR", join === "OR");
        andB.addEventListener("click", () => {
          andB.classList.add("on");
          orB.classList.remove("on");
          push("AND", conditions);
        });
        orB.addEventListener("click", () => {
          orB.classList.add("on");
          andB.classList.remove("on");
          push("OR", conditions);
        });
        row.append(andB, orB);
        pane.appendChild(row);
      }
      pane.appendChild(this.conditionRow(kind, cond, (c) => {
        conditions[i] = c;
        push(join, conditions);
      }));
    });
  }

  private conditionRow(
    kind: "text" | "number" | "date",
    cond: SimpleFilterModel,
    onChange: (c: SimpleFilterModel) => void,
  ): HTMLElement {
    let current = cond;
    const row = el("div", "mg-filter-cond");
    const select = document.createElement("select");
    const options = kind === "text" ? TEXT_OPTIONS : NUMBER_OPTIONS;
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt.key;
      o.textContent = opt.label;
      if (opt.key === current.type) o.selected = true;
      select.appendChild(o);
    }
    const values = el("div", "mg-filter-values");
    const emit = (next: SimpleFilterModel) => {
      current = next;
      onChange(current);
    };
    const paintValues = () => {
      values.innerHTML = "";
      if (!needsValueInput(current.type)) return;
      if (kind === "date") {
        const d = current as DateFilterModel;
        values.appendChild(dateInput(d.dateFrom ?? "", (v) => emit({ ...d, type: current.type as DateFilterModel["type"], dateFrom: v || null })));
        if (needsSecondInput(current.type)) {
          values.appendChild(dateInput(d.dateTo ?? "", (v) => emit({ ...(current as DateFilterModel), dateTo: v || null })));
        }
      } else if (kind === "number") {
        const n = current as NumberFilterModel;
        values.appendChild(numInput(n.filter, (v) => emit({ ...n, type: current.type as NumberFilterModel["type"], filter: v })));
        if (needsSecondInput(current.type)) {
          values.appendChild(numInput(n.filterTo, (v) => emit({ ...(current as NumberFilterModel), filterTo: v })));
        }
      } else {
        const t = current as TextFilterModel;
        const input = document.createElement("input");
        input.value = t.filter ?? "";
        input.placeholder = "Filter…";
        input.addEventListener("keydown", (e) => e.stopPropagation());
        input.addEventListener("input", () => emit({ ...t, type: current.type as TextFilterModel["type"], filter: input.value }));
        values.appendChild(input);
      }
    };
    select.addEventListener("change", () => {
      const type = select.value as SimpleFilterModel["type"];
      emit({ ...current, type } as SimpleFilterModel);
      paintValues();
    });
    select.addEventListener("keydown", (e) => e.stopPropagation());
    row.append(select, values);
    paintValues();
    return row;
  }

  private fillSet(
    pane: HTMLElement,
    model: SetFilterModel | null,
    onChange: (model: SetFilterModel | null) => void,
  ): void {
    const store = this.store;
    const field = this.field;
    if (!store) return;
    const uniques = store.uniqueValues(field);
    const allKeys = uniques.map(valueKey);
    const selected = new Set<string>();
    if (model) {
      for (const v of model.values) selected.add(v == null ? "__blank__" : String(v));
    } else {
      for (const k of allKeys) selected.add(k);
    }

    const mini = document.createElement("input");
    mini.className = "mg-set-mini";
    mini.placeholder = "Search values…";
    mini.addEventListener("keydown", (e) => e.stopPropagation());

    const list = el("div", "mg-set-list");
    const selectAll = document.createElement("label");
    selectAll.className = "mg-set-row mg-set-all";
    const allBox = document.createElement("input");
    allBox.type = "checkbox";
    selectAll.append(allBox, document.createTextNode(" (Select All)"));
    const itemsWrap = el("div", "mg-set-items");
    list.append(selectAll, itemsWrap);

    const applyFromSelected = () => {
      if (selected.size === allKeys.length) onChange(null);
      else {
        const values: SetFilterModel["values"] = [];
        for (const u of uniques) {
          if (selected.has(valueKey(u))) values.push(u.value);
        }
        onChange({ filterType: "set", values });
      }
    };

    const visible = () => {
      const q = mini.value.trim().toLowerCase();
      return q ? uniques.filter((u) => u.label.toLowerCase().includes(q)) : uniques;
    };

    const syncSelectAll = () => {
      const visKeys = visible().map(valueKey);
      allBox.checked = visKeys.length > 0 && visKeys.every((k) => selected.has(k));
      allBox.indeterminate = false;
    };

    const syncItemBoxes = () => {
      itemsWrap.querySelectorAll<HTMLInputElement>("input[data-key]").forEach((box) => {
        box.checked = selected.has(box.dataset.key ?? "");
      });
    };

    const paintList = () => {
      const items = visible();
      itemsWrap.innerHTML = "";
      const max = 400;
      for (const u of items.slice(0, max)) {
        const row = document.createElement("label");
        row.className = "mg-set-row";
        const box = document.createElement("input");
        box.type = "checkbox";
        const key = valueKey(u);
        box.dataset.key = key;
        box.checked = selected.has(key);
        box.addEventListener("change", () => {
          if (box.checked) selected.add(key);
          else selected.delete(key);
          syncSelectAll();
          applyFromSelected();
        });
        const count = document.createElement("span");
        count.className = "mg-set-count";
        count.textContent = String(u.count);
        row.append(box, document.createTextNode(` ${u.label}`), count);
        itemsWrap.appendChild(row);
      }
      if (items.length > max) {
        const more = el("div", "mg-set-more");
        more.textContent = `${(items.length - max).toLocaleString()} more — refine search`;
        itemsWrap.appendChild(more);
      }
      syncSelectAll();
    };

    allBox.addEventListener("change", () => {
      const items = visible();
      if (allBox.checked) for (const u of items) selected.add(valueKey(u));
      else for (const u of items) selected.delete(valueKey(u));
      syncItemBoxes();
      syncSelectAll();
      applyFromSelected();
    });
    mini.addEventListener("input", paintList);
    pane.append(mini, list);
    paintList();
  }

  private resetBar(onReset: () => void): HTMLElement {
    const bar = el("div", "mg-filter-actions");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Reset";
    btn.addEventListener("click", onReset);
    bar.appendChild(btn);
    return bar;
  }

  private setModel(model: ColumnFilterModel | undefined | null): SetFilterModel | null {
    if (!model) return null;
    if (model.filterType === "set") return model;
    if (model.filterType === "multi") {
      const inner = model.filterModels.find((m) => m?.filterType === "set");
      return inner?.filterType === "set" ? inner : null;
    }
    return null;
  }

  private pick(model: ColumnFilterModel | undefined, type: "text" | "set"): ColumnFilterModel | null {
    if (!model) return null;
    if (model.filterType === type) return model;
    if (model.filterType === "multi") {
      return model.filterModels.find((m) => m?.filterType === type) ?? null;
    }
    if (type === "text" && (model.filterType === "text" || isCombined(model))) return model;
    return null;
  }
}

function isCombined(model: ColumnFilterModel): boolean {
  return "operator" in model;
}

function splitConditions(kind: "text" | "number" | "date", model: ColumnFilterModel | null): SimpleFilterModel[] {
  if (!model) return [emptySimple(kind)];
  if (model.filterType === "multi") {
    const inner = model.filterModels.find((m) => m && m.filterType === kind);
    return splitConditions(kind, inner ?? null);
  }
  if (model.filterType !== kind && !("operator" in model && model.filterType === kind)) {
    if ("operator" in model && (model as CombinedFilterModel<SimpleFilterModel>).filterType === kind) {
      return (model as CombinedFilterModel<SimpleFilterModel>).conditions.length
        ? (model as CombinedFilterModel<SimpleFilterModel>).conditions
        : [emptySimple(kind)];
    }
    if (model.filterType === kind) return [model as SimpleFilterModel];
    return [emptySimple(kind)];
  }
  if ("operator" in model) {
    const c = model as CombinedFilterModel<SimpleFilterModel>;
    const list = c.conditions?.length ? c.conditions : [c.condition1, c.condition2].filter(Boolean) as SimpleFilterModel[];
    return list.length ? list : [emptySimple(kind)];
  }
  return [model as SimpleFilterModel];
}

function joinModel(
  kind: "text" | "number" | "date",
  operator: "AND" | "OR",
  conditions: SimpleFilterModel[],
): ColumnFilterModel | null {
  const active = conditions.filter((c) => isFilterActive(c));
  if (!active.length) return null;
  if (active.length === 1) return active[0]!;
  return { filterType: kind, operator, conditions: active } as ColumnFilterModel;
}

function emptySimple(kind: "text" | "number" | "date"): SimpleFilterModel {
  if (kind === "number") return { filterType: "number", type: "equals", filter: null };
  if (kind === "date") return { filterType: "date", type: "equals", dateFrom: null };
  return { filterType: "text", type: "contains", filter: "" };
}

function normalizeMulti(multi: MultiFilterModel): ColumnFilterModel | null {
  const parts = multi.filterModels.map((m) => (isFilterActive(m) ? m : null));
  if (!parts.some(Boolean)) return null;
  return { filterType: "multi", filterModels: parts };
}

function valueKey(u: UniqueValue): string {
  return u.value == null ? "__blank__" : String(u.value);
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function tabBtn(label: string, on: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.className = `mg-tab${on ? " on" : ""}`;
  return b;
}

function numInput(value: number | null | undefined, onChange: (v: number | null) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.value = value == null ? "" : String(value);
  input.addEventListener("keydown", (e) => e.stopPropagation());
  input.addEventListener("input", () => {
    const n = input.value === "" ? null : Number(input.value);
    onChange(n != null && Number.isFinite(n) ? n : null);
  });
  return input;
}

function dateInput(value: string, onChange: (v: string) => void): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "date";
  input.value = value ?? "";
  input.addEventListener("keydown", (e) => e.stopPropagation());
  input.addEventListener("change", () => onChange(input.value));
  input.addEventListener("input", () => onChange(input.value));
  return input;
}
