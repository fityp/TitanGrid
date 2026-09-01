import type { BoundTree } from "../bind.ts";
import type { DisplayRow, GroupRow } from "../types.ts";

export function applyTree(
  tree: BoundTree,
  visible: Uint32Array,
  expanded: ReadonlySet<string>,
  label: (row: number) => string,
): { rows: DisplayRow[]; allIds: string[] } {
  const n = tree.parent.length;
  const show = new Uint8Array(n);
  for (let i = 0; i < visible.length; i++) {
    let row = visible[i] as number;
    while (row >= 0 && !show[row]) {
      show[row] = 1;
      row = tree.parent[row]!;
    }
  }

  const allIds: string[] = [];
  const rows: DisplayRow[] = [];

  const walk = (i: number) => {
    if (!show[i]) return;
    const kids = tree.children[i] ?? [];
    const id = `t:${i}`;
    const hasKids = kids.length > 0;
    if (hasKids) {
      allIds.push(id);
      const isExpanded = expanded.has(id);
      const count = subtreeShown(i, tree, show);
      rows.push({
        kind: "group",
        id,
        field: "",
        key: label(i),
        depth: tree.depths[i] ?? 0,
        count,
        expanded: isExpanded,
        aggregates: {},
        sourceIndex: i,
      } satisfies GroupRow);
      if (isExpanded) for (const c of kids) walk(c);
    } else {
      rows.push({
        kind: "leaf",
        id: String(i),
        sourceIndex: i,
        depth: tree.depths[i] ?? 0,
      });
    }
  };

  for (let i = 0; i < n; i++) {
    if (tree.parent[i] === -1) walk(i);
  }
  return { rows, allIds };
}

function subtreeShown(i: number, tree: BoundTree, show: Uint8Array): number {
  let n = 0;
  const stack = [...(tree.children[i] ?? [])];
  while (stack.length) {
    const c = stack.pop()!;
    if (!show[c]) continue;
    n++;
    const kids = tree.children[c];
    if (kids) for (const k of kids) stack.push(k);
  }
  return n || 1;
}