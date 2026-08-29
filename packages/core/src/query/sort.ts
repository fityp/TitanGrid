import type { ColumnStore } from "../store.ts";
import type { Sort } from "../types.ts";

export function applySort(store: ColumnStore, indices: Uint32Array, sorts: Sort[]): Uint32Array {
  if (!sorts.length) return indices;
  const n = indices.length;
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = indices[i] as number;

  const comparators = sorts.map((sort) => {
    const vec = store.vector(sort.field);
    const dir = sort.dir === "desc" ? -1 : 1;
    if (vec?.kind === "number") {
      return (a: number, b: number) => {
        const na = vec.nulls[a];
        const nb = vec.nulls[b];
        if (na && nb) return 0;
        if (na) return 1;
        if (nb) return -1;
        const d = (vec.values[a] as number) - (vec.values[b] as number);
        if (d < 0) return -dir;
        if (d > 0) return dir;
        return 0;
      };
    }
    if (vec?.kind === "string") {
      return (a: number, b: number) => {
        const sa = store.getString(sort.field, a);
        const sb = store.getString(sort.field, b);
        if (sa === sb) return 0;
        return (sa < sb ? -1 : 1) * dir;
      };
    }
    if (vec?.kind === "date") {
      return (a: number, b: number) => {
        const na = vec.nulls[a];
        const nb = vec.nulls[b];
        if (na && nb) return 0;
        if (na) return 1;
        if (nb) return -1;
        const d = (vec.values[a] as number) - (vec.values[b] as number);
        if (d < 0) return -dir;
        if (d > 0) return dir;
        return 0;
      };
    }
    return (a: number, b: number) => {
      const sa = store.getString(sort.field, a);
      const sb = store.getString(sort.field, b);
      if (sa === sb) return 0;
      return (sa < sb ? -1 : 1) * dir;
    };
  });

  order.sort((a, b) => {
    for (let i = 0; i < comparators.length; i++) {
      const c = comparators[i]!(a, b);
      if (c) return c;
    }
    return a - b;
  });

  return order;
}
