import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Taxonomy } from "@b2b/shared";
import { api, ApiError } from "../../../lib/api.js";

// Technologien und Branchen haben wegen Gruppen und Sortierung eigene Manager.
type Kind = "machines" | "knowhows";

const PUBLIC_QUERY_KEY: Record<Kind, string> = {
  machines: "machines",
  knowhows: "knowhows",
};

export default function TaxonomyManager({
  title,
  kind,
}: {
  title: string;
  kind: Kind;
}) {
  const qc = useQueryClient();
  const queryKey = ["admin", "taxonomy", kind];

  const list = useQuery<Taxonomy[]>({
    queryKey,
    queryFn: () => api.get<Taxonomy[]>(`/api/admin/${kind}`),
  });

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: [PUBLIC_QUERY_KEY[kind]] });
  };

  const create = useMutation({
    mutationFn: (name: string) =>
      api.post<Taxonomy>(`/api/admin/${kind}`, { name }),
    onSuccess: () => {
      setNewName("");
      invalidate();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Fehler.");
    },
  });

  const patch = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.patch<Taxonomy>(`/api/admin/${kind}/${id}`, { name }),
    onSuccess: () => {
      setEditingId(null);
      setEditName("");
      invalidate();
    },
  });

  const del = useMutation({
    mutationFn: (id: number) =>
      api.delete<{ ok: true }>(`/api/admin/${kind}/${id}`),
    onSuccess: invalidate,
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newName.trim()) create.mutate(newName.trim());
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>

      <form onSubmit={onCreate} className="mt-4 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
          className="input"
          maxLength={120}
        />
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          Anlegen
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-4 divide-y divide-slate-200">
        {list.data?.map((item) => (
          <li key={item.id} className="py-2 flex items-center gap-2">
            {editingId === item.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input flex-1"
                  maxLength={120}
                />
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={() => patch.mutate({ id: item.id, name: editName })}
                  disabled={patch.isPending}
                >
                  Speichern
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => setEditingId(null)}
                >
                  Abbrechen
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{item.name}</span>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditName(item.name);
                  }}
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  className="btn-danger text-xs"
                  onClick={() => {
                    if (confirm(`${item.name} wirklich löschen?`)) {
                      del.mutate(item.id);
                    }
                  }}
                >
                  Löschen
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
