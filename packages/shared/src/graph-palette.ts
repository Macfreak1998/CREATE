/**
 * Farben der Website: Gras, Teal, Limette und Orange. Dieselbe Reihe färbt
 * neue Ebenen, Tortenscheiben ohne eigene Farbe und die Blasen der
 * anonymen Portfolio-Ansicht.
 */
export const GRAPH_PALETTE = [
  "#81ae3d",
  "#528163",
  "#bad25f",
  "#f1874b",
  "#6f9833",
  "#385a46",
  "#a2b84d",
  "#d57038",
] as const;

export function graphPaletteColor(index: number): string {
  const color = GRAPH_PALETTE[index % GRAPH_PALETTE.length];
  return color ?? GRAPH_PALETTE[0];
}

/**
 * Unterscheidbare Abstufungen der Website-Farben fuer Branchen. Dieselbe
 * Branchen-Id bekommt immer dieselbe Farbe, damit Duplikate wiedererkennbar
 * bleiben.
 */
export const GRAPH_CATEGORY_PALETTE = [
  "#81ae3d",
  "#528163",
  "#f1874b",
  "#5a7a2a",
  "#467157",
  "#a4562b",
  "#bad25f",
  "#2a4434",
  "#6f9833",
  "#385a46",
  "#d57038",
  "#7e8f3d",
  "#1d2e23",
  "#733c1e",
  "#a2b84d",
  "#6c9079",
] as const;

export function graphCategoryColor(industryId: number): string {
  const index = Math.abs(industryId) % GRAPH_CATEGORY_PALETTE.length;
  const color = GRAPH_CATEGORY_PALETTE[index];
  return color ?? GRAPH_CATEGORY_PALETTE[0];
}
