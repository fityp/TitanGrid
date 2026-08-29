import type { CellCoord, CellRange } from "./types.ts";

export class SelectionModel {
  focus: CellCoord = { row: 0, col: 0 };
  range: CellRange | null = null;
  anchor: CellCoord | null = null;

  clear(): void {
    this.range = null;
    this.anchor = null;
  }

  setFocus(row: number, col: number, extend = false): void {
    if (extend && this.anchor) {
      this.focus = { row, col };
      this.range = normalize(this.anchor, this.focus);
    } else {
      this.focus = { row, col };
      this.anchor = { row, col };
      this.range = { r0: row, c0: col, r1: row, c1: col };
    }
  }

  startDrag(row: number, col: number): void {
    this.anchor = { row, col };
    this.focus = { row, col };
    this.range = { r0: row, c0: col, r1: row, c1: col };
  }

  dragTo(row: number, col: number): void {
    if (!this.anchor) this.startDrag(row, col);
    else {
      this.focus = { row, col };
      this.range = normalize(this.anchor, this.focus);
    }
  }

  contains(row: number, col: number): boolean {
    const r = this.range;
    if (!r) return false;
    return row >= r.r0 && row <= r.r1 && col >= r.c0 && col <= r.c1;
  }

  isFocus(row: number, col: number): boolean {
    return this.focus.row === row && this.focus.col === col;
  }

  clamp(rowCount: number, colCount: number): void {
    if (rowCount <= 0 || colCount <= 0) {
      this.focus = { row: 0, col: 0 };
      this.range = null;
      return;
    }
    this.focus.row = clamp(this.focus.row, 0, rowCount - 1);
    this.focus.col = clamp(this.focus.col, 0, colCount - 1);
    if (this.anchor) {
      this.anchor.row = clamp(this.anchor.row, 0, rowCount - 1);
      this.anchor.col = clamp(this.anchor.col, 0, colCount - 1);
      this.range = normalize(this.anchor, this.focus);
    }
  }

  move(dRow: number, dCol: number, extend: boolean, rowCount: number, colCount: number): void {
    const row = clamp(this.focus.row + dRow, 0, Math.max(0, rowCount - 1));
    const col = clamp(this.focus.col + dCol, 0, Math.max(0, colCount - 1));
    this.setFocus(row, col, extend);
  }
}

function normalize(a: CellCoord, b: CellCoord): CellRange {
  return {
    r0: Math.min(a.row, b.row),
    c0: Math.min(a.col, b.col),
    r1: Math.max(a.row, b.row),
    c1: Math.max(a.col, b.col),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
