import { useState } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { GraphLayer, IndustryGroup } from "@b2b/shared";
import { layoutBadge } from "../../../../components/graph/layoutMode.js";
import { DropInto, SortableRow } from "./DragDrop.js";

export default function LayerList({
  layers,
  groups,
  activeDragId,
  onOpen,
  onCreate,
  onAddGroup,
  addingGroup,
  onEdit,
  onDelete,
  onMove,
}: {
  layers: GraphLayer[];
  groups: IndustryGroup[];
  activeDragId: string | null;
  onOpen: (layerId: string) => void;
  onCreate: () => void;
  onAddGroup: (groupId: number, radialGroupId: number) => void;
  addingGroup: boolean;
  onEdit: (layer: GraphLayer) => void;
  onDelete: (layer: GraphLayer) => void;
  onMove: (layerId: string, direction: -1 | 1) => void;
}) {
  const [groupId, setGroupId] = useState<number | "">("");
  const [radialGroupId, setRadialGroupId] = useState<number | "">("");
  const present = new Set(
    layers
      .map((layer) => layer.industry_group_id)
      .filter((id): id is number => id != null)
  );

  return (
    <section className="card p-4 flex flex-col">
      <header className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">Ebenen</h2>
        <button type="button" className="btn-primary text-xs" onClick={onCreate}>
          Neue Ebene
        </button>
      </header>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (groupId === "" || radialGroupId === "") return;
          onAddGroup(groupId, radialGroupId);
        }}
      >
        <label className="label" htmlFor="add-industry-group">
          Branchengruppe hinzufügen
        </label>
        <select
          id="add-industry-group"
          className="input text-xs"
          value={groupId}
          onChange={(event) =>
            setGroupId(event.target.value ? Number(event.target.value) : "")
          }
        >
          <option value="">Gruppe wählen</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
              {group.hidden ? " (nur Graph)" : ""}
              {present.has(group.id) ? " · bereits angelegt" : ""}
            </option>
          ))}
        </select>
        <div>
          <label className="label" htmlFor="add-radial-group">
            Anwendungsbereich des Rings
          </label>
          <select
            id="add-radial-group"
            className="input text-xs"
            value={radialGroupId}
            onChange={(event) =>
              setRadialGroupId(event.target.value ? Number(event.target.value) : "")
            }
          >
            <option value="">Gruppe wählen</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.hidden ? `${group.name} (nur Graph)` : group.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Die Branchengruppe wird eine Torte. Jede Branche darunter ist ein Ring
            mit den Firmen. Im Zentrum stehen die Branchen dieser Gruppe.
          </p>
        </div>
        <button
          type="submit"
          className="btn-secondary self-start text-xs"
          disabled={addingGroup || groupId === "" || radialGroupId === ""}
        >
          {addingGroup ? "Wird angelegt …" : "Hinzufügen"}
        </button>
      </form>

      {layers.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Noch keine Ebene in dieser Auswahl.
        </p>
      ) : (
        <SortableContext
          items={layers.map((layer) => layer.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="mt-3 divide-y divide-slate-200">
            {layers.map((layer, index) => (
              <SortableRow key={layer.id} id={layer.id}>
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => onOpen(layer.id)}
                    title="Ebene öffnen"
                  >
                    <span className="text-sm font-medium text-ink hover:text-grass-600">
                      {layer.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {layer.child_layer_count} Ebenen ·{" "}
                      {layer.child_company_count} Firmen · {layoutBadge(layer.layout)}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="btn-secondary px-2 py-1 text-xs"
                        onClick={() => onMove(layer.id, -1)}
                        disabled={index === 0}
                        aria-label={`${layer.name} nach oben`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-secondary px-2 py-1 text-xs"
                        onClick={() => onMove(layer.id, 1)}
                        disabled={index === layers.length - 1}
                        aria-label={`${layer.name} nach unten`}
                      >
                        ↓
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => onEdit(layer)}
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        className="btn-danger text-xs"
                        onClick={() => onDelete(layer)}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>

                {layer.description && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {layer.description}
                  </p>
                )}

                {activeDragId && activeDragId !== layer.id && (
                  <DropInto
                    layerId={layer.id}
                    label={`In "${layer.name}" verschieben`}
                  />
                )}
              </SortableRow>
            ))}
          </ul>
        </SortableContext>
      )}
    </section>
  );
}
