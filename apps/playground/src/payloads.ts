/** Sample `{ column_definitions, table_data }` payloads for the playground. */

export const extraData = {
  column_definitions: [
    { heading: "Name", field: "name", enable_sorting: true, enable_filtering: true, filter_type: "text" },
    { heading: "Score", field: "score", type: "number", filter_type: "number" },
  ],
  table_data: [
    { name: "Ada Lovelace", score: 91, city: "Paris" },
    { name: "Tom Hughes", score: 74, city: "Rome", team: "Alpha" },
    { name: "Sam Patel", score: 88, city: "Tokyo" },
  ],
};

export const extraHeadings = {
  column_definitions: [
    { heading: "Name", field: "name", filter_type: "text" },
    { heading: "Notes" },
    { heading: "Flag" },
  ],
  table_data: [{ name: "Ada Lovelace" }, { name: "Tom Hughes" }, { name: "Sam Patel" }],
};

export const nestedRows = {
  column_definitions: [
    { heading: "Name", field: "name", filter_type: "text" },
    { heading: "Gold", field: "gold", type: "number", filter_type: "number", agg: "sum" },
  ],
  table_data: [
    {
      name: "Americas",
      gold: 12,
      children: [
        { name: "United States", gold: 8 },
        { name: "Canada", gold: 4 },
      ],
    },
    {
      name: "Europe",
      gold: 9,
      children: [
        { name: "France", gold: 3 },
        { name: "Germany", gold: 6, children: [{ name: "Berlin club", gold: 2 }] },
      ],
    },
  ],
};

export const matrix = {
  table_data: [
    ["Ada", 91, "Paris"],
    ["Tom", 74, "Rome"],
    ["Sam", 88],
  ],
};

export const objectsOnly = {
  table_data: [
    { athlete: "Ada Lovelace", country: "UK", gold: 3 },
    { athlete: "Tom Hughes", country: "USA", gold: 1 },
    { athlete: "Sam Patel", country: "India", gold: 2 },
  ],
};

export const SAMPLES = [
  { id: "extra-data", label: "Extra data → C, D", payload: extraData },
  { id: "extra-headings", label: "Extra headings", payload: extraHeadings },
  { id: "nested", label: "Nested rows", payload: nestedRows },
  { id: "matrix", label: "Array rows → A, B, C", payload: matrix },
  { id: "objects", label: "Objects, no defs", payload: objectsOnly },
] as const;
