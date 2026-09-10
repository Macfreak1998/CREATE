import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyOwn } from "@b2b/shared";
import { api, ApiError } from "../lib/api.js";
import CompanyForm, {
  EMPTY_COMPANY_FORM,
  toUpdatePayload,
  type CompanyFormValue,
} from "../components/CompanyForm.js";
import CompanyLogo from "../components/CompanyLogo.js";
import SaveBar from "../components/SaveBar.js";
import { useDirtyForm } from "../hooks/useDirtyForm.js";
import { usePasswordChange } from "../hooks/useAuth.js";
import { useRegisterUnsavedChanges } from "../hooks/useUnsavedChangesPrompt.js";

type CompanyStatus = CompanyOwn["status"];

const STATUS_LABEL: Record<CompanyStatus, string> = {
  draft: "Entwurf",
  pending: "In Prüfung",
  approved: "Freigeschaltet",
  suspended: "Abgelehnt",
};

const STATUS_COLOR: Record<CompanyStatus, string> = {
  draft: "bg-blue-100 text-blue-800 border-blue-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  suspended: "bg-slate-200 text-slate-800 border-slate-300",
};

function companyToForm(c: CompanyOwn): CompanyFormValue {
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

export default function Profil() {
  const qc = useQueryClient();
  const companyQuery = useQuery<CompanyOwn>({
    queryKey: ["me", "company"],
    queryFn: () => api.get<CompanyOwn>("/api/me/company"),
  });

  const [form, setForm] = useState<CompanyFormValue>(EMPTY_COMPANY_FORM);
  const [initial, setInitial] = useState<CompanyFormValue | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [initialUserEmail, setInitialUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const changePassword = usePasswordChange();

  useEffect(() => {
    const c = companyQuery.data;
    if (!c) return;
    const v = companyToForm(c);
    setForm(v);
    setInitial(v);
    setUserEmail(c.user_email);
    setInitialUserEmail(c.user_email);
  }, [companyQuery.data]);

  const isDirty =
    useDirtyForm(form, initial) || userEmail !== (initialUserEmail ?? "");
  useRegisterUnsavedChanges(isDirty);

  const save = useMutation({
    mutationFn: (input: CompanyFormValue) =>
      api.put<CompanyOwn>("/api/me/company", {
        ...toUpdatePayload(input),
        user_email: userEmail,
      }),
    onSuccess: (updated) => {
      setMessage(
        "Gespeichert. Änderungen werden vom Admin geprüft. Ihr Profil ist bis zur Freigabe nicht öffentlich sichtbar."
      );
      setError(null);
      qc.invalidateQueries({ queryKey: ["me", "company"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      const next = companyToForm(updated);
      setForm(next);
      setInitial(next);
      setUserEmail(updated.user_email);
      setInitialUserEmail(updated.user_email);
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    },
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("logo", file);
      return api.post<{ ok: true; logo_path: string }>("/api/me/company/logo", fd);
    },
    onSuccess: () => {
      setMessage("Logo aktualisiert. Änderungen werden vom Admin geprüft.");
      setError(null);
      qc.invalidateQueries({ queryKey: ["me", "company"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.message : "Upload fehlgeschlagen.");
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    save.mutate(form);
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
            (ohne Beschneiden). Logo-Aenderungen werden vom Admin freigegeben.
          </p>
        </div>
      </div>
    );
  }, [companyQuery.data, uploadLogo.isPending]);

  if (companyQuery.isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-slate-500">Laden ...</div>
    );
  }
  if (companyQuery.isError || !companyQuery.data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-red-600">
        Profil konnte nicht geladen werden.
      </div>
    );
  }

  const company = companyQuery.data;
  const isDraft = company.status === "draft";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-32">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-semibold">Mein Unternehmensprofil</h1>
        <span className={`badge border ${STATUS_COLOR[company.status]}`}>
          {STATUS_LABEL[company.status]}
        </span>
      </div>
      {company.status === "draft" && (
        <p className="mt-2 text-sm text-blue-700">
          Ihr Profil ist als Entwurf angelegt und kann von Ihnen bearbeitet
          werden. Sobald Sie Ihre Änderungen speichern, wird Ihr Profil nach
          Überprüfung durch das CREATE-Team veröffentlicht
        </p>
      )}
      {company.status === "pending" && (
        <p className="mt-2 text-sm text-amber-700">
          Ihr Profil ist in Prüfung und noch nicht öffentlich sichtbar. Nach
          Speichern werden Änderungen erneut zur Freigabe vorgelegt.
        </p>
      )}
      {company.status === "approved" && (
        <p className="mt-2 text-sm text-emerald-700">
          Ihr Profil ist freigeschaltet und öffentlich sichtbar. Speichern oder
          erneutes Vorlegen nimmt es bis zur nächsten Freigabe vom Netz.
        </p>
      )}
      {company.status === "suspended" && (
        <p className="mt-2 text-sm text-slate-700">
          Ihr Profil wurde abgelehnt und ist aktuell nicht öffentlich sichtbar.
          Passen Sie die Angaben an und speichern Sie, um eine erneute Prüfung
          anzustossen.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
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
              autoComplete="username"
            />
            <p className="mt-1 text-xs text-slate-500">
              Mit dieser E-Mail melden Sie sich an. Unabhängig von der
              öffentlichen Kontakt-E-Mail im Profil.
            </p>
          </div>
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <p className="text-sm font-medium text-slate-800">Passwort ändern</p>
            <div>
              <label className="label" htmlFor="current-password">
                Aktuelles Passwort
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="label" htmlFor="new-password">
                Neues Passwort
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                minLength={10}
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-slate-500">Mindestens 10 Zeichen.</p>
            </div>
            <div>
              <label className="label" htmlFor="confirm-password">
                Neues Passwort bestätigen
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                minLength={10}
                autoComplete="new-password"
              />
            </div>
            {passwordMessage && (
              <p className="text-sm text-emerald-700">{passwordMessage}</p>
            )}
            {passwordError && (
              <p className="text-sm text-red-600">{passwordError}</p>
            )}
            <button
              type="button"
              className="btn-secondary"
              disabled={changePassword.isPending}
              onClick={() => {
                setPasswordMessage(null);
                setPasswordError(null);
                if (!currentPassword || !newPassword) {
                  setPasswordError("Bitte beide Passwortfelder ausfüllen.");
                  return;
                }
                if (newPassword.length < 10) {
                  setPasswordError("Neues Passwort: mindestens 10 Zeichen.");
                  return;
                }
                if (newPassword !== confirmPassword) {
                  setPasswordError("Die neuen Passwörter stimmen nicht überein.");
                  return;
                }
                changePassword.mutate(
                  {
                    current_password: currentPassword,
                    new_password: newPassword,
                  },
                  {
                    onSuccess: () => {
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordMessage("Passwort wurde geändert.");
                    },
                    onError: (err) => {
                      setPasswordError(
                        err instanceof ApiError
                          ? err.message
                          : "Passwortänderung fehlgeschlagen."
                      );
                    },
                  }
                );
              }}
            >
              {changePassword.isPending ? "Speichern ..." : "Passwort speichern"}
            </button>
          </div>
        </fieldset>

        <CompanyForm
          value={form}
          onChange={setForm}
          logoSlot={logoSlot}
          existingTechnologySuggestions={company.technology_suggestions ?? []}
        />

        {message && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            {message}
          </div>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <SaveBar
          visible={isDirty || isDraft || save.isPending}
          saving={save.isPending}
          message={
            isDirty
              ? "Sie haben ungespeicherte Aenderungen."
              : isDraft
                ? "Speichern legt Ihr Profil zur Prüfung vor."
                : "Speichern laeuft ..."
          }
          variant={!isDirty && isDraft ? "info" : "warning"}
        />
      </form>
    </div>
  );
}
