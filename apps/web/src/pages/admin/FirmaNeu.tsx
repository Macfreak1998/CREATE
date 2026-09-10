import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AdminCreateCompanyInput,
  AdminCreateCompanyResponse,
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
import { useRegisterUnsavedChanges } from "../../hooks/useUnsavedChangesPrompt.js";

export default function AdminFirmaNeu() {
  const qc = useQueryClient();

  const [form, setForm] = useState<CompanyFormValue>(EMPTY_COMPANY_FORM);
  const [userEmail, setUserEmail] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoWarning, setLogoWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminCreateCompanyResponse | null>(null);

  const logoPreview = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : null),
    [logoFile]
  );
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const isDirty =
    JSON.stringify(form) !== JSON.stringify(EMPTY_COMPANY_FORM) ||
    userEmail.length > 0 ||
    logoFile !== null;
  useRegisterUnsavedChanges(isDirty && !result);

  const createMutation = useMutation({
    mutationFn: async (
      payload: AdminCreateCompanyInput
    ): Promise<{
      company: AdminCreateCompanyResponse;
      logoFailed: boolean;
    }> => {
      const company = await api.post<AdminCreateCompanyResponse>(
        "/api/admin/companies",
        payload
      );
      let logoFailed = false;
      if (logoFile) {
        try {
          const fd = new FormData();
          fd.append("logo", logoFile);
          await api.post(`/api/admin/companies/${company.id}/logo`, fd);
        } catch {
          logoFailed = true;
        }
      }
      return { company, logoFailed };
    },
    onSuccess: ({ company, logoFailed }) => {
      qc.invalidateQueries({ queryKey: ["admin", "companies"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      setResult(company);
      setLogoWarning(
        logoFailed
          ? "Firma wurde als Entwurf angelegt, aber das Logo konnte nicht hochgeladen werden. Bitte später in der Bearbeitung erneut hochladen."
          : null
      );
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Anlegen fehlgeschlagen.");
    },
  });

  const onLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLogoFile(e.target.files?.[0] ?? null);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload: AdminCreateCompanyInput = {
      company: { ...toUpdatePayload(form), status: "draft" },
      user: { email: userEmail },
    };
    createMutation.mutate(payload);
  };

  if (result) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-semibold mb-6">Admin</h1>
        <AdminNav />

        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-emerald-700">
              Entwurf wurde angelegt
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              <strong>{result.name}</strong> wurde als Entwurf gespeichert.
            </p>
          </div>

          {logoWarning && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {logoWarning}
            </div>
          )}

          <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              Nächster Schritt: Freigabe durch Supervisor
            </p>
            <p className="mt-1 text-sm text-blue-800">
              Die Firma ist noch nicht öffentlich sichtbar. Ein Supervisor kann
              den Entwurf in der Firmenliste prüfen und freischalten. Erst bei
              der Freigabe werden die Zugangsdaten automatisch per E-Mail an die
              Firma versendet.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Link to="/admin/firmen?status=draft" className="btn-secondary">
              Zu den Entwürfen
            </Link>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setForm(EMPTY_COMPANY_FORM);
                setUserEmail("");
                setLogoFile(null);
                setLogoWarning(null);
              }}
              className="btn-primary"
            >
              Weitere Firma anlegen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Firma anlegen</h2>
        <Link to="/admin/firmen" className="text-sm text-slate-600 hover:underline">
          Zurück zur Liste
        </Link>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 p-4 mb-6 text-sm text-blue-800">
        Firmen werden als <strong>Entwurf</strong> angelegt. Die Zugangsdaten
        werden erst bei Freigabe durch einen Supervisor per E-Mail versendet.
      </div>

      <form onSubmit={onSubmit} className="space-y-6 pb-32">
        <CompanyForm
          value={form}
          onChange={setForm}
          logoSlot={
            <div className="flex items-center gap-6">
              <CompanyLogo
                src={logoPreview}
                name={form.name || "?"}
                size="lg"
              />
              <div className="flex items-center gap-3">
                <label className="btn-secondary cursor-pointer">
                  Logo auswaehlen
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={onLogoChange}
                    className="hidden"
                  />
                </label>
                {logoFile && (
                  <button
                    type="button"
                    onClick={() => setLogoFile(null)}
                    className="text-sm text-slate-600 hover:underline"
                  >
                    Entfernen
                  </button>
                )}
              </div>
            </div>
          }
        />

        <fieldset className="card p-6 space-y-4">
          <legend className="text-lg font-semibold px-2 -ml-2">
            Login-Zugang für die Firma
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
              Das Passwort wird automatisch generiert und bei Freigabe per
              E-Mail an diese Adresse gesendet.
            </p>
          </div>
        </fieldset>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <SaveBar
          visible={isDirty || createMutation.isPending}
          saving={createMutation.isPending}
          saveLabel="Entwurf anlegen"
          savingLabel="Wird angelegt ..."
          message={
            isDirty
              ? "Sie haben ungespeicherte Eingaben."
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
