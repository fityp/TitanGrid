import {
  booleanVector,
  createColumnStore,
  dateVector,
  numberVector,
  stringVector,
  type BoundTree,
  type ColumnDef,
  type ColumnStore,
} from "@titangrid/core";
import { personName } from "./names.ts";

const REGIONS = [
  "Americas",
  "Europe",
  "Asia Pacific",
  "Middle East",
  "Africa",
  "Nordics",
  "DACH",
  "LATAM",
  "UKI",
  "ANZ",
];

const CITIES = [
  "Austin",
  "Berlin",
  "Tokyo",
  "Toronto",
  "Paris",
  "Sydney",
  "Dublin",
  "Seoul",
  "São Paulo",
  "Nairobi",
];

const STATUSES = ["Open", "Active", "Hold", "Closed"];

export const MEGA_ROWS = 1_000_000;
export const MEGA_COLS = 100;
export const MEGA_TEAMS = 5_000;

export type MegaDataset = {
  columns: ColumnDef[];
  store: ColumnStore;
  tree: BoundTree;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTree(n: number, teams: number): BoundTree {
  const parent = new Int32Array(n);
  const depths = new Uint8Array(n);
  const children: number[][] = Array.from({ length: n }, () => []);
  const perTeam = Math.floor(n / teams);
  let i = 0;
  for (let t = 0; t < teams && i < n; t++) {
    const root = i;
    parent[root] = -1;
    depths[root] = 0;
    i++;
    const take = t === teams - 1 ? n - i : perTeam - 1;
    for (let k = 0; k < take && i < n; k++) {
      parent[i] = root;
      depths[i] = 1;
      children[root]!.push(i);
      i++;
    }
  }
  while (i < n) {
    parent[i] = -1;
    depths[i] = 0;
    i++;
  }
  return { parent, children, depths };
}

export function generateMegaDataset(rowCount = MEGA_ROWS, teams = MEGA_TEAMS): MegaDataset {
  const n = rowCount;
  const tree = buildTree(n, teams);
  const rand = mulberry32(0x1e9a7e);
  const noise = new Float64Array(n);
  for (let i = 0; i < n; i++) noise[i] = rand();

  const teamOf = new Int32Array(n);
  let team = -1;
  for (let i = 0; i < n; i++) {
    if (tree.parent[i] === -1 && tree.children[i]!.length) team++;
    teamOf[i] = tree.parent[i] === -1 ? (tree.children[i]!.length ? team : Math.max(0, team)) : (teamOf[tree.parent[i]!] ?? 0);
  }

  const named: ColumnDef[] = [
    { field: "id", header: "ID", type: "number", width: 88, pinned: "left", filter: "number", editable: false },
    { field: "name", header: "Name", type: "string", width: 168, pinned: "left", filter: "text" },
    { field: "team", header: "Team", type: "string", width: 140, filter: "set" },
    { field: "region", header: "Region", type: "string", width: 130, filter: "set" },
    { field: "city", header: "City", type: "string", width: 110, filter: "set" },
    { field: "role", header: "Role", type: "string", width: 96, filter: "set" },
    { field: "status", header: "Status", type: "string", width: 96, filter: "set" },
    { field: "hired", header: "Hired", type: "date", width: 110, filter: "date" },
    { field: "active", header: "Active", type: "boolean", width: 84, filter: "set" },
    { field: "score", header: "Score", type: "number", width: 88, agg: "avg", filter: "number" },
    { field: "capacity", header: "Capacity", type: "number", width: 96, agg: "sum", filter: "number" },
    { field: "risk", header: "Risk", type: "number", width: 80, filter: "number" },
  ];

  const metricCount = MEGA_COLS - named.length;
  const metrics: ColumnDef[] = Array.from({ length: metricCount }, (_, i) => ({
    field: `m${String(i + 1).padStart(2, "0")}`,
    header: `M${String(i + 1).padStart(2, "0")}`,
    type: "number" as const,
    width: 76,
    agg: "sum" as const,
    filter: "number" as const,
    align: "right" as const,
  }));

  const columns = [...named, ...metrics];

  const packed = [
    { field: "id", type: "number" as const, vector: numberVector(n, (i) => i + 1) },
    {
      field: "name",
      type: "string" as const,
      vector: stringVector(n, (i) =>
        tree.children[i]!.length
          ? `Team ${String(teamOf[i]! + 1).padStart(4, "0")}`
          : personName(i),
      ),
    },
    {
      field: "team",
      type: "string" as const,
      vector: stringVector(n, (i) => `Team ${String(teamOf[i]! + 1).padStart(4, "0")}`),
    },
    { field: "region", type: "string" as const, vector: stringVector(n, (i) => REGIONS[teamOf[i]! % REGIONS.length]!) },
    { field: "city", type: "string" as const, vector: stringVector(n, (i) => CITIES[teamOf[i]! % CITIES.length]!) },
    {
      field: "role",
      type: "string" as const,
      vector: stringVector(n, (i) => (tree.children[i]!.length ? "Team" : "Member")),
    },
    { field: "status", type: "string" as const, vector: stringVector(n, (i) => STATUSES[i % STATUSES.length]!) },
    {
      field: "hired",
      type: "date" as const,
      vector: dateVector(n, (i) => Date.UTC(2014 + (i % 12), i % 12, 1 + (i % 27))),
    },
    { field: "active", type: "boolean" as const, vector: booleanVector(n, (i) => noise[i]! > 0.18) },
    { field: "score", type: "number" as const, vector: numberVector(n, (i) => Math.round(40 + noise[i]! * 60)) },
    { field: "capacity", type: "number" as const, vector: numberVector(n, (i) => Math.round(noise[(i + 3) % n]! * 400)) },
    { field: "risk", type: "number" as const, vector: numberVector(n, (i) => Math.round(noise[(i + 9) % n]! * 100) / 10) },
    ...metrics.map((col, mi) => ({
      field: col.field,
      type: "number" as const,
      vector: numberVector(n, (i) => Math.round((noise[(i + mi * 13) % n]! * 2 - 0.4) * (50 + mi))),
    })),
  ];

  return { columns, store: createColumnStore(n, packed), tree };
}
