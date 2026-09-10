import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { usePasswordResetRequest } from "../hooks/useAuth.js";
import { ApiError } from "../lib/api.js";

export default function PasswortVergessen() {
  const reset = usePasswordResetRequest();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await reset.mutateAsync({ email });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Anfrage fehlgeschlagen.");
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold">Passwort vergessen</h1>

        {submitted ? (
          <div className="mt-6 space-y-4 text-sm">
            <p>
              Falls die Adresse bei uns registriert ist, wurde eine E-Mail mit
              einem Einmal-Code und einem Reset-Link versendet. Der Code ist 30
              Minuten gültig.
            </p>
            <p>
              Du hast keine E-Mail erhalten? Sieh in deinem Spam-Ordner nach
              oder fordere nach einigen Minuten erneut einen Code an.
            </p>
            <div className="pt-2 flex gap-4">
              <Link to="/login" className="text-teal-700 hover:underline">
                Zurück zum Login
              </Link>
              <Link
                to="/passwort-zuruecksetzen"
                className="text-teal-700 hover:underline"
              >
                Code eingeben
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Gib deine E-Mail-Adresse ein. Wir senden dir einen Einmal-Code
              und einen Link zum Zurücksetzen deines Passworts.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="label">
                  E-Mail-Adresse
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  maxLength={200}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={reset.isPending}
              >
                {reset.isPending ? "Bitte warten ..." : "Code anfordern"}
              </button>
            </form>
            <p className="mt-6 text-sm text-slate-600 text-center">
              <Link to="/login" className="text-teal-700 hover:underline">
                Zurück zum Login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
