export type DemoRow = {
  athlete: string;
  age: number;
  country: string;
  year: number;
  date: string;
  sport: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  active: boolean;
  trend: number[];
};

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "China",
  "Australia",
  "France",
  "Germany",
  "Japan",
  "Italy",
  "Canada",
  "Netherlands",
  "South Korea",
  "Brazil",
  "Kenya",
  "Jamaica",
  "Norway",
];

const SPORTS = [
  "Swimming",
  "Athletics",
  "Gymnastics",
  "Cycling",
  "Rowing",
  "Sailing",
  "Boxing",
  "Judo",
  "Tennis",
  "Archery",
  "Fencing",
  "Weightlifting",
];

const FIRST = [
  "Alex",
  "Sam",
  "Jordan",
  "Taylor",
  "Casey",
  "Riley",
  "Quinn",
  "Avery",
  "Cameron",
  "Parker",
  "Morgan",
  "Drew",
  "Skyler",
  "Reese",
  "Harper",
];

const LAST = [
  "Nguyen",
  "Patel",
  "Silva",
  "Kowalski",
  "Andersson",
  "Rossi",
  "Müller",
  "Sato",
  "Okafor",
  "Dubois",
  "Bennett",
  "García",
  "Ivanov",
  "Walsh",
  "Kim",
];

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

export function generateRows(count: number, seed = 0x51eeded): DemoRow[] {
  const rand = mulberry32(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;
  const rows: DemoRow[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const gold = Math.floor(rand() * rand() * 8);
    const silver = Math.floor(rand() * 6);
    const bronze = Math.floor(rand() * 7);
    const year = 1996 + Math.floor(rand() * 8) * 4;
    const month = 1 + Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 28);
    const trend = new Array<number>(12);
    let v = 40 + rand() * 20;
    for (let p = 0; p < 12; p++) {
      v += (rand() - 0.45) * 8;
      trend[p] = Math.round(v * 10) / 10;
    }
    rows[i] = {
      athlete: `${pick(FIRST)} ${pick(LAST)}`,
      age: 16 + Math.floor(rand() * 22),
      country: pick(COUNTRIES),
      year,
      date: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
      sport: pick(SPORTS),
      gold,
      silver,
      bronze,
      total: gold + silver + bronze,
      active: gold > 0 || rand() > 0.45,
      trend,
    };
  }
  return rows;
}
