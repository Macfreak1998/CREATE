import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { FeedbackInput } from "@b2b/shared";
import { api, ApiError } from "../lib/api.js";

export default function Feedback() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: FeedbackInput) =>
      api.post<{ ok: true }>("/api/feedback", input),
    onSuccess: () => {
      setSubmitted(true);
      setEmail("");
      setMessage("");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Senden fehlgeschlagen.");
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (message.trim().length < 10) {
      setError("Bitte gib eine Nachricht mit mindestens 10 Zeichen ein.");
      return;
    }
    mutation.mutate({ email, message: message.trim(), website });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <p className="mt-2 text-sm text-slate-600">
          Hast du Fragen, Anregungen oder einen Fehler gefunden? Wir freuen uns
          über dein Feedback. Hinterlasse uns eine kurze Nachricht, wir melden
          uns bei Bedarf bei der angegebenen E-Mail-Adresse.
        </p>

        {submitted ? (
          <div className="mt-6 text-sm text-green-700 space-y-2">
            <p>Vielen Dank für dein Feedback!</p>
            <button
              type="button"
              className="btn-secondary mt-4"
              onClick={() => setSubmitted(false)}
            >
              Weiteres Feedback senden
            </button>
          </div>
        ) : (
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
              <label htmlFor="message" className="label">
                Nachricht
              </label>
              <textarea
                id="message"
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="input min-h-[180px]"
                rows={8}
                maxLength={5000}
              />
              <p className="mt-1 text-xs text-slate-500">
                {message.length} / 5000 Zeichen
              </p>
            </div>

            {/* Honeypot: fuer Menschen unsichtbar, Bots fuellen es typischerweise aus. */}
            <div aria-hidden="true" className="hidden">
              <label htmlFor="website">Webseite</label>
              <input
                id="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Wird gesendet ..." : "Feedback senden"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
