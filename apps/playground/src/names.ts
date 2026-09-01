/** First/last pools for playground datasets. Combined with a middle initial they cover 250k unique people. */
export const FIRST = [
  "Ada", "Aisha", "Alex", "Amara", "Andre", "Avery", "Ben", "Brooke", "Cameron", "Casey",
  "Chen", "Chris", "Clara", "Dana", "Dakota", "Devin", "Diego", "Drew", "Eden", "Elena",
  "Emerson", "Eva", "Farid", "Felix", "Finley", "Grace", "Gwen", "Hana", "Harper", "Hayden",
  "Hector", "Hugo", "Ingrid", "Iris", "Ivy", "Jamie", "Joel", "Jordan", "Jules", "Kai",
  "Keiko", "Kendall", "Kira", "Koji", "Leila", "Leo", "Liam", "Lin", "Logan", "Luca",
  "Marley", "Mateo", "Maya", "Mei", "Mina", "Morgan", "Nate", "Nina", "Noah", "Noor",
  "Olga", "Omar", "Oscar", "Owen", "Pablo", "Paige", "Parker", "Peyton", "Phoenix", "Pia",
  "Priya", "Quinn", "Rafael", "Reagan", "Reese", "Remy", "Riley", "Rita", "Rowan", "Sage",
  "Sam", "Sana", "Sidney", "Skyler", "Sofia", "Soren", "Stella", "Talia", "Taylor", "Teagan",
  "Tessa", "Theo", "Tom", "Uma", "Uri", "Vera", "Victor", "Vince", "Will", "Wren",
  "Xavier", "Ximena", "Yara", "Yukio", "Yusuf", "Zane", "Zoe",
];

export const LAST = [
  "Andersson", "Bennett", "Berg", "Chen", "Cho", "Cohen", "Cruz", "Diallo", "Dubois", "Edwards",
  "Farah", "Flores", "García", "Hassan", "Hernandez", "Ibrahim", "Ivanov", "Jensen", "Kim", "Kowalski",
  "Khan", "Lee", "Lopez", "Martinez", "Mbeki", "Méndez", "Moreau", "Müller", "Nakamura", "Nguyen",
  "Nielsen", "Novak", "Okafor", "Oliveira", "Olsen", "Park", "Patel", "Petrov", "Quinn", "Rahman",
  "Ramirez", "Rossi", "Santos", "Sato", "Schmidt", "Silva", "Singh", "Sokolov", "Sullivan", "Tanaka",
  "Tesfaye", "Thompson", "Torres", "Vargas", "Walsh", "Wang", "Williams", "Yamamoto", "Yilmaz", "Zhang",
  "Ali", "Baker", "Costa", "Diaz", "Ellis", "Ford", "Gupta", "Hughes", "Ito", "Jung",
  "Kaur", "Larsen", "Moore", "Nair", "Owens", "Perez", "Reed", "Shah", "Tran", "Vogel",
];

const SPACE = FIRST.length * LAST.length * 26;

/** Stable unique-ish person name for row `index` (first + middle initial + last). */
export function personName(index: number): string {
  const cycle = Math.floor(index / SPACE);
  const id = ((index % SPACE) * 7) % SPACE;
  const initial = id % 26;
  const rest = Math.floor(id / 26);
  const first = FIRST[rest % FIRST.length]!;
  const last = LAST[Math.floor(rest / FIRST.length) % LAST.length]!;
  const base = `${first} ${String.fromCharCode(65 + initial)}. ${last}`;
  return cycle > 0 ? `${base} ${cycle + 1}` : base;
}
