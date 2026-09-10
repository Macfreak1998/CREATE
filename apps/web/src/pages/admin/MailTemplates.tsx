import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MailTemplateEntry, MailTemplates, MailTemplatesInput } from "@b2b/shared";
import { api, ApiError } from "../../lib/api.js";
import AdminNav from "./AdminNav.js";

const ADMIN_KEY = ["admin", "mail-templates"] as const;

type FormState = Record<string, { subject: string; body: string }>;

export default function AdminMailTemplates() {
  const qc = useQueryClient();
  const stored = useQuery<MailTemplates>({
    queryKey: ADMIN_KEY,
    queryFn: () => api.get<MailTemplates>("/api/admin/mail-templates"),
  });

  const [form, setForm] = useState<FormState>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!stored.data) return;
    const next: FormState = {};
    for (const t of stored.data.templates) {
      next[t.key] = { subject: t.subject, body: t.body };
    }
    setForm(next);
  }, [stored.data]);

  const save = useMutation({
    mutationFn: (input: MailTemplatesInput) =>
      api.put<MailTemplates>("/api/admin/mail-templates", input),
    onSuccess: (data) => {
      qc.setQueryData(ADMIN_KEY, data);
      setSuccess("Mail-Templates gespeichert.");
      setError(null);
    },
    onError: (err) => {
      setSuccess(null);
      setError(
        err instanceof ApiError ? err.message : "Speichern fehlgeschlagen."
      );
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!stored.data) return;
    setError(null);
    setSuccess(null);
    save.mutate({
      templates: stored.data.templates.map((t) => ({
        key: t.key,
        subject: form[t.key]?.subject ?? t.subject,
        body: form[t.key]?.body ?? t.body,
      })),
    });
  };

  const resetOne = (t: MailTemplateEntry) => {
    setForm((prev) => ({
      ...prev,
      [t.key]: { subject: t.default_subject, body: t.default_body },
    }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Mail-Templates</h2>
        <p className="mt-2 text-sm text-slate-600">
          Betreff und Text der System-E-Mails. Platzhalter in doppelten
          geschweiften Klammern werden beim Versand ersetzt (z.&nbsp;B.{" "}
          <code className="text-xs bg-slate-100 px-1 rounded">
            {"{{companyName}}"}
          </code>
          ). Leere Felder verwenden den Standardtext.
        </p>

        {stored.isLoading ? (
          <p className="mt-4 text-slate-500">Laden ...</p>
        ) : stored.isError || !stored.data ? (
          <p className="mt-4 text-red-600">Fehler beim Laden.</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-8">
            {stored.data.templates.map((t) => (
              <div
                key={t.key}
                className="border border-slate-200 rounded-md p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-semibold">{t.label}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Platzhalter:{" "}
                      {t.placeholders.map((p) => `{{${p}}}`).join(", ") ||
                        "keine"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => resetOne(t)}
                  >
                    Standard wiederherstellen
                  </button>
                </div>
                <div>
                  <label className="label" htmlFor={`mail-subject-${t.key}`}>
                    Betreff
                  </label>
                  <input
                    id={`mail-subject-${t.key}`}
                    className="input"
                    maxLength={500}
                    value={form[t.key]?.subject ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [t.key]: {
                          subject: e.target.value,
                          body: prev[t.key]?.body ?? "",
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`mail-body-${t.key}`}>
                    Text
                  </label>
                  <textarea
                    id={`mail-body-${t.key}`}
                    className="input font-mono text-sm"
                    rows={10}
                    maxLength={20000}
                    value={form[t.key]?.body ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [t.key]: {
                          subject: prev[t.key]?.subject ?? "",
                          body: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            ))}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-700">{success}</p>}

            <button
              type="submit"
              className="btn-primary"
              disabled={save.isPending}
            >
              {save.isPending ? "Speichern ..." : "Templates speichern"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
