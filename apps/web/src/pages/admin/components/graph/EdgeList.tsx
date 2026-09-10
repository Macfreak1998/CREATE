import type { GraphEdge, GraphOutwardEdge } from "@b2b/shared";
import type { ScopeNodeOption } from "./EdgeDialog.js";

export default function EdgeList({
  edges,
  outwardEdges,
  nodes,
  onCreate,
  onEdit,
  onDelete,
}: {
  edges: GraphEdge[];
  outwardEdges: GraphOutwardEdge[];
  nodes: ScopeNodeOption[];
  onCreate: () => void;
  onEdit: (edge: GraphEdge) => void;
  onDelete: (edge: GraphEdge) => void;
}) {
  const nodeName = (id: string) =>
    nodes.find((node) => node.id === id)?.label ?? "Unbekannt";

  return (
    <section className="card p-4 flex flex-col">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Verbindungen</h2>
        <button
          type="button"
          className="btn-primary text-xs"
          onClick={onCreate}
          disabled={nodes.length < 2}
          title={
            nodes.length < 2
              ? "Mindestens zwei Knoten in dieser Ebene nötig"
              : undefined
          }
        >
          Verbindung hinzufügen
        </button>
      </header>

      {edges.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Noch keine Verbindung in dieser Ebene.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-200">
          {edges.map((edge) => (
            <li key={edge.id} className="flex items-start gap-2 py-2">
              <span
                aria-hidden="true"
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: edge.color }}
              />
              <span className="flex-1 text-sm">
                {nodeName(edge.source_id)}{" "}
                <span className="text-slate-400">
                  {edge.directed ? "→" : "—"}
                </span>{" "}
                {nodeName(edge.target_id)}
                <span className="block text-xs text-slate-500">
                  {edge.edge_kind_name}
                  {edge.label ? ` · ${edge.label}` : ""}
                </span>
              </span>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => onEdit(edge)}
              >
                Bearbeiten
              </button>
              <button
                type="button"
                className="btn-danger text-xs"
                onClick={() => onDelete(edge)}
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
      )}

      {outwardEdges.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Verbindungen dieser Ebene nach außen
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Liegen in der übergeordneten Ebene und werden dort bearbeitet.
          </p>
          <ul className="mt-2 space-y-1">
            {outwardEdges.map((edge) => (
              <li key={edge.id} className="flex items-center gap-2 text-xs">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: edge.color }}
                />
                <span>
                  {edge.direction === "in" ? "von " : "zu "}
                  <span className="font-medium">{edge.other_name}</span>
                  {" · "}
                  {edge.edge_kind_name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
