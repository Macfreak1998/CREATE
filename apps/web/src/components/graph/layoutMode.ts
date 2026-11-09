import type { GraphLayout } from "@b2b/shared";

export const GRAPH_LAYOUT_OPTIONS: {
  value: GraphLayout;
  label: string;
  badge: string;
  hint: string;
}[] = [
  {
    value: "graph",
    label: "Netzwerk mit Kanten",
    badge: "Netzwerk",
    hint: "Die Kinder werden als Netzwerk gezeichnet. Verbindungen zwischen ihnen sind sichtbar.",
  },
  {
    value: "pie",
    label: "Tortendiagramm",
    badge: "Torte",
    hint: "Jedes Kind wird ein Tortenstück. Unterebenen wachsen mit der Zahl der zugeordneten Firmen, einzelne Firmen zählen einfach.",
  },
  {
    value: "xy",
    label: "Größe und Reifegrad",
    badge: "Portfolio",
    hint: "Firmen liegen auf den Achsen Unternehmensgröße und Reifegrad (Forschung, Entwicklung, Anwendung). Unterebenen stehen darüber.",
  },
  {
    value: "pack",
    label: "Kreispackung",
    badge: "Kreise",
    hint: "Branchen werden farbige Kreise, Firmen sitzen darin. Dieselbe Firma erscheint in jeder ihrer Branchen.",
  },
  {
    value: "radial",
    label: "Radialer Ring",
    badge: "Ring",
    hint: "Firmen stehen einmal auf einem Ring, gegliedert nach den direkten Unterebenen. Kanten verbinden sie mit den Branchen des gewählten Anwendungsbereichs.",
  },
];

export function isGraphSceneLayout(layout: GraphLayout): boolean {
  return layout === "graph" || layout === "pie" || layout === "xy";
}

export function layoutBadge(layout: GraphLayout): string {
  return GRAPH_LAYOUT_OPTIONS.find((option) => option.value === layout)?.badge ?? "Netzwerk";
}

export function layoutHint(layout: GraphLayout): string {
  return GRAPH_LAYOUT_OPTIONS.find((option) => option.value === layout)?.hint ?? "";
}
