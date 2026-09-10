import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useLogin, useMe } from "../hooks/useAuth.js";
import { ApiError } from "../lib/api.js";

export default function Login() {
  const { data: me } = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/profil";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (me?.user) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Anmeldung fehlgeschlagen.");
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold">Anmelden</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="label">E-Mail-Adresse</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">Passwort</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={login.isPending}>
            {login.isPending ? "Bitte warten ..." : "Anmelden"}
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          <Link
            to="/passwort-vergessen"
            className="text-teal-700 hover:underline"
          >
            Passwort vergessen?
          </Link>
        </p>
        <p className="mt-2 text-sm text-slate-600 text-center">
          Noch keinen Account?{" "}
          <Link to="/registrieren" className="text-teal-700 hover:underline">
            Firma registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
