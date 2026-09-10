import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IndustryGroup, IndustryGroupInput } from "@b2b/shared";
import { api, ApiError } from "../../../lib/api.js";

const ADMIN_KEY = ["admin", "industry-groups"] as const;

export default function IndustryGroupManager() {
  const qc = useQueryClient();
  const list = useQuery<IndustryGroup[]>({
    queryKey: ADMIN_KEY,
    queryFn: () => api.get<IndustryGroup[]>("/api/admin/industry-groups"),
  });

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<IndustryGroupInput>({
    name: "",
    description: "",
    sort_order: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const invalidate = (groups: IndustryGroup[]) => {
    qc.setQueryData(ADMIN_KEY, groups);
    qc.invalidateQueries({ queryKey: ["industry-groups"] });
    qc.invalidateQueries({ queryKey: ["admin", "taxonomy", "industries"] });
    qc.invalidateQueries({ queryKey: ["industries"] });
  };

  const onError = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : "Fehler.");

  const create = useMutation({
    mutationFn: (input: IndustryGroupInput) =>
      api.post<IndustryGroup[]>("/api/admin/industry-groups", input),
    onSuccess: (groups) => {
      setNewName("");
      setNewDescription("");
      invalidate(groups);
    },
    onError,
  });

  const patch = useMutation({
    mutationFn: ({ id, input }: { id: number; input: IndustryGroupInput }) =>
      api.patch<IndustryGroup[]>(`/api/admin/industry-groups/${id}`, input),
    onSuccess: (groups) => {
      setEditingId(null);
      invalidate(groups);
    },
    onError,
  });

  const del = useMutation({
    mutationFn: (id: number) =>
      api.delete<{ ok: true }>(`/api/admin/industry-groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEY });
      qc.invalidateQueries({ queryKey: ["industry-groups"] });
      qc.invalidateQueries({ queryKey: ["admin", "taxonomy", "industries"] });
      qc.invalidateQueries({ queryKey: ["industries"] });
    },
    onError,
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) return;
    const maxSort = Math.max(0, ...(list.data ?? []).map((g) => g.sort_order));
    create.mutate({
      name: newName.trim(),
      description: newDescription.trim(),
      sort_order: maxSort + 10,
    });
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold">Branchen-Gruppen</h2>
      <p className="mt-1 text-sm text-slate-600">
        Gruppen bündeln Branchen in Suche und Firmenformular. Die
        Beschreibung erscheint dort als Hinweis neben dem Gruppennamen.
        Branchen ohne Gruppe stehen am Ende der Liste.
      </p>

      <form onSubmit={onCreate} className="mt-4 grid sm:grid-cols-[1fr_2fr_auto] gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Gruppenname"
          className="input"
          maxLength={120}
        />
        <input
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Beschreibung (optional)"
          className="input"
          maxLength={2000}
        />
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          Anlegen
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-4 divide-y divide-slate-200">
        {list.data?.map((group) => (
          <li key={group.id} className="py-2">
            {editingId === group.id ? (
              <div className="grid sm:grid-cols-[1fr_2fr_100px_auto_auto] gap-2 items-start">
                <input
                  value={editValue.name}
                  onChange={(e) =>
                    setEditValue((v) => ({ ...v, name: e.target.value }))
                  }
                  className="input"
                  maxLength={120}
                />
                <input
                  value={editValue.description}
                  onChange={(e) =>
                    setEditValue((v) => ({ ...v, description: e.target.value }))
                  }
                  className="input"
                  placeholder="Beschreibung"
                  maxLength={2000}
                />
                <input
                  value={editValue.sort_order}
                  onChange={(e) =>
                    setEditValue((v) => ({
                      ...v,
                      sort_order: Number.parseInt(e.target.value || "0", 10),
                    }))
                  }
                  className="input"
                  type="number"
                  min={0}
                />
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={() => patch.mutate({ id: group.id, input: editValue })}
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
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{group.name}</span>
                  {group.description && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {group.description}
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  Sort. {group.sort_order}
                </span>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => {
                    setEditingId(group.id);
                    setEditValue({
                      name: group.name,
                      description: group.description ?? "",
                      sort_order: group.sort_order,
                    });
                  }}
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  className="btn-danger text-xs"
                  onClick={() => {
                    if (
                      confirm(
                        `Gruppe „${group.name}“ löschen? Die Branchen bleiben erhalten und rücken zu „Ohne Gruppe“.`
                      )
                    ) {
                      del.mutate(group.id);
                    }
                  }}
                >
                  Löschen
                </button>
              </div>
            )}
          </li>
        ))}
        {list.data?.length === 0 && (
          <li className="py-2 text-sm text-slate-500">
            Noch keine Gruppen angelegt.
          </li>
        )}
      </ul>
    </div>
  );
}
