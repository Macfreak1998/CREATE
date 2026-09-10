import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TechnologySuggestionAcceptInput } from "@b2b/shared";
import { api, ApiError } from "../../lib/api.js";
import { useTechnologyGroups } from "../../hooks/useTaxonomies.js";
import AdminNav from "./AdminNav.js";

type Filter = "open" | "accepted" | "rejected" | "all";

interface AdminSuggestionRow {
  id: string;
  company_id: string;
  company_name: string;
  name: string;
  notes: string | null;
  trl: number | null;
  status: "open" | "accepted" | "rejected";
  created_at: string;
}

interface AdminSuggestionList {
  items: AdminSuggestionRow[];
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Offen" },
  { value: "accepted", label: "Angenommen" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "all", label: "Alle" },
];

export default function AdminTechVorschlaege() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useQuery<AdminSuggestionList>({
    queryKey: ["admin", "technology-suggestions", filter],
    queryFn: () =>
      api.get<AdminSuggestionList>(
        `/api/admin/technology-suggestions?status=${filter}`
      ),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "technology-suggestions"] });
    qc.invalidateQueries({ queryKey: ["taxonomies", "technologies"] });
  };

  const accept = useMutation({
    mutationFn: (vars: {
      suggestionId: string;
      input: TechnologySuggestionAcceptInput;
    }) =>
      api.post<{ ok: true; technology_id: number }>(
        `/api/admin/technology-suggestions/${vars.suggestionId}/accept`,
        vars.input
      ),
    onSuccess: () => {
      setMessage("Vorschlag angenommen.");
      setError(null);
      invalidate();
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.message : "Aktion fehlgeschlagen.");
    },
  });

  const reject = useMutation({
    mutationFn: (suggestionId: string) =>
      api.post<{ ok: true }>(
        `/api/admin/technology-suggestions/${suggestionId}/reject`,
        {}
      ),
    onSuccess: () => {
      setMessage("Vorschlag abgelehnt.");
      setError(null);
      invalidate();
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.message : "Aktion fehlgeschlagen.");
    },
  });

  const remove = useMutation({
    mutationFn: (suggestionId: string) =>
      api.delete<{ ok: true }>(
        `/api/admin/technology-suggestions/${suggestionId}`
      ),
    onSuccess: () => {
      setMessage("Vorschlag geloescht.");
      setError(null);
      invalidate();
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.message : "Aktion fehlgeschlagen.");
    },
  });

  const isPending = accept.isPending || reject.isPending || remove.isPending;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />

      <section className="card p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold">Technologie-Vorschlaege</h2>
          <div className="flex gap-2 text-sm">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={
                  filter === f.value
                    ? "px-3 py-1 rounded-md bg-teal-600 text-white"
                    : "px-3 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Beim Annehmen wird, falls noch nicht vorhanden, eine globale
          Technologie angelegt und automatisch der einreichenden Firma
          zugeordnet.
        </p>

        {message && (
          <p className="mt-4 text-sm text-emerald-700">{message}</p>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {list.isLoading ? (
          <p className="mt-4 text-slate-500">Laden ...</p>
        ) : list.isError ? (
          <p className="mt-4 text-red-600">
            Vorschlaege konnten nicht geladen werden.
          </p>
        ) : !list.data || list.data.items.length === 0 ? (
          <p className="mt-4 text-slate-500">Keine Vorschlaege.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {list.data.items.map((item) => (
              <SuggestionRow
                key={item.id}
                item={item}
                onAccept={(input) =>
                  accept.mutate({ suggestionId: item.id, input })
                }
                onReject={() => reject.mutate(item.id)}
                onDelete={() => remove.mutate(item.id)}
                disabled={isPending}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SuggestionRow({
  item,
  onAccept,
  onReject,
  onDelete,
  disabled,
}: {
  item: AdminSuggestionRow;
  onAccept: (input: TechnologySuggestionAcceptInput) => void;
  onReject: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [name, setName] = useState(item.name);
  const [trl, setTrl] = useState<number | null>(item.trl);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [groupId, setGroupId] = useState<number | null>(null);
  const groups = useTechnologyGroups();

  const statusBadge = (() => {
    const map = {
      open: { label: "offen", cls: "bg-slate-100 text-slate-700 border-slate-200" },
      accepted: {
        label: "angenommen",
        cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
      },
      rejected: {
        label: "abgelehnt",
        cls: "bg-red-50 text-red-800 border-red-200",
      },
    } as const;
    const s = map[item.status];
    return <span className={`badge border ${s.cls}`}>{s.label}</span>;
  })();

  const isOpen = item.status === "open";

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link
          to={`/admin/firmen/${item.company_id}`}
          className="text-teal-700 hover:underline"
        >
          {item.company_name}
        </Link>
        <span>·</span>
        <span>{new Date(item.created_at).toLocaleString("de-DE")}</span>
        <span className="ml-auto">{statusBadge}</span>
      </div>

      {isOpen ? (
        <div className="mt-2 grid sm:grid-cols-[1fr_180px_140px] gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Technologie-Name"
            maxLength={120}
          />
          <select
            value={groupId ?? ""}
            onChange={(e) =>
              setGroupId(e.target.value ? Number(e.target.value) : null)
            }
            className="input"
            aria-label="Technologie-Gruppe"
          >
            <option value="">Ohne Gruppe</option>
            {groups.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            value={trl ?? ""}
            onChange={(e) =>
              setTrl(e.target.value ? Number(e.target.value) : null)
            }
            className="input"
          >
            <option value="">TRL (optional)</option>
            {Array.from({ length: 9 }, (_, k) => k + 1).map((n) => (
              <option key={n} value={n}>
                TRL {n}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mt-2 text-sm">
          <span className="font-medium">{item.name}</span>
          {item.trl !== null && (
            <span className="ml-2 text-xs text-slate-500">TRL {item.trl}</span>
          )}
        </div>
      )}

      {isOpen ? (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notizen (optional)"
          className="input min-h-[50px] text-sm mt-2"
          maxLength={2000}
        />
      ) : (
        item.notes && (
          <p className="mt-2 text-xs text-slate-600 whitespace-pre-wrap">
            {item.notes}
          </p>
        )
      )}

      <div className="mt-3 flex justify-end gap-2 text-sm">
        {isOpen && (
          <>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={disabled || name.trim().length < 1}
              onClick={() =>
                onAccept({
                  name: name.trim(),
                  link_to_company: true,
                  trl: trl ?? null,
                  notes: notes.trim(),
                  group_id: groupId,
                })
              }
            >
              Annehmen
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={disabled}
              onClick={onReject}
            >
              Ablehnen
            </button>
          </>
        )}
        <button
          type="button"
          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-40"
          disabled={disabled}
          onClick={() => {
            if (window.confirm("Vorschlag wirklich loeschen?")) onDelete();
          }}
        >
          Loeschen
        </button>
      </div>
    </li>
  );
}
