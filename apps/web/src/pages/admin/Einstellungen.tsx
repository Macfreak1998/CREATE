import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppSettings } from "@b2b/shared";
import { api, ApiError } from "../../lib/api.js";
import AdminNav from "./AdminNav.js";

const SETTINGS_KEY = ["admin", "settings"] as const;

export default function AdminEinstellungen() {
  const qc = useQueryClient();
  const settings = useQuery<AppSettings>({
    queryKey: SETTINGS_KEY,
    queryFn: () => api.get<AppSettings>("/api/admin/settings"),
  });

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [testEmail, setTestEmail] = useState("");
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) {
      setEmail(settings.data.admin_notification_email ?? "");
      if (settings.data.admin_notification_email) {
        setTestEmail((prev) =>
          prev.length > 0 ? prev : settings.data!.admin_notification_email!
        );
      }
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (input: AppSettings) =>
      api.put<AppSettings>("/api/admin/settings", input),
    onSuccess: (data) => {
      qc.setQueryData(SETTINGS_KEY, data);
      setSuccess("Einstellungen gespeichert.");
      setError(null);
    },
    onError: (err) => {
      setSuccess(null);
      setError(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen.");
    },
  });

  const sendTest = useMutation({
    mutationFn: (to: string) =>
      api.post<{ ok: true }>("/api/admin/settings/test-mail", { email: to }),
    onSuccess: () => {
      setTestSuccess(`Test-E-Mail an ${testEmail.trim()} versendet.`);
      setTestError(null);
    },
    onError: (err) => {
      setTestSuccess(null);
      setTestError(
        err instanceof ApiError
          ? err.message
          : "Test-E-Mail konnte nicht versendet werden."
      );
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmed = email.trim();
    save.mutate({
      admin_notification_email: trimmed.length > 0 ? trimmed : null,
    });
  };

  const onSendTest = (e: FormEvent) => {
    e.preventDefault();
    setTestError(null);
    setTestSuccess(null);
    const trimmed = testEmail.trim();
    if (!trimmed) {
      setTestError("Bitte eine E-Mail-Adresse eingeben.");
      return;
    }
    sendTest.mutate(trimmed);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />

      <section className="card p-6">
        <h2 className="text-lg font-semibold">Einstellungen</h2>
        <p className="mt-2 text-sm text-slate-600">
          E-Mail-Adresse, an die Benachrichtigungen versendet werden, sobald ein
          neues oder geaendertes Firmenprofil zur Freigabe vorliegt oder ein
          Feedback eingeht. Leer lassen, um Benachrichtigungen zu deaktivieren.
        </p>

        {settings.isLoading ? (
          <p className="mt-4 text-slate-500">Laden ...</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="admin-email" className="label">
                Benachrichtigungs-E-Mail
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="z. B. admin@create-cluster.de"
                maxLength={200}
              />
              {email.trim().length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Hinweis: Es werden derzeit keine Benachrichtigungen versendet.
                </p>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-700">{success}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={save.isPending}
              >
                {save.isPending ? "Speichere ..." : "Speichern"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="card p-6 mt-6">
        <h2 className="text-lg font-semibold">Mailversand testen</h2>
        <p className="mt-2 text-sm text-slate-600">
          Sendet eine feste Test-E-Mail an die angegebene Adresse, um die
          SMTP-Konfiguration zu pruefen. In der Entwicklung erscheint die Mail
          in Mailpit.
        </p>

        <form onSubmit={onSendTest} className="mt-4 space-y-4">
          <div>
            <label htmlFor="test-email" className="label">
              Empfänger-E-Mail
            </label>
            <input
              id="test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="input"
              placeholder="z. B. du@example.com"
              maxLength={200}
              required
            />
          </div>

          {testError && <p className="text-sm text-red-600">{testError}</p>}
          {testSuccess && (
            <p className="text-sm text-green-700">{testSuccess}</p>
          )}

          <button
            type="submit"
            className="btn-secondary"
            disabled={sendTest.isPending}
          >
            {sendTest.isPending ? "Sende ..." : "Test-E-Mail senden"}
          </button>
        </form>
      </section>
    </div>
  );
}
