import { Link } from "react-router-dom";
import type { GraphOutwardEdge } from "@b2b/shared";

const DIRECTION_PREFIX: Record<GraphOutwardEdge["direction"], string> = {
  in: "von",
  out: "zu",
  undirected: "mit",
};

/**
 * Verbindungen, die die geoeffnete Ebene auf Elternniveau hat. Beim Drill-down
 * ist die Elternebene ausgeblendet, ohne diesen Hinweis ginge die Information
 * verloren, warum die Ebene im Netzwerk ueberhaupt haengt.
 */
export default function OutwardEdgeChips({
  edges,
}: {
  edges: GraphOutwardEdge[];
}) {
  if (edges.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
      {edges.map((edge) => {
        const label = (
          <>
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: edge.color }}
            />
            <span>
              {DIRECTION_PREFIX[edge.direction]}{" "}
              <span className="font-medium">{edge.other_name}</span>
              <span className="text-slate-500"> · {edge.edge_kind_name}</span>
            </span>
          </>
        );

        const className =
          "pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-white/95 px-3 py-1 text-xs shadow-card hover:border-grass-500";

        if (edge.other_kind === "layer" && edge.other_path) {
          return (
            <Link
              key={edge.id}
              to={`/netzwerk/${edge.other_path}`}
              className={className}
            >
              {label}
            </Link>
          );
        }

        if (edge.other_company_slug) {
          return (
            <a
              key={edge.id}
              href={`/firma/${edge.other_company_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
              title="Profil in neuem Tab öffnen"
            >
              {label}
            </a>
          );
        }

        return (
          <span key={edge.id} className={className}>
            {label}
          </span>
        );
      })}
    </div>
  );
}
