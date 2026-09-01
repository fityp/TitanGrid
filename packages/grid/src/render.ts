import type { ColumnStore, DisplayRow, QueryEngine } from "@megagrid/core";
import type { ColumnLayout, LaidOutColumn } from "./layout.ts";
import { ROW_NUMBER_FIELD } from "./layout.ts";
import type { SelectionModel } from "./selection.ts";
import type { Theme } from "./types.ts";

const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export interface RenderFrame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  scrollLeft: number;
  scrollTop: number;
  rowHeight: number;
  rowCount: number;
  layout: ColumnLayout;
  engine: QueryEngine;
  store: ColumnStore;
  selection: SelectionModel;
  hoverRow: number;
  theme: Theme;
}

export function renderFrame(frame: RenderFrame): void {
  const { ctx, width, height, theme, rowHeight, rowCount, scrollTop, layout } = frame;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);

  if (rowCount === 0) {
    ctx.fillStyle = theme.textMuted;
    ctx.font = `${theme.fontSize}px ${theme.font}`;
    ctx.textBaseline = "middle";
    ctx.fillText("No rows", 16, height / 2);
    return;
  }

  const rowStart = Math.max(0, Math.floor(scrollTop / rowHeight));
  const rowEnd = Math.min(rowCount, Math.ceil((scrollTop + height) / rowHeight) + 1);
  const centerRange = layout.visibleCenterRange(frame.scrollLeft, width);

  const cols: LaidOutColumn[] = [
    ...layout.left,
    ...layout.center.slice(centerRange.start, centerRange.end),
    ...layout.right,
  ];

  ctx.save();
  ctx.font = `${theme.fontSize}px ${theme.font}`;
  ctx.textBaseline = "middle";

  for (let r = rowStart; r < rowEnd; r++) {
    const y = r * rowHeight - scrollTop;
    const display = frame.engine.displayRowAt(r);
    const isGroup = display?.kind === "group";
    const alt = !isGroup && r % 2 === 1;
    ctx.fillStyle = isGroup ? theme.groupRow : alt ? theme.altRow : theme.bg;
    ctx.fillRect(0, y, width, rowHeight);

    if (frame.hoverRow === r && !isGroup) {
      ctx.fillStyle = theme.hoverFill;
      ctx.fillRect(0, y, width, rowHeight);
    }

    for (const col of cols) {
      const x = layout.xForColumn(col, frame.scrollLeft, width);
      if (frame.selection.contains(r, col.index) && !isGroup) {
        ctx.fillStyle = theme.selectionFill;
        ctx.fillRect(x, y, col.width, rowHeight);
      }
    }
  }

  for (const col of cols) {
    const x = layout.xForColumn(col, frame.scrollLeft, width);
    if (x + col.width < 0 || x > width) continue;
    paintColumn(frame, col, x, rowStart, rowEnd);
  }

  // Grid lines
  ctx.strokeStyle = theme.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let r = rowStart; r <= rowEnd; r++) {
    const y = Math.round(r * rowHeight - scrollTop) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  for (const col of cols) {
    const x = Math.round(layout.xForColumn(col, frame.scrollLeft, width) + col.width) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  ctx.stroke();

  // Focus ring
  const focusCol = layout.all[frame.selection.focus.col];
  const focusRow = frame.selection.focus.row;
  if (focusCol && focusRow >= rowStart && focusRow < rowEnd) {
    const x = layout.xForColumn(focusCol, frame.scrollLeft, width);
    const y = focusRow * rowHeight - scrollTop;
    ctx.strokeStyle = theme.focusBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, focusCol.width - 2, rowHeight - 2);
  }

  // Pinned shadows
  if (layout.leftWidth) {
    const g = ctx.createLinearGradient(layout.leftWidth, 0, layout.leftWidth + 10, 0);
    g.addColorStop(0, "rgba(0,0,0,0.28)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(layout.leftWidth, 0, 10, height);
  }

  ctx.restore();
}

function paintColumn(
  frame: RenderFrame,
  col: LaidOutColumn,
  x: number,
  rowStart: number,
  rowEnd: number,
): void {
  const { ctx, theme, rowHeight, scrollTop, store, engine } = frame;
  const pad = 10;
  const field = col.def.field;

  for (let r = rowStart; r < rowEnd; r++) {
    const y = r * rowHeight - scrollTop;
    const display = engine.displayRowAt(r) as DisplayRow | null;
    if (!display) continue;
    const cy = y + rowHeight / 2;

    if (field === ROW_NUMBER_FIELD) {
      ctx.fillStyle = theme.textMuted;
      ctx.textAlign = "right";
      ctx.fillText(String(r + 1), x + col.width - pad, cy);
      continue;
    }

    if (display.kind === "group") {
      if (col.index === firstDataColIndex(frame.layout)) {
        drawGroupLabel(frame, display, x, y, col.width);
      } else if (display.sourceIndex != null) {
        const raw = store.get(field, display.sourceIndex);
        const text = col.def.format
          ? col.def.format(raw, display.sourceIndex)
          : formatValue(raw, col);
        ctx.fillStyle = theme.text;
        ctx.textAlign = col.align;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 2, y, col.width - 4, rowHeight);
        ctx.clip();
        ctx.fillText(text, textX(x, col.width, pad, col.align), cy);
        ctx.restore();
      } else if (display.aggregates[field] != null) {
        ctx.fillStyle = theme.text;
        ctx.textAlign = col.align;
        const tx = textX(x, col.width, pad, col.align);
        ctx.fillText(formatValue(display.aggregates[field], col), tx, cy);
      }
      continue;
    }

    if (col.def.type === "sparkline") {
      const pts = store.get(field, display.sourceIndex);
      if (pts instanceof Float64Array) drawSparkline(ctx, pts, x + 6, y + 6, col.width - 12, rowHeight - 12, theme);
      continue;
    }

    const raw = store.get(field, display.sourceIndex);
    const text = col.def.format
      ? col.def.format(raw, display.sourceIndex)
      : formatValue(raw, col);
    ctx.fillStyle = theme.text;
    ctx.textAlign = col.align;
    const leafIndent =
      display.depth && col.index === firstDataColIndex(frame.layout) && col.align === "left"
        ? display.depth * 16
        : 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y, col.width - 4, rowHeight);
    ctx.clip();
    ctx.fillText(text, textX(x, col.width, pad, col.align) + leafIndent, cy);
    ctx.restore();
  }
}

