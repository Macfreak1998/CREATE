import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useMe, useRegister } from "../hooks/useAuth.js";
import { api, ApiError } from "../lib/api.js";
import CompanyForm, {
  EMPTY_COMPANY_FORM,
  toUpdatePayload,
  type CompanyFormValue,
} from "../components/CompanyForm.js";
import CompanyLogo from "../components/CompanyLogo.js";
import SaveBar from "../components/SaveBar.js";
import { useRegisterUnsavedChanges } from "../hooks/useUnsavedChangesPrompt.js";

export default function Registrieren() {
  const { data: me } = useMe();
  const register = useRegister();
  const navigate = useNavigate();

  const [form, setForm] = useState<CompanyFormValue>(EMPTY_COMPANY_FORM);
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    password.length > 0 ||
    logoFile !== null;
  useRegisterUnsavedChanges(isDirty && !me?.user);

  if (me?.user) {
    return <Navigate to="/profil" replace />;
  }

  const onLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLogoFile(e.target.files?.[0] ?? null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = toUpdatePayload(form);
      await register.mutateAsync({
        company: payload,
        user: { email: userEmail, password },
      });
      if (logoFile) {
        try {
          const fd = new FormData();
          fd.append("logo", logoFile);
          await api.post("/api/me/company/logo", fd);
        } catch {
          // Logo-Upload optional - Registrierung bleibt erfolgreich.
        }
      }
      navigate("/profil", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Registrierung fehlgeschlagen.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-semibold">Firma registrieren</h1>
      <p className="mt-2 text-slate-600">
        Nach Absenden prüfen wir Ihre Angaben und schalten das Profil frei.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 pb-32">
        <CompanyForm
          value={form}
          onChange={setForm}
          logoSlot={
            <div className="space-y-3">
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
              <p className="text-xs text-slate-500">
                PNG, JPEG, WebP oder GIF. Max. 2 MB. Wird auf 512x512 WebP
                skaliert (ohne Beschneiden).
              </p>
            </div>
          }
        />

        <fieldset className="card p-6 space-y-4">
          <legend className="text-lg font-semibold px-2 -ml-2">
            Login-Zugang
          </legend>
          <div className="grid md:grid-cols-2 gap-4">
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
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">
                Passwort (min. 10 Zeichen) <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="password"
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                autoComplete="new-password"
              />
            </div>
          </div>
        </fieldset>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <SaveBar
          visible={isDirty || register.isPending}
          saving={register.isPending}
          saveLabel="Registrierung abschicken"
          savingLabel="Wird gesendet ..."
          message={
            isDirty
              ? "Sie haben ungespeicherte Eingaben."
              : "Wird gesendet ..."
          }
        >
          <Link to="/login" className="text-sm text-slate-600 hover:underline">
            Bereits registriert? Login
          </Link>
        </SaveBar>
      </form>
    </div>
  );
}
