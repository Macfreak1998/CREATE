import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanySize } from "@b2b/shared";
import { api, ApiError } from "../../lib/api.js";
import AdminNav from "./AdminNav.js";

export default function AdminUnternehmensgroessen() {
  const qc = useQueryClient();
  const queryKey = ["admin", "taxonomy", "company-sizes"] as const;

  const list = useQuery<CompanySize[]>({
    queryKey,
    queryFn: () => api.get<CompanySize[]>("/api/admin/company-sizes"),
  });

  const [newName, setNewName] = useState("");
  const [newSort, setNewSort] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSort, setEditSort] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["company-sizes"] });
  };

  const create = useMutation({
    mutationFn: (input: { name: string; sort_order: number }) =>
      api.post<CompanySize>("/api/admin/company-sizes", input),
    onSuccess: () => {
      setNewName("");
      setNewSort("");
      invalidate();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Fehler.");
    },
  });

  const patch = useMutation({
    mutationFn: ({
      id,
      name,
      sort_order,
    }: {
      id: number;
      name: string;
      sort_order: number;
    }) =>
      api.patch<CompanySize>(`/api/admin/company-sizes/${id}`, {
        name,
        sort_order,
      }),
    onSuccess: () => {
      setEditingId(null);
      setEditName("");
      setEditSort("");
      invalidate();
    },
  });

  const del = useMutation({
    mutationFn: (id: number) =>
      api.delete<{ ok: true }>(`/api/admin/company-sizes/${id}`),
    onSuccess: invalidate,
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) return;
    create.mutate({
      name: newName.trim(),
      sort_order: Number.parseInt(newSort || "0", 10),
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Unternehmensgrößen</h2>

        <form onSubmit={onCreate} className="mt-4 grid sm:grid-cols-[1fr_120px_auto] gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name (z.B. 11 - 50 Mitarbeitende)"
            className="input"
            maxLength={120}
          />
          <input
            value={newSort}
            onChange={(e) => setNewSort(e.target.value)}
            placeholder="Sortierung"
            className="input"
            type="number"
            min={0}
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
                  <input
                    value={editSort}
                    onChange={(e) => setEditSort(e.target.value)}
                    className="input w-24"
                    type="number"
                    min={0}
                  />
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    onClick={() =>
                      patch.mutate({
                        id: item.id,
                        name: editName,
                        sort_order: Number.parseInt(editSort || "0", 10),
                      })
                    }
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
                  <span className="text-xs text-slate-400 w-16 text-right">
                    Sort. {item.sort_order}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditName(item.name);
                      setEditSort(String(item.sort_order));
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
    </div>
  );
}
