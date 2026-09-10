import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { usePasswordResetConfirm } from "../hooks/useAuth.js";
import { ApiError } from "../lib/api.js";

export default function PasswortZuruecksetzen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reset = usePasswordResetConfirm();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const e = params.get("email");
    const c = params.get("code");
    if (e) setEmail(e);
    if (c) setCode(c);
  }, [params]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }
    if (password.length < 10) {
      setError("Das Passwort muss mindestens 10 Zeichen haben.");
      return;
    }

    try {
      await reset.mutateAsync({ email, code: code.trim(), password });
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Zurücksetzen fehlgeschlagen.");
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold">Neues Passwort setzen</h1>

        {success ? (
          <div className="mt-6 space-y-4 text-sm">
            <p className="text-green-700">
              Dein Passwort wurde erfolgreich geändert. Bestehende Sitzungen
              wurden abgemeldet. Du wirst gleich zum Login weitergeleitet ...
            </p>
            <Link to="/login" className="text-teal-700 hover:underline">
              Jetzt anmelden
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Gib den 6-stelligen Code aus der E-Mail und dein neues Passwort
              ein. Bestehende Sitzungen werden anschließend abgemeldet.
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
              <div>
                <label htmlFor="code" className="label">
                  Einmal-Code
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                  }
                  className="input tracking-widest text-center text-lg"
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
              <div>
                <label htmlFor="password" className="label">
                  Neues Passwort (mind. 10 Zeichen)
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={200}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="label">
                  Passwort wiederholen
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  maxLength={200}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={reset.isPending}
              >
                {reset.isPending ? "Bitte warten ..." : "Passwort speichern"}
              </button>
            </form>
            <p className="mt-6 text-sm text-slate-600 text-center">
              Noch keinen Code?{" "}
              <Link
                to="/passwort-vergessen"
                className="text-teal-700 hover:underline"
              >
                Code anfordern
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
