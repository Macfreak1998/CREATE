import { FormEvent, useState } from "react";
import type { GraphLayer } from "@b2b/shared";

export interface LayerFormValues {
  name: string;
  description: string | null;
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
