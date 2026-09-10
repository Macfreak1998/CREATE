import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Technology, TechnologyGroup } from "@b2b/shared";
import { api, ApiError } from "../../../lib/api.js";

const ADMIN_KEY = ["admin", "taxonomy", "technologies"] as const;
const GROUPS_KEY = ["admin", "technology-groups"] as const;

type AdminInput = { name: string; group_id: number | null };

export default function TechnologyManager() {
  const qc = useQueryClient();

  const list = useQuery<Technology[]>({
    queryKey: ADMIN_KEY,
    queryFn: () => api.get<Technology[]>("/api/admin/technologies"),
  });
  const groups = useQuery<TechnologyGroup[]>({
    queryKey: GROUPS_KEY,
    queryFn: () => api.get<TechnologyGroup[]>("/api/admin/technology-groups"),
  });

  const [newName, setNewName] = useState("");
  const [newGroupId, setNewGroupId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const applyList = (items: Technology[]) => {
    qc.setQueryData(ADMIN_KEY, items);
    qc.invalidateQueries({ queryKey: ["technologies"] });
  };

  const onError = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : "Fehler.");

  const create = useMutation({
    mutationFn: (input: AdminInput) =>
      api.post<Technology[]>("/api/admin/technologies", input),
    onSuccess: (items) => {
      setNewName("");
      applyList(items);
    },
    onError,
  });

  const patch = useMutation({
    mutationFn: ({ id, input }: { id: number; input: AdminInput }) =>
      api.patch<Technology[]>(`/api/admin/technologies/${id}`, input),
    onSuccess: (items) => {
      setEditingId(null);
      applyList(items);
    },
    onError,
  });

  const move = useMutation({
    mutationFn: ({ id, direction }: { id: number; direction: "up" | "down" }) =>
      api.post<Technology[]>(`/api/admin/technologies/${id}/move`, {
        direction,
      }),
    onSuccess: applyList,
    onError,
  });

  const del = useMutation({
    mutationFn: (id: number) =>
      api.delete<{ ok: true }>(`/api/admin/technologies/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEY });
      qc.invalidateQueries({ queryKey: ["technologies"] });
    },
    onError,
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) return;
    create.mutate({ name: newName.trim(), group_id: newGroupId });
  };

  const items = list.data ?? [];
  const busy = create.isPending || patch.isPending || move.isPending;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold">Technologien</h2>
      <p className="mt-1 text-sm text-slate-600">
        Die Reihenfolge innerhalb einer Gruppe wird mit den Pfeilen gesetzt und
        gilt für Suche und Firmenformular.
      </p>

      <form onSubmit={onCreate} className="mt-4 grid sm:grid-cols-[1fr_200px_auto] gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
          className="input"
          maxLength={120}
        />
        <select
          value={newGroupId ?? ""}
          onChange={(e) =>
            setNewGroupId(e.target.value ? Number(e.target.value) : null)
          }
          className="input"
        >
          <option value="">Ohne Gruppe</option>
          {groups.data?.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          Anlegen
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <ul className="mt-4 divide-y divide-slate-200">
        {items.map((item, index) => {
          const groupId = item.group?.id ?? null;
          const prevGroupId = index > 0 ? items[index - 1].group?.id ?? null : undefined;
          const nextGroupId =
            index < items.length - 1 ? items[index + 1].group?.id ?? null : undefined;
          const isFirstInGroup = prevGroupId !== groupId;
          const isLastInGroup = nextGroupId !== groupId;

          return (
            <li key={item.id}>
              {isFirstInGroup && (
                <p className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {item.group?.name ?? "Ohne Gruppe"}
                </p>
              )}
              <div className="py-2 flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label="Nach oben"
                    className="text-slate-400 hover:text-teal-700 disabled:opacity-30 leading-none"
                    disabled={isFirstInGroup || busy}
                    onClick={() => move.mutate({ id: item.id, direction: "up" })}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="Nach unten"
                    className="text-slate-400 hover:text-teal-700 disabled:opacity-30 leading-none"
                    disabled={isLastInGroup || busy}
                    onClick={() => move.mutate({ id: item.id, direction: "down" })}
                  >
                    ▼
                  </button>
                </div>

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
                      onClick={() =>
                        patch.mutate({
                          id: item.id,
                          input: { name: editName, group_id: groupId },
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
                    <select
                      value={groupId ?? ""}
                      onChange={(e) =>
                        patch.mutate({
                          id: item.id,
                          input: {
                            name: item.name,
                            group_id: e.target.value
                              ? Number(e.target.value)
                              : null,
                          },
                        })
                      }
                      className="input w-48 text-xs py-1"
                      aria-label={`Gruppe von ${item.name}`}
                      disabled={busy}
                    >
                      <option value="">Ohne Gruppe</option>
                      {groups.data?.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
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
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
