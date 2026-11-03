import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminUpdateCompanyInput,
  CompanyAdmin,
  CompanyStatus,
  CompanyTechnologySuggestion,
  TechnologySuggestionAcceptInput,
} from "@b2b/shared";
import { api, ApiError } from "../../lib/api.js";
import CompanyForm, {
  EMPTY_COMPANY_FORM,
  toUpdatePayload,
  type CompanyFormValue,
} from "../../components/CompanyForm.js";
import CompanyLogo from "../../components/CompanyLogo.js";
import SaveBar from "../../components/SaveBar.js";
import AdminNav from "./AdminNav.js";
import { useDirtyForm } from "../../hooks/useDirtyForm.js";
import { useRegisterUnsavedChanges } from "../../hooks/useUnsavedChangesPrompt.js";
import {
  diffCompany,
  type CompanyReviewSnapshot,
} from "../../lib/companyDiff.js";
import { useTechnologyGroups } from "../../hooks/useTaxonomies.js";

const STATUS_OPTIONS: { value: CompanyStatus; label: string }[] = [
  { value: "draft", label: "Entwurf" },
  { value: "pending", label: "In Prüfung" },
  { value: "approved", label: "Freigeschaltet" },
  { value: "suspended", label: "Abgelehnt" },
];

function companyToForm(c: CompanyAdmin): CompanyFormValue {
  return {
    name: c.name,
    display_name: c.display_name ?? "",
    description: c.description ?? "",
    website_url: c.website_url ?? "",
    street: c.street ?? "",
    postal_code: c.postal_code ?? "",
    city: c.city ?? "",
    country: c.country ?? "",
    contact_name: c.contact_name ?? "",
    contact_position: c.contact_position ?? "",
    contact_email: c.contact_email,
    contact_phone: c.contact_phone ?? "",
    size_id: c.size?.id ?? null,
    industry_ids: c.industries.map((i) => i.id),
    machine_ids: c.machines.map((m) => m.id),
    technologies: c.technologies.map((t) => ({
      technology_id: t.id,
      trl: t.trl,
      notes: t.notes ?? "",
    })),
    technology_suggestions: [],
    knowhows: c.knowhows.map((k) => ({
      knowhow_id: k.id,
      score: Math.min(k.score, 4),
    })),
    demos: c.demos.map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description ?? "",
    })),
    services: c.services.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description ?? "",
    })),
  };
}

