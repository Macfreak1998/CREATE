import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Industry, IndustryGroup } from "@b2b/shared";
import { api, ApiError } from "../../../lib/api.js";

const ADMIN_KEY = ["admin", "taxonomy", "industries"] as const;
const GROUPS_KEY = ["admin", "industry-groups"] as const;

type AdminInput = { name: string; group_id: number | null; hidden_group_ids: number[] };

function HiddenGroupSelect({
  groups,
  value,
  onChange,
  disabled,
  label,
}: {
  groups: IndustryGroup[];
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  label: string;
}) {
  if (groups.length === 0) return null;
  return (
    <select
      multiple
      className="input h-24 w-52 text-xs"
      value={value.map(String)}
      aria-label={label}
      disabled={disabled}
      onChange={(event) => {
        const ids = [...event.target.selectedOptions].map((option) =>
          Number(option.value)
        );
        onChange(ids);
      }}
    >
      {groups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      ))}
    </select>
  );
}

export default function IndustryManager() {
  const qc = useQueryClient();

  const list = useQuery<Industry[]>({
    queryKey: ADMIN_KEY,
    queryFn: () => api.get<Industry[]>("/api/admin/industries"),
  });
  const groups = useQuery<IndustryGroup[]>({
    queryKey: GROUPS_KEY,
    queryFn: () => api.get<IndustryGroup[]>("/api/admin/industry-groups"),
  });

  const [newName, setNewName] = useState("");
  const [newGroupId, setNewGroupId] = useState<number | null>(null);
  const [newHiddenGroupIds, setNewHiddenGroupIds] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editHiddenGroupIds, setEditHiddenGroupIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const applyList = (items: Industry[]) => {
    qc.setQueryData(ADMIN_KEY, items);
    qc.invalidateQueries({ queryKey: ["industries"] });
  };

  const onError = (err: unknown) =>
    setError(err instanceof ApiError ? err.message : "Fehler.");

  const create = useMutation({
    mutationFn: (input: AdminInput) =>
      api.post<Industry[]>("/api/admin/industries", input),
    onSuccess: (items) => {
      setNewName("");
      setNewHiddenGroupIds([]);
      applyList(items);
    },
    onError,
  });

  const patch = useMutation({
    mutationFn: ({ id, input }: { id: number; input: AdminInput }) =>
      api.patch<Industry[]>(`/api/admin/industries/${id}`, input),
    onSuccess: (items) => {
      setEditingId(null);
      applyList(items);
    },
    onError,
  });

  const move = useMutation({
    mutationFn: ({ id, direction }: { id: number; direction: "up" | "down" }) =>
      api.post<Industry[]>(`/api/admin/industries/${id}/move`, {
        direction,
      }),
    onSuccess: applyList,
    onError,
  });

  const del = useMutation({
    mutationFn: (id: number) =>
      api.delete<{ ok: true }>(`/api/admin/industries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_KEY });
      qc.invalidateQueries({ queryKey: ["industries"] });
    },
    onError,
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newName.trim()) return;
    create.mutate({
      name: newName.trim(),
      group_id: newGroupId,
      hidden_group_ids: newHiddenGroupIds,
    });
  };

  const items = list.data ?? [];
  const busy = create.isPending || patch.isPending || move.isPending;
  const visibleGroups = (groups.data ?? []).filter((group) => !group.hidden);
  const hiddenGroups = (groups.data ?? []).filter((group) => group.hidden);

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold">Branchen</h2>
      <p className="mt-1 text-sm text-slate-600">
        Die Reihenfolge innerhalb einer Gruppe wird mit den Pfeilen gesetzt und
        gilt für Suche und Firmenformular. Eine Branche hat eine sichtbare
        Gruppe und kann zusätzlich in mehreren Gruppen nur für den
        Netzwerkgraphen liegen.
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
          {visibleGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          Anlegen
        </button>
        {hiddenGroups.length > 0 && (
          <div className="sm:col-span-3">
            <span className="label">Gruppen nur für den Netzwerkgraphen</span>
            <HiddenGroupSelect
              groups={hiddenGroups}
              value={newHiddenGroupIds}
              onChange={setNewHiddenGroupIds}
              label="Unsichtbare Gruppen der neuen Branche"
            />
          </div>
        )}
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
                          input: {
                            name: editName,
                            group_id: groupId,
                            hidden_group_ids: editHiddenGroupIds,
                          },
                        })
                      }
                      disabled={patch.isPending}
                    >
                      Speichern
                    </button>
                    <HiddenGroupSelect
                      groups={hiddenGroups}
                      value={editHiddenGroupIds}
                      onChange={setEditHiddenGroupIds}
                      disabled={busy}
                      label={`Unsichtbare Gruppen von ${item.name}`}
                    />
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
                    <span className="flex-1 text-sm">
                      {item.name}
                      {item.hidden_group_ids.length > 0 && (
                        <span className="block text-xs text-slate-500">
                          Graph:{" "}
                          {hiddenGroups
                            .filter((group) => item.hidden_group_ids.includes(group.id))
                            .map((group) => group.name)
                            .join(", ")}
                        </span>
                      )}
                    </span>
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
                            hidden_group_ids: item.hidden_group_ids,
                          },
                        })
                      }
                      className="input w-48 text-xs py-1"
                      aria-label={`Gruppe von ${item.name}`}
                      disabled={busy}
                    >
                      <option value="">Ohne Gruppe</option>
                      {visibleGroups.map((g) => (
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
                        setEditHiddenGroupIds(item.hidden_group_ids);
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
