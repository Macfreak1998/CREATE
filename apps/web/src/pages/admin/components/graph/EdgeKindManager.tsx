import { FormEvent, useState } from "react";
import type { GraphEdgeKind } from "@b2b/shared";
import type { GraphMutations } from "./useGraphAdmin.js";

const DEFAULT_COLOR = "#64748b";

/**
 * Verwaltung der Verbindungstypen. Bewusst am Muster von TaxonomyManager
 * orientiert, ergaenzt um Farbe und Richtung, weil beides die Darstellung im
 * oeffentlichen Graphen steuert.
 */
export default function EdgeKindManager({
  edgeKinds,
  mutations,
}: {
  edgeKinds: GraphEdgeKind[];
  mutations: GraphMutations;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [directed, setDirected] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    mutations.createEdgeKind.mutate(
      {
        name: name.trim(),
        color,
        directed,
        sort_order: (edgeKinds.at(-1)?.sort_order ?? 0) + 10,
      },
      {
        onSuccess: () => {
          setName("");
          setColor(DEFAULT_COLOR);
          setDirected(false);
        },
      }
    );
  };

  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-lg font-semibold">
        Verbindungstypen ({edgeKinds.length})
      </summary>

      <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="edge-kind-name">
            Name
          </label>
          <input
            id="edge-kind-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </div>
        <div>
          <label className="label" htmlFor="edge-kind-color">
            Farbe
          </label>
          <input
            id="edge-kind-color"
            type="color"
            className="h-10 w-16 rounded-md border border-line"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            className="checkbox"
            checked={directed}
            onChange={(e) => setDirected(e.target.checked)}
          />
          gerichtet
        </label>
        <button type="submit" className="btn-primary">
          Anlegen
        </button>
      </form>

      <ul className="mt-4 divide-y divide-slate-200">
        {edgeKinds.map((kind) => (
          <li key={kind.id} className="py-2">
            {editingId === kind.id ? (
              <EdgeKindEditor
                edgeKind={kind}
                mutations={mutations}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: kind.color }}
                />
                <span className="flex-1 text-sm">
                  {kind.name}
                  {kind.directed && (
                    <span className="ml-2 text-xs text-slate-500">gerichtet</span>
                  )}
                </span>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => setEditingId(kind.id)}
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  className="btn-danger text-xs"
                  onClick={() => {
                    if (confirm(`${kind.name} wirklich löschen?`)) {
                      mutations.deleteEdgeKind.mutate(kind.id);
                    }
                  }}
                >
                  Löschen
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function EdgeKindEditor({
  edgeKind,
  mutations,
  onDone,
}: {
  edgeKind: GraphEdgeKind;
  mutations: GraphMutations;
  onDone: () => void;
}) {
  const [name, setName] = useState(edgeKind.name);
  const [color, setColor] = useState(edgeKind.color);
  const [directed, setDirected] = useState(edgeKind.directed);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="input flex-1"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
      />
      <input
        type="color"
        className="h-10 w-16 rounded-md border border-line"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        aria-label="Farbe"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="checkbox"
          checked={directed}
          onChange={(e) => setDirected(e.target.checked)}
        />
        gerichtet
      </label>
      <button
        type="button"
        className="btn-primary text-xs"
        onClick={() =>
          mutations.updateEdgeKind.mutate(
            {
              id: edgeKind.id,
              name: name.trim(),
              color,
              directed,
              sort_order: edgeKind.sort_order,
            },
            { onSuccess: onDone }
          )
        }
      >
        Speichern
      </button>
      <button type="button" className="btn-secondary text-xs" onClick={onDone}>
        Abbrechen
      </button>
    </div>
  );
}
