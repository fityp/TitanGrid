import type { ColumnDef, PinSide } from "@megagrid/core";

export const ROW_NUMBER_FIELD = "__rownum";

export interface LaidOutColumn {
  def: ColumnDef;
  index: number;
  x: number;
  width: number;
  pinned: PinSide | false;
  align: "left" | "center" | "right";
}

export class ColumnLayout {
  left: LaidOutColumn[] = [];
  center: LaidOutColumn[] = [];
  right: LaidOutColumn[] = [];
  all: LaidOutColumn[] = [];
  leftWidth = 0;
  centerWidth = 0;
  rightWidth = 0;
  totalWidth = 0;

  rebuild(columns: ColumnDef[]): void {
    this.left = [];
    this.center = [];
    this.right = [];
    this.all = [];
    let i = 0;
    for (const def of columns) {
      if (def.hide) continue;
      const col: LaidOutColumn = {
        def,
        index: i++,
        x: 0,
        width: def.width ?? 120,
        pinned: def.pinned ?? false,
        align: def.align ?? (def.type === "number" ? "right" : "left"),
      };
      if (col.pinned === "left") this.left.push(col);
      else if (col.pinned === "right") this.right.push(col);
      else this.center.push(col);
      this.all.push(col);
    }
    this.reflow();
  }

  reflow(): void {
    this.leftWidth = pack(this.left);
    this.centerWidth = pack(this.center);
    this.rightWidth = pack(this.right);
    this.totalWidth = this.leftWidth + this.centerWidth + this.rightWidth;
  }

  setWidth(index: number, width: number): void {
    const col = this.all[index];
    if (!col) return;
    const min = col.def.minWidth ?? 48;
    const max = col.def.maxWidth ?? 800;
    col.width = Math.max(min, Math.min(max, width));
    col.def.width = col.width;
    this.reflow();
  }

  columnAtVisualX(visualX: number, scrollLeft: number, viewportWidth: number): LaidOutColumn | null {
    if (visualX < this.leftWidth) {
      return hit(this.left, visualX);
    }
    const rightStart = viewportWidth - this.rightWidth;
    if (this.rightWidth && visualX >= rightStart) {
      return hit(this.right, visualX - rightStart);
    }
    return hit(this.center, visualX - this.leftWidth + scrollLeft);
  }

  xForColumn(col: LaidOutColumn, scrollLeft: number, viewportWidth: number): number {
    if (col.pinned === "left") return col.x;
    if (col.pinned === "right") return viewportWidth - this.rightWidth + col.x;
    return this.leftWidth + col.x - scrollLeft;
  }

  visibleCenterRange(scrollLeft: number, viewportWidth: number): { start: number; end: number } {
    const x0 = scrollLeft;
    const x1 = scrollLeft + Math.max(0, viewportWidth - this.leftWidth - this.rightWidth);
    let start = 0;
    let end = this.center.length;
    for (let i = 0; i < this.center.length; i++) {
      const c = this.center[i]!;
      if (c.x + c.width >= x0) {
        start = i;
        break;
      }
    }
    for (let i = this.center.length - 1; i >= 0; i--) {
      const c = this.center[i]!;
      if (c.x <= x1) {
        end = i + 1;
        break;
      }
    }
    return { start, end };
  }
}

function pack(cols: LaidOutColumn[]): number {
  let x = 0;
  for (const col of cols) {
    col.x = x;
    x += col.width;
  }
  return x;
}

function hit(cols: LaidOutColumn[], x: number): LaidOutColumn | null {
  for (const col of cols) {
    if (x >= col.x && x < col.x + col.width) return col;
  }
  return null;
}
