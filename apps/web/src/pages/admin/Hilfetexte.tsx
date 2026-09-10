import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SECTION_KEYS,
  SECTION_LABELS,
  type SectionDescriptions,
  type SectionKey,
} from "@b2b/shared";
import { api, ApiError } from "../../lib/api.js";
import AdminNav from "./AdminNav.js";

const ADMIN_KEY = ["admin", "section-descriptions"] as const;

type FormState = Record<SectionKey, string>;

const EMPTY: FormState = SECTION_KEYS.reduce((acc, key) => {
  acc[key] = "";
  return acc;
}, {} as FormState);

export default function AdminHilfetexte() {
  const qc = useQueryClient();
  const stored = useQuery<SectionDescriptions>({
    queryKey: ADMIN_KEY,
    queryFn: () =>
      api.get<SectionDescriptions>("/api/admin/section-descriptions"),
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!stored.data) return;
    setForm({ ...EMPTY, ...stored.data });
  }, [stored.data]);

  const save = useMutation({
    mutationFn: (descriptions: FormState) =>
      api.put<SectionDescriptions>("/api/admin/section-descriptions", {
        descriptions,
      }),
    onSuccess: (data) => {
      qc.setQueryData(ADMIN_KEY, data);
      qc.invalidateQueries({ queryKey: ["section-descriptions"] });
      setSuccess("Hilfetexte gespeichert.");
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
    setError(null);
    setSuccess(null);
    save.mutate(form);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Hilfetexte</h2>
        <p className="mt-2 text-sm text-slate-600">
          Erklärung je Abschnitt. Der Text erscheint als Hinweis neben der
          Überschrift — in der Suche bei den Filtern und im Firmenformular beim
          Anlegen oder Bearbeiten eines Profils. Leere Felder blenden den
          Hinweis aus.
        </p>

        {stored.isLoading ? (
          <p className="mt-4 text-slate-500">Laden ...</p>
        ) : stored.isError ? (
          <p className="mt-4 text-red-600">Fehler beim Laden.</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            {SECTION_KEYS.map((key) => (
              <div key={key}>
                <label htmlFor={`section-${key}`} className="label">
                  {SECTION_LABELS[key]}
                </label>
                <textarea
                  id={`section-${key}`}
                  value={form[key]}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="input"
                  rows={3}
                  maxLength={2000}
                  placeholder="Kurze Erklärung für Besucher (optional)"
                />
              </div>
            ))}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-700">{success}</p>}

            <button
              type="submit"
              className="btn-primary"
              disabled={save.isPending}
            >
              {save.isPending ? "Speichere ..." : "Speichern"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
