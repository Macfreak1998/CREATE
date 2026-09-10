import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeedbackList } from "@b2b/shared";
import { api } from "../../lib/api.js";
import AdminNav from "./AdminNav.js";

type Filter = "all" | "open" | "handled";

export default function AdminFeedback() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");
  const [page, setPage] = useState(1);

  const queryKey = ["admin", "feedback", filter, page] as const;

  const list = useQuery<FeedbackList>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (filter === "open") params.set("handled", "false");
      if (filter === "handled") params.set("handled", "true");
      return api.get<FeedbackList>(`/api/admin/feedback?${params.toString()}`);
    },
  });

  const setHandled = useMutation({
    mutationFn: ({ id, handled }: { id: string; handled: boolean }) =>
      api.patch<{ ok: true }>(`/api/admin/feedback/${id}`, { handled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "feedback"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api.delete<{ ok: true }>(`/api/admin/feedback/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "feedback"] });
    },
  });

  const totalPages = list.data
    ? Math.max(1, Math.ceil(list.data.total / list.data.limit))
    : 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />

      <section className="card p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold">Feedback</h2>
          <div className="flex gap-2 text-sm">
            {(["open", "handled", "all"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
                className={
                  filter === value
                    ? "px-3 py-1 rounded-md bg-teal-600 text-white"
                    : "px-3 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                }
              >
                {value === "open"
                  ? "Offen"
                  : value === "handled"
                  ? "Erledigt"
                  : "Alle"}
              </button>
            ))}
          </div>
        </div>

        {list.isLoading ? (
          <p className="mt-4 text-slate-500">Laden ...</p>
        ) : list.isError ? (
          <p className="mt-4 text-red-600">Feedback konnte nicht geladen werden.</p>
        ) : !list.data || list.data.items.length === 0 ? (
          <p className="mt-4 text-slate-500">Keine Einträge.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {list.data.items.map((item) => (
              <li key={item.id} className="py-4">
                <div className="flex justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <a
                        href={`mailto:${item.email}`}
                        className="text-teal-700 hover:underline break-all"
                      >
                        {item.email}
                      </a>
                      <span>·</span>
                      <span>{new Date(item.created_at).toLocaleString("de-DE")}</span>
                      {item.handled && (
                        <span className="badge bg-green-100 text-green-700">
                          erledigt
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap break-words">
                      {item.message}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() =>
                        setHandled.mutate({
                          id: item.id,
                          handled: !item.handled,
                        })
                      }
                      disabled={setHandled.isPending}
                    >
                      {item.handled ? "Als offen markieren" : "Als erledigt markieren"}
                    </button>
                    <button
                      type="button"
                      className="btn-danger text-xs"
                      onClick={() => {
                        if (confirm("Eintrag wirklich löschen?")) {
                          remove.mutate(item.id);
                        }
                      }}
                      disabled={remove.isPending}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {list.data && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between text-sm">
            <button
              type="button"
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Zurück
            </button>
            <span className="text-slate-500">
              Seite {page} von {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Weiter
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
