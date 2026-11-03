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
