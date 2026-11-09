import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { GraphLayer } from "@b2b/shared";
import { layoutBadge } from "../../../../components/graph/layoutMode.js";
import { DropInto, SortableRow } from "./DragDrop.js";

export default function LayerList({
  layers,
  activeDragId,
  onOpen,
  onCreate,
  onSeedIndustries,
  seeding,
  onEdit,
  onDelete,
  onMove,
}: {
  layers: GraphLayer[];
  activeDragId: string | null;
  onOpen: (layerId: string) => void;
  onCreate: () => void;
  onSeedIndustries: () => void;
  seeding: boolean;
  onEdit: (layer: GraphLayer) => void;
  onDelete: (layer: GraphLayer) => void;
  onMove: (layerId: string, direction: -1 | 1) => void;
}) {
  return (
    <section className="card p-4 flex flex-col">
      <header className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">Ebenen</h2>
        <div className="flex flex-col items-end gap-1">
          <button type="button" className="btn-primary text-xs" onClick={onCreate}>
            Neue Ebene
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={onSeedIndustries}
            disabled={seeding}
            title="Branchengruppen, darunter die Branchen als Torte, darin die Firmen im Portfolio"
          >
            {seeding ? "Struktur wird angelegt …" : "Branchenstruktur anlegen"}
          </button>
        </div>
      </header>

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
