/**
 * Gedämpfte Farben aus Gras, Teal und warmen Erdtönen. Dieselbe Reihe färbt
 * neue Ebenen, Tortenscheiben ohne eigene Farbe und die Blasen der
 * anonymen Portfolio-Ansicht.
 */
export const GRAPH_PALETTE = [
  "#4f6f2e",
  "#385a46",
  "#6f9833",
  "#a4562b",
  "#467157",
  "#6b5344",
  "#2f4a3c",
  "#8a6239",
] as const;

export function graphPaletteColor(index: number): string {
  const color = GRAPH_PALETTE[index % GRAPH_PALETTE.length];
  return color ?? GRAPH_PALETTE[0];
}

/**
 * Satte, voneinander unterscheidbare Farben fuer Branchen. Dieselbe
 * Branchen-Id bekommt immer dieselbe Farbe, damit Duplikate wiedererkennbar
 * bleiben.
 */
export const GRAPH_CATEGORY_PALETTE = [
  "#6b3a4a",
  "#3c4d99",
  "#4b5563",
  "#1f6f64",
  "#1d4e89",
  "#8a5a12",
  "#9a3412",
  "#0f766e",
  "#6d28d9",
  "#9f1239",
  "#0369a1",
  "#3f6212",
  "#7c2d12",
  "#3730a3",
  "#155e75",
  "#854d0e",
] as const;

export function graphCategoryColor(industryId: number): string {
  const index = Math.abs(industryId) % GRAPH_CATEGORY_PALETTE.length;
  const color = GRAPH_CATEGORY_PALETTE[index];
  return color ?? GRAPH_CATEGORY_PALETTE[0];
}
