/** Sample `{ column_definitions, table_data }` payloads for the playground. */

import { CANADA_ALT_FLAG, COUNTRY_FLAGS, ICON_INFO, ICON_LINK } from "./flags.ts";

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
    {
      heading: "",
      field: "row_action",
      width: 48,
      enable_sorting: false,
      enable_filtering: false,
      enable_editing: false,
      enable_grouping: false,
      icons: [
        {
          url: ICON_INFO,
          placement: "replace",
          title: "Post this row",
          action: {
            type: "http",
            method: "POST",
            url: "/api/rows/{{name}}",
            include_row: true,
            include_children: true,
          },
        },
      ],
    },
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

export const detailHtml = {
  column_definitions: [
    {
      heading: "Name",
      field: "name",
      filter_type: "text",
      detail_template: "<strong>{{value}}</strong>",
    },
    {
      heading: "Score",
      field: "score",
      type: "number",
      filter_type: "number",
      detail_template: "<span>{{value}}</span> / 100",
    },
    {
      heading: "Status",
      field: "status",
      filter_type: "set",
      detail_template: '<span class="tg-pill">{{value}}</span>',
    },
    {
      heading: "Bio",
      field: "bio",
      visibility: "detail",
      detail_template: "<p>{{value}}</p>",
    },
  ],
  row_definition: {
    title_template: "{{name}} · {{status}}",
  },
  table_data: [
    { name: "Ada Lovelace", score: 91, status: "Active", bio: "Wrote the first algorithm." },
    { name: "Tom Hughes", score: 74, status: "Hold", bio: "Prefers nested payloads." },
    { name: "Sam Patel", score: 88, status: "Active", bio: "Clicks rows for the full record." },
  ],
};

export const iconFlags = {
  column_definitions: [
    { heading: "Athlete", field: "athlete", filter_type: "text" },
    {
      heading: "Country",
      field: "country",
      filter_type: "set",
      width: 180,
      icons: [{ url_field: "flag", title: "{{country}}" }],
    },
    { heading: "Flag URL", field: "flag", visibility: "none" },
    {
      heading: "",
      field: "open",
      width: 56,
      enable_sorting: false,
      enable_filtering: false,
      enable_editing: false,
      enable_grouping: false,
      icons: [
        {
          url: ICON_LINK,
          placement: "replace",
          action: { type: "link", url: "https://en.wikipedia.org/wiki/{{country}}" },
        },
      ],
    },
  ],
  table_data: [
    { athlete: "Ada Lovelace", country: "Brazil", flag: COUNTRY_FLAGS.Brazil },
    { athlete: "Tom Hughes", country: "Canada", flag: COUNTRY_FLAGS.Canada },
    { athlete: "Sam Patel", country: "Canada", flag: CANADA_ALT_FLAG },
    { athlete: "Lin Park", country: "China", flag: COUNTRY_FLAGS.China },
  ],
};

export const adminTable = {
  queryBar: false,
  groupBar: false,
  searchBar: true,
  strictColumns: true,
  defaultColDef: { editable: false },
  column_definitions: [
    { heading: "Name", field: "name", filter_type: "text" as const },
    {
      heading: "Lock",
      field: "isLocked",
      type: "boolean" as const,
      filter_type: "set" as const,
      format: (v: unknown) => (v ? "Locked" : "Open"),
      cell_style: (v: unknown) =>
        v
          ? { color: "#fecaca", background: "#7f1d1d", pill: true }
          : { color: "#bbf7d0", background: "#14532d", pill: true },
    },
    {
      heading: "",
      field: "actions",
      width: 168,
      enable_sorting: false,
      enable_filtering: false,
      enable_editing: false,
      enable_grouping: false,
      icons: [
        { label: "Edit", action: { type: "modal" as const, title: "{{name}}", template: "<p>{{name}}</p>" } },
        {
          label: "Unlock",
          visible_if: "isLocked == true",
          background: "#334155",
          action: { type: "modal" as const, title: "Unlock {{name}}" },
        },
        {
          label: "Lock",
          visible_if: "isLocked == false",
          background: "#334155",
          action: { type: "modal" as const, title: "Lock {{name}}" },
        },
      ],
    },
  ],
  table_data: [
    { name: "Miami Heat", isLocked: true, venueName: "should not become a column" },
    { name: "Atlanta United", isLocked: false, venueName: "should not become a column" },
    { name: "Toronto FC", isLocked: true, venueName: "should not become a column" },
  ],
};

export const SAMPLES = [
  { id: "extra-data", label: "Extra data → C, D", payload: extraData },
  { id: "extra-headings", label: "Extra headings", payload: extraHeadings },
  { id: "nested", label: "Nested rows", payload: nestedRows },
  { id: "icons", label: "Icons in cells", payload: iconFlags },
  { id: "admin", label: "Admin chrome", payload: adminTable },
  { id: "matrix", label: "Array rows → A, B, C", payload: matrix },
  { id: "objects", label: "Objects, no defs", payload: objectsOnly },
  { id: "detail", label: "Detail HTML", payload: detailHtml },
] as const;
