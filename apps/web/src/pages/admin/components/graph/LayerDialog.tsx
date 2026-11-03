import { FormEvent, useState } from "react";
import { GRAPH_PALETTE, type GraphLayer, type GraphLayout } from "@b2b/shared";
import { GRAPH_LAYOUT_OPTIONS, layoutHint } from "../../../../components/graph/layoutMode.js";

const DEFAULT_COLOR = GRAPH_PALETTE[0];

export interface LayerFormValues {
  name: string;
  description: string | null;
  color: string | null;
  layout: GraphLayout;
}

export default function LayerDialog({
  layer,
  onSubmit,
  onClose,
}: {
  layer: GraphLayer | null;
  onSubmit: (values: LayerFormValues) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(layer?.name ?? "");
  const [description, setDescription] = useState(layer?.description ?? "");
  const [color, setColor] = useState(layer?.color ?? DEFAULT_COLOR);
  const [layout, setLayout] = useState<GraphLayout>(layer?.layout ?? "graph");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Der Name braucht mindestens zwei Zeichen.");
      return;
    }
    onSubmit({
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      color,
      layout,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="card w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold">
          {layer ? "Ebene bearbeiten" : "Neue Ebene"}
        </h2>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="layer-name">
              Name
            </label>
            <input
              id="layer-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoFocus
            />
          </div>

          <div>
            <label className="label" htmlFor="layer-description">
              Beschreibung
            </label>
            <textarea
              id="layer-description"
              className="input min-h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>

          <div>
            <label className="label" htmlFor="layer-layout">
              Darstellung der Inhalte
            </label>
            <select
              id="layer-layout"
              className="input"
              value={layout}
              onChange={(e) => setLayout(e.target.value as GraphLayout)}
            >
              {GRAPH_LAYOUT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">{layoutHint(layout)}</p>
          </div>

          <div>
            <label className="label" htmlFor="layer-color">
              Farbe
            </label>
            <input
              id="layer-color"
              type="color"
              className="h-10 w-16 cursor-pointer rounded border border-line bg-white p-1"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {GRAPH_PALETTE.map((swatch) => {
                const selected = color.toLowerCase() === swatch;
                return (
                  <button
                    key={swatch}
                    type="button"
                    className={[
                      "h-8 w-8 rounded-full border-2",
                      selected ? "border-ink" : "border-transparent",
                    ].join(" ")}
                    style={{ backgroundColor: swatch }}
                    aria-label={`Farbe ${swatch}`}
                    aria-pressed={selected}
                    onClick={() => setColor(swatch)}
                  />
                );
              })}
            </div>
          </div>

          {layer && (
            <p className="text-xs text-slate-500">
              Beim Umbenennen ändert sich der Link zu dieser Ebene
              (aktuell <code>{layer.slug}</code>).
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary">
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
