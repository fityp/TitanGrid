import type { ResolvedIcon } from "@titangrid/core";

export interface IconBox {
  icon: ResolvedIcon;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function layoutCellIcons(args: {
  icons: ResolvedIcon[];
  text: string;
  textWidth: number;
  cellX: number;
  cellWidth: number;
  rowY: number;
  rowHeight: number;
  fontSize: number;
  align: "left" | "center" | "right";
  indent: number;
  pad: number;
  measure?: (text: string) => number;
}): { boxes: IconBox[]; textX: number; showText: boolean } {
  const {
    icons,
    text,
    textWidth,
    cellX,
    cellWidth,
    rowY,
    rowHeight,
    fontSize,
    align,
    indent,
    pad,
    measure,
  } = args;
  const measureFn = measure ?? ((s: string) => s.length * fontSize * 0.55);
  const showText = !icons.some((ic) => ic.placement === "replace") && text.length > 0;
  const befores = showText ? icons.filter((ic) => ic.placement !== "after") : icons;
  const afters = showText ? icons.filter((ic) => ic.placement === "after") : [];
  const beforeMetrics = befores.map((ic) => iconMetrics(ic, fontSize, measureFn));
  const afterMetrics = afters.map((ic) => iconMetrics(ic, fontSize, measureFn));
  const gap = 4;
  const textGap = 4;
  const beforeW = stackWidth(beforeMetrics, gap);
  const afterW = stackWidth(afterMetrics, gap);
  const beforeBlock = beforeW ? beforeW + (showText ? textGap : 0) : 0;
  const afterBlock = afterW ? afterW + (showText ? textGap : 0) : 0;
  const contentW = beforeBlock + (showText ? textWidth : 0) + afterBlock;

  let start: number;
  if (align === "right") start = cellX + cellWidth - pad - contentW;
  else if (align === "center") start = cellX + (cellWidth - contentW) / 2;
  else start = cellX + pad + indent;

  const boxes: IconBox[] = [];
  let x = start;
  for (let i = 0; i < befores.length; i++) {
    const m = beforeMetrics[i]!;
    boxes.push({
      icon: befores[i]!,
      x,
      y: rowY + (rowHeight - m.height) / 2,
      width: m.width,
      height: m.height,
    });
    x += m.width + gap;
  }
  if (beforeW) x += showText ? textGap - gap : -gap;
  const textX = x;
  if (showText) x += textWidth + (afterW ? textGap : 0);
  for (let i = 0; i < afters.length; i++) {
    const m = afterMetrics[i]!;
    boxes.push({
      icon: afters[i]!,
      x,
      y: rowY + (rowHeight - m.height) / 2,
      width: m.width,
      height: m.height,
    });
    x += m.width + gap;
  }
  return { boxes, textX, showText };
}

export function iconAtPoint(boxes: IconBox[], x: number, y: number): ResolvedIcon | null {
  for (const box of boxes) {
    if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) return box.icon;
  }
  return null;
}

function stackWidth(items: { width: number }[], gap: number): number {
  if (!items.length) return 0;
  let w = 0;
  for (let i = 0; i < items.length; i++) w += items[i]!.width + (i ? gap : 0);
  return w;
}

function iconMetrics(
  icon: ResolvedIcon,
  fontSize: number,
  measure: (text: string) => number,
): { width: number; height: number } {
  const size = Math.max(8, Math.round(fontSize));
  if (!icon.label) return { width: size, height: size };
  const padX = 8;
  const img = icon.url ? size + 4 : 0;
  return {
    width: padX * 2 + img + measure(icon.label),
    height: Math.max(size + 2, Math.round(fontSize) + 6),
  };
}