export default function AdminFirmaEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const companyQuery = useQuery<CompanyAdmin>({
    queryKey: ["admin", "company", id],
    queryFn: () => api.get<CompanyAdmin>(`/api/admin/companies/${id}`),
    enabled: Boolean(id),
  });

  const [form, setForm] = useState<CompanyFormValue>(EMPTY_COMPANY_FORM);
  const [initial, setInitial] = useState<CompanyFormValue | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [initialUserEmail, setInitialUserEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<CompanyStatus>("pending");
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = companyQuery.data;
    if (!c) return;
    const v = companyToForm(c);
    setForm(v);
    setInitial(v);
    setUserEmail(c.user_email ?? "");
    setInitialUserEmail(c.user_email ?? "");
    setStatus(c.status);
    setAnonymous(c.anonymous);
  }, [companyQuery.data]);

  const isDirty =
    useDirtyForm(form, initial) ||
    userEmail !== (initialUserEmail ?? "") ||
    (initial !== null && companyQuery.data?.status !== status);
  useRegisterUnsavedChanges(isDirty);

  const changedFields = useMemo(() => {
    const snapshot =
      (companyQuery.data?.last_reviewed_snapshot as CompanyReviewSnapshot | null) ??
      null;
    return diffCompany(form, snapshot, {
      technologySuggestions: companyQuery.data?.technology_suggestions ?? [],
      lastReviewedAt: companyQuery.data?.last_reviewed_at ?? null,
    });
  }, [
    form,
    companyQuery.data?.last_reviewed_snapshot,
    companyQuery.data?.technology_suggestions,
    companyQuery.data?.last_reviewed_at,
  ]);

  const hasSnapshot =
    companyQuery.data?.last_reviewed_snapshot != null &&
    !!companyQuery.data.last_reviewed_at;
  // Sammel-Marker "tech-suggestions" nicht in den Zaehler einbeziehen,
  // damit er sich nicht doppelt zu den einzelnen Vorschlaegen aufaddiert.
  const changedCount = Array.from(changedFields).filter(
    (f) => f !== "tech-suggestions"
  ).length;

  const save = useMutation({
    mutationFn: (input: AdminUpdateCompanyInput) =>
      api.put<CompanyAdmin>(`/api/admin/companies/${id}`, input),
    onSuccess: (updated) => {
      setMessage("Gespeichert.");
      setError(null);
      qc.invalidateQueries({ queryKey: ["admin", "company", id] });
      qc.invalidateQueries({ queryKey: ["admin", "companies"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      const next = companyToForm(updated);
      setForm(next);
      setInitial(next);
      setUserEmail(updated.user_email ?? "");
      setInitialUserEmail(updated.user_email ?? "");
      setStatus(updated.status);
      setAnonymous(updated.anonymous);
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    },
  });

  const saveAnonymous = useMutation({
    mutationFn: (value: boolean) =>
      api.patch<{ anonymous: boolean }>(`/api/admin/companies/${id}/anonymous`, {
        anonymous: value,
      }),
    onSuccess: (result) => {
      setAnonymous(result.anonymous);
      setMessage(result.anonymous ? "Firma wird anonym angezeigt." : "Anonymität aufgehoben.");
      setError(null);
      qc.invalidateQueries({ queryKey: ["admin", "company", id] });
      qc.invalidateQueries({ queryKey: ["admin", "companies"] });
      qc.invalidateQueries({ queryKey: ["admin", "graph"] });
      qc.invalidateQueries({ queryKey: ["graph"] });
    },
    onError: (err) => {
      setAnonymous(companyQuery.data?.anonymous ?? false);
      setMessage(null);
      setError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    },
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("logo", file);
      return api.post<{ ok: true; logo_path: string }>(
        `/api/admin/companies/${id}/logo`,
        fd
      );
    },
    onSuccess: () => {
      setMessage("Logo aktualisiert.");
      setError(null);
      qc.invalidateQueries({ queryKey: ["admin", "company", id] });
      qc.invalidateQueries({ queryKey: ["admin", "companies"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.message : "Upload fehlgeschlagen.");
    },
  });

  const markReviewed = useMutation({
    mutationFn: () =>
      api.post<{ ok: true }>(`/api/admin/companies/${id}/mark-reviewed`, {}),
    onSuccess: () => {
      setMessage("Als geprueft markiert.");
      setError(null);
      qc.invalidateQueries({ queryKey: ["admin", "company", id] });
    },
    onError: (err) => {
      setMessage(null);
      setError(
        err instanceof ApiError ? err.message : "Aktion fehlgeschlagen."
      );
    },
  });

  const sendCredentials = useMutation({
    mutationFn: () =>
      api.post<{ ok: true }>(`/api/admin/companies/${id}/send-credentials`),
    onSuccess: () => {
      setMessage("Zugangsdaten wurden per E-Mail gesendet.");
      setError(null);
    },
    onError: (err) => {
      setMessage(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Zugangsdaten konnten nicht gesendet werden."
      );
    },
  });

  const invalidateAfterSuggestionChange = () => {
    qc.invalidateQueries({ queryKey: ["admin", "company", id] });
    qc.invalidateQueries({ queryKey: ["admin", "technology-suggestions"] });
    qc.invalidateQueries({ queryKey: ["taxonomies", "technologies"] });
  };

  const acceptSuggestion = useMutation({
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
      invalidateAfterSuggestionChange();
    },
    onError: (err) => {
      setMessage(null);
      setError(
        err instanceof ApiError ? err.message : "Aktion fehlgeschlagen."
      );
    },
  });

  const rejectSuggestion = useMutation({
    mutationFn: (suggestionId: string) =>
      api.post<{ ok: true }>(
        `/api/admin/technology-suggestions/${suggestionId}/reject`,
        {}
      ),
    onSuccess: () => {
      setMessage("Vorschlag abgelehnt.");
      setError(null);
      invalidateAfterSuggestionChange();
    },
    onError: (err) => {
      setMessage(null);
      setError(
        err instanceof ApiError ? err.message : "Aktion fehlgeschlagen."
      );
    },
  });

  const deleteSuggestion = useMutation({
    mutationFn: (suggestionId: string) =>
      api.delete<{ ok: true }>(
        `/api/admin/technology-suggestions/${suggestionId}`
      ),
    onSuccess: () => {
      setMessage("Vorschlag geloescht.");
      setError(null);
      invalidateAfterSuggestionChange();
    },
    onError: (err) => {
      setMessage(null);
      setError(
        err instanceof ApiError ? err.message : "Aktion fehlgeschlagen."
      );
    },
  });

  const removeCompany = useMutation({
    mutationFn: () =>
      api.delete<{ ok: true }>(`/api/admin/companies/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "companies"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      navigate("/admin/firmen?status=suspended");
    },
    onError: (err) => {
      setMessage(null);
      setError(
        err instanceof ApiError
          ? err.message
          : "Löschen fehlgeschlagen."
      );
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ ...toUpdatePayload(form), status, user_email: userEmail });
  };

  const onLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadLogo.mutate(file);
  };

  const logoSlot = useMemo(() => {
    const company = companyQuery.data;
    if (!company) return null;
    return (
      <div className="flex items-center gap-6">
        <CompanyLogo src={company.logo_url} name={company.name} size="lg" />
        <div className="space-y-2">
          <label className="btn-secondary cursor-pointer inline-block">
            {company.logo_url ? "Logo ersetzen" : "Logo hochladen"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onLogoChange}
              className="hidden"
              disabled={uploadLogo.isPending}
            />
          </label>
          {uploadLogo.isPending && (
            <p className="text-sm text-slate-500">Wird hochgeladen ...</p>
          )}
          <p className="text-xs text-slate-500 max-w-md">
            PNG, JPEG, WebP oder GIF. Max. 2 MB. Wird auf 512x512 WebP skaliert
            (ohne Beschneiden).
          </p>
        </div>
      </div>
    );
  }, [companyQuery.data, uploadLogo.isPending]);

  if (companyQuery.isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-slate-500">
        Laden ...
      </div>
    );
  }
  if (companyQuery.isError || !companyQuery.data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-semibold mb-6">Admin</h1>
        <AdminNav />
        <div className="text-red-600">Firma konnte nicht geladen werden.</div>
        <div className="mt-4">
          <Link to="/admin/firmen" className="btn-secondary">
            Zurück zur Liste
          </Link>
        </div>
      </div>
    );
  }

  const company = companyQuery.data;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-32">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Firma bearbeiten</h2>
        <Link
          to="/admin/firmen"
          className="text-sm text-slate-600 hover:underline"
        >
          Zurück zur Liste
        </Link>
      </div>

      {hasSnapshot && (
        <div
          className={[
            "card p-4 mb-6 flex flex-wrap items-center justify-between gap-3",
            changedCount > 0
              ? "border-amber-300 bg-amber-50"
              : "border-emerald-200 bg-emerald-50",
          ].join(" ")}
        >
          <div className="text-sm">
            {changedCount > 0 ? (
              <>
                <strong>{changedCount}</strong> Feld(er) wurden seit der
                letzten Freigabe geaendert.
              </>
            ) : (
              <>Keine Aenderungen seit der letzten Freigabe.</>
            )}
            {company.last_reviewed_at && (
              <span className="text-slate-500 ml-2">
                (Stand:{" "}
                {new Date(company.last_reviewed_at).toLocaleDateString("de-DE")}
                )
              </span>
            )}
          </div>
          {changedCount > 0 && (
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => markReviewed.mutate()}
              disabled={markReviewed.isPending}
            >
              {markReviewed.isPending
                ? "Wird markiert ..."
                : "Als geprueft markieren"}
            </button>
          )}
        </div>
      )}

      {company.technology_suggestions &&
        company.technology_suggestions.length > 0 && (
          <TechnologySuggestionsCard
            suggestions={company.technology_suggestions}
            changedFields={changedFields}
            onAccept={(s, input) =>
              acceptSuggestion.mutate({ suggestionId: s.id, input })
            }
            onReject={(s) => rejectSuggestion.mutate(s.id)}
            onDelete={(s) => deleteSuggestion.mutate(s.id)}
            isPending={
              acceptSuggestion.isPending ||
              rejectSuggestion.isPending ||
              deleteSuggestion.isPending
            }
          />
        )}

      <div className="card p-6 mb-6">
        <h3 className="font-semibold">Status</h3>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as CompanyStatus)}
          className="input mt-2 max-w-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-2">
          Bei Aenderung auf "Freigeschaltet" oder "Abgelehnt" wird die Firma per
          E-Mail informiert.
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-grass-600"
            checked={anonymous}
            disabled={saveAnonymous.isPending}
            onChange={(event) => {
              const next = event.target.checked;
              setAnonymous(next);
              saveAnonymous.mutate(next);
            }}
          />
          <span>
            Im Netzwerk anonym anzeigen
            <span className="mt-1 block text-xs text-slate-500">
              Ohne Namen und ohne Profil-Link. Gilt auch für Entwürfe: die Firma
              erscheint dann im Graphen, bleibt aber unerkannt.
            </span>
          </span>
        </label>
        <button
          type="button"
          className="btn-secondary mt-4"
          disabled={sendCredentials.isPending}
          onClick={() => {
            if (
              confirm(
                `Neue Zugangsdaten an „${company.name}“ (${company.user_email}) senden? Das bisherige Passwort wird ungültig. Der Status bleibt unverändert.`
              )
            ) {
              sendCredentials.mutate();
            }
          }}
        >
          {sendCredentials.isPending
            ? "Wird gesendet ..."
            : "Zugangsdaten senden"}
        </button>
      </div>

      {company.status === "suspended" && (
        <div className="card p-6 mb-6 border-red-200 bg-red-50">
          <h3 className="font-semibold text-red-900">Endgültig löschen</h3>
          <p className="text-sm text-red-800 mt-2">
            Firma, Login und alle zugehörigen Daten werden unwiderruflich
            entfernt.
          </p>
          <button
            type="button"
            className="btn-danger mt-4"
            disabled={removeCompany.isPending}
            onClick={() => {
              if (
                confirm(
                  `„${company.name}“ und den zugehörigen Login wirklich endgültig löschen? Das kann nicht rückgängig gemacht werden.`
                )
              ) {
                removeCompany.mutate();
              }
            }}
          >
            {removeCompany.isPending
              ? "Wird gelöscht ..."
              : "Endgültig löschen"}
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <fieldset className="card p-6 space-y-4">
          <legend className="text-lg font-semibold px-2 -ml-2">
            Login-Zugang
          </legend>
          <div>
            <label className="label">
              Login-E-Mail <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="input"
              maxLength={200}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-slate-500">
              Verknüpfte E-Mail-Adresse für den Login dieses Firmen-Accounts.
              Unabhängig von der öffentlichen Kontakt-E-Mail.
            </p>
          </div>
        </fieldset>

        <CompanyForm
          value={form}
          onChange={setForm}
          logoSlot={logoSlot}
          changedFields={changedFields}
          existingTechnologySuggestions={company.technology_suggestions ?? []}
        />

        {message && <p className="text-emerald-700 text-sm">{message}</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <SaveBar
          visible={isDirty || save.isPending}
          saving={save.isPending}
          message={
            isDirty
              ? "Sie haben ungespeicherte Aenderungen."
              : "Speichern laeuft ..."
          }
        >
          <Link
            to="/admin/firmen"
            className="text-sm text-slate-600 hover:underline"
          >
            Abbrechen
          </Link>
        </SaveBar>
      </form>
    </div>
  );
}

function TechnologySuggestionsCard({
  suggestions,
  changedFields,
  onAccept,
  onReject,
  onDelete,
  isPending,
}: {
  suggestions: CompanyTechnologySuggestion[];
  changedFields?: Set<string>;
  onAccept: (
    s: CompanyTechnologySuggestion,
    input: TechnologySuggestionAcceptInput
  ) => void;
  onReject: (s: CompanyTechnologySuggestion) => void;
  onDelete: (s: CompanyTechnologySuggestion) => void;
  isPending: boolean;
}) {
  const newCount = suggestions.filter((s) =>
    changedFields?.has(`tech-suggestion:${s.id}`)
  ).length;
  return (
    <div
      className={[
        "card p-6 mb-6 space-y-3",
        newCount > 0 ? "border-amber-300 bg-amber-50/40" : "",
      ].join(" ")}
    >
      <div>
        <h3 className="font-semibold">Technologie-Vorschlaege dieser Firma</h3>
        <p className="text-xs text-slate-500">
          Beim Annehmen wird, falls noch nicht vorhanden, eine globale
          Technologie angelegt und automatisch dieser Firma zugeordnet.
        </p>
        {newCount > 0 && (
          <p className="text-xs text-amber-700 mt-1">
            {newCount} neue(r) Vorschlag(e) seit der letzten Freigabe.
          </p>
        )}
      </div>
      <ul className="space-y-3">
        {suggestions.map((s) => (
          <SuggestionRow
            key={s.id}
            suggestion={s}
            isNew={changedFields?.has(`tech-suggestion:${s.id}`) ?? false}
            onAccept={(input) => onAccept(s, input)}
            onReject={() => onReject(s)}
            onDelete={() => onDelete(s)}
            disabled={isPending}
          />
        ))}
      </ul>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  isNew,
  onAccept,
  onReject,
  onDelete,
  disabled,
}: {
  suggestion: CompanyTechnologySuggestion;
  isNew: boolean;
  onAccept: (input: TechnologySuggestionAcceptInput) => void;
  onReject: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [name, setName] = useState(suggestion.name);
  const [trl, setTrl] = useState<number | null>(suggestion.trl);
  const [notes, setNotes] = useState(suggestion.notes ?? "");
  const [groupId, setGroupId] = useState<number | null>(null);
  const groups = useTechnologyGroups();
  const isOpen = suggestion.status === "open";

  const statusBadge = (() => {
    const map = {
      open: {
        label: "offen",
        cls: "bg-slate-100 text-slate-700 border-slate-200",
      },
      accepted: {
        label: "angenommen",
        cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
      },
      rejected: {
        label: "abgelehnt",
        cls: "bg-red-50 text-red-800 border-red-200",
      },
    } as const;
    const s = map[suggestion.status];
    return <span className={`badge border ${s.cls}`}>{s.label}</span>;
  })();

  return (
    <li
      className={[
        "rounded-md border border-line bg-white p-3 space-y-2",
        isNew ? "ring-2 ring-amber-300" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span>
            Eingereicht am{" "}
            {new Date(suggestion.created_at).toLocaleDateString("de-DE")}
          </span>
          {isNew && (
            <span className="badge border bg-amber-50 text-amber-800 border-amber-200">
              neu seit Freigabe
            </span>
          )}
        </div>
        {statusBadge}
      </div>
      {isOpen ? (
        <div className="grid sm:grid-cols-[1fr_180px_140px] gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Technologie-Name"
            className="input"
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
            onChange={(e) => setTrl(e.target.value ? Number(e.target.value) : null)}
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
        <div className="text-sm">
          <span className="font-medium">{suggestion.name}</span>
          {suggestion.trl !== null && (
            <span className="ml-2 text-xs text-slate-500">
              TRL {suggestion.trl}
            </span>
          )}
        </div>
      )}
      {isOpen ? (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notizen (optional)"
          className="input min-h-[50px] text-sm"
          maxLength={2000}
        />
      ) : (
        suggestion.notes && (
          <p className="text-xs text-slate-600 whitespace-pre-wrap">
            {suggestion.notes}
          </p>
        )
      )}
      <div className="flex justify-end gap-2 text-sm">
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