function firstDataColIndex(layout: ColumnLayout): number {
  const col = layout.all.find((c) => c.def.field !== ROW_NUMBER_FIELD);
  return col?.index ?? 0;
}

function drawGroupLabel(
  frame: RenderFrame,
  display: Extract<DisplayRow, { kind: "group" }>,
  x: number,
  y: number,
  width: number,
): void {
  const { ctx, theme, rowHeight } = frame;
  const indent = 12 + display.depth * 16;
  const cy = y + rowHeight / 2;
  ctx.fillStyle = theme.textMuted;
  ctx.beginPath();
  const cx = x + indent;
  if (display.expanded) {
    ctx.moveTo(cx - 4, cy - 2);
    ctx.lineTo(cx + 4, cy - 2);
    ctx.lineTo(cx, cy + 4);
  } else {
    ctx.moveTo(cx - 2, cy - 4);
    ctx.lineTo(cx + 4, cy);
    ctx.lineTo(cx - 2, cy + 4);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = theme.text;
  ctx.textAlign = "left";
  ctx.font = `600 ${theme.fontSize}px ${theme.headerFont}`;
  ctx.fillText(`${display.key}  (${display.count.toLocaleString()})`, x + indent + 12, cy);
  ctx.font = `${theme.fontSize}px ${theme.font}`;
  void width;
}

function textX(x: number, width: number, pad: number, align: LaidOutColumn["align"]): number {
  if (align === "right") return x + width - pad;
  if (align === "center") return x + width / 2;
  return x + pad;
}

function formatValue(value: unknown, col: LaidOutColumn): string {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (col.def.agg === "avg" || !Number.isInteger(value)) return numberFmt.format(value);
    return numberFmt.format(value);
  }
  return String(value);
}

function drawSparkline(
  ctx: CanvasRenderingContext2D,
  pts: Float64Array,
  x: number,
  y: number,
  w: number,
  h: number,
  theme: Theme,
): void {
  if (!pts.length || w <= 0 || h <= 0) return;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const v = pts[i] as number;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const px = x + (i / Math.max(1, pts.length - 1)) * w;
    const py = y + h - ((pts[i] as number) - min) / span * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  const up = (pts[pts.length - 1] as number) >= (pts[0] as number);
  ctx.strokeStyle = up ? theme.sparkPos : theme.sparkNeg;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}
