import type { CellStyle, ColumnDef, ColumnStore, DisplayRow, QueryEngine, ResolvedIcon } from "@titangrid/core";
import { formatDate, hasIcons, resolveIcons } from "@titangrid/core";
import type { IconImageCache } from "./icon-cache.ts";
import { layoutCellIcons } from "./icon-layout.ts";
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
  icons?: IconImageCache;
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
        paintCell(frame, col, x, y, text, display.sourceIndex, 0);
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
    const leafIndent =
      display.depth && col.index === firstDataColIndex(frame.layout) && col.align === "left"
        ? display.depth * 16
        : 0;
    paintCell(frame, col, x, y, text, display.sourceIndex, leafIndent);
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
  const label = `${display.key}  (${display.count.toLocaleString()})`;
  const iconStart = x + indent + 12;
  let textXPos = iconStart;
  if (display.icons?.length && frame.icons) {
    const size = Math.max(8, Math.round(theme.fontSize));
    for (let i = 0; i < display.icons.length; i++) {
      const img = frame.icons.get(display.icons[i]!);
      if (img) drawContained(ctx, img, textXPos, y + (rowHeight - size) / 2, size);
      textXPos += size + 4;
    }
  }
  ctx.fillStyle = theme.text;
  ctx.textAlign = "left";
  ctx.font = `600 ${theme.fontSize}px ${theme.headerFont}`;
  ctx.fillText(label, textXPos, cy);
  ctx.font = `${theme.fontSize}px ${theme.font}`;
  void width;
}

function paintCell(
  frame: RenderFrame,
  col: LaidOutColumn,
  x: number,
  y: number,
  text: string,
  sourceIndex: number,
  indent: number,
): void {
  const { ctx, theme, rowHeight, store } = frame;
  const pad = 10;
  const raw = store.get(col.def.field, sourceIndex);
  const style = resolveCellStyle(col.def.cellStyle, raw, sourceIndex);
  const icons: ResolvedIcon[] = hasIcons(col.def) ? resolveIcons(store, col.def, sourceIndex) : [];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 2, y, col.width - 4, rowHeight);
  ctx.clip();
  if (style?.background && !style.pill) {
    ctx.fillStyle = style.background;
    ctx.fillRect(x, y, col.width, rowHeight);
  }
  ctx.fillStyle = style?.color || theme.text;
  ctx.textAlign = "left";
  if (!icons.length) {
    const cy = y + rowHeight / 2;
    if (style?.pill && text) {
      const w = ctx.measureText(text).width;
      const tx = textX(x, col.width, pad, col.align) + indent;
      const left = col.align === "right" ? tx - w : col.align === "center" ? tx - w / 2 : tx;
      drawPill(ctx, left - 6, y + 4, w + 12, rowHeight - 8, style.background || theme.selectionFill);
      ctx.fillStyle = style.color || theme.text;
    }
    ctx.textAlign = col.align;
    ctx.fillText(text, textX(x, col.width, pad, col.align) + indent, cy);
    ctx.restore();
    return;
  }
  const textWidth = text ? ctx.measureText(text).width : 0;
  const layout = layoutCellIcons({
    icons,
    text,
    textWidth,
    cellX: x,
    cellWidth: col.width,
    rowY: y,
    rowHeight,
    fontSize: theme.fontSize,
    align: col.align,
    indent,
    pad,
    measure: (s) => ctx.measureText(s).width,
  });
  for (const box of layout.boxes) drawIconBox(frame, box);
  if (layout.showText) {
    if (style?.pill && text) {
      const w = textWidth;
      drawPill(ctx, layout.textX - 6, y + 4, w + 12, rowHeight - 8, style.background || theme.selectionFill);
      ctx.fillStyle = style.color || theme.text;
    }
    ctx.fillText(text, layout.textX, y + rowHeight / 2);
  }
  ctx.restore();
}

function drawIconBox(frame: RenderFrame, box: { icon: ResolvedIcon; x: number; y: number; width: number; height: number }): void {
  const { ctx, theme } = frame;
  const { icon, x, y, width, height } = box;
  if (icon.label) {
    drawPill(ctx, x, y, width, height, icon.background || theme.accent);
    let contentX = x + 8;
    if (icon.url && frame.icons) {
      const img = frame.icons.get(icon.url);
      const size = Math.max(8, Math.round(theme.fontSize));
      if (img) drawContained(ctx, img, contentX, y + (height - size) / 2, size);
      contentX += size + 4;
    }
    ctx.fillStyle = icon.color || "#fff";
    ctx.textAlign = "left";
    ctx.fillText(icon.label, contentX, y + height / 2);
    return;
  }
  if (!icon.url || !frame.icons) return;
  const img = frame.icons.get(icon.url);
  if (img) drawContained(ctx, img, x, y, Math.min(width, height));
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
): void {
  const r = Math.min(8, h / 2);
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

function resolveCellStyle(
  spec: ColumnDef["cellStyle"],
  value: unknown,
  sourceIndex: number,
): CellStyle | undefined {
  if (!spec) return undefined;
  if (typeof spec === "function") return spec(value, sourceIndex) ?? undefined;
  return spec;
}

function drawContained(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number,
): void {
  const nw = img.naturalWidth || size;
  const nh = img.naturalHeight || size;
  const r = nw / nh;
  let w = size;
  let h = size;
  if (r > 1) h = size / r;
  else w = size * r;
  ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
}

function textX(x: number, width: number, pad: number, align: LaidOutColumn["align"]): number {
  if (align === "right") return x + width - pad;
  if (align === "center") return x + width / 2;
  return x + pad;
}

function formatValue(value: unknown, col: LaidOutColumn): string {
  if (value == null || value === "") return "";
  if (col.def.type === "date" && typeof value === "number") return formatDate(value);
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
