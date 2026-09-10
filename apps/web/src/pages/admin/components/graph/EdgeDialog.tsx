import { FormEvent, useState } from "react";
import type { GraphEdge, GraphEdgeKind } from "@b2b/shared";

export interface ScopeNodeOption {
  id: string;
  label: string;
  kind: "layer" | "company";
}

export interface EdgeFormValues {
  source_id: string;
  target_id: string;
  edge_kind_id: number;
  label: string | null;
}

/**
 * Verbindungen entstehen ausschliesslich aus Knoten der aktuellen Auswahl,
 * deshalb sind beide Dropdowns mit demselben Scope befuellt. Beim Bearbeiten
 * sind die Endpunkte fix: ein Wechsel waere fachlich eine andere Verbindung.
 */
export default function EdgeDialog({
  nodes,
  edgeKinds,
  edge,
  onSubmit,
  onClose,
}: {
  nodes: ScopeNodeOption[];
  edgeKinds: GraphEdgeKind[];
  edge: GraphEdge | null;
  onSubmit: (values: EdgeFormValues) => void;
  onClose: () => void;
}) {
  const isEdit = edge !== null;
  const [sourceId, setSourceId] = useState(edge?.source_id ?? "");
  const [targetId, setTargetId] = useState(edge?.target_id ?? "");
  const [edgeKindId, setEdgeKindId] = useState(
    edge?.edge_kind_id ?? edgeKinds[0]?.id ?? 0
  );
  const [label, setLabel] = useState(edge?.label ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!sourceId || !targetId) {
      setError("Bitte beide Knoten auswählen.");
      return;
    }
    if (sourceId === targetId) {
      setError("Eine Verbindung braucht zwei verschiedene Knoten.");
      return;
    }
    if (!edgeKindId) {
      setError("Bitte einen Verbindungstyp auswählen.");
      return;
    }
    onSubmit({
      source_id: sourceId,
      target_id: targetId,
      edge_kind_id: edgeKindId,
      label: label.trim() ? label.trim() : null,
    });
  };

  const nodeName = (id: string) =>
    nodes.find((node) => node.id === id)?.label ?? "Unbekannter Knoten";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="card w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold">
          {isEdit ? "Verbindung bearbeiten" : "Verbindung hinzufügen"}
        </h2>

        <form onSubmit={submit} className="mt-4 space-y-4">
          {isEdit ? (
            <p className="text-sm text-slate-600">
              {nodeName(sourceId)} — {nodeName(targetId)}
            </p>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="edge-source">
                  Von
                </label>
                <select
                  id="edge-source"
                  className="input"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                >
                  <option value="">Bitte wählen</option>
                  {nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.kind === "layer" ? "Ebene: " : "Firma: "}
                      {node.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="edge-target">
                  Nach
                </label>
                <select
                  id="edge-target"
                  className="input"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  <option value="">Bitte wählen</option>
                  {nodes
                    .filter((node) => node.id !== sourceId)
                    .map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.kind === "layer" ? "Ebene: " : "Firma: "}
                        {node.label}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="label" htmlFor="edge-kind">
              Verbindungstyp
            </label>
            <select
              id="edge-kind"
              className="input"
              value={edgeKindId}
              onChange={(e) => setEdgeKindId(Number(e.target.value))}
            >
              {edgeKinds.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.name}
                  {kind.directed ? " (gerichtet)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="edge-label">
              Beschriftung (optional)
            </label>
            <input
              id="edge-label"
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={160}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary">
              {isEdit ? "Speichern" : "Hinzufügen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
